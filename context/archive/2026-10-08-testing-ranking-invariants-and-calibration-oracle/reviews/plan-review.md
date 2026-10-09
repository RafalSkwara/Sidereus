<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Test rollout Phase 3 — ranking invariants and calibration oracle

- **Plan**: `context/changes/testing-ranking-invariants-and-calibration-oracle/plan.md` (branch at ba17469)
- **Date**: 2026-10-09
- **Reviewers**: two Opus agents (claim verification; feasibility, sequencing and architecture, with temporary probe tests and temporary production edits, all restored), plus a check that every automated command resolves
- **Findings**: 2 critical, 6 warnings, 2 observations
- **Overall**: NEEDS ATTENTION. F1 and F2 are critical but local: each is one contract or break-check line, the plan's premise and phase order hold, so the plan is triaged rather than re-planned. Triage 2026-10-09: user chose "apply all"; all 10 FIXED in plan.md and plan-brief.md.

## Verdicts

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Claim Accuracy | FAIL | F1, F5, F9, F10 |
| Substance | PASS | |
| Feasibility | PASS | |
| Sequencing | WARNING | F8 |
| Architecture Fit | PASS | |
| Scope Discipline | PASS | |
| Verifiability | FAIL | F2, F3, F4, F6 |
| Coverage | WARNING | F7 |

**Evidence that the plan's premises hold (probes, 2026-10-09):**

- **Phase 1.** 200 cases with seed 20261008 over the 16 planned sites:
  - 176 have a dark window, with 13,187 object entries.
  - 81 southern cases and 44 cases above 60° have a window; there are 507 planet and 108 Moon entries.
  - 0 violations. The smallest altitude margin is +0.0002° and the worst sun margin −0.0003°, both inside ε = 0.05°. Runtime 1.3 s.
  - Every non-vacuity floor is met. The floor of ≥150 cases with a window has only 26 to spare.
- **Relation (g).** 150 → 300 mm drops no cleared id on the 4 calibration nights, the 2 full-Moon nights or 55 generated cases. It holds by construction: aperture enters `score.ts` only through `limitingMag`, which is monotone.
- **Full-Moon preconditions.** `washedOutCount` is 19 on 2026-03-03 and 10 on 2026-10-26.
- **Relations (a)–(e).** `rankScore − total` ∈ {0, 0.03} with no log and {−0.15, −0.12} with every object seen. Thirty entries rated 1–2, passed through `seenSummaries`, give a deep-equal ranking; 11 of the rating-2 entries hit cleared objects. The Messier-null cleared set is identical.
- **Overlap.** The top 5 of each calibration night overlaps the reference by exactly 3 on every night. The 2026-10-10 Messier-only top 5 (M31, M34, M39, M45, M52) ⊆ AF.
- **All 50 reference ids** and all 20 AF ids exist in `DEEP_SKY` (171 objects).
- **Phase 4.** 40 builds at `observingNight(date, tz).start + 6 h` (18:00 local), with `limit: Infinity` and `forecast: null`:
  - `view.date` is correct in 40 of 40 builds, polar sites included.
  - 37 plans have rows (3,141 rows in all), with 0 violations. Runtime 0.64 s.
  - The cloudy Warsaw build gives no-go with `ranking: null`.
- **Automated commands.** All resolve (`vitest run`, eslint 10.10.0, `astro check`). The §6.3/§6.6 grep check fails today, as expected, because §6.3 still says TBD.

## Findings

### F1 — Session plan rows carry no `window`; Phase 4 can't read row windows as written

- **Severity**: CRITICAL · **Impact**: MEDIUM · **Dimension**: Claim Accuracy (WRONG)
- **Location**: plan.md "Phase 4 › 1. Tonight visibility suite"; Current State "Session plan rows reuse the raw window" (`build.ts:1019-1054`)
- **Detail**: `SessionPlanRow` is `Omit<R,"window"> & { from, to, best }` (`src/lib/tonight/session-plan.ts:18`): only clamped axis fractions, plus `windowText`/`bestTime` strings rounded to the minute and `bestAt` (ms, exact). The view exposes no axis in ms without `withSkyView`. Rows are built at `build.ts:1090-1153` (`rowOf`, `planRows`); `:1019-1054` is the sky view. `cardPasses` is at `:720`, not `:692`. As written, "check the row's `window.start`, `window.end`" can't be implemented.
- **Fix**: Rebuild the axis in the test as `skyAxis` does (`build.ts:586`: `sunEvents`, falling back to `observingNight`), then take start = axis.start + from × length and end = axis.start + to × length, and use `bestAt` as is. Assert no row is clamped (`from > 0`, `to < 1`, or the computed edge equals the engine window to within one minute) so clamping can't hide an overrun. Correct the line references.
  - Strength: the probe ran this exact method, with 0 rows clamped and 0 violations over 3,141 rows.
  - Tradeoff: the test mirrors the axis rule; if `skyAxis` changes, the test must follow.
  - Confidence: HIGH, probed end to end.
  - Blind spot: none significant.
- **Decision**: FIXED (applied to plan.md)

### F2 — `cardPasses` break check can't turn red: no-go already blocks the ranking

- **Severity**: CRITICAL · **Impact**: MEDIUM · **Dimension**: Verifiability
- **Location**: plan.md "Phase 4 › Success Criteria" (break check 1), Progress 4.2
- **Detail**: `verdict()` returns no-go when there is no darkness (`src/lib/engine/verdict.ts:77-79`), so the `window.kind === "window"` condition at `build.ts:720` is redundant. The probe removed it and gate (i) stayed green (0 no-dark rankings).
- **Fix**: Describe gate (i) as guarded twice: the verdict's no-darkness branch and `cardPasses`. The break removes **both**. That makes `sampleInstants` throw a `TypeError` on `window.start`, so the suite wraps each no-darkness build in a function that turns a throw into a failed assertion ("ranking built or build threw on a night without darkness") rather than a crash.
  - Strength: matches the code's real guard structure; the probe confirmed the single edit stays green.
  - Tradeoff: the break check edits two places.
  - Confidence: HIGH.
  - Blind spot: whether a future ranking path bypasses `verdict()`. The double break covers today's code only.
- **Decision**: FIXED (applied to plan.md)

### F3 — Phase 1 break check 2 edits the test's own input, and its cross-reference is wrong

- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Verifiability
- **Location**: plan.md "Phase 1 › Success Criteria" (break check 2), Progress 1.2
- **Detail**: Changing the threshold in the suite's own call checks the check, not production. The note "the production-side equivalent is Phase 4's `cardPasses` check" is wrong: `cardPasses` has nothing to do with thresholds. And if the suite takes the threshold from `darknessThresholdDegForBortle`, a production break there moves both sides together and stays green.
- **Fix**: The suites own a Bortle → threshold table taken from the PRD (−18/−15/−12, PRD OQ7) and never read the threshold from `darknessThresholdDegForBortle` for the oracle. The production break becomes "`darknessThresholdDegForBortle` returns −12 for Bortle ≤ 4" (`parameters.ts:27`). The probe recorded 2,141 violations, red.
- **Decision**: FIXED (applied to plan.md)

### F4 — Phase 3 primary retune stays green

- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Verifiability
- **Location**: plan.md "Phase 3 › Success Criteria" (break check 1), Progress 3.2
- **Detail**: Retune A (duration 0.10, moon 0.30, brightness 0.10, sky 0.50) gives overlaps of 4/3/3/3: green. Retune B (0.6/0.3/0.05/0.05) gives 0/2/3/2: red. `MESSIER_RANK_BONUS` = −0.2 gives 1/0/1/1 and no Messier object in any top 5: red.
- **Fix**: Make retune B the primary break check and log retune A as a known green retune (a harmless reorder that the oracle rightly tolerates).
- **Decision**: FIXED (applied to plan.md)

### F5 — Independent-altitude helpers: RA units, and planets and the Moon aren't independent

- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Claim Accuracy (WRONG)
- **Location**: plan.md "Key Discoveries › Independent oracle", "Phase 1 › 2. Visibility property suite"
- **Detail**:
  - The catalogue and `EquatorialJ2000` carry `raHours` (`src/lib/engine/types.ts:69-73`), not `raDeg`.
  - `Horizon()` takes RA in hours.
  - For planets and the Moon, `Equator(body, t, obs, true, true)` then `Horizon(…, "normal")` is exactly the engine's path (`planets.ts:62-63`, `moon.ts:41-42`). So that oracle can't catch a refraction or aberration slip there.
- **Fix**:
  - Deep sky: `VectorFromSphere({ lat: dec, lon: raHours × 15, dist: 1 })` → `Rotation_EQJ_EQD` → `EquatorFromVector` → `Horizon(ra hours, …, "normal")`.
  - Planets and the Moon: take the J2000 vector (`Equator(body, t, obs, false, true)`), then `Rotation_EQJ_HOR` → `HorizonFromVector(…, "normal")`, a path the engine doesn't use for bodies.
- **Decision**: FIXED (applied to plan.md)

### F6 — Phase 2: log relations must go through `seenSummaries`; washed-out break location is wrong

- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Verifiability
- **Location**: plan.md "Phase 2 › 1. Invariant relations suite (a)(b)", Success Criteria break checks 1 and 3
- **Detail**:
  - Ratings are filtered only inside `seenSummaries(entries, onOrBefore)` (`log.ts:32-36`). A hand-built `seen` map bypasses that filter, so the `LOG_PENALTY_MIN_RATING` = 2 break would stay green.
  - The washed-out exclusion is the `if (score?.washedOut)` branch at `ranking.ts:220-222`, not the cleared filter (`:236`).
  - Under the `rankScore` break, only (b) turns red; (c) stays green on the calibration nights. That fits the plan's "(b) or (c)" wording.
- **Fix**:
  - Build `seen` for (a) and (b) with `seenSummaries(log, night)`, with log nights on or before the ranked night.
  - Assert non-vacuity first: at least one rating-2 entry hits a cleared object.
  - Point break check 3 at `ranking.ts:220-222` (let washed-out objects fall through into `scored`).
- **Decision**: FIXED (applied to plan.md)

### F7 — Phase 4: no-darkness count rides on the seed, and the 18:00 `now` is unspecified

- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Coverage
- **Location**: plan.md "Phase 4 › 1. Tonight visibility suite" (non-vacuity, `now`)
- **Detail**: With the plan's seed, exactly 3 of 40 cases have no darkness, which meets the floor of ≥3 with no slack. "Case evening 18:00 local" has no zone-safe construction in the plan. The probe used `observingNight(date, tz).start + 6 h`; DST never changes between noon and 18:00, and `view.date` was correct in 40 of 40 builds, polar ones included.
- **Fix**: Add fixed polar-summer cases on top of the seeded ones: Tromsø and Longyearbyen on 06-21, and Helsinki on 06-21 at Bortle 1–4. Set `now = observingNight(date, tz).start + 6 h`.
- **Decision**: FIXED (applied to plan.md)

### F8 — Phase 4 needs Phase 1's helpers, which Phase 1 keeps in its test file

- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Sequencing
- **Location**: plan.md "Phase 1 › 2" ("The independent helpers live in the test file"), "Phase 4 › 1" ("shared … or duplicated minimally")
- **Detail**: Phase 4 imports the helpers across directories. `src/lib/engine/fixtures/` is skipped by both `purity.test.ts:61` and the runner-zone guard (`src/lib/runner-zone-guard.test.ts:26`). `src/lib/tonight/test-fixtures.ts` is scanned by the runner-zone guard. There is precedent: `build.test.ts` already imports `@/lib/engine/fixtures`. Also, `toEngineSite` drops elevation (`store.ts:140`), so Tonight rows are computed at elevation 0, and `no-console` is an error under `src/lib/tonight/**`.
- **Fix**: From Phase 1, put the independent helpers in `src/lib/engine/fixtures/independent-altitude.ts` (test-only) and import them in both suites. The Phase 4 helper calls use elevation 0. The Phase 4 suite never logs.
- **Decision**: FIXED (applied to plan.md)

### F9 — Generator details: Madrid's band, eyepiece focal lengths, Auckland's offset, a crash-prone break

- **Severity**: OBSERVATION · **Impact**: LOW · **Dimension**: Claim Accuracy
- **Location**: plan.md "Phase 1 › 1. Seeded generator and site list", Phase 1 break check 1
- **Detail**:
  - Madrid is at 40.4° N, not in the 45–55° band.
  - `eyepiece-presets.ts` exports only AFOV presets (50/68/82°) and no focal lengths.
  - Auckland is +13 only in the southern summer.
  - Widening `bestWindow` without clamping the indices makes `track[-1]` crash the suite instead of turning it red.
- **Fix**:
  - Swap Madrid for Paris (48.9° N), or move it to the 20–40° N band.
  - Draw eyepiece focal lengths from 2–60 mm and the AFOV from the presets.
  - Label Auckland "+12/+13".
  - In break check 1, say "clamp the widened indices to the track".
- **Decision**: FIXED (applied to plan.md)

### F10 — Stale references: CLAUDE.md paragraph, literal line, calibration header path; (g) holds by construction

- **Severity**: OBSERVATION · **Impact**: LOW · **Dimension**: Claim Accuracy
- **Location**: plan.md "Phase 4 › 2. Docs", "Phase 3 › 2/3", "Phase 2 (g)"
- **Detail**:
  - The calibration sentence sits in CLAUDE.md's **Catalogue** paragraph (`CLAUDE.md:74`), not the Engine paragraph.
  - The order literal is at `ranking.test.ts:194`.
  - The `calibration.test.ts` header still points to the pre-archive `context/changes/deep-sky-beyond-messier/evidence/calibration.md`.
  - Relation (g) holds by construction (monotone `limitingMag`), so it only guards future changes.
- **Fix**:
  - Point the CLAUDE.md edit at the Catalogue paragraph.
  - Fix the line references.
  - Have the Phase 3 header update repoint the evidence path to `context/archive/2026-10-06-deep-sky-beyond-messier/evidence/calibration.md`.
  - Label (g) as a regression guard.
- **Decision**: FIXED (applied to plan.md)
