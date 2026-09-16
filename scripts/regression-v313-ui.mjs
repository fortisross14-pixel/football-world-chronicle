import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd } from '../src/engine.js';

const seeded = createWorld(31301);
seeded.showcasePreferences = { UCL: 'semis' };
seeded.current.postseason.selections = { ...seeded.showcasePreferences };
simulateToSeasonEnd(seeded);
const ucl = seeded.current.postseason.showcaseMatches.filter((row) => row.competitionId === 'UCL');
assert.equal(ucl.length, 5);
const leg1 = ucl.find((row) => /Leg 1/i.test(row.stage));
const champion = seeded.history.champions.find((row) => row.season === seeded.season && row.competitionId === 'UCL');
assert(leg1 && champion);
const clubName = (id) => seeded.clubs.find((club) => club.id === id)?.name || id;
const championName = clubName(champion.winnerId);

const handlers = {};
class FakeClassList { add() {} remove() {} toggle() {} contains() { return false; } }
const app = { innerHTML: '' };
globalThis.document = {
  body: { classList: new FakeClassList() },
  addEventListener(type, cb) { handlers[`document:${type}`] = cb; },
  getElementById(id) { return id === 'app' ? app : null; },
  querySelectorAll() { return []; }
};
globalThis.window = {
  addEventListener(type, cb) { handlers[`window:${type}`] = cb; },
  scrollTo() {},
  location: { hash: `#/competition/UCL/weekly/${leg1.week}` },
  prompt() { return null; },
  confirm() { return false; }
};
globalThis.location = globalThis.window.location;
globalThis.localStorage = {
  getItem(key) { return JSON.stringify(seeded); },
  setItem() {}, removeItem() {}
};
globalThis.performance = { now: () => 0 };

await import('../src/app.js');
const domReady = handlers['window:DOMContentLoaded'];
assert(domReady);
await domReady();
assert(app.innerHTML.includes('SHOWCASE PENDING') || app.innerHTML.includes('SHOWCASE EMBARGO'));
const scoreNeedle = `>${leg1.finalScore.home}-${leg1.finalScore.away}<`;
assert(!app.innerHTML.includes(scoreNeedle), 'hidden semifinal score leaked into weekly view');

const hashchange = handlers['window:hashchange'];
window.location.hash = '#/competition/UCL/history';
hashchange();
assert(app.innerHTML.includes('Champions and positional awards'));
// A followed club may legitimately appear in the sidebar even when it happens
// to be the hidden champion. Inspect the result table itself.
const historyTable = app.innerHTML.match(/<table class="data-table history-table">[\s\S]*?<\/table>/)?.[0];
assert(historyTable, 'competition history table must render');
assert(!historyTable.includes(`>${championName}<`), 'current UCL champion leaked into history before showcase final');

window.location.hash = '#/competition/UCL/current';
hashchange();
assert(app.innerHTML.includes('SHOWCASE EMBARGO'));
assert(!app.innerHTML.includes('FINAL RESULT'), 'completed-final card leaked before showcase resolution');

console.log(JSON.stringify({
  weeklyHidden: true,
  historyHidden: true,
  currentSeasonHidden: true,
  championEmbargoed: championName
}, null, 2));
