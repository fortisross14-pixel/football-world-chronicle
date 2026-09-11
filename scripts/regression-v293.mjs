import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createWorld } from '../src/engine.js';
import { getFacePoolCounts, playerPortrait, coachPortrait } from '../src/visuals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const state = createWorld(2930);

assert.equal(packageJson.version, '2.93.0');
assert(appSource.includes("const APP_VERSION = '2.93'"), 'APP_VERSION not bumped to 2.93');
assert.deepEqual(getFacePoolCounts(), {
  player: { elite: 160, generic: 40, total: 200 },
  coach: { elite: 40, generic: 10, total: 50 }
});
for (let i = 0; i < 200; i += 1) assert(fs.existsSync(path.join(root, 'assets', 'faces', 'players', `p${String(i).padStart(3,'0')}.webp`)), `missing player face ${i}`);
for (let i = 0; i < 50; i += 1) assert(fs.existsSync(path.join(root, 'assets', 'faces', 'coaches', `c${String(i).padStart(3,'0')}.webp`)), `missing coach face ${i}`);
const p = state.players.find((entry) => ['legend','generational','epic'].includes(entry.rarity));
const c = state.coaches.find((entry) => ['legend','generational','epic'].includes(entry.rarity));
assert(p && c, 'sample entities missing');
assert(playerPortrait(p, p.nationalityName || p.nationality, 'xl').includes('assets/faces/players/'));
assert(coachPortrait(c, c.nationalityName || c.nationality, 'xl').includes('assets/faces/coaches/'));
console.log(JSON.stringify({ version: packageJson.version, activePlayers: state.players.filter((row)=>row.status==='active').length, activeCoaches: state.coaches.filter((row)=>row.status!=='retired').length, playerFaces: 200, coachFaces: 50 }, null, 2));
