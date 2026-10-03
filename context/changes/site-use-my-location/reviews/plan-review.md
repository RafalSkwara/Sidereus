<!-- PLAN-REVIEW-REPORT -->
# Plan Review: "Use my location" on the Site Form

- **Plan**: context/changes/site-use-my-location/plan.md
- **Mode**: Deep
- **Date**: 2026-10-03
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
8/8 paths ✓, 4/4 symbols ✓ (`roundCoordinate`, `searchPlaces`, `gearConfig`, `onboardInMadrid`), brief↔plan ✓, Progress↔phases ✓ (5 + 8 rows). Blast radius: `geocode.ts` has one importer (the wizard); picker copy is referenced only by the three e2e files the plan lists; `seven-night-planner.spec.ts` also drives the site form (typed coordinates).

## Findings

### F1 — Undo vanishes after a hand-tweak following a pick

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Site form, Undo note contract
- **Detail**: The note showed only "while the source is device or place", and typing sets the source to manual, so a pick followed by a small hand edit hid the note although the coordinates still differed from the saved ones.
- **Fix**: Show the note while the values differ from the saved ones and the picker has been used since load (sticky flag reset by Undo); typing alone still shows nothing.
- **Decision**: FIXED

### F2 — New-site e2e can't save without Name and Bortle

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — E2E, "New site" test
- **Detail**: A device pick fills neither Name nor Bortle (no default), so the save step needs both; `seven-night-planner.spec.ts:49-59` already shows the pattern and guards the manual path.
- **Fix**: Name the `addSite` / `SITE_FORM` pattern in the test contract and list that spec as an existing guard.
- **Decision**: FIXED

### F3 — "Looks identical to before" needs a before screenshot

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Manual Verification 1.5
- **Detail**: Nothing told the implementer to capture the baseline before editing `OnboardingWizard.tsx`.
- **Fix**: Phase 1 overview now says to capture the baseline (EN, dark, 390 px) first.
- **Decision**: FIXED
