# v3.16 balance and rollover report

Two deterministic 20-season universes were run after the final dynasty, league-era, Hall of Fame and performance changes.

| Seed | UCL winners | Leading club | Leading title ages | Most semifinals | European eras | Hall inductees | Avg. season close | Avg. offseason | Slowest offseason |
|---:|---:|---|---|---:|---:|---:|---:|---:|---:|
| 271828 | 7 | Real Madrid — 7 | 3 + 4 | 12/20 | 3 | 7 | 1.70s | 6.37s | 8.83s |
| 314159 | 11 | Liverpool — 4 | 3 + 1 | 9/20 | 3 | 7 | 1.89s | 7.14s | 9.26s |

The first seed is the deliberate stress case: before the final repeat-champion pressure it produced Bayern winning 11 of 20 Champions Leagues and reaching 17 semifinals. On the final rules Bayern won two, while Real Madrid remained historically important through two separated title ages.

In both universes the active European golden-era league ranked in the top three in every season. The final 314159 run produced no harness warnings, and elite-club payroll peaked at 1.208 times sustainable capacity. Smaller promoted clubs can temporarily show larger ratios because their wage base is very small; total-payroll checks still prevent new signings until room is created.

Run the same harness with:

```bash
npm run balance-v316
```
