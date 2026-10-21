import assert from 'node:assert/strict';
import {
  createWorld,
  simulateToSeasonEnd,
  startNextSeason,
  simulateNextWeek,
  isOffseasonEditorAvailable,
  editorAddClubMoney,
  editorCreateTransfer,
  editorCancelTransfer,
  upgradeWorld
} from '../src/engine.js';

const world = createWorld(31601);
// v4 squads bumped the data revision past 25; the editor migration still runs on the way.
assert(world.dataRevision >= 25);
assert.equal(isOffseasonEditorAvailable(world), false);
assert.throws(() => editorAddClubMoney(world, world.clubs[0].id, 1), /offseason/i);

simulateToSeasonEnd(world);
startNextSeason(world);
assert.equal(isOffseasonEditorAvailable(world), true);

const buyer = world.clubs[0];
const source = world.clubs.find((club) => club.id !== buyer.id);
const player = world.players.find((item) => item.status === 'active' && item.clubId === source.id);
const openingCash = buyer.finances;
const openingBudget = buyer.transferBudget;
const openingPlayer = { clubId: player.clubId, salary: player.salary, contractYears: player.contractYears, happiness: player.happiness };

const injection = editorAddClubMoney(world, buyer.id, 25);
assert.equal(injection.amount, 25);
assert.equal(buyer.finances, Number((openingCash + 25).toFixed(1)));
assert.equal(buyer.transferBudget, Number((openingBudget + 25).toFixed(1)));

const transfer = editorCreateTransfer(world, player.id, buyer.id, 10);
assert.equal(transfer.editorCreated, true);
assert.ok(transfer.id);
assert.equal(player.clubId, buyer.id);
assert.ok(world.current.transfers.some((record) => record.id === transfer.id));
assert.ok(world.history.transfers.some((record) => record.id === transfer.id));

editorCancelTransfer(world, transfer.id);
assert.equal(player.clubId, openingPlayer.clubId);
assert.equal(player.salary, openingPlayer.salary);
assert.equal(player.contractYears, openingPlayer.contractYears);
assert.equal(player.happiness, openingPlayer.happiness);
assert.ok(!world.current.transfers.some((record) => record.id === transfer.id));
assert.ok(!world.history.transfers.some((record) => record.id === transfer.id));

simulateNextWeek(world);
assert.equal(isOffseasonEditorAvailable(world), false);
assert.throws(() => editorCreateTransfer(world, player.id, buyer.id, 0), /offseason/i);

const legacy = structuredClone(world);
legacy.dataRevision = 24;
delete legacy.nextTransferId;
for (const record of legacy.current.transfers) delete record.id;
upgradeWorld(legacy);
assert(legacy.dataRevision >= 25);
assert.ok(legacy.nextTransferId >= 1);

console.log(JSON.stringify({ season: world.season, editorActions: world.current.editorActions.length, guardedAfterWeekOne: true }, null, 2));
