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

## Phase 2 (the verdict), 2026-10-15

`dashboard.mjs --measure` now also takes the viewports `w360` and `w640` and prints the verdict container's natural height (`min-height: 0` injected) and its rendered height for the page and the skeleton, with the event line and its wrapper hidden (`eventLine` was 0 in every run).

`VERDICT_MIN_HEIGHT_CLASS` (EN go, the fixture night, dark): the real verdict's natural height is 168 px at 360 and 232 px at 640, so the class is `min-h-42 sm:min-h-58` (was `sm:min-h-59`; the forecast line moved from `mt-3` to `mt-line`). The container, natural/rendered:

```
           real          skeleton
360        168 / 168     144 / 168   (the skeleton's reason bar is one line; the min-height holds it)
390        168.9 / 168.9 144.9 / 168
640        232 / 232     232 / 232
1280       232 / 232     232 / 232
```

The page's skeleton/real difference: 360 −16, 390 −35, 640 −36, 1280 −36 px (390 and 1280 as before). The phone first screen at 390: 149 / 701 / 746 against 779, unchanged.

A night with no forecast (review F1; the preview's `FORECAST_BASE_URL` on a closed port and the local KV cache moved aside, then restored), 390 px, dark, verdict section / Telescope title bottom, against the TabBar at 779:

```
        before        after
EN      145 / 774     141 / 770
PL      165 / 794     161 / 790
```

So that night is 4 px better (the forecast line on `mt-line`). In Polish the Telescope title already sat under the TabBar on that night and still does; the first-screen invariant is the fresh go night's. Shots: `before|after/tonight-phone-{en,pl}-dark-noforecast-fold.jpg`.

`/design` "VerdictCard: the sky event line" (dev server on 4331): `after/c-verdict-event-{390,1280}-{en,pl}-{dark,light,red}.jpg`. Each line is one `data-fact` with one svg: the meteor shower's `Sparkle`, the solar eclipse's own `Eclipse` (owner D4).

The phone spec now hides the line's `mt-line` wrapper too (`:has(> [data-verdict-event])`), so the wrapper's 8 px margin never counts on an event night.

Break check: a second `mt-1` (the h2 back to a numeric step) in `VerdictCard.astro` failed the guard twice: the numeric step, and `mt-1` used more often than allowed. Restored with `git checkout --`, 104/104.

E2E (2.4): `tonight-dashboard tonight-phone sky-events tonight-sky red-night-mode planets-on-tonight what-to-expect offline`: 27 passed. Gates: `astro check` 0/0, lint clean, `npm test` 122 files / 2338 passed, build OK.

## Phase 3 (rules, gate, landing), 2026-10-15

`after/` now holds the final build: `dashboard.mjs` over dark / light / red × EN / PL × phone / desktop, plus dark EN / PL at 320 px (`narrow`), written under the `before/` names (the Phase 1 files of the same name are overwritten) as JPEGs at quality 45 (620 px for phone and narrow tiles and folds, 900 px desktop tiles, 1400 px phone full pages, 1000 px desktop full pages). The `c-verdict-event-*` and `*-noforecast-*` files are the Phase 2 ones, kept.

`dashboard.mjs --measure` on the final build (dark; the preview's fixture night; px). The Events row wraps at 320 PL and the Planets row is taller at 320 EN today (the planets line is longer on this date), so the 320 column differs from Phase 1.

```
                 first screen (headline / Site / Telescope title / TabBar)   tiles real                    tiles skeleton
EN 390           149 / 701 / 746 / 779                                       241 93 93 93 121 221          241 93 93 93 121 221
PL 390           149 / 701 / 746 / 779                                       269 93 93 93 121 221          (same)
EN 1280          (desktop: 208 / 868 / 757 / -)                              241 93 93 93 121 233          241 93 93 93 121 233
EN 320           148 / 700 / 745 / 635 (not asserted)                        261 93 93 117 145 221         (same)
PL 320           148 / 700 / 745 / 635 (not asserted)                        289 117 93 117 141 241        (same)
```

The page's skeleton/real difference (the script's `delta`, real minus skeleton; negative when the skeleton is taller): EN 390 -35, EN 1280 -36, PL 390 -7 (PL targets wrap on one more line), PL 1280 -36, 320 EN +32 and PL +100 (known 320 px wraps). The verdict container: 390 real 168.86 / skeleton 144.86 natural, both rendered 168.86 / 168; 1280 232 / 232.

The landing image (review F5): no `[data-verdict-event]` on /tonight today. At 1280×1125 dark EN with the seeded user the first tile `[data-tonight-tiles] > a` spans y 876 to 1117 (241 px), so its bottom rule is at 1117. `VIEWPORT.height` in `tests/e2e/landing-screenshot.spec.ts` and `SCREENSHOT.height` in `src/components/Welcome.astro` went 1125 -> 1117 (the plan expected about 1105). `public/landing/tonight.png` was recaptured: 1280×1117, the picture ends on the first tile's rule.

`after/` is 1.5 MB; `evidence/` is about 4.4 MB in total.

Break check (3.1), on the clean, rebased tree (main 5d52a37): `mt-4` in `TonightTiles.astro`, `space-y-3` in `TonightSkeleton.astro` and the h2 back to `mt-1` in `VerdictCard.astro` failed the guard with `components/tonight/TonightTiles.astro:129 mt-4`, `components/tonight/TonightSkeleton.astro:83 space-y-3`, `components/tonight/VerdictCard.astro:100 mt-1` and `VerdictCard.astro: mt-1 allowed 1, used 2` (4 failed); then the skeleton's slow-hint `mt-6` removed failed the exact-count test (`TonightSkeleton.astro … exactly as many times`). Each time the files were restored by path (`git checkout -- <file>`), 104/104.

Whole suite (3.2-3.4), on a fresh `npm run build` of the final tree, previewed on 4331 with the fixture on 4401 and `dist/server/.dev.vars` on the local stack, the keys inline:
- `npm run test:e2e`: **76 passed, 4 skipped, 0 failed** (1.1 min). The skips are the specs' own conditions: the landing capture (only with `CAPTURE_LANDING=1`), the finder's no-darkness window, the Moon as a target, the `/tonight/all#washed-out` bookmark.
- `npm run smoke`: **45/45 passed**.
- `npx astro check` 0 errors / 0 warnings, `npm run lint` clean, `npm test` 122 files / 2338 passed, 1 skipped, 6 todo, `npm run build` OK.

The agent's own check (3.5) of `after/` against `before/`, by the main session: at 390 px in dark, light and red, EN and PL, the tiles read as one family (the heading 8 px over its content, 40 px between tiles), the Events line leads with the Orionids' `Sparkle` on its first line, the Planets reason carries its Info icon, and the first screen keeps the headline, the Site card and the Telescope title above the TabBar; on desktop the verdict and the tiles hold the one-column layout with the same rhythm; the `/design` verdict specimens show each event line as its own fact with its kind's icon, the solar eclipse's `Eclipse` included. Nothing looked off.

## After the implementation review (2026-10-15)

F1 (b), a known cost from arithmetic, not measured (no event night before the Orionids, 21/22 Oct): the verdict's event line now takes 28 px (`mt-line` 8 + the 20 px line; before `mt-1` 4 + 20 = 24). At 390 px the verdict fills its `min-h-42` exactly (natural 168.9 px), so nothing swallows the line and it moves the cards down: for a one-line event the Telescope title ends about 774 px against the TabBar at 779 (about 5 px to spare, was 9). A two-line Polish solar-eclipse line was already past the TabBar (about 790) and would be about 794. The phone spec measures without the line and its wrapper. Owner, 2026-10-15: the Polish no-forecast night under the TabBar is a permanent known limitation (CLAUDE.md, Phone first).

F2: the `TILES_GAP_CLASS` test went red with `pt-3` and green again after the restore (105/105). Gates after F1-F3: `astro check` 0/0, lint clean, `npm test` 122 files / 2339 passed, build OK, e2e `tonight-dashboard tonight-phone` 7 passed.
