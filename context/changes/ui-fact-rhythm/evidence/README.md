# ui-fact-rhythm evidence

Captured on 2026-10-15 against a production build of `feat/ui-fact-rhythm` (head f3ff251; after it only a PlanetCard comment and the skeleton row counts changed, so the view shots stay current), previewed on port 4331 with the forecast fixture on 4401 and local Supabase. The full matrices stay out of the repo; a curated, downscaled set is committed here.

Every script under `scripts/` refuses a non-local `BASE_URL`. No key is written anywhere: `seed.mjs` and the e2e take the local stack's keys inline on the command, never exported.

## Folders

- `before/`: full pages on main before this change (JPEGs capped at 1400 px tall, so phone shots are small).
- `exp-stat-cards/`: the stat-card experiment (`experiment.diff` plus shots) that led to the stacked Window / Best pair.
- `design/curated/`: the design record. The `a/b/c` shots (item rhythm, stat pair, fact icons) and the `i/ii` rhythm shots at 320 and 1280 px, in dark, light and red, EN and PL.
- `after/`: the final build, the same names as `before/` (61 files). Targets, Planets, the Moon, Nights and Events in phone / desktop, EN / PL, dark / light / red; the old-style names without a viewport (`targets-dark`, `planets-pl-dark`, ...) are the phone shot of that locale and theme. Plus `<route>-narrow-pl-dark` and `<route>-narrow-en-red` for the five routes (320 px). Downscaled JPEGs (quality 30): phone and narrow at 620 px wide, desktop at 1000 px wide, to stay under the size budget.
- `crops/`: one target row (top card), one planet card (Jupiter) and one event row (Orionids peak), in light and red, `*-before-*` and `*-after-*` (12 files). The after crops are element screenshots at 390 px, 2x, EN. The before crops are cut from the committed `before/` phone JPEGs, so they are approximate and low resolution (the target ones come from a 210 px wide image); compare layout, not pixels.
- `scripts/`: see below.

## Scripts

- `seed.mjs`: creates the two users (full plan, and without eyepieces) and writes `state-ui-fact.json` / `state-ui-fact-empty.json`. It needs the local stack's `SUPABASE_URL` and secret key inline.
- `capture.mjs`: `BASE_URL=http://localhost:4331 node capture.mjs <worktree> <outDir> [route-regex] [themes] [locales] [viewports]`. Viewports are `narrow` (320 px, 2x), `phone` (390 px, 2x) and `desktop` (1280 px). It hides the fixed TabBar before each shot. After run: `capture.mjs <wt> <out>/after '^(targets|planets|moon|nights|events)$' dark,light,red en,pl narrow,phone,desktop` (90 shots).
- `targets-rows.mjs`: `BASE_URL=... node targets-rows.mjs <worktree> <outDir> [themes] [locales] [widths]`. The top card and an opened "rest" row at 320, 390 and 1280 px; prints the row's metrics.
- `skeleton-heights.mjs`: `BASE_URL=... node skeleton-heights.mjs <worktree> <outDir>`. Page height with the skeleton (island requests aborted) against the real page, at 390 and 1280 px.
- `crops.mjs`: `BASE_URL=... node crops.mjs <worktree> <outDir> [themes]`. The three after crops.
- `design-sections.mjs`: `/design` sections (dev server, `MODE=design`).

## Owner checkpoint, 2026-10-15

The owner chose the stacked pair: Window and Best as two cards one above the other, and an item (row) rhythm of 20 px. The a/b/c and i/ii shots in `design/curated/` are the record of that choice.

## Row metrics (targets-rows.mjs, opened rest row)

`dl` width 222 px at 320, 292 px at 390, 670 px at 1280. Every `dd` is one line with no overflow (`1L,1L,1L`) in all 18 combinations (dark / light / red, EN / PL, three widths), and the page has no sideways scroll in any of them.

## Skeleton against real height (EN, dark, full-page scrollHeight, px)

First measurement (after Phase 4), then after the main session set Moon to `rows={1}` and Planets to `rows={7}` in their page shells (one default skeleton row is about 346 px on a base of about 661 px):

```
            first run                         final (moon rows=1, planets rows=7)
targets 390 skeleton=3429 real=3331 -98       skeleton=3429 real=3331 delta=-98
targets 1280 skeleton=3428 real=3086 -342     skeleton=3428 real=3086 delta=-342
planets 390 skeleton=2045 real=3223 +1178     skeleton=3083 real=3223 delta=140
planets 1280 skeleton=2044 real=3062 +1018    skeleton=3082 real=3062 delta=-20
moon 390 skeleton=1699 real=844 -855          skeleton=1007 real=844 delta=-163
moon 1280 skeleton=1698 real=900 -798         skeleton=1006 real=900 delta=-106
nights 390 skeleton=1441 real=1556 +115       (unchanged)
nights 1280 skeleton=1440 real=1375 -65       (unchanged)
events 390 skeleton=1682 real=1626 -56        (unchanged)
events 1280 skeleton=1681 real=1605 -76       (unchanged)
```

The default skeleton rows stand for a target (heading, detail line, the stacked pair, the hairline, three facts); Nights and Events have their own `nights` / `events` layouts. Planets depends on how many planets are up (five on the fixture night) and Events on the window's events, so both are fair typical cases, not exact matches.

## Guard break check

Run by the main session on 2026-10-15 (Phase 5, after f3ff251): `mt-4` added to `PlanetCard.astro:40` and `space-y-3` to `SkyEventList.astro:74`, worktree only. `npm test`: 2 failed in `src/styles/rhythm-roles.test.ts` (`components/tonight/PlanetCard.astro:40 mt-4`, `components/tonight/SkyEventList.astro:74 space-y-3`), 1991 passed. Both files restored with `git checkout --`; the guard back to 43/43. Earlier, per phase: `mb-3` in `StatCard` (Phase 1), `mt-4` in `PlanetCard` (Phase 3), `mt-4` in `NightStrip` (Phase 4), each red then restored. The e2e break (Phase 3): `StatPair` back to `grid-cols-2`, rebuilt, and `what-to-expect.spec.ts`'s 320 px test went red on the one-line value check; restored and rebuilt.

## E2E and smoke

On 2026-10-15, against a fresh `npm run build` + `astro preview` on 4331 with the forecast fixture on 4401 and `dist/server/.dev.vars` on the local stack, the local stack's URL, anon and secret keys inline on the commands, as CI does:

- `npm run test:e2e`: **64 passed, 4 skipped, 0 failed** (68 tests, 1.4 min). The skips are the specs' own date or state conditions (for example the `/tonight/all#washed-out` bookmark when no object is washed out). A first run without `SUPABASE_KEY` inline failed `sky-checks.spec.ts` on its missing-key guard; with the key, as CI passes it, it is green.
- `npm run smoke`: all steps passed (finder and what-to-expect plan checks included).
- `npm test` alone: 110 files, 1993 passed, 1 skipped, 6 todo.

The solar eclipse is not on the fixture night, so its row (the amber safety icon) is checked on `/design`'s `c-sky-event-list` specimen: `crops/event-solar-after-{light,red}.jpg`.

## After the implementation review (2026-10-15)

**Skeleton fitted to the rows (F9, owner).** The default skeleton row now mirrors a target row (title, detail line, the two stat cards at their real 58 / 78 px, the hairline group of three facts, the action row); Targets passes `rows={MAX_RANKED_OBJECTS}`, Planets `rows={5}`, Moon `rows={0}`, Finder `rows={2}`. Measured with `skeleton-heights.mjs` (EN, dark, scrollHeight, px; finder = `/tonight/finder?object=M13&from=targets`):

```
page     width  before review (skeleton/real/delta)   after review (skeleton/real/delta)
targets  390    3429 / 3331 / -98                     3287 / 3331 / +44
targets  1280   3428 / 3086 / -342                    3086 / 3086 / 0
planets  390    3083 / 3223 / +140                    3287 / 3223 / -64
planets  1280   3082 / 3062 / -20                     3086 / 3062 / -24
moon     390    1007 /  844 / -163                     844 /  844 / 0
moon     1280   1006 /  900 / -106                     900 /  900 / 0
nights   390    1441 / 1556 / +115                    1561 / 1556 / -5
nights   1280   1440 / 1375 / -65                     1440 / 1375 / -65
events   390    1682 / 1626 / -56                     1682 / 1626 / -56
events   1280   1681 / 1605 / -76                     1681 / 1605 / -76
finder   390    2640 / 1717 / -923 (rows 4)           1588 / 1717 / +129 (rows 2)
finder   1280   2511 / 1244 / -1267 (rows 4)          1539 / 1244 / -295 (rows 2)
```

(The deltas are real minus skeleton; "before review" for Targets/Planets/Moon/Nights/Events is the table above, for the finder the first run after the skeleton rebuild with its old `rows={4}`; before this change the finder's skeleton was about 2045 px against the same real page.) The Moon skeleton is fitted to a night when the Moon is not a target (the page then sits at the shell's minimum height); on a night when it is a target the real page is about 1300 px and grows after the swap.

**Guard break check (F1).** With a second `mt-0.5` in `Fact.astro`, `mt-[13px]` in `PlanetCard.astro` and `flex flex-col gap-2` in `NightStrip.astro` (worktree only), `rhythm-roles.test.ts` failed 3 of 78: `components/ui/Fact.astro:40 mt-0.5`, `components/tonight/PlanetCard.astro:40 mt-[13px]`, `components/tonight/NightStrip.astro:34 gap-2`; restored, 78/78.

**E2E break check (F3).** `min-w-96` on `ObjectRow`'s body (rebuilt): the 320 px test failed on "a stat card must end within the row at 320 px" (413 > 291.5). `{entry.pair?.kind === "pair" && false && …}` in `ObjectDetails` (rebuilt): it failed on "pl: Targets shows an eyepiece fact (the 'Do szukania:' label)". Both restored and rebuilt. (A `min-w-96` on `StatCard` itself fails earlier, on the page's own no-sideways-scroll check, so it does not reach the new assertion.)

**F2.** The size fact's icon is `MoveHorizontal`; `crops/planet-after-{light,red}.jpg` are recaptured with it.

Gates after the fixes: `astro check` 0/0, lint clean, `npm test` 111 files, 2043 passed; build OK; e2e what-to-expect, planets-on-tonight, tonight-targets, tonight-phone, sky-events, seven-night-planner, moon-card, moon-as-target, finder-chart, finder-offline, red-night-mode, tonight-sky: 29 passed, 3 skipped.

## After the rebase onto S-08 (main 33a5586)

The whole e2e suite: **76 passed, 4 skipped, 0 failed** (80 tests; S-08 added its own); smoke: **45/45 PASS**; `npm test` 121 files, 2289 passed. S-08's `session_plans` migration was applied to the local stack with `npx supabase migration up --local` (no reset). S-08 changed nothing visible in the captured views (row ids, `scroll-mt-4`, `data-object-card`, the finder's `from` prop), so no screenshot was retaken.
