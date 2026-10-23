// Rarity calibration: do elite players drive awards, goals and major titles?
// Plays 20-season worlds and reports by rarity: Ballon d'Or winners and podium, World
// Golden Boot, top-5 scorers of the big-5 leagues (and how often an Epic+ forward tops a
// league), the elite make-up of UCL/WC/EURO/COPA/CWC winners, and whether players below
// Epic grow into the Epic band. Run on its own (npm run calibration-rarity) or as part
// of scripts/calibration.mjs (CAL_RARITY=1).
//   RARITY_SEEDS    comma-separated seeds (default 11,22,33)
//   RARITY_SEASONS  seasons per world (default 20)
//   CAL_ENGINE      engine path (default ../src/engine.js)
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const RANK = { common: 1, uncommon: 2, rare: 3, epic: 4, legend: 5, generational: 6 };
const RARITIES = ['generational', 'legend', 'epic', 'rare', 'uncommon', 'common'];
const BIG5 = ['ENG1', 'ESP1', 'ITA1', 'GER1', 'FRA1'];
const MAJOR = ['UCL', 'WC', 'EURO', 'COPA', 'CWC'];

export async function runRarityCalibration({ seeds, seasons, engineUrl }) {
  const { createWorld, simulateToSeasonEnd, startNextSeason } = await import(engineUrl);
  const tally = () => Object.fromEntries(RARITIES.map((rarity) => [rarity, 0]));
  const out = {
    ballonWinners: tally(), ballonPodium: tally(), goldenBoot: tally(), big5TopFive: tally(),
    leagueTopScorerEpicPlusForward: { seasons: 0, hits: 0 },
    winners: Object.fromEntries(MAJOR.map((id) => [id, { editions: 0, legendPlus: 0, epicOnly4: 0, epicOnlyUnder4: 0, noEpicPlus: 0, examples: [] }])),
    development: { seasonsSampled: 0, belowEpicAt85: 0, belowEpicMaxRating: 0, rareAt85Plus: 0 }
  };
  const startedAt = performance.now();
  for (const seed of seeds) {
    const world = createWorld(seed);
    for (let index = 0; index < seasons; index += 1) {
      if (index) startNextSeason(world);
      simulateToSeasonEnd(world);
      const season = world.season;
      const players = new Map(world.players.map((player) => [player.id, player]));
      const rarityOf = (id) => players.get(id)?.rarity || 'common';
      for (const award of world.history.awards.filter((row) => row.season === season)) {
        if (award.category === 'ballon_dor') { out.ballonPodium[rarityOf(award.playerId)] += 1; if (award.rank === 1) out.ballonWinners[rarityOf(award.playerId)] += 1; }
        if (award.category === 'golden_boot' && award.rank === 1) out.goldenBoot[rarityOf(award.playerId)] += 1;
      }
      const rows = world.history.playerSeasons.filter((row) => row.season === season);
      for (const leagueId of BIG5) {
        const scorers = rows.filter((row) => row.competitionId === leagueId).sort((a, b) => b.goals - a.goals).slice(0, 5);
        for (const row of scorers) out.big5TopFive[rarityOf(row.playerId)] += 1;
        if (scorers[0]) {
          out.leagueTopScorerEpicPlusForward.seasons += 1;
          const top = players.get(scorers[0].playerId);
          if (top && RANK[top.rarity] >= 4 && top.position === 'FW') out.leagueTopScorerEpicPlusForward.hits += 1;
        }
      }
      for (const champion of world.history.champions.filter((row) => row.season === season && MAJOR.includes(row.competitionId))) {
        const squad = rows.filter((row) => row.competitionId === champion.competitionId && row.teamId === champion.winnerId && row.apps > 0).map((row) => players.get(row.playerId)).filter(Boolean);
        const legendPlus = squad.filter((player) => RANK[player.rarity] >= 5).length;
        const epics = squad.filter((player) => player.rarity === 'epic').length;
        const row = out.winners[champion.competitionId];
        row.editions += 1;
        if (legendPlus) row.legendPlus += 1;
        else if (epics >= 4) row.epicOnly4 += 1;
        else if (epics) row.epicOnlyUnder4 += 1;
        else { row.noEpicPlus += 1; if (row.examples.length < 6) row.examples.push(`${seed}:${season}:${champion.winnerId}`); }
      }
      out.development.seasonsSampled += 1;
      for (const player of world.players) {
        if (player.status !== 'active' || RANK[player.rarity] >= 4) continue;
        if (player.rating >= 85) out.development.belowEpicAt85 += 1;
        if (player.rarity === 'rare' && player.rating >= 85) out.development.rareAt85Plus += 1;
        out.development.belowEpicMaxRating = Math.max(out.development.belowEpicMaxRating, player.rating);
      }
    }
  }
  const share = (counts) => {
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
    const epicPlus = (counts.generational + counts.legend + counts.epic) / total;
    return { counts, epicPlus: Number(epicPlus.toFixed(3)), legendPlus: Number(((counts.generational + counts.legend) / total).toFixed(3)) };
  };
  const winners = Object.fromEntries(Object.entries(out.winners).map(([id, row]) => [id, {
    editions: row.editions,
    withLegendPlus: row.editions ? Number((row.legendPlus / row.editions).toFixed(3)) : null,
    epicOnly4Plus: row.epicOnly4, epicOnlyUnder4: row.epicOnlyUnder4, noEpicPlus: row.noEpicPlus,
    noEpicPlusRate: row.editions ? Number((row.noEpicPlus / row.editions).toFixed(3)) : null,
    examplesNoEpicPlus: row.examples
  }]));
  return {
    seeds, seasons,
    targets: { ballonWinnerEpicPlus: 0.95, ballonPodiumEpicPlus: 0.85, goldenBootEpicPlus: 0.8, uclWcLegendPlus: 0.75, uclWcNoEpicPlus: 0.05 },
    ballonDorWinners: share(out.ballonWinners),
    ballonDorPodium: share(out.ballonPodium),
    worldGoldenBoot: share(out.goldenBoot),
    big5TopFiveScorers: share(out.big5TopFive),
    leagueTopScorerIsEpicPlusForward: Number((out.leagueTopScorerEpicPlusForward.hits / Math.max(1, out.leagueTopScorerEpicPlusForward.seasons)).toFixed(3)),
    winners,
    development: {
      belowEpicPlayersAt85PlusPerSeason: Number((out.development.belowEpicAt85 / Math.max(1, out.development.seasonsSampled)).toFixed(1)),
      rareAt85PlusPerSeason: Number((out.development.rareAt85Plus / Math.max(1, out.development.seasonsSampled)).toFixed(1)),
      highestRatingBelowEpic: out.development.belowEpicMaxRating
    },
    seconds: Number(((performance.now() - startedAt) / 1000).toFixed(1))
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seeds = String(process.env.RARITY_SEEDS || '11,22,33').split(',').map(Number);
  const seasons = Number(process.env.RARITY_SEASONS || 20);
  const engineUrl = pathToFileURL(resolve(process.env.CAL_ENGINE || fileURLToPath(new URL('../src/engine.js', import.meta.url)))).href;
  process.stdout.write(`${JSON.stringify(await runRarityCalibration({ seeds, seasons, engineUrl }), null, 2)}\n`);
}
