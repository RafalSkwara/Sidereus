<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: The user's UI adjustments (M-3 S-02)

- **Plan**: context/changes/ui-user-adjustments/plan.md
- **Scope**: Phase 5 of 6 (quick review, run in this session; the user asked for the recommended fixes applied without triage questions)
- **Reviewed phases**: 5
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

The review covered commit 411cd7d (16 files) against Phase 5's Changes Required. Every bullet matches:

- details one per line with no `sm:grid-cols-2`;
- the eyepiece sentence split into "Find with" and "Detail with";
- the constellation line, planet facts, Moon eyepieces and night-row lines each on their own line;
- more row and tile padding;
- the context line stacked on phones;
- the skeleton's generic rows follow the new rhythm.

Spacing lives in the shared parts (`TargetDetails`, `TILE_ROW_CLASS`), and hash anchors are unchanged.

Gates on HEAD after the fixes: `astro check` 0 errors; `npm test` 1181 passed; lint 0 errors (3 old warnings); full e2e 44 passed, 3 skipped.

## Findings

### F1 — The dashboard skeleton was shorter than the tiles it stands for

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightSkeleton.astro:70-105
- **Detail**: Tile heights were measured with the island blocked and then loaded (EN). The targets tile was 189 px against 221 px at 390 (no bar for its caption). The nights tile was 113 against 213 at 390, and 153 against 233 at 1280 (no room for the verdict marks, the day labels or the caption). The content under the tiles jumped when the island swapped in. CLAUDE.md asks that the skeleton never jump.
- **Fix**: Add the targets caption bar, and per-night columns with the mark's room and a day bar, plus the caption (two lines below `sm`).
- **Decision**: FIXED: measured identical after the fix (EN 390: 221/89/89/117/213; EN 1280: 229/97/97/125/233). PL at 390 still differs where its longer copy wraps (targets caption, Moon line), which depends on content and is accepted.

### F2 — Two header comments wrapped past the line length

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightPageSkeleton.astro:5, src/components/tonight/TonightPageSky.astro:4-8
- **Detail**: The Phase 5 edits left one comment line well over 120 characters and a ragged wrap. Prettier does not rewrap comments.
- **Fix**: Rewrap both to the file's width.
- **Decision**: FIXED

### F3 — `first-letter:uppercase` capitalises catalogue copy that reads on mid-sentence

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/ObjectDetails.astro:33, MoonCard.astro:83, NightStrip.astro:71
- **Detail**: "detail with …" and the night's reason were written to follow another clause. On their own lines, CSS capitalises the first letter. This renders correctly in EN and PL, and screen readers are unaffected.
- **Fix**: None. Separate capitalised keys would duplicate copy for a purely visual change.
- **Decision**: ACCEPTED

### F4 — PL tiles at 390 px wrap more than the skeleton reserves

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightTiles.astro
- **Detail**: In PL at 390 px the targets tile is 249 px (skeleton 221) and the Moon tile is 113 px (89), because longer copy wraps onto a second line. This depends on the content and the locale, and it sits below the tested first screen.
- **Fix**: None.
- **Decision**: ACCEPTED
