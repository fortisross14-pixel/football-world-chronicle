import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createWorld,
  simulateToSeasonEnd,
  isShowcaseMatchEmbargoed,
  isShowcaseCompetitionEmbargoed
} from '../src/engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.equal(pkg.version, '3.13.0');
assert(app.includes("const APP_VERSION = '3.13'"));
assert(app.includes('To End-of-Season Showcase'));
assert(app.includes('SHOWCASE EMBARGO'));
assert(app.includes('publicHistoryChampions'));
assert(app.includes('publicNewsRows'));
assert(css.includes('v3.13 showcase spoiler embargo'));

const state = createWorld(31301);
state.showcasePreferences = { UCL: 'semis', LIB: 'final' };
state.current.postseason.selections = { ...state.showcasePreferences };
simulateToSeasonEnd(state);

assert.equal(state.current.completed, true);
assert.equal(state.current.postseason.prepared, true);
const uclRows = state.current.postseason.showcaseMatches.filter((row) => row.competitionId === 'UCL');
assert.equal(uclRows.length, 5);
assert(uclRows.every((row) => row.resolved === false));
assert.equal(isShowcaseCompetitionEmbargoed(state, 'UCL'), true);

const first = uclRows[0];
const raw = (state.current.archivedKnockoutMatches || []).find((match) => match.id === first.matchId);
assert(raw, 'showcase source match should remain available in background archive');
assert.equal(isShowcaseMatchEmbargoed(state, raw), true, 'unrevealed showcase result must be embargoed');

first.resolved = true;
assert.equal(isShowcaseMatchEmbargoed(state, raw), false, 'a revealed match becomes public');
assert.equal(isShowcaseCompetitionEmbargoed(state, 'UCL'), true, 'competition stays embargoed while later showcase games remain unresolved');

for (const row of uclRows) row.resolved = true;
assert.equal(isShowcaseCompetitionEmbargoed(state, 'UCL'), false, 'competition unlocks only after every selected showcase match is resolved');

const finalRow = uclRows.find((row) => /^Final$/i.test(row.stage));
assert(finalRow, 'UCL final should be present');
const finalRaw = (state.current.archivedKnockoutMatches || []).find((match) => match.id === finalRow.matchId);
assert(finalRaw);
assert.equal(isShowcaseMatchEmbargoed(state, finalRaw), false);

console.log(JSON.stringify({
  version: pkg.version,
  uclShowcaseMatches: uclRows.length,
  backgroundResultPreserved: true,
  unrevealedResultEmbargoed: true,
  perMatchUnlock: true,
  competitionUnlockAfterFinal: true
}, null, 2));
