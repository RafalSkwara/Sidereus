# Session plan timeline — Plan Brief

> Full plan: `context/changes/session-plan-timeline/plan.md`

## What & Why

Roadmap S-05 (MS-05, #69): a beginner should be able to read tonight as a plan to follow. A read-only `/tonight/plan` page, reached from a new dashboard tile, lays the night out on one time axis, with each recommended target placed at its best window and ordered by when it is best.

## Starting Point

`/tonight` is a dashboard of tiles that open focused pages (S-11). `buildTonight` already computes every target's window and best time, the dark window and the Moon's up spans, but it exposes windows only as `HH:mm` strings, and it measures the Moon only over the Moon card's window.

## Desired End State

The new page shows a sunset-to-sunrise axis with hourly ticks, the dark window shaded and moonrise and moonset marked. Below it, one linked row per target shows a window bar and a best-time dot, and the rows are ordered by best time. A "Session plan" tile on the dashboard previews this with a mini axis and a "First up" line. It works at 390 px in dark, light and red mode, in EN and PL.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Targets on the timeline | Top-5 deep-sky + planets + the Moon when a target | Matches what Tonight recommends; planets fill twilight before deep sky starts (user). |
| Layout | Rows on one shared time axis, names above bars at 390 px | Shows overlaps and gaps at a glance (user). |
| Order | By best time (`bestAt`), ties: Moon, planets, deep-sky by rank | "Ordered by when each target is best" (user, over window start). |
| Entry point | New dashboard tile with a mini axis, after "Point here first" | Consistent with the other tiles (user). |
| Editable? | Read-only | Roadmap candidate; adjusting is a later change (delegated). |
| Overlaps | Side by side, no sequencing | Roadmap candidate (delegated). |
| Axis | Sunset→sunrise, else the observing night (the live sky's rule) | The timeline and the sky slider span the same night (delegated). |
| Data shape | `withSessionPlan` option → `TonightView.sessionPlan \| null` with axis fractions + server-formatted labels | Same failure-tolerant pattern as `skyView`; no browser formatting (delegated). |

## Scope

**In scope:** pure layout helper + tests, the `sessionPlan` view field, the `/tonight/plan` page and `SessionTimeline` component (full and mini), the dashboard tile and its skeleton row, EN/PL copy, one e2e addition, docs, and the landing screenshot recapture.

**Out of scope:** editing the plan, sequencing overlaps, objects beyond the top 5, offline (S-06), a no-JS fallback, engine or database changes.

## Architecture / Approach

`buildTonight` collects raw intervals for the rows while it builds the ranking, the planets and the Moon target. It computes the axis and the Moon's rise and set over that axis, and passes everything to `layoutSessionPlan` (pure, returns fractions on the axis). It then adds labels formatted in the site's time zone. `SessionTimeline.astro` only draws: percentages from the fractions, tokens only, marks told apart by shape as well as colour, and bars `aria-hidden` with text in each link's accessible name.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Session-plan data | `sessionPlan` on the view + layout tests | Moon crossings at the axis edges |
| 2. `/tonight/plan` page | Page, island, timeline, copy | Phone legibility in red mode |
| 3. Dashboard tile + verification | Tile with mini axis, e2e, docs, screenshots | Dashboard height and skeleton jump |

**Prerequisites:** S-11 done (it is); local Supabase + forecast fixture for e2e and screenshots.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- The dark-window shading or the Moon span may need a new colour token (it would need a value in every theme, with zero green and blue in red mode).
- On a busy clear night with all planets up there could be about 12 rows, which makes a long phone page. This is accepted, since the rows are the plan.

## Success Criteria (Summary)

- From the dashboard, a user opens the session plan and sees the night's targets in the order to observe them, with the dark window and the Moon's rise and set.
- Every row opens that target's detail.
- The page and the tile read well on a phone in red night mode, in both languages.
