// Phase 5: derbies, varying home advantage, live records and milestones,
// mid-season sackings with a new-coach bounce, and transfer-deadline drama.
import assert from 'node:assert/strict';
import {
  createWorld, simulateToSeasonEnd, simulateWeeks, startNextSeason, upgradeWorld,
  getWorldRecords, getHomeAdvantage, isShowcaseSelectedMatch, getDerbyRecord
} from '../src/engine.js';
import * as legacy from './fixtures/legacy-r25/src/engine.js';

const report = {};

// Home advantage varies: neutral finals have none, derbies less, altitude more.
const world = createWorld(50501);
const clubs = world.clubs;
const base = getHomeAdvantage(world, { homeId: clubs[0].id, awayId: clubs[1].id, isInternational: false });
assert.equal(getHomeAdvantage(world, { homeId: clubs[0].id, awayId: clubs[1].id, neutral: true }), 0, 'neutral venues give no home edge');
const derbyEdge = getHomeAdvantage(world, { homeId: clubs[0].id, awayId: clubs[1].id, derby: true });
assert(derbyEdge < base, 'derbies shrink the home edge');
const bolivar = clubs.find((club) => club.id === 'bol-bolivar');
const lowland = clubs.find((club) => club.country === 'Brazil');
if (bolivar && lowland) {
  const altitude = getHomeAdvantage(world, { homeId: bolivar.id, awayId: lowland.id });
  const reverse = getHomeAdvantage(world, { homeId: lowland.id, awayId: bolivar.id });
  assert(altitude > reverse + 1, 'altitude venues add to the home edge');
  report.altitudeEdge = { laPaz: Number(altitude.toFixed(2)), lowland: Number(reverse.toFixed(2)) };
}
const sorted = clubs.filter((club) => club.fans).sort((a, b) => b.fans - a.fans);
const big = getHomeAdvantage(world, { homeId: sorted[0].id, awayId: sorted.at(-1).id });
const small = getHomeAdvantage(world, { homeId: sorted.at(-1).id, awayId: sorted[0].id });
assert(big > small, 'big fan bases give a bigger home edge');
report.homeEdge = { base: Number(base.toFixed(2)), derby: Number(derbyEdge.toFixed(2)), bigCrowd: Number(big.toFixed(2)), smallCrowd: Number(small.toFixed(2)) };

// Play three seasons, collecting derby and non-derby full matches.
const derby = { matches: 0, cards: 0, reds: 0, homeWins: 0 };
const normal = { matches: 0, cards: 0, reds: 0, homeWins: 0 };
const bounce = { before: 0, beforeGames: 0, after: 0, afterGames: 0 };
let sackings = 0, dramaStories = 0, derbyStories = 0, recordStories = 0;
const seasonRows = [];
for (let season = 0; season < 3; season += 1) {
  if (season) startNextSeason(world);
  dramaStories += world.current.news.filter((story) => story.category === 'Transfer Drama').length;
  // Week 52 closes the season and archives the match list, so read matches after week 51.
  simulateWeeks(world, 51);
  const played = [...world.current.matches];
  derbyStories += world.current.news.filter((story) => story.category === 'Derby').length;
  recordStories += world.current.news.filter((story) => story.category === 'Records').length;
  simulateWeeks(world, 1);
  for (const match of played) {
    if (match.light || match.isInternational || !match.cardEvents) continue;
    const bucket = match.derby ? derby : normal;
    bucket.matches += 1;
    bucket.cards += match.cardEvents.length;
    bucket.reds += match.cardEvents.filter((card) => card.type === 'red').length;
    if (match.homeGoals > match.awayGoals) bucket.homeWins += 1;
  }
  const moves = world.history.coachMoves.filter((move) => move.season === world.season && move.reason === 'sacked mid-season');
  sackings += moves.length;
  // New-coach bounce: points per game in the five league games before and after.
  for (const move of moves) {
    const games = played.filter((match) => world.current.leagues?.[match.competitionId] && (match.homeId === move.fromClubId || match.awayId === move.fromClubId));
    const points = (match) => {
      const own = match.homeId === move.fromClubId ? match.homeGoals : match.awayGoals;
      const other = match.homeId === move.fromClubId ? match.awayGoals : match.homeGoals;
      return own > other ? 3 : own === other ? 1 : 0;
    };
    for (const match of games.filter((row) => row.week <= move.week).slice(-5)) { bounce.before += points(match); bounce.beforeGames += 1; }
    for (const match of games.filter((row) => row.week > move.week).slice(0, 5)) { bounce.after += points(match); bounce.afterGames += 1; }
  }
  seasonRows.push({ season: world.season, sackings: moves.length });
}
const rate = (bucket) => ({
  matches: bucket.matches,
  cardsPerMatch: Number((bucket.cards / Math.max(1, bucket.matches)).toFixed(2)),
  redsPerMatch: Number((bucket.reds / Math.max(1, bucket.matches)).toFixed(3)),
  homeWinRate: Number((bucket.homeWins / Math.max(1, bucket.matches)).toFixed(3))
});
report.derbies = rate(derby);
report.nonDerbies = rate(normal);
assert(derby.matches >= 60, 'derbies are played every season');
assert(report.derbies.cardsPerMatch > report.nonDerbies.cardsPerMatch * 1.15, 'derbies are more heated');
// About 200 derbies are too few to measure a home-edge difference reliably (the
// mechanism is checked above with getHomeAdvantage); this is a sanity bound.
assert(report.derbies.homeWinRate < report.nonDerbies.homeWinRate + 0.05, 'derbies do not favour the home side more than other games');
assert(derbyStories >= 30, 'derbies make headlines');

// Mid-season sackings and the bounce.
report.sackings = { total: sackings, perSeason: seasonRows.map((row) => row.sackings) };
assert(sackings >= 45 && sackings <= 150, 'boards sack a few dozen coaches a season across the world');
report.bounce = {
  ppgBefore: Number((bounce.before / Math.max(1, bounce.beforeGames)).toFixed(2)),
  ppgAfter: Number((bounce.after / Math.max(1, bounce.afterGames)).toFixed(2))
};
assert(report.bounce.ppgAfter > report.bounce.ppgBefore, 'new coaches usually get a bounce');

// Transfer drama.
report.transferDrama = dramaStories;
assert(dramaStories >= 3, 'the summer window produces drama stories');

// Records and milestones.
const records = getWorldRecords(world);
report.records = {
  keys: Object.keys(records.allTime).sort(),
  biggestWin: records.allTime.biggestWin?.score,
  mostGoalsSeason: records.allTime.mostGoalsSeason?.goals,
  mostCareerGoals: records.allTime.mostCareerGoals?.goals,
  invincibles: records.invincibles.length,
  shootouts: records.shootouts?.total,
  stories: recordStories
};
for (const key of ['biggestWin', 'mostGoalsSeason', 'mostCareerGoals', 'mostCareerApps', 'recordTransfer']) assert(records.allTime[key], `${key} is tracked`);
assert(Object.keys(records.competitions).length >= 20, 'per-competition records are kept');
assert(world.players.some((player) => (player.careerGoals || 0) >= 50), 'career goal counters build up');

// Derby ledger: all-time head-to-head, the same from both sides.
const ledger = Object.values(world.records.derbies || {});
assert(ledger.length >= 20, 'derby ledger covers the historic rivalries');
const sample = ledger.sort((x, y) => y.meetings - x.meetings)[0];
const fromA = getDerbyRecord(world, sample.a, sample.b);
const fromB = getDerbyRecord(world, sample.b, sample.a);
assert.equal(fromA.wins, fromB.losses);
assert.equal(fromA.gf, fromB.ga);
assert(fromA.recent.length >= 1 && fromA.recent.length <= 6);
report.derbyLedger = { rivalries: ledger.length, busiest: sample.name, meetings: sample.meetings };

// Spoiler embargo: a Showcase-selected match never moves records until it is revealed.
const embargo = createWorld(50502);
embargo.showcasePreferences = { UCL: 'final' };
simulateToSeasonEnd(embargo);
const final = (embargo.current.archivedKnockoutMatches || []).concat(embargo.current.matches).find((match) => match.competitionId === 'UCL' && /^final$/i.test(match.stage || ''));
assert(final && isShowcaseSelectedMatch(embargo, final), 'the UCL final is a Showcase match');
assert((embargo.current.heldRecordMatches || []).includes(final.id), 'its records are held back');
const leaked = JSON.stringify(getWorldRecords(embargo)).includes(final.id);
assert(!leaked, 'held matches do not appear in live records');
assert(!JSON.stringify(embargo.records.derbies || {}).includes(final.id), 'held matches stay out of the derby ledger');
assert(!embargo.current.news.some((story) => story.category === 'Records' && story.matchId === final.id), 'no record story about an unrevealed Showcase match');

// Determinism.
const runA = createWorld(50503); simulateWeeks(runA, 20);
const runB = createWorld(50503); simulateWeeks(runB, 20);
assert.equal(JSON.stringify(runA.records), JSON.stringify(runB.records), 'records are deterministic');
assert.equal(JSON.stringify(runA.history.coachMoves), JSON.stringify(runB.history.coachMoves), 'sackings are deterministic');

// Migration: a revision-25 save gains records and keeps playing.
const old = legacy.createWorld(50504);
legacy.simulateToSeasonEnd(old);
legacy.startNextSeason(old);
const upgraded = upgradeWorld(JSON.parse(JSON.stringify(old)));
assert(upgraded.dataRevision >= 31);
assert(upgraded.records && upgraded.records.allTime, 'records exist after migration');
assert(upgraded.players.some((player) => (player.careerGoals || 0) > 0), 'career goals are rebuilt from history');
simulateWeeks(upgraded, 12);
report.migration = { dataRevision: upgraded.dataRevision, week: upgraded.current.week };

console.log(JSON.stringify(report, null, 2));
console.log('Phase 5 regression passed');
