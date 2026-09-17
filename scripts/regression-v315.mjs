import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { REAL_WORLD_STARS, REAL_WORLD_STAR_COUNTS } from '../src/real-stars.js';
import { playerPortrait, getHistoricalPortraitPlan } from '../src/visuals.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
assert.equal(pkg.version,'3.15.0');
assert.deepEqual(REAL_WORLD_STAR_COUNTS,{generational:16,legend:69,epic:120});
assert.equal(REAL_WORLD_STARS.length,205);
const plan=getHistoricalPortraitPlan();
assert.equal(plan.total,205);
const ids=new Set(plan.ids);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/faces/historical/manifest.json'),'utf8'));
assert.equal(Object.keys(manifest).length,205);
for(const star of REAL_WORLD_STARS){
  assert(ids.has(star.id),`historical router missing ${star.id}`);
  assert(manifest[star.id],`manifest missing ${star.id}`);
  const file=path.join(root,'assets/faces/historical',`${star.id}.webp`);
  assert(fs.existsSync(file),`portrait file missing ${star.id}`);
  const html=playerPortrait({id:`test-${star.id}`,name:star.name,rarity:star.rarity,realWorldId:star.id},star.nationality,'xl');
  assert(html.includes(`assets/faces/historical/${star.id}.webp`),`router did not use historical file for ${star.id}`);
}
const fictional=playerPortrait({id:'fictional-legend-1',name:'A Fictional Legend',rarity:'legend'},'Spain','xl');
assert(fictional.includes('assets/faces/players/'),'fictional elite no longer falls back to player face pool');
console.log(JSON.stringify({version:pkg.version,totalHistorical:plan.total,rarities:REAL_WORLD_STAR_COUNTS,fictionalFallback:true},null,2));
