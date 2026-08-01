# Football World Chronicle — v0.21

A browser-first football universe simulator with 137 domestic systems, continental club football, international cycles, long player careers, transfers, club staff, historical records and optional Neon cloud saves.


## v0.21 domestic spawning and preseason lifecycle

- Procedural footballers now start in their nationality's domestic system 90% of the time. The controlled foreign minority represents diaspora, family migration and unusual academy stories.
- Historical icons remain curated exceptions and still use their real starting club or a same-country fallback.
- New players are protected through their debut season, so the opening market cannot instantly erase the story of where they emerged.
- Coaches now have careers, retire and are replaced by a new intake that preserves the coaching world's rarity balance.
- Magazine → Preseason now shows elite player debuts, elite coach debuts, major-club president changes, player retirements and coach retirements.
- Existing saves upgrade automatically to data revision 13. No Neon changes are required.
- Run `npm run regression-v21` for the lifecycle check; see `docs/SPAWNING_V21.md` for the aggregate spawning test.



## v0.20 competitive hierarchy and coach focus

- Elite-player influence is now nonlinear: a 90+ star in a secondary league materially changes team strength and receives a much larger share of that team’s goals.
- Strong squads are substantially more consistent across 34–38 league matches, while cups and finals retain more variance.
- Removed the global league penalty previously attached to recent continental dynasties; a small pressure remains only inside major continental competitions.
- Coaches now have a second identity: **Tournament**, **Regularity**, or **Balanced**. It is visible in People, profiles, team pages and coach-transfer news.
- Regularity coaches convert quality into league points; Tournament coaches provide their biggest edge in knockout rounds and finals; Balanced coaches contribute in both.
- Ballon d’Or selection now applies club-level diminishing returns. A single trophy normally supports one podium candidate; doubles can support two, and treble-level seasons can occasionally support three.
- Existing saves upgrade automatically to data revision 12. No Neon changes are required.
- See `docs/BALANCE_V20.md` and run `npm run balance-v20` for the new regression scenario.


## v0.19 historical icons, competition overview and peak eras

- Every competition opens on a new **Overview** tab with the current top three/current stage, most successful teams, all-time scorers, assists, goalkeeper leaders and MVP counts.
- Magazine Results now focuses on recently completed competitions, showing winner, runner-up, MVP and top scorer. The duplicated Player Performances section has been removed.
- Football Hall of Fame club teams now use the strongest consecutive two- or three-season window from an uninterrupted coaching era, rather than the final seasons of the tenure.
- Added a curated pool of **16 Generational, 69 Legend and 120 Epic historical icons**. Only a controlled share is active at one time; the remaining elite population stays procedural.
- Historical icons use curated nationality, role, ability, career curve and starting club. Missing clubs fall back to a club in the same country. They complete their first visible season at that starting club before entering the normal transfer market.
- Preseason and player profiles identify historical icons.
- Run `npm run regression-v19` for curated-pool, spawn-ratio and peak-era checks.

## v0.18 goalkeeper and superstar-market balance

- Goalkeepers remain essential but no longer dominate high-profile transfers or open player-of-the-season awards.
- Clean sheets contribute modestly to ratings; poor multi-goal concessions now reduce goalkeeper and defender ratings.
- Match MVP selection uses the actual match performance rather than permanent ability.
- Market values now have rarity- and position-specific ceilings, with lower goalkeeper ceilings.
- Elite rookies may develop anywhere, but prime Generational and Legendary players build migration pressure when a non-elite club fails to reach major continental finals.
- Winning a recent Libertadores or equivalent major continental title can delay European poaching.
- Run `npm run market-balance` for the deterministic report.

## Run locally

```bash
npm install
npm run dev
```

Open the local address shown in the terminal, normally `http://localhost:4173`.

The game autosaves locally in IndexedDB. The explicit **Save** button uploads the same universe to Neon through the Vercel API.

## Deploy

The repository is ready for the existing GitHub → Vercel workflow.

1. Confirm the Vercel project has `DATABASE_URL`.
2. Confirm Neon contains `cloud_saves` from `database/cloud-save.sql`.
3. Replace the repository files with v0.21.
4. Push to GitHub and let Vercel deploy.
5. Open the game and press **Save**.

No local Vercel variables are required unless cloud saving is tested on localhost.

## v0.7 football world

- **137 national teams and 137 domestic football systems**.
- **29 full leagues** with 20 top-flight teams, seven promotion-pool clubs and annual three-up/three-down movement.
- **108 condensed leagues** with six persistent leading clubs; champions, cup winners and continental qualifiers are still simulated.
- **1,431 persistent clubs**, approximately **7,500 active named players**, 1,431 presidents/owners and a larger coach market.
- FC Barcelona remains excluded. Atlético Madrid, Athletic Club, Valencia and Sevilla begin with stronger resources and quality.
- The calendar begins in **2001**.


## v0.7 coaching history and nationality balance

### Coach history

- Every match now updates the active club or national-team coach record.
- Coach profiles show team-by-season and competition-by-competition results.
- Competition Stats includes a Coaches tab for games, wins, win rate, goals, goals conceded and titles.
- Almanac includes a sortable Coach archive with rarity, nationality and current job.
- Winning coaches are permanently attached to competition champions.

### Nationality balance

- Tier 1 national teams overwhelmingly prefer a coach from their own country.
- Tier 2 and Tier 3 countries retain progressively softer domestic preferences.
- Minor national teams remain open to foreign expertise.
- Major clubs target roughly 60–65% domestic appointments; elite clubs recruit more globally.


- Condensed countries now use recognizable real club names rather than generated labels such as “Croatia Athletic”.
- Flags use image-backed country flags with compact code fallbacks.
- Player Statistics and competition rankings render only the top 50 and can be filtered by position and ranked by goals, assists, clean sheets, rating, games or titles.
- Magazine is a first-level menu with Transfers, Results and Player Performances sections. Results are selected from the last four weeks using competition, round, club strength, table position, upset and score relevance.
- Annual Awards now retain Ballon d’Or, World Golden Boot and Kopa gold/silver/bronze, plus best GK, defender, midfielder and forward.
- International Football has a persistent competition directory for qualifiers and final tournaments. The first World Cup begins in June 2002, runs week by week through groups and the final, and is archived before the next transfer window.
- Domestic cups, continental competitions and international tournaments expose knockout brackets and weekly fixtures/results.
- World Cup appearances are compacted once per edition and capped naturally at seven matches.
- Coaches are more frequently recruited from the club or national team’s own country, while elite coach generation remains concentrated in stronger football nations.

No Neon schema change is required. v0.7 remains compatible with version-4 JSON cloud saves. Existing universes are upgraded in place; coach statistics begin from matches available after the upgrade.

## Continental club football

Eleven competitions now share the global calendar:

- European Champions League, Europa League and Conference League.
- Copa Libertadores and Copa Sudamericana.
- CONCACAF Champions Cup.
- AFC Champions League and AFC Cup.
- CAF Champions League and CAF Confederation Cup.
- OFC Champions League.

Domestic league and cup outcomes feed qualification for the following season.

## Presidents and coaches

Every club has a persistent president/owner with a rarity and operating profile. Their bonuses affect sporting stability, available money, negotiation leverage and patience with the coach.

The coach pool is larger than the number of club and national-team jobs, creating free agency. Coaches have rarities and tactical identities such as pressing, counter-attacking, defensive rock, possession, adaptive, tournament specialist and youth developer. Strong teams pursue stronger coaches, and underperforming coaches can be dismissed at season end.

## Star generation

Every named player has:

- Common, Uncommon, Rare, Epic, Legend or Generational rarity.
- Rarity-constrained base quality.
- Position and tactical role affecting goals, assists and defence.
- One of at least ten career-curve archetypes.
- An 8–13-year career path.
- Contract years, happiness, salary and market value.

Population controls maintain no more than three simultaneous Generational players, approximately 12–15 Legends and 30–50 Epics. Nationality generation is weighted by four country tiers.

## International football

The readable four-year cycle remains:

- **Year 1:** World Cup qualifying.
- **Year 2:** World Cup.
- **Year 3:** continental qualifying and friendlies.
- **Year 4:** Euro, Copa América, AFCON, Asian Cup, Gold Cup and Oceania Nations Cup.

National teams select up to eight visible stars with no more than one goalkeeper. Caps, international goals, tournament honours and awards are retained permanently.

## Magazine and history

The World Magazine now publishes:

- Preseason continental favorites.
- Major Epic, Legend and Generational transfers.
- Promotion and relegation reports.
- Elite coaching appointments.
- Upsets, hat tricks, exceptional goalkeeper clean sheets and 9.5-level star performances.
- Finals and season-review stories.

Player and club profiles list the exact trophies, individual awards and winning seasons rather than only an aggregate honors number.

The mobile layout now has permanent **Home** and **Menu** controls. Major clubs use recognizable real-world color treatments, competition archives include positional awards, player profiles include a club-by-season timeline, and completed seasons show a dedicated summary with major champions, Ballon d’Or and the coefficient-weighted World Golden Boot.

## Balancing and performance

The engine includes a configurable deterministic balance test covering continental dominance, Ballon d’Or context, player scoring, transfer activity, active-player population and club finances.

The current six-season sample produced:

- Four Champions League winners; no consecutive winner.
- A 100% credible-context rate for Ballon d’Or winners.
- No weak Champions League winner.
- Stable active-player population.
- About 329 transfers per season.
- One club above $1bn after six years, below the anti-hoarding warning threshold.

Runtime roster and entity indexes substantially reduce weekly simulation work, especially for later seasons and condensed-league closure.

## Cloud saving

Cloud saving stores one compressed, chunked JSON snapshot per private cloud code. Chunking keeps long current-season saves below serverless request limits without requiring another Neon table:

```text
Tablet browser → /api/save → Vercel Function → Neon cloud_saves
```

On the first cloud save, the game creates a private cloud code. Enter that code on another device and press **Load cloud** to retrieve the same universe.

## Files

- `src/data.js` — 137 domestic systems, clubs, countries, continental formats, staff profiles, roles, careers and names.
- `src/engine.js` — simulation, promotion/relegation, staff markets, transfers, awards, magazine and compaction.
- `src/app.js` — navigation, entity pages, records and cloud controls.
- `api/save.js` / `api/load.js` — Vercel functions for Neon snapshots.
- `database/cloud-save.sql` — the only database table required by the current application.
- `database/schema.sql` — optional future relational model; not required for play.
- `scripts/smoke-test.mjs` — structural and season-lifecycle test.
- `scripts/balance-test.mjs` — deterministic multi-season balance report.
