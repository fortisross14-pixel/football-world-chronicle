# Football World Chronicle — v0.4

A browser-first football universe simulator with 137 domestic systems, continental club football, international cycles, long player careers, transfers, club staff, historical records and optional Neon cloud saves.

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
3. Replace the repository files with v0.4.
4. Push to GitHub and let Vercel deploy.
5. Open the game and press **Save**.

No local Vercel variables are required unless cloud saving is tested on localhost.

## v0.4 football world

- **137 national teams and 137 domestic football systems**.
- **29 full leagues** with 20 top-flight teams, seven promotion-pool clubs and annual three-up/three-down movement.
- **108 condensed leagues** with six persistent leading clubs; champions, cup winners and continental qualifiers are still simulated.
- **1,431 persistent clubs**, approximately **7,500 active named players**, 1,431 presidents/owners and a larger coach market.
- FC Barcelona remains excluded. Atlético Madrid, Athletic Club, Valencia and Sevilla begin with stronger resources and quality.
- The calendar begins in **2001**.

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

## Balancing and performance

The engine includes an eight-season deterministic balance test covering continental dominance, Ballon d’Or context, player scoring, transfer activity, active-player population and club finances.

A tested eight-season sample produced:

- Six Champions League winners; the longest title streak was two seasons.
- Ballon d’Or winners exclusively from elite European contexts in that sample.
- No weak Champions League winner.
- Stable active-player population.
- About 332 transfers per season.
- No club exceeding the anti-hoarding finance warning.

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
