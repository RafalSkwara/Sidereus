# Verification — ui-mobile-pass

Production preview on local Supabase + `tests/e2e/forecast-fixture.mjs` (all-clear), user onboarded in Madrid with the default kit; temporary Playwright capture spec (not committed). Baseline: `research.md` › Measured layout and `evidence/*.png`.

## Phase 1 — phone rhythm (2026-10-07)

| Check | Before | After | Evidence |
| --- | --- | --- | --- |
| h1 top, focused Tonight pages, 390 px | 156 | 132 | `evidence/after/en-dark-390x844_tonight_targets.png` |
| h1 top, `/gear` and `/log`, 390 px | 104 | 88 | `evidence/after/en-dark-390x844_gear.png` |
| `/gear` page height, 390 px | 988 | 897 | — |
| 1280 px: h1 tops and page heights (targets, moon, gear, log) | 188/188/128/128; 1878/1022/948/900 | identical | — |
| Sideways overflow, 320/390/1280 px, EN + PL (landing, sign-in, targets, moon, gear, log) | — | 0 everywhere | — |
| PL titles at 320 px wrap on whole words (landing, log) | — | yes | `evidence/after/pl-dark-320x568_log.png` |

`--text-display` resolves to 32/36 px at ≤ 360 px, 32.9/36.9 px at 390 px and 40/44 px from 640 px (unchanged desktop).

## Phase 2 — shared Tile and compact tiles (2026-10-07)

| Check | Result | Evidence |
| --- | --- | --- |
| Hand-written tile blocks left in `TonightTiles.astro` | 0 | grep |
| Tile stack height at 390 px, EN (criterion 2.6: ≤ 600 px) | **about 644 px** (was 905): **not met**. The 7-night tile (bars, marks, days, 2-line caption, about 200 px) is most of the gap. Left open for the user's review, not cut further without a decision. | `evidence/after/p2-en-dark-390x844_tonight-full.png` |
| "Point here first" is the heaviest tile | yes (title-size rows; Moon, Plan and Planets are one or two body lines) | same |
| `/design` Tile states in dark, light and red | default, hover, focus-visible, empty, skeleton shown; disabled and error N/A with reason | `evidence/after/design-tile-light.png`, `design-tile-red.png` |
| Lint after review | 2 new `prefer-class-list-directive` warnings in `Tile.astro` fixed (`class:list`) | — |

## Phase 3: the dashboard's first screen (2026-10-07)

| Check | Result | Evidence |
| --- | --- | --- |
| Verdict content height, EN go | 244 px at 360 px and 388 px at 640 px (measured), so `min-h-61 sm:min-h-97` is exact | p3 capture |
| First target row bottom at 390×844, EN and PL | 776 against the TabBar top at 779: **passes with 3 px to spare** | `evidence/after/p3-en-dark-390x844_tonight.png` |
| 360×780 | row bottom 776 against the TabBar at 715: known limit, as planned | — |
| Panorama SVG height | 304 px at every width (unchanged) | — |
| Sideways overflow, 320/390/1280 px, EN + PL | 0 | — |
| Skeleton → island | the panorama foot and the first tile land at identical y in the skeleton and the island at 360 (524/696), 390 (524/696) and 1280 (684/944) px, with service workers blocked and the island request held | p3c skel.json |
| Compass row vs verdict text | clear for EN go 390/1280 and PL "Tak" 320 (3-line answer). Marginal and no-go are clear by construction: the container only grows and keeps `pb-10`, so the text foot is ≤ 56 px into the 96 px overlap while the clamp places the compass at ≥ 64 px | `evidence/after/p3-pl-dark-320x568_tonight.png` |
| 2 telescopes: pills under the sky, switching works | pills at y = 696 above the tiles (764); click → `?telescope=<id>` and Tonight reloads | `evidence/after/p3-two-telescopes-390.png` |
| Gate fix | the slider row's track and legend sat outside the flex container (phone row overflowed onto the gear line). Moved inside (attempt 1/2), re-verified | — |

Known minor: below `sm` the slider row shows time · track · Now, while the DOM order (kept for desktop) is time · Now · track, so on phones Tab reaches Now before the slider.
