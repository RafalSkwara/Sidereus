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
