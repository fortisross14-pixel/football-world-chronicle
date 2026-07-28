import {
  START_SEASON,
  LEAGUE_DEFINITIONS,
  NATIONAL_TEAMS,
  NATIONAL_TEAM_BY_ID,
  NAME_POOLS,
  POSITION_BLUEPRINT,
  COUNTRY_META,
  STAR_RARITIES,
  ROLE_DEFINITIONS,
  CAREER_TYPES,
  INTERNATIONAL_COMPETITION_NAMES,
  CONTINENTAL_DEFINITIONS,
  STAFF_RARITIES,
  OWNER_PROFILES,
  COACH_PROFILES
} from './data.js';

const COUNTRY_TO_CODE = Object.fromEntries(
  Object.entries(COUNTRY_META).map(([country, meta]) => [country, meta.code])
);
const CAREER_LENGTH_RANGES = {
  short: [8, 9],
  medium: [10, 11],
  long: [12, 13]
};
const RARITY_ORDER = ['generational', 'legend', 'epic', 'rare', 'uncommon', 'common'];
const CLUB_ROSTER_TARGET = { detailed: 7, summary: 4, reserve: 4 };
const INTERNATIONAL_FINAL_SIZES = {
  Europe: 16,
  Africa: 16,
  Asia: 16,
  'North America': 12,
  'South America': 10,
  Oceania: 8
};

const RUNTIME_CACHE = new WeakMap();

function invalidateRuntimeCache(state) {
  RUNTIME_CACHE.delete(state);
}

function getRuntimeCache(state) {
  let cache = RUNTIME_CACHE.get(state);
  if (cache) return cache;
  const clubById = new Map((state.clubs || []).map((club) => [club.id, club]));
  const playerById = new Map((state.players || []).map((player) => [player.id, player]));
  const nationalById = new Map((state.nationalTeams || []).map((team) => [team.id, team]));
  const clubPlayers = new Map();
  const nationalPlayers = new Map();
  for (const player of state.players || []) {
    if (player.status !== 'active') continue;
    if (player.clubId) {
      if (!clubPlayers.has(player.clubId)) clubPlayers.set(player.clubId, []);
      clubPlayers.get(player.clubId).push(player);
    }
    if (!nationalPlayers.has(player.nationality)) nationalPlayers.set(player.nationality, []);
    nationalPlayers.get(player.nationality).push(player);
  }
  const recentContinentalTitles = new Map();
  for (const entry of state.history?.champions || []) {
    if (entry.season < state.season - 3 || !CONTINENTAL_DEFINITIONS.some((definition) => definition.id === entry.competitionId)) continue;
    recentContinentalTitles.set(entry.winnerId, (recentContinentalTitles.get(entry.winnerId) || 0) + 1);
  }
  cache = {
    clubById,
    playerById,
    nationalById,
    clubLineups: new Map([...clubPlayers].map(([id, players]) => [id, selectLineup(players, 7)])),
    nationalLineups: new Map([...nationalPlayers].map(([id, players]) => [id, selectLineup(players, 8)])),
    recentContinentalTitles
  };
  RUNTIME_CACHE.set(state, cache);
  return cache;
}

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

function weightedPick(state, items, weightFn) {
  if (!items.length) return null;
  const weights = items.map((item) => Math.max(0.001, weightFn(item)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let needle = random(state) * total;
  for (let i = 0; i < items.length; i += 1) {
    needle -= weights[i];
    if (needle <= 0) return items[i];
  }
  return items[items.length - 1];
}

function poisson(state, lambda) {
  const limit = Math.exp(-Math.max(0.05, lambda));
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random(state);
  } while (product > limit && count < 11);
  return count - 1;
}

function slug(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatSeason(season) {
  return `${season}-${String(season + 1).slice(-2)}`;
}

function makeTable(teamIds) {
  return teamIds.map((teamId) => ({
    teamId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    form: []
  }));
}

function sortTable(rows) {
  return [...rows].sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.teamId.localeCompare(b.teamId)
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

function roundRobin(teamIds, doubleRound = true) {
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
        matches.push({
          homeId: flip ? right[i] : left[i],
          awayId: flip ? left[i] : right[i]
        });
      }
    }
    rounds.push(matches);
    rotating.unshift(rotating.pop());
  }
  if (!doubleRound) return rounds;
  const reverse = rounds.map((matches) =>
    matches.map(({ homeId, awayId }) => ({ homeId: awayId, awayId: homeId }))
  );
  return [...rounds, ...reverse];
}

function teamById(id) {
  return NATIONAL_TEAM_BY_ID[id] || null;
}

function eligibleNationalityTiers(rarity) {
  if (rarity === 'generational') return [1, 2];
  if (rarity === 'legend') return [1, 2, 3];
  if (rarity === 'epic') return [1, 2, 3, 4];
  return [1, 2, 3, 4];
}

function nationalityWeight(team, rarity) {
  if (rarity === 'generational') return team.tier === 1 ? 18 : team.tier === 2 ? 2 : 0;
  if (rarity === 'legend') return team.tier === 1 ? 12 : team.tier === 2 ? 7 : team.tier === 3 ? 0.5 : 0;
  if (rarity === 'epic') return team.tier === 1 ? 7 : team.tier === 2 ? 5 : team.tier === 3 ? 2.2 : 0.45;
  if (rarity === 'rare') return team.tier === 1 ? 5 : team.tier === 2 ? 4 : team.tier === 3 ? 2.8 : 1.2;
  if (rarity === 'uncommon') return team.tier === 1 ? 2.4 : team.tier === 2 ? 2.6 : team.tier === 3 ? 2.5 : 1.8;
  return team.tier === 1 ? 1 : team.tier === 2 ? 1.2 : team.tier === 3 ? 1.7 : 3.2;
}

function chooseNationality(state, rarity, preferredCountry = null) {
  const preferredId = COUNTRY_TO_CODE[preferredCountry];
  const preferred = preferredId ? teamById(preferredId) : null;
  const eligible = NATIONAL_TEAMS.filter((team) => eligibleNationalityTiers(rarity).includes(team.tier));
  if (preferred && eligible.includes(preferred)) {
    const keepHomeChance = rarity === 'generational' ? 0.45 : rarity === 'legend' ? 0.52 : 0.68;
    if (random(state) < keepHomeChance) return preferred.id;
  }
  return weightedPick(state, eligible, (team) => nationalityWeight(team, rarity))?.id || 'esp';
}

function careerLength(state) {
  const type = weightedPick(state, Object.keys(CAREER_LENGTH_RANGES), (key) =>
    key === 'medium' ? 1.5 : key === 'long' ? 1.05 : 1
  );
  const [min, max] = CAREER_LENGTH_RANGES[type];
  return { type, years: randomInt(state, min, max) };
}

function careerCurve(type, years) {
  const base = CAREER_TYPES[type]?.curve || CAREER_TYPES.stable_prime.curve;
  if (years <= base.length) return base.slice(0, years);
  return [...base, ...Array.from({ length: years - base.length }, () => 0.85)];
}

function rarityQuality(state, rarity) {
  const range = STAR_RARITIES[rarity] || STAR_RARITIES.common;
  return randomInt(state, range.min, range.max);
}

function pickRole(state, position) {
  return pick(state, ROLE_DEFINITIONS[position]);
}

function uniqueName(state, nationality) {
  const country = teamById(nationality)?.name || 'England';
  const pool = NAME_POOLS[country] || NAME_POOLS.England;
  if (!state.usedNames) state.usedNames = {};
  if (!state.usedNames[nationality]) state.usedNames[nationality] = {};
  for (let attempt = 0; attempt < 70; attempt += 1) {
    const name = `${pick(state, pool.first)} ${pick(state, pool.last)}`;
    if (!state.usedNames[nationality][name]) {
      state.usedNames[nationality][name] = 1;
      return name;
    }
  }
  const name = `${pick(state, pool.first)} ${pick(state, pool.last)} ${state.nextPlayerId}`;
  state.usedNames[nationality][name] = 1;
  return name;
}

function createPlayer(state, {
  club = null,
  position = null,
  rarity = 'common',
  nationality = null,
  careerYear = null,
  nationalSpecialist = false
} = {}) {
  const actualPosition = position || pick(state, POSITION_BLUEPRINT).position;
  const actualNationality = nationality || chooseNationality(state, rarity, club?.country);
  const role = pickRole(state, actualPosition);
  const length = careerLength(state);
  const type = pick(state, Object.keys(CAREER_TYPES));
  const curve = careerCurve(type, length.years);
  const initialCareerYear = careerYear === null
    ? randomInt(state, 0, Math.max(0, Math.min(length.years - 3, 8)))
    : clamp(careerYear, 0, length.years - 1);
  const baseQuality = rarityQuality(state, rarity);
  const rating = clamp(Math.round(baseQuality * curve[initialCareerYear]), 51, 100);
  const name = uniqueName(state, actualNationality);
  const id = `${club?.id || actualNationality}-${slug(name)}-${state.nextPlayerId}`;
  state.nextPlayerId += 1;
  const age = 18 + initialCareerYear;
  const value = calculateMarketValueRaw(baseQuality, rarity, age);
  return {
    id,
    name,
    clubId: club?.id || null,
    nationality: actualNationality,
    birthYear: START_SEASON - age,
    position: actualPosition,
    role: role.id,
    roleLabel: role.label,
    rarity,
    baseQuality,
    rating,
    careerLengthType: length.type,
    careerLength: length.years,
    careerType: type,
    careerMultipliers: curve,
    careerYear: initialCareerYear,
    fame: clamp(Math.round((baseQuality - 55) * 1.8 + randomInt(state, 0, 12)), 5, 100),
    status: 'active',
    isNationalSpecialist: nationalSpecialist,
    contractYears: club ? randomInt(state, 1, 5) : 0,
    salary: club ? Math.max(0.3, Number((value * (0.045 + random(state) * 0.03)).toFixed(1))) : 0,
    happiness: randomInt(state, 48, 92),
    marketValue: value,
    transferListed: false
  };
}

function calculateMarketValueRaw(baseQuality, rarity, age) {
  const rarityMultiplier = {
    generational: 4.1,
    legend: 2.9,
    epic: 1.9,
    rare: 1.15,
    uncommon: 0.48,
    common: 0.18
  }[rarity] || 0.18;
  const ageMultiplier = age <= 23 ? 1.15 : age <= 28 ? 1 : age <= 31 ? 0.78 : 0.48;
  return Number(Math.max(0.4, ((baseQuality - 52) ** 1.45) * rarityMultiplier * ageMultiplier / 2.6).toFixed(1));
}

function calculateMarketValue(state, player) {
  const age = state.season - player.birthYear;
  return calculateMarketValueRaw(player.baseQuality, player.rarity, age);
}

function initialRarityDeck(state, count) {
  const fixed = [
    ...Array(3).fill('generational'),
    ...Array(14).fill('legend'),
    ...Array(42).fill('epic')
  ];
  const remaining = Math.max(0, count - fixed.length);
  const lower = [];
  for (let i = 0; i < remaining; i += 1) {
    const roll = random(state);
    lower.push(roll < 0.15 ? 'rare' : roll < 0.46 ? 'uncommon' : 'common');
  }
  return [...fixed, ...shuffle(state, lower)];
}

function chooseStaffRarity(state) {
  const entries = Object.entries(STAFF_RARITIES);
  return weightedPick(state, entries, ([, data]) => data.weight)[0];
}

function createStaffMember(state, type, nationality, assignment = {}) {
  const rarity = chooseStaffRarity(state);
  const profiles = type === 'owner' ? OWNER_PROFILES : COACH_PROFILES;
  const profile = pick(state, Object.keys(profiles));
  const qualityBase = { generational: 96, legend: 92, epic: 87, rare: 81, uncommon: 74, common: 66 }[rarity];
  const name = uniqueName(state, nationality || 'eng');
  return {
    id: `${type}-${slug(name)}-${state.nextStaffId++}`,
    type,
    name,
    nationality: nationality || 'eng',
    rarity,
    quality: clamp(qualityBase + randomInt(state, -2, 2), 60, 99),
    profile,
    profileLabel: profiles[profile].label,
    seasonsInRole: randomInt(state, 0, 7),
    performanceScore: 0,
    trophies: 0,
    ...assignment
  };
}

function createClubsAndPlayers(state) {
  const clubs = [];
  const playerSlots = [];
  for (const league of LEAGUE_DEFINITIONS) {
    league.clubs.forEach(([id, name, city, strength], index) => {
      const division = league.tier === 'detailed' && index >= league.activeCount ? 2 : 1;
      const cash = Math.round(8 + ((strength - 50) ** 2) * 0.22);
      const financeBoost = league.country === 'Spain' && ['atletico', 'athletic', 'valencia', 'sevilla'].includes(id) ? 1.22 : 1;
      const club = {
        id,
        name,
        city,
        strength,
        baseStrength: strength,
        leagueId: league.id,
        country: league.country,
        confederation: league.confederation,
        tier: league.tier,
        division,
        form: 0,
        fans: Math.max(12000, Math.round(((strength - 48) ** 2) * 4800)),
        finances: Math.max(3, Math.round(cash * financeBoost)),
        transferBudget: Math.max(1, Math.round(cash * financeBoost * 0.32)),
        wageBudget: Number((Math.max(3, cash * financeBoost) * 0.055).toFixed(1)),
        reputation: strength,
        ownerId: null,
        coachId: null,
        crestHue: Math.abs([...id].reduce((sum, char) => sum + char.charCodeAt(0) * 7, 0)) % 360
      };
      clubs.push(club);
      const count = division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[league.tier];
      for (let slot = 0; slot < count; slot += 1) {
        playerSlots.push({ club, position: POSITION_BLUEPRINT[slot % POSITION_BLUEPRINT.length].position });
      }
    });
  }
  const deck = initialRarityDeck(state, playerSlots.length);
  const rarityRank = (rarity) => STAR_RARITIES[rarity].rank;
  const orderedSlots = [...playerSlots].sort((a, b) => b.club.strength - a.club.strength || random(state) - 0.5);
  const orderedRarities = [...deck].sort((a, b) => rarityRank(b) - rarityRank(a));
  const players = orderedSlots.map((slot, index) => createPlayer(state, {
    club: slot.club,
    position: slot.position,
    rarity: orderedRarities[index]
  }));

  for (const team of NATIONAL_TEAMS) {
    if (!players.some((player) => player.nationality === team.id && player.status === 'active')) {
      players.push(createPlayer(state, {
        nationality: team.id,
        rarity: team.tier <= 2 && random(state) < 0.18 ? 'uncommon' : 'common',
        nationalSpecialist: true,
        careerYear: randomInt(state, 0, 5)
      }));
    }
  }
  state.targetActivePlayers = players.length;
  return { clubs, players };
}

function initializeStaff(state) {
  const owners = [];
  const coaches = [];
  for (const club of state.clubs) {
    const nationality = COUNTRY_TO_CODE[club.country] || 'eng';
    const owner = createStaffMember(state, 'owner', nationality, { clubId: club.id });
    owners.push(owner);
    club.ownerId = owner.id;
    const ownerData = OWNER_PROFILES[owner.profile];
    const rarityImpact = STAFF_RARITIES[owner.rarity].impact;
    club.ownerProfile = owner.profile;
    club.ownerRarity = owner.rarity;
    club.ownerMoneyMultiplier = 1 + (ownerData.money - 1) * rarityImpact;
    club.ownerSportingBonus = (ownerData.sporting - 1) * rarityImpact * 4;
    club.ownerNegotiationBonus = Math.max(0, ownerData.negotiation - 1) * rarityImpact;
    club.ownerPatience = ownerData.patience;
    club.finances = Math.max(3, Math.round(club.finances * club.ownerMoneyMultiplier));
    club.transferBudget = Math.max(1, Math.round(club.finances * 0.3));
  }
  const coachCount = Math.ceil((state.clubs.length + state.nationalTeams.length) * 1.1);
  for (let index = 0; index < coachCount; index += 1) {
    const nation = NATIONAL_TEAMS[index % NATIONAL_TEAMS.length];
    coaches.push(createStaffMember(state, 'coach', nation.id));
  }
  const assignments = [
    ...state.clubs.map((club) => ({ type: 'club', id: club.id, score: club.reputation })),
    ...state.nationalTeams.map((team) => ({ type: 'nation', id: team.id, score: team.strength + 2 }))
  ].sort((a, b) => b.score - a.score);
  coaches.sort((a, b) => b.quality - a.quality);
  assignments.forEach((assignment, index) => {
    const coach = coaches[index];
    if (!coach) return;
    if (assignment.type === 'club') {
      coach.clubId = assignment.id;
      const club = state.clubs.find((item) => item.id === assignment.id);
      club.coachId = coach.id;
      club.coachProfile = coach.profile;
      club.coachRarity = coach.rarity;
      club.coachQuality = coach.quality;
    } else {
      coach.nationalTeamId = assignment.id;
      const team = state.nationalTeams.find((item) => item.id === assignment.id);
      team.coachId = coach.id;
      team.coachProfile = coach.profile;
      team.coachRarity = coach.rarity;
      team.coachQuality = coach.quality;
    }
  });
  state.owners = owners;
  state.coaches = coaches;
}

function initializeLeagueState(state) {
  const leagues = {};
  for (const definition of LEAGUE_DEFINITIONS) {
    const clubIds = state.clubs
      .filter((club) => club.leagueId === definition.id && (definition.tier === 'summary' || club.division === 1))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, definition.activeCount)
      .map((club) => club.id);
    const schedule = definition.tier === 'detailed' ? roundRobin(clubIds, true) : [];
    leagues[definition.id] = {
      id: definition.id,
      name: definition.name,
      country: definition.country,
      tier: definition.tier,
      confederation: definition.confederation,
      table: makeTable(clubIds),
      rounds: schedule,
      championId: null,
      completed: false,
      relegatedIds: [],
      promotedIds: []
    };
  }
  return leagues;
}

function buildGroups(state, ids, groupCount = 4, doubleRound = false) {
  const shuffled = shuffle(state, ids);
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: String.fromCharCode(65 + (index % 26)) + (index >= 26 ? String(Math.floor(index / 26) + 1) : ''),
    teamIds: [],
    table: [],
    rounds: []
  }));
  shuffled.forEach((id, index) => groups[index % groupCount].teamIds.push(id));
  groups.forEach((group) => {
    group.table = makeTable(group.teamIds);
    group.rounds = roundRobin(group.teamIds, doubleRound);
  });
  return groups;
}

function latestLeaguePosition(state, clubId) {
  const rows = state.history.clubSeasons.filter((row) => row.clubId === clubId);
  if (!rows.length) return null;
  return rows.sort((a, b) => b.season - a.season)[0].position;
}

function selectContinentalTeams(state, definition, alreadySelected) {
  const eligible = state.clubs.filter((club) =>
    club.confederation === definition.confederation &&
    club.division === 1 &&
    !alreadySelected.has(club.id)
  );
  const byCountry = new Map();
  for (const club of eligible) {
    if (!byCountry.has(club.country)) byCountry.set(club.country, []);
    byCountry.get(club.country).push(club);
  }
  const countries = [...byCountry.entries()].sort((a, b) => {
    const bestA = Math.max(...a[1].map((club) => club.reputation));
    const bestB = Math.max(...b[1].map((club) => club.reputation));
    return bestB - bestA;
  });
  const selected = [];
  const isEurope = definition.confederation === 'Europe';
  const startIndex = definition.level === 1 ? 0 : definition.level === 2 ? (isEurope ? 3 : 2) : 6;
  for (const [, clubs] of countries) {
    const detailed = clubs[0]?.tier === 'detailed';
    const cap = definition.level === 1
      ? (isEurope ? (detailed ? 4 : 1) : (detailed ? 2 : 1))
      : definition.level === 2
        ? (detailed ? (isEurope ? 3 : 2) : 1)
        : (detailed ? 2 : 1);
    const ranked = [...clubs].sort((a, b) => {
      const posA = latestLeaguePosition(state, a.id) ?? Math.max(1, Math.round((98 - a.strength) / 2));
      const posB = latestLeaguePosition(state, b.id) ?? Math.max(1, Math.round((98 - b.strength) / 2));
      return posA - posB || b.reputation - a.reputation;
    });
    let slice = ranked.slice(startIndex, startIndex + cap);
    if (definition.level === 2) {
      const leagueId = ranked[0]?.leagueId;
      const cupId = leagueId ? `CUP-${leagueId}` : null;
      const cupWinnerId = [...state.history.champions].reverse().find((entry) => entry.competitionId === cupId)?.winnerId;
      const cupWinner = ranked.find((club) => club.id === cupWinnerId);
      if (cupWinner && !alreadySelected.has(cupWinner.id)) slice = [cupWinner, ...slice.filter((club) => club.id !== cupWinner.id)].slice(0, cap);
    }
    for (const club of slice) {
      if (selected.length >= definition.teams) break;
      selected.push(club.id);
      alreadySelected.add(club.id);
    }
  }
  if (selected.length < definition.teams) {
    const idealPosition = definition.level === 1 ? 2 : definition.level === 2 ? 6 : 9;
    const remaining = eligible
      .filter((club) => !alreadySelected.has(club.id))
      .map((club) => {
        const position = latestLeaguePosition(state, club.id) ?? Math.max(1, Math.round((98 - club.strength) / 2));
        return { club, score: club.reputation + club.strength * 0.55 - Math.abs(position - idealPosition) * 2.2 };
      })
      .sort((a, b) => b.score - a.score);
    for (const item of remaining) {
      if (selected.length >= definition.teams) break;
      selected.push(item.club.id);
      alreadySelected.add(item.club.id);
    }
  }
  return selected.slice(0, definition.teams);
}

function initializeContinentalCompetitions(state) {
  const competitions = {};
  const usedByConfederation = {};
  for (const definition of CONTINENTAL_DEFINITIONS) {
    if (!usedByConfederation[definition.confederation]) usedByConfederation[definition.confederation] = new Set();
    const teamIds = selectContinentalTeams(state, definition, usedByConfederation[definition.confederation]);
    const groupCount = Math.max(2, Math.ceil(teamIds.length / 4));
    competitions[definition.id] = {
      ...definition,
      stage: 'Group Stage',
      groups: buildGroups(state, teamIds, groupCount, true),
      knockout: null,
      championId: null,
      finalistId: null,
      completed: false
    };
  }
  return competitions;
}

function initializeChampions(state) {
  return initializeContinentalCompetitions(state).UCL;
}

function initializeCups(state) {
  const domesticCups = {};
  for (const league of LEAGUE_DEFINITIONS) {
    const cupId = `CUP-${league.id}`;
    domesticCups[cupId] = {
      id: cupId,
      leagueId: league.id,
      country: league.country,
      tier: league.tier,
      name: league.cupName,
      active: state.clubs.filter((club) => club.leagueId === league.id).map((club) => club.id),
      stage: league.tier === 'summary' ? 'Season simulation' : 'Opening Round',
      championId: null,
      finalistId: null,
      rounds: []
    };
  }
  const spanish = state.clubs
    .filter((club) => club.country === 'Spain' && club.division === 1)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 4)
    .map((club) => club.id);
  return {
    domesticCups,
    supercup: {
      id: 'SUPERCUP',
      name: 'Spanish Super Cup',
      active: spanish,
      stage: 'Semi-finals',
      championId: null,
      finalistId: null,
      rounds: []
    }
  };
}

function regionalCompetitionId(region, qualifier) {
  const map = {
    Europe: qualifier ? 'EUROQ' : 'EURO',
    Africa: qualifier ? 'AFCONQ' : 'AFCON',
    Asia: qualifier ? 'ASIACUPQ' : 'ASIACUP',
    'North America': qualifier ? 'GOLDQ' : 'GOLDCUP',
    'South America': qualifier ? 'COPAF' : 'COPA',
    Oceania: qualifier ? 'OFCF' : 'OFC'
  };
  return map[region];
}

function strongestNationalTeams(ids, count) {
  return ids
    .map((id) => teamById(id))
    .filter(Boolean)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, count)
    .map((team) => team.id);
}

function makeInternationalCompetition(state, {
  id,
  ids,
  groupSize = 6,
  kind = 'qualifier',
  confederation = 'World',
  qualifiers = 0,
  friendly = false
}) {
  const groupCount = Math.max(1, Math.ceil(ids.length / groupSize));
  return {
    id,
    name: INTERNATIONAL_COMPETITION_NAMES[id] || id,
    kind,
    confederation,
    friendly,
    stage: friendly ? 'Friendlies' : kind === 'qualifier' ? 'Qualifying' : 'Group Stage',
    groups: buildGroups(state, ids, groupCount, false),
    knockout: null,
    championId: null,
    finalistId: null,
    qualifiers,
    qualifiedIds: [],
    completed: false
  };
}

function initializeInternationalCompetitions(state) {
  const cycle = state.season % 4;
  const competitions = {};
  if (cycle === 1) {
    const ids = NATIONAL_TEAMS.map((team) => team.id);
    competitions.WCQ = makeInternationalCompetition(state, {
      id: 'WCQ',
      ids,
      groupSize: 7,
      kind: 'qualifier',
      confederation: 'World',
      qualifiers: 32
    });
  } else if (cycle === 2) {
    let ids = state.internationalCycle.worldCupQualified || [];
    if (ids.length < 32) ids = strongestNationalTeams(NATIONAL_TEAMS.map((team) => team.id), 32);
    competitions.WC = makeInternationalCompetition(state, {
      id: 'WC',
      ids: ids.slice(0, 32),
      groupSize: 4,
      kind: 'finals',
      confederation: 'World'
    });
  } else if (cycle === 3) {
    for (const region of ['Europe', 'Africa', 'Asia', 'North America', 'South America', 'Oceania']) {
      const ids = NATIONAL_TEAMS.filter((team) => team.region === region).map((team) => team.id);
      const target = INTERNATIONAL_FINAL_SIZES[region];
      const needsQualifier = ids.length > target;
      const id = regionalCompetitionId(region, needsQualifier);
      competitions[id] = makeInternationalCompetition(state, {
        id,
        ids,
        groupSize: 6,
        kind: needsQualifier ? 'qualifier' : 'friendly',
        confederation: region,
        qualifiers: needsQualifier ? target : ids.length,
        friendly: !needsQualifier
      });
    }
  } else {
    for (const region of ['Europe', 'Africa', 'Asia', 'North America', 'South America', 'Oceania']) {
      const id = regionalCompetitionId(region, false);
      let ids = state.internationalCycle.regionalQualified?.[region] || [];
      const target = INTERNATIONAL_FINAL_SIZES[region];
      if (ids.length < Math.min(target, NATIONAL_TEAMS.filter((team) => team.region === region).length)) {
        ids = strongestNationalTeams(
          NATIONAL_TEAMS.filter((team) => team.region === region).map((team) => team.id),
          target
        );
      }
      competitions[id] = makeInternationalCompetition(state, {
        id,
        ids,
        groupSize: ids.length <= 10 ? 5 : 4,
        kind: 'finals',
        confederation: region
      });
    }
  }
  return competitions;
}

function internationalCycleLabel(season) {
  const cycle = season % 4;
  if (cycle === 1) return `${season} World Cup Qualifying`;
  if (cycle === 2) return `${season} World Cup`;
  if (cycle === 3) return `${season} Continental Qualifying`;
  return `${season} Continental Championships`;
}

function newCurrentSeason(state) {
  const leagues = initializeLeagueState(state);
  const cups = initializeCups(state);
  const continentalCompetitions = initializeContinentalCompetitions(state);
  const internationalCompetitions = initializeInternationalCompetitions(state);
  return {
    season: state.season,
    seasonLabel: formatSeason(state.season),
    week: 0,
    date: `${state.season}-08-01`,
    leagues,
    domesticCups: cups.domesticCups,
    copa: cups.domesticCups['CUP-ESP1'],
    supercup: cups.supercup,
    continentalCompetitions,
    champions: continentalCompetitions.UCL,
    internationalCompetitions,
    international: Object.values(internationalCompetitions)[0] || null,
    playerStats: {},
    playerMatchLogs: {},
    matches: [],
    transfers: [],
    staffMoves: [],
    news: [
      ...(state.pendingSeasonNews || []),
      {
        id: `news-${state.season}-launch`,
        week: 0,
        importance: 'feature',
        category: 'World',
        headline: `${formatSeason(state.season)} football world opens`,
        body: `${internationalCycleLabel(state.season)} joins 137 domestic systems, eleven continental club competitions and a new transfer window.`
      }
    ],
    completed: false
  };
}

export function createWorld(seed = Date.now() % 2147483647) {
  const state = {
    version: 4,
    seed,
    rngSeed: seed >>> 0,
    nextPlayerId: 1,
    nextStaffId: 1,
    season: START_SEASON,
    clubs: [],
    players: [],
    usedNames: {},
    nationalTeams: NATIONAL_TEAMS.map((team) => ({ ...team, form: 0, coachId: null })),
    targetActivePlayers: 0,
    owners: [],
    coaches: [],
    pendingSeasonNews: [],
    internationalCycle: { worldCupQualified: [], regionalQualified: {} },
    current: null,
    history: {
      playerSeasons: [],
      clubSeasons: [],
      clubCompetitionSeasons: [],
      awards: [],
      champions: [],
      honours: [],
      landmarkMatches: [],
      seasonReviews: [],
      transfers: [],
      coachMoves: [],
      leagueMovements: []
    },
    preferences: {
      favoriteClubIds: ['real-madrid'],
      favoritePlayerIds: [],
      autoStopFinals: true
    }
  };
  const entities = createClubsAndPlayers(state);
  state.clubs = entities.clubs;
  state.players = entities.players;
  initializeStaff(state);
  state.current = newCurrentSeason(state);
  runTransferMarket(state, true);
  addPreseasonMagazine(state);
  invalidateRuntimeCache(state);
  refreshAllClubStrengths(state);
  return state;
}

function getClub(state, id) {
  return getRuntimeCache(state).clubById.get(id);
}

function getPlayer(state, id) {
  return getRuntimeCache(state).playerById.get(id);
}

function getOwner(state, clubId) {
  const club = getClub(state, clubId);
  return state.owners?.find((owner) => owner.id === club?.ownerId) || null;
}

function getCoach(state, teamId, isInternational = false) {
  if (isInternational) {
    const team = state.nationalTeams.find((item) => item.id === teamId);
    return state.coaches?.find((coach) => coach.id === team?.coachId) || null;
  }
  const club = getClub(state, teamId);
  return state.coaches?.find((coach) => coach.id === club?.coachId) || null;
}

function staffImpact(staff) {
  return staff ? STAFF_RARITIES[staff.rarity]?.impact || 0.18 : 0;
}

function tacticalModifiers(state, teamId, isInternational = false) {
  const entity = isInternational
    ? state.nationalTeams.find((team) => team.id === teamId)
    : getClub(state, teamId);
  const profile = COACH_PROFILES[entity?.coachProfile] || { attack: 1, defence: 1, midfield: 1, development: 1 };
  const impact = entity?.coachRarity ? STAFF_RARITIES[entity.coachRarity]?.impact || 0.18 : 0;
  const scale = (value) => 1 + (value - 1) * impact;
  return {
    coach: entity?.coachId ? { id: entity.coachId, quality: entity.coachQuality || 66 } : null,
    attack: scale(profile.attack),
    defence: scale(profile.defence),
    midfield: scale(profile.midfield),
    development: scale(profile.development)
  };
}

function getTeamName(state, id, isInternational = false) {
  if (isInternational) return state.nationalTeams.find((team) => team.id === id)?.name || id;
  return getClub(state, id)?.name || id;
}

function roleData(player) {
  return ROLE_DEFINITIONS[player.position]?.find((role) => role.id === player.role) || {
    goal: 1,
    assist: 1,
    defence: 1,
    label: player.roleLabel || player.role
  };
}

function goalWeight(player) {
  const base = player.position === 'FW' ? 9 : player.position === 'MF' ? 4 : player.position === 'DF' ? 1.1 : 0.08;
  return base * roleData(player).goal * (0.35 + player.rating / 95);
}

function assistWeight(player) {
  const base = player.position === 'MF' ? 8 : player.position === 'FW' ? 5.2 : player.position === 'DF' ? 2.1 : 0.15;
  return base * roleData(player).assist * (0.35 + player.rating / 95);
}

function selectLineup(players, limit = 7) {
  const active = players.filter((player) => player.status === 'active').sort((a, b) => b.rating - a.rating);
  const goalkeeper = active.find((player) => player.position === 'GK');
  const outfield = active.filter((player) => player.position !== 'GK').slice(0, goalkeeper ? limit - 1 : limit);
  return goalkeeper ? [goalkeeper, ...outfield] : outfield;
}

function getClubLineup(state, clubId) {
  return getRuntimeCache(state).clubLineups.get(clubId) || [];
}

function getNationalLineup(state, nationalId) {
  return getRuntimeCache(state).nationalLineups.get(nationalId) || [];
}

function ensurePlayerStat(state, playerId, competitionId, teamId, isInternational) {
  const key = `${playerId}::${competitionId}`;
  if (!state.current.playerStats[key]) {
    state.current.playerStats[key] = {
      playerId,
      competitionId,
      teamId,
      isInternational,
      apps: 0,
      starts: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      ratingSum: 0,
      averageRating: 0,
      manOfTheMatch: 0
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
    ? getRuntimeCache(state).nationalById.get(teamId)?.strength || 62
    : getClub(state, teamId)?.strength || 65;
  if (!lineup.length) return base - 5;
  const tactics = tacticalModifiers(state, teamId, isInternational);
  const weighted = lineup.reduce((sum, player) => {
    const defensiveBonus = ['GK', 'DF'].includes(player.position) ? roleData(player).defence * 0.7 : 0;
    const unitBonus = player.position === 'FW' ? tactics.attack : player.position === 'MF' ? tactics.midfield : tactics.defence;
    return sum + (player.rating + defensiveBonus) * unitBonus;
  }, 0) / lineup.length;
  const namedInfluence = isInternational ? Math.min(0.62, 0.22 + lineup.length * 0.05) : 0.42;
  const form = isInternational
    ? getRuntimeCache(state).nationalById.get(teamId)?.form || 0
    : getClub(state, teamId)?.form || 0;
  const coachBonus = tactics.coach ? (tactics.coach.quality - 65) * 0.045 : 0;
  const ownerBonus = isInternational ? 0 : (getClub(state, teamId)?.ownerSportingBonus || 0);
  const recentContinentalTitles = isInternational ? 0 : (getRuntimeCache(state).recentContinentalTitles.get(teamId) || 0);
  const dynastyPressure = Math.max(0, recentContinentalTitles - 1) * 0.7;
  return base * (1 - namedInfluence) + weighted * namedInfluence + form + coachBonus + ownerBonus - dynastyPressure;
}

function calculateUnitStrength(state, teamId, isInternational, unit) {
  const lineup = isInternational ? getNationalLineup(state, teamId) : getClubLineup(state, teamId);
  const base = calculateTeamStrength(state, teamId, isInternational);
  if (!lineup.length) return base;
  const tactics = tacticalModifiers(state, teamId, isInternational);
  const positionSet = unit === 'attack' ? ['FW', 'MF'] : unit === 'midfield' ? ['MF', 'DF'] : ['GK', 'DF'];
  const players = lineup.filter((player) => positionSet.includes(player.position));
  const average = players.length ? players.reduce((sum, player) => sum + player.rating, 0) / players.length : base;
  const multiplier = unit === 'attack' ? tactics.attack : unit === 'midfield' ? tactics.midfield : tactics.defence;
  return base * 0.55 + average * 0.45 * multiplier;
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
    ? penalties.home > penalties.away ? homeId : awayId
    : hg > ag ? homeId : awayId;
  return { homeGoals: hg, awayGoals: ag, extraTime, penalties, winnerId };
}

function simulateMatch(state, {
  homeId,
  awayId,
  competitionId,
  competitionName,
  week,
  knockout = false,
  isInternational = false,
  stage = null,
  table = null,
  neutral = false
}) {
  const homeStrength = calculateTeamStrength(state, homeId, isInternational) + (neutral ? 0 : 2.0);
  const awayStrength = calculateTeamStrength(state, awayId, isInternational);
  const homeAttack = calculateUnitStrength(state, homeId, isInternational, 'attack');
  const awayAttack = calculateUnitStrength(state, awayId, isInternational, 'attack');
  const homeDefence = calculateUnitStrength(state, homeId, isInternational, 'defence');
  const awayDefence = calculateUnitStrength(state, awayId, isInternational, 'defence');
  const difference = homeStrength - awayStrength;
  const homeLambda = clamp(1.28 + (homeAttack - awayDefence) / 24 + difference / 55, 0.18, 3.45);
  const awayLambda = clamp(1.02 + (awayAttack - homeDefence) / 25 - difference / 62, 0.15, 3.15);
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
      const scorer = weightedPick(state, lineup, goalWeight);
      addContribution(scorer.id, 'goals');
      let assister = null;
      if (random(state) < 0.74 && lineup.length > 1) {
        const options = lineup.filter((player) => player.id !== scorer.id);
        assister = weightedPick(state, options, assistWeight);
        addContribution(assister.id, 'assists');
      }
      goalEvents.push({
        teamId,
        opponentId,
        side,
        scorerId: scorer.id,
        assistId: assister?.id || null,
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
      let rating = 6.15 + random(state) * 0.9;
      rating += contribution.goals * 0.9 + contribution.assists * 0.45;
      rating += (player.rating - 70) / 115;
      if (winnerSide === side || resolution?.winnerId === teamId) rating += 0.32;
      if (winnerSide !== 'draw' && winnerSide !== side && !resolution) rating -= 0.22;
      if (player.position === 'GK' && goalsAgainst === 0) rating += 0.68 * roleData(player).defence;
      if (player.position === 'DF' && goalsAgainst === 0) rating += 0.31 * roleData(player).defence;
      rating = clamp(rating, 5.1, 10);
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
        result: resolution?.winnerId
          ? resolution.winnerId === teamId ? 'W' : 'L'
          : goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D',
        isInternational
      });
    });
  };
  rateLineup(homeLineup, homeId, 'home', homeGoals, awayGoals);
  rateLineup(awayLineup, awayId, 'away', awayGoals, homeGoals);

  let manOfMatchId = null;
  const participants = [...homeLineup, ...awayLineup];
  if (participants.length) {
    const candidates = participants
      .map((player) => {
        const contribution = contributions.get(player.id) || { goals: 0, assists: 0 };
        return {
          id: player.id,
          score: player.rating + contribution.goals * 7 + contribution.assists * 3 + random(state) * 2
        };
      })
      .sort((a, b) => b.score - a.score);
    manOfMatchId = candidates[0].id;
    const stat = ensurePlayerStat(
      state,
      manOfMatchId,
      competitionId,
      homeLineup.some((player) => player.id === manOfMatchId) ? homeId : awayId,
      isInternational
    );
    stat.manOfTheMatch += 1;
  }

  const id = `m-${state.season}-${week}-${state.current.matches.length + 1}`;
  for (const player of participants) {
    const log = state.current.playerMatchLogs[player.id];
    const last = log?.[log.length - 1];
    if (
      last &&
      last.matchId === null &&
      last.week === week &&
      last.competitionId === competitionId &&
      [homeId, awayId].includes(last.teamId)
    ) last.matchId = id;
  }
  const match = {
    id,
    season: state.season,
    week,
    competitionId,
    competitionName,
    stage,
    homeId,
    awayId,
    homeGoals,
    awayGoals,
    winnerId: resolution?.winnerId || (homeGoals > awayGoals ? homeId : awayGoals > homeGoals ? awayId : null),
    extraTime: resolution?.extraTime || false,
    penalties: resolution?.penalties || null,
    goalEvents,
    manOfMatchId,
    isInternational,
    landmark: knockout && ['Final', 'Semi-final'].includes(stage)
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
  } else {
    const homeTeam = getRuntimeCache(state).nationalById.get(homeId);
    const awayTeam = getRuntimeCache(state).nationalById.get(awayId);
    const resultDelta = homeGoals > awayGoals ? 0.3 : homeGoals < awayGoals ? -0.24 : 0.04;
    if (homeTeam) homeTeam.form = clamp(homeTeam.form * 0.7 + resultDelta, -2, 2);
    if (awayTeam) awayTeam.form = clamp(awayTeam.form * 0.7 - resultDelta, -2, 2);
  }

  generateMatchNews(state, match, homeStrength, awayStrength);
  return match;
}

function generateMatchNews(state, match, homeStrength, awayStrength) {
  const homeName = getTeamName(state, match.homeId, match.isInternational);
  const awayName = getTeamName(state, match.awayId, match.isInternational);
  const score = `${match.homeGoals}-${match.awayGoals}`;
  const scorerCounts = {};
  match.goalEvents.forEach((goal) => {
    scorerCounts[goal.scorerId] = (scorerCounts[goal.scorerId] || 0) + 1;
  });
  const hatTrick = Object.entries(scorerCounts).find(([, goals]) => goals >= 3);
  if (hatTrick) {
    const player = getPlayer(state, hatTrick[0]);
    state.current.news.unshift({
      id: `news-${match.id}-hat`,
      week: match.week,
      importance: 'major',
      category: match.competitionName,
      headline: `${player?.name || 'A star'} strikes ${hatTrick[1]} in a statement performance`,
      body: `${homeName} ${score} ${awayName}. The ${player?.roleLabel || 'attacker'} produced one of the season's defining displays.`,
      entityType: 'player',
      entityId: player?.id
    });
  }
  const strengthDiff = homeStrength - awayStrength;
  const upset = (strengthDiff > 9 && match.awayGoals > match.homeGoals) || (strengthDiff < -9 && match.homeGoals > match.awayGoals);
  if (upset) {
    const winnerId = match.homeGoals > match.awayGoals ? match.homeId : match.awayId;
    state.current.news.unshift({
      id: `news-${match.id}-upset`,
      week: match.week,
      importance: 'major',
      category: match.competitionName,
      headline: `${getTeamName(state, winnerId, match.isInternational)} overturn the hierarchy`,
      body: `${homeName} ${score} ${awayName} becomes a result that could reshape the season.`,
      entityType: match.isInternational ? 'nation' : 'club',
      entityId: winnerId
    });
  }
  const lineups = match.isInternational
    ? [...getNationalLineup(state, match.homeId), ...getNationalLineup(state, match.awayId)]
    : [...getClubLineup(state, match.homeId), ...getClubLineup(state, match.awayId)];
  const displays = lineups.map((player) => {
    const log = [...(state.current.playerMatchLogs[player.id] || [])].reverse().find((item) => item.matchId === match.id);
    return { player, log };
  }).filter((item) => item.log).sort((a, b) => b.log.rating - a.log.rating);
  const elite = displays[0];
  if (elite?.log.rating >= 9.45 && ['generational', 'legend', 'epic'].includes(elite.player.rarity)) {
    state.current.news.unshift({
      id: `news-${match.id}-elite`,
      week: match.week,
      importance: 'major',
      category: 'Star Performance',
      headline: `${elite.player.name} produces a ${elite.log.rating.toFixed(1)} masterpiece`,
      body: `${homeName} ${score} ${awayName}. The ${STAR_RARITIES[elite.player.rarity].label.toLowerCase()} ${elite.player.roleLabel.toLowerCase()} owned the occasion.`,
      entityType: 'player',
      entityId: elite.player.id
    });
  }
  const goalkeeper = displays.find((item) => item.player.position === 'GK' && item.log.cleanSheet && item.log.rating >= 9.15);
  if (goalkeeper) {
    state.current.news.unshift({
      id: `news-${match.id}-keeper`,
      week: match.week,
      importance: 'major',
      category: 'Goalkeeper Watch',
      headline: `${goalkeeper.player.name} seals a ${goalkeeper.log.rating.toFixed(1)} clean sheet`,
      body: `${homeName} ${score} ${awayName}. A commanding performance turns the goalkeeper into the story of the match.`,
      entityType: 'player',
      entityId: goalkeeper.player.id
    });
  }
  if (match.stage === 'Final') {
    state.current.news.unshift({
      id: `news-${match.id}-final`,
      week: match.week,
      importance: 'feature',
      category: match.competitionName,
      headline: `${getTeamName(state, match.winnerId, match.isInternational)} lift the ${match.competitionName}`,
      body: `${homeName} ${score} ${awayName}${match.penalties ? ` (${match.penalties.home}-${match.penalties.away} pens)` : ''}.`,
      entityType: match.isInternational ? 'nation' : 'club',
      entityId: match.winnerId
    });
  }
  state.current.news = state.current.news.slice(0, 240);
}

function simulateLeagueWeek(state, week) {
  for (const league of Object.values(state.current.leagues)) {
    const roundIndex = week - 1;
    const round = league.rounds[roundIndex];
    if (!round) continue;
    round.forEach(({ homeId, awayId }) => simulateMatch(state, {
      homeId,
      awayId,
      competitionId: league.id,
      competitionName: league.name,
      week,
      stage: `Matchday ${roundIndex + 1}`,
      table: league.table
    }));
    if (roundIndex === league.rounds.length - 1) {
      league.championId = sortTable(league.table)[0]?.teamId || null;
    }
  }
}


function distributeSummaryPlayerStats(state, league, row) {
  const lineup = getClubLineup(state, row.teamId);
  if (!lineup.length) return;
  const apps = Math.max(8, row.played);
  const goalShares = lineup.map((player) => ({ player, weight: goalWeight(player) }));
  const assistShares = lineup.map((player) => ({ player, weight: assistWeight(player) }));
  const goals = Object.fromEntries(lineup.map((player) => [player.id, 0]));
  const assists = Object.fromEntries(lineup.map((player) => [player.id, 0]));
  for (let index = 0; index < row.gf; index += 1) goals[weightedPick(state, goalShares, (item) => item.weight).player.id] += 1;
  for (let index = 0; index < Math.round(row.gf * 0.72); index += 1) assists[weightedPick(state, assistShares, (item) => item.weight).player.id] += 1;
  const finish = sortTable(league.table).findIndex((item) => item.teamId === row.teamId) + 1;
  lineup.forEach((player) => {
    const stat = ensurePlayerStat(state, player.id, league.id, row.teamId, false);
    const playerApps = Math.max(6, apps - randomInt(state, 0, 2));
    const averageRating = clamp(6.1 + (league.table.length + 1 - finish) * 0.08 + (player.rating - 65) / 60 + random(state) * 0.45, 5.8, 8.6);
    stat.apps += playerApps;
    stat.starts += playerApps;
    stat.goals += goals[player.id] || 0;
    stat.assists += assists[player.id] || 0;
    if (['GK', 'DF'].includes(player.position)) stat.cleanSheets += Math.round(row.cleanSheets * (0.72 + random(state) * 0.25));
    stat.ratingSum += averageRating * playerApps;
    stat.averageRating = stat.ratingSum / stat.apps;
  });
}

function simulateSummaryLeagues(state) {
  for (const league of Object.values(state.current.leagues).filter((item) => item.tier === 'summary' && !item.completed)) {
    const rounds = roundRobin(league.table.map((row) => row.teamId), true);
    rounds.forEach((round) => round.forEach(({ homeId, awayId }) => {
      const homeStrength = calculateTeamStrength(state, homeId, false) + 1.6;
      const awayStrength = calculateTeamStrength(state, awayId, false);
      const homeGoals = poisson(state, clamp(1.2 + (homeStrength - awayStrength) / 27, 0.2, 3.1));
      const awayGoals = poisson(state, clamp(0.95 + (awayStrength - homeStrength) / 29, 0.15, 2.8));
      updateTable(league.table, homeId, awayId, homeGoals, awayGoals);
    }));
    league.table.forEach((row) => {
      row.cleanSheets = Math.max(0, Math.round((row.played - row.ga * 0.58) * 0.42));
      distributeSummaryPlayerStats(state, league, row);
    });
    const sorted = sortTable(league.table);
    league.championId = sorted[0]?.teamId || null;
    league.completed = true;
    const cup = state.current.domesticCups[`CUP-${league.id}`];
    if (cup && !cup.championId) {
      const clubs = sorted.map((row) => getClub(state, row.teamId)).filter(Boolean);
      const winner = weightedPick(state, clubs, (club) => Math.max(1, club.strength ** 2));
      const finalist = weightedPick(state, clubs.filter((club) => club.id !== winner?.id), (club) => Math.max(1, club.strength ** 2));
      cup.championId = winner?.id || league.championId;
      cup.finalistId = finalist?.id || sorted[1]?.teamId || null;
      cup.stage = 'Complete';
    }
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
  if (byeCount > 0) {
    const shuffled = shuffle(state, participants);
    byes = shuffled.slice(0, byeCount);
    participants = shuffled.slice(byeCount);
  }
  const pairs = pairTeams(state, participants);
  const winners = [...byes];
  const stage = cup.active.length > 16
    ? 'Opening Round'
    : cup.active.length === 16
      ? 'Round of 16'
      : cup.active.length === 8
        ? 'Quarter-final'
        : cup.active.length === 4
          ? 'Semi-final'
          : 'Final';
  const roundMatches = [];
  pairs.forEach(([homeId, awayId]) => {
    if (!awayId) {
      winners.push(homeId);
      return;
    }
    const match = simulateMatch(state, {
      homeId,
      awayId,
      competitionId: cup.id,
      competitionName: cup.name,
      week,
      stage,
      knockout: true,
      neutral: stage === 'Final'
    });
    winners.push(match.winnerId);
    roundMatches.push(match.id);
    if (stage === 'Final') cup.finalistId = match.winnerId === homeId ? awayId : homeId;
  });
  cup.rounds.push({ week, stage, matchIds: roundMatches });
  cup.active = winners;
  if (winners.length === 1) {
    cup.championId = winners[0];
    cup.stage = 'Complete';
  } else {
    cup.stage = winners.length > 16
      ? 'Opening Round'
      : winners.length === 16
        ? 'Round of 16'
        : winners.length === 8
          ? 'Quarter-finals'
          : winners.length === 4
            ? 'Semi-finals'
            : 'Final';
  }
}

function simulateDomesticCups(state, week) {
  Object.values(state.current.domesticCups).filter((cup) => cup.tier !== 'summary').forEach((cup) => simulateDomesticCupRound(state, cup, week));
}

function simulateSuperCup(state, week) {
  const cup = state.current.supercup;
  if (cup.championId) return;
  const stage = cup.active.length === 4 ? 'Semi-final' : 'Final';
  const pairs = pairTeams(state, cup.active);
  const winners = [];
  const matchIds = [];
  pairs.forEach(([homeId, awayId]) => {
    const match = simulateMatch(state, {
      homeId,
      awayId,
      competitionId: 'SUPERCUP',
      competitionName: cup.name,
      week,
      stage,
      knockout: true,
      neutral: true
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
      homeId,
      awayId,
      competitionId,
      competitionName,
      week,
      stage: `${competition.stage} · Group ${group.id}`,
      table: group.table,
      isInternational
    }));
  });
}

function prepareClubKnockout(state, comp) {
  if (comp.knockout || comp.championId) return;
  const totalTeams = comp.groups.reduce((sum, group) => sum + group.teamIds.length, 0);
  const desired = totalTeams >= 16 ? 16 : totalTeams >= 8 ? 8 : 4;
  const rankedGroups = comp.groups.map((group) => sortTable(group.table));
  const automatic = rankedGroups.flatMap((rows) => rows.slice(0, 2));
  const automaticIds = new Set(automatic.map((row) => row.teamId));
  const additional = rankedGroups.flatMap((rows) => rows.slice(2)).filter((row) => !automaticIds.has(row.teamId));
  const qualifiers = [...automatic, ...additional]
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
    .slice(0, desired)
    .map((row) => row.teamId);
  comp.knockout = {
    round: qualifiers.length === 16 ? 'Round of 16' : qualifiers.length === 8 ? 'Quarter-final' : 'Semi-final',
    ties: pairTeams(state, qualifiers).map(([homeId, awayId]) => ({ homeId, awayId, firstLeg: null, secondLeg: null, winnerId: null })),
    rounds: []
  };
  comp.stage = comp.knockout.round === 'Round of 16' ? 'Round of 16' : `${comp.knockout.round}s`;
}

function simulateClubTwoLegRound(state, comp, week, leg) {
  const knockout = comp.knockout;
  if (!knockout || knockout.round === 'Final') return;
  const stage = knockout.round;
  knockout.ties.forEach((tie) => {
    const homeId = leg === 1 ? tie.homeId : tie.awayId;
    const awayId = leg === 1 ? tie.awayId : tie.homeId;
    const match = simulateMatch(state, {
      homeId,
      awayId,
      competitionId: comp.id,
      competitionName: comp.name,
      week,
      stage: `${stage} · Leg ${leg}`
    });
    if (leg === 1) tie.firstLeg = match.id;
    else tie.secondLeg = match.id;
  });
  if (leg !== 2) return;
  const winners = [];
  knockout.ties.forEach((tie) => {
    const first = state.current.matches.find((match) => match.id === tie.firstLeg);
    const second = state.current.matches.find((match) => match.id === tie.secondLeg);
    if (!first || !second) return;
    const homeAggregate = first.homeGoals + second.awayGoals;
    const awayAggregate = first.awayGoals + second.homeGoals;
    tie.winnerId = homeAggregate === awayAggregate
      ? resolveDraw(state, tie.homeId, tie.awayId, 0, 0, false).winnerId
      : homeAggregate > awayAggregate ? tie.homeId : tie.awayId;
    winners.push(tie.winnerId);
  });
  knockout.rounds.push({ stage, ties: structuredClone(knockout.ties) });
  knockout.round = winners.length === 8 ? 'Quarter-final' : winners.length === 4 ? 'Semi-final' : 'Final';
  knockout.ties = pairTeams(state, winners).map(([homeId, awayId]) => ({ homeId, awayId, firstLeg: null, secondLeg: null, winnerId: null }));
  comp.stage = knockout.round === 'Final' ? 'Final' : `${knockout.round}s`;
}

function simulateClubFinal(state, comp, week) {
  const tie = comp.knockout?.ties?.[0];
  if (!tie || comp.championId || comp.knockout.round !== 'Final') return;
  const match = simulateMatch(state, {
    homeId: tie.homeId,
    awayId: tie.awayId,
    competitionId: comp.id,
    competitionName: comp.name,
    week,
    stage: 'Final',
    knockout: true,
    neutral: true
  });
  comp.championId = match.winnerId;
  comp.finalistId = match.winnerId === tie.homeId ? tie.awayId : tie.homeId;
  comp.stage = 'Complete';
  comp.completed = true;
}

function prepareChampionsKnockout(state) {
  prepareClubKnockout(state, state.current.champions);
}

function simulateTwoLegRound(state, week, leg) {
  simulateClubTwoLegRound(state, state.current.champions, week, leg);
}

function simulateChampionsFinal(state, week) {
  simulateClubFinal(state, state.current.champions, week);
}

function competitionGroupRoundCount(comp) {
  return Math.max(0, ...comp.groups.map((group) => group.rounds.length));
}

function finalizeQualifiers(state, comp) {
  const ranked = comp.groups.flatMap((group) => sortTable(group.table));
  const winners = comp.groups.map((group) => sortTable(group.table)[0]).filter(Boolean);
  const winnerIds = winners.map((row) => row.teamId);
  const remaining = ranked
    .filter((row) => !winnerIds.includes(row.teamId))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  comp.qualifiedIds = [...winnerIds, ...remaining.map((row) => row.teamId)].slice(0, comp.qualifiers);
  comp.completed = true;
  comp.stage = comp.friendly ? 'Complete' : `${comp.qualifiedIds.length} qualified`;
  if (comp.id === 'WCQ') {
    state.internationalCycle.worldCupQualified = [...comp.qualifiedIds];
  } else if (comp.kind === 'qualifier') {
    state.internationalCycle.regionalQualified[comp.confederation] = [...comp.qualifiedIds];
  }
}

function prepareInternationalKnockout(state, comp) {
  const desired = comp.id === 'WC' ? 16 : Math.min(8, 2 ** Math.floor(Math.log2(Math.max(2, comp.groups.length * 2))));
  const sortedGroups = comp.groups.map((group) => sortTable(group.table));
  const top = sortedGroups.flatMap((rows) => rows.slice(0, 2));
  const qualifiers = top
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
    .slice(0, desired)
    .map((row) => row.teamId);
  comp.knockout = {
    round: qualifiers.length === 16 ? 'Round of 16' : qualifiers.length === 8 ? 'Quarter-final' : 'Semi-final',
    active: qualifiers,
    rounds: []
  };
  comp.stage = comp.knockout.round === 'Round of 16' ? 'Round of 16' : `${comp.knockout.round}s`;
}

function simulateInternationalKnockout(state, comp, week) {
  if (comp.championId || !comp.knockout?.active?.length) return;
  const active = comp.knockout.active;
  const stage = active.length === 16
    ? 'Round of 16'
    : active.length === 8
      ? 'Quarter-final'
      : active.length === 4
        ? 'Semi-final'
        : 'Final';
  const pairs = pairTeams(state, active);
  const winners = [];
  const matchIds = [];
  pairs.forEach(([homeId, awayId]) => {
    const match = simulateMatch(state, {
      homeId,
      awayId,
      competitionId: comp.id,
      competitionName: comp.name,
      week,
      stage,
      knockout: true,
      isInternational: true,
      neutral: true
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
    comp.completed = true;
  } else {
    comp.knockout.round = winners.length === 8
      ? 'Quarter-final'
      : winners.length === 4
        ? 'Semi-final'
        : 'Final';
    comp.stage = comp.knockout.round === 'Quarter-final' ? 'Quarter-finals' : `${comp.knockout.round}s`;
  }
}

function simulateInternationalCalendar(state, week) {
  const comps = Object.values(state.current.internationalCompetitions || {});
  const cycle = state.season % 4;
  if (cycle === 1 || cycle === 3) {
    const weeks = [3, 8, 14, 20, 26, 32, 36];
    const index = weeks.indexOf(week);
    if (index >= 0) {
      for (const comp of comps) {
        const maxRounds = competitionGroupRoundCount(comp);
        if (index < maxRounds) {
          simulateGroupRound(state, comp, comp.id, comp.name, week, index, true);
        }
        if (index === Math.min(weeks.length, maxRounds) - 1 && !comp.completed) {
          finalizeQualifiers(state, comp);
        }
      }
    }
    return;
  }

  const groupWeeks = [27, 29, 31, 33, 35];
  const groupIndex = groupWeeks.indexOf(week);
  if (groupIndex >= 0) {
    for (const comp of comps) {
      if (groupIndex < competitionGroupRoundCount(comp)) {
        simulateGroupRound(state, comp, comp.id, comp.name, week, groupIndex, true);
      }
      if (groupIndex === groupWeeks.length - 1) prepareInternationalKnockout(state, comp);
    }
  }
  if ([38, 40, 42, 44].includes(week)) {
    for (const comp of comps) simulateInternationalKnockout(state, comp, week);
  }
}

function advanceDate(state, days = 7) {
  const date = new Date(`${state.current.date}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  state.current.date = date.toISOString().slice(0, 10);
}

function addWeeklyDigest(state, week, matchCountBefore) {
  const matches = state.current.matches.slice(matchCountBefore);
  if (!matches.length) return;
  const biggest = [...matches].sort(
    (a, b) => b.homeGoals + b.awayGoals - (a.homeGoals + a.awayGoals)
  )[0];
  const favoriteResults = matches.filter((match) =>
    state.preferences.favoriteClubIds.includes(match.homeId) ||
    state.preferences.favoriteClubIds.includes(match.awayId)
  );
  const highlight = favoriteResults[0] || biggest;
  state.current.news.unshift({
    id: `news-${state.season}-${week}-digest`,
    week,
    importance: 'digest',
    category: 'Weekly Review',
    headline: `Week ${week}: ${getTeamName(state, highlight.homeId, highlight.isInternational)} ${highlight.homeGoals}-${highlight.awayGoals} ${getTeamName(state, highlight.awayId, highlight.isInternational)}`,
    body: `${matches.length} matches were completed. Tables, player races and international paths have been updated.`
  });
  state.current.news = state.current.news.slice(0, 160);
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

  const continentalGroupWeeks = [4, 7, 10, 13, 16, 19];
  const continentalCompetitions = Object.values(state.current.continentalCompetitions || {});
  if (continentalGroupWeeks.includes(week)) {
    const roundIndex = continentalGroupWeeks.indexOf(week);
    continentalCompetitions.forEach((competition) => {
      simulateGroupRound(state, competition, competition.id, competition.name, week, roundIndex, false);
      if (week === 19) prepareClubKnockout(state, competition);
    });
  }
  if ([22, 24].includes(week)) continentalCompetitions.forEach((competition) => simulateClubTwoLegRound(state, competition, week, week === 22 ? 1 : 2));
  if ([27, 29].includes(week)) continentalCompetitions.forEach((competition) => simulateClubTwoLegRound(state, competition, week, week === 27 ? 1 : 2));
  if ([32, 34].includes(week)) continentalCompetitions.forEach((competition) => simulateClubTwoLegRound(state, competition, week, week === 32 ? 1 : 2));
  if (week === 38) continentalCompetitions.forEach((competition) => simulateClubFinal(state, competition, week));
  if (week === 36) simulateSummaryLeagues(state);

  simulateInternationalCalendar(state, week);
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
  return Object.values(state.current.playerStats).filter(
    (stat) => stat.competitionId === competitionId && stat.apps > 0
  );
}

function chooseBestPlayer(stats, formula) {
  return [...stats].sort((a, b) => formula(b) - formula(a))[0] || null;
}

function award(state, name, playerId, competitionId = null, rank = 1, category = null) {
  if (!playerId) return;
  state.history.awards.push({
    id: `award-${state.season}-${slug(name)}-${playerId}-${rank}`,
    season: state.season,
    seasonLabel: formatSeason(state.season),
    name,
    playerId,
    competitionId,
    rank,
    category
  });
}

function calculateCompetitionAwards(state, competitionId, competitionName) {
  const stats = statsForCompetition(state, competitionId);
  if (!stats.length) return;
  const scorer = chooseBestPlayer(
    stats,
    (stat) => stat.goals * 100 + stat.assists + stat.averageRating / 10
  );
  const offensive = chooseBestPlayer(
    stats.filter((stat) => ['FW', 'MF'].includes(getPlayer(state, stat.playerId)?.position)),
    (stat) => stat.averageRating * 25 + stat.goals * 3 + stat.assists * 2
  );
  const defender = chooseBestPlayer(
    stats.filter((stat) => getPlayer(state, stat.playerId)?.position === 'DF'),
    (stat) => stat.averageRating * 30 + stat.cleanSheets * 2 + stat.goals + stat.assists
  );
  const goalkeeper = chooseBestPlayer(
    stats.filter((stat) => getPlayer(state, stat.playerId)?.position === 'GK'),
    (stat) => stat.averageRating * 30 + stat.cleanSheets * 3
  );
  const mvp = chooseBestPlayer(
    stats,
    (stat) => stat.averageRating * 35 + stat.goals * 2.3 + stat.assists * 1.5 + stat.cleanSheets * 0.5
  );
  award(state, `${competitionName} Top Scorer`, scorer?.playerId, competitionId, 1, 'top_scorer');
  award(state, `${competitionName} Best Offensive Player`, offensive?.playerId, competitionId, 1, 'best_offensive');
  award(state, `${competitionName} Best Defender`, defender?.playerId, competitionId, 1, 'best_defender');
  award(state, `${competitionName} Best Goalkeeper`, goalkeeper?.playerId, competitionId, 1, 'best_goalkeeper');
  award(state, `${competitionName} Player of the Season`, mvp?.playerId, competitionId, 1, 'mvp');
}

function calculateAwards(state) {
  for (const league of Object.values(state.current.leagues)) {
    calculateCompetitionAwards(state, league.id, league.name);
  }
  for (const cup of Object.values(state.current.domesticCups)) {
    calculateCompetitionAwards(state, cup.id, cup.name);
  }
  calculateCompetitionAwards(state, 'SUPERCUP', state.current.supercup.name);
  for (const competition of Object.values(state.current.continentalCompetitions || {})) {
    calculateCompetitionAwards(state, competition.id, competition.name);
  }
  for (const competition of Object.values(state.current.internationalCompetitions || {})) {
    calculateCompetitionAwards(state, competition.id, competition.name);
  }

  const eliteLeagueIds = new Set(['ESP1', 'ENG1', 'ITA1', 'GER1', 'FRA1']);
  const strongLeagueIds = new Set(['POR1', 'NED1', 'BRA1', 'ARG1', 'BEL1', 'TUR1']);
  const continentalWeights = {
    UCL: 2.45,
    UEL: 1.48,
    UECL: 1.05,
    LIB: 2.0,
    SUD: 1.2,
    CCC: 1.02,
    ACL: 0.96,
    AFC2: 0.68,
    CAFCL: 0.94,
    CAFCC: 0.66,
    OCL: 0.5
  };
  const competitionWeight = (competitionId, isInternational) => {
    if (isInternational) {
      if (competitionId === 'WC') return 2.85;
      if (['EURO', 'COPA'].includes(competitionId)) return 2.25;
      if (['AFCON', 'ASIACUP', 'GOLDCUP'].includes(competitionId)) return 1.65;
      if (competitionId === 'OFC') return 1.0;
      return 0.68;
    }
    if (continentalWeights[competitionId]) return continentalWeights[competitionId];
    const league = LEAGUE_DEFINITIONS.find((definition) => definition.id === competitionId);
    if (league) {
      if (eliteLeagueIds.has(league.id)) return 1.48;
      if (strongLeagueIds.has(league.id)) return 1.16;
      return league.tier === 'detailed' ? 0.78 : 0.38;
    }
    const cupLeague = LEAGUE_DEFINITIONS.find((definition) => `CUP-${definition.id}` === competitionId);
    if (cupLeague) {
      if (eliteLeagueIds.has(cupLeague.id)) return 0.82;
      if (strongLeagueIds.has(cupLeague.id)) return 0.62;
      return cupLeague.tier === 'detailed' ? 0.42 : 0.22;
    }
    if (competitionId === 'SUPERCUP') return 0.42;
    return 0.5;
  };
  const aggregate = new Map();
  Object.values(state.current.playerStats).filter((stat) => stat.apps > 0).forEach((stat) => {
    const weight = competitionWeight(stat.competitionId, stat.isInternational);
    const item = aggregate.get(stat.playerId) || {
      playerId: stat.playerId,
      apps: 0,
      weightedApps: 0,
      goals: 0,
      assists: 0,
      ratingWeighted: 0,
      internationalScore: 0
    };
    item.apps += stat.apps;
    item.weightedApps += stat.apps * weight;
    item.goals += stat.goals * weight;
    item.assists += stat.assists * weight;
    item.ratingWeighted += stat.averageRating * stat.apps * weight;
    if (stat.isInternational) item.internationalScore += (stat.goals * 3 + stat.assists * 1.5 + stat.averageRating) * weight;
    aggregate.set(stat.playerId, item);
  });
  const clubTitleBonus = (clubId) => {
    if (!clubId) return 0;
    let bonus = 0;
    for (const league of Object.values(state.current.leagues)) {
      const winnerId = sortTable(league.table)[0]?.teamId;
      if (winnerId !== clubId) continue;
      bonus += eliteLeagueIds.has(league.id) ? 9 : strongLeagueIds.has(league.id) ? 5 : 2;
    }
    for (const cup of Object.values(state.current.domesticCups)) if (cup.championId === clubId) bonus += 2;
    if (state.current.supercup.championId === clubId) bonus += 1;
    const titleValues = { UCL: 24, UEL: 8, UECL: 4, LIB: 16, SUD: 6, CCC: 4, ACL: 4, AFC2: 2, CAFCL: 4, CAFCC: 2, OCL: 1 };
    const finalistValues = { UCL: 11, UEL: 4, UECL: 2, LIB: 8, SUD: 3, CCC: 2, ACL: 2, AFC2: 1, CAFCL: 2, CAFCC: 1, OCL: 0.5 };
    for (const competition of Object.values(state.current.continentalCompetitions || {})) {
      if (competition.championId === clubId) bonus += titleValues[competition.id] || 2;
      else if (competition.finalistId === clubId) bonus += finalistValues[competition.id] || 1;
    }
    return bonus;
  };
  const internationalContext = (nationality) => {
    let bonus = 0;
    let major = false;
    for (const competition of Object.values(state.current.internationalCompetitions || {})) {
      const winnerValues = { WC: 27, EURO: 20, COPA: 20, AFCON: 11, ASIACUP: 10, GOLDCUP: 9, OFC: 5 };
      const finalistValues = { WC: 15, EURO: 11, COPA: 11, AFCON: 6, ASIACUP: 5, GOLDCUP: 5, OFC: 2 };
      if (competition.championId === nationality) {
        bonus += winnerValues[competition.id] || 2;
        if (['WC', 'EURO', 'COPA'].includes(competition.id)) major = true;
      } else if (competition.finalistId === nationality) {
        bonus += finalistValues[competition.id] || 1;
        if (['WC', 'EURO', 'COPA'].includes(competition.id)) major = true;
      }
    }
    return { bonus, major };
  };
  const candidates = [...aggregate.values()]
    .map((item) => {
      const player = getPlayer(state, item.playerId);
      const club = player?.clubId ? getClub(state, player.clubId) : null;
      const leagueId = club?.leagueId;
      const average = item.weightedApps ? item.ratingWeighted / item.weightedApps : 0;
      const clubBonus = clubTitleBonus(club?.id);
      const international = internationalContext(player?.nationality);
      const ucl = state.current.continentalCompetitions?.UCL;
      const libertadores = state.current.continentalCompetitions?.LIB;
      const majorClubRun = [ucl, libertadores].some((competition) => competition && [competition.championId, competition.finalistId].includes(club?.id));
      const eliteLeague = eliteLeagueIds.has(leagueId);
      const strongLeague = strongLeagueIds.has(leagueId);
      const eliteContext = eliteLeague || majorClubRun || international.major;
      const qualityGate = (player?.rating || 0) >= 80 || majorClubRun || international.major;
      return {
        ...item,
        average,
        eligible: item.apps >= 8 && qualityGate && (eliteContext || ((player?.rating || 0) >= 90 && strongLeague)),
        score: average * 11.2 + item.goals * 1.42 + item.assists * 0.82 + clubBonus + international.bonus + item.internationalScore * 0.22 + (eliteLeague ? 6 : strongLeague ? 2 : 0) + (player?.fame || 0) * 0.11
      };
    })
    .filter((item) => item.eligible)
    .sort((a, b) => b.score - a.score);
  candidates.slice(0, 3).forEach((candidate, index) =>
    award(state, "Ballon d'Or", candidate.playerId, 'GLOBAL', index + 1, 'ballon_dor')
  );
  const positionalBest = ['GK', 'DF', 'MF', 'FW'].flatMap((position) => candidates.filter((candidate) => getPlayer(state, candidate.playerId)?.position === position).slice(0, position === 'DF' || position === 'MF' ? 3 : 2));
  positionalBest.slice(0, 11).forEach((candidate) => award(state, 'World Best XI', candidate.playerId, 'GLOBAL', 1, 'world_best_xi'));
  const young = candidates.find((candidate) => state.season - getPlayer(state, candidate.playerId)?.birthYear <= 22);
  award(state, 'World Young Player of the Year', young?.playerId, 'GLOBAL', 1, 'young_player');
}

function registerChampion(state, competitionId, competitionName, winnerId, runnerUpId = null, isInternational = false) {
  if (!winnerId) return;
  state.history.champions.push({
    season: state.season,
    seasonLabel: formatSeason(state.season),
    competitionId,
    competitionName,
    winnerId,
    runnerUpId,
    isInternational
  });
  const players = isInternational ? getNationalLineup(state, winnerId) : getClubLineup(state, winnerId);
  players.forEach((player) => state.history.honours.push({
    season: state.season,
    seasonLabel: formatSeason(state.season),
    playerId: player.id,
    competitionId,
    competitionName,
    teamId: winnerId,
    isInternational
  }));
  const coach = getCoach(state, winnerId, isInternational);
  if (coach) coach.trophies = (coach.trophies || 0) + 1;
}

function archiveClubCompetitionSummaries(state) {
  const summaries = new Map();
  for (const match of state.current.matches) {
    for (const [teamId, opponentId, goalsFor, goalsAgainst] of [
      [match.homeId, match.awayId, match.homeGoals, match.awayGoals],
      [match.awayId, match.homeId, match.awayGoals, match.homeGoals]
    ]) {
      const key = `${match.competitionId}::${teamId}`;
      const row = summaries.get(key) || {
        season: state.season,
        seasonLabel: formatSeason(state.season),
        competitionId: match.competitionId,
        teamId,
        apps: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        cleanSheets: 0,
        isInternational: match.isInternational
      };
      row.apps += 1;
      row.gf += goalsFor;
      row.ga += goalsAgainst;
      if (goalsFor > goalsAgainst) row.wins += 1;
      else if (goalsFor < goalsAgainst) row.losses += 1;
      else row.draws += 1;
      if (goalsAgainst === 0) row.cleanSheets += 1;
      summaries.set(key, row);
    }
  }
  for (const league of Object.values(state.current.leagues).filter((item) => item.tier === 'summary')) {
    for (const row of league.table) {
      const key = `${league.id}::${row.teamId}`;
      if (!summaries.has(key)) summaries.set(key, {
        season: state.season,
        seasonLabel: formatSeason(state.season),
        competitionId: league.id,
        teamId: row.teamId,
        apps: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        gf: row.gf,
        ga: row.ga,
        cleanSheets: row.cleanSheets || 0,
        isInternational: false
      });
    }
  }
  state.history.clubCompetitionSeasons.push(...summaries.values());
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
  archiveClubCompetitionSummaries(state);
  for (const league of Object.values(state.current.leagues)) {
    const sorted = sortTable(league.table);
    sorted.forEach((row, index) => state.history.clubSeasons.push({
      season: state.season,
      seasonLabel: formatSeason(state.season),
      leagueId: league.id,
      clubId: row.teamId,
      position: index + 1,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      gf: row.gf,
      ga: row.ga,
      gd: row.gd,
      points: row.points,
      cleanSheets: league.tier === 'summary' ? (row.cleanSheets || 0) : state.current.matches.filter(
        (match) => match.competitionId === league.id &&
          ((match.homeId === row.teamId && match.awayGoals === 0) ||
           (match.awayId === row.teamId && match.homeGoals === 0))
      ).length
    }));
    registerChampion(state, league.id, league.name, sorted[0]?.teamId, sorted[1]?.teamId);
  }
  for (const cup of Object.values(state.current.domesticCups)) {
    registerChampion(state, cup.id, cup.name, cup.championId, cup.finalistId);
  }
  registerChampion(state, 'SUPERCUP', state.current.supercup.name, state.current.supercup.championId, state.current.supercup.finalistId);
  for (const competition of Object.values(state.current.continentalCompetitions || {})) {
    registerChampion(state, competition.id, competition.name, competition.championId, competition.finalistId);
  }
  for (const comp of Object.values(state.current.internationalCompetitions || {})) {
    if (comp.championId) registerChampion(state, comp.id, comp.name, comp.championId, comp.finalistId, true);
  }
  const landmarks = state.current.matches
    .filter((match) => match.landmark || match.stage === 'Final')
    .map((match) => ({ ...match }));
  state.history.landmarkMatches.push(...landmarks);
}

function rarityCounts(state) {
  return state.players
    .filter((player) => player.status === 'active')
    .reduce((counts, player) => {
      counts[player.rarity] = (counts[player.rarity] || 0) + 1;
      return counts;
    }, {});
}

function chooseNewRarity(state, counts, remainingSlots) {
  const targets = { generational: 3, legend: 14, epic: 42 };
  for (const rarity of ['generational', 'legend', 'epic']) {
    if ((counts[rarity] || 0) < targets[rarity]) return rarity;
  }
  const roll = random(state);
  if (roll < 0.13) return 'rare';
  if (roll < 0.44) return 'uncommon';
  return 'common';
}

function generateReplacementStars(state) {
  const active = state.players.filter((player) => player.status === 'active').length;
  const needed = Math.max(0, state.targetActivePlayers - active);
  const counts = rarityCounts(state);
  for (let i = 0; i < needed; i += 1) {
    const rarity = chooseNewRarity(state, counts, needed - i);
    const player = createPlayer(state, {
      rarity,
      careerYear: 0,
      nationalSpecialist: true
    });
    player.birthYear = state.season + 1 - 18;
    player.contractYears = 0;
    player.salary = 0;
    player.happiness = randomInt(state, 64, 92);
    state.players.push(player);
    counts[rarity] = (counts[rarity] || 0) + 1;
    if (['generational', 'legend', 'epic'].includes(rarity)) {
      state.current.news.unshift({
        id: `news-${state.season}-prospect-${player.id}`,
        week: state.current.week,
        importance: rarity === 'generational' ? 'feature' : 'major',
        category: 'New Generation',
        headline: `${player.name} emerges as a ${STAR_RARITIES[rarity].label.toLowerCase()} talent`,
        body: `${teamById(player.nationality)?.name} have produced an ${player.roleLabel.toLowerCase()} rated ${player.baseQuality} at base quality.`,
        entityType: 'player',
        entityId: player.id
      });
    }
  }
}

function refreshClubStrength(state, club) {
  const lineup = getClubLineup(state, club.id);
  if (!lineup.length) return;
  const average = lineup.reduce((sum, player) => sum + player.rating, 0) / lineup.length;
  club.strength = clamp(Math.round(club.baseStrength * 0.55 + average * 0.45), 58, 96);
}

function refreshAllClubStrengths(state) {
  state.clubs.forEach((club) => refreshClubStrength(state, club));
}


function processPromotionRelegation(state) {
  const stories = [];
  for (const definition of LEAGUE_DEFINITIONS.filter((league) => league.tier === 'detailed')) {
    const league = state.current.leagues[definition.id];
    const sorted = sortTable(league?.table || []);
    if (sorted.length < 6) continue;
    const relegated = sorted.slice(-3).map((row) => row.teamId);
    const reserveCandidates = state.clubs
      .filter((club) => club.leagueId === definition.id && club.division === 2)
      .map((club) => ({ club, score: club.strength + club.reputation * 0.25 + random(state) * 12 }))
      .sort((a, b) => b.score - a.score);
    const promoted = reserveCandidates.slice(0, 3).map((item) => item.club.id);
    relegated.forEach((id) => {
      const club = getClub(state, id);
      if (!club) return;
      club.division = 2;
      const roster = state.players
        .filter((player) => player.status === 'active' && player.clubId === id)
        .sort((a, b) => b.rating - a.rating);
      roster.slice(CLUB_ROSTER_TARGET.reserve).forEach((player) => {
        player.clubId = null;
        player.contractYears = 0;
        player.salary = 0;
        player.happiness = Math.max(52, player.happiness - 8);
      });
    });
    promoted.forEach((id) => { const club = getClub(state, id); if (club) club.division = 1; });
    league.relegatedIds = relegated;
    league.promotedIds = promoted;
    state.history.leagueMovements.push({
      season: state.season,
      seasonLabel: formatSeason(state.season),
      leagueId: definition.id,
      relegatedIds: relegated,
      promotedIds: promoted
    });
    stories.push({
      id: `news-${state.season}-movement-${definition.id}`,
      week: 0,
      importance: 'digest',
      category: 'Promotion & Relegation',
      headline: `${definition.name} welcomes three promoted clubs`,
      body: `${promoted.map((id) => getClub(state, id)?.name).join(', ')} rise as ${relegated.map((id) => getClub(state, id)?.name).join(', ')} drop to the second tier.`
    });
  }
  state.pendingSeasonNews = stories.slice(0, 12);
}

function ensureClubRosters(state) {
  const freeAgents = state.players.filter((player) => player.status === 'active' && !player.clubId);
  const clubs = [...state.clubs].sort((a, b) => b.reputation - a.reputation);
  for (const club of clubs) {
    const target = club.division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[club.tier];
    const active = state.players.filter((player) => player.status === 'active' && player.clubId === club.id);
    while (active.length < target) {
      const needPosition = positionNeed(state, club);
      const desiredRating = club.strength + (club.reputation >= 84 ? 2 : club.division === 2 ? -8 : -3);
      const sortByFit = (a, b) => {
        const aFit = Math.abs(a.rating - desiredRating) - STAR_RARITIES[a.rarity].rank * 0.35;
        const bFit = Math.abs(b.rating - desiredRating) - STAR_RARITIES[b.rarity].rank * 0.35;
        return aFit - bFit;
      };
      const positional = freeAgents.filter((player) => player.position === needPosition).sort(sortByFit);
      const player = positional[0] || [...freeAgents].sort(sortByFit)[0];
      if (player) {
        player.clubId = club.id;
        player.contractYears = randomInt(state, 1, 4);
        player.salary = Number((player.marketValue * (0.048 + random(state) * 0.024)).toFixed(1));
        player.happiness = clamp(62 + Math.round((club.reputation - 68) * 0.35) + randomInt(state, -5, 8), 45, 95);
        freeAgents.splice(freeAgents.indexOf(player), 1);
        active.push(player);
        continue;
      }
      const rarity = random(state) < 0.18 ? 'uncommon' : 'common';
      const generated = createPlayer(state, { club, rarity, careerYear: randomInt(state, 0, 3) });
      state.players.push(generated);
      active.push(generated);
      state.targetActivePlayers += 1;
    }
  }
}

function runCoachMarket(state) {
  const vacancies = [];
  for (const club of state.clubs.filter((item) => item.division === 1)) {
    const league = state.current.leagues[club.leagueId];
    const table = sortTable(league?.table || []);
    const actual = table.findIndex((row) => row.teamId === club.id) + 1;
    const peerClubs = table.map((row) => getClub(state, row.teamId)).filter(Boolean).sort((a, b) => b.reputation - a.reputation);
    const expected = peerClubs.findIndex((item) => item.id === club.id) + 1;
    const patience = club.ownerPatience || 1;
    const failure = actual && expected && actual - expected >= Math.max(4, Math.round(6 * patience));
    const eliteUpgrade = club.reputation >= 84 && (club.coachQuality || 65) < 78 && random(state) < 0.18;
    const randomDismissal = random(state) < 0.012 / patience;
    if ((failure || eliteUpgrade || randomDismissal) && club.coachId) {
      const coach = getCoach(state, club.id, false);
      if (coach) {
        coach.clubId = null;
        coach.performanceScore = actual ? expected - actual : -2;
        state.history.coachMoves.push({ season: state.season, coachId: coach.id, fromClubId: club.id, toClubId: null, reason: failure ? 'dismissed' : eliteUpgrade ? 'elite upgrade' : 'board change' });
      }
      club.coachId = null;
      club.coachProfile = null;
      club.coachRarity = null;
      club.coachQuality = null;
      vacancies.push(club);
    }
  }
  state.clubs.filter((club) => club.division === 1 && !club.coachId && !vacancies.includes(club)).forEach((club) => vacancies.push(club));
  const free = state.coaches.filter((coach) => !coach.clubId && !coach.nationalTeamId).sort((a, b) => b.quality - a.quality);
  vacancies.sort((a, b) => b.reputation - a.reputation).forEach((club, index) => {
    const coach = free[index];
    if (!coach) return;
    coach.clubId = club.id;
    coach.seasonsInRole = 0;
    club.coachId = coach.id;
    club.coachProfile = coach.profile;
    club.coachRarity = coach.rarity;
    club.coachQuality = coach.quality;
    state.history.coachMoves.push({ season: state.season + 1, coachId: coach.id, fromClubId: null, toClubId: club.id, reason: 'appointed' });
    state.pendingSeasonNews.push({
      id: `news-${state.season + 1}-coach-${club.id}`,
      week: 0,
      importance: coach.rarity === 'legend' || coach.rarity === 'generational' ? 'major' : 'digest',
      category: 'Coaching Market',
      headline: `${club.name} appoint ${coach.name}`,
      body: `${STAFF_RARITIES[coach.rarity].label} ${COACH_PROFILES[coach.profile].label.toLowerCase()} takes charge.`
    });
  });

  const nationalVacancies = [];
  const internationalCompetitions = Object.values(state.current.internationalCompetitions || {});
  for (const team of state.nationalTeams) {
    if (!team.coachId) {
      nationalVacancies.push(team);
      continue;
    }
    const competition = internationalCompetitions.find((item) => item.groups?.some((group) => group.teamIds.includes(team.id)));
    const group = competition?.groups?.find((item) => item.teamIds.includes(team.id));
    const groupPosition = group ? sortTable(group.table).findIndex((row) => row.teamId === team.id) + 1 : null;
    const missedQualification = competition?.kind === 'qualifier' && !competition.friendly && team.strength >= 74 && !competition.qualifiedIds?.includes(team.id);
    const groupFailure = competition?.kind === 'finals' && team.strength >= 78 && groupPosition && groupPosition > 2;
    const eliteFailure = competition?.kind === 'finals' && team.strength >= 86 && ![competition.championId, competition.finalistId].includes(team.id) && random(state) < 0.16;
    const boardChange = random(state) < 0.008;
    if (!(missedQualification || groupFailure || eliteFailure || boardChange)) continue;
    const coach = state.coaches.find((item) => item.id === team.coachId);
    if (coach) {
      coach.nationalTeamId = null;
      coach.performanceScore = missedQualification || groupFailure ? -3 : -1;
      state.history.coachMoves.push({
        season: state.season,
        coachId: coach.id,
        fromNationalTeamId: team.id,
        toNationalTeamId: null,
        reason: missedQualification ? 'missed qualification' : groupFailure ? 'group-stage failure' : eliteFailure ? 'tournament disappointment' : 'federation change'
      });
    }
    team.coachId = null;
    team.coachProfile = null;
    team.coachRarity = null;
    team.coachQuality = null;
    nationalVacancies.push(team);
  }
  const nationalFree = state.coaches
    .filter((coach) => !coach.clubId && !coach.nationalTeamId)
    .sort((a, b) => b.quality - a.quality);
  nationalVacancies.sort((a, b) => b.strength - a.strength).forEach((team, index) => {
    const coach = nationalFree[index];
    if (!coach) return;
    coach.nationalTeamId = team.id;
    coach.seasonsInRole = 0;
    team.coachId = coach.id;
    team.coachProfile = coach.profile;
    team.coachRarity = coach.rarity;
    team.coachQuality = coach.quality;
    state.history.coachMoves.push({ season: state.season + 1, coachId: coach.id, fromNationalTeamId: null, toNationalTeamId: team.id, reason: 'appointed' });
    if (team.strength >= 80 || ['legend', 'generational'].includes(coach.rarity)) {
      state.pendingSeasonNews.push({
        id: `news-${state.season + 1}-national-coach-${team.id}`,
        week: 0,
        importance: ['legend', 'generational'].includes(coach.rarity) ? 'major' : 'digest',
        category: 'International Coaching',
        headline: `${team.name} appoint ${coach.name}`,
        body: `${STAFF_RARITIES[coach.rarity].label} ${COACH_PROFILES[coach.profile].label.toLowerCase()} begins a new international cycle.`
      });
    }
  });
  state.coaches.forEach((coach) => { if (coach.clubId || coach.nationalTeamId) coach.seasonsInRole = (coach.seasonsInRole || 0) + 1; });
}

function addPreseasonMagazine(state) {
  const majorMoves = [...(state.current.transfers || [])]
    .map((move) => ({ ...move, player: getPlayer(state, move.playerId) }))
    .filter((move) => move.player && ['generational', 'legend', 'epic'].includes(move.player.rarity))
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 6);
  if (majorMoves.length) {
    state.current.news.unshift({
      id: `news-${state.season}-top-signings`,
      week: 0,
      importance: 'feature',
      category: 'Preseason Guide',
      headline: `${majorMoves.length} elite transfers reshape the football world`,
      body: majorMoves.map((move) => `${move.player.name} to ${getClub(state, move.toClubId)?.name} (${move.freeTransfer ? 'free' : `$${move.fee.toFixed(1)}m`})`).join(' · ')
    });
  }
  const flagship = ['UCL', 'LIB', 'CCC', 'ACL', 'CAFCL'];
  for (const id of flagship) {
    const competition = state.current.continentalCompetitions?.[id];
    if (!competition) continue;
    const clubs = competition.groups.flatMap((group) => group.teamIds).map((clubId) => getClub(state, clubId)).filter(Boolean)
      .sort((a, b) => calculateTeamStrength(state, b.id, false) - calculateTeamStrength(state, a.id, false)).slice(0, 4);
    state.current.news.unshift({
      id: `news-${state.season}-favorites-${id}`,
      week: 0,
      importance: id === 'UCL' ? 'feature' : 'major',
      category: 'Preseason Favorites',
      headline: `${clubs.map((club) => club.name).join(', ')} lead the ${competition.name} forecast`,
      body: 'The ranking combines squad stars, coach impact, club strength, reputation and recent continental pressure.'
    });
  }
  state.current.news = state.current.news.slice(0, 240);
}

function evolveWorld(state) {
  processPromotionRelegation(state);
  runCoachMarket(state);
  for (const club of state.clubs) {
    const leagueFinish = state.history.clubSeasons.find(
      (row) => row.season === state.season && row.clubId === club.id
    );
    if (leagueFinish) {
      const leagueSize = LEAGUE_DEFINITIONS.find((league) => league.id === club.leagueId)?.activeCount || 20;
      const performance = (leagueSize + 1 - leagueFinish.position) / leagueSize;
      club.baseStrength = clamp(
        Math.round(club.baseStrength * 0.9 + (61 + performance * 30) * 0.1 + randomInt(state, -1, 1)),
        58,
        95
      );
      club.reputation = clamp(club.reputation * 0.96 + club.strength * 0.04, 54, 97);
      club.fans = Math.max(35000, Math.round(club.fans * (0.985 + performance * 0.03)));
      const revenue = (7 + performance * 32 + club.reputation * 0.34) * (club.ownerMoneyMultiplier || 1);
      const operatingCost = club.wageBudget * 0.72 + Math.max(2, club.reputation * 0.05);
      club.finances = clamp(Math.round(club.finances + revenue - operatingCost), 3, 1800);
    }
    club.transferBudget = Math.max(2, Math.round(club.finances * (0.22 + random(state) * 0.13)));
  }

  for (const player of state.players) {
    if (player.status !== 'active') continue;
    player.contractYears = Math.max(0, (player.contractYears || 0) - 1);
    player.careerYear += 1;
    if (player.careerYear >= player.careerLength) {
      player.status = 'retired';
      player.clubId = null;
      continue;
    }
    const multiplier = player.careerMultipliers[player.careerYear] ?? 0.85;
    player.rating = clamp(Math.round(player.baseQuality * multiplier), 51, 100);
    player.marketValue = calculateMarketValue(state, player);
    player.happiness = clamp(player.happiness + randomInt(state, -9, 7), 18, 100);
    if (player.contractYears === 0) {
      const club = player.clubId ? getClub(state, player.clubId) : null;
      const renewalChance = club
        ? clamp(0.58 + player.happiness / 250 + (club.reputation - 68) / 260 - Math.max(0, player.rating - club.strength) / 180, 0.42, 0.92)
        : 0;
      if (club && random(state) < renewalChance) {
        player.contractYears = randomInt(state, 1, 4);
        player.salary = Number((player.marketValue * (0.05 + random(state) * 0.024)).toFixed(1));
        player.happiness = clamp(player.happiness + randomInt(state, 2, 10), 30, 100);
      } else {
        player.clubId = null;
        player.salary = 0;
        player.happiness = Math.max(player.happiness, 58);
      }
    }
    player.fame = clamp(player.fame + randomInt(state, -1, 2), 5, 100);
  }
  generateReplacementStars(state);
  ensureClubRosters(state);
  invalidateRuntimeCache(state);
  refreshAllClubStrengths(state);
}

function askingPrice(state, player, buyer = null) {
  const happinessFactor = 0.52 + (player.happiness || 50) / 100;
  const contractFactor = 0.78 + Math.min(5, player.contractYears || 0) * 0.09;
  const discount = 1 - (buyer?.ownerNegotiationBonus || 0) * 0.34;
  return Number((player.marketValue * happinessFactor * contractFactor * discount).toFixed(1));
}

function positionNeed(state, club) {
  const players = state.players.filter((player) => player.clubId === club.id && player.status === 'active');
  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
  players.forEach((player) => { counts[player.position] += 1; });
  const ideal = club.tier === 'detailed'
    ? { GK: 1, DF: 2, MF: 2, FW: 2 }
    : { GK: 1, DF: 1, MF: 2, FW: 1 };
  return Object.keys(ideal).sort(
    (a, b) => (ideal[b] - counts[b]) - (ideal[a] - counts[a])
  )[0];
}

function transferPlayer(state, player, buyer, seller, fee, freeTransfer = false) {
  const oldClubId = player.clubId;
  invalidateRuntimeCache(state);
  if (seller) seller.finances += fee;
  buyer.finances = Math.max(0, buyer.finances - fee);
  buyer.transferBudget = Math.max(0, buyer.transferBudget - fee);
  player.clubId = buyer.id;
  player.contractYears = randomInt(state, 2, 5);
  player.salary = Number((player.marketValue * (0.055 + random(state) * 0.025)).toFixed(1));
  player.happiness = clamp(66 + Math.round((buyer.reputation - (seller?.reputation || 62)) * 0.7) + randomInt(state, -6, 10), 42, 100);
  player.transferListed = false;
  const record = {
    season: state.season,
    seasonLabel: formatSeason(state.season),
    playerId: player.id,
    fromClubId: oldClubId,
    toClubId: buyer.id,
    fee,
    freeTransfer
  };
  state.current.transfers.push(record);
  state.history.transfers.push(record);
  if (['generational', 'legend', 'epic'].includes(player.rarity)) {
    state.current.news.unshift({
      id: `news-${state.season}-transfer-${player.id}-${buyer.id}`,
      week: 0,
      importance: player.rarity === 'generational' ? 'feature' : 'major',
      category: 'Transfer Market',
      headline: `${player.name} signs for ${buyer.name}`,
      body: `${STAR_RARITIES[player.rarity].label} ${player.roleLabel.toLowerCase()} moves from ${seller?.name || 'free agency'} for ${freeTransfer ? 'no transfer fee' : `$${fee.toFixed(1)}m`}.`,
      entityType: 'player',
      entityId: player.id
    });
  }
}

function runTransferMarket(state, initial = false) {
  const clubs = shuffle(state, [...state.clubs]).sort((a, b) => b.reputation - a.reputation + (random(state) - 0.5) * 12);
  const activePlayers = state.players.filter((player) => player.status === 'active');
  const rosters = new Map();
  for (const club of state.clubs) rosters.set(club.id, []);
  activePlayers.forEach((player) => { if (player.clubId && rosters.has(player.clubId)) rosters.get(player.clubId).push(player); });
  const maxMoves = initial ? Math.min(260, Math.round(state.clubs.length * 0.18)) : Math.min(420, Math.round(state.clubs.length * 0.24));
  let moves = 0;
  for (const buyer of clubs) {
    if (moves >= maxMoves) break;
    if (buyer.division === 2 && random(state) < 0.56) continue;
    const roster = rosters.get(buyer.id) || [];
    const target = buyer.division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[buyer.tier];
    const needPosition = positionNeed(state, buyer);
    const weakest = roster.filter((player) => player.position === needPosition).sort((a, b) => a.rating - b.rating)[0];
    const minimumUpgrade = weakest?.rating || buyer.strength - 11;
    const candidatePool = activePlayers.filter((player) => {
      if (player.clubId === buyer.id || player.position !== needPosition) return false;
      if (player.rating < minimumUpgrade + (roster.length >= target ? 2 : -3)) return false;
      if (player.clubId) {
        const sellerClub = getClub(state, player.clubId);
        const sellerTarget = sellerClub?.division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[sellerClub?.tier];
        if ((rosters.get(player.clubId)?.length || 0) <= Math.max(3, (sellerTarget || 4) - 1)) return false;
      }
      const fee = player.clubId ? askingPrice(state, player, buyer) : 0;
      return fee <= buyer.transferBudget && player.salary <= Math.max(0.5, buyer.wageBudget * 0.48);
    });
    if (!candidatePool.length) continue;
    const player = weightedPick(state, candidatePool, (candidate) => {
      const seller = getClub(state, candidate.clubId);
      const ambition = buyer.reputation - (seller?.reputation || 60);
      const unhappiness = 105 - candidate.happiness;
      const rarity = STAR_RARITIES[candidate.rarity].rank;
      return Math.max(0.2, candidate.rating - minimumUpgrade + ambition * 0.18 + unhappiness * 0.06 + rarity * 0.8);
    });
    const seller = getClub(state, player.clubId);
    const fee = seller ? askingPrice(state, player, buyer) : 0;
    const negotiationBonus = (buyer.ownerNegotiationBonus || 0) * 0.42;
    const acceptance = clamp(
      0.46 + (buyer.reputation - (seller?.reputation || 60)) / 70 + (60 - player.happiness) / 100 + negotiationBonus,
      0.12,
      0.95
    );
    if (random(state) > acceptance) continue;
    const oldClubId = player.clubId;
    transferPlayer(state, player, buyer, seller, fee, !seller);
    if (oldClubId && rosters.has(oldClubId)) rosters.set(oldClubId, rosters.get(oldClubId).filter((item) => item.id !== player.id));
    rosters.get(buyer.id).push(player);
    moves += 1;
  }
  invalidateRuntimeCache(state);
  refreshAllClubStrengths(state);
}

function closeSeason(state) {
  calculateAwards(state);
  archiveSeason(state);
  const ballon = state.history.awards.find(
    (item) => item.season === state.season && item.name === "Ballon d'Or" && item.rank === 1
  );
  const internationalChampion = Object.values(state.current.internationalCompetitions || {})
    .find((competition) => competition.championId)?.championId || null;
  state.history.seasonReviews.push({
    season: state.season,
    seasonLabel: formatSeason(state.season),
    championsCupWinnerId: state.current.champions.championId,
    spainChampionId: sortTable(state.current.leagues.ESP1.table)[0]?.teamId,
    internationalChampionId: internationalChampion,
    ballonDorPlayerId: ballon?.playerId || null
  });

  state.current.archivedMatchCount = state.current.matches.length;
  state.current.matches = [];
  state.current.playerMatchLogs = {};
  state.current.news = [{
    id: `news-${state.season}-archive`,
    week: state.current.week,
    importance: 'feature',
    category: 'Season Review',
    headline: `${formatSeason(state.season)} has been archived`,
    body: `${state.current.archivedMatchCount} match records were consolidated into permanent player, club, award and trophy summaries.`
  }];
  state.current.completed = true;
}

export function startNextSeason(state) {
  if (!state.current.completed) return state;
  evolveWorld(state);
  state.season += 1;
  state.current = newCurrentSeason(state);
  runTransferMarket(state, false);
  addPreseasonMagazine(state);
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
  const international = [...seasons, ...current]
    .filter((row) => row.isInternational)
    .reduce((sum, row) => ({
      caps: sum.caps + row.apps,
      goals: sum.goals + row.goals,
      assists: sum.assists + row.assists
    }), { caps: 0, goals: 0, assists: 0 });
  return { seasons, awards, honours, current, logs, international };
}

export function getClubHistory(state, clubId) {
  return {
    seasons: state.history.clubSeasons.filter((row) => row.clubId === clubId),
    competitionSeasons: state.history.clubCompetitionSeasons.filter((row) => row.teamId === clubId),
    honours: state.history.champions.filter((row) => !row.isInternational && row.winnerId === clubId),
    currentPlayers: getClubLineup(state, clubId),
    allCurrentPlayers: state.players.filter((player) => player.clubId === clubId && player.status === 'active').sort((a, b) => b.rating - a.rating),
    currentMatches: state.current.matches.filter(
      (match) => !match.isInternational && (match.homeId === clubId || match.awayId === clubId)
    )
  };
}

export function getEntityName(state, id, isInternational = false) {
  return getTeamName(state, id, isInternational);
}

export function getCompetitionName(state, competitionId) {
  if (state.current.leagues[competitionId]) return state.current.leagues[competitionId].name;
  if (state.current.domesticCups?.[competitionId]) return state.current.domesticCups[competitionId].name;
  if (state.current.continentalCompetitions?.[competitionId]) return state.current.continentalCompetitions[competitionId].name;
  if (state.current.internationalCompetitions?.[competitionId]) return state.current.internationalCompetitions[competitionId].name;
  const map = {
    SUPERCUP: state.current.supercup.name,
    UCL: state.current.champions.name,
    GLOBAL: 'World Football',
    ...INTERNATIONAL_COMPETITION_NAMES
  };
  return map[competitionId] || competitionId;
}

export function getSeasonLabel(season) {
  return formatSeason(season);
}

export function getRarityCounts(state) {
  return rarityCounts(state);
}

export function getInternationalCompetition(state, id) {
  return state.current.internationalCompetitions?.[id] || null;
}

export function getPlayerTotals(state, playerId, scope = 'all') {
  const rows = [
    ...state.history.playerSeasons,
    ...Object.values(state.current.playerStats)
  ].filter((row) => row.playerId === playerId);
  const filtered = rows.filter((row) =>
    scope === 'all' || (scope === 'international' ? row.isInternational : !row.isInternational)
  );
  const totals = filtered.reduce((sum, row) => ({
    games: sum.games + (row.apps || 0),
    goals: sum.goals + (row.goals || 0),
    assists: sum.assists + (row.assists || 0),
    ratingWeighted: sum.ratingWeighted + (row.averageRating || 0) * (row.apps || 0)
  }), { games: 0, goals: 0, assists: 0, ratingWeighted: 0 });
  const titleRows = state.history.honours.filter((honour) => {
    if (honour.playerId !== playerId) return false;
    if (scope === 'international') return honour.isInternational;
    if (scope === 'club') return !honour.isInternational;
    return true;
  });
  return {
    ...totals,
    averageRating: totals.games ? totals.ratingWeighted / totals.games : 0,
    titles: titleRows.length
  };
}
