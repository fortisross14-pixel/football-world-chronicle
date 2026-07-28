import assert from 'node:assert/strict';
import {
  createWorld,
  simulateToSeasonEnd,
  startNextSeason,
  getCoachTotals,
  getCoachCareer,
  getCompetitionCoachLeaderboard
} from '../src/engine.js';
import { COUNTRY_META } from '../src/data.js';

const world = createWorld(7262001);
const coach = (id) => world.coaches.find((item) => item.id === id);
const domesticClubCoach = (club) => coach(club.coachId)?.nationality === String(COUNTRY_META[club.country]?.code || '').toLowerCase();
const domesticNationCoach = (team) => coach(team.coachId)?.nationality === team.id;

const tier1 = world.nationalTeams.filter((team) => team.tier === 1);
const tier2 = world.nationalTeams.filter((team) => team.tier === 2);
const majorClubs = world.clubs.filter((club) => club.division === 1 && club.reputation >= 78 && club.reputation < 86);
const eliteClubs = world.clubs.filter((club) => club.division === 1 && club.reputation >= 86);

const ratio = (items, predicate) => items.filter(predicate).length / Math.max(1, items.length);
const initialRates = {
  tier1National: ratio(tier1, domesticNationCoach),
  tier2National: ratio(tier2, domesticNationCoach),
  majorClubs: ratio(majorClubs, domesticClubCoach),
  eliteClubs: ratio(eliteClubs, domesticClubCoach)
};

assert.ok(initialRates.tier1National >= 0.85, 'Tier 1 national teams should overwhelmingly appoint domestic coaches');
assert.ok(initialRates.tier2National >= 0.65, 'Tier 2 national teams should usually appoint domestic coaches');
assert.ok(initialRates.majorClubs >= 0.55 && initialRates.majorClubs <= 0.75, 'Major clubs should have a moderate domestic preference');
assert.ok(initialRates.eliteClubs >= 0.35 && initialRates.eliteClubs <= 0.75, 'Elite clubs should recruit from both domestic and global markets');

simulateToSeasonEnd(world);
assert.ok(world.history.coachCompetitionSeasons.length > 2000, 'Coach competition histories should be archived');
assert.ok(world.history.coachSeasons.length > 1000, 'Coach team-by-season histories should be archived');
assert.ok(world.history.champions.some((row) => row.coachId), 'Champions should retain the winning coach');

const uclRows = getCompetitionCoachLeaderboard(world, 'UCL');
assert.ok(uclRows.length >= 20, 'Champions League should have coach statistics');
assert.equal(uclRows.reduce((sum, row) => sum + row.titles, 0), 1, 'One coach should receive the Champions League title');

const busiest = world.coaches
  .map((item) => ({ item, totals: getCoachTotals(world, item.id) }))
  .sort((a, b) => b.totals.games - a.totals.games)[0];
assert.ok(busiest.totals.games > 40, 'Leading coaches should have a substantial match record');
const career = getCoachCareer(world, busiest.item.id);
assert.ok(career.seasons.length >= 1, 'Coach profile should contain a team-by-season timeline');
assert.ok(career.competitionSeasons.length >= 1, 'Coach profile should contain competition detail');

startNextSeason(world);
const tier1After = world.nationalTeams.filter((team) => team.tier === 1);
const afterRate = ratio(tier1After, domesticNationCoach);
assert.ok(afterRate >= 0.75, 'Elite national teams should retain a strong domestic-coach identity after the market');

console.log(JSON.stringify({
  initialRates,
  afterTier1NationalRate: afterRate,
  coachCompetitionRows: world.history.coachCompetitionSeasons.length,
  coachSeasonRows: world.history.coachSeasons.length,
  championsWithCoach: world.history.champions.filter((row) => row.coachId).length,
  uclCoachRows: uclRows.length,
  busiestCoach: {
    name: busiest.item.name,
    rarity: busiest.item.rarity,
    ...busiest.totals
  }
}, null, 2));
