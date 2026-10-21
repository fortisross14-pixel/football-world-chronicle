// Match and award calibration harness.
// Simulates several seeds over several seasons and reports match statistics per
// competition tier against real-world targets, plus award/title spread and timing.
//
//   npm run calibration
//   CAL_SEEDS=314159,271828 CAL_SEASONS=4 npm run calibration
//   CAL_JSON=docs/CALIBRATION_LATEST.json npm run calibration   (also writes JSON)
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// CAL_ENGINE=scripts/fixtures/legacy-r25/src/engine.js measures the v3.16.1 baseline.
const engineUrl = process.env.CAL_ENGINE ? pathToFileURL(resolve(process.env.CAL_ENGINE)).href : new URL('../src/engine.js', import.meta.url).href;
const { createWorld, simulateWeeks, simulateNextWeek, startNextSeason, getTeamPower } = await import(engineUrl);
const { CONTINENTAL_DEFINITIONS, LEAGUE_DEFINITIONS } = await import(new URL('data.js', engineUrl).href);

const seeds = String(process.env.CAL_SEEDS || '314159,271828,161803')
  .split(',').map((value) => Number(value.trim())).filter(Number.isFinite);
const seasons = Number(process.env.CAL_SEASONS || 6);
const ELITE = new Set(['ESP1', 'ENG1', 'ITA1', 'GER1', 'FRA1']);
const CONTINENTAL = new Set(CONTINENTAL_DEFINITIONS.map((definition) => definition.id));
const LEAGUE_TIER = new Map(LEAGUE_DEFINITIONS.map((definition) => [definition.id, definition.tier]));

const TARGETS = {
  goalsPerMatch: [2.6, 2.8],
  homeWin: [0.43, 0.47], draw: [0.25, 0.29], awayWin: [0.26, 0.30],
  shotsPerTeam: [12, 13], onTargetPerTeam: [4, 5], cornersPerTeam: [4.5, 5.5],
  yellowPerTeam: [1.8, 2.2], redPerMatch: [0.08, 0.13], cleanSheetRate: [0.26, 0.32]
};

function bucketFor(match) {
  if (match.isInternational) return 'International';
  const id = match.competitionId;
  if (CONTINENTAL.has(id) || id === 'CWC' || id === 'ICUP') return 'Continental & global';
  if (String(id).startsWith('CUP-') || String(id).startsWith('SC-')) return 'Domestic cups';
  if (ELITE.has(id)) return 'Elite leagues (ENG/ESP/ITA/GER/FRA)';
  if (LEAGUE_TIER.get(id) === 'detailed') return 'Other full leagues';
  return 'Other';
}

function emptyBucket() {
  return {
    matches: 0, goals: 0, home: 0, draw: 0, away: 0, leagueMatches: 0,
    shots: 0, onTarget: 0, corners: 0, yellow: 0, red: 0, cleanSheets: 0,
    knockouts: 0, extraTime: 0, penalties: 0, statMatches: 0
  };
}

function addMatch(bucket, match) {
  bucket.matches += 1;
  bucket.goals += match.homeGoals + match.awayGoals;
  if (!match.knockout) {
    bucket.leagueMatches += 1;
    if (match.homeGoals > match.awayGoals) bucket.home += 1;
    else if (match.homeGoals < match.awayGoals) bucket.away += 1;
    else bucket.draw += 1;
  }
  if (match.stats?.home && match.stats?.away) {
    bucket.statMatches += 1;
    for (const side of ['home', 'away']) {
      const stats = match.stats[side];
      bucket.shots += stats.shots || 0;
      bucket.onTarget += stats.onTarget || 0;
      bucket.corners += stats.corners || 0;
      bucket.yellow += stats.yellow || 0;
      bucket.red += stats.red || 0;
    }
  }
  if (match.awayGoals === 0) bucket.cleanSheets += 1;
  if (match.homeGoals === 0) bucket.cleanSheets += 1;
  if (match.knockout) {
    bucket.knockouts += 1;
    if (match.extraTime) bucket.extraTime += 1;
    if (match.penalties) bucket.penalties += 1;
  }
}

function summarise(bucket) {
  const per = (value, count) => (count ? Number((value / count).toFixed(3)) : null);
  return {
    matches: bucket.matches,
    goalsPerMatch: per(bucket.goals, bucket.matches),
    homeWin: per(bucket.home, bucket.leagueMatches),
    draw: per(bucket.draw, bucket.leagueMatches),
    awayWin: per(bucket.away, bucket.leagueMatches),
    shotsPerTeam: per(bucket.shots, bucket.statMatches * 2),
    onTargetPerTeam: per(bucket.onTarget, bucket.statMatches * 2),
    cornersPerTeam: per(bucket.corners, bucket.statMatches * 2),
    yellowPerTeam: per(bucket.yellow, bucket.statMatches * 2),
    redPerMatch: per(bucket.red, bucket.statMatches),
    cleanSheetRate: per(bucket.cleanSheets, bucket.matches * 2),
    extraTimeRate: per(bucket.extraTime, bucket.knockouts),
    penaltyRate: per(bucket.penalties, bucket.knockouts)
  };
}

const GAP_BINS = [[0, 3], [3, 6], [6, 10], [10, 15], [15, Infinity]];
function gapBin(gap) {
  const index = GAP_BINS.findIndex(([min, max]) => gap >= min && gap < max);
  return `${GAP_BINS[index][0]}–${Number.isFinite(GAP_BINS[index][1]) ? GAP_BINS[index][1] : '+'}`;
}

const buckets = new Map();
const overall = emptyBucket();
const summaryLeague = { matches: 0, goals: 0, draws: 0, cleanSheets: 0 };
const favourite = new Map(GAP_BINS.map(([min, max]) => [gapBin(min), { matches: 0, win: 0, draw: 0, loss: 0 }]));
const awards = { ballon: [], goldenBoot: [], uclWinners: [], leagueChampions: new Map(), topScorerShare: [], topScorerGoals: [] };
const timings = { seasonSeconds: [], offseasonSeconds: [] };
const styleRows = new Map();
const ratingByPosition = new Map();
const ballonPositions = new Map();
const subsPerTeam = { subs: 0, teams: 0 };
const availability = { changed: [0, 0], full: [0, 0], injuries: 0, teamSeasons: 0 };
const scorerClubSpread = [];

for (const seed of seeds) {
  const world = createWorld(seed);
  for (let index = 0; index < seasons; index += 1) {
    const startedAt = performance.now();
    // Week 52 closes the season and clears the match list, so read matches after week 51.
    simulateWeeks(world, 51);
    const powers = new Map();
    const power = (id, international) => {
      const key = `${international ? 'n' : 'c'}:${id}`;
      if (!powers.has(key)) powers.set(key, getTeamPower(world, id, international));
      return powers.get(key);
    };
    const matches = [...world.current.matches];
    simulateNextWeek(world);
    const lastWeek = (world.current.archivedKnockoutMatches || []).filter((match) => match.week === 52);
    matches.push(...lastWeek.filter((match) => !matches.some((row) => row.id === match.id)));
    timings.seasonSeconds.push((performance.now() - startedAt) / 1000);

    const styleOf = (id, international) => (international
      ? world.nationalTeams.find((team) => team.id === id)?.coachProfile
      : world.clubs.find((club) => club.id === id)?.coachProfile) || 'none';
    const clubStyle = new Map(world.clubs.map((club) => [club.id, club.coachProfile || 'none']));
    for (const match of matches) {
      if (Array.isArray(match.subs)) { subsPerTeam.subs += match.subs.length; subsPerTeam.teams += 2; }
      if (!match.knockout && LEAGUE_TIER.get(match.competitionId) === 'detailed') {
        for (const side of ['home', 'away']) {
          const own = side === 'home' ? match.homeGoals : match.awayGoals;
          const other = side === 'home' ? match.awayGoals : match.homeGoals;
          const points = own > other ? 3 : own === other ? 1 : 0;
          const bucket = match.rotation?.[side] ? availability.changed : availability.full;
          bucket[0] += points; bucket[1] += 1;
        }
      }
      if (!match.isInternational) {
        for (const [id, own, other] of [[match.homeId, match.homeGoals, match.awayGoals], [match.awayId, match.awayGoals, match.homeGoals]]) {
          const style = clubStyle.get(id) || styleOf(id, false);
          const row = styleRows.get(style) || { matches: 0, points: 0, wins: 0, goalsFor: 0, goalsAgainst: 0 };
          row.matches += 1; row.goalsFor += own; row.goalsAgainst += other;
          if (own > other) { row.points += 3; row.wins += 1; } else if (own === other) row.points += 1;
          styleRows.set(style, row);
        }
      }
      const name = bucketFor(match);
      if (!buckets.has(name)) buckets.set(name, emptyBucket());
      addMatch(buckets.get(name), match);
      addMatch(overall, match);
      const homePower = power(match.homeId, match.isInternational) + (match.knockout && /final/i.test(match.stage || '') && !/semi|quarter/i.test(match.stage || '') ? 0 : 2);
      const awayPower = power(match.awayId, match.isInternational);
      const gap = Math.abs(homePower - awayPower);
      const favId = homePower >= awayPower ? match.homeId : match.awayId;
      const row = favourite.get(gapBin(gap));
      row.matches += 1;
      const winnerId = match.winnerId || (match.homeGoals > match.awayGoals ? match.homeId : match.awayGoals > match.homeGoals ? match.awayId : null);
      if (!winnerId) row.draw += 1;
      else if (winnerId === favId) row.win += 1;
      else row.loss += 1;
    }

    // Condensed leagues only keep tables, so they are reported separately.
    for (const league of Object.values(world.current.leagues)) {
      if (league.tier !== 'summary') continue;
      for (const tableRow of league.table) {
        summaryLeague.goals += tableRow.gf;
        summaryLeague.draws += tableRow.draws;
        summaryLeague.cleanSheets += tableRow.cleanSheets || 0;
        summaryLeague.matches += tableRow.played;
      }
    }

    for (const player of world.players) availability.injuries += (player.injuries || []).filter(([season]) => season === world.season).length;
    const positionById = new Map(world.players.map((player) => [player.id, player.position]));
    for (const stat of world.current.archivedPlayerStats || []) {
      if (!stat.apps) continue;
      const position = positionById.get(stat.playerId) || '?';
      const row = ratingByPosition.get(position) || { apps: 0, weighted: 0 };
      row.apps += stat.apps; row.weighted += (stat.averageRating || 0) * stat.apps;
      ratingByPosition.set(position, row);
    }
    const seasonAwards = world.history.awards.filter((row) => row.season === world.season);
    for (const row of seasonAwards.filter((item) => item.name === "Ballon d'Or")) {
      const position = positionById.get(row.playerId) || '?';
      ballonPositions.set(position, (ballonPositions.get(position) || 0) + 1);
    }
    const ballon = seasonAwards.find((row) => row.name === "Ballon d'Or" && row.rank === 1);
    const boot = seasonAwards.find((row) => row.name === 'World Golden Boot' && row.rank === 1);
    const playerClub = (playerId) => {
      const stats = (world.current.archivedPlayerStats || []).filter((stat) => stat.playerId === playerId && !stat.isInternational);
      const counts = new Map();
      for (const stat of stats) counts.set(stat.teamId, (counts.get(stat.teamId) || 0) + stat.apps);
      return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    };
    if (ballon) awards.ballon.push({ seed, season: world.season, playerId: ballon.playerId, clubId: playerClub(ballon.playerId) });
    if (boot) awards.goldenBoot.push({ seed, season: world.season, playerId: boot.playerId, clubId: playerClub(boot.playerId), goals: boot.details?.goals });
    const ucl = world.history.champions.find((row) => row.season === world.season && row.competitionId === 'UCL');
    if (ucl) awards.uclWinners.push(`${seed}:${ucl.winnerId}`);
    for (const leagueId of ELITE) {
      const champion = world.history.champions.find((row) => row.season === world.season && row.competitionId === leagueId);
      if (!champion) continue;
      const key = `${seed}:${leagueId}`;
      if (!awards.leagueChampions.has(key)) awards.leagueChampions.set(key, []);
      awards.leagueChampions.get(key).push(champion.winnerId);
      const leagueStats = (world.current.archivedPlayerStats || []).filter((stat) => stat.competitionId === leagueId);
      const leagueGoals = matches.filter((match) => match.competitionId === leagueId).reduce((sum, match) => sum + match.homeGoals + match.awayGoals, 0);
      const sorted = [...leagueStats].sort((a, b) => b.goals - a.goals);
      if (sorted[0] && leagueGoals) {
        awards.topScorerGoals.push(sorted[0].goals);
        awards.topScorerShare.push(sorted[0].goals / leagueGoals);
        scorerClubSpread.push(new Set(sorted.slice(0, 10).map((stat) => stat.teamId)).size);
      }
    }

    if (index < seasons - 1) {
      const offseasonStartedAt = performance.now();
      startNextSeason(world);
      timings.offseasonSeconds.push((performance.now() - offseasonStartedAt) / 1000);
    }
  }
}

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const distinct = (values) => new Set(values).size;
const maxShare = (values) => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Math.max(0, ...counts.values());
};
const perSeedDistinct = (rows, key) => average(seeds.map((seed) => distinct(rows.filter((row) => row.seed === seed).map((row) => row[key]))));

const leagueChampionRows = [...awards.leagueChampions.values()];
const report = {
  seeds,
  seasons,
  targets: TARGETS,
  overall: summarise(overall),
  byTier: Object.fromEntries([...buckets].sort().map(([name, bucket]) => [name, summarise(bucket)])),
  condensedLeagues: {
    teamMatches: summaryLeague.matches,
    goalsPerMatch: Number((summaryLeague.goals * 2 / Math.max(1, summaryLeague.matches)).toFixed(3)),
    draw: Number((summaryLeague.draws / Math.max(1, summaryLeague.matches)).toFixed(3)),
    cleanSheetRate: Number((summaryLeague.cleanSheets / Math.max(1, summaryLeague.matches)).toFixed(3))
  },
  favouriteByStrengthGap: Object.fromEntries([...favourite].map(([bin, row]) => [bin, {
    matches: row.matches,
    favouriteWin: Number((row.win / Math.max(1, row.matches)).toFixed(3)),
    draw: Number((row.draw / Math.max(1, row.matches)).toFixed(3)),
    upset: Number((row.loss / Math.max(1, row.matches)).toFixed(3))
  }])),
  spread: {
    ballonDorDistinctPlayersPerSeed: Number(perSeedDistinct(awards.ballon, 'playerId').toFixed(2)),
    ballonDorDistinctClubsPerSeed: Number(perSeedDistinct(awards.ballon, 'clubId').toFixed(2)),
    goldenBootDistinctPlayersPerSeed: Number(perSeedDistinct(awards.goldenBoot, 'playerId').toFixed(2)),
    goldenBootAverageGoals: Number(average(awards.goldenBoot.map((row) => row.goals || 0)).toFixed(1)),
    uclDistinctWinnersPerSeed: Number(average(seeds.map((seed) => distinct(awards.uclWinners.filter((row) => row.startsWith(`${seed}:`))))).toFixed(2)),
    eliteLeagueDistinctChampionsPerLeague: Number(average(leagueChampionRows.map((rows) => distinct(rows))).toFixed(2)),
    eliteLeagueMostTitlesByOneClub: Number(average(leagueChampionRows.map((rows) => maxShare(rows))).toFixed(2)),
    eliteLeagueTopScorerGoals: Number(average(awards.topScorerGoals).toFixed(1)),
    eliteLeagueTopScorerShareOfGoals: Number(average(awards.topScorerShare).toFixed(3)),
    eliteLeagueTop10ScorerClubs: Number(average(scorerClubSpread).toFixed(1))
  },
  styles: Object.fromEntries([...styleRows].sort((a, b) => b[1].matches - a[1].matches).map(([style, row]) => [style, {
    teamMatches: row.matches,
    pointsPerGame: Number((row.points / Math.max(1, row.matches)).toFixed(3)),
    winRate: Number((row.wins / Math.max(1, row.matches)).toFixed(3)),
    goalsFor: Number((row.goalsFor / Math.max(1, row.matches)).toFixed(2)),
    goalsAgainst: Number((row.goalsAgainst / Math.max(1, row.matches)).toFixed(2))
  }])),
  averageRatingByPosition: Object.fromEntries([...ratingByPosition].map(([position, row]) => [position, Number((row.weighted / Math.max(1, row.apps)).toFixed(2))])),
  ballonDorPodiumPositions: Object.fromEntries(ballonPositions),
  availability: availability.full[1] ? {
    injuriesPerSeason: Math.round(availability.injuries / (seeds.length * seasons)),
    pointsPerGameFullStrength: Number((availability.full[0] / Math.max(1, availability.full[1])).toFixed(3)),
    pointsPerGameWithForcedChanges: Number((availability.changed[0] / Math.max(1, availability.changed[1])).toFixed(3)),
    shareOfLeagueGamesWithForcedChanges: Number((availability.changed[1] / Math.max(1, availability.changed[1] + availability.full[1])).toFixed(3))
  } : null,
  substitutionsPerTeam: subsPerTeam.teams ? Number((subsPerTeam.subs / subsPerTeam.teams).toFixed(2)) : null,
  timing: {
    averageSeasonSeconds: Number(average(timings.seasonSeconds).toFixed(2)),
    averageOffseasonSeconds: Number(average(timings.offseasonSeconds).toFixed(2))
  }
};

const outside = [];
for (const [key, [min, max]] of Object.entries(TARGETS)) {
  const value = report.overall[key];
  if (value == null) continue;
  if (value < min * 0.97 || value > max * 1.03) outside.push(`${key}=${value} (target ${min}–${max})`);
}
report.outsideTargets = outside;

if (process.env.CAL_JSON) writeFileSync(process.env.CAL_JSON, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
