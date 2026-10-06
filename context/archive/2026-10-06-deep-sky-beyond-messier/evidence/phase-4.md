# Phase 4 evidence: logging Caldwell objects

Run on 2026-10-06 against local Supabase, with migration `20261006190000_observation_target_deep_sky.sql` applied through `npx supabase migration up`, a fresh `npm run build` of this phase served by the preview, and the forecast fixture.

## Gates

- `test:db`: 4 files, 113 passed.
- `db:types`: no diff.
- vitest: 807 passed, 1 skipped (the opt-in calibration snapshot), 6 todo.
- `astro check`: 0 errors.
- eslint: 0 errors.
- Build: OK.
- **Full e2e: 31 passed, 2 skipped, 0 failed.** This includes `tonight-targets.spec.ts`, which failed in Phase 3 on the Caldwell row, and the new "c 20" manual-log case. **Progress 3.3 is therefore ticked with this phase's commit.**
- smoke: all steps passed.
- Break check: making `isKnownTarget` return true for every key turned 2 tests red; the file was restored.

## Adaptation made by the main agent after the subagent handed back

Picker option order is now Messier, the Moon, the planets, then Caldwell (the plan said Caldwell before the Moon). With Caldwell before the planets, typing "jupiter" in English put NGC 3242 ("Jupiter's Ghost") above the planet. Caldwell options now come last, so the Moon and the planets keep winning their own names. Tests pin this: "jupiter" and "jowisz" give the planet first.

**Correction to plan §3:** the catalogue has no NGC 2244. C 50 is NGC 2239, so "ngc 224" returns only M31. A "ngc 22" case pins the order: exact match first, then prefix matches ascending.

## Manual checks run by the agent

- **4.6:** 41 screenshots in `phase-4/`.
  - The picker for "ngc 7000", "c 20" and "ic 405" × EN/PL × dark/light/red × 390 px/1280 px. The first option for each query is: "NGC 7000 · North America Nebula / Caldwell 20 · Cyg" (for both "ngc 7000" and "c 20") and "IC 405 · Flaming Star Nebula / Caldwell 31 · Aur".
  - The `/log` row "NGC 869 / 884 · Gromada podwójna w Perseuszu" fits at 390 px in PL.
  - The landing kicker "Messier i Caldwell · twoje niebo, twój sprzęt" fits on one line at 320 px.
- **4.7:** on `/tonight/targets`, "Mark observed" on the Caldwell row NGC869 saved, returned to `/tonight/targets?logged=NGC869` with the notice "NGC 869 / 884 logged.", and the row shows "Seen 1 time – last 6 Oct 2026" (`mark-observed-return-NGC869.png`).
