// Phase 1: 15-player squads, coach formations, formation fit and the r25 → r26 upgrade.
import assert from 'node:assert/strict';
import {
  createWorld, simulateWeeks, simulateToSeasonEnd, startNextSeason, upgradeWorld,
  getTeamSquadView, getCoachFormations
} from '../src/engine.js';
import {
  FORMATIONS, selectStartingEleven, formationFitScore, chooseMatchFormation, formationChoicesForStyle
} from '../src/squad-model.js';
import * as legacy from './fixtures/legacy-r25/src/engine.js';

const report = {};

// --- Formation fit behaves like football -------------------------------------------
const make = (id, position, role, rating = 80) => ({ id, position, role, rating, status: 'active' });
const core = [
  make('gk', 'GK', 'shot_stopper', 80), make('gk2', 'GK', 'shot_stopper', 70),
  make('cb1', 'DF', 'stopper_centre_back'), make('cb2', 'DF', 'ball_playing_centre_back'),
  make('fb1', 'DF', 'attacking_full_back'), make('fb2', 'DF', 'defensive_full_back'),
  make('cm1', 'MF', 'box_to_box'), make('cm2', 'MF', 'deep_playmaker')
];
const strikers = [...core, make('cb3', 'DF', 'stopper_centre_back', 74), make('wm1', 'MF', 'wide_midfielder'), make('wm2', 'MF', 'wide_midfielder'),
  make('dm', 'MF', 'defensive_midfielder', 72), make('st1', 'FW', 'striker'), make('st2', 'FW', 'target_forward'), make('st3', 'FW', 'target_forward', 72)];
const wingers = [...core, make('cb3', 'DF', 'stopper_centre_back', 74), make('dm', 'MF', 'defensive_midfielder'), make('am', 'MF', 'attacking_midfielder', 74),
  make('w1', 'FW', 'winger'), make('w2', 'FW', 'inside_forward'), make('st', 'FW', 'striker'), make('w3', 'FW', 'winger', 72)];
const wingBacks = [...core.filter((p) => !p.id.startsWith('fb')), make('cb3', 'DF', 'stopper_centre_back', 79), make('wb1', 'DF', 'attacking_full_back'),
  make('wb2', 'DF', 'attacking_full_back'), make('dm', 'MF', 'defensive_midfielder'), make('cm3', 'MF', 'box_to_box', 74),
  make('st1', 'FW', 'striker'), make('st2', 'FW', 'target_forward'), make('st3', 'FW', 'striker', 72)];
assert(formationFitScore(wingers, '4-3-3') > formationFitScore(wingers, '4-4-2') + 5, 'wingers suit 4-3-3');
assert(formationFitScore(strikers, '4-4-2') > formationFitScore(strikers, '4-3-3') + 5, 'a strike pair with wide midfielders suits 4-4-2');
assert(formationFitScore(wingBacks, '3-5-2') > formationFitScore(wingBacks, '4-3-3') + 5, 'wing-backs and three centre-backs suit 3-5-2');
const thin = strikers.filter((p) => !['cb2', 'cb3'].includes(p.id));
assert(formationFitScore(thin, '4-4-2') < formationFitScore(strikers, '4-4-2'), 'a thin defensive line lowers fit');
const fallback = chooseMatchFormation(strikers, '4-2-3-1', '4-4-2');
assert.equal(fallback.formationId, '4-4-2', 'a coach whose first shape fits poorly falls back to the second');
const unavailable = new Set(['st1']);
const withoutStriker = selectStartingEleven(strikers, '4-4-2', { unavailable });
assert(!withoutStriker.xi.some((row) => row.player.id === 'st1'), 'unavailable players are never selected');
assert.equal(withoutStriker.xi.length, 11);
report.fit = { wingers433: formationFitScore(wingers, '4-3-3'), wingers442: formationFitScore(wingers, '4-4-2'), strikers442: formationFitScore(strikers, '4-4-2'), strikers433: formationFitScore(strikers, '4-3-3') };

// --- New world: squads, coaches and rarity caps -----------------------------------
const world = createWorld(26001);
const twin = createWorld(26001);
assert.deepEqual(world.players.slice(0, 400).map((p) => [p.id, p.rating, p.role]), twin.players.slice(0, 400).map((p) => [p.id, p.rating, p.role]), 'same seed, same squads');
const rosters = new Map();
for (const player of world.players) if (player.status === 'active' && player.clubId) {
  if (!rosters.has(player.clubId)) rosters.set(player.clubId, []);
  rosters.get(player.clubId).push(player);
}
const topFlight = world.clubs.filter((club) => club.tier === 'detailed' && club.division === 1);
for (const club of topFlight) assert((rosters.get(club.id) || []).length >= 15, `${club.name} carries a 15-player squad`);
for (const club of world.clubs.filter((club) => club.tier !== 'detailed' || club.division === 2)) assert((rosters.get(club.id) || []).length >= 4, `${club.name} keeps its named core`);
const counts = {};
for (const player of world.players) if (player.status === 'active') counts[player.rarity] = (counts[player.rarity] || 0) + 1;
assert(counts.generational <= 3 && counts.legend <= 15 && counts.epic <= 50, 'rarity caps hold');
for (const coach of world.coaches.filter((item) => item.status !== 'retired')) {
  const formations = getCoachFormations(world, coach.id);
  assert(FORMATIONS[formations.primary] && FORMATIONS[formations.secondary] && formations.primary !== formations.secondary);
  assert(formationChoicesForStyle(coach.profile).some(([id]) => id === formations.primary), 'formation follows tactical style');
}
for (const club of topFlight.slice(0, 120)) {
  const view = getTeamSquadView(world, club.id, false);
  assert.equal(view.xi.length, 11);
  assert.equal(view.bench.length, 4);
  assert.equal(view.xi.filter((row) => row.slotType === 'GK').length, 1);
  assert(view.fit >= 30 && view.fit <= 100);
  assert(view.xi.every((row) => row.playerId), 'top-flight XIs are fully named');
}
const summaryClub = world.clubs.find((club) => club.tier === 'summary');
const summaryView = getTeamSquadView(world, summaryClub.id, false);
assert.equal(summaryView.xi.length + summaryView.bench.length, 15, 'condensed clubs are completed by depth ratings');
assert(summaryView.xi.some((row) => row.depth));
const nationView = getTeamSquadView(world, 'bra', true);
assert.equal(nationView.xi.length, 11);
assert.equal(nationView.bench.length, 4);

// Starting depth per tier.
const depthRow = (clubs) => {
  const views = clubs.map((club) => getTeamSquadView(world, club.id, false));
  const avg = (rows) => rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : 0;
  return { clubs: clubs.length, xi: Number(avg(views.flatMap((v) => v.xi)).toFixed(1)), bench: Number(avg(views.flatMap((v) => v.bench)).toFixed(1)) };
};
const elite = topFlight.filter((club) => club.reputation >= 88);
const middle = topFlight.filter((club) => club.reputation >= 66 && club.reputation < 76);
const condensed = world.clubs.filter((club) => club.tier === 'summary');
report.depth = { elite: depthRow(elite), topFlightMiddle: depthRow(middle), condensed: depthRow(condensed) };
assert(report.depth.elite.xi > report.depth.topFlightMiddle.xi + 5, 'elite XIs are clearly stronger');
assert(report.depth.elite.bench < report.depth.elite.xi, 'benches sit below the XI');
assert(report.depth.topFlightMiddle.bench < report.depth.topFlightMiddle.xi);
report.payroll = { maxPressure: Number(Math.max(...world.clubs.map((club) => club.payrollPressureRatio || 0)).toFixed(2)) };

// --- Seasons keep running and squads stay sane ------------------------------------
simulateToSeasonEnd(world);
startNextSeason(world);
const sizes = new Map();
for (const player of world.players) if (player.status === 'active' && player.clubId) sizes.set(player.clubId, (sizes.get(player.clubId) || 0) + 1);
const topSizes = world.clubs.filter((club) => club.tier === 'detailed' && club.division === 1).map((club) => sizes.get(club.id) || 0);
assert(Math.min(...topSizes) >= 15 && Math.max(...topSizes) <= 18, `top-flight squads stay between 15 and 18 (${Math.min(...topSizes)}–${Math.max(...topSizes)})`);
const after = {};
for (const player of world.players) if (player.status === 'active') after[player.rarity] = (after[player.rarity] || 0) + 1;
assert(after.generational <= 3 && after.legend <= 15 && after.epic <= 50, 'rarity caps hold after an offseason');
report.secondSeason = { transfers: world.current.transfers.length, squadSizes: [Math.min(...topSizes), Math.max(...topSizes)], rarities: after };

// --- Old saves (data revision 25) upgrade and keep playing ------------------------
const old = legacy.createWorld(26002);
legacy.simulateWeeks(old, 6);
const oldSave = JSON.parse(JSON.stringify(old));
assert.equal(oldSave.dataRevision, 25);
const oldPressure = new Map(oldSave.clubs.map((club) => [club.id, club.payrollPressureRatio || 1]));
const oldTarget = oldSave.targetActivePlayers;
const upgraded = upgradeWorld(oldSave);
assert(upgraded.dataRevision >= 26);
assert(upgraded.coaches.every((coach) => FORMATIONS[coach.formation]));
const upgradedSizes = new Map();
for (const player of upgraded.players) if (player.status === 'active' && player.clubId) upgradedSizes.set(player.clubId, (upgradedSizes.get(player.clubId) || 0) + 1);
for (const club of upgraded.clubs.filter((item) => item.tier === 'detailed' && item.division === 1)) {
  assert(upgradedSizes.get(club.id) >= 15, `${club.name} upgraded to 15`);
  assert((club.payrollPressureRatio || 1) <= (oldPressure.get(club.id) || 1) + 0.05, 'payroll anchors grow with the squad');
}
assert(upgraded.targetActivePlayers > oldTarget);
simulateWeeks(upgraded, 4);
simulateToSeasonEnd(upgraded);
assert(upgraded.current.completed);
startNextSeason(upgraded);
simulateWeeks(upgraded, 3);
const finished = legacy.createWorld(26003);
legacy.simulateToSeasonEnd(finished);
const finishedSave = upgradeWorld(JSON.parse(JSON.stringify(finished)));
assert(finishedSave.current.completed && finishedSave.current.postseason.prepared, 'a save waiting in the postseason upgrades in place');
startNextSeason(finishedSave);
simulateWeeks(finishedSave, 2);
report.migration = { addedPlayers: upgraded.targetActivePlayers - oldTarget, resumedWeek: upgraded.current.week, postseasonSaveResumed: finishedSave.current.week };

console.log(JSON.stringify({ ...report, passed: true }, null, 2));
