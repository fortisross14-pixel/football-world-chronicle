import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createWorld } from '../src/engine.js';
import { playerPortrait, coachPortrait, competitionEmblem, getFacePoolCounts } from '../src/visuals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const state = createWorld(2920);
const cssSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.equal(packageJson.version, '2.92.0');
assert(appSource.includes("const APP_VERSION = '2.92'"), 'APP_VERSION not bumped to 2.92');
assert(cssSource.includes('v2.92 AVATAR REPLACEMENT + IMAGE HEADER PASS'), 'v2.92 style marker missing');
assert(appSource.includes('fwc-topbar-lockup.png'), 'topbar image asset not wired');
assert(appSource.includes('player-profile-ribbon.png'), 'player ribbon not wired');
assert(appSource.includes('coach-profile-ribbon.png'), 'coach ribbon not wired');

const counts = getFacePoolCounts();
assert.deepEqual(counts, {
  player: { elite: 160, generic: 40, total: 200 },
  coach: { elite: 40, generic: 10, total: 50 }
});

for (let i = 0; i < 200; i += 1) {
  const file = path.join(root, 'assets', 'faces', 'players', `p${String(i).padStart(3, '0')}.webp`);
  assert(fs.existsSync(file), `missing player face file ${i}`);
}
for (let i = 0; i < 50; i += 1) {
  const file = path.join(root, 'assets', 'faces', 'coaches', `c${String(i).padStart(3, '0')}.webp`);
  assert(fs.existsSync(file), `missing coach face file ${i}`);
}
for (const file of ['fwc-topbar-lockup.png','player-profile-ribbon.png','coach-profile-ribbon.png']) {
  assert(fs.existsSync(path.join(root, 'assets', 'ui', file)), `missing UI asset ${file}`);
}
const samplePlayer = state.players.find((entry) => ['legend','epic','generational'].includes(entry.rarity));
const sampleCoach = state.coaches.find((entry) => ['legend','epic','generational'].includes(entry.rarity));
assert(samplePlayer && sampleCoach, 'sample elite entities missing');
assert(playerPortrait(samplePlayer, samplePlayer.nationalityName || samplePlayer.nationality, 'xl').includes('assets/faces/players/'));
assert(coachPortrait(sampleCoach, sampleCoach.nationalityName || sampleCoach.nationality, 'xl').includes('assets/faces/coaches/'));
assert(competitionEmblem('UCL', 'md').includes('<svg'));
console.log(JSON.stringify({
  version: packageJson.version,
  playerFaces: 200,
  coachFaces: 50,
  activePlayers: state.players.filter((p) => p.status === 'active').length,
  activeCoaches: state.coaches.filter((c) => c.status !== 'retired').length
}, null, 2));
