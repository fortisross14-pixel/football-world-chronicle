import assert from 'node:assert/strict';
import { createWorld, simulateWeeks, simulateToSeasonEnd, upgradeWorld } from '../src/engine.js';

const state = createWorld(31402);
state.showcasePreferences = { UCL: 'semis', LIB: 'final' };
state.current.postseason.selections = { ...state.showcasePreferences };
simulateWeeks(state, 8);
const restored = upgradeWorld(JSON.parse(JSON.stringify(state)));
simulateWeeks(state, 1);
simulateWeeks(restored, 1);
assert.equal(state.rngSeed, restored.rngSeed, 'Save/load continuation must be deterministic');
assert.deepEqual(state.current.matches.slice(-100), restored.current.matches.slice(-100));
assert(state.current.matches.length > 100);
for (const match of state.current.matches) {
  assert.equal(match.stats.home.possession + match.stats.away.possession, 100);
  for (const side of ['home', 'away']) {
    const stats = match.stats[side];
    assert(stats.shots >= stats.onTarget && stats.onTarget >= match[`${side}Goals`]);
    for (const type of ['yellow', 'red']) {
      assert.equal(match.cardEvents.filter((event) => event.side === side && event.type === type).length, stats[type]);
    }
  }
}
const checkedMatches = state.current.matches.length;
simulateToSeasonEnd(state);
for (const stat of state.current.archivedPlayerStats) assert(stat.cleanSheets <= stat.apps);
for (const league of Object.values(state.current.leagues).filter((item) => item.tier === 'summary')) {
  for (const row of league.table) assert(row.cleanSheets >= 0 && row.cleanSheets <= row.played);
}
const originals = new Map(state.current.archivedKnockoutMatches.map((match) => [match.id, match]));
const showcase = state.current.postseason.showcaseMatches;
assert.equal(showcase.length, 6);
for (const match of showcase) {
  assert.deepEqual(match.finalStats, originals.get(match.matchId).stats);
  let previous = match.liveTimeline[0];
  for (const tick of match.liveTimeline) {
    for (const side of ['home', 'away']) {
      assert(tick[side].shots >= tick[side].onTarget);
      assert(tick[side].onTarget >= tick[`${side}Goals`]);
      for (const key of ['shots', 'onTarget', 'corners', 'yellow', 'red']) assert(tick[side][key] >= previous[side][key]);
    }
    previous = tick;
  }
  const last = match.liveTimeline.at(-1);
  for (const side of ['home', 'away']) {
    assert.equal(last[`${side}Goals`], match.finalScore[side]);
    for (const key of ['shots', 'onTarget', 'corners', 'yellow', 'red']) assert.equal(last[side][key], match.finalStats[side][key]);
  }
}
// Already-prepared showcases must survive loading without rewriting the result.
const loaded = upgradeWorld(JSON.parse(JSON.stringify(state)));
assert.deepEqual(loaded.current.postseason.showcaseMatches, showcase);
console.log(JSON.stringify({ checkedMatches, showcaseMatches: showcase.length, deterministicResume: true, passed: true }, null, 2));
