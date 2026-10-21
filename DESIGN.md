---
name: Football World Chronicle
description: A premium dark football-game shell for following a simulated world across decades.
colors:
  midnight-0: "#050a14"
  midnight-1: "#0a1324"
  midnight-2: "#0f1b31"
  midnight-3: "#15243f"
  midnight-4: "#1c2f50"
  rail-navy: "#070e1c"
  hairline: "rgba(150, 180, 230, .11)"
  hairline-strong: "rgba(150, 180, 230, .2)"
  hairline-hover: "rgba(150, 180, 230, .32)"
  ink: "#e9eff9"
  ink-secondary: "#aebbd2"
  ink-muted: "#8391ab"
  signal-cyan: "#3fd0ff"
  signal-cyan-deep: "#12b5ec"
  cyan-ink: "#03111c"
  trophy-gold: "#e9b949"
  trophy-gold-deep: "#c9962a"
  alarm-red: "#ff4d5e"
  pitch-green: "#3ad391"
  embargo-amber: "#f5b83d"
  rarity-common: "#a3afc0"
  rarity-uncommon: "#3fcf8e"
  rarity-rare: "#52a8ff"
  rarity-epic: "#b884ff"
  rarity-legend: "#e9b949"
  rarity-generational: "#ff4d5e"
typography:
  display:
    fontFamily: "Archivo, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(3rem, 5.4vw, 4.75rem)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-.01em"
    fontVariation: "'wdth' 70"
    fontFeature: "'tnum' 1"
  headline:
    fontFamily: "Archivo, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "2.5625rem"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: ".005em"
    fontVariation: "'wdth' 72"
  title:
    fontFamily: "Archivo, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: ".01em"
    fontVariation: "'wdth' 76"
  section:
    fontFamily: "Archivo, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: ".05em"
    fontVariation: "'wdth' 82"
  panel-title:
    fontFamily: "Archivo, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: ".005em"
  number:
    fontFamily: "Archivo, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1
    fontVariation: "'wdth' 78"
    fontFeature: "'tnum' 1"
  body:
    fontFamily: "Archivo, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  data:
    fontFamily: "Archivo, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.45
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Archivo, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: ".1em"
rounded:
  sm: "4px"
  md: "7px"
  lg: "10px"
  stage: "14px"
spacing:
  hair: "4px"
  xs: "8px"
  sm: "12px"
  gap: "16px"
  lg: "22px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.signal-cyan-deep}"
    textColor: "{colors.cyan-ink}"
    typography: "{typography.data}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.midnight-3}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.midnight-4}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  sim-button:
    backgroundColor: "{colors.midnight-3}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "40px"
  sim-button-primary:
    backgroundColor: "{colors.signal-cyan-deep}"
    textColor: "{colors.cyan-ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "40px"
  input-field:
    backgroundColor: "{colors.midnight-0}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  panel:
    backgroundColor: "{colors.midnight-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px 18px 18px"
  status-chip:
    backgroundColor: "{colors.midnight-3}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  sub-tab-active:
    backgroundColor: "{colors.signal-cyan}"
    textColor: "{colors.cyan-ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "34px"
  rail-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "46px"
  match-score:
    backgroundColor: "{colors.midnight-0}"
    textColor: "{colors.ink}"
    typography: "{typography.number}"
    rounded: "5px"
    height: "34px"
---

# Design System: Football World Chronicle

## Overview

**Creative North Star: "The Matchday Console"**

The interface is a premium football-game shell played straight: the presentation craft of EA FC Career Mode menus carrying Football Manager information density. Midnight navy structure sits in stepped tonal surfaces with cool hairline borders. A small set of signal colours each carry one meaning, so a glance tells the player what is selected, what is won and what is rare. Archivo's variable width axis does the brand work. Heavy condensed caps set season labels, hero names and every number that matters. Normal-width Archivo sets UI text, and data stays in tabular figures.

Density is high but ranked. Hero stages (the Home season stage, competition and profile heroes, the magazine cover, the awards stage) lead each screen with one large condensed figure or name. Everything beneath them sits in panels whose rows are separated by hairlines, read like a broadcast graphic or a game ledger. The simulation control bar at the far right of the command bar is the signature surface. It holds the game's single cyan primary action, which changes with the season phase and locks while a simulation runs.

This world replaces an earlier light dashboard. It rejects the website pattern of a long link sidebar, eyebrow-plus-title cards and equal-weight stat-card grids.

**Key Characteristics:**
- Dark only (`color-scheme: dark`): five navy surface steps plus a rail navy, with depth carried by tone and hairlines.
- Signal colours with one job each: cyan for interaction, gold for honours, red for Generational and loss, green for wins, amber for embargo.
- One variable family, Archivo: condensed 68–85% width for display and numbers, 100% for UI, tabular figures in data.
- Persistent shell: rail with five destinations, sticky command bar (section, season clock, tools, simulation bar), section strip.
- Hairline-separated rows inside panels and segmented stat ribbons instead of card grids.
- Short ease-out motion (140–220ms). Overlays and podium entries animate only when they first appear. Reduced motion is honoured.

## Colors

A cold midnight structure lit by a few saturated signals, each tied to a single meaning.

### Primary
- **Signal Cyan** (signal-cyan, with Signal Cyan Deep as the lower stop of its gradient): selection, focus, primary action and progress, nothing else. Used for the active rail marker and icon, the tab and section-strip underlines, the active sub-tab and week chip fills, the focus outline and input focus ring, the single primary button, the season-clock and postseason progress fills, played-week ticks, and the busy simulation readout. Text on cyan fills is Cyan Ink.

### Secondary
- **Trophy Gold** (trophy-gold, deep stop trophy-gold-deep): trophies, champions and Legend rarity. Used for champion ranks, trophy counts and tags, honour chips, the final-result and Ballon d'Or stages, the Awards Night winner podium, completed-competition and champion callouts, the gold trophy edge on table rows, and Legend portrait frames and rating orbits.

### Tertiary
- **Alarm Red** (alarm-red): Generational rarity, relegation, defeats (the L in form strips, low ratings, missed penalties), the live-match chip and destructive menu items. Text on red tints uses the lighter `#ff8a95`.
- **Pitch Green** (pitch-green): wins and positive state. Used for the W in form strips, high ratings, scored penalties, goal events, the save indicator and success toasts.
- **Embargo Amber** (embargo-amber): unplayed Showcase results and pending state. Used for dashed-outline embargo chips and rows, the offseason editor notice, penalty notes under scores and the goalkeeper position chip.

### Rarity scale
Common grey, Uncommon green, Rare blue, Epic purple, Legend gold, Generational red (the frontmatter rarity-* tokens). This convention is a brand commitment. Rarity badges render each colour as text on a 14% tint with a 38% inset ring. Legend and Generational add a gradient tint, a coloured portrait frame and a coloured glow at large sizes.

### Neutral
- **Midnight 0** (midnight-0): page ground, input wells and the score box. The body adds two faint blue radial glows over it.
- **Midnight 1–2** (midnight-1, midnight-2): panel gradient (2 at the top to 1 at the bottom), ribbons, tiles, modals.
- **Midnight 3–4** (midnight-3, midnight-4): raised controls, chips and their hover state, progress tracks.
- **Rail Navy** (rail-navy): the rail's gradient foot.
- **Hairline / Strong / Hover** (hairline, hairline-strong, hairline-hover): cool translucent borders. Use hairline for row separators and panel edges, strong for control borders and hero edges, hover for the hover border.
- **Ink / Secondary / Muted** (ink, ink-secondary, ink-muted): primary text, supporting text and inactive nav, then labels, metadata and placeholders.

### Named Rules
**The One-Job Signal Rule.** Each signal colour has one meaning. Cyan never decorates. If a cyan element is not selected, focused, the primary action or progress, it is the wrong colour. Gold appears only where something was won or where a player is Legend.

**The Position Code Rule.** Positions are colour-coded on chips: GK amber, DF blue (`#7cbcff`), MF green and FW red, each on a 15–16% tint. Use these chips wherever a position is shown.

## Typography

**Display Font:** Archivo variable (weight 100–900, width 62–125%), bundled locally, with Segoe UI and system-ui as fallbacks only
**Body Font:** Archivo at normal width
**Label/Mono Font:** Archivo; numbers use tabular figures instead of a mono face

**Character:** One family with two voices. Heavy condensed caps sound like a broadcast graphic, and the normal-width text reads like a game menu. The width axis replaces a second typeface.

### Hierarchy
- **Display** (900, clamp(3rem, 5.4vw, 4.75rem), width 70%, line-height 0.9, uppercase): the season label on the Home stage. One per screen at most.
- **Ceremony** (900, 3.5rem, width 68–70%, uppercase): award titles on the Awards Night stage and the postseason countdown figure.
- **Headline** (900, 2.5625rem, width 72%, line-height 0.98, uppercase): club, player, coach, nation and competition hero names and the magazine cover headline. Drops to 2.125rem at 1100px and 1.75rem on phones.
- **Title** (800, 2.125rem, width 76%, uppercase): page heads. The final-result and modal hero names use the same size at 900 weight.
- **Section** (800, 1rem, width 82%, uppercase, 0.05em tracking, ink-secondary): section titles between panels.
- **Panel title** (700, 1rem, normal width, sentence case): panel heads. Story headlines step up to 1.1875–1.4375rem at 800, width 85%.
- **Number** (800–900, 1.1875–1.75rem, width 72–80%, tabular): stat values, points, scores, ratings, hero facts and ranking values. Large scores go to 64px at width 68%.
- **Body** (400, 0.875rem, line-height 1.45): running text. Long copy is capped at 68–72ch with line-height 1.55–1.6.
- **Data** (500–700, 0.8125rem, tabular): table cells, rows, buttons and controls.
- **Label** (700, 0.6875rem, 0.08–0.14em tracking, uppercase, ink-muted): table headers, stat labels, hero-fact terms, filter labels and the rail group heading. A label names the value or list directly beneath it.

### Named Rules
**The Condensed Number Rule.** Any figure the player is meant to compare (points, scores, ratings, trophy counts, fees) uses heavy weight, a condensed width and `font-variant-numeric: tabular-nums`. Body-width figures are only for secondary metadata.

**The Label-Names-Data Rule.** Small uppercase tracked labels sit above values, table columns and lists. They never sit above a heading as an eyebrow or kicker. A heading stands alone.

## Layout

The shell is a two-column grid: a sticky 224px rail and a fluid main column. The main column stacks a sticky 64px command bar (translucent `rgba(7,14,28,.88)` with a 14px backdrop blur), a 48px section strip of secondary destinations, and content capped at 1560px with 22px × 28px padding (48px at the bottom).

Inside content, the shared gap is 16px. Grids, stacks, two-column splits (1.55fr : 1fr wide-left) and the Home grid (1.5fr : 1fr) all use it. Directory and card grids use `auto-fill` with 220–340px minimums and tighter 6–10px gaps. Rows run 40–52px tall, with 42–46px typical for list rows and 52px for match and squad rows. Touch targets are at least 40px.

Responsive steps:
- **1439px:** content padding trims to 20px × 22px.
- **1279px:** the rail collapses to an 84px icon rail with stacked 10.5px labels, followed entities hide and tool-button labels hide.
- **1100px:** the command bar drops the section name, hero names step down and the Home stage stacks.
- **900px:** two-column layouts stack and the stat ribbon wraps to a 2-column grid.
- **759px:** the rail becomes an off-canvas 280px drawer with a scrim, a 5-item bottom navigation appears and the simulation bar spans its own row in the command bar.

### Named Rules
**The Ribbon-Not-Cards Rule.** Headline stats render as one bordered ribbon split into segments by hairlines, never as a grid of separate stat cards. Record grids and comparison metrics use the same idea: tiles separated by a 1px gap over a hairline background.

**The Hairline Row Rule.** Inside a panel, rows (matches, honours, trophies, rankings, transfers, title races, selectors) are separated by a 1px hairline bottom border and are never boxed. The last row has no border. Boxed rows (1px border, md radius, midnight-1 fill) are for standalone lists outside panels.

## Elevation & Depth

Depth comes mainly from tonal layering. Each surface step lifts by one navy tone, panels carry a top-to-bottom gradient (midnight-2 to midnight-1), and hairlines draw the edges. Shadows are reserved for two lift levels and for overlays. Hero stages add soft radial glows tinted by context: cyan for neutral stages, gold for international, final and Ballon d'Or stages, the club hue for club heroes, and the rarity colour for Legend, Generational, Epic and Rare player heroes.

### Shadow Vocabulary
- **Panel lift** (`box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 10px 24px -14px rgba(0,0,0,.7)`): every panel.
- **Stage lift** (`box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 22px 44px -22px rgba(0,0,0,.85)`): hero stages, the magazine cover, the system menu popover and toasts.
- **Overlay** (`box-shadow: 0 40px 80px -30px rgba(0,0,0,.9)`): search, club and showcase modals over a `rgba(2,5,12,.78)` backdrop with a 6px blur.
- **Primary press** (`box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 6px 14px -8px rgba(0,0,0,.8)`): cyan primary buttons only.
- **Focus glow** (`box-shadow: 0 0 0 3px rgba(63,208,255,.16)`): inputs and selects on focus, together with a cyan border.
- **Honour glow** (`0 14px 28px -12px` in rgba gold .5 or red .55; `0 20px 50px -20px` gold .7 on the winner podium): Legend and Generational portraits at large sizes and the Awards Night winner.

### Named Rules
**The Tone-First Rule.** Raise a surface by stepping its navy tone and adding a hairline. Add a shadow only for a hero stage, a floating layer or the primary action.

## Shapes

Corners are firm and moderate: 4px for chips, ranks, badges and tags, 7px for controls, rows and tiles, 10px for panels, ribbons and popovers, and 14px for hero stages, modals and the magazine cover (16px for the awards stage only). Badges and form squares go down to 3px. Club crests are circles. Flags keep 2–6px corners with a 1px light ring. Portraits are rounded squares (4–10px by size) inside a rarity-coloured inset frame. Dashed borders always mean something is not yet real: embargoed results, upcoming bracket ties, placeholder podium slots and empty states. The only fully round controls are follow chips (999px), crest placeholders and status dots.

## Components

### Buttons
Solid and tactile, with a quick 90ms press to scale(.97).
- **Shape:** gently rounded (7px), at least 40px tall; the compact variant is 32px.
- **Primary:** a cyan vertical gradient (`#5bd9ff` to signal-cyan-deep) with cyan-ink text at 700–800 weight and the primary-press shadow. Hover brightens to `#7ee3ff` to `#2cc4f5`. One per surface.
- **Secondary / Control:** midnight-3 fill, ink text and a strong hairline border. Hover steps to midnight-4.
- **Ghost:** transparent with a strong hairline border and ink-secondary text. Hover fills midnight-3.
- **Follow toggle:** a 36px outline button (strong hairline, white 3% fill, ink-secondary text). Hover brightens the text and border. The active state should signal selection, not honour.
- **Disabled:** 45% opacity, not-allowed cursor, no press transform.

### Simulation Control Bar (signature)
A 4px-padded tray (midnight-1, strong hairline, 10px radius) at the far right of the command bar. It holds quiet transparent sim buttons, standard midnight-3 sim buttons and exactly one cyan primary sim button. The primary action changes with the season phase. While a simulation runs, the tray switches to a busy state with a cyan spinner and a cyan progress readout. On phones it takes a full-width row and its buttons share the width equally.

### Chips
- **Status chip:** 22px tall, 4px radius, midnight-3 fill, ink-secondary uppercase label text at 0.6875rem / 700 / 0.04em. The gold variant (gold-glow fill and gold inset ring) marks champions and completed competitions. The embargo variant (transparent, amber text, amber inset ring plus a dashed outline) marks unplayed Showcase results.
- **Rarity badge:** 19px, 3px radius, 10px / 800 uppercase, colour from the rarity scale on a tint with an inset ring.
- **Rank:** a 26 × 24px tabular box. Champions are gold, qualification is blue (`#8fc3ff` on a 14% tint) and relegation is red.
- **Form squares:** 20px squares with 3px radius: W green, D grey (`#93a1b8`), L red.

### Cards / Containers
- **Corner Style:** 10px for panels, 7px for tiles.
- **Background:** panels use the midnight-2 to midnight-1 gradient. Tiles (club, nation, competition, region, quick-link and following cards) use a flat midnight-1 fill and hover to midnight-2 with the hover hairline.
- **Shadow Strategy:** panel lift (see Elevation & Depth).
- **Border:** 1px hairline.
- **Internal Padding:** 16px × 18px for panels, 12px × 14px for tiles.
- **Panel head:** sentence-case title on the left. The right side holds an underlined ink-secondary link that turns cyan on hover, or muted metadata.

### Inputs / Fields
- **Style:** 40px tall (50px for global search), midnight-0 well, strong hairline border, 7px radius, 0.8125rem / 500 text. Selects use a custom chevron SVG.
- **Hover:** the border steps to the hover hairline.
- **Focus:** cyan border plus the 3px focus glow. All other focusable elements get a 2px cyan outline offset by 2px.
- **Filter toolbar:** label-type captions above each field, and a hairline under the whole bar.

### Navigation
- **Rail:** 46px links, ink-secondary text at 600 weight with 20px icons. Hover adds a white 4% fill. The active link gets a cyan gradient wash, a 3px cyan edge marker and a cyan icon. Under the destinations sit followed entities (36px rows) and a footer with the save status.
- **Section strip and tab bar:** text tabs (0.8125rem or 0.875rem, 600 weight). The active tab is white with a cyan underline (2–3px) that slides in from scaleX(0) over 200ms.
- **Sub-tabs:** a segmented tray (midnight-1, 4px padding). The active segment is a solid cyan fill with cyan-ink text.
- **Breadcrumb trail:** 0.8125rem muted text with chevron SVG separators. Links turn cyan on hover.
- **Mobile:** a 5-column bottom bar on a 96% opaque navy with blur. The active item is cyan.

### Data Tables
Tables use sticky label-type headers on midnight-2 over a strong hairline, 8px × 10px cells and hairline row borders. Row hover is a white 2.5% wash. Trophy rows get a 2px gold inset edge. All figures are tabular.

### Match Row (broadcast scoreboard)
A five-column grid: competition meta, home team (right-aligned), a 34px score box, away team and the star player. The score box is midnight-0 with a strong inset ring and condensed 1.1875rem / 800 scores. The winning side is white at 700 weight and the losing side is ink-secondary at 500. Inside panels the row is hairline-separated. Standalone rows are boxed tiles. The compact and phone variants keep only the teams and the score.

### Hero Stage
Hero stages use a 14px radius, a strong hairline border and the stage lift. A navy diagonal gradient carries a context-tinted radial glow. A condensed Headline name sits beside a circular crest, emblem or portrait. Hero facts run in a row of hairline-divided cells, each a label over a 1.4375rem condensed number. Player heroes add a 96px rating orbit (cyan ring; gold for Legend, red for Generational). Club heroes add a 6px kit-colour band and a masked kit-colour field.

### Overlays
Search, club and showcase modals are midnight-1 panels with a 14px radius over a blurred backdrop. Each fades in over 200ms and pops in (6px rise, scale .985) over 220ms, only on the render that opens it. Toasts slide up over 240ms with a coloured status dot: cyan for info, green for success, red for error.

### Awards Podium
Three podium entries, 2nd, 1st and 3rd from left to right. The winner's column is taller and has a gold border, a gold radial glow and gold rank text. An entry rises once over 520ms when it is revealed, and the winner pulses a gold glow twice. Re-renders never replay these animations. Slots not yet revealed are dashed placeholders.

## Do's and Don'ts

### Do:
- **Do** reserve signal cyan for selection, focus, the primary action and progress, with cyan-ink text on cyan fills.
- **Do** reserve trophy gold for trophies, champions, honours and Legend rarity.
- **Do** keep the rarity convention: Common grey, Uncommon green, Rare blue, Epic purple, Legend gold, Generational red.
- **Do** separate rows inside panels with a 1px hairline (`rgba(150,180,230,.11)`) and leave the last row unbordered.
- **Do** set compared figures in heavy condensed Archivo with tabular figures.
- **Do** use the width axis for hierarchy: about 70% width for display, 72–80% for headlines and numbers, 100% for UI and body text.
- **Do** keep state motion at 140–220ms on `cubic-bezier(.2,.8,.2,1)`, press feedback at 90ms scale(.97), and respect `prefers-reduced-motion`.
- **Do** animate overlays and podium entries only on the render where they first appear.
- **Do** mark unplayed or embargoed content with dashed amber edges, never with real results.
- **Do** keep touch targets at least 40px high.

### Don't:
- **Don't** place an uppercase eyebrow or kicker label above a heading. Labels name values, columns and lists only.
- **Don't** box rows inside a panel with their own border, radius or fill.
- **Don't** build headline stats as a grid of separate equal-weight cards. Use the segmented ribbon.
- **Don't** use cyan or gold as decoration, category colour or a section label tint.
- **Don't** add a second cyan primary action to a surface that already has the simulation bar's primary.
- **Don't** use light surfaces. The system is dark only.
- **Don't** use glyph characters as icons. Use the inline SVG icon set.
- **Don't** replay entrance animations on re-render.
