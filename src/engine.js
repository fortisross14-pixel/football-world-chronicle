import {
  START_SEASON,
  LEAGUE_DEFINITIONS,
  NATIONAL_TEAMS,
  NAME_POOLS,
  POSITION_BLUEPRINT,
  COUNTRY_META
} from './data.js';

const COUNTRY_TO_CODE = Object.fromEntries(Object.entries(COUNTRY_META).map(([country, meta]) => [country, meta.code]));

const CODE_TO_COUNTRY = Object.fromEntries(NATIONAL_TEAMS.map(([id, name]) => [id, name]));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function random(state) {
  state.rngSeed = (Math.imul(1664525, state.rngSeed >>> 0) + 1013904223) >>> 0;
  return state.rngSeed / 4294967296;
}

function randomInt(state, min, max) {
  return Math.floor(random(state) * (max - min + 1)) + min;
}

function shuffle(state, array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(state, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pick(state, array) {
  return array[Math.floor(random(state) * array.length)];
}

function poisson(state, lambda) {
  const limit = Math.exp(-Math.max(0.05, lambda));
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random(state);
  } while (product > limit && count < 10);
  return count - 1;
}

function slug(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function formatSeason(season) {
  return `${season}-${String(season + 1).slice(-2)}`;
}

function makeTable(teamIds) {
  return teamIds.map((teamId) => ({
    teamId, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, form: []
  }));
}

function sortTable(rows) {
  return [...rows].sort((a, b) =>
    b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.teamId.localeCompare(b.teamId)
  );
}

function updateTable(rows, homeId, awayId, homeGoals, awayGoals) {
  const home = rows.find((row) => row.teamId === homeId);
  const away = rows.find((row) => row.teamId === awayId);
  if (!home || !away) return;
  home.played += 1;
  away.played += 1;
  home.gf += homeGoals;
  home.ga += awayGoals;
  away.gf += awayGoals;
  away.ga += homeGoals;
  if (homeGoals > awayGoals) {
    home.wins += 1;
    away.losses += 1;
    home.points += 3;
    home.form.push('W');
    away.form.push('L');
  } else if (awayGoals > homeGoals) {
    away.wins += 1;
    home.losses += 1;
    away.points += 3;
    away.form.push('W');
    home.form.push('L');
  } else {
    home.draws += 1;
    away.draws += 1;
    home.points += 1;
    away.points += 1;
    home.form.push('D');
    away.form.push('D');
  }
  home.form = home.form.slice(-5);
  away.form = away.form.slice(-5);
  home.gd = home.gf - home.ga;
  away.gd = away.gf - away.ga;
}

function roundRobin(teamIds) {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(null);
  const rounds = [];
  const n = teams.length;
  const rotating = teams.slice(1);
  const fixed = teams[0];
  for (let round = 0; round < n - 1; round += 1) {
    const left = [fixed, ...rotating.slice(0, (n - 2) / 2)];
    const right = rotating.slice((n - 2) / 2).reverse();
    const matches = [];
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] && right[i]) {
        const flip = round % 2 === 1;
        matches.push({ homeId: flip ? right[i] : left[i], awayId: flip ? left[i] : right[i] });
      }
    }
    rounds.push(matches);
    rotating.unshift(rotating.pop());
  }
  const reverse = rounds.map((matches) => matches.map(({ homeId, awayId }) => ({ homeId: awayId, awayId: homeId })));
  return [...rounds, ...reverse];
}

function createPlayer(state, club, slot, nationalityOverride = null, isNationalSpecialist = false) {
  const poolCountry = NAME_POOLS[club?.country] ? club.country : pick(state, Object.keys(NAME_POOLS));
  const pool = NAME_POOLS[poolCountry];
  const blueprint = POSITION_BLUEPRINT[slot % POSITION_BLUEPRINT.length];
  let nationality = nationalityOverride || COUNTRY_TO_CODE[club?.country] || 'esp';
  if (!nationalityOverride && club && random(state) < 0.24) nationality = pick(state, NATIONAL_TEAMS)[0];
  const age = isNationalSpecialist ? randomInt(state, 22, 31) : randomInt(state, 18, 32);
  const base = club ? club.strength : NATIONAL_TEAMS.find(([id]) => id === nationality)?.[2] || 75;
  const rating = clamp(Math.round(base + randomInt(state, -8, 6) + (slot >= 5 ? 1 : 0)), 58, 96);
  const first = pick(state, pool.first);
  const last = pick(state, pool.last);
  const idBase = `${club?.id || nationality}-${slug(first)}-${slug(last)}-${state.nextPlayerId}`;
  state.nextPlayerId += 1;
  return {
    id: idBase,
    name: `${first} ${last}`,
    clubId: club?.id || null,
    nationality,
    birthYear: START_SEASON - age,
    position: blueprint.position,
    role: blueprint.role,
    rating,
    potential: clamp(rating + randomInt(state, 0, age < 23 ? 9 : 3), rating, 97),
    fame: Math.max(10, rating - 55 + randomInt(state, 0, 12)),
    status: 'active',
    isNationalSpecialist
  };
}

function createClubsAndPlayers(state) {
  const clubs = [];
  const players = [];
  for (const league of LEAGUE_DEFINITIONS) {
    for (const [id, name, city, strength] of league.clubs) {
      const club = {
        id, name, city, strength, baseStrength: strength, leagueId: league.id, country: league.country,
        tier: league.tier, form: 0, fans: Math.round((strength - 55) ** 2 * 6200),
        finances: Math.round((strength - 55) ** 2 * 1.8), reputation: strength,
        crestHue: Math.abs([...id].reduce((sum, char) => sum + char.charCodeAt(0) * 7, 0)) % 360
      };
      clubs.push(club);
      const count = league.tier === 'detailed' ? 7 : 5;
      for (let slot = 0; slot < count; slot += 1) players.push(createPlayer(state, club, slot));
    }
  }

  for (const [nationalId] of NATIONAL_TEAMS) {
    while (players.filter((player) => player.nationality === nationalId && player.status === 'active').length < 7) {
      players.push(createPlayer(state, null, players.length % 7, nationalId, true));
    }
  }
  return { clubs, players };
}

function initializeLeagueState(state) {
  const leagues = {};
  for (const definition of LEAGUE_DEFINITIONS) {
    const clubIds = definition.clubs.map(([id]) => id);
    let schedule = roundRobin(clubIds);
    if (definition.tier === 'condensed') {
      const extra = schedule.map((round) => round.map(({ homeId, awayId }) => ({ homeId: awayId, awayId: homeId })));
      schedule = [...schedule, ...extra];
    }
    leagues[definition.id] = {
      id: definition.id,
      name: definition.name,
      country: definition.country,
      tier: definition.tier,
      table: makeTable(clubIds),
      rounds: schedule,
      championId: null
    };
  }
  return leagues;
}

function buildGroups(state, ids, groupCount = 4) {
  const shuffled = shuffle(state, ids);
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: String.fromCharCode(65 + index), teamIds: [], table: [], rounds: []
  }));
  shuffled.forEach((id, index) => groups[index % groupCount].teamIds.push(id));
  groups.forEach((group) => {
    group.table = makeTable(group.teamIds);
    group.rounds = roundRobin(group.teamIds);
  });
  return groups;
}

function initializeChampions(state) {
  const ranked = [...state.clubs].filter((club) => club.tier === 'detailed' || club.reputation >= 74).sort((a, b) => b.strength - a.strength);
  const countryCaps = { Spain: 4, England: 4, Italy: 4, Germany: 4, France: 3, Portugal: 3, Netherlands: 2, Belgium: 2, Scotland: 1, Türkiye: 1 };
  const selected = [];
  for (const [country, cap] of Object.entries(countryCaps)) selected.push(...ranked.filter((club) => club.country === country).slice(0, cap).map((club) => club.id));
  return { name: 'European Champions Cup', stage: 'Group Stage', groups: buildGroups(state, selected, 8), knockout: null, championId: null, finalistId: null };
}

function initializeInternational(state) {
  const ids = NATIONAL_TEAMS.filter((team) => team[3] === 'Europe').map(([id]) => id);
  return { id: 'EURO', name: 'European Championship', stage: 'Qualifying', groups: buildGroups(state, ids, 4), knockout: null, championId: null, finalistId: null };
}

function initializeCups(state) {
  const domesticCups = {};
  for (const league of LEAGUE_DEFINITIONS) {
    const cupId = `CUP-${league.id}`;
    domesticCups[cupId] = { id: cupId, leagueId: league.id, country: league.country, name: league.cupName, active: shuffle(state, league.clubs.map(([id]) => id)), stage: 'Opening Round', championId: null, finalistId: null, rounds: [] };
  }
  const spanish = state.clubs.filter((club) => club.country === 'Spain').sort((a, b) => b.strength - a.strength).slice(0, 4).map((club) => club.id);
  return { domesticCups, supercup: { id: 'SUPERCUP', name: 'Spanish Super Cup', active: spanish, stage: 'Semi-finals', championId: null, finalistId: null, rounds: [] } };
}

function newCurrentSeason(state) {
  const leagues = initializeLeagueState(state);
  const cups = initializeCups(state);
  return {
    season: state.season,
    seasonLabel: formatSeason(state.season),
    week: 0,
    date: `${state.season}-08-01`,
    leagues,
    domesticCups: cups.domesticCups,
    copa: cups.domesticCups['CUP-ESP1'],
    supercup: cups.supercup,
    champions: initializeChampions(state),
    international: initializeInternational(state),
    playerStats: {},
    playerMatchLogs: {},
    matches: [],
    news: [{
      id: `news-${state.season}-launch`, week: 0, importance: 'feature', category: 'World',
      headline: `${formatSeason(state.season)} football world opens`,
      body: 'Domestic leagues, continental football and the international cycle begin inside one persistent universe.'
    }],
    completed: false
  };
}

export function createWorld(seed = Date.now() % 2147483647) {
  const state = {
    version: 2,
    seed,
    rngSeed: seed >>> 0,
    nextPlayerId: 1,
    season: START_SEASON,
    clubs: [],
    players: [],
    nationalTeams: NATIONAL_TEAMS.map(([id, name, strength]) => ({ id, name, strength, form: 0 })),
    current: null,
    history: {
      playerSeasons: [], clubSeasons: [], awards: [], champions: [], honours: [], landmarkMatches: [], seasonReviews: []
    },
    preferences: { favoriteClubIds: ['real-madrid'], favoritePlayerIds: [], autoStopFinals: true }
  };
  const entities = createClubsAndPlayers(state);
  state.clubs = entities.clubs;
  state.players = entities.players;
  state.current = newCurrentSeason(state);
  return state;
}

function getClub(state, id) {
  return state.clubs.find((club) => club.id === id);
}

function getPlayer(state, id) {
  return state.players.find((player) => player.id === id);
}

function getTeamName(state, id, isInternational = false) {
  if (isInternational) return state.nationalTeams.find((team) => team.id === id)?.name || id;
  return getClub(state, id)?.name || id;
}

function playerWeight(player) {
  if (player.position === 'FW') return 8 + player.rating / 8;
  if (player.position === 'MF') return 3 + player.rating / 18;
  if (player.position === 'DF') return 0.8 + player.rating / 60;
  return 0.15;
}

function weightedPick(state, players, weightFn) {
  const weights = players.map(weightFn);
  const total = weights.reduce((sum, value) => sum + value, 0);
  let needle = random(state) * total;
  for (let i = 0; i < players.length; i += 1) {
    needle -= weights[i];
    if (needle <= 0) return players[i];
  }
  return players[players.length - 1];
}

function getClubLineup(state, clubId) {
  return state.players.filter((player) => player.clubId === clubId && player.status === 'active').sort((a, b) => b.rating - a.rating).slice(0, 7);
}

function getNationalLineup(state, nationalId) {
  return state.players.filter((player) => player.nationality === nationalId && player.status === 'active').sort((a, b) => b.rating - a.rating).slice(0, 7);
}

function ensurePlayerStat(state, playerId, competitionId, teamId, isInternational) {
  const key = `${playerId}::${competitionId}`;
  if (!state.current.playerStats[key]) {
    state.current.playerStats[key] = {
      playerId, competitionId, teamId, isInternational,
      apps: 0, starts: 0, goals: 0, assists: 0, cleanSheets: 0,
      ratingSum: 0, averageRating: 0, manOfTheMatch: 0
    };
  }
  return state.current.playerStats[key];
}

function addPlayerLog(state, playerId, entry) {
  if (!state.current.playerMatchLogs[playerId]) state.current.playerMatchLogs[playerId] = [];
  state.current.playerMatchLogs[playerId].push(entry);
}

function calculateTeamStrength(state, teamId, isInternational) {
  const lineup = isInternational ? getNationalLineup(state, teamId) : getClubLineup(state, teamId);
  const base = isInternational
    ? state.nationalTeams.find((team) => team.id === teamId)?.strength || 75
    : getClub(state, teamId)?.strength || 70;
  const average = lineup.length ? lineup.reduce((sum, player) => sum + player.rating, 0) / lineup.length : base - 5;
  const form = isInternational
    ? state.nationalTeams.find((team) => team.id === teamId)?.form || 0
    : getClub(state, teamId)?.form || 0;
  return base * 0.65 + average * 0.35 + form;
}

function resolveDraw(state, homeId, awayId, homeGoals, awayGoals, isInternational) {
  let hg = homeGoals;
  let ag = awayGoals;
  let extraTime = false;
  let penalties = null;
  if (hg === ag) {
    extraTime = true;
    const homeStrength = calculateTeamStrength(state, homeId, isInternational);
    const awayStrength = calculateTeamStrength(state, awayId, isInternational);
    const chanceHome = clamp(0.5 + (homeStrength - awayStrength) / 90, 0.36, 0.64);
    if (random(state) < 0.35) {
      if (random(state) < chanceHome) hg += 1;
      else ag += 1;
    } else {
      const homePens = randomInt(state, 3, 6);
      let awayPens = randomInt(state, 3, 6);
      if (homePens === awayPens) awayPens += random(state) < chanceHome ? -1 : 1;
      penalties = { home: Math.max(2, homePens), away: Math.max(2, awayPens) };
    }
  }
  const winnerId = penalties
    ? (penalties.home > penalties.away ? homeId : awayId)
    : (hg > ag ? homeId : awayId);
  return { homeGoals: hg, awayGoals: ag, extraTime, penalties, winnerId };
}

function simulateMatch(state, {
  homeId, awayId, competitionId, competitionName, week, knockout = false, isInternational = false,
  stage = null, table = null, neutral = false
}) {
  const homeStrength = calculateTeamStrength(state, homeId, isInternational) + (neutral ? 0 : 2.2);
  const awayStrength = calculateTeamStrength(state, awayId, isInternational);
  const difference = homeStrength - awayStrength;
  const homeLambda = clamp(1.38 + difference / 24, 0.25, 3.4);
  const awayLambda = clamp(1.08 - difference / 29, 0.2, 3.0);
  let homeGoals = poisson(state, homeLambda);
  let awayGoals = poisson(state, awayLambda);
  let resolution = null;
  if (knockout) {
    resolution = resolveDraw(state, homeId, awayId, homeGoals, awayGoals, isInternational);
    homeGoals = resolution.homeGoals;
    awayGoals = resolution.awayGoals;
  }

  const homeLineup = isInternational ? getNationalLineup(state, homeId) : getClubLineup(state, homeId);
  const awayLineup = isInternational ? getNationalLineup(state, awayId) : getClubLineup(state, awayId);
  const contributions = new Map();
  const goalEvents = [];
  const addContribution = (playerId, type) => {
    const item = contributions.get(playerId) || { goals: 0, assists: 0 };
    item[type] += 1;
    contributions.set(playerId, item);
  };
  const createGoals = (teamId, opponentId, count, lineup, side) => {
    for (let i = 0; i < count; i += 1) {
      if (!lineup.length) continue;
      const scorer = weightedPick(state, lineup, playerWeight);
      addContribution(scorer.id, 'goals');
      let assister = null;
      if (random(state) < 0.72 && lineup.length > 1) {
        const options = lineup.filter((player) => player.id !== scorer.id);
        assister = weightedPick(state, options, (player) => player.position === 'MF' ? 8 : player.position === 'FW' ? 5 : 2);
        addContribution(assister.id, 'assists');
      }
      goalEvents.push({
        teamId, opponentId, side, scorerId: scorer.id, assistId: assister?.id || null,
        minute: randomInt(state, 4, resolution?.extraTime ? 118 : 90)
      });
    }
  };
  createGoals(homeId, awayId, homeGoals, homeLineup, 'home');
  createGoals(awayId, homeId, awayGoals, awayLineup, 'away');
  goalEvents.sort((a, b) => a.minute - b.minute);

  const winnerSide = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw';
  const rateLineup = (lineup, teamId, side, goalsFor, goalsAgainst) => {
    lineup.forEach((player) => {
      const contribution = contributions.get(player.id) || { goals: 0, assists: 0 };
      let rating = 6.25 + random(state) * 0.8;
      rating += contribution.goals * 0.9 + contribution.assists * 0.45;
      if ((winnerSide === side) || (resolution?.winnerId === teamId)) rating += 0.32;
      if (winnerSide !== 'draw' && winnerSide !== side && !resolution) rating -= 0.22;
      if (player.position === 'GK' && goalsAgainst === 0) rating += 0.65;
      if (player.position === 'DF' && goalsAgainst === 0) rating += 0.3;
      rating = clamp(rating, 5.2, 10);
      const stat = ensurePlayerStat(state, player.id, competitionId, teamId, isInternational);
      stat.apps += 1;
      stat.starts += 1;
      stat.goals += contribution.goals;
      stat.assists += contribution.assists;
      if ((player.position === 'GK' || player.position === 'DF') && goalsAgainst === 0) stat.cleanSheets += 1;
      stat.ratingSum += rating;
      stat.averageRating = stat.ratingSum / stat.apps;
      addPlayerLog(state, player.id, {
        matchId: null,
        week,
        competitionId,
        competitionName,
        stage,
        teamId,
        opponentId: teamId === homeId ? awayId : homeId,
        home: teamId === homeId,
        goals: contribution.goals,
        assists: contribution.assists,
        cleanSheet: (player.position === 'GK' || player.position === 'DF') && goalsAgainst === 0,
        rating,
        score: `${homeGoals}-${awayGoals}`,
        result: resolution?.winnerId ? (resolution.winnerId === teamId ? 'W' : 'L') : (goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D'),
        isInternational
      });
    });
  };
  rateLineup(homeLineup, homeId, 'home', homeGoals, awayGoals);
  rateLineup(awayLineup, awayId, 'away', awayGoals, homeGoals);

  let manOfMatchId = null;
  const participants = [...homeLineup, ...awayLineup];
  if (participants.length) {
    const candidates = participants.map((player) => {
      const c = contributions.get(player.id) || { goals: 0, assists: 0 };
      return { id: player.id, score: player.rating + c.goals * 7 + c.assists * 3 + random(state) * 2 };
    }).sort((a, b) => b.score - a.score);
    manOfMatchId = candidates[0].id;
    const stat = ensurePlayerStat(state, manOfMatchId, competitionId,
      homeLineup.some((p) => p.id === manOfMatchId) ? homeId : awayId, isInternational);
    stat.manOfTheMatch += 1;
  }

  const id = `m-${state.season}-${week}-${state.current.matches.length + 1}`;
  for (const log of Object.values(state.current.playerMatchLogs)) {
    const last = log[log.length - 1];
    if (last && last.matchId === null && last.week === week && last.competitionId === competitionId && [homeId, awayId].includes(last.teamId)) last.matchId = id;
  }
  const match = {
    id, season: state.season, week, competitionId, competitionName, stage,
    homeId, awayId, homeGoals, awayGoals,
    winnerId: resolution?.winnerId || (homeGoals > awayGoals ? homeId : awayGoals > homeGoals ? awayId : null),
    extraTime: resolution?.extraTime || false,
    penalties: resolution?.penalties || null,
    goalEvents, manOfMatchId, isInternational, landmark: knockout && ['Final', 'Semi-final'].includes(stage)
  };
  state.current.matches.push(match);
  if (table) updateTable(table, homeId, awayId, homeGoals, awayGoals);

  if (!isInternational) {
    const homeClub = getClub(state, homeId);
    const awayClub = getClub(state, awayId);
    if (homeClub && awayClub) {
      const resultDelta = homeGoals > awayGoals ? 0.35 : homeGoals < awayGoals ? -0.28 : 0.05;
      homeClub.form = clamp(homeClub.form * 0.75 + resultDelta, -3, 3);
      awayClub.form = clamp(awayClub.form * 0.75 - resultDelta, -3, 3);
    }
  }

  generateMatchNews(state, match, homeStrength, awayStrength);
  return match;
}

function generateMatchNews(state, match, homeStrength, awayStrength) {
  const homeName = getTeamName(state, match.homeId, match.isInternational);
  const awayName = getTeamName(state, match.awayId, match.isInternational);
  const score = `${match.homeGoals}-${match.awayGoals}`;
  const scorerCounts = {};
  match.goalEvents.forEach((goal) => { scorerCounts[goal.scorerId] = (scorerCounts[goal.scorerId] || 0) + 1; });
  const hatTrick = Object.entries(scorerCounts).find(([, goals]) => goals >= 3);
  if (hatTrick) {
    const player = getPlayer(state, hatTrick[0]);
    state.current.news.unshift({
      id: `news-${match.id}-hat`, week: match.week, importance: 'major', category: match.competitionName,
      headline: `${player?.name || 'A star'} strikes ${hatTrick[1]} in a statement performance`,
      body: `${homeName} ${score} ${awayName}. The forward produced one of the season's defining individual displays.`,
      entityType: 'player', entityId: player?.id
    });
  }
  const strengthDiff = homeStrength - awayStrength;
  const upset = (strengthDiff > 8 && match.awayGoals > match.homeGoals) || (strengthDiff < -8 && match.homeGoals > match.awayGoals);
  if (upset) {
    const winnerId = match.homeGoals > match.awayGoals ? match.homeId : match.awayId;
    state.current.news.unshift({
      id: `news-${match.id}-upset`, week: match.week, importance: 'major', category: match.competitionName,
      headline: `${getTeamName(state, winnerId, match.isInternational)} overturn the hierarchy`,
      body: `${homeName} ${score} ${awayName} becomes a result that could reshape the season.`,
      entityType: match.isInternational ? 'nation' : 'club', entityId: winnerId
    });
  }
  if (match.stage === 'Final') {
    state.current.news.unshift({
      id: `news-${match.id}-final`, week: match.week, importance: 'feature', category: match.competitionName,
      headline: `${getTeamName(state, match.winnerId, match.isInternational)} lift the ${match.competitionName}`,
      body: `${homeName} ${score} ${awayName}${match.penalties ? ` (${match.penalties.home}-${match.penalties.away} pens)` : ''}.`,
      entityType: match.isInternational ? 'nation' : 'club', entityId: match.winnerId
    });
  }
}

function simulateLeagueWeek(state, week) {
  for (const league of Object.values(state.current.leagues)) {
    const roundIndex = week - 1;
    const round = league.rounds[roundIndex];
    if (!round) continue;
    round.forEach(({ homeId, awayId }) => simulateMatch(state, {
      homeId, awayId, competitionId: league.id, competitionName: league.name,
      week, stage: `Matchday ${roundIndex + 1}`, table: league.table
    }));
    if (roundIndex === league.rounds.length - 1) league.championId = sortTable(league.table)[0]?.teamId || null;
  }
}

function pairTeams(state, ids) {
  const shuffled = shuffle(state, ids);
  const pairs = [];
  for (let i = 0; i < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
  return pairs;
}

function simulateDomesticCupRound(state, cup, week) {
  if (cup.championId || cup.active.length < 2) return;
  let participants = [...cup.active];
  let byes = [];
  const bracketSize = 2 ** Math.ceil(Math.log2(participants.length));
  const byeCount = bracketSize - participants.length;
  if (byeCount > 0) { const shuffled = shuffle(state, participants); byes = shuffled.slice(0, byeCount); participants = shuffled.slice(byeCount); }
  const pairs = pairTeams(state, participants);
  const winners = [...byes];
  const stage = cup.active.length > 16 ? 'Opening Round' : cup.active.length === 16 ? 'Round of 16' : cup.active.length === 8 ? 'Quarter-final' : cup.active.length === 4 ? 'Semi-final' : 'Final';
  const roundMatches = [];
  pairs.forEach(([homeId, awayId]) => {
    if (!awayId) { winners.push(homeId); return; }
    const match = simulateMatch(state, { homeId, awayId, competitionId: cup.id, competitionName: cup.name, week, stage, knockout: true, neutral: stage === 'Final' });
    winners.push(match.winnerId); roundMatches.push(match.id);
    if (stage === 'Final') cup.finalistId = match.winnerId === homeId ? awayId : homeId;
  });
  cup.rounds.push({ week, stage, matchIds: roundMatches }); cup.active = winners;
  if (winners.length === 1) { cup.championId = winners[0]; cup.stage = 'Complete'; }
  else cup.stage = winners.length > 16 ? 'Opening Round' : winners.length === 16 ? 'Round of 16' : winners.length === 8 ? 'Quarter-finals' : winners.length === 4 ? 'Semi-finals' : 'Final';
}
function simulateDomesticCups(state, week) { Object.values(state.current.domesticCups).forEach((cup) => simulateDomesticCupRound(state, cup, week)); }

function simulateSuperCup(state, week) {
  const cup = state.current.supercup;
  if (cup.championId) return;
  const stage = cup.active.length === 4 ? 'Semi-final' : 'Final';
  const pairs = pairTeams(state, cup.active);
  const winners = [];
  const matchIds = [];
  pairs.forEach(([homeId, awayId]) => {
    const match = simulateMatch(state, {
      homeId, awayId, competitionId: 'SUPERCUP', competitionName: cup.name,
      week, stage, knockout: true, neutral: true
    });
    winners.push(match.winnerId);
    matchIds.push(match.id);
    if (stage === 'Final') cup.finalistId = match.winnerId === homeId ? awayId : homeId;
  });
  cup.rounds.push({ week, stage, matchIds });
  cup.active = winners;
  if (winners.length === 1) {
    cup.championId = winners[0];
    cup.stage = 'Complete';
  } else cup.stage = 'Final';
}

function simulateGroupRound(state, competition, competitionId, competitionName, week, roundIndex, isInternational) {
  competition.groups.forEach((group) => {
    const round = group.rounds[roundIndex];
    if (!round) return;
    round.forEach(({ homeId, awayId }) => simulateMatch(state, {
      homeId, awayId, competitionId, competitionName, week,
      stage: `${competition.stage} · Group ${group.id}`, table: group.table, isInternational
    }));
  });
}

function prepareChampionsKnockout(state) {
  const qualifiers = state.current.champions.groups.flatMap((group) => sortTable(group.table).slice(0, 2).map((row) => row.teamId));
  state.current.champions.knockout = { round: 'Round of 16', ties: pairTeams(state, qualifiers).map(([homeId, awayId]) => ({ homeId, awayId, firstLeg: null, secondLeg: null, winnerId: null })), rounds: [] };
  state.current.champions.stage = 'Round of 16';
}

function simulateTwoLegRound(state, week, leg) {
  const comp = state.current.champions;
  const ko = comp.knockout;
  const stage = ko.round;
  ko.ties.forEach((tie) => {
    const homeId = leg === 1 ? tie.homeId : tie.awayId;
    const awayId = leg === 1 ? tie.awayId : tie.homeId;
    const match = simulateMatch(state, {
      homeId, awayId, competitionId: 'UCL', competitionName: comp.name, week,
      stage: `${stage} · Leg ${leg}`, knockout: false
    });
    if (leg === 1) tie.firstLeg = match.id;
    else tie.secondLeg = match.id;
  });
  if (leg === 2) {
    const winners = [];
    ko.ties.forEach((tie) => {
      const first = state.current.matches.find((match) => match.id === tie.firstLeg);
      const second = state.current.matches.find((match) => match.id === tie.secondLeg);
      const homeAggregate = first.homeGoals + second.awayGoals;
      const awayAggregate = first.awayGoals + second.homeGoals;
      if (homeAggregate === awayAggregate) {
        const decider = resolveDraw(state, tie.homeId, tie.awayId, 0, 0, false);
        tie.winnerId = decider.winnerId;
      } else tie.winnerId = homeAggregate > awayAggregate ? tie.homeId : tie.awayId;
      winners.push(tie.winnerId);
    });
    ko.rounds.push({ stage, ties: structuredClone(ko.ties) });
    if (winners.length === 8) {
      ko.round = 'Quarter-final';
      ko.ties = pairTeams(state, winners).map(([homeId, awayId]) => ({ homeId, awayId, firstLeg: null, secondLeg: null, winnerId: null }));
      comp.stage = 'Quarter-finals';
    } else if (winners.length === 4) {
      ko.round = 'Semi-final';
      ko.ties = pairTeams(state, winners).map(([homeId, awayId]) => ({ homeId, awayId, firstLeg: null, secondLeg: null, winnerId: null }));
      comp.stage = 'Semi-finals';
    } else if (winners.length === 2) {
      ko.round = 'Final';
      ko.ties = [{ homeId: winners[0], awayId: winners[1], firstLeg: null, secondLeg: null, winnerId: null }];
      comp.stage = 'Final';
    }
  }
}

function simulateChampionsFinal(state, week) {
  const comp = state.current.champions;
  const tie = comp.knockout?.ties?.[0];
  if (!tie || comp.championId) return;
  const match = simulateMatch(state, {
    homeId: tie.homeId, awayId: tie.awayId, competitionId: 'UCL', competitionName: comp.name,
    week, stage: 'Final', knockout: true, neutral: true
  });
  comp.championId = match.winnerId;
  comp.finalistId = match.winnerId === tie.homeId ? tie.awayId : tie.homeId;
  comp.stage = 'Complete';
}

function prepareInternationalKnockout(state) {
  const sortedGroups = state.current.international.groups.map((group) => sortTable(group.table));
  const topTwo = sortedGroups.flatMap((rows) => rows.slice(0, 2).map((row) => row.teamId));
  const qualifiers = sortedGroups.length === 3 ? [...topTwo, ...sortedGroups.map((rows) => rows[2]).sort((a, b) => b.points - a.points || b.gd - a.gd).slice(0, 2).map((row) => row.teamId)] : topTwo.slice(0, 8);
  state.current.international.knockout = { round: 'Quarter-final', active: qualifiers, rounds: [] };
  state.current.international.stage = 'Quarter-finals';
}

function simulateInternationalKnockout(state, week) {
  const comp = state.current.international;
  if (comp.championId) return;
  const active = comp.knockout.active;
  const stage = active.length === 8 ? 'Quarter-final' : active.length === 4 ? 'Semi-final' : 'Final';
  const pairs = pairTeams(state, active);
  const winners = [];
  const matchIds = [];
  pairs.forEach(([homeId, awayId]) => {
    const match = simulateMatch(state, {
      homeId, awayId, competitionId: 'EURO', competitionName: comp.name,
      week, stage, knockout: true, isInternational: true, neutral: true
    });
    winners.push(match.winnerId);
    matchIds.push(match.id);
    if (stage === 'Final') comp.finalistId = match.winnerId === homeId ? awayId : homeId;
  });
  comp.knockout.rounds.push({ stage, matchIds });
  comp.knockout.active = winners;
  if (winners.length === 1) {
    comp.championId = winners[0];
    comp.stage = 'Complete';
  } else comp.stage = winners.length === 4 ? 'Semi-finals' : 'Final';
}

function advanceDate(state, days = 7) {
  const date = new Date(`${state.current.date}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  state.current.date = date.toISOString().slice(0, 10);
}

function addWeeklyDigest(state, week, matchCountBefore) {
  const matches = state.current.matches.slice(matchCountBefore);
  if (!matches.length) return;
  const biggest = [...matches].sort((a, b) => (b.homeGoals + b.awayGoals) - (a.homeGoals + a.awayGoals))[0];
  const favoriteResults = matches.filter((match) => state.preferences.favoriteClubIds.includes(match.homeId) || state.preferences.favoriteClubIds.includes(match.awayId));
  const highlight = favoriteResults[0] || biggest;
  state.current.news.unshift({
    id: `news-${state.season}-${week}-digest`, week, importance: 'digest', category: 'Weekly Review',
    headline: `Week ${week}: ${getTeamName(state, highlight.homeId, highlight.isInternational)} ${highlight.homeGoals}-${highlight.awayGoals} ${getTeamName(state, highlight.awayId, highlight.isInternational)}`,
    body: `${matches.length} matches were completed across the active football world. Tables, player races and qualification paths have been updated.`
  });
  state.current.news = state.current.news.slice(0, 120);
}

export function simulateNextWeek(state) {
  if (state.current.completed) return state;
  const week = state.current.week + 1;
  const before = state.current.matches.length;
  state.current.week = week;
  advanceDate(state, 7);
  simulateLeagueWeek(state, week);

  if (week === 1 || week === 2) simulateSuperCup(state, week);
  if ([5, 11, 17, 24, 31].includes(week)) simulateDomesticCups(state, week);

  const championsGroupWeeks = [4, 7, 10, 13, 16, 19];
  if (championsGroupWeeks.includes(week)) {
    simulateGroupRound(state, state.current.champions, 'UCL', state.current.champions.name, week, championsGroupWeeks.indexOf(week), false);
    if (week === 19) prepareChampionsKnockout(state);
  }
  if ([22, 24].includes(week)) simulateTwoLegRound(state, week, week === 22 ? 1 : 2);
  if ([27, 29].includes(week)) simulateTwoLegRound(state, week, week === 27 ? 1 : 2);
  if ([32, 34].includes(week)) simulateTwoLegRound(state, week, week === 32 ? 1 : 2);
  if (week === 38) simulateChampionsFinal(state, week);

  const qualifierWeeks = [3, 8, 14, 20, 28, 36];
  if (qualifierWeeks.includes(week)) {
    simulateGroupRound(state, state.current.international, 'EUROQ', 'European Championship Qualifying', week, qualifierWeeks.indexOf(week), true);
    if (week === 36) prepareInternationalKnockout(state);
  }
  if ([40, 42, 44].includes(week)) simulateInternationalKnockout(state, week);

  addWeeklyDigest(state, week, before);
  if (week >= 44) closeSeason(state);
  return state;
}

export function simulateWeeks(state, count) {
  for (let i = 0; i < count && !state.current.completed; i += 1) simulateNextWeek(state);
  return state;
}

export function simulateToSeasonEnd(state) {
  while (!state.current.completed) simulateNextWeek(state);
  return state;
}

function statsForCompetition(state, competitionId) {
  return Object.values(state.current.playerStats).filter((stat) => stat.competitionId === competitionId && stat.apps > 0);
}

function chooseBestPlayer(stats, formula) {
  return [...stats].sort((a, b) => formula(b) - formula(a))[0] || null;
}

function award(state, name, playerId, competitionId = null, rank = 1, category = null) {
  if (!playerId) return;
  state.history.awards.push({ id: `award-${state.season}-${slug(name)}-${playerId}-${rank}`, season: state.season, seasonLabel: formatSeason(state.season), name, playerId, competitionId, rank, category });
}
function calculateCompetitionAwards(state, competitionId, competitionName) {
  const stats = statsForCompetition(state, competitionId); if (!stats.length) return;
  const scorer = chooseBestPlayer(stats, (stat) => stat.goals * 100 + stat.assists + stat.averageRating / 10);
  const offensive = chooseBestPlayer(stats.filter((stat) => ['FW','MF'].includes(getPlayer(state, stat.playerId)?.position)), (stat) => stat.averageRating * 25 + stat.goals * 3 + stat.assists * 2);
  const defender = chooseBestPlayer(stats.filter((stat) => getPlayer(state, stat.playerId)?.position === 'DF'), (stat) => stat.averageRating * 30 + stat.cleanSheets * 2 + stat.goals + stat.assists);
  const goalkeeper = chooseBestPlayer(stats.filter((stat) => getPlayer(state, stat.playerId)?.position === 'GK'), (stat) => stat.averageRating * 30 + stat.cleanSheets * 3);
  const mvp = chooseBestPlayer(stats, (stat) => stat.averageRating * 35 + stat.goals * 2.3 + stat.assists * 1.5 + stat.cleanSheets * .5);
  award(state, `${competitionName} Top Scorer`, scorer?.playerId, competitionId, 1, 'top_scorer');
  award(state, `${competitionName} Best Offensive Player`, offensive?.playerId, competitionId, 1, 'best_offensive');
  award(state, `${competitionName} Best Defender`, defender?.playerId, competitionId, 1, 'best_defender');
  award(state, `${competitionName} Best Goalkeeper`, goalkeeper?.playerId, competitionId, 1, 'best_goalkeeper');
  award(state, `${competitionName} MVP`, mvp?.playerId, competitionId, 1, 'mvp');
}
function calculateAwards(state) {
  for (const league of Object.values(state.current.leagues)) calculateCompetitionAwards(state, league.id, league.name);
  for (const cup of Object.values(state.current.domesticCups)) calculateCompetitionAwards(state, cup.id, cup.name);
  calculateCompetitionAwards(state, 'SUPERCUP', state.current.supercup.name); calculateCompetitionAwards(state, 'UCL', state.current.champions.name); calculateCompetitionAwards(state, 'EUROQ', 'European Championship Qualifying'); calculateCompetitionAwards(state, 'EURO', state.current.international.name);
  const allClubStats = Object.values(state.current.playerStats).filter((stat) => !stat.isInternational && stat.apps > 0); const aggregate = new Map();
  allClubStats.forEach((stat) => { const item = aggregate.get(stat.playerId) || { playerId:stat.playerId,apps:0,goals:0,assists:0,ratingWeighted:0 }; item.apps += stat.apps; item.goals += stat.goals; item.assists += stat.assists; item.ratingWeighted += stat.averageRating * stat.apps; aggregate.set(stat.playerId,item); });
  const domesticChampions = Object.values(state.current.leagues).map((league) => sortTable(league.table)[0]?.teamId); const cupChampions = Object.values(state.current.domesticCups).map((cup) => cup.championId);
  const candidates = [...aggregate.values()].map((item) => { const player=getPlayer(state,item.playerId); const avg=item.apps?item.ratingWeighted/item.apps:0; const clubBonus=[...domesticChampions,...cupChampions,state.current.champions.championId,state.current.supercup.championId].filter((id)=>id&&id===player?.clubId).length*6; const internationalBonus=state.current.international.championId===player?.nationality?10:0; return {...item,score:avg*9+item.goals*1.35+item.assists*.7+clubBonus+internationalBonus+(player?.fame||0)*.18}; }).sort((a,b)=>b.score-a.score);
  candidates.slice(0,3).forEach((candidate,index)=>award(state,"Ballon d'Or",candidate.playerId,'GLOBAL',index+1,'ballon_dor')); candidates.slice(0,11).forEach((candidate)=>award(state,'World Best XI',candidate.playerId,'GLOBAL',1,'world_best_xi')); const young=candidates.find((candidate)=>state.season-getPlayer(state,candidate.playerId)?.birthYear<=22); award(state,'World Young Player of the Year',young?.playerId,'GLOBAL',1,'young_player');
}

function registerChampion(state, competitionId, competitionName, winnerId, runnerUpId = null, isInternational = false) {
  if (!winnerId) return;
  state.history.champions.push({
    season: state.season, seasonLabel: formatSeason(state.season), competitionId, competitionName,
    winnerId, runnerUpId, isInternational
  });
  const players = isInternational ? getNationalLineup(state, winnerId) : getClubLineup(state, winnerId);
  players.forEach((player) => state.history.honours.push({
    season: state.season, playerId: player.id, competitionId, competitionName,
    teamId: winnerId, isInternational
  }));
}

function archiveSeason(state) {
  Object.values(state.current.playerStats).forEach((stat) => {
    if (!stat.apps) return;
    state.history.playerSeasons.push({
      season: state.season,
      seasonLabel: formatSeason(state.season),
      playerId: stat.playerId,
      competitionId: stat.competitionId,
      teamId: stat.teamId,
      isInternational: stat.isInternational,
      apps: stat.apps,
      starts: stat.starts,
      goals: stat.goals,
      assists: stat.assists,
      cleanSheets: stat.cleanSheets,
      averageRating: Number(stat.averageRating.toFixed(2)),
      manOfTheMatch: stat.manOfTheMatch
    });
  });
  for (const league of Object.values(state.current.leagues)) {
    const sorted = sortTable(league.table);
    sorted.forEach((row, index) => state.history.clubSeasons.push({
      season: state.season, seasonLabel: formatSeason(state.season), leagueId: league.id,
      clubId: row.teamId, position: index + 1, played: row.played, wins: row.wins, draws: row.draws,
      losses: row.losses, gf: row.gf, ga: row.ga, gd: row.gd, points: row.points
    }));
    registerChampion(state, league.id, league.name, sorted[0]?.teamId, sorted[1]?.teamId);
  }
  for (const cup of Object.values(state.current.domesticCups)) registerChampion(state, cup.id, cup.name, cup.championId, cup.finalistId);
  registerChampion(state, 'SUPERCUP', state.current.supercup.name, state.current.supercup.championId, state.current.supercup.finalistId);
  registerChampion(state, 'UCL', state.current.champions.name, state.current.champions.championId, state.current.champions.finalistId);
  registerChampion(state, 'EURO', state.current.international.name, state.current.international.championId, state.current.international.finalistId, true);

  const landmarks = state.current.matches.filter((match) => match.landmark || match.stage === 'Final').map((match) => ({ ...match }));
  state.history.landmarkMatches.push(...landmarks);
}

function evolveWorld(state) {
  for (const club of state.clubs) {
    const leagueFinish = state.history.clubSeasons.find((row) => row.season === state.season && row.clubId === club.id);
    if (leagueFinish) {
      const leagueSize = LEAGUE_DEFINITIONS.find((league) => league.id === club.leagueId)?.clubs.length || 20;
      const performance = (leagueSize + 1 - leagueFinish.position) / leagueSize;
      club.strength = clamp(Math.round(club.strength * 0.82 + (62 + performance * 29) * 0.18 + randomInt(state, -1, 1)), 60, 95);
      club.reputation = clamp(club.reputation * 0.96 + club.strength * 0.04, 55, 96);
      club.fans = Math.max(50000, Math.round(club.fans * (0.985 + performance * 0.03)));
    }
  }

  const retiredByClub = new Map();
  for (const player of state.players) {
    if (player.status !== 'active') continue;
    const age = state.season + 1 - player.birthYear;
    if (age >= 35 && random(state) < (age - 33) * 0.16) {
      player.status = 'retired';
      if (player.clubId) retiredByClub.set(player.clubId, (retiredByClub.get(player.clubId) || 0) + 1);
      continue;
    }
    if (age <= 22) player.rating = clamp(player.rating + randomInt(state, 0, 2), 55, player.potential);
    else if (age >= 32) player.rating = clamp(player.rating - randomInt(state, 0, 2), 55, 97);
    else player.rating = clamp(player.rating + randomInt(state, -1, 1), 55, 97);
    player.fame = clamp(player.fame + randomInt(state, -1, 2), 5, 100);
  }
  for (const [clubId, count] of retiredByClub.entries()) {
    const club = getClub(state, clubId);
    for (let i = 0; i < count; i += 1) {
      const prospect = createPlayer(state, club, i + 5);
      prospect.birthYear = state.season - randomInt(state, 17, 20);
      prospect.rating = clamp(club.strength - randomInt(state, 8, 16), 58, 86);
      prospect.potential = clamp(prospect.rating + randomInt(state, 5, 14), prospect.rating, 96);
      state.players.push(prospect);
    }
  }
}

function closeSeason(state) {
  calculateAwards(state);
  archiveSeason(state);
  const ballon = state.history.awards.find((item) => item.season === state.season && item.name === "Ballon d'Or" && item.rank === 1);
  state.history.seasonReviews.push({
    season: state.season,
    seasonLabel: formatSeason(state.season),
    championsCupWinnerId: state.current.champions.championId,
    spainChampionId: sortTable(state.current.leagues.ESP1.table)[0]?.teamId,
    internationalChampionId: state.current.international.championId,
    ballonDorPlayerId: ballon?.playerId || null
  });

  // The defining storage rule: match-by-match detail exists only while a season is active.
  // Permanent summaries, awards, honours and landmark finals were written above.
  state.current.archivedMatchCount = state.current.matches.length;
  state.current.matches = [];
  state.current.playerMatchLogs = {};
  state.current.news = [{
    id: `news-${state.season}-archive`,
    week: state.current.week,
    importance: 'feature',
    category: 'Season Review',
    headline: `${formatSeason(state.season)} has been archived`,
    body: `${state.current.archivedMatchCount} match records were consolidated into permanent player and club summaries.`
  }];
  state.current.completed = true;
}

export function startNextSeason(state) {
  if (!state.current.completed) return state;
  evolveWorld(state);
  state.season += 1;
  state.current = newCurrentSeason(state);
  return state;
}

export function getLeagueTable(state, leagueId) {
  return sortTable(state.current.leagues[leagueId]?.table || []);
}

export function getCompetitionLeaderboard(state, competitionId, metric = 'goals') {
  return Object.values(state.current.playerStats)
    .filter((stat) => stat.competitionId === competitionId && stat.apps > 0)
    .sort((a, b) => {
      if (metric === 'rating') return b.averageRating - a.averageRating || b.apps - a.apps;
      return (b[metric] || 0) - (a[metric] || 0) || b.averageRating - a.averageRating;
    });
}

export function getPlayerCareer(state, playerId) {
  const seasons = state.history.playerSeasons.filter((row) => row.playerId === playerId);
  const awards = state.history.awards.filter((row) => row.playerId === playerId);
  const honours = state.history.honours.filter((row) => row.playerId === playerId);
  const current = Object.values(state.current.playerStats).filter((row) => row.playerId === playerId);
  const logs = state.current.playerMatchLogs[playerId] || [];
  const international = seasons.filter((row) => row.isInternational).reduce((sum, row) => ({
    caps: sum.caps + row.apps, goals: sum.goals + row.goals, assists: sum.assists + row.assists
  }), { caps: 0, goals: 0, assists: 0 });
  const currentInternational = current.filter((row) => row.isInternational).reduce((sum, row) => ({
    caps: sum.caps + row.apps, goals: sum.goals + row.goals, assists: sum.assists + row.assists
  }), { caps: 0, goals: 0, assists: 0 });
  return {
    seasons, awards, honours, current, logs,
    international: {
      caps: international.caps + currentInternational.caps,
      goals: international.goals + currentInternational.goals,
      assists: international.assists + currentInternational.assists
    }
  };
}

export function getClubHistory(state, clubId) {
  return {
    seasons: state.history.clubSeasons.filter((row) => row.clubId === clubId),
    honours: state.history.champions.filter((row) => !row.isInternational && row.winnerId === clubId),
    currentPlayers: getClubLineup(state, clubId),
    currentMatches: state.current.matches.filter((match) => !match.isInternational && (match.homeId === clubId || match.awayId === clubId))
  };
}

export function getEntityName(state, id, isInternational = false) {
  return getTeamName(state, id, isInternational);
}

export function getCompetitionName(state, competitionId) {
  if (state.current.leagues[competitionId]) return state.current.leagues[competitionId].name;
  if (state.current.domesticCups?.[competitionId]) return state.current.domesticCups[competitionId].name;
  const map = { SUPERCUP: state.current.supercup.name, UCL: state.current.champions.name, EUROQ: 'European Championship Qualifying', EURO: state.current.international.name, GLOBAL: 'World Football' };
  return map[competitionId] || competitionId;
}

export function getSeasonLabel(season) {
  return formatSeason(season);
}
