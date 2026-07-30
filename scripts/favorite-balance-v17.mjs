import { createWorld, simulateNextWeek, getTeamPower } from '../src/engine.js';

const seedCount = Number(process.env.FAVORITE_TEST_SEEDS || 8);
const seedStart = Number(process.env.FAVORITE_TEST_START || 987650);
const seeds = Array.from({ length: seedCount }, (_, index) => seedStart + index * 7919);
const competitions = ['UCL', 'LIB', 'WC'];
const records = [];

const competitionTeams = (competition) => [...new Set((competition?.groups || []).flatMap((group) => group.teamIds || []))];

for (const seed of seeds) {
  const world = createWorld(seed);
  const favorites = {};
  for (const id of ['UCL', 'LIB']) {
    const competition = world.current.continentalCompetitions[id];
    favorites[id] = competitionTeams(competition)
      .sort((a, b) => getTeamPower(world, b, false) - getTeamPower(world, a, false))
      .slice(0, 5);
  }

  while (!world.current.completed) {
    simulateNextWeek(world);
    const worldCup = world.current.internationalCompetitions?.WC;
    if (!favorites.WC && worldCup?.groups?.length) {
      favorites.WC = competitionTeams(worldCup)
        .sort((a, b) => getTeamPower(world, b, true) - getTeamPower(world, a, true))
        .slice(0, 5);
    }
  }

  for (const id of competitions) {
    const competition = id === 'WC'
      ? world.current.internationalCompetitions.WC
      : world.current.continentalCompetitions[id];
    records.push({
      seed,
      competitionId: id,
      championId: competition?.championId || null,
      topFiveFavorite: Boolean(competition?.championId && favorites[id]?.includes(competition.championId)),
      favoriteIds: favorites[id] || []
    });
  }
}

const summary = Object.fromEntries(competitions.map((id) => {
  const rows = records.filter((row) => row.competitionId === id && row.championId);
  const hits = rows.filter((row) => row.topFiveFavorite).length;
  return [id, { editions: rows.length, topFiveWins: hits, rate: Number((hits / Math.max(1, rows.length)).toFixed(3)) }];
}));
const majorClubRows = records.filter((row) => ['UCL', 'LIB'].includes(row.competitionId) && row.championId);
const allRows = records.filter((row) => row.championId);
const report = {
  seeds: seedCount,
  editions: allRows.length,
  competitions: summary,
  majorClubTopFiveRate: Number((majorClubRows.filter((row) => row.topFiveFavorite).length / Math.max(1, majorClubRows.length)).toFixed(3)),
  overallTopFiveRate: Number((allRows.filter((row) => row.topFiveFavorite).length / Math.max(1, allRows.length)).toFixed(3)),
  darkHorseChampions: allRows.filter((row) => !row.topFiveFavorite).map((row) => ({ seed: row.seed, competitionId: row.competitionId, championId: row.championId }))
};

console.log(JSON.stringify(report, null, 2));
if (report.majorClubTopFiveRate < 0.60 || report.overallTopFiveRate < 0.60) process.exitCode = 2;
