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
  'Galatasaray':'galatasaray','Fenerbahçe':'fenerbahce','Beşiktaş':'besiktas-jk','Trabzonspor':'trabzonspor','Celtic':'celtic-fc','Rangers':'rangers-fc'
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
  UCL:['✦','Champions','#102f62','#d8b75d'], UEL:['◇','Europa','#ec7b18','#0f172a'], UECL:['◉','Conference','#31b35b','#111827'],
  LIB:['♜','Libertadores','#d9b75b','#10233f'], SUD:['◆','Sudamericana','#4787c7','#13243b'], CCC:['✹','Champions Cup','#db4b4b','#12325a'],
  ACL:['✦','Asia','#54a6dc','#102f62'], CAFCL:['✦','Africa','#d9b75b','#1d3428'], OFCCL:['✦','Oceania','#2d83c6','#10233f'],
  WC:['◍','World Cup','#d9b75b','#172033'], CWC:['◎','Club World','#d9b75b','#172033'], INTERCONT:['◈','Intercontinental','#d9b75b','#172033'],
  EURO:['✦','Euro','#3578d4','#142542'], COPA:['◉','Copa América','#61b1dd','#163a61'], AFCON:['◆','AFCON','#d59a3b','#223925'], ASIANCUP:['◇','Asian Cup','#34a1cc','#173448'], GOLD:['★','Gold Cup','#d9b75b','#263144'], OFC:['◍','Oceania','#42a7d4','#18344e']
};

export function competitionEmblem(id, size = 'md') {
  const key = String(id || '').replace(/^CUP-|^SC-/, '');
  let style = COMP_STYLE[id];
  if (!style) {
    if (String(id).startsWith('CUP-')) style = ['♜','Cup','#d9b75b','#1b2d44'];
    else if (String(id).startsWith('SC-')) style = ['✦','Super Cup','#d9b75b','#1b2d44'];
    else style = ['◈','Competition','#4d9df3','#16283d'];
  }
  return `<span class="competition-emblem competition-emblem-${size}" style="--emblem-accent:${style[2]};--emblem-bg:${style[3]}" title="${style[1]}"><b>${style[0]}</b></span>`;
}
