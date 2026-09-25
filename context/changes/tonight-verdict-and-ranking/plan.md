# Tonight Verdict and Ranking Implementation Plan

## Overview

Build roadmap slice S-02, the north star: a signed-in user with a site and a telescope opens `/tonight` and sees a go / marginal / no-go verdict with its reason and the dark window in the site's time zone. On a go or marginal night they also see up to five ranked Messier objects, each with its best window, peak time, altitude and compass direction, constellation, a finding and detail eyepiece pair from their own kit, and a one-line reason that leads with what sets it apart. The slice ends with a recorded three-night sanity check that answers the roadmap's cut checkpoint (Open Roadmap Question 12).

## Current State Analysis

- **Engine (F-01) provides the geometry and nothing more.** The barrel `src/lib/engine/index.ts:6-13` exports `observingNight`, `darkWindow`, `moonState`/`moonTrack`, `moonSeparationDeg`, `objectPosition`/`objectTrack`/`objectTracks` and `bestWindow`. There is no score, verdict, limiting magnitude, eyepiece optics or forecast type anywhere.
- **Tunables:** `src/lib/engine/parameters.ts` holds only `darknessThresholdDegForBortle` (OQ 7), the ephemeris tolerances (OQ 9), `DEFAULT_TRACK_STEP_MINUTES` and `DEFAULT_MIN_ALTITUDE_DEG` (OQ 8). OQ 1-5 are absent from code.
- **Catalogue:** `src/lib/catalogue/index.ts:30-51`. `vMag` is present for all 110 objects. `surfaceBrightness` is null for 70, `majorAxisArcmin` is null for 2 (M40, M73) and `minorAxisArcmin` is null for 62. `type` is one of 12 `MESSIER_TYPES`.
- **Gear (S-01):** `siteStore`, `telescopeStore` and `eyepieceStore` all have `list()` ordered by `created_at` ascending (`src/lib/gear/store.ts:145,214,275`). `toEngineSite` (`store.ts:139`) carries only lat/long/time zone, so `bortle` and `minAltitudeDeg` are passed separately.
- **Performance:** the engine's full run (dark window + moon + 110 object tracks, 10-min step) measures **4.8 ms warm / 18.4 ms cold** locally (`determinism.test.ts`, run on 2026-09-25). Cloudflare Workers Free caps CPU at 10 ms per request (`context/foundation/infrastructure.md:64-66`). The risk register already names the trigger for upgrading to Paid (`infrastructure.md:249`).
- **Forecast:** entirely greenfield. There is no client, type or env var, and `wrangler.jsonc` has only the `ASSETS` binding. The docs fix Open-Meteo plus a Workers KV `FORECAST_CACHE` with about a 1 h per-site lifetime (`tech-stack.md:33`, `infrastructure.md:117,279-282`, `shape-notes.md:538`).
- **Pages:** gated routes are listed in `PROTECTED_ROUTES` (`src/middleware.ts:4`). `GearShell` (Layout + Topbar) is the page shell, the Topbar's signed-in nav has only "My gear" (`src/components/Topbar.astro:14-18`), and there is no attribution component. The UI is hand-styled dark and amber (`bg-cosmic`, `amber-*`).
- **Tests:** Vitest in a node environment (`vitest.config.ts`), with no fetch mocking anywhere. The smoke walk is in `scripts/smoke.mjs:47-98`. The CI `ci` and `smoke` jobs are in `.github/workflows/ci.yml`.

## Desired End State

- `/tonight` is gated. For the user's oldest site and oldest telescope, both named on the page, it renders:
  - the verdict and its reason;
  - the dark window in the site's time zone;
  - on go or marginal: "N objects cleared the bar tonight" and up to 5 object cards;
  - on no-go, or when the site has no dark window: the verdict and reason in place of the ranking.
- With no site or no telescope, the page shows a short prompt linking to `/gear`. With no eyepieces, the ranking shows without eyepiece pairs.
- With Open-Meteo unreachable and no cached forecast, the verdict is "marginal — no weather data" and the ranking still shows.
- Everything in the ranking and the verdict is deterministic for identical inputs, and all numbers come from `parameters.ts`.
- The Tonight link is in the Topbar, and OpenNGC (CC BY-SA 4.0) and Open-Meteo (CC BY 4.0) are credited on the page.
- The page is deployed with the `FORECAST_CACHE` KV binding (namespace created in Phase 2), its CPU time has been observed, and `checkpoint.md` records the three-night sanity verdict. Roadmap question 12 is answered.

Verify with `npm test`, `npm run lint`, `npx astro check`, `npm run build`, the smoke walk (now including `/tonight`), and the Phase 4 checkpoint record.

### Key Discoveries:

- `bestWindow(track, minAltitudeDeg)` returns the longest contiguous run with its peak, and the caller must pass the dark window as the interval (`src/lib/engine/objects.ts:70-96`, F-01 `plan.md:296`).
- `moonTrack` and `objectTracks` both sample through `sampleInstants(interval, step)` (`src/lib/engine/sampling.ts:12-24`, `moon.ts:66-67`), so over the same interval and step their samples line up index by index. The moon component relies on this.
- `objectTracks` computes the rotation once per instant for all targets (`objects.ts:43`), which makes it the ranking's hot path.
- `darkWindow` returns `{kind:"none"}` when the threshold is never reached (`types.ts:35-56`). S-02 shows the verdict without a ranking, and S-04 adds the explanation.
- Moon separation ignores topocentric parallax (up to about 1°) (F-01 `tolerance-report.md:60-61`). This doesn't matter here, because the chosen moon component does not use separation.
- The purity guard (`src/lib/engine/purity.test.ts:17-31`) forbids clock, env, fetch, fs and locale-implicit formatting under `src/lib/engine/`. Forecast I/O and display formatting therefore live outside the engine.

## What We're NOT Doing

- Observation-log penalty and the "seen N times" tag (OQ 6): S-06. The ranking takes no log input yet.
- The telescope selector, and full empty states and gear-deletion states (FR-019 multi-telescope, FR-021): S-08. Site switching and the 7-night view: S-05.
- No-go "next good night", the no-darkness cause and return date, and forecast-age display or outage wording (FR-020, FR-023, NFR outage): S-04. S-02 only guarantees that the page never blanks.
- Red night mode (S-10), onboarding and presets (S-03), redirecting sign-in to `/tonight` (sign-in keeps landing where it does today).
- Moon-separation weighting, sky-brightness models, seeing and transparency.
- Shared grid-cell forecast caching (parked in the roadmap), and a Supabase forecast table.
- Calibrating the tunables. Phase 4 records evidence for it; changing values is a later decision.
- Automating the deploy (F-02). Deploys stay manual via `npx wrangler deploy`.

## Implementation Approach

Pure core first, I/O second, UI third, evidence last.
- **Phase 1** puts every S-02 tunable into `parameters.ts` and builds the scoring, ranking, eyepiece pairing and reason selection as pure engine functions with explicit, typed, JSON-friendly inputs and outputs. That is the "tool-callable shape" the PRD keeps.
- **Phase 2** adds the pure `verdict()` and a forecast layer outside the engine, with the fetch function and the cache passed in so unit tests need no network or KV.
- **Phase 3** composes both into a server-rendered page without islands.
- **Phase 4** deploys, measures CPU, and runs the independent recompute-and-review checkpoint.

## Critical Implementation Details

- **Performance constraints.** Compute object tracks once, with `objectTracks` over the dark window at `DEFAULT_TRACK_STEP_MINUTES`, and the moon track once on the same grid. Every component reads those arrays. Never call `objectTrack`/`objectPosition` per object inside the ranking. The ranking's total budget (engine + scoring) stays under 1000 ms locally, and the Workers CPU measurement in Phase 4 decides Free vs Paid.
- **Timing & lifecycle.** "Tonight" is the observing night containing `now` in the site's time zone. Before local noon, that is the previous evening's night (the `observingNight` noon-to-noon convention). A user opening the page at 01:30 sees the night in progress, not the next one.
- **Privacy.** Coordinates go only into the Open-Meteo request. KV keys use the site id. Error paths log nothing and surface fixed strings, following the `store.ts` discipline. The eslint `no-console: "error"` scope and `observability.redact_query_string` enforce this (Phase 2 §5-6).

## Phase 1: Scoring core

### Overview

All S-02 tunables become named candidates, and the object score, ranking, eyepiece pairing and reason selection exist as pure, deterministic engine functions, with unit tests and a timing test.

### Changes Required:

#### 1. Tunables

**File**: `src/lib/engine/parameters.ts`

**Intent**: Give every number S-02 uses a named, documented candidate value next to the existing ones (OQ 1-5 plus the new tunables agreed in planning), so nothing is hardcoded elsewhere.

**Contract**: New exports, each with a comment naming its Open Question or "S-02 planning, 2026-09-25":
- `SCORE_WEIGHTS = { duration: 0.35, moon: 0.30, brightness: 0.25, sky: 0.10 }` (OQ 1)
- `MIN_OBJECT_SCORE = 0.45` (OQ 3)
- `MAX_RANKED_OBJECTS = 5` (FR-013)
- `EXIT_PUPIL_CEILING_MM = 5.5` and `EXIT_PUPIL_FLOOR_MM = 0.7` (OQ 4)
- `FOV_FIT_FRACTION = 0.8`: the object's major axis must be ≤ this share of the true field of view
- `nakedEyeLimitingMagForBortle(bortle)`: 1→7.6, 2→7.1, 3→6.6, 4→6.1, 5→5.6, 6→5.1, 7→4.6, 8→4.3, 9→4.0. Throws like `darknessThresholdDegForBortle`.
- `EYE_PUPIL_REFERENCE_MM = 7`
- `BRIGHTNESS_RAMP_MAG = 4`
- `SURFACE_BRIGHTNESS_PENALTY_THRESHOLD = 21` (mag/arcsec²)
- `bortlePenaltyForBortle(bortle)`: 0 at 1-2, rising linearly to 0.40 at 8, 0.40 at 9 (OQ 5)
- `PENALIZED_TYPES_WITHOUT_SURFACE_BRIGHTNESS`: galaxy, nebula, emission-nebula, reflection-nebula, supernova-remnant (the OQ 5 fallback)
- `VERDICT_THRESHOLDS = { goCloudPct: 30, goRunHours: 2, marginalCloudPct: 65, marginalRunHours: 1, humidityCapPct: 90 }` (OQ 2; consumed in Phase 2 but declared here with its siblings)

`parameters.ts` stays safe for the browser: `src/lib/gear/schemas.ts`, which runs in the browser, imports it. The new type list therefore uses `import type { MessierType }` and never imports the catalogue (or anything else with runtime weight) at runtime.

#### 2. Object score

**File**: `src/lib/engine/score.ts` (new), exported through the barrel

**Intent**: Turn one object's night into four 0–1 component values and a weighted total, using only precomputed tracks and plain inputs.

**Contract**: `scoreObject(input: ScoreInput): ObjectScore | null`
- `ScoreInput` holds:
  - the catalogue object (`vMag`, `surfaceBrightness`, `type`, `majorAxisArcmin`);
  - its track over the dark window;
  - the moon track on the same grid;
  - `minAltitudeDeg`, `bortle` and `apertureMm`.
- Returns `null` when `bestWindow(track, minAltitudeDeg)` is `null`. This enforces the invariant that an object below the minimum altitude throughout the dark window never ranks.
- `ObjectScore = { window: BestWindow, components: { duration, moon, brightness, sky }, total }`, where each component is in [0, 1] and `total = Σ SCORE_WEIGHTS[c] × components[c]`. The components:
  - `duration` = samples in the best window ÷ samples in the dark-window track.
  - `moon` = 1 − (the Moon's illuminated fraction at the object's peak instant × the share of the best-window samples with the Moon's altitude > 0).
  - `brightness` = clamp((limit − vMag) ÷ `BRIGHTNESS_RAMP_MAG`, 0, 1), with limit = `nakedEyeLimitingMagForBortle(bortle)` + 5·log10(apertureMm ÷ `EYE_PUPIL_REFERENCE_MM`).
  - `sky` = 1 − penalty. The penalty is `bortlePenaltyForBortle(bortle)` when `surfaceBrightness` is known and fainter than (numerically greater than) the threshold, or when it is null and the type is in the penalized set. Otherwise the penalty is 0.

#### 3. Eyepiece pairing

**File**: `src/lib/engine/eyepieces.ts` (new), exported through the barrel

**Intent**: Implement FR-014 over the user's own kit, honouring the PRD invariant that an object not fitting an eyepiece's true field is never recommended for it.

**Contract**:
- `eyepieceOptics(telescope, eyepiece)` returns `{ magnification, exitPupilMm, trueFovDeg }`: magnification = telescope focal length ÷ eyepiece focal length, exit pupil = aperture ÷ magnification, true field = AFOV ÷ magnification.
- `pairEyepieces(telescope, eyepieces, majorAxisArcmin)` returns `EyepiecePair | { kind: "none-fit" } | null`:
  - `null` when the kit is empty.
  - An eyepiece is **eligible** when the object fits (the major axis in degrees ≤ `FOV_FIT_FRACTION` × true field; a null major axis always fits).
  - **Finding** = the eligible eyepiece with the widest true field and exit pupil ≤ ceiling; if no eligible eyepiece is under the ceiling, the eligible one with the widest true field.
  - **Detail** = the eligible eyepiece with the highest magnification and exit pupil ≥ floor; if there is none, the finding eyepiece.
  - `{ kind: "none-fit", widest: EyepieceRecord }` when no eyepiece is eligible. This is not a pairing, so the fit invariant holds. It carries the widest-field eyepiece only so the UI can advise "Larger than any field in your kit; use your widest (25 mm) and sweep across it".
  - Ties go to the lower eyepiece id order as given (callers pass `created_at` order).

#### 4. Ranking and reason selection

**File**: `src/lib/engine/ranking.ts` (new), exported through the barrel

**Intent**: Score the whole catalogue for one site, night and telescope, keep the ones clearing the bar, and pick each listed object's leading reason component.

**Contract**: `rankObjects(input: RankInput): Ranking`
- `RankInput` = `{ site: Site, bortle, minAltitudeDeg, darkWindow (kind "window"), telescope, eyepieces, catalogue }`.
- Computes `objectTracks` and `moonTrack` once over the dark window, then scores each object.
- Drops `null` scores, sorts by `total` descending with ties broken by Messier number ascending, and computes `clearedCount` (objects with total ≥ `MIN_OBJECT_SCORE`).
- `Ranking = { clearedCount, entries: RankedEntry[] (first MAX_RANKED_OBJECTS of the cleared), telescopeId }`.
- `RankedEntry = { object, score, peak: HorizontalPosition, pair, leadComponent, secondComponent }`.
- The lead component is the component c maximising `SCORE_WEIGHTS[c] × (value_c − mean of value_c over the listed entries)`; ties go in the order duration, moon, brightness, sky, and the second component is the runner-up. With one entry, lead with the largest weighted value instead.

#### 5. Tests

**Files**: `src/lib/engine/score.test.ts`, `eyepieces.test.ts`, `ranking.test.ts` (new); extend `src/lib/engine/determinism.test.ts`

**Intent**: Pin every formula and edge case with synthetic inputs, and prove that the full ranking is deterministic and within budget.

**Contract**:
- **Score:** each component at its boundaries (object up the whole window → 1, no moon → 1, full moon up throughout → 0, vMag at and beyond the ramp, the surface-brightness penalty vs the type fallback).
- **Eyepieces:** a 150/750 telescope with a 25 mm and a 10 mm Plössl gives finding 25 mm and detail 10 mm. Also: a single eyepiece fills both roles; a floor violation falls back; M31 with that kit gives `none-fit` with `widest` = 25 mm; M40 with no size fits everything; an empty kit gives `null`.
- **Ranking:** the invariant that nothing below the minimum altitude ranks; the tie-break by Messier number; `clearedCount` counts beyond 5; the lead/second choice on a hand-made list, including the single-entry case.
- **Determinism and timing:** `rankObjects` for Warsaw on 2026-10-10 twice gives deep-equal results, and it runs under 1000 ms locally (logged on CI, the existing pattern).

#### 6. Calibration amendment (approved at manual check 1.6, 2026-09-25)

**Files**: `src/lib/engine/parameters.ts`, `score.ts`, `ranking.ts` and their tests

**Intent**: The formulas as first planned saturated. On Warsaw 2026-10-10 the top 5 was M34, M39, M52 and M103 tied at 1.000, then M40 (a double star). M31, M45 and M13 were absent, and even a mag-20 galaxy would clear 0.45. The user approved desaturating the score before building on it.

**Contract** (supersedes the matching parts of §1, §2 and §4):
- `BRIGHTNESS_RAMP_MAG = 8` (was 4).
- `WELL_PLACED_ALTITUDE_DEG = 40` (new). `duration` = Σ over best-window samples of clamp((alt − minAltitudeDeg) ÷ (40 − minAltitudeDeg), 0, 1) ÷ samples in the dark-window track: an altitude-weighted share rather than a raw sample share.
- `scoreObject` returns `null` when `vMag` is fainter than the telescope's limiting magnitude. Such an object is impossible to see and never ranks, like the minimum-altitude invariant. `telescopeLimitingMag` is exported.
- `LOW_INTEREST_TYPES = ["double-star", "asterism"]` and `LOW_INTEREST_PENALTY = 0.15` (new): subtracted from the total, floored at 0.
- Reason fallback: an entry with no positive weighted deviation leads with its largest weighted values.
- Result with the same inputs: Oct 10 → M31, M34, M39, M45, M52; Oct 24 (full moon) → M31, M34, M45, M52, M39 (18 cleared); 2027-01-15 → M44, M81, M37, M35, M36; 2027-08-05 → M39, M31, M71, M15, M29. Known limit carried to Phase 4: from 52°N, M42 peaks at 32° and scores 0.60 in January, so it stays out of the top 5.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with the new score, eyepiece and ranking tests green
- The determinism test covers `rankObjects` and asserts identical output on repeat runs
- The timing test asserts a full `rankObjects` run under 1000 ms locally
- The purity guard still passes with the new engine files
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- Skim the ranked output the agent prints (via a throwaway, uncommitted test file run by vitest) for Warsaw 2026-10-10 (Bortle 6, 150/750, 25 mm + 10 mm Plössl): the top 5 contains no object you would call impossible from that place and date, and each lead reason reads plausibly

**Implementation Note**: After this phase and all automated verification pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Verdict and forecast

### Overview

A pure verdict function in the engine, and a forecast layer outside it that fetches Open-Meteo hourly cloud and humidity data through a per-site KV cache. The fetch function and cache are passed in so tests need no network or KV.

### Changes Required:

#### 1. Forecast and verdict types, verdict function

**File**: `src/lib/engine/verdict.ts` (new), exported through the barrel; the types go in `src/lib/engine/types.ts`

**Intent**: Decide go / marginal / no-go for one dark window from hourly forecast data, following OQ 2 with the short-night scaling and the "no weather data" rule agreed in planning.

**Contract**:
- `HourlyForecast = { hours: { start: Date; cloudCoverPct: number; humidityPct: number }[] }`, where each hour is `[start, start + 1 h)`.
- `verdict(darkWindow: DarkWindow, forecast: HourlyForecast | null): Verdict`, with `Verdict = { level: "go" | "marginal" | "no-go", reason: VerdictReason }`.
- Rules:
  - `darkWindow.kind === "none"` → no-go, reason `no-darkness`.
  - `forecast === null` → marginal, reason `no-weather-data`.
  - Otherwise, the relevant hours are those overlapping the dark window; an hour missing from the forecast counts as not clear.
  - Let n = the number of overlapping hours. **Go** needs a contiguous run of ≥ min(`goRunHours`, n) hours below `goCloudPct`. **Marginal** needs ≥ min(`marginalRunHours`, n) hours below `marginalCloudPct`. Otherwise no-go.
  - Humidity above `humidityCapPct` in any overlapping hour caps a go at marginal.
- `VerdictReason` is a discriminated union that carries what the UI needs to phrase it: `clear-run` (run hours, cloud %), `humidity-cap` (max humidity), `cloudy` (best run), `no-weather-data`, `no-darkness`.

#### 2. Observing-night date for an instant

**File**: `src/lib/engine/night.ts`

**Intent**: Give the page a pure way to find "tonight" for a given instant and time zone.

**Contract**: `observingNightDateFor(instant: Date, timeZone: string): string` returns the `YYYY-MM-DD` evening date of the observing night that contains `instant` (before local noon it returns the previous date). It is consistent with `observingNight` across the 2026-10-25 DST night.

#### 3. Open-Meteo client

**File**: `src/lib/forecast/open-meteo.ts` (new)

**Intent**: Fetch hourly cloud cover and humidity for a site, with the fetch function passed in and a short timeout, and map the response into `HourlyForecast`.

**Contract**:
- `fetchForecast(fetchFn: typeof fetch, site: { latitudeDeg; longitudeDeg }): Promise<HourlyForecast>`.
- It calls `GET <base>/v1/forecast` with `latitude`, `longitude`, `hourly=cloud_cover,relative_humidity_2m`, `timezone=GMT`, `timeformat=unixtime`, `past_days=1` and `forecast_days=3`, and `AbortSignal.timeout(3000)`.
  - `past_days=1` is required: the hourly series otherwise starts at 00:00 UTC today (verified live on 2026-09-25), so a night in progress after UTC midnight would lose its evening hours, and those count as "not clear".
- `<base>` defaults to `https://api.open-meteo.com` and can be overridden by an optional server env `FORECAST_BASE_URL` (added to the `astro:env` schema in `astro.config.mjs`, `optional: true`). The override exists only to simulate an outage locally (manual check 3.6).
- It throws an `Error` with a fixed, value-free message on non-2xx, timeout or schema mismatch (validate with zod). It never logs.

#### 4. Forecast cache and service

**Files**: `src/lib/forecast/cache.ts` (new), `src/lib/forecast/kv-cache.ts` (new), `src/lib/forecast/service.ts` (new)

**Intent**: Serve a fresh (< 1 h) cached forecast per site, refetch otherwise, fall back to the last good copy on failure, and return `null` only when nothing usable exists.

**Contract**:
- `ForecastCache { get(key): Promise<string | null>; put(key, value, { expirationTtl }): Promise<void> }`.
- `kvForecastCache()` wraps `env.FORECAST_CACHE` from `cloudflare:workers` and returns a no-op cache when the binding is absent. It is the only file importing `cloudflare:workers`, and only the page imports it.
- `getForecast({ fetchFn, cache, siteId, coords, now }): Promise<{ forecast: HourlyForecast; fetchedAt: Date } | null>`:
  - Key `forecast:v1:site:<siteId>`. The stored value is `{ fetchedAt, lat, lon, hours }`.
  - A cached entry is used when it is younger than 60 minutes and its lat/lon equal the site's current coordinates (so an edited site refetches).
  - Otherwise it fetches and stores the result with `expirationTtl` 7 days (keeping a stale copy for S-04). On a fetch error it returns any stored entry whose coordinates match, whatever its age, and otherwise `null`.
  - Cache read/write errors behave like a miss and are never thrown.

#### 5. KV namespace, binding and types

**Files**: `wrangler.jsonc`, `worker-configuration.d.ts` (new, generated), `package.json`, `eslint.config.js`, `.prettierignore`

**Intent**: Create the real production `FORECAST_CACHE` namespace now, so `main` is always deployable. Declare the binding (workerd simulates it locally in dev and preview) and type it for `astro check`.

**Contract**:
- Create the namespace with `npx wrangler kv namespace create FORECAST_CACHE` (or the connected Cloudflare MCP). This needs Cloudflare auth; prompt the user if it is missing.
- Commit its real id as `kv_namespaces: [{ binding: "FORECAST_CACHE", id: "<real id>" }]`.
- Also set `observability.redact_query_string: true`, so that if Workers Traces is ever turned on, the Open-Meteo query string (the coordinates) is not captured.
- Add an npm script `"cf:types": "wrangler types"` and commit its root `worker-configuration.d.ts`, which `tsconfig.json`'s `**/*` include picks up. It declares `cloudflare:workers` and `FORECAST_CACHE: KVNamespace`. The adapter ships no such types, and `Astro.locals.runtime.env` throws in this adapter version, so it is not used.
- Add the generated file to the eslint ignores and `.prettierignore`.
- Rerun `npm run cf:types` whenever `wrangler.jsonc` bindings change.

#### 6. Privacy lint scope

**File**: `eslint.config.js`

**Intent**: Extend the existing value-free-logging guard to the new code that handles coordinates and site data.

**Contract**: the `no-console: "error"` block (`eslint.config.js:82`) also covers `src/lib/forecast/**`, `src/lib/tonight/**` and `src/pages/tonight.astro`.

#### 7. Tests

**Files**: `src/lib/engine/verdict.test.ts`, `src/lib/engine/night.test.ts` (extend), `src/lib/forecast/*.test.ts` (new)

**Intent**: Pin the verdict rules, including the short-night scaling, and the cache and fallback behaviour, with a fake fetch and an in-memory cache.

**Contract**:
- **Night in progress:** at 01:30 local (after UTC midnight) the verdict still uses the previous evening's hours, fed through the client mapping of a `past_days=1` response.
- **Verdict:** a 2 h run at 20% → go; a 1 h run at 50% → marginal; everything overcast → no-go; a 40-minute dark window overlapping one clear hour → go; humidity 95% caps go → marginal; a missing hour breaks a run; null forecast → marginal/no-weather-data; `none` dark window → no-go/no-darkness.
- **Night date:** 01:30 local maps to the previous date; 13:00 maps to the same date; the DST night.
- **Forecast:** a fresh hit makes no fetch; a stale entry triggers a refetch; a coordinate change triggers a refetch; fetch fails with a stale copy → the stale copy is returned; fetch fails with no copy → `null`; malformed JSON → a fixed error; cache throwing → treated as a miss; the response mapping from Open-Meteo `unixtime` arrays.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with the verdict, night-date and forecast tests green
- The purity guard passes (no fetch or clock in `src/lib/engine/`); `src/lib/forecast/` is the only place that calls fetch
- `npm run lint`, `npx astro check` and `npm run build` pass with the real `FORECAST_CACHE` namespace id and generated binding types committed

#### Manual Verification:

- Review a live forecast the agent fetches for a test coordinate (via a throwaway, uncommitted test file run by vitest), printed as the mapped hourly rows next to Open-Meteo's own JSON for the same hours: the values and UTC hours match

**Implementation Note**: After this phase and all automated verification pass, pause for manual confirmation before Phase 3.

---

## Phase 3: Tonight page

### Overview

A gated, server-rendered `/tonight` page composing the gear, forecast, verdict and ranking, with minimal empty states, a Topbar link, the attribution credit, and a smoke step.

### Changes Required:

#### 1. Tonight composition and formatting

**Files**: `src/lib/tonight/build.ts` (new), `src/lib/tonight/format.ts` (new)

**Intent**: Turn the stored gear, the forecast result and `now` into a view model the page renders without logic, and keep every time and direction format in one place.

**Contract**:
- `buildTonight({ site: SiteRecord, telescope: TelescopeRecord, eyepieces: EyepieceRecord[], forecast, now }): TonightView`:
  - evening date via `observingNightDateFor`;
  - dark window with `darknessThresholdDegForBortle(site.bortle)`;
  - `verdict`;
  - `rankObjects` only when the verdict level is go or marginal and the dark window is a window.
- `TonightView` carries: site name, telescope name, date, verdict, the dark window formatted in the site's time zone, `ranking | null` and whether eyepieces exist.
- `format.ts`:
  - `formatTime(date, timeZone)` → `HH:mm`, via `Intl.DateTimeFormat` with an explicit `timeZone`.
  - `compassPoint(azimuthDeg)` → a 16-wind point.
  - `formatDirection(position)` → `"SW, 45°"`.
  - `reasonLine(entry, context)` → the FR-015 line, leading-component phrase first, then the second (e.g. "Up for 5 h 10 min of the dark window · bright for your 150 mm").
  - `verdictReasonText(verdict)`.
- Each phrase has one fixed template per component.

#### 2. Page and components

**Files**: `src/pages/tonight.astro` (new), `src/components/tonight/VerdictCard.astro`, `ObjectCard.astro`, `Attribution.astro` (new)

**Intent**: Render the view in the existing dark and amber style inside `GearShell`, with fixed error strings and no islands.

**Contract**:
- The page reads `Astro.locals.supabase` and renders `DatabaseMissing` when it is null. It lists sites, telescopes and eyepieces with the `load()`-style isolation and fixed messages, and picks `sites[0]` and `telescopes[0]`. It calls `getForecast` with the global `fetch`, `kvForecastCache()` and `new Date()`, then `buildTonight`.
- **Empty states:** no site → "Add an observing site to see tonight" linking to `/gear/sites/new`; no telescope → the equivalent for telescopes.
- The header names the site and telescope ("Home · Skywatcher 150P") with a link to `/gear`.
- The ranking section shows "N objects cleared the bar tonight". When `clearedCount` is 0 on a go or marginal night, it shows "No object cleared the bar tonight" instead of an empty list.
- Each object card shows:
  - name, common name and constellation;
  - window start–end;
  - "best HH:mm, SW 45°";
  - finding and detail eyepiece names with magnification. On `none-fit` it shows "Larger than any field in your kit; use your widest (<name>) and sweep across it"; with no eyepieces the pair line is left out;
  - the reason line.
- `Attribution` credits "Object data: OpenNGC (CC BY-SA 4.0) · Weather: Open-Meteo (CC BY 4.0)" with links.

#### 3. Routing and navigation

**Files**: `src/middleware.ts`, `src/components/Topbar.astro`

**Intent**: Gate the page and make it reachable.

**Contract**: add `"/tonight"` to `PROTECTED_ROUTES`, and put a "Tonight" link before "My gear" in the signed-in nav.

#### 4. Tests and smoke

**Files**: `src/lib/tonight/*.test.ts` (new), `scripts/smoke.mjs`

**Intent**: Pin the composition and formatting, and prove that the page renders end to end.

**Contract**:
- **Unit tests:** no-go → `ranking` is null; no dark window → `ranking` is null; null forecast → marginal with a ranking; a go night with `clearedCount` 0 → the view carries an empty ranking the page renders as "No object cleared the bar tonight"; `compassPoint` at 0/22.5/45/359°; `formatTime` across the 2026-10-25 DST change; reason-line templates.
- **Smoke steps:** "tonight redirects anonymous user" (302 to sign-in) near the start; "tonight renders for signed-in user" (200) after the gear-creation steps; "tonight redirects after signout" at the end.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with the tonight composition and format tests green
- `npm run lint`, `npx astro check` and `npm run build` pass
- CI's smoke job passes with the three new Tonight steps

#### Manual Verification:

- Against local Supabase with `npm run dev`, a user with one site, one telescope and two eyepieces sees the verdict, dark window and ranked cards with times in the site's zone; the Topbar link and attribution are present
- Deleting all eyepieces leaves the ranking without eyepiece lines; with no telescope, the page shows the add-a-telescope prompt
- Setting `FORECAST_BASE_URL` to an unreachable host in local `.dev.vars` shows "marginal — no weather data" with the ranking, never an error page

**Implementation Note**: After this phase and all automated verification pass, pause for manual confirmation before Phase 4.

---

## Phase 4: Deploy, CPU check and sanity checkpoint

### Overview

Ship the page (the KV namespace already exists from Phase 2), observe its CPU time against the recorded upgrade trigger, and run and record the independent three-night sanity check that answers the cut checkpoint.

### Changes Required:

#### 1. Deploy

**File**: `context/foundation/infrastructure.md`

**Intent**: Deploy from an up-to-date `main` after the S-02 PR merges (the namespace id is already committed in Phase 2), and record that the forecast cache exists.

**Contract**:
- `npx wrangler deploy` succeeds from `main`. This needs Cloudflare auth; prompt the user if it is missing.
- `infrastructure.md` deploy step 4 is marked done, with the date.

#### 2. CPU observation

**File**: `context/changes/tonight-verdict-and-ranking/checkpoint.md` (new)

**Intent**: Measure Tonight's Workers CPU time on real requests and apply the existing trigger rather than guessing.

**Contract**: record `cpuTime` for about 10 warm and 1-2 cold `/tonight` requests from Workers Logs (via the Cloudflare MCP or the dashboard), and note any `exceededCpu` / 1102. The decision follows `infrastructure.md:249`: any 1102, or a warm p95 above 8 ms, means flipping to Workers Paid, a user action with no redeploy.

#### 3. Independent sanity checkpoint

**File**: `context/changes/tonight-verdict-and-ranking/checkpoint.md`

**Intent**: Answer "is the top 5 sane?" for three nights without Telescopius, which cannot be read by the agent (its lists are drawn by JavaScript), by recomputing the sky independently and reviewing the picks.

**Contract**:
- **Combinations:**
  - Warsaw (52.23, 21.01), Bortle 6, 150/750 with 25 + 10 mm Plössls, 2026-10-10;
  - the same on 2026-10-24 (around the DST change, bright moon);
  - a darker site (Bortle 3) with an 80/400 and a single 20 mm, on a date the agent picks with a different season or moon, stated in the record.
- **For each:** Sidereus' verdict inputs, `clearedCount`, the top 5 with components and pairs; a recomputation of each listed object's window, peak altitude and azimuth, and the Moon's illumination and altitude using Python Skyfield in a throwaway virtualenv under the scratchpad (never a project dependency), with differences against the tolerance; the invariant checks (minimum altitude, inside the dark window, fits the field); and a comparison with published seasonal beginner Messier lists, with sources cited.
- A **sane / not sane** verdict per night and overall, with causes and any tunables suspected.
- Then update the roadmap's Open Roadmap Question 12 with the outcome, and note that PRD Success Criterion #2's "independent observation planner" was replaced by independent recompute plus published lists, with the reason.

### Success Criteria:

#### Automated Verification:

- `npx wrangler deploy` from an up-to-date `main` succeeds
- `checkpoint.md` exists with a CPU section and three night sections, each containing a top-5 table, a Skyfield comparison and an invariant check

#### Manual Verification:

- Open `/tonight` on production and confirm it renders with a live verdict (or "no weather data") for your own site
- Read `checkpoint.md` and accept or reject the sanity verdict and the Free/Paid outcome; the roadmap's question 12 entry reflects your decision

**Implementation Note**: This phase closes the slice. After it, run `/10x-impl-review` and then `/10x-archive`.

---

## Testing Strategy

### Unit Tests:

- Every scoring component at its boundaries, the eyepiece-pairing edges (empty kit, single eyepiece, none fit, unknown size, floor and ceiling), the ranking invariants and tie-breaks, and reason selection including a single entry.
- The verdict rules, including short-night scaling, the humidity cap, missing hours, no forecast and no darkness.
- The forecast cache: fresh, stale, coordinate change, fetch failure with and without a stale copy, and cache errors.
- Formatting: compass points, DST-safe times, reason templates.

### Integration Tests:

- The determinism and timing test for the full `rankObjects`.
- The smoke walk: anonymous redirect, signed-in render, post-signout redirect.

### Manual Testing Steps:

1. As a user with one site, one telescope and two eyepieces, open `/tonight` and read the verdict, window and cards.
2. Delete the eyepieces, then the telescope, and check both degraded states.
3. Break the forecast URL locally and confirm the no-weather-data verdict with the ranking.
4. After deploy, open production `/tonight` and read `checkpoint.md`.

## Performance Considerations

The engine share is 4.8 ms warm / 18.4 ms cold locally. Scoring adds linear work over about 110 objects × about 50 samples, which is small next to the trigonometry. The forecast wait does not count toward CPU. The Workers Free 10 ms cap is borderline, and Phase 4 measures it and applies the recorded trigger. If it has to be reduced later, lengthening the track step for the ranking is the first lever (a tunable), before any result caching.

## Migration Notes

No database migration. There's one new KV namespace (created in Phase 2), and the key prefix `forecast:v1:` lets a code rollback miss newer entries (`infrastructure.md:253`).

## References

- Roadmap item: `context/foundation/roadmap.md` S-02 (and Open Roadmap Question 12)
- PRD: `context/foundation/prd.md` FR-010, FR-013, FR-014, FR-015, FR-019, Business Logic invariants, Open Questions 1-8
- Engine contracts: `src/lib/engine/types.ts`, `objects.ts:70-96`, `moon.ts:66`, `sampling.ts:12`
- F-01 archive: `context/archive/2026-09-22-verified-ephemeris-core/` (plan.md, tolerance-report.md)
- S-01 archive: `context/archive/2026-09-24-sites-and-gear-management/`
- Infrastructure decisions and risk register: `context/foundation/infrastructure.md:64-66,117,249,253,279-282`
- Page pattern: `src/pages/gear/index.astro`, `src/components/gear/GearShell.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Scoring core

#### Automated

- [x] 1.1 `npm test` passes with the new score, eyepiece and ranking tests green
- [x] 1.2 The determinism test covers `rankObjects` and asserts identical output on repeat runs
- [x] 1.3 The timing test asserts a full `rankObjects` run under 1000 ms locally
- [x] 1.4 The purity guard still passes with the new engine files
- [x] 1.5 `npm run lint` and `npx astro check` pass

#### Manual

- [x] 1.6 Skim the ranked output the agent prints (via a throwaway, uncommitted test file run by vitest) for Warsaw 2026-10-10 (Bortle 6, 150/750, 25 mm + 10 mm Plössl): the top 5 contains no object you would call impossible from that place and date, and each lead reason reads plausibly

### Phase 2: Verdict and forecast

#### Automated

- [ ] 2.1 `npm test` passes with the verdict, night-date and forecast tests green
- [ ] 2.2 The purity guard passes (no fetch or clock in `src/lib/engine/`); `src/lib/forecast/` is the only place that calls fetch
- [ ] 2.3 `npm run lint`, `npx astro check` and `npm run build` pass with the real `FORECAST_CACHE` namespace id and generated binding types committed

#### Manual

- [ ] 2.4 Review a live forecast the agent fetches for a test coordinate (via a throwaway, uncommitted test file run by vitest), printed as the mapped hourly rows next to Open-Meteo's own JSON for the same hours: the values and UTC hours match

### Phase 3: Tonight page

#### Automated

- [ ] 3.1 `npm test` passes with the tonight composition and format tests green
- [ ] 3.2 `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 3.3 CI's smoke job passes with the three new Tonight steps

#### Manual

- [ ] 3.4 Against local Supabase with `npm run dev`, a user with one site, one telescope and two eyepieces sees the verdict, dark window and ranked cards with times in the site's zone; the Topbar link and attribution are present
- [ ] 3.5 Deleting all eyepieces leaves the ranking without eyepiece lines; with no telescope, the page shows the add-a-telescope prompt
- [ ] 3.6 Setting `FORECAST_BASE_URL` to an unreachable host in local `.dev.vars` shows "marginal — no weather data" with the ranking, never an error page

### Phase 4: Deploy, CPU check and sanity checkpoint

#### Automated

- [ ] 4.1 `npx wrangler deploy` from an up-to-date `main` succeeds
- [ ] 4.2 `checkpoint.md` exists with a CPU section and three night sections, each containing a top-5 table, a Skyfield comparison and an invariant check

#### Manual

- [ ] 4.3 Open `/tonight` on production and confirm it renders with a live verdict (or "no weather data") for your own site
- [ ] 4.4 Read `checkpoint.md` and accept or reject the sanity verdict and the Free/Paid outcome; the roadmap's question 12 entry reflects your decision
