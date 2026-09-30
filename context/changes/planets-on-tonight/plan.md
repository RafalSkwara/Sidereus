# Planets on Tonight Implementation Plan

## Overview

Roadmap M-2 · S-01 (`planets-on-tonight`, GitHub #65), the milestone's first slice. Tonight gains a "Planets tonight" section above the deep-sky top five. It lists every planet that clears the site's minimum altitude between civil dusk and civil dawn (sun below −6°) on a night whose planet-window weather is go or marginal. Each card shows the planet's best window, time and direction, its magnitude, apparent size, phase (Mercury, Venus) or ring tilt (Saturn), one detail eyepiece from the user's kit, a placement reason and a short fixed "what you'll see" note, in English and Polish. A planet can be marked observed, so the observation log stops being Messier-only.

## Current State Analysis

- The engine ranks fixed J2000 catalogue positions only. `objectTracks` (`src/lib/engine/objects.ts:43`) shares one J2000→horizontal rotation per sample, and `rankObjects` (`src/lib/engine/ranking.ts:137`) scores the Messier catalogue over the **dark window** with a Messier-shaped `RankableObject`.
- `buildTonight` (`src/lib/tonight/build.ts:240`) ranks only when tonight's verdict is go or marginal **and** there is a dark window. `verdict()` returns `no-go / no-darkness` for a `DarkWindow` of kind `none` (`src/lib/engine/verdict.ts:74`). Planets need neither darkness nor the dark window.
- `darkWindow(site, night, thresholdDeg)` (`src/lib/engine/sun.ts:52`) takes any threshold, so `darkWindow(site, night, −6)` is already a civil-twilight window in the `DarkWindow` shape. `verdict()` accepts it unchanged.
- `astronomy-engine` provides `Equator(body, date, observer, ofdate, aberration)`, `Horizon(date, observer, ra, dec, "normal")` and `Illumination(body, date)`. `Illumination` returns `mag`, `phase_fraction`, `geo_dist` (AU) and `ring_tilt` for Saturn. Only Jupiter's radius is exported as a constant; the other radii are fixed physical values.
- The observation log is keyed by Messier number end to end:
  - database: `observations.messier smallint not null check 1..110` (`supabase/migrations/20260926200000_observations.sql:15`);
  - validation and storage: `observationInputSchema.messier` (`src/lib/observations/schemas.ts:54`), and every store method (`src/lib/observations/store.ts`);
  - URLs: the `formRedirect` prefill and `logNotice` (`src/lib/observations/redirect.ts`), `?logged=<n>` (`src/pages/api/log/index.ts:33`, `src/pages/tonight.astro:16`);
  - pages and picker: the log pages (`src/pages/log/index.astro`, `[id].astro`, `new.astro`), the picker (`MessierPicker.tsx`, `messier-search.ts`, `messier-options.ts`);
  - ranking: `LogEntry.messier` / `seenSummaries` (`src/lib/engine/log.ts`) and `rankObjects`'s `seen` map, which is keyed by number.
- CI runs `migrate` before `deploy` (`.github/workflows/*.yml`, the `migrate` job comment). The old app briefly runs against the new schema, so a migration must keep the old app's Messier-number inserts and reads working.
- The coordinate-privacy lint globs (`eslint.config.js` `gearConfig.files`) already cover `src/lib/tonight/**`, `src/lib/observations/**`, `src/pages/api/log/**`, `src/pages/log/**` and `src/components/tonight/**`. The engine is guarded by `purity.test.ts`.

## Desired End State

On a night whose planet-window weather is go or marginal, a signed-in user with a site and telescope opens Tonight and sees "Planets tonight" above the deep-sky ranking. This also applies on a cloud no-go night that has a clear spell in twilight, and on a no-darkness summer night. The section lists each qualifying planet, best-placed first, with:

- window, best time and direction;
- magnitude and apparent size, with phase for Mercury and Venus and ring tilt for Saturn;
- one detail eyepiece with its magnification, when the kit has eyepieces;
- a reason line, and a warning when the planet is low;
- a fixed note on what to expect;
- "Mark observed", with the "Seen N times – last …" tag when it applies.

Uranus and Neptune appear only with an aperture of 130 mm or more. Marking a planet observed saves it to the log. The log lists it by its localised name, the manual-entry picker finds planets by name, and editing or deleting it works like a Messier entry. The Messier experience is unchanged.

Verification: `npm test` (planet positions agree with a committed Skyfield/DE421 reference), `npm run test:db` (target identity, the sync trigger, isolation) and the e2e specs (mark a planet observed from Tonight, then see it in the log); manual checks cover the UI on the dev server.

### Key Discoveries:

- A civil window is `darkWindow(site, night, PLANET_WINDOW_SUN_ALTITUDE_DEG)` and planet weather is `verdict(civilWindow, forecast, { fallback })`: no new window type and no new verdict rule (`src/lib/engine/sun.ts:52`, `src/lib/engine/verdict.ts:69`).
- The Messier catalogue's `id` is already `"M31"` (`TonightEntry.id`, `src/lib/tonight/build.ts:53`), so it can serve directly as the Messier target key.
- The `bestWindow(track, minAltitudeDeg)` helper (`src/lib/engine/objects.ts:80`) works on any `HorizontalPosition[]` and can be reused for planets.
- `tonightDateFor` switches to the evening ahead once the **dark** window has ended (`src/lib/engine/sun.ts:99`), so morning-twilight planets after dark-window end belong to the next night's view (accepted, see NOT doing).
- Earlier checkpoints got their independent reference from a throwaway Skyfield virtualenv in the scratchpad (`context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md:8`). `de421.bsp` exists at `~/projects/de421.bsp`.

## What We're NOT Doing

- The Moon as a target (S-02), non-Messier deep sky (S-03), double stars (S-04), the timeline (S-05).
- Planets on `/tonight/all` or in the seven-night strip: the all-objects page stays the deep-sky list, and the timeline (S-05) will combine them.
- Mixing planets into the deep-sky top five or its calibration: the Messier ranking, its bar and its reasons are untouched.
- A log penalty for planets: the "seen" tag shows, but the order ignores the log, since planets are worth revisiting every night.
- Mars phase, planetary moons' positions, Jupiter's Great Red Spot timing, Saturn's moons.
- Showing the morning-twilight planets of the current dawn once the dark window has ended (Tonight has already moved to the evening ahead).
- Dropping `observations.messier`: kept, trigger-synced, for a later contract migration once no old app can be running.
- The finding eyepiece for planets: one detail eyepiece only.
- Stellarium hand-captured planet fixtures (the Skyfield reference is the automated check; #19 stays open for Stellarium).

## Implementation Approach

The work goes inside out. Phase 1 adds the pure planet engine with its own tests and the independent reference. Phase 2 generalises the log from a Messier number to a **target key** (`"M31"`, `"jupiter"`) with an additive migration and no visible change. Phase 3 wires planets into Tonight and the log UI. Every new tunable number is a documented candidate in `parameters.ts`.

**Target key grammar**, one island-safe module:

- Messier: `M1`…`M110`, the catalogue `id`.
- Planets: `mercury`, `venus`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`.

The grammar is closed. S-02 and S-03 extend it together with the database check.

**Candidate parameters** (new, uncalibrated, in `src/lib/engine/parameters.ts`):

- `PLANET_WINDOW_SUN_ALTITUDE_DEG = -6`: the planet window is sun below civil dusk.
- `ICE_GIANT_MIN_APERTURE_MM = 130`: Uranus and Neptune are listed only at or above this aperture.
- `PLANET_SCORE_WEIGHTS = { placement: 0.6, size: 0.4 }`:
  - placement = clamp((peak altitude − site minimum) ÷ (`WELL_PLACED_ALTITUDE_DEG` − site minimum));
  - size = clamp(apparent diameter ÷ `PLANET_SIZE_REFERENCE_ARCSEC`).
- `PLANET_SIZE_REFERENCE_ARCSEC = 30`.
- `PLANET_LOW_ALTITUDE_DEG = 20`: a peak below this gets the "low" reason.
- `MAX_MAGNIFICATION_PER_MM = 2` and `MAX_MAGNIFICATION = 250`: the useful magnification ceiling is min(2 × aperture mm, 250).

## Critical Implementation Details

**State sequencing (migration).** CI applies the migration before the new app deploys, so for a short window the old app writes `messier` only, and the new app must be able to write `target` only.

- A `BEFORE INSERT OR UPDATE` trigger fills `target` from `messier` when `target` is null.
- The same trigger fills `messier` from a Messier `target` when `messier` is null.
- `target` can still be `NOT NULL`, because `NOT NULL` is checked after `BEFORE` row triggers.
- If both columns are given and disagree, the row is rejected, so the two columns can never drift apart.

**Performance constraints.** Planet positions use `Equator(..., ofdate=true, aberration=true)` per body per sample. There are 7 bodies at a 10-minute step over a civil window of up to ~16 h, so ≲700 calls per Tonight render on top of the deep-sky ranking. Compute the planet tracks once per render. Re-measure `/tonight` CPU against the Free-plan trigger (#22) at the end of Phase 3 and record the figure on #22.

## Phase 1: Planet engine

### Overview

A pure, deterministic planet module in the engine: tracks over the civil window, which planets qualify, their score and order, their facts, and the detail eyepiece. It is checked against an independent Skyfield/DE421 reference.

### Changes Required:

#### 1. Candidate parameters

**File**: `src/lib/engine/parameters.ts`

**Intent**: Add the planet candidates listed in Implementation Approach, each with a doc comment naming it a candidate from S-01 planning (M-2, 2026-09-30) and what it controls.

**Contract**: New exports `PLANET_WINDOW_SUN_ALTITUDE_DEG`, `ICE_GIANT_MIN_APERTURE_MM`, `PLANET_SCORE_WEIGHTS`, `PLANET_SIZE_REFERENCE_ARCSEC`, `PLANET_LOW_ALTITUDE_DEG`, `MAX_MAGNIFICATION_PER_MM`, `MAX_MAGNIFICATION`. The file keeps no runtime imports (island-safe).

#### 2. Planet catalogue and positions

**File**: `src/lib/engine/planets.ts` (new)

**Intent**: The seven planets (key, `astronomy-engine` `Body`, equatorial radius in km, whether it is an ice giant) and their tracks over an interval. Planets move, so positions are of-date `Equator` + refracted `Horizon` at each sample, not the J2000 rotation path used for fixed objects.

**Contract**:

- `PLANET_KEYS` (the seven keys in solar order) and `type PlanetKey`.
- `planetTracks(site, interval, keys, stepMinutes = DEFAULT_TRACK_STEP_MINUTES): HorizontalPosition[][]` on the same `sampleInstants` grid as `objectTracks`.
- `planetFacts(key, time): { magnitude, apparentDiameterArcsec, phaseFraction, ringTiltDeg | null }`:
  - diameter = 2·atan(radius ÷ (geo_dist AU × 149 597 870.7 km)) in arcseconds;
  - `ringTiltDeg` only for Saturn.

#### 3. Planet ranking

**File**: `src/lib/engine/planet-ranking.ts` (new)

**Intent**: Decide which planets appear tonight and in what order. A planet is listed when:

- its track over the planet window has a best window at or above the site's minimum altitude (`bestWindow`);
- it is not an ice giant under `ICE_GIANT_MIN_APERTURE_MM`.

There is no score bar. Order is by planet score descending, and ties follow solar order.

**Contract**: `rankPlanets({ site, minAltitudeDeg, planetWindow: Extract<DarkWindow, { kind: "window" }>, telescope, eyepieces, seen? }): PlanetEntry[]`. Each `PlanetEntry` has:

- `key`;
- `window: BestWindow` and `peak`;
- `score: { placement, size, total }`;
- `facts`, at the peak instant;
- `eyepiece: PlanetEyepiece | null`;
- `placement`: `"high" | "well" | "low"`, where low is a peak below `PLANET_LOW_ALTITUDE_DEG` and high is a peak at or above `WELL_PLACED_ALTITUDE_DEG`;
- `timing`: `"evening" | "night" | "morning"`, by which third of the planet window holds the peak;
- `seen: SeenSummary | null`.

#### 4. Planet eyepiece

**File**: `src/lib/engine/eyepieces.ts`

**Intent**: The eyepiece for planetary detail. It is the one with the highest magnification that keeps the exit pupil at or above `EXIT_PUPIL_FLOOR_MM` and stays at or below the useful ceiling, min(`MAX_MAGNIFICATION_PER_MM` × aperture, `MAX_MAGNIFICATION`).

- If every eyepiece breaks those limits, use the lowest-magnification eyepiece.
- With an empty kit there is no eyepiece (`null`).
- Ties go to the earlier eyepiece.

**Contract**: `planetEyepiece<E>(telescope, eyepieces: readonly E[]): E | null`.

#### 5. Log keyed by target

**File**: `src/lib/engine/log.ts`, `src/lib/engine/ranking.ts`

**Intent**: The engine's view of the log names objects by target key rather than Messier number, so planets and Messier objects share one "seen" computation. The ranking looks up `seen` by `object.id`.

**Contract**:

- `LogEntry.target: string` replaces `messier`.
- `seenSummaries` returns `ReadonlyMap<string, SeenSummary>`.
- `RankInput.seen` is keyed by string.
- `RankableObject` gains `id`.
- The ranking's order tiebreak stays on `messier`.

#### 6. Barrel

**File**: `src/lib/engine/index.ts`

**Intent**: Export the new planet API and types.

**Contract**: `planetTracks`, `planetFacts`, `PLANET_KEYS`, `rankPlanets`, `planetEyepiece`, and types `PlanetKey`, `PlanetEntry`, `PlanetFacts`.

#### 7. Independent reference fixture

**File**: `scripts/planet-reference.py` (new), `src/lib/engine/fixtures/skyfield/planets-warsaw-2026-10-10.json` (new), `src/lib/engine/fixtures/README.md`

**Intent**: An automated cross-check that doesn't depend on the engine's own library. The script runs in a throwaway scratchpad virtualenv with Skyfield and DE421 (never installed in the repo). It records the apparent altitude/azimuth (standard refraction) and the apparent diameter of each planet for the Warsaw public reference point at hourly instants through the 2026-10-10 civil window. The JSON carries provenance (Skyfield version, ephemeris, generation date). The README gets a short section on the `skyfield/` folder and how to regenerate it.

**Contract**: JSON of `{ provenance, site, samples: [{ time, planet, altitudeDeg, azimuthDeg, apparentDiameterArcsec }] }`.

#### 8. Tests

**File**: `src/lib/engine/planets.test.ts`, `src/lib/engine/planet-ranking.test.ts`, `src/lib/engine/eyepieces.test.ts`, `src/lib/engine/log.test.ts`, `src/lib/engine/ranking.test.ts`, `src/lib/engine/determinism.test.ts`

**Intent**: Behaviour worth locking down, not constants or copy:

- positions agree with the Skyfield fixture within `ALTITUDE_TOLERANCE_DEG`, and diameters within 1″ (or 2% for the smallest);
- the ice-giant aperture gate;
- a planet below the minimum altitude for the whole window is absent;
- the order follows the score, with ties in solar order;
- the low/high placement and the evening/morning timing edges;
- the planet eyepiece picks the ceiling-respecting one, falls back to the lowest magnification, and returns null for an empty kit;
- `seenSummaries` keyed by target;
- `rankPlanets` is deterministic, via the existing determinism suite.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the Skyfield planet reference: `npm test`
- Engine purity guard still passes with the new files: `npm test -- purity`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`

#### Manual Verification:

- On the Warsaw 2026-10-10 fixture night, the listed planets and their order look sensible against a planetarium view (Stellarium or Stellarium Web): Saturn and the evening planets well placed, anything low flagged low

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Target identity in the observation log

### Overview

The log stores, validates, carries in URLs and displays a **target key** instead of a Messier number. The migration is additive and backward-compatible with the old app. Messier behaviour is unchanged. The manual-entry picker can also find planets.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_observation_target.sql` (new)

**Intent**: Add `target`, backfill it from `messier`, and keep the two columns consistent for old and new app code (see Critical Implementation Details).

**Contract**:

- `target text` with a check against the closed key grammar: `^M([1-9]|[1-9][0-9]|10[0-9]|110)$` or one of the seven planet keys.
- Backfill `'M' || messier`, then `NOT NULL`.
- `messier` becomes nullable and keeps its 1..110 check.
- A `BEFORE INSERT OR UPDATE` sync trigger:
  - fills a missing `target` from `messier`;
  - fills a missing `messier` from a Messier `target`;
  - clears `messier` when `target` changes to a non-Messier key;
  - raises on a mismatch.
- An index on `(user_id, target)` isn't needed: reads filter by user and order by night.
- RLS policies are unchanged.

#### 2. Generated types

**File**: `src/lib/database.types.ts`

**Intent**: Regenerate after the migration.

**Contract**: `npm run db:types`, and CI's drift check stays green.

#### 3. Target key module

**File**: `src/lib/targets/index.ts` (new), `src/lib/targets/index.test.ts` (new)

**Intent**: One island-safe home for the key grammar, used by schemas, stores, routes, pages and the picker.

**Contract**:

- `isTargetKey(value): value is TargetKey`.
- `messierKey(n)`.
- `parseTargetParam(value)`: accepts a key, or legacy bare digits `"31"` → `"M31"` for old links; returns `null` otherwise.
- `targetKind(key)`: `"messier" | "planet"`.
- Planet keys are imported type-only from the engine's parameters/planets, so no runtime engine import reaches islands.

#### 4. Display names

**File**: `src/lib/targets/labels.ts` (new), `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: How a target is named on the log pages, notices and picker:

- Messier: id plus localised common name, as now.
- Planets: localised name, e.g. "Jupiter" / "Jowisz".

**Contract**:

- `targetLabel(key, locale): { id: string; name: string | null }`.
- New catalogue keys `targets.planet.<key>` for the seven names in EN and PL.

#### 5. Engine-facing log read and store

**File**: `src/lib/observations/store.ts`, `src/lib/observations/schemas.ts`

**Intent**: Validate and write `target`, and read `target` for display and ranking. Error-message keys and privacy rules are unchanged.

**Contract**:

- `observationInputSchema.target` (form field `target`) refined by `isTargetKey`, error `errors.observation.objectInvalid`.
- `ObservationRecord.target` replaces `messier`.
- `listForRanking` selects `target, night, rating` with a deterministic order (night desc, target asc), per lessons.md.
- `remove` returns `{ ok: true, target }`.
- Inserts and updates write `target` only; the trigger fills `messier`.

#### 6. Routes, redirects and notices

**File**: `src/lib/observations/redirect.ts`, `src/pages/api/log/index.ts`, `src/pages/api/log/[id].ts`, `src/pages/api/log/[id]/delete.ts`, `src/pages/tonight.astro`

**Intent**: Carry target keys in `?object=`, `?saved=`, `?updated=`, `?deleted=` and `?logged=`. Accept the legacy digit form on read. Keys are fixed-grammar values, so no free text or coordinates reach a URL.

**Contract**:

- `formRedirect` carries `target` as `object`.
- `logNotice(kind, target)`.
- The Tonight `logged` notice resolves the key via `parseTargetParam` + `targetLabel`.

#### 7. Log pages and picker

**File**: `src/pages/log/index.astro`, `src/pages/log/[id].astro`, `src/pages/log/new.astro`, `src/components/observations/ObservationForm.tsx`, `src/components/observations/MessierPicker.tsx` → `TargetPicker.tsx`, `src/lib/observations/messier-search.ts` → `target-search.ts`, `src/lib/observations/messier-options.ts` → `target-options.ts` (with their tests)

**Intent**:

- Entries show via `targetLabel`.
- `/log/new?object=` accepts any target key.
- The manual picker lists the seven planets after the Messier objects, searchable by localised and English name.
- Number queries ("31", "m31") keep matching Messier objects exactly as today.

**Contract**:

- `TargetOption { key, id, label, detail, names }` replaces `MessierOption`.
- `filterTargets(options, query)`: same ranking rules, with the numeric-query path limited to Messier options.
- The form posts `target`.

#### 8. Tonight's log wiring

**File**: `src/lib/tonight/load.ts`, `src/lib/tonight/build.ts`, `src/components/tonight/*.astro`

**Intent**: Messier entries link to the log with their key. The ranking's `seen` map is keyed by `object.id`.

**Contract**: `logHref(view, target: string)`. `TonightEntry` keeps `messier` for common-name lookup, and its `id` is the target key.

#### 9. Tests

**File**: `tests/db/observations.test.ts`, `tests/db/isolation.test.ts`, `src/lib/observations/*.test.ts`, `tests/e2e/observation-log*.spec.ts`

**Intent**: The contract changes, not copy:

- the trigger fills `target` for a `messier`-only insert (the old app) and `messier` for a Messier-key insert;
- a planet key inserts with `messier` null;
- an invalid key and a mismatched pair are rejected;
- isolation holds with the new column;
- schema and redirect tests for keys, including legacy digits;
- `filterTargets` finds planets by PL/EN name, and "3" still lists M3 first;
- the existing log e2e specs pass with key-based URLs.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly to local Supabase: `npx supabase db reset`
- Generated types are current: `npm run db:types` produces no diff
- Database suite passes, including trigger-sync and isolation cases: `npm run test:db`
- Unit tests pass: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Observation-log e2e specs pass: `npx playwright test observation-log`
- Smoke passes against local Supabase: `npm run smoke`

#### Manual Verification:

- On the dev server against local Supabase, logging, editing and deleting a Messier entry looks and behaves exactly as before (notices name the object)
- The manual-entry picker finds "Jowisz" / "Jupiter" and saves a Jupiter entry that the log lists by name
- An old-style link `/log/new?object=31` still opens the form for M31

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Planets on Tonight

### Overview

The Tonight view model, the planet-window weather gate and the "Planets tonight" section with its cards, copy in EN and PL, "Mark observed" into the log, an e2e check and the CPU re-measurement.

### Changes Required:

#### 1. View model

**File**: `src/lib/tonight/build.ts`

**Intent**: Compute the planet window, `darkWindow(site, night, PLANET_WINDOW_SUN_ALTITUDE_DEG)` for tonight's date, and judge its weather with `verdict(planetWindow, forecast, { fallback })`. This is independent of the dark-window verdict.

- When that window exists and its level is go or marginal, build `planets` from `rankPlanets` with the user's log.
- Otherwise `planets` is `null`: the section is hidden, and the verdict card already explains why.
- When no planet qualifies, `planets.entries` is empty (the section shows a one-line "no planets well placed" note).
- The weather line is set only when the planet verdict tells the user something the main card doesn't, i.e. the main verdict is no-go or there is no dark window.

**Contract**:

- `TonightView.planets: TonightPlanets | null`.
- `TonightPlanets { windowText, weatherText: string | null, entries: TonightPlanetEntry[] }`.
- `TonightPlanetEntry { key, name, windowStart, windowEnd, bestTime, bestAt, bestDirection, magnitudeText, sizeText, phaseText | null, ringText | null, eyepiece: EyepieceLine | null, reason, note, seenText | null }`.
- The existing fields and the ranking gate are unchanged.

#### 2. Wording

**File**: `src/lib/tonight/format.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Localised text for the new fields:

- section heading, window line, weather line and "no planets" line;
- magnitude and size ("mag −2.4 · 44″"), phase ("62% lit"), ring tilt ("rings tilted 4°");
- the detail-eyepiece line;
- reason lines by placement × timing ("High in the south around 22:10 — best-placed planet tonight", "Low in the west — look soon after dusk");
- the seven fixed "what you'll see" notes, written for a 100–200 mm scope and conservative, e.g. Uranus and Neptune "a tiny blue-green disc".

All numbers are formatted by locale; PL parity is enforced by the existing test.

**Contract**:

- New `createFormatter` members `planetFactsText`, `planetReasonLine`, `planetWindowText`.
- New catalogue subtree `tonight.planets.*`.
- `targets.planet.<key>` names come from Phase 2.

#### 3. Section and card

**File**: `src/components/tonight/PlanetSection.astro` (new), `src/components/tonight/PlanetCard.astro` (new), `src/components/tonight/TonightContent.astro`

**Intent**: Render the section above the deep-sky ranking and below the verdict card. It shows whenever `view.planets` is set, including when `view.ranking` is null. Cards follow `ObjectCard`'s structure and tokens, work in all three themes, and link "Mark observed" with `logHref(view, entry.key)`.

**Contract**: `<PlanetSection planets={view.planets} logHref={...} />`. No new colours; theme tokens only (the no-hardcoded-colours test).

#### 4. Tests

**File**: `src/lib/tonight/build.test.ts`, `tests/e2e/planets-on-tonight.spec.ts` (new)

**Intent**:

- Build cases: planets present on a go night; present on a cloud no-go night whose twilight is clear; present on a no-darkness night whose planet window passes; `null` when the planet window is clouded out; ice giants gated by aperture; `seenText` after a logged planet.
- E2E: with the forecast fixture, Tonight shows the section, "Mark observed" on a planet saves it, and the log lists it by name.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Planet e2e spec passes: `npx playwright test planets-on-tonight`
- Full e2e suite passes (no Tonight regressions): `npx playwright test`
- Production build succeeds: `npm run build`

#### Manual Verification:

- On the dev server, Tonight shows "Planets tonight" above the top five, with sensible facts, eyepiece, reason and note for each planet, in EN and PL and in dark, light and red themes
- With a forecast that is clear only in twilight (fixture or `FORECAST_BASE_URL` override), the section still shows under a no-go verdict with its weather line
- "Mark observed" on a planet lands in the log, the Tonight notice names it, and the card then shows the "Seen" tag
- `/tonight` CPU time re-measured against the Free-plan trigger and the figure recorded on GitHub #22

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Planet positions and diameters against the Skyfield/DE421 fixture.
- Selection rules: minimum altitude, ice-giant gate, score order and tie order.
- Placement and timing buckets; the planet-eyepiece ceiling and fallbacks.
- Target key grammar and legacy digit parsing; picker search across Messier and planets.
- Tonight view: the planet-window gate independent of the dark-window verdict.

### Integration Tests:

- `test:db`: trigger sync both ways, rejection of invalid or mismatched keys, isolation with `target`.
- E2E: existing observation-log specs with key URLs; the new planet mark-observed flow.

### Manual Testing Steps:

1. Open Tonight on the dev server and check the planet cards against Stellarium Web for the same place and time.
2. Switch to PL and to the red theme; read every planet card.
3. Mark Jupiter observed, see it in the log, edit its rating, delete it.
4. Use the manual entry picker to log Saturn by typing "sat" and "Sat".
5. Force a no-darkness night (a Tromsø-like site in June) and confirm planets still appear when the twilight is clear.

## Performance Considerations

Planet tracks add ≲700 `Equator` evaluations per Tonight render. Compute them once per render, and don't recompute per card or per facts lookup: facts are taken at the peak instant only. The re-measurement against #22 closes Phase 3. If CPU gets close to the trigger, coarsen the planet step (e.g. 20 min) before optimising code, as `DEFAULT_TRACK_STEP_MINUTES`' comment advises.

## Migration Notes

The migration is additive and backward-compatible with the running old app, through the trigger.

- **Rollback of the app:** safe. The old app reads `messier`, which the trigger keeps filled for Messier entries.
- **Planet rows:** have `messier` null. After a code-only rollback (`wrangler rollback`) the old app renders them as "Mnull", and its edit form shows "null" and fails validation. No data is lost, and the forward path is safe (impl review F3).
- **Contract step:** dropping `messier` and the trigger is a later change, once S-02/S-03 settle the full key grammar and no rollback to the pre-target app is possible any more.

## References

- Roadmap item: `context/foundation/roadmap.md` → S-01 (GitHub #65)
- Lessons applied: `context/foundation/lessons.md` (filter and order per-user list queries; coordinate lint globs; Tonight island needs JavaScript)
- Similar implementation: `src/lib/engine/ranking.ts:137` (track-once ranking), `src/lib/engine/objects.ts:80` (`bestWindow`)
- Independent-reference precedent: `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Planet engine

#### Automated

- [x] 1.1 Unit tests pass, including the Skyfield planet reference: `npm test` — e67723a
- [x] 1.2 Engine purity guard still passes with the new files: `npm test -- purity` — e67723a
- [x] 1.3 Type check passes: `npx astro check` — e67723a
- [x] 1.4 Lint passes: `npm run lint` — e67723a

#### Manual

- [x] 1.5 On the Warsaw 2026-10-10 fixture night, the listed planets and their order look sensible against a planetarium view (Stellarium or Stellarium Web): Saturn and the evening planets well placed, anything low flagged low — e67723a

### Phase 2: Target identity in the observation log

#### Automated

- [x] 2.1 Migration applies cleanly to local Supabase: `npx supabase db reset` — 4cfdc3f
- [x] 2.2 Generated types are current: `npm run db:types` produces no diff — 4cfdc3f
- [x] 2.3 Database suite passes, including trigger-sync and isolation cases: `npm run test:db` — 4cfdc3f
- [x] 2.4 Unit tests pass: `npm test` — 4cfdc3f
- [x] 2.5 Type check passes: `npx astro check` — 4cfdc3f
- [x] 2.6 Lint passes: `npm run lint` — 4cfdc3f
- [x] 2.7 Observation-log e2e specs pass: `npx playwright test observation-log` — 4cfdc3f
- [x] 2.8 Smoke passes against local Supabase: `npm run smoke` — 4cfdc3f

#### Manual

- [x] 2.9 On the dev server against local Supabase, logging, editing and deleting a Messier entry looks and behaves exactly as before (notices name the object) — 4cfdc3f
- [x] 2.10 The manual-entry picker finds "Jowisz" / "Jupiter" and saves a Jupiter entry that the log lists by name — 4cfdc3f
- [x] 2.11 An old-style link `/log/new?object=31` still opens the form for M31 — 4cfdc3f

### Phase 3: Planets on Tonight

#### Automated

- [ ] 3.1 Unit tests pass: `npm test`
- [ ] 3.2 Type check passes: `npx astro check`
- [ ] 3.3 Lint passes: `npm run lint`
- [ ] 3.4 Planet e2e spec passes: `npx playwright test planets-on-tonight`
- [ ] 3.5 Full e2e suite passes (no Tonight regressions): `npx playwright test`
- [ ] 3.6 Production build succeeds: `npm run build`

#### Manual

- [ ] 3.7 On the dev server, Tonight shows "Planets tonight" above the top five, with sensible facts, eyepiece, reason and note for each planet, in EN and PL and in dark, light and red themes
- [ ] 3.8 With a forecast that is clear only in twilight (fixture or `FORECAST_BASE_URL` override), the section still shows under a no-go verdict with its weather line
- [ ] 3.9 "Mark observed" on a planet lands in the log, the Tonight notice names it, and the card then shows the "Seen" tag
- [ ] 3.10 `/tonight` CPU time re-measured against the Free-plan trigger and the figure recorded on GitHub #22
