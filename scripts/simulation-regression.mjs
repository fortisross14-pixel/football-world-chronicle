import assert from 'node:assert/strict';
import { createWorld, simulateWeeks, simulateToSeasonEnd, startNextSeason, upgradeWorld } from '../src/engine.js';
import { isEstablishedDestination } from '../src/transfer-policy.js';

const state = createWorld(31402);
state.showcasePreferences = { UCL: 'semis', LIB: 'final' };
state.current.postseason.selections = { ...state.showcasePreferences };
simulateWeeks(state, 8);
assert(state.current.matches.length > 100);
const continued = structuredClone(state);
simulateWeeks(state, 1);
simulateWeeks(continued, 1);
assert.equal(state.rngSeed, continued.rngSeed, 'save/load continuation must be deterministic');
assert.deepEqual(state.current.matches.slice(-100), continued.current.matches.slice(-100));
console.log(JSON.stringify({ matches: state.current.matches.length,
  averageGoals: state.current.matches.reduce((sum, match) => sum + match.homeGoals + match.awayGoals, 0) / state.current.matches.length }));
for (const match of state.current.matches) {
  assert.equal(match.stats.home.possession + match.stats.away.possession, 100);
  for (const side of ['home', 'away']) {
    const stats = match.stats[side];
    assert(stats.shots >= stats.onTarget && stats.onTarget >= match[`${side}Goals`]);
    assert.equal(match.cardEvents.filter((e) => e.side === side && e.type === 'red').length, stats.red);
  }
}
const initialMatch = structuredClone(state.current.matches[0]);
// Old saves recover the actual most recent arrival, without changing old scores.
const legacyPlayer = state.players.find((p) => p.status === 'active' && p.clubId);
state.history.transfers.push({ playerId: legacyPlayer.id, fromClubId: null, toClubId: legacyPlayer.clubId, season: state.season - 1 });
delete legacyPlayer.joinedClubSeason;
delete legacyPlayer.commitmentClubId;
delete legacyPlayer.lastTransferSeason;
state.dataRevision = 22;
upgradeWorld(state);
assert.equal(legacyPlayer.joinedClubSeason, state.season - 1);
assert.equal(state.dataRevision, 23);
assert.deepEqual(state.current.matches[0], initialMatch);
state.history.transfers.pop();

let checkedMoves = 0, showcaseMatches = 0, protectedSignings = 0;
for (let year = 0; year < 4; year += 1) {
  simulateToSeasonEnd(state);
  for (const league of Object.values(state.current.leagues).filter((item) => item.tier === 'summary')) {
    for (const row of league.table) assert(row.cleanSheets >= 0 && row.cleanSheets <= row.played);
  }
  const originals = new Map(state.current.archivedKnockoutMatches.map((match) => [match.id, match]));
  for (const match of state.current.postseason.showcaseMatches) {
    const source = originals.get(match.matchId);
    assert(source);
    assert.deepEqual(match.finalStats, source.stats);
    const last = match.liveTimeline.at(-1);
    for (const side of ['home', 'away']) {
      assert.equal(last[`${side}Goals`], match.finalScore[side]);
      for (const key of ['shots', 'onTarget', 'corners', 'yellow', 'red']) assert.equal(last[side][key], match.finalStats[side][key]);
    }
    showcaseMatches += 1;
  }
  const before = new Map(state.players.filter((p) => p.clubId).map((p) => [p.id, {
    clubId: p.clubId, joined: p.joinedClubSeason, top: isEstablishedDestination(state.clubs.find((c) => c.id === p.clubId))
  }]));
  state.current.postseason.completed = true;
  startNextSeason(state);
  const seen = new Set();
  for (const transfer of state.current.transfers) {
    assert(!seen.has(transfer.playerId), 'a player cannot transfer twice in one window');
    seen.add(transfer.playerId);
    const prior = before.get(transfer.playerId);
    if (prior?.top) assert(state.season - prior.joined >= 2, `new top-club signing sold after just one season: ${JSON.stringify({ transfer, prior })}`);
    const player = state.players.find((p) => p.id === transfer.playerId);
    assert.equal(player.lastTransferSeason, state.season);
    assert.equal(player.joinedClubSeason, state.season);
    checkedMoves += 1;
  }
  protectedSignings += [...before.values()].filter((p) => p.top && state.season - p.joined < 2).length;
  console.log(JSON.stringify({ season: state.season, transfers: state.current.transfers.length, showcaseMatches }));
}
assert(checkedMoves > 20, 'market must remain active');
assert(showcaseMatches >= 20);
assert(protectedSignings > 0);
console.log(JSON.stringify({ seasons: 4, checkedMoves, showcaseMatches, protectedSignings, passed: true }));
