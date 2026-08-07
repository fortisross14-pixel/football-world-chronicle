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
  COACH_PROFILES,
  COACH_FOCUSES
} from './data.js';
import { REAL_WORLD_STARS } from './real-stars.js';

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

const COACH_CAREER_TYPES = {
  prodigy: { label: 'Prodigy', multipliers: [0.94, 0.99, 1.02, 1.02, 1.01, 0.99, 0.96, 0.93, 0.90, 0.89] },
  early_peak: { label: 'Early Peak', multipliers: [0.98, 1.02, 1.02, 1.00, 0.97, 0.94, 0.92, 0.90, 0.89] },
  steady_growth: { label: 'Steady Growth', multipliers: [0.90, 0.93, 0.96, 0.99, 1.01, 1.02, 1.02, 1.01, 0.99, 0.96, 0.93, 0.90] },
  late_bloomer: { label: 'Late Bloomer', multipliers: [0.89, 0.90, 0.92, 0.95, 0.98, 1.00, 1.02, 1.02, 1.01, 0.99, 0.96, 0.93, 0.90] },
  stable_prime: { label: 'Stable Prime', multipliers: [0.94, 0.97, 0.99, 1.00, 1.01, 1.01, 1.00, 0.99, 0.97, 0.95, 0.92, 0.90] },
  long_peak: { label: 'Long Peak', multipliers: [0.91, 0.95, 0.98, 1.00, 1.02, 1.02, 1.02, 1.01, 1.00, 0.98, 0.96, 0.93, 0.90, 0.89] },
  volatile: { label: 'Volatile', multipliers: [0.92, 1.00, 0.95, 1.02, 0.94, 1.01, 0.93, 0.99, 0.92, 0.96, 0.90, 0.89] },
  veteran_master: { label: 'Veteran Master', multipliers: [0.89, 0.91, 0.94, 0.97, 0.99, 1.00, 1.01, 1.02, 1.02, 1.01, 1.00, 0.98, 0.96, 0.94, 0.92, 0.90, 0.89] }
};

const SUPER_CUP_NAMES = {
  ESP1: 'Spanish Super Cup', ENG1: 'Community Shield', ITA1: 'Supercoppa Italiana',
  GER1: 'DFL-Supercup', FRA1: 'Trophée des Champions', POR1: 'Supertaça Cândido de Oliveira',
  NED1: 'Johan Cruyff Shield', TUR1: 'Turkish Super Cup', BRA1: 'Supercopa do Brasil',
  ARG1: 'Supercopa Argentina', MEX1: 'Campeón de Campeones', USA1: 'MLS Champions Cup',
  KSA1: 'Saudi Super Cup', JPN1: 'Japanese Super Cup', MAR1: 'Moroccan Super Cup', EGY1: 'Egyptian Super Cup'
};

const GLOBAL_CLUB_COMPETITIONS = {
  CWC: { id: 'CWC', name: 'FIFA Club World Cup', confederation: 'World', level: 0, global: true },
  ICUP: { id: 'ICUP', name: 'FIFA Intercontinental Cup', confederation: 'World', level: 0, global: true }
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
  const coachById = new Map((state.coaches || []).map((coach) => [coach.id, coach]));
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
    coachById,
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
  // Clubs develop mostly domestic players. Roughly one in ten academy or youth
  // entrants represents a migration, diaspora or family exception.
  if (preferred && eligible.includes(preferred) && random(state) < 0.9) return preferred.id;
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
  const value = calculateMarketValueRaw(baseQuality, rarity, age, actualPosition);
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
    debutSeason: state.season - initialCareerYear,
    fame: clamp(Math.round((baseQuality - 55) * 1.8 + randomInt(state, 0, 12)), 5, 100),
    status: 'active',
    isNationalSpecialist: nationalSpecialist,
    contractYears: club ? randomInt(state, 1, 5) : 0,
    salary: club ? Math.max(0.3, Number((value * (0.045 + random(state) * 0.03)).toFixed(1))) : 0,
    happiness: randomInt(state, 48, 92),
    marketValue: value,
    transferListed: false,
    spawnClubId: club?.id || null,
    transferProtectedUntilSeason: initialCareerYear === 0 ? state.season + 1 : null
  };
}


function roleTemplate(position, roleId) {
  return ROLE_DEFINITIONS[position]?.find((role) => role.id === roleId) || ROLE_DEFINITIONS[position]?.[0];
}

function availableRealWorldStars(state, rarity) {
  const used = new Set((state.players || []).map((player) => player.realWorldId).filter(Boolean));
  return REAL_WORLD_STARS.filter((star) => star.rarity === rarity && !used.has(star.id));
}

function activeRealWorldCount(state, rarity) {
  return (state.players || []).filter((player) => player.status === 'active' && player.rarity === rarity && player.realWorldId).length;
}

function shouldSpawnRealWorldStar(state, rarity) {
  if (!availableRealWorldStars(state, rarity).length) return false;
  const active = activeRealWorldCount(state, rarity);
  if (rarity === 'generational') {
    if (active === 0) return true;
    if (active >= 2) return false;
    return random(state) < 0.5;
  }
  if (rarity === 'legend') {
    if (active < 5) return true;
    if (active >= 7) return false;
    return random(state) < 0.5;
  }
  if (rarity === 'epic') {
    if (active < 9) return true;
    if (active >= 12) return false;
    return random(state) < 0.45;
  }
  return false;
}

function resolveRealWorldClub(state, clubs, template) {
  const byName = template.startClubName
    ? clubs.find((club) => club.name.localeCompare(template.startClubName, undefined, { sensitivity: 'base' }) === 0)
    : null;
  if (byName) return byName;
  const sameCountry = clubs.filter((club) => club.country === template.startCountry);
  if (sameCountry.length) return pick(state, sameCountry);
  const nationalityCountry = teamById(template.nationality)?.name;
  const nationalClubs = clubs.filter((club) => club.country === nationalityCountry);
  return nationalClubs.length ? pick(state, nationalClubs) : pick(state, clubs);
}

function createRealWorldPlayer(state, template, { club = null, careerYear = 0, debutSeason = state.season } = {}) {
  const type = CAREER_TYPES[template.careerType] ? template.careerType : 'stable_prime';
  const length = clamp(template.careerLength || 11, 8, 13);
  const curve = careerCurve(type, length);
  const initialCareerYear = clamp(careerYear, 0, length - 1);
  const role = roleTemplate(template.position, template.role);
  const baseQuality = clamp(template.baseQuality, STAR_RARITIES[template.rarity].min, STAR_RARITIES[template.rarity].max);
  const rating = clamp(Math.round(baseQuality * (curve[initialCareerYear] ?? 0.9)), 51, 100);
  const age = 18 + initialCareerYear;
  const value = calculateMarketValueRaw(baseQuality, template.rarity, age, template.position);
  const id = `real-${template.id}-${state.nextPlayerId}`;
  state.nextPlayerId += 1;
  state.usedNames ||= {};
  state.usedNames[template.nationality] ||= {};
  state.usedNames[template.nationality][template.name] = 1;
  return {
    id,
    name: template.name,
    clubId: club?.id || null,
    nationality: template.nationality,
    birthYear: debutSeason - age,
    position: template.position,
    role: role.id,
    roleLabel: role.label,
    rarity: template.rarity,
    baseQuality,
    rating,
    careerLengthType: length <= 9 ? 'short' : length <= 11 ? 'medium' : 'long',
    careerLength: length,
    careerType: type,
    careerMultipliers: curve,
    careerYear: initialCareerYear,
    debutSeason: debutSeason - initialCareerYear,
    fame: clamp(Math.round((baseQuality - 52) * 2.0 + randomInt(state, 4, 14)), 20, 100),
    status: 'active',
    isNationalSpecialist: false,
    contractYears: club ? randomInt(state, 2, 5) : 0,
    salary: club ? Math.max(0.3, Number((value * (0.045 + random(state) * 0.025)).toFixed(1))) : 0,
    happiness: randomInt(state, 62, 94),
    marketValue: value,
    transferListed: false,
    realWorld: true,
    realWorldId: template.id,
    realWorldStartingClub: template.startClubName,
    realWorldStartingCountry: template.startCountry,
    // Historical icons always complete their first visible season at their
    // curated starting club before becoming part of the normal transfer market.
    transferProtectedUntilSeason: debutSeason + 1
  };
}

function replaceInitialPlayerWithRealStar(state, players, clubs, placeholder, template) {
  const originalClub = clubs.find((club) => club.id === placeholder.clubId) || null;
  const target = resolveRealWorldClub(state, clubs, template) || originalClub;
  if (target && originalClub && target.id !== originalClub.id) {
    const displaced = players
      .filter((player) => player !== placeholder && player.clubId === target.id && !player.realWorldId)
      .sort((a, b) => STAR_RARITIES[a.rarity].rank - STAR_RARITIES[b.rarity].rank || a.rating - b.rating)[0];
    if (displaced) displaced.clubId = originalClub.id;
  }
  const real = createRealWorldPlayer(state, template, {
    club: target,
    careerYear: placeholder.careerYear,
    debutSeason: state.season
  });
  const index = players.indexOf(placeholder);
  if (index >= 0) players[index] = real;
  return real;
}

function applyInitialRealWorldStars(state, players, clubs) {
  const targets = {
    generational: randomInt(state, 1, 2),
    legend: randomInt(state, 5, 7),
    epic: randomInt(state, 9, 12)
  };
  const spawned = [];
  for (const rarity of ['generational', 'legend', 'epic']) {
    const templates = shuffle(state, REAL_WORLD_STARS.filter((star) => star.rarity === rarity)).slice(0, targets[rarity]);
    const placeholders = shuffle(state, players.filter((player) => player.rarity === rarity)).slice(0, templates.length);
    templates.forEach((template, index) => {
      if (placeholders[index]) spawned.push(replaceInitialPlayerWithRealStar(state, players, clubs, placeholders[index], template));
    });
  }
  return spawned;
}

function calculateMarketValueRaw(baseQuality, rarity, age, position = 'MF') {
  const rarityMultiplier = {
    generational: 2.45,
    legend: 1.85,
    epic: 1.45,
    rare: 0.9,
    uncommon: 0.4,
    common: 0.16
  }[rarity] || 0.16;
  const positionMultiplier = { GK: 0.38, DF: 0.82, MF: 0.96, FW: 1.05 }[position] || 1;
  const ageMultiplier = age <= 23 ? 1.15 : age <= 28 ? 1 : age <= 31 ? 0.78 : 0.48;
  const calculated = ((baseQuality - 52) ** 1.45) * rarityMultiplier * positionMultiplier * ageMultiplier / 2.6;
  const outfieldCaps = { generational: 235, legend: 175, epic: 125, rare: 85, uncommon: 42, common: 18 };
  const goalkeeperCaps = { generational: 112, legend: 88, epic: 68, rare: 48, uncommon: 28, common: 13 };
  const cap = position === 'GK' ? goalkeeperCaps[rarity] : outfieldCaps[rarity];
  return Number(Math.max(0.4, Math.min(calculated, cap || calculated)).toFixed(1));
}

function calculateMarketValue(state, player) {
  const age = state.season - player.birthYear;
  return calculateMarketValueRaw(player.baseQuality, player.rarity, age, player.position);
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

function chooseStaffRarity(state, nationality = null, type = 'coach') {
  const nation = NATIONAL_TEAMS.find((team) => team.id === nationality || COUNTRY_TO_CODE[team.name] === nationality);
  const tier = nation?.tier || 4;
  const entries = Object.entries(STAFF_RARITIES);
  return weightedPick(state, entries, ([key, data]) => {
    if (type !== 'coach') return data.weight;
    const eliteMultiplier = tier === 1
      ? { generational: 8, legend: 4.2, epic: 2.0 }[key] || 0.82
      : tier === 2
        ? { generational: 1.4, legend: 2.1, epic: 1.45 }[key] || 0.92
        : tier === 3
          ? { generational: 0.08, legend: 0.35, epic: 0.82 }[key] || 1.08
          : { generational: 0.01, legend: 0.08, epic: 0.42 }[key] || 1.16;
    return data.weight * eliteMultiplier;
  })[0];
}

function stableStringRoll(value = '') {
  let hash = 2166136261;
  for (let index = 0; index < String(value).length; index += 1) {
    hash ^= String(value).charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function coachFocusWeights(profile) {
  if (profile === 'tournament_expert') return { tournament: 0.76, balanced: 0.20, regularity: 0.04 };
  if (['possession', 'pressing', 'youth_developer'].includes(profile)) return { regularity: 0.58, balanced: 0.34, tournament: 0.08 };
  if (['counter_attack', 'adaptive', 'pragmatist'].includes(profile)) return { tournament: 0.34, balanced: 0.50, regularity: 0.16 };
  if (['defensive_rock', 'motivator'].includes(profile)) return { regularity: 0.32, balanced: 0.50, tournament: 0.18 };
  return { balanced: 0.48, regularity: 0.30, tournament: 0.22 };
}

function selectCoachFocusFromRoll(profile, roll) {
  const weights = coachFocusWeights(profile);
  let cumulative = 0;
  for (const focus of ['tournament', 'regularity', 'balanced']) {
    cumulative += weights[focus] || 0;
    if (roll <= cumulative) return focus;
  }
  return 'balanced';
}

function chooseCoachFocus(state, profile) {
  return selectCoachFocusFromRoll(profile, random(state));
}

function inferCoachFocus(coach) {
  if (COACH_FOCUSES[coach?.focus]) return coach.focus;
  return selectCoachFocusFromRoll(coach?.profile, stableStringRoll(coach?.id || coach?.name || 'coach'));
}

function coachCareerLength(state) {
  const roll = random(state);
  if (roll < 0.18) return randomInt(state, 8, 10);
  if (roll < 0.58) return randomInt(state, 11, 14);
  return randomInt(state, 15, 18);
}

function coachCareerType(state, profile = null) {
  const choices = Object.keys(COACH_CAREER_TYPES);
  if (profile === 'youth_developer') return weightedPick(state, choices, (key) => ['late_bloomer','steady_growth','veteran_master'].includes(key) ? 3 : 1);
  if (profile === 'tournament_expert') return weightedPick(state, choices, (key) => ['early_peak','volatile','stable_prime'].includes(key) ? 2.4 : 1);
  return pick(state, choices);
}

function coachCareerMultiplier(coach, careerYear = coach?.careerYear || 0) {
  const type = COACH_CAREER_TYPES[coach?.careerType] || COACH_CAREER_TYPES.stable_prime;
  const curve = type.multipliers;
  if (!curve.length) return 1;
  if (careerYear <= 0) return curve[0];
  if (careerYear >= (coach?.careerLength || curve.length) - 1) return curve[curve.length - 1];
  const normalized = careerYear / Math.max(1, (coach?.careerLength || curve.length) - 1);
  const index = normalized * (curve.length - 1);
  const low = Math.floor(index);
  const high = Math.min(curve.length - 1, Math.ceil(index));
  const blend = index - low;
  return curve[low] * (1 - blend) + curve[high] * blend;
}

function refreshCoachQuality(state, coach) {
  if (!coach || coach.status === 'retired') return;
  coach.baseQuality ||= coach.quality || 66;
  coach.careerType ||= Object.keys(COACH_CAREER_TYPES)[Math.floor(stableStringRoll(`${coach.id}-curve`) * Object.keys(COACH_CAREER_TYPES).length)] || 'stable_prime';
  coach.careerMultipliers = Array.from({ length: coach.careerLength || 10 }, (_, year) => Number(coachCareerMultiplier(coach, year).toFixed(3)));
  const multiplier = coach.careerMultipliers[Math.min(coach.careerMultipliers.length - 1, coach.careerYear || 0)] || coachCareerMultiplier(coach);
  coach.currentMultiplier = Number(multiplier.toFixed(3));
  coach.quality = clamp(Math.round(coach.baseQuality * multiplier), 58, 99);
  if (coach.clubId) {
    const club = getClub(state, coach.clubId);
    if (club) club.coachQuality = coach.quality;
  }
  if (coach.nationalTeamId) {
    const team = state.nationalTeams?.find((item) => item.id === coach.nationalTeamId);
    if (team) team.coachQuality = coach.quality;
  }
}

function createStaffMember(state, type, nationality, assignment = {}) {
  const rarity = assignment.rarity || chooseStaffRarity(state, nationality, type);
  const profiles = type === 'owner' ? OWNER_PROFILES : COACH_PROFILES;
  const profile = assignment.profile || pick(state, Object.keys(profiles));
  const qualityBase = { generational: 96, legend: 92, epic: 87, rare: 81, uncommon: 74, common: 66 }[rarity];
  const name = assignment.name || uniqueName(state, nationality || 'eng');
  const coachCareerLengthValue = type === 'coach' ? (assignment.careerLength || coachCareerLength(state)) : null;
  const coachCareerYear = type === 'coach'
    ? clamp(assignment.careerYear ?? randomInt(state, 0, Math.max(0, Math.min(10, coachCareerLengthValue - 3))), 0, coachCareerLengthValue - 1)
    : null;
  const staff = {
    id: `${type}-${slug(name)}-${state.nextStaffId++}`,
    type,
    name,
    nationality: nationality || 'eng',
    rarity,
    quality: clamp(assignment.quality ?? (qualityBase + randomInt(state, -2, 2)), 60, 99),
    profile,
    profileLabel: profiles[profile].label,
    focus: type === 'coach' ? (assignment.focus || chooseCoachFocus(state, profile)) : null,
    seasonsInRole: assignment.seasonsInRole ?? randomInt(state, 0, 7),
    yearsRemaining: type === 'owner' ? (assignment.yearsRemaining ?? ownerTermYears(state)) : null,
    appointmentSeason: assignment.appointmentSeason ?? state.season,
    performanceScore: assignment.performanceScore ?? 0,
    trophies: assignment.trophies ?? 0,
    status: type === 'coach' ? (assignment.status || 'active') : undefined,
    careerYear: coachCareerYear,
    careerLength: coachCareerLengthValue,
    careerType: type === 'coach' ? (assignment.careerType || coachCareerType(state, profile)) : undefined,
    baseQuality: type === 'coach' ? (assignment.baseQuality ?? assignment.quality ?? clamp(qualityBase + randomInt(state, -2, 2), 60, 99)) : undefined,
    debutSeason: type === 'coach' ? (assignment.debutSeason ?? (state.season - coachCareerYear)) : undefined,
    ...assignment
  };
  if (type === 'coach') {
    staff.baseQuality ||= staff.quality;
    staff.careerType ||= coachCareerType(state, profile);
    staff.careerMultipliers = Array.from({ length: staff.careerLength || 10 }, (_, year) => Number(coachCareerMultiplier(staff, year).toFixed(3)));
    staff.currentMultiplier = staff.careerMultipliers[Math.min(staff.careerMultipliers.length - 1, staff.careerYear || 0)] || 1;
    staff.quality = clamp(Math.round(staff.baseQuality * staff.currentMultiplier), 58, 99);
  }
  return staff;
}


function ownerTermYears(state) {
  const roll = random(state);
  if (roll < 0.12) return randomInt(state, 5, 7);
  if (roll < 0.36) return randomInt(state, 8, 11);
  if (roll < 0.72) return randomInt(state, 12, 16);
  return randomInt(state, 17, 22);
}

function applyOwnerToClub(state, owner, club, preserveFinances = true) {
  if (!owner || !club) return;
  owner.clubId = club.id;
  club.ownerId = owner.id;
  const ownerData = OWNER_PROFILES[owner.profile];
  const rarityImpact = STAFF_RARITIES[owner.rarity].impact;
  club.ownerProfile = owner.profile;
  club.ownerRarity = owner.rarity;
  club.ownerMoneyMultiplier = 1 + (ownerData.money - 1) * rarityImpact;
  club.ownerSportingBonus = (ownerData.sporting - 1) * rarityImpact * 4;
  club.ownerNegotiationBonus = Math.max(0, ownerData.negotiation - 1) * rarityImpact;
  club.ownerPatience = ownerData.patience;
  if (!preserveFinances) {
    club.finances = Math.max(3, Math.round(club.finances * club.ownerMoneyMultiplier));
    club.transferBudget = Math.max(1, Math.round(club.finances * 0.3));
  }
}

function processOwnerTurnover(state) {
  state.pendingSeasonNews ||= [];
  state.pendingOwnerChanges ||= [];
  for (const club of state.clubs) {
    const owner = state.owners.find((item) => item.id === club.ownerId);
    if (!owner) continue;
    owner.yearsRemaining = Math.max(0, Number(owner.yearsRemaining ?? ownerTermYears(state)) - 1);
    owner.seasonsInRole = (owner.seasonsInRole || 0) + 1;
    if (owner.yearsRemaining > 0) continue;
    owner.formerClubId = owner.clubId;
    owner.clubId = null;
    const nationality = COUNTRY_TO_CODE[club.country] || 'eng';
    const replacement = createStaffMember(state, 'owner', nationality, {
      clubId: club.id,
      yearsRemaining: ownerTermYears(state),
      appointmentSeason: state.season + 1,
      seasonsInRole: 0
    });
    state.owners.push(replacement);
    applyOwnerToClub(state, replacement, club, true);
    if ((club.reputation || 0) >= 80) {
      state.pendingOwnerChanges.push({
        season: state.season + 1,
        clubId: club.id,
        formerOwnerId: owner.id,
        ownerId: replacement.id
      });
    }
    state.pendingSeasonNews.push({
      id: `news-${state.season + 1}-owner-${club.id}`,
      week: 0,
      importance: ['generational', 'legend'].includes(replacement.rarity) || ['generational', 'legend'].includes(owner.rarity) ? 'major' : 'digest',
      category: 'Boardroom',
      headline: `${replacement.name} becomes president of ${club.name}`,
      body: `${STAFF_RARITIES[replacement.rarity].label} ${OWNER_PROFILES[replacement.profile].label.toLowerCase()} replaces ${owner.name} after ${owner.seasonsInRole || 1} seasons. The new presidency is scheduled for ${replacement.yearsRemaining} years.`
    });
  }
}

function rookieClubWeight(player, club, eliteDestination = false) {
  if (!club || club.division !== 1) return 0;
  const nationName = teamById(player.nationality)?.name;
  const domesticBonus = club.country === nationName ? 4.5 : 1;
  if (eliteDestination) {
    return Math.max(0.1, (club.reputation - 78) ** 1.5) * domesticBonus;
  }
  // Young stars can emerge at secondary leagues and modest clubs before earning a major move.
  const developmentBand = Math.max(1, 25 - Math.abs(club.reputation - 71));
  const minorLeagueBonus = club.tier === 'summary' ? 1.45 : 1;
  const elitePenalty = club.reputation >= 84 ? 0.06 : 1;
  const ownerRank = STAFF_RARITIES[club.ownerRarity]?.rank || 1;
  const academyBonus = club.ownerProfile === 'academy_patron' ? 1 + ownerRank * 0.16 : 1;
  const sportingBonus = 1 + Math.max(0, club.ownerSportingBonus || 0) * 0.035;
  return developmentBand * domesticBonus * minorLeagueBonus * elitePenalty * academyBonus * sportingBonus;
}

function chooseRookieDestination(state, clubs, player) {
  const eliteChance = player.rarity === 'generational' ? 0.28 : player.rarity === 'legend' ? 0.22 : 0.16;
  const eliteDestination = random(state) < eliteChance;
  const nationName = teamById(player.nationality)?.name;
  const topDivision = clubs.filter((club) => club.division === 1);
  const domestic = nationName ? topDivision.filter((club) => club.country === nationName) : [];
  const foreign = nationName ? topDivision.filter((club) => club.country !== nationName) : topDivision;
  // Ninety percent of procedural players begin inside their own domestic system.
  // The remaining ten percent cover diaspora, family migration and unusual academy paths.
  const homeSpawn = domestic.length > 0 && random(state) < 0.9;
  const geographicPool = homeSpawn ? domestic : (foreign.length ? foreign : domestic);
  const band = geographicPool.filter((club) => eliteDestination ? club.reputation >= 80 : club.reputation < 84);
  const candidates = band.length ? band : geographicPool;
  return weightedPick(state, candidates, (club) => rookieClubWeight(player, club, eliteDestination)) || pick(state, candidates) || null;
}

function swapPlayerIntoClub(state, players, player, target) {
  if (!target || player.clubId === target.id) return;
  const swap = players
    .filter((candidate) => candidate.clubId === target.id && candidate.id !== player.id)
    .sort((a, b) => {
      const positionPenaltyA = a.position === player.position ? -20 : 0;
      const positionPenaltyB = b.position === player.position ? -20 : 0;
      return (STAR_RARITIES[a.rarity].rank * 12 + a.rating + positionPenaltyA) - (STAR_RARITIES[b.rarity].rank * 12 + b.rating + positionPenaltyB);
    })[0];
  const oldClubId = player.clubId;
  player.clubId = target.id;
  if (swap) swap.clubId = oldClubId;
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
  applyInitialRealWorldStars(state, players, clubs);

  // Veterans of elite rarity normally begin at major clubs. Rookies can emerge almost
  // anywhere: a secondary league, a modest domestic side, or occasionally an elite academy.
  const eliteYoungPlayers = players.filter((player) => ['generational', 'legend', 'epic'].includes(player.rarity) && player.careerYear <= 2);
  for (const player of eliteYoungPlayers) {
    if (player.realWorldId) continue;
    const target = chooseRookieDestination(state, clubs, player);
    swapPlayerIntoClub(state, players, player, target);
  }
  state.pendingSeasonStars = eliteYoungPlayers
    .filter((player) => player.careerYear === 0)
    .map((player) => ({ playerId: player.id, clubId: player.clubId, rarity: player.rarity, season: state.season }));

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
    const owner = createStaffMember(state, 'owner', nationality, { clubId: club.id, yearsRemaining: ownerTermYears(state), appointmentSeason: state.season });
    owners.push(owner);
    applyOwnerToClub(state, owner, club, false);
  }
  const coachCount = Math.ceil((state.clubs.length + state.nationalTeams.length) * 1.14);
  const jobNationalities = shuffle(state, [
    ...state.clubs.map((club) => COUNTRY_TO_CODE[club.country] || 'eng'),
    ...state.nationalTeams.map((team) => team.id)
  ]);
  for (let index = 0; index < coachCount; index += 1) {
    coaches.push(createStaffMember(state, 'coach', jobNationalities[index % jobNationalities.length]));
  }

  // Federations choose first, preserving a strong domestic identity for elite nations.
  const available = [...coaches];
  const nationalAssignments = [...state.nationalTeams].sort((a, b) => b.strength - a.strength);
  for (const team of nationalAssignments) {
    let domestic = available.filter((coach) => coach.nationality === team.id);
    if (!domestic.length) {
      const generated = createStaffMember(state, 'coach', team.id);
      coaches.push(generated);
      available.push(generated);
      domestic = [generated];
    }
    const useDomestic = random(state) < nationalCoachDomesticPreference(team);
    const pool = useDomestic ? domestic : available;
    const coach = [...pool].sort((a, b) => {
      const aFit = a.quality + (a.nationality === team.id ? 7 + team.tier * -0.7 : 0);
      const bFit = b.quality + (b.nationality === team.id ? 7 + team.tier * -0.7 : 0);
      return bFit - aFit;
    })[0];
    available.splice(available.indexOf(coach), 1);
    assignCoachToNation(state, coach, team);
  }

  // Clubs retain a moderate domestic preference; elite clubs shop globally more often.
  const clubAssignments = [...state.clubs].sort((a, b) => b.reputation - a.reputation);
  for (const club of clubAssignments) {
    if (!available.length) break;
    const nationality = COUNTRY_TO_CODE[club.country] || null;
    const domestic = available.filter((coach) => coach.nationality === nationality);
    const useDomestic = domestic.length && random(state) < clubCoachDomesticPreference(club);
    const pool = useDomestic ? domestic : available;
    const coach = [...pool].sort((a, b) => b.quality - a.quality)[0];
    available.splice(available.indexOf(coach), 1);
    assignCoachToClub(state, coach, club);
  }
  state.owners = owners;
  state.coaches = coaches;
  state.targetActiveCoaches = coaches.length;
  state.coachRarityTargets = coaches.reduce((counts, coach) => {
    counts[coach.rarity] = (counts[coach.rarity] || 0) + 1;
    return counts;
  }, {});
  state.pendingSeasonCoaches = coaches
    .filter((coach) => coach.careerYear === 0 && ['generational', 'legend', 'epic'].includes(coach.rarity))
    .map((coach) => ({ coachId: coach.id, season: state.season }));
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

function previousChampion(state, competitionId) {
  return [...(state.history?.champions || [])].reverse().find((entry) => entry.competitionId === competitionId)?.winnerId || null;
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
  const superCups = {};
  for (const league of LEAGUE_DEFINITIONS.filter((item) => SUPER_CUP_NAMES[item.id])) {
    const clubs = state.clubs.filter((club) => club.leagueId === league.id && club.division === 1).sort((a, b) => b.strength - a.strength);
    const leagueWinner = previousChampion(state, league.id) || clubs[0]?.id;
    const cupWinner = previousChampion(state, `CUP-${league.id}`) || clubs.find((club) => club.id !== leagueWinner)?.id;
    let active = [leagueWinner, cupWinner].filter(Boolean);
    if (league.id === 'ESP1') {
      const priorRunnerUp = [...(state.history?.champions || [])].reverse().find((entry) => entry.competitionId === league.id)?.runnerUpId;
      const cupRunnerUp = [...(state.history?.champions || [])].reverse().find((entry) => entry.competitionId === `CUP-${league.id}`)?.runnerUpId;
      active = [...new Set([leagueWinner, cupWinner, priorRunnerUp, cupRunnerUp, ...clubs.map((club) => club.id)])].slice(0, 4);
    } else if (active.length < 2 || active[0] === active[1]) {
      active = [leagueWinner, clubs.find((club) => club.id !== leagueWinner)?.id].filter(Boolean);
    }
    const id = `SC-${league.id}`;
    superCups[id] = {
      id,
      leagueId: league.id,
      country: league.country,
      name: SUPER_CUP_NAMES[league.id],
      active,
      stage: active.length > 2 ? 'Semi-finals' : 'Final',
      championId: null,
      finalistId: null,
      rounds: []
    };
  }
  return { domesticCups, superCups, supercup: superCups['SC-ESP1'] };
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
  friendly = false,
  scheduled = false,
  groupWeeks = [],
  knockoutWeeks = [],
  editionYear = state.season
}) {
  const groupCount = ids.length ? Math.max(1, Math.ceil(ids.length / groupSize)) : 0;
  return {
    id,
    name: INTERNATIONAL_COMPETITION_NAMES[id] || id,
    kind,
    confederation,
    friendly,
    scheduled,
    editionYear,
    groupSize,
    groupWeeks,
    knockoutWeeks,
    stage: scheduled ? 'Scheduled' : friendly ? 'Friendlies' : kind === 'qualifier' ? 'Qualifying' : 'Group Stage',
    groups: groupCount ? buildGroups(state, ids, groupCount, false) : [],
    knockout: null,
    championId: null,
    finalistId: null,
    qualifiers,
    qualifiedIds: [],
    completed: false,
    recap: null
  };
}


function recentConfederationChampions(state, confederation, seasons = 4) {
  const premier = CONTINENTAL_DEFINITIONS.find((item) => item.confederation === confederation && item.level === 1);
  if (!premier) return [];
  return [...(state.history.champions || [])]
    .filter((entry) => entry.competitionId === premier.id && entry.season >= state.season - seasons)
    .sort((a, b) => b.season - a.season)
    .map((entry) => entry.winnerId)
    .filter(Boolean);
}

function clubWorldRanking(state, club) {
  const recent = (state.history.clubCompetitionSeasons || []).filter((row) => row.teamId === club.id && row.season >= state.season - 4);
  const weighted = recent.reduce((sum, row) => {
    const definition = CONTINENTAL_DEFINITIONS.find((item) => item.id === row.competitionId);
    const weight = definition?.level === 1 ? 3.2 : definition?.level === 2 ? 1.7 : 0.8;
    return sum + (row.wins || 0) * weight + (row.apps || 0) * 0.25 * weight;
  }, 0);
  const titles = (state.history.champions || []).filter((row) => row.winnerId === club.id && row.season >= state.season - 4 && CONTINENTAL_DEFINITIONS.some((item) => item.id === row.competitionId && item.level === 1)).length;
  return weighted + titles * 60 + (club.reputation || 60) * 1.5 + (club.strength || 60);
}

function selectClubWorldCupTeams(state) {
  const slots = { Europe: 12, 'South America': 6, Asia: 4, Africa: 4, 'North America': 4, Oceania: 1 };
  const selected = [];
  const selectedSet = new Set();
  for (const [confederation, count] of Object.entries(slots)) {
    const pool = state.clubs.filter((club) => club.confederation === confederation && club.division === 1);
    const champions = recentConfederationChampions(state, confederation, 4);
    const countryCounts = new Map();
    const add = (club, championPath = false) => {
      if (!club || selectedSet.has(club.id)) return false;
      const countryCount = countryCounts.get(club.country) || 0;
      if (!championPath && countryCount >= 2) return false;
      selected.push(club.id); selectedSet.add(club.id); countryCounts.set(club.country, countryCount + 1); return true;
    };
    champions.forEach((id) => add(pool.find((club) => club.id === id), true));
    [...pool].sort((a, b) => clubWorldRanking(state, b) - clubWorldRanking(state, a)).forEach((club) => {
      if (selected.filter((id) => getClub(state, id)?.confederation === confederation).length < count) add(club, false);
    });
  }
  const host = state.clubs.filter((club) => club.country === 'United States' && club.division === 1).sort((a, b) => clubWorldRanking(state, b) - clubWorldRanking(state, a))[0];
  if (host && !selectedSet.has(host.id)) selected.push(host.id);
  const fill = state.clubs.filter((club) => club.division === 1 && !selectedSet.has(club.id)).sort((a, b) => clubWorldRanking(state, b) - clubWorldRanking(state, a));
  while (selected.length < 32 && fill.length) selected.push(fill.shift().id);
  return selected.slice(0, 32);
}

function latestPremierContinentalWinner(state, confederation) {
  const definition = CONTINENTAL_DEFINITIONS.find((item) => item.confederation === confederation && item.level === 1);
  return definition ? previousChampion(state, definition.id) : null;
}

function initializeGlobalClubCompetitions(state) {
  const cycle = state.season % 4;
  if (cycle === 0) {
    const ids = selectClubWorldCupTeams(state);
    return {
      CWC: {
        ...GLOBAL_CLUB_COMPETITIONS.CWC,
        editionYear: state.season + 1,
        stage: 'Group Stage',
        groups: buildGroups(state, ids, 8, false),
        groupWeeks: [39, 40, 41],
        knockoutWeeks: [43, 45, 47, 49],
        knockout: null,
        championId: null,
        finalistId: null,
        completed: false,
        kind: 'finals'
      }
    };
  }
  const champions = {
    Europe: latestPremierContinentalWinner(state, 'Europe'),
    'South America': latestPremierContinentalWinner(state, 'South America'),
    Asia: latestPremierContinentalWinner(state, 'Asia'),
    Africa: latestPremierContinentalWinner(state, 'Africa'),
    'North America': latestPremierContinentalWinner(state, 'North America'),
    Oceania: latestPremierContinentalWinner(state, 'Oceania')
  };
  const fallback = (region) => state.clubs.filter((club) => club.confederation === region && club.division === 1).sort((a, b) => clubWorldRanking(state, b) - clubWorldRanking(state, a))[0]?.id;
  Object.keys(champions).forEach((region) => { champions[region] ||= fallback(region); });
  const ids = Object.values(champions).filter(Boolean);
  return {
    ICUP: {
      ...GLOBAL_CLUB_COMPETITIONS.ICUP,
      editionYear: state.season + 1,
      stage: 'Quarter-finals',
      active: ids,
      seeds: champions,
      rounds: [],
      championId: null,
      finalistId: null,
      completed: false,
      kind: 'knockout'
    }
  };
}

function initializeInternationalCompetitions(state) {
  const cycle = state.season % 4;
  const competitions = {};
  if (cycle === 1) {
    const ids = NATIONAL_TEAMS.map((team) => team.id);
    competitions.WCQ = makeInternationalCompetition(state, {
      id: 'WCQ', ids, groupSize: 7, kind: 'qualifier', confederation: 'World', qualifiers: 32,
      groupWeeks: [3, 8, 14, 20, 26, 32], editionYear: state.season + 1
    });
    competitions.WC = makeInternationalCompetition(state, {
      id: 'WC', ids: [], groupSize: 4, kind: 'finals', confederation: 'World', scheduled: true,
      groupWeeks: [44, 45, 46], knockoutWeeks: [47, 48, 49, 50], editionYear: state.season + 1
    });
  } else if (cycle === 2) {
    for (const region of ['Europe', 'Africa', 'Asia', 'North America', 'South America', 'Oceania']) {
      const ids = NATIONAL_TEAMS.filter((team) => team.region === region).map((team) => team.id);
      const target = INTERNATIONAL_FINAL_SIZES[region];
      const needsQualifier = ids.length > target;
      const id = regionalCompetitionId(region, needsQualifier);
      competitions[id] = makeInternationalCompetition(state, {
        id, ids, groupSize: 6, kind: needsQualifier ? 'qualifier' : 'friendly', confederation: region,
        qualifiers: needsQualifier ? target : ids.length, friendly: !needsQualifier,
        groupWeeks: [39, 41, 43, 45, 47, 49], editionYear: state.season + 1
      });
    }
  } else if (cycle === 3) {
    for (const region of ['Europe', 'Africa', 'Asia', 'North America', 'South America', 'Oceania']) {
      const id = regionalCompetitionId(region, false);
      let ids = state.internationalCycle.regionalQualified?.[region] || [];
      const target = INTERNATIONAL_FINAL_SIZES[region];
      if (ids.length < Math.min(target, NATIONAL_TEAMS.filter((team) => team.region === region).length)) {
        ids = strongestNationalTeams(NATIONAL_TEAMS.filter((team) => team.region === region).map((team) => team.id), target);
      }
      competitions[id] = makeInternationalCompetition(state, {
        id, ids, groupSize: ids.length <= 10 ? 5 : 4, kind: 'finals', confederation: region,
        groupWeeks: [44, 45, 46], knockoutWeeks: [47, 48, 49, 50], editionYear: state.season + 1
      });
    }
  } else {
    for (const region of ['Europe', 'Africa', 'Asia', 'North America', 'South America', 'Oceania']) {
      const ids = strongestNationalTeams(NATIONAL_TEAMS.filter((team) => team.region === region).map((team) => team.id), Math.min(8, INTERNATIONAL_FINAL_SIZES[region]));
      const id = `${region.replace(/\s+/g, '').toUpperCase()}F`;
      competitions[id] = makeInternationalCompetition(state, {
        id, ids, groupSize: 4, kind: 'friendly', confederation: region, friendly: true,
        groupWeeks: [12, 24, 36], editionYear: state.season + 1
      });
      competitions[id].name = `${region} Friendlies`;
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
  const globalClubCompetitions = initializeGlobalClubCompetitions(state);
  return {
    season: state.season,
    seasonLabel: formatSeason(state.season),
    week: 0,
    date: `${state.season}-08-01`,
    leagues,
    domesticCups: cups.domesticCups,
    copa: cups.domesticCups['CUP-ESP1'],
    superCups: cups.superCups,
    supercup: cups.supercup,
    continentalCompetitions,
    globalClubCompetitions,
    champions: continentalCompetitions.UCL,
    internationalCompetitions,
    international: Object.values(internationalCompetitions)[0] || null,
    playerStats: {},
    playerMatchLogs: {},
    coachStats: {},
    matches: [],
    transfers: [],
    staffMoves: [],
    newStars: [...(state.pendingSeasonStars || [])],
    newCoaches: [...(state.pendingSeasonCoaches || [])],
    retirements: [...(state.pendingSeasonRetirements || [])],
    ownerChanges: [...(state.pendingOwnerChanges || [])],
    news: [
      ...(state.pendingSeasonNews || []),
      {
        id: `news-${state.season}-launch`,
        week: 0,
        importance: 'feature',
        category: 'World',
        headline: `${formatSeason(state.season)} football world opens`,
        body: `${internationalCycleLabel(state.season)} joins 137 domestic systems, global club football, continental competitions and a new transfer window.`
      }
    ],
    completed: false
  };
}

export function createWorld(seed = Date.now() % 2147483647) {
  const state = {
    version: 4,
    dataRevision: 14,
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
    pendingSeasonStars: [],
    pendingSeasonCoaches: [],
    pendingSeasonRetirements: [],
    pendingOwnerChanges: [],
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
      coachCompetitionSeasons: [],
      coachSeasons: [],
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
  state.pendingSeasonStars = [];
  state.pendingSeasonCoaches = [];
  state.pendingSeasonRetirements = [];
  state.pendingOwnerChanges = [];
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
    return getRuntimeCache(state).coachById.get(team?.coachId) || state.coaches?.find((coach) => coach.id === team?.coachId) || null;
  }
  const club = getClub(state, teamId);
  return getRuntimeCache(state).coachById.get(club?.coachId) || state.coaches?.find((coach) => coach.id === club?.coachId) || null;
}

function nationalCoachDomesticPreference(team) {
  return ({ 1: 0.985, 2: 0.90, 3: 0.72, 4: 0.46 })[team?.tier] || 0.46;
}

function clubCoachDomesticPreference(club) {
  if ((club?.reputation || 0) >= 86) return 0.52;
  if ((club?.reputation || 0) >= 78) return 0.62;
  if ((club?.reputation || 0) >= 68) return 0.70;
  return 0.78;
}

function ensureCoachStat(state, coachId, competitionId, teamId, isInternational = false) {
  state.current.coachStats ||= {};
  const key = `${coachId}::${competitionId}::${teamId}`;
  if (!state.current.coachStats[key]) {
    state.current.coachStats[key] = {
      coachId,
      competitionId,
      teamId,
      isInternational,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      cleanSheets: 0,
      titles: 0
    };
  }
  return state.current.coachStats[key];
}

function recordCoachResult(state, coach, competitionId, teamId, isInternational, goalsFor, goalsAgainst, outcome) {
  if (!coach) return;
  const row = ensureCoachStat(state, coach.id, competitionId, teamId, isInternational);
  row.games += 1;
  row.gf += goalsFor;
  row.ga += goalsAgainst;
  if (goalsAgainst === 0) row.cleanSheets += 1;
  if (outcome === 'W') row.wins += 1;
  else if (outcome === 'L') row.losses += 1;
  else row.draws += 1;
}

function assignCoachToClub(state, coach, club) {
  coach.focus = inferCoachFocus(coach);
  coach.clubId = club.id;
  coach.nationalTeamId = null;
  coach.seasonsInRole = 0;
  club.coachId = coach.id;
  club.coachProfile = coach.profile;
  club.coachRarity = coach.rarity;
  club.coachQuality = coach.quality;
}

function assignCoachToNation(state, coach, team) {
  coach.focus = inferCoachFocus(coach);
  coach.nationalTeamId = team.id;
  coach.clubId = null;
  coach.seasonsInRole = 0;
  team.coachId = coach.id;
  team.coachProfile = coach.profile;
  team.coachRarity = coach.rarity;
  team.coachQuality = coach.quality;
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
    focus: entity?.coachId ? inferCoachFocus(getCoach(state, teamId, isInternational)) : 'balanced',
    attack: scale(profile.attack),
    defence: scale(profile.defence),
    midfield: scale(profile.midfield),
    development: scale(profile.development)
  };
}

function coachContextBonus(state, teamId, isInternational, competitionId, stage, knockout) {
  const coach = getCoach(state, teamId, isInternational);
  if (!coach) return 0;
  const focus = inferCoachFocus(coach);
  const isLeague = !isInternational && Boolean(state.current.leagues?.[competitionId]);
  const highStakes = knockout || /Round of 16|Quarter|Semi|Final/i.test(stage || '');
  const context = isLeague ? 'league' : highStakes ? 'knockout' : 'tournament';
  const coefficients = {
    tournament: { league: -0.75, tournament: 1.75, knockout: 3.45 },
    regularity: { league: 4.05, tournament: 0.72, knockout: 0.18 },
    balanced: { league: 1.55, tournament: 1.38, knockout: 1.62 }
  };
  const qualityScale = clamp(((coach.quality || 65) - 60) / 35, 0.12, 1.15);
  const rarityScale = 0.74 + Math.min(1.8, staffImpact(coach)) * 0.29;
  let bonus = (coefficients[focus]?.[context] ?? coefficients.balanced[context]) * qualityScale * rarityScale;
  if (coach.profile === 'tournament_expert' && context === 'knockout') bonus += 0.65 * qualityScale;
  if (['possession', 'pressing'].includes(coach.profile) && context === 'league') bonus += 0.38 * qualityScale;
  if (coach.profile === 'adaptive') bonus += 0.22 * qualityScale;
  return bonus;
}

function continentalDynastyPressure(state, teamId, competitionId) {
  const definition = CONTINENTAL_DEFINITIONS.find((item) => item.id === competitionId);
  if (!definition || definition.level !== 1) return 0;
  const titles = getRuntimeCache(state).recentContinentalTitles.get(teamId) || 0;
  return Math.min(1.35, titles * 0.34 + Math.max(0, titles - 1) * 0.18);
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
  const quality = clamp((player.rating - 54) / 46, 0.08, 1.05);
  const qualityMultiplier = 0.30 + quality ** 1.72 * 1.42;
  const rarityMultiplier = 1 + Math.max(0, (STAR_RARITIES[player.rarity]?.rank || 1) - 3) * 0.055;
  return base * roleData(player).goal * qualityMultiplier * rarityMultiplier;
}

function assistWeight(player) {
  const base = player.position === 'MF' ? 8 : player.position === 'FW' ? 5.2 : player.position === 'DF' ? 2.1 : 0.15;
  const quality = clamp((player.rating - 54) / 46, 0.08, 1.05);
  const qualityMultiplier = 0.34 + quality ** 1.55 * 1.26;
  return base * roleData(player).assist * qualityMultiplier;
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

function starImpactForLineup(lineup, unit = 'overall') {
  if (!lineup.length) return 0;
  const unitFactors = {
    overall: { GK: 0.78, DF: 0.88, MF: 1.0, FW: 1.05 },
    attack: { GK: 0.04, DF: 0.18, MF: 0.72, FW: 1.35 },
    midfield: { GK: 0.05, DF: 0.42, MF: 1.28, FW: 0.50 },
    defence: { GK: 1.28, DF: 1.08, MF: 0.34, FW: 0.08 }
  }[unit] || { GK: 1, DF: 1, MF: 1, FW: 1 };
  const impact = lineup.reduce((sum, player) => {
    const surplus = Math.max(0, player.rating - 79);
    if (!surplus) return sum;
    const rarityFactor = {
      generational: 1.22,
      legend: 1.12,
      epic: 1.02,
      rare: 0.86,
      uncommon: 0.68,
      common: 0.52
    }[player.rarity] || 0.7;
    return sum + surplus ** 1.17 * 0.105 * rarityFactor * (unitFactors[player.position] || 1);
  }, 0);
  return Math.min(unit === 'overall' ? 7.2 : 8.4, impact);
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
  const namedInfluence = isInternational ? Math.min(0.64, 0.27 + lineup.length * 0.052) : Math.min(0.52, 0.34 + lineup.length * 0.025);
  const form = isInternational
    ? getRuntimeCache(state).nationalById.get(teamId)?.form || 0
    : getClub(state, teamId)?.form || 0;
  const coachBonus = tactics.coach ? (tactics.coach.quality - 65) * 0.07 : 0;
  const ownerBonus = isInternational ? 0 : (getClub(state, teamId)?.ownerSportingBonus || 0);
  const starImpact = starImpactForLineup(lineup, 'overall');
  return base * (1 - namedInfluence) + weighted * namedInfluence + form + coachBonus + ownerBonus + starImpact;
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
  return base * 0.53 + average * 0.47 * multiplier + starImpactForLineup(lineup, unit);
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
    const chanceHome = clamp(0.5 + (homeStrength - awayStrength) / 70, 0.32, 0.68);
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

function tournamentFavoriteBonus(state, competitionId, teamId, isInternational) {
  const continentalDefinition = CONTINENTAL_DEFINITIONS.find((definition) => definition.id === competitionId);
  const isMajorContinental = continentalDefinition?.level === 1;
  const isMajorInternational = ['WC', 'EURO', 'COPA', 'AFCON', 'ASIACUP', 'GOLDCUP', 'OFC'].includes(competitionId);
  const isMajorGlobal = competitionId === 'CWC';
  if (!isMajorContinental && !isMajorInternational && !isMajorGlobal) return 0;
  const competition = isMajorGlobal
    ? state.current.globalClubCompetitions?.[competitionId]
    : isInternational
      ? state.current.internationalCompetitions?.[competitionId]
      : state.current.continentalCompetitions?.[competitionId];
  const ids = [...new Set((competition?.groups || []).flatMap((group) => group.teamIds || []))];
  if (!ids.length) return 0;
  if (!Array.isArray(competition.favoriteRanking) || competition.favoriteRanking.length !== ids.length || competition.favoriteRanking.some((id) => !ids.includes(id))) {
    competition.favoriteRanking = [...ids].sort((a, b) => calculateTeamStrength(state, b, isInternational) - calculateTeamStrength(state, a, isInternational));
  }
  const rank = competition.favoriteRanking.indexOf(teamId);
  // This represents depth, tournament experience and week-to-week consistency not
  // fully captured by the seven named stars. It is deliberately modest: favorites
  // still lose, but several unrelated long shots should not dominate one season.
  return rank === 0 ? 3.2 : rank === 1 ? 2.8 : rank === 2 ? 2.4 : rank === 3 ? 2.0 : rank === 4 ? 1.6 : rank < 10 && rank >= 0 ? 0.7 : 0;
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
  const homeFavoriteBonus = tournamentFavoriteBonus(state, competitionId, homeId, isInternational);
  const awayFavoriteBonus = tournamentFavoriteBonus(state, competitionId, awayId, isInternational);
  const homeCoachContext = coachContextBonus(state, homeId, isInternational, competitionId, stage, knockout);
  const awayCoachContext = coachContextBonus(state, awayId, isInternational, competitionId, stage, knockout);
  const homeDynastyPressure = isInternational ? 0 : continentalDynastyPressure(state, homeId, competitionId);
  const awayDynastyPressure = isInternational ? 0 : continentalDynastyPressure(state, awayId, competitionId);
  const homeStrength = calculateTeamStrength(state, homeId, isInternational) + homeFavoriteBonus + homeCoachContext - homeDynastyPressure + (neutral ? 0 : 2.0);
  const awayStrength = calculateTeamStrength(state, awayId, isInternational) + awayFavoriteBonus + awayCoachContext - awayDynastyPressure;
  const homeAttack = calculateUnitStrength(state, homeId, isInternational, 'attack') + homeFavoriteBonus * 0.72 + homeCoachContext * 0.56 - homeDynastyPressure * 0.45;
  const awayAttack = calculateUnitStrength(state, awayId, isInternational, 'attack') + awayFavoriteBonus * 0.72 + awayCoachContext * 0.56 - awayDynastyPressure * 0.45;
  const homeDefence = calculateUnitStrength(state, homeId, isInternational, 'defence') + homeFavoriteBonus * 0.72 + homeCoachContext * 0.56 - homeDynastyPressure * 0.45;
  const awayDefence = calculateUnitStrength(state, awayId, isInternational, 'defence') + awayFavoriteBonus * 0.72 + awayCoachContext * 0.56 - awayDynastyPressure * 0.45;
  const difference = homeStrength - awayStrength;
  // Quality gaps should matter across a full competition without making upsets impossible.
  // High-stakes knockout matches expose squad and coaching differences a little more;
  // finals remain one-off games, so dark horses can still finish the story.
  const highStakes = knockout || /Leg|Round of 16|Quarter|Semi|Final/i.test(stage || '');
  const attackDivisor = highStakes ? (isInternational ? 18.5 : 19.5) : 22;
  const defenceDivisor = highStakes ? (isInternational ? 19.5 : 20.5) : 23;
  const homeEdgeDivisor = highStakes ? (isInternational ? 33 : 37) : 44;
  const awayEdgeDivisor = highStakes ? (isInternational ? 37 : 42) : 50;
  const homeLambda = clamp(1.27 + (homeAttack - awayDefence) / attackDivisor + difference / homeEdgeDivisor, 0.16, 3.55);
  const awayLambda = clamp(1.01 + (awayAttack - homeDefence) / defenceDivisor - difference / awayEdgeDivisor, 0.13, 3.25);
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
      // Named stars represent only part of the full squad. Some goals belong to
      // anonymous squad players so a four-to-seven-star roster does not funnel
      // every team goal into the same few careers.
      const namedScorerChance = isInternational ? 0.82 : lineup.length >= 7 ? 0.72 : 0.58;
      const scorer = random(state) < namedScorerChance ? weightedPick(state, lineup, goalWeight) : null;
      if (scorer) addContribution(scorer.id, 'goals');
      let assister = null;
      if (scorer && random(state) < 0.7 && lineup.length > 1) {
        const options = lineup.filter((player) => player.id !== scorer.id);
        assister = weightedPick(state, options, assistWeight);
        addContribution(assister.id, 'assists');
      }
      goalEvents.push({
        teamId,
        opponentId,
        side,
        scorerId: scorer?.id || null,
        assistId: assister?.id || null,
        minute: randomInt(state, 4, resolution?.extraTime ? 118 : 90)
      });
    }
  };
  createGoals(homeId, awayId, homeGoals, homeLineup, 'home');
  createGoals(awayId, homeId, awayGoals, awayLineup, 'away');
  goalEvents.sort((a, b) => a.minute - b.minute);

  const winnerSide = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw';
  const matchRatings = new Map();
  const rateLineup = (lineup, teamId, side, goalsFor, goalsAgainst) => {
    lineup.forEach((player) => {
      const contribution = contributions.get(player.id) || { goals: 0, assists: 0 };
      let rating = 6.15 + random(state) * 0.9;
      // Goals and assists matter, but do not define the whole performance. A brace
      // can rescue a mediocre display without automatically producing a 9+ rating.
      rating += contribution.goals * 0.28 + contribution.assists * 0.24;
      rating += (player.rating - 70) / 82;
      rating += { GK: -0.08, DF: -0.03, MF: 0.08, FW: 0.05 }[player.position] || 0;
      if (winnerSide === side || resolution?.winnerId === teamId) rating += 0.26;
      if (winnerSide !== 'draw' && winnerSide !== side && !resolution) rating -= 0.22;
      if (player.position === 'GK') {
        if (goalsAgainst === 0) rating += 0.25 * roleData(player).defence;
        else rating -= Math.max(0, goalsAgainst - 1) * 0.13;
      }
      if (player.position === 'DF') {
        if (goalsAgainst === 0) rating += 0.15 * roleData(player).defence;
        else rating -= Math.max(0, goalsAgainst - 1) * 0.055;
      }
      rating = clamp(rating, 5.1, 10);
      matchRatings.set(player.id, rating);
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
          score: (matchRatings.get(player.id) || 6.5) + contribution.goals * 0.55 + contribution.assists * 0.35 + random(state) * 0.35
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
    knockout,
    landmark: knockout && /Final|Semi-final/i.test(stage || '')
  };
  state.current.matches.push(match);
  if (table) updateTable(table, homeId, awayId, homeGoals, awayGoals);

  const homeCoach = getCoach(state, homeId, isInternational);
  const awayCoach = getCoach(state, awayId, isInternational);
  const homeOutcome = homeGoals > awayGoals ? 'W' : homeGoals < awayGoals ? 'L' : resolution?.winnerId === homeId ? 'W' : resolution?.winnerId === awayId ? 'L' : 'D';
  const awayOutcome = homeOutcome === 'W' ? 'L' : homeOutcome === 'L' ? 'W' : 'D';
  recordCoachResult(state, homeCoach, competitionId, homeId, isInternational, homeGoals, awayGoals, homeOutcome);
  recordCoachResult(state, awayCoach, competitionId, awayId, isInternational, awayGoals, homeGoals, awayOutcome);

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
  const scorerCounts = {};
  match.goalEvents.forEach((goal) => { if (goal.scorerId) scorerCounts[goal.scorerId] = (scorerCounts[goal.scorerId] || 0) + 1; });
  const stageWeight = /Final/i.test(match.stage || '') ? 30 : /Semi/i.test(match.stage || '') ? 22 : /Quarter/i.test(match.stage || '') ? 16 : /Round of 16/i.test(match.stage || '') ? 10 : 0;
  const competitionWeight = match.competitionId === 'WC' ? 34 : ['UCL', 'LIB', 'EURO', 'COPA'].includes(match.competitionId) ? 25 : ['UEL', 'AFCON', 'ASIACUP', 'GOLDCUP'].includes(match.competitionId) ? 16 : 7;
  const teamWeight = Math.max(homeStrength, awayStrength) - 65;
  const relevance = Math.round(competitionWeight + stageWeight + teamWeight + (match.homeGoals + match.awayGoals) * 2);
  const topScorer = Object.entries(scorerCounts).sort((a, b) => b[1] - a[1])[0];
  if (topScorer?.[1] >= 3) {
    const player = getPlayer(state, topScorer[0]);
    const advancing = match.knockout && match.winnerId === (match.goalEvents.find((goal) => goal.scorerId === player?.id)?.teamId);
    state.current.news.unshift({
      id: `news-${match.id}-performance`, week: match.week,
      importance: relevance >= 55 ? 'feature' : 'major', category: 'Player Performance', storyType: 'performance', relevance: relevance + topScorer[1] * 7,
      headline: `${player?.name || 'A star'} scores ${topScorer[1]} in ${match.competitionName}`,
      body: `${player?.name || 'The scorer'} struck ${topScorer[1]} goals for ${getTeamName(state, match.goalEvents.find((goal) => goal.scorerId === topScorer[0])?.teamId, match.isInternational)} against ${match.goalEvents.find((goal) => goal.scorerId === topScorer[0])?.teamId === match.homeId ? awayName : homeName} in the ${match.stage || 'competition'}, ${advancing ? 'helping the team progress to the next round' : `in a ${match.homeGoals}-${match.awayGoals} result`}.`,
      entityType: 'player', entityId: player?.id, matchId: match.id
    });
  }
  const favorite = homeStrength - awayStrength >= 10 ? match.homeId : awayStrength - homeStrength >= 10 ? match.awayId : null;
  if (favorite && match.winnerId && match.winnerId !== favorite) {
    state.current.news.unshift({
      id: `news-${match.id}-upset`, week: match.week, importance: relevance >= 48 ? 'major' : 'digest', category: 'Results', storyType: 'result', relevance: relevance + 12,
      headline: `${getTeamName(state, match.winnerId, match.isInternational)} stun ${getTeamName(state, favorite, match.isInternational)}`,
      body: `${homeName} ${match.homeGoals}-${match.awayGoals} ${awayName} in ${match.competitionName}${match.stage ? ` (${match.stage})` : ''}.`, matchId: match.id
    });
  } else if (stageWeight >= 16 || competitionWeight >= 25) {
    state.current.news.unshift({
      id: `news-${match.id}-result`, week: match.week, importance: relevance >= 58 ? 'major' : 'digest', category: 'Results', storyType: 'result', relevance,
      headline: `${homeName} ${match.homeGoals}-${match.awayGoals} ${awayName}`,
      body: `${match.competitionName}${match.stage ? ` · ${match.stage}` : ''}${match.penalties ? ` · ${match.penalties.home}-${match.penalties.away} on penalties` : ''}.`, matchId: match.id
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
  const elitePeak = Math.max(...lineup.map((player) => player.rating), 70);
  const namedShare = Math.min(0.78, (lineup.length >= 7 ? 0.70 : 0.56) + Math.max(0, elitePeak - 84) * 0.012);
  const namedGoals = Math.round(row.gf * namedShare);
  for (let index = 0; index < namedGoals; index += 1) goals[weightedPick(state, goalShares, (item) => item.weight).player.id] += 1;
  for (let index = 0; index < Math.round(namedGoals * 0.7); index += 1) assists[weightedPick(state, assistShares, (item) => item.weight).player.id] += 1;
  const finish = sortTable(league.table).findIndex((item) => item.teamId === row.teamId) + 1;
  lineup.forEach((player) => {
    const stat = ensurePlayerStat(state, player.id, league.id, row.teamId, false);
    const playerApps = Math.max(6, apps - randomInt(state, 0, 2));
    const averageRating = clamp(6.0 + (league.table.length + 1 - finish) * 0.075 + (player.rating - 65) / 42 + random(state) * 0.38, 5.8, 8.75);
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
      const homeStrength = calculateTeamStrength(state, homeId, false) + coachContextBonus(state, homeId, false, league.id, 'League season', false) + 1.6;
      const awayStrength = calculateTeamStrength(state, awayId, false) + coachContextBonus(state, awayId, false, league.id, 'League season', false);
      const homeGoals = poisson(state, clamp(1.2 + (homeStrength - awayStrength) / 23.5, 0.18, 3.35));
      const awayGoals = poisson(state, clamp(0.95 + (awayStrength - homeStrength) / 25.5, 0.14, 3.0));
      updateTable(league.table, homeId, awayId, homeGoals, awayGoals);
    }));
    league.table.forEach((row) => {
      row.cleanSheets = Math.max(0, Math.round((row.played - row.ga * 0.58) * 0.42));
      distributeSummaryPlayerStats(state, league, row);
      const coach = getCoach(state, row.teamId, false);
      if (coach) {
        const stat = ensureCoachStat(state, coach.id, league.id, row.teamId, false);
        stat.games += row.played || 0;
        stat.wins += row.wins || 0;
        stat.draws += row.draws || 0;
        stat.losses += row.losses || 0;
        stat.gf += row.gf || 0;
        stat.ga += row.ga || 0;
        stat.cleanSheets += row.cleanSheets || 0;
      }
    });
    const sorted = sortTable(league.table);
    league.championId = sorted[0]?.teamId || null;
    league.completed = true;
    const cup = state.current.domesticCups[`CUP-${league.id}`];
    if (cup && !cup.championId) {
      const clubs = sorted.map((row) => getClub(state, row.teamId)).filter(Boolean);
      const cupPower = (club) => Math.max(1, (calculateTeamStrength(state, club.id, false) + coachContextBonus(state, club.id, false, cup.id, 'Final', true)) ** 2.4);
      const winner = weightedPick(state, clubs, cupPower);
      const finalist = weightedPick(state, clubs.filter((club) => club.id !== winner?.id), cupPower);
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

function pairSeededTeams(state, qualifiers) {
  if (qualifiers.length < 4) return pairTeams(state, qualifiers.map((item) => item.teamId));
  const half = Math.floor(qualifiers.length / 2);
  const seeds = qualifiers.slice(0, half);
  const unseeded = shuffle(state, qualifiers.slice(half));
  const pairs = [];
  for (const seed of shuffle(state, seeds)) {
    let index = unseeded.findIndex((candidate) => candidate.groupId !== seed.groupId);
    if (index < 0) index = 0;
    const opponent = unseeded.splice(index, 1)[0];
    const ids = random(state) < 0.5 ? [seed.teamId, opponent?.teamId] : [opponent?.teamId, seed.teamId];
    pairs.push(ids);
  }
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

function simulateSuperCupCompetition(state, cup, week) {
  if (!cup || cup.championId || cup.active.length < 2) return;
  const stage = cup.active.length > 2 ? 'Semi-final' : 'Final';
  const pairs = pairTeams(state, cup.active);
  const winners = [];
  const matchIds = [];
  pairs.forEach(([homeId, awayId]) => {
    if (!awayId) { winners.push(homeId); return; }
    const match = simulateMatch(state, {
      homeId, awayId, competitionId: cup.id, competitionName: cup.name, week,
      stage, knockout: true, neutral: true
    });
    winners.push(match.winnerId); matchIds.push(match.id);
    if (stage === 'Final') cup.finalistId = match.winnerId === homeId ? awayId : homeId;
  });
  cup.rounds.push({ week, stage, matchIds });
  cup.active = winners;
  if (winners.length === 1) { cup.championId = winners[0]; cup.stage = 'Complete'; cup.completed = true; }
  else cup.stage = 'Final';
}

function simulateSuperCups(state, week) {
  Object.values(state.current.superCups || {}).forEach((cup) => simulateSuperCupCompetition(state, cup, week));
}

function simulateIntercontinentalCup(state, comp, week) {
  if (!comp || comp.completed) return;
  const seeds = comp.seeds || {};
  if (week === 40 && !comp.rounds.length) {
    const pairs = [[seeds.Asia, seeds.Oceania], [seeds.Africa, seeds['North America']]].filter((pair) => pair.every(Boolean));
    const winners = []; const matchIds = [];
    pairs.forEach(([homeId, awayId]) => { const match = simulateMatch(state,{homeId,awayId,competitionId:comp.id,competitionName:comp.name,week,stage:'Quarter-final',knockout:true,neutral:true}); winners.push(match.winnerId); matchIds.push(match.id); });
    comp.rounds.push({ week, stage:'Quarter-final', matchIds }); comp.quarterWinners = winners; comp.stage='Semi-finals';
  } else if (week === 43 && comp.rounds.length === 1) {
    const pairs = [[seeds.Europe, comp.quarterWinners?.[0]], [seeds['South America'], comp.quarterWinners?.[1]]].filter((pair)=>pair.every(Boolean));
    const winners=[]; const matchIds=[];
    pairs.forEach(([homeId,awayId])=>{const match=simulateMatch(state,{homeId,awayId,competitionId:comp.id,competitionName:comp.name,week,stage:'Semi-final',knockout:true,neutral:true});winners.push(match.winnerId);matchIds.push(match.id);});
    comp.rounds.push({week,stage:'Semi-final',matchIds});comp.finalists=winners;comp.stage='Final';
  } else if (week === 46 && comp.rounds.length === 2 && comp.finalists?.length === 2) {
    const [homeId,awayId]=comp.finalists; const match=simulateMatch(state,{homeId,awayId,competitionId:comp.id,competitionName:comp.name,week,stage:'Final',knockout:true,neutral:true});
    comp.championId=match.winnerId;comp.finalistId=match.winnerId===homeId?awayId:homeId;comp.rounds.push({week,stage:'Final',matchIds:[match.id]});comp.stage='Complete';comp.completed=true;
  }
}

function simulateGlobalClubKnockout(state, comp, week) {
  if (comp.championId || !comp.knockout?.active?.length) return;
  const active = comp.knockout.active;
  const stage = active.length === 16 ? 'Round of 16' : active.length === 8 ? 'Quarter-final' : active.length === 4 ? 'Semi-final' : 'Final';
  const pairs = comp.knockout.openingPairs?.length ? comp.knockout.openingPairs : pairTeams(state, active);
  comp.knockout.openingPairs = null;
  const winners = [];
  const matchIds = [];
  let finalMatch = null;
  pairs.forEach(([homeId, awayId]) => {
    if (!awayId) { winners.push(homeId); return; }
    const match = simulateMatch(state, { homeId, awayId, competitionId: comp.id, competitionName: comp.name, week, stage, knockout: true, neutral: true });
    winners.push(match.winnerId); matchIds.push(match.id);
    if (stage === 'Final') { finalMatch = match; comp.finalistId = match.winnerId === homeId ? awayId : homeId; }
  });
  comp.knockout.rounds.push({ stage, matchIds });
  comp.knockout.active = winners;
  if (winners.length === 1) {
    comp.championId = winners[0]; comp.stage = 'Complete'; comp.completed = true;
    const stats = statsForCompetition(state, comp.id);
    const topScorer = chooseBestPlayer(stats, (stat) => stat.goals * 100 + stat.assists + stat.averageRating);
    const mvp = chooseBestPlayer(stats, (stat) => competitionMvpScore(state, stat, comp.id));
    comp.recap = { finalMatchId: finalMatch?.id || null, mvpId: mvp?.playerId || null, topScorerId: topScorer?.playerId || null, topScorerGoals: topScorer?.goals || 0 };
    state.current.news.unshift({ id: `news-${state.season}-${comp.id}-champion`, week, importance: 'feature', category: 'Global Club Football', storyType: 'result', relevance: 94, headline: `${getClub(state, comp.championId)?.name || 'A club'} win ${comp.name}!`, body: `${getClub(state, comp.championId)?.name || 'The champions'} defeat ${getClub(state, comp.finalistId)?.name || 'the finalists'}${finalMatch ? ` ${finalMatch.homeGoals}-${finalMatch.awayGoals}` : ''} in the final.${mvp ? ` ${getPlayer(state, mvp.playerId)?.name} is player of the tournament.` : ''}` });
  } else {
    comp.knockout.round = winners.length === 8 ? 'Quarter-final' : winners.length === 4 ? 'Semi-final' : 'Final';
    comp.stage = comp.knockout.round === 'Quarter-final' ? 'Quarter-finals' : `${comp.knockout.round}s`;
  }
}

function simulateGlobalClubCalendar(state, week) {
  const cwc = state.current.globalClubCompetitions?.CWC;
  if (cwc) {
    const groupIndex = (cwc.groupWeeks || []).indexOf(week);
    if (groupIndex >= 0) {
      simulateGroupRound(state, cwc, cwc.id, cwc.name, week, groupIndex, false);
      if (week === cwc.groupWeeks[cwc.groupWeeks.length - 1]) prepareInternationalKnockout(state, cwc);
    }
    if ((cwc.knockoutWeeks || []).includes(week)) simulateGlobalClubKnockout(state, cwc, week);
  }
  const icup = state.current.globalClubCompetitions?.ICUP;
  if (icup && [40,43,46].includes(week)) simulateIntercontinentalCup(state, icup, week);
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
  const automatic = rankedGroups.flatMap((rows, groupIndex) => rows.slice(0, 2).map((row, index) => ({ ...row, groupId: comp.groups[groupIndex].id, groupPosition: index + 1 })));
  const automaticIds = new Set(automatic.map((row) => row.teamId));
  const additional = rankedGroups.flatMap((rows, groupIndex) => rows.slice(2).map((row, index) => ({ ...row, groupId: comp.groups[groupIndex].id, groupPosition: index + 3 }))).filter((row) => !automaticIds.has(row.teamId));
  const qualifiers = [...automatic, ...additional]
    .sort((a, b) => a.groupPosition - b.groupPosition || b.points - a.points || b.gd - a.gd || b.gf - a.gf)
    .slice(0, desired);
  comp.knockout = {
    round: qualifiers.length === 16 ? 'Round of 16' : qualifiers.length === 8 ? 'Quarter-final' : 'Semi-final',
    // Seed the stronger group-stage performers against the lower half. Later rounds
    // remain open draws, so surprises survive without favorites eliminating one
    // another unnecessarily in the first knockout round.
    ties: pairSeededTeams(state, qualifiers).map(([homeId, awayId]) => ({ homeId, awayId, firstLeg: null, secondLeg: null, winnerId: null })),
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
      stage: `${stage} · Leg ${leg}`,
      // Individual legs may finish level; extra time and penalties apply only
      // after the second-leg aggregate is tied.
      knockout: false
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
  comp.knockout.rounds.push({ stage: 'Final', matchIds: [match.id], ties: [{ homeId: tie.homeId, awayId: tie.awayId, finalMatchId: match.id, winnerId: match.winnerId }] });
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
  const desired = ['WC', 'CWC'].includes(comp.id) ? 16 : Math.min(8, 2 ** Math.floor(Math.log2(Math.max(2, comp.groups.length * 2))));
  const sortedGroups = comp.groups.map((group) => sortTable(group.table));
  const top = sortedGroups.flatMap((rows, groupIndex) => rows.slice(0, 2).map((row, index) => ({ ...row, groupId: comp.groups[groupIndex].id, groupPosition: index + 1 })));
  const qualifiers = top
    .sort((a, b) => a.groupPosition - b.groupPosition || b.points - a.points || b.gd - a.gd || b.gf - a.gf)
    .slice(0, desired);
  comp.knockout = {
    round: qualifiers.length === 16 ? 'Round of 16' : qualifiers.length === 8 ? 'Quarter-final' : 'Semi-final',
    active: qualifiers.map((row) => row.teamId),
    openingPairs: pairSeededTeams(state, qualifiers),
    rounds: []
  };
  comp.stage = comp.knockout.round === 'Round of 16' ? 'Round of 16' : `${comp.knockout.round}s`;
}

function simulateInternationalKnockout(state, comp, week) {
  if (comp.championId || !comp.knockout?.active?.length) return;
  const active = comp.knockout.active;
  const stage = active.length === 16 ? 'Round of 16' : active.length === 8 ? 'Quarter-final' : active.length === 4 ? 'Semi-final' : 'Final';
  const pairs = comp.knockout.openingPairs?.length ? comp.knockout.openingPairs : pairTeams(state, active);
  comp.knockout.openingPairs = null;
  const winners = [];
  const matchIds = [];
  let finalMatch = null;
  pairs.forEach(([homeId, awayId]) => {
    const match = simulateMatch(state, { homeId, awayId, competitionId: comp.id, competitionName: comp.name, week, stage, knockout: true, isInternational: true, neutral: true });
    winners.push(match.winnerId);
    matchIds.push(match.id);
    if (stage === 'Final') {
      finalMatch = match;
      comp.finalistId = match.winnerId === homeId ? awayId : homeId;
    }
  });
  comp.knockout.rounds.push({ stage, matchIds });
  comp.knockout.active = winners;
  if (winners.length === 1) {
    comp.championId = winners[0];
    comp.stage = 'Complete';
    comp.completed = true;
    const stats = statsForCompetition(state, comp.id);
    const topScorer = chooseBestPlayer(stats, (stat) => stat.goals * 100 + stat.assists + stat.averageRating);
    const mvp = chooseBestPlayer(stats, (stat) => competitionMvpScore(state, stat, comp.id));
    const goalkeeper = chooseBestPlayer(stats.filter((stat) => getPlayer(state, stat.playerId)?.position === 'GK'), (stat) => stat.averageRating * 30 + stat.cleanSheets * 3);
    const young = chooseBestPlayer(stats.filter((stat) => state.season + 1 - getPlayer(state, stat.playerId)?.birthYear <= 21), (stat) => stat.averageRating * 30 + stat.goals * 2 + stat.assists * 1.5 + (getPlayer(state, stat.playerId)?.baseQuality || 0) * 0.35);
    const previousTitles = state.history.champions.filter((row) => row.competitionId === comp.id && row.winnerId === comp.championId).length;
    comp.recap = { finalMatchId: finalMatch?.id || null, mvpId: mvp?.playerId || null, youngPlayerId: young?.playerId || null, goalkeeperId: goalkeeper?.playerId || null, topScorerId: topScorer?.playerId || null, topScorerGoals: topScorer?.goals || 0, titleNumber: previousTitles + 1 };
    const champion = getTeamName(state, comp.championId, true);
    const finalist = getTeamName(state, comp.finalistId, true);
    state.current.news.unshift({
      id: `news-${state.season}-${comp.id}-champion`, week, importance: 'feature', category: 'International Football', storyType: 'result', relevance: comp.id === 'WC' ? 100 : 86,
      headline: `${champion} win ${comp.name}!`,
      body: `Defeating ${finalist} ${finalMatch ? `${finalMatch.homeGoals}-${finalMatch.awayGoals}` : ''} in the final, ${champion} claim their ${previousTitles + 1}${previousTitles + 1 === 1 ? 'st' : previousTitles + 1 === 2 ? 'nd' : previousTitles + 1 === 3 ? 'rd' : 'th'} ${comp.name}. ${mvp ? `${getPlayer(state, mvp.playerId)?.name} is tournament MVP.` : ''} ${young ? `${getPlayer(state, young.playerId)?.name} is best young player.` : ''} ${goalkeeper ? `${getPlayer(state, goalkeeper.playerId)?.name} is best goalkeeper.` : ''} ${topScorer ? `${getPlayer(state, topScorer.playerId)?.name} finishes top scorer with ${topScorer.goals} goals.` : ''}`,
      competitionId: comp.id, matchId: finalMatch?.id || null
    });
  } else {
    comp.knockout.round = winners.length === 8 ? 'Quarter-final' : winners.length === 4 ? 'Semi-final' : 'Final';
    comp.stage = comp.knockout.round === 'Quarter-final' ? 'Quarter-finals' : `${comp.knockout.round}s`;
  }
}

function simulateInternationalCalendar(state, week) {
  const comps = Object.values(state.current.internationalCompetitions || {});
  for (const comp of comps) {
    if (comp.scheduled || comp.completed) continue;
    const groupIndex = (comp.groupWeeks || []).indexOf(week);
    if (groupIndex >= 0) {
      if (groupIndex < competitionGroupRoundCount(comp)) {
        simulateGroupRound(state, comp, comp.id, comp.name, week, groupIndex, true);
      }
      const lastScheduledGroupWeek = comp.groupWeeks[Math.min(comp.groupWeeks.length, competitionGroupRoundCount(comp)) - 1];
      if (week === lastScheduledGroupWeek) {
        if (comp.kind === 'qualifier' || comp.friendly) {
          finalizeQualifiers(state, comp);
          if (comp.id === 'WCQ') {
            const worldCup = state.current.internationalCompetitions.WC;
            const ids = comp.qualifiedIds.length >= 32
              ? comp.qualifiedIds.slice(0, 32)
              : strongestNationalTeams(NATIONAL_TEAMS.map((team) => team.id), 32);
            worldCup.groups = buildGroups(state, ids, 8, false);
            worldCup.scheduled = false;
            worldCup.stage = 'Group Stage';
          }
        } else {
          prepareInternationalKnockout(state, comp);
        }
      }
    }
    if ((comp.knockoutWeeks || []).includes(week)) simulateInternationalKnockout(state, comp, week);
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

  if (week === 1 || week === 2) simulateSuperCups(state, week);
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
  simulateGlobalClubCalendar(state, week);
  addWeeklyDigest(state, week, before);
  if (week >= 52) closeSeason(state);
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

function award(state, name, playerId, competitionId = null, rank = 1, category = null, details = null) {
  if (!playerId) return;
  state.history.awards.push({
    id: `award-${state.season}-${slug(name)}-${playerId}-${rank}`,
    season: state.season,
    seasonLabel: formatSeason(state.season),
    name,
    playerId,
    competitionId,
    rank,
    category,
    details
  });
}

function getCompetitionOutcome(state, competitionId) {
  if (state.current.leagues?.[competitionId]) {
    const rows = sortTable(state.current.leagues[competitionId].table || []);
    return { championId: rows[0]?.teamId || null, finalistId: rows[1]?.teamId || null };
  }
  if (state.current.domesticCups?.[competitionId]) {
    const comp = state.current.domesticCups[competitionId];
    return { championId: comp.championId || null, finalistId: comp.finalistId || null };
  }
  if (state.current.superCups?.[competitionId]) {
    const comp = state.current.superCups[competitionId];
    return { championId: comp.championId || null, finalistId: comp.finalistId || null };
  }
  const comp = state.current.globalClubCompetitions?.[competitionId] || state.current.continentalCompetitions?.[competitionId] || state.current.internationalCompetitions?.[competitionId];
  return { championId: comp?.championId || null, finalistId: comp?.finalistId || null };
}

function finalMatchRating(state, playerId, competitionId) {
  const logs = state.current.playerMatchLogs?.[playerId] || [];
  const finals = logs.filter((log) => log.competitionId === competitionId && String(log.stage || '').toLowerCase() === 'final');
  return finals.length ? Math.max(...finals.map((log) => log.rating || 0)) : 0;
}

function performanceValue(stat) {
  return Math.max(0, stat.averageRating - 6.0) * stat.apps;
}

function openAwardPositionWeight(position) {
  // Goalkeepers and defenders already receive position-specific recognition and
  // benefit from team clean sheets. A modest normalization prevents those shared
  // defensive events from overwhelming open MVP/Ballon d'Or races, while major
  // finals and titles can still produce a Buffon/Cannavaro-style winner.
  return { GK: 0.82, DF: 0.92, MF: 1.04, FW: 1.0 }[position] || 1;
}

function competitionMvpScore(state, stat, competitionId) {
  const player = getPlayer(state, stat.playerId);
  const outcome = getCompetitionOutcome(state, competitionId);
  const won = stat.teamId === outcome.championId;
  const finalist = stat.teamId === outcome.finalistId;
  const finalRating = finalMatchRating(state, stat.playerId, competitionId);
  const positional = player?.position === 'GK'
    ? stat.cleanSheets * 0.06
    : player?.position === 'DF'
      ? stat.cleanSheets * 0.05 + stat.assists * 0.06
      : player?.position === 'MF'
        ? stat.assists * 0.10 + stat.goals * 0.025
        : stat.assists * 0.04 + stat.goals * 0.015;
  const outcomeBonus = won ? 8.5 : finalist ? 3.5 : 0;
  const finalBonus = finalRating >= 8 ? (finalRating - 7.5) * (won ? 4.2 : 2.2) : 0;
  return performanceValue(stat) * 5.2 * openAwardPositionWeight(player?.position) + outcomeBonus + finalBonus + positional;
}

function calculateCompetitionAwards(state, competitionId, competitionName) {
  const stats = statsForCompetition(state, competitionId);
  if (!stats.length) return;
  const scorer = chooseBestPlayer(stats, (stat) => stat.goals * 100 + stat.assists + stat.averageRating / 10);
  const formula = (stat) => competitionMvpScore(state, stat, competitionId);
  const forward = chooseBestPlayer(stats.filter((stat) => getPlayer(state, stat.playerId)?.position === 'FW'), formula);
  const midfielder = chooseBestPlayer(stats.filter((stat) => getPlayer(state, stat.playerId)?.position === 'MF'), formula);
  const defender = chooseBestPlayer(stats.filter((stat) => getPlayer(state, stat.playerId)?.position === 'DF'), formula);
  const goalkeeper = chooseBestPlayer(stats.filter((stat) => getPlayer(state, stat.playerId)?.position === 'GK'), formula);
  const mvp = chooseBestPlayer(stats, formula);
  award(state, `${competitionName} Top Scorer`, scorer?.playerId, competitionId, 1, 'top_scorer');
  award(state, `${competitionName} Player of the Season`, mvp?.playerId, competitionId, 1, 'mvp');
  award(state, `${competitionName} Best Goalkeeper`, goalkeeper?.playerId, competitionId, 1, 'best_goalkeeper');
  award(state, `${competitionName} Best Defender`, defender?.playerId, competitionId, 1, 'best_defender');
  award(state, `${competitionName} Best Midfielder`, midfielder?.playerId, competitionId, 1, 'best_midfielder');
  award(state, `${competitionName} Best Forward`, forward?.playerId, competitionId, 1, 'best_forward');
}

function clubSeasonAchievementDepth(state, clubId) {
  if (!clubId) return 0;
  let depth = 0;
  for (const league of Object.values(state.current.leagues || {})) {
    const championId = league.championId || sortTable(league.table || [])[0]?.teamId;
    if (championId !== clubId) continue;
    depth += ['ESP1', 'ENG1', 'ITA1', 'GER1', 'FRA1'].includes(league.id) ? 1.15 : 0.82;
  }
  for (const cup of Object.values(state.current.domesticCups || {})) {
    if (cup.championId === clubId) depth += 0.62;
  }
  if (Object.values(state.current.superCups || {}).some((cup) => cup.championId === clubId)) depth += 0.22;
  if (Object.values(state.current.globalClubCompetitions || {}).some((competition) => competition.championId === clubId)) depth += 0.65;
  for (const competition of Object.values(state.current.continentalCompetitions || {})) {
    if (competition.championId !== clubId) continue;
    const definition = CONTINENTAL_DEFINITIONS.find((item) => item.id === competition.id);
    depth += definition?.level === 1 ? 1.42 : definition?.level === 2 ? 0.72 : 0.46;
  }
  return depth;
}

function ballonClubMultiplier(state, candidate, selected, depthByClub) {
  const clubId = candidate.primaryClubId;
  if (!clubId) return 1;
  const alreadySelected = selected.filter((item) => item.primaryClubId === clubId).length;
  if (!alreadySelected) return 1;
  const depth = depthByClub.get(clubId) ?? clubSeasonAchievementDepth(state, clubId);
  depthByClub.set(clubId, depth);
  const firstRepeat = depth >= 2.65 ? 0.92 : depth >= 1.95 ? 0.78 : depth >= 1.25 ? 0.57 : 0.46;
  if (alreadySelected === 1) return firstRepeat;
  return depth >= 2.65 ? 0.73 : depth >= 1.95 ? 0.52 : 0.31;
}

function diversifyBallonRanking(state, candidates) {
  const remaining = candidates.slice(0, 48);
  const selected = [];
  const depthByClub = new Map();
  while (remaining.length && selected.length < 12) {
    let bestIndex = 0;
    let bestAdjusted = -Infinity;
    remaining.forEach((candidate, index) => {
      const adjusted = candidate.score * ballonClubMultiplier(state, candidate, selected, depthByClub);
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIndex = index;
      }
    });
    const [winner] = remaining.splice(bestIndex, 1);
    selected.push({
      ...winner,
      selectionScore: bestAdjusted,
      components: {
        ...winner.components,
        rawScore: Number(winner.score.toFixed(2)),
        teamDiversityScore: Number(bestAdjusted.toFixed(2))
      }
    });
  }
  const selectedIds = new Set(selected.map((candidate) => candidate.playerId));
  return [...selected, ...candidates.filter((candidate) => !selectedIds.has(candidate.playerId))];
}


function buildAnnualAwardRace(state) {
  const eliteLeagueIds = new Set(['ESP1', 'ENG1', 'ITA1', 'GER1', 'FRA1']);
  const strongLeagueIds = new Set(['POR1', 'NED1', 'BRA1', 'ARG1', 'BEL1', 'TUR1']);
  const continentalWeights = { UCL: 2.45, UEL: 1.48, UECL: 1.05, LIB: 2.0, SUD: 1.2, CCC: 1.02, ACL: 0.96, AFC2: 0.68, CAFCL: 0.94, CAFCC: 0.66, OCL: 0.5 };
  const weight = (competitionId, isInternational) => {
    if (isInternational) {
      if (competitionId === 'WC') return 2.85;
      if (['EURO', 'COPA'].includes(competitionId)) return 2.25;
      if (['AFCON', 'ASIACUP', 'GOLDCUP'].includes(competitionId)) return 1.65;
      if (competitionId === 'OFC') return 1.0;
      return 0.68;
    }
    if (continentalWeights[competitionId]) return continentalWeights[competitionId];
    if (eliteLeagueIds.has(competitionId)) return 2.0;
    if (strongLeagueIds.has(competitionId)) return 1.5;
    const league = LEAGUE_DEFINITIONS.find((definition) => definition.id === competitionId);
    return league?.tier === 'detailed' ? 1.25 : 1.0;
  };
  const byPlayer = new Map();
  const annualStats = Object.values(state.current.playerStats || {}).length
    ? Object.values(state.current.playerStats)
    : (state.current.archivedPlayerStats || []);
  for (const stat of annualStats) {
    if (!stat.apps) continue;
    const item = byPlayer.get(stat.playerId) || { playerId: stat.playerId, apps: 0, goals: 0, assists: 0, ratingWeighted: 0, weightedGoals: 0, weightedAssists: 0, leagueGoals: 0, leagueWeightedGoals: 0, competitionScore: 0, eliteApps: 0, clubApps: {} };
    const w = weight(stat.competitionId, stat.isInternational);
    item.apps += stat.apps;
    item.goals += stat.goals;
    item.assists += stat.assists;
    item.ratingWeighted += stat.averageRating * stat.apps;
    item.weightedGoals += stat.goals * w;
    item.weightedAssists += stat.assists * Math.min(2.2, w);
    const domesticLeague = !stat.isInternational && LEAGUE_DEFINITIONS.some((definition) => definition.id === stat.competitionId);
    if (domesticLeague) {
      item.leagueGoals += stat.goals;
      item.leagueWeightedGoals += stat.goals * w;
    }
    if (!stat.isInternational && stat.teamId) item.clubApps[stat.teamId] = (item.clubApps[stat.teamId] || 0) + stat.apps;
    item.competitionScore += Math.max(0, stat.averageRating - 6.0) * stat.apps * w;
    item.competitionScore += (stat.goals * 0.11 + stat.assists * 0.10 + stat.cleanSheets * 0.035) * w;
    if (w >= 1.5) item.eliteApps += stat.apps;
    byPlayer.set(stat.playerId, item);
  }
  const trophyBonus = new Map();
  const champions = [
    ...Object.values(state.current.continentalCompetitions || {}).filter((comp) => comp.championId).map((comp) => ({ id: comp.id, winnerId: comp.championId, international: false })),
    ...Object.values(state.current.internationalCompetitions || {}).filter((comp) => comp.championId).map((comp) => ({ id: comp.id, winnerId: comp.championId, international: true }))
  ];
  for (const trophy of champions) {
    const lineup = trophy.international ? getNationalLineup(state, trophy.winnerId) : getClubLineup(state, trophy.winnerId);
    const bonus = weight(trophy.id, trophy.international) * 15;
    lineup.forEach((player) => trophyBonus.set(player.id, (trophyBonus.get(player.id) || 0) + bonus));
  }
  const candidates = [...byPlayer.values()].map((item) => {
    const player = getPlayer(state, item.playerId);
    const average = item.apps ? item.ratingWeighted / item.apps : 0;
    const trophies = trophyBonus.get(item.playerId) || 0;
    const finalImpact = (state.current.playerMatchLogs?.[item.playerId] || [])
      .filter((log) => String(log.stage || '').toLowerCase() === 'final')
      .reduce((sum, log) => sum + Math.max(0, (log.rating || 0) - 7.0) * (log.isInternational ? 4.5 : 3.2), 0);
    const score = item.competitionScore * openAwardPositionWeight(player?.position) + trophies + finalImpact + average * 0.9 + Math.min(3, item.eliteApps * 0.03) + (player?.fame || 0) * 0.025;
    const components = { apps: item.apps, goals: item.goals, assists: item.assists, weightedGoals: Number(item.weightedGoals.toFixed(2)), averageRating: Number(average.toFixed(2)), performanceScore: Number(item.competitionScore.toFixed(1)), trophyBonus: Number(trophies.toFixed(1)), finalImpact: Number(finalImpact.toFixed(1)), score: Number(score.toFixed(2)) };
    const primaryClubId = Object.entries(item.clubApps || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || player?.clubId || null;
    return { ...item, primaryClubId, average, score, components, age: state.season + 1 - (player?.birthYear || state.season) };
  }).filter((candidate) => candidate.apps >= 5).sort((a, b) => b.score - a.score);
  const goldenBoot = candidates
    .filter((candidate) => candidate.leagueGoals > 0)
    .map((candidate) => ({
      ...candidate,
      score: candidate.leagueWeightedGoals,
      components: {
        ...candidate.components,
        goals: candidate.leagueGoals,
        weightedGoals: Number(candidate.leagueWeightedGoals.toFixed(2)),
        score: Number(candidate.leagueWeightedGoals.toFixed(2))
      }
    }))
    .sort((a, b) => b.leagueWeightedGoals - a.leagueWeightedGoals || b.leagueGoals - a.leagueGoals || b.average - a.average);
  const kopa = candidates.filter((candidate) => candidate.age <= 21).map((candidate) => {
    const player = getPlayer(state, candidate.playerId);
    const score = candidate.score + (player?.baseQuality || 60) * 0.55 + Math.max(0, (player?.careerLength || 10) - (player?.careerYear || 0)) * 0.4;
    return { ...candidate, score, components: { ...candidate.components, potentialBonus: Number(((player?.baseQuality || 60) * 0.55).toFixed(1)), score: Number(score.toFixed(2)) } };
  }).sort((a, b) => b.score - a.score);
  return { ballonDor: diversifyBallonRanking(state, candidates), goldenBoot, kopa };
}

function calculateAwards(state) {
  for (const league of Object.values(state.current.leagues)) calculateCompetitionAwards(state, league.id, league.name);
  for (const cup of Object.values(state.current.domesticCups)) calculateCompetitionAwards(state, cup.id, cup.name);
  for (const superCup of Object.values(state.current.superCups || {})) calculateCompetitionAwards(state, superCup.id, superCup.name);
  for (const globalCompetition of Object.values(state.current.globalClubCompetitions || {})) calculateCompetitionAwards(state, globalCompetition.id, globalCompetition.name);
  for (const competition of Object.values(state.current.continentalCompetitions || {})) calculateCompetitionAwards(state, competition.id, competition.name);
  for (const competition of Object.values(state.current.internationalCompetitions || {})) calculateCompetitionAwards(state, competition.id, competition.name);

  const race = buildAnnualAwardRace(state);
  race.goldenBoot.slice(0, 3).forEach((candidate, index) => award(state, 'World Golden Boot', candidate.playerId, 'GLOBAL', index + 1, 'golden_boot', candidate.components));
  race.ballonDor.slice(0, 3).forEach((candidate, index) => award(state, "Ballon d'Or", candidate.playerId, 'GLOBAL', index + 1, 'ballon_dor', candidate.components));
  race.kopa.slice(0, 3).forEach((candidate, index) => award(state, 'Kopa Trophy', candidate.playerId, 'GLOBAL', index + 1, 'kopa', candidate.components));
  const ballonWinnerId = race.ballonDor[0]?.playerId;
  for (const position of ['GK', 'DF', 'MF', 'FW']) {
    const winner = race.ballonDor.find((candidate) => candidate.playerId !== ballonWinnerId && getPlayer(state, candidate.playerId)?.position === position);
    award(state, `World Best ${position}`, winner?.playerId, 'GLOBAL', 1, `best_${position.toLowerCase()}`, winner?.components || null);
  }
  const positionalBest = ['GK', 'DF', 'MF', 'FW'].flatMap((position) => race.ballonDor.filter((candidate) => getPlayer(state, candidate.playerId)?.position === position).slice(0, position === 'DF' || position === 'MF' ? 3 : 2));
  positionalBest.slice(0, 11).forEach((candidate) => award(state, 'World Best XI', candidate.playerId, 'GLOBAL', 1, 'world_best_xi', candidate.components));
}

function registerChampion(state, competitionId, competitionName, winnerId, runnerUpId = null, isInternational = false) {
  if (!winnerId) return;
  const coach = getCoach(state, winnerId, isInternational);
  state.history.champions.push({
    season: state.season,
    seasonLabel: formatSeason(state.season),
    competitionId,
    competitionName,
    winnerId,
    runnerUpId,
    isInternational,
    coachId: coach?.id || null
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
  if (coach) {
    coach.trophies = (coach.trophies || 0) + 1;
    const stat = ensureCoachStat(state, coach.id, competitionId, winnerId, isInternational);
    stat.titles += 1;
  }
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

function archiveCoachSummaries(state) {
  state.history.coachCompetitionSeasons ||= [];
  state.history.coachSeasons ||= [];
  const competitionRows = Object.values(state.current.coachStats || {})
    .filter((row) => row.games || row.titles)
    .map((row) => ({
      season: state.season,
      seasonLabel: formatSeason(state.season),
      ...row
    }));
  state.history.coachCompetitionSeasons.push(...competitionRows);

  const byJob = new Map();
  for (const row of competitionRows) {
    const key = `${row.coachId}::${row.teamId}::${row.isInternational ? 1 : 0}`;
    const item = byJob.get(key) || {
      season: state.season,
      seasonLabel: formatSeason(state.season),
      coachId: row.coachId,
      teamId: row.teamId,
      isInternational: row.isInternational,
      games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cleanSheets: 0, titles: 0
    };
    item.games += row.games || 0;
    item.wins += row.wins || 0;
    item.draws += row.draws || 0;
    item.losses += row.losses || 0;
    item.gf += row.gf || 0;
    item.ga += row.ga || 0;
    item.cleanSheets += row.cleanSheets || 0;
    item.titles += row.titles || 0;
    byJob.set(key, item);
  }
  state.history.coachSeasons.push(...byJob.values());
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
  for (const superCup of Object.values(state.current.superCups || {})) registerChampion(state, superCup.id, superCup.name, superCup.championId, superCup.finalistId);
  for (const competition of Object.values(state.current.continentalCompetitions || {})) {
    registerChampion(state, competition.id, competition.name, competition.championId, competition.finalistId);
  }
  for (const competition of Object.values(state.current.globalClubCompetitions || {})) {
    registerChampion(state, competition.id, competition.name, competition.championId, competition.finalistId);
  }
  for (const comp of Object.values(state.current.internationalCompetitions || {})) {
    if (comp.championId) registerChampion(state, comp.id, comp.name, comp.championId, comp.finalistId, true);
  }
  archiveCoachSummaries(state);
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
  const activePlayers = state.players.filter((player) => player.status === 'active');
  const populationNeed = Math.max(0, state.targetActivePlayers - activePlayers.length);
  const counts = rarityCounts(state);
  state.pendingSeasonStars ||= [];

  // Each preseason introduces a small visible rookie class while respecting the
  // simultaneous rarity ceilings. Generational talent only appears when one of the
  // three slots opens; Legends can rise to 15 and Epics gradually refill toward 50.
  const eliteIntake = [];
  while ((counts.generational || 0) + eliteIntake.filter((rarity) => rarity === 'generational').length < 3) eliteIntake.push('generational');
  while ((counts.legend || 0) + eliteIntake.filter((rarity) => rarity === 'legend').length < 15) eliteIntake.push('legend');
  const epicRoom = Math.max(0, 50 - (counts.epic || 0));
  eliteIntake.push(...Array(Math.min(epicRoom, randomInt(state, 2, 4))).fill('epic'));
  const totalNew = Math.max(populationNeed, eliteIntake.length);

  for (let i = 0; i < totalNew; i += 1) {
    const rarity = eliteIntake[i] || chooseNewRarity(state, counts, totalNew - i);
    const realTemplate = ['generational', 'legend', 'epic'].includes(rarity) && shouldSpawnRealWorldStar(state, rarity)
      ? pick(state, availableRealWorldStars(state, rarity))
      : null;
    const player = realTemplate
      ? createRealWorldPlayer(state, realTemplate, { careerYear: 0, debutSeason: state.season + 1 })
      : createPlayer(state, { rarity, careerYear: 0, nationalSpecialist: true });
    player.birthYear = state.season + 1 - 18;
    player.debutSeason = state.season + 1;
    player.happiness = randomInt(state, 64, 92);
    const target = realTemplate
      ? resolveRealWorldClub(state, state.clubs, realTemplate)
      : chooseRookieDestination(state, state.clubs, player);
    if (target) {
      player.clubId = target.id;
      player.spawnClubId = target.id;
      player.transferProtectedUntilSeason = state.season + 2;
      player.contractYears = randomInt(state, 2, 5);
      player.salary = Number((player.marketValue * (0.038 + random(state) * 0.022)).toFixed(1));
      const displaced = state.players
        .filter((candidate) => candidate.status === 'active'
          && candidate.clubId === target.id
          && candidate.id !== player.id
          && (candidate.debutSeason ?? state.season) < state.season + 1
          && (!candidate.transferProtectedUntilSeason || candidate.transferProtectedUntilSeason <= state.season + 1))
        .sort((a, b) => STAR_RARITIES[a.rarity].rank - STAR_RARITIES[b.rarity].rank || a.rating - b.rating)[0];
      if (displaced && !['generational', 'legend', 'epic'].includes(displaced.rarity)) {
        displaced.clubId = null;
        displaced.contractYears = 0;
        displaced.salary = 0;
      }
    } else {
      player.clubId = null;
      player.spawnClubId = null;
      player.contractYears = 0;
      player.salary = 0;
    }
    state.players.push(player);
    counts[rarity] = (counts[rarity] || 0) + 1;
    if (['generational', 'legend', 'epic'].includes(rarity)) {
      state.pendingSeasonStars.push({ playerId: player.id, clubId: player.clubId, rarity, season: state.season + 1 });
      state.pendingSeasonNews ||= [];
      state.pendingSeasonNews.unshift({
        id: `news-${state.season + 1}-prospect-${player.id}`,
        week: 0,
        importance: rarity === 'generational' ? 'feature' : 'major',
        category: 'New Generation',
        headline: `${player.name} emerges as a ${STAR_RARITIES[rarity].label.toLowerCase()} talent`,
        body: `${player.realWorldId ? 'Real-world icon' : `${teamById(player.nationality)?.name} prospect`} ${player.name}, a ${player.roleLabel.toLowerCase()}, begins at ${target?.name || 'free agency'} with ${player.baseQuality} base quality.`,
        entityType: 'player', entityId: player.id
      });
    }
  }

  // When the rookie class is larger than natural retirements, stop tracking the
  // lowest-level veteran squad players so the universe remains compact.
  const excess = Math.max(0, totalNew - populationNeed);
  const candidates = state.players
    .filter((player) => player.status === 'active' && !['generational', 'legend', 'epic'].includes(player.rarity) && player.careerYear >= 3)
    .sort((a, b) => STAR_RARITIES[a.rarity].rank - STAR_RARITIES[b.rarity].rank || a.rating - b.rating);
  candidates.slice(0, excess).forEach((player) => {
    player.status = 'untracked';
    player.clubId = null;
    player.contractYears = 0;
  });
}

function activeCoachRarityCounts(state) {
  return (state.coaches || [])
    .filter((coach) => coach.status !== 'retired')
    .reduce((counts, coach) => {
      counts[coach.rarity] = (counts[coach.rarity] || 0) + 1;
      return counts;
    }, {});
}

function chooseReplacementCoachRarity(state, counts) {
  const targets = state.coachRarityTargets || {};
  const deficits = Object.keys(STAFF_RARITIES)
    .map((rarity) => ({ rarity, deficit: Math.max(0, (targets[rarity] || 0) - (counts[rarity] || 0)) }))
    .filter((row) => row.deficit > 0)
    .sort((a, b) => {
      const rankGap = (STAFF_RARITIES[b.rarity]?.rank || 0) - (STAFF_RARITIES[a.rarity]?.rank || 0);
      return rankGap || b.deficit - a.deficit;
    });
  if (deficits.length) return deficits[0].rarity;
  return chooseStaffRarity(state, null, 'coach');
}

function chooseCoachNationalityForRarity(state, rarity) {
  return weightedPick(state, NATIONAL_TEAMS, (team) => {
    const byTier = rarity === 'generational'
      ? { 1: 14, 2: 2.2, 3: 0.08, 4: 0.01 }
      : rarity === 'legend'
        ? { 1: 7, 2: 3.2, 3: 0.45, 4: 0.05 }
        : rarity === 'epic'
          ? { 1: 3.5, 2: 2.4, 3: 1.1, 4: 0.35 }
          : { 1: 1.8, 2: 1.45, 3: 1.15, 4: 0.9 };
    return byTier[team.tier] || 0.5;
  })?.id || 'eng';
}

function processCoachLifecycle(state) {
  state.pendingSeasonCoaches ||= [];
  state.pendingSeasonRetirements ||= [];
  state.pendingSeasonNews ||= [];
  state.history.coachMoves ||= [];
  let retiredCount = 0;

  for (const coach of state.coaches || []) {
    if (coach.status === 'retired') continue;
    coach.careerLength ||= coachCareerLength(state);
    coach.careerType ||= coachCareerType(state, coach.profile);
    coach.baseQuality ||= coach.quality || 66;
    coach.careerYear = Math.max(0, Number(coach.careerYear || 0) + 1);
    coach.debutSeason ??= state.season - coach.careerYear + 1;
    refreshCoachQuality(state, coach);
    if (coach.careerYear < coach.careerLength) continue;

    const formerClubId = coach.clubId || null;
    const formerNationalTeamId = coach.nationalTeamId || null;
    if (formerClubId) {
      const club = getClub(state, formerClubId);
      if (club) {
        club.coachId = null;
        club.coachProfile = null;
        club.coachRarity = null;
        club.coachQuality = null;
      }
    }
    if (formerNationalTeamId) {
      const team = state.nationalTeams.find((item) => item.id === formerNationalTeamId);
      if (team) {
        team.coachId = null;
        team.coachProfile = null;
        team.coachRarity = null;
        team.coachQuality = null;
      }
    }
    coach.clubId = null;
    coach.nationalTeamId = null;
    coach.status = 'retired';
    coach.retirementSeason = state.season;
    retiredCount += 1;
    state.history.coachMoves.push({
      season: state.season,
      coachId: coach.id,
      fromClubId: formerClubId,
      fromNationalTeamId: formerNationalTeamId,
      reason: 'retired'
    });
    state.pendingSeasonRetirements.push({
      type: 'coach',
      coachId: coach.id,
      formerClubId,
      formerNationalTeamId,
      rarity: coach.rarity,
      season: state.season + 1
    });
    if (['generational', 'legend', 'epic'].includes(coach.rarity)) {
      state.pendingSeasonNews.push({
        id: `news-${state.season + 1}-coach-retirement-${coach.id}`,
        week: 0,
        importance: ['generational', 'legend'].includes(coach.rarity) ? 'major' : 'digest',
        category: 'Retirements',
        headline: `${coach.name} retires from coaching`,
        body: `${STAFF_RARITIES[coach.rarity].label} ${COACH_PROFILES[coach.profile]?.label.toLowerCase() || 'coach'} ends a ${coach.careerYear}-season career with ${coach.trophies || 0} trophies.`
      });
    }
  }

  const target = state.targetActiveCoaches || (state.coaches || []).filter((coach) => coach.status !== 'retired').length + retiredCount;
  const counts = activeCoachRarityCounts(state);
  const activeCount = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const intake = Math.max(retiredCount, target - activeCount);
  for (let index = 0; index < intake; index += 1) {
    const rarity = chooseReplacementCoachRarity(state, counts);
    const nationality = chooseCoachNationalityForRarity(state, rarity);
    const coach = createStaffMember(state, 'coach', nationality, {
      rarity,
      careerYear: 0,
      appointmentSeason: state.season + 1,
      debutSeason: state.season + 1,
      seasonsInRole: 0,
      status: 'active'
    });
    state.coaches.push(coach);
    counts[rarity] = (counts[rarity] || 0) + 1;
    if (['generational', 'legend', 'epic'].includes(rarity)) {
      state.pendingSeasonCoaches.push({ coachId: coach.id, rarity, season: state.season + 1 });
      state.pendingSeasonNews.unshift({
        id: `news-${state.season + 1}-new-coach-${coach.id}`,
        week: 0,
        importance: rarity === 'generational' ? 'feature' : 'major',
        category: 'New Coaches',
        headline: `${coach.name} enters the coaching world`,
        body: `${STAFF_RARITIES[rarity].label} ${COACH_PROFILES[coach.profile].label.toLowerCase()} from ${teamById(nationality)?.name || nationality} begins as a free agent with ${coach.quality} quality, a ${COACH_CAREER_TYPES[coach.careerType]?.label || 'balanced'} development curve and an expected ${coach.careerLength}-season career.`
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


function coachAmbitionScore(state, coach) {
  const rarity = STAFF_RARITIES[coach.rarity]?.rank || 1;
  const recentTitles = (state.history.coachCompetitionSeasons || []).filter((row) => row.coachId === coach.id && row.season >= state.season - 2).reduce((sum, row) => sum + (row.titles || 0), 0);
  return coach.quality + rarity * 4 + Math.min(8, recentTitles * 3) + Math.max(-4, Math.min(5, coach.performanceScore || 0));
}

function clubJobScore(club) {
  return (club.reputation || 60) + Math.log10(Math.max(10, club.finances || 10)) * 5 + (club.ownerNegotiationBonus || 0) * 18;
}

function coachMoveWillingness(state, coach, destinationScore, currentScore) {
  const levelGain = destinationScore - currentScore;
  const rarity = STAFF_RARITIES[coach.rarity]?.rank || 1;
  const patience = coach.seasonsInRole <= 1 ? -5 : 0;
  const titleLoyalty = Math.min(6, (coach.trophies || 0) * 0.35);
  return levelGain * 1.6 + rarity * 1.1 + patience - titleLoyalty + randomInt(state, -6, 6);
}

function releaseCoachFromCurrentJob(state, coach, season, reason = 'poached') {
  const move = { season, coachId: coach.id, reason };
  if (coach.clubId) {
    const oldClub = getClub(state, coach.clubId);
    move.fromClubId = coach.clubId;
    if (oldClub) {
      oldClub.coachId = null;
      oldClub.coachProfile = null;
      oldClub.coachRarity = null;
      oldClub.coachQuality = null;
    }
    coach.clubId = null;
  }
  if (coach.nationalTeamId) {
    const oldTeam = state.nationalTeams.find((team) => team.id === coach.nationalTeamId);
    move.fromNationalTeamId = coach.nationalTeamId;
    if (oldTeam) {
      oldTeam.coachId = null;
      oldTeam.coachProfile = null;
      oldTeam.coachRarity = null;
      oldTeam.coachQuality = null;
    }
    coach.nationalTeamId = null;
  }
  return move;
}

function runCoachMarket(state) {
  const clubVacancies = [];
  const nationalVacancies = [];

  // Cache recent coaching success once per market. Previously each comparison
  // inside each vacancy sort rescanned the complete coach-season archive. As the
  // universe accumulated seasons, this made the coaching market much slower than
  // simulating the season itself.
  const recentTitlesByCoach = new Map();
  for (const row of state.history.coachCompetitionSeasons || []) {
    if (row.season < state.season - 2 || !row.titles) continue;
    recentTitlesByCoach.set(
      row.coachId,
      (recentTitlesByCoach.get(row.coachId) || 0) + row.titles
    );
  }
  const ambitionByCoach = new Map(state.coaches.filter((coach) => coach.status !== 'retired').map((coach) => {
    const rarity = STAFF_RARITIES[coach.rarity]?.rank || 1;
    const recentTitles = recentTitlesByCoach.get(coach.id) || 0;
    const score = coach.quality
      + rarity * 4
      + Math.min(8, recentTitles * 3)
      + Math.max(-4, Math.min(5, coach.performanceScore || 0));
    return [coach.id, score];
  }));
  const ambition = (coach) => ambitionByCoach.get(coach.id) ?? coachAmbitionScore(state, coach);

  for (const club of state.clubs.filter((item) => item.division === 1)) {
    const league = state.current.leagues[club.leagueId];
    const table = sortTable(league?.table || []);
    const actual = table.findIndex((row) => row.teamId === club.id) + 1;
    const peerClubs = table.map((row) => getClub(state, row.teamId)).filter(Boolean).sort((a, b) => b.reputation - a.reputation);
    const expected = peerClubs.findIndex((item) => item.id === club.id) + 1;
    const patience = club.ownerPatience || 1;
    const seasonTitles = (state.history.champions || []).filter((row) => row.season === state.season && row.winnerId === club.id && !row.isInternational);
    const majorTitleIds = new Set([club.leagueId, 'UCL', 'UEL', 'UECL', 'LIB', 'SUD', 'CCC', 'ACL', 'CAFCL', 'OCL', 'CWC', 'ICUP']);
    const majorTitles = seasonTitles.filter((row) => majorTitleIds.has(row.competitionId));
    const noTitles = seasonTitles.length === 0;
    const eliteNoTitleDismissal = club.reputation >= 90 && noTitles;
    const ambitiousNoTitleDismissal = club.reputation >= 86 && noTitles && (actual > 3 || random(state) < clamp(0.72 / patience, 0.35, 0.95));
    const failure = actual && expected && actual - expected >= Math.max(club.reputation >= 88 ? 2 : 4, Math.round((club.reputation >= 88 ? 3.5 : 6) * patience));
    const majorDrought = club.reputation >= 88 && majorTitles.length === 0 && actual > 2 && random(state) < clamp(0.48 / patience, 0.22, 0.82);
    const eliteUpgrade = club.reputation >= 84 && (club.coachQuality || 65) < 78 && random(state) < 0.18;
    const randomDismissal = random(state) < 0.012 / patience;
    const dismissReason = eliteNoTitleDismissal ? 'dismissed after a trophyless season' : ambitiousNoTitleDismissal ? 'dismissed after failing club expectations' : failure ? 'dismissed for league underperformance' : majorDrought ? 'dismissed after missing major objectives' : eliteUpgrade ? 'elite upgrade' : 'board change';
    if ((eliteNoTitleDismissal || ambitiousNoTitleDismissal || failure || majorDrought || eliteUpgrade || randomDismissal) && club.coachId) {
      const coach = getCoach(state, club.id, false);
      if (coach) {
        coach.clubId = null;
        coach.performanceScore = actual ? expected - actual : -2;
        state.history.coachMoves.push({ season: state.season, coachId: coach.id, fromClubId: club.id, toClubId: null, reason: dismissReason });
        state.pendingSeasonNews ||= [];
        if (club.reputation >= 84) state.pendingSeasonNews.unshift({ id:`news-${state.season+1}-coach-fired-${club.id}`, week:0, importance:club.reputation>=90?'major':'digest', category:'Coaching Market', headline:`${club.name} dismiss ${coach.name}`, body:`${coach.name} leaves after ${dismissReason.replace('dismissed ', '')}. ${club.name} begin the search for a replacement.` });
      }
      club.coachId = null;
      club.coachProfile = null;
      club.coachRarity = null;
      club.coachQuality = null;
      clubVacancies.push(club);
    }
  }
  state.clubs.filter((club) => club.division === 1 && !club.coachId && !clubVacancies.includes(club)).forEach((club) => clubVacancies.push(club));

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

  // National federations recruit first. Major nations can approach successful domestic coaches already employed by clubs.
  nationalVacancies.sort((a, b) => b.strength - a.strength).forEach((team) => {
    let candidates = state.coaches.filter((coach) => coach.status !== 'retired' && !coach.nationalTeamId && (coach.nationality === team.id || team.tier >= 3));
    let domestic = candidates.filter((coach) => coach.nationality === team.id);
    if (!domestic.length) {
      const generated = createStaffMember(state, 'coach', team.id, { careerYear: 0, debutSeason: state.season + 1, appointmentSeason: state.season + 1, status: 'active' });
      state.coaches.push(generated);
      candidates.push(generated);
      domestic = [generated];
    }
    const useDomestic = random(state) < nationalCoachDomesticPreference(team);
    const pool = useDomestic ? domestic : candidates;
    const destinationScore = team.strength + 12;
    const ranked = [...pool].sort((a, b) => {
      const score = (coach) => ambition(coach) + (coach.nationality === team.id ? 8 : 0) - (coach.clubId ? Math.max(0, clubJobScore(getClub(state, coach.clubId)) - destinationScore) : 0);
      return score(b) - score(a);
    });
    const coach = ranked.find((candidate) => {
      if (!candidate.clubId) return true;
      const currentClub = getClub(state, candidate.clubId);
      return coachMoveWillingness(state, candidate, destinationScore, clubJobScore(currentClub)) > 3;
    });
    if (!coach) return;
    const move = releaseCoachFromCurrentJob(state, coach, state.season + 1, coach.clubId ? 'national-team approach' : 'appointed');
    assignCoachToNation(state, coach, team);
    state.history.coachMoves.push({ ...move, toNationalTeamId: team.id });
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

  // Clubs fill vacancies and can poach successful coaches from weaker jobs. Money, prestige and recent success all matter.
  const vacancyQueue = [...clubVacancies].sort((a, b) => b.reputation - a.reputation);
  const handled = new Set();
  let safety = 0;
  while (vacancyQueue.length && safety < state.clubs.length * 2) {
    safety += 1;
    const club = vacancyQueue.shift();
    if (!club || club.coachId || handled.has(club.id)) continue;
    handled.add(club.id);
    const nationality = COUNTRY_TO_CODE[club.country] || null;
    const destinationScore = clubJobScore(club);
    const candidates = state.coaches.filter((coach) => coach.status !== 'retired' && !coach.nationalTeamId && coach.clubId !== club.id);
    const domestic = candidates.filter((coach) => coach.nationality === nationality);
    const useDomestic = domestic.length && random(state) < clubCoachDomesticPreference(club);
    const pool = useDomestic ? domestic : candidates;
    const ranked = [...pool].sort((a, b) => {
      const score = (coach) => ambition(coach) + (coach.nationality === nationality ? 3 : 0) - (coach.clubId ? Math.max(0, clubJobScore(getClub(state, coach.clubId)) - destinationScore) : 0);
      return score(b) - score(a);
    });
    const coach = ranked.find((candidate) => {
      if (!candidate.clubId) return true;
      const currentClub = getClub(state, candidate.clubId);
      const currentScore = clubJobScore(currentClub);
      const requiredGain = ['generational', 'legend'].includes(candidate.rarity) ? -1 : 2;
      return destinationScore > currentScore + requiredGain && coachMoveWillingness(state, candidate, destinationScore, currentScore) > 4;
    });
    if (!coach) continue;
    const formerClubId = coach.clubId;
    const move = releaseCoachFromCurrentJob(state, coach, state.season + 1, formerClubId ? 'poached by stronger club' : 'appointed');
    assignCoachToClub(state, coach, club);
    state.history.coachMoves.push({ ...move, toClubId: club.id });
    if (formerClubId) {
      const formerClub = getClub(state, formerClubId);
      if (formerClub && formerClub.division === 1) vacancyQueue.push(formerClub);
    }
    state.pendingSeasonNews.push({
      id: `news-${state.season + 1}-coach-${club.id}`,
      week: 0,
      importance: coach.rarity === 'legend' || coach.rarity === 'generational' ? 'major' : 'digest',
      category: 'Coaching Market',
      headline: `${club.name} appoint ${coach.name}`,
      body: `${STAFF_RARITIES[coach.rarity].label} ${COACH_PROFILES[coach.profile].label.toLowerCase()} ${formerClubId ? `leaves ${getClub(state, formerClubId)?.name || 'his previous club'} for a more ambitious project.` : 'takes charge.'}`
    });
  }

  state.coaches.forEach((coach) => { if (coach.status !== 'retired' && (coach.clubId || coach.nationalTeamId)) coach.seasonsInRole = (coach.seasonsInRole || 0) + 1; });
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
  processOwnerTurnover(state);
  processCoachLifecycle(state);
  invalidateRuntimeCache(state);
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
      const formerClubId = player.clubId || null;
      player.status = 'retired';
      player.retirementSeason = state.season;
      player.clubId = null;
      player.contractYears = 0;
      player.salary = 0;
      state.pendingSeasonRetirements ||= [];
      state.pendingSeasonRetirements.push({
        type: 'player',
        playerId: player.id,
        formerClubId,
        rarity: player.rarity,
        season: state.season + 1
      });
      if (['generational', 'legend', 'epic'].includes(player.rarity)) {
        state.pendingSeasonNews ||= [];
        state.pendingSeasonNews.unshift({
          id: `news-${state.season + 1}-player-retirement-${player.id}`,
          week: 0,
          importance: player.rarity === 'generational' ? 'feature' : 'major',
          category: 'Retirements',
          headline: `${player.name} retires from football`,
          body: `${STAR_RARITIES[player.rarity].label} ${player.roleLabel.toLowerCase()} ends a ${player.careerLength}-season career${formerClubId ? ` after his final campaign with ${getClub(state, formerClubId)?.name || 'his club'}` : ''}.`
        });
      }
      continue;
    }
    const multiplier = player.careerMultipliers[player.careerYear] ?? 0.85;
    player.rating = clamp(Math.round(player.baseQuality * multiplier), 51, 100);
    player.marketValue = calculateMarketValue(state, player);
    player.happiness = clamp(player.happiness + randomInt(state, -9, 7), 18, 100);
    const currentClub = player.clubId ? getClub(state, player.clubId) : null;
    const migrationPressure = eliteMigrationPressure(state, player, currentClub);
    if (migrationPressure >= 35) {
      // Elite players accept a development spell, but once they enter their prime a
      // lack of continental progress creates ambition and contract pressure.
      player.happiness = clamp(player.happiness - Math.round(migrationPressure / 11), 18, 100);
    }
    if (player.contractYears === 0) {
      const club = currentClub;
      const rarityAmbition = ['generational', 'legend'].includes(player.rarity) ? 1 : player.rarity === 'epic' ? 0.55 : 0;
      const prestigeGap = club ? Math.max(0, player.rating - club.reputation) : 0;
      const renewalChance = club
        ? clamp(
            0.54 + player.happiness / 270 + (club.reputation - 68) / 280
            - prestigeGap / 75 - rarityAmbition * Math.max(0, 82 - club.reputation) / 70
            - migrationPressure / 135,
            0.04,
            0.9
          )
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

function recentMajorClubAchievement(state, clubId, lookback = 2) {
  if (!clubId) return { titles: 0, finals: 0, mostRecentTitleAge: null };
  const majorIds = new Set(['UCL', 'LIB', 'CCC', 'ACL', 'CAFCL', 'OCL']);
  const cutoff = state.season - lookback;
  let titles = 0;
  let finals = 0;
  let mostRecentTitleAge = null;
  for (const row of state.history?.champions || []) {
    if (!majorIds.has(row.competitionId) || row.season < cutoff) continue;
    if (row.winnerId === clubId) {
      titles += 1;
      const age = Math.max(0, state.season - row.season);
      mostRecentTitleAge = mostRecentTitleAge === null ? age : Math.min(mostRecentTitleAge, age);
    } else if (row.runnerUpId === clubId) {
      finals += 1;
    }
  }
  return { titles, finals, mostRecentTitleAge };
}

function eliteMigrationPressure(state, player, club) {
  if (!club || !['generational', 'legend', 'epic'].includes(player.rarity)) return 0;
  const age = Math.max(18, state.season - player.birthYear);
  const youngDevelopmentStage = age < 22 || (player.careerYear || 0) < 3;
  const isEstablishedEuropeanElite = club.confederation === 'Europe' && club.reputation >= 84;
  if (isEstablishedEuropeanElite) return 0;

  const rarityBase = player.rarity === 'generational' ? 42 : player.rarity === 'legend' ? 29 : 12;
  const agePressure = Math.max(0, age - 21) * (player.rarity === 'epic' ? 4.2 : 6.8);
  const qualityPressure = Math.max(0, player.rating - 87) * (player.rarity === 'generational' ? 3.2 : 2.3);
  const stagePressure = club.confederation !== 'Europe' ? 22 : club.reputation < 78 ? 16 : 8;
  const reputationPressure = Math.max(0, player.rating - club.reputation) * 1.35;
  const achievement = recentMajorClubAchievement(state, club.id, 2);
  let successCredit = achievement.finals * 18;
  if (achievement.titles) {
    successCredit += achievement.mostRecentTitleAge <= 1 ? 82 : 55;
  }
  let pressure = rarityBase + agePressure + qualityPressure + stagePressure + reputationPressure - successCredit;
  if (youngDevelopmentStage) pressure *= 0.25;
  return clamp(pressure, 0, 100);
}

function askingPrice(state, player, buyer = null) {
  const happiness = player.happiness ?? 50;
  const happinessFactor = happiness < 35 ? 0.42 : happiness < 50 ? 0.58 : happiness < 65 ? 0.78 : 0.92 + (happiness - 65) / 190;
  const years = Math.max(0, player.contractYears || 0);
  const contractFactor = years <= 1 ? 0.48 : years === 2 ? 0.72 : years === 3 ? 0.88 : 1.0;
  const discount = 1 - (buyer?.ownerNegotiationBonus || 0) * 0.34;
  return Number((player.marketValue * happinessFactor * contractFactor * discount).toFixed(1));
}

function positionNeed(state, club) {
  const players = state.players.filter((player) => player.clubId === club.id && player.status === 'active');
  const positions = ['GK', 'DF', 'MF', 'FW'];
  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
  const totals = { GK: 0, DF: 0, MF: 0, FW: 0 };
  players.forEach((player) => {
    counts[player.position] += 1;
    totals[player.position] += player.rating;
  });
  const ideal = club.tier === 'detailed'
    ? { GK: 1, DF: 2, MF: 2, FW: 2 }
    : { GK: 1, DF: 1, MF: 1, FW: 1 };
  const missing = positions.filter((position) => counts[position] < ideal[position]);
  if (missing.length) return weightedPick(state, missing, (position) => (ideal[position] - counts[position]) * (position === 'GK' ? 0.8 : 1.2));
  const naturalPriority = { GK: 0.38, DF: 1.08, MF: 1.22, FW: 1.34 };
  return weightedPick(state, positions, (position) => {
    const average = counts[position] ? totals[position] / counts[position] : club.strength - 12;
    const qualityGap = clamp(club.strength - average + 8, 1, 22);
    return naturalPriority[position] * qualityGap;
  });
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

function runEliteTransferMarket(state, clubs, activePlayers, rosters, initial = false) {
  const caps = { generational: 1, legend: 4, epic: initial ? 7 : 10 };
  const moved = { generational: 0, legend: 0, epic: 0 };
  const movedByPosition = { GK: 0, DF: 0, MF: 0, FW: 0 };
  const positionCaps = { GK: initial ? 1 : 2, DF: initial ? 3 : 5, MF: initial ? 4 : 7, FW: initial ? 4 : 7 };
  let moves = 0;
  const candidates = activePlayers
    .filter((player) => ['generational', 'legend', 'epic'].includes(player.rarity))
    .filter((player) => !player.transferProtectedUntilSeason || state.season >= player.transferProtectedUntilSeason)
    .map((player) => {
      const seller = getClub(state, player.clubId);
      const migrationPressure = eliteMigrationPressure(state, player, seller);
      const desire = (100 - player.happiness) * 0.75
        + Math.max(0, 3 - (player.contractYears || 0)) * 15
        + random(state) * 25
        + (seller ? Math.max(0, 86 - seller.reputation) * (['generational', 'legend'].includes(player.rarity) ? 0.75 : 0.42) : 32)
        + migrationPressure * 0.9;
      return { player, seller, desire, migrationPressure };
    })
    .filter(({ player, seller, desire, migrationPressure }) => !seller || desire >= (player.rarity === 'generational' ? 34 : 27) || migrationPressure >= 48)
    .sort((a, b) => b.migrationPressure - a.migrationPressure
      || STAR_RARITIES[b.player.rarity].rank - STAR_RARITIES[a.player.rarity].rank
      || b.desire - a.desire
      || b.player.rating - a.player.rating);

  for (const candidate of candidates) {
    const { player, seller, desire, migrationPressure } = candidate;
    if (moved[player.rarity] >= caps[player.rarity]) continue;
    if (movedByPosition[player.position] >= positionCaps[player.position]) continue;
    if (seller) {
      const sellerTarget = seller.division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[seller.tier];
      if ((rosters.get(seller.id)?.length || 0) <= Math.max(3, sellerTarget - 1) && migrationPressure < 70) continue;
    }
    let possibleBuyers = clubs.filter((buyer) => {
      if (buyer.id === seller?.id || buyer.division === 2) return false;
      if (buyer.reputation < Math.max(70, (seller?.reputation || 64) - (desire > 50 ? 11 : 6))) return false;
      const fee = seller ? askingPrice(state, player, buyer) : 0;
      const globalSuperstar = migrationPressure >= 55 && ['generational', 'legend'].includes(player.rarity);
      const spendingLimit = globalSuperstar
        ? Math.max(buyer.transferBudget, buyer.finances * 0.45)
        : buyer.transferBudget;
      const wageLimit = Math.max(0.8, buyer.wageBudget * (globalSuperstar ? 0.62 : 0.52));
      if (fee > spendingLimit || player.salary > wageLimit) return false;
      const samePosition = (rosters.get(buyer.id) || []).filter((item) => item.position === player.position);
      const weakest = samePosition.sort((a, b) => a.rating - b.rating)[0];
      return !weakest || player.rating >= weakest.rating + (player.rarity === 'epic' ? 1 : 0);
    });
    if (migrationPressure >= 55) {
      const europeanElite = possibleBuyers.filter((club) => club.confederation === 'Europe' && club.reputation >= 82);
      if (europeanElite.length) possibleBuyers = europeanElite;
    }
    if (!possibleBuyers.length) continue;
    const buyer = weightedPick(state, possibleBuyers, (club) => {
      const positionFit = positionNeed(state, club) === player.position ? 12 : 3;
      const eliteAtClub = (rosters.get(club.id) || []).filter((item) => item.rarity === player.rarity).length;
      const hoardingPenalty = player.rarity === 'generational' ? 1 / (1 + eliteAtClub * 3.2) : player.rarity === 'legend' ? 1 / (1 + eliteAtClub * 0.8) : 1;
      const europePull = migrationPressure >= 45 && club.confederation === 'Europe' ? 1.8 : 1;
      const goalkeeperDemand = player.position === 'GK' ? 0.55 : 1;
      return Math.max(1, (club.reputation - 63 + positionFit + (club.ownerNegotiationBonus || 0) * 30) * hoardingPenalty * europePull * goalkeeperDemand);
    });
    const fee = seller ? askingPrice(state, player, buyer) : 0;
    const europeStepUp = seller?.confederation !== 'Europe' && buyer.confederation === 'Europe' ? 0.16 : 0;
    const acceptance = clamp(
      0.46 + desire / 155 + migrationPressure / 145
      + (buyer.reputation - (seller?.reputation || 60)) / 82
      + Math.max(0, 2 - (player.contractYears || 0)) * 0.09
      + (buyer.ownerNegotiationBonus || 0) * 0.35
      + europeStepUp,
      0.35,
      0.995
    );
    if (random(state) > acceptance) continue;
    const oldClubId = player.clubId;
    transferPlayer(state, player, buyer, seller, fee, !seller);
    if (oldClubId && rosters.has(oldClubId)) rosters.set(oldClubId, rosters.get(oldClubId).filter((item) => item.id !== player.id));
    rosters.get(buyer.id).push(player);
    moved[player.rarity] += 1;
    movedByPosition[player.position] += 1;
    moves += 1;
  }
  return moves;
}

function runTransferMarket(state, initial = false) {
  const clubs = shuffle(state, [...state.clubs]).sort((a, b) => b.reputation - a.reputation + (random(state) - 0.5) * 12);
  const activePlayers = state.players.filter((player) => player.status === 'active');
  const rosters = new Map();
  for (const club of state.clubs) rosters.set(club.id, []);
  activePlayers.forEach((player) => { if (player.clubId && rosters.has(player.clubId)) rosters.get(player.clubId).push(player); });
  const maxMoves = initial ? Math.min(260, Math.round(state.clubs.length * 0.18)) : Math.min(420, Math.round(state.clubs.length * 0.24));
  let moves = runEliteTransferMarket(state, clubs, activePlayers, rosters, initial);
  for (const buyer of clubs) {
    if (moves >= maxMoves) break;
    if (buyer.division === 2 && random(state) < 0.56) continue;
    const roster = rosters.get(buyer.id) || [];
    const target = buyer.division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[buyer.tier];
    const needPosition = positionNeed(state, buyer);
    const weakest = roster.filter((player) => player.position === needPosition).sort((a, b) => a.rating - b.rating)[0];
    const minimumUpgrade = weakest?.rating || buyer.strength - 11;
    const candidatePool = activePlayers.filter((player) => {
      // Elite players use the dedicated global market above, which applies rarity,
      // position and ambition controls. The ordinary squad market should not create
      // a second uncontrolled wave of high-profile goalkeeper transfers.
      if (['generational', 'legend', 'epic'].includes(player.rarity)) return false;
      if (player.transferProtectedUntilSeason && state.season < player.transferProtectedUntilSeason) return false;
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
  const goldenBoot = state.history.awards.find(
    (item) => item.season === state.season && item.category === 'golden_boot' && item.rank === 1
  );
  const flagshipIds = new Set(['CWC', 'ICUP', 'UCL', 'UEL', 'UECL', 'LIB', 'SUD', 'CCC', 'ACL', 'CAFCL', 'OCL']);
  const competitionWinners = [
    ...[...Object.values(state.current.globalClubCompetitions || {}), ...Object.values(state.current.continentalCompetitions || {})]
      .filter((competition) => flagshipIds.has(competition.id) && competition.championId)
      .map((competition) => ({ competitionId: competition.id, competitionName: competition.name, winnerId: competition.championId, isInternational: false })),
    ...Object.values(state.current.internationalCompetitions || {})
      .filter((competition) => competition.championId)
      .map((competition) => ({ competitionId: competition.id, competitionName: competition.name, winnerId: competition.championId, isInternational: true }))
  ];
  state.history.seasonReviews.push({
    season: state.season,
    seasonLabel: formatSeason(state.season),
    championsCupWinnerId: state.current.champions.championId,
    spainChampionId: sortTable(state.current.leagues.ESP1.table)[0]?.teamId,
    internationalChampionId: internationalChampion,
    ballonDorPlayerId: ballon?.playerId || null,
    goldenBootPlayerId: goldenBoot?.playerId || null,
    competitionWinners
  });

  state.current.archivedMatchCount = state.current.matches.length;
  state.current.archivedKnockoutMatches = state.current.matches.filter((match) => match.knockout || match.landmark);
  state.current.archivedPlayerStats = Object.values(state.current.playerStats);
  state.current.matches = [];
  state.current.playerStats = {};
  state.current.playerMatchLogs = {};
  const summaryNames = competitionWinners.slice(0, 6).map((winner) => `${winner.competitionName}: ${getTeamName(state, winner.winnerId, winner.isInternational)}`).join(' · ');
  state.current.news = [{
    id: `news-${state.season}-summary`,
    week: state.current.week,
    importance: 'feature',
    category: 'Season Summary',
    storyType: 'result',
    relevance: 120,
    headline: `${formatSeason(state.season)} champions and world awards`,
    body: `${summaryNames}${ballon ? ` · Ballon d'Or: ${getPlayer(state, ballon.playerId)?.name}` : ''}${goldenBoot ? ` · Golden Boot: ${getPlayer(state, goldenBoot.playerId)?.name}` : ''}`
  }, {
    id: `news-${state.season}-archive`,
    week: state.current.week,
    importance: 'digest',
    category: 'Archive',
    headline: `${formatSeason(state.season)} has been archived`,
    body: `${state.current.archivedMatchCount} match records were consolidated into permanent player, club, award and trophy summaries.`
  }, ...(state.current.news || [])].filter((story, index, rows) => rows.findIndex((item) => item.id === story.id) === index).slice(0, 240);
  state.current.completed = true;
}

export function startNextSeason(state) {
  if (!state.current.completed) return state;
  evolveWorld(state);
  state.season += 1;
  state.current = newCurrentSeason(state);
  state.pendingSeasonStars = [];
  state.pendingSeasonCoaches = [];
  state.pendingSeasonRetirements = [];
  state.pendingOwnerChanges = [];
  runTransferMarket(state, false);
  addPreseasonMagazine(state);
  return state;
}

export function getLeagueTable(state, leagueId) {
  return sortTable(state.current.leagues[leagueId]?.table || []);
}

export function getTeamPower(state, teamId, isInternational = false) {
  return calculateTeamStrength(state, teamId, isInternational);
}

export function getCompetitionLeaderboard(state, competitionId, metric = 'goals') {
  const source = Object.values(state.current.playerStats || {}).length
    ? Object.values(state.current.playerStats)
    : (state.current.archivedPlayerStats || []);
  return source
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
  if (state.current.superCups?.[competitionId]) return state.current.superCups[competitionId].name;
  if (state.current.globalClubCompetitions?.[competitionId]) return state.current.globalClubCompetitions[competitionId].name;
  if (state.current.continentalCompetitions?.[competitionId]) return state.current.continentalCompetitions[competitionId].name;
  if (state.current.internationalCompetitions?.[competitionId]) return state.current.internationalCompetitions[competitionId].name;
  const map = {
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


export function getCoachTotals(state, coachId, scope = 'all', competitionId = null) {
  const historical = state.history.coachCompetitionSeasons || [];
  const live = state.current.completed ? [] : Object.values(state.current.coachStats || {});
  const rows = [...historical, ...live].filter((row) => {
    if (row.coachId !== coachId) return false;
    if (competitionId && row.competitionId !== competitionId) return false;
    if (scope === 'club' && row.isInternational) return false;
    if (scope === 'international' && !row.isInternational) return false;
    return true;
  });
  return rows.reduce((sum, row) => ({
    games: sum.games + (row.games || 0),
    wins: sum.wins + (row.wins || 0),
    draws: sum.draws + (row.draws || 0),
    losses: sum.losses + (row.losses || 0),
    gf: sum.gf + (row.gf || 0),
    ga: sum.ga + (row.ga || 0),
    cleanSheets: sum.cleanSheets + (row.cleanSheets || 0),
    titles: sum.titles + (row.titles || 0)
  }), { games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cleanSheets: 0, titles: 0 });
}

export function getCoachCareer(state, coachId) {
  const coach = state.coaches?.find((item) => item.id === coachId) || null;
  const seasons = (state.history.coachSeasons || []).filter((row) => row.coachId === coachId);
  const competitionSeasons = (state.history.coachCompetitionSeasons || []).filter((row) => row.coachId === coachId);
  const currentRows = state.current.completed ? [] : Object.values(state.current.coachStats || {}).filter((row) => row.coachId === coachId);
  const honours = (state.history.champions || []).filter((row) => row.coachId === coachId);
  return { coach, seasons, competitionSeasons, currentRows, honours, totals: getCoachTotals(state, coachId) };
}

export function getCompetitionCoachLeaderboard(state, competitionId) {
  const map = new Map();
  const historical = state.history.coachCompetitionSeasons || [];
  const live = state.current.completed ? [] : Object.values(state.current.coachStats || {});
  [...historical, ...live].filter((row) => row.competitionId === competitionId).forEach((row) => {
    const item = map.get(row.coachId) || { coachId: row.coachId, games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cleanSheets: 0, titles: 0 };
    item.games += row.games || 0;
    item.wins += row.wins || 0;
    item.draws += row.draws || 0;
    item.losses += row.losses || 0;
    item.gf += row.gf || 0;
    item.ga += row.ga || 0;
    item.cleanSheets += row.cleanSheets || 0;
    item.titles += row.titles || 0;
    map.set(row.coachId, item);
  });
  return [...map.values()].map((row) => ({ ...row, winPct: row.games ? row.wins / row.games : 0 }));
}

export function getAnnualAwardRace(state) {
  return buildAnnualAwardRace(state);
}

export function upgradeWorld(state) {
  if (!state || state.version !== 4) return state;
  state.dataRevision = state.dataRevision || 5;
  if (state.dataRevision < 6) {
    const byLeague = new Map();
    state.clubs.forEach((club) => {
      const list = byLeague.get(club.leagueId) || [];
      list.push(club);
      byLeague.set(club.leagueId, list);
    });
    for (const definition of LEAGUE_DEFINITIONS) {
      const existing = byLeague.get(definition.id) || [];
      definition.clubs.forEach((source, index) => {
        const club = existing[index];
        if (!club) return;
        club.name = source[1];
        club.city = source[2];
      });
    }
    state.current.archivedKnockoutMatches ||= [];
    state.current.archivedPlayerStats ||= [];
    state.current.news ||= [];
    state.history.awards ||= [];
    state.history.champions ||= [];
    const cycle = state.season % 4;
    const international = state.current.internationalCompetitions || {};
    const internationalMatches = (state.current.matches || []).filter((match) => match.isInternational);

    // v0.5 used a one-season-late international cycle. Fresh or untouched seasons
    // can be rebuilt safely. Seasons already containing international results keep
    // their historical edition and receive enough schedule metadata to finish.
    if (!state.current.completed && cycle === 1) {
      const qualifier = international.WCQ || makeInternationalCompetition(state, {
        id: 'WCQ', ids: NATIONAL_TEAMS.map((team) => team.id), groupSize: 7,
        kind: 'qualifier', confederation: 'World', qualifiers: 32,
        groupWeeks: [3, 8, 14, 20, 26, 32], editionYear: state.season + 1
      });
      qualifier.groupWeeks = [3, 8, 14, 20, 26, 32];
      qualifier.editionYear = state.season + 1;
      international.WCQ = qualifier;
      if (!qualifier.completed && state.current.week >= 32) finalizeQualifiers(state, qualifier);

      let worldCup = international.WC;
      if (!worldCup) {
        worldCup = makeInternationalCompetition(state, {
          id: 'WC', ids: [], groupSize: 4, kind: 'finals', confederation: 'World', scheduled: true,
          groupWeeks: [44, 45, 46], knockoutWeeks: [47, 48, 49, 50], editionYear: state.season + 1
        });
        international.WC = worldCup;
      }
      worldCup.groupWeeks = [44, 45, 46];
      worldCup.knockoutWeeks = [47, 48, 49, 50];
      worldCup.editionYear = state.season + 1;
      const qualified = qualifier.qualifiedIds?.length >= 32
        ? qualifier.qualifiedIds.slice(0, 32)
        : state.internationalCycle.worldCupQualified?.slice(0, 32) || [];
      if (qualified.length >= 32 && (!worldCup.groups?.length || worldCup.scheduled)) {
        worldCup.groups = buildGroups(state, qualified, 8, false);
        worldCup.scheduled = false;
        worldCup.stage = 'Group Stage';
      }
      state.current.internationalCompetitions = international;
      state.current.international = qualifier;
    } else if (!state.current.completed && internationalMatches.length === 0) {
      state.current.internationalCompetitions = initializeInternationalCompetitions(state);
      state.current.international = Object.values(state.current.internationalCompetitions)[0] || null;
    } else if (!state.current.completed) {
      const oldQualifierWeeks = [3, 8, 14, 20, 26, 32, 36];
      const oldFinalGroupWeeks = [27, 29, 31, 33, 35];
      const oldFinalKnockoutWeeks = [38, 40, 42, 44];
      Object.values(international).forEach((competition) => {
        competition.editionYear ||= state.season + (competition.kind === 'finals' ? 0 : 1);
        if (competition.kind === 'qualifier' || competition.friendly) {
          competition.groupWeeks ||= oldQualifierWeeks;
        } else {
          competition.groupWeeks ||= oldFinalGroupWeeks;
          competition.knockoutWeeks ||= oldFinalKnockoutWeeks;
        }
      });
    }
    state.dataRevision = 6;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 7) {
    state.history.coachCompetitionSeasons ||= [];
    state.history.coachSeasons ||= [];
    state.current.coachStats ||= {};
    // Existing active-season matches can be attributed safely because coaches only move between seasons.
    if (!state.current.completed && !Object.keys(state.current.coachStats).length) {
      for (const match of state.current.matches || []) {
        const homeCoach = getCoach(state, match.homeId, match.isInternational);
        const awayCoach = getCoach(state, match.awayId, match.isInternational);
        const homeOutcome = match.homeGoals > match.awayGoals ? 'W' : match.homeGoals < match.awayGoals ? 'L' : match.winnerId === match.homeId ? 'W' : match.winnerId === match.awayId ? 'L' : 'D';
        const awayOutcome = homeOutcome === 'W' ? 'L' : homeOutcome === 'L' ? 'W' : 'D';
        recordCoachResult(state, homeCoach, match.competitionId, match.homeId, match.isInternational, match.homeGoals, match.awayGoals, homeOutcome);
        recordCoachResult(state, awayCoach, match.competitionId, match.awayId, match.isInternational, match.awayGoals, match.homeGoals, awayOutcome);
      }
      for (const league of Object.values(state.current.leagues || {}).filter((item) => item.tier === 'summary' && item.completed)) {
        for (const row of league.table || []) {
          const coach = getCoach(state, row.teamId, false);
          if (!coach) continue;
          const stat = ensureCoachStat(state, coach.id, league.id, row.teamId, false);
          stat.games += row.played || 0;
          stat.wins += row.wins || 0;
          stat.draws += row.draws || 0;
          stat.losses += row.losses || 0;
          stat.gf += row.gf || 0;
          stat.ga += row.ga || 0;
          stat.cleanSheets += row.cleanSheets || 0;
        }
      }
    }
    state.dataRevision = 7;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 8) {
    state.pendingSeasonStars ||= [];
    state.current.newStars ||= [];
    for (const player of state.players || []) {
      if (player.debutSeason == null) player.debutSeason = state.season - (player.careerYear || 0);
    }
    // Repair older saves where the original assignment routine produced implausibly
    // foreign national-team benches. Tier 1 and 2 federations receive a domestic coach;
    // tier 3 does so most of the time, while minor nations remain open to foreign experts.
    for (const team of state.nationalTeams || []) {
      const currentCoach = state.coaches?.find((coach) => coach.id === team.coachId);
      const mustRepair = team.tier <= 2 && currentCoach?.nationality !== team.id;
      const shouldRepairTier3 = team.tier === 3 && currentCoach?.nationality !== team.id && random(state) < 0.72;
      if (!mustRepair && !shouldRepairTier3) continue;
      let domestic = state.coaches.find((coach) => coach.status !== 'retired' && coach.nationality === team.id && !coach.clubId && !coach.nationalTeamId);
      if (!domestic) {
        domestic = createStaffMember(state, 'coach', team.id, { careerYear: 0, debutSeason: state.season, appointmentSeason: state.season, status: 'active' });
        state.coaches.push(domestic);
      }
      if (currentCoach) currentCoach.nationalTeamId = null;
      assignCoachToNation(state, domestic, team);
    }
    state.dataRevision = 8;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 9) {
    state.owners ||= [];
    for (const owner of state.owners) {
      if (!Number.isFinite(owner.yearsRemaining)) owner.yearsRemaining = ownerTermYears(state);
      if (!Number.isFinite(owner.appointmentSeason)) owner.appointmentSeason = state.season - (owner.seasonsInRole || 0);
    }
    state.history.coachMoves ||= [];
    state.dataRevision = 9;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 11) {
    // Real-world icon templates are introduced only for future rookie slots in
    // existing universes; archived procedural careers remain untouched.
    state.players ||= [];
    state.pendingSeasonStars ||= [];
    state.dataRevision = 11;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 12) {
    for (const coach of state.coaches || []) coach.focus = inferCoachFocus(coach);
    state.dataRevision = 12;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 13) {
    state.pendingSeasonCoaches ||= [];
    state.pendingSeasonRetirements ||= [];
    state.pendingOwnerChanges ||= [];
    if (state.current) {
      state.current.newCoaches ||= [];
      state.current.retirements ||= [];
      state.current.ownerChanges ||= [];
    }
    for (const coach of state.coaches || []) {
      coach.status ||= 'active';
      coach.careerLength ||= 17 + Math.floor(stableStringRoll(`${coach.id}-length`) * 11);
      coach.careerYear = Number.isFinite(coach.careerYear)
        ? coach.careerYear
        : Math.min(coach.careerLength - 2, Math.floor(stableStringRoll(`${coach.id}-year`) * 15));
      coach.debutSeason ??= state.season - coach.careerYear;
    }
    state.targetActiveCoaches ||= (state.coaches || []).filter((coach) => coach.status !== 'retired').length;
    state.coachRarityTargets ||= (state.coaches || []).filter((coach) => coach.status !== 'retired').reduce((counts, coach) => {
      counts[coach.rarity] = (counts[coach.rarity] || 0) + 1;
      return counts;
    }, {});
    state.dataRevision = 13;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 14) {
    state.current.superCups ||= state.current.supercup ? { 'SC-ESP1': { ...state.current.supercup, id: 'SC-ESP1', leagueId: 'ESP1', country: 'Spain' } } : {};
    state.current.supercup = state.current.superCups['SC-ESP1'] || state.current.supercup;
    state.current.globalClubCompetitions ||= initializeGlobalClubCompetitions(state);
    for (const coach of state.coaches || []) {
      coach.status ||= 'active';
      const oldLength = Number(coach.careerLength || 18);
      const newLength = 8 + Math.floor(stableStringRoll(`${coach.id}-v22-length`) * 11);
      const progress = oldLength > 1 ? Math.max(0, Number(coach.careerYear || 0)) / (oldLength - 1) : 0;
      coach.careerLength = newLength;
      coach.careerYear = Math.min(newLength - 1, Math.round(progress * (newLength - 1)));
      coach.careerType ||= Object.keys(COACH_CAREER_TYPES)[Math.floor(stableStringRoll(`${coach.id}-v22-curve`) * Object.keys(COACH_CAREER_TYPES).length)] || 'stable_prime';
      coach.baseQuality ||= Math.round((coach.quality || 66) / Math.max(0.89, coachCareerMultiplier(coach)));
      refreshCoachQuality(state, coach);
    }
    state.dataRevision = 14;
    invalidateRuntimeCache(state);
  }
  return state;
}
