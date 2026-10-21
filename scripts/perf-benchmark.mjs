// Season and offseason timing, measured the same way as balance-v316:
// simulateToSeasonEnd() for the whole season and startNextSeason() for the offseason.
//   PERF_SEEDS=271828 PERF_SEASONS=20 node scripts/perf-benchmark.mjs
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// PERF_ENGINE=path/to/engine.js times another copy (e.g. the frozen v3.16.1 fixture).
const engineUrl = process.env.PERF_ENGINE ? pathToFileURL(resolve(process.env.PERF_ENGINE)).href : new URL('../src/engine.js', import.meta.url).href;
const { createWorld, simulateToSeasonEnd, startNextSeason } = await import(engineUrl);

const seeds = String(process.env.PERF_SEEDS || '271828').split(',').map(Number).filter(Number.isFinite);
const seasons = Number(process.env.PERF_SEASONS || 20);
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const rows = [];
for (const seed of seeds) {
  const createdAt = performance.now();
  const world = createWorld(seed);
  const createSeconds = (performance.now() - createdAt) / 1000;
  const seasonTimes = [];
  const offseasonTimes = [];
  for (let index = 0; index < seasons; index += 1) {
    let startedAt = performance.now();
    simulateToSeasonEnd(world);
    seasonTimes.push((performance.now() - startedAt) / 1000);
    if (index < seasons - 1) {
      startedAt = performance.now();
      startNextSeason(world);
      offseasonTimes.push((performance.now() - startedAt) / 1000);
    }
  }
  const saveBytes = Buffer.byteLength(JSON.stringify(world));
  rows.push({
    seed,
    seasons,
    createSeconds: Number(createSeconds.toFixed(2)),
    averageSeasonSeconds: Number(average(seasonTimes).toFixed(2)),
    averageOffseasonSeconds: Number(average(offseasonTimes).toFixed(2)),
    slowestOffseasonSeconds: Number(Math.max(0, ...offseasonTimes).toFixed(2)),
    activePlayers: world.players.filter((player) => player.status === 'active').length,
    totalPlayers: world.players.length,
    saveMegabytes: Number((saveBytes / 1048576).toFixed(1))
  });
}
process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
