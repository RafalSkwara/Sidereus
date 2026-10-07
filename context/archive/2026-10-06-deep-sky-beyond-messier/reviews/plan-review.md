<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Deep sky beyond Messier (S-03)

- **Plan**: context/changes/deep-sky-beyond-messier/plan.md
- **Mode**: Deep
- **Date**: 2026-10-06
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 0 critical, 5 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

13/13 paths ✓, 3/3 symbols ✓ (`MOONLIGHT_EXEMPT_IDS`, `LOCAL_BUDGET_MS`, `EXPECTED_COUNT`), brief↔plan ✓. Also checked: `addendum.csv` has an `Identifiers` column, and no Caldwell row has an `M` value. Verification ran on one Opus agent; the decisive claims were re-checked by hand.

## Findings

### F1 — Existing tests the mixed ranking will break are not in the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phases 2, 3, 4 — Tests
- **Detail**: These assertions are not in the plan:
  - `build.test.ts:213` (expects a Messier-only top 5)
  - `build.test.ts:1386-1388` (expects label === key)
  - `target-search.test.ts:20-23,58` (118 options, order) and `:83-84` (expects exactly ["M31"])
  - `determinism.test.ts:175` (compares `messier`)
  - `observation-log.spec.ts:32,38,55,64`
  - `tonight-targets.spec.ts:79`

  The e2e specs use the real clock, so they would fail intermittently by season.
- **Fix**: List each one under its phase's Changes Required.
- **Decision**: FIXED

### F2 — The calibration test describes inputs that don't exist

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §3
- **Detail**: `RankInput` has no cloud input and computes the Moon internally. Expectation (a) needs `limit: Infinity`. The fixtures are private to `ranking.test.ts:15-62`. Checked: all 4 nights have a −15° window and are near new Moon.
- **Fix**: Astronomical inputs only, `limit: Infinity`, and move the fixtures into `engine/fixtures/index.ts`.
- **Decision**: FIXED

### F3 — A well-formed but unknown key reaches an unsaveable form

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 §4
- **Detail**: `formRedirect` carries `?object=NGC1` back, and `log/new.astro` renders a form for it that can never save.
- **Fix**: `isKnownTarget` in `labels.ts`, used by `new.astro` (not found) and by `formRedirect` (drops the target).
- **Decision**: FIXED

### F4 — Phase 5's manual check can't run as written

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 — Manual Verification (5.5)
- **Detail**: `seed.sql` is empty, and `db reset` recreates the database.
- **Fix**: Create entries on the Phase 4 schema, run `npx supabase migration up`, then check them. The Progress title was kept, and an inline note was added in the phase block.
- **Decision**: FIXED

### F5 — NGC number search leaves the tie undecided

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 §3
- **Detail**: "ngc 224" also prefix-matches NGC 2244 (C 50).
- **Fix**: Exact number first, then prefix matches ascending; the test expects M31 first.
- **Decision**: FIXED

### F6 — localCommonName phasing is incoherent

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §3
- **Detail**: The signature change breaks all 8 callers in Phase 1.
- **Fix**: Phase 1 migrates all 8 callers (listed in the plan).
- **Decision**: FIXED

### F7 — Plan text errors and missing touchpoints

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phases 3, 4
- **Detail**: `home.kicker` should be `landing.kicker`, and the PL placeholder is at `pl.ts:865`. Missing touchpoints: `ObjectDetails.astro:24` `srSuffix`, and stale comments in `build.ts:707`, `en.ts:931` and the target-search/options headers.
- **Fix**: Corrected and added.
- **Decision**: FIXED
