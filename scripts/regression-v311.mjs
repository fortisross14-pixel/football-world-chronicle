import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, simulateToSeasonEnd, startNextSeason, upgradeWorld } from '../src/engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const app = fs.readFileSync(path.join(root,'src','app.js'),'utf8');
const css = fs.readFileSync(path.join(root,'styles.css'),'utf8');
assert.equal(pkg.version,'3.11.0');
assert(app.includes("const APP_VERSION = '3.11'"));
assert(app.includes('runPostseasonContinuousMatch'));
assert(app.includes('Continue Second Half'));
assert(app.includes('Continue to Extra Time'));
assert(css.includes('v3.11 continuous postseason match reveal'));

const state = createWorld(31101);
state.current.postseason.selections = { UCL:'semis', LIB:'final', WC:'semis' };
simulateToSeasonEnd(state);
assert.equal(state.current.completed,true);
assert.equal(state.current.postseason.prepared,true);
assert.equal(state.current.postseason.showcaseMatches.length,7);

for (const match of state.current.postseason.showcaseMatches) {
  assert(Array.isArray(match.liveTimeline) && match.liveTimeline.length >= 91, 'continuous timeline missing');
  assert.equal(match.liveTimeline[0].minute,0);
  for (let i = 1; i < match.liveTimeline.length; i += 1) {
    assert.equal(match.liveTimeline[i].minute, match.liveTimeline[i-1].minute + 1, 'timeline must advance one minute at a time');
    assert(match.liveTimeline[i].home.shots >= match.liveTimeline[i-1].home.shots, 'home shots cannot decrease');
    assert(match.liveTimeline[i].away.shots >= match.liveTimeline[i-1].away.shots, 'away shots cannot decrease');
    assert(match.liveTimeline[i].home.onTarget >= match.liveTimeline[i-1].home.onTarget, 'home on-target cannot decrease');
    assert(match.liveTimeline[i].away.onTarget >= match.liveTimeline[i-1].away.onTarget, 'away on-target cannot decrease');
  }
  const final = match.liveTimeline.at(-1);
  assert.equal(final.homeGoals,match.finalScore.home);
  assert.equal(final.awayGoals,match.finalScore.away);
  assert.deepEqual(final.home,match.finalStats.home);
  assert.deepEqual(final.away,match.finalStats.away);
  assert(match.liveTimeline.some((row)=>row.minute===45), 'half-time frame missing');
  assert(match.liveTimeline.some((row)=>row.minute===90), '90-minute frame missing');
  if (match.extraTime || match.penalties) {
    assert.equal(match.liveTimeline.at(-1).minute,120,'extra-time matches should reach 120 minutes');
    assert(match.liveTimeline.some((row)=>row.minute===105),'extra-time interval missing');
  } else {
    assert.equal(match.liveTimeline.at(-1).minute,90,'normal match should end at 90 minutes');
  }
  if (match.penalties) {
    assert(Array.isArray(match.penaltySequence) && match.penaltySequence.length >= 10,'penalty sequence missing');
    const lastKick = match.penaltySequence.at(-1);
    assert.equal(lastKick.home,match.penalties.home);
    assert.equal(lastKick.away,match.penalties.away);
  }
}

// Compatibility: a v3.10-style prepared postseason gets its continuous timeline on upgrade.
const legacy = structuredClone(state);
legacy.dataRevision = 20;
for (const match of legacy.current.postseason.showcaseMatches) {
  delete match.liveTimeline;
  delete match.penaltySequence;
  delete match.liveProgress;
}
upgradeWorld(legacy);
assert.equal(legacy.dataRevision,21);
assert(legacy.current.postseason.showcaseMatches.every((match)=>Array.isArray(match.liveTimeline) && match.liveTimeline.length >= 91));
assert(legacy.current.postseason.showcaseMatches.every((match)=>match.liveProgress));

// Default setup remains optional and awards still work when no matches are selected.
const clean = createWorld(31102);
simulateToSeasonEnd(clean);
assert.equal(clean.current.postseason.showcaseMatches.length,0);
assert.equal(clean.current.postseason.phase,'awards');
clean.current.postseason.completed = true;
const completedSeason = clean.season;
startNextSeason(clean);
assert(clean.history.postseasons.some((row)=>row.season===completedSeason));

console.log(JSON.stringify({
  version: pkg.version,
  showcaseGames: state.current.postseason.showcaseMatches.length,
  continuous: true,
  upgradedLegacy: true
},null,2));
