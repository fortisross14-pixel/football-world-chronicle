# Tournament Favorite Balance — v0.17

The reported issue was valid. In the v0.16 baseline deterministic suite, the top-five pre-tournament favorites won only **9 of 16 major continental club editions (56.3%)**: Champions League 5/8 and Libertadores 4/8. The World Cup was 6/8, producing 15/24 overall. Individual upsets were enjoyable, but the aggregate world felt too random.

The engine changes were:

1. Individual legs of two-legged ties may end level; extra time and penalties occur only after the aggregate is level.
2. The first knockout draw is seeded from group-stage performance, avoiding unnecessary favorite-vs-favorite pairings immediately after the groups. Later rounds remain open draws.
3. Meaningful attack, defense and overall-strength gaps have more influence in high-stakes matches.
4. Major tournaments include a modest pre-tournament depth/consistency component for the leading contenders. This represents the unnamed squad, bench quality and tournament experience not fully captured by the visible stars.

### Deterministic v0.17 result

Eight fixed universes, 24 major tournament editions:

| Competition | Top-five champion rate |
|---|---:|
| Champions League | 8/8 — 100.0% |
| Copa Libertadores | 5/8 — 62.5% |
| World Cup | 5/8 — 62.5% |
| All three combined | 18/24 — 75.0% |

Dark-horse champions still appeared, including Montevideo Wanderers, Atlético Nacional, Belgium and Palmeiras. The test is intentionally deterministic and is a regression guard, not a claim that every eight-universe sample must produce identical percentages.
