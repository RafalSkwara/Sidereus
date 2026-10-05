# Interactive Tonight Sky Implementation Plan

## Overview

The `/tonight` dashboard's sky becomes a working view of tonight's sky. Under the verdict, a horizon panorama shows the real bright stars, the night's top five deep-sky targets, the planets and the Moon, each at its true altitude and azimuth. A slider moves the view from sunset to sunrise, with the dark window marked on its track, and the band's colour follows the Sun. Tapping a target opens its focused page. This is the S-11 follow-up named in `roadmap.md` (Interactive sky, user 2026-10-04) and in `context/handoff.md`, "Suggested next step" 1.

## Current State Analysis

- **The sky is static.** `TonightSky.astro` is server-rendered Astro and is never hydrated.
  - Its gradient sits on the outer div (`bg-linear-to-b from-zenith to-horizon`, `:35`).
  - Its 80 stars are a seeded, decorative field (Lehmer generator, `:20-32`), hidden in the light theme (`hidden dark:block`, `:36`).
  - The verdict's minimum height is at `:45`, and the horizon silhouette is at `:47-55`.
  - It draws no targets, and nothing in `src` maps alt/az to x/y.
- **The verdict sits inside the sky.** `TonightContent.astro:111-130` renders `<TonightSky verdict>` with `VerdictCard` in its slot, with `TonightTiles` below. `TonightSkeleton.astro:25` paints the same sky. Under `skyFlow`, the Topbar strip is `bg-zenith` (`GearShell.astro:26-27`).
- **The engine computes tracks and throws them away.**
  - `objectTracks` (`objects.ts:43`, one `Rotation_EQJ_HOR` per instant at `:52`), `planetTracks` (`planets.ts:52`) and `moonTrack` (`moon.ts:141`) all sample through `sampleInstants` (`sampling.ts:12`: start, every step, then the end).
  - `rankObjects` keeps only each target's peak (`ranking.ts:178`, `:83`). `TonightView` (`build.ts:308-358`) holds no numeric alt/az.
  - `sunAltitudeDeg` (`sun.ts:19`) and `sunEvents(site, night)` (`sun.ts:32`) exist; the latter returns `{sunset, sunrise}`, either of which can be `null`.
- **Tonight's build runs on every Tonight page.**
  - `buildTonight` runs on the dashboard and on all four focused pages through `loadTonightFor` (`load.ts:142`); the Targets page passes `limit: Infinity`.
  - Optional parts of the view use try/catch → `null`: `solarSystem` (`build.ts:596-640`) and `moonCard` (`build.ts:690-757`).
  - `solarSystem` is `null` when the planet window is clouded out (`build.ts:598`).
  - `ranking` is `null` on a weather no-go or when there is no dark window (`build.ts:518`).
- **The pattern to copy.** `MoonTimeSlider.tsx:57-123` is a native `<input type="range">` over states precomputed every 10 minutes (`build.ts:711-730`). Its Now button jumps to the state nearest `Date.now()`, clamped (`:92-100`, `nearestStateIndex`). It takes static children from `MoonCard.astro`. `MoonTimeSlider.test.ts:22-48` is the import guard.
- **Targets and links.**
  - The Targets page lists exactly `MAX_RANKED_OBJECTS = 5` (`parameters.ts:68`) before "the other N" (`TargetsPageContent.astro:61-62`).
  - `targets.astro:72-116` already scrolls to any `location.hash` element once the island renders. `planets.astro` has no such script.
  - `ObjectCard` rows carry `data-object` but no `id`; `PlanetCard` rows have neither.
- **Star data.**
  - astronomy-engine has no star catalogue. HYG v4.1 (`astronexus/HYG-Database`, `hyg/CURRENT/hygdata_v41.csv`, 33.9 MB, CC BY-SA 4.0, commit `c7f7f883fe678cc7680169a50ccd7dcc49b060ce`) has 925 stars at `mag ≤ 4.5` excluding Sol. 288 of them have `proper` names, and 6 have no `hip`.
  - The Messier generator (`scripts/build-catalogue.mjs`) is the pattern to follow.
  - `Attribution.astro` credits the data licences in the UI.
- **Constraints.**
  - Colours come only from tokens, and red has zero green and blue.
  - `no-hardcoded-colors.test.ts:28` flags any `(bg|fill|from|to…)-sky` class (`global.css:16-17`).
  - `contrast.test.ts` reads hex tokens only (`:95`); `:70` pins heading and muted text on zenith and horizon.
  - The no-console lint globs are in `eslint.config.js:85-106`.
  - `purity.test.ts` covers `src/lib/engine` and `src/lib/moon-disc`.
  - JavaScript is required inside the Tonight island (lessons.md).

## Desired End State

- **Layout.** On `/tonight` with a view, the sky band reads top to bottom:
  1. The verdict, unchanged.
  2. A horizon panorama strip about 200 px tall. Altitude 0–90° runs up from the horizon; azimuth runs left to right.
  3. The silhouette.
  4. On the ground below it, the time slider with its start and end times, the current time, a marked dark-window span and a Now button.
- **The panorama.**
  - It spans 180°, centred on south (on north for a southern-hemisphere site), and swipes sideways through the full 360°.
  - Stars down to magnitude 4.5 are drawn at their true positions, sized by brightness. Up to 15 of the brightest named stars that are above the horizon carry muted EN/PL labels.
  - Labelled markers show the top five ranked targets (when there is a ranking), every planet and the Moon, each only while above the horizon. Planets show even when the planet forecast is clouded out.
- **The slider.**
  - It spans sunset to sunrise in 10-minute steps.
  - It starts at Now when Now falls inside the range. Otherwise it starts at the dark window's start, or at the range start when there is no dark window.
  - Now jumps to the frame nearest the current time, clamped into the range.
  - Moving the slider moves every body. The band's gradient shifts from sunset glow through twilight to night as the Sun's altitude falls, and back towards dawn.
- **The taps.** A Messier marker opens `/tonight/targets#object-<id>`. A planet opens `/tonight/planets#planet-<key>` when it has a row there, and `/tonight/planets` otherwise. The Moon opens `/tonight/moon`. Each marker is a focusable link with a visible focus ring and an accessible name giving the body, its altitude and its direction at the slider time.
- **The credit.** HYG is credited in the attribution footer next to OpenNGC.
- **What stays as it is.**
  - The focused pages' sky, the setup and no-view states, and the skeleton keep the static `TonightSky`.
  - The browser never imports astronomy-engine or the engine. It only rotates J2000 star vectors with matrices sent by the server and draws positions the server already computed.

Verify with the e2e spec (Phase 4) and the screenshot matrix: EN/PL × dark/light/red × 390 px/desktop, at sunset, mid-twilight and deep night.

### Key Discoveries:

- `Rotation_EQJ_HOR(time, observer).rot` is a 3×3 `number[][]` (`astronomy.d.ts:497-498`). Sent to the browser, these matrices place any J2000 vector. Their HOR frame is x = north, y = west, z = zenith (`astronomy.d.ts:2521-2526`).
- `sampleInstants` gives every track over the same interval and step the same instants, so the frames, the Sun and every track index align.
- Top five = `MAX_RANKED_OBJECTS` = the Targets page's visible rows, so each Messier link lands on a row on screen. `ranked.entries[i].object` carries `raHours`/`decDeg` (`catalogue/index.ts:39-42`).
- `m.compass` (`en.ts:387`, `pl.ts:374`) is island-safe through `@/i18n`, so the island can name directions without `format.ts`.

## What We're NOT Doing

- No interactive sky on the focused pages (`TonightPageSky` stays static) or on the setup and no-view states. No skyView computation for the focused pages.
- No constellation lines or boundaries, no stars fainter than magnitude 4.5, no deep-sky targets beyond the top five, no washed-out objects on the sky.
- No all-sky dome or 360° squeeze view, no zoom, no pinch.
- No refraction for stars. They use the unrefracted rotation, ≤ 0.5° off at the horizon, which is under 2 px. Targets keep the engine's refracted tracks.
- No popover or label card on tap; a tap navigates.
- No change to the Moon page's own slider, the ranking or the verdict.
- No no-JS path. The sky is inside the Tonight island (lessons.md).
- No stars in the light theme: today's `hidden dark:block` rule stays, as CSS, so an in-page theme switch is honoured. Targets, planets and the Moon still show.
- No sunset-coloured skeleton. The skeleton keeps the night gradient, and the colour change when the island swaps in is accepted.

## Implementation Approach

The work splits server and browser along the line the Moon slider already drew. Delegated decisions (the user asked for questions on UI only) are recorded in the brief.

- **Server.**
  - Only when the dashboard asks (`withSkyView`), the server samples sunset to sunrise every 10 minutes.
  - It ships a compact, columnar `skyView`: the start instant and the step, a flat array of J2000→horizon rotations, the Sun's altitude per frame, and per body one flat array of alt/az in tenths of a degree.
- **Browser.**
  - It imports a small committed bright-star file (925 J2000 unit vectors), rotates each with the frame's matrix and projects it. Targets are only indexed by frame.
  - In live mode, the island owns the whole sky band: the gradient, the verdict (passed in as static Astro children), the panorama, the silhouette and the slider.
  - The static `TonightSky` shares the silhouette and the verdict's minimum height with the island through one module, so the two can't drift.
- **Shared maths.** A pure, island-safe module, `src/lib/sky-view/`, does the rotation, projection, label placement and Sun-to-colour mapping.
- **Colour.** The sky colour stays token-only: new `--dusk-*` tokens in every theme, mixed with CSS `color-mix(in oklab, …)` by a percentage derived from the Sun's altitude.

## Critical Implementation Details

- **Frame alignment:** build every track the panorama uses (objects, planets, Moon) and the frames from one `Interval` and one step (`DEFAULT_TRACK_STEP_MINUTES`). `sampleInstants` then yields identical instants, and index `i` means the same time everywhere. Assert equal lengths in a test.
  - The last frame is the range end, which can be less than one step after the frame before it. Frame times therefore come from `startMs + i·stepMs`, capped at `endMs`.
- **Rotation layout:** `RotateVector` computes out_j = Σ_i rot[i][j]·v_i (`astronomy.js:6535-6537`), the transpose of a textbook M·v.
  - Flatten as `flat[3i+j] = rot[i][j]`. The browser then computes `x' = flat[0]·x + flat[3]·y + flat[6]·z`, `y' = flat[1]·x + flat[4]·y + flat[7]·z` and `z' = flat[2]·x + flat[5]·y + flat[8]·z`.
  - Then altitude = asin(z′), and azimuth = atan2(−y′, x′) normalised to [0, 360), measured from north through east.
  - A unit test compares this with `HorizonFromVector(RotateVector(rot, v), "")` (an empty string means no refraction; the parameter is typed `string`, `astronomy.d.ts:2255`).
- **Topbar continuity:** the band's top stop stays `--zenith` in every frame, and only the middle and horizon stops follow the Sun. Otherwise a seam would open under the Topbar's `bg-zenith` strip at dusk.
- **Coordinate exposure (recorded decision):** the rotation matrices let a reader of the page recover the site's latitude and longitude. That breaks no rule (no URLs, no logs), but it is the first client island to carry them. Matrices are rounded to 4 decimals (about 600 m), which the 200 px strip can't distinguish.

## Phase 1: Bright-star catalogue

### Overview

Add a committed, generated catalogue of naked-eye stars with its provenance, licence, Polish names and UI credit, readable from the browser.

### Changes Required:

#### 1. Generator

**File**: `scripts/build-stars.mjs`, `package.json`, `.prettierignore`

**Intent**: Fetch HYG v4.1 at a pinned commit, keep stars with `mag ≤ 4.5` (excluding Sol), and write deterministic output. The script mirrors `build-catalogue.mjs`:
- no clock reads (the meta date is the pinned commit's date);
- an asserted count of 925 ± a small margin;
- a failure on malformed rows;
- line-by-line streaming of the 34 MB source.

**Contract**:
- `npm run stars:build`. Source: `https://raw.githubusercontent.com/astronexus/HYG-Database/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/CURRENT/hygdata_v41.csv`.
- Output `src/lib/catalogue/bright-stars.json`: an array sorted by magnitude, then by `id`. Each entry is `{ id, mag, x, y, z, name? }`:
  - `id` is HYG's own id, because 6 stars have no `hip`.
  - `x, y, z` is the J2000 unit vector from `ra` (hours) and `dec` (degrees), rounded to 5 decimals.
  - `name` is HYG `proper`, kept for the 40 brightest named stars.
- `bright-stars.meta.json` records the source URL, commit, commit date, licence, filter, count and named count.
- Both files go in `.prettierignore`.

#### 2. Loader, names, licence and credit

**File**: `src/lib/catalogue/stars.ts`, `src/lib/catalogue/star-names.ts`, `src/lib/catalogue/LICENSE-DATA.md`, `src/lib/catalogue/stars.test.ts`, `src/components/tonight/Attribution.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `CLAUDE.md`

**Intent**: Load and validate the JSON into a typed `BRIGHT_STARS` that is island-safe. `stars.ts` imports only `bright-stars.json` and never `./index`, which would pull `messier.json` into the browser chunk. Localise the names. Extend the data licence, and credit HYG in the UI as OpenNGC is. Add the CLAUDE.md tripwire with the files it guards.

**Contract**:
- `BRIGHT_STARS: readonly BrightStar[]`, with `BrightStar = { id: number; mag: number; vector: readonly [number, number, number]; name?: string }`.
- `starName(name, locale)` returns the Polish form from a hand-written map (Vega → Wega, Sirius → Syriusz, Arcturus → Arktur, …) and falls back to the English name.
- `LICENSE-DATA.md` gains a HYG section: CC BY-SA 4.0, attribution to David Nash / astronexus, and the derived-work note.
- `Attribution.astro` adds the `tonight.attribution.starData` link (EN/PL).
- **CLAUDE.md Tripwires:** never edit `bright-stars*.json` by hand; regenerate with `npm run stars:build`.
- `stars.test.ts` asserts the count range, the magnitude order, unit-vector length (±1e-4), the meta file's commit, and that 40 entries carry `name`, each with a `pl` entry or identical in Polish.

### Success Criteria:

#### Automated Verification:

- `npm run stars:build` run twice gives the same `shasum` for `bright-stars.json` and `bright-stars.meta.json`
- `npm test` passes, including `stars.test.ts` and the i18n parity test
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- Spot-check five stars (Vega, Arcturus, Capella, Polaris, Betelgeuse) against Stellarium's J2000 RA/Dec: the vectors convert back within 0.01°

**Implementation Note**: After this phase's automated checks pass, run the manual spot-check yourself and continue without a between-phase question (the user's standing instruction).

---

## Phase 2: Engine frames and the sky view data

### Overview

Compute the panorama's frames and tracks on the server and add them to `TonightView` for the dashboard only.

### Changes Required:

#### 1. Engine frames

**File**: `src/lib/engine/sky-frames.ts`, `src/lib/engine/index.ts`, `src/lib/engine/sky-frames.test.ts`

**Intent**: Add a pure function that samples an interval and returns, per instant, the time, the Sun's altitude and the J2000→horizon rotation. It reuses `sampleInstants`, so its instants match the track functions.

**Contract**: `skyFrames(site: Site, interval: Interval, stepMinutes = DEFAULT_TRACK_STEP_MINUTES): SkyFrame[]`, with `SkyFrame = { time: Date; sunAltitudeDeg: number; rotation: readonly number[] }`. `rotation` holds the 9 numbers of `Rotation_EQJ_HOR(time, observer).rot`, flattened `flat[3i+j] = rot[i][j]`. The function is exported from the barrel, and `purity.test.ts` still passes.

#### 2. The sky view in Tonight's build

**File**: `src/lib/tonight/build.ts`, `src/lib/tonight/load.ts`, `src/lib/tonight/island.ts`, `src/components/tonight/TonightContent.astro`, `src/lib/tonight/build.test.ts`

**Intent**: Build a compact `skyView` only when the dashboard asks, isolated like the other optional parts.

**Contract**:
- **Gating:** a new `withSkyView` option on `buildTonight` / `loadTonight` / `loadTonightFor`, which only `TonightContent` passes. Without it, `skyView` is `null` and nothing is computed.
- **Range:** `sunEvents(site, night)` from sunset to sunrise. When either is `null` (polar day or night), the observing night's interval is used: about 145 frames, inside the size budget below.
- **Bodies:**
  - Objects: the first `MAX_RANKED_OBJECTS` of `ranked.entries`, when the ranking exists, tracked with `objectTracks` over the range. Nothing is stored on `RankedEntry`.
  - Planets: every key in `PLANET_KEYS` (`planets.ts:18`), through `planetTracks`, regardless of `solarSystem`. The `href` gets `#planet-<key>` only when `solarSystem` lists that planet.
  - The Moon, through `moonTrack`.
- **Shape:** `TonightView.skyView: TonightSkyView | null`, columnar:
  ```
  TonightSkyView = {
    startMs: number; stepMs: number; endMs: number; frameCount: number;
    rotations: number[];           // frameCount × 9, 4 decimals
    sunAltDeg: number[];           // frameCount, 1 decimal
    darkSpan: { from: number; to: number } | null;   // frame indices
    initialIndex: number;
    facing: "south" | "north";
    timeZone: string;              // the island formats frame times with Intl in this zone
    startLabel: string; endLabel: string;
    bodies: {
      kind: "object" | "planet" | "moon"; key: string; label: string; href: string;
      track: number[];             // frameCount × 2: alt, az in tenths of a degree (ints)
    }[];
  }
  ```
- **Values:**
  - `initialIndex` is the frame nearest Now when Now is inside the range, else the dark span's start, else 0.
  - `facing` is `"north"` when `site.latitudeDeg < 0`.
  - The planet and Moon labels come from the existing catalogue keys (`messages.targets.planet`).
- **Isolation:** the whole build of `skyView` sits in try/catch → `null`, like `solarSystem` and `moonCard`, so a failure never takes the verdict down.
- **Tests (modest):**
  - Every track has `frameCount × 2` entries.
  - `initialIndex` for the inside, daytime and no-dark-window cases.
  - A no-go night has no `object` bodies but still has planets.
  - A southern site faces north.
  - Without `withSkyView`, `skyView` is `null`.
  - The size check below.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `sky-frames.test.ts`, the new `build.test.ts` cases and `purity.test.ts`
- `npm run lint` and `npx astro check` pass
- `JSON.stringify(view.skyView)` for a December night at 52°N is under 30 KB (asserted in `build.test.ts`)

#### Manual Verification:

- For one fixture night, M13's and Jupiter's alt/az at two frames match Stellarium within 0.5°

**Implementation Note**: Run the check yourself and continue (standing instruction).

---

## Phase 3: The panorama island and dusk tokens

### Overview

Draw the panorama in the browser from `skyView` and the star file, colour it by the Sun, and let the island own the dashboard's sky band.

### Changes Required:

#### 1. Pure sky-view maths

**File**: `src/lib/sky-view/rotate.ts`, `src/lib/sky-view/projection.ts`, `src/lib/sky-view/colour.ts`, `src/lib/sky-view/labels.ts`, `src/lib/sky-view/frames.ts`, plus `*.test.ts`

**Intent**: Island-safe functions, free of React and engine imports, that the island composes.

**Contract**:
- `rotateToHorizon(rotations, frame, vector) → { altDeg, azDeg }`, using the layout in Critical Implementation Details.
- `project({ altDeg, azDeg }, facing, width, height) → { x, y }`. The strip covers 360° over twice the viewport width, centred on `facing`. x wraps; altitude maps linearly from 0 at the bottom to 90 at the top.
- `starRadius(mag)` gives about 0.6–2.4 px.
- `skyMix(sunAltitudeDeg) → { glow, twilight }` gives the percentages for `color-mix`: the Sun at ≥ 0° is full glow, −6° full twilight, and ≤ −18° night.
- `placeLabels(items, bounds)` drops star labels that overlap a body label or each other, and keeps at most 15 star labels, brightest first. Body labels always stay.
- `frameTime(view, i)` and `nearestFrame(view, nowMs)` handle the clamped Now.
- **Tests:**
  - The rotation matches `HorizonFromVector(RotateVector(rot, v), "")` within 0.01° for several stars and frames.
  - The projection's centre and wrap.
  - The `skyMix` stops.
  - `placeLabels` yields to bodies.
  - `nearestFrame` clamps.

#### 2. Dusk tokens

**File**: `src/styles/global.css`, `src/styles/contrast.test.ts`, `src/pages/design.astro`

**Intent**: Add the colours the band mixes towards as the Sun rises: a sunset glow and a twilight pair for the middle and horizon stops, in the dark, light and red blocks. Red keeps zero green and blue. The names avoid `sky`, which the colour guard flags and which clashes with Tailwind's `sky` palette.

**Contract**:
- Hex tokens `--dusk-glow`, `--dusk-glow-horizon`, `--dusk-twilight` and `--dusk-twilight-horizon` in every theme block, mapped as `--color-*` in `@theme inline`. `--zenith` stays the band's top stop.
- `contrast.test.ts` adds:
  - `heading` and `muted-foreground` on the four tokens at ≥ 4.5 in dark and light;
  - a red row for `muted-foreground` on them at the red rules' floor (3).
- `/design` adds the swatches, plus a static panorama fixture at three Sun altitudes. Its data is built server-side in `design.astro` by calling the engine for a fixed site and date, not hand-written JSON.

#### 3. Island

**File**: `src/components/tonight/TonightSkyView.tsx`, `src/components/tonight/TonightSkyView.test.ts`, `src/components/tonight/sky-band.ts`, `src/components/tonight/TonightSky.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `eslint.config.js`

**Intent**: A React island that renders the whole live sky band. It holds the gradient, the verdict passed as children, the panorama strip, the silhouette and the slider, so its state drives both the colour and the ground row.

**Contract**:
- **Props:** `{ view: TonightSkyView; locale: Locale; children }`, where `children` is the server-rendered `VerdictCard`.
- **Band and gradient:**
  - The outer div carries the gradient `--zenith` → `color-mix` middle → `color-mix` horizon, with the `skyMix` percentages as inline-style custom properties.
  - `sky-band.ts` exports the silhouette path and the verdict's min-height classes, used by both the island and the static `TonightSky.astro`.
- **Strip:**
  - An inline SVG in a horizontally scrollable strip, initially scrolled to centre `facing`.
  - Stars sit in a group with `hidden dark:block`.
  - Body markers are SVG `<a>` with a hit area of at least 24×24 px and a `--ring` focus outline. Each one's accessible name is `tonight.sky.bodyLabel({ name, alt, direction, time })`, with the direction from `m.compass`.
- **Slider:**
  - A native range input, styled and keyed like `MoonTimeSlider`, with `aria-valuetext` set to the frame's time (formatted by `Intl` in `timeZone`) and the start and end labels.
  - The dark span is a positioned overlay behind a transparent track. Its inline-style percentages are corrected for the thumb width; there is no track gradient, because that would be an arbitrary value.
  - A Now button uses `nearestFrame`.
- **Guard:** the import guard, copied from `MoonTimeSlider.test.ts`, scans the island and every file under `src/lib/sky-view/` plus `src/lib/catalogue/stars.ts`.
  - Allowed: react, `@/lib/sky-view/*`, `@/lib/catalogue/stars`, `@/lib/catalogue/star-names`, `@/components/tonight/sky-band`, `@/i18n`, `@/lib/utils` and `@/components/ui/button`.
  - Forbidden: astronomy-engine, the engine barrel and its modules, `@/lib/tonight/format`, and `@/lib/catalogue` / `./index`.
- **Lint:** `src/lib/sky-view/**` is added to `gearConfig.files` in `eslint.config.js` (lessons.md rule 1: the rotations encode the site).
- **i18n:** new `tonight.sky` keys for the slider label, Now, the dark-window legend and the body label, with PL parity.

#### 4. Dashboard composition

**File**: `src/components/tonight/TonightContent.astro`, `src/components/tonight/TonightSkeleton.astro`

**Intent**: With a `skyView`, mount the island in place of the static sky. Keep the skeleton the same height.

**Contract**:
- `TonightContent` renders `<TonightSkyView client:load view locale>` with `VerdictCard` as its children when `view.skyView` exists, and today's `<TonightSky verdict>` otherwise.
- `TonightSkeleton` reserves the strip and the slider row at their fixed heights, so the tiles don't jump.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the `sky-view` tests, `TonightSkyView.test.ts` (import guard), `contrast.test.ts`, `red-theme.test.ts`, `no-hardcoded-colors.test.ts` and the i18n parity test
- `npm run lint`, `npx astro check` and `npm run build` pass
- After `npm run build`, `cat dist/client/_astro/TonightSkyView*.js | gzip -c | wc -c` (including any chunk holding the star data) is under 60 KB

#### Manual Verification:

- Screenshots at sunset, mid-twilight and deep night in dark, light and red, at 390 px and desktop: the verdict is unchanged, there's no seam under the Topbar, labels never overlap, and the red mode is pure red
- At 390 px, the strip swipes through 360°, and the slider's drag, keys and Now move every body
- The panorama matches Stellarium's view for the fixture night and site at two times (bright stars and the Moon in the right places, within a few pixels)

**Implementation Note**: Run these checks with Playwright on the local preview and continue (standing instruction).

---

## Phase 4: Links, accessibility, e2e and docs

### Overview

Make the taps land, check keyboard and screen-reader use, pin the behaviour with one e2e spec, and record the change.

### Changes Required:

#### 1. Row anchors

**File**: `src/components/tonight/ObjectCard.astro`, `src/components/tonight/PlanetCard.astro`, `src/pages/tonight/planets.astro`

**Intent**: Give each row a stable `id` (`object-<id>`, `planet-<key>`) with `scroll-mt-4`.

**Contract**:
- The ids match Phase 2's `href`s.
- `targets.astro:72-116` already scrolls to `location.hash` after the island renders.
- `planets.astro` gets the same MutationObserver script, because a server island renders after the browser's own hash scroll.

#### 2. E2E

**File**: `tests/e2e/tonight-sky.spec.ts`

**Intent**: One spec for what screenshots can't show. It runs on the real clock like the other Tonight specs, so it never names a specific body.

**Contract**:
- Find a frame where a marker exists by stepping the slider and reading the DOM. Check that the next step changes that marker's position and accessible name.
- Home and End reach the start and end labels' times. Now goes to the frame nearest the current time, clamped.
- Tapping an object marker opens `/tonight/targets` with that row in view. This step is skipped when no object marker appears, as on a no-go night.
- A planet marker opens `/tonight/planets`. This step is skipped when no planet is above the horizon in any frame.

#### 3. Docs

**File**: `CLAUDE.md`, `context/handoff.md`, `context/foundation/roadmap.md`

**Intent**: Record the panorama and the star catalogue's place, and settle the roadmap's open stars question. The tripwire already landed in Phase 1.

**Contract**:
- **CLAUDE.md:** add "Tonight's sky" in the UI section (the island owns the live band, `sky-band.ts`, the `--dusk-*` tokens) and "Catalogue" in Architecture (`bright-stars.json`, `npm run stars:build`).
- **Handoff:** the next step moves to the `/10x-ui` passes.
- **Roadmap:** the S-11 interactive-sky note becomes settled (real stars, user 2026-10-05).

### Success Criteria:

#### Automated Verification:

- `npm run test:e2e` passes against the local preview (handoff recipe), including `tonight-sky.spec.ts` and the existing Tonight and Moon specs
- `npm test`, `npm run lint`, `npx astro check` and `npm run build` pass

#### Manual Verification:

- Keyboard only: Tab reaches each marker in turn with a visible ring in all three themes, and Enter opens its page
- A screen reader (VoiceOver) announces the slider's time and each marker's name, altitude and direction, in EN and PL
- Polish labels (star names, bodies, slider) fit at 390 px without clipping

**Implementation Note**: Run the checks yourself and tick them with evidence. Push the branch and open a PR; never merge it.

---

## Testing Strategy

### Unit Tests:

- Phase 1: star catalogue shape, order, vectors and names.
- Phase 2: `skyFrames` alignment with the tracks; `skyView` gating, initial index, no-go, southern-site and size cases.
- Phase 3:
  - the browser rotation against the engine;
  - projection centre and wrap;
  - `skyMix` stops;
  - label yielding;
  - Now clamping;
  - the import guard, contrast (red included), red theme, no hardcoded colours, and i18n parity.

The user asked for modest tests: pin only what screenshots can't show.

### Integration Tests:

- `tonight-sky.spec.ts`: slider, keys, Now, marker links (Phase 4).

### Manual Testing Steps:

1. Run a local preview against local Supabase with the forecast fixture (handoff recipe).
2. On `/tonight` at 390 px, drag the slider from sunset to sunrise: the colour fades through twilight, stars wheel, and targets rise and set.
3. Swipe the strip through 360°, and tap objects, a planet and the Moon to check each lands on its page or row.
4. Repeat in light and red, and in PL.
5. Compare two frames with Stellarium.

## Performance Considerations

- **Island input.** A long winter night is about 100 frames × (9 rotations + Sun) plus about 13 bodies × 100 × 2 ints. The columnar JSON comes to under 30 KB (asserted); the old object shape was about 54 KB. Astro's prop serialisation and HTML escaping add about 40–100% on the wire.
- **Star file.** 925 × 4 numbers in the island's chunk, cached by the browser across visits.
- **Per slider step.** About 925 3×3 multiplications, which is trivial. One SVG re-render per input event, with no per-star React components: one `<path>` of circles, or a keyed list, whichever measures faster at 390 px.
- **Server.** Three track calls plus `skyFrames`, on the dashboard only (`withSkyView`), within Workers Paid limits.

## References

- Roadmap: `context/foundation/roadmap.md` (S-11, Interactive sky, 2026-10-04)
- Handoff: `context/handoff.md` (Suggested next step 1)
- Previous change: `context/archive/2026-10-04-tonight-dashboard/plan.md:69` (on branch `chore/archive-tonight-dashboard`, PR #96)
- Plan review: `context/changes/interactive-sky/reviews/plan-review.md`
- Slider pattern: `src/components/tonight/MoonTimeSlider.tsx:57-123`, `MoonTimeSlider.test.ts:22-48`
- Engine: `src/lib/engine/objects.ts:43-60`, `planets.ts:18,52`, `moon.ts:141`, `sun.ts:19-52`, `sampling.ts:12`; astronomy-engine `RotateVector` (`astronomy.js:6535-6537`)
- Generator pattern: `scripts/build-catalogue.mjs`, `src/lib/catalogue/LICENSE-DATA.md`
- HYG: https://github.com/astronexus/HYG-Database (commit `c7f7f883fe678cc7680169a50ccd7dcc49b060ce`, CC BY-SA 4.0)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Bright-star catalogue

#### Automated

- [x] 1.1 `npm run stars:build` run twice gives the same `shasum` for `bright-stars.json` and `bright-stars.meta.json` — 738f178
- [x] 1.2 `npm test` passes, including `stars.test.ts` and the i18n parity test — 738f178
- [x] 1.3 `npm run lint` and `npx astro check` pass — 738f178

#### Manual

- [x] 1.4 Spot-check five stars against Stellarium's J2000 RA/Dec within 0.01° — 738f178

### Phase 2: Engine frames and the sky view data

#### Automated

- [x] 2.1 `npm test` passes, including `sky-frames.test.ts`, the new `build.test.ts` cases and `purity.test.ts` — d8eb626
- [x] 2.2 `npm run lint` and `npx astro check` pass — d8eb626
- [x] 2.3 `JSON.stringify(view.skyView)` for a December night at 52°N is under 30 KB — d8eb626

#### Manual

- [x] 2.4 M13's and Jupiter's alt/az at two frames match Stellarium within 0.5° — d8eb626

### Phase 3: The panorama island and dusk tokens

#### Automated

- [x] 3.1 `npm test` passes, including the sky-view tests, the import guard, contrast, red-theme, no-hardcoded-colors and i18n parity
- [x] 3.2 `npm run lint`, `npx astro check` and `npm run build` pass
- [x] 3.3 The island's gzipped client chunks (`gzip -c | wc -c`) are under 60 KB

#### Manual

- [x] 3.4 Screenshots at sunset, mid-twilight and deep night in dark, light and red, at 390 px and desktop: verdict unchanged, no seam, no label overlap, red pure
- [x] 3.5 At 390 px the strip swipes through 360° and the slider's drag, keys and Now move every body
- [x] 3.6 The panorama matches Stellarium for the fixture night and site at two times

### Phase 4: Links, accessibility, e2e and docs

#### Automated

- [ ] 4.1 `npm run test:e2e` passes against the local preview, including `tonight-sky.spec.ts` and the existing Tonight and Moon specs
- [ ] 4.2 `npm test`, `npm run lint`, `npx astro check` and `npm run build` pass

#### Manual

- [ ] 4.3 Keyboard only: Tab reaches each marker with a visible ring in all three themes, and Enter opens its page
- [ ] 4.4 VoiceOver announces the slider's time and each marker's name, altitude and direction in EN and PL
- [ ] 4.5 Polish labels fit at 390 px without clipping
