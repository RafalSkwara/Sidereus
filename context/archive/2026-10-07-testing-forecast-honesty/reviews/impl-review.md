<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test rollout Phase 1 — Forecast honesty

- **Plan**: context/changes/testing-forecast-honesty/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-08
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria

All automated rows were re-run on 2026-10-08 and pass:

| Row | Check | Result |
|-----|-------|--------|
| 1.1 | degraded-forecast suite | 18/18 |
| 2.1 | service suite | 21/21 |
| 2.3 | forecast-honesty suite | 8/8 |
| 2.4 | loader suite | 2/2 |
| 1.4, 2.5 | `npm test` | 78 files, 874 passed |
| 1.5, 2.6 | `astro check` | 0 errors |
| 1.6, 2.7 | eslint | 0 errors (3 warnings that predate this change) |

The break checks (1.2, 1.3, 2.2) were run during implementation: each went red on the broken code and the file was restored. Manual row 2.8 was checked with evidence: the §2 wording matches the PRD headline table, and every file and helper §6.1 names exists.

Plan drift: none. Every planned change is MATCH. The extras are harmless: a humidity −1 case, a non-vacuity check on the property, 300 property cases instead of about 200, and a stronger replacement for property (b). Nothing on the NOT-doing list was done.

## Findings

### F1 — The gap rule reuses `no-weather-data`, so one missing hour reads as "no forecast reaches this night"

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/lib/engine/verdict.ts:103-105; consumers at src/lib/engine/outlook.ts:50, :74; src/lib/tonight/format.ts:136, :329, :585; src/lib/tonight/build.ts:800-803
- **Detail**: `no-weather-data` used to mean "the series doesn't reach this night". Its consumers rely on that meaning:
  1. **"Next clearer night" walks** (`nextNightInOutlook`, `nextNightNotNoGo`). Both stop at the first `no-weather-data` night. Take a cloudy tonight followed by a go-shaped night 2 with one missing dark hour. The card now says "The forecast doesn't reach past tonight, so there is no next night to suggest yet" (`en.ts:808`), which is false. A *worse* night 2 (marginal-shaped, same gap) would still be suggested.
  2. **Card and strip wording.** A night with 9 of its 10 dark hours present reads "No forecast — no weather data", above "Forecast updated 12 min ago". On a fallback copy it reads "No forecast — no weather data" where it used to read "Clear (old forecast)".
  3. **Planets line.** A clear night whose civil window lacks one twilight hour now shows "For planets: no forecast — no weather data" under a "Clear" card. A no-go night with clear twilight plus a gap loses its "clear 19:00–20:00" explanation.
  
  Root cause: the plan review assumed a new reason kind would need a migration. Only a new **headline id** does, because `sky_checks.headline` has a check constraint. A new reason kind can map to the existing `noForecast` headline id. No Tonight-level test has an interior null (F2), so the suite didn't catch this.
- **Fix A ⭐ Recommended**: Add a reason kind `{ kind: "missing-hours" }` (level marginal) for the gap rule, and keep `no-weather-data` for the span and null cases.
  - `skyHeadlineId` maps it to `noForecast`, so the headline stays "No forecast" / "Brak prognozy", with no migration and an unchanged sky-check tally.
  - It gets its own reason text, e.g. EN "an hour of the dark window is missing from the forecast", PL "w prognozie brakuje godziny ciemnego okna".
  - It gets a planet phrase that keeps the clear hours.
  - The outlook walks treat it like a no-go: judged, not suggested, walk continues. The text then reads "No clear night in the forecast through …" instead of the false "doesn't reach".
  - Add Tonight-level tests (F2).
  - Strength: fixes all three consumers at the source, and the reason stays precise for any future consumer.
  - Tradeoff: a new reason kind across the engine types, `format.ts` (3 switches), EN+PL copy, and the `/design` specimen if it lists reasons. Also adds new user-visible copy.
  - Confidence: HIGH. The switches are exhaustive (TypeScript will list every site), and the headline-id path is unchanged.
  - Blind spot: whether the strip or `/design` enumerate reason kinds elsewhere; the compiler will show it.
- **Fix B**: Keep `no-weather-data` and only patch the two outlook walks to continue past a night that has present hours. Accept the "No forecast — no weather data" wording and the planets line.
  - Strength: smallest change; no new copy.
  - Tradeoff: leaves two misleading wordings in place (2 and 3), and the walk needs a heuristic to tell a gap from a missing series.
  - Confidence: MED.
  - Blind spot: the heuristic would duplicate span logic outside `verdict.ts`.
- **Decision**: FIXED (Fix A): new `missing-hours` reason (marginal) mapped to the `noForecast` headline id; EN+PL reason and planet phrases; both outlook walks judge it like a no-go and continue; break check: reverting to `no-weather-data` turns 5 new tests red. Open wording note: the planets line reads "For planets: no forecast — an hour between dusk and dawn is missing from the forecast" (skyInline follows the headline id).

### F2 — No Tonight-level test has a null inside a dark window

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/tonight/forecast-honesty.test.ts
- **Detail**: The integration suite degrades only whole bodies: outage, aged copy, empty 200, trailing nulls. None has an interior null, so F1's effects (headline, `verdictText`, `explanation.nextText`, `solarSystem.weatherText`) are untested.
- **Fix**: Add three cases:
  - one null inside night 1's dark window → headline, reason text and the planets line;
  - tonight cloudy with one null inside night 2's dark window → `explanation.nextText` does not say "doesn't reach";
  - one null in a twilight hour of a clear night → the planets line.
- **Decision**: FIXED: 3 Tonight-level interior-null cases (night 1 gap, night 2 gap behind a cloudy tonight, twilight-only gap at 16:00Z).

### F3 — The service time bounds and the keep-copy side effects are not pinned

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/forecast/service.test.ts:216-260; src/lib/forecast/service.ts:39-52, :97-108
- **Detail**:
  - Shortening `FORECAST_COMPLETE_AFTER_MS` from 96 h to about 30 h leaves the suite green.
  - Nothing asserts that `defer` is not called on the keep-copy path.
  - Nothing covers an incomplete 200 with a stored copy for other coordinates.
  - `isCompleteForecast` and `coversStoredWindow` are exported but imported nowhere.
- **Fix**: Add the following, and un-export the two predicates:
  - a 200 ending at about +60 h, with a usable copy, that keeps the copy;
  - a `defer` spy that is never called on the keep-copy path;
  - an incomplete 200 with a stored copy for other coordinates, which is returned and stored.
- **Decision**: FIXED: +60 h keep-copy case (red with the bound at 30 h), defer spy never called, other-coordinates case; predicates un-exported.

### F4 — `verdict.test.ts:113-115` now passes for the wrong reason

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/engine/verdict.test.ts:113-115
- **Detail**: It asserts only `level: "marginal"`. If missing hours were counted as clear, the gap rule would still give marginal, so the test no longer guards the run break.
- **Fix**: Assert the full verdict with `toEqual` (marginal, clear-run, the 1 h run and its cloud).
- **Decision**: FIXED: full toEqual (marginal, clear-run, 1 h, 20 %).

### F5 — Vacuous mock assertion and possible mock leak in the loader test

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/tonight/load.test.ts:121
- **Detail**: `expect(mocks.buildTonight).toHaveBeenCalled()` is always true across tests, because the mocks are never cleared and the config has no `clearMocks`. A `mockImplementationOnce` left unused by a failed test would also leak into the next test.
- **Fix**: Add `mocks.buildTonight.mockClear()` (and a reset of any once-implementations) in `beforeEach`, and assert `toHaveBeenCalledTimes(1)`.
- **Decision**: FIXED: async beforeEach resets the mock to the real build; toHaveBeenCalledTimes(1) in both tests.

### F6 — A test comment wrongly places NOW before night 1's dark window

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/tonight/forecast-honesty.test.ts:43
- **Detail**: NOW is 18:00Z. Warsaw's bortle-6 window starts about 17:25Z, so NOW is inside the window, not before it. No expectation depends on this.
- **Fix**: Correct the comment.
- **Decision**: FIXED: corrected wording, moved into test-fixtures.ts.

### F7 — The Warsaw, telescope and eyepiece fixtures are copied in three test files

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/tonight/build.test.ts:78-126; forecast-honesty.test.ts:17-40; load.test.ts:48-71
- **Detail**: The three copies will drift.
- **Fix**: Move them to a test-only `src/lib/tonight/test-fixtures.ts` (like `forecast/test-helpers.ts`) and import it in all three.
- **Decision**: FIXED: src/lib/tonight/test-fixtures.ts (WARSAW, TELESCOPE, EYEPIECES, NOW) imported by build, forecast-honesty and load tests.

## Accepted as planned (not findings)

- **Refetch rate:** with a usable copy and a provider that keeps sending degenerate responses, every island refetches (dashboard, focused pages, the `?night=next` copy). This matches the plan's Performance note ("as in an outage"); a negative cache is follow-up work.
- **Mapper granularity:** a single out-of-range value invalidates the whole 216 h body. The plan records this as a trade-off.
- **Sky checks:** a gap night records `noForecast`, which is uncheckable, so it is never asked or counted (`record.ts:22`, `claim.ts:27`, `store.ts:81`). This is consistent with the claim rules, and Fix A keeps it.

## Triage summary

- **Fixed**: F1 (Fix A), F2, F3, F4, F5, F6, F7 (2026-10-08)
- **Rule**: none
- **Skipped**: none
- **Accepted**: none
- **Verification after fixes**: `npm test` 78 files / 882 passed; `astro check` 0 errors; eslint 0 errors (3 warnings that predate this change).
