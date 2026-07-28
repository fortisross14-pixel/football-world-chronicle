# v0.6 deterministic balance pass

The included report simulates **eight complete seasons** from a fixed seed after the calendar, award, transfer and archive changes.

## Results

- 6 different Champions League winners.
- Longest Champions League title streak: 2 seasons.
- No weak-club Champions League winner under the test threshold.
- Ballon d’Or credible-context rate: 100%.
- Highest-scoring Common player: 172 goals in 329 appearances after eight seasons.
- Average transfer activity: 332 moves per season.
- Median club finances after eight seasons: $338.5m.
- Maximum club finances: $907.8m; no club crossed the $1bn warning threshold.
- Active rarity controls remained at 3 Generational, 14 Legend and 42 Epic players.
- The test completed with **no balance warnings**.

The smoke test additionally confirms recognizable Croatian club names, a June-starting 2002 World Cup, a complete four-round knockout bracket, no player above seven World Cup appearances, all global award podiums and the goalkeeper transfer cap.

The machine-readable output is in `docs/BALANCE_REPORT.json`. Run it again with:

```bash
npm run balance
```
