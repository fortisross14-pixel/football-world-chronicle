# Football World Chronicle v0.2 architecture

## What this iteration proves

The prototype now validates the full world-to-history loop at a larger scale:

1. Generate 18 domestic football systems, 236 clubs and more than 1,400 named players.
2. Run one shared calendar for domestic leagues, domestic cups, continental football and international football.
3. Navigate by region, country and competition rather than by isolated features.
4. Inspect current-season matches and player contributions week by week.
5. Reuse a common competition presentation with Weekly, Current Year, History and Stats tabs.
6. Close the season and compact live detail into permanent player, club, award and champion summaries.
7. Begin a new season with aging, development, retirement and replacement prospects.

## Current simulation scope

### Domestic football

- Detailed leagues: Spain, England, Italy, Germany, France and Portugal.
- Condensed persistent leagues: Netherlands, Belgium, Scotland, Türkiye, Brazil, Argentina, Mexico, United States, Saudi Arabia, Japan, Morocco and Egypt.
- Every league has a domestic cup.
- Spain additionally has a four-team Super Cup.

Condensed countries still retain real club entities, tables, named players, champions and history. They use fewer clubs and named players to keep the world broad without requiring a 25-player roster for every team.

### Continental football

- European Champions Cup: 32 clubs, eight groups, Round of 16, quarter-finals, semi-finals and a single-game final.
- Domestic and continental awards use the same generic award categories.

### International football

- The world database contains 48 national teams across Europe, South America, North America, Asia and Africa.
- The currently playable tournament is the European Championship with qualifying and a knockout final tournament.
- Player international appearances and goals are stored through the same player-stat architecture.
- World Cup, Copa América, AFCON and Asian Cup cycles remain the next major engine expansion.

## Current-season detail and permanent history

During an active season the world retains:

- Match score and scorers.
- Assists, clean sheets and player ratings.
- Player match logs.
- League tables and cup brackets.
- News and weekly context.

At season closure it permanently stores:

- Player/competition season summaries.
- Club league-season summaries.
- Champions and runners-up.
- Individual awards and player honours.
- Landmark finals.
- Annual season review.

Ordinary match-level data is then removed. This is the defining storage contract: **detailed while active, compact after completion**.

## Competition view contract

All competitions expose four presentation layers:

- `weekly`: scheduled and completed matches grouped by simulation week.
- `current`: table/bracket plus current player leaders.
- `history`: season-by-season champions and award winners.
- `stats`: all-time records derived from compact historical rows and current-season data.

The UI resolves each competition through a descriptor rather than hardcoding a separate page for each league or cup. Adding another configured country therefore automatically provides navigation, competition tabs and history surfaces.

## Browser prototype versus production

The package intentionally has no external runtime dependencies and saves one world in IndexedDB. That makes it immediately playable, but IndexedDB is not the final persistence architecture.

Production target:

- React/Next.js application on Vercel.
- Neon PostgreSQL.
- Drizzle ORM.
- Short deterministic simulation batches committed transactionally.
- Live current-season tables separated from permanent history tables.
- Multiple save worlds attached to users.

`database/schema.sql` defines the initial relational structure.

## Compaction contract

Season closure must be atomic in the database-backed version:

1. Aggregate live player rows into `player_competition_seasons`.
2. Aggregate league tables into `club_league_seasons`.
3. Write champions, runners-up, awards and honours.
4. Copy finals and selected major matches into `landmark_matches`.
5. Write the season review.
6. Verify totals and record counts.
7. Delete non-landmark live match details.
8. Mark the edition compacted.

A failure in any step must roll back the transaction and leave the active season inspectable.

## Modules to split for production

The portable prototype keeps the engine in one JavaScript file. The production refactor should create:

- `calendar.ts`
- `match-engine.ts`
- `league-engine.ts`
- `knockout-engine.ts`
- `qualification-engine.ts`
- `international-cycle.ts`
- `player-careers.ts`
- `awards.ts`
- `season-compaction.ts`
- `narrative.ts`
- `repositories/`

## Next expansion priorities

1. Dynamic continental qualification from the previous domestic season.
2. Four-year international cycles: World Cup, Euro, Copa América, AFCON and Asian Cup.
3. Transfer windows and contracts.
4. Promotion/relegation for detailed countries.
5. Club finances, fans and changing league reputation.
6. Emergence of named players from anonymous squad depth.
7. Neon-backed save worlds and multiple save slots.
