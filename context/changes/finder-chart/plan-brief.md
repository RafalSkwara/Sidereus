# Finder chart (M-3 S-03) — Plan Brief

> Full plan: `context/changes/finder-chart/plan.md`
> Research: `context/changes/finder-chart/research.md`

## What & Why

A beginner can see a ranked target's name and direction but not how to land the telescope on it. The finder chart takes them from a star they can recognise with the naked eye to the target, hop by hop, with their finder's and eyepiece's fields to scale (FR-037, US-05). It is the milestone's north star and the first full-plan feature, so it also brings the first "needs the full plan" state and the first HTTP proof that the server enforces the plan (FR-045, test-plan §6.4).

## Starting Point

Tonight ranks deep-sky objects and planets with a best time, but nothing draws a chart: the live sky is a 180° panorama, the bundled stars stop at magnitude 4.5, and `TonightView` carries no positions or true fields. `requireFullPlan(locals)` exists from F-01 but nothing calls it yet; `/tonight/*` is already gated for signed-out visitors.

## Desired End State

A full-plan user taps "Finder chart" on any ranked object or planet and gets, at 360 px and in red mode: where to face, an overview from the starting star to the target, a finder-field panel with the finder circle, reflex rings and their finding eyepiece's circle, and numbered steps. A free account gets the same link and a page that shows an example and says the chart needs the full plan. A chart opened online is stored on the device and opens offline; it disappears at the first online refresh after the plan is lost. Smoke proves over HTTP that a free account is refused by the page and by the island itself.

## Key Decisions Made

Run unattended (owner away): "Delegated" = team-owned, decided here. Owner answers of 2026-10-13: "Owner" = confirmed or decided by the owner.

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the chart is drawn | Server-rendered static SVG in a server island | No star data in the browser, no precache or guard change; Session plan precedent | Plan (delegated) |
| Star depth (OQ14) | HYG v4.1, same pin, to mag 7.5; server-only, lazy-loaded | HYG is evenly complete to ~7.5; 25,791 stars, 122 KB gzip | Research (delegated) |
| Starting-star limit (OQ15) | 4.5 / 3.5 / 2.5 at Bortle 1-4 / 5-6 / 7-9, never above the naked-eye limit | A star a beginner recognises, 1.5-2.5 mag above the limit | Research (delegated) |
| Hop rule (OQ16) | Steps ≤ 0.8 × finder field (5.6°) through stars ≤ 6.5 above min altitude, ≤ 8 steps; additive lexicographic cost (steps, Σ mag, Σ length, indices), exact layered search | Mirrors `FOV_FIT_FRACTION`; exact and deterministic (review F4) | Research + review (delegated) |
| Projection | Gnomonic, horizontal coordinates at best time, "up" = vertical through each panel's centre | "As the user faces that part of the sky" | Plan (delegated) |
| Near the zenith | Panel centre ≥ 80° or zenith inside a panel → whole chart north up, zenith marker, "Nearly overhead" | Zenith-up is meaningless overhead; common for M31 at 40° N (review F1) | Owner (O-2, confirmed) |
| HTTP refusal check | Smoke: free shell locked, full shell + island show a real chart, island replay locked after demotion and signed out; plan granted by the operator command | Proves both layers of the check over HTTP; smoke stays dependency-free | Plan + review F2 (delegated) |
| Secret key in CI | Local stack's key inline on the smoke and e2e commands only, never exported; PR description calls it out | Relaxes a CLAUDE.md rule for the local stack only (review F7) | Review (delegated, owner sees it in the PR) |
| Failures | Star-load or chart failure logged (fixed line + `error.name`) and shown as a `failed` state | No silent 200s (review F3) | Review (delegated) |
| Calibration | Published classic hops (M31, M13, M57, M81, M27, M92), each at a fixed Bortle band, + coverage over 171 objects with a gate measured on the first run | No observer yet (roadmap OQ1); no armchair threshold (review F5) | Plan + review (delegated) |
| Finder (OQ13) | 6×30, 7° for every telescope + 0.5/2/4° reflex rings | PRD candidate; vendors list 7-8° | Owner (O-1, confirmed) |
| Orientation | Naked-eye view facing the target (up = local vertical), one note on inverted finders; no flip control; overhead rule above | Matches published Telrad charts; keeps the chart static | Owner (O-2, confirmed) |
| Layout | Two panels: overview + finder field, stacked on a phone | Long Bortle 7-9 hops (up to ~26°) shrink the target area | Owner (O-3, confirmed) |
| Offline | Charts opened online stored as pairs keyed by site + target; no next-night copy; 36 h expiry; dropped when any Tonight or finder answer says the plan is free | Owner's rule (settles OQ23 for this slice); worker-side and deterministic | Owner (O-4, changed) + delegated mechanics (D-13 to D-15) |
| Free account | Same link everywhere; explainer with a precomputed example chart (no star read per view) | FR-045: show what it does, never an error (review F6) | Owner (O-5, confirmed) |
| Departures from FR-037 wording | Start among the 5 nearest if the nearest has no hop; `direct` line; bright planet as its own start; message when no star qualifies | All keep the PRD invariant; wording differs (review F8) | Owner (O-7, confirmed) |
| Star source / licence | Stay on HYG v4.1 for both star files; the owner asks ESA for a commercial licence (draft `esa-licence-request.md`); if ESA refuses, SAO only before any payment (NASA NTRS marks the SAO reports and documentation "public use permitted"; no formal licence for the I/131A file; confirm before switching) | No source complete to 7.5 is clearly licensed for commercial use; ESA names a request route; BSC5 forbids altered copies (research §9) | Owner (O-6, option A) |

## Scope

**In scope:** finder star file and loader; engine start/hop/projection with invariant tests; chart components and `/design` specimens; `/tonight/finder` page with the two-layer plan check and free explainer; "Finder chart" links on object and planet rows; offline storage of opened charts with the plan-loss drop; smoke and CI changes; two e2e specs (chart, offline); docs (CLAUDE.md, test-plan §6.4, PRD OQ21 and OQ23, roadmap).

**Out of scope:** choosing a finder per telescope, interactive or atlas views, the Moon, washed-out rows, prefetching or next-night copies of charts, the what-to-expect line (S-04), payments or upsell, a HYG v4.2 upgrade. A star-source switch (the SAO fallback is its own change, only if ESA refuses).

## Architecture / Approach

`/tonight/finder?object=M31&from=targets` (gated) → shell: `requireFullPlan` → free: `FinderLocked` | full: `FinderContent` server island → `loadFinderFor`: `requireFullPlan` again, `loadTonightFor(limit: Infinity)`, find the entry, finding eyepiece, `loadFinderStars()` (dynamic import of `finder-stars.json`), engine `finderChart(...)` (pure: start, hop, two projected panels) → `chart-svg.ts` → `FinderChart.astro` (two SVG panels, steps, notes, token colours). Offline: the chart island's `[data-offline-copy]` (with `data-target`, `data-plan`) → the worker stores the pair (`copies.ts` keying by site + target) → served from the device offline; a `free` island or a locked finder answer → `dropFinderCopies`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Finder star data | `finder-stars.json` from the pinned HYG, loader, tests, licence + ESA credit | Bundle growth; designation formatting |
| 2. Engine | Start choice, hop search, gnomonic projection, invariants, reference hops | Hops that look unlike what an observer would choose |
| 3. Chart rendering and the free explainer | Two legible SVG panels, chart tokens, steps, i18n, `FinderLocked` with a precomputed example, `/design` specimens | Phone legibility in red mode |
| 4. Page behind the full plan | Route, two-layer plan check, free explainer, row links | Island left unguarded; link crowding at 320 px |
| 5. Offline finder charts | Pairs keyed by site + target, `/offline` list, plan-loss drop on an explicit `free` (`freeSince` guard), three-valued plan read, offline e2e | A stale `full` render after a demotion (guarded by `freeSince`); old indexes |
| 6. HTTP refusal, e2e, docs | Smoke finder steps (incl. demoted and signed-out replays), inline CI key, e2e at 360 px, docs | Island URL replay depends on Astro's GET form |

**Prerequisites:** F-01 and S-02 done (they are); local Supabase for smoke and e2e; the operator command for granting plans.
**Estimated effort:** ~5-6 sessions across 6 phases (Phase 2 is the largest).

## Open Risks & Assumptions

- Hops are judged without an observer; the reference fixture and the owner's manual comparison are the only checks.
- Bortle 7-9 starts can be ~26° away: long hops; `direct` is the fallback when no path exists.
- Shared local Supabase: another branch adds `observing_milestones`; no `db:types` before it merges, and a `tests/db/structure.test.ts` failure only on that table is expected locally.
- Plan review (`reviews/plan-review.md`) applied 2026-10-11: F1-F7, F9, F10 in the plan; F8 became O-7, confirmed by the owner 2026-10-13. Owner decisions all resolved 2026-10-13; re-review 2026-10-13 (F11-F15) applied the same day.
- Offline (review F12, accepted): on a network slower than 4 s, a demoted user opening a stored chart's URL is first served the stored chart; the late locked answer drops it. A failed plan read neither drops nor stores charts (F11).
- Star licence: HYG v4.1 rests on Hipparcos (ESA CC BY-NC); `LICENSE-DATA.md` will say so (F13); the owner's ESA request is pending, and a refusal means switching to SAO only before any payment (SAO lacks Bayer/Flamsteed designations).
- Server-island replay in smoke assumes small props (GET); the step fails loudly if Astro switches to POST.
- The chart's star positions reveal the site roughly, like the live sky; accepted, never in URLs or logs.

## Success Criteria (Summary)

- A full-plan user goes from a ranked object to a star they can see and hops to the target with no planetarium app.
- A free account sees what the chart does and that it needs the full plan; smoke proves the page and the island both refuse it.
- The same inputs always give the same chart, never from a star below the minimum altitude or too faint for the naked eye there.
