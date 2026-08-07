import {
  SAVE_KEY,
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
  INTERNATIONAL_COMPETITION_CATALOG
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
  upgradeWorld
} from './engine.js';

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
let hallCache = { signature: '', data: null };

const DB_NAME = 'football-world-chronicle-v4';
const DB_STORE = 'worlds';
const DB_KEY = 'expanded-world-v4';
const CLOUD_CODE_KEY = 'football-world-cloud-code-v1';
const TABS = ['overview', 'weekly', 'current', 'history', 'stats'];
const PLAYER_TABS = ['overview', 'statistics'];
const PLAYER_PAGE_TABS = ['profile', 'statistics', 'honours'];
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
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
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
  return `<span class="crest crest-${size}" style="${style}">${esc(initials)}</span>`;
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
  if (isInternational) {
    return `<a class="entity-link" href="#/nation/${esc(id)}">${flag(id)}<span>${esc(name)}</span></a>`;
  }
  return `<button class="entity-link entity-button" data-action="open-club-modal" data-id="${esc(id)}">${crest(id, 'sm')}<span>${esc(name)}</span></button>`;
}

function playerLink(id, withFlag = true) {
  const player = playerById(id);
  if (!player) return '<span class="muted">Unnamed</span>';
  return `<a class="player-link" href="#/player/${esc(id)}/profile">${withFlag ? flag(player.nationality, 'xs') : ''}<span>${esc(player.name)}</span></a>`;
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
  return `<a href="${href}" class="nav-link ${child ? 'nav-child' : ''} ${active ? 'active' : ''}">${icon(iconName)}<span>${esc(label)}</span></a>`;
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
  const otherCountries = LEAGUE_DEFINITIONS.map((league) => league.country).filter((country) => !PRIORITY_COUNTRIES.includes(country));
  return `<aside class="sidebar" id="sidebar">
    <div class="brand-block"><div class="brand-mark">FW</div><div><div class="brand-title">Football World</div><div class="brand-subtitle">Chronicle</div></div><button class="sidebar-close" data-action="close-menu" aria-label="Close navigation">×</button></div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">World</div>
      ${navLink('#/world', 'World', 'world', currentRoute.page === 'world')}
      ${navLink('#/magazine/results', 'Magazine', 'archive', currentRoute.page === 'magazine')}
      ${navLink('#/awards/current', 'Annual Awards', 'awards', currentRoute.page === 'awards')}
      ${navLink('#/transfers', 'Transfer Market', 'transfer', currentRoute.page === 'transfers')}
      ${internationalNav(currentRoute)}
      ${REGION_ORDER.map((region) => navLink(`#/region/${encodeURIComponent(region)}`, region, 'region', currentRoute.page === 'region' && decodeURIComponent(currentRoute.id || '') === region)).join('')}
      <details class="country-nav" ${currentRoute.page === 'competition' && state.current.globalClubCompetitions?.[currentRoute.id] ? 'open' : ''}>
        <summary><span class="nav-globe">◎</span><b>Global clubs</b><i>›</i></summary>
        ${Object.values(state.current.globalClubCompetitions || {}).map((competition) => navLink(`#/competition/${competition.id}/overview`, competition.name, 'trophy', currentRoute.page === 'competition' && currentRoute.id === competition.id, true)).join('')}
      </details>
      <details class="country-nav" ${currentRoute.page === 'competition' && state.current.continentalCompetitions?.[currentRoute.id] ? 'open' : ''}>
        <summary><span class="nav-globe">◆</span><b>Continental clubs</b><i>›</i></summary>
        ${CONTINENTAL_DEFINITIONS.map((competition) => navLink(`#/competition/${competition.id}/overview`, competition.name, 'trophy', currentRoute.page === 'competition' && currentRoute.id === competition.id, true)).join('')}
      </details>
      <div class="nav-section-label">People & archive</div>
      ${navLink('#/people/players/overview', 'People', 'players', ['people', 'players', 'player', 'coach'].includes(currentRoute.page))}
      ${navLink('#/almanac/champions', 'Almanac', 'archive', currentRoute.page === 'almanac')}
      <div class="nav-section-label">Priority countries</div>
      ${PRIORITY_COUNTRIES.map((country) => countryNav(country, currentRoute)).join('')}
      <details class="country-nav other-nav" ${currentRoute.page === 'country' && otherCountries.includes(decodeURIComponent(currentRoute.id || '')) ? 'open' : ''}>
        <summary><span class="nav-globe">🌍</span><b>Other</b><i>›</i></summary>
        ${otherCountries.map((country) => navLink(`#/country/${encodeURIComponent(country)}`, country, 'other', currentRoute.page === 'country' && decodeURIComponent(currentRoute.id || '') === country, true)).join('')}
      </details>
    </nav>
    <div class="sidebar-foot">
      <div class="cloud-button-grid">
        <button class="ghost-button" data-action="cloud-save">${icon('save')} Save cloud</button>
        <button class="ghost-button" data-action="cloud-load">${icon('load')} Load cloud</button>
      </div>
      <button class="ghost-button full cloud-code-button" data-action="cloud-code">${icon('cloud')} Cloud code</button>
      <button class="ghost-button full reset-button" data-action="reset-world">${icon('reset')} Reset universe</button>
      <div class="save-note">${esc(cloudStatus)}</div>
    </div>
  </aside>`;
}

function topbar() {
  return `<header class="topbar">
    <a class="mobile-home-button" href="#/world" aria-label="Go to world home">${icon('home')}<span>Home</span></a>
    <button class="menu-button" data-action="toggle-menu" aria-label="Open navigation">${icon('menu')}<span>Menu</span></button>
    <div class="date-block"><div class="date-kicker">${esc(state.current.seasonLabel)} · Week ${state.current.week}</div><div class="date-main">${dateLabel(state.current.date)}</div></div>
    <div class="sim-controls">
      ${state.current.completed
        ? `<span class="season-complete-chip">Season archived</span><button class="primary-button" data-action="next-season">Start ${getSeasonLabel(state.season + 1)}</button>`
        : `<button class="control-button" data-action="simulate-week"><span>+1</span> Week</button><button class="control-button" data-action="simulate-month"><span>+4</span> Weeks</button><button class="primary-button" data-action="simulate-season">To Season End</button>`}
    </div>
    <button class="cloud-save-top" data-action="cloud-save">${icon('cloud')}<span>Save</span></button>
    <button class="search-button" data-action="toggle-search">${icon('search')}<span>Search</span></button>
  </header>`;
}

const pageHead = (kicker, title, copy = '') => `<div class="page-head"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1>${copy ? `<p>${esc(copy)}</p>` : ''}</div></div>`;
const statCard = (label, value, note = '') => `<div class="stat-card"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div>${note ? `<div class="stat-note">${note}</div>` : ''}</div>`;

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
  const labels = { overview: 'Overview', weekly: 'Weekly View', current: 'Current Year', history: 'History', stats: 'Stats' };
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
  const winners = review.competitionWinners || [];
  const ballon = playerById(review.ballonDorPlayerId);
  const goldenBoot = playerById(review.goldenBootPlayerId);
  return `<section class="panel season-summary section-gap"><div class="panel-head"><div><span class="eyebrow">SEASON SUMMARY</span><h3>${esc(review.seasonLabel)} at a glance</h3></div><span class="panel-chip">Archived</span></div><div class="season-summary-grid">${winners.map((winner) => `<div class="season-summary-row"><span>${esc(winner.competitionName)}</span>${teamLink(winner.winnerId, winner.isInternational)}</div>`).join('')}</div><div class="season-award-strip"><div><span>BALLON D'OR</span>${ballon ? playerLink(ballon.id) : '<strong>—</strong>'}</div><div><span>WORLD GOLDEN BOOT</span>${goldenBoot ? playerLink(goldenBoot.id) : '<strong>—</strong>'}</div></div></section>`;
}

function worldPage() {
  const active = state.players.filter((player) => player.status === 'active').length;
  const rarities = getRarityCounts(state);
  const transferCount = state.current.transfers?.length || 0;
  const internationalNames = Object.values(state.current.internationalCompetitions || {}).map((competition) => competition.name).join(', ');
  return `${pageHead('THE UNIVERSE', 'World football', 'A persistent football history beginning in 2001, with 137 domestic systems, promotion and relegation, continental and global club tournaments, international football and evolving staff and player careers.')}
    <section class="hero-panel">
      <div class="hero-copy"><span class="hero-pill">${NATIONAL_TEAMS.length} NATIONAL TEAMS · ${LEAGUE_DEFINITIONS.filter((league) => league.tier === 'detailed').length} FULL LEAGUES · ${LEAGUE_DEFINITIONS.filter((league) => league.tier === 'summary').length} SUMMARY LEAGUES</span><h2>One connected football world, from a weekly league match to the Ballon d'Or.</h2><p>${esc(internationalNames)} run beside domestic and continental football. Current-season match detail is archived into compact permanent statistics every summer.</p><div class="season-progress"><div class="season-progress-fill" style="width:${Math.min(100, Math.round(state.current.week / 52 * 100))}%"></div></div><div class="progress-label"><span>Opening market</span><strong>Week ${state.current.week} of 52</strong><span>Season archive</span></div></div>
      <div class="hero-metrics">${statCard('Clubs', fmt(state.clubs.length), 'Visible football organizations')}${statCard('Active stars', fmt(active), 'Named career players')}${statCard('International teams', fmt(NATIONAL_TEAMS.length), 'Six confederations')}${statCard('Transfers', fmt(transferCount), 'This opening market')}</div>
    </section>${latestSeasonSummary()}
    <div class="rarity-ribbon section-gap">
      ${['generational', 'legend', 'epic', 'rare', 'uncommon', 'common'].map((rarity) => `<div>${rarityBadge(rarity)}<strong>${fmt(rarities[rarity] || 0)}</strong></div>`).join('')}
    </div>
    <div class="region-grid section-gap">${REGION_ORDER.map((region) => {
      const leagues = LEAGUE_DEFINITIONS.filter((league) => league.confederation === region);
      const nations = NATIONAL_TEAMS.filter((team) => team.region === region).length;
      return `<a class="region-card" href="${leagues.length ? `#/region/${encodeURIComponent(region)}` : '#/international'}"><span>◈</span><div><h3>${esc(region)}</h3><p>${leagues.length} domestic systems · ${nations} national teams</p></div><b>›</b></a>`;
    }).join('')}</div>
    <div class="two-column section-gap">
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">WORLD FOOTBALL MAGAZINE</span><h3><a href="#/magazine/results">Latest stories</a></h3></div><span class="panel-chip">Week ${state.current.week}</span></div><div class="story-list">${state.current.news.slice(0, 8).map((story, index) => `<article class="story-card ${story.importance} ${index === 0 ? 'lead' : ''}"><div class="story-category">${esc(story.category)}</div><h4>${esc(story.headline)}</h4><p>${esc(story.body)}</p>${story.entityType === 'player' && story.entityId ? `<a href="#/player/${esc(story.entityId)}/profile">Open player →</a>` : ''}</article>`).join('')}</div></section>
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
      return `<a class="competition-country-card" href="#/competition/${competition.id}/overview"><div class="competition-icon">◆</div><div><span>CONTINENTAL LEVEL ${competition.level}</span><h3>${esc(competition.name)}</h3><p>${current?.championId ? `${esc(clubById(current.championId)?.name)} are champions` : current?.stage || 'Season ready'}</p></div><b>›</b></a>`;
    }).join('')}</div>` : ''}
    <div class="world-grid section-gap">${leagues.map((league) => {
      const table = getLeagueTable(state, league.id);
      return `<a class="world-card" href="#/country/${encodeURIComponent(league.country)}"><div class="world-card-head">${flag(league.country, 'md')}<span class="tier-chip ${league.tier}">${league.tier === 'detailed' ? 'full pyramid' : 'summary'}</span></div><h3>${esc(league.country)}</h3><p>${esc(league.name)} · ${league.activeCount} top-flight clubs${league.reserveCount ? ` + ${league.reserveCount} promotion clubs` : ''}</p><div class="world-card-stats"><div><strong>${table[0]?.points || 0}</strong><span>LEADER POINTS</span></div><div><strong>${league.clubs.length}</strong><span>VISIBLE CLUBS</span></div></div></a>`;
    }).join('')}</div>`;
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
  const head = `${pageHead(`${countryMeta(country)?.region || 'WORLD'} · COUNTRY`, country, `${league.tier === 'detailed' ? `Full ${league.activeCount}-club league with promotion and relegation` : `Condensed national system with ${clubs.length} visible leading clubs`}.`)}<div class="country-title-flag">${flag(country, 'lg')}</div>${tabs}`;
  if (tab === 'teams') return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">CLUB DIRECTORY</span><h3>${clubs.length} visible clubs</h3></div></div><div class="club-directory">${clubs.map((club) => `<button class="club-directory-card" data-action="open-club-modal" data-id="${club.id}">${crest(club.id)}<div><strong>${esc(club.name)}</strong><span>${club.division === 1 ? 'Top division' : 'Promotion pool'} · ${esc(club.city)} · Rating ${club.strength} · ${money(club.finances)}</span></div><b>›</b></button>`).join('')}</div></section>`;
  if (tab === 'history') {
    const ids = new Set([league.id, `CUP-${league.id}`, ...(superCup ? [superCup.id] : []), ...(country === 'Spain' ? ['SUPERCUP'] : [])]);
    const rows = [...(state.history.champions || [])].filter((item) => ids.has(item.competitionId)).sort((a,b)=>b.season-a.season || a.competitionName.localeCompare(b.competitionName));
    return `${head}<section class="panel"><div class="panel-head"><div><span class="eyebrow">NATIONAL ARCHIVE</span><h3>Titles year by year</h3></div><span class="muted">League, cup and super cup</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Season</th><th>Competition</th><th>Winner</th><th>Runner-up</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${esc(row.seasonLabel)}</strong></td><td>${esc(row.competitionName)}</td><td>${teamLink(row.winnerId)}</td><td>${row.runnerUpId?teamLink(row.runnerUpId):'—'}</td></tr>`).join('')||'<tr><td colspan="4">No completed national competitions yet.</td></tr>'}</tbody></table></div></section>`;
  }
  const competitionCards = [
    `<a class="competition-country-card" href="#/league/${league.id}/overview"><div class="competition-icon">◆</div><div><span>LEAGUE</span><h3>${esc(league.name)}</h3><p>${table[0] ? `${esc(clubById(table[0].teamId)?.name)} lead on ${table[0].points} points` : 'Season ready'}</p></div><b>›</b></a>`,
    `<a class="competition-country-card" href="#/competition/CUP-${league.id}/overview"><div class="competition-icon">✦</div><div><span>DOMESTIC CUP</span><h3>${esc(league.cupName)}</h3><p>${cup.championId ? `${esc(clubById(cup.championId)?.name)} are champions` : cup.stage}</p></div><b>›</b></a>`,
    superCup ? `<a class="competition-country-card" href="#/competition/${superCup.id}/overview"><div class="competition-icon">★</div><div><span>SUPER CUP</span><h3>${esc(superCup.name)}</h3><p>${superCup.championId?`${esc(clubById(superCup.championId)?.name)} are champions`:superCup.stage}</p></div><b>›</b></a>` : ''
  ].join('');
  return `${head}<div class="country-competition-grid">${competitionCards}</div><div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">CURRENT LEAGUE</span><h3>${esc(league.name)}</h3></div><span class="panel-chip">${league.tier === 'summary' ? 'Resolved near season end' : `${league.activeCount} clubs`}</span></div><div class="mini-table">${table.slice(0, 6).map((row,index)=>`<div class="mini-table-row"><span class="rank ${index<4?'qualify':''}">${index+1}</span>${teamLink(row.teamId)}<strong>${row.points}</strong><small>${row.gd>=0?'+':''}${row.gd}</small></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">DOMESTIC SNAPSHOT</span><h3>Competitions</h3></div></div><div class="country-status-list"><div><span>${esc(league.name)}</span><strong>${table[0]?`${esc(clubById(table[0].teamId)?.name)} lead`:'Ready'}</strong></div><div><span>${esc(league.cupName)}</span><strong>${esc(cup.stage||'Ready')}</strong></div>${superCup?`<div><span>${esc(superCup.name)}</span><strong>${esc(superCup.stage||'Ready')}</strong></div>`:''}</div></section></div>`;
}

function internationalPage(tabRaw = 'overview') {
  const tab = tabRaw === 'competitions' ? 'competitions' : 'overview';
  const tabsHtml = `<nav class="competition-tabs"><a href="#/international/overview" class="${tab === 'overview' ? 'active' : ''}">Overview & Nations</a><a href="#/international/competitions" class="${tab === 'competitions' ? 'active' : ''}">Competitions</a></nav>`;
  const cycleLabel = state.season % 4 === 1 ? `${state.season + 1} World Cup cycle` : state.season % 4 === 2 ? `${state.season + 1} continental qualifying` : state.season % 4 === 3 ? `${state.season + 1} continental championships` : 'International friendlies';
  if (tab === 'competitions') {
    const cards = INTERNATIONAL_COMPETITION_CATALOG.map((catalog) => {
      const current = state.current.internationalCompetitions?.[catalog.id];
      const champion = [...state.history.champions].reverse().find((row) => row.competitionId === catalog.id);
      const status = current ? `${current.stage}${current.editionYear ? ` · ${current.editionYear}` : ''}` : champion ? `Last winner: ${getEntityName(state, champion.winnerId, true)}` : 'No completed edition yet';
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

function competitionPage(description, tab = 'overview', sub = 'players') {
  const active = TABS.includes(tab) ? tab : 'overview';
  const base = baseFor(description);
  const heading = `${pageHead(description.type === 'league' ? 'DOMESTIC COMPETITION' : description.type.toUpperCase(), description.name, `${description.country} · Active season, annual winners and all-time records.`)}${tabs(base, active)}`;
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
  return [...(state.current.matches || []), ...(state.current.archivedKnockoutMatches || [])].filter((match, index, rows) => match.competitionId === id && rows.findIndex((item) => item.id === match.id) === index);
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
  const matches = competitionMatches(description.id);
  const findMatch = (id) => matches.find((match) => match.id === id);
  const cardsForRound = (round) => {
    if (round.matchIds?.length) return round.matchIds.map((id) => findMatch(id)).filter(Boolean).map((match) => `<div class="bracket-match">${teamLink(match.homeId, match.isInternational)}<strong>${match.homeGoals}-${match.awayGoals}${match.penalties ? ` (${match.penalties.home}-${match.penalties.away}p)` : ''}</strong>${teamLink(match.awayId, match.isInternational)}</div>`).join('');
    if (round.ties?.length) return round.ties.map((tie) => {
      const first = findMatch(tie.firstLeg || tie.finalMatchId);
      const second = findMatch(tie.secondLeg);
      if (first && second) {
        const homeAggregate = first.homeGoals + second.awayGoals;
        const awayAggregate = first.awayGoals + second.homeGoals;
        return `<div class="bracket-match">${teamLink(tie.homeId, description.type === 'international')}<strong>${homeAggregate}-${awayAggregate} agg</strong>${teamLink(tie.awayId, description.type === 'international')}<small>${first.homeGoals}-${first.awayGoals} · ${second.homeGoals}-${second.awayGoals}</small></div>`;
      }
      if (first) return `<div class="bracket-match">${teamLink(first.homeId, first.isInternational)}<strong>${first.homeGoals}-${first.awayGoals}</strong>${teamLink(first.awayId, first.isInternational)}</div>`;
      return `<div class="bracket-match upcoming">${teamLink(tie.homeId, description.type === 'international')}<strong>vs</strong>${teamLink(tie.awayId, description.type === 'international')}</div>`;
    }).join('');
    return '';
  };
  return `<section class="panel bracket-panel"><div class="panel-head"><div><span class="eyebrow">KNOCKOUT PATH</span><h3>Bracket & results</h3></div></div><div class="bracket-scroll"><div class="bracket-grid">${rounds.map((round) => `<div class="bracket-round"><h4>${esc(round.stage || 'Round')}</h4>${cardsForRound(round) || '<div class="empty-state compact">Awaiting draw</div>'}</div>`).join('')}</div></div></section>`;
}

function weeklyView(description, base, rawWeek) {
  const matches = competitionMatches(description.id);
  const playedWeeks = [...new Set(matches.map((match) => match.week))].sort((a, b) => a - b);
  const scheduledWeeks = competitionScheduleWeeks(description);
  const allWeeks = [...new Set([...playedWeeks, ...scheduledWeeks])].sort((a, b) => a - b);
  const suggested = [...allWeeks].reverse().find((item) => item <= state.current.week) || allWeeks.find((item) => item >= state.current.week) || Math.max(1, state.current.week);
  let week = Number(rawWeek || suggested);
  if (!Number.isFinite(week)) week = suggested;
  const weekMatches = matches.filter((match) => match.week === week);
  const fixtures = scheduledFixtures(description, week, weekMatches);
  const index = Math.max(0, allWeeks.indexOf(week));
  const buttons = allWeeks.length ? allWeeks.slice(Math.max(0, index - 5), index + 7) : Array.from({ length: 10 }, (_, i) => i + 1);
  return `${bracketView(description)}<section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">MATCHWEEK NAVIGATION</span><h3>Week ${week}</h3></div><span class="muted">Current-season match detail remains available until the summer archive.</span></div><div class="week-strip">${buttons.map((item) => `<a href="${base}/weekly/${item}" class="${item === week ? 'active' : ''} ${playedWeeks.includes(item) ? 'played' : ''}">${item}</a>`).join('')}</div><div class="matches-list section-gap">${weekMatches.map((match) => matchRow(match)).join('') || (fixtures.length ? fixtures.map((fixture) => `<div class="fixture-row large">${teamLink(fixture.homeId, description.type === 'international')}<span>vs</span>${teamLink(fixture.awayId, description.type === 'international')}</div>`).join('') : scheduledWeeks.includes(week) ? '<div class="empty-state">The draw or qualified teams will be confirmed before this round.</div>' : `<div class="empty-state">No ${esc(description.name)} games are scheduled for this week.</div>`)}</div></section>`;
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

function competitionOverviewSnapshot(description) {
  if (description.type === 'league') {
    const rows = getLeagueTable(state, description.id).slice(0, 3);
    return overviewRankList(rows, (row) => `<div class="overview-rank-main">${teamLink(row.teamId)}<small>${row.played} G · ${row.wins} W · ${row.gf}-${row.ga}</small></div><strong>${row.points} pts</strong>`, 'The table will populate once the season begins.');
  }
  const groups = description.object.groups || [];
  if (groups.length) {
    const rows = groups.flatMap((group) => (group.table || []).map((row) => ({ ...row, groupId: group.id })))
      .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).slice(0, 3);
    return overviewRankList(rows, (row) => `<div class="overview-rank-main">${teamLink(row.teamId, description.type === 'international')}<small>Group ${esc(row.groupId)} · ${row.gf}-${row.ga}</small></div><strong>${row.points} pts</strong>`, 'The group draw has not been played yet.');
  }
  const remaining = description.object.knockout?.active || description.object.active || [];
  const ids = [...new Set(remaining.flatMap((tie) => [tie.homeId, tie.awayId]).filter(Boolean))].slice(0, 3);
  if (description.object.championId) {
    return `<div class="overview-champion"><span>CHAMPION</span>${teamLink(description.object.championId, description.type === 'international')}<small>${description.object.finalistId ? `Runner-up: ${getEntityName(state, description.object.finalistId, description.type === 'international')}` : esc(description.object.stage || '')}</small></div>`;
  }
  return overviewRankList(ids.map((teamId) => ({ teamId })), (row) => `<div class="overview-rank-main">${teamLink(row.teamId, description.type === 'international')}<small>${esc(description.object.stage || 'Current round')}</small></div>`, 'The draw is not available yet.');
}

function overviewAwardCounts(description, category) {
  const map = new Map();
  for (const award of state.history.awards || []) {
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
  for (const champion of state.history.champions.filter((row) => row.competitionId === description.id)) winnerMap.set(champion.winnerId, (winnerMap.get(champion.winnerId) || 0) + 1);
  const winners = [...winnerMap.entries()].map(([teamId, count]) => ({ teamId, count })).sort((a, b) => b.count - a.count).slice(0, 3);
  const currentChampion = description.object.championId;
  if (currentChampion && !state.history.champions.some((row) => row.season === state.season && row.competitionId === description.id)) {
    const existing = winners.find((row) => row.teamId === currentChampion);
    if (existing) existing.count += 1;
    else winners.push({ teamId: currentChampion, count: 1 });
    winners.sort((a, b) => b.count - a.count);
  }
  const playerMetric = (rows, field) => overviewRankList(rows, (row) => `<div class="overview-rank-main">${playerLink(row.playerId)}<small>${playerById(row.playerId)?.position || ''} · ${row.games || 0} games</small></div><strong>${row[field]}</strong>`);
  return `<section class="competition-overview-hero"><div><span class="eyebrow">COMPETITION OVERVIEW</span><h2>${esc(description.name)}</h2><p>Current context and the most important all-time records in one view.</p></div><span class="overview-trophy">◆</span></section>
    <div class="competition-overview-grid section-gap">
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
  const object = description.object;
  const isInternational = description.type === 'international';
  const recap = object.recap ? `<section class="international-recap"><span class="eyebrow">TOURNAMENT RECAP</span><h2>${esc(getEntityName(state, object.championId, isInternational))} win ${esc(description.name)}!</h2><p>${object.recap.mvpId ? `${esc(playerById(object.recap.mvpId)?.name)} was MVP. ` : ''}${object.recap.youngPlayerId ? `${esc(playerById(object.recap.youngPlayerId)?.name)} won best young player. ` : ''}${object.recap.goalkeeperId ? `${esc(playerById(object.recap.goalkeeperId)?.name)} was best goalkeeper. ` : ''}${object.recap.topScorerId ? `${esc(playerById(object.recap.topScorerId)?.name)} scored ${object.recap.topScorerGoals} goals.` : ''}</p></section>` : '';
  return `<section class="competition-hero"><div><span class="eyebrow">${object.editionYear ? `${object.editionYear} EDITION` : 'CURRENT EDITION'}</span><h2>${esc(object.stage || 'Ready')}</h2><p>${object.championId ? `${esc(getEntityName(state, object.championId, isInternational))} are champions.` : object.inactive ? 'This competition is not active in the current international season.' : object.scheduled ? 'This tournament is scheduled for the summer and will populate after qualification is completed.' : `${matches.length} matches completed.`}</p></div><div class="trophy-symbol">◆</div></section>${completedFinalCard(description)}${recap}${bracketView(description)}${groupTables(description)}<div class="leader-grid section-gap">${leaderPanel('Goals', description.id, 'goals')}${leaderPanel('Assists', description.id, 'assists')}${leaderPanel('Goalkeeper clean sheets', description.id, 'cleanSheets', 'GK')}${leaderPanel('Highest average rating', description.id, 'rating')}</div><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">RECENT GAMES</span><h3>${esc(description.name)}</h3></div></div><div class="matches-list">${matches.slice(-18).reverse().map((match) => matchRow(match, true)).join('') || '<div class="empty-state compact">No matches yet.</div>'}</div></section>`;
}

function completedFinalCard(description) {
  if (!description.object?.championId) return '';
  const final = competitionMatchesAll().filter((match)=>match.competitionId===description.id && String(match.stage||'').toLowerCase()==='final').sort((a,b)=>(b.week||0)-(a.week||0))[0];
  const champion = teamLink(description.object.championId, description.type==='international');
  const runner = description.object.finalistId ? teamLink(description.object.finalistId, description.type==='international') : '—';
  return `<section class="competition-final-card"><span class="eyebrow">FINAL RESULT</span><h2>${champion}</h2><p>${final ? `${teamLink(final.homeId, final.isInternational)} <strong>${final.homeGoals}–${final.awayGoals}</strong> ${teamLink(final.awayId, final.isInternational)}` : `${champion} defeated ${runner}`}</p><div class="final-card-meta"><div><span>Champion</span>${champion}</div><div><span>Runner-up</span>${runner}</div>${final?.manOfMatchId?`<div><span>Player of the match</span>${playerLink(final.manOfMatchId)}</div>`:''}</div></section>`;
}

function historyView(description) {
  const champions = state.history.champions.filter((row) => row.competitionId === description.id).sort((a, b) => b.season - a.season);
  const awardFor = (season, category) => state.history.awards.find((row) => row.season === season && row.competitionId === description.id && row.category === category && row.rank === 1);
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
  for (const honour of state.history.honours.filter((row) => row.competitionId === description.id)) {
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
  state.history.champions.filter((row) => row.competitionId === description.id).forEach((champion) => { ensure(champion.winnerId).titles += 1; });
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
  const sorted = aggregate.rows.sort((a, b) => b.titles - a.titles || b.goals - a.goals || b.wins - a.wins);
  const topGoals = [...aggregate.rows].sort((a, b) => b.goals - a.goals)[0];
  const topClean = [...aggregate.rows].sort((a, b) => b.cleanSheets - a.cleanSheets)[0];
  const topTitles = [...aggregate.rows].sort((a, b) => b.titles - a.titles)[0];
  return `${subTabs}<div class="stats-highlight-grid">${statCard('Most team goals', topGoals ? topGoals.goals : 0, topGoals ? getEntityName(state, topGoals.teamId, aggregate.isInternational) : 'No history')}${statCard('Most clean sheets', topClean ? topClean.cleanSheets : 0, topClean ? getEntityName(state, topClean.teamId, aggregate.isInternational) : 'No history')}${statCard('Most titles', topTitles ? topTitles.titles : 0, topTitles ? getEntityName(state, topTitles.teamId, aggregate.isInternational) : 'No history')}</div><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">ALL-TIME TEAM RECORDS</span><h3>${esc(description.name)}</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Team</th><th>Games</th><th>Wins</th><th>Goals</th><th>Clean sheets</th><th>Best points</th><th>Titles</th></tr></thead><tbody>${sorted.map((row, index) => `<tr><td>${index + 1}</td><td>${teamLink(row.teamId, aggregate.isInternational)}</td><td>${row.games}</td><td>${row.wins}</td><td><strong>${row.goals}</strong></td><td>${row.cleanSheets}</td><td>${row.bestPoints || '—'}</td><td><strong>${row.titles}</strong></td></tr>`).join('') || '<tr><td colspan="8">No records yet.</td></tr>'}</tbody></table></div></section>`;
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
  return competition + stage + tableBonus + upsetBonus + Math.max(0, Math.max(home || 60, away || 60) - 68) + (match.homeGoals + match.awayGoals) * 2;
}


const STATIC_RIVALRIES = [
  ['Real Madrid','Atlético Madrid','Madrid derby'], ['Real Madrid','Athletic Club','historic Spanish rivalry'],
  ['Sevilla','Real Betis','Seville derby'], ['Valencia','Villarreal','regional rivalry'],
  ['River Plate','Boca Juniors','Superclásico'], ['Racing Club','Independiente','Avellaneda derby'],
  ['Manchester City','Manchester United','Manchester derby'], ['Liverpool','Everton','Merseyside derby'],
  ['Arsenal','Tottenham Hotspur','North London derby'], ['Liverpool','Manchester United','historic English rivalry'],
  ['Inter Milan','AC Milan','Derby della Madonnina'], ['Roma','Lazio','Derby della Capitale'],
  ['Juventus','Inter Milan','Derby d’Italia'], ['Bayern Munich','Borussia Dortmund','Der Klassiker'],
  ['Paris Saint-Germain','Marseille','Le Classique'], ['Benfica','Porto','O Clássico'],
  ['Celtic','Rangers','Old Firm'], ['Ajax','Feyenoord','De Klassieker'],
  ['Flamengo','Fluminense','Fla–Flu'], ['Palmeiras','Corinthians','Paulista derby'],
  ['Al Ahly','Zamalek','Cairo derby'], ['Galatasaray','Fenerbahçe','Intercontinental derby']
];

function rivalryForMatch(match) {
  if (match.isInternational) return null;
  const home = clubById(match.homeId)?.name;
  const away = clubById(match.awayId)?.name;
  if (!home || !away) return null;
  const pair = STATIC_RIVALRIES.find(([a,b]) => (a === home && b === away) || (a === away && b === home));
  return pair ? pair[2] : null;
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
  for (const h of state.history.honours || []) { const item=map.get(h.playerId); if(item){ const w=fhofCompetitionWeight(h.competitionId,h.isInternational); item.titles++; item.score += 22*w; } }
  for (const a of state.history.awards || []) { if(a.rank!==1) continue; const item=map.get(a.playerId); if(!item) continue; const w=a.competitionId ? fhofCompetitionWeight(a.competitionId,a.isInternational) : (a.category==='ballon_dor'?10:a.category==='golden_boot'?7:6); item.awards++; item.score += w*(a.category==='ballon_dor'?35:18); }
  return [...map.values()].map(x=>({...x,player:playerById(x.id),averageRating:x.ratingApps?x.weightedRating/x.ratingApps:0})).filter(x=>x.player).sort((a,b)=>b.score-a.score);
}

function fhofCoachRankings() {
  const rows=[...(state.history.coachCompetitionSeasons||[]),...Object.values(state.current.coachStats||{})]; const map=new Map();
  for(const row of rows){ const coach=coachById(row.coachId); if(!coach) continue; const w=fhofCompetitionWeight(row.competitionId,row.isInternational); const item=map.get(row.coachId)||{id:row.coachId,games:0,wins:0,gf:0,ga:0,titles:0,score:0}; item.games+=row.games||0;item.wins+=row.wins||0;item.gf+=row.gf||0;item.ga+=row.ga||0;item.titles+=row.titles||0;item.score+=((row.games||0)*.18+(row.wins||0)*1.3+Math.max(0,(row.gf||0)-(row.ga||0))*.18+(row.titles||0)*26)*w;map.set(row.coachId,item); }
  return [...map.values()].map(x=>({...x,coach:coachById(x.id)})).filter(x=>x.coach).sort((a,b)=>b.score-a.score);
}

function buildFhofData() {
  const signature = [state.season, state.current.week, state.history.playerSeasons?.length||0, state.history.coachCompetitionSeasons?.length||0, state.history.clubCompetitionSeasons?.length||0, state.history.champions?.length||0, state.history.awards?.length||0, state.history.honours?.length||0].join(':');
  if (hallCache.signature === signature && hallCache.data) return hallCache.data;
  const players = fhofPlayerRankings();
  const coaches = fhofCoachRankings();
  const clubRowsByTeam = new Map();
  for (const row of state.history.clubCompetitionSeasons || []) { if (!clubRowsByTeam.has(row.teamId)) clubRowsByTeam.set(row.teamId, []); clubRowsByTeam.get(row.teamId).push(row); }
  const titlesByTeam = new Map();
  for (const row of state.history.champions || []) { if (row.isInternational) continue; if (!titlesByTeam.has(row.winnerId)) titlesByTeam.set(row.winnerId, []); titlesByTeam.get(row.winnerId).push(row); }
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
  for (const honour of state.history.champions || []) { if(honour.isInternational)continue;const key=`${honour.winnerId}::${honour.season}`;const item=teamSeasonData.get(key)||{score:0,games:0,wins:0,gf:0,ga:0,titles:0};item.titles++;item.score+=34*fhofCompetitionWeight(honour.competitionId,false);teamSeasonData.set(key,item); }
  const eras=[];
  for(const [key,seasonSet] of coachRowsByEra){const [teamId,coachId]=key.split('::');const ordered=[...seasonSet].sort((a,b)=>a-b);let run=[];const runs=[];for(const season of ordered){if(run.length&&season!==run[run.length-1]+1){runs.push(run);run=[];}run.push(season);}if(run.length)runs.push(run);for(const continuous of runs){if(continuous.length<2)continue;let best=null;for(let i=0;i<continuous.length;i++){for(const length of [2,3]){const seasons=continuous.slice(i,i+length);if(seasons.length!==length)continue;const total={teamId,coachId,start:seasons[0],end:seasons.at(-1),seasons,score:length===3?18:6,games:0,wins:0,titles:0,gf:0,ga:0};for(const season of seasons){const row=teamSeasonData.get(`${teamId}::${season}`);if(!row)continue;for(const f of ['score','games','wins','titles','gf','ga'])total[f]+=row[f]||0;}if(!best||total.score>best.score||total.score===best.score&&total.titles>best.titles)best=total;}}if(best)eras.push(best);}}
  eras.sort((a,b)=>b.score-a.score||b.titles-a.titles||b.wins-a.wins);

  const nationSeason = new Map();
  for(const row of state.history.coachSeasons||[]){if(!row.isInternational)continue;const key=`${row.teamId}::${row.season}`;const item=nationSeason.get(key)||{games:0,wins:0,score:0,titles:0};item.games+=row.games||0;item.wins+=row.wins||0;item.score+=(row.wins||0)*2+(row.games||0)*.25;nationSeason.set(key,item);}
  for(const honour of state.history.champions||[]){if(!honour.isInternational)continue;const key=`${honour.winnerId}::${honour.season}`;const item=nationSeason.get(key)||{games:0,wins:0,score:0,titles:0};item.titles++;item.score+=45*fhofCompetitionWeight(honour.competitionId,true);nationSeason.set(key,item);}
  const nations=[];for(const nation of state.nationalTeams||[]){let best=null;for(let start=Math.max(2001,state.season-8);start<=state.season;start++){const total={nation,start,end:start+3,score:0,titles:0,games:0,wins:0};for(let season=start;season<=start+3;season++){const row=nationSeason.get(`${nation.id}::${season}`);if(!row)continue;for(const f of ['score','titles','games','wins'])total[f]+=row[f]||0;}if((total.titles||total.games>=8)&&(!best||total.score>best.score))best=total;}if(best)nations.push(best);}nations.sort((a,b)=>b.score-a.score);
  hallCache={signature,data:{players,coaches,presidents,eras,nations:nations.slice(0,5)}};
  return hallCache.data;
}


function fhofPage(){
  if(!(state.history.playerSeasons||[]).length) return `${pageHead('FOOTBALL HALL OF FAME','The FHoF','The living canon opens after the first completed season. Competition relevance, peak performance, awards and trophies all shape induction.')}${magazineTabs('fhof')}<div class="empty-state">Complete the first season to populate the Football Hall of Fame.</div>`;
  const hall=buildFhofData(),players=hall.players,coaches=hall.coaches.slice(0,10),presidents=hall.presidents.slice(0,10),eras=hall.eras.slice(0,10),nations=hall.nations;
  const positions=['GK','DF','MF','FW'];
  const playerSections=positions.map(pos=>`<section class="panel"><div class="panel-head"><div><span class="eyebrow">TOP 10 ${pos}</span><h3>${pos==='GK'?'Goalkeepers':pos==='DF'?'Defenders':pos==='MF'?'Midfielders':'Forwards'}</h3></div></div><div class="fhof-list">${players.filter(x=>x.player.position===pos).slice(0,10).map((x,i)=>`<div class="fhof-row"><b>${i+1}</b><div>${playerLink(x.id)}<small>${x.player.clubId?teamLink(x.player.clubId):'Retired / free'} · ${x.games} games · ${x.goals} G · ${x.assists} A · ${x.titles} titles · ${x.awards} awards</small></div><strong>${Math.round(x.score)}</strong></div>`).join('')}</div></section>`).join('');
  return `${pageHead('FOOTBALL HALL OF FAME','The FHoF','A living historical ranking weighted by competition relevance, statistics, ratings, individual awards and team honors.')}${magazineTabs('fhof')}
  <section class="fhof-intro"><span class="eyebrow">LIVING CANON</span><h2>Greatness is measured where it happened.</h2><p>A World Cup final, Champions League run or elite domestic title carries more historical weight than equivalent production in a minor competition. Rankings evolve every season.</p></section>
  <div class="fhof-grid section-gap">${playerSections}</div>
  <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">GREATEST TEAM ERAS</span><h3>Top 10 club teams</h3></div><span class="muted">Two or three consecutive seasons under the same coach</span></div><div class="fhof-list">${eras.map((x,i)=>`<div class="fhof-row"><b>${i+1}</b><div>${teamLink(x.teamId)}<small>${getSeasonLabel(x.start)} to ${getSeasonLabel(x.end)} · ${coachLink(x.coachId)} · ${x.titles} titles · ${x.wins}/${x.games} wins</small></div><strong>${Math.round(x.score)}</strong></div>`).join('')||'<div class="empty-state compact">Team eras require at least two completed seasons under one coach.</div>'}</div></section>
  <div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">COACHES</span><h3>Top 10</h3></div></div><div class="fhof-list">${coaches.map((x,i)=>`<div class="fhof-row"><b>${i+1}</b><div>${coachLink(x.id)}<small>${x.wins}/${x.games} wins · ${x.titles} titles · ${staffRarityBadge(x.coach.rarity)}</small></div><strong>${Math.round(x.score)}</strong></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">PRESIDENTS</span><h3>Top 10</h3></div></div><div class="fhof-list">${presidents.map((x,i)=>`<div class="fhof-row"><b>${i+1}</b><div><strong>${esc(x.owner.name)}</strong><small>${teamLink(x.clubId)} · ${x.titles} titles · ${staffRarityBadge(x.owner.rarity)}</small></div><strong>${Math.round(x.score)}</strong></div>`).join('')}</div></section></div>
  <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">NATIONAL-TEAM CYCLES</span><h3>Top 5</h3></div><span class="muted">Best four-year window spanning two major tournament opportunities</span></div><div class="fhof-list">${nations.map((x,i)=>`<div class="fhof-row"><b>${i+1}</b><div>${teamLink(x.nation.id,true)}<small>${x.start}–${x.end} · ${x.titles} major titles · ${x.wins}/${x.games} wins</small></div><strong>${Math.round(x.score)}</strong></div>`).join('')||'<div class="empty-state compact">National-team cycles appear after major tournaments.</div>'}</div></section>`;
}

function magazineTabs(active) {
  return `<nav class="competition-tabs"><a href="#/magazine/preseason" class="${active === 'preseason' ? 'active' : ''}">Preseason</a><a href="#/magazine/transfers" class="${active === 'transfers' ? 'active' : ''}">Transfers</a><a href="#/magazine/results" class="${active === 'results' ? 'active' : ''}">Results</a><a href="#/magazine/rankings" class="${active === 'rankings' ? 'active' : ''}">Rankings</a><a href="#/magazine/compare" class="${active === 'compare' ? 'active' : ''}">Comparator</a><a href="#/magazine/fhof" class="${active === 'fhof' ? 'active' : ''}">FHoF</a></nav>`;
}


function playerComparisonStats(playerId) {
  const career = getPlayerCareer(state, playerId); const rows=[...(career.seasons||[]),...(career.current||[])];
  const totals=rows.reduce((a,r)=>{a.games+=r.apps||0;a.goals+=r.goals||0;a.assists+=r.assists||0;a.cleanSheets+=r.cleanSheets||0;a.rating+=(r.averageRating||0)*(r.apps||0);return a;},{games:0,goals:0,assists:0,cleanSheets:0,rating:0});
  totals.averageRating=totals.games?totals.rating/totals.games:0;totals.goalRate=totals.games?totals.goals/totals.games:0;
  const honours=state.history.honours.filter((row)=>row.playerId===playerId);totals.titles=honours.length;totals.continental=honours.filter((row)=>['UCL','UEL','UECL','LIB','SUD','CCC','ACL','CAFCL','OCL','CWC','ICUP'].includes(row.competitionId)).length;totals.international=honours.filter((row)=>row.isInternational).length;return totals;
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
  const latestArchivedSeason = Math.max(-Infinity, ...(state.history.champions || []).map((row) => row.season));
  const seasons = new Set([state.season]);
  if (Number.isFinite(latestArchivedSeason)) seasons.add(latestArchivedSeason);
  const entries = [];
  const seen = new Set();
  const add = ({ competitionId, competitionName, winnerId, runnerUpId = null, isInternational = false, season = state.season, seasonLabel = state.current.seasonLabel }) => {
    if (!winnerId) return;
    const key = `${season}:${competitionId}`;
    if (seen.has(key)) return;
    seen.add(key);
    const awards = (state.history.awards || []).filter((award) => award.season === season && award.competitionId === competitionId && award.rank === 1);
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
  for (const champion of state.history.champions || []) if (seasons.has(champion.season)) add(champion);
  for (const league of Object.values(state.current.leagues || {})) if (league.championId) add({ competitionId: league.id, competitionName: league.name, winnerId: league.championId, runnerUpId: [...(league.table || [])].sort((a,b)=>b.points-a.points||b.gd-a.gd)[1]?.teamId, seasonLabel: state.current.seasonLabel });
  for (const cup of Object.values(state.current.domesticCups || {})) if (cup.championId) add({ competitionId: cup.id, competitionName: cup.name, winnerId: cup.championId, runnerUpId: cup.finalistId, seasonLabel: state.current.seasonLabel });
  Object.values(state.current.superCups || {}).filter((competition)=>competition.championId).forEach((competition)=>add({competitionId:competition.id,competitionName:competition.name,winnerId:competition.championId,runnerUpId:competition.finalistId,seasonLabel:state.current.seasonLabel}));
  Object.values(state.current.globalClubCompetitions || {}).filter((competition)=>competition.championId).forEach((competition)=>add({competitionId:competition.id,competitionName:competition.name,winnerId:competition.championId,runnerUpId:competition.finalistId,seasonLabel:state.current.seasonLabel}));
  for (const comp of Object.values(state.current.continentalCompetitions || {})) if (comp.championId) add({ competitionId: comp.id, competitionName: comp.name, winnerId: comp.championId, runnerUpId: comp.finalistId, seasonLabel: state.current.seasonLabel });
  for (const comp of Object.values(state.current.internationalCompetitions || {})) if (comp.championId) add({ competitionId: comp.id, competitionName: comp.name, winnerId: comp.championId, runnerUpId: comp.finalistId, isInternational: true, seasonLabel: state.current.seasonLabel });
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
      .filter((row) => row.club && row.owner)
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
    const starRows = newStars.map(({ player }) => `<tr><td>${playerLink(player.id)}${player.realWorldId ? '<span class="historical-icon-badge compact">Historical icon</span>' : ''}</td><td>${rarityBadge(player.rarity)}</td><td>${flag(player.nationality)} ${esc(countryName(player.nationality))}</td><td>${player.position} · ${esc(player.roleLabel)}</td><td>${player.clubId ? teamLink(player.clubId) : '<span class="free-agent">Free agent</span>'}</td><td>${player.realWorldId ? '<strong>Real</strong>' : '<span class="muted">Procedural</span>'}</td><td><strong>${player.baseQuality}</strong></td></tr>`).join('');
    const coachRows = newCoaches.map(({ coach }) => `<tr><td>${coachLink(coach.id)}</td><td>${staffRarityBadge(coach.rarity)}</td><td>${flag(coach.nationality)} ${esc(countryName(coach.nationality))}</td><td>${esc(COACH_PROFILES[coach.profile]?.label || coach.profileLabel)}</td><td>${esc(COACH_FOCUSES[coach.focus]?.label || 'Balanced')}</td><td><strong>${coach.quality}</strong></td><td>${coachJob(coach)}</td></tr>`).join('');
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
      const awardsA = state.history.awards.filter((award) => award.playerId === a.playerId && award.rank === 1).length;
      const awardsB = state.history.awards.filter((award) => award.playerId === b.playerId && award.rank === 1).length;
      return (STAR_RARITIES[pb?.rarity]?.rank || 0) * 40 + awardsB * 8 + b.fee - ((STAR_RARITIES[pa?.rarity]?.rank || 0) * 40 + awardsA * 8 + a.fee);
    });
    return `${pageHead('WORLD FOOTBALL MAGAZINE', 'Transfer desk', 'The window freezes after preseason, preserving the biggest moves and decorated stars changing clubs.')}${magazineTabs(tab)}<section class="panel"><div class="panel-head"><div><span class="eyebrow">${state.current.week ? 'WINDOW CLOSED' : 'LIVE MARKET'}</span><h3>${state.current.seasonLabel} major moves</h3></div></div>${transferList(transfers.slice(0, 30))}</section>`;
  }
  const completed = recentCompletedCompetitionCards();
  return `${pageHead('WORLD FOOTBALL MAGAZINE', 'Results', 'Recently completed competitions, their champions and the players who defined each campaign.')}${magazineTabs(tab)}<div class="completed-competition-grid">${completed.map((item) => `<article class="completed-competition-card"><div class="completed-card-head"><div><span>${esc(item.region)}</span><h3>${esc(item.competitionName)}</h3><small>${esc(item.seasonLabel)}</small></div><span class="competition-complete-chip">FINAL</span></div><div class="completed-finalists"><div><span>WINNER</span>${teamLink(item.winnerId, item.isInternational)}</div><div><span>RUNNER-UP</span>${item.runnerUpId ? teamLink(item.runnerUpId, item.isInternational) : '<strong>—</strong>'}</div></div><div class="completed-awards"><div><span>MVP</span>${item.mvpId ? playerLink(item.mvpId) : '<strong>—</strong>'}</div><div><span>TOP SCORER</span>${item.topScorerId ? `${playerLink(item.topScorerId)}${Number.isFinite(item.topScorerGoals) ? `<small>${item.topScorerGoals} goals</small>` : ''}` : '<strong>—</strong>'}</div></div></article>`).join('') || '<div class="empty-state">No major competition has finished yet. Completed tournaments will appear here with winner, runner-up, MVP and top scorer.</div>'}</div>`;
}

function competitionMatchesAll() {
  const rows = [...(state.current.matches || []), ...(state.current.archivedKnockoutMatches || [])];
  return rows.filter((match, index) => rows.findIndex((item) => item.id === match.id) === index);
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
  const awards = state.history.awards;
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

function transferList(transfers, compact = false) {
  if (!transfers.length) return '<div class="empty-state compact">No transfers recorded.</div>';
  return `<div class="transfer-list ${compact ? 'compact' : ''}">${transfers.map((transfer) => {
    const player = playerById(transfer.playerId);
    return `<div class="transfer-row"><div class="transfer-player">${player ? `${rarityBadge(player.rarity)}${playerLink(player.id, false)}` : 'Unknown player'}<small>${player ? `${player.position} · ${player.roleLabel}` : ''}</small></div><div class="transfer-route"><span>${transfer.fromClubId ? esc(clubById(transfer.fromClubId)?.name) : 'Free agency'}</span><b>→</b><span>${esc(clubById(transfer.toClubId)?.name)}</span></div><strong>${transfer.freeTransfer ? 'Free' : money(transfer.fee)}</strong></div>`;
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
    return `<div class="transfer-row"><div class="transfer-player">${coach ? `${staffRarityBadge(coach.rarity)}${coachLink(coach.id, false)}` : 'Unknown coach'}<small>${coach ? `${countryName(coach.nationality)} · ${esc(COACH_PROFILES[coach.profile]?.label || coach.profileLabel)} · ${esc(COACH_FOCUSES[coach.focus]?.label || 'Balanced')}` : ''}</small></div><div class="transfer-route"><span>${esc(from || 'Free agency')}</span><b>→</b><span>${esc(to || 'Free agency')}</span></div><strong>${esc(move.reason || 'appointed')}</strong></div>`;
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
  return `${pageHead('PEOPLE', 'Players', 'Every player has a rarity, position, tactical role, contract and pre-generated career path.')}${peopleTabs('players')}${playerTabs(tab)}<section class="panel"><div class="filter-toolbar"><label>Search<input id="player-search" type="search" value="${esc(playerSearch)}" placeholder="Player or club"></label><label>Continent (origin)<select id="people-origin-region-filter">${regionOptions(peopleOriginRegionFilter)}</select></label><label>Continent (team)<select id="people-team-region-filter">${regionOptions(peopleTeamRegionFilter)}</select></label><label>Position<select id="player-position-filter"><option value="ALL">All positions</option>${['GK', 'DF', 'MF', 'FW'].map((position) => `<option value="${position}" ${playerPositionFilter === position ? 'selected' : ''}>${position}</option>`).join('')}</select></label><label>Career<select id="player-career-filter"><option value="ALL">All career years</option><option value="NEW" ${playerCareerFilter === 'NEW' ? 'selected' : ''}>Debuted this season</option>${Array.from({length: 13}, (_, index) => index + 1).map((year) => `<option value="${year}" ${String(playerCareerFilter) === String(year) ? 'selected' : ''}>Career year ${year}</option>`).join('')}</select></label><span>${fmt(filtered.length)} active players</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Player</th><th>Club</th><th>Nation</th><th>Pos</th><th>Role</th><th>Rarity</th><th>Career</th><th>Debut</th><th>Age</th><th>Rating</th><th>Market value</th><th>Contract</th></tr></thead><tbody>${filtered.slice(0, 500).map((player) => `<tr><td>${playerLink(player.id)}</td><td>${player.clubId ? teamLink(player.clubId) : '<span class="free-agent">Free agent</span>'}</td><td>${flag(player.nationality)}</td><td>${player.position}</td><td>${esc(player.roleLabel)}</td><td>${rarityBadge(player.rarity)}</td><td><strong>Y${player.careerYear + 1}</strong></td><td>${player.debutSeason || state.season - player.careerYear}</td><td>${state.season - player.birthYear}</td><td><strong>${player.rating}</strong></td><td><strong>${money(player.marketValue)}</strong></td><td>${player.contractYears ? `${player.contractYears} yr` : 'Free'}</td></tr>`).join('')}</tbody></table></div></section>`;
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
  for (const honour of state.history.honours) {
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
    <section class="panel"><div class="filter-toolbar"><label>Continent (origin)<select id="people-origin-region-filter">${regionOptions(peopleOriginRegionFilter)}</select></label><label>Continent (team)<select id="people-team-region-filter">${regionOptions(peopleTeamRegionFilter)}</select></label><span>${fmt(rows.filter((owner) => owner.clubId).length)} active presidents · ${fmt(rows.length)} historical people retained</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>President</th><th>Nationality</th><th>Rarity</th><th>Quality</th><th>Profile</th><th>Current club</th><th>Years remaining</th></tr></thead><tbody>${rows.slice(0, 250).map((owner, index) => `<tr><td>${index + 1}</td><td><strong>${esc(owner.name)}</strong></td><td>${flag(owner.nationality)}</td><td>${staffRarityBadge(owner.rarity)}</td><td><strong>${owner.quality || '—'}/100</strong></td><td>${esc(OWNER_PROFILES[owner.profile]?.label || owner.profileLabel || '—')}</td><td>${owner.clubId ? teamLink(owner.clubId) : '<span class="muted">Former president</span>'}</td><td>${owner.clubId ? (owner.yearsRemaining ?? '—') : '—'}</td></tr>`).join('')}</tbody></table></div></section>`;
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
  (state.history.honours || []).forEach((row) => { if (row.playerId) ensure(row.playerId).teamHonours += 1; });
  (state.history.awards || []).forEach((row) => { if (row.playerId && (row.rank || 1) === 1) ensure(row.playerId).individualAwards += 1; });
  state.players.forEach((player) => ensure(player.id));
  return [...map.values()].map((row) => ({ ...row, averageRating: row.games ? row.ratingWeighted / row.games : 0, totalHonours: row.teamHonours + row.individualAwards }));
}

function aggregateTeamAlmanac() {
  const map = new Map();
  const ensure = (id, international = false) => { if (!map.has(id)) map.set(id, { teamId: id, international, games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, cleanSheets: 0, domesticTitles: 0, continentalTitles: 0, internationalTitles: 0 }); return map.get(id); };
  (state.history.clubSeasons || []).forEach((row) => { const item = ensure(row.clubId, false); item.games += row.played || 0; item.wins += row.wins || 0; item.draws += row.draws || 0; item.losses += row.losses || 0; item.gf += row.gf || 0; item.ga += row.ga || 0; item.cleanSheets += row.cleanSheets || 0; });
  Object.values(state.current.leagues || {}).forEach((league) => (league.table || []).forEach((row) => { const item = ensure(row.teamId, false); item.games += row.played || 0; item.wins += row.wins || 0; item.draws += row.draws || 0; item.losses += row.losses || 0; item.gf += row.gf || 0; item.ga += row.ga || 0; item.cleanSheets += row.cleanSheets || 0; }));
  (state.history.champions || []).forEach((row) => { const item = ensure(row.winnerId, Boolean(row.isInternational)); if (row.isInternational) item.internationalTitles += 1; else if (CONTINENTAL_DEFINITIONS.some((c) => c.id === row.competitionId)) item.continentalTitles += 1; else item.domesticTitles += 1; });
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

function playerPage(id, tabRaw = 'profile') {
  const player = playerById(id);
  if (!player) return notFound();
  const career = getPlayerCareer(state, id);
  const tab = PLAYER_PAGE_TABS.includes(tabRaw) ? tabRaw : 'profile';
  const base = `#/player/${player.id}`;
  const pageTabs = `<nav class="competition-tabs">${PLAYER_PAGE_TABS.map((item) => `<a href="${base}/${item}" class="${tab === item ? 'active' : ''}">${item === 'profile' ? 'Profile' : item === 'statistics' ? 'Statistics' : 'Honors'}</a>`).join('')}</nav>`;
  const heading = `${pageHead('PLAYER CAREER', player.name, `${countryName(player.nationality)} · ${player.position} · Age ${state.season - player.birthYear}`)}${pageTabs}`;
  if (tab === 'statistics') return `${heading}${playerStatisticsPage(player, career)}`;
  if (tab === 'honours') return `${heading}${playerHonoursPage(player, career)}`;
  const careerLabel = CAREER_TYPES[player.careerType]?.label || player.careerType;
  return `${heading}<section class="entity-hero player-entity"><div class="player-number">${player.position}</div><div class="entity-main"><div class="entity-badges">${rarityBadge(player.rarity)}${flag(player.nationality)}${player.realWorldId ? '<span class="historical-icon-badge">Historical icon</span>' : ''}</div><span class="entity-kicker">${esc(player.roleLabel)}</span><h2>${esc(player.name)}</h2><div class="entity-meta">${player.clubId ? teamLink(player.clubId) : '<span class="free-agent">Free agent</span>'} · ${player.contractYears ? `${player.contractYears} years remaining` : 'Out of contract'}</div></div><div class="rating-orbit"><strong>${player.rating}</strong><span>ABILITY</span></div></section>
    <div class="stats-ribbon section-gap">${statCard('Base quality', player.baseQuality, STAR_RARITIES[player.rarity].label)}${statCard('Market value', money(player.marketValue), `Salary ${money(player.salary)}`)}${statCard('Happiness', player.happiness, player.happiness < 45 ? 'Open to a move' : 'Settled')}${statCard('International', `${career.international.caps} / ${career.international.goals}`, 'Caps / goals')}</div>
    <div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">CAREER MODEL</span><h3>${esc(careerLabel)} · ${esc(player.careerLengthType)} career</h3></div><span class="muted">Year ${player.careerYear + 1} of ${player.careerLength}</span></div><div class="career-curve">${player.careerMultipliers.map((multiple, index) => `<div class="career-year ${index === player.careerYear ? 'current' : ''} ${index < player.careerYear ? 'past' : ''}"><span>Y${index + 1}</span><strong>${multiple.toFixed(2)}</strong><small>${Math.round(player.baseQuality * multiple)}</small></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">TACTICAL ROLE</span><h3>${esc(player.roleLabel)}</h3></div></div><p class="role-copy">Role influences scoring, assists and defensive contributions. ${player.position === 'FW' && player.role === 'winger' ? 'Wingers trade some scoring volume for more assists.' : player.position === 'MF' ? 'Midfield roles shape the balance between creation, scoring and defensive value.' : player.position === 'DF' ? 'Defender roles change clean-sheet impact and attacking output.' : 'Goalkeeper style affects defensive influence.'}</p></section></div>${playerClubTimeline(player, career)}`;
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

function coachPage(id) {
  const coach = coachById(id);
  if (!coach) return notFound();
  const career = getCoachCareer(state, id);
  const currentJobs = aggregateCurrentCoachJobs(career);
  const timeline = [...career.seasons, ...currentJobs].sort((a, b) => b.season - a.season || b.games - a.games);
  const competitionRows = [...career.competitionSeasons, ...(career.currentRows || []).map((row) => ({ season: state.season, seasonLabel: state.current.seasonLabel, ...row }))]
    .sort((a, b) => b.season - a.season || b.games - a.games);
  const totals = career.totals;
  const profile = COACH_PROFILES[coach.profile];
  const winPct = totals.games ? totals.wins / totals.games : 0;
  const focus = COACH_FOCUSES[coach.focus] || COACH_FOCUSES.balanced;
  return `${pageHead('COACH CAREER', coach.name, `${countryName(coach.nationality)} · ${profile?.label || coach.profile} · ${focus.label}`)}
    <section class="entity-hero coach-entity"><div class="player-number">⌁</div><div class="entity-main"><div class="entity-badges">${staffRarityBadge(coach.rarity)}${flag(coach.nationality)}</div><span class="entity-kicker">${esc(profile?.label || coach.profileLabel)}</span><h2>${esc(coach.name)}</h2><div class="entity-meta">${coachJob(coach)}</div></div><div class="rating-orbit"><strong>${coach.quality}</strong><span>QUALITY</span></div></section>
    <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">COACHING CAREER CURVE</span><h3>${esc((coach.careerType || 'stable_prime').replaceAll('_', ' '))}</h3></div><span class="muted">Year ${Math.min((coach.careerYear || 0) + 1, coach.careerLength || 1)} of ${coach.careerLength || '—'}</span></div><div class="career-curve">${(coach.careerMultipliers || []).map((multiple, index) => `<div class="career-year ${index === coach.careerYear ? 'current' : ''} ${index < coach.careerYear ? 'past' : ''}"><span>Y${index + 1}</span><strong>${Number(multiple).toFixed(2)}</strong><small>${Math.round((coach.baseQuality || coach.quality) * multiple)}</small></div>`).join('')}</div></section>
    <div class="stats-ribbon section-gap">${statCard('Games', fmt(totals.games), `${totals.wins} wins`)}${statCard('Win rate', totals.games ? `${(winPct * 100).toFixed(1)}%` : '—', `${totals.draws} draws · ${totals.losses} losses`)}${statCard('Team goals', fmt(totals.gf), `${fmt(totals.ga)} conceded`)}${statCard('Titles', totals.titles, `${coach.seasonsInRole || 0} seasons in current role`)}</div>
    <div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">TACTICAL IDENTITY</span><h3>${esc(profile?.label || coach.profileLabel)}</h3></div></div><p class="role-copy">${esc(profile?.description || 'A flexible football coach.')}</p><div class="staff-effects"><span>Focus: ${esc(focus.label)}</span></div><p class="role-copy">${esc(focus.description)}</p></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">CAREER HONORS</span><h3>${career.honours.length} trophies</h3></div></div>${honoursList(career.honours, 'competitionName')}</section></div>
    <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">CAREER TIMELINE</span><h3>Team coached by season</h3></div><span class="muted">All club and national-team competitions combined</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Season</th><th>Team</th><th>Type</th><th>G</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Win %</th><th>Titles</th></tr></thead><tbody>${timeline.map((row) => `<tr><td><strong>${esc(row.seasonLabel)}</strong></td><td>${teamLink(row.teamId, row.isInternational)}</td><td>${row.isInternational ? 'National team' : 'Club'}</td><td>${row.games}</td><td><strong>${row.wins}</strong></td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.games ? `${(row.wins / row.games * 100).toFixed(1)}%` : '—'}</td><td>${row.titles || 0}</td></tr>`).join('') || '<tr><td colspan="11">No completed coaching season yet.</td></tr>'}</tbody></table></div></section>
    <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">COMPETITION RECORD</span><h3>Season-by-season detail</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Season</th><th>Competition</th><th>Team</th><th>G</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>CS</th><th>Titles</th></tr></thead><tbody>${competitionRows.map((row) => `<tr><td>${esc(row.seasonLabel)}</td><td>${esc(competitionLabel(row.competitionId))}</td><td>${teamLink(row.teamId, row.isInternational)}</td><td>${row.games}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.cleanSheets || 0}</td><td>${row.titles || 0}</td></tr>`).join('') || '<tr><td colspan="11">No competition records yet.</td></tr>'}</tbody></table></div></section>`;
}

function clubBody(club) {
  const history = getClubHistory(state, club.id);
  const table = getLeagueTable(state, club.leagueId);
  const position = table.findIndex((row) => row.teamId === club.id) + 1;
  const tableRow = table.find((row) => row.teamId === club.id);
  const honours = state.history.champions.filter((row) => !row.isInternational && row.winnerId === club.id);
  const owner = ownerById(club.ownerId);
  const coach = coachById(club.coachId);
  const ownerProfile = OWNER_PROFILES[owner?.profile];
  const coachProfile = COACH_PROFILES[coach?.profile];
  return `<div class="club-modal-hero">${crest(club.id, 'xl')}<div><span>${flag(club.country)} ${esc(club.country)} · ${esc(club.city)} · ${club.division === 1 ? 'Top division' : 'Promotion pool'}</span><h2>${esc(club.name)}</h2><p>Strength ${club.strength} · Reputation ${Math.round(club.reputation)} · ${fmt(club.fans)} supporters</p></div></div>
    <div class="club-modal-metrics">${statCard('League position', club.division === 1 ? (position || '—') : 'Second tier', tableRow ? `${tableRow.points} points` : 'Promotion candidate')}${statCard('Finances', money(club.finances), `${money(club.transferBudget)} transfer budget`)}${statCard('Historic titles', honours.length)}${statCard('Current form', tableRow?.form.join(' ') || '—')}</div>
    <div class="staff-grid section-gap">
      <section class="staff-card"><span class="eyebrow">OWNER / PRESIDENT</span><div class="staff-card-head"><div class="staff-avatar">♛</div><div><h3>${esc(owner?.name || 'Vacant')}</h3>${owner ? staffRarityBadge(owner.rarity) : ''}</div></div><strong>${esc(ownerProfile?.label || 'No profile')}</strong><p>${esc(ownerProfile?.description || 'The club is awaiting new ownership.')}</p><div class="staff-effects"><span>Money ×${Number(club.ownerMoneyMultiplier || 1).toFixed(2)}</span><span>Negotiation +${Math.round((club.ownerNegotiationBonus || 0) * 100)}%</span><span>Patience ×${Number(club.ownerPatience || 1).toFixed(2)}</span><span>${owner?.yearsRemaining ?? '—'} years remaining</span></div></section>
      <section class="staff-card"><span class="eyebrow">HEAD COACH</span><div class="staff-card-head"><div class="staff-avatar">⌁</div><div><h3>${coach ? coachLink(coach.id, false) : 'Vacant'}</h3>${coach ? staffRarityBadge(coach.rarity) : ''}</div></div><strong>${esc(coachProfile?.label || 'No tactical identity')}</strong><p>${esc(coachProfile?.description || 'The board is searching for a new coach.')}</p><div class="staff-effects"><span>Quality ${coach?.quality || '—'}</span><span>${coach ? `Focus ${esc(COACH_FOCUSES[coach.focus]?.label || 'Balanced')}` : '—'}</span><span>${coach?.seasonsInRole || 0} seasons in role</span><span>${coach ? `Career Y${Math.min((coach.careerYear || 0) + 1, coach.careerLength || 1)}/${coach.careerLength || '—'}` : '—'}</span><span>${coach?.trophies || 0} trophies</span></div></section>
    </div>
    <div class="two-column section-gap"><section><div class="modal-section-head">KEY PLAYERS</div><div class="squad-list">${history.allCurrentPlayers.map((player) => `<a class="squad-row squad-row-wide" href="#/player/${player.id}/profile"><span>${player.position}</span><div><strong>${esc(player.name)}</strong><small>${rarityBadge(player.rarity)} ${esc(player.roleLabel)} · ${player.contractYears ? `${player.contractYears} yr` : 'Free'}</small></div><b>${player.rating}</b></a>`).join('')}</div></section><section><div class="modal-section-head">TROPHIES</div>${honoursList(honours, 'competitionName')}<div class="modal-section-head recent-head">RECENT SEASONS</div><div class="archive-list">${[...history.seasons].reverse().slice(0, 8).map((season) => `<div class="archive-row"><strong>${season.seasonLabel}</strong><span>${esc(competitionLabel(season.leagueId))}</span><b>${season.position}</b></div>`).join('') || '<div class="empty-state compact">No archived seasons yet.</div>'}</div></section></div>`;
}

function clubModal() {
  if (!clubModalId) return '';
  const club = clubById(clubModalId);
  return club ? `<div class="modal-overlay" data-action="close-club-modal"><div class="club-modal" data-action="noop"><div class="modal-toolbar"><button class="close-button" data-action="close-club-modal">×</button><a class="secondary-button" href="#/club/${club.id}">Open full club page</a></div>${clubBody(club)}</div></div>` : '';
}

function clubPage(id) {
  const club = clubById(id);
  return club ? `${pageHead('CLUB PROFILE', club.name, `${club.country} · ${club.city}`)}<div class="country-title-flag">${flag(club.country, 'lg')}</div><section class="panel">${clubBody(club)}</section>` : notFound();
}

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
  const matches = state.current.matches.filter((match) => match.isInternational && [match.homeId, match.awayId].includes(id));
  const honours = state.history.champions.filter((row) => row.isInternational && row.winnerId === id);
  const coach = coachById(nation.coachId);
  const coachProfile = COACH_PROFILES[coach?.profile];
  return `${pageHead('NATIONAL TEAM', nation.name, `Generation tier ${nation.tier} · Aggregate strength ${nation.strength} · ${pool.length} active named players`)}<section class="nation-hero">${flag(id, 'xl')}<div><span>${esc(nation.region)}</span><h2>${esc(nation.name)}</h2><p>Selected squad: ${lineup.length} named stars · No more than one goalkeeper</p></div><strong>${nation.strength}</strong></section>
    <section class="staff-card section-gap national-coach-card"><span class="eyebrow">NATIONAL COACH</span><div class="staff-card-head"><div class="staff-avatar">⌁</div><div><h3>${coach ? coachLink(coach.id, false) : 'Vacant'}</h3>${coach ? staffRarityBadge(coach.rarity) : ''}</div></div><strong>${esc(coachProfile?.label || 'No tactical identity')}</strong><p>${esc(coachProfile?.description || 'The federation is searching for a coach.')}</p><div class="staff-effects"><span>Quality ${coach?.quality || '—'}</span><span>${coach ? `Focus ${esc(COACH_FOCUSES[coach.focus]?.label || 'Balanced')}` : '—'}</span><span>${coach?.seasonsInRole || 0} seasons in role</span><span>${coach ? `Career Y${Math.min((coach.careerYear || 0) + 1, coach.careerLength || 1)}/${coach.careerLength || '—'}` : '—'}</span><span>${coach?.trophies || 0} trophies</span></div></section>
    <div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">CURRENT SELECTION</span><h3>Best eight</h3></div></div><div class="squad-list">${lineup.map((player) => `<a class="squad-row squad-row-wide" href="#/player/${player.id}/profile"><span>${player.position}</span><div><strong>${esc(player.name)}</strong><small>${rarityBadge(player.rarity)} ${player.clubId ? esc(clubById(player.clubId)?.name) : 'National pool'} · ${esc(player.roleLabel)}</small></div><b>${player.rating}</b></a>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">NATIONAL HONORS</span><h3>${honours.length} trophies</h3></div></div>${honoursList(honours, 'competitionName')}<div class="panel-head recent-head"><div><span class="eyebrow">CURRENT RESULTS</span><h3>International matches</h3></div></div><div class="matches-list">${matches.slice(-12).reverse().map((match) => matchRow(match, true)).join('') || '<div class="empty-state compact">No matches yet.</div>'}</div></section></div>`;
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

function almanacPage(sectionRaw = 'champions') {
  const allowed = ['champions', 'teams'];
  const section = allowed.includes(sectionRaw) ? sectionRaw : 'champions';
  const tabs = `<nav class="competition-tabs"><a href="#/almanac/champions" class="${section === 'champions' ? 'active' : ''}">Champions</a><a href="#/almanac/teams" class="${section === 'teams' ? 'active' : ''}">Teams</a></nav>`;
  const regionControl = `<label>Region<select id="almanac-region-filter">${regionOptions(almanacRegionFilter)}</select></label>`;
  if (section === 'teams') {
    const sorters = { titles:(a,b)=>b.titles-a.titles||b.wins-a.wins, games:(a,b)=>b.games-a.games, wins:(a,b)=>b.wins-a.wins, winPct:(a,b)=>b.winPct-a.winPct||b.games-a.games, goals:(a,b)=>b.gf-a.gf, cleanSheets:(a,b)=>(b.cleanSheets||0)-(a.cleanSheets||0) };
    const rows = aggregateTeamAlmanac().filter((row)=>{ const country=row.international?nationalById(row.teamId)?.name:clubById(row.teamId)?.country; return almanacRegionFilter==='ALL'||COUNTRY_META[country]?.region===almanacRegionFilter; }).sort(sorters[almanacTeamSort]||sorters.titles).slice(0,150);
    const controls=`<div class="filter-toolbar">${regionControl}<label>Rank by<select id="almanac-team-sort">${[['titles','Total honors'],['games','Games'],['wins','Wins'],['winPct','Win percentage'],['goals','Goals scored']].map(([v,l])=>`<option value="${v}" ${almanacTeamSort===v?'selected':''}>${l}</option>`).join('')}</select></label><span>Top 150</span></div>`;
    return `${pageHead('PERMANENT HISTORY', 'Team Almanac', 'Compare club and national-team records across the entire universe.')}${tabs}<section class="panel">${controls}<div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Team</th><th>Region</th><th>Current competition</th><th>Games</th><th>Wins</th><th>Win %</th><th>GF</th><th>GA</th><th>Domestic</th><th>Continental</th><th>International</th><th>Total honors</th></tr></thead><tbody>${rows.map((row,index)=>{const club=row.international?null:clubById(row.teamId);const country=row.international?nationalById(row.teamId)?.name:club?.country;return `<tr><td>${index+1}</td><td>${teamLink(row.teamId,row.international)}</td><td>${esc(COUNTRY_META[country]?.region||'—')}</td><td>${row.international?'International football':esc(competitionLabel(club?.leagueId)||club?.country||'—')}</td><td>${row.games}</td><td><strong>${row.wins}</strong></td><td>${row.games?`${(row.winPct*100).toFixed(1)}%`:'—'}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.domesticTitles}</td><td>${row.continentalTitles}</td><td>${row.internationalTitles}</td><td><strong>${row.titles}</strong></td></tr>`;}).join('')}</tbody></table></div></section>`;
  }
  return `${pageHead('PERMANENT HISTORY','Champions','Every completed competition remains preserved with its winning team and coach.')}${tabs}<section class="almanac-hero"><div><span class="eyebrow">ARCHIVE SCALE</span><h2>${fmt(state.history.playerSeasons.length)} player-season rows</h2><p>${fmt(state.history.clubSeasons.length)} club-season summaries · ${fmt(state.history.awards.length)} award records · ${fmt(state.history.coachSeasons?.length||0)} coach-job seasons</p></div><div class="archive-seal">▤</div></section><section class="panel section-gap"><div class="archive-list">${[...state.history.champions].reverse().slice(0,200).map((champion)=>`<div class="archive-row"><strong>${champion.seasonLabel}</strong><span>${esc(champion.competitionName)}</span><div class="archive-winner-cell">${teamLink(champion.winnerId,champion.isInternational)}${champion.coachId?`<small>Coach: ${coachLink(champion.coachId)}</small>`:''}</div></div>`).join('')||'<div class="empty-state">No archived champions.</div>'}</div></section>`;
}

const notFound = () => '<div class="not-found"><div>404</div><h1>That part of the football world does not exist yet.</h1><a class="primary-button" href="#/world">Return to world</a></div>';

function searchOverlay() {
  return searchOpen ? `<div class="search-overlay" data-action="close-search"><div class="search-panel" data-action="noop"><div class="search-head"><div><span class="eyebrow">UNIVERSE SEARCH</span><h2>Find clubs, players and nations</h2></div><button class="close-button" data-action="close-search">×</button></div><input id="global-search" class="search-input" type="search" placeholder="Type a player, club or country…"><div id="search-results" class="search-results"><div class="empty-state compact">Start typing.</div></div></div></div>` : '';
}

function page(currentRoute) {
  if (currentRoute.page === 'world') return worldPage();
  if (currentRoute.page === 'magazine') return magazinePage(currentRoute.id);
  if (currentRoute.page === 'region') return regionPage(currentRoute.id);
  if (currentRoute.page === 'country') return countryPage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'international') return internationalPage(currentRoute.id);
  if (['league', 'competition'].includes(currentRoute.page)) {
    const description = descriptor(currentRoute.id);
    return description ? competitionPage(description, currentRoute.tab, currentRoute.sub) : notFound();
  }
  if (currentRoute.page === 'awards') return awardsPage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'transfers') return transfersPage(currentRoute.id);
  if (currentRoute.page === 'people') return peoplePage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'players') return peoplePage('players', currentRoute.id);
  if (currentRoute.page === 'player') return playerPage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'coach') return coachPage(currentRoute.id);
  if (currentRoute.page === 'club') return clubPage(currentRoute.id);
  if (currentRoute.page === 'nation') return nationPage(currentRoute.id);
  if (currentRoute.page === 'almanac') return almanacPage(currentRoute.id);
  return notFound();
}

function render() {
  const currentRoute = route();
  document.getElementById('app').innerHTML = `<div class="app-shell">${sidebar(currentRoute)}<button class="sidebar-scrim" id="sidebar-scrim" data-action="close-menu" aria-label="Close navigation"></button><div class="main-shell">${topbar()}<main class="content">${page(currentRoute)}</main></div></div>${searchOverlay()}${clubModal()}<div id="toast-root"></div>`;
  bind();
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
  render();
  toast(action === 'next-season' ? `The ${state.current.seasonLabel} season is ready. The transfer market has run.` : `World advanced in ${Math.round(performance.now() - start)} ms.`);
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
  document.querySelectorAll('[data-flag-image]').forEach((image) => image.addEventListener('error', () => { image.style.display = 'none'; }));
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
  root.innerHTML = `${clubs.length ? `<div class="search-group"><span>CLUBS</span>${clubs.map((club) => `<button data-action="open-club-modal" data-id="${club.id}">${crest(club.id, 'sm')}<div><strong>${esc(club.name)}</strong><small>${esc(club.country)} · ${esc(club.city)}</small></div></button>`).join('')}</div>` : ''}${players.length ? `<div class="search-group"><span>PLAYERS</span>${players.map((player) => `<a href="#/player/${player.id}/profile">${flag(player.nationality)}<div><strong>${esc(player.name)}</strong><small>${player.clubId ? esc(clubById(player.clubId)?.name) : 'National pool'} · ${player.position} ${player.rating} · ${STAR_RARITIES[player.rarity].label}</small></div></a>`).join('')}</div>` : ''}${coaches.length ? `<div class="search-group"><span>COACHES</span>${coaches.map((coach) => `<a href="#/coach/${coach.id}">${flag(coach.nationality)}<div><strong>${esc(coach.name)}</strong><small>${STAFF_RARITIES[coach.rarity].label} · ${esc(COACH_PROFILES[coach.profile]?.label || coach.profileLabel)} · ${esc(COACH_FOCUSES[coach.focus]?.label || 'Balanced')} · ${coach.clubId ? esc(clubById(coach.clubId)?.name) : coach.nationalTeamId ? esc(nationalById(coach.nationalTeamId)?.name) : 'Free agent'}</small></div></a>`).join('')}</div>` : ''}${nations.length ? `<div class="search-group"><span>NATIONAL TEAMS</span>${nations.map((nation) => `<a href="#/nation/${nation.id}">${flag(nation.id)}<div><strong>${esc(nation.name)}</strong><small>${esc(nation.region)} · Tier ${nation.tier}</small></div></a>`).join('')}</div>` : ''}`;
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (['simulate-week', 'simulate-month', 'simulate-season', 'next-season'].includes(action)) await simulate(action);
  if (action === 'toggle-menu') {
    const sidebarElement = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebar-scrim');
    const open = !sidebarElement?.classList.contains('open');
    sidebarElement?.classList.toggle('open', open);
    scrim?.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
  }
  if (action === 'close-menu') {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-scrim')?.classList.remove('open');
    document.body.classList.remove('nav-open');
  }
  if (action === 'toggle-search') { searchOpen = !searchOpen; render(); }
  if (action === 'close-search') { searchOpen = false; render(); }
  if (action === 'open-club-modal') { event.preventDefault(); clubModalId = target.dataset.id; searchOpen = false; render(); }
  if (action === 'close-club-modal') { clubModalId = null; render(); }
  if (action === 'remove-comparison') { comparatorIds = comparatorIds.filter((id) => id !== target.dataset.id); render(); }
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

window.addEventListener('hashchange', () => {
  document.body.classList.remove('nav-open');
  searchOpen = false;
  clubModalId = null;
  render();
  window.scrollTo(0, 0);
});

window.addEventListener('DOMContentLoaded', async () => {
  state = await loadState();
  render();
});
