import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createWorld } from '../src/engine.js';
import { playerPortrait, coachPortrait, clubLogoUrls, getFacePoolCounts, getFacePoolPlan } from '../src/visuals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const state = createWorld(2805);

function portraitIndex(html) {
  const match = html.match(/data-avatar-pool="(\d+)"/);
  assert(match, 'portrait is missing data-avatar-pool');
  return Number(match[1]);
}

const poolCounts = getFacePoolCounts();
assert.deepEqual(poolCounts, {
  player: { elite: 168, generic: 24, total: 192 },
  coach: { elite: 40, generic: 12, total: 52 }
}, 'face pool counts drifted');

const poolPlan = getFacePoolPlan();
const genericPlayerFlat = Object.values(poolPlan.genericPlayerGroups).flat();
const elitePlayerFlat = Object.values(poolPlan.elitePlayerGroups).flat();
const genericCoachFlat = Object.values(poolPlan.genericCoachGroups).flat();
const eliteCoachFlat = Object.values(poolPlan.eliteCoachGroups).flat();

assert.equal(new Set(genericPlayerFlat).size, 24, 'generic player pool should contain 24 unique indexes');
assert.equal(new Set(elitePlayerFlat).size, 168, 'elite player pool should contain 168 unique indexes');
assert.equal(new Set(genericCoachFlat).size, 12, 'generic coach pool should contain 12 unique indexes');
assert.equal(new Set(eliteCoachFlat).size, 40, 'elite coach pool should contain 40 unique indexes');
for (const idx of genericPlayerFlat) assert(!elitePlayerFlat.includes(idx), `generic player face ${idx} leaked into elite pool`);
for (const idx of genericCoachFlat) assert(!eliteCoachFlat.includes(idx), `generic coach face ${idx} leaked into elite pool`);

for (let index = 0; index < 192; index += 1) {
  assert(fs.existsSync(path.join(root, 'assets', 'faces', 'players', `p${String(index).padStart(3, '0')}.webp`)), `missing player face ${index}`);
}
for (let index = 0; index < 52; index += 1) {
  assert(fs.existsSync(path.join(root, 'assets', 'faces', 'coaches', `c${String(index).padStart(3, '0')}.webp`)), `missing coach face ${index}`);
}

// Verify rarity routing: elite rarities never use generic pools and vice versa.
const sampledPlayers = state.players.filter((player) => player.status === 'active').slice(0, 1500);
const sampledCoaches = (state.coaches || []).slice(0, 800);
const elitePlayerIndexes = sampledPlayers
  .filter((player) => ['generational', 'legend', 'epic'].includes(player.rarity))
  .map((player) => portraitIndex(playerPortrait(player, player.nationalityName || player.nationality, 'sm')));
const regularPlayerIndexes = sampledPlayers
  .filter((player) => ['rare', 'uncommon', 'common'].includes(player.rarity))
  .map((player) => portraitIndex(playerPortrait(player, player.nationalityName || player.nationality, 'sm')));
const eliteCoachIndexes = sampledCoaches
  .filter((coach) => ['generational', 'legend', 'epic'].includes(coach.rarity))
  .map((coach) => portraitIndex(coachPortrait(coach, coach.nationalityName || coach.nationality, 'sm')));
const regularCoachIndexes = sampledCoaches
  .filter((coach) => !['generational', 'legend', 'epic'].includes(coach.rarity))
  .map((coach) => portraitIndex(coachPortrait(coach, coach.nationalityName || coach.nationality, 'sm')));

const genericPlayerSet = new Set(genericPlayerFlat);
const elitePlayerSet = new Set(elitePlayerFlat);
const genericCoachSet = new Set(genericCoachFlat);
const eliteCoachSet = new Set(eliteCoachFlat);
for (const idx of elitePlayerIndexes) assert(elitePlayerSet.has(idx), `elite player routed to non-elite face ${idx}`);
for (const idx of regularPlayerIndexes) assert(genericPlayerSet.has(idx), `regular player routed to non-generic face ${idx}`);
for (const idx of eliteCoachIndexes) assert(eliteCoachSet.has(idx), `elite coach routed to non-elite face ${idx}`);
for (const idx of regularCoachIndexes) assert(genericCoachSet.has(idx), `regular coach routed to non-generic face ${idx}`);

assert(new Set(elitePlayerIndexes).size >= 35, 'elite player distribution is unexpectedly narrow');
assert(new Set(regularPlayerIndexes).size >= 10, 'generic player pool is not being used broadly enough');
assert(new Set(eliteCoachIndexes).size >= 18, 'elite coach distribution is unexpectedly narrow');
assert(new Set(regularCoachIndexes).size >= 6, 'generic coach pool is not being used broadly enough');

const badgeExpectations = {
  'Galatasaray': '/turkiye/galatasaray.png',
  'Fenerbahçe': '/turkiye/fenerbahce.png',
  'Beşiktaş': '/turkiye/besiktas-jk.png',
  'Trabzonspor': '/turkiye/trabzonspor.png',
  'Celtic': '/scotland/celtic-fc.png',
  'Rangers': '/scotland/rangers-fc.png'
};
for (const [clubName, expectedPath] of Object.entries(badgeExpectations)) {
  const club = state.clubs.find((item) => item.name === clubName);
  assert(club, `missing test club ${clubName}`);
  const urls = clubLogoUrls(club);
  assert(urls.some((url) => url.includes(expectedPath)), `${clubName} should include verified CDN path ${expectedPath}`);
}
for (const clubName of ['Bayern Munich', 'Inter']) {
  const club = state.clubs.find((item) => item.name === clubName);
  assert(clubLogoUrls(club).length > 0, `${clubName} should have at least one badge source`);
}

const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const visualSource = fs.readFileSync(path.join(root, 'src', 'visuals.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
assert(appSource.includes("const APP_VERSION = '0.28.5'"), 'app version marker is stale');
assert(visualSource.includes('GENERIC_PLAYER_GROUPS'), 'generic player pool definition is missing');
assert(visualSource.includes('ELITE_PLAYER_GROUPS'), 'elite player pool definition is missing');
assert(cssSource.includes('v0.28.5 ELITE/GENERIC FACE SPLIT'), 'face split CSS patch marker is missing');
assert(cssSource.includes('.competition-tabs { top:108px; }'), 'mobile sticky tab offset regression');

console.log(JSON.stringify({
  version: '0.28.5',
  poolCounts,
  distinctElitePlayersInSample: new Set(elitePlayerIndexes).size,
  distinctRegularPlayersInSample: new Set(regularPlayerIndexes).size,
  distinctEliteCoachesInSample: new Set(eliteCoachIndexes).size,
  distinctRegularCoachesInSample: new Set(regularCoachIndexes).size
}, null, 2));
