// Football migration preferences, not nationality quotas. Every destination keeps
// a nonzero weight; annual mobility choices preserve the occasional unusual career.
const COUNTRY_GROUPS = [
  ['England', 'Scotland', 'Wales', 'Northern Ireland', 'Ireland', 'United States', 'Canada', 'Australia', 'New Zealand'],
  ['Spain', 'Mexico', 'Argentina', 'Uruguay', 'Chile', 'Colombia', 'Peru', 'Ecuador', 'Paraguay', 'Bolivia', 'Venezuela', 'Costa Rica', 'Panama', 'Honduras', 'El Salvador', 'Guatemala', 'Cuba', 'Dominican Republic'],
  ['Portugal', 'Brazil', 'Angola', 'Mozambique', 'Cape Verde', 'Guinea-Bissau'],
  ['France', 'Belgium', 'Switzerland', 'Senegal', 'Ivory Coast', 'Cameroon', 'Mali', 'Guinea', 'Algeria', 'Morocco', 'Tunisia', 'DR Congo', 'Gabon'],
  ['Germany', 'Austria', 'Switzerland'],
  ['Netherlands', 'Belgium', 'Suriname'],
  ['Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland'],
  ['Serbia', 'Croatia', 'Bosnia and Herzegovina', 'Montenegro', 'Slovenia', 'North Macedonia'],
  ['Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Bahrain', 'Kuwait', 'Oman', 'Jordan', 'Iraq', 'Egypt', 'Morocco', 'Algeria', 'Tunisia'],
  ['Japan', 'South Korea', 'China'],
  ['England', 'Nigeria', 'Ghana', 'Jamaica', 'South Africa'],
];
const LATIN_AMERICA = new Set([...COUNTRY_GROUPS[1].filter((country) => country !== 'Spain'), 'Brazil']);
const GROUPS_BY_COUNTRY = new Map();
COUNTRY_GROUPS.forEach((countries, index) => countries.forEach((country) => {
  if (!GROUPS_BY_COUNTRY.has(country)) GROUPS_BY_COUNTRY.set(country, new Set());
  GROUPS_BY_COUNTRY.get(country).add(index);
}));

export function countryAffinity(origin, destination, originRegion, destinationRegion) {
  if (origin === destination) return 12;
  const groups = GROUPS_BY_COUNTRY.get(destination);
  if ([...(GROUPS_BY_COUNTRY.get(origin) || [])].some((group) => groups?.has(group))) return 5;
  if (LATIN_AMERICA.has(origin) && LATIN_AMERICA.has(destination)) return 4;
  if (originRegion && originRegion === destinationRegion) return 2;
  return 0.15;
}

export function domesticMobilityChance(rarity) {
  return { common: 0.86, uncommon: 0.80, rare: 0.68, epic: 0.48, legend: 0.36, generational: 0.30 }[rarity] ?? 0.8;
}

// Probability of being available for a move this summer, before buyer/fee checks.
// Tenure is completed seasons, never remaining contract length (renewals do not
// reset it). Individual temperament lets loyal icons and journeymen coexist.
export function eliteDepartureChance({ tenure, topClub, happiness = 70, unhappySeasons = 0,
  migrationPressure = 0, payrollPressure = 1, success = 0, temperament = 0.5, lateCareer = false }) {
  if (tenure < 1) return 0;
  if (tenure === 1) return topClub
    ? (happiness < 25 || payrollPressure > 1.6 ? 0.02 : 0.005)
    : 0.04 + migrationPressure * 0.0015;
  if (unhappySeasons >= 2) return 0.97;
  const discontent = Math.max(0, 60 - happiness) / 60;
  const base = topClub ? 0.055 : 0.12;
  const patience = tenure === 2 ? 0.65 : 1 + Math.min(0.6, (tenure - 3) * 0.12);
  const chance = (base + discontent * 0.36 + migrationPressure * 0.005
    + Math.max(0, payrollPressure - 1.15) * 0.35 + (lateCareer ? 0.07 : 0))
    * patience * (0.65 + temperament * 0.9) / (1 + Math.min(3, success) * 0.3);
  return Math.max(0.02, Math.min(0.92, chance));
}
