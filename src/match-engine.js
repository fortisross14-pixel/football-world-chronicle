// Minute-by-minute match engine.
//
// A match is played in ten-minute slices (five-minute slices before half-time and
// full-time carry stoppage time). In every slice each side's chance rate
// comes from its kickoff expectation (quality, home edge, coach and competition
// context, worked out by the caller) adjusted by what is happening now: who is on
// the pitch, fatigue, red cards, substitutions, the scoreline and the clock.
// Every shot, goal, card, substitution and save is a real event with a minute and a
// player, and match ratings are built from those events.
//
// The module is pure: all randomness comes from the injected rng() so a seeded
// world replays identically.

const BASE_CONVERSION = 0.098;

// start: first minute (exclusive), length: minutes, rate: relative scoring rate
// (goals rise through each half; stoppage slices are short but busy), cards:
// relative booking rate, stoppage: the minute stoppage time is added to.
const REGULATION = [
  { start: 0, length: 10, rate: 0.81, cards: 0.42 },
  { start: 10, length: 10, rate: 0.89, cards: 0.65 },
  { start: 20, length: 10, rate: 0.95, cards: 0.82 },
  { start: 30, length: 10, rate: 0.99, cards: 0.92 },
  { start: 40, length: 5, rate: 1.26, cards: 1.15, stoppage: 45, maxAdded: 3 },
  { start: 45, length: 10, rate: 0.97, cards: 0.95 },
  { start: 55, length: 10, rate: 1.01, cards: 1.08 },
  { start: 65, length: 10, rate: 1.05, cards: 1.18 },
  { start: 75, length: 10, rate: 1.09, cards: 1.28 },
  { start: 85, length: 5, rate: 1.38, cards: 1.5, stoppage: 90, maxAdded: 5 }
];
const EXTRA = [
  { start: 90, length: 10, rate: 0.83, cards: 1.3, extra: true },
  { start: 100, length: 5, rate: 0.92, cards: 1.35, extra: true, stoppage: 105, maxAdded: 2 },
  { start: 105, length: 10, rate: 0.86, cards: 1.35, extra: true },
  { start: 115, length: 5, rate: 1.02, cards: 1.4, extra: true, stoppage: 120, maxAdded: 2 }
];
// Share of a 90-minute expectation played in each slice (regulation adds up to 1).
const REGULATION_WEIGHT = REGULATION.reduce((sum, slice) => sum + slice.length * slice.rate, 0);
for (const slice of [...REGULATION, ...EXTRA]) slice.weight = slice.length * slice.rate / REGULATION_WEIGHT;
const REGULATION_SLICES = REGULATION.length;
const SLICES = [...REGULATION, ...EXTRA];

export const STYLE_PROFILES = {
  defensive_rock: { volume: 0.88, concede: 0.82, possession: -8, protect: 1.45, push: 0.8, drain: 0.95, cards: 0.95, bigChance: 0.13 },
  counter_attack: { volume: 0.93, concede: 0.92, possession: -7, protect: 1.15, push: 1.0, drain: 1.0, cards: 1.03, bigChance: 0.17 },
  pressing: { volume: 1.08, concede: 1.0, possession: 4, protect: 0.9, push: 1.2, drain: 1.16, cards: 1.18, bigChance: 0.14 },
  possession: { volume: 0.98, concede: 0.99, possession: 7, protect: 1.0, push: 1.0, drain: 0.98, cards: 0.85, bigChance: 0.145 },
  direct: { volume: 1.15, concede: 1.03, possession: -5, protect: 0.8, push: 1.25, drain: 1.05, cards: 1.08, bigChance: 0.12 },
  pragmatist: { volume: 0.95, concede: 0.9, possession: -2, protect: 1.25, push: 0.95, drain: 0.98, cards: 0.96, bigChance: 0.14 },
  tournament_expert: { volume: 0.98, concede: 0.93, possession: 0, protect: 1.15, push: 1.05, drain: 0.98, cards: 0.94, bigChance: 0.14 },
  adaptive: { volume: 1.0, concede: 0.96, possession: 2, protect: 1.05, push: 1.05, drain: 1.0, cards: 0.97, bigChance: 0.14 },
  youth_developer: { volume: 1.02, concede: 1.02, possession: 3, protect: 0.95, push: 1.05, drain: 1.0, cards: 1.0, bigChance: 0.14 },
  motivator: { volume: 1.02, concede: 0.98, possession: 0, protect: 1.0, push: 1.15, drain: 1.0, cards: 1.02, bigChance: 0.14 }
};
const NEUTRAL_STYLE = { volume: 1, concede: 1, possession: 0, protect: 1, push: 1, drain: 1, cards: 1, bigChance: 0.14 };

// Tactical matchups, rock-paper-scissors style. Each core style beats two styles,
// loses to two and is neutral to the last:
//   possession  beats direct, counter_attack     · loses to defensive_rock, pressing
//   pressing    beats possession, pragmatist     · loses to counter_attack, direct
//   counter     beats pressing, defensive_rock   · loses to possession, pragmatist
//   def. rock   beats possession, direct         · loses to counter_attack, pragmatist
//   direct      beats pressing, pragmatist       · loses to possession, defensive_rock
//   pragmatist  beats counter_attack, def. rock  · loses to pressing, direct
// Coaches whose identity is not a playing style lean towards one at half strength;
// an adaptive coach reads the opponent and gains a small edge against everyone.
export const STYLE_BEATS = {
  possession: ['direct', 'counter_attack'],
  pressing: ['possession', 'pragmatist'],
  counter_attack: ['pressing', 'defensive_rock'],
  defensive_rock: ['possession', 'direct'],
  direct: ['pressing', 'pragmatist'],
  pragmatist: ['counter_attack', 'defensive_rock']
};
export const STYLE_LEANS = { tournament_expert: 'pragmatist', youth_developer: 'pressing', motivator: 'direct' };
const MATCHUP_EDGE = 0.075;
const ADAPTIVE_EDGE = 0.02;

function coreStyle(style) {
  if (STYLE_BEATS[style]) return { style, weight: 1 };
  if (STYLE_LEANS[style]) return { style: STYLE_LEANS[style], weight: 0.5 };
  return null;
}

// Chance multiplier for a side playing `own` against `opponent`.
export function styleMatchup(own, opponent) {
  if (own === 'adaptive') return opponent === 'adaptive' ? 1 : 1 + ADAPTIVE_EDGE;
  if (opponent === 'adaptive') return 1 - ADAPTIVE_EDGE;
  const a = coreStyle(own), b = coreStyle(opponent);
  if (!a || !b || a.style === b.style) return 1;
  const weight = Math.min(a.weight, b.weight) === 1 ? 1 : a.weight * b.weight === 0.25 ? 0.35 : 0.5;
  if (STYLE_BEATS[a.style].includes(b.style)) return 1 + MATCHUP_EDGE * weight;
  if (STYLE_BEATS[b.style].includes(a.style)) return 1 - MATCHUP_EDGE * 0.85 * weight;
  return 1;
}

// For the UI: which styles a coach's approach is strong and weak against.
export function styleMatchupSummary(style) {
  const all = [...Object.keys(STYLE_BEATS), ...Object.keys(STYLE_LEANS), 'adaptive'];
  const strong = all.filter((other) => other !== style && styleMatchup(style, other) > 1.005);
  const weak = all.filter((other) => other !== style && styleMatchup(style, other) < 0.995);
  return { strong, weak };
}

const ATTACK_WEIGHT = { GK: 0, DF: 0.2, MF: 0.65, FW: 1.0 };
const DEFENCE_WEIGHT = { GK: 1.3, DF: 1.0, MF: 0.45, FW: 0.08 };
const CONTROL_WEIGHT = { GK: 0.05, DF: 0.45, MF: 1.0, FW: 0.4 };
const CARD_WEIGHT = { GK: 0.12, DF: 1.3, MF: 1.25, FW: 0.75 };
const TACKLE_RATE = { GK: 0, DF: 2.3, MF: 1.7, FW: 0.45 };

const MAN_FOR = Array.from({ length: 12 }, (_, count) => (count / 11) ** 2.6);
const MAN_AGAINST = Array.from({ length: 12 }, (_, count) => (11 / Math.max(7, count)) ** 2.9);

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function poisson(rng, mean) {
  if (mean <= 0) return 0;
  const limit = Math.exp(-mean);
  let product = rng();
  let count = 0;
  while (product > limit && count < 30) { count += 1; product *= rng(); }
  return count;
}

function newEntry(source, started, minute) {
  return {
    source,
    id: source.id || null,
    line: source.line,
    slotType: source.slotType || null,
    effective: source.effective,
    rating: source.rating,
    goalW: source.goalW > 0.001 ? source.goalW : 0.001,
    assistW: source.assistW > 0.001 ? source.assistW : 0.001,
    defendW: source.defendW || 1,
    penalty: source.penalty || source.rating,
    cardProne: source.cardProne || 1,
    injuryProne: source.injuryProne || 1,
    bigGame: source.bigGame || 0,
    clutch: source.clutch || 0,
    form: source.form || 0,
    energy: source.fitness ?? 100,
    started,
    on: minute,
    off: null,
    yellow: 0,
    red: false,
    injured: false,
    goals: 0, assists: 0, shots: 0, onTarget: 0, keyPasses: 0, bigMissed: 0,
    saves: 0, bigSaves: 0, blocks: 0, tackles: 0, mistakes: 0, penScored: 0, penMissed: 0,
    conceded: 0, rating: source.rating
  };
}

function freshEffective(entry) {
  const tired = entry.energy >= 92 ? 0 : (92 - entry.energy) * 0.16;
  return entry.effective - tired;
}

function computeUnits(team) {
  let attack = 0, attackW = 0, defence = 0, defenceW = 0, control = 0, controlW = 0, energy = 0;
  for (const entry of team.onPitch) {
    const value = entry.effective;
    const a = ATTACK_WEIGHT[entry.line] ?? 0.5, d = DEFENCE_WEIGHT[entry.line] ?? 0.5, c = CONTROL_WEIGHT[entry.line] ?? 0.5;
    attack += value * a; attackW += a;
    defence += value * d; defenceW += d;
    control += value * c; controlW += c;
    energy += entry.energy;
  }
  team.attack = attackW ? attack / attackW : 60;
  team.defence = defenceW ? defence / defenceW : 60;
  team.control = controlW ? control / controlW : 60;
  team.energy = team.onPitch.length ? energy / team.onPitch.length : 80;
  team.goalTotal = -1;
  team.assistTotal = -1;
  if (team.attack0 !== undefined) {
    team.attackFactor = Math.exp((team.attack - team.attack0) / 13);
    team.defenceFactor = Math.exp(-(team.defence - team.defence0) / 13);
  }
}

function goalkeeperOf(team) {
  for (const entry of team.onPitch) if (entry.line === 'GK') return entry;
  return null;
}

function pickShooter(rng, team) {
  const entries = team.onPitch;
  let total = team.goalTotal;
  if (total < 0) {
    total = 0;
    for (let index = 0; index < entries.length; index += 1) total += entries[index].goalW;
    team.goalTotal = total;
  }
  let needle = rng() * total;
  for (let index = 0; index < entries.length; index += 1) {
    needle -= entries[index].goalW;
    if (needle <= 0) return entries[index];
  }
  return entries[entries.length - 1] || null;
}

function pickAssister(rng, team, shooter) {
  const entries = team.onPitch;
  let total = team.assistTotal;
  if (total < 0) {
    total = 0;
    for (let index = 0; index < entries.length; index += 1) total += entries[index].assistW;
    team.assistTotal = total;
  }
  total -= shooter.assistW;
  if (total <= 0) return null;
  let needle = rng() * total;
  let last = null;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry === shooter) continue;
    last = entry;
    needle -= entry.assistW;
    if (needle <= 0) return entry;
  }
  return last;
}

function weightedBy(rng, entries, weightFn) {
  let total = 0;
  const weights = new Array(entries.length);
  for (let index = 0; index < entries.length; index += 1) { weights[index] = Math.max(0.001, weightFn(entries[index])); total += weights[index]; }
  let needle = rng() * total;
  for (let index = 0; index < entries.length; index += 1) { needle -= weights[index]; if (needle <= 0) return entries[index]; }
  return entries[entries.length - 1] || null;
}

function eventMinute(rng, slice) {
  const info = SLICES[slice];
  const minute = info.start + 1 + Math.floor(rng() * info.length);
  if (info.stoppage && rng() < (info.extra ? 0.18 : 0.32)) return { minute: info.stoppage, added: 1 + Math.floor(rng() * info.maxAdded) };
  return { minute, added: 0 };
}

function conversionFactor(team, opponent) {
  // Expected conversion of this side's shots against this opponent, relative to the
  // league baseline. Shot volume is divided by it so the kickoff expectation holds and
  // finishing quality decides who scores rather than inflating totals twice.
  const keeper = goalkeeperOf(opponent);
  const keeperQuality = keeper ? freshEffective(keeper) : opponent.defence - 4;
  let total = 0, weight = 0;
  for (const entry of team.onPitch) {
    const w = entry.goalW > 0 ? entry.goalW : 0.001;
    const quality = freshEffective(entry);
    const accuracy = clamp(1 + (quality - opponent.defence) * 0.008, 0.75, 1.25);
    const finish = clamp(1 + (quality - keeperQuality) * 0.006, 0.8, 1.2);
    total += w * accuracy * finish; weight += w;
  }
  return weight ? clamp(total / weight, 0.6, 1.5) : 1;
}

function buildTeam(input, side) {
  const team = {
    side,
    input,
    teamId: input.teamId,
    style: STYLE_PROFILES[input.style] || NEUTRAL_STYLE,
    styleId: input.style || null,
    lambda0: input.lambda,
    onPitch: input.xi.map((source) => newEntry(source, true, 0)),
    bench: input.bench.map((source) => newEntry(source, false, null)),
    maxSubs: input.maxSubs ?? Math.min(4, input.bench.length),
    subsUsed: 0,
    tacticalSubs: 0,
    goals: 0,
    shots: 0, onTarget: 0, corners: 0, yellow: 0, red: 0, xg: 0,
    possessionSum: 0,
    sentOff: 0,
    convFactor: 1,
    // Declared up front so the object keeps one shape for the whole match.
    all: null,
    attack: 0, defence: 0, control: 0, energy: 100,
    attack0: undefined, defence0: undefined, control0: undefined,
    attackFactor: 1, defenceFactor: 1,
    goalTotal: -1, assistTotal: -1,
    baseRate: 0,
    dirty: false,
    injuredPending: false
  };
  team.all = [...team.onPitch];
  computeUnits(team);
  team.attack0 = team.attack;
  team.defence0 = team.defence;
  team.control0 = team.control;
  return team;
}

function benchCandidate(team, lines, preferAttack = false) {
  let best = null, bestValue = -Infinity;
  for (const entry of team.bench) {
    if (entry.on !== null) continue;
    const linePenalty = lines.includes(entry.line) ? 0 : 12;
    const value = entry.rating - linePenalty + (preferAttack ? entry.goalW * 0.4 : 0);
    if (value > bestValue) { bestValue = value; best = entry; }
  }
  return best;
}

function substitute(team, outgoing, incoming, minute, added, reason, events) {
  const index = team.onPitch.indexOf(outgoing);
  if (index < 0 || !incoming) return false;
  outgoing.off = minute;
  incoming.on = minute;
  incoming.slotType = outgoing.slotType;
  // A substitute inherits the slot; their rating there depends on line match.
  if (incoming.line !== outgoing.line && incoming.line !== 'GK' && outgoing.line !== 'GK') incoming.effective = incoming.rating - 9;
  team.onPitch[index] = incoming;
  team.all.push(incoming);
  team.subsUsed += 1;
  events.subs.push({ side: team.side, minute, added: added || undefined, outId: outgoing.id, inId: incoming.id, reason });
  return true;
}

function manageTeam(team, opponent, slice, minute, diff, rng, events, extraTime) {
  // Forced changes first: injured players come off whenever a substitute is left.
  const injuries = team.injuredPending ? team.onPitch.filter((entry) => entry.injured && entry.off === null) : [];
  team.injuredPending = false;
  for (const entry of injuries) {
    if (team.subsUsed < team.maxSubs) {
      const incoming = entry.line === 'GK' ? benchCandidate(team, ['GK']) : benchCandidate(team, [entry.line]);
      if (incoming && substitute(team, entry, incoming, minute, 0, 'injury', events)) continue;
    }
    // No substitute: the side continues a player short.
    entry.off = minute;
    team.onPitch.splice(team.onPitch.indexOf(entry), 1);
  }
  if (minute < 46 || team.subsUsed >= team.maxSubs) return;
  const late = minute >= 60;
  // Chasing the game: a forward or attacking midfielder for a defender or holding player.
  if (diff < 0 && late && team.tacticalSubs < 2 && rng() < 0.42 * team.style.push) {
    const incoming = benchCandidate(team, ['FW', 'MF'], true);
    const outgoing = [...team.onPitch].filter((entry) => entry.line === 'DF' || entry.slotType === 'DM')
      .sort((a, b) => a.goalW - b.goalW || a.energy - b.energy)[0];
    if (incoming && outgoing && incoming.goalW > outgoing.goalW) {
      if (substitute(team, outgoing, incoming, minute, 0, 'tactical', events)) { team.tacticalSubs += 1; return; }
    }
  }
  // Protecting a narrow lead late on: a defender or midfielder for a forward.
  if (diff === 1 && minute >= 72 && team.tacticalSubs < 2 && rng() < 0.34 * team.style.protect) {
    const incoming = benchCandidate(team, ['DF', 'MF']);
    const outgoing = [...team.onPitch].filter((entry) => entry.line === 'FW').sort((a, b) => a.energy - b.energy)[0];
    if (incoming && outgoing) {
      if (substitute(team, outgoing, incoming, minute, 0, 'tactical', events)) { team.tacticalSubs += 1; return; }
    }
  }
  // Fatigue and planned changes: the most tired outfield player makes way for a fresh
  // one in the same line. One substitution is held back for injuries until late on.
  const planned = extraTime ? 0.45 : minute < 55 ? 0.07 : minute < 65 ? 0.4 : minute < 75 ? 0.62 : minute < 85 ? 0.66 : 0.32;
  const reserve = minute < 80 && !extraTime ? 1 : 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (team.subsUsed >= team.maxSubs - reserve) return;
    let tired = null;
    for (const entry of team.onPitch) {
      if (entry.line === 'GK' || entry.on > 0) continue;
      if (!tired || entry.energy < tired.energy) tired = entry;
    }
    if (!tired) return;
    const urgency = clamp(planned * (attempt ? 0.45 : 1) + (80 - tired.energy) * 0.03, 0, 0.9);
    if (urgency <= 0 || rng() >= urgency) return;
    const incoming = benchCandidate(team, [tired.line]);
    if (!incoming || !substitute(team, tired, incoming, minute, 0, 'fatigue', events)) return;
  }
}

export function gameStateFactors(team, diff, minute, legStakes) {
  // Returns [own chance multiplier, multiplier applied to the opponent's chances].
  const late = clamp((minute - 50) / 40, 0, 1) * legStakes;
  // Level late on, both sides start to value the point they have.
  if (diff === 0) return minute >= 55 ? [0.82, 0.92] : [1, 1];
  if (!late) return [1, 1];
  if (diff > 0) {
    const protect = late * (diff === 1 ? 1 : diff === 2 ? 0.55 : 0.2) * team.style.protect;
    return [1 - 0.3 * protect, 1 - 0.18 * protect];
  }
  const push = late * (diff === -1 ? 1 : diff === -2 ? 0.65 : 0.2) * team.style.push;
  return [1 + 0.28 * push, 1 + 0.2 * push];
}

function playSlice(match, slice, rng) {
  const { home, away, events } = match;
  const info = SLICES[slice];
  const extraTime = Boolean(info.extra);
  const minute = info.start;
  const weight = info.weight;
  const teams = [home, away];
  const aggregate = match.aggregate;

  // Bench decisions happen at the start of a slice (half-time is slice 9).
  for (let index = 0; index < 2; index += 1) {
    const team = teams[index], opponent = teams[1 - index];
    const own = team.goals + (aggregate ? aggregate[team.side] : 0);
    const other = opponent.goals + (aggregate ? aggregate[opponent.side] : 0);
    if (minute >= 45 || team.injuredPending) {
      const before = team.subsUsed;
      const onBefore = team.onPitch.length;
      manageTeam(team, opponent, slice, minute === 45 ? 46 : minute + 1, own - other, rng, events, extraTime);
      if (team.subsUsed !== before || team.onPitch.length !== onBefore) team.dirty = true;
    }
  }
  if (home.dirty || away.dirty) {
    if (home.dirty) computeUnits(home);
    if (away.dirty) computeUnits(away);
    home.dirty = false; away.dirty = false;
    home.convFactor = conversionFactor(home, away);
    away.convFactor = conversionFactor(away, home);
  }

  // Possession for this slice.
  const homeStateDiff = home.goals - away.goals + (aggregate ? aggregate.home - aggregate.away : 0);
  const chase = minute >= 55 ? clamp(-homeStateDiff, -2, 2) * 3.5 : 0;
  const possession = clamp(50 + (home.control - away.control) * 0.42 + home.style.possession - away.style.possession
    + match.possessionNoise + chase + (home.onPitch.length - away.onPitch.length) * 4, 24, 76);
  home.possessionSum += possession * info.length;
  if (match.detail) match.possessionSlices.push([info.start + info.length, Math.round(possession)]);
  away.possessionSum += (100 - possession) * info.length;

  const states = match.stateScratch;
  states[0] = gameStateFactors(home, homeStateDiff, minute, match.legStakes);
  states[1] = gameStateFactors(away, -homeStateDiff, minute, match.legStakes);

  for (let index = 0; index < 2; index += 1) {
    const team = teams[index], opponent = teams[1 - index];
    if (!team.onPitch.length) continue;
    const manFor = MAN_FOR[team.onPitch.length] ?? 1;
    const manAgainst = MAN_AGAINST[opponent.onPitch.length] ?? 1;
    const fatigueEdge = 1 + (team.energy - opponent.energy) * 0.006;
    const share = (index === 0 ? possession : 100 - possession) / 50;
    const lambda = team.baseRate * team.attackFactor * opponent.defenceFactor
      * manFor * manAgainst * fatigueEdge
      * states[index][0] * states[1 - index][1]
      * weight * (0.88 + share * 0.12);
    const shotMean = lambda / (BASE_CONVERSION * team.convFactor);
    const shots = poisson(rng, shotMean);
    for (let shot = 0; shot < shots; shot += 1) resolveShot(match, team, opponent, slice, rng);
    // Corners from pressure that did not produce a shot.
    if (rng() < 0.28 * share * info.length / 10) addCorner(match, team, eventMinute(rng, slice).minute);
    resolveDiscipline(match, team, opponent, slice, rng);
  }

  // Energy drains through the slice; pressing sides tire faster.
  for (const team of teams) {
    const drain = 0.27 * info.length * team.style.drain * (extraTime ? 1.25 : 1);
    let energy = 0;
    for (const entry of team.onPitch) {
      entry.energy = Math.max(30, entry.energy - drain * (entry.line === 'GK' ? 0.35 : 1));
      energy += entry.energy;
    }
    team.energy = team.onPitch.length ? energy / team.onPitch.length : 80;
  }
}

function resolveShot(match, team, opponent, slice, rng) {
  const shooter = pickShooter(rng, team);
  if (!shooter) return;
  const keeper = goalkeeperOf(opponent);
  const quality = freshEffective(shooter);
  const keeperQuality = keeper ? freshEffective(keeper) : opponent.defence - 8;
  const big = rng() < team.style.bigChance * (1 + shooter.bigGame * match.bigGameStakes);
  const penalty = big && rng() < 0.09;
  const time = eventMinute(rng, slice);
  team.shots += 1;
  shooter.shots += 1;
  let taker = shooter;
  if (penalty) {
    // The designated taker steps up.
    taker = team.onPitch.reduce((best, entry) => (entry.penalty > (best?.penalty ?? -1) && entry.line !== 'GK' ? entry : best), null) || shooter;
    if (taker !== shooter) { shooter.shots -= 1; taker.shots += 1; }
    const chance = clamp(0.77 + (taker.penalty - 75) * 0.003 - (keeperQuality - 75) * 0.0025, 0.6, 0.92);
    team.xg += 0.76;
    if (rng() < chance) {
      team.onTarget += 1; taker.onTarget += 1; taker.penScored += 1;
      scoreGoal(match, team, opponent, taker, null, time, slice, rng, { penalty: true });
    } else {
      taker.penMissed += 1;
      const saved = rng() < 0.6;
      if (saved && keeper) { team.onTarget += 1; taker.onTarget += 1; keeper.saves += 1; keeper.bigSaves += 1; }
      match.events.keyChances.push({ side: team.side, minute: time.minute, added: time.added || undefined, playerId: taker.id, outcome: saved ? 'penalty-saved' : 'penalty-missed', keeperId: saved ? keeper?.id ?? null : undefined });
      if (match.detail) match.timeline.push([time.minute, saved ? 't' : 's', team.side, taker.id]);
    }
    return;
  }
  const accuracy = clamp((big ? 0.6 : 0.3) * (1 + (quality - opponent.defence) * 0.008), 0.12, 0.82);
  const finish = clamp((big ? 0.62 : 0.21) * (1 + (quality - keeperQuality) * 0.006), 0.06, 0.88);
  team.xg += accuracy * finish;
  const assister = rng() < (big ? 0.82 : 0.55) ? pickAssister(rng, team, shooter) : null;
  if (assister) assister.keyPasses += 1;
  if (rng() < accuracy) {
    team.onTarget += 1;
    shooter.onTarget += 1;
    if (rng() < finish) {
      scoreGoal(match, team, opponent, shooter, assister, time, slice, rng, { bigChance: big });
      return;
    }
    if (keeper) { keeper.saves += 1; if (big) keeper.bigSaves += 1; }
    if (big) {
      shooter.bigMissed += 1;
      match.events.keyChances.push({ side: team.side, minute: time.minute, added: time.added || undefined, playerId: shooter.id, outcome: 'saved', keeperId: keeper?.id ?? null });
    }
    if (match.detail) match.timeline.push([time.minute, 't', team.side, shooter.id]);
    if (rng() < 0.32) addCorner(match, team, time.minute);
    return;
  }
  if (big) {
    shooter.bigMissed += 1;
    match.events.keyChances.push({ side: team.side, minute: time.minute, added: time.added || undefined, playerId: shooter.id, outcome: rng() < 0.16 ? 'woodwork' : 'missed' });
  } else if (rng() < 0.3) {
    const blocker = weightedBy(rng, opponent.onPitch, (entry) => (entry.line === 'DF' ? 1.6 : entry.line === 'MF' ? 0.7 : entry.line === 'FW' ? 0.1 : 0.05) * entry.defendW);
    if (blocker) blocker.blocks += 1;
    if (match.detail) match.timeline.push([time.minute, 's', team.side, shooter.id]);
    if (rng() < 0.45) addCorner(match, team, time.minute);
    return;
  }
  if (match.detail) match.timeline.push([time.minute, 's', team.side, shooter.id]);
  if (!big && rng() < 0.12) addCorner(match, team, time.minute);
}

function addCorner(match, team, minute) {
  team.corners += 1;
  if (match.detail) match.timeline.push([minute, 'c', team.side]);
}

function scoreGoal(match, team, opponent, scorer, assister, time, slice, rng, flags) {
  team.goals += 1;
  scorer.goals += 1;
  if (assister) assister.assists += 1;
  for (const entry of opponent.onPitch) entry.conceded += 1;
  // A few goals come from a defensive error.
  if (rng() < 0.07) {
    const culprit = weightedBy(rng, opponent.onPitch, (entry) => (entry.line === 'DF' ? 1.4 : entry.line === 'GK' ? 0.6 : entry.line === 'MF' ? 0.6 : 0.1) * (1 + Math.max(0, 80 - entry.rating) * 0.04));
    if (culprit) culprit.mistakes += 1;
  }
  match.events.goals.push({
    side: team.side,
    minute: time.minute,
    added: time.added || undefined,
    scorerId: scorer.id,
    assistId: assister?.id || null,
    penalty: flags.penalty || undefined,
    bigChance: flags.bigChance || undefined,
    extraTime: slice >= REGULATION_SLICES || undefined
  });
}

function resolveDiscipline(match, team, opponent, slice, rng) {
  const info = SLICES[slice];
  const profile = info.cards;
  const own = team.goals + (match.aggregate ? match.aggregate[team.side] : 0);
  const other = opponent.goals + (match.aggregate ? match.aggregate[opponent.side] : 0);
  const frustration = own < other ? 1.15 : 1;
  const base = team.style.cards * match.strictness * match.intensity * frustration * profile * (info.length / 90);
  const yellowChance = 1.95 * base;
  const redChance = 0.017 * base;
  const roll = rng();
  if (roll < yellowChance) {
    const player = weightedBy(rng, team.onPitch, (entry) => (CARD_WEIGHT[entry.line] || 1) * entry.cardProne * (entry.yellow ? 0.2 : 1));
    if (!player) return;
    const time = eventMinute(rng, slice);
    if (player.yellow) {
      player.yellow += 1;
      team.yellow += 1;
      sendOff(match, team, player, time, 'second-yellow');
    } else {
      player.yellow = 1;
      team.yellow += 1;
      match.events.cards.push({ side: team.side, type: 'yellow', minute: time.minute, added: time.added || undefined, playerId: player.id });
    }
  } else if (roll < yellowChance + redChance) {
    const player = weightedBy(rng, team.onPitch, (entry) => (entry.line === 'DF' ? 1.6 : entry.line === 'GK' ? 0.25 : entry.line === 'MF' ? 1.1 : 0.7) * entry.cardProne);
    if (!player) return;
    sendOff(match, team, player, eventMinute(rng, slice), 'straight');
  }
  // In-match injuries: rarer early, more common when tired.
  const injuryChance = 0.12 * (info.length / 90) * (1 + Math.max(0, 85 - team.energy) * 0.03) * match.intensity;
  if (rng() < injuryChance) {
    const player = weightedBy(rng, team.onPitch, (entry) => (entry.line === 'GK' ? 0.25 : 1) * entry.injuryProne * (1 + Math.max(0, 80 - entry.energy) * 0.04));
    if (player && !player.injured) {
      player.injured = true;
      team.injuredPending = true;
      const time = eventMinute(rng, slice);
      match.events.injuries.push({ side: team.side, minute: time.minute, playerId: player.id });
    }
  }
}

function sendOff(match, team, player, time, reason) {
  player.red = true;
  player.off = time.minute;
  team.red += 1;
  team.sentOff += 1;
  // A second booking is recorded as the yellow it is, then the red that follows.
  if (reason === 'second-yellow') match.events.cards.push({ side: team.side, type: 'yellow', minute: time.minute, added: time.added || undefined, playerId: player.id, second: true });
  match.events.cards.push({ side: team.side, type: 'red', minute: time.minute, added: time.added || undefined, playerId: player.id, reason });
  const index = team.onPitch.indexOf(player);
  if (index >= 0) team.onPitch.splice(index, 1);
  // Losing the goalkeeper forces an outfield player into goal unless a sub is left.
  if (player.line === 'GK') {
    const reserve = team.subsUsed < team.maxSubs ? team.bench.find((entry) => entry.line === 'GK' && entry.on === null) : null;
    const outfield = [...team.onPitch].filter((entry) => entry.line !== 'GK').sort((a, b) => a.goalW - b.goalW)[0];
    if (reserve && outfield) substitute(team, outfield, reserve, time.minute, time.added, 'red-card', match.events);
    else if (outfield) { outfield.line = 'GK'; outfield.effective = Math.min(outfield.effective, 45); }
  }
  team.dirty = true;
}

function shootout(match, rng) {
  const order = (team) => {
    const players = team.onPitch.filter((entry) => !entry.red);
    const outfield = players.filter((entry) => entry.line !== 'GK').sort((a, b) => b.penalty - a.penalty);
    const keepers = players.filter((entry) => entry.line === 'GK');
    return [...outfield, ...keepers];
  };
  const takers = { home: order(match.home), away: order(match.away) };
  const keepers = { home: goalkeeperOf(match.home), away: goalkeeperOf(match.away) };
  const score = { home: 0, away: 0 };
  const taken = { home: 0, away: 0 };
  const kicks = [];
  let round = 1;
  while (round <= 30) {
    for (const side of ['home', 'away']) {
      const other = side === 'home' ? 'away' : 'home';
      const list = takers[side];
      if (!list.length) continue;
      const taker = list[taken[side] % list.length];
      const keeper = keepers[other];
      const keeperQuality = keeper ? freshEffective(keeper) : 50;
      // Pressure rises each round; a kick that can lose (or win) the shootout weighs more.
      const remainingOwn = Math.max(0, 5 - taken[side]);
      const remainingOther = Math.max(0, 5 - taken[other]);
      const decisive = round <= 5
        ? (score[side] + remainingOwn - 1 < score[other] || score[side] + 1 > score[other] + remainingOther)
        : true;
      const pressure = 0.012 * (round - 1) + (decisive ? 0.045 : 0) + (round > 5 ? 0.025 : 0);
      const tired = Math.max(0, 75 - taker.energy) * 0.002;
      const chance = clamp(0.775 + (taker.penalty - 75) * 0.0035 - (keeperQuality - 75) * 0.003 - pressure - tired + taker.clutch * 0.06 + taker.bigGame * 0.02, 0.45, 0.93);
      const scored = rng() < chance;
      const outcome = scored ? 'scored' : rng() < 0.58 ? 'saved' : rng() < 0.25 ? 'woodwork' : 'missed';
      taken[side] += 1;
      if (scored) score[side] += 1;
      kicks.push({ round, side, playerId: taker.id, keeperId: keeper?.id || null, outcome, scored, home: score.home, away: score.away });
      if (round <= 5) {
        const homeLeft = 5 - taken.home, awayLeft = 5 - taken.away;
        if (score.home > score.away + awayLeft || score.away > score.home + homeLeft) return { score, kicks };
      }
    }
    if (round >= 5 && taken.home === taken.away && score.home !== score.away) return { score, kicks };
    round += 1;
  }
  // Pathological fallback (should never trigger): award the next kick.
  score.home += 1;
  return { score, kicks };
}

function finaliseRatings(match, rng) {
  const players = [];
  for (const team of [match.home, match.away]) {
    const opponent = team === match.home ? match.away : match.home;
    const won = match.winnerSide === team.side;
    const lost = match.winnerSide && match.winnerSide !== team.side;
    const matchEnd = match.endMinute;
    for (const entry of team.all) {
      const minutes = Math.max(1, (entry.off ?? matchEnd) - (entry.on ?? 0));
      const share = Math.min(1, minutes / 90);
      const line = entry.line;
      // General play scales with ability; events then move the rating.
      let rating = 6.4 + (entry.rating - 70) / 80 + (line === 'MF' ? 0.04 : line === 'DF' ? 0.05 : line === 'FW' ? 0.04 : -0.04);
      // A goal matters, but the whole performance decides the rating.
      rating += entry.goals * 0.38 + entry.assists * 0.3 + entry.onTarget * 0.04 + entry.keyPasses * 0.08 - entry.bigMissed * 0.08;
      rating += entry.blocks * 0.1 + entry.mistakes * -0.95 + entry.penMissed * -0.35;
      const tackles = Math.round(TACKLE_RATE[line] * share * (0.4 + rng() * 1.2) * (entry.defendW || 1));
      entry.tackles = tackles;
      rating += tackles * (line === "DF" ? 0.075 : 0.06);
      const cleanSheet = opponent.goals === 0 && share >= 0.66;
      if (line === 'GK') {
        rating += entry.saves * 0.11 + entry.bigSaves * 0.12 - Math.max(0, entry.conceded - 1) * 0.2;
        if (cleanSheet) rating += 0.42;
      } else if (line === 'DF') {
        if (cleanSheet) rating += 0.28;
        rating -= Math.max(0, entry.conceded - 1) * 0.09;
      } else if (line === 'MF' && cleanSheet) rating += 0.06;
      if (entry.yellow === 1) rating -= 0.1;
      if (entry.red) rating -= 1.15;
      if (won) rating += 0.3 * Math.max(0.5, share);
      else if (lost) rating -= 0.22 * Math.max(0.5, share);
      rating += (rng() - 0.5) * 0.7;
      if (minutes < 25) rating = 6.4 + (rating - 6.4) * 0.55;
      entry.rating = clamp(Math.round(rating * 100) / 100, 4.5, 10);
      players.push({
        side: team.side,
        id: entry.id,
        depth: !entry.id,
        line,
        slotType: entry.slotType,
        started: entry.started,
        on: entry.on,
        off: entry.off,
        minutes: Math.min(minutes, matchEnd),
        goals: entry.goals,
        assists: entry.assists,
        shots: entry.shots,
        onTarget: entry.onTarget,
        keyPasses: entry.keyPasses,
        saves: entry.saves,
        blocks: entry.blocks,
        tackles: entry.tackles,
        mistakes: entry.mistakes,
        yellow: entry.yellow ? 1 : 0,
        red: entry.red ? 1 : 0,
        penScored: entry.penScored,
        penMissed: entry.penMissed,
        conceded: entry.conceded,
        cleanSheet: (line === 'GK' || line === 'DF') && opponent.goals === 0 && share >= 0.66,
        injured: entry.injured,
        energy: Math.round(entry.energy),
        rating: entry.rating
      });
    }
  }
  return players;
}

// input: {
//   home, away: { teamId, lambda, style, xi:[source], bench:[source], maxSubs? }
//     source: { id|null, line, slotType, rating, effective, goalW, assistW, defendW,
//               penalty, cardProne, injuryProne, bigGame, fitness }
//   knockout: true when this match must produce a winner
//   aggregate: { home, away } goals already scored in the tie by this match's sides
//   detail: record every shot and corner for replay
//   intensity, bigGameStakes, legStakes
// }
export function playMatch(input, rng) {
  const match = {
    home: buildTeam(input.home, 'home'),
    away: buildTeam(input.away, 'away'),
    aggregate: input.aggregate || null,
    detail: Boolean(input.detail),
    intensity: input.intensity || 1,
    bigGameStakes: input.bigGameStakes || 0,
    legStakes: input.legStakes ?? 1,
    strictness: 0.82 + rng() * 0.36,
    possessionNoise: (rng() - 0.5) * 10,
    timeline: [],
    stateScratch: [null, null],
    possessionSlices: [],
    events: { goals: [], cards: [], subs: [], injuries: [], keyChances: [] },
    matchup: null,
    endMinute: 90,
    winnerSide: null
  };
  match.matchup = [styleMatchup(input.home.style, input.away.style), styleMatchup(input.away.style, input.home.style)];
  match.home.baseRate = match.home.lambda0 * match.home.style.volume * match.away.style.concede * match.matchup[0] * match.intensity;
  match.away.baseRate = match.away.lambda0 * match.away.style.volume * match.home.style.concede * match.matchup[1] * match.intensity;
  match.home.convFactor = conversionFactor(match.home, match.away);
  match.away.convFactor = conversionFactor(match.away, match.home);
  let possessionWeight = 90;
  for (let slice = 0; slice < REGULATION_SLICES; slice += 1) playSlice(match, slice, rng);
  const level = () => {
    const homeTotal = match.home.goals + (match.aggregate?.home || 0);
    const awayTotal = match.away.goals + (match.aggregate?.away || 0);
    return homeTotal === awayTotal;
  };
  let extraTime = false;
  let shoot = null;
  if (input.knockout && level()) {
    extraTime = true;
    // Extra time adds two more substitutions' worth of bench room if any is left.
    match.home.maxSubs = Math.min(match.home.bench.length, match.home.maxSubs + 1);
    match.away.maxSubs = Math.min(match.away.bench.length, match.away.maxSubs + 1);
    for (let slice = REGULATION_SLICES; slice < SLICES.length; slice += 1) playSlice(match, slice, rng);
    possessionWeight = 120;
    if (level()) shoot = shootout(match, rng);
  }
  match.endMinute = extraTime ? 120 : 90;
  const homeTotal = match.home.goals + (match.aggregate?.home || 0);
  const awayTotal = match.away.goals + (match.aggregate?.away || 0);
  match.winnerSide = shoot
    ? (shoot.score.home > shoot.score.away ? 'home' : 'away')
    : homeTotal > awayTotal ? 'home' : awayTotal > homeTotal ? 'away' : null;
  // Ratings use this match's own result for single games and the tie for deciders.
  const matchWinner = match.winnerSide;
  const players = finaliseRatings(match, rng);
  let manOfMatch = null;
  for (const row of players) {
    if (!row.id) continue;
    const score = row.rating + row.goals * 0.15 + (matchWinner === row.side ? 0.1 : 0);
    if (!manOfMatch || score > manOfMatch.score) manOfMatch = { id: row.id, side: row.side, score };
  }
  const statsFor = (team) => ({
    shots: team.shots,
    onTarget: team.onTarget,
    corners: team.corners,
    possession: 0,
    yellow: team.yellow,
    red: team.red,
    xg: Number(team.xg.toFixed(2))
  });
  const stats = { home: statsFor(match.home), away: statsFor(match.away) };
  const homePossession = Math.round(match.home.possessionSum / possessionWeight);
  stats.home.possession = clamp(homePossession, 22, 78);
  stats.away.possession = 100 - stats.home.possession;
  const sortByMinute = (a, b) => a.minute - b.minute || (a.added || 0) - (b.added || 0);
  return {
    homeGoals: match.home.goals,
    awayGoals: match.away.goals,
    extraTime,
    penalties: shoot ? { home: shoot.score.home, away: shoot.score.away } : null,
    shootout: shoot ? shoot.kicks : null,
    winnerSide: match.winnerSide,
    stats,
    goals: match.events.goals.sort(sortByMinute),
    cards: match.events.cards.sort(sortByMinute),
    subs: match.events.subs.sort(sortByMinute),
    injuries: match.events.injuries,
    keyChances: match.events.keyChances.sort(sortByMinute).slice(0, 12),
    timeline: match.detail ? match.timeline.sort((a, b) => a[0] - b[0]) : null,
    possessionSlices: match.detail ? match.possessionSlices : null,
    players,
    manOfMatchId: manOfMatch?.id || null,
    endMinute: match.endMinute
  };
}
