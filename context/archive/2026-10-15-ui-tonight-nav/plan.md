# Tonight sub-nav and Progress as a destination Implementation Plan

## Overview

Roadmap M-4 S-02 (#170), change 4 of the ui-refine umbrella (owner decision 4: "4A plus 4B"). The six focused Tonight
pages get a sub-nav that replaces the back link, so their siblings are one tap apart. Progress becomes the fourth
destination in the TabBar and the Topbar. The nav type sizes move onto the type roles. The finder keeps its back link
to where it was opened from.

## Current State Analysis

From `research.md` (charges C1-C5; hardcoded-value scan over the nine nav files: **0** hits):

- A focused page's only way off is `BackLink` to `/tonight`, drawn twice: by `TonightPageSkeleton` and then by the
  island's `TonightPageSky`, which replaces it (C1).
- Seven chips do not fit a phone at any label length, so the row must scroll, and the current chip can start
  off-screen (C2, measured).
- `/log/progress` is reached from the Log header and the milestone celebration only (C3). Four tabs fit at 320 px in
  Polish: the longest label is 60.7 px of 80 (C3, measured).
- `isCurrentPage` would mark Log **and** Progress current on `/log/progress` and duplicate the `nav-current` /
  `tab-current` view-transition names (C4).
- `Topbar` `text-sm` and `TabBar` `text-xs` are off the roles. At `md`, the Polish pill on `text-label` with four
  items leaves about 5 px of the 704 px row (C5, measured).

## Desired End State

- On `/tonight/{targets,plan,moon,planets,nights,events}` a row of seven chips (Tonight, Targets, Plan, Moon, Planets,
  Nights, Events; the dashboard's tile order) sits under the Topbar in the sky-flow strip. The current page's chip is
  filled (`bg-selected`, `aria-current="page"`) and scrolled into view on a phone. A fade marks the side with more
  chips. There is no back link on those pages. The sub-nav is not on `/tonight` (the dashboard is unchanged) and not on
  `/tonight/finder`, which keeps its back link to Targets, Planets or the Session plan.
- The TabBar has four tabs and the Topbar pill four segments: Tonight, Log, Progress, My gear. Exactly one is current
  on every page, and on `/log/progress` that is Progress. The Log header no longer links Progress, and `/log/progress`
  has no back link to Log.
- The pill's labels use `text-label` and the tabs' `text-caption`. The pill's icons show from `lg`.
- Verify: unit tests for the navigation model, the e2e listed per phase, `tonight-phone.spec.ts` green unchanged, and
  the screenshots in `evidence/after/`.

### Key Discoveries:

- `GearShell.astro:34-39`: the sky-flow strip (`night-sky bg-zenith`, Topbar only) is outside `<main>` and outside
  the island. The sub-nav can live there, rendered once by the server and never swapped.
- `TonightTiles.astro:127-197` and `EventsTile.astro:33` link plain paths, and the site lives in a cookie
  (`requested-gear.ts`). The sub-nav links the same plain paths, so it behaves offline exactly as the tiles do.
- `TONIGHT_PAGES` (`copies.ts:15-23`) is ordered for the offline list (Events last). The dashboard shows Events
  second.
- `finderBackHref` / `finderBackLabel` (`src/lib/finder/from.ts:15-28`) already give the finder its origin.
- `tests/e2e/tonight-dashboard.spec.ts:90` and `sky-events.spec.ts:58` find the back link inside `main`.
  `observing-progress.spec.ts:217` clicks the Log header's Progress link. `offline.spec.ts:98` finds Log in the
  primary nav.

### Owner decisions (2026-10-15, relayed by the orchestrator)

The owner confirmed all four UI defaults this plan proposed:

1. The sub-nav's order is the dashboard's tile order: Tonight, Targets, Events, Plan, Moon, Planets, Nights.
2. Short labels (Plan, Moon, Nights, Events / Plan, Księżyc, Noce, Zjawiska), not the page titles.
3. On a phone, an edge fade on the side with more chips, plus the current chip scrolled into view. No chevrons.
4. The Topbar pill shows its icons only from 1024 px (`lg`); between 768 and 1024 px it is text only.

## What We're NOT Doing

- No URL move: Progress stays at `/log/progress` (the celebration, `redirect.ts`, smoke and three specs use it).
- No change to the dashboard `/tonight` (no sub-nav there), `tonight-phone.spec.ts` or `VERDICT_MIN_HEIGHT_CLASS`.
- No change to `TONIGHT_PAGES` or the service worker. No new page.
- The Log header's "Sky checks" link and the progress page's own design (bar, quieter grid) are S-03
  (`ui-log-progress-gear`). `/log/sky` keeps its back link.
- `TopbarControls`' popover type sizes (`text-sm` / `text-xs` inside the settings panel) stay. They are not the nav
  row.
- No sub-nav on the finder chart (it is a leaf opened from a row, not a sibling).
- No chevron buttons on the sub-nav (the fade is the cue, and swipe and keyboard scroll it).

## Implementation Approach

The work runs in the /10x-ui order: model and copy → the shared bars → the one new component on the focused pages →
states, specimens and the rule. Phase 1 carries 4B and C3-C5 and touches no Tonight page. Phase 2 carries 4A (C1-C2)
and touches no shared bar. They are independent in logic, so either can ship first if one stalls, but they share
`src/lib/navigation.ts` (+ its test) and the i18n catalogues (`en.ts`, `pl.ts`): run them one after the other in one
checkout, never in parallel worktrees (plan review F5).

## Critical Implementation Details

- **Sub-nav placement**: in GearShell's sky-flow strip through a named slot. It is never inside `TonightPageSky` or
  `TonightPageSkeleton`: there it would be drawn twice and lose its scroll position on the island swap (C1). The
  `night-sky` scope means `night:` variants apply. The strip is `bg-zenith` and the band below starts at `--zenith`,
  so the extra strip height continues the same sky.
- **Scroll into view**: set the row's `scrollLeft` so the current chip is visible (centred where possible), once on
  load. Never use `scrollIntoView`: it can scroll the page vertically, which the hash-scroll on Targets and Planets
  (`hash-scroll.ts`) must own.
- **One current destination**: Topbar and TabBar both read `currentDestination(pathname)` (the longest matching
  href). Two current items would duplicate the `nav-current` / `tab-current` view-transition names, and a duplicate
  name aborts the transition.

## Phase 1: Four destinations, one current item, nav type on the roles

### Overview

Progress joins the shared bars as the fourth destination (4B, C3). The current-item rule picks the most specific
destination (C4). The pill and the tabs move onto the type roles, with the pill's icons from `lg` (C5). Non-UI model
code plus a small UI change in two shared bars. The UI subagent (Opus high) runs the whole phase.

### Changes Required:

#### 1. Navigation model

**File**: `src/lib/navigation.ts`, new `src/lib/navigation.test.ts`

**Intent**: add Progress as the third item and replace the per-item prefix check with one function that names the
single current destination, so `/log/progress` marks Progress only.

**Contract**:
- `NAV_ITEMS`: Tonight, Log, Progress (`{ href: "/log/progress", label: "progress", icon: "progress", needsNetwork: true }`), My gear, in that order.
- `currentDestination(pathname: string): NavItem["href"] | null`: the longest `href` that `isCurrentPage` matches.
  `isCurrentPage` stays exported (TabBar's onboarding check and the Topbar's sign-in check use it).
- Tests: `/tonight`, `/tonight/targets` → `/tonight`. `/log`, `/log/new`, `/log/sky` → `/log`. `/log/progress` →
  `/log/progress`. `/gear/sites/new` → `/gear`. `/login`, `/`, `/auth/signin` → `null`. Exactly one item is current
  for every path in a table of app paths.

#### 2. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: the destination's label.

**Contract**: `nav.progress`: EN "Progress", PL "Postępy" (the page's title stays "Your progress" / "Twoje
postępy").

#### 3. Icon

**File**: `src/components/NavIcon.astro`

**Intent**: a fourth hand-drawn glyph in the same 24-unit, 2-stroke style, read as "progress / achievement".

**Contract**: `name: "tonight" | "log" | "progress" | "gear"`. The `progress` glyph is a medal (a ribbon and a
circle), matching lucide's `Award`, which the Log header and the celebration already use for Progress.

#### 4. The bars

**File**: `src/components/Topbar.astro`, `src/components/TabBar.astro`

**Intent**: four items, one current, on the type roles. The pill fits at `md` in Polish.

**Contract**:
- Both compute `current` as `item.href === currentDestination(pathname)`.
- TabBar: `grid-cols-4`, `text-caption` in place of `text-xs`.
- Topbar pill: `text-label` in place of `text-sm`. The `NavIcon` is `hidden lg:block` (or the equivalent on the svg),
  so the segments are text-only between `md` and `lg`. Keep the hover nudge class on the icon.
- No other change to the bars (view-transition names, focus ring, `data-needs-network`).

#### 5. Progress leaves the Log header

**File**: `src/pages/log/index.astro`, `src/pages/log/progress.astro`

**Intent**: Progress is a destination now, so the Log header drops its Progress link and the progress page drops
its back link to Log.

**Contract**: remove the `PROGRESS_PAGE` link and its `Award` import from the Log header's actions. "Sky checks" and
"Add entry" stay, along with the one-primary rule. Remove `BackLink` from `progress.astro`. Keep the `PageHeader`
and its spacing wrapper, adjusted so the title sits where a sky-header title without a back link sits (as
`/gear` and `/log` do).

#### 6. E2E

**File**: `tests/e2e/observing-progress.spec.ts`, new `tests/e2e/navigation.spec.ts`

**Intent**: follow Progress to its new entry, and pin the four destinations.

**Contract**:
- `observing-progress.spec.ts:217`: open Progress from the primary nav (`getByRole("navigation", { name: en.nav.primary }).getByRole("link", { name: en.nav.progress })`), with the viewport the test already uses.
- `navigation.spec.ts` (signed in through the shared onboarding helper the other specs use):
  - At 320×700 in Polish, the TabBar has four links and none overflows: each link's `scrollWidth <= clientWidth`, and
    each label sits inside its cell.
  - At 768×900 and 1024×900 in Polish, the Topbar row does not overflow: the header's `scrollWidth <= clientWidth`,
    and the pill's right edge is left of the controls.
  - On `/log/progress`, exactly one `aria-current="page"` in each bar, on Progress. On `/log` and `/log/sky`, on Log.

### Success Criteria:

#### Automated Verification:

- The navigation model tests pass: `npx vitest run src/lib/navigation.test.ts src/i18n/i18n.test.ts`
- Types, lint and the unit suite pass: `npx astro check && npm run lint && npm test`
- The build passes: `npm run build`
- The phase's e2e pass on the preview (4331/4401): `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test navigation observing-progress observing-milestones offline toasts tonight-phone`

#### Manual Verification:

- The TabBar at 320 and 390 px and the Topbar at 768, 1024 and 1280 px, EN and PL, dark, light and red, read as one
  bar with four equal items, the current one marked, no clipped label (main session's judgement; shots in
  `evidence/after/nav-*.jpg`)

**Implementation Note**: After the gates pass, the main session judges the shots, commits the phase and continues to
Phase 2 (autonomous flow; the owner's checks come at the end).

---

## Phase 2: The Tonight sub-nav replaces the back link

### Overview

One shared `TonightSubNav` in GearShell's sky-flow strip on the six focused pages (4A, C1, C2). The back link leaves
`TonightPageSky` and `TonightPageSkeleton` together, except on the finder. UI phase: Opus high.

### Changes Required:

#### 1. The sub-nav's list and copy

**File**: `src/lib/navigation.ts` (+ its test), `src/i18n/messages/en.ts`, `pl.ts`

**Intent**: one ordered list of the Tonight pages in the dashboard's order, with short labels, held to the same set
as the offline list.

**Contract**:
- `TONIGHT_NAV`: `/tonight`, `/tonight/targets`, `/tonight/events`, `/tonight/plan`, `/tonight/moon`,
  `/tonight/planets`, `/tonight/nights`, each with a `tonight.subnav` label key.
- Test: the hrefs of `TONIGHT_NAV` and `TONIGHT_PAGES` (`@/lib/offline/copies`) are the same set (a new Tonight page
  must join both).
- `tonight.subnav`: `label` (the nav's accessible name) EN "Tonight's pages" / PL "Strony nocy". Short labels: EN
  Tonight, Targets, Events, Plan, Moon, Planets, Nights. PL Dziś w nocy, Cele, Zjawiska, Plan, Księżyc, Planety,
  Noce. `tonight` reuses `nav.tonight`'s wording.

#### 2. The component

**File**: new `src/components/tonight/TonightSubNav.astro`, new `src/components/tonight/subnav.ts` (+ test)

**Intent**: a horizontally scrolling row of chips, the current one selected and in view, with a fade on the side
that has more.

**Contract**:
- `<nav aria-label={t.subnav.label} data-tonight-subnav>`, a `<ul>` of links (`list-none`). The current link (exact
  path match against `TONIGHT_NAV`) has `aria-current="page"`, `bg-selected text-selected-foreground` and
  `view-transition-name: subnav-current`. Other links are `text-muted-foreground hover:bg-accent hover:text-heading`.
  Every chip is `min-h-11` (44 px), `rounded-full`, `px-3`, `text-label font-semibold`, `whitespace-nowrap`, with the
  Topbar's focus ring.
- The row is `overflow-x-auto scrollbar-hidden`. The bleed matches the content container: aligned with the page title
  (`max-w-3xl px-4`), the scroll area bleeding to the screen edge on a phone so a chip is never cut by padding.
- Fade: the row carries `data-more-start` / `data-more-end` (booleans set by the script), and the CSS masks that edge
  with a `mask-image` linear gradient (alpha only). With no script, there is no mask and the row is a plain scroll
  row.
- `subnav.ts` (pure, tested): `scrollLeftFor(chip: {left, width}, row: {width, scrollWidth}) → number` (centres the
  chip, clamped to `[0, scrollWidth - width]`). `chip.left` is the chip's position in the row's scrolled content:
  `chipRect.left - rowRect.left + row.scrollLeft` from `getBoundingClientRect`, never a bare `offsetLeft` (the row is
  not positioned, so `offsetLeft` would count from a further ancestor and shift the centring by the container's
  padding and the phone bleed; plan review F3), and `edges(scrollLeft, width, scrollWidth) → {start, end}` with a 1 px
  tolerance. The component's `<script>` applies them on load and on `scroll` (passive) and `resize`. It sets
  `scrollLeft`, never `scrollIntoView`.
- The current-chip glide: add `subnav-current` to the `::view-transition-group` rules beside `nav-current` in
  `global.css`.

#### 3. Placement

**File**: `src/components/gear/GearShell.astro`, `src/pages/tonight/{targets,plan,moon,planets,nights,events}.astro`

**Intent**: render the sub-nav once, in the strip, on the focused pages only.

**Contract**: GearShell's sky-flow branch renders `<slot name="subnav" />` under the Topbar, inside the
`night-sky bg-zenith` strip. Its container matches the page title's column. With an empty slot the strip is
byte-for-byte what it is today (the dashboard and the finder pass nothing). Each of the six pages passes
`<TonightSubNav slot="subnav" />`.

#### 4. The back link only for the finder

**File**: `src/components/tonight/TonightPageSky.astro`, `TonightPageSkeleton.astro`, the six `*PageContent.astro`
islands only if they pass `backHref`, `src/pages/design.astro`, `src/styles/rhythm-roles.test.ts`

**Intent**: no back link on the six focused pages. The finder keeps its own.

**Contract**: `backHref` becomes optional with no default, and the `BackLink` and its wrapper render only when
`backHref` is given. The skeleton follows the same rule, so the two stay identical. `finder.astro` and
`FinderContent` keep passing `backHref` / `backLabel` (unchanged).
- **The title's offset** (plan review F1): today the title's wrapper is `mt-1 sm:mt-2` under the back link. With no
  back link that offset has nothing to separate, so the wrapper takes `mt-1 sm:mt-2` only when `backHref` is given
  (`class:list={[backHref && "mt-1 sm:mt-2"]}`), identically in `TonightPageSky` and `TonightPageSkeleton`. The title
  then starts at the sky band's own top padding, as a sky-header title without a back link does on `/gear` and
  `/log`. The literal stays once in the skeleton, so `rhythm-roles.test.ts`'s `TonightPageSkeleton` counts
  (`"mt-1": 3`, `"sm:mt-2": 1`) do not change. Update that entry's comment to say the title's offset applies under the
  finder's back link only. If the implementer restructures the header instead, the counts change only by the
  removed uses, with the comment saying why, and never to fit an unplanned class.
- **Heights** (plan review F2): measure with this change's copy of the script,
  `context/changes/ui-tonight-nav/evidence/scripts/skeleton-heights.mjs` (the ui-fact-rhythm script plus the `plan`
  page). It needs a seeded full-plan user: `evidence/README.md` gives the three commands (`seed.mjs`, `account:plan …
  full`, the script). Delta within 2 px at 390 and 1280 px on the six pages and the finder.

#### 5. E2E

**File**: `tests/e2e/tonight-dashboard.spec.ts:90`, `tests/e2e/sky-events.spec.ts:58`, new `tests/e2e/tonight-subnav.spec.ts`

**Intent**: the old back-link steps go through the sub-nav, and the sub-nav's rules are pinned.

**Contract**:
- `tonight-dashboard.spec.ts:90`: go back through `getByRole("navigation", { name: en.tonight.subnav.label }).getByRole("link", { name: en.tonight.subnav.tonight })`. The comment at :87 is updated.
- `sky-events.spec.ts:58`: assert the sub-nav's Events chip is `aria-current="page"` in place of the back link.
- `tonight-subnav.spec.ts` (all-clear fixture, shared onboarding):
  - On each of the six pages: one sub-nav, seven links, exactly one `aria-current="page"` on that page's chip, and no
    link in `main` to `/tonight` named Tonight.
  - On `/tonight`: no sub-nav. On `/tonight/finder?object=M31&from=targets` (full plan via `account:plan`, as the
    finder specs do): no sub-nav, and the back link named Targets.
  - At 390×844 on `/tonight/nights` and `/tonight/events`: the current chip's box lies inside the row's box and the
    viewport, and `window.scrollY` is 0 after load.
  - Clicking Plan from Targets lands on `/tonight/plan` with the Plan chip current (one tap).
  - Every sub-nav link is found with `exact: true` (`getByRole("link", { name, exact: true })`): "Plan" is a substring of
    "Planets" and "Planety", so a substring match hits two links (plan review F4). The same goes for the
    `tonight-dashboard.spec.ts` and `sky-events.spec.ts` locators above.

### Success Criteria:

#### Automated Verification:

- The model, copy and sub-nav helper tests pass: `npx vitest run src/lib/navigation.test.ts src/components/tonight/subnav.test.ts src/i18n/i18n.test.ts`
- Types, lint and the unit suite pass, with no literal colour or arbitrary value: `npx astro check && npm run lint && npm test`
- The build passes: `npm run build`
- The phase's e2e pass on the preview (4331/4401): `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test tonight-subnav tonight-dashboard tonight-phone sky-events finder-chart offline tonight-targets seven-night-planner planets-on-tonight session-plan-edit`

#### Manual Verification:

- `evidence/scripts/skeleton-heights.mjs` (seeded per `evidence/README.md`) on the six pages and the finder at 390 and 1280 px: skeleton and real page within 2 px
- The sub-nav on Targets, Plan and Events at 390 and 1280 px, EN and PL, dark, light and red: the current chip reads
  as selected in red (fill, not hue), the fade shows on the side with more chips, and the strip continues the sky with
  no seam (main session's judgement; shots in `evidence/after/subnav-*.jpg`, compared with
  `ui-refine/evidence/exp-a/targets-phone-en-dark-fold.jpg`)

**Implementation Note**: After the gates pass, the main session judges the shots, commits the phase and continues to
Phase 3.

---

## Phase 3: States, specimens and the rule

### Overview

The 7-state matrix on `/design`, the guard that keeps the nav on the type roles and the Tonight list in step, and the
rules in `CLAUDE.md`. Docs and specimens: Sonnet medium. Screenshot capture: Sonnet medium.

### Changes Required:

#### 1. Kitchen sink

**File**: `src/pages/design.astro`

**Intent**: show the sub-nav's states and drop the back link from the page-sky specimens.

**Contract**:
- A `TonightSubNav` specimen block (pass a `current` override prop, used by `/design` only, so a specimen can mark
  any chip): default (Targets current), hover and focus-visible pinned by class as the BackLink specimens do, the
  last chip current (scrolled to the end, fade at the start).
- The 7-state matrix, recorded in the block's caption: default, hover and focus-visible shown. Disabled is N/A (the
  sub-nav's links work offline, the same plain paths as the tiles). Error is N/A (no input). Empty is N/A (the list is
  fixed). Loading is N/A (server-rendered in the shell, present before the island).
- `TonightPageSky` specimens render without the back link. One specimen keeps `backHref` for the finder case.
- The four-item bars are shown by every page's real bars, and `navigation.spec.ts` pins their fit. No `/design`
  specimen (they are fixed to the viewport).

#### 2. Guard

**File**: new `src/components/nav-type-roles.test.ts`

**Intent**: keep the nav rows on the type roles.

**Contract**: read `Topbar.astro`, `TabBar.astro` and `tonight/TonightSubNav.astro` and fail on
`\btext-(xs|sm|base|lg|xl)\b`. The `TONIGHT_NAV` / `TONIGHT_PAGES` set test from Phase 2 is the second guard.

#### 3. Rules

**File**: `CLAUDE.md` (this repo's), `context/changes/ui-tonight-nav/evidence/README.md`

**Intent**: tell the next agent where the sub-nav lives and why.

**Contract**:
- Architecture → Layout's navigation sentence: four destinations, `currentDestination`, the pill's icons from `lg`.
- UI → "Tonight's sky": a focused page opens with `TonightSubNav` in GearShell's `subnav` slot (never inside the
  island's sky or the skeleton), not a back link. The finder keeps its back link. A new Tonight page joins
  `TONIGHT_NAV` and `TONIGHT_PAGES` (the set test).
- UI → Offline bullet: unchanged except the cross-reference to `TONIGHT_NAV`.
- Evidence README lists the scripts and shots.
- The ui-refine umbrella's split table is not edited here (its current copy is in PR #181). Its row 4 is updated at
  archive time.

### Success Criteria:

#### Automated Verification:

- The guard passes, and fails on a planted `text-sm` (checked once, then reverted): `npx vitest run src/components/nav-type-roles.test.ts`
- Types, lint and the unit suite pass: `npx astro check && npm run lint && npm test`
- The build passes: `npm run build`
- The full e2e suite passes on the preview (4331/4401): `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test`

#### Manual Verification:

- `/design`'s sub-nav block at 390 and 1280 px in dark, light and red shows every state the matrix lists
  (`evidence/after/design-subnav-*.jpg`)
- The owner's walk on the preview: from Targets to the Session plan to Events in one tap each on a phone, Progress
  from the TabBar, and the finder's way back to Targets

**Implementation Note**: The owner's walk (3.6) comes after `/10x-impl-review`, with the PR.

---

## Testing Strategy

### Unit Tests:

- `navigation.test.ts`: `currentDestination` over the path table (one current item each; `/login` none), `TONIGHT_NAV`
  ≡ `TONIGHT_PAGES` as sets.
- `subnav.test.ts`: `scrollLeftFor` centres, clamps at both ends, and leaves a row that fits at 0. `edges` with 1 px
  tolerance at start, middle and end.
- `nav-type-roles.test.ts`: no raw type sizes in the three nav files.
- `i18n.test.ts` (existing parity): the new keys in both languages.

### Integration Tests:

- `navigation.spec.ts`: four destinations' fit (320 PL TabBar; 768 / 1024 PL Topbar) and one current item.
- `tonight-subnav.spec.ts`: presence, one current chip, absence on the dashboard and the finder, the current chip in
  view at 390 with no page scroll, one-tap sibling move.
- Unchanged and green: `tonight-phone.spec.ts` (dashboard first screen, no sideways scroll on every Tonight page and
  `/log/progress`), `offline.spec.ts`.

### Manual Testing Steps:

1. On a phone width, open Targets, tap Plan, then Events: each one tap, with the chip in view.
2. In red mode, check that the current chip and the current tab read without hue.
3. Open a finder chart from Targets and return through its back link.
4. Open Progress from the TabBar. Log is not current there.

## Performance Considerations

None: a server-rendered list and a script of a few lines on six pages. No new request, island or data.

## Migration Notes

None: no data, no URL change, no stored-copy change. Stored offline copies taken before the deploy keep the back link
until their next online refresh, which is harmless.

## References

- Research: `context/changes/ui-tonight-nav/research.md`
- Audit: `context/changes/ui-refine/audit.md` (findings 6, 7, 12; Theme 4; owner decision 4)
- Experiment A: `context/changes/ui-refine/evidence/exp-a/experiment-a.diff`
- Pattern: Topbar pill `src/components/Topbar.astro:46-75`; panorama strip `scrollbar-hidden` in `TonightSkyView`
- Measurement: `context/changes/ui-tonight-nav/evidence/measure-nav-labels.mjs`
- Plan review: `context/changes/ui-tonight-nav/reviews/plan-review.md` (SOUND; F1-F5 applied 2026-10-15)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Four destinations, one current item, nav type on the roles

#### Automated

- [x] 1.1 The navigation model tests pass — 39bab83
- [x] 1.2 Types, lint and the unit suite pass — 39bab83
- [x] 1.3 The build passes — 39bab83
- [x] 1.4 The phase's e2e pass on the preview — 39bab83

#### Manual

- [x] 1.5 The four-item bars read as one bar at every width, language and theme — 39bab83

### Phase 2: The Tonight sub-nav replaces the back link

#### Automated

- [x] 2.1 The model, copy and sub-nav helper tests pass — e25d531
- [x] 2.2 Types, lint and the unit suite pass, with no literal colour or arbitrary value — e25d531
- [x] 2.3 The build passes — e25d531
- [x] 2.4 The phase's e2e pass on the preview — e25d531

#### Manual

- [x] 2.5 Skeleton and real page within 2 px on the six pages and the finder
  > Done 2026-10-15 (tonight-nav): the header this change touched matches exactly (`evidence/scripts/header-heights.mjs`).
  > The whole-page `skeleton-heights.mjs` deltas are content-driven and equal to main's (2c4b348, same seed, same
  > evening): targets 44/0, plan 1051/1003, planets −64/−24, nights −5/−65, events −56/−76, finder 129/−295 at
  > 390/1280 on both. Every page is 4/12 px shorter on the branch, skeleton and real alike (the sub-nav strip in place
  > of the back link). Moon reads −605/−480 on main and −601/−468 here only because its real page is shorter than the
  > viewport (scrollHeight clamped at 844/900), so only the skeleton shows that 4/12 px.
- [x] 2.6 The sub-nav reads as selected, fades and continues the sky in every theme — e25d531

### Phase 3: States, specimens and the rule

#### Automated

- [x] 3.1 The nav type-roles guard passes and fails on a planted size — 215769c
- [x] 3.2 Types, lint and the unit suite pass — 215769c
- [x] 3.3 The build passes — 215769c
- [x] 3.4 The full e2e suite passes on the preview — 215769c

#### Manual

- [x] 3.5 `/design`'s sub-nav block shows every listed state — 215769c
- [ ] 3.6 The owner's walk on the preview
