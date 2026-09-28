<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Rolling 30-Day Session and Continue-After-Sign-In

- **Plan**: context/changes/account-reset-and-long-session/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
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

Automated: `npm test` 634 passed, `astro check` 0 errors, lint 0 errors (4 pre-existing warnings), build OK, smoke all steps (including exact `?next=`, safe/unsafe `next`, `Max-Age=2592000`), e2e 12/12 serial. Deliberate breaks: removing the origin checks turned 2 guard tests red; removing the removal guard turned the cookie test red; removing the `setAll` override made smoke fail with `max-age 34560000` (400 days). Manual rows: checked in a browser via temporary Playwright specs (deep link with note in EN/PL, wrong-password round trip, prefilled M31 form, unsafe `next` values; cookie expiry 30.000 days, removed on sign-out, dropped cookie → sign-in with note → `/tonight`); docs checked by grep.

Security: `next` reaches `Location` only through `safeNextPath`, which returns the normalised same-origin `pathname + search` and refuses other origins, `//`, `/\`, control characters, `/api` and `/auth`.

## Findings

### F1 — Unplanned helper change in tests/e2e/helpers.ts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: tests/e2e/helpers.ts
- **Detail**: `signUp` and `onboardInMadrid` now return the generated email so the new spec can sign back in; existing callers ignore the return value. Not listed in the plan's Changes Required.
- **Fix**: None needed; recorded in the phase 1 commit body.
- **Decision**: ACCEPTED (benign, needed by the planned spec)
