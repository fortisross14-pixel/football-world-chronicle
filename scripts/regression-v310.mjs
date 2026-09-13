import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, simulateToSeasonEnd, startNextSeason } from '../src/engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const app = fs.readFileSync(path.join(root,'src','app.js'),'utf8');
const css = fs.readFileSync(path.join(root,'styles.css'),'utf8');
assert.equal(pkg.version,'3.10.0');
assert(app.includes("const APP_VERSION = '3.10'"));
assert(app.includes('postseasonMatchModal'));
assert(css.includes('v3.10 Postseason Showcase'));

const state = createWorld(31001);
state.current.postseason.selections = { UCL:'semis', LIB:'final', WC:'semis' };
simulateToSeasonEnd(state);
assert.equal(state.current.completed,true);
assert.equal(state.current.postseason.prepared,true);
assert.equal(state.current.postseason.phase,'games');
const ucl = state.current.postseason.showcaseMatches.filter((match)=>match.competitionId==='UCL');
const lib = state.current.postseason.showcaseMatches.filter((match)=>match.competitionId==='LIB');
const wc = state.current.postseason.showcaseMatches.filter((match)=>match.competitionId==='WC');
assert.equal(ucl.length,3,'UCL Semis + Final should create three showcase games');
assert.equal(lib.length,1,'Libertadores Final should create one showcase game');
assert.equal(wc.length,3,'World Cup Semis + Final should create three showcase games');
assert.equal(state.current.postseason.showcaseMatches.length,7,'Example showcase selection should create seven games');
for (const match of [...ucl,...lib,...wc]) {
  assert(match.ticks.length >= 7,'showcase match should contain 15-minute ticks');
  assert.equal(match.ticks[0].minute,0);
  const finalTick = match.ticks[match.ticks.length - 1];
  assert.equal(finalTick.homeGoals, match.finalScore.home);
  assert.equal(finalTick.awayGoals, match.finalScore.away);
  assert.equal(match.ticks[0].home.shots,0);
  assert(finalTick.home.shots >= match.finalScore.home);
  assert(finalTick.away.shots >= match.finalScore.away);
}
assert.equal(state.current.postseason.awards.at(-1)?.title,"Ballon d'Or");
assert(state.current.postseason.awards.every((award)=>award.podium.length >= 1));

// Default match selection stays empty, but the awards ceremony is still prepared.
const clean = createWorld(31002);
simulateToSeasonEnd(clean);
assert.equal(clean.current.postseason.showcaseMatches.length,0);
assert.equal(clean.current.postseason.phase,'awards');
assert(clean.current.postseason.awards.length >= 6);

// Postseason archive survives the transition into the next season.
clean.current.postseason.completed = true;
const completedSeason = clean.season;
startNextSeason(clean);
assert(clean.history.postseasons.some((row)=>row.season===completedSeason));
console.log(JSON.stringify({ version:pkg.version, showcaseGames:state.current.postseason.showcaseMatches.length, awards:state.current.postseason.awards.length, archived:true },null,2));
