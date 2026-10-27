// Breakout stars and rich clubs: do elite players leave small clubs, and do rich clubs spend?
//   node scripts/market-stars.mjs                 (seeds 314159 and 271828 in parallel, 8 seasons)
//   node scripts/market-stars.mjs 314159 8        (one seed, prints JSON for the parent)
//   MS_ENGINE=path/to/engine.js                   (measure another copy of the engine)
//   MS_JSON=path                                  (also write the merged report)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ELITE = new Set(['epic', 'legend', 'generational']);
const SMALL_REP = 82;
const STAR_RATING = 88;

async function runSeed(seed, seasons) {
  const enginePath = process.env.MS_ENGINE ? pathToFileURL(fs.realpathSync(process.env.MS_ENGINE)).href : new URL('../src/engine.js', import.meta.url).href;
  const { createWorld, simulateToSeasonEnd, startNextSeason } = await import(enginePath);
  const world = createWorld(seed);
  const spells = new Map(); // `${playerId}:${clubId}` -> spell
  const perSeason = [];
  const fees90 = [];
  const snapshot = () => {
    const clubs = new Map(world.clubs.map((club) => [club.id, club]));
    const stranded = [];
    const seen = new Set();
    for (const player of world.players) {
      if (player.status !== 'active' || !player.clubId || !ELITE.has(player.rarity) || player.rating < STAR_RATING) continue;
      const club = clubs.get(player.clubId);
      if (!club || (club.reputation || 0) >= SMALL_REP) continue;
      const key = `${player.id}:${club.id}`;
      seen.add(key);
      let spell = spells.get(key);
      if (!spell) {
        spell = { playerId: player.id, name: player.name, clubId: club.id, club: club.name, rarity: player.rarity, loyal: (player.traits || []).includes('loyal'), first: world.season, seasons: 0, end: null, open: true,
          // Seasons already completed at the club when he first counted (0 = debut or arrival season).
          tenureAtStart: Number.isFinite(player.clubJoinedSeason) ? world.season - player.clubJoinedSeason : null };
        spells.set(key, spell);
      }
      spell.seasons += 1;
      spell.last = world.season;
      spell.rating = player.rating;
      spell.age = world.season - player.birthYear;
      stranded.push({ name: player.name, rarity: player.rarity, rating: player.rating, age: world.season - player.birthYear, club: club.name, rep: Math.round(club.reputation), seasonsHere: spell.seasons });
    }
    // Close spells that are no longer counted this season.
    const players = new Map(world.players.map((player) => [player.id, player]));
    for (const [key, spell] of spells) {
      if (!spell.open || seen.has(key)) continue;
      spell.open = false;
      const player = players.get(spell.playerId);
      spell.end = player?.status !== 'active' ? 'retired' : player.clubId !== spell.clubId ? 'moved' : 'dropped';
    }
    return stranded;
  };
  const started = Date.now();
  const initial = snapshot();
  perSeason.push({ season: world.season, stranded: initial.length, eliteMoves: null, examples: initial.slice(0, 4) });
  for (let year = 0; year < seasons; year++) {
    simulateToSeasonEnd(world);
    startNextSeason(world);
    const players = new Map(world.players.map((player) => [player.id, player]));
    const clubs = new Map(world.clubs.map((club) => [club.id, club]));
    const moves = world.history.transfers.filter((move) => move.season === world.season);
    const eliteMoves = moves.filter((move) => ELITE.has(players.get(move.playerId)?.rarity));
    for (const move of eliteMoves) {
      const player = players.get(move.playerId);
      if (player.rating >= 90 && !move.freeTransfer && move.fee > 0) fees90.push({ season: world.season, name: player.name, rarity: player.rarity, rating: player.rating, age: world.season - player.birthYear, from: clubs.get(move.fromClubId)?.name, to: clubs.get(move.toClubId)?.name, fee: move.fee, rivals: (move.biddingWar?.rivalClubIds || []).map((id) => clubs.get(id)?.name) });
    }
    const stranded = snapshot();
    const breakoutMoves = eliteMoves.filter((move) => (clubs.get(move.fromClubId)?.reputation || 99) < SMALL_REP && (players.get(move.playerId)?.rating || 0) >= STAR_RATING).length;
    const biddingWars = eliteMoves.filter((move) => move.biddingWar).length;
    perSeason.push({ season: world.season, stranded: stranded.length, eliteMoves: eliteMoves.length, breakoutMoves, biddingWars, examples: stranded.sort((a, b) => b.seasonsHere - a.seasonsHere || b.rating - a.rating).slice(0, 4) });
  }
  const clubs = [...world.clubs].sort((a, b) => (b.finances || 0) - (a.finances || 0));
  const richest = clubs.slice(0, 20).map((club) => ({ club: club.name, country: club.country, rep: Math.round(club.reputation), cash: Math.round(club.finances), budget: Math.round(club.transferBudget || 0), payroll: Math.round(club.currentPayroll || 0) }));
  // Net spend over the last three windows, to tell spending giants from hoarders.
  const recentSpend = new Map();
  for (const move of world.history.transfers) {
    if (move.season <= world.season - 3) continue;
    recentSpend.set(move.toClubId, (recentSpend.get(move.toClubId) || 0) + Number(move.fee || 0));
  }
  const over400 = clubs.filter((club) => club.finances > 400).map((club) => ({ club: club.name, cash: Math.round(club.finances), spent3y: Math.round(recentSpend.get(club.id) || 0) }));
  return { seed, seasons, seconds: Math.round((Date.now() - started) / 1000), perSeason, spells: [...spells.values()], fees90, richest, over400, europeanTop20: richest.filter((row) => world.clubs.find((club) => club.name === row.club)?.confederation === 'Europe').length };
}

function leftShares(spells) {
  // Known outcome after k seasons: moved within k, or still there beyond k. Spells that
  // ended by retirement or a rating drop, or are too recent, are left out.
  const rows = {};
  for (const k of [1, 2, 3]) {
    const left = spells.filter((spell) => spell.end === 'moved' && spell.seasons <= k);
    const eligible = [...left, ...spells.filter((spell) => spell.seasons > k)];
    rows[k] = eligible.length ? `${Math.round(left.length / eligible.length * 100)}% (${left.length}/${eligible.length})` : 'n/a';
  }
  return rows;
}

function summarise(results) {
  const all = results.flatMap((row) => row.spells.map((spell) => ({ ...spell, seed: row.seed })));
  const nonLoyal = all.filter((spell) => !spell.loyal);
  const stays = {};
  for (const spell of all) stays[spell.seasons] = (stays[spell.seasons] || 0) + 1;
  const fees = results.flatMap((row) => row.fees90).map((row) => row.fee).sort((a, b) => a - b);
  const quantile = (q) => fees.length ? fees[Math.min(fees.length - 1, Math.floor(q * fees.length))] : null;
  const seasonRows = results.flatMap((row) => row.perSeason.filter((item) => item.eliteMoves !== null));
  return {
    strandedPerSeason: results.map((row) => ({ seed: row.seed, values: row.perSeason.map((item) => item.stranded) })),
    eliteMovesPerWindow: results.map((row) => ({ seed: row.seed, values: row.perSeason.filter((item) => item.eliteMoves !== null).map((item) => item.eliteMoves) })),
    breakoutMovesPerWindow: results.map((row) => ({ seed: row.seed, values: row.perSeason.filter((item) => item.eliteMoves !== null).map((item) => item.breakoutMoves) })),
    biddingWars: seasonRows.reduce((sum, item) => sum + (item.biddingWars || 0), 0),
    spells: all.length,
    staysBySeasons: stays,
    leftAfter_nonLoyal: leftShares(nonLoyal),
    leftAfter_loyal: leftShares(all.filter((spell) => spell.loyal)),
    // Same shares, counted in seasons at the club, for stars who broke out in their first season there.
    leftAfterClubSeasons_nonLoyal: leftShares(nonLoyal.filter((spell) => spell.tenureAtStart === 0)),
    longestStays: all.sort((a, b) => b.seasons - a.seasons).slice(0, 6).map((spell) => `${spell.name} (${spell.rarity}, ${spell.rating}) ${spell.seasons}y at ${spell.club}${spell.loyal ? ' [loyal]' : ''} → ${spell.end || 'still there'}`),
    fees90: { count: fees.length, min: fees[0] ?? null, median: quantile(0.5), p90: quantile(0.9), max: fees.at(-1) ?? null },
    topFees90: results.flatMap((row) => row.fees90).sort((a, b) => b.fee - a.fee).slice(0, 6),
    richest: results.map((row) => ({ seed: row.seed, europeanInTop20: row.europeanTop20, top20: row.richest, over400: row.over400 })),
    seconds: results.map((row) => row.seconds)
  };
}

const self = fileURLToPath(import.meta.url);
const [seedArg, seasonsArg] = process.argv.slice(2);
if (seedArg) {
  const result = await runSeed(Number(seedArg), Number(seasonsArg || 8));
  process.stdout.write(`@@RESULT${JSON.stringify(result)}\n`);
} else {
  const seasons = Number(process.env.MS_SEASONS || 8);
  const seeds = (process.env.MS_SEEDS || '314159,271828').split(',').map(Number);
  const results = await Promise.all(seeds.map((seed) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [self, String(seed), String(seasons)], { env: process.env });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('close', (code) => {
      const line = out.split('\n').find((item) => item.startsWith('@@RESULT'));
      if (code !== 0 || !line) reject(new Error(`seed ${seed} failed (${code})`)); else resolve(JSON.parse(line.slice(8)));
    });
  })));
  const report = summarise(results);
  if (process.env.MS_JSON) fs.writeFileSync(process.env.MS_JSON, JSON.stringify({ report, results }, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
