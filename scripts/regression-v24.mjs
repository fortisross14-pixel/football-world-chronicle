import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd, startNextSeason, upgradeWorld } from '../src/engine.js';

const world = createWorld(424242);
assert.equal(world.dataRevision, 16);
assert.equal(world.current.seasonLabel, 'Year 1');

const nationalById = new Map(world.nationalTeams.map((team) => [team.id, team]));
const lower = world.players.filter((player) => player.status === 'active' && player.clubId && ['common','uncommon','rare'].includes(player.rarity));
const domestic = lower.filter((player) => {
  const club = world.clubs.find((item) => item.id === player.clubId);
  return club?.country === nationalById.get(player.nationality)?.name;
});
const domesticRatio = domestic.length / Math.max(1, lower.length);
assert.ok(domesticRatio >= 0.85, `lower-rarity domestic ratio ${domesticRatio}`);

const primeEliteNationalCoaches = world.nationalTeams.map((team) => world.coaches.find((coach) => coach.id === team.coachId)).filter((coach) => coach && ['generational','legend'].includes(coach.rarity) && (coach.careerYear || 0) < Math.floor((coach.careerLength || 12) * 0.68));
assert.equal(primeEliteNationalCoaches.length, 0);
assert.ok(world.coaches.every((coach) => coach.careerLength >= 8 && coach.careerLength <= 18));

assert.ok(world.clubs.find((club) => club.id === 'man-utd').reputation > world.clubs.find((club) => club.id === 'man-city').reputation);
assert.ok(world.clubs.find((club) => club.id === 'milan').reputation > world.clubs.find((club) => club.id === 'psg').reputation);

simulateToSeasonEnd(world);
startNextSeason(world);
assert.equal(world.current.seasonLabel, 'Year 2');
assert.ok(world.current.offseason);
assert.ok(Array.isArray(world.current.offseason.transfers));
assert.ok(Array.isArray(world.current.offseason.freeAgentSignings));


const mobilityWorld = createWorld(999);
const unproven = mobilityWorld.players.find((player)=>player.rarity==='generational' && player.position !== 'GK');
const almeria = mobilityWorld.clubs.find((club)=>club.name==='Almería');
unproven.clubId = almeria.id; unproven.rating = 100; unproven.baseQuality = 100; unproven.careerYear = 3; unproven.happiness = 83; unproven.contractYears = 4; unproven.transferProtectedUntilSeason = null;
mobilityWorld.history.honours = []; mobilityWorld.history.awards = []; mobilityWorld.history.playerSeasons = []; mobilityWorld.dataRevision = 15;
upgradeWorld(mobilityWorld);
assert.ok(unproven.marketValue >= 55 && unproven.marketValue <= 95, `unproven elite value ${unproven.marketValue}`);
assert.ok(unproven.happiness <= 22, `unproven elite happiness ${unproven.happiness}`);

const eliteTransfers = world.current.transfers.map((move) => ({ move, player: world.players.find((player)=>player.id===move.playerId) })).filter((row)=>row.player && ['generational','legend','epic'].includes(row.player.rarity));
assert.ok(eliteTransfers.length > 0, 'elite transfer market should remain active');

console.log(JSON.stringify({
  yearLabel: world.current.seasonLabel,
  lowerRarityDomesticPct: Number((domesticRatio * 100).toFixed(1)),
  primeLegendGenerationalNationalCoaches: primeEliteNationalCoaches.length,
  coachCareerRange: [Math.min(...world.coaches.map((coach)=>coach.careerLength)), Math.max(...world.coaches.map((coach)=>coach.careerLength))],
  historicalReputation: { manUnited: world.clubs.find((club)=>club.id==='man-utd').reputation, manCity: world.clubs.find((club)=>club.id==='man-city').reputation, milan: world.clubs.find((club)=>club.id==='milan').reputation, psg: world.clubs.find((club)=>club.id==='psg').reputation },
  eliteAtSmallClub: { marketValue: unproven.marketValue, happiness: unproven.happiness },
  offseason: { transfers: world.current.offseason.transfers.length, eliteTransfers: eliteTransfers.length, freeAgentSignings: world.current.offseason.freeAgentSignings.length, newStars: world.current.offseason.newStars.length }
}, null, 2));
