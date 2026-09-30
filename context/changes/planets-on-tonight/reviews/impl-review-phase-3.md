<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Planets on Tonight

- **Plan**: context/changes/planets-on-tonight/plan.md
- **Scope**: Phase 3 of 3
- **Reviewed phases**: 3
- **Date**: 2026-09-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 7 observations

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
- **Contract and scope:** there is no contract drift, and the plan's exclusions ("What We're NOT Doing") were respected. All six known adaptations were judged sound.
- **Automated checks:** `npm test`, `astro check`, `lint`, `build`, the full e2e suite and smoke passed at the gate. Main CI on merge 245b96c also passed (ci, smoke, migrate, deploy).
- **Manual checks:** 3.7–3.9 are covered by screenshots, including a live twilight-only forecast. 3.10 was superseded by the move to Workers Paid.
- **Safety:** no XSS or coordinate leaks. Theme tokens only. Heading and list semantics are correct.
- **Probes:** throwaway vitest probes against the real `buildTonight` confirmed F1 and F2.

## Findings

### F1 — Planets recommended at hours that are overcast

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/build.ts:367-377
- **Detail**: The planet verdict passes if any single clear hour falls in the civil window (`marginalRunHours` = 1), but `rankPlanets` ranks over the whole window. Probe: Warsaw on 2026-10-10, with 100% cloud over the dark window and 5% in twilight. Saturn shows "Well up around 23:56" and Neptune "around 23:26", both under full cloud. The unit test only asserts `entries.length > 0`.
- **Fix A ⭐ Recommended**: When the planet window only passes because of twilight (the main verdict is no-go or there is no dark window), take each planet's best window within the clear stretches. Drop planets that don't overlap them, and name the clear stretch in the weather line.
  - Strength: The card never sends a beginner out under cloud, which is the product's core promise. The existing verdict code already finds clear runs.
  - Tradeoff: A new helper (clear intervals from the hourly forecast) plus rework of `bestWindow` input, `build.ts` and tests.
  - Confidence: MED — the verdict helpers need checking for a reusable "clear run" output.
  - Blind spot: The humidity cap and the fallback forecast paths.
- **Fix B**: Keep the ranking and only add the clear stretch's times to the weather line ("clear 19:00–20:00").
  - Strength: Small change.
  - Tradeoff: The cards still name best times under cloud, and the user has to reconcile the two.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A: on twilight-only nights, planets are ranked only inside the clear hours (`clearIntervals` + `rankPlanets({ visibleIntervals })`). The weather line names the clear hours. Break check: removing the mask turned 2 tests red.

### F2 — Morning planets roll over to tomorrow just when they're best

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/build.ts:277 (`tonightDateFor`, dark threshold), src/lib/tonight/load.ts:156
- **Detail**: Tonight moves to the next evening when the **dark** window ends. Morning planets peak in the civil twilight after that. Probe: at 03:45Z on 2026-10-11 (05:45 in Warsaw), Tonight is already 2026-10-11, so "Mark observed" on Jupiter prefills `night=2026-10-11` for something seen on the night of the 10th. The plan accepted "not showing morning planets after dark ends", but this log-date consequence wasn't considered.
- **Fix A ⭐ Recommended**: Roll Tonight over at civil dawn (`PLANET_WINDOW_SUN_ALTITUDE_DEG`) instead of astronomical dawn. Add a unit test for a `now` between the end of the dark window and civil dawn.
  - Strength: The night being observed stays on screen until the sky is actually light. The log date is right.
  - Tradeoff: For about 1–1.5 h before dawn, the deep-sky part shows a dark window that has already ended, where it used to show the next evening.
  - Confidence: MED — `tonightDateFor` is shared with `/tonight/all` and the log default night (`tonightDateForSite`). All of them should move together.
  - Blind spot: How the seven-night strip labels "tonight" during that stretch.
- **Fix B**: Accept it. The log form lets the user change the night.
  - Strength: No change.
  - Tradeoff: The planet flow's key moment prefills the wrong date.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A: Tonight and the log roll over at civil dawn (`TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG = -6`). Tested at 03:45Z in Warsaw (the log link carries the night in progress). Break check: the old threshold turned it red. CLAUDE.md engine note updated.

### F3 — Log, eyepiece and no-eyepieces notices hidden on planet-only nights

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TonightContent.astro:148-216
- **Detail**: `logError`, `eyepiecesError` and the no-eyepieces prompt render only inside `{view.ranking && …}`. On a cloudy no-go night or a no-darkness night the planets still show, but Seen tags or eyepiece lines disappear with no explanation. This breaks load.ts:54's "shown with this notice" contract.
- **Fix**: Render the three notices above both sections, whenever planets or the ranking are shown.
- **Decision**: FIXED: the log, eyepiece and no-eyepieces notices render once, above both sections. telescope-selector e2e updated.

### F4 — A throw in the planet branch fails the whole Tonight island

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/build.ts:366-397
- **Detail**: There is no local catch. Any throw replaces the verdict, ranking and strip with `tonight.failed`, and does so on every render for that site. No throwing input was found.
- **Fix**: Wrap the planet block so a failure degrades to `planets = null`.
- **Decision**: FIXED: the planet branch is wrapped. A throw gives `planets = null`, with no logging. Tested with a mocked `rankPlanets` that throws.

### F5 — Planet weather line hidden when the dark verdict passes but the planet verdict is worse

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/build.ts:381
- **Detail**: Probe: 95% humidity only in evening twilight. The main card says "go", the planet verdict is a humidity-capped marginal, and `weatherText` is null. Evening twilight is exactly when Mercury and Venus show.
- **Fix**: Set `weatherText` whenever the planet verdict's level differs from the main verdict's, as well as in the current cases.
- **Decision**: FIXED: `weatherText` is also set when the planet level differs from the card's. Break check turned it red.

### F6 — Polish copy: accessible link name in the wrong case, and three awkward notes

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/PlanetCard.astro:64, src/i18n/messages/pl.ts:437,474,477,480
- **Detail**:
  - The screen-reader suffix reads "Zapisz obserwację Jowisz". The name should be in the genitive, "Jowisza", or the phrase needs a colon form. The comment at pl.ts:437 claiming no case is needed is wrong.
  - Mercury: "nisko w zmierzchu" is awkward and means evening only.
  - Jupiter: "z … pasami i do czterech księżyców" mixes cases.
  - Uranus: "ale bez żadnych szczegółów" doesn't attach to anything.
- **Fix**: Use the colon form "Zapisz obserwację: Jowisz" and fix the comment. Rewrite the three notes: "nisko nad horyzontem o zmierzchu lub o świcie", "…i nawet czterema księżycami ustawionymi w linii obok", "…ale nie widać na niej żadnych szczegółów".
- **Decision**: FIXED: the PL accessible name uses `aria-label` 'Zapisz obserwację: Jowisz'. Mercury, Jupiter and Uranus notes rewritten. Comment corrected.

### F7 — No test for the empty-planets state, and the "none" line misleads with ice giants

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/i18n/messages/en.ts:432, src/lib/tonight/build.test.ts, tests/e2e/planets-on-tonight.spec.ts:30-34
- **Detail**:
  - Nothing tests `planets.entries === []` or the "none" line.
  - The line says "No planet rises above your minimum altitude" even when Uranus or Neptune are up but gated out by aperture.
  - The e2e test skips itself when no planet is up, which is acceptable with a real clock.
- **Fix**: Add a build test for the empty case, and reword the line so it no longer rules out planets hidden by the aperture gate: "No planet is placed for your telescope between dusk and dawn tonight."
- **Decision**: FIXED: `noneText` in the view model, with a separate cloud-limited line. EN/PL reworded, with empty-state build tests.

### F8 — /tonight/all computes planets it never shows

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/load.ts:125, src/components/tonight/AllObjectsContent.astro
- **Detail**: About 2.3 ms warm is spent per /tonight/all render. The CPU pressure is gone on Workers Paid.
- **Fix**: Skip it. If it ever matters, add a `planets: false` build option.
- **Decision**: ACCEPTED: negligible on Workers Paid.

### F9 — Polar night reads "From civil dusk to dawn, 12:00–12:00"

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/format.ts (`planetWindowText`)
- **Detail**: When the window is clamped (there is no civil dusk at polar sites), the text claims a dusk and dawn. The existing `darkSpanText` has the same pattern.
- **Fix**: Accept it for now. Polar sites are out of scope.
- **Decision**: ACCEPTED: polar sites out of scope.

### F10 — PlanetCard duplicates ObjectDetails' window/best list and log link

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/PlanetCard.astro:33-66, src/components/tonight/ObjectDetails.astro:17-54
- **Detail**: The markup is copied rather than shared, so later edits must be made in both files.
- **Fix**: Accept it for now. Extract a shared piece when S-02 (the Moon card) needs the same block a third time.
- **Decision**: ACCEPTED: extract a shared block with S-02 (Moon card).
