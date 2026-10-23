// Coach and academy calibration: coach rarity counts, where elite coaches work by career
// phase, and (when the engine has academies) academy scores, youth intake and the
// player population. Run on its own (npm run calibration-coaches) or as part of
// scripts/calibration.mjs.
//   COACH_SEEDS    comma-separated seeds (default 11,22)
//   COACH_SEASONS  seasons per world (default 10)
//   CAL_ENGINE     engine path (default ../src/engine.js)
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const RARITIES = ['generational', 'legend', 'epic', 'rare', 'uncommon', 'common'];
const ELITE_COUNTRY_GROUPS = {
  core: new Set(['bra', 'arg', 'ger', 'fra', 'ita', 'esp', 'eng']),
  second: new Set(['por', 'uru', 'ned', 'bel']),
  third: new Set(['col', 'chi', 'mex', 'usa', 'nga', 'cmr', 'mar', 'egy', 'pol', 'rus', 'gre', 'nor', 'swe', 'jpn', 'kor'])
};

function phaseOf(coach) {
  const length = Math.max(1, coach.careerLength || 10);
  const share = (coach.careerYear || 0) / length;
  return share < 0.3 ? 'early' : share > 0.75 ? 'late' : 'peak';
}

export async function runCoachCalibration({ seeds, seasons, engineUrl }) {
  const engine = await import(engineUrl);
  const { createWorld, simulateToSeasonEnd, startNextSeason } = engine;
  const blank = () => ({ topClub: 0, otherClub: 0, nationalTeam: 0, free: 0 });
  const out = {
    coachCounts: { start: Object.fromEntries(RARITIES.map((r) => [r, 0])), end: Object.fromEntries(RARITIES.map((r) => [r, 0])) },
    eliteJobs: { early: blank(), peak: blank(), late: blank() },
    epicJobs: { topClub: 0, secondLine: 0, secondaryLeagueTop: 0, nationalTeam: 0, otherClub: 0, free: 0 },
    academies: null
  };
  const academy = { scores: [], stars: [0, 0, 0, 0, 0], pinned: 0, intake: {}, intakeSeasons: 0, eliteByGroup: { core: 0, second: 0, third: 0, other: 0 }, population: [], topUps: 0 };
  const startedAt = performance.now();
  for (const seed of seeds) {
    const world = createWorld(seed);
    const countCoaches = (target) => { for (const coach of world.coaches) if (coach.status !== 'retired') target[coach.rarity] = (target[coach.rarity] || 0) + 1; };
    countCoaches(out.coachCounts.start);
    for (let index = 0; index < seasons; index += 1) {
      if (index) startNextSeason(world);
      // Jobs at the start of each season (after the coaching market).
      const european = world.clubs.filter((club) => club.confederation === 'Europe' && club.division === 1).sort((a, b) => b.reputation - a.reputation);
      const top12 = new Set(european.slice(0, 12).map((club) => club.id));
      const top5Leagues = new Set(['ENG1', 'ESP1', 'ITA1', 'GER1', 'FRA1']);
      const leagueRank = new Map();
      for (const club of world.clubs.filter((item) => item.division === 1)) {
        const peers = world.clubs.filter((item) => item.leagueId === club.leagueId && item.division === 1).sort((a, b) => b.reputation - a.reputation);
        leagueRank.set(club.id, peers.indexOf(club) + 1);
      }
      for (const coach of world.coaches) {
        if (coach.status === 'retired') continue;
        const club = coach.clubId ? world.clubs.find((item) => item.id === coach.clubId) : null;
        const category = coach.nationalTeamId ? 'nationalTeam' : !club ? 'free' : top12.has(club.id) ? 'topClub' : 'otherClub';
        if (coach.rarity === 'generational' || coach.rarity === 'legend') out.eliteJobs[phaseOf(coach)][category] += 1;
        if (coach.rarity === 'epic') {
          if (category !== 'otherClub') out.epicJobs[category] += 1;
          else if (top5Leagues.has(club.leagueId)) out.epicJobs.secondLine += 1;
          else if ((leagueRank.get(club.id) || 99) <= 3) out.epicJobs.secondaryLeagueTop += 1;
          else out.epicJobs.otherClub += 1;
        }
      }
      if (typeof engine.getClubAcademy === 'function') {
        const intake = engine.getYouthIntake ? engine.getYouthIntake(world) : [];
        academy.intakeSeasons += index ? 1 : 0;
        if (index) academy.topUps += world.current.eliteTopUps || 0;
        for (const row of index ? intake : []) {
          academy.intake[row.rarity] = (academy.intake[row.rarity] || 0) + 1;
          if (['epic', 'legend', 'generational'].includes(row.rarity)) {
            const nationality = world.players.find((player) => player.id === row.playerId)?.nationality;
            const group = ELITE_COUNTRY_GROUPS.core.has(nationality) ? 'core' : ELITE_COUNTRY_GROUPS.second.has(nationality) ? 'second' : ELITE_COUNTRY_GROUPS.third.has(nationality) ? 'third' : 'other';
            academy.eliteByGroup[group] += 1;
          }
        }
        const active = world.players.filter((player) => player.status === 'active');
        const counts = {};
        for (const player of active) counts[player.rarity] = (counts[player.rarity] || 0) + 1;
        academy.population.push({ seed, season: world.season, total: active.length, generational: counts.generational || 0, legend: counts.legend || 0, epic: counts.epic || 0 });
        simulateToSeasonEnd(world);
        if (index === seasons - 1) {
          for (const club of world.clubs.filter((item) => item.division === 1)) {
            const info = engine.getClubAcademy(world, club.id);
            if (!info) continue;
            academy.scores.push(info.score);
            academy.stars[info.stars - 1] += 1;
            if (info.score <= 1 || info.score >= 99) academy.pinned += 1;
          }
        }
      } else {
        simulateToSeasonEnd(world);
      }
    }
    countCoaches(out.coachCounts.end);
  }
  const per = (value) => Number((value / seeds.length).toFixed(1));
  for (const key of ['start', 'end']) out.coachCounts[key] = Object.fromEntries(Object.entries(out.coachCounts[key]).map(([rarity, value]) => [rarity, per(value)]));
  const share = (row) => { const total = Object.values(row).reduce((sum, value) => sum + value, 0) || 1; return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number((value / total).toFixed(3))])); };
  const report = {
    seeds, seasons,
    targets: { coaches: { generational: [2, 3], legend: [8, 10], epic: [15, 20], rare: 40 }, primeEliteAtTopClubs: 0.8, primeEliteAtNationalTeams: 0.1 },
    coachCountsPerWorld: out.coachCounts,
    eliteCoachJobsByPhase: Object.fromEntries(Object.entries(out.eliteJobs).map(([phase, row]) => [phase, { seasons: Object.values(row).reduce((s, v) => s + v, 0), ...share(row) }])),
    epicCoachJobs: share(out.epicJobs)
  };
  if (academy.scores.length) {
    const scores = academy.scores.sort((a, b) => a - b);
    const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    const totals = academy.population.map((row) => row.total);
    report.academies = {
      clubs: scores.length,
      mean: Number(mean.toFixed(1)),
      p10: scores[Math.floor(scores.length * 0.1)], p50: scores[Math.floor(scores.length * 0.5)], p90: scores[Math.floor(scores.length * 0.9)],
      in60to100: Number((scores.filter((value) => value >= 60).length / scores.length).toFixed(3)),
      in0to40: Number((scores.filter((value) => value < 40).length / scores.length).toFixed(3)),
      starShare: academy.stars.map((count) => Number((count / scores.length).toFixed(3))),
      pinnedAt0or100: academy.pinned,
      youthIntakePerSeasonByRarity: Object.fromEntries(RARITIES.map((rarity) => [rarity, Number(((academy.intake[rarity] || 0) / Math.max(1, academy.intakeSeasons)).toFixed(1))])),
      eliteYouthByCountryGroup: academy.eliteByGroup,
      eliteSafetyNetPlayersPerSeason: Number((academy.topUps / Math.max(1, academy.intakeSeasons)).toFixed(2)),
      population: { min: Math.min(...totals), max: Math.max(...totals), minGenerational: Math.min(...academy.population.map((row) => row.generational)), maxGenerational: Math.max(...academy.population.map((row) => row.generational)), minLegend: Math.min(...academy.population.map((row) => row.legend)), maxLegend: Math.max(...academy.population.map((row) => row.legend)), minEpic: Math.min(...academy.population.map((row) => row.epic)), maxEpic: Math.max(...academy.population.map((row) => row.epic)) }
    };
  }
  report.seconds = Number(((performance.now() - startedAt) / 1000).toFixed(1));
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seeds = String(process.env.COACH_SEEDS || '11,22').split(',').map(Number);
  const seasons = Number(process.env.COACH_SEASONS || 10);
  const engineUrl = pathToFileURL(resolve(process.env.CAL_ENGINE || fileURLToPath(new URL('../src/engine.js', import.meta.url)))).href;
  process.stdout.write(`${JSON.stringify(await runCoachCalibration({ seeds, seasons, engineUrl }), null, 2)}\n`);
}
