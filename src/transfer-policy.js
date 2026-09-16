export const isEstablishedDestination = (club) => Boolean(club && club.division !== 2
  && ['S', 'T1'].includes(club.financialTier) && club.reputation >= 85);

export function clubTenure(season, player) {
  return Math.max(0, season - (player.joinedClubSeason ?? player.debutSeason ?? season));
}

export function transferCommitmentFactor(season, player, seller, buyer, destinationGain = 0) {
  if (player.lastTransferSeason === season) return 0;
  if (player.transferProtectedUntilSeason && season < player.transferProtectedUntilSeason) return 0;
  if (!seller) return 1;
  const years = clubTenure(season, player);
  const settled = isEstablishedDestination(seller);
  const unhappy = (player.happiness ?? 70) < 30;
  const financialCrisis = Number(seller.payrollPressureRatio || 1) >= 1.55;
  const stepUp = !settled && destinationGain >= 7;
  // Nobody is resold in the same window. A genuine step up can follow a single
  // development season; a newly signed star gets time to establish a club era.
  if (years < 1) return 0;
  if (years < 3 && settled) return years >= 2 && (unhappy || financialCrisis) ? 0.18 : 0;
  if (years < 2) return stepUp ? 0.65 : (unhappy || financialCrisis) ? 0.2 : 0.06;
  if (unhappy || financialCrisis) return 0.85;
  if (stepUp) return 1;
  if (settled) {
    // A sideways move needs more than another rich club's interest. Contracts
    // and contentment continue to matter after the initial commitment expires.
    const contractEnding = (player.contractYears || 0) <= 1;
    return contractEnding ? 0.28 : years < 5 ? 0.07 : 0.16;
  }
  return (player.happiness ?? 70) >= 60 && (player.contractYears || 0) >= 2 ? 0.4 : 0.75;
}
