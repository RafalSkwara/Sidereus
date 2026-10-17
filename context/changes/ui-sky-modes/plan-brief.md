# Tonight's live sky: drag to pan and Hidden / Default / Expanded modes — Plan Brief

> Full plan: `context/changes/ui-sky-modes/plan.md`
> Research: `context/changes/ui-sky-modes/research.md`

## What & Why

The owner asked (2026-10-17) for two things on the dashboard's live sky (`TonightSkyView`): a mouse can drag the panorama sideways, and the sky can be hidden, shown as today, or expanded to the screen, remembered on the device. Stars and planets must stay in their true places at every size, so the sky is recomputed for its new size, never stretched.

## Starting Point

The sky is drawn at one fixed size (a 272 px field, 180° per screen width) from constants; only touch and touchpad can pan it; the theme cookie already shows how a device preference is server-rendered and corrected before paint for offline copies. The phone's first screen has 33 px to spare, so nothing may be added above the gear cards.

## Desired End State

A desktop user drags the sky with the mouse; a drag never opens a marker, a click still does. A 44 px sky-view button at the top right of the verdict opens a menu: Hidden (verdict and dark window, no panorama), Default (today, unchanged) and Expanded (Topbar to TabBar on a phone, 80 % of a desktop screen, in true proportions). The choice lives in the `sidereus-sky` cookie, is server-rendered, and the skeleton keeps the chosen height.

## Key Decisions Made

| Decision                     | Choice                                                                     | Why (1 sentence)                                                                | Source               |
| ---------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------- |
| Where the mode lives         | `data-sky-mode` scope attribute + `sky-hidden:` / `sky-expanded:` variants | CSS sizes the band, skeleton and stored copies before hydration, like the theme | Research             |
| How the size reaches the sky | The island measures its strip and `skyField()` recomputes the projection   | Positions stay true at any size; no CSS scaling                                 | Research / owner     |
| DEFAULT                      | Pixel-for-pixel today's band                                               | Keeps `tonight-phone.spec.ts` and every prior decision on the default sky       | Research             |
| Drag                         | Mouse and pen only, 6 px threshold, click swallowed after a drag           | Touch already scrolls natively; plain clicks stay links                         | Plan                 |
| Shared control               | `ui/segmented.tsx` extracted from `TopbarControls`                         | One `aria-pressed` 44 px segmented control, no third copy                       | Research (charge C3) |
| Control placement            | ⭐ One button + menu, top right of the verdict (Q1 A)                      | Adds no height and fits 320 px Polish                                           | Owner question       |
| HIDDEN                       | ⭐ Verdict + silhouette, dark-window line visible (Q2 A)                   | Readable verdict without a second VerdictCard                                   | Owner question       |
| EXPANDED desktop height      | ⭐ 80 % of the screen under the Topbar (Q3 B)                              | Big sky, the cards still peek                                                   | Owner question       |
| EXPANDED field               | ⭐ True proportions, 60°–180° per screen (Q4 B)                            | Constellations look like the sky                                                | Owner question       |
| EXPANDED on a phone          | ⭐ Verdict, slider and TabBar stay (Q5 A)                                  | Nothing new to learn, nobody trapped                                            | Owner question       |
| Labels                       | ⭐ Hidden / Default / Expanded; Ukryte / Domyślne / Rozwinięte (Q6 A)      | The owner's own words                                                           | Owner question       |
| Roadmap                      | S-09 to S-12 added, S-03 dropped                                           | The owner's slices of 2026-10-17                                                | Owner                |

## Scope

**In scope:** drag to pan; the three modes on the dashboard's live sky; the cookie and pre-paint correction; tokens for the chrome heights; `SegmentedGroup`; `/design` states; one invariant test; four e2e tests; the CLAUDE.md rule; the roadmap slices.

**Out of scope:** modes on the focused pages or the landing; zoom, pinch, vertical pan, an atlas view; touch drag handling or momentum; storing the mode in the account; the VoiceOver pass; a mode control on the static fallback band.

## Architecture / Approach

`preferences.ts` → middleware `locals.skyMode` → `Layout` renders `<html data-sky-mode>` on `/tonight` only (inline script corrects it from the cookie) → variants in `global.css` size the island, `TonightSky` and `TonightSkeleton` from `sky-band.ts` classes → the island measures its strip (`ResizeObserver`) → `skyField(mode, box)` → `project()`. The control writes the scope attribute and the cookie, keeps the azimuth at the middle of the view.

## Phases at a Glance

| Phase                | What it delivers                                                        | Key risk                                                               |
| -------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1. Contract          | Cookie, scope, variants, tokens, `SegmentedGroup`, strings, `/design`   | The settings panel must not change when it moves to the shared control |
| 2. Field             | `skyField()`, measured projection, invariant test; DEFAULT identical    | A one-pixel drift in DEFAULT's geometry                                |
| 3. Drag to pan       | Pointer drag, click swallow, e2e                                        | Breaking plain marker clicks or touch scrolling                        |
| 4. Modes in the view | Control, HIDDEN, EXPANDED, skeleton, verdict line, e2e                  | The no-jump swap and the first-screen pin                              |
| 5. States and gate   | `/design` 7-state matrix, screenshots, CLAUDE.md rule, full e2e + smoke | A state never rendered before review                                   |

**Prerequisites:** none (branch `feat/ui-sky-modes` off main; local Supabase and the forecast fixture for e2e).
**Estimated effort:** about 4–5 sessions across 5 phases.

## Open Risks & Assumptions

- The owner's answers to Q1–Q6 may differ from the defaults; each names the one phase it changes.
- Q4 B changes interactive-sky's "180° per view" for EXPANDED only; A keeps it.
- The 33 px first-screen slack and the desktop field height are arithmetic from earlier measurements; Phases 2 and 4 re-measure.
- A failed sky view in HIDDEN or EXPANDED jumps once (the skeleton reserved that mode); accepted as a degraded path.

## Success Criteria (Summary)

- A mouse drag pans the sky and never opens a marker; touch, keys and chevrons work as before.
- Each mode is remembered, server-rendered and swaps in without a jump, with stars at their true altitudes.
- DEFAULT and the phone first screen are unchanged; `/design` shows every state in three themes.
