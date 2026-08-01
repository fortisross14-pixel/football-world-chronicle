import { createWorld, simulateToSeasonEnd, startNextSeason } from '../src/engine.js';
import { NATIONAL_TEAM_BY_ID } from '../src/data.js';

const state = createWorld(210021);
const retiringPlayers = state.players
  .filter((player) => player.status === 'active' && !player.realWorldId)
  .sort((a, b) => a.baseQuality - b.baseQuality)
  .slice(0, 60);
for (const player of retiringPlayers) player.careerYear = player.careerLength - 1;

const retiringElitePlayer = state.players.find((player) => player.status === 'active' && ['legend', 'generational'].includes(player.rarity));
if (retiringElitePlayer) retiringElitePlayer.careerYear = retiringElitePlayer.careerLength - 1;

const retiringCoach = state.coaches.find((coach) => coach.status !== 'retired' && coach.rarity === 'epic')
  || state.coaches.find((coach) => coach.status !== 'retired');
retiringCoach.careerYear = retiringCoach.careerLength - 1;

const realMadrid = state.clubs.find((club) => club.id === 'real-madrid');
const owner = state.owners.find((item) => item.id === realMadrid.ownerId);
owner.yearsRemaining = 1;

simulateToSeasonEnd(state);
startNextSeason(state);

const newProcedural = state.players.filter((player) =>
  player.status === 'active'
  && !player.realWorldId
  && player.debutSeason === state.season
  && player.clubId
);
const domestic = newProcedural.filter((player) => {
  const club = state.clubs.find((item) => item.id === player.clubId);
  return club?.country === NATIONAL_TEAM_BY_ID[player.nationality]?.name;
});
const domesticRate = newProcedural.length ? domestic.length / newProcedural.length : 0;

const playerRetirementRecorded = state.current.retirements.some((row) => row.type === 'player' && row.playerId === retiringElitePlayer?.id);
const coachRetirementRecorded = state.current.retirements.some((row) => row.type === 'coach' && row.coachId === retiringCoach.id);
const newEliteCoachRecorded = state.current.newCoaches.some((row) => ['generational', 'legend', 'epic'].includes(state.coaches.find((coach) => coach.id === row.coachId)?.rarity));
const ownerChangeRecorded = state.current.ownerChanges.some((row) => row.clubId === 'real-madrid');

const report = {
  season: state.season,
  newProceduralPlayers: newProcedural.length,
  domesticSpawns: domestic.length,
  domesticSpawnRate: Number((domesticRate * 100).toFixed(1)),
  foreignExceptions: newProcedural.length - domestic.length,
  playerRetirementRecorded,
  coachRetirementRecorded,
  newEliteCoachRecorded,
  ownerChangeRecorded,
  preseasonRetirementCount: state.current.retirements.length,
  preseasonNewCoachCount: state.current.newCoaches.length
};

if (newProcedural.length < 30) throw new Error(`Expected a meaningful rookie sample, got ${newProcedural.length}.`);
if (domesticRate < 0.82 || domesticRate > 0.98) throw new Error(`Domestic spawn rate out of expected range: ${report.domesticSpawnRate}%`);
if (!playerRetirementRecorded) throw new Error('Elite player retirement was not carried into preseason.');
if (!coachRetirementRecorded) throw new Error('Coach retirement was not carried into preseason.');
if (!newEliteCoachRecorded) throw new Error('Elite coach replacement was not exposed in preseason.');
if (!ownerChangeRecorded) throw new Error('Major-club owner change was not exposed in preseason.');

console.log(JSON.stringify(report, null, 2));
