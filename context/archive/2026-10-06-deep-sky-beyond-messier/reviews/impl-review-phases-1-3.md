<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Deep sky beyond Messier (S-03)

- **Plan**: context/changes/deep-sky-beyond-messier/plan.md
- **Scope**: Phases 1–3 of 5 (asked for by the user; phases 2 and 3 each have one open row, 2.5 and 3.3)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

**Evidence:**
- Two Opus review agents ran (drift; safety and patterns), and I re-ran the automated criteria:
  - the catalogue rebuilds with no diff;
  - vitest 793 passed;
  - `astro check` 0 errors;
  - eslint 0 errors.
- The drift agent re-ran the calibration setup independently and matched `evidence/calibration.md` exactly.
- The island boundary is clean: no client chunk contains catalogue names.
- No scope creep, and nothing from "What We're NOT Doing" appears.
- Progress 2.5 (the user's calibration review) and 3.3 (full e2e, waiting on Phase 4) are pending.

## Findings

### F1 — The generator's field-count guard can't catch the mis-split it exists for

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/build-catalogue.mjs:310-315 (lastReadIndex :170)
- **Detail**: A `;` inside a quoted field gives a row *more* cells, never fewer, so `fieldCount < lastReadIndex + 1` only catches truncated rows. The merged NGC0869/0884 rows also bypass it. Today's data is correct: no quote appears in columns 1–29, and the real safety net is the C 30 (NGC 7331) value test. `build-stars.mjs` already has a proper quoted-field parser.
- **Fix**: Fail when a selected row has a `"` in any cell up to `lastReadIndex`, or reuse build-stars' quoted-field parser. Correct the comment to match.
- **Decision**: FIXED

### F2 — HEAD can't log a Caldwell object until Phase 4

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/targets/labels.ts:30, src/pages/tonight/targets.astro:31, tests/e2e/tonight-targets.spec.ts:82
- **Detail**: This is the Phase 3/4 coupling the plan names. "Mark observed" on a Caldwell row reaches "Sidereus doesn't know that object", and the `?logged=` notice can't name it. The e2e passes for a Caldwell row only once `targetLabel` returns the display label. Progress 3.3 is open for this reason.
- **Fix**: Phase 4 makes `targetLabel` return `findDeepSky(key).label` as its `id` (the plan's label branch), and 3.3 is ticked only after a green full e2e run. Never deploy HEAD before Phase 4.
- **Decision**: CARRIED INTO PHASE 4 (label branch; tick 3.3 only after a green full e2e run)

### F3 — The 1 September Moon card now reads "1 faint object washed out"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/tonight/build.test.ts:1050-1057 (pinned to `catalogue: MESSIER`)
- **Detail**: With `DEEP_SKY`, NGC 4236 (C 3, a diffuse galaxy at V 9.77) is correctly washed out on 1 Sep, so the real card changes from "Moonlit sky" to "1 faint object washed out". The behaviour is correct, but it is a visible change that no evidence file records. Pinning the test keeps the copy branch covered, but production's catalogue is no longer tested for that night.
- **Fix**: Record the behaviour change in evidence/phase-3.md (no code change).
- **Decision**: FIXED

### F4 — Double Cluster merge has no null guards

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/build-catalogue.mjs:161-164, 288
- **Detail**: `Math.min(oa.bMag, ob.bMag)` treats null as 0, and a null axis gives NaN, which JSON writes as null. Today's data has every value, so the output is correct (vMag 3.7, bMag 4.3, axis 41.5).
- **Fix**: Throw in the merge if any field it combines is null.
- **Decision**: FIXED

### F5 — The "Caldwell n · in Const" line is built in 3 places, 2 ways

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: ObjectCard.astro:22-28, ObjectRow.astro:20-26, TargetsPageContent.astro:231
- **Detail**: Two places use an array plus `.join(" · ")`; the washed-out row uses an inline template string. The output is the same today but could drift.
- **Fix**: Put one helper in `src/lib/tonight/format.ts` and use it in all three.
- **Decision**: FIXED

### F6 — e2e reads the row label through a styling class

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/e2e/tonight-targets.spec.ts:71 (`summary .font-display`)
- **Detail**: A typography change would break the test.
- **Fix**: Add a `data-label` attribute on the row (beside `data-object`) and read that.
- **Decision**: FIXED

### F7 — Test leftovers: unused fixture, unregenerable snapshot, 4-entry design sample

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/engine/fixtures/index.ts (`deepSkyTarget`), src/lib/engine/calibration.test.ts, src/pages/design.astro:295-340
- **Detail**: `deepSkyTarget` is used nowhere. The calibration snapshot came from a deleted scratch test, so the committed test can't regenerate it. The `/design` sample has 4 summary targets where the real tile holds 3 (`SUMMARY_TARGETS`).
- **Fix**: Remove `deepSkyTarget`; add an opt-in snapshot log to the calibration test (e.g. `CALIBRATION_SNAPSHOT=1` prints the top 10); make the design sample put the Double Cluster in place of one of the three.
- **Decision**: FIXED

### F8 — Excluded Caldwell numbers aren't documented in the meta

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/catalogue/caldwell.meta.json (`selection`)
- **Detail**: C 9 (Cave Nebula, Sh2-155) and C 41 (Hyades) are reachable from 52° N but absent from OpenNGC's identifiers. Their exclusion is recorded only in plan.md. The CSV downloads also carry no checksum (low risk: the URL pins the SHA).
- **Fix**: Have the generator write the excluded numbers and reasons into the meta's `normalisations` or `selection`.
- **Decision**: FIXED
