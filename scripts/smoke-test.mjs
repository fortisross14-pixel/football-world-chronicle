import {
  createWorld,
  simulateNextWeek,
  simulateToSeasonEnd,
  startNextSeason,
  getLeagueTable
} from '../src/engine.js';
import { LEAGUE_DEFINITIONS } from '../src/data.js';

const world = createWorld(123456);
if (world.clubs.length < 200) throw new Error(`Expected an expanded universe of at least 200 clubs, received ${world.clubs.length}`);
if (world.players.length < 1200) throw new Error(`Expected at least 1,200 named players, received ${world.players.length}`);
if (Object.keys(world.current.leagues).length !== LEAGUE_DEFINITIONS.length) throw new Error('Not every configured country has a league state');
if (Object.keys(world.current.domesticCups).length !== LEAGUE_DEFINITIONS.length) throw new Error('Not every configured country has a domestic cup');
if (world.current.champions.groups.length !== 8) throw new Error('European Champions Cup did not initialize with eight groups');

simulateNextWeek(world);
if (world.current.week !== 1) throw new Error('Week did not advance');
if (!world.current.matches.length) throw new Error('No matches were simulated');

simulateToSeasonEnd(world);
if (!world.current.completed) throw new Error('Season did not close');
if (world.history.playerSeasons.length < 2500) throw new Error(`Player history was not fully compacted: ${world.history.playerSeasons.length}`);
if (!world.history.awards.some((award) => award.category === 'ballon_dor' && award.rank === 1)) throw new Error('Ballon d’Or was not awarded');
if (getLeagueTable(world, 'ESP1')[0].played !== 38) throw new Error('La Liga did not complete 38 matches per club');
if (!world.history.champions.some((entry) => entry.competitionId === 'UCL')) throw new Error('European champion was not archived');
if (!world.history.champions.some((entry) => entry.competitionId === 'EURO')) throw new Error('European national-team champion was not archived');
for (const definition of LEAGUE_DEFINITIONS) {
  if (!world.history.champions.some((entry) => entry.competitionId === `CUP-${definition.id}`)) {
    throw new Error(`${definition.cupName} champion was not archived`);
  }
}

const priorSeason = world.season;
startNextSeason(world);
if (world.season !== priorSeason + 1 || world.current.week !== 0) throw new Error('Next season did not initialize');

console.log(JSON.stringify({
  countries: LEAGUE_DEFINITIONS.length,
  clubs: world.clubs.length,
  players: world.players.length,
  domesticCups: Object.keys(world.current.domesticCups).length,
  archivedPlayerRows: world.history.playerSeasons.length,
  awards: world.history.awards.length,
  champions: world.history.champions.length,
  nextSeason: world.current.seasonLabel
}, null, 2));
