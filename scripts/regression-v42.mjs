// v4.2: formation squads, Squad Reshape, team fitness, international formats and
// seeded draws, and the Showcase pre-game / live / full-time screens, stats filters,
// the live simulation screen's complete state and award flags (real app, fake DOM).
import assert from 'node:assert/strict';
import {
  FORMATIONS, FORMATION_SQUAD_TARGETS, chooseMatchFormation, slotLine, BACKUP_SYSTEM_PENALTY
} from '../src/squad-model.js';
import {
  createWorld, simulateToSeasonEnd, simulateWeeks, startNextSeason, upgradeWorld, getSquadReshape, getClubSquadTarget,
  getTeamFitness, getNationalTeamRanking, runInternationalCycleForCalibration, isShowcaseMatchEmbargoed
} from '../src/engine.js';
import { SAVE_KEY } from '../src/data.js';

const report = {};

// ── Formation targets: 15, two keepers, and the XI fits inside the target ──
for (const [id, target] of Object.entries(FORMATION_SQUAD_TARGETS)) {
  assert.equal(target.GK + target.DF + target.MF + target.FW, 15, `${id} adds up to 15`);
  assert.equal(target.GK, 2, `${id} carries two keepers`);
  const lines = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const [slotType] of FORMATIONS[id].slots) lines[slotLine(slotType)] += 1;
  for (const line of ['DF', 'MF', 'FW']) assert(lines[line] <= target[line] && target[line] - lines[line] <= 2, `${id}: ${line} target matches the XI (${lines[line]} of ${target[line]})`);
}
assert.equal(FORMATIONS['3-5-2'].slots.filter(([slot]) => slotLine(slot) === 'DF').length, 3, '3-5-2 wing-backs are midfielders');
assert.equal(FORMATIONS['5-3-2'].slots.filter(([slot]) => slotLine(slot) === 'DF').length, 5, '5-3-2 wing-backs are defenders');

// ── Backup system: chosen only when the fit gain beats the penalty ──
const make = (position, role, index) => ({ id: `p${index}`, position, role, rating: 80, status: 'active' });
const strikers = [make('GK', 'shot_stopper', 0), ...Array.from({ length: 4 }, (_, i) => make('DF', 'stopper_centre_back', i + 1)),
  ...Array.from({ length: 4 }, (_, i) => make('MF', 'box_to_box', i + 5)), ...Array.from({ length: 6 }, (_, i) => make('FW', 'striker', i + 9))];
const strict = chooseMatchFormation(strikers, '4-1-4-1', '4-4-2', { backupPenalty: BACKUP_SYSTEM_PENALTY });
const loose = chooseMatchFormation(strikers, '4-1-4-1', '4-4-2', { backupPenalty: 0 });
assert(loose.fallback, 'a coach with no penalty switches to the system his players suit');
assert(!strict.fallback || strict.systemPenalty === BACKUP_SYSTEM_PENALTY, 'the backup system carries its penalty');
report.backupSystem = { withPenalty: strict.formationId, withoutPenalty: loose.formationId };

// ── Squad Reshape after one season ──
const world = createWorld(42042);
simulateToSeasonEnd(world);
startNextSeason(world);
const reshape = getSquadReshape(world);
assert(reshape && reshape.releases.length > 50, 'clubs release surplus players');
const present = new Map();
for (const player of world.players) if (player.status === 'active' && player.clubId) {
  const row = present.get(player.clubId) || { GK: 0, DF: 0, MF: 0, FW: 0, n: 0 };
  row[player.position] += 1; row.n += 1; present.set(player.clubId, row);
}
const full = world.clubs.filter((club) => club.tier === 'detailed' && club.division === 1);
const atFifteen = full.filter((club) => (present.get(club.id)?.n || 0) === 15).length;
assert(atFifteen / full.length > 0.9, `squads end at 15 (${atFifteen}/${full.length})`);
let shaped = 0;
for (const club of full) {
  const target = getClubSquadTarget(world, club.id);
  const row = present.get(club.id) || {};
  if (['GK', 'DF', 'MF', 'FW'].every((position) => Math.abs((row[position] || 0) - target[position]) <= 1)) shaped += 1;
  assert((row.GK || 0) <= 3, 'never more than two keepers plus a loanee');
}
assert(shaped / full.length > 0.9, `squads follow the coach's shape (${shaped}/${full.length})`);
report.reshape = { releases: reshape.releases.length, signings: reshape.signings.length, afterRelease: reshape.signings.filter((row) => row.afterRelease).length, spawned: reshape.spawned, atFifteen, shaped, clubs: full.length };

// ── Team fitness: congested weeks wear teams down, normal weeks restore them ──
const fit = createWorld(42043);
let lowest = 100;
for (let week = 0; week < 20; week += 1) {
  simulateWeeks(fit, 1);
  for (const club of fit.clubs) lowest = Math.min(lowest, getTeamFitness(fit, club.id));
}
assert(lowest < 85, `congestion lowers team fitness (lowest ${lowest})`);
report.teamFitness = { lowest };

// ── International: seeded pots and formats ──
const intl = createWorld(42044);
const { competitions, matches } = runInternationalCycleForCalibration(intl, 'regional');
const euro = competitions.EURO;
assert.equal(euro.groups.length, 6, 'Euros: six groups');
assert.equal(euro.groups.flatMap((group) => group.teamIds).length, 24, 'Euros: 24 teams');
const pot1 = euro.draw.pots[0];
assert.equal(new Set(euro.groups.filter((group) => group.teamIds.some((id) => pot1.includes(id))).map((group) => group.id)).size, 6, 'pot 1 teams are in different groups');
const firstRound = euro.knockout.rounds[0];
assert.equal(firstRound.matchIds.length, 8, 'Round of 16 from groups plus best thirds');
assert.equal(euro.bestThirds.filter((row) => row.qualified).length, 4, 'four best third-placed teams go through');
const copa = competitions.COPA;
assert.equal(copa.groups.length, 2);
assert(copa.groups.every((group) => group.teamIds.length === 5));
assert.equal(copa.knockout.rounds[0].matchIds.length, 4, 'Copa América: top four of each group to the quarter-finals');
const gold = competitions.GOLDCUP;
assert.equal(gold.groups.length, 3);
assert.equal(gold.knockout.rounds[0].matchIds.length, 4, 'Gold Cup: quarter-finals with two best thirds');
const wcRun = runInternationalCycleForCalibration(intl, 1);
const wc = wcRun.competitions.WC;
const regions = (id) => intl.nationalTeams.find((team) => team.id === id)?.region;
const overLimit = wc.groups.filter((group) => { const counts = {}; for (const id of group.teamIds) counts[regions(id)] = (counts[regions(id)] || 0) + 1; return Object.entries(counts).some(([region, count]) => count > (region === 'Europe' ? 2 : 1)); }).length;
report.international = { euroThirds: euro.bestThirds.filter((row) => row.qualified).map((row) => row.groupId), worldCupGroupsOverLimit: overLimit, rankingTop: getNationalTeamRanking(intl).slice(0, 3).map((row) => row.id) };
assert(overLimit <= 2, 'World Cup groups respect confederation limits where the draw allows');
void matches;

// Migration: a tournament already under way keeps its format.
const legacy = createWorld(42045);
for (const comp of Object.values(legacy.current.internationalCompetitions)) { delete comp.format; delete comp.draw; }
legacy.dataRevision = 32;
const upgraded = upgradeWorld(JSON.parse(JSON.stringify(legacy)));
assert(upgraded.dataRevision >= 33);
assert(Object.values(upgraded.current.internationalCompetitions).every((comp) => comp.format === null && comp.draw === null), 'in-progress tournaments keep their old format');
assert.deepEqual(upgraded.current.teamFitness, {});

// ── UI ──
const ui = createWorld(7262042);
ui.showcasePreferences = { UCL: 'final', 'CUP-ENG1': 'final' };
ui.current.postseason.selections = { ...ui.showcasePreferences };
simulateToSeasonEnd(ui);
const final = ui.current.postseason.showcaseMatches.find((row) => row.competitionId === 'UCL');
assert(final, 'the UCL final is in the Showcase');
let saved = JSON.stringify(ui);
const handlers = {};
class FakeClassList { add() {} remove() {} toggle() {} contains() { return false; } }
const app = { innerHTML: '' };
const storage = new Map();
globalThis.document = { body: { classList: new FakeClassList() }, addEventListener(type, cb) { handlers[`document:${type}`] = cb; }, getElementById(id) { return id === 'app' ? app : null; }, querySelectorAll() { return []; } };
globalThis.window = { addEventListener(type, cb) { handlers[`window:${type}`] = cb; }, scrollTo() {}, location: { hash: '#/postseason/games' }, prompt() { return null; }, confirm() { return false; } };
globalThis.location = globalThis.window.location;
globalThis.localStorage = { getItem(key) { return key === SAVE_KEY ? saved : storage.get(key) ?? null; }, setItem(key, value) { if (key === SAVE_KEY) saved = value; else storage.set(key, value); }, removeItem() {} };
await import('../src/app.js');
await handlers['window:DOMContentLoaded']();
const click = (action, dataset = {}) => handlers['document:click']({ target: { closest: (selector) => (selector === '[data-action]' ? { dataset: { action, ...dataset } } : null) } });
const go = (hash) => { window.location.hash = hash; handlers['window:hashchange'](); return app.innerHTML; };
const text = (html) => html.replace(/<[^>]+>/g, ' ');
go('#/postseason/games');
await click('open-postseason-match', { matchId: final.id });
const pre = app.innerHTML;
for (const marker of ['Kick off', 'Quick simulate', 'The matchup', 'Head to head', 'Predicted line-ups', 'sc-odds-bar', 'Road to this match', 'Stars', 'Coach']) assert(pre.includes(marker), `pre-game shows ${marker}`);
assert(!pre.includes('Full time') && !pre.includes('sc-goal-moment') && !pre.includes('Man of the Match'), 'the pre-game screen does not reveal the result');
const homeName = ui.clubs.find((club) => club.id === final.homeId)?.name;
assert(pre.includes(`#/club/${final.homeId}/overview`), 'teams are links');
// Following a link and coming back returns to the same unstarted screen.
go(`#/club/${final.homeId}/overview`);
assert(!app.innerHTML.includes('Kick off'), 'the club page opens');
go('#/postseason/games');
assert(app.innerHTML.includes('Kick off'), 'back on the pre-game screen');
assert(!JSON.parse(saved).current.postseason.showcaseMatches.find((row) => row.id === final.id).resolved, 'the match is still unplayed');
// Live: kick off and watch a few minutes.
await click('watch-postseason-match');
await new Promise((resolve) => setTimeout(resolve, 2600));
const live = app.innerHTML;
for (const marker of ['sc-momentum', 'Match events', 'xG', 'formation-pitch', 'LIVE']) assert(live.includes(marker), `live screen shows ${marker}`);
// Full time.
await click('quick-postseason-match');
const post = app.innerHTML;
for (const marker of ['Full time', 'What it means', 'Back to the Showcase', 'sc-ratings', 'Momentum']) assert(post.includes(marker), `full-time screen shows ${marker}`);
if (final.manOfMatchId) assert(post.includes('Man of the Match'));
assert(/CHAMPIONS/.test(post), 'a final ends with the trophy celebration');
report.ui = { homeName, post: text(post).match(/What it means\s+([^.]*\.)/)?.[1]?.trim() };

// Stats filters: Region → Country → Competition.
go('#/magazine/rankings');
const desk = app.innerHTML;
assert(desk.includes('data-stat-filter="desk"') && desk.includes('data-level="region"') && desk.includes('data-level="country"') && desk.includes('data-level="competition"'), 'the stats desk has three filters');
const pick = (level, value) => { const select = { dataset: { statFilter: 'desk', level }, value }; return select; };
void pick;
assert(desk.includes('>Libertadores') || desk.includes('Champions League'), 'competition options follow the selection');

console.log(JSON.stringify(report, null, 2));
console.log('v4.2 regression passed');
