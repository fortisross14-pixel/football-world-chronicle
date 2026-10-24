// v4.1: "Simulate to season end" and the offseason play step by step behind live
// screens. Runs the real app with a fake DOM, records every painted screen and checks
// what they show, that Showcase picks stay hidden, and that the result matches a
// plain run of the same seed.
import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd, startNextSeason } from '../src/engine.js';
import { SAVE_KEY } from '../src/data.js';

const seed = 7262101;
const world = createWorld(seed);
world.showcasePreferences = { UCL: 'final' };
world.current.postseason.selections = { ...world.showcasePreferences };
let saved = JSON.stringify(world);

const handlers = {};
const screens = [];
class FakeClassList { add() {} remove() {} toggle() {} contains() { return false; } }
const app = {
  _html: '',
  get innerHTML() { return this._html; },
  set innerHTML(value) { this._html = value; if (value.includes('live-hero')) screens.push(value); }
};
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
globalThis.localStorage = { getItem(key) { return key === SAVE_KEY ? saved : null; }, setItem(key, value) { if (key === SAVE_KEY) saved = value; }, removeItem() {} };

await import('../src/app.js');
await handlers['window:DOMContentLoaded']();
const click = (action) => handlers['document:click']({ target: { closest: (selector) => (selector === '[data-action]' ? { dataset: { action } } : null) } });

// Season: one screen per week, with leaders, knockouts and honours.
await click('simulate-season');
const seasonScreens = screens.filter((html) => html.includes('Season in progress'));
assert(seasonScreens.length >= 50, `a screen per week (${seasonScreens.length})`);
const late = seasonScreens.at(-2);
for (const marker of ['League leaders', 'Honours so far', 'Knockout football', 'live-table']) assert(late.includes(marker), `season screen shows ${marker}`);
assert(seasonScreens.some((html) => /Week 26 of 52/.test(html)));
// The Champions League final was picked for the Showcase: never shown as decided.
const honoursRow = (html) => html.slice(html.indexOf('Honours so far'));
assert(seasonScreens.slice(-5).every((html) => honoursRow(html).includes('Showcase')), 'the Showcase final stays hidden on the live screen');
assert(seasonScreens.some((html) => /To be decided/.test(honoursRow(html))) && /Champions<\/th>/.test(late), 'honours fill in as the season goes');

// Offseason: stages with signings and coaching changes.
const before = screens.length;
await click('next-season');
const offseasonScreens = screens.slice(before).filter((html) => html.includes('Offseason in progress'));
assert(offseasonScreens.length >= 4, `offseason stages painted (${offseasonScreens.length})`);
const last = offseasonScreens.at(-1);
// v4.3: the live offseason screen lists Elite moves (by rarity) instead of Top signings (by fee).
for (const marker of ['Elite moves', 'Coaching changes', 'live-steps']) assert(last.includes(marker), `offseason screen shows ${marker}`);
assert(offseasonScreens.some((html) => html.includes('Transfer market')));

// v4.5: top new players and top retirements, with the elite counts and ranges above them.
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
const finalScreen = screens.at(-1);
for (const marker of ['Top 10 new players', 'Top 10 retirements']) assert(finalScreen.includes(marker), `offseason screen shows ${marker}`);
assert(/Generational \d+ \(2–4\) · Legend \d+ \(12–17\) · Epic \d+ \(42–55\)/.test(text(finalScreen)), 'elite counts and ranges line');
const newPlayers = finalScreen.slice(finalScreen.indexOf('Top 10 new players'), finalScreen.indexOf('Top 10 retirements'));
assert((newPlayers.match(/class="people-row"/g) || []).length === 10, 'ten new players listed');
assert(/href="#\/player\/[^"]+\/overview"/.test(newPlayers) && /href="#\/club\//.test(newPlayers) && /href="#\/nation\//.test(newPlayers), 'player, club and nation links');
const rankOf = { generational: 6, legend: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
const order = [...newPlayers.matchAll(/rarity-badge rarity-(\w+)/g)].map((m) => rankOf[m[1]]);
assert(order.every((value, index) => index === 0 || order[index - 1] >= value), 'new players sorted by rarity first');
await click('live-close');
location.hash = '#/offseason/summary';
await handlers['window:hashchange']?.();
assert(app.innerHTML.includes('Top 10 new players') && app.innerHTML.includes('Show all'), 'summary page has the lists with Show all');
location.hash = '#/offseason/debuts';
await handlers['window:hashchange']?.();
assert(app.innerHTML.includes('Every new player'), 'Show all page for new players');
location.hash = '#/offseason/retirements';
await handlers['window:hashchange']?.();
assert(app.innerHTML.includes('Every retirement'), 'Show all page for retirements');

// Same world as a plain run.
const plain = createWorld(seed);
plain.showcasePreferences = { UCL: 'final' };
plain.current.postseason.selections = { ...plain.showcasePreferences };
simulateToSeasonEnd(plain);
startNextSeason(plain);
const live = JSON.parse(saved);
assert.equal(live.season, plain.season);
assert.equal(JSON.stringify(live.history.champions), JSON.stringify(plain.history.champions), 'same champions as a plain run');
assert.equal(JSON.stringify(live.history.transfers.map((row) => [row.playerId, row.toClubId, row.fee])), JSON.stringify(plain.history.transfers.map((row) => [row.playerId, row.toClubId, row.fee])), 'same transfers as a plain run');

console.log(JSON.stringify({ seasonScreens: seasonScreens.length, offseasonScreens: offseasonScreens.length, passed: true }, null, 2));
