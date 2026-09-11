import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createWorld } from '../src/engine.js';
import { competitionEmblem, playerPortrait, coachPortrait, getFacePoolCounts } from '../src/visuals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const state = createWorld(2910);
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.equal(packageJson.version, '2.91.0');
assert(appSource.includes("const APP_VERSION = '2.91'"), 'APP_VERSION not bumped to 2.91');
assert(cssSource.includes('v2.91 PHASE 2 + 3 PREMIUM UI / EMBLEM PASS'), 'phase 2/3 style marker missing');
assert(appSource.includes('topbar-branding'), 'premium topbar markup missing');
assert(appSource.includes('follow-star'), 'follow button premium markup missing');

const counts = getFacePoolCounts();
assert.deepEqual(counts, {
  player: { elite: 160, generic: 40, total: 200 },
  coach: { elite: 40, generic: 10, total: 50 }
});

const emblems = ['UCL','UEL','UECL','LIB','WC','CWC','EURO','COPA','CUP-EPL','SC-EPL','UNKNOWN'].map((id) => competitionEmblem(id, 'md'));
for (const html of emblems) {
  assert(html.includes('<svg'), `competition emblem should render svg for ${html}`);
  assert(/competition-emblem-md/.test(html), 'emblem size class missing');
}

const player = state.players.find((entry) => ['generational','legend','epic'].includes(entry.rarity));
const coach = state.coaches.find((entry) => ['generational','legend','epic'].includes(entry.rarity));
assert(player && coach, 'sample elite people missing');
assert(playerPortrait(player, player.nationalityName || player.nationality, 'xl').includes('assets/faces/players/'), 'player portrait broken');
assert(coachPortrait(coach, coach.nationalityName || coach.nationality, 'xl').includes('assets/faces/coaches/'), 'coach portrait broken');

console.log(JSON.stringify({
  version: packageJson.version,
  activePlayers: state.players.filter((p) => p.status === 'active').length,
  activeCoaches: state.coaches.filter((c) => c.status !== 'retired').length,
  checkedEmblems: emblems.length
}, null, 2));
