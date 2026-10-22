// International tournament calibration: plays many World Cup and continental cycles in
// throwaway worlds and reports how the pre-tournament top 4 do (group exits, semi-finals,
// titles). Run on its own (npm run calibration-intl) or as part of scripts/calibration.mjs.
//   INTL_SEEDS   comma-separated world seeds (default 101,202,303)
//   INTL_CYCLES  World Cup cycles and continental cycles per seed (default 8)
//   CAL_ENGINE   engine path (default ../src/engine.js)
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const MAJOR = ['WC', 'EURO', 'COPA', 'AFCON', 'ASIACUP', 'GOLDCUP'];

export async function runInternationalCalibration({ seeds, cycles, engineUrl }) {
  const { createWorld, getTeamPower, runInternationalCycleForCalibration } = await import(engineUrl);
  const rows = new Map(MAJOR.map((id) => [id, { tournaments: 0, top4: 0, top4GroupExit: 0, top4Semi: 0, top4Win: 0, favouriteWin: 0, favouriteGroupExit: 0, top8SharedGroups: 0 }]));
  const startedAt = performance.now();
  for (const seed of seeds) {
    const world = createWorld(seed);
    for (let index = 0; index < cycles; index += 1) {
      for (const cycle of [1, 'regional']) {
        const { competitions, matches } = runInternationalCycleForCalibration(world, cycle);
        const byId = new Map(matches.map((match) => [match.id, match]));
        for (const comp of Object.values(competitions)) {
          const row = rows.get(comp.id);
          if (!row || !comp.completed || !comp.knockout) continue;
          const entrants = comp.groups.flatMap((group) => group.teamIds);
          const ranked = [...entrants].sort((a, b) => getTeamPower(world, b, true) - getTeamPower(world, a, true));
          const top4 = ranked.slice(0, 4);
          const rounds = comp.knockout.rounds || [];
          const teamsIn = (round) => new Set((round?.matchIds || []).flatMap((id) => { const match = byId.get(id); return match ? [match.homeId, match.awayId] : []; }));
          const knockoutTeams = teamsIn(rounds[0]);
          const semiTeams = teamsIn(rounds.find((round) => round.stage === 'Semi-final'));
          row.tournaments += 1;
          for (const id of top4) {
            row.top4 += 1;
            if (!knockoutTeams.has(id)) row.top4GroupExit += 1;
            if (semiTeams.has(id)) row.top4Semi += 1;
            if (comp.championId === id) row.top4Win += 1;
          }
          if (comp.championId === ranked[0]) row.favouriteWin += 1;
          if (!knockoutTeams.has(ranked[0])) row.favouriteGroupExit += 1;
          const top8 = new Set(ranked.slice(0, 8));
          for (const group of comp.groups) {
            const count = group.teamIds.filter((id) => top8.has(id)).length;
            if (count > 1) row.top8SharedGroups += count - 1;
          }
        }
      }
    }
  }
  const pct = (value, total) => (total ? Number((value / total).toFixed(3)) : null);
  const byCompetition = Object.fromEntries([...rows].filter(([, row]) => row.tournaments).map(([id, row]) => [id, {
    tournaments: row.tournaments,
    top4GroupExitRate: pct(row.top4GroupExit, row.top4),
    top4SemiFinalRate: pct(row.top4Semi, row.top4),
    top4WinRate: pct(row.top4Win, row.top4),
    favouriteWinRate: pct(row.favouriteWin, row.tournaments),
    favouriteGroupExitRate: pct(row.favouriteGroupExit, row.tournaments),
    top8SharingAGroupPerTournament: pct(row.top8SharedGroups, row.tournaments)
  }]));
  const all = [...rows.values()].reduce((sum, row) => ({ top4: sum.top4 + row.top4, exit: sum.exit + row.top4GroupExit, fav: sum.fav + row.favouriteWin, n: sum.n + row.tournaments }), { top4: 0, exit: 0, fav: 0, n: 0 });
  return {
    seeds, cyclesPerSeed: cycles,
    targets: { top4GroupExitRate: [0.10, 0.15], favouriteWinRate: [0.20, 0.30] },
    overall: { tournaments: all.n, top4GroupExitRate: pct(all.exit, all.top4), favouriteWinRate: pct(all.fav, all.n) },
    byCompetition,
    seconds: Number(((performance.now() - startedAt) / 1000).toFixed(1))
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seeds = String(process.env.INTL_SEEDS || '101,202,303').split(',').map(Number);
  const cycles = Number(process.env.INTL_CYCLES || 8);
  const engineUrl = pathToFileURL(resolve(process.env.CAL_ENGINE || fileURLToPath(new URL('../src/engine.js', import.meta.url)))).href;
  const report = await runInternationalCalibration({ seeds, cycles, engineUrl });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
