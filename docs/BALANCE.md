# v0.5 deterministic balance pass

The included report simulates **six complete seasons** from a fixed seed after the transfer and dynasty adjustments.

## Results

- 4 different Champions League winners.
- Longest Champions League title streak: 1 season.
- No weak-club Champions League winner under the test threshold.
- Ballon d'Or credible-context rate: 100%.
- Highest-scoring Common player: 152 goals in 199 appearances.
- Average transfer activity: 329 moves per season.
- Median club finances after six seasons: $252.0m.
- Clubs above the $1bn warning threshold: 1 of 1,431.
- The test completed with **no balance warnings**.

The transfer-market smoke test also checks that goalkeepers do not occupy more than four of the 20 largest deals and that elite players move during the opening window.

The machine-readable output is in `docs/BALANCE_REPORT.json`. Run it again with:

```bash
BALANCE_SEASONS=6 npm run balance
```
