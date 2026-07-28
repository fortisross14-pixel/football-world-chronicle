# Football World Chronicle v0.4 architecture

## Practical architecture

The game remains browser-first because that is the fastest and simplest way to simulate a large private universe:

```text
Browser simulation + IndexedDB autosave
                 ↓ explicit Save
         Vercel /api/save
                 ↓
       Neon JSON cloud snapshot
```

The active universe is one JavaScript object. Weekly simulation, current-season detail and historical compaction all happen locally. Neon is used as a cloud-save and cross-device synchronization layer rather than as the live simulation engine.

## Why the cloud snapshot is sufficient

At the end of every season, ordinary match detail is discarded after the engine writes compact player, club, champion, award, honour, transfer and landmark-match summaries. This prevents the save from growing like a permanent play-by-play database.

The cloud payload is GZIP-compressed in the browser and divided into small sequential chunks before upload. The API stores those chunks inside the existing `game_data` JSONB field, so no additional Neon table is required. Loading retrieves the metadata and chunks separately, reassembles the payload and writes the restored universe into IndexedDB.

## Save flow

1. The player presses **Save**.
2. The game performs its normal local IndexedDB save.
3. The world object is serialized and GZIP-compressed when supported.
4. The browser divides the compressed payload into roughly 600 KB parts.
5. The parts are posted sequentially to `/api/save` using one upload identifier.
6. The Vercel function reads `DATABASE_URL` privately.
7. Neon upserts the parts into one row in `cloud_saves`.
8. The interface reports progress and the final cloud timestamp.

The browser never sees the Neon connection string.

## Load flow

1. The player enters the same private cloud code on another device.
2. `/api/load` retrieves lightweight metadata for the matching snapshot.
3. The browser downloads the stored parts separately and reassembles them.
4. The browser decompresses and validates save version 4.
5. The local IndexedDB universe is replaced.
6. The interface renders the downloaded world.

## Core simulation modules

### Data layer

`src/data.js` defines:

- 29 full domestic pyramids and 108 condensed systems.
- 1,431 clubs and starting strength/resources.
- Eleven continental club competitions.
- Owner and coach profiles, rarities and effects.
- 137 national teams and four generation tiers.
- ISO flag codes and confederations.
- Expanded multilingual name pools.
- Six rarity bands.
- Position-specific tactical roles.
- Ten career-curve archetypes.

### Engine layer

`src/engine.js` owns:

- Deterministic random generation.
- Rarity population limits and replacement stars.
- Country-tier nationality weighting.
- Career length, base quality and annual multipliers.
- Club finances, budgets, happiness and transfers.
- Promotion/relegation, owner effects and coach-market decisions.
- Domestic, eleven-continent-club and international calendars.
- Simplified match outcomes and role-weighted statistics.
- Awards, trophies, records and season compaction.

### Presentation layer

`src/app.js` provides:

- Country-first navigation.
- International competition and national-team pages.
- Weekly, Current Year, History and Stats competition tabs.
- Player Pool and Statistics tabs.
- Team and player all-time record subtabs.
- Detailed trophy and individual-award lists.
- IndexedDB autosave plus explicit Neon Save/Load controls.

## International cycle

The simulation uses a readable four-year rhythm rather than reproducing every real-world calendar detail:

- Year 1: World Cup qualifying.
- Year 2: World Cup finals.
- Year 3: confederation qualifying/friendlies.
- Year 4: confederation championships.

The cycle is data-driven enough to add other competitions later without changing the save architecture.

## Current-season detail and permanent history

During an active season the world retains match scores, player logs, tables, brackets, news, transfers, injuries/availability state where applicable and leaderboard data.

At closure it permanently retains:

- Player/competition season summaries.
- Club/competition season summaries.
- Champions and runners-up.
- Individual awards.
- Player honours with exact seasons.
- Landmark finals.
- Transfer history.
- Annual review.

The detailed current-season match collection is then cleared.

## Relational schema status

`database/schema.sql` remains an optional future model. The current game does not require those tables and does not write to them. Only `cloud_saves` is required.

A future relational migration would become worthwhile only for public universes, multi-user rankings, server-side simulation or SQL-heavy historical analysis.
