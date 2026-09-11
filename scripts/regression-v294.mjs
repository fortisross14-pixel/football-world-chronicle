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
const styleSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const state = createWorld(2940);

assert.equal(packageJson.version, '2.94.0');
assert(appSource.includes("const APP_VERSION = '2.94'"), 'APP_VERSION not bumped to 2.94');
assert(appSource.includes('sectionMonogram'), 'premium page head helper missing');
assert(styleSource.includes('premium-page-head'), 'premium page-head styles missing');
assert(styleSource.includes('entity-trait-strip'), 'entity trait strip styles missing');
assert(fs.existsSync(path.join(root, 'assets', 'ui', 'page-head-sweep.png')), 'page-head sweep asset missing');
assert(fs.existsSync(path.join(root, 'assets', 'ui', 'section-seal.png')), 'section seal asset missing');
assert.deepEqual(getFacePoolCounts(), {
  player: { elite: 160, generic: 40, total: 200 },
  coach: { elite: 40, generic: 10, total: 50 }
});
const p = state.players.find((entry) => ['legend','generational','epic'].includes(entry.rarity));
const c = state.coaches.find((entry) => ['legend','generational','epic'].includes(entry.rarity));
assert(p && c, 'sample entities missing');
assert(playerPortrait(p, p.nationalityName || p.nationality, 'xl').includes('assets/faces/players/'));
assert(coachPortrait(c, c.nationalityName || c.nationality, 'xl').includes('assets/faces/coaches/'));
console.log(JSON.stringify({ version: packageJson.version, season: state.current.seasonLabel, playerFaces: 200, coachFaces: 50, pageHeadAssets: true }, null, 2));
