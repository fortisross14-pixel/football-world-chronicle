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
  COACH_FOCUSES,
  RIVALRY_DEFINITIONS
} from './data.js';
import { REAL_WORLD_STARS } from './real-stars.js';
import { simulateMatchChances, matchEventRoll } from './match-model.js';
import { playMatch } from './match-engine.js';
import {
  FORMATIONS,
  SQUAD_SIZE,
  SQUAD_BLUEPRINT,
  SQUAD_POSITION_TARGET,
  chooseCoachFormations,
  chooseMatchFormation,
  selectStartingEleven,
  formationFitScore,
  formationNeeds,
  bestRoleForSlot,
  slotFit,
  effectiveRating,
  slotLine,
  depthPlayers,
  formationFitBonus,
  squadTargetForFormation,
  BACKUP_SYSTEM_PENALTY,
  BACKUP_SYSTEM_PENALTY_ADAPTIVE
} from './squad-model.js';
import { countryAffinity, domesticMobilityChance, eliteDepartureChance } from './market-policy.js';

const COUNTRY_TO_CODE = Object.fromEntries(
  Object.entries(COUNTRY_META).map(([country, meta]) => [country, meta.code])
);
const CAREER_LENGTH_RANGES = {
  // Players now enter senior football at 17-18 and normally retire between 30 and 39.
  short: [12, 15],
  medium: [16, 18],
  long: [19, 22]
};
const RARITY_ORDER = ['generational', 'legend', 'epic', 'rare', 'uncommon', 'common'];
// Named squad size. Top-flight clubs in full leagues carry a full 15 (11 + 4 subs);
// condensed-league and second-division clubs keep a named core of four, completed on
// matchday by unnamed depth ratings derived from the club (see clubDepthSquad).
const CLUB_ROSTER_TARGET = { detailed: SQUAD_SIZE, summary: 4, reserve: 4 };
const SMALL_CORE_BLUEPRINT = ['GK', 'DF', 'MF', 'FW'];
// Kickoff expected-goal model (tuned with scripts/calibration.mjs).
const MATCH_CALIBRATION = {
  homeGoals: 1.48,
  awayGoals: 1.14,
  homeStrengthEdge: 2.0,
  lambdaAmplitude: 0.9,
  contextPerPoint: 0.035,
  lambdaScale: 0.85,
  attackDivisor: 24,
  defenceDivisor: 25,
  attackDivisorKnockout: 23,
  defenceDivisorKnockout: 24,
  attackDivisorKnockoutIntl: 22,
  defenceDivisorKnockoutIntl: 23,
  // National teams meet rarely and with short preparation: quality gaps play out
  // less decisively than in club football (tuned with scripts/calibration-international.mjs).
  internationalGapScale: 0.6,
  // Continental finals pit a few strong nations against much weaker fields, so gaps are
  // compressed more there; World Cup fields are closer and keep more of the gap.
  internationalGapScaleByCompetition: { WC: 0.65, EURO: 0.3, COPA: 0.25, AFCON: 0.35, ASIACUP: 0.35, GOLDCUP: 0.25, OFC: 0.4 }
};
// Role families per squad slot so a generated 15 has centre-backs and full-backs,
// holding and creative midfielders, and both central and wide forwards.
const SQUAD_ROLE_HINTS = [
  null,
  ['ball_playing_centre_back', 'stopper_centre_back'],
  ['attacking_full_back', 'defensive_full_back'],
  ['box_to_box', 'deep_playmaker', 'defensive_midfielder'],
  ['attacking_midfielder', 'wide_midfielder'],
  ['striker', 'target_forward', 'false_nine'],
  ['ball_playing_centre_back', 'stopper_centre_back'],
  ['defensive_midfielder', 'box_to_box', 'deep_playmaker'],
  ['winger', 'inside_forward'],
  ['attacking_full_back', 'defensive_full_back'],
  ['wide_midfielder', 'attacking_midfielder', 'box_to_box'],
  null, null, null, null
];
const INTERNATIONAL_FINAL_SIZES = {
  Europe: 24,
  Africa: 24,
  Asia: 24,
  'North America': 12,
  'South America': 10,
  Oceania: 8
};

// Final-tournament formats (v4.2). advance = places per group; bestThirds = extra
// third-placed qualifiers; knockout = teams in the first knockout round.
const INTERNATIONAL_FORMATS = {
  WC: { groups: 8, groupSize: 4, advance: 2, bestThirds: 0, knockout: 16 },
  EURO: { groups: 6, groupSize: 4, advance: 2, bestThirds: 4, knockout: 16 },
  AFCON: { groups: 6, groupSize: 4, advance: 2, bestThirds: 4, knockout: 16 },
  ASIACUP: { groups: 6, groupSize: 4, advance: 2, bestThirds: 4, knockout: 16 },
  GOLDCUP: { groups: 3, groupSize: 4, advance: 2, bestThirds: 2, knockout: 8 },
  // South America has ten nations: two groups of five, the top four of each go through.
  COPA: { groups: 2, groupSize: 5, advance: 4, bestThirds: 0, knockout: 8, groupWeeks: [42, 43, 44, 45, 46] },
  OFC: { groups: 2, groupSize: 4, advance: 2, bestThirds: 0, knockout: 4 }
};
// World Cup draw: at most one team per confederation in a group, two for Europe.
const WORLD_CUP_GROUP_LIMITS = { Europe: 2 };

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

const HISTORICAL_CLUB_REPUTATION = {
  'real-madrid': 97, bayern: 95, milan: 95, liverpool: 94, ajax: 93, 'man-utd': 93,
  juventus: 92, inter: 92, porto: 91, benfica: 91, atletico: 90, 'athletic': 88,
  river: 90, boca: 90, santos: 89, flamengo: 88, palmeiras: 87, celtic: 87,
  arsenal: 88, chelsea: 86, 'aston-villa': 85, dortmund: 86, psg: 84, 'man-city': 85
};


// Financial power is deliberately slower-moving than squad quality. A hot two-year run can
// make a club excellent, but it does not instantly turn Uruguay into a richer ecosystem than
// England, Spain, Germany or Italy. Clubs can climb/fall through four institutional buckets.
const CLUB_FINANCIAL_TIERS = {
  S: { label: 'Tier S', rank: 4, weight: 4.8 },
  T1: { label: 'Tier 1', rank: 3, weight: 2.8 },
  T2: { label: 'Tier 2', rank: 2, weight: 1.65 },
  R: { label: 'Remaining', rank: 1, weight: 0.8 }
};

const COUNTRY_FINANCE_PROFILES = {
  A: { base: 820, amplitude: 72, min: 700, max: 960 },
  B: { base: 455, amplitude: 48, min: 330, max: 650 },
  C: { base: 285, amplitude: 34, min: 170, max: 500 },
  D: { base: 150, amplitude: 22, min: 80, max: 330 }
};

const COUNTRY_FINANCE_CLASS = {
  England:'A', Spain:'A', Germany:'A', Italy:'A',
  France:'B', Portugal:'B', Netherlands:'B', Scotland:'B', Brazil:'B', Argentina:'B',
  Belgium:'C', 'Türkiye':'C', Turkey:'C', Russia:'C', Greece:'C', Croatia:'C', Serbia:'C', Switzerland:'C', Austria:'C', Ukraine:'C',
  Denmark:'C', Sweden:'C', Norway:'C', Uruguay:'C', Colombia:'C', Mexico:'C', 'United States':'C', Egypt:'C', 'Saudi Arabia':'C', Japan:'C', Morocco:'C',
  'South Africa':'C', 'South Korea':'C', China:'C', Australia:'C', Qatar:'C', 'United Arab Emirates':'C', Ecuador:'C', Paraguay:'C', Chile:'C'
};

// A league era represents the ecosystem around its clubs: broadcasting money,
// sporting pull and the ability of several teams to keep a strong squad at the
// same time. It never adds a hidden match bonus, so an institutional giant can
// remain dangerous while its domestic league is outside the current boom.
const LEAGUE_ERA_CANDIDATES = {
  Europe: ['ENG1', 'ESP1', 'ITA1', 'GER1', 'FRA1', 'POR1', 'NED1'],
  'South America': ['BRA1', 'ARG1', 'URU1', 'COL1'],
  'North America': ['MEX1', 'USA1'],
  Asia: ['KSA1', 'JPN1', 'KOR1', 'CHN1'],
  Africa: ['EGY1', 'MAR1', 'RSA1'],
  Oceania: ['NZL1', 'SOL1', 'FIJ1']
};

const ERA_ECONOMIC_BONUS = { A: 150, B: 330, C: 240, D: 155 };

const CLUB_FINANCIAL_TIER_OVERRIDES = {
  'real-madrid':'S', atletico:'S', athletic:'T1', valencia:'T1', sevilla:'T1', villarreal:'T2', 'real-sociedad':'T2', betis:'T2', deportivo:'T2',
  'man-utd':'S', liverpool:'S', arsenal:'S', chelsea:'T1', 'man-city':'T1', 'aston-villa':'T1', tottenham:'T1', everton:'T2', newcastle:'T2', nottingham:'T2', leeds:'T2',
  milan:'S', inter:'S', juventus:'S', roma:'T1', lazio:'T1', napoli:'T1', fiorentina:'T1', torino:'T2', bologna:'T2', parma:'T2',
  bayern:'S', dortmund:'T1', leverkusen:'T1', gladbach:'T2', stuttgart:'T2', frankfurt:'T2',
  marseille:'S', psg:'T1', monaco:'T1', lyon:'T1', lille:'T2',
  benfica:'S', porto:'S', sporting:'S', braga:'T1', vitoria:'T2',
  ajax:'S', psv:'T1', feyenoord:'T1', az:'T2',
  river:'S', boca:'S', racing:'T1', independiente:'T1', 'san-lorenzo':'T1', estudiantes:'T2', velez:'T2',
  flamengo:'S', santos:'S', 'sao-paulo':'S', palmeiras:'T1', corinthians:'T1', gremio:'T1', internacional:'T1', 'atletico-mg':'T1', cruzeiro:'T2',
  nacional:'S', penarol:'S', 'defensor-sporting':'T1', 'penarol-penarol':'S',
  america:'S', chivas:'S', 'cruz-azul':'T1', tigres:'T1', monterrey:'T1',
  celtic:'S', rangers:'S',
  galatasaray:'S', fenerbahce:'S', besiktas:'T1',
  'al-ahly':'S', zamalek:'S',
  'al-hilal':'S', 'al-nassr':'T1', 'al-ittihad':'T1',
  'kawasaki':'S', urawa:'T1', kobe:'T1'
};

const RUNTIME_CACHE = new WeakMap();
const PLAYER_HISTORY_CACHE = new WeakMap();
const ELITE_MARKET_CACHE = new WeakMap();
const HISTORICAL_INDEX_CACHE = new WeakMap();

function invalidateRuntimeCache(state) {
  RUNTIME_CACHE.delete(state);
  ELITE_MARKET_CACHE.delete(state);
}

// Rosters change one transfer at a time during the market. Instead of throwing the
// whole cache away (every club and national squad would be rebuilt), the affected
// clubs' player lists are patched and their squads recomputed lazily.
function noteRosterChange(state, player, fromClubId, toClubId) {
  ELITE_MARKET_CACHE.delete(state);
  const cache = RUNTIME_CACHE.get(state);
  if (!cache) return;
  if (fromClubId && cache.clubPlayers.has(fromClubId)) {
    cache.clubPlayers.set(fromClubId, cache.clubPlayers.get(fromClubId).filter((item) => item !== player));
  }
  if (toClubId && player.status === 'active') {
    if (!cache.clubPlayers.has(toClubId)) cache.clubPlayers.set(toClubId, []);
    const list = cache.clubPlayers.get(toClubId);
    if (!list.includes(player)) list.push(player);
  }
  for (const id of [fromClubId, toClubId]) {
    if (!id) continue;
    cache.clubSquads.delete(id);
    cache.clubTopSixQuality.delete(id);
  }
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
    clubPlayers,
    nationalPlayers,
    // Squads (15 + formation + XI) are built lazily on first use.
    clubSquads: new Map(),
    nationalSquads: new Map(),
    recentContinentalTitles,
    clubTopSixQuality: new Map()
  };
  RUNTIME_CACHE.set(state, cache);
  return cache;
}

function getHistoricalIndexes(state) {
  const clubSeasonLength = state.history?.clubSeasons?.length || 0;
  const competitionLength = state.history?.clubCompetitionSeasons?.length || 0;
  const championLength = state.history?.champions?.length || 0;
  const cached = HISTORICAL_INDEX_CACHE.get(state);
  if (cached && cached.season === state.season && cached.clubSeasonLength === clubSeasonLength
    && cached.competitionLength === competitionLength && cached.championLength === championLength) return cached;
  const latestLeaguePositions = new Map();
  const latestSeasons = new Map();
  for (const row of state.history?.clubSeasons || []) {
    if ((latestSeasons.get(row.clubId) ?? -Infinity) > row.season) continue;
    latestSeasons.set(row.clubId, row.season);
    latestLeaguePositions.set(row.clubId, row.position);
  }
  const worldRankingPoints = new Map();
  const continentalLevels = new Map(CONTINENTAL_DEFINITIONS.map((definition) => [definition.id, definition.level]));
  for (const row of state.history?.clubCompetitionSeasons || []) {
    if (row.season < state.season - 4) continue;
    const level = continentalLevels.get(row.competitionId);
    const weight = level === 1 ? 3.2 : level === 2 ? 1.7 : 0.8;
    worldRankingPoints.set(row.teamId, (worldRankingPoints.get(row.teamId) || 0) + (row.wins || 0) * weight + (row.apps || 0) * 0.25 * weight);
  }
  for (const row of state.history?.champions || []) {
    if (row.season < state.season - 4 || continentalLevels.get(row.competitionId) !== 1) continue;
    worldRankingPoints.set(row.winnerId, (worldRankingPoints.get(row.winnerId) || 0) + 60);
  }
  const result = { season: state.season, clubSeasonLength, competitionLength, championLength, latestLeaguePositions, worldRankingPoints };
  HISTORICAL_INDEX_CACHE.set(state, result);
  return result;
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

function slug(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatSeason(season) {
  return `Year ${season - START_SEASON + 1}`;
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
  // Foreign academy players favor language/cultural links as well as geography.
  if (preferred && eligible.includes(preferred)) {
    const roll = random(state);
    if (roll < 0.9) return preferred.id;
    const foreign = eligible.filter((team) => team.id !== preferred.id);
    return weightedPick(state, foreign, (team) => nationalityWeight(team, rarity)
      * countryAffinity(preferred.name, team.name, preferred.region, team.region))?.id || preferred.id;
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
  if (years === base.length) return [...base];
  // Stretch/compress the archetype instead of padding long careers with years of 0.85.
  // This preserves an early peak, late bloom, second wind, etc. over a realistic 12-22 year career.
  return Array.from({ length: years }, (_, index) => {
    if (years <= 1) return Number(base[0].toFixed(3));
    const position = index * (base.length - 1) / (years - 1);
    const left = Math.floor(position);
    const right = Math.min(base.length - 1, Math.ceil(position));
    const t = position - left;
    return Number((base[left] * (1 - t) + base[right] * t).toFixed(3));
  });
}

function mappedRealCareerLength(templateLength) {
  // Legacy icon templates were authored on the old 8-13 year scale. Preserve their relative
  // longevity while mapping them to realistic senior careers.
  const map = { 8: 12, 9: 13, 10: 15, 11: 17, 12: 19, 13: 21 };
  return map[Math.round(templateLength || 11)] || 17;
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
  nationalSpecialist = false,
  roleOptions = null
} = {}) {
  const actualPosition = position || pick(state, POSITION_BLUEPRINT).position;
  const actualNationality = nationality || chooseNationality(state, rarity, club?.country);
  const hinted = roleOptions ? ROLE_DEFINITIONS[actualPosition]?.filter((item) => roleOptions.includes(item.id)) : null;
  const role = hinted?.length ? pick(state, hinted) : pickRole(state, actualPosition);
  const length = careerLength(state);
  const type = pick(state, Object.keys(CAREER_TYPES));
  const curve = careerCurve(type, length.years);
  const debutAge = random(state) < 0.48 ? 17 : 18;
  const initialCareerYear = careerYear === null
    ? randomInt(state, 0, Math.max(0, Math.min(length.years - 4, 15)))
    : clamp(careerYear, 0, length.years - 1);
  const baseQuality = rarityQuality(state, rarity);
  const rating = clamp(Math.round(baseQuality * curve[initialCareerYear]), 51, (STAR_RARITIES[rarity]?.rank || 1) < 4 ? STAR_RARITIES[rarity].max - 1 : 100);
  const name = uniqueName(state, actualNationality);
  const id = `${club?.id || actualNationality}-${slug(name)}-${state.nextPlayerId}`;
  state.nextPlayerId += 1;
  const age = debutAge + initialCareerYear;
  const value = calculateMarketValueRaw(baseQuality, rarity, age, actualPosition);
  return initialisePlayerProfile({
    id,
    name,
    clubId: club?.id || null,
    nationality: actualNationality,
    birthYear: state.season - age,
    debutAge,
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
    clubJoinedSeason: club ? state.season - Math.min(initialCareerYear, 5) : null,
    unhappySeasons: 0,
    transferProtectedUntilSeason: initialCareerYear === 0 ? state.season + 1 : null
  }, true);
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
  const length = mappedRealCareerLength(template.careerLength || 11);
  const curve = careerCurve(type, length);
  const initialCareerYear = clamp(careerYear, 0, length - 1);
  const role = roleTemplate(template.position, template.role);
  const baseQuality = clamp(template.baseQuality, STAR_RARITIES[template.rarity].min, STAR_RARITIES[template.rarity].max);
  const rating = clamp(Math.round(baseQuality * (curve[initialCareerYear] ?? 0.9)), 51, 100);
  const debutAge = ['prodigy', 'early_peak'].includes(type) ? 17 : 18;
  const age = debutAge + initialCareerYear;
  const value = calculateMarketValueRaw(baseQuality, template.rarity, age, template.position);
  const id = `real-${template.id}-${state.nextPlayerId}`;
  state.nextPlayerId += 1;
  state.usedNames ||= {};
  state.usedNames[template.nationality] ||= {};
  state.usedNames[template.nationality][template.name] = 1;
  return initialisePlayerProfile({
    id,
    name: template.name,
    clubId: club?.id || null,
    nationality: template.nationality,
    birthYear: debutSeason - age,
    debutAge,
    position: template.position,
    role: role.id,
    roleLabel: role.label,
    rarity: template.rarity,
    baseQuality,
    rating,
    careerLengthType: length <= 15 ? 'short' : length <= 18 ? 'medium' : 'long',
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
    clubJoinedSeason: club ? debutSeason - initialCareerYear : null,
    unhappySeasons: 0,
    // Historical icons always complete their first visible season at their
    // curated starting club before becoming part of the normal transfer market.
    transferProtectedUntilSeason: debutSeason + 1
  }, true);
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

function competitionLegacyWeight(competitionId = '') {
  if (competitionId === 'WC') return 2.6;
  if (['UCL','LIB'].includes(competitionId)) return 2.25;
  if (['EURO','COPA'].includes(competitionId)) return 2.05;
  if (['UEL','CWC','ICUP'].includes(competitionId)) return 1.65;
  if (['AFCON','ASIACUP','GOLDCUP','CAFCL','ACL','CCC','UECL','SUD'].includes(competitionId)) return 1.35;
  const league = LEAGUE_DEFINITIONS.find((item) => item.id === competitionId);
  if (league) {
    if (['ESP1','ENG1','ITA1','GER1','FRA1'].includes(league.id)) return 1.55;
    if (['POR1','NED1','BRA1','ARG1'].includes(league.id)) return 1.28;
    return league.tier === 'detailed' ? 1.12 : 0.88;
  }
  if (String(competitionId).startsWith('CUP-')) {
    const leagueId = String(competitionId).slice(4);
    return ['ESP1','ENG1','ITA1','GER1','FRA1'].includes(leagueId) ? 1.08 : 0.72;
  }
  return 0.8;
}

function getPlayerHistoryCache(state) {
  const signature = `${state.season}:${state.history?.honours?.length || 0}:${state.history?.awards?.length || 0}:${state.history?.playerSeasons?.length || 0}`;
  const cached = PLAYER_HISTORY_CACHE.get(state);
  if (cached?.signature === signature) return cached;
  const value = {
    signature,
    achievement3: buildPlayerAchievementMap(state, 3),
    achievement4: buildPlayerAchievementMap(state, 4),
    recentSuccess2: buildPlayerRecentSuccessMap(state, 2)
  };
  PLAYER_HISTORY_CACHE.set(state, value);
  return value;
}

function buildPlayerAchievementMap(state, lookback = 4) {
  const cutoff = state.season - lookback;
  const map = new Map();
  const add = (id, value) => map.set(id, (map.get(id) || 0) + value);
  for (const honour of state.history?.honours || []) {
    if (honour.season < cutoff) continue;
    add(honour.playerId, 8 * competitionLegacyWeight(honour.competitionId));
  }
  for (const award of state.history?.awards || []) {
    if (award.season < cutoff || (award.rank || 1) > 3) continue;
    const rank = award.rank || 1;
    const name = String(award.name || '');
    const base = name.includes("Ballon d'Or") ? 26 : award.category === 'golden_boot' ? 10 : /Player of the Season|MVP/i.test(name) ? 13 : /Best /i.test(name) ? 7 : 4;
    add(award.playerId, base * (rank === 1 ? 1 : rank === 2 ? 0.5 : 0.3) * competitionLegacyWeight(award.competitionId || ''));
  }
  for (const row of state.history?.playerSeasons || []) {
    if (row.season < cutoff || row.isInternational || (row.apps || 0) < 8) continue;
    const value = Math.max(0, (row.averageRating || 6.5) - 7) * Math.min(12, row.apps || 0) * 0.7 * competitionLegacyWeight(row.competitionId)
      + Math.min(12, row.goals || 0) * 0.12 * competitionLegacyWeight(row.competitionId);
    add(row.playerId, value);
  }
  for (const [id,value] of map) map.set(id, Math.min(140,value));
  return map;
}

function playerAchievementScore(state, player, lookback = 4) {
  if (!player) return 0;
  const cache = getPlayerHistoryCache(state);
  if (lookback <= 3) return cache.achievement3.get(player.id) || 0;
  return cache.achievement4.get(player.id) || 0;
}

function calculateMarketValue(state, player) {
  const age = Math.max(18, state.season - player.birthYear);
  // Clubs pay for what a player is now, then add a premium for proven achievement.
  // A 98-100 prospect without trophies is valuable, but not automatically a $200m asset.
  const raw = calculateMarketValueRaw(player.rating, player.rarity, age, player.position);
  const achievement = playerAchievementScore(state, player, 4);
  const proofMultiplier = 0.28 + Math.min(0.72, achievement / 115);
  const experienceFloor = Math.min(0.12, Math.max(0, (player.careerYear || 0) - 1) * 0.025);
  return Number(Math.max(0.4, raw * Math.min(1, proofMultiplier + experienceFloor)).toFixed(1));
}

function refreshAllMarketValues(state) {
  for (const player of state.players || []) {
    if (player.status === 'active') player.marketValue = calculateMarketValue(state, player);
  }
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

// Active coaches by rarity (v4.4): the world keeps 2–3 Generational, 8–10 Legend, 15–20
// Epic and about 40 Rare coaches; everyone else is Uncommon or Common.
const COACH_RARITY_TARGETS = { generational: 3, legend: 9, epic: 18, rare: 40 };
const COACH_RARITY_CEILINGS = { generational: 3, legend: 10, epic: 20, rare: 44 };
// Elite coaches mostly come from strong football nations.
const COACH_NATION_WEIGHTS = {
  generational: { 1: 14, 2: 2.2, 3: 0.08, 4: 0.01 },
  legend: { 1: 7, 2: 3.2, 3: 0.45, 4: 0.05 },
  epic: { 1: 3.5, 2: 2.4, 3: 1.1, 4: 0.35 },
  rare: { 1: 1.8, 2: 1.45, 3: 1.15, 4: 0.9 }
};

function nationTier(nationality) {
  const nation = NATIONAL_TEAMS.find((team) => team.id === nationality || COUNTRY_TO_CODE[team.name] === nationality);
  return nation?.tier || 4;
}

// Below Rare: Uncommon about a third of the time, Common otherwise.
function ordinaryCoachRarity(state) {
  return random(state) < 0.35 ? 'uncommon' : 'common';
}

// A rarity the world can still take: anything at its ceiling drops to the next level.
function cappedCoachRarity(state, desired) {
  const counts = activeCoachRarityCounts(state);
  const order = ['generational', 'legend', 'epic', 'rare'];
  for (let index = order.indexOf(desired); index >= 0 && index < order.length; index += 1) {
    const rarity = order[index];
    if ((counts[rarity] || 0) < COACH_RARITY_CEILINGS[rarity]) return rarity;
  }
  return ['uncommon', 'common'].includes(desired) ? desired : 'uncommon';
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
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function leagueEraCandidates(confederation) {
  const available = new Set(LEAGUE_DEFINITIONS.filter((league) => league.confederation === confederation).map((league) => league.id));
  return (LEAGUE_ERA_CANDIDATES[confederation] || []).filter((id) => available.has(id));
}

function createLeagueEra(state, confederation, startSeason, previousIds = []) {
  const candidates = leagueEraCandidates(confederation);
  const blocked = new Set(previousIds.slice(-2));
  const eligible = candidates.filter((id) => !blocked.has(id));
  const pool = eligible.length ? eligible : candidates;
  const roll = stableStringRoll(`${state.seed}:${confederation}:${startSeason}:league-era`);
  const leagueId = pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))] || candidates[0];
  const duration = 6 + Math.floor(stableStringRoll(`${state.seed}:${confederation}:${startSeason}:era-length`) * 3);
  return {
    confederation,
    leagueId,
    startSeason,
    endSeason: startSeason + duration - 1,
    duration,
    previousLeagueIds: [...previousIds.slice(-2), leagueId]
  };
}

function initializeLeagueEras(state) {
  state.leagueEras ||= {};
  state.history ||= {};
  state.history.leagueEras ||= [];
  for (const confederation of Object.keys(LEAGUE_ERA_CANDIDATES)) {
    if (!state.leagueEras[confederation]) state.leagueEras[confederation] = createLeagueEra(state, confederation, state.season, []);
  }
}

function activeLeagueEra(state, confederation) {
  initializeLeagueEras(state);
  return state.leagueEras?.[confederation] || null;
}

function leagueEraFor(state, leagueId, season = state.season) {
  const league = LEAGUE_DEFINITIONS.find((item) => item.id === leagueId);
  if (!league) return null;
  const era = activeLeagueEra(state, league.confederation);
  if (!era || era.leagueId !== leagueId || season < era.startSeason || season > era.endSeason) return null;
  return era;
}

function leagueEraEconomicBonus(state, league, season = state.season) {
  const era = leagueEraFor(state, league.id, season);
  if (!era) return 0;
  return ERA_ECONOMIC_BONUS[COUNTRY_FINANCE_CLASS[league.country] || 'D'] || 0;
}

function leagueEraMarketBonus(state, leagueId) {
  const era = leagueEraFor(state, leagueId);
  if (!era) return 0;
  return era.confederation === 'Europe' ? 12.5 : 8.0;
}

function advanceLeagueEras(state) {
  initializeLeagueEras(state);
  const nextSeason = state.season + 1;
  for (const [confederation, era] of Object.entries(state.leagueEras)) {
    if (nextSeason <= era.endSeason) continue;
    const league = LEAGUE_DEFINITIONS.find((item) => item.id === era.leagueId);
    state.history.leagueEras.push({ ...era, leagueName: league?.name || era.leagueId, country: league?.country || null });
    const replacement = createLeagueEra(state, confederation, nextSeason, era.previousLeagueIds || [era.leagueId]);
    state.leagueEras[confederation] = replacement;
    const nextLeague = LEAGUE_DEFINITIONS.find((item) => item.id === replacement.leagueId);
    state.pendingSeasonNews ||= [];
    state.pendingSeasonNews.unshift({
      id: `news-${nextSeason}-league-era-${confederation}`,
      week: 0,
      importance: confederation === 'Europe' ? 'feature' : 'major',
      category: 'Football Era',
      headline: `${nextLeague?.name || replacement.leagueId} enters a new golden era`,
      body: `${nextLeague?.country || confederation} begins a ${replacement.duration}-season cycle of stronger broadcasting income, deeper squads and greater market pull. Historic giants elsewhere retain their own institutional power.`
    });
  }
}


function countryFinanceProfile(country) {
  return COUNTRY_FINANCE_PROFILES[COUNTRY_FINANCE_CLASS[country] || 'D'];
}

function initialClubFinancialTier(league, clubId, index) {
  if (CLUB_FINANCIAL_TIER_OVERRIDES[clubId]) return CLUB_FINANCIAL_TIER_OVERRIDES[clubId];
  const count = league?.clubs?.length || 6;
  if (count <= 6) return index === 0 ? 'S' : index <= 2 ? 'T1' : index <= 4 ? 'T2' : 'R';
  return index <= 1 ? 'S' : index <= 5 ? 'T1' : index <= 9 ? 'T2' : 'R';
}

// Country finance tables only need filling once; later calls (thousands per market
// pass through countryPool) return immediately.
const COUNTRY_FINANCE_READY = new WeakSet();
function initializeCountryFinance(state) {
  state.countryFinance ||= {};
  if (COUNTRY_FINANCE_READY.has(state.countryFinance)) return;
  COUNTRY_FINANCE_READY.add(state.countryFinance);
  for (const league of LEAGUE_DEFINITIONS) {
    if (state.countryFinance[league.country]) continue;
    const profile = countryFinanceProfile(league.country);
    const eraRoll = stableStringRoll(`${state.seed}-${league.country}-finance-era`);
    const phase = stableStringRoll(`${league.country}-finance-phase`) * Math.PI * 2;
    const initial = clamp(profile.base + (eraRoll - 0.5) * profile.amplitude * 1.35, profile.min, profile.max);
    state.countryFinance[league.country] = {
      class: COUNTRY_FINANCE_CLASS[league.country] || 'D',
      basePool: Number(initial.toFixed(1)),
      pool: Number(initial.toFixed(1)),
      phase: Number(phase.toFixed(4)),
      updatedSeason: state.season
    };
  }
}

function financialTierWeight(tier) {
  return CLUB_FINANCIAL_TIERS[tier]?.weight || CLUB_FINANCIAL_TIERS.R.weight;
}

function countryPool(state, country) {
  initializeCountryFinance(state);
  return Number(state.countryFinance?.[country]?.pool || countryFinanceProfile(country).base);
}

function clubCountryAllocationMap(state, country) {
  const clubs = (state.clubs || []).filter((club) => club.country === country && club.division === 1);
  const pool = countryPool(state, country);
  const totalWeight = clubs.reduce((sum, club) => sum + financialTierWeight(club.financialTier), 0) || 1;
  return new Map(clubs.map((club) => [club.id, pool * financialTierWeight(club.financialTier) / totalWeight]));
}

function seedClubFinanceFromPools(state) {
  for (const league of LEAGUE_DEFINITIONS) {
    const allocations = clubCountryAllocationMap(state, league.country);
    for (const club of (state.clubs || []).filter((item) => item.country === league.country)) {
      const share = allocations.get(club.id) || countryPool(state, league.country) * 0.018;
      const variation = 0.88 + stableStringRoll(`${state.seed}-${club.id}-cash`) * 0.26;
      club.annualFinanceShare = Number(share.toFixed(1));
      club.finances = Math.max(3, Math.round(share * 1.75 * variation));
      club.transferBudget = Math.max(1, Math.round(Math.min(club.finances * 0.48, share * 0.92)));
      club.wageBudget = Number(Math.max(1.2, share * 0.24).toFixed(1));
    }
  }
}

function buildClubFinancialPerformanceMap(state, lookback = 10) {
  const cutoff = state.season - lookback + 1;
  const map = new Map();
  const ensure = (clubId) => {
    if (!map.has(clubId)) map.set(clubId, { score:0, leagueTitles:0, continentalFinals:0, continentalTitles:0, positionSum:0, seasons:0 });
    return map.get(clubId);
  };
  for (const row of state.history?.clubSeasons || []) {
    if (row.season < cutoff) continue;
    const item = ensure(row.clubId);
    item.seasons += 1;
    item.positionSum += row.position || 10;
    if (row.position === 1) { item.score += 6; item.leagueTitles += 1; }
    else if (row.position === 2) item.score += 2.8;
    else if (row.position <= 4) item.score += 1.1;
  }
  for (const row of state.history?.champions || []) {
    if (row.season < cutoff) continue;
    const weight = competitionLegacyWeight(row.competitionId);
    const continental = ['UCL','UEL','UECL','LIB','SUD','CCC','ACL','CAFCL','OCL','CWC','ICUP'].includes(row.competitionId);
    if (row.winnerId) {
      const item = ensure(row.winnerId);
      item.score += Math.max(1.5, weight * 4.2);
      if (continental) { item.continentalFinals += 1; item.continentalTitles += 1; }
    }
    if (row.runnerUpId) {
      const item = ensure(row.runnerUpId);
      item.score += Math.max(0.8, weight * 2.2);
      if (continental) item.continentalFinals += 1;
    }
  }
  for (const item of map.values()) item.avgPos = item.seasons ? item.positionSum / item.seasons : 99;
  return map;
}

function updateClubFinancialTiers(state) {
  const performance = buildClubFinancialPerformanceMap(state, 10);
  for (const club of state.clubs || []) {
    if (club.division !== 1) continue;
    const perf = performance.get(club.id) || { score:0, leagueTitles:0, continentalFinals:0, continentalTitles:0, avgPos:99, seasons:0 };
    if (perf.seasons < 3) continue;
    const old = club.financialTier || 'R';
    let next = old;
    if (old === 'R' && perf.score >= 8) next = 'T2';
    else if (old === 'T2' && perf.score >= 18) next = 'T1';
    else if (old === 'T1' && perf.score >= 34 && (perf.continentalFinals > 0 || perf.leagueTitles >= 2)) next = 'S';
    else if (old === 'S' && perf.seasons >= 7 && perf.score < 16 && perf.leagueTitles === 0 && perf.continentalFinals === 0 && perf.avgPos > 5) next = 'T1';
    else if (old === 'T1' && perf.seasons >= 7 && perf.score < 6 && perf.avgPos > 7) next = 'T2';
    else if (old === 'T2' && perf.seasons >= 7 && perf.score < 2.5 && perf.avgPos > 9) next = 'R';
    if (next !== old) {
      club.financialTier = next;
      club.financialTierSince = state.season + 1;
      state.pendingSeasonNews ||= [];
      if (['S','T1'].includes(next) || ['S','T1'].includes(old)) state.pendingSeasonNews.push({
        id:`news-${state.season+1}-financial-tier-${club.id}`,
        week:0,
        importance: next === 'S' || old === 'S' ? 'major' : 'digest',
        category:'Club Status',
        headline:`${club.name} ${CLUB_FINANCIAL_TIERS[next].rank > CLUB_FINANCIAL_TIERS[old].rank ? 'rise' : 'fall'} to ${CLUB_FINANCIAL_TIERS[next].label}`,
        body:`A decade of results has changed ${club.name}'s institutional standing and long-term share of ${club.country}'s football economy.`
      });
    }
  }
}

function buildCountryContinentalMomentumMap(state, lookback = 6) {
  const cutoff = state.season - lookback + 1;
  const points = new Map();
  const clubs = new Map((state.clubs || []).map((club) => [club.id, club]));
  for (const row of state.history?.champions || []) {
    if (row.season < cutoff || !['UCL','UEL','UECL','LIB','SUD','CCC','ACL','CAFCL','OCL','CWC','ICUP'].includes(row.competitionId)) continue;
    const winner = clubs.get(row.winnerId);
    const runner = clubs.get(row.runnerUpId);
    const weight = competitionLegacyWeight(row.competitionId);
    if (winner?.country) points.set(winner.country, (points.get(winner.country) || 0) + weight * 7);
    if (runner?.country) points.set(runner.country, (points.get(runner.country) || 0) + weight * 3.2);
  }
  return points;
}

function updateCountryFinancePools(state) {
  initializeCountryFinance(state);
  const elapsed = state.season - START_SEASON;
  const continentalMomentum = buildCountryContinentalMomentumMap(state, 6);
  for (const league of LEAGUE_DEFINITIONS) {
    const record = state.countryFinance[league.country];
    const profile = countryFinanceProfile(league.country);
    const cycle = Math.sin(elapsed / 5.4 + (record.phase || 0)) * profile.amplitude;
    const momentum = Math.min(profile.amplitude * 1.35, (continentalMomentum.get(league.country) || 0) * 0.72);
    const eraBonus = leagueEraEconomicBonus(state, league, state.season + 1);
    const target = clamp((record.basePool || profile.base) + cycle + momentum + eraBonus, profile.min, profile.max + eraBonus);
    record.pool = Number((record.pool * 0.82 + target * 0.18).toFixed(1));
    record.updatedSeason = state.season + 1;
  }
}

function refreshClubFinancesFromPools(state) {
  for (const league of LEAGUE_DEFINITIONS) {
    const allocations = clubCountryAllocationMap(state, league.country);
    for (const club of (state.clubs || []).filter((item)=>item.country===league.country)) {
      const share = allocations.get(club.id) || countryPool(state, league.country) * 0.015;
      club.annualFinanceShare = Number(share.toFixed(1));
      const ownerFactor = club.ownerMoneyMultiplier || 1;
      const operatingCost = Math.max(2, (club.wageBudget || share * 0.2) * 0.58);
      // Transfer-sale windfalls remain in cash, but recurring wealth comes from the country's
      // pool and the club's institutional bucket. Cash naturally burns down if the owner leaves.
      const owner = (state.owners || []).find((item) => item.id === club.ownerId && item.status !== 'retired');
      const ownerInjection = ownerAnnualCashInjection(owner);
      club.ownerAnnualInjection = ownerInjection;
      club.finances = clamp(Math.round(club.finances * 0.72 + share * ownerFactor + ownerInjection - operatingCost), 3, 1100);
      club.wageBudget = Number(Math.max(1.2, share * 0.24 * Math.min(1.35, ownerFactor)).toFixed(1));
      club.transferBudget = Math.max(2, Math.round(Math.min(club.finances * 0.58, share * (0.72 + Math.max(0, ownerFactor - 1) * 0.9) + ownerInjection * 0.72 + club.finances * 0.12)));
    }
  }
}

function buildClubPayrollMap(state) {
  const map = new Map();
  for (const player of state.players || []) {
    if (player.status !== 'active' || !player.clubId) continue;
    let item = map.get(player.clubId);
    if (!item) { item = { bill: 0, players: [] }; map.set(player.clubId, item); }
    item.bill += Number(player.salary || 0);
    item.players.push(player);
  }
  return map;
}

function clubPayrollLimit(club) {
  if (!club) return 0;
  const institutionalFloor = Math.max(1, Number(club.payrollAnchor || 1)) * 1.04;
  const operatingCapacity = Math.max(1.2, Number(club.wageBudget || 1.2)) * 1.02;
  return Number(Math.max(institutionalFloor, operatingCapacity).toFixed(2));
}

function salaryOfferFor(state, player, buyer, kind = 'transfer') {
  const roll = stableStringRoll(`${state.season}:${player.id}:${buyer?.id || 'free'}:${kind}:salary`);
  const baseRate = kind === 'renewal' ? 0.052 : kind === 'free' ? 0.058 : 0.057;
  const elitePremium = player.rarity === 'generational' ? 0.014 : player.rarity === 'legend' ? 0.009 : player.rarity === 'epic' ? 0.004 : 0;
  return Number(Math.max(0.25, Number(player.marketValue || 0) * (baseRate + elitePremium + roll * 0.012)).toFixed(1));
}

function rosterPayroll(players = []) {
  return players.reduce((sum, player) => sum + Number(player.salary || 0), 0);
}

function canClubCarrySalary(club, currentBill, incomingSalary, outgoingSalary = 0, tolerance = 1.0) {
  const projected = Math.max(0, Number(currentBill || 0) - Number(outgoingSalary || 0)) + Number(incomingSalary || 0);
  return projected <= clubPayrollLimit(club) * tolerance;
}

function recalculateClubPayrollPressure(state, clubIds = null) {
  const selected = clubIds ? new Set(clubIds) : null;
  const payroll = selected ? new Map([...selected].map((id) => [id, { bill: 0, players: [] }])) : buildClubPayrollMap(state);
  if (selected) {
    const cache = RUNTIME_CACHE.get(state);
    if (cache) {
      for (const id of selected) {
        for (const player of cache.clubPlayers.get(id) || []) {
          if (player.status === 'active' && player.clubId === id) payroll.get(id).bill += Number(player.salary || 0);
        }
      }
    } else {
      for (const player of state.players || []) {
        if (player.status !== 'active' || !player.clubId || !selected.has(player.clubId)) continue;
        payroll.get(player.clubId).bill += Number(player.salary || 0);
      }
    }
  }
  for (const club of state.clubs || []) {
    if (selected && !selected.has(club.id)) continue;
    const bill = payroll.get(club.id)?.bill || 0;
    club.payrollPressureRatio = Number((bill / Math.max(1, club.payrollAnchor || bill || 1)).toFixed(3));
    club.currentPayroll = Number(bill.toFixed(1));
    club.payrollLimit = clubPayrollLimit(club);
  }
}

function initializePayrollAnchors(state) {
  const payroll = buildClubPayrollMap(state);
  for (const club of state.clubs || []) {
    const bill = payroll.get(club.id)?.bill || 0;
    if (!Number.isFinite(club.payrollAnchor) || club.payrollAnchor <= 0) club.payrollAnchor = Math.max(1, Number(bill.toFixed(1)));
    club.payrollPressureRatio = Number((bill / Math.max(1, club.payrollAnchor)).toFixed(3));
    club.currentPayroll = Number(bill.toFixed(1));
    club.payrollLimit = clubPayrollLimit(club);
    club.lastSalaryRisePct ||= 0;
  }
}

function buildClubAchievementScoreMap(state, earliestSeason = state.season - 3) {
  const scores = new Map();
  const key = (season, clubId) => `${season}::${clubId}`;
  for (const finish of state.history?.clubSeasons || []) {
    if (finish.season < earliestSeason) continue;
    let value = 0;
    if (finish.position === 1) value = 3.4;
    else if (finish.position === 2) value = 1.15;
    else if (finish.position <= 4) value = 0.45;
    if (value) scores.set(key(finish.season, finish.clubId), (scores.get(key(finish.season, finish.clubId)) || 0) + value);
  }
  const leagueIds = new Set(LEAGUE_DEFINITIONS.map((league) => league.id));
  for (const row of state.history?.champions || []) {
    if (row.season < earliestSeason) continue;
    const id = row.competitionId;
    let winnerScore = 0, runnerScore = 0;
    if (id === 'UCL') { winnerScore = 5.0; runnerScore = 2.2; }
    else if (id === 'CWC') { winnerScore = 4.5; runnerScore = 1.65; }
    else if (id === 'LIB') { winnerScore = 4.0; runnerScore = 1.65; }
    else if (['UEL','CCC','ACL','CAFCL','OCL'].includes(id)) { winnerScore = 2.8; runnerScore = 0.9; }
    else if (id === 'UECL' || id === 'SUD') { winnerScore = 2.2; runnerScore = 0.9; }
    else if (leagueIds.has(id)) winnerScore = 0.4;
    else if (id.startsWith('CUP-')) winnerScore = 1.35;
    else if (id.startsWith('SC-') || id === 'SUPERCUP' || id === 'ICUP') winnerScore = 0.55;
    if (row.winnerId && winnerScore) scores.set(key(row.season, row.winnerId), (scores.get(key(row.season, row.winnerId)) || 0) + winnerScore);
    if (row.runnerUpId && runnerScore) scores.set(key(row.season, row.runnerUpId), (scores.get(key(row.season, row.runnerUpId)) || 0) + runnerScore);
  }
  return scores;
}

function applyDynastySalaryPressure(state) {
  state.pendingPayrollChanges ||= [];
  initializePayrollAnchors(state);
  const payroll = buildClubPayrollMap(state);
  const achievementScores = buildClubAchievementScoreMap(state, state.season - 3);
  for (const club of state.clubs || []) {
    if (club.division !== 1) continue;
    club.payrollAnchor = Number(Math.max(1, club.payrollAnchor * 1.018).toFixed(2));
    const scores = [0,1,2,3].map((ago) => achievementScores.get(`${state.season - ago}::${club.id}`) || 0);
    const current = scores[0];
    const item = payroll.get(club.id) || { bill: 0, players: [] };
    if (current < 3.0) {
      club.payrollPressureRatio = Number((item.bill / Math.max(1, club.payrollAnchor)).toFixed(3));
      club.lastSalaryRisePct = 0;
      continue;
    }
    const good3 = scores.slice(0,3).filter((value) => value >= 3.0).length;
    const good4 = scores.filter((value) => value >= 3.0).length;
    const consecutive3 = scores.slice(0,3).every((value) => value >= 3.0);
    let rise = 0.08;
    if (good3 >= 2) rise = 0.14;
    if (good4 >= 3) rise = 0.23;
    if (consecutive3) rise = 0.28;
    const before = item.bill;
    let after = 0;
    for (const player of item.players) {
      const loyaltyPremium = ['common','uncommon'].includes(player.rarity) ? 1.025 : 1;
      const marketCeiling = Math.max(0.3, Number(player.marketValue || 0) * 0.12);
      player.salary = Number(Math.min(marketCeiling, Math.max(0.2, Number(player.salary || 0.2) * (1 + rise) * loyaltyPremium)).toFixed(1));
      after += player.salary;
    }
    club.lastSalaryRisePct = Math.round(rise * 100);
    club.payrollPressureRatio = Number((after / Math.max(1, club.payrollAnchor)).toFixed(3));
    state.pendingPayrollChanges.push({
      season: state.season + 1, clubId: club.id, achievementScore: Number(current.toFixed(1)),
      goodSeasonsLast3: good3, goodSeasonsLast4: good4, risePct: Math.round(rise * 100),
      wageBefore: Number(before.toFixed(1)), wageAfter: Number(after.toFixed(1)), pressure: club.payrollPressureRatio
    });
  }
}

function applyPayrollBudgetConstraints(state) {
  const payroll = buildClubPayrollMap(state);
  for (const club of state.clubs || []) {
    const item = payroll.get(club.id) || { bill: 0, players: [] };
    const anchor = Math.max(1, club.payrollAnchor || item.bill || 1);
    const pressure = item.bill / anchor;
    club.payrollPressureRatio = Number(pressure.toFixed(3));
    club.currentPayroll = Number(item.bill.toFixed(1));
    club.payrollLimit = clubPayrollLimit(club);
    if (pressure <= 1.06) continue;
    const budgetFactor = clamp(1 - (pressure - 1.02) * 1.35, 0.06, 0.92);
    club.transferBudget = Number(Math.max(0.5, club.transferBudget * budgetFactor).toFixed(1));
    if (pressure >= 1.20) {
      for (const player of item.players) {
        if (STAR_RARITIES[player.rarity]?.rank >= STAR_RARITIES.rare.rank && player.rating >= 78) {
          player.happiness = Math.max(5, (player.happiness ?? 60) - Math.round((pressure - 1) * 24));
          player.payrollSalePressure = Number(Math.max(0, pressure - 1).toFixed(2));
        }
      }
    }
  }
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
    if (!staff.formation) ensureCoachFormation(staff, random(state), random(state));
  }
  return staff;
}


function ownerTermYears(state) {
  // Presidents/owners are eras, not permanent club attributes. Most projects last
  // 6-9 years; short 4-5 year experiments and 10-12 year dynasties remain possible.
  const roll = random(state);
  if (roll < 0.22) return randomInt(state, 4, 5);
  if (roll < 0.72) return randomInt(state, 6, 9);
  return randomInt(state, 10, 12);
}

function ownerAnnualCashInjection(owner) {
  if (!owner) return 0;
  const rank = STAFF_RARITIES[owner.rarity]?.rank || 1;
  if (owner.profile === 'billionaire') {
    const amounts = { 1: 8, 2: 16, 3: 35, 4: 65, 5: 100, 6: 125 };
    return amounts[rank] || 8;
  }
  if (owner.profile === 'consortium') {
    const amounts = { 1: 5, 2: 10, 3: 22, 4: 38, 5: 58, 6: 78 };
    return amounts[rank] || 5;
  }
  if (owner.profile === 'celebrity') return Math.max(0, (rank - 1) * 5);
  if (owner.profile === 'businessman') return Math.max(0, (rank - 1) * 3);
  return 0;
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
  club.ownerAnnualInjection = ownerAnnualCashInjection(owner);
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
    owner.status = 'retired';
    owner.departureSeason = state.season;
    owner.departureSeasonLabel = formatSeason(state.season);
    const nationality = COUNTRY_TO_CODE[club.country] || 'eng';
    const replacement = createStaffMember(state, 'owner', nationality, {
      clubId: club.id,
      yearsRemaining: ownerTermYears(state),
      appointmentSeason: state.season + 1,
      seasonsInRole: 0
    });
    state.owners.push(replacement);
    applyOwnerToClub(state, replacement, club, true);
    state.pendingOwnerChanges.push({
      season: state.season + 1,
      clubId: club.id,
      formerOwnerId: owner.id,
      ownerId: replacement.id,
      major: (club.reputation || 0) >= 80
    });
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

function playerGeographyWeight(state, player, club) {
  const origin = teamById(player.nationality);
  let weight = countryAffinity(origin?.name, club.country, origin?.region, club.confederation);
  if (club.country === origin?.name) weight *= ['common', 'uncommon', 'rare'].includes(player.rarity) ? 3 : 1.3;
  // Established overseas players can remain in their adopted league.
  const residence = getClub(state, player.clubId)?.country;
  if (residence === club.country && residence !== origin?.name) weight = Math.max(weight, 6);
  if (playerCareerStage(state, player) === 'late' && ['epic', 'legend', 'generational'].includes(player.rarity)
    && ['United States', 'Mexico', 'Japan', 'Australia', 'Saudi Arabia'].includes(club.country)) weight = Math.max(weight, 2.5);
  return weight;
}

function recruitmentDestinationAllowed(state, player, club) {
  if (['epic', 'legend', 'generational'].includes(player.rarity)) return true;
  const origin = teamById(player.nationality);
  const residence = getClub(state, player.clubId)?.country;
  if (club.country === origin?.name || club.country === residence) return true;
  const roll = stableStringRoll(`${state.season}:${state.seed}:mobility:${player.id}`);
  if (roll < domesticMobilityChance(player.rarity)) return false;
  const globalChance = player.rarity === 'rare' ? 0.05 : 0.02;
  return roll >= 1 - globalChance || countryAffinity(origin?.name, club.country, origin?.region, club.confederation) >= 2;
}

function geographicClubPick(state, clubs, player, sportingWeight) {
  // A continent with hundreds of clubs must not drown out a smaller home league.
  const countryCounts = new Map();
  for (const club of clubs) countryCounts.set(club.country, (countryCounts.get(club.country) || 0) + 1);
  const domestic = clubs.filter((club) => club.country === teamById(player.nationality)?.name);
  const pool = domestic.length && random(state) < domesticMobilityChance(player.rarity) ? domestic : clubs;
  return weightedPick(state, pool, (club) => sportingWeight(club) * playerGeographyWeight(state, player, club) / countryCounts.get(club.country));
}

function chooseRookieDestination(state, clubs, player) {
  const eliteChance = player.rarity === 'generational' ? 0.22 : player.rarity === 'legend' ? 0.17 : player.rarity === 'epic' ? 0.13 : 0.04;
  const eliteDestination = random(state) < eliteChance;
  const nationName = teamById(player.nationality)?.name;
  const originRegion = teamById(player.nationality)?.region;
  const topDivision = clubs.filter((club) => club.division === 1);
  const domestic = nationName ? topDivision.filter((club) => club.country === nationName) : [];
  const related = topDivision.filter((club) => club.country !== nationName
    && countryAffinity(nationName, club.country, originRegion, club.confederation) >= 2);
  const globalForeign = topDivision.filter((club) => club.country !== nationName);

  // Almost every player starts at home. Exceptions favor nearby or culturally
  // connected academies, with a very small unrestricted global tail.
  let geographicPool = domestic;
  const roll = random(state);
  if (!domestic.length) geographicPool = related.length ? related : topDivision;
  else if (roll >= 0.90 && roll < 0.995 && related.length) geographicPool = related;
  else if (roll >= 0.995 && globalForeign.length) geographicPool = globalForeign;

  const band = geographicPool.filter((club) => eliteDestination ? club.reputation >= 80 : club.reputation < 84);
  const candidates = band.length ? band : geographicPool;
  return geographicClubPick(state, candidates, player, (club) => rookieClubWeight(player, club, eliteDestination)) || null;
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
  player.spawnClubId = target.id;
  player.clubJoinedSeason = player.debutSeason;
  if (swap) swap.clubId = oldClubId;
}

function createClubsAndPlayers(state) {
  const clubs = [];
  const playerSlots = [];
  for (const league of LEAGUE_DEFINITIONS) {
    league.clubs.forEach(([id, name, city, strength], index) => {
      const division = league.tier === 'detailed' && index >= league.activeCount ? 2 : 1;
      const financialTier = initialClubFinancialTier(league, id, index);
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
        financialTier,
        financialTierSince: state.season,
        finances: 10,
        transferBudget: 3,
        wageBudget: 2,
        annualFinanceShare: 0,
        reputation: HISTORICAL_CLUB_REPUTATION[id] ?? strength,
        ownerId: null,
        coachId: null,
        crestHue: Math.abs([...id].reduce((sum, char) => sum + char.charCodeAt(0) * 7, 0)) % 360
      };
      clubs.push(club);
      const count = division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[league.tier];
      const blueprint = count >= SQUAD_SIZE ? SQUAD_BLUEPRINT : SMALL_CORE_BLUEPRINT;
      for (let slot = 0; slot < count; slot += 1) {
        // Within a club the first seven slots are the core, the next four the rest of
        // the XI and the last four the bench, so squads have a natural quality gradient.
        const gradient = slot < 7 ? 0 : slot < 11 ? 2.5 : 5;
        playerSlots.push({ club, position: blueprint[slot % blueprint.length], roleOptions: count >= SQUAD_SIZE ? SQUAD_ROLE_HINTS[slot] : null, priority: strength - gradient + (random(state) - 0.5) * 3 });
      }
    });
  }
  const deck = initialRarityDeck(state, playerSlots.length);
  const rarityRank = (rarity) => STAR_RARITIES[rarity].rank;
  const orderedSlots = [...playerSlots].sort((a, b) => b.priority - a.priority);
  const orderedRarities = [...deck].sort((a, b) => rarityRank(b) - rarityRank(a));
  const players = orderedSlots.map((slot, index) => createPlayer(state, {
    club: slot.club,
    position: slot.position,
    rarity: orderedRarities[index],
    roleOptions: slot.roleOptions
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
  // Seed the first economy from country pools and institutional tiers before owners modify it.
  const priorClubs = state.clubs;
  state.clubs = clubs;
  seedClubFinanceFromPools(state);
  state.clubs = priorClubs;
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
  const plannedRarity = new Array(coachCount).fill(null);
  for (const [rarity, count] of Object.entries(COACH_RARITY_TARGETS)) {
    const weights = COACH_NATION_WEIGHTS[rarity];
    for (let made = 0; made < count; made += 1) {
      const open = [];
      for (let index = 0; index < coachCount; index += 1) if (!plannedRarity[index]) open.push(index);
      const chosen = weightedPick(state, open, (index) => weights[nationTier(jobNationalities[index % jobNationalities.length])] || 0.5);
      if (chosen === undefined || chosen === null) break;
      plannedRarity[chosen] = rarity;
    }
  }
  for (let index = 0; index < coachCount; index += 1) {
    coaches.push(createStaffMember(state, 'coach', jobNationalities[index % jobNationalities.length], { rarity: plannedRarity[index] || ordinaryCoachRarity(state) }));
  }

  // Federations choose first, preserving a strong domestic identity for elite nations.
  const available = [...coaches];
  const nationalAssignments = [...state.nationalTeams].sort((a, b) => b.strength - a.strength);
  for (const team of nationalAssignments) {
    let domestic = available.filter((coach) => coach.nationality === team.id && nationalCoachCandidateAllowed(team, coach));
    if (!domestic.length) {
      const generated = createStaffMember(state, 'coach', team.id, { rarity: team.tier === 1 ? 'rare' : team.tier === 2 ? 'uncommon' : 'common', careerYear: randomInt(state, 1, 4) });
      coaches.push(generated);
      available.push(generated);
      domestic = [generated];
    }
    const useDomestic = random(state) < nationalCoachDomesticPreference(team);
    const eligibleAvailable = available.filter((coach) => nationalCoachCandidateAllowed(team, coach));
    const pool = useDomestic ? domestic : (eligibleAvailable.length ? eligibleAvailable : domestic);
    const coach = [...pool].sort((a, b) => {
      const aFit = a.quality + nationalCoachRarityFit(team, a) + (a.nationality === team.id ? 9 + team.tier * -0.7 : 0);
      const bFit = b.quality + nationalCoachRarityFit(team, b) + (b.nationality === team.id ? 9 + team.tier * -0.7 : 0);
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
    const useDomestic = domestic.length && random(state) < initialClubCoachDomesticPreference(club);
    const pool = useDomestic ? domestic : available;
    const coach = [...pool].sort((a, b) => b.quality - a.quality)[0];
    available.splice(available.indexOf(coach), 1);
    assignCoachToClub(state, coach, club);
  }
  state.owners = owners;
  state.coaches = coaches;
  state.targetActiveCoaches = coaches.length;
  state.coachRarityTargets = coachTargetsFor(coaches.length);
  void coaches.reduce((counts, coach) => {
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

// National-team ranking for seeding: squad strength plus recent results (titles and
// finals in major tournaments over the last eight seasons, fading with age).
const MAJOR_INTERNATIONAL_IDS = new Set(['WC', 'EURO', 'COPA', 'AFCON', 'ASIACUP', 'GOLDCUP', 'OFC']);
export function getNationalTeamRanking(state, ids = NATIONAL_TEAMS.map((team) => team.id)) {
  const recent = new Map();
  for (const row of state.history?.champions || []) {
    if (!MAJOR_INTERNATIONAL_IDS.has(row.competitionId) || row.season < state.season - 8) continue;
    const fade = 1 - (state.season - row.season) / 10;
    const weight = row.competitionId === 'WC' ? 1.5 : 1;
    recent.set(row.winnerId, (recent.get(row.winnerId) || 0) + 3 * weight * fade);
    if (row.runnerUpId) recent.set(row.runnerUpId, (recent.get(row.runnerUpId) || 0) + 1.5 * weight * fade);
  }
  return ids.map((id) => {
    const strength = calculateTeamStrength(state, id, true);
    const form = Math.min(6, recent.get(id) || 0);
    return { id, strength: Number(strength.toFixed(1)), form: Number(form.toFixed(1)), score: Number((strength + form).toFixed(2)) };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

// Seeded draw: pot 1 holds the strongest teams by ranking, one per group, then pots 2, 3, 4.
// Within a pot the order is drawn at random; limits (World Cup confederations) are
// respected where the draw allows, otherwise the team goes to any open group.
function seededGroups(state, ids, groupCount, { limits = null } = {}) {
  const ranking = getNationalTeamRanking(state, ids);
  const pots = [];
  for (let index = 0; index < ranking.length; index += groupCount) pots.push(ranking.slice(index, index + groupCount).map((row) => row.id));
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: String.fromCharCode(65 + (index % 26)) + (index >= 26 ? String(Math.floor(index / 26) + 1) : ''),
    teamIds: [],
    table: [],
    rounds: []
  }));
  const regionOf = (id) => teamById(id)?.region || 'World';
  for (const pot of pots) {
    const filled = new Set();
    for (const id of shuffle(state, pot)) {
      const open = shuffle(state, groups.filter((group) => !filled.has(group.id)));
      const allowed = limits ? open.find((group) => group.teamIds.filter((other) => regionOf(other) === regionOf(id)).length < (limits[regionOf(id)] || 1)) : null;
      const group = allowed || open[0];
      group.teamIds.push(id);
      filled.add(group.id);
    }
  }
  groups.forEach((group) => {
    group.table = makeTable(group.teamIds);
    group.rounds = roundRobin(group.teamIds, false);
  });
  return { groups, draw: { pots, ranking: ranking.map((row) => ({ id: row.id, score: row.score, strength: row.strength, form: row.form })) } };
}

function latestLeaguePosition(state, clubId) {
  return getHistoricalIndexes(state).latestLeaguePositions.get(clubId) ?? null;
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
    const active = state.clubs.filter((club) => club.leagueId === league.id).map((club) => club.id);
    const initialDraw = league.tier === 'summary' ? { pairs: [], byes: [] } : drawCupRoundPairs(state, active);
    domesticCups[cupId] = {
      id: cupId,
      leagueId: league.id,
      country: league.country,
      tier: league.tier,
      name: league.cupName,
      active,
      nextPairs: initialDraw.pairs,
      nextByes: initialDraw.byes,
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
      nextPairs: pairTeams(state, active),
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
  // A format applies only when the field has its exact size (the World Cup's arrives after qualifying).
  const format = kind === 'finals' && INTERNATIONAL_FORMATS[id] && ids.length === INTERNATIONAL_FORMATS[id].groups * INTERNATIONAL_FORMATS[id].groupSize ? INTERNATIONAL_FORMATS[id] : null;
  const groupCount = ids.length ? (format && ids.length === format.groups * format.groupSize ? format.groups : Math.max(1, Math.ceil(ids.length / groupSize))) : 0;
  const seeded = groupCount ? seededGroups(state, ids, groupCount, { limits: id === 'WC' ? WORLD_CUP_GROUP_LIMITS : null }) : null;
  return {
    id,
    name: INTERNATIONAL_COMPETITION_NAMES[id] || id,
    format,
    draw: seeded?.draw || null,
    kind,
    confederation,
    friendly,
    scheduled,
    editionYear,
    groupSize,
    groupWeeks,
    knockoutWeeks,
    stage: scheduled ? 'Scheduled' : friendly ? 'Friendlies' : kind === 'qualifier' ? 'Qualifying' : 'Group Stage',
    groups: seeded?.groups || [],
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
  return (getHistoricalIndexes(state).worldRankingPoints.get(club.id) || 0) + (club.reputation || 60) * 1.5 + (club.strength || 60);
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
      const format = INTERNATIONAL_FORMATS[id];
      competitions[id] = makeInternationalCompetition(state, {
        id, ids, groupSize: format?.groupSize || (ids.length <= 10 ? 5 : 4), kind: 'finals', confederation: region,
        groupWeeks: format?.groupWeeks || [44, 45, 46], knockoutWeeks: [47, 48, 49, 50], editionYear: state.season + 1
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
    discipline: {},
    bans: {},
    lightApps: {},
    matches: [],
    transfers: [],
    staffMoves: [],
    newStars: [...(state.pendingSeasonStars || [])],
    youthIntake: [],
    newCoaches: [...(state.pendingSeasonCoaches || [])],
    retirements: [...(state.pendingSeasonRetirements || [])],
    contractExits: [...(state.pendingContractExits || [])],
    loanReturns: [...(state.pendingLoanReturns || [])],
    ownerChanges: [...(state.pendingOwnerChanges || [])],
    payrollChanges: [...(state.pendingPayrollChanges || [])],
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
    postseason: {
      selections: { ...(state.showcasePreferences || {}) },
      prepared: false,
      phase: 'setup',
      showcaseMatches: [],
      awards: [],
      awardActiveIndex: 0,
      completed: false
    },
    completed: false
  };
}

export function createWorld(seed = Date.now() % 2147483647) {
  const state = {
    version: 4,
    dataRevision: 35,
    seed,
    rngSeed: seed >>> 0,
    nextPlayerId: 1,
    nextStaffId: 1,
    nextTransferId: 1,
    season: START_SEASON,
    countryFinance: {},
    leagueEras: {},
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
    showcasePreferences: {},
    predictions: { current: null, history: [] },
    pendingPayrollChanges: [],
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
      leagueMovements: [],
      hallOfFamePlayers: [],
      clubLegends: [],
      clubPowerRankings: [],
      leaguePowerRankings: [],
      leagueEras: [],
      news: [],
      postseasons: [],
      shootouts: []
    },
    preferences: {
      favoriteClubIds: ['real-madrid'],
      favoritePlayerIds: [],
      favoriteCoachIds: [],
      favoriteNationIds: [],
      favoriteCompetitionIds: ['UCL'],
      autoStopFinals: true
    }
  };
  initializeCountryFinance(state);
  initializeLeagueEras(state);
  const entities = createClubsAndPlayers(state);
  state.clubs = entities.clubs;
  state.players = entities.players;
  initializeStaff(state);
  seedEliteAcademies(state, () => random(state));
  refreshAllMarketValues(state);
  state.current = newCurrentSeason(state);
  state.pendingSeasonStars = [];
  state.pendingSeasonCoaches = [];
  state.pendingSeasonRetirements = [];
  state.pendingOwnerChanges = [];
  runTransferMarket(state, true);
  ensureClubRosters(state);
  initializePayrollAnchors(state);
  addPreseasonMagazine(state);
  invalidateRuntimeCache(state);
  refreshAllClubStrengths(state);
  assignAllCaptains(state);
  ensureCareerCounters(state);
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
  const cache = getRuntimeCache(state);
  const coachId = isInternational ? cache.nationalById.get(teamId)?.coachId : cache.clubById.get(teamId)?.coachId;
  if (!coachId) return null;
  // Coaches created after the cache was built are still found by id.
  return cache.coachById.get(coachId) || state.coaches?.find((coach) => coach.id === coachId) || null;
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

function initialClubCoachDomesticPreference(club) {
  if (club?.tier === 'summary') return 0.90;
  if ((club?.reputation || 0) >= 88) return 0.74;
  return 0.84;
}

function coachLateCareer(coach) {
  return (coach?.careerYear || 0) >= Math.max(5, Math.floor((coach?.careerLength || 12) * 0.68));
}

function nationalCoachCandidateAllowed(team, coach) {
  if (!coach || coach.status === 'retired') return false;
  const rank = STAFF_RARITIES[coach.rarity]?.rank || 1;
  const late = coachLateCareer(coach);
  // Generational and Legendary coaches normally spend their primes in club football.
  if (rank >= STAFF_RARITIES.legend.rank && !late) return false;
  if (team.tier === 1) return coach.rarity === 'epic' || coach.rarity === 'rare' || coach.rarity === 'uncommon' || coach.rarity === 'common' || late;
  if (team.tier === 2) return coach.rarity !== 'generational' || late;
  if (team.tier === 3) return !['generational','legend'].includes(coach.rarity) || late;
  return !['generational','legend','epic'].includes(coach.rarity) || late;
}

function nationalCoachRarityFit(team, coach) {
  const target = team.tier === 1 ? { epic: 8, rare: 5, uncommon: 2, common: 0, legend: 4, generational: 3 }
    : team.tier === 2 ? { epic: 5, rare: 7, uncommon: 4, common: 1, legend: 2, generational: 1 }
      : team.tier === 3 ? { epic: 2, rare: 7, uncommon: 7, common: 4, legend: 1, generational: 0 }
        : { epic: 0, rare: 4, uncommon: 7, common: 8, legend: 0, generational: 0 };
  return target[coach.rarity] ?? 0;
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
  ensureCoachFormation(coach);
  RUNTIME_CACHE.get(state)?.clubSquads.delete(club.id);
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
  ensureCoachFormation(coach);
  RUNTIME_CACHE.get(state)?.nationalSquads.delete(team.id);
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

// Title fatigue (deliberate, for a world that stays fun to follow): a side that has won
// the same competition in consecutive seasons plays it under growing pressure. Two in a
// row is a small handicap, three a clear one, four or more makes another title very
// unlikely; three or four titles in the last six seasons count the same way. Leagues feel it at 40 % strength because they run over a whole season.
const TITLE_FATIGUE = [0, 0, 1.5, 4, 9];
const TITLE_STREAK_CACHE = new WeakMap();
function titleStreaks(state) {
  const champions = state.history?.champions || [];
  const cached = TITLE_STREAK_CACHE.get(state);
  if (cached && cached.season === state.season && cached.count === champions.length) return cached.streaks;
  const bySeason = new Map();
  for (const row of champions) {
    if (row.season >= state.season || !row.winnerId) continue;
    bySeason.set(`${row.competitionId}:${row.season}`, row.winnerId);
  }
  // Streak = consecutive titles up to last season; titles in the last six seasons count
  // too (three of six like three in a row), so alternate-year dynasties feel it as well.
  const streaks = new Map();
  for (const row of champions) {
    if (row.season >= state.season || row.season < state.season - 6 || !row.winnerId) continue;
    const key = `${row.competitionId}:${row.winnerId}`;
    if (streaks.has(key)) continue;
    let consecutive = 0;
    while (bySeason.get(`${row.competitionId}:${state.season - 1 - consecutive}`) === row.winnerId) consecutive += 1;
    let recent = 0;
    for (let season = state.season - 6; season < state.season; season += 1) if (bySeason.get(`${row.competitionId}:${season}`) === row.winnerId) recent += 1;
    streaks.set(key, Math.max(consecutive, recent >= 3 ? recent : 0));
  }
  TITLE_STREAK_CACHE.set(state, { season: state.season, count: champions.length, streaks });
  return streaks;
}

function titleFatigue(state, teamId, competitionId) {
  if (!competitionId) return 0;
  const streak = titleStreaks(state).get(`${competitionId}:${teamId}`) || 0;
  if (streak < 2) return 0;
  const value = TITLE_FATIGUE[Math.min(streak, TITLE_FATIGUE.length - 1)];
  return state.current?.leagues?.[competitionId] ? value * 0.4 : value;
}

function continentalDynastyPressure(state, teamId, competitionId) {
  const definition = CONTINENTAL_DEFINITIONS.find((item) => item.id === competitionId);
  if (!definition || definition.level !== 1) return 0;
  const titles = getRuntimeCache(state).recentContinentalTitles.get(teamId) || 0;
  if (titles <= 1) return titles * 1.8;
  // Defending one title is difficult but normal. Repeated wins in the same four-year
  // cycle bring wage strain, tactical exposure and a shorter summer into the match
  // model. The pressure fully decays, allowing the same giant to build a later age.
  // (v4: deeper squads protect giants from injuries, so the pressure is a little stronger.)
  return Math.min(12.0, 1.8 + (titles - 1) * 4.2);
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

function topNamedAverage(players, count = 7) {
  const top = [...players].sort((a, b) => b.rating - a.rating).slice(0, count);
  return top.length ? top.reduce((sum, player) => sum + player.rating, 0) / top.length : 0;
}

// Every coach has a preferred shape and a fallback, linked to their tactical style.
function ensureCoachFormation(coach, roll1 = null, roll2 = null) {
  if (!coach) return;
  if (coach.formation && FORMATIONS[coach.formation] && coach.secondaryFormation && FORMATIONS[coach.secondaryFormation]) return;
  const choice = chooseCoachFormations(coach.profile,
    roll1 ?? stableStringRoll(`${coach.id}:formation`),
    roll2 ?? stableStringRoll(`${coach.id}:formation-second`));
  coach.formation = choice.primary;
  coach.secondaryFormation = choice.secondary;
}

function coachFormationPair(coach) {
  if (!coach) return { primary: '4-4-2', secondary: '4-3-3' };
  ensureCoachFormation(coach);
  return { primary: coach.formation, secondary: coach.secondaryFormation };
}

// Matchday squad of 15 for a club or nation: the coach's formation decides the XI,
// then the best four remaining players (a reserve goalkeeper first) form the bench.
// Teams without 15 named players are completed with unnamed depth ratings.
// options.unavailable (Set of ids), options.fitness (Map id → fitness) and
// options.bias (player → rating adjustment for rotation) shape a matchday squad.
function buildTeamSquad(players, depthKey, depthStrength, coach, options = {}) {
  const byPosition = { GK: [], DF: [], MF: [], FW: [] };
  const unavailable = options.unavailable;
  for (const player of players) {
    if (player.status !== 'active' || !byPosition[player.position]) continue;
    if (unavailable?.has(player.id)) continue;
    byPosition[player.position].push(player);
  }
  for (const list of Object.values(byPosition)) list.sort((a, b) => b.rating - a.rating);
  let candidates = [...byPosition.GK.slice(0, 3), ...byPosition.DF.slice(0, 8), ...byPosition.MF.slice(0, 8), ...byPosition.FW.slice(0, 6)];
  const { primary, secondary } = coachFormationPair(coach);
  if (candidates.length < SQUAD_SIZE) {
    // Unnamed reserves follow the coach's squad shape.
    candidates = [...candidates, ...depthPlayers(depthKey, depthStrength, candidates, SQUAD_SIZE, stableStringRoll, squadTargetForFormation(primary))];
  }
  const backupPenalty = coach?.profile === 'adaptive' ? BACKUP_SYSTEM_PENALTY_ADAPTIVE : BACKUP_SYSTEM_PENALTY;
  const choiceOptions = { backupPenalty };
  if (options.fitness) choiceOptions.fitness = options.fitness;
  if (options.bias) choiceOptions.bias = options.bias;
  const choice = chooseMatchFormation(candidates, primary, secondary, choiceOptions);
  const xi = choice.selection.xi;
  const used = new Set(xi.map((row) => row.player));
  const remaining = candidates.filter((player) => !used.has(player)).sort((a, b) => b.rating - a.rating);
  const bench = [];
  const reserveKeeper = remaining.find((player) => player.position === 'GK');
  if (reserveKeeper) bench.push(reserveKeeper);
  for (const player of remaining) {
    if (bench.length >= SQUAD_SIZE - xi.length) break;
    if (player !== reserveKeeper) bench.push(player);
  }
  const squad = [...xi.map((row) => row.player), ...bench];
  return makeSquadRecord({
    formationId: choice.formationId,
    preferredFormation: primary,
    fit: choice.fit,
    fallback: choice.fallback,
    systemPenalty: choice.systemPenalty || 0,
    xi,
    bench,
    squad
  });
}

// Every squad object has the same fields from the start (one hidden class for the
// hot match path); caches are filled in later.
function makeSquadRecord({ formationId, preferredFormation, fit, fallback, systemPenalty = 0, xi, bench, squad, sources = null, rotated = false, absentStarters = 0 }) {
  return {
    formationId,
    preferredFormation,
    fit,
    fallback,
    systemPenalty,
    xi,
    bench,
    squad,
    named: squad.filter((player) => !player.depth),
    starters: xi.map((row) => row.player).filter((player) => !player.depth),
    sources,
    rotated,
    absentStarters,
    strengthStatic: undefined,
    unitStatic: null,
    reservePool: null,
    lightBench: undefined
  };
}

function getClubSquad(state, clubId) {
  const cache = getRuntimeCache(state);
  let squad = cache.clubSquads.get(clubId);
  if (!squad) {
    const club = cache.clubById.get(clubId);
    squad = buildTeamSquad(cache.clubPlayers.get(clubId) || [], `${clubId}:${state.season}`, club?.strength || 62, getCoach(state, clubId, false));
    cache.clubSquads.set(clubId, squad);
  }
  return squad;
}

function getNationalSquad(state, nationalId) {
  const cache = getRuntimeCache(state);
  let squad = cache.nationalSquads.get(nationalId);
  if (!squad) {
    const team = cache.nationalById.get(nationalId);
    squad = buildTeamSquad(cache.nationalPlayers.get(nationalId) || [], `${nationalId}:${state.season}:nation`, team?.strength || 60, getCoach(state, nationalId, true));
    cache.nationalSquads.set(nationalId, squad);
  }
  return squad;
}

function getTeamSquad(state, teamId, isInternational) {
  return isInternational ? getNationalSquad(state, teamId) : getClubSquad(state, teamId);
}

// Named starters (no depth entries) for a club or nation.
function getClubLineup(state, clubId) {
  return getClubSquad(state, clubId).starters;
}

function getNationalLineup(state, nationalId) {
  return getNationalSquad(state, nationalId).starters;
}

// playerStats is a plain object keyed "player::competition" (that is what saves hold);
// lookups go through a Map index so the hot match loop never builds key strings.
const PLAYER_STAT_INDEX = new WeakMap();
function playerStatIndex(state) {
  const stats = state.current.playerStats;
  let index = PLAYER_STAT_INDEX.get(stats);
  if (!index) {
    index = new Map();
    for (const row of Object.values(stats)) {
      if (!index.has(row.competitionId)) index.set(row.competitionId, new Map());
      index.get(row.competitionId).set(row.playerId, row);
    }
    PLAYER_STAT_INDEX.set(stats, index);
  }
  return index;
}

function ensurePlayerStat(state, playerId, competitionId, teamId, isInternational) {
  const index = playerStatIndex(state);
  let byPlayer = index.get(competitionId);
  if (!byPlayer) { byPlayer = new Map(); index.set(competitionId, byPlayer); }
  const existing = byPlayer.get(playerId);
  if (existing) return existing;
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
  byPlayer.set(playerId, state.current.playerStats[key]);
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
    const rarityFactor = ELITE_TUNING.starRarity[player.rarity] || 0.7;
    return sum + surplus ** 1.17 * 0.105 * rarityFactor * (unitFactors[player.position] || 1);
  }, 0);
  return Math.min(unit === 'overall' ? ELITE_TUNING.starCap : ELITE_TUNING.starCap + 1.2, impact);
}

function addPlayerLog(state, playerId, entry) {
  if (!state.current.playerMatchLogs[playerId]) state.current.playerMatchLogs[playerId] = [];
  state.current.playerMatchLogs[playerId].push(entry);
}

// Formation fit adds or removes up to ~1.5 strength points on top of the effective
// (position-adjusted) ratings already used for the XI.

function teamForm(state, teamId, isInternational) {
  return (isInternational ? getRuntimeCache(state).nationalById.get(teamId)?.form : getClub(state, teamId)?.form) || 0;
}

// Everything in team strength except form is fixed while the squad is (roster,
// coach, owner, payroll and club strength only change between squad rebuilds), so it
// is computed once per squad and form is added on each call.
function staticTeamStrength(state, teamId, isInternational, squad) {
  if (squad.strengthStatic !== undefined) return squad.strengthStatic;
  const lineup = squad.starters;
  const base = isInternational
    ? getRuntimeCache(state).nationalById.get(teamId)?.strength || 62
    : getClub(state, teamId)?.strength || 65;
  if (!squad.xi.length) {
    squad.strengthStatic = base - 5;
    return squad.strengthStatic;
  }
  const tactics = tacticalModifiers(state, teamId, isInternational);
  const values = squad.xi.map((row) => {
    const line = slotLine(row.slotType);
    const defensiveBonus = line === 'GK' || line === 'DF' ? (row.player.depth ? 1 : roleData(row.player).defence) * 0.7 : 0;
    const unitBonus = line === 'FW' ? tactics.attack : line === 'MF' ? tactics.midfield : tactics.defence;
    return (row.effective + defensiveBonus) * unitBonus;
  }).sort((a, b) => b - a);
  // The seven strongest starters set the level; the rest of the XI still counts.
  const core = values.slice(0, 7);
  const rest = values.slice(7);
  const coreAverage = core.reduce((sum, value) => sum + value, 0) / core.length;
  const weighted = rest.length ? coreAverage * 0.7 + (rest.reduce((sum, value) => sum + value, 0) / rest.length) * 0.3 : coreAverage;
  const namedInfluence = isInternational ? Math.min(0.64, 0.27 + lineup.length * 0.052) : Math.min(0.52, 0.34 + lineup.length * 0.025);
  const coachBonus = tactics.coach ? (tactics.coach.quality - 65) * 0.07 : 0;
  const club = isInternational ? null : getClub(state, teamId);
  const ownerBonus = club?.ownerSportingBonus || 0;
  const payrollRatio = club ? Number(club.currentPayroll || 0) / Math.max(1, Number(club.payrollLimit || clubPayrollLimit(club))) : 1;
  const payrollInstability = isInternational ? 0 : Math.min(5.5, Math.max(0, payrollRatio - 1.1) * 2.4);
  const starImpact = starImpactForLineup(lineup, 'overall');
  const captain = club?.captainId ? lineup.find((player) => player.id === club.captainId) : null;
  const leadership = captain && hasTrait(captain, 'leader') ? 0.5 : captain ? 0.15 : 0;
  squad.strengthStatic = leadership + base * (1 - namedInfluence) + weighted * namedInfluence + coachBonus + ownerBonus + starImpact - payrollInstability + formationFitBonus(squad.fit) - (squad.systemPenalty || 0);
  return squad.strengthStatic;
}

function calculateTeamStrength(state, teamId, isInternational, squadOverride = null) {
  const squad = squadOverride || getTeamSquad(state, teamId, isInternational);
  const bounce = isInternational ? 0 : newCoachBounce(state, getClub(state, teamId));
  return staticTeamStrength(state, teamId, isInternational, squad) + (squad.xi.length ? teamForm(state, teamId, isInternational) : 0) + bounce;
}

function calculateUnitStrength(state, teamId, isInternational, unit, baseStrength = null, squadOverride = null) {
  const squad = squadOverride || getTeamSquad(state, teamId, isInternational);
  const base = baseStrength ?? calculateTeamStrength(state, teamId, isInternational, squad);
  if (!squad.xi.length) return base;
  if (!squad.unitStatic) squad.unitStatic = {};
  if (squad.unitStatic[unit] === undefined) {
    const tactics = tacticalModifiers(state, teamId, isInternational);
    const positionSet = unit === 'attack' ? ['FW', 'MF'] : unit === 'midfield' ? ['MF', 'DF'] : ['GK', 'DF'];
    const rows = squad.xi.filter((row) => positionSet.includes(slotLine(row.slotType)));
    const multiplier = unit === 'attack' ? tactics.attack : unit === 'midfield' ? tactics.midfield : tactics.defence;
    squad.unitStatic[unit] = rows.length
      ? { average: rows.reduce((sum, row) => sum + row.effective, 0) / rows.length * 0.47 * multiplier + starImpactForLineup(squad.starters, unit), empty: false }
      : { average: starImpactForLineup(squad.starters, unit), empty: true };
  }
  const cached = squad.unitStatic[unit];
  return cached.empty ? base * 0.53 + base * 0.47 + cached.average : base * 0.53 + cached.average;
}

function matchTeamProfile(state, teamId, isInternational, expectedGoals) {
  const entity = isInternational ? getRuntimeCache(state).nationalById.get(teamId) : getClub(state, teamId);
  const squad = getTeamSquad(state, teamId, isInternational);
  const base = entity?.strength || 70;
  const quality = (position) => {
    const players = squad.xi.filter((row) => slotLine(row.slotType) === position).map((row) => row.effective);
    if (!players.length) return base;
    const average = players.reduce((sum, rating) => sum + rating, 0) / players.length;
    return average * 0.65 + Math.max(...players) * 0.35;
  };
  return { style: entity?.coachProfile, expectedGoals, midfield: quality('MF'), defence: quality('DF'),
    finishing: quality('FW'), goalkeeping: quality('GK') };
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

const MAJOR_TOURNAMENT_IDS = new Set(['WC', 'EURO', 'COPA', 'AFCON', 'ASIACUP', 'GOLDCUP', 'OFC', 'CWC',
  ...CONTINENTAL_DEFINITIONS.filter((definition) => definition.level === 1).map((definition) => definition.id)]);
// Validated favourite ranking per competition object (rank lookups by team id).
const FAVORITE_RANK_CACHE = new WeakMap();

function tournamentFavoriteBonus(state, competitionId, teamId, isInternational, preview = false) {
  if (!MAJOR_TOURNAMENT_IDS.has(competitionId)) return 0;
  const isMajorGlobal = competitionId === 'CWC';
  const competition = isMajorGlobal
    ? state.current.globalClubCompetitions?.[competitionId]
    : isInternational
      ? state.current.internationalCompetitions?.[competitionId]
      : state.current.continentalCompetitions?.[competitionId];
  if (!competition?.groups?.length) return 0;
  let ranks = FAVORITE_RANK_CACHE.get(competition);
  if (!ranks || ranks.groups !== competition.groups || ranks.ranking !== competition.favoriteRanking) {
    const ids = [...new Set(competition.groups.flatMap((group) => group.teamIds || []))];
    if (!ids.length) return 0;
    const stale = !Array.isArray(competition.favoriteRanking) || competition.favoriteRanking.length !== ids.length || competition.favoriteRanking.some((id) => !ids.includes(id));
    // The ranking is fixed the first time a real match needs it. A preview (odds for
    // the UI) must not fix it earlier, or viewing a page would change results.
    if (stale && preview) {
      const ranking = [...ids].sort((a, b) => calculateTeamStrength(state, b, isInternational) - calculateTeamStrength(state, a, isInternational));
      const rank = ranking.indexOf(teamId);
      return rank === 0 ? 3.2 : rank === 1 ? 2.8 : rank === 2 ? 2.4 : rank === 3 ? 2.0 : rank === 4 ? 1.6 : rank < 10 && rank >= 0 ? 0.7 : 0;
    }
    if (stale) {
      competition.favoriteRanking = [...ids].sort((a, b) => calculateTeamStrength(state, b, isInternational) - calculateTeamStrength(state, a, isInternational));
    }
    ranks = { groups: competition.groups, ranking: competition.favoriteRanking, byId: new Map(competition.favoriteRanking.map((id, index) => [id, index])) };
    FAVORITE_RANK_CACHE.set(competition, ranks);
  }
  const rank = ranks.byId.get(teamId) ?? -1;
  // This represents depth, tournament experience and week-to-week consistency not
  // fully captured by the seven named stars. It is deliberately modest: favorites
  // still lose, but several unrelated long shots should not dominate one season.
  return rank === 0 ? 3.2 : rank === 1 ? 2.8 : rank === 2 ? 2.4 : rank === 3 ? 2.0 : rank === 4 ? 1.6 : rank < 10 && rank >= 0 ? 0.7 : 0;
}

// ─── Fitness, rotation, injuries and suspensions ─────────────────────────────────
// player.fitness   0–100 (missing means fully fit)
// player.injury    { type, weeks, returnSeason, returnWeek, season, week, competitionId }
// player.injuries  [[season, week, typeCode, weeks], …] (latest 12)
// state.current.discipline[playerId][competitionId] = { y, ban }
// state.current.bans["competitionId::teamId"] = [playerIds with a ban to serve]
const INJURY_TYPES = {
  knock: { label: 'Knock', code: 'k', min: 1, max: 2 },
  medium: { label: 'Injury', code: 'm', min: 3, max: 8 },
  long: { label: 'Long-term injury', code: 'l', min: 10, max: 28 },
  career: { label: 'Career-threatening injury', code: 'c', min: 26, max: 44 }
};
// A week restores more than one full match costs (~16).
const WEEKLY_FITNESS_RECOVERY = 22;
const OFFSEASON_RECOVERY_WEEKS = 6;

function playerFitness(player) {
  return player.fitness ?? 100;
}

function seasonWeekIndex(season, week) {
  return season * 100 + week;
}

function isPlayerInjured(state, player) {
  const injury = player?.injury;
  if (!injury) return false;
  return seasonWeekIndex(state.season, state.current.week) < seasonWeekIndex(injury.returnSeason, injury.returnWeek);
}

function injuryWeeksLeft(state, player) {
  if (!isPlayerInjured(state, player)) return 0;
  const injury = player.injury;
  return injury.returnSeason > state.season
    ? injury.returnWeek + Math.max(0, 52 - state.current.week)
    : Math.max(1, injury.returnWeek - state.current.week);
}

function isLeagueCompetition(state, competitionId) {
  return Boolean(state.current.leagues?.[competitionId]);
}

// Low-stakes games invite rotation; big games get the strongest XI available.
function matchStakes(state, { competitionId, stage, homeId, awayId, knockout, aggregate, isInternational }) {
  const text = String(stage || '');
  if (/Final|Semi/i.test(text) || aggregate || (knockout && /Quarter/i.test(text))) return 'big';
  if (!isInternational && rivalryDefinitionForIds(homeId, awayId)) return 'big';
  if (String(competitionId).startsWith('CUP-') && /Opening Round|Round of 16/i.test(text)) return 'low';
  if (String(competitionId).startsWith('SC-')) return 'low';
  const league = state.current.leagues?.[competitionId];
  if (league?.rounds) {
    const roundIndex = Number(/Matchday (\d+)/.exec(text)?.[1] || 0);
    const remaining = league.rounds.length - roundIndex + 1;
    if (roundIndex && remaining <= 4) {
      // Dead rubber: two mid-table sides that can no longer reach the top four or drop.
      const rows = sortTable(league.table);
      const fourth = rows[3]?.points ?? 0;
      const danger = rows[rows.length - 4]?.points ?? 0;
      const deadFor = (teamId) => {
        const index = rows.findIndex((row) => row.teamId === teamId);
        if (index < 4 || index >= rows.length - 4) return false;
        const points = rows[index].points;
        return points + remaining * 3 < fourth && points - remaining * 3 > danger;
      };
      if (deadFor(homeId) && deadFor(awayId)) return 'low';
    }
  }
  return 'normal';
}

// Tonight's 15: injured and suspended players are out, tired ones are rested in
// ordinary games and some starters rotated in low-stakes ones. Like a coach, the
// usual XI is kept and only the gaps are filled, each with the best fit for the slot.
function matchdaySquad(state, teamId, isInternational, competitionId, stakes) {
  const base = getTeamSquad(state, teamId, isInternational);
  const tiredLimit = stakes === 'big' ? 0 : stakes === 'low' ? 85 : 65;
  // Bans are listed per competition and team, so this is usually an empty check.
  const banList = state.current.bans?.[`${competitionId}::${teamId}`];
  const banned = banList?.length ? new Set(banList) : null;
  const nowIndex = seasonWeekIndex(state.season, state.current.week);
  const outOfSquad = (player) => {
    if (player.depth) return false;
    const injury = player.injury;
    if (injury && nowIndex < seasonWeekIndex(injury.returnSeason, injury.returnWeek)) return true;
    return banned !== null && banned.has(player.id);
  };
  const restFromXi = (player) => {
    if (player.depth) return false;
    if ((player.fitness ?? 100) < tiredLimit) return true;
    return stakes === 'low' && stableStringRoll(`${state.season}:${state.current.week}:${player.id}:rest`) < 0.45;
  };
  // Who is out (or resting) tonight; the same situation reuses the same squad, which
  // covers injuries and bans that last several matches.
  let signature = '';
  const xiRows = base.xi;
  for (let index = 0; index < xiRows.length; index += 1) {
    const player = xiRows[index].player;
    if (player.depth) continue;
    if (outOfSquad(player)) signature += `x${player.id};`;
    else if ((player.fitness ?? 100) < tiredLimit || stakes === 'low') { if (restFromXi(player)) signature += `r${player.id};`; }
  }
  const benchPlayers = base.bench;
  for (let index = 0; index < benchPlayers.length; index += 1) if (outOfSquad(benchPlayers[index])) signature += `b${benchPlayers[index].id};`;
  if (!signature) return base;
  const cache = getRuntimeCache(state);
  const cacheKey = `${isInternational ? 'n' : 'c'}:${teamId}`;
  cache.matchdaySquads ||= new Map();
  const cached = cache.matchdaySquads.get(cacheKey);
  if (cached && cached.base === base && cached.signature === signature && !cached.squad.named.some(outOfSquad)) return cached.squad;

  const pool = isInternational ? cache.nationalPlayers.get(teamId) || [] : cache.clubPlayers.get(teamId) || [];
  const inSquad = new Set(base.squad);
  // Reserves beyond the matchday 15 (clubs carry up to 18; nations call up the next best).
  // Nations call up from the next best of a large pool, sorted once per squad build.
  if (isInternational && !base.reservePool) base.reservePool = [...pool].sort((a, b) => b.rating - a.rating).slice(0, 30);
  const reserves = (isInternational ? base.reservePool : pool)
    .filter((player) => !inSquad.has(player) && player.status === 'active' && !outOfSquad(player));
  const candidates = [...base.bench.filter((player) => !outOfSquad(player)), ...reserves];
  // Choices depend only on who is available (not on this week's exact fitness), so a
  // cached squad and a squad rebuilt after loading a save are identical. Fitness still
  // reaches the match engine as each player's starting energy.
  const fitnessOf = () => 100;
  const xi = [];
  const used = new Set();
  const benchRested = [];
  for (const row of base.xi) {
    const player = row.player;
    const out = outOfSquad(player);
    if (!out && !restFromXi(player)) { xi.push(row); used.add(player); continue; }
    if (!out) benchRested.push(player);
    let best = null, bestValue = -Infinity;
    for (const candidate of candidates) {
      if (used.has(candidate)) continue;
      const value = effectiveRating(candidate, row.slotType, fitnessOf(candidate)) - (restFromXi(candidate) ? 4 : 0);
      if (value > bestValue) { bestValue = value; best = candidate; }
    }
    if (!best && !out) { xi.push(row); used.add(player); benchRested.pop(); continue; }
    const replacement = best || depthPlayers(`${teamId}:${state.season}:cover:${row.slotType}`, (isInternational ? cache.nationalById.get(teamId)?.strength : cache.clubById.get(teamId)?.strength) || 62, [], 1, stableStringRoll)[0];
    used.add(replacement);
    xi.push({ player: replacement, slotType: row.slotType, x: row.x, y: row.y, effective: effectiveRating(replacement, row.slotType, fitnessOf(replacement)), fit: slotFit(replacement, row.slotType) });
  }
  const benchPool = [...benchRested, ...candidates.filter((player) => !used.has(player))];
  const bench = [];
  const keeper = benchPool.find((player) => player.position === 'GK');
  if (keeper) bench.push(keeper);
  for (const player of benchPool.sort((a, b) => b.rating - a.rating)) {
    if (bench.length >= SQUAD_SIZE - xi.length) break;
    if (!bench.includes(player)) bench.push(player);
  }
  while (bench.length < SQUAD_SIZE - xi.length) {
    bench.push(depthPlayers(`${teamId}:${state.season}:bench:${bench.length}`, (cache.clubById.get(teamId)?.strength || cache.nationalById.get(teamId)?.strength || 62) - 4, [], 1, stableStringRoll)[0]);
  }
  const baseEffective = base.xi.reduce((sum, row) => sum + row.effective, 0);
  const tonightEffective = xi.reduce((sum, row) => sum + row.effective, 0);
  const squadPlayers = [...xi.map((row) => row.player), ...bench];
  const usual = new Set(base.starters);
  const starters = xi.map((row) => row.player).filter((player) => !player.depth);
  // Reuse the engine inputs of unchanged starters.
  const baseSources = squadMatchSources(base);
  const baseBench = new Map(base.bench.map((player, index) => [player, baseSources.bench[index]]));
  const sources = {
    xi: xi.map((row, index) => (row === base.xi[index] ? baseSources.xi[index] : matchSource(row.player, row.slotType, row.effective))),
    bench: bench.map((player) => baseBench.get(player) || matchSource(player, null, player.rating))
  };
  const repaired = makeSquadRecord({
    formationId: base.formationId,
    preferredFormation: base.preferredFormation,
    fit: Math.round(Math.max(30, Math.min(100, base.fit - Math.max(0, baseEffective - tonightEffective) * 0.35))),
    fallback: base.fallback,
    systemPenalty: base.systemPenalty || 0,
    xi,
    bench,
    squad: squadPlayers,
    sources,
    rotated: true,
    absentStarters: [...usual].filter((player) => !starters.includes(player)).length
  });
  cache.matchdaySquads.set(cacheKey, { base, signature, squad: repaired });
  return repaired;
}

function rollInjury(state, player, competitionId, matchId) {
  const prone = player.traits?.includes('injury_prone') ? 1 : 0;
  const roll = random(state);
  const type = roll < 0.6 - prone * 0.12 ? 'knock' : roll < 0.89 - prone * 0.08 ? 'medium' : roll < 0.996 - prone * 0.006 ? 'long' : 'career';
  const definition = INJURY_TYPES[type];
  const weeks = Math.round(randomInt(state, definition.min, definition.max) * (1 + prone * 0.25));
  let returnSeason = state.season;
  let returnWeek = state.current.week + weeks + 1;
  if (returnWeek > 52) {
    // The summer heals part of it; the rest is missed next season.
    returnSeason = state.season + 1;
    returnWeek = Math.max(0, returnWeek - 52 - OFFSEASON_RECOVERY_WEEKS);
  }
  player.injury = { type, weeks, returnSeason, returnWeek, season: state.season, week: state.current.week, competitionId, matchId: matchId || null };
  player.injuries ||= [];
  player.injuries.push([state.season, state.current.week, definition.code, weeks]);
  if (player.injuries.length > 12) player.injuries.splice(0, player.injuries.length - 12);
  if (type === 'career') {
    // A career-threatening injury costs ability and can shorten the career.
    player.baseQuality = Math.max((STAR_RARITIES[player.rarity]?.min || 60) - 6, player.baseQuality - randomInt(state, 2, 6));
    player.careerLength = Math.max(player.careerYear + 2, player.careerLength - randomInt(state, 0, 2));
    player.careerMultipliers = careerCurve(player.careerType || 'stable_prime', player.careerLength);
  }
  const notable = ['generational', 'legend', 'epic'].includes(player.rarity) || player.rating >= 82;
  if ((type === 'long' || type === 'career') && notable) {
    const club = player.clubId ? getClub(state, player.clubId) : null;
    state.current.news.unshift({
      id: `news-${state.season}-${state.current.week}-injury-${player.id}`,
      week: state.current.week,
      importance: ['generational', 'legend'].includes(player.rarity) || type === 'career' ? 'major' : 'digest',
      category: 'Injuries',
      storyType: 'injury',
      matchId: matchId || undefined,
      relevance: 60 + (STAR_RARITIES[player.rarity]?.rank || 1) * 5,
      headline: type === 'career' ? `${player.name} suffers a career-threatening injury` : `${player.name} out for ${weeks} weeks`,
      body: `${club ? `${club.name}'s ` : ''}${(STAR_RARITIES[player.rarity]?.label || '').toLowerCase()} ${player.roleLabel.toLowerCase()} was hurt in the ${getCompetitionName(state, competitionId) || 'match'} and is expected back ${returnSeason > state.season ? 'next season' : `around week ${returnWeek}`}.`,
      entityType: 'player',
      entityId: player.id
    });
  }
}

// Bans: a straight red costs one to three matches, a second booking one, and yellow
// cards build up within each competition (five in a league, three elsewhere).
function applyDiscipline(state, match, competitionId, teamIdFor) {
  if (!match.cardEvents?.length) return;
  state.current.discipline ||= {};
  state.current.bans ||= {};
  const threshold = isLeagueCompetition(state, competitionId) ? 5 : 3;
  const rowFor = (playerId) => {
    const byCompetition = state.current.discipline[playerId] ||= {};
    return byCompetition[competitionId] ||= { y: 0, ban: 0 };
  };
  const addBan = (playerId, teamId, matches) => {
    rowFor(playerId).ban += matches;
    const key = `${competitionId}::${teamId}`;
    const list = state.current.bans[key] ||= [];
    if (!list.includes(playerId)) list.push(playerId);
  };
  const sentOff = new Set(match.cardEvents.filter((card) => card.type === 'red').map((card) => card.playerId));
  for (const card of match.cardEvents) {
    if (!card.playerId) continue;
    const teamId = teamIdFor(card.side);
    if (card.type === 'red') {
      const straight = card.reason !== 'second-yellow';
      const roll = random(state);
      addBan(card.playerId, teamId, straight ? (roll < 0.6 ? 1 : roll < 0.88 ? 2 : 3) : 1);
    } else if (!card.second && !sentOff.has(card.playerId)) {
      const row = rowFor(card.playerId);
      row.y += 1;
      if (row.y >= threshold) { row.y = 0; addBan(card.playerId, teamId, 1); }
    }
  }
}

function bansBeforeKickoff(state, competitionId, teamIds) {
  const map = new Map();
  for (const teamId of teamIds) {
    const key = `${competitionId}::${teamId}`;
    const list = state.current.bans?.[key];
    if (list?.length) map.set(key, [...list]);
  }
  return map;
}

// Players banned before kickoff serve one match of their ban.
function serveBans(state, competitionId, served) {
  for (const [key, list] of served) {
    for (const playerId of list) {
      const row = state.current.discipline?.[playerId]?.[competitionId];
      if (row && row.ban > 0) row.ban -= 1;
    }
    state.current.bans[key] = (state.current.bans[key] || []).filter((playerId) => (state.current.discipline?.[playerId]?.[competitionId]?.ban || 0) > 0);
    if (!state.current.bans[key].length) delete state.current.bans[key];
  }
}

function recoverFitness(state) {
  recoverTeamFitness(state);
  const set = recoverySet(state);
  for (const player of set) {
    if (player.injury && !isPlayerInjured(state, player)) player.injury = undefined;
    if (player.fitness !== undefined) {
      const next = player.fitness + WEEKLY_FITNESS_RECOVERY;
      if (next >= 100 || player.status !== 'active') player.fitness = undefined;
      else player.fitness = next;
    }
    if (player.fitness === undefined && !player.injury) set.delete(player);
  }
}

// Season rollover: full fitness, and injuries keep only what the summer did not heal.
function carryInjuriesIntoNewSeason(state) {
  RECOVERY_SETS.delete(state);
  for (const player of state.players) {
    if (player.fitness !== undefined) player.fitness = undefined;
    if (player.form) player.form = Math.round(player.form * 30) / 100;
    const injury = player.injury;
    if (!injury) continue;
    if (player.status !== 'active' || injury.returnSeason < state.season || (injury.returnSeason === state.season && injury.returnWeek <= 0)) player.injury = undefined;
  }
}

// World Cup and continental finals: notable players ruled out make the news.
function reportTournamentAbsences(state, competition) {
  if (competition.absencesReported || competition.kind !== 'finals') return;
  competition.absencesReported = true;
  const finalWeek = Math.max(...(competition.knockoutWeeks || [state.current.week]));
  const ids = [...new Set((competition.groups || []).flatMap((group) => group.teamIds || []))];
  const cache = getRuntimeCache(state);
  const stories = [];
  for (const nationId of ids) {
    const best = [...(cache.nationalPlayers.get(nationId) || [])].sort((a, b) => b.rating - a.rating).slice(0, 15);
    for (const player of best) {
      if (!isPlayerInjured(state, player) || player.rating < 82) continue;
      const injury = player.injury;
      const outForAll = injury.returnSeason > state.season || injury.returnWeek > finalWeek;
      stories.push({ player, nationId, outForAll });
    }
  }
  stories.sort((a, b) => b.player.rating - a.player.rating);
  for (const { player, nationId, outForAll } of stories.slice(0, 6)) {
    state.current.news.unshift({
      id: `news-${state.season}-${competition.id}-absence-${player.id}`,
      week: state.current.week,
      importance: player.rating >= 88 ? 'major' : 'digest',
      category: 'Injuries',
      storyType: 'injury',
      relevance: 70 + Math.max(0, player.rating - 80),
      headline: `${player.name} ${outForAll ? 'misses' : 'is a doubt for'} the ${competition.name}`,
      body: `${getTeamName(state, nationId, true)} ${outForAll ? 'travel without' : 'hope to recover'} their ${player.roleLabel.toLowerCase()}, sidelined by a ${INJURY_TYPES[player.injury.type]?.label.toLowerCase() || 'injury'}.`,
      entityType: 'player',
      entityId: player.id
    });
  }
}

// Goal and assist weights adjusted for the slot a player fills tonight.
const SLOT_GOAL_FACTOR = { GK: 1, CB: 0.85, FB: 0.85, WB: 0.92, DM: 0.6, CM: 0.82, WM: 0.95, AM: 1.15, W: 1.05, ST: 1.25 };
const SLOT_ASSIST_FACTOR = { GK: 1, CB: 0.7, FB: 1.0, WB: 1.12, DM: 0.85, CM: 1.0, WM: 1.12, AM: 1.15, W: 1.08, ST: 0.85 };

// Share of a side's shots a player takes. Flatter than goalWeight: quality still
// matters a lot, but one star does not take every chance.
// v4.3 elite tuning (calibrated with scripts/calibration-rarity.mjs).
const ELITE_TUNING = {
  shotShareRank: 0.32, shotSharePoint: 0.05,
  starRarity: { generational: 1.6, legend: 1.4, epic: 1.15, rare: 0.86, uncommon: 0.68, common: 0.52 }, starCap: 9,
  // Context points in the biggest competitions for a side without Legend/Generational.
  majorTitleCompetitions: new Set(['UCL', 'WC', 'EURO', 'COPA', 'CWC']),
  noEliteHandicap: { noEpic: 4, fewEpics: 2.5, epicCore: 0 }
};

function matchGoalWeight(player) {
  const base = player.position === 'FW' ? 6 : player.position === 'MF' ? 3.2 : player.position === 'DF' ? 1.1 : 0.08;
  const quality = clamp((player.rating - 54) / 46, 0.08, 1.05);
  // Elite shooters take a far bigger share of their team's shots (v4.3).
  const rank = STAR_RARITIES[player.rarity]?.rank || 1;
  const rarity = rank >= 4 ? (1 + (rank - 3) * ELITE_TUNING.shotShareRank) * (1 + Math.max(0, player.rating - 84) * ELITE_TUNING.shotSharePoint) : 1;
  return base * (player.depth ? 1 : roleData(player).goal) * (0.4 + quality ** 1.6 * 1.1) * rarity;
}

function penaltySkill(player) {
  if (player.depth) return player.rating - 6;
  const lineBase = { GK: -16, DF: -7, MF: -2, FW: 0 }[player.position] ?? -4;
  const role = roleData(player);
  return player.rating + lineBase + (role.goal - 1) * 4;
}

// Engine inputs for one player in tonight's squad. Ratings and roles do not change
// during a season, so these are cached with the squad and reused match after match.
function matchSource(player, slotType, effective) {
  const line = slotType ? slotLine(slotType) : player.position;
  return {
    id: player.depth ? null : player.id,
    line,
    slotType: slotType || null,
    rating: player.rating,
    effective,
    goalW: matchGoalWeight(player) * (slotType ? SLOT_GOAL_FACTOR[slotType] ?? 1 : 1),
    assistW: assistWeight(player) * (slotType ? SLOT_ASSIST_FACTOR[slotType] ?? 1 : 1),
    defendW: player.depth ? 1 : roleData(player).defence,
    penalty: penaltySkill(player) + (hasTrait(player, 'clutch') ? 4 : 0),
    cardProne: hasTrait(player, 'hot_headed') ? 1.8 : 1,
    injuryProne: hasTrait(player, 'injury_prone') ? 1.6 : 1,
    bigGame: hasTrait(player, 'big_game') ? 1 : 0,
    clutch: hasTrait(player, 'clutch') ? 1 : 0
  };
}

// Kickoff fitness for the engine, in squad order (XI then bench); null when all fit.
function squadFitness(squad) {
  let values = null;
  const players = squad.squad;
  for (let index = 0; index < players.length; index += 1) {
    const value = players[index].depth ? 100 : players[index].fitness ?? 100;
    if (value < 100) { values ||= new Array(players.length).fill(100); values[index] = value; }
  }
  return values;
}

// Players whose fitness or injury needs weekly attention (rebuilt after loading).
const RECOVERY_SETS = new WeakMap();
function recoverySet(state) {
  let set = RECOVERY_SETS.get(state);
  if (!set) {
    set = new Set(state.players.filter((player) => player.fitness !== undefined || player.injury));
    RECOVERY_SETS.set(state, set);
  }
  return set;
}

function squadMatchSources(squad) {
  if (!squad.sources) {
    squad.sources = {
      xi: squad.xi.map((row) => matchSource(row.player, row.slotType, row.effective)),
      bench: squad.bench.map((player) => matchSource(player, null, player.rating))
    };
  }
  return squad.sources;
}

function lineupSnapshot(squad) {
  return {
    formationId: squad.formationId,
    preferredFormation: squad.preferredFormation,
    fit: squad.fit,
    fallback: squad.fallback,
    systemPenalty: squad.systemPenalty || 0,
    xi: squad.xi.map((row) => ({ playerId: row.player.depth ? null : row.player.id, depth: Boolean(row.player.depth), position: row.player.position, rating: row.player.rating, slotType: row.slotType, x: row.x, y: row.y, slotFit: Number(row.fit.toFixed(2)) })),
    bench: squad.bench.map((player) => ({ playerId: player.depth ? null : player.id, depth: Boolean(player.depth), position: player.position, rating: player.rating }))
  };
}

// Kickoff expectations: squad quality, home edge, coach and competition context set
// each side's expected goals. Everything after kickoff is played by the match engine.
// ─── Home advantage and derbies ──────────────────────────────────────────────────
// Venues high enough to trouble visiting sides (metres above sea level).
const ALTITUDE_VENUES = {
  'bol-bolivar': 3640, 'bol-the-strongest': 3640, 'bol-always-ready': 4090, 'bol-jorge-wilstermann': 2560,
  'ecu-ldu-quito': 2850, 'ecu-el-nacional': 2850, 'ecu-aucas': 2850, 'ecu-independiente-del-valle': 2500, 'ecu-deportivo-cuenca': 2560,
  'col-millonarios': 2640, 'col-independiente-santa-fe': 2640, 'col-la-equidad': 2640, 'col-bogota-fc': 2640,
  'per-cienciano': 3400, 'per-melgar': 2335,
  america: 2240, 'cruz-azul': 2240, pumas: 2240, toluca: 2660, pachuca: 2400, 'mex-puebla': 2135,
  bol: 3640, ecu: 2850, mex: 2240
};
const LONG_TRIP_CONFEDERATIONS = new Set(['Asia', 'Africa', 'North America', 'South America']);

// The home edge varies a little: big crowds, long continental trips and altitude add
// to it; derbies (familiar opponents, a short trip) shrink it; neutral finals have none.
function homeAdvantage(state, { homeId, awayId, isInternational, competitionId, neutral, derby }) {
  if (neutral) return 0;
  let edge = MATCH_CALIBRATION.homeStrengthEdge;
  if (!isInternational) {
    const home = getClub(state, homeId);
    const away = getClub(state, awayId);
    // Fan bases run from ~12,000 to several million; a typical club sits near 800,000.
    const crowd = clamp((Math.log10(Math.max(10000, home?.fans || 800000)) - 6.12) * 0.15, -0.12, 0.12);
    edge *= 1 + crowd;
    if (home && away && home.country !== away.country) edge += LONG_TRIP_CONFEDERATIONS.has(home.confederation) ? 0.55 : 0.3;
  }
  const altitudeGap = (ALTITUDE_VENUES[homeId] || 0) - (ALTITUDE_VENUES[awayId] || 0);
  if (altitudeGap > 1500) edge += Math.min(2.2, (altitudeGap - 1500) / 900);
  if (derby) edge *= 0.4;
  return edge;
}

// Exposed for regression scripts and the match preview.
export function getHomeAdvantage(state, options) {
  return homeAdvantage(state, options);
}

function isDerby(homeId, awayId, isInternational) {
  return !isInternational && Boolean(rivalryDefinitionForIds(homeId, awayId));
}

// The biggest titles go to teams with a true star: without a Legend or Generational a
// side is handicapped in the Champions League, World Cup, Euros, Copa América and Club
// World Cup, much less so when it has a compact core of four or more Epics.
function eliteCoreHandicap(state, teamId, isInternational, competitionId, squadOverride) {
  if (!ELITE_TUNING.majorTitleCompetitions.has(competitionId)) return 0;
  const squad = squadOverride || getTeamSquad(state, teamId, isInternational);
  let legends = 0;
  let epics = 0;
  for (const player of squad.starters) {
    const rank = STAR_RARITIES[player.rarity]?.rank || 1;
    if (rank >= 5) legends += 1; else if (rank === 4) epics += 1;
  }
  if (legends) return 0;
  const table = ELITE_TUNING.noEliteHandicap;
  return epics >= 4 ? table.epicCore : epics ? table.fewEpics : table.noEpic;
}

function matchExpectations(state, { homeId, awayId, competitionId, stage, knockout, isInternational, neutral, homeSquad = null, awaySquad = null, derby = false, preview = false }) {
  const homeFavoriteBonus = tournamentFavoriteBonus(state, competitionId, homeId, isInternational, preview);
  const awayFavoriteBonus = tournamentFavoriteBonus(state, competitionId, awayId, isInternational, preview);
  const homeCoachContext = coachContextBonus(state, homeId, isInternational, competitionId, stage, knockout);
  const awayCoachContext = coachContextBonus(state, awayId, isInternational, competitionId, stage, knockout);
  const homeDynastyPressure = isInternational ? 0 : continentalDynastyPressure(state, homeId, competitionId);
  const awayDynastyPressure = isInternational ? 0 : continentalDynastyPressure(state, awayId, competitionId);
  const homeBase = calculateTeamStrength(state, homeId, isInternational, homeSquad);
  const awayBase = calculateTeamStrength(state, awayId, isInternational, awaySquad);
  const homeEdge = homeAdvantage(state, { homeId, awayId, isInternational, competitionId, neutral, derby });
  const homeContext = homeFavoriteBonus + homeCoachContext - homeDynastyPressure - titleFatigue(state, homeId, competitionId) - eliteCoreHandicap(state, homeId, isInternational, competitionId, homeSquad);
  const awayContext = awayFavoriteBonus + awayCoachContext - awayDynastyPressure - titleFatigue(state, awayId, competitionId) - eliteCoreHandicap(state, awayId, isInternational, competitionId, awaySquad);
  const homeStrength = homeBase + homeContext + homeEdge;
  const awayStrength = awayBase + awayContext;
  // Squad quality and the home edge go through the saturating curve below; coach
  // focus, tournament-favourite and dynasty-pressure context multiply expected goals
  // directly so they keep their full weight even in mismatches.
  const homeAttack = calculateUnitStrength(state, homeId, isInternational, 'attack', homeBase, homeSquad);
  const awayAttack = calculateUnitStrength(state, awayId, isInternational, 'attack', awayBase, awaySquad);
  const homeDefence = calculateUnitStrength(state, homeId, isInternational, 'defence', homeBase, homeSquad);
  const awayDefence = calculateUnitStrength(state, awayId, isInternational, 'defence', awayBase, awaySquad);
  const difference = homeBase + homeEdge - awayBase;
  const highStakes = knockout || /Leg|Round of 16|Quarter|Semi|Final/i.test(stage || '');
  const c = MATCH_CALIBRATION;
  const attackDivisor = highStakes ? (isInternational ? c.attackDivisorKnockoutIntl : c.attackDivisorKnockout) : c.attackDivisor;
  const defenceDivisor = highStakes ? (isInternational ? c.defenceDivisorKnockoutIntl : c.defenceDivisorKnockout) : c.defenceDivisor;
  const homeEdgeDivisor = highStakes ? (isInternational ? 33 : 37) : 44;
  const awayEdgeDivisor = highStakes ? (isInternational ? 37 : 42) : 50;
  const homeBaseGoals = neutral ? (c.homeGoals + c.awayGoals) / 2 : c.homeGoals;
  const awayBaseGoals = neutral ? (c.homeGoals + c.awayGoals) / 2 : c.awayGoals;
  // Quality gaps move expected goals along a saturating curve: a mismatch is lopsided
  // but still a football score (around 2.6 vs 0.4), not 3.5 vs 0.15.
  const shape = (base, delta) => base * (1 + c.lambdaAmplitude * Math.tanh(delta / base * c.lambdaScale));
  const contextFactor = Math.exp(c.contextPerPoint * (homeContext - awayContext));
  const gapScale = isInternational ? (c.internationalGapScaleByCompetition[competitionId] ?? c.internationalGapScale) : 1;
  const homeLambda = clamp(shape(homeBaseGoals, ((homeAttack - awayDefence) / attackDivisor + difference / homeEdgeDivisor) * gapScale) * contextFactor, 0.2, 3.6);
  const awayLambda = clamp(shape(awayBaseGoals, ((awayAttack - homeDefence) / defenceDivisor - difference / awayEdgeDivisor) * gapScale) / contextFactor, 0.18, 3.3);
  return { homeStrength, awayStrength, homeLambda, awayLambda };
}


// ─── Light simulation for low-profile matches ────────────────────────────────────
// Leagues outside the main football nations, their early cup rounds and condensed
// leagues are played as a quick scoreline from the same kickoff expectations: no
// per-minute engine, no events, logs, cards or ratings. Goals still go to named
// scorers so scoring races work, and appearances, clean sheets and season ratings are
// filled in once per season from team results (flushLightAppearances).
const FULL_DETAIL_LEAGUES = new Set(['ENG1', 'ESP1', 'ITA1', 'GER1', 'FRA1', 'POR1', 'NED1', 'BRA1', 'ARG1']);
const LIGHT_SCORE_FACTOR = 1.03;
// Late equalisers: the full engine's game-state play produces more draws than
// independent scorelines, so a one-goal game is sometimes levelled.
const LIGHT_EQUALISER_CHANCE = 0.08;

// v4.1: every league game is light (tables, scorers and season ratings are what matter
// there); domestic cups are light until the quarter-finals. The full engine plays
// continental and international football, cup quarter-finals onwards, two-legged ties
// and anything involving a followed club.
function isLightMatch(state, { competitionId, homeId, awayId, stage, isInternational, aggregate }) {
  if (isInternational || aggregate) return false;
  const favourites = state.preferences?.favoriteClubIds || [];
  if (favourites.includes(homeId) || favourites.includes(awayId)) return false;
  if (state.current.leagues?.[competitionId]) return true;
  if (String(competitionId).startsWith('CUP-')) return !/Quarter|Semi|Final/i.test(String(stage || ''));
  return false;
}

function poissonSample(state, mean) {
  const limit = Math.exp(-mean);
  let product = random(state);
  let count = 0;
  while (product > limit && count < 12) { count += 1; product *= random(state); }
  return count;
}

function pickLightScorer(state, sources) {
  let total = 0;
  for (const source of sources) total += source.goalW;
  let needle = random(state) * total;
  for (const source of sources) { needle -= source.goalW; if (needle <= 0) return source; }
  return sources[sources.length - 1];
}

function pickLightAssister(state, sources, scorer) {
  let total = 0;
  for (const source of sources) if (source !== scorer) total += source.assistW;
  let needle = random(state) * total;
  for (const source of sources) {
    if (source === scorer) continue;
    needle -= source.assistW;
    if (needle <= 0) return source;
  }
  return null;
}

// ─── Team fitness (quick model) ──────────────────────────────────────────────────
// One fitness value per club for the season. Every match costs 12, every week gives 22
// back, so one game a week stays fresh and congested months wear a team down. Before a
// quick game the coach rotates up to three players from a bench that is close enough
// to the XI: each change takes away a share of the fatigue (70 % becomes 80, 88, 94).
// Below 80 % a team is weaker; 80–95 % is fine; above 95 % gives a small edge.
const TEAM_FITNESS_MATCH_COST = 12;
const TEAM_FITNESS_WEEKLY_RECOVERY = 22;
const ROTATION_FATIGUE_LEFT = [1, 0.667, 0.4, 0.2];

function teamFitness(state, teamId) {
  return state.current.teamFitness?.[teamId] ?? 100;
}

function drainTeamFitness(state, teamId) {
  const map = state.current.teamFitness ||= {};
  map[teamId] = Math.max(40, (map[teamId] ?? 100) - TEAM_FITNESS_MATCH_COST);
}

function recoverTeamFitness(state) {
  const map = state.current.teamFitness;
  if (!map) return;
  for (const teamId of Object.keys(map)) {
    const next = map[teamId] + TEAM_FITNESS_WEEKLY_RECOVERY;
    if (next >= 100) delete map[teamId]; else map[teamId] = next;
  }
}

// Rotation and its effect for tonight, in strength points (negative = weaker).
function teamFitnessEffect(state, teamId, squad) {
  const fitness = teamFitness(state, teamId);
  const wanted = fitness >= 85 ? 0 : fitness >= 75 ? 1 : fitness >= 65 ? 2 : 3;
  let subs = 0;
  let rotationCost = 0;
  if (wanted) {
    const xiAverage = squad.xi.reduce((sum, row) => sum + (row.player.rating || 60), 0) / Math.max(1, squad.xi.length);
    for (const player of squad.bench) {
      if (subs >= wanted) break;
      if (player.position === 'GK' || (player.rating || 60) < xiAverage - 10) continue;
      rotationCost += Math.max(0, xiAverage - (player.rating || 60)) * 0.04;
      subs += 1;
    }
  }
  const effective = 100 - (100 - fitness) * ROTATION_FATIGUE_LEFT[subs];
  const condition = effective < 80 ? -(80 - effective) * 0.08 : effective >= 95 ? 0.3 : 0;
  return { fitness, effective, subs, delta: condition - rotationCost };
}

// Quick-model bench: how close the best three outfield substitutes are to the XI. Deep
// squads finish games stronger; thin ones fade after half-time.
function lightBenchFactor(squad) {
  if (squad.lightBench !== undefined) return squad.lightBench;
  const xiAverage = squad.xi.reduce((sum, row) => sum + (row.player.rating || 60), 0) / Math.max(1, squad.xi.length);
  const subs = squad.bench.filter((player) => player.position !== 'GK').slice(0, 3);
  const benchAverage = subs.length ? subs.reduce((sum, player) => sum + (player.rating || 60), 0) / subs.length : xiAverage - 15;
  squad.lightBench = clamp(1 + (benchAverage - xiAverage + 8) * 0.008, 0.92, 1.05);
  return squad.lightBench;
}


function simulateLightMatch(state, { homeId, awayId, competitionId, competitionName, week, knockout, stage, table, neutral, record }) {
  // Tonight's 15 as in the full engine: injured and banned players out, tired ones rested.
  // Quick games rotate only tired, injured or banned players (no low-stakes rotation:
  // rebuilding a line-up for every early cup tie would cost more than the game itself).
  const stakes = 'normal';
  const homeSquad = record ? matchdaySquad(state, homeId, false, competitionId, stakes) : getClubSquad(state, homeId);
  const awaySquad = record ? matchdaySquad(state, awayId, false, competitionId, stakes) : getClubSquad(state, awayId);
  const expectations = matchExpectations(state, { homeId, awayId, competitionId, stage, knockout, isInternational: false, neutral, homeSquad, awaySquad, derby: isDerby(homeId, awayId, false) });
  const homeCondition = teamFitnessEffect(state, homeId, homeSquad).delta;
  const awayCondition = teamFitnessEffect(state, awayId, awaySquad).delta;
  const homeLambda = expectations.homeLambda * LIGHT_SCORE_FACTOR * Math.exp(0.04 * homeCondition - 0.02 * awayCondition);
  const awayLambda = expectations.awayLambda * LIGHT_SCORE_FACTOR * Math.exp(0.04 * awayCondition - 0.02 * homeCondition);
  // First and second half drawn separately; the bench shapes the second.
  let homeGoals = poissonSample(state, homeLambda * 0.45) + poissonSample(state, homeLambda * 0.55 * lightBenchFactor(homeSquad));
  let awayGoals = poissonSample(state, awayLambda * 0.45) + poissonSample(state, awayLambda * 0.55 * lightBenchFactor(awaySquad));
  if (Math.abs(homeGoals - awayGoals) === 1 && random(state) < LIGHT_EQUALISER_CHANCE) {
    if (homeGoals > awayGoals) awayGoals += 1; else homeGoals += 1;
  }
  let penalties = null;
  let extraTime = false;
  if (knockout && homeGoals === awayGoals) {
    extraTime = true;
    const homeShare = expectations.homeLambda / (expectations.homeLambda + expectations.awayLambda);
    if (random(state) < 0.45) {
      if (random(state) < homeShare) homeGoals += 1; else awayGoals += 1;
    } else {
      const homeWins = random(state) < 0.5 + (homeShare - 0.5) * 0.4;
      const loser = 2 + Math.floor(random(state) * 3);
      penalties = homeWins ? { home: loser + 1, away: loser } : { home: loser, away: loser + 1 };
    }
  }
  const goalEvents = [];
  const sidePlayers = { home: squadMatchSources(homeSquad).xi.filter((source) => source.id), away: squadMatchSources(awaySquad).xi.filter((source) => source.id) };
  for (const [side, goals, teamId, opponentId] of [['home', homeGoals, homeId, awayId], ['away', awayGoals, awayId, homeId]]) {
    const sources = sidePlayers[side];
    for (let goal = 0; goal < goals; goal += 1) {
      const scorer = sources.length ? pickLightScorer(state, sources) : null;
      const assister = scorer && random(state) < 0.72 ? pickLightAssister(state, sources, scorer) : null;
      if (scorer) ensurePlayerStat(state, scorer.id, competitionId, teamId, false).goals += 1;
      if (assister) ensurePlayerStat(state, assister.id, competitionId, teamId, false).assists += 1;
      if (record) goalEvents.push({ teamId, opponentId, side, scorerId: scorer?.id || null, assistId: assister?.id || null, minute: 1 + Math.floor(random(state) * 90) });
    }
  }
  // Team-level bookkeeping, turned into player appearances at season end.
  state.current.lightApps ||= {};
  for (const [teamId, goalsFor, goalsAgainst] of [[homeId, homeGoals, awayGoals], [awayId, awayGoals, homeGoals]]) {
    const key = `${competitionId}::${teamId}`;
    const row = state.current.lightApps[key] ||= { played: 0, points: 0, cleanSheets: 0 };
    row.played += 1;
    row.points += goalsFor > goalsAgainst ? 3 : goalsFor === goalsAgainst ? 1 : 0;
    if (goalsAgainst === 0) row.cleanSheets += 1;
  }
  if (record) { drainTeamFitness(state, homeId); drainTeamFitness(state, awayId); }
  // One cheap injury roll per side keeps squads honest over a season.
  if (record) {
    for (const squad of [homeSquad, awaySquad]) {
      if (random(state) < 0.1 && squad.starters.length) {
        const player = squad.starters[Math.floor(random(state) * squad.starters.length)];
        if (!player.injury || !isPlayerInjured(state, player)) { rollInjury(state, player, competitionId, null); recoverySet(state).add(player); }
      }
    }
  }
  const winnerId = penalties ? (penalties.home > penalties.away ? homeId : awayId) : homeGoals > awayGoals ? homeId : awayGoals > homeGoals ? awayId : null;
  if (!record) return { homeGoals, awayGoals, winnerId, expectations };
  const match = {
    id: `m-${state.season}-${week}-${state.current.matches.length + 1}`,
    season: state.season,
    week,
    competitionId,
    competitionName,
    stage,
    homeId,
    awayId,
    homeGoals,
    awayGoals,
    winnerId,
    extraTime,
    penalties,
    goalEvents,
    cardEvents: [],
    isInternational: false,
    knockout,
    landmark: false,
    light: true,
    derby: rivalryDefinitionForIds(homeId, awayId)?.name || null
  };
  state.current.matches.push(match);
  if (table) updateTable(table, homeId, awayId, homeGoals, awayGoals);
  updateRecordsFromMatch(state, match);
  const homeOutcome = winnerId === homeId ? 'W' : winnerId === awayId ? 'L' : 'D';
  const awayOutcome = homeOutcome === 'W' ? 'L' : homeOutcome === 'L' ? 'W' : 'D';
  recordCoachResult(state, getCoach(state, homeId, false), competitionId, homeId, false, homeGoals, awayGoals, homeOutcome);
  recordCoachResult(state, getCoach(state, awayId, false), competitionId, awayId, false, awayGoals, homeGoals, awayOutcome);
  const homeClub = getClub(state, homeId);
  const awayClub = getClub(state, awayId);
  if (homeClub && awayClub) {
    const resultDelta = homeGoals > awayGoals ? 0.35 : homeGoals < awayGoals ? -0.28 : 0.05;
    homeClub.form = clamp(homeClub.form * 0.75 + resultDelta, -3, 3);
    awayClub.form = clamp(awayClub.form * 0.75 - resultDelta, -3, 3);
  }
  return match;
}


// ─── Players who change over time: traits, potential, development, form ──────────
// player.traits     ['loyal', …] one or two personality traits (some have none)
// player.potential  hidden ceiling for baseQuality; the UI shows a scouting range
// player.form       −1…+1 in-season confidence from recent match ratings
// player.loan       { parentClubId, season } while on loan; player.loanHistory []
export const PLAYER_TRAITS = {
  loyal: { label: 'Loyal', description: 'One-club mentality: rarely asks to leave and renews readily.' },
  mercenary: { label: 'Mercenary', description: 'Follows the best contract; quicker to move.' },
  big_game: { label: 'Big-game player', description: 'Raises the level in finals and decisive ties.' },
  injury_prone: { label: 'Injury-prone', description: 'Hurt more often and for longer.' },
  leader: { label: 'Leader', description: 'Natural captain; lifts the side when on the pitch.' },
  hot_headed: { label: 'Hot-headed', description: 'Picks up cards and bans.' },
  professional: { label: 'Professional', description: 'Develops well and ages gracefully.' },
  clutch: { label: 'Clutch penalty taker', description: 'Ice-cold from the spot and in shootouts.' }
};
const TRAIT_IDS = Object.keys(PLAYER_TRAITS);
const TRAIT_CONFLICTS = { loyal: ['mercenary'], mercenary: ['loyal'], professional: ['hot_headed'], hot_headed: ['professional'] };

function traitWeights(player) {
  const rank = STAR_RARITIES[player.rarity]?.rank || 1;
  const elite = rank >= 4;
  return {
    loyal: 1.0,
    mercenary: 0.8 + (rank >= 3 ? 0.3 : 0),
    big_game: 0.5 + (elite ? 1.1 : rank === 3 ? 0.4 : 0),
    injury_prone: 0.45,
    leader: 0.6 + (elite ? 0.5 : 0) + (player.position === 'DF' || player.position === 'GK' ? 0.3 : 0),
    hot_headed: 0.7 + (player.position === 'DF' || player.position === 'MF' ? 0.3 : 0),
    professional: 0.9 + (elite ? 0.3 : 0),
    clutch: 0.5 + (player.position === 'FW' || player.position === 'MF' ? 0.4 : 0) + (elite ? 0.3 : 0)
  };
}

// Deterministic from the player id (no RNG draw), so it can run on any save.
function assignPlayerTraits(player) {
  if (Array.isArray(player.traits)) return player.traits;
  const roll = stableStringRoll(`${player.id}:traits`);
  const count = roll < 0.32 ? 0 : roll < 0.84 ? 1 : 2;
  const traits = [];
  const weights = traitWeights(player);
  for (let index = 0; index < count; index += 1) {
    const options = TRAIT_IDS.filter((id) => !traits.includes(id) && !traits.some((taken) => TRAIT_CONFLICTS[taken]?.includes(id)));
    const total = options.reduce((sum, id) => sum + weights[id], 0);
    let needle = stableStringRoll(`${player.id}:trait:${index}`) * total;
    let chosen = options[options.length - 1];
    for (const id of options) { needle -= weights[id]; if (needle <= 0) { chosen = id; break; } }
    traits.push(chosen);
  }
  player.traits = traits;
  return traits;
}

function hasTrait(player, trait) {
  return Boolean(player?.traits && player.traits.includes(trait));
}

// Potential: the ceiling a young player can grow into. New young players start a
// few points below it; how far they get depends on minutes, form, coaching and league.
function assignPotential(player, { fresh = false } = {}) {
  if (Number.isFinite(player.potential)) return player.potential;
  const band = STAR_RARITIES[player.rarity] || STAR_RARITIES.common;
  const young = (player.careerYear || 0) <= 4;
  if (!young) { player.potential = player.baseQuality; return player.potential; }
  const lift = Math.round((stableStringRoll(`${player.id}:potential`) - 0.3) * 4);
  player.potential = clamp(player.baseQuality + Math.max(0, lift), band.min, band.max + 1);
  if (fresh && !player.realWorldId) {
    // A fresh prospect is still some way from the ceiling.
    // Elite prospects arrive closer to their ceiling.
    const eliteTalent = (STAR_RARITIES[player.rarity]?.rank || 1) >= 4 ? 0.45 : 1;
    const gap = Math.round(stableStringRoll(`${player.id}:gap`) * Math.max(0, 7 - (player.careerYear || 0) * 1.5) * eliteTalent);
    // Prospects stay inside their rarity band; the gap closes as they develop.
    player.baseQuality = Math.max(band.min, player.baseQuality - gap);
    player.rating = playerRatingFor(player, player.careerMultipliers?.[player.careerYear] ?? 1);
  }
  return player.potential;
}

function initialisePlayerProfile(player, fresh = false) {
  assignPlayerTraits(player);
  assignPotential(player, { fresh });
  // Career counters (Phase 5) exist from creation so every player keeps one object shape.
  player.careerGoals ??= 0;
  player.careerApps ??= 0;
  player.previousRating ??= null;
  player.academyClubId ??= null;
  return player;
}

// Scouting view of potential: a range that narrows as the player matures.
function potentialRange(player) {
  if (!Number.isFinite(player.potential)) return null;
  const year = player.careerYear || 0;
  if (year >= 8) return { low: player.baseQuality, high: player.baseQuality, settled: true };
  const width = Math.max(1, 6 - year);
  const offset = Math.round((stableStringRoll(`${player.id}:scout`) - 0.5) * width);
  return { low: Math.max(45, player.potential - width + offset), high: Math.min(100, player.potential + width + offset), settled: false };
}

const LEAGUE_DEVELOPMENT = (leagueId) => (['ESP1', 'ENG1', 'ITA1', 'GER1', 'FRA1'].includes(leagueId) ? 0.6
  : FULL_DETAIL_LEAGUES.has(leagueId) ? 0.4 : LEAGUE_DEFINITIONS.find((league) => league.id === leagueId)?.tier === 'detailed' ? 0.2 : 0);

// Club minutes and average rating in the season just finished.
function buildSeasonPlayingTime(state) {
  const map = new Map();
  for (const row of state.current.archivedPlayerStats || []) {
    if (row.isInternational || !row.apps) continue;
    const item = map.get(row.playerId) || { minutes: 0, apps: 0, ratingWeighted: 0 };
    item.minutes += row.minutes ?? row.apps * 80;
    item.apps += row.apps;
    item.ratingWeighted += (row.averageRating || 6.5) * row.apps;
    map.set(row.playerId, item);
  }
  return map;
}

// Yearly growth or decline on top of the career-curve archetype.
// Ratings stay inside the rarity: below Epic a player tops out one point under the next
// band (Rare 84, Uncommon 79, Common 69), so "Epic" always means elite. Breakouts can
// promote a young Rare to Epic while the Epic population is under its ceiling.
const EPIC_POPULATION_CAP = 50;
function rarityRatingCap(player) {
  const band = STAR_RARITIES[player.rarity];
  return band && (band.rank || 1) < 4 ? band.max - 1 : 100;
}

function playerRatingFor(player, multiplier) {
  return clamp(Math.round(player.baseQuality * multiplier), 51, rarityRatingCap(player));
}

const PROMOTION_BUDGET = new WeakMap();
function epicRoom(state) {
  let budget = PROMOTION_BUDGET.get(state);
  if (!budget || budget.season !== state.season) {
    budget = { season: state.season, epics: rarityCounts(state).epic || 0 };
    PROMOTION_BUDGET.set(state, budget);
  }
  return budget;
}

function developPlayer(state, player, playing, club, coach) {
  const band = STAR_RARITIES[player.rarity] || STAR_RARITIES.common;
  const year = player.careerYear || 0;
  const time = playing.get(player.id) || { minutes: 0, apps: 0, ratingWeighted: 0 };
  const minutesShare = clamp(time.minutes / 3000, 0, 1.2);
  const averageRating = time.apps ? time.ratingWeighted / time.apps : 6.3;
  const performance = clamp((averageRating - 6.6) * 2, -1, 1.5);
  const profile = COACH_PROFILES[coach?.profile];
  const coaching = coach ? ((profile?.development || 1) - 1) * 8 + ((coach.quality || 70) - 70) / 30 : 0;
  const league = club ? LEAGUE_DEVELOPMENT(club.leagueId) : 0;
  const professional = hasTrait(player, 'professional');
  const story = { type: null };
  assignPotential(player);
  if (year <= 7 && player.baseQuality < player.potential) {
    const growth = 0.4 + minutesShare * 1.8 + performance * 0.8 + coaching * 0.45 + league + (professional ? 0.6 : 0)
      + ((STAR_RARITIES[player.rarity]?.rank || 1) >= 4 ? 0.5 : 0)
      - (hasTrait(player, 'hot_headed') ? 0.2 : 0) + (random(state) - 0.5) * 2.4;
    const step = clamp(Math.round(growth), -1, player.potential - player.baseQuality);
    player.baseQuality += step;
    // Breakout: a strong young season lifts the ceiling itself.
    if (year <= 4 && performance > 0.45 && minutesShare > 0.6 && random(state) < 0.06) {
      const lift = randomInt(state, 2, 5);
      player.potential = Math.min(band.max + 1, player.potential + lift);
      player.baseQuality = Math.min(player.potential, player.baseQuality + 1);
      story.type = 'breakout';
      // A Rare whose ceiling now reaches the Epic band joins the elite, if there is room.
      const room = player.rarity === 'rare' && player.potential > band.max ? epicRoom(state) : null;
      // The last places under the cap are left for academy graduates (v4.4).
      if (room && room.epics < EPIC_POPULATION_CAP - 8) {
        room.epics += 1;
        player.rarity = 'epic';
        player.potential = Math.max(player.potential, STAR_RARITIES.epic.min + 1);
        story.type = 'promotion';
      }
    }
  } else if (year >= 4 && year <= 9 && random(state) < (professional ? 0.025 : 0.015) && performance > 0.2) {
    // Late bloomer.
    const lift = randomInt(state, 1, 3);
    player.potential = Math.min(band.max + 1, Math.max(player.potential, player.baseQuality) + lift);
    player.baseQuality = Math.min(player.potential, player.baseQuality + lift);
    story.type = 'late_bloomer';
  } else if (year >= 8 && random(state) < (professional ? 0.012 : 0.028)) {
    // Early decline.
    player.baseQuality = Math.max(band.min - 8, player.baseQuality - randomInt(state, 2, 4));
    story.type = 'decline';
  }
  // Professionals can stretch a career by a season.
  if (professional && !player.careerExtended && year === player.careerLength - 2 && random(state) < 0.5) {
    player.careerLength += 1;
    player.careerMultipliers = careerCurve(player.careerType || 'stable_prime', player.careerLength);
    player.careerExtended = true;
  }
  const finalBand = STAR_RARITIES[player.rarity] || band;
  player.baseQuality = clamp(player.baseQuality, finalBand.min - 8, (finalBand.rank || 1) < 4 ? finalBand.max : finalBand.max + 1);
  if (player.potential > player.baseQuality && (finalBand.rank || 1) < 4) player.potential = Math.min(player.potential, finalBand.max);
  if (story.type && (['generational', 'legend', 'epic'].includes(player.rarity) || player.baseQuality >= 84)) {
    const headline = story.type === 'promotion' ? `${player.name} breaks into the elite`
      : story.type === 'breakout' ? `${player.name}'s breakout season raises the ceiling`
      : story.type === 'late_bloomer' ? `${player.name} blossoms late`
        : `${player.name} shows signs of decline`;
    state.pendingSeasonNews ||= [];
    state.pendingSeasonNews.push({
      id: `news-${state.season + 1}-development-${story.type}-${player.id}`,
      week: 0,
      importance: story.type === 'promotion' ? 'major' : 'digest',
      category: 'Player Development',
      headline,
      body: story.type === 'promotion' ? `A breakout season makes the ${player.roleLabel.toLowerCase()} an Epic player heading into ${state.season + 1}.` : story.type === 'decline'
        ? `${player.name} begins ${state.season + 1} short of last season's level.`
        : `${player.name} heads into ${state.season + 1} with scouts revising their view of the ${player.roleLabel.toLowerCase()}.`,
      entityType: 'player',
      entityId: player.id
    });
  }
}

// Form follows recent ratings and nudges performance (about ±2 rating points at the extremes).
function updatePlayerForm(player, rating) {
  const expected = 6.71 + ((player.rating || 70) - 70) / 80;
  const next = clamp((player.form || 0) * 0.78 + (rating - expected) * 0.32, -1, 1);
  player.form = Math.round(next * 100) / 100;
}

function squadForm(squad) {
  let values = null;
  const players = squad.squad;
  for (let index = 0; index < players.length; index += 1) {
    const form = players[index].depth ? 0 : players[index].form || 0;
    if (form) { values ||= new Array(players.length).fill(0); values[index] = form * 2; }
  }
  return values;
}

// The captain: a leader if there is one, otherwise the senior established player.
function chooseClubCaptain(state, club, players) {
  let best = null, bestScore = -Infinity;
  for (const player of players) {
    if (player.status !== 'active' || player.loan) continue;
    const tenure = playerClubTenure(state, player, state.season);
    const score = (hasTrait(player, 'leader') ? 22 : 0) + (hasTrait(player, 'loyal') ? 5 : 0) - (hasTrait(player, 'hot_headed') ? 4 : 0)
      + player.rating * 0.35 + Math.min(8, tenure) * 2 + Math.min(10, player.careerYear || 0) * 0.6;
    if (score > bestScore) { bestScore = score; best = player; }
  }
  club.captainId = best?.id || null;
}

function assignAllCaptains(state) {
  const cache = getRuntimeCache(state);
  for (const club of state.clubs) chooseClubCaptain(state, club, cache.clubPlayers.get(club.id) || []);
}

// ─── Loans ───────────────────────────────────────────────────────────────────────
// Big clubs send young prospects who would not start to clubs where they will play.
function returnLoanedPlayers(state) {
  for (const player of state.players) {
    if (!player.loan) continue;
    const parent = getClub(state, player.loan.parentClubId);
    if (player.status === 'active' && parent) {
      (state.pendingLoanReturns ||= []).push({ playerId: player.id, fromClubId: player.clubId, toClubId: parent.id });
      player.clubId = parent.id;
      player.clubJoinedSeason = player.loan.parentJoinedSeason ?? player.clubJoinedSeason;
    }
    player.loan = undefined;
  }
}

// Academy intake: top-flight clubs promote a youth graduate most summers (better
// academies at bigger clubs; never above Rare, so rarity caps are untouched). The
// weakest veteran ordinary player makes way, keeping the population stable.
// ─── Youth academies (v4.4) ──────────────────────────────────────────────────────
// Every club has an academy score (0–100, shown as 1–5 stars). Academy Patron owners
// and Youth Developer coaches raise it, money-first owners let it slide, and every
// academy drifts back toward 50. At the Squad Reshape, open squad slots get youth rolls:
// the score sets the chance, the stars set the rarity table, the club's country (and a
// few historic academies) decide how often a star appears.
const HISTORIC_ACADEMIES = new Set(['flamengo', 'santos', 'sao-paulo', 'boca', 'river', 'real-madrid', 'milan', 'ajax', 'benfica', 'sporting', 'barcelona', 'man-utd', 'bayern', 'juventus', 'inter', 'fluminense', 'independiente', 'uru-penarol', 'nacional', 'porto']);
const ELITE_YOUTH_NATIONS = {
  core: new Set(['bra', 'arg', 'ger', 'fra', 'ita', 'esp', 'eng']),
  second: new Set(['por', 'uru', 'ned', 'bel']),
  third: new Set(['col', 'chi', 'mex', 'usa', 'nga', 'cmr', 'mar', 'egy', 'pol', 'rus', 'gre', 'nor', 'swe', 'jpn', 'kor', 'cro', 'srb', 'den', 'sui', 'sen', 'civ', 'gha'])
};
// How often an Epic+ roll survives, by country group (otherwise it becomes a Rare).
const ELITE_YOUTH_KEEP = { core: 1, second: 0.55, third: 0.2, other: 0.05 };
// Rarity tables by academy stars (percent).
const ACADEMY_TABLES = {
  1: { common: 100 },
  2: { common: 55, uncommon: 45 },
  3: { common: 20, uncommon: 52, rare: 23, epic: 4, legend: 0.8 },
  4: { uncommon: 42, rare: 40, epic: 14, legend: 3.4, generational: 0.6 },
  5: { rare: 55, epic: 30, legend: 12, generational: 3 }
};
const ACADEMY_PATRON_GAIN = { generational: 6, legend: 4, epic: 3, rare: 1.5, uncommon: 1, common: 0.5 };
const MONEY_OWNER_LOSS = { generational: 0.5, legend: 1, epic: 2, rare: 3, uncommon: 3.5, common: 4 };
const YOUTH_COACH_GAIN = { generational: 3, legend: 2.5, epic: 2, rare: 1.5, uncommon: 1, common: 0.5 };
const ACADEMY_DRIFT = 0.08;
const PLAYER_CAPS = { generational: 3, legend: 15, epic: 50 };

function academyClass(club) {
  const reputation = club.reputation || 60;
  return reputation >= 85 || clubFinancialTierRank(club) >= 5 ? 'top' : reputation >= 72 ? 'mid' : 'other';
}

function ensureAcademy(club) {
  if (!Number.isFinite(club.academyScore)) club.academyScore = { top: 61, mid: 50, other: 39 }[academyClass(club)];
  club.academyHistory ||= [];
  return club.academyScore;
}

export function academyStars(score) {
  return clamp(Math.floor((score ?? 50) / 20) + 1, 1, 5);
}

function academyDrivers(state, club) {
  const owner = getOwner(state, club.id);
  const coach = getCoach(state, club.id, false);
  const ownerDelta = owner?.profile === 'academy_patron' ? ACADEMY_PATRON_GAIN[owner.rarity] || 0
    : ['billionaire', 'consortium'].includes(owner?.profile) ? -(MONEY_OWNER_LOSS[owner.rarity] || 0) : 0;
  const coachDelta = coach?.profile === 'youth_developer' ? YOUTH_COACH_GAIN[coach.rarity] || 0 : 0;
  return { owner, coach, ownerDelta, coachDelta };
}

// Yearly change, once per offseason.
function updateAcademies(state) {
  for (const club of state.clubs) {
    const score = ensureAcademy(club);
    const { ownerDelta, coachDelta } = academyDrivers(state, club);
    const next = clamp(score + ownerDelta + coachDelta + (club.academyTradition || 0) + (50 - score) * ACADEMY_DRIFT, 0, 100);
    club.academyScore = Number(next.toFixed(1));
    club.academyHistory.push([state.season, club.academyScore]);
    if (club.academyHistory.length > 30) club.academyHistory.shift();
  }
}

function eliteYouthGroup(nationality) {
  if (ELITE_YOUTH_NATIONS.core.has(nationality)) return 'core';
  if (ELITE_YOUTH_NATIONS.second.has(nationality)) return 'second';
  if (ELITE_YOUTH_NATIONS.third.has(nationality)) return 'third';
  return 'other';
}

const RARITY_DOWN = { generational: 'legend', legend: 'epic', epic: 'rare', rare: 'uncommon', uncommon: 'common', common: 'common' };

// Rarity of one academy product: the star table, a boost for historic academies, the
// country's football culture, the population caps and one Generational per club.
function rollYouthRarity(state, club, nationality, counts, clubHasGenerational) {
  const stars = academyStars(club.academyScore);
  const table = { ...ACADEMY_TABLES[stars] };
  if (HISTORIC_ACADEMIES.has(club.id)) for (const rarity of ['epic', 'legend', 'generational']) if (table[rarity]) table[rarity] *= 1.6;
  let rarity = weightedPick(state, Object.keys(table), (key) => table[key]);
  if ((STAR_RARITIES[rarity]?.rank || 1) >= 4 && random(state) > ELITE_YOUTH_KEEP[eliteYouthGroup(nationality)]) rarity = 'rare';
  if (rarity === 'generational' && clubHasGenerational) rarity = 'legend';
  while (PLAYER_CAPS[rarity] !== undefined && (counts[rarity] || 0) >= PLAYER_CAPS[rarity]) rarity = RARITY_DOWN[rarity];
  return rarity;
}

// Creates one academy graduate for a club (an unused historical icon of the club's
// country when an Epic+ comes through and the icon rules allow it).
function createYouthPlayer(state, club, position, counts, clubHasGenerational) {
  const home = COUNTRY_TO_CODE[club.country] || 'eng';
  const nationality = random(state) < 0.92 ? home : chooseNationality(state, 'common', null);
  const rarity = rollYouthRarity(state, club, nationality, counts, clubHasGenerational);
  const debutSeason = state.season + (state.current.completed ? 1 : 0);
  let player = null;
  if ((STAR_RARITIES[rarity]?.rank || 1) >= 4 && shouldSpawnRealWorldStar(state, rarity)) {
    const icons = availableRealWorldStars(state, rarity).filter((template) => template.startCountry === club.country || teamById(template.nationality)?.name === club.country);
    if (icons.length) player = createRealWorldPlayer(state, pick(state, icons), { club, careerYear: 0, debutSeason });
  }
  if (!player) {
    player = createPlayer(state, { club, rarity, position, nationality, careerYear: 0 });
    player.birthYear += debutSeason - state.season;
    player.debutSeason = debutSeason;
  }
  player.clubId = club.id;
  player.debutAge ||= 17;
  player.academy = true;
  player.academyClubId = club.id;
  player.spawnClubId = club.id;
  markPlayerArrival(player, debutSeason);
  player.contractYears = randomInt(state, 3, 5);
  player.salary = Math.max(0.2, Number((player.marketValue * 0.03).toFixed(1)));
  state.players.push(player);
  counts[player.rarity] = (counts[player.rarity] || 0) + 1;
  const record = { playerId: player.id, clubId: club.id, academyStars: academyStars(club.academyScore), rarity: player.rarity, position: player.position, icon: Boolean(player.realWorldId) };
  (state.current.youthIntake ||= []).push(record);
  if ((STAR_RARITIES[player.rarity]?.rank || 1) >= 4) {
    state.current.news.unshift({
      id: `news-${debutSeason}-youth-${player.id}`, week: 0, importance: player.rarity === 'epic' ? 'major' : 'feature', category: 'Youth Academy', storyType: 'youth', relevance: 70 + (STAR_RARITIES[player.rarity].rank - 4) * 10,
      headline: `${club.name}'s academy produces ${player.rarity === 'epic' ? 'an Epic' : `a ${STAR_RARITIES[player.rarity].label}`}`,
      body: `${player.name}, a ${player.roleLabel.toLowerCase()} from ${teamById(player.nationality)?.name || 'abroad'}, joins the first team from the ${academyStars(club.academyScore)}-star academy.`,
      entityType: 'player', entityId: player.id
    });
  }
  return player;
}

// Chance that an open slot is filled by the club's own youth.
function youthSlotChance(club, smallCore = false) {
  const score = club.academyScore ?? 50;
  return smallCore ? 0.15 + score / 100 * 0.4 : 0.25 + score / 100 * 0.6;
}

// Top clubs two seasons without a major trophy make room for youth: up to two veterans
// or Common players are released before the youth rolls.
function majorTrophyDrought(state, club) {
  const majors = new Set([club.leagueId, 'UCL', 'UEL', 'LIB', 'CWC', 'ICUP', `CUP-${club.leagueId}`]);
  const last = (state.history.champions || []).filter((row) => row.winnerId === club.id && majors.has(row.competitionId)).reduce((max, row) => Math.max(max, row.season), -Infinity);
  return state.season - last > 2;
}

// A new world starts with a few elite academies (like the first Generational players):
// four 5-star and eighteen 4-star, weighted toward historic academies, the big
// football nations and big clubs. roll() is the seeded RNG for new worlds, a stable
// per-club roll when an old save is upgraded.
function seedEliteAcademies(state, roll) {
  for (const club of state.clubs) ensureAcademy(club);
  const candidates = state.clubs.filter((club) => club.division === 1).map((club) => {
    const nation = eliteYouthGroup(COUNTRY_TO_CODE[club.country] || '');
    const weight = (HISTORIC_ACADEMIES.has(club.id) ? 6 : 1) * ({ core: 3, second: 1.6, third: 0.7, other: 0.35 }[nation]) * ((club.reputation || 60) / 80) ** 2;
    return { club, key: Math.pow(Math.max(1e-6, roll(club)), 1 / weight) };
  }).sort((a, b) => b.key - a.key);
  const fiveStar = Math.max(3, Math.round(candidates.length * 0.045));
  const fourStar = Math.max(8, Math.round(candidates.length * 0.08));
  // Seeded academies have a youth tradition that keeps them near their level.
  candidates.slice(0, fiveStar).forEach(({ club }) => { club.academyScore = 82 + Math.floor(roll(club) * 13); club.academyTradition = 3.4; });
  candidates.slice(fiveStar, fiveStar + fourStar).forEach(({ club }) => { club.academyScore = 62 + Math.floor(roll(club) * 15); club.academyTradition = 1.6; });
  for (const club of state.clubs) if (HISTORIC_ACADEMIES.has(club.id)) club.academyTradition = Math.max(club.academyTradition || 0, 1.6);
  // Starting point for the trend chart.
  for (const club of state.clubs) if (ensureAcademy(club) >= 0 && !club.academyHistory.length) club.academyHistory.push([state.season, Number(club.academyScore.toFixed(1))]);
}

export function getClubAcademy(state, clubId) {
  const club = getClub(state, clubId);
  if (!club) return null;
  const score = ensureAcademy(club);
  const { owner, coach, ownerDelta, coachDelta } = academyDrivers(state, club);
  const graduates = (state.players || []).filter((player) => player.academyClubId === clubId || (player.academy && !player.academyClubId && player.spawnClubId === clubId));
  return {
    score: Math.round(score), stars: academyStars(score), history: club.academyHistory.map(([season, value]) => ({ season, score: value })),
    historic: HISTORIC_ACADEMIES.has(clubId),
    drivers: { ownerId: owner?.id || null, ownerProfile: owner?.profile || null, ownerDelta, coachId: coach?.id || null, coachProfile: coach?.profile || null, coachDelta, tradition: club.academyTradition || 0, drift: Number(((50 - score) * ACADEMY_DRIFT).toFixed(1)) },
    graduates: graduates.length, activeGraduates: graduates.filter((player) => player.status === 'active').length
  };
}

export function getYouthIntake(state, { clubId = null } = {}) {
  const rows = (state.current?.youthIntake || []).filter((row) => !clubId || row.clubId === clubId);
  return rows.map((row) => ({ ...row, rating: getPlayer(state, row.playerId)?.rating ?? null }))
    .sort((a, b) => (STAR_RARITIES[b.rarity]?.rank || 0) - (STAR_RARITIES[a.rarity]?.rank || 0) || (b.rating || 0) - (a.rating || 0));
}

export function getBestAcademies(state, limit = 30) {
  return state.clubs.filter((club) => club.division === 1).map((club) => ({ clubId: club.id, score: Math.round(ensureAcademy(club)), stars: academyStars(club.academyScore), historic: HISTORIC_ACADEMIES.has(club.id) }))
    .sort((a, b) => b.score - a.score || a.clubId.localeCompare(b.clubId)).slice(0, limit);
}

// Elite safety net: academies supply the stars; this only refills a floor if a run of
// quiet years leaves the world short of elite players.
const ELITE_FLOORS = { generational: 2, legend: 12, epic: 40 };
function topUpElitePopulation(state) {
  const counts = rarityCounts(state);
  let spawned = 0;
  for (const [rarity, floor] of Object.entries(ELITE_FLOORS)) {
    while ((counts[rarity] || 0) < floor) {
      const template = shouldSpawnRealWorldStar(state, rarity) ? pick(state, availableRealWorldStars(state, rarity)) : null;
      const player = template ? createRealWorldPlayer(state, template, { careerYear: 0, debutSeason: state.season }) : createPlayer(state, { rarity, careerYear: 0, nationalSpecialist: true });
      const club = template ? resolveRealWorldClub(state, state.clubs, template) : chooseRookieDestination(state, state.clubs, player);
      if (club) { player.clubId = club.id; player.spawnClubId = club.id; markPlayerArrival(player, state.season); player.contractYears = randomInt(state, 2, 5); player.salary = Number((player.marketValue * 0.045).toFixed(1)); }
      state.players.push(player);
      counts[rarity] = (counts[rarity] || 0) + 1;
      spawned += 1;
    }
  }
  if (state.current) state.current.eliteTopUps = spawned;
  return spawned;
}

function runAcademyIntake(state) {
  const cache = getRuntimeCache(state);
  let graduates = 0;
  for (const club of state.clubs) {
    if (club.division !== 1 || club.tier !== 'detailed') continue;
    const reputation = club.reputation || 60;
    if (random(state) > clamp((reputation - 45) / 70, 0.15, 0.7)) continue;
    const roll = random(state);
    const rare = reputation >= 88 ? 0.35 : reputation >= 75 ? 0.15 : 0.05;
    const uncommon = reputation >= 88 ? 0.5 : 0.45;
    const rarity = roll < rare ? 'rare' : roll < rare + uncommon ? 'uncommon' : 'common';
    const roster = cache.clubPlayers.get(club.id) || [];
    const position = positionNeedFromRoster(state, club, roster);
    const graduate = createPlayer(state, { club, rarity, position, careerYear: 0 });
    graduate.birthYear += 1;
    graduate.debutSeason = state.season;
    graduate.debutAge ||= 17;
    graduate.academy = true;
    markPlayerArrival(graduate, state.season);
    graduate.contractYears = randomInt(state, 3, 5);
    graduate.salary = Math.max(0.2, Number((graduate.marketValue * 0.03).toFixed(1)));
    state.players.push(graduate);
    roster.push(graduate);
    cache.playerById.set(graduate.id, graduate);
    const veteran = roster.filter((player) => player !== graduate && ['common', 'uncommon'].includes(player.rarity) && (player.careerYear || 0) >= 7 && !player.loan && player.clubJoinedSeason !== state.season)
      .sort((a, b) => a.rating - b.rating)[0];
    if (veteran && roster.length > SQUAD_SIZE) {
      veteran.lastClubId = club.id;
      noteRosterChange(state, veteran, club.id, null);
      veteran.clubId = null;
      veteran.contractYears = 0;
      veteran.salary = 0;
    }
    cache.clubSquads.delete(club.id);
    graduates += 1;
  }
  return graduates;
}

function runLoanMarket(state) {
  const cache = getRuntimeCache(state);
  const lenders = state.clubs.filter((club) => club.division === 1 && club.tier === 'detailed' && (club.reputation || 0) >= 80);
  const borrowersByConfederation = new Map();
  for (const club of state.clubs) {
    if ((club.reputation || 0) >= 84 || (club.reputation || 0) < 55) continue;
    if (!borrowersByConfederation.has(club.confederation)) borrowersByConfederation.set(club.confederation, []);
    borrowersByConfederation.get(club.confederation).push(club);
  }
  const received = new Map();
  let loans = 0;
  for (const lender of lenders) {
    if (loans >= 120) break;
    const squad = getClubSquad(state, lender.id);
    const starters = new Set(squad.starters);
    const prospects = (cache.clubPlayers.get(lender.id) || [])
      .filter((player) => player.status === 'active' && !starters.has(player) && (player.careerYear || 0) <= 3 && !player.loan && player.clubJoinedSeason !== state.season
        && (player.potential || player.baseQuality) >= Math.max(68, (lender.strength || 70) - 12))
      .sort((a, b) => (b.potential || 0) - (a.potential || 0))
      .slice(0, 2);
    for (const player of prospects) {
      if (random(state) > 0.7) continue;
      const options = (borrowersByConfederation.get(lender.confederation) || [])
        .filter((club) => club.id !== lender.id && (club.reputation || 0) <= (lender.reputation || 80) - 5 && (received.get(club.id) || 0) < 2)
        .filter((club) => {
          // The borrower must have a starting place: the prospect beats its weakest starter there.
          const borrowerSquad = getClubSquad(state, club.id);
          const weakest = borrowerSquad.xi.filter((row) => slotLine(row.slotType) === player.position).sort((a, b) => a.effective - b.effective)[0];
          return weakest && player.rating >= weakest.effective - 4;
        });
      if (!options.length) continue;
      const borrower = weightedPick(state, options, (club) => (club.country === lender.country ? 3 : 1) * Math.max(1, (club.reputation || 60) - 55));
      player.loan = { parentClubId: lender.id, season: state.season, parentJoinedSeason: player.clubJoinedSeason ?? null };
      player.loanHistory ||= [];
      player.loanHistory.push({ season: state.season, clubId: borrower.id, parentClubId: lender.id });
      noteRosterChange(state, player, lender.id, borrower.id);
      player.clubId = borrower.id;
      received.set(borrower.id, (received.get(borrower.id) || 0) + 1);
      const record = { id: `transfer-${state.nextTransferId++}`, season: state.season, seasonLabel: formatSeason(state.season), playerId: player.id,
        fromClubId: lender.id, toClubId: borrower.id, fee: 0, marketValue: player.marketValue, freeTransfer: false, loan: true };
      state.current.transfers.push(record);
      state.history.transfers.push(record);
      loans += 1;
    }
  }
  return loans;
}


// ─── Predictions game ────────────────────────────────────────────────────────────
// Before a ball is kicked the reader picks league champions, the Champions League
// winner, the Ballon d'Or and the World Golden Boot. Picks lock once the season starts
// and are scored at Awards Night (after every Showcase result is revealed).
const PREDICTION_LEAGUES = ['ENG1', 'ESP1', 'ITA1', 'GER1', 'FRA1'];
export const PREDICTION_POINTS = { league: { hit: 3, close: 1 }, UCL: { hit: 5, close: 2 }, ballon_dor: { hit: 5, close: 2 }, golden_boot: { hit: 3, close: 1 } };

function ensurePredictions(state) {
  state.predictions ||= { current: null, history: [] };
  state.predictions.history ||= [];
  if (!state.predictions.current || state.predictions.current.season !== state.season) {
    state.predictions.current = { season: state.season, picks: {} };
  }
  return state.predictions;
}

export function predictionsLocked(state) {
  return (state.current?.week || 0) > 0 || Boolean(state.current?.completed);
}

export function getPredictionForm(state) {
  const predictions = ensurePredictions(state);
  const questions = [];
  for (const leagueId of PREDICTION_LEAGUES) {
    const league = state.current.leagues?.[leagueId];
    if (!league) continue;
    const options = league.table.map((row) => getClub(state, row.teamId)).filter(Boolean)
      .sort((a, b) => getTeamPower(state, b.id, false) - getTeamPower(state, a.id, false)).slice(0, 10)
      .map((club) => ({ id: club.id, kind: 'club' }));
    questions.push({ key: leagueId, type: 'league', label: `${league.name} champions`, competitionId: leagueId, options });
  }
  const uclClubs = state.clubs.filter((club) => club.confederation === 'Europe' && club.division === 1 && club.tier === 'detailed')
    .sort((a, b) => getTeamPower(state, b.id, false) - getTeamPower(state, a.id, false)).slice(0, 16)
    .map((club) => ({ id: club.id, kind: 'club' }));
  questions.push({ key: 'UCL', type: 'UCL', label: 'Champions League winners', competitionId: 'UCL', options: uclClubs });
  const stars = state.players.filter((player) => player.status === 'active' && player.clubId)
    .sort((a, b) => b.rating - a.rating).slice(0, 20);
  questions.push({ key: 'ballon_dor', type: 'ballon_dor', label: "Ballon d'Or", options: stars.map((player) => ({ id: player.id, kind: 'player' })) });
  const scorers = state.players.filter((player) => player.status === 'active' && player.clubId && player.position === 'FW')
    .sort((a, b) => b.rating - a.rating).slice(0, 20);
  questions.push({ key: 'golden_boot', type: 'golden_boot', label: 'World Golden Boot', options: scorers.map((player) => ({ id: player.id, kind: 'player' })) });
  return { season: state.season, locked: predictionsLocked(state), picks: { ...predictions.current.picks }, questions, points: PREDICTION_POINTS };
}

export function setPrediction(state, key, value) {
  if (predictionsLocked(state)) return false;
  const predictions = ensurePredictions(state);
  if (!value) delete predictions.current.picks[key];
  else predictions.current.picks[key] = String(value);
  return true;
}

// Scores the season's picks against the outcomes. Pure: nothing is stored here.
export function scorePredictions(state, season = state.season, picks = state.predictions?.current?.season === season ? state.predictions.current.picks : null) {
  if (!picks || !Object.keys(picks).length) return null;
  const champions = (state.history.champions || []).filter((row) => row.season === season);
  const awards = (state.history.awards || []).filter((row) => row.season === season);
  const rows = [];
  for (const [key, pick] of Object.entries(picks)) {
    let outcome = null, close = false, type = key;
    if (PREDICTION_LEAGUES.includes(key)) {
      type = 'league';
      const title = champions.find((row) => row.competitionId === key);
      outcome = title?.winnerId || null;
      close = Boolean(title && title.runnerUpId === pick);
    } else if (key === 'UCL') {
      const title = champions.find((row) => row.competitionId === 'UCL');
      outcome = title?.winnerId || null;
      close = Boolean(title && title.runnerUpId === pick);
    } else if (key === 'ballon_dor' || key === 'golden_boot') {
      const podium = awards.filter((row) => row.category === key).sort((a, b) => a.rank - b.rank);
      outcome = podium[0]?.playerId || null;
      close = podium.slice(1, 3).some((row) => row.playerId === pick);
    } else continue;
    const table = PREDICTION_POINTS[type];
    const points = !outcome ? 0 : outcome === pick ? table.hit : close ? table.close : 0;
    rows.push({ key, pick, outcome, points, hit: outcome === pick, close: outcome !== pick && close });
  }
  return { season, rows, points: rows.reduce((sum, row) => sum + row.points, 0), max: rows.reduce((sum, row) => sum + PREDICTION_POINTS[PREDICTION_LEAGUES.includes(row.key) ? 'league' : row.key].hit, 0) };
}

// At the start of the next season the scored card joins the history.
function archivePredictions(state) {
  const current = state.predictions?.current;
  if (!current || current.season !== state.season) return;
  const score = scorePredictions(state, current.season, current.picks);
  if (score) state.predictions.history.push({ ...score, seasonLabel: formatSeason(current.season), picks: { ...current.picks } });
  state.predictions.current = null;
}

export function getPredictionHistory(state) {
  return (state.predictions?.history || []).slice().reverse();
}

// ─── Mid-season sackings ─────────────────────────────────────────────────────────
// Every three weeks boards review coaches whose side sits well below expectations
// and is in poor form. Patience, coach reputation and recent trophies protect the
// coach; an interim takes over and the squad usually responds for a few weeks.
function reviewCoachesMidSeason(state, week) {
  if (week < 10 || week > 44 || week % 3 !== 0) return;
  // At most two sackings per league and fifty across the world in a season.
  const tally = state.current.midSeasonSackings ||= { total: 0, leagues: {} };
  for (const [leagueId, league] of Object.entries(state.current.leagues || {})) {
    if (league.tier !== 'detailed') continue;
    const rows = sortTable(league.table);
    const size = rows.length;
    const byReputation = rows.map((row) => getClub(state, row.teamId)).filter(Boolean).sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
    rows.forEach((row, index) => {
      if (tally.total >= 50 || (tally.leagues[leagueId] || 0) >= 2 || row.played < 8) return;
      const club = getClub(state, row.teamId);
      const coach = club ? getCoach(state, club.id, false) : null;
      if (!club || !coach || club.lastSackingSeason === state.season) return;
      const expected = byReputation.indexOf(club) + 1;
      const actual = index + 1;
      const gap = actual - expected;
      const recent = row.form || [];
      const recentPoints = recent.reduce((sum, result) => sum + (result === 'W' ? 3 : result === 'D' ? 1 : 0), 0) / Math.max(1, recent.length);
      if (gap < Math.max(3, Math.round(size * 0.2)) || recentPoints >= 1.2) return;
      const protection = coach.rarity === 'generational' ? 0.25 : coach.rarity === 'legend' ? 0.45 : coach.rarity === 'epic' ? 0.7 : 1;
      const recentTitles = (state.history.champions || []).some((title) => title.coachId === coach.id && title.season >= state.season - 2) ? 0.5 : 1;
      const ambition = (club.reputation || 60) >= 86 && actual > 4 ? 0.1 : 0;
      const chance = clamp((0.025 + gap * 0.008 + (1.2 - recentPoints) * 0.08 + ambition) / (club.ownerPatience || 1) * protection * recentTitles, 0, 0.6);
      if (random(state) >= chance) return;
      tally.total += 1;
      tally.leagues[leagueId] = (tally.leagues[leagueId] || 0) + 1;
      sackCoachMidSeason(state, club, coach, week, actual);
    });
  }
}

function sackCoachMidSeason(state, club, coach, week, position) {
  coach.clubId = null;
  coach.interim = false;
  coach.performanceScore = -3;
  club.lastSackingSeason = state.season;
  state.history.coachMoves.push({ season: state.season, week, coachId: coach.id, fromClubId: club.id, toClubId: null, reason: 'sacked mid-season' });
  // Interim: the best available domestic coach without a job, or a caretaker.
  const nationality = COUNTRY_TO_CODE[club.country] || null;
  let interim = state.coaches.filter((candidate) => candidate.status !== 'retired' && !candidate.clubId && !candidate.nationalTeamId
    && candidate.nationality === nationality && !['legend', 'generational'].includes(candidate.rarity))
    .sort((a, b) => b.quality - a.quality)[0];
  if (!interim) {
    interim = createStaffMember(state, 'coach', nationality || 'eng', { rarity: random(state) < 0.3 ? 'uncommon' : 'common', careerYear: randomInt(state, 0, 3), debutSeason: state.season, appointmentSeason: state.season, status: 'active' });
    state.coaches.push(interim);
    getRuntimeCache(state).coachById.set(interim.id, interim);
  }
  assignCoachToClub(state, interim, club);
  interim.interim = true;
  club.newCoachBounce = { season: state.season, week, value: 1.0 };
  state.history.coachMoves.push({ season: state.season, week, coachId: interim.id, fromClubId: null, toClubId: club.id, reason: 'interim appointment' });
  state.current.news.unshift({
    id: `news-${state.season}-${week}-sacked-${club.id}`,
    week,
    importance: (club.reputation || 60) >= 84 ? 'major' : 'digest',
    category: 'Coaching Market',
    storyType: 'sacking',
    relevance: 55 + Math.max(0, (club.reputation || 60) - 70),
    headline: `${club.name} sack ${coach.name}`,
    body: `${coach.name} leaves with the club ${position}${position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'} in the league. ${interim.name} takes charge on an interim basis.`,
    entityType: 'club',
    entityId: club.id
  });
}

// The new-coach bounce fades over six weeks.
function newCoachBounce(state, club) {
  const bounce = club?.newCoachBounce;
  if (!bounce || bounce.season !== state.season) return 0;
  const weeks = state.current.week - bounce.week;
  return weeks >= 0 && weeks < 6 ? bounce.value * (1 - weeks / 6) : 0;
}

// ─── Records and milestones ──────────────────────────────────────────────────────
// state.records = { streaks: {clubId: {unbeaten, wins, since}}, allTime: {...},
//   competitions: {competitionId: {...}}, invincibles: [] }
// Updated live from every recorded result. Matches selected for the Showcase are
// held back until the next season starts so nothing reveals an unplayed result.
const CAREER_GOAL_MILESTONES = [100, 200, 300, 400, 500, 600];
const CAREER_APP_MILESTONES = [500, 600, 700, 800];

function ensureRecords(state) {
  state.records ||= { streaks: {}, allTime: {}, competitions: {}, invincibles: [] };
  state.records.streaks ||= {};
  state.records.allTime ||= {};
  state.records.competitions ||= {};
  state.records.invincibles ||= [];
  state.records.derbies ||= {};
  return state.records;
}

// All-time derby ledger, keyed by the two club ids in alphabetical order.
function noteDerbyMeeting(state, match) {
  if (!match.derby || match.isInternational) return;
  const [a, b] = [match.homeId, match.awayId].sort();
  const row = ensureRecords(state).derbies[`${a}|${b}`] ||= { a, b, name: match.derby, meetings: 0, aWins: 0, bWins: 0, draws: 0, aGoals: 0, bGoals: 0, recent: [] };
  const aGoals = match.homeId === a ? match.homeGoals : match.awayGoals;
  const bGoals = match.homeId === a ? match.awayGoals : match.homeGoals;
  row.meetings += 1;
  row.aGoals += aGoals;
  row.bGoals += bGoals;
  if (aGoals > bGoals) row.aWins += 1; else if (bGoals > aGoals) row.bWins += 1; else row.draws += 1;
  row.recent.push({ matchId: match.id, season: match.season ?? state.season, homeId: match.homeId, awayId: match.awayId, homeGoals: match.homeGoals, awayGoals: match.awayGoals, competitionId: match.competitionId, stage: match.stage || null });
  if (row.recent.length > 6) row.recent.shift();
}

// Head-to-head from one club's side: wins, draws, losses, goals and recent meetings.
export function getDerbyRecord(state, clubId, opponentId) {
  const [a, b] = [clubId, opponentId].sort();
  const row = state.records?.derbies?.[`${a}|${b}`];
  if (!row) return null;
  const mine = clubId === a;
  return { name: row.name, meetings: row.meetings, wins: mine ? row.aWins : row.bWins, losses: mine ? row.bWins : row.aWins, draws: row.draws, gf: mine ? row.aGoals : row.bGoals, ga: mine ? row.bGoals : row.aGoals, recent: row.recent.slice().reverse() };
}

function recordStory(state, { id, headline, body, entityType = null, entityId = null, matchId = null, importance = 'major', competitionId = null }) {
  state.current.news.unshift({
    id: `news-${state.season}-${state.current.week}-record-${id}`,
    week: state.current.week,
    importance,
    category: 'Records',
    storyType: 'record',
    relevance: 72,
    headline,
    body,
    ...(entityType ? { entityType, entityId } : {}),
    ...(matchId ? { matchId } : {}),
    ...(competitionId ? { competitionLabel: competitionId } : {})
  });
}

function playerAgeYears(state, player) {
  return state.season - (player.birthYear || state.season - 25) + (state.current.week || 0) / 52;
}

// Career goal and appearance counters, filled once from history on first use.
function ensureCareerCounters(state) {
  if (state.records?.countersReady) return;
  const goals = new Map();
  const apps = new Map();
  for (const row of state.history.playerSeasons || []) {
    goals.set(row.playerId, (goals.get(row.playerId) || 0) + (row.goals || 0));
    apps.set(row.playerId, (apps.get(row.playerId) || 0) + (row.apps || 0));
  }
  for (const row of Object.values(state.current?.playerStats || {})) {
    goals.set(row.playerId, (goals.get(row.playerId) || 0) + (row.goals || 0));
    apps.set(row.playerId, (apps.get(row.playerId) || 0) + (row.apps || 0));
  }
  for (const player of state.players) {
    player.careerGoals = goals.get(player.id) || 0;
    player.careerApps = apps.get(player.id) || 0;
  }
  ensureRecords(state).countersReady = true;
}

function noteCareerGoal(state, player, match) {
  const before = player.careerGoals || 0;
  player.careerGoals = before + 1;
  const milestone = CAREER_GOAL_MILESTONES.find((value) => before < value && player.careerGoals >= value);
  if (milestone) {
    recordStory(state, {
      id: `goals-${milestone}-${player.id}`,
      headline: `${player.name} scores career goal number ${milestone}`,
      body: `${player.name} reaches ${milestone} career goals in the ${match.competitionName || 'match'}.`,
      entityType: 'player', entityId: player.id, matchId: match.id, importance: milestone >= 300 ? 'feature' : 'major'
    });
  }
  const best = state.records.allTime.mostCareerGoals;
  if (!best || player.careerGoals > best.goals) {
    if (best && best.playerId !== player.id && player.careerGoals === best.goals + 1) {
      recordStory(state, { id: `career-goals-${player.id}`, headline: `${player.name} becomes the all-time leading scorer`, body: `${player.name} passes ${getPlayer(state, best.playerId)?.name || 'the previous record holder'} with ${player.careerGoals} career goals.`, entityType: 'player', entityId: player.id, matchId: match.id, importance: 'feature' });
    }
    state.records.allTime.mostCareerGoals = { playerId: player.id, goals: player.careerGoals, season: state.season };
  }
}

function noteCareerApps(state, player, count, match = null) {
  const before = player.careerApps || 0;
  player.careerApps = before + count;
  const milestone = CAREER_APP_MILESTONES.find((value) => before < value && player.careerApps >= value);
  if (milestone && (STAR_RARITIES[player.rarity]?.rank || 1) >= 3) {
    recordStory(state, { id: `apps-${milestone}-${player.id}`, headline: `${player.name} reaches ${milestone} career appearances`, body: `A landmark for the ${player.roleLabel.toLowerCase()}.`, entityType: 'player', entityId: player.id, matchId: match?.id || null, importance: 'digest' });
  }
  const best = state.records.allTime.mostCareerApps;
  if (!best || player.careerApps > best.apps) state.records.allTime.mostCareerApps = { playerId: player.id, apps: player.careerApps, season: state.season };
}

function noteStreakRecord(state, records, match, teamId, key, value, label) {
  if (value < 10) return;
  const best = records.allTime[key];
  if (best && value <= best.matches) return;
  if (value >= 20 && (!best || best.clubId !== teamId)) {
    recordStory(state, { id: `${key}-${teamId}-${value}`, headline: `${getClub(state, teamId)?.name} set a new record ${label}`, body: `${value} league matches${label === 'unbeaten run' ? ' without defeat' : ' won in a row'}, the longest in history.`, entityType: 'club', entityId: teamId, matchId: match.id });
  }
  records.allTime[key] = { clubId: teamId, matches: value, season: state.season, leagueId: match.competitionId };
}

function noteStreak(state, records, match, teamId, goalsFor, goalsAgainst) {
  let streak = records.streaks[teamId];
  if (!streak) streak = records.streaks[teamId] = { unbeaten: 0, wins: 0, since: state.season };
  if (goalsFor < goalsAgainst) { streak.unbeaten = 0; streak.since = state.season; } else streak.unbeaten += 1;
  streak.wins = goalsFor > goalsAgainst ? streak.wins + 1 : 0;
  noteStreakRecord(state, records, match, teamId, 'longestUnbeaten', streak.unbeaten, 'unbeaten run');
  noteStreakRecord(state, records, match, teamId, 'longestWinning', streak.wins, 'winning run');
}

// One completed match updates streaks, scoring records and milestones.
function updateRecordsFromMatch(state, match, players = null) {
  if (isShowcaseSelectedMatch(state, match)) {
    (state.current.heldRecordMatches ||= []).push(match.id);
    return;
  }
  const records = ensureRecords(state);
  ensureCareerCounters(state);
  noteDerbyMeeting(state, match);
  const competition = records.competitions[match.competitionId] ||= {};
  const league = state.current.leagues?.[match.competitionId];
  // Biggest win in this competition and overall.
  const margin = Math.abs(match.homeGoals - match.awayGoals);
  if (margin >= 4) {
    const entry = { matchId: match.id, season: state.season, homeId: match.homeId, awayId: match.awayId, score: `${match.homeGoals}-${match.awayGoals}`, margin, isInternational: Boolean(match.isInternational), competitionId: match.competitionId };
    if (!competition.biggestWin || margin > competition.biggestWin.margin) competition.biggestWin = entry;
    if (!records.allTime.biggestWin || margin > records.allTime.biggestWin.margin) {
      if (records.allTime.biggestWin && !match.light) recordStory(state, { id: `biggest-win-${match.id}`, headline: `${getTeamName(state, match.winnerId || (match.homeGoals > match.awayGoals ? match.homeId : match.awayId), match.isInternational)} record the biggest win in history`, body: `${getTeamName(state, match.homeId, match.isInternational)} ${match.homeGoals}-${match.awayGoals} ${getTeamName(state, match.awayId, match.isInternational)}.`, matchId: match.id });
      records.allTime.biggestWin = entry;
    }
  }
  // League streaks: unbeaten and winning runs carry across seasons.
  if (league && !match.isInternational) {
    noteStreak(state, records, match, match.homeId, match.homeGoals, match.awayGoals);
    noteStreak(state, records, match, match.awayId, match.awayGoals, match.homeGoals);
  }
  // Goals: milestones, season scoring records, youngest and oldest scorers.
  for (const goal of match.goalEvents || []) {
    const player = goal.scorerId ? getPlayer(state, goal.scorerId) : null;
    if (!player) continue;
    noteCareerGoal(state, player, match);
    const age = playerAgeYears(state, player);
    const young = !competition.youngestScorer || age < competition.youngestScorer.age;
    const old = !competition.oldestScorer || age > competition.oldestScorer.age;
    const overallYoung = !match.light && (!records.allTime.youngestScorer || age < records.allTime.youngestScorer.age);
    const overallOld = !match.light && (!records.allTime.oldestScorer || age > records.allTime.oldestScorer.age);
    if (young || old || overallYoung || overallOld) {
      const scorer = { playerId: player.id, age: Number(age.toFixed(2)), season: state.season, competitionId: match.competitionId, matchId: match.id };
      if (young) competition.youngestScorer = scorer;
      if (old) competition.oldestScorer = scorer;
      if (overallYoung) {
        if (records.allTime.youngestScorer) recordStory(state, { id: `youngest-${player.id}`, headline: `${player.name} becomes the youngest scorer on record`, body: `Scoring at ${Math.floor(age)} in the ${match.competitionName}.`, entityType: 'player', entityId: player.id, matchId: match.id, importance: 'digest' });
        records.allTime.youngestScorer = scorer;
      }
      if (overallOld) records.allTime.oldestScorer = scorer;
    }
    const stat = league ? state.current.playerStats[`${player.id}::${match.competitionId}`] : null;
    if (stat) {
      const best = competition.mostGoalsSeason;
      if (!best || stat.goals > best.goals) {
        if (best && best.season !== state.season && stat.goals === best.goals + 1) {
          recordStory(state, { id: `league-goals-${match.competitionId}-${player.id}`, headline: `${player.name} breaks the ${match.competitionName} scoring record`, body: `${stat.goals} league goals in a season, one more than ${getPlayer(state, best.playerId)?.name || 'the previous best'}.`, entityType: 'player', entityId: player.id, matchId: match.id, importance: 'feature' });
        }
        competition.mostGoalsSeason = { playerId: player.id, goals: stat.goals, season: state.season, teamId: stat.teamId };
      }
    }
  }
  // Appearances (full-engine matches; light appearances arrive at season close).
  if (players) for (const row of players) {
    if (!row.id) continue;
    const player = getPlayer(state, row.id);
    if (player) noteCareerApps(state, player, 1, match);
  }
}

// Season close: invincibles and season goal tallies; Showcase-held matches wait.
function updateSeasonRecords(state) {
  const records = ensureRecords(state);
  for (const league of Object.values(state.current.leagues || {})) {
    if (league.tier !== 'detailed') continue;
    const table = league.table || [];
    for (const row of table) {
      const club = getClub(state, row.teamId);
      if (club?.division !== 1) continue;
      if (row.played >= 30 && row.losses === 0) {
        records.invincibles.push({ clubId: row.teamId, season: state.season, leagueId: league.id, played: row.played, wins: row.wins, draws: row.draws, points: row.points });
        recordStory(state, { id: `invincible-${row.teamId}`, headline: `${club.name} go a whole ${league.name} season unbeaten`, body: `${row.wins} wins and ${row.draws} draws from ${row.played} matches: invincibles.`, entityType: 'club', entityId: row.teamId, importance: 'feature' });
      }
      const clubRecord = records.allTime.mostLeagueGoalsClub;
      if (!clubRecord || row.gf > clubRecord.goals) records.allTime.mostLeagueGoalsClub = { clubId: row.teamId, goals: row.gf, season: state.season, leagueId: league.id };
      const competition = records.competitions[league.id] ||= {};
      if (!competition.mostPoints || row.points > competition.mostPoints.points) competition.mostPoints = { clubId: row.teamId, points: row.points, season: state.season };
    }
  }
  // Season goals across all competitions; light-league appearances counted now.
  const totals = new Map();
  for (const row of Object.values(state.current.playerStats || {})) totals.set(row.playerId, (totals.get(row.playerId) || 0) + (row.goals || 0));
  for (const [playerId, goals] of totals) {
    const best = records.allTime.mostGoalsSeason;
    if (!best || goals > best.goals) records.allTime.mostGoalsSeason = { playerId, goals, season: state.season, held: true };
  }
}

// Matches held back for the Showcase count once the postseason is over.
function releaseHeldRecords(state) {
  if (state.records?.allTime?.mostGoalsSeason) state.records.allTime.mostGoalsSeason.held = false;
  const held = state.current.heldRecordMatches || [];
  if (!held.length) return;
  const ids = new Set(held);
  state.current.heldRecordMatches = [];
  for (const match of state.current.archivedKnockoutMatches || []) {
    if (!ids.has(match.id)) continue;
    const records = ensureRecords(state);
    ensureCareerCounters(state);
    noteDerbyMeeting(state, match);
    for (const goal of match.goalEvents || []) {
      const player = goal.scorerId ? getPlayer(state, goal.scorerId) : null;
      if (player) player.careerGoals = (player.careerGoals || 0) + 1;
    }
    const margin = Math.abs(match.homeGoals - match.awayGoals);
    const competition = records.competitions[match.competitionId] ||= {};
    if (margin >= 4 && (!competition.biggestWin || margin > competition.biggestWin.margin)) {
      competition.biggestWin = { matchId: match.id, season: match.season, homeId: match.homeId, awayId: match.awayId, score: `${match.homeGoals}-${match.awayGoals}`, margin, isInternational: Boolean(match.isInternational), competitionId: match.competitionId };
    }
  }
  if (state.records?.allTime?.mostGoalsSeason) state.records.allTime.mostGoalsSeason.held = false;
}

function noteTransferFeeRecord(state, player, buyer, seller, fee) {
  const records = ensureRecords(state);
  const best = records.allTime.recordTransfer;
  if (fee > 0 && (!best || fee > best.fee)) {
    if (best) recordStory(state, { id: `fee-${player.id}`, headline: `${player.name} breaks the world transfer record`, body: `${buyer.name} pay ${fee.toFixed(1)}m${seller ? ` to ${seller.name}` : ''}, beating the ${best.fee.toFixed(1)}m paid for ${getPlayer(state, best.playerId)?.name || 'the previous record signing'}.`, entityType: 'player', entityId: player.id, importance: 'feature' });
    records.allTime.recordTransfer = { playerId: player.id, fee, season: state.season, fromClubId: seller?.id || null, toClubId: buyer.id };
  }
}

export function getWorldRecords(state) {
  const records = ensureRecords(state);
  const seasonHeld = state.current?.completed && !state.current?.postseason?.completed;
  const allTime = { ...records.allTime };
  if (seasonHeld && allTime.mostGoalsSeason?.held && allTime.mostGoalsSeason.season === state.season) delete allTime.mostGoalsSeason;
  return { allTime, competitions: records.competitions, invincibles: records.invincibles, streaks: records.streaks, shootouts: getShootoutLeaders(state, 5) };
}

// Season close: light-match appearances become player statistics (starters play
// every game, substitutes about a third), with ratings from team results and ability.
function flushLightAppearances(state) {
  const rows = state.current.lightApps || {};
  for (const [key, row] of Object.entries(rows)) {
    if (!row.played) continue;
    const [competitionId, teamId] = key.split('::');
    const club = getClub(state, teamId);
    if (!club) continue;
    const squad = getClubSquad(state, teamId);
    const pointsPerGame = row.points / row.played;
    const assign = (player, apps, starts, started) => {
      if (!apps || player.depth) return;
      const stat = ensurePlayerStat(state, player.id, competitionId, teamId, false);
      const goalsPerGame = (stat.goals + stat.assists * 0.6) / apps;
      // Season form varies by player, so the top scorer is not automatically the
      // best-rated player of a league.
      const form = (stableStringRoll(`${state.season}:${player.id}:${competitionId}:light-form`) - 0.5) * 0.5;
      const rating = clamp(6.62 + (player.rating - 70) / 80 + (pointsPerGame - 1.37) * 0.3 + Math.min(0.4, goalsPerGame * 0.25) + form
        + ({ GK: -0.04, DF: 0.04, MF: 0.05, FW: 0 }[player.position] || 0), 5.6, 8.6);
      stat.apps += apps;
      stat.starts += starts;
      noteCareerApps(state, player, apps);
      stat.ratingSum += rating * apps;
      stat.averageRating = stat.ratingSum / stat.apps;
      stat.minutes = (stat.minutes || 0) + apps * (started ? 84 : 25);
      if (started && (player.position === 'GK' || player.position === 'DF')) stat.cleanSheets += Math.min(apps, row.cleanSheets);
    };
    for (const player of squad.starters) assign(player, row.played, row.played, true);
    for (const player of squad.bench) assign(player, Math.round(row.played * 0.35), 0, false);
    row.played = 0;
  }
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
  neutral = false,
  aggregate = null,
  record = true,
  light = null
}) {
  if (light ?? (record && isLightMatch(state, { competitionId, homeId, awayId, stage, isInternational, aggregate }))) {
    return simulateLightMatch(state, { homeId, awayId, competitionId, competitionName, week, knockout, stage, table, neutral, record });
  }
  const stakes = record ? matchStakes(state, { competitionId, stage, homeId, awayId, knockout, aggregate, isInternational }) : 'normal';
  const homeSquad = record ? matchdaySquad(state, homeId, isInternational, competitionId, stakes) : getTeamSquad(state, homeId, isInternational);
  const awaySquad = record ? matchdaySquad(state, awayId, isInternational, competitionId, stakes) : getTeamSquad(state, awayId, isInternational);
  const servedBans = record ? bansBeforeKickoff(state, competitionId, [homeId, awayId]) : null;
  // Full-engine club games tire the team too (European weeks show in the league).
  if (record && !isInternational) { drainTeamFitness(state, homeId); drainTeamFitness(state, awayId); }
  const derby = isDerby(homeId, awayId, isInternational);
  const expectations = matchExpectations(state, { homeId, awayId, competitionId, stage, knockout: knockout || Boolean(aggregate), isInternational, neutral, homeSquad, awaySquad, derby });
  const homeSources = squadMatchSources(homeSquad);
  const awaySources = squadMatchSources(awaySquad);
  const homeFitness = record ? squadFitness(homeSquad) : null;
  const awayFitness = record ? squadFitness(awaySquad) : null;
  const homeForm = record ? squadForm(homeSquad) : null;
  const awayForm = record ? squadForm(awaySquad) : null;
  const homeCoach = getCoach(state, homeId, isInternational);
  const awayCoach = getCoach(state, awayId, isInternational);
  const detail = record && (knockout || Boolean(aggregate) || /Semi|Final|Quarter/i.test(stage || ''));
  const firstLeg = /Leg 1/i.test(stage || '');
  const result = playMatch({
    home: { teamId: homeId, lambda: expectations.homeLambda, style: homeCoach?.profile || null, xi: homeSources.xi, bench: homeSources.bench, fitness: homeFitness, form: homeForm },
    away: { teamId: awayId, lambda: expectations.awayLambda, style: awayCoach?.profile || null, xi: awaySources.xi, bench: awaySources.bench, fitness: awayFitness, form: awayForm },
    knockout: knockout || Boolean(aggregate),
    aggregate,
    detail,
    legStakes: firstLeg ? 0.5 : 1,
    bigGameStakes: stakes === 'big' ? 1 : 0,
    // Derbies are fierce: more fouls and bookings, a little more chaos.
    cardIntensity: derby ? 1.35 : 1,
    intensity: derby ? 1.04 : 1
  }, () => random(state));

  const homeGoals = result.homeGoals;
  const awayGoals = result.awayGoals;
  const decidedLate = result.extraTime || result.penalties;
  const tieWinnerId = result.winnerSide === 'home' ? homeId : result.winnerSide === 'away' ? awayId : null;
  const legWinnerId = homeGoals > awayGoals ? homeId : awayGoals > homeGoals ? awayId : null;
  const winnerId = knockout ? tieWinnerId : aggregate ? (decidedLate ? tieWinnerId : legWinnerId) : legWinnerId;
  const teamIdFor = (side) => (side === 'home' ? homeId : awayId);
  const goalEvents = result.goals.map((goal) => ({
    teamId: teamIdFor(goal.side),
    opponentId: teamIdFor(goal.side === 'home' ? 'away' : 'home'),
    side: goal.side,
    scorerId: goal.scorerId,
    assistId: goal.assistId,
    minute: goal.minute,
    ...(goal.added ? { added: goal.added } : {}),
    ...(goal.penalty ? { penalty: true } : {}),
    ...(goal.extraTime ? { extraTime: true } : {})
  }));

  const id = record ? `m-${state.season}-${week}-${state.current.matches.length + 1}` : null;

  const outcomeFor = (teamId, goalsFor, goalsAgainst) => {
    if (knockout && tieWinnerId) return tieWinnerId === teamId ? 'W' : 'L';
    if (aggregate && decidedLate && tieWinnerId) return tieWinnerId === teamId ? 'W' : 'L';
    return goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D';
  };
  for (const row of result.players) {
    if (!row.id) continue;
    const teamId = teamIdFor(row.side);
    const stat = ensurePlayerStat(state, row.id, competitionId, teamId, isInternational);
    stat.apps += 1;
    if (row.started) stat.starts += 1;
    stat.goals += row.goals;
    stat.assists += row.assists;
    if (row.cleanSheet) stat.cleanSheets += 1;
    stat.ratingSum += row.rating;
    stat.averageRating = stat.ratingSum / stat.apps;
    stat.minutes = (stat.minutes || 0) + row.minutes;
    if (row.yellow) stat.yellow = (stat.yellow || 0) + 1;
    if (row.red) stat.red = (stat.red || 0) + 1;
    const goalsFor = row.side === 'home' ? homeGoals : awayGoals;
    const goalsAgainst = row.side === 'home' ? awayGoals : homeGoals;
    if (record) addPlayerLog(state, row.id, {
      matchId: id,
      week,
      competitionId,
      competitionName,
      stage,
      teamId,
      opponentId: row.side === 'home' ? awayId : homeId,
      home: row.side === 'home',
      goals: row.goals,
      assists: row.assists,
      cleanSheet: row.cleanSheet,
      rating: row.rating,
      minutes: row.minutes,
      started: row.started,
      score: `${homeGoals}-${awayGoals}`,
      result: outcomeFor(teamId, goalsFor, goalsAgainst),
      isInternational
    });
  }
  if (record) {
    const playerById = getRuntimeCache(state).playerById;
    const recovering = recoverySet(state);
    for (const row of result.players) {
      if (!row.id) continue;
      const player = playerById.get(row.id);
      if (!player) continue;
      // A full match costs about 16 points: two games in a week are manageable, a third
      // (or a run of congested weeks) wears players down.
      const before = playerFitness(player);
      const fitness = Math.max(35, before - Math.max(0, before - row.energy) * 0.62);
      if (fitness < 100) { player.fitness = Math.round(fitness); recovering.add(player); }
      if (row.minutes >= 20) updatePlayerForm(player, row.rating);
    }
    for (const injury of result.injuries) {
      const player = injury.playerId ? playerById.get(injury.playerId) : null;
      if (player) { rollInjury(state, player, competitionId, id); recovering.add(player); }
    }
  }
  const manOfMatchId = result.manOfMatchId;
  if (!record) {
    if (manOfMatchId) {
      const side = result.players.find((row) => row.id === manOfMatchId)?.side;
      ensurePlayerStat(state, manOfMatchId, competitionId, teamIdFor(side), isInternational).manOfTheMatch += 1;
    }
    return { result, homeGoals, awayGoals, winnerId, expectations };
  }
  if (manOfMatchId) {
    const side = result.players.find((row) => row.id === manOfMatchId)?.side;
    ensurePlayerStat(state, manOfMatchId, competitionId, teamIdFor(side), isInternational).manOfTheMatch += 1;
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
    winnerId,
    extraTime: result.extraTime,
    penalties: result.penalties,
    goalEvents,
    stats: result.stats,
    cardEvents: result.cards.map((card) => ({ side: card.side, type: card.type, minute: card.minute, ...(card.added ? { added: card.added } : {}), playerId: card.playerId })),
    subs: result.subs.map((sub) => ({ side: sub.side, minute: sub.minute, outId: sub.outId, inId: sub.inId, reason: sub.reason })),
    keyChances: result.keyChances.map((chance) => ({ side: chance.side, minute: chance.minute, playerId: chance.playerId, outcome: chance.outcome })),
    manOfMatchId,
    motmRating: result.players.find((row) => row.id === manOfMatchId)?.rating ?? null,
    isInternational,
    knockout,
    landmark: knockout && /Final|Semi-final/i.test(stage || ''),
    engine: 2,
    odds: matchOdds(expectations),
    ...(derby ? { derby: rivalryDefinitionForIds(homeId, awayId).name } : {})
  };
  if (aggregate) {
    match.aggregate = { home: aggregate.home + homeGoals, away: aggregate.away + awayGoals };
    match.tieWinnerId = tieWinnerId;
  }
  if (result.shootout) match.shootout = result.shootout.map((kick) => ({ round: kick.round, side: kick.side, playerId: kick.playerId, keeperId: kick.keeperId, outcome: kick.outcome, home: kick.home, away: kick.away }));
  if (detail) {
    match.timeline = result.timeline;
    match.possessionSlices = result.possessionSlices;
    match.lineups = { home: lineupSnapshot(homeSquad), away: lineupSnapshot(awaySquad) };
    match.styles = { home: homeCoach?.profile || null, away: awayCoach?.profile || null };
    // Final ratings for the full-time screen of watched (Showcase) matches.
    match.playerRatings = result.players.filter((row) => row.id).map((row) => [row.id, Number(row.rating.toFixed(1)), row.injured ? 1 : 0]);
  }
  state.current.matches.push(match);
  if (match.shootout) recordShootout(state, match);
  noteUpset(state, match);
  updateRecordsFromMatch(state, match, result.players);
  if (servedBans?.size) serveBans(state, competitionId, servedBans);
  applyDiscipline(state, match, competitionId, teamIdFor);
  if (homeSquad.rotated || awaySquad.rotated) {
    match.rotation = { home: Boolean(homeSquad.rotated), away: Boolean(awaySquad.rotated) };
    match.absent = { home: homeSquad.absentStarters || 0, away: awaySquad.absentStarters || 0 };
  }
  if (result.injuries.length) match.injuries = result.injuries.map((injury) => ({ side: injury.side, minute: injury.minute, playerId: injury.playerId }));
  if (table) updateTable(table, homeId, awayId, homeGoals, awayGoals);

  const homeOutcome = outcomeFor(homeId, homeGoals, awayGoals);
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

  generateMatchNews(state, match, expectations.homeStrength, expectations.awayStrength);
  return match;
}

// Model probabilities for home win / draw / away win from the kickoff expectations
// (independent Poisson goals with a small draw correction for game-state caution).
function outcomeProbabilities(homeLambda, awayLambda) {
  const pmf = (lambda) => {
    const values = [Math.exp(-lambda)];
    for (let goals = 1; goals <= 10; goals += 1) values.push(values[goals - 1] * lambda / goals);
    return values;
  };
  const home = pmf(homeLambda), away = pmf(awayLambda);
  let win = 0, draw = 0, loss = 0;
  for (let h = 0; h <= 10; h += 1) for (let a = 0; a <= 10; a += 1) {
    const p = home[h] * away[a];
    if (h > a) win += p; else if (h === a) draw += p; else loss += p;
  }
  const extraDraw = Math.min(0.05, draw * 0.12);
  const total = win + draw + loss;
  win = win / total; draw = draw / total; loss = loss / total;
  const share = win + loss || 1;
  return { home: win - extraDraw * win / share, draw: draw + extraDraw, away: loss - extraDraw * loss / share };
}

function matchOdds(expectations) {
  const probabilities = outcomeProbabilities(expectations.homeLambda, expectations.awayLambda);
  return [probabilities.home, probabilities.draw, probabilities.away].map((value) => Number(value.toFixed(3)));
}

// Bookmaker prices: the model probabilities with a 6 % overround, as decimal odds.
export function decimalOdds(probabilities) {
  if (!probabilities) return null;
  return probabilities.map((value) => Number(Math.max(1.01, 1 / (Math.max(0.005, value) * 1.06)).toFixed(2)));
}

// Pre-match odds for a fixture that has not been played (featured matches, Showcase).
export function getFixtureOdds(state, { homeId, awayId, competitionId, stage = null, knockout = false, isInternational = false, neutral = false }) {
  const expectations = matchExpectations(state, { homeId, awayId, competitionId, stage, knockout, isInternational, neutral, derby: isDerby(homeId, awayId, isInternational), preview: true });
  const probabilities = matchOdds(expectations);
  return { probabilities, decimal: decimalOdds(probabilities) };
}

// Upsets of the season: winners the bookmakers rated least likely (full-engine matches,
// not shootouts). A compact list survives the season-end match archive; readers of it
// must still apply the Showcase embargo.
function noteUpset(state, match) {
  if (!match.odds || !match.winnerId || match.light || match.penalties) return;
  const side = match.winnerId === match.homeId ? 0 : match.winnerId === match.awayId ? 2 : -1;
  if (side < 0) return;
  const price = decimalOdds(match.odds)[side];
  if (price < 4) return;
  const list = state.current.upsets ||= [];
  if (list.length >= 30 && price <= list[list.length - 1].price) return;
  list.push({ price, probability: match.odds[side], match: { id: match.id, competitionId: match.competitionId, competitionName: match.competitionName, stage: match.stage || null, week: match.week, homeId: match.homeId, awayId: match.awayId, homeGoals: match.homeGoals, awayGoals: match.awayGoals, winnerId: match.winnerId, isInternational: Boolean(match.isInternational), extraTime: Boolean(match.extraTime), goalEvents: [] } });
  list.sort((a, b) => b.price - a.price);
  if (list.length > 30) list.length = 30;
}

export function getSeasonUpsets(state, limit = 10) {
  return (state.current.upsets || []).slice(0, limit);
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
  if (match.derby) {
    const winner = match.winnerId ? getTeamName(state, match.winnerId, false) : null;
    state.current.news.unshift({
      id: `news-${match.id}-derby`, week: match.week, importance: relevance >= 50 ? 'major' : 'digest', category: 'Derby', storyType: 'result', relevance: relevance + 10,
      headline: winner ? `${winner} win the ${match.derby}` : `${match.derby} ends level`,
      body: `${homeName} ${match.homeGoals}-${match.awayGoals} ${awayName} in the ${match.competitionName}${(match.cardEvents || []).filter((card) => card.type === 'red').length ? ', with a red card in a heated contest' : ''}.`, matchId: match.id
    });
  }
  const favorite = homeStrength - awayStrength >= 10 ? match.homeId : awayStrength - homeStrength >= 10 ? match.awayId : null;
  const winnerPrice = match.winnerId && match.odds ? decimalOdds(match.odds)[match.winnerId === match.homeId ? 0 : 2] : null;
  if ((favorite && match.winnerId && match.winnerId !== favorite) || (winnerPrice && winnerPrice >= 5 && relevance >= 40)) {
    const beaten = match.winnerId === match.homeId ? match.awayId : match.homeId;
    state.current.news.unshift({
      id: `news-${match.id}-upset`, week: match.week, importance: relevance >= 48 ? 'major' : 'digest', category: 'Results', storyType: 'upset', relevance: relevance + 12 + Math.min(20, Math.round((winnerPrice || 0) * 1.5)),
      headline: `${getTeamName(state, match.winnerId, match.isInternational)} stun ${getTeamName(state, beaten, match.isInternational)}`,
      body: `${homeName} ${match.homeGoals}-${match.awayGoals} ${awayName} in ${match.competitionName}${match.stage ? ` (${match.stage})` : ''}${winnerPrice ? `; the bookmakers had them at ${winnerPrice.toFixed(2)}` : ''}.`, matchId: match.id
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
    if (['GK', 'DF'].includes(player.position)) stat.cleanSheets += Math.min(playerApps, Math.round(row.cleanSheets * (0.72 + random(state) * 0.25)));
    stat.ratingSum += averageRating * playerApps;
    stat.averageRating = stat.ratingSum / stat.apps;
  });
}

function simulateSummaryLeagues(state) {
  for (const league of Object.values(state.current.leagues).filter((item) => item.tier === 'summary' && !item.completed)) {
    const rounds = roundRobin(league.table.map((row) => row.teamId), true);
    rounds.forEach((round, roundIndex) => round.forEach(({ homeId, awayId }) => {
      // Condensed leagues are played by the same minute engine. Only tables and player
      // statistics are kept; no per-match records are stored for them.
      const { homeGoals, awayGoals } = simulateMatch(state, {
        homeId, awayId, competitionId: league.id, competitionName: league.name,
        week: 36, stage: `Matchday ${roundIndex + 1}`, record: false, light: true
      });
      updateTable(league.table, homeId, awayId, homeGoals, awayGoals);
      if (awayGoals === 0) { const row = league.table.find((item) => item.teamId === homeId); row.cleanSheets = (row.cleanSheets || 0) + 1; }
      if (homeGoals === 0) { const row = league.table.find((item) => item.teamId === awayId); row.cleanSheets = (row.cleanSheets || 0) + 1; }
    }));
    league.table.forEach((row) => {
      row.cleanSheets ||= 0;
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

function drawCupRoundPairs(state, ids) {
  let participants = [...ids];
  let byes = [];
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, participants.length)));
  const byeCount = Math.max(0, bracketSize - participants.length);
  if (byeCount > 0) {
    const shuffled = shuffle(state, participants);
    byes = shuffled.slice(0, byeCount);
    participants = shuffled.slice(byeCount);
  }
  return { pairs: pairTeams(state, participants), byes };
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
  const draw = cup.nextPairs?.length ? { pairs: cup.nextPairs, byes: cup.nextByes || [] } : drawCupRoundPairs(state, cup.active);
  const pairs = draw.pairs;
  const byes = draw.byes;
  cup.nextPairs = [];
  cup.nextByes = [];
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
    const nextDraw = drawCupRoundPairs(state, winners);
    cup.nextPairs = nextDraw.pairs;
    cup.nextByes = nextDraw.byes;
  }
}

function simulateDomesticCups(state, week) {
  Object.values(state.current.domesticCups).filter((cup) => cup.tier !== 'summary').forEach((cup) => simulateDomesticCupRound(state, cup, week));
}

function simulateSuperCupCompetition(state, cup, week) {
  if (!cup || cup.championId || cup.active.length < 2) return;
  const stage = cup.active.length > 2 ? 'Semi-final' : 'Final';
  const pairs = cup.nextPairs?.length ? cup.nextPairs : pairTeams(state, cup.active);
  cup.nextPairs = [];
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
  else { cup.stage = 'Final'; cup.nextPairs = pairTeams(state, winners); }
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
    comp.knockout.openingPairs = pairTeams(state, winners);
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
  if (isInternational && roundIndex === 0) reportTournamentAbsences(state, competition);
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

// id → match for the current season, extended as matches are added.
const MATCH_INDEX = new WeakMap();
function currentMatchIndex(state) {
  const matches = state.current.matches;
  let entry = MATCH_INDEX.get(matches);
  if (!entry) { entry = { map: new Map(), size: 0 }; MATCH_INDEX.set(matches, entry); }
  for (let index = entry.size; index < matches.length; index += 1) entry.map.set(matches[index].id, matches[index]);
  entry.size = matches.length;
  return entry.map;
}

function simulateClubTwoLegRound(state, comp, week, leg) {
  const knockout = comp.knockout;
  if (!knockout || knockout.round === 'Final') return;
  const stage = knockout.round;
  const matchIndex = leg === 2 ? currentMatchIndex(state) : null;
  knockout.ties.forEach((tie) => {
    const homeId = leg === 1 ? tie.homeId : tie.awayId;
    const awayId = leg === 1 ? tie.awayId : tie.homeId;
    // The second leg knows the first-leg score: extra time and penalties are played
    // in it when the aggregate is level after 90 minutes.
    const first = leg === 2 ? matchIndex.get(tie.firstLeg) : null;
    const aggregate = first ? { home: first.awayGoals, away: first.homeGoals } : null;
    const match = simulateMatch(state, {
      homeId,
      awayId,
      competitionId: comp.id,
      competitionName: comp.name,
      week,
      stage: `${stage} · Leg ${leg}`,
      knockout: false,
      aggregate
    });
    if (leg === 2 && first) tie.winnerId = match.tieWinnerId || null;
    if (leg === 1) tie.firstLeg = match.id;
    else tie.secondLeg = match.id;
  });
  if (leg !== 2) return;
  const winners = [];
  knockout.ties.forEach((tie) => {
    if (!tie.winnerId) {
      // Legacy safety net: a tie whose second leg predates the minute engine.
      const first = matchIndex.get(tie.firstLeg);
      const second = state.current.matches.find((match) => match.id === tie.secondLeg);
      if (!first || !second) return;
      const homeAggregate = first.homeGoals + second.awayGoals;
      const awayAggregate = first.awayGoals + second.homeGoals;
      tie.winnerId = homeAggregate === awayAggregate
        ? resolveDraw(state, tie.homeId, tie.awayId, 0, 0, false).winnerId
        : homeAggregate > awayAggregate ? tie.homeId : tie.awayId;
    }
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
  if (comp.format) return prepareFormatKnockout(state, comp);
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

// v4.2 formats: the top places of each group plus the best third-placed teams. Group
// winners (and the best runners-up) are seeded, so they meet runners-up or third-placed
// teams from other groups in the first knockout round.
function bestThirdPlaced(comp) {
  return comp.groups.map((group) => ({ ...sortTable(group.table)[2], groupId: group.id }))
    .filter((row) => row.teamId)
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.teamId.localeCompare(b.teamId));
}

function prepareFormatKnockout(state, comp) {
  const format = comp.format;
  const placed = comp.groups.flatMap((group) => sortTable(group.table).slice(0, format.advance)
    .map((row, index) => ({ ...row, groupId: group.id, groupPosition: index + 1 })));
  const thirds = format.bestThirds ? bestThirdPlaced(comp).slice(0, format.bestThirds).map((row) => ({ ...row, groupPosition: 3 })) : [];
  comp.bestThirds = format.bestThirds ? bestThirdPlaced(comp).map((row, index) => ({ teamId: row.teamId, groupId: row.groupId, points: row.points, gd: row.gd, gf: row.gf, qualified: index < format.bestThirds })) : null;
  const qualifiers = [...placed, ...thirds]
    .sort((a, b) => a.groupPosition - b.groupPosition || b.points - a.points || b.gd - a.gd || b.gf - a.gf)
    .slice(0, format.knockout);
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
    comp.knockout.openingPairs = pairTeams(state, winners);
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
            const seeded = seededGroups(state, ids, 8, { limits: WORLD_CUP_GROUP_LIMITS });
            worldCup.groups = seeded.groups;
            worldCup.draw = seeded.draw;
            worldCup.format = INTERNATIONAL_FORMATS.WC;
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

// Calibration only: plays one international cycle in a throwaway world with the normal
// calendar code. cycle 1 = World Cup qualifying + World Cup; 'regional' = continental
// qualifiers followed by the continental finals. Returns the finals competitions with
// the matches they produced.
export function runInternationalCycleForCalibration(state, cycle) {
  const season = state.season;
  const play = (targetCycle) => {
    state.season = season - (season % 4) + targetCycle + 4;
    state.current.matches = [];
    state.current.news = [];
    state.current.internationalCompetitions = initializeInternationalCompetitions(state);
    for (let week = 1; week <= 52; week += 1) { state.current.week = week; simulateInternationalCalendar(state, week); }
    return { competitions: state.current.internationalCompetitions, matches: state.current.matches };
  };
  let result;
  if (cycle === 1) result = play(1);
  else { play(2); result = play(3); }
  state.season = season;
  return result;
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
  recoverFitness(state);
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
  reviewCoachesMidSeason(state, week);
  // Light-match appearances and ratings are credited every four weeks, so in-season
  // award races and squad pages stay current.
  if (week % 4 === 0 && week < 52) flushLightAppearances(state);
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
  let best = null;
  let bestScore = -Infinity;
  for (const stat of stats) {
    const score = formula(stat);
    if (score > bestScore) {
      best = stat;
      bestScore = score;
    }
  }
  return best;
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

function competitionMvpScore(state, stat, competitionId, outcome = null, finalRatings = null) {
  const player = getPlayer(state, stat.playerId);
  const resolvedOutcome = outcome || getCompetitionOutcome(state, competitionId);
  const won = stat.teamId === resolvedOutcome.championId;
  const finalist = stat.teamId === resolvedOutcome.finalistId;
  const finalRating = finalRatings?.get(stat.playerId) ?? finalMatchRating(state, stat.playerId, competitionId);
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

function calculateCompetitionAwards(state, competitionId, competitionName, suppliedStats = null) {
  const stats = suppliedStats || statsForCompetition(state, competitionId);
  if (!stats.length) return;
  const scorer = chooseBestPlayer(stats, (stat) => stat.goals * 100 + stat.assists + stat.averageRating / 10);
  const outcome = getCompetitionOutcome(state, competitionId);
  const finalRatings = new Map();
  for (const stat of stats) finalRatings.set(stat.playerId, finalMatchRating(state, stat.playerId, competitionId));
  const mvpScores = new Map(stats.map((stat) => [stat.playerId, competitionMvpScore(state, stat, competitionId, outcome, finalRatings)]));
  const formula = (stat) => mvpScores.get(stat.playerId) || 0;
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
    // Decisive performances in the biggest games: finals, and semi-finals at a lower weight.
    const finalImpact = (state.current.playerMatchLogs?.[item.playerId] || [])
      .reduce((sum, log) => {
        const stage = String(log.stage || '').toLowerCase();
        const weightForStage = stage === 'final' ? 1 : /semi/.test(stage) ? 0.6 : 0;
        return sum + Math.max(0, (log.rating || 0) - 7.0) * (log.isInternational ? 4.5 : 3.2) * weightForStage + (weightForStage ? (log.goals || 0) * 2.5 * weightForStage : 0);
      }, 0);
    // Voters favour stars: rarity and quality above the elite line, plus fame.
    const starAppeal = (AWARD_STAR_APPEAL[player?.rarity] ?? 0) + Math.max(0, (player?.rating || 0) - 84) * 1.5 + (player?.fame || 0) * 0.06;
    // Voters notice goals: with event-based ratings a creative midfielder can match a
    // prolific forward on rating alone, so weighted goals add a modest extra.
    const goalEmphasis = item.weightedGoals * 0.4 + item.weightedAssists * 0.08;
    const ballonPositionWeight = { GK: 0.82, DF: 0.92, MF: 0.98, FW: 1.03 }[player?.position] || 1;
    const score = item.competitionScore * ballonPositionWeight + goalEmphasis + trophies + finalImpact + average * 0.9 + Math.min(3, item.eliteApps * 0.03) + starAppeal;
    const components = { apps: item.apps, goals: item.goals, assists: item.assists, weightedGoals: Number(item.weightedGoals.toFixed(2)), averageRating: Number(average.toFixed(2)), performanceScore: Number(item.competitionScore.toFixed(1)), trophyBonus: Number(trophies.toFixed(1)), finalImpact: Number(finalImpact.toFixed(1)), starAppeal: Number(starAppeal.toFixed(1)), score: Number(score.toFixed(2)) };
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
  return { ballonDor: applyBallonRules(state, diversifyBallonRanking(state, candidates)), goldenBoot, kopa };
}

// Ballon d'Or rules (v4.3): Uncommon and Common players never make the podium; a Rare
// can win only with a historic season (a Champions League or World Cup-level title and
// a score well clear of the best Epic+ candidate). Otherwise the best Epic+ goes first.
const AWARD_STAR_APPEAL = { generational: 55, legend: 45, epic: 30, rare: 0, uncommon: -60, common: -80 };
function applyBallonRules(state, ranking) {
  const rankOf = (candidate) => STAR_RARITIES[getPlayer(state, candidate.playerId)?.rarity]?.rank || 1;
  const list = ranking.filter((candidate) => rankOf(candidate) >= 3);
  const top = list[0];
  if (top && rankOf(top) === 3) {
    const bestElite = list.find((candidate) => rankOf(candidate) >= 4);
    const historic = (top.components?.trophyBonus || 0) >= 36 && (!bestElite || top.score >= bestElite.score * 1.2);
    if (bestElite && !historic) {
      list.splice(list.indexOf(bestElite), 1);
      list.unshift(bestElite);
    }
  }
  return list;
}

function calculateAwards(state) {
  const statsByCompetition = new Map();
  for (const stat of Object.values(state.current.playerStats || {})) {
    if (!stat.apps) continue;
    if (!statsByCompetition.has(stat.competitionId)) statsByCompetition.set(stat.competitionId, []);
    statsByCompetition.get(stat.competitionId).push(stat);
  }
  const calculate = (competition) => calculateCompetitionAwards(state, competition.id, competition.name, statsByCompetition.get(competition.id) || []);
  for (const league of Object.values(state.current.leagues)) calculate(league);
  for (const cup of Object.values(state.current.domesticCups)) calculate(cup);
  for (const superCup of Object.values(state.current.superCups || {})) calculate(superCup);
  for (const globalCompetition of Object.values(state.current.globalClubCompetitions || {})) calculate(globalCompetition);
  for (const competition of Object.values(state.current.continentalCompetitions || {})) calculate(competition);
  for (const competition of Object.values(state.current.internationalCompetitions || {})) calculate(competition);

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

const CONTRIBUTOR_INDEX = new WeakMap();
function competitionContributors(state, competitionId, teamId) {
  const stats = state.current?.playerStats || {};
  // Built once per season archive (archiveSeason clears it first).
  let index = CONTRIBUTOR_INDEX.get(stats);
  if (!index) {
    const map = new Map();
    for (const row of Object.values(stats)) {
      if (!row.apps) continue;
      const key = `${row.competitionId}::${row.teamId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row.playerId);
    }
    index = { map };
    CONTRIBUTOR_INDEX.set(stats, index);
  }
  return (index.map.get(`${competitionId}::${teamId}`) || []).map((id) => getPlayer(state, id)).filter(Boolean);
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
  // Medals go to every named squad member who played in the competition for the
  // winners; the starting XI is the fallback when no appearances were recorded.
  const contributors = competitionContributors(state, competitionId, winnerId);
  const players = contributors.length ? contributors : (isInternational ? getNationalLineup(state, winnerId) : getClubLineup(state, winnerId));
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


function legacyCompetitionWeight(state, competitionId, isInternational = false) {
  if (!competitionId) return 1;
  const fixed = {
    WC: 5.0, UCL: 4.6, EURO: 4.1, COPA: 4.0, LIB: 3.8, CWC: 3.6,
    UEL: 3.0, AFCON: 2.9, ASIACUP: 2.7, GOLDCUP: 2.5, ICUP: 2.5,
    UECL: 2.25, SUD: 2.25, CCC: 2.2, ACL: 2.1, CAFCL: 2.05, OCL: 1.6,
    GLOBAL: 4.2, WCQ: 1.15, EUROQ: 1.05, AFCONQ: 0.95, ASIAQ: 0.95, GOLDCUPQ: 0.9
  };
  if (fixed[competitionId]) return fixed[competitionId];
  const league = LEAGUE_DEFINITIONS.find((item) => item.id === competitionId);
  if (league) {
    if (['ESP1','ENG1','ITA1','GER1','FRA1'].includes(league.id)) return 2.75;
    if (['POR1','NED1','BRA1','ARG1','BEL1','TUR1'].includes(league.id)) return 2.2;
    return league.tier === 'detailed' ? 1.9 : 1.3;
  }
  if (competitionId.startsWith('CUP-')) {
    const leagueId = competitionId.slice(4);
    const parent = LEAGUE_DEFINITIONS.find((item) => item.id === leagueId);
    if (['ESP1','ENG1','ITA1','GER1','FRA1'].includes(leagueId)) return 1.85;
    return parent?.tier === 'detailed' ? 1.45 : 1.05;
  }
  if (competitionId.startsWith('SC-') || competitionId === 'SUPERCUP') return 0.75;
  return isInternational ? 1.25 : 1.0;
}

// Rivalries are looked up for every match, so they are indexed by both orderings.
let RIVALRY_INDEX = null;
function rivalryDefinitionForIds(a, b) {
  if (!RIVALRY_INDEX) {
    RIVALRY_INDEX = new Map();
    for (const item of RIVALRY_DEFINITIONS) {
      const forward = `${item.clubAId}|${item.clubBId}`;
      const reverse = `${item.clubBId}|${item.clubAId}`;
      if (!RIVALRY_INDEX.has(forward)) RIVALRY_INDEX.set(forward, item);
      if (!RIVALRY_INDEX.has(reverse)) RIVALRY_INDEX.set(reverse, item);
    }
  }
  return RIVALRY_INDEX.get(`${a}|${b}`) || null;
}

function legacyAwardValue(state, awardRow) {
  if (!awardRow || awardRow.rank !== 1) return 0;
  const name = String(awardRow.name || '').toLowerCase();
  if (name.includes("ballon d'or")) return 58;
  if (name.includes('kopa')) return 22;
  if (name.includes('world best') && !name.includes('xi')) return 21;
  if (name.includes('world best xi')) return 9;
  const weight = legacyCompetitionWeight(state, awardRow.competitionId, false);
  if (name.includes('player of the season') || name.includes('mvp') || name.includes('best player')) return 13 * weight;
  if (name.includes('best goalkeeper') || name.includes('best defender') || name.includes('best midfielder') || name.includes('best forward')) return 8 * weight;
  if (name.includes('top scorer') || name.includes('golden boot')) return 6 * weight;
  return 4 * weight;
}

function buildLegacyContext(state, suppressNews = false) {
  const playerRows = new Map(), honours = new Map(), awards = new Map();
  for (const row of state.history.playerSeasons || []) { const list=playerRows.get(row.playerId)||[]; list.push(row); playerRows.set(row.playerId,list); }
  for (const row of state.history.honours || []) { const list=honours.get(row.playerId)||[]; list.push(row); honours.set(row.playerId,list); }
  for (const row of state.history.awards || []) { if(row.rank!==1) continue; const list=awards.get(row.playerId)||[]; list.push(row); awards.set(row.playerId,list); }
  return { playerRows, honours, awards, suppressNews, hallSet: new Set((state.history.hallOfFamePlayers||[]).map((row)=>row.playerId)), legendSet: new Set((state.history.clubLegends||[]).map((row)=>`${row.playerId}::${row.clubId}`)) };
}

function playerLegacyBreakdown(state, player, context = null) {
  const rows = context?.playerRows.get(player.id) || (state.history.playerSeasons || []).filter((row) => row.playerId === player.id);
  const honours = context?.honours.get(player.id) || (state.history.honours || []).filter((row) => row.playerId === player.id);
  const awards = context?.awards.get(player.id) || (state.history.awards || []).filter((row) => row.playerId === player.id && row.rank === 1);
  let performance = 0, production = 0, games = 0, weightedGames = 0, goals = 0, assists = 0, cleanSheets = 0;
  for (const row of rows) {
    const weight = legacyCompetitionWeight(state, row.competitionId, row.isInternational);
    const apps = row.apps || 0;
    const rating = row.averageRating || 6.4;
    games += apps;
    goals += row.goals || 0;
    assists += row.assists || 0;
    cleanSheets += row.cleanSheets || 0;
    weightedGames += apps * weight;
    performance += Math.max(0, rating - 6.45) * apps * weight * 1.55;
    if (player.position === 'FW') production += ((row.goals || 0) * 0.58 + (row.assists || 0) * 0.34) * weight;
    else if (player.position === 'MF') production += ((row.goals || 0) * 0.34 + (row.assists || 0) * 0.52 + (row.cleanSheets || 0) * 0.04) * weight;
    else if (player.position === 'DF') production += ((row.goals || 0) * 0.22 + (row.assists || 0) * 0.27 + (row.cleanSheets || 0) * 0.25) * weight;
    else production += ((row.cleanSheets || 0) * 0.48 + (row.assists || 0) * 0.08) * weight;
  }
  let titleScore = 0, majorTitles = 0, eliteTitles = 0, continentalTitles = 0, domesticLeagueTitles = 0;
  const continentalIds = new Set(['UCL','UEL','UECL','LIB','SUD','CCC','ACL','CAFCL','OCL','CWC','ICUP']);
  const leagueIds = new Set(LEAGUE_DEFINITIONS.map((league) => league.id));
  for (const honour of honours) {
    const weight = legacyCompetitionWeight(state, honour.competitionId, honour.isInternational);
    titleScore += 7.5 * weight;
    if (weight >= 2.7) majorTitles += 1;
    if (weight >= 3.5 || honour.competitionId === 'WC') eliteTitles += 1;
    if (continentalIds.has(honour.competitionId)) continentalTitles += 1;
    if (leagueIds.has(honour.competitionId)) domesticLeagueTitles += 1;
  }
  const awardScore = awards.reduce((sum, row) => sum + legacyAwardValue(state, row), 0);
  const ballonDor = awards.filter((row) => String(row.name).includes("Ballon d'Or")).length;
  const score = performance + production + titleScore + awardScore + weightedGames * 0.018;
  return { score, performance, production, titleScore, awardScore, games, weightedGames, goals, assists, cleanSheets, honours: honours.length, awards: awards.length, majorTitles, eliteTitles, continentalTitles, domesticLeagueTitles, ballonDor };
}

function clubLegendBreakdowns(state, player, context = null) {
  const byClub = new Map();
  const rows = (context?.playerRows.get(player.id) || (state.history.playerSeasons || []).filter((row) => row.playerId === player.id)).filter((row)=>!row.isInternational);
  for (const row of rows) {
    const item = byClub.get(row.teamId) || { clubId: row.teamId, games: 0, goals: 0, assists: 0, cleanSheets: 0, ratingWeighted: 0, seasons: new Set(), weightedPerformance: 0 };
    const weight = legacyCompetitionWeight(state, row.competitionId, false);
    item.games += row.apps || 0;
    item.goals += row.goals || 0;
    item.assists += row.assists || 0;
    item.cleanSheets += row.cleanSheets || 0;
    item.ratingWeighted += (row.averageRating || 0) * (row.apps || 0);
    item.seasons.add(row.season);
    item.weightedPerformance += Math.max(0, (row.averageRating || 6.4) - 6.45) * (row.apps || 0) * Math.max(1, weight) * 0.9;
    byClub.set(row.teamId, item);
  }
  for (const honour of context?.honours.get(player.id) || state.history.honours || []) {
    if (honour.playerId !== player.id || honour.isInternational) continue;
    const item = byClub.get(honour.teamId);
    if (!item) continue;
    item.titles = (item.titles || 0) + 1;
    item.titleScore = (item.titleScore || 0) + 6 * legacyCompetitionWeight(state, honour.competitionId, false);
  }
  return [...byClub.values()].map((item) => {
    const avg = item.games ? item.ratingWeighted / item.games : 0;
    const positionProduction = player.position === 'FW' ? item.goals * 0.42 + item.assists * 0.22
      : player.position === 'MF' ? item.goals * 0.24 + item.assists * 0.36
      : player.position === 'DF' ? item.goals * 0.14 + item.assists * 0.18 + item.cleanSheets * 0.18
      : item.cleanSheets * 0.30;
    const score = item.weightedPerformance + item.games * 0.08 + positionProduction + (item.titleScore || 0) + item.seasons.size * 2;
    return { ...item, seasons: item.seasons.size, averageRating: avg, score };
  });
}

function evaluateRetiringPlayerLegacy(state, player, context = null) {
  state.history.hallOfFamePlayers ||= [];
  state.history.clubLegends ||= [];
  const legacy = playerLegacyBreakdown(state, player, context);
  // The Hall is intentionally much smaller than the club-legends archive. Entry
  // requires an elite talent profile plus a genuinely historic completed career;
  // rare players can still force their way in, but only with titan-level output.
  const rarityRank = STAR_RARITIES[player.rarity]?.rank || 1;
  const premierTalent = rarityRank >= STAR_RARITIES.legend.rank;
  const globalGreat = legacy.games >= 300 && legacy.ballonDor >= 1 && legacy.score >= 1100;
  const eliteWinner = legacy.games >= 360 && legacy.eliteTitles >= 4 && legacy.majorTitles >= 8 && legacy.awards >= 6 && legacy.score >= 1400;
  const sustainedMajor = legacy.games >= 420 && legacy.majorTitles >= 11 && legacy.awards >= 10 && legacy.score >= 1650;
  const regionalDynasty = legacy.games >= 450 && legacy.domesticLeagueTitles >= 10 && legacy.continentalTitles >= 4 && legacy.awards >= 8 && legacy.score >= 1750;
  const statisticalTitan = legacy.games >= 540 && legacy.honours >= 12 && legacy.awards >= 15 && legacy.score >= 1900;
  const epicOutlier = rarityRank === STAR_RARITIES.epic.rank && legacy.ballonDor >= 2 && statisticalTitan && legacy.score >= 2100;
  const qualifies = (premierTalent && (globalGreat || eliteWinner || sustainedMajor || regionalDynasty || statisticalTitan)) || epicOutlier;
  const alreadyHall = context?.hallSet ? context.hallSet.has(player.id) : state.history.hallOfFamePlayers.some((row)=>row.playerId===player.id);
  if (qualifies && !alreadyHall) {
    state.history.hallOfFamePlayers.push({
      playerId: player.id,
      inductionSeason: state.season,
      inductionSeasonLabel: formatSeason(state.season),
      position: player.position,
      score: Number(legacy.score.toFixed(1)),
      games: legacy.games,
      majorTitles: legacy.majorTitles,
      ballonDor: legacy.ballonDor,
      totalTitles: legacy.honours,
      individualAwards: legacy.awards
    });
    if (context?.hallSet) context.hallSet.add(player.id);
    if (!context?.suppressNews) {
      state.pendingSeasonNews ||= [];
      state.pendingSeasonNews.unshift({
      id: `news-${state.season + 1}-hof-${player.id}`,
      week: 0,
      importance: 'feature',
      category: 'Hall of Fame',
      headline: `${player.name} enters the Football Hall of Fame`,
      body: `${player.name} retires with a legacy score of ${legacy.score.toFixed(0)}, ${legacy.honours} team trophies and ${legacy.awards} major individual awards.`
      });
    }
  }
  for (const clubLegacy of clubLegendBreakdowns(state, player, context)) {
    const qualifiesClub = clubLegacy.games >= 220 && ((clubLegacy.score >= 450 && (clubLegacy.titles || 0) >= 4) || (clubLegacy.titles || 0) >= 10 || (clubLegacy.games >= 360 && clubLegacy.averageRating >= 7.45));
    if (!qualifiesClub) continue;
    const legendKey=`${player.id}::${clubLegacy.clubId}`;
    if (context?.legendSet ? context.legendSet.has(legendKey) : state.history.clubLegends.some((row)=>row.playerId===player.id&&row.clubId===clubLegacy.clubId)) continue;
    state.history.clubLegends.push({
      clubId: clubLegacy.clubId,
      playerId: player.id,
      inductionSeason: state.season,
      score: Number(clubLegacy.score.toFixed(1)),
      seasons: clubLegacy.seasons,
      games: clubLegacy.games,
      goals: clubLegacy.goals,
      assists: clubLegacy.assists,
      cleanSheets: clubLegacy.cleanSheets,
      averageRating: Number(clubLegacy.averageRating.toFixed(2)),
      titles: clubLegacy.titles || 0
    });
    if (context?.legendSet) context.legendSet.add(legendKey);
  }
}

function archivePowerRankings(state) {
  state.history.clubPowerRankings ||= [];
  state.history.leaguePowerRankings ||= [];
  const season = state.season;
  const champions = (state.history.champions || []).filter((row) => row.season === season && !row.isInternational);
  const titleWeight = new Map();
  for (const row of champions) titleWeight.set(row.winnerId, (titleWeight.get(row.winnerId) || 0) + legacyCompetitionWeight(state, row.competitionId, false));
  const leagueRows = new Map((state.history.clubSeasons || []).filter((row) => row.season === season).map((row) => [row.clubId, row]));
  const competitionRowsByClub = new Map();
  for (const row of state.history.clubCompetitionSeasons || []) {
    if (row.season !== season) continue;
    const rows = competitionRowsByClub.get(row.teamId) || [];
    rows.push(row);
    competitionRowsByClub.set(row.teamId, rows);
  }
  const clubRows = state.clubs.filter((club) => club.division === 1).map((club) => {
    const leagueRow = leagueRows.get(club.id);
    const competitionRows = competitionRowsByClub.get(club.id) || [];
    const games = competitionRows.reduce((sum,row)=>sum+(row.apps||0),0);
    const wins = competitionRows.reduce((sum,row)=>sum+(row.wins||0),0);
    const gd = competitionRows.reduce((sum,row)=>sum+(row.gf||0)-(row.ga||0),0);
    const score = club.strength * 0.75 + club.reputation * 0.45 + (games ? wins/games*22 : 0) + Math.max(-5, Math.min(12, gd/18)) + (titleWeight.get(club.id) || 0)*6 + (leagueRow ? Math.max(0, 8 - leagueRow.position) : 0);
    return { clubId: club.id, score: Number(score.toFixed(2)), strength: club.strength, leagueId: club.leagueId };
  }).sort((a,b)=>b.score-a.score).slice(0,60);
  clubRows.forEach((row,index)=>state.history.clubPowerRankings.push({ season, seasonLabel: formatSeason(season), rank:index+1, ...row }));
  for (const league of LEAGUE_DEFINITIONS) {
    const clubs = clubRows.filter((row)=>row.leagueId===league.id).slice(0,5);
    if (!clubs.length) continue;
    const continentalTitles = champions.filter((row) => ['UCL','UEL','UECL','LIB','SUD','CCC','ACL','CAFCL','OCL','CWC','ICUP'].includes(row.competitionId) && getClub(state,row.winnerId)?.leagueId===league.id).length;
    const score = clubs.reduce((sum,row)=>sum+row.score,0)/clubs.length + continentalTitles*12;
    state.history.leaguePowerRankings.push({ season, seasonLabel: formatSeason(season), leagueId: league.id, score:Number(score.toFixed(2)), continentalTitles });
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
      quality: state.coaches.find((coach) => coach.id === row.coachId)?.quality ?? null,
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

// Archived matches keep the result, events and statistics but drop the replay detail
// (every shot, per-slice possession, full line-ups); the Showcase keeps its own copy.
function compactArchivedMatch(match) {
  const { timeline, possessionSlices, lineups, keyChances, playerRatings, ...rest } = match;
  if (lineups) rest.formations = { home: lineups.home?.formationId || null, away: lineups.away?.formationId || null };
  return rest;
}

// Squad-power rank of every first-division club (the Power rankings measure).
function seasonPowerRanks(state) {
  const rows = state.clubs.filter((club) => club.division === 1).map((club) => [club.id, getTeamPower(state, club.id, false), club.reputation || 0])
    .sort((a, b) => b[1] - a[1] || b[2] - a[2]);
  return new Map(rows.map((row, index) => [row[0], index + 1]));
}

function archiveSeason(state) {
  let powerRanks = null;
  CONTRIBUTOR_INDEX.delete(state.current.playerStats);
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
  const cleanSheets = new Map();
  for (const match of state.current.matches) {
    if (match.isInternational) continue;
    if (match.awayGoals === 0) cleanSheets.set(`${match.competitionId}::${match.homeId}`, (cleanSheets.get(`${match.competitionId}::${match.homeId}`) || 0) + 1);
    if (match.homeGoals === 0) cleanSheets.set(`${match.competitionId}::${match.awayId}`, (cleanSheets.get(`${match.competitionId}::${match.awayId}`) || 0) + 1);
  }
  for (const league of Object.values(state.current.leagues)) {
    const sorted = sortTable(league.table);
    powerRanks ||= seasonPowerRanks(state);
    sorted.forEach((row, index) => state.history.clubSeasons.push({
      season: state.season,
      seasonLabel: formatSeason(state.season),
      leagueId: league.id,
      clubId: row.teamId,
      position: index + 1,
      powerRank: powerRanks.get(row.teamId) ?? null,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      gf: row.gf,
      ga: row.ga,
      gd: row.gd,
      points: row.points,
      cleanSheets: league.tier === 'summary' ? (row.cleanSheets || 0) : (cleanSheets.get(`${league.id}::${row.teamId}`) || 0)
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
    .filter((match) => match.landmark || match.stage === 'Final' || (!match.isInternational && rivalryDefinitionForIds(match.homeId, match.awayId)))
    .map((match) => compactArchivedMatch(match));
  state.history.landmarkMatches.push(...landmarks);
  archivePowerRankings(state);
}

function rarityCounts(state) {
  return state.players
    .filter((player) => player.status === 'active')
    .reduce((counts, player) => {
      counts[player.rarity] = (counts[player.rarity] || 0) + 1;
      return counts;
    }, {});
}

// v4.4: Epic and above come from academies (and the elite safety net), not from here.
function chooseNewRarity(state, counts, remainingSlots) {
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
  // v4.4: elite players now come from academies (Squad Reshape); this only keeps the total.
  const eliteIntake = [];
  const totalNew = Math.max(populationNeed, eliteIntake.length);
  let rosterByClub = null;

  for (let i = 0; i < totalNew; i += 1) {
    const rarity = eliteIntake[i] || chooseNewRarity(state, counts, totalNew - i);
    const realTemplate = ['generational', 'legend', 'epic'].includes(rarity) && shouldSpawnRealWorldStar(state, rarity)
      ? pick(state, availableRealWorldStars(state, rarity))
      : null;
    const player = realTemplate
      ? createRealWorldPlayer(state, realTemplate, { careerYear: 0, debutSeason: state.season + 1 })
      : createPlayer(state, { rarity, careerYear: 0, nationalSpecialist: true });
    player.debutAge ||= random(state) < 0.48 ? 17 : 18;
    player.birthYear = state.season + 1 - player.debutAge;
    player.debutSeason = state.season + 1;
    player.happiness = randomInt(state, 64, 92);
    const target = realTemplate
      ? resolveRealWorldClub(state, state.clubs, realTemplate)
      : chooseRookieDestination(state, state.clubs, player);
    if (target) {
      player.clubId = target.id;
      player.spawnClubId = target.id;
      player.clubJoinedSeason = state.season + 1;
      player.transferProtectedUntilSeason = state.season + 2;
      player.contractYears = randomInt(state, 2, 5);
      player.salary = Number((player.marketValue * (0.038 + random(state) * 0.022)).toFixed(1));
      if (!rosterByClub) {
        rosterByClub = new Map();
        for (const item of state.players) {
          if (item.status !== 'active' || !item.clubId) continue;
          if (!rosterByClub.has(item.clubId)) rosterByClub.set(item.clubId, []);
          rosterByClub.get(item.clubId).push(item);
        }
      }
      const displaced = (rosterByClub.get(target.id) || [])
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

function coachTargetsFor(total) {
  const elite = Object.values(COACH_RARITY_TARGETS).reduce((sum, value) => sum + value, 0);
  const rest = Math.max(0, total - elite);
  return { ...COACH_RARITY_TARGETS, uncommon: Math.round(rest * 0.35), common: rest - Math.round(rest * 0.35) };
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
  return ordinaryCoachRarity(state);
}

function chooseCoachNationalityForRarity(state, rarity) {
  return weightedPick(state, NATIONAL_TEAMS, (team) => {
    const byTier = COACH_NATION_WEIGHTS[rarity] || COACH_NATION_WEIGHTS.rare;
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

// Club strength keeps its long-standing meaning: the best goalkeeper plus the six
// best outfield players, blended with the institution's base strength.
function clubCoreAverage(players) {
  const active = players.filter((player) => player.status === 'active');
  if (!active.length) return 0;
  const keeper = active.filter((player) => player.position === 'GK').sort((a, b) => b.rating - a.rating)[0];
  const outfield = active.filter((player) => player.position !== 'GK').sort((a, b) => b.rating - a.rating).slice(0, keeper ? 6 : 7);
  const core = keeper ? [keeper, ...outfield] : outfield;
  return core.reduce((sum, player) => sum + player.rating, 0) / core.length;
}

function refreshClubStrength(state, club) {
  const average = clubCoreAverage(getRuntimeCache(state).clubPlayers.get(club.id) || []);
  if (!average) return;
  club.strength = clamp(Math.round(club.baseStrength * 0.55 + average * 0.45), 58, 96);
}

function refreshAllClubStrengths(state) {
  state.clubs.forEach((club) => refreshClubStrength(state, club));
  // Unnamed depth ratings follow club strength, so squads are rebuilt on next use.
  getRuntimeCache(state).clubSquads.clear();
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

// A squad player generated to complete a club's 15: close to the club's level, in the
// slot the coach's system needs, with a realistic spread of ages.
function createSquadFiller(state, club, position, { roleOptions = null, debutSeason = state.season, veteranMix = true } = {}) {
  const desired = clamp((club.strength || 66) - 6 + randomInt(state, -3, 3), 55, 84);
  const rarity = desired >= 80 ? 'rare' : desired >= 70 ? 'uncommon' : 'common';
  const careerYear = veteranMix ? randomInt(state, 0, 9) : 0;
  const player = createPlayer(state, { club, rarity, position, careerYear, roleOptions });
  const band = STAR_RARITIES[rarity];
  const multiplier = player.careerMultipliers[player.careerYear] || 1;
  player.baseQuality = clamp(Math.round(desired / multiplier), band.min, band.max);
  player.rating = playerRatingFor(player, multiplier);
  player.potential = undefined;
  assignPotential(player);
  player.marketValue = calculateMarketValueRaw(player.baseQuality, rarity, debutSeason - player.birthYear, position);
  player.salary = Math.max(0.3, Number((player.marketValue * (0.045 + random(state) * 0.025)).toFixed(1)));
  const shift = debutSeason - state.season;
  player.birthYear += shift;
  player.debutSeason += shift;
  markPlayerArrival(player, debutSeason);
  return player;
}

function ensureClubRosters(state) {
  const freeAgents = state.players.filter((player) => player.status === 'active' && !player.clubId);
  const activeByClub = new Map(state.clubs.map((club)=>[club.id, []]));
  const loanedOut = new Map();
  for (const player of state.players) {
    if (player.status === 'active' && player.clubId && activeByClub.has(player.clubId)) activeByClub.get(player.clubId).push(player);
    if (player.status === 'active' && player.loan) loanedOut.set(player.loan.parentClubId, (loanedOut.get(player.loan.parentClubId) || 0) + 1);
  }
  const clubs = [...state.clubs].sort((a, b) => b.reputation - a.reputation);
  state.current.offseasonFreeAgentSignings ||= [];
  for (const club of clubs) {
    // Players out on loan still belong to the squad they will return to.
    const target = Math.max(rosterTargetFor(club) >= SQUAD_SIZE ? 13 : 4, (club.division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[club.tier]) - (loanedOut.get(club.id) || 0));
    const active = activeByClub.get(club.id) || [];
    // Bloated squads release their weakest ordinary players before the season.
    if (active.length > target + 3) {
      const surplus = active.filter((player) => ['common', 'uncommon'].includes(player.rarity)
        && (!player.transferProtectedUntilSeason || player.transferProtectedUntilSeason <= state.season))
        .sort((a, b) => a.rating - b.rating)
        .slice(0, active.length - (target + 3));
      for (const player of surplus) {
        (state.current.surplusReleases ||= []).push({ playerId: player.id, clubId: club.id });
        player.lastClubId = club.id;
        player.clubId = null;
        player.contractYears = 0;
        player.salary = 0;
        active.splice(active.indexOf(player), 1);
      }
    }
    // v4.4: in the offseason full squads are completed by the Squad Reshape (youth first,
    // then the re-signing pool), so this only fills small cores here.
    while (active.length < target && !(state.offseasonProgress && rosterTargetFor(club) >= SQUAD_SIZE)) {
      const needPosition = positionNeedFromRoster(state, club, active);
      if (state.offseasonProgress && target < SQUAD_SIZE && (ensureAcademy(club), random(state) < youthSlotChance(club, true))) {
        const youth = createYouthPlayer(state, club, needPosition, rarityCounts(state), active.some((player) => player.rarity === 'generational'));
        active.push(youth);
        continue;
      }
      const desiredRating = club.strength + (club.reputation >= 84 ? 2 : club.division === 2 ? -8 : -3);
      const currentBill = rosterPayroll(active);
      const signable = (player) => recruitmentDestinationAllowed(state, player, club)
        && (!['epic', 'legend', 'generational'].includes(player.rarity) || primeDestinationAllowed(state, player, club))
        && canClubCarrySalary(club, currentBill, salaryOfferFor(state, player, club, 'free'), 0, 1.01);
      const positional = freeAgents.filter((player) => player.position === needPosition && signable(player));
      const pool = positional.length ? positional : freeAgents.filter((player) => player.position !== needPosition && signable(player));
      const systemNeed = clubSystemNeed(state, club, active);
      const systemSlot = systemNeed?.line === needPosition ? systemNeed.slotType : null;
      const nationalityCounts = new Map();
      for (const candidate of pool) nationalityCounts.set(candidate.nationality, (nationalityCounts.get(candidate.nationality) || 0) + 1);
      const domestic = pool.filter((player) => teamById(player.nationality)?.name === club.country);
      const shortlist = domestic.length && random(state) < 0.8 ? domestic : pool;
      const player = weightedPick(state, shortlist, (candidate) => playerGeographyWeight(state, candidate, club)
        * (systemSlot && slotFit(candidate, systemSlot) >= 0.94 ? 1.6 : 1)
        / ((1 + Math.abs(candidate.rating - desiredRating)) ** 2 * nationalityCounts.get(candidate.nationality)));
      if (player) {
        const formerClubId = player.lastClubId || null;
        const formerClub = formerClubId ? getClub(state, formerClubId) : null;
        const preTransfer = playerTransferSnapshot(player);
        player.clubId = club.id;
        const signingSeason = state.season + (state.current.completed ? 1 : 0);
        markPlayerArrival(player, signingSeason);
        player.contractYears = randomInt(state, ['generational', 'legend'].includes(player.rarity) ? 3 : 2, 5);
        player.salary = salaryOfferFor(state, player, club, 'free');
        player.lastClubId = null;
        player.happiness = clamp(62 + Math.round((club.reputation - 68) * 0.35) + randomInt(state, -5, 8), 45, 95);
        freeAgents.splice(freeAgents.indexOf(player), 1);
        active.push(player);
        const record = { id: `transfer-${state.nextTransferId++}`, season: signingSeason, seasonLabel: formatSeason(signingSeason), playerId: player.id,
          fromClubId: formerClubId, toClubId: club.id, fee: 0, marketValue: player.marketValue, freeTransfer: true, contractYears: player.contractYears, preTransfer };
        state.history.transfers.push(record);
        if (state.current && !state.current.completed) state.current.transfers.push(record);
        if (state.current && !state.current.completed) state.current.offseasonFreeAgentSignings.push({ playerId: player.id, toClubId: club.id });
        if (state.current && !state.current.completed && ['generational', 'legend', 'epic'].includes(player.rarity)) {
          const rivalMove = formerClub && formerClub.leagueId === club.leagueId && formerClub.id !== club.id;
          state.current.news.unshift({
            id: `news-${state.season}-free-agent-${player.id}-${club.id}`,
            week: 0,
            importance: player.rarity === 'generational' || rivalMove ? 'feature' : 'major',
            category: rivalMove ? 'Shock Transfer' : 'Transfer Market',
            headline: rivalMove ? `${player.name} joins ${club.name} after leaving ${formerClub.name}` : `${club.name} win the race for ${player.name}`,
            body: `${STAR_RARITIES[player.rarity].label} ${player.roleLabel.toLowerCase()} signs as a free agent${formerClub ? ` after his contract with ${formerClub.name} expired` : ''}.`,
            entityType: 'player', entityId: player.id
          });
        }
        continue;
      }
      const generatedRole = systemSlot ? bestRoleForSlot(systemSlot) : null;
      const debutSeason = state.season + (state.current.completed ? 1 : 0);
      let generated;
      if (target >= SQUAD_SIZE && active.length >= 4) {
        // Completing a full squad: a filler near the club's level rather than a raw rookie.
        generated = createSquadFiller(state, club, needPosition, { roleOptions: generatedRole ? [generatedRole] : null, debutSeason });
      } else {
        const rarity = random(state) < 0.18 ? 'uncommon' : 'common';
        generated = createPlayer(state, { club, rarity, position: needPosition, careerYear: 0, roleOptions: generatedRole ? [generatedRole] : null });
        generated.birthYear += debutSeason - state.season;
        generated.debutSeason = debutSeason;
        markPlayerArrival(generated, debutSeason);
      }
      const remainingRoom = Math.max(0.25, clubPayrollLimit(club) - rosterPayroll(active));
      generated.salary = Number(Math.min(generated.salary, remainingRoom).toFixed(1));
      state.players.push(generated);
      active.push(generated);
    }
  }
  recalculateClubPayrollPressure(state);
}

// ─── Squad Reshape (offseason, after the market) ─────────────────────────────────
// Every club with a full named squad matches its coach's 15: surplus players in a
// position are released (lowest rarity first, then lowest rating), then one pool of
// released players and free agents is shared out in rounds. Top-league first divisions
// pick first, the most disappointing seasons first; then the other first divisions.
// Gaps the pool cannot fill get a new squad player.
const RESHAPE_POSITIONS = ['GK', 'DF', 'MF', 'FW'];

function reshapeDisappointment(state, club, lastSeasonRows) {
  const row = lastSeasonRows.get(club.id);
  if (!row) return 0;
  const leagueClubs = state.clubs.filter((other) => other.leagueId === club.leagueId && other.division === club.division);
  const expected = 1 + leagueClubs.filter((other) => (other.reputation || 0) > (club.reputation || 0)).length;
  return row.position - expected;
}

function runSquadReshape(state) {
  invalidateRuntimeCache(state);
  const cache = getRuntimeCache(state);
  const report = { releases: [], signings: [], spawned: 0, youth: 0 };
  state.current.reshape = report;
  const signingSeason = state.season + (state.current.completed ? 1 : 0);
  const loanedOut = new Map();
  for (const player of state.players) {
    if (player.status === 'active' && player.loan) {
      const list = loanedOut.get(player.loan.parentClubId) || [];
      list.push(player);
      loanedOut.set(player.loan.parentClubId, list);
    }
  }
  const clubs = state.clubs.filter((club) => rosterTargetFor(club) >= SQUAD_SIZE);
  const rosters = new Map();
  const counts = new Map();
  const released = new Set();
  for (const club of clubs) {
    const target = clubSquadTarget(state, club);
    const roster = (cache.clubPlayers.get(club.id) || []).filter((player) => player.status === 'active' && player.clubId === club.id);
    const count = { GK: 0, DF: 0, MF: 0, FW: 0 };
    for (const player of [...roster, ...(loanedOut.get(club.id) || [])]) count[player.position] += 1;
    for (const position of RESHAPE_POSITIONS) {
      let over = count[position] - target[position];
      if (over <= 0) continue;
      // Players signed in this window are kept (no second move in one window).
      const candidates = roster.filter((player) => player.position === position && !player.loan && player.clubJoinedSeason !== signingSeason)
        .sort((a, b) => (STAR_RARITIES[a.rarity]?.rank || 1) - (STAR_RARITIES[b.rarity]?.rank || 1) || a.rating - b.rating);
      for (const player of candidates) {
        if (over <= 0) break;
        player.lastClubId = club.id;
        player.clubId = null;
        player.contractYears = 0;
        player.salary = 0;
        roster.splice(roster.indexOf(player), 1);
        count[position] -= 1;
        over -= 1;
        released.add(player.id);
        report.releases.push({ playerId: player.id, clubId: club.id, position, rarity: player.rarity, rating: player.rating });
        if (['generational', 'legend', 'epic'].includes(player.rarity)) {
          state.current.news.unshift({ id: `news-${signingSeason}-released-${player.id}`, week: 0, importance: player.rarity === 'epic' ? 'digest' : 'major', category: 'Squad Reshape', storyType: 'transfer',
            headline: `${club.name} release ${player.name}`, body: `The ${STAR_RARITIES[player.rarity].label.toLowerCase()} ${player.roleLabel.toLowerCase()} does not fit the coach's ${coachFormationPair(getCoach(state, club.id, false)).primary} squad.`, entityType: 'player', entityId: player.id });
        }
      }
    }
    rosters.set(club.id, roster);
    counts.set(club.id, count);
  }
  // Youth intake: open slots below the coach's 15 get academy rolls first.
  updateAcademies(state);
  const playerCounts = rarityCounts(state);
  for (const club of clubs) {
    const target = clubSquadTarget(state, club);
    const count = counts.get(club.id);
    const roster = rosters.get(club.id);
    if (academyClass(club) === 'top' && majorTrophyDrought(state, club)) {
      const extras = roster.filter((player) => !player.loan && player.clubJoinedSeason !== signingSeason && ((STAR_RARITIES[player.rarity]?.rank || 1) <= 3 && ((player.careerYear || 0) >= 9 || player.rarity === 'common')))
        .sort((a, b) => a.rating - b.rating).slice(0, 2);
      for (const player of extras) {
        player.lastClubId = club.id; player.clubId = null; player.contractYears = 0; player.salary = 0;
        roster.splice(roster.indexOf(player), 1);
        count[player.position] -= 1;
        released.add(player.id);
        report.releases.push({ playerId: player.id, clubId: club.id, position: player.position, rarity: player.rarity, rating: player.rating, reason: 'youth' });
      }
    }
    const hasGenerational = roster.some((player) => player.rarity === 'generational');
    for (const position of RESHAPE_POSITIONS) {
      for (let gap = target[position] - count[position]; gap > 0; gap -= 1) {
        if (random(state) >= youthSlotChance(club)) continue;
        const youth = createYouthPlayer(state, club, position, playerCounts, hasGenerational);
        roster.push(youth);
        count[youth.position] = (count[youth.position] || 0) + 1;
        report.youth = (report.youth || 0) + 1;
      }
    }
  }
  // One pool, best first within each position.
  const pool = { GK: [], DF: [], MF: [], FW: [] };
  for (const player of state.players) if (player.status === 'active' && !player.clubId && pool[player.position]) pool[player.position].push(player);
  for (const list of Object.values(pool)) list.sort((a, b) => b.rating - a.rating);
  const lastSeasonRows = new Map((state.history.clubSeasons || []).filter((row) => row.season === signingSeason - 1).map((row) => [row.clubId, row]));
  const ordered = [...clubs].sort((a, b) => {
    const groupA = FULL_DETAIL_LEAGUES.has(a.leagueId) ? 0 : 1;
    const groupB = FULL_DETAIL_LEAGUES.has(b.leagueId) ? 0 : 1;
    return groupA - groupB || reshapeDisappointment(state, b, lastSeasonRows) - reshapeDisappointment(state, a, lastSeasonRows) || (b.reputation || 0) - (a.reputation || 0) || a.id.localeCompare(b.id);
  });
  const deficit = (club) => {
    const target = clubSquadTarget(state, club);
    const count = counts.get(club.id);
    let best = null;
    for (const position of RESHAPE_POSITIONS) {
      const gap = target[position] - count[position];
      if (gap > 0 && (!best || gap > best.gap)) best = { position, gap };
    }
    return best;
  };
  let progress = true;
  while (progress) {
    progress = false;
    for (const club of ordered) {
      const need = deficit(club);
      if (!need) continue;
      const roster = rosters.get(club.id);
      const bill = rosterPayroll(roster);
      const list = pool[need.position];
      const index = list.findIndex((player) => recruitmentDestinationAllowed(state, player, club)
        && (!['epic', 'legend', 'generational'].includes(player.rarity) || primeDestinationAllowed(state, player, club))
        && canClubCarrySalary(club, bill, salaryOfferFor(state, player, club, 'free'), 0, 1.01));
      if (index < 0) continue;
      const player = list.splice(index, 1)[0];
      const formerClubId = player.lastClubId || null;
      const preTransfer = playerTransferSnapshot(player);
      player.clubId = club.id;
      markPlayerArrival(player, signingSeason);
      player.contractYears = randomInt(state, 1, 3);
      player.salary = salaryOfferFor(state, player, club, 'free');
      player.lastClubId = null;
      player.happiness = clamp(60 + randomInt(state, -5, 8), 45, 90);
      roster.push(player);
      counts.get(club.id)[player.position] += 1;
      const afterRelease = released.has(player.id);
      const record = { id: `transfer-${state.nextTransferId++}`, season: signingSeason, seasonLabel: formatSeason(signingSeason), playerId: player.id,
        fromClubId: formerClubId, toClubId: club.id, fee: 0, marketValue: player.marketValue, freeTransfer: true, contractYears: player.contractYears, preTransfer, reshape: true, signedAfterRelease: afterRelease };
      state.history.transfers.push(record);
      state.current.transfers.push(record);
      report.signings.push({ playerId: player.id, clubId: club.id, fromClubId: formerClubId, position: player.position, afterRelease });
      if (!afterRelease && ['generational', 'legend'].includes(player.rarity)) {
        state.current.news.unshift({ id: `news-${signingSeason}-free-move-${player.id}-${club.id}`, week: 0, importance: 'feature', category: 'Transfer Market', storyType: 'transfer', relevance: 80,
          headline: `${player.name} joins ${club.name} on a free`, body: `The ${STAR_RARITIES[player.rarity].label.toLowerCase()} free agent signs a ${player.contractYears}-year deal.`, entityType: 'player', entityId: player.id });
      }
      if (afterRelease && ['generational', 'legend', 'epic'].includes(player.rarity)) {
        state.current.news.unshift({ id: `news-${signingSeason}-resigned-${player.id}`, week: 0, importance: 'major', category: 'Squad Reshape', storyType: 'transfer',
          headline: `${club.name} snap up ${player.name}`, body: `Released by ${getClub(state, formerClubId)?.name || 'his club'}, he signs straight away.`, entityType: 'player', entityId: player.id });
      }
      progress = true;
    }
  }
  // Remaining gaps: a new squad player near the club's level.
  for (const club of ordered) {
    let need = deficit(club);
    while (need) {
      const roster = rosters.get(club.id);
      const generated = createSquadFiller(state, club, need.position, { debutSeason: signingSeason });
      generated.salary = Number(Math.min(generated.salary, Math.max(0.25, clubPayrollLimit(club) - rosterPayroll(roster))).toFixed(1));
      state.players.push(generated);
      roster.push(generated);
      counts.get(club.id)[need.position] += 1;
      report.spawned += 1;
      need = deficit(club);
    }
  }
  invalidateRuntimeCache(state);
  recalculateClubPayrollPressure(state);
  return report;
}

// ─── Moves: everyone who changed team this offseason and season ──────────────────
// One list for players and one for coaches, each move with a plain "how" line, sorted
// by rarity (Generational first) and then current rating / quality. Never by fee.
const MOVE_RARITY_ORDER = { generational: 6, legend: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };

function teamLabel(state, clubId, nationalTeamId = null) {
  if (clubId) return getClub(state, clubId)?.name || clubId;
  if (nationalTeamId) return getTeamName(state, nationalTeamId, true);
  return null;
}

function playerMoveRows(state) {
  const season = state.season;
  const current = state.current || {};
  const exits = new Map((current.contractExits || []).map((row) => [row.playerId, row.clubId]));
  const surplus = new Map((current.surplusReleases || []).map((row) => [row.playerId, row.clubId]));
  const reshape = current.reshape || current.offseason?.reshape || null;
  const reshapeReleased = new Map((reshape?.releases || []).map((row) => [row.playerId, row.clubId]));
  const rows = [];
  const money = (fee) => '$' + `${Number(fee || 0).toFixed(fee >= 10 ? 0 : 1)}m`;
  for (const move of state.history.transfers || []) {
    if (move.season !== season) continue;
    const from = teamLabel(state, move.fromClubId);
    const to = teamLabel(state, move.toClubId);
    const years = move.contractYears ? `${move.contractYears}-year deal` : null;
    let how;
    if (move.loan) how = 'Loan';
    else if (move.editorCreated) how = `Editor move${move.fee ? ` · ${money(move.fee)}` : ''}`;
    else if (move.reshape && move.signedAfterRelease) how = `Released by ${from || 'his club'} (squad reshape) · signed by ${to}`;
    else if (move.freeTransfer && move.fromClubId && surplus.get(move.playerId) === move.fromClubId) how = `Released by ${from} · signed by ${to}`;
    else if (move.freeTransfer && move.fromClubId) how = `Contract expired at ${from} · free${years ? `, ${years}` : ''}`;
    else if (move.freeTransfer) how = `Free agent · ${years || 'signed'}`;
    else how = `Transfer · ${money(move.fee)}`;
    rows.push({ playerId: move.playerId, fromClubId: move.fromClubId || null, toClubId: move.toClubId || null, how, kind: move.loan ? 'loan' : move.freeTransfer ? 'free' : 'transfer', fee: move.fee || 0 });
  }
  for (const row of current.loanReturns || []) rows.push({ playerId: row.playerId, fromClubId: row.fromClubId, toClubId: row.toClubId, how: 'Back from loan', kind: 'loan-return', fee: 0 });
  const unattached = (playerId, clubId, how) => {
    const player = getPlayer(state, playerId);
    if (!player || player.status !== 'active' || player.clubId) return;
    if (rows.some((row) => row.playerId === playerId && !row.toClubId)) return;
    rows.push({ playerId, fromClubId: clubId, toClubId: null, how, kind: 'unattached', fee: 0 });
  };
  for (const [playerId, clubId] of exits) unattached(playerId, clubId, 'Contract expired · unattached');
  for (const [playerId, clubId] of reshapeReleased) unattached(playerId, clubId, `Released by ${teamLabel(state, clubId)} (squad reshape) · unattached`);
  for (const [playerId, clubId] of surplus) unattached(playerId, clubId, `Released by ${teamLabel(state, clubId)} · unattached`);
  return rows.map((row) => {
    const player = getPlayer(state, row.playerId);
    return player ? { ...row, rarity: player.rarity, position: player.position, rating: player.rating, age: state.season - (player.birthYear || state.season - 25), name: player.name } : null;
  }).filter(Boolean).sort((a, b) => (MOVE_RARITY_ORDER[b.rarity] || 0) - (MOVE_RARITY_ORDER[a.rarity] || 0) || b.rating - a.rating || a.name.localeCompare(b.name));
}

function coachMoveRows(state) {
  const season = state.season;
  const inWindow = (move) => move.reason !== 'retired' && (move.season === season || (move.season === season - 1 && move.week === undefined));
  const byCoach = new Map();
  for (const move of state.history.coachMoves || []) {
    if (!inWindow(move)) continue;
    if (!byCoach.has(move.coachId)) byCoach.set(move.coachId, []);
    byCoach.get(move.coachId).push(move);
  }
  const departureText = (move, from) => {
    const reason = String(move.reason || '');
    if (/sacked|dismiss|board change|elite upgrade|failure|disappointment|qualification|federation/.test(reason)) return `Dismissed by ${from}`;
    if (/interim spell/.test(reason)) return `Interim spell at ${from} ends`;
    if (/contract/.test(reason)) return `Left ${from} after his contract`;
    return `Left ${from}`;
  };
  const rows = [];
  for (const [coachId, moves] of byCoach) {
    const coach = (state.coaches || []).find((item) => item.id === coachId);
    if (!coach) continue;
    const departure = moves.find((move) => (move.fromClubId || move.fromNationalTeamId) && !(move.toClubId || move.toNationalTeamId));
    const arrival = [...moves].reverse().find((move) => move.toClubId || move.toNationalTeamId);
    const fromClubId = departure?.fromClubId || arrival?.fromClubId || null;
    const fromNationalTeamId = departure?.fromNationalTeamId || arrival?.fromNationalTeamId || null;
    const from = teamLabel(state, fromClubId, fromNationalTeamId);
    const to = arrival ? teamLabel(state, arrival.toClubId, arrival.toNationalTeamId) : null;
    let how;
    if (arrival && /poached|approach/.test(String(arrival.reason || '')) && from) how = `Poached from ${from}`;
    else if (departure && arrival) how = `${departureText(departure, from)} · appointed by ${to}`;
    else if (arrival && arrival.reason === 'interim appointment') how = `Interim coach at ${to}`;
    else if (arrival) how = from ? `Left ${from} · appointed by ${to}` : `Appointed by ${to}`;
    else how = `${departureText(departure, from)} · unattached`;
    // Dismissed and taken back by the same employer: no change of job.
    if (arrival && (fromClubId || fromNationalTeamId) && fromClubId === (arrival.toClubId || null) && fromNationalTeamId === (arrival.toNationalTeamId || null)) continue;
    rows.push({ coachId, name: coach.name, rarity: coach.rarity, rating: coach.quality, fromClubId, fromNationalTeamId, toClubId: arrival?.toClubId || null, toNationalTeamId: arrival?.toNationalTeamId || null, how });
  }
  return rows.sort((a, b) => (MOVE_RARITY_ORDER[b.rarity] || 0) - (MOVE_RARITY_ORDER[a.rarity] || 0) || b.rating - a.rating || a.name.localeCompare(b.name));
}

export function getSeasonMoves(state, { clubId = null, eliteOnly = false } = {}) {
  let players = playerMoveRows(state);
  let coaches = coachMoveRows(state);
  if (clubId) {
    players = players.filter((row) => row.fromClubId === clubId || row.toClubId === clubId);
    coaches = coaches.filter((row) => row.fromClubId === clubId || row.toClubId === clubId);
  }
  if (eliteOnly) {
    players = players.filter((row) => (MOVE_RARITY_ORDER[row.rarity] || 0) >= 4);
    coaches = coaches.filter((row) => (MOVE_RARITY_ORDER[row.rarity] || 0) >= 4);
  }
  return { season: state.season, players, coaches };
}

// "Since last season" for one club: power rank then and now, arrivals and departures,
// the biggest rating changes in the squad (aging or growth) and any coach change.
export function getClubChanges(state, clubId) {
  const club = getClub(state, clubId);
  if (!club) return null;
  const lastRow = [...(state.history.clubSeasons || [])].filter((row) => row.clubId === clubId && row.season < state.season + (state.current?.completed ? 1 : 0)).sort((a, b) => b.season - a.season)[0] || null;
  const nowRank = club.division === 1 ? seasonPowerRanks(state).get(clubId) ?? null : null;
  const moves = getSeasonMoves(state, { clubId });
  const squad = (state.players || []).filter((player) => player.status === 'active' && player.clubId === clubId && Number.isFinite(player.previousRating));
  const changes = squad.map((player) => {
    const age = state.season - (player.birthYear || state.season - 25);
    const delta = player.rating - player.previousRating;
    const reason = delta < 0 ? (age >= 30 ? 'aging' : player.injury ? 'injury' : 'decline') : delta > 0 ? (age <= 24 ? 'development' : 'improvement') : 'unchanged';
    return { playerId: player.id, name: player.name, rarity: player.rarity, age, before: player.previousRating, after: player.rating, delta, reason };
  }).filter((row) => row.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || (MOVE_RARITY_ORDER[b.rarity] || 0) - (MOVE_RARITY_ORDER[a.rarity] || 0)).slice(0, 8);
  return {
    clubId,
    lastSeason: lastRow ? { season: lastRow.season, seasonLabel: lastRow.seasonLabel, position: lastRow.position, powerRank: lastRow.powerRank ?? null } : null,
    powerRankNow: nowRank,
    arrivals: moves.players.filter((row) => row.toClubId === clubId),
    departures: moves.players.filter((row) => row.fromClubId === clubId && row.toClubId !== clubId),
    coachArrivals: moves.coaches.filter((row) => row.toClubId === clubId),
    coachDepartures: moves.coaches.filter((row) => row.fromClubId === clubId && row.toClubId !== clubId),
    youthIntake: getYouthIntake(state, { clubId }),
    ratingChanges: changes
  };
}

export function getTeamFitness(state, teamId) {
  return Math.round(teamFitness(state, teamId));
}

export function getClubSquadTarget(state, clubId) {
  const club = getClub(state, clubId);
  return club ? clubSquadTarget(state, club) : null;
}

export function getSquadReshape(state) {
  return state.current?.reshape || state.current?.offseason?.reshape || null;
}

function compactFreeAgentPool(state) {
  const activeCount = state.players.reduce((sum, player) => sum + (player.status === 'active' ? 1 : 0), 0);
  let excess = Math.max(0, activeCount - (state.targetActivePlayers || activeCount));
  if (!excess) return;
  const candidates = state.players
    // v4.4: academies add Rare youth too, so unsigned Rares can also leave football.
    .filter((player) => player.status === 'active' && !player.clubId && ['common', 'uncommon', 'rare'].includes(player.rarity))
    .sort((a, b) => (STAR_RARITIES[a.rarity]?.rank || 1) - (STAR_RARITIES[b.rarity]?.rank || 1)
      || a.rating - b.rating || b.careerYear - a.careerYear);
  for (const player of candidates) {
    if (excess <= 0) break;
    player.status = 'untracked';
    player.contractYears = 0;
    player.salary = 0;
    excess -= 1;
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

// Fit (0–100) of a squad in every formation, computed once per vacancy.
function formationFitTable(players) {
  const named = players.filter((player) => player.status === 'active');
  const table = {};
  if (named.length < 11) {
    for (const id of Object.keys(FORMATIONS)) table[id] = 85;
    return table;
  }
  for (const id of Object.keys(FORMATIONS)) table[id] = formationFitScore(named, id);
  return table;
}

function coachSystemFitBonus(fitByFormation, coach) {
  const { primary, secondary } = coachFormationPair(coach);
  const fit = Math.max(fitByFormation[primary] ?? 85, (fitByFormation[secondary] ?? 85) - 4);
  return clamp((fit - 85) * 0.22, -4, 2.5);
}

// Career phases from careerYear / careerLength: early (first 30 %), peak, late (last 25 %).
export function coachCareerPhase(coach) {
  const length = Math.max(1, coach?.careerLength || 10);
  const share = (coach?.careerYear || 0) / length;
  return share < 0.3 ? 'early' : share > 0.75 ? 'late' : 'peak';
}

// The 12 strongest European clubs by reputation (then finances): where prime elite coaches work.
function topEuropeanClubs(state) {
  return new Set(state.clubs.filter((club) => club.confederation === 'Europe' && club.division === 1)
    .sort((a, b) => (b.reputation || 0) - (a.reputation || 0) || clubFinancialTierRank(b) - clubFinancialTierRank(a))
    .slice(0, 12).map((club) => club.id));
}

const isEliteCoach = (coach) => coach && ['generational', 'legend'].includes(coach.rarity);

// Seasons since a coach last left a job (for national-team reluctance).
function coachSeasonsOutOfWork(state, coach, lastMoveSeason) {
  if (coach.clubId || coach.nationalTeamId) return 0;
  return state.season - (lastMoveSeason.get(coach.id) ?? coach.debutSeason ?? state.season);
}

// Top clubs go after rising and prime elite coaches even without a vacancy: a top club
// without a Generational/Legend coach approaches the best one working elsewhere.
function poachEliteCoaches(state, topClubs) {
  const moves = [];
  const taken = new Set();
  const clubs = state.clubs.filter((club) => topClubs.has(club.id)).sort((a, b) => b.reputation - a.reputation);
  for (const club of clubs) {
    const current = getCoach(state, club.id, false);
    if (isEliteCoach(current) && coachCareerPhase(current) !== 'late') continue;
    const target = state.coaches.filter((coach) => coach.status !== 'retired' && isEliteCoach(coach) && !taken.has(coach.id)
      && coachCareerPhase(coach) !== 'late' && !(coach.clubId && topClubs.has(coach.clubId)))
      .sort((a, b) => b.quality - a.quality)[0];
    if (!target) continue;
    // Prime coaches accept; rising ones usually do.
    if (coachCareerPhase(target) === 'early' && random(state) > 0.75) continue;
    taken.add(target.id);
    if (current) {
      current.clubId = null;
      current.performanceScore = -1;
      state.history.coachMoves.push({ season: state.season, coachId: current.id, fromClubId: club.id, toClubId: null, reason: 'replaced by an elite coach' });
    }
    club.coachId = null;
    const fromClubId = target.clubId;
    const move = releaseCoachFromCurrentJob(state, target, state.season + 1, fromClubId ? 'poached by stronger club' : target.nationalTeamId ? 'national-team approach' : 'appointed');
    assignCoachToClub(state, target, club);
    state.history.coachMoves.push({ ...move, toClubId: club.id });
    moves.push({ club, coach: target, fromClubId });
    state.pendingSeasonNews ||= [];
    state.pendingSeasonNews.push({
      id: `news-${state.season + 1}-elite-coach-${club.id}`, week: 0, importance: 'major', category: 'Coaching Market',
      headline: `${club.name} land ${target.name}`,
      body: `The ${STAFF_RARITIES[target.rarity].label.toLowerCase()} coach ${fromClubId ? `leaves ${getClub(state, fromClubId)?.name || 'his club'}` : move.fromNationalTeamId ? 'leaves the national team' : 'returns to work'} for one of Europe's biggest jobs.`
    });
  }
  return moves;
}

function runCoachMarket(state) {
  const clubVacancies = [];
  const nationalVacancies = [];
  const topClubs = topEuropeanClubs(state);
  const lastMoveSeason = new Map();
  for (const move of state.history.coachMoves || []) lastMoveSeason.set(move.coachId, move.season);

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
    const dismissReason = getCoach(state, club.id, false)?.interim && (actual > expected) ? 'interim spell ends' : eliteNoTitleDismissal ? 'dismissed after a trophyless season' : ambitiousNoTitleDismissal ? 'dismissed after failing club expectations' : failure ? 'dismissed for league underperformance' : majorDrought ? 'dismissed after missing major objectives' : eliteUpgrade ? 'elite upgrade' : 'board change';
    const interimCoach = getCoach(state, club.id, false);
    const interimEnds = Boolean(interimCoach?.interim) && (actual > expected || random(state) < 0.5);
    if (interimCoach?.interim && !interimEnds) interimCoach.interim = false;
    if ((interimEnds || eliteNoTitleDismissal || ambitiousNoTitleDismissal || failure || majorDrought || eliteUpgrade || randomDismissal) && club.coachId) {
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

  // Top clubs first fill any vacancy and replace non-elite coaches with rising or prime elite ones.
  for (const { fromClubId } of poachEliteCoaches(state, topClubs)) {
    const formerClub = fromClubId ? getClub(state, fromClubId) : null;
    if (formerClub && formerClub.division === 1 && !clubVacancies.includes(formerClub)) clubVacancies.push(formerClub);
  }
  for (const club of state.clubs) if (club.division === 1 && !club.coachId && !clubVacancies.includes(club)) clubVacancies.push(club);
  for (const team of state.nationalTeams) if (!team.coachId && !nationalVacancies.includes(team)) nationalVacancies.push(team);
  // National federations recruit next. Major nations can approach successful domestic coaches already employed by clubs.
  nationalVacancies.sort((a, b) => b.strength - a.strength).forEach((team) => {
    let candidates = state.coaches.filter((coach) => coach.status !== 'retired' && !coach.nationalTeamId && nationalCoachCandidateAllowed(team, coach) && (coach.nationality === team.id || team.tier >= 3)
      && !(isEliteCoach(coach) && coachCareerPhase(coach) !== 'late' && coachSeasonsOutOfWork(state, coach, lastMoveSeason) < 2)
      // Epic coaches build club careers first: early ones stay in club football, prime ones usually turn federations down.
      && !(coach.rarity === 'epic' && coachCareerPhase(coach) !== 'late' && coachSeasonsOutOfWork(state, coach, lastMoveSeason) < 2
        && (coachCareerPhase(coach) === 'early' || stableStringRoll(`${coach.id}:${state.season}:national`) < 0.7)));
    let domestic = candidates.filter((coach) => coach.nationality === team.id);
    if (!domestic.length) {
      const generated = createStaffMember(state, 'coach', team.id, { rarity: cappedCoachRarity(state, team.tier === 1 ? 'rare' : team.tier === 2 ? 'uncommon' : 'common'), careerYear: randomInt(state, 1, 4), debutSeason: state.season + 1, appointmentSeason: state.season + 1, status: 'active' });
      state.coaches.push(generated);
      candidates.push(generated);
      domestic = [generated];
    }
    const useDomestic = random(state) < nationalCoachDomesticPreference(team);
    const pool = useDomestic ? domestic : candidates;
    const destinationScore = team.strength + 12;
    const fitByFormation = formationFitTable(getNationalSquad(state, team.id).squad);
    const scores = new Map(pool.map((coach) => [coach, ambition(coach) + nationalCoachRarityFit(team, coach) + (coach.nationality === team.id ? 10 : 0) + (coachCareerPhase(coach) === 'late' ? 12 : 0)
      - (coach.clubId ? Math.max(0, clubJobScore(getClub(state, coach.clubId)) - destinationScore) : 0)
      + coachSystemFitBonus(fitByFormation, coach)]));
    const ranked = [...pool].sort((a, b) => scores.get(b) - scores.get(a));
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
    // Boards also weigh how well the squad suits the candidate's preferred system.
    const fitByFormation = formationFitTable(getRuntimeCache(state).clubPlayers.get(club.id) || []);
    const topJob = topClubs.has(club.id);
    const phaseBonus = (coach) => {
      const phase = coachCareerPhase(coach);
      if (topJob) return isEliteCoach(coach) && phase !== 'late' ? 30 : coach.rarity === 'epic' && phase === 'peak' ? 6 : 0;
      // Prime elite coaches hold out for a top job; late ones are happy at home.
      if (isEliteCoach(coach) && phase === 'peak') return -25;
      return phase === 'late' && coach.nationality === nationality ? 6 : 0;
    };
    const scores = new Map(pool.map((coach) => [coach, ambition(coach) + (coach.nationality === nationality ? 3 : 0) + phaseBonus(coach)
      - (coach.clubId ? Math.max(0, clubJobScore(getClub(state, coach.clubId)) - destinationScore) : 0)
      + coachSystemFitBonus(fitByFormation, coach)]));
    const ranked = [...pool].sort((a, b) => scores.get(b) - scores.get(a));
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

function curateOffseasonHeadlines(state) {
  const priority = { feature: 3, major: 2, digest: 1 };
  const excluded = new Set(['Preseason Favorites', 'World', 'Archive']);
  const preferred = new Set(['Shock Transfer', 'Contract Drama', 'Transfer Market', 'Coaching Market', 'International Coaching', 'Retirements', 'Hall of Fame', 'Football Era', 'Boardroom', 'Club Status', 'New Generation']);
  return [...(state.current.news || [])]
    .filter((story) => !excluded.has(story.category) && (preferred.has(story.category) || story.importance === 'feature'))
    .sort((a, b) => (priority[b.importance] || 0) - (priority[a.importance] || 0) || Number(b.relevance || 0) - Number(a.relevance || 0))
    .filter((story, index, rows) => rows.findIndex((item) => item.id === story.id) === index)
    .slice(0, 16)
    .map((story) => ({ ...story }));
}

function archiveWorldNews(state, stories = state.current?.news || []) {
  state.history.news ||= [];
  const permanent = stories
    .filter((story) => story.importance === 'feature' || story.importance === 'major'
      || ['Shock Transfer', 'Contract Drama', 'Football Era', 'Hall of Fame', 'Retirements', 'Coaching Market'].includes(story.category))
    .map((story) => ({ ...story, season: story.season || state.season, seasonLabel: story.seasonLabel || formatSeason(state.season) }));
  const indexes = new Map(state.history.news.map((story, index) => [story.id, index]));
  for (const story of permanent) {
    const index = indexes.get(story.id);
    if (index >= 0) state.history.news[index] = story;
    else {
      indexes.set(story.id, state.history.news.length);
      state.history.news.push(story);
    }
  }
  state.history.news = state.history.news.slice(-1600);
}

function buildPlayerRecentSuccessMap(state, lookback = 2) {
  const cutoff = state.season - lookback + 1;
  const map = new Map();
  const ensure = (id) => { if (!map.has(id)) map.set(id,{ honours:0, awards:0, majorHonours:0, majorAwards:0 }); return map.get(id); };
  for (const row of state.history?.honours || []) {
    if (row.season < cutoff) continue;
    const item=ensure(row.playerId); item.honours += 1; if (competitionLegacyWeight(row.competitionId) >= 1.5) item.majorHonours += 1;
  }
  for (const row of state.history?.awards || []) {
    if (row.season < cutoff || (row.rank || 1) !== 1) continue;
    const item=ensure(row.playerId); item.awards += 1; if (String(row.name || '').includes("Ballon d'Or") || /Player of the Season|MVP/i.test(String(row.name || ''))) item.majorAwards += 1;
  }
  return map;
}

function playerRecentSuccess(state, player, lookback = 2) {
  return getPlayerHistoryCache(state).recentSuccess2.get(player.id) || { honours:0, awards:0, majorHonours:0, majorAwards:0 };
}

function clubTeammateQuality(state, player, club) {
  if (!club) return 60;
  const cache = getRuntimeCache(state);
  if (!cache.clubTopSixQuality.has(club.id)) {
    const top = [...(cache.clubPlayers.get(club.id) || [])].sort((a, b) => b.rating - a.rating).slice(0, 6);
    cache.clubTopSixQuality.set(club.id, top.length ? top.reduce((sum, item) => sum + item.rating, 0) / top.length : 0);
  }
  return cache.clubTopSixQuality.get(club.id) || club.strength || 60;
}

function ambitionHappinessChange(state, player, club) {
  if (!club) return 3;
  const success = playerRecentSuccess(state, player, 2);
  const rarityRank = STAR_RARITIES[player.rarity]?.rank || 1;
  const qualityGap = player.rating - (club.reputation || 60);
  const teammateGap = player.rating - clubTeammateQuality(state, player, club);
  let change = 0;
  if (rarityRank >= STAR_RARITIES.epic.rank) {
    const expectedSalary = Math.max(0.3, player.marketValue * 0.06);
    const underpaid = clamp(1 - (player.salary || 0) / expectedSalary, 0, 1);
    change -= Math.max(0, underpaid - 0.2) * 22;
    change -= Math.max(0, qualityGap - 4) * 0.9;
    change -= Math.max(0, teammateGap - 7) * 0.55;
    const stage = playerCareerStage(state, player);
    const tierRank = clubFinancialTierRank(club);
    const europeanRank = club.confederation === 'Europe' ? (leagueStrengthRows(state,'Europe').find((row)=>row.league.id===club.leagueId)?.rank || 99) : 99;
    if (stage === 'prime' && ['generational','legend'].includes(player.rarity)) {
      if (club.confederation !== 'Europe') change -= 13;
      if (tierRank < 4) change -= (4-tierRank) * 5;
      if (europeanRank > 5 && club.confederation === 'Europe') change -= Math.min(12, (europeanRank-5)*2);
    }
    if (player.rating >= 90 && success.majorHonours === 0) change -= 10;
    if (player.rating >= 95 && success.majorHonours === 0 && success.majorAwards === 0) change -= 10;
    if (success.majorHonours > 0) change += 11 + success.majorHonours * 4;
    if (success.majorAwards > 0) change += 6;
  } else if (player.rarity === 'rare') {
    change -= Math.max(0, qualityGap - 10) * 0.25;
  }
  // A new arrival gives the project a season before judging its shortcomings.
  if (change < 0 && playerClubTenure(state, player, state.season + 1) <= 1) change *= 0.3;
  return Math.round(change);
}

function evolveWorld(state) {
  for (const _ of evolveWorldSteps(state)) { /* run every step */ }
  return state;
}

// The offseason runs in steps so the UI can show what has happened so far between them.
function* evolveWorldSteps(state) {
  processPromotionRelegation(state);
  processOwnerTurnover(state);
  processCoachLifecycle(state);
  invalidateRuntimeCache(state);
  runCoachMarket(state);
  yield 'coaches';
  updateClubFinancialTiers(state);
  advanceLeagueEras(state);
  updateCountryFinancePools(state);
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
      club.reputation = clamp(club.reputation * 0.97 + club.strength * 0.03, 54, 97);
      club.fans = Math.max(35000, Math.round(club.fans * (0.985 + performance * 0.03)));
    }
  }
  refreshClubFinancesFromPools(state);

  const retirementLegacyContext = buildLegacyContext(state);
  const lifecyclePayroll = buildClubPayrollMap(state);
  const seasonPlayingTime = buildSeasonPlayingTime(state);

  for (const player of state.players) {
    if (player.status !== 'active') continue;
    const salaryBeforeLifecycle = Number(player.salary || 0);
    const clubBeforeLifecycle = player.clubId ? getClub(state, player.clubId) : null;
    player.contractYears = Math.max(0, (player.contractYears || 0) - 1);
    player.careerYear += 1;
    if (player.careerYear >= player.careerLength) {
      const formerClubId = player.clubId || null;
      player.status = 'retired';
      player.retirementSeason = state.season;
      evaluateRetiringPlayerLegacy(state, player, retirementLegacyContext);
      player.clubId = null;
      if (clubBeforeLifecycle && lifecyclePayroll.has(clubBeforeLifecycle.id)) {
        lifecyclePayroll.get(clubBeforeLifecycle.id).bill = Math.max(0, lifecyclePayroll.get(clubBeforeLifecycle.id).bill - salaryBeforeLifecycle);
      }
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
    developPlayer(state, player, seasonPlayingTime, clubBeforeLifecycle, clubBeforeLifecycle ? getCoach(state, clubBeforeLifecycle.id, false) : null);
    const multiplier = player.careerMultipliers[player.careerYear] ?? 0.85;
    player.rating = playerRatingFor(player, multiplier);
    player.marketValue = calculateMarketValue(state, player);
    const currentClub = player.clubId ? getClub(state, player.clubId) : null;
    const ambitionChange = ambitionHappinessChange(state, player, currentClub);
    player.happiness = clamp(player.happiness + randomInt(state, -5, 5) + ambitionChange, 5, 100);
    const migrationPressure = eliteMigrationPressure(state, player, currentClub);
    if (migrationPressure >= 35) {
      // Elite players accept a development spell, but once they enter their prime a
      // lack of continental progress creates ambition and contract pressure.
      player.happiness = clamp(player.happiness - Math.round(migrationPressure / 10), 5, 100);
    }
    if (player.contractYears === 0) {
      const club = currentClub;
      const rarityAmbition = ['generational', 'legend'].includes(player.rarity) ? 1 : player.rarity === 'epic' ? 0.55 : 0;
      const prestigeGap = club ? Math.max(0, player.rating - club.reputation) : 0;
      const renewalChance = club
        ? clamp(
            0.54 + player.happiness / 270 + (club.reputation - 68) / 280
            - prestigeGap / 75 - rarityAmbition * Math.max(0, 82 - club.reputation) / 70
            - migrationPressure / 135
            + (hasTrait(player, 'loyal') ? 0.18 : 0) - (hasTrait(player, 'mercenary') ? 0.12 : 0),
            0.04,
            0.94
          )
        : 0;
      const renewalSalary = club ? salaryOfferFor(state, player, club, 'renewal') : 0;
      const currentBill = club ? (lifecyclePayroll.get(club.id)?.bill || 0) : 0;
      const affordableRenewal = club && canClubCarrySalary(club, currentBill, renewalSalary, salaryBeforeLifecycle, 1.01);
      if (club && affordableRenewal && random(state) < renewalChance) {
        player.contractYears = randomInt(state, 1, 4);
        player.salary = renewalSalary;
        if (lifecyclePayroll.has(club.id)) lifecyclePayroll.get(club.id).bill = Math.max(0, currentBill - salaryBeforeLifecycle + renewalSalary);
        player.happiness = clamp(player.happiness + randomInt(state, 2, 10), 30, 100);
      } else {
        if (club) {
          player.lastClubId = club.id;
          (state.pendingContractExits ||= []).push({ playerId: player.id, clubId: club.id });
          if (lifecyclePayroll.has(club.id)) lifecyclePayroll.get(club.id).bill = Math.max(0, currentBill - salaryBeforeLifecycle);
          if (['generational', 'legend', 'epic'].includes(player.rarity)) {
            state.pendingSeasonNews ||= [];
            state.pendingSeasonNews.unshift({
              id: `news-${state.season + 1}-contract-exit-${player.id}`,
              week: 0,
              importance: ['generational', 'legend'].includes(player.rarity) ? 'major' : 'digest',
              category: 'Contract Drama',
              headline: `${player.name} leaves ${club.name} at the end of his contract`,
              body: `${affordableRenewal ? 'Talks failed to produce a new agreement' : 'The club could not fit a renewal inside its sustainable payroll'}. The ${STAR_RARITIES[player.rarity].label.toLowerCase()} player enters the market as a free agent.`,
              entityType: 'player', entityId: player.id
            });
          }
        }
        player.clubId = null;
        player.salary = 0;
        player.happiness = Math.max(player.happiness, 58);
      }
    }
    updatePlayerDiscontent(state, player, player.clubId ? currentClub : null);
    player.fame = clamp(player.fame + randomInt(state, -1, 2), 5, 100);
  }
  yield 'contracts';
  applyDynastySalaryPressure(state);
  applyPayrollBudgetConstraints(state);
  generateReplacementStars(state);
  ensureClubRosters(state);
  compactFreeAgentPool(state);
  invalidateRuntimeCache(state);
  refreshAllClubStrengths(state);
}

// Major continental titles and finals per club, indexed once per champions-list size
// (this is asked thousands of times per transfer window).
const MAJOR_ACHIEVEMENT_CACHE = new WeakMap();
const MAJOR_CONTINENTAL_IDS = new Set(['UCL', 'LIB', 'CCC', 'ACL', 'CAFCL', 'OCL']);
function majorAchievementIndex(state) {
  const champions = state.history?.champions || [];
  let cached = MAJOR_ACHIEVEMENT_CACHE.get(state);
  if (cached && cached.length === champions.length && cached.season === state.season) return cached.byClub;
  const byClub = new Map();
  const add = (clubId, row, kind) => {
    if (!byClub.has(clubId)) byClub.set(clubId, []);
    byClub.get(clubId).push([row.season, kind]);
  };
  for (const row of champions) {
    if (!MAJOR_CONTINENTAL_IDS.has(row.competitionId)) continue;
    if (row.winnerId) add(row.winnerId, row, 1);
    if (row.runnerUpId && row.runnerUpId !== row.winnerId) add(row.runnerUpId, row, 0);
  }
  MAJOR_ACHIEVEMENT_CACHE.set(state, { length: champions.length, season: state.season, byClub });
  return byClub;
}

function recentMajorClubAchievement(state, clubId, lookback = 2) {
  if (!clubId) return { titles: 0, finals: 0, mostRecentTitleAge: null };
  const cutoff = state.season - lookback;
  let titles = 0;
  let finals = 0;
  let mostRecentTitleAge = null;
  for (const [season, won] of majorAchievementIndex(state).get(clubId) || []) {
    if (season < cutoff) continue;
    if (won) {
      titles += 1;
      const age = Math.max(0, state.season - season);
      mostRecentTitleAge = mostRecentTitleAge === null ? age : Math.min(mostRecentTitleAge, age);
    } else finals += 1;
  }
  return { titles, finals, mostRecentTitleAge };
}

function computeLeagueStrengthRows(state, region = null) {
  initializeCountryFinance(state);
  const rows = LEAGUE_DEFINITIONS
    .filter((league) => !region || league.confederation === region)
    .map((league) => {
      const powers = (state.clubs || [])
        .filter((club) => club.leagueId === league.id && club.division === 1)
        .map((club) => calculateTeamStrength(state, club.id, false))
        .sort((a, b) => b - a)
        .slice(0, 5);
      const powerScore = powers.length ? powers.reduce((sum, value) => sum + value, 0) / powers.length : 0;
      const financialPool = countryPool(state, league.country);
      const financeProfile = countryFinanceProfile(league.country);
      const financeScore = clamp(50 + (financialPool - 80) / 880 * 44, 50, 94);
      // Market strength has inertia: squad quality matters, but a temporary collection of stars
      // cannot instantly turn a tertiary league into a Big Four destination.
      const era = leagueEraFor(state, league.id);
      const eraBonus = leagueEraMarketBonus(state, league.id);
      const marketScore = powerScore * 0.46 + financeScore * 0.54 + eraBonus;
      return { league, score: marketScore, powerScore, financialPool, financeScore, era, eraBonus };
    })
    .sort((a, b) => b.score - a.score);
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

function clubFinancialTierRank(club) {
  return CLUB_FINANCIAL_TIERS[club?.financialTier]?.rank || 1;
}

function clubDestinationScore(state, club) {
  if (!club) return 0;
  const power = calculateTeamStrength(state, club.id, false);
  const recent = recentMajorClubAchievement(state, club.id, 3);
  const profile = countryFinanceProfile(club.country);
  const pool = countryPool(state, club.country);
  const financeScore = clamp(50 + (pool - 80) / 880 * 44, 50, 94);
  const tierBonus = { S:14, T1:8, T2:2, R:-4 }[club.financialTier || 'R'];
  const eraBonus = leagueEraMarketBonus(state, club.leagueId);
  return power * 0.40 + (club.reputation || 60) * 0.25 + financeScore * 0.17 + tierBonus + eraBonus * 0.65 + recent.titles * 5 + recent.finals * 2;
}

function getEliteMarketContext(state) {
  const cached = ELITE_MARKET_CACHE.get(state);
  if (cached) return cached;
  const rowsByRegion = new Map();
  for (const region of ['Europe','South America','North America','Asia','Africa','Oceania']) {
    rowsByRegion.set(region, computeLeagueStrengthRows(state, region));
  }
  const europeanClubRows = (state.clubs || [])
    .filter((club) => club.division === 1 && club.confederation === 'Europe')
    .map((club) => ({ club, score: clubDestinationScore(state, club) }))
    .sort((a, b) => b.score - a.score);
  const context = { rowsByRegion, europeanClubRows };
  ELITE_MARKET_CACHE.set(state, context);
  return context;
}

function leagueStrengthRows(state, region = null) {
  if (region) return getEliteMarketContext(state).rowsByRegion.get(region) || [];
  return [...getEliteMarketContext(state).rowsByRegion.values()].flat().sort((a,b)=>b.score-a.score).map((row,index)=>({...row,rank:index+1}));
}

function europeanEliteClubIds(state, count = 18) {
  return new Set(getEliteMarketContext(state).europeanClubRows.slice(0, count).map((row) => row.club.id));
}

function isExceptionalNonEuropeanProject(state, club) {
  if (!club || club.confederation === 'Europe' || clubFinancialTierRank(club) < 4) return false;
  const owner = getOwner(state, club.id);
  const ownerElite = owner && ['generational','legend'].includes(owner.rarity) && ['billionaire','consortium','negotiator'].includes(owner.profile);
  const power = calculateTeamStrength(state, club.id, false);
  const recent = recentMajorClubAchievement(state, club.id, 2);
  return Boolean(ownerElite && power >= 90 && (recent.titles > 0 || countryPool(state, club.country) >= 430));
}

function primeDestinationAllowed(state, player, buyer, seller = null) {
  const stage = playerCareerStage(state, player);
  if (stage === 'late') return true;
  const buyerScore = clubDestinationScore(state, buyer);
  const sellerScore = seller ? clubDestinationScore(state, seller) : 0;
  const europeRows = leagueStrengthRows(state, 'Europe');
  const europeRank = europeRows.find((row)=>row.league.id===buyer.leagueId)?.rank || 99;
  const tierRank = clubFinancialTierRank(buyer);
  const institutionalGiant = buyer.confederation === 'Europe'
    && tierRank >= 4
    && (buyer.reputation || 0) >= 89
    && calculateTeamStrength(state, buyer.id, false) >= 84;
  if (stage === 'development') {
    if (seller && (buyerScore < sellerScore - 2.5 || (seller.confederation === 'Europe' && buyer.confederation !== 'Europe'))) {
      // A rare young adventurer can build his career abroad, including outside
      // Europe, without making that path the standard destination for prospects.
      return buyer.reputation >= 70 && stableStringRoll(`${state.season}:${state.seed}:${buyer.id}:adventure:${player.id}`) < 0.008;
    }
    return true;
  }
  if (player.rarity === 'generational') {
    if (buyer.confederation !== 'Europe') return isExceptionalNonEuropeanProject(state, buyer) && random(state) < 0.025;
    if (europeRank > 4 && !institutionalGiant) return false;
    if (tierRank < 4 && !(tierRank === 3 && europeRank <= 4 && calculateTeamStrength(state,buyer.id,false) >= 90)) return false;
  } else if (player.rarity === 'legend') {
    if (buyer.confederation !== 'Europe') {
      if (seller?.confederation === buyer.confederation && tierRank >= 4 && sellerScore <= buyerScore + 1) return true;
      return isExceptionalNonEuropeanProject(state, buyer) && random(state) < 0.045;
    }
    if (europeRank > 8 && !institutionalGiant) return false;
    if (tierRank < 3) return false;
  } else if (player.rarity === 'epic') {
    // Prime Epics can live at Roma, Dortmund, Porto, Ajax, Boca, etc., but a European
    // prime star does not voluntarily make a major sporting downgrade to Uruguay/Colombia.
    if (seller?.confederation === 'Europe' && buyer.confederation !== 'Europe') return false;
    if (seller && buyerScore < sellerScore - 1.5) return false;
    if (buyer.confederation === 'Europe' && europeRank > 11 && tierRank < 4) return false;
  }
  // A frustrated star can accept a credible fresh project below his current
  // giant's score. Requiring an upgrade trapped stars at the very best clubs.
  const toleratedDrop = player.transferListed ? 10 : player.happiness < 40 ? 5 : 1.5;
  return !seller || buyerScore >= sellerScore - toleratedDrop;
}

function playerCareerStage(state, player) {
  const age = Math.max(player.debutAge || 17, state.season - player.birthYear);
  const remaining = Math.max(0, (player.careerLength || 16) - (player.careerYear || 0));
  if (age <= 21 || (player.careerYear || 0) <= 3) return 'development';
  if (age >= 32 || remaining <= 3) return 'late';
  return 'prime';
}

function eliteMigrationPressure(state, player, club) {
  if (!club || !['generational', 'legend', 'epic'].includes(player.rarity)) return 0;
  const age = Math.max(player.debutAge || 17, state.season - player.birthYear);
  const stage = playerCareerStage(state, player);
  const eliteEurope = europeanEliteClubIds(state, 18);
  const europeanLeagues = leagueStrengthRows(state, 'Europe');
  const leagueRank = europeanLeagues.find((row) => row.league.id === club.leagueId)?.rank || 99;
  const isEliteDestination = eliteEurope.has(club.id);
  const tierRank = clubFinancialTierRank(club);
  const success = recentMajorClubAchievement(state, club.id, 2);

  let pressure = player.rarity === 'generational' ? 38 : player.rarity === 'legend' ? 27 : 11;
  if (stage === 'development') pressure *= 0.3;
  if (stage === 'late') pressure *= 0.42;

  if (stage === 'prime') {
    if (club.confederation !== 'Europe') pressure += player.rarity === 'epic' ? 18 : 42;
    else {
      if (leagueRank > 4) pressure += (leagueRank - 4) * (player.rarity === 'epic' ? 2.2 : 4.6);
      if (tierRank < 4 && ['generational','legend'].includes(player.rarity)) pressure += (4 - tierRank) * 13;
      if (!isEliteDestination && ['generational','legend'].includes(player.rarity)) pressure += 18;
    }
  }
  pressure += Math.max(0, player.rating - (club.reputation || 60)) * 1.2;
  pressure += Math.max(0, player.rating - clubTeammateQuality(state, player, club) - 4) * 0.95;
  if (age >= 22) pressure += Math.max(0, player.rating - 91) * 2.3;

  // Only major continental success truly buys patience from an all-time talent.
  if (success.titles) pressure -= success.mostRecentTitleAge <= 1 ? 70 : 44;
  pressure -= success.finals * 14;
  return clamp(pressure, 0, 100);
}

function askingPrice(state, player, buyer = null) {
  const happiness = player.happiness ?? 50;
  const happinessFactor = happiness < 15 ? 0.28 : happiness < 30 ? 0.38 : happiness < 45 ? 0.53 : happiness < 60 ? 0.72 : 0.90 + (happiness - 60) / 210;
  const years = Math.max(0, player.contractYears || 0);
  const contractFactor = years <= 1 ? 0.42 : years === 2 ? 0.68 : years === 3 ? 0.86 : 1.0;
  const discount = 1 - (buyer?.ownerNegotiationBonus || 0) * 0.34;
  const currentClub = player.clubId ? getClub(state, player.clubId) : null;
  const ambitionPressure = currentClub ? eliteMigrationPressure(state, player, currentClub) : 0;
  const ambitionDiscount = ambitionPressure >= 88 ? 0.54 : ambitionPressure >= 72 ? 0.66 : 1 - Math.min(0.28, ambitionPressure * 0.003);
  const payrollPressure = Number(currentClub?.payrollPressureRatio || 1);
  const payrollDiscount = payrollPressure >= 1.55 ? 0.62 : payrollPressure >= 1.35 ? 0.74 : payrollPressure >= 1.18 ? 0.86 : 1;
  return Number((player.marketValue * happinessFactor * contractFactor * discount * ambitionDiscount * payrollDiscount).toFixed(1));
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

// The squad of 15 the club's coach wants (by his preferred formation).
function clubSquadTarget(state, club) {
  const coach = club ? getCoach(state, club.id, false) : null;
  return squadTargetForFormation(coachFormationPair(coach).primary);
}

function rosterTargetFor(club) {
  if (!club) return CLUB_ROSTER_TARGET.summary;
  return club.division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[club.tier] || CLUB_ROSTER_TARGET.summary;
}

// The slot in the coach's preferred formation that the squad fills worst. Memoised
// per roster array and length because the market asks many times per window.
// One entry per club (bounded), so market churn does not pile up weak references.
const SYSTEM_NEED_CACHE = new Map();
function clubSystemNeed(state, club, players = []) {
  if (rosterTargetFor(club) < SQUAD_SIZE || players.length < 11) return null;
  const cached = SYSTEM_NEED_CACHE.get(club.id);
  const coach = getCoach(state, club.id, false);
  const { primary } = coachFormationPair(coach);
  if (cached && cached.players === players && cached.length === players.length && cached.formation === primary) return cached.need;
  const needs = formationNeeds(players, primary);
  const weakest = needs.weakestSlot;
  const need = weakest && (weakest.fit < 0.92 || weakest.effective < (club.strength || 70) - 9)
    ? { line: weakest.line, slotType: weakest.slotType, formation: primary }
    : null;
  SYSTEM_NEED_CACHE.set(club.id, { players, length: players.length, formation: primary, need });
  return need;
}

function positionNeedFromRoster(state, club, players = []) {
  const positions = ['GK','DF','MF','FW'];
  const counts = { GK:0, DF:0, MF:0, FW:0 };
  const totals = { GK:0, DF:0, MF:0, FW:0 };
  for (const player of players) { counts[player.position] += 1; totals[player.position] += player.rating; }
  const ideal = rosterTargetFor(club) >= SQUAD_SIZE ? clubSquadTarget(state, club) : { GK:1, DF:1, MF:1, FW:1 };
  const missing = positions.filter((position)=>counts[position] < ideal[position]);
  if (missing.length) return missing.sort((a,b)=>(ideal[b]-counts[b])-(ideal[a]-counts[a]) || ({FW:4,MF:3,DF:2,GK:1}[b]-({FW:4,MF:3,DF:2,GK:1}[a])))[0];
  // Clubs buy for their coach's system: a badly filled slot decides the position.
  const system = clubSystemNeed(state, club, players);
  if (system) return system.line;
  const naturalPriority = { GK:0.38, DF:1.08, MF:1.22, FW:1.34 };
  return positions.sort((a,b)=>{
    const avgA=counts[a]?totals[a]/counts[a]:club.strength-12, avgB=counts[b]?totals[b]/counts[b]:club.strength-12;
    return naturalPriority[b]*clamp(club.strength-avgB+8,1,22)-naturalPriority[a]*clamp(club.strength-avgA+8,1,22);
  })[0];
}

function playerClubTenure(state, player, season = state.season) {
  if (!player.clubId) return 0;
  if (!Number.isFinite(player.clubJoinedSeason)) {
    // Older saves already contain dated moves and season rows. Recover the current
    // spell without relocating anyone or treating every veteran as a new signing.
    const lastMove = (state.history?.transfers || []).filter((row) => row.playerId === player.id).at(-1);
    const rows = (state.history?.playerSeasons || []).filter((row) => row.playerId === player.id && !row.isInternational && row.teamId)
      .sort((a, b) => b.season - a.season);
    let joined = null;
    let previousSpellSeason = null;
    for (const row of rows) {
      if (row.teamId !== player.clubId) { previousSpellSeason = row.season; break; }
      joined = row.season;
    }
    player.clubJoinedSeason = lastMove?.toClubId === player.clubId && (previousSpellSeason === null || lastMove.season > previousSpellSeason) ? lastMove.season
      : joined ?? player.debutSeason ?? season - Math.min(player.careerYear || 0, 5);
  }
  return Math.max(0, season - player.clubJoinedSeason);
}

function markPlayerArrival(player, season) {
  player.clubJoinedSeason = season;
  player.transferProtectedUntilSeason = season + 1;
  player.unhappySeasons = 0;
  player.lastDiscontentSeason = null;
  player.transferListed = false;
}

function updatePlayerDiscontent(state, player, club) {
  if (!club || !['epic', 'legend', 'generational'].includes(player.rarity) || player.lastDiscontentSeason === state.season) return;
  player.lastDiscontentSeason = state.season;
  const unhappy = player.happiness < 45;
  player.unhappySeasons = unhappy ? (player.unhappySeasons || 0) + 1 : 0;
  player.transferListed = player.unhappySeasons >= 2 && playerClubTenure(state, player, state.season + 1) >= 2;
}

function availableForTransfer(state, player) {
  if (player.loan) return false;
  if (player.transferProtectedUntilSeason && state.season < player.transferProtectedUntilSeason) return false;
  const seller = getClub(state, player.clubId);
  if (!seller || !['epic', 'legend', 'generational'].includes(player.rarity)) return true;
  const success = playerRecentSuccess(state, player);
  const chance = eliteDepartureChance({
    tenure: playerClubTenure(state, player), topClub: seller.reputation >= 85 || clubFinancialTierRank(seller) >= 3,
    happiness: player.happiness, unhappySeasons: player.unhappySeasons || 0,
    migrationPressure: eliteMigrationPressure(state, player, seller), payrollPressure: Number(seller.payrollPressureRatio || 1),
    success: success.majorHonours + success.majorAwards,
    temperament: hasTrait(player, 'loyal') ? 0.05 : hasTrait(player, 'mercenary') ? 0.95 : stableStringRoll(`temperament:${player.id}`), lateCareer: playerCareerStage(state, player) === 'late'
  });
  // One availability decision per player/window across all market routes.
  return stableStringRoll(`${state.season}:${state.seed}:departure:${player.id}`) < chance;
}

function transferPlayer(state, player, buyer, seller, fee, freeTransfer = false) {
  const oldClubId = player.clubId;
  const recordedFromClubId = oldClubId || player.lastClubId || null;
  const formerClub = seller || (recordedFromClubId ? getClub(state, recordedFromClubId) : null);
  const preTransfer = playerTransferSnapshot(player);
  if (seller) seller.finances += fee;
  buyer.finances = Math.max(0, buyer.finances - fee);
  buyer.transferBudget = Math.max(0, buyer.transferBudget - fee);
  player.clubId = buyer.id;
  noteRosterChange(state, player, oldClubId, buyer.id);
  if (!freeTransfer && fee > 0) noteTransferFeeRecord(state, player, buyer, seller, fee);
  markPlayerArrival(player, state.season);
  player.contractYears = randomInt(state, ['generational', 'legend'].includes(player.rarity) ? 3 : 2, 5);
  player.salary = salaryOfferFor(state, player, buyer, freeTransfer ? 'free' : 'transfer');
  player.lastClubId = null;
  const destinationGain = clubDestinationScore(state, buyer) - (seller ? clubDestinationScore(state, seller) : 60);
  player.happiness = clamp(68 + Math.round(destinationGain * 0.65) + randomInt(state, -5, 9), 42, 100);
  player.transferListed = false;
  const record = {
    id: `transfer-${state.nextTransferId++}`,
    season: state.season,
    seasonLabel: formatSeason(state.season),
    playerId: player.id,
    fromClubId: recordedFromClubId,
    toClubId: buyer.id,
    fee,
    marketValue: player.marketValue,
    freeTransfer,
    contractYears: player.contractYears,
    preTransfer
  };
  state.current.transfers.push(record);
  state.history.transfers.push(record);
  recalculateClubPayrollPressure(state, [buyer.id, recordedFromClubId].filter(Boolean));
  if (freeTransfer && ['generational', 'legend'].includes(player.rarity) && !(formerClub && formerClub.leagueId === buyer.leagueId && formerClub.id !== buyer.id)) {
    state.current.news.unshift({
      id: `news-${state.season}-free-move-${player.id}-${buyer.id}`, week: 0, importance: 'feature', category: 'Transfer Market', storyType: 'transfer', relevance: 80,
      headline: `${player.name} joins ${buyer.name} on a free`,
      body: `The ${STAR_RARITIES[player.rarity].label.toLowerCase()} ${player.roleLabel.toLowerCase()} ${formerClub ? `leaves ${formerClub.name} at the end of his contract` : 'was a free agent'} and signs a ${player.contractYears}-year deal.`,
      entityType: 'player', entityId: player.id, transferRecordId: record.id
    });
    return;
  }
  if (['generational', 'legend', 'epic'].includes(player.rarity)) {
    const rivalMove = formerClub && formerClub.leagueId === buyer.leagueId && formerClub.id !== buyer.id;
    state.current.news.unshift({
      id: `news-${state.season}-transfer-${player.id}-${buyer.id}`,
      week: 0,
      importance: player.rarity === 'generational' ? 'feature' : 'major',
      category: rivalMove && freeTransfer ? 'Shock Transfer' : 'Transfer Market',
      headline: rivalMove && freeTransfer ? `${player.name} crosses the divide to ${buyer.name}` : `${player.name} signs for ${buyer.name}`,
      body: `${STAR_RARITIES[player.rarity].label} ${player.roleLabel.toLowerCase()} moves from ${formerClub?.name || 'free agency'} for ${freeTransfer ? 'no transfer fee' : `$${fee.toFixed(1)}m`}.${rivalMove ? ` The move strengthens a direct ${formerClub?.country || ''} rival.` : ''}`,
      entityType: 'player',
      entityId: player.id,
      transferRecordId: record.id
    });
  }
}

function playerTransferSnapshot(player) {
  return {
    clubId: player.clubId || null,
    lastClubId: player.lastClubId || null,
    contractYears: Number(player.contractYears || 0),
    salary: Number(player.salary || 0),
    happiness: Number(player.happiness || 0),
    clubJoinedSeason: player.clubJoinedSeason ?? null,
    transferProtectedUntilSeason: player.transferProtectedUntilSeason ?? null,
    transferListed: Boolean(player.transferListed),
    unhappySeasons: Number(player.unhappySeasons || 0),
    lastDiscontentSeason: player.lastDiscontentSeason ?? null
  };
}

function ensureOffseasonEditor(state) {
  if (!isOffseasonEditorAvailable(state)) throw new Error('The Editor is available only during the offseason, before Week 1.');
}

function refreshOffseasonEditorSummary(state) {
  const offseason = state.current?.offseason;
  if (!offseason) return;
  offseason.transfers = [...(state.current.transfers || [])];
  offseason.freeAgents = (state.players || []).filter((player) => player.status === 'active' && !player.clubId)
    .sort((a, b) => b.rating - a.rating).slice(0, 80).map((player) => player.id);
  offseason.freeAgentSignings = [...(state.current.offseasonFreeAgentSignings || [])].slice(-120);
  offseason.headlines = curateOffseasonHeadlines(state);
}

function addEditorNews(state, headline, body, entityId = null) {
  state.current.news.unshift({
    id: `editor-${state.season}-${state.current.editorActions?.length || 0}`,
    week: 0,
    importance: 'major',
    category: 'Editor',
    headline,
    body,
    ...(entityId ? { entityType: 'player', entityId } : {})
  });
}

function addEditorAction(state, action) {
  state.current.editorActions ||= [];
  state.current.editorActions.unshift({ season: state.season, ...action });
  state.current.editorActions = state.current.editorActions.slice(0, 100);
}

export function isOffseasonEditorAvailable(state) {
  return Boolean(state?.current?.offseason && !state.current.completed && Number(state.current.week || 0) === 0);
}

export function editorAddClubMoney(state, clubId, amount) {
  ensureOffseasonEditor(state);
  const club = getClub(state, clubId);
  const value = Number(amount);
  if (!club) throw new Error('Choose a valid club.');
  if (!Number.isFinite(value) || value <= 0) throw new Error('Enter an amount greater than zero.');
  const rounded = Number(value.toFixed(1));
  club.finances = Number((Number(club.finances || 0) + rounded).toFixed(1));
  club.transferBudget = Number((Number(club.transferBudget || 0) + rounded).toFixed(1));
  addEditorAction(state, { type: 'funds', clubId: club.id, amount: rounded });
  addEditorNews(state, `${club.name} receive an editor cash injection`, `$${rounded.toFixed(1)}m was added to the club's finances and transfer budget.`);
  refreshOffseasonEditorSummary(state);
  return { club, amount: rounded };
}

export function editorCreateTransfer(state, playerId, toClubId, fee = 0) {
  ensureOffseasonEditor(state);
  const player = getPlayer(state, playerId);
  const buyer = getClub(state, toClubId);
  const seller = player?.clubId ? getClub(state, player.clubId) : null;
  const value = Number(fee);
  if (!player || player.status !== 'active' || !seller) throw new Error('Choose an active player who is currently at a club.');
  if (!buyer) throw new Error('Choose a valid destination club.');
  if (buyer.id === seller.id) throw new Error('The destination must be different from the current club.');
  if (!Number.isFinite(value) || value < 0) throw new Error('Enter a transfer fee of zero or more.');
  const rounded = Number(value.toFixed(1));
  if (rounded > Number(buyer.finances || 0)) throw new Error(`${buyer.name} needs more cash for that fee. Add money first or lower the fee.`);
  transferPlayer(state, player, buyer, seller, rounded, rounded === 0);
  const record = state.current.transfers[state.current.transfers.length - 1];
  record.editorCreated = true;
  addEditorAction(state, { type: 'transfer', transferId: record.id, playerId: player.id, fromClubId: seller.id, toClubId: buyer.id, fee: rounded });
  addEditorNews(state, `Editor move: ${player.name} joins ${buyer.name}`, `${player.name} moves from ${seller.name} for ${rounded ? `$${rounded.toFixed(1)}m` : 'no transfer fee'}.`, player.id);
  refreshOffseasonEditorSummary(state);
  return record;
}

function sameTransferRecord(left, right) {
  if (left?.id && right?.id) return left.id === right.id;
  return left?.season === right?.season && left?.playerId === right?.playerId && left?.fromClubId === right?.fromClubId
    && left?.toClubId === right?.toClubId && Number(left?.fee || 0) === Number(right?.fee || 0) && Boolean(left?.freeTransfer) === Boolean(right?.freeTransfer);
}

export function editorCancelTransfer(state, transferRef) {
  ensureOffseasonEditor(state);
  const transfers = state.current.transfers || [];
  const recordIndex = transfers.findIndex((record, index) => record.id === transferRef || `legacy-${index}` === transferRef);
  if (recordIndex < 0) throw new Error('That transfer is no longer available to cancel.');
  const record = transfers[recordIndex];
  const player = getPlayer(state, record.playerId);
  const buyer = getClub(state, record.toClubId);
  const snapshot = record.preTransfer || {};
  const originalClubId = snapshot.clubId ?? (record.freeTransfer ? null : record.fromClubId);
  const seller = originalClubId ? getClub(state, originalClubId) : null;
  if (!player || player.status !== 'active' || player.clubId !== buyer?.id) throw new Error('This move cannot be reversed because the player has since changed club.');
  const fee = Number(record.fee || 0);
  buyer.finances = Number((Number(buyer.finances || 0) + fee).toFixed(1));
  buyer.transferBudget = Number((Number(buyer.transferBudget || 0) + fee).toFixed(1));
  if (seller && fee) seller.finances = Math.max(0, Number((Number(seller.finances || 0) - fee).toFixed(1)));
  player.clubId = originalClubId || null;
  player.lastClubId = snapshot.lastClubId || null;
  player.contractYears = Number(snapshot.contractYears || 0);
  player.salary = Number(snapshot.salary || 0);
  player.happiness = Number(snapshot.happiness || 60);
  player.clubJoinedSeason = snapshot.clubJoinedSeason ?? null;
  player.transferProtectedUntilSeason = snapshot.transferProtectedUntilSeason ?? null;
  player.transferListed = Boolean(snapshot.transferListed);
  player.unhappySeasons = Number(snapshot.unhappySeasons || 0);
  player.lastDiscontentSeason = snapshot.lastDiscontentSeason ?? null;
  transfers.splice(recordIndex, 1);
  state.history.transfers = (state.history.transfers || []).filter((item) => !sameTransferRecord(item, record));
  state.current.offseasonFreeAgentSignings = (state.current.offseasonFreeAgentSignings || []).filter((item) => !(item.playerId === record.playerId && item.toClubId === record.toClubId));
  if (record.id) state.current.news = (state.current.news || []).filter((story) => story.transferRecordId !== record.id);
  invalidateRuntimeCache(state);
  recalculateClubPayrollPressure(state, [buyer.id, seller?.id].filter(Boolean));
  addEditorAction(state, { type: 'cancel-transfer', transferId: record.id || `legacy-${recordIndex}`, playerId: record.playerId });
  addEditorNews(state, `Editor reversal: ${player.name}'s move is cancelled`, `${player.name} returns to ${seller?.name || 'free agency'} for the remainder of the offseason.`, player.id);
  refreshOffseasonEditorSummary(state);
  return record;
}

// Star load of a squad: a generational player counts 3, a legend 1.6, an epic 0.5.
const STAR_LOAD_WEIGHTS = { generational: 3, legend: 1.6, epic: 0.5 };
const STAR_LOAD_PENALTY = { generational: 0.9, legend: 0.6, epic: 0.25 };
function clubStarLoad(roster) {
  let load = 0;
  for (const item of roster) load += STAR_LOAD_WEIGHTS[item.rarity] || 0;
  return load;
}

function transferDramaStory(state, key, headline, body, playerId, importance = 'major') {
  state.current.news.unshift({
    id: `news-${state.season}-drama-${key}`,
    week: 0,
    importance,
    category: 'Transfer Drama',
    storyType: 'transfer',
    relevance: 70,
    headline,
    body,
    entityType: 'player',
    entityId: playerId
  });
}

function runEliteTransferMarket(state, clubs, activePlayers, rosters, initial = false) {
  const drama = { refusals: 0 };
  const caps = { generational: initial ? 1 : 3, legend: initial ? 4 : 8, epic: initial ? 7 : 12 };
  const moved = { generational: 0, legend: 0, epic: 0 };
  const movedByPosition = { GK: 0, DF: 0, MF: 0, FW: 0 };
  const positionCaps = { GK: initial ? 1 : 2, DF: initial ? 3 : 5, MF: initial ? 4 : 7, FW: initial ? 4 : 7 };
  let moves = 0;
  const eliteEuropeMarket = europeanEliteClubIds(state, 18);
  const leagueRankById = new Map();
  for (const region of ['Europe','South America','North America','Asia','Africa','Oceania']) {
    for (const row of leagueStrengthRows(state, region)) leagueRankById.set(row.league.id, row.rank);
  }
  const candidates = activePlayers
    .filter((player) => ['generational', 'legend', 'epic'].includes(player.rarity))
    .filter((player) => availableForTransfer(state, player))
    .map((player) => {
      const seller = getClub(state, player.clubId);
      const migrationPressure = eliteMigrationPressure(state, player, seller);
      const desire = (100 - player.happiness) * 0.75
        + Math.max(0, 3 - (player.contractYears || 0)) * 15
        + random(state) * 25
        + (seller ? Math.max(0, 86 - seller.reputation) * (['generational', 'legend'].includes(player.rarity) ? 0.75 : 0.42) : 32)
        + migrationPressure * 0.9 + (player.unhappySeasons || 0) * 15
        + Math.max(0, Number(seller?.payrollPressureRatio || 1) - 1) * 62;
      return { player, seller, desire, migrationPressure };
    })
    .filter(({ player, seller, desire, migrationPressure }) => !seller || desire >= (player.rarity === 'generational' ? 34 : 27) || migrationPressure >= 48)
    .sort((a, b) => Number(Boolean(b.player.transferListed)) - Number(Boolean(a.player.transferListed))
      || b.migrationPressure - a.migrationPressure
      || STAR_RARITIES[b.player.rarity].rank - STAR_RARITIES[a.player.rarity].rank
      || b.desire - a.desire
      || b.player.rating - a.player.rating);

  for (const candidate of candidates) {
    const { player, seller, desire, migrationPressure } = candidate;
    const careerStage = playerCareerStage(state, player);
    const eliteEurope = eliteEuropeMarket;
    const sellerDestinationScore = seller ? clubDestinationScore(state, seller) : 0;
    if (moved[player.rarity] >= caps[player.rarity]) continue;
    if (movedByPosition[player.position] >= positionCaps[player.position]) continue;
    if (seller) {
      const sellerTarget = seller.division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[seller.tier];
      if ((rosters.get(seller.id)?.length || 0) <= Math.max(3, sellerTarget - 1) && migrationPressure < 70
        && !player.transferListed && player.happiness >= 40 && Number(seller.payrollPressureRatio || 1) < 1.20) continue;
    }
    let possibleBuyers = clubs.filter((buyer) => {
      if (buyer.id === seller?.id || buyer.division === 2) return false;
      if (!initial && Number(buyer.payrollPressureRatio || 1) >= 1.18) return false;
      const buyerDestinationScore = clubDestinationScore(state, buyer);
      if (!primeDestinationAllowed(state, player, buyer, seller)) return false;
      const reputationFloor = careerStage === 'late' ? Math.max(60, (seller?.reputation || 64) - 28)
        : Math.max(70, (seller?.reputation || 64) - (desire > 50 ? 11 : 6));
      if (buyer.reputation < reputationFloor) return false;
      const achievement = playerAchievementScore(state, player, 3);
      // Very young elite talent usually earns an intermediate move before the superclubs.
      if (player.rating < 84 && buyer.reputation >= 88) return false;
      if (player.rating < 89 && achievement < 22 && buyer.reputation >= 92) return false;
      const fee = seller ? askingPrice(state, player, buyer) : 0;
      const globalSuperstar = migrationPressure >= 55 && ['generational', 'legend'].includes(player.rarity);
      const spendingLimit = globalSuperstar
        ? Math.max(buyer.transferBudget, buyer.finances * (clubFinancialTierRank(buyer) >= 4 ? 0.72 : 0.58))
        : buyer.transferBudget;
      const wageLimit = Math.max(0.8, buyer.wageBudget * (globalSuperstar ? 0.62 : 0.52));
      const offeredSalary = salaryOfferFor(state, player, buyer, seller ? 'transfer' : 'free');
      const buyerBill = rosterPayroll(rosters.get(buyer.id) || []);
      if (fee > spendingLimit || offeredSalary > wageLimit || !canClubCarrySalary(buyer, buyerBill, offeredSalary, 0, 1.01)) return false;
      const samePosition = (rosters.get(buyer.id) || []).filter((item) => item.position === player.position);
      const weakest = samePosition.sort((a, b) => a.rating - b.rating)[0];
      return !weakest || player.rating >= weakest.rating + (player.transferListed ? -3 : player.rarity === 'epic' ? 1 : 0);
    });
    if (migrationPressure >= 45 && careerStage !== 'late') {
      if (['generational','legend'].includes(player.rarity)) {
        const europeanElite = possibleBuyers.filter((club) => club.confederation === 'Europe' && clubFinancialTierRank(club) >= 3);
        if (europeanElite.length) possibleBuyers = europeanElite;
      } else if (player.rarity === 'epic' && seller?.confederation !== 'Europe') {
        const europeanStep = possibleBuyers.filter((club) => club.confederation === 'Europe' && clubFinancialTierRank(club) >= 3);
        if (europeanStep.length) possibleBuyers = europeanStep;
      }
    }
    if (!possibleBuyers.length) continue;
    const buyer = geographicClubPick(state, possibleBuyers, player, (club) => {
      const clubRoster = rosters.get(club.id) || [];
      const systemNeed = clubSystemNeed(state, club, clubRoster);
      const positionFit = (positionNeedFromRoster(state, club, clubRoster) === player.position ? 12 : 3)
        + (systemNeed && systemNeed.line === player.position && slotFit(player, systemNeed.slotType) >= 0.94 ? 5 : 0);
      const eliteAtClub = (rosters.get(club.id) || []).filter((item) => item.rarity === player.rarity).length;
      const sameRarity = player.rarity === 'generational' ? 1 / (1 + eliteAtClub * 3.2) : player.rarity === 'legend' ? 1 / (1 + eliteAtClub * 0.8) : 1;
      // Balance rule: clubs already loaded with stars are much less likely to land another.
      const loadWeight = STAR_LOAD_PENALTY[player.rarity] || 0;
      const hoardingPenalty = sameRarity / (1 + clubStarLoad(rosters.get(club.id) || []) * loadWeight);
      const europePull = migrationPressure >= 45 && club.confederation === 'Europe' ? 1.8 : 1;
      const goalkeeperDemand = player.position === 'GK' ? 0.55 : 1;
      const achievement = playerAchievementScore(state, player, 3);
      const giant = club.reputation >= 92;
      const steppingStone = club.reputation >= 78 && club.reputation < 90;
      const developmentFit = player.rating < 89 && achievement < 28 ? (steppingStone ? 1.9 : giant ? 0.35 : 1) : 1;
      const leagueRank = leagueRankById.get(club.leagueId) || 12;
      const leaguePull = Math.max(0.62, 1.36 - (leagueRank - 1) * 0.055);
      const destinationPull = Math.max(0.58, clubDestinationScore(state, club) / 88);
      const institutionalPull = 0.55 + clubFinancialTierRank(club) * 0.22;
      const financePull = Math.max(0.65, Math.min(1.35, countryPool(state, club.country) / 650));
      return Math.max(1, (club.reputation - 63 + positionFit + (club.ownerNegotiationBonus || 0) * 30) * hoardingPenalty * europePull * goalkeeperDemand * developmentFit * leaguePull * destinationPull * institutionalPull * financePull);
    });
    let fee = seller ? askingPrice(state, player, buyer) : 0;
    // Bidding war: a second big club drives the fee up before the winner is decided.
    let rival = null;
    if (seller && random(state) < 0.55) {
      let rivalScore = -Infinity;
      for (const club of possibleBuyers) {
        if (club === buyer || (club.reputation || 0) < 80) continue;
        const score = clubDestinationScore(state, club);
        if (score > rivalScore) { rival = club; rivalScore = score; }
      }
      if (rival) {
        const raised = Number((fee * (1.08 + random(state) * 0.14)).toFixed(1));
        if (raised <= Math.max(buyer.transferBudget, buyer.finances * 0.6)) fee = raised; else rival = null;
      }
    }
    const europeStepUp = seller?.confederation !== 'Europe' && buyer.confederation === 'Europe' ? 0.16 : 0;
    const destinationGain = clubDestinationScore(state, buyer) - (seller ? clubDestinationScore(state, seller) : 58);
    const personality = hasTrait(player, 'loyal') && seller ? -0.18 : hasTrait(player, 'mercenary') ? 0.1 : 0;
    // Stars hesitate to join a dressing room already full of stars (minutes, status).
    const crowdedStage = (STAR_LOAD_PENALTY[player.rarity] || 0) ? -Math.min(0.3, clubStarLoad(rosters.get(buyer.id) || []) * 0.045) : 0;
    const acceptance = clamp(
      0.44 + desire / 160 + migrationPressure / 125
      + destinationGain / 65
      + Math.max(0, 2 - (player.contractYears || 0)) * 0.10
      + (buyer.ownerNegotiationBonus || 0) * 0.35
      + europeStepUp + personality + crowdedStage,
      0.32,
      0.998
    );
    if (random(state) > acceptance) {
      if (['legend', 'generational'].includes(player.rarity) && drama.refusals < 4) {
        drama.refusals += 1;
        transferDramaStory(state, `refuses-${player.id}-${buyer.id}`, `${player.name} turns down ${buyer.name}`, `${player.name} rejects the move${seller ? ` and stays at ${seller.name}` : ''} for now.`, player.id);
      }
      continue;
    }
    // A late collapse: medical, personal terms or a last-minute change of heart.
    if (seller && random(state) < 0.05) {
      transferDramaStory(state, `collapse-${player.id}-${buyer.id}`, `${player.name}'s move to ${buyer.name} collapses`, `The deal falls through at the last moment; ${player.name} remains at ${seller.name}.`, player.id);
      continue;
    }
    const oldClubId = player.clubId;
    transferPlayer(state, player, buyer, seller, fee, !seller);
    if (rival) transferDramaStory(state, `race-${player.id}`, `${buyer.name} win the race for ${player.name}`, `${buyer.name} beat ${rival.name} to the signing after a bidding war that pushed the fee to ${fee.toFixed(1)}m.`, player.id, 'feature');
    if (oldClubId && rosters.has(oldClubId)) rosters.set(oldClubId, rosters.get(oldClubId).filter((item) => item.id !== player.id));
    rosters.get(buyer.id).push(player);
    moved[player.rarity] += 1;
    movedByPosition[player.position] += 1;
    moves += 1;
  }
  // Summer standoffs: restless stars who wanted out but are still there.
  if (!initial) {
    let holdouts = 0;
    for (const { player, seller } of candidates) {
      if (holdouts >= 4 || !seller || player.clubId !== seller.id) continue;
      if (!['legend', 'generational'].includes(player.rarity) || (player.happiness ?? 60) >= 35) continue;
      holdouts += 1;
      player.happiness = Math.max(5, (player.happiness ?? 40) - 4);
      transferDramaStory(state, `holdout-${player.id}`, `${player.name} stays at ${seller.name} after a summer standoff`, `No acceptable offer arrived; the ${STAR_RARITIES[player.rarity].label.toLowerCase()} star begins the season unhappy.`, player.id, 'digest');
    }
  }
  return moves;
}

function runPayrollClearanceMarket(state, clubs, rosters) {
  let moves = 0;
  // Clearance is a top-club/dynasty mechanic. Smaller clubs still lose transfer budget
  // under wage pressure, but we avoid scanning the entire global market for hundreds of
  // modest domestic champions every summer.
  const pressured = clubs
    .filter((club) => club.division === 1 && Number(club.payrollPressureRatio || 1) >= 1.25)
    .filter((club) => clubFinancialTierRank(club) >= 3 || (club.reputation || 0) >= 82)
    .sort((a,b) => Number(b.payrollPressureRatio || 1) - Number(a.payrollPressureRatio || 1))
    .slice(0, 48);
  const healthyBuyers = clubs
    .filter((club) => club.division === 1 && Number(club.payrollPressureRatio || 1) < 1.22)
    .sort((a,b) => clubDestinationScore(state,b)-clubDestinationScore(state,a))
    .slice(0, 140);
  for (const seller of pressured) {
    const anchor = Math.max(1, Number(seller.payrollAnchor || 1));
    let roster = rosters.get(seller.id) || [];
    let bill = roster.reduce((sum, player) => sum + Number(player.salary || 0), 0);
    const target = anchor * 1.16;
    let sold = 0;
    const candidates = [...roster]
      .filter((player) => STAR_RARITIES[player.rarity]?.rank >= STAR_RARITIES.rare.rank)
      .filter((player) => availableForTransfer(state, player))
      .sort((a,b) => {
        const ar = STAR_RARITIES[a.rarity]?.rank || 1, br = STAR_RARITIES[b.rarity]?.rank || 1;
        const aSale = ar * 18 + a.rating * 0.6 + (a.marketValue || 0) * 0.08 + (a.salary || 0) * 1.6;
        const bSale = br * 18 + b.rating * 0.6 + (b.marketValue || 0) * 0.08 + (b.salary || 0) * 1.6;
        return bSale - aSale;
      });
    for (const player of candidates) {
      if (bill <= target || sold >= 3) break;
      const sellerDestination = clubDestinationScore(state, seller);
      let buyers = healthyBuyers.filter((buyer) => {
        if (!recruitmentDestinationAllowed(state, player, buyer)) return false;
        if (buyer.id === seller.id || buyer.division !== 1 || Number(buyer.payrollPressureRatio || 1) >= 1.22) return false;
        const buyerDestination = clubDestinationScore(state, buyer);
        const stage = playerCareerStage(state, player);
        if (stage !== 'late' && player.rarity === 'generational') {
          const rank = leagueStrengthRows(state, 'Europe').find((row)=>row.league.id===buyer.leagueId)?.rank || 99;
          if (buyer.confederation !== 'Europe' || rank > 5 || clubFinancialTierRank(buyer) < 3 || buyerDestination < sellerDestination - 8) return false;
        } else if (stage !== 'late' && player.rarity === 'legend') {
          const rank = leagueStrengthRows(state, 'Europe').find((row)=>row.league.id===buyer.leagueId)?.rank || 99;
          if (buyer.confederation !== 'Europe' || rank > 9 || clubFinancialTierRank(buyer) < 3 || buyerDestination < sellerDestination - 10) return false;
        } else if (stage !== 'late' && player.rarity === 'epic') {
          if (seller.confederation === 'Europe' && buyer.confederation !== 'Europe') return false;
          if (buyerDestination < sellerDestination - 12) return false;
        } else if (buyerDestination < sellerDestination - 14) return false;
        const fee = askingPrice(state, player, buyer);
        const spendingLimit = Math.max(Number(buyer.transferBudget || 0), Number(buyer.finances || 0) * (player.rarity === 'generational' ? 0.62 : 0.48));
        if (fee > spendingLimit) return false;
        const estimatedSalary = Math.max(0.3, (player.marketValue || 0) * 0.06);
        const sustainableOffer = Math.max(1.5, Number(buyer.wageBudget || 1) * 1.05, Number(buyer.annualFinanceShare || 0) * 0.18);
        const offeredSalary = salaryOfferFor(state, player, buyer, 'transfer');
        if (estimatedSalary > sustainableOffer || !canClubCarrySalary(buyer, rosterPayroll(rosters.get(buyer.id) || []), offeredSalary, 0, 1.01)) return false;
        const samePosition = (rosters.get(buyer.id) || []).filter((item) => item.position === player.position);
        const weakest = [...samePosition].sort((a,b)=>a.rating-b.rating)[0];
        return !weakest || player.rating >= weakest.rating - (player.rarity === 'rare' ? 1 : 3);
      });
      if (!buyers.length) continue;
      const buyer = geographicClubPick(state, buyers, player, (club) => {
        const destination = Math.max(1, clubDestinationScore(state, club) - 55);
        const need = positionNeedFromRoster(state, club, rosters.get(club.id) || []) === player.position ? 1.8 : 1;
        const finance = 0.7 + Math.min(1.5, (club.finances || 0) / 260);
        return destination * need * finance;
      });
      const fee = askingPrice(state, player, buyer);
      const oldSalary = Number(player.salary || 0);
      transferPlayer(state, player, buyer, seller, fee, false);
      const record = state.current.transfers[state.current.transfers.length - 1];
      if (record && record.playerId === player.id) record.reason = 'Payroll pressure';
      rosters.set(seller.id, (rosters.get(seller.id) || []).filter((item) => item.id !== player.id));
      rosters.get(buyer.id).push(player);
      bill = Math.max(0, bill - oldSalary);
      seller.payrollPressureRatio = Number((bill / anchor).toFixed(3));
      sold += 1;
      moves += 1;
    }

    // If the dynasty is still materially above its sustainable wage anchor, force a
    // rational asset sale rather than allowing the club to remain trapped forever by
    // the ordinary market's need/position checks.  The buyer still has to be a
    // credible sporting destination and financially capable of completing the deal.
    // Common/Uncommon players are intentionally excluded: their inflated dynasty
    // salaries are the dead weight that makes the rebuild painful.
    if (bill > target && sold < 3) {
      const sellerDestination = clubDestinationScore(state, seller);
      const fallbackCandidates = [...(rosters.get(seller.id) || [])]
        .filter((player) => STAR_RARITIES[player.rarity]?.rank >= STAR_RARITIES.rare.rank)
        .filter((player) => availableForTransfer(state, player))
        .sort((a,b) => {
          // Prefer cashing in on expensive Epics/Legends before automatically losing
          // the club's singular Generational icon.
          const burden = (player) => (player.salary || 0) * 5 + (player.marketValue || 0) * 0.32
            + (player.rarity === 'legend' ? 24 : player.rarity === 'epic' ? 30 : player.rarity === 'rare' ? 18 : 8);
          return burden(b) - burden(a);
        });
      for (const player of fallbackCandidates) {
        if (bill <= target || sold >= 3) break;
        const stage = playerCareerStage(state, player);
        const europeRanks = new Map(leagueStrengthRows(state, 'Europe').map((row)=>[row.league.id,row.rank]));
        const buyers = healthyBuyers.filter((buyer) => {
          if (!recruitmentDestinationAllowed(state, player, buyer)) return false;
          if (buyer.id === seller.id || Number(buyer.payrollPressureRatio || 1) >= 1.22) return false;
          const buyerDestination = clubDestinationScore(state, buyer);
          const rank = europeRanks.get(buyer.leagueId) || 99;
          if (stage !== 'late' && player.rarity === 'generational') {
            if (buyer.confederation !== 'Europe' || rank > 5 || clubFinancialTierRank(buyer) < 3) return false;
            if (buyerDestination < sellerDestination - 15) return false;
          } else if (stage !== 'late' && player.rarity === 'legend') {
            if (buyer.confederation !== 'Europe' || rank > 10 || clubFinancialTierRank(buyer) < 3) return false;
            if (buyerDestination < sellerDestination - 18) return false;
          } else if (stage !== 'late' && player.rarity === 'epic') {
            if (seller.confederation === 'Europe' && buyer.confederation !== 'Europe') return false;
            if (buyerDestination < sellerDestination - 22) return false;
          } else if (buyerDestination < sellerDestination - 24) return false;
          const fee = askingPrice(state, player, buyer);
          // A club can temporarily stretch its normal transfer budget for an elite
          // player put on the market by a distressed rival, but never beyond the
          // resources actually on its balance sheet.
          const emergencyBudget = Math.max(Number(buyer.transferBudget || 0), Number(buyer.finances || 0) * 0.72);
          if (fee > emergencyBudget || fee > Number(buyer.finances || 0) * 0.88) return false;
          const projectedSalary = Math.max(0.4, Number(player.marketValue || 0) * 0.065);
          const salaryRoom = Math.max(Number(buyer.wageBudget || 0) * 1.35, Number(buyer.annualFinanceShare || 0) * 0.25, 8);
          const offeredSalary = salaryOfferFor(state, player, buyer, 'transfer');
          return projectedSalary <= salaryRoom && canClubCarrySalary(buyer, rosterPayroll(rosters.get(buyer.id) || []), offeredSalary, 0, 1.01);
        });
        if (!buyers.length) continue;
        const buyer = geographicClubPick(state, buyers, player, (club) =>
          clubDestinationScore(state, club) * 1.25 + (club.finances || 0) * 0.06 + (club.reputation || 0) * 0.35);
        const fee = askingPrice(state, player, buyer);
        const oldSalary = Number(player.salary || 0);
        transferPlayer(state, player, buyer, seller, fee, false);
        const record = state.current.transfers[state.current.transfers.length - 1];
        if (record && record.playerId === player.id) record.reason = 'Payroll pressure';
        rosters.set(seller.id, (rosters.get(seller.id) || []).filter((item) => item.id !== player.id));
        rosters.get(buyer.id).push(player);
        bill = Math.max(0, bill - oldSalary);
        seller.payrollPressureRatio = Number((bill / anchor).toFixed(3));
        sold += 1;
        moves += 1;
      }
    }
  }
  return moves;
}

function runTransferMarket(state, initial = false) {
  const clubs = shuffle(state, [...state.clubs]).sort((a, b) => b.reputation - a.reputation + (random(state) - 0.5) * 12);
  const activePlayers = state.players.filter((player) => player.status === 'active');
  const rosters = new Map();
  for (const club of state.clubs) rosters.set(club.id, []);
  activePlayers.forEach((player) => { if (player.clubId && rosters.has(player.clubId)) rosters.get(player.clubId).push(player); });
  const activeByPosition = { GK: [], DF: [], MF: [], FW: [] };
  activePlayers.forEach((player) => activeByPosition[player.position]?.push(player));
  const marketBuckets = Object.fromEntries(Object.keys(activeByPosition).map((position) => {
    const ratings = new Map();
    for (const player of activeByPosition[position]) {
      if (!ratings.has(player.rating)) ratings.set(player.rating, []);
      ratings.get(player.rating).push(player);
    }
    return [position, ratings];
  }));
  const maxMoves = initial ? Math.min(260, Math.round(state.clubs.length * 0.18)) : Math.min(420, Math.round(state.clubs.length * 0.24));
  let moves = initial ? 0 : runPayrollClearanceMarket(state, clubs, rosters);
  moves += runEliteTransferMarket(state, clubs, activePlayers, rosters, initial);
  for (const buyer of clubs) {
    if (moves >= maxMoves) break;
    if (!initial && Number(buyer.payrollPressureRatio || 1) >= 1.12) continue;
    if (buyer.division === 2 && random(state) < 0.56) continue;
    const roster = rosters.get(buyer.id) || [];
    const target = buyer.division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[buyer.tier];
    // A full squad only buys when it can still name the player in a matchday 15.
    if (roster.length >= target + 2) continue;
    const needPosition = positionNeedFromRoster(state, buyer, roster);
    const buyerSystem = clubSystemNeed(state, buyer, roster);
    const systemSlot = buyerSystem?.line === needPosition ? buyerSystem.slotType : null;
    const weakest = roster.filter((player) => player.position === needPosition).sort((a, b) => a.rating - b.rating)[0];
    const minimumUpgrade = weakest?.rating || buyer.strength - 11;
    const minimumRating = minimumUpgrade + (roster.length >= target ? 2 : -3);
    const sensibleMaximum = Math.min(100, Math.max(minimumRating + 5, buyer.strength + 9));
    const basicCandidates = [];
    for (let rating = sensibleMaximum; rating >= minimumRating && basicCandidates.length < 160; rating -= 1) {
      basicCandidates.push(...(marketBuckets[needPosition]?.get(rating) || []));
    }
    const candidatePool = basicCandidates.filter((player) => {
      // Elite players use the dedicated global market above, which applies rarity,
      // position and ambition controls. The ordinary squad market should not create
      // a second uncontrolled wave of high-profile goalkeeper transfers.
      if (['generational', 'legend', 'epic'].includes(player.rarity)) return false;
      if (player.loan) return false;
      if (player.transferProtectedUntilSeason && state.season < player.transferProtectedUntilSeason) return false;
      if (player.clubId === buyer.id || player.position !== needPosition) return false;
      if (player.rating < minimumRating) return false;
      if (!recruitmentDestinationAllowed(state, player, buyer)) return false;
      if (player.clubId) {
        const sellerClub = getClub(state, player.clubId);
        const sellerTarget = sellerClub?.division === 2 ? CLUB_ROSTER_TARGET.reserve : CLUB_ROSTER_TARGET[sellerClub?.tier];
        if ((rosters.get(player.clubId)?.length || 0) <= Math.max(3, (sellerTarget || 4) - 1)) return false;
      }
      const fee = player.clubId ? askingPrice(state, player, buyer) : 0;
      const offeredSalary = salaryOfferFor(state, player, buyer, player.clubId ? 'transfer' : 'free');
      return fee <= buyer.transferBudget
        && offeredSalary <= Math.max(0.5, buyer.wageBudget * 0.48)
        && canClubCarrySalary(buyer, rosterPayroll(roster), offeredSalary, 0, 1.01);
    });
    if (!candidatePool.length) continue;
    const player = weightedPick(state, candidatePool, (candidate) => {
      const seller = getClub(state, candidate.clubId);
      const ambition = buyer.reputation - (seller?.reputation || 60);
      const unhappiness = 105 - candidate.happiness;
      const rarity = STAR_RARITIES[candidate.rarity].rank;
      // Players who fit the slot the coach's system is missing are preferred.
      const systemFit = systemSlot ? (slotFit(candidate, systemSlot) >= 0.94 ? 1.7 : 0.75) : 1;
      return Math.max(0.2, candidate.rating - minimumUpgrade + ambition * 0.18 + unhappiness * 0.06 + rarity * 0.8)
        * playerGeographyWeight(state, candidate, buyer) * systemFit;
    });
    const seller = getClub(state, player.clubId);
    const fee = seller ? askingPrice(state, player, buyer) : 0;
    const negotiationBonus = (buyer.ownerNegotiationBonus || 0) * 0.42;
    const personality = hasTrait(player, 'loyal') && seller ? 0.55 : hasTrait(player, 'mercenary') ? 1.3 : 1;
    const acceptance = clamp(
      (0.46 + (buyer.reputation - (seller?.reputation || 60)) / 70 + (60 - player.happiness) / 100 + negotiationBonus) * personality,
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


function showcaseRoll(key, index = 0) {
  return matchEventRoll(`${key}::${index}`);
}

function showcaseInt(key, index, min, max) {
  return min + Math.floor(showcaseRoll(key, index) * (max - min + 1));
}

function showcaseCompetitionObject(state, competitionId) {
  return state.current.globalClubCompetitions?.[competitionId]
    || state.current.continentalCompetitions?.[competitionId]
    || state.current.internationalCompetitions?.[competitionId]
    || state.current.domesticCups?.[competitionId]
    || state.current.superCups?.[competitionId]
    || null;
}

function showcaseAggregateContext(state, match) {
  const competition = showcaseCompetitionObject(state, match.competitionId);
  const rounds = competition?.knockout?.rounds || [];
  const semiRound = rounds.find((round) => String(round.stage || '').toLowerCase().includes('semi'));
  const tie = semiRound?.ties?.find((item) => item.firstLeg === match.id || item.secondLeg === match.id);
  if (!tie) return null;
  const first = state.current.matches.find((row) => row.id === tie.firstLeg);
  const second = state.current.matches.find((row) => row.id === tie.secondLeg);
  if (!first) return null;

  if (tie.firstLeg === match.id) {
    return {
      leg: 1,
      tieHomeId: tie.homeId,
      tieAwayId: tie.awayId,
      homeBefore: 0,
      awayBefore: 0,
      homeFinal: match.homeGoals,
      awayFinal: match.awayGoals,
      winnerId: null,
      penalties: null
    };
  }

  if (!second) return null;
  const homeBefore = match.homeId === tie.homeId ? first.homeGoals : first.awayGoals;
  const awayBefore = match.awayId === tie.awayId ? first.awayGoals : first.homeGoals;
  const homeFinal = homeBefore + second.homeGoals;
  const awayFinal = awayBefore + second.awayGoals;
  let penalties = match.engine >= 2 && match.penalties ? { ...match.penalties } : null;
  if (!penalties && homeFinal === awayFinal && tie.winnerId && match.engine !== 2) {
    const homeWon = tie.winnerId === match.homeId;
    const winnerPens = showcaseInt(`${match.id}-agg-pens`, 0, 4, 6);
    const loserPens = Math.max(2, winnerPens - showcaseInt(`${match.id}-agg-pens`, 1, 1, 2));
    penalties = homeWon ? { home: winnerPens, away: loserPens } : { home: loserPens, away: winnerPens };
  }
  return {
    leg: 2,
    tieHomeId: tie.homeId,
    tieAwayId: tie.awayId,
    homeBefore,
    awayBefore,
    homeFinal,
    awayFinal,
    winnerId: tie.winnerId || null,
    penalties
  };
}

function deterministicShuffle(list, key) {
  return [...list]
    .map((value, index) => ({ value, order: showcaseRoll(`${key}-${value}`, index) }))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.value);
}

function showcaseGoalSideSequence(match) {
  const homeGoals = Math.max(0, Number(match.homeGoals || 0));
  const awayGoals = Math.max(0, Number(match.awayGoals || 0));
  const total = homeGoals + awayGoals;
  if (!total) return { sides: [], story: 'cagey' };
  const winner = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : null;
  const loser = winner === 'home' ? 'away' : winner === 'away' ? 'home' : null;
  const counts = { home: homeGoals, away: awayGoals };
  const roll = showcaseRoll(`${match.id}-story`, 0);
  const margin = Math.abs(homeGoals - awayGoals);
  let story = 'balanced';
  const sides = [];
  const take = (side) => {
    if ((counts[side] || 0) <= 0) return false;
    counts[side] -= 1;
    sides.push(side);
    return true;
  };

  if (winner && margin === 1 && total >= 3 && roll < 0.34) {
    story = 'last-gasp';
    counts[winner] -= 1;
    let next = showcaseRoll(`${match.id}-story`, 1) < 0.5 ? 'home' : 'away';
    while (counts.home + counts.away > 0) {
      if (!take(next)) take(next === 'home' ? 'away' : 'home');
      next = next === 'home' ? 'away' : 'home';
    }
    sides.push(winner);
  } else if (winner && counts[loser] > 0 && roll < 0.56) {
    story = 'comeback';
    take(loser);
    if (counts[loser] > 0 && showcaseRoll(`${match.id}-story`, 2) < 0.30) take(loser);
    const rest = [];
    for (const side of ['home', 'away']) for (let i = 0; i < counts[side]; i += 1) rest.push(side);
    const shuffled = deterministicShuffle(rest, `${match.id}-comeback`);
    if (shuffled.length > 1 && shuffled[shuffled.length - 1] !== winner) {
      const index = shuffled.lastIndexOf(winner);
      if (index >= 0) [shuffled[index], shuffled[shuffled.length - 1]] = [shuffled[shuffled.length - 1], shuffled[index]];
    }
    sides.push(...shuffled);
  } else if (winner && margin >= 2 && roll < 0.78) {
    story = 'front-runner';
    take(winner);
    if (counts[winner] > 1 && showcaseRoll(`${match.id}-story`, 3) < 0.72) take(winner);
    const rest = [];
    for (const side of ['home', 'away']) for (let i = 0; i < counts[side]; i += 1) rest.push(side);
    sides.push(...deterministicShuffle(rest, `${match.id}-front`));
  } else {
    const rest = [];
    for (const side of ['home', 'away']) for (let i = 0; i < counts[side]; i += 1) rest.push(side);
    sides.push(...deterministicShuffle(rest, `${match.id}-balanced`));
  }

  if (match.extraTime && !match.penalties && winner && sides.length) {
    const lastWinner = sides.lastIndexOf(winner);
    if (lastWinner >= 0 && lastWinner !== sides.length - 1) {
      [sides[lastWinner], sides[sides.length - 1]] = [sides[sides.length - 1], sides[lastWinner]];
    }
    story = 'extra-time';
  }
  return { sides, story };
}

function showcaseGoalMinutes(match, sideSequence, story) {
  const count = sideSequence.length;
  if (!count) return [];
  const extraTimeWinner = match.extraTime && !match.penalties && count > 0;
  const regulationCount = extraTimeWinner ? count - 1 : count;
  const minutes = [];
  for (let index = 0; index < regulationCount; index += 1) {
    const base = regulationCount === 1
      ? 44
      : 8 + ((78 / Math.max(1, regulationCount - 1)) * index);
    const jitter = (showcaseRoll(`${match.id}-minute`, index) - 0.5) * 14;
    minutes.push(clamp(Math.round(base + jitter), 3, 88));
  }
  minutes.sort((a, b) => a - b);
  for (let index = 1; index < minutes.length; index += 1) {
    if (minutes[index] <= minutes[index - 1]) minutes[index] = Math.min(89, minutes[index - 1] + 2);
  }
  if (story === 'last-gasp' && minutes.length) minutes[minutes.length - 1] = showcaseInt(`${match.id}-late`, 0, 86, 90);
  if (story === 'front-runner' && minutes.length >= 2) {
    minutes[0] = showcaseInt(`${match.id}-frontminute`, 0, 5, 18);
    minutes[1] = showcaseInt(`${match.id}-frontminute`, 1, 20, 38);
  }
  if (extraTimeWinner) minutes.push(showcaseInt(`${match.id}-etminute`, 0, 98, 118));
  return minutes;
}

function showcaseGoalEvents(match) {
  const { sides, story } = showcaseGoalSideSequence(match);
  const minutes = showcaseGoalMinutes(match, sides, story);
  const homeEvents = (match.goalEvents || []).filter((event) => event.teamId === match.homeId || event.side === 'home');
  const awayEvents = (match.goalEvents || []).filter((event) => event.teamId === match.awayId || event.side === 'away');
  let homeIndex = 0;
  let awayIndex = 0;
  return sides.map((side, index) => {
    const original = side === 'home' ? homeEvents[homeIndex++] : awayEvents[awayIndex++];
    const teamId = side === 'home' ? match.homeId : match.awayId;
    return {
      side,
      teamId,
      scorerId: original?.scorerId || null,
      assistId: original?.assistId || null,
      minute: minutes[index] || Math.min(90, 10 + index * 12)
    };
  }).sort((a, b) => a.minute - b.minute);
}

function showcaseFinalStats(state, match) {
  if (match.stats?.home && match.stats?.away) return { home: { ...match.stats.home }, away: { ...match.stats.away } };
  const homeStrength = calculateTeamStrength(state, match.homeId, match.isInternational);
  const awayStrength = calculateTeamStrength(state, match.awayId, match.isInternational);
  const diff = homeStrength - awayStrength;
  const homePossession = clamp(Math.round(50 + diff * 0.38 + (showcaseRoll(`${match.id}-possession`, 0) - 0.5) * 10), 34, 66);
  const awayPossession = 100 - homePossession;
  const homeShots = clamp(Math.round(6 + Math.max(0, homeStrength - 65) * 0.12 + match.homeGoals * 1.6 + showcaseRoll(`${match.id}-shots`, 0) * 6), Math.max(match.homeGoals + 2, 4), 24);
  const awayShots = clamp(Math.round(5 + Math.max(0, awayStrength - 65) * 0.11 + match.awayGoals * 1.6 + showcaseRoll(`${match.id}-shots`, 1) * 6), Math.max(match.awayGoals + 2, 3), 23);
  const homeOnTarget = clamp(Math.round(homeShots * (0.34 + showcaseRoll(`${match.id}-target`, 0) * 0.14)), Math.max(match.homeGoals, 1), homeShots);
  const awayOnTarget = clamp(Math.round(awayShots * (0.34 + showcaseRoll(`${match.id}-target`, 1) * 0.14)), Math.max(match.awayGoals, 1), awayShots);
  const homeCorners = clamp(Math.round(homeShots * 0.30 + showcaseRoll(`${match.id}-corners`, 0) * 3), 0, 11);
  const awayCorners = clamp(Math.round(awayShots * 0.30 + showcaseRoll(`${match.id}-corners`, 1) * 3), 0, 11);
  const homeYellow = showcaseInt(`${match.id}-yellow`, 0, 0, 4);
  const awayYellow = showcaseInt(`${match.id}-yellow`, 1, 0, 4);
  const homeRed = showcaseRoll(`${match.id}-red`, 0) < 0.08 ? 1 : 0;
  const awayRed = showcaseRoll(`${match.id}-red`, 1) < 0.08 ? 1 : 0;
  return {
    home: { shots: homeShots, onTarget: homeOnTarget, corners: homeCorners, possession: homePossession, yellow: homeYellow, red: homeRed },
    away: { shots: awayShots, onTarget: awayOnTarget, corners: awayCorners, possession: awayPossession, yellow: awayYellow, red: awayRed }
  };
}

function showcaseCumulativeValue(finalValue, progress, seed, minimum = 0) {
  if (progress <= 0) return 0;
  if (progress >= 1) return finalValue;
  const wiggle = (showcaseRoll(seed, Math.round(progress * 100)) - 0.5) * 1.2;
  return clamp(Math.round(finalValue * progress + wiggle), minimum, finalValue);
}

function showcaseTicks(match, finalStats, goalEvents, aggregate = null) {
  const aggregatePenaltyResolution = Boolean(aggregate?.penalties);
  const hasExtra = Boolean(match.extraTime || aggregatePenaltyResolution);
  const penalties = match.penalties || aggregate?.penalties || null;
  const numericCheckpoints = [0, 15, 30, 45, 60, 75, 90, ...(hasExtra ? [105, 120] : [])];
  const finalMinute = hasExtra ? 120 : 90;
  const ticks = numericCheckpoints.map((minute, index) => {
    const progress = minute / Math.max(1, finalMinute);
    const visibleGoals = goalEvents.filter((event) => event.minute <= minute);
    const homeGoals = visibleGoals.filter((event) => event.side === 'home').length;
    const awayGoals = visibleGoals.filter((event) => event.side === 'away').length;
    const homePossession = minute === 0
      ? 50
      : minute === finalMinute
        ? finalStats.home.possession
        : clamp(Math.round(50 + (finalStats.home.possession - 50) * progress + (showcaseRoll(`${match.id}-live-pos`, index) - 0.5) * (5 * (1 - progress))), 22, 78);
    const awayPossession = 100 - homePossession;
    const buildSide = (side, goals, possession) => {
      const source = finalStats[side];
      const shots = showcaseCumulativeValue(source.shots, progress, `${match.id}-${side}-shots-live`, goals);
      const onTarget = clamp(showcaseCumulativeValue(source.onTarget, progress, `${match.id}-${side}-target-live`, goals), goals, shots);
      return {
        shots,
        onTarget,
        corners: showcaseCumulativeValue(source.corners, progress, `${match.id}-${side}-corners-live`),
        possession,
        yellow: showcaseCumulativeValue(source.yellow, progress, `${match.id}-${side}-yellow-live`),
        red: showcaseCumulativeValue(source.red, progress, `${match.id}-${side}-red-live`)
      };
    };
    return {
      label: minute === 0 ? "0'" : minute === 45 ? 'HT' : minute === 90 && !hasExtra ? 'FT' : minute === 90 ? "90'" : minute === 120 ? 'AET' : `${minute}'`,
      minute,
      homeGoals,
      awayGoals,
      home: buildSide('home', homeGoals, homePossession),
      away: buildSide('away', awayGoals, awayPossession),
      events: visibleGoals.map((event) => ({ ...event }))
    };
  });
  if (penalties) {
    const last = ticks[ticks.length - 1];
    ticks.push({ ...last, label: 'PENS', minute: 121, penalties: { ...penalties } });
  }
  return ticks;
}


function showcaseMinuteSlots(match, count, key, finalMinute) {
  if (!count) return [];
  const upper = Math.max(4, finalMinute - 1);
  const slots = [];
  for (let index = 0; index < count; index += 1) {
    const base = 3 + ((upper - 3) * ((index + 1) / (count + 1)));
    const jitter = (showcaseRoll(`${match.id}-${key}`, index) - 0.5) * Math.min(18, Math.max(6, finalMinute / Math.max(3, count)));
    slots.push(clamp(Math.round(base + jitter), 1, upper));
  }
  return slots.sort((a, b) => a - b);
}

function showcaseLiveTimeline(match, finalStats, goalEvents, penalties = null) {
  const finalMinute = match.extraTime || penalties ? 120 : 90;
  const hiddenEvents = [];
  goalEvents.forEach((event, index) => hiddenEvents.push({
    ...event,
    id: `${match.id}-goal-${index}`,
    type: 'goal',
    minute: clamp(Number(event.minute || 1), 1, finalMinute)
  }));

  const addEvents = (side, type, count, key) => {
    showcaseMinuteSlots(match, Math.max(0, count), `${side}-${key}`, finalMinute).forEach((minute, index) => {
      hiddenEvents.push({ id: `${match.id}-${side}-${key}-${index}`, side, type, minute });
    });
  };

  for (const side of ['home', 'away']) {
    const goals = goalEvents.filter((event) => event.side === side).length;
    const source = finalStats[side];
    addEvents(side, 'shotOnTarget', Math.max(0, source.onTarget - goals), 'target');
    addEvents(side, 'shotOffTarget', Math.max(0, source.shots - source.onTarget), 'shot');
    addEvents(side, 'corner', source.corners, 'corner');
    if (Array.isArray(match.cardEvents)) {
      match.cardEvents.filter((event) => event.side === side).forEach((event, index) => {
        hiddenEvents.push({ ...event, id: `${match.id}-${side}-card-${index}` });
      });
    } else {
      addEvents(side, 'yellow', source.yellow, 'yellow');
      addEvents(side, 'red', source.red, 'red');
    }
  }

  const priority = { red: 0, yellow: 1, corner: 2, shotOffTarget: 3, shotOnTarget: 4, goal: 5 };
  hiddenEvents.sort((a, b) => a.minute - b.minute || (priority[a.type] ?? 9) - (priority[b.type] ?? 9));

  const running = {
    home: { shots: 0, onTarget: 0, corners: 0, yellow: 0, red: 0 },
    away: { shots: 0, onTarget: 0, corners: 0, yellow: 0, red: 0 }
  };
  let homeGoals = 0;
  let awayGoals = 0;
  const majorEvents = [];
  const timeline = [{
    minute: 0,
    label: "0'",
    homeGoals: 0,
    awayGoals: 0,
    home: { ...running.home, possession: 50 },
    away: { ...running.away, possession: 50 },
    events: [],
    minuteEvents: []
  }];

  for (let minute = 1; minute <= finalMinute; minute += 1) {
    const minuteEvents = hiddenEvents.filter((event) => event.minute === minute);
    minuteEvents.forEach((event) => {
      const side = event.side;
      if (!side || !running[side]) return;
      if (event.type === 'goal') {
        running[side].shots += 1;
        running[side].onTarget += 1;
        if (side === 'home') homeGoals += 1;
        else awayGoals += 1;
        majorEvents.push({ ...event });
      } else if (event.type === 'shotOnTarget') {
        running[side].shots += 1;
        running[side].onTarget += 1;
      } else if (event.type === 'shotOffTarget') {
        running[side].shots += 1;
      } else if (event.type === 'corner') running[side].corners += 1;
      else if (event.type === 'yellow') {
        running[side].yellow += 1;
        majorEvents.push({ ...event });
      } else if (event.type === 'red') {
        running[side].red += 1;
        majorEvents.push({ ...event });
      }
    });

    const progress = minute / finalMinute;
    const possessionWave = (showcaseRoll(`${match.id}-pos-live-minute`, minute) - 0.5) * (5.2 * (1 - progress));
    const homePossession = minute === finalMinute
      ? finalStats.home.possession
      : clamp(Math.round(50 + (finalStats.home.possession - 50) * (0.18 + progress * 0.82) + possessionWave), 22, 78);
    const awayPossession = 100 - homePossession;
    timeline.push({
      minute,
      label: `${minute}'`,
      homeGoals,
      awayGoals,
      home: { ...running.home, possession: homePossession },
      away: { ...running.away, possession: awayPossession },
      events: majorEvents.map((event) => ({ ...event })),
      minuteEvents: minuteEvents.map((event) => ({ ...event }))
    });
  }

  // Guarantee the final frame exactly matches the precomputed result/stat line.
  const last = timeline[timeline.length - 1];
  last.homeGoals = match.homeGoals;
  last.awayGoals = match.awayGoals;
  last.home = { ...finalStats.home };
  last.away = { ...finalStats.away };
  return timeline;
}

function showcasePenaltySequence(state, match, penalties) {
  if (!penalties) return [];
  const rounds = Math.max(5, penalties.home, penalties.away);
  const buildOutcomes = (side, score) => {
    const values = Array.from({ length: rounds }, (_, index) => index < score);
    return values
      .map((scored, index) => ({ scored, order: showcaseRoll(`${match.id}-${side}-penalty-order`, index) }))
      .sort((a, b) => a.order - b.order)
      .map((row) => row.scored);
  };
  const homeOutcomes = buildOutcomes('home', penalties.home);
  const awayOutcomes = buildOutcomes('away', penalties.away);
  const homeLineup = match.isInternational ? getNationalLineup(state, match.homeId) : getClubLineup(state, match.homeId);
  const awayLineup = match.isInternational ? getNationalLineup(state, match.awayId) : getClubLineup(state, match.awayId);
  const homeTakers = [...homeLineup].sort((a, b) => b.rating - a.rating);
  const awayTakers = [...awayLineup].sort((a, b) => b.rating - a.rating);
  const sequence = [];
  let homeScore = 0;
  let awayScore = 0;
  for (let round = 0; round < rounds; round += 1) {
    const homeScored = Boolean(homeOutcomes[round]);
    if (homeScored) homeScore += 1;
    sequence.push({
      index: sequence.length,
      round: round + 1,
      side: 'home',
      scored: homeScored,
      playerId: homeTakers.length ? homeTakers[round % homeTakers.length].id : null,
      home: homeScore,
      away: awayScore
    });
    const awayScored = Boolean(awayOutcomes[round]);
    if (awayScored) awayScore += 1;
    sequence.push({
      index: sequence.length,
      round: round + 1,
      side: 'away',
      scored: awayScored,
      playerId: awayTakers.length ? awayTakers[round % awayTakers.length].id : null,
      home: homeScore,
      away: awayScore
    });
  }
  const last = sequence[sequence.length - 1];
  if (last) {
    last.home = penalties.home;
    last.away = penalties.away;
  }
  return sequence;
}

// Matches played by the minute engine (engine: 2) carry their real timeline. The
// Showcase replays exactly those events; older saved matches keep the story-based
// reconstruction below.
function showcaseRealEvents(match) {
  const events = [];
  (match.goalEvents || []).forEach((goal, index) => events.push({
    id: `${match.id}-goal-${index}`, type: 'goal', side: goal.side, teamId: goal.teamId, minute: goal.minute,
    ...(goal.added ? { added: goal.added } : {}), scorerId: goal.scorerId || null, assistId: goal.assistId || null,
    ...(goal.penalty ? { penalty: true } : {})
  }));
  (match.timeline || []).forEach(([minute, code, side, playerId], index) => events.push({
    id: `${match.id}-t-${index}`, type: code === 's' ? 'shotOffTarget' : code === 't' ? 'shotOnTarget' : 'corner', side, minute,
    ...(playerId ? { playerId } : {})
  }));
  (match.cardEvents || []).forEach((card, index) => events.push({ ...card, id: `${match.id}-${card.side}-card-${index}` }));
  (match.subs || []).forEach((sub, index) => events.push({ id: `${match.id}-sub-${index}`, type: 'sub', side: sub.side, minute: sub.minute, outId: sub.outId, inId: sub.inId, reason: sub.reason }));
  (match.keyChances || []).forEach((chance, index) => events.push({ id: `${match.id}-chance-${index}`, type: 'chance', side: chance.side, minute: chance.minute, playerId: chance.playerId, outcome: chance.outcome }));
  return events;
}

function showcaseRealTimeline(match, finalStats) {
  const finalMinute = match.extraTime ? 120 : 90;
  const events = showcaseRealEvents(match);
  const priority = { red: 0, yellow: 1, sub: 2, corner: 3, shotOffTarget: 4, shotOnTarget: 5, chance: 6, goal: 7 };
  events.sort((a, b) => a.minute - b.minute || (a.added || 0) - (b.added || 0) || (priority[a.type] ?? 9) - (priority[b.type] ?? 9));
  const byMinute = new Map();
  for (const event of events) {
    const minute = clamp(event.minute, 1, finalMinute);
    if (!byMinute.has(minute)) byMinute.set(minute, []);
    byMinute.get(minute).push(event);
  }
  const slices = Array.isArray(match.possessionSlices) ? match.possessionSlices : [];
  // possessionSlices: [slice end minute, home possession] in order.
  const possessionAt = (minute) => {
    if (!slices.length) return finalStats.home.possession;
    let sum = 0, weight = 0, previous = 0;
    for (const [end, value] of slices) {
      const length = end - previous;
      sum += value * length; weight += length; previous = end;
      if (end >= minute) break;
    }
    return Math.round(sum / Math.max(1, weight));
  };
  const running = {
    home: { shots: 0, onTarget: 0, corners: 0, yellow: 0, red: 0 },
    away: { shots: 0, onTarget: 0, corners: 0, yellow: 0, red: 0 }
  };
  let homeGoals = 0;
  let awayGoals = 0;
  const majorEvents = [];
  const timeline = [{ minute: 0, label: "0'", homeGoals: 0, awayGoals: 0, home: { ...running.home, possession: 50 }, away: { ...running.away, possession: 50 }, events: [], minuteEvents: [] }];
  for (let minute = 1; minute <= finalMinute; minute += 1) {
    const minuteEvents = byMinute.get(minute) || [];
    for (const event of minuteEvents) {
      const side = running[event.side];
      if (!side) continue;
      if (event.type === 'goal') {
        side.shots += 1; side.onTarget += 1;
        if (event.side === 'home') homeGoals += 1; else awayGoals += 1;
        majorEvents.push({ ...event });
      } else if (event.type === 'shotOnTarget') { side.shots += 1; side.onTarget += 1; }
      else if (event.type === 'shotOffTarget') side.shots += 1;
      else if (event.type === 'corner') side.corners += 1;
      else if (event.type === 'yellow') { side.yellow += 1; majorEvents.push({ ...event }); }
      else if (event.type === 'red') { side.red += 1; majorEvents.push({ ...event }); }
      else if (event.type === 'sub' || event.type === 'chance') majorEvents.push({ ...event });
    }
    const homePossession = minute === finalMinute ? finalStats.home.possession : clamp(possessionAt(minute), 22, 78);
    timeline.push({
      minute,
      label: `${minute}'`,
      homeGoals,
      awayGoals,
      home: { ...running.home, possession: homePossession },
      away: { ...running.away, possession: 100 - homePossession },
      events: majorEvents.map((event) => ({ ...event })),
      minuteEvents: minuteEvents.map((event) => ({ ...event }))
    });
  }
  const last = timeline[timeline.length - 1];
  last.homeGoals = match.homeGoals;
  last.awayGoals = match.awayGoals;
  last.home = { ...finalStats.home };
  last.away = { ...finalStats.away };
  return timeline;
}

function showcaseRealPenaltySequence(match) {
  return (match.shootout || []).map((kick, index) => ({
    index,
    round: kick.round,
    side: kick.side,
    scored: kick.outcome === 'scored',
    outcome: kick.outcome,
    playerId: kick.playerId || null,
    keeperId: kick.keeperId || null,
    home: kick.home,
    away: kick.away
  }));
}

// Shootouts are archived as they happen. Rows for an unplayed Showcase match stay
// hidden by the same embargo test the rest of the interface uses.
function recordShootout(state, match) {
  state.history.shootouts ||= [];
  const kicks = match.shootout || [];
  state.history.shootouts.push({
    season: state.season,
    matchId: match.id,
    competitionId: match.competitionId,
    competitionName: match.competitionName,
    stage: match.stage,
    isInternational: Boolean(match.isInternational),
    homeId: match.homeId,
    awayId: match.awayId,
    winnerId: match.tieWinnerId || match.winnerId,
    score: { ...match.penalties },
    kicks: kicks.map((kick) => [kick.side === 'home' ? 0 : 1, kick.playerId || null, kick.keeperId || null, kick.outcome === 'scored' ? 1 : kick.outcome === 'saved' ? 2 : 0])
  });
}

function visibleShootouts(state) {
  return (state.history?.shootouts || []).filter((row) => row.season !== state.season
    || !isShowcaseMatchEmbargoed(state, { id: row.matchId, competitionId: row.competitionId, stage: row.stage }));
}

export function getShootoutRecord(state, entityId, kind = 'player') {
  const record = { shootouts: 0, won: 0, lost: 0, taken: 0, scored: 0, faced: 0, saved: 0 };
  for (const row of visibleShootouts(state)) {
    if (kind === 'team') {
      if (row.homeId !== entityId && row.awayId !== entityId) continue;
      record.shootouts += 1;
      if (row.winnerId === entityId) record.won += 1; else record.lost += 1;
      continue;
    }
    let involved = false;
    for (const [, playerId, keeperId, outcome] of row.kicks) {
      if (playerId === entityId) { record.taken += 1; if (outcome === 1) record.scored += 1; involved = true; }
      if (keeperId === entityId) { record.faced += 1; if (outcome === 2) record.saved += 1; involved = true; }
    }
    if (involved) {
      record.shootouts += 1;
      const side = row.kicks.find(([, playerId, keeperId]) => playerId === entityId || keeperId === entityId);
      const teamId = side ? (side[1] === entityId ? (side[0] === 0 ? row.homeId : row.awayId) : (side[0] === 0 ? row.awayId : row.homeId)) : null;
      if (teamId && row.winnerId === teamId) record.won += 1; else record.lost += 1;
    }
  }
  return record;
}

export function getShootoutLeaders(state, limit = 10) {
  const takers = new Map();
  const keepers = new Map();
  const teams = new Map();
  for (const row of visibleShootouts(state)) {
    for (const id of [row.homeId, row.awayId]) {
      const item = teams.get(id) || { id, isInternational: row.isInternational, won: 0, lost: 0 };
      if (row.winnerId === id) item.won += 1; else item.lost += 1;
      teams.set(id, item);
    }
    for (const [, playerId, keeperId, outcome] of row.kicks) {
      if (playerId) {
        const item = takers.get(playerId) || { id: playerId, taken: 0, scored: 0 };
        item.taken += 1; if (outcome === 1) item.scored += 1;
        takers.set(playerId, item);
      }
      if (keeperId) {
        const item = keepers.get(keeperId) || { id: keeperId, faced: 0, saved: 0 };
        item.faced += 1; if (outcome === 2) item.saved += 1;
        keepers.set(keeperId, item);
      }
    }
  }
  return {
    takers: [...takers.values()].sort((a, b) => b.scored - a.scored || a.taken - b.taken).slice(0, limit),
    keepers: [...keepers.values()].sort((a, b) => b.saved - a.saved || a.faced - b.faced).slice(0, limit),
    teams: [...teams.values()].sort((a, b) => b.won - a.won || a.lost - b.lost).slice(0, limit),
    total: visibleShootouts(state).length
  };
}

function captureShowcaseMatch(state, match) {
  if (match.engine >= 2) return captureRealShowcaseMatch(state, match);
  const aggregate = showcaseAggregateContext(state, match);
  const events = showcaseGoalEvents(match);
  const stats = showcaseFinalStats(state, match);
  const ticks = showcaseTicks(match, stats, events, aggregate);
  const penalties = match.penalties ? { ...match.penalties } : aggregate?.penalties ? { ...aggregate.penalties } : null;
  const liveTimeline = showcaseLiveTimeline({ ...match, extraTime: Boolean(match.extraTime || aggregate?.penalties) }, stats, events, penalties);
  const penaltySequence = showcasePenaltySequence(state, match, penalties);
  return {
    id: `showcase-${match.id}`,
    matchId: match.id,
    odds: match.odds || null,
    competitionId: match.competitionId,
    competitionName: match.competitionName,
    stage: match.stage,
    week: match.week,
    homeId: match.homeId,
    awayId: match.awayId,
    isInternational: Boolean(match.isInternational),
    winnerId: aggregate?.winnerId || match.winnerId || null,
    finalScore: { home: match.homeGoals, away: match.awayGoals },
    extraTime: Boolean(match.extraTime || aggregate?.penalties),
    penalties,
    aggregate,
    goalEvents: events,
    finalStats: stats,
    cardEvents: match.cardEvents,
    ticks,
    liveTimeline,
    penaltySequence,
    liveProgress: { timelineIndex: 0, pauseReason: null, penaltyIndex: 0 },
    manOfMatchId: match.manOfMatchId || null,
    lineups: match.lineups || {
      home: getTeamSquadView(state, match.homeId, match.isInternational),
      away: getTeamSquadView(state, match.awayId, match.isInternational)
    },
    resolved: false,
    resolutionMode: null
  };
}

function captureRealShowcaseMatch(state, match) {
  const aggregate = showcaseAggregateContext(state, match);
  const stats = { home: { ...match.stats.home }, away: { ...match.stats.away } };
  const events = (match.goalEvents || []).map((goal) => ({ side: goal.side, teamId: goal.teamId, scorerId: goal.scorerId || null, assistId: goal.assistId || null, minute: goal.minute, ...(goal.added ? { added: goal.added } : {}), ...(goal.penalty ? { penalty: true } : {}) }));
  const penalties = match.penalties ? { ...match.penalties } : null;
  return {
    id: `showcase-${match.id}`,
    matchId: match.id,
    competitionId: match.competitionId,
    competitionName: match.competitionName,
    stage: match.stage,
    week: match.week,
    homeId: match.homeId,
    awayId: match.awayId,
    isInternational: Boolean(match.isInternational),
    winnerId: match.tieWinnerId || aggregate?.winnerId || match.winnerId || null,
    finalScore: { home: match.homeGoals, away: match.awayGoals },
    extraTime: Boolean(match.extraTime),
    penalties,
    aggregate,
    goalEvents: events,
    finalStats: stats,
    cardEvents: match.cardEvents,
    subs: match.subs || [],
    keyChances: match.keyChances || [],
    ticks: showcaseTicks(match, stats, events, aggregate),
    liveTimeline: showcaseRealTimeline(match, stats),
    penaltySequence: showcaseRealPenaltySequence(match),
    liveProgress: { timelineIndex: 0, pauseReason: null, penaltyIndex: 0 },
    manOfMatchId: match.manOfMatchId || null,
    motmRating: match.motmRating ?? null,
    playerRatings: match.playerRatings || null,
    odds: match.odds || null,
    styles: match.styles || null,
    lineups: match.lineups || {
      home: getTeamSquadView(state, match.homeId, match.isInternational),
      away: getTeamSquadView(state, match.awayId, match.isInternational)
    },
    engine: 2,
    resolved: false,
    resolutionMode: null
  };
}

export function showcaseSelectionMode(state, competitionId) {
  return state?.current?.postseason?.selections?.[competitionId] || state?.showcasePreferences?.[competitionId] || 'none';
}

export function isShowcaseSelectedMatch(state, match) {
  if (!match?.competitionId) return false;
  const mode = showcaseSelectionMode(state, match.competitionId);
  if (!mode || mode === 'none') return false;
  const stage = String(match.stage || '').trim();
  if (mode === 'final') return /^final$/i.test(stage);
  if (mode === 'semis') return /semi-final/i.test(stage) || /^final$/i.test(stage);
  return false;
}

export function isShowcaseMatchEmbargoed(state, match) {
  if (!isShowcaseSelectedMatch(state, match)) return false;
  const prepared = state?.current?.postseason?.prepared;
  const showcaseRows = state?.current?.postseason?.showcaseMatches || [];
  if (prepared) {
    const row = showcaseRows.find((item) => item.matchId === match.id || item.id === `showcase-${match.id}`);
    if (row) return !row.resolved;
  }
  // Before the postseason queue is prepared, selected matches remain private once
  // the background season simulation has produced them. They are revealed only
  // through the showcase experience.
  return true;
}

export function isShowcaseCompetitionEmbargoed(state, competitionId) {
  const mode = showcaseSelectionMode(state, competitionId);
  if (!mode || mode === 'none') return false;
  const postseason = state?.current?.postseason;
  if (postseason?.prepared) {
    const rows = (postseason.showcaseMatches || []).filter((item) => item.competitionId === competitionId);
    if (rows.length) return rows.some((item) => !item.resolved);
  }
  const rawMatches = [...(state?.current?.matches || []), ...(state?.current?.archivedKnockoutMatches || [])];
  return rawMatches.some((match) => match.competitionId === competitionId && isShowcaseSelectedMatch(state, match));
}

function selectedShowcaseMatches(state) {
  const selections = state.current.postseason?.selections || {};
  const allMatches = state.current.matches || [];
  const captured = [];
  for (const [competitionId, mode] of Object.entries(selections)) {
    if (!mode || mode === 'none') continue;
    const matches = allMatches.filter((match) => match.competitionId === competitionId);
    if (!matches.length) continue;
    const finals = matches.filter((match) => /^final$/i.test(String(match.stage || '').trim())).sort((a, b) => a.week - b.week);
    const selected = [];
    if (mode === 'semis') {
      const semis = matches
        .filter((match) => /semi-final/i.test(String(match.stage || '')))
        .sort((a, b) => a.week - b.week || String(a.stage || '').localeCompare(String(b.stage || '')));
      selected.push(...semis);
    }
    if (finals.length) selected.push(finals[finals.length - 1]);
    const unique = [...new Map(selected.map((match) => [match.id, match])).values()];
    captured.push(...unique.map((match) => captureShowcaseMatch(state, match)));
  }
  return captured.sort((a, b) => a.week - b.week || a.competitionName.localeCompare(b.competitionName));
}

const POSTSEASON_STATS_INDEX = new WeakMap();
function postseasonSeasonStats(state, playerId) {
  const source = state.current.playerStats || {};
  let byPlayer = POSTSEASON_STATS_INDEX.get(source);
  if (!byPlayer) {
    byPlayer = new Map();
    for (const row of Object.values(source)) {
      if (!(row.apps > 0)) continue;
      if (!byPlayer.has(row.playerId)) byPlayer.set(row.playerId, []);
      byPlayer.get(row.playerId).push(row);
    }
    POSTSEASON_STATS_INDEX.set(source, byPlayer);
  }
  const stats = byPlayer.get(playerId) || [];
  const apps = stats.reduce((sum, row) => sum + (row.apps || 0), 0);
  const goals = stats.reduce((sum, row) => sum + (row.goals || 0), 0);
  const assists = stats.reduce((sum, row) => sum + (row.assists || 0), 0);
  const cleanSheets = stats.reduce((sum, row) => sum + (row.cleanSheets || 0), 0);
  const ratingWeighted = stats.reduce((sum, row) => sum + (row.averageRating || 0) * (row.apps || 0), 0);
  return { apps, goals, assists, cleanSheets, averageRating: apps ? Number((ratingWeighted / apps).toFixed(2)) : 0 };
}

function postseasonCandidate(state, candidate, rank, awardName) {
  const player = getPlayer(state, candidate?.playerId);
  if (!player) return null;
  const trophies = [...new Set((state.history.honours || [])
    .filter((row) => row.season === state.season && row.playerId === player.id)
    .map((row) => row.competitionName))];
  const awards = [...new Set((state.history.awards || [])
    .filter((row) => row.season === state.season && row.playerId === player.id && (row.rank || 1) === 1 && row.name !== awardName)
    .map((row) => row.name))];
  return {
    rank,
    playerId: player.id,
    name: player.name,
    position: player.position,
    nationality: player.nationality,
    clubId: candidate?.primaryClubId || player.clubId || null,
    rarity: player.rarity,
    stats: postseasonSeasonStats(state, player.id),
    trophies: trophies.slice(0, 6),
    awards: awards.slice(0, 6)
  };
}

function postseasonAwardPodium(state, title, candidates, forcedWinnerId = null) {
  const list = [...candidates];
  if (forcedWinnerId) {
    const winnerIndex = list.findIndex((candidate) => candidate.playerId === forcedWinnerId);
    if (winnerIndex > 0) {
      const [winner] = list.splice(winnerIndex, 1);
      list.unshift(winner);
    } else if (winnerIndex < 0) {
      list.unshift({ playerId: forcedWinnerId, primaryClubId: getPlayer(state, forcedWinnerId)?.clubId || null });
    }
  }
  const podium = list.slice(0, 3).map((candidate, index) => postseasonCandidate(state, candidate, index + 1, title)).filter(Boolean);
  return { id: slug(`postseason-${title}`), title, podium, revealStage: 0 };
}

function buildPostseasonAwards(state) {
  const race = buildAnnualAwardRace(state);
  const seasonAwards = (state.history.awards || []).filter((row) => row.season === state.season);
  const positionAwards = {
    GK: seasonAwards.find((row) => row.name === 'World Best GK' && (row.rank || 1) === 1)?.playerId || null,
    DF: seasonAwards.find((row) => row.name === 'World Best DF' && (row.rank || 1) === 1)?.playerId || null,
    MF: seasonAwards.find((row) => row.name === 'World Best MF' && (row.rank || 1) === 1)?.playerId || null,
    FW: seasonAwards.find((row) => row.name === 'World Best FW' && (row.rank || 1) === 1)?.playerId || null
  };
  const awards = [];
  for (const [position, label] of [['GK','Best Goalkeeper'], ['DF','Best Defender'], ['MF','Best Midfielder'], ['FW','Best Forward']]) {
    awards.push(postseasonAwardPodium(
      state,
      label,
      race.ballonDor.filter((candidate) => getPlayer(state, candidate.playerId)?.position === position),
      positionAwards[position]
    ));
  }
  awards.push(postseasonAwardPodium(state, 'Kopa Trophy', race.kopa));
  awards.push(postseasonAwardPodium(state, 'World Golden Boot', race.goldenBoot));
  awards.push(postseasonAwardPodium(state, "Ballon d'Or", race.ballonDor));
  return awards.filter((awardRow) => awardRow.podium.length);
}

function preparePostseasonExperience(state) {
  state.current.postseason ||= { selections: {}, prepared: false, phase: 'setup', showcaseMatches: [], awards: [], completed: false };
  const showcaseMatches = selectedShowcaseMatches(state);
  const awards = buildPostseasonAwards(state);
  state.current.postseason.prepared = true;
  state.current.postseason.showcaseMatches = showcaseMatches;
  state.current.postseason.awards = awards;
  state.current.postseason.awardActiveIndex = 0;
  state.current.postseason.phase = showcaseMatches.length ? 'games' : 'awards';
  state.current.postseason.completed = false;
  state.current.postseason.preparedSeason = state.season;
}

function closeSeason(state) {
  ensureCareerCounters(state);
  // Condensed leagues play without match records: their goals join careers here.
  for (const row of Object.values(state.current.playerStats || {})) {
    if (state.current.leagues?.[row.competitionId]?.tier !== 'summary' || !row.goals) continue;
    const player = getPlayer(state, row.playerId);
    if (player) player.careerGoals = (player.careerGoals || 0) + row.goals;
  }
  flushLightAppearances(state);
  updateSeasonRecords(state);
  calculateAwards(state);
  archiveSeason(state);
  preparePostseasonExperience(state);
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
  state.current.archivedKnockoutMatches = state.current.matches.filter((match) => match.knockout || match.landmark || isShowcaseSelectedMatch(state, match)).map(compactArchivedMatch);
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
  archiveWorldNews(state);
  state.current.completed = true;
}

export function startNextSeason(state) {
  for (const _ of startNextSeasonSteps(state)) { /* run every step */ }
  return state;
}

// Same offseason as startNextSeason, one stage at a time. Each yield gives the stage just
// finished; getOffseasonProgress(state) describes what has happened so far.
export function* startNextSeasonSteps(state) {
  if (!state.current.completed) return;
  state.offseasonProgress = { fromSeason: state.season, coachMoves: state.history.coachMoves.length, transfers: state.history.transfers.length, stage: 'start' };
  // Ratings before the summer's development and aging, for "since last season" views.
  for (const player of state.players) if (player.status === 'active') player.previousRating = player.rating;
  state.pendingContractExits = [];
  state.pendingLoanReturns = [];
  state.history.postseasons ||= [];
  if (state.current.postseason?.prepared && !state.history.postseasons.some((row) => row.season === state.season)) {
    state.history.postseasons.push({
      season: state.season,
      seasonLabel: formatSeason(state.season),
      ...structuredClone(state.current.postseason)
    });
  }
  releaseHeldRecords(state);
  archivePredictions(state);
  returnLoanedPlayers(state);
  invalidateRuntimeCache(state);
  yield 'start';
  for (const stage of evolveWorldSteps(state)) { state.offseasonProgress.stage = stage; yield stage; }
  state.season += 1;
  carryInjuriesIntoNewSeason(state);
  state.current = newCurrentSeason(state);
  state.pendingSeasonStars = [];
  state.pendingSeasonCoaches = [];
  state.pendingSeasonRetirements = [];
  state.pendingOwnerChanges = [];
  refreshAllMarketValues(state);
  state.offseasonProgress.stage = 'squads';
  yield 'squads';
  runTransferMarket(state, false);
  state.offseasonProgress.stage = 'transfers';
  yield 'transfers';
  runLoanMarket(state);
  invalidateRuntimeCache(state);
  ensureClubRosters(state);
  runSquadReshape(state);
  topUpElitePopulation(state);
  state.offseasonProgress.stage = 'reshape';
  yield 'reshape';
  compactFreeAgentPool(state);
  refreshAllMarketValues(state);
  invalidateRuntimeCache(state);
  refreshAllClubStrengths(state);
  assignAllCaptains(state);
  state.current.offseason = {
    season: state.season,
    seasonLabel: formatSeason(state.season),
    retirements: [...(state.current.retirements || [])],
    newStars: [...(state.current.newStars || [])],
    newCoaches: [...(state.current.newCoaches || [])],
    ownerChanges: [...(state.current.ownerChanges || [])],
    transfers: [...(state.current.transfers || [])],
    freeAgents: (state.players || []).filter((player) => player.status === 'active' && !player.clubId).sort((a,b)=>b.rating-a.rating).slice(0,80).map((player)=>player.id),
    freeAgentSignings: [...(state.current.offseasonFreeAgentSignings || [])].slice(-120),
    coachMoves: [...(state.history.coachMoves || [])].filter((move)=>move.season === state.season).slice(-120),
    payrollChanges: [...(state.current.payrollChanges || [])],
    reshape: state.current.reshape || null,
    youthIntake: [...(state.current.youthIntake || [])]
  };
  state.pendingPayrollChanges = [];
  addPreseasonMagazine(state);
  state.current.offseason.headlines = curateOffseasonHeadlines(state);
  archiveWorldNews(state, state.current.offseason.headlines);
  state.offseasonProgress = undefined;
  yield 'done';
}

// What the offseason has produced so far: coach moves, biggest signings, retirements.
export function getOffseasonProgress(state) {
  const progress = state.offseasonProgress;
  if (!progress) return null;
  const coachMoves = state.history.coachMoves.slice(progress.coachMoves).filter((move) => move.toClubId || move.toNationalTeamId || move.fromClubId);
  const transfers = state.history.transfers.slice(progress.transfers).filter((move) => !move.loan && move.fromClubId && move.toClubId);
  const retirements = (state.pendingSeasonRetirements || []).length ? state.pendingSeasonRetirements : (state.current.retirements || []);
  return {
    stage: progress.stage,
    fromSeason: progress.fromSeason,
    coachMoves: coachMoves.slice(-40).reverse(),
    topTransfers: [...transfers].sort((a, b) => (b.fee || 0) - (a.fee || 0)).slice(0, 12),
    transferCount: transfers.length,
    retirements: retirements.filter((row) => row.type !== 'coach' && ['generational', 'legend', 'epic'].includes(row.rarity)).slice(0, 12)
  };
}

export function getLeagueMarketRankings(state, region = null) {
  return leagueStrengthRows(state, region).map((row)=>({
    leagueId: row.league.id,
    leagueName: row.league.name,
    country: row.league.country,
    confederation: row.league.confederation,
    rank: row.rank,
    score: Number(row.score.toFixed(1)),
    powerScore: Number((row.powerScore || 0).toFixed(1)),
    financialPool: Number((row.financialPool || 0).toFixed(1)),
    eraActive: Boolean(row.era),
    eraStartSeason: row.era?.startSeason || null,
    eraEndSeason: row.era?.endSeason || null,
    eraBonus: Number((row.eraBonus || 0).toFixed(1))
  }));
}

export function getClubFinancialStatus(state, clubId) {
  const club = getClub(state, clubId);
  if (!club) return null;
  return {
    tier: club.financialTier || 'R',
    label: CLUB_FINANCIAL_TIERS[club.financialTier || 'R'].label,
    annualShare: Number(club.annualFinanceShare || 0),
    countryPool: countryPool(state, club.country),
    currentPayroll: Number(club.currentPayroll || 0),
    payrollLimit: Number(club.payrollLimit || clubPayrollLimit(club)),
    payrollPressure: Number(club.payrollPressureRatio || 1)
  };
}

export function getLeagueTable(state, leagueId) {
  return sortTable(state.current.leagues[leagueId]?.table || []);
}

export function getTeamPower(state, teamId, isInternational = false) {
  return calculateTeamStrength(state, teamId, isInternational);
}

// Matchday squad as the UI shows it: formation, fit and the XI on a pitch.
export function getTeamSquadView(state, teamId, isInternational = false) {
  const squad = getTeamSquad(state, teamId, isInternational);
  const row = (player, extra = {}) => ({
    playerId: player.depth ? null : player.id,
    depth: Boolean(player.depth),
    position: player.position,
    rating: player.rating,
    ...extra
  });
  return {
    formationId: squad.formationId,
    preferredFormation: squad.preferredFormation,
    fit: squad.fit,
    fallback: squad.fallback,
    systemPenalty: squad.systemPenalty || 0,
    xi: squad.xi.map((item) => row(item.player, {
      slotType: item.slotType,
      x: item.x,
      y: item.y,
      effective: Math.round(item.effective),
      slotFit: Number(item.fit.toFixed(2))
    })),
    bench: squad.bench.map((player) => row(player))
  };
}

// Availability for squad lists and profiles: injury, bans per competition, fitness.
export function getPlayerAvailability(state, playerId) {
  const player = getPlayer(state, playerId);
  if (!player) return null;
  const injured = isPlayerInjured(state, player);
  const bans = Object.entries(state.current?.discipline?.[playerId] || {})
    .filter(([, row]) => (row.ban || 0) > 0)
    .map(([competitionId, row]) => ({ competitionId, matches: row.ban }));
  const fitness = playerFitness(player);
  return {
    injured,
    injury: injured ? { type: player.injury.type, label: INJURY_TYPES[player.injury.type]?.label || 'Injury', weeksLeft: injuryWeeksLeft(state, player), returnSeason: player.injury.returnSeason, returnWeek: player.injury.returnWeek } : null,
    suspensions: bans,
    fitness,
    tired: fitness < 75
  };
}

export function getPlayerInjuryHistory(state, playerId) {
  const player = getPlayer(state, playerId);
  const codes = Object.fromEntries(Object.entries(INJURY_TYPES).map(([id, type]) => [type.code, { id, label: type.label }]));
  return [...(player?.injuries || [])].reverse().map(([season, week, code, weeks]) => ({ season, seasonLabel: formatSeason(season), week, type: codes[code]?.id || 'medium', label: codes[code]?.label || 'Injury', weeks }));
}

// Personality, scouting range, form, captaincy and loan status for the UI.
export function getPlayerProfileDetails(state, playerId) {
  const player = getPlayer(state, playerId);
  if (!player) return null;
  const club = player.clubId ? getClub(state, player.clubId) : null;
  const form = player.form || 0;
  return {
    traits: (player.traits || []).map((id) => ({ id, ...PLAYER_TRAITS[id] })).filter((row) => row.label),
    potential: player.status === 'active' ? potentialRange(player) : null,
    form,
    formLabel: form >= 0.55 ? 'On fire' : form >= 0.2 ? 'In form' : form <= -0.55 ? 'Slump' : form <= -0.2 ? 'Out of form' : 'Steady',
    captainOf: club && club.captainId === player.id ? club.id : null,
    loan: player.loan ? { parentClubId: player.loan.parentClubId, clubId: player.clubId } : null,
    loanHistory: [...(player.loanHistory || [])],
    academy: Boolean(player.academy)
  };
}

export function getClubLoans(state, clubId) {
  const players = state.players.filter((player) => player.status === 'active' && player.loan);
  return {
    out: players.filter((player) => player.loan.parentClubId === clubId).map((player) => ({ playerId: player.id, clubId: player.clubId })),
    in: players.filter((player) => player.clubId === clubId).map((player) => ({ playerId: player.id, parentClubId: player.loan.parentClubId }))
  };
}

// Leagues whose matches are played in full detail (the rest are played light).
export function isFullDetailLeague(leagueId) {
  return FULL_DETAIL_LEAGUES.has(leagueId);
}

export function getCoachFormations(state, coachId) {
  const coach = getRuntimeCache(state).coachById.get(coachId) || state.coaches?.find((item) => item.id === coachId);
  if (!coach) return null;
  const { primary, secondary } = coachFormationPair(coach);
  return { primary, secondary };
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
        domestic = createStaffMember(state, 'coach', team.id, { rarity: ordinaryCoachRarity(state), careerYear: 0, debutSeason: state.season, appointmentSeason: state.season, status: 'active' });
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
  if (state.dataRevision < 15) {
    state.history.hallOfFamePlayers ||= [];
    state.history.clubLegends ||= [];
    state.history.clubPowerRankings ||= [];
    state.history.leaguePowerRankings ||= [];
    state.preferences ||= {};
    state.preferences.favoriteClubIds ||= [];
    state.preferences.favoritePlayerIds ||= [];
    state.preferences.favoriteCoachIds ||= [];
    state.preferences.favoriteNationIds ||= [];
    state.preferences.favoriteCompetitionIds ||= ['UCL'];
    const legacyContext = buildLegacyContext(state, true);
    for (const player of state.players || []) {
      if (player.status === 'retired') evaluateRetiringPlayerLegacy(state, player, legacyContext);
    }
    state.dataRevision = 15;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 16) {
    // Rebase institutional reputation, market values and national-team coaching without rewriting history.
    for (const club of state.clubs || []) {
      if (HISTORICAL_CLUB_REPUTATION[club.id] != null) club.reputation = HISTORICAL_CLUB_REPUTATION[club.id];
    }
    const relabel = (rows) => { for (const row of rows || []) if (Number.isFinite(row.season)) row.seasonLabel = formatSeason(row.season); };
    relabel(state.history?.playerSeasons); relabel(state.history?.clubSeasons); relabel(state.history?.clubCompetitionSeasons);
    relabel(state.history?.awards); relabel(state.history?.champions); relabel(state.history?.honours); relabel(state.history?.seasonReviews);
    relabel(state.history?.transfers); relabel(state.history?.coachCompetitionSeasons); relabel(state.history?.coachSeasons); relabel(state.history?.leagueMovements);
    relabel(state.history?.clubPowerRankings); relabel(state.history?.leaguePowerRankings);
    if (state.current) state.current.seasonLabel = formatSeason(state.season);
    // Prime Legendary/Generational coaches return to club football; national teams use them mainly late in their careers.
    for (const team of state.nationalTeams || []) {
      const currentCoach = state.coaches?.find((coach) => coach.id === team.coachId);
      if (!currentCoach || nationalCoachCandidateAllowed(team, currentCoach)) continue;
      currentCoach.nationalTeamId = null;
      team.coachId = null; team.coachProfile = null; team.coachRarity = null; team.coachQuality = null;
      let replacement = (state.coaches || []).filter((coach)=>coach.status !== 'retired' && !coach.clubId && !coach.nationalTeamId && coach.nationality === team.id && nationalCoachCandidateAllowed(team, coach))
        .sort((a,b)=>nationalCoachRarityFit(team,b)-nationalCoachRarityFit(team,a) || b.quality-a.quality)[0];
      if (!replacement) {
        replacement = createStaffMember(state, 'coach', team.id, { rarity: cappedCoachRarity(state, team.tier === 1 ? 'rare' : team.tier === 2 ? 'uncommon' : 'common'), careerYear: randomInt(state,1,4), debutSeason: state.season, status:'active' });
        state.coaches.push(replacement);
      }
      assignCoachToNation(state, replacement, team);
    }
    refreshAllMarketValues(state);
    for (const player of state.players || []) {
      if (player.status !== 'active' || !['generational','legend','epic'].includes(player.rarity) || !player.clubId) continue;
      const club = getClub(state, player.clubId);
      if (!club) continue;
      const gap = player.rating - (club.reputation || 60);
      if (player.rating >= 94 && gap >= 12 && playerAchievementScore(state, player, 3) < 25) player.happiness = Math.min(player.happiness ?? 60, 22);
      else if (player.rating >= 89 && gap >= 10 && playerAchievementScore(state, player, 3) < 18) player.happiness = Math.min(player.happiness ?? 60, 38);
    }
    if (state.current) state.current.offseason ||= null;
    state.dataRevision = 16;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 17) {
    // Convert the old compressed player-career scale into realistic 17/18-to-30/39 careers
    // while preserving each active player's relative progress through the career.
    for (const player of state.players || []) {
      player.debutAge ||= 18;
      const oldLength = Math.max(8, Number(player.careerLength || 13));
      const oldYear = Math.max(0, Number(player.careerYear || 0));
      const progress = oldLength > 1 ? oldYear / (oldLength - 1) : 0;
      let newLength;
      if (player.realWorldId) {
        const template = REAL_WORLD_STARS.find((star) => star.id === player.realWorldId);
        newLength = mappedRealCareerLength(template?.careerLength || oldLength);
      } else {
        const retirementAge = 30 + Math.floor(stableStringRoll(`${player.id}-v25-retirement`) * 10);
        newLength = clamp(retirementAge - player.debutAge, 12, 22);
      }
      player.careerLength = newLength;
      player.careerLengthType = newLength <= 15 ? 'short' : newLength <= 18 ? 'medium' : 'long';
      player.careerMultipliers = careerCurve(player.careerType || 'stable_prime', newLength);
      player.careerYear = Math.min(newLength - 1, Math.round(progress * (newLength - 1)));
      player.birthYear = state.season - (player.debutAge + player.careerYear);
      player.debutSeason = state.season - player.careerYear;
      if (player.status === 'active') {
        player.rating = clamp(Math.round(player.baseQuality * (player.careerMultipliers[player.careerYear] ?? 0.9)), 51, 100);
      }
    }
    refreshAllMarketValues(state);
    state.dataRevision = 17;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 18) {
    initializeCountryFinance(state);
    // Map every existing club into the four institutional buckets. Historical clubs use
    // explicit baselines; the rest use their original league standing. Existing giant cash
    // piles are capped to a few years of their sustainable allocation rather than deleted.
    for (const league of LEAGUE_DEFINITIONS) {
      const leagueClubs = (state.clubs || []).filter((club)=>club.leagueId===league.id).sort((a,b)=>b.reputation-a.reputation || b.strength-a.strength);
      leagueClubs.forEach((club,index)=>{
        club.financialTier ||= initialClubFinancialTier(league, club.id, index);
        club.financialTierSince ||= state.season;
      });
      const allocations = clubCountryAllocationMap(state, league.country);
      for (const club of leagueClubs) {
        const share = allocations.get(club.id) || countryPool(state, league.country)*0.015;
        club.annualFinanceShare = Number(share.toFixed(1));
        club.finances = Math.min(Number(club.finances || 0), Math.max(20, share * 3.0));
        club.transferBudget = Math.min(Number(club.transferBudget || 0), Math.max(5, share * 1.15));
        club.wageBudget = Number(Math.max(1.2, share*0.24*(club.ownerMoneyMultiplier||1)).toFixed(1));
      }
    }
    // Prime superstars stranded far below their sporting level become visibly restless.
    invalidateRuntimeCache(state);
    for (const player of state.players || []) {
      if (player.status !== 'active' || !player.clubId || !['generational','legend','epic'].includes(player.rarity)) continue;
      const club = getClub(state, player.clubId);
      const pressure = eliteMigrationPressure(state, player, club);
      if (pressure >= 80) player.happiness = Math.min(player.happiness ?? 60, 18);
      else if (pressure >= 62) player.happiness = Math.min(player.happiness ?? 60, 32);
    }
    state.dataRevision = 18;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 19) {
    state.pendingPayrollChanges ||= [];
    if (state.current) state.current.payrollChanges ||= [];
    initializePayrollAnchors(state);
    // Old 17-22 year presidential terms are converted into the new 4-12 year lifecycle
    // without instantly replacing every long-serving board on load.
    for (const owner of state.owners || []) {
      owner.status ||= owner.clubId ? 'active' : 'retired';
      owner.seasonsInRole ||= Math.max(0, state.season - Number(owner.appointmentSeason ?? state.season));
      if (owner.clubId) {
        const maxRemaining = Math.max(1, 12 - owner.seasonsInRole);
        owner.yearsRemaining = Math.min(Number(owner.yearsRemaining || ownerTermYears(state)), maxRemaining);
      }
    }
    state.dataRevision = 19;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 20) {
    state.history ||= {};
    state.history.postseasons ||= [];
    if (state.current) {
      state.current.postseason ||= {
        selections: {},
        prepared: false,
        phase: state.current.completed ? 'awards' : 'setup',
        showcaseMatches: [],
        awards: [],
        completed: false
      };
      state.current.postseason.selections ||= {};
      state.current.postseason.showcaseMatches ||= [];
      state.current.postseason.awards ||= [];
    }
    state.dataRevision = 20;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 21) {
    const postseason = state.current?.postseason;
    for (const match of postseason?.showcaseMatches || []) {
      const finalStats = match.finalStats || { home: { shots: match.finalScore?.home || 0, onTarget: match.finalScore?.home || 0, corners: 0, possession: 50, yellow: 0, red: 0 }, away: { shots: match.finalScore?.away || 0, onTarget: match.finalScore?.away || 0, corners: 0, possession: 50, yellow: 0, red: 0 } };
      const penalties = match.penalties || null;
      if (!Array.isArray(match.liveTimeline) || !match.liveTimeline.length) {
        match.liveTimeline = showcaseLiveTimeline({
          ...match,
          homeGoals: match.finalScore?.home ?? match.homeGoals ?? 0,
          awayGoals: match.finalScore?.away ?? match.awayGoals ?? 0,
          extraTime: Boolean(match.extraTime || penalties)
        }, finalStats, match.goalEvents || [], penalties);
      }
      if (penalties && (!Array.isArray(match.penaltySequence) || !match.penaltySequence.length)) {
        match.penaltySequence = showcasePenaltySequence(state, match, penalties);
      }
      match.liveProgress ||= { timelineIndex: 0, pauseReason: null, penaltyIndex: 0 };
    }
    state.dataRevision = 21;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 22) {
    state.showcasePreferences ||= { ...(state.current?.postseason?.selections || {}) };
    if (state.current?.postseason) {
      state.current.postseason.selections = { ...state.showcasePreferences, ...(state.current.postseason.selections || {}) };
      state.current.postseason.awardActiveIndex = Number.isInteger(state.current.postseason.awardActiveIndex) ? state.current.postseason.awardActiveIndex : 0;
    }
    state.dataRevision = 22;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 23) {
    state.history ||= {};
    state.history.news ||= [];
    state.history.leagueEras ||= [];
    state.leagueEras ||= {};
    initializeLeagueEras(state);
    state.pendingPayrollChanges ||= [];
    if (state.current?.offseason) state.current.offseason.headlines ||= [];
    initializePayrollAnchors(state);
    recalculateClubPayrollPressure(state);
    state.dataRevision = 23;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 24) {
    // Rebuild legacy lists once under the stricter standards so existing saves are
    // cleaned too; otherwise old permissive inductions would remain forever.
    state.history ||= {};
    state.history.hallOfFamePlayers = [];
    state.history.clubLegends = [];
    const legacyContext = buildLegacyContext(state, true);
    for (const player of state.players || []) {
      if (player.status === 'retired') evaluateRetiringPlayerLegacy(state, player, legacyContext);
    }
    state.dataRevision = 24;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 25) {
    state.history ||= {};
    state.history.transfers ||= [];
    state.current.transfers ||= [];
    let nextTransferId = Math.max(1, Number(state.nextTransferId || 1));
    const giveId = (record) => {
      if (!record.id) record.id = `transfer-${nextTransferId++}`;
      return record.id;
    };
    for (const record of state.history.transfers) giveId(record);
    for (const record of state.current.transfers) {
      const matching = state.history.transfers.find((item) => sameTransferRecord(item, record));
      record.id = matching ? matching.id : giveId(record);
    }
    state.nextTransferId = nextTransferId;
    state.current.editorActions ||= [];
    state.dataRevision = 25;
    invalidateRuntimeCache(state);
  }
  if (state.dataRevision < 26) {
    // v4 Phase 1: 15-player squads and coach formations.
    for (const coach of state.coaches || []) ensureCoachFormation(coach);
    invalidateRuntimeCache(state);
    const cache = getRuntimeCache(state);
    let added = 0;
    for (const club of state.clubs || []) {
      if (rosterTargetFor(club) < SQUAD_SIZE) continue;
      const roster = [...(cache.clubPlayers.get(club.id) || [])];
      let addedSalary = 0;
      while (roster.length < SQUAD_SIZE) {
        const position = positionNeedFromRoster(state, club, roster);
        const need = clubSystemNeed(state, club, roster);
        const role = need?.line === position ? bestRoleForSlot(need.slotType) : null;
        const player = createSquadFiller(state, club, position, { roleOptions: role ? [role] : null, debutSeason: state.season });
        // Fillers join as established squad members, not as this season's signings.
        player.clubJoinedSeason = state.season - Math.min(player.careerYear, 3);
        player.transferProtectedUntilSeason = null;
        state.players.push(player);
        roster.push(player);
        addedSalary += player.salary;
        added += 1;
      }
      // Existing wage anchors grow with the squad so no club is pushed into payroll distress.
      if (addedSalary && Number.isFinite(club.payrollAnchor)) club.payrollAnchor = Number((club.payrollAnchor + addedSalary).toFixed(1));
    }
    state.targetActivePlayers = (state.targetActivePlayers || 0) + added;
    invalidateRuntimeCache(state);
    recalculateClubPayrollPressure(state);
    state.dataRevision = 26;
  }
  if (state.dataRevision < 27) {
    // v4 Phase 2: minute-by-minute matches. Matches already played keep their stored
    // form and replay through the legacy Showcase reconstruction; new ones carry
    // their own timeline. Shootouts are archived from now on.
    state.history ||= {};
    state.history.shootouts ||= [];
    state.dataRevision = 27;
  }
  if (state.dataRevision < 28) {
    // v4 Phase 3: fitness, injuries and suspensions start fresh: everyone fit, no bans.
    if (state.current) {
      state.current.discipline ||= {};
      state.current.bans ||= {};
    }
    state.dataRevision = 28;
  }
  if (state.dataRevision < 29) {
    // Light simulation for low-profile matches keeps team-level appearance counters.
    if (state.current) state.current.lightApps ||= {};
    state.dataRevision = 29;
  }
  if (state.dataRevision < 30) {
    // v4 Phase 4: traits and potential for everyone (no change to current ability),
    // and a captain for every club.
    for (const player of state.players || []) initialisePlayerProfile(player, false);
    invalidateRuntimeCache(state);
    assignAllCaptains(state);
    state.dataRevision = 30;
  }
  if (state.dataRevision < 31) {
    // v4 Phase 5: live records start from the history already played; career goal
    // and appearance counters are rebuilt from archived seasons.
    ensureRecords(state);
    if (state.records) state.records.countersReady = false;
    ensureCareerCounters(state);
    state.dataRevision = 31;
  }
  if (state.dataRevision < 32) {
    // v4 Phase 6: predictions game container (picks stay with the reader's save).
    state.predictions ||= { current: null, history: [] };
    state.dataRevision = 32;
  }
  if (state.dataRevision < 33) {
    // v4.2: tournaments already under way keep their old format and random draw (no
    // format/draw fields); new formats and seeded draws start with the next edition.
    for (const comp of Object.values(state.current?.internationalCompetitions || {})) {
      comp.format ??= null;
      comp.draw ??= null;
    }
    // Team fitness (quick model) and the Squad Reshape report start empty.
    if (state.current) {
      state.current.teamFitness ||= {};
      state.current.reshape ??= null;
    }
    state.dataRevision = 33;
  }
  if (state.dataRevision < 34) {
    // v4.3: ratings stay inside the rarity (below Epic, one point under the next band);
    // "since last season" ratings and the move lists start empty.
    for (const player of state.players || []) {
      const band = STAR_RARITIES[player.rarity];
      if (band && (band.rank || 1) < 4) {
        player.baseQuality = Math.min(player.baseQuality, band.max);
        if (Number.isFinite(player.potential)) player.potential = Math.min(player.potential, band.max);
        player.rating = Math.min(player.rating, band.max - 1);
      }
      player.previousRating ??= null;
    }
    if (state.current) {
      state.current.contractExits ||= [];
      state.current.loanReturns ||= [];
      state.current.surplusReleases ||= [];
    }
    state.dataRevision = 34;
  }
  if (state.dataRevision < 35) {
    // v4.4: coach rarity targets (nobody is demoted; counts converge as coaches retire),
    // academy scores with a few elite academies, and academy graduates linked to clubs.
    const activeCoaches = (state.coaches || []).filter((coach) => coach.status !== 'retired').length;
    state.coachRarityTargets = coachTargetsFor(activeCoaches);
    seedEliteAcademies(state, (club) => stableStringRoll(`${club.id}:academy-seed`));
    for (const player of state.players || []) {
      player.academyClubId ??= player.academy ? (player.spawnClubId || null) : null;
    }
    if (state.current) state.current.youthIntake ||= [];
    state.dataRevision = 35;
  }
  return state;
}
