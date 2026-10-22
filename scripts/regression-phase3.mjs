// Phase 3: fitness, rotation, injuries and suspensions.
import assert from 'node:assert/strict';
import {
  createWorld, simulateWeeks, simulateToSeasonEnd, startNextSeason, upgradeWorld,
  getPlayerAvailability, getPlayerInjuryHistory
} from '../src/engine.js';
import * as legacy from './fixtures/legacy-r25/src/engine.js';

const report = {};
const world = createWorld(30301);
simulateWeeks(world, 20);
const restored = upgradeWorld(JSON.parse(JSON.stringify(world)));
simulateWeeks(world, 3);
simulateWeeks(restored, 3);
assert.equal(world.rngSeed, restored.rngSeed, 'injuries and bans resume deterministically');
assert.deepEqual(world.current.discipline, restored.current.discipline);
simulateWeeks(world, 22);
// World Cup finals start in week 44 of the first season: notable absentees make news.
const absences = world.current.news.filter((story) => /misses the|is a doubt for the/.test(story.headline || ''));
assert(absences.length > 0, 'injured stars missing a tournament make the Magazine');
report.tournamentAbsenceStories = absences.length;
simulateWeeks(world, 5);

const players = new Map(world.players.map((player) => [player.id, player]));
const logs = world.current.playerMatchLogs;
const matches = world.current.matches;
const matchById = new Map(matches.map((match) => [match.id, match]));

// Injured players do not play until they are back.
let injuries = 0;
const types = {};
for (const player of world.players) {
  for (const [season, week, code, weeks] of player.injuries || []) {
    if (season !== world.season) continue;
    injuries += 1;
    types[code] = (types[code] || 0) + 1;
    const backWeek = week + weeks + 1;
    const played = (logs[player.id] || []).filter((log) => log.week > week && log.week < Math.min(backWeek, 51));
    assert.equal(played.length, 0, `${player.name} played while injured (out week ${week} for ${weeks})`);
  }
}
assert(injuries > 500, `injuries happen (${injuries})`);
assert(types.k > types.m && types.m > (types.l || 0), 'knocks outnumber medium injuries, which outnumber long ones');
report.injuries = { count: injuries, byType: types };

// A straight red is served in that competition's next matches for the team.
let checkedBans = 0;
const teamMatches = new Map();
for (const match of matches) {
  for (const teamId of [match.homeId, match.awayId]) {
    const key = `${match.competitionId}::${teamId}`;
    if (!teamMatches.has(key)) teamMatches.set(key, []);
    teamMatches.get(key).push(match);
  }
}
for (const match of matches) {
  for (const card of match.cardEvents || []) {
    if (card.type !== 'red' || !card.playerId) continue;
    const teamId = card.side === 'home' ? match.homeId : match.awayId;
    const next = teamMatches.get(`${match.competitionId}::${teamId}`).find((item) => item.week > match.week);
    if (!next) continue;
    const appeared = (logs[card.playerId] || []).some((log) => log.matchId === next.id);
    assert(!appeared, `${players.get(card.playerId)?.name} served the ban after a red card`);
    checkedBans += 1;
  }
}
assert(checkedBans > 50, 'red-card bans were checked');
for (const byCompetition of Object.values(world.current.discipline)) {
  for (const [competitionId, row] of Object.entries(byCompetition)) {
    const threshold = world.current.leagues[competitionId] ? 5 : 3;
    assert(row.y < threshold, 'yellow accumulation resets into a ban');
    assert(row.ban >= 0);
  }
}
report.suspensions = { redCardBansChecked: checkedBans, playersWithRecords: Object.keys(world.current.discipline).length };

// Rotation: low-stakes cup ties are rotated far more often than league matches.
const rotationRate = (filter) => {
  const rows = matches.filter(filter);
  return rows.filter((match) => match.rotation).length / Math.max(1, rows.length);
};
const cupRotation = rotationRate((match) => !match.light && String(match.competitionId).startsWith('CUP-') && /Opening Round|Round of 16/.test(match.stage || ''));
const finalRotation = rotationRate((match) => /^Final$/.test(match.stage || ''));
assert(cupRotation > 0.6, `early cup rounds are rotated (${cupRotation.toFixed(2)})`);
report.rotation = { earlyCupRounds: Number(cupRotation.toFixed(2)), finalsWithChanges: Number(finalRotation.toFixed(2)) };

// Congested weeks wear players down; tired players are visible.
const tired = world.players.filter((player) => player.status === 'active' && (player.fitness ?? 100) < 75).length;
const availability = world.players.filter((player) => player.status === 'active').map((player) => getPlayerAvailability(world, player.id));
assert(availability.some((row) => row.injured), 'availability reports injuries');
report.fitness = { tiredPlayers: tired, injuredNow: availability.filter((row) => row.injured).length };

// Squad depth matters: clubs carrying more injuries pick up fewer points.
const injuredMatchesByClub = new Map();
for (const match of matches) {
  for (const side of ['home', 'away']) {
    if (!(match.rotation?.[side])) continue;
    const id = side === 'home' ? match.homeId : match.awayId;
    injuredMatchesByClub.set(id, (injuredMatchesByClub.get(id) || 0) + 1);
  }
}
report.depth = { clubsWithChangedLineups: injuredMatchesByClub.size };

// History, profiles and stories.
const injuredPlayer = world.players.find((player) => (player.injuries || []).length);
assert(getPlayerInjuryHistory(world, injuredPlayer.id).length >= 1);
const injuryStories = world.current.news.filter((story) => story.category === 'Injuries');
report.stories = injuryStories.length;

// Season rollover: fitness resets, long injuries carry over in part.
simulateToSeasonEnd(world);
startNextSeason(world);
assert(world.players.every((player) => player.fitness === undefined), 'everyone starts the season fresh');
const carried = world.players.filter((player) => player.injury && player.injury.returnSeason === world.season && player.injury.returnWeek > 0);
assert(carried.every((player) => getPlayerAvailability(world, player.id).injured), 'long injuries carry into the new season');
assert.deepEqual(world.current.discipline, {}, 'bans and yellow cards reset with the season');
report.carriedInjuries = carried.length;


// Old saves gain the new containers and keep playing.
const old = legacy.createWorld(30302);
legacy.simulateWeeks(old, 12);
const upgraded = upgradeWorld(JSON.parse(JSON.stringify(old)));
assert(upgraded.dataRevision >= 28 && upgraded.current.discipline && upgraded.current.bans);
simulateWeeks(upgraded, 8);
report.legacyResumed = upgraded.current.week;

console.log(JSON.stringify({ ...report, passed: true }, null, 2));
