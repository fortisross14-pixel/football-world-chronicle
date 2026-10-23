// Phase 6: predictions game, bookmaker odds and upsets. (The following feed is
// a UI feature and is checked in regression-v4-ui.)
import assert from 'node:assert/strict';
import {
  createWorld, simulateWeeks, simulateToSeasonEnd, startNextSeason, upgradeWorld,
  decimalOdds, getFixtureOdds, getSeasonUpsets,
  getPredictionForm, setPrediction, scorePredictions, getPredictionHistory, predictionsLocked, PREDICTION_POINTS
} from '../src/engine.js';
import * as legacy from './fixtures/legacy-r25/src/engine.js';

const report = {};

// Odds: a 6 % overround, favourites priced shorter.
const prices = decimalOdds([0.5, 0.27, 0.23]);
const overround = prices.reduce((sum, price) => sum + 1 / price, 0);
assert(overround > 1.05 && overround < 1.07, 'bookmaker margin is about 6 %');
const world = createWorld(60601);
const clubs = [...world.clubs].filter((club) => club.leagueId === 'ENG1').sort((a, b) => b.strength - a.strength);
const strongHome = getFixtureOdds(world, { homeId: clubs[0].id, awayId: clubs.at(-1).id, competitionId: 'ENG1' });
assert(strongHome.decimal[0] < strongHome.decimal[2], 'the stronger side is the favourite');
report.sampleOdds = { fixture: `${clubs[0].name} v ${clubs.at(-1).name}`, prices: strongHome.decimal };

// Predictions: open before the season, locked once it starts.
const form = getPredictionForm(world);
assert.equal(form.locked, false);
assert.deepEqual(form.questions.map((question) => question.key), ['ENG1', 'ESP1', 'ITA1', 'GER1', 'FRA1', 'UCL', 'ballon_dor', 'golden_boot']);
for (const question of form.questions) assert(question.options.length >= 8, `${question.key} offers a real choice`);
for (const question of form.questions) assert(setPrediction(world, question.key, question.options[0].id));
assert.equal(Object.keys(getPredictionForm(world).picks).length, 8);
simulateWeeks(world, 1);
assert(predictionsLocked(world), 'picks lock once the first week is played');
assert.equal(setPrediction(world, 'ENG1', clubs.at(-1).id), false, 'locked picks cannot change');
const savedPicks = { ...world.predictions.current.picks };

// Odds are calibrated: matches priced as 60–70 % home wins are won by the home side about that often.
const bins = new Map();
simulateWeeks(world, 50);
for (const match of world.current.matches) {
  if (!match.odds || match.light) continue;
  const bin = Math.min(9, Math.floor(match.odds[0] * 10));
  const row = bins.get(bin) || { matches: 0, wins: 0, expected: 0 };
  row.matches += 1; row.expected += match.odds[0];
  if (match.homeGoals > match.awayGoals || (match.winnerId === match.homeId && match.penalties)) row.wins += 1;
  bins.set(bin, row);
}
report.homeWinCalibration = Object.fromEntries([...bins].sort((a, b) => a[0] - b[0]).filter(([, row]) => row.matches >= 200)
  .map(([bin, row]) => [`${bin * 10}-${bin * 10 + 10}%`, { matches: row.matches, expected: Number((row.expected / row.matches).toFixed(3)), actual: Number((row.wins / row.matches).toFixed(3)) }]));
// v4.3: elite in-match effects (shot share, finishing, saves) are not in the pre-match
// price, and bands of ~250 matches carry about ±3 points of noise; 10 points is the bound.
for (const [label, row] of Object.entries(report.homeWinCalibration)) assert(Math.abs(row.expected - row.actual) < 0.1, `odds stay calibrated in the ${label} band`);

// Upsets: long-priced winners, ordered by price, with odds quoted in the story.
const upsets = getSeasonUpsets(world, 10);
assert(upsets.length >= 5, 'every season has upsets');
assert(upsets.every((row, index) => row.price >= 4 && (!index || upsets[index - 1].price >= row.price)));
const upsetStories = world.current.news.filter((story) => story.storyType === 'upset');
assert(upsetStories.some((story) => /bookmakers had them at/.test(story.body)), 'upset stories quote the odds');
report.upsets = { biggestPrice: upsets[0].price, stories: upsetStories.length };

// Scoring at season end: perfect picks score the maximum, hits and near misses count.
simulateWeeks(world, 1);
assert(world.current.completed);
const champions = world.history.champions.filter((row) => row.season === world.season);
const awards = world.history.awards.filter((row) => row.season === world.season && row.rank === 1);
const perfect = Object.fromEntries([
  ...['ENG1', 'ESP1', 'ITA1', 'GER1', 'FRA1', 'UCL'].map((key) => [key, champions.find((row) => row.competitionId === key)?.winnerId]),
  ['ballon_dor', awards.find((row) => row.category === 'ballon_dor')?.playerId],
  ['golden_boot', awards.find((row) => row.category === 'golden_boot')?.playerId]
].filter(([, value]) => value));
const best = scorePredictions(world, world.season, perfect);
assert.equal(best.points, best.max, 'perfect picks score the maximum');
assert.equal(best.max, PREDICTION_POINTS.league.hit * 5 + PREDICTION_POINTS.UCL.hit + PREDICTION_POINTS.ballon_dor.hit + PREDICTION_POINTS.golden_boot.hit);
const runnerUp = champions.find((row) => row.competitionId === 'ENG1')?.runnerUpId;
assert.equal(scorePredictions(world, world.season, { ENG1: runnerUp }).points, PREDICTION_POINTS.league.close, 'runner-up picks earn a point');
const actual = scorePredictions(world);
assert.deepEqual(Object.keys(world.predictions.current.picks).sort(), Object.keys(savedPicks).sort());
report.readerScore = { points: actual.points, max: actual.max };

// Next season: the card joins the history and a new card opens.
startNextSeason(world);
const history = getPredictionHistory(world);
assert.equal(history.length, 1);
assert.equal(history[0].points, actual.points);
assert.equal(getPredictionForm(world).locked, false);
assert.equal(Object.keys(getPredictionForm(world).picks).length, 0);

// Determinism: picks, and pricing fixtures for the UI, never change the world.
const plain = createWorld(60602); simulateWeeks(plain, 8);
const picked = createWorld(60602);
for (const question of getPredictionForm(picked).questions) setPrediction(picked, question.key, question.options[1].id);
const englishClubs = picked.clubs.filter((club) => club.leagueId === 'ENG1');
for (let week = 0; week < 8; week += 1) {
  for (let index = 0; index + 1 < englishClubs.length; index += 2) getFixtureOdds(picked, { homeId: englishClubs[index].id, awayId: englishClubs[index + 1].id, competitionId: 'ENG1' });
  getFixtureOdds(picked, { homeId: englishClubs[0].id, awayId: englishClubs[1].id, competitionId: 'UCL', knockout: true });
  getPredictionForm(picked);
  simulateWeeks(picked, 1);
}
assert.equal(JSON.stringify(plain.current.matches.map((match) => [match.id, match.homeGoals, match.awayGoals])), JSON.stringify(picked.current.matches.map((match) => [match.id, match.homeGoals, match.awayGoals])));

// Migration: a revision-25 save gains the predictions container.
const old = legacy.createWorld(60603);
legacy.simulateWeeks(old, 3);
const upgraded = upgradeWorld(JSON.parse(JSON.stringify(old)));
assert(upgraded.dataRevision >= 32);
assert(Array.isArray(upgraded.predictions.history));
report.migration = { dataRevision: upgraded.dataRevision };

console.log(JSON.stringify(report, null, 2));
console.log('Phase 6 regression passed');
