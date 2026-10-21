// Phase 2: minute-by-minute matches, substitutions, extra time, shootouts, tactical
// matchups, event-based ratings and the Showcase replaying the real timeline.
import assert from 'node:assert/strict';
import {
  createWorld, simulateWeeks, simulateToSeasonEnd, upgradeWorld, getShootoutRecord, getShootoutLeaders
} from '../src/engine.js';
import { playMatch, gameStateFactors, STYLE_PROFILES, STYLE_BEATS, styleMatchup } from '../src/match-engine.js';
import * as legacy from './fixtures/legacy-r25/src/engine.js';

const report = {};

// --- Engine rules in isolation ------------------------------------------------------
const neutralTeam = { style: STYLE_PROFILES.pragmatist };
const [leadOwn, leadAgainst] = gameStateFactors(neutralTeam, 1, 85, 1);
assert(leadOwn < 1 && leadAgainst < 1, 'a side leading late protects its lead: fewer chances both ways');
const [chaseOwn, chaseAgainst] = gameStateFactors(neutralTeam, -1, 85, 1);
assert(chaseOwn > 1 && chaseAgainst > 1, 'a side trailing late pushes: more chances both ways');
assert.deepEqual(gameStateFactors(neutralTeam, 1, 20, 1), [1, 1], 'early leads change nothing');

let seed = 20260;
const rng = () => { seed = (Math.imul(1664525, seed >>> 0) + 1013904223) >>> 0; return seed / 4294967296; };
const goalBase = { GK: 0.08, DF: 1.1, MF: 4, FW: 9 }, assistBase = { GK: 0.15, DF: 2.1, MF: 8, FW: 5.2 };
const lines = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'];
const team = (id, rating, style, lambda) => ({
  teamId: id, style, lambda,
  xi: lines.map((line, i) => ({ id: `${id}-${i}`, line, slotType: line === 'GK' ? 'GK' : line === 'DF' ? 'CB' : line === 'MF' ? 'CM' : 'ST', rating, effective: rating, goalW: goalBase[line], assistW: assistBase[line], penalty: rating })),
  bench: ['GK', 'DF', 'MF', 'FW'].map((line, i) => ({ id: `${id}-b${i}`, line, rating: rating - 3, effective: rating - 3, goalW: goalBase[line], assistW: assistBase[line], penalty: rating }))
});
const totals = { redFor: 0, redAgainst: 0, redMinutes: 0, subGoals: 0, ko: 0, et: 0, pens: 0, matches: 0 };
for (let index = 0; index < 6000; index += 1) {
  const knockout = index % 3 === 0;
  const result = playMatch({ home: team('h', 74, 'pressing', 1.4), away: team('a', 74, 'possession', 1.2), knockout, detail: knockout }, rng);
  totals.matches += 1;
  assert(result.stats.home.shots >= result.stats.home.onTarget && result.stats.home.onTarget >= result.homeGoals);
  for (const side of ['home', 'away']) {
    assert.equal(result.cards.filter((card) => card.side === side && card.type === 'yellow').length, result.stats[side].yellow);
    assert.equal(result.cards.filter((card) => card.side === side && card.type === 'red').length, result.stats[side].red);
    assert(result.subs.filter((sub) => sub.side === side).length <= 4, 'four substitutes at most');
  }
  const benchIds = new Set(result.subs.map((sub) => sub.inId));
  totals.subGoals += result.goals.filter((goal) => benchIds.has(goal.scorerId)).length;
  // A red card changes the rest of the match from that minute.
  const red = result.cards.find((card) => card.type === 'red');
  if (red) {
    const after = result.goals.filter((goal) => goal.minute > red.minute);
    totals.redFor += after.filter((goal) => goal.side === red.side).length;
    totals.redAgainst += after.filter((goal) => goal.side !== red.side).length;
    totals.redMinutes += 90 - red.minute;
  }
  if (knockout) {
    totals.ko += 1;
    if (result.extraTime) {
      totals.et += 1;
      assert(result.goals.every((goal) => goal.minute <= 120));
    }
    if (result.penalties) {
      totals.pens += 1;
      assert(result.extraTime, 'penalties only after extra time');
      assert.equal(result.homeGoals, result.awayGoals, 'shootouts only from a level score');
      assert.notEqual(result.penalties.home, result.penalties.away);
      const last = result.shootout.at(-1);
      assert.deepEqual([last.home, last.away], [result.penalties.home, result.penalties.away]);
      result.shootout.forEach((kick, kickIndex) => { if (kickIndex > 0) assert.notEqual(kick.side, result.shootout[kickIndex - 1].side, 'kicks alternate'); });
    }
    assert(result.winnerSide, 'knockouts always produce a winner');
  }
  const named = result.players.filter((row) => row.id);
  const best = Math.max(...named.map((row) => row.rating));
  const motm = named.find((row) => row.id === result.manOfMatchId);
  assert(motm && motm.rating >= best - 0.5, 'Man of the Match comes from the match ratings');
}
assert(totals.redAgainst > totals.redFor * 1.3, `ten men concede more than they score after a red (${totals.redAgainst} vs ${totals.redFor})`);
assert(totals.subGoals > 100, 'substitutes score');
assert(totals.et / totals.ko > 0.12 && totals.et / totals.ko < 0.35, 'extra time is played, not rolled');
assert(totals.pens / totals.et > 0.35 && totals.pens / totals.et < 0.75);
report.engine = { matches: totals.matches, goalsAfterRedFor: totals.redFor, goalsAfterRedAgainst: totals.redAgainst, substituteGoals: totals.subGoals, extraTimeRate: Number((totals.et / totals.ko).toFixed(3)), penaltiesAfterExtraTime: Number((totals.pens / totals.et).toFixed(3)) };

// Tactical matchups: no style dominates equal opposition.
const styles = Object.keys(STYLE_PROFILES);
const points = Object.fromEntries(styles.map((style) => [style, { points: 0, games: 0 }]));
for (const own of styles) for (const other of styles) {
  if (own === other) continue;
  for (let index = 0; index < 160; index += 1) {
    const result = playMatch({ home: team('h', 75, own, 1.3), away: team('a', 75, other, 1.3) }, rng);
    const home = result.homeGoals > result.awayGoals ? 3 : result.homeGoals === result.awayGoals ? 1 : 0;
    points[own].points += home; points[own].games += 1;
    points[other].points += home === 3 ? 0 : home === 1 ? 1 : 3; points[other].games += 1;
  }
}
const ppg = Object.fromEntries(Object.entries(points).map(([style, row]) => [style, Number((row.points / row.games).toFixed(3))]));
assert(Math.max(...Object.values(ppg)) - Math.min(...Object.values(ppg)) < 0.15, `styles stay balanced overall ${JSON.stringify(ppg)}`);
// …but matchups matter: every core style beats two and loses to two.
assert(styleMatchup('defensive_rock', 'possession') > 1 && styleMatchup('possession', 'defensive_rock') < 1, 'a defensive rock frustrates possession');
assert(styleMatchup('pressing', 'possession') > 1 && styleMatchup('possession', 'pressing') < 1, 'pressing beats possession');
for (const [style, beaten] of Object.entries(STYLE_BEATS)) {
  assert.equal(beaten.length, 2);
  const losses = Object.keys(STYLE_BEATS).filter((other) => STYLE_BEATS[other].includes(style));
  assert.equal(losses.length, 2, `${style} loses to exactly two styles`);
}
let swing = 0;
for (let index = 0; index < 1500; index += 1) {
  const a = playMatch({ home: team('h', 75, 'pressing', 1.3), away: team('a', 75, 'possession', 1.3) }, rng);
  const b = playMatch({ home: team('h', 75, 'possession', 1.3), away: team('a', 75, 'pressing', 1.3) }, rng);
  swing += (a.homeGoals > a.awayGoals ? 3 : a.homeGoals === a.awayGoals ? 1 : 0) + (b.awayGoals > b.homeGoals ? 3 : b.awayGoals === b.homeGoals ? 1 : 0);
}
report.pressingVsPossessionPointsPerGame = Number((swing / 3000).toFixed(3));
assert(report.pressingVsPossessionPointsPerGame > 1.45, 'the matchup shows up in results');
report.stylePointsPerGame = ppg;

// --- A real season -------------------------------------------------------------------
const world = createWorld(20261);
world.showcasePreferences = { UCL: 'semis', 'CUP-ENG1': 'final' };
world.current.postseason.selections = { ...world.showcasePreferences };
simulateWeeks(world, 10);
const restored = upgradeWorld(JSON.parse(JSON.stringify(world)));
simulateWeeks(world, 2);
simulateWeeks(restored, 2);
assert.equal(world.rngSeed, restored.rngSeed, 'save/load continuation is deterministic');
assert.deepEqual(world.current.matches.slice(-60), restored.current.matches.slice(-60));
simulateWeeks(world, 39);
const matches = world.current.matches;
const players = new Map(world.players.map((player) => [player.id, player]));
let substituteGoals = 0;
const lightMatches = matches.filter((match) => match.light);
for (const match of lightMatches) {
  assert(/^(CUP-)?[A-Z]{3}1$/.test(match.competitionId), 'only domestic leagues and cups are played light');
  assert(!['ENG1', 'ESP1', 'ITA1', 'GER1', 'FRA1', 'POR1', 'NED1', 'BRA1', 'ARG1'].includes(match.competitionId), 'main leagues keep the full engine');
  assert.equal(match.goalEvents.length, match.homeGoals + match.awayGoals);
}
for (const match of matches.filter((item) => !item.light)) {
  assert.equal(match.engine, 2);
  assert.equal(match.goalEvents.filter((goal) => goal.side === 'home').length, match.homeGoals);
  assert.equal(match.goalEvents.filter((goal) => goal.side === 'away').length, match.awayGoals);
  for (const goal of match.goalEvents) assert(goal.minute >= 1 && goal.minute <= 120);
  const inIds = new Set((match.subs || []).filter((sub) => sub.inId).map((sub) => `${sub.side}:${sub.inId}`));
  substituteGoals += match.goalEvents.filter((goal) => inIds.has(`${goal.side}:${goal.scorerId}`)).length;
  if (!match.isInternational) {
    for (const goal of match.goalEvents) {
      if (goal.scorerId) assert.equal(players.get(goal.scorerId)?.clubId, goal.teamId, 'scorers play for the scoring club');
    }
  }
  for (const card of match.cardEvents) assert(card.playerId === null || players.has(card.playerId));
  assert(Array.isArray(match.odds) && Math.abs(match.odds[0] + match.odds[1] + match.odds[2] - 1) < 0.01);
  if (match.aggregate && match.tieWinnerId) {
    const homeTotal = match.aggregate.home, awayTotal = match.aggregate.away;
    if (!match.penalties && homeTotal !== awayTotal) assert.equal(match.tieWinnerId, homeTotal > awayTotal ? match.homeId : match.awayId);
    if (match.penalties) assert.equal(homeTotal, awayTotal, 'two-legged ties reach penalties only when level on aggregate');
  }
}
assert(substituteGoals > 50, 'substitutes score in real matches');
// Light cup ties settle a level game without kick detail, so only full-engine shootouts are archived.
const shootoutMatches = matches.filter((match) => match.penalties && !match.light).length;
assert.equal(world.history.shootouts.length, shootoutMatches, 'every shootout is archived');
const leaders = getShootoutLeaders(world, 5);
assert(leaders.total <= shootoutMatches);
if (leaders.takers[0]) {
  const record = getShootoutRecord(world, leaders.takers[0].id, 'player');
  assert.equal(record.scored, leaders.takers[0].scored);
}
report.season = { matches: matches.length, lightMatches: lightMatches.length, substituteGoals, shootouts: shootoutMatches };

// Showcase replays the real timeline.
simulateToSeasonEnd(world);
const showcase = world.current.postseason.showcaseMatches;
assert(showcase.length >= 1);
const originals = new Map(world.current.archivedKnockoutMatches.map((match) => [match.id, match]));
for (const item of showcase) {
  const original = originals.get(item.matchId);
  assert.equal(item.engine, 2);
  const last = item.liveTimeline.at(-1);
  assert.deepEqual([last.homeGoals, last.awayGoals], [original.homeGoals, original.awayGoals]);
  for (const key of ['shots', 'onTarget', 'corners', 'yellow', 'red']) {
    for (const side of ['home', 'away']) assert.equal(last[side][key], original.stats[side][key], `${key} replayed exactly`);
  }
  // Each frame shows exactly the goals scored by that minute in the real match.
  for (const frame of item.liveTimeline.filter((_, index) => index % 15 === 0)) {
    const homeSoFar = original.goalEvents.filter((goal) => goal.side === 'home' && goal.minute <= frame.minute).length;
    if (frame.minute < item.liveTimeline.length - 1) assert.equal(frame.homeGoals, homeSoFar);
  }
  if (original.shootout) assert.equal(item.penaltySequence.length, original.shootout.length);
  assert(item.lineups?.home?.xi?.length === 11);
}
const reloaded = upgradeWorld(JSON.parse(JSON.stringify(world)));
assert.deepEqual(reloaded.current.postseason.showcaseMatches, showcase, 'prepared showcases survive loading');
report.showcase = { matches: showcase.length, extraTime: showcase.filter((item) => item.extraTime).length };

// --- Old saved matches keep displaying ------------------------------------------------
const old = legacy.createWorld(20262);
old.showcasePreferences = { UCL: 'final' };
old.current.postseason.selections = { UCL: 'final' };
legacy.simulateToSeasonEnd(old);
const oldShowcase = JSON.parse(JSON.stringify(old.current.postseason.showcaseMatches));
const upgraded = upgradeWorld(JSON.parse(JSON.stringify(old)));
assert.deepEqual(upgraded.current.postseason.showcaseMatches, oldShowcase, 'legacy showcases are untouched');
assert(upgraded.dataRevision >= 27 && Array.isArray(upgraded.history.shootouts));
const midSeason = legacy.createWorld(20263);
legacy.simulateWeeks(midSeason, 25);
const resumed = upgradeWorld(JSON.parse(JSON.stringify(midSeason)));
simulateToSeasonEnd(resumed);
assert(resumed.current.completed, 'a legacy save mid-season finishes on the new engine');
report.legacy = { showcaseKept: oldShowcase.length, resumedCompleted: true };

console.log(JSON.stringify({ ...report, passed: true }, null, 2));
