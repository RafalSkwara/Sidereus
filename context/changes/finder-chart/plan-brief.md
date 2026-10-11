# Finder chart (M-3 S-03) — Plan Brief

> Full plan: `context/changes/finder-chart/plan.md`
> Research: `context/changes/finder-chart/research.md`

## What & Why

A beginner can see a ranked target's name and direction but not how to land the telescope on it. The finder chart takes them from a star they can recognise with the naked eye to the target, hop by hop, with their finder's and eyepiece's fields to scale (FR-037, US-05). It is the milestone's north star and the first full-plan feature, so it also brings the first "needs the full plan" state and the first HTTP proof that the server enforces the plan (FR-045, test-plan §6.4).

## Starting Point

Tonight ranks deep-sky objects and planets with a best time, but nothing draws a chart: the live sky is a 180° panorama, the bundled stars stop at magnitude 4.5, and `TonightView` carries no positions or true fields. `requireFullPlan(locals)` exists from F-01 but nothing calls it yet; `/tonight/*` is already gated for signed-out visitors.

## Desired End State

A full-plan user taps "Finder chart" on any ranked object or planet and gets, at 360 px and in red mode: where to face, an overview from the starting star to the target, a finder-field panel with the finder circle, reflex rings and their finding eyepiece's circle, and numbered steps. A free account gets the same link and a page that shows an example and says the chart needs the full plan. Smoke proves over HTTP that a free account is refused by the page and by the island itself.

## Key Decisions Made

Run unattended (owner away): "Delegated" = team-owned, decided here; "Pending owner" = planned on the recommended default until the owner confirms.

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the chart is drawn | Server-rendered static SVG in a server island | No star data in the browser, no precache or guard change; Session plan precedent | Plan (delegated) |
| Star depth (OQ14) | HYG v4.1, same pin, to mag 7.5; server-only, lazy-loaded | HYG is evenly complete to ~7.5; 25,791 stars, 122 KB gzip | Research (delegated) |
| Starting-star limit (OQ15) | 4.5 / 3.5 / 2.5 at Bortle 1-4 / 5-6 / 7-9, never above the naked-eye limit | A star a beginner recognises, 1.5-2.5 mag above the limit | Research (delegated) |
| Hop rule (OQ16) | Steps ≤ 0.8 × finder field (5.6°) through stars ≤ 6.5 above min altitude, ≤ 8 steps, fewest then brightest | Mirrors `FOV_FIT_FRACTION`; ~8 such stars per finder field | Research (delegated) |
| Projection | Gnomonic, horizontal coordinates at best time, zenith up | "As the user faces that part of the sky" | Plan (delegated) |
| HTTP refusal check | Smoke: free shell locked, full shell + island allowed, island replay locked after demotion; plan granted by the operator command | Proves both layers of the check over HTTP; smoke stays dependency-free | Plan (delegated) |
| Calibration | Published classic hops (M31, M13, M57, M81, M27, M92) as reference fixture + coverage over 171 objects | No observer yet (roadmap OQ1) | Plan (delegated) |
| Finder (OQ13) | 6×30, 7° for every telescope + 0.5/2/4° reflex rings | PRD candidate; vendors list 7-8° | Pending owner |
| Orientation | Naked-eye view, zenith up, one note on inverted finders; no flip control | Matches published Telrad charts; keeps the chart static | Pending owner |
| Layout | Two panels: overview + finder field, stacked on a phone | Long Bortle 7-9 hops (up to ~26°) shrink the target area | Pending owner |
| Offline | Finder pages online-only; link disabled offline | Per-object copies need new SW keys and trigger OQ23 | Pending owner |
| Free account | Same link everywhere; explainer with a fixed example chart | FR-045: show what it does, never an error | Pending owner |
| Licence | Record Hipparcos CC BY-NC (ESA) in PRD OQ21; credit ESA now | No money in M-3; affects the bright stars too | Pending owner |

## Scope

**In scope:** finder star file and loader; engine start/hop/projection with invariant tests; chart components and `/design` specimens; `/tonight/finder` page with the two-layer plan check and free explainer; "Finder chart" links on object and planet rows; smoke and CI changes; one e2e spec; docs (CLAUDE.md, test-plan §6.4, PRD OQ21, roadmap).

**Out of scope:** choosing a finder per telescope, interactive or atlas views, the Moon, washed-out rows, offline finder copies, the what-to-expect line (S-04), changes to the live sky or bright stars, payments or upsell, a HYG v4.2 upgrade.

## Architecture / Approach

`/tonight/finder?object=M31&from=targets` (gated) → shell: `requireFullPlan` → free: `FinderLocked` | full: `FinderContent` server island → `loadFinderFor`: `requireFullPlan` again, `loadTonightFor(limit: Infinity)`, find the entry, finding eyepiece, `loadFinderStars()` (dynamic import of `finder-stars.json`), engine `finderChart(...)` (pure: start, hop, two projected panels) → `chart-svg.ts` → `FinderChart.astro` (two SVG panels, steps, notes, token colours).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Finder star data | `finder-stars.json` from the pinned HYG, loader, tests, licence + ESA credit | Bundle growth; designation formatting |
| 2. Engine | Start choice, hop search, gnomonic projection, invariants, reference hops | Hops that look unlike what an observer would choose |
| 3. Chart rendering | Two legible SVG panels, steps, i18n, `/design` specimens | Phone legibility in red mode |
| 4. Page behind the full plan | Route, two-layer plan check, free explainer, row links | Island left unguarded; link crowding at 320 px |
| 5. HTTP refusal, e2e, docs | Smoke finder steps, CI secret wiring, e2e at 360 px, docs | Island URL replay depends on Astro's GET form |

**Prerequisites:** F-01 and S-02 done (they are); local Supabase for smoke and e2e; the operator command for granting plans.
**Estimated effort:** ~4-5 sessions across 5 phases (Phase 2 is the largest).

## Open Risks & Assumptions

- Hops are judged without an observer; the reference fixture and the owner's manual comparison are the only checks.
- Bortle 7-9 starts can be ~26° away: long hops; `direct` is the fallback when no path exists.
- Hipparcos is non-commercial: fine for M-3 (no money), must be settled before charging.
- Server-island replay in smoke assumes small props (GET); the step fails loudly if Astro switches to POST.
- The chart's star positions reveal the site roughly, like the live sky; accepted, never in URLs or logs.

## Success Criteria (Summary)

- A full-plan user goes from a ranked object to a star they can see and hops to the target with no planetarium app.
- A free account sees what the chart does and that it needs the full plan; smoke proves the page and the island both refuse it.
- The same inputs always give the same chart, never from a star below the minimum altitude or too faint for the naked eye there.
