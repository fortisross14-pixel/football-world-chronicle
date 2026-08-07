import assert from 'node:assert/strict';
import {
  createWorld,
  simulateWeeks,
  simulateToSeasonEnd,
  startNextSeason,
  getLeagueTable,
  upgradeWorld
} from '../src/engine.js';

const state = createWorld(220022);
assert.equal(state.dataRevision, 14);
assert.ok(state.coaches.every((coach) => coach.careerLength >= 8 && coach.careerLength <= 18), 'coach careers must be 8–18 seasons');
assert.ok(state.coaches.every((coach) => Array.isArray(coach.careerMultipliers) && coach.careerMultipliers.length === coach.careerLength), 'coach curves must match career length');
assert.ok(Object.keys(state.current.superCups || {}).length >= 12, 'major domestic super cups should be present');

simulateWeeks(state, 2);
assert.ok(Object.values(state.current.superCups).every((cup) => cup.championId), 'all super cups should be decided by week 2');
assert.ok(state.current.globalClubCompetitions?.ICUP, 'opening cycle should contain annual Intercontinental Cup');
simulateToSeasonEnd(state);
assert.ok(state.current.globalClubCompetitions.ICUP.championId, 'Intercontinental Cup should complete');

// An elite club with no trophy and a poor league season must dismiss its coach.
const madrid = state.clubs.find((club) => club.id === 'real-madrid');
assert.ok(madrid?.coachId, 'Real Madrid needs a coach for dismissal test');
const oldCoachId = madrid.coachId;
state.history.champions = state.history.champions.filter((row) => !(row.season === state.season && row.winnerId === madrid.id));
const madridSeason = state.history.clubSeasons.find((row) => row.season === state.season && row.clubId === madrid.id);
if (madridSeason) madridSeason.position = 7;
madrid.reputation = 95;
startNextSeason(state);
assert.notEqual(madrid.coachId, oldCoachId, 'elite trophyless club should replace coach');

// Force a coach to the final career year and validate retirement + replacement.
const activeCoach = state.coaches.find((coach) => coach.status !== 'retired' && coach.clubId);
assert.ok(activeCoach);
activeCoach.careerYear = activeCoach.careerLength - 1;
const retiringId = activeCoach.id;
simulateToSeasonEnd(state);
startNextSeason(state);
assert.equal(state.coaches.find((coach) => coach.id === retiringId)?.status, 'retired', 'coach should retire at career limit');
assert.ok(state.current.retirements.some((row) => row.type === 'coach' && row.coachId === retiringId), 'retirement should appear in preseason magazine data');

// Advance to the 2004-05 season, which hosts the four-year Club World Cup edition.
while (state.season < 2004) {
  simulateToSeasonEnd(state);
  startNextSeason(state);
}
assert.ok(state.current.globalClubCompetitions?.CWC, 'Club World Cup should appear in the year-before-World-Cup cycle');
const cwcTeams = state.current.globalClubCompetitions.CWC.groups.flatMap((group) => group.teamIds);
assert.equal(new Set(cwcTeams).size, 32, 'Club World Cup should have 32 distinct clubs');
simulateToSeasonEnd(state);
assert.ok(state.current.globalClubCompetitions.CWC.championId, 'Club World Cup should complete with a champion');
assert.equal(state.current.globalClubCompetitions.CWC.knockout.rounds.length, 4, 'Club World Cup should complete four knockout rounds');

// Upgrade compatibility from a revision-13 save.
const legacy = createWorld(220023);
legacy.dataRevision = 13;
legacy.coaches.forEach((coach) => { coach.careerLength = 24; });
upgradeWorld(legacy);
assert.equal(legacy.dataRevision, 14);
assert.ok(legacy.coaches.every((coach) => coach.careerLength >= 8 && coach.careerLength <= 18));

console.log(JSON.stringify({
  season: state.season,
  superCups: Object.keys(state.current.superCups || {}).length,
  intercontinentalChampion: state.history.champions.find((row) => row.competitionId === 'ICUP')?.winnerId,
  clubWorldCupChampion: state.current.globalClubCompetitions.CWC.championId,
  retiredCoach: retiringId,
  realMadridReplacement: madrid.coachId,
  tableLeader: getLeagueTable(state, 'ESP1')[0]?.teamId
}, null, 2));
