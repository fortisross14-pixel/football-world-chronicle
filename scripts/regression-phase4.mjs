// Phase 4: potential and development, form, personality traits, captains and loans.
import assert from 'node:assert/strict';
import {
  createWorld, simulateToSeasonEnd, startNextSeason, simulateWeeks, upgradeWorld,
  getPlayerProfileDetails, PLAYER_TRAITS
} from '../src/engine.js';
import { playMatch } from '../src/match-engine.js';
import * as legacy from './fixtures/legacy-r25/src/engine.js';

const report = {};
const world = createWorld(40401);
const active = () => world.players.filter((player) => player.status === 'active');

// Traits: one or two for most players, rarity-aware, never contradictory.
const counts = {};
for (const player of active()) {
  assert(Array.isArray(player.traits) && player.traits.length <= 2);
  assert(!(player.traits.includes('loyal') && player.traits.includes('mercenary')));
  for (const trait of player.traits) counts[trait] = (counts[trait] || 0) + 1;
}
const population = active().length;
for (const [trait, count] of Object.entries(counts)) assert(count / population < 0.2, `${trait} stays a minority trait`);
const share = (filter, trait) => { const rows = active().filter(filter); return rows.filter((player) => player.traits.includes(trait)).length / Math.max(1, rows.length); };
assert(share((player) => ['epic', 'legend', 'generational'].includes(player.rarity), 'big_game') > share((player) => player.rarity === 'common', 'big_game'), 'big-game players are more common among stars');
report.traits = Object.fromEntries(Object.entries(counts).map(([trait, count]) => [trait, Number((count / population).toFixed(3))]));
assert.equal(Object.keys(PLAYER_TRAITS).length, 8);

// Clutch takers and hot heads behave differently in the engine.
let seed = 4040;
const rng = () => { seed = (Math.imul(1664525, seed >>> 0) + 1013904223) >>> 0; return seed / 4294967296; };
const lines = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'];
const team = (id, extra = {}) => ({
  teamId: id, style: 'pragmatist', lambda: 1.2,
  xi: lines.map((line, i) => ({ id: `${id}-${i}`, line, slotType: line === 'GK' ? 'GK' : line === 'DF' ? 'CB' : line === 'MF' ? 'CM' : 'ST', rating: 75, effective: 75, goalW: line === 'FW' ? 9 : line === 'MF' ? 4 : 1, assistW: 3, penalty: 75, ...extra })),
  bench: ['GK', 'DF', 'MF', 'FW'].map((line, i) => ({ id: `${id}-b${i}`, line, rating: 72, effective: 72, goalW: 2, assistW: 2, penalty: 72, ...extra }))
});
const shootoutRate = (extra) => {
  let scored = 0, kicks = 0, cards = 0, matches = 0;
  for (let index = 0; index < 4000; index += 1) {
    const result = playMatch({ home: team('h', extra), away: team('a'), knockout: true }, rng);
    matches += 1;
    cards += result.cards.filter((card) => card.side === 'home').length;
    for (const kick of result.shootout || []) if (kick.side === 'home') { kicks += 1; if (kick.scored) scored += 1; }
  }
  return { conversion: scored / Math.max(1, kicks), cardsPerMatch: cards / matches };
};
const plain = shootoutRate({});
const clutch = shootoutRate({ clutch: 1, penalty: 79 });
const hotHeads = shootoutRate({ cardProne: 1.8 });
assert(clutch.conversion > plain.conversion + 0.03, 'clutch takers convert more shootout penalties');
assert(hotHeads.cardsPerMatch > plain.cardsPerMatch * 1.4, 'hot-headed sides collect more cards');
report.engineTraits = { shootoutPlain: Number(plain.conversion.toFixed(3)), shootoutClutch: Number(clutch.conversion.toFixed(3)), cardsPlain: Number(plain.cardsPerMatch.toFixed(2)), cardsHotHeaded: Number(hotHeads.cardsPerMatch.toFixed(2)) };

// Potential: hidden, with a scouting range that contains it for young players.
for (const player of active().filter((item) => item.careerYear <= 3).slice(0, 400)) {
  assert(player.potential >= player.baseQuality);
  const details = getPlayerProfileDetails(world, player.id);
  assert(details.potential.low <= player.potential + 3 && details.potential.high >= player.potential - 3);
}

// Development depends on minutes: young regulars grow more than young benchwarmers.
simulateToSeasonEnd(world);
const minutes = new Map();
for (const row of world.current.archivedPlayerStats) if (!row.isInternational) minutes.set(row.playerId, (minutes.get(row.playerId) || 0) + (row.minutes || 0));
const young = active().filter((player) => player.careerYear <= 3 && player.potential - player.baseQuality >= 3);
const before = new Map(young.map((player) => [player.id, player.baseQuality]));
const clubBefore = new Map(active().filter((player) => player.clubId).map((player) => [player.id, player.clubId]));
startNextSeason(world);
const developmentStories = world.current.news.filter((story) => story.category === 'Player Development');
assert(developmentStories.length > 0, 'breakouts, late bloomers and declines make the preseason news');
report.developmentStories = developmentStories.length;
// Personality shapes careers: mercenaries move clubs more often than loyal players.
const moveRate = (trait) => {
  const rows = [...clubBefore].map(([id, clubId]) => [world.players.find((player) => player.id === id), clubId]).filter(([player]) => player?.status === 'active' && player.traits.includes(trait) && !player.loan);
  return rows.filter(([player, clubId]) => player.clubId !== clubId).length / Math.max(1, rows.length);
};
report.moveRate = { loyal: Number(moveRate('loyal').toFixed(3)), mercenary: Number(moveRate('mercenary').toFixed(3)) };
assert(report.moveRate.mercenary > report.moveRate.loyal, 'mercenaries move more often than loyal players');
const growth = (filter) => { const rows = young.filter(filter); return rows.reduce((sum, player) => sum + (player.baseQuality - before.get(player.id)), 0) / Math.max(1, rows.length); };
const regulars = growth((player) => (minutes.get(player.id) || 0) >= 1800);
const benched = growth((player) => (minutes.get(player.id) || 0) < 500);
assert(regulars > benched + 0.4, `regulars develop faster (${regulars.toFixed(2)} vs ${benched.toFixed(2)})`);
report.development = { regularsGrowth: Number(regulars.toFixed(2)), benchedGrowth: Number(benched.toFixed(2)) };

// Captains and loans after the first offseason.
const clubsWithPlayers = new Set(active().filter((player) => player.clubId).map((player) => player.clubId));
assert(world.clubs.filter((club) => clubsWithPlayers.has(club.id)).every((club) => club.captainId), 'every club has a captain');
const captains = world.clubs.map((club) => world.players.find((player) => player.id === club.captainId)).filter(Boolean);
assert(captains.filter((player) => player.traits.includes('leader')).length / captains.length > 0.25, 'leaders are favoured as captains');
const loanees = active().filter((player) => player.loan);
assert(loanees.length >= 15, `young players go out on loan (${loanees.length})`);
assert(loanees.every((player) => player.careerYear <= 4), 'loans are for young players');
assert(world.current.transfers.filter((row) => row.loan).length === loanees.length, 'loans appear in the transfer market');
report.loans = loanees.length;

// Form moves with match ratings during the season.
simulateWeeks(world, 20);
const forms = active().map((player) => player.form || 0);
assert(forms.some((value) => value > 0.5) && forms.some((value) => value < -0.5), 'hot streaks and slumps appear');
report.form = { hot: forms.filter((value) => value > 0.5).length, slump: forms.filter((value) => value < -0.5).length };

// Loans return to the parent club next summer.
simulateToSeasonEnd(world);
const loanParents = new Map(loanees.map((player) => [player.id, player.loan.parentClubId]));
startNextSeason(world);
for (const [id, parent] of loanParents) {
  const player = world.players.find((item) => item.id === id);
  if (player.status !== 'active' || player.loan) continue;
  assert(player.loanHistory.some((row) => row.parentClubId === parent), 'loan spells stay in the career record');
}

// Elite population stays stable while players develop and decline.
const elite = [];
for (let season = 0; season < 8; season += 1) {
  simulateToSeasonEnd(world);
  startNextSeason(world);
  const rows = active();
  elite.push(rows.filter((player) => player.rating >= 88).length);
  const rarities = {};
  for (const player of rows) rarities[player.rarity] = (rarities[player.rarity] || 0) + 1;
  assert(rarities.generational <= 3 && rarities.legend <= 15 && rarities.epic <= 50, 'rarity caps hold');
}
assert(Math.min(...elite) >= 12 && Math.max(...elite) <= 60, `elite (88+) population stays stable: ${elite.join(', ')}`);
report.elite88 = elite;

// Old saves gain traits and potential without changing anyone's current ability.
const old = legacy.createWorld(40402);
legacy.simulateWeeks(old, 5);
const raw = JSON.parse(JSON.stringify(old));
const ratings = new Map(raw.players.map((player) => [player.id, player.rating]));
const upgraded = upgradeWorld(raw);
assert(upgraded.dataRevision >= 30);
// v4.3 (data revision 34) brings ratings of players below Epic back inside their band;
// every other rating is unchanged.
const bandCap = { rare: 84, uncommon: 79, common: 69 };
assert(upgraded.players.filter((player) => ratings.has(player.id)).every((player) => player.rating === (bandCap[player.rarity] !== undefined ? Math.min(ratings.get(player.id), bandCap[player.rarity]) : ratings.get(player.id))), 'upgrading changes no ratings except the band caps');
assert(upgraded.players.every((player) => Array.isArray(player.traits) && Number.isFinite(player.potential)));
assert(upgraded.clubs.some((club) => club.captainId));
simulateWeeks(upgraded, 4);

console.log(JSON.stringify({ ...report, passed: true }, null, 2));
