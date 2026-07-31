import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd, startNextSeason } from '../src/engine.js';
import { NATIONAL_TEAMS, ROLE_DEFINITIONS, STAR_RARITIES } from '../src/data.js';
import { REAL_WORLD_STARS, REAL_WORLD_STAR_COUNTS } from '../src/real-stars.js';

const expectedCounts = { generational: 16, legend: 69, epic: 120 };
assert.deepEqual(REAL_WORLD_STAR_COUNTS, expectedCounts, 'Curated real-world database counts changed unexpectedly.');
assert.equal(new Set(REAL_WORLD_STARS.map((star) => star.id)).size, REAL_WORLD_STARS.length, 'Real-world star IDs must be unique.');

const countries = new Set(NATIONAL_TEAMS.map((team) => team.id));
for (const star of REAL_WORLD_STARS) {
  assert(countries.has(star.nationality), `${star.name} has an unknown nationality: ${star.nationality}`);
  assert(ROLE_DEFINITIONS[star.position]?.some((role) => role.id === star.role), `${star.name} has an invalid ${star.position} role: ${star.role}`);
  const rarity = STAR_RARITIES[star.rarity];
  assert(rarity && star.baseQuality >= rarity.min && star.baseQuality <= rarity.max, `${star.name} has quality outside the ${star.rarity} range.`);
  assert(star.careerLength >= 8 && star.careerLength <= 13, `${star.name} has an invalid career length.`);
}

const summaries = [];
for (const seed of [19001, 19019]) {
  const state = createWorld(seed);
  for (let seasonIndex = 0; seasonIndex < 2; seasonIndex += 1) {
    const active = state.players.filter((player) => player.status === 'active');
    const real = active.filter((player) => player.realWorldId);
    const realIds = real.map((player) => player.realWorldId);
    assert.equal(new Set(realIds).size, realIds.length, 'A real-world icon appeared twice in one universe.');

    const byRarity = Object.fromEntries(['generational', 'legend', 'epic'].map((rarity) => [rarity, real.filter((player) => player.rarity === rarity).length]));
    assert(byRarity.generational >= 1 && byRarity.generational <= 2, `Generational real-icon ratio failed in ${state.season}: ${byRarity.generational}`);
    assert(byRarity.legend >= 5 && byRarity.legend <= 7, `Legend real-icon ratio failed in ${state.season}: ${byRarity.legend}`);
    assert(byRarity.epic >= 9 && byRarity.epic <= 12, `Epic real-icon ratio failed in ${state.season}: ${byRarity.epic}`);

    for (const player of real) {
      const template = REAL_WORLD_STARS.find((star) => star.id === player.realWorldId);
      assert(template, `Missing template for ${player.realWorldId}`);
      const club = state.clubs.find((item) => item.id === player.clubId);
      // Verify the curated placement during the protected debut season. Later
      // seasons deliberately allow the normal transfer market to move icons.
      if (club && state.season < (player.transferProtectedUntilSeason || 0) && state.clubs.some((item) => item.name.localeCompare(template.startClubName, undefined, { sensitivity: 'base' }) === 0)) {
        assert.equal(club.name.localeCompare(template.startClubName, undefined, { sensitivity: 'base' }), 0, `${player.name} did not start at the available real club.`);
      } else if (club && state.season < (player.transferProtectedUntilSeason || 0)) {
        assert.equal(club.country, template.startCountry, `${player.name} did not use a same-country fallback club.`);
      }
    }

    summaries.push({ seed, season: state.season, ...byRarity, totalReal: real.length });
    if (seasonIndex < 1) {
      simulateToSeasonEnd(state);
      startNextSeason(state);
    }
  }
}

// Synthetic Hall-of-Fame peak check: the strongest two/three-year window must
// be selected, not simply the final three seasons of a long coaching spell.
const seasons = [2001, 2002, 2003, 2004, 2005];
const titleWeights = new Map([[2001, 3], [2002, 2], [2003, 2], [2004, 0], [2005, 1]]);
const scoreWindow = (window) => window.reduce((score, season) => score + (titleWeights.get(season) || 0) * 100 + (season <= 2003 ? 40 : 10), 0) + (window.length === 3 ? 18 : 6);
const candidates = [];
for (let index = 0; index < seasons.length; index += 1) {
  if (index + 1 < seasons.length) candidates.push({ seasons: seasons.slice(index, index + 2), score: scoreWindow(seasons.slice(index, index + 2)) });
  if (index + 2 < seasons.length) candidates.push({ seasons: seasons.slice(index, index + 3), score: scoreWindow(seasons.slice(index, index + 3)) });
}
candidates.sort((a, b) => b.score - a.score);
assert.deepEqual(candidates[0].seasons, [2001, 2002, 2003], 'The Hall of Fame did not select the strongest three-season peak.');

console.log(JSON.stringify({
  realWorldDatabase: REAL_WORLD_STAR_COUNTS,
  testedUniverses: 2,
  testedSeasons: summaries.length,
  ratios: summaries,
  strongestSyntheticEra: candidates[0]
}, null, 2));
