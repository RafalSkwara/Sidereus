<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Tonight's night skies in the light theme, and the panorama's pan cue

- **Plan**: context/changes/ui-sky-light/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-05
- **Verdict**: APPROVED (after fixes)
- **Findings**: 0 critical, 3 warnings, 5 observations

Two independent read-only reviewers ran, one on plan drift and one on safety, quality and patterns. Plan drift found
every planned change matching (MATCH) and three harmless extras: the `lucide-react` import-guard entry, the chevron
focus hand-off, and reduced motion in the e2e test. Triage was done by the main session under the user's
"decide yourself" preference.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Island re-rendered on every scroll event

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (performance)
- **Location**: src/components/tonight/TonightSkyView.tsx (`readEdges`)
- **Detail**: `setEdges(next)` built a new object on every scroll event, so the whole panorama reconciled every frame of a swipe.
- **Fix**: Keep the previous state object unless an edge changed.
- **Decision**: FIXED

### F2 — Possible exhaustive-deps lint on `readEdges` in a layout effect

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightSkyView.tsx (centring effect)
- **Detail**: The reviewer suspected `react-hooks/exhaustive-deps` would flag the function.
- **Fix**: Run ESLint on the file.
- **Decision**: DISMISSED — `npx eslint src/components/tonight/TonightSkyView.tsx` is clean (exit 0).

### F3 — Untracked screenshot spec in tests/e2e

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: tests/e2e/zz-ui-sky-shots.spec.ts (untracked)
- **Detail**: The scratch capture spec would run in a local full Playwright run.
- **Fix**: Delete it once the evidence is captured.
- **Decision**: FIXED (deleted; never committed)

### F4 — `--faint` brighter than muted inside the scope

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture (tokens)
- **Location**: src/styles/global.css (night-sky block)
- **Detail**: `--faint` mixes muted with `--background`, which stays the light page's in the scope, so on navy it came out brighter than muted. Nothing uses it in the band yet.
- **Fix**: Re-derive `--faint` in the scope towards `--zenith`.
- **Decision**: FIXED

### F5 — `night:` also matches inside a theme-reset popover

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/styles/global.css (`@custom-variant night`)
- **Detail**: The settings popover sits inside the sky-flow strip; a future `night:` utility inside it would apply in the light theme.
- **Fix**: Exclude `[data-theme]` subtrees from the variant, or document.
- **Decision**: ACCEPTED — latent only (no `night:` inside popovers). CLAUDE.md already says popovers inside the scope carry `data-theme`.

### F6 — Focus dropped when both chevrons hide at once

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (accessibility)
- **Location**: src/components/tonight/TonightSkyView.tsx (`readEdges`)
- **Detail**: A resize to no overflow while a chevron has focus left focus on `<body>`.
- **Fix**: Focus the strip when both hide.
- **Decision**: FIXED. The same pass found, through the new F8 test, that the hand-off focused a still-hidden chevron. It now applies after the render (layout effect on `edges`).

### F7 — Chevron hit areas cover the strip's outer 48 px

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (UX)
- **Location**: src/components/tonight/TonightSkyView.tsx (chevrons)
- **Detail**: Markers under a chevron can't be tapped there, and a swipe starting on one doesn't scroll.
- **Fix**: None required.
- **Decision**: ACCEPTED — a 44 px target is the accessibility floor; it pans to the same place a swipe would.

### F8 — Focus hand-off not pinned

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/tonight-sky.spec.ts
- **Detail**: Only the left end was asserted; the hand-off is the riskiest logic.
- **Fix**: Assert that reaching the right end with the right chevron focused focuses the left one.
- **Decision**: FIXED. The test went red on the first fix and caught the hidden-target bug in F6.
