# Phase 3 evidence: Caldwell objects on Tonight

Run on 2026-10-06 against the local preview (build of this phase), local Supabase and the forecast fixture. The user was onboarded in Madrid with a 150 mm reflector.

## Gates

- vitest: 74 files, 793 passed, 6 todo.
- `astro check`: 0 errors.
- eslint (`--ignore-pattern '.claude/**'`): 0 errors.
- `npm run build`: OK; `sw.js` precaches 47 files. The `TonightSkyView` import guard passes.
- **Full e2e: 29 passed, 2 skipped, 1 failed.** The failure is `tonight-targets.spec.ts:25`, at its "Mark observed" step. Today the 3rd row in the rest list is a Caldwell object, and its link `/log/new?object=NGC…` lands on "Sidereus doesn't know that object", because the log grammar only widens in Phase 4.
  - This is the Phase 3 → Phase 4 coupling the plan calls out ("never deploy Phase 3 without Phase 4").
  - Progress 3.3 stays open until the full e2e suite passes after Phase 4.

## Manual checks run by the agent

- **3.4:** 36 screenshots in `phase-3/`: `/tonight`, `/tonight/targets` and `/tonight/plan` × EN/PL × dark/light/red × 390 px/1280 px. On 6 Oct 2026 in Madrid the Double Cluster ranks #2.
  - **Targets:** "2. NGC 869 / 884 · Gromada podwójna w Perseuszu" with "Caldwell 14 · gwiazdozbiór Per". On Messier rows the constellation sits right of the heading; on this row the longer heading pushes the line below it. That is the row's ordinary wrapping, not a new layout.
  - **Dashboard:** the "Point here first" tile lists "Gromada podwójna w Perseuszu 03:33".
  - **Plan:** the row "NGC 869 / 884 · Gromada podwójna w Perseuszu" wraps over 3 lines at 390 px in PL and stays readable.
  - **Red mode:** no colour leaks.
- **3.5:** on the dashboard, the Caldwell sky marker `#object-NGC869` opened `/tonight/targets#object-NGC869`, and the row scrolled into the viewport (`marker-scroll-NGC869.png`).

## Behaviour change

On 1 Sep 2026 (Warsaw, the night `build.test.ts` uses), the Moon card on the real catalogue now reads "Bright Moon: 1 faint object washed out tonight" (one washed-out object, NGC 4236, C 3, a diffuse galaxy at V 9.77) instead of "Moonlit sky · no faint objects lost". This is the correct consequence of the bigger catalogue, not a regression. The build test at `build.test.ts:1050-1057` is pinned to `catalogue: MESSIER` so the "Moonlit sky" copy branch stays covered. Production's catalogue is therefore not tested for that night. Verified with a scratch run (since deleted) of the same night against the full catalogue.
