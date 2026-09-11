const ELITE_RARITIES = new Set(['epic', 'legend', 'generational']);

const COUNTRY_SLUG = {
  'England':'england','Scotland':'scotland','Wales':'wales','Spain':'spain','Italy':'italy','Germany':'germany','France':'france','Portugal':'portugal','Netherlands':'netherlands','Belgium':'belgium','Turkey':'turkiye','Greece':'greece','Austria':'austria','Switzerland':'switzerland','Denmark':'denmark','Norway':'norway','Sweden':'sweden','Poland':'poland','Croatia':'croatia','Serbia':'serbia','Czech Republic':'czech-republic','Ukraine':'ukraine','Russia':'russia','Romania':'romania','Hungary':'hungary',
  'Argentina':'argentina','Brazil':'brazil','Uruguay':'uruguay','Colombia':'colombia','Chile':'chile','Ecuador':'ecuador','Peru':'peru','Paraguay':'paraguay',
  'Mexico':'mexico','United States':'usa','Canada':'canada','Costa Rica':'costa-rica',
  'Japan':'japan','South Korea':'south-korea','China':'china','Saudi Arabia':'saudi-arabia','Qatar':'qatar','Australia':'australia',
  'Egypt':'egypt','Morocco':'morocco','Nigeria':'nigeria','South Africa':'south-africa','Tunisia':'tunisia','Algeria':'algeria'
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
  'Al Hilal':'Al_Hilal', 'Al Nassr':'Al_Nassr', 'Al Ittihad':'Al_Ittihad'
};

const REAL_LOGO_COUNTRIES = new Set(Object.keys(COUNTRY_SLUG));

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
  const mena = new Set(['Morocco','Algeria','Tunisia','Egypt','Saudi Arabia','Qatar','United Arab Emirates','Jordan','Iraq','Iran','Syria','Lebanon','Israel','Turkey']);
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

const SKINS = {
  european: ['#f4c9aa','#efbd9d','#e8ae8b','#f2d0b6'],
  latin: ['#e5a47d','#d99369','#efba94','#c9805d'],
  black: ['#7c482f','#8f5438','#653923','#a66545'],
  mena: ['#d99a73','#c7835f','#e6ad86','#b66f4f'],
  eastAsian: ['#efbd9f','#f3c9ad','#e6ac8e','#f0bea0'],
  southAsian: ['#bd7653','#cf8c66','#aa6547','#d79a74'],
  mixed: ['#c98363','#d99c78','#a9694d','#e0a785']
};
const HAIRS = ['#111827','#1f2937','#2f211b','#4a2e23','#5b3528','#6d4c41','#c89b62','#d7b36b','#e2c7a0','#7f1d1d'];
const EYES = ['#243447','#3a2a1f','#315d76','#395b3b','#6a4b2f','#191919'];
const JERSEYS = ['#0b4ea2','#ffffff','#c81d25','#18181b','#16a34a','#f3c438','#6d28d9','#0891b2','#7f1d1d','#f97316'];

function hairPath(style) {
  const paths = [
    'M20 31 Q20 12 42 11 Q65 11 65 31 L59 25 L55 35 L50 23 L44 33 L38 21 L31 32 L27 22 Z',
    'M19 33 Q20 12 41 10 Q62 9 66 30 Q58 22 53 27 Q48 17 42 29 Q36 17 30 29 Q25 22 19 33 Z',
    'M18 32 Q17 17 31 12 Q45 4 61 15 Q69 22 64 36 Q59 24 49 20 Q36 18 24 34 Z',
    'M18 34 Q22 10 43 12 Q64 12 67 34 L59 26 L54 37 L48 24 L42 35 L35 23 L28 36 Z',
    'M20 33 Q20 15 40 11 Q58 9 66 25 L60 34 Q57 23 52 30 Q48 20 43 31 Q37 19 31 31 Q26 23 20 33 Z',
    'M18 34 Q21 13 42 10 Q64 12 67 32 Q61 27 57 19 Q49 24 42 18 Q35 26 27 20 Q24 29 18 34 Z'
  ];
  return paths[style % paths.length];
}

function portraitSvg(entity, kind = 'player', size = 'md') {
  const elite = ELITE_RARITIES.has(entity?.rarity);
  const poolSize = kind === 'coach' ? (elite ? 50 : 12) : (elite ? 200 : 24);
  const baseSeed = hash(entity?.id || entity?.name || Math.random());
  const poolIndex = baseSeed % poolSize;
  const seed = hash(`${kind}-${poolIndex}`);
  const group = groupForCountry(entity?.nationalityName || entity?.nationality || '', seed);
  const skin = pick(SKINS[group] || SKINS.european, seed, 1);
  const hair = pick(HAIRS, seed, 2);
  const eye = pick(EYES, seed, 3);
  const jersey = pick(JERSEYS, seed, 4);
  const hairStyle = seed % 6;
  const beard = kind === 'coach' ? seed % 4 !== 0 : seed % 13 === 0;
  const grey = kind === 'coach' && seed % 3 === 0;
  const glasses = kind === 'coach' && seed % 5 === 0;
  const hairColor = grey ? pick(['#d7dce2','#aeb7c1','#7d8792'], seed, 5) : hair;
  const rarityClass = entity?.rarity ? ` rarity-${entity.rarity}` : '';
  const sizeClass = ` avatar-${size}`;
  const ageLines = kind === 'coach' ? `<path d="M28 45 q5 3 10 0 M47 45 q5 3 10 0" stroke="#8b5d49" stroke-width=".7" opacity=".45" fill="none"/>` : '';
  const beardShape = beard ? `<path d="M28 52 Q42 66 56 52 Q54 68 42 70 Q29 67 28 52Z" fill="${hairColor}" opacity=".78"/>` : '';
  const glassesShape = glasses ? `<g fill="none" stroke="#1f2937" stroke-width="1.8"><rect x="24" y="37" width="13" height="9" rx="4"/><rect x="47" y="37" width="13" height="9" rx="4"/><path d="M37 40 H47"/></g>` : '';
  const suit = kind === 'coach'
    ? `<path d="M13 84 Q15 68 29 62 L42 76 L55 62 Q69 68 71 84Z" fill="#111827"/><path d="M36 64 L42 76 L48 64 L45 84 H39Z" fill="#d9e3f0"/><path d="M40 67 H44 L46 82 H38Z" fill="#b89037"/>`
    : `<path d="M12 84 Q15 66 29 62 Q42 70 55 62 Q69 66 72 84Z" fill="${jersey}"/><path d="M32 63 Q42 72 52 63" fill="none" stroke="#ffffff" stroke-width="3" opacity=".7"/>`;
  const svg = `<svg viewBox="0 0 84 84" aria-hidden="true" focusable="false">
    <defs><linearGradient id="bg${poolIndex}${kind}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#17365e"/><stop offset=".55" stop-color="#0b1f38"/><stop offset="1" stop-color="#07111f"/></linearGradient></defs>
    <rect width="84" height="84" rx="18" fill="url(#bg${poolIndex}${kind})"/>
    <circle cx="68" cy="16" r="20" fill="#3b82f6" opacity=".14"/><path d="M-4 70 Q24 45 88 58" stroke="#d9b65b" stroke-width="2" opacity=".25" fill="none"/>
    ${suit}
    <rect x="36" y="55" width="12" height="15" rx="5" fill="${skin}"/>
    <ellipse cx="42" cy="39" rx="22" ry="27" fill="${skin}"/>
    <path d="${hairPath(hairStyle)}" fill="${hairColor}"/>
    <path d="M24 31 Q18 39 23 48" fill="none" stroke="${skin}" stroke-width="5" stroke-linecap="round"/><path d="M60 31 Q66 39 61 48" fill="none" stroke="${skin}" stroke-width="5" stroke-linecap="round"/>
    <path d="M28 36 Q34 31 39 36 M45 36 Q51 31 57 36" stroke="${hairColor}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <ellipse cx="34" cy="40" rx="3.2" ry="4.4" fill="#fff"/><ellipse cx="50" cy="40" rx="3.2" ry="4.4" fill="#fff"/><circle cx="34.4" cy="40.2" r="1.8" fill="${eye}"/><circle cx="49.6" cy="40.2" r="1.8" fill="${eye}"/><circle cx="35" cy="39.5" r=".65" fill="#fff"/><circle cx="50.2" cy="39.5" r=".65" fill="#fff"/>
    <path d="M42 42 Q40 48 43 49" stroke="#a66f58" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M34 54 Q42 ${kind === 'coach' ? 58 : 60} 50 54" stroke="#9f4d50" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${beardShape}${ageLines}${glassesShape}
    <circle cx="72" cy="70" r="8" fill="#0a1423" opacity=".75"/><text x="72" y="73" text-anchor="middle" font-family="Arial, sans-serif" font-size="7" font-weight="700" fill="#e6bf5d">${poolIndex + 1}</text>
  </svg>`;
  return `<span class="anime-avatar ${kind}-avatar${rarityClass} ${sizeClass}" data-avatar-pool="${poolIndex}" title="${kind === 'coach' ? 'Coach' : 'Player'} portrait #${poolIndex + 1}">${svg}</span>`;
}

export function playerPortrait(player, nationalityName, size = 'md') {
  return portraitSvg({ ...player, nationalityName }, 'player', size);
}

export function coachPortrait(coach, nationalityName, size = 'md') {
  return portraitSvg({ ...coach, nationalityName }, 'coach', size);
}

export function clubLogoUrl(club) {
  if (!club || !REAL_LOGO_COUNTRIES.has(club.country)) return '';
  if ((club.baseStrength ?? club.strength ?? 0) < 72) return '';
  const folder = COUNTRY_SLUG[club.country];
  if (!folder) return '';
  const filename = LOGO_ALIASES[club.name] || String(club.name).replace(/[./]/g, '').replace(/\s+/g, '_');
  return `https://raw.githubusercontent.com/JoseArroyave/football-logos/refs/heads/main/logos/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}.svg`;
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
