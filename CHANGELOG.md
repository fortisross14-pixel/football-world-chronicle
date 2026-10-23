# v4 match engine and player model (in progress)

## v4.4 — Coach rarity and careers, youth academies

### Coach rarity
- At any time the world has 2–3 Generational, 8–10 Legend, 15–20 Epic and about 40 Rare coaches; everyone else is Uncommon or Common. Before, a world had about 5 Generational, 22 Legend, 73 Epic and 245 Rare coaches.
- New worlds generate to these numbers and replacement coaches keep them: a retiring Legend is replaced by a Legend only when the world is short of one. Elite coaches come mostly from the big football nations.
- Fallback national-team coaches created when a federation finds no one are Rare at most.

### Coach careers
- Every coach has an early, peak and late phase (from career year and career length).
- In their prime, Generational and Legend coaches work at the 12 biggest European clubs. Those clubs poach rising and prime elite coaches from smaller jobs ("X land Y"). Prime elite coaches turn national jobs down unless they have been out of work for two seasons.
- Epic coaches split between the biggest clubs, the second line of the big five leagues, the top clubs of other leagues and national teams; early-career Epics stay in club football and prime Epics usually turn federations down.
- Late in their careers coaches most often take national teams, go back home or stay where they are.

### Coach page
- Header: career phase and seasons left next to style, focus and formation.
- Overview now leads with three charts by season (quality, win rate, trophies; club seasons in blue circles, national-team seasons in amber squares) and a career timeline with one band per spell (crest or flag, seasons, record, trophies). The tables stay in Career & statistics.

### Youth academies
- Every club has an academy score from 0 to 100, shown as one to five stars (0–19 one star … 80–100 five stars). Big clubs start at 61, mid-sized clubs at 50, others at 39; each new world also seeds a few five-star (about 4.5 %) and four-star (about 8 %) academies, more often at historic academies and in the big football countries.
- Each offseason the score moves: Academy Patron presidents raise it (+6 Generational … +0.5 Common), Billionaire and Consortium owners lower it (−0.5 … −4), a Youth Developer coach adds +0.5 to +3, seeded and historic academies have a tradition bonus, and every academy drifts about 8 % back toward 50.
- Academies now produce the elite players. One-star academies only produce Commons, two-star Common or Uncommon, three-star mostly Uncommon with some Rares and the odd Epic, four-star no Commons, five-star Rare and better with the best Legend and Generational odds. Epic+ graduates come mostly from Brazil, Argentina, Germany, France, Italy, Spain and England, sometimes from Portugal, Uruguay, the Netherlands and Belgium, rarely elsewhere. Elite graduates are often an unused historical icon from the club's country.
- Caps hold the elite population steady (3 Generational, about 15 Legend, about 50 Epic); a roll above a cap becomes the rarity below, and a club with a Generational cannot produce another. Rare breakouts to Epic stop 8 places under the Epic cap so academies fill the rest.
- Youth intake happens during Squad Reshape: after releases, each open slot below the coach's 15 gets a youth roll based on the academy score; unfilled slots go to the re-sign pool. A club already at 15 gets no youth. Top clubs that have gone two seasons without a major trophy may release up to two extra veterans or Commons to make room. Smaller cores also get youth.
- Most graduates are from the club's own country, with a small chance of a foreign youngster.

### Academy UI
- Club Overview → **Youth academy**: stars, score, trend chart, what is moving it (president, coach, tradition, drift) and the number of graduates.
- "Since last season" splits **Signings**, **Departures** and **Youth intake**; so do the Moves summary, the Offseason summary (with notable youth intakes) and the Magazine preseason rookies.
- Player profiles show "Academy: club"; club records count academy graduates.
- Rankings → **Best academies**.
- Magazine stories when an academy produces an Epic, Legend or Generational.

### Calibration and saves
- New `npm run calibration-coaches` (also part of `npm run calibration`): coach rarity counts, elite coach jobs by phase, Epic coach jobs, academy scores and stars, youth intake by rarity and elite youth by country group. Before and after in docs/CALIBRATION.md.
- Data revision 35: coach targets are stored without demoting anyone (replacements fill only the gaps), academies are seeded and existing academy graduates keep their club. No Neon schema changes.

## v4.3 — Every move in one list, club changes and elite players who matter

### Moves
- Transfer market → **Moves** (the new default tab): every player who changed team this offseason and season, whatever the reason, and every coach who changed job. Columns: name, rarity, position, age, rating, from → to and a plain "How": "Transfer · $85m", "Contract expired at Juventus · free, 4-year deal", "Released by Milan (squad reshape) · signed by Roma", "Loan", "Back from loan", "Contract expired · unattached"; for coaches "Poached from Porto", "Dismissed by Lazio · appointed by Valencia", "Appointed by Santos".
- Generational, Legend and Epic by default, with a toggle for all rarities (remembered). Sorted by rarity, then current rating; never by fee.
- "Elite moves" (Epic+, any reason, same order) replace the fee-sorted lists in the Offseason summary, the live offseason screen and the preseason home stage.
- Legend and Generational players who move on a free get their own Magazine headline ("joins X on a free").
- Contract exits, loan returns and surplus releases are now recorded, and new deals record their length.

### Club pages
- Overview → **Since last season**: power ranking last season → now, arrivals and departures (same wording and order as Moves), the biggest rating changes in the squad with the reason (aging, development, decline) and any coach change.
- History → **Arrivals and departures by season**.
- Each season's squad-power rank is stored with the club's season record.

### Elite players drive results, goals and awards
- Ratings stay inside the rarity: below Epic a player tops out one point under the next band (Rare 84, Uncommon 79, Common 69). Before, about 140 Rare players a season were rated 85–88, inside the Epic band, and they were the ones winning awards. A breakout season can promote a young Rare to Epic (with a Magazine story) while there are fewer than 50 Epics.
- Match engine: Epic, Legend and Generational players take a far bigger share of shots, finish better, create more big chances for teammates, and elite keepers save more; all of this is stronger in finals and semi-finals. Star impact on team strength is steeper.
- Major titles: in the Champions League, World Cup, Euros, Copa América and Club World Cup a side without a Legend or Generational is handicapped (lightly with a core of four or more Epics). Other competitions keep their openness.
- Ballon d'Or: voters favour stars (rarity, quality above the elite line, fame) and decisive performances in finals and semi-finals. Uncommon and Common players never reach the podium; a Rare wins only with a historic season (a Champions League or World Cup-level title and a score well clear of the best Epic+). Positional awards and the Best XI follow from the same ranking.
- New rarity calibration (`npm run calibration-rarity`, also part of `npm run calibration`); before and after in docs/CALIBRATION.md.

### Saves
- Data revision 34: ratings of existing Rare, Uncommon and Common players are brought inside their band; move lists start empty. No Neon schema changes.

## v4.2 — Squads by formation, matchday screens and fairer international tournaments

### Squads set by the coach's formation
- Every formation has a squad of 15 with two goalkeepers (4-4-2: 2/5/5/3, 4-3-3: 2/5/4/4, 4-2-3-1: 2/5/5/3, 4-1-4-1: 2/5/6/2, 3-5-2: 2/4/6/3, 3-4-3: 2/4/5/4, 5-3-2: 2/6/4/3). The 4-2-3-1 wide players and the 3-5-2 / 3-4-3 wing-backs are midfield slots (filled naturally by wide midfielders); 5-3-2 wing-backs are defenders.
- Playing the backup formation costs 0.8 strength (0.3 for Adaptive coaches). A coach with the wrong players chooses whichever costs less: players out of position in his system, or the system he likes less. The club page says which he chose.
- New offseason event, Squad Reshape (after the market, loans and new players): clubs release surplus players by position (lowest rarity first, then lowest rating); released players and free agents form one pool; clubs short of their shape sign the best affordable player for each gap, top-league first divisions first and the most disappointing seasons first, then the other first divisions; any gap left gets a new squad player. Releases and signings appear in Offseason → Squad Reshape, Transfer market → Released ("Released" / "Signed after release") and in the Magazine for notable players.
- A coach change changes the shape from the next reshape on. Smaller leagues and second divisions keep their named core; their unnamed fillers follow the coach's shape and are listed as reserve players.
- Club Overview shows the formation, starting XI, the four substitutes, the fit and whether it is the preferred or backup system (instead of the top-8 "Current core").

### Team fitness in the quick model
- Each club has one fitness value for the season: a match costs 12, a week gives 22 back, so one game a week stays fresh and congested months wear a team down. Before a quick game the coach rotates up to three players from a bench close enough to the XI, removing about a third, 60 % and 80 % of the fatigue (70 % → 80, 88, 94); bench players within ten rating points of the XI can be used. Below 80 % a team is weaker, 80–95 % is neutral, above 95 % gives a small edge. Full-engine club games tire the team too.
- Quick games now use the matchday squad (injured and suspended players are out) and a bench factor on second-half scoring, so deep squads finish games and seasons stronger.

### Showcase: pre-game, live and full time
- Every Showcase game opens on a pre-game screen: competition, stage, both teams, then Kick off / Quick simulate, then coaches with formation, fit and system, a plain-language tactical matchup, the stakes, a win/draw/win probability bar, league position and form, the road to the match, head to head, each side's top three with season goals and assists, missing players and the predicted line-ups. Every team, player and coach is a link; coming back returns to the same unstarted screen.
- Live: a momentum bar in five-minute stretches and live xG, line-ups next to the events with live ratings, substitutes taking their place and sent-off players marked. Every event shows its team (home on the left, away on the right, crest and team-colour edge), including the shootout. Commentary credits saves to the named keeper and adds near misses, woodwork, teams chasing the game and late pressure.
- Goal moment: a full-width takeover in the scorer's colours with crest, portrait, flipping score, assist and context ("his 9th UCL goal", EQUALISER, HAT-TRICK, COMEBACK COMPLETE, LATE LEAD; the full-time screen marks the LATE WINNER, which cannot be known while the game is still running). Smaller moments for penalties, red cards and big saves. Reduced motion is respected. Crests no longer disappear during live updates.
- Full time: score, goal timeline, key stats and the whole-match momentum, Man of the Match, ratings for both teams, what it means (into the final, eliminated, champions for the first time since…, record final wins), a trophy celebration with the winning crest and captain for finals, then back to the Showcase.
- xG, momentum and live ratings exist only for Showcase games.

### Live simulation screen stays open
- After +4 weeks, Season end and the offseason, the live screen shows "Simulation complete" with the outcomes and stays until closed, with a button to continue to the Showcase, Awards Night or the offseason summary.

### Stats filters
- The Stats desk and the player and coach statistics use three linked filters: Region, Country (All, International, or a country with a domestic system) and Competition, with "All" totals summed across the matching competitions. Global competitions appear under Region All → International. Changing a filter resets the ones after it; the last selection is remembered per screen. Showcase-embargoed results stay excluded.

### Fairer international tournaments
- Seeded draws with pots for every tournament and qualifier (strongest by a national-team ranking of squad strength plus recent major results, one per group); the World Cup allows one team per confederation in a group, two for Europe.
- Euros, AFCON and Asian Cup: 24 teams, six groups of four, top two plus the four best third-placed teams to the Round of 16. Gold Cup: 12 teams, three groups, top two plus two best thirds to the quarter-finals. Copa América: two groups of five (South America has ten nations, so no guests are needed), top four of each to the quarter-finals over five matchdays (groups of five previously played only three of their five matchdays). World Cup: 32 teams, eight groups, seeded draw. Seeded knockout brackets: group winners meet runners-up or third-placed teams. Qualifying slots follow the new sizes.
- National-team gaps are compressed per tournament so favourites win about a quarter of major tournaments and top-four teams still go out in the groups now and then (see docs/CALIBRATION.md).
- Tournament pages show the pots, the best third-placed table and the seeding ranking.

### Awards
- Nationality flags next to names on Awards Night podiums and winner details (history lists already carried them).

### Saves
- Data revision 33. Tournaments already under way keep their old format and draw; new formats and seeded draws start with the next edition. Team fitness and the Squad Reshape report start empty. No Neon schema changes.

## v4.1 — Lighter leagues and live screens

- Every league game is now a quick result (scoreline and scorers, week by week): tables with points, GF and GA, top scorers, best players and goalkeepers all remain, with league appearances and ratings credited every four weeks. The full minute-by-minute engine plays continental and international football, domestic cups from the quarter-finals, two-legged ties, Showcase games and any club you follow. Detailed match logs (cards, substitutions, chances) are no longer kept for league games.
- Simulate to season end now plays week by week behind a live screen: progress, honours decided so far (top-5 league champions and cup winners, European trophies), knockout rounds in the Champions League, Europa League and Libertadores, and the top-5 league leaders with their top scorers. Showcase-selected games stay hidden.
- The offseason (including Continue to Offseason after Awards Night) runs in stages behind its own live screen: top signings, coaching changes and star retirements fill in as they happen. Results are identical to a single run.
- Seasons run about 30 % faster on the same machine.
- Fix: pricing a Champions League fixture before its group ranking was set could change later results; odds previews no longer store anything.
- Fix: the season-goals record is released after every season, not only when Showcase games were held.

## Phase 6 — Following feed, predictions and odds

- Following feed (Chronicle → Following, also linked from the home page): results, stories, transfers, loans and current injuries for the clubs, players, coaches and nations you follow, newest first. Showcase-embargoed results and their stories never appear.
- Predictions game (Awards → Predictions): before the first week, pick the Premier League, LaLiga, Serie A, Bundesliga and Ligue 1 champions, the Champions League winner, the Ballon d'Or and the World Golden Boot. Picks lock once the season starts. Points: 3 per league (1 for the runner-up), 5 for the Champions League (2 for the losing finalist), 5 for the Ballon d'Or (2 for the podium), 3 for the Golden Boot (1 for the podium); 28 in all. The card is scored at Awards Night once every award is revealed and joins a season-by-season history.
- Bookmaker odds: decimal prices (model probabilities with a 6 % margin) on Showcase match cards, the Showcase match screen and upcoming continental, international, derby and followed-team fixtures. Prices are well calibrated against results.
- Upsets: stories now quote the winner's price, long-priced winners (5.00 or more) in notable games make the news, and Magazine → Results lists the season's biggest upsets against the odds.
- Data revision 32 (predictions container). Picks never affect the simulation.

## Phase 5 — Derbies, home advantage, records, sackings and transfer drama

- Derbies (the historic rivalries) are always played by the full engine. They are more heated (about a third more cards and half as many red cards again), slightly more intense, and carry a much smaller home edge. Every derby gets its own headline, and an all-time head-to-head ledger (wins, draws, losses, goals, last six meetings) appears on the club Rivalries tab.
- The home edge now varies: big fan bases add a little to it and small ones reduce it, long continental trips add a little (more outside Europe), high-altitude venues (La Paz, Quito, Bogotá, Mexico City and others) add a lot against lowland visitors, derbies shrink it and neutral finals remove it.
- Live records, updated as matches are played: biggest win, longest unbeaten and winning league runs, most goals in a season, most league goals by a club, record transfer, most career goals and appearances, youngest and oldest scorers, all per competition too, plus invincible seasons and shootout leaders. Breaking a record or reaching a career milestone (100–600 goals, appearance landmarks) makes the news. A new Live records section opens the Almanac's World Records page.
- Spoiler embargo: matches selected for the Showcase do not touch records, the derby ledger or record stories until the postseason is over; the season-goals record is hidden while the Showcase is unresolved.
- Mid-season sackings: every three weeks from week 10 to 44, boards review coaches well below expectations and in poor form (coach rarity, recent titles and owner patience protect them). At most two per league and 50 a season (about 30–40 in practice). An interim takes over; the squad gets a fading new-coach bounce over six weeks, and at season end the interim either earns the job or makes way.
- Transfer drama: bidding wars between big clubs push fees up 8–22 %, stars turn down moves, a few deals collapse at the last moment and unhappy stars stuck in a summer standoff are reported, all under a "Transfer Drama" news category.
- Title fatigue (a deliberate balancing rule): a side that has won the same competition in consecutive seasons plays it under growing pressure. Two in a row is a small handicap, three a clear one, four or more makes another title very unlikely (leagues at 40 % strength). Three or four titles in the last six seasons count the same way, so alternate-year dynasties feel it too. Across four test universes no club passes four Champions League titles in 20 seasons and 11–14 clubs win it.
- Star hoarding (also a balancing rule): in the elite market a club's existing stars (a generational player counts 3, a legend 1.6, an epic 0.5) make it much less likely to land another generational, legend or epic player, and stars are less willing to join a squad already full of them. Clubs with three or more generational/legend players fell from about 1.1 to 0.5–0.8 per season, and no club holds two generational players at once.
- The crowd effect on the home edge is capped at ±12 %, and derbies keep 40 % of the usual home edge.
- Data revision 31: records start from the history already played; career goal and appearance counters are rebuilt from archived seasons.

## Phase 4 — Players who change over time

- Hidden potential: new young players start a few points below their ceiling (elite prospects closer). Yearly growth depends on minutes, average rating, coaching (Youth Developer coaches and coach quality), league level, personality and chance, on top of the existing career-curve archetype. Breakouts lift the ceiling, prospects who never play stall, late bloomers appear and some players decline early. Ability stays within one point of the rarity band, so rarity caps and Hall of Fame standards keep their meaning; the 88+ population stays stable (30–36 over eight seasons in the regression).
- The UI shows a scouting range that narrows with age ("Scouts see 82–88"; "Fully developed" later).
- In-season form follows recent match ratings (±2 rating points at the extremes): hot streaks and slumps, shown on profiles, squad lists and the Ballon d'Or race.
- Eight personality traits, one or two per player and more common types for stars: Loyal, Mercenary, Big-game player, Injury-prone, Leader, Hot-headed, Professional, Clutch penalty taker. They change renewals and departures, big-chance creation in decisive games, injury frequency, booking rates, development and longevity, and shootout conversion.
- Every club has a captain (leaders first); a leader on the pitch lifts the side slightly.
- Academy intake: top-flight clubs promote a youth graduate most summers (never above Rare), replacing a weak veteran.
- Loans: big clubs send young prospects who would not start to clubs where they will play; loans return next summer, count for development and appear in the career timeline, club pages and a new Loans tab in the transfer market.
- New signings are no longer released or loaned out again in the same window.
- Data revision 30: existing players receive traits and potential with no change to current ability, and every club gets a captain.

## Phase 3 — Fitness, rotation, injuries and suspensions

- Players carry match fitness. A full match costs about 16 points and a week restores 22, so two games a week are manageable and congested runs wear players down. Fitness is the player's starting energy in the match engine.
- Coaches keep their usual XI and fill only the gaps: injured and suspended players are out, tired players are rested in ordinary games, and up to half the starters are rotated in low-stakes games (early domestic cup rounds, super cups, dead rubbers late in the league). Finals, semi-finals, two-legged knockouts and derbies get the strongest XI available.
- Injuries come from the match engine (more likely when tired): knocks (1–2 weeks), medium (3–8), long-term (10–28) and rare career-threatening injuries (26–44 weeks) that cut ability and can shorten a career. Injury-prone players (Phase 4 trait) are hurt more often and for longer. Injuries carry across the summer minus six weeks of recovery.
- Suspensions: a straight red is a one- to three-match ban, a second booking one match; five yellows in a league or three in another competition bring a one-match ban. Bans are served in that competition's next matches.
- Injured players miss club and national games. Before World Cup and continental finals, notable absentees make the Magazine ("misses the World Cup", "is a doubt for…"); long-term and career-threatening injuries to notable players are reported too.
- Squad depth matters: unavailable starters are replaced from the bench, the extra squad players and, when a squad runs out, weaker cover.
- UI: injured, suspended and tired markers in squad lists and on player profiles; injury history on player statistics.
- Data revision 28 (discipline and ban containers).

### Light simulation for low-profile matches

- League matches outside the nine main leagues (England, Spain, Italy, Germany, France, Portugal, Netherlands, Brazil, Argentina), early domestic-cup rounds in those countries and all condensed leagues are now played light: a scoreline from the same kickoff expectations (with a small late-equaliser chance so draw rates match the full engine), named scorers and assisters, and one injury roll per side. No events, cards, ratings, fitness or match logs are kept.
- Players in those matches receive their appearances, clean sheets and season ratings once at season close, from team results and ability, so awards, honours and the Hall of Fame keep working.
- Continental, global and international football, cup quarter-finals onwards, Showcase-selected matches and anything involving a followed club always use the full engine.
- Data revision 29 (light appearance counters).

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
