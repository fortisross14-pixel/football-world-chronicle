import { createWorld, simulateToSeasonEnd, startNextSeason } from '../src/engine.js';

const seasons = 3;
const world = createWorld(246813579);
let overlap = 0;
let awardPairs = 0;
const fiftyGoalSeasons = [];

for (let i = 0; i < seasons; i += 1) {
  simulateToSeasonEnd(world);
  const season = world.season;
  const awards = world.history.awards.filter((item) => item.season === season);
  const competitionIds = [...new Set(awards.filter((item) => item.category === 'mvp').map((item) => item.competitionId))];
  for (const competitionId of competitionIds) {
    const mvp = awards.find((item) => item.competitionId === competitionId && item.category === 'mvp');
    const scorer = awards.find((item) => item.competitionId === competitionId && item.category === 'top_scorer');
    if (!mvp || !scorer) continue;
    awardPairs += 1;
    if (mvp.playerId === scorer.playerId) overlap += 1;
  }
  const goals = new Map();
  for (const row of world.history.playerSeasons.filter((item) => item.season === season && !item.isInternational)) {
    goals.set(row.playerId, (goals.get(row.playerId) || 0) + row.goals);
  }
  for (const [playerId, total] of goals) {
    if (total >= 50) fiftyGoalSeasons.push({
      season,
      player: world.players.find((item) => item.id === playerId)?.name,
      goals: total
    });
  }
  if (i < seasons - 1) startNextSeason(world);
}

const report = {
  seasons,
  awardPairs,
  topScorerAlsoMvp: overlap,
  overlapRate: Number((overlap / awardPairs).toFixed(3)),
  fiftyGoalSeasons: fiftyGoalSeasons.length,
  highestGoalSeason: fiftyGoalSeasons.sort((a, b) => b.goals - a.goals)[0] || null,
  eliteTransfers: world.history.transfers.filter((move) => {
    const player = world.players.find((item) => item.id === move.playerId);
    return ['generational', 'legend', 'epic'].includes(player?.rarity);
  }).length
};

console.log(JSON.stringify(report, null, 2));
if (report.overlapRate > 0.35) process.exitCode = 2;
if (report.fiftyGoalSeasons > seasons) process.exitCode = 2;
