<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Session plan timeline

- **Plan**: context/changes/session-plan-timeline/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 4 observations
- **Reviewers**: drift and safety & patterns, both Opus (high effort)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — In red mode the dark window and the Moon band barely show

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/styles/global.css:173–175; src/components/tonight/SessionTimeline.astro:57–59, 104–106
- **Detail**: Red plan-night on plan-twilight is 1.13:1 (dark 1.46, light 1.44); the Moon band (muted-foreground) on red twilight is 2.84:1, under the 3:1 floor and untested. The tile's mini timeline has no text, so in red it is a flat track with dots.
- **Fix**: 1 px heading-ink edge marks at the dark window's start and end; Moon band in heading ink; a contrast row for the band over both plan tokens (floor 3, every theme).
  - Strength: Readable in red by shape, not luminance.
  - Tradeoff: Two thin marks per track; a louder band in dark/light.
  - Confidence: HIGH — contrast recomputed.
  - Blind spot: Needs fresh screenshots.
- **Decision**: FIXED — heading-ink marks at the dark window edges (axis + mini) and a heading-ink Moon band; covered by the existing heading/plan-token contrast row; red screenshots checked

### F2 — Plan rows are built on every request, outside any try

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/build.ts:663–677 (also 754–765, 843–856)
- **Detail**: Rows are formatted even without withSessionPlan (Targets formats ~100 and discards them); the object map is unguarded, so a throw becomes a whole-view tonightError.
- **Fix**: Keep the raw entries in locals; map them inside the `if (options.withSessionPlan) try {}` block.
- **Decision**: FIXED — raw entries kept in locals; all row mapping inside the withSessionPlan try

### F3 — "First up" ignores the time of day

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/tonight/TonightTiles.astro:50–52, 135–137
- **Detail**: rows[0] is the night's earliest best time; at 01:00 the tile still names a target already gone.
- **Fix A ⭐ Recommended**: Server picks the first row whose window has not ended (buildTonight's now), falling back to rows[0] before sunset; "Next: …" once the night has started.
  - Strength: True all night.
  - Tradeoff: One more field and key.
  - Confidence: HIGH.
  - Blind spot: A night with every window over shows the empty line.
- **Fix B**: Keep rows[0], reword to "First of the night: …".
  - Strength: No logic.
  - Tradeoff: Stale after dusk.
  - Confidence: HIGH.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — nextUp (first/next/done) from buildTonight's now; tile reads "First up" / "Next" / planDone

### F4 — Moon rise/set times are up to 10 minutes late and differ between pages

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/build.ts:465–487, 996–1000
- **Detail**: Crossings snap to a 10-minute track whose grid starts at sunset for the plan and at the dark/civil window for the Moon card.
- **Fix**: One shared helper refining each crossing (bisect between bracketing samples), used by both.
  - Strength: Exact and identical on both pages.
  - Tradeoff: Touches the Moon card's code.
  - Confidence: MED.
  - Blind spot: Moon tests may pin current times.
- **Decision**: FIXED — refineMoonCrossing bisects real crossings to 30 s via moonState, shared by the Moon card and the plan (Moon page and plan both show moonrise 03:29); two Moon-card tests now assert the refined time lies between its bracketing samples

### F5 — The buildTonight wiring has no tests

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/tonight/build.ts:993–1050
- **Detail**: Local-hour ticks (:30 zone, DST night), the Moon-text fix, polar sunset/sunrise null and the option-off case are unpinned.
- **Fix**: 3–4 modest build tests (Madrid fall-back night, Asia/Kolkata, polar site, option off).
- **Decision**: FIXED — 4 build tests: option off + nextUp, Asia/Kolkata ticks, Madrid fall-back night (two 02:00 ticks), 87°N null sunset/sunrise

### F6 — Unused fields and an overlong comment

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/tonight/build.ts (TonightSessionPlan.hours, .axis); src/components/tonight/TonightContent.astro:5
- **Fix**: Drop hours and axis from TonightSessionPlan; rewrap the comment.
- **Decision**: FIXED — hours/axis dropped from TonightSessionPlan; TonightContent comment rewrapped
