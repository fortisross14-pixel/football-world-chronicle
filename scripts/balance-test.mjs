import {
  createWorld,
  simulateToSeasonEnd,
  startNextSeason,
  getRarityCounts
} from '../src/engine.js';
import { CONTINENTAL_DEFINITIONS, LEAGUE_DEFINITIONS } from '../src/data.js';

const SEASONS = Number(process.env.BALANCE_SEASONS || 8);
const world = createWorld(987654321);
const seasonSnapshots = [];

const clubById = (id) => world.clubs.find((club) => club.id === id);
const playerById = (id) => world.players.find((player) => player.id === id);
const leagueById = (id) => LEAGUE_DEFINITIONS.find((league) => league.id === id);

for (let index = 0; index < SEASONS; index += 1) {
  simulateToSeasonEnd(world);
  const season = world.season;
  const champions = world.history.champions.filter((entry) => entry.season === season);
  const ucl = champions.find((entry) => entry.competitionId === 'UCL');
  const ballon = world.history.awards.find((entry) => entry.season === season && entry.category === 'ballon_dor' && entry.rank === 1);
  const ballonPlayer = playerById(ballon?.playerId);
  const playerRows = world.history.playerSeasons.filter((row) => row.season === season && row.playerId === ballon?.playerId);
  const mainClubRow = playerRows.filter((row) => !row.isInternational).sort((a, b) => b.apps - a.apps || b.goals - a.goals)[0];
  const mainClub = clubById(mainClubRow?.teamId || ballonPlayer?.clubId);
  const mainLeague = leagueById(mainClub?.leagueId);
  const wonEliteClub = champions.some((entry) => ['UCL', 'UEL', 'LIB', 'CCC', 'ACL', 'CAFCL'].includes(entry.competitionId) && entry.winnerId === mainClub?.id);
  const wonInternational = champions.some((entry) => entry.isInternational && entry.winnerId === ballonPlayer?.nationality);
  seasonSnapshots.push({
    season,
    uclWinner: clubById(ucl?.winnerId)?.name || ucl?.winnerId,
    uclWinnerId: ucl?.winnerId,
    uclWinnerStrength: clubById(ucl?.winnerId)?.baseStrength,
    uclWinnerReputation: clubById(ucl?.winnerId)?.reputation,
    ballon: ballonPlayer?.name,
    ballonRarity: ballonPlayer?.rarity,
    ballonClub: mainClub?.name,
    ballonLeagueTier: mainLeague?.tier,
    ballonWonEliteClub: wonEliteClub,
    ballonWonInternational: wonInternational,
    activePlayers: world.players.filter((player) => player.status === 'active').length,
    transfers: world.history.transfers.filter((move) => move.season === season).length,
    eliteTransfers: world.history.transfers.filter((move) => move.season === season && ['generational', 'legend', 'epic'].includes(playerById(move.playerId)?.rarity)).length,
    medianFinances: null
  });
  const finances = world.clubs.map((club) => club.finances).sort((a, b) => a - b);
  seasonSnapshots.at(-1).medianFinances = finances[Math.floor(finances.length / 2)];
  if (index < SEASONS - 1) startNextSeason(world);
}

function longestStreak(values) {
  let best = 0;
  let current = 0;
  let prior = null;
  for (const value of values) {
    if (value && value === prior) current += 1;
    else current = value ? 1 : 0;
    best = Math.max(best, current);
    prior = value;
  }
  return best;
}

const career = new Map();
for (const row of world.history.playerSeasons) {
  const item = career.get(row.playerId) || { goals: 0, assists: 0, apps: 0, titles: 0 };
  item.goals += row.goals;
  item.assists += row.assists;
  item.apps += row.apps;
  career.set(row.playerId, item);
}
for (const honour of world.history.honours) {
  const item = career.get(honour.playerId) || { goals: 0, assists: 0, apps: 0, titles: 0 };
  item.titles += 1;
  career.set(honour.playerId, item);
}

const topCommon = world.players
  .filter((player) => player.rarity === 'common')
  .map((player) => ({ name: player.name, position: player.position, ...(career.get(player.id) || { goals: 0, assists: 0, apps: 0, titles: 0 }) }))
  .sort((a, b) => b.goals - a.goals)[0];
const generationalForwards = world.players
  .filter((player) => player.rarity === 'generational' && player.position === 'FW')
  .map((player) => ({ name: player.name, status: player.status, careerYear: player.careerYear, ...(career.get(player.id) || { goals: 0, assists: 0, apps: 0, titles: 0 }) }))
  .sort((a, b) => b.goals - a.goals);
const finances = world.clubs.map((club) => club.finances).sort((a, b) => a - b);
const richClubs = world.clubs.filter((club) => club.finances >= 1000).length;
const uclIds = seasonSnapshots.map((row) => row.uclWinnerId);
const ballonCredible = seasonSnapshots.filter((row) => row.ballonLeagueTier === 'detailed' || row.ballonWonEliteClub || row.ballonWonInternational).length;
const weakUclWinners = seasonSnapshots.filter((row) => (row.uclWinnerStrength || 100) < 72 && (row.uclWinnerReputation || 100) < 74);
const rarityCounts = getRarityCounts(world);

const report = {
  seasons: SEASONS,
  seasonSnapshots,
  ucl: {
    uniqueWinners: new Set(uclIds.filter(Boolean)).size,
    longestWinningStreak: longestStreak(uclIds),
    weakWinnerSeasons: weakUclWinners.map((row) => ({ season: row.season, club: row.uclWinner }))
  },
  ballonDor: {
    credibleContextRate: Number((ballonCredible / SEASONS).toFixed(2)),
    winners: seasonSnapshots.map((row) => ({ season: row.season, player: row.ballon, rarity: row.ballonRarity, club: row.ballonClub }))
  },
  players: {
    activeAtEnd: world.players.filter((player) => player.status === 'active').length,
    totalCreated: world.players.length,
    rarityCounts,
    topCommon,
    generationalForwards
  },
  economy: {
    minimum: finances[0],
    median: finances[Math.floor(finances.length / 2)],
    p90: finances[Math.floor(finances.length * 0.9)],
    maximum: finances.at(-1),
    clubsAbove1000: richClubs,
    totalTransfers: world.history.transfers.length,
    averageTransfersPerSeason: Math.round(world.history.transfers.length / SEASONS)
  },
  continentalWinners: Object.fromEntries(CONTINENTAL_DEFINITIONS.map((definition) => [
    definition.id,
    world.history.champions.filter((entry) => entry.competitionId === definition.id).map((entry) => clubById(entry.winnerId)?.name || entry.winnerId)
  ]))
};

const warnings = [];
if (report.ucl.longestWinningStreak > 4) warnings.push(`UCL dominance too high: ${report.ucl.longestWinningStreak} consecutive titles.`);
if (weakUclWinners.length > Math.ceil(SEASONS * 0.25)) warnings.push('Too many weak clubs win the Champions League.');
if (report.ballonDor.credibleContextRate < 0.75) warnings.push('Too many Ballon d’Or winners lack an elite league, continental, or international context.');
if ((topCommon?.goals || 0) > SEASONS * 42) warnings.push(`A common player scores implausibly often: ${topCommon.goals}.`);
if (world.players.filter((player) => player.status === 'active').length > world.targetActivePlayers * 1.18) warnings.push('The active player pool is growing too quickly.');
if (richClubs > world.clubs.length * 0.12) warnings.push('Too many clubs are hoarding more than $1bn.');
report.warnings = warnings;

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(warnings.length ? 2 : 0));
