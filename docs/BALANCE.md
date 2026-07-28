# v0.4 deterministic balance pass

The included report simulates eight complete seasons from the same seed.

## Results

- Six different Champions League winners.
- Longest Champions League title streak: two seasons.
- No weak-club Champions League winner under the test threshold.
- Every Ballon d'Or winner came from an elite European context.
- Stable active-player population: 7,715 after eight seasons.
- Highest-scoring Common player: 198 goals in 347 appearances, well below the runaway-career warning.
- Average transfer activity: 332 moves per season.
- Median club finances: $334m; maximum $920.5m; no club crossed the $1bn hoarding threshold.

The machine-readable output is in `docs/BALANCE_REPORT.json`. Run it again with:

```bash
npm run balance
```
