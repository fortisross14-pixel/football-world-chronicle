import {
  createWorld,
  simulateToSeasonEnd,
  getLeagueTable,
  getTeamPower
} from '../src/engine.js';

const majorLeagues = ['ESP1', 'ENG1', 'ITA1', 'GER1', 'FRA1'];
const leagueSeedCount = Number(process.env.V20_LEAGUE_SEEDS || 2);
const superstarSeedCount = Number(process.env.V20_SUPERSTAR_SEEDS || 2);
const coachSeedCount = Number(process.env.V20_COACH_SEEDS || 2);

const leagueSeeds = Array.from({ length: leagueSeedCount }, (_, index) => 42000 + index * 911);
let favoriteWins = 0;
let topThreeWins = 0;
let favoriteFinishTotal = 0;
let favoriteDeepFailures = 0;
let leagueEditions = 0;
let sameClubPodiums = 0;

for (const seed of leagueSeeds) {
  const world = createWorld(seed);
  const preseason = Object.fromEntries(majorLeagues.map((competitionId) => [
    competitionId,
    world.current.leagues[competitionId].table
      .map((row) => row.teamId)
      .sort((a, b) => getTeamPower(world, b, false) - getTeamPower(world, a, false))
  ]));
  simulateToSeasonEnd(world);
  for (const competitionId of majorLeagues) {
    const table = getLeagueTable(world, competitionId);
    const favoriteId = preseason[competitionId][0];
    const favoriteFinish = table.findIndex((row) => row.teamId === favoriteId) + 1;
    const championId = table[0]?.teamId;
    leagueEditions += 1;
    favoriteFinishTotal += favoriteFinish;
    if (favoriteFinish > 5) favoriteDeepFailures += 1;
    if (championId === favoriteId) favoriteWins += 1;
    if (preseason[competitionId].slice(0, 3).includes(championId)) topThreeWins += 1;
  }
  const podium = world.history.awards
    .filter((award) => award.season === world.season && award.category === 'ballon_dor')
    .sort((a, b) => a.rank - b.rank);
  const clubs = podium.map((award) => world.players.find((player) => player.id === award.playerId)?.clubId);
  if (clubs.length === 3 && new Set(clubs).size === 1) sameClubPodiums += 1;
}

let superstarTitles = 0;
let superstarTopThreeFinishes = 0;
let superstarTopScorer = 0;
let superstarTopThreeScorer = 0;
const superstarFinishes = [];
const superstarScorerRanks = [];
for (let index = 0; index < superstarSeedCount; index += 1) {
  const world = createWorld(70000 + index * 37);
  const club = world.clubs.find((item) => item.name === 'Molde');
  const roster = world.players.filter((player) => player.clubId === club.id && player.status === 'active').sort((a, b) => b.rating - a.rating);
  const star = roster.find((player) => player.position === 'FW') || roster[0];
  const second = roster.find((player) => player.id !== star.id);
  Object.assign(star, { baseQuality: 90, rating: 90, rarity: 'legend', role: 'striker', roleLabel: 'Striker' });
  Object.assign(second, { baseQuality: 86, rating: 86, rarity: 'rare' });
  simulateToSeasonEnd(world);
  const table = [...world.current.leagues[club.leagueId].table].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  const finish = table.findIndex((row) => row.teamId === club.id) + 1;
  const scoring = (world.current.archivedPlayerStats || [])
    .filter((row) => row.competitionId === club.leagueId)
    .sort((a, b) => b.goals - a.goals || b.averageRating - a.averageRating);
  const scorerRank = scoring.findIndex((row) => row.playerId === star.id) + 1;
  superstarFinishes.push(finish);
  superstarScorerRanks.push(scorerRank);
  if (finish === 1) superstarTitles += 1;
  if (finish <= 3) superstarTopThreeFinishes += 1;
  if (scorerRank === 1) superstarTopScorer += 1;
  if (scorerRank <= 3) superstarTopThreeScorer += 1;
}

let regularityPoints = 0;
let tournamentPoints = 0;
let regularityAhead = 0;
let regularityFinals = 0;
let tournamentFinals = 0;
for (let index = 0; index < coachSeedCount; index += 1) {
  const world = createWorld(88000 + index * 233);
  const regularityClub = world.clubs.find((club) => club.id === 'real-madrid');
  const tournamentClub = world.clubs.find((club) => club.id === 'atletico');
  for (const club of [regularityClub, tournamentClub]) {
    Object.assign(club, { strength: 86, reputation: 86, form: 0, ownerSportingBonus: 0 });
    world.players.filter((player) => player.clubId === club.id && player.status === 'active').forEach((player) => {
      player.rating = 84;
      player.baseQuality = 84;
    });
  }
  const regularityCoach = world.coaches.find((coach) => coach.id === regularityClub.coachId);
  const tournamentCoach = world.coaches.find((coach) => coach.id === tournamentClub.coachId);
  Object.assign(regularityCoach, { quality: 90, rarity: 'legend', profile: 'adaptive', focus: 'regularity' });
  Object.assign(tournamentCoach, { quality: 90, rarity: 'legend', profile: 'adaptive', focus: 'tournament' });
  simulateToSeasonEnd(world);
  const table = getLeagueTable(world, 'ESP1');
  const regularityRow = table.find((row) => row.teamId === regularityClub.id);
  const tournamentRow = table.find((row) => row.teamId === tournamentClub.id);
  regularityPoints += regularityRow.points;
  tournamentPoints += tournamentRow.points;
  if (regularityRow.points > tournamentRow.points) regularityAhead += 1;
  const cup = world.current.domesticCups['CUP-ESP1'];
  if ([cup.championId, cup.finalistId].includes(regularityClub.id)) regularityFinals += 1;
  if ([cup.championId, cup.finalistId].includes(tournamentClub.id)) tournamentFinals += 1;
}

const report = {
  majorLeagueBalance: {
    seeds: leagueSeedCount,
    editions: leagueEditions,
    favoriteChampionRate: Number((favoriteWins / Math.max(1, leagueEditions)).toFixed(3)),
    topThreeChampionRate: Number((topThreeWins / Math.max(1, leagueEditions)).toFixed(3)),
    averageFavoriteFinish: Number((favoriteFinishTotal / Math.max(1, leagueEditions)).toFixed(2)),
    favoriteFinishesBelowFifth: favoriteDeepFailures,
    ballonPodiumsAllSameClub: sameClubPodiums
  },
  superstarScenario: {
    seeds: superstarSeedCount,
    finishes: superstarFinishes,
    scorerRanks: superstarScorerRanks,
    titleRate: Number((superstarTitles / superstarSeedCount).toFixed(3)),
    topThreeFinishRate: Number((superstarTopThreeFinishes / superstarSeedCount).toFixed(3)),
    topScorerRate: Number((superstarTopScorer / superstarSeedCount).toFixed(3)),
    topThreeScorerRate: Number((superstarTopThreeScorer / superstarSeedCount).toFixed(3))
  },
  coachFocusScenario: {
    seeds: coachSeedCount,
    regularityAverageLeaguePoints: Number((regularityPoints / coachSeedCount).toFixed(2)),
    tournamentAverageLeaguePoints: Number((tournamentPoints / coachSeedCount).toFixed(2)),
    regularityFinishedAhead: regularityAhead,
    regularityCupFinals: regularityFinals,
    tournamentCupFinals: tournamentFinals
  }
};

console.log(JSON.stringify(report, null, 2));

if (report.majorLeagueBalance.topThreeChampionRate < 0.75) process.exitCode = 2;
if (report.majorLeagueBalance.favoriteFinishesBelowFifth > Math.max(1, leagueEditions * 0.1)) process.exitCode = 2;
if (report.superstarScenario.topThreeFinishRate < 0.75 || report.superstarScenario.topThreeScorerRate < 0.75) process.exitCode = 2;
if (report.coachFocusScenario.regularityAverageLeaguePoints <= report.coachFocusScenario.tournamentAverageLeaguePoints) process.exitCode = 2;
