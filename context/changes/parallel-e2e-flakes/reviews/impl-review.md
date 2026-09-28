<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Parallel E2E Flakes

- **Plan**: context/changes/parallel-e2e-flakes/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-09-28
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Diff matches the plan: `helpers.ts` (stronger `waitForHydration`, deduped `signUp` comment), `landing-screenshot.spec.ts` (shared helper), `red-night-mode.spec.ts` (waits for the theme group). No product code touched. Evidence: stress `--repeat-each 4 --workers 5` 3/48 failed before, 48/48 ×2 after; reverting the helper reproduced the same failure shapes; serial 12/12; `astro check` 0 errors, lint 0 errors.

## Findings

### F1 — Relies on a React-internal DOM key

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: tests/e2e/helpers.ts (`waitForHydration`)
- **Detail**: `__reactProps$` is an internal name (stable since React 16). If a future React renames it, every wait times out loudly rather than passing silently; the doc comment explains the choice.
- **Fix**: None now; on a React major bump, re-check this helper first.
- **Decision**: ACCEPTED
