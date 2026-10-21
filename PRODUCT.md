# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single player (the owner of the save) who follows an evolving football universe as a spectator and occasional editor rather than as a manager of one club. They play on a laptop browser with mouse or trackpad and on a landscape tablet with touch, in long sessions that span many simulated seasons. Phones in portrait must remain usable but are a secondary target.

## Product Purpose

Football World Chronicle simulates a persistent global football world beginning in Year 1: 137 domestic systems, continental and global club competitions, international cycles, and long careers for players, coaches and presidents. The player advances time, watches selected showcase matches, reveals the annual awards, and explores the history that accumulates: champions, records, dynasties, rivalries, transfers and Hall of Fame careers.

Success is that following decades of football history feels like a premium football management game: the next simulation step is always obvious, and any player, club, coach, nation or competition is a click away from its context and history.

## Positioning

A spectator chronicle of a whole football world rather than a one-club management game. Its distinct mechanism is long-horizon history: every season is compacted into permanent records, so the interest compounds across generations of players, coaching eras, league golden ages and club dynasties.

## Operating Context

- Time advances only through explicit simulation actions: one week, four weeks, to the end-of-season Showcase, open the Postseason, and run the offseason into the next season.
- The Postseason Showcase lets the player choose finals or semi-finals to watch minute by minute. Selected results are embargoed everywhere in the interface until played; unsimulated results must never be revealed.
- Awards Night reveals each podium sequentially.
- The offseason editor (club money, create or cancel transfers) is available only between seasons, before Week 1.
- Autosave goes to IndexedDB (localStorage fallback); an explicit Save uploads a chunked, compressed snapshot to Neon through Vercel functions, linked by a private cloud code.

## Capabilities and Constraints

- Vanilla JavaScript ES modules with HTML string templates and hash routes (`#/club/<id>/<tab>`, `#/competition/<id>/<tab>`, etc.). No framework and no build step; served statically and deployed on Vercel.
- `src/engine.js` (simulation, markets, awards, compaction) and `src/data.js` are not part of UI work. Save format version 4 and its data revisions, IDs and entity relationships must stay stable; any persistence change must be backward-compatible.
- Existing deep links must keep working.
- Regression scripts under `scripts/` import `src/app.js` with a fake DOM and assert on rendered text (for example spoiler embargo checks).
- Terminology: rarities are Common, Uncommon, Rare, Epic, Legend and Generational; "Showcase", "Awards Night", "Offseason", "Hall of Fame (FHoF)", "Magazine".

## Brand Commitments

- Name: Football World Chronicle.
- Rarity colour convention: Generational is red, Legend is gold, Epic purple, Rare blue, Uncommon green, Common grey.
- Existing visual assets must be reused through their lookup functions in `src/visuals.js` and `src/app.js`: generated player and coach portraits and curated historical portraits (`assets/faces/`), real club crests (remote logo URLs with fallbacks), national flags (flagcdn), and the SVG competition emblems. No generic avatars, emoji faces or invented badges.
- No external image-generation services.
- Fonts are bundled locally in the repository (confirmed by the user), not loaded from a third-party font host.
- Visual direction (chosen 2026-10-21): the category standard for premium football games, played straight. The craft bar is EA Sports FC Career Mode presentation with Football Manager information density; no novelty world on top.

## Evidence on Hand

- Portrait library: `assets/faces/players` (200), `assets/faces/coaches` (50), `assets/faces/historical` (206).
- Club colour treatments for major clubs: `CLUB_VISUALS` in `src/app.js`.
- Competition emblems: `competitionEmblem()` in `src/visuals.js`.
- No testimonials, users or metrics exist; none may be invented.

## Product Principles

1. The simulation decides; the interface reveals. Never leak an unplayed result.
2. The next simulation action is always visible and unambiguous, and nothing else can trigger it.
3. Every entity is a doorway: player to club, club to competition, competition to its history.
4. History is the reward. Records, honours and legacies get the most considered presentation.
5. Depth without equal weight: lead with the few numbers that matter and keep the full table one step away.

## Accessibility & Inclusion

Comfortable touch targets for tablet play, no hover-only interactions, readable text without zoom, visible focus states, and respect for reduced-motion preferences.
