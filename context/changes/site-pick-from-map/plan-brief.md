# "Pick from map" (S-09) — Plan Brief

> Full plan: `context/changes/site-pick-from-map/plan.md`
> Research: `context/changes/site-pick-from-map/research.md`
> Plan review: `context/changes/site-pick-from-map/reviews/plan-review.md` (NEEDS ATTENTION → all 10 findings applied 2026-10-07)

## What & Why

Users adding or editing a site, including onboarding's home-site step, can choose "Pick from map", pan and zoom, and tap or drag a pin. The point is rounded to about 1 km. This is the last open slice of M-2 (S-09, GitHub #73).

On 2026-10-07 the user decided that map tiles may be requested only after explicit consent. Choosing "Pick from map" is that consent, just as "Use my location" asks only after its click.

## Starting Point

S-08's shared `LocationPicker` already offers "Use my location" and place search. It reports rounded picks to the host form, which owns the coordinate fields. Nothing in the app checks geolocation permission without prompting. The service worker precaches every built JS and CSS file, so a "lazy" chunk would still be downloaded by everyone.

## Desired End State

A third picker option opens an inline map panel. Before the click, no map code and no tiles load. Picks fill the form with 2-decimal coordinates, and the edit form's Undo still works. The map follows the light, dark and red themes, carries the OpenStreetMap credit, and is disabled offline. Its code is excluded from the precache, and the build proves it.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Consent | The "Pick from map" click is the consent; nothing loads before it | Matches "Use my location" | User (roadmap 2026-10-07) |
| Library | Leaflet 1.9.4, pinned | About 42 KB gz, no WebGL, tiles are `<img>`; 2.0 is still alpha | Research → Plan (delegated) |
| Tiles | OSM standard tiles, no key | Free, policy allows normal interactive use with a visible credit | Research → Plan (delegated) |
| Theme look | Light: normal tiles. Dark: inverted and dimmed. Red: dark plus red-only filter on the tile pane | Keeps dark adaptation without a keyed dark provider | User |
| Layout | Inline panel about 20rem tall in the picker, with "Close map" | Stays in the form flow; summary and fields visible | User |
| Interaction | Tap to drop the pin, drag to adjust; each drop updates the fields | The roadmap outcome, direct and fast | User |
| Starting view | Host's current coordinates (zoom 11, pinned), else a neutral Europe view at once, which recentres on the device if geolocation was already granted and a position arrives within 3 s | Roadmap: device location only if already allowed; never stall the panel | Roadmap → Plan, review F8 |
| Keyboard | Arrow-key panning plus "Place pin at map centre" | Leaflet's pin drag is pointer-only | Plan (delegated) |
| Bundle | Lazy `map-panel` chunk. Leaflet CSS is loaded by `?url` + `<link>` (a plain import could merge into the one site-wide CSS). `globIgnores`, plus `build-sw.mjs` guards that read the written `sw.js` and the CSS files | Users who don't open the map download nothing | Research → Plan, review F1/F2 |
| Red-mode tiles | One SVG `feColorMatrix` filter `#red-night-map` on `.leaflet-tile-pane`; tile `img` filter set to `none` | A mixed `invert()…url()` chain is untested in WebKit, and child filters run before the parent's (cyan risk) | Review F9 |
| Leaflet chrome | Unlayered `[data-theme]`-prefixed overrides in global.css for every visible Leaflet default; divIcon pin with its own `className` | leaflet.css loads last and beats Tailwind layers | Review F3 |
| Map lifecycle | One map per open panel (`[]` effect), `onPick` via `useEffectEvent` (React 19.3), pin follows typed coordinates, Undo closes the panel | No rebuild per pick; the pin always matches the fields | Review F5 |
| PRD | Amend the guardrail and NFR honestly: tiles reveal the viewed area, which may start at the site or device; only after the click; cite roadmap S-09 / #73; add `updated:` | The PRD should match what ships, without overstating the privacy | Plan, review F7 |
| Name field | A map pick never fills the site name (no reverse geocoding) | No extra third-party call | Plan (delegated) |

## Scope

**In scope:**

- The map option in `LocationPicker`, with `{kind:"map"}` handled by `SiteForm` and `OnboardingWizard`
- Pure helpers (starting view, map-pick rounding, the permission check) with unit tests
- The precache exclusion and build assertion
- Theme CSS, EN and PL strings, and the PRD amendment
- One e2e spec, screenshot evidence, and a CLAUDE.md paragraph

**Out of scope:**

- Other providers or keys, a vector map, offline tiles or tile caching
- A CSP, reverse geocoding, keyboard pin drag
- Maps anywhere else in the app

## Architecture / Approach

`LocationPicker` gets a "Pick from map" button. Clicking it does two things in parallel:

- it starts the memoised `import("./map-panel")`;
- it renders at once at `initialMapView(current)` (the host's coordinates, else the neutral view). If there is no `current` and `geolocationAlreadyGranted()` is true, it asks `locateDevice` and recentres if a position arrives within 3 s.

`map-panel.tsx` owns Leaflet and its CSS (`?url` + `<link>`): one map per open panel, the OSM tile layer, the divIcon pin, and click or drag through `pickFromMap` (wrap, clamp, `roundCoordinate`). It then calls `onPick({ source: {kind:"map"} })`, and the host fills its fields. `global.css` filters only `.leaflet-tile-pane` per theme (red uses `#red-night-map` from `Layout.astro`) and overrides the Leaflet chrome with `[data-theme]`-prefixed token rules. `build-sw.mjs` keeps map assets out of the precache and out of shared CSS.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Map foundation | Dependency, helpers and tests, precache manifest guard, strings, PRD amendment | npm mirror may lack leaflet (use the public registry) |
| 2. The map in the picker | E2E baseline, panel, picker and four host branch points, theme filters and chrome, chunk and CSS guard | Leaflet CSS cascade; Leaflet must stay out of SSR, shared CSS and the precache |
| 3. Verification and docs | `site-map.spec.ts` (Madrid site, no tile or chunk request before the click), screenshots in every theme and locale plus WebKit red, channel check, CLAUDE.md | The e2e environment needs local Supabase, the fixture and the preview (recipe in plan) |

**Prerequisites:** S-08 shipped (done); the user's privacy decision (done 2026-10-07).
**Estimated effort:** about 1–2 sessions across 3 phases.

## Open Risks & Assumptions

- The OSM tile service has no SLA and may throttle heavy use. At hobby volume this is fine, and switching provider is a one-file change.
- The inverted dark tiles may look a bit "negative". The filter values get tuned against real-tile screenshots in phase 3.
- The permissions API returns "granted" only in browsers that support it. Others get the neutral view, which is acceptable.
- The red-mode SVG filter renders in software, so panning may stutter on phones. That is accepted and noted in the evidence.
- Leaflet's default colours are invisible to the colour guard tests (they live in `node_modules`). Only the phase 3 screenshots verify the overrides.

## Success Criteria (Summary)

- No request to OpenStreetMap and no map code before the click, proven by e2e and the build assertion
- A tap, drag or centre pin saves a site with coordinates rounded to about 1 km, on the site form and onboarding
- The map is legible and on-theme in dark, light and red, in EN and PL, at phone width
