import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createWorld } from '../src/engine.js';
import { playerPortrait, coachPortrait, clubLogoUrls, getFacePoolCounts, getFacePoolPlan } from '../src/visuals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const state = createWorld(2900);

function portraitIndex(html) {
  const match = html.match(/data-avatar-pool="(\d+)"/);
  assert(match, 'portrait is missing data-avatar-pool');
  return Number(match[1]);
}

const counts = getFacePoolCounts();
assert.deepEqual(counts, {
  player: { elite: 160, generic: 40, total: 200 },
  coach: { elite: 40, generic: 10, total: 50 }
}, 'face pool counts drifted');

const plan = getFacePoolPlan();
const genericPlayers = new Set(Object.values(plan.genericPlayerGroups).flat());
const elitePlayers = new Set(Object.values(plan.elitePlayerGroups).flat());
const genericCoaches = new Set(Object.values(plan.genericCoachGroups).flat());
const eliteCoaches = new Set(Object.values(plan.eliteCoachGroups).flat());

assert.equal(genericPlayers.size, 40, 'generic player pool should contain 40 unique portraits');
assert.equal(elitePlayers.size, 160, 'elite player pool should contain 160 unique portraits');
assert.equal(genericCoaches.size, 10, 'generic coach pool should contain 10 unique portraits');
assert.equal(eliteCoaches.size, 40, 'elite coach pool should contain 40 unique portraits');
for (const index of genericPlayers) assert(!elitePlayers.has(index), `generic player face ${index} leaked into elite pool`);
for (const index of genericCoaches) assert(!eliteCoaches.has(index), `generic coach face ${index} leaked into elite pool`);

for (let i = 0; i < 200; i += 1) {
  const file = path.join(root, 'assets', 'faces', 'players', `p${String(i).padStart(3, '0')}.webp`);
  assert(fs.existsSync(file), `missing player face file ${i}`);
}
for (let i = 0; i < 50; i += 1) {
  const file = path.join(root, 'assets', 'faces', 'coaches', `c${String(i).padStart(3, '0')}.webp`);
  assert(fs.existsSync(file), `missing coach face file ${i}`);
}

const activePlayers = state.players.filter((player) => player.status === 'active').slice(0, 1800);
const coaches = (state.coaches || []).slice(0, 900);
const elitePlayerIndexes = activePlayers.filter((p) => ['generational','legend','epic'].includes(p.rarity)).map((p) => portraitIndex(playerPortrait(p, p.nationalityName || p.nationality, 'sm')));
const regularPlayerIndexes = activePlayers.filter((p) => !['generational','legend','epic'].includes(p.rarity)).map((p) => portraitIndex(playerPortrait(p, p.nationalityName || p.nationality, 'sm')));
const eliteCoachIndexes = coaches.filter((c) => ['generational','legend','epic'].includes(c.rarity)).map((c) => portraitIndex(coachPortrait(c, c.nationalityName || c.nationality, 'sm')));
const regularCoachIndexes = coaches.filter((c) => !['generational','legend','epic'].includes(c.rarity)).map((c) => portraitIndex(coachPortrait(c, c.nationalityName || c.nationality, 'sm')));
for (const idx of elitePlayerIndexes) assert(elitePlayers.has(idx), `elite player routed to non-elite face ${idx}`);
for (const idx of regularPlayerIndexes) assert(genericPlayers.has(idx), `regular player routed to non-generic face ${idx}`);
for (const idx of eliteCoachIndexes) assert(eliteCoaches.has(idx), `elite coach routed to non-elite face ${idx}`);
for (const idx of regularCoachIndexes) assert(genericCoaches.has(idx), `regular coach routed to non-generic face ${idx}`);
assert(new Set(elitePlayerIndexes).size >= 35, 'elite player distribution unexpectedly narrow');
assert(new Set(regularPlayerIndexes).size >= 20, 'generic player distribution unexpectedly narrow');
assert(new Set(eliteCoachIndexes).size >= 12, 'elite coach distribution unexpectedly narrow');
assert(new Set(regularCoachIndexes).size >= 6, 'generic coach distribution unexpectedly narrow');

const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
assert(appSource.includes("const APP_VERSION = '2.90'"), 'app version marker stale');
assert(cssSource.includes('v2.90 PHASE 1 FACE REBUILD'), 'v2.90 style marker missing');
assert(cssSource.includes('--avatar-bg'), 'avatar rarity background styling missing');

const badgeExpectations = {
  'Galatasaray': '/turkiye/galatasaray.png',
  'Fenerbahçe': '/turkiye/fenerbahce.png',
  'Beşiktaş': '/turkiye/besiktas-jk.png',
  'Trabzonspor': '/turkiye/trabzonspor.png'
};
for (const [clubName, expectedPath] of Object.entries(badgeExpectations)) {
  const club = state.clubs.find((item) => item.name === clubName);
  assert(club, `missing test club ${clubName}`);
  const urls = clubLogoUrls(club);
  assert(urls.some((url) => url.includes(expectedPath)), `${clubName} should include ${expectedPath}`);
}

console.log(JSON.stringify({
  version: '2.90',
  counts,
  sampledDistinctElitePlayers: new Set(elitePlayerIndexes).size,
  sampledDistinctRegularPlayers: new Set(regularPlayerIndexes).size,
  sampledDistinctEliteCoaches: new Set(eliteCoachIndexes).size,
  sampledDistinctRegularCoaches: new Set(regularCoachIndexes).size
}, null, 2));
