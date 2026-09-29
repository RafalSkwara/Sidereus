# All Tonight's Objects Implementation Plan

## Overview

Tonight shows the top 5 of the objects that cleared the bar ("18 objects cleared the bar tonight"). This change adds a page, `/tonight/all`, listing **every** object that cleared, for the same night, site and telescope Tonight shows:
- One compact row per object that expands into its full details.
- Ranked by default, with a switch to order by best time.

Tonight links to it from the heading line and with a button under its top 5, only when more than 5 cleared.

## Current State Analysis

- `src/lib/engine/ranking.ts:142-186` `rankObjects` scores every catalogue object and keeps the cleared ones (`score.total >= MIN_OBJECT_SCORE`) in rank order. It then keeps only the first `MAX_RANKED_OBJECTS` (5, `parameters.ts:68`) for entries with an eyepiece pair and reasons. `reasonComponents` compares each listed entry against the mean of the **listed** set. `clearedCount` counts all cleared objects.
- `src/lib/tonight/build.ts:179-290` `buildTonight(input, locale)` turns the ranking into `TonightRanking { clearedCount, clearedText, entries }`. `TonightEntry` carries `bestTime` only as a formatted `HH:mm` string, which can't be sorted across midnight.
- `src/components/tonight/TonightContent.astro` is the server island.
  - It loads the user's sites, telescopes, eyepieces and log (`load()` helper), resolves the requested site/telescope (`chooseOwned`), fetches the forecast (`getForecast` + `kvForecastCache`), calls `buildTonight` and renders the verdict, ranking (`ObjectCard` × 5) and night strip.
  - It guards itself: signed out, it renders nothing.
- `src/pages/tonight.astro` is the shell. It resolves `?site=` / `?telescope=` or the remembered cookies (`requestedGear`, which sets the cookie from a query) and passes ids to the island.
- `src/components/tonight/ObjectCard.astro` has the card layout: rank, name, constellation, seen tag, window, best, eyepiece pair, reason, "Mark observed".
- Gating: `PROTECTED_ROUTES` includes `/tonight`, which covers `/tonight/all` on whole segments (`src/lib/protected-routes.ts`).
- Lessons:
  1. Coordinate lint: `src/pages/tonight/**` is **not** in `gearConfig.files` (`eslint.config.js:85-98`; only `src/pages/tonight.astro` is), and the new page must be added.
  2. Tonight's content needs JavaScript. The new page's content is also a server island, so no no-JS promises.
  3. Per-user list queries: unchanged (the same store calls).

## Desired End State

- **Links on Tonight** (only when `clearedCount > entries.length`): the ranking heading reads "18 objects cleared the bar tonight" followed by a "See all →" link, and a full-width secondary button "See all 18 objects →" sits under the 5th card. Both go to `/tonight/all`, keeping the site and telescope in effect.
- **Header of `/tonight/all`:** "← Tonight" back link, a kicker with the night's date, the title "All 18 objects", and a context line with site · telescope.
- **The sort switch** has "By rank" / "By best time" (a `?sort=time` link, current one marked) with an explanation line.
- **Each row:** rank · M-number · common name · best time + direction (and the seen tag if logged), with an expand chevron. Expanded, the row shows the window, eyepiece pair, reason line and "Mark observed" (same log link as Tonight).
- **"By best time"** orders by each object's peak instant; ties keep rank order. Rank numbers stay each object's rank, so the time order shows e.g. "7 · M13 · 21:40".
- **No-go / no-darkness / nothing cleared:** the page says so (same verdict wording) with the back link; no error page.
- **Consistency:** the same night, site, telescope, forecast and log as Tonight give the same order and the same `clearedCount` (determinism NFR).

### Key Discoveries:

- Returning more entries is an opt-in `limit` on `rankObjects`, with the default staying 5 so Tonight is byte-identical.
- Reasons on the all page are computed against the mean of **all** listed objects, which is what "sets it apart tonight" means on that page. The top 5 there may therefore lead with a different reason than on Tonight, where the comparison set is 5. Recorded as delegated.
- Best-time sorting needs the peak instant, so `TonightEntry` gains `bestAt` (epoch ms).

## What We're NOT Doing

- Filters (by type, constellation, altitude) or search.
- Pagination: even the worst case (~110 cleared) is a few screens of compact rows.
- Changing Tonight's top-5 cards or the ranking itself.
- A no-JS path for the page (lesson 2).
- Persisting the sort choice.

## Implementation Approach

Three phases:
1. **Data (test-first):** the engine limit, `bestAt`, a pure sort helper, and a shared loader so both islands load data the same way.
2. **The page.**
3. **The links from Tonight**, an e2e spec and the visual checks.

Delegated decisions (agent; open to challenge in plan review):
- Route `/tonight/all`; sort via `?sort=rank|time` (default rank), resolved in the shell and passed to the island as a prop, like the site/telescope ids.
- The shell reads the remembered site/telescope cookies (and passes through `?site=`/`?telescope=` like Tonight), so both pages always show the same setup.
- Rows use native `<details>/<summary>` (accessible, no script needed for expanding).
- Extract Tonight's data loading into `src/lib/tonight/load.ts` (`loadTonight`) used by both islands, instead of copying about 60 lines.
- Reasons on the all page are computed over the full cleared list (see Key Discoveries).
- Copy under `tonight.all.*`; counts pluralised with `plural()`.

## Phase 1: Ranking data for every cleared object

### Changes Required:

#### 1. Engine limit

**File**: `src/lib/engine/ranking.ts`, `src/lib/engine/ranking.test.ts`

**Intent**: The ranking can return details for every cleared object instead of only the first five.

**Contract**: `RankInput` gains `limit?: number`. The default is `MAX_RANKED_OBJECTS`; `Infinity` means all cleared. `entries = cleared.slice(0, limit)`, and reasons are computed over those entries. Tests:
- The default still returns ≤ 5 entries.
- `limit: Infinity` returns `clearedCount` entries in the same order, whose first 5 are the same objects as the default.
- The same input gives the same output twice.

#### 2. Best-time instant and sort

**File**: `src/lib/tonight/build.ts`, `src/lib/tonight/all-objects.ts` (new), `src/lib/tonight/all-objects.test.ts` (new)

**Intent**: The page can order rows by when each object is best placed, correctly across midnight.

**Contract**:
- `TonightEntry` gains `rank: number` (1-based) and `bestAt: number` (peak instant, epoch ms).
- `buildTonight(input, locale, options?: { limit?: number })` passes the limit through.
- `sortEntries(entries, "rank" | "time")` returns a new array: rank order, or `bestAt` ascending with ties by rank.
- `parseSort(value: string | null): "rank" | "time"` gives `"time"` only for `"time"`.
- Tests cover a list crossing midnight (21:40, 23:16, 02:25) and ties.

#### 3. Shared loader

**File**: `src/lib/tonight/load.ts` (new), `src/components/tonight/TonightContent.astro`

**Intent**: Both islands load the user's gear, log and forecast the same way.

**Contract**: `loadTonight({ supabase, locale, siteId, telescopeId, now, limit? })` returns everything `TonightContent` computes today: the lists, per-list errors, chosen site/telescope, selector kinds and `view: TonightView | null` or its failure key. `TonightContent.astro` uses it with no change to its output.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new ranking and all-objects tests: `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- The existing Tonight e2e specs still pass on a local preview: `BASE_URL=http://localhost:4321 npx playwright test observation-log seven-night-planner telescope-selector onboarding`

#### Manual Verification:

- Tonight renders the same top 5 before and after (same order and texts) for the same user and night.

---

## Phase 2: The all-objects page

### Changes Required:

#### 1. Page shell

**File**: `src/pages/tonight/all.astro` (new), `eslint.config.js`

**Intent**: A gated page that resolves the same site/telescope as Tonight and the requested sort, and defers the data to an island.

**Contract**: `GearShell` with the title `tonight.all.title`. The page reads site/telescope like `tonight.astro` (query first, then the remembered cookie) and parses `?sort`. It renders `<AllObjectsContent server:defer siteId telescopeId sort>` with a skeleton fallback. `src/pages/tonight/**` is added to `gearConfig.files`.

#### 2. Content island and rows

**File**: `src/components/tonight/AllObjectsContent.astro` (new), `src/components/tonight/ObjectRow.astro` (new)

**Intent**: Show every cleared object as compact expandable rows with the sort switch and context.

**Contract**:
- The island calls `loadTonight(..., { limit: Infinity })`.
- With a ranking, it renders:
  - the header (back link, date kicker, title with count, site · telescope)
  - the sort switch (two links carrying `?sort=`, `aria-current` on the active one)
  - `<ul>` of `ObjectRow` in `sortEntries(entries, sort)` order
- Without a ranking, it renders the verdict's own explanation text and the back link.
- `ObjectRow`: `<details>` whose `<summary>` shows rank, id, localised common name, best time + direction and the seen tag. The body shows the window, pair (when present), reason and a "Mark observed" link built exactly like Tonight's `logHref`. Each row carries `data-best-at={entry.bestAt}` so tests can check the time order without parsing `HH:mm` across midnight.
- Token colours only; copy from the catalogue.

#### 3. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Contract**: `tonight.all.{ title (count, plural), back, sortLabel, byRank, byTime, sortHintRank, sortHintTime, seeAll, seeAllCount (count), empty }`, in EN and PL.

### Success Criteria:

#### Automated Verification:

- Unit tests pass (i18n parity): `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- `/tonight/all` for a go night lists `clearedCount` rows, the first 5 the same objects as Tonight in the same order, and "By best time" orders them chronologically across midnight. Rows expand, and "Mark observed" opens the prefilled log form.
- A no-go night (forecast fixture switched to overcast) shows the explanation and the back link.

---

## Phase 3: Links from Tonight and verification

### Changes Required:

#### 1. Links

**File**: `src/components/tonight/TonightContent.astro`

**Intent**: Reach the page from both ends of Tonight's list, only when there is more to see.

**Contract**: when `view.ranking.clearedCount > view.ranking.entries.length`, the heading gets an inline "See all →" link, and a full-width secondary button "See all N objects →" goes under the list. Both use `href="/tonight/all"`.

#### 2. E2E spec

**File**: `tests/e2e/tonight-all-objects.spec.ts` (new)

**Intent**: Pin the flow with the all-clear forecast fixture.

**Contract**: onboard in Madrid, then:
1. Tonight shows both links when more than 5 cleared.
2. The button opens `/tonight/all` with the count in the title.
3. The row count equals the count.
4. The first 5 rows name the same objects as Tonight's cards.
5. "By best time" reorders so that the rows' `data-best-at` values ascend.
6. Expanding a row shows "Mark observed", which opens the log form for that object.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- Full e2e suite passes in parallel: `BASE_URL=http://localhost:4321 npx playwright test --workers 5`

#### Manual Verification:

- Screenshots of Tonight's links and `/tonight/all` (collapsed, one row expanded, by time) at 390 and 1280 px in EN/PL and dark/light/red: no horizontal overflow; the red pixel audit passes.
- The user reviews the page.

---

## Testing Strategy

### Unit Tests:

- `rankObjects` with and without `limit`: default unchanged, full list consistent with the top 5, deterministic.
- `sortEntries` (rank; time across midnight; ties) and `parseSort`.
- i18n parity for `tonight.all.*`.

### Integration Tests:

- `tonight-all-objects.spec.ts` (above); the existing Tonight specs guard the loader refactor.

### Manual Testing Steps:

1. Local preview + local Supabase + forecast fixture; onboard in Madrid.
2. Tonight → both links → the page; sort, expand, Mark observed.
3. Switch the fixture to overcast: the page shows the no-go explanation.
4. Screenshot matrix, overflow and red audits.

## Performance Considerations

The page recomputes the ranking on its own request (the user chose a separate page), as Tonight does. Scoring already covers the whole catalogue, and the extra work is eyepiece pairing and reasons for up to about 50 objects plus rendering compact rows. The CPU risk is tracked in #22.

## Migration Notes

None. No database change.

## References

- Engine ranking: `src/lib/engine/ranking.ts:90-186`; view: `src/lib/tonight/build.ts:55-290`
- Island and shell: `src/components/tonight/TonightContent.astro`, `src/pages/tonight.astro`
- Lessons: `context/foundation/lessons.md` (coordinate lint scope; Tonight needs JS)
- CPU watch: GitHub #22

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Ranking data for every cleared object

#### Automated

- [x] 1.1 Unit tests pass, including the new ranking and all-objects tests — 08f01a8
- [x] 1.2 Type check passes — 08f01a8
- [x] 1.3 Lint passes — 08f01a8
- [x] 1.4 Production build succeeds — 08f01a8
- [x] 1.5 The existing Tonight e2e specs still pass on a local preview — 08f01a8

#### Manual

- [x] 1.6 Tonight renders the same top 5 before and after — 08f01a8

### Phase 2: The all-objects page

#### Automated

- [x] 2.1 Unit tests pass (i18n parity) — 05ec751
- [x] 2.2 Type check passes — 05ec751
- [x] 2.3 Lint passes — 05ec751
- [x] 2.4 Production build succeeds — 05ec751

#### Manual

- [x] 2.5 The page lists every cleared object, sorts by time across midnight, rows expand, Mark observed works — 05ec751
- [x] 2.6 A no-go night shows the explanation and the back link — 05ec751

### Phase 3: Links from Tonight and verification

#### Automated

- [x] 3.1 Unit tests pass — f89f3b8
- [x] 3.2 Type check passes — f89f3b8
- [x] 3.3 Lint passes — f89f3b8
- [x] 3.4 Production build succeeds — f89f3b8
- [x] 3.5 Full e2e suite passes in parallel — f89f3b8

#### Manual

- [x] 3.6 Screenshot matrix: no overflow, red audit passes — f89f3b8
- [ ] 3.7 The user reviews the page
