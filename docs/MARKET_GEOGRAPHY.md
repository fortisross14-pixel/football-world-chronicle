# Home-country ties and superstar careers

Player recruitment now uses the same geographic preferences across rookie intake,
ordinary transfers, elite transfers, payroll sales, and free-agent roster filling.
Previously, free-agent filling selected almost entirely by rating and could undo
the domestic spawn rules every summer.

- Procedural rookies retain roughly 90% domestic starts. Foreign academy paths
  favor nearby countries and language/cultural connections. Historical icons keep
  their curated starting clubs.
- Common, Uncommon and Rare players have the strongest home-country preferences.
  Overseas players can stay in their adopted country or return home. Every rarity
  retains an unusual international path; there are no squad nationality quotas.
- Connections include English-speaking countries, Spain and Spanish-speaking
  Latin America, broader Latin American recruitment, Portuguese-speaking countries,
  and several other regional/language groups.
- Elite destinations still depend on sporting fit and finances. Country weighting
  is normalized so hundreds of foreign clubs cannot overwhelm a smaller home pool.
  Late-career stars can consider Mexico, Japan, the USA, Australia and Saudi Arabia.

Every signing records its club arrival season and prevents another move in the
same summer. Renewing a contract does not reset club tenure. Elite players at major
clubs are exceptionally unlikely to become available after just one completed
season: 0.5% normally, 2% for severe unhappiness or financial pressure. Subsequent
summers consider happiness, tenure, club stature, career stage, success, migration
pressure, and a stable individual temperament.

Underpayment now contributes to elite unhappiness, alongside the existing sporting
ambition and honours/awards systems. Two consecutive unhappy seasons produce a
transfer request and strong availability, rather than a guaranteed sale. Buyers
still need a credible sporting project and resources. Persistent requests get
priority and can accept a modest sporting downgrade, fixing the situation where
a star at the highest-rated club had nowhere permitted to go.

Existing saves recover missing arrival dates from transfer history or consecutive
club season records. Current squads are not retrospectively reassigned. New fields
are stored in the existing save object; no database migration is needed.

## Verification

`npm run regression-market` covers domestic spawning, related destinations,
free-agent squad rebuilding, first-year retention, repeated unhappiness, salary
dissatisfaction, old-save tenure recovery, an actual requested transfer, and
protection against multiple moves in one summer.

`npm run career-balance -- 160926 260926` runs five full seasons for each supplied
seed and checks domestic cores and elite movement. These are simulation balance
checks, not intended to reproduce real-world transfer percentages exactly.

The targeted sample of 4,800 rookies produced domestic rates of 89.8–90.8% across
England, Spain, Germany and Mexico. A global free-agent rebuild retained domestic
cores of 82.7% in England, 85.1% in Spain and 89.9% in Mexico. Across 1,000 controlled
availability samples, three first-year top-club stars were available versus 980
established stars with two unhappy seasons. Availability remains distinct from
completing a transfer.

The final five-season run with seed 160926 retained domestic squad shares of 78.0%
in England, 75.3% in Spain and 86.9% in Mexico. Legends and Generational players
completed 16 moves across those five summers, with no player moving twice in a
single window. Syntax checks, the general smoke test, the historical portrait
regression, and the targeted market regression passed.
