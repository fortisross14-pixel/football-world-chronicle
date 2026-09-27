import {
  createWorld,
  simulateToSeasonEnd,
  startNextSeason,
  getLeagueMarketRankings
} from '../src/engine.js';

const seasons = Number(process.env.BALANCE_SEASONS || 20);
const seeds = String(process.env.BALANCE_SEEDS || '314159,271828')
  .split(',').map((value) => Number(value.trim())).filter(Number.isFinite);

function payrollSnapshot(world) {
  const bills = new Map();
  for (const player of world.players) {
    if (player.status !== 'active' || !player.clubId) continue;
    bills.set(player.clubId, (bills.get(player.clubId) || 0) + Number(player.salary || 0));
  }
  return world.clubs.map((club) => {
    const bill = bills.get(club.id) || 0;
    const limit = Number(club.payrollLimit || Math.max(club.wageBudget || 1, (club.payrollAnchor || 1) * 1.04));
    return { clubId: club.id, bill, limit, ratio: limit ? bill / limit : 0, reputation: Number(club.reputation || 0) };
  });
}

function titleWindows(years) {
  const sorted = [...years].sort((a, b) => a - b);
  const windows = [];
  for (const season of sorted) {
    let window = windows.at(-1);
    if (!window || season - window.at(-1) >= 4) {
      window = [];
      windows.push(window);
    }
    window.push(season);
  }
  return windows;
}

const universes = [];
const warnings = [];

for (const seed of seeds) {
  const universeStartedAt = performance.now();
  const world = createWorld(seed);
  const uclTitles = new Map();
  const semifinalAppearances = new Map();
  const eraTimeline = [];
  let maximumPayrollToCap = 0;
  let maximumElitePayrollToCap = 0;
  let payrollBreaches = 0;
  let eraTopThreeSeasons = 0;
  let headlineCount = 0;
  const seasonEndTimes = [];
  const offseasonTimes = [];

  for (let index = 0; index < seasons; index += 1) {
    const seasonEndStartedAt = performance.now();
    simulateToSeasonEnd(world);
    seasonEndTimes.push((performance.now() - seasonEndStartedAt) / 1000);
    const champion = world.history.champions.find((row) => row.season === world.season && row.competitionId === 'UCL');
    if (champion?.winnerId) {
      if (!uclTitles.has(champion.winnerId)) uclTitles.set(champion.winnerId, []);
      uclTitles.get(champion.winnerId).push(world.season);
    }

    const semifinalRound = world.current.continentalCompetitions?.UCL?.knockout?.rounds
      ?.find((round) => /semi/i.test(String(round.stage || '')));
    const semifinalists = new Set((semifinalRound?.ties || []).flatMap((tie) => [tie.homeId, tie.awayId]));
    for (const clubId of semifinalists) semifinalAppearances.set(clubId, (semifinalAppearances.get(clubId) || 0) + 1);

    const era = world.leagueEras?.Europe;
    const rows = getLeagueMarketRankings(world, 'Europe');
    const eraRank = rows.find((row) => row.leagueId === era?.leagueId)?.rank || 99;
    if (eraRank <= 3) eraTopThreeSeasons += 1;
    eraTimeline.push({ season: world.season, leagueId: era?.leagueId, rank: eraRank });

    for (const row of payrollSnapshot(world)) {
      maximumPayrollToCap = Math.max(maximumPayrollToCap, row.ratio);
      if (row.reputation >= 82) maximumElitePayrollToCap = Math.max(maximumElitePayrollToCap, row.ratio);
      if (row.ratio > 1.08) payrollBreaches += 1;
    }

    headlineCount = Math.max(headlineCount, world.history.news?.length || 0);
    if (index < seasons - 1) {
      const offseasonStartedAt = performance.now();
      startNextSeason(world);
      offseasonTimes.push((performance.now() - offseasonStartedAt) / 1000);
    }
  }

  const titleRows = [...uclTitles].map(([clubId, years]) => ({
    clubId,
    club: world.clubs.find((club) => club.id === clubId)?.name || clubId,
    titles: years.length,
    seasons: years,
    windows: titleWindows(years)
  })).sort((a, b) => b.titles - a.titles);
  const semiRows = [...semifinalAppearances].map(([clubId, appearances]) => ({
    clubId,
    club: world.clubs.find((club) => club.id === clubId)?.name || clubId,
    appearances
  })).sort((a, b) => b.appearances - a.appearances);
  const distinctEuropeanEras = [...new Set(eraTimeline.map((row) => row.leagueId).filter(Boolean))];
  const largestTitleAge = Math.max(0, ...titleRows.flatMap((row) => row.windows.map((window) => window.length)));
  const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const report = {
    seed,
    seasons,
    uniqueUclWinners: titleRows.length,
    leadingUclClubs: titleRows.slice(0, 10),
    leadingSemifinalClubs: semiRows.slice(0, 10),
    maximumTitlesByOneClub: titleRows[0]?.titles || 0,
    maximumTitlesInSingleAge: largestTitleAge,
    maximumSemifinalsByOneClub: semiRows[0]?.appearances || 0,
    distinctEuropeanEras,
    eraTopThreeRate: Number((eraTopThreeSeasons / seasons).toFixed(2)),
    maximumPayrollToCap: Number(maximumPayrollToCap.toFixed(3)),
    maximumElitePayrollToCap: Number(maximumElitePayrollToCap.toFixed(3)),
    payrollBreaches,
    archivedHeadlines: headlineCount,
    hallOfFamePlayers: world.history.hallOfFamePlayers?.length || 0,
    clubLegends: world.history.clubLegends?.length || 0,
    averageSeasonEndSeconds: Number(average(seasonEndTimes).toFixed(2)),
    averageOffseasonSeconds: Number(average(offseasonTimes).toFixed(2)),
    slowestOffseasonSeconds: Number(Math.max(0, ...offseasonTimes).toFixed(2)),
    elapsedSeconds: Number(((performance.now() - universeStartedAt) / 1000).toFixed(1))
  };
  universes.push(report);

  if (report.maximumTitlesByOneClub > Math.max(7, Math.ceil(seasons * 0.35))) warnings.push(`Seed ${seed}: one club won ${report.maximumTitlesByOneClub}/${seasons} UCL titles.`);
  if (report.maximumTitlesInSingleAge > 4) warnings.push(`Seed ${seed}: one club won ${report.maximumTitlesInSingleAge} titles in one uninterrupted age.`);
  if (report.uniqueUclWinners < 4) warnings.push(`Seed ${seed}: only ${report.uniqueUclWinners} UCL winners.`);
  if (report.maximumSemifinalsByOneClub > Math.ceil(seasons * 0.75)) warnings.push(`Seed ${seed}: one club reached ${report.maximumSemifinalsByOneClub}/${seasons} semifinals.`);
  if (distinctEuropeanEras.length < 3) warnings.push(`Seed ${seed}: only ${distinctEuropeanEras.length} European league eras.`);
  if (report.eraTopThreeRate < 0.65) warnings.push(`Seed ${seed}: active era reached Europe's top three only ${report.eraTopThreeRate}.`);
  if (report.maximumElitePayrollToCap > 3.0) warnings.push(`Seed ${seed}: elite-club payroll pressure peaked at ${report.maximumElitePayrollToCap}× sustainable capacity.`);
  if (report.archivedHeadlines < seasons * 4) warnings.push(`Seed ${seed}: world headline archive is too sparse.`);
  if (report.hallOfFamePlayers > Math.ceil(seasons * 1.25)) warnings.push(`Seed ${seed}: ${report.hallOfFamePlayers} Hall of Fame inductees in ${seasons} seasons.`);
}

const output = { version: '3.16.0', seasons, seeds, universes, warnings };
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`, () => process.exit(warnings.length ? 2 : 0));
