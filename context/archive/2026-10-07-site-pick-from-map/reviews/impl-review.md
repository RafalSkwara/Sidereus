<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: "Pick from map" (S-09)

- **Plan**: context/changes/site-pick-from-map/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-07
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 6 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

**Plan adherence:** every planned item matches. The three deviations are recorded in plan.md › "Implementation decisions" and judged sound:

- the CSS guard checks for rules that only leaflet.css has;
- the centre pin and the recentre are props, not imperative handles;
- the red filter is applied to the tile images.

The extras are harmless: clearing the coordinates removes the pin, and the pin has a stroke.

**Success criteria:** `npm test` passes with 834 tests, and `dist/client/sw.js` contains no map asset. astro check, eslint, the build guards (break-tested), `site-map` (also break-tested) and the full e2e suite all passed in the implement run. The manual rows 2.6, 2.7, 3.4 and 3.5 have evidence in plan.md › Implementation decisions and in `evidence/`.

**Checked and fine:**

- No XSS: the attribution and the divIcon HTML are constants or catalogue strings.
- Privacy: no logging, picks are rounded before `onPick`, the device is used only when already granted, and nothing is stored.
- Effect lifecycles: the `cancelled` flag, the `mapOpening` counter, ResizeObserver plus `map.remove()`, and memo reset on failure.
- CSS specificity: every override beats leaflet.css.
- Tokens exist in every theme.
- `#red-night-map` has zero G and B rows.

## Findings

### F1 — Leaflet's zoom buttons are English in every locale

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/location/map-panel.tsx:102
- **Detail**: `zoomControl: true` uses Leaflet's default `zoomInTitle`/`zoomOutTitle` ("Zoom in" / "Zoom out"), written as both `title` and `aria-label` (leaflet-src.js:5552-5558). Polish users see and hear English, which breaks the rule that every string is a catalogue key.
- **Fix**: Create the map with `zoomControl: false`, then add `L.control.zoom({ zoomInTitle: t.zoomIn, zoomOutTitle: t.zoomOut })` with new `location.zoomIn` / `location.zoomOut` keys in EN and PL.
- **Decision**: FIXED (map-panel uses `L.control.zoom` with `location.zoomIn` / `zoomOut`)

### F2 — The offline button names the source caption, not "Needs a connection"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/location/LocationPicker.tsx:366,372
- **Detail**: The value of `data-needs-network="map-source"` names the always-visible OpenStreetMap caption. While offline, `page-state.ts` adds that id as the button's description, so a screen reader hears an aria-disabled button with no reason. The repo convention names a hidden `offline:` "Needs a connection" caption (SkyAnswerForm.astro:56, TopbarControls), or uses `""` for the layout's text. This also contradicts the plan's manual step 5. Online, the privacy caption is never linked to the button.
- **Fix**: Set `data-needs-network=""` so the layout's "Needs a connection" is used, and give the button a permanent `aria-describedby="map-source"` so the source disclosure is announced on focus. page-state then appends the offline text.
- **Decision**: FIXED (`data-needs-network=""` + permanent `aria-describedby="map-source"`)

### F3 — Shift-drag zoom box is blue and white (red and dark modes)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/location/map-panel.tsx:102 · src/styles/global.css
- **Detail**: `boxZoom` is on by default. On desktop, shift-drag draws `.leaflet-zoom-box` with `border: 2px dotted #38f` and a translucent white background (leaflet.css:267), and global.css has no override. This is the only uncovered Leaflet colour, and it breaks red mode's no-green-or-blue rule.
- **Fix**: Pass `boxZoom: false`. Shift-drag zoom adds nothing to a pin picker, and the zoom buttons, wheel and pinch remain.
- **Decision**: FIXED (`boxZoom: false`)

### F4 — Focus is lost when the map fails to load

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/location/LocationPicker.tsx:357-367,395
- **Detail**: The "Pick from map" button is truly `disabled` while loading and is unmounted while open. If the chunk import fails, or if leaflet.css fails (`onFailed`), the status becomes "failed" and the button returns, but nothing refocuses it. Focus is left on `<body>`, and only the aria-live text says what happened.
- **Fix**: On both failure paths, refocus `pickMapRef` in a requestAnimationFrame, as `closeMap` already does.
- **Decision**: FIXED (`failMap()` refocuses "Pick from map" on both failure paths)

### F5 — A throw while building the map leaves a blank, stuck panel

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/location/map-panel.tsx:98-139
- **Detail**: In `.then(onOk, onErr)`, an exception inside `onOk` (from `L.map` or `setView`) becomes an unhandled rejection. The panel stays open and empty, and `fail()` never runs.
- **Fix**: Build in `.then(build)` and add `.catch((error) => { if (!cancelled) fail(); reportError(error); })`. The failure becomes visible to the user and keeps its cause, without using `console`.
- **Decision**: FIXED (`.then(build).catch(...)`: shows the failure, `reportError` keeps the cause of a build throw; `mapRef` set right after `L.map` so cleanup removes a half-built map)

### F6 — A late device position can undo the user's panning

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/location/map-panel.tsx:167-172
- **Detail**: The recentre is skipped only when a pin exists. If the user pans or zooms the neutral view before an already-granted position arrives (within 3 s), the map jumps to the device anyway.
- **Fix**: Record the first user `dragstart`/`zoomstart`/keyboard pan, and skip the recentre after it.
- **Decision**: FIXED (`userMovedRef`, set by the first `dragstart`/`zoomstart`/`keydown`; the recentre skips after it)

### F7 — "Place pin at map centre" is a silent no-op before the map is ready

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/location/LocationPicker.tsx:407 · map-panel.tsx:174-180
- **Detail**: The buttons render as soon as the chunk resolves, while leaflet.css may still be loading. A click then bumps the signal, finds no map and is lost. No loading text shows during this gap either.
- **Fix**: Add an `onReady` callback from the panel. Keep the "Loading the map..." line and disable the centre button until the map is ready.
- **Decision**: FIXED (`onReady` from the panel; "Loading the map..." stays and the centre button is disabled until the map is ready)

### F8 — Map accessibility labelling: constant aria-expanded, unnamed focus target

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/location/LocationPicker.tsx:365 · map-panel.tsx:183-185
- **Detail**: `aria-expanded={false}` is a constant on a button that exists only while the map is collapsed. Focus lands on Leaflet's container, which has no role or name; the region name, "tap to place the pin", sits on the wrapper and does not help keyboard users.
- **Fix**: Drop `aria-expanded`, and give Leaflet's container an `aria-label` from a new key (e.g. "Map: arrow keys pan; then use Place pin at map centre").
- **Decision**: FIXED (`aria-expanded` dropped; Leaflet container gets `role="group"` + `aria-label` from `location.mapKeyboardLabel`)

### F9 — Hosts pass `current` differently (rounded vs unrounded)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/gear/SiteForm.tsx:212 · src/components/onboarding/OnboardingWizard.tsx:502
- **Detail**: Onboarding rounds the typed point before passing it, SiteForm does not, so the SiteForm pin sits on the exact typed point. This affects consistency only: the tiles reveal the same area either way, and the schema rounds on save.
- **Fix**: Round inside `parseCurrent` (one place), and drop onboarding's extra `roundedCoordinate` there.
- **Decision**: FIXED (`parseCurrent` rounds; both hosts pass their raw strings; test added)

### F10 — Stale wording after the documented adaptations

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/location/map-panel.tsx:14-15 · src/layouts/Layout.astro:73 · CLAUDE.md "Location picking"
- **Detail**: Three places still describe behaviour that changed during implementation:
  - The map-panel header says the build fails when "`.leaflet-` rules" reach shared CSS; the guard now checks rules only leaflet.css has.
  - The Layout.astro comment says the red filter is on `.leaflet-tile-pane`; it is now on the tile images.
  - CLAUDE.md uses "(S-09)" for both the PRD's sign-in `next` item and the roadmap map slice.
- **Fix**: Update both comments. In CLAUDE.md, call the map "roadmap S-09".
- **Decision**: FIXED (map-panel header and Layout.astro comment updated; CLAUDE.md says "roadmap S-09")
