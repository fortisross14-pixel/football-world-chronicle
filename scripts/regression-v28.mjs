import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createWorld } from '../src/engine.js';
import { playerPortrait, coachPortrait, clubLogoUrls } from '../src/visuals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const state = createWorld(2803);

function portraitIndex(html) {
  const match = html.match(/data-avatar-pool="(\d+)"/);
  assert(match, 'portrait is missing data-avatar-pool');
  return Number(match[1]);
}

const sampledPlayers = state.players.filter((player) => player.status === 'active').slice(0, 1200);
const sampledCoaches = (state.coaches || []).slice(0, 600);
const playerIndexes = sampledPlayers.map((player) => portraitIndex(playerPortrait(player, player.nationalityName || player.nationality, 'sm')));
const coachIndexes = sampledCoaches.map((coach) => portraitIndex(coachPortrait(coach, coach.nationalityName || coach.nationality, 'sm')));
assert(Math.max(...playerIndexes) < 84, 'player portraits should use canonical identity indexes only');
assert(Math.max(...coachIndexes) < 20, 'coach portraits should use canonical identity indexes only');
assert(new Set(playerIndexes).size >= 45, 'player portrait distribution is unexpectedly narrow');
assert(new Set(coachIndexes).size >= 15, 'coach portrait distribution is unexpectedly narrow');

for (let index = 0; index < 84; index += 1) {
  assert(fs.existsSync(path.join(root, 'assets', 'faces', 'players', `p${String(index).padStart(3, '0')}.webp`)), `missing canonical player face ${index}`);
}
for (let index = 0; index < 20; index += 1) {
  assert(fs.existsSync(path.join(root, 'assets', 'faces', 'coaches', `c${String(index).padStart(3, '0')}.webp`)), `missing canonical coach face ${index}`);
}

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
assert(appSource.includes("const APP_VERSION = '0.28.3'"), 'app version marker is stale');
assert(appSource.includes("[data-face-image]"), 'portrait error fallback is not bound');
assert(visualSource.includes('CANONICAL_FACE_COUNTS'), 'canonical face identity guard is missing');
assert(cssSource.includes('v0.28.3 POLISH PASS'), 'polish CSS patch is missing');
assert(cssSource.includes('.competition-tabs { top:108px; }'), 'mobile sticky tab offset regression');

console.log(JSON.stringify({
  version: '0.28.3',
  sampledPlayers: sampledPlayers.length,
  distinctPlayerFacesInSample: new Set(playerIndexes).size,
  sampledCoaches: sampledCoaches.length,
  distinctCoachFacesInSample: new Set(coachIndexes).size,
  topBadgeCoverage: ['Galatasaray', 'Fenerbahçe', 'Beşiktaş', 'Trabzonspor', 'Celtic', 'Rangers', 'Bayern Munich', 'Inter']
}, null, 2));
