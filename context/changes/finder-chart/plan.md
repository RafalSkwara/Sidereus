# Finder chart (M-3 S-03) Implementation Plan

## Overview

A full-plan user opens a finder chart for any ranked deep-sky object or planet from `/tonight/targets` or `/tonight/planets`: the nearest star they can recognise with the naked eye from their site, above the site's minimum altitude at the object's best time, the hop to the object through stars the finder shows, and the finder's and finding eyepiece's fields drawn to scale, oriented as they face that part of the sky (FR-037, US-05). A free account sees what the chart does and that it needs the full plan, never an error or an empty page, and the server enforces the plan (FR-045). It is the first full-plan feature, so it also brings the first "needs the full plan" state and the first HTTP refusal check (test-plan §6.4).

This plan was written in an unattended run (owner away, 2026-10-11). Nobody could answer questions, so every choice below is either **delegated** (team-owned, decided and recorded) or a **default pending owner confirmation** (product or UI, owner-owned, planned on the recommended default). See "Decisions taken in this run".

## Current State Analysis

From `context/changes/finder-chart/research.md` (verified anchors there):

- **No chart code.** The live sky's projection is a 180° equirectangular panorama (`src/lib/sky-view/projection.ts:20-27`); nothing projects a 7-30° field around a target.
- **Stars stop at 4.5.** `bright-stars.json` (925 stars, HYG v4.1 pin `c7f7f883…`, `scripts/build-stars.mjs:21-35`) is island-safe and validated for mag ≤ 4.5 (`src/lib/catalogue/stars.ts:26-27,52`). A finder shows ~7.5-8.
- **Plan guard exists, unused.** `requireFullPlan(locals)` → `{ok:true}` or `{ok:false, reason: "not-configured"|"signed-out"|"needs-full", errorKey}` (`src/lib/account-plan/index.ts:43-50`), memoised per request (l.19). `/tonight/*` is already gated by the middleware (`src/lib/protected-routes.ts:5-18`); `/_server-islands/*` is not (`src/lib/tonight/island.ts:37-41`).
- **`TonightView` lacks chart inputs.** Entries carry `bestAt` (epoch ms) and a `bestDirection` string, but no RA/Dec, no numeric alt/az and no true field (`src/lib/tonight/build.ts:110-143,178-215,486-507`). Planets have no finding eyepiece.
- **Reusable:** `pairEyepieces`/`eyepieceOptics` (`src/lib/engine/eyepieces.ts:50-123`; `majorAxisArcmin = null` fits every eyepiece), `skyFrames`' rotation (`src/lib/engine/sky-frames.ts:31-41`), `nakedEyeLimitingMagForBortle` (`src/lib/engine/parameters.ts:82-90`), the server-SVG pattern (`src/lib/tonight/altitude-curve.ts:40-79` + `SessionTimeline.astro`), the focused-page pattern (`src/pages/tonight/planets.astro`, `PlanetsPageContent.astro`), the action area (`src/components/tonight/TargetDetails.astro:53-59`).
- **HTTP checks:** `scripts/smoke.mjs` reads no response bodies (l.32-57) and CI's smoke and e2e steps have no secret key to grant a plan (`.github/workflows/ci.yml:64-75`); Astro 7 server islands with small props load by GET from a `<link rel="preload" as="fetch" href="/_server-islands/…">` in the shell (`node_modules/astro/dist/runtime/server/render/server-islands.js:141-154`).
- **Licence:** HYG is CC BY-SA 4.0 (declared in `src/lib/catalogue/LICENSE-DATA.md`); its upstream Hipparcos is CC BY-NC 3.0 IGO with "Credit: ESA" (verified at https://www.cosmos.esa.int/web/hipparcos/catalogues). No money is taken in M-3.

## Desired End State

- `/tonight/finder?object=<target key>&from=targets|planets` (plus the page's usual `?site=`/`?telescope=`) renders, for a full-plan user with the object in tonight's ranking: a context line ("Facing SE, 41° up at 22:40"), an **overview panel** from the starting star to the target with the numbered hop, a **finder panel** of the finder's field around the target with stars to the finder's depth, the finder circle, the reflex rings and the finding eyepiece's circle, a short how-to list ("1. Find Mirach … 2. … 3. …"), and a note on inverted finders. It is legible at 360 px in red mode.
- A free account gets the same URL as a 200 page explaining what the chart does, an example chart labelled as an example, and that it needs the full plan. No user data is used for the example.
- The island itself refuses a free account (the chart is never built for one), proven over HTTP by replaying the island URL after a downgrade.
- Every `ObjectDetails` (ranked cards and rows) and `PlanetCard` has a "Finder chart" action link beside "Mark observed", for every account, disabled offline.
- Identical inputs give the identical chart (determinism NFR); the chart never starts from a star below the site's minimum altitude at the best time or fainter than the naked-eye starting limit for the site's Bortle class (PRD invariant), pinned by unit tests.

Verify: `npm test`, `npm run lint`, `npx astro check`, the extended `npm run smoke` and the new e2e spec in CI; manual look at 360 px in red mode against two published hops.

### Key Discoveries:

- HYG is evenly complete to ~7.5 (half-magnitude counts grow ×1.53 to 7.5, then ×1.30, ×1.07): 25,791 stars ≤ 7.5, 354 KB raw / 122 KB gzip as columnar integers (research §3).
- Nearest starting star from the 171 catalogue objects: median 3.6° / max 9.1° at ≤ 4.5, median 6.1° / max 15.0° at ≤ 3.5, median 9.9° / max 25.7° at ≤ 2.5 (research §5). Bortle 7-9 hops need several steps.
- Stars ≤ 6.5 average 8.3 per 7° field (research §5): enough hop stars without drawing them all as hop candidates.
- `requireFullPlan` answers `signed-out` before `needs-full`; on a gated page signed-out never arrives, so the page branches on `reason` (roadmap S-03 note, account-plans impl-review F8).
- A per-object page cannot join the offline copies without new keying in `copies.ts` and `sw.ts` (`src/lib/offline/copies.ts:10-17,120-125`).

## What We're NOT Doing

- No finder choice per telescope (roadmap Parked "Choosing your own finder"); one standard finder for every telescope.
- No interactive chart (no pan, zoom, time slider) and no sky atlas (PRD Non-Goals); a static snapshot at the object's best time.
- No chart for the Moon (FR-037 names deep-sky objects and planets) and no chart for washed-out rows (they have no actions today).
- No offline copy of finder pages (see decision O-4); the link is disabled offline.
- No what-to-expect line (FR-038, US-05's third clause): that is S-04 `what-to-expect`, which will add it to this page.
- No change to the live sky, its star file or its import guard; `bright-stars.json` is not touched.
- No upgrade of the HYG pin to v4.2 (minor name changes only; one pin for both star files).
- No payment, plan badge or upsell flow (PRD Non-Goals); no plan shown on Tonight rows.
- No settlement of the Hipparcos non-commercial question; it is recorded for the owner (PRD OQ21).

## Decisions taken in this run

Delegated (team-owned; decided here, change by editing the parameter or the plan):

- **D-1 Server-rendered chart.** The chart is a static SVG built in a `server:defer` island; no star data reaches the browser, no precache or island-guard change. Why: page weight zero, Session plan precedent, engine stays the single source.
- **D-2 Star depth 7.5, same HYG v4.1 pin**, a second output of `npm run stars:build`: `finder-stars.json` (columnar integers: RA and Dec in 0.01°, mag in 0.1; plus a sparse designation table) and `finder-stars.meta.json`, server-only, loaded by a dynamic `import()` from the finder loader only. Why: HYG's even completeness ends near 7.5; 122 KB gzip in the Worker, parsed only on the finder route.
- **D-3 Starting-star limit** (OQ15) as the PRD candidate: 4.5 at Bortle 1-4, 3.5 at 5-6, 2.5 at 7-9 (`startStarMaxMagForBortle`), kept separate from `nakedEyeLimitingMagForBortle`; a test pins that it never exceeds the naked-eye limit for any class. Stars only: a deep-sky object never serves as its own start; a planet at or brighter than the limit does.
- **D-4 Hop rule** (OQ16): steps of at most 0.8 × the finder field (5.6°, mirroring `FOV_FIT_FRACTION`), through stars ≤ 6.5 that are above the minimum altitude, at most 8 steps; fewest steps first, then the brightest hop stars, then the shortest total length, then star index. The starting star is the nearest qualifying star (angular distance to the target, ties by magnitude then index) that has such a path among the 5 nearest; if none has one, the chart shows the nearest start with a direct line and its distance and direction (`direct` kind).
- **D-5 Finder depth on the chart**: `min(7.5, nakedEyeLimitingMagForBortle(bortle) + 5·log10(30 / EYE_PUPIL_REFERENCE_MM))`, i.e. 7.2-7.5.
- **D-6 Projection**: gnomonic in horizontal coordinates at the best time, centred on the panel's centre, zenith up; stars unrefracted from the `skyFrames` rotation (unrefracted altitude is the lower one, so the minimum-altitude test errs on the safe side).
- **D-7 Finding eyepiece**: deep-sky objects use `pairEyepieces(…, majorAxisArcmin)` (the `finding` eyepiece, or `widest` when none fits); planets use `pairEyepieces(…, null).finding`. No eyepieces: no eyepiece circle and a one-line note.
- **D-8 Target key in the query** (`?object=M31`, `?object=jupiter`), validated with the target-key parser and resolved against tonight's ranking (`limit: Infinity`) or solar system for the selected site and telescope; an object not in it renders a "not on tonight's list" state with the way back.
- **D-9 HTTP refusal check in `scripts/smoke.mjs`**, granting the plan through the operator command (`node scripts/account-plan.mjs <email> full|free` as a child process, local Supabase only), which keeps smoke dependency-free; CI passes the local stack's `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to the smoke and e2e steps.
- **D-10 Credit ESA** for Hipparcos beside HYG in `Attribution.astro` and `LICENSE-DATA.md`.
- **D-11 Calibration without an observer** (roadmap OQ1): a committed reference of classic published hops (M31 from Mirach via μ/ν And, M13 between η and ζ Her, M57 between β and γ Lyr, M81/M82 from Dubhe, M27 from γ Sge, M92 from π/η Her) with their sources; the test asserts the chosen start lies in each route's star set and the hop reaches the target, plus a coverage test over all 171 objects at three Bortle classes.

Pending owner confirmation (owner-owned; planned on this default):

- **O-1 Finder** (OQ13): a 6×30 finder, 7° field, for every telescope, plus a 1× reflex finder's 0.5°, 2° and 4° rings, both drawn on the finder panel around the target.
- **O-2 Orientation**: the naked-eye view as the user faces that part of the sky (zenith up), with one note line that a straight-through finder shows it upside down and a right-angle finder mirror-reversed; no flip control.
- **O-3 Two panels**: an overview (start → target) and a finder panel (7° field around the target), stacked on a phone.
- **O-4 Offline**: finder pages are online-only in this slice (the link carries `data-needs-network`); storing them would need per-object keys in the service worker and triggers PRD OQ23.
- **O-5 Free account**: the same "Finder chart" link on every row; the page explains the chart with a fixed example (M13 from a fixed public site and date, labelled "Example") and says it needs the full plan, without a way to get it (no payments).
- **O-6 Licence**: Hipparcos is non-commercial (ESA); before charging, the star layer (including today's bright stars) needs ESA's authorisation or another source. Added to PRD OQ21 as a fact, owner decides later.

## Implementation Approach

Data first, then the pure engine, then rendering, then the route and its gate, then the HTTP proof. The engine function takes the star list as input (not an import), so tests use synthetic skies and the purity rules hold. The island loads Tonight as the other focused pages do, finds the entry, then builds the chart; the shell and the island each call `requireFullPlan`. Rendering is a pure geometry module plus Astro components with token classes only.

## Critical Implementation Details

- **Island guard order.** The island must call `requireFullPlan` before it loads the star file or calls the engine: the shell's check does not protect `/_server-islands/*`, and the free branch must not even build the chart. The free page's example chart is built from fixed inputs, never from the user's site or gear.
- **Coordinates.** The chart's projected positions encode the site's latitude and the time roughly, like the live sky's rotation matrices (interactive-sky decision, `context/archive/2026-10-05-interactive-sky/plan.md:110`); they stay in the HTML, never in a URL, a `data-*` attribute meant for scripts, or a log. Round SVG coordinates to 0.1 unit.
- **Smoke ordering.** The island URL replay must run after the downgrade back to free and before sign-out; capture the URL from the full account's shell (`<link rel="preload" as="fetch" href="/_server-islands/FinderContent…">`). If the props ever outgrow a GET (Astro switches to POST), the step must fail loudly, not skip.

## Phase 1: Finder star data

### Overview

A second, deeper star file from the same pinned HYG source, server-only, with its loader, tests, licence entry and credit.

### Changes Required:

#### 1. Star build

**File**: `scripts/build-stars.mjs`

**Intent**: Write `finder-stars.json` and `finder-stars.meta.json` from the same streamed CSV in the same run, alongside the unchanged bright-star outputs, so one command regenerates both.

**Contract**: Filter: not Sol, `mag ≤ 7.5`, valid RA/Dec. Sort by mag then HYG id. Output `{ ra: number[], dec: number[], mag: number[], id: number[], designations: Record<index, { bayer?: string, flamsteed?: number, con: string, proper?: string }> }` with RA/Dec as integers in 0.01°, mag as integers in 0.1. Own `EXPECTED_COUNT` 25,791 ± 50 hard guard. Meta like `bright-stars.meta.json` (source, url, commit, licence, attribution incl. "Credit: ESA", filter, count, designatedCount). Deterministic, no clock.

#### 2. Loader

**File**: `src/lib/catalogue/finder-stars.ts` (new)

**Intent**: Server-only lazy loader that returns the stars as J2000 unit vectors with magnitudes and display designations, validated once per isolate.

**Contract**: `loadFinderStars(): Promise<readonly FinderStar[]>` with `FinderStar = { index: number; id: number; mag: number; vector: readonly [number, number, number]; designation: StarDesignation | null }`; memoised promise reset on failure (as `src/lib/gear/catalogue/load.ts`); validates count range, mag ≤ 7.5, unique ids; `import("./finder-stars.json")`. Never imported by `stars.ts`, `./index` or any island. `formatDesignation(designation, locale)` → "β And" / "Mirach (β And)" using Greek letters for HYG's Bayer abbreviations and `starName` for the 41 localised names.

#### 3. Tests

**File**: `src/lib/catalogue/finder-stars.test.ts` (new)

**Intent**: Pin shape and provenance like `stars.test.ts`, and that the file stays out of browser code.

**Contract**: count within range; mag ≤ 7.5; sorted; meta commit equals the bright-star pin; licence "CC BY-SA 4.0"; every star ≤ 4.5 in `BRIGHT_STARS` appears with the same HYG id; designation formatting cases (Bayer with superscript index, Flamsteed, proper, Polish name); a source scan that no file under `src/components/**/*.tsx` or `src/lib/sky-view/**` imports `finder-stars`.

#### 4. Licence, credit, tripwire

**Files**: `src/lib/catalogue/LICENSE-DATA.md`, `src/components/tonight/Attribution.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `.prettierignore`, `CLAUDE.md`

**Intent**: Declare the new Adapted Material, credit ESA (Hipparcos) beside HYG, keep Prettier off the generated files, and add the tripwire.

**Contract**: LICENSE-DATA HYG section lists `finder-stars*.json` and its filter; Attribution adds "Hipparcos (Credit: ESA)" via a new key; `.prettierignore` gains both files; CLAUDE.md tripwire "Never edit `finder-stars.json` / `finder-stars.meta.json` by hand" and a Catalogue sentence.

### Success Criteria:

#### Automated Verification:

- `npm run stars:build` writes both star files and leaves `bright-stars*.json` byte-identical (`git diff --exit-code src/lib/catalogue/bright-stars.json src/lib/catalogue/bright-stars.meta.json`)
- `npx vitest run src/lib/catalogue` passes, including `finder-stars.test.ts`
- `npm run lint` and `npx astro check` pass
- `gzip -c src/lib/catalogue/finder-stars.json | wc -c` is under 160,000 bytes

#### Manual Verification:

- Spot-check five stars (Mirach, μ And, η Her, Sulafat, a mag-7 star) against the HYG CSV row

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Engine: starting star, hop and projection

### Overview

Pure, deterministic finder maths in the engine, test-first: parameters, the planet's J2000 direction, the finding eyepiece, the start choice, the hop search, the gnomonic horizon projection.

### Changes Required:

#### 1. Parameters

**File**: `src/lib/engine/parameters.ts`

**Intent**: Every new number as a documented candidate (S-03 planning, 2026-10-11).

**Contract**: `FINDER_FIELD_DEG = 7`, `FINDER_APERTURE_MM = 30`, `REFLEX_RING_DEG = [0.5, 2, 4]`, `FINDER_CHART_MAX_MAG = 7.5`, `startStarMaxMagForBortle(bortle)` (4.5 / 3.5 / 2.5), `finderLimitingMagForBortle(bortle)` (D-5), `HOP_STAR_MAX_MAG = 6.5`, `HOP_MAX_STEP_FRACTION = 0.8`, `HOP_MAX_STEPS = 8`, `START_STAR_CANDIDATES = 5`, `FINDER_PANEL_FIELD_DEG = 10` (finder panel width).

#### 2. Finder chart builder

**File**: `src/lib/engine/finder.ts` (new), exported through `src/lib/engine/index.ts`

**Intent**: From the site, time, target direction, limits and a star list, choose the start, find the hop and project both panels; return plain data.

**Contract**:
```ts
finderChart(input: {
  site: Site; time: Date; bortle: number; minAltitudeDeg: number;
  target: { vector: Vec3; magnitude: number | null; isPlanet: boolean; majorAxisArcmin: number | null };
  stars: readonly FinderStarInput[]; // { index, mag, vector }
  eyepieceFieldDeg: number | null;
}): FinderChartData
// kind: "hop" | "direct" | "naked-eye" | "no-start"
// start: { index, mag, altDeg, azDeg, distanceDeg } | null; hops: { index, stepDeg }[]
// facing: { azDeg, altDeg } of the target; overview/finder panels: { fieldDeg, stars: { index, x, y, mag }[],
//   path: {x,y}[], target: {x,y}, circles: { kind: "finder"|"reflex"|"eyepiece", r }[] } in degrees on the tangent plane
```
`no-start` when no star at or above the minimum altitude meets the starting limit (e.g. a deep southern target in a bright sky). Vectors go through one `Rotation_EQJ_HOR` at `time` (the `skyFrames` rotation); a pure `projectGnomonic(centreAltAz, altAz)` lives here too.

#### 3. Planet direction and finding eyepiece

**Files**: `src/lib/engine/planets.ts`, `src/lib/engine/eyepieces.ts`

**Intent**: A J2000 unit vector for a planet at a time (astronomy-engine `Equator(body, time, observer, false, true)`), and a `findingEyepiece(telescope, eyepieces, majorAxisArcmin)` helper returning the eyepiece and its true field per D-7.

**Contract**: `planetJ2000Vector(key, site, time): Vec3`; `findingEyepiece(...) : { eyepiece: E; trueFovDeg: number } | null`.

#### 4. Tests and reference

**Files**: `src/lib/engine/finder.test.ts`, `src/lib/engine/fixtures/finder-reference.ts` (new)

**Intent**: Pin the invariants, determinism and the published hops.

**Contract**: synthetic-sky cases (zero intermediate hops; multi-step; tie-breaks; `direct` and `no-start`; a start below the minimum altitude is never chosen; a start fainter than the limit is never chosen; a bright planet gives `naked-eye`); `startStarMaxMagForBortle(b) ≤ nakedEyeLimitingMagForBortle(b)` for b = 1…9; identical inputs → deep-equal output; projection round trip (target at centre, zenith up: a star higher in altitude has smaller `y`); D-11 reference hops on fixed nights at 52° N (start ∈ route stars, path ends at the target, every step ≤ 5.6°); coverage over the 171 objects at Bortle 3, 5, 8 on four fixed nights: every object that is above the minimum altitude at its computed best time gets `hop`, `direct`, `naked-eye` or `no-start` without throwing, and ≥ 95 % of those at Bortle 3 get `hop`. The real star file is read in these two tests through the JSON import (test-only).

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/engine` passes, including `finder.test.ts` and `purity.test.ts`
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- Read the reference test output for M31, M13 and M57: start star and steps look like the published routes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Chart rendering

### Overview

Turn `FinderChartData` into two legible SVG panels and a how-to list, with token colours only, specimens on `/design`.

### Changes Required:

#### 1. Geometry

**File**: `src/lib/finder/chart-svg.ts` (new)

**Intent**: Pure mapping from tangent-plane degrees to a square viewBox, star radius by magnitude (brightest ~3.2 units down to 0.5 at the panel's depth), label placement for the start and hop stars (reuse `placeLabels` ideas from `src/lib/sky-view/labels.ts` only if it fits without importing browser code), rounding to 0.1.

**Contract**: `panelSvg(panel, { size }) → { viewBox, stars: {cx, cy, r}[], path: string, circles: {cx, cy, r, kind}[], labels: {x, y, text, anchor}[] }`.

#### 2. Components

**Files**: `src/components/finder/FinderChart.astro`, `FinderPanel.astro`, `FinderSteps.astro` (new)

**Intent**: The context line ("Facing SE, 41° up at 22:40"; compass from `@/lib/compass`), the overview and finder panels (each an `<svg role="img">` with an `aria-label` that states the hop in words), the numbered steps ("Find Mirach (β And), the second-brightest star of Andromeda's chain, … then move 4° toward …"), the inverted-finder note, the eyepiece line ("Eyepiece circle: 25 mm Plössl, 1.7°"), and the `direct` / `naked-eye` / `no-start` variants.

**Contract**: props `{ chart: FinderChartData, labels: …, locale }`; stars `fill-star`, path and finder circle `stroke-heading`, reflex rings dashed `stroke-muted-foreground`, eyepiece circle `stroke-primary-strong`, target marker `stroke-primary-strong`; no hex, no arbitrary values; panels `w-full max-w-md`, stacked below `md`. If a new token is needed (e.g. `--chart-line`), add it to every theme block with zero G/B in red and a contrast row.

#### 3. Copy

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Every string under `tonight.finder.*` (title, context line, steps, notes, variants, locked state, example label, link text) in both languages; designations (Greek letter + IAU abbreviation) stay untranslated like compass points.

**Contract**: parity test passes; parameterised messages take pre-formatted numbers.

#### 4. Specimens

**File**: `src/pages/design.astro`

**Intent**: A "FinderChart" section with real components on fixed sample data: hop, direct, naked-eye planet, no-start, no eyepieces, locked (free), loading (skeleton); hover/focus/disabled marked N/A where they do not apply.

**Contract**: one `<section aria-labelledby="c-finder-chart">` in the existing 7-state layout.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/finder src/i18n src/styles` passes (geometry tests, i18n parity, no-hardcoded-colours, red theme, contrast)
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- `/design` FinderChart specimens read at 360 px in dark, light and red; the finder circle, reflex rings and eyepiece circle are distinguishable in red by stroke style alone
- The M31 specimen matches a published M31 chart's star pattern, mirrored correctly (zenith up)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: The finder page behind the full plan

### Overview

The route, its shell and island, the two-layer plan check, the free account's explainer, and the links from Tonight's rows.

### Changes Required:

#### 1. Loader

**File**: `src/lib/finder/load.ts` (new)

**Intent**: For an island request: guard the plan, load Tonight for the site and telescope, find the target in the ranking (deep-sky) or the solar system (planet), compute the finding eyepiece, load the stars, call `finderChart`, format labels. Server-only.

**Contract**: `loadFinderFor(locals, { target, siteId, telescopeId }): Promise<FinderLoad>` with `FinderLoad = { kind: "locked" } | { kind: "not-configured" } | { kind: "no-gear" | "not-ranked" | "failed", view: TonightView | null } | { kind: "chart", view, chart, labels }`; calls `requireFullPlan(locals)` first and returns `locked` before any other read; uses `loadTonightFor(locals, { siteId, telescopeId, limit: Infinity })`. A failed star load or engine error → `failed` with a fixed key, no log of values.

#### 2. Page and island

**Files**: `src/pages/tonight/finder.astro`, `src/components/finder/FinderContent.astro`, `src/components/finder/FinderLocked.astro` (new)

**Intent**: The shell parses `?object=` (target-key parser; unknown → a 200 "not on tonight's list" state, never a crash), `?from=` (`targets` | `planets`, else Tonight) and `requestedGear`; calls `requireFullPlan(Astro.locals)`: `needs-full` → `FinderLocked` (no island), `not-configured` → `DatabaseMissing`, `ok` → the `FinderContent` island with `TonightPageSkeleton`. The island renders `TonightPageSky` (title "Finder chart · M31"), then by `FinderLoad.kind`: chart, locked (`FinderLocked`), not-ranked, no-gear, failed. `FinderLocked` explains the chart in three lines, shows the fixed example (O-5) labelled "Example", and the "needs the full plan" line. Attribution below. A back link to the `from` page.

**Contract**: every state carries `data-finder-state="chart|locked|not-ranked|no-gear|failed"` on its root; only the `chart` state carries `data-finder-chart`. The page is not added to `TONIGHT_PAGES` (O-4). `TonightPageSky` gains an optional `backHref`/`backLabel` (default Tonight) if needed for the `from` link.

#### 3. Links

**Files**: `src/components/tonight/TargetDetails.astro`, `ObjectDetails.astro`, `PlanetCard.astro`, `SolarSystemSection.astro`, `TargetsPageContent.astro`, `PlanetsPageContent.astro`, `src/lib/tonight/load.ts`

**Intent**: An optional `finderHref` on `TargetDetails` renders a second action link ("Finder chart", lucide `Crosshair`, `buttonVariants({variant:"action", size:"sm"})`, `data-needs-network`, accessible name with the target) beside "Mark observed"; ObjectDetails and PlanetCard pass it; a `finderHref(view, target, from)` helper next to `logHref` builds `/tonight/finder?object=…&site=…&telescope=…&from=…` (ids only).

**Contract**: The Moon card passes none. The two links wrap at 320 px without sideways scroll.

#### 4. Lint and offline guards

**Files**: `src/lib/offline/copies.test.ts` (unchanged expectation that `/tonight/finder` is not a page, extended with that path), `src/lib/no-console-guard.test.ts` (no new disables)

**Intent**: Pin O-4 and that nothing new logs.

**Contract**: `tonightPageOf(new URL("/tonight/finder?object=M31", base))` is `null`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including a unit test of `loadFinderFor` that a free account (stubbed `account_plans` read) returns `locked` without calling the Tonight load or the star loader, and that `signed-out` and `not-configured` never build a chart
- `npm run lint`, `npx astro check` and `npm run build` pass
- `tests/e2e/tonight-phone.spec.ts` and `tests/e2e/tonight-targets.spec.ts` stay green

#### Manual Verification:

- As a full account on `npm run preview` (port 4331) with local Supabase: open the chart from a ranked object and from a planet; back link returns to the right page
- As a free account: the same link shows the explainer with the example, no error styling
- Offline (service worker active): the Finder chart link is disabled with the "Needs a connection" description

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: HTTP refusal, e2e and docs

### Overview

Prove the plan boundary over HTTP (test-plan §6.4), add one browser spec for the chart at phone width, and record the slice in the docs.

### Changes Required:

#### 1. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Read bodies when a step asks, grant and remove the plan through the operator command, and add the finder steps.

**Contract**: `request()` also returns `body` (text) for steps with `bodyIncludes` / `bodyExcludes`; a helper runs `node scripts/account-plan.mjs <email> full|free` with the inherited `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (smoke fails with one clear line if they are missing). New steps after the gear steps, signed in as the smoke user (free by default):
1. `GET /tonight/finder?object=M13&from=targets` → 200, body includes `data-finder-state="locked"`, excludes `/_server-islands/FinderContent`.
2. Grant full → `GET` the same page → 200, body includes `/_server-islands/FinderContent` and excludes `data-finder-state="locked"`; capture the island URL from the preload link.
3. `GET <island URL>` as full → 200, body excludes `data-finder-state="locked"` (chart or not-ranked, depending on the date).
4. Demote to free → `GET <island URL>` again → 200, body includes `data-finder-state="locked"` and excludes `data-finder-chart`.
5. Signed out: `GET /tonight/finder?object=M13` → 302 to `/auth/signin?next=%2Ftonight%2Ffinder%3Fobject%3DM13` (exact).

#### 2. CI

**File**: `.github/workflows/ci.yml`

**Intent**: Give the smoke and e2e steps the local stack's `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (from `supabase.env`), never in `.env` or `.dev.vars`.

**Contract**: both steps `source supabase.env` and export the two variables inline, as the `test:db` step does.

#### 3. E2E

**File**: `tests/e2e/finder-chart.spec.ts` (new)

**Intent**: A full account (granted through the operator command) opens `/tonight/targets`, follows the first "Finder chart" link and sees both panels, the steps and the context line; at 360 px nothing scrolls sideways; in red mode the page renders with the red theme.

**Contract**: uses `tests/e2e/helpers.ts` sign-up; no retries (`failOnFlakyTests`).

#### 4. Docs

**Files**: `CLAUDE.md`, `context/foundation/test-plan.md`, `context/foundation/prd.md`, `context/foundation/roadmap.md`

**Intent**: CLAUDE.md: a Finder paragraph (route, loader, two-layer plan check, star file, offline exclusion) and the designation exception beside compass points. Test-plan §6.4: the page variant (shell state + island replay) as the recipe the next full-plan page follows. PRD OQ21: the Hipparcos/Tycho/Gaia NC fact (O-6); OQ13-16: "settled as candidates in S-03 plan". Roadmap S-03 unknowns: mark resolved with pointers to this plan.

**Contract**: prose only.

### Success Criteria:

#### Automated Verification:

- `BASE_URL=http://localhost:4331 SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run smoke` passes against local Supabase and the preview, including the five finder steps
- `npx playwright test finder-chart` passes against the preview
- CI's `smoke` job passes on the PR

#### Manual Verification:

- At arm's length on a phone in red mode, the chart for one planet and one deep-sky object is legible
- The owner reviews the pending decisions O-1 to O-6

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Star file shape, provenance, overlap with bright stars, browser-import scan (Phase 1)
- Engine: invariants (start altitude, start limit ≤ naked-eye limit), determinism, tie-breaks, kinds, projection orientation, reference hops, 171-object coverage (Phase 2)
- Geometry: viewBox mapping, radius ramp, rounding, label placement without overlap for the start and hop stars (Phase 3)
- Loader: `locked` before any read for free, signed-out, not-configured; not-ranked; planet vs deep-sky eyepiece (Phase 4)

### Integration Tests:

- Smoke: free shell refused, full shell and island allowed, island replay refused after demotion, signed-out redirect (Phase 5)
- E2E: full account opens a chart from Targets at 360 px (Phase 5)

### Manual Testing Steps:

1. Grant a local account full (`npm run account:plan -- <email> full` against local Supabase), open `/tonight/targets`, open a chart, compare with a published chart for the same object.
2. Switch to a Bortle 8 site: the start is a bright star (≤ 2.5) and the hop is longer.
3. Open a planet's chart: Jupiter is its own start (`naked-eye`); Uranus or Neptune, when ranked, get a hop.
4. Demote the account; reload: explainer with the example, no chart.
5. Red mode at 360 px: readable, no green or blue.

## Performance Considerations

- The star file (≈354 KB raw) is parsed once per isolate and only on the finder route (dynamic import). The hop search restricts candidates to stars within (start distance + one step) of the target: a few hundred nodes, well under the 30 s CPU of Workers Paid.
- The chart HTML holds at most a few hundred circles per panel (≈25 KB raw); no client JS beyond Astro's island loader.
- Budget check in Phase 1: `finder-stars.json` under 160 KB gzip; `dist/server` growth under 500 KB raw, recorded in Progress notes.

## Migration Notes

None: no schema change, no stored data. The plan check reads the existing `account_plans` table.

## References

- Research: `context/changes/finder-chart/research.md`
- PRD: FR-037, FR-045, US-05, Invariants, OQ13-16, OQ21, OQ23 (`context/foundation/prd.md:174-188,445,461,576,707-742`)
- Roadmap S-03 and the F-01 note (`context/foundation/roadmap.md:121-136`)
- Test-plan §6.4 (`context/foundation/test-plan.md:157-167`)
- Similar implementation: focused page `src/pages/tonight/planets.astro`, island `src/components/tonight/PlanetsPageContent.astro`, server SVG `src/lib/tonight/altitude-curve.ts:40-79`, star pipeline `scripts/build-stars.mjs`
- Prior decisions: `context/archive/2026-10-05-interactive-sky/plan.md:98-154`, `context/archive/2026-10-09-account-plans/reviews/impl-review.md:108-116`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Finder star data

#### Automated

- [ ] 1.1 `npm run stars:build` writes both star files and leaves `bright-stars*.json` byte-identical
- [ ] 1.2 `npx vitest run src/lib/catalogue` passes, including `finder-stars.test.ts`
- [ ] 1.3 `npm run lint` and `npx astro check` pass
- [ ] 1.4 `finder-stars.json` gzips under 160,000 bytes

#### Manual

- [ ] 1.5 Spot-check five stars against the HYG CSV row

### Phase 2: Engine: starting star, hop and projection

#### Automated

- [ ] 2.1 `npx vitest run src/lib/engine` passes, including `finder.test.ts` and `purity.test.ts`
- [ ] 2.2 `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 2.3 Reference hops for M31, M13 and M57 look like the published routes

### Phase 3: Chart rendering

#### Automated

- [ ] 3.1 `npx vitest run src/lib/finder src/i18n src/styles` passes
- [ ] 3.2 `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 3.3 `/design` FinderChart specimens read at 360 px in dark, light and red; circles distinguishable in red
- [ ] 3.4 The M31 specimen matches a published M31 chart's star pattern, zenith up

### Phase 4: The finder page behind the full plan

#### Automated

- [ ] 4.1 `npm test` passes, including the `loadFinderFor` plan-guard tests
- [ ] 4.2 `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 4.3 `tonight-phone` and `tonight-targets` e2e specs stay green

#### Manual

- [ ] 4.4 Full account opens charts from an object and a planet; back link returns to the right page
- [ ] 4.5 Free account sees the explainer with the example, no error styling
- [ ] 4.6 Offline, the Finder chart link is disabled with its description

### Phase 5: HTTP refusal, e2e and docs

#### Automated

- [ ] 5.1 `npm run smoke` passes against local Supabase and the preview, including the five finder steps
- [ ] 5.2 `npx playwright test finder-chart` passes against the preview
- [ ] 5.3 CI's `smoke` job passes on the PR

#### Manual

- [ ] 5.4 Chart legible at arm's length on a phone in red mode for a planet and a deep-sky object
- [ ] 5.5 Owner reviews pending decisions O-1 to O-6
