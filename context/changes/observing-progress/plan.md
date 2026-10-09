# Observing progress (M-3 S-05) Implementation Plan

## Overview

This slice gives the user a private progress page, `/log/progress`. It shows:

- the Messier checklist and the Caldwell checklist, each with a count ("47 / 110", "12 / 61");
- the planets and the Moon as "firsts", each with the date of its first night.

Tonight's targets also get a "not seen yet" mark (a Sparkles icon). Everything is filled from log entries rated 3 or above, through the same rule the ranking already uses (`seenSummaries`, `LOG_PENALTY_MIN_RATING`).

Roadmap M-3 S-05, GitHub #126, PRD FR-039, FR-040, US-06.

## Current State Analysis

The full evidence is in `context/changes/observing-progress/research.md`.

- **The "seen" rule exists once.**
  - `seenSummaries(entries, onOrBefore)` (`src/lib/engine/log.ts:32-49`) keeps entries rated `LOG_PENALTY_MIN_RATING` (3, `src/lib/engine/parameters.ts:184`) or above.
  - It counts distinct nights per target key and ignores nights after `onOrBefore`.
  - It returns `{ count, lastNight }` and no first night.
- **Tonight already computes the seen state per target.**
  - The log is read by `observationStore.listForRanking` (`src/lib/observations/store.ts:248-259`, called from `src/lib/tonight/load.ts:115`).
  - `buildTonight` computes `seenSummaries(log, date)` (`src/lib/tonight/build.ts:717`).
  - Each ranked object, planet and Moon target exposes it only as `seenText: string | null` (`build.ts:131,165,198`; set at `:763,:844,:900`).
- **The read is capped.** `listForRanking` is unbounded, so PostgREST's `max_rows = 1000` (`supabase/config.toml:18`) silently caps it. That is acceptable for "seen N times", but wrong for a checklist or a "not seen yet" mark. See `context/foundation/lessons.md:12-18`.
- **Target surfaces:**
  - `ObjectCard.astro`: `<SeenTag>` at `:37`, name in an `<h3>`.
  - `ObjectRow.astro`: an inline span inside `<summary>`, at `:37`.
  - `PlanetCard.astro`: `<SeenTag>` at `:32`, `<h3>` name.
  - `MoonCard.astro`: `:59`.
  - The dashboard's "Point here first" tile (`TonightTiles.astro:39-43` maps `summaryTargets` to `{id, name, bestTime}`). The whole tile is a `ui/Tile.astro` `<a>`.
- **The catalogue.**
  - `MESSIER` (110) and `CALDWELL` (61) are validated at import (counts at `src/lib/catalogue/index.ts:73-74`, exports at `:258-259`), and the two lists are disjoint (Caldwell rows have `messier === null`, `:191`; the id-overlap throw is at `:263-265`).
  - The Caldwell list is the 61 of 109 visible from mid-northern latitudes (`caldwell.meta.json`).
  - The catalogue is server-only.
- **The precedents.**
  - `/log/sky` (`src/pages/log/sky.astro`) is the sub-page precedent: `BackLink` + `PageHeader`, `Band`s, and an `action` link in `/log`'s header.
  - `/log` is gated, highlights "Log" in both navs, is network-only, and its pages are under the coordinate lint.
- **Tests.**
  - Tonight entry fixtures in `src/pages/design.astro:366,417` must gain any new required field.
  - `tests/e2e/tonight-phone.spec.ts:42` lists `APP_PAGES` for the sideways-scroll check.

## Desired End State

**The progress page.** A signed-in user opens `/log/progress` from an action link in `/log`'s header and sees three `Band`s:

1. **Firsts:** the seven planets and the Moon. Each shows "first seen <date>" (the earliest night logged with a rating of 3 or above) or "not yet".
2. **Messier:** the count "x / 110"; a grid of 110 numbered chips, with the seen ones filled and carrying a check icon; and under it, the seen objects as a list (label · common name · first night).
3. **Caldwell:** the same, as "x / 61". One muted note says the list covers the Caldwell objects visible from mid-northern latitudes.

**The mark on Tonight.** Every ranked object, planet and Moon target never logged with a rating of 3 or above carries the Sparkles mark next to its name:

- **On the cards** (the best band on Targets, Planets, the Moon): the mark is a button. Hover, tap or keyboard focus shows the legend tooltip; Esc closes it.
- **Where a button is not allowed** (the "Point here first" tile's rows, a link; the collapsed "show the other N" rows, a `<summary>`): the icon is static with screen-reader text. A single muted legend line ("✦ Not seen yet") explains it.

**How it stays correct.** Re-rating to 1-2 or deleting the only qualifying entry brings the mark back and lowers the counts on the next load. A rating of 1-2 never ticks anything.

**Verification:** unit tests, the db suite, e2e specs (`observing-progress.spec.ts`; `/log/progress` in `APP_PAGES`) and a screenshot matrix (EN/PL × dark/light/red × 390 px / desktop).

### Key Discoveries:

- `seenSummaries` already de-duplicates by night and filters by rating (`src/lib/engine/log.ts:32-49`). Progress reuses it, so ranking and progress cannot drift (roadmap risk, `context/foundation/roadmap.md:159`).
- The "not seen yet" state is exactly `entry.seen === null` in the engine entries (`build.ts:763,844,900`). It needs no new read.
- `ui/Tile.astro` is an `<a>` root, and `ObjectRow`'s name sits in a `<summary>`. No nested button is allowed there, which is why those surfaces get static marks plus a legend line (user decision).
- The native popover precedent is in `src/components/TopbarControls.tsx:52,194-208`.
- `tests/db/observations.test.ts:300-320,486-492` and `src/lib/tonight/load.test.ts:37` reference `listForRanking` by name.

## What We're NOT Doing

- Milestones and the celebration at save (FR-041): that is S-06, observing-milestones. This slice only exposes the data S-06 will need (per-object `firstNight`, per-list counts).
- No new table, migration, RPC or view. Pagination replaces an aggregate, so nothing is added to `TABLES` (`tests/db/tables.ts`, from PR #147, on this branch since the rebase onto `2a2fbf4`), and `tests/db/structure.test.ts` is unaffected.
- No new navigation destination and no dashboard progress tile.
- No "not seen yet" mark on the Session plan rows, the live sky markers or the washed-out list.
- No type grouping or type labels in the checklists. The chips carry no links.
- No offline storage of `/log/progress`: it is network-only like `/log`. Stored Tonight copies keep the mark they were rendered with, as the existing seen tag does.
- No recapture of the landing screenshot: the tile gains only a small icon and a legend line, not a redesign. The next recapture (fixed 1280×1125, `landing-screenshot.spec.ts:17-22`) will show them and may need its height checked.
- No lint config change and no new log line: `no-console` is already an error in all of `src` (`noConsoleConfig`, lessons.md:33-38, superseding the `gearConfig` lesson), so the new modules are covered and `ALLOWED_DISABLES` is unchanged.
- No change to the ranking penalty or to `LOG_PENALTY_MIN_RATING`.

## Implementation Approach

The work runs bottom-up in three phases:

1. Make the seen data exact and richer: a paginated read, `firstNight`, an optional cut-off, and a pure progress model.
2. Surface the mark on Tonight.
3. Build the page.

The pure layers come first, so they can be driven test-first with hand-written expectations. Per test-plan §6.3 the tests feed raw log entries through the real rule, never a hand-built seen map, so a rating or night case can actually fail.

**Decisions delegated to the agent** (non-UI; the user asked for questions on UI decisions only; recorded in the brief):

- Paginate the existing read instead of adding an SQL aggregate.
- Rename it `listSeenEntries`.
- Put the pure progress model in `src/lib/progress/`.
- Keep three phases.

## Critical Implementation Details

- **Pagination needs a total order.** `night desc, target asc` has ties (two entries for the same object on the same night), so pages need `id asc` as the final key, or a row can be skipped or repeated across pages. Ordering by `id` does not require selecting it; keep the select `target, night, rating` (the db test compares those objects exactly). The page size is 1000 (`max_rows`, `supabase/config.toml:18`), and the loop ends only on an **empty** page, so a lower hosted `max_rows` still reads everything (plan review F6).
- **The tooltip button lives only where interactive content is valid.** Never place it inside `Tile`'s `<a>` or `ObjectRow`'s `<summary>`. Those surfaces get the static variant with an `sr-only` label. The legend line renders only when at least one row there is not seen. Inside the tile the `sr-only` text is masked by the link's `aria-labelledby` (heading + "Open Targets"), which also leaves the row names unannounced today; that is accepted, and the tile's name stays unchanged.
- **Only the icon button goes inside an `<h3>`** (user decision, plan review F2). The tooltip renders outside the heading, and the name sits in its own `<span data-target-name>`. `tests/e2e/planets-on-tonight.spec.ts:41-45` reads the h3's `textContent` and is changed to read that span. The heading's accessible name gains "Not seen yet" while the mark shows; that is intended.
- **The tooltip is one state, driven by one script** (plan review F3):
  - `data-open` on the mark's wrapper, set by a delegated `<script>` in `NotSeenMark.astro`. The precedent is `GearCard.astro:82-97`, a component script inside a `server:defer` island; offline copies already pick up its `/_astro` chunk (`copies.ts:209-213`).
  - A click on the button toggles it. Esc and a pointerdown outside close it.
  - Hover and `:focus-visible` open it only under `@media (hover: hover)`, so a tap never leaves a stuck `:hover`.
  - Closed means `hidden` (display none). An `invisible` tooltip would still widen `scrollWidth` at 320 px, and `tonight-phone.spec.ts` (fresh user, every mark present) would fail.
  - The tooltip is positioned against the card's `li` (`relative`, full width under the heading), not against the icon, so a wrapped name at 320 px never pushes it off-screen. No arbitrary values.
  - The script holds no `console`: `.astro` client scripts are not linted.

## Phase 1: Exact seen data and the progress model

### Overview

Make the seen read exact past 1000 entries, add the first night to the shared summary, and add a pure progress model that both the page and S-06 can use.

### Changes Required:

#### 1. Paginated seen read

**File**: `src/lib/observations/store.ts`

**Intent**: Replace the single capped read with a paged read, so a checklist and the "not seen yet" mark never lose objects seen only on old nights. Rename it, since it now serves progress as well as the ranking.

**Contract**:
- `listForRanking` becomes `listSeenEntries(client): Promise<LogEntry[]>`. It keeps the same filter (`rating >= LOG_PENALTY_MIN_RATING`), the same select (`target, night, rating`) and the same order (`night desc`, `target asc`), plus `id asc`.
- It reads pages of `SEEN_PAGE_SIZE = 1000` via `.range` until a page comes back empty.
- Errors still throw `LOAD_FAILED`.
- Update the callers: `src/lib/tonight/load.ts:115` and `src/lib/tonight/load.test.ts:37`.

#### 2. db test for the paged read

**File**: `tests/db/observations.test.ts`

**Intent**: Rename the existing `listForRanking` cases. Add one case that seeds more than one page of qualifying entries and proves none is lost.

**Contract**:
- The new case seeds entries rated ≥ 3 so that a capped read would visibly lose objects: `M1`–`M100` × 11 newer nights (1,100 rows), plus `M101`–`M110` only on one older night. It uses a few bulk inserts with the user's client (precedent `tests/db/observations.test.ts:500-505`).
- It expects `listSeenEntries` to return all 1,110 entries, including the ten `M101`–`M110` rows that a single capped read would drop.
- It also seeds 1-2 rated rows and expects them absent.

#### 3. First night and an optional cut-off

**File**: `src/lib/engine/log.ts` (+ `log.test.ts`)

**Intent**: Add the earliest qualifying night to `SeenSummary` for the firsts and the seen list (and later S-06). Let the progress page ask for "ever", without a fake date.

**Contract**:
- `SeenSummary` becomes `{ count, firstNight, lastNight }`.
- `seenSummaries(entries, onOrBefore?: string)`: when `onOrBefore` is omitted, no night is excluded.
- Tonight's call (`build.ts:717`) is unchanged.
- The required field also breaks tests that build or compare summaries (plan review F1). Update them in this phase:
  - `src/lib/engine/log.test.ts:25,33,42,63,64`;
  - `src/lib/engine/ranking.test.ts:281,312,319` (hand-built maps);
  - `src/lib/tonight/format.test.ts:37` (`seenLine` input);
  - `src/lib/targets/index.test.ts:44`, `src/lib/engine/moon-target.test.ts:166` and `src/lib/engine/planet-ranking.test.ts:208` (`toEqual` on `seenSummaries` output).

#### 3a. Short date export

**File**: `src/lib/tonight/format.ts` (+ `format.test.ts`)

**Intent**: The firsts and the seen list show a compact date ("12 Sept 2026" / "12 wrz 2026"). That format is private to `seenLine` today (`format.ts:197`), and `formatNightDate` gives the long weekday form, too long for a 320 px row (plan review F7).

**Contract**: `createFormatter(locale).formatShortDate(night: string)`, the existing `shortDateFormat` over a `YYYY-MM-DD` read in UTC, as `seenLine` does; `seenLine` uses it.

#### 4. Pure progress model

**File**: `src/lib/progress/progress.ts` (new; + `progress.test.ts`)

**Intent**: Turn the log into what the page shows: two checklists in catalogue order and the firsts. It is one pure function that owns the whole rule, from entries to ticks (plan review F4), so counts are testable and S-06 can derive milestones from it.

**Contract**:
- `observingProgress(entries: readonly LogEntry[]): ObservingProgress`. It calls `seenSummaries(entries)` itself, with no cut-off.
- `ObservingProgress` is `{ messier: Checklist; caldwell: Checklist; firsts: First[] }`.
  - `Checklist` is `{ total, seenCount, items: { id, number, label, commonName, type, seen: SeenSummary | null }[] }`.
    - `commonName` is the catalogue's English name; the page localises it with `localCommonName` (plan review F7).
    - `type` is the catalogue's `DeepSkyType`, for S-06's "first galaxy" and similar milestones (plan review F9).
    - Messier: items by Messier number, `number` = M number.
    - Caldwell: items by Caldwell number, `number` = C number.
    - `total` is `items.length` (110 and 61).
  - `First` is `{ key, firstNight: string | null }` for the seven planet keys in solar order, then `moon`.
- Keys that are in neither list are ignored.
- The module imports the catalogue (server-only), the engine barrel (`seenSummaries`, `LogEntry`) and `@/lib/targets` (`PLANET_TARGET_KEYS`, `MOON_TARGET_KEY`; the engine barrel has no Moon key). It has no I/O.

**Tests:** raw `LogEntry[]` inputs with hand-written expectations, covering:
- a rated-2-only object stays unticked (the PRD invariant, `prd.md:579`);
- two entries on one night count once;
- `firstNight` is the earliest of several nights;
- an unknown key is ignored;
- the counts match the hand-listed fixtures;
- removing the only qualifying entry from the input unticks the object, which is how re-rating and deleting reach the page.

### Success Criteria:

#### Automated Verification:

- `src/lib/progress/progress.test.ts` and `src/lib/engine/log.test.ts` pass under `npm test`, including a rated-1-2-never-ticks case
- `tests/db/observations.test.ts` passes under `npm run test:db` against local Supabase, including the 1,100-entry paging case
- `npx astro check`, `npm run lint` and the full `npm test` pass

**Implementation Note**: The phase is driven test-first (`/10x-tdd`). `npm run test:db` uses the shared local Supabase: it creates test users and does not migrate or reset. Confirm the stack is up with the orchestrator before running it, and see "Running the checks" below.

---

## Running the checks

(plan review F5) The worktree is not set up yet, and Playwright has no `webServer`. Every check runs this way:

1. **Install:** `npm ci` in the worktree, with the `nvm use` prefix.
2. **Env** (orchestrator, 2026-10-09):
   - Build the worktree's own `.env` / `.dev.vars` from `npx supabase status -o env` of the shared local stack, in CI's shape: `SUPABASE_URL`, `SUPABASE_KEY` and `FORECAST_BASE_URL=http://127.0.0.1:4400` (`.github/workflows/ci.yml:58-63`).
   - Never copy them from the main checkout, never print their values in logs, and never point e2e at the hosted project: the specs sign up real users.
   - The local stack may be used for builds, `test:db` and e2e, but never reset and never migrated.
3. **Ports** (agreed with the orchestrator): the forecast fixture on 4400, the preview on 4331. Never 4329.
4. **Order:**
   1. Start `node tests/e2e/forecast-fixture.mjs`.
   2. Run `npm run build`; it is needed again after every code change, because preview serves `dist`.
   3. Start `npm run preview -- --port 4331`.
   4. Run `BASE_URL=http://localhost:4331 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test <spec>`.
5. **db suite:** `npm run test:db -- tests/db/observations.test.ts`, with the local stack's `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SECRET_KEY` and `DB_URL` in the shell only.
6. **Evidence:** screenshots go to `context/changes/observing-progress/evidence/` (plan review F9).

---

## Phase 2: "Not seen yet" on Tonight

### Overview

Flag every Tonight target the user has never logged with a rating of 3 or above, and show the Sparkles mark: a tooltip button on the cards, and static icons plus a legend line in the tile and the collapsed rows.

### Changes Required:

#### 1. View-model flag

**File**: `src/lib/tonight/build.ts` (+ `build.test.ts`)

**Intent**: Expose the seen state as data, not as the absence of a display string.

**Contract**:
- Add `notSeenYet: boolean` to `TonightEntry`, `TonightPlanetEntry` and `TonightMoonEntry`.
- Set it to `entry.seen === null` beside `seenText` at `:763`, `:844` and `:900`.
- `summaryTargets` carries it through.
- Update the `/design` fixtures (`src/pages/design.astro:366,417`) and any other typed fixtures.

#### 2. The mark component

**File**: `src/components/tonight/NotSeenMark.astro` (new)

**Intent**: One markup for the mark wherever it shows, in two variants.

**Contract**: Props `{ variant: "tip" | "static"; id?: string; open?: boolean }`. `open` renders the tooltip open, for the `/design` specimen and the screenshots.

- **`tip`:**
  - a `type="button"` with `aria-label` = `tonight.object.notSeen.label` ("Not seen yet") and a lucide `Sparkles` icon (`aria-hidden`);
  - at least a 24 px target;
  - a tooltip with `tonight.object.notSeen.legend` ("Not seen yet: you haven't logged it with a rating of 3 or above");
  - its mechanics follow "Critical Implementation Details": one `data-open` state, a delegated script, hover only under `@media (hover: hover)`, closed = `hidden`, positioned against the card's `li`;
  - since the button sits in an `<h3>` and the tooltip must not, the component exposes the button and the tooltip as two parts (two slots or two small components) that the card places separately;
  - the button carries `aria-describedby` to the tooltip.
- **`static`:** the icon (`aria-hidden`) plus an `sr-only` label.
- **Styling:**
  - colour from tokens only, at least 3:1 for the icon on every theme (`contrast.test.ts` rows if a token is added);
  - red mode tells the mark apart by shape, not hue.
- **`/design`:** it gets a specimen block for both variants across the 7-state matrix (N/A with reasons where a state doesn't apply).

#### 3. Surfaces

**Files**: `src/components/tonight/ObjectCard.astro`, `PlanetCard.astro`, `MoonCard.astro`, `ObjectRow.astro`, `TonightTiles.astro`, `TargetsPageContent.astro`, `TonightSkeleton.astro`, `tests/e2e/planets-on-tonight.spec.ts`

**Intent**: Put the mark next to the name on every target surface the user chose, with the legend where a button is not allowed.

**Contract**:
- **Cards** (user decision, plan review F2):
  - `ObjectCard` and `PlanetCard` wrap the name in `<span data-target-name>`. They put only the mark's button inside the `<h3>`, after the name, and render its tooltip after the heading.
  - `MoonCard` shows no visible Moon name (`MoonCard.astro:57-60`). When `card.target` exists, it puts the mark (button and tooltip) in the slot `SeenTag` uses: `seenText ? <SeenTag/> : <NotSeenMark/>`, since the two are mutually exclusive.
  - Each card passes a unique `id`.
  - `planets-on-tonight.spec.ts:41-45` reads the name from `[data-target-name]` instead of the h3's `textContent`.
- **The "show the other N" list:**
  - `ObjectRow` renders `variant="static"` after the label inside `<summary>`.
  - `TargetsPageContent` adds one muted legend line (icon + `tonight.object.notSeen.legendShort`) above the rest list's scroll region, rendered only when any `rest` entry is `notSeenYet`.
- **The "Point here first" tile:**
  - `TonightTiles` carries `notSeenYet` in its `targets` map and renders `variant="static"` after each row's name.
  - Under the rows, one muted legend line when any row is not seen.
  - `TonightSkeleton.astro:69-80` mirrors the tile row by row "so nothing jumps", so it gains a `text-label` bar for the legend line (plan review F9).
- Keep the `data-object` / `data-label` attributes and the tile's `aria-labelledby` unchanged.

#### 4. Copy

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: The mark's label, tooltip and short legend in both languages.

**Contract**: `tonight.object.notSeen.{label, legend, legendShort}`. The PL copy wraps at 320 px and does not inflect by the object's gender: the targets mix genders (galaktyka, Jowisz, Wenus), and PL "Widziany" (`pl.ts:502`) is masculine (plan review F7).

#### 5. e2e

**File**: `tests/e2e/observing-progress.spec.ts` (new; the Tonight half)

**Intent**: Prove the mark follows the log in the browser. The spec onboards in Madrid on the all-clear fixture, as `observation-log.spec.ts` does.

**Contract** (plan review F8):
1. A fresh user sees the mark on the first Targets card. The spec records its `data-object` key.
2. Its tooltip text appears on keyboard Tab focus, not a programmatic `.focus()`.
3. Logging that object rated 2 keeps the mark.
4. Editing the entry to 4 removes the mark and shows the seen tag. The spec finds the row again by `li[data-object="<key>"]`, because the penalty can move it into "show the other N".
5. In a `hasTouch` context, a tap opens the tooltip, a second tap or Esc closes it, and a tap outside closes it.

Expected copy is read from the catalogue (`en.tonight.object.notSeen.*`), not hard-coded.

### Success Criteria:

#### Automated Verification:

- `src/lib/tonight/build.test.ts` asserts `notSeenYet` is true for an unlogged object, planet and Moon, false after a rating ≥ 3, and true with only a rating ≤ 2
- `tests/e2e/observing-progress.spec.ts` Tonight cases pass (`npx playwright test observing-progress`)
- `tests/e2e/tonight-phone.spec.ts`, `tonight-targets.spec.ts`, `tonight-dashboard.spec.ts`, `observation-log.spec.ts`, `planets-on-tonight.spec.ts` and `moon-as-target.spec.ts` still pass
- `npx astro check`, `npm run lint`, `npm test` (incl. i18n parity, `no-hardcoded-colors`, `red-theme`, `contrast`) pass
- `tests/e2e/observing-progress.spec.ts` touch case passes: a tap opens the tooltip, a second tap, Esc or an outside tap closes it

#### Manual Verification:

- Screenshots of `/tonight` (tile), `/tonight/targets` (card with tooltip open, rest list with legend), `/tonight/planets` and `/tonight/moon` in EN/PL × dark/light/red at 390 px and desktop: the mark reads next to the name, the tooltip stays on screen at 320-390 px, red mode tells the mark apart
- The tooltip opens on mouse hover, on keyboard Tab focus and on a touch tap (Playwright touch emulation), and closes on Esc

**Implementation Note**: The agent captures the screenshots on a local preview against local Supabase, following "Running the checks", into `evidence/`. Port 4329 is never used.

---

## Phase 3: The progress page

### Overview

Add `/log/progress` with the firsts and the two checklists, linked from `/log`'s header.

### Changes Required:

#### 1. Page

**File**: `src/pages/log/progress.astro` (new)

**Intent**: Render the user's progress from the seen read, composed like `/log/sky`.

**Contract**:
- **Data:** `observationStore.listSeenEntries(supabase)`, then `seenSummaries(entries)` (no cut-off), then `observingProgress`.
- **Shell:**
  - `GearShell`;
  - header slot: `BackLink` to `/log` + `PageHeader` (`progress.title`, and `progress.intro` stating that entries rated 3 or above count);
  - then `DatabaseMissing`, or a load error as `ServerError` with `errors.load.observations`.
- **Bands:**
  - "Firsts": a `divide-y` list of 8 rows, each with the name (`targetLabel(key, locale).id`, which is the display name for planets and the Moon) and "first seen <date>" (`createFormatter(locale).formatShortDate`, Phase 1 §3a) or `progress.notYet`.
  - Object names on the page go through `localCommonName(id, commonName, locale)` (plan review F7).
  - "Messier" and "Caldwell": each band's heading carries the count (`progress.count`, numbers pre-formatted). Caldwell's band adds `progress.caldwellNote`.
- **Empty log:** all three bands still render (0 / 110), plus a `progress.empty` line linking to `/tonight`. There is no primary action on the page; the link is `action` / inline.

#### 2. Checklist components

**Files**: `src/components/progress/ChecklistGrid.astro`, `src/components/progress/SeenList.astro` (new)

**Intent**: The grid shows the whole list at a glance. The list names what has been seen, with dates.

**Contract**:
- **`ChecklistGrid`** takes `{ items, prefix: "M" | "C", label }`:
  - a `<ul>` grid, `grid-cols-6 sm:grid-cols-10` with no arbitrary values, of chips showing `prefix + number` in `font-mono text-label`;
  - a seen chip is filled from a token pair that `contrast.test.ts` already pins (e.g. `selected` / `selected-foreground`), with a lucide `Check` (`aria-hidden`) as a corner badge or stacked under the number, never inline, so "M110" plus the icon fits a 320 px cell (plan review F9);
  - each chip has `sr-only` text: label, localised common name, then "seen" or "not seen", in gender-neutral PL;
  - each chip carries `data-checklist-item={id}` and `data-seen` for e2e (plan review F8);
  - red mode tells seen apart by fill + icon.
- **`SeenList`** takes the seen items: a `divide-y` list in catalogue order, each row "M31 · Andromeda Galaxy · first seen 12 Sept 2026" (localised name, `formatShortDate`).
- Both are shared components with `/design` specimens (7-state matrix, N/A with reasons).

#### 3. Entry point and copy

**Files**: `src/pages/log/index.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `src/lib/observations/redirect.ts`

**Intent**: Reach the page from `/log`'s header, the way Sky checks is reached.

**Contract**:
- Add an `action` link (`buttonVariants({ variant: "action", size: "sm" })`, lucide `Award`, `aria-hidden`) labelled `log.list.progress` before "Sky checks".
- Add a `PROGRESS_PAGE = "/log/progress"` constant next to `LOG_LIST` (`src/lib/observations/redirect.ts:10`). This deliberately departs from `SKY_CHECKS_PAGE`, which lives in `src/lib/sky-checks/redirect.ts:5`: progress is a view of the observation log itself.
- New keys: `log.list.progress` and `progress.{title, intro, firsts, firstSeen, notYet, messier, caldwell, count, caldwellNote, seenHeading, seen, notSeen, empty}` in EN and PL.

#### 4. e2e and docs

**Files**: `tests/e2e/observing-progress.spec.ts`, `tests/e2e/tonight-phone.spec.ts`, `CLAUDE.md`

**Intent**: Pin the page's behaviour and phone width, and document the slice for the next agent.

**Contract**:
- **The page half of `observing-progress.spec.ts`:**
  1. `/log` → "Progress" opens the page with "0 / 110".
  2. Logging the fixed key `M31` (`/log/new?object=M31&from=log`) rated 2 leaves the count at 0 and `[data-checklist-item="M31"]` without `data-seen`. A first Targets row could be a Caldwell object on the real clock (plan review F8).
  3. Re-rating it to 4 makes it 1, ticks its chip and lists it under seen.
  4. Logging Jupiter rated 3 shows its first-seen date. The spec reads the night from the form's `#night` and formats it with the same `createFormatter(...).formatShortDate`.
  5. Deleting the entry returns the count to 0.
- US-06's "re-rating to 1-2 brings the mark back" on Tonight is covered by the unit and db cases (live read), not by a separate e2e step. This keeps the e2e modest.
- **Phone width:** add `/log/progress` to `APP_PAGES` (`tests/e2e/tonight-phone.spec.ts:42`).
- **`CLAUDE.md`:** a short paragraph on `src/lib/progress/`, `listSeenEntries` (paged; one rule with the ranking), `NotSeenMark` and `/log/progress`.

### Success Criteria:

#### Automated Verification:

- `tests/e2e/observing-progress.spec.ts` page cases pass, including rating 2 never ticking and deletion unticking
- `tests/e2e/tonight-phone.spec.ts` passes with `/log/progress` in `APP_PAGES` (no sideways scroll at 320/375 px in EN and PL)
- `npx astro check`, `npm run lint`, `npm test` and `npm run build` pass

#### Manual Verification:

- Screenshots of `/log/progress` (empty log and a log with several seen objects) and `/log`'s header in EN/PL × dark/light/red at 390 px and desktop: grid chips legible, seen chips distinguishable in red mode, the Caldwell note present, at most one primary action
- The `/design` specimens for `NotSeenMark`, `ChecklistGrid` and `SeenList` render in all themes

**Implementation Note**: Screenshots as in Phase 2. After this phase, `/10x-impl-review` runs with Opus reviewers.

---

## Testing Strategy

### Unit Tests:

- `log.test.ts`: `firstNight`, the omitted cut-off, and the unchanged behaviour with a cut-off.
- `progress.test.ts`: counts, catalogue order, 1-2 ratings never tick, one count per night, the earliest first night, unknown keys ignored, and the totals 110 / 61. Every expectation is hand-written.
- `build.test.ts`: `notSeenYet` for an object, a planet and the Moon, across ratings.
- `load.test.ts`: the mock renamed to `listSeenEntries`.

### Integration Tests:

- `tests/db/observations.test.ts`: the paged read returns 1,100 qualifying entries, excludes 1-2 ratings, and stays isolated per user (existing isolation cases).
- e2e `observing-progress.spec.ts`: the mark and the page follow create, re-rate and delete in the browser.

### Manual Testing Steps:

1. On a fresh account, open `/tonight/targets`: every card shows ✦. Hover, Tab and tap each show the legend.
2. Log the first target rated 2, then re-rate it to 4. Check the mark on Targets and the counts on `/log/progress` after each step.
3. Check the dashboard tile and the "show the other N" list with their legend lines at 390 px in PL.
4. Check `/log/progress` in red mode: the seen and unseen chips differ by fill and icon.

## Performance Considerations

- The paged read adds round-trips only past 1,000 qualifying entries.
- `observingProgress` is linear over 179 catalogue keys.
- Tonight's cost is unchanged: one boolean per entry.

## Migration Notes

None. No schema change, and nothing to backfill. The rename of `listForRanking` is internal.

## References

- Research: `context/changes/observing-progress/research.md`
- PRD: `context/foundation/prd.md:191-203,449-450,579`
- Roadmap: `context/foundation/roadmap.md:50,150-160`
- Seen rule: `src/lib/engine/log.ts:32-49`
- Sub-page precedent: `src/pages/log/sky.astro`
- Lessons: `context/foundation/lessons.md:12-18,20-24`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Exact seen data and the progress model

#### Automated

- [x] 1.1 `src/lib/progress/progress.test.ts` and `src/lib/engine/log.test.ts` pass under `npm test`, including a rated-1-2-never-ticks case — 44c69e0
- [x] 1.2 `tests/db/observations.test.ts` passes under `npm run test:db` against local Supabase, including the 1,100-entry paging case — 44c69e0
- [x] 1.3 `npx astro check`, `npm run lint` and the full `npm test` pass — 44c69e0

### Phase 2: "Not seen yet" on Tonight

#### Automated

- [x] 2.1 `src/lib/tonight/build.test.ts` asserts `notSeenYet` is true for an unlogged object, planet and Moon, false after a rating ≥ 3, and true with only a rating ≤ 2 — 68958b8
- [x] 2.2 `tests/e2e/observing-progress.spec.ts` Tonight cases pass (`npx playwright test observing-progress`) — 68958b8
- [x] 2.3 `tests/e2e/tonight-phone.spec.ts`, `tonight-targets.spec.ts`, `tonight-dashboard.spec.ts`, `observation-log.spec.ts`, `planets-on-tonight.spec.ts` and `moon-as-target.spec.ts` still pass — 68958b8
- [x] 2.4 `npx astro check`, `npm run lint`, `npm test` (incl. i18n parity, `no-hardcoded-colors`, `red-theme`, `contrast`) pass — 68958b8

#### Manual

- [x] 2.5 Screenshots of `/tonight` (tile), `/tonight/targets` (card with tooltip open, rest list with legend), `/tonight/planets` and `/tonight/moon` in EN/PL × dark/light/red at 390 px and desktop: the mark reads next to the name, the tooltip stays on screen at 320-390 px, red mode tells the mark apart
- [x] 2.6 The tooltip opens on mouse hover, on keyboard Tab focus and on a touch tap (Playwright touch emulation), and closes on Esc

#### Automated (added by plan review)

- [x] 2.7 `tests/e2e/observing-progress.spec.ts` touch case passes: a tap opens the tooltip, a second tap, Esc or an outside tap closes it — 68958b8

### Phase 3: The progress page

#### Automated

- [x] 3.1 `tests/e2e/observing-progress.spec.ts` page cases pass, including rating 2 never ticking and deletion unticking — 6828bfe
- [x] 3.2 `tests/e2e/tonight-phone.spec.ts` passes with `/log/progress` in `APP_PAGES` (no sideways scroll at 320/375 px in EN and PL) — 6828bfe
- [x] 3.3 `npx astro check`, `npm run lint`, `npm test` and `npm run build` pass — 6828bfe

#### Manual

- [x] 3.4 Screenshots of `/log/progress` (empty log and a log with several seen objects) and `/log`'s header in EN/PL × dark/light/red at 390 px and desktop: grid chips legible, seen chips distinguishable in red mode, the Caldwell note present, at most one primary action
- [x] 3.5 The `/design` specimens for `NotSeenMark`, `ChecklistGrid` and `SeenList` render in all themes
