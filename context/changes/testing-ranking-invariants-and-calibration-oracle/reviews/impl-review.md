<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test rollout Phase 3 — ranking invariants and calibration oracle

- **Plan**: `context/changes/testing-ranking-invariants-and-calibration-oracle/plan.md`
- **Scope**: Full plan (Progress 4.5, the owner's OK on the #21 comment, is pending and needs no code)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-09
- **Verdict**: NEEDS ATTENTION — triage 2026-10-09: all 8 FIXED (see follow-ups/review-fixes.md)
- **Findings**: 0 critical, 2 warnings, 6 observations
- **Reviewers**: two Opus agents (plan drift; safety, quality and patterns, with one temporary probe that was removed), plus a re-run of every automated criterion

All four phases match the plan's intent. The oracles stay independent of the engine's computational path for deep sky and for planets and the Moon. Nothing outside test files, test-only fixtures and docs changed. Extra assertions beyond the plan are benign controls:

- a rating-3 control for (a);
- a run that reaches all four (d) deltas;
- a no-go requirement in gate (i);
- a `forecast: null` control for gate (ii).

The break-check logs are consistent with the tests.

**Automated criteria (re-run 2026-10-09):**

- The five suites: 302 passed, 1 skipped (the opt-in snapshot).
- The §6.3/§6.6 doc check: OK.
- At the Phase 4 gate: `npm test` 1449 passed, lint 0 errors (3 known warnings), `astro check` 0 errors.

**Manual:** 3.4 is ticked, with evidence in the dated `fixtures/README.md` note. 4.5 is pending (the owner's OK).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Tonight "row not clamped" guard misfires on a polar-night axis

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (latent false failure)
- **Location**: src/lib/tonight/visibility-invariants.test.ts:~192; test-plan §6.3
- **Detail**: When `sunEvents` gives no sunset or sunrise, the axis is the whole observing night. The −6° window is then clamped to the night too (`sun.ts:71-84`), so a planet or Moon row that is up at the night's edge legitimately has `from === 0` or `to === 1`. A probe at Longyearbyen on 2026-11-25 (Bortle 5, min altitude 15) built a Moon row with `to === 1`, which the suite reports as "clamped". Seed 20261010 happens to draw no Longyearbyen polar-night case, so a reseed or a new site would turn the suite red with no engine bug.
- **Fix**: apply the not-clamped guard only when the axis comes from sunset and sunrise. On a night-wide axis, accept 0 or 1 at an edge only when the engine's window is clamped to that same night edge. Add a fixed Longyearbyen 2026-11-25 case so the path is exercised, and update §6.3's wording.
  - Strength: removes a seed-dependent false red while keeping the guard against a real overrun on normal nights; the probe gives a concrete regression case.
  - Tradeoff: the guard gains one branch that mirrors the axis rule.
  - Confidence: HIGH — the probe reproduced it.
  - Blind spot: the southern polar site (Rothera) in its polar day/night, which the fixed case doesn't cover.
- **Decision**: FIXED (owner: "apply all recommended", 2026-10-09)

### F2 — (d) "all four deltas reached" check breaks on a legitimate retune

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (brittleness)
- **Location**: src/lib/engine/ranking-invariants.test.ts:~349
- **Detail**: The check matches each `rankScore − total` to an index in `allowed = [0, bonus, −penalty, bonus − penalty]` and requires indices 0–3 all seen. With `MESSIER_RANK_BONUS` = 0, or bonus == penalty, the values coincide, `findIndex` never returns 1 or 3, and the test fails even though the invariant holds.
- **Fix**: compute each entry's expected delta from its inputs (`object.messier !== null`, `seen !== null`) and assert equality within 1e-9. Keep the "all four input combinations occur" non-vacuity check on the inputs, not on the matched values.
- **Decision**: FIXED (owner: "apply all recommended", 2026-10-09)

### F3 — A dropped Session plan row passes silently

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (vacuity)
- **Location**: src/lib/tonight/visibility-invariants.test.ts (row loop); `session-plan.ts:88`; `build.ts` planet `catch`
- **Detail**: `layoutSessionPlan` drops rows whose window misses the axis, and `build.ts` turns a planet failure into an empty list. The suite checks only the rows that remain.
- **Fix**: assert per case that the plan's row count equals the ranking's entries plus the plan's planets plus the Moon target (when present). Confirm it holds on every case before committing.
- **Decision**: FIXED (owner: "apply all recommended", 2026-10-09)

### F4 — Gate (i)'s "no darkness" is decided by the engine's own `darkWindow`

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (oracle independence)
- **Location**: src/lib/tonight/visibility-invariants.test.ts:~128
- **Detail**: If `darkWindow` wrongly reported a window, the gate would never run. Today's guard is the test's threshold table, but the classification itself is the engine's.
- **Fix**: classify with the oracle: sample `sunAltitudeGeometricDeg` over the observing night (for example every 10 min) and call it no-darkness when the minimum never reaches `DARK_THRESHOLD_BY_BORTLE[bortle]`. Assert it agrees with `darkWindow.kind`.
- **Decision**: FIXED (owner: "apply all recommended", 2026-10-09)

### F5 — The "≥2 sources" rule of the beginner reference is not enforced

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (oracle integrity)
- **Location**: src/lib/engine/fixtures/beginner-reference.ts; calibration.test.ts
- **Detail**: Only catalogue existence is checked. A single-source entry or a duplicate id could slip in, which makes "never edit the list to pass" easier to break unnoticed.
- **Fix**: add a structural test with three checks: every entry has ≥ 2 distinct sources; every source key exists in `BEGINNER_SOURCES`; no id repeats within a night.
- **Decision**: FIXED (owner: "apply all recommended", 2026-10-09)

### F6 — Docs overstate oracle independence and fixture imports

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (docs accuracy)
- **Location**: src/lib/engine/fixtures/independent-altitude.ts:20-23; fixtures/README.md "Generated cases"; test-plan §6.3
- **Detail**:
  - All three say every helper takes "a road the engine does not take". `sunAltitudeGeometricDeg` is the same call as `sun.ts:21-22`, and its own JSDoc says so.
  - The README says neither module imports anything but astronomy-engine and engine types, but `generated.ts` imports `addDays` and `EYEPIECE_PRESETS`. Both only shape the inputs.
  - §6.3 says "URL" where the fixture has `urls`.
  - The README names only seed 20261008; the other suites use 20261009 and 20261010.
- **Fix**: correct the wording in all four places. The sun helper is a deliberate copy of the engine's geometric sun; the import rule applies to `independent-altitude.ts` only; list all three seeds.
- **Decision**: FIXED (owner: "apply all recommended", 2026-10-09)

### F7 — "Harmless reorder" wording overstates what the AF check tolerates

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (docs accuracy)
- **Location**: src/lib/engine/ranking.test.ts:~191-204 comment; test-plan §6.6 Phase 3 note
- **Detail**: Both say a harmless reorder passes and call retune A harmless. The Phase 3 break-check log shows retune A turns the AF set check on 2026-10-10 red, because it changes top-5 membership. The calibration oracle tolerates retune A; the AF check is stricter.
- **Fix**: reword to "a reorder within AF's fall picks passes", and note in §6.6 that the AF check is stricter than the k = 3 oracle (retune A passes the oracle but not the AF check).
- **Decision**: FIXED (owner: "apply all recommended", 2026-10-09)

### F8 — Short-window rate quoted as about 0.7% in test comments; observed about 1%

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (docs accuracy)
- **Location**: src/lib/engine/visibility-invariants.test.ts:38, :261
- **Detail**: The research estimate was about 0.7%. Phase 1 observed 134 of about 13,800 entries (about 1%), and the #21 draft says about 1%.
- **Fix**: say "about 1% (134 of about 13,800 entries for seed 20261008)" in both comments.
- **Decision**: FIXED (owner: "apply all recommended", 2026-10-09)
