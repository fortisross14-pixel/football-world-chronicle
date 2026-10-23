// v4.4: coach rarity bands, coach careers by phase, youth academies (scores, stars,
// intake during Squad Reshape, caps) and the UI for all of it (real app, fake DOM).
import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd, startNextSeason, upgradeWorld, coachCareerPhase, getClubAcademy, getYouthIntake, getBestAcademies, academyStars, getClubChanges } from '../src/engine.js';
import { SAVE_KEY, STAR_RARITIES } from '../src/data.js';

const report = {};
const count = (rows, rarity) => rows.filter((row) => row.rarity === rarity).length;
const activeCoaches = (world) => world.coaches.filter((coach) => coach.status !== 'retired');

// ── Coach rarity: a new world generates to the targets ──
const world = createWorld(44044);
const start = activeCoaches(world);
assert(count(start, 'generational') >= 2 && count(start, 'generational') <= 3, 'Generational coaches 2–3');
assert(count(start, 'legend') >= 8 && count(start, 'legend') <= 10, 'Legend coaches 8–10');
assert(count(start, 'epic') >= 15 && count(start, 'epic') <= 20, 'Epic coaches 15–20');
assert(Math.abs(count(start, 'rare') - 40) <= 4, 'about 40 Rare coaches');
report.coachesAtStart = Object.fromEntries(['generational', 'legend', 'epic', 'rare', 'uncommon', 'common'].map((rarity) => [rarity, count(start, rarity)]));

// ── Academies at the start: stars from score, a few seeded 4★/5★ ──
for (const [score, stars] of [[0, 1], [19.9, 1], [20, 2], [59, 3], [60, 4], [79.9, 4], [80, 5], [100, 5]]) assert.equal(academyStars(score), stars, `score ${score} is ${stars}★`);
const top = world.clubs.filter((club) => club.division === 1);
const startStars = [1, 2, 3, 4, 5].map((stars) => top.filter((club) => getClubAcademy(world, club.id).stars === stars).length);
assert(startStars[4] >= 1, 'some 5★ academies at the start');
assert(startStars[3] >= 3, 'some 4★ academies at the start');
report.academyStarsAtStart = startStars;

simulateToSeasonEnd(world);
startNextSeason(world);

// ── Coach counts stay in the bands after an offseason ──
const after = activeCoaches(world);
assert(count(after, 'generational') <= 3 && count(after, 'legend') <= 10 && count(after, 'epic') <= 20, 'replacements keep the bands');
for (const coach of after) assert(['early', 'peak', 'late'].includes(coachCareerPhase(coach)));
report.coachesAfterOne = Object.fromEntries(['generational', 'legend', 'epic'].map((rarity) => [rarity, count(after, rarity)]));

// ── Youth intake happens in Squad Reshape and respects the rules ──
const intake = getYouthIntake(world);
assert(intake.length > 50, 'academies promote players every offseason');
for (const row of intake) {
  const player = world.players.find((item) => item.id === row.playerId);
  const club = world.clubs.find((item) => item.id === row.clubId);
  assert(player && club, 'youth rows point at real players and clubs');
  assert.equal(player.academyClubId, club.id, 'youth players remember their academy');
  assert(player.academy, 'youth players are academy graduates');
  const stars = academyStars(getClubAcademy(world, club.id).score);
  if (stars === 1) assert.equal(row.rarity, 'common', '1★ academies only produce Commons');
  if (stars === 2) assert(['common', 'uncommon'].includes(row.rarity), '2★ academies produce Common/Uncommon');
  if (stars === 4) assert.notEqual(row.rarity, 'common', '4★ academies produce no Commons');
}
const active = world.players.filter((player) => player.status === 'active');
assert(count(active, 'generational') <= 3, 'Generational cap');
assert(count(active, 'legend') <= 16, 'Legend cap');
assert(count(active, 'epic') <= 52, 'Epic cap');
report.youth = { intake: intake.length, byRarity: Object.fromEntries(['generational', 'legend', 'epic', 'rare', 'uncommon', 'common'].map((rarity) => [rarity, count(intake, rarity)])) };

// ── Academy scores move once per offseason and stay in 0–100 ──
for (const club of top) {
  const info = getClubAcademy(world, club.id);
  assert(info.score >= 0 && info.score <= 100);
  assert(info.history.length >= 1, 'academy history records the offseason');
  assert(Number.isFinite(info.drivers.drift));
}
const best = getBestAcademies(world, 10);
assert(best.length === 10 && best.every((row, index) => !index || best[index - 1].score >= row.score), 'best academies are sorted');
report.bestAcademy = best[0];

// ── Club changes split youth from signings ──
const youthClub = intake[0].clubId;
const changes = getClubChanges(world, youthClub);
assert(changes.youthIntake.some((row) => row.playerId === intake[0].playerId), 'club changes list the youth intake');

// ── Migration: old saves keep their coaches, gain academies ──
const legacy = createWorld(44045);
const extraLegend = legacy.coaches.find((coach) => coach.rarity === 'rare' && coach.status !== 'retired');
extraLegend.rarity = 'legend';
legacy.dataRevision = 34;
delete legacy.coachRarityTargets;
for (const club of legacy.clubs) { delete club.academyScore; delete club.academyHistory; delete club.academyTradition; }
for (const player of legacy.players) delete player.academyClubId;
delete legacy.current.youthIntake;
const upgraded = upgradeWorld(JSON.parse(JSON.stringify(legacy)));
assert.equal(upgraded.dataRevision, 35);
assert.equal(upgraded.coaches.find((coach) => coach.id === extraLegend.id).rarity, 'legend', 'existing coaches are never demoted');
assert(upgraded.coachRarityTargets, 'targets are stored');
assert(upgraded.clubs.filter((club) => club.division === 1).some((club) => club.academyScore >= 80), 'migrated worlds get seeded 5★ academies');
assert(Array.isArray(upgraded.current.youthIntake));
simulateToSeasonEnd(upgraded);
startNextSeason(upgraded);
assert(getYouthIntake(upgraded).length > 0, 'a migrated save keeps playing and promotes youth');

// ── UI ──
let saved = JSON.stringify(world);
const handlers = {};
class FakeClassList { add() {} remove() {} toggle() {} contains() { return false; } }
const app = { innerHTML: '' };
globalThis.document = { body: { classList: new FakeClassList() }, addEventListener(type, cb) { handlers[`document:${type}`] = cb; }, getElementById(id) { return id === 'app' ? app : null; }, querySelectorAll() { return []; } };
globalThis.window = { addEventListener(type, cb) { handlers[`window:${type}`] = cb; }, scrollTo() {}, location: { hash: '#/transfers' }, prompt() { return null; }, confirm() { return false; } };
globalThis.location = globalThis.window.location;
const storage = new Map();
globalThis.localStorage = { getItem(key) { return key === SAVE_KEY ? saved : storage.get(key) ?? null; }, setItem(key, value) { if (key === SAVE_KEY) saved = value; else storage.set(key, value); }, removeItem() {} };
await import('../src/app.js');
await handlers['window:DOMContentLoaded']();
const go = (hash) => { window.location.hash = hash; handlers['window:hashchange'](); return app.innerHTML; };

const eliteCoach = world.coaches.find((coach) => coach.rarity === 'legend' && coach.status !== 'retired');
const coachHtml = go(`#/coach/${eliteCoach.id}/overview`);
assert(coachHtml.includes('Season by season') && coachHtml.includes('coach-chart'), 'coach page leads with charts');
assert(coachHtml.includes('Quality') && coachHtml.includes('Win rate') && coachHtml.includes('Trophies'));
assert(coachHtml.includes('Career timeline') && coachHtml.includes('coach-band'), 'career timeline bands');
assert(/Early career|Peak years|Late career/.test(coachHtml) && /seasons? left|final season/.test(coachHtml), 'career phase and years left in the header');
assert(go(`#/coach/${eliteCoach.id}/career`).includes('Teams coached by season'), 'tables are kept');

const clubHtml = go(`#/club/${youthClub}/overview`);
assert(clubHtml.includes('Youth academy') && clubHtml.includes('academy-stars') && clubHtml.includes('academy-trend'), 'club academy panel');
assert(clubHtml.includes('Signings') && clubHtml.includes('Youth intake') && clubHtml.includes('Departures'), 'since last season splits signings, departures and youth');
assert(go(`#/club/${youthClub}/legacy`).includes('Academy graduates'), 'club records count academy graduates');
const youthPlayerHtml = go(`#/player/${intake[0].playerId}/overview`);
assert(youthPlayerHtml.includes('<span>Academy</span>'), 'player profile shows the academy');
assert(go('#/rankings/academies').includes('Best academies'), 'best academies ranking');
const movesHtml = go('#/transfers');
assert(movesHtml.includes('Youth intake') && movesHtml.includes('Signings'), 'market summary splits youth intake');
assert(go('#/offseason/summary').includes('Youth intake'), 'offseason summary has the youth intake');
assert(go('#/magazine/preseason').includes('elite rookies'));
report.ui = 'ok';

console.log(JSON.stringify(report, null, 2));
console.log('regression-v44 passed');
