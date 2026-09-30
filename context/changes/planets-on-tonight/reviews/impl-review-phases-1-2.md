<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Planets on Tonight

- **Plan**: context/changes/planets-on-tonight/plan.md
- **Scope**: Phases 1–2 of 3
- **Reviewed phases**: 1, 2
- **Date**: 2026-09-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Evidence:
- **Unit tests** (`npm test`): 402 passed.
- **Purity check**: passes.
- **`astro check`**: 0 errors.
- **`lint`**: 0 errors. The 2 existing warnings are unchanged.
- **Database tests** (`test:db`): 70 passed.
- **`db:types`**: no drift.
- **Phase 2 gate run**: the observation-log e2e (4/4) and smoke passed.
- **Manual checks**: 1.5 was confirmed by the user. 2.9–2.11 were run with a throwaway Playwright script against a local preview on local Supabase, with screenshots, per the user's standing instruction.
- **Skyfield fixture**: regenerated independently; identical except `generatedAt`.
- **Trigger**: exercised live in a transaction that was rolled back: insert and update both ways, the rejection cases, and a rating-only update.
- **Islands**: bundle trace is clean. No runtime engine or astronomy-engine import reaches an island.

## Findings

### F1 — New coordinate-handling engine modules not guarded against console logging

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/engine/planets.ts:52, src/lib/engine/planet-ranking.ts:1
- **Detail**: `planetTracks` and `rankPlanets` take a `Site` (latitude and longitude). `src/lib/engine/**` isn't in `gearConfig.files`, and `purity.test.ts` doesn't forbid `console`, so nothing enforces the coordinate-privacy NFR for them. This breaks lessons.md rule 1. The gap is older (`sun.ts`, `objects.ts`), but this change widens it. Adding `src/lib/engine/**` to the lint globs would also turn the 2 `no-console` warnings in `determinism.test.ts` into errors.
- **Fix**: Add a `console.` pattern to `purity.test.ts`'s forbidden list, which covers engine source (not tests) with one line.
- **Decision**: FIXED: `console.` pattern added to purity.test.ts FORBIDDEN (break-checked: a planted console.log went red)

### F2 — Planet tracks cost ~3 ms warm / ~10 ms cold per render (forward risk for Phase 3)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/engine/planets.ts:61-66
- **Detail**: Warsaw 2026-10-10 has a civil window of about 13 h at a 10-minute step. Across 7 planets that is 553 `Equator(ofdate, aberration)` + `Horizon` calls: measured at 10.5 ms cold and 3.0–3.3 ms warm. The Workers Free CPU cap is 10 ms (#22, infrastructure.md risk #1). It isn't live yet; Phase 3 wires it into `/tonight`.
- **Fix A ⭐ Recommended**: Keep the code and make Phase 3's CPU re-measurement a cold-isolate measurement. If it's close to the cap, use the plan's fallback (a 20-minute step) or the hourly-`Equator` idea in Fix B.
  - Strength: The plan already says "coarsen before optimising". It avoids optimising before there's a real measurement.
  - Tradeoff: Phase 3 might need a follow-up edit to the engine.
  - Confidence: MED — the cold figure includes JIT warm-up, which the whole Tonight render pays once anyway.
  - Blind spot: No measurement yet on a real Worker with the deep-sky ranking included.
- **Fix B**: Compute `Equator` hourly, interpolate RA/Dec over the 10-minute grid, and then only `Horizon` each sample.
  - Strength: About 6× fewer `Equator` calls. Planets move well under 0.01° per hour in RA/Dec, so accuracy stays within the Skyfield test.
  - Tradeoff: More engine code now, before we know it's needed.
  - Confidence: HIGH that it stays accurate (the Skyfield test would catch drift).
  - Blind spot: `Horizon` itself is part of the cost, so the saving may be less than 6×.
- **Decision**: ACCEPTED via Fix A: Phase 3's CPU re-measure (3.10) must include a cold isolate; fall back to a 20-min step or hourly Equator interpolation only if near the cap

### F3 — An app rollback past this change shows planet rows as "Mnull"

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260930120000_observation_target.sql:30
- **Detail**: After planets are logged, a code-only rollback (`wrangler rollback`) leaves the old app rendering `messier = null` rows as "Mnull", with a "null" field in the edit form. There's no data loss and no crash, and the forward path is safe. The plan's Migration Notes say the old app would show planet rows "as unknown", which understates it.
- **Fix**: Correct the plan's Migration Notes to say "Mnull" and add: hold the contract migration until no rollback to the pre-target app is possible.
- **Decision**: FIXED: plan Migration Notes corrected (Mnull on rollback; contract step waits until no rollback is possible)

### F4 — The `listForRanking` DB test depends on the database collation

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/db/observations.test.ts (listForRanking order case), src/lib/observations/store.ts:254
- **Detail**: `.order("target")` follows the DB collation. The test hard-codes the en_US order `jupiter, M13, M2, M31`, which is wrong under `C`. Production is unaffected, because `seenSummaries` doesn't depend on order.
- **Fix**: Assert the order across nights, and compare the within-night targets as a set.
- **Decision**: FIXED: within-night order compared as a set; night order still asserted

### F5 — Fixtures README states the wrong Skyfield tolerance

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/engine/fixtures/README.md:105
- **Detail**: It says positions are checked "within `ALTITUDE_TOLERANCE_DEG`" (1°). The test uses `SKYFIELD_TOLERANCE_DEG = 0.05`, which was tightened after the break check.
- **Fix**: Update the one line to 0.05° and give the reason.
- **Decision**: FIXED: README states the 0.05° Skyfield tolerance and why

### F6 — Log copy still Messier-only; Polish notice uses the wrong case for planet names

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/i18n/messages/{en,pl}.ts (`log.manualIntro`, `log.picker.placeholder`, `log.picker.noMatch`, `log.objectNotFound`, `log.notice.*`)
- **Detail**: The picker intro reads "Wybierz dowolny obiekt Messiera" / "any Messier object", although the picker now finds planets. The Polish notice reads "Zapisano obserwację Saturn" (the object noun is in the nominative, and it should be genitive: "Saturna"). This was seen in the manual-check screenshots. Phase 2 was scoped to the contract, not copy.
- **Fix**: Reword the four Messier-only strings in EN/PL. Rephrase the PL notices so the name needs no inflection, e.g. "Zapisano obserwację: Saturn".
- **Decision**: FIXED: EN/PL picker, intro and not-found copy include planets; PL titles/notices/confirm use a colon form, so names need no inflection
