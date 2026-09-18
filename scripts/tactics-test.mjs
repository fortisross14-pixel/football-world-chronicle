import assert from 'node:assert/strict';
import { simulateMatchChances, matchEventRoll } from '../src/match-model.js';

const base = { style: 'adaptive', expectedGoals: 1.25, midfield: 75, defence: 75, finishing: 75, goalkeeping: 75 };
function sample(home = base, away = base, count = 16000) {
  let seed = 314159;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const total = { shots: 0, concededShots: 0, goals: 0, conceded: 0, onTarget: 0, cleanSheets: 0, oneNil: 0,
    sameYellow: 0, redHome: 0, redAway: 0, bothRed: 0 };
  for (let i = 0; i < count; i += 1) {
    const match = simulateMatchChances(home, away, rng);
    for (const side of ['home', 'away']) {
      const stats = match.stats[side];
      assert(stats.shots >= stats.onTarget && stats.onTarget >= match.goals[side]);
      for (const type of ['yellow', 'red']) assert.equal(match.cardEvents.filter((e) => e.side === side && e.type === type).length, stats[type]);
    }
    assert.equal(match.stats.home.possession + match.stats.away.possession, 100);
    total.shots += match.stats.home.shots;
    total.concededShots += match.stats.away.shots;
    total.onTarget += match.stats.home.onTarget;
    total.goals += match.goals.home;
    total.conceded += match.goals.away;
    total.cleanSheets += match.goals.away === 0;
    total.oneNil += match.goals.home === 1 && match.goals.away === 0;
    total.sameYellow += match.stats.home.yellow === match.stats.away.yellow;
    total.redHome += match.stats.home.red;
    total.redAway += match.stats.away.red;
    total.bothRed += match.stats.home.red && match.stats.away.red;
  }
  return Object.fromEntries(Object.entries(total).map(([key, value]) => [key, value / count]));
}
const balanced = sample();
const defensive = sample({ ...base, style: 'defensive_rock' });
const direct = sample({ ...base, style: 'direct' });
const keeper = sample({ ...base, goalkeeping: 95 });
const striker = sample({ ...base, style: 'defensive_rock', finishing: 95, goalkeeping: 95 });
const ordinaryDefensive = sample({ ...base, style: 'defensive_rock', goalkeeping: 95 });
assert(defensive.shots < balanced.shots * 0.82);
assert(defensive.concededShots < balanced.concededShots * 0.8);
assert(direct.shots > balanced.shots * 1.1);
assert(keeper.conceded < balanced.conceded * 0.78);
assert(striker.goals > ordinaryDefensive.goals * 1.2);
assert(striker.oneNil > balanced.oneNil * 1.2, 'defence + elite keeper/striker should support recurring 1-0 wins');
assert(balanced.sameYellow < 0.35, 'yellow cards must not mirror across teams');
assert(balanced.bothRed < 0.012, 'red cards must be independent');
assert(balanced.redHome > 0.025 && balanced.redAway > 0.025);
let sameLegacyCards = 0;
for (let i = 0; i < 2000; i += 1) sameLegacyCards += Math.floor(matchEventRoll(`m-${i}-yellow::0`) * 5) === Math.floor(matchEventRoll(`m-${i}-yellow::1`) * 5);
assert(sameLegacyCards / 2000 < 0.3, 'adjacent replay seeds must be decorrelated');

console.log(JSON.stringify({ balanced, defensive, direct, keeper, striker, passed: true }, null, 2));
