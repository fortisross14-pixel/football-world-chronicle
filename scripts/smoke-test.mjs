import {
  createWorld,
  simulateNextWeek,
  simulateToSeasonEnd,
  startNextSeason,
  getLeagueTable,
  getRarityCounts,
  getPlayerTotals
} from '../src/engine.js';
import {
  LEAGUE_DEFINITIONS,
  NATIONAL_TEAMS,
  CONTINENTAL_DEFINITIONS,
  STAR_RARITIES,
  CAREER_TYPES,
  ROLE_DEFINITIONS,
  START_SEASON
} from '../src/data.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const world = createWorld(123456);
const initialCounts = getRarityCounts(world);
const detailed = LEAGUE_DEFINITIONS.filter((league) => league.tier === 'detailed');
const summary = LEAGUE_DEFINITIONS.filter((league) => league.tier === 'summary');

assert(world.version === 4, `Expected save version 4, received ${world.version}`);
assert(world.season === START_SEASON && START_SEASON === 2001, 'The universe must begin in 2001');
assert(LEAGUE_DEFINITIONS.length === NATIONAL_TEAMS.length && NATIONAL_TEAMS.length >= 120, 'Every national team must have a domestic system');
assert(detailed.length >= 25, `Expected at least 25 full leagues, received ${detailed.length}`);
assert(world.clubs.length >= 1300, `Expected at least 1,300 clubs, received ${world.clubs.length}`);
assert(world.players.length >= 6500, `Expected at least 6,500 named players, received ${world.players.length}`);
assert(world.owners.length === world.clubs.length, 'Every club must have an owner or president');
assert(world.coaches.length > world.clubs.length + world.nationalTeams.length, 'The coach pool must include free agents');
assert(!world.clubs.some((club) => /^fc barcelona$/i.test(club.name)), 'FC Barcelona must not exist in the universe');
assert(Object.keys(world.current.leagues).length === LEAGUE_DEFINITIONS.length, 'Not every country has a league state');
assert(Object.keys(world.current.domesticCups).length === LEAGUE_DEFINITIONS.length, 'Not every country has a domestic cup');
assert(Object.keys(world.current.continentalCompetitions).length === CONTINENTAL_DEFINITIONS.length, 'Not every continental club competition initialized');
assert(world.current.champions === world.current.continentalCompetitions.UCL, 'Champions League alias is broken');
assert(Object.keys(world.current.internationalCompetitions).includes('WCQ'), '2001 must open with World Cup qualifying');

for (const league of detailed) {
  const top = world.current.leagues[league.id].table.length;
  const reserves = world.clubs.filter((club) => club.leagueId === league.id && club.division === 2).length;
  assert(top === 20, `${league.name} has ${top} top-flight clubs instead of 20`);
  assert(reserves === 7, `${league.name} has ${reserves} promotion clubs instead of 7`);
}
for (const league of summary) assert(world.current.leagues[league.id].table.length === 6, `${league.name} summary must show six clubs`);

assert(initialCounts.generational <= 3, `Generational cap broken: ${initialCounts.generational}`);
assert(initialCounts.legend >= 12 && initialCounts.legend <= 15, `Legend target broken: ${initialCounts.legend}`);
assert(initialCounts.epic >= 30 && initialCounts.epic <= 50, `Epic target broken: ${initialCounts.epic}`);
assert(Object.keys(CAREER_TYPES).length >= 10, 'Expected at least ten career-curve types');
assert(Object.values(ROLE_DEFINITIONS).flat().length >= 15, 'Expected a broad tactical-role library');

for (const player of world.players) {
  const rarity = STAR_RARITIES[player.rarity];
  assert(Boolean(rarity), `Unknown rarity for ${player.name}`);
  assert(player.baseQuality >= rarity.min && player.baseQuality <= rarity.max, `${player.name} is outside the ${rarity.label} quality range`);
  assert(player.careerLength >= 8 && player.careerLength <= 13, `${player.name} has an invalid career length`);
  assert(player.careerMultipliers.every((value) => value >= 0.85 && value <= 1.02), `${player.name} has an invalid career multiplier`);
}

simulateNextWeek(world);
assert(world.current.week === 1, 'Week did not advance');
assert(world.current.matches.length > 200, 'The detailed football calendar did not simulate');
assert(world.current.transfers.length > 100, 'The opening transfer market generated too few moves');

simulateToSeasonEnd(world);
assert(world.current.completed, 'The 2001 season did not close');
assert(world.internationalCycle.worldCupQualified.length === 32, 'World Cup qualifying did not produce 32 teams');
assert(getLeagueTable(world, 'ESP1')[0].played === 38, 'La Liga did not complete 38 matches per club');
assert(summary.every((league) => world.current.leagues[league.id].championId), 'A summary league failed to produce a champion');
for (const competition of CONTINENTAL_DEFINITIONS) {
  assert(world.history.champions.some((entry) => entry.competitionId === competition.id), `${competition.name} champion was not archived`);
}
assert(world.history.awards.some((award) => award.category === 'ballon_dor' && award.rank === 1), 'Ballon d’Or was not awarded');

const preMovement = new Map(detailed.map((league) => [league.id, world.clubs.filter((club) => club.leagueId === league.id && club.division === 1).map((club) => club.id).sort().join('|')]));
startNextSeason(world);
assert(world.season === 2002, 'The next season did not begin');
assert(world.history.leagueMovements.length === detailed.length, 'Promotion and relegation were not archived for every full league');
assert(detailed.some((league) => preMovement.get(league.id) !== world.clubs.filter((club) => club.leagueId === league.id && club.division === 1).map((club) => club.id).sort().join('|')), 'No league changed membership');
assert(world.current.transfers.length > 100, 'The new transfer market did not run');
assert(world.current.news.some((story) => story.category === 'Preseason Favorites'), 'The preseason magazine did not publish favorites');

const decoratedPlayer = [...world.players]
  .map((player) => ({ player, totals: getPlayerTotals(world, player.id) }))
  .sort((a, b) => b.totals.titles - a.totals.titles || b.totals.goals - a.totals.goals)[0];
assert(decoratedPlayer?.totals.titles > 0, 'Player honours were not generated');

console.log(JSON.stringify({
  startSeason: START_SEASON,
  fullLeagues: detailed.length,
  summaryLeagues: summary.length,
  nationalTeams: NATIONAL_TEAMS.length,
  clubs: world.clubs.length,
  activePlayers: world.players.filter((player) => player.status === 'active').length,
  owners: world.owners.length,
  coaches: world.coaches.length,
  continentalCompetitions: Object.keys(world.current.continentalCompetitions).length,
  archivedPlayerRows: world.history.playerSeasons.length,
  awards: world.history.awards.length,
  champions: world.history.champions.length,
  transfersFirstSeason: world.history.transfers.filter((move) => move.season === 2001).length,
  promotionMovements: world.history.leagueMovements.length,
  coachMoves: world.history.coachMoves.length,
  decoratedPlayer: { name: decoratedPlayer.player.name, titles: decoratedPlayer.totals.titles }
}, null, 2));
