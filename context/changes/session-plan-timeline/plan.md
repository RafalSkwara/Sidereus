# Session plan timeline Implementation Plan

## Overview

Roadmap S-05 (M-2, MS-05, GitHub #69). Add a read-only **Session plan** page, `/tonight/plan`, reached from a new dashboard tile. It lays the night out on one time axis from sunset to sunrise: the dark window shaded, moonrise and moonset marked, and one row per recommended target (the top-5 deep-sky ranking, the planets, and the Moon when it is a target), each with a bar for its best window and a dot at its best time, ordered by best time. The user can follow it from the first target to the last.

## Current State Analysis

- `/tonight` is a dashboard (S-11): the live sky, then ruled tiles (`TonightTiles.astro`) that open focused pages under `/tonight/*` (targets, moon, planets, nights). Each focused page is a `GearShell skyFlow` shell plus a `server:defer` content island that loads through `loadTonightFor` (`src/lib/tonight/island.ts:39`) and opens with `TonightPageSky`, with `TonightPageSkeleton` as the fallback (`src/pages/tonight/planets.astro`).
- `buildTonight` (`src/lib/tonight/build.ts:466`) already computes everything the timeline shows, but exposes windows only as formatted `HH:mm` strings: deep-sky entries (`build.ts:592`), the Moon target (`build.ts:608`), planets (`build.ts:669`, `722`) carry `windowStart` / `windowEnd` strings plus `bestAt` (epoch ms). The dark window is a formatted `TonightDarkWindow` (`build.ts:270`). The Moon's up spans come from `moonUpOf` (`build.ts:402`) over the Moon card's window (dark or civil), not over sunset to sunrise.
- The interactive sky already defines the night's axis: sunset to sunrise, or the whole observing night when either is missing (`build.ts:790-795`, `sunEvents`).
- Optional, failure-tolerant view parts follow one pattern: an option (`withSkyView`) and a `… | null` field built in a `try`, so a failure never takes the view down (`build.ts:362-375`).
- `/tonight` already covers `/tonight/plan` in `PROTECTED_ROUTES` (whole-segment match), and `src/pages/tonight/**`, `src/components/tonight/**` and `src/lib/tonight/**` are already in the coordinate no-console lint (`eslint.config.js:85-105`), so lessons.md's lint rule needs no edit.
- lessons.md: Tonight's pages are server islands and need JavaScript; no no-JS criteria.

## Desired End State

- `/tonight/plan` shows, for the site and telescope picked on Tonight, a time axis from sunset to sunrise with hourly ticks, the dark window shaded, moonrise / moonset marked, and the rows ordered by best time; each row is a link to that target's row on `/tonight/targets`, `/tonight/planets` or to `/tonight/moon`.
- The dashboard has a **Session plan** tile after "Point here first", with a mini axis (dark window, Moon up, the first three rows' best-time dots) and a "First up" line; it opens `/tonight/plan`.
- Works at 390 px in dark, light and red, EN and PL; WCAG AA; focus visible; every time on the page formatted on the server in the site's time zone.

Verify: unit tests for the layout helper, the dashboard e2e extended with the new tile and page, and a screenshot matrix.

### Key Discoveries:

- Rows can be gathered inside `buildTonight` where the raw `Interval`s are still in hand (`entry.score.window`, `best`, `entry.window`), so no engine change is needed.
- The sky view's axis rule (`build.ts:792-794`) is the one to reuse, so the timeline and the live sky's slider span the same night.
- `moonTrack(engineSite, interval, step)` + `moonUpOf` give the Moon's up spans for any interval; run them over the axis, not the Moon card's window.
- The Tonight skies are always night (`night-sky` scope); the timeline sits in the content below the sky, so it uses the page's ordinary tokens.

## What We're NOT Doing

- No editing of the plan: no reorder, drop, or "add from Targets" (a later change).
- No sequencing of overlapping windows into one-at-a-time slots; overlaps are shown side by side.
- No objects beyond the ranking's top five (no "the other N", no washed-out objects), and no planets hidden by the planet gate.
- No offline caching (S-06) and no no-JS fallback.
- No new engine maths, no database or migration change.
- No change to the live sky or the other focused pages.

## Implementation Approach

Build the timeline's data once on the server as plain positions (fractions of the axis) plus pre-formatted labels, so the Astro components only draw. A pure layout helper does the arithmetic and is the only thing unit-tested; `buildTonight` feeds it raw intervals behind a `withSessionPlan` option, set by the dashboard (for the tile) and the plan page. The page and tile are Astro only (no client island): nothing on them changes after load.

## Critical Implementation Details

**User experience spec** — at 390 px each row puts the target's name and best time on a line above its bar, so the bar can use the full width; the axis ticks are hourly with labels thinned to fit (every other hour on a phone). The bars and marks are `aria-hidden`; each row link's accessible name reads the target, its best time, its window and direction, and the page states the dark window and Moon events in text, so nothing is conveyed by position or colour alone (red mode).

## Phase 1: Session-plan data

### Overview

Give `TonightView` an optional `sessionPlan` with the axis, the dark window, the Moon's rise and set and the ordered rows, all as axis fractions plus server-formatted labels.

### Changes Required:

#### 1. Pure layout helper

**File**: `src/lib/tonight/session-plan.ts` (new), `src/lib/tonight/session-plan.test.ts` (new)

**Intent**: Turn an axis interval, the dark window, the Moon's up spans and a list of raw rows into positions on the axis, ordered for reading. Pure (no clock, no formatting beyond what is passed in), so it can be tested without the engine.

**Contract**: `layoutSessionPlan(input) → SessionPlanLayout`. Input: `axis: Interval`, `dark: Interval | null`, `moonSpans: Interval[]`, `rows: { kind: "object" | "planet" | "moon"; key; window: Interval; bestAt: number; … }[]`. Output: `dark: { from, to } | null`, `moonEvents: { kind: "rise" | "set"; at: number /* 0..1 */; time: number }[]` (only crossings inside the axis), `rows` sorted by `bestAt` ascending, ties keeping input order (Moon, planets, then deep-sky by rank), each with `from`, `to`, `best` as fractions clamped to `[0, 1]`, and `hours: number[]` (epoch ms of the whole hours inside the axis, for ticks). Rows whose window lies entirely outside the axis are dropped.

#### 2. View field and build option

**File**: `src/lib/tonight/build.ts`

**Intent**: Collect the rows while the ranking (top `limit` entries), the planets and the Moon target are built, compute the axis with the sky view's rule and the Moon's up spans over it, call the helper, and format the labels (hour ticks, moonrise / moonset times, row best time and window) in the site's time zone. Built only with `withSessionPlan`; a failure sets `null`.

**Contract**: `TonightView.sessionPlan: TonightSessionPlan | null`; `buildTonight(…, { limit?, withSkyView?, withSessionPlan? })`. `TonightSessionPlan` carries the layout plus, per row, `label`, `name`, `href` (same targets as the sky view's markers: `/tonight/targets#object-<id>`, `/tonight/planets#planet-<key>`, `/tonight/moon`), `bestTime`, `windowText`, `bestDirection`; plus `axisStart` / `axisEnd` / `darkText` / `moonText` lines and the tick labels. Extract the sky view's axis computation into one shared local function rather than duplicating it, and compute the Moon track over the axis once (`moonTrack(engineSite, range)`, the default 10-minute step the sky view already uses at `build.ts:839`), so `skyView` and `sessionPlan` share it when both options are set.

#### 3. Load option

**File**: `src/lib/tonight/load.ts`, `src/lib/tonight/island.ts`

**Intent**: Pass `withSessionPlan` through, like `withSkyView`.

**Contract**: `TonightIslandLoad.withSessionPlan?: boolean`.

### Success Criteria:

#### Automated Verification:

- Layout tests pass: `npm test -- session-plan` (order by best time across midnight, tie order, clamping to the axis, rows outside the axis dropped, moonrise and moonset inside the axis only, no dark window)
- Full unit suite, type check and lint pass: `npm test`, `npx astro check`, `npm run lint`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: The /tonight/plan page

### Overview

The focused page: shell, server island, the timeline component, copy.

### Changes Required:

#### 1. Page shell

**File**: `src/pages/tonight/plan.astro` (new)

**Intent**: Same as `planets.astro`: read the requested gear, render `GearShell skyFlow` with the content island and `TonightPageSkeleton` fallback (`reloadHref="/tonight/plan"`), `DatabaseMissing` without Supabase, and the attribution. No log notice (the page has no "Mark observed").

**Contract**: route `/tonight/plan`; props to the island: `siteId`, `telescopeId`.

#### 2. Content island

**File**: `src/components/tonight/PlanPageContent.astro` (new)

**Intent**: Load with `withSessionPlan: true`, render `TonightPageSky`, the gear and load failures and the no-gear line as the other pages do, then the timeline. With no rows (no-go night and no planets, no darkness), say why using the view's explanation or a plan-specific line and link to the nights page.

**Contract**: follows `PlanetsPageContent.astro`'s structure; never records the sky verdict.

#### 3. Timeline component

**File**: `src/components/tonight/SessionTimeline.astro` (new)

**Intent**: Draw the axis (hour ticks, dark window shaded, moonrise / moonset marks with a small icon and time), then one row per target: name and best time above a bar for its window with a dot at the best time; each row a full-width link (44 px minimum, token hover, ring focus). A text line above the axis states the dark window and the Moon's events. Tokens only; marks distinguished by shape as well as colour; positions as percentages from the fractions (inline `style` with computed `left`/`width` is data, not an arbitrary Tailwind value).

**Contract**: `Props { plan: TonightSessionPlan; size?: "full" | "mini" }`. The `mini` size is reused by the tile in Phase 3 (axis band, Moon span, first three best-time dots, no rows or ticks). If the dark-window shading or the Moon span needs a colour no token gives, add a token in every theme block (red with zero green and blue).

#### 4. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Page title, axis and event lines ("Dark 21:40–05:10", "Moonrise 23:12", "Moonset 04:05", "Moon up all night"), the row's accessible name, the empty-state lines, the tile's heading and "First up" line.

**Contract**: keys under `tonight.summary.plan` and `tonight.pages.plan`; Polish parity (`i18n.test.ts`).

### Success Criteria:

#### Automated Verification:

- Type check, lint and unit tests pass: `npx astro check`, `npm run lint`, `npm test` (i18n parity, no-hardcoded-colors, red-theme)
- Production build succeeds: `npm run build`

#### Manual Verification:

- `/tonight/plan` on a clear-forecast preview shows the axis, the dark window, the Moon's events and the rows ordered by best time; each row opens its target's row or the Moon page
- Empty state on a no-darkness or no-go night explains itself and links to the nights. Recipes: a site near −70° latitude (no astronomical darkness in October) for the no-darkness case, and `FORECAST_BASE_URL` pointed at a dead port in `dist/server/.dev.vars` (after the build) for "No forecast"; the e2e forecast fixture is all-clear only
- Screenshots at 390 px and desktop in dark, light and red, EN and PL: names and times readable, nothing clipped, Polish fits, focus ring visible on a row

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Dashboard tile and verification

### Overview

Reach the plan from the dashboard, pin the route with e2e, document it.

### Changes Required:

#### 1. Session plan tile

**File**: `src/components/tonight/TonightTiles.astro`, `src/components/tonight/TonightContent.astro`, `src/lib/tonight/island.ts` callers

**Intent**: The dashboard loads with `withSessionPlan`; a "Session plan" tile follows "Point here first" whenever `sessionPlan` is set, showing `SessionTimeline size="mini"` and "First up: <name> <time>" (or the empty line when there are no rows), named by its heading like the other tiles. Update the component's header comment.

**Contract**: tile link `href="/tonight/plan"`, `aria-labelledby` its heading.

#### 1b. Dashboard skeleton

**File**: `src/components/tonight/TonightSkeleton.astro`

**Intent**: The skeleton draws one ruled row per tile so the tiles don't jump when the island swaps in; add a row for the Session plan tile after "Point here first", at the mini tile's height, and update its header comment ("four ruled rows").

#### 2. End-to-end

**File**: `tests/e2e/tonight-dashboard.spec.ts`

**Intent**: Add the tile to `TILES` (so it is checked to open its page and lead back), and one check that the plan page lists rows whose links point at `/tonight/targets#object-`, `/tonight/planets#planet-` or `/tonight/moon`. Keep it modest: no assertions on times (the clock is real).

**Contract**: existing spec, one entry and one test added.

#### 3. Docs

**File**: `CLAUDE.md`, `context/handoff.md`

**Intent**: Mention `/tonight/plan` and `sessionPlan` / `withSessionPlan` in the Tonight description and the UI section's list of focused pages; update the handoff's state and next step (S-06).

#### 4. Landing screenshot

**File**: `public/landing/tonight.png`

**Intent**: The landing shows a 1280×1160 capture of the dashboard, and CLAUDE.md asks for a recapture after a Tonight redesign; the new tile changes it. Recapture with `CAPTURE_LANDING=1 BASE_URL=http://localhost:4321 npx playwright test landing-screenshot` against the local preview, and review the image before committing.

### Success Criteria:

#### Automated Verification:

- Type check, lint, unit tests and build pass: `npx astro check`, `npm run lint`, `npm test`, `npm run build`
- Dashboard e2e passes against a local preview with local Supabase and the forecast fixture: `npm run test:e2e -- tonight-dashboard`

#### Manual Verification:

- Dashboard screenshots at 390 px and desktop in dark, light and red, EN and PL: the tile's mini axis reads, the dashboard does not jump between skeleton and content more than before
- Keyboard: the tile and every plan row are reachable with a visible focus ring

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `session-plan.test.ts` only: ordering across midnight and ties, clamping, out-of-axis rows dropped, Moon crossings inside the axis only, null dark window. The user prefers modest tests; layout is checked by screenshots.

### Integration Tests:

- `tonight-dashboard.spec.ts`: the new tile opens `/tonight/plan` and leads back; plan rows link to their targets.

### Manual Testing Steps:

1. Local preview with local Supabase and the all-clear forecast fixture (handoff's e2e recipe); open `/tonight`, then the Session plan tile.
2. Check row order against the best times shown, and the Moon events against the live sky's Moon on the dashboard slider (same sunset→sunrise range). The Moon page's "Up …" line covers only the dark (or civil) window, so it agrees with the plan only inside that window.
3. Repeat the screenshot matrix (EN/PL × dark/light/red × 390 px/desktop) for the page and the tile.
4. Tab through the page; open a planet row and confirm the planets page scrolls to it.

## Performance Considerations

One extra Moon track over the axis (the sky view already samples the same interval) and a sort of at most ~12 rows; negligible on Workers Paid. The other focused pages don't set the option and pay nothing.

## References

- Roadmap: `context/foundation/roadmap.md` → S-05; GitHub #69
- Focused-page pattern: `src/pages/tonight/planets.astro`, `src/components/tonight/PlanetsPageContent.astro`
- Axis rule: `src/lib/tonight/build.ts:790-795`; Moon up spans: `build.ts:402`
- Tiles: `src/components/tonight/TonightTiles.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Session-plan data

#### Automated

- [x] 1.1 Layout tests pass: `npm test -- session-plan` — dbdfef4
- [x] 1.2 Full unit suite, type check and lint pass — dbdfef4

### Phase 2: The /tonight/plan page

#### Automated

- [x] 2.1 Type check, lint and unit tests pass — eb92f4e
- [x] 2.2 Production build succeeds — eb92f4e

#### Manual

- [x] 2.3 /tonight/plan shows axis, dark window, Moon events and rows by best time; rows open their targets — eb92f4e
- [x] 2.4 Empty state explains itself and links to the nights — eb92f4e
- [x] 2.5 Screenshot matrix for the page (390 px/desktop, dark/light/red, EN/PL) — eb92f4e

### Phase 3: Dashboard tile and verification

#### Automated

- [x] 3.1 Type check, lint, unit tests and build pass
- [x] 3.2 Dashboard e2e passes against a local preview

#### Manual

- [x] 3.3 Dashboard screenshot matrix with the Session plan tile
- [x] 3.4 Keyboard: tile and plan rows reachable with visible focus
