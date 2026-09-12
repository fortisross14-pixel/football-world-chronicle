import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { getFacePoolCounts } from '../src/visuals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
assert.equal(pkg.version, '2.96.0');
assert(app.includes("const APP_VERSION = '2.96'"));
for (const helper of ['const statCard =', 'function favoriteButton(', 'function entityTabs(', 'function matchRow(', 'function leaders(', 'function tabs(']) {
  assert(app.includes(helper), `missing critical UI helper: ${helper}`);
}
assert(!app.includes('fwc-topbar-lockup.png'), 'experimental topbar image still referenced');
assert(!app.includes('player-profile-ribbon.png'), 'experimental player ribbon image still referenced');
assert(!app.includes('coach-profile-ribbon.png'), 'experimental coach ribbon image still referenced');
assert.deepEqual(getFacePoolCounts(), {
  player: { elite: 160, generic: 40, total: 200 },
  coach: { elite: 40, generic: 10, total: 50 }
});
console.log(JSON.stringify({version: pkg.version, criticalUiHelpers: 6, facePools: 'ok'}, null, 2));
