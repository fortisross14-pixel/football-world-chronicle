import assert from 'node:assert/strict';
import { createWorld, simulateNextWeek } from '../src/engine.js';
import { NATIONAL_TEAMS } from '../src/data.js';

const state = createWorld(7262001);
const croatian = state.clubs.filter((club) => club.country === 'Croatia').map((club) => club.name);
for (const expected of ['Dinamo Zagreb', 'Hajduk Split', 'Rijeka', 'Osijek']) {
  assert(croatian.includes(expected), `Missing recognizable Croatian club: ${expected}`);
}

while (state.current.week < 46) simulateNextWeek(state);
const groupMatches = state.current.matches.filter((match) => match.competitionId === 'WC');
assert.equal(groupMatches.length, 48, 'World Cup must have 48 group matches after week 46');
assert.equal(state.current.date, '2002-06-19', 'World Cup group stage should occur in June 2002');
assert.equal(state.current.internationalCompetitions.WC.stage, 'Round of 16');

while (state.current.week < 50) simulateNextWeek(state);
const worldCupMatches = state.current.matches.filter((match) => match.competitionId === 'WC');
assert.equal(worldCupMatches.length, 63, 'World Cup should have 63 matches without a third-place game');
assert(state.current.internationalCompetitions.WC.championId, 'World Cup should have a champion by week 50');
assert(state.current.internationalCompetitions.WC.recap?.mvpId, 'World Cup recap should retain MVP');

const appearances = Object.values(state.current.playerStats)
  .filter((row) => row.competitionId === 'WC')
  .map((row) => row.apps);
assert(Math.max(...appearances) <= 7, 'No player can play more than seven World Cup matches');

while (!state.current.completed) simulateNextWeek(state);
for (const category of ['ballon_dor', 'golden_boot', 'kopa', 'best_gk', 'best_df', 'best_mf', 'best_fw']) {
  assert(state.history.awards.some((award) => award.season === 2001 && award.category === category), `Missing annual award ${category}`);
}
for (const category of ['ballon_dor', 'golden_boot', 'kopa']) {
  const podium = state.history.awards.filter((award) => award.season === 2001 && award.category === category);
  assert.deepEqual(podium.map((award) => award.rank).sort(), [1, 2, 3], `${category} should store gold, silver and bronze`);
}

const topCountries = new Set(['Spain', 'Germany', 'France', 'England', 'Italy', 'Argentina']);
const countryCode = new Map(NATIONAL_TEAMS.map((team) => [team.name, team.id]));
const topClubs = state.clubs.filter((club) => topCountries.has(club.country) && club.division === 1 && club.reputation >= 78);
const domesticCoaches = topClubs.filter((club) => state.coaches.find((coach) => coach.id === club.coachId)?.nationality === countryCode.get(club.country));
assert(domesticCoaches.length / topClubs.length >= 0.55, 'Top-country clubs should usually employ domestic coaches');

console.log(JSON.stringify({
  croatianClubs: croatian,
  worldCupDate: state.current.date,
  worldCupChampion: state.current.internationalCompetitions.WC.championId,
  maxWorldCupApps: Math.max(...appearances),
  annualAwards: state.history.awards.filter((award) => award.season === 2001 && ['ballon_dor','golden_boot','kopa','best_gk','best_df','best_mf','best_fw'].includes(award.category)).length,
  topClubDomesticCoachRate: Number((domesticCoaches.length / topClubs.length).toFixed(2))
}, null, 2));
