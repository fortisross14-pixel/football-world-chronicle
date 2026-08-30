import { createWorld, startNextSeason, getLeagueMarketRankings, getClubFinancialStatus } from '../src/engine.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const state = createWorld(26026);
const club = (id) => state.clubs.find((item) => item.id === id);

const europe = getLeagueMarketRankings(state, 'Europe');
const top4 = europe.slice(0, 4).map((row) => row.country);
assert(['England','Spain','Germany','Italy'].every((country) => top4.includes(country)), `Big Four lost financial hierarchy: ${top4.join(', ')}`);
assert(getClubFinancialStatus(state, 'real-madrid')?.tier === 'S', 'Real Madrid should begin Tier S');
assert(getClubFinancialStatus(state, 'man-city')?.tier === 'T1', 'Manchester City should begin Tier 1');

// Simultaneously test a rising small club, a dormant giant and a stranded Generational.
const riser = state.clubs.find((item) => item.country === 'Spain' && item.division === 1 && item.financialTier === 'R');
const real = club('real-madrid');
for (let i = 0; i < 8; i += 1) {
  const season = state.season - i;
  state.history.clubSeasons.push({ season, seasonLabel:`Year ${i+1}`, leagueId:riser.leagueId, clubId:riser.id, position:i < 3 ? 2 : 5, played:38,wins:20,draws:8,losses:10,gf:60,ga:40,gd:20,points:68 });
  state.history.clubSeasons.push({ season, seasonLabel:`Year ${i+1}`, leagueId:real.leagueId, clubId:real.id, position:9, played:38,wins:12,draws:9,losses:17,gf:45,ga:50,gd:-5,points:45 });
}
state.history.champions.push({season:state.season,competitionId:`CUP-${riser.leagueId}`,winnerId:riser.id,runnerUpId:'sevilla'});
state.history.champions.push({season:state.season-1,competitionId:`CUP-${riser.leagueId}`,winnerId:riser.id,runnerUpId:'valencia'});

const gen = state.players.find((player) => player.rarity === 'generational' && !player.realWorldId) || state.players.find((player) => player.rarity === 'generational');
gen.clubId = 'sporting'; gen.rating = 99; gen.baseQuality = 99; gen.careerYear = 6; gen.birthYear = state.season - 24;
gen.happiness = 75; gen.contractYears = 4; gen.transferProtectedUntilSeason = null;
state.current.completed = true;
startNextSeason(state);

assert(riser.financialTier === 'T2', `Successful small club failed to rise: ${riser.financialTier}`);
assert(real.financialTier === 'T1', `Dormant Tier S club failed to drop: ${real.financialTier}`);
const genClub = club(gen.clubId);
assert(genClub && genClub.id !== 'sporting', 'Prime Generational remained stranded at Sporting');
assert(genClub.confederation === 'Europe' && ['S','T1'].includes(genClub.financialTier), `Prime Generational moved to implausible destination ${genClub?.name}`);
assert(getLeagueMarketRankings(state, 'Europe').find((row)=>row.leagueId===genClub.leagueId)?.rank <= 4, `Prime Generational moved outside a top-four European league to ${genClub?.name}`);

// A prime Epic can move within Europe but cannot choose a backwards Europe -> Uruguay/Colombia path.
const epic = state.players.find((player) => player.rarity === 'epic' && !player.realWorldId && player.id !== gen.id);
epic.clubId = 'napoli'; epic.rating = 90; epic.baseQuality = Math.max(epic.baseQuality, 90); epic.careerYear = 7; epic.birthYear = state.season - 25;
epic.happiness = 8; epic.contractYears = 1; epic.transferProtectedUntilSeason = null;
state.current.completed = true;
startNextSeason(state);
const epicClub = club(epic.clubId);
if (epicClub && epicClub.id !== 'napoli') assert(epicClub.confederation === 'Europe', `Prime Epic moved backwards Napoli -> ${epicClub.name} (${epicClub.country})`);

console.log(JSON.stringify({
  topEuropeanMarkets: getLeagueMarketRankings(state, 'Europe').slice(0, 8).map((row) => ({ country: row.country, rank: row.rank, annualPool: row.financialPool, score: row.score })),
  generationalMove: { from: 'Sporting CP', to: genClub.name, country: genClub.country, tier: genClub.financialTier },
  epicMove: { from: 'Napoli', to: epicClub?.name || 'Free agent', country: epicClub?.country || null },
  tierMovement: { riser: `${riser.name} -> ${riser.financialTier}`, dormantGiant: `Real Madrid -> ${real.financialTier}` }
}, null, 2));
console.log('v0.26 regression passed');
