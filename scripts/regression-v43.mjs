// v4.3: one list of everyone who changed team (rarity first, never by fee), "since last
// season" on club pages, ratings kept inside the rarity, star-friendly awards, and the
// UI for all of it (real app, fake DOM).
import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd, startNextSeason, upgradeWorld, getSeasonMoves, getClubChanges } from '../src/engine.js';
import { SAVE_KEY, STAR_RARITIES } from '../src/data.js';

const report = {};
const rank = (rarity) => STAR_RARITIES[rarity]?.rank || 1;

const world = createWorld(43043);
simulateToSeasonEnd(world);
startNextSeason(world);

// ── Moves: rarity first, then rating; every reason; never by fee ──
const all = getSeasonMoves(world);
const elite = getSeasonMoves(world, { eliteOnly: true });
const sorted = (rows, value) => rows.every((row, index) => !index || rank(rows[index - 1].rarity) > rank(row.rarity) || (rank(rows[index - 1].rarity) === rank(row.rarity) && value(rows[index - 1]) >= value(row)));
assert(sorted(all.players, (row) => row.rating), 'players are sorted by rarity, then rating');
assert(sorted(all.coaches, (row) => row.rating), 'coaches are sorted by rarity, then quality');
assert(elite.players.every((row) => rank(row.rarity) >= 4), 'the default list is Epic and above');
assert(elite.players.length > 0 && elite.coaches.length > 0);
const kinds = new Set(all.players.map((row) => row.kind));
for (const kind of ['transfer', 'free', 'loan']) assert(kinds.has(kind), `moves include ${kind}`);
assert(all.players.some((row) => /^Contract expired at .+ · free/.test(row.how)), 'contract expiries are described');
assert(all.players.some((row) => /^Transfer · \$\d/.test(row.how)), 'transfers show the fee');
assert(all.players.some((row) => row.how === 'Back from loan') || !world.history.transfers.some((move) => move.loan && move.season === world.season - 1), 'loan returns are listed');
assert(all.players.every((row) => row.toClubId || /unattached/.test(row.how)), 'a player without a club is listed as unattached');
const freeElite = world.history.transfers.filter((move) => move.season === world.season && move.freeTransfer && !move.loan && ['generational', 'legend'].includes(world.players.find((player) => player.id === move.playerId)?.rarity));
for (const move of freeElite) assert(world.current.news.some((story) => story.entityId === move.playerId && /Transfer/.test(story.category || '')), 'big free moves make the Magazine');
report.moves = { players: all.players.length, elitePlayers: elite.players.length, coaches: all.coaches.length, top: elite.players.slice(0, 3).map((row) => `${row.rarity} ${row.rating} ${row.how}`), freeEliteMoves: freeElite.length };

// ── Club changes ──
const giant = world.clubs.filter((club) => club.division === 1).sort((a, b) => b.reputation - a.reputation)[0];
const changes = getClubChanges(world, giant.id);
assert(changes.lastSeason && Number.isFinite(changes.lastSeason.powerRank), 'last season power rank is stored');
assert(Number.isFinite(changes.powerRankNow), 'current power rank');
assert(changes.ratingChanges.every((row) => ['aging', 'decline', 'injury', 'development', 'improvement'].includes(row.reason)));
report.clubChanges = { club: giant.name, powerRank: `${changes.lastSeason.powerRank} → ${changes.powerRankNow}`, arrivals: changes.arrivals.length, departures: changes.departures.length, biggestChange: changes.ratingChanges[0] };

// ── Ratings stay inside the rarity ──
for (const player of world.players) {
  if (player.status !== 'active' || rank(player.rarity) >= 4) continue;
  assert(player.rating <= STAR_RARITIES[player.rarity].max - 1, `${player.name} (${player.rarity}) stays below the next band`);
}
const epics = world.players.filter((player) => player.status === 'active' && player.rarity === 'epic').length;
report.epics = epics;

// ── Awards: no Uncommon/Common on the podium; Epic+ winner unless historic ──
const podium = world.history.awards.filter((row) => row.category === 'ballon_dor');
for (const row of podium) assert(rank(world.players.find((player) => player.id === row.playerId)?.rarity) >= 3, 'no Uncommon or Common Ballon d\'Or podium');
report.ballon = podium.map((row) => `${row.rank}: ${world.players.find((player) => player.id === row.playerId)?.rarity}`);

// ── Migration ──
const legacy = createWorld(43044);
const rare = legacy.players.find((player) => player.rarity === 'rare');
rare.baseQuality = 87; rare.rating = 88; rare.potential = 89;
legacy.dataRevision = 33;
delete legacy.current.contractExits;
const upgraded = upgradeWorld(JSON.parse(JSON.stringify(legacy)));
const upgradedRare = upgraded.players.find((player) => player.id === rare.id);
assert.equal(upgraded.dataRevision, 34);
assert(upgradedRare.rating <= 84 && upgradedRare.baseQuality <= 85, 'old Rare ratings are brought back inside the band');
assert(Array.isArray(upgraded.current.contractExits));

// ── UI ──
let saved = JSON.stringify(world);
const handlers = {};
class FakeClassList { add() {} remove() {} toggle() {} contains() { return false; } }
const app = { innerHTML: '' };
globalThis.document = { body: { classList: new FakeClassList() }, addEventListener(type, cb) { handlers[`document:${type}`] = cb; }, getElementById(id) { return id === 'app' ? app : null; }, querySelectorAll() { return []; } };
globalThis.window = { addEventListener(type, cb) { handlers[`window:${type}`] = cb; }, scrollTo() {}, location: { hash: '#/transfers' }, prompt() { return null; }, confirm() { return false; } };
globalThis.location = globalThis.window.location;
const storage = new Map();
globalThis.localStorage = { getItem(key) { return key === SAVE_KEY ? saved : storage.get(key) ?? null; }, setItem(key, value) { if (key === SAVE_KEY) saved = value; else storage.set(key, value); }, removeItem() {} };
await import('../src/app.js');
await handlers['window:DOMContentLoaded']();
const go = (hash) => { window.location.hash = hash; handlers['window:hashchange'](); return app.innerHTML; };
const click = (action) => handlers['document:click']({ target: { closest: (selector) => (selector === '[data-action]' ? { dataset: { action } } : null) } });
const moves = go('#/transfers');
for (const marker of ['Players', 'Coaches', '>How<', 'Show all rarities', 'moves-table']) assert(moves.includes(marker), `Moves tab shows ${marker}`);
const firstElite = elite.players[0];
assert(moves.includes(firstElite.how.replace(/&/g, '&amp;')), 'the top elite move is listed with its how line');
await click('moves-toggle-rarity');
assert(app.innerHTML.includes('Show Epic and above only'), 'the rarity toggle switches to all rarities');
assert(storage.get('fwc-moves-all') === '1', 'the choice is remembered');
const overview = go(`#/club/${giant.id}/overview`);
for (const marker of ['Since last season', 'Power ranking', 'Arrivals', 'Departures', 'Biggest rating changes']) assert(overview.includes(marker), `club overview shows ${marker}`);
assert(go(`#/club/${giant.id}/history`).includes('Arrivals and departures by season'));
assert(go('#/offseason/summary').includes('Elite moves'), 'the offseason summary lists Elite moves');

console.log(JSON.stringify(report, null, 2));
console.log('v4.3 regression passed');
