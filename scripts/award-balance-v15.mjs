import { createWorld, simulateToSeasonEnd } from '../src/engine.js';
const world = createWorld(246813579);
simulateToSeasonEnd(world);
const season = world.season;
const awards = world.history.awards.filter((a)=>a.season===season);
const mvps = awards.filter((a)=>a.category==='mvp');
let pairs=0, same=0;
for (const mvp of mvps) {
 const scorer=awards.find((a)=>a.competitionId===mvp.competitionId && a.category==='top_scorer');
 if (!scorer) continue; pairs++; if (scorer.playerId===mvp.playerId) same++;
}
const bd=awards.filter((a)=>a.category==='ballon_dor').sort((a,b)=>a.rank-b.rank).map(a=>a.playerId);
const gb=awards.filter((a)=>a.category==='golden_boot').sort((a,b)=>a.rank-b.rank).map(a=>a.playerId);
const podiumOverlap=bd.filter(id=>gb.includes(id)).length;
console.log(JSON.stringify({season,pairs,same,rate:Number((same/Math.max(1,pairs)).toFixed(3)),ballonGoldenPodiumOverlap:podiumOverlap,sameFullPodium:bd.length===3&&bd.every((id,i)=>id===gb[i])},null,2));
if (same/pairs > .30 || podiumOverlap===3) process.exitCode=2;
