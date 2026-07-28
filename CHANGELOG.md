# v0.8.1

- Fixed competition routing crash caused by a missing `baseFor` helper. International competitions such as the World Cup now render after their hash route opens.

# v0.8

- International sidebar simplified to Overview and Competitions.
- Fixed international competition card contrast and defensive rendering of incomplete group data.
- Added player market values to Player Pool.
- Distributed initial generational players among distinct elite clubs and penalized same-rarity hoarding in elite transfers.
- Rebuilt Magazine Results as 10-12 narrative stories using static rivalries, competition stage, table context, late goals, and standout performances.

# v0.7

- Added permanent coach competition-season and team-season statistics.
- Added games, wins, draws, losses, win percentage, goals scored, goals conceded, clean sheets and titles for coaches.
- Added coach profile pages with current job, rarity, nationality, tactical identity, career timeline, detailed competition record and trophy years.
- Added Coaches as a third Competition Stats sub-tab.
- Added a sortable Coaches section to the Almanac and global search.
- Stored the winning coach with every newly archived competition champion.
- Rebalanced national-team hiring: Tier 1 nations now overwhelmingly choose domestic coaches, while smaller nations remain more open to foreign appointments.
- Rebalanced club hiring to approximately 60–65% domestic coaches for major clubs, with elite clubs recruiting more globally.
- Rebuilt coach generation nationality distribution around the actual number of club and national-team jobs in each country.
- Added save migration to data revision 7.
- No Neon schema changes are required.

# v0.6

- Replaced generated condensed-country club names with recognizable six-club sets across the 137-country universe.
- Replaced text/emoji flag rendering with image-backed flags and reliable fallbacks.
- Fixed unreadable club text on dark player-profile headers.
- Optimized the global Player Statistics page and limited output to the top 50.
- Added competition-position filters and ranking by goals, assists, clean sheets, rating, games and titles.
- Promoted Magazine to first-level navigation with Transfers, Results and Player Performances tabs.
- Added four-week relevance scoring for major results, top-table clashes, upsets, finals and elite performances.
- Added current-year award races and historical Ballon d’Or, Golden Boot and Kopa podiums, plus annual positional winners.
- Added persistent International Football Overview/Nations and Competitions sections.
- Moved the first World Cup into the June–July 2002 window and continental qualifying/finals into their intended summer cycles.
- Added visible brackets and weekly fixtures/results for domestic cups, continental tournaments and international competitions.
- Added full World Cup final recaps with champion, finalist, MVP, young player, goalkeeper and top scorer.
- Fixed duplicate World Cup season statistics; a player can now record at most seven appearances in one edition.
- Increased same-nationality coach hiring, especially in major football countries, while preserving elite international appointments.
- Added version-4 save migration for renamed clubs and new archive fields.
- No Neon schema changes are required.

# v0.5

- Added prominent mobile Home/Menu controls, navigation scrim and close control.
- Added authentic color treatments for major European, Argentine, Brazilian, Mexican and Japanese clubs.
- Rebalanced transfer position needs, goalkeeper market values and elite-player movement.
- Added competition MVP plus best GK, defender, midfielder and forward awards.
- Added World Golden Boot using league-strength coefficients.
- Added an end-of-season summary with major continental winners and world awards.
- Added a club-by-season career timeline to player profiles.
- No Neon schema changes: cloud saves remain JSON snapshots.

# v0.4 — Complete Football World

## Domestic universe

- Expanded from 18 club countries to all 137 national-team countries.
- Added 29 full 20-team leagues with seven promotion-pool clubs each.
- Added three-team relegation and promotion after every completed season.
- Added 108 condensed domestic systems with six persistent leading clubs.
- Expanded the universe to 1,431 clubs and approximately 7,500 active named players.

## Continental competitions

- Added Europa League and Conference League.
- Added Copa Libertadores and Copa Sudamericana.
- Added CONCACAF Champions Cup.
- Added AFC Champions League and AFC Cup.
- Added CAF Champions League and CAF Confederation Cup.
- Added OFC Champions League.
- Added qualification allocation from domestic league and cup outcomes.

## Club leadership

- Added an owner/president to every club.
- Added eight owner profiles and staff rarities.
- Added financial, sporting, negotiation and patience effects.
- Added a global coach market larger than the available jobs.
- Added ten coaching identities with tactical effects.
- Added coach dismissal, free agency, elite appointments and trophy histories.

## Magazine and interface

- Added continental preseason favorites.
- Added promotion/relegation and coach-market news.
- Added hat-trick, upset, elite-performance and goalkeeper-masterclass stories.
- Added president and coach cards to club pages.
- Expanded country and confederation navigation for the complete universe.
- Replaced external flag images with native emoji flags and fallbacks.

## Balance and performance

- Reweighted Ballon d’Or voting toward elite leagues, major continental runs and major international tournaments.
- Added anti-dynasty pressure for repeated continental winners.
- Added financial caps and transfer-budget controls to reduce hoarding.
- Stabilized the active player population by renewing contracts and reusing free agents.
- Added runtime player, club and lineup indexes for much faster later-season simulation.
- Added an eight-season deterministic balance test.

## Compatibility

v0.4 uses save version 4 and starts a new universe. v0.3 cloud snapshots are not automatically migrated.
