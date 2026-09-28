<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Red Night Mode

- **Plan**: context/changes/red-night-mode/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-09-28
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Diff vs plan: 11/11 planned files changed, no unplanned source files. Automated criteria rerun: `npm test` 620 passed, `astro check` 0 errors, `npm run lint` 0 errors (4 pre-existing warnings), `npm run build` OK, e2e 11/11 serial. Manual rows carry evidence in commit 0436e82 (pixel audit of 41 red captures + WebKit landing, overflow scan at 360/390, dark/light diff below the top bar).

## Findings

### F1 — Top-bar wrap changes the phone layout in every theme

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/components/PreferenceSwitches.tsx:111
- **Detail**: Not in the plan. The third segment made phone pages 8 px wider than the viewport; the fix lets the preference groups wrap, so on phones EN/PL sits under the theme group in dark and light too, and the top bar is one row taller.
- **Fix A ⭐ Recommended**: Keep the wrap; record it in change.md Notes.
  - Strength: Keeps 44 px tap targets; zero overflow in 60 checks at 360/390.
  - Tradeoff: Top bar one row taller on phones.
  - Confidence: HIGH — measured.
  - Blind spot: Visual preference is the user's call.
- **Fix B**: Single row with 40 px segments below `sm`.
  - Strength: Top bar height unchanged.
  - Tradeoff: Tap targets below the 44 px guideline; outdoors with cold fingers.
  - Confidence: MEDIUM — 5 × 4 px saved may still not fit PL signed-in at 360.
  - Blind spot: Not measured.
- **Decision**: FIXED via Fix A (user chose to keep the wrap; recorded in change.md)

### F2 — Two adaptations recorded only in a commit message

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/styles/global.css (red native-input rules)
- **Detail**: The plan filtered the date-picker icon and number spinners with `url(#red-only)`; the filter does not resolve inside the browser's shadow DOM, so the code hides them instead, and the focused date segment loses its highlight. Documented only in commit 0436e82.
- **Fix**: Record both adaptations in change.md Notes.
- **Decision**: FIXED (recorded in change.md Implementation notes)

### F3 — Two stale comments

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/layouts/Layout.astro:40, src/styles/global.css (red edge-surface comment)
- **Detail**: Layout says the filter is "for images and browser-drawn input icons" (images only now); global.css says the focused date segment is "re-coloured from tokens" (it is cleared).
- **Fix**: Correct both comments.
- **Decision**: FIXED (both comments corrected)

### F4 — Parallel e2e relies on CI's retry

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A (tests/e2e, issue #45)
- **Detail**: Locally 5 specs time out with 5 workers and pass serially; CI runs in parallel with `retries: 1`.
- **Fix**: None in this change; the PR's CI run is the check, #45 tracks the flake.
- **Decision**: ACCEPTED (the PR's CI run is the check; tracked in #45)
