const COUNTRY_SLUG = {
  'England':'england','Scotland':'scotland','Wales':'wales','Ireland':'ireland','Spain':'spain','Italy':'italy','Germany':'germany','France':'france','Portugal':'portugal','Netherlands':'netherlands','Belgium':'belgium','Turkey':'turkiye','Türkiye':'turkiye','Greece':'greece','Austria':'austria','Switzerland':'switzerland','Denmark':'denmark','Norway':'norway','Sweden':'sweden','Poland':'poland','Croatia':'croatia','Serbia':'serbia','Czech Republic':'czech-republic','Czechia':'czech-republic','Slovakia':'slovakia','Slovenia':'slovenia','Bosnia and Herzegovina':'bosnia-and-herzegovina','Ukraine':'ukraine','Russia':'russia','Romania':'romania','Hungary':'hungary',
  'Argentina':'argentina','Brazil':'brazil','Uruguay':'uruguay','Colombia':'colombia','Chile':'chile','Ecuador':'ecuador','Peru':'peru','Paraguay':'paraguay',
  'Mexico':'mexico','United States':'usa','Canada':'canada','Costa Rica':'costa-rica',
  'Japan':'japan','South Korea':'south-korea','China':'china','Saudi Arabia':'saudi-arabia','Qatar':'qatar','Australia':'australia',
  'Egypt':'egypt','Morocco':'morocco','Nigeria':'nigeria','South Africa':'south-africa','Tunisia':'tunisia','Algeria':'algeria','Senegal':'senegal','Ivory Coast':'ivory-coast','Cameroon':'cameroon','Ghana':'ghana','Mali':'mali','DR Congo':'dr-congo','Burkina Faso':'burkina-faso','Guinea':'guinea','Cape Verde':'cape-verde','Gabon':'gabon','Iran':'iran','Iraq':'iraq','Uzbekistan':'uzbekistan','Panama':'panama','New Zealand':'new-zealand'
};

const LOGO_ALIASES = {
  'Atlético Madrid':'Atletico_Madrid', 'Athletic Club':'Athletic_Club_Bilbao', 'Celta Vigo':'Celta', 'Real Oviedo':'Oviedo',
  'Deportivo La Coruña':'Deportivo_La_Coruña', 'Alavés':'Deportivo_Alavés', 'Manchester United':'Manchester_United',
  'Manchester City':'Manchester_City', 'Tottenham':'Tottenham_Hotspur', 'West Ham':'West_Ham_United', 'Wolverhampton':'Wolverhampton_Wanderers',
  'Inter':'Inter_Milan', 'AC Milan':'AC_Milan', 'Roma':'AS_Roma', 'Lazio':'SS_Lazio', 'Bayern Munich':'Bayern_Munich',
  'Borussia Dortmund':'Borussia_Dortmund', 'Bayer Leverkusen':'Bayer_Leverkusen', 'RB Leipzig':'RB_Leipzig', 'Paris Saint-Germain':'Paris_Saint-Germain',
  'Marseille':'Olympique_Marseille', 'Lyon':'Olympique_Lyonnais', 'Sporting CP':'Sporting_CP', 'PSV':'PSV_Eindhoven',
  'Boca Juniors':'Boca_Juniors', 'River Plate':'River_Plate', 'Racing Club':'Racing_Club', 'Vélez Sarsfield':'Velez_Sarsfield',
  'São Paulo':'Sao_Paulo', 'Grêmio':'Gremio', 'Club América':'Club_America', 'Tigres UANL':'Tigres_UANL', 'Guadalajara':'Chivas_Guadalajara',
  'Urawa Red Diamonds':'Urawa_Red_Diamonds', 'Yokohama F. Marinos':'Yokohama_F_Marinos', 'Kawasaki Frontale':'Kawasaki_Frontale',
  'Al Ahly':'Al_Ahly', 'Wydad Casablanca':'Wydad_Casablanca', 'Raja Casablanca':'Raja_Casablanca', 'Mamelodi Sundowns':'Mamelodi_Sundowns',
  'Galatasaray':'Galatasaray', 'Fenerbahçe':'Fenerbahce', 'Beşiktaş':'Besiktas', 'Trabzonspor':'Trabzonspor', 'Celtic':'Celtic', 'Rangers':'Rangers',
  'Al Hilal':'Al_Hilal', 'Al Nassr':'Al_Nassr', 'Al Ittihad':'Al_Ittihad'
};

const REAL_LOGO_COUNTRIES = new Set(Object.keys(COUNTRY_SLUG));
const CDN_LOGO_COUNTRIES = new Set(['England','Spain','Italy','Germany','France','Portugal','Netherlands','Belgium','Scotland','Turkey','Türkiye','Austria','Switzerland','Denmark','Norway','Sweden','Poland','Croatia','Serbia','Czech Republic','Czechia','Ukraine','Greece','Romania']);

function hash(value) {
  let h = 2166136261;
  const input = String(value || 'fw');
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(list, seed, offset = 0) {
  return list[(seed + offset * 2654435761) % list.length];
}

function groupForCountry(country, seed) {
  const name = String(country || '');
  const eastAsian = new Set(['Japan','South Korea','China','North Korea','Vietnam','Thailand','Indonesia','Malaysia','Singapore','Philippines','Taiwan','Hong Kong','Mongolia']);
  const southAsian = new Set(['India','Pakistan','Bangladesh','Sri Lanka','Nepal']);
  const mena = new Set(['Morocco','Algeria','Tunisia','Egypt','Saudi Arabia','Qatar','United Arab Emirates','Jordan','Iraq','Iran','Syria','Lebanon','Israel','Turkey','Türkiye']);
  const african = new Set(['Nigeria','Ghana','Senegal','Cameroon','Ivory Coast','Mali','Guinea','Gambia','South Africa','Angola','Congo DR','Congo','Kenya','Uganda','Tanzania','Zimbabwe','Zambia','Mozambique','Gabon','Benin','Togo','Burkina Faso','Cape Verde']);
  const latin = new Set(['Spain','Portugal','Argentina','Uruguay','Chile','Mexico','Costa Rica','Peru','Ecuador','Paraguay','Bolivia','Venezuela','Cuba','Dominican Republic']);
  if (eastAsian.has(name)) return 'eastAsian';
  if (southAsian.has(name)) return 'southAsian';
  if (mena.has(name)) return 'mena';
  if (african.has(name)) return 'black';
  if (name === 'Brazil' || name === 'Colombia' || name === 'France' || name === 'England' || name === 'United States' || name === 'Canada' || name === 'Netherlands' || name === 'Belgium' || name === 'Portugal') {
    const roll = seed % 100;
    if (name === 'Brazil' || name === 'Colombia') return roll < 34 ? 'black' : roll < 80 ? 'latin' : 'mixed';
    if (name === 'France' || name === 'England' || name === 'Netherlands' || name === 'Belgium') return roll < 22 ? 'black' : roll < 30 ? 'mena' : 'european';
    if (name === 'United States' || name === 'Canada') return roll < 25 ? 'black' : roll < 45 ? 'latin' : roll < 55 ? 'eastAsian' : 'european';
    if (name === 'Portugal') return roll < 18 ? 'black' : roll < 27 ? 'mixed' : 'latin';
  }
  if (latin.has(name)) return 'latin';
  return 'european';
}



// Phase 1 face rebuild for v2.90:
// - restore a clean, fixed portrait library
// - route elite rarities through a large personality-rich pool
// - route lower rarities through a smaller, intentionally repeatable pool
// - keep face images free of baked UI effects so rarity backgrounds live in CSS
const PLAYER_FACE_GROUPS_BASE = {
  light: [0,2,3,7,10,11,15,18,23,26,27,33,34,37,38,41,54,55,61,63,64,65,68,69,73,79,82],
  medium: [6,13,20,22,24,25,32,44,47,48,49,52,56,66,71,72,80,81,83],
  dark: [1,4,8,12,16,19,21,28,35,42,46,53,57,62,70,77],
  east: [5,14,29,30,36,39,40,43,45,50,51,58,59,60,67,74,75,76,78]
};

const COACH_FACE_GROUPS_BASE = {
  light: [0,1,4,8,10,12,14,15,18,19],
  medium: [2,9,13,16],
  dark: [3],
  east: [5,6,7,11,17]
};

const GENERIC_PLAYER_GROUPS = {
  light: [0,2,10,11,18,23,33,41,63,82],
  medium: [6,13,20,22,24,25,32,44,47,48],
  dark: [1,4,8,12,16,19,21,28,35,46],
  east: [5,14,29,30,36,39,40,43,45,50]
};

const GENERIC_COACH_GROUPS = {
  light: [1,4,12],
  medium: [2,9,13],
  dark: [3,23],
  east: [5,11]
};

const FACE_POOL_COUNTS = {
  player: { elite: 160, generic: 40, total: 200 },
  coach: { elite: 40, generic: 10, total: 50 }
};

const ELITE_RARITIES = new Set(['generational', 'legend', 'epic']);

function unique(list) {
  return [...new Set(list)];
}

function flattenGroups(groups) {
  return unique(Object.values(groups).flat());
}

function subtract(list, blocked) {
  const blockedSet = new Set(blocked);
  return list.filter((item) => !blockedSet.has(item));
}

function canonicalPlayerFaceIndex(index) {
  if (index < 84) return index;
  if (index < 120) return index - 84;
  if (index < 168) return index - 84;
  return index - 168;
}

function canonicalCoachFaceIndex(index) {
  if (index < 20) return index;
  if (index < 40) return index - 20;
  return index - 40;
}

function buildDerivedFaceGroups(total, baseGroups, canonicalizer) {
  const groupMap = new Map();
  for (const [group, indexes] of Object.entries(baseGroups)) {
    indexes.forEach((index) => groupMap.set(index, group));
  }
  const derived = { light: [], medium: [], dark: [], east: [] };
  for (let index = 0; index < total; index += 1) {
    const canonical = canonicalizer(index);
    const group = groupMap.get(canonical) || 'light';
    derived[group].push(index);
  }
  return derived;
}

const ALL_PLAYER_GROUPS = buildDerivedFaceGroups(FACE_POOL_COUNTS.player.total, PLAYER_FACE_GROUPS_BASE, canonicalPlayerFaceIndex);
const ALL_COACH_GROUPS = buildDerivedFaceGroups(FACE_POOL_COUNTS.coach.total, COACH_FACE_GROUPS_BASE, canonicalCoachFaceIndex);
const GENERIC_PLAYER_SET = new Set(flattenGroups(GENERIC_PLAYER_GROUPS));
const GENERIC_COACH_SET = new Set(flattenGroups(GENERIC_COACH_GROUPS));

const ELITE_PLAYER_GROUPS = Object.fromEntries(Object.entries(ALL_PLAYER_GROUPS).map(([group, list]) => [group, subtract(list, GENERIC_PLAYER_SET)]));
const ELITE_COACH_GROUPS = Object.fromEntries(Object.entries(ALL_COACH_GROUPS).map(([group, list]) => [group, subtract(list, GENERIC_COACH_SET)]));

function appearanceGroup(country, seed) {
  const group = groupForCountry(country, seed);
  if (group === 'black') return 'dark';
  if (group === 'eastAsian') return 'east';
  if (group === 'european') return seed % 100 < 82 ? 'light' : 'medium';
  if (group === 'latin') return seed % 100 < 68 ? 'medium' : seed % 100 < 92 ? 'light' : 'dark';
  if (group === 'mena') return seed % 100 < 82 ? 'medium' : 'light';
  if (group === 'southAsian') return seed % 100 < 72 ? 'medium' : 'dark';
  return seed % 100 < 55 ? 'medium' : seed % 100 < 78 ? 'light' : 'dark';
}

function facePool(entity, kind, nationalityName) {
  const seed = hash(entity?.id || entity?.name || `${kind}-face`);
  const group = appearanceGroup(nationalityName || entity?.nationalityName || entity?.nationality || '', seed);
  const rarity = entity?.rarity || 'common';
  const genericGroups = kind === 'coach' ? GENERIC_COACH_GROUPS : GENERIC_PLAYER_GROUPS;
  const eliteGroups = kind === 'coach' ? ELITE_COACH_GROUPS : ELITE_PLAYER_GROUPS;
  const primary = ELITE_RARITIES.has(rarity) ? eliteGroups : genericGroups;
  const fallback = ELITE_RARITIES.has(rarity) ? flattenGroups(eliteGroups) : flattenGroups(genericGroups);
  return primary[group] || primary.light || fallback;
}

function faceIndex(entity, kind, nationalityName) {
  const seed = hash(entity?.id || entity?.name || `${kind}-face`);
  const pool = facePool(entity, kind, nationalityName);
  return pool[seed % pool.length];
}

function portraitImage(entity, kind = 'player', nationalityName = '', size = 'md') {
  const idx = faceIndex(entity, kind, nationalityName);
  const prefix = kind === 'coach' ? 'c' : 'p';
  const rarityClass = entity?.rarity ? ` rarity-${entity.rarity}` : '';
  const sizeClass = ` avatar-${size}`;
  const displayName = entity?.name || (kind === 'coach' ? 'Coach' : 'Player');
  const alt = `${displayName} portrait`;
  const fallback = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || (kind === 'coach' ? 'C' : 'P');
  return `<span class="anime-avatar ${kind}-avatar${rarityClass} ${sizeClass}" data-avatar-pool="${idx}" title="${kind === 'coach' ? 'Coach' : 'Player'} portrait #${idx + 1}"><span class="anime-face-fallback" aria-hidden="true">${fallback.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span><img data-face-image class="anime-face-image" src="./assets/faces/${kind === 'coach' ? 'coaches' : 'players'}/${prefix}${String(idx).padStart(3,'0')}.webp" alt="${alt.replace(/"/g,'&quot;')}" loading="lazy" decoding="async"></span>`;
}

export function playerPortrait(player, nationalityName, size = 'md') {
  return portraitImage(player, 'player', nationalityName, size);
}

export function coachPortrait(coach, nationalityName, size = 'md') {
  return portraitImage(coach, 'coach', nationalityName, size);
}

export function getFacePoolCounts() {
  return JSON.parse(JSON.stringify(FACE_POOL_COUNTS));
}

export function getFacePoolPlan() {
  return JSON.parse(JSON.stringify({
    counts: FACE_POOL_COUNTS,
    allPlayerGroups: ALL_PLAYER_GROUPS,
    elitePlayerGroups: ELITE_PLAYER_GROUPS,
    genericPlayerGroups: GENERIC_PLAYER_GROUPS,
    allCoachGroups: ALL_COACH_GROUPS,
    eliteCoachGroups: ELITE_COACH_GROUPS,
    genericCoachGroups: GENERIC_COACH_GROUPS
  }));
}

const DIRECT_LOGOS = {
  'Botafogo':'https://assets.football-logos.cc/logos/brazil/1500x1500/botafogo.fd9f548d.png',
  'Bayern Munich':'https://assets.football-logos.cc/logos/germany/256x256/bayern-munchen.6c38f13a.png',
  'Inter':'https://assets.football-logos.cc/logos/italy/256x256/inter.d4ebfb95.png'
};

const CDN_BADGE_ALIASES = {
  'Real Madrid':'real-madrid','Atlético Madrid':'atletico-madrid','Athletic Club':'athletic-club','Villarreal':'villarreal-cf','Real Sociedad':'real-sociedad','Sevilla':'sevilla-fc','Valencia':'valencia-cf','Real Betis':'real-betis',
  'Arsenal':'arsenal-fc','Liverpool':'liverpool-fc','Chelsea':'chelsea-fc','Manchester United':'manchester-united','Manchester City':'manchester-city','Tottenham':'tottenham-hotspur','Newcastle United':'newcastle-united','Aston Villa':'aston-villa','West Ham':'west-ham-united','Everton':'everton-fc',
  'Inter':'inter-milan','Juventus':'juventus-fc','AC Milan':'ac-milan','Napoli':'ssc-napoli','Roma':'as-roma','Lazio':'ss-lazio','Atalanta':'atalanta-bc','Fiorentina':'acf-fiorentina',
  'Bayern Munich':'bayern-munich','Borussia Dortmund':'borussia-dortmund','Bayer Leverkusen':'bayer-leverkusen','RB Leipzig':'rb-leipzig','Eintracht Frankfurt':'eintracht-frankfurt','Stuttgart':'vfb-stuttgart',
  'Paris Saint-Germain':'paris-saint-germain','Marseille':'olympique-marseille','Lyon':'olympique-lyonnais','Monaco':'as-monaco','Lille':'lille-osc',
  'Benfica':'sl-benfica','Porto':'fc-porto','Sporting CP':'sporting-cp','Ajax':'ajax-amsterdam','PSV':'psv-eindhoven','Feyenoord':'feyenoord-rotterdam',
  'Anderlecht':'rsc-anderlecht','Galatasaray':'galatasaray','Fenerbahçe':'fenerbahce','Beşiktaş':'besiktas-jk','Trabzonspor':'trabzonspor','Celtic':'celtic-fc','Rangers':'rangers-fc'
};

const RAW_LOGO_ALIASES = {
  ...LOGO_ALIASES,
  'Bayern Munich':'Bayern_München','Inter':'Inter','Juventus':'Juventus','Napoli':'Napoli','Roma':'AS_Roma','Lazio':'Lazio','Fiorentina':'Fiorentina',
  'Stuttgart':'VfB_Stuttgart','Borussia Mönchengladbach':'Borussia_Mönchengladbach','Mainz':'Mainz_05','Hamburg':'Hamburger_SV','Köln':'Cologne',
  'Benfica':'Benfica','Porto':'FC_Porto','Ajax':'Ajax','Feyenoord':'Feyenoord','Monaco':'Monaco'
};

function countryCdnSlug(country) {
  return COUNTRY_SLUG[country] || String(country || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

export function clubLogoUrls(club) {
  if (!club || !REAL_LOGO_COUNTRIES.has(club.country)) return [];
  if ((club.baseStrength ?? club.strength ?? 0) < 70) return [];
  const urls = [];
  if (DIRECT_LOGOS[club.name]) urls.push(DIRECT_LOGOS[club.name]);
  const cdnAlias = CDN_BADGE_ALIASES[club.name];
  if (cdnAlias && CDN_LOGO_COUNTRIES.has(club.country)) {
    urls.push(`https://cdn.jsdelivr.net/gh/leoratzlaff/football-badges@latest/logos/${countryCdnSlug(club.country)}/${cdnAlias}.png`);
  }
  const folder = COUNTRY_SLUG[club.country];
  if (folder) {
    const filename = RAW_LOGO_ALIASES[club.name] || String(club.name).replace(/[./]/g, '').replace(/\s+/g, '_');
    urls.push(`https://raw.githubusercontent.com/JoseArroyave/football-logos/refs/heads/main/logos/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}.svg`);
  }
  return [...new Set(urls)];
}

export function clubLogoUrl(club) {
  return clubLogoUrls(club)[0] || '';
}

const COMP_STYLE = {
  UCL:{ label:'Champions League', kind:'ucl' },
  UEL:{ label:'Europa Cup', kind:'uel' },
  UECL:{ label:'Conference Cup', kind:'uecl' },
  LIB:{ label:'Libertadores Cup', kind:'lib' },
  SUD:{ label:'Sudamericana Cup', kind:'sud' },
  CCC:{ label:'Champions Cup', kind:'ccc' },
  ACL:{ label:'Asia Champions', kind:'acl' },
  CAFCL:{ label:'Africa Champions', kind:'cafcl' },
  OFCCL:{ label:'Oceania Champions', kind:'ofccl' },
  WC:{ label:'World Cup', kind:'wc' },
  CWC:{ label:'Club World Cup', kind:'cwc' },
  INTERCONT:{ label:'Intercontinental Cup', kind:'intercont' },
  EURO:{ label:'Euro', kind:'euro' },
  COPA:{ label:'Copa América', kind:'copa' },
  AFCON:{ label:'Africa Cup', kind:'afcon' },
  ASIANCUP:{ label:'Asian Cup', kind:'asiancup' },
  GOLD:{ label:'Gold Cup', kind:'gold' },
  OFC:{ label:'Oceania Cup', kind:'ofc' },
  CUP:{ label:'Domestic Cup', kind:'cup' },
  SC:{ label:'Super Cup', kind:'sc' },
  DEFAULT:{ label:'Competition', kind:'default' }
};

function competitionMeta(id) {
  const raw = String(id || '');
  if (COMP_STYLE[raw]) return COMP_STYLE[raw];
  if (raw.startsWith('CUP-')) return COMP_STYLE.CUP;
  if (raw.startsWith('SC-')) return COMP_STYLE.SC;
  return COMP_STYLE.DEFAULT;
}

function emblemSvg(kind) {
  const svg = {
    ucl: `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="uclBg" x1="0" x2="1"><stop offset="0" stop-color="#173976"/><stop offset="1" stop-color="#081935"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(#uclBg)"/><g fill="#ffffff"><circle cx="50" cy="17" r="8"/><circle cx="24" cy="30" r="8"/><circle cx="24" cy="70" r="8"/><circle cx="50" cy="83" r="8"/><circle cx="76" cy="70" r="8"/><circle cx="76" cy="30" r="8"/></g><circle cx="50" cy="50" r="15" fill="none" stroke="#ffffff" stroke-width="5"/></svg>`,
    uel: `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="25" y="12" width="50" height="10" rx="4" fill="#0e2c62"/><path d="M43 22 L57 22 L66 73 L34 73 Z" fill="#d4a33e"/><rect x="39" y="73" width="22" height="8" rx="3" fill="#1e396e"/><rect x="31" y="82" width="38" height="8" rx="3" fill="#0c1833"/></svg>`,
    uecl: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="38" fill="none" stroke="#26a65b" stroke-width="8"/><circle cx="50" cy="50" r="25" fill="none" stroke="#113f2a" stroke-width="8"/><path d="M50 12 L58 42 L88 50 L58 58 L50 88 L42 58 L12 50 L42 42 Z" fill="#ffffff" opacity=".95"/></svg>`,
    lib: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M40 12 L48 12 L46 78 L40 78 Z" fill="#a77012"/><path d="M52 12 L60 12 L60 78 L54 78 Z" fill="#dcba65"/><path d="M27 25 L36 19 L36 78 L27 78 Z" fill="#7d5810"/><path d="M64 19 L73 25 L73 78 L64 78 Z" fill="#e1c580"/><rect x="22" y="79" width="56" height="9" rx="4" fill="#1e2741"/></svg>`,
    sud: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 16 L68 36 L50 84 L32 36 Z" fill="#2f68c7"/><path d="M50 26 L60 38 L50 67 L40 38 Z" fill="#ffffff" opacity=".92"/><circle cx="50" cy="18" r="7" fill="#e0b34c"/></svg>`,
    ccc: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 10 L61 38 L90 38 L66 55 L75 85 L50 67 L25 85 L34 55 L10 38 L39 38 Z" fill="#dd5050"/><circle cx="50" cy="50" r="11" fill="#ffffff" opacity=".92"/></svg>`,
    acl: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8 C66 25 78 39 78 54 C78 73 65 87 50 92 C35 87 22 73 22 54 C22 39 34 25 50 8 Z" fill="#2f89d2"/><path d="M50 24 L58 43 L78 50 L58 57 L50 76 L42 57 L22 50 L42 43 Z" fill="#ffffff" opacity=".95"/></svg>`,
    cafcl: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="37" fill="#223925"/><path d="M50 15 L58 36 L82 38 L63 53 L69 76 L50 63 L31 76 L37 53 L18 38 L42 36 Z" fill="#dfbf66"/></svg>`,
    ofccl: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="#123a64"/><path d="M20 58 C30 38 44 27 60 20 C56 32 60 45 75 55 C60 58 44 67 35 81 C33 71 28 63 20 58 Z" fill="#5dc0ff"/></svg>`,
    wc: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M39 12 C42 27 34 34 34 45 C34 61 44 74 50 88 C56 74 66 61 66 45 C66 34 58 27 61 12 Z" fill="#d6ab48"/><circle cx="50" cy="24" r="10" fill="#f4d67f"/><path d="M42 48 C47 54 53 54 58 48" stroke="#fff3cf" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
    cwc: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="38" fill="#1b2644"/><circle cx="50" cy="50" r="26" fill="none" stroke="#dfbc62" stroke-width="8"/><path d="M50 18 L57 43 L82 50 L57 57 L50 82 L43 57 L18 50 L43 43 Z" fill="#ffffff"/></svg>`,
    intercont: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="32" fill="#14213b" stroke="#d5ad53" stroke-width="8"/><path d="M50 18 v64 M18 50 h64 M28 28 q22 10 44 0 M28 72 q22 -10 44 0" stroke="#ffffff" stroke-width="4" fill="none" opacity=".9"/></svg>`,
    euro: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M38 12 L62 12 L57 66 L43 66 Z" fill="#2b65c0"/><circle cx="50" cy="22" r="10" fill="#5ea7ff"/><rect x="35" y="66" width="30" height="8" rx="3" fill="#d7b35a"/><rect x="28" y="80" width="44" height="8" rx="3" fill="#152545"/></svg>`,
    copa: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="40" r="20" fill="#5aa8d4"/><path d="M37 56 h26 l-4 18 H41 Z" fill="#1a4165"/><rect x="30" y="77" width="40" height="8" rx="4" fill="#d0ad57"/></svg>`,
    afcon: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 12 L68 36 L50 88 L32 36 Z" fill="#c49439"/><circle cx="50" cy="29" r="8" fill="#f2d07a"/><path d="M50 42 L58 58 L50 73 L42 58 Z" fill="#294629"/></svg>`,
    asiancup: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="34" fill="#173b55" stroke="#3cb6e0" stroke-width="8"/><path d="M50 18 C62 32 66 41 66 50 C66 61 59 70 50 82 C41 70 34 61 34 50 C34 41 38 32 50 18 Z" fill="#ffffff"/></svg>`,
    gold: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M42 16 H58 L62 56 H38 Z" fill="#d4aa4a"/><rect x="40" y="56" width="20" height="9" rx="3" fill="#fff4cf"/><rect x="31" y="76" width="38" height="8" rx="4" fill="#1c2743"/></svg>`,
    ofc: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="36" fill="#1a3d63"/><path d="M27 61 C34 41 46 30 63 24 C59 35 64 48 76 57 C59 60 45 69 38 80 C35 73 31 67 27 61 Z" fill="#90d5ff"/></svg>`,
    cup: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M35 20 H65 L61 48 C59 61 53 69 50 76 C47 69 41 61 39 48 Z" fill="#d5ae58"/><path d="M28 28 C17 28 17 46 33 50" stroke="#173259" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M72 28 C83 28 83 46 67 50" stroke="#173259" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="34" y="79" width="32" height="8" rx="4" fill="#173259"/></svg>`,
    sc: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="36" fill="#162845"/><path d="M50 18 L59 40 L83 40 L63 55 L71 80 L50 66 L29 80 L37 55 L17 40 L41 40 Z" fill="#d5ae58"/></svg>`,
    default: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="36" fill="#18304c"/><path d="M50 17 L61 39 L85 42 L67 58 L72 82 L50 70 L28 82 L33 58 L15 42 L39 39 Z" fill="#58a4ff"/></svg>`
  };
  return svg[kind] || svg.default;
}

export function competitionEmblem(id, size = 'md') {
  const meta = competitionMeta(id);
  return `<span class="competition-emblem competition-emblem-${size} emblem-${meta.kind}" title="${meta.label}"><span class="competition-emblem-core">${emblemSvg(meta.kind)}</span></span>`;
}
