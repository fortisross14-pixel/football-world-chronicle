// Star impact: does one great player lift a team in the league?
// For each seed, plays one season twice from the same new world: once as generated and
// once with the best Generational forward moved (free, before Week 1) to a mid-table
// club (pre-season power rank 10–14 in a big league). Compares the club's final position.
// A second scenario moves him to a top-5 club. Prints a JSON report.
//   STAR_SEEDS     comma-separated seeds (default 101,202,303,404)
//   STAR_SCENARIOS mid,top (default both)
import { createWorld, simulateToSeasonEnd, getLeagueTable, getTeamPower, invalidateRuntimeCache, getFixtureOdds } from '../src/engine.js';

const seeds = (process.env.STAR_SEEDS || '101,202,303,404').split(',').map(Number);
const scenarios = (process.env.STAR_SCENARIOS || 'mid,top').split(',');
const LEAGUES = ['ESP1', 'ENG1', 'ITA1', 'GER1', 'FRA1'];

function bestGenerationalForward(world) {
  // Forwards first; a world without a Generational forward uses its best Generational attacker.
  const order = { FW: 0, MF: 1, DF: 2, GK: 3 };
  return world.players.filter((player) => player.status === 'active' && player.rarity === 'generational' && player.clubId)
    .sort((a, b) => order[a.position] - order[b.position] || b.rating - a.rating)[0];
}

function powerRanks(world, leagueId) {
  return world.clubs.filter((club) => club.leagueId === leagueId && club.division === 1)
    .map((club) => ({ id: club.id, power: getTeamPower(world, club.id) }))
    .sort((a, b) => b.power - a.power)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function eliteElsewhere(world, leagueId, clubId) {
  const ids = new Set(world.clubs.filter((club) => club.leagueId === leagueId && club.id !== clubId).map((club) => club.id));
  const rows = world.players.filter((player) => player.status === 'active' && ids.has(player.clubId));
  return { generational: rows.filter((p) => p.rarity === 'generational').length, legend: rows.filter((p) => p.rarity === 'legend').length };
}

// Expected points over a double round-robin from the pre-season match model (no dice),
// and the club's rank in that expected table: a noise-free view of the star's effect.
function expectedTable(world, leagueId, clubId) {
  const ids = world.clubs.filter((club) => club.leagueId === leagueId && club.division === 1).map((club) => club.id);
  const points = new Map(ids.map((id) => [id, 0]));
  for (const homeId of ids) for (const awayId of ids) {
    if (homeId === awayId) continue;
    const [home, draw, away] = getFixtureOdds(world, { homeId, awayId, competitionId: leagueId }).probabilities;
    points.set(homeId, points.get(homeId) + home * 3 + draw);
    points.set(awayId, points.get(awayId) + away * 3 + draw);
  }
  const ranked = [...points].sort((a, b) => b[1] - a[1]);
  return { points: Math.round(points.get(clubId)), rank: ranked.findIndex(([id]) => id === clubId) + 1 };
}

function finalPosition(world, leagueId, clubId) {
  return getLeagueTable(world, leagueId).findIndex((row) => row.teamId === clubId) + 1;
}

function pickTarget(world, leagueId, scenario, star) {
  const ranks = powerRanks(world, leagueId).filter((row) => row.id !== star.clubId);
  const band = scenario === 'top' ? ranks.filter((row) => row.rank >= 2 && row.rank <= 5) : ranks.filter((row) => row.rank >= 10 && row.rank <= 14);
  return band[Math.floor(band.length / 2)] || null;
}

const runs = [];
const started = performance.now();
for (const [index, seed] of seeds.entries()) {
  const leagueId = LEAGUES[index % LEAGUES.length];
  for (const scenario of scenarios) {
    const probe = createWorld(seed);
    const star = bestGenerationalForward(probe);
    const target = pickTarget(probe, leagueId, scenario, star);
    if (!star || !target) { runs.push({ seed, scenario, skipped: true }); continue; }

    const base = createWorld(seed);
    const expectedWithout = expectedTable(base, leagueId, target.id);
    simulateToSeasonEnd(base);
    const without = finalPosition(base, leagueId, target.id);

    const world = createWorld(seed);
    const moving = world.players.find((player) => player.id === star.id);
    moving.lastClubId = moving.clubId;
    moving.clubId = target.id;
    moving.clubJoinedSeason = world.season;
    moving.transferProtectedUntilSeason = world.season + 2;
    moving.contractYears = Math.max(3, moving.contractYears || 0);
    invalidateRuntimeCache(world);
    const movedStar = moving;
    const powerAfter = powerRanks(world, leagueId).find((row) => row.id === target.id);
    const expectedWith = expectedTable(world, leagueId, target.id);
    simulateToSeasonEnd(world);
    const withStar = finalPosition(world, leagueId, target.id);
    const leagueSeason = (w) => w.history.playerSeasons.filter((row) => row.season === w.season && row.competitionId === leagueId);
    const goals = leagueSeason(world).filter((row) => row.playerId === star.id).reduce((sum, row) => sum + row.goals, 0);
    const teamGoals = (w) => getLeagueTable(w, leagueId).find((row) => row.teamId === target.id);
    runs.push({
      seed, scenario, leagueId, clubId: target.id, star: `${star.name} (${star.rating})`, stayed: movedStar.clubId === target.id,
      powerRank: { before: target.rank, after: powerAfter?.rank }, position: { without, with: withStar, gain: without - withStar }, starLeagueGoals: goals,
      expected: { without: expectedWithout, with: expectedWith, gain: expectedWithout.rank - expectedWith.rank },
      table: { without: (({ points, gf, ga }) => ({ points, gf, ga }))(teamGoals(base)), with: (({ points, gf, ga }) => ({ points, gf, ga }))(teamGoals(world)) },
      rivalsElite: eliteElsewhere(world, leagueId, target.id)
    });
  }
}

const summary = {};
for (const scenario of scenarios) {
  const rows = runs.filter((row) => row.scenario === scenario && !row.skipped);
  if (!rows.length) continue;
  summary[scenario] = {
    runs: rows.length,
    averageGain: Number((rows.reduce((sum, row) => sum + row.position.gain, 0) / rows.length).toFixed(2)),
    top3: rows.filter((row) => row.position.with <= 3).length,
    top6: rows.filter((row) => row.position.with <= 6).length,
    top8: rows.filter((row) => row.position.with <= 8).length,
    titles: rows.filter((row) => row.position.with === 1).length,
    expectedRankGain: Number((rows.reduce((sum, row) => sum + row.expected.gain, 0) / rows.length).toFixed(2)),
    expectedPointsGain: Number((rows.reduce((sum, row) => sum + row.expected.with.points - row.expected.without.points, 0) / rows.length).toFixed(1))
  };
}
console.log(JSON.stringify({ runs, summary, seconds: Math.round((performance.now() - started) / 1000) }, null, 2));
