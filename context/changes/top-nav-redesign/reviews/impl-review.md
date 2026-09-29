<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Top Navigation Redesign

- **Plan**: context/changes/top-nav-redesign/plan.md
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

Diff matches the plan: `TopbarControls.tsx` replaces `PreferenceSwitches.tsx` (one island for the eye, theme and language; native popover; plain sign-out form), `Topbar.astro` one row with `sm:` inline links, `TabBar.astro` in all three shells (signed in, not on `/onboarding`), `viewport-fit=cover`, return-theme cookie with unit tests, specs updated plus `top-nav.spec.ts`. Evidence: 637 unit tests, 0 type errors, lint 0 errors, build OK, e2e 14/14 with 5 workers; 120 page views across 360/390/768/1280 × EN/PL × dark/light/red × signed in/out with header ≤ 64 px, no overflow, content clear of the tab bar; red pixel audit 22/22 with the sheet open; no-JS sign-out verified. Row 2.8 (user's before/after review) is pending by design; before/after are on the design board.

## Findings

### F1 — Two "Main" navigation landmarks in the DOM

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/Topbar.astro, src/components/TabBar.astro
- **Detail**: Both navs carry `aria-label={m.nav.primary}`, but they are shown at mutually exclusive widths (`hidden sm:flex` vs `sm:hidden`), so assistive technology only ever sees one.
- **Fix**: None needed.
- **Decision**: ACCEPTED
