import {
  SAVE_KEY,
  START_SEASON,
  LEAGUE_DEFINITIONS,
  NATIONAL_TEAMS,
  COUNTRY_META,
  REGION_ORDER,
  PRIORITY_COUNTRIES,
  STAR_RARITIES,
  CAREER_TYPES,
  CONTINENTAL_DEFINITIONS,
  OWNER_PROFILES,
  COACH_PROFILES,
  COACH_FOCUSES,
  STAFF_RARITIES,
  INTERNATIONAL_COMPETITION_CATALOG,
  RIVALRY_DEFINITIONS
} from './data.js';
import {
  createWorld,
  simulateNextWeek,
  simulateWeeks,
  simulateToSeasonEnd,
  startNextSeason,
  getLeagueTable,
  getCompetitionLeaderboard,
  getPlayerCareer,
  getClubHistory,
  getEntityName,
  getCompetitionName,
  getSeasonLabel,
  getRarityCounts,
  getPlayerTotals,
  getCoachTotals,
  getCoachCareer,
  getCompetitionCoachLeaderboard,
  getAnnualAwardRace,
  getTeamPower,
  getLeagueMarketRankings,
  getClubFinancialStatus,
  upgradeWorld,
  isShowcaseMatchEmbargoed,
  isShowcaseCompetitionEmbargoed
} from './engine.js';
import { playerPortrait as visualPlayerPortrait, coachPortrait as visualCoachPortrait, clubLogoUrls, competitionEmblem } from './visuals.js';

let state = null;
let searchOpen = false;
let clubModalId = null;
let cloudStatus = 'Local autosave ready';
let playerSearch = '';
let playerPositionFilter = 'ALL';
let playerCareerFilter = 'ALL';
let playerStatsScope = 'club';
let playerStatsSort = 'goals';
let playerStatsCompetition = 'ALL';
let competitionStatsPosition = 'ALL';
let competitionStatsSort = 'titles';
let competitionCoachStatsSort = 'titles';
let competitionTeamStatsSort = 'titles';
let coachStatsScope = 'all';
let coachStatsSort = 'titles';
let coachStatsCompetition = 'ALL';
let peopleOriginRegionFilter = 'ALL';
let peopleTeamRegionFilter = 'ALL';
let almanacRegionFilter = 'ALL';
let almanacTeamSort = 'titles';
let almanacPlayerSort = 'totalHonours';
let almanacCoachSort = 'titles';
let magazineRankingCompetition = 'UCL';
let magazineRankingMetric = 'general';
let comparatorType = 'players';
let comparatorIds = [];
let countryTab = 'overview';
let clubRegionFilter = 'ALL';
let clubCountryFilter = 'ALL';
let clubSearch = '';
let rankingsTab = 'clubs';
let leagueRegionFilter = 'ALL';
let offseasonTab = 'summary';
let hallCache = { signature: '', data: null };
let postseasonMatchModalId = null;
let postseasonTickIndex = 0;
let postseasonTimer = null;
let postseasonAnimating = false;
let postseasonPauseReason = null;
let postseasonPenaltyIndex = 0;
let postseasonPlaybackSpeed = 1;
let postseasonAwardTimers = [];
let postseasonAwardAnimating = false;

const APP_VERSION = '3.15';
const DB_NAME = 'football-world-chronicle-v4';
const DB_STORE = 'worlds';
const DB_KEY = 'expanded-world-v4';
const CLOUD_CODE_KEY = 'football-world-cloud-code-v1';
const TABS = ['overview', 'weekly', 'current', 'history', 'stats'];
const PLAYER_TABS = ['overview', 'statistics'];
const PLAYER_PAGE_TABS = ['overview', 'career', 'statistics', 'honours', 'records'];
const CLUB_PAGE_TABS = ['overview','squad','staff','season','history','honours','records','legends','rivalries'];
const COACH_PAGE_TABS = ['overview','career','statistics','honours'];
const CLUB_VISUALS = {
  'Real Madrid': ['#ffffff', '#5f259f', '#d4af37'],
  'Atlético Madrid': ['linear-gradient(90deg,#d71920 0 22%,#ffffff 22% 44%,#d71920 44% 66%,#ffffff 66% 78%,#d71920 78%)', '#102a56', '#102a56'],
  'Athletic Club': ['linear-gradient(90deg,#d71920 0 25%,#ffffff 25% 50%,#d71920 50% 75%,#ffffff 75%)', '#111827', '#d71920'],
  'Valencia': ['#ffffff', '#111827', '#f28c28'],
  'Sevilla': ['#ffffff', '#d71920', '#d71920'],
  'Villarreal': ['#ffe667', '#173b73', '#173b73'],
  'Real Sociedad': ['linear-gradient(90deg,#1d67b1 0 25%,#ffffff 25% 50%,#1d67b1 50% 75%,#ffffff 75%)', '#163a67', '#1d67b1'],
  'Real Betis': ['linear-gradient(90deg,#168f4a 0 25%,#ffffff 25% 50%,#168f4a 50% 75%,#ffffff 75%)', '#0e5b30', '#168f4a'],
  'Manchester City': ['#6cabdd', '#ffffff', '#1c2c5b'],
  'Manchester United': ['#da291c', '#fbe122', '#111111'],
  'Liverpool': ['#c8102e', '#ffffff', '#00b2a9'],
  'Arsenal': ['#ef0107', '#ffffff', '#063672'],
  'Chelsea': ['#034694', '#ffffff', '#dba111'],
  'Tottenham': ['#ffffff', '#132257', '#132257'],
  'Newcastle United': ['linear-gradient(90deg,#111111 0 25%,#ffffff 25% 50%,#111111 50% 75%,#ffffff 75%)', '#111111', '#41b6e6'],
  'Aston Villa': ['#95bfe5', '#670e36', '#670e36'],
  'West Ham': ['#7a263a', '#1bb1e7', '#f3d459'],
  'Everton': ['#003399', '#ffffff', '#ffffff'],
  'Leeds United': ['#ffffff', '#1d428a', '#ffcd00'],
  'Inter': ['linear-gradient(90deg,#0068a8 0 25%,#111111 25% 50%,#0068a8 50% 75%,#111111 75%)', '#ffffff', '#0068a8'],
  'AC Milan': ['linear-gradient(90deg,#fb090b 0 25%,#111111 25% 50%,#fb090b 50% 75%,#111111 75%)', '#ffffff', '#fb090b'],
  'Juventus': ['linear-gradient(90deg,#111111 0 25%,#ffffff 25% 50%,#111111 50% 75%,#ffffff 75%)', '#111111', '#111111'],
  'Napoli': ['#12a0d7', '#ffffff', '#0a6da0'],
  'Roma': ['#8e1f2f', '#f5a623', '#f5a623'],
  'Lazio': ['#87d8f7', '#ffffff', '#ffffff'],
  'Fiorentina': ['#5b2c83', '#ffffff', '#ffffff'],
  'Atalanta': ['linear-gradient(90deg,#1e71b8 0 25%,#111111 25% 50%,#1e71b8 50% 75%,#111111 75%)', '#ffffff', '#1e71b8'],
  'Bayern Munich': ['#dc052d', '#ffffff', '#0066b2'],
  'Borussia Dortmund': ['#fde100', '#111111', '#111111'],
  'Bayer Leverkusen': ['#e32221', '#111111', '#111111'],
  'RB Leipzig': ['#ffffff', '#d50032', '#001e5a'],
  'Eintracht Frankfurt': ['#111111', '#ffffff', '#e1000f'],
  'Paris Saint-Germain': ['#004170', '#ffffff', '#da291c'],
  'Marseille': ['#ffffff', '#2faee0', '#2faee0'],
  'Monaco': ['linear-gradient(135deg,#e30613 0 50%,#ffffff 50%)', '#111111', '#e30613'],
  'Lyon': ['#ffffff', '#1f5aa6', '#e30613'],
  'Lille': ['#d71920', '#ffffff', '#12284b'],
  'Benfica': ['#e10600', '#ffffff', '#f3c32d'],
  'Porto': ['linear-gradient(90deg,#004b9b 0 25%,#ffffff 25% 50%,#004b9b 50% 75%,#ffffff 75%)', '#123b6d', '#004b9b'],
  'Sporting CP': ['linear-gradient(90deg,#168f4a 0 25%,#ffffff 25% 50%,#168f4a 50% 75%,#ffffff 75%)', '#0b5c2e', '#168f4a'],
  'Ajax': ['#ffffff', '#d2122e', '#d2122e'],
  'PSV': ['linear-gradient(90deg,#ed1b24 0 25%,#ffffff 25% 50%,#ed1b24 50% 75%,#ffffff 75%)', '#111111', '#ed1b24'],
  'Feyenoord': ['linear-gradient(90deg,#ffffff 0 50%,#e21b23 50%)', '#111111', '#111111'],
  'Celtic': ['linear-gradient(90deg,#188b45 0 25%,#ffffff 25% 50%,#188b45 50% 75%,#ffffff 75%)', '#0e5b2e', '#188b45'],
  'Rangers': ['#1b458f', '#ffffff', '#e30613'],
  'Anderlecht': ['#5a2390', '#ffffff', '#ffffff'],
  'Galatasaray': ['linear-gradient(90deg,#a90432 0 50%,#fdb912 50%)', '#ffffff', '#a90432'],
  'Fenerbahçe': ['linear-gradient(90deg,#ffed00 0 50%,#002d72 50%)', '#111111', '#002d72'],
  'Beşiktaş': ['#111111', '#ffffff', '#ffffff'],
  'River Plate': ['#ffffff', '#d71920', '#d71920'],
  'Boca Juniors': ['#003b73', '#f9d616', '#f9d616'],
  'Racing Club': ['linear-gradient(90deg,#6ec5e9 0 25%,#ffffff 25% 50%,#6ec5e9 50% 75%,#ffffff 75%)', '#1d4c78', '#6ec5e9'],
  'Independiente': ['#d71920', '#ffffff', '#ffffff'],
  'San Lorenzo': ['linear-gradient(90deg,#1d428a 0 50%,#d71920 50%)', '#ffffff', '#1d428a'],
  'Vélez Sarsfield': ['#ffffff', '#1d4c91', '#1d4c91'],
  'Estudiantes': ['linear-gradient(90deg,#d71920 0 25%,#ffffff 25% 50%,#d71920 50% 75%,#ffffff 75%)', '#111111', '#d71920'],
  'Flamengo': ['linear-gradient(90deg,#d71920 0 50%,#111111 50%)', '#ffffff', '#d71920'],
  'Palmeiras': ['#006437', '#ffffff', '#ffffff'],
  'Botafogo': ['linear-gradient(90deg,#111111 0 25%,#ffffff 25% 50%,#111111 50% 75%,#ffffff 75%)', '#111111', '#111111'],
  'Fluminense': ['linear-gradient(90deg,#7a263a 0 34%,#ffffff 34% 66%,#00843d 66%)', '#ffffff', '#7a263a'],
  'São Paulo': ['#ffffff', '#d71920', '#111111'],
  'Corinthians': ['#ffffff', '#111111', '#111111'],
  'Grêmio': ['linear-gradient(90deg,#5bb8e8 0 34%,#111111 34% 66%,#ffffff 66%)', '#111111', '#5bb8e8'],
  'Internacional': ['#d71920', '#ffffff', '#ffffff'],
  'Santos': ['#ffffff', '#111111', '#111111'],
  'Club América': ['#fff200', '#123a7a', '#d71920'],
  'Tigres UANL': ['#f5c400', '#1d3f73', '#1d3f73'],
  'Monterrey': ['linear-gradient(90deg,#1d3f73 0 25%,#ffffff 25% 50%,#1d3f73 50% 75%,#ffffff 75%)', '#1d3f73', '#1d3f73'],
  'Cruz Azul': ['#1755a3', '#ffffff', '#e31b23'],
  'Guadalajara': ['linear-gradient(90deg,#d71920 0 34%,#ffffff 34% 66%,#1d3f73 66%)', '#111111', '#1d3f73'],
  'Kawasaki Frontale': ['#62b5e5', '#111111', '#111111'],
  'Yokohama F. Marinos': ['#1d4f91', '#ffffff', '#d71920'],
  'Vissel Kobe': ['#8b1e3f', '#ffffff', '#111111'],
  'Urawa Red Diamonds': ['#e60012', '#ffffff', '#111111'],
  'Kashima Antlers': ['#b5122b', '#ffffff', '#002b49'],
  'Sanfrecce Hiroshima': ['#5b2c83', '#ffffff', '#ffffff'],
  'Gamba Osaka': ['linear-gradient(90deg,#1d4f91 0 50%,#111111 50%)', '#ffffff', '#1d4f91'],
  'Cerezo Osaka': ['#e85a9b', '#111111', '#1d4f91'],
  'FC Tokyo': ['linear-gradient(90deg,#1d4f91 0 50%,#e60012 50%)', '#ffffff', '#1d4f91'],
  'Nagoya Grampus': ['#d71920', '#f3c32d', '#f3c32d']
};

function openSaveDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadState() {
  try {
    const db = await openSaveDatabase();
    const saved = await new Promise((resolve, reject) => {
      const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(DB_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (saved?.version === 4 && saved.current?.internationalCompetitions && saved.current?.continentalCompetitions) return upgradeWorld(saved);
  } catch (error) {
    console.warn('IndexedDB load unavailable.', error);
  }
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 4) return upgradeWorld(parsed);
    }
  } catch (error) {
    console.warn('Fallback save unavailable.', error);
  }
  return createWorld(7262001);
}

async function saveState() {
  try {
    const db = await openSaveDatabase();
    await new Promise((resolve, reject) => {
      const request = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(state, DB_KEY);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch (error) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (_) {
      console.warn('Local save failed.', error);
    }
  }
}

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
const fmt = (value) => new Intl.NumberFormat('en-US').format(value || 0);
const money = (value) => `$${Number(value || 0).toFixed(1)}m`;
const dateLabel = (value) => new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', timeZone: 'UTC'
}).format(new Date(`${value}T12:00:00Z`));
const clubById = (id) => state.clubs.find((club) => club.id === id);
const playerById = (id) => state.players.find((player) => player.id === id);
const nationalById = (id) => state.nationalTeams.find((team) => team.id === id);
const ownerById = (id) => state.owners?.find((owner) => owner.id === id);
const coachById = (id) => state.coaches?.find((coach) => coach.id === id);
const leagueDef = (id) => LEAGUE_DEFINITIONS.find((league) => league.id === id);
const leagueCountry = (country) => LEAGUE_DEFINITIONS.find((league) => league.country === country);

function countryMeta(value) {
  if (COUNTRY_META[value]) return COUNTRY_META[value];
  const team = NATIONAL_TEAMS.find((item) => item.id === value);
  return team ? COUNTRY_META[team.name] : null;
}

function countryName(value) {
  if (COUNTRY_META[value]) return value;
  return NATIONAL_TEAMS.find((item) => item.id === value)?.name || value;
}

function regionForNationality(value) {
  const name = countryName(value);
  return COUNTRY_META[name]?.region || NATIONAL_TEAMS.find((team) => team.id === value)?.region || 'Other';
}

function regionOptions(selected, includeAll = true) {
  return `${includeAll ? `<option value="ALL">All regions</option>` : ''}${REGION_ORDER.map((region) => `<option value="${region}" ${selected === region ? 'selected' : ''}>${region}</option>`).join('')}`;
}

function matchesRegion(nationality, selected = 'ALL') {
  return selected === 'ALL' || regionForNationality(nationality) === selected;
}

function subdivisionFlag(tag) {
  return String.fromCodePoint(0x1f3f4, ...[...tag].map((char) => 0xe0000 + char.charCodeAt(0)), 0xe007f);
}

function flagEmoji(iso2, fallback) {
  const special = {
    'gb-eng': subdivisionFlag('gbeng'),
    'gb-sct': subdivisionFlag('gbsct'),
    'gb-wls': subdivisionFlag('gbwls')
  };
  if (special[iso2]) return special[iso2];
  if (/^[a-z]{2}$/i.test(iso2 || '')) return [...iso2.toUpperCase()].map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join('');
  return fallback;
}

function flag(value, size = 'sm') {
  const meta = countryMeta(value);
  const name = countryName(value);
  const fallback = (meta?.code || String(value)).slice(0, 3).toUpperCase();
  let iso = String(meta?.iso2 || '').toLowerCase();
  if (iso === 'gb-nir') iso = 'gb';
  const url = iso ? `https://flagcdn.com/${iso}.svg` : '';
  return `<span class="country-flag country-flag-${size}" title="${esc(name)}" role="img" aria-label="${esc(name)} flag"><span class="flag-fallback">${esc(fallback)}</span>${url ? `<img data-flag-image src="${url}" alt="" loading="lazy">` : ''}</span>`;
}

function crest(id, size = 'md') {
  const club = clubById(id);
  const initials = (club?.name || id).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const visual = club ? CLUB_VISUALS[club.name] : null;
  const style = visual
    ? `--crest-bg:${visual[0]};--crest-ink:${visual[1]};--crest-border:${visual[2]}`
    : `--crest-bg:hsl(${club?.crestHue ?? 210},60%,42%);--crest-ink:#fff;--crest-border:hsla(${club?.crestHue ?? 210},60%,28%,.55)`;
  const logos = clubLogoUrls(club);
  const logo = logos[0] || '';
  const alternatives = logos.slice(1).join('|');
  return `<span class="crest crest-${size} ${logo ? 'crest-with-logo' : ''}" style="${style}" title="${esc(club?.name || id)}"><span class="crest-fallback">${esc(initials)}</span>${logo ? `<img data-club-logo src="${logo}" data-logo-alts="${esc(alternatives)}" alt="" loading="lazy" decoding="async">` : ''}</span>`;
}

function playerPortrait(player, size = 'md') {
  return visualPlayerPortrait(player, countryName(player?.nationality), size);
}

function coachPortrait(coach, size = 'md') {
  return visualCoachPortrait(coach, countryName(coach?.nationality), size);
}

function rarityBadge(rarity) {
  const data = STAR_RARITIES[rarity] || STAR_RARITIES.common;
  return `<span class="rarity-badge rarity-${esc(rarity)}">${esc(data.label)}</span>`;
}

function staffRarityBadge(rarity) {
  const data = STAFF_RARITIES[rarity] || STAFF_RARITIES.common;
  return `<span class="rarity-badge rarity-${esc(rarity)}">${esc(data.label)}</span>`;
}

function teamLink(id, isInternational = false) {
  const name = getEntityName(state, id, isInternational);
  if (isInternational) return `<a class="entity-link" href="#/nation/${esc(id)}/overview">${flag(id)}<span>${esc(name)}</span></a>`;
  return `<a class="entity-link" href="#/club/${esc(id)}/overview">${crest(id, 'sm')}<span>${esc(name)}</span></a>`;
}

function ownerLink(id) {
  const owner = ownerById(id);
  if (!owner) return '<span class="muted">Vacant</span>';
  return `<a class="player-link" href="#/owner/${esc(id)}/overview">${flag(owner.nationality, 'xs')}<span>${esc(owner.name)}</span></a>`;
}

function playerLink(id, withFlag = true) {
  const player = playerById(id);
  if (!player) return '<span class="muted">Unnamed</span>';
  return `<a class="player-link" href="#/player/${esc(id)}/overview">${withFlag ? flag(player.nationality, 'xs') : ''}<span>${esc(player.name)}</span></a>`;
}

function coachLink(id, withFlag = true) {
  const coach = coachById(id);
  if (!coach) return '<span class="muted">Vacant</span>';
  return `<a class="player-link coach-link" href="#/coach/${esc(id)}">${withFlag ? flag(coach.nationality, 'xs') : ''}<span>${esc(coach.name)}</span></a>`;
}

function coachJob(coach) {
  if (!coach) return '<span class="muted">Free agent</span>';
  if (coach.status === 'retired') return '<span class="muted">Retired</span>';
  if (coach.clubId) return teamLink(coach.clubId, false);
  if (coach.nationalTeamId) return teamLink(coach.nationalTeamId, true);
  return '<span class="muted">Free agent</span>';
}

const competitionLabel = (id) => getCompetitionName(state, id);

function route() {
  const [page, id, tab, sub] = (location.hash.replace(/^#\/?/, '') || 'world').split('/');
  return { page, id, tab, sub };
}

function icon(name) {
  const icons = {
    home: '⌂', world: '◎', awards: '★', region: '◈', intl: '◉', trophy: '◆', reset: '↺',
    menu: '☰', search: '⌕', other: '…', players: '●', archive: '▤',
    transfer: '⇄', cloud: '☁', load: '⇩', save: '⇧'
  };
  return `<span class="nav-icon">${icons[name] || '•'}</span>`;
}

function navLink(href, label, iconName, active, child = false) {
  return `<a href="${href}" class="nav-link ${child ? 'nav-child' : ''} ${active ? 'active' : ''}"${active ? ' aria-current="page"' : ''}>${icon(iconName)}<span>${esc(label)}</span></a>`;
}

function countryNav(country, currentRoute) {
  const league = leagueCountry(country);
  if (!league) return '';
  const cup = `CUP-${league.id}`;
  const countryRoute = decodeURIComponent(currentRoute.id || '');
  const active = (currentRoute.page === 'country' && countryRoute === country)
    || (currentRoute.page === 'league' && currentRoute.id === league.id)
    || (currentRoute.page === 'competition' && currentRoute.id === cup)
    || (currentRoute.page === 'competition' && currentRoute.id === `SC-${league.id}`);
  return `<details class="country-nav" ${active ? 'open' : ''}>
    <summary>${flag(country)}<b>${esc(country)}</b><i>›</i></summary>
    ${navLink(`#/country/${encodeURIComponent(country)}/overview`, 'Country', 'region', currentRoute.page === 'country' && countryRoute === country, true)}
    ${navLink(`#/league/${league.id}/overview`, league.name, 'trophy', currentRoute.page === 'league' && currentRoute.id === league.id, true)}
    ${navLink(`#/competition/${cup}/overview`, league.cupName, 'trophy', currentRoute.page === 'competition' && currentRoute.id === cup, true)}
    ${state.current.superCups?.[`SC-${league.id}`] ? navLink(`#/competition/SC-${league.id}/overview`, state.current.superCups[`SC-${league.id}`].name, 'trophy', currentRoute.page === 'competition' && currentRoute.id === `SC-${league.id}`, true) : ''}
  </details>`;
}

function internationalNav(currentRoute) {
  const comps = Object.values(state.current.internationalCompetitions || {}).filter((comp) => !comp.friendly);
  const active = currentRoute.page === 'international' || (currentRoute.page === 'competition' && (INTERNATIONAL_COMPETITION_CATALOG.some((comp) => comp.id === currentRoute.id) || comps.some((comp) => comp.id === currentRoute.id))) || currentRoute.page === 'nation';
  return `<details class="country-nav" ${active ? 'open' : ''}>
    <summary><span class="nav-globe">🌐</span><b>International Football</b><i>›</i></summary>
    ${navLink('#/international/overview', 'Overview & nations', 'intl', currentRoute.page === 'international' && currentRoute.id !== 'competitions', true)}
    ${navLink('#/international/competitions', 'Competitions', 'trophy', currentRoute.page === 'international' && currentRoute.id === 'competitions', true)}
  </details>`;
}

function sidebar(currentRoute) {
  const favoriteClubs = (state.preferences.favoriteClubIds || []).map((id) => clubById(id)).filter(Boolean).slice(0, 4);
  const favoritePlayers = (state.preferences.favoritePlayerIds || []).map((id) => playerById(id)).filter(Boolean).slice(0, 4);
  const favoriteCoaches = (state.preferences.favoriteCoachIds || []).map((id) => coachById(id)).filter(Boolean).slice(0, 3);
  const favoriteNations = (state.preferences.favoriteNationIds || []).map((id) => nationalById(id)).filter(Boolean).slice(0, 3);
  const favoriteCompetitions = (state.preferences.favoriteCompetitionIds || []).slice(0, 4);
  const hasFavorites = favoriteClubs.length || favoritePlayers.length || favoriteCoaches.length || favoriteNations.length || favoriteCompetitions.length;
  const favorites = hasFavorites ? `<div class="nav-section-label">Following</div>
    ${favoriteClubs.map((club) => navLink(`#/club/${club.id}/overview`, club.name, 'trophy', currentRoute.page === 'club' && currentRoute.id === club.id, true)).join('')}
    ${favoritePlayers.map((player) => navLink(`#/player/${player.id}/overview`, player.name, 'players', currentRoute.page === 'player' && currentRoute.id === player.id, true)).join('')}
    ${favoriteCoaches.map((coach) => navLink(`#/coach/${coach.id}/overview`, coach.name, 'players', currentRoute.page === 'coach' && currentRoute.id === coach.id, true)).join('')}
    ${favoriteNations.map((nation) => navLink(`#/nation/${nation.id}/overview`, nation.name, 'intl', currentRoute.page === 'nation' && currentRoute.id === nation.id, true)).join('')}
    ${favoriteCompetitions.map((id) => navLink(`#/competition/${id}/overview`, competitionLabel(id), 'trophy', currentRoute.page === 'competition' && currentRoute.id === id, true)).join('')}` : '';
  return `<aside class="sidebar" id="sidebar">
    <div class="brand-block"><div class="brand-mark">FW</div><div><div class="brand-title">Football World</div><div class="brand-subtitle">Chronicle</div></div><button class="sidebar-close" data-action="close-menu" aria-label="Close navigation">×</button></div>
    <nav id="sidebar-nav" class="sidebar-nav" aria-label="Main navigation">
      <div class="nav-section-label">Universe</div>
      ${navLink('#/world', 'World', 'world', currentRoute.page === 'world')}
      ${navLink('#/magazine/results', 'Magazine', 'archive', currentRoute.page === 'magazine')}
      ${navLink('#/competitions', 'Competitions', 'trophy', ['competitions','league','competition','country','region'].includes(currentRoute.page))}
      ${navLink('#/clubs', 'Clubs', 'trophy', currentRoute.page === 'clubs' || currentRoute.page === 'club')}
      ${navLink('#/people/players/overview', 'People', 'players', ['people','players','player','coach','owner'].includes(currentRoute.page))}
      ${navLink('#/international/overview', 'International', 'intl', ['international','nation'].includes(currentRoute.page))}
      ${navLink('#/rankings/clubs', 'Rankings', 'region', currentRoute.page === 'rankings')}
      ${navLink('#/almanac/champions', 'History', 'archive', currentRoute.page === 'almanac')}
      <div class="nav-section-label">Season</div>
      ${navLink('#/postseason/setup', 'Postseason Showcase', 'trophy', currentRoute.page === 'postseason')}
      ${navLink('#/awards/current', 'Annual Awards', 'awards', currentRoute.page === 'awards')}
      ${navLink('#/transfers', 'Transfer Market', 'transfer', currentRoute.page === 'transfers')}
      ${navLink('#/offseason', 'Offseason', 'archive', currentRoute.page === 'offseason')}
      ${favorites}
    </nav>
    <div class="sidebar-foot">
      <div class="cloud-button-grid">
        <button class="ghost-button" data-action="cloud-save">${icon('save')} Save cloud</button>
        <button class="ghost-button" data-action="cloud-load">${icon('load')} Load cloud</button>
      </div>
      <button class="ghost-button full cloud-code-button" data-action="cloud-code">${icon('cloud')} Cloud code</button>
      <button class="ghost-button full reset-button" data-action="reset-world">${icon('reset')} Reset universe</button>
      <div class="save-note"><span class="build-chip">v${APP_VERSION}</span>${esc(cloudStatus)}</div>
    </div>
  </aside>`;
}

function topbar() {
  const postseasonPending = state.current.completed && state.current.postseason?.prepared && !state.current.postseason?.completed;
  const seasonControls = state.current.completed
    ? postseasonPending
      ? `<span class="season-complete-chip">Showcase pending</span><button class="primary-button season-end-button" data-action="open-postseason">${icon('trophy')}<span>Open Postseason</span></button>`
      : `<span class="season-complete-chip">Season archived</span><button class="primary-button season-end-button" data-action="next-season">Run offseason · ${getSeasonLabel(state.season + 1)}</button>`
    : `<button class="control-button" data-action="simulate-week">${icon('archive')}<span>+1 Week</span></button><button class="control-button" data-action="simulate-month">${icon('archive')}<span>+4 Weeks</span></button><button class="primary-button season-end-button" data-action="simulate-season">${icon('trophy')}<span>To End-of-Season Showcase</span></button>`;
  return `<header class="topbar premium-topbar">
    <div class="topbar-main-row">
      <div class="topbar-branding">
        <a class="topbar-logo-lockup" href="#/world" aria-label="Football World Chronicle home">
          <span class="topbar-logo-line topbar-logo-main">Football World</span>
          <span class="topbar-logo-line topbar-logo-accent">Chronicle</span>
        </a>
        <span class="topbar-slogan">A World of Football</span>
      </div>
      <div class="date-block"><div class="date-kicker">${esc(state.current.seasonLabel)} · Week ${state.current.week}</div><div class="date-main">${dateLabel(state.current.date)}</div></div>
      <div class="topbar-utilities">
        <a class="mobile-home-button" href="#/world" aria-label="Go to world home">${icon('home')}<span>Home</span></a>
        <button class="menu-button" data-action="toggle-menu" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">${icon('menu')}<span>Menu</span></button>
        <button class="cloud-save-top" data-action="cloud-save">${icon('cloud')}<span>Save</span></button>
        <button class="search-button" data-action="toggle-search">${icon('search')}<span>Search</span></button>
      </div>
    </div>
    <div class="topbar-sim-row"><div class="sim-controls">${seasonControls}</div></div>
  </header>`;
}

const sectionMonogram = (kicker = '', title = '') => {
  const key = `${kicker} ${title}`.toUpperCase();
  if (key.includes('PLAYER')) return 'PLY';
  if (key.includes('COACH')) return 'COA';
  if (key.includes('PEOPLE')) return 'PPL';
  if (key.includes('CLUB')) return 'CLB';
  if (key.includes('COUNTRY')) return 'CNT';
  if (key.includes('NATIONAL')) return 'INT';
  if (key.includes('COMPETITION')) return 'CUP';
  if (key.includes('MAGAZINE')) return 'MAG';
  if (key.includes('AWARD')) return 'AWD';
  if (key.includes('OFFSEASON')) return 'OFF';
  if (key.includes('HISTORY')) return 'ARC';
  if (key.includes('WORLD')) return 'WRLD';
  return 'FWC';
};

const pageHead = (kicker, title, copy = '') => `<div class="page-head premium-page-head"><div class="page-head-copy"><div class="page-head-chip-row"><div class="eyebrow">${esc(kicker)}</div><span class="page-head-chip">${esc(state.current.seasonLabel || `Year ${state.season - 1999}`)}</span></div><h1>${esc(title)}</h1>${copy ? `<p>${esc(copy)}</p>` : ''}</div><div class="page-head-mark" aria-hidden="true"><b>${sectionMonogram(kicker, title)}</b></div></div>`;

const statCard = (label, value, note = '') => `<div class="stat-card"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div>${note ? `<div class="stat-note">${note}</div>` : ''}</div>`;

function favoriteButton(type, id) {
  const key = type === 'club' ? 'favoriteClubIds' : type === 'player' ? 'favoritePlayerIds' : type === 'coach' ? 'favoriteCoachIds' : type === 'nation' ? 'favoriteNationIds' : 'favoriteCompetitionIds';
  const followed = (state.preferences?.[key] || []).includes(id);
  return `<button class="follow-button ${followed ? 'active' : ''}" data-action="toggle-favorite" data-type="${esc(type)}" data-id="${esc(id)}"><span class="follow-star">${followed ? '★' : '☆'}</span><span>${followed ? 'Following' : 'Follow'}</span></button>`;
}

function entityTabs(base, tabs, active) {
  return `<nav class="competition-tabs entity-tabs">${tabs.map(([id,label])=>`<a href="${base}/${id}" class="${active===id?'active':''}">${esc(label)}</a>`).join('')}</nav>`;
}

function matchRow(match, compact = false) {
  const penalties = match.penalties ? ` (${match.penalties.home}-${match.penalties.away} pens)` : '';
  const goals = (match.goalEvents || []).map((goal) => {
    const scorer = playerById(goal.scorerId);
    return scorer ? `${esc(scorer.name)} ${goal.minute}'` : '';
  }).filter(Boolean).slice(0, 5).join(' · ');
  return `<div class="match-row ${compact ? 'compact' : ''}">
    <div class="match-meta"><span>W${match.week}</span><small>${esc(match.stage || match.competitionName)}</small></div>
    <div class="match-team home">${teamLink(match.homeId, match.isInternational)}</div>
    <div class="match-score"><strong>${match.homeGoals}</strong><span>–</span><strong>${match.awayGoals}</strong><small>${penalties}</small></div>
    <div class="match-team away">${teamLink(match.awayId, match.isInternational)}</div>
    <div class="match-star">${match.manOfMatchId ? playerLink(match.manOfMatchId) : ''}${goals ? `<small>${goals}</small>` : ''}</div>
  </div>`;
}

function leaders(id, metric = 'goals', limit = 8, position = null) {
  let rows = getCompetitionLeaderboard(state, id, metric);
  if (position) rows = rows.filter((stat) => playerById(stat.playerId)?.position === position);
  rows = rows.slice(0, limit);
  if (!rows.length) return '<div class="empty-state compact">The race begins once matches are played.</div>';
  return rows.map((stat, index) => {
    const player = playerById(stat.playerId);
    const value = metric === 'rating' ? stat.averageRating.toFixed(2) : stat[metric];
    const team = stat.isInternational ? getEntityName(state, stat.teamId, true) : clubById(stat.teamId)?.name;
    return `<div class="leader-row"><span class="rank">${index + 1}</span><div class="leader-person"><strong>${playerLink(player.id)}</strong><small>${esc(team || 'Free agent')} · ${player.position} · ${esc(player.roleLabel)}</small></div><div class="leader-value">${value}</div></div>`;
  }).join('');
}

function tabs(base, active = 'overview') {
  const labels = { overview: 'Overview', weekly: 'Weekly View', current: 'Current Season', history: 'History', stats: 'Stats' };
  return `<nav class="competition-tabs">${TABS.map((tab) => `<a href="${base}/${tab}" class="${active === tab ? 'active' : ''}">${labels[tab]}</a>`).join('')}</nav>`;
}

function descriptor(id) {
  const league = state.current.leagues[id];
  if (league) return { id, type: 'league', name: league.name, country: league.country, object: league };
  if (state.current.domesticCups?.[id]) { const cup = state.current.domesticCups[id]; return { id, type: 'cup', name: cup.name, country: cup.country, object: cup }; }
  if (state.current.superCups?.[id]) { const cup = state.current.superCups[id]; return { id, type: 'cup', name: cup.name, country: cup.country, object: cup }; }
  if (state.current.globalClubCompetitions?.[id]) { const comp = state.current.globalClubCompetitions[id]; return { id, type: 'global', name: comp.name, country: 'World', object: comp }; }
  if (state.current.continentalCompetitions?.[id]) { const comp = state.current.continentalCompetitions[id]; return { id, type: 'continental', name: comp.name, country: comp.confederation, object: comp }; }
  if (state.current.internationalCompetitions?.[id]) { const comp = state.current.internationalCompetitions[id]; return { id, type: 'international', name: comp.name, country: comp.confederation, object: comp }; }
  const catalog = INTERNATIONAL_COMPETITION_CATALOG.find((item) => item.id === id);
  if (catalog) return { id, type: 'international', name: catalog.name, country: catalog.confederation, object: { id, name: catalog.name, confederation: catalog.confederation, stage: 'Inactive', groups: [], completed: false, inactive: true } };
  return null;
}

function latestSeasonSummary() {
  const review = [...(state.history.seasonReviews || [])].sort((a, b) => b.season - a.season)[0];
  if (!review || !state.current.completed) return '';
  const winners = (review.competitionWinners || []).filter((winner) => !(review.season === state.season && isShowcaseCompetitionEmbargoed(state, winner.competitionId)));
  const ceremonyPending = Boolean(state.current.postseason?.prepared && !state.current.postseason?.completed);
  const ballon = ceremonyPending ? null : playerById(review.ballonDorPlayerId);
  const goldenBoot = ceremonyPending ? null : playerById(review.goldenBootPlayerId);
  return `<section class="panel season-summary section-gap"><div class="panel-head"><div><span class="eyebrow">SEASON SUMMARY</span><h3>${esc(review.seasonLabel)} at a glance</h3></div><span class="panel-chip">Archived</span></div><div class="season-summary-grid">${winners.map((winner) => `<div class="season-summary-row"><span>${esc(winner.competitionName)}</span>${teamLink(winner.winnerId, winner.isInternational)}</div>`).join('')}</div><div class="season-award-strip"><div><span>BALLON D'OR</span>${ballon ? playerLink(ballon.id) : ceremonyPending ? '<strong>Awards Night pending</strong>' : '<strong>—</strong>'}</div><div><span>WORLD GOLDEN BOOT</span>${goldenBoot ? playerLink(goldenBoot.id) : ceremonyPending ? '<strong>Awards Night pending</strong>' : '<strong>—</strong>'}</div></div></section>`;
}


function followingPanel() {
  const items = [];
  for (const id of state.preferences.favoriteClubIds || []) { const club=clubById(id); if(club){const table=getLeagueTable(state,club.leagueId);const pos=table.findIndex((r)=>r.teamId===id)+1; items.push(`<a href="#/club/${id}/overview">${crest(id,'sm')}<div><strong>${esc(club.name)}</strong><small>${pos?`#${pos} ${esc(competitionLabel(club.leagueId))}`:esc(club.country)} · Power ${Math.round(getTeamPower(state,id,false))}</small></div></a>`);} }
  for (const id of state.preferences.favoritePlayerIds || []) { const player=playerById(id); if(player){const totals=getPlayerTotals(state,id,'club'); items.push(`<a href="#/player/${id}/overview">${playerPortrait(player,'sm')}<div><strong>${esc(player.name)}</strong><small>${flag(player.nationality,'xs')} ${player.clubId?esc(clubById(player.clubId)?.name):'Free agent'} · ${totals.goals} career goals · ${player.rating}</small></div></a>`);} }
  for (const id of state.preferences.favoriteCoachIds || []) { const coach=coachById(id); if(coach) items.push(`<a href="#/coach/${id}/overview">${coachPortrait(coach,'sm')}<div><strong>${esc(coach.name)}</strong><small>${flag(coach.nationality,'xs')} ${coach.clubId?esc(clubById(coach.clubId)?.name):coach.nationalTeamId?esc(nationalById(coach.nationalTeamId)?.name):coach.status==='retired'?'Retired':'Free agent'} · Quality ${coach.quality}</small></div></a>`); }
  for (const id of state.preferences.favoriteNationIds || []) { const nation=nationalById(id); if(nation) items.push(`<a href="#/nation/${id}/overview">${flag(id,'xs')}<div><strong>${esc(nation.name)}</strong><small>${esc(nation.region)} · Strength ${nation.strength}</small></div></a>`); }
  if (!items.length) return '';
  return `<section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">FOLLOWING</span><h3>Your football world</h3></div><span class="muted">Pinned clubs, people and nations</span></div><div class="following-grid">${items.slice(0,12).join('')}</div></section>`;
}

function worldPage() {
  const active = state.players.filter((player) => player.status === 'active').length;
  const rarities = getRarityCounts(state);
  const transferCount = state.current.transfers?.length || 0;
  const internationalNames = Object.values(state.current.internationalCompetitions || {}).map((competition) => competition.name).join(', ');
  return `${pageHead('THE UNIVERSE', 'World football', 'A persistent football history beginning in Year 1, with 137 domestic systems, promotion and relegation, continental and global club tournaments, international football and evolving staff and player careers.')}
    <section class="hero-panel">
      <div class="hero-copy"><span class="hero-pill">${NATIONAL_TEAMS.length} NATIONAL TEAMS · ${LEAGUE_DEFINITIONS.filter((league) => league.tier === 'detailed').length} FULL LEAGUES · ${LEAGUE_DEFINITIONS.filter((league) => league.tier === 'summary').length} SUMMARY LEAGUES</span><h2>One connected football world, from a weekly league match to the Ballon d'Or.</h2><p>${esc(internationalNames)} run beside domestic and continental football. Current-season match detail is archived into compact permanent statistics every summer.</p><div class="season-progress"><div class="season-progress-fill" style="width:${Math.min(100, Math.round(state.current.week / 52 * 100))}%"></div></div><div class="progress-label"><span>Opening market</span><strong>Week ${state.current.week} of 52</strong><span>Season archive</span></div></div>
      <div class="hero-metrics">${statCard('Clubs', fmt(state.clubs.length), 'Visible football organizations')}${statCard('Active stars', fmt(active), 'Named career players')}${statCard('International teams', fmt(NATIONAL_TEAMS.length), 'Six confederations')}${statCard('Transfers', fmt(transferCount), 'This opening market')}</div>
    </section>${latestSeasonSummary()}${followingPanel()}
    <div class="rarity-ribbon section-gap">
      ${['generational', 'legend', 'epic', 'rare', 'uncommon', 'common'].map((rarity) => `<div>${rarityBadge(rarity)}<strong>${fmt(rarities[rarity] || 0)}</strong></div>`).join('')}
    </div>
    <div class="region-grid section-gap">${REGION_ORDER.map((region) => {
      const leagues = LEAGUE_DEFINITIONS.filter((league) => league.confederation === region);
      const nations = NATIONAL_TEAMS.filter((team) => team.region === region).length;
      return `<a class="region-card" href="${leagues.length ? `#/region/${encodeURIComponent(region)}` : '#/international'}"><span>◈</span><div><h3>${esc(region)}</h3><p>${leagues.length} domestic systems · ${nations} national teams</p></div><b>›</b></a>`;
    }).join('')}</div>
    <div class="two-column section-gap">
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">WORLD FOOTBALL MAGAZINE</span><h3><a href="#/magazine/results">Latest stories</a></h3></div><span class="panel-chip">Week ${state.current.week}</span></div><div class="story-list">${publicNewsRows().slice(0, 8).map((story, index) => `<article class="story-card ${story.importance} ${index === 0 ? 'lead' : ''}"><div class="story-category">${esc(story.category)}</div><h4>${esc(story.headline)}</h4><p>${esc(story.body)}</p>${story.entityType === 'player' && story.entityId ? `<a href="#/player/${esc(story.entityId)}/overview">Open player →</a>` : ''}</article>`).join('')}</div></section>
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">OPENING MARKET</span><h3>Major moves</h3></div><a href="#/transfers">All transfers</a></div>${transferList(state.current.transfers.slice(-12).reverse(), true)}</section>
    </div>`;
}

function regionPage(regionRaw) {
  const region = decodeURIComponent(regionRaw || '');
  const leagues = LEAGUE_DEFINITIONS.filter((league) => league.confederation === region);
  if (!leagues.length) return notFound();
  const continental = CONTINENTAL_DEFINITIONS.filter((competition) => competition.confederation === region);
  return `${pageHead('REGIONAL FOOTBALL', region, `${leagues.length} domestic systems, ${continental.length} continental club competitions and ${NATIONAL_TEAMS.filter((team) => team.region === region).length} national teams.`)}
    ${continental.length ? `<div class="country-competition-grid">${continental.map((competition) => {
      const current = state.current.continentalCompetitions?.[competition.id];
      return `<a class="competition-country-card" href="#/competition/${competition.id}/overview">${competitionEmblem(competition.id, 'md')}<div><span>CONTINENTAL LEVEL ${competition.level}</span><h3>${esc(competition.name)}</h3><p>${isShowcaseCompetitionEmbargoed(state, competition.id) ? 'Showcase result pending' : current?.championId ? `${esc(clubById(current.championId)?.name)} are champions` : current?.stage || 'Season ready'}</p></div><b>›</b></a>`;
    }).join('')}</div>` : ''}
    <div class="world-grid section-gap">${leagues.map((league) => {
      const table = getLeagueTable(state, league.id);
      return `<a class="world-card" href="#/country/${encodeURIComponent(league.country)}"><div class="world-card-head">${flag(league.country, 'md')}<span class="tier-chip ${league.tier}">${league.tier === 'detailed' ? 'full pyramid' : 'summary'}</span></div><h3>${esc(league.country)}</h3><p>${esc(league.name)} · ${league.activeCount} top-flight clubs${league.reserveCount ? ` + ${league.reserveCount} promotion clubs` : ''}</p><div class="world-card-stats"><div><strong>${table[0]?.points || 0}</strong><span>LEADER POINTS</span></div><div><strong>${league.clubs.length}</strong><span>VISIBLE CLUBS</span></div></div></a>`;
    }).join('')}</div>`;
}


function allCompetitionCatalog() {
  const rows = [];
  for (const league of LEAGUE_DEFINITIONS) {
    rows.push({ id: league.id, name: league.name, type: 'League', region: league.confederation, country: league.country, href: `#/league/${league.id}/overview` });
    rows.push({ id: `CUP-${league.id}`, name: league.cupName, type: 'Cup', region: league.confederation, country: league.country, href: `#/competition/CUP-${league.id}/overview` });
    const superCup = state.current.superCups?.[`SC-${league.id}`];
    if (superCup) rows.push({ id: superCup.id, name: superCup.name, type: 'Super Cup', region: league.confederation, country: league.country, href: `#/competition/${superCup.id}/overview` });
  }
  for (const competition of CONTINENTAL_DEFINITIONS) rows.push({ id: competition.id, name: competition.name, type: 'Continental', region: competition.confederation, country: null, href: `#/competition/${competition.id}/overview` });
  for (const competition of Object.values(state.current.globalClubCompetitions || {})) rows.push({ id: competition.id, name: competition.name, type: 'Global Club', region: 'World', country: null, href: `#/competition/${competition.id}/overview` });
  const ids = new Set(rows.map((row) => row.id));
  for (const competition of INTERNATIONAL_COMPETITION_CATALOG) if (!ids.has(competition.id)) rows.push({ id: competition.id, name: competition.name, type: 'International', region: competition.confederation || 'World', country: null, href: `#/competition/${competition.id}/overview` });
  return rows;
}

function competitionsHubPage() {
  const flagship = ['WC','UCL','LIB','EURO','COPA','UEL','UECL','CWC','CCC','ACL','CAFCL'].map((id) => allCompetitionCatalog().find((row) => row.id === id)).filter(Boolean);
  return `${pageHead('COMPETITION DIRECTORY','Competitions','Browse the football world by tournament or country without carrying 137 countries in the main navigation.')}
    <section class="panel"><div class="panel-head"><div><span class="eyebrow">FLAGSHIP COMPETITIONS</span><h3>Global stage</h3></div></div><div class="quick-link-grid">${flagship.map((row)=>`<a class="quick-link-card" href="${row.href}"><span>${esc(row.type)}</span><strong>${esc(row.name)}</strong><small>${esc(row.region)}</small></a>`).join('')}</div></section>
    <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">COUNTRIES</span><h3>Domestic football</h3></div><span class="muted">Open a country for overview, teams and history</span></div><div class="country-browser">${REGION_ORDER.map((region)=>`<div class="country-browser-region"><h4>${esc(region)}</h4><div>${LEAGUE_DEFINITIONS.filter((league)=>league.confederation===region).map((league)=>`<a href="#/country/${encodeURIComponent(league.country)}/overview">${flag(league.country,'xs')}<span>${esc(league.country)}</span><small>${esc(league.name)}</small></a>`).join('')}</div></div>`).join('')}</div></section>
    <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">CONTINENTAL FOOTBALL</span><h3>Confederation competitions</h3></div></div><div class="quick-link-grid">${CONTINENTAL_DEFINITIONS.map((row)=>`<a class="quick-link-card" href="#/competition/${row.id}/overview"><span>${esc(row.confederation)}</span><strong>${esc(row.name)}</strong><small>Level ${row.level}</small></a>`).join('')}</div></section>`;
}

function clubsHubPage() {
  const countries = LEAGUE_DEFINITIONS.filter((league)=>clubRegionFilter==='ALL'||league.confederation===clubRegionFilter).map((league)=>league.country);
  if (clubCountryFilter !== 'ALL' && !countries.includes(clubCountryFilter)) clubCountryFilter = 'ALL';
  const term = clubSearch.trim().toLowerCase();
  const rows = state.clubs.filter((club) => {
    const meta = COUNTRY_META[club.country];
    if (clubRegionFilter !== 'ALL' && meta?.region !== clubRegionFilter) return false;
    if (clubCountryFilter !== 'ALL' && club.country !== clubCountryFilter) return false;
    if (term && !club.name.toLowerCase().includes(term) && !club.city.toLowerCase().includes(term)) return false;
    return true;
  }).sort((a,b)=>getTeamPower(state,b.id,false)-getTeamPower(state,a.id,false)||b.reputation-a.reputation).slice(0,180);
  const controls = `<div class="filter-toolbar"><label>Region<select id="club-region-filter"><option value="ALL">All regions</option>${REGION_ORDER.map((r)=>`<option value="${esc(r)}" ${clubRegionFilter===r?'selected':''}>${esc(r)}</option>`).join('')}</select></label><label>Country<select id="club-country-filter"><option value="ALL">All countries</option>${countries.sort().map((c)=>`<option value="${esc(c)}" ${clubCountryFilter===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Search<input id="club-search" value="${esc(clubSearch)}" placeholder="Club or city"></label><span>${rows.length} shown</span></div>`;
  return `${pageHead('CLUB DIRECTORY','Clubs','Go straight into a full club chronicle: squad, staff, current season, history, records, legends and rivalries.')}
    <section class="panel">${controls}<div class="club-hub-grid">${rows.map((club)=>{const power=Math.round(getTeamPower(state,club.id,false)); const table=getLeagueTable(state,club.leagueId); const pos=table.findIndex((row)=>row.teamId===club.id)+1; return `<a class="club-hub-card" href="#/club/${club.id}/overview">${crest(club.id,'md')}<div><strong>${esc(club.name)}</strong><span>${flag(club.country,'xs')} ${esc(club.country)} · ${esc(club.city)}</span><small>Power ${power} · Reputation ${Math.round(club.reputation)} · ${club.division===1&&pos?`#${pos} current`:'Promotion pool'}</small></div><b>›</b></a>`;}).join('')}</div></section>`;
}

function currentClubPowerRows() {
  return state.clubs.filter((club)=>club.division===1).map((club)=>({ club, power:getTeamPower(state,club.id,false) })).sort((a,b)=>b.power-a.power||b.club.reputation-a.club.reputation);
}

function currentLeaguePowerRows() {
  const byId = new Map(LEAGUE_DEFINITIONS.map((league)=>[league.id,league]));
  return getLeagueMarketRankings(state).map((row)=>({ ...row, league: byId.get(row.leagueId), score: row.score }));
}

function rankingsHubPage(tabRaw='clubs') {
  const tab=['clubs','leagues','history'].includes(tabRaw)?tabRaw:'clubs';
  const tabs=`<nav class="competition-tabs"><a href="#/rankings/clubs" class="${tab==='clubs'?'active':''}">Club Power</a><a href="#/rankings/leagues" class="${tab==='leagues'?'active':''}">League Strength</a><a href="#/rankings/history" class="${tab==='history'?'active':''}">Historical Evolution</a></nav>`;
  if(tab==='leagues') {const all=currentLeaguePowerRows(); const rows=all.filter((row)=>leagueRegionFilter==='ALL'||row.league.confederation===leagueRegionFilter).slice(0,50); const regionalRank=new Map(); for(const region of REGION_ORDER){all.filter((row)=>row.league.confederation===region).forEach((row,index)=>regionalRank.set(row.league.id,index+1));} return `${pageHead('WORLD POWER INDEX','League strength','A snapshot of where football power currently lives. Elite players use this hierarchy when judging whether their current league matches their ambition.')}${tabs}<section class="panel"><div class="filter-toolbar"><label>Continent<select id="league-region-filter"><option value="ALL">All continents</option>${REGION_ORDER.map((region)=>`<option value="${esc(region)}" ${leagueRegionFilter===region?'selected':''}>${esc(region)}</option>`).join('')}</select></label><span>${rows.length} leagues shown</span></div><div class="ranking-stack">${rows.map((row,index)=>`<a class="ranking-row" href="#/country/${encodeURIComponent(row.league.country)}/overview"><b>${leagueRegionFilter==='ALL'?index+1:regionalRank.get(row.league.id)}</b>${flag(row.league.country,'xs')}<div><strong>${esc(row.league.name)}</strong><small>${esc(row.league.country)} · ${esc(row.league.confederation)} · #${regionalRank.get(row.league.id)} in continent · ${money(row.financialPool || 0)} annual pool</small></div><span>${row.score.toFixed(1)}</span></a>`).join('')}</div></section>`;}
  if(tab==='history') {
    const clubRows=[...(state.history.clubPowerRankings||[])].sort((a,b)=>b.season-a.season||a.rank-b.rank).slice(0,150);
    const leagueRows=[...(state.history.leaguePowerRankings||[])].sort((a,b)=>b.season-a.season||b.score-a.score).slice(0,100);
    return `${pageHead('WORLD POWER INDEX','Rise and fall','Permanent season-end rankings show how clubs and leagues move through football history.')}${tabs}<div class="two-column"><section class="panel"><div class="panel-head"><div><span class="eyebrow">CLUB HISTORY</span><h3>Season-end power</h3></div></div><div class="archive-list">${clubRows.map((row)=>`<div class="archive-row"><strong>${esc(row.seasonLabel)} · #${row.rank}</strong><span>${teamLink(row.clubId)}</span><b>${row.score.toFixed(1)}</b></div>`).join('')||'<div class="empty-state">Complete a season to begin the ranking archive.</div>'}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">LEAGUE HISTORY</span><h3>Season-end strength</h3></div></div><div class="archive-list">${leagueRows.map((row)=>{const league=LEAGUE_DEFINITIONS.find((l)=>l.id===row.leagueId);return `<div class="archive-row"><strong>${esc(row.seasonLabel)}</strong><span>${esc(league?.name||row.leagueId)}</span><b>${row.score.toFixed(1)}</b></div>`;}).join('')||'<div class="empty-state">Complete a season to begin the ranking archive.</div>'}</div></section></div>`;
  }
  const rows=currentClubPowerRows().slice(0,75); return `${pageHead('WORLD POWER INDEX','Club power ranking','Current squad quality, staff influence and institutional strength in one global table.')}${tabs}<section class="panel"><div class="ranking-stack">${rows.map((row,index)=>`<a class="ranking-row" href="#/club/${row.club.id}/overview"><b>${index+1}</b>${crest(row.club.id,'sm')}<div><strong>${esc(row.club.name)}</strong><small>${esc(row.club.country)} · Reputation ${Math.round(row.club.reputation)}</small></div><span>${row.power.toFixed(1)}</span></a>`).join('')}</div></section>`;
}

function countryPage(raw, tabRaw = 'overview') {
  const country = decodeURIComponent(raw || '');
  const league = leagueCountry(country);
  if (!league) return notFound();
  const tab = ['overview','teams','history'].includes(tabRaw) ? tabRaw : 'overview';
  const table = getLeagueTable(state, league.id);
  const cup = state.current.domesticCups[`CUP-${league.id}`];
  const superCup = state.current.superCups?.[`SC-${league.id}`];
  const clubs = state.clubs.filter((club) => club.country === country).sort((a, b) => a.division - b.division || b.strength - a.strength);
  const reserveClubs = clubs.filter((club) => club.division === 2);
  const tabs = `<nav class="competition-tabs"><a href="#/country/${encodeURIComponent(country)}/overview" class="${tab==='overview'?'active':''}">Overview</a><a href="#/country/${encodeURIComponent(country)}/teams" class="${tab==='teams'?'active':''}">Teams</a><a href="#/country/${encodeURIComponent(country)}/history" class="${tab==='history'?'active':''}">History</a></nav>`;
  const marketRow = getLeagueMarketRankings(state, league.confederation).find((row)=>row.leagueId===league.id);
  const head = `${pageHead(`${countryMeta(country)?.region || 'WORLD'} · COUNTRY`, country, `${league.tier === 'detailed' ? `Full ${league.activeCount}-club league with promotion and relegation` : `Condensed national system with ${clubs.length} visible leading clubs`}. League market rank #${marketRow?.rank || '—'} in ${league.confederation} · ${money(marketRow?.financialPool || 0)} annual national pool.`)}<div class="country-title-flag">${flag(country, 'lg')}</div>${tabs}`;
  if (tab === 'teams') return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">CLUB DIRECTORY</span><h3>${clubs.length} visible clubs</h3></div></div><div class="club-directory">${clubs.map((club) => `<a class="club-directory-card" href="#/club/${club.id}/overview">${crest(club.id)}<div><strong>${esc(club.name)}</strong><span>${club.division === 1 ? 'Top division' : 'Promotion pool'} · ${esc(club.city)} · ${esc(getClubFinancialStatus(state,club.id)?.label || 'Remaining')} · Rating ${club.strength} · ${money(club.finances)}</span></div><b>›</b></a>`).join('')}</div></section>`;
  if (tab === 'history') {
    const ids = new Set([league.id, `CUP-${league.id}`, ...(superCup ? [superCup.id] : []), ...(country === 'Spain' ? ['SUPERCUP'] : [])]);
    const rows = [...publicHistoryChampions()].filter((item) => ids.has(item.competitionId)).sort((a,b)=>b.season-a.season || a.competitionName.localeCompare(b.competitionName));
    const awardFor = (row, category) => publicHistoryAwards().find((award) => award.season === row.season && award.competitionId === row.competitionId && award.category === category && (award.rank || 1) === 1);
    return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">NATIONAL ARCHIVE</span><h3>Titles year by year</h3></div><span class="muted">League, cup and super cup · individual leaders included</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Season</th><th>Competition</th><th>Winner</th><th>Runner-up</th><th>Best player</th><th>Top scorer</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${esc(row.seasonLabel)}</strong></td><td>${esc(row.competitionName)}</td><td>${teamLink(row.winnerId)}</td><td>${row.runnerUpId?teamLink(row.runnerUpId):'—'}</td><td>${playerLink(awardFor(row,'mvp')?.playerId)}</td><td>${playerLink(awardFor(row,'top_scorer')?.playerId)}</td></tr>`).join('')||'<tr><td colspan="6">No completed national competitions yet.</td></tr>'}</tbody></table></div></section>`;
  }
  const competitionCards = [
    `<a class="competition-country-card" href="#/league/${league.id}/overview">${competitionEmblem(league.id, 'md')}<div><span>LEAGUE</span><h3>${esc(league.name)}</h3><p>${table[0] ? `${esc(clubById(table[0].teamId)?.name)} lead on ${table[0].points} points` : 'Season ready'}</p></div><b>›</b></a>`,
    `<a class="competition-country-card" href="#/competition/CUP-${league.id}/overview">${competitionEmblem(`CUP-${league.id}`, 'md')}<div><span>DOMESTIC CUP</span><h3>${esc(league.cupName)}</h3><p>${cup.championId ? `${esc(clubById(cup.championId)?.name)} are champions` : cup.stage}</p></div><b>›</b></a>`,
    superCup ? `<a class="competition-country-card" href="#/competition/${superCup.id}/overview">${competitionEmblem(superCup.id, 'md')}<div><span>SUPER CUP</span><h3>${esc(superCup.name)}</h3><p>${superCup.championId?`${esc(clubById(superCup.championId)?.name)} are champions`:superCup.stage}</p></div><b>›</b></a>` : ''
  ].join('');
  return `${head}<div class="country-competition-grid">${competitionCards}</div><div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">CURRENT LEAGUE</span><h3>${esc(league.name)}</h3></div><span class="panel-chip">${league.tier === 'summary' ? 'Resolved near season end' : `${league.activeCount} clubs`}</span></div><div class="mini-table">${table.slice(0, 6).map((row,index)=>`<div class="mini-table-row"><span class="rank ${index<4?'qualify':''}">${index+1}</span>${teamLink(row.teamId)}<strong>${row.points}</strong><small>${row.gd>=0?'+':''}${row.gd}</small></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">DOMESTIC SNAPSHOT</span><h3>Competitions</h3></div></div><div class="country-status-list"><div><span>${esc(league.name)}</span><strong>${table[0]?`${esc(clubById(table[0].teamId)?.name)} lead`:'Ready'}</strong></div><div><span>${esc(league.cupName)}</span><strong>${esc(cup.stage||'Ready')}</strong></div>${superCup?`<div><span>${esc(superCup.name)}</span><strong>${esc(superCup.stage||'Ready')}</strong></div>`:''}</div></section></div>`;
}

function internationalPage(tabRaw = 'overview') {
  const tab = tabRaw === 'competitions' ? 'competitions' : 'overview';
  const tabsHtml = `<nav class="competition-tabs"><a href="#/international/overview" class="${tab === 'overview' ? 'active' : ''}">Overview & Nations</a><a href="#/international/competitions" class="${tab === 'competitions' ? 'active' : ''}">Competitions</a></nav>`;
  const cycleLabel = state.season % 4 === 1 ? `${getSeasonLabel(state.season)} World Cup cycle` : state.season % 4 === 2 ? `${getSeasonLabel(state.season)} continental qualifying` : state.season % 4 === 3 ? `${getSeasonLabel(state.season)} continental championships` : 'International friendlies';
  if (tab === 'competitions') {
    const cards = INTERNATIONAL_COMPETITION_CATALOG.map((catalog) => {
      const current = state.current.internationalCompetitions?.[catalog.id];
      const champion = [...publicHistoryChampions()].reverse().find((row) => row.competitionId === catalog.id);
      const status = current ? `${isShowcaseCompetitionEmbargoed(state, catalog.id) ? 'Showcase pending' : current.stage}${current.editionYear ? ` · ${getSeasonLabel(current.editionYear - 1)}` : ''}` : champion ? `Last winner: ${getEntityName(state, champion.winnerId, true)}` : 'No completed edition yet';
      return `<a class="international-card" href="#/competition/${catalog.id}/overview"><div><span>${esc(catalog.confederation)}</span><h3>${esc(catalog.name)}</h3><p>${esc(status)}</p></div><b>›</b></a>`;
    }).join('');
    return `${pageHead('INTERNATIONAL FOOTBALL', 'Competitions', 'Qualifying and final tournaments remain visible throughout the four-year cycle. World Cup and continental finals are played week by week in the summer window.')}${tabsHtml}<div class="international-competition-grid">${cards}</div>`;
  }
  return `${pageHead('INTERNATIONAL FOOTBALL', cycleLabel, 'National teams select up to eight named stars, with no more than one goalkeeper. Countries without a deep star pool rely more heavily on aggregate strength.')}${tabsHtml}
    <section class="panel"><div class="panel-head"><div><span class="eyebrow">NATIONAL TEAM DIRECTORY</span><h3>${NATIONAL_TEAMS.length} teams</h3></div><span class="muted">Generation tier affects the chance of producing elite players.</span></div><div class="confederation-directory">${REGION_ORDER.map((region) => {
      const teams = NATIONAL_TEAMS.filter((team) => team.region === region).sort((a, b) => b.strength - a.strength);
      return `<details ${region === 'Europe' ? 'open' : ''}><summary><strong>${esc(region)}</strong><span>${teams.length} teams</span></summary><div class="nation-grid">${teams.map((team) => {
        const pool = state.players.filter((player) => player.nationality === team.id && player.status === 'active');
        const best = [...pool].sort((a, b) => b.rating - a.rating)[0];
        return `<a class="nation-card" href="#/nation/${team.id}">${flag(team.id, 'md')}<div><strong>${esc(team.name)}</strong><span>Tier ${team.tier} · Team ${team.strength}</span><small>${pool.length} stars${best ? ` · Best ${best.rating}` : ''}</small></div></a>`;
      }).join('')}</div></details>`;
    }).join('')}</div></section>`;
}

function baseFor(description) {
  return description.type === 'league'
    ? `#/league/${encodeURIComponent(description.id)}`
    : `#/competition/${encodeURIComponent(description.id)}`;
}

function competitionHeader(description) {
  const object = description.object || {};
  const typeLabel = description.type === 'league' ? 'DOMESTIC LEAGUE' : description.type === 'international' ? 'INTERNATIONAL' : description.type.toUpperCase();
  const stage = isShowcaseCompetitionEmbargoed(state, description.id) ? 'Showcase pending' : object.championId ? 'Complete' : object.stage || 'Current season';
  return `<section class="competition-overview-hero competition-page-hero"><div><span class="eyebrow">${esc(typeLabel)}</span><h2>${esc(description.name)}</h2><p>${esc(description.country)} · ${esc(stage)}</p></div><span class="overview-trophy">${competitionEmblem(description.id, 'lg')}</span></section>`;
}

function competitionPage(description, tab = 'overview', sub = 'players') {
  const active = TABS.includes(tab) ? tab : 'overview';
  const base = baseFor(description);
  const heading = `${competitionHeader(description)}<div class="entity-page-actions">${favoriteButton('competition',description.id)}</div>${tabs(base, active)}`;
  try {
    const body = active === 'overview' ? overviewView(description) : active === 'weekly' ? weeklyView(description, base, sub) : active === 'current' ? currentView(description) : active === 'history' ? historyView(description) : statsView(description, base, sub);
    return `${heading}${body}`;
  } catch (error) {
    console.error(`Unable to render ${description.id}`, error);
    const matches = competitionMatches(description.id);
    return `${heading}<section class="panel"><div class="panel-head"><div><span class="eyebrow">CURRENT EDITION</span><h3>${esc(description.object?.stage || description.name)}</h3></div><span class="panel-chip">${matches.length} matches</span></div>${bracketView(description)}${groupTables(description)}<div class="matches-list section-gap">${matches.slice(-24).reverse().map((match) => matchRow(match, true)).join('') || '<div class="empty-state">The competition is scheduled but has no completed matches yet.</div>'}</div></section>`;
  }
}

function competitionMatches(id) {
  return rawCompetitionMatchesAll().filter((match) => match.competitionId === id && !isShowcaseMatchEmbargoed(state, match));
}


function competitionScheduleWeeks(description) {
  if (description.type === 'league') return Array.from({ length: description.object.rounds?.length || 0 }, (_, index) => index + 1);
  if (description.type === 'cup') return description.id.startsWith('SC-') ? [1, 2] : [5, 11, 17, 24, 31];
  if (description.id === 'CWC') return [39,40,41,43,45,47,49];
  if (description.id === 'ICUP') return [40,43,46];
  const object = description.object || {};
  const clubWeeks = description.type === 'continental' ? [4, 7, 10, 13, 16, 19, 22, 24, 27, 29, 32, 34, 38] : [];
  return [...new Set([...(object.groupWeeks || clubWeeks), ...(object.knockoutWeeks || [])])].sort((a, b) => a - b);
}

function scheduledFixtures(description, week, played) {
  if (description.type === 'league') {
    const round = description.object.rounds?.[week - 1] || [];
    const playedKeys = new Set(played.map((match) => `${match.homeId}::${match.awayId}`));
    return round.filter((fixture) => !playedKeys.has(`${fixture.homeId}::${fixture.awayId}`));
  }
  const object = description.object || {};
  const groupWeeks = object.groupWeeks || (description.type === 'continental' ? [4, 7, 10, 13, 16, 19] : []);
  const roundIndex = groupWeeks.indexOf(week);
  if (roundIndex >= 0) return (object.groups || []).flatMap((group) => group.rounds?.[roundIndex] || []);
  return [];
}

function bracketView(description) {
  if (description.type === 'league') return '';
  const object = description.object || {};
  const rounds = [];
  for (const round of object.rounds || []) rounds.push(round);
  for (const round of object.knockout?.rounds || []) rounds.push(round);
  if (object.knockout?.ties?.length && !rounds.some((round) => round.stage === object.knockout.round)) rounds.push({ stage: object.knockout.round, ties: object.knockout.ties, active: true });
  if (!rounds.length) return object.scheduled ? '<section class="panel bracket-panel"><div class="empty-state compact">The bracket will appear when the group stage or draw is complete.</div></section>' : '';
  const publicMatches = competitionMatches(description.id);
  const rawMatches = rawCompetitionMatchesAll().filter((match) => match.competitionId === description.id);
  const publicById = new Map(publicMatches.map((match) => [match.id, match]));
  const rawById = new Map(rawMatches.map((match) => [match.id, match]));
  const unresolvedSemis = hiddenShowcaseMatches(description.id).some((match) => /semi-final/i.test(String(match.stage || '')));
  const pendingCard = (match, stage = match?.stage || 'Knockout') => {
    if (!match) return '';
    const finalLocked = /^final$/i.test(String(stage).trim()) && unresolvedSemis;
    if (finalLocked) return `<div class="bracket-match upcoming showcase-embargo-row"><span>Awaiting semi-final winners</span><strong>vs</strong><span>?</span><small>SHOWCASE EMBARGO</small></div>`;
    return `<div class="bracket-match upcoming showcase-embargo-row">${teamLink(match.homeId, match.isInternational)}<strong>vs</strong>${teamLink(match.awayId, match.isInternational)}<small>SHOWCASE EMBARGO</small></div>`;
  };
  const resultCard = (match) => `<div class="bracket-match">${teamLink(match.homeId, match.isInternational)}<strong>${match.homeGoals}-${match.awayGoals}${match.penalties ? ` (${match.penalties.home}-${match.penalties.away}p)` : ''}</strong>${teamLink(match.awayId, match.isInternational)}</div>`;
  const cardsForRound = (round) => {
    if (round.matchIds?.length) return round.matchIds.map((id) => {
      const played = publicById.get(id);
      if (played) return resultCard(played);
      const raw = rawById.get(id);
      return raw && isShowcaseMatchEmbargoed(state, raw) ? pendingCard(raw, round.stage) : '';
    }).filter(Boolean).join('');
    if (round.ties?.length) return round.ties.map((tie) => {
      const firstRaw = rawById.get(tie.firstLeg || tie.finalMatchId);
      const secondRaw = rawById.get(tie.secondLeg);
      const first = firstRaw && !isShowcaseMatchEmbargoed(state, firstRaw) ? firstRaw : null;
      const second = secondRaw && !isShowcaseMatchEmbargoed(state, secondRaw) ? secondRaw : null;
      const stage = round.stage || object.knockout?.round || 'Knockout';
      if (firstRaw && isShowcaseMatchEmbargoed(state, firstRaw)) return pendingCard(firstRaw, stage);
      if (first && secondRaw && isShowcaseMatchEmbargoed(state, secondRaw)) {
        return `<div class="bracket-match upcoming">${teamLink(tie.homeId, description.type === 'international')}<strong>${first.homeGoals}-${first.awayGoals}</strong>${teamLink(tie.awayId, description.type === 'international')}<small>Leg 1 complete · Leg 2 in showcase</small></div>`;
      }
      if (first && second) {
        const homeAggregate = first.homeGoals + second.awayGoals;
        const awayAggregate = first.awayGoals + second.homeGoals;
        return `<div class="bracket-match">${teamLink(tie.homeId, description.type === 'international')}<strong>${homeAggregate}-${awayAggregate} agg</strong>${teamLink(tie.awayId, description.type === 'international')}<small>${first.homeGoals}-${first.awayGoals} · ${second.homeGoals}-${second.awayGoals}</small></div>`;
      }
      if (first) return resultCard(first);
      if (firstRaw) return pendingCard(firstRaw, stage);
      return `<div class="bracket-match upcoming">${teamLink(tie.homeId, description.type === 'international')}<strong>vs</strong>${teamLink(tie.awayId, description.type === 'international')}</div>`;
    }).join('');
    return '';
  };
  return `<section class="panel bracket-panel"><div class="panel-head"><div><span class="eyebrow">KNOCKOUT PATH</span><h3>Bracket & results</h3></div>${isShowcaseCompetitionEmbargoed(state, description.id) ? '<span class="panel-chip">SHOWCASE EMBARGO</span>' : ''}</div><div class="bracket-scroll"><div class="bracket-grid">${rounds.map((round) => `<div class="bracket-round"><h4>${esc(round.stage || 'Round')}</h4>${cardsForRound(round) || '<div class="empty-state compact">Awaiting draw</div>'}</div>`).join('')}</div></div></section>`;
}

function weeklyView(description, base, rawWeek) {
  const matches = competitionMatches(description.id);
  const hidden = hiddenShowcaseMatches(description.id);
  const playedWeeks = [...new Set([...matches.map((match) => match.week), ...hidden.map((match) => match.week)])].sort((a, b) => a - b);
  const scheduledWeeks = competitionScheduleWeeks(description);
  const allWeeks = [...new Set([...playedWeeks, ...scheduledWeeks])].sort((a, b) => a - b);
  const suggested = [...allWeeks].reverse().find((item) => item <= state.current.week) || allWeeks.find((item) => item >= state.current.week) || Math.max(1, state.current.week);
  let week = Number(rawWeek || suggested);
  if (!Number.isFinite(week)) week = suggested;
  const weekMatches = matches.filter((match) => match.week === week);
  const hiddenWeekMatches = hidden.filter((match) => match.week === week);
  const fixtures = scheduledFixtures(description, week, [...weekMatches, ...hiddenWeekMatches]);
  const index = Math.max(0, allWeeks.indexOf(week));
  const buttons = allWeeks.length ? allWeeks.slice(Math.max(0, index - 5), index + 7) : Array.from({ length: 10 }, (_, i) => i + 1);
  const hiddenRows = hiddenWeekMatches.map((match) => {
    const finalLocked = /^final$/i.test(String(match.stage || '').trim()) && hidden.some((row) => /semi-final/i.test(String(row.stage || '')));
    if (finalLocked) return `<div class="fixture-row large showcase-embargo-row"><span>Awaiting semi-final winners</span><strong>SHOWCASE</strong><span>?</span></div>`;
    return `<div class="fixture-row large showcase-embargo-row">${teamLink(match.homeId, match.isInternational)}<span>SHOWCASE PENDING</span>${teamLink(match.awayId, match.isInternational)}</div>`;
  }).join('');
  return `${bracketView(description)}<section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">MATCHWEEK NAVIGATION</span><h3>Week ${week}</h3></div><span class="muted">Selected showcase results stay private until you simulate those matches.</span></div><div class="week-strip">${buttons.map((item) => `<a href="${base}/weekly/${item}" class="${item === week ? 'active' : ''} ${playedWeeks.includes(item) ? 'played' : ''}">${item}</a>`).join('')}</div><div class="matches-list section-gap">${weekMatches.map((match) => matchRow(match)).join('')}${hiddenRows || ''}${!weekMatches.length && !hiddenWeekMatches.length ? (fixtures.length ? fixtures.map((fixture) => `<div class="fixture-row large">${teamLink(fixture.homeId, description.type === 'international')}<span>vs</span>${teamLink(fixture.awayId, description.type === 'international')}</div>`).join('') : scheduledWeeks.includes(week) ? '<div class="empty-state">The draw or qualified teams will be confirmed before this round.</div>' : `<div class="empty-state">No ${esc(description.name)} games are scheduled for this week.</div>`) : ''}</div></section>`;
}

function leagueTable(rows, relegationCount = 0) {
  return `<div class="table-scroll"><table class="data-table league-table"><thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th></tr></thead><tbody>${rows.map((row, index) => {
    const zone = index < 4 ? 'qualify' : relegationCount && index >= rows.length - relegationCount ? 'relegation' : '';
    return `<tr><td><span class="rank ${zone}">${index + 1}</span></td><td>${teamLink(row.teamId)}</td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gd >= 0 ? '+' : ''}${row.gd}</td><td><strong>${row.points}</strong></td><td><div class="form-strip">${row.form.map((form) => `<span class="form-${form.toLowerCase()}">${form}</span>`).join('')}</div></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function groupTables(description) {
  const groups = description.object.groups || [];
  if (!groups.length) return '';
  return `<div class="group-grid">${groups.map((group) => `<section class="panel"><div class="panel-head"><div><span class="eyebrow">GROUP ${esc(group.id)}</span><h3>Standings</h3></div></div><div class="mini-table">${[...(group.table || [])].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).map((row, index) => `<div class="mini-table-row"><span class="rank ${index < 2 ? 'qualify' : ''}">${index + 1}</span>${teamLink(row.teamId, description.type === 'international')}<strong>${row.points}</strong><small>${row.gd >= 0 ? '+' : ''}${row.gd}</small></div>`).join('')}</div></section>`).join('')}</div>`;
}

const leaderPanel = (title, id, metric, position = null) => `<section class="panel"><div class="panel-head"><div><span class="eyebrow">CURRENT YEAR</span><h3>${esc(title)}</h3></div></div>${leaders(id, metric, 10, position)}</section>`;

function overviewRankList(rows, render, empty = 'No history yet.') {
  return `<div class="overview-rank-list">${rows.length ? rows.map((row, index) => `<div class="overview-rank-row"><span class="rank">${index + 1}</span>${render(row)}</div>`).join('') : `<div class="empty-state compact">${esc(empty)}</div>`}</div>`;
}

function finalMatchForCompetition(description) {
  return competitionMatchesAll()
    .filter((match) => match.competitionId === description.id && String(match.stage || '').toLowerCase() === 'final')
    .sort((a, b) => (b.week || 0) - (a.week || 0))[0] || null;
}

function nextKnockoutPairs(description) {
  const object = description.object || {};
  if (object.championId) return [];
  const knockout = object.knockout || {};
  const matchById = new Map(competitionMatches(description.id).map((match) => [match.id, match]));

  if (knockout.ties?.length) {
    return knockout.ties.map((tie) => {
      if (tie.winnerId) return null;
      const first = tie.firstLeg ? matchById.get(tie.firstLeg) : null;
      const second = tie.secondLeg ? matchById.get(tie.secondLeg) : null;
      if (!first) return { homeId: tie.homeId, awayId: tie.awayId, label: `${knockout.round || object.stage || 'Knockout'} · Leg 1` };
      if (!second) return { homeId: tie.awayId, awayId: tie.homeId, label: `${knockout.round || object.stage || 'Knockout'} · Leg 2` };
      return null;
    }).filter(Boolean);
  }

  const storedPairs = knockout.openingPairs || object.nextPairs || [];
  if (storedPairs.length) return storedPairs.filter((pair) => pair?.[0] && pair?.[1]).map(([homeId, awayId]) => ({ homeId, awayId, label: knockout.round || object.stage || 'Next round' }));

  if (description.id === 'ICUP') {
    const seeds = object.seeds || {};
    if (!object.rounds?.length) {
      return [[seeds.Asia, seeds.Oceania], [seeds.Africa, seeds['North America']]].filter((pair) => pair.every(Boolean)).map(([homeId, awayId]) => ({ homeId, awayId, label: 'Quarter-final' }));
    }
    if (object.rounds.length === 1 && object.quarterWinners?.length >= 2) {
      return [[seeds.Europe, object.quarterWinners[0]], [seeds['South America'], object.quarterWinners[1]]].filter((pair) => pair.every(Boolean)).map(([homeId, awayId]) => ({ homeId, awayId, label: 'Semi-final' }));
    }
    if (object.finalists?.length === 2) return [{ homeId: object.finalists[0], awayId: object.finalists[1], label: 'Final' }];
  }

  return [];
}

function knockoutFixtureList(description, limit = 8) {
  const pairs = nextKnockoutPairs(description).slice(0, limit);
  if (!pairs.length) return '';
  const international = description.type === 'international';
  return `<div class="next-round-list">${pairs.map((pair) => `<div class="next-round-match"><small>${esc(pair.label || 'Next round')}</small><div>${teamLink(pair.homeId, international)}<strong>vs</strong>${teamLink(pair.awayId, international)}</div></div>`).join('')}</div>`;
}

function competitionOverviewSnapshot(description) {
  if (description.type === 'league') {
    const rows = getLeagueTable(state, description.id).slice(0, 3);
    return overviewRankList(rows, (row) => `<div class="overview-rank-main">${teamLink(row.teamId)}<small>${row.played} G · ${row.wins} W · ${row.gf}-${row.ga}</small></div><strong>${row.points} pts</strong>`, 'The table will populate once the season begins.');
  }
  if (isShowcaseCompetitionEmbargoed(state, description.id)) {
    const pending = hiddenShowcaseMatches(description.id).sort((a,b)=>(a.week||0)-(b.week||0));
    const first = pending[0];
    const unresolvedSemis = pending.some((match) => /semi-final/i.test(String(match.stage || '')));
    if (first) {
      const finalLocked = /^final$/i.test(String(first.stage || '').trim()) && unresolvedSemis;
      if (finalLocked) return `<div class="overview-champion showcase-locked-summary"><span>SHOWCASE EMBARGO</span><strong>Finalists not revealed yet</strong><small>Resolve the semi-finals in Postseason Showcase first.</small></div>`;
      return `<div class="overview-final-snapshot showcase-locked-summary"><span>SHOWCASE EMBARGO</span><div>${teamLink(first.homeId, first.isInternational)}<strong>vs</strong>${teamLink(first.awayId, first.isInternational)}</div><small>${esc(first.stage || 'Selected match')} · result hidden until played</small></div>`;
    }
  }
  const object = description.object || {};
  const international = description.type === 'international';
  if (object.championId) {
    const final = finalMatchForCompetition(description);
    if (final) return `<div class="overview-final-snapshot"><span>FINAL</span><div>${teamLink(final.homeId, final.isInternational)}<strong>${final.homeGoals}–${final.awayGoals}</strong>${teamLink(final.awayId, final.isInternational)}</div><small>Champion: ${getEntityName(state, object.championId, international)}</small></div>`;
    return `<div class="overview-champion"><span>CHAMPION</span>${teamLink(object.championId, international)}<small>${object.finalistId ? `Runner-up: ${getEntityName(state, object.finalistId, international)}` : esc(object.stage || '')}</small></div>`;
  }
  const fixtures = knockoutFixtureList(description, 4);
  if (fixtures) return fixtures;
  const groups = object.groups || [];
  if (groups.length) {
    const rows = groups.flatMap((group) => (group.table || []).map((row) => ({ ...row, groupId: group.id })))
      .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).slice(0, 3);
    return overviewRankList(rows, (row) => `<div class="overview-rank-main">${teamLink(row.teamId, international)}<small>Group ${esc(row.groupId)} · ${row.gf}-${row.ga}</small></div><strong>${row.points} pts</strong>`, 'The group draw has not been played yet.');
  }
  const remaining = object.knockout?.active || object.active || [];
  const ids = [...new Set(remaining.flatMap((tie) => typeof tie === 'string' ? [tie] : [tie.homeId, tie.awayId]).filter(Boolean))].slice(0, 3);
  return overviewRankList(ids.map((teamId) => ({ teamId })), (row) => `<div class="overview-rank-main">${teamLink(row.teamId, international)}<small>${esc(object.stage || 'Current round')}</small></div>`, 'The draw is not available yet.');
}

function overviewAwardCounts(description, category) {
  const map = new Map();
  for (const award of publicHistoryAwards()) {
    if (award.competitionId !== description.id || award.category !== category || award.rank !== 1) continue;
    map.set(award.playerId, (map.get(award.playerId) || 0) + 1);
  }
  return [...map.entries()].map(([playerId, count]) => ({ playerId, count })).sort((a, b) => b.count - a.count || (playerById(b.playerId)?.rating || 0) - (playerById(a.playerId)?.rating || 0));
}

function overviewView(description) {
  const playerRows = aggregatePlayerCompetition(description);
  const scorerRows = [...playerRows].filter((row) => row.goals).sort((a, b) => b.goals - a.goals || b.games - a.games).slice(0, 3);
  const assistRows = [...playerRows].filter((row) => row.assists).sort((a, b) => b.assists - a.assists || b.games - a.games).slice(0, 3);
  const goalkeeperAwards = overviewAwardCounts(description, 'best_goalkeeper');
  const goalkeeperRows = goalkeeperAwards.length
    ? goalkeeperAwards.slice(0, 3)
    : [...playerRows].filter((row) => playerById(row.playerId)?.position === 'GK').sort((a, b) => b.cleanSheets - a.cleanSheets || b.averageRating - a.averageRating).slice(0, 3).map((row) => ({ playerId: row.playerId, count: row.cleanSheets, fallback: true }));
  const mvpRows = overviewAwardCounts(description, 'mvp').slice(0, 3);
  const winnerMap = new Map();
  for (const champion of publicHistoryChampions().filter((row) => row.competitionId === description.id)) winnerMap.set(champion.winnerId, (winnerMap.get(champion.winnerId) || 0) + 1);
  const winners = [...winnerMap.entries()].map(([teamId, count]) => ({ teamId, count })).sort((a, b) => b.count - a.count).slice(0, 3);
  const currentChampion = description.object.championId;
  if (currentChampion && !isShowcaseCompetitionEmbargoed(state, description.id) && !publicHistoryChampions().some((row) => row.season === state.season && row.competitionId === description.id)) {
    const existing = winners.find((row) => row.teamId === currentChampion);
    if (existing) existing.count += 1;
    else winners.push({ teamId: currentChampion, count: 1 });
    winners.sort((a, b) => b.count - a.count);
  }
  const playerMetric = (rows, field) => overviewRankList(rows, (row) => `<div class="overview-rank-main">${playerLink(row.playerId)}<small>${playerById(row.playerId)?.position || ''} · ${row.games || 0} games</small></div><strong>${row[field]}</strong>`);
  return `<div class="competition-overview-grid section-gap">
      <section class="panel overview-panel"><div class="panel-head"><div><span class="eyebrow">CURRENT EDITION</span><h3>${description.type === 'league' ? 'Top three' : esc(description.object.stage || 'Current stage')}</h3></div></div>${competitionOverviewSnapshot(description)}</section>
      <section class="panel overview-panel"><div class="panel-head"><div><span class="eyebrow">HISTORICAL WINNERS</span><h3>Most titles</h3></div></div>${overviewRankList(winners.slice(0, 3), (row) => `<div class="overview-rank-main">${teamLink(row.teamId, description.type === 'international')}</div><strong>×${row.count}</strong>`)}</section>
      <section class="panel overview-panel"><div class="panel-head"><div><span class="eyebrow">PLAYERS</span><h3>Top scorers</h3></div></div>${playerMetric(scorerRows, 'goals')}</section>
      <section class="panel overview-panel"><div class="panel-head"><div><span class="eyebrow">PLAYERS</span><h3>Top assists</h3></div></div>${playerMetric(assistRows, 'assists')}</section>
      <section class="panel overview-panel"><div class="panel-head"><div><span class="eyebrow">GOALKEEPERS</span><h3>Best GK</h3></div></div>${overviewRankList(goalkeeperRows, (row) => `<div class="overview-rank-main">${playerLink(row.playerId)}<small>${row.fallback ? 'Career clean sheets' : 'Best GK awards'}</small></div><strong>${row.fallback ? row.count : `×${row.count}`}</strong>`)}</section>
      <section class="panel overview-panel"><div class="panel-head"><div><span class="eyebrow">INDIVIDUAL HONORS</span><h3>Most MVP awards</h3></div></div>${overviewRankList(mvpRows, (row) => `<div class="overview-rank-main">${playerLink(row.playerId)}</div><strong>×${row.count}</strong>`)}</section>
    </div>`;
}

function currentView(description) {
  const matches = competitionMatches(description.id);
  if (description.type === 'league') {
    return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">STANDINGS</span><h3>${esc(description.name)}</h3></div><span class="panel-chip">${state.current.week} weeks</span></div>${leagueTable(getLeagueTable(state, description.id), description.object.tier === 'detailed' ? 3 : 0)}</section><div class="leader-grid section-gap">${leaderPanel('Goals', description.id, 'goals')}${leaderPanel('Assists', description.id, 'assists')}${leaderPanel('Goalkeeper clean sheets', description.id, 'cleanSheets', 'GK')}${leaderPanel('Highest average rating', description.id, 'rating')}</div>`;
  }
  if (isShowcaseCompetitionEmbargoed(state, description.id)) return `${pendingShowcasePanel(description)}${bracketView(description)}`;
  const object = description.object || {};
  if (object.championId) return completedFinalCard(description);
  const fixtures = knockoutFixtureList(description, 16);
  if (fixtures) {
    return `<section class="panel current-round-panel"><div class="panel-head"><div><span class="eyebrow">CURRENT EDITION</span><h3>${esc(object.knockout?.round || object.stage || 'Next round')}</h3></div><span class="panel-chip">Next games</span></div>${fixtures}</section>`;
  }
  if (object.scheduled || object.inactive) {
    return `<section class="panel current-round-panel"><div class="panel-head"><div><span class="eyebrow">CURRENT EDITION</span><h3>${esc(object.stage || 'Scheduled')}</h3></div></div><div class="empty-state compact">${object.inactive ? 'This competition is not active this season.' : 'Fixtures will appear when the draw is complete.'}</div></section>`;
  }
  return `${groupTables(description)}${bracketView(description)}<section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">RECENT GAMES</span><h3>${esc(description.name)}</h3></div></div><div class="matches-list">${matches.slice(-18).reverse().map((match) => matchRow(match, true)).join('') || '<div class="empty-state compact">No matches yet.</div>'}</div></section>`;
}

function completedFinalCard(description) {
  if (isShowcaseCompetitionEmbargoed(state, description.id)) return pendingShowcasePanel(description);
  if (!description.object?.championId) return '';
  const final = competitionMatchesAll().filter((match)=>match.competitionId===description.id && String(match.stage||'').toLowerCase()==='final').sort((a,b)=>(b.week||0)-(a.week||0))[0];
  const champion = teamLink(description.object.championId, description.type==='international');
  const runner = description.object.finalistId ? teamLink(description.object.finalistId, description.type==='international') : '—';
  return `<section class="competition-final-card"><span class="eyebrow">FINAL RESULT</span><h2>${champion}</h2><p>${final ? `${teamLink(final.homeId, final.isInternational)} <strong>${final.homeGoals}–${final.awayGoals}</strong> ${teamLink(final.awayId, final.isInternational)}` : `${champion} defeated ${runner}`}</p><div class="final-card-meta"><div><span>Champion</span>${champion}</div><div><span>Runner-up</span>${runner}</div>${final?.manOfMatchId?`<div><span>Player of the match</span>${playerLink(final.manOfMatchId)}</div>`:''}</div></section>`;
}

function historyView(description) {
  const champions = publicHistoryChampions().filter((row) => row.competitionId === description.id).sort((a, b) => b.season - a.season);
  const awardFor = (season, category) => publicHistoryAwards().find((row) => row.season === season && row.competitionId === description.id && row.category === category && row.rank === 1);
  return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">YEAR BY YEAR</span><h3>Champions and positional awards</h3></div><span class="muted">Permanent after season close</span></div><div class="table-scroll"><table class="data-table history-table"><thead><tr><th>Season</th><th>Champion</th><th>Runner-up</th><th>Top scorer</th><th>Best player</th><th>Best GK</th><th>Best defender</th><th>Best midfielder</th><th>Best forward</th></tr></thead><tbody>${champions.map((champion) => {
    const international = champion.isInternational;
    return `<tr><td><strong>${esc(champion.seasonLabel)}</strong></td><td>${teamLink(champion.winnerId, international)}</td><td>${champion.runnerUpId ? teamLink(champion.runnerUpId, international) : '—'}</td><td>${playerLink(awardFor(champion.season, 'top_scorer')?.playerId)}</td><td>${playerLink(awardFor(champion.season, 'mvp')?.playerId)}</td><td>${playerLink(awardFor(champion.season, 'best_goalkeeper')?.playerId)}</td><td>${playerLink(awardFor(champion.season, 'best_defender')?.playerId)}</td><td>${playerLink(awardFor(champion.season, 'best_midfielder')?.playerId)}</td><td>${playerLink(awardFor(champion.season, 'best_forward')?.playerId || awardFor(champion.season, 'best_offensive')?.playerId)}</td></tr>`;
  }).join('') || '<tr><td colspan="9">Complete a season to create the historical archive.</td></tr>'}</tbody></table></div></section>`;
}

function aggregatePlayerCompetition(description) {
  const map = new Map();
  const rows = [
    ...state.history.playerSeasons.filter((row) => row.competitionId === description.id),
    ...Object.values(state.current.playerStats).filter((row) => row.competitionId === description.id)
  ];
  for (const row of rows) {
    const item = map.get(row.playerId) || { playerId: row.playerId, games: 0, goals: 0, assists: 0, cleanSheets: 0, ratingWeighted: 0, titles: 0 };
    item.games += row.apps || 0;
    item.goals += row.goals || 0;
    item.assists += row.assists || 0;
    item.cleanSheets += row.cleanSheets || 0;
    item.ratingWeighted += (row.averageRating || 0) * (row.apps || 0);
    map.set(row.playerId, item);
  }
  for (const honour of publicHistoryHonours().filter((row) => row.competitionId === description.id)) {
    const item = map.get(honour.playerId) || { playerId: honour.playerId, games: 0, goals: 0, assists: 0, cleanSheets: 0, ratingWeighted: 0, titles: 0 };
    item.titles += 1;
    map.set(honour.playerId, item);
  }
  return [...map.values()].map((row) => ({ ...row, averageRating: row.games ? row.ratingWeighted / row.games : 0 }));
}

function aggregateTeamCompetition(description) {
  const isInternational = description.type === 'international';
  const map = new Map();
  const ensure = (id) => {
    if (!map.has(id)) map.set(id, { teamId: id, games: 0, wins: 0, draws: 0, losses: 0, goals: 0, cleanSheets: 0, titles: 0, bestPoints: 0 });
    return map.get(id);
  };
  const historical = state.history.clubCompetitionSeasons.filter((row) => row.competitionId === description.id);
  historical.forEach((row) => {
    const item = ensure(row.teamId);
    item.games += row.apps || 0;
    item.wins += row.wins || 0;
    item.draws += row.draws || 0;
    item.losses += row.losses || 0;
    item.goals += row.gf || 0;
    item.cleanSheets += row.cleanSheets || 0;
  });
  const liveMatches = state.current.completed ? [] : competitionMatches(description.id);
  liveMatches.forEach((match) => {
    const home = ensure(match.homeId);
    const away = ensure(match.awayId);
    home.games += 1; away.games += 1;
    home.goals += match.homeGoals; away.goals += match.awayGoals;
    if (match.awayGoals === 0) home.cleanSheets += 1;
    if (match.homeGoals === 0) away.cleanSheets += 1;
    if (match.homeGoals > match.awayGoals) { home.wins += 1; away.losses += 1; }
    else if (match.homeGoals < match.awayGoals) { away.wins += 1; home.losses += 1; }
    else { home.draws += 1; away.draws += 1; }
  });
  publicHistoryChampions().filter((row) => row.competitionId === description.id).forEach((champion) => { ensure(champion.winnerId).titles += 1; });
  if (description.type === 'league') {
    state.history.clubSeasons.filter((row) => row.leagueId === description.id).forEach((row) => { ensure(row.clubId).bestPoints = Math.max(ensure(row.clubId).bestPoints, row.points || 0); });
    getLeagueTable(state, description.id).forEach((row) => { ensure(row.teamId).bestPoints = Math.max(ensure(row.teamId).bestPoints, row.points || 0); });
  }
  return { rows: [...map.values()], isInternational };
}

function statsView(description, base, sub = 'players') {
  const activeSub = ['teams', 'coaches'].includes(sub) ? sub : 'players';
  const subTabs = `<nav class="sub-tabs"><a href="${base}/stats/players" class="${activeSub === 'players' ? 'active' : ''}">Players</a><a href="${base}/stats/teams" class="${activeSub === 'teams' ? 'active' : ''}">Teams</a><a href="${base}/stats/coaches" class="${activeSub === 'coaches' ? 'active' : ''}">Coaches</a></nav>`;
  if (activeSub === 'players') {
    const rows = aggregatePlayerCompetition(description).filter((row) => competitionStatsPosition === 'ALL' || playerById(row.playerId)?.position === competitionStatsPosition);
    const sorters = {
      goals: (a, b) => b.goals - a.goals || b.games - a.games,
      assists: (a, b) => b.assists - a.assists || b.games - a.games,
      cleanSheets: (a, b) => b.cleanSheets - a.cleanSheets || b.games - a.games,
      rating: (a, b) => b.averageRating - a.averageRating || b.games - a.games,
      games: (a, b) => b.games - a.games,
      titles: (a, b) => b.titles - a.titles || b.games - a.games
    };
    const sorted = [...rows].sort(sorters[competitionStatsSort] || sorters.titles).slice(0, 50);
    const controls = `<div class="filter-toolbar"><label>Position<select id="competition-stats-position"><option value="ALL">All positions</option>${['GK','DF','MF','FW'].map((position) => `<option value="${position}" ${competitionStatsPosition === position ? 'selected' : ''}>${position}</option>`).join('')}</select></label><label>Rank by<select id="competition-stats-sort">${[['goals','Goals'],['assists','Assists'],['cleanSheets','Clean sheets'],['rating','Average score'],['games','Games'],['titles','Titles']].map(([value,label]) => `<option value="${value}" ${competitionStatsSort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><span>Top 50</span></div>`;
    return `${subTabs}<section class="panel">${controls}<div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Games</th><th>Goals</th><th>Assists</th><th>Clean sheets</th><th>Avg rating</th><th>Titles</th></tr></thead><tbody>${sorted.map((row, index) => `<tr><td>${index + 1}</td><td>${playerLink(row.playerId)}</td><td>${playerById(row.playerId)?.position || '—'}</td><td>${row.games}</td><td><strong>${row.goals}</strong></td><td>${row.assists}</td><td>${row.cleanSheets}</td><td>${row.averageRating ? row.averageRating.toFixed(2) : '—'}</td><td><strong>${row.titles}</strong></td></tr>`).join('') || '<tr><td colspan="9">No records yet.</td></tr>'}</tbody></table></div></section>`;
  }
  if (activeSub === 'coaches') {
    const rows = getCompetitionCoachLeaderboard(state, description.id);
    const sorters = {
      games: (a, b) => b.games - a.games || b.wins - a.wins,
      wins: (a, b) => b.wins - a.wins || b.games - a.games,
      winPct: (a, b) => b.winPct - a.winPct || b.games - a.games,
      goals: (a, b) => b.gf - a.gf || b.wins - a.wins,
      conceded: (a, b) => a.ga - b.ga || b.games - a.games,
      titles: (a, b) => b.titles - a.titles || b.wins - a.wins
    };
    const sorted = [...rows].sort(sorters[competitionCoachStatsSort] || sorters.titles).slice(0, 50);
    const controls = `<div class="filter-toolbar"><label>Rank by<select id="competition-coach-stats-sort">${[['titles','Titles'],['games','Games'],['wins','Wins'],['winPct','Win percentage'],['goals','Goals scored'],['conceded','Fewest conceded']].map(([value,label]) => `<option value="${value}" ${competitionCoachStatsSort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><span>Top 50 · minimum 10 games for percentage context</span></div>`;
    return `${subTabs}<section class="panel">${controls}<div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Coach</th><th>Rarity</th><th>Games</th><th>Wins</th><th>Win %</th><th>Goals</th><th>Conceded</th><th>Titles</th></tr></thead><tbody>${sorted.map((row, index) => {
      const coach = coachById(row.coachId);
      return `<tr><td>${index + 1}</td><td>${coachLink(row.coachId)}</td><td>${coach ? staffRarityBadge(coach.rarity) : '—'}</td><td>${row.games}</td><td><strong>${row.wins}</strong></td><td>${row.games ? `${(row.winPct * 100).toFixed(1)}%` : '—'}</td><td>${row.gf}</td><td>${row.ga}</td><td><strong>${row.titles}</strong></td></tr>`;
    }).join('') || '<tr><td colspan="9">No coach records yet. Statistics begin with matches played in this version.</td></tr>'}</tbody></table></div></section>`;
  }
  const aggregate = aggregateTeamCompetition(description);
  const teamSorters = {
    titles: (a,b)=>b.titles-a.titles || b.wins-a.wins,
    games: (a,b)=>b.games-a.games || b.wins-a.wins,
    wins: (a,b)=>b.wins-a.wins || b.games-a.games,
    goals: (a,b)=>b.goals-a.goals || b.wins-a.wins,
    cleanSheets: (a,b)=>b.cleanSheets-a.cleanSheets || b.games-a.games,
    points: (a,b)=>(b.bestPoints||0)-(a.bestPoints||0) || b.wins-a.wins
  };
  const sorted = [...aggregate.rows].sort(teamSorters[competitionTeamStatsSort] || teamSorters.titles).slice(0,50);
  const topGoals = [...aggregate.rows].sort((a, b) => b.goals - a.goals)[0];
  const topClean = [...aggregate.rows].sort((a, b) => b.cleanSheets - a.cleanSheets)[0];
  const topTitles = [...aggregate.rows].sort((a, b) => b.titles - a.titles)[0];
  const controls = `<div class="filter-toolbar"><label>Rank by<select id="competition-team-stats-sort">${[['titles','Titles'],['games','Games'],['wins','Wins'],['goals','Goals'],['cleanSheets','Clean sheets'],['points','Best league points']].map(([value,label])=>`<option value="${value}" ${competitionTeamStatsSort===value?'selected':''}>${label}</option>`).join('')}</select></label><span>Top 50</span></div>`;
  return `${subTabs}<div class="stats-highlight-grid">${statCard('Most team goals', topGoals ? topGoals.goals : 0, topGoals ? getEntityName(state, topGoals.teamId, aggregate.isInternational) : 'No history')}${statCard('Most clean sheets', topClean ? topClean.cleanSheets : 0, topClean ? getEntityName(state, topClean.teamId, aggregate.isInternational) : 'No history')}${statCard('Most titles', topTitles ? topTitles.titles : 0, topTitles ? getEntityName(state, topTitles.teamId, aggregate.isInternational) : 'No history')}</div><section class="panel section-gap">${controls}<div class="panel-head"><div><span class="eyebrow">ALL-TIME TEAM RECORDS</span><h3>${esc(description.name)}</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Team</th><th>Games</th><th>Wins</th><th>Goals</th><th>Clean sheets</th><th>Best points</th><th>Titles</th></tr></thead><tbody>${sorted.map((row, index) => `<tr><td>${index + 1}</td><td>${teamLink(row.teamId, aggregate.isInternational)}</td><td>${row.games}</td><td>${row.wins}</td><td><strong>${row.goals}</strong></td><td>${row.cleanSheets}</td><td>${row.bestPoints || '—'}</td><td><strong>${row.titles}</strong></td></tr>`).join('') || '<tr><td colspan="8">No records yet.</td></tr>'}</tbody></table></div></section>`;

}


function matchRelevance(match) {
  const stage = /Final/i.test(match.stage || '') ? 34 : /Semi/i.test(match.stage || '') ? 24 : /Quarter/i.test(match.stage || '') ? 17 : /Round of 16/i.test(match.stage || '') ? 10 : 0;
  const competition = match.competitionId === 'WC' ? 38 : ['UCL','LIB','EURO','COPA'].includes(match.competitionId) ? 28 : ['UEL','AFCON','ASIACUP','GOLDCUP'].includes(match.competitionId) ? 18 : ['UECL','SUD','CCC','ACL','CAFCL'].includes(match.competitionId) ? 12 : 5;
  const home = match.isInternational ? nationalById(match.homeId)?.strength : clubById(match.homeId)?.reputation;
  const away = match.isInternational ? nationalById(match.awayId)?.strength : clubById(match.awayId)?.reputation;
  let tableBonus = 0;
  const league = state.current.leagues?.[match.competitionId];
  if (league) {
    const table = getLeagueTable(state, match.competitionId);
    const homePosition = table.findIndex((row) => row.teamId === match.homeId) + 1;
    const awayPosition = table.findIndex((row) => row.teamId === match.awayId) + 1;
    const best = Math.max(homePosition || 99, awayPosition || 99);
    if (best <= 2) tableBonus = 20;
    else if (best <= 4) tableBonus = 11;
    else if (best <= 7) tableBonus = 5;
  }
  const winnerId = match.homeGoals > match.awayGoals ? match.homeId : match.awayGoals > match.homeGoals ? match.awayId : null;
  const winnerStrength = winnerId === match.homeId ? home : winnerId === match.awayId ? away : null;
  const loserStrength = winnerId === match.homeId ? away : winnerId === match.awayId ? home : null;
  const upsetBonus = winnerStrength && loserStrength && loserStrength - winnerStrength >= 9 ? 12 : 0;
  const favoriteBonus = !match.isInternational && (state.preferences.favoriteClubIds || []).some((id)=>id===match.homeId||id===match.awayId) ? 18 : match.isInternational && (state.preferences.favoriteNationIds || []).some((id)=>id===match.homeId||id===match.awayId) ? 18 : 0;
  const competitionFavorite = (state.preferences.favoriteCompetitionIds || []).includes(match.competitionId) ? 12 : 0;
  return competition + stage + tableBonus + upsetBonus + favoriteBonus + competitionFavorite + Math.max(0, Math.max(home || 60, away || 60) - 68) + (match.homeGoals + match.awayGoals) * 2;
}


function rivalryForMatch(match) {
  if (match.isInternational) return null;
  const row=RIVALRY_DEFINITIONS.find((item)=>(item.clubAId===match.homeId&&item.clubBId===match.awayId)||(item.clubAId===match.awayId&&item.clubBId===match.homeId));
  return row?.name || null;
}

function standoutForMatch(match) {
  const logs = [];
  for (const [playerId, playerLogs] of Object.entries(state.current.playerMatchLogs || {})) {
    const log = playerLogs.find((item) => item.matchId === match.id);
    if (log) logs.push({ player: playerById(playerId), log });
  }
  return logs.sort((a,b) => (b.log.goals * 2.2 + b.log.assists + b.log.rating) - (a.log.goals * 2.2 + a.log.assists + a.log.rating))[0] || null;
}

function leagueContext(match) {
  const league = state.current.leagues?.[match.competitionId];
  if (!league) return '';
  const table = getLeagueTable(state, match.competitionId);
  const winnerId = match.winnerId;
  if (!winnerId) return '';
  const winnerPos = table.findIndex((row) => row.teamId === winnerId) + 1;
  const loserId = winnerId === match.homeId ? match.awayId : match.homeId;
  const loserPos = table.findIndex((row) => row.teamId === loserId) + 1;
  if (winnerPos === 1) return `${getEntityName(state, winnerId, false)} finish the week at the top of ${league.name}`;
  if (winnerPos <= 4 && loserPos <= 4) return `${getEntityName(state, winnerId, false)} strengthen their position in the title and continental race`;
  return '';
}

function narrativeMatchStory(match) {
  const home = getEntityName(state, match.homeId, match.isInternational);
  const away = getEntityName(state, match.awayId, match.isInternational);
  const winnerId = match.winnerId;
  const winner = winnerId ? getEntityName(state, winnerId, match.isInternational) : null;
  const loser = winnerId ? getEntityName(state, winnerId === match.homeId ? match.awayId : match.homeId, match.isInternational) : null;
  const rivalry = rivalryForMatch(match);
  const standout = standoutForMatch(match);
  const goals = standout?.log.goals || 0;
  const lateGoal = [...(match.goalEvents || [])].sort((a,b) => b.minute-a.minute)[0];
  const stage = match.stage || (state.current.leagues?.[match.competitionId] ? `Week ${match.week}` : 'Current round');
  const isFinal = /final/i.test(stage) && !/semi/i.test(stage);
  const isSemi = /semi/i.test(stage);
  const context = leagueContext(match);
  let headline;
  if (isFinal && winner) headline = `${winner} lift ${competitionLabel(match.competitionId)}`;
  else if (isSemi && winner) headline = `${winner} secure a place in the final`;
  else if (rivalry && winner && lateGoal?.minute >= 85) headline = `${winner} claim a dramatic late win in the ${rivalry}`;
  else if (rivalry && winner) headline = `${winner} take the honours in the ${rivalry}`;
  else if (goals >= 3) headline = `${standout.player.name} inspires ${winner || standout.log.teamId} with a hat trick`;
  else if (winner && Math.abs(match.homeGoals-match.awayGoals) >= 3) headline = `${winner} deliver a statement victory over ${loser}`;
  else if (winner) headline = `${winner} win a major ${competitionLabel(match.competitionId)} contest`;
  else headline = `${home} and ${away} share the points`;
  const details = [];
  if (rivalry) details.push(`The ${rivalry} ended ${home} ${match.homeGoals}-${match.awayGoals} ${away}`);
  else details.push(`${home} ${match.homeGoals}-${match.awayGoals} ${away} was one of the most important results of the last four weeks`);
  if (lateGoal?.minute >= 85 && winner) {
    const scorer = playerById(lateGoal.scorerId)?.name;
    details.push(`${scorer || winner} decided it in the ${lateGoal.minute}th minute`);
  }
  if (standout?.player && (goals >= 2 || standout.log.rating >= 8.6)) {
    details.push(`${standout.player.name} ${goals ? `scored ${goals} goal${goals === 1 ? '' : 's'} and ` : ''}earned a ${standout.log.rating.toFixed(1)} rating`);
  }
  if (isFinal && winner) details.push(`${winner} are crowned champions`);
  else if (isSemi && winner) details.push(`${winner} progress to the final`);
  else if (context) details.push(context);
  return { match, headline, body: `${details.join('. ')}.`, relevance: matchRelevance(match) + (rivalry ? 18 : 0) + (goals >= 3 ? 16 : 0) + (lateGoal?.minute >= 85 ? 8 : 0), stage };
}


const FHOF_COMPETITION_WEIGHTS = {
  WC: 10, CWC: 9.5, ICUP: 6.5, EURO: 8.5, COPA: 8.2, AFCON: 6.2, ASIACUP: 5.2, GOLDCUP: 4.8, OFC: 3.2,
  UCL: 9, LIB: 8, UEL: 5.8, SUD: 5.4, UECL: 3.8, CCC: 4.8, ACL: 4.7, CAFCL: 4.6, OCL: 2.8,
  ESP1: 6.2, ENG1: 6.4, ITA1: 6, GER1: 5.9, FRA1: 5.5, BRA1: 5.8, ARG1: 5.5,
  POR1: 4.4, NED1: 4.3, BEL1: 3.7, TUR1: 3.7, USA1: 3.5, MEX1: 3.8, SAU1: 3.1, JPN1: 3.2
};

function fhofCompetitionWeight(id, international = false) {
  if (FHOF_COMPETITION_WEIGHTS[id]) return FHOF_COMPETITION_WEIGHTS[id];
  if (String(id).endsWith('CUP')) return international ? 3.5 : 2.4;
  if (String(id).endsWith('1')) return 2.6;
  return international ? 2.8 : 2.1;
}

function fhofPlayerRankings() {
  const rows = [...(state.history.playerSeasons || []), ...Object.values(state.current.playerStats || {})];
  const map = new Map();
  for (const row of rows) {
    const player = playerById(row.playerId); if (!player || !row.apps) continue;
    const w = fhofCompetitionWeight(row.competitionId, row.isInternational);
    const item = map.get(row.playerId) || { id: row.playerId, games:0, goals:0, assists:0, cleanSheets:0, weightedRating:0, ratingApps:0, score:0, titles:0, awards:0 };
    item.games += row.apps || 0; item.goals += row.goals || 0; item.assists += row.assists || 0; item.cleanSheets += row.cleanSheets || 0;
    item.weightedRating += (row.averageRating || 0) * (row.apps || 0) * w; item.ratingApps += (row.apps || 0) * w;
    const positionProduction = player.position === 'GK' ? (row.cleanSheets || 0) * 2.5 : player.position === 'DF' ? (row.cleanSheets || 0) * 1.25 + (row.goals || 0) * 2.2 + (row.assists || 0) * 1.5 : player.position === 'MF' ? (row.goals || 0) * 2 + (row.assists || 0) * 2.5 : (row.goals || 0) * 2.8 + (row.assists || 0) * 1.7;
    item.score += ((row.apps || 0) * .13 + positionProduction + Math.max(0, (row.averageRating || 6.5) - 6.5) * (row.apps || 0) * 1.4) * w;
    map.set(row.playerId,item);
  }
  for (const h of publicHistoryHonours()) { const item=map.get(h.playerId); if(item){ const w=fhofCompetitionWeight(h.competitionId,h.isInternational); item.titles++; item.score += 22*w; } }
  for (const a of publicHistoryAwards()) { if(a.rank!==1) continue; const item=map.get(a.playerId); if(!item) continue; const w=a.competitionId ? fhofCompetitionWeight(a.competitionId,a.isInternational) : (a.category==='ballon_dor'?10:a.category==='golden_boot'?7:6); item.awards++; item.score += w*(a.category==='ballon_dor'?35:18); }
  return [...map.values()].map(x=>({...x,player:playerById(x.id),averageRating:x.ratingApps?x.weightedRating/x.ratingApps:0})).filter(x=>x.player).sort((a,b)=>b.score-a.score);
}

function fhofCoachRankings() {
  const rows=[...(state.history.coachCompetitionSeasons||[]),...Object.values(state.current.coachStats||{})]; const map=new Map();
  for(const row of rows){ const coach=coachById(row.coachId); if(!coach) continue; const w=fhofCompetitionWeight(row.competitionId,row.isInternational); const item=map.get(row.coachId)||{id:row.coachId,games:0,wins:0,gf:0,ga:0,titles:0,score:0}; item.games+=row.games||0;item.wins+=row.wins||0;item.gf+=row.gf||0;item.ga+=row.ga||0;item.titles+=row.titles||0;item.score+=((row.games||0)*.18+(row.wins||0)*1.3+Math.max(0,(row.gf||0)-(row.ga||0))*.18+(row.titles||0)*26)*w;map.set(row.coachId,item); }
  return [...map.values()].map(x=>({...x,coach:coachById(x.id)})).filter(x=>x.coach).sort((a,b)=>b.score-a.score);
}

function buildFhofData() {
  const signature = [state.season, state.current.week, state.history.playerSeasons?.length||0, state.history.coachCompetitionSeasons?.length||0, state.history.clubCompetitionSeasons?.length||0, state.history.champions?.length||0, state.history.awards?.length||0, state.history.honours?.length||0, (state.current.postseason?.showcaseMatches||[]).filter((row)=>row.resolved).length].join(':');
  if (hallCache.signature === signature && hallCache.data) return hallCache.data;
  const players = [];
  const coaches = fhofCoachRankings();
  const clubRowsByTeam = new Map();
  for (const row of state.history.clubCompetitionSeasons || []) { if (!clubRowsByTeam.has(row.teamId)) clubRowsByTeam.set(row.teamId, []); clubRowsByTeam.get(row.teamId).push(row); }
  const titlesByTeam = new Map();
  for (const row of publicHistoryChampions()) { if (row.isInternational) continue; if (!titlesByTeam.has(row.winnerId)) titlesByTeam.set(row.winnerId, []); titlesByTeam.get(row.winnerId).push(row); }
  const presidents = (state.owners || []).map((owner) => {
    const clubId = owner.clubId || owner.formerClubId; if (!clubId) return null;
    const start = owner.appointmentSeason ?? state.season; const end = owner.clubId ? state.season : (owner.departureSeason ?? start + (owner.seasonsInRole || 0));
    let score=0,games=0,wins=0,titles=0;
    for (const row of clubRowsByTeam.get(clubId) || []) { if(row.season<start||row.season>end)continue;const w=fhofCompetitionWeight(row.competitionId,false);games+=row.apps||0;wins+=row.wins||0;score+=((row.wins||0)*.55+(row.apps||0)*.06)*w; }
    for (const honour of titlesByTeam.get(clubId) || []) { if(honour.season<start||honour.season>end)continue;titles++;score+=30*fhofCompetitionWeight(honour.competitionId,false); }
    score+=(owner.quality||50)*1.2+(owner.seasonsInRole||0)*6; return {owner,clubId,score,games,wins,titles};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);

  const coachRowsByEra = new Map();
  for (const row of state.history.coachSeasons || []) { if(row.isInternational)continue;const key=`${row.teamId}::${row.coachId}`;if(!coachRowsByEra.has(key))coachRowsByEra.set(key,new Set());coachRowsByEra.get(key).add(row.season); }
  const teamSeasonData = new Map();
  for (const row of state.history.clubCompetitionSeasons || []) { const key=`${row.teamId}::${row.season}`;const item=teamSeasonData.get(key)||{score:0,games:0,wins:0,gf:0,ga:0,titles:0};const w=fhofCompetitionWeight(row.competitionId,false);item.games+=row.apps||0;item.wins+=row.wins||0;item.gf+=row.gf||0;item.ga+=row.ga||0;item.score+=((row.wins||0)*.62+(row.apps||0)*.055+Math.max(0,(row.gf||0)-(row.ga||0))*.095)*w;teamSeasonData.set(key,item); }
  for (const honour of publicHistoryChampions()) { if(honour.isInternational)continue;const key=`${honour.winnerId}::${honour.season}`;const item=teamSeasonData.get(key)||{score:0,games:0,wins:0,gf:0,ga:0,titles:0};item.titles++;item.score+=34*fhofCompetitionWeight(honour.competitionId,false);teamSeasonData.set(key,item); }
  const eras=[];
  for(const [key,seasonSet] of coachRowsByEra){const [teamId,coachId]=key.split('::');const ordered=[...seasonSet].sort((a,b)=>a-b);let run=[];const runs=[];for(const season of ordered){if(run.length&&season!==run[run.length-1]+1){runs.push(run);run=[];}run.push(season);}if(run.length)runs.push(run);for(const continuous of runs){if(continuous.length<2)continue;let best=null;for(let i=0;i<continuous.length;i++){for(const length of [2,3]){const seasons=continuous.slice(i,i+length);if(seasons.length!==length)continue;const total={teamId,coachId,start:seasons[0],end:seasons.at(-1),seasons,score:length===3?18:6,games:0,wins:0,titles:0,gf:0,ga:0};for(const season of seasons){const row=teamSeasonData.get(`${teamId}::${season}`);if(!row)continue;for(const f of ['score','games','wins','titles','gf','ga'])total[f]+=row[f]||0;}if(!best||total.score>best.score||total.score===best.score&&total.titles>best.titles)best=total;}}if(best)eras.push(best);}}
  eras.sort((a,b)=>b.score-a.score||b.titles-a.titles||b.wins-a.wins);

  const nationSeason = new Map();
  for(const row of state.history.coachSeasons||[]){if(!row.isInternational)continue;const key=`${row.teamId}::${row.season}`;const item=nationSeason.get(key)||{games:0,wins:0,score:0,titles:0};item.games+=row.games||0;item.wins+=row.wins||0;item.score+=(row.wins||0)*2+(row.games||0)*.25;nationSeason.set(key,item);}
  for(const honour of publicHistoryChampions()) {if(!honour.isInternational)continue;const key=`${honour.winnerId}::${honour.season}`;const item=nationSeason.get(key)||{games:0,wins:0,score:0,titles:0};item.titles++;item.score+=45*fhofCompetitionWeight(honour.competitionId,true);nationSeason.set(key,item);}
  const nations=[];for(const nation of state.nationalTeams||[]){let best=null;for(let start=Math.max(START_SEASON,state.season-8);start<=state.season;start++){const total={nation,start,end:start+3,score:0,titles:0,games:0,wins:0};for(let season=start;season<=start+3;season++){const row=nationSeason.get(`${nation.id}::${season}`);if(!row)continue;for(const f of ['score','titles','games','wins'])total[f]+=row[f]||0;}if((total.titles||total.games>=8)&&(!best||total.score>best.score))best=total;}if(best)nations.push(best);}nations.sort((a,b)=>b.score-a.score);
  hallCache={signature,data:{players,coaches,presidents,eras,nations:nations.slice(0,5)}};
  return hallCache.data;
}


function fhofPage(){
  const inductees=[...(state.history.hallOfFamePlayers||[])].sort((a,b)=>b.score-a.score||a.inductionSeason-b.inductionSeason);
  const hall=buildFhofData(),coaches=hall.coaches.slice(0,10),presidents=hall.presidents.slice(0,10),eras=hall.eras.slice(0,10),nations=hall.nations;
  const positions=['GK','DF','MF','FW'];
  const playerSections=positions.map((pos)=>{const rows=inductees.filter((row)=>row.position===pos);return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">${pos==='GK'?'GOALKEEPERS':pos==='DF'?'DEFENDERS':pos==='MF'?'MIDFIELDERS':'FORWARDS'}</span><h3>${rows.length} inducted</h3></div></div><div class="fhof-list">${rows.map((row,i)=>{const p=playerById(row.playerId);return `<div class="fhof-row inducted"><b>${i+1}</b><div>${playerLink(row.playerId)}<small>Inducted ${esc(row.inductionSeasonLabel)} · ${row.games} games · ${row.totalTitles} titles · ${row.individualAwards} awards${row.ballonDor?` · ${row.ballonDor} Ballon d'Or`:''}</small></div><strong>${Math.round(row.score)}</strong></div>`;}).join('')||'<div class="empty-state compact">No retired player at this position has yet met the Hall of Fame standard.</div>'}</div></section>`;}).join('');
  return `${pageHead('FOOTBALL HALL OF FAME','The FHoF','Players enter only after retirement. Great club eras, coaches, presidents and national-team cycles remain living historical rankings.')}${magazineTabs('fhof')}
  <section class="fhof-intro"><span class="eyebrow">CAREER INDUCTION</span><h2>Great careers become permanent history.</h2><p>Induction is decided once, at retirement, using competition-weighted performance, career production, major trophies and individual awards. A great active player is a candidate—not yet a Hall of Famer.</p></section>
  <div class="stats-ribbon section-gap">${statCard('Inducted players',inductees.length,'Permanent membership')}${statCard('Latest class',inductees.length?getSeasonLabel(Math.max(...inductees.map((r)=>r.inductionSeason))):'—','Retirement-year induction')}${statCard('Highest legacy',inductees[0]?Math.round(inductees[0].score):'—',inductees[0]?playerById(inductees[0].playerId)?.name:'No inductees yet')}${statCard('Club legends',(state.history.clubLegends||[]).length,'Recognition belongs to a specific club')}</div>
  <div class="fhof-grid section-gap">${playerSections}</div>
  <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">GREATEST TEAM ERAS</span><h3>Top 10 club teams</h3></div><span class="muted">Best two- or three-season peak under one coach</span></div><div class="fhof-list">${eras.map((x,i)=>`<div class="fhof-row"><b>${i+1}</b><div>${teamLink(x.teamId)}<small>${getSeasonLabel(x.start)} to ${getSeasonLabel(x.end)} · ${coachLink(x.coachId)} · ${x.titles} titles · ${x.wins}/${x.games} wins</small></div><strong>${Math.round(x.score)}</strong></div>`).join('')||'<div class="empty-state compact">Team eras require at least two completed seasons under one coach.</div>'}</div></section>
  <div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">COACHING LEGACY</span><h3>Top 10</h3></div></div><div class="fhof-list">${coaches.map((x,i)=>`<div class="fhof-row"><b>${i+1}</b><div>${coachLink(x.id)}<small>${x.wins}/${x.games} wins · ${x.titles} titles · ${staffRarityBadge(x.coach.rarity)}</small></div><strong>${Math.round(x.score)}</strong></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">PRESIDENTIAL LEGACY</span><h3>Top 10</h3></div></div><div class="fhof-list">${presidents.map((x,i)=>`<div class="fhof-row"><b>${i+1}</b><div>${ownerLink(x.owner.id)}<small>${teamLink(x.clubId)} · ${x.titles} titles · ${staffRarityBadge(x.owner.rarity)}</small></div><strong>${Math.round(x.score)}</strong></div>`).join('')}</div></section></div>
  <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">NATIONAL-TEAM CYCLES</span><h3>Top 5</h3></div><span class="muted">Best four-year window spanning two major tournament opportunities</span></div><div class="fhof-list">${nations.map((x,i)=>`<div class="fhof-row"><b>${i+1}</b><div>${teamLink(x.nation.id,true)}<small>${x.start}–${x.end} · ${x.titles} major titles · ${x.wins}/${x.games} wins</small></div><strong>${Math.round(x.score)}</strong></div>`).join('')||'<div class="empty-state compact">National-team cycles appear after major tournaments.</div>'}</div></section>`;
}

function magazineTabs(active) {
  return `<nav class="competition-tabs"><a href="#/magazine/preseason" class="${active === 'preseason' ? 'active' : ''}">Preseason</a><a href="#/magazine/transfers" class="${active === 'transfers' ? 'active' : ''}">Transfers</a><a href="#/magazine/results" class="${active === 'results' ? 'active' : ''}">Results</a><a href="#/magazine/rankings" class="${active === 'rankings' ? 'active' : ''}">Rankings</a><a href="#/magazine/compare" class="${active === 'compare' ? 'active' : ''}">Comparator</a><a href="#/magazine/fhof" class="${active === 'fhof' ? 'active' : ''}">FHoF</a></nav>`;
}


function playerComparisonStats(playerId) {
  const career = getPlayerCareer(state, playerId); const rows=[...(career.seasons||[]),...(career.current||[])];
  const totals=rows.reduce((a,r)=>{a.games+=r.apps||0;a.goals+=r.goals||0;a.assists+=r.assists||0;a.cleanSheets+=r.cleanSheets||0;a.rating+=(r.averageRating||0)*(r.apps||0);return a;},{games:0,goals:0,assists:0,cleanSheets:0,rating:0});
  totals.averageRating=totals.games?totals.rating/totals.games:0;totals.goalRate=totals.games?totals.goals/totals.games:0;
  const honours=publicHistoryHonours().filter((row)=>row.playerId===playerId);totals.titles=honours.length;totals.continental=honours.filter((row)=>['UCL','UEL','UECL','LIB','SUD','CCC','ACL','CAFCL','OCL','CWC','ICUP'].includes(row.competitionId)).length;totals.international=honours.filter((row)=>row.isInternational).length;return totals;
}
function teamComparisonStats(teamId){const international=Boolean(nationalById(teamId));const all=aggregateTeamAlmanac().find((row)=>row.teamId===teamId&&row.international===international)||{games:0,wins:0,gf:0,ga:0,domesticTitles:0,continentalTitles:0,internationalTitles:0,titles:0};return{...all,winPct:all.games?all.wins/all.games:0,goalsPerGame:all.games?all.gf/all.games:0};}
function comparatorPage(){const type=comparatorType;const pool=type==='players'?[...state.players].sort((a,b)=>b.rating-a.rating):[...state.clubs.map((item)=>({...item,isInternational:false})),...(state.nationalTeams||[]).map((item)=>({...item,isInternational:true,reputation:item.strength,country:item.name}))].sort((a,b)=>(b.reputation||0)-(a.reputation||0));const selected=comparatorIds.map((id)=>type==='players'?playerById(id):(clubById(id)||nationalById(id))).filter(Boolean);const options=pool.slice(0,1500).map((item)=>`<option value="${item.id}" ${comparatorIds.includes(item.id)?'disabled':''}>${esc(item.name)}${type==='players'?` · ${item.position} ${item.rating}`:` · ${item.isInternational?'National team':item.country}`}</option>`).join('');const cards=selected.map((item)=>{if(type==='players'){const s=playerComparisonStats(item.id);return`<article class="comparison-card"><button data-action="remove-comparison" data-id="${item.id}">×</button>${rarityBadge(item.rarity)}<h3>${playerLink(item.id,false)}</h3><p>${item.clubId?teamLink(item.clubId):'Retired / free'} · ${item.position} · ${item.roleLabel}</p><div class="comparison-metrics"><div><span>Games</span><strong>${s.games}</strong></div><div><span>Goals</span><strong>${s.goals}</strong></div><div><span>Assists</span><strong>${s.assists}</strong></div><div><span>Avg rating</span><strong>${s.averageRating?s.averageRating.toFixed(2):'—'}</strong></div><div><span>Goals / game</span><strong>${s.goalRate.toFixed(2)}</strong></div><div><span>Clean sheets</span><strong>${['GK','DF'].includes(item.position)?s.cleanSheets:'—'}</strong></div><div><span>Continental titles</span><strong>${s.continental}</strong></div><div><span>International titles</span><strong>${s.international}</strong></div><div><span>Total titles</span><strong>${s.titles}</strong></div></div></article>`;}const international=Boolean(nationalById(item.id));const s=teamComparisonStats(item.id);return`<article class="comparison-card"><button data-action="remove-comparison" data-id="${item.id}">×</button>${international?flag(item.id,'md'):crest(item.id,'md')}<h3>${teamLink(item.id,international)}</h3><p>${international?'International football':`${item.country} · ${competitionLabel(item.leagueId)}`}</p><div class="comparison-metrics"><div><span>Games</span><strong>${s.games}</strong></div><div><span>Wins</span><strong>${s.wins}</strong></div><div><span>Win %</span><strong>${(s.winPct*100).toFixed(1)}%</strong></div><div><span>Goals</span><strong>${s.gf}</strong></div><div><span>Goals / game</span><strong>${s.goalsPerGame.toFixed(2)}</strong></div><div><span>Domestic titles</span><strong>${s.domesticTitles}</strong></div><div><span>Continental titles</span><strong>${s.continentalTitles}</strong></div><div><span>Total titles</span><strong>${s.titles}</strong></div></div></article>`;}).join('');return`${pageHead('WORLD FOOTBALL MAGAZINE','Comparator','Place up to three careers or clubs side by side using permanent historical totals.')}${magazineTabs('compare')}<section class="panel comparator-controls"><div class="filter-toolbar"><label>Compare<select id="comparator-type"><option value="players" ${type==='players'?'selected':''}>Players</option><option value="teams" ${type==='teams'?'selected':''}>Teams</option></select></label><label>Add ${type==='players'?'player':'team'}<select id="comparator-add"><option value="">Choose…</option>${options}</select></label><span>${selected.length}/3 selected</span></div></section><div class="comparison-grid section-gap">${cards||'<div class="empty-state">Select up to three entries to compare.</div>'}</div>`;}

function universalCompetitionOptions(selected = 'ALL', includeAll = false) {
  const domestic = LEAGUE_DEFINITIONS.map((league) => ({ id: league.id, name: league.name, group: `${league.confederation} leagues` }))
    .concat(LEAGUE_DEFINITIONS.map((league) => ({ id: `CUP-${league.id}`, name: league.cupName, group: `${league.confederation} cups` })));
  const continental = CONTINENTAL_DEFINITIONS.map((competition) => ({ id: competition.id, name: competition.name, group: 'Continental club competitions' }));
  const international = INTERNATIONAL_COMPETITION_CATALOG.map((competition) => ({ id: competition.id, name: competition.name, group: 'International football' }));
  const superCups = Object.values(state.current.superCups || {}).map((competition) => ({ id: competition.id, name: competition.name, group: `${COUNTRY_META[competition.country]?.region || 'World'} super cups` }));
  const global = Object.values(state.current.globalClubCompetitions || {}).map((competition) => ({ id: competition.id, name: competition.name, group: 'Global club competitions' }));
  const all = [...global, ...superCups, ...domestic, ...continental, ...international];
  const groups = new Map();
  all.forEach((item) => { if (!groups.has(item.group)) groups.set(item.group, []); groups.get(item.group).push(item); });
  const allOption = includeAll ? `<option value="ALL" ${selected === 'ALL' ? 'selected' : ''}>All competitions</option>` : '';
  return `${allOption}${[...groups.entries()].map(([group, items]) => `<optgroup label="${esc(group)}">${items.sort((a,b)=>a.name.localeCompare(b.name)).map((item) => `<option value="${item.id}" ${selected === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</optgroup>`).join('')}`;
}

function magazineRankingCompetitionOptions() {
  return universalCompetitionOptions(magazineRankingCompetition, false);
}

function magazineRankingsPage() {
  let description = descriptor(magazineRankingCompetition);
  if (!description) {
    magazineRankingCompetition = 'UCL';
    description = descriptor('UCL');
  }
  const controls = `<section class="panel rankings-control-panel"><div class="filter-toolbar"><label>Competition<select id="magazine-ranking-competition">${magazineRankingCompetitionOptions()}</select></label><label>Metric<select id="magazine-ranking-metric">${[
    ['general','General team ranking'],['playerGoals','Top scoring players'],['playerAssists','Most assists'],['playerRating','Top rated players'],['playerCleanSheets','Most clean sheets'],['playerTitles','Most player titles'],['teamTitles','Most team titles'],['teamGoals','Most team goals'],['teamCleanSheets','Most team clean sheets'],['coachTitles','Most coach titles'],['coachWins','Most coach wins']
  ].map(([value,label]) => `<option value="${value}" ${magazineRankingMetric === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><span>All-time plus current season · Top 50</span></div></section>`;
  const international = description.type === 'international';
  let title = description.name;
  let table = '';
  if (magazineRankingMetric.startsWith('player')) {
    const key = { playerGoals:'goals', playerAssists:'assists', playerRating:'averageRating', playerCleanSheets:'cleanSheets', playerTitles:'titles' }[magazineRankingMetric];
    const rows = aggregatePlayerCompetition(description).sort((a,b) => key === 'averageRating' ? b.averageRating-a.averageRating || b.games-a.games : (b[key]||0)-(a[key]||0) || b.games-a.games).slice(0,50);
    table = `<table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Current club</th><th>Games</th><th>Goals</th><th>Assists</th><th>CS</th><th>Rating</th><th>Titles</th></tr></thead><tbody>${rows.map((row,index)=>{const player=playerById(row.playerId);return `<tr><td>${index+1}</td><td>${playerLink(row.playerId)}</td><td>${player?.position||'—'}</td><td>${player?.clubId?teamLink(player.clubId):'Free / retired'}</td><td>${row.games}</td><td><strong>${row.goals}</strong></td><td>${row.assists}</td><td>${row.cleanSheets}</td><td>${row.averageRating?row.averageRating.toFixed(2):'—'}</td><td><strong>${row.titles}</strong></td></tr>`;}).join('')||'<tr><td colspan="10">No ranking data yet.</td></tr>'}</tbody></table>`;
  } else if (magazineRankingMetric.startsWith('coach')) {
    const key = magazineRankingMetric === 'coachWins' ? 'wins' : 'titles';
    const rows = getCompetitionCoachLeaderboard(state, description.id).sort((a,b)=>(b[key]||0)-(a[key]||0)||b.games-a.games).slice(0,50);
    table = `<table class="data-table"><thead><tr><th>#</th><th>Coach</th><th>Current job</th><th>Rarity</th><th>Games</th><th>Wins</th><th>GF</th><th>GA</th><th>Titles</th></tr></thead><tbody>${rows.map((row,index)=>{const coach=coachById(row.coachId);return `<tr><td>${index+1}</td><td>${coachLink(row.coachId)}</td><td>${coachJob(coach)}</td><td>${coach?staffRarityBadge(coach.rarity):'—'}</td><td>${row.games}</td><td><strong>${row.wins}</strong></td><td>${row.gf}</td><td>${row.ga}</td><td><strong>${row.titles}</strong></td></tr>`;}).join('')||'<tr><td colspan="9">No coach ranking data yet.</td></tr>'}</tbody></table>`;
  } else {
    const rows = aggregateTeamCompetition(description).rows;
    rows.forEach((row)=>{row.generalScore=(row.titles||0)*100+(row.wins||0)*3+(row.goals||0)+(row.cleanSheets||0)*2;});
    const key = { general:'generalScore', teamTitles:'titles', teamGoals:'goals', teamCleanSheets:'cleanSheets' }[magazineRankingMetric] || 'generalScore';
    rows.sort((a,b)=>(b[key]||0)-(a[key]||0)||b.wins-a.wins).splice(50);
    table = `<table class="data-table"><thead><tr><th>#</th><th>Team</th><th>Games</th><th>Wins</th><th>Goals</th><th>Clean sheets</th><th>Titles</th><th>General score</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${index+1}</td><td>${teamLink(row.teamId,international)}</td><td>${row.games}</td><td><strong>${row.wins}</strong></td><td>${row.goals}</td><td>${row.cleanSheets}</td><td><strong>${row.titles}</strong></td><td>${Math.round(row.generalScore)}</td></tr>`).join('')||'<tr><td colspan="8">No team ranking data yet.</td></tr>'}</tbody></table>`;
  }
  return `${pageHead('WORLD FOOTBALL MAGAZINE','Rankings',`Every major league, cup and international competition in one searchable statistical desk.`)}${magazineTabs('rankings')}${controls}<section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">${esc(competitionLabel(description.id))}</span><h3>${esc(title)}</h3></div><span class="panel-chip">${esc(magazineRankingMetric.replace(/([A-Z])/g,' $1'))}</span></div><div class="table-scroll">${table}</div></section>`;
}

function recentCompletedCompetitionCards() {
  const currentMatches = competitionMatchesAll();
  const latestArchivedSeason = Math.max(-Infinity, ...publicHistoryChampions().map((row) => row.season));
  const seasons = new Set([state.season]);
  if (Number.isFinite(latestArchivedSeason)) seasons.add(latestArchivedSeason);
  const entries = [];
  const seen = new Set();
  const add = ({ competitionId, competitionName, winnerId, runnerUpId = null, isInternational = false, season = state.season, seasonLabel = state.current.seasonLabel }) => {
    if (!winnerId) return;
    if (season === state.season && isShowcaseCompetitionEmbargoed(state, competitionId)) return;
    const key = `${season}:${competitionId}`;
    if (seen.has(key)) return;
    seen.add(key);
    const awards = publicHistoryAwards().filter((award) => award.season === season && award.competitionId === competitionId && award.rank === 1);
    let mvpId = awards.find((award) => award.category === 'mvp')?.playerId || null;
    let topScorerId = awards.find((award) => award.category === 'top_scorer')?.playerId || null;
    let topScorerGoals = null;
    if (season === state.season && (!mvpId || !topScorerId)) {
      const live = Object.values(state.current.playerStats || {}).filter((row) => row.competitionId === competitionId && row.apps);
      if (!topScorerId && live.length) {
        const scorer = [...live].sort((a, b) => b.goals - a.goals || b.averageRating - a.averageRating)[0];
        topScorerId = scorer?.playerId || null; topScorerGoals = scorer?.goals ?? null;
      }
      if (!mvpId && live.length) {
        const mvp = [...live].filter((row) => row.apps >= Math.min(5, Math.max(2, Math.floor(Math.max(...live.map((item) => item.apps)) * 0.45))))
          .sort((a, b) => b.averageRating - a.averageRating || b.apps - a.apps)[0];
        mvpId = mvp?.playerId || null;
      }
    }
    if (topScorerId && topScorerGoals == null) {
      const row = (state.history.playerSeasons || []).filter((stat) => stat.season === season && stat.competitionId === competitionId && stat.playerId === topScorerId)[0];
      topScorerGoals = row?.goals ?? null;
    }
    const final = currentMatches.filter((match) => match.competitionId === competitionId && /final/i.test(match.stage || '') && !/semi/i.test(match.stage || '')).sort((a, b) => b.week - a.week)[0];
    const description = descriptor(competitionId);
    const region = description?.country || (isInternational ? 'International football' : 'World football');
    entries.push({ competitionId, competitionName, winnerId, runnerUpId, isInternational, season, seasonLabel, mvpId, topScorerId, topScorerGoals, completionWeek: final?.week ?? (season === state.season ? state.current.week : 52), region, relevance: fhofCompetitionWeight(competitionId, isInternational) });
  };
  for (const champion of publicHistoryChampions()) if (seasons.has(champion.season)) add(champion);
  for (const league of Object.values(state.current.leagues || {})) if (league.championId) add({ competitionId: league.id, competitionName: league.name, winnerId: league.championId, runnerUpId: [...(league.table || [])].sort((a,b)=>b.points-a.points||b.gd-a.gd)[1]?.teamId, seasonLabel: state.current.seasonLabel });
  for (const cup of Object.values(state.current.domesticCups || {})) if (cup.championId) add({ competitionId: cup.id, competitionName: cup.name, winnerId: cup.championId, runnerUpId: cup.finalistId, seasonLabel: state.current.seasonLabel });
  Object.values(state.current.superCups || {}).filter((competition)=>competition.championId).forEach((competition)=>add({competitionId:competition.id,competitionName:competition.name,winnerId:competition.championId,runnerUpId:competition.finalistId,seasonLabel:state.current.seasonLabel}));
  Object.values(state.current.globalClubCompetitions || {}).filter((competition)=>competition.championId && !isShowcaseCompetitionEmbargoed(state, competition.id)).forEach((competition)=>add({competitionId:competition.id,competitionName:competition.name,winnerId:competition.championId,runnerUpId:competition.finalistId,seasonLabel:state.current.seasonLabel}));
  for (const comp of Object.values(state.current.continentalCompetitions || {})) if (comp.championId && !isShowcaseCompetitionEmbargoed(state, comp.id)) add({ competitionId: comp.id, competitionName: comp.name, winnerId: comp.championId, runnerUpId: comp.finalistId, seasonLabel: state.current.seasonLabel });
  for (const comp of Object.values(state.current.internationalCompetitions || {})) if (comp.championId && !isShowcaseCompetitionEmbargoed(state, comp.id)) add({ competitionId: comp.id, competitionName: comp.name, winnerId: comp.championId, runnerUpId: comp.finalistId, isInternational: true, seasonLabel: state.current.seasonLabel });
  return entries.sort((a, b) => b.season - a.season || b.completionWeek - a.completionWeek || b.relevance - a.relevance).slice(0, 12);
}

function magazinePage(tabRaw = 'results') {
  const tab = ['preseason','transfers','results','rankings','compare','fhof'].includes(tabRaw) ? tabRaw : 'results';
  if (tab === 'compare') return comparatorPage();
  if (tab === 'fhof') return fhofPage();
  if (tab === 'rankings') return magazineRankingsPage();
  const lastWeek = state.current.week;
  const firstWeek = Math.max(0, lastWeek - 3);
  if (tab === 'preseason') {
    const newStars = (state.current.newStars || [])
      .map((row) => ({ ...row, player: playerById(row.playerId) }))
      .filter((row) => row.player && ['generational', 'legend', 'epic'].includes(row.player.rarity))
      .sort((a, b) => STAR_RARITIES[b.player.rarity].rank - STAR_RARITIES[a.player.rarity].rank || b.player.baseQuality - a.player.baseQuality);
    const newCoaches = (state.current.newCoaches || [])
      .map((row) => ({ ...row, coach: coachById(row.coachId) }))
      .filter((row) => row.coach && ['generational', 'legend', 'epic'].includes(row.coach.rarity))
      .sort((a, b) => (STAFF_RARITIES[b.coach.rarity]?.rank || 0) - (STAFF_RARITIES[a.coach.rarity]?.rank || 0) || b.coach.quality - a.coach.quality);
    const ownerChanges = (state.current.ownerChanges || [])
      .map((row) => ({ ...row, club: clubById(row.clubId), owner: ownerById(row.ownerId), former: ownerById(row.formerOwnerId) }))
      .filter((row) => row.club && row.owner && (row.major || (row.club.reputation || 0) >= 80))
      .sort((a, b) => (b.club.reputation || 0) - (a.club.reputation || 0));
    const retirements = (state.current.retirements || []);
    const playerRetirements = retirements
      .filter((row) => row.type === 'player')
      .map((row) => ({ ...row, player: playerById(row.playerId) }))
      .filter((row) => row.player)
      .sort((a, b) => (STAR_RARITIES[b.player.rarity]?.rank || 0) - (STAR_RARITIES[a.player.rarity]?.rank || 0) || b.player.baseQuality - a.player.baseQuality);
    const coachRetirements = retirements
      .filter((row) => row.type === 'coach')
      .map((row) => ({ ...row, coach: coachById(row.coachId) }))
      .filter((row) => row.coach)
      .sort((a, b) => (STAFF_RARITIES[b.coach.rarity]?.rank || 0) - (STAFF_RARITIES[a.coach.rarity]?.rank || 0) || b.coach.quality - a.coach.quality);
    const favoriteStories = state.current.news.filter((story) => ['Preseason Favorites', 'Preseason Guide'].includes(story.category)).slice(0, 12);
    const starRows = newStars.map(({ player }) => `<tr><td><div class="portrait-table-cell">${playerPortrait(player, 'sm')}<div>${playerLink(player.id)}${player.realWorldId ? '<span class="historical-icon-badge compact">Historical icon</span>' : ''}</div></div></td><td>${rarityBadge(player.rarity)}</td><td>${flag(player.nationality)} ${esc(countryName(player.nationality))}</td><td>${player.position} · ${esc(player.roleLabel)}</td><td>${player.clubId ? teamLink(player.clubId) : '<span class="free-agent">Free agent</span>'}</td><td>${player.realWorldId ? '<strong>Real</strong>' : '<span class="muted">Procedural</span>'}</td><td><strong>${player.baseQuality}</strong></td></tr>`).join('');
    const coachRows = newCoaches.map(({ coach }) => `<tr><td><div class="portrait-table-cell">${coachPortrait(coach, 'sm')}<div>${coachLink(coach.id)}</div></div></td><td>${staffRarityBadge(coach.rarity)}</td><td>${flag(coach.nationality)} ${esc(countryName(coach.nationality))}</td><td>${esc(COACH_PROFILES[coach.profile]?.label || coach.profileLabel)}</td><td>${esc(COACH_FOCUSES[coach.focus]?.label || 'Balanced')}</td><td><strong>${coach.quality}</strong></td><td>${coachJob(coach)}</td></tr>`).join('');
    const ownerRows = ownerChanges.map(({ club, owner, former }) => `<tr><td>${teamLink(club.id)}</td><td>${former ? `<strong>${esc(former.name)}</strong><small>${staffRarityBadge(former.rarity)}</small>` : '—'}</td><td><strong>${esc(owner.name)}</strong><small>${staffRarityBadge(owner.rarity)} · ${esc(OWNER_PROFILES[owner.profile]?.label || owner.profileLabel)}</small></td><td>${owner.yearsRemaining || '—'} years</td></tr>`).join('');
    const retirementRows = [
      ...playerRetirements.slice(0, 20).map(({ player, formerClubId }) => `<tr><td>Player</td><td>${playerLink(player.id)}</td><td>${rarityBadge(player.rarity)}</td><td>${formerClubId ? teamLink(formerClubId) : '—'}</td><td>${player.careerLength} seasons</td></tr>`),
      ...coachRetirements.slice(0, 12).map(({ coach, formerClubId, formerNationalTeamId }) => `<tr><td>Coach</td><td>${coachLink(coach.id)}</td><td>${staffRarityBadge(coach.rarity)}</td><td>${formerClubId ? teamLink(formerClubId) : formerNationalTeamId ? teamLink(formerNationalTeamId, true) : '—'}</td><td>${coach.careerYear || coach.careerLength} seasons</td></tr>`)
    ].join('');
    return `${pageHead('WORLD FOOTBALL MAGAZINE', 'Preseason', 'Meet the new generation, the incoming coaching class, major boardroom changes and the stars leaving football.')}${magazineTabs(tab)}
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">NEW GENERATION</span><h3>${state.current.seasonLabel} elite rookies</h3></div><span class="muted">Generational, Legend and Epic debuts</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Player</th><th>Rarity</th><th>Nation</th><th>Role</th><th>Starting club</th><th>Origin</th><th>Base</th></tr></thead><tbody>${starRows || '<tr><td colspan="7">No elite rookie entered the world this preseason.</td></tr>'}</tbody></table></div></section>
      <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">NEW COACHES</span><h3>Top coaching prospects</h3></div><span class="muted">New elite coaches entering the market</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Coach</th><th>Rarity</th><th>Nation</th><th>Style</th><th>Focus</th><th>Quality</th><th>Opening job</th></tr></thead><tbody>${coachRows || '<tr><td colspan="7">No Epic-or-better coach entered the market this preseason.</td></tr>'}</tbody></table></div></section>
      <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">BOARDROOM</span><h3>Major-club president changes</h3></div><span class="muted">Only clubs with elite global reputation</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Club</th><th>Outgoing</th><th>Incoming president</th><th>Planned tenure</th></tr></thead><tbody>${ownerRows || '<tr><td colspan="4">No major club changed president this preseason.</td></tr>'}</tbody></table></div></section>
      <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">RETIREMENTS</span><h3>Careers ending this summer</h3></div><span class="muted">${playerRetirements.length} players · ${coachRetirements.length} coaches</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Type</th><th>Name</th><th>Rarity</th><th>Final job</th><th>Career</th></tr></thead><tbody>${retirementRows || '<tr><td colspan="5">No tracked player or coach retired this summer.</td></tr>'}</tbody></table></div></section>
      <section class="panel section-gap"><div class="story-list magazine-list">${favoriteStories.map((story, index) => `<article class="story-card ${index < 2 ? 'major' : 'digest'}"><div class="story-category">${esc(story.category)}</div><h4>${esc(story.headline)}</h4><p>${esc(story.body)}</p></article>`).join('') || '<div class="empty-state">Preseason forecasts will appear after the market and continental draws.</div>'}</div></section>`;
  }
  if (tab === 'transfers') {
    const transfers = state.history.transfers.filter((row) => row.season === state.season).sort((a, b) => {
      const pa = playerById(a.playerId); const pb = playerById(b.playerId);
      const awardsA = publicHistoryAwards().filter((award) => award.playerId === a.playerId && award.rank === 1).length;
      const awardsB = publicHistoryAwards().filter((award) => award.playerId === b.playerId && award.rank === 1).length;
      return (STAR_RARITIES[pb?.rarity]?.rank || 0) * 40 + awardsB * 8 + b.fee - ((STAR_RARITIES[pa?.rarity]?.rank || 0) * 40 + awardsA * 8 + a.fee);
    });
    return `${pageHead('WORLD FOOTBALL MAGAZINE', 'Transfer desk', 'The window freezes after preseason, preserving the biggest moves and decorated stars changing clubs.')}${magazineTabs(tab)}<section class="panel"><div class="panel-head"><div><span class="eyebrow">${state.current.week ? 'WINDOW CLOSED' : 'LIVE MARKET'}</span><h3>${state.current.seasonLabel} major moves</h3></div></div>${transferList(transfers.slice(0, 30))}</section>`;
  }
  const completed = recentCompletedCompetitionCards();
  return `${pageHead('WORLD FOOTBALL MAGAZINE', 'Results', 'Recently completed competitions, their champions and the players who defined each campaign.')}${magazineTabs(tab)}<div class="completed-competition-grid">${completed.map((item) => `<article class="completed-competition-card"><div class="completed-card-head"><div><span>${esc(item.region)}</span><h3>${esc(item.competitionName)}</h3><small>${esc(item.seasonLabel)}</small></div><span class="competition-complete-chip">FINAL</span></div><div class="completed-finalists"><div><span>WINNER</span>${teamLink(item.winnerId, item.isInternational)}</div><div><span>RUNNER-UP</span>${item.runnerUpId ? teamLink(item.runnerUpId, item.isInternational) : '<strong>—</strong>'}</div></div><div class="completed-awards"><div><span>MVP</span>${item.mvpId ? playerLink(item.mvpId) : '<strong>—</strong>'}</div><div><span>TOP SCORER</span>${item.topScorerId ? `${playerLink(item.topScorerId)}${Number.isFinite(item.topScorerGoals) ? `<small>${item.topScorerGoals} goals</small>` : ''}` : '<strong>—</strong>'}</div></div></article>`).join('') || '<div class="empty-state">No major competition has finished yet. Completed tournaments will appear here with winner, runner-up, MVP and top scorer.</div>'}</div>`;
}

function rawCompetitionMatchesAll() {
  const rows = [...(state.current.matches || []), ...(state.current.archivedKnockoutMatches || [])];
  const showcaseFallback = (state.current.postseason?.showcaseMatches || []).map((row) => ({
    id: row.matchId, competitionId: row.competitionId, competitionName: row.competitionName, stage: row.stage, week: row.week,
    homeId: row.homeId, awayId: row.awayId, isInternational: row.isInternational,
    homeGoals: row.finalScore?.home ?? 0, awayGoals: row.finalScore?.away ?? 0, penalties: row.penalties || null,
    winnerId: row.winnerId || null, manOfMatchId: row.manOfMatchId || null, knockout: true, showcaseFallback: true
  }));
  const combined = [...rows, ...showcaseFallback];
  return combined.filter((match, index) => combined.findIndex((item) => item.id === match.id) === index);
}

function hiddenShowcaseMatches(competitionId = null) {
  return rawCompetitionMatchesAll().filter((match) => (!competitionId || match.competitionId === competitionId) && isShowcaseMatchEmbargoed(state, match));
}

function publicHistoryChampions() {
  return (state.history.champions || []).filter((row) => !(row.season === state.season && isShowcaseCompetitionEmbargoed(state, row.competitionId)));
}

function publicHistoryHonours() {
  return (state.history.honours || []).filter((row) => !(row.season === state.season && isShowcaseCompetitionEmbargoed(state, row.competitionId)));
}

function publicHistoryAwards() {
  return (state.history.awards || []).filter((row) => !(row.season === state.season && row.competitionId && isShowcaseCompetitionEmbargoed(state, row.competitionId)));
}

function publicNewsRows() {
  return (state.current.news || []).filter((story) => {
    if (story.matchId) {
      const match = rawCompetitionMatchesAll().find((row) => row.id === story.matchId);
      if (match && isShowcaseMatchEmbargoed(state, match)) return false;
    }
    if (story.competitionId && isShowcaseCompetitionEmbargoed(state, story.competitionId)) return false;
    const lockedIds = Object.keys(state.current.postseason?.selections || {}).filter((id) => isShowcaseCompetitionEmbargoed(state, id));
    if (lockedIds.some((id) => String(story.id || '').includes(`-${id}-champion`))) return false;
    if (state.current.postseason?.prepared && !state.current.postseason?.completed && story.category === 'Season Summary') return false;
    return true;
  });
}

function pendingShowcasePanel(description) {
  const pending = hiddenShowcaseMatches(description.id).sort((a,b)=>(a.week||0)-(b.week||0));
  if (!pending.length) return '';
  const rows = pending.slice(0, 8).map((match) => {
    const finalLocked = /^final$/i.test(String(match.stage || '').trim()) && pending.some((row) => /semi-final/i.test(String(row.stage || '')));
    if (finalLocked) return `<div class="next-round-match showcase-embargo-row"><small>${esc(match.stage || 'Final')}</small><div><strong>Awaiting semi-final winners</strong></div><span class="panel-chip">SHOWCASE EMBARGO</span></div>`;
    return `<div class="next-round-match showcase-embargo-row"><small>${esc(match.stage || 'Knockout')}</small><div>${teamLink(match.homeId, match.isInternational)}<strong>vs</strong>${teamLink(match.awayId, match.isInternational)}</div><span class="panel-chip">SHOWCASE EMBARGO</span></div>`;
  }).join('');
  return `<section class="panel current-round-panel showcase-embargo-panel"><div class="panel-head"><div><span class="eyebrow">SHOWCASE EMBARGO</span><h3>Results hidden until you play them</h3></div><a href="#/postseason/games">Open showcase →</a></div><div class="next-round-list">${rows}</div></section>`;
}

function competitionMatchesAll() {
  return rawCompetitionMatchesAll().filter((match) => !isShowcaseMatchEmbargoed(state, match));
}

function aOrAnRating(rating) {
  return `a ${Number(rating || 0).toFixed(1)} rating`;
}

function awardsPage(sectionRaw = 'current', categoryRaw = 'ballon_dor') {
  const section = sectionRaw === 'history' ? 'history' : 'current';
  const category = ['ballon_dor','golden_boot','kopa','positions'].includes(categoryRaw) ? categoryRaw : 'ballon_dor';
  const mainTabs = `<nav class="competition-tabs"><a href="#/awards/current" class="${section === 'current' ? 'active' : ''}">Current Year</a><a href="#/awards/history/${category}" class="${section === 'history' ? 'active' : ''}">History</a></nav>`;
  if (section === 'current') {
    const race = getAnnualAwardRace(state);
    const raceTable = (title, rows, note) => `<section class="panel"><div class="panel-head"><div><span class="eyebrow">CURRENT RACE</span><h3>${esc(title)}</h3></div><span class="muted">${esc(note)}</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Apps</th><th>Goals</th><th>Assists</th><th>Weighted goals</th><th>Rating</th><th>Trophy bonus</th><th>Score</th></tr></thead><tbody>${rows.slice(0, 10).map((row, index) => `<tr><td>${index + 1}</td><td>${playerLink(row.playerId)}</td><td>${row.components.apps}</td><td>${row.components.goals}</td><td>${row.components.assists}</td><td>${row.components.weightedGoals}</td><td>${row.components.averageRating}</td><td>${row.components.trophyBonus}</td><td><strong>${row.components.teamDiversityScore ?? row.components.score}</strong></td></tr>`).join('') || '<tr><td colspan="9">The race begins after players record enough matches.</td></tr>'}</tbody></table></div></section>`;
    return `${pageHead('ANNUAL AWARDS', 'Current year races', 'See the components driving the Ballon d’Or, weighted Golden Boot and Kopa Trophy before the ceremony.')}${mainTabs}<div class="award-race-stack">${raceTable("Ballon d'Or", race.ballonDor, 'Performance, competition strength, trophies and podium diversity')}${raceTable('World Golden Boot', race.goldenBoot, 'League goals receive coefficient weighting')}${raceTable('Kopa Trophy', race.kopa, 'Under 21, with additional potential weighting')}</div>`;
  }
  const subTabs = `<nav class="sub-tabs"><a href="#/awards/history/ballon_dor" class="${category === 'ballon_dor' ? 'active' : ''}">Ballon d'Or</a><a href="#/awards/history/golden_boot" class="${category === 'golden_boot' ? 'active' : ''}">Golden Boot</a><a href="#/awards/history/kopa" class="${category === 'kopa' ? 'active' : ''}">Kopa Trophy</a><a href="#/awards/history/positions" class="${category === 'positions' ? 'active' : ''}">Best by Position</a></nav>`;
  const awards = publicHistoryAwards();
  const seasons = [...new Set(awards.map((award) => award.season))].sort((a, b) => b - a);
  let table = '';
  if (category === 'positions') {
    table = `<table class="data-table"><thead><tr><th>Season</th><th>Best GK</th><th>Best DEF</th><th>Best MID</th><th>Best FWD</th></tr></thead><tbody>${seasons.map((season) => `<tr><td><strong>${getSeasonLabel(season)}</strong></td>${['gk','df','mf','fw'].map((position) => `<td>${playerLink(awards.find((award) => award.season === season && award.category === `best_${position}`)?.playerId)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="5">No awards yet.</td></tr>'}</tbody></table>`;
  } else {
    const label = category === 'ballon_dor' ? "Ballon d'Or" : category === 'golden_boot' ? 'World Golden Boot' : 'Kopa Trophy';
    table = `<table class="data-table"><thead><tr><th>Season</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr></thead><tbody>${seasons.map((season) => `<tr><td><strong>${getSeasonLabel(season)}</strong></td>${[1,2,3].map((rank) => `<td>${playerLink(awards.find((award) => award.season === season && award.category === category && award.rank === rank)?.playerId)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="4">No ${esc(label)} history yet.</td></tr>`}</tbody></table>`;
  }
  return `${pageHead('ANNUAL AWARDS', 'Historical honors', 'Gold, silver and bronze are retained for the three global podium awards. Positional awards exclude the Ballon d’Or winner.')}${mainTabs}${subTabs}<section class="panel"><div class="table-scroll">${table}</div></section>`;
}


function nextShowcaseSeasonForCompetition(competitionId) {
  const currentSeason = Number(state.season);
  const mod = ((currentSeason % 4) + 4) % 4;
  if (competitionId === 'WC') {
    const delta = (1 - mod + 4) % 4;
    return currentSeason + delta;
  }
  if (['EURO','COPA','AFCON','ASIACUP','GOLDCUP','OFC'].includes(competitionId)) {
    const delta = (3 - mod + 4) % 4;
    return currentSeason + delta;
  }
  if (competitionId === 'CWC') {
    const delta = (0 - mod + 4) % 4;
    return currentSeason + delta;
  }
  return currentSeason;
}

function postseasonCompetitionOptions() {
  const clubRows = Object.values(state.current.continentalCompetitions || {})
    .filter((competition) => {
      const definition = CONTINENTAL_DEFINITIONS.find((item) => item.id === competition.id);
      return definition && definition.level <= 2;
    })
    .map((competition) => ({ ...competition, category: 'Club continental', isInternational: false, availableThisSeason: true, twoLegSemis: true, nextSeason: state.season }));
  const globalRows = Object.values(state.current.globalClubCompetitions || {})
    .filter((competition) => ['CWC','ICUP'].includes(competition.id))
    .map((competition) => ({ ...competition, category: 'Global club', isInternational: false, availableThisSeason: true, twoLegSemis: false, nextSeason: state.season }));

  const currentNational = Object.values(state.current.internationalCompetitions || {})
    .filter((competition) => competition.kind === 'finals' && !competition.friendly)
    .map((competition) => ({ ...competition, category: 'National teams', isInternational: true, availableThisSeason: true, twoLegSemis: false, nextSeason: state.season }));
  const currentNationalIds = new Set(currentNational.map((competition) => competition.id));
  const futureNational = INTERNATIONAL_COMPETITION_CATALOG
    .filter((competition) => competition.type === 'finals' && ['WC','EURO','COPA','AFCON','ASIACUP','GOLDCUP','OFC'].includes(competition.id) && !currentNationalIds.has(competition.id))
    .map((competition) => {
      const nextSeason = nextShowcaseSeasonForCompetition(competition.id);
      return {
        id: competition.id,
        name: competition.name,
        confederation: competition.confederation,
        category: 'National teams',
        isInternational: true,
        availableThisSeason: nextSeason === state.season,
        twoLegSemis: false,
        nextSeason,
        editionYear: nextSeason + 1,
        future: nextSeason !== state.season
      };
    });

  const cwcPresent = globalRows.some((competition) => competition.id === 'CWC');
  if (!cwcPresent) {
    const nextSeason = nextShowcaseSeasonForCompetition('CWC');
    globalRows.push({
      id: 'CWC',
      name: 'FIFA Club World Cup',
      confederation: 'World',
      category: 'Global club',
      isInternational: false,
      availableThisSeason: nextSeason === state.season,
      twoLegSemis: false,
      nextSeason,
      editionYear: nextSeason + 1,
      future: nextSeason !== state.season
    });
  }

  return [...globalRows, ...clubRows, ...currentNational, ...futureNational]
    .filter((competition, index, rows) => rows.findIndex((row) => row.id === competition.id) === index);
}

function postseasonSelectionCount(mode, competition = null) {
  if (mode === 'final') return 1;
  if (mode !== 'semis') return 0;
  return competition?.twoLegSemis ? 5 : 3;
}

function postseasonSetupPage() {
  const postseason = state.current.postseason ||= { selections: {}, prepared: false, phase: 'setup', showcaseMatches: [], awards: [], awardActiveIndex: 0, completed: false };
  state.showcasePreferences ||= { ...(postseason.selections || {}) };
  postseason.selections = { ...state.showcasePreferences, ...(postseason.selections || {}) };
  const options = postseasonCompetitionOptions();
  const totalGames = options.reduce((sum, competition) => competition.availableThisSeason ? sum + postseasonSelectionCount(postseason.selections?.[competition.id] || 'none', competition) : sum, 0);
  const futureSaved = options.filter((competition) => !competition.availableThisSeason && (postseason.selections?.[competition.id] || 'none') !== 'none').length;
  const groups = ['Global club','Club continental','National teams'];
  const sections = groups.map((category) => {
    const rows = options.filter((competition) => competition.category === category);
    if (!rows.length) return '';
    return `<section class="panel postseason-selector-section"><div class="panel-head"><div><span class="eyebrow">${esc(category.toUpperCase())}</span><h3>${category}</h3></div></div><div class="postseason-selector-grid">${rows.map((competition) => {
      const selected = postseason.selections?.[competition.id] || 'none';
      const timing = competition.availableThisSeason
        ? `${getSeasonLabel(state.season)} · playing this season`
        : `Next edition · ${getSeasonLabel(competition.nextSeason)}`;
      return `<article class="postseason-selector-card ${selected !== 'none' ? 'selected' : ''} ${competition.availableThisSeason ? '' : 'future-showcase'}"><div class="postseason-selector-title">${competitionEmblem(competition.id,'sm')}<div><strong>${esc(competition.name)}</strong><small>${esc(competition.confederation || competition.category)} · ${esc(timing)}</small></div></div><div class="postseason-choice-row">${[['none','Nothing'],['final','Final'],['semis','Semis + Final']].map(([mode,label]) => { const count = postseasonSelectionCount(mode, competition); return `<button class="postseason-choice ${selected === mode ? 'active' : ''}" data-action="showcase-select" data-competition-id="${esc(competition.id)}" data-mode="${mode}">${label}<small>${count} game${count === 1 ? '' : 's'}${competition.availableThisSeason ? '' : ' · saved'}</small></button>`; }).join('')}</div></article>`;
    }).join('')}</div></section>`;
  }).join('');
  const summary = totalGames
    ? `${totalGames} showcase games this season${futureSaved ? ` · ${futureSaved} future selection${futureSaved === 1 ? '' : 's'} saved` : ''}`
    : futureSaved
      ? `${futureSaved} future tournament selection${futureSaved === 1 ? '' : 's'} saved`
      : 'No showcase games selected';
  return `${pageHead('POSTSEASON SHOWCASE', 'Choose the matches you want to experience', 'Selections can be saved even when a tournament is not being played this season. Future competitions show the year of their next edition and remain selected until you change them.')}
    <section class="postseason-setup-hero"><div><span class="eyebrow">OPTIONAL MATCH SHOWCASE</span><h2>${summary}</h2><p>${totalGames ? 'To End-of-Season Showcase calculates the season in the background, then embargoes every selected showcase result until you reveal it here.' : futureSaved ? 'Your future selections are saved. This season will only stop for tournaments that are actually being played now.' : 'Leave everything on Nothing for the normal season simulation. Awards Night will still be available when the season ends.'}</p></div><div class="postseason-count"><strong>${totalGames}</strong><span>THIS YEAR</span></div></section>${sections}`;
}

function postseasonTeamMark(id, isInternational, size = 'lg') {
  return isInternational ? flag(id, size === 'lg' ? 'lg' : 'sm') : crest(id, size);
}

function postseasonGoalTheme(id, isInternational) {
  if (isInternational) {
    const hue = Math.abs(String(id || 'nation').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) * 17) % 360;
    return `--goal-bg:linear-gradient(135deg,hsl(${hue} 68% 42%),hsl(${hue} 72% 27%));--goal-fg:#ffffff;--goal-accent:rgba(255,255,255,.72)`;
  }
  const club = clubById(id);
  const visual = CLUB_VISUALS[club?.name] || null;
  if (!visual) {
    const hue = club?.crestHue ?? 215;
    return `--goal-bg:linear-gradient(135deg,hsl(${hue} 72% 48%),hsl(${hue} 76% 28%));--goal-fg:#ffffff;--goal-accent:rgba(255,255,255,.70)`;
  }
  const primary = visual[0];
  const secondary = visual[1] || '#ffffff';
  const accent = visual[2] || secondary;
  const whitePrimary = /^#(?:fff|ffffff)$/i.test(primary.trim());
  const lightPrimary = /^#(?:ffe667|fde100|fff200|f5c400|ffed00)$/i.test(primary.trim());
  const foreground = whitePrimary || lightPrimary ? secondary : '#ffffff';
  return `--goal-bg:${primary};--goal-fg:${foreground};--goal-accent:${accent}`;
}

function postseasonGamesPage() {
  const postseason = state.current.postseason;
  if (!state.current.completed || !postseason?.prepared) return postseasonSetupPage();
  const matches = postseason.showcaseMatches || [];
  if (!matches.length) return postseasonAwardsPage();
  const unresolved = matches.filter((match) => !match.resolved).length;
  const competitionIds = [...new Set(matches.map((match) => match.competitionId))];
  const competitionSections = competitionIds.map((competitionId) => {
    const rows = matches.filter((match) => match.competitionId === competitionId).sort((a,b)=>a.week-b.week || String(a.stage || '').localeCompare(String(b.stage || '')));
    return `<section class="panel postseason-tournament"><div class="panel-head"><div><span class="eyebrow">SHOWCASE TOURNAMENT</span><h3>${esc(rows[0]?.competitionName || competitionId)}</h3></div>${competitionEmblem(competitionId,'md')}</div><div class="postseason-match-list">${rows.map((match) => {
      const earlierUnresolved = rows.some((row) => row.week < match.week && !row.resolved);
      const finalRound = /^final$/i.test(String(match.stage || '').trim());
      const locked = earlierUnresolved;
      const hideTeams = finalRound && locked;
      const home = hideTeams ? 'Awaiting semi-final winner' : getEntityName(state, match.homeId, match.isInternational);
      const away = hideTeams ? 'Awaiting semi-final winner' : getEntityName(state, match.awayId, match.isInternational);
      let status = 'Ready';
      if (match.resolved) {
        if (match.aggregate?.leg === 2) status = `Aggregate ${match.aggregate.homeFinal}–${match.aggregate.awayFinal}${match.penalties ? ` · pens ${match.penalties.home}–${match.penalties.away}` : ''}`;
        else if (match.aggregate?.leg === 1) status = `First leg · ${match.finalScore.home}–${match.finalScore.away}`;
        else status = `${match.finalScore.home}–${match.finalScore.away}${match.penalties ? ` · pens ${match.penalties.home}–${match.penalties.away}` : ''}`;
      } else if (locked) {
        status = finalRound ? 'Awaiting semi-finals' : 'Awaiting previous leg';
      } else if (match.aggregate?.leg === 2) {
        status = `Second leg · aggregate starts ${match.aggregate.homeBefore}–${match.aggregate.awayBefore}`;
      }
      const homeMark = hideTeams ? '<span class="showcase-team-placeholder">?</span>' : postseasonTeamMark(match.homeId, match.isInternational, 'md');
      const awayMark = hideTeams ? '<span class="showcase-team-placeholder">?</span>' : postseasonTeamMark(match.awayId, match.isInternational, 'md');
      return `<button class="postseason-match-card ${match.resolved ? 'resolved' : ''} ${locked ? 'locked' : ''}" ${locked ? 'disabled' : ''} data-action="open-postseason-match" data-match-id="${esc(match.id)}"><span class="postseason-stage">${esc(match.stage || 'Knockout')}</span><div class="postseason-match-teams"><div>${homeMark}<strong>${esc(home)}</strong></div><b>${match.resolved ? match.finalScore.home : '–'}</b><span>vs</span><b>${match.resolved ? match.finalScore.away : '–'}</b><div>${awayMark}<strong>${esc(away)}</strong></div></div><small>${esc(status)}</small></button>`;
    }).join('')}</div></section>`;
  }).join('');
  return `${pageHead('POSTSEASON', `${state.current.seasonLabel} Showcase Games`, 'Watch the major matches you selected. Two-leg ties are played in full, aggregate scores evolve naturally, and later rounds stay hidden until the teams actually qualify.')}
    <section class="postseason-progress"><div><span class="eyebrow">SHOWCASE QUEUE</span><h2>${matches.length - unresolved} of ${matches.length} complete</h2><p>Watch the clock run minute by minute, pause at the breaks, or quick simulate any unlocked match.</p></div><div class="postseason-progress-meter"><i style="width:${matches.length ? Math.round((matches.length-unresolved)/matches.length*100) : 100}%"></i></div>${unresolved === 0 ? '<button class="primary-button" data-action="postseason-to-awards">Continue to Awards Night</button>' : ''}</section>${competitionSections}`;
}

function postseasonPodiumEntry(entry, rank, visible, winner = false) {
  if (!visible || !entry) return `<div class="award-podium-entry placeholder rank-${rank}"><span>${rank === 1 ? 'WINNER' : rank === 2 ? 'SECOND' : 'THIRD'}</span><strong>?</strong></div>`;
  const player = playerById(entry.playerId);
  return `<div class="award-podium-entry revealed rank-${rank} ${winner ? 'winner' : ''}">${player ? playerPortrait(player, winner ? 'lg' : 'md') : ''}<div><span>${rank === 1 ? 'WINNER' : rank === 2 ? 'SECOND' : 'THIRD'}</span><strong>${esc(entry.name)}</strong><small>${entry.position} · ${entry.clubId ? esc(clubById(entry.clubId)?.name || 'Club') : esc(countryName(entry.nationality))}</small></div></div>`;
}

function postseasonWinnerDetails(entry) {
  if (!entry) return '';
  const player = playerById(entry.playerId);
  const stats = entry.stats || {};
  const trophies = (entry.trophies || []).map((name) => `<span>${esc(name)}</span>`).join('');
  const awards = (entry.awards || []).map((name) => `<span>${esc(name)}</span>`).join('');
  return `<div class="award-winner-details">${player ? playerPortrait(player,'xl') : ''}<div class="award-winner-copy"><span class="eyebrow">SEASON PROFILE</span><h2>${esc(entry.name)}</h2><p>${entry.position} · ${entry.clubId ? esc(clubById(entry.clubId)?.name || 'Club') : esc(countryName(entry.nationality))}</p><div class="award-season-stats"><div><strong>${stats.apps || 0}</strong><span>Games</span></div><div><strong>${stats.goals || 0}</strong><span>Goals</span></div><div><strong>${stats.assists || 0}</strong><span>Assists</span></div><div><strong>${stats.averageRating ? Number(stats.averageRating).toFixed(2) : '—'}</strong><span>Rating</span></div>${entry.position === 'GK' || entry.position === 'DF' ? `<div><strong>${stats.cleanSheets || 0}</strong><span>Clean sheets</span></div>` : ''}</div>${trophies ? `<div class="award-honour-row"><b>Trophies</b>${trophies}</div>` : ''}${awards ? `<div class="award-honour-row"><b>Awards</b>${awards}</div>` : ''}</div></div>`;
}

function postseasonAwardsPage() {
  const postseason = state.current.postseason;
  if (!state.current.completed || !postseason?.prepared) return postseasonSetupPage();
  const awards = postseason.awards || [];
  postseason.awardActiveIndex = Math.max(0, Math.min(Number.isInteger(postseason.awardActiveIndex) ? postseason.awardActiveIndex : 0, Math.max(0, awards.length - 1)));
  const activeIndex = postseason.awardActiveIndex;
  const active = awards[activeIndex];
  const stage = active?.revealStage || 0;
  const podium = active?.podium || [];
  const winner = podium.find((row) => row.rank === 1) || podium[0];
  const allRevealed = awards.length > 0 && awards.every((award) => (award.revealStage || 0) >= 3);
  const cards = awards.map((award, index) => `<button type="button" class="award-ceremony-chip ${index === activeIndex ? 'active' : ''} ${(award.revealStage || 0) >= 3 ? 'done' : ''}" data-action="select-postseason-award" data-award-index="${index}"><span>${index + 1}</span><b>${esc(award.title)}</b></button>`).join('');
  let actionMarkup = '';
  if (postseasonAwardAnimating) {
    actionMarkup = '<span class="showcase-live-chip">Revealing podium…</span>';
  } else if (!active) {
    actionMarkup = '<button class="primary-button" data-action="finish-postseason">Continue to Offseason</button>';
  } else if (allRevealed) {
    actionMarkup = '<button class="primary-button" data-action="finish-postseason">Continue to Offseason</button>';
  } else if (stage < 3) {
    actionMarkup = '<button class="primary-button award-next-button" data-action="reveal-next-award">Reveal Award</button><button class="control-button" data-action="reveal-all-awards">Reveal All</button>';
  } else if (activeIndex < awards.length - 1) {
    actionMarkup = '<button class="primary-button award-next-button" data-action="advance-postseason-award">Next Award</button><button class="control-button" data-action="reveal-all-awards">Reveal All</button>';
  } else {
    const firstHidden = awards.findIndex((award) => (award.revealStage || 0) < 3);
    actionMarkup = `<button class="primary-button" data-action="select-postseason-award" data-award-index="${firstHidden >= 0 ? firstHidden : 0}">Go to Unrevealed Award</button><button class="control-button" data-action="reveal-all-awards">Reveal All</button>`;
  }
  return `${pageHead('AWARDS NIGHT', `${state.current.seasonLabel} World Awards`, 'Reveal each podium and stop on the winner. Move to the next award only when you choose to; the award tabs can also be used to revisit any category.')}
    <section class="awards-night-shell"><div class="award-ceremony-progress">${cards}</div>${active ? `<div class="award-stage ${active.title === "Ballon d'Or" ? 'ballon-stage' : ''}"><span class="eyebrow">${activeIndex + 1} OF ${awards.length}</span><h1>${esc(active.title)}</h1><div class="award-podium">${postseasonPodiumEntry(podium.find((row)=>row.rank===3),3,stage>=1)}${postseasonPodiumEntry(podium.find((row)=>row.rank===2),2,stage>=2)}${postseasonPodiumEntry(winner,1,stage>=3,true)}</div>${stage >= 3 ? postseasonWinnerDetails(winner) : '<div class="award-reveal-placeholder">Podium hidden</div>'}</div>` : '<div class="empty-state">No annual awards were generated for this season.</div>'}<div class="award-ceremony-actions">${actionMarkup}</div></section>`;
}

function postseasonPage(section = 'setup') {
  if (!state.current.completed) return postseasonSetupPage();
  const postseason = state.current.postseason;
  if (!postseason?.prepared) return postseasonSetupPage();
  const unresolved = (postseason.showcaseMatches || []).some((match) => !match.resolved);
  if (section === 'games' && (postseason.showcaseMatches || []).length) return postseasonGamesPage();
  if (section === 'awards' || !unresolved) return postseasonAwardsPage();
  return postseasonGamesPage();
}

function postseasonMatchModal() {
  if (!postseasonMatchModalId || !state?.current?.postseason?.prepared) return '';
  const match = (state.current.postseason.showcaseMatches || []).find((row) => row.id === postseasonMatchModalId);
  if (!match) return '';
  const timeline = (match.liveTimeline && match.liveTimeline.length) ? match.liveTimeline : (match.ticks || []);
  const finalIndex = Math.max(0, timeline.length - 1);
  const index = match.resolved ? finalIndex : Math.min(postseasonTickIndex, finalIndex);
  const tick = timeline[index] || { label: "0'", minute: 0, homeGoals: 0, awayGoals: 0, home: {}, away: {}, events: [], minuteEvents: [] };
  const homeName = getEntityName(state, match.homeId, match.isInternational);
  const awayName = getEntityName(state, match.awayId, match.isInternational);
  const statRows = [
    ['Shots','shots'],['On target','onTarget'],['Corners','corners'],['Possession','possession'],['Yellow cards','yellow'],['Red cards','red']
  ];
  const currentMinuteEvents = tick.minuteEvents || [];
  const goalNow = currentMinuteEvents.filter((event) => event.type === 'goal');
  const currentGoalBanner = goalNow.length ? goalNow.map((event) => {
    const teamName = event.side === 'home' ? homeName : awayName;
    const scorer = event.scorerId ? playerById(event.scorerId)?.name : 'Squad player';
    const teamId = event.side === 'home' ? match.homeId : match.awayId;
    return `<div class="showcase-goal-flash" style="${postseasonGoalTheme(teamId, match.isInternational)}"><span>GOAL ${esc(teamName).toUpperCase()}!</span><strong>${esc(scorer || 'Squad player')}</strong><small>${event.minute}'</small></div>`;
  }).join('') : '';
  const formatEvent = (event) => {
    const scorer = event.scorerId ? playerById(event.scorerId)?.name : 'Squad player';
    const assist = event.assistId ? ` · assist ${playerById(event.assistId)?.name || 'Squad player'}` : '';
    const icon = event.type === 'goal' ? '⚽' : event.type === 'yellow' ? '🟨' : event.type === 'red' ? '🟥' : '•';
    const copy = event.type === 'goal' ? `${scorer}${assist}` : event.type === 'yellow' ? 'Yellow card' : event.type === 'red' ? 'Red card' : 'Match event';
    return `<div class="live-event ${event.side} ${event.type || ''}"><b>${event.minute}'</b><span>${icon} ${esc(copy)}</span></div>`;
  };
  const events = (tick.events || []).slice().sort((a,b)=>a.minute-b.minute).slice(-10).map(formatEvent).join('') || '<div class="live-event-empty">Match underway. No major events yet.</div>';
  const aggregateHome = match.aggregate?.leg === 2 ? Number(match.aggregate.homeBefore || 0) + Number(tick.homeGoals || 0) : null;
  const aggregateAway = match.aggregate?.leg === 2 ? Number(match.aggregate.awayBefore || 0) + Number(tick.awayGoals || 0) : null;
  const agg = match.aggregate?.leg === 2 ? `<div class="showcase-aggregate">Aggregate ${aggregateHome}–${aggregateAway}</div>` : match.aggregate?.leg === 1 ? '<div class="showcase-aggregate">First leg</div>' : '';
  const penaltySequence = match.penaltySequence || [];
  const visiblePenaltyCount = match.resolved ? penaltySequence.length : Math.min(postseasonPenaltyIndex, penaltySequence.length);
  const visiblePenalties = penaltySequence.slice(0, visiblePenaltyCount);
  const currentPenalty = visiblePenalties[visiblePenalties.length - 1];
  const penaltyScore = currentPenalty ? { home: currentPenalty.home, away: currentPenalty.away } : { home: 0, away: 0 };
  const penaltyStage = Boolean(match.penalties && (postseasonPauseReason === 'penalties' || postseasonPauseReason === 'penalty-live' || match.resolved || visiblePenaltyCount));
  const pen = penaltyStage ? `<div class="showcase-penalties">Penalties <strong>${penaltyScore.home}–${penaltyScore.away}</strong></div>` : '';
  const penaltyFeed = penaltyStage && visiblePenalties.length ? `<div class="showcase-penalty-feed">${visiblePenalties.slice(-8).map((kick) => {
    const taker = kick.playerId ? playerById(kick.playerId)?.name : 'Squad player';
    return `<div class="penalty-kick ${kick.side} ${kick.scored ? 'scored' : 'missed'}"><span>R${kick.round}</span><b>${kick.scored ? '●' : '×'}</b><strong>${esc(taker || 'Squad player')}</strong></div>`;
  }).join('')}</div>` : '';
  const clockLabel = penaltyStage && postseasonPauseReason === 'penalty-live' ? 'PENS' : tick.minute === 45 && postseasonPauseReason === 'half' ? 'HT' : tick.minute === 120 && !match.penalties && match.extraTime ? 'AET' : tick.label;
  const pauseReason = postseasonPauseReason || match.liveProgress?.pauseReason || null;
  let actionMarkup = '';
  if (match.resolved) {
    actionMarkup = '<span class="season-complete-chip">Match complete</span>';
  } else if (postseasonAnimating) {
    actionMarkup = `<span class="showcase-live-chip">● LIVE · ${penaltyStage ? 'shootout' : `minute ${tick.minute}`}</span><div class="showcase-speed-control"><button class="${postseasonPlaybackSpeed === 1 ? 'active' : ''}" data-action="postseason-speed" data-speed="1">1×</button><button class="${postseasonPlaybackSpeed === 2 ? 'active' : ''}" data-action="postseason-speed" data-speed="2">2×</button></div>`;
  } else if (pauseReason === 'half') {
    actionMarkup = '<span class="showcase-break-chip">HALF TIME</span><button class="primary-button" data-action="continue-postseason-match">Continue Second Half</button><button class="control-button" data-action="quick-postseason-match">Quick Simulate</button>';
  } else if (pauseReason === 'regulation') {
    actionMarkup = '<span class="showcase-break-chip">END OF REGULATION</span><button class="primary-button" data-action="continue-postseason-match">Continue to Extra Time</button><button class="control-button" data-action="quick-postseason-match">Quick Simulate</button>';
  } else if (pauseReason === 'extra-half') {
    actionMarkup = '<span class="showcase-break-chip">EXTRA-TIME HALF</span><button class="primary-button" data-action="continue-postseason-match">Continue Extra Time</button><button class="control-button" data-action="quick-postseason-match">Quick Simulate</button>';
  } else if (pauseReason === 'penalties') {
    actionMarkup = '<span class="showcase-break-chip">END OF EXTRA TIME</span><button class="primary-button" data-action="continue-postseason-penalties">Continue to Penalties</button><button class="control-button" data-action="quick-postseason-match">Quick Simulate</button>';
  } else {
    actionMarkup = '<button class="primary-button" data-action="watch-postseason-match">Simulate Game</button><button class="control-button" data-action="quick-postseason-match">Quick Simulate</button>';
  }
  return `<div class="showcase-modal-backdrop"><section class="showcase-match-modal"><button class="close-button showcase-close" data-action="close-postseason-match" ${postseasonAnimating ? 'disabled' : ''}>×</button><div class="showcase-modal-head"><span class="eyebrow">${esc(match.competitionName)}</span><h3>${esc(match.stage || 'Knockout')}</h3></div>${currentGoalBanner}<div class="showcase-scoreboard"><div>${postseasonTeamMark(match.homeId,match.isInternational,'lg')}<strong>${esc(homeName)}</strong></div><div class="showcase-score"><span>${esc(clockLabel)}</span><b>${tick.homeGoals}</b><i>–</i><b>${tick.awayGoals}</b>${agg}${pen}</div><div>${postseasonTeamMark(match.awayId,match.isInternational,'lg')}<strong>${esc(awayName)}</strong></div></div><div class="showcase-live-grid"><div class="showcase-events"><span class="eyebrow">MATCH EVENTS</span>${events}${penaltyFeed}</div><div class="showcase-stats"><span class="eyebrow">LIVE STATS</span>${statRows.map(([label,key]) => `<div class="showcase-stat-row"><strong>${key === 'possession' ? `${tick.home?.[key] ?? 50}%` : tick.home?.[key] ?? 0}</strong><span>${label}</span><strong>${key === 'possession' ? `${tick.away?.[key] ?? 50}%` : tick.away?.[key] ?? 0}</strong></div>`).join('')}</div></div><div class="showcase-modal-actions">${actionMarkup}</div></section></div>`;
}

function transferList(transfers, compact = false) {
  if (!transfers.length) return '<div class="empty-state compact">No transfers recorded.</div>';
  return `<div class="transfer-list ${compact ? 'compact' : ''}">${transfers.map((transfer) => {
    const player = playerById(transfer.playerId);
    const portrait = player && ['epic','legend','generational'].includes(player.rarity) ? playerPortrait(player,'sm') : '';
    return `<div class="transfer-row"><div class="transfer-player transfer-player-visual">${portrait}<div>${player ? `${rarityBadge(player.rarity)}${playerLink(player.id, false)}` : 'Unknown player'}<small>${player ? `${player.position} · ${player.roleLabel}` : ''}</small></div></div><div class="transfer-route"><span>${transfer.fromClubId ? esc(clubById(transfer.fromClubId)?.name) : 'Free agency'}</span><b>→</b><span>${esc(clubById(transfer.toClubId)?.name)}</span></div><strong>${transfer.freeTransfer ? 'Free' : money(transfer.fee)}</strong></div>`;
  }).join('')}</div>`;
}

function transferMarketTabs(active) {
  return `<nav class="competition-tabs"><a href="#/transfers/players" class="${active === 'players' ? 'active' : ''}">Players</a><a href="#/transfers/coaches" class="${active === 'coaches' ? 'active' : ''}">Coaches</a></nav>`;
}

function coachMoveList(moves) {
  if (!moves.length) return '<div class="empty-state compact">No coaching changes recorded in this market.</div>';
  return `<div class="transfer-list coach-transfer-list">${moves.map((move) => {
    const coach = coachById(move.coachId);
    const from = move.fromClubId ? clubById(move.fromClubId)?.name : move.fromNationalTeamId ? nationalById(move.fromNationalTeamId)?.name : 'Free agency';
    const to = move.toClubId ? clubById(move.toClubId)?.name : move.toNationalTeamId ? nationalById(move.toNationalTeamId)?.name : 'Free agency';
    const portrait = coach && ['epic','legend','generational'].includes(coach.rarity) ? coachPortrait(coach,'sm') : '';
    return `<div class="transfer-row"><div class="transfer-player transfer-player-visual">${portrait}<div>${coach ? `${staffRarityBadge(coach.rarity)}${coachLink(coach.id, false)}` : 'Unknown coach'}<small>${coach ? `${countryName(coach.nationality)} · ${esc(COACH_PROFILES[coach.profile]?.label || coach.profileLabel)} · ${esc(COACH_FOCUSES[coach.focus]?.label || 'Balanced')}` : ''}</small></div></div><div class="transfer-route"><span>${esc(from || 'Free agency')}</span><b>→</b><span>${esc(to || 'Free agency')}</span></div><strong>${esc(move.reason || 'appointed')}</strong></div>`;
  }).join('')}</div>`;
}

function transfersPage(tabRaw = 'players') {
  const tab = tabRaw === 'coaches' ? 'coaches' : 'players';
  if (tab === 'coaches') {
    const currentMoves = (state.history.coachMoves || []).filter((move) => move.season === state.season || move.season === state.season + 1).reverse();
    const eliteMoves = currentMoves.filter((move) => ['generational','legend','epic'].includes(coachById(move.coachId)?.rarity));
    return `${pageHead('COACHING MARKET', `${state.current.seasonLabel} appointments`, 'Clubs and national teams compete for coaches through prestige, finances, recent results and career ambition. No transfer fees are displayed.')}${transferMarketTabs(tab)}
      <div class="stats-ribbon">${statCard('Changes', currentMoves.length)}${statCard('Elite moves', eliteMoves.length)}${statCard('Free agents', state.coaches.filter((coach) => coach.status !== 'retired' && !coach.clubId && !coach.nationalTeamId).length)}${statCard('Poached coaches', currentMoves.filter((move) => move.fromClubId && move.toClubId).length)}</div>
      <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">CURRENT MARKET</span><h3>Coach appointments</h3></div></div>${coachMoveList(currentMoves)}</section>`;
  }
  const current = state.history.transfers.filter((transfer) => transfer.season === state.season).sort((a, b) => b.fee - a.fee);
  const all = [...state.history.transfers].sort((a, b) => b.fee - a.fee);
  const biggest = all[0];
  return `${pageHead('TRANSFER MARKET', `${state.current.seasonLabel} market`, 'Clubs negotiate from their transfer budgets. Player happiness, contract length, reputation and market value influence moves.')}${transferMarketTabs(tab)}
    <div class="stats-ribbon">${statCard('Moves this season', current.length)}${statCard('Money spent', money(current.reduce((sum, transfer) => sum + transfer.fee, 0)))}${statCard('Biggest deal', biggest ? money(biggest.fee) : '—', biggest ? playerById(biggest.playerId)?.name : '')}${statCard('Free agents', state.players.filter((player) => player.status === 'active' && !player.clubId).length)}</div>
    <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">CURRENT WINDOW</span><h3>All transfers</h3></div></div>${transferList(current)}</section>`;
}

function peopleTabs(active) {
  return `<nav class="competition-tabs"><a href="#/people/presidents" class="${active === 'presidents' ? 'active' : ''}">Presidents</a><a href="#/people/coaches/overview" class="${active === 'coaches' ? 'active' : ''}">Coaches</a><a href="#/people/players/overview" class="${active === 'players' ? 'active' : ''}">Players</a></nav>`;
}

function playerTabs(active) {
  return `<nav class="sub-tabs player-index-tabs">${PLAYER_TABS.map((tab) => `<a href="#/people/players/${tab}" class="${active === tab ? 'active' : ''}">${tab === 'overview' ? 'Player Pool' : 'Statistics'}</a>`).join('')}</nav>`;
}

function coachTabs(active) {
  return `<nav class="sub-tabs player-index-tabs"><a href="#/people/coaches/overview" class="${active === 'overview' ? 'active' : ''}">Coach Pool</a><a href="#/people/coaches/statistics" class="${active === 'statistics' ? 'active' : ''}">Statistics</a></nav>`;
}

function playersPage(tabRaw = 'overview') {
  const tab = PLAYER_TABS.includes(tabRaw) ? tabRaw : 'overview';
  const activePlayers = state.players.filter((player) => player.status === 'active');
  if (tab === 'statistics') return `${pageHead('PEOPLE', 'Players', 'Compare active and retired footballers by origin, current team region, competition and career production.')}${peopleTabs('players')}${playerTabs(tab)}${playerStatisticsTable(state.players)}`;
  const filtered = activePlayers.filter((player) => {
    const term = playerSearch.trim().toLowerCase();
    return (!term || player.name.toLowerCase().includes(term) || clubById(player.clubId)?.name.toLowerCase().includes(term))
      && matchesRegion(player.nationality, peopleOriginRegionFilter)
      && (peopleTeamRegionFilter === 'ALL' || (player.clubId && COUNTRY_META[clubById(player.clubId)?.country]?.region === peopleTeamRegionFilter))
      && (playerPositionFilter === 'ALL' || player.position === playerPositionFilter)
      && (playerCareerFilter === 'ALL' || (playerCareerFilter === 'NEW' ? player.debutSeason === state.season : player.careerYear + 1 === Number(playerCareerFilter)));
  }).sort((a, b) => b.rating - a.rating || STAR_RARITIES[b.rarity].rank - STAR_RARITIES[a.rarity].rank);
  return `${pageHead('PEOPLE', 'Players', 'Every player has a rarity, position, tactical role, contract and pre-generated career path.')}${peopleTabs('players')}${playerTabs(tab)}<section class="panel"><div class="filter-toolbar"><label>Search<input id="player-search" type="search" value="${esc(playerSearch)}" placeholder="Player or club"></label><label>Continent (origin)<select id="people-origin-region-filter">${regionOptions(peopleOriginRegionFilter)}</select></label><label>Continent (team)<select id="people-team-region-filter">${regionOptions(peopleTeamRegionFilter)}</select></label><label>Position<select id="player-position-filter"><option value="ALL">All positions</option>${['GK', 'DF', 'MF', 'FW'].map((position) => `<option value="${position}" ${playerPositionFilter === position ? 'selected' : ''}>${position}</option>`).join('')}</select></label><label>Career<select id="player-career-filter"><option value="ALL">All career years</option><option value="NEW" ${playerCareerFilter === 'NEW' ? 'selected' : ''}>Debuted this season</option>${Array.from({length: 22}, (_, index) => index + 1).map((year) => `<option value="${year}" ${String(playerCareerFilter) === String(year) ? 'selected' : ''}>Career year ${year}</option>`).join('')}</select></label><span>${fmt(filtered.length)} active players</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Player</th><th>Club</th><th>Nation</th><th>Pos</th><th>Role</th><th>Rarity</th><th>Career</th><th>Debut</th><th>Age</th><th>Rating</th><th>Market value</th><th>Contract</th></tr></thead><tbody>${filtered.slice(0, 500).map((player) => `<tr><td>${playerLink(player.id)}</td><td>${player.clubId ? teamLink(player.clubId) : '<span class="free-agent">Free agent</span>'}</td><td>${flag(player.nationality)}</td><td>${player.position}</td><td>${esc(player.roleLabel)}</td><td>${rarityBadge(player.rarity)}</td><td><strong>Y${player.careerYear + 1}</strong></td><td>${player.debutSeason || state.season - player.careerYear}</td><td>${state.season - player.birthYear}</td><td><strong>${player.rating}</strong></td><td><strong>${money(player.marketValue)}</strong></td><td>${player.contractYears ? `${player.contractYears} yr` : 'Free'}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function playerStatisticsTable(activePlayers) {
  const ids = new Set(activePlayers.map((player) => player.id));
  const totals = new Map();
  const ensure = (id) => {
    if (!totals.has(id)) totals.set(id, { games: 0, goals: 0, assists: 0, cleanSheets: 0, ratingWeighted: 0, titles: 0 });
    return totals.get(id);
  };
  const rowsSource = [...state.history.playerSeasons, ...Object.values(state.current.playerStats || {})];
  for (const row of rowsSource) {
    if (!ids.has(row.playerId)) continue;
    if (playerStatsCompetition !== 'ALL' && row.competitionId !== playerStatsCompetition) continue;
    if (playerStatsScope !== 'all' && (playerStatsScope === 'international') !== Boolean(row.isInternational)) continue;
    const item = ensure(row.playerId);
    item.games += row.apps || 0; item.goals += row.goals || 0; item.assists += row.assists || 0; item.cleanSheets += row.cleanSheets || 0;
    item.ratingWeighted += (row.averageRating || 0) * (row.apps || 0);
  }
  for (const honour of publicHistoryHonours()) {
    if (!ids.has(honour.playerId)) continue;
    if (playerStatsCompetition !== 'ALL' && honour.competitionId !== playerStatsCompetition) continue;
    if (playerStatsScope !== 'all' && (playerStatsScope === 'international') !== Boolean(honour.isInternational)) continue;
    ensure(honour.playerId).titles += 1;
  }
  const rows = activePlayers.filter((player) => matchesRegion(player.nationality, peopleOriginRegionFilter) && (peopleTeamRegionFilter === 'ALL' || (player.clubId && COUNTRY_META[clubById(player.clubId)?.country]?.region === peopleTeamRegionFilter)) && (playerPositionFilter === 'ALL' || player.position === playerPositionFilter)).map((player) => {
    const value = ensure(player.id);
    return { player, totals: { ...value, averageRating: value.games ? value.ratingWeighted / value.games : 0 } };
  });
  rows.sort((a, b) => playerStatsSort === 'rating' ? b.totals.averageRating - a.totals.averageRating || b.totals.games - a.totals.games : (b.totals[playerStatsSort] || 0) - (a.totals[playerStatsSort] || 0) || b.player.rating - a.player.rating);
  return `<section class="panel"><div class="filter-toolbar"><label>Continent (origin)<select id="people-origin-region-filter">${regionOptions(peopleOriginRegionFilter)}</select></label><label>Continent (team)<select id="people-team-region-filter">${regionOptions(peopleTeamRegionFilter)}</select></label><label>Position<select id="player-position-filter"><option value="ALL">All positions</option>${['GK','DF','MF','FW'].map((position) => `<option value="${position}" ${playerPositionFilter === position ? 'selected' : ''}>${position}</option>`).join('')}</select></label><label>Competition<select id="player-stats-competition">${universalCompetitionOptions(playerStatsCompetition, true)}</select></label><label>Scope<select id="player-stats-scope"><option value="club" ${playerStatsScope === 'club' ? 'selected' : ''}>Club football</option><option value="international" ${playerStatsScope === 'international' ? 'selected' : ''}>International football</option><option value="all" ${playerStatsScope === 'all' ? 'selected' : ''}>Combined</option></select></label><label>Sort by<select id="player-stats-sort">${[['goals','Goals'],['games','Games'],['assists','Assists'],['cleanSheets','Clean sheets'],['rating','Average score'],['titles','Titles']].map(([value,label]) => `<option value="${value}" ${playerStatsSort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><span>Top 50 shown</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Position</th><th>Club</th><th>Games</th><th>Goals</th><th>Assists</th><th>Clean sheets</th><th>Average score</th><th>Total titles</th></tr></thead><tbody>${rows.slice(0, 50).map(({ player, totals }, index) => `<tr><td>${index + 1}</td><td>${playerLink(player.id)}</td><td>${player.position}</td><td>${player.clubId ? teamLink(player.clubId) : player.status === 'retired' ? '<span class="muted">Retired</span>' : 'Free agent'}</td><td>${totals.games}</td><td><strong>${totals.goals}</strong></td><td>${totals.assists}</td><td>${totals.cleanSheets}</td><td>${totals.games ? totals.averageRating.toFixed(2) : '—'}</td><td><strong>${totals.titles}</strong></td></tr>`).join('')}</tbody></table></div></section>`;
}


function presidentsPeoplePage() {
  const rows = [...(state.owners || [])].filter((owner) => matchesRegion(owner.nationality, peopleOriginRegionFilter) && (peopleTeamRegionFilter === 'ALL' || (owner.clubId && COUNTRY_META[clubById(owner.clubId)?.country]?.region === peopleTeamRegionFilter))).sort((a, b) => (b.quality || 0) - (a.quality || 0) || (STAFF_RARITIES[b.rarity]?.rank || 0) - (STAFF_RARITIES[a.rarity]?.rank || 0));
  return `${pageHead('PEOPLE', 'Presidents', 'Club leadership changes finances, negotiations, patience and academy development over long fixed tenures.')}${peopleTabs('presidents')}
    <section class="panel"><div class="filter-toolbar"><label>Continent (origin)<select id="people-origin-region-filter">${regionOptions(peopleOriginRegionFilter)}</select></label><label>Continent (team)<select id="people-team-region-filter">${regionOptions(peopleTeamRegionFilter)}</select></label><span>${fmt(rows.filter((owner) => owner.clubId).length)} active presidents · ${fmt(rows.length)} historical people retained</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>President</th><th>Nationality</th><th>Rarity</th><th>Quality</th><th>Profile</th><th>Current club</th><th>Years remaining</th></tr></thead><tbody>${rows.slice(0, 250).map((owner, index) => `<tr><td>${index + 1}</td><td>${ownerLink(owner.id)}</td><td>${flag(owner.nationality)}</td><td>${staffRarityBadge(owner.rarity)}</td><td><strong>${owner.quality || '—'}/100</strong></td><td>${esc(OWNER_PROFILES[owner.profile]?.label || owner.profileLabel || '—')}</td><td>${owner.clubId ? teamLink(owner.clubId) : '<span class="muted">Former president</span>'}</td><td>${owner.clubId ? (owner.yearsRemaining ?? '—') : '—'}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function coachStatisticsTable() {
  const totals = new Map();
  const ensure = (id) => {
    if (!totals.has(id)) totals.set(id, { games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cleanSheets: 0, titles: 0 });
    return totals.get(id);
  };
  const source = [...(state.history.coachCompetitionSeasons || []), ...Object.values(state.current.coachStats || {})];
  for (const row of source) {
    if (coachStatsCompetition !== 'ALL' && row.competitionId !== coachStatsCompetition) continue;
    if (coachStatsScope !== 'all' && (coachStatsScope === 'international') !== Boolean(row.isInternational)) continue;
    const item = ensure(row.coachId);
    for (const field of ['games','wins','draws','losses','gf','ga','cleanSheets','titles']) item[field] += row[field] || 0;
  }
  const rows = (state.coaches || []).filter((coach) =>
    matchesRegion(coach.nationality, peopleOriginRegionFilter)
    && (peopleTeamRegionFilter === 'ALL'
      || (coach.clubId && COUNTRY_META[clubById(coach.clubId)?.country]?.region === peopleTeamRegionFilter)
      || (coach.nationalTeamId && nationalById(coach.nationalTeamId)?.region === peopleTeamRegionFilter))
  ).map((coach) => {
    const stat = ensure(coach.id);
    return { coach, ...stat, winPct: stat.games ? stat.wins / stat.games : 0, concededPerGame: stat.games ? stat.ga / stat.games : 999 };
  });
  const sorters = {
    titles: (a,b) => b.titles-a.titles || b.wins-a.wins,
    games: (a,b) => b.games-a.games || b.wins-a.wins,
    wins: (a,b) => b.wins-a.wins || b.games-a.games,
    winPct: (a,b) => (b.games >= 10 ? b.winPct : -1) - (a.games >= 10 ? a.winPct : -1) || b.games-a.games,
    goals: (a,b) => b.gf-a.gf || b.games-a.games,
    conceded: (a,b) => (a.games >= 10 ? a.concededPerGame : 999) - (b.games >= 10 ? b.concededPerGame : 999) || b.games-a.games
  };
  rows.sort(sorters[coachStatsSort] || sorters.titles);
  return `<section class="panel"><div class="filter-toolbar"><label>Continent (origin)<select id="people-origin-region-filter">${regionOptions(peopleOriginRegionFilter)}</select></label><label>Continent (team)<select id="people-team-region-filter">${regionOptions(peopleTeamRegionFilter)}</select></label><label>Competition<select id="coach-stats-competition">${universalCompetitionOptions(coachStatsCompetition, true)}</select></label><label>Scope<select id="coach-stats-scope"><option value="all" ${coachStatsScope === 'all' ? 'selected' : ''}>Club + international</option><option value="club" ${coachStatsScope === 'club' ? 'selected' : ''}>Club only</option><option value="international" ${coachStatsScope === 'international' ? 'selected' : ''}>International only</option></select></label><label>Sort by<select id="coach-stats-sort">${[['titles','Titles'],['games','Games'],['wins','Wins'],['winPct','Win percentage'],['goals','Goals scored'],['conceded','Fewest conceded / game']].map(([value,label]) => `<option value="${value}" ${coachStatsSort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><span>Top 50 shown</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Coach</th><th>Rarity</th><th>Current job</th><th>Games</th><th>Wins</th><th>Win %</th><th>GF</th><th>GA</th><th>CS</th><th>Titles</th></tr></thead><tbody>${rows.slice(0,50).map((row,index) => `<tr><td>${index+1}</td><td>${coachLink(row.coach.id)}</td><td>${staffRarityBadge(row.coach.rarity)}</td><td>${coachJob(row.coach)}</td><td>${row.games}</td><td><strong>${row.wins}</strong></td><td>${row.games ? `${(row.winPct*100).toFixed(1)}%` : '—'}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.cleanSheets}</td><td><strong>${row.titles}</strong></td></tr>`).join('') || '<tr><td colspan="11">No coach records match these filters.</td></tr>'}</tbody></table></div></section>`;
}

function coachesPeoplePage(tabRaw = 'overview') {
  const tab = tabRaw === 'statistics' ? 'statistics' : 'overview';
  const heading = `${pageHead('PEOPLE', 'Coaches', 'Browse the coaching world by rarity, quality, tactical identity, appointments and competition record.')}${peopleTabs('coaches')}${coachTabs(tab)}`;
  if (tab === 'statistics') return `${heading}${coachStatisticsTable()}`;
  const rows = [...(state.coaches || [])].filter((coach) => matchesRegion(coach.nationality, peopleOriginRegionFilter) && (peopleTeamRegionFilter === 'ALL' || (coach.clubId && COUNTRY_META[clubById(coach.clubId)?.country]?.region === peopleTeamRegionFilter) || (coach.nationalTeamId && nationalById(coach.nationalTeamId)?.region === peopleTeamRegionFilter))).sort((a, b) => (b.quality || 0) - (a.quality || 0) || (STAFF_RARITIES[b.rarity]?.rank || 0) - (STAFF_RARITIES[a.rarity]?.rank || 0));
  return `${heading}
    <section class="panel"><div class="filter-toolbar"><label>Continent (origin)<select id="people-origin-region-filter">${regionOptions(peopleOriginRegionFilter)}</select></label><label>Continent (team)<select id="people-team-region-filter">${regionOptions(peopleTeamRegionFilter)}</select></label><span>${fmt(rows.filter((coach) => coach.status !== 'retired' && (coach.clubId || coach.nationalTeamId)).length)} employed · ${fmt(rows.filter((coach) => coach.status !== 'retired' && !coach.clubId && !coach.nationalTeamId).length)} free agents · ${fmt(rows.filter((coach) => coach.status === 'retired').length)} retired</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Coach</th><th>Nationality</th><th>Rarity</th><th>Quality</th><th>Style</th><th>Focus</th><th>Current job</th><th>Career</th><th>Years in role</th></tr></thead><tbody>${rows.slice(0, 250).map((coach, index) => `<tr><td>${index + 1}</td><td>${coachLink(coach.id)}</td><td>${flag(coach.nationality)}</td><td>${staffRarityBadge(coach.rarity)}</td><td><strong>${coach.quality || '—'}/100</strong></td><td>${esc(COACH_PROFILES[coach.profile]?.label || coach.profileLabel || '—')}</td><td><strong>${esc(COACH_FOCUSES[coach.focus]?.label || 'Balanced')}</strong></td><td>${coachJob(coach)}</td><td>Y${Math.min((coach.careerYear||0)+1,coach.careerLength||1)}/${coach.careerLength||'—'} · ${esc((coach.careerType||'stable_prime').replaceAll('_',' '))}</td><td>${coach.seasonsInRole || 0}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function peoplePage(type = 'players', tab = 'overview') {
  if (type === 'presidents') return presidentsPeoplePage();
  if (type === 'coaches') return coachesPeoplePage(tab);
  return playersPage(tab || 'overview');
}

function aggregatePlayerAlmanac() {
  const map = new Map();
  const ensure = (id) => { if (!map.has(id)) map.set(id, { playerId: id, games: 0, goals: 0, assists: 0, cleanSheets: 0, ratingWeighted: 0, teamHonours: 0, individualAwards: 0 }); return map.get(id); };
  [...state.history.playerSeasons, ...Object.values(state.current.playerStats || {})].forEach((row) => {
    const item = ensure(row.playerId); item.games += row.apps || 0; item.goals += row.goals || 0; item.assists += row.assists || 0; item.cleanSheets += row.cleanSheets || 0; item.ratingWeighted += (row.averageRating || 0) * (row.apps || 0);
  });
  publicHistoryHonours().forEach((row) => { if (row.playerId) ensure(row.playerId).teamHonours += 1; });
  publicHistoryAwards().forEach((row) => { if (row.playerId && (row.rank || 1) === 1) ensure(row.playerId).individualAwards += 1; });
  state.players.forEach((player) => ensure(player.id));
  return [...map.values()].map((row) => ({ ...row, averageRating: row.games ? row.ratingWeighted / row.games : 0, totalHonours: row.teamHonours + row.individualAwards }));
}

function aggregateTeamAlmanac() {
  const map = new Map();
  const ensure = (id, international = false) => { if (!map.has(id)) map.set(id, { teamId: id, international, games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cleanSheets: 0, domesticTitles: 0, continentalTitles: 0, internationalTitles: 0 }); return map.get(id); };
  (state.history.clubSeasons || []).forEach((row) => { const item = ensure(row.clubId, false); item.games += row.played || 0; item.wins += row.wins || 0; item.draws += row.draws || 0; item.losses += row.losses || 0; item.gf += row.gf || 0; item.ga += row.ga || 0; item.cleanSheets += row.cleanSheets || 0; });
  Object.values(state.current.leagues || {}).forEach((league) => (league.table || []).forEach((row) => { const item = ensure(row.teamId, false); item.games += row.played || 0; item.wins += row.wins || 0; item.draws += row.draws || 0; item.losses += row.losses || 0; item.gf += row.gf || 0; item.ga += row.ga || 0; item.cleanSheets += row.cleanSheets || 0; }));
  publicHistoryChampions().forEach((row) => { const item = ensure(row.winnerId, Boolean(row.isInternational)); if (row.isInternational) item.internationalTitles += 1; else if (CONTINENTAL_DEFINITIONS.some((c) => c.id === row.competitionId)) item.continentalTitles += 1; else item.domesticTitles += 1; });
  state.clubs.forEach((club) => ensure(club.id, false));
  state.nationalTeams.forEach((team) => ensure(team.id, true));
  return [...map.values()].map((row) => ({ ...row, titles: row.domesticTitles + row.continentalTitles + row.internationalTitles, winPct: row.games ? row.wins / row.games : 0 }));
}

function groupedRecords(rows, nameKey) {
  const map = new Map();
  for (const row of rows) {
    const name = row[nameKey] || competitionLabel(row.competitionId);
    const item = map.get(name) || { name, years: [] };
    item.years.push(row.season);
    map.set(name, item);
  }
  return [...map.values()].sort((a, b) => b.years.length - a.years.length || a.name.localeCompare(b.name));
}

function honoursList(rows, nameKey) {
  const groups = groupedRecords(rows, nameKey);
  if (!groups.length) return '<div class="empty-state compact">No honors yet.</div>';
  return `<div class="honours-list">${groups.map((group) => `<div class="honour-line"><div><strong>${esc(group.name)} ×${group.years.length}</strong><span>${group.years.sort((a, b) => a - b).join(', ')}</span></div></div>`).join('')}</div>`;
}

function playerClubTimeline(player, career) {
  const rows = [...career.seasons, ...career.current].filter((row) => !row.isInternational && row.apps > 0);
  const map = new Map();
  for (const row of rows) {
    const season = row.season ?? state.season;
    const seasonLabel = row.seasonLabel || state.current.seasonLabel;
    const key = `${season}::${row.teamId}`;
    const item = map.get(key) || { season, seasonLabel, teamId: row.teamId, apps: 0, goals: 0, assists: 0, ratingWeighted: 0 };
    item.apps += row.apps || 0;
    item.goals += row.goals || 0;
    item.assists += row.assists || 0;
    item.ratingWeighted += (row.averageRating || 0) * (row.apps || 0);
    map.set(key, item);
  }
  const timeline = [...map.values()].map((row) => ({ ...row, averageRating: row.apps ? row.ratingWeighted / row.apps : 0 })).sort((a, b) => b.season - a.season || b.apps - a.apps);
  return `<section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">CLUB CAREER</span><h3>Teams by season</h3></div><span class="muted">Quick total across all club competitions</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Season</th><th>Club</th><th>Games</th><th>Goals</th><th>Assists</th><th>Rating</th></tr></thead><tbody>${timeline.map((row) => `<tr><td><strong>${esc(row.seasonLabel)}</strong></td><td>${teamLink(row.teamId)}</td><td>${row.apps}</td><td>${row.goals}</td><td>${row.assists}</td><td>${row.averageRating ? row.averageRating.toFixed(2) : '—'}</td></tr>`).join('') || `<tr><td colspan="6">${esc(player.name)} has not completed a club season yet.</td></tr>`}</tbody></table></div></section>`;
}

function playerCareerChart(player) {
  const values = player.careerMultipliers || [];
  if (!values.length) return '';
  const width = 760, height = 220, left = 38, right = 18, top = 20, bottom = 38;
  const minY = Math.min(0.84, ...values) - 0.01;
  const maxY = Math.max(1.03, ...values) + 0.01;
  const x = (i) => left + (values.length <= 1 ? 0 : i * (width-left-right)/(values.length-1));
  const y = (v) => top + (maxY-v)/(maxY-minY)*(height-top-bottom);
  const points = values.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const currentX = x(Math.min(player.careerYear || 0, values.length-1));
  const labels = values.map((v,i)=>`<text x="${x(i)}" y="${height-14}" text-anchor="middle">${i+1}</text>`).join('');
  return `<div class="career-chart-wrap"><svg class="career-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Career multiplier by season"><line x1="${left}" y1="${y(1)}" x2="${width-right}" y2="${y(1)}" class="career-chart-baseline"/><polyline points="${points}" class="career-chart-line"/><line x1="${currentX}" y1="${top}" x2="${currentX}" y2="${height-bottom}" class="career-chart-current"/>${values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="${i===player.careerYear?5:3}" class="${i===player.careerYear?'current':''}"><title>Year ${i+1}: ×${v.toFixed(2)} · ${Math.round(player.baseQuality*v)} ability</title></circle>`).join('')}<text x="8" y="${y(1)+4}" class="axis-label">1.00</text>${labels}<text x="${width/2}" y="${height-1}" text-anchor="middle" class="axis-label">CAREER YEAR</text></svg><div class="career-chart-summary"><span>Debut age ${player.debutAge || 18}</span><span>Planned retirement age ${(player.debutAge || 18)+(player.careerLength || values.length)}</span><span>Current ×${Number(values[player.careerYear]||1).toFixed(2)}</span></div></div>`;
}

function playerLeagueContext(player) {
  const club = player?.clubId ? clubById(player.clubId) : null;
  if (!club) return '';
  const row = getLeagueMarketRankings(state, club.confederation).find((item)=>item.leagueId===club.leagueId);
  const league = LEAGUE_DEFINITIONS.find((item)=>item.id===club.leagueId);
  const financial = getClubFinancialStatus(state, club.id);
  return row ? `${league?.name || club.leagueId} #${row.rank} in ${club.confederation} · ${financial?.label || 'Remaining'}` : '';
}

function playerPage(id, tabRaw = 'overview') {
  const player = playerById(id);
  if (!player) return notFound();
  const career = getPlayerCareer(state, id);
  career.honours = (career.honours || []).filter((row) => !(row.season === state.season && isShowcaseCompetitionEmbargoed(state, row.competitionId)));
  career.awards = (career.awards || []).filter((row) => !(row.season === state.season && row.competitionId && isShowcaseCompetitionEmbargoed(state, row.competitionId)));
  const normalized = tabRaw === 'profile' ? 'overview' : tabRaw;
  const tab = PLAYER_PAGE_TABS.includes(normalized) ? normalized : 'overview';
  const base = `#/player/${player.id}`;
  const pageTabs = entityTabs(base, [['overview','Overview'],['career','Career'],['statistics','Statistics'],['honours','Honors'],['records','Records']], tab);
  const playerHero = `<section class="entity-hero player-entity compact-profile-hero"><div class="player-hero-portrait">${playerPortrait(player, 'xl')}<span class="position-corner">${player.position}</span></div><div class="entity-main"><div class="entity-badges">${rarityBadge(player.rarity)}${flag(player.nationality)}${player.realWorldId ? '<span class="historical-icon-badge">Historical icon</span>' : ''}</div><span class="entity-kicker">${esc(player.roleLabel)}</span><h2>${esc(player.name)}</h2><div class="entity-meta">${player.clubId ? teamLink(player.clubId) : '<span class="free-agent">Free agent</span>'}${player.status==='active' ? ` · Age ${state.season-player.birthYear}${player.contractYears ? ` · ${player.contractYears} yr contract` : ''}` : ''}</div></div><div class="rating-orbit"><strong>${player.rating}</strong><span>ABILITY</span></div></section>`;
  const heading = `${playerHero}<div class="entity-page-actions">${favoriteButton('player',player.id)}</div>${pageTabs}`;
  if (tab === 'statistics') return `${heading}${playerStatisticsPage(player, career)}`;
  if (tab === 'honours') return `${heading}${playerHonoursPage(player, career)}`;
  if (tab === 'career') {
    const careerLabel = CAREER_TYPES[player.careerType]?.label || player.careerType;
    return `${heading}<section class="panel"><div class="panel-head"><div><span class="eyebrow">CAREER MODEL</span><h3>${esc(careerLabel)} · ${esc(player.careerLengthType)} career</h3></div><span class="muted">Year ${Math.min(player.careerYear + 1,player.careerLength)} of ${player.careerLength} · Age ${state.season-player.birthYear}</span></div>${playerCareerChart(player)}</section>${playerClubTimeline(player,career)}`;
  }
  if (tab === 'records') return `${heading}${playerRecordsPage(player,career)}`;
  const totals = getPlayerTotals(state,id,'all');
  const clubTotals = getPlayerTotals(state,id,'club');
  const hof = (state.history.hallOfFamePlayers||[]).find((row)=>row.playerId===id);
  const legends = (state.history.clubLegends||[]).filter((row)=>row.playerId===id).sort((a,b)=>b.score-a.score);
  const bestSeason = [...career.seasons].filter((row)=>!row.isInternational && row.apps>=8).sort((a,b)=>b.averageRating-a.averageRating||b.apps-a.apps)[0];
  const careerLabel = CAREER_TYPES[player.careerType]?.label || player.careerType;
  const status = player.status === 'retired' ? `Retired ${getSeasonLabel(player.retirementSeason || state.season)}` : player.clubId ? clubById(player.clubId)?.name : 'Free agent';
  return `${heading}<div class="entity-trait-strip section-gap"><span>${flag(player.nationality,'xs')} ${esc(countryName(player.nationality))}</span><span>${player.position} · ${esc(player.roleLabel)}</span><span>${player.status==='active' ? `Age ${state.season - player.birthYear}` : esc(status)}</span><span>Value ${money(player.marketValue)}</span><span>Happiness ${player.happiness}</span><span>${player.realWorldId ? 'Historical icon' : 'Original world star'}</span></div>
    <div class="stats-ribbon section-gap">${statCard('Career games',fmt(totals.games),`${clubTotals.goals} club goals`)}${statCard('Average rating',totals.averageRating?totals.averageRating.toFixed(2):'—',bestSeason?`Peak ${bestSeason.averageRating.toFixed(2)} in ${bestSeason.seasonLabel}`:'Career average')}${statCard('Trophies',career.honours.length,`${career.awards.filter((a)=>a.rank===1).length} individual awards`)}${statCard('International',`${career.international.caps} / ${career.international.goals}`,'Caps / goals')}</div>
    <div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">CAREER AT A GLANCE</span><h3>${esc(careerLabel)}</h3></div><span class="panel-chip">Profile spotlight</span></div><p class="role-copy">${esc(player.name)} is a ${esc(STAR_RARITIES[player.rarity]?.label||player.rarity)} ${esc(player.roleLabel.toLowerCase())}. ${career.honours.length?`The career currently includes ${career.honours.length} team trophies.`:'The first major team trophy is still ahead.'} ${hof?`Retirement earned induction into the Football Hall of Fame with a legacy score of ${hof.score}.`:player.status==='retired'?'The career ended without Football Hall of Fame induction.':'The legacy is still being written.'}</p><div class="staff-effects"><span>Base ${player.baseQuality}</span><span>Market ${money(player.marketValue)}</span><span>Happiness ${player.happiness}</span><span>Career Y${Math.min(player.careerYear+1,player.careerLength)}/${player.careerLength} · ${player.debutAge||18}–${(player.debutAge||18)+player.careerLength}</span>${playerLeagueContext(player)?`<span>${esc(playerLeagueContext(player))}</span>`:''}</div><div class="spotlight-grid"><article class="spotlight-card"><span>Current team</span><strong>${player.clubId ? esc(clubById(player.clubId)?.name || 'Club') : 'Free agent'}</strong><small>${player.clubId ? esc(competitionLabel(clubById(player.clubId)?.leagueId)) : esc(status)}</small></article><article class="spotlight-card"><span>Contract</span><strong>${player.status==='active' ? (player.contractYears ? `${player.contractYears} yr` : 'Ending now') : 'Closed'}</strong><small>${player.status==='active' ? 'Career leverage in the market' : 'Career complete'}</small></article><article class="spotlight-card"><span>International</span><strong>${career.international.caps} caps</strong><small>${career.international.goals} goals for country</small></article></div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">LEGACY</span><h3>Historical standing</h3></div><span class="panel-chip">Archive</span></div>${hof?`<div class="legacy-callout"><strong>Football Hall of Fame</strong><span>Inducted ${esc(hof.inductionSeasonLabel)} · Score ${hof.score}</span></div>`:'<div class="empty-state compact">Hall of Fame induction is decided only when the player retires.</div>'}${legends.length?`<div class="legend-mini-list">${legends.map((row)=>`<a href="#/club/${row.clubId}/legends">Club legend · ${esc(clubById(row.clubId)?.name||row.clubId)} <b>${row.score}</b></a>`).join('')}</div>`:''}</section></div>`;
}

function playerRecordsPage(player, career) {
  const rows = [...career.seasons].filter((row)=>!row.isInternational);
  const highestGoals=[...rows].sort((a,b)=>b.goals-a.goals)[0];
  const highestAssists=[...rows].sort((a,b)=>b.assists-a.assists)[0];
  const highestRating=[...rows].filter((row)=>row.apps>=8).sort((a,b)=>b.averageRating-a.averageRating)[0];
  const mostGames=[...rows].sort((a,b)=>b.apps-a.apps)[0];
  const awards=career.awards.filter((row)=>row.rank===1);
  const ballon=awards.filter((row)=>String(row.name).includes("Ballon d'Or")).length;
  const clubLegends=(state.history.clubLegends||[]).filter((row)=>row.playerId===player.id);
  return `<div class="record-grid">${statCard('Best scoring season',highestGoals?highestGoals.goals:'—',highestGoals?`${highestGoals.seasonLabel} · ${competitionLabel(highestGoals.competitionId)}`:'No archived season')}${statCard('Best assist season',highestAssists?highestAssists.assists:'—',highestAssists?`${highestAssists.seasonLabel} · ${competitionLabel(highestAssists.competitionId)}`:'No archived season')}${statCard('Best rating',highestRating?highestRating.averageRating.toFixed(2):'—',highestRating?`${highestRating.seasonLabel} · ${highestRating.apps} games`:'Minimum 8 games')}${statCard('Most games',mostGames?mostGames.apps:'—',mostGames?`${mostGames.seasonLabel} · ${competitionLabel(mostGames.competitionId)}`:'No archived season')}${statCard("Ballon d'Or",ballon,`${awards.length} individual awards`)}${statCard('Club legend honors',clubLegends.length,clubLegends.length?clubLegends.map((r)=>clubById(r.clubId)?.name).filter(Boolean).join(' · '):'None yet')}</div>`;
}

function playerStatisticsPage(player, career) {
  return `<div class="stats-ribbon">${statCard('International caps', career.international.caps)}${statCard('International goals', career.international.goals)}${statCard('Trophies', career.honours.length)}${statCard('Individual awards', career.awards.filter((award) => award.rank === 1).length)}</div><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">CURRENT MATCH LOG</span><h3>Week-by-week detail</h3></div><span class="muted">Deleted at season close</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Week</th><th>Competition</th><th>Opponent</th><th>Result</th><th>Goals</th><th>Assists</th><th>Rating</th></tr></thead><tbody>${[...career.logs].reverse().slice(0, 80).map((log) => `<tr><td>${log.week}</td><td>${esc(competitionLabel(log.competitionId))}</td><td>${teamLink(log.opponentId, log.isInternational)}</td><td>${log.result} ${log.score}</td><td>${log.goals}</td><td>${log.assists}</td><td>${log.rating.toFixed(2)}</td></tr>`).join('') || '<tr><td colspan="7">No current matches.</td></tr>'}</tbody></table></div></section><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">PERMANENT HISTORY</span><h3>Season summaries</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Season</th><th>Competition</th><th>Team</th><th>Games</th><th>Goals</th><th>Assists</th><th>CS</th><th>Rating</th></tr></thead><tbody>${[...career.seasons].reverse().map((row) => `<tr><td>${row.seasonLabel}</td><td>${esc(competitionLabel(row.competitionId))}</td><td>${teamLink(row.teamId, row.isInternational)}</td><td>${row.apps}</td><td>${row.goals}</td><td>${row.assists}</td><td>${row.cleanSheets}</td><td>${row.averageRating.toFixed(2)}</td></tr>`).join('') || '<tr><td colspan="8">No archived seasons yet.</td></tr>'}</tbody></table></div></section>`;
}

function playerHonoursPage(player, career) {
  const awards = career.awards.filter((award) => award.rank === 1);
  return `<div class="honours-summary"><div><span>Trophies</span><strong>${career.honours.length}</strong></div><div><span>Individual awards</span><strong>${awards.length}</strong></div></div><div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">TEAM TROPHIES</span><h3>${esc(player.name)}</h3></div></div>${honoursList(career.honours, 'competitionName')}</section><section class="panel"><div class="panel-head"><div><span class="eyebrow">INDIVIDUAL AWARDS</span><h3>Career recognition</h3></div></div>${honoursList(awards, 'name')}</section></div>`;
}

function aggregateCurrentCoachJobs(career) {
  const map = new Map();
  for (const row of career.currentRows || []) {
    const key = `${row.teamId}::${row.isInternational ? 1 : 0}`;
    const item = map.get(key) || {
      season: state.season, seasonLabel: state.current.seasonLabel, coachId: row.coachId, teamId: row.teamId, isInternational: row.isInternational,
      games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cleanSheets: 0, titles: 0
    };
    for (const field of ['games','wins','draws','losses','gf','ga','cleanSheets','titles']) item[field] += row[field] || 0;
    map.set(key, item);
  }
  return [...map.values()];
}

function coachPage(id, tabRaw = 'overview') {
  const coach = coachById(id);
  if (!coach) return notFound();
  const career = getCoachCareer(state, id);
  career.honours = (career.honours || []).filter((row) => !(row.season === state.season && isShowcaseCompetitionEmbargoed(state, row.competitionId)));
  const currentJobs = aggregateCurrentCoachJobs(career);
  const timeline = [...career.seasons, ...currentJobs].sort((a, b) => b.season - a.season || b.games - a.games);
  const competitionRows = [...career.competitionSeasons, ...(career.currentRows || []).map((row) => ({ season: state.season, seasonLabel: state.current.seasonLabel, ...row }))]
    .sort((a, b) => b.season - a.season || b.games - a.games);
  const totals = career.totals;
  const profile = COACH_PROFILES[coach.profile];
  const focus = COACH_FOCUSES[coach.focus] || COACH_FOCUSES.balanced;
  const tab = COACH_PAGE_TABS.includes(tabRaw) ? tabRaw : 'overview';
  const tabs = entityTabs(`#/coach/${coach.id}`, [['overview','Overview'],['career','Career'],['statistics','Statistics'],['honours','Honors']], tab);
  const coachHero = `<section class="entity-hero coach-entity compact-profile-hero"><div class="coach-hero-portrait">${coachPortrait(coach, 'xl')}</div><div class="entity-main"><div class="entity-badges">${staffRarityBadge(coach.rarity)}${flag(coach.nationality)}</div><span class="entity-kicker">${esc(profile?.label || coach.profileLabel)}</span><h2>${esc(coach.name)}</h2><div class="entity-meta">${coachJob(coach)}</div></div><div class="rating-orbit"><strong>${coach.quality}</strong><span>QUALITY</span></div></section>`;
  const head = `${coachHero}<div class="entity-page-actions">${favoriteButton('coach',coach.id)}</div>${tabs}`;
  if (tab === 'career') return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">COACHING CAREER CURVE</span><h3>${esc((coach.careerType || 'stable_prime').replaceAll('_', ' '))}</h3></div><span class="muted">Year ${Math.min((coach.careerYear || 0) + 1, coach.careerLength || 1)} of ${coach.careerLength || '—'}</span></div><div class="career-curve">${(coach.careerMultipliers || []).map((multiple, index) => `<div class="career-year ${index === coach.careerYear ? 'current' : ''} ${index < coach.careerYear ? 'past' : ''}"><span>Y${index + 1}</span><strong>${Number(multiple).toFixed(2)}</strong><small>${Math.round((coach.baseQuality || coach.quality) * multiple)}</small></div>`).join('')}</div></section><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">CAREER TIMELINE</span><h3>Team coached by season</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Season</th><th>Team</th><th>Type</th><th>G</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Win %</th><th>Titles</th></tr></thead><tbody>${timeline.map((row) => `<tr><td><strong>${esc(row.seasonLabel)}</strong></td><td>${teamLink(row.teamId, row.isInternational)}</td><td>${row.isInternational ? 'National team' : 'Club'}</td><td>${row.games}</td><td><strong>${row.wins}</strong></td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.games ? `${(row.wins / row.games * 100).toFixed(1)}%` : '—'}</td><td>${row.titles || 0}</td></tr>`).join('') || '<tr><td colspan="11">No completed coaching season yet.</td></tr>'}</tbody></table></div></section>`;
  if (tab === 'statistics') return `${head}<div class="stats-ribbon">${statCard('Games',fmt(totals.games),`${totals.wins} wins`)}${statCard('Win rate',totals.games?`${(totals.wins/totals.games*100).toFixed(1)}%`:'—',`${totals.draws} draws · ${totals.losses} losses`)}${statCard('Goals',fmt(totals.gf),`${fmt(totals.ga)} conceded`)}${statCard('Titles',totals.titles)}</div><section class="panel section-gap"><div class="table-scroll"><table class="data-table"><thead><tr><th>Season</th><th>Competition</th><th>Team</th><th>G</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>CS</th><th>Titles</th></tr></thead><tbody>${competitionRows.map((row) => `<tr><td>${esc(row.seasonLabel)}</td><td>${esc(competitionLabel(row.competitionId))}</td><td>${teamLink(row.teamId, row.isInternational)}</td><td>${row.games}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.cleanSheets || 0}</td><td>${row.titles || 0}</td></tr>`).join('') || '<tr><td colspan="11">No competition records yet.</td></tr>'}</tbody></table></div></section>`;
  if (tab === 'honours') return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">CAREER HONORS</span><h3>${career.honours.length} trophies</h3></div></div>${honoursList(career.honours,'competitionName')}</section>`;
  return `${head}<div class="entity-trait-strip section-gap"><span>${flag(coach.nationality,'xs')} ${esc(countryName(coach.nationality))}</span><span>${esc(profile?.label || coach.profileLabel)}</span><span>Focus ${esc(focus.label)}</span><span>${coach.status==='retired' ? 'Retired' : 'Active career'}</span><span>Quality ${coach.quality}</span><span>${coach.clubId ? 'Club coach' : coach.nationalTeamId ? 'National team coach' : 'Market free agent'}</span></div>
    <div class="stats-ribbon section-gap">${statCard('Games',fmt(totals.games),`${totals.wins} wins`)}${statCard('Win rate',totals.games?`${(totals.wins/totals.games*100).toFixed(1)}%`:'—')}${statCard('Titles',totals.titles,`${coach.seasonsInRole||0} seasons in current role`)}${statCard('Career',`Y${Math.min((coach.careerYear||0)+1,coach.careerLength||1)}/${coach.careerLength||'—'}`,coach.status==='retired'?'Retired':'Active')}</div>
    <div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">TACTICAL IDENTITY</span><h3>${esc(profile?.label || coach.profileLabel)}</h3></div><span class="panel-chip">Touchline</span></div><p class="role-copy">${esc(profile?.description || 'A flexible football coach.')}</p><div class="staff-effects"><span>Focus: ${esc(focus.label)}</span><span>Base quality ${coach.baseQuality||coach.quality}</span></div><p class="role-copy">${esc(focus.description)}</p><div class="spotlight-grid"><article class="spotlight-card"><span>Current role</span><strong>${coach.clubId ? esc(clubById(coach.clubId)?.name || 'Club') : coach.nationalTeamId ? esc(nationalById(coach.nationalTeamId)?.name || 'National team') : 'Free agent'}</strong><small>${coach.clubId ? 'Club football' : coach.nationalTeamId ? 'International football' : 'Available on market'}</small></article><article class="spotlight-card"><span>Current cycle</span><strong>${coach.seasonsInRole||0} seasons</strong><small>${coach.status==='retired' ? 'Completed' : 'In current job'}</small></article><article class="spotlight-card"><span>Record</span><strong>${totals.wins} wins</strong><small>${totals.draws} draws · ${totals.losses} losses</small></article></div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">LEGACY</span><h3>${career.honours.length} career trophies</h3></div><span class="panel-chip">Archive</span></div><p class="role-copy">${coach.status==='retired'?`${esc(coach.name)} completed a ${coach.careerLength}-season coaching career.`:`${esc(coach.name)} is in season ${Math.min((coach.careerYear||0)+1,coach.careerLength||1)} of a planned ${coach.careerLength}-season career.`}</p></section></div>`;
}

function ownerPage(id, tabRaw='overview') {
  const owner=ownerById(id); if(!owner) return notFound();
  const currentClub=state.clubs.find((club)=>club.ownerId===id) || (owner.clubId?clubById(owner.clubId):null) || (owner.formerClubId?clubById(owner.formerClubId):null);
  const profile=OWNER_PROFILES[owner.profile];
  const ownerClubId=currentClub?.id||owner.clubId||owner.formerClubId;
  const clubRows=(state.history.clubSeasons||[]).filter((row)=>row.clubId===ownerClubId&&row.season>=(owner.appointmentSeason||0));
  const honours=publicHistoryChampions().filter((row)=>row.winnerId===ownerClubId&&row.season>=(owner.appointmentSeason||0)&&!row.isInternational);
  const tabs=entityTabs(`#/owner/${id}`,[['overview','Overview'],['legacy','Legacy']],[ 'overview','legacy'].includes(tabRaw)?tabRaw:'overview');
  const ownerHero=`<section class="entity-hero coach-entity compact-profile-hero"><div class="player-number">♛</div><div class="entity-main"><div class="entity-badges">${staffRarityBadge(owner.rarity)}${flag(owner.nationality)}</div><span class="entity-kicker">${esc(profile?.label||owner.profile)}</span><h2>${esc(owner.name)}</h2><div class="entity-meta">${currentClub?teamLink(currentClub.id):'<span class="muted">Former president</span>'}</div></div><div class="rating-orbit"><strong>${owner.quality||'—'}</strong><span>QUALITY</span></div></section>`;
  const head=`${ownerHero}${tabs}`;
  if(tabRaw==='legacy') return `${head}<div class="stats-ribbon">${statCard('Seasons',Math.max(0,state.season-(owner.appointmentSeason||state.season)+1))}${statCard('Titles',honours.length)}${statCard('Best league finish',clubRows.length?Math.min(...clubRows.map((r)=>r.position)):'—')}${statCard('Term remaining',owner.yearsRemaining??'—')}</div><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">TROPHIES DURING TENURE</span><h3>${currentClub?esc(currentClub.name):'Former club'}</h3></div></div>${honoursList(honours,'competitionName')}</section>`;
  return `${head}<div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">LEADERSHIP STYLE</span><h3>${esc(profile?.label||owner.profile)}</h3></div></div><p class="role-copy">${esc(profile?.description||'Club leadership profile.')}</p></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">TERM</span><h3>${owner.yearsRemaining??'—'} years remaining</h3></div></div><div class="staff-effects"><span>Money influence</span><span>Negotiation influence</span><span>Board patience</span></div></section></div>`;
}

function clubBody(club) {
  const history = getClubHistory(state, club.id);
  const table = getLeagueTable(state, club.leagueId);
  const position = table.findIndex((row) => row.teamId === club.id) + 1;
  const tableRow = table.find((row) => row.teamId === club.id);
  const honours = publicHistoryChampions().filter((row) => !row.isInternational && row.winnerId === club.id);
  const owner = ownerById(club.ownerId);
  const coach = coachById(club.coachId);
  const ownerProfile = OWNER_PROFILES[owner?.profile];
  const coachProfile = COACH_PROFILES[coach?.profile];
  return `<div class="club-modal-hero">${crest(club.id, 'xl')}<div><span>${flag(club.country)} ${esc(club.country)} · ${esc(club.city)} · ${club.division === 1 ? 'Top division' : 'Promotion pool'}</span><h2>${esc(club.name)}</h2><p>Strength ${club.strength} · Reputation ${Math.round(club.reputation)} · ${fmt(club.fans)} supporters</p></div></div>
    <div class="club-modal-metrics">${statCard('League position', club.division === 1 ? (position || '—') : 'Second tier', tableRow ? `${tableRow.points} points` : 'Promotion candidate')}${statCard('Finances', money(club.finances), `${money(club.transferBudget)} transfer budget`)}${statCard('Historic titles', honours.length)}${statCard('Current form', tableRow?.form.join(' ') || '—')}</div>
    <div class="staff-grid section-gap">
      <section class="staff-card"><span class="eyebrow">OWNER / PRESIDENT</span><div class="staff-card-head"><div class="staff-avatar">♛</div><div><h3>${esc(owner?.name || 'Vacant')}</h3>${owner ? staffRarityBadge(owner.rarity) : ''}</div></div><strong>${esc(ownerProfile?.label || 'No profile')}</strong><p>${esc(ownerProfile?.description || 'The club is awaiting new ownership.')}</p><div class="staff-effects"><span>Money ×${Number(club.ownerMoneyMultiplier || 1).toFixed(2)}</span><span>Negotiation +${Math.round((club.ownerNegotiationBonus || 0) * 100)}%</span><span>Patience ×${Number(club.ownerPatience || 1).toFixed(2)}</span><span>${money(club.ownerAnnualInjection||0)}/yr cash</span><span>${owner?.yearsRemaining ?? '—'} years remaining</span></div></section>
      <section class="staff-card"><span class="eyebrow">HEAD COACH</span><div class="staff-card-head">${coach ? coachPortrait(coach, 'lg') : '<div class="staff-avatar">⌁</div>'}<div><h3>${coach ? coachLink(coach.id, false) : 'Vacant'}</h3>${coach ? staffRarityBadge(coach.rarity) : ''}</div></div><strong>${esc(coachProfile?.label || 'No tactical identity')}</strong><p>${esc(coachProfile?.description || 'The board is searching for a new coach.')}</p><div class="staff-effects"><span>Quality ${coach?.quality || '—'}</span><span>${coach ? `Focus ${esc(COACH_FOCUSES[coach.focus]?.label || 'Balanced')}` : '—'}</span><span>${coach?.seasonsInRole || 0} seasons in role</span><span>${coach ? `Career Y${Math.min((coach.careerYear || 0) + 1, coach.careerLength || 1)}/${coach.careerLength || '—'}` : '—'}</span><span>${coach?.trophies || 0} trophies</span></div></section>
    </div>
    <div class="two-column section-gap"><section><div class="modal-section-head">KEY PLAYERS</div><div class="squad-list">${history.allCurrentPlayers.map((player) => `<a class="squad-row squad-row-wide" href="#/player/${player.id}/overview"><span>${player.position}</span><div><strong>${esc(player.name)}</strong><small>${rarityBadge(player.rarity)} ${esc(player.roleLabel)} · ${player.contractYears ? `${player.contractYears} yr` : 'Free'}</small></div><b>${player.rating}</b></a>`).join('')}</div></section><section><div class="modal-section-head">TROPHIES</div>${honoursList(honours, 'competitionName')}<div class="modal-section-head recent-head">RECENT SEASONS</div><div class="archive-list">${[...history.seasons].reverse().slice(0, 8).map((season) => `<div class="archive-row"><strong>${season.seasonLabel}</strong><span>${esc(competitionLabel(season.leagueId))}</span><b>${season.position}</b></div>`).join('') || '<div class="empty-state compact">No archived seasons yet.</div>'}</div></section></div>`;
}

function clubModal() {
  if (!clubModalId) return '';
  const club = clubById(clubModalId);
  return club ? `<div class="modal-overlay" data-action="close-club-modal"><div class="club-modal" data-action="noop"><div class="modal-toolbar"><button class="close-button" data-action="close-club-modal">×</button><a class="secondary-button" href="#/club/${club.id}">Open full club page</a></div>${clubBody(club)}</div></div>` : '';
}

function clubSeasonRows(club) {
  const seasons = getClubHistory(state, club.id).seasons;
  return [...seasons].sort((a,b)=>b.season-a.season);
}

function clubAllTimePlayerRows(clubId) {
  const map = new Map();
  for (const row of state.history.playerSeasons || []) {
    if (row.teamId !== clubId || row.isInternational) continue;
    const item = map.get(row.playerId) || { playerId: row.playerId, games:0, goals:0, assists:0, cleanSheets:0, ratingWeighted:0, titles:0 };
    item.games += row.apps || 0; item.goals += row.goals || 0; item.assists += row.assists || 0; item.cleanSheets += row.cleanSheets || 0; item.ratingWeighted += (row.averageRating||0)*(row.apps||0); map.set(row.playerId,item);
  }
  for (const row of Object.values(state.current.playerStats || {})) {
    if (row.teamId !== clubId || row.isInternational) continue;
    const item = map.get(row.playerId) || { playerId: row.playerId, games:0, goals:0, assists:0, cleanSheets:0, ratingWeighted:0, titles:0 };
    item.games += row.apps || 0; item.goals += row.goals || 0; item.assists += row.assists || 0; item.cleanSheets += row.cleanSheets || 0; item.ratingWeighted += (row.averageRating||0)*(row.apps||0); map.set(row.playerId,item);
  }
  for (const honour of publicHistoryHonours()) if (honour.teamId===clubId && map.has(honour.playerId)) map.get(honour.playerId).titles += 1;
  return [...map.values()].map((row)=>({...row,averageRating:row.games?row.ratingWeighted/row.games:0}));
}

function clubRivalries(clubId) {
  const staticRows = RIVALRY_DEFINITIONS.filter((row)=>row.clubAId===clubId||row.clubBId===clubId).map((definition)=>({ definition, opponentId:definition.clubAId===clubId?definition.clubBId:definition.clubAId, static:true }));
  const finalCounts = new Map();
  for(const match of state.history.landmarkMatches||[]){ if(isShowcaseMatchEmbargoed(state,match)||match.isInternational||match.stage!=='Final'||![match.homeId,match.awayId].includes(clubId)) continue; const opp=match.homeId===clubId?match.awayId:match.homeId; finalCounts.set(opp,(finalCounts.get(opp)||0)+1); }
  for(const [opponentId,count] of finalCounts) if(count>=2&&!staticRows.some((row)=>row.opponentId===opponentId)) staticRows.push({definition:{name:'emerging finals rivalry'},opponentId,static:false});
  return staticRows.map((row)=>{
    const matches=[...(state.history.landmarkMatches||[]),...(state.current.matches||[])].filter((m)=>!isShowcaseMatchEmbargoed(state,m)&&!m.isInternational&&((m.homeId===clubId&&m.awayId===row.opponentId)||(m.awayId===clubId&&m.homeId===row.opponentId)));
    let wins=0,draws=0,losses=0,gf=0,ga=0;
    for(const m of matches){const home=m.homeId===clubId;const a=home?m.homeGoals:m.awayGoals,b=home?m.awayGoals:m.homeGoals;gf+=a;ga+=b;if(a>b)wins++;else if(a<b)losses++;else draws++;}
    return {...row,matches:matches.length,wins,draws,losses,gf,ga,last:matches[matches.length-1]||null};
  }).sort((a,b)=>b.matches-a.matches);
}

function clubPage(id, tabRaw='overview') {
  const club = clubById(id);
  if (!club) return notFound();
  const tab = CLUB_PAGE_TABS.includes(tabRaw) ? tabRaw : 'overview';
  const history = getClubHistory(state, club.id);
  const table = getLeagueTable(state, club.leagueId);
  const position = table.findIndex((row)=>row.teamId===club.id)+1;
  const tableRow = table.find((row)=>row.teamId===club.id);
  const honours = publicHistoryChampions().filter((row)=>!row.isInternational&&row.winnerId===club.id);
  const owner=ownerById(club.ownerId), coach=coachById(club.coachId);
  const tabs=entityTabs(`#/club/${club.id}`, [['overview','Overview'],['squad','Squad'],['staff','Staff'],['season','Season'],['history','History'],['honours','Honors'],['records','Records'],['legends','Legends'],['rivalries','Rivalries']],tab);
  const clubVisual = CLUB_VISUALS[club.name];
  const clubAccent = clubVisual?.[0] || `hsl(${club.crestHue ?? 215},72%,48%)`;
  const clubAccentSecondary = clubVisual?.[1] || `hsl(${club.crestHue ?? 215},72%,72%)`;
  const clubAccentBorder = clubVisual?.[2] || `hsl(${club.crestHue ?? 215},72%,38%)`;
  const clubHero = `<section class="club-profile-hero premium-club-hero compact-club-hero" style="--club-hue:${club.crestHue ?? 215};--club-accent-bg:${clubAccent};--club-accent-secondary:${clubAccentSecondary};--club-accent-border:${clubAccentBorder}">${crest(club.id,'xl')}<div><span>${flag(club.country)} ${esc(club.country)} · ${esc(club.city)}</span><h2>${esc(club.name)}</h2><p>${esc(competitionLabel(club.leagueId))} · ${club.division===1?'Top division':'Promotion pool'}</p></div><div class="rating-orbit"><strong>${Math.round(getTeamPower(state,club.id,false))}</strong><span>POWER</span></div></section>`;
  const head=`${clubHero}<div class="club-page-actions">${favoriteButton('club',club.id)}</div>${tabs}`;
  if(tab==='squad') return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">CURRENT SQUAD CORE</span><h3>${history.allCurrentPlayers.length} named players</h3></div></div><div class="squad-list">${history.allCurrentPlayers.map((player)=>`<a class="squad-row squad-row-wide squad-row-visual" href="#/player/${player.id}/overview">${playerPortrait(player, 'sm')}<span class="position-pill pos-${player.position.toLowerCase()}">${player.position}</span><div><strong>${esc(player.name)}</strong><small>${rarityBadge(player.rarity)} ${esc(player.roleLabel)} · ${player.contractYears?`${player.contractYears} yr`:'Free'} · ${money(player.marketValue)}</small></div><b>${player.rating}</b></a>`).join('')}</div></section><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">ALL-TIME LEADERS</span><h3>Club career</h3></div></div>${clubPlayerLeadersTable(club.id)}</section>`;
  if(tab==='staff') return `${head}<div class="staff-grid"><section class="staff-card"><span class="eyebrow">OWNER / PRESIDENT</span><div class="staff-card-head"><div class="staff-avatar">♛</div><div><h3>${owner?ownerLink(owner.id):'Vacant'}</h3>${owner?staffRarityBadge(owner.rarity):''}</div></div><strong>${esc(OWNER_PROFILES[owner?.profile]?.label||'No profile')}</strong><p>${esc(OWNER_PROFILES[owner?.profile]?.description||'The club is awaiting leadership.')}</p><div class="staff-effects"><span>Money ×${Number(club.ownerMoneyMultiplier||1).toFixed(2)}</span><span>Negotiation +${Math.round((club.ownerNegotiationBonus||0)*100)}%</span><span>Patience ×${Number(club.ownerPatience||1).toFixed(2)}</span><span>${money(club.ownerAnnualInjection||0)}/yr cash</span><span>${owner?.yearsRemaining??'—'} years remaining</span></div></section><section class="staff-card"><span class="eyebrow">HEAD COACH</span><div class="staff-card-head">${coach ? coachPortrait(coach, 'lg') : '<div class="staff-avatar">⌁</div>'}<div><h3>${coach?coachLink(coach.id,false):'Vacant'}</h3>${coach?staffRarityBadge(coach.rarity):''}</div></div><strong>${esc(COACH_PROFILES[coach?.profile]?.label||'No tactical identity')}</strong><p>${esc(COACH_PROFILES[coach?.profile]?.description||'The club is searching for a coach.')}</p><div class="staff-effects"><span>Quality ${coach?.quality||'—'}</span><span>${coach?esc(COACH_FOCUSES[coach.focus]?.label||'Balanced'):'—'}</span><span>${coach?.seasonsInRole||0} seasons in role</span><span>${coach?`Y${Math.min((coach.careerYear||0)+1,coach.careerLength||1)}/${coach.careerLength||'—'}`:'—'}</span></div></section></div>`;
  if(tab==='season') {
    const comps=[club.leagueId,`CUP-${club.leagueId}`,`SC-${club.leagueId}`,...Object.values(state.current.continentalCompetitions||{}).filter((c)=>c.participantIds?.includes(club.id)||c.groups?.some((g)=>g.teamIds?.includes(club.id))).map((c)=>c.id),...Object.values(state.current.globalClubCompetitions||{}).filter((c)=>c.participantIds?.includes(club.id)||c.groups?.some((g)=>g.teamIds?.includes(club.id))).map((c)=>c.id)];
    const matches=(state.current.matches||[]).filter((m)=>!isShowcaseMatchEmbargoed(state,m)&&!m.isInternational&&[m.homeId,m.awayId].includes(club.id)).sort((a,b)=>b.week-a.week);
    return `${head}<div class="stats-ribbon">${statCard('League position',club.division===1?(position||'—'):'Second tier',tableRow?`${tableRow.points} points`:'')}${statCard('Record',tableRow?`${tableRow.wins}-${tableRow.draws}-${tableRow.losses}`:'—',tableRow?`${tableRow.gf}-${tableRow.ga} goals`:'')}${statCard('Current power',getTeamPower(state,club.id,false).toFixed(1),`Strength ${club.strength}`)}${statCard('Finances',money(club.finances),`${getClubFinancialStatus(state,club.id)?.label || 'Remaining'} · ${money(club.transferBudget)} budget`)}</div><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">CURRENT COMPETITIONS</span><h3>${esc(state.current.seasonLabel)}</h3></div></div><div class="quick-link-grid">${[...new Set(comps)].filter((cid)=>descriptor(cid)).map((cid)=>`<a class="quick-link-card" href="#/competition/${cid}/overview"><span>${esc(descriptor(cid)?.type||'Competition')}</span><strong>${esc(competitionLabel(cid))}</strong><small>Open competition →</small></a>`).join('')}</div></section><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">RECENT MATCHES</span><h3>Current season</h3></div></div><div class="matches-list">${matches.slice(0,16).map((m)=>matchRow(m,true)).join('')||'<div class="empty-state">No current matches yet.</div>'}</div></section>`;
  }
  if(tab==='history') {
    const seasons=clubSeasonRows(club); return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">SEASON-BY-SEASON</span><h3>Club chronicle</h3></div></div><div class="table-scroll"><table class="data-table club-history-table"><thead><tr><th>Season</th><th>League pos.</th><th>Games</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Trophies</th><th>Coach</th><th>Best player</th></tr></thead><tbody>${seasons.map((row)=>{const titles=honours.filter((h)=>h.season===row.season);const competitionRows=(state.history.clubCompetitionSeasons||[]).filter((r)=>r.season===row.season&&r.teamId===club.id&&!r.isInternational);const totals=competitionRows.length?competitionRows.reduce((sum,r)=>({games:sum.games+(r.apps||0),wins:sum.wins+(r.wins||0),draws:sum.draws+(r.draws||0),losses:sum.losses+(r.losses||0),gf:sum.gf+(r.gf||0),ga:sum.ga+(r.ga||0)}),{games:0,wins:0,draws:0,losses:0,gf:0,ga:0}):{games:row.played||0,wins:row.wins||0,draws:row.draws||0,losses:row.losses||0,gf:row.gf||0,ga:row.ga||0};const coachRow=(state.history.coachSeasons||[]).filter((r)=>r.season===row.season&&r.teamId===club.id&&!r.isInternational).sort((a,b)=>b.games-a.games)[0];const playerRows=(state.history.playerSeasons||[]).filter((r)=>r.season===row.season&&r.teamId===club.id&&!r.isInternational);const playerTotals=new Map();for(const r of playerRows){const item=playerTotals.get(r.playerId)||{playerId:r.playerId,apps:0,ratingWeighted:0,goals:0,assists:0};item.apps+=r.apps||0;item.ratingWeighted+=(r.averageRating||0)*(r.apps||0);item.goals+=r.goals||0;item.assists+=r.assists||0;playerTotals.set(r.playerId,item);}const best=[...playerTotals.values()].map((item)=>({...item,averageRating:item.apps?item.ratingWeighted/item.apps:0})).sort((a,b)=>(b.averageRating*Math.sqrt(Math.max(1,b.apps)))-(a.averageRating*Math.sqrt(Math.max(1,a.apps)))||b.apps-a.apps||b.goals-a.goals||b.assists-a.assists)[0];return `<tr><td><strong>${esc(row.seasonLabel)}</strong></td><td><strong>${row.position}</strong></td><td>${totals.games}</td><td>${totals.wins}</td><td>${totals.draws}</td><td>${totals.losses}</td><td>${totals.gf}</td><td>${totals.ga}</td><td>${titles.map((t)=>esc(t.competitionName)).join(', ')||'—'}</td><td>${coachRow?coachLink(coachRow.coachId):'—'}</td><td>${best?playerLink(best.playerId):'—'}</td></tr>`;}).join('')||'<tr><td colspan="11">No archived seasons yet.</td></tr>'}</tbody></table></div></section>`;
  }
  if(tab==='honours') return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">TROPHY CABINET</span><h3>${honours.length} titles</h3></div></div>${honoursList(honours,'competitionName')}</section>`;
  if(tab==='records') return `${head}${clubRecordsPage(club)}`;
  if(tab==='legends') {
    const legends=(state.history.clubLegends||[]).filter((row)=>row.clubId===club.id).sort((a,b)=>b.score-a.score); return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">CLUB LEGENDS</span><h3>Names written into ${esc(club.name)} history</h3></div><span class="muted">Recognition is decided when a player retires</span></div>${legends.length?`<div class="legend-grid">${legends.map((row,index)=>`<a class="legend-card" href="#/player/${row.playerId}/overview"><b>#${index+1}</b><div><strong>${esc(playerById(row.playerId)?.name||row.playerId)}</strong><span>${row.seasons} seasons · ${row.games} games · ${row.goals} goals · ${row.titles} titles</span><small>Club legacy ${row.score} · Rating ${row.averageRating.toFixed(2)}</small></div></a>`).join('')}</div>`:'<div class="empty-state">No player has yet completed a career worthy of club-legend status.</div>'}</section>`;
  }
  if(tab==='rivalries') {
    const rows=clubRivalries(club.id); return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">RIVALRIES</span><h3>Historic and emerging opponents</h3></div></div>${rows.length?`<div class="rivalry-grid">${rows.map((row)=>`<article class="rivalry-card"><div><span>${row.static?'HISTORIC RIVALRY':'EMERGING RIVALRY'}</span><h3>${esc(row.definition.name)}</h3><p>${teamLink(row.opponentId)}</p></div><div class="rivalry-record"><strong>${row.wins}-${row.draws}-${row.losses}</strong><span>W-D-L · ${row.gf}-${row.ga} goals</span><small>${row.matches} stored meetings</small></div></article>`).join('')}</div>`:'<div class="empty-state">No established rivalry is stored yet.</div>'}</section>`;
  }
  return `${head}<div class="stats-ribbon section-gap">${statCard('League',club.division===1?(position?`#${position}`:'—'):'2nd tier',tableRow?`${tableRow.points} points`:'')}${statCard('Finances',money(club.finances),`${money(club.transferBudget)} budget`)}${statCard('Honors',honours.length,`${(state.history.clubLegends||[]).filter((r)=>r.clubId===club.id).length} club legends`)}${statCard('Reputation',Math.round(club.reputation),`${fmt(club.fans)} supporters`)}</div><div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">KEY PLAYERS</span><h3>Current core</h3></div><a href="#/club/${club.id}/squad">Full squad</a></div><div class="squad-list">${history.allCurrentPlayers.slice(0,7).map((player)=>`<a class="squad-row squad-row-wide squad-row-visual" href="#/player/${player.id}/overview">${playerPortrait(player, 'sm')}<span class="position-pill pos-${player.position.toLowerCase()}">${player.position}</span><div><strong>${esc(player.name)}</strong><small>${rarityBadge(player.rarity)} ${esc(player.roleLabel)}</small></div><b>${player.rating}</b></a>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">LEADERSHIP</span><h3>Club identity</h3></div></div><div class="identity-list"><div><span>President</span><strong>${owner?ownerLink(owner.id):'Vacant'}</strong></div><div><span>Coach</span><strong>${coach?coachLink(coach.id):'Vacant'}</strong></div><div><span>Coach focus</span><strong>${esc(COACH_FOCUSES[coach?.focus]?.label||'—')}</strong></div><div><span>Recent form</span><strong>${tableRow?.form?.join(' ')||'—'}</strong></div></div></section></div>`;
}

function clubPlayerLeadersTable(clubId){const rows=clubAllTimePlayerRows(clubId).sort((a,b)=>b.games-a.games).slice(0,15);return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Player</th><th>G</th><th>Goals</th><th>Assists</th><th>CS</th><th>Rating</th><th>Titles</th></tr></thead><tbody>${rows.map((r)=>`<tr><td>${playerLink(r.playerId)}</td><td>${r.games}</td><td>${r.goals}</td><td>${r.assists}</td><td>${r.cleanSheets}</td><td>${r.averageRating?r.averageRating.toFixed(2):'—'}</td><td>${r.titles}</td></tr>`).join('')||'<tr><td colspan="7">No archived player history yet.</td></tr>'}</tbody></table></div>`;}

function clubRecordsPage(club){const seasons=clubSeasonRows(club);const players=clubAllTimePlayerRows(club.id);const bestPoints=[...seasons].sort((a,b)=>b.points-a.points)[0],bestWins=[...seasons].sort((a,b)=>b.wins-a.wins)[0],bestGoals=[...seasons].sort((a,b)=>b.gf-a.gf)[0];const scorer=[...players].sort((a,b)=>b.goals-a.goals)[0],apps=[...players].sort((a,b)=>b.games-a.games)[0],assists=[...players].sort((a,b)=>b.assists-a.assists)[0];const transfer=[...(state.history.transfers||[])].filter((t)=>t.toClubId===club.id).sort((a,b)=>b.fee-a.fee)[0];return `<div class="record-grid">${statCard('Highest points',bestPoints?.points??'—',bestPoints?.seasonLabel||'')}${statCard('Most league wins',bestWins?.wins??'—',bestWins?.seasonLabel||'')}${statCard('Most league goals',bestGoals?.gf??'—',bestGoals?.seasonLabel||'')}${statCard('All-time scorer',scorer?scorer.goals:'—',scorer?playerById(scorer.playerId)?.name:'')}${statCard('Most appearances',apps?apps.games:'—',apps?playerById(apps.playerId)?.name:'')}${statCard('Most assists',assists?assists.assists:'—',assists?playerById(assists.playerId)?.name:'')}${statCard('Record signing',transfer?money(transfer.fee):'—',transfer?playerById(transfer.playerId)?.name:'')}</div>`;}

function nationalLineup(id) {
  const active = state.players.filter((player) => player.nationality === id && player.status === 'active').sort((a, b) => b.rating - a.rating);
  const goalkeeper = active.find((player) => player.position === 'GK');
  const outfield = active.filter((player) => player.position !== 'GK').slice(0, goalkeeper ? 7 : 8);
  return goalkeeper ? [goalkeeper, ...outfield] : outfield;
}

function nationPage(id) {
  const nation = nationalById(id);
  if (!nation) return notFound();
  const pool = state.players.filter((player) => player.nationality === id && player.status === 'active').sort((a, b) => b.rating - a.rating);
  const lineup = nationalLineup(id);
  const matches = state.current.matches.filter((match) => !isShowcaseMatchEmbargoed(state, match) && match.isInternational && [match.homeId, match.awayId].includes(id));
  const honours = publicHistoryChampions().filter((row) => row.isInternational && row.winnerId === id);
  const coach = coachById(nation.coachId);
  const coachProfile = COACH_PROFILES[coach?.profile];
  return `<section class="nation-hero compact-nation-hero">${flag(id, 'xl')}<div><span>${esc(nation.region)} · Generation tier ${nation.tier}</span><h2>${esc(nation.name)}</h2><p>${pool.length} active named players · ${lineup.length} selected</p></div><strong>${nation.strength}</strong></section><div class="entity-page-actions">${favoriteButton('nation',nation.id)}</div>
    <section class="staff-card section-gap national-coach-card"><span class="eyebrow">NATIONAL COACH</span><div class="staff-card-head">${coach ? coachPortrait(coach, 'lg') : '<div class="staff-avatar">⌁</div>'}<div><h3>${coach ? coachLink(coach.id, false) : 'Vacant'}</h3>${coach ? staffRarityBadge(coach.rarity) : ''}</div></div><strong>${esc(coachProfile?.label || 'No tactical identity')}</strong><p>${esc(coachProfile?.description || 'The federation is searching for a coach.')}</p><div class="staff-effects"><span>Quality ${coach?.quality || '—'}</span><span>${coach ? `Focus ${esc(COACH_FOCUSES[coach.focus]?.label || 'Balanced')}` : '—'}</span><span>${coach?.seasonsInRole || 0} seasons in role</span><span>${coach ? `Career Y${Math.min((coach.careerYear || 0) + 1, coach.careerLength || 1)}/${coach.careerLength || '—'}` : '—'}</span><span>${coach?.trophies || 0} trophies</span></div></section>
    <div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">CURRENT SELECTION</span><h3>Best eight</h3></div></div><div class="squad-list">${lineup.map((player) => `<a class="squad-row squad-row-wide squad-row-visual" href="#/player/${player.id}/overview">${playerPortrait(player, 'sm')}<span class="position-pill pos-${player.position.toLowerCase()}">${player.position}</span><div><strong>${esc(player.name)}</strong><small>${rarityBadge(player.rarity)} ${player.clubId ? esc(clubById(player.clubId)?.name) : 'National pool'} · ${esc(player.roleLabel)}</small></div><b>${player.rating}</b></a>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">NATIONAL HONORS</span><h3>${honours.length} trophies</h3></div></div>${honoursList(honours, 'competitionName')}<div class="panel-head recent-head"><div><span class="eyebrow">CURRENT RESULTS</span><h3>International matches</h3></div></div><div class="matches-list">${matches.slice(-12).reverse().map((match) => matchRow(match, true)).join('') || '<div class="empty-state compact">No matches yet.</div>'}</div></section></div>`;
}

function aggregateCoachAlmanac(scope = 'all') {
  const map = new Map();
  const rows = [
    ...(state.history.coachCompetitionSeasons || []),
    ...(state.current.completed ? [] : Object.values(state.current.coachStats || {}))
  ];
  rows.forEach((row) => {
    if (scope === 'club' && row.isInternational) return;
    if (scope === 'international' && !row.isInternational) return;
    const item = map.get(row.coachId) || { coachId: row.coachId, games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cleanSheets: 0, titles: 0 };
    for (const field of ['games','wins','draws','losses','gf','ga','cleanSheets','titles']) item[field] += row[field] || 0;
    map.set(row.coachId, item);
  });
  state.coaches.forEach((coach) => { if (!map.has(coach.id) && (coach.clubId || coach.nationalTeamId)) map.set(coach.id, { coachId: coach.id, games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cleanSheets: 0, titles: 0 }); });
  return [...map.values()].map((row) => ({ ...row, winPct: row.games ? row.wins / row.games : 0 }));
}


function globalRecordsPage() {
  // One-pass aggregates only. The old version called career reducers once per player/coach,
  // which became quadratic and could lock up long universes.
  const playerRows = aggregatePlayerAlmanac();
  const coachRows = aggregateCoachAlmanac('all');
  const teams = aggregateTeamAlmanac();
  const top = (rows, key) => rows.reduce((best, row) => !best || (row[key] || 0) > (best[key] || 0) ? row : best, null);
  const scorer = top(playerRows, 'goals');
  const assister = top(playerRows, 'assists');
  const apps = top(playerRows, 'games');
  const rating = playerRows.filter((row) => row.games >= 100).reduce((best,row)=>!best||row.averageRating>best.averageRating?row:best,null);
  const coachWins = top(coachRows, 'wins');
  const coachTitles = top(coachRows, 'titles');
  const clubTitles = teams.filter((row)=>!row.international).reduce((best,row)=>!best||row.titles>best.titles?row:best,null);
  const nationTitles = teams.filter((row)=>row.international).reduce((best,row)=>!best||row.titles>best.titles?row:best,null);
  const bestPoints = (state.history.clubSeasons || []).reduce((best,row)=>!best||row.points>best.points?row:best,null);
  const biggestTransfer = (state.history.transfers || []).reduce((best,row)=>!best||row.fee>best.fee?row:best,null);
  const ballonCounts = new Map();
  for (const award of publicHistoryAwards()) if ((award.rank || 1) === 1 && String(award.name).includes("Ballon d'Or")) ballonCounts.set(award.playerId, (ballonCounts.get(award.playerId) || 0) + 1);
  const ballon = [...ballonCounts.entries()].reduce((best,row)=>!best||row[1]>best[1]?row:best,null);
  const cards = [
    ['Career goals', scorer?.goals ?? 0, scorer ? playerById(scorer.playerId)?.name : '—'],
    ['Career assists', assister?.assists ?? 0, assister ? playerById(assister.playerId)?.name : '—'],
    ['Career games', apps?.games ?? 0, apps ? playerById(apps.playerId)?.name : '—'],
    ['Highest career rating', rating ? rating.averageRating.toFixed(2) : '—', rating ? playerById(rating.playerId)?.name : 'Min. 100 games'],
    ["Ballon d'Or record", ballon?.[1] ?? 0, ballon ? playerById(ballon[0])?.name : '—'],
    ['Coach wins', coachWins?.wins ?? 0, coachWins ? coachById(coachWins.coachId)?.name : '—'],
    ['Coach titles', coachTitles?.titles ?? 0, coachTitles ? coachById(coachTitles.coachId)?.name : '—'],
    ['Club titles', clubTitles?.titles ?? 0, clubTitles ? getEntityName(state, clubTitles.teamId, false) : '—'],
    ['National titles', nationTitles?.titles ?? 0, nationTitles ? getEntityName(state, nationTitles.teamId, true) : '—'],
    ['League points', bestPoints?.points ?? 0, bestPoints ? `${clubById(bestPoints.clubId)?.name} · ${bestPoints.seasonLabel}` : '—'],
    ['Record transfer', biggestTransfer ? money(biggestTransfer.fee) : '—', biggestTransfer ? playerById(biggestTransfer.playerId)?.name : '—'],
    ['Hall of Famers', (state.history.hallOfFamePlayers || []).length, 'Inducted after retirement']
  ];
  return `<div class="record-grid">${cards.map(([label,value,note])=>statCard(label,value,note)).join('')}</div>`;
}

function almanacPage(sectionRaw = 'champions') {
  const allowed = ['champions', 'teams', 'records'];
  const section = allowed.includes(sectionRaw) ? sectionRaw : 'champions';
  const tabs = `<nav class="competition-tabs"><a href="#/almanac/champions" class="${section === 'champions' ? 'active' : ''}">Champions</a><a href="#/almanac/teams" class="${section === 'teams' ? 'active' : ''}">Teams</a><a href="#/almanac/records" class="${section === 'records' ? 'active' : ''}">Records</a></nav>`;
  const regionControl = `<label>Region<select id="almanac-region-filter">${regionOptions(almanacRegionFilter)}</select></label>`;
  if (section === 'records') return `${pageHead('PERMANENT HISTORY','World Records','The biggest career, team, coaching and transfer marks in this universe.')}${tabs}<section class="panel">${globalRecordsPage()}</section>`;
  if (section === 'teams') {
    const sorters = { titles:(a,b)=>b.titles-a.titles||b.wins-a.wins, games:(a,b)=>b.games-a.games, wins:(a,b)=>b.wins-a.wins, winPct:(a,b)=>b.winPct-a.winPct||b.games-a.games, goals:(a,b)=>b.gf-a.gf, cleanSheets:(a,b)=>(b.cleanSheets||0)-(a.cleanSheets||0) };
    const rows = aggregateTeamAlmanac().filter((row)=>{ const country=row.international?nationalById(row.teamId)?.name:clubById(row.teamId)?.country; return almanacRegionFilter==='ALL'||COUNTRY_META[country]?.region===almanacRegionFilter; }).sort(sorters[almanacTeamSort]||sorters.titles).slice(0,150);
    const controls=`<div class="filter-toolbar">${regionControl}<label>Rank by<select id="almanac-team-sort">${[['titles','Total honors'],['games','Games'],['wins','Wins'],['winPct','Win percentage'],['goals','Goals scored']].map(([v,l])=>`<option value="${v}" ${almanacTeamSort===v?'selected':''}>${l}</option>`).join('')}</select></label><span>Top 150</span></div>`;
    return `${pageHead('PERMANENT HISTORY', 'Team Almanac', 'Compare club and national-team records across the entire universe.')}${tabs}<section class="panel">${controls}<div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Team</th><th>Region</th><th>Current competition</th><th>Games</th><th>Wins</th><th>Win %</th><th>GF</th><th>GA</th><th>Domestic</th><th>Continental</th><th>International</th><th>Total honors</th></tr></thead><tbody>${rows.map((row,index)=>{const club=row.international?null:clubById(row.teamId);const country=row.international?nationalById(row.teamId)?.name:club?.country;return `<tr><td>${index+1}</td><td>${teamLink(row.teamId,row.international)}</td><td>${esc(COUNTRY_META[country]?.region||'—')}</td><td>${row.international?'International football':esc(competitionLabel(club?.leagueId)||club?.country||'—')}</td><td>${row.games}</td><td><strong>${row.wins}</strong></td><td>${row.games?`${(row.winPct*100).toFixed(1)}%`:'—'}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.domesticTitles}</td><td>${row.continentalTitles}</td><td>${row.internationalTitles}</td><td><strong>${row.titles}</strong></td></tr>`;}).join('')}</tbody></table></div></section>`;
  }
  return `${pageHead('PERMANENT HISTORY','Champions','Every completed competition remains preserved with its winning team and coach.')}${tabs}<section class="almanac-hero"><div><span class="eyebrow">ARCHIVE SCALE</span><h2>${fmt(state.history.playerSeasons.length)} player-season rows</h2><p>${fmt(state.history.clubSeasons.length)} club-season summaries · ${fmt(state.history.awards.length)} award records · ${fmt(state.history.coachSeasons?.length||0)} coach-job seasons</p></div><div class="archive-seal">▤</div></section><section class="panel section-gap"><div class="archive-list">${[...publicHistoryChampions()].reverse().slice(0,200).map((champion)=>`<div class="archive-row"><strong>${champion.seasonLabel}</strong><span>${esc(champion.competitionName)}</span><div class="archive-winner-cell">${teamLink(champion.winnerId,champion.isInternational)}${champion.coachId?`<small>Coach: ${coachLink(champion.coachId)}</small>`:''}</div></div>`).join('')||'<div class="empty-state">No archived champions.</div>'}</div></section>`;
}

function offseasonTabs(active) {
  return `<nav class="competition-tabs"><a href="#/offseason/summary" class="${active==='summary'?'active':''}">Summary</a><a href="#/offseason/signings" class="${active==='signings'?'active':''}">Signings</a><a href="#/offseason/coaches" class="${active==='coaches'?'active':''}">Coach Market</a><a href="#/offseason/lifecycle" class="${active==='lifecycle'?'active':''}">Spawn & Retirements</a><a href="#/offseason/payroll" class="${active==='payroll'?'active':''}">Payroll</a><a href="#/offseason/boardroom" class="${active==='boardroom'?'active':''}">Boardroom</a></nav>`;
}

function offseasonPage(tabRaw='summary') {
  const data = state.current.offseason;
  const tab = ['summary','signings','coaches','lifecycle','payroll','boardroom'].includes(tabRaw) ? tabRaw : 'summary';
  if (!data) return `${pageHead('OFFSEASON','No offseason report yet','Complete a season and run the offseason to create the first lifecycle report.')}<section class="panel"><div class="empty-state">Retirements, new players, free agency, transfers, coaching moves and board changes will appear here.</div></section>`;
  const retiredPlayers = data.retirements.filter((item)=>item.type==='player').map((item)=>playerById(item.playerId)).filter(Boolean).sort((a,b)=>(STAR_RARITIES[b.rarity]?.rank||0)-(STAR_RARITIES[a.rarity]?.rank||0)||b.rating-a.rating);
  const retiredCoaches = data.retirements.filter((item)=>item.type==='coach').map((item)=>coachById(item.coachId)).filter(Boolean).sort((a,b)=>(STAFF_RARITIES[b.rarity]?.rank||0)-(STAFF_RARITIES[a.rarity]?.rank||0)||b.quality-a.quality);
  const newcomers = data.newStars.map((item)=>playerById(item.playerId)).filter(Boolean).sort((a,b)=>(STAR_RARITIES[b.rarity]?.rank||0)-(STAR_RARITIES[a.rarity]?.rank||0)||b.rating-a.rating);
  const newCoaches = (data.newCoaches||[]).map((item)=>coachById(item.coachId)).filter(Boolean).sort((a,b)=>(STAFF_RARITIES[b.rarity]?.rank||0)-(STAFF_RARITIES[a.rarity]?.rank||0)||b.quality-a.quality);
  const freeAgents = (data.freeAgents||[]).map((id)=>playerById(id)).filter(Boolean).slice(0,60);
  const freeAgentSignings = (data.freeAgentSignings||[]).map((move)=>({ ...move, player: playerById(move.playerId) })).filter((move)=>move.player).slice(-80).reverse();
  const transfers = [...(data.transfers||[])].sort((a,b)=>b.fee-a.fee);
  const ownerChanges = (data.ownerChanges||[]).slice(0,120);
  const payrollChanges = [...(data.payrollChanges||[])].sort((a,b)=>(b.pressure||0)-(a.pressure||0));
  const coachMoves = (data.coachMoves||[]).slice(-100).reverse();
  const rowPlayers=(rows,mode='new')=>rows.map((player)=>`<a class="squad-row squad-row-wide portrait-row" href="#/player/${player.id}/overview">${playerPortrait(player,'sm')}<span class="position-chip">${player.position}</span><div><strong>${esc(player.name)}</strong><small>${rarityBadge(player.rarity)} ${flag(player.nationality,'xs')} ${mode==='new'?(player.clubId?esc(clubById(player.clubId)?.name):'Free agent'):'Retired'} · Age ${state.season-player.birthYear}</small></div><b>${player.rating}</b></a>`).join('')||'<div class="empty-state compact">None this offseason.</div>';
  const head = `${pageHead('OFFSEASON',`${esc(data.seasonLabel)} lifecycle`,`The complete transition between seasons, split into markets, arrivals, retirements and leadership changes.`)}${offseasonTabs(tab)}`;
  if (tab === 'signings') {
    const rows = transfers.map((move)=>{const player=playerById(move.playerId); return `<tr><td>${playerLink(move.playerId)}</td><td>${player?rarityBadge(player.rarity):'—'}</td><td>${move.fromClubId?teamLink(move.fromClubId):'<span class="muted">Free agent</span>'}</td><td>${teamLink(move.toClubId)}</td><td><strong>${move.freeTransfer?'Free':money(move.fee)}</strong></td><td>${move.marketValue!=null?money(move.marketValue):player?money(player.marketValue):'—'}</td><td>${player?.contractYears||'—'} yr</td></tr>`;}).join('');
    return `${head}<div class="stats-ribbon">${statCard('Transfers',transfers.length)}${statCard('Spent',money(transfers.reduce((sum,row)=>sum+(row.fee||0),0)))}${statCard('Free-agent signings',freeAgentSignings.length)}${statCard('Still available',freeAgents.length)}</div><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">PLAYER MARKET</span><h3>Every offseason signing</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Player</th><th>Rarity</th><th>From</th><th>To</th><th>Fee</th><th>Market value</th><th>Contract</th></tr></thead><tbody>${rows||'<tr><td colspan="7">No transfers this offseason.</td></tr>'}</tbody></table></div></section>`;
  }
  if (tab === 'coaches') {
    return `${head}<div class="two-column"><section class="panel"><div class="panel-head"><div><span class="eyebrow">COACH MARKET</span><h3>Appointments & poaching</h3></div></div><div class="archive-list">${coachMoves.map((move)=>{const coach=coachById(move.coachId);const from=move.fromClubId?clubById(move.fromClubId)?.name:move.fromNationalTeamId?nationalById(move.fromNationalTeamId)?.name:'Free agency';const to=move.toClubId?clubById(move.toClubId)?.name:move.toNationalTeamId?nationalById(move.toNationalTeamId)?.name:'Free agency';return `<div class="archive-row archive-row-portrait"><div class="archive-person">${coach?coachPortrait(coach,'sm'):''}<strong>${coach?coachLink(coach.id):'Coach'}</strong></div><span>${esc(from||'Free agency')} → ${esc(to||'Free agency')}</span><b>${coach?staffRarityBadge(coach.rarity):''}</b></div>`;}).join('')||'<div class="empty-state compact">No coaching changes.</div>'}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">NEW COACHES</span><h3>Entering the market</h3></div></div><div class="archive-list">${newCoaches.map((coach)=>`<div class="archive-row archive-row-portrait"><div class="archive-person">${coachPortrait(coach,'sm')}<strong>${coachLink(coach.id)}</strong></div><span>${esc(COACH_PROFILES[coach.profile]?.label||coach.profile)} · ${esc(COACH_FOCUSES[coach.focus]?.label||'Balanced')}</span><b>${staffRarityBadge(coach.rarity)} ${coach.quality}</b></div>`).join('')||'<div class="empty-state compact">No new coaches.</div>'}</div></section></div>`;
  }
  if (tab === 'lifecycle') {
    return `${head}<div class="two-column"><section class="panel"><div class="panel-head"><div><span class="eyebrow">NEW GENERATION</span><h3>Players entering football</h3></div></div><div class="squad-list">${rowPlayers(newcomers,'new')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">PLAYER RETIREMENTS</span><h3>Careers completed</h3></div></div><div class="squad-list">${rowPlayers(retiredPlayers,'retired')}</div></section></div><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">COACH RETIREMENTS</span><h3>Managers leaving football</h3></div></div><div class="archive-list">${retiredCoaches.map((coach)=>`<div class="archive-row archive-row-portrait"><div class="archive-person">${coachPortrait(coach,'sm')}<strong>${coachLink(coach.id)}</strong></div><span>${esc(COACH_PROFILES[coach.profile]?.label||coach.profile)}</span><b>${staffRarityBadge(coach.rarity)}</b></div>`).join('')||'<div class="empty-state compact">No coach retirements.</div>'}</div></section>`;
  }
  if (tab === 'payroll') {
    const rows = payrollChanges.map((row)=>{const club=clubById(row.clubId); return `<tr><td>${teamLink(row.clubId)}</td><td>${row.goodSeasonsLast4}/4</td><td><strong>+${row.risePct}%</strong></td><td>${money(row.wageBefore)}</td><td>${money(row.wageAfter)}</td><td><span class="panel-chip">${Number(row.pressure||1).toFixed(2)}×</span></td><td>${money(club?.transferBudget||0)}</td></tr>`;}).join('');
    return `${head}<div class="stats-ribbon">${statCard('Salary resets',payrollChanges.length,'Successful clubs renegotiating')}${statCard('High pressure',payrollChanges.filter((row)=>row.pressure>=1.2).length,'May need to sell')}${statCard('Severe pressure',payrollChanges.filter((row)=>row.pressure>=1.4).length,'Little room to rebuild')}</div><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">DYNASTY COST</span><h3>Success raises the wage bill</h3></div><span class="muted">Repeated elite seasons compound salary pressure</span></div><p class="role-copy">One great season earns the squad a raise. Two strong seasons in three make the increase larger; three in four can seriously restrict the transfer budget and push valuable players onto the market. Overpaid low-rarity squad players are deliberately hard to move.</p><div class="table-scroll"><table class="data-table"><thead><tr><th>Club</th><th>Good seasons</th><th>Raise</th><th>Before</th><th>After</th><th>Pressure</th><th>Transfer budget</th></tr></thead><tbody>${rows||'<tr><td colspan="7">No club triggered a major salary reset this offseason.</td></tr>'}</tbody></table></div></section>`;
  }
  if (tab === 'boardroom') {
    return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">BOARDROOM</span><h3>President / owner succession</h3></div><span class="muted">Terms last 4-12 years</span></div><div class="archive-list">${ownerChanges.map((change)=>{const next=ownerById(change.ownerId), former=ownerById(change.formerOwnerId), club=clubById(change.clubId); return `<div class="archive-row"><strong>${teamLink(change.clubId)}</strong><span>${former?esc(former.name):'—'} → ${next?esc(next.name):'New president'}${next?.profile==='billionaire'?` · ${money(club?.ownerAnnualInjection||0)}/yr injection`:''}</span><b>${next?staffRarityBadge(next.rarity):''}</b></div>`;}).join('')||'<div class="empty-state compact">No board changes this offseason.</div>'}</div></section>`;
  }
  return `${head}<div class="stats-ribbon">${statCard('Retirements',data.retirements.length,`${retiredPlayers.length} players · ${retiredCoaches.length} coaches`)}${statCard('New stars',data.newStars.length,'Rookie intake')}${statCard('Transfers',data.transfers.length,'Opening market')}${statCard('Payroll resets',payrollChanges.length,'Dynasty wage pressure')}</div><div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">BIGGEST SIGNINGS</span><h3>Offseason headlines</h3></div><a href="#/offseason/signings">Full signings</a></div>${transferList(transfers.slice(0,12),true)}</section><section class="panel"><div class="panel-head"><div><span class="eyebrow">LIFECYCLE</span><h3>Arrivals and departures</h3></div><a href="#/offseason/lifecycle">Full lifecycle</a></div><p class="role-copy">${newcomers.length} elite/new tracked players entered the world while ${retiredPlayers.length} players and ${retiredCoaches.length} coaches retired.</p><div class="squad-list">${rowPlayers(newcomers.slice(0,8),'new')}</div></section></div>`;
}


const notFound = () => '<div class="not-found"><div>404</div><h1>That part of the football world does not exist yet.</h1><a class="primary-button" href="#/world">Return to world</a></div>';

function searchOverlay() {
  return searchOpen ? `<div class="search-overlay" data-action="close-search"><div class="search-panel" data-action="noop"><div class="search-head"><div><span class="eyebrow">UNIVERSE SEARCH</span><h2>Find clubs, players and nations</h2></div><button class="close-button" data-action="close-search">×</button></div><input id="global-search" class="search-input" type="search" placeholder="Type a player, club or country…"><div id="search-results" class="search-results"><div class="empty-state compact">Start typing.</div></div></div></div>` : '';
}

function page(currentRoute) {
  if (currentRoute.page === 'world') return worldPage();
  if (currentRoute.page === 'magazine') return magazinePage(currentRoute.id);
  if (currentRoute.page === 'competitions') return competitionsHubPage();
  if (currentRoute.page === 'clubs') return clubsHubPage();
  if (currentRoute.page === 'rankings') return rankingsHubPage(currentRoute.id);
  if (currentRoute.page === 'region') return regionPage(currentRoute.id);
  if (currentRoute.page === 'country') return countryPage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'international') return internationalPage(currentRoute.id);
  if (['league', 'competition'].includes(currentRoute.page)) {
    const description = descriptor(currentRoute.id);
    return description ? competitionPage(description, currentRoute.tab, currentRoute.sub) : notFound();
  }
  if (currentRoute.page === 'awards') return awardsPage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'postseason') return postseasonPage(currentRoute.id || 'setup');
  if (currentRoute.page === 'transfers') return transfersPage(currentRoute.id);
  if (currentRoute.page === 'offseason') return offseasonPage(currentRoute.id || 'summary');
  if (currentRoute.page === 'people') return peoplePage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'players') return peoplePage('players', currentRoute.id);
  if (currentRoute.page === 'player') return playerPage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'coach') return coachPage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'owner') return ownerPage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'club') return clubPage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'nation') return nationPage(currentRoute.id);
  if (currentRoute.page === 'almanac') return almanacPage(currentRoute.id);
  return notFound();
}

function mobileBottomNav(currentRoute) {
  const items = [
    ['#/world','World','◎',currentRoute.page === 'world'],
    ['#/magazine/results','Magazine','▤',currentRoute.page === 'magazine'],
    ['#/competitions','Competitions','◆',['competitions','league','competition','country','region'].includes(currentRoute.page)],
    ['#/clubs','Clubs','⬡',['clubs','club'].includes(currentRoute.page)],
    ['#/people/players/overview','People','●',['people','players','player','coach','owner'].includes(currentRoute.page)]
  ];
  return `<nav class="mobile-bottom-nav" aria-label="Primary mobile navigation">${items.map(([href,label,symbol,active]) => `<a href="${href}" class="${active ? 'active' : ''}"><b>${symbol}</b><span>${label}</span></a>`).join('')}<button data-action="toggle-menu"><b>☰</b><span>More</span></button></nav>`;
}

function render() {
  const currentRoute = route();
  const sidebarScroll = document.getElementById('sidebar-nav')?.scrollTop || 0;
  document.getElementById('app').innerHTML = `<a class="skip-link" href="#main-content">Skip to content</a><div class="app-shell">${sidebar(currentRoute)}<button class="sidebar-scrim" id="sidebar-scrim" data-action="close-menu" aria-label="Close navigation"></button><div class="main-shell">${topbar()}<main id="main-content" tabindex="-1" class="content page-enter">${navigationTrail(currentRoute)}${page(currentRoute)}</main>${mobileBottomNav(currentRoute)}</div></div>${searchOverlay()}${clubModal()}${postseasonMatchModal()}<div id="toast-root" role="status" aria-live="polite"></div>`;
  const sidebarElement = document.getElementById('sidebar-nav');
  if (sidebarElement) sidebarElement.scrollTop = sidebarScroll;
  bind();
}

function navigationTrail(currentRoute) {
  const { page, id } = currentRoute;
  const contexts = {
    club: ['Clubs', '#/clubs', clubById(id)?.name],
    player: ['Players', '#/people/players/overview', playerById(id)?.name],
    coach: ['Coaches', '#/people/coaches/overview', coachById(id)?.name],
    owner: ['Presidents', '#/people/presidents/overview', ownerById(id)?.name],
    nation: ['International', '#/international/overview', nationalById(id)?.name],
    league: ['Competitions', '#/competitions', state.current.leagues[id]?.name],
    competition: ['Competitions', '#/competitions', competitionLabel(id)]
  };
  const context = contexts[page];
  if (!context?.[2]) return '';
  return `<nav class="navigation-trail" aria-label="Breadcrumb"><a href="#/world">World</a><span aria-hidden="true">/</span><a href="${context[1]}">${esc(context[0])}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(context[2])}</span></nav>`;
}

function toast(message, type = 'normal') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  root.innerHTML = `<div class="toast ${type}">${esc(message)}</div>`;
  setTimeout(() => { root.innerHTML = ''; }, 2600);
}

async function simulate(action) {
  const start = performance.now();
  if (action === 'simulate-week') simulateNextWeek(state);
  if (action === 'simulate-month') simulateWeeks(state, 4);
  if (action === 'simulate-season') simulateToSeasonEnd(state);
  if (action === 'next-season') startNextSeason(state);
  await saveState();
  hallCache = { signature: '', data: null };
  if (action === 'next-season') {
    window.location.hash = '#/offseason';
  } else if (state.current.completed && state.current.postseason?.prepared && !state.current.postseason?.completed) {
    const unresolved = (state.current.postseason.showcaseMatches || []).some((match) => !match.resolved);
    state.current.postseason.phase = unresolved ? 'games' : 'awards';
    window.location.hash = unresolved ? '#/postseason/games' : '#/postseason/awards';
  }
  render();
  toast(action === 'next-season' ? `${state.current.seasonLabel} offseason complete. Review retirements, arrivals and the market.` : action === 'simulate-season' && state.current.postseason?.prepared ? `Season background simulation complete. Showcase results are embargoed until you play them.` : `World advanced in ${Math.round(performance.now() - start)} ms.`);
}


function postseasonRouteTarget() {
  if (!state.current.completed || !state.current.postseason?.prepared) return '#/postseason/setup';
  const unresolved = (state.current.postseason.showcaseMatches || []).some((match) => !match.resolved);
  return unresolved ? '#/postseason/games' : '#/postseason/awards';
}

function clearPostseasonMatchTimer() {
  if (postseasonTimer) clearTimeout(postseasonTimer);
  postseasonTimer = null;
  postseasonAnimating = false;
}

function activePostseasonMatch() {
  return (state.current.postseason?.showcaseMatches || []).find((row) => row.id === postseasonMatchModalId) || null;
}

function syncPostseasonLiveProgress(match) {
  if (!match) return;
  match.liveProgress = {
    timelineIndex: postseasonTickIndex,
    pauseReason: postseasonPauseReason,
    penaltyIndex: postseasonPenaltyIndex
  };
}

function postseasonMinuteDelay(hasGoal = false) {
  if (hasGoal) return postseasonPlaybackSpeed === 2 ? 650 : 1150;
  return postseasonPlaybackSpeed === 2 ? 145 : 285;
}

async function completeWatchedPostseasonMatch(match, mode = 'watched-continuous') {
  if (!match) return;
  clearPostseasonMatchTimer();
  const timeline = (match.liveTimeline && match.liveTimeline.length) ? match.liveTimeline : (match.ticks || []);
  postseasonTickIndex = Math.max(0, timeline.length - 1);
  postseasonPenaltyIndex = (match.penaltySequence || []).length;
  postseasonPauseReason = 'complete';
  match.resolved = true;
  match.resolutionMode = mode;
  syncPostseasonLiveProgress(match);
  const remaining = (state.current.postseason.showcaseMatches || []).some((row) => !row.resolved);
  if (!remaining) state.current.postseason.phase = 'awards';
  await saveState();
  render();
}

function runPostseasonContinuousMatch() {
  const match = activePostseasonMatch();
  if (!match || match.resolved || postseasonAnimating) return;
  const timeline = (match.liveTimeline && match.liveTimeline.length) ? match.liveTimeline : (match.ticks || []);
  if (!timeline.length) return;
  const finalIndex = timeline.length - 1;
  postseasonPauseReason = null;
  postseasonAnimating = true;
  syncPostseasonLiveProgress(match);
  render();

  const step = async () => {
    if (!postseasonMatchModalId || postseasonMatchModalId !== match.id) {
      clearPostseasonMatchTimer();
      return;
    }
    postseasonTickIndex = Math.min(finalIndex, postseasonTickIndex + 1);
    const tick = timeline[postseasonTickIndex] || timeline[finalIndex];
    syncPostseasonLiveProgress(match);
    render();

    const minute = Number(tick?.minute || 0);
    const hasGoal = Boolean((tick?.minuteEvents || []).some((event) => event.type === 'goal'));
    if (minute === 45) {
      clearPostseasonMatchTimer();
      postseasonPauseReason = 'half';
      syncPostseasonLiveProgress(match);
      await saveState();
      render();
      return;
    }
    if (minute === 90) {
      if (match.extraTime || match.penalties) {
        clearPostseasonMatchTimer();
        postseasonPauseReason = 'regulation';
        syncPostseasonLiveProgress(match);
        await saveState();
        render();
        return;
      }
      await completeWatchedPostseasonMatch(match);
      return;
    }
    if (minute === 105) {
      clearPostseasonMatchTimer();
      postseasonPauseReason = 'extra-half';
      syncPostseasonLiveProgress(match);
      await saveState();
      render();
      return;
    }
    if (minute === 120) {
      if (match.penalties) {
        clearPostseasonMatchTimer();
        postseasonPauseReason = 'penalties';
        syncPostseasonLiveProgress(match);
        await saveState();
        render();
        return;
      }
      await completeWatchedPostseasonMatch(match);
      return;
    }
    if (postseasonTickIndex >= finalIndex) {
      await completeWatchedPostseasonMatch(match);
      return;
    }
    postseasonTimer = setTimeout(step, postseasonMinuteDelay(hasGoal));
  };
  postseasonTimer = setTimeout(step, postseasonMinuteDelay(false));
}

function runPostseasonPenaltyShootout() {
  const match = activePostseasonMatch();
  if (!match || match.resolved || postseasonAnimating || !match.penalties) return;
  const sequence = match.penaltySequence || [];
  if (!sequence.length) {
    completeWatchedPostseasonMatch(match);
    return;
  }
  postseasonPauseReason = 'penalty-live';
  postseasonAnimating = true;
  syncPostseasonLiveProgress(match);
  render();
  const step = async () => {
    if (!postseasonMatchModalId || postseasonMatchModalId !== match.id) {
      clearPostseasonMatchTimer();
      return;
    }
    postseasonPenaltyIndex = Math.min(sequence.length, postseasonPenaltyIndex + 1);
    syncPostseasonLiveProgress(match);
    render();
    if (postseasonPenaltyIndex >= sequence.length) {
      postseasonTimer = setTimeout(() => completeWatchedPostseasonMatch(match), postseasonPlaybackSpeed === 2 ? 500 : 900);
      return;
    }
    postseasonTimer = setTimeout(step, postseasonPlaybackSpeed === 2 ? 320 : 650);
  };
  postseasonTimer = setTimeout(step, postseasonPlaybackSpeed === 2 ? 260 : 520);
}

async function quickPostseasonMatch() {
  const match = activePostseasonMatch();
  if (!match) return;
  clearPostseasonMatchTimer();
  await completeWatchedPostseasonMatch(match, 'quick');
}

function clearPostseasonAwardTimer() {
  postseasonAwardTimers.forEach((timer) => clearTimeout(timer));
  postseasonAwardTimers = [];
  postseasonAwardAnimating = false;
}

function revealNextPostseasonAward() {
  if (postseasonAwardAnimating) return;
  const postseason = state.current.postseason;
  const awards = postseason?.awards || [];
  if (!awards.length) return;
  postseason.awardActiveIndex = Math.max(0, Math.min(Number.isInteger(postseason.awardActiveIndex) ? postseason.awardActiveIndex : 0, awards.length - 1));
  const award = awards[postseason.awardActiveIndex];
  if (!award || (award.revealStage || 0) >= 3) return;
  award.revealStage = 0;
  postseasonAwardAnimating = true;
  render();
  const stages = [1, 2, 3];
  const delays = [180, 920, 1800];
  postseasonAwardTimers = stages.map((stage, stageIndex) => setTimeout(async () => {
    award.revealStage = stage;
    if (stage === 3) {
      postseasonAwardAnimating = false;
      postseasonAwardTimers = [];
      await saveState();
    }
    render();
  }, delays[stageIndex]));
}

async function advancePostseasonAward() {
  if (postseasonAwardAnimating) return;
  const postseason = state.current.postseason;
  const awards = postseason?.awards || [];
  if (!awards.length) return;
  const current = Math.max(0, Math.min(Number.isInteger(postseason.awardActiveIndex) ? postseason.awardActiveIndex : 0, awards.length - 1));
  if ((awards[current]?.revealStage || 0) < 3) return;
  postseason.awardActiveIndex = Math.min(awards.length - 1, current + 1);
  await saveState();
  render();
}

async function selectPostseasonAward(index) {
  if (postseasonAwardAnimating) return;
  const awards = state.current.postseason?.awards || [];
  if (!awards.length) return;
  const next = Math.max(0, Math.min(Number(index) || 0, awards.length - 1));
  state.current.postseason.awardActiveIndex = next;
  await saveState();
  render();
}

async function revealAllPostseasonAwards() {
  clearPostseasonAwardTimer();
  for (const award of state.current.postseason?.awards || []) award.revealStage = 3;
  await saveState();
  render();
}

async function finishPostseason() {
  clearPostseasonMatchTimer();
  clearPostseasonAwardTimer();
  if (state.current.postseason) state.current.postseason.completed = true;
  startNextSeason(state);
  await saveState();
  hallCache = { signature: '', data: null };
  window.location.hash = '#/offseason';
  render();
}

const CLOUD_CHUNK_CHARACTERS = 600000;

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encodeCloudState(gameState) {
  const json = JSON.stringify(gameState);
  if ('CompressionStream' in window) {
    const compressed = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
    return { format: 'gzip-base64-v1', payload: bytesToBase64(bytes), originalBytes: json.length, compressedBytes: bytes.length };
  }
  const bytes = new TextEncoder().encode(json);
  return { format: 'json-base64-v1', payload: bytesToBase64(bytes), originalBytes: bytes.length, compressedBytes: bytes.length };
}

async function decodeCloudState(gameData) {
  if (gameData?.format === 'gzip-base64-v1') {
    if (!('DecompressionStream' in window)) throw new Error('This browser cannot decompress the cloud save.');
    const bytes = base64ToBytes(gameData.payload);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  if (gameData?.format === 'json-base64-v1') {
    return JSON.parse(new TextDecoder().decode(base64ToBytes(gameData.payload)));
  }
  if (gameData?.format === 'json-v1') return gameData.payload;
  return gameData;
}

function generateCloudCode() {
  const suffix = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `fw-main-${suffix}`;
}

function ensureCloudCode(create = false) {
  let code = localStorage.getItem(CLOUD_CODE_KEY) || '';
  if (!code) {
    const suggested = create ? generateCloudCode() : '';
    code = window.prompt('Enter your private Football World cloud code. Use the same code on every device.', suggested) || '';
    code = code.trim();
    if (code.length >= 12) localStorage.setItem(CLOUD_CODE_KEY, code);
  }
  return code.length >= 12 ? code : '';
}

async function cloudSave() {
  const code = ensureCloudCode(true);
  if (!code) return toast('Cloud save cancelled.', 'error');
  cloudStatus = 'Preparing cloud save…';
  render();
  try {
    await saveState();
    const packed = await encodeCloudState(state);
    const chunks = [];
    for (let index = 0; index < packed.payload.length; index += CLOUD_CHUNK_CHARACTERS) {
      chunks.push(packed.payload.slice(index, index + CLOUD_CHUNK_CHARACTERS));
    }
    const uploadId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let finalResult = null;
    for (let index = 0; index < chunks.length; index += 1) {
      cloudStatus = `Saving to Neon… ${index + 1}/${chunks.length}`;
      render();
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveKey: code,
          saveName: 'Main Universe',
          currentSeason: state.season,
          uploadId,
          chunkIndex: index,
          totalChunks: chunks.length,
          chunk: chunks[index],
          format: packed.format,
          originalBytes: packed.originalBytes,
          compressedBytes: packed.compressedBytes
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || `Cloud save failed on part ${index + 1}.`);
      finalResult = result;
    }
    cloudStatus = `Cloud saved ${new Date(finalResult.save.updated_at).toLocaleString()}`;
    render();
    toast(`Universe saved to Neon in ${chunks.length} part${chunks.length === 1 ? '' : 's'}.`, 'success');
  } catch (error) {
    console.error(error);
    cloudStatus = 'Cloud save failed';
    render();
    toast(error.message || 'Cloud save failed.', 'error');
  }
}

async function cloudLoad() {
  const code = ensureCloudCode(false);
  if (!code) return toast('Enter a cloud code first.', 'error');
  if (!window.confirm('Replace the local universe on this device with the cloud save?')) return;
  cloudStatus = 'Loading from Neon…';
  render();
  try {
    const response = await fetch(`/api/load?saveKey=${encodeURIComponent(code)}`);
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Cloud load failed.');
    let gameData = result.save.game_data;
    if (result.save.chunked) {
      const totalChunks = Number(gameData.totalChunks);
      if (!Number.isInteger(totalChunks) || totalChunks < 1) throw new Error('The cloud save metadata is incomplete.');
      const chunks = [];
      for (let index = 0; index < totalChunks; index += 1) {
        cloudStatus = `Loading from Neon… ${index + 1}/${totalChunks}`;
        render();
        const chunkResponse = await fetch(`/api/load?saveKey=${encodeURIComponent(code)}&chunk=${index}`);
        const chunkResult = await chunkResponse.json();
        if (!chunkResponse.ok || !chunkResult.ok) throw new Error(chunkResult.error || `Cloud load failed on part ${index + 1}.`);
        chunks.push(chunkResult.chunk);
      }
      gameData = { format: gameData.format, payload: chunks.join('') };
    }
    const loaded = await decodeCloudState(gameData);
    if (loaded?.version !== 4) throw new Error('The cloud save is not compatible with this version.');
    state = upgradeWorld(loaded);
    hallCache = { signature: '', data: null };
    await saveState();
    cloudStatus = `Cloud loaded ${new Date(result.save.updated_at).toLocaleString()}`;
    location.hash = '#/world';
    render();
    toast('Cloud universe loaded.', 'success');
  } catch (error) {
    console.error(error);
    cloudStatus = 'Cloud load failed';
    render();
    toast(error.message || 'Cloud load failed.', 'error');
  }
}

function manageCloudCode() {
  const current = localStorage.getItem(CLOUD_CODE_KEY) || generateCloudCode();
  const code = window.prompt('Your private cloud code. Copy this exact code to another device, or replace it to connect a different save.', current);
  if (code === null) return;
  const clean = code.trim();
  if (clean.length < 12) return toast('Cloud code must be at least 12 characters.', 'error');
  localStorage.setItem(CLOUD_CODE_KEY, clean);
  cloudStatus = 'Cloud code ready';
  render();
  toast('Cloud code stored on this device.');
}

function bind() {
  document.querySelectorAll('[data-face-image]').forEach((image) => image.addEventListener('error', () => {
    image.style.display = 'none';
    image.closest('.anime-avatar')?.classList.add('avatar-missing');
  }));
  document.querySelectorAll('[data-flag-image]').forEach((image) => image.addEventListener('error', () => { image.style.display = 'none'; }));
  document.querySelectorAll('[data-club-logo]').forEach((image) => image.addEventListener('error', () => {
    const remaining = String(image.dataset.logoAlts || '').split('|').filter(Boolean);
    const next = remaining.shift();
    if (next) {
      image.dataset.logoAlts = remaining.join('|');
      image.src = next;
      return;
    }
    image.style.display = 'none';
    image.closest('.crest')?.classList.remove('crest-with-logo');
  }));
  const globalSearch = document.getElementById('global-search');
  if (globalSearch) { setTimeout(() => globalSearch.focus(), 20); globalSearch.addEventListener('input', (event) => searchResults(event.target.value)); }
  const playerSearchInput = document.getElementById('player-search');
  if (playerSearchInput) {
    const applyPlayerSearch = () => { playerSearch = playerSearchInput.value; render(); };
    playerSearchInput.addEventListener('change', applyPlayerSearch);
    playerSearchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') applyPlayerSearch(); });
  }
  const position = document.getElementById('player-position-filter');
  if (position) position.addEventListener('change', (event) => { playerPositionFilter = event.target.value; render(); });
  const playerCompetition = document.getElementById('player-stats-competition');
  if (playerCompetition) playerCompetition.addEventListener('change', (event) => { playerStatsCompetition = event.target.value; render(); });
  const scope = document.getElementById('player-stats-scope');
  if (scope) scope.addEventListener('change', (event) => { playerStatsScope = event.target.value; render(); });
  const sort = document.getElementById('player-stats-sort');
  if (sort) sort.addEventListener('change', (event) => { playerStatsSort = event.target.value; render(); });
  const competitionPosition = document.getElementById('competition-stats-position');
  if (competitionPosition) competitionPosition.addEventListener('change', (event) => { competitionStatsPosition = event.target.value; render(); });
  const competitionSort = document.getElementById('competition-stats-sort');
  if (competitionSort) competitionSort.addEventListener('change', (event) => { competitionStatsSort = event.target.value; render(); });
  const competitionCoachSort = document.getElementById('competition-coach-stats-sort');
  if (competitionCoachSort) competitionCoachSort.addEventListener('change', (event) => { competitionCoachStatsSort = event.target.value; render(); });
  const competitionTeamSort = document.getElementById('competition-team-stats-sort');
  if (competitionTeamSort) competitionTeamSort.addEventListener('change', (event) => { competitionTeamStatsSort = event.target.value; render(); });
  const coachCompetition = document.getElementById('coach-stats-competition');
  if (coachCompetition) coachCompetition.addEventListener('change', (event) => { coachStatsCompetition = event.target.value; render(); });
  const coachScope = document.getElementById('coach-stats-scope');
  if (coachScope) coachScope.addEventListener('change', (event) => { coachStatsScope = event.target.value; render(); });
  const coachSort = document.getElementById('coach-stats-sort');
  if (coachSort) coachSort.addEventListener('change', (event) => { coachStatsSort = event.target.value; render(); });
  const peopleOriginRegion = document.getElementById('people-origin-region-filter');
  if (peopleOriginRegion) peopleOriginRegion.addEventListener('change', (event) => { peopleOriginRegionFilter = event.target.value; render(); });
  const peopleTeamRegion = document.getElementById('people-team-region-filter');
  if (peopleTeamRegion) peopleTeamRegion.addEventListener('change', (event) => { peopleTeamRegionFilter = event.target.value; render(); });
  const almanacRegion = document.getElementById('almanac-region-filter');
  if (almanacRegion) almanacRegion.addEventListener('change', (event) => { almanacRegionFilter = event.target.value; render(); });
  const almanacTeam = document.getElementById('almanac-team-sort');
  if (almanacTeam) almanacTeam.addEventListener('change', (event) => { almanacTeamSort = event.target.value; render(); });
  const almanacPlayer = document.getElementById('almanac-player-sort');
  if (almanacPlayer) almanacPlayer.addEventListener('change', (event) => { almanacPlayerSort = event.target.value; render(); });
  const almanacCoach = document.getElementById('almanac-coach-sort');
  if (almanacCoach) almanacCoach.addEventListener('change', (event) => { almanacCoachSort = event.target.value; render(); });
  const rankingCompetition = document.getElementById('magazine-ranking-competition');
  if (rankingCompetition) rankingCompetition.addEventListener('change', (event) => { magazineRankingCompetition = event.target.value; render(); });
  const rankingMetric = document.getElementById('magazine-ranking-metric');
  if (rankingMetric) rankingMetric.addEventListener('change', (event) => { magazineRankingMetric = event.target.value; render(); });
  const comparatorTypeSelect = document.getElementById('comparator-type');
  if (comparatorTypeSelect) comparatorTypeSelect.addEventListener('change', (event) => { comparatorType = event.target.value; comparatorIds = []; render(); });
  const comparatorAdd = document.getElementById('comparator-add');
  if (comparatorAdd) comparatorAdd.addEventListener('change', (event) => { if (event.target.value && comparatorIds.length < 3 && !comparatorIds.includes(event.target.value)) comparatorIds.push(event.target.value); render(); });
  const leagueRegion = document.getElementById('league-region-filter');
  if (leagueRegion) leagueRegion.addEventListener('change', (event) => { leagueRegionFilter = event.target.value; render(); });
  const clubRegion = document.getElementById('club-region-filter');
  if (clubRegion) clubRegion.addEventListener('change', (event) => { clubRegionFilter = event.target.value; clubCountryFilter = 'ALL'; render(); });
  const clubCountry = document.getElementById('club-country-filter');
  if (clubCountry) clubCountry.addEventListener('change', (event) => { clubCountryFilter = event.target.value; render(); });
  const clubSearchInput = document.getElementById('club-search');
  if (clubSearchInput) { const apply=()=>{clubSearch=clubSearchInput.value;render();}; clubSearchInput.addEventListener('change',apply); clubSearchInput.addEventListener('keydown',(event)=>{if(event.key==='Enter')apply();}); }
}

function searchResults(query) {
  const root = document.getElementById('search-results');
  if (!root) return;
  const term = query.trim().toLowerCase();
  if (term.length < 2) {
    root.innerHTML = '<div class="empty-state compact">Type at least two characters.</div>';
    return;
  }
  const clubs = state.clubs.filter((club) => club.name.toLowerCase().includes(term)).slice(0, 8);
  const players = state.players.filter((player) => player.name.toLowerCase().includes(term)).slice(0, 12);
  const coaches = (state.coaches || []).filter((coach) => coach.name.toLowerCase().includes(term)).slice(0, 10);
  const nations = NATIONAL_TEAMS.filter((team) => team.name.toLowerCase().includes(term)).slice(0, 8);
  root.innerHTML = `${clubs.length ? `<div class="search-group"><span>CLUBS</span>${clubs.map((club) => `<a href="#/club/${club.id}/overview">${crest(club.id, 'sm')}<div><strong>${esc(club.name)}</strong><small>${esc(club.country)} · ${esc(club.city)}</small></div></a>`).join('')}</div>` : ''}${players.length ? `<div class="search-group"><span>PLAYERS</span>${players.map((player) => `<a href="#/player/${player.id}/overview">${playerPortrait(player, 'sm')}<div><strong>${esc(player.name)}</strong><small>${flag(player.nationality, 'xs')} ${player.clubId ? esc(clubById(player.clubId)?.name) : 'National pool'} · ${player.position} ${player.rating} · ${STAR_RARITIES[player.rarity].label}</small></div></a>`).join('')}</div>` : ''}${coaches.length ? `<div class="search-group"><span>COACHES</span>${coaches.map((coach) => `<a href="#/coach/${coach.id}">${coachPortrait(coach, 'sm')}<div><strong>${esc(coach.name)}</strong><small>${flag(coach.nationality, 'xs')} ${STAFF_RARITIES[coach.rarity].label} · ${esc(COACH_PROFILES[coach.profile]?.label || coach.profileLabel)} · ${esc(COACH_FOCUSES[coach.focus]?.label || 'Balanced')} · ${coach.clubId ? esc(clubById(coach.clubId)?.name) : coach.nationalTeamId ? esc(nationalById(coach.nationalTeamId)?.name) : 'Free agent'}</small></div></a>`).join('')}</div>` : ''}${nations.length ? `<div class="search-group"><span>NATIONAL TEAMS</span>${nations.map((nation) => `<a href="#/nation/${nation.id}">${flag(nation.id)}<div><strong>${esc(nation.name)}</strong><small>${esc(nation.region)} · Tier ${nation.tier}</small></div></a>`).join('')}</div>` : ''}`;
}

document.addEventListener('click', async (event) => {
  if (event.target.closest?.('.skip-link')) {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
    return;
  }
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (['simulate-week', 'simulate-month', 'simulate-season', 'next-season'].includes(action)) await simulate(action);
  if (action === 'open-postseason') {
    window.location.hash = postseasonRouteTarget();
  }
  if (action === 'showcase-select') {
    const competitionId = target.dataset.competitionId;
    const mode = target.dataset.mode || 'none';
    state.current.postseason ||= { selections: {}, prepared: false, phase: 'setup', showcaseMatches: [], awards: [], awardActiveIndex: 0, completed: false };
    state.showcasePreferences ||= {};
    state.showcasePreferences[competitionId] = mode;
    state.current.postseason.selections ||= {};
    state.current.postseason.selections[competitionId] = mode;
    await saveState();
    render();
  }
  if (action === 'open-postseason-match') {
    clearPostseasonMatchTimer();
    postseasonMatchModalId = target.dataset.matchId;
    const match = activePostseasonMatch();
    const timeline = (match?.liveTimeline && match.liveTimeline.length) ? match.liveTimeline : (match?.ticks || []);
    const progress = match?.liveProgress || {};
    postseasonTickIndex = match?.resolved ? Math.max(0, timeline.length - 1) : Math.max(0, Number(progress.timelineIndex || 0));
    postseasonPauseReason = match?.resolved ? 'complete' : (progress.pauseReason || null);
    postseasonPenaltyIndex = match?.resolved ? (match?.penaltySequence || []).length : Math.max(0, Number(progress.penaltyIndex || 0));
    render();
  }
  if (action === 'close-postseason-match') {
    if (!postseasonAnimating) {
      const match = activePostseasonMatch();
      syncPostseasonLiveProgress(match);
      await saveState();
      clearPostseasonMatchTimer();
      postseasonMatchModalId = null;
      postseasonTickIndex = 0;
      postseasonPauseReason = null;
      postseasonPenaltyIndex = 0;
      render();
    }
  }
  if (action === 'watch-postseason-match' || action === 'continue-postseason-match') runPostseasonContinuousMatch();
  if (action === 'continue-postseason-penalties') runPostseasonPenaltyShootout();
  if (action === 'quick-postseason-match') await quickPostseasonMatch();
  if (action === 'postseason-speed') {
    postseasonPlaybackSpeed = Number(target.dataset.speed) === 2 ? 2 : 1;
    render();
  }
  if (action === 'postseason-to-awards') {
    state.current.postseason.phase = 'awards';
    await saveState();
    window.location.hash = '#/postseason/awards';
  }
  if (action === 'reveal-next-award') revealNextPostseasonAward();
  if (action === 'advance-postseason-award') await advancePostseasonAward();
  if (action === 'select-postseason-award') await selectPostseasonAward(target.dataset.awardIndex);
  if (action === 'reveal-all-awards') await revealAllPostseasonAwards();
  if (action === 'finish-postseason') await finishPostseason();
  if (action === 'toggle-menu') {
    const sidebarElement = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebar-scrim');
    const open = !sidebarElement?.classList.contains('open');
    sidebarElement?.classList.toggle('open', open);
    scrim?.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    document.querySelectorAll('[data-action="toggle-menu"]').forEach((button) => button.setAttribute('aria-expanded', String(open)));
  }
  if (action === 'close-menu') {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-scrim')?.classList.remove('open');
    document.querySelectorAll('[data-action="toggle-menu"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    document.body.classList.remove('nav-open');
  }
  if (action === 'toggle-search') { searchOpen = !searchOpen; render(); }
  if (action === 'close-search') { searchOpen = false; render(); }
  if (action === 'open-club-modal') { event.preventDefault(); clubModalId = target.dataset.id; searchOpen = false; render(); }
  if (action === 'close-club-modal') { clubModalId = null; render(); }
  if (action === 'remove-comparison') { comparatorIds = comparatorIds.filter((id) => id !== target.dataset.id); render(); }
  if (action === 'toggle-favorite') {
    const type=target.dataset.type,id=target.dataset.id;
    const key=type==='club'?'favoriteClubIds':type==='player'?'favoritePlayerIds':type==='coach'?'favoriteCoachIds':type==='nation'?'favoriteNationIds':'favoriteCompetitionIds';
    state.preferences[key] ||= [];
    if(state.preferences[key].includes(id)) state.preferences[key]=state.preferences[key].filter((item)=>item!==id); else state.preferences[key].push(id);
    await saveState(); render();
  }
  if (action === 'cloud-save') await cloudSave();
  if (action === 'cloud-load') await cloudLoad();
  if (action === 'cloud-code') manageCloudCode();
  if (action === 'reset-world' && window.confirm('Reset the entire universe and erase its local history? Your existing Neon cloud save is not deleted.')) {
    state = createWorld(Date.now() % 2147483647);
    hallCache = { signature: '', data: null };
    await saveState();
    location.hash = '#/world';
    render();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !document.body.classList.contains('nav-open')) return;
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-scrim')?.classList.remove('open');
  document.body.classList.remove('nav-open');
  document.querySelectorAll('[data-action="toggle-menu"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  document.querySelectorAll('.menu-button').forEach((button) => button.focus());
});

window.addEventListener('hashchange', () => {
  document.body.classList.remove('nav-open');
  searchOpen = false;
  clubModalId = null;
  if (!String(location.hash).includes('/postseason/')) {
    clearPostseasonMatchTimer();
    postseasonMatchModalId = null;
    postseasonTickIndex = 0;
    postseasonPauseReason = null;
    postseasonPenaltyIndex = 0;
    clearPostseasonAwardTimer();
  }
  render();
  window.scrollTo(0, 0);
});

window.addEventListener('DOMContentLoaded', async () => {
  state = await loadState();
  render();
});
