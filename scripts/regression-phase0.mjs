// Phase 0: the calibration harness runs end to end and reports every metric.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const output = execFileSync(process.execPath, ['scripts/calibration.mjs'], {
  env: { ...process.env, CAL_SEEDS: '20260', CAL_SEASONS: '1' },
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024
});
const report = JSON.parse(output);
const keys = ['goalsPerMatch', 'homeWin', 'draw', 'awayWin', 'shotsPerTeam', 'onTargetPerTeam', 'cornersPerTeam',
  'yellowPerTeam', 'redPerMatch', 'cleanSheetRate', 'extraTimeRate', 'penaltyRate'];
for (const key of keys) assert(Number.isFinite(report.overall[key]), `overall.${key} must be reported`);
assert(report.overall.matches > 5000, 'a full season of detailed matches is sampled');
assert(Object.keys(report.byTier).length >= 4, 'per-tier breakdown is reported');
assert(Number.isFinite(report.condensedLeagues.goalsPerMatch));
for (const row of Object.values(report.favouriteByStrengthGap)) {
  assert(Math.abs(row.favouriteWin + row.draw + row.upset - 1) < 0.01);
}
assert(Number.isFinite(report.spread.ballonDorDistinctPlayersPerSeed));
assert(report.timing.averageSeasonSeconds > 0);
console.log(JSON.stringify({ matches: report.overall.matches, goalsPerMatch: report.overall.goalsPerMatch, tiers: Object.keys(report.byTier).length, passed: true }, null, 2));
