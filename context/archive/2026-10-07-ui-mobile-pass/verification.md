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

## Phase 4: states, visual gate and guard (2026-10-07)

### Gates

- `npx playwright test tonight-phone`: 3/3 passed (first screen at 390×844; no sideways scroll at 320 and 375 px on 8 pages in EN and PL; panorama 304 px at 375 and 1280).
- **Break check:** the gear row's phone top padding was raised `pt-2` → `pt-10` in the worktree only and rebuilt. The spec went red ("first target row must sit above the TabBar at 390×844": 808 > 779), and the file was restored with `git checkout`.
- Full e2e on the restored build: 37 passed, 1 skipped (`landing-screenshot`, capture-only).
- `npx astro check` 0 errors; eslint 0 errors (3 existing warnings in engine tests); vitest 835 passed; `npm run build` OK.

### Screenshot matrix (4.5)

`/tonight` in EN/PL × dark/light/red × 375/390/1280: `evidence/after/matrix/` (18 images). The scripted check over 72 page/locale/theme/viewport combinations (`/tonight`, `/tonight/targets`, `/gear`, `/log`) found 0 sideways overflow. The first target row sits above the TabBar at 390×844 in every locale and theme.

### Regression (4.6), compared with `evidence/` (before)

| Page | 390 px h1 top / page height | 1280 px h1 top / page height |
| --- | --- | --- |
| `/gear` | 104 → 88 / 988 → 897 | 128 / 948 (unchanged) |
| `/log` | 104 → 88 / 844 | 128 / 900 (unchanged) |
| `/tonight/targets` | 156 → 132 / 2290 → 2231 | 188 / 1878 (unchanged) |

### 7-state matrix (4.7), specimens on `/design` (dev only)

| State | Verdict block | Tile | Gear row |
| --- | --- | --- | --- |
| default | shown: go · clear | shown: default | shown: one site (link), 2 sites (pills), 4 sites (dropdown) |
| hover | N/A, not interactive | shown: hover specimen | shown: pills hover specimen; the gear link's hover is a token text colour |
| focus-visible | N/A, not interactive (the slider and Now button have their own focus specimens) | shown: focus-visible specimen | shown: pills and gear-link focus specimens; the dropdown uses the NativeSelect focus cell |
| disabled | N/A, not interactive | N/A, a tile is a link that always opens its page | N/A, the links and the select always work |
| error | shown as states: no forecast (`none`), stale forecast (`fallback`, visible on phones too); a failed island keeps the skeleton's reload hint | N/A, errors render outside tiles | gear-list load errors render as `ServerError` (its own specimen) |
| empty | shown: no dark window (summer at 54° N) | shown: "no targets" | N/A, below two items there is no selector (captioned) |
| loading | shown: TonightSkeleton | shown: skeleton row | shown: TonightSkeleton's one-line gear-row placeholder |

Also shown: marginal and no-go verdicts, the slider and Now button (default, hover, focus-visible).

### Landing (#3)

The capture now ends on the first tile's rule at 1280×1145 (was 1160). The new height is set in both `landing-screenshot.spec.ts` and `Welcome.astro`, and `public/landing/tonight.png` is recaptured.

### Open for the user

- 2.6: the tile stack is about 644 px (target ≤ 600 px).
- 4.8: the user's approval of the phone first screen.
- The first-screen margin at 390×844 is 3 px, so any new block above the tiles fails `tonight-phone.spec.ts` by design.

## Implementation review fixes (2026-10-07)

Fixed F1–F7 and F9 (`reviews/impl-review.md`); F8 skipped (dev-only, predates the change). Re-run: astro check 0 errors, eslint 0 errors, vitest 835 passed, build OK, full e2e 37 passed / 1 skipped. Break check on the revised first-screen assertion: `GEAR_ROW_GAP_CLASS` raised to `pt-12` in the worktree → "the first target's first line must sit above the TabBar at 390×844" failed (812 > 779), file restored.
