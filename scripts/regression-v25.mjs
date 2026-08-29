import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd, startNextSeason } from '../src/engine.js';
import { COUNTRY_META } from '../src/data.js';

const world = createWorld(250025);
assert.equal(world.dataRevision, 17);
assert.ok(world.players.every((p) => p.careerLength >= 12 && p.careerLength <= 22));
assert.ok(world.players.every((p) => [17,18].includes(p.debutAge)));

// Initial geography: almost all players should be domestic or at least in their origin continent.
const geography = world.players.filter((p)=>p.status==='active' && p.clubId).map((p)=>{
  const club = world.clubs.find((c)=>c.id===p.clubId);
  const origin = Object.values(COUNTRY_META).find((m)=>m.code===p.nationality);
  return { domestic: club?.country && COUNTRY_META[club.country]?.code === p.nationality, sameContinent: club?.confederation === origin?.region };
});
const domestic = geography.filter((r)=>r.domestic).length / geography.length;
const continent = geography.filter((r)=>r.sameContinent).length / geography.length;
assert.ok(domestic >= 0.84, `domestic=${domestic}`);
assert.ok(continent >= 0.98, `sameContinent=${continent}`);

// Prime superstar at Sporting should actively seek an elite destination unless the club has
// major continental success. We create a clean transfer test with enough buyer liquidity.
const star = world.players.find((p)=>p.rarity==='generational' && p.position!=='GK');
const sporting = world.clubs.find((c)=>c.id==='sporting');
assert.ok(star && sporting);
star.clubId = sporting.id;
star.transferProtectedUntilSeason = null;
star.careerYear = 5;
star.debutAge = 17;
star.birthYear = world.season - 22;
star.baseQuality = 99;
star.rating = 99;
star.happiness = 82;
star.contractYears = 3;
for (const club of world.clubs.filter((c)=>c.confederation==='Europe' && c.reputation>=88)) {
  club.finances = Math.max(club.finances, 800);
  club.transferBudget = Math.max(club.transferBudget, 350);
  club.wageBudget = Math.max(club.wageBudget, 50);
}
world.history.honours = world.history.honours.filter((h)=>h.playerId!==star.id);
world.history.awards = world.history.awards.filter((a)=>a.playerId!==star.id);
world.current.completed = true;
startNextSeason(world);
const newClub = world.clubs.find((c)=>c.id===star.clubId);
assert.ok(newClub, 'superstar should remain employed');
assert.notEqual(newClub.id, sporting.id, `prime superstar remained at Sporting (${star.happiness}, ${star.marketValue})`);
assert.equal(newClub.confederation, 'Europe');
assert.ok(newClub.reputation >= 88 || newClub.strength >= 88, `destination too weak: ${newClub.name}`);

// Offseason has the data needed by all five tabs.
assert.ok(world.current.offseason);
for (const key of ['transfers','coachMoves','retirements','newStars','ownerChanges','freeAgentSignings']) assert.ok(Array.isArray(world.current.offseason[key]), key);
assert.ok(world.current.offseason.transfers.every((t)=>Object.hasOwn(t,'marketValue')));

// Future rookie geography after a real season rollover.
const future = createWorld(250026);
simulateToSeasonEnd(future);
startNextSeason(future);
const newbies = (future.current.offseason.newStars || []).map((r)=>future.players.find((p)=>p.id===r.playerId)).filter(Boolean);
for (const p of newbies) {
  if (!p.clubId) continue;
  const club = future.clubs.find((c)=>c.id===p.clubId);
  const origin = Object.values(COUNTRY_META).find((m)=>m.code===p.nationality);
  assert.ok(club?.country === Object.keys(COUNTRY_META).find((name)=>COUNTRY_META[name].code===p.nationality) || club?.confederation === origin?.region,
    `${p.name} (${origin?.region}) spawned at ${club?.name} (${club?.confederation})`);
}

console.log(JSON.stringify({
  careerRange:[Math.min(...world.players.map(p=>p.careerLength)),Math.max(...world.players.map(p=>p.careerLength))],
  domesticPct:Number((domestic*100).toFixed(1)),
  sameContinentPct:Number((continent*100).toFixed(1)),
  superstarMove:{from:'Sporting CP',to:newClub.name,rating:star.rating,value:star.marketValue,happiness:star.happiness},
  offseason:{transfers:world.current.offseason.transfers.length,coachMoves:world.current.offseason.coachMoves.length,newStars:world.current.offseason.newStars.length}
},null,2));
