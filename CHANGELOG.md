# v4 match engine and player model (in progress)

## Phase 2 — Minute-by-minute match engine

- New `src/match-engine.js`: matches are played in ten-minute slices (five-minute slices before half-time and full-time carry stoppage time). Each slice's chances come from the kickoff expectation adjusted by who is on the pitch, fatigue, red cards, substitutions, the score and the clock.
- Leading sides protect a lead late on (fewer chances both ways), trailing sides push (more chances both ways), level sides grow cautious after the hour. A red card changes the rest of the match from that minute.
- Coaches make up to four substitutions for fatigue, injuries, chasing a game or protecting a lead; substitutes score and assist.
- Every goal (minute, stoppage time, scorer, assister, penalty), card (with player; second bookings recorded as yellow then red), substitution and big chance is stored. Knockout and semi/final matches also keep every shot and corner, per-slice possession, line-ups and styles.
- Extra time is 30 more minutes with heavier fatigue. Shootouts are kick by kick (taker penalty skill and composure against the goalkeeper, rising pressure, sudden death). Two-legged ties play extra time and penalties in the second leg when level on aggregate.
- Shootout records for players, goalkeepers, clubs and nations (embargoed with the Showcase).
- Tactical matchups, rock-paper-scissors style: each core style beats two and loses to two (possession beats direct and counter-attack but loses to a defensive rock and to pressing; see `STYLE_BEATS`). Non-tactical coach profiles lean towards one style at half strength; adaptive coaches gain a small edge against everyone.
- Match ratings come from events (goals, assists, chances created, shots on target, saves, blocks, tackles, mistakes, cards, clean sheets, result); Man of the Match is the best-rated named player.
- Expected goals follow a saturating curve so mismatches stay football scores.
- Condensed leagues are played by the same engine (tables and player statistics only).
- The Showcase replays the stored timeline exactly; matches saved before this version keep the old reconstruction.
- Model win/draw/loss probabilities are stored on each match.
- UI: Showcase shows line-ups, substitutions, named card recipients, big chances, stoppage-time minutes, shootout details and the tactical edge; coach profiles list strong and weak matchups; player profiles show minutes and shootout records; club and nation pages show shootout records.
- Data revision 27 (shootout archive).

## Phase 1 — Squads of 11 + 4, formations and coach fit

- Top-flight clubs in the 29 full leagues now carry a named 15-player squad (11 starters + 4 substitutes) instead of 7; national teams pick a matchday 15.
- Condensed-league and second-division clubs keep a named core of four. Their matchday 15 is completed by unnamed depth ratings derived from club strength, so nothing extra is stored (measured: naming 15 players for all 1,431 clubs would have roughly tripled the player population).
- Every coach has a preferred and a fallback formation (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2, 4-1-4-1, 3-4-3) weighted by tactical style.
- Formation fit (0–100) compares the best XI for a shape with the squad's raw quality; out-of-position players, missing wingers or wing-backs and thin lines lower it. Coaches fall back to their second shape when the first fits below 80 and the second is clearly better. Fit adjusts team strength by up to about ±1.5.
- Lineups pick the best XI for the formation and respect availability; benches name a reserve goalkeeper first.
- Transfers, free-agent signings and generated squad players follow the coach's system; boards weigh squad fit when appointing a coach.
- Medals go to every named squad member who played in the winning competition.
- UI: Starting XI pitch, formation and fit on club Squad, club overview, nation pages and Showcase; preferred formation on coach profiles and staff cards.
- Faster offseasons: roster changes patch the runtime cache instead of rebuilding it, and several full-history scans (major titles, coach lookups, payroll recalculation, rookie placement) are now indexed.
- Data revision 26: existing coaches receive formations; top-flight clubs in existing saves are completed to 15 with squad players near the club's level, and payroll anchors and the population target grow with them.

## Phase 0 — Calibration harness

- `npm run calibration` and `npm run perf` with the recorded v3.16.1 baseline in docs/CALIBRATION.md.

# Unreleased — Game UI redesign

- New dark game interface: one token-based stylesheet replaces the layered overrides; Archivo variable font bundled locally (OFL, assets/fonts).
- Navigation reduced to five destinations (Home, Competitions, Football World, Chronicle, Season) with a section strip for sub-pages and full breadcrumbs (player → club, club → country, competition → country or region). Old routes and deep links still resolve.
- Simulation controls live in one command bar: Next week (primary), +4 weeks, Season end; Open Postseason and Run offseason replace them when the season ends. The bar locks while a simulation runs.
- Home is a season command centre: season stage with a 52-week strip and this week's numbers, latest decisive results, title races, major competitions, headlines, Ballon d'Or race and power ranking.
- Club profiles go from nine tabs to five (Overview, Squad & staff, Season, History, Legacy); player profiles to four; coach profiles to three. Old tab URLs map to their new home.
- Crest-, portrait- and emblem-led heroes for clubs, players, coaches, presidents, nations and competitions; Generational is red, Legend gold.
- Editorial Magazine front page, Awards Night podium reveals and Showcase match modal restyled; spoiler embargo unchanged.
- Fixes: overlays no longer flicker during live Showcase playback; search results now fall back correctly when a crest image fails.
- No engine, save-format or Neon changes.

# v3.16.0 — Dynasty cycles, league eras and world headlines

- Added a hard total-payroll affordability check to transfers, renewals and free-agent signings.
- Preserved institutional giants outside the current dominant league while making repeated success force sales and contract exits.
- Added deterministic 6–8 season league eras with a two-era no-repeat rule and no hidden match modifier.
- Added contract-expiry, rival free-transfer and changing-era stories.
- Added a persistent Magazine → Headlines archive and curated offseason lead stories.
- Rebuilt the global Hall of Fame around exceptional Legend/Generational careers, with only historic Epic outliers admitted; existing saves are cleaned automatically.
- Removed repeated full-history scans from season archiving, awards, tournament selection and dynasty scoring; 20-year tests averaged 1.7–1.9 seconds to close a season and 6.4–7.1 seconds for the full offseason.
- Added data revision 24 migration and a 20-season multi-seed balance harness.
- No Neon schema changes required.

# v0.21.0 — Domestic spawning and preseason lifecycle

- Procedural players now begin in their country of origin 90% of the time; the remaining 10% represents diaspora and unusual academy paths.
- Curated historical icons retain their real starting-club logic and same-country fallback.
- Protected all newly spawned players through their first visible season so later rookie generation or the opening transfer market cannot instantly relocate them.
- Added coach career length, career year, retirement and replacement-coach generation.
- Expanded Magazine → Preseason with top new coaches, major-club president changes, player retirements and coach retirements.
- Added structured save fields for new coaches, retirements and owner changes, with automatic revision-13 migration.
- Added `regression-v21` and a five-seed spawning validation.
- No Neon schema changes required.

# v0.20.0 — Competitive hierarchy, coach focus and award diversity

- Added nonlinear elite-player impact so exceptional stars materially elevate secondary clubs and dominate weak-league scoring races more credibly.
- Increased the influence of named squads and coach quality without eliminating one-match surprises.
- Limited continental dynasty pressure to major continental matches instead of weakening reigning champions throughout their domestic league season.
- Added Tournament, Regularity and Balanced coach focuses, with competition-context bonuses and visible UI labels.
- Added deterministic upgrade logic for existing coaches and raised the save data revision to 12.
- Added Ballon d’Or club-diversity logic: repeated candidates from one club receive diminishing support based on whether the club won one trophy, a double or a treble-level season.
- Added `balance-v20` regression and detailed deterministic report.
- No Neon schema changes required.

# v0.19.1 — Faster season rollover

- Optimized the annual coaching market by precomputing recent coach-title values once per rollover.
- Removed repeated full-history scans from every coach-ranking comparison.
- Reduced deterministic next-season setup from roughly 8.5 seconds to roughly 1.8 seconds on the test machine; mobile improvement will vary.
- No simulation rules, save format, Neon schema or balance logic changed.

- Corrected FHoF club-era selection to evaluate every consecutive two- and three-season window under the same coach and retain the strongest peak.
- Added an Overview tab to every domestic, continental and international competition.
- Replaced Magazine player-performance lists with completed-competition cards showing winner, runner-up, MVP and top scorer.
- Added 205 curated real-world player templates: 16 Generational, 69 Legend and 120 Epic.
- Enforced active real-icon bands of 1–2 Generational, 5–7 Legend and 9–12 Epic players while procedural stars continue filling the remaining rarity slots.
- Historical icons spawn at their curated starting club when available, otherwise at a club in the same country, and are protected from an immediate opening-window transfer.
- Added historical-icon markers to Preseason and player profiles.
- Added deterministic `regression-v19` validation.
- No Neon schema changes required.

# v0.18.0 — Goalkeeper balance and elite talent migration

- Reduced goalkeeper prevalence in elite transfers through dedicated position caps and buyer-demand weighting.
- Rebalanced match ratings so a team clean sheet no longer gives every goalkeeper an automatic top-player score.
- Added position normalization to open competition MVP, Ballon d’Or and Kopa races while preserving position-specific awards.
- Corrected Man of the Match selection to use the simulated match rating rather than the player’s permanent ability rating.
- Reworked market values and introduced rarity/position ceilings; elite outfield players remain expensive but are no longer valued above $350m.
- Added global-star migration pressure: prime Generational and Legendary players outside elite European clubs seek a move when continental progress stalls.
- Recent Libertadores or other major continental success creates loyalty and can delay that move.
- Added deterministic `market-balance` regression covering goalkeeper transfer/award rates and a Flamengo-to-Europe superstar scenario.
- No Neon schema changes required.

# v0.14.0 — Regional filters and universal rankings

- Added region filters to People for players, coaches, and presidents.
- Added region and metric sorting to Team, Player, and Coach Almanac tables.
- Added Magazine → Rankings with competition and metric selectors across domestic, continental, and international football.
- Rankings support player scoring, assists, ratings, clean sheets and titles; team general score, goals, clean sheets and titles; and coach wins and titles.
- No Neon schema changes required.

# v0.13 — Football Hall of Fame

- Added Magazine → FHoF.
- Top 10 players at each position, coaches, presidents and club eras.
- Top five national-team cycles.
- Competition-weighted career scoring, titles, awards and ratings.
- Club eras require 2–3 seasons under the same coach.
- Rankings begin after the first archived season and evolve annually.

# v0.12

- Restored and expanded the Almanac into Champions, Teams, Players and Coaches.
- Added current club/job, career statistics and honor totals to team, player and coach rankings.
- Replaced the sidebar Players entry with People.
- Added People tabs for Presidents, Coaches and Players, emphasizing rarity, quality, role/profile and current assignment.
- Preserved legacy player routes for existing links and saves.

# Football World Chronicle v0.11

- Added an active coaching market: ambitious clubs and national teams can poach successful employed coaches from weaker jobs.
- Added Players/Coaches tabs to the Transfer Market, with coach rarity, nationality, tactical profile and from/to jobs.
- Added long presidential tenures of 5-22 years, weighted toward 12-20 years, plus automatic boardroom succession.
- President effects now change when leadership changes; elite Academy Patrons increase the chance of strong rookies emerging at their club.
- Club screens show the president's remaining tenure.
- Existing saves upgrade to data revision 9 without Neon changes.

# v0.10

- Elite rookies can emerge at secondary and minor clubs.
- Added career-year/debut filters and preseason new-generation magazine.
- Expanded Greek and Spanish-language name pools.
- Repaired and strengthened domestic national-team coach assignment.

## v0.8.2
- Rebuilt the mobile header as a two-row sticky toolbar so Home and Menu can never be covered by simulation controls.
- Simulation buttons remain visible directly below the navigation row without using fixed positioning.

# v0.8.1

- Fixed competition routing crash caused by a missing `baseFor` helper. International competitions such as the World Cup now render after their hash route opens.

# v0.8

- International sidebar simplified to Overview and Competitions.
- Fixed international competition card contrast and defensive rendering of incomplete group data.
- Added player market values to Player Pool.
- Distributed initial generational players among distinct elite clubs and penalized same-rarity hoarding in elite transfers.
- Rebuilt Magazine Results as 10-12 narrative stories using static rivalries, competition stage, table context, late goals, and standout performances.

# v0.7

- Added permanent coach competition-season and team-season statistics.
- Added games, wins, draws, losses, win percentage, goals scored, goals conceded, clean sheets and titles for coaches.
- Added coach profile pages with current job, rarity, nationality, tactical identity, career timeline, detailed competition record and trophy years.
- Added Coaches as a third Competition Stats sub-tab.
- Added a sortable Coaches section to the Almanac and global search.
- Stored the winning coach with every newly archived competition champion.
- Rebalanced national-team hiring: Tier 1 nations now overwhelmingly choose domestic coaches, while smaller nations remain more open to foreign appointments.
- Rebalanced club hiring to approximately 60–65% domestic coaches for major clubs, with elite clubs recruiting more globally.
- Rebuilt coach generation nationality distribution around the actual number of club and national-team jobs in each country.
- Added save migration to data revision 7.
- No Neon schema changes are required.

# v0.6

- Replaced generated condensed-country club names with recognizable six-club sets across the 137-country universe.
- Replaced text/emoji flag rendering with image-backed flags and reliable fallbacks.
- Fixed unreadable club text on dark player-profile headers.
- Optimized the global Player Statistics page and limited output to the top 50.
- Added competition-position filters and ranking by goals, assists, clean sheets, rating, games and titles.
- Promoted Magazine to first-level navigation with Transfers, Results and Player Performances tabs.
- Added four-week relevance scoring for major results, top-table clashes, upsets, finals and elite performances.
- Added current-year award races and historical Ballon d’Or, Golden Boot and Kopa podiums, plus annual positional winners.
- Added persistent International Football Overview/Nations and Competitions sections.
- Moved the first World Cup into the June–July 2002 window and continental qualifying/finals into their intended summer cycles.
- Added visible brackets and weekly fixtures/results for domestic cups, continental tournaments and international competitions.
- Added full World Cup final recaps with champion, finalist, MVP, young player, goalkeeper and top scorer.
- Fixed duplicate World Cup season statistics; a player can now record at most seven appearances in one edition.
- Increased same-nationality coach hiring, especially in major football countries, while preserving elite international appointments.
- Added version-4 save migration for renamed clubs and new archive fields.
- No Neon schema changes are required.

# v0.5

- Added prominent mobile Home/Menu controls, navigation scrim and close control.
- Added authentic color treatments for major European, Argentine, Brazilian, Mexican and Japanese clubs.
- Rebalanced transfer position needs, goalkeeper market values and elite-player movement.
- Added competition MVP plus best GK, defender, midfielder and forward awards.
- Added World Golden Boot using league-strength coefficients.
- Added an end-of-season summary with major continental winners and world awards.
- Added a club-by-season career timeline to player profiles.
- No Neon schema changes: cloud saves remain JSON snapshots.

# v0.4 — Complete Football World

## Domestic universe

- Expanded from 18 club countries to all 137 national-team countries.
- Added 29 full 20-team leagues with seven promotion-pool clubs each.
- Added three-team relegation and promotion after every completed season.
- Added 108 condensed domestic systems with six persistent leading clubs.
- Expanded the universe to 1,431 clubs and approximately 7,500 active named players.

## Continental competitions

- Added Europa League and Conference League.
- Added Copa Libertadores and Copa Sudamericana.
- Added CONCACAF Champions Cup.
- Added AFC Champions League and AFC Cup.
- Added CAF Champions League and CAF Confederation Cup.
- Added OFC Champions League.
- Added qualification allocation from domestic league and cup outcomes.

## Club leadership

- Added an owner/president to every club.
- Added eight owner profiles and staff rarities.
- Added financial, sporting, negotiation and patience effects.
- Added a global coach market larger than the available jobs.
- Added ten coaching identities with tactical effects.
- Added coach dismissal, free agency, elite appointments and trophy histories.

## Magazine and interface

- Added continental preseason favorites.
- Added promotion/relegation and coach-market news.
- Added hat-trick, upset, elite-performance and goalkeeper-masterclass stories.
- Added president and coach cards to club pages.
- Expanded country and confederation navigation for the complete universe.
- Replaced external flag images with native emoji flags and fallbacks.

## Balance and performance

- Reweighted Ballon d’Or voting toward elite leagues, major continental runs and major international tournaments.
- Added anti-dynasty pressure for repeated continental winners.
- Added financial caps and transfer-budget controls to reduce hoarding.
- Stabilized the active player population by renewing contracts and reusing free agents.
- Added runtime player, club and lineup indexes for much faster later-season simulation.
- Added an eight-season deterministic balance test.

## Compatibility

v0.4 uses save version 4 and starts a new universe. v0.3 cloud snapshots are not automatically migrated.

## v0.9.0
- Rebalanced elite transfers: unhappy players and players entering the final contract year are materially cheaper and more likely to leave lower-reputation clubs.
- Reduced named-player goal concentration by assigning a realistic share of club goals to unnamed squad members.
- Reworked competition MVP scoring to value ratings, assists, clean sheets and positional impact rather than simply duplicating the top-scorer award.
- Moved Players, Coaches and Almanac above Priority Countries in the sidebar.
- Added an eight-season deterministic award and scoring regression test.

## v0.15.0
- Rebuilt competition MVP and Ballon d'Or scoring around sustained average performance, appearances, competition prestige, finals and titles.
- Reduced direct goal/assist boosts to match ratings and Man of the Match selection.
- Kept Golden Boot entirely goal-driven.
- Added deterministic award-balance regression.
