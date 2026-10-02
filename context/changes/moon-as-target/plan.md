# The Moon as a Target Implementation Plan

## Overview

This is roadmap M-2, slice S-02 (`moon-as-target`, MS-02, GitHub #66).

- Tonight's "Planets tonight" section becomes **"Solar system tonight"**. Its first card is the Moon, whenever the Moon clears the site's minimum altitude in the same civil-dusk-to-dawn window, and under the same weather, that the planets use.
- **The Moon card** shows:
  - the phase name and % lit;
  - the window, plus the best time with its altitude and direction;
  - a whole-disc eyepiece and a detail eyepiece from the user's kit;
  - a reason line;
  - a short note for the current phase band on what is worth looking at;
  - "Mark observed", so the Moon can be logged.
- **The bright-Moon line:** on a go or marginal night with a dark window, the verdict card says that faint galaxies and nebulae will be washed out, and points at the Moon and planets instead. The trigger is the Moon being at least 50% lit and up for more than half the dark window.
- All copy is in English and Polish.

## Current State Analysis

The full map is in `context/changes/moon-as-target/research.md`.

- **Target identity is closed and Messier/planet only.**
  - `TargetKey = MessierKey | PlanetKey` and `TargetKind = "messier" | "planet"` (`src/lib/targets/index.ts:29-30`).
  - `targetKind` (`:54`) treats any non-planet key as Messier.
  - `targetLabel` (`src/lib/targets/labels.ts:22-34`) falls through to the Messier branch.
  - The DB check `observations_target_key` (`supabase/migrations/20260930120000_observation_target.sql:26-29`) allows the Messier regex or the seven planets. Its header (`:4`) says S-02 extends it.
  - The sync trigger (`:32-66`) derives `messier` only from `M…` keys, so a `moon` row gets `messier = null`, as a planet does.
  - The zod schema (`src/lib/observations/schemas.ts:59`) validates through `isTargetKey`, so it follows the grammar.
- **What the Moon engine has and lacks.** `src/lib/engine/moon.ts` has topocentric alt/az, `illuminatedFraction` and `phaseAngleDeg` (`:25-37`), `moonFreeMinutes` (`:81-113`) and `moonTrack` (`:116`). It has no waxing/waning, no phase band and no eyepiece rule. astronomy-engine's `MoonPhase(date)` returns the Sun–Moon ecliptic elongation, 0–360° (0 new, 90 first quarter, 180 full, 270 last quarter; `node_modules/astronomy-engine/astronomy.d.ts:1487`), which gives both the band and the direction.
- **The planet block in `buildTonight`** (`src/lib/tonight/build.ts:376-424`):
  - it computes `darkWindow(site, night, PLANET_WINDOW_SUN_ALTITUDE_DEG)` and that window's own `verdict`;
  - the section shows only when that verdict is go or marginal;
  - when the main card does not pass the night, tracks are masked to clear hours (`clearIntervals`);
  - the block is wrapped in try/catch: `planets = null` on failure.
  - `rankPlanets` (`src/lib/engine/planet-ranking.ts:126-164`) uses the private helpers `maskedTrack` (`:113`) and `timingOf` (`:100`) plus `bestWindow`.
- **Eyepieces:**
  - `planetEyepiece` (`src/lib/engine/eyepieces.ts:131-143`) picks the highest magnification with exit pupil ≥ 0.7 mm, under the ceiling of min(2 × aperture, 250×).
  - `eyepieceOptics` (`:49`) gives `trueFovDeg`.
  - No rule yet picks an eyepiece by "fits an object of size X".
- **UI:**
  - `PlanetSection.astro:19-36` renders `section[aria-labelledby="planets-heading"]` with an `ol` of `PlanetCard`s.
  - `PlanetCard.astro:33-46, 57-66` duplicates the window/best `dl` and the log link of `ObjectDetails.astro:16-54`. S-01's review F10 (`context/archive/2026-09-30-planets-on-tonight/reviews/impl-review-phase-3.md:146-154`) accepted extracting a shared block in this slice.
  - `TonightContent.astro:65, 148, 169` gates `showSections` and `nightsLink` on `planets || ranking`.
- **Moonlight today only lowers deep-sky scores** (`score.ts:89-131`, weight 0.30). `VerdictCard.astro` and `verdict.ts` say nothing about the Moon.
- **Verification:**
  - The Skyfield reference covers planets only (`scripts/planet-reference.py:44-52`, on new-moon night 2026-10-10).
  - The Stellarium Moon fixtures are `pending` (#19).
  - `de421.bsp` is at `~/projects/de421.bsp`.
- **Phase on candidate nights** (astronomy-engine, a 20:00 UTC snapshot only, not the Moon's visible state that night: on 10-17 it never clears 15° and is about 79–80° at its peak, and on 11-02 it is below the horizon at 20:00 UTC; elongation, % lit):

| Night | Elongation | Lit |
|---|---|---|
| 2026-10-10 | 2° | 0% |
| 2026-10-17 | 81° | 42% |
| 2026-10-20 | 114° | 70% |
| 2026-10-24 | 162° | 98% |
| 2026-10-26 | 189° | 99% |
| 2026-10-31 | 257° | 62% |
| 2026-11-02 | 283° | 39% |

## Desired End State

A signed-in user opens Tonight on a night when the solar-system window's weather is go or marginal. That includes a cloud no-go night with a clear twilight spell and a no-darkness summer night, as for planets.

- **The section:** the user sees **"Solar system tonight"** between the verdict card and the deep-sky ranking.
- **The Moon card comes first**, whenever the Moon clears the site's minimum altitude in the (clear-hours-masked) window and is at least 3% lit. It shows:
  - "Waxing gibbous · 78% lit";
  - the window, and the best time with direction;
  - "Whole disc with X (N×) · detail with Y (M×)", or only the whole-disc eyepiece when the detail pick is no stronger, or none for an empty kit;
  - a reason line ("Highest 42° at 23:10", with a "low" warning below 30°);
  - the phase-band note;
  - "Mark observed", with the "Seen N times" pill when it applies.
- **The planet cards follow**, unchanged.
- **The bright-Moon line:** on a go or marginal night with a dark window, when the Moon is ≥ 50% lit at the dark-window midpoint and above the horizon for more than half the dark window, the verdict card carries a line saying faint galaxies and nebulae will be washed out and that the Moon and planets are better bets. The deep-sky ranking is unchanged.
- **The log:**
  - Marking the Moon observed saves it; Tonight shows the existing `tonight.logged` notice, "Moon logged." / "Zapisano obserwację: Księżyc.", with no new grammar.
  - The log lists it as "Moon" / "Księżyc".
  - The manual picker finds it by name ("moon", "księżyc").
  - Edit and delete work as for any other entry.

**Verified by:**
- `npm test`: Moon positions, illumination and elongation agree with a committed Skyfield/DE421 reference, and the bands, eyepieces, bright-Moon predicate and build view are pinned on fixed nights.
- `npm run test:db`: `moon` passes the check, and junk keys are still rejected.
- The e2e spec: if the Moon card is present, mark it observed and find it in the log.
- Screenshots in EN/PL, dark/light/red, at phone width.

### Key Discoveries:

- `MoonPhase(date)` is the right key for phase notes. Research found that illumination % hides waxing vs waning, and that libration moves the terminator by about ±½ day, so keying on elongation bands with hedged wording ("around", "near the shadow line") is the honest choice (`research.md` §4).
- A bright-Moon night needs no new maths. `sevenNightOutlook`'s night 1, which `buildTonight` already holds as `first` (`build.ts:289-296`), carries `moon.illuminatedFraction` at the dark-window midpoint and `moon.moonFreeMinutes` (`outlook.ts:141-177`), so up-fraction = 1 − free ÷ dark-window minutes. These are the same values the strip shows.
- The solar-system window, its verdict and the clear-hours masking already exist in `build.ts:376-424`. The Moon is computed inside the same try/catch, from the same `planetWindow` and `clear` values.
- The planets e2e takes "the first `li` in the section" (`tests/e2e/planets-on-tonight.spec.ts:27-37`). Once the Moon card shares the section, that spec must target the planet list explicitly.
- `src/lib/tonight/**`, `src/components/tonight/**`, `src/lib/observations/**` and `src/pages/log/**` are already under the coordinate-privacy lint (`eslint.config.js:84-100`). No new path in this change needs a glob, per lessons.md.

## What We're NOT Doing

- **Moonrise/moonset times as separate facts.** The window and best time say when the Moon is up tonight. Exact rise/set (`SearchRiseSet`) waits for S-05's timeline, which needs it.
- **Reordering or filtering the deep-sky ranking on bright-Moon nights.** The verdict-card line explains, and the existing moonlight penalty (`SCORE_WEIGHTS.moon`) is the only effect on the ranking (user choice).
- **Feature-by-feature terminator prediction or colongitude.** Each band has one fixed note naming 2–3 well-known features.
- **Libration, apparent diameter, lunar eclipses, occultations, earthshine as its own fact.** Earthshine is mentioned in the crescent notes only.
- **The Moon on `/tonight/all` or in the seven-night strip.** The strip keeps its Moon line.
- **The Moon at the current dawn after rollover.** Tonight still moves to the evening ahead at civil dawn (`TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG`), as S-01 accepted for morning planets.
- **Dropping `observations.messier` or the sync trigger.** That waits until S-03 has settled the grammar.
- **Capturing the pending Stellarium Moon fixtures (#19).** The Skyfield reference is the automated cross-check, and #19 stays open.
- **The CPU re-measure for #22.** Sidereus is on Workers Paid since 2026-09-30, so the 10 ms cap no longer applies.
- **A PRD v3 amendment.** Roadmap Open Question 1 stays with the user; S-01 shipped under the roadmap charter in the same way.

## Implementation Approach

Inside out, as S-01 did: a pure Moon engine with an independent reference, then the `moon` target in the log, then the Tonight UI. Every new number is a documented candidate in `parameters.ts`.

**Candidate parameters** (new, uncalibrated, in `src/lib/engine/parameters.ts`):

- `MOON_PHASE_BANDS`: elongation bands in degrees, upper bound exclusive.
  - waxing crescent 0–80
  - first quarter 80–110
  - waxing gibbous 110–165
  - full 165–195
  - waning gibbous 195–250
  - last quarter 250–280
  - waning crescent 280–360
- `MOON_WHOLE_DISC_FIELD_DEG = 0.7`: an eyepiece shows the whole disc when its true field is at least this. The disc spans at most about 0.56°, so this leaves a margin.
- `MOON_LOW_ALTITUDE_DEG = 30`: a peak below this gets the "low" reason. Sources (Space.com, Sky at Night) advise 30° or more for high power. It is deliberately higher than `PLANET_LOW_ALTITUDE_DEG = 20`, because the Moon is always used at high power along the terminator. That leaves the Moon's "well" band at 30–40° (`WELL_PLACED_ALTITUDE_DEG = 40`).
- `MOON_MIN_ILLUMINATION = 0.03`: below this illuminated fraction the Moon is not listed. A 1–2% sliver deep in bright twilight is not a beginner target; a 2-day crescent at about 4.5% still shows.
- `BRIGHT_MOON_MIN_ILLUMINATION = 0.5` and `BRIGHT_MOON_MIN_UP_FRACTION = 0.5`: the bright-Moon predicate (user choice: ≥ 50% lit, up more than half the dark window).

**Target key:** `moon`, kind `"moon"`. The grammar becomes Messier ∪ planets ∪ {`moon`}.

**Delegated decisions** (the user asked to decide non-UI choices autonomously):
- the window and weather are the same as for planets;
- notes are keyed on elongation;
- the eyepiece rules;
- the 30° low line;
- a 3% illumination floor (plan review F10). A thin crescent above it and above the minimum altitude is shown, with an earthshine note;
- the Skyfield Moon reference for Warsaw, 2026-10-24.

## Critical Implementation Details

- **The Moon lives in the same section block, but outside the planet list.** The Moon card is rendered before the planet `ol` as a standalone `article`, never as an `ol > li`. The planet `ol` gets an accessible label, so the planets e2e and screen readers can tell them apart. The section only exists when the solar-system verdict is go or marginal, so on a cloud no-go night with no clear twilight there is neither a Moon card nor a planet card. That matches S-01.
- **The bright-Moon line is judged on the dark window, not the solar-system window.** It speaks about faint deep sky, which only ranks in the dark window. With no dark window, or on a no-go night, the line never shows.

## Phase 1: Moon engine

### Overview

Pure, deterministic Moon target logic and the bright-Moon predicate (`isBrightMoon`) in the engine, cross-checked against an independent Skyfield/DE421 reference.

### Changes Required:

#### 1. Parameters

**File**: `src/lib/engine/parameters.ts`

**Intent**: Add the Moon candidates listed under Implementation Approach, each with a "Candidate (S-02 planning, M-2, 2026-10-01)" doc comment naming its source, in a new `// Moon (M-2 S-02)` block.

**Contract**:
- `MOON_PHASE_BANDS`: a readonly ordered list of `{ band, fromDeg, toDeg }` covering [0, 360) without gaps.
- `MoonPhaseBand`: the type `"waxing-crescent" | "first-quarter" | "waxing-gibbous" | "full" | "waning-gibbous" | "last-quarter" | "waning-crescent"`.
- `MOON_WHOLE_DISC_FIELD_DEG`, `MOON_LOW_ALTITUDE_DEG`, `MOON_MIN_ILLUMINATION`, `BRIGHT_MOON_MIN_ILLUMINATION`, `BRIGHT_MOON_MIN_UP_FRACTION`.

#### 2. Phase and band

**File**: `src/lib/engine/moon.ts`

**Intent**: Expose the Moon's elongation and the phase band it falls in, so notes and the phase name follow waxing vs waning.

**Contract**:
- `moonElongationDeg(time: Date): number` wraps `MoonPhase` and returns a value in [0, 360).
- `moonPhaseBand(elongationDeg: number): MoonPhaseBand` is a pure lookup in `MOON_PHASE_BANDS`.
- Both are exported through the engine barrel.

#### 3. Whole-disc eyepiece

**File**: `src/lib/engine/eyepieces.ts`

**Intent**: Pick the eyepiece that frames the whole Moon at the most magnification. The detail eyepiece is the existing `planetEyepiece`.

**Contract**:
- `wholeDiscEyepiece(telescope, eyepieces)` returns `{ eyepiece, optics, fits: boolean } | null`.
- It picks the highest-magnification eyepiece whose `trueFovDeg ≥ MOON_WHOLE_DISC_FIELD_DEG` (`fits: true`). If none qualifies, it picks the widest-true-field eyepiece (`fits: false`). For an empty kit it returns `null`.
- Ties go to the earlier eyepiece in input order (callers pass `created_at` order), as `maxBy` does for the existing rules (`eyepieces.ts:63-72`).

#### 4. Moon target

**File**: `src/lib/engine/moon-target.ts` (new), exported via `src/lib/engine/index.ts`

**Intent**: The Moon's counterpart of one `rankPlanets` entry: when it is up in the solar-system window above the minimum altitude, its best window and peak, its facts at the peak, its placement and timing, and its eyepieces. Reuse rather than copy the planet helpers.

**Contract**:
- Input: `MoonTargetInput { site, minAltitudeDeg, window: Interval (the planet window), telescope, eyepieces, seen, visibleIntervals? }`.
- Output: `moonTarget(input): MoonTargetEntry | null`, where `MoonTargetEntry` is `{ window, peak, facts: { illuminatedFraction, elongationDeg, band }, placement: "low" | "well" | "high", timing: PlanetTiming, wholeDisc, detail, seen }`.
  - The track is `moonTrack` over the window. It is masked to `visibleIntervals` when they are given (the same masking as planets), and passed to `bestWindow(track, minAltitudeDeg)`.
  - `null` when no sample clears the minimum, or when the illuminated fraction at the peak is below `MOON_MIN_ILLUMINATION`.
  - Facts are recomputed with `moonState(site, peak.time)` and `moonElongationDeg(peak.time)`. `bestWindow`/`maskedTrack` are typed `HorizontalPosition`, so the peak sample carries no illumination.
  - `placement` is a Moon-specific function (the planet `placementOf` is private and keyed to `PLANET_LOW_ALTITUDE_DEG`): `low` below `MOON_LOW_ALTITUDE_DEG`, `high` at or above `WELL_PLACED_ALTITUDE_DEG`, `well` between.
  - `detail` is `planetEyepiece`, set to `null` when its magnification is at or below the whole-disc eyepiece's (`planetEyepiece` falls back to the lowest magnification, which would read as nonsense next to the whole-disc pick).
- Moving `maskedTrack` and `timingOf` out of `planet-ranking.ts` into a shared engine module (or exporting them) is allowed. `rankPlanets` behaviour must not change.

#### 5. Bright-Moon predicate

**File**: `src/lib/engine/moon-target.ts`

**Intent**: The rule behind the verdict-card line, kept in the engine so it is pure and tested. It takes the values the seven-night outlook already computes for tonight, rather than computing them a second time, so the verdict card and the strip can never disagree (plan review F5).

**Contract**:
- `isBrightMoon(illuminatedFraction: number, upFraction: number): boolean`. It is a pure comparison: illumination ≥ `BRIGHT_MOON_MIN_ILLUMINATION` **and** `upFraction > BRIGHT_MOON_MIN_UP_FRACTION`.
- The caller derives its inputs from `sevenNightOutlook`'s night 1 (`outlook.ts:141-177`): `first.moon.illuminatedFraction`, taken at the dark-window midpoint, and `upFraction = 1 − first.moon.moonFreeMinutes ÷ dark-window minutes`. It is called only when `first.darkWindow.kind === "window"`, where `moonFreeMinutes` is not null.

#### 6. Skyfield Moon reference

**Files**: `scripts/moon-reference.py` (new), `src/lib/engine/fixtures/skyfield/moon-warsaw-2026-10-24.json` (generated, committed)

**Intent**: An independent cross-check that does not share astronomy-engine. It is generated the same way as `scripts/planet-reference.py`, from a throwaway virtualenv in the scratchpad, never installed in the repo.

**Contract**:
- Site: Warsaw, the same `SITE` as the planet script. Night: 2026-10-24, waxing gibbous to full.
- For every whole UTC hour in the civil window, record topocentric apparent alt/az (refracted, the same atmosphere constants as the planet script), the illuminated fraction, and the geocentric Sun–Moon ecliptic-longitude difference.
- The JSON carries provenance: Skyfield version, ephemeris, generator path, and the run command in the docstring.

**File**: `src/lib/engine/fixtures/index.ts`, `src/lib/engine/fixtures/README.md`

**Intent**: Tests read Skyfield references through the fixtures module, not the JSON directly, so the Moon reference needs the same plumbing as the planets.

**Contract**:
- A `MoonReference` type, a `parseMoonReference` parser that validates the shape and provenance (mirroring `parsePlanetReference`, `:266`), and an exported `MOON_REFERENCES` (mirroring `PLANET_REFERENCES`, `:294`).
- The README's fixture table gets a row for the Moon reference and its generator.

#### 7. Tests

**Files**: `src/lib/engine/moon.test.ts`, `src/lib/engine/moon-target.test.ts` (new), `src/lib/engine/eyepieces.test.ts`

**Intent**: Pin the new behaviour and the reference agreement. Criterion 1.2 means that the fixture is committed with provenance and that the `moon.test.ts` reference block passes under `npm test`. Generating the fixture from the scratchpad venv is a manual step, not a check.

**Contract**:
- Agreement with the reference: alt/az within 0.2°, illumination within 0.5 percentage points, elongation within 0.3°. Only samples with the Moon above 5° are compared, the same `REFERENCE_MIN_ALTITUDE_DEG` filter as `planets.test.ts:14`, because the two refraction models diverge near the horizon. Illumination and elongation are compared at every sample.
- Band boundaries, including 0/360 wrap-around and each band edge, tested on `moonPhaseBand` directly with literal degrees.
- Ephemeris band checks run on explicit UTC instants through `moonPhaseBand(moonElongationDeg(t))`. Each instant is at least 5° of elongation away from a band edge and verified before it is written into the test, for example 2026-10-26T20:00Z (full, 189°). Never route a band assertion through `moonTarget` or `buildTonight` on a night whose peak sits near an edge.
- `wholeDiscEyepiece`: fits / no fit / empty kit / ties.
- `moonTarget`:
  - `null` at new moon on 2026-10-10;
  - an entry on 2026-10-24 and 2026-10-26, both checked to clear the minimum altitude (about 44° at 20:00 UTC in Warsaw);
  - masking by `visibleIntervals` drops cloudy hours;
  - the low/well/high placement boundaries;
  - `null` below `MOON_MIN_ILLUMINATION` (an instant checked to be under 3% lit and above the minimum, or a lowered minimum altitude);
  - `detail` is `null` when the kit's highest useful magnification is not above the whole-disc eyepiece's.
- `isBrightMoon`, with literal inputs: (0.5, 0.51) is true; (0.49, 1) and (1, 0.5) are false, which pins both boundaries.
- The existing `determinism.test.ts` and `purity.test.ts` stay green, so the engine still reads no clock, I/O or environment.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (new Moon tests, existing planet tests unchanged)
- Moon positions agree with the committed Skyfield reference within the stated tolerances
- Engine purity and determinism tests stay green
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`

**Implementation Note**: After this phase passes, continue to Phase 2 without a between-phase question (the user verifies after merge).

---

## Phase 2: The Moon in the log

### Overview

`moon` becomes a valid target key end to end (DB, grammar, labels, picker), with no change to Tonight yet.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261001120000_observation_target_moon.sql` (new)

**Intent**: Extend the closed target grammar with `moon`. The migration is additive and compatible with the app deployed before it, which never writes `moon`.

**Contract**:
- Drop and re-add `observations_target_key` as the same Messier regex, or `target in` (the seven planets, plus `'moon'`).
- The header comment explains the extension and that the trigger needs no change: a `moon` row gets `messier = null`.
- RLS is unchanged.

#### 2. Target grammar and labels

**Files**: `src/lib/targets/index.ts`, `src/lib/targets/labels.ts`

**Intent**: Add the Moon as its own kind, so nothing treats `moon` as a Messier key.

**Contract**:
- `MOON_TARGET_KEY = "moon"`, `MoonKey`, `TargetKey = MessierKey | PlanetKey | MoonKey`, `TargetKind = "messier" | "planet" | "moon"`.
- `isTargetKey` and `parseTargetParam` accept `moon`, and `targetKind("moon") === "moon"`.
- `targetLabel` returns `targets.moon` for it.
- The header comment's grammar description is updated.

#### 3. Picker and search

**Files**: `src/lib/observations/target-options.ts`, `src/lib/observations/target-search.ts` (verify only)

**Intent**: The manual log picker lists the Moon and finds it by name in both locales.

**Contract**:
- One Moon option with a detail string (`targets.moonDetail`), ordered between the Messier options and the planets. `target-search.test.ts:18` pins today's order, so it is updated.
- A number query still never matches it.

#### 4. Copy

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: The Moon's name and picker detail in both locales.

**Contract**:
- `targets.moon` ("Moon" / "Księżyc") and `targets.moonDetail` (for example "Earth's satellite" / "naturalny satelita Ziemi").
- The `tonight.logged` notice and `log.title` already take the name in the nominative after a colon or before "logged", as for planets, so they need no change.
- `log.manualIntro` ("Pick a Messier object or a planet…", `en.ts:650`, plus PL) is updated to mention the Moon.
- The header comments of `src/lib/targets/index.ts` and `target-search.ts` describe the new grammar.

#### 5. Tests

**Files**: `src/lib/targets/index.test.ts`, `src/lib/observations/*.test.ts` as affected, `tests/db/observations.test.ts`

**Intent**: The grammar, the label and the DB check accept `moon` and still reject junk.

**Contract**:
- Unit: `isTargetKey("moon")`, `targetKind`, `parseTargetParam`, label in EN/PL, picker option present, name search finds it.
- DB: insert and update with `target = 'moon'` succeed with `messier` null. `'Moon'`, `'luna'` and `'sun'` are rejected, mirroring the planet cases at `tests/db/observations.test.ts:197-222` (insert and reject list, `it.each` at `:205`) and `:226-240` (the update cases, M42 → saturn → M1).

### Success Criteria:

#### Automated Verification:

- Migration applies on local Supabase: `npx supabase db reset`
- DB isolation and target tests pass: `npm run test:db`
- Generated types show no drift: `npm run db:types` then `git diff --exit-code src/lib/database.types.ts`
- Unit tests pass: `npm test`
- Type check and lint pass: `npx astro check && npm run lint`

#### Manual Verification:

- On the local dev server against local Supabase, the manual log picker finds "Moon" / "Księżyc" by name, an entry saves, and it shows in the log by name in EN and PL

---

## Phase 3: The Moon on Tonight

### Overview

The "Solar system tonight" section with the Moon card first, the shared details block, the bright-Moon verdict line, the EN/PL phase notes and the e2e.

### Changes Required:

#### 1. Build view

**File**: `src/lib/tonight/build.ts`

**Intent**: Compute the Moon entry inside the existing solar-system block, from the same window and clear-hours masking as the planets, and compute the bright-Moon line from the dark window.

**Contract**:
- Rename `TonightPlanets` to `TonightSolarSystem { windowText, weatherText, moon: TonightMoonEntry | null, entries (planets), noneText }`, and `TonightView.planets` to `solarSystem`, updating every reader.
- `TonightMoonEntry` holds:
  - `key: "moon"`, `name`;
  - `windowStart`, `windowEnd`, `bestTime`, `bestAt`, `bestDirection`;
  - `phaseText`: "Waxing gibbous · 78% lit";
  - `wholeDisc` and `detail` eyepiece lines, with `detail: null` when it is the same eyepiece as `wholeDisc`, and `wholeDiscFits`;
  - `reason`, `note` (the band's note), `seenText`.
- `noneText` is set only when both the Moon and the planets are absent. Its copy covers the Moon too.
- A Moon failure inside the block drops only the Moon (`moon = null`), not the planets. A failure of the whole block keeps the existing `null` behaviour.
- `TonightView.brightMoonText: string | null` is set only when the verdict is go or marginal, `window.kind === "window"` and `isBrightMoon(...)` is true. Its inputs come from `first.moon` (the outlook's night 1, `build.ts:289-296`). The text carries the rounded % lit. It is computed inside its own try/catch, so a failure gives `null` and never takes down the view.

#### 2. Formatter

**File**: `src/lib/tonight/format.ts`

**Intent**: Locale-aware Moon wording, following the planet helpers.

**Contract**:
- `moonPhaseText(band, fraction)`.
- `moonReasonLine(entry, timeZone)`: timing plus "highest N° at HH:MM", with the low warning below `MOON_LOW_ALTITUDE_DEG`.
- `moonEyepieceText(...)`: whole disc / detail / the "shows part of the disc" fallback.
- `brightMoonLine(fraction)`.
- All exported through `createFormatter`.

#### 3. Copy

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: All new Tonight copy in both locales, with parity enforced by the existing test.

**Contract**:
- `tonight.planets.heading` → "Solar system tonight" / "Układ Słoneczny dziś w nocy". The block may be renamed `tonight.solarSystem` if every reader moves with it.
- The `none` / `noneInClearHours` copy is updated to cover the Moon, and drops "for your telescope" where it would wrongly apply to the Moon.
- `weather.line` ("For planets: {level} — …" / "Dla planet: …", `en.ts:443`) is reworded for the whole section, for example "Between dusk and dawn: …". The `build.test.ts` assertions that pin it (`:632, 656, 689, 723`) move with it.
- A new `tonight.moon` block:
  - `phase[band]` names;
  - `lit({ percent })`;
  - `wholeDiscWith`, `detailWith`, `partDisc({ name })`;
  - reason phrases, including `low`;
  - `markObserved` (accessible name);
  - `note[band]`: seven fixed, hedged notes built from the research table (`research.md` §4). For example, waxing crescent names Mare Crisium, the Langrenus–Petavius chain and earthshine. Full names the rays of Tycho and Copernicus and bright Aristarchus, and suggests an optional Moon filter or low power for glare. Each note names features "near the shadow line".
- The bright-Moon line has two keys, so it never points at targets the page does not show (plan review F6):
  - `tonight.card.brightMoon({ percent })`, always shown with the line: "Bright Moon ({percent}% lit) up most of the dark hours: faint galaxies and nebulae will be washed out."
  - `tonight.card.brightMoonPointer`: "The Moon and planets below are better bets tonight." It is shown only when the view's `solarSystem` has a Moon entry or at least one planet.
  - The PL wording follows the same meaning.
  - `build.ts` exposes the pointer as part of `brightMoonText`, or as a separate `brightMoonPointer: boolean`; either way it is decided in the build, not the template.

#### 4. Components

**Files**:
- `src/components/tonight/TargetDetails.astro` (new, shared);
- `src/components/tonight/ObjectDetails.astro`, `PlanetCard.astro`;
- `MoonCard.astro` (new);
- `PlanetSection.astro` → `SolarSystemSection.astro`;
- `TonightContent.astro`, `VerdictCard.astro`.

**Intent**:
- Extract the window/best `dl` and the "Mark observed" link into `TargetDetails`, used by `ObjectDetails`, `PlanetCard` and `MoonCard` (S-01 review F10). Rendered output stays identical for objects and planets.
  - The two pieces are not adjacent today: the eyepiece and reason paragraphs sit between them. So `TargetDetails` renders the `dl`, then a default slot for those paragraphs, then the link.
  - The link's accessible name differs today: an sr-only id span in `ObjectDetails`, `aria-label` "Mark observed: Jupiter" in `PlanetCard`. So `TargetDetails` takes a prop that keeps each caller's current naming.
  - "Identical output" is checked by the Tonight and `tonight-all-objects` e2e specs (ObjectDetails also renders inside `ObjectRow` on `/tonight/all`), and by before/after screenshots of a ranked card and a planet card.
- `MoonCard` matches PlanetCard's tokens and layout.
- The section renders the Moon card first, then the planet list.
- The verdict card shows the bright-Moon line.

**Contract**:
- The section is `section[aria-labelledby="solar-system-heading"]`.
- The Moon card is outside the planet `ol`. The planet `ol` has an `aria-label`, so it is distinguishable.
- `VerdictCard` gets an optional `moonNote: string | null` prop, rendered as one line under the reason. Tokens only.
- `TonightContent`'s `showSections` and `nightsLink` use `solarSystem || ranking`.
- No palette classes, hex or `rgb()` (`no-hardcoded-colors.test.ts`). It must stay readable in red mode.

#### 5. Tests

**Files**:
- `src/lib/tonight/build.test.ts`, `format.test.ts`;
- `tests/e2e/planets-on-tonight.spec.ts`;
- `tests/e2e/moon-as-target.spec.ts` (new).

**Intent**:
- Pin the Moon view and the bright-Moon line on fixed nights in unit tests.
- Keep the real-clock e2e tolerant.

**Contract**:
- `build.test.ts`, Warsaw:
  - 2026-10-26, all-clear: Moon entry present, band `full`, `brightMoonText` set.
  - 2026-10-10: no Moon entry, no line.
  - A cloud no-go night: no line, and the Moon is limited to clear hours.
  - A no-darkness night: no line.
  - Planets-only and Moon-only nights: correct `noneText`.
  - Determinism: two builds with identical inputs give deep-equal `solarSystem.moon` and `brightMoonText`.
  - A Moon failure (mocked through the engine barrel, as the existing `rankPlanets` throw test does) drops only the Moon. The planets and the rest of the view stay.
- `format.test.ts`: EN/PL phase text, reason with the low warning, eyepiece fallback.
- The bright-Moon guarantee lives in `build.test.ts`, because Tonight always uses the real clock (`TonightContent.astro:51` passes `new Date()`, and the e2e forecast fixture is relative to `Date.now()`), so no night can be pinned on the preview. Assert that `brightMoonText` is set on 2026-10-26 and `null` on 2026-10-10, both Warsaw, all-clear.
- The planets e2e targets the section by its new heading and the planet list by its `aria-label`, not `section.locator("ol > li")` (`planets-on-tonight.spec.ts:29, 52`). Its no-planet branch (`:29-33`) expects the `none` text only when the section has neither a Moon card nor planets. On a Moon-only night (no planet cards, no `noneText`) it `test.skip`s with a reason.
- The Moon e2e uses an all-clear forecast and the English cookie:
  - if the Moon card is present: Mark observed → `/tonight?logged=moon` notice → seen pill on the Moon card → the entry in `/log`;
  - otherwise `test.skip` with a reason.
  - The spec runs on the real clock at the Madrid site, so it skips on roughly half of all days. It proves the logging flow when it runs; the unit tests on pinned nights carry the Moon content guarantees.
- **How to run the e2e (criterion 3.4):**
  - local Supabase running: `npx supabase start`;
  - the forecast stub: `FIXTURE_PORT=4400 node tests/e2e/forecast-fixture.mjs`, with `FORECAST_BASE_URL` pointing at it in `.dev.vars`;
  - `npm run build && npm run preview` (the build copies `.dev.vars`, so rebuild after changing it);
  - then `BASE_URL=http://localhost:4321 npm run test:e2e`.
  - The specs to run: `moon-as-target`, `planets-on-tonight`, `tonight-all-objects` (ObjectDetails is shared with `/tonight/all`), plus the existing Tonight specs.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (build, format, i18n parity, no-hardcoded-colors, red-theme)
- Type check and lint pass: `npx astro check && npm run lint`
- Production build succeeds: `npm run build`
- E2E specs pass locally against local Supabase (moon-as-target, planets-on-tonight, existing Tonight specs)

#### Manual Verification:

- Playwright screenshots of Tonight with a Moon card on the local preview: EN and PL, dark, light and red, at phone width (about 390 px) and desktop; the Moon card reads first in "Solar system tonight", eyepieces and note are legible, red mode has no non-red colour
- On a pinned bright-Moon night (stubbed forecast, local preview), the verdict card shows the bright-Moon line and the deep-sky ranking is unchanged; on a new-moon night it is absent
- Mark observed on the Moon from Tonight lands in the log as "Moon" / "Księżyc" and Tonight shows the seen pill

**Note on 3.6**: a pinned night cannot be shown on the preview, because Tonight uses the real clock. Check 3.6 is carried by the `build.test.ts` assertion (bright on 2026-10-26, absent on 2026-10-10). Manually, screenshot tonight's verdict card and confirm that the line's presence or absence matches `isBrightMoon` for today's values. The row title stays as written.

**Implementation Note**: Per the user's standing instruction, run the manual checks yourself (local preview on local Supabase, plus Playwright screenshots) and tick them with that evidence. The user checks after merge and deploy.

---

## Testing Strategy

### Unit Tests:

- Engine:
  - Moon vs the Skyfield reference;
  - band lookup including the wrap-around;
  - whole-disc eyepiece rules;
  - `moonTarget` null/entry/masking/placement;
  - `isBrightMoon` thresholds, with literal inputs.
- Targets: the `moon` key, kind, label and picker.
- Tonight: the build view on pinned nights (bright, new, cloud no-go, no-darkness, Moon-only, planets-only) and the EN/PL formatter output.

### Integration Tests:

- `npm run test:db`: the DB check accepts `moon` and rejects junk. The trigger leaves `messier` null.
- E2E: Moon logging from Tonight (tolerant of the real clock), and the planets spec on the renamed section.

### Manual Testing Steps:

1. Local preview on local Supabase, all-clear forecast stub, today's real date: the Moon card is first whenever the Moon is up in the window, and the verdict line matches the bright-Moon rule for today. The pinned bright and new-Moon cases are covered by `build.test.ts`.
2. Switch EN↔PL and dark/light/red at phone width, and screenshot each.
3. Mark the Moon observed, then check the notice, the seen pill and the log entry. Edit and delete the entry.
4. The planets section still works under the new heading. The new-moon case (no Moon card, no line) is pinned in `build.test.ts`.

## Performance Considerations

The Moon adds one `moonTrack` over the solar-system window per Tonight build, small next to the deep-sky ranking. The bright-Moon line reuses the outlook's values and adds no ephemeris work. The Free-plan CPU cap no longer applies (Workers Paid since 2026-09-30).

## Migration Notes

The migration is additive (it only widens a CHECK). The app deployed before it never writes `moon`, and CI's `migrate` runs before `deploy`. Rolling the app back after Moon entries exist would leave rows whose label falls through to the old app's Messier branch. This is the same accepted risk as S-01's planet rows.

## References

- Research: `context/changes/moon-as-target/research.md`
- Pattern: `context/archive/2026-09-30-planets-on-tonight/plan.md`, `src/lib/engine/planet-ranking.ts:126-164`, `src/lib/tonight/build.ts:376-424`
- Deferred extraction: `context/archive/2026-09-30-planets-on-tonight/reviews/impl-review-phase-3.md:146-154` (F10)
- Roadmap: `context/foundation/roadmap.md` S-02; GitHub #66
- External: RASC *Explore the Moon* (https://www.rasc.ca/sites/default/files/EtM_Telescope_V4_1.pdf), Sky at Night "How to observe the Moon", Astronomy magazine Moon filters, the S&T Q&A on lunar skyglow (snippet)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Moon engine

#### Automated

- [x] 1.1 Unit tests pass: `npm test` (new Moon tests, existing planet tests unchanged) — fe51005
- [x] 1.2 Moon positions agree with the committed Skyfield reference within the stated tolerances — fe51005
- [x] 1.3 Engine purity and determinism tests stay green — fe51005
- [x] 1.4 Type check passes: `npx astro check` — fe51005
- [x] 1.5 Lint passes: `npm run lint` — fe51005

### Phase 2: The Moon in the log

#### Automated

- [x] 2.1 Migration applies on local Supabase: `npx supabase db reset` — 4d31bc3
- [x] 2.2 DB isolation and target tests pass: `npm run test:db` — 4d31bc3
- [x] 2.3 Generated types show no drift: `npm run db:types` then `git diff --exit-code src/lib/database.types.ts` — 4d31bc3
- [x] 2.4 Unit tests pass: `npm test` — 4d31bc3
- [x] 2.5 Type check and lint pass: `npx astro check && npm run lint` — 4d31bc3

#### Manual

- [x] 2.6 On the local dev server against local Supabase, the manual log picker finds "Moon" / "Księżyc" by name, an entry saves, and it shows in the log by name in EN and PL — 4d31bc3

### Phase 3: The Moon on Tonight

#### Automated

- [x] 3.1 Unit tests pass: `npm test` (build, format, i18n parity, no-hardcoded-colors, red-theme)
- [x] 3.2 Type check and lint pass: `npx astro check && npm run lint`
- [x] 3.3 Production build succeeds: `npm run build`
- [x] 3.4 E2E specs pass locally against local Supabase (moon-as-target, planets-on-tonight, existing Tonight specs)

#### Manual

- [x] 3.5 Playwright screenshots of Tonight with a Moon card on the local preview: EN and PL, dark, light and red, at phone width (about 390 px) and desktop; the Moon card reads first in "Solar system tonight", eyepieces and note are legible, red mode has no non-red colour
- [x] 3.6 On a pinned bright-Moon night (stubbed forecast, local preview), the verdict card shows the bright-Moon line and the deep-sky ranking is unchanged; on a new-moon night it is absent
- [x] 3.7 Mark observed on the Moon from Tonight lands in the log as "Moon" / "Księżyc" and Tonight shows the seen pill
