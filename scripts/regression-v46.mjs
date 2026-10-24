// v4.6: season-scoped competition stats (with the Showcase embargo), head-to-head
// archiving and its save migration, links across the app and the live Showcase return.
// Real app with a fake DOM, one finished season plus a few weeks of the next.
import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd, simulateWeeks, startNextSeason, upgradeWorld, isShowcaseMatchEmbargoed } from '../src/engine.js';
import { SAVE_KEY } from '../src/data.js';

const report = {};
const world = createWorld(4646);
world.showcasePreferences = { UCL: 'semis' };
world.current.postseason.selections = { ...world.showcasePreferences };
simulateToSeasonEnd(world);
const seasonOne = world.season;
const finishedSave = JSON.stringify(world);

// ── Fake DOM ──
const handlers = {};
class FakeClassList { add() {} remove() {} toggle() {} contains() { return false; } }
const app = { innerHTML: '' };
let saved = finishedSave;
globalThis.document = {
  body: { classList: new FakeClassList() },
  addEventListener(type, cb) { handlers[`document:${type}`] = cb; },
  getElementById(id) { return id === 'app' ? app : null; },
  querySelectorAll() { return []; }
};
globalThis.window = { addEventListener(type, cb) { handlers[`window:${type}`] = cb; }, scrollTo() {}, scrollY: 0, location: { hash: '#/world' }, prompt() { return null; }, confirm() { return false; } };
globalThis.location = globalThis.window.location;
globalThis.localStorage = { getItem(key) { return key === SAVE_KEY ? saved : null; }, setItem(key, value) { if (key === SAVE_KEY) saved = value; }, removeItem() {} };
await import('../src/app.js');
await handlers['window:DOMContentLoaded']();
const visit = (hash) => { window.location.hash = hash; handlers['window:hashchange'](); return app.innerHTML; };
const click = async (dataset) => { await handlers['document:click']({ target: { closest: (selector) => (selector === '[data-action]' ? { dataset } : null) }, preventDefault() {} }); return app.innerHTML; };

// ── Part 2: "This season" stats leave out the unplayed Showcase semi-finals ──
const hidden = [...(world.current.archivedKnockoutMatches || [])].filter((match) => match.competitionId === 'UCL' && isShowcaseMatchEmbargoed(world, match));
assert(hidden.length >= 2, 'UCL semi-finals are held for the Showcase');
const stats = visit('#/competition/UCL/stats/players');
assert(stats.includes('id="competition-stats-scope"') && stats.includes('This season'), 'season selector defaults to this season');
const goals = new Map();
for (const row of world.history.playerSeasons.filter((item) => item.competitionId === 'UCL' && item.season === seasonOne)) goals.set(row.playerId, (goals.get(row.playerId) || 0) + row.goals);
for (const match of hidden) for (const goal of match.goalEvents || []) if (goal.scorerId) goals.set(goal.scorerId, goals.get(goal.scorerId) - 1);
const best = Math.max(...goals.values());
const firstRow = stats.slice(stats.indexOf('<tbody>'), stats.indexOf('</tr>', stats.indexOf('<tbody>')));
assert(new RegExp(`<strong>${best}</strong>`).test(firstRow), `top scorer shows ${best} goals without the hidden semi-finals`);
report.uclTopScorerThisSeason = best;
for (const sub of ['teams', 'coaches']) assert(visit(`#/competition/UCL/stats/${sub}`).includes('id="competition-stats-scope"'), `${sub} stats have the selector`);
assert(/Top scorers this season/.test(visit('#/competition/UCL/overview')), 'overview shows this season\'s scoring race');

// ── Part 4: links ──
const showcase = visit('#/postseason/games');
assert(/<h3><a class="entity-link comp-link" href="#\/competition\/UCL\/overview">/.test(showcase), 'Showcase list links the competition');
const semi = hidden.find((match) => /semi/i.test(match.stage || ''));
const showcaseRow = world.current.postseason.showcaseMatches.find((row) => row.matchId === semi.id || row.id === `showcase-${semi.id}`);
visit('#/postseason/games');
const pre = await click({ action: 'open-postseason-match', matchId: showcaseRow.id });
assert(pre.includes('Head to head') && pre.includes('comp-link') && pre.includes('text-link'), 'pre-game links competition and teams');
// Leaving through a link and coming back reopens the same match, still unplayed.
const away = visit('#/competition/UCL/overview');
assert(!away.includes('showcase-match-modal'), 'the match closes while away');
const back = visit('#/postseason/games');
assert(back.includes('showcase-match-modal') && back.includes('sc-pre-modal'), 'coming back reopens the pre-game screen');
assert(!JSON.parse(saved).current.postseason.showcaseMatches.find((row) => row.id === showcaseRow.id).resolved, 'the match was not played or skipped');

// ── Part 3: head-to-head archive, embargo by season, migration ──
startNextSeason(world);
simulateWeeks(world, 12);
const landmarks = world.history.landmarkMatches.filter((row) => row.season === seasonOne);
const pastFinal = landmarks.find((row) => row.competitionId === 'UCL' && /^final$/i.test(row.stage || ''));
assert(pastFinal, 'last season\'s UCL final is archived');
assert.equal(isShowcaseMatchEmbargoed(world, pastFinal), false, 'a past Showcase final is no longer embargoed');
const earlierRounds = landmarks.filter((row) => row.scoreline && /Quarter|Round of 16/i.test(row.stage || ''));
assert(earlierRounds.length >= 8, 'quarter-finals and round of 16 keep a scoreline');
report.landmarks = { total: landmarks.length, scorelines: earlierRounds.length };
const legacy = JSON.parse(JSON.stringify(world));
legacy.dataRevision = 35;
legacy.history.landmarkMatches = [];
upgradeWorld(legacy);
assert.equal(legacy.dataRevision, 36);
const recovered = legacy.history.landmarkMatches.filter((row) => row.competitionId === 'UCL');
assert(recovered.length >= 3 && recovered.every((row) => Number.isFinite(row.homeGoals)), 'old saves recover Showcase finals and semi-finals with scores');
report.migrationRecovered = recovered.length;

// ── Part 2 again: past seasons appear in the selector ──
saved = JSON.stringify(world);
await handlers['window:DOMContentLoaded']();
const seasonTwo = visit('#/competition/UCL/stats/players');
assert(seasonTwo.includes(`<option value="${seasonOne}"`) && seasonTwo.includes('<option value="all"'), 'past season and all-time options');
const results = visit('#/club/real-madrid/season');
assert(results.includes('comp-link') && /match-star[\s\S]*?player-link/.test(results), 'match rows link the competition and scorers');

console.log(JSON.stringify({ ...report, passed: true }, null, 2));
