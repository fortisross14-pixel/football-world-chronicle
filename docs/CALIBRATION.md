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

## Phase 5 — derbies, home advantage, records, sackings, transfer drama and balance rules

Three seeds × six seasons, all overall targets met: 2.73 goals, 45.5 / 25.1 / 29.4,
12.3 shots, 4.3 on target, 5.1 corners, 2.13 yellows, 0.128 reds (straight-red base rate
lowered from 0.017 to 0.015 to absorb derbies and hot-headed players), 29.4 % clean sheets.
Condensed leagues: 2.68 goals, 27.3 % draws. Favourites by power gap unchanged (40 / 47 /
55 / 64 / 76 %). Spread: 4.3 Ballon d'Or winners and 4.7 UCL winners per seed, 2.9
champions per elite league. Ballon d'Or podiums 31 FW, 20 MF, 3 DF.

Home edge: league home wins 45.3 % (full engine) and 45.4 % (light); cross-border
continental games 46.7 %. Derbies: 6.0 cards a match against 4.3. Over eight seasons of
league derbies (444 matches) the home side won 43.9 % against 44.1 % priced, versus 45.4 %
in other league games. Altitude: La Paz against a lowland side 4.7 strength points of home
edge against 2.8.

Mid-season sackings: 32 a season across the world. League points per game in the six
games before a sacking 0.66, in the six after 1.40 (mostly regression to the mean after
a bad run, plus a new-coach bounce of up to 1 strength point fading over six weeks).

Balance rules added at the user's request ("fun to watch, not pure"):

- Title fatigue: two consecutive titles in a competition give a small handicap in it
  (1.5 strength points), three a clear one (4), four or more a very large one (9); three
  or four titles in the last six seasons count the same way. Leagues feel 40 %.
- Star hoarding: in the elite market a club's existing stars (generational 3, legend
  1.6, epic 0.5) divide its pull for another star, and stars are less willing to join a
  squad full of them. Clubs with 3+ generational/legend players: 1.1 → 0.5–0.8 a season;
  clubs with two generational players: 0.4 → 0 a season (two seeds, eight seasons).

balance-v316 on four seeds (20 seasons each): 8–11 different UCL winners, at most 7
titles for one club (Real Madrid, spread over 19 years) and at most 4 in one spell (one
four-in-a-row; no fifth). balance-v20 now runs 6 / 6 / 8 seeds by default: two seeds no
longer separated the effects it checks reliably.

### Performance

| Seed | Season | Offseason | Slowest offseason | Save after 20 seasons |
|---:|---:|---:|---:|---:|
| 271828 | 2.25 s (+6 %) | 3.64 s (−56 %) | 4.90 s | 247 MB |
| 314159 | 2.32 s (+26 %) | 3.75 s (−55 %) | 4.58 s | 247 MB |

A first Phase 5 build ran at 2.59–2.61 s a season (+42 % on 314159). Fixes: rivalry lookup
indexed (it ran for every match), career counters created with each player so player
objects keep one shape, records bookkeeping without per-match allocations, and the
bidding-war rival found in one pass. The calibration script's own timing is unreliable
for this run (the machine slept during it); the table above is from `npm run perf`.

## Phase 6 — following feed, predictions and odds

Phase 6 does not change the simulation: a world played 14 weeks gives the same match,
card and player hash as the Phase 5 build, and pricing fixtures or making predictions
between weeks leaves results unchanged (`regression-phase6`). The Phase 5 calibration
and balance results therefore stand.

Odds calibration (seed 60601, one season, full-engine matches; home-win price band →
priced vs actual): 10–20 % 0.149 / 0.131, 20–30 % 0.252 / 0.282, 30–40 % 0.351 / 0.370,
40–50 % 0.449 / 0.468, 50–60 % 0.546 / 0.541, 60–70 % 0.647 / 0.687, 70–80 % 0.749 / 0.779,
80–90 % 0.837 / 0.863. Prices carry a 6 % margin. The longest-priced winner of that season
won at 33.69, and 24 upset stories ran.

Predictions: picking the strongest side for every question scored 12 of 28 that season.

### Performance

Back-to-back four-season runs on seed 314159 (same machine, same load): Phase 5 3.77–4.72 s
and 3.67–4.03 s a season, Phase 6 3.61–4.11 s. No measurable change. Absolute times in this
run are high because the machine was under about 35 % background load; the Phase 5 table
above, measured on a quiet machine, is the reference.

## v4.2 — squads by formation, team fitness and international tournaments

### Matches (3 seeds × 6 seasons, `npm run calibration`)

| | v4.1 (main) | v4.2 |
|---|---:|---:|
| Goals per match | 2.72 | 2.73 |
| Home / draw / away | 45.4 / 25.1 / 29.5 | 45.3 / 25.2 / 29.6 |
| Shots / on target per team | 12.4 / 4.4 | 12.4 / 4.3 |
| Yellows per team / reds per match | 2.14 / 0.126 | 2.14 / 0.131 |
| Clean sheets | 29.4 % | 29.3 % |
| Favourite wins, gap 15+ | 76.1 % | 75.6 % |
| UCL winners per seed | 5.0 | 5.3 |

All targets met before and after. Squad Reshape, team fitness and the backup-system
penalty leave the match model where it was.

Team fitness first cost the busiest clubs too much: with a 20-point weekly recovery and
a 0.12-per-point penalty, `favorite-balance-v17` (16 seeds) dropped from 78 % to 53 %
top-five winners (the Libertadores favourites from 81 % to 44 %), because sides playing
midweek kept losing league points and form. Recovery 22, rotation from bench players
within ten rating points of the XI, a 0.08-per-point penalty below 80 % and a 0.3 edge
above 95 % bring it back to 69 % (test floor 60 %) while congested months still wear thin
squads down (lowest team fitness about 72 % in a 20-week sample).

### International tournaments (`npm run calibration-intl`, 3 seeds × 20 cycles, 360 tournaments)

Rates for the four strongest teams by pre-tournament power; "shared" counts top-8 teams
sharing a group per tournament.

| | Top-4 group exits before | after | Favourite wins before | after | Shared before | after |
|---|---:|---:|---:|---:|---:|---:|
| World Cup | 10.8 % | 11.7 % | 16.7 % | 20.0 % | 2.3 | 0.08 |
| Euros | 22.1 % | 9.2 % | 33.3 % | 25.0 % | 4.15 | 2.0 |
| Copa América | 31.3 % | 10.8 % | 30.0 % | 38.3 % | 6.0 | 6.0 |
| AFCON | 21.2 % | 7.9 % | 55.0 % | 18.3 % | 4.1 | 2.0 |
| Asian Cup | 19.6 % | 11.3 % | 41.7 % | 30.0 % | 4.15 | 2.0 |
| Gold Cup | 37.9 % | 12.9 % | 80.0 % | 35.0 % | 5.0 | 5.0 |
| **All** | **23.8 %** | **10.6 %** | **42.8 %** | **27.8 %** | | |

Targets: top-4 group exits 10–15 % (met), favourite wins 20–30 % (met). Copa América and
Gold Cup "shared" values are the minimum possible with two and three groups.

Seeding alone overcorrected (4 % group exits, 47 % favourite wins): national-team quality
gaps decided too much. National-team matches now compress quality gaps per tournament
(World Cup 0.65, Euros 0.3, Copa América 0.25, AFCON and Asian Cup 0.35, Gold Cup 0.25,
Oceania 0.4, qualifiers and friendlies 0.6), because continental finals pit a few strong
nations against much weaker fields while World Cup fields are closer. Club football is
unchanged.

### Performance (seed 314159, five seasons; CPU time of the process, back to back)

| | Season | Offseason |
|---|---:|---:|
| v4.1 (main) | 3.29 s | 4.58–4.99 s |
| v4.2 | 3.58–3.69 s (+9–12 %) | 4.54–5.03 s (±0 %) |

Within the +20 % budget. Wall-clock times on this machine swung by a factor of two
between identical runs (other programs were busy), so CPU time is the comparison; the
20-season `npm run perf` output is kept in docs/calibration for reference only. The quick
model's low-stakes rotation is skipped (rebuilding a line-up for every early cup tie cost
more than the game itself); quick games rotate for fatigue through team fitness instead.

## v4.3 — elite players drive results, goals and awards

### Rarity (`npm run calibration-rarity`, 3 seeds × 20 seasons = 60 seasons)

| | Before (main) | After | Target |
|---|---:|---:|---:|
| Ballon d'Or winners Epic+ | 63 % (21 Rare, 1 Uncommon) | 100 % (90 % Legend/Generational) | ≥ 95 % |
| Ballon d'Or podium Epic+ | 63 % | 98 % (no Uncommon/Common) | ≥ 85 % |
| World Golden Boot Epic+ | 45 % | 97 % | ≥ 80 % |
| Big-5 league top scorer is an Epic+ forward | 35 % | 70 % | usually |
| UCL winners with a Legend/Generational | 67 % | 90 % | about 75 % |
| UCL winners with no Epic+ | 3 % | 2 % | ≤ 5 % |
| World Cup winners with a Legend/Generational | 60 % | 87 % | about 75 % |
| World Cup winners with no Epic+ | 27 % | 0 % | ≤ 5 % |
| Euros / Club World Cup winners with no Epic+ | 13 % / 13 % | 0 % / 0 % | |
| Copa América winners with no Epic+ | 40 % | 20 % | |
| Players below Epic rated 85+ per season | 140 | 0 | |

Two targets are only partly met. UCL winners with a Legend or Generational run above
75 % (90 %), and of the few UCL winners with only Epics most had fewer than four. Both
come from the same lever (the handicap for sides without a Legend in the biggest
competitions): easing it lets more 1–3-Epic sides win, tightening it pushes the Legend
share higher. Copa América winners often have no Epic+ because several South American
nations have none at all; someone has to win.

The root cause of the old numbers was development, not awards: Rare ratings could reach
88, inside the Epic band, so about 140 "Rare" players a season played at Epic level and
won awards as Rares. Ratings below Epic now stop one point under the next band; a
breakout season can promote a young Rare to Epic while there are fewer than 50 Epics.

### Matches (final run, 2 seeds × 10 seasons)

2.74 goals, 45.5 / 25.2 / 29.3, 12.4 shots and 4.4 on target per team, 2.13 yellows,
0.126 reds, 29.0 % clean sheets: all targets met, unchanged from v4.2. International:
11.5 % top-four group exits, 33 % favourite wins (2 seeds × 6 cycles; the 360-tournament
run in v4.2 gave 28 %).

### Performance (seed 314159, five seasons, CPU time, run alongside the other final checks)

| | Season | Offseason |
|---|---:|---:|
| v4.2 (main) | 4.58 s | 6.22 s |
| v4.3 | 5.25 s (+15 %) | 7.24 s (+16 %) |

Within the +20 % budget. The extra offseason time is the move bookkeeping and the
season power ranks; the extra season time is the elite terms in every shot.
