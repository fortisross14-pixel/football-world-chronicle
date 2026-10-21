// v4 UI markers, rendered through the real app with a fake DOM (same harness as
// runtime-ui-smoke). The app loads a world that has just finished its season, so
// Showcase screens can be opened too. Each phase adds the screens it touched.
import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd } from '../src/engine.js';
import { SAVE_KEY } from '../src/data.js';

const world = createWorld(7262001);
world.showcasePreferences = { UCL: 'semis', 'CUP-ENG1': 'final' };
world.current.postseason.selections = { ...world.showcasePreferences };
simulateToSeasonEnd(world);
const savedWorld = JSON.stringify(world);

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
  location: { hash: '#/world' },
  prompt() { return null; },
  confirm() { return false; }
};
globalThis.location = globalThis.window.location;
globalThis.localStorage = { getItem(key) { return key === SAVE_KEY ? savedWorld : null; }, setItem() {}, removeItem() {} };

await import('../src/app.js');
await handlers['window:DOMContentLoaded']();
const hashchange = handlers['window:hashchange'];
const visit = (hash) => { window.location.hash = hash; hashchange(); return app.innerHTML; };
const click = async (dataset) => {
  await handlers['document:click']({
    target: { closest: (selector) => (selector === '[data-action]' ? { dataset } : null) },
    preventDefault() {}
  });
  return app.innerHTML;
};

const club = world.clubs.find((item) => item.id === 'real-madrid');
const checks = [];
const expect = (label, html, markers) => {
  for (const marker of markers) assert(html.includes(marker), `${label}: missing ${marker}`);
  checks.push(label);
};

// Phase 1: formation, fit and starting XI.
const squad = visit(`#/club/${club.id}/squad`);
expect('club squad', squad, ['Starting XI', 'formation-pitch', 'pitch-player', 'Substitutes', 'fit ']);
expect('club staff formation', squad, ['Formation ']);
expect('club overview formation', visit(`#/club/${club.id}/overview`), ['Formation']);
expect('coach profile formation', visit(`#/coach/${club.coachId}/overview`), ['Formation ']);
expect('nation XI', visit('#/nation/bra'), ['Selected XI', 'formation-pitch']);

console.log(JSON.stringify({ checks, passed: true }, null, 2));
