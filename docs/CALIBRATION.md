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
