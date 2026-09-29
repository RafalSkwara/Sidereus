<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Nav Motion and Theme Cycle

- **Plan**: context/changes/nav-motion-theme-cycle/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-09-29
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

Diff matches the plan: `nextTheme` replaces the return-theme cookie machinery; the theme button shows the current theme and names current + next (EN/PL checked in all three themes); CSS-only cross-document view transitions with root swap off, named pill segment and tab indicator, per-tab icon names with a shared `tab-icon` class, press squeeze, reduced-motion off. Evidence: 635 unit tests, 0 type errors, lint 0 errors, build keeps `@view-transition`, e2e 14/14 with 5 workers, frozen mid-transition frames, WebKit navigation.

## Findings

### F1 — Label cross-fade while the pill slides

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/styles/global.css (`::view-transition-*(nav-current)`)
- **Detail**: The moving pill carries both labels, cross-fading ("Tonight" → "Log") during its 250 ms flight; frozen mid-flight the labels overlap. Standard for a shared-element morph; a plain amber pill without labels is a small tweak if the user prefers it.
- **Fix**: Left to the user's review (row 2.8).
- **Decision**: ACCEPTED (pending user preference)
