import assert from 'node:assert/strict';
import { createWorld } from '../src/engine.js';

const handlers = {};
class FakeClassList {
  add() {}
  remove() {}
  toggle() {}
  contains() { return false; }
}
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
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.performance = { now: () => 0 };

await import('../src/app.js');
const domReady = handlers['window:DOMContentLoaded'];
assert(domReady, 'DOMContentLoaded handler not registered');
await domReady();

function assertMounted(label, expected) {
  assert(app.innerHTML.length > 1000, `${label}: app did not mount`);
  assert(app.innerHTML.includes(expected), `${label}: expected UI marker ${expected} missing`);
}

assertMounted('world', 'World football');

const reference = createWorld(7262001);
const player = reference.players.find((row) => row.status === 'active');
const coach = reference.coaches.find((row) => row.status !== 'retired');
const club = reference.clubs[0];
const leagueId = Object.keys(reference.current.leagues)[0];
assert(player && coach && club && leagueId, 'reference routes unavailable');

const hashchange = handlers['window:hashchange'];
assert(hashchange, 'hashchange handler not registered');

const routes = [
  [`#/player/${player.id}/overview`, 'ABILITY'],
  [`#/coach/${coach.id}/overview`, 'QUALITY'],
  [`#/club/${club.id}/overview`, club.name],
  [`#/league/${leagueId}/overview`, reference.current.leagues[leagueId].name],
  ['#/competitions', 'Competitions'],
  ['#/people/players/overview', 'Players'],
  ['#/postseason/setup', 'Choose the matches you want to experience']
];

for (const [hash, marker] of routes) {
  window.location.hash = hash;
  hashchange();
  assertMounted(hash, marker);
}

console.log(JSON.stringify({
  mounted: true,
  routesChecked: routes.length + 1,
  worldHtmlBytes: app.innerHTML.length
}, null, 2));
