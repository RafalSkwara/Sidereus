# Moonlight and the Verdict Implementation Plan

> Revision 2 (2026-10-02). It replaces revision 1, which the plan review rejected (`reviews/plan-review-rev1.md`). In revision 1, Phase 1's graded moon component reversed the full-Moon ranking, and its thresholds were not calibrated. This revision keeps every user decision, redesigns the moonlight scoring with numbers taken from a calibration harness (`calibration-harness.md`), folds in review findings F3 to F9, and splits the work into five phases.

## Overview

Tonight tells the truth about the Moon:

- The verdict stays a cloud forecast you can check by looking up, and is worded as one: a **"Sky tonight"** card reading Clear, Partly clear or Cloudy.
- Beside it, a **Moon card** shows a detailed SVG of the Moon at 1% resolution in map orientation. It shows the Moon as it is at page load, with a slider for any moment in tonight's window, and states what the Moon does to faint objects.
- Deep-sky objects that tonight's Moon washes out are no longer recommended. Tonight says how many there are, and `/tonight/all` lists them.

## Current State Analysis

The frame (`frame.md`) settled the problem:

| Hypothesis | Verdict | Evidence |
| --- | --- | --- |
| What the verdict means | STRONG | Clouds and humidity only (`verdict.ts:69-117`), but "Go" and "worth setting up for" in the copy (`en.ts:69, 74`) |
| What the verdict models | STRONG model / WEAK preference | One headline over per-class judgements; no preference needed |
| Ranking under moonlight | STRONG | A flat moon term ignores faintness and distance from the Moon (`score.ts:131`, #21 item 2) |
| Page layout | PARTIAL | The Moon card is text only, and there is no picture of the Moon |

Facts confirmed by the plan review (`reviews/plan-review-rev1.md`):

- **Scoring and ranking types**
  - `ScoredObject` is `Pick<MessierObject, "vMag" | "surfaceBrightness" | "type">` (`score.ts:34`).
  - `ScoreInput.moonTrack` is `Pick<MoonState, "altitudeDeg" | "illuminatedFraction">` (`:41`). `MoonState` already carries `phaseAngleDeg` (`moon.ts:31`).
  - `RankableObject` (`ranking.ts:31-34`) already has `id`, `raHours`, `decDeg` and `majorAxisArcmin`; only `minorAxisArcmin` is new.
  - `rankObjects` returns `{clearedCount, entries, telescopeId}` (`:197`).
- **Catalogue**
  - The fields are `majorAxisArcmin`, `minorAxisArcmin`, `raHours` and `decDeg` (`catalogue/index.ts:40-46`).
  - `minorAxisArcmin` is null for 62 objects, including M17, M27, M57, M76 and M97. M40 and M73 have no size.
  - M16 is typed `nebula` although its cluster survives moonlight. M42 is `cluster-with-nebula`.
- **Verdict readers**
  - `verdict.level` is read by `VerdictCard.astro:55`, `NightStrip.astro:57`, `AllObjectsContent.astro:80` and `Welcome.astro:12-14`.
  - `nextNight.level` is read by `format.ts:296` (next-night line) and `:492` (planet weather line).
  - `no-darkness` is a `no-go`. `no-weather-data`, `humidity-cap` and `fallback-cap` are all `marginal` (`verdict.ts:74-101`).
  - `tonight.card.noDarkWindow` already exists (`en.ts:385`).
- **Geocentric positions.** `Equator()` is topocentric and needs an observer. Geocentric positions come from `GeoVector` + `EquatorFromVector`, as `moon.ts:63-66` does.
- **No precedent for nested islands.** No client island exists inside the `server:defer` Tonight island today. The only `client:load` is `TopbarControls`, outside it.
- **No PRD changelog.** `prd.md` has `version: 2` and inline "> … Resolution" notes, but no changelog.

**Calibration** (`calibration-harness.md`; Warsaw, 150 mm, minimum altitude 15°, real engine). The redesigned model below, with the chosen candidates (T 3.5, core offset 1.5, moonlight reference 1.5 mag):

| Night | Before: cleared / top 5 | After: cleared / washed out / top 5 |
| --- | --- | --- |
| 10-10 new, B6 | 66 / M31 M34 M39 M45 M52 | 66 / 0 / unchanged |
| 10-10 new, B3 | 63 / M31 M34 M33 M39 M52 | 63 / 0 / unchanged |
| 10-20 69%, B6 | 53 / M31 M34 M45 M39 M52 | 65 / none / M34 M31 M45 M39 M52 |
| 10-24 97%, B6 | 18 / M31 M34 M45 M52 M39 | 42 / M33 M43 M74 M101 / M34 M45 M52 M39 M103 |
| 10-26 full, B6 | 18 / M31 M34 M45 M52 M103 | 36 / M33 M43 M74 M101 / M34 M52 M39 M45 M103 |
| 10-26 full, B3 | 21 / M34 M31 M33 M52 M45 | 27 / M33 M43 M74 M88 M89 M91 M98 / M34 M52 M39 M103 M45 |

The table includes the M16 exemption and the "Moon's fault" condition from plan review rev 2, F2: an object counts as washed out only if it would clear `MIN_OBJECT_SCORE` with its moon component at 1. Without that condition, 5 of the 10 full-Moon Bortle 6 objects (M84, M88, M89, M91, M98) were counted even though they miss the bar on a moonless night.

How to read it:
- Clusters rise under a bright Moon, which is honest: they survive moonlight.
- Invisible galaxies are hidden, while M31, M42 and M57 stay.
- New-Moon nights do not change.
- Without the exemption, M16 is wrongly washed out (its cluster is visible), hence the exempt override below.

## Desired End State

On any night, a signed-in user opens Tonight and sees two cards at the top, side by side from `md` and stacked on a phone.

**Sky tonight.** The headline is chosen from the level **and** the reason:

| Night | Headline (EN / PL) |
| --- | --- |
| go | Clear / Pogodnie |
| marginal (cloud) | Partly clear / Częściowo pogodnie |
| humidity cap | Clear, but damp / Pogodnie, ale wilgotno |
| fallback cap | Clear (old forecast) / Pogodnie (stara prognoza) |
| no weather data | No forecast / Brak prognozy |
| no-go (cloud) | Cloudy / Pochmurno |
| no-go (no darkness) | No dark window / Brak ciemnej nocy |

The thresholds are unchanged. The same headline function drives the seven-night strip, the `/tonight/all` empty state, the landing legend and the next-night line ("Next clearer night: …"). The Moon line is gone from this card.

**The Moon card.**
- A detailed SVG of the Moon, lunar north up:
  - the exact lit shape, rounded to 1%;
  - about 12 IAU maria projected with libration.
- It shows the Moon at page load, clamped into the window. A slider covers the window in 10-minute steps, and a "Now" button returns to the current moment. The window is the dark window, or civil dusk to dawn when there is none.
- Phase name and % lit follow the slider.
- Nightly facts:
  - **When it's up**, from the Moon track: "Up 22:10–06:58", "Sets 01:30", or "Not up tonight".
  - **A faint-objects line**, picked by K (the ranking's `washedOutCount`) and the Moon's up time in the window. No illumination threshold is involved (review rev 2, F3, user choice):

    | Case | Line (EN) |
    | --- | --- |
    | K > 0 | "Bright Moon (97% lit): 4 faint objects washed out tonight" |
    | K = 0, Moon up for part of the window | "Moon up 22:10–03:40 · faint objects unaffected" |
    | K = 0, Moon up the whole window | "Moonlit sky · no faint objects lost" |
    | Moon never up in the window | "Dark night: no Moon" |
    | Cloudy or no-darkness night (nothing ranked) | omitted |
- **The observing details** (eyepieces, phase note, Mark observed) appear when the Moon target passes today's solar-system gate.

**Below the cards.**
- "Planets tonight" lists planets only.
- The ranking omits washed-out objects, shows "N faint objects are washed out by the Moon tonight" linking to `/tonight/all`, and its reason phrase stops saying "N% clear of moonlight".
- `/tonight/all` shows a "Washed out by the Moon" group even when no other row clears.

### Key Discoveries:

- **Moonlit sky (Krisciunas & Schaefer 1991).**
  - Moon contribution: `B_moon = f(ρ)·I*·10^(−0.4kX(Z_m))·[1 − 10^(−0.4kX(Z))]`
    - `I* = 10^(−0.4(3.84 + 0.026|α| + 4e−9α⁴))`, multiplied by 1.35 when |α| < 7°.
    - `f(ρ) = 10^5.36(1.06 + cos²ρ) + 10^(6.15 − ρ/40)`; for ρ < 10°, `6.2e7/ρ²`.
    - `X(Z) = (1 − 0.96 sin²Z)^−½`.
  - Dark sky: `B0 = B_zen·10^(−0.4k(X−1))·X`.
  - Conversion: nL ↔ mag/arcsec² via `B = 34.08·exp(20.7233 − 0.92104V)`.
  - The Moon term is zero if either body is below the horizon.
- **The fix for revision 1's reversal.** The moon score must measure only the Moon's brightening, `m_b = 2.5·log10((B0 + B_moon)/B0)`, on **one scale for every object**, weighted by a per-type sensitivity. Revision 1 used contrast for diffuse objects and the old formula for clusters (two scales), and its Δ also included the dark-sky term, which double-counted the Bortle penalty.
- **Disc geometry (Meeus).**
  - Position angles are measured from north through east. On a north-up view of the sky, east is on the left.
  - χ is the bright-limb angle (eq. 48.5, Sun relative to Moon). P is the lunar pole angle (same formula, with the `RotationAxis(Body.Moon)` pole).
  - The angle θ = χ − P is measured from lunar north towards **celestial east (the left)**. In SVG y-down coordinates, the bright limb points to `(−sin θ, −cos θ)`.
  - Invariants: a waxing Moon has θ ≈ 270° and is lit on the right; Mare Crisium (IAU lunar east) sits at x > 0, on the right.
  - Maria use an orthographic projection with libration (l, b).

## What We're NOT Doing

- **A per-user "what I want to watch" preference or toggle.** Parked as a possible later layer.
- **Changing the verdict's thresholds or inputs.** The Moon never lowers the sky verdict.
- **Sky-oriented (zenith-up) rendering, earthshine, craters, raster textures or the LROC mare shapefile.**
- **A live clock-driven animation, or exact rise/set times from `SearchRiseSet`** (left for S-05).
- **#21 items 1, 3 and 4**: duration saturation, the aperture-aware Bortle penalty, window-edge interpolation.
- **Object extinction inside the contrast, and a separate cluster limiting-magnitude shift.** Clusters use the sensitivity weight only.
- **The landing tagline.** It stays. The landing legend and the screenshot are updated.

## Implementation Approach

The work goes inside out, in five independently mergeable phases. **Phase 1 is user-visible**, so it ships its own explanation: the washed-out line and the `/tonight/all` group (review F3).

Every number is a candidate in `parameters.ts`. The user delegated the technical choices; they were calibrated with the harness and are recorded in Key Decisions.

**Candidate parameters (calibrated values in bold):**

- `DARK_SKY_ZENITH_MAG_BY_BORTLE = [21.9, 21.7, 21.4, 20.8, 20.1, 19.3, 18.7, 18.2, 17.8]`: V mag/arcsec², following the SQM-by-Bortle convention.
- `EXTINCTION_V = 0.25`.
- `MOONLIGHT_REF_MAG = `**`1.5`**: Moon brightening (mag) at which a sensitivity-1 object's moon component reaches 0.
- `MOONLIGHT_SENSITIVITY`:
  - galaxy, nebula, emission, reflection and planetary nebulae, supernova remnant: **1**;
  - globular cluster, cluster-with-nebula: **0.6**;
  - open cluster, asterism, other: **0.3**;
  - double star: **0.15**.
- `WASHED_OUT_CONTRAST_MAG = `**`3.5`**.
- `BRIGHT_CORE_OFFSET_MAG = `**`1.5`**.
- `MOONLIGHT_EXEMPT_IDS = ["M16"]`: a nebula with a bright embedded cluster.
- Washed-out rule types: the diffuse ones (sensitivity 1, plus `cluster-with-nebula`).
- `MOON_DISC_STEP_MINUTES = 10`.

**Moon component, for every object:** `moon = mean over best-window samples of clamp01(1 − sensitivity(type) · m_b / MOONLIGHT_REF_MAG)`, where `m_b` is the Moon's brightening at the object's position. This uses the separation, both altitudes and the phase, and it is zero brightening when either body is below the horizon. `MIN_OBJECT_SCORE` and the weights are unchanged.

**Washed-out rule, for diffuse objects that are not exempt.**
- `SB_eff = vMag + 2.5·log10(π/4·a·b·3600) − BRIGHT_CORE_OFFSET_MAG`, with `b = a` when the minor axis is missing. No major axis means the object is never washed out.
- The object is washed out when all three conditions hold:
  - `SB_eff − V_sky(with Moon) > T` at **every** best-window sample;
  - `SB_eff − V_sky(without Moon) ≤ T` at least once, so the cause is the Moon, not the light pollution;
  - its total with the moon component set to 1 clears `MIN_OBJECT_SCORE`, so it would be on the list on a moonless night (review rev 2, F2). The count therefore means "would be listed if not for the Moon".
- Washed-out objects are excluded from `cleared` and returned separately.

## Critical Implementation Details

- **The bright-Moon line moves.** The verdict card's Moon line (S-02's `isBrightMoon` / `brightMoonLine` / `moonNote` / `card.brightMoon*`) is removed in Phase 4, superseded by the Moon card's faint-objects line. Phase 3 leaves it in place, so each phase stands alone.
- **The client island inside the server island** is unproven in this repo. Phase 5 checks it first. The fallback is an inline `<script>` custom element that reads the states from `<script type="application/json">`. JavaScript is already required inside Tonight (lessons.md), so no no-JS path is needed.
- **Browser safety.** `src/lib/moon-disc/` must not import astronomy-engine or the engine. It owns the `MoonDiscState` type, which the engine imports, never the reverse. Extend the purity guard to cover it.
- **Calibration discipline.** If implementation numbers differ from the harness (for example because of sampling or rounding), re-run `calibration-harness.md` and tune only within T 3.0–4.0, core offset 0–2 and reference 1–2. Record the reason in `checkpoint.md`. Do not tune to make a named object pass.

## Phase 1: Honest moonlight in the ranking

### Overview

A moonlit-sky model, a single-scale moon component, the washed-out flag, and the user-visible explanation (the count line and the `/tonight/all` group). Verified by property tests and a checkpoint against the M-1 nights.

### Changes Required:

#### 1. Parameters

**File**: `src/lib/engine/parameters.ts`

**Intent**: Add the candidates above in a `// Moonlight (moonlight-and-the-verdict)` block, each with a "Candidate (…, 2026-10-02)" doc comment citing its source and the calibration table.

**Contract**: `DARK_SKY_ZENITH_MAG_BY_BORTLE`, `darkSkyZenithMagForBortle`, `EXTINCTION_V`, `MOONLIGHT_REF_MAG`, `MOONLIGHT_SENSITIVITY`, `moonlightSensitivity(type)`, `WASHED_OUT_CONTRAST_MAG`, `BRIGHT_CORE_OFFSET_MAG`, `MOONLIGHT_EXEMPT_IDS`, `WASHED_OUT_TYPES`.

#### 2. Moonlit sky model

**File**: `src/lib/engine/moonlight.ts` (new; exported from the barrel)

**Intent**: Pure K&S sky brightness at a position, and the derived quantities.

**Contract**:
- `skyBrightnessNL({ moonPhaseAngleDeg, moonAltitudeDeg, objectAltitudeDeg, separationDeg, darkZenithMag, extinction }) → { darkNL, moonNL }`.
- `moonBrighteningMag(sky)`.
- `nlToMag(nl)` and `magToNL(mag)`.
- `effectiveSurfaceBrightness(object) → number | null`, which applies the b = a fallback and the core offset.

#### 3. Score and ranking

**Files**: `src/lib/engine/score.ts`, `ranking.ts`

**Intent**: Use the single-scale moon component for every object, add the washed-out flag, and exclude washed-out objects from the cleared list.

**Contract**:
- `ScoredObject` gains `id`, `majorAxisArcmin`, `minorAxisArcmin`, `raHours` and `decDeg`. `RankableObject` gains `minorAxisArcmin`.
- `ScoreInput` gains `darkZenithMag`. Its `moonTrack` samples gain `phaseAngleDeg`, which `MoonState` already has. `ScoreInput` also gains `moonSeparationsDeg: readonly number[]`, parallel to the track. `rankObjects` computes the Moon's geocentric J2000 unit vector once per sample, as an array parallel to `moonTrack`, and dots it with each object's unit vector, rather than calling `moonSeparationDeg` per object. `MoonState` is unchanged, because `outlook.ts` and `moon-target.ts` share it (review rev 2, F5).
- `ObjectScore` gains `washedOut: boolean`.
- `rankObjects` returns `washedOut: { object, window, peak }[]`, sorted by best time, together with `washedOutCount`.
- Every `ScoredObject` and `RankableObject` test literal is updated (`score.test.ts:37, 164`, `ranking.test.ts:31`).

#### 4. Explanation on Tonight and `/tonight/all`

**Files**: `src/lib/tonight/build.ts`, `format.ts`, `src/components/tonight/TonightContent.astro`, `AllObjectsContent.astro`, `src/i18n/messages/{en,pl}.ts`

**Intent**: Never shrink the list silently.

**Contract**:
- `TonightRanking` gains `washedOutCount` and `washedOutEntries` (id, name, window, best time).
- `TonightContent` shows `tonight.ranking.washedOut({ count })` (via `plural()`), linking to `/tonight/all#washed-out`, whenever the count is above 0.
- `AllObjectsContent` renders the `#washed-out` group, tagged "washed out by the Moon", independently of `rows.length`. The page heading counts cleared objects only.
- `reason.moon` ("N% clear of moonlight", `en.ts:592`, `format.ts:199`) is reworded to describe the brightening, e.g. "little moonlight where it sits". Its PL counterpart is reworded too.

#### 5. Tests

**Files**: `moonlight.test.ts` (new), `score.test.ts`, `ranking.test.ts`, `determinism.test.ts`, `build.test.ts`

**Intent**: Pin properties, not hand-picked objects (review F2).

**Contract**:
- The Moon's brightening is 0 below the horizon, and decreases monotonically with separation and with phase angle.
- A synthetic SB-24 galaxy 30° from a full Moon is washed out; a synthetic SB-18 one is not. That leaves a wide margin.
- Clusters and M16 are never washed out.
- On the 2026-10-10 new-Moon night (Warsaw, Bortle 6), zero objects are washed out and the top 5 is unchanged.
- On 2026-10-26 (full, Bortle 6, 150 mm), the top 5 is clusters only and `washedOutCount ≥ 3` (the harness gives 4).
- A diffuse object that meets the contrast rule but misses `MIN_OBJECT_SCORE` even with the moon component at 1 is neither washed out nor cleared.
- Determinism holds.
- Build view: on 2026-10-26, `washedOutCount > 0` and the line text is present.

#### 6. Checkpoint

**File**: `context/changes/moonlight-and-the-verdict/checkpoint.md` (new)

**Intent**: Re-run `calibration-harness.md` against the real implementation on its six night × Bortle cases, plus M-1 Night 3 (Bieszczady 2027-04-06, Bortle 3, 80 mm).

**Contract**: For each case, record before/after cleared, washed out and the top 5. Note any tuning, within the bounds above.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (moonlight model, score, ranking, build, determinism, purity)
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`

#### Manual Verification:

- Checkpoint written in `checkpoint.md` with before/after tables; new-Moon nights' top 5 unchanged; full-Moon top 5 clusters only; local-preview screenshots of tonight's real-clock state, with bright-Moon states covered by the fixed-date build tests (post-merge bright-Moon screenshots after 2026-10-22)

**Implementation Note**: Run the checks yourself (the user verifies after merge), then continue. The preview runs on the real clock (`TonightContent.astro:51`), and the Moon wanes to new around 2026-10-10. Bright-Moon states will not render locally until about 2026-10-22, so the fixed-date build tests (2026-10-26) are their evidence, and a bright-Moon screenshot check follows merge (review rev 2, F4: no test-only clock seam in production code).

---

## Phase 2: Moon disc geometry

### Overview

The engine produces per-instant Moon states. A pure, browser-safe module turns one state into SVG paths in map orientation.

### Changes Required:

#### 1. State type and geometry (browser-safe)

**Files**: `src/lib/moon-disc/state.ts`, `geometry.ts`, `maria.ts` (new)

**Intent**: The type and the drawing maths, with no astronomy-engine or engine import.

**Contract**:
- `MoonDiscState = { time: string (ISO), illuminatedFraction (0.01 steps), waxing, band: MoonPhaseBand, brightLimbAngleDeg (θ = χ − P, from lunar north towards celestial east), librationLatDeg, librationLonDeg }`. `MoonPhaseBand` comes from `@/lib/engine/parameters`, the one import islands are allowed.
- `moonDiscPaths(state) → { litPath | null, mariaPaths: string[] }`:
  - unit disc, SVG coordinates with y down, north up;
  - the bright limb points to `(−sin θ, −cos θ)`;
  - 4-decimal numbers;
  - `litPath` is null at 0% and the full disc at 100%.
- `maria.ts`: about 12 maria from the IAU/Wikipedia centres:
  - Imbrium, Serenitatis, Tranquillitatis, Crisium, Fecunditatis, Nectaris, Nubium, Humorum, Cognitum, Insularum, Vaporum;
  - Frigoris as an ellipse;
  - Procellarum as 2–3 caps.
  - Each is drawn as a 24-point spherical cap with orthographic projection and libration; hidden points are pushed onto the limb.
  - The maria are clipped to the lit part.

#### 2. States (engine)

**File**: `src/lib/engine/moon-disc.ts` (new; exported from the barrel)

**Intent**: Compute states server-side.

**Contract**:
- `moonDiscState(time)` uses `GeoVector` + `EquatorFromVector` (J2000) for the Sun and the Moon (review F7: not `Equator`), `RotationAxis(Body.Moon, time)`, `Libration`, `Illumination` and the existing `moonElongationDeg` / `moonPhaseBand`.
- `moonDiscStates(interval, step = MOON_DISC_STEP_MINUTES)` samples the interval inclusively.

#### 3. Tests

**Files**: `src/lib/moon-disc/geometry.test.ts`, `src/lib/engine/moon-disc.test.ts`, `src/lib/engine/purity.test.ts` (extend to `src/lib/moon-disc/`)

**Intent**: Pin orientation using **real engine states**, not synthetic angles that would share a convention error.

**Contract**:
- On a real waxing-crescent state (2026-10-15T17:00Z, 23.5% lit), the lit centroid is at x > 0, **and Crisium's centre lies inside the lit path** (margin about 0.30 of the radius). Not 2026-10-12: at 4.7% lit, Crisium is correctly unlit (review rev 2, F1).
- On a real waning state (2026-11-02T04:00Z), the lit centroid is at x < 0.
- Imbrium is in the upper half.
- k = 0.5 gives a straight terminator; k = 0 gives null; k = 1 gives a full disc.
- `illuminatedFraction` is within 0.01 of the Skyfield Moon reference.
- `waxing` agrees with elongation < 180°.
- Determinism holds, and purity covers both directories.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (geometry invariants on real states, moon-disc states, purity, determinism)
- Type check and lint pass: `npx astro check && npm run lint`

---

## Phase 3: Sky wording everywhere

### Overview

A single headline function, from level plus reason, used by every place that shows a verdict. Also the PRD and roadmap notes, and the landing screenshot.

### Changes Required:

#### 1. Headline function and copy

**Files**: `src/lib/tonight/format.ts`, `src/i18n/messages/{en,pl}.ts`

**Intent**: Say exactly what the forecast checks.

**Contract**:
- `skyHeadline(verdict) → { key, text }` follows the Desired End State table. It reuses `tonight.card.noDarkWindow` where it fits.
- `verdict.level` copy becomes the cloud words, and the new reason-specific headlines are added.
- The kicker becomes "Sky tonight" / "Niebo dziś w nocy".
- The next-night line reads "Next clearer night: Fri 9 Oct (partly clear)", because `nextNightNotNoGo` can return a marginal night.
- The planet weather line (`format.ts:492`) uses the headline words.
- The landing alt text "a Go verdict" (`en.ts:87`) is updated.

#### 2. Readers

**Files**: `VerdictCard.astro` (now receives the verdict reason kind), `NightStrip.astro:57`, `AllObjectsContent.astro:80`, `Welcome.astro:12-14`

**Intent**: Every reader uses `skyHeadline`, so no surface ever prints "Cloudy" on a no-darkness night or "Partly clear" with no forecast.

#### 3. Docs and assets

**Files**:
- `context/foundation/prd.md`: an inline "> Resolution (2026-10-02, moonlight-and-the-verdict)" note under FR-010/011 and the Business Logic verdict paragraph.
- `context/foundation/roadmap.md`: S-07 note that a match compares against the sky words.
- `public/landing/tonight.png`: re-capture with `CAPTURE_LANDING=1` (`landing-screenshot.spec.ts`).

#### 4. Tests

**Files**: `format.test.ts`, `build.test.ts`, `tests/e2e/onboarding.spec.ts`, `landing-screenshot.spec.ts`, `seven-night-planner.spec.ts`

**Intent**: Cover every row of the headline table in EN and PL, and keep e2e assertions on catalogue keys. Make the strip assertion in `seven-night-planner.spec.ts:107-112` robust to the new words.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (headline table EN/PL, i18n parity)
- Type check, lint and build pass: `npx astro check && npm run lint && npm run build`
- E2E passes against a local preview (setup below): `BASE_URL=http://localhost:4321 npm run test:e2e`

#### Manual Verification:

- Screenshots on the local preview of the sky card, the strip and the landing legend in EN/PL; no "Go" left in user-visible copy

**E2E setup (all phases):**
1. `npx supabase start`.
2. `FIXTURE_PORT=4400 node tests/e2e/forecast-fixture.mjs &`.
3. Write `SUPABASE_URL`/`SUPABASE_KEY` from `npx supabase status -o env` (`API_URL`, `ANON_KEY`) and `FORECAST_BASE_URL=http://127.0.0.1:4400` into `.dev.vars`. Back the file up and restore it afterwards, and never commit it.
4. `npm run build && npm run preview -- --port 4321 &`.
5. Mirror `.github/workflows` lines 51–70.

---

## Phase 4: The Moon card

### Overview

The Moon card moves up beside the sky card, with the server-rendered SVG and the nightly facts. The old bright-Moon line and the Moon entry in the solar-system section are removed.

### Changes Required:

#### 1. Build view

**File**: `src/lib/tonight/build.ts`

**Intent**: A `moonCard` that exists on every night with a view, built in its own try/catch outside the solar-system block.

**Contract**:
- `TonightView.moonCard = { window, windowKind, states: MoonDiscState[], timeLabels: string[], initialIndex, upText, faintText | null, target: TonightMoonEntry | null }`.
- **Per-path matrix:**

  | Night | `window` | `faintText` | `target` |
  | --- | --- | --- | --- |
  | go/marginal with a dark window | dark window | per the faint-objects table in Desired End State (K > 0 / up part / up all / never up) | per today's solar-system gate |
  | cloudy no-go | dark window | null | per gate (clear twilight hours) |
  | no-darkness | civil window | null | per gate |
  | no civil window (high-latitude summer) | civil window absent, so no states | null | none; the card shows the phase text only, from local noon |
  | no forecast | dark window | computed (Moon facts don't need weather) | per gate |
  | `view` null | no card (existing setup prompts) | — | — |

- `upText`, the up interval for `faintText`, and the up-part / up-all / never-up case all come from `moonTrack` / `moonFreeMinutes` over the window. The case logic lives in `build.ts`, with no new parameter.
- `initialIndex` is the sample nearest `now`, clamped into the window.
- `solarSystem` keeps planets only.
- **Removal touch-list:**
  - `brightMoonText` and `isBrightMoon` uses (`build.ts:9, 266-270, 310, 536-555, 577`);
  - `VerdictCard` `moonNote` (`:22-34, 59`), `TonightContent.astro:149`;
  - `brightMoonLine` (`format.ts:520-527, 555`) and its tests (`format.test.ts:100-108`, about 8 tests in `build.test.ts:894-1020`);
  - `card.brightMoon*` (`en.ts:387-399`, `pl.ts:400-406`);
  - `isBrightMoon` and `BRIGHT_MOON_*` in the engine (`moon-target.ts:137`, `parameters.ts:311, 317`) and their tests;
  - `ShownSolarTargets`'s Moon variants, and the `planets.none` / `noneInClearHours` / `weather.line` Moon wording.

#### 2. Components and copy

**Files**: `MoonCard.astro` (reworked), `MoonDisc.astro` (new), `TonightContent.astro`, `SolarSystemSection.astro`, `en.ts`, `pl.ts`

**Intent**: Two cards in one grid row, with token-only colours.

**Contract**:
- `MoonDisc` renders `moonDiscPaths(states[initialIndex])`:
  - `role="img"` with a localised `aria-label` ("Moon, 63% lit, waxing gibbous");
  - lit part `fill-heading`, dark disc `fill-surface` with a `stroke-border` limb, maria `fill-muted-foreground` with opacity;
  - clip-path ids unique per page.
- The Moon card is `section[aria-labelledby="moon-heading"]` at h2.
- `SolarSystemSection` is titled "Planets tonight" again.
- New copy lives under `tonight.moon.card.*`.
- The no-hardcoded-colors and red-theme tests pass.

#### 3. Tests

**Files**: `build.test.ts`, `tests/e2e/moon-as-target.spec.ts`, `planets-on-tonight.spec.ts`

**Intent**: Cover every row of the matrix and all four faint-objects cases on fixed nights, and move the e2e specs to the new structure. Fixed nights per case: K > 0 on 2026-10-26; Moon up all window; Moon up part of the window; never up on 2026-10-10. Pick the up-all and up-part dates with the engine when writing the tests, and assert K = 0 for both.
- `moon-as-target.spec.ts:31-37` finds the Moon card by `moon-heading` at h2 and skips on the **target's** presence, not the card's.
- `planets-on-tonight.spec.ts:29, 35-41` uses the planets heading and planet-only skips.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (build matrix, format, i18n parity, no-hardcoded-colors, red-theme)
- Type check, lint and build pass: `npx astro check && npm run lint && npm run build`
- E2E passes against a local preview: `BASE_URL=http://localhost:4321 npm run test:e2e`

#### Manual Verification:

- Playwright screenshots on the local preview: EN/PL × dark/light/red × phone/desktop of tonight's real-clock Moon; the two cards read clearly, the SVG's lit side and % match the phase, red mode stays red; every faint-objects case covered by fixed-date build tests

---

## Phase 5: The time slider

### Overview

An interactive control in the Moon card. A slider over the window and a "Now" button redraw the SVG, % lit and phase from the precomputed states.

### Changes Required:

#### 1. Nesting check

**Intent**: First confirm that a `client:load` React island hydrates inside the `server:defer` Tonight island on the production preview. Otherwise use the custom-element fallback.

#### 2. Slider

**File**: `src/components/tonight/MoonTimeSlider.tsx` (new), or the fallback element

**Contract**:
- Props: `states`, `timeLabels` (pre-formatted on the server in the site's time zone), `initialIndex`, `locale`.
- A range input from 0 to n−1 with live redraw via `moonDiscPaths`, and phase and % text kept in step.
- "Now" restores `initialIndex`.
- Arrow keys step 10 minutes. `aria-valuetext` is the time label, and the SVG label updates.
- It imports only `src/lib/moon-disc/*`, `@/lib/engine/parameters` and `src/i18n`.

#### 3. Tests

**File**: `tests/e2e/moon-card.spec.ts` (new)

**Contract**:
- Onboard in Madrid, wait for `verdict-heading`, then for hydration.
- Move the slider to the last step: the time label and the SVG label change.
- "Now" restores them.
- The test tolerates the real clock.

### Success Criteria:

#### Automated Verification:

- Unit tests, type check, lint and build pass: `npm test && npx astro check && npm run lint && npm run build`
- E2E passes, including `moon-card.spec.ts`: `BASE_URL=http://localhost:4321 npm run test:e2e`

#### Manual Verification:

- On the local preview, dragging the slider redraws the Moon smoothly at phone width; "Now" returns to the current moment; keyboard steps work; red mode stays red (screenshots at three slider positions)

---

## Testing Strategy

### Unit Tests:

- Moonlight model properties.
- Wide-margin synthetic washed-out cases; clusters and M16 exempt.
- Top 5 unchanged on new-Moon nights; clusters only at full Moon.
- Geometry invariants on real states.
- The headline table.
- The Moon-card path matrix.

### Integration Tests:

- e2e: sky wording, the Moon card, the slider, the moved Moon target (Mark observed still logs the Moon), planets only, the washed-out link.

### Manual Testing Steps:

1. The checkpoint harness on the seven cases.
2. The local-preview screenshot matrix.
3. Three slider positions.

## Performance Considerations

- Per build: about 110 objects × about 60 samples, each a dot product plus K&S, and about 60 disc states. All cheap.
- The island payload is under 5 KB.
- CPU is not capped on Workers Paid.

## Migration Notes

No database change. The PRD and roadmap notes record the vocabulary change.

## References

- Frame: `frame.md`. Reviews: `reviews/plan-review-rev1.md` (revision 1), `reviews/plan-review.md` (revision 2). Calibration: `calibration-harness.md`.
- M-1 checkpoint: `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md`; #21 item 2.
- S-02: `context/archive/2026-10-01-moon-as-target/`, once PR #78 merges; until then `context/changes/moon-as-target/` on main.
- Krisciunas & Schaefer 1991, PASP 103, 1033.
- Meeus, *Astronomical Algorithms*, eq. 48.5.
- IAU/Wikipedia "List of maria on the Moon".
- GitHub #79 (this change).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Honest moonlight in the ranking

#### Automated

- [x] 1.1 Unit tests pass: `npm test` (moonlight model, score, ranking, build, determinism, purity) — 7e4327a
- [x] 1.2 Type check passes: `npx astro check` — 7e4327a
- [x] 1.3 Lint passes: `npm run lint` — 7e4327a

#### Manual

- [x] 1.4 Checkpoint written in `checkpoint.md` with before/after tables; new-Moon nights' top 5 unchanged; full-Moon top 5 clusters only; local-preview screenshots of tonight's real-clock state, with bright-Moon states covered by the fixed-date build tests (post-merge bright-Moon screenshots after 2026-10-22) — 7e4327a

### Phase 2: Moon disc geometry

#### Automated

- [x] 2.1 Unit tests pass: `npm test` (geometry invariants on real states, moon-disc states, purity, determinism) — 31e5aa1
- [x] 2.2 Type check and lint pass: `npx astro check && npm run lint` — 31e5aa1

### Phase 3: Sky wording everywhere

#### Automated

- [x] 3.1 Unit tests pass: `npm test` (headline table EN/PL, i18n parity) — c6f6972
- [x] 3.2 Type check, lint and build pass: `npx astro check && npm run lint && npm run build` — c6f6972
- [x] 3.3 E2E passes against a local preview (setup below): `BASE_URL=http://localhost:4321 npm run test:e2e` — c6f6972

#### Manual

- [x] 3.4 Screenshots on the local preview of the sky card, the strip and the landing legend in EN/PL; no "Go" left in user-visible copy — c6f6972

### Phase 4: The Moon card

#### Automated

- [x] 4.1 Unit tests pass: `npm test` (build matrix, format, i18n parity, no-hardcoded-colors, red-theme)
- [x] 4.2 Type check, lint and build pass: `npx astro check && npm run lint && npm run build`
- [x] 4.3 E2E passes against a local preview: `BASE_URL=http://localhost:4321 npm run test:e2e`

#### Manual

- [x] 4.4 Playwright screenshots on the local preview: EN/PL × dark/light/red × phone/desktop of tonight's real-clock Moon; the two cards read clearly, the SVG's lit side and % match the phase, red mode stays red; every faint-objects case covered by fixed-date build tests

### Phase 5: The time slider

#### Automated

- [ ] 5.1 Unit tests, type check, lint and build pass: `npm test && npx astro check && npm run lint && npm run build`
- [ ] 5.2 E2E passes, including `moon-card.spec.ts`: `BASE_URL=http://localhost:4321 npm run test:e2e`

#### Manual

- [ ] 5.3 On the local preview, dragging the slider redraws the Moon smoothly at phone width; "Now" returns to the current moment; keyboard steps work; red mode stays red (screenshots at three slider positions)
