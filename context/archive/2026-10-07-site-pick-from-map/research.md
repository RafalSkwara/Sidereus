---
date: 2026-10-07T15:39:44+0200
researcher: Claude (Opus 5.5) for Rafal Skwara
git_commit: 840b68f
branch: feat/site-pick-from-map
repository: RafalSkwara/Sidereus
topic: "S-09 Pick from map: consent-gated map on the site form and onboarding"
tags: [research, location-picker, site-form, onboarding, map, privacy, service-worker, red-theme]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude (Opus 5.5)
---

# Research: S-09 "Pick from map"

**Date**: 2026-10-07T15:39:44+0200
**Researcher**: Claude (Opus 5.5) for Rafal Skwara
**Git Commit**: 840b68f (local, not pushed)
**Branch**: feat/site-pick-from-map
**Repository**: RafalSkwara/Sidereus

## Research Question

How does a "Pick from map" option join the S-08 shared location picker on the add/edit site form and onboarding's home-site step, with map tiles loaded only after the user chooses it (that click is the consent)? Covered: the picker contract, host forms, ~1 km rounding, how "already allowed" geolocation could be detected, theme and red night mode, CSP / service-worker / bundle constraints, prior decisions, and candidate map libraries and tile providers.

## Summary

- The S-08 `LocationPicker` was built as the single extension point for S-09. It emits already-rounded `LocationPick` values through `onPick`; hosts own the coordinate fields. A map pick needs a third `source` kind (`{kind:"map"}`) and handling in both hosts' `pickLocation` (`SiteForm.tsx:121-137`, `OnboardingWizard.tsx:237-242`).
- Rounding is `roundCoordinate` (2 decimals, half away from zero) in `src/lib/gear/coordinates.ts:8-11`; the zod schema rounds again (`src/lib/gear/schemas.ts:47-48`).
- No code in `src/` queries `navigator.permissions`. Starting the map "at the device location only if already allowed" (roadmap S-09 outcome) needs a new non-prompting `permissions.query({name:"geolocation"})` check; browsers without the API fall back to the neutral view.
- There is no CSP or security header in the repo (src, astro.config.mjs, wrangler.jsonc, public/), so third-party tile images are not blocked. Inspected scope only; Cloudflare dashboard rules not checked.
- **Bundle trap:** the service worker precaches every `_astro/**/*.{js,css,woff2}` (`scripts/build-sw.mjs:51`) with no ignores, so a lazily imported map chunk would still be downloaded by every user on SW install. The plan must exclude it (`globIgnores`) or accept the cost.
- Red night mode filters `img` elements through `url(#red-only)` (`src/styles/global.css:256-258`, filter in `src/layouts/Layout.astro:70`). Raster tiles rendered as `<img>` (Leaflet) inherit it for free; a WebGL canvas (MapLibre) would not.
- **PRD wording gap:** prd.md:377-379 says coordinates "never leave the product except in the forecast and geocoding lookups". Tile requests reveal the viewed area to a new third party. The user's 2026-10-07 consent decision lives in roadmap.md:250 only; the PRD was not amended.
- Web research ranks **Leaflet 1.9.4 + raster tiles** first (≈42 KB gz JS, no key, no WebGL, `<img>` tiles → red filter works). Provider choice is between OSM standard tiles (no key, policy allows normal interactive use with attribution and Referer) and keyed free tiers with a native dark style (CARTO, Stadia). MapLibre 6 + OpenFreeMap is the heavier vector alternative.

## Detailed Findings

### S-08 shared picker (`src/components/location/LocationPicker.tsx`)

- Props `{ locale, onPick, summary, invalid?, errorId? }` (`:32-41`); `LocationPick = {latitudeDeg, longitudeDeg, source}` with `source` = `{kind:"device"}` | `{kind:"place", label, name}` (`:26-30`).
- "Use my location" calls `locateDevice` only on click (`:70-81`, button `:155-165`); `locate.ts:21` uses low accuracy, 15 s timeout, 10 min max age; failures map to `"denied" | "unavailable"` (`locate.ts:14`, `:28-47`).
- Status hint is in an `aria-live="polite"` paragraph (`:166`); place-search failure shows `errors.geocoding.failed` with an alert icon (`:211-222`). After a place pick, focus moves to the host's summary (`:129`).
- The picker's search input has `name=""` so it never joins the form payload (`:189`) — the same trick applies to any map UI.

### Host forms

- `SiteForm.tsx` (used by `src/pages/gear/sites/new.astro:26` and `[id].astro:48-62`): string state for lat/lon (`:59-60`), number inputs step 0.01 (`:186-219`), `pickLocation` fills fields, fills an empty name from a place pick, clears errors (`:121-137`); edit-only Undo (`:139-147`, `:157`); client validation with `siteInputSchema` on submit (`:86-107`); native POST to `src/pages/api/gear/sites/index.ts:15-33`.
- `OnboardingWizard.tsx`: `latitude/longitude/source/manualOpen` state (`:151-154`), `pickLocation` (`:237-242`), hidden inputs (`:460`), picker with `invalid`/`errorId` (`:475-481`), manual `<details>` fields (`:488-531`); `onboardingInputSchema` reuses the site lat/lon shape (`src/lib/onboarding/schemas.ts:55-74`).
- Only the time zone is derived from coordinates, server-side (`src/lib/gear/timezone.ts:22-37`). Bortle stays manual (site form) or scene-based (onboarding `:353`).

### Rounding and privacy rules

- `roundCoordinate` at `src/lib/gear/coordinates.ts:8-11`: 0.01° ≈ 1.1 km latitude.
- Lint: `src/components/location/**` and `src/lib/location/**` are already in `gearConfig.files` (`eslint.config.js:83-113`), so a map component placed there satisfies the lessons.md rule without a new glob.
- prd.md:65-67 guardrail and prd.md:377-379 NFR restrict third-party requests carrying coordinates; prd.md:~391 requires crediting data sources whose licences need attribution (OSM/ODbL would).

### Theme and red night mode

- Tokens in `src/styles/global.css` (dark default `:root`, `[data-theme="light"]` `:73`, `[data-theme="red"]` `:162`), set on `<html>` by `Layout.astro:20` and toggled by `TopbarControls.tsx:146`.
- Guards: `src/styles/no-hardcoded-colors.test.ts` rejects hex/rgb/palette classes in `src/` outside `global.css`; `red-theme.test.ts` pins zero green/blue in red tokens; `contrast.test.ts` pins contrast floors. Any map CSS overrides (controls, attribution, marker) must use tokens.
- `[data-theme="red"] img { filter: url(#red-only) }` (`global.css:256-258`) covers Leaflet's `<img>` tiles and the default marker image; dark/light tile treatment is not covered by any existing rule.

### Platform constraints

- No CSP anywhere inspected; `src/middleware.ts:47-50` only adds `Vary`. `wrangler.jsonc:17` redacts query strings in observability.
- Service worker routes are all `sameOrigin`-guarded (`src/sw.ts:527, 538, 572, 584, 606`), so cross-origin tiles are neither intercepted nor cached (map is online-only, acceptable).
- Precache: `scripts/build-sw.mjs:51` `globPatterns: ["_astro/**/*.{js,css,woff2}"]`, no `globIgnores`, no size cap. Precedent: the catalogue JSON chunks (113 KB, 90 KB) are already precached this way.
- Lazy-load precedent: memoised `import()` in `src/lib/gear/catalogue/load.ts:12,22`.
- No page-weight budget is documented (PRD, tech-stack, lessons, tests). Islands use `client:load`; React 19 runtime chunk ≈209 KB.
- Existing browser third-party call: Open-Meteo geocoding (`src/lib/location/geocode.ts:17`), credited in `src/pages/onboarding.astro:40-56`; `src/pages/gear/sites/new.astro` has no credit line. There is no privacy page.

### Tests

- Unit: vitest `src/**/*.test.ts` only (`vitest.config.ts:17`) — no component tests; `locate.test.ts`, `geocode.test.ts`, `coordinates.test.ts`, `schemas.test.ts`, i18n parity `i18n.test.ts`.
- E2E: `tests/e2e/site-location.spec.ts` (grants geolocation via `test.use`, counts calls via init script, asserts 0 before click, 1 after), `onboarding.spec.ts:102-105`, `stubPlaceSearch` in `tests/e2e/helpers.ts:55-59` (route-stubbing pattern reusable for tile hosts), `red-night-mode.spec.ts`.

### Map libraries (web, 2026-10-07)

| Option | Facts | Fit |
| --- | --- | --- |
| Leaflet 1.9.4 | npm `latest` (2023-05-18); 2.0 only `alpha`. ≈42.4 KB gz JS (measured) + CSS. Raster `<img>` tiles, no WebGL/workers. Keyboard pan/zoom built in; marker drag not keyboard-operable. | Best |
| MapLibre GL JS 6.13.0 | WebGL2 required, ESM-only; gz size unmeasured (secondary source ≈200 KB). Canvas rendering, so the `img` red filter does not apply; needs a recoloured vector style. | Heavier alternative |
| OpenLayers 10.11 | ≈298 KB gz monolithic. | Reject |

Sources: registry.npmjs.org/leaflet, leafletjs.com, maplibre.org docs, release notes for v6.

### Tile providers (web, 2026-10-07)

| Provider | Key | Terms | Attribution | Dark |
| --- | --- | --- | --- | --- |
| OSM standard (tile.openstreetmap.org) | none | Normal interactive use allowed; no prefetch/offline, keep Referer, honour caching, no SLA, may block heavy use ([policy](https://operations.osmfoundation.org/policies/tiles/)) | "© OpenStreetMap contributors", visible | no (CSS filter) |
| CARTO basemaps | free key now required (watermark without) | 5M req/mo non-commercial ([apikey](https://carto.com/basemaps/apikey/)) | "© OpenStreetMap contributors, © CARTO" | Dark Matter |
| Stadia Maps | domain auth (no key in code) | 200k credits/mo, free tier non-commercial ([pricing](https://stadiamaps.com/pricing/)) | not verified | Alidade Smooth Dark (unverified) |
| OpenFreeMap | none | free, commercial ok, as-is, may end without notice ([tos](https://openfreemap.org/tos/)) | "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" | Dark (vector, MapLibre only) |
| MapTiler / Protomaps | key | 5k sessions/mo; Protomaps non-commercial | logo / © OSM | yes |

Referrer: no `Referrer-Policy` is set in the repo, so browsers send the default `strict-origin-when-cross-origin`, which satisfies OSM's Referer requirement.

## Code References

- `src/components/location/LocationPicker.tsx:26-41` — pick contract and props
- `src/lib/location/locate.ts:14-47` — on-click geolocation, failure mapping
- `src/lib/gear/coordinates.ts:8-11` — `roundCoordinate`
- `src/lib/gear/schemas.ts:44-71` — `siteInputSchema`
- `src/components/gear/SiteForm.tsx:121-147` — host pick handling + Undo
- `src/components/onboarding/OnboardingWizard.tsx:237-242, 460-531` — onboarding pick, hidden inputs, manual fields
- `src/styles/global.css:256-258` — red filter on images
- `src/layouts/Layout.astro:70` — `#red-only` SVG filter
- `scripts/build-sw.mjs:47-54` — precache glob
- `src/sw.ts:527-610` — same-origin routes, `precacheAndRoute`
- `src/lib/gear/catalogue/load.ts:12,22` — lazy `import()` precedent
- `eslint.config.js:83-113` — coordinate no-console globs
- `src/i18n/messages/en.ts:291-311`, `pl.ts:275-296` — `location` strings
- `tests/e2e/site-location.spec.ts:19-67`, `tests/e2e/helpers.ts:55-59` — e2e patterns

## Architecture Insights

- Privacy-by-click is the established pattern: no location-revealing request before an explicit user action (S-08 geolocation, now S-09 tiles).
- Leaf modules round before values leave them; schemas round again — a map pick should round inside the map module before `onPick`.
- Third-party credit lives next to the feature using it (Tonight `Attribution.astro`, onboarding footer); the map's own attribution control can serve that role on both hosts.
- Lazy chunks are still precached by the SW unless excluded — "lazy" is not "not downloaded" in this app.

## Historical Context (from prior changes)

- `context/archive/2026-10-03-site-use-my-location/plan.md:35` — "No map ('Pick from map' is S-09) and no new third-party request" (supported: S-08 added none).
- `context/archive/2026-10-03-site-use-my-location/plan-brief.md:21` — one shared `LocationPicker` "gives S-09 a single component to extend" (supported by current code).
- `context/archive/2026-10-03-site-use-my-location/plan.md:81` — `onPick` contract with rounded values (supported; union must widen).
- `context/foundation/roadmap.md:250` — privacy unknown settled 2026-10-07: tiles only after the user chooses "Pick from map".
- `context/foundation/shape-notes.md:23` — "map pin cut" from the MVP (historical; superseded by M-2 S-09).

## Related Research

- `context/archive/2026-10-03-site-use-my-location/research.md`

## Open Questions

1. **Provider** (team, settle in plan): OSM standard tiles (no key, no dark style) vs a keyed dark basemap (CARTO/Stadia, non-commercial terms, secret-free domain auth or public key).
2. **Dark/light/red look of tiles** (user, UI): CSS filter on the tile pane vs a provider dark style; red mode already filtered via `img`.
3. **PRD amendment** (user): record the consent-gated tile exception in prd.md:377-379, or let the roadmap entry stand.
4. **Precache** (team): add `globIgnores` for the map chunk/CSS so non-map users don't download it.
5. **Keyboard access** (team): Leaflet marker drag is pointer-only; a crosshair-at-centre model ("pan the map, the centre is the pick") or the existing manual fields can cover keyboard users.
6. Unverified: MapLibre v6 gz size, Stadia attribution text, CARTO/OpenFreeMap cookie/IP logging.
