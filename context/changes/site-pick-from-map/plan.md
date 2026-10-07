# "Pick from map" (S-09) Implementation Plan

> Revised 2026-10-07 after `/10x-plan-review` (`reviews/plan-review.md`, F1–F10 all applied).

## Overview

Add a third way to choose a site's location to the shared `LocationPicker`: **"Pick from map"**. Clicking it opens an inline map panel (Leaflet 1.9.4, OpenStreetMap standard tiles). The click is the user's consent, so nothing map-related loads or is requested before it: no map code, no map CSS, no tiles. Tapping the map drops a pin and dragging adjusts it. Each drop reports coordinates rounded to about 1 km to the host form, exactly like "Use my location". This closes the last open slice of M-2 (roadmap S-09, GitHub #73).

## Current State Analysis

- S-08 built `src/components/location/LocationPicker.tsx` as the single extension point for S-09 (`context/archive/2026-10-03-site-use-my-location/plan-brief.md:21`). It reports `LocationPick {latitudeDeg, longitudeDeg, source}` through `onPick` (`LocationPicker.tsx:26-30`), and the host owns the coordinate fields. It has exactly two hosts:
  - `SiteForm.tsx:4,183`;
  - `OnboardingWizard.tsx:6,475`.
- Rounding: `roundCoordinate` in `src/lib/gear/coordinates.ts:8-11` rounds to 2 decimals, half away from zero, and normalises −0. The schema rounds again (`src/lib/gear/schemas.ts:47-48`).
- No code in `src/` uses `navigator.permissions`. `locate.ts` exports only `LocateFailure`, `DevicePosition` and `locateDevice`.
- The service worker precaches every `_astro/**/*.{js,css,woff2}` (`scripts/build-sw.mjs:51`) with no ignores.
  - `injectManifest` returns only `{count, size, warnings}` (`node_modules/workbox-build/build/types.d.ts:490-496`). It accepts `globIgnores` (`:377`), relative to `dist/client`.
  - The worker's `/_astro` route (`src/sw.ts:524-534`) stores files at runtime only for Tonight clients (`noteAsset`, `:251`), so a map chunk fetched on `/gear/sites/*` or `/onboarding` is never stored.
- **The build emits one site-wide CSS file** (`dist/client/_astro/TopbarControls.*.css`, which contains global.css). A plain `import "leaflet/dist/leaflet.css"` could therefore be hoisted into it, loaded on every page and precached.
- Red night mode filters every `img` through `url(#red-only)` (`src/styles/global.css:256-258`, filter defined in `src/layouts/Layout.astro:70`). There is no CSP and no `Referrer-Policy`, so the browser default `strict-origin-when-cross-origin` sends the origin, which meets the OSM policy. Cross-origin requests bypass the worker (every route is `sameOrigin`).
- Offline: `data-needs-network` controls get `aria-disabled` plus the "Needs a connection" description, and clicks are swallowed (`src/lib/offline/page-state.ts:64-78,100-106`). It runs on every page through `Layout.astro:77-86`. Both `/gear/sites/*` and `/onboarding` use `GearShell` → `Layout`.
- The PRD guardrail (`prd.md:65-67`) allows third-party requests with coordinates only for "the forecast lookup". The NFR (`prd.md:377-379`) allows "the forecast and geocoding lookups". The PRD frontmatter has `version: 2` and no `updated:`. Inside the PRD, "S-09" means another item (`:168`, `:374`). The user's consent decision for this slice is in `roadmap.md:250`.
- Research: `context/changes/site-pick-from-map/research.md`.

## Desired End State

On `/gear/sites/new`, `/gear/sites/<id>` and onboarding's home-site step, the picker offers "Pick from map". A caption under it names OpenStreetMap as the map source.

Before the click, the page makes no request to `tile.openstreetmap.org` and none for `/_astro/map-panel*` or `/_astro/leaflet*`.

After the click, an inline panel (`h-80`) shows the map at once:

- **Starting view:** the host's current coordinates at zoom 11 with the pin. Otherwise a neutral view of Europe, which recentres on the device position if geolocation was already granted and a position arrives within 3 s.
- **Picking:** a tap drops the pin, and dragging it adjusts the spot. Arrow keys pan, and "Place pin at map centre" serves keyboard users. Each drop fills the host's coordinates rounded to 0.01°, and the pin sits on the rounded point.
- **Look per theme:** normal tiles in the light theme, inverted and dimmed tiles in the dark theme, red-only in red mode. Leaflet's chrome (zoom buttons, credit, links, pin) uses tokens in every theme.
- **Credit:** a visible "© OpenStreetMap contributors" credit that opens in a new tab.
- **Closing:** "Close map" collapses the panel and works offline. Undo on the edit form closes the panel.
- **Offline:** the "Pick from map" button is network-gated.
- **Weight:** the map JS and CSS stay out of the precache and out of the site-wide CSS, and `scripts/build-sw.mjs` fails the build otherwise.

Verify with `tests/e2e/site-map.spec.ts` (no tile or map-chunk request before the click; a tap pin saves 2-decimal values; the edit form's Undo works) and with phase 3 screenshots in EN and PL, dark, light and red, at 390 px and 1280 px, including WebKit for red mode.

### Key Discoveries:

- The picker's controls use `name=""` (`LocationPicker.tsx:189`). Map buttons must be `type="button"` so they never submit the host form.
- `src/components/location/**` and `src/lib/location/**` are already covered by the coordinate no-console lint (`eslint.config.js:83-113`), so the lessons.md rule needs no new glob.
- Lazy-import precedent: the memoised `import()` in `src/lib/gear/catalogue/load.ts:12-17` resets after a failure. Its comment warns that the browser may cache a failed `import()`, so a reload may be what recovers.
- Chunk naming: no `assetsDir` or naming config. Dynamic chunks are named after their module (`telescopes.*.js`, `LocationPicker.*.js`), so `map-panel.tsx` emits `_astro/map-panel.<hash>.js`, and Leaflet is inlined into it.
- E2E network stubs use `page.route` (`tests/e2e/helpers.ts:55-59` `stubPlaceSearch`; `landing-screenshot.spec.ts:48`). `onboardInMadrid` (`helpers.ts:77-86`) saves Madrid (40.42, −3.7), and `site-location.spec.ts:74` relies on it.
- React is 19.3.0, which exports `useEffectEvent`. lucide-react 1.45.0 has `MapPinned`.
- `no-hardcoded-colors.test.ts:22` exempts `global.css` but scans `.tsx`, so the SVG pin must use `currentColor`. `red-theme.test.ts` only parses hex and `rgb()` in `[data-theme="red"] {` blocks, so CSS filters don't trip it. Neither scans `node_modules`, so Leaflet's own colours are invisible to the guards and need overrides checked by screenshots.

## What We're NOT Doing

- No other tile provider, API key or vector map (MapLibre). Switching provider later is a one-file change in `map-panel.tsx`.
- No caching of tiles or offline map. Tiles stay network-only, as the OSM tile policy requires.
- No CSP and no `Referrer-Policy` change.
- No reverse geocoding. A map pick never fills or changes the site name.
- No placement finer than 0.01°.
- No keyboard drag of the pin. The marker gets `keyboard: false`, and arrow-key panning plus "Place pin at map centre" covers keyboard use.
- No map on Tonight or anywhere else, and no `/design` entry. The panel is not a `ui/` primitive, and the picker isn't in `/design` today.
- No component unit tests (vitest covers `src/**/*.test.ts` only). Pure helpers get unit tests and the UI gets one e2e spec, keeping tests modest as the user asked in S-08.
- No roadmap, board or milestone bookkeeping in this plan. `/10x-implement` and `/10x-archive` own those flips, and `context/handoff.md` tracks closing M-2.

## Implementation Approach

The work runs bottom-up, so the privacy and bundle guarantees are proven before the UI lands.

1. Phase 1 adds the dependency, the pure helpers, the precache guard (manifest side), the strings and the PRD amendment.
2. Phase 2 builds `map-panel.tsx` (Leaflet plus its CSS, loaded by URL), wires it into `LocationPicker`, widens `LocationPick` with `{kind:"map"}`, edits all four host branch points, themes the tiles and Leaflet's chrome, and completes the build guard (the chunk exists; no Leaflet CSS anywhere else).
3. Phase 3 adds the e2e spec, captures the screenshot evidence including WebKit, and updates CLAUDE.md.

## Critical Implementation Details

- **Filter order in red mode.** A CSS filter on a child runs before its ancestor's. If tiles keep the global `[data-theme="red"] img` red-only filter while the pane is inverted, the inversion turns red into cyan.
  - Filter only `.leaflet-tile-pane`, and set the tile `img` filter to `none` in dark and red: `[data-theme] .leaflet-tile-pane img { filter: none }`. This beats `.leaflet-tile { filter: inherit }` and `[data-theme="red"] img`.
  - Dark mode uses plain CSS functions on the pane.
  - Red mode uses one SVG filter, `#red-night-map`, added next to `#red-only` in `Layout.astro`. It is a single `feColorMatrix` that folds inversion, dimming and luminance-to-red into one matrix, with zero output on the G and B rows. A mixed `invert(…) url(#…)` chain is untested in WebKit, so it is not used.
- **Leaflet stays out of SSR and out of eager bundles.** It touches `window` when imported. Only the "Pick from map" click may `import("./map-panel")`, never a top-level import in `LocationPicker`.
  - The CSS is imported as a URL: `import leafletCssUrl from "leaflet/dist/leaflet.css?url"`. The panel injects `<link rel="stylesheet" href={leafletCssUrl}>` once into `document.head` and awaits its `load` before `L.map(...)`. A plain CSS import could be hoisted into the site-wide stylesheet (one CSS file today).
  - Vite emits the leaflet.css `url()` PNGs as assets or data URIs. Neither is precached (the glob is js/css/woff2), and the divIcon pin doesn't use them.
- **One map instance per open panel.**
  - Create the map in an effect with `[]` dependencies, with `map.remove()` in cleanup.
  - Read `onPick` through `useEffectEvent`, because the host passes a new function every render.
  - Fix `view` in state at open time.
  - Sync the pin to the host while open: when `current` changes from outside the map (typing), move the pin with `setLatLng` without recentring.
  - Watch the container with a `ResizeObserver` → `map.invalidateSize()`.
- **Cascade.** leaflet.css is unlayered and loads last, so it beats Tailwind's layered utilities and same-specificity global.css rules. Write every Leaflet override in global.css unlayered, prefixed with `[data-theme]` (always set on `<html>`). Never style Leaflet elements with Tailwind classes, except the container's own height and border, which sit on the wrapper `div`.
- **Pin icon.** Use `L.divIcon({ className: "map-pin", html: <inline SVG with fill="currentColor"> , iconSize, iconAnchor })`. Its own `className` stops Leaflet's default `.leaflet-div-icon` (white box, grey border) from applying. The marker gets `keyboard: false` and `draggable: true`.

## Phase 1: Map foundation

### Overview

Add the dependency, the pure helpers and their tests, the precache manifest guard, the strings and the PRD amendment. Nothing user-visible changes.

### Changes Required:

#### 1. Dependency

**File**: `package.json`, `package-lock.json`

**Intent**: Add Leaflet as a runtime dependency and its types as a dev dependency, with the version pinned because 2.0 is still alpha.

**Contract**: `"leaflet": "1.9.4"` (exact) in dependencies, `"@types/leaflet": "^1.9"` in devDependencies. Install with the nvm prefix, and with `--registry https://registry.npmjs.org` if the Nexus mirror lacks the package.

#### 2. Pure map helpers

**File**: `src/lib/location/map-view.ts` (new), `src/lib/location/map-view.test.ts` (new)

**Intent**: Keep the decisions that don't need a browser in one island-safe module: where the map starts, how a map position becomes a pick, and the zoom levels.

**Contract**:
- `NEUTRAL_VIEW = { latitudeDeg: 50, longitudeDeg: 15, zoom: 4 }` (Europe). `POINT_ZOOM = 11`. `DEVICE_RECENTRE_TIMEOUT_MS = 3000`.
- `parseCurrent(lat: string, lon: string): { latitudeDeg: number; longitudeDeg: number } | null`. It returns numbers only when both strings are non-empty, finite and in range (±90, ±180), else `null`. Both hosts hold strings, and onboarding's `roundedCoordinate()` returns a string.
- `initialMapView(current): { latitudeDeg, longitudeDeg, zoom, pinned: boolean }` returns `current` at `POINT_ZOOM` with `pinned: true`, else `NEUTRAL_VIEW` with `pinned: false`. The device recentre is applied later by the picker, not here.
- `pickFromMap(lat, lng)` wraps longitude into [−180, 180), clamps latitude to [−90, 90], and returns `roundCoordinate`-ed `{latitudeDeg, longitudeDeg}`.
- Tests:
  - `parseCurrent`: empty, partial, NaN, out-of-range and valid strings;
  - precedence;
  - rounding (e.g. 50.0649 → 50.06, 19.9451 → 19.95);
  - longitude wrap (190 → −170, −180 stays −180, 180 → −180);
  - latitude clamp;
  - −0 normalisation.

#### 3. Non-prompting permission check

**File**: `src/lib/location/locate.ts`, `src/lib/location/locate.test.ts`

**Intent**: Find out whether geolocation is already granted without ever showing a prompt, so the map recentres on the device only when the user has allowed it before.

**Contract**:
- `geolocationAlreadyGranted(permissions?: Pick<Permissions, "query">): Promise<boolean>` resolves `true` only when `query({ name: "geolocation" })` resolves with `state === "granted"`.
- It resolves `false` when `permissions` is undefined, `query` throws synchronously, or it rejects. It never touches `navigator.geolocation`.
- Tests use the existing fake-object style: granted, prompt, denied, undefined, sync throw, rejection.

#### 4. Precache guard, manifest side

**File**: `scripts/build-sw.mjs`

**Intent**: Users who never open the map must never download it. Keep map assets out of the precache manifest, and fail the build if one slips in.

**Contract**:
- Add `globIgnores: ["_astro/map-panel.*", "_astro/leaflet*"]` to the `injectManifest` options.
- After `injectManifest`, read the written `dist/client/sw.js` as text. Exit 1 with `build-sw: map assets leaked into the precache manifest` when it matches `/map-panel|leaflet/`.
- `injectManifest` returns no entry list, so the written file is the evidence.
- No chunk-existence check in this phase; phase 2 adds it.

#### 5. Strings

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Add every map string to the `location` block in both locales (`en.ts:291-311`, `pl.ts:275-296`).

**Contract**: new plain-string keys under `location`:
- `pickFromMap`. EN "Pick from map", PL "Wybierz na mapie".
- `mapSource`. EN "Opens a map from OpenStreetMap. The area you view is loaded from their servers.", PL "Otwiera mapę OpenStreetMap. Oglądany obszar jest pobierany z ich serwerów."
- `mapLabel`. EN "Map: tap to place the pin", PL "Mapa: dotknij, aby postawić pinezkę".
- `mapLoading`. EN "Loading the map…", PL "Wczytywanie mapy…".
- `mapFailed`. EN "The map could not be loaded. Check your connection and reload the page.", PL "Nie udało się wczytać mapy. Sprawdź połączenie i odśwież stronę."
- `mapTilesFailed`. EN "Some map tiles did not load.", PL "Część fragmentów mapy się nie wczytała."
- `pinAtCentre`. EN "Place pin at map centre", PL "Postaw pinezkę na środku mapy".
- `closeMap`. EN "Close map", PL "Zamknij mapę".
- `mapAttribution`. EN "© OpenStreetMap contributors", PL "© autorzy OpenStreetMap".
- `usingMap`. EN "Using the point you picked on the map (about 1 km)", PL "Używam punktu wybranego na mapie (około 1 km)".

The final wording may be polished during implementation, but the key set is fixed. The i18n parity test passes.

#### 6. PRD amendment

**File**: `context/foundation/prd.md`

**Intent**: Write the user's 2026-10-07 consent decision into the PRD, honestly.

**Contract**:
- Edit the guardrail (`:65-67`) and the NFR (`:377-379`) to add one exception: map tiles requested only after the user chooses "Pick from map" (roadmap S-09, GitHub #73). These tile requests reveal the area being viewed, which may start at the site's or the device's location. Only the rounded pick is stored.
- Don't cite a bare "S-09", which means another item inside the PRD.
- Add `updated: 2026-10-07` to the frontmatter after `created:`. Leave `version: 2`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new `map-view.test.ts` and `locate.test.ts` cases: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npx eslint . --ignore-pattern '.claude/**'` (`npm run lint` OOMs on this machine)
- `npm run build` succeeds and `build-sw.mjs`'s new manifest guard runs (no `map-panel` or `leaflet` in `dist/client/sw.js`)

---

## Phase 2: The map in the picker

### Overview

Build the map panel, add it to the picker, handle map picks at all four host branch points, theme tiles and chrome, and complete the build guard.

### Changes Required:

#### 0. E2E baseline (before any code)

**Intent**: Criterion 3.3 says "no new failures", so record the current e2e result first, using the recipe under Testing Strategy.

**Contract**: Save the pass/fail list to `context/changes/site-pick-from-map/evidence/e2e-baseline.txt`.

#### 1. Map panel module

**File**: `src/components/location/map-panel.tsx` (new)

**Intent**: A React component loaded only through `import()`. It owns Leaflet and its CSS, creates one map per open panel, places and drags the pin, and reports rounded picks.

**Contract**:
- Default export `MapPanel({ locale, view, current, onPick })`, where `view` comes from `initialMapView` (fixed at open) and `current` is the host's parsed coordinates.
- Imports `L from "leaflet"` and `leafletCssUrl from "leaflet/dist/leaflet.css?url"`.
- Injects the stylesheet `<link>` once, guarded by a `data-leaflet-css` attribute, and awaits its load before creating the map.
- Creates the map once (see Critical Implementation Details), with `keyboard: true`, `zoomControl: true` and `attributionControl: true`.
- Tiles: `L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution })`. The attribution HTML is `<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">${m.location.mapAttribution}</a>`. Call `map.attributionControl.setPrefix(false)`.
- Marker: the divIcon pin from Critical Implementation Details, placed at `view` when `view.pinned`.
- Events: map `click` and marker `dragend` → `pickFromMap` → `marker.setLatLng(rounded)` → `onPick(rounded)` through `useEffectEvent`.
- Exposes `pinAtCentre()` to the picker through `useImperativeHandle`, or renders the centre button itself (implementer's choice). It picks `map.getCenter()` through the same path.
- Recentre: a `recentre(lat, lng)` handle that the picker calls when a granted device position arrives. It does nothing if the user has already placed a pin.
- `tileerror`: on the first one, show `mapTilesFailed` in a muted `aria-live` line under the map.
- The wrapper `div` has `role="region"` and `aria-label={mapLabel}`. Leaflet's container inside it gets `tabIndex=0`, which is Leaflet's default.
- `map.remove()` and the `ResizeObserver` disconnect run on unmount.

#### 2. Picker integration

**File**: `src/components/location/LocationPicker.tsx`

**Intent**: Add the third option, load the panel lazily, work out the starting view, and widen the pick contract.

**Contract**:
- `LocationPick.source` gains `{ kind: "map" }`.
- New optional prop `current?: { latitudeDeg: number; longitudeDeg: number } | null`.
- Placement: a third block after the place search and its summary, separated by the same "or" divider. It holds an outline `size="lg"` "Pick from map" button with the `MapPinned` icon, `type="button"`, `data-needs-network="map-source"`, `aria-expanded`, and the `mapSource` caption as `<p id="map-source">`.
- Loading: a module-level memoised `loadMapPanel()` = `import("./map-panel")` that resets on rejection, the same pattern as `load.ts`. Status `"idle" | "loading" | "open" | "failed"`. `mapLoading` shows in an `aria-live` line. `mapFailed` uses the alert-icon treatment of a search failure. The button stays usable for a retry.
- Open sequence:
  1. `view = initialMapView(current)`, rendered at once.
  2. In parallel, if `!current` and `await geolocationAlreadyGranted(navigator.permissions)`, run `locateDevice(navigator.geolocation)` raced against `DEVICE_RECENTRE_TIMEOUT_MS`.
  3. If a position arrives in time, call the panel's `recentre` at `POINT_ZOOM`, without a pin.
- While open, the panel shows "Place pin at map centre" (outline) and "Close map" (ghost). Neither button carries `data-needs-network`, so the map can still be closed offline. The "Pick from map" button is hidden while open, and "Close map" takes its role.
- Focus: on open, move focus to the map container once it exists. On close, return focus to the "Pick from map" button.
- Map picks are forwarded as `onPick({ ...p, source: { kind: "map" } })`.
- New optional prop `closeSignal?: number`. When it changes, the panel closes (used by Undo).
- Update the header comment's privacy paragraph: the map's code and tiles load only after its click, and the device position is used only if already granted.

#### 3. Hosts: all four branch points

**File**: `src/components/gear/SiteForm.tsx`, `src/components/onboarding/OnboardingWizard.tsx`

**Intent**: Handle map picks explicitly everywhere `source.kind` is read. Today only one of the four places would fail the type check.

**Contract**:
- `CoordinateSource` (`SiteForm.tsx:33`) and `WhereSource` (`OnboardingWizard.tsx:56`) gain `{ kind: "map" }`.
- `SiteForm.tsx:121-137` `pickLocation`: replace the `else` with explicit `kind` branches. `map` sets `{kind:"map"}`, fills the coordinates and never touches the name.
- `SiteForm.tsx:149-154` summary: add `map` → `m.location.usingMap`.
- `OnboardingWizard.tsx:237-242` `pickLocation`: add the `map` branch.
- `OnboardingWizard.tsx:418-424` `whereSummary`: add `map` → `m.location.usingMap`, so it no longer falls through to `usingCoordinates`.
- Prefer a `switch` with an exhaustive `never` default in each, so a future kind fails the type check.
- Both hosts pass `current={parseCurrent(latitude, longitude)}`. SiteForm uses its field strings; onboarding uses its state, or the `roundedCoordinate()` strings.
- SiteForm's `undoLocation` bumps the picker's `closeSignal`. A map pick sets `pickerUsed` as every pick does, so the Undo note appears.

#### 4. Themes and Leaflet chrome

**File**: `src/styles/global.css`, `src/layouts/Layout.astro`

**Intent**: Make the map follow Nightfall in every theme with tokens only, overriding every Leaflet default that shows.

**Contract**:
- `Layout.astro`: add `<filter id="red-night-map">` next to `#red-only`. It is one `feColorMatrix` where R = inverted, dimmed luminance and G = B = 0; tune the coefficients against screenshots.
- `global.css`, unlayered, every selector prefixed `[data-theme]`:
  - Tile filters:
    - `[data-theme="light"] .leaflet-tile-pane { filter: none }`;
    - dark (`[data-theme="dark"] .leaflet-tile-pane`): `invert(1) hue-rotate(180deg) brightness(0.7) contrast(0.9)`, tuned;
    - `[data-theme="red"] .leaflet-tile-pane { filter: url(#red-night-map) }`;
    - `[data-theme] .leaflet-tile-pane img { filter: none }`.
  - `.leaflet-container`: background `var(--surface)` (shows while tiles load), font Archivo (`var(--font-sans)`), `--foreground` text. Focus `outline: 2px solid var(--ring)`.
  - `.leaflet-container a`: `var(--primary-strong)`.
  - `.leaflet-bar`: border `var(--border)`, no shadow.
  - `.leaflet-bar a`: `var(--surface)` / `var(--foreground)`, with `:hover` and `:focus-visible` on `var(--accent)` (exists, derived at `global.css:218`), and `.leaflet-disabled` on `var(--muted-foreground)`.
  - `.leaflet-control-attribution`: background `var(--surface)`, `var(--muted-foreground)` text.
  - `.map-pin`: `color: var(--primary)`, background none, border none.
- `--surface`, `--foreground`, `--border`, `--muted-foreground`, `--primary` and `--primary-strong` exist in every theme block. `--ring` and `--accent` are derived for `:root, [data-theme]` (`global.css:208-224`). `--font-sans` is at `:467`. If any other token is needed, add it to every theme block. Never use a literal.
- The guard tests stay green. The tests can't see `node_modules` CSS, so phase 3's screenshots are what verify the overrides.

#### 5. Build guard, chunk side

**File**: `scripts/build-sw.mjs`

**Intent**: Prove the exclusion still targets real files, and that Leaflet CSS never lands in shared CSS.

**Contract**: After the phase 1 guard, exit 1 when either holds:
- `dist/client/_astro/` has no `map-panel.*.js`;
- any `dist/client/_astro/*.css` whose name doesn't start with `leaflet` or `map-panel` contains `.leaflet-`.

### Success Criteria:

#### Automated Verification:

- Unit, i18n and style guard tests pass: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- `npm run build` passes both guards in `build-sw.mjs`: the `map-panel` chunk exists, it is absent from `sw.js`, and no shared CSS contains `.leaflet-`
- The existing `tests/e2e/site-location.spec.ts` and `tests/e2e/onboarding.spec.ts` still pass (recipe under Testing Strategy)

#### Manual Verification:

- On a local preview, "Pick from map" opens the panel immediately. Tap, drag and "Place pin at map centre" each fill 2-decimal coordinates. Undo on the edit form restores the saved values and closes the map. Typing new coordinates while the map is open moves the pin
- Keyboard only: tab to the button, open the map, focus lands on the map, pan with the arrow keys, place the pin at centre, close the map, and focus returns to the button

---

## Phase 3: Verification and docs

### Overview

Add one e2e spec for the privacy and save guarantees, capture visual evidence in every theme and locale (including WebKit for red mode), and document the new option.

### Changes Required:

#### 1. E2E spec

**File**: `tests/e2e/site-map.spec.ts` (new), `tests/e2e/helpers.ts`

**Intent**: Pin what screenshots can't show: no map request of any kind before consent, a tap pick saving rounded values, and the edit form's Undo.

**Contract**:
- `helpers.ts`: `stubMapTiles(page)` routes `https://tile.openstreetmap.org/**` to a 1×1 PNG and returns `{ count(): number }`, incremented inside the route handler.
- The spec also records `page.on("request")` URLs matching `/\/_astro\/(map-panel|leaflet)/`.
- Test 1, new site (`/gear/sites/new` after `signUp` and `onboardInMadrid`):
  1. After hydration, the tile count and the map-asset count are both 0.
  2. Click "Pick from map". Both counts become greater than 0.
  3. Click the map at a fixed offset (e.g. +60 px, +40 px from the centre).
  4. `#latitudeDeg` and `#longitudeDeg` match `/^-?\d+(\.\d{1,2})?$/` and differ from 50 / 15.
  5. Fill the name and Bortle, save, and `/gear` lists the site with the same 2-decimal values.
- Test 2, edit the onboarding Madrid site: the map opens with the pin at 40.42, −3.7, so the fields are unchanged. Click "Place pin at map centre" after panning with an arrow key. The fields change and the "Was 40.42, −3.7 · Undo" note appears. Click Undo: the fields are back to 40.42 / −3.7 and the map region is gone.

#### 2. Screenshot evidence

**File**: `context/changes/site-pick-from-map/evidence/` (new)

**Intent**: Visual proof and filter tuning.

**Contract**:
- Capture the open map panel on `/gear/sites/new` and on onboarding's home-site step, in EN and PL, in dark, light and red, at 390 × 844 and 1280 × 800, against real OSM tiles on the local preview. Use real tiles for the manual captures only; e2e stays stubbed.
- Add one red-mode capture in Playwright `webkit`. Install it with `npx playwright install webkit` if missing.
- A tiny script in the scratchpad samples the red captures and reports the maximum G and B channel values, which must be 0, or ≤ 2 for antialiasing.
- `evidence/README.md` lists the captures and the channel result.

#### 3. Documentation

**File**: `CLAUDE.md`

**Intent**: Extend the "Location picking (S-08)" architecture paragraph with S-09.

**Contract**: The new text covers:
- Leaflet 1.9.4 and OSM tiles, with consent by click;
- `map-panel.tsx` as the only Leaflet importer, loaded lazily with its CSS by `?url`;
- the `build-sw.mjs` guards;
- the `[data-theme]`-prefixed Leaflet overrides;
- the `#red-night-map` filter, with the tile `img` filter set to `none`;
- `{kind:"map"}` handled at the four host branch points.

Add a lessons.md entry only if a new recurring rule emerges.

### Success Criteria:

#### Automated Verification:

- The new e2e spec passes against a local preview: `npx playwright test site-map`
- The full unit suite passes: `npm test`
- The full e2e suite shows no new failures compared with `evidence/e2e-baseline.txt`: `npx playwright test`

#### Manual Verification:

- Screenshots show legible tiles and controls with visible focus and the credit, in EN and PL, dark, light and red, at 390 px and 1280 px, with no Leaflet default white, grey or blue showing. The red-mode channel check (Chromium and WebKit) reports no green or blue light
- Polish copy fits the button, caption and panel buttons at 390 px without overflow

---

## Testing Strategy

### Unit Tests:

- `parseCurrent`, `initialMapView` and `pickFromMap` (rounding, wrap, clamp, −0)
- `geolocationAlreadyGranted`: granted, prompt, denied, missing, throwing, rejecting; never prompts
- The existing i18n parity, colour, red and contrast guards stay green

### Integration Tests (E2E recipe):

Playwright has no `webServer`, so the caller starts everything. This follows the verified recipe in `context/handoff.md` › "Local e2e recipe", which mirrors `.github/workflows/ci.yml` lines 41-75. Prefix every command with `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null &&`.

1. Make sure Docker is running, and that port 4321 is free (`lsof -iTCP:4321 -sTCP:LISTEN`, `npx astro preview status`). Then run `npx supabase start`.
2. Read `API_URL` and `ANON_KEY` from `npx supabase status -o env`.
3. Build with `npm run build`, never a bare `astro build`. Then write `SUPABASE_URL=<API_URL>`, `SUPABASE_KEY=<ANON_KEY>` and `FORECAST_BASE_URL=http://127.0.0.1:4400` into **`dist/server/.dev.vars` only**. The repo's `.env` and `.dev.vars` stay untouched (they point at hosted). Every build overwrites the copy, so rewrite it after each rebuild.
4. Run `npx astro preview --port 4321`. Astro 7's preview detaches as a daemon; stop it with `npx astro preview stop`.
5. Start the forecast fixture in the same foreground command as the tests, because background tasks die after 2 h: `FIXTURE_PORT=4400 node tests/e2e/forecast-fixture.mjs & FIX=$!; SUPABASE_URL=$API_URL SUPABASE_KEY=$ANON_KEY BASE_URL=http://localhost:4321 npx playwright test <spec>; kill $FIX`.
6. If browsers are missing, run `npx playwright install chromium` (plus `webkit` for the phase 3 red capture).
7. Run `npx astro preview stop` as soon as the run ends. A running preview looks like a hung task to the user.

Specs: `site-map.spec.ts` (new); regression `site-location.spec.ts`, `onboarding.spec.ts`; full suite against the baseline.

### Manual Testing Steps:

1. `/gear/sites/new` at 390 px: the DevTools Network panel shows no OSM or map-panel request. Click "Pick from map".
2. Tap, drag, centre-pin, and check the fields hold 2-decimal values. Save.
3. Repeat on onboarding's home-site step, and on the edit form with Undo.
4. Cycle the themes with the map open. Red mode shows no green or blue light.
5. DevTools offline: "Pick from map" is disabled with "Needs a connection", and an already open map still closes.

## Performance Considerations

- Leaflet is about 42 KB gzipped of JS plus about 4 KB of CSS. It is fetched only after the click and never precached or merged into shared CSS, and the build guard enforces both. Onboarding's first load does not grow.
- The SVG filter in red mode renders in software. If panning stutters on a phone, the fallback is a lower-cost CSS chain for dark mode only, with red-mode stutter accepted. Note the result in the evidence.

## Migration Notes

None: no schema or data change. A map pick is stored like any other coordinates.

## References

- Research: `context/changes/site-pick-from-map/research.md`
- Plan review: `context/changes/site-pick-from-map/reviews/plan-review.md`
- S-08 plan: `context/archive/2026-10-03-site-use-my-location/plan.md`
- Picker: `src/components/location/LocationPicker.tsx:26-41`
- Lazy-load precedent: `src/lib/gear/catalogue/load.ts:12-17`
- Precache: `scripts/build-sw.mjs:47-60`, `node_modules/workbox-build/build/types.d.ts:377,490-496`
- Offline gating: `src/lib/offline/page-state.ts:64-106`, `src/layouts/Layout.astro:64-86`
- Red filter: `src/styles/global.css:256-258`, `src/layouts/Layout.astro:70`
- E2E helpers: `tests/e2e/helpers.ts:55-86`, `tests/e2e/site-location.spec.ts`
- OSM tile policy: https://operations.osmfoundation.org/policies/tiles/

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Map foundation

#### Automated

- [x] 1.1 Unit tests pass, including the new `map-view.test.ts` and `locate.test.ts` cases: `npm test`
- [x] 1.2 Type check passes: `npx astro check`
- [x] 1.3 Lint passes: `npx eslint . --ignore-pattern '.claude/**'` (`npm run lint` OOMs on this machine)
- [x] 1.4 `npm run build` succeeds and `build-sw.mjs`'s new manifest guard runs (no `map-panel` or `leaflet` in `dist/client/sw.js`)

### Phase 2: The map in the picker

#### Automated

- [ ] 2.1 Unit, i18n and style guard tests pass: `npm test`
- [ ] 2.2 Type check passes: `npx astro check`
- [ ] 2.3 Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- [ ] 2.4 `npm run build` passes both guards in `build-sw.mjs`: the `map-panel` chunk exists, it is absent from `sw.js`, and no shared CSS contains `.leaflet-`
- [ ] 2.5 The existing `tests/e2e/site-location.spec.ts` and `tests/e2e/onboarding.spec.ts` still pass (recipe under Testing Strategy)

#### Manual

- [ ] 2.6 On a local preview, "Pick from map" opens the panel immediately. Tap, drag and "Place pin at map centre" each fill 2-decimal coordinates. Undo on the edit form restores the saved values and closes the map. Typing new coordinates while the map is open moves the pin
- [ ] 2.7 Keyboard only: tab to the button, open the map, focus lands on the map, pan with the arrow keys, place the pin at centre, close the map, and focus returns to the button

### Phase 3: Verification and docs

#### Automated

- [ ] 3.1 The new e2e spec passes against a local preview: `npx playwright test site-map`
- [ ] 3.2 The full unit suite passes: `npm test`
- [ ] 3.3 The full e2e suite shows no new failures compared with `evidence/e2e-baseline.txt`: `npx playwright test`

#### Manual

- [ ] 3.4 Screenshots show legible tiles and controls with visible focus and the credit, in EN and PL, dark, light and red, at 390 px and 1280 px, with no Leaflet default white, grey or blue showing. The red-mode channel check (Chromium and WebKit) reports no green or blue light
- [ ] 3.5 Polish copy fits the button, caption and panel buttons at 390 px without overflow
