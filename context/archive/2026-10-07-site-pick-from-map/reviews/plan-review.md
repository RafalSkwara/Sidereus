<!-- PLAN-REVIEW-REPORT -->
# Plan Review: "Pick from map" (S-09)

- **Plan**: `context/changes/site-pick-from-map/plan.md`
- **Date**: 2026-10-07
- **Phases**: 3
- **Findings**: 0 critical, 8 warnings, 2 observations
- **Overall**: NEEDS ATTENTION → all findings FIXED (user chose "apply all")
- **Method**: two Opus sub-agents (claim verification; feasibility/sequencing/architecture) plus local checks of the verification commands. Vitest 5.0.1, Playwright 1.55 and `npx astro check` all resolve. `playwright test site-map --list` reports 0 tests, as expected before phase 3. `dist/client/_astro/` holds one site-wide CSS file (`TopbarControls.DLxwfhnU.css`).

## Verdicts

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Claim Accuracy | WARNING | F2, F4, F7 |
| Substance | PASS | |
| Feasibility | WARNING | F1, F3 |
| Sequencing | PASS | |
| Architecture Fit | WARNING | F5 |
| Scope Discipline | PASS | |
| Verifiability | WARNING | F6 |
| Coverage | WARNING | F8, F10 |

## Findings

### F1 — Leaflet's CSS may be merged into the site-wide stylesheet
- **Severity**: WARNING (near critical) · **Impact**: MEDIUM · **Dimension**: Feasibility · **Location**: Phase 1 #4, Phase 2 #1
- **Detail**: Today's build emits a single CSS file for the whole site (`dist/client/_astro/TopbarControls.DLxwfhnU.css`, which contains global.css). Nothing guarantees that `import "leaflet/dist/leaflet.css"` inside a lazily imported module becomes `map-panel.*.css`. Astro may hoist it into the page or global stylesheet. It would then load on every page and be precached, and `globIgnores` would miss it.
- **Fix**: Load the CSS deterministically with `import leafletCssUrl from "leaflet/dist/leaflet.css?url"` in `map-panel.tsx`, and inject a `<link rel="stylesheet">` once before creating the map (await its `load`). Extend the build check to fail when any non-map CSS file in `dist/client/_astro/` contains `.leaflet-`. · Strength: deterministic, and the check proves it. · Tradeoff: about 10 lines of loader code. · Confidence: HIGH, because the single CSS file was observed. · Blind spot: the `?url` asset name (`leaflet.<hash>.css`) is assumed to match `_astro/leaflet*`. Phase 1 verifies it.
- **Decision**: FIXED (applied to plan.md 2026-10-07)

### F2 — The build assertion cannot read the manifest from `injectManifest`
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Claim Accuracy · **Location**: Phase 1 #4
- **Detail**: `injectManifest` returns `{count, size, warnings}` with no entries (`node_modules/workbox-build/build/types.d.ts:490-496`). `globIgnores` is accepted (`:377`) and is relative to `dist/client`. Tying the "chunk exists" check to the source file existing would silently switch it off after a rename.
- **Fix**: After `injectManifest`, read the written `dist/client/sw.js` and fail when it matches `/map-panel|leaflet/`. Phase 1 adds only that check. Phase 2 adds the "a `_astro/map-panel.*.js` exists" check unconditionally.
- **Decision**: FIXED (applied to plan.md 2026-10-07)

### F3 — Leaflet's CSS will beat the planned overrides
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Feasibility · **Location**: Phase 2 #4
- **Detail**: leaflet.css has no `@layer` and loads after global.css, so it beats Tailwind's layered utilities and any global.css rule of equal specificity. The plan's list also misses these Leaflet defaults: `.leaflet-container a { color:#0078A8 }` (blue in red mode), `.leaflet-bar a:hover/:focus`, `.leaflet-container { background:#ddd; font: 12px Helvetica }`, the attribution's `rgba(255,255,255,.8)` background, and `.leaflet-div-icon { background:#fff; border:1px solid #666 }`. The guard tests won't catch any of these: they scan `src/` only, and the red test only reads hex and `rgb()` inside `[data-theme="red"] {` blocks.
- **Fix**: Write the overrides unlayered and prefixed with `[data-theme]` (always set on `<html>`). Cover the container background and font (Archivo), links, the bar buttons in normal, hover, focus and disabled states, the attribution background and text, borders and shadows. Give the `divIcon` its own `className` (for example `map-pin`) so `leaflet-div-icon` never applies.
- **Decision**: FIXED (applied to plan.md 2026-10-07)

### F4 — Widening `source.kind` fails silently in 3 of 4 places
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Claim Accuracy · **Location**: Phase 2 #3
- **Detail**: Only `OnboardingWizard.tsx:240` (a ternary that reads `.label`) would fail the type check. These would not:
  - `SiteForm.tsx:133-135`'s `else` branch records a map pick as `{kind:"device"}`;
  - `SiteForm.tsx:149-154` shows a `null` summary;
  - `OnboardingWizard.tsx:418-424` (`whereSummary`) falls through to `usingCoordinates`.
  
  `roundedCoordinate()` (`OnboardingWizard.tsx:105-109`) returns a string, so `current` needs `Number()` plus a finite check.
- **Fix**: List all four edit points in Phase 2 #3. Switch the branches to explicit `kind` checks (or a `switch` with an exhaustive `never` default), and parse `current` from the strings.
- **Decision**: FIXED (applied to plan.md 2026-10-07)

### F5 — Map lifecycle: a rebuild on every pick, and pin drift
- **Severity**: WARNING · **Impact**: MEDIUM · **Dimension**: Architecture Fit · **Location**: Phase 2 #1-#3
- **Detail**: `LocationPicker` passes a new inline `onPick` on every render, and the host re-renders after each pick. An effect that creates the map with `[onPick, view]` dependencies (which `exhaustive-deps` pushes for) tears the map down after every drop. Undo, or manual typing while the map is open, also leaves the pin away from the fields.
- **Fix**: Create the map once (effect `[]`, `map.remove()` in cleanup). Read `onPick` through `useEffectEvent` (React 19.2). Fix `view` in state when the panel opens. Close the panel on Undo. While the panel is open, an external change of `current` (typing) moves the pin without recentring. · Strength: one map instance, and the pin always matches the fields. · Tradeoff: a small `current`-sync effect. · Confidence: HIGH. · Blind spot: whether the React version in use exports `useEffectEvent`; if not, use a ref updated in an effect.
- **Decision**: FIXED (applied to plan.md 2026-10-07)

### F6 — The e2e plan is not runnable as written
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Verifiability · **Location**: Phase 2 (2.5), Phase 3 (3.1, 3.3), Key Discoveries
- **Detail**:
  - `playwright.config.ts` has no `webServer`. E2E needs local Supabase, a build against local env, the forecast fixture and a running preview.
  - 3.3 "no new failures" has no baseline.
  - Test 2 assumes a saved Kraków site, but `onboardInMadrid` (`helpers.ts:77-86`) saves Madrid (40.42, −3.7).
  - "Request counting follows site-location.spec.ts:26-37" is wrong: that counts `getCurrentPosition` calls through `addInitScript`. Network counting is a `page.route` handler.
  - Test 1 checks only tiles, not the map chunk. Its neutral centre (50, 15) doesn't prove rounding.
- **Fix**:
  - Add the run recipe to the plan.
  - Record a baseline run of the full e2e suite before Phase 2.
  - Test 2 uses the Madrid site.
  - `stubMapTiles` counts in its route handler.
  - Test 1 also asserts zero `/_astro/(map-panel|leaflet)` requests before the click and at least one after.
- **Decision**: FIXED (applied to plan.md 2026-10-07)

### F7 — The PRD amendment overstates the privacy, and its details are wrong
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Claim Accuracy · **Location**: Phase 1 #6
- **Detail**:
  - The plan says tile requests are "not the site's coordinates". But the map opens on the saved site or the device at zoom 11, so tile `z/x/y` URLs do locate it to tile precision.
  - `prd.md` has no `updated:` field (`:1-17` has `version: 2`).
  - The guardrail (`:65-67`) names only "the forecast lookup". Forecast and geocoding together appear only in the NFR (`:377-379`).
  - "(S-09)" means a different item inside the PRD (`:168`, `:374`).
- **Fix**:
  - Wording: tile requests reveal the area being viewed, which may start at the site or device location. They happen only after the user chooses "Pick from map", and only the rounded pick is stored.
  - Cite "roadmap S-09 / GitHub #73".
  - Edit both passages.
  - Add `updated: 2026-10-07` (or bump `version`).
- **Decision**: FIXED (applied to plan.md 2026-10-07)

### F8 — UX edge cases in the panel
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Coverage · **Location**: Phase 2 #1-#2, #5
- **Detail**:
  - (a) The starting view waits up to `locateDevice`'s 15 s timeout when permission is granted.
  - (b) A toggle button with `data-needs-network` is disabled offline, so an open map can't be closed. `data-needs-network` gives `aria-disabled`, not `disabled` (`page-state.ts:64-78,100-106`).
  - (c) The attribution link navigates away and drops unsaved form input.
  - (d) A Leaflet marker is focusable by default but has no accessible name.
  - (e) A failed `import()` may stay cached by the browser (`load.ts:13-14`), and after a deploy an open tab's old chunk hash returns 404.
  - (f) There is no hint when tiles fail (OSM blocked or throttled).
- **Fix**:
  - (a) Open on `current` or the neutral view at once. Recentre on the device position only if it arrives within ~3 s and `current` was absent.
  - (b) Put `data-needs-network="<mapSource caption id>"` only on the "Pick from map" button. "Close map" is a separate button without it.
  - (c) Give the attribution link `target="_blank" rel="noopener noreferrer"`.
  - (d) Set the marker to `keyboard: false` (centre-pin covers keyboard use).
  - (e) Make the `mapFailed` copy suggest reloading the page.
  - (f) After the first `tileerror`, show a quiet `mapTilesFailed` hint under the map. This needs one extra i18n key.
- **Decision**: FIXED (applied to plan.md 2026-10-07)

### F9 — Red-mode filter chain: Safari and performance risk
- **Severity**: OBSERVATION · **Impact**: MEDIUM · **Dimension**: Feasibility · **Location**: Critical Implementation Details, Phase 2 #4
- **Detail**: The order claim is right: a child's filter runs before its ancestor's, so the tile `img` filter must be `none`. A mixed `invert(…) … url(#red-only)` chain on a pane whose children have transforms is untested in WebKit. `url()` filters render in software, so panning may stutter.
- **Fix**: For red mode, use one SVG filter, `#red-night-map` in `Layout.astro`, a single `feColorMatrix` that folds inversion, dimming and luminance-to-red into one matrix. Dark mode keeps plain CSS functions. Check Safari (WebKit via Playwright `webkit`, or a real device) in the phase 3 screenshots, and check the red pixels with a channel-sampling script.
- **Decision**: FIXED (applied to plan.md 2026-10-07)

### F10 — Lifecycle bookkeeping is not in the plan
- **Severity**: OBSERVATION · **Impact**: LOW · **Dimension**: Coverage · **Location**: whole plan
- **Detail**: The roadmap and board flips (in-progress, then done), closing M-2 after S-09 ships, and pushing commit 840b68f are not in any phase.
- **Fix**: Track these in `context/handoff.md` rather than in the plan. `/10x-implement` and `/10x-archive` already own the roadmap and board flips.
- **Decision**: FIXED (applied to plan.md 2026-10-07)
