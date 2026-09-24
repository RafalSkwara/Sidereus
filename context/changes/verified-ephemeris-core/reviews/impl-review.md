<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Verified Ephemeris Core

- **Plan**: `context/changes/verified-ephemeris-core/plan.md`
- **Scope**: Phases 1–4 of 4 (full plan), commits 5117faa..ceb2479 on `feat/f-01`
- **Date**: 2026-09-24
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 7 warnings, 3 observations
- **Triage**: completed 2026-09-24 — Fixed: F1, F2, F3, F4, F5, F6, O8, O9, O10 (9); Accepted: F7 (1); Skipped: 0

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

Automated success criteria re-run at review time: `npm test` 68 passed / 6 todo, generator idempotent, lint, `astro check`, build, CI step, purity guard, report rows — all pass. Row 4.1's "zero todo fixtures" clause remains unmet by decision.

## Findings

### F1 — darkWindow returns an inconsistent shape when the altitude search misses

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/engine/sun.ts:60-68
- **Detail**: Culmination check says the threshold is reached, but a null `SearchAltitude` result (near-minimum unreliability, or sun already below threshold at local noon) yields `kind: "none"` with `minSunAltitudeDeg < thresholdDeg`, or `clampedToNightEnd: true` when only dawn was missed. S-04's seasonal search iterates such nights.
- **Fix**: Bisection fallback on `sunAltitudeDeg` over the monotone legs `[night.start, lowest]` / `[lowest, night.end]`; dusk = `night.start` (flagged) when already below threshold at noon; add a polar-night test.
  - Strength: Removes the contradictory variant; exact on monotone legs.
  - Tradeoff: ~25 lines, one test; slower only on the fallback path.
  - Confidence: HIGH.
  - Blind spot: Exact poles untested.
- **Decision**: FIXED

### F2 — objectTrack recomputes the frame rotation per target, not per instant

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (performance)
- **Location**: src/lib/engine/objects.ts:44-47
- **Detail**: `Rotation_EQJ_HOR` runs once per (instant, target): ~6 000 rotations per 110-object ranking where ~55 would do. 7 ms warm locally against the Workers Free 10 ms CPU cap.
- **Fix**: Add `objectTracks(site, interval, targets)` computing one rotation per instant; keep `objectTrack` as a wrapper; export from the barrel; use in determinism.test.ts.
  - Strength: ~100× less trig on the S-02 hot path, no API break.
  - Tradeoff: One more export to document.
  - Confidence: HIGH.
  - Blind spot: Real Workers CPU time not measurable locally.
- **Decision**: FIXED

### F3 — sampleInstants accepts arbitrarily small steps

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/engine/sampling.ts:9-19
- **Detail**: Any positive finite step passes; tiny steps allocate unboundedly or loop forever; float accumulation drifts.
- **Fix**: Require `stepMinutes ≥ 1`; compute `startMs + i * stepMs` by integer index.
- **Decision**: FIXED

### F4 — Generator turns malformed numbers into silent nulls

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/build-catalogue.mjs:101-103
- **Detail**: `Number("bad")` → NaN → JSON `null`, accepted by the validator as missing data.
- **Fix**: Throw unless finite (empty string stays null).
- **Decision**: FIXED

### F5 — Timing benchmark runs at collection time and is wall-clock flaky

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (test quality)
- **Location**: src/lib/engine/determinism.test.ts:47-50, 65-71
- **Detail**: `timed()` executes in the describe body; the CI bound is probabilistic on shared runners.
- **Fix**: Move runs into `beforeAll`/test bodies; keep the local 1000 ms assertion; make the CI bound report-only.
- **Decision**: FIXED

### F6 — Fixture-driven sun test can pass vacuously

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (test quality)
- **Location**: src/lib/engine/sun.test.ts:152-157
- **Detail**: Captured fixture with `expectNoDarkness: false` and null times asserts only the window kind; `darkEnd.thresholdDeg` unused.
- **Fix**: Assert both times non-null when `expectNoDarkness` is false; assert the two thresholds match.
- **Decision**: FIXED

### F7 — Manual rows 3.4/3.5 checked without recorded evidence; fixture provenance incomplete

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 3.4, 3.5, 4.1; src/lib/engine/fixtures/stellarium/*.json:12
- **Detail**: 3.4/3.5 rest on an unrecorded spot check (documented in change.md); six moon/object todos and row 4.1 remain; 1° altitude candidate unmeasured; `source.version` empty in all three captured sun sections.
- **Fix**: Fill `source.version`; schedule moon/object capture as a follow-up before `/10x-archive`.
  - Strength: Honest record without blocking S-02.
  - Tradeoff: 4.1 stays open; archive will warn.
  - Confidence: HIGH.
  - Blind spot: Whether the second reading session happens.
- **Decision**: ACCEPTED — user: "enough of the engine was tested manually by me that I trust it being correct now. I accept the risk, it's still only an MVP and things like this can be accepted to keep the development tempo up (the time constraint is real and important)"

### O8 — Minor drift: fixtures/index.ts has no capturedSections() helper

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: src/lib/engine/fixtures/index.ts:37-65
- **Detail**: Plan promised a per-section union and a narrowing helper; sun is a plain interface, tests narrow on `status` directly. Intent held.
- **Fix**: One-line addendum in plan Phase 2 §5.
- **Decision**: FIXED

### O9 — Pattern: deep imports and duplicated test helpers

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/lib/engine/fixtures/report.test.ts:4-10; src/lib/engine/*.test.ts
- **Detail**: Deep imports despite the barrel rule; WARSAW literal, circular-azimuth helper and fixture-site mapping copied 3–4 times.
- **Fix**: Import from `@/lib/engine`; export `siteOf()` and `circularDeltaDeg()` from `fixtures/index.ts` and reuse.
- **Decision**: FIXED

### O10 — Purity guard and API edge notes

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/lib/engine/purity.test.ts:17-24; src/lib/engine/sun.ts:28-38
- **Detail**: Guard misses `performance.now`, argument-less `Intl.DateTimeFormat()`, other `node:*` imports; `sunEvents` returns `{null, null}` for both midnight sun and polar night.
- **Fix**: Extend the token list; document the `sunEvents` ambiguity.
- **Decision**: FIXED
