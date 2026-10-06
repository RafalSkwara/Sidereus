<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Gear catalogue (S-12)

- **Plan**: `context/changes/gear-catalogue/plan.md`
- **Date**: 2026-10-06
- **Phases**: 5
- **Findings**: 0 critical, 9 warnings, 1 observation (it bundles several minor items)
- **Overall**: NEEDS ATTENTION

Evidence: two Opus review agents, one for claim verification and one for feasibility and sequencing. Commands checked:
- `npm test`, `lint`, `build`, `test:db` and `test:e2e` all resolve.
- Vitest 5.0.1 runs `target-search.test.ts` and `presets.test.ts` (13 passed).
- `playwright test --list tests/e2e/onboarding.spec.ts` lists 3 tests.

## Verdicts

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Claim Accuracy | WARNING | F1 |
| Substance | WARNING | F1, F3 |
| Feasibility | PASS | |
| Sequencing | WARNING | F5 |
| Architecture Fit | WARNING | F1, F2 |
| Scope Discipline | PASS | |
| Verifiability | WARNING | F4, F5, F6, F8 |
| Coverage | WARNING | F7, F9, F10 |

## Findings

### F1 — The Combobox contract is missing the props phases 3–4 rely on

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Substance / Architecture Fit
- **Location**: Phase 1 §1–2
- **Detail**:
  - No signal for a failed load. `options: undefined` can only mean loading.
  - The parent can't clear the text. `TargetPicker` holds its text internally (`TargetPicker.tsx:35-36`), but Critical Implementation Details needs "picking a generic type clears the combobox text".
  - `searchCatalogue<T extends {name; aliases?}>` ranks by brand or model, but neither field is in its type.
  - Only the error is wired into `aria-describedby` (`:109`). The hint isn't.
  - `TargetPicker` imports `FieldError` from `forms/` (`:3`). Placing the component in `ui/` would make `ui` depend on `forms`, the reverse of today's direction.
  - The list must keep `bg-surface` (`:139,173`) so the log picker looks the same.
- **Fix**:
  - Put the component in `src/components/forms/Combobox.tsx`.
  - Add `state: "loading" | "ready" | "unavailable"`.
  - Make the text controllable (`text` / `onTextChange`, or a documented `key` remount).
  - Rank on `name` (brand and model are its prefix).
  - Wire both the hint and the error ids into `aria-describedby`.
  - Keep `bg-surface`.
  - Strength: matches `forms/` and `ChoiceCard`; every later phase has the props it needs.
  - Tradeoff: a slightly wider props surface.
  - Confidence: HIGH.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all")

### F2 — `/design` can't hydrate a combobox that takes function props

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Architecture Fit
- **Location**: Phase 1 §4, manual 1.4
- **Detail**: Astro can't serialise function props (`filter`, `getKey`, `onSelect`, and so on) into a `client:load` island. Every hydrated island in `design.astro` takes only serialisable props (`:1232-1238`). The hover and focus cells also need a forced open state and active row.
- **Fix**: Add a `src/components/design/ComboboxDemo.tsx` island that owns sample options and functions, plus `defaultOpen` / `defaultActive` props for the static state cells.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all")

### F3 — Onboarding state model is under-specified

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Substance
- **Location**: Phase 4 §1–2, Critical Implementation Details
- **Detail**:
  - `telescopeId` is a non-null `TelescopePresetId` (`OnboardingWizard.tsx:128`).
  - `EyepieceKitPresetId` is derived from the const `EYEPIECE_KIT_PRESETS` array (`presets.ts:56-62`). A `bundled` entry in that array would render with a string label, and `kitPreset()` falls back to `pair`.
  - `kitRow` accepts only Plössl preset keys (`:98-106`).
  - "Untouched default" can't be told apart from re-picking `pair` without a flag.
  - These transitions are unspecified:
    - picking another bundled scope while "Came with" is selected;
    - falling back over edited rows;
    - the eyepiece chunk not being loaded yet.
- **Fix**:
  - Model the kit as `EyepieceKitPresetId | "bundled"`, outside the presets array, with its own card and its own `rows` builder from `eyepieceFill`.
  - Make `telescopeId` nullable.
  - Add a `kitTouched` flag.
  - Spell out the transitions:
    - another bundled scope replaces the rows while the kit is still `bundled`;
    - falling back to `pair` replaces the rows, as `chooseKit` does today;
    - the "Came with" card shows only once the eyepieces have loaded.
  - Strength: no change to the preset tests or to FR-006's fixed set.
  - Tradeoff: more wizard state.
  - Confidence: HIGH.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all")

### F4 — The phase-3 e2e keystrokes pick the second match

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Verifiability
- **Location**: Phase 3 §3
- **Detail**: Typing already highlights match 0 (`TargetPicker.tsx:116`), and ArrowDown then moves to match 1 (`:66`). Once phase 5 adds a second "Heritage 130", the test picks the wrong scope.
- **Fix**: Type, then press Enter, as `observation-log-management.spec.ts:84-86` does. Or click the option by its accessible name.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all")

### F5 — Criterion 2.3 (separate chunks) can't pass in phase 2

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Sequencing / Verifiability
- **Location**: Phase 2 Success Criteria, Progress 2.3
- **Detail**: Nothing on the client imports `load.ts` until phase 3, so Rollup emits no chunk. Vite also emits `telescopes.<hash>.js`, not `.json`.
- **Fix**: Keep the 2.3 title (the progress row) but note in Phase 2 that it is verified in phase 3. Add to phase 3: `npm run build && ls dist/client/_astro | grep -E '^(telescopes|eyepieces)\.'`, and check that the form chunks don't contain "Heritage".
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all")

### F6 — The `afovEstimated` rule can't be tested, and zoom interpolations aren't flagged

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Verifiability / Coverage
- **Location**: Phase 2 §1, §3, §4
- **Detail**:
  - Entries have no optical-type field, so "a documented type" can't be checked.
  - The rule as written would forbid flagging interpolated zoom AFOVs.
  - AFOV must be an integer (`schemas.ts:94`), so interpolations need rounding.
- **Fix**:
  - Add an optional `design` field (`plossl | kellner | huygens | orthoscopic | other`).
  - The test asserts that an estimated AFOV equals the README value for its `design`, or belongs to a zoom stop.
  - Interpolated zoom stops carry `afovEstimated`.
  - The README states the rounding.
  - Strength: every value is either sourced or visibly estimated.
  - Tradeoff: one more field to enter.
  - Confidence: HIGH.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all")

### F7 — How phase 5 curation is carried out is not planned

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Coverage
- **Location**: Phase 5 §1
- **Detail**: About 550 hand-checked entries from parallel subagents writing to one JSON file would conflict. Web access is needed. Merge order matters, because ranking falls back to catalogue order. It will take more than one session.
- **Fix**:
  - Subagents return per-brand drafts to the scratchpad. They never write the repo.
  - The main agent merges them into the two files in a fixed order (brand alphabetical, then aperture or focal length), with prettier and the test after each merge.
  - Commit after each brand group, so the work can resume across sessions.
  - Strength: no conflicts, and each step can be reviewed.
  - Tradeoff: the main agent does the merging.
  - Confidence: HIGH.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all")

### F8 — The "local preview recipe" for e2e is never spelled out

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Verifiability
- **Location**: 1.2, 3.1, 4.1, 5.3
- **Detail**: e2e needs four things: local Supabase, the forecast fixture, a build whose `dist/server/.dev.vars` points at both, and the preview. `playwright.config.ts` has no `webServer`.
- **Fix**: Under Testing Strategy, reference the "Local e2e recipe" in `context/handoff.md` (the same steps as ci.yml), with the command `SUPABASE_URL=… SUPABASE_KEY=… BASE_URL=http://localhost:4321 npm run test:e2e -- <spec>`.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all")

### F9 — The default onboarding path loses its e2e coverage

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Coverage
- **Location**: Phase 4 §3
- **Detail**: Phase 4 changes the existing test to pick Heritage, so the 150/750 + `pair` submit path is only checked manually (4.5).
- **Fix**:
  - Keep the existing default-path test, adding only the disclosure open.
  - Add the catalogue path as a separate test with its own sign-up.
  - The bundled eyepiece names must contain "25 mm" if that test reuses the `/25 mm/` targets check.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all")

### F10 — Close-out docs and small details

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Coverage
- **Location**: Phase 5 §3, Performance, Phase 2
- **Detail**:
  - Phase 5 doesn't update the roadmap S-12 status, `context/handoff.md` or board #113.
  - The service worker precaches every `_astro/*.js` file (`scripts/build-sw.mjs:49`), so every install downloads both catalogue chunks. This should be noted.
  - Detail numbers need locale formatting through `Intl.NumberFormat`, as at `OnboardingWizard.tsx:117`.
  - The f/3 lower bound excludes RASA/Hyperstar astrographs. That's fine, but say they are out of scope.
  - The README needs a name-abbreviation rule for the 60-character limit.
  - Precedent names the licence file `LICENSE-DATA.md`.
  - "Hidden inputs only" is loose: the radios post too, though nothing reads them.
- **Fix**: Fold all of these into Phase 5 §3, Performance Considerations and Phase 2 §4. Use `LICENSE-DATA.md` plus a short `README.md`.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all")
