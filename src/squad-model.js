// Squads, formations and formation fit.
// Pure functions: no RNG and no state access, so lineup choice is repeatable and
// cheap enough to run before every match.

export const SQUAD_SIZE = 15;
export const STARTERS = 11;
export const BENCH_SIZE = SQUAD_SIZE - STARTERS;

// Slot types describe what a position on the pitch asks for. Fit values: 1 natural,
// 0.94 good, 0.88 workable. Players in their own line but an unlisted role get 0.86.
const SLOT_TYPES = {
  GK: { line: 'GK', label: 'GK', roles: { sweeper_keeper: 1, shot_stopper: 1, complete_goalkeeper: 1 } },
  FB: { line: 'DF', label: 'FB', roles: { attacking_full_back: 1, defensive_full_back: 1, ball_playing_centre_back: 0.88 },
    other: { wide_midfielder: 0.82, defensive_midfielder: 0.76 } },
  CB: { line: 'DF', label: 'CB', roles: { ball_playing_centre_back: 1, stopper_centre_back: 1, defensive_full_back: 0.9, attacking_full_back: 0.82 },
    other: { defensive_midfielder: 0.86 } },
  WB: { line: 'DF', label: 'WB', roles: { attacking_full_back: 1, defensive_full_back: 0.9, ball_playing_centre_back: 0.8 },
    other: { wide_midfielder: 0.95, winger: 0.84 } },
  DM: { line: 'MF', label: 'DM', roles: { defensive_midfielder: 1, deep_playmaker: 0.96, box_to_box: 0.92 },
    other: { ball_playing_centre_back: 0.84, stopper_centre_back: 0.78 } },
  CM: { line: 'MF', label: 'CM', roles: { box_to_box: 1, deep_playmaker: 1, attacking_midfielder: 0.92, defensive_midfielder: 0.92, wide_midfielder: 0.88 } },
  AM: { line: 'MF', label: 'AM', roles: { attacking_midfielder: 1, box_to_box: 0.88, deep_playmaker: 0.88, wide_midfielder: 0.86 },
    other: { false_nine: 0.96, inside_forward: 0.86, winger: 0.84 } },
  // Wing-back in a back three (3-5-2, 3-4-3): a midfield line, filled naturally by wide midfielders.
  WBM: { line: 'MF', label: 'WB', roles: { wide_midfielder: 1, box_to_box: 0.86, attacking_midfielder: 0.84 },
    other: { attacking_full_back: 0.96, defensive_full_back: 0.88, winger: 0.9 } },
  WM: { line: 'MF', label: 'WM', roles: { wide_midfielder: 1, box_to_box: 0.86, attacking_midfielder: 0.88 },
    other: { winger: 0.95, inside_forward: 0.86, attacking_full_back: 0.84 } },
  W: { line: 'FW', label: 'W', roles: { winger: 1, inside_forward: 1, false_nine: 0.86 },
    other: { wide_midfielder: 0.92, attacking_midfielder: 0.84 } },
  ST: { line: 'FW', label: 'ST', roles: { striker: 1, target_forward: 1, false_nine: 0.95, inside_forward: 0.9, winger: 0.84 },
    other: { attacking_midfielder: 0.78 } }
};

const LINE_ORDER = ['GK', 'DF', 'MF', 'FW'];
const ADJACENT_FIT = 0.68;
const DISTANT_FIT = 0.5;
const GOALKEEPER_MISMATCH_FIT = 0.3;

// x: 0 left touchline → 100 right; y: 0 own goal → 100 opponent goal.
export const FORMATIONS = {
  '4-4-2': { label: '4-4-2', slots: [
    ['GK', 50, 6], ['FB', 14, 26], ['CB', 38, 22], ['CB', 62, 22], ['FB', 86, 26],
    ['WM', 14, 54], ['CM', 38, 50], ['CM', 62, 50], ['WM', 86, 54], ['ST', 38, 80], ['ST', 62, 80]] },
  '4-3-3': { label: '4-3-3', slots: [
    ['GK', 50, 6], ['FB', 14, 26], ['CB', 38, 22], ['CB', 62, 22], ['FB', 86, 26],
    ['DM', 50, 42], ['CM', 30, 54], ['CM', 70, 54], ['W', 16, 78], ['ST', 50, 84], ['W', 84, 78]] },
  '4-2-3-1': { label: '4-2-3-1', slots: [
    ['GK', 50, 6], ['FB', 14, 26], ['CB', 38, 22], ['CB', 62, 22], ['FB', 86, 26],
    ['DM', 38, 42], ['CM', 62, 42], ['WM', 16, 66], ['AM', 50, 64], ['WM', 84, 66], ['ST', 50, 85]] },
  '3-5-2': { label: '3-5-2', slots: [
    ['GK', 50, 6], ['CB', 28, 22], ['CB', 50, 20], ['CB', 72, 22],
    ['WBM', 10, 48], ['DM', 50, 42], ['CM', 32, 56], ['CM', 68, 56], ['WBM', 90, 48], ['ST', 38, 81], ['ST', 62, 81]] },
  '5-3-2': { label: '5-3-2', slots: [
    ['GK', 50, 6], ['WB', 10, 32], ['CB', 30, 21], ['CB', 50, 19], ['CB', 70, 21], ['WB', 90, 32],
    ['CM', 30, 52], ['DM', 50, 46], ['CM', 70, 52], ['ST', 38, 80], ['ST', 62, 80]] },
  '4-1-4-1': { label: '4-1-4-1', slots: [
    ['GK', 50, 6], ['FB', 14, 26], ['CB', 38, 22], ['CB', 62, 22], ['FB', 86, 26],
    ['DM', 50, 40], ['WM', 14, 60], ['CM', 38, 58], ['CM', 62, 58], ['WM', 86, 60], ['ST', 50, 84]] },
  '3-4-3': { label: '3-4-3', slots: [
    ['GK', 50, 6], ['CB', 28, 22], ['CB', 50, 20], ['CB', 72, 22],
    ['WBM', 10, 50], ['CM', 38, 48], ['CM', 62, 48], ['WBM', 90, 50], ['W', 18, 78], ['ST', 50, 84], ['W', 82, 78]] }
};

// Squad of 15 each formation asks for (at most two goalkeepers). The starting XI's lines
// plus a bench of a reserve keeper and three outfield players add up to these.
export const FORMATION_SQUAD_TARGETS = {
  '4-4-2': { GK: 2, DF: 5, MF: 5, FW: 3 },
  '4-3-3': { GK: 2, DF: 5, MF: 4, FW: 4 },
  '4-2-3-1': { GK: 2, DF: 5, MF: 5, FW: 3 },
  '4-1-4-1': { GK: 2, DF: 5, MF: 6, FW: 2 },
  '3-5-2': { GK: 2, DF: 4, MF: 6, FW: 3 },
  '3-4-3': { GK: 2, DF: 4, MF: 5, FW: 4 },
  '5-3-2': { GK: 2, DF: 6, MF: 4, FW: 3 }
};

export function squadTargetForFormation(formationId) {
  return FORMATION_SQUAD_TARGETS[formationId] || FORMATION_SQUAD_TARGETS['4-4-2'];
}

// Strength bonus from formation fit (shared with the engine).
export function formationFitBonus(fit) {
  return Math.max(-1.6, Math.min(0.9, ((fit ?? 85) - 84) * 0.06));
}

// Strength cost of playing the coach's backup system instead of the preferred one.
export const BACKUP_SYSTEM_PENALTY = 0.8;
export const BACKUP_SYSTEM_PENALTY_ADAPTIVE = 0.3;
export const FORMATION_IDS = Object.keys(FORMATIONS);

// Tactical shape of each formation. Attack/defence are small multipliers used by the
// match engine; width rewards wingers and wing-backs being present.
export const FORMATION_TRAITS = {
  '4-4-2': { attack: 1.0, defence: 1.0, control: 0.98 },
  '4-3-3': { attack: 1.04, defence: 0.98, control: 1.02 },
  '4-2-3-1': { attack: 1.02, defence: 1.01, control: 1.01 },
  '3-5-2': { attack: 1.01, defence: 0.99, control: 1.03 },
  '5-3-2': { attack: 0.93, defence: 1.07, control: 0.97 },
  '4-1-4-1': { attack: 0.97, defence: 1.04, control: 1.02 },
  '3-4-3': { attack: 1.06, defence: 0.95, control: 0.99 }
};

// Each tactical style has a natural first and second choice.
const STYLE_FORMATIONS = {
  pressing: [['4-3-3', 5], ['4-2-3-1', 3], ['3-4-3', 2]],
  possession: [['4-3-3', 5], ['4-1-4-1', 3], ['3-4-3', 1.5], ['4-2-3-1', 1.5]],
  counter_attack: [['4-4-2', 4], ['4-2-3-1', 3], ['5-3-2', 2], ['3-5-2', 1]],
  defensive_rock: [['5-3-2', 4], ['4-1-4-1', 3], ['4-4-2', 2], ['3-5-2', 1]],
  direct: [['4-4-2', 5], ['3-5-2', 2.5], ['4-3-3', 2]],
  pragmatist: [['4-2-3-1', 4], ['4-4-2', 3], ['4-1-4-1', 2.5], ['5-3-2', 1]],
  tournament_expert: [['4-2-3-1', 4], ['3-5-2', 2.5], ['4-3-3', 2], ['5-3-2', 1.5]],
  adaptive: [['4-2-3-1', 3], ['4-3-3', 3], ['3-5-2', 2], ['4-4-2', 2], ['3-4-3', 1]],
  youth_developer: [['4-3-3', 4], ['4-2-3-1', 3], ['4-4-2', 2]],
  motivator: [['4-4-2', 4], ['4-3-3', 3], ['4-2-3-1', 2], ['3-5-2', 1]]
};

export function formationChoicesForStyle(style) {
  return STYLE_FORMATIONS[style] || STYLE_FORMATIONS.adaptive;
}

// roll01 and roll02 are independent numbers in [0, 1).
export function chooseCoachFormations(style, roll1, roll2) {
  const choices = formationChoicesForStyle(style);
  const pickFrom = (list, roll) => {
    const total = list.reduce((sum, [, weight]) => sum + weight, 0);
    let needle = roll * total;
    for (const [id, weight] of list) { needle -= weight; if (needle <= 0) return id; }
    return list[list.length - 1][0];
  };
  const primary = pickFrom(choices, roll1);
  const rest = choices.filter(([id]) => id !== primary);
  const secondary = rest.length ? pickFrom(rest, roll2) : (primary === '4-4-2' ? '4-3-3' : '4-4-2');
  return { primary, secondary };
}

export function slotFit(player, slotType) {
  const slot = SLOT_TYPES[slotType];
  if (!slot || !player) return DISTANT_FIT;
  if (player.position === 'GK' || slot.line === 'GK') {
    return player.position === slot.line ? 1 : GOALKEEPER_MISMATCH_FIT;
  }
  if (player.depth) return player.position === slot.line ? 0.95 : ADJACENT_FIT;
  if (player.position === slot.line) return slot.roles[player.role] ?? 0.86;
  if (slot.other?.[player.role]) return slot.other[player.role];
  const distance = Math.abs(LINE_ORDER.indexOf(player.position) - LINE_ORDER.indexOf(slot.line));
  return distance === 1 ? ADJACENT_FIT : DISTANT_FIT;
}

export function effectiveRating(player, slotType, fitness = 100) {
  const fit = slotFit(player, slotType);
  const tiredness = fitness >= 92 ? 0 : (92 - fitness) * 0.16;
  return (player.rating || 60) - (1 - fit) * 45 - tiredness;
}

export function slotLine(slotType) {
  return SLOT_TYPES[slotType]?.line || 'MF';
}

export function slotLabel(slotType) {
  return SLOT_TYPES[slotType]?.label || slotType;
}

// Greedy assignment over every (player, slot) pair: the strongest effective pairing is
// fixed first. With 15 players and 11 slots this is ~165 pairs, so it is cheap.
// options.fitness: Map(playerId → fitness), options.unavailable: Set(playerId).
export function selectStartingEleven(players, formationId, options = {}) {
  const formation = FORMATIONS[formationId] || FORMATIONS['4-4-2'];
  const fitness = options.fitness;
  const unavailable = options.unavailable;
  const bias = options.bias;
  const pool = unavailable ? players.filter((player) => !unavailable.has(player.id)) : players;
  const slots = formation.slots;
  const n = pool.length;
  const m = slots.length;
  // Every (slot, player) pairing in a flat array; the strongest pairings are fixed
  // first. Ties keep slot-then-squad order, so selection is fully repeatable.
  const values = new Float64Array(n * m);
  const extra = new Float64Array(n);
  const fitnessValues = new Float64Array(n);
  for (let j = 0; j < n; j += 1) {
    extra[j] = bias ? bias(pool[j]) || 0 : 0;
    fitnessValues[j] = fitness ? (fitness.get(pool[j].id) ?? 100) : 100;
  }
  for (let i = 0; i < m; i += 1) {
    const slotType = slots[i][0];
    for (let j = 0; j < n; j += 1) values[i * n + j] = effectiveRating(pool[j], slotType, fitnessValues[j]) + extra[j];
  }
  const order = new Int32Array(n * m);
  for (let k = 0; k < order.length; k += 1) order[k] = k;
  order.sort((a, b) => (values[b] - values[a]) || (a - b));
  const assigned = new Int32Array(m).fill(-1);
  const usedPlayer = new Uint8Array(n);
  let filled = 0;
  for (let k = 0; k < order.length && filled < m; k += 1) {
    const index = order[k];
    const slot = (index / n) | 0;
    const playerIndex = index - slot * n;
    if (assigned[slot] !== -1 || usedPlayer[playerIndex]) continue;
    assigned[slot] = playerIndex;
    usedPlayer[playerIndex] = 1;
    filled += 1;
  }
  const xi = [];
  for (let i = 0; i < m; i += 1) {
    const playerIndex = assigned[i];
    if (playerIndex === -1) continue;
    const [slotType, x, y] = slots[i];
    const player = pool[playerIndex];
    xi.push({ player, slotType, x, y, effective: values[i * n + playerIndex], fit: slotFit(player, slotType) });
  }
  const bench = [];
  for (let j = 0; j < n; j += 1) if (!usedPlayer[j]) bench.push(pool[j]);
  bench.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return { formationId: formation.label, xi, bench };
}

// Formation fit: how much of the squad's raw quality survives in this shape (0–100).
// A squad whose best players all play in natural slots scores ~95+; missing wingers,
// a thin defensive line or a striker played wide drags it down.
export function formationFitScore(players, formationId, selection = null) {
  const lineup = selection || selectStartingEleven(players, formationId);
  if (!lineup.xi.length) return 50;
  const goalkeepers = players.filter((player) => player.position === 'GK').sort((a, b) => b.rating - a.rating);
  const outfield = players.filter((player) => player.position !== 'GK').sort((a, b) => b.rating - a.rating);
  const ideal = (goalkeepers[0]?.rating || 55) + outfield.slice(0, 10).reduce((sum, player) => sum + player.rating, 0);
  const actual = lineup.xi.reduce((sum, row) => sum + row.effective, 0);
  const ratio = actual / Math.max(1, ideal);
  return Math.round(Math.max(30, Math.min(100, 100 - (1 - ratio) * 800)));
}

// Picks the formation a coach actually uses: the preferred one unless it fits poorly
// and the second choice is clearly better.
// options (fitness, unavailable, bias) are passed to the XI selection, so injuries,
// suspensions, tiredness and rotation shape tonight's line-up.
// The coach's dilemma: with the wrong players he either plays people out of position in
// his preferred system (the fit penalty) or switches to a system he likes less (the
// backup penalty, options.backupPenalty). He picks whichever costs less.
export function chooseMatchFormation(players, preferred, secondary, options = {}) {
  const pool = options.unavailable ? players.filter((player) => !options.unavailable.has(player.id)) : players;
  const primaryId = FORMATIONS[preferred] ? preferred : '4-4-2';
  const primary = selectStartingEleven(pool, primaryId, options);
  const primaryFit = formationFitScore(pool, primaryId, primary);
  const penalty = options.backupPenalty ?? BACKUP_SYSTEM_PENALTY;
  if (!secondary || secondary === primaryId || !FORMATIONS[secondary] || primaryFit >= 88) {
    return { formationId: primaryId, fit: primaryFit, selection: primary, fallback: false, systemPenalty: 0 };
  }
  const second = selectStartingEleven(pool, secondary, options);
  const secondFit = formationFitScore(pool, secondary, second);
  if (formationFitBonus(secondFit) - penalty > formationFitBonus(primaryFit)) {
    return { formationId: secondary, fit: secondFit, selection: second, fallback: true, systemPenalty: penalty };
  }
  return { formationId: primaryId, fit: primaryFit, selection: primary, fallback: false, systemPenalty: 0 };
}

// Which outfield line and slot type the formation most needs filling, used by
// transfers so clubs buy for their coach's system.
export function formationNeeds(players, formationId) {
  const formation = FORMATIONS[formationId] || FORMATIONS['4-4-2'];
  const selection = selectStartingEleven(players, formationId);
  const weakest = [...selection.xi].sort((a, b) => (a.effective - a.player.rating * 0.15) - (b.effective - b.player.rating * 0.15));
  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const player of players) counts[player.position] = (counts[player.position] || 0) + 1;
  const required = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const [slotType] of formation.slots) required[slotLine(slotType)] += 1;
  return {
    weakestSlot: weakest[0] ? { slotType: weakest[0].slotType, line: slotLine(weakest[0].slotType), effective: weakest[0].effective, fit: weakest[0].fit } : null,
    required,
    counts
  };
}

// Preferred role for a slot type, for generated players filling a gap in the system.
export function bestRoleForSlot(slotType) {
  const slot = SLOT_TYPES[slotType];
  if (!slot) return null;
  return Object.entries(slot.roles).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

// Squad blueprint for 15: two keepers, five defenders, five midfielders, three forwards.
export const SQUAD_BLUEPRINT = ['GK', 'DF', 'DF', 'MF', 'MF', 'FW', 'DF', 'MF', 'FW', 'DF', 'MF', 'GK', 'DF', 'MF', 'FW'];
export const SQUAD_POSITION_TARGET = { GK: 2, DF: 5, MF: 5, FW: 3 };

// Lightweight unnamed depth for clubs that only carry a small named core. Ratings are
// derived from the club, so nothing is stored in the save.
export function depthPlayers(teamKey, strength, namedPlayers, size = SQUAD_SIZE, roll = () => 0.5, target = SQUAD_POSITION_TARGET) {
  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const player of namedPlayers) counts[player.position] = (counts[player.position] || 0) + 1;
  const missing = [];
  for (const position of ['GK', 'DF', 'MF', 'FW']) {
    for (let index = counts[position]; index < (target[position] ?? SQUAD_POSITION_TARGET[position]); index += 1) missing.push(position);
  }
  const room = Math.max(0, size - namedPlayers.length);
  const result = [];
  for (let index = 0; index < room; index += 1) {
    const position = missing[index] || ['DF', 'MF', 'FW', 'DF', 'MF'][index % 5];
    const order = index;
    const rating = Math.round(Math.max(48, Math.min(90, strength - 5 - order * 0.55 + (roll(`${teamKey}:${index}`) - 0.5) * 6)));
    result.push({ id: null, depth: true, depthKey: `${teamKey}#${index}`, position, role: null, rating, rarity: 'common' });
  }
  return result;
}
