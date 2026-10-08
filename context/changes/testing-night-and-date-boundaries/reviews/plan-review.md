<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Test rollout Phase 2 — night and date boundaries

- **Plan**: `context/changes/testing-night-and-date-boundaries/plan.md` (commit 056e2bd)
- **Date**: 2026-10-08
- **Reviewers**: two Opus agents (claim verification; feasibility, sequencing and architecture), plus a check that every automated command resolves
- **Findings**: 0 critical, 5 warnings, 5 observations
- **Overall**: NEEDS ATTENTION, all 10 findings FIXED in plan.md and plan-brief.md

## Verdicts

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Claim Accuracy | FAIL | F1 |
| Substance | PASS | |
| Feasibility | PASS | F9, F10 (observations) |
| Sequencing | PASS | |
| Architecture Fit | WARNING | F4, F10 |
| Scope Discipline | PASS | |
| Verifiability | WARNING | F2, F3, F6, F7 |
| Coverage | WARNING | F5, F8 |

**Evidence the plan's oracles hold:**

- USNO was re-queried for all 5 nights and every value matches.
- Engine `end` agrees with USNO to within 0.5 min.
- All 11 wall-clock traps, the spans and the Session plan precondition hold (11 rows: 5 before 22:00Z, 6 after, 2 after 01:00Z).
- `validUntil` matches USNO to within 0.5 min, and the view at `validUntil` minus/plus 1 s gives the old/new date.
- In-process `process.env.TZ` switching works in Vitest 5.0.1 (forks pool, one process per file).
- The guard grep finds 0 hits on current `src/`.
- All automated commands resolve.

## Findings

### F1 — Phase 2 log links don't live on view entries

- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Claim Accuracy (WRONG)
- **Location**: plan.md "Phase 2 › 3. Tonight consumers suite (a)"
- **Detail**: `TonightEntry` and `TonightPlanetEntry` have no link field. Log links come from `logHref(view, target, from?)` (`src/lib/tonight/load.ts:186-197`), which copies `night` from `view.date`. A Session plan row's `href` is a focused-page link, not a log link, so the fallback is wrong. Also, `uniformForecast` covers only 48 h and `result()` stamps `fetchedAt` relative to `NOW` (2026-10-10), so the Los Angeles + 5 min case and the strip run past the forecast.
- **Fix**: Assert `logHref(view, key)` from `load.ts` (as `build.test.ts:36` does) carries `night=<view.date>`, and drop the fallback. Build the forecast with `hourlyForecast` over about 120 h from the case's evening, with `fetchedAt` = the case's `now`. Lift `hourlyForecast` together with `uniformForecast`/`result`/`utcWallTime`.
- **Decision**: FIXED (user chose "apply all", 2026-10-08)

### F2 — Nothing proves the runner-zone switch happened

- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Verifiability
- **Location**: plan.md "Critical Implementation Details", break check 1.3
- **Detail**: Code in a `describe` body runs at collection under the original zone, and a default-zone `Intl.DateTimeFormat` created before the switch keeps the old zone (agent probe). The `getHours` break check run on the Warsaw dev machine would turn red even if the switch silently did nothing.
- **Fix**:
  - Every call under test goes in `it`/`beforeAll` after the switch.
  - Each zone block first asserts the switch took effect (`Intl.DateTimeFormat().resolvedOptions().timeZone` plus one `getHours()` value; accept `Asia/Calcutta` for Kolkata).
  - Run the `getHours` break check as `TZ=UTC npx vitest run …`.
- **Decision**: FIXED (user chose "apply all", 2026-10-08)

### F3 — "Record outcomes in Progress" breaks the Progress format

- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Verifiability
- **Location**: plan.md break checks in Phases 1–3
- **Detail**: Progress rows have fixed titles, and only `[x]` plus a sha may be added.
- **Fix**: Record break-check outcomes in a "Break-check log" note at the end of each Phase block, and in the phase commit message.
- **Decision**: FIXED (user chose "apply all", 2026-10-08)

### F4 — `maxNight` repeats `latestNightBound`; test (c) overlaps `store.test.ts`

- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Architecture Fit
- **Location**: plan.md "Phase 2 › 1 and 2(c)"
- **Detail**: `latestNightBound` (`store.ts:85-93`) is the same rule, already used by `src/pages/log/[id].astro:55`. It differs only for an empty list, and with no site the page shows "needs gear" instead of the form. `store.test.ts:11-18` already pins the multi-site max.
- **Fix**:
  - `logFormNights` delegates `maxNight` to `latestNightBound` (keeping `""` for an empty list, so behaviour stays byte-for-byte);
  - trim (c) to the new parts: the Los Angeles default and the empty list;
  - add a "server-only; islands never import" line to the doc comment.
- **Decision**: FIXED (user chose "apply all", 2026-10-08)

### F5 — The CET label branch could go untested

- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Coverage
- **Location**: plan.md "Phase 2 › 3(b)"
- **Detail**: The precondition only asks for rows on both sides of 22:00Z. Without a row at or after 01:00Z, the UTC+1 branch is vacuous.
- **Fix**: Also require at least one row with `bestAt` ≥ 2026-10-25T01:00Z. Today Jupiter and Mars sit at 04:43:30Z.
- **Decision**: FIXED (user chose "apply all", 2026-10-08)

### F6 — The −18 break check edits the test input, not the code

- **Severity**: OBSERVATION · **Impact**: LOW · **Dimension**: Verifiability
- **Location**: plan.md "Phase 1 › Success Criteria" (break check)
- **Fix**: Temporarily set `TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG` to −12 in `parameters.ts`. That must turn engine (b)/(c) red, and Tonight (c) red too, which is the "retuned one constant" case.
- **Decision**: FIXED (user chose "apply all", 2026-10-08)

### F7 — 3.5 check can't fail; 2.2 has an ellipsis

- **Severity**: OBSERVATION · **Impact**: LOW · **Dimension**: Verifiability
- **Location**: plan.md Phase 3 criteria, Progress 2.2 and 3.5
- **Fix**: Use `! sed -n '/^### 6.2/,/^### 6.3/p' context/foundation/test-plan.md | grep -q TBD && grep -q '\*\*Phase 2 —' context/foundation/test-plan.md`, and spell out the file list in 2.2.
- **Decision**: FIXED (user chose "apply all", 2026-10-08)

### F8 — Guard gaps: zone-less ISO strings; `design.astro` multi-argument case

- **Severity**: OBSERVATION · **Impact**: LOW · **Dimension**: Coverage
- **Location**: plan.md "Phase 3 › 1"
- **Detail**: `new Date("2026-10-24T20:00")` and `Date.parse("…T…")` without `Z` or an offset parse in the runner's zone. `design.astro:517` has `new Date(Date.UTC(2026, 9, 10) + …)`.
- **Fix**:
  - Forbid date-time string literals passed to `new Date(`/`Date.parse(` without `Z` or `±hh:mm` (date-only strings parse as UTC, so allow them).
  - Add the `design.astro` form to the allowed snippets.
  - State that `test-fixtures.ts`/`test-helpers.ts` are scanned on purpose.
- **Decision**: FIXED (user chose "apply all", 2026-10-08)

### F9 — Site records and the site count

- **Severity**: OBSERVATION · **Impact**: LOW · **Dimension**: Feasibility
- **Location**: plan.md "Phase 1 › 1" and Desired End State
- **Fix**:
  - USNO entries carry engine `Site`s with `elevationM: 0` (USNO's sea-level basis).
  - Tonight and log tests build `SiteRecord`s from them with a `bortle`.
  - Correct "5 sites" to "4 sites across 5 edge nights" in the plan and brief.
- **Decision**: FIXED (user chose "apply all", 2026-10-08)

### F10 — Runner-zone helper in the engine fixtures

- **Severity**: OBSERVATION · **Impact**: LOW · **Dimension**: Architecture Fit
- **Location**: plan.md "Phase 1 › 1"
- **Detail**: `usno.ts` fits the fixtures folder. The zone helper is test machinery, but importing engine fixtures from other tests has precedent (`build.test.ts:22`, `targets/index.test.ts:11`).
- **Fix**: Keep it there and describe it in the fixtures README.
- **Decision**: FIXED (user chose "apply all", 2026-10-08)
