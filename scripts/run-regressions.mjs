// Runs the regression suite that passed on v3.16.1 plus the v4 phase scripts.
// Scripts that already failed on v3.16.1 (hard-coded old version strings, retired
// mechanics) are listed in docs/CALIBRATION.md and are not part of this suite.
//   node scripts/run-regressions.mjs            (quick suite)
//   node scripts/run-regressions.mjs --full     (adds the long multi-season harnesses)
import { spawnSync } from 'node:child_process';

const quick = [
  'smoke-test', 'regression-simulation', 'tactics-test', 'regression-v06', 'regression-v08', 'regression-v10',
  'regression-v21', 'regression-v23', 'regression-v300-final', 'regression-v313-ui', 'regression-v315',
  'runtime-ui-smoke', 'editor-v316', 'award-balance-v15', 'regression-phase0', 'regression-phase1',
  'regression-phase2', 'regression-phase3', 'regression-phase4', 'regression-phase5', 'regression-phase6', 'regression-v4-ui', 'regression-v41-live'
];
const full = ['balance-test', 'balance-v20', 'favorite-balance-v17', 'market-career-balance', 'regression-market-geography', 'balance-v316'];
const list = process.argv.includes('--full') ? [...quick, ...full] : quick;
const results = [];
for (const name of list) {
  const path = `scripts/${name}.mjs`;
  try { await import('node:fs').then((fs) => fs.accessSync(path)); } catch { continue; }
  const started = Date.now();
  const run = spawnSync(process.execPath, [path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 1800000 });
  const seconds = (Date.now() - started) / 1000;
  const ok = run.status === 0;
  results.push({ name, ok, seconds: Number(seconds.toFixed(1)), status: run.status });
  const tail = ok ? '' : ` → ${(run.stderr || run.stdout || '').trim().split('\n').slice(-6).join(' | ').slice(0, 400)}`;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} (${seconds.toFixed(1)}s)${tail}`);
}
const failed = results.filter((row) => !row.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
