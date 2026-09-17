import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd, startNextSeason } from '../src/engine.js';
import { NATIONAL_TEAM_BY_ID } from '../src/data.js';

const seeds = process.argv.slice(2).map(Number);
for (const seed of seeds.length ? seeds : [160926]) {
  const world = createWorld(seed);
  const clubs = new Map(world.clubs.map((club) => [club.id, club]));
  const seasons = [];
  for (let year = 0; year < 5; year++) {
    simulateToSeasonEnd(world);
    startNextSeason(world);
    const domestic = {};
    for (const country of ['England', 'Spain', 'Mexico']) {
      const roster = world.players.filter((player) => player.status === 'active' && clubs.get(player.clubId)?.country === country);
      const count = roster.filter((player) => NATIONAL_TEAM_BY_ID[player.nationality]?.name === country).length;
      domestic[country] = Number((count / roster.length).toFixed(3));
      assert(domestic[country] > 0.65, `${country} lost its domestic core in ${world.season}`);
    }
    const moves = world.history.transfers.filter((move) => move.season === world.season);
    assert.equal(new Set(moves.map((move) => move.playerId)).size, moves.length, 'Repeat transfer in one window');
    const players = new Map(world.players.map((player) => [player.id, player]));
    const eliteMoves = moves.filter((move) => ['legend', 'generational'].includes(players.get(move.playerId)?.rarity));
    seasons.push({ season: world.season, domestic, eliteMoves: eliteMoves.length, transfers: moves.length });
    console.log(JSON.stringify({ seed, ...seasons.at(-1) }));
  }
  assert(seasons.reduce((sum, row) => sum + row.eliteMoves, 0) >= 3, 'Elite market remained frozen for five years');
}
