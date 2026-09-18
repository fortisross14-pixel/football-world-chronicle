# UX and simulation restoration on v3.15

Restored from commit `8149e47` after the v3.15 update removed these changes.
The current portrait assets, version number and market/geography policies are retained.

## Navigation

- Profile breadcrumbs lead back to the appropriate directory.
- Sidebar scroll position survives rendering and navigation.
- Keyboard users can skip to content or close the mobile menu with Escape.
- Current-page, menu-expanded and notification announcements are accessible.

## Match simulation

`src/match-model.js` supplies the shared chance model for detailed and condensed leagues.
Coach style influences possession, shots and chances conceded. Defenders affect accuracy,
forwards affect accuracy and finishing, and goalkeepers affect conversion. Defensive
teams create and concede fewer chances; a strong keeper and striker make narrow wins
more likely. Cards are independently drawn, and red cards affect chance volume in
proportion to the time remaining.

Showcase statistics and card timing come from the actual simulated match. Replay
randomness uses independent, mixed seeds instead of closely correlated event indexes.
Goals count as shots on target, and clean sheets cannot exceed appearances.

These changes apply to future simulations. Existing results and prepared showcases
are preserved; no reset or database migration is required.

## Checks

- `npm run check`: includes the restored match-model module.
- `npm run tactics`: 96,000 controlled samples testing tactics, player quality, and cards.
- `npm run regression-simulation`: real fixtures, save/load continuation, a full season,
  and showcase consistency.
- `npm run runtime-ui` and `node scripts/regression-v313-ui.mjs`: navigation and spoiler checks.
- `npm run regression` and `npm run regression-market`: current portraits and market policy.

Keep `src/match-model.js` alongside `src/engine.js` when packaging future versions.
