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
  STAFF_RARITIES
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
  getPlayerTotals
} from './engine.js';

let state = null;
let searchOpen = false;
let clubModalId = null;
let cloudStatus = 'Local autosave ready';
let playerSearch = '';
let playerPositionFilter = 'ALL';
let playerStatsScope = 'club';
let playerStatsSort = 'goals';

const DB_NAME = 'football-world-chronicle-v4';
const DB_STORE = 'worlds';
const DB_KEY = 'expanded-world-v4';
const CLOUD_CODE_KEY = 'football-world-cloud-code-v1';
const TABS = ['weekly', 'current', 'history', 'stats'];
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
    if (saved?.version === 4 && saved.current?.internationalCompetitions && saved.current?.continentalCompetitions) return saved;
  } catch (error) {
    console.warn('IndexedDB load unavailable.', error);
  }
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 4) return parsed;
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
  const emoji = flagEmoji(meta?.iso2, fallback);
  return `<span class="country-flag country-flag-${size}" title="${esc(name)}" role="img" aria-label="${esc(name)} flag"><span class="flag-emoji">${esc(emoji)}</span></span>`;
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
    || (currentRoute.page === 'competition' && currentRoute.id === 'SUPERCUP' && country === 'Spain');
  return `<details class="country-nav" ${active ? 'open' : ''}>
    <summary>${flag(country)}<b>${esc(country)}</b><i>›</i></summary>
    ${navLink(`#/country/${encodeURIComponent(country)}`, 'Overview', 'region', currentRoute.page === 'country' && countryRoute === country, true)}
    ${navLink(`#/league/${league.id}/current`, league.name, 'trophy', currentRoute.page === 'league' && currentRoute.id === league.id, true)}
    ${navLink(`#/competition/${cup}/current`, league.cupName, 'trophy', currentRoute.page === 'competition' && currentRoute.id === cup, true)}
    ${country === 'Spain' ? navLink('#/competition/SUPERCUP/current', 'Spanish Super Cup', 'trophy', currentRoute.page === 'competition' && currentRoute.id === 'SUPERCUP', true) : ''}
  </details>`;
}

function internationalNav(currentRoute) {
  const comps = Object.values(state.current.internationalCompetitions || {});
  const active = currentRoute.page === 'international' || (currentRoute.page === 'competition' && comps.some((comp) => comp.id === currentRoute.id)) || currentRoute.page === 'nation';
  return `<details class="country-nav" ${active ? 'open' : ''}>
    <summary><span class="nav-globe">🌐</span><b>International Football</b><i>›</i></summary>
    ${navLink('#/international', 'Overview & nations', 'intl', currentRoute.page === 'international', true)}
    ${comps.map((comp) => navLink(`#/competition/${comp.id}/current`, comp.name, 'trophy', currentRoute.page === 'competition' && currentRoute.id === comp.id, true)).join('')}
  </details>`;
}

function sidebar(currentRoute) {
  const otherCountries = LEAGUE_DEFINITIONS.map((league) => league.country).filter((country) => !PRIORITY_COUNTRIES.includes(country));
  return `<aside class="sidebar" id="sidebar">
    <div class="brand-block"><div class="brand-mark">FW</div><div><div class="brand-title">Football World</div><div class="brand-subtitle">Chronicle</div></div><button class="sidebar-close" data-action="close-menu" aria-label="Close navigation">×</button></div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">World</div>
      ${navLink('#/world', 'World', 'world', currentRoute.page === 'world')}
      ${navLink('#/awards', 'Annual Awards', 'awards', currentRoute.page === 'awards')}
      ${navLink('#/transfers', 'Transfer Market', 'transfer', currentRoute.page === 'transfers')}
      ${internationalNav(currentRoute)}
      ${REGION_ORDER.map((region) => navLink(`#/region/${encodeURIComponent(region)}`, region, 'region', currentRoute.page === 'region' && decodeURIComponent(currentRoute.id || '') === region)).join('')}
      <details class="country-nav" ${currentRoute.page === 'competition' && state.current.continentalCompetitions?.[currentRoute.id] ? 'open' : ''}>
        <summary><span class="nav-globe">◆</span><b>Continental clubs</b><i>›</i></summary>
        ${CONTINENTAL_DEFINITIONS.map((competition) => navLink(`#/competition/${competition.id}/current`, competition.name, 'trophy', currentRoute.page === 'competition' && currentRoute.id === competition.id, true)).join('')}
      </details>
      <div class="nav-section-label">Priority countries</div>
      ${PRIORITY_COUNTRIES.map((country) => countryNav(country, currentRoute)).join('')}
      <details class="country-nav other-nav" ${currentRoute.page === 'country' && otherCountries.includes(decodeURIComponent(currentRoute.id || '')) ? 'open' : ''}>
        <summary><span class="nav-globe">🌍</span><b>Other</b><i>›</i></summary>
        ${otherCountries.map((country) => navLink(`#/country/${encodeURIComponent(country)}`, country, 'other', currentRoute.page === 'country' && decodeURIComponent(currentRoute.id || '') === country, true)).join('')}
      </details>
      <div class="nav-section-label">Archive</div>
      ${navLink('#/players/overview', 'Players', 'players', ['players', 'player'].includes(currentRoute.page))}
      ${navLink('#/almanac', 'Almanac', 'archive', currentRoute.page === 'almanac')}
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

function tabs(base, active = 'current') {
  const labels = { weekly: 'Weekly View', current: 'Current Year', history: 'History', stats: 'Stats' };
  return `<nav class="competition-tabs">${TABS.map((tab) => `<a href="${base}/${tab}" class="${active === tab ? 'active' : ''}">${labels[tab]}</a>`).join('')}</nav>`;
}

function descriptor(id) {
  if (state.current.leagues[id]) return { id, type: 'league', name: state.current.leagues[id].name, country: state.current.leagues[id].country, object: state.current.leagues[id] };
  if (state.current.domesticCups[id]) return { id, type: 'cup', name: state.current.domesticCups[id].name, country: state.current.domesticCups[id].country, object: state.current.domesticCups[id] };
  if (id === 'SUPERCUP') return { id, type: 'cup', name: state.current.supercup.name, country: 'Spain', object: state.current.supercup };
  if (state.current.continentalCompetitions?.[id]) { const competition = state.current.continentalCompetitions[id]; return { id, type: 'continental', name: competition.name, country: competition.confederation, object: competition }; }
  const international = state.current.internationalCompetitions?.[id];
  if (international) return { id, type: 'international', name: international.name, country: international.confederation, object: international };
  return null;
}

const baseFor = (description) => description.type === 'league' ? `#/league/${description.id}` : `#/competition/${description.id}`;

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
  return `${pageHead('THE UNIVERSE', 'World football', 'A persistent football history beginning in 2001, with 137 domestic systems, promotion and relegation, eleven continental club tournaments, international football and evolving staff and player careers.')}
    <section class="hero-panel">
      <div class="hero-copy"><span class="hero-pill">${NATIONAL_TEAMS.length} NATIONAL TEAMS · ${LEAGUE_DEFINITIONS.filter((league) => league.tier === 'detailed').length} FULL LEAGUES · ${LEAGUE_DEFINITIONS.filter((league) => league.tier === 'summary').length} SUMMARY LEAGUES</span><h2>One connected football world, from a weekly league match to the Ballon d'Or.</h2><p>${esc(internationalNames)} run beside domestic and continental football. Current-season match detail is archived into compact permanent statistics every summer.</p><div class="season-progress"><div class="season-progress-fill" style="width:${Math.min(100, Math.round(state.current.week / 44 * 100))}%"></div></div><div class="progress-label"><span>Opening market</span><strong>Week ${state.current.week} of 44</strong><span>Season archive</span></div></div>
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
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">WORLD FOOTBALL MAGAZINE</span><h3>Latest stories</h3></div><span class="panel-chip">Week ${state.current.week}</span></div><div class="story-list">${state.current.news.slice(0, 8).map((story, index) => `<article class="story-card ${story.importance} ${index === 0 ? 'lead' : ''}"><div class="story-category">${esc(story.category)}</div><h4>${esc(story.headline)}</h4><p>${esc(story.body)}</p>${story.entityType === 'player' && story.entityId ? `<a href="#/player/${esc(story.entityId)}/profile">Open player →</a>` : ''}</article>`).join('')}</div></section>
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
      return `<a class="competition-country-card" href="#/competition/${competition.id}/current"><div class="competition-icon">◆</div><div><span>CONTINENTAL LEVEL ${competition.level}</span><h3>${esc(competition.name)}</h3><p>${current?.championId ? `${esc(clubById(current.championId)?.name)} are champions` : current?.stage || 'Season ready'}</p></div><b>›</b></a>`;
    }).join('')}</div>` : ''}
    <div class="world-grid section-gap">${leagues.map((league) => {
      const table = getLeagueTable(state, league.id);
      return `<a class="world-card" href="#/country/${encodeURIComponent(league.country)}"><div class="world-card-head">${flag(league.country, 'md')}<span class="tier-chip ${league.tier}">${league.tier === 'detailed' ? 'full pyramid' : 'summary'}</span></div><h3>${esc(league.country)}</h3><p>${esc(league.name)} · ${league.activeCount} top-flight clubs${league.reserveCount ? ` + ${league.reserveCount} promotion clubs` : ''}</p><div class="world-card-stats"><div><strong>${table[0]?.points || 0}</strong><span>LEADER POINTS</span></div><div><strong>${league.clubs.length}</strong><span>VISIBLE CLUBS</span></div></div></a>`;
    }).join('')}</div>`;
}

function countryPage(raw) {
  const country = decodeURIComponent(raw || '');
  const league = leagueCountry(country);
  if (!league) return notFound();
  const table = getLeagueTable(state, league.id);
  const cup = state.current.domesticCups[`CUP-${league.id}`];
  const clubs = state.clubs.filter((club) => club.country === country).sort((a, b) => a.division - b.division || b.strength - a.strength);
  const topClubs = clubs.filter((club) => club.division === 1);
  const reserveClubs = clubs.filter((club) => club.division === 2);
  return `${pageHead(`${countryMeta(country)?.region || 'WORLD'} · COUNTRY`, country, `${league.tier === 'detailed' ? `Full ${league.activeCount}-club league with three-up, three-down movement and ${reserveClubs.length} promotion candidates` : `Condensed national system with ${clubs.length} visible leading clubs`}.`)}
    <div class="country-title-flag">${flag(country, 'lg')}</div>
    <div class="country-competition-grid">
      <a class="competition-country-card" href="#/league/${league.id}/current"><div class="competition-icon">◆</div><div><span>LEAGUE</span><h3>${esc(league.name)}</h3><p>${table[0] ? `${esc(clubById(table[0].teamId)?.name)} lead on ${table[0].points} points` : 'Season ready'}</p></div><b>›</b></a>
      <a class="competition-country-card" href="#/competition/CUP-${league.id}/current"><div class="competition-icon">✦</div><div><span>DOMESTIC CUP</span><h3>${esc(league.cupName)}</h3><p>${cup.championId ? `${esc(clubById(cup.championId)?.name)} are champions` : cup.stage}</p></div><b>›</b></a>
      ${country === 'Spain' ? `<a class="competition-country-card" href="#/competition/SUPERCUP/current"><div class="competition-icon">★</div><div><span>SUPER CUP</span><h3>Spanish Super Cup</h3><p>${state.current.supercup.stage}</p></div><b>›</b></a>` : ''}
    </div>
    <div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">CURRENT TABLE</span><h3>${esc(league.name)}</h3></div><span class="panel-chip">${league.tier === 'summary' ? 'Resolved near season end' : `${topClubs.length} clubs`}</span></div><div class="mini-table">${table.slice(0, 10).map((row, index) => `<div class="mini-table-row"><span class="rank ${index < 4 ? 'qualify' : ''}">${index + 1}</span>${teamLink(row.teamId)}<strong>${row.points}</strong><small>${row.gd >= 0 ? '+' : ''}${row.gd}</small></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">GOAL RACE</span><h3>Current leaders</h3></div></div>${leaders(league.id, 'goals')}</section></div>
    <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">CLUB DIRECTORY</span><h3>${clubs.length} visible clubs</h3></div></div><div class="club-directory">${clubs.map((club) => `<button class="club-directory-card" data-action="open-club-modal" data-id="${club.id}">${crest(club.id)}<div><strong>${esc(club.name)}</strong><span>${club.division === 1 ? 'Top division' : 'Promotion pool'} · ${esc(club.city)} · Rating ${club.strength} · ${money(club.finances)}</span></div><b>›</b></button>`).join('')}</div></section>`;
}

function internationalPage() {
  const competitions = Object.values(state.current.internationalCompetitions || {});
  const cycle = state.season % 4 === 1 ? 'World Cup qualifying' : state.season % 4 === 2 ? 'World Cup year' : state.season % 4 === 3 ? 'Continental qualifying' : 'Continental championship year';
  return `${pageHead('INTERNATIONAL FOOTBALL', `${state.season}: ${cycle}`, 'National teams select up to eight named stars, with no more than one goalkeeper. Countries without a deep star pool rely more heavily on their aggregate team strength.')}
    <div class="international-competition-grid">${competitions.map((competition) => `<a class="international-card" href="#/competition/${competition.id}/current"><div><span>${esc(competition.confederation)}</span><h3>${esc(competition.name)}</h3><p>${esc(competition.stage)} · ${competition.groups.reduce((sum, group) => sum + group.teamIds.length, 0)} teams</p></div><b>›</b></a>`).join('')}</div>
    <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">NATIONAL TEAM DIRECTORY</span><h3>${NATIONAL_TEAMS.length} teams</h3></div><span class="muted">Generation tier affects the chance of producing elite players.</span></div><div class="confederation-directory">${REGION_ORDER.map((region) => {
      const teams = NATIONAL_TEAMS.filter((team) => team.region === region).sort((a, b) => b.strength - a.strength);
      return `<details ${region === 'Europe' ? 'open' : ''}><summary><strong>${esc(region)}</strong><span>${teams.length} teams</span></summary><div class="nation-grid">${teams.map((team) => {
        const pool = state.players.filter((player) => player.nationality === team.id && player.status === 'active');
        const best = pool.sort((a, b) => b.rating - a.rating)[0];
        return `<a class="nation-card" href="#/nation/${team.id}">${flag(team.id, 'md')}<div><strong>${esc(team.name)}</strong><span>Tier ${team.tier} · Team ${team.strength}</span><small>${pool.length} stars${best ? ` · Best ${best.rating}` : ''}</small></div></a>`;
      }).join('')}</div></details>`;
    }).join('')}</div></section>`;
}

function competitionPage(description, tab = 'current', sub = 'players') {
  const active = TABS.includes(tab) ? tab : 'current';
  const base = baseFor(description);
  return `${pageHead(description.type === 'league' ? 'DOMESTIC COMPETITION' : description.type.toUpperCase(), description.name, `${description.country} · Active season, annual winners and all-time records.`)}${tabs(base, active)}${active === 'weekly' ? weeklyView(description, base, sub) : active === 'current' ? currentView(description) : active === 'history' ? historyView(description) : statsView(description, base, sub)}`;
}

function competitionMatches(id) {
  return state.current.matches.filter((match) => match.competitionId === id);
}

function weeklyView(description, base, rawWeek) {
  const matches = competitionMatches(description.id);
  const playedWeeks = [...new Set(matches.map((match) => match.week))].sort((a, b) => a - b);
  let week = Number(rawWeek || playedWeeks.at(-1) || Math.max(1, state.current.week));
  if (!Number.isFinite(week)) week = 1;
  const weekMatches = matches.filter((match) => match.week === week);
  let fixtures = [];
  if (description.type === 'league') {
    const round = description.object.rounds[week - 1] || [];
    const seen = new Set(weekMatches.flatMap((match) => [match.homeId, match.awayId]));
    fixtures = round.filter((fixture) => !seen.has(fixture.homeId));
  }
  const start = Math.max(1, week - 4);
  const buttons = Array.from({ length: Math.min(44, week + 5) - start + 1 }, (_, index) => start + index);
  return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">MATCHWEEK NAVIGATION</span><h3>Week ${week}</h3></div><span class="muted">Match detail remains until season close.</span></div><div class="week-strip">${buttons.map((item) => `<a href="${base}/weekly/${item}" class="${item === week ? 'active' : ''} ${playedWeeks.includes(item) ? 'played' : ''}">${item}</a>`).join('')}</div><div class="matches-list section-gap">${weekMatches.map((match) => matchRow(match)).join('') || (fixtures.length ? fixtures.map((fixture) => `<div class="fixture-row large">${teamLink(fixture.homeId)}<span>vs</span>${teamLink(fixture.awayId)}</div>`).join('') : `<div class="empty-state">No ${esc(description.name)} games stored for this week.</div>`)}</div></section>`;
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
  return `<div class="group-grid">${groups.map((group) => `<section class="panel"><div class="panel-head"><div><span class="eyebrow">GROUP ${esc(group.id)}</span><h3>Standings</h3></div></div><div class="mini-table">${[...group.table].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).map((row, index) => `<div class="mini-table-row"><span class="rank ${index < 2 ? 'qualify' : ''}">${index + 1}</span>${teamLink(row.teamId, description.type === 'international')}<strong>${row.points}</strong><small>${row.gd >= 0 ? '+' : ''}${row.gd}</small></div>`).join('')}</div></section>`).join('')}</div>`;
}

const leaderPanel = (title, id, metric, position = null) => `<section class="panel"><div class="panel-head"><div><span class="eyebrow">CURRENT YEAR</span><h3>${esc(title)}</h3></div></div>${leaders(id, metric, 10, position)}</section>`;

function currentView(description) {
  const matches = competitionMatches(description.id);
  if (description.type === 'league') {
    return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">STANDINGS</span><h3>${esc(description.name)}</h3></div><span class="panel-chip">${state.current.week} weeks</span></div>${leagueTable(getLeagueTable(state, description.id), description.object.tier === 'detailed' ? 3 : 0)}</section><div class="leader-grid section-gap">${leaderPanel('Goals', description.id, 'goals')}${leaderPanel('Assists', description.id, 'assists')}${leaderPanel('Goalkeeper clean sheets', description.id, 'cleanSheets', 'GK')}${leaderPanel('Highest average rating', description.id, 'rating')}</div>`;
  }
  const object = description.object;
  return `<section class="competition-hero"><div><span class="eyebrow">CURRENT EDITION</span><h2>${esc(object.stage || 'Ready')}</h2><p>${object.championId ? `${esc(getEntityName(state, object.championId, description.type === 'international'))} are champions.` : `${matches.length} matches completed.`}</p></div><div class="trophy-symbol">◆</div></section>${groupTables(description)}<div class="leader-grid section-gap">${leaderPanel('Goals', description.id, 'goals')}${leaderPanel('Assists', description.id, 'assists')}${leaderPanel('Goalkeeper clean sheets', description.id, 'cleanSheets', 'GK')}${leaderPanel('Highest average rating', description.id, 'rating')}</div><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">RECENT GAMES</span><h3>${esc(description.name)}</h3></div></div><div class="matches-list">${matches.slice(-18).reverse().map((match) => matchRow(match, true)).join('') || '<div class="empty-state compact">No matches yet.</div>'}</div></section>`;
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
  competitionMatches(description.id).forEach((match) => {
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
  const activeSub = sub === 'teams' ? 'teams' : 'players';
  const subTabs = `<nav class="sub-tabs"><a href="${base}/stats/players" class="${activeSub === 'players' ? 'active' : ''}">Players</a><a href="${base}/stats/teams" class="${activeSub === 'teams' ? 'active' : ''}">Teams</a></nav>`;
  if (activeSub === 'players') {
    const rows = aggregatePlayerCompetition(description);
    const topGoals = [...rows].sort((a, b) => b.goals - a.goals)[0];
    const topRated = [...rows].filter((row) => row.games >= 8).sort((a, b) => b.averageRating - a.averageRating)[0];
    const topTitles = [...rows].sort((a, b) => b.titles - a.titles || b.games - a.games)[0];
    const sorted = [...rows].sort((a, b) => b.titles - a.titles || b.goals - a.goals || b.averageRating - a.averageRating);
    return `${subTabs}<div class="stats-highlight-grid">${statCard('All-time goals', topGoals ? topGoals.goals : 0, topGoals ? playerById(topGoals.playerId)?.name : 'No history')}${statCard('Highest rating', topRated ? topRated.averageRating.toFixed(2) : '—', topRated ? playerById(topRated.playerId)?.name : 'Minimum 8 games')}${statCard('Most titles', topTitles ? topTitles.titles : 0, topTitles ? playerById(topTitles.playerId)?.name : 'No history')}</div><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">ALL-TIME PLAYER RECORDS</span><h3>${esc(description.name)}</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Games</th><th>Goals</th><th>Assists</th><th>Clean sheets</th><th>Avg rating</th><th>Titles</th></tr></thead><tbody>${sorted.slice(0, 250).map((row, index) => `<tr><td>${index + 1}</td><td>${playerLink(row.playerId)}</td><td>${row.games}</td><td><strong>${row.goals}</strong></td><td>${row.assists}</td><td>${row.cleanSheets}</td><td>${row.averageRating ? row.averageRating.toFixed(2) : '—'}</td><td><strong>${row.titles}</strong></td></tr>`).join('') || '<tr><td colspan="8">No records yet.</td></tr>'}</tbody></table></div></section>`;
  }
  const aggregate = aggregateTeamCompetition(description);
  const sorted = aggregate.rows.sort((a, b) => b.titles - a.titles || b.goals - a.goals || b.wins - a.wins);
  const topGoals = [...aggregate.rows].sort((a, b) => b.goals - a.goals)[0];
  const topClean = [...aggregate.rows].sort((a, b) => b.cleanSheets - a.cleanSheets)[0];
  const topTitles = [...aggregate.rows].sort((a, b) => b.titles - a.titles)[0];
  return `${subTabs}<div class="stats-highlight-grid">${statCard('Most team goals', topGoals ? topGoals.goals : 0, topGoals ? getEntityName(state, topGoals.teamId, aggregate.isInternational) : 'No history')}${statCard('Most clean sheets', topClean ? topClean.cleanSheets : 0, topClean ? getEntityName(state, topClean.teamId, aggregate.isInternational) : 'No history')}${statCard('Most titles', topTitles ? topTitles.titles : 0, topTitles ? getEntityName(state, topTitles.teamId, aggregate.isInternational) : 'No history')}</div><section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">ALL-TIME TEAM RECORDS</span><h3>${esc(description.name)}</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Team</th><th>Games</th><th>Wins</th><th>Goals</th><th>Clean sheets</th><th>Best points</th><th>Titles</th></tr></thead><tbody>${sorted.map((row, index) => `<tr><td>${index + 1}</td><td>${teamLink(row.teamId, aggregate.isInternational)}</td><td>${row.games}</td><td>${row.wins}</td><td><strong>${row.goals}</strong></td><td>${row.cleanSheets}</td><td>${row.bestPoints || '—'}</td><td><strong>${row.titles}</strong></td></tr>`).join('') || '<tr><td colspan="8">No records yet.</td></tr>'}</tbody></table></div></section>`;
}

function awardsPage() {
  const winners = state.history.awards.filter((award) => award.rank === 1).sort((a, b) => b.season - a.season);
  const ballon = winners.filter((award) => award.category === 'ballon_dor');
  const latestSeason = winners[0]?.season;
  const latest = latestSeason ? winners.filter((award) => award.season === latestSeason) : [];
  return `${pageHead('ANNUAL AWARDS', 'Football honors', 'Ballon d’Or, World Best XI and competition awards remain attached to every player career.')}
    <section class="award-hero"><div><span class="eyebrow">BALLON D'OR ARCHIVE</span><h2>${ballon.length ? playerById(ballon[0].playerId)?.name : 'First award arrives after 2001-02'}</h2><p>${ballon.length ? `${ballon[0].seasonLabel} winner · ${rarityBadge(playerById(ballon[0].playerId)?.rarity)}` : 'Complete the season to crown the first winner.'}</p></div><div class="trophy-symbol">★</div></section>
    <div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">BALLON D'OR</span><h3>Winners by year</h3></div></div><div class="archive-list">${ballon.map((award) => `<div class="archive-row"><strong>${award.seasonLabel}</strong><span>Winner</span>${playerLink(award.playerId)}</div>`).join('') || '<div class="empty-state compact">No completed season yet.</div>'}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">LATEST CEREMONY</span><h3>${latestSeason ? getSeasonLabel(latestSeason) : 'Awaiting awards'}</h3></div></div><div class="award-list">${latest.slice(0, 30).map((award) => `<div class="award-row"><div><strong>${esc(award.name)}</strong><small>${award.competitionId ? esc(competitionLabel(award.competitionId)) : 'World'}</small></div>${playerLink(award.playerId)}</div>`).join('') || '<div class="empty-state compact">Complete the season to create awards.</div>'}</div></section></div>`;
}

function transferList(transfers, compact = false) {
  if (!transfers.length) return '<div class="empty-state compact">No transfers recorded.</div>';
  return `<div class="transfer-list ${compact ? 'compact' : ''}">${transfers.map((transfer) => {
    const player = playerById(transfer.playerId);
    return `<div class="transfer-row"><div class="transfer-player">${player ? `${rarityBadge(player.rarity)}${playerLink(player.id, false)}` : 'Unknown player'}<small>${player ? `${player.position} · ${player.roleLabel}` : ''}</small></div><div class="transfer-route"><span>${transfer.fromClubId ? esc(clubById(transfer.fromClubId)?.name) : 'Free agency'}</span><b>→</b><span>${esc(clubById(transfer.toClubId)?.name)}</span></div><strong>${transfer.freeTransfer ? 'Free' : money(transfer.fee)}</strong></div>`;
  }).join('')}</div>`;
}

function transfersPage() {
  const current = state.history.transfers.filter((transfer) => transfer.season === state.season).sort((a, b) => b.fee - a.fee);
  const all = [...state.history.transfers].sort((a, b) => b.fee - a.fee);
  const biggest = all[0];
  return `${pageHead('TRANSFER MARKET', `${state.current.seasonLabel} market`, 'Clubs negotiate from their transfer budgets. Player happiness, contract length, reputation and market value influence moves.')}
    <div class="stats-ribbon">${statCard('Moves this season', current.length)}${statCard('Money spent', money(current.reduce((sum, transfer) => sum + transfer.fee, 0)))}${statCard('Biggest deal', biggest ? money(biggest.fee) : '—', biggest ? playerById(biggest.playerId)?.name : '')}${statCard('Free agents', state.players.filter((player) => player.status === 'active' && !player.clubId).length)}</div>
    <section class="panel section-gap"><div class="panel-head"><div><span class="eyebrow">CURRENT WINDOW</span><h3>All transfers</h3></div></div>${transferList(current)}</section>`;
}

function playerTabs(active) {
  return `<nav class="competition-tabs player-index-tabs">${PLAYER_TABS.map((tab) => `<a href="#/players/${tab}" class="${active === tab ? 'active' : ''}">${tab === 'overview' ? 'Player Pool' : 'Statistics'}</a>`).join('')}</nav>`;
}

function playersPage(tabRaw = 'overview') {
  const tab = PLAYER_TABS.includes(tabRaw) ? tabRaw : 'overview';
  const activePlayers = state.players.filter((player) => player.status === 'active');
  if (tab === 'statistics') return `${pageHead('PLAYER DATABASE', 'Statistics', 'Filter career totals between club and international football.')}${playerTabs(tab)}${playerStatisticsTable(activePlayers)}`;
  const filtered = activePlayers.filter((player) => {
    const term = playerSearch.trim().toLowerCase();
    return (!term || player.name.toLowerCase().includes(term) || clubById(player.clubId)?.name.toLowerCase().includes(term))
      && (playerPositionFilter === 'ALL' || player.position === playerPositionFilter);
  }).sort((a, b) => b.rating - a.rating || STAR_RARITIES[b.rarity].rank - STAR_RARITIES[a.rarity].rank);
  return `${pageHead('PLAYER DATABASE', 'Named stars', 'Every player has a rarity, position, tactical role, contract and pre-generated career path.')}${playerTabs(tab)}<section class="panel"><div class="filter-toolbar"><label>Search<input id="player-search" type="search" value="${esc(playerSearch)}" placeholder="Player or club"></label><label>Position<select id="player-position-filter"><option value="ALL">All positions</option>${['GK', 'DF', 'MF', 'FW'].map((position) => `<option value="${position}" ${playerPositionFilter === position ? 'selected' : ''}>${position}</option>`).join('')}</select></label><span>${fmt(filtered.length)} active players</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Player</th><th>Club</th><th>Nation</th><th>Pos</th><th>Role</th><th>Rarity</th><th>Age</th><th>Rating</th><th>Contract</th></tr></thead><tbody>${filtered.slice(0, 500).map((player) => `<tr><td>${playerLink(player.id)}</td><td>${player.clubId ? teamLink(player.clubId) : '<span class="free-agent">Free agent</span>'}</td><td>${flag(player.nationality)}</td><td>${player.position}</td><td>${esc(player.roleLabel)}</td><td>${rarityBadge(player.rarity)}</td><td>${state.season - player.birthYear}</td><td><strong>${player.rating}</strong></td><td>${player.contractYears ? `${player.contractYears} yr` : 'Free'}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function playerStatisticsTable(activePlayers) {
  const rows = activePlayers.filter((player) => playerPositionFilter === 'ALL' || player.position === playerPositionFilter).map((player) => ({ player, totals: getPlayerTotals(state, player.id, playerStatsScope) }));
  rows.sort((a, b) => {
    if (playerStatsSort === 'rating') return b.totals.averageRating - a.totals.averageRating || b.totals.games - a.totals.games;
    return (b.totals[playerStatsSort] || 0) - (a.totals[playerStatsSort] || 0) || b.player.rating - a.player.rating;
  });
  return `<section class="panel"><div class="filter-toolbar"><label>Position<select id="player-position-filter"><option value="ALL">All positions</option>${['GK', 'DF', 'MF', 'FW'].map((position) => `<option value="${position}" ${playerPositionFilter === position ? 'selected' : ''}>${position}</option>`).join('')}</select></label><label>Scope<select id="player-stats-scope"><option value="club" ${playerStatsScope === 'club' ? 'selected' : ''}>Club football</option><option value="international" ${playerStatsScope === 'international' ? 'selected' : ''}>International football</option><option value="all" ${playerStatsScope === 'all' ? 'selected' : ''}>Combined</option></select></label><label>Sort by<select id="player-stats-sort">${[['goals', 'Goals'], ['games', 'Games'], ['assists', 'Assists'], ['rating', 'Average score'], ['titles', 'Titles']].map(([value, label]) => `<option value="${value}" ${playerStatsSort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Position</th><th>Club</th><th>Games</th><th>Goals</th><th>Assists</th><th>Average score</th><th>Total titles</th></tr></thead><tbody>${rows.slice(0, 500).map(({ player, totals }, index) => `<tr><td>${index + 1}</td><td>${playerLink(player.id)}</td><td>${player.position}</td><td>${player.clubId ? teamLink(player.clubId) : 'Free agent'}</td><td>${totals.games}</td><td><strong>${totals.goals}</strong></td><td>${totals.assists}</td><td>${totals.games ? totals.averageRating.toFixed(2) : '—'}</td><td><strong>${totals.titles}</strong></td></tr>`).join('')}</tbody></table></div></section>`;
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
  return `${heading}<section class="entity-hero player-entity"><div class="player-number">${player.position}</div><div class="entity-main"><div class="entity-badges">${rarityBadge(player.rarity)}${flag(player.nationality)}</div><span class="entity-kicker">${esc(player.roleLabel)}</span><h2>${esc(player.name)}</h2><div class="entity-meta">${player.clubId ? teamLink(player.clubId) : '<span class="free-agent">Free agent</span>'} · ${player.contractYears ? `${player.contractYears} years remaining` : 'Out of contract'}</div></div><div class="rating-orbit"><strong>${player.rating}</strong><span>ABILITY</span></div></section>
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
      <section class="staff-card"><span class="eyebrow">OWNER / PRESIDENT</span><div class="staff-card-head"><div class="staff-avatar">♛</div><div><h3>${esc(owner?.name || 'Vacant')}</h3>${owner ? staffRarityBadge(owner.rarity) : ''}</div></div><strong>${esc(ownerProfile?.label || 'No profile')}</strong><p>${esc(ownerProfile?.description || 'The club is awaiting new ownership.')}</p><div class="staff-effects"><span>Money ×${Number(club.ownerMoneyMultiplier || 1).toFixed(2)}</span><span>Negotiation +${Math.round((club.ownerNegotiationBonus || 0) * 100)}%</span><span>Patience ×${Number(club.ownerPatience || 1).toFixed(2)}</span></div></section>
      <section class="staff-card"><span class="eyebrow">HEAD COACH</span><div class="staff-card-head"><div class="staff-avatar">⌁</div><div><h3>${esc(coach?.name || 'Vacant')}</h3>${coach ? staffRarityBadge(coach.rarity) : ''}</div></div><strong>${esc(coachProfile?.label || 'No tactical identity')}</strong><p>${esc(coachProfile?.description || 'The board is searching for a new coach.')}</p><div class="staff-effects"><span>Quality ${coach?.quality || '—'}</span><span>${coach?.seasonsInRole || 0} seasons</span><span>${coach?.trophies || 0} trophies</span></div></section>
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
    <section class="staff-card section-gap national-coach-card"><span class="eyebrow">NATIONAL COACH</span><div class="staff-card-head"><div class="staff-avatar">⌁</div><div><h3>${esc(coach?.name || 'Vacant')}</h3>${coach ? staffRarityBadge(coach.rarity) : ''}</div></div><strong>${esc(coachProfile?.label || 'No tactical identity')}</strong><p>${esc(coachProfile?.description || 'The federation is searching for a coach.')}</p><div class="staff-effects"><span>Quality ${coach?.quality || '—'}</span><span>${coach?.seasonsInRole || 0} seasons</span><span>${coach?.trophies || 0} trophies</span></div></section>
    <div class="two-column section-gap"><section class="panel"><div class="panel-head"><div><span class="eyebrow">CURRENT SELECTION</span><h3>Best eight</h3></div></div><div class="squad-list">${lineup.map((player) => `<a class="squad-row squad-row-wide" href="#/player/${player.id}/profile"><span>${player.position}</span><div><strong>${esc(player.name)}</strong><small>${rarityBadge(player.rarity)} ${player.clubId ? esc(clubById(player.clubId)?.name) : 'National pool'} · ${esc(player.roleLabel)}</small></div><b>${player.rating}</b></a>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">NATIONAL HONORS</span><h3>${honours.length} trophies</h3></div></div>${honoursList(honours, 'competitionName')}<div class="panel-head recent-head"><div><span class="eyebrow">CURRENT RESULTS</span><h3>International matches</h3></div></div><div class="matches-list">${matches.slice(-12).reverse().map((match) => matchRow(match, true)).join('') || '<div class="empty-state compact">No matches yet.</div>'}</div></section></div>`;
}

function almanacPage() {
  return `${pageHead('PERMANENT HISTORY', 'Almanac', 'Completed seasons retain compact player summaries, club records, winners, awards and landmark finals.')}
    <section class="almanac-hero"><div><span class="eyebrow">ARCHIVE SCALE</span><h2>${fmt(state.history.playerSeasons.length)} player-season rows</h2><p>${fmt(state.history.clubSeasons.length)} club-season summaries · ${fmt(state.history.awards.length)} award records · ${fmt(state.history.transfers.length)} transfers</p></div><div class="archive-seal">▤</div></section>
    <section class="panel section-gap"><div class="archive-list">${[...state.history.champions].reverse().slice(0, 150).map((champion) => `<div class="archive-row"><strong>${champion.seasonLabel}</strong><span>${esc(champion.competitionName)}</span>${teamLink(champion.winnerId, champion.isInternational)}</div>`).join('') || '<div class="empty-state">No archived champions.</div>'}</div></section>`;
}

const notFound = () => '<div class="not-found"><div>404</div><h1>That part of the football world does not exist yet.</h1><a class="primary-button" href="#/world">Return to world</a></div>';

function searchOverlay() {
  return searchOpen ? `<div class="search-overlay" data-action="close-search"><div class="search-panel" data-action="noop"><div class="search-head"><div><span class="eyebrow">UNIVERSE SEARCH</span><h2>Find clubs, players and nations</h2></div><button class="close-button" data-action="close-search">×</button></div><input id="global-search" class="search-input" type="search" placeholder="Type a player, club or country…"><div id="search-results" class="search-results"><div class="empty-state compact">Start typing.</div></div></div></div>` : '';
}

function page(currentRoute) {
  if (currentRoute.page === 'world') return worldPage();
  if (currentRoute.page === 'region') return regionPage(currentRoute.id);
  if (currentRoute.page === 'country') return countryPage(currentRoute.id);
  if (currentRoute.page === 'international') return internationalPage();
  if (['league', 'competition'].includes(currentRoute.page)) {
    const description = descriptor(currentRoute.id);
    return description ? competitionPage(description, currentRoute.tab, currentRoute.sub) : notFound();
  }
  if (currentRoute.page === 'awards') return awardsPage();
  if (currentRoute.page === 'transfers') return transfersPage();
  if (currentRoute.page === 'players') return playersPage(currentRoute.id);
  if (currentRoute.page === 'player') return playerPage(currentRoute.id, currentRoute.tab);
  if (currentRoute.page === 'club') return clubPage(currentRoute.id);
  if (currentRoute.page === 'nation') return nationPage(currentRoute.id);
  if (currentRoute.page === 'almanac') return almanacPage();
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
    state = loaded;
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
  if (globalSearch) {
    setTimeout(() => globalSearch.focus(), 20);
    globalSearch.addEventListener('input', (event) => searchResults(event.target.value));
  }
  const playerSearchInput = document.getElementById('player-search');
  if (playerSearchInput) {
    const applyPlayerSearch = () => {
      playerSearch = playerSearchInput.value;
      render();
    };
    playerSearchInput.addEventListener('change', applyPlayerSearch);
    playerSearchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') applyPlayerSearch();
    });
  }
  const position = document.getElementById('player-position-filter');
  if (position) position.addEventListener('change', (event) => { playerPositionFilter = event.target.value; render(); });
  const scope = document.getElementById('player-stats-scope');
  if (scope) scope.addEventListener('change', (event) => { playerStatsScope = event.target.value; render(); });
  const sort = document.getElementById('player-stats-sort');
  if (sort) sort.addEventListener('change', (event) => { playerStatsSort = event.target.value; render(); });
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
  const nations = NATIONAL_TEAMS.filter((team) => team.name.toLowerCase().includes(term)).slice(0, 8);
  root.innerHTML = `${clubs.length ? `<div class="search-group"><span>CLUBS</span>${clubs.map((club) => `<button data-action="open-club-modal" data-id="${club.id}">${crest(club.id, 'sm')}<div><strong>${esc(club.name)}</strong><small>${esc(club.country)} · ${esc(club.city)}</small></div></button>`).join('')}</div>` : ''}${players.length ? `<div class="search-group"><span>PLAYERS</span>${players.map((player) => `<a href="#/player/${player.id}/profile">${flag(player.nationality)}<div><strong>${esc(player.name)}</strong><small>${player.clubId ? esc(clubById(player.clubId)?.name) : 'National pool'} · ${player.position} ${player.rating} · ${STAR_RARITIES[player.rarity].label}</small></div></a>`).join('')}</div>` : ''}${nations.length ? `<div class="search-group"><span>NATIONAL TEAMS</span>${nations.map((nation) => `<a href="#/nation/${nation.id}">${flag(nation.id)}<div><strong>${esc(nation.name)}</strong><small>${esc(nation.region)} · Tier ${nation.tier}</small></div></a>`).join('')}</div>` : ''}`;
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
  if (action === 'cloud-save') await cloudSave();
  if (action === 'cloud-load') await cloudLoad();
  if (action === 'cloud-code') manageCloudCode();
  if (action === 'reset-world' && window.confirm('Reset the entire universe and erase its local history? Your existing Neon cloud save is not deleted.')) {
    state = createWorld(Date.now() % 2147483647);
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
