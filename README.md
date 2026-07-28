# Football World Chronicle — v0.2

A dependency-free playable prototype of the broader football-world simulator: country-first navigation, domestic and continental competitions, international football, persistent player careers and compact historical archives.

## Run locally

You need Node.js. From this folder:

```bash
npm run dev
```

Open the local address shown in the terminal, normally `http://localhost:4173`.

The game autosaves one universe in browser IndexedDB. Use **Reset universe** to generate a fresh save.

## Expanded universe

- **18 simulated countries** and **236 clubs**.
- Detailed 16–20-club leagues in Spain, England, Italy, Germany, France and Portugal.
- Condensed but persistent leagues in the Netherlands, Belgium, Scotland, Türkiye, Brazil, Argentina, Mexico, United States, Saudi Arabia, Japan, Morocco and Egypt.
- A domestic cup in every simulated country.
- Spanish Super Cup.
- 32-club European Champions Cup with eight groups and a full knockout bracket.
- 48 national teams in the world database; the playable international cycle currently centers on European qualifying and the European Championship.
- 1,400+ named players, generally seven per detailed club and five per condensed club, plus national-team specialists.

## Country-first navigation

The sidebar now follows the football world rather than app features:

- World
- Annual Awards
- Europe and continental football
- Priority countries such as Spain, England, Italy, Germany and France
- Other countries grouped below
- Each country expands into its overview, league and domestic cup

Country pages provide direct access to competitions and clubs. Clicking a club opens a modal with its squad, current position, trophies and historical league finishes.

## Competition pages

Every league, cup and major tournament uses the same four-tab structure:

1. **Weekly View** — fixtures and results by week.
2. **Current Year** — standings or bracket plus scoring, assist, goalkeeper and rating leaders.
3. **History** — champion, runner-up, top scorer, best offensive player and best defender by season.
4. **Stats** — all-time player and club records, including goals, assists, ratings, clean sheets, points, wins and titles where relevant.

## Simulation and history

- Advance one week, four weeks or to season end.
- Current-season player match logs retain goals, assists, clean sheets and ratings by match.
- At season end, ordinary match detail is compacted into permanent player and club summaries.
- Awards, trophies, honours, champions and landmark finals remain permanently available.
- Ballon d'Or, World Best XI, young-player awards and competition-specific awards are generated annually.
- Players age, develop, decline, retire and are replaced by new prospects.

## Scope of this iteration

This is still a browser-first prototype. It uses a simplified, score-focused match engine and does not expose shots, possession or xG. The production backend is not connected yet; `database/schema.sql` and `docs/ARCHITECTURE.md` describe the intended Neon/PostgreSQL migration.

The next major international expansion is the full four-year cycle for the World Cup, Copa América, AFCON, Asian Cup and their qualifiers.

## Files

- `src/data.js` — countries, leagues, clubs, national teams and name pools.
- `src/engine.js` — deterministic simulation, awards and compaction engine.
- `src/app.js` — country navigation, competition tabs and entity views.
- `styles.css` — responsive interface and modal system.
- `database/schema.sql` — proposed PostgreSQL schema.
- `docs/ARCHITECTURE.md` — lifecycle and backend notes.
- `scripts/smoke-test.mjs` — complete-season simulation test.
