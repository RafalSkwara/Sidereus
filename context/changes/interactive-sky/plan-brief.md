# Interactive Tonight Sky — Plan Brief

> Full plan: `context/changes/interactive-sky/plan.md`

## What & Why

The `/tonight` dashboard's sky band becomes a working view of the real sky. A slider from sunset to sunrise moves the bright stars, the night's top five targets, the planets and the Moon to their true positions, and the sky colour follows the Sun. This is the S-11 follow-up the user asked for on 2026-10-04: the sky should show where to look, not just set the mood.

## Starting Point

`TonightSky.astro` is a static, server-rendered band: a fixed token gradient, 80 seeded decorative stars, and the verdict in its slot. The engine already computes 10-minute alt/az tracks for every target, planet and the Moon, but `buildTonight` keeps only each one's peak. `MoonTimeSlider` already shows how to send precomputed frames to a browser island that never imports the engine.

## Desired End State

On `/tonight`, the verdict is unchanged at the top of the sky. Under it is a horizon panorama, about 200 px tall, centred on south and swipeable through 360°. It holds:

- real stars down to magnitude 4.5, with up to 15 of the brightest named stars above the horizon labelled in EN/PL;
- labelled markers for the top five targets, the planets (even on cloudy nights) and the Moon.

Below the horizon silhouette, a slider runs from sunset to sunrise in 10-minute steps, with the dark window marked on the track and a Now button. Dragging it wheels the sky and fades the band through twilight. Tapping a marker opens its Targets row, the Planets page or the Moon page.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Background stars | Real, HYG v4.1 to mag 4.5 (925), CC BY-SA 4.0, credited in the attribution footer | The sky doubles as a finder chart; same licence path as the Messier data | User |
| Projection | Horizon panorama, 180° view centred on S (N in the south), swipe for 360° | Keeps the band shape and silhouette; reads like looking out | User |
| Bodies shown | Top 5 ranked + planets + Moon | Top 5 = the Targets page's visible rows | User |
| Tap | Opens the focused page (`#object-<id>`, `#planet-<key>`, `/tonight/moon`) | The dashboard rule: tiles open pages, never anchors | User |
| Slider range | Sunset → sunrise, dark window marked; starts at Now, else the dark start | Inside the dark window the colour can't change | User |
| Star names | At most 15 of the brightest named stars that are above the horizon (40 names kept in the file), localised, yielding to target labels | Anchors for star-hopping without clutter; 5 of the 15 brightest overall never rise at 52°N | User (count rule from the plan review) |
| Layout | Verdict above, panorama below, slider on the ground | No text/label collisions; the verdict stays first | User |
| Data path | Dashboard only (`withSkyView`): a columnar `skyView` (start and step, flat rotations, Sun altitudes, tracks as int tenths of a degree); browser rotates the star vectors | No engine in the browser; under 30 KB instead of ~54 KB; focused pages pay nothing | Plan (delegated, plan review F2) |
| Sky colour | New hex `--dusk-*` tokens per theme, `color-mix` by Sun altitude; top stop stays `--zenith` | Token-only colours, red stays pure, no seam; `sky` names trip the colour guard | Plan (delegated, review F5) |
| Band ownership | In live mode the island renders the whole band (gradient, verdict as children, panorama, silhouette, slider); `sky-band.ts` shares the silhouette with the static sky | A child can't repaint its parent's gradient, and the slider sits below the silhouette | Plan (review F1) |
| Coordinate exposure | Rotation matrices (4 decimals, about 600 m) reach the browser; no URLs or logs | First client island to carry the site implicitly; recorded, not hidden | Plan (review F8) |
| Star refraction | None for stars; targets keep the engine's refracted tracks | ≤ 0.5°, under 2 px on the strip | Plan (delegated) |
| No-go nights | Stars, every planet (from the engine, not `solarSystem`) and the Moon still shown; no Messier markers | The ranking is `null` then; a planet links to its row only when the Planets page lists it | Plan (delegated, review F9) |
| Light theme | Stars stay hidden through the CSS rule `hidden dark:block`; bodies shown | Keeps the Nightfall rule and survives an in-page theme switch | Plan (delegated, review F6) |

## Scope

**In scope:**

- The star catalogue generator and its loader, with PL names and the licence.
- Engine `skyFrames` and `TonightView.skyView`.
- The pure `src/lib/sky-view/` maths, the `TonightSkyView` island (owning the live band), the dusk tokens and the dashboard layout with the skeleton.
- Row anchors, one e2e spec, and the docs.

**Out of scope:**

- An interactive sky on the focused pages or the setup states.
- Constellation lines.
- Fainter stars or the targets beyond the top 5.
- A dome or 360° squeeze view, and zoom.
- Popovers on tap.
- A no-JS path.
- Changes to the Moon slider or the ranking.

## Architecture / Approach

`buildTonight` samples sunset to sunrise with the engine's track functions and a new `skyFrames`. All of them run over one interval and one step, so frame `i` is the same instant everywhere. It formats the time labels in the site's zone and ships a columnar `skyView` to `TonightContent` (the dashboard only). There, the `client:load` React island `TonightSkyView` imports only `@/lib/sky-view/*`, the star file and i18n. It owns the whole live band, with the verdict passed in as children. It multiplies each star vector by the frame's matrix (transposed, as astronomy-engine's `RotateVector` does), projects everything onto the panorama, places the labels, and sets `color-mix` percentages from the Sun's altitude.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bright-star catalogue | `npm run stars:build`, `bright-stars.json`/meta, loader, PL names, licence, UI credit, tripwire | A 34 MB source must stream; 6 stars lack `hip` (key by HYG id) |
| 2. Engine frames + view data | `skyFrames`, gated columnar `skyView`, tests | Frame/track alignment; the transposed rotation layout |
| 3. Panorama island + dusk tokens | The island owning the live band, slider, dusk colours | Label clutter at 390 px; AA on dusk colours |
| 4. Links, a11y, e2e, docs | Row anchors and the Planets hash scroll, keyboard/SR names, spec, docs | Real-clock e2e with bodies that may be down |

**Prerequisites:** branch `feat/interactive-sky` (from `main`); PR #96 (tonight-dashboard archive + handoff) is ideally merged first; local Supabase + forecast fixture for previews.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- 15 star labels plus up to 13 body labels may still crowd a 390 px strip; `placeLabels` drops star labels first, and the count is one constant.
- The `--dusk-*` tokens must hold AA for muted labels in both dark and light; if light can't reach it, the light theme's mix stops are kept paler.
- HYG `proper` names are IAU forms; the Polish map is hand-written and small.
- The island's chunk budget (60 KB gz) assumes the star file stays near 925 entries.
- The plan review (NEEDS ATTENTION, 10 findings) is fully applied; see `reviews/plan-review.md`.

## Success Criteria (Summary)

- Dragging the slider on a phone moves the real stars, the targets, the planets and the Moon, and the sky dims from sunset into night. Two frames match Stellarium.
- Every marker is tappable and keyboard-reachable, and opens the right page or row.
- No engine code in the browser, colours only from tokens (red stays pure), EN/PL parity, all tests green.
