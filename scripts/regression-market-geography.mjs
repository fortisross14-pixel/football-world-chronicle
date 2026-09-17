import assert from 'node:assert/strict';
import fs from 'node:fs';
import { countryAffinity, eliteDepartureChance } from '../src/market-policy.js';
import { NATIONAL_TEAM_BY_ID } from '../src/data.js';

// Exercise the actual market paths without expanding the browser's public API.
const engineUrl = new URL('../src/engine.js', import.meta.url);
const source = fs.readFileSync(engineUrl, 'utf8').replace(/from '(\.\/[^']+)'/g,
  (_, relative) => `from '${new URL(relative, engineUrl).href}'`);
const engine = await import(`data:text/javascript;base64,${Buffer.from(source + `\nexport {
  chooseRookieDestination, geographicClubPick, ensureClubRosters, transferPlayer,
  availableForTransfer, playerClubTenure, updatePlayerDiscontent, ambitionHappinessChange,
  invalidateRuntimeCache, runTransferMarket
};`).toString('base64')}`);

assert(countryAffinity('England', 'Australia', 'Europe', 'Asia') > countryAffinity('England', 'Japan', 'Europe', 'Asia'));
assert(countryAffinity('Mexico', 'Argentina', 'North America', 'South America') > countryAffinity('Mexico', 'Germany', 'North America', 'Europe'));
const settled = { tenure: 4, topClub: true, happiness: 85, success: 2 };
assert(eliteDepartureChance({ ...settled, tenure: 1 }) < 0.01);
assert(eliteDepartureChance({ ...settled, happiness: 20 }) > eliteDepartureChance(settled));
assert(eliteDepartureChance({ ...settled, happiness: 20, unhappySeasons: 2 }) > 0.9);
assert(eliteDepartureChance({ ...settled, tenure: 2 }) > eliteDepartureChance({ ...settled, tenure: 1 }));
assert(eliteDepartureChance({ ...settled, success: 0 }) > eliteDepartureChance(settled));

const world = engine.createWorld(160926);
const clubById = new Map(world.clubs.map((club) => [club.id, club]));
const report = { rookies: {}, destinations: {}, rosters: {}, availability: {} };
for (const nationality of ['eng', 'esp', 'ger', 'mex']) {
  const player = { id: `geography-${nationality}`, nationality, rarity: 'common', careerYear: 0, birthYear: world.season - 18 };
  let domestic = 0;
  for (let i = 0; i < 1200; i++) {
    const club = engine.chooseRookieDestination(world, world.clubs, player);
    if (club.country === NATIONAL_TEAM_BY_ID[nationality].name) domestic++;
  }
  report.rookies[nationality] = domestic / 1200;
  assert(domestic / 1200 > 0.86 && domestic / 1200 < 0.95, `${nationality}: rookie home-country balance`);
}

// Equal sporting offers isolate geography from reputation and financial needs.
for (const nationality of ['eng', 'esp', 'mex']) {
  const player = { nationality, rarity: 'rare', careerYear: 6, birthYear: world.season - 24 };
  const destinations = {};
  for (let i = 0; i < 2000; i++) {
    const club = engine.geographicClubPick(world, world.clubs, player, () => 1);
    destinations[club.country] = (destinations[club.country] || 0) + 1;
  }
  report.destinations[nationality] = Object.fromEntries(Object.entries(destinations).sort((a, b) => b[1] - a[1]).slice(0, 8));
  assert(destinations[NATIONAL_TEAM_BY_ID[nationality].name] / 2000 > 0.65);
  assert(Object.keys(destinations).length > 12, 'Unusual destinations disappeared');
}

// Release ordinary squads worldwide, then exercise the former random-roster path.
for (const player of world.players) {
  if (['common', 'uncommon', 'rare'].includes(player.rarity)) {
    player.clubId = null;
    player.salary = 0;
    player.contractYears = 0;
  }
}
engine.invalidateRuntimeCache(world);
engine.ensureClubRosters(world);
for (const country of ['England', 'Spain', 'Mexico']) {
  const players = world.players.filter((player) => player.status === 'active' && clubById.get(player.clubId)?.country === country);
  const domestic = players.filter((player) => NATIONAL_TEAM_BY_ID[player.nationality]?.name === country).length;
  report.rosters[country] = { total: players.length, domestic, rate: domestic / players.length };
  assert(domestic / players.length > 0.65, `${country}: free agents scattered the roster`);
}

// New contracts cannot be flipped again by either the normal or clearance market.
const star = world.players.find((player) => player.rarity === 'legend');
const buyer = clubById.get('real-madrid');
engine.transferPlayer(world, star, buyer, clubById.get(star.clubId), 0);
assert.equal(engine.availableForTransfer(world, star), false);
assert.equal(engine.playerClubTenure(world, star), 0);
const saved = structuredClone(world);
const savedStar = saved.players.find((player) => player.id === star.id);
delete savedStar.clubJoinedSeason;
assert.equal(engine.playerClubTenure(saved, savedStar), 0, 'Old saves failed to recover their last signing');
const unrecordedSigning = { ...savedStar, id: 'legacy-free-agent', clubJoinedSeason: null };
saved.history.playerSeasons.push(
  { playerId: unrecordedSigning.id, season: saved.season - 1, teamId: buyer.id },
  { playerId: unrecordedSigning.id, season: saved.season - 2, teamId: buyer.id },
  { playerId: unrecordedSigning.id, season: saved.season - 3, teamId: 'liverpool' }
);
assert.equal(engine.playerClubTenure(saved, unrecordedSigning), 2, 'Legacy free-agent tenure ignored archived team IDs');
world.season++;
star.happiness = 90;
star.contractYears = 5;
assert.equal(engine.playerClubTenure(world, star), 1);
let firstYearAvailable = 0;
let forcedAvailable = 0;
for (let i = 0; i < 1000; i++) {
  const candidate = { ...star, id: `sample-${i}`, clubJoinedSeason: world.season - 1 };
  if (engine.availableForTransfer(world, candidate)) firstYearAvailable++;
  candidate.clubJoinedSeason = world.season - 4;
  candidate.happiness = 15;
  candidate.unhappySeasons = 2;
  if (engine.availableForTransfer(world, candidate)) forcedAvailable++;
}
assert(firstYearAvailable < 30, 'One-season superstar departures should be exceptional');
assert(forcedAvailable > 900, 'Persistent unhappy stars must be available');
report.availability = { firstYearAvailable, forcedAvailable, samples: 1000 };

star.clubJoinedSeason = world.season - 3;
star.happiness = 20;
engine.updatePlayerDiscontent(world, star, buyer);
engine.updatePlayerDiscontent(world, star, buyer);
assert.equal(star.unhappySeasons, 1, 'Discontent counted twice in one season');
world.season++;
engine.updatePlayerDiscontent(world, star, buyer);
assert.equal(star.transferListed, true);
const lowPay = { ...star, salary: 0.1, marketValue: 150 };
const fairPay = { ...lowPay, salary: 10 };
assert(engine.ambitionHappinessChange(world, lowPay, buyer) < engine.ambitionHappinessChange(world, fairPay, buyer));

// Real transactions: a failed four-year stint can end, then every route respects
// the new club spell. Make several credible buyers able to negotiate the move.
star.rating = 99;
star.careerYear = 8;
star.careerLength = 18;
star.birthYear = world.season - 26;
star.marketValue = 80;
star.salary = 5;
star.transferProtectedUntilSeason = null;
for (const club of world.clubs) {
  club.finances = Math.max(club.finances, 500);
  club.transferBudget = 300;
  club.wageBudget = 100;
  club.payrollPressureRatio = 1;
}
engine.invalidateRuntimeCache(world);
engine.runTransferMarket(world);
assert.notEqual(star.clubId, buyer.id, 'Persistent unhappy legend never completed a move');
assert.equal(engine.availableForTransfer(world, star), false, 'Signing protection was not renewed');
assert.equal(star.unhappySeasons, 0, 'Discontent followed the player into a fresh project');
const thisWindow = world.history.transfers.filter((row) => row.season === world.season);
assert.equal(new Set(thisWindow.map((row) => row.playerId)).size, thisWindow.length, 'Player moved twice in one summer');
console.log(JSON.stringify(report, null, 2));
