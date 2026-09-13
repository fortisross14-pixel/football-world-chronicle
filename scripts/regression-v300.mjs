import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createWorld } from '../src/engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.equal(pkg.version, '3.0.0');
assert(appSource.includes("const APP_VERSION = '3.00'"), 'APP_VERSION should be 3.00');
assert(cssSource.includes('v3.00 FINAL LAYOUT / SINGLE-HEADER PASS'), 'v3.00 layout styles missing');
assert(!appSource.includes('sim-row-label">SIMULATE'), 'stray SIMULATE label still present');
assert(appSource.includes("League pos.</th><th>Games</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA"), 'club history columns do not match v3.00 spec');

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
const hashchange = handlers['window:hashchange'];
assert(domReady && hashchange, 'runtime handlers missing');
await domReady();

const reference = createWorld(7262001);
const club = reference.clubs.find((row) => row.division === 1) || reference.clubs[0];
const player = reference.players.find((row) => row.status === 'active' && row.clubId === club.id) || reference.players.find((row) => row.status === 'active');
const coach = reference.coaches.find((row) => row.status !== 'retired' && row.clubId === club.id) || reference.coaches.find((row) => row.status !== 'retired');
const cupId = `CUP-${club.leagueId}`;
assert(club && player && coach && reference.current.domesticCups[cupId], 'reference entity routes unavailable');

function navigate(hash) {
  window.location.hash = hash;
  hashchange();
  assert(app.innerHTML.length > 1000, `${hash}: page failed to render`);
  return app.innerHTML;
}

let html = navigate(`#/club/${club.id}/overview`);
assert(html.includes('compact-club-hero'), 'club compact blue hero missing');
assert(!html.includes('premium-page-head'), 'club still has duplicate white page header');
assert(!html.includes('SIMULATE'), 'topbar still exposes stray SIMULATE label');

html = navigate(`#/player/${player.id}/overview`);
assert(html.includes('compact-profile-hero'), 'player compact blue hero missing');
assert(!html.includes('premium-page-head'), 'player still has duplicate white page header');

html = navigate(`#/coach/${coach.id}/overview`);
assert(html.includes('compact-profile-hero'), 'coach compact blue hero missing');
assert(!html.includes('premium-page-head'), 'coach still has duplicate white page header');

html = navigate(`#/competition/${cupId}/overview`);
assert(html.includes('competition-page-hero'), 'competition blue hero missing');
assert(!html.includes('premium-page-head'), 'competition still has duplicate white page header');
assert(html.includes('Current Season'), 'competition tab should say Current Season');

html = navigate(`#/competition/${cupId}/current`);
assert(html.includes('Next games'), 'live knockout cup should show its next round fixtures');
assert(!html.includes('RECENT GAMES'), 'live knockout current-season view should not fall back to recent-game archive when next fixtures exist');

html = navigate(`#/club/${club.id}/history`);
assert(html.includes('League pos.'), 'club history missing league position');
assert(html.includes('<th>Games</th>') && html.includes('<th>W</th>') && html.includes('<th>D</th>') && html.includes('<th>L</th>'), 'club history missing total-record columns');
assert(!html.includes('<th>League</th>'), 'club history still contains redundant league-name column');

console.log(JSON.stringify({
  version: pkg.version,
  routesChecked: 6,
  singleHeaders: true,
  knockoutNextRound: true,
  clubHistoryColumns: true
}, null, 2));
