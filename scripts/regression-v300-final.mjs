import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd } from '../src/engine.js';

const world = createWorld(7262001);
simulateToSeasonEnd(world);
const club = world.clubs.find((row) => row.division === 1) || world.clubs[0];
const cupId = `CUP-${club.leagueId}`;
const cup = world.current.domesticCups[cupId];
assert(cup?.championId, 'domestic cup should be complete at season end');

const handlers = {};
class FakeClassList { add(){} remove(){} toggle(){} contains(){ return false; } }
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
  location: { hash: `#/competition/${cupId}/current` },
  prompt() { return null; },
  confirm() { return false; }
};
globalThis.location = globalThis.window.location;
globalThis.localStorage = {
  getItem(key) { return key === 'football-world-chronicle-v4' ? JSON.stringify(world) : null; },
  setItem() {},
  removeItem() {}
};
globalThis.performance = { now: () => 0 };

await import('../src/app.js');
await handlers['window:DOMContentLoaded']();
assert(app.innerHTML.includes('FINAL RESULT'), 'completed knockout current-season view should show the final result');
assert(!app.innerHTML.includes('Next games'), 'completed knockout current-season view should not show future fixtures');
assert(!app.innerHTML.includes('KNOCKOUT PATH'), 'completed knockout current-season view should be final-only');
console.log(JSON.stringify({ completedKnockoutFinalOnly: true, competition: cupId }, null, 2));
