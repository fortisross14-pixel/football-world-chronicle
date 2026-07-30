import { createWorld, simulateToSeasonEnd, startNextSeason } from '../src/engine.js';

const world = createWorld(42424242);
const seasons = 2;
for (let index = 0; index < seasons; index += 1) {
  simulateToSeasonEnd(world);
  if (index < seasons - 1) startNextSeason(world);
}

const playerById = new Map(world.players.map((player) => [player.id, player]));
const active = world.players.filter((player) => player.status === 'active');
const positionCounts = (items, playerSelector = (item) => item) => items.reduce((counts, item) => {
  const player = playerSelector(item);
  if (player?.position) counts[player.position] = (counts[player.position] || 0) + 1;
  return counts;
}, {});

const transfers = world.history.transfers;
const eliteTransfers = transfers.filter((move) => ['generational', 'legend', 'epic'].includes(playerById.get(move.playerId)?.rarity));
const openAwards = world.history.awards.filter((award) => ['mvp', 'ballon_dor', 'kopa'].includes(award.category));
const competitionMvps = world.history.awards.filter((award) => award.category === 'mvp');

// Controlled Neymar/Ronaldo-style scenario: a 25-year-old generational star has
// spent his development years at Flamengo without a Libertadores final or title.
const migrationWorld = createWorld(99112233);
simulateToSeasonEnd(migrationWorld);
const superstar = migrationWorld.players.find((player) => player.rarity === 'generational' && player.status === 'active');
superstar.clubId = 'flamengo';
superstar.birthYear = migrationWorld.season - 25;
superstar.careerYear = 7;
superstar.baseQuality = 97;
superstar.rating = 97;
superstar.contractYears = 3;
superstar.happiness = 82;
superstar.marketValue = 220;
superstar.salary = 8;
migrationWorld.history.champions = migrationWorld.history.champions.filter(
  (row) => !(row.competitionId === 'LIB' && (row.winnerId === 'flamengo' || row.runnerUpId === 'flamengo'))
);
startNextSeason(migrationWorld);
const destination = migrationWorld.clubs.find((club) => club.id === superstar.clubId);
const superstarMove = migrationWorld.history.transfers.filter((move) => move.playerId === superstar.id).at(-1) || null;

const poolPositions = positionCounts(active);
const transferPositions = positionCounts(transfers, (move) => playerById.get(move.playerId));
const eliteTransferPositions = positionCounts(eliteTransfers, (move) => playerById.get(move.playerId));
const openAwardPositions = positionCounts(openAwards, (award) => playerById.get(award.playerId));
const mvpPositions = positionCounts(competitionMvps, (award) => playerById.get(award.playerId));

const rate = (part, total) => Number((part / Math.max(1, total)).toFixed(3));
const report = {
  seasons,
  activePlayerPositions: poolPositions,
  transfers: {
    total: transfers.length,
    byPosition: transferPositions,
    goalkeeperRate: rate(transferPositions.GK || 0, transfers.length),
    eliteTotal: eliteTransfers.length,
    eliteByPosition: eliteTransferPositions,
    eliteGoalkeeperRate: rate(eliteTransferPositions.GK || 0, eliteTransfers.length)
  },
  openAwards: {
    total: openAwards.length,
    byPosition: openAwardPositions,
    goalkeeperRate: rate(openAwardPositions.GK || 0, openAwards.length),
    competitionMvpTotal: competitionMvps.length,
    competitionMvpByPosition: mvpPositions,
    competitionMvpGoalkeeperRate: rate(mvpPositions.GK || 0, competitionMvps.length)
  },
  superstarMigration: {
    moved: destination?.id !== 'flamengo',
    destination: destination?.name || null,
    destinationConfederation: destination?.confederation || null,
    fee: superstarMove?.fee || null
  }
};

console.log(JSON.stringify(report, null, 2));
if (report.transfers.goalkeeperRate > 0.13) process.exitCode = 2;
if (report.transfers.eliteGoalkeeperRate > 0.22) process.exitCode = 2;
if (report.openAwards.competitionMvpGoalkeeperRate > 0.12) process.exitCode = 2;
if (!report.superstarMigration.moved || report.superstarMigration.destinationConfederation !== 'Europe') process.exitCode = 2;
