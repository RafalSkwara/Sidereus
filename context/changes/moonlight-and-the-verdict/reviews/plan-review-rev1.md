<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Moonlight and the Verdict

- **Plan**: `context/changes/moonlight-and-the-verdict/plan.md`
- **Date**: 2026-10-02
- **Phases**: 4
- **Findings**: 2 critical · 6 warnings · 1 observation
- **Overall**: REJECTED → user chose re-plan; revision 2 of plan.md addresses every finding (not yet re-reviewed). Phase 1's scoring model fails when run; phases 2–4 need sharpening, not re-planning.

## Verdicts

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Claim Accuracy | WARNING | F2, F7 |
| Substance | WARNING | F5 |
| Feasibility | FAIL | F1, F2 |
| Sequencing | WARNING | F3, F8 |
| Architecture Fit | WARNING | F7 |
| Scope Discipline | PASS | — |
| Verifiability | WARNING | F2 |
| Coverage | WARNING | F4, F5, F6, F9 |

**Commands checked:**
- `npm test` passed (485 tests).
- `npx astro check` reported 0 errors.
- `lint`, `build` and `test:e2e` exist in package.json, and Playwright 1.55 is installed.
- e2e needs a preview, local Supabase and the forecast fixture. That setup is not written in the plan (F9).

**Evidence base:** a throwaway harness ran the plan's own model and candidates against the real engine: Warsaw, 150 mm, Bortle 6, K&S with k 0.25, T 3.5, ramp 1.5 and core offset 2.0. It lives in the scratchpad at `h/moon.spec.ts`.

## Findings

### F1 — The graded moon component reverses the full-Moon ranking

- **Severity**: ❌ CRITICAL · **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding · **Dimension**: Feasibility
- **Location**: Phase 1 §3, Implementation Approach, washed-out rule
- **Detail**:
  - Diffuse objects get `clamp01((T−Δ)/ramp)`. Clusters keep the old `1 − illum × moonUp`, which is about 0.02 under a full Moon. That puts two different scales in one component.
  - **High-surface-brightness galaxies and planetary nebulae jump to moon = 1.0 while clusters stay at 0.02.**
  - Harness results:
    - 2026-10-24: the top 5 goes from M31, M34, M45, M52, M39 to M31, M81, M32, M76, M82, and cleared rises from 18 to 35.
    - 2026-10-26: the top 5 becomes M81, M32, M31, M76, M82.
  - That is the opposite of the plan's own expected outcome: "demotes galaxies, keeps clusters".
  - Δ also includes the dark-sky term, so faint galaxies lose points with no Moon at all (cleared falls from 66 to 63 on new-moon 10-10). This double-counts the Bortle sky penalty.
- **Fix**:
  - Re-plan Phase 1's scoring. The moon component should measure only the Moon's effect, on one scale for every object. For example, use the Moon-induced loss of contrast (Δ with the Moon minus Δ without), weighted by a per-type moonlight sensitivity: diffuse high, clusters low. Keep the washed-out flag as the separate "hide" rule.
  - Strength: no regime split and no double counting with Bortle; clusters and galaxies are compared fairly.
  - Tradeoff: one more design decision, and the checkpoint has to validate it.
  - Confidence: HIGH, because it was measured in the harness.
  - Blind spot: whether one sensitivity per type is enough for bright-core galaxies.
- **Decision**: RE-PLANNED (revision 2): single-scale moon score (Moon brightening × type sensitivity), calibrated in calibration-harness.md

### F2 — The thresholds don't produce the plan's expected outcomes, and tests pin objects by name

- **Severity**: ❌ CRITICAL · **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it · **Dimension**: Feasibility / Verifiability / Claim Accuracy
- **Location**: Phase 1 §4 tests, Phase 1 manual 1.4, Phase 3 §5, Key Discoveries, Current State
- **Detail**:
  - The spot values in Key Discoveries (M33 6.0, M101 6.2) leave out the 2 mag core offset the plan then applies.
  - With the offset, the minimum Δ over each best window was:

    | Object | 10-24 | 10-26 |
    | --- | --- | --- |
    | M33 | 3.21 → **not washed out** | 3.56 → washed out, margin 0.06 |
    | M101 | 3.04 → not washed out | 3.26 → not washed out |

    M101 is circumpolar in Warsaw, so altitude isn't the cause.
  - Meanwhile M43, M74, M16 and M89/M91 are washed out. M16's cluster actually survives moonlight.
  - 2026-10-24 is 97% lit; full Moon is the 26th.
  - "M33 in the top 5 at full Moon" is wrong: the M-1 checkpoint has it #6 (`checkpoint.md:261`).
  - M57 was already absent on Night 2 because of its duration score (`:173`).
- **Fix**:
  - Make Phase 1 calibrate first: run the harness, then fix the expected outcomes.
  - Unit tests assert properties instead of names: monotonic in separation and phase, clusters exempt, the Moon term zero below the horizon, plus one wide-margin case.
  - Give the checkpoint a bounded tuning range, for example T 3.0–4.0 and core offset 0–2, so tuning can't turn into fitting to a target.
  - Correct the M33 and date claims.
- **Decision**: RE-PLANNED: calibrated candidates (T 3.5, offset 1.5, ref 1.5); property tests + bounded tuning; M33/date claims corrected

### F3 — Phase 1 alone ships an unexplained, shrunken list

- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped · **Dimension**: Sequencing
- **Location**: Phase 1 vs Phase 3
- **Detail**:
  - Phase 1 drops washed-out objects, while the "N washed out" line and the `/tonight/all` group only arrive in Phase 3.
  - The phase note says the user checks after merge, so Phase 1 can reach production on its own.
  - `reason.moon` ("N% clear of moonlight", `format.ts:199`, `en.ts:592`) would then describe a different quantity.
- **Fix**: Move `washedOutCount`, the ranking line, the `/tonight/all` group and the `reason.moon` rewording into Phase 1. Or ship the flag without excluding objects until Phase 3.
- **Decision**: FIXED in revision 2: count line, /tonight/all group and reason.moon rewording moved into Phase 1

### F4 — The verdict-word rename misses readers and states

- **Severity**: ⚠️ WARNING · **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it · **Dimension**: Coverage
- **Location**: Phase 3 §2–3
- **Detail**:
  - `verdict.level` is read by `VerdictCard.astro:55`, `NightStrip.astro:57`, `AllObjectsContent.astro:80` and `Welcome.astro:12-14` (the landing legend). `nextNight.level` is read by `format.ts:296` and `:492`.
  - Only the sky card branches on no-darkness, so the strip and all-objects would print **"Cloudy" on no-darkness nights**.
  - No-weather-data, humidity-cap and fallback-cap are all `marginal` (`verdict.ts:78-101`). A night with **no forecast** would therefore headline "Partly clear".
  - Other gaps:
    - `tonight.card.noDarkWindow` already exists (`en.ts:385`).
    - "Next clear night" is wrong when that night is only partly clear.
    - The landing alt text says "a Go verdict" (`en.ts:87`), and the `public/landing/tonight.png` screenshot goes stale.
    - The roadmap's S-07 match definitions use go/marginal/no-go (`roadmap.md:182,191`).
    - `VerdictCard` receives only `level` and `text`, so it needs the reason kind.
- **Fix**:
  - Define the headline from level **and** reason: no-darkness → "No dark window"; no-weather-data → "No forecast"; humidity-cap → "Clear, but damp" (or similar).
  - Apply it everywhere a level is shown: the sky card, the strip, all-objects, the landing legend and the next-night line.
  - Re-capture the landing screenshot, and add an S-07 note in the roadmap.
- **Decision**: FIXED in revision 2: skyHeadline(level + reason) for every reader (Phase 3), PRD/roadmap notes, landing re-capture

### F5 — The Moon card's path matrix is undefined

- **Severity**: ⚠️ WARNING · **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it · **Dimension**: Substance / Coverage
- **Location**: Phase 3 §1, Desired End State
- **Detail**:
  - On a cloudy no-go night `ranking` is null (`build.ts:394-397`), so the "K hidden" count of `faintText` can't be computed.
  - No `faintText` variant exists for a cloudy night, a no-darkness night, or a bright Moon with K = 0.
  - `target` today needs the planet window to pass and uses its clear-hour masking (`build.ts:439-495`), but the plan doesn't say whether that gate stays.
  - `upText` and "sets at 01:30" are said to come from the precomputed states, but `MoonDiscState` is site-independent with no altitude, so the states can't supply them.
  - Nothing says what happens when the civil window is also missing at high latitude, or when `view` is null.
- **Fix**:
  - Write the per-path matrix: cloudy, no-darkness, no forecast, new Moon, bright Moon with K = 0, high latitude, no view.
  - Source `upText` and the set time from `moonTrack` / `moonFreeMinutes` on the window.
  - Keep `target` behind the solar-system gate.
  - Build `moonCard` outside the solar-system try/catch, in its own.
- **Decision**: FIXED in revision 2: Moon-card per-path matrix; upText from moonTrack/moonFreeMinutes; own try/catch (Phase 4)

### F6 — The washed-out list never reaches `/tonight/all`

- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped · **Dimension**: Coverage
- **Location**: Phase 1 §3 → Phase 3 §1/§3
- **Detail**: `rankObjects` returns `washedOut`, but `TonightRanking` only gains `washedOutCount` and `washedOutText`. Also, `AllObjectsContent` shows its empty card when `rows.length === 0`, which hides the group exactly when everything is washed out.
- **Fix**: Add `ranking.washedOutEntries` (id, name, window) to the view. Render the group independently of `rows`, and define whether the heading count includes it.
- **Decision**: FIXED in revision 2: washedOutEntries in the view; group rendered independently of rows (Phase 1)

### F7 — Phase 2 API and orientation details are wrong or missing

- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped · **Dimension**: Claim Accuracy / Architecture Fit
- **Location**: Phase 2 §1–3, Phase 1 §2, Phase 4 §2
- **Detail**:
  - `Equator(...)` requires an observer and is topocentric (`astronomy.d.ts:690-718`). The geocentric form is `GeoVector` + `EquatorFromVector`, as `moon.ts:63-66` uses.
  - χ − P is measured from lunar north towards *celestial* east (the left). The contract's "towards lunar east" is mislabelled. The invariants themselves are right, but tests with synthetic angles would share the same convention error.
  - The phase name needs the elongation band, which the island can't compute. Add `band` or `elongationDeg` to the state.
  - `MoonDiscState` should live in `src/lib/moon-disc/`, so the island never type-imports the engine.
  - `src/lib/moon-disc/` is outside `purity.test.ts`.
  - `minorAxisArcmin` is null for 62 objects, including M27, M57, M76 and M97, so `objectSurfaceBrightnessV` needs b = a when it is missing.
  - `RankableObject` (`ranking.ts:31-34`) also needs `minorAxisArcmin`.
- **Fix**:
  - Use `GeoVector` + `EquatorFromVector`, and fix the angle wording.
  - Add a coupled test: on a real waxing-crescent engine state, Crisium lies inside the lit path.
  - Add `band` to the state and move the type into `src/lib/moon-disc/`.
  - Extend the purity guard to that directory.
  - State the b = a fallback, and add `minorAxisArcmin` to `RankableObject` and the test fixtures.
- **Decision**: FIXED in revision 2: GeoVector+EquatorFromVector, angle wording, band in state, type in src/lib/moon-disc, purity extended, b = a fallback, RankableObject

### F8 — Phase 3 is too big

- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped · **Dimension**: Sequencing
- **Location**: Phase 3
- **Detail**: Phase 3 holds build, copy, six components, the PRD note, unit tests, e2e and a 12-shot screenshot matrix, and with F4 it grows further.
- **Fix**: Split it into **3 "Sky wording everywhere"** (F4 scope plus the PRD and the roadmap S-07 note) and **4 "Moon card"** (the card, the SVG and the faint line), then **5 "Time slider"**. Renumber Progress, which is allowed because no row is checked yet.
- **Decision**: FIXED in revision 2: split into 5 phases (sky wording / Moon card / slider)

### F9 — Removal, e2e and setup touch-lists are not spelled out

- **Severity**: 💬 OBSERVATION · **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped · **Dimension**: Coverage
- **Location**: Phase 3 §5, Phase 4
- **Detail**:
  - **Removal touch-list:**
    - `brightMoonText` and `moonNote`: `build.ts:9,266-270,310,536-555,577`, `VerdictCard.astro:22-34,59`, `TonightContent.astro:149`;
    - `format.ts:520-527,555`, `format.test.ts:100-108`, about 8 tests in `build.test.ts:894-1020`;
    - `en.ts:387-399`, `pl.ts:400-406`;
    - `isBrightMoon` / `BRIGHT_MOON_*` (keep or remove).
  - **E2E follow-ups:**
    - `moon-as-target.spec.ts:31-37` is scoped to the solar-system section with h3, and skips on the card's existence. It should key on the target.
    - `planets-on-tonight.spec.ts:29,35-41` needs the heading and its skip updated.
    - `seven-night-planner.spec.ts:107-112` passes, but fragilely.
  - **E2E setup is not written down:** the fixture on :4400, `FORECAST_BASE_URL` in `.dev.vars`, rebuild, preview. See `.github/workflows` lines 51–70.
  - **PRD:** it has no changelog section, only `version: 2` and inline "> Resolution" notes.
  - **S-02 path:** it becomes `context/archive/2026-10-01-moon-as-target/` once PR #78 merges.
- **Fix**: Add these touch-lists and the e2e setup to the relevant phases. Use the PRD's inline "> Resolution" note style instead of a changelog.
- **Decision**: FIXED in revision 2: removal touch-list, e2e follow-ups, e2e setup and PRD inline-note style written into the phases
