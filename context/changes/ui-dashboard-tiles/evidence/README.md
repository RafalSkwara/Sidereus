# ui-dashboard-tiles evidence

Captured on 2026-10-15 against a production build of main 42ce808 (before) and of the reverted experiment (`exp/`). Both were previewed on port 4331, with the forecast fixture (all clear) on 4401 and local Supabase. The `/design` shots come from `astro dev` on 4331, run while the preview was stopped.

The seeded user is a throwaway `ui-dash-<uuid>@example.com`: onboarded in Madrid with the default kit and six log entries, and granted the full plan through `npm run account:plan` with the local keys inline. No key is written anywhere.

## Folders

- `before/`: main 42ce808, as downscaled JPEGs.
  - `tonight-<viewport>-<locale>-<theme>-tiles.jpg`: the tiles block, dark / light / red × EN / PL × phone (390 px, 2x) / desktop (1280 px).
  - The full page and fold for a few combinations.
  - `c-verdict-event-<width>-<locale>-<theme>.jpg`: the `/design` "VerdictCard: the sky event line" section.
- `exp/`: the experiment, with the same names. `experiment.diff` is the reverted code: experiment code, not plan code. Its `Fact` takes an `eventKind` prop, where the plan widens `kind` instead; its specimens pass the kind by hand.
- `after/`: written by Phase 3.
- `scripts/`:
  - `seed.mjs`: copied from ui-fact-rhythm.
  - `dashboard.mjs`: captures the dashboard; `--measure` adds the first-screen boxes, the tile rows and the skeleton.
  - `design-section.mjs`: one `/design` section.

  All three refuse a non-local `BASE_URL`.

## Measurements (`dashboard.mjs --measure`, dark)

First screen at 390×844, in px (headline bottom / Site card bottom / Telescope title bottom / TabBar top): 149 / 701 / 746 / 779, before and after, in both EN and PL. At 320×700 the values are the same: 148 / 700 / 745 (the TabBar is at 635 there, so that viewport is a known limit and is not asserted).

Tile rows in px (targets, events, plan, moon, planets, nights), real against skeleton:

```
                 before real                 before skeleton            experiment real            experiment skeleton
EN 390   249 89 89 89 117 213        249 89 89 89 117 213       241 93 93 93 121 221       241 93 93 93 121 221
EN 1280  257 97 97 97 125 233        257 97 97 97 125 233       241 93 93 93 121 233       241 93 93 93 121 233
PL 390   277 89 89 89 117 213        (same skeleton)            269 93 93 93 121 221       (same skeleton)
```

Tiles block (EN): 390 px 846 → 862, 1280 px 906 → 874. PL 390 px: 874 → 890. PL 320 px: 958 → 974.

The verdict section (EN go, no event line): 390 px 117 → 117; 1280 px 132 → 144 (the forecast line at `mt-group`).

The page's skeleton/real difference (EN) is −35 px at 390 and −36 px at 1280, before and after. It comes from outside the tiles.

## What the experiment showed

- The tiles read as one family: each heading is 8 px over its content, and tiles are 40 px apart (`exp/tonight-phone-en-dark-tiles.jpg` against `before/`).
- The event line reads as its own fact with its icon (`exp/c-verdict-event-390-en-light.jpg`).
- The solar eclipse's lucide `Eclipse` icon reads as a clock beside "Tomorrow, 11:22", the third specimen. This is the reason for the plan's D4.

## Phase 1 (the contract and the tiles), 2026-10-15

Built from the Phase 1 tree, previewed on 4331 with the fixture on 4401, the `ui-dash` user (full plan). Shots in `after/` (the same names as `before/`; the verdict specimens follow in Phase 2).

```
                first screen at 390 (headline / Site / Telescope title / TabBar)   tiles real            tiles skeleton
EN 390 dark     149 / 701 / 746 / 779                                             241 93 93 93 121 221  241 93 93 93 121 221
PL 390 dark     149 / 701 / 746 / 779                                             269 93 93 93 121 221  (same)
EN 1280 dark    -                                                                  241 93 93 93 121 233  241 93 93 93 121 233
PL 320 dark     148 / 700 / 745 (TabBar 635, not asserted)                         289 117 93 117 141 241 241 93 93 93 121 221
```

The page's skeleton/real difference: −35 px at 390 EN and −36 px at 1280 EN, the same as before. At 320 px in Polish the Events line ("Maksimum Orionidów · noc 21/22 paź" behind its icon) wraps to two lines (117 px against the skeleton's 93), like the Polish target names there: the known 320 px wrap, as accepted in ui-user-adjustments.

Break check (main session): `eventsVerdict` returning `"pairing"`, `factIcon` returning `FACT_ICONS.why` for events, and the skeleton's slow-hint `mt-6` removed made 5 tests fail (2 in `sky-events.test.ts`, 2 in `fact-icons.test.ts`, the exact-count test for `TonightSkeleton.astro`). All three files were restored with `git checkout -- <file>` and 147/147 passed again.

E2E (1.6): `tonight-dashboard tonight-phone seven-night-planner sky-events planets-on-tonight what-to-expect telescope-selector offline`: 19 passed. The new Events assertion (one svg, `data-fact` an event kind) ran: the Orionids are next today.
