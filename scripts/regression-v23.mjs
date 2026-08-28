import assert from 'node:assert/strict';
import { createWorld, simulateToSeasonEnd, startNextSeason, upgradeWorld } from '../src/engine.js';

const state = createWorld(230023);
assert.equal(state.dataRevision, 15);
assert.ok(Array.isArray(state.history.hallOfFamePlayers));
assert.ok(Array.isArray(state.history.clubLegends));
assert.ok(Array.isArray(state.history.clubPowerRankings));
assert.ok(Array.isArray(state.history.leaguePowerRankings));
assert.ok(Array.isArray(state.preferences.favoriteCoachIds));
assert.ok(Array.isArray(state.preferences.favoriteNationIds));
assert.ok(Array.isArray(state.preferences.favoriteCompetitionIds));

simulateToSeasonEnd(state);
assert.ok(state.history.clubPowerRankings.length >= 40, 'season-end club power rankings should be archived');
assert.ok(state.history.leaguePowerRankings.length >= 20, 'league strength rankings should be archived');
const derby = state.history.landmarkMatches.find((match) =>
  (match.homeId === 'real-madrid' && match.awayId === 'atletico') ||
  (match.homeId === 'atletico' && match.awayId === 'real-madrid')
);
assert.ok(derby, 'static rivalry matches should survive season compaction');



// Force one decorated veteran through retirement to verify permanent Hall and club-legend induction.
const veteran = state.players.find((player) => player.status === 'active' && player.clubId && player.position === 'FW');
assert.ok(veteran, 'a veteran test player should exist');
const veteranClub = veteran.clubId;
for (let i = 0; i < 9; i += 1) {
  const season = state.season - 8 + i;
  state.history.playerSeasons.push({ season, seasonLabel: `${season}-${String((season+1)%100).padStart(2,'0')}`, playerId: veteran.id, teamId: veteranClub, competitionId: i % 2 ? 'UCL' : state.clubs.find((club)=>club.id===veteranClub)?.leagueId, isInternational: false, apps: 32, goals: 22, assists: 9, cleanSheets: 0, averageRating: 7.9 });
}
for (const [index, competitionId] of ['UCL','UCL','UCL',state.clubs.find((club)=>club.id===veteranClub)?.leagueId,state.clubs.find((club)=>club.id===veteranClub)?.leagueId].entries()) {
  state.history.honours.push({ season: state.season-index, seasonLabel: state.current.seasonLabel, playerId: veteran.id, teamId: veteranClub, competitionId, isInternational: false, competitionName: competitionId });
}
state.history.awards.push({ season: state.season, seasonLabel: state.current.seasonLabel, playerId: veteran.id, rank: 1, category: 'ballon_dor', name: "Ballon d'Or" });
veteran.careerYear = veteran.careerLength - 1;
startNextSeason(state);
assert.ok(state.history.hallOfFamePlayers.some((row)=>row.playerId===veteran.id), 'decorated retired player should be inducted into Hall of Fame');
assert.ok(state.history.clubLegends.some((row)=>row.playerId===veteran.id && row.clubId===veteranClub), 'decorated retired player should become a club legend');

const old = structuredClone(state);
old.dataRevision = 14;
delete old.history.hallOfFamePlayers;
delete old.history.clubLegends;
delete old.history.clubPowerRankings;
delete old.history.leaguePowerRankings;
delete old.preferences.favoriteCoachIds;
delete old.preferences.favoriteNationIds;
delete old.preferences.favoriteCompetitionIds;
upgradeWorld(old);
assert.equal(old.dataRevision, 15);
assert.ok(Array.isArray(old.history.hallOfFamePlayers));
assert.ok(Array.isArray(old.history.clubLegends));
assert.ok(Array.isArray(old.preferences.favoriteCompetitionIds));

console.log(JSON.stringify({
  revision: state.dataRevision,
  clubPowerRows: state.history.clubPowerRankings.length,
  leaguePowerRows: state.history.leaguePowerRankings.length,
  rivalryStored: derby ? `${derby.homeId}-${derby.awayId}` : null,
  hallInducteesAfterTestRetirement: state.history.hallOfFamePlayers.length,
  clubLegendsAfterTestRetirement: state.history.clubLegends.length
}, null, 2));
