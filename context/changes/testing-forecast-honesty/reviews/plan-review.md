<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Test rollout Phase 1 — Forecast honesty

- **Plan**: `context/changes/testing-forecast-honesty/plan.md`
- **Date**: 2026-10-08
- **Phases**: 2
- **Reviewer**: Claude (Opus 5.5) with two Opus review agents (claim verification with a vitest probe in the scratchpad; feasibility and sequencing)
- **Findings**: 1 critical, 4 warnings, 3 observations
- **Overall**: NEEDS ATTENTION. F1 is critical. Strictly, the rubric reads REJECTED, but the premise and the phase structure hold, and F1 is fixed by a targeted plan edit plus one product decision. Re-planning would make the same edits.

## Verdicts

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Claim Accuracy | WARNING | F5 |
| Substance | PASS | |
| Feasibility | FAIL | F1 |
| Sequencing | WARNING | F2 |
| Architecture Fit | WARNING | F3 |
| Scope Discipline | PASS | |
| Verifiability | WARNING | F4 |
| Coverage | PASS (observations F6-F8) | |

## Verification commands tested

- `npx vitest run src/lib/forecast/degraded-forecast.test.ts`: resolves ("No test files found", which is expected before the file exists).
- `npx vitest run src/lib/forecast/service.test.ts`: resolves; 11 passed.
- `npm test` = `vitest run`, and `npm run lint` = `eslint .` (package.json:11, :16).
- `npx astro check`: resolves.
- `npm run lint`: **not run.** It runs out of memory while `.claude/worktrees/` (2.9 GB) exists (memory note, ui-sky-light change; the directory is present). See F4.

## Findings

### F1 — The metamorphic property is false, and it exposes a real honesty gap (a missing hour hides a humid hour, so marginal becomes go)

- **Severity**: CRITICAL
- **Impact**: HIGH — a product decision with a visible-copy and data-model blast radius
- **Dimension**: Feasibility
- **Location**: plan.md "Phase 1 › Changes Required › 1" (metamorphic property (a)); `src/lib/engine/verdict.ts:92-103`
- **Detail**: Property (a), "nulling any subset of hours never raises the verdict level", fails two ways against the shipped code. The claim agent confirmed both with a vitest probe.
  1. **Edge nulls: no-go to marginal (by design).** A cloudy no-go night whose trailing or leading series hours are nulled no longer spans the window. It becomes marginal / `no-weather-data` (`verdict.ts:36-45`, `:82-84`). This is the established rule "no data is never a weather no-go". The property must allow it.
  2. **Humidity: marginal to go (an honesty gap that is Risk #1 itself).**
     - The humidity cap takes the maximum over the **present** window hours only (`verdict.ts:92`, `:96`).
     - Probe: a 3 h run at 10 % cloud plus one 80 % cloud / 95 % humidity hour gives marginal / `humidity-cap`. Nulling that hour (cloud or humidity alone is enough, because the mapper drops the hour) gives **go**, headline "Clear".
     - A partial forecast therefore produces a confident go that the complete forecast would not, which is exactly the Risk #1 scenario.
     - A seeded generator with about 200 cases would hit this almost surely, so Phase 1 cannot go green as written.
- **Fix options**:
  - **Fix A ⭐ — A missing dark-window hour blocks go: a go-shaped night with any slot missing inside the dark window becomes marginal / `no-weather-data` ("No forecast").** Restate (a) as "if the nulled verdict is go, the original was go", plus "edge nulls only ever move to marginal / no-weather-data".
    - **Strength**: the change is only in `verdict.ts` (the go branch), reusing an existing reason kind and headline, so no copy, i18n, claim-rule or database change is needed. It matches PRD `prd.md:95-97`: "Where the forecast is uncertain, 'marginal' must be reachable rather than rounding up to 'go'".
    - **Tradeoff**: the wording is pessimistic. A night with one missing hour and a real clear run reads "No forecast — no forecast covers the dark window", not "Clear (…)". It also adds a verdict-rule change, so the NOT-doing item "Changing verdict thresholds, headlines or copy" must say "thresholds, headlines or copy unchanged; one coverage rule added".
    - **Confidence**: HIGH that it closes the gap, since humidity is the only path that lets a gap raise the result (cloud outside the run doesn't affect go). MED on the user-facing wording.
    - **Blind spot**: real Open-Meteo responses probably null trailing hours rather than single interior ones (research Open Question 4), so how often this shows is unknown, and is probably low.
  - **Fix B — The same cap, but with a new reason and headline**, "Clear (incomplete forecast)" / "Pogodnie (niepełna prognoza)".
    - **Strength**: the most honest wording; the clear run is still shown.
    - **Tradeoff**: a new reason kind in `types.ts`, `format.ts` mapping, EN+PL copy in three places each, the `claim.ts` and `labels.ts` match rule, the `/design` specimen, **and a migration**, because `sky_checks.headline` has a check constraint listing the allowed ids (`supabase/migrations/20261003120000_sky_checks.sql:28`), plus `db:types`. That roughly doubles Phase 1.
    - **Confidence**: HIGH.
    - **Blind spot**: the `record_sky_verdict` RPC's own validation was not read.
  - **Fix C — Accept and document.** Restrict the property (exclude humidity-cap to go) and file the gap as a separate change.
    - **Strength**: no production change in this phase.
    - **Tradeoff**: ships a known Risk #1 hole. The phase's own goal ("never a confident go on a partial forecast") stays false.
- **Decision**: FIXED (Fix A: a missing dark-window hour on a go-shaped night gives marginal / no-weather-data; the property was restated; verdict.test.ts:113-119 was updated as a requirement change)

### F2 — The keep-copy rule turns an existing service test red, and the plan doesn't list the update

- **Severity**: WARNING
- **Impact**: LOW — quick decision; the fix is obvious and narrow
- **Dimension**: Sequencing
- **Location**: plan.md "Phase 2 › Changes Required › 1-2"; `src/lib/forecast/service.test.ts:24`, `:40-61`
- **Detail**:
  - `liveResponse` is a 2-hour series on 2026-10-09 that ends before NOW.
  - In "refetches a stale entry and stores the result for seven days", the 60-minute-old stored entry has matching coordinates, so under the new rule the short 200 is degenerate. The service would return the stored copy as fallback with no put.
  - The test expects `fetchedAt = NOW`, one put and the exact stored hours, so Phase 2 goes red there with no planned step.
- **Fix**: add to Phase 2 change 1: "update `liveResponse` to a body covering the coverage interval, and adjust the stored-JSON assertion at `:53-61`. This is a requirement change (a short 200 is no longer a successful refresh), not an assertion bent to fit."
- **Decision**: FIXED

### F3 — The coverage predicate covers only the end side of night 1, and the stored copy is never checked

- **Severity**: WARNING
- **Impact**: MEDIUM — worth pausing; it defines the production rule
- **Dimension**: Architecture Fit
- **Location**: plan.md "Critical Implementation Details › Coverage rule boundary"; `service.ts:129`; `build.ts:631`; `src/lib/engine/sun.ts:101-105`
- **Detail**:
  - **(a) Start side.** While a night is in progress (before civil dawn), tonight's window started up to about 15 h before `now`. A 200 starting at `floor(now)` passes "first hour ≤ current hour", overwrites a good copy, and Tonight reads "No forecast". This is the `past_days=1` regression that `night-in-progress.test.ts` guards.
  - **(b) Stored copy unchecked.** "Usable" is still coordinates-only. A stored copy that is itself degenerate (an earlier degenerate 200 stored in the no-copy case) or expiring wins over a new degenerate 200. The page then says "Weather service unreachable — showing the forecast from N ago" (`en.ts:801`) while the service answered.
  - **(c) End side.** 24 h protects night 1 only. A 200 covering 24-72 h still overwrites a copy that covered nights 2-3 and the `night: "next"` copy. The probe's worst case for tonight's window end was 23.6 h after `now` (Kampala, −12°): about 24 min of margin. The justification is the civil-dawn rollover, not "noon to noon".
  - Plan and brief also disagree on the boundary: `floor_to_hour(now + 24 h)` versus `now + 24 h`.
- **Fix**: define a complete 200 as one whose present hours span from `floor_hour(now) − 24 h` to `floor_hour(now) + 96 h`. Every real response (`past_days=1`, `forecast_days=8`) does this, and it covers verdict nights 1-3 for both the tonight and the next-night builds. On an incomplete 200, serve the stored copy as fallback **only if the stored copy spans `floor_hour(now) − 24 h` to `floor_hour(now) + 24 h`**. Otherwise behave as today (return and store the new series). Fix the "noon to noon" justification and align plan and brief. Add tests for a night in progress with a 200 starting at today's 00:00Z, and for a degenerate stored copy plus a degenerate 200.
  - **Strength**: closes all three gaps with one predicate, which real responses always pass.
  - **Tradeoff**: two thresholds (96 h for the new series, 24 h for the stored copy) instead of one.
  - **Confidence**: HIGH on the arithmetic (night 3 ends ≤ 72 h after `now`; next-night night 3 ≤ 96 h).
  - **Blind spot**: providers that legitimately return fewer than 5 days would always be "incomplete". Open-Meteo returns 8.
- **Decision**: FIXED

### F4 — The lint line runs out of memory here, and the break checks and commit boundary are unspecified

- **Severity**: WARNING
- **Impact**: LOW — quick decision; the fix is obvious and narrow
- **Dimension**: Verifiability
- **Location**: plan.md Phase 1 and Phase 2 Success Criteria (1.2, 1.5, 2.2, 2.7)
- **Detail**:
  - `npm run lint` (`eslint .`) runs out of memory while `.claude/worktrees/` (2.9 GB, present) exists. `eslint.config.js:118` ignores only generated files.
  - The break checks don't say what to revert or which named cases must fail.
  - Nothing says red tests and their fix land in one commit only when green.
- **Fix**:
  - Replace the lint line with `npx eslint . --ignore-pattern '.claude/**'`.
  - Spell out each break check: stash the production change, run the named file, expect the named cases red, restore.
  - Add "commit per phase, only when green".
- **Decision**: FIXED

### F5 — Loader and test contracts need four corrections

- **Severity**: WARNING
- **Impact**: LOW — quick decision; the fix is obvious and narrow
- **Dimension**: Claim Accuracy
- **Location**: plan.md "Critical Implementation Details › Mocking", Phase 1 change 1, Phase 2 change 5
- **Detail**:
  1. **Mocking `@/lib/gear/store` loses real exports.** `build.ts:50` and `tonight-date.ts:2` import `toEngineSite` from that module. A stub-only factory makes the real `buildTonight` throw, and the "outage builds a view" case reads `tonight.failed`. The factory must spread `importOriginal()`.
  2. **`defer` is required** on `LoadTonightInput` (`load.ts:35-60`), and the test contract omits it.
  3. **`skyHeadline` is not an export.** It is a method of `createFormatter(locale)` (`format.ts:294`, returned at `:689`). Assert `view.headline.id` / `.text` in views, and use `createFormatter("en").skyHeadline(v)` in Phase 1. The all-missing-window case is level **no-go** with headline "No forecast" (`verdict.ts:114-115`, `format.ts:139`). That mapping is a formatter decision, not PRD text.
  4. **Lint trap.** Store methods are method shorthand, so `vi.mocked(siteStore.list)` trips `@typescript-eslint/unbound-method`.
- **Fix**: add these four points to the plan, and name the real field paths: `view.verdict.level`, `view.headline.id`, `view.forecastStatus.kind`/`.text`, `view.moonCard`, `view.darkWindow`, `view.ranking.entries`, `view.nights[1|2].level`/`.headline`.
- **Decision**: FIXED

### F6 — "Provider call rate is unchanged" is inaccurate

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; the fix is obvious and narrow
- **Dimension**: Coverage
- **Location**: plan.md "Performance Considerations"
- **Detail**: with a stored copy and a persistently degenerate provider, nothing is put, so every request refetches until the copy's 7-day TTL ends. That is the same as an outage today (fast 200s rather than 3 s timeouts). Today a degenerate 200 is stored and refetched hourly.
- **Fix**: reword it this way, and note a short negative cache as possible follow-up work.
- **Decision**: FIXED

### F7 — Documentation, copy and range boundary items are missing

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; the fix is obvious and narrow
- **Dimension**: Coverage
- **Location**: plan.md Phase 1 change 2, Phase 2 changes 2 and 6, Open Risks
- **Detail**:
  - the `ForecastResult.fallback` JSDoc ("True only when the fetch failed") and the `load.ts:137-138` comment become false;
  - the fallback status line will say "unreachable" for a reachable but degenerate provider (accepted; the copy is unchanged);
  - test-plan §6.6 expects a per-phase note;
  - test-plan §1-§5 are "frozen", so the §2 edit should be labelled the research-sanctioned backport;
  - the range bounds must be inclusive, with boundary cases 0 and 100 accepted, because exactly 100 is common;
  - the plan doesn't state the granularity trade-off (rejecting the whole response discards 8 days when nothing is stored).
- **Fix**: add these to Phase 1 change 2, Phase 2 changes 2 and 6, and Open Risks.
- **Decision**: FIXED

### F8 — The verdict rule change needs its NOT-doing line and the research oracle note kept in step

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; the fix is obvious and narrow
- **Dimension**: Coverage
- **Location**: plan.md "What We're NOT Doing", "Implementation Approach"
- **Detail**: whichever F1 option is chosen, the NOT-doing bullet "Changing verdict thresholds, headlines or copy" and the oracle paragraph must reflect it. The "No forecast" headline for a no-go with an all-missing window comes from `format.ts:139`, not the PRD table.
- **Fix**: update both after F1 is decided.
- **Decision**: FIXED

## Triage summary

- **Fixed**: F1 (Fix A), F2, F3, F4, F5, F6, F7, F8. All were applied to plan.md and plan-brief.md on 2026-10-08.
- **Rule**: none
- **Skipped**: none
- **Accepted**: none
