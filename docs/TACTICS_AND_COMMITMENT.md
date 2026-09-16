# Tactical matches and club commitment

## Match simulation

Detailed fixtures and condensed leagues share a chance-based model. Existing squad strength, coach quality, competition context and home advantage still set the starting expectations.

- Defensive coaches reduce their own chance volume and the chances they concede. Direct and pressing coaches create more shots; possession coaches favour control, and counter-attacking coaches trade volume for conversion.
- Midfield quality influences possession. Defenders influence shooting accuracy; forwards influence accuracy and finishing; goalkeepers influence saves.
- Cards use independent draws for each side, with tactical intensity, defensive quality and referee strictness affecting their frequency. A dismissal reduces attacking output and increases the opponent's opportunities in proportion to the time remaining.
- Goals come from shots on target. Showcase statistics reuse the original match totals, and card timing is retained. Extra-time deciding goals also count as shots on target.
- A defensive team can win regularly by a single goal with a strong keeper and striker, while upsets and scoreless matches remain possible.

## Transfers

- Players cannot move twice in the same window.
- Established destinations (top-division Tier S/Tier 1 clubs with reputation at least 85) normally retain new signings for at least three seasons. Serious unhappiness or financial distress can permit a rare departure after two.
- Happy contracted players remain less likely to make sideways moves after the initial commitment. Trophy droughts reduce their happiness gradually.
- New top-club signings receive four- or five-year contracts; happy players are more likely to renew. Automatic free-agent roster signings follow the same commitment rules.
- Genuine career upgrades can follow one season at a smaller club. Later moves due to unhappiness, contract expiry and financial pressure remain possible.
- The elite market, ordinary market and both payroll-clearance paths share these rules.

## Existing worlds

Data revision 23 restores arrival dates from transfer history, with a conservative career-based estimate when no transfer exists. Existing results and prepared showcases remain unchanged. Future fixtures use the new model; no reset or database schema change is required.

## Validation

- `npm run tactics-commitment`: 96,000 deterministic match samples; chance/goal consistency, tactical differences, keeper/striker effects, independent cards, and transfer-policy scenarios.
- `npm run simulation-regression`: four full seasons, save/load determinism, old-save migration, showcase consistency, summary-league clean sheets, and transfer stability.
- `npm test`, `npm run check`, `npm run runtime-ui`, and `node scripts/regression-v313-ui.mjs`: existing simulation, syntax, navigation and showcase embargo checks.

In the controlled equal-strength sample, defensive teams generated 7.8 shots and conceded 7.6, versus about 10.9 each for balanced teams. A defensive team with a 95-rated keeper and striker won 1–0 in about 20% of matches, versus 10% for the balanced baseline. These are calibration scenarios, not guaranteed real-season outcomes.
