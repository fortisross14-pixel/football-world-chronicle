import { createWorld, simulateToSeasonEnd, startNextSeason } from '../src/engine.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Owner lifecycle + dynasty payroll escalation on a completed real season.
const world = createWorld(272727);
const terms = world.owners.filter((owner) => owner.clubId).map((owner) => owner.yearsRemaining);
assert(Math.min(...terms) >= 4 && Math.max(...terms) <= 12, `Owner terms must be 4-12 years, got ${Math.min(...terms)}-${Math.max(...terms)}`);
const billionaire = world.owners.find((owner) => owner.clubId && owner.profile === 'billionaire');
assert(billionaire, 'Expected at least one billionaire owner');
assert((world.clubs.find((club) => club.id === billionaire.clubId)?.ownerAnnualInjection || 0) > 0, 'Billionaire owner must inject recurring cash');

simulateToSeasonEnd(world);
const madrid = world.clubs.find((club) => club.id === 'real-madrid');
assert(madrid, 'Real Madrid missing');
// Force the historical context of three consecutive huge seasons so the salary rule is deterministic.
for (const season of [1999, 2000, 2001]) {
  world.history.champions.push({ season, seasonLabel: `Y${season - 2000}`, competitionId: 'UCL', competitionName: 'European Champions League', winnerId: madrid.id, runnerUpId: 'milan', isInternational: false });
  world.history.clubSeasons.push({ season, seasonLabel: `Y${season - 2000}`, leagueId: 'ESP1', clubId: madrid.id, position: 1, played: 38, wins: 30, draws: 5, losses: 3, gf: 90, ga: 25, gd: 65, points: 95 });
}
const tracked = world.players.find((player) => player.clubId === madrid.id && ['common','uncommon','rare'].includes(player.rarity));
assert(tracked, 'Need a low-rarity Real Madrid player for salary escalation test');
tracked.contractYears = 5;
const salaryBefore = tracked.salary;
const outgoingOwner = world.owners.find((owner) => owner.clubId === madrid.id);
outgoingOwner.yearsRemaining = 1;
const outgoingOwnerId = outgoingOwner.id;
startNextSeason(world);
const payrollRow = world.current.offseason.payrollChanges.find((row) => row.clubId === madrid.id);
assert(payrollRow && payrollRow.risePct >= 23, `Three great seasons should trigger a major salary rise, got ${payrollRow?.risePct}`);
if (tracked.clubId === madrid.id) assert(tracked.salary > salaryBefore * 1.2, 'Successful dynasty player salary did not rise enough');
assert(world.owners.find((owner) => owner.id === outgoingOwnerId)?.status === 'retired', 'Expired president should leave office');
const replacement = world.owners.find((owner) => owner.clubId === madrid.id);
assert(replacement && replacement.id !== outgoingOwnerId && replacement.yearsRemaining >= 4 && replacement.yearsRemaining <= 12, 'President replacement lifecycle invalid');
const forcedDynastySale = world.current.transfers.find((row) => row.fromClubId === madrid.id && row.reason === 'Payroll pressure');
assert(forcedDynastySale, 'A severe three-season dynasty payroll should force at least one valuable asset sale');
assert(Number(madrid.payrollPressureRatio || 1) < 1.2, `Forced sale should relieve Real Madrid payroll pressure, got ${madrid.payrollPressureRatio}`);

// Hall of Fame: local awards plus one Mexican title are not enough; overwhelming regional dominance is.
const hall = createWorld(272728);
hall.current.completed = true;
const negative = hall.players.find((player) => player.status === 'active');
const positive = hall.players.find((player) => player.status === 'active' && player.id !== negative.id);
for (const player of [negative, positive]) {
  player.careerYear = player.careerLength - 1;
  player.contractYears = 5;
}
for (let y = 0; y < 5; y++) hall.history.playerSeasons.push({ season: 1997 + y, seasonLabel: `Y${y}`, playerId: negative.id, competitionId: 'MEX1', teamId: negative.clubId, isInternational: false, apps: 40, starts: 38, goals: 8, assists: 5, cleanSheets: 0, averageRating: 7.2 });
hall.history.honours.push({ season: 2000, seasonLabel: 'Y4', playerId: negative.id, competitionId: 'MEX1', competitionName: 'Liga MX', teamId: negative.clubId, isInternational: false });
for (let i = 0; i < 4; i++) hall.history.awards.push({ season: 1998 + i, rank: 1, playerId: negative.id, competitionId: 'MEX1', category: 'mvp', name: 'Liga MX Player of the Season' });

for (let y = 0; y < 10; y++) hall.history.playerSeasons.push({ season: 1991 + y, seasonLabel: `Y${y}`, playerId: positive.id, competitionId: 'MEX1', teamId: positive.clubId, isInternational: false, apps: 38, starts: 37, goals: 14, assists: 8, cleanSheets: 0, averageRating: 7.85 });
for (let i = 0; i < 10; i++) hall.history.honours.push({ season: 1991 + i, seasonLabel: `Y${i}`, playerId: positive.id, competitionId: 'MEX1', competitionName: 'Liga MX', teamId: positive.clubId, isInternational: false });
for (let i = 0; i < 3; i++) hall.history.honours.push({ season: 1994 + i, seasonLabel: `Y${i+3}`, playerId: positive.id, competitionId: 'CCC', competitionName: 'CONCACAF Champions Cup', teamId: positive.clubId, isInternational: false });
startNextSeason(hall);
assert(!hall.history.hallOfFamePlayers.some((row) => row.playerId === negative.id), 'One Mexican title plus local awards must not produce a Hall of Famer');
assert(hall.history.hallOfFamePlayers.some((row) => row.playerId === positive.id), 'Ten Mexican titles plus three CONCACAF titles should support Hall of Fame induction');

console.log(JSON.stringify({
  ownerTermRange: [Math.min(...terms), Math.max(...terms)],
  billionaireInjection: world.clubs.find((club) => club.id === billionaire.clubId)?.ownerAnnualInjection || 0,
  madridSalaryRisePct: payrollRow.risePct,
  madridPayrollPressureBeforeSales: payrollRow.pressure,
  madridPayrollPressureAfterSales: madrid.payrollPressureRatio,
  forcedDynastySale: {
    playerId: forcedDynastySale.playerId,
    toClubId: forcedDynastySale.toClubId,
    fee: forcedDynastySale.fee
  },
  oldPresidentRetired: true,
  hallNegativeInducted: false,
  hallRegionalDynastyInducted: true
}, null, 2));
