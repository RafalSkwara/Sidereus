# Quick navigation to Tonight's pages (ui-quick-nav) Implementation Plan

> Roadmap M-4 **S-10** · GitHub issue **#214** · view: **Topbar** (`/10x-ui`) · research: `research.md` (charges C1-C5)
>
> **Implementation starts only after PR #212 (`feat/ui-sky-modes`) merges and this branch is rebased onto the new
> `main`.** The plan is written against #212's version of `TopbarControls.tsx`, `global.css`, `Topbar.astro` and
> `ui/segmented.tsx` (read at `origin/feat/ui-sky-modes` f6b8c97, re-checked at d94bb65 after #212's rebase onto main
> with #217's app icon; plan review F6). The owner's questions are at the end, in Polish; the
> plan is written on the recommended (⭐) answers.

## Overview

One new 44 px icon button in the Topbar's right-hand cluster, beside the theme and settings buttons, opens a native
popover that lists Tonight's seven pages (`TONIGHT_NAV`: the dashboard, Targets, Events, Plan, Moon, Planets, Nights),
so every signed-in screen reaches any of them in two taps without going through the dashboard. It follows the
settings panel's pattern (native `popover`, bottom sheet on phones, panel under the bar from `sm`), uses the
disclosure-navigation semantics, and fits the 320 px Polish Topbar after one budget fix.

## Current State Analysis

- The Topbar (`src/components/Topbar.astro:33-92`) is one `h-16` row: the logo, then an `ml-auto` cluster with the
  four destinations as a pill from `md` (signed in) or the sign-in link (signed out), then the `TopbarControls` React
  island (theme cycle button + settings button with a native popover, `TopbarControls.tsx:178-213`).
- Tonight's pages are reachable from the dashboard's tiles and, on the six focused pages only, from the sub-nav in the
  sky-flow strip (`GearShell.astro:43-47`, `TonightSubNav.astro`). From `/log`, `/gear` or `/log/progress` the way to
  the Session plan is the Tonight tab, then a scroll to the tile (charge C1).
- #212 (open) extracts `ui/segmented.tsx` (`SegmentedGroup`, `SEGMENT_FOCUS_CLASS`) out of `TopbarControls`, adds
  `--topbar-strip-height` / `--tabbar-height` to `global.css`, and adds a second native popover (the sky-mode menu,
  `sky-mode-control.tsx`). The popover classes stay inline per island (charge C2); the settings panel's top is the
  magic `sm:top-23` (charge C3).
- Measured budget (research, "Measurements"): at 320 px in Polish, signed in, the row has 36 px to spare; the button
  plus its gap needs 52 px, so it would push the settings button against the screen edge (header `scrollWidth` 304 >
  288) without any page-level sideways scroll, so `tonight-phone.spec.ts` would stay green. At 768 px in Polish the pill
  would wrap "Dziś w nocy" and "Mój sprzęt" (charge C4). Signed out, the row would scroll sideways at 320 px.
- Two e2e specs locate the pill as `header nav`, and `tonight-subnav.spec.ts` pins one `aria-current="page"` per page
  (F6, owner 2026-10-15) page-wide (charge C5).

## Desired End State

- Signed in, on every page except `/onboarding`, the Topbar shows a grid-icon button labelled "Tonight's pages" /
  "Strony nocy" left of the theme button. It opens a panel titled with the same words and seven rows (icon + name,
  44 px each); on a Tonight page that page's row is filled and carries `aria-current="page"`.
- Below `sm` the panel is a bottom sheet over the TabBar, from `sm` a panel under the bar at its right edge: the same
  look, handle, safe-area padding, light dismiss and Esc as the settings panel, in dark, light and red, EN and PL. On
  Tonight's navy strip in the light theme the panel is light (it carries the page theme).
- Keyboard: Tab reaches the button; Enter or Space opens; focus moves to the current page's row, else the first;
  ArrowUp / ArrowDown / Home / End move between rows; Enter follows a link; Esc closes and returns focus to the
  button; tabbing out of the panel closes it. A screen reader hears a "Quick navigation" landmark, a collapsed /
  expanded button, the list and the current page.
- At 320 px (PL, signed in) the row fits with a 16 px gutter on both sides (the wordmark is set at the `text-label`
  role below 360 px while the button shows); at 768 px (PL) no pill label wraps.
- Signed out and on `/onboarding` there is no button (the TabBar's rule).
- Offline the rows stay enabled: a stored copy of that page answers, a never-opened page falls back to `/offline`
  (the same as the sub-nav and the Tonight tab).

Verify with `tests/e2e/quick-nav.spec.ts` (keyboard journey), the extended `navigation.spec.ts` fit checks, the
unchanged `tonight-phone.spec.ts` (first-screen pin, 320/375 no sideways scroll), the `/design` specimens and the
screenshot gate in `evidence/impl/`.

### Key Discoveries:

- `TopbarControls.tsx:51-61,192-213`: the native popover opens before hydration, closes on Esc or an outside tap and
  returns focus to the button; the panel copies `data-theme` because the Topbar sits in the `night-sky` scope on
  Tonight (`:202-211`).
- `#212 sky-mode-control.tsx`: `beforetoggle` copies `document.documentElement.dataset.theme` onto the panel as it
  opens, the pattern to reuse in a server-rendered component.
- `TabBar.astro:13`: `user !== null && !isCurrentPage(pathname, "/onboarding")` is the app-nav visibility rule.
- `navigation.ts:65-74`: `TONIGHT_NAV` and `currentTonightPage` (exact path match, trailing slash aside) already
  give the menu its items and its current item; `navigation.test.ts` keeps `TONIGHT_NAV` equal to `TONIGHT_PAGES`.
- `copies.ts:150-162`: a bare Tonight path means the remembered site, so plain links reach stored copies offline.
- `tests/e2e/tonight-subnav.spec.ts:88-93,125` and `navigation.spec.ts:16-19,79-98`: the locators and the page-wide
  mark the quick nav would collide with.
- Measurements and mockups: `evidence/budget-320-pl-dark.png`, `evidence/order-768-pl-dark.png` (wrap with the
  button, before the fix).

## What We're NOT Doing

- No change to the TabBar, the pill's destinations, the sub-nav or the dashboard tiles; the quick nav is an addition.
- No finder chart entry (it is a leaf opened from a row, not on `TONIGHT_NAV`).
- No `role="menu"` / `menuitem` (application menus of actions; navigation in a pop-up is a disclosure pattern).
- No offline marking of pages that are not stored on the device (would need the worker's `list-copies` round trip on
  every open; the `/offline` fallback already lists what is stored). Deferred.
- No descriptions under the names (owner Q2, default A) and no new page copy beyond one landmark label.
- No conversion of the settings panel's raw `text-sm` / `text-xs` to type roles (research, deferred charge).
- No pixel baselines (`toHaveScreenshot`): the repo pins layout with bounding boxes; the gate is screenshots in
  `evidence/impl/`.
- No edit to `context/foundation/roadmap.md` (#212 owns the S-10 entry; the status flip is noted for the lead).

## Implementation Approach

`/10x-ui` order: environment (rebase on #212, no new dependency) and token values first, then the one view, then its
states. Phase 1 names the shared Topbar popover contract and the two missing tokens with no visible change; Phase 2
writes the failing e2e journey and fit checks, then adds `QuickNav.astro` to the Topbar with the budget fixes;
Phase 3 shows every state on `/design`, takes the screenshot gate and leaves the rule in `CLAUDE.md`.

The quick nav is an **Astro component with a small client `<script>`**, not a React island: the labels and
`aria-current` are server-rendered, the native popover works before hydration, and nothing needs React state.

### Decisions (defaults; the owner's questions are at the end)

| ID | Decision | Default | Why |
| -- | -------- | ------- | --- |
| D1 | Semantics | Disclosure navigation: `<nav aria-label={nav.quickNav}>` wrapping a `<button popovertarget aria-controls aria-expanded>` and the popover with a heading and a `<ul>` of links | APG's pattern for site navigation in a pop-up; keeps link semantics and `aria-current` |
| D2 | Current page | `aria-current="page"` on the row of the exact current Tonight page (`currentTonightPage`), none elsewhere (finder, log, gear) | The owner's requirement (2026-10-17); it supersedes F6's "one `page` mark per page" for the menu only, whose panel is hidden until opened; the bars keep `ariaCurrentFor` |
| D3 | Visibility | Signed in and not on `/onboarding` (owner Q4 ⭐A), on every other page including the dashboard and the focused pages (Q3 ⭐A) | One stable place; `/tonight*` is gated, and signed out the 320 px row has no room |
| D4 | Icon | lucide `LayoutGrid` (Q1 ⭐A) | Distinct from the theme button's moon and the settings sliders (`evidence/icon-A-moon-beside-theme-375-dark.png`) |
| D5 | Rows | Icon + name, 44 px (Q2 ⭐A): dashboard `NavIcon` "tonight", Targets `Crosshair`, Events `Sparkles`, Plan `ListOrdered`, Moon `Moon`, Planets `Orbit`, Nights `CalendarDays` | Scannable, fits a 568 px phone, reuses `tonight.subnav.*` labels |
| D6 | Order | [Tonight's pages][theme][settings] (Q5 ⭐A) | Settings keeps the edge; the component renders before the island with no React change |
| D7 | Panel form | Bottom sheet below `sm`, panel under the bar from `sm`, the settings panel's classes (Q6 ⭐A) | Thumb reach on a phone, one shared look |
| D8 | 320 px budget | Below 360 px (`xs`), while the quick nav renders, the wordmark uses the `text-label` role (Q7 ⭐A): 19 px left | Keeps every control at 44 px and the signed-in theme button (red mode at the eyepiece) |
| D9 | 768 px | Pill segments `whitespace-nowrap`, `md:px-3 lg:px-3.5` (frees 16 px for the 10 px needed) | No label wraps; icons from `lg` are unchanged |
| D10 | Offline | Plain `TONIGHT_NAV` paths, no `data-needs-network`, no view-transition names | Same rule as the sub-nav and the Tonight tab |

## Critical Implementation Details

- **DOM order (review F7).** Inside the `<nav>`, the `<div popover>` comes immediately after the `<button>`, so the
  Tab order button → rows holds even in a browser without popover-invoker focus navigation; never move the panel to
  the end of `<header>` or the body.
- **Focus and the top layer.** The popover sits in the top layer; with the panel right after the trigger, Tab from
  the button enters the panel. The script moves focus into the panel on the `toggle` event (`newState === "open"`),
  to `[aria-current="page"]` if present, else the first link; native Esc then restores focus to the button because
  focus was inside.
- **Closing on focus leaving (review F1).** On `focusout`, close (`hidePopover()` only, never moving focus) **only when
  `relatedTarget` is a concrete element outside both the panel and the trigger** (Tab past the last row). A `null`
  `relatedTarget` is ignored: a tap on the panel's heading, handle or gap, and Safari's mouse/tap on a link (WebKit
  does not focus links on click), both blur to `null`, and closing then would swallow the tap before `click`. Every
  other dismissal (outside tap, Esc) is left to the native popover's light dismiss.
- **Back/forward cache (review F4).** On `pagehide`, `hidePopover()` if open, so returning with Back never shows the
  menu still open over the page the user left.
- **Theme in the night-sky scope.** On `beforetoggle` (opening) copy `document.documentElement.dataset.theme` to the
  panel's `data-theme`, as #212's sky-mode control does: the theme can change on the page after render, so a
  server-rendered `data-theme` alone would be stale.
- **`aria-expanded`.** Set it explicitly from the `toggle` event (server-rendered `false`): Chromium derives it from
  `popovertarget`, WebKit does not consistently, and the e2e journey asserts it.
- **One auto popover at a time.** Settings and the quick nav are both `popover="auto"`; opening one closes the other,
  which is the intended behaviour; do not make either `manual`.
- **The `header nav` locators.** A second `<nav>` inside `<header>` makes `header nav` match two elements; the pill
  gets `data-topbar-nav` and both specs locate it by that attribute in the same phase.

## Phase 1: Rebase on #212 and the shared Topbar popover contract

### Overview

Bring the branch onto the merged #212 and name the parts a second Topbar popover needs, with no visible change: one
module for the Topbar's icon button and panel classes, a placement utility built on #212's strip-height token, and an
`xs` breakpoint token for the 320 px fix (charges C2, C3).

### Changes Required:

#### 1. Rebase

**File**: branch `feat/ui-quick-nav`

**Intent**: Once #212 is merged, rebase onto `origin/main`, run `npm ci`, and confirm the #212 names this plan uses
exist: `src/components/ui/segmented.tsx` (`SEGMENT_FOCUS_CLASS`), `--topbar-strip-height` in `global.css`. If #212
changed them before merging, adjust this plan's names first.

**Contract**: no code change; a clean `git rebase` and green `npm run test:reference`.

#### 2. Tokens

**File**: `src/styles/global.css`

**Intent**: Add a `--breakpoint-xs: 22.5rem` breakpoint (the 320 px fix needs a variant below `sm` without an
arbitrary value) and a `topbar-panel-top` utility that places a Topbar panel 4 px under the strip
(`calc(var(--topbar-strip-height) + 0.25rem)`, which resolves to today's 92 px from `sm`).

**Contract**: `xs:` / `max-xs:` variants exist; `@utility topbar-panel-top`. No colour token, so no theme block, the
contrast test and the red test are untouched.

#### 3. Shared Topbar popover classes

**File**: `src/components/ui/topbar-popover.ts` (new, island-safe: `cn` and `SEGMENT_FOCUS_CLASS` only)

**Intent**: Move TopbarControls' `iconButton` and `panelClass` (and the sheet handle) here as named exports, with the
panel's `sm:top-23` replaced by `sm:topbar-panel-top`, and the icon button's pressed look also applied on
`aria-expanded` (the quick nav's open state).

**Contract**: `TOPBAR_ICON_BUTTON_CLASS`, `TOPBAR_PANEL_CLASS`, `TOPBAR_SHEET_HANDLE_CLASS`; the settings panel
renders the same pixels as before.

#### 4. TopbarControls reads them

**File**: `src/components/TopbarControls.tsx` (`TopbarControls` is not in `island-imports.test.ts`'s source lists on
#212, so no allowlist edit is expected; re-check after the rebase)

**Intent**: Replace the inline constants with the shared ones; nothing else changes.

**Contract**: same markup and classes at runtime (the settings panel at 92 px from `sm`).

### Success Criteria:

#### Automated Verification:

- The branch is rebased on a `main` that contains #212, and `npm ci` succeeds
- `npm run test:reference` passes
- `npm run lint` and `npx astro check` pass
- `npx playwright test navigation.spec.ts red-night-mode.spec.ts` passes against a local preview (BASE_URL on the agent's own port, never 4413)

#### Manual Verification:

- The settings panel looks and sits as before at 375 and 1280 px in dark, light and red (before/after screenshots in `evidence/impl/phase1-*`)

**Implementation Note**: After this phase and its automated checks, pause for the manual check before Phase 2 (in an
autonomous multi-phase run, commit and defer the manual rows).

---

## Phase 2: The quick nav in the Topbar

### Overview

Write the failing journey and fit checks first, then add `QuickNav.astro` to the Topbar with the 320 px and 768 px
budget fixes and the re-scoped specs (charges C1, C4, C5).

### Changes Required:

#### 1. The failing tests first

**File**: `tests/e2e/quick-nav.spec.ts` (new; imports `test` from `./helpers`, clock-pinned, default `evening`)

**Intent**: One journey, the only protection of the keyboard and screen-reader contract: signed out on `/` there is no
trigger; then `onboardInMadrid`, the light theme cookie, open `/log` at 1280 px and, **keyboard only**, Tab to the
trigger (a bounded loop that fails after 20 presses), Enter: the panel is open, `aria-expanded="true"`, the panel
carries `data-theme="light"`, focus is on the first row (Tonight). ArrowDown to Moon, Enter: the URL is
`/tonight/moon` and the sub-nav's Moon chip is current. Tab back to the trigger, Enter: focus lands on the Moon row,
which has `aria-current="page"`. Esc: the panel is hidden, `aria-expanded="false"`, focus is on the trigger.

**Contract**: locators by role and name (`getByRole("button", { name: t.subnav.label })`, rows `exact: true` since
"Plan" is a substring of "Planets"); `data-quick-nav-panel` only to read `data-theme`.

**File**: `tests/e2e/navigation.spec.ts`

**Intent**: Pin the two budget risks that today's checks miss, with no new test (review F2): the existing 320×700
Polish test on `/log` ("the TabBar's four Polish tabs fit a 320 px phone", `:35`, retitled "…tabs and the Topbar row
fit a 320 px phone") also asserts that the header does not overflow (`scrollWidth <= clientWidth`), that the quick-nav
trigger is visible, and that the last control ends at least 16 px from the viewport's right edge; the existing
768/1024 test also asserts that each pill link's label is one line (one client rect for its text range), and its
"the pill must end left of the controls" check measures to the left edge of `[data-quick-nav-trigger]`, the first
control, instead of the settings button's parent (review F3: otherwise the pill could overlap the new button
unseen). Locate the pill as `header [data-topbar-nav]`.

**File**: `tests/e2e/tonight-subnav.spec.ts`

**Intent**: Locate the pill bar as `header [data-topbar-nav]`; the page-wide "one `aria-current="page"`" checks
(`:88-93`, `:125`) exclude `[data-quick-nav]`, with a comment recording the requirement change (owner 2026-10-17,
D2). No new assertion on the menu's mark (review F2: `quick-nav.spec.ts` holds it, from the same
`currentTonightPage` rule the sub-nav uses).

**Contract**: these fail (red) before the component exists: no trigger, no `data-topbar-nav`.

#### 2. App-nav visibility in one place

**File**: `src/lib/navigation.ts`, `src/components/TabBar.astro`

**Intent**: Name the TabBar's rule (signed in, not on `/onboarding`) as one exported function so the TabBar and the
quick nav cannot disagree.

**Contract**: `appNavVisible(signedIn: boolean, pathname: string): boolean`; `TabBar` uses it with no behaviour
change.

#### 3. The component

**File**: `src/components/QuickNav.astro` (new)

**Intent**: The D1 structure from `TONIGHT_NAV`, labels from `tonight.subnav`, the D5 icons in a map typed by
`TonightNavItem["label"]` (a new Tonight page fails the type check until it has an icon), the current row from
`currentTonightPage(Astro.url.pathname)` filled like the sub-nav's current chip (`bg-selected
text-selected-foreground`), other rows `text-heading hover:bg-accent`, icons muted, each row `min-h-11` with the
`--ring` focus outline; the trigger is `TOPBAR_ICON_BUTTON_CLASS` with the `LayoutGrid` icon; the panel is
`TOPBAR_PANEL_CLASS` with the sheet handle, a visible heading (`text-label`, muted) and the list. The client script
does what "Critical Implementation Details" lists: `aria-expanded`, theme copy, focus on open, arrow / Home / End
keys, close when focus moves to an element outside the panel and the trigger (never on a `null` target), close on
`pagehide`.

**Contract**: structure `<nav data-quick-nav>` > `<button data-quick-nav-trigger>` immediately followed by
`<div popover data-quick-nav-panel>` (review F7); markers `data-quick-nav` (the `<nav>`), `data-quick-nav-trigger`,
`data-quick-nav-panel`; props for
`/design` only, as `TonightSubNav` has them: `current?: TonightNavItem["href"]` (no `aria-current`, no ids reused),
`pinned?: { href; class }` and `inline?: true` (the panel rendered in flow, not as a popover, for the static
specimens). No `data-needs-network`, no `view-transition-name`. Tokens only; the hardcoded-value scan stays at 0.

#### 4. The Topbar

**File**: `src/components/Topbar.astro`

**Intent**: When `appNavVisible`, render `QuickNav` before `TopbarControls` inside one `flex items-center gap-2`
wrapper (the island root is `display: contents`, so the three buttons share one 8 px gap); set the wordmark to
`max-xs:text-label` only while the quick nav renders (D8; signed out and on the landing nothing changes); add
`data-topbar-nav`, `whitespace-nowrap` and `md:px-3 lg:px-3.5` to the pill's links (D9).

**Contract**: the header stays `h-16` (the phone first-screen pin is unaffected); the comment block above `<header>`
names the quick nav and the 320 px budget (19 px left).

#### 5. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: The landmark's name, distinct from the sub-nav's "Tonight's pages" so the focused pages do not carry two
landmarks with one name.

**Contract**: `nav.quickNav`: EN "Quick navigation", PL "Szybka nawigacja". The button and the panel heading reuse
`tonight.subnav.label` ("Tonight's pages" / "Strony nocy").

### Success Criteria:

#### Automated Verification:

- `quick-nav.spec.ts` and the new `navigation.spec.ts` checks fail before the component and pass after it
- `npx playwright test quick-nav.spec.ts navigation.spec.ts tonight-subnav.spec.ts tonight-phone.spec.ts landing.spec.ts` passes on a fresh `npm run build` + preview, the forecast fixture and local Supabase (keys inline, never exported)
- `npm run test:guards` passes (it holds `no-hardcoded-colors.test.ts`, which `test:reference` does not run) and the `/10x-ui` hardcoded-value grep (research "Pre-audit") on `Topbar.astro`, `QuickNav.astro`, `TopbarControls.tsx`, `ui/topbar-popover.ts` returns 0 hits
- `npm run test:reference`, `npm run lint` and `npx astro check` pass

#### Manual Verification:

- On a phone (or 320 and 375 px emulation) in Polish and English: the row fits with its gutter, the sheet opens over the TabBar, every row is a 44 px target, the current page is filled
- Dark, light and red on `/log` and on a focused page: the panel follows the page theme, red tells the current row by its fill
- VoiceOver (macOS Safari): "Szybka nawigacja" landmark, "Strony nocy, przycisk, zwinięty / rozwinięty", the list, "bieżąca strona" on the current row; Esc returns to the button

**Implementation Note**: After this phase and its automated checks, pause for the manual checks before Phase 3.

---

## Phase 3: States, the visual gate and the rule

### Overview

Show every state of the trigger and the panel on `/design`, capture the screenshot gate, and leave the rule that keeps
the next Topbar control on the contract.

### Changes Required:

#### 1. `/design` specimens

**File**: `src/pages/design.astro`

**Intent**: A `QuickNav` block next to `TonightSubNav` with the 7-state matrix: trigger default, hover and
focus-visible (pinned classes), expanded (pressed fill); the panel inline (`inline`) with Targets current, a hovered
row and a focused row, on the night strip and on the plain ground, plus one phone-width (`max-w-xs`) panel.

**Contract**: the N/A line: disabled N/A (the rows work offline, plain paths as the sub-nav); error N/A (no input);
empty N/A (seven fixed pages); loading N/A (server-rendered in the Topbar, no data).

#### 2. Screenshot gate

**File**: `context/changes/ui-quick-nav/evidence/impl/`

**Intent**: `/design`'s QuickNav block at 1280 and 375 px in dark, light and red (dev server on port 4345 only, stopped
afterwards); the live app on the preview, signed in: `/log` at 320 px PL with the sheet open, a focused page at 375 px
EN in light with the sheet open, `/log` at 768 px PL and 1280 px with the panel open. Compare with the mockups in
`evidence/` and note any delta.

**Contract**: screenshots only; no `toHaveScreenshot` baseline.

#### 3. The rule

**File**: `CLAUDE.md` (Architecture → Layout / Navigation; UI → Tonight's sky)

**Intent**: Name the quick nav (where it shows, its semantics, that it reuses `TONIGHT_NAV` and `currentTonightPage`,
the `aria-current` amendment D2), the shared popover module ("a new Topbar control uses `TOPBAR_ICON_BUTTON_CLASS`, a
new Topbar panel `TOPBAR_PANEL_CLASS` and `topbar-panel-top`"), the budget ("the 320 px Polish Topbar has 19 px left
with the quick nav; a new Topbar control needs a measured budget and the `navigation.spec.ts` fit checks"), and that a
new Tonight page joins `TONIGHT_NAV`, `TONIGHT_PAGES` and the quick nav's icon map.

**Contract**: edits outside any generated block; no rule invites one-off values.

#### 4. Notes for the lead

**File**: `context/changes/ui-quick-nav/plan.md` (this section's Progress rows) and the PR description

**Intent**: The roadmap's S-10 status flip (`proposed` → `in-progress`, then `done`) is the lead's or #212's to make,
not this branch's; `CLAUDE.md` names `src/components/nav-type-roles.test.ts`, which the test-suite diet removed (fix
the sentence in the same `CLAUDE.md` edit).

**Contract**: no edit to `context/foundation/roadmap.md`.

### Success Criteria:

#### Automated Verification:

- `npm run test:reference`, `npm run lint` and `npx astro check` pass
- The whole e2e suite (`npm run test:e2e`) and `npm run smoke` pass locally the way CI runs them (lessons: "Run the whole e2e suite before a PR")

#### Manual Verification:

- `/design` shows every cell of the 7-state matrix or its N/A line, in dark, light and red
- The screenshot gate in `evidence/impl/` matches the agreed mockups (deltas explained)
- The `CLAUDE.md` rule reads correctly to a fresh agent: where the quick nav lives, the popover module, the budget

---

## Testing Strategy

### Unit Tests:

- None new. The visibility rule (`appNavVisible`) and the current row (`currentTonightPage`) are one-line reuses
  exercised by the e2e journey; `navigation.test.ts` already keeps `TONIGHT_NAV` and `TONIGHT_PAGES` in step, and the
  icon map's type covers a new page. (Lessons: name the risk a test is the only protection of.)

### Integration Tests:

- `quick-nav.spec.ts`: the keyboard-only journey from a non-Tonight screen to a focused page, `aria-expanded`, focus on
  open, `aria-current`, Esc, the page theme on the panel, and no trigger signed out.
- `navigation.spec.ts` (no new test, review F2/F3): the existing 320 px Polish test also holds the Topbar row and its
  gutter; the 768 / 1024 px test also holds one-line pill labels and measures the pill to the quick-nav trigger.
- `tonight-subnav.spec.ts`: the page-wide mark re-scoped to exclude `[data-quick-nav]` (no new menu assertion).
- Unchanged and still required green: `tonight-phone.spec.ts` (first screen at 390×844, no sideways scroll at 320/375
  in EN and PL on ten pages), `landing.spec.ts` (320/360 signed out), `red-night-mode.spec.ts`.

### Manual Testing Steps:

1. On `/log/new` on a phone, tap the grid button, tap Plan: the Session plan opens.
2. On `/tonight/targets`, open the menu: Targets is filled; Esc closes; the sub-nav still scrolls as before.
3. In red mode at night: the button, the sheet and the current row are readable; nothing white flashes.
4. Offline (after visiting Targets online): open the menu, tap Targets (the stored copy), tap Nights if never opened
   (the `/offline` page).

## Performance Considerations

One small processed `<script>` per page (event listeners on one element); no React island, no new dependency, no
network request. The lucide icons are server-rendered SVG.

## Migration Notes

None (no data, no route). Rollback is reverting the merge commit.

## QUESTIONS FOR OWNER

Plan jest napisany na rekomendowanych odpowiedziach (⭐). Zrzuty i makiety: `context/changes/ui-quick-nav/evidence/`
(makiety z serwera deweloperskiego na prawdziwych tokenach; pasek z przyciskiem odtworzony ręcznie).

**P1. Ikona przycisku** (`evidence/icons-dark.png`, `icons-light.png`, `icons-red.png`,
`icon-A-moon-beside-theme-375-dark.png`)

- **A ⭐ Siatka (LayoutGrid).** Czytelne „wszystkie strony"; nie myli się z księżycem przycisku motywu ani z suwakami
  ustawień.
- **B Księżyc z gwiazdką + strzałka w dół.** Wiąże przycisk z zakładką „Dziś w nocy", ale w ciemnym motywie stoi tuż
  obok księżyca przycisku motywu: dwa księżyce obok siebie.
- **C Drogowskaz (Signpost).** Metafora nawigacji, nieużywana nigdzie indziej; mniej rozpoznawalna.
- **D Hamburger (Menu).** Najbardziej znany, ale obiecuje „całe menu aplikacji", a to tylko strony nocy.

**P2. Co jest w panelu** (`evidence/list-A-icons-sheet-375-pl-dark.png`, `list-B-desc-sheet-375-pl-dark.png`,
`list-C-text-sheet-375-pl-dark.png`)

- **A ⭐ Ikona + nazwa, 7 wierszy po 44 px.** Szybko się skanuje, mieści się na ekranie 568 px, bez nowych tekstów.
- **B Ikona + nazwa + jednolinijkowy opis** („Cele — co obserwować, po kolei"). Pomaga początkującym, ale wiersze po
  56 px, 14 nowych tekstów EN+PL, arkusz zajmuje prawie cały mały ekran.
- **C Same nazwy** (jak chipy sub-nava). Najkrótsze, ale gorzej się skanuje.

**P3. Czy przycisk jest też na stronach Tonight** (`evidence/list-A-icons-sheet-375-pl-dark.png`: sub-nav i otwarty
panel na stronie Cele)

- **A ⭐ Na każdym ekranie, także na dashboardzie i sześciu stronach z sub-navem.** Stałe miejsce, pasek się nie
  zmienia; zamknięte menu niczego nie dubluje, a otwarte zaznacza bieżącą stronę.
- **B Ukryty na sześciu stronach z sub-navem.** Zero dublowania, ale przycisk pojawia się i znika, wbrew „z każdego
  ekranu".
- **C Ukryty na wszystkich stronach /tonight.** Dashboard ma kafelki; najmniej dublowania, ale z dashboardu do Planu
  dalej trzeba przewijać.

**P4. Niezalogowani** (`evidence/order-320-pl-signed-out.png`: z przyciskiem pasek ma 353 px na ekranie 320 px)

- **A ⭐ Ukryty, także na /onboarding** (jak TabBar). Każda strona nocy wymaga logowania; w polskim pasku z „Zaloguj
  się" nie ma miejsca.
- **B Widoczny od 640 px, linki prowadzą do logowania i wracają na wybraną stronę.** Zachęta, ale menu stron, których
  gość nie zobaczy.
- **C Widoczny zawsze.** Przy 320 px trzeba by ukryć coś innego (np. link logowania).

**P5. Kolejność przycisków** (`evidence/order-375-pl-dark.png`, `order-768-pl-dark.png`)

- **A ⭐ [Strony nocy] [Motyw] [Ustawienia].** Nawigacja obok pigułki z celami, Ustawienia zostają na krawędzi jak
  dziś.
- **B [Motyw] [Strony nocy] [Ustawienia].** Przycisk motywu się nie przesuwa, ale nawigacja ląduje między dwoma
  przyciskami preferencji.
- **C [Motyw] [Ustawienia] [Strony nocy].** Skrajnie po prawej; Ustawienia przestają być na krawędzi, a przycisk
  trzeba przenieść do wyspy React.

**P6. Forma panelu na telefonie** (`evidence/sheet-log-320-pl-red.png`, `sheet-log-375-en-light.png`,
`panel-dropdown-375-pl-dark.png`, `panel-desktop-1280-pl-dark.png`, `panel-desktop-1280-en-light-tonight.png`)

- **A ⭐ Arkusz od dołu na telefonie, panel pod paskiem od 640 px** — dokładnie jak Ustawienia. W zasięgu kciuka,
  jeden wygląd dla obu paneli.
- **B Lista rozwijana pod przyciskiem na każdej szerokości** (jak menu trybu nieba z #212). Bliżej przycisku, ale na
  telefonie u góry ekranu, poza zasięgiem kciuka.

**P7. Miejsce w pasku przy 320 px** (`evidence/budget-320-pl-dark.png`, `topbar-320-pl-dark-recommended.png`)

- **A ⭐ Poniżej 360 px nazwa „Sidereus" mniejsza (rola `text-label`), tylko gdy przycisk jest widoczny.** Zostaje
  19 px zapasu, wszystkie przyciski mają 44 px.
- **B Poniżej 360 px sama gwiazdka** (nazwa zostaje dla czytników ekranu). 106 px zapasu, ale na małych telefonach
  znika nazwa aplikacji.
- **C Ciaśniejsze odstępy** (2 px między przyciskami, 8 px od logo). 0 px zapasu, kruche przy każdej zmianie.
- **D Ukryć przycisk motywu poniżej 360 px także po zalogowaniu.** Wbrew decyzji „tryb czerwony jednym dotknięciem
  przy okularze"; motyw zostaje w Ustawieniach.

## Open Risks & Assumptions

- **#212 overlap** (re-checked at d94bb65, review F6: `git diff origin/main...origin/feat/ui-sky-modes --stat`, 97
  files). Both changes edit `TopbarControls.tsx` (#212: its class constants and the language-loading state),
  `global.css` (`:root` and the utilities), the comment above `Topbar.astro`'s `<header>`, `src/pages/design.astro`
  (#212 +272 lines of specimens; this plan's Phase 3 adds the QuickNav block), the i18n catalogues and `CLAUDE.md`.
  `tests/e2e/helpers.ts` changed on `main` since this branch's base (e563fda → 0b9fc6e, #217 / #218), so Phase 2's
  specs are written against the rebased helpers. The names this plan uses (`SEGMENT_FOCUS_CLASS`,
  `--topbar-strip-height`, `right-topbar-edge`, `sm:top-23` in `panelClass`) are unchanged at d94bb65. Phase 1 starts
  by checking them; rebasing before the merge would replay #212's conflicts twice.
- **320 px budget.** 19 px left after D8 (measured with Archivo loaded). Before the web font swaps in, the fallback
  font's wordmark may be wider for a moment; the fit check measures after `document.fonts.ready`. Any later Topbar
  control needs a new budget.
- **768 px budget.** About 6 px left in Polish after D9.
- **F6 amendment (D2).** The page-wide single `aria-current="page"` rule gets one exception (the menu's row);
  plan review should confirm the owner reads the 2026-10-17 requirement that way.
- Safari's popover support (17+) is already relied on by the settings panel.

## Plan review triage

Review: `reviews/plan-review.md` (herdr `reviewer`, 2026-10-17, NEEDS ATTENTION, 0 critical · 3 warnings · 4
observations). Triage by the orchestrator, applied 2026-10-17 (docs only; the owner's P1-P7 answers and #212's merge
are still pending).

| Finding | Decision | What changed in this plan |
| ------- | -------- | ------------------------- |
| F1 (warning) `focusout` closing swallows taps in Safari | Accepted | Critical Implementation Details: close only when `relatedTarget` is a concrete element outside the panel and the trigger; `null` ignored; every other dismissal left to the native light dismiss. Phase 2 › 3 Intent updated |
| F2 (warning) test diet: new 320 px test, repeated menu marks | Accepted | Phase 2 › 1: the 320 px fit folded into the existing TabBar test (retitled); `tonight-subnav.spec.ts` only excludes `[data-quick-nav]` from the count; Testing Strategy updated |
| F3 (warning) "pill ends before the controls" misses the new button | Accepted | Phase 2 › 1: the 768/1024 check measures the pill to `[data-quick-nav-trigger]` |
| F4 (observation) bfcache restores an open menu | Accepted | Critical Implementation Details: `pagehide` closes the panel; Phase 2 › 3 Intent updated |
| F5 (observation) the hardcoded-value scan has no command | Accepted | Criterion 2.3 (and its Progress row): `npm run test:guards` plus the `/10x-ui` grep on the four files |
| F6 (observation) #212 moved past f6b8c97 | Accepted | Header and Open Risks: #212 at d94bb65 (97 files vs main); overlap adds `src/pages/design.astro`, the i18n catalogues, `CLAUDE.md` and `tests/e2e/helpers.ts` (changed on main since this branch's base) |
| F7 (observation) DOM order of the panel | Accepted | Critical Implementation Details and Phase 2 › 3 Contract: `<nav>` > `<button>` immediately followed by `<div popover>` |

## References

- Research and charges: `context/changes/ui-quick-nav/research.md`
- Mockups and measurements: `context/changes/ui-quick-nav/evidence/`
- Pattern: `src/components/TopbarControls.tsx:51-61,192-213`; #212 `src/components/tonight/sky-mode-control.tsx`
- Sub-nav and the F6 rule: `src/components/tonight/TonightSubNav.astro`, `src/lib/navigation.ts:39-74`,
  `context/archive/2026-10-15-ui-tonight-nav/plan.md`
- Specs: `tests/e2e/navigation.spec.ts`, `tests/e2e/tonight-subnav.spec.ts`, `tests/e2e/tonight-phone.spec.ts`
- Roadmap entry (owned by #212): `context/foundation/roadmap.md` on `origin/feat/ui-sky-modes`, S-10

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Rebase on #212 and the shared Topbar popover contract

#### Automated

- [ ] 1.1 The branch is rebased on a `main` that contains #212, and `npm ci` succeeds
- [ ] 1.2 `npm run test:reference` passes
- [ ] 1.3 `npm run lint` and `npx astro check` pass
- [ ] 1.4 `npx playwright test navigation.spec.ts red-night-mode.spec.ts` passes against a local preview (BASE_URL on the agent's own port, never 4413)

#### Manual

- [ ] 1.5 The settings panel looks and sits as before at 375 and 1280 px in dark, light and red (before/after screenshots in `evidence/impl/phase1-*`)

### Phase 2: The quick nav in the Topbar

#### Automated

- [ ] 2.1 `quick-nav.spec.ts` and the new `navigation.spec.ts` checks fail before the component and pass after it
- [ ] 2.2 `npx playwright test quick-nav.spec.ts navigation.spec.ts tonight-subnav.spec.ts tonight-phone.spec.ts landing.spec.ts` passes on a fresh `npm run build` + preview, the forecast fixture and local Supabase (keys inline, never exported)
- [ ] 2.3 `npm run test:guards` passes (it holds `no-hardcoded-colors.test.ts`, which `test:reference` does not run) and the `/10x-ui` hardcoded-value grep (research "Pre-audit") on `Topbar.astro`, `QuickNav.astro`, `TopbarControls.tsx`, `ui/topbar-popover.ts` returns 0 hits
- [ ] 2.4 `npm run test:reference`, `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 2.5 On a phone (or 320 and 375 px emulation) in Polish and English: the row fits with its gutter, the sheet opens over the TabBar, every row is a 44 px target, the current page is filled
- [ ] 2.6 Dark, light and red on `/log` and on a focused page: the panel follows the page theme, red tells the current row by its fill
- [ ] 2.7 VoiceOver (macOS Safari): "Szybka nawigacja" landmark, "Strony nocy, przycisk, zwinięty / rozwinięty", the list, "bieżąca strona" on the current row; Esc returns to the button

### Phase 3: States, the visual gate and the rule

#### Automated

- [ ] 3.1 `npm run test:reference`, `npm run lint` and `npx astro check` pass
- [ ] 3.2 The whole e2e suite (`npm run test:e2e`) and `npm run smoke` pass locally the way CI runs them (lessons: "Run the whole e2e suite before a PR")

#### Manual

- [ ] 3.3 `/design` shows every cell of the 7-state matrix or its N/A line, in dark, light and red
- [ ] 3.4 The screenshot gate in `evidence/impl/` matches the agreed mockups (deltas explained)
- [ ] 3.5 The `CLAUDE.md` rule reads correctly to a fresh agent: where the quick nav lives, the popover module, the budget
