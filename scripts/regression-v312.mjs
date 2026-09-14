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
assert.equal(pkg.version,'3.12.0');
assert(app.includes("const APP_VERSION = '3.12'"));
assert(app.includes('select-postseason-award'));
assert(app.includes('advance-postseason-award'));
assert(app.includes('postseasonGoalTheme'));
assert(app.includes('Awaiting semi-final winner'));
assert(css.includes('v3.12 postseason suspense + awards navigation'));

// Full showcase example: two-leg UCL semis now means four semifinal legs + final.
const state = createWorld(31201);
state.showcasePreferences = { UCL:'semis', LIB:'final', WC:'semis' };
state.current.postseason.selections = { ...state.showcasePreferences };
simulateToSeasonEnd(state);
assert.equal(state.current.completed,true);
assert.equal(state.current.postseason.prepared,true);
const ucl = state.current.postseason.showcaseMatches.filter((match)=>match.competitionId==='UCL');
const lib = state.current.postseason.showcaseMatches.filter((match)=>match.competitionId==='LIB');
const wc = state.current.postseason.showcaseMatches.filter((match)=>match.competitionId==='WC');
assert.equal(ucl.length,5,'UCL Semis + Final should include both legs of both semifinals plus final');
assert.equal(lib.length,1,'Libertadores final selection should remain one match');
assert.equal(wc.length,3,'World Cup one-leg semis + final should remain three matches');
assert.equal(state.current.postseason.showcaseMatches.length,9);
assert.equal(ucl.filter((match)=>/Leg 1/i.test(match.stage)).length,2);
assert.equal(ucl.filter((match)=>/Leg 2/i.test(match.stage)).length,2);
assert.equal(ucl.filter((match)=>/^Final$/i.test(match.stage)).length,1);
for (const leg2 of ucl.filter((match)=>/Leg 2/i.test(match.stage))) {
  assert.equal(leg2.aggregate?.leg,2,'second leg should carry aggregate context');
  assert(Number.isFinite(leg2.aggregate.homeBefore));
  assert(Number.isFinite(leg2.aggregate.awayBefore));
  assert.equal(leg2.aggregate.homeFinal, leg2.aggregate.homeBefore + leg2.finalScore.home);
  assert.equal(leg2.aggregate.awayFinal, leg2.aggregate.awayBefore + leg2.finalScore.away);
}
for (const match of state.current.postseason.showcaseMatches) {
  assert(Array.isArray(match.liveTimeline) && match.liveTimeline.length >= 91);
  assert.equal(match.liveTimeline[0].minute,0);
}

// Persistent future showcase preferences survive into a new season.
const future = createWorld(31202);
future.showcasePreferences = { EURO:'semis' };
future.current.postseason.selections = { ...future.showcasePreferences };
simulateToSeasonEnd(future);
assert.equal(future.current.postseason.showcaseMatches.filter((m)=>m.competitionId==='EURO').length,0,'EURO should not be fabricated in a non-EURO season');
future.current.postseason.completed = true;
startNextSeason(future);
assert.equal(future.current.postseason.selections.EURO,'semis','future showcase selection must persist across seasons');
assert.equal(future.showcasePreferences.EURO,'semis');

// Upgrade preserves old current selections as global persistent preferences.
const legacy = createWorld(31203);
legacy.dataRevision = 21;
legacy.current.postseason.selections = { AFCON:'final' };
delete legacy.showcasePreferences;
upgradeWorld(legacy);
assert.equal(legacy.dataRevision,22);
assert.equal(legacy.showcasePreferences.AFCON,'final');
assert.equal(legacy.current.postseason.awardActiveIndex,0);

console.log(JSON.stringify({
  version: pkg.version,
  totalShowcase: state.current.postseason.showcaseMatches.length,
  uclShowcase: ucl.length,
  twoLegAggregate: true,
  futureSelectionsPersist: true,
  awardsNavigation: true,
  teamGoalThemes: true
},null,2));
