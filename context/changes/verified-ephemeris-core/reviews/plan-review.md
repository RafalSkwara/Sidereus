<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Verified Ephemeris Core

- **Change**: verified-ephemeris-core
- **Plan**: `context/changes/verified-ephemeris-core/plan.md` (4 phases)
- **Date**: 2026-09-22
- **Findings**: 0 critical, 7 warnings, 2 observations
- **Overall**: NEEDS ATTENTION — fixable in triage, no re-plan needed
- **Triage**: completed 2026-09-22 — 9/9 FIXED (F1–F7, O1, O2); plan.md and plan-brief.md updated in place

## Verdicts

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Claim Accuracy | PASS | — (every codebase and astronomy-engine API claim confirmed against repo and the 2.1.19 type definitions) |
| Substance | PASS | — |
| Feasibility | WARNING | F1, F2 |
| Sequencing | PASS | — |
| Architecture Fit | WARNING | F4 |
| Scope Discipline | PASS | — |
| Verifiability | WARNING | F3, F5 |
| Coverage | WARNING | F6, F7 |

Verification commands probed: `npm run lint` and `npx astro check` resolve and pass today; `npm test`, `node scripts/build-catalogue.mjs` and `vitest` are absent, all introduced by Phase 1 as the plan states.

## Findings

### F1 — Moon tests and moon fixture sit on a new-moon night
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Feasibility
- **Location**: plan.md "Phase 3 › Changes Required › 4"; "Phase 2 › 5" fixture files
- **Detail**: New moon is 2026-10-10 ~15:50 UTC, inside the Warsaw 2026-10-10 night; illuminated fraction falls then rises, so the monotonicity assertion fails, and the moon fixture on that night is near-useless (fraction ≈ 0, below horizon during the dark window). 2026-10-24 is a waxing gibbous moon, up all night.
- **Fix**: Run monotonicity on Warsaw 2026-10-24; require moon samples on 2026-10-24 and Tromsø only; mark 2026-10-10 moon section `status: "not-applicable"` with the reason.
- **Decision**: FIXED

### F2 — Transit-azimuth assertion too tight for a 10-minute grid
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Feasibility
- **Location**: plan.md "Phase 3 › Changes Required › 4" (M31 culmination test)
- **Detail**: At ≈79° altitude azimuth changes ≈1°/min; a sampled peak can be 5 min from transit, ≈5° off 180.
- **Fix**: Assert azimuth at the transit instant from `SearchHourAngle(…, 0)` within 2°; keep the sampled peak altitude at 1°.
- **Decision**: FIXED

### F3 — Prettier will reformat the generated JSON on commit
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 1 › Success Criteria" (1.2)
- **Detail**: lint-staged runs `prettier --write` on `*.json`; no `.prettierignore`; printWidth 120 collapses short structures in `messier.meta.json`, breaking byte-identical regeneration after the first commit.
- **Fix**: Add `.prettierignore` listing the two generated files in Phase 1 §4.
- **Decision**: FIXED

### F4 — `loadFixtures()` reads the filesystem inside the pure engine
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Architecture Fit
- **Location**: plan.md "Phase 2 › 5" (`schema.ts`); "Phase 2 › Success Criteria" (2.3)
- **Detail**: Directory-reading helper under `src/lib/engine/` contradicts the purity rule; the guard omits `fs`; `purity.test.ts` contains every forbidden token and self-fails without exclusions; `JSON.parse` yields `any` under strictTypeChecked.
- **Fix**: Test-only `fixtures/index.ts` with static JSON imports typed as a `pending | captured` discriminated union plus a narrowing validator; guard scans `src/lib/engine/**` excluding `*.test.ts` and `fixtures/**` and adds `fs` tokens.
- **Decision**: FIXED

### F5 — Wall-clock `< 1000 ms` assertion is nondeterministic on CI
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 3 › 5" (determinism.test.ts)
- **Detail**: Shared CI runners and JIT warm-up make a hard 1 s bound flaky.
- **Fix**: Always log the time; assert `< 1000 ms` locally and `< 3000 ms` when `process.env.CI` is set (test file only).
- **Decision**: FIXED

### F6 — Moon/object capture steps missing from the fixture protocol
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Coverage
- **Location**: plan.md "Phase 2 › 5" README contract vs "Phase 3 › Manual Verification" 3.4
- **Detail**: The README contract covers sun steps only; the Phase 3 manual gate depends on moon/object steps no phase defines.
- **Fix**: Extend the README contract with moon and object capture steps.
- **Decision**: FIXED

### F7 — ShareAlike data licence vs a repo that claims MIT with no LICENSE file
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Coverage
- **Location**: plan.md "Phase 1 › 7"; README.md:192
- **Detail**: `messier.json` is Adapted Material under CC BY-SA 4.0 §4(b); attribution alone does not satisfy ShareAlike; README says MIT, no LICENSE file exists.
- **Fix**: Phase 1 §7 adds `src/lib/catalogue/LICENSE-DATA.md` (catalogue files are CC BY-SA 4.0 derived works) and says so in the README data-sources section; repo-wide licence is the user's separate decision.
- **Decision**: FIXED

### O1 — Items promised but unassigned to a phase
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Coverage
- **Location**: plan.md "Testing Strategy", "Phase 1 › 5", "Phase 4 › 3"
- **Detail**: (a) `MESSIER` JSON import infers `type: string`, needs assertion/validator; (b) 24 h-window and malformed-date tests appear only in Testing Strategy, and `Date.UTC` of a malformed date returns NaN silently; (c) README.md:185 still says CI runs on `master`; (d) `scripts/**/*.test.mjs` vitest include is dead config.
- **Fix**: Assign (a) to Phase 1 §5, (b) to Phase 2 §3/§6 with explicit date-shape validation, (c) to Phase 1 §7, drop (d).
- **Decision**: FIXED

### O2 — Simpler API path and a near-minimum caveat
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Substance
- **Location**: plan.md "Critical Implementation Details"
- **Detail**: `Rotation_EQJ_HOR(time, observer)` + `HorizonFromVector(vec, 'normal')` replaces the four-step chain; `SearchHourAngle` returns `.hor.altitude` directly. astronomy-engine documents `SearchAltitude` as unreliable near a body's minimum altitude — Warsaw midsummer at −12°/−15° is that case (S-04's problem; F-01 fixtures are clear of it).
- **Fix**: Rewrite the two Critical Implementation Details paragraphs accordingly and add the near-minimum caveat.
- **Decision**: FIXED
