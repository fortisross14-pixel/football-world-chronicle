# v0.21 spawning and preseason lifecycle validation

## Domestic player spawning

Procedural players now select a first club in their country of origin 90% of the time whenever that country has an active domestic system. The remaining 10% represents diaspora, family migration and unusual academy pathways.

Curated historical icons remain deliberate exceptions: they use their actual starting club when represented, or a same-country fallback when it is not.

A five-seed test forced 392 procedural replacements and produced:

- Domestic first clubs: 352
- Foreign exceptions: 40
- Aggregate domestic rate: **89.8%**

New rookies are protected through their first visible season so another signing cannot immediately displace them from the club where they emerged.

## Preseason lifecycle

The Preseason magazine now preserves structured records for:

- New Generational, Legend and Epic players
- New Generational, Legend and Epic coaches
- President changes at major clubs
- Player retirements
- Coach retirements

Coach careers now have a debut season, career year and career length. Retiring coaches leave their current job, remain accessible through career history and are replaced by a new coaching intake while the overall rarity distribution remains stable.

The deterministic regression forces an elite player retirement, an Epic coach retirement and a Real Madrid president change, then verifies all three appear in the following preseason.
