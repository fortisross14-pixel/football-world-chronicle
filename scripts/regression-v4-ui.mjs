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
expect('coach profile formation', visit(`#/coach/${club.coachId}/overview`), ['Formation ', 'Tactical matchups', 'Strong against']);
expect('nation XI', visit('#/nation/bra'), ['Selected XI', 'formation-pitch']);

// Phase 2: the Showcase replays the real match, with line-ups, substitutions and cards.
const showcase = world.current.postseason.showcaseMatches;
assert(showcase.length > 0, 'the reference world prepared a showcase');
visit('#/postseason/games');
const opened = await click({ action: 'open-postseason-match', matchId: showcase[0].id });
expect('showcase line-ups', opened, ['showcase-lineups', 'formation-pitch', 'showcase-tactics']);
const resolved = await click({ action: 'quick-postseason-match' });
const original = world.current.archivedKnockoutMatches.find((match) => match.id === showcase[0].matchId);
expect('showcase final events', resolved, original.subs?.length ? ['Sub: '] : ['live-event']);
const scorer = original.goalEvents.find((goal) => goal.scorerId);
if (scorer) {
  const name = world.players.find((player) => player.id === scorer.scorerId)?.name;
  expect('showcase real scorer', resolved, [name]);
}
const taker = world.history.shootouts?.[0]?.kicks?.[0]?.[1];
const shootoutPlayer = world.players.find((player) => player.id === taker);
if (shootoutPlayer) expect('player shootout record', visit(`#/player/${shootoutPlayer.id}/statistics`), ['Shootout']);
expect('club records shootouts', visit(`#/club/${club.id}/legacy`), ['Penalty shootouts']);

// Phase 3: injury history on profiles and injury stories in the season's news.
const injured = world.players.find((player) => (player.injuries || []).length);
if (injured) expect('player injury history', visit(`#/player/${injured.id}/statistics`), ['Injury history', 'avail-chip']);

// Phase 4: personality, potential, form, captain and loans.
const youngster = world.players.find((player) => player.status === 'active' && player.careerYear <= 2 && player.clubId);
expect('player personality panel', visit(`#/player/${youngster.id}/overview`), ['Personality and outlook', 'Potential', 'Form']);
expect('club captain chip', visit(`#/club/${club.id}/squad`), ['captain-chip']);
expect('loans tab', visit('#/transfers/loans'), ['Loan moves', 'Loans this season']);

console.log(JSON.stringify({ checks, passed: true }, null, 2));
