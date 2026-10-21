# Match and world calibration

`npm run calibration` simulates several seeds over several seasons and reports match
statistics per competition tier, how often favourites win by strength gap, tactical
style results, rating levels and how widely titles and awards are spread. Defaults: seeds
314159, 271828 and 161803, six seasons each. Override with `CAL_SEEDS`, `CAL_SEASONS`;
`CAL_JSON=path` also writes the report. `CAL_ENGINE=scripts/fixtures/legacy-r25/src/engine.js`
measures the frozen v3.16.1 engine.

`npm run perf` times `simulateToSeasonEnd()` and `startNextSeason()` over 20 seasons, the
same way `balance-v316` does, and reports the final save size. `PERF_ENGINE` times another
copy of the engine.

Raw reports live in `docs/calibration/`.

## Real-world targets

| Metric | Target |
|---|---|
| Goals per match | 2.6–2.8 |
| Home / draw / away (league) | ~45 / 27 / 28 % |
| Shots per team | 12–13 |
| Shots on target per team | 4–5 |
| Corners per team | 4.5–5.5 |
| Yellow cards per team | ~2 |
| Red cards per match | ~0.1 |
| Clean-sheet rate | 26–32 % |

## Phase 0 baseline (v3.16.1, data revision 25)

Three seeds × six seasons, 238,385 detailed matches.

| Metric | Overall | Elite leagues | Other full leagues | Cups | Continental | International |
|---|---:|---:|---:|---:|---:|---:|
| Goals / match | 2.42 | 2.41 | 2.41 | 2.58 | 2.41 | 2.56 |
| Home / draw / away | 44.6 / 21.7 / 33.7 | 44.0 / 21.3 / 34.7 | 44.6 / 21.8 / 33.6 | — | 45.0 / 22.4 / 32.6 | 45.6 / 19.8 / 34.6 |
| Shots / team | 9.3 | 9.2 | 9.3 | 9.5 | 9.4 | 9.7 |
| On target / team | 3.7 | 3.7 | 3.7 | 3.9 | 3.8 | 4.0 |
| Corners / team | 2.8 | 2.8 | 2.8 | 2.8 | 2.8 | 3.0 |
| Yellows / team | 1.65 | 1.63 | 1.66 | 1.65 | 1.63 | 1.61 |
| Reds / match | 0.11 | 0.11 | 0.11 | 0.11 | 0.11 | 0.11 |
| Clean-sheet rate | 40.2 % | 42.2 % | 40.0 % | 38.9 % | 38.9 % | 39.7 % |
| Extra time / penalties (knockouts) | 20.4 / 13.3 % | — | — | 20.3 / 13.2 % | 25.2 / 17.0 % | 20.6 / 14.4 % |

Condensed leagues (tables only): 2.23 goals per match, 26.6 % draws, 36.3 % clean sheets.

Favourite win rate by strength gap (incl. +2 home edge): 0–3: 42 %, 3–6: 54 %, 6–10: 68 %,
10–15: 82 %, 15+: 92 % (upsets 1.1 %).

Spread over six seasons per seed: 4.7 distinct Ballon d'Or winners from 4.3 clubs, 4.3
distinct World Golden Boot winners averaging **58 league goals**, 4.0 distinct UCL winners,
2.7 distinct champions per elite league (one club averaged 3.6 of 6 titles), elite-league
top scorers averaging **41 goals**. Ballon d'Or podiums: 29 FW, 20 MF, 4 DF, 1 GK. Average
match rating: GK 6.55, DF 6.60, MF 6.75, FW 6.78. No substitutions are simulated.

Baseline judgement: too few goals, draws, shots and corners, too many clean sheets and away
wins, and inflated top-scorer tallies. Favourites are close to certain at large gaps.

### Baseline performance (this machine)

| Seed | Season | Offseason | Slowest offseason | Save after 20 seasons |
|---:|---:|---:|---:|---:|
| 271828 | 2.13 s | 8.63 s | 14.45 s | 152 MB |
| 314159 | 1.84 s | 8.13 s | 11.06 s | 152 MB |

This machine is about 15–25 % slower than the figures quoted for v3.16 (1.7–1.9 s and
6.4–7.1 s); later phases are compared with these numbers.

### Regression suite status at the baseline

Passing on v3.16.1 and kept passing: smoke-test, regression-simulation, tactics-test,
regression-v06/v08/v10/v21/v23/v300-final/v313-ui/v315, runtime-ui-smoke, editor-v316,
award-balance-v15, balance-test, balance-v20, balance-v316, favorite-balance-v17,
market-career-balance, regression-market-geography (`node scripts/run-regressions.mjs
[--full]`).

Already failing on v3.16.1, left untouched: market-balance-v18 (warnings), regression-v07,
v09, v15, v19, v22, v24–v30, v290–v299, v300, v310–v314 (most assert old version strings or
old data revisions).

## Phase 1 — squads of 11 + 4 and formations

Match model unchanged (still the v3.16 score-first model), so match statistics move only
through the XI-based strength: goals 2.30, home/draw/away 43.9 / 22.1 / 33.9, shots 9.2,
clean sheets 43.0 %. Favourites by gap: 41 / 53 / 67 / 80 / 91 %. Award spread: 4.7 Ballon
d'Or winners from 4.7 clubs per seed, World Golden Boot average 41 goals (was 58), elite top
scorers 31 goals (was 41) because goals are now shared across eleven named starters.
Ballon d'Or podiums 31 MF, 21 FW, 2 DF.

Starting depth (seed 26001): elite clubs XI 81.0 / bench 72.7, mid-table top flight 69.7 /
62.3, condensed clubs (4 named + depth) 58.9 / 54.8. Formation fit across top-flight clubs:
5th–95th percentile 78–94, median 86; 11 % of coaches use their fallback shape.

Population: about 12,400 active players (was 7,800). Rarity caps hold (3 / 15 / ≤50).

| Seed | Season | Offseason | Slowest offseason | Save after 20 seasons |
|---:|---:|---:|---:|---:|
| 271828 | 2.14 s (+0 %) | 5.11 s (−41 %) | 9.43 s | 198 MB |
| 314159 | 2.37 s (+29 %) | 5.55 s (−32 %) | 6.79 s | 198 MB |

The offseason got faster because transfers now patch the runtime cache instead of
rebuilding it, and several history scans are indexed. The raw save grows about 30 %, mostly
from more player-season and honour rows; it compresses well for cloud saves.

Why condensed clubs stay at four named players: naming 15 for all 1,431 clubs would mean
about 21,000 active players (≈ 2.8× v3.16). Condensed and second-division clubs are mostly
seen through tables and the occasional continental tie, so their matchday 15 is completed
by unnamed depth ratings computed from club strength (nothing stored).

## Phase 2 — minute-by-minute engine

Three seeds × six seasons, 238,385 detailed matches. Every overall metric is inside its
target band.

| Metric | Baseline | Phase 2 | Target |
|---|---:|---:|---|
| Goals / match | 2.42 | 2.76 | 2.6–2.8 |
| Home / draw / away | 44.6 / 21.7 / 33.7 | 45.4 / 24.9 / 29.8 | 45 / 27 / 28 |
| Shots / team | 9.3 | 12.3 | 12–13 |
| On target / team | 3.7 | 4.3 | 4–5 |
| Corners / team | 2.8 | 5.1 | 4.5–5.5 |
| Yellows / team | 1.65 | 1.96 | ~2 |
| Reds / match | 0.11 | 0.11 | ~0.1 |
| Clean-sheet rate | 40.2 % | 29.7 % | 26–32 % |
| Extra time / penalties (knockouts) | 20.4 / 13.3 % | 23.5 / 14.3 % | — |
| Substitutions / team | none | 2.5 | — |

Per tier the bands hold too (elite leagues 2.79 goals, 45.8 / 23.6 / 30.6, cups 2.91 goals,
condensed leagues 2.72 goals and 27.5 % draws).

Favourites by strength gap: 0–3: 40 %, 3–6: 48 %, 6–10: 56 %, 10–15: 64 %, 15+: 77 %
(upsets 6.7 %, was 1.1 %). League champions still finish on roughly 85–95 points.

Tactical styles (points per game across all matches, confounded by squad quality):
1.34–1.44 for every style. In isolated equal-team tests every style averages 1.31–1.40
while head-to-heads swing 0.15–0.35 points per game (pressing 1.47 v possession 1.25;
defensive rock 1.41 v possession 1.27).

Spread: 4.7 distinct Ballon d'Or winners from 4.7 clubs per seed (baseline 4.7 / 4.3), 5.0
UCL winners (4.0), 2.6 champions per elite league (2.7), elite top scorers 41 goals (41),
World Golden Boot 53 weighted-league goals (58). Ballon d'Or podiums: 28 FW, 26 MF.
Average match rating GK 6.63, DF 6.66, MF 6.71, FW 6.65. balance-v316 passes on both
seeds with no warnings.

### What was tuned and why

- **Expected-goals curve.** The v3.16 linear formula produced 130–19 seasons and 3.5 v 0.15
  expected goals in mismatches once every chance was simulated. Quality now goes through
  a saturating curve; coach focus, tournament-favourite and dynasty pressure multiply
  expected goals directly (3.5 % per strength point) so they keep their old weight. Without
  that, one seed produced a seven-title Bayern age.
- **Shot share.** Goals are split among eleven starters with a flatter weighting than the
  award-era `goalWeight`, but a Generational star still dominates a weak league
  (balance-v20 superstar scenario).
- **Draws.** Level sides grow cautious after 55 minutes; leading sides protect harder.
- **Ratings.** Goal weight in match ratings is moderate (MVP = top scorer in 26 % of
  competitions, baseline 29 %). The Ballon d'Or adds a modest weighted-goals term because
  event ratings otherwise favour creative midfielders.

### Performance

| Seed | Season | Offseason | Slowest offseason | Save after 20 seasons |
|---:|---:|---:|---:|---:|
| 271828 | 2.94 s (+38 %) | 5.00 s (−42 %) | 6.83 s | 242 MB |
| 314159 | 2.80 s (+52 %) | 4.77 s (−41 %) | 6.07 s | 242 MB |

The season is over the +30 % budget (season plus offseason together is 25 % faster than
v3.16). The engine itself costs about 0.07 ms per match; the rest is per-player
bookkeeping for 11 starters plus substitutes. The save grows because substitutes create
real appearance rows; replay detail is dropped when matches are archived.

## Phase 3 — fitness, rotation, injuries, suspensions and light matches

Three seeds × six seasons. All overall targets met: 2.73 goals, 45.4 / 25.2 / 29.5,
12.3 shots, 4.3 on target, 5.1 corners, 1.97 yellows, 0.11 reds, 29.6 % clean sheets,
2.8 substitutions per team. Condensed leagues: 2.70 goals, 27.2 % draws.

Availability: about 2,800 injuries per season across the tracked world (light matches roll
one injury check per side). League points per game by usual starters missing: none 1.38,
one 1.38, two 1.35, three or more 1.31.

Spread: 4.7 Ballon d'Or winners from 4.3 clubs per seed, 5.3 UCL winners, 3.0 champions per
elite league, elite top scorers 37 goals. Ballon d'Or podiums 34 FW, 19 MF, 1 DF.

balance-v316 (default two seeds) passes. On four seeds three pass with no club above three
UCL titles and one (141421) has a seven-title Real Madrid with six in one spell: dynasties
are now possible but uncommon. Knockout matches were made slightly more open (the old
model weighed quality gaps more in knockouts than in leagues) and the repeat-champion
pressure is a little stronger, because deeper squads protect giants from injuries.

### Light matches

League matches outside the nine main leagues, early cup rounds in those countries and the
condensed leagues are played light (scoreline from the kickoff expectations, scorers, a
late-equaliser adjustment, one injury roll per side). Their goal and result rates match
the full engine (other full leagues 2.71 goals, 45.3 / 25.4 / 29.3).

### Performance

| Seed | Season | Offseason | Slowest offseason | Save after 20 seasons |
|---:|---:|---:|---:|---:|
| 271828 | 2.35 s (+10 %) | 4.59 s (−47 %) | 5.72 s | 241 MB |
| 314159 | 2.25 s (+22 %) | 4.56 s (−44 %) | 6.32 s | 241 MB |

Back within the +30 % budget. Before light matches the season took 4.1–4.2 s; other fixes
on the way: line-ups repaired in place instead of re-selected, a per-team cache of matchday
squads, typed-array XI selection (identical choices), cheaper availability checks and
stable object shapes for the hot path.

## Phase 4 — potential, development, form, traits, captains and loans

Three seeds × six seasons, all overall targets met: 2.72 goals, 45.3 / 25.2 / 29.5,
12.3 shots, 4.3 on target, 5.1 corners, 2.12 yellows, 0.13 reds, 29.5 % clean sheets,
2.8 substitutions per team. Condensed leagues: 2.68 goals, 27.6 % draws. Cards rose a little
(1.97 → 2.12 yellows, 0.11 → 0.13 reds) because hot-headed players book more often and lift
their side's card rate.

Favourites by power gap: 0–3 40 %, 3–6 47 %, 6–10 55 %, 10–15 64 %, 15+ 76 % (unchanged).
Spread: 4.7 Ballon d'Or winners and 5.0 UCL winners per seed, 2.9 champions per elite league,
elite top scorers 37.5 goals. Ballon d'Or podiums 29 FW, 24 MF, 1 DF. League points per game
by usual starters missing: 1.38 / 1.38 / 1.35 / 1.32.

From `regression-phase4` (seed 40401, eight seasons): each trait sits at 9–13 % of players;
clutch takers convert 79 % of shootout kicks against 71 %; hot-headed sides take 4.0 cards a
match against 2.2; regular starters grow 2.8 points a year against 0.6 for prospects who
never play; mercenaries move 12 % a summer against 7 % for loyal players; about 45 loans a
summer; the 88+ population stays between 28 and 39.

The Phase 4 numbers were measured just before two small fixes in the same phase (new
signings could be released or loaned out again in the same window); the fixes touch a
handful of players per summer.

### Performance

| Seed | Season | Offseason | Slowest offseason | Save after 20 seasons |
|---:|---:|---:|---:|---:|
| 271828 | 2.33 s (+9 %) | 4.21 s (−51 %) | 5.53 s | 245 MB |
| 314159 | 2.28 s (+24 %) | 4.26 s (−47 %) | 5.71 s | 245 MB |

Within budget (percentages against the Phase 0 baseline on this machine).
