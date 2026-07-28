import { createWorld, simulateToSeasonEnd, startNextSeason } from '../src/engine.js';

const world = createWorld(10102026);
const coachById = new Map(world.coaches.map((coach) => [coach.id, coach]));
const domesticByTier = {};
for (const team of world.nationalTeams) {
  const coach = coachById.get(team.coachId);
  const row = domesticByTier[team.tier] ||= { total: 0, domestic: 0 };
  row.total += 1;
  if (coach?.nationality === team.id) row.domestic += 1;
}
for (const row of Object.values(domesticByTier)) row.rate = Number((row.domestic / row.total).toFixed(3));

const eliteRookies = world.players.filter((player) => ['generational','legend','epic'].includes(player.rarity) && player.careerYear <= 2);
const rookieClubReputations = eliteRookies.map((player) => world.clubs.find((club) => club.id === player.clubId)?.reputation || 0);
const nonEliteRookies = rookieClubReputations.filter((rep) => rep < 84).length;
const greekNames = world.players.filter((player) => player.nationality === 'gre').slice(0, 12).map((player) => player.name);

simulateToSeasonEnd(world);
startNextSeason(world);
const newElite = world.current.newStars.map((row) => world.players.find((player) => player.id === row.playerId)).filter(Boolean);

const report = {
  domesticByTier,
  eliteRookies: eliteRookies.length,
  eliteRookiesOutsideEliteClubs: nonEliteRookies,
  outsideEliteRate: eliteRookies.length ? Number((nonEliteRookies / eliteRookies.length).toFixed(3)) : 0,
  greekNames,
  secondSeasonEliteDebuts: newElite.map((player) => ({ name: player.name, rarity: player.rarity, club: world.clubs.find((club) => club.id === player.clubId)?.name || 'Free agent', careerYear: player.careerYear + 1 }))
};
console.log(JSON.stringify(report, null, 2));
if (domesticByTier[1].rate < 0.9 || domesticByTier[2].rate < 0.75) process.exitCode = 2;
if (eliteRookies.length && report.outsideEliteRate < 0.45) process.exitCode = 2;
if (greekNames.some((name) => /Smith|Brown|Taylor|Cooper|Turner/.test(name))) process.exitCode = 2;
