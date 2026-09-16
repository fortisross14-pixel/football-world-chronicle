// Match chances are sampled before goals. Style controls volume; player quality
// controls accuracy and conversion. The injected RNG keeps saved worlds repeatable.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const STYLES = {
  defensive_rock: { volume: 0.72, resistance: 0.70, possession: -9, finishing: 0.025, discipline: 0.95 },
  counter_attack: { volume: 0.82, resistance: 0.87, possession: -7, finishing: 0.045, discipline: 1.04 },
  pressing: { volume: 1.18, resistance: 0.94, possession: 5, finishing: -0.015, discipline: 1.25 },
  possession: { volume: 1.06, resistance: 0.92, possession: 10, finishing: 0, discipline: 0.82 },
  direct: { volume: 1.22, resistance: 1.12, possession: -5, finishing: -0.025, discipline: 1.12 },
  pragmatist: { volume: 0.88, resistance: 0.84, possession: -3, finishing: 0.015, discipline: 0.95 },
  tournament_expert: { volume: 0.94, resistance: 0.93, possession: 0, finishing: 0.01, discipline: 0.94 }
};
const NEUTRAL = { volume: 1, resistance: 1, possession: 0, finishing: 0, discipline: 1 };

function poisson(rng, mean) {
  const limit = Math.exp(-mean);
  let product = 1, count = 0;
  do { count += 1; product *= rng(); } while (product > limit && count < 60);
  return count - 1;
}

export function simulateMatchChances(home, away, rng) {
  const styles = { home: STYLES[home.style] || NEUTRAL, away: STYLES[away.style] || NEUTRAL };
  const possession = clamp(Math.round(50 + (home.midfield - away.midfield) * 0.42
    + styles.home.possession - styles.away.possession + (rng() - 0.5) * 12), 22, 78);
  const stats = {}, goals = {}, cardEvents = [];
  const strictness = 0.8 + rng() * 0.4;
  for (const [side, team] of [['home', home], ['away', away]]) {
    const share = side === 'home' ? possession : 100 - possession;
    const discipline = styles[side].discipline * clamp(1 + (70 - team.defence) / 180, 0.78, 1.2);
    const yellow = Math.min(7, poisson(rng, (1.65 + (50 - share) * 0.016) * discipline * strictness));
    const red = rng() < clamp(0.045 * discipline * strictness + yellow * 0.006, 0.015, 0.13) ? 1 : 0;
    stats[side] = { shots: 0, onTarget: 0, corners: 0, possession: share, yellow, red };
    for (const [type, count] of [['yellow', yellow], ['red', red]]) {
      for (let i = 0; i < count; i += 1) cardEvents.push({ side, type, minute: 5 + Math.floor(rng() * 85) });
    }
  }
  for (const [side, team, opponent, other] of [['home', home, away, 'away'], ['away', away, home, 'home']]) {
    const own = styles[side], opposition = styles[other];
    const redExposure = (which) => cardEvents.filter((e) => e.side === which && e.type === 'red')
      .reduce((sum, e) => sum + (90 - e.minute) / 90, 0);
    // Existing competition/quality expectations remain the starting point, so
    // hierarchy and home advantage survive the move to a chance-based model.
    const volume = clamp(team.expectedGoals / 0.115, 2, 27) * own.volume * opposition.resistance
      * (1 - redExposure(side) * 0.35) * (1 + redExposure(other) * 0.28);
    const shots = Math.min(40, poisson(rng, volume));
    const accuracy = clamp(0.39 + (team.finishing - opponent.defence) * 0.003, 0.24, 0.57);
    const conversion = clamp(0.295 + (team.finishing - 75) * 0.004
      - (opponent.goalkeeping - 75) * 0.005 + own.finishing, 0.10, 0.55);
    let onTarget = 0, scored = 0;
    for (let i = 0; i < shots; i += 1) {
      if (rng() < accuracy) { onTarget += 1; if (rng() < conversion) scored += 1; }
    }
    Object.assign(stats[side], { shots, onTarget, corners: Math.min(15, poisson(rng, shots * 0.30)) });
    goals[side] = scored;
  }
  return { stats, goals, cardEvents: cardEvents.sort((a, b) => a.minute - b.minute) };
}

// Independent avalanche-mixed rolls for replay presentation and legacy matches.
// Adjacent event indexes must not produce almost identical random numbers.
export function matchEventRoll(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}
