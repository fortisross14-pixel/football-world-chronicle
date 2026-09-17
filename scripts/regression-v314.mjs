import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REAL_WORLD_STARS } from '../src/real-stars.js';
import { playerPortrait, getHistoricalPortraitPlan } from '../src/visuals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/faces/historical/manifest.json'), 'utf8'));

assert.equal(pkg.version, '3.14.0');
assert(app.includes("const APP_VERSION = '3.14'"));
assert(css.includes('v3.14 curated historical icon portraits'));
const generational = REAL_WORLD_STARS.filter((row) => row.rarity === 'generational');
const legends = REAL_WORLD_STARS.filter((row) => row.rarity === 'legend');
const curatedEpics = REAL_WORLD_STARS.filter((row) => row.rarity === 'epic' && Object.hasOwn(manifest, row.id));
assert.equal(generational.length, 16);
assert.equal(legends.length, 69);
assert.equal(curatedEpics.length, 12);
for (const star of [...generational, ...legends, ...curatedEpics]) {
  assert(Object.hasOwn(manifest, star.id), `${star.id} missing historical portrait manifest entry`);
  assert(fs.existsSync(path.join(root, 'assets/faces/historical', `${star.id}.webp`)), `${star.id} historical portrait missing`);
  const fakePlayer = { id: `test-${star.id}`, name: star.name, rarity: star.rarity, realWorldId: star.id, nationality: star.nationality };
  const html = playerPortrait(fakePlayer, 'xl');
  assert(html.includes(`assets/faces/historical/${star.id}.webp`), `${star.id} did not route to historical portrait`);
  assert(html.includes('historical-avatar'), `${star.id} missing historical-avatar class`);
}
const fictional = { id: 'fictional-elite', name: 'Fictional Star', rarity: 'legend', nationality: 'esp' };
const fictionalHtml = playerPortrait(fictional, 'xl');
assert(fictionalHtml.includes('assets/faces/players/'), 'fictional elite should still use existing face pool');
assert(!fictionalHtml.includes('historical-avatar'), 'fictional elite should not be marked historical');
const uncuratedEpic = REAL_WORLD_STARS.find((row) => row.rarity === 'epic' && !Object.hasOwn(manifest, row.id));
assert(uncuratedEpic, 'expected at least one uncurated Epic for fallback test');
const uncuratedHtml = playerPortrait({ id:'test-epic', name:uncuratedEpic.name, rarity:'epic', nationality:uncuratedEpic.nationality, realWorldId:uncuratedEpic.id }, 'xl');
assert(uncuratedHtml.includes('assets/faces/players/'), 'not-yet-curated Epic should retain elite pool fallback');
const plan = getHistoricalPortraitPlan();
assert.equal(plan.total, 97);
console.log(JSON.stringify({ version: pkg.version, generational: generational.length, legends: legends.length, curatedEpics: curatedEpics.length, totalOverrides: plan.total, fictionalPoolPreserved: true }, null, 2));
