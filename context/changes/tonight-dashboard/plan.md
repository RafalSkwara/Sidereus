# Tonight as a dashboard of focused pages Implementation Plan

## Overview

`/tonight` is still crowded after the Nightfall redesign: under the sky sit four summary bands whose chevrons jump to detail bands further down the same page (`#ranking`, `#moon`, `#planets`, `#nights`). The user finds this unclear: a panel that links to another panel on the same page. This change turns `/tonight` into a dashboard. The sky verdict stays at the top. Below it, four ruled tile rows each open their own focused page under `/tonight/*`: Point here first → Targets, The Moon, Planets, Next 7 nights. Each focused page opens with a slim sky header holding a back link, its title and a context line. Roadmap S-11 (MS-11), GitHub #87.

## Current State Analysis

- `src/pages/tonight.astro` is a `GearShell skyFlow` shell. It reads the requested gear (`requestedGear`) and the `?logged` / `?skyChecked` / `?error` notice (`pickTonightNotice`), then renders one server island, `TonightContent` (`server:defer`), with `TonightSkeleton` as its fallback.
- `TonightContent.astro` (302 lines) renders, in order:
  - `TonightSky` + `VerdictCard`
  - the notice
  - `TonightSummary` (the four in-page-link bands)
  - `SkyCheckCard`
  - the gear line and `GearSelector`s
  - the setup and add prompts
  - the detail bands: `MoonCard`, the eyepiece and log notices, `SolarSystemSection`, the ranking Band (top 5 `ObjectCard`s, "See all", the washed-out link) and `NightStrip`
- `/tonight/all` (`pages/tonight/all.astro` + `AllObjectsContent.astro`) lists every cleared object as expandable `ObjectRow`s, sorted by rank or time, plus a `#washed-out` section. It is still in the pre-Nightfall style: boxed rows, `text-sm`, an uppercase kicker and a hand-rolled back link.
- **Data:** `loadTonight` (`src/lib/tonight/load.ts:89`) reads sites, telescopes, eyepieces, the log and, optionally, sky checks in one `Promise.all`. It builds the whole `TonightView` only when both a site and a telescope exist. The summary needs the full ranking (`summaryTargets`), and so does the Moon's `faintText` (`build.ts:711`). The forecast is KV-cached.
- **Couplings that move:**
  - "Mark observed" (`logHref`, `load.ts:169`) carries no return path. `POST /api/log` always returns to `/tonight?logged=<key>` (`api/log/index.ts:35`), and the log form's back link is `/tonight` (`log/new.astro:63`).
  - `returnTargetSchema` is `z.enum(["log"])` (`observations/schemas.ts:92`).
  - `GearSelector` hard-codes `/tonight` (`GearSelector.astro:41,56`). It stays on the dashboard, so it needs no change.
  - The sky-check return whitelist is `SKY_CHECK_RETURNS` (`sky-checks/schemas.ts:18`). The sky check stays on the dashboard, so it needs no change either.
- **Navigation:** `isCurrentPage` (`navigation.ts:13`) matches on path prefix, so the Tonight tab stays active on `/tonight/*`. `PROTECTED_ROUTES` covers `/tonight` sub-paths (`protected-routes.ts:6`).
- **e2e:** 8 specs walk Tonight's sections (see the Testing Strategy). No spec asserts on the summary bands or their in-page anchors. `onboardInMadrid` expects `/tonight$` (`tests/e2e/helpers.ts:84`).

## Desired End State

- **`/tonight` (the dashboard):**
  - The Nightfall sky with the giant verdict, unchanged.
  - The page notice.
  - Four ruled tile rows. Each is a whole-row link with a heading, a one-glance summary and a → arrow, and leads to a page, never to an anchor:
    - Point here first → `/tonight/targets`
    - The Moon → `/tonight/moon`, shown when the view has a Moon card
    - Planets → `/tonight/planets`, shown when the view has a solar system
    - Next 7 nights → `/tonight/nights`
  - The sky check, only while a question is open.
  - The gear line or pickers.
  - The setup, add and no-eyepieces prompts.
  - No detail bands.
- **The four focused pages** each render as `GearShell skyFlow` with their own server island:
  - A slim sky: `‹ Tonight` back link, the page title, and a context line of verdict dot · date · site · telescope (the headline in screen-reader text).
  - Then the page's detail, reusing today's components:
    - **Moon:** `MoonCard` with the slider and the Moon as a target.
    - **Planets:** `SolarSystemSection`.
    - **Nights:** `NightStrip`.
    - **Targets:** the full ranked list (rank/time sort) as Nightfall ruled expandable rows, plus the washed-out section. With no ranking it shows the reason and a link to Next 7 nights.
  - The site/telescope choice made on the dashboard (cookie) carries to every page.
- **"Mark observed"** on Targets, Moon or Planets returns to that same page with its "logged" notice. The log form's back link goes there too.
- **`/tonight/all`** redirects to `/tonight/targets`, keeping `?sort=` and the `#washed-out` fragment.
- **Every state works:** EN and PL; dark, light and red; 390 px and desktop. The page states are: loading, no site or telescope, weather no-go, no darkness, forecast down, database missing.

Verify with the e2e suite against local Supabase and the forecast fixture, plus the screenshot gate in Phase 5.

### Key Discoveries:

- The summary already exists as a component with the right content and edge cases (`TonightSummary.astro`). It only needs its `href`s and affordance changed, not a rebuild.
- `Band`'s `id` prop exists only for in-page anchors (`Band.astro:4-5`). The ids can stay, because e2e uses `section#nights`, but nothing should link to them any more.
- `TonightSky` already has a short, title-only mode (`verdict` false, `TonightSky.astro:13-17`), which suits the slim page sky.
- `BackLink` (`src/components/ui/BackLink.astro`) is the shared 44 px back link. `PageHeader` is the shared title.
- The page shell must read the gear and notices itself: an island's `Astro.url` carries no page query (`tonight.astro:43-45`). Every new page repeats that pattern.
- `/tonight/all`'s scroll-to-hash script (`all.astro:52-71`) exists because the island streams in after the browser has tried the fragment. It moves with the washed-out section.
- A lessons.md rule applies: everything inside a Tonight island needs JavaScript. Don't plan no-JS behaviour on the new pages either.
- Another lessons.md rule: modules that touch site records go under the `no-console` lint (`gearConfig.files`). It already covers `src/pages/tonight/**`, `src/lib/tonight/**` and `src/components/tonight/**` (`eslint.config.js:85-104`).

## What We're NOT Doing

- **The interactive sky** (a slider moving real target positions across the dashboard sky). It stays an open S-11 unknown, for a follow-up change.
- **S-05 (timeline page) and S-06 (offline).** This change gives them their home; they stay separate slices.
- **Skip flags on `loadTonight`.** Each page builds the full view. The dashboard and the Moon page need the ranking anyway, and the forecast is cached; optimise only if measured.
- **Site/telescope pickers on the focused pages.** You switch on the dashboard (user decision). The context line names the active gear.
- **A separate verdict page.** The dashboard's sky is the verdict. A sky-check page already exists at `/log/sky`.
- **No-JS fallbacks** for the new islands (lessons.md).
- **Log and Gear shortcut tiles** (they duplicate the tab bar).
- **A `/dashboard` route change.** It keeps redirecting to `/tonight`.
- **Restyling `/log`, auth, onboarding or landing.**

## Implementation Approach

Build the shared pieces first (the slim page sky, the island loading helper, return-to-page logging). Then add the focused pages while the old in-page detail still exists, so nothing is lost mid-change. Only after every page exists does the dashboard drop its detail bands and repoint its tiles. Each phase moves the e2e specs for the sections it moves, so the suite is green at every phase end. The visual contract (tokens, `Band`, `PageHeader`, `BackLink`, `buttonVariants`) is reused. The only new shared pieces are the page sky and its skeleton, specimened on `/design`.

### Delegated decisions (user asked to decide non-UI choices)

- **Data per page:** every focused page has its own `server:defer` island calling `loadTonight` unchanged. Only the dashboard passes `withSkyChecks` and records the sky verdict, since it is the only page that shows the headline.
- **Log return:** extend `returnTargetSchema` to `log | targets | moon | planets`. `logHref` gains the page, and `POST /api/log` maps `from` to its path with `?logged=`. A missing `from` still returns to `/tonight`, so old links work.
- **Targets with no ranking:** the tile always opens `/tonight/targets`. The page explains why (the view's explanation) and links to `/tonight/nights`, so a tile never jumps elsewhere.
- **Focused page without a site or telescope:** one line plus a link back to Tonight. The dashboard owns the setup prompts.
- **Error notices:**
  - The eyepiece-load error shows on Targets, Moon and Planets.
  - The log-load error shows there and on the dashboard ("Point here first" depends on the log).
  - The no-eyepieces prompt stays on the dashboard with the other setup prompts.

## Critical Implementation Details

- **Redirect keeping the fragment.** `/tonight/all#washed-out` → `/tonight/targets`: browsers re-apply a request's fragment to a redirect whose `Location` has none. So redirect without a hash, and keep the MutationObserver scroll script on the targets page.
- **One sky per page.** The slim sky must be rendered by the island (it needs the view for the context line), as Tonight does under `skyFlow`. The skeleton renders the same slim sky with the title known in the shell and a bar for the context line, so nothing jumps when the island swaps in.

## Phase 1: Groundwork

### Overview

The shared pieces every focused page needs: the slim page sky and its skeleton, a loading helper for the islands, return-to-page logging, and the copy.

### Changes Required:

#### 1. Slim page sky

**File**: `src/components/tonight/TonightPageSky.astro` (new), `src/components/tonight/TonightPageSkeleton.astro` (new)

**Intent**: The top of every focused page. `TonightSky` in its title-only mode, holding:

- a `BackLink` to `/tonight` ("Tonight")
- the `PageHeader` title
- a context line: verdict dot, date label, site name, telescope name

The headline sits next to the dot in screen-reader text so the dot's meaning is not colour-only. The skeleton draws the same sky with the real title, a bar for the context line and N ruled placeholder rows, with `role="status"` and `aria-busy`.

**Contract**:

- `TonightPageSky` props: `{ title: string; view: TonightView | null }`. With `view` null (failure or setup missing) the context line is omitted.
- `TonightPageSkeleton` props: `{ title: string; reloadHref: string; rows?: number }`. Like `TonightSkeleton.astro:71-76`, it shows the "slow, reload" hint after about 10 s, linking to its own page (`reloadHref`), never to `/tonight`.
- Colours come from tokens only, using `VERDICT_TONES` for the dot.

#### 2. Island loading helper

**File**: `src/lib/tonight/island.ts` (new), or a small `.astro`-side helper if `Astro.locals` typing requires it.

**Intent**: The four new islands and `TonightContent` repeat the same `loadTonight` wiring. Factor out the signed-out guard, `kvForecastCache()`, `FORECAST_BASE_URL` and the `waitUntil` defer, so each island is a one-liner.

**Contract**: `loadTonightFor(locals, { siteId, telescopeId, limit?, withSkyChecks? }) → Promise<TonightLoad | null>`, which returns `null` when signed out. `AllObjectsContent`'s replacement uses it too.

#### 3. Return to the page that logged

**Files**:

- `src/lib/observations/schemas.ts`
- `src/lib/observations/redirect.ts`
- `src/pages/api/log/index.ts`
- `src/lib/tonight/load.ts` (`logHref`)
- `src/pages/log/new.astro`
- `src/components/observations/ObservationForm.tsx`

**Intent**:

- "Mark observed" carries the page it came from. The form page passes it on to the form, which posts it as a hidden field. Today the form writes `from` only in manual mode (`ObservationForm.tsx:137`), so without this the value is dropped before `POST /api/log`.
- A successful save returns there with `?logged=<key>`, a failed save keeps `from` (as `formRedirect` already does for `log`), and the log form's back link goes to that page.
- A missing or unknown `from` keeps today's `/tonight`.

**Contract**:

- `returnTargetSchema = z.enum(["log", "targets", "moon", "planets"]).optional()`.
- A `tonightReturnPath(from)` lookup lives in `redirect.ts`: `targets` → `/tonight/targets`, `moon` → `/tonight/moon`, `planets` → `/tonight/planets`, otherwise `/tonight`.
- `logHref(view, target, from?)` adds `from` to the query only when given. `from` is optional: the dashboard's detail bands (still on `/tonight` through Phase 3) never pass it, so they keep returning to `/tonight`. Only the new page islands pass `"targets"`, `"moon"` or `"planets"`.
- `log/new.astro` parses `from` once. It passes it to `ObservationForm` as a prop (`returnTo`), and its back link uses the same lookup (`log` keeps `LOG_LIST`), styled with `BackLink`.
- `ObservationForm` renders `<input type="hidden" name="from">` for any valid `returnTo`, not only in manual mode. The `manual` checks everywhere stay `=== "log"`.

#### 4. Copy

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Add keys for:

- the page titles (Targets / Cele, The Moon / Księżyc, Planets / Planety, Next 7 nights / Najbliższe 7 nocy)
- the back link (Tonight / Dziś w nocy, matching `nav.tonight`)
- the context line's screen-reader verdict prefix
- the focused pages' "no site or telescope" line and its link
- the two null-section lines: "Moon details aren't available right now" (`moonCard` null, which only happens when the build fails, `build.ts:716`) and "No planets to show tonight" (`solarSystem` null: no planet window, a no-go planet gate or a failure, `build.ts:583,631`)
- the Targets "no targets tonight" body and its "See the next 7 nights" link
- the tile rows' "Open <page>" accessible suffix, replacing `tonight.summary.seeDetail`'s "Show details"

**Contract**: PL mirrors EN (`satisfies Messages`, parity test). Reuse existing keys (e.g. `nav.tonight`, `tonight.summary.*`) where the wording already fits.

#### 5. Lint coverage

**File**: `eslint.config.js`

**Intent**: No edit expected. `gearConfig.files` already covers `src/pages/tonight/**`, `src/lib/tonight/**` and `src/components/tonight/**` (`eslint.config.js:85-104`), so every new file lands under the `no-console` rule (lessons.md). Re-check only if a file goes elsewhere.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass, including new cases for `tonightReturnPath` / `returnTargetSchema` and the `formRedirect` keeping `from=moon`: `npm test`
- i18n parity test passes (part of `npm test`)
- e2e still green (nothing user-visible moved yet; `observation-log`, `moon-as-target` and `planets-on-tonight` still land on `/tonight?logged=`): `npm run test:e2e` per the handoff recipe

#### Manual Verification:

- `/design` shows `TonightPageSky` (with view, without view) and `TonightPageSkeleton` in dark, light and red, at 390 px, with the dot and text legible

**Implementation Note**: Run the manual check yourself (local preview + Playwright screenshots), tick it with evidence and continue (the user's standing preference); only pause if something needs a UI decision.

---

## Phase 2: Moon, Planets and Nights pages

### Overview

Three focused pages built from today's detail components. The dashboard still shows its old detail bands during this phase, so nothing is lost while the pages land.

### Changes Required:

#### 1. Pages and islands

**Files**:

- `src/pages/tonight/moon.astro` + `src/components/tonight/MoonPageContent.astro`
- `src/pages/tonight/planets.astro` + `src/components/tonight/PlanetsPageContent.astro`
- `src/pages/tonight/nights.astro` + `src/components/tonight/NightsPageContent.astro`

(All new.)

**Intent**: Each page:

- is a `GearShell skyFlow` shell that reads `requestedGear` and the notice (`?logged` / `?error` through `pickTonightNotice`)
- renders its island with `TonightPageSkeleton` (`reloadHref` = its own path) as the fallback, and the `DatabaseMissing` path with a title-only `TonightPageSky`
- ends with `Attribution`, as `/tonight` does

Each island:

- loads through the helper
- renders `TonightPageSky`, the notice, the relevant error notices, then the detail in the `max-w-3xl px-4` container

**Contract**:

- **Moon:** `MoonCard` with `logHref(view, MOON_TARGET_KEY, "moon")`. A card with no states already shows its phase line. With `view.moonCard` null it shows the "Moon details aren't available" line.
- **Planets:** `SolarSystemSection` with `from = "planets"`. With `view.solarSystem` null it shows the "No planets to show tonight" line. `noneText` lives inside `solarSystem`, so it cannot be used there. Never an empty page. Both pages are reachable by URL even when the dashboard hides their tile.
- **Nights:** `NightStrip` with the view's nights.
- **All three:**
  - No site or telescope, or `needsSetup`: the "no setup" line plus a link to `/tonight`.
  - `tonightError`, `sitesError` or `telescopesError`: `ServerError`.

#### 2. Moon's and planets' log links

**File**: `src/components/tonight/MoonCard.astro`, `src/components/tonight/SolarSystemSection.astro` (callers pass the `from`-aware `logHref`; no prop shape change beyond what callers pass).

**Intent**: "Mark observed" on these pages returns to them.

#### 3. e2e moves

**Files**: `tests/e2e/moon-card.spec.ts`, `tests/e2e/moon-as-target.spec.ts`, `tests/e2e/planets-on-tonight.spec.ts`, `tests/e2e/seven-night-planner.spec.ts`

**Intent**: Point the section assertions at the new pages:

- `/tonight/moon`'s `moon-heading`, slider and Now button
- `/tonight/planets`'s list
- `/tonight/nights`' `section#nights`

Expect the log save to return to `/tonight/moon?logged=moon` and `/tonight/planets?logged=<key>`. Site switching stays on `/tonight` (pickers) and then checks `/tonight/nights` follows the cookie.

### Success Criteria:

#### Automated Verification:

- Type check, lint and unit tests pass: `npx astro check && npm run lint && npm test`
- Build passes: `npm run build`
- Updated e2e specs pass (moon-card, moon-as-target, planets-on-tonight, seven-night-planner) and the rest stay green: `npm run test:e2e`

#### Manual Verification:

- Each page in EN/PL × dark/light/red at 390 px and desktop: slim sky, context line, back link returns to `/tonight`, content matches what the dashboard showed for the same site
- The Moon slider still works on `/tonight/moon` (drag, keys, Now), including red mode
- Planets page on a cloudy-planet-window night and nights page with a forecast outage (fixture down) read sensibly
- A second site chosen on the dashboard carries to all three pages

**Implementation Note**: Self-verify with screenshots and continue (standing preference).

---

## Phase 3: Targets page

### Overview

`/tonight/targets` becomes the one place for deep-sky targets. It takes over `/tonight/all` in the Nightfall style.

### Changes Required:

#### 1. Targets page and island

**Files**: `src/pages/tonight/targets.astro` (new), `src/components/tonight/TargetsPageContent.astro` (new, replaces `AllObjectsContent.astro`), `src/components/tonight/ObjectRow.astro`, `src/lib/tonight/all-objects.ts`

**Intent**: The page:

- reads `?sort=` (`parseSort`)
- loads with `limit: Infinity`
- renders `TonightPageSky` (title "Targets", with a count caption such as "23 cleared tonight" from the existing `tonight.all.heading` plural), the notice, the error notices and the "Ranked for <telescope>" line when the user has two or more telescopes
- shows the rank/time sort as a segmented control styled with tokens, then the full ranked list as Nightfall ruled expandable rows
- ends with the `#washed-out` section, with the scroll-to-hash script moved from `all.astro`

**Contract**:

- `ObjectRow` is restyled to a ruled row:
  - no box, `divide-y` list
  - type roles instead of `text-sm`/`text-lg`/`text-xs`
  - `rounded-lg` focus ring
  - 44 px or more summary
  - keeps `data-object` and `data-best-at`
  - its `ObjectDetails` gets `logHref(view, entry.id, "targets")`
- The washed-out rows lose their dashed boxes for muted ruled rows; they keep `data-washed-out-object`.
- Sort links point to `/tonight/targets?sort=…`.
- No ranking (weather no-go or no darkness): the verdict reason or explanation plus a link to `/tonight/nights`.
- An empty ranking with a sky: `tonight.all.empty`.

#### 2. Retire `/tonight/all`

**File**: `src/pages/tonight/all.astro`

**Intent**: A permanent redirect to `/tonight/targets`, carrying a valid `sort` and nothing else (no fragment in `Location`, see Critical Implementation Details). Delete `AllObjectsContent.astro`.

**Contract**: `GET /tonight/all?sort=time` → 301 `/tonight/targets?sort=time`. `GET /tonight/all` → 301 `/tonight/targets`.

#### 3. Dashboard links into the old page

**File**: `src/components/tonight/TonightContent.astro`

**Intent**: Until Phase 4 removes them, repoint "See all" and the washed-out link to `/tonight/targets` (and `/tonight/targets#washed-out`), so the suite stays green.

#### 4. e2e

**Files**: `tests/e2e/tonight-all-objects.spec.ts` (rename to `tonight-targets.spec.ts`), `tests/e2e/observation-log.spec.ts`

**Intent**:

- Assert on `/tonight/targets`: the count, the sort, `#washed-out` in view.
- Assert the old `/tonight/all?sort=time` redirect lands on `/tonight/targets?sort=time`.
- The observation-log flow logs from the targets page and returns to `/tonight/targets?logged=<id>` with the row tagged as seen.

### Success Criteria:

#### Automated Verification:

- Type check, lint, unit tests and build pass: `npx astro check && npm run lint && npm test && npm run build`
- `no-hardcoded-colors` and `red-theme` tests pass (part of `npm test`)
- Targets and observation-log e2e specs pass, and the rest stay green: `npm run test:e2e`

#### Manual Verification:

- `/tonight/targets` in EN/PL × dark/light/red at 390 px and desktop: ruled rows, sort control, an expanded row with eyepiece pair and Mark observed, washed-out section
- No-go night and no-darkness night show the reason and the link to Next 7 nights
- An old bookmark `/tonight/all#washed-out` lands scrolled to the washed-out section

**Implementation Note**: Self-verify with screenshots and continue.

---

## Phase 4: The dashboard

### Overview

`/tonight` drops its detail bands. The summary bands become tile rows that open the pages.

### Changes Required:

#### 1. Tile rows

**File**: `src/components/tonight/TonightSummary.astro` (rename to `TonightTiles.astro` if it reads better; update `/design`)

**Intent**: Keep each band's glance content. Changes:

- **Links:**
  - targets → `/tonight/targets`, always, even with no ranking
  - Moon → `/tonight/moon`
  - Planets → `/tonight/planets`
  - nights → `/tonight/nights`
- **Affordance:** replace the chevron with a → arrow at the heading's end that reads as "opens a page", with an accessible name of the heading plus "Open …" instead of "Show details".
- **Tighter rows:** the dashboard should fit the sky and the four tiles in about two phone screens. Trim padding and the targets list's type role if needed, keeping 44 px targets and the hover and focus tokens.

**Contract**: Each tile is an `<a>` labelled by its heading and the "Open" suffix (`aria-labelledby`). No `#` hrefs remain in the component. The nights bars and their screen-reader sentence are unchanged.

#### 2. Slim `TonightContent`

**File**: `src/components/tonight/TonightContent.astro`

**Intent**:

- **Remove:** the detail bands (`MoonCard`, `SolarSystemSection`, the ranking Band, `NightStrip`) and the eyepiece-error notice, which now lives on the pages.
- **Keep:** the sky, the notice, the tiles, the sky check, the gear line and pickers, the setup and add prompts, the no-eyepieces prompt, the log-error notice, and the sky-verdict recording.
- **Order under the sky:** notice → tiles → sky check → gear → prompts.
- **Loading:** use the island helper with `withSkyChecks: true`.

**Contract**: Recording (`recordableVerdict` + `skyCheckStore.record`) stays here only. `TonightSkeleton` gets placeholder rows matching the tiles, not the detail bands.

#### 3. Docs in code

**Files**: `src/components/ui/Band.astro` (comment), `CLAUDE.md` "Tonight's sky" bullet

**Intent**: The comments say Tonight's summary links to pages, not anchors.

#### 4. e2e

**Files**:

- `tests/e2e/landing-screenshot.spec.ts`, `onboarding.spec.ts`, `telescope-selector.spec.ts`, `sky-checks.spec.ts`
- `tests/e2e/tonight-dashboard.spec.ts` (new)

**Intent**:

- Ranking assertions move to `/tonight/targets`. `telescope-selector` switches on `/tonight`, then checks the targets page follows. `sky-checks` stays on `/tonight`.
- The new spec opens `/tonight`, checks the four tiles link to their pages (no in-page anchors), follows one tile and returns with the back link.

### Success Criteria:

#### Automated Verification:

- Type check, lint, unit tests and build pass: `npx astro check && npm run lint && npm test && npm run build`
- No in-page anchor links remain on the dashboard: `grep -rnE '"#(ranking|moon|planets|nights)"' src/components/tonight/` returns nothing, and `grep -rn '"#washed-out"\|#washed-out' src/components/tonight/TonightContent.astro src/components/tonight/TonightSummary.astro` returns nothing (adjust the path if the summary is renamed; the targets page's own `id="washed-out"` is expected)
- Full e2e suite passes, including the new dashboard spec: `npm run test:e2e`

#### Manual Verification:

- `/tonight` in EN/PL × dark/light/red at 390 px and desktop: sky, four tiles, sky check (when open), pickers; noticeably shorter than before
- Each tile opens its page; back returns to the dashboard; the Tonight tab stays active on every page
- Edge states: no-go night (targets tile says no targets, opens Targets with the reason), no Moon card / no planets (tile omitted), forecast down, no site/telescope (setup prompt, no tiles)

**Implementation Note**: Self-verify with screenshots and continue.

---

## Phase 5: States, gate, rule

### Overview

Close out the contract: specimens, the screenshot gate the user approves, and the rules that keep the next agent on the dashboard pattern.

### Changes Required:

#### 1. `/design` specimens

**File**: `src/pages/design.astro`

**Intent**:

- Replace the `TonightSummary` specimens with the tile rows (full, targets only, no targets, no forecast bars).
- Add `TonightPageSky` (with and without a view) and `TonightPageSkeleton`.
- Show the rows in the 7-state matrix: default, hover, focus-visible, active, loading, empty and error, where applicable.

#### 2. Rules

**Files**: `CLAUDE.md` (UI section), `context/foundation/roadmap.md`, `context/handoff.md`

**Intent**:

- **CLAUDE.md:** "Tonight is a dashboard: a tile opens its own page under `/tonight/*` (never an in-page anchor). A focused page uses `TonightPageSky` and its own island, through the island helper." Also update the Project paragraph's description of `/tonight` and `/tonight/all`.
- **Roadmap and handoff:** record S-11's outcome and the remaining unknown (the interactive sky).

#### 3. Screenshot gate

**Intent**: Before/after screenshots of `/tonight` and each new page in EN/PL × dark/light/red × 390 px/desktop, plus the edge states from Phase 4. Publish them as one private artifact page for the user to approve.

### Success Criteria:

#### Automated Verification:

- Type check, lint, unit tests, build and the full e2e suite pass: `npx astro check && npm run lint && npm test && npm run build && npm run test:e2e`

#### Manual Verification:

- `/design` shows the tile rows and page sky in the 7-state matrix across themes
- The user approves the screenshot gate

**Implementation Note**: This is the one phase that waits on the user (the screenshot gate). Push-notify before waiting.

---

## Testing Strategy

### Unit Tests:

- `tonightReturnPath` / `returnTargetSchema`:
  - each `from` maps to its page
  - missing, unknown or tampered values fall back to `/tonight`
  - `formRedirect` keeps `from=moon`
- `/tonight/all` redirect: `sort` kept when valid, dropped when junk (in `all-objects.test.ts` if the mapping lives there).
- Keep new tests modest (user preference): screenshots cover the layout.

### Integration Tests (e2e):

| Spec | Today | After |
| --- | --- | --- |
| moon-card | Moon band on `/tonight` | `/tonight/moon` |
| moon-as-target | log → `/tonight?logged=moon` | log → `/tonight/moon?logged=moon` |
| planets-on-tonight | planets band, `?logged=` | `/tonight/planets`, returns there |
| seven-night-planner | `section#nights`, site pills | pills on `/tonight`, strip on `/tonight/nights` |
| tonight-all-objects | `/tonight/all` | `tonight-targets`: `/tonight/targets`, redirect from `/all` |
| observation-log | ranking on `/tonight` | targets page, returns there |
| telescope-selector | ranking + pills on `/tonight` | pills on `/tonight`, ranking on `/tonight/targets` |
| landing-screenshot, onboarding | headline + ranking on `/tonight` | headline on `/tonight`, ranking on `/tonight/targets` |
| sky-checks | `/tonight` | unchanged |
| tonight-dashboard (new) | — | tiles → pages → back |

### Manual Testing Steps:

1. Sign in with two sites and two telescopes, open `/tonight`, switch the site and telescope, and open each tile. Each page shows the chosen gear in its context line.
2. Mark an object observed on Targets, on the Moon and on a planet. Each returns to its own page with the notice and the seen tag.
3. Set the forecast fixture down. The dashboard and each page show the forecast status and read sensibly.
4. Open the old `/tonight/all#washed-out` bookmark. It lands on Targets, scrolled to the washed-out section.

## Performance Considerations

Each focused page runs one `loadTonight`, which is the same work `/tonight` and `/tonight/all` do today: five Supabase reads, a KV forecast hit and the full build. The dashboard no longer renders the detail bands, so its HTML shrinks. No new caching. If page CPU becomes visible, add skip flags to `loadTonight` in a follow-up. Today's ranking runs on every page.

## Migration Notes

None for data. Links:

- `/tonight/all` gets a 301.
- `/tonight` keeps its address, its tab and every redirect into it (onboarding, sign-in default, `?skyChecked`).
- Log links without `from` still land on `/tonight`.

## References

- Roadmap: `context/foundation/roadmap.md` S-11 (MS-11), GitHub #87
- Previous change: `context/archive/2026-10-04-tonight-nightfall/` (plan, brief)
- Summary bands: `src/components/tonight/TonightSummary.astro:42-163`
- Island and detail bands: `src/components/tonight/TonightContent.astro`
- Loader: `src/lib/tonight/load.ts:89-177`
- Log return: `src/pages/api/log/index.ts:35`, `src/lib/observations/redirect.ts`, `src/lib/observations/schemas.ts:92`, `src/pages/log/new.astro:63`
- All objects: `src/pages/tonight/all.astro`, `src/components/tonight/AllObjectsContent.astro`
- Lessons: `context/foundation/lessons.md` (Tonight needs JavaScript; the no-console lint for coordinate modules)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Groundwork

#### Automated

- [x] 1.1 Type check passes: `npx astro sync && npx astro check` — 15b2c3f
- [x] 1.2 Lint passes: `npm run lint` — 15b2c3f
- [x] 1.3 Unit tests pass, including new cases for `tonightReturnPath` / `returnTargetSchema` and the `formRedirect` keeping `from=moon`: `npm test` — 15b2c3f
- [x] 1.4 i18n parity test passes (part of `npm test`) — 15b2c3f
- [x] 1.5 e2e still green (nothing user-visible moved yet; `observation-log`, `moon-as-target` and `planets-on-tonight` still land on `/tonight?logged=`): `npm run test:e2e` per the handoff recipe — 15b2c3f

#### Manual

- [x] 1.6 `/design` shows `TonightPageSky` (with view, without view) and `TonightPageSkeleton` in dark, light and red, at 390 px, with the dot and text legible — 15b2c3f

### Phase 2: Moon, Planets and Nights pages

#### Automated

- [x] 2.1 Type check, lint and unit tests pass: `npx astro check && npm run lint && npm test`
- [x] 2.2 Build passes: `npm run build`
- [x] 2.3 Updated e2e specs pass (moon-card, moon-as-target, planets-on-tonight, seven-night-planner) and the rest stay green: `npm run test:e2e`

#### Manual

- [x] 2.4 Each page in EN/PL × dark/light/red at 390 px and desktop: slim sky, context line, back link returns to `/tonight`, content matches what the dashboard showed for the same site
- [x] 2.5 The Moon slider still works on `/tonight/moon` (drag, keys, Now), including red mode
- [x] 2.6 Planets page on a cloudy-planet-window night and nights page with a forecast outage (fixture down) read sensibly
- [x] 2.7 A second site chosen on the dashboard carries to all three pages

### Phase 3: Targets page

#### Automated

- [ ] 3.1 Type check, lint, unit tests and build pass: `npx astro check && npm run lint && npm test && npm run build`
- [ ] 3.2 `no-hardcoded-colors` and `red-theme` tests pass (part of `npm test`)
- [ ] 3.3 Targets and observation-log e2e specs pass, and the rest stay green: `npm run test:e2e`

#### Manual

- [ ] 3.4 `/tonight/targets` in EN/PL × dark/light/red at 390 px and desktop: ruled rows, sort control, an expanded row with eyepiece pair and Mark observed, washed-out section
- [ ] 3.5 No-go night and no-darkness night show the reason and the link to Next 7 nights
- [ ] 3.6 An old bookmark `/tonight/all#washed-out` lands scrolled to the washed-out section

### Phase 4: The dashboard

#### Automated

- [ ] 4.1 Type check, lint, unit tests and build pass: `npx astro check && npm run lint && npm test && npm run build`
- [ ] 4.2 No in-page anchor links remain on the dashboard: `grep -rnE '"#(ranking|moon|planets|nights)"' src/components/tonight/` returns nothing, and `grep -rn '"#washed-out"\|#washed-out' src/components/tonight/TonightContent.astro src/components/tonight/TonightSummary.astro` returns nothing (adjust the path if the summary is renamed; the targets page's own `id="washed-out"` is expected)
- [ ] 4.3 Full e2e suite passes, including the new dashboard spec: `npm run test:e2e`

#### Manual

- [ ] 4.4 `/tonight` in EN/PL × dark/light/red at 390 px and desktop: sky, four tiles, sky check (when open), pickers; noticeably shorter than before
- [ ] 4.5 Each tile opens its page; back returns to the dashboard; the Tonight tab stays active on every page
- [ ] 4.6 Edge states: no-go night (targets tile says no targets, opens Targets with the reason), no Moon card / no planets (tile omitted), forecast down, no site/telescope (setup prompt, no tiles)

### Phase 5: States, gate, rule

#### Automated

- [ ] 5.1 Type check, lint, unit tests, build and the full e2e suite pass: `npx astro check && npm run lint && npm test && npm run build && npm run test:e2e`

#### Manual

- [ ] 5.2 `/design` shows the tile rows and page sky in the 7-state matrix across themes
- [ ] 5.3 The user approves the screenshot gate
