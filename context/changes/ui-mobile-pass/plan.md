# Phone-first UI pass of the Tonight dashboard — Implementation Plan

## Overview

Make `/tonight` lead with its answer on a phone. The verdict, then the gear it is for, then "Point here first" with its first target should come in one screen at 390×844, instead of 1.5 screens of sky first. Desktop stays as approved, except for the verdict word: one tier smaller on desktop, and two tiers smaller on phones (plan review F1). The live panorama is **not touched**. Everything around it gets a phone rhythm, and the shared parts (`--text-display`, `Band`, `GearShell`) carry that rhythm to every other view.

Roadmap M-3 **S-01** (MS-01, PRD NFR phone first `context/foundation/prd.md:516-520`), GitHub #122. `/10x-ui` contract variant: **existing design system (Nightfall)**, no new dependency.

## Current State Analysis

Measured on the production preview against local Supabase and the all-clear forecast fixture (`research.md` › Measured layout):

- **The first tile starts at y = 916 px at every phone width.** The usable screen ends at 603 px (375×667) or 780 px (390×844), above the 64 px TabBar. The sky stack runs from y 80 to y 884. Its pieces are the verdict container `min-h-109` (436 px), the panorama `h-52` with `-mt-24`, the silhouette (32 px) and the slider row `h-32` (128 px), all in `src/components/tonight/sky-band.ts:10-34`, plus `pt-8` (`TonightContent.astro:166`).
- **No horizontal overflow** on `/tonight`, `/tonight/{targets,plan,moon}`, `/gear` or `/log` at 320, 375, 390 or 1280 px (EN). PL was measured on `/tonight` only.
- **No token debt.** The hardcoded-value scan finds 0 hits in the 12 dashboard files (guard: `src/styles/no-hardcoded-colors.test.ts`). The problems are rhythm, order and hierarchy (charges C1–C5 in `research.md`).

### Key Discoveries:

- **Type roles are in `@theme inline`** (`src/styles/global.css:519`), so the values are inlined into the utilities. A phone step for `--text-display` must be a fluid value (`min()`/`clamp()` with `vw`), as the verdict roles already are (`global.css:540-562`). A `:root` media-query override would do nothing.
- **The compass row is placed by measuring the verdict's text** (`TonightSkyView.tsx:207-238`), clamped to the overlap's foot (`STRIP_OVERLAP_PX - COMPASS_ROW_PX`). The verdict can lose its reserved height without touching the panorama code, as long as the container keeps its bottom padding (`pb-10`). That padding keeps the text's foot above the compass row.
- **The skeleton reserves the same heights through `sky-band.ts`** (`TonightSkeleton.astro:7,27-47`). Every height this plan changes must change in `sky-band.ts` and nowhere else.
- **The giant word's size picker** is `verdictSize` in `VerdictCard.astro:48-53`. The dangling "— reason" is a literal em dash in the template (`:87`), and the date line chains date · dark window · zone in one `<p>` (`:63-77`, `timesIn` carries a leading " · ", `en.ts:493`).
- **The tile markup is copied 5×** (`TonightTiles.astro:107,137,150,173,190`, classes `:38-41`). The row class is copied again in `TonightSkeleton.astro:17`. `SessionTimeline size="mini"` (with `MINI_DOTS`) is used only by the Plan tile (`TonightTiles.astro:143`), and `/design` has no SessionTimeline specimen. The `/design` tile hover and focus specimens select by depth (`design.astro:521-527`, `*:*:bg-accent`), so a tile's root element must stay the `<a>`.
- **Landing and auth copy the shell instead of reusing it.** `Welcome.astro:38,70` and `AuthShell.astro:28,31,36` repeat GearShell's Topbar, header and main paddings. Both render `PageHeader` (`Welcome.astro:47`, `AuthShell.astro:34`), and the landing renders `TonightSky` (`Welcome.astro:45`), which uses `VERDICT_CONTAINER_CLASS`. So do the focused pages (`TonightPageSky.astro:25`, `TonightPageSkeleton.astro:34`), the no-view setup sky (`TonightContent.astro:143`) and the no-DB sky (`pages/tonight.astro:50`).
- **The dashboard notice comes from the sky-check form in practice** (`?skyChecked` / `?error`). "Mark observed" on the focused pages returns to those pages (`tonightReturnPath`, `src/lib/log/redirect.ts:26-29`).
- **The block order under the sky is the order features shipped** (`TonightContent.astro:164-253`): notice → tiles → sky check → gear line and selectors → errors → prompts.
- E2E specs that touch the moved structure are `tonight-dashboard`, `tonight-sky`, `telescope-selector`, `seven-night-planner`, `offline` and `landing-screenshot`. All of them run in the Desktop Chrome project (1280×720), so the phone-only layout cannot break them.
- One break is known in advance: `telescope-selector.spec.ts:93-94` finds the gear link by the text "·", which the new Moon line also contains (plan review F4).

## Desired End State

On a 390×844 phone, `/tonight` reads top to bottom:

1. The topbar.
2. The verdict block:
   - date, then dark window, then time zone, each on its own line;
   - the verdict word two tiers smaller on phones (one on desktop);
   - "● Clear · <reason>" flowing on one line, with the headline at title size and the reason at body size;
   - "Forecast updated …" shown on phones only when stale or missing.
3. The **unchanged** panorama, silhouette, and a one-row slider (time · track · Now) with its legend.
4. Any save notice.
5. The gear row ("Home · 150 mm reflector" and the site/telescope selectors).
6. "Point here first" with its target rows.

All of that is above the TabBar. The remaining tiles are compact: Session plan, Moon and Planets each show a heading plus one short summary, and the 7-night bars are shorter on phones. The focused Tonight pages, `/gear` and `/log` get shorter headers and tighter bands through the shared parts. Nothing scrolls sideways at 320 px. A committed e2e spec guards the phone first screen, and CLAUDE.md tells the next agent how to keep it.

Verify with `tests/e2e/tonight-phone.spec.ts` plus the screenshot matrix (Phase 4).

## What We're NOT Doing

- **The panorama:** no change to the strip height (`h-52`), the overlap (`-mt-24`), the projection, labels, markers, chevrons or the silhouette (user, 2026-10-07: "it's sensitive to changes").
- **Replacing the verdict word.** It stays, only smaller (user). A different hero is for S-02 if the user still finds it odd.
- **Rewriting the verdict reason copy.** The existing reason text flows after the headline with a separator, and no new short-reason catalogue is added.
- **Moving the sky check.** It stays after the tiles (user: "the rest is mostly fine").
- **A site switcher in the Topbar, and gear in the verdict lines** (user chose "row right under the sky").
- **Deferred charges** (`research.md` › Deferred):
  - D1: the focused target cards and the nested scroll region on `/tonight/targets` (S-03/S-04 rework them);
  - D2: a shared list row for gear, log and Targets;
  - D3: `/log/sky` rows and onboarding density;
  - D4: NightStrip `w-26` and `whitespace-nowrap` on long PL buttons (no overflow reproduced);
  - D5: the silent `catch { skyView = null }` (`src/lib/tonight/build.ts:1006-1008`), which needs its own small fix change. This plan adds no new silent catch.
- **A first-screen guarantee below 390×844.** With the panorama untouched, the first tile starts at about 715–743 px at 360×780 and 375×667 (plan review F1 arithmetic), under their TabBars. The gate is 390×844 (EN, all-clear fixture), and the smaller sizes are recorded as known limits.
- No new dependency, no screenshot-diff tooling (`toHaveScreenshot` baselines). The gate is geometric (bounding boxes) plus the manual matrix.

## Implementation Approach

The `/10x-ui` order is environment/library → token values → one view → states. There is no library step (nothing to install), so:

1. Token values and shared parts first. Every view gets the phone rhythm, and the dashboard work after it builds on the final rhythm.
2. The `Tile` component next (fix the contract before the pixels).
3. Then the dashboard's first screen.
4. Last, the gate, the 7-state matrix and the guard rule.

Each visual phase ends with screenshots at 390 px and 1280 px and the hardcoded-value scan on the touched files, which must stay at 0.

## Critical Implementation Details

- **One source for heights.** Phone values for the verdict min-height and the slider row go into `sky-band.ts` as responsive class strings (`<phone> sm:<desktop>`). `TonightSkyView`, `TonightSky` and `TonightSkeleton` read them from there, and none of them hardcodes its own copy.
  - The verdict's min-height is the new EN go verdict's content height, **measured at 360 px for the phone value and at 640 px for the `sm` value**, so the skeleton paints the same sky. Re-measure after the copy and size changes; don't compute it.
  - A taller verdict still grows the page after the swap. That happens narrower than 360 px, in PL, with an explanation, or with multi-site pills. This is accepted and recorded (plan review F2).
- **Keep the verdict container's `pb-10` on phones.** The compass row's clamp needs the text to end at least `COMPASS_ROW_PX + COMPASS_GAP_PX` above the overlap's foot. Cut the top padding, the line gaps and the reserved height instead.
- **E2E hooks stay.** Keep `data-sky-time`, `data-sky-start`, `data-sky-end`, `data-dark-span`, `data-sky-headline`, `data-tonight-tiles`, the tile heading ids (`tile-*-heading`) and the `aria-labelledby` wiring. Specs and the offline worker depend on them. If a hook must move, update the spec in the same phase.

## Phase 1: Phone rhythm in the shared parts (C5)

### Overview

Give the shared type and spacing a phone step so every view gets shorter headers and tighter bands, and the dashboard work builds on the final rhythm.

### Changes Required:

#### 1. Fluid display role

**File**: `src/styles/global.css`

**Intent**: Page titles stop wrapping to 2–3 lines on phones (PL above all) and take less of the first screen.

**Contract**:
- `--text-display` and `--text-display--line-height` become fluid. They reach about 2rem / 2.25rem at ≤ 360 px and the current 2.5rem / 2.75rem from 640 px, using `min()`/`clamp()` with `vw` inside `@theme inline`, documented like the verdict roles' comment.
- No other role changes.
- `red-theme.test.ts` and `contrast.test.ts` stay green (no colour token is touched).

#### 2. Band, PageHeader and shell padding below `sm`

**Files**: `src/components/ui/Band.astro`, `src/components/ui/band.tsx`, `src/components/ui/PageHeader.astro`, `src/components/gear/GearShell.astro`, `src/components/AuthShell.astro`, `src/components/Welcome.astro`

**Intent**: Remove the 30–40% of the first phone screen that goes to gaps on every view, in the same steps on every shell. Otherwise the Topbar would jump between landing/auth and the app (plan review F3).

**Contract**:
- `Band` / `band.tsx` (twins, changed together): `py-8` → `py-6 sm:py-8`, and the heading row `mb-4` → `mb-3 sm:mb-4`. The `first:pt-0 last:pb-0` behaviour is unchanged.
- `PageHeader`: the outer `gap-4` → `gap-3 sm:gap-4`, and the subtitle `mt-2` stays.
- `GearShell`:
  - the Topbar wrapper `pt-4` → `pt-2 sm:pt-6`, in all three branches;
  - the sky header `pt-6 pb-8` → `pt-4 pb-6 sm:pt-10 sm:pb-12`;
  - the non-sky `main` `py-8` → `py-6 sm:py-12`.
- `AuthShell` and `Welcome` take the same steps on their copies of these classes (`AuthShell.astro:28,31,36`, `Welcome.astro:38,70`).
- Desktop (`sm` and up) is unchanged.

#### 3. Shared sky container and focused-page header

**Files**: `src/components/tonight/sky-band.ts` (`VERDICT_CONTAINER_CLASS` only), `src/components/tonight/TonightPageSky.astro`, `TonightPageSkeleton.astro`

**Intent**: Every `TonightSky` user gets the phone top padding in one step: the dashboard, the focused pages, the landing, the no-view setup sky and the no-DB sky. The focused Tonight pages start their content about 360 px down, and their phone header gets the same rhythm.

**Contract**:
- `VERDICT_CONTAINER_CLASS`: phone `pt-6` → `pt-3`, `pb-10` kept, `sm:` unchanged. This is the only `sky-band.ts` edit in this phase.
- The phone-only spacing between BackLink, title and context line is tightened, `sm:` is unchanged, and the skeleton matches the island's header height.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass, including `no-hardcoded-colors`, `red-theme` and `contrast`: `npm test`
- Hardcoded-value scan on the touched files returns 0 hits

#### Manual Verification:

- At 390 px the `/gear`, `/log`, `/tonight/targets`, `/tonight/moon`, landing (`/`) and `/auth/signin` headers are visibly shorter, and no title wraps mid-word in PL at 320 px
- At 1280 px those pages look the same as before (side-by-side screenshots)

**Implementation Note**: In the user's autonomous flow, run every manual check you can yourself (preview + Playwright screenshots), tick it with evidence, and leave only the eyeball rows for the end.

---

## Phase 2: Shared Tile and compact tiles (C4)

### Overview

Replace the five hand-copied tiles with one `Tile` component and fix the hierarchy. "Point here first" leads, and the other tiles say one thing each.

### Changes Required:

#### 1. `Tile` component

**File**: `src/components/ui/Tile.astro` (new); a `tileClass` export in a small island-safe `.ts` beside it, if the skeleton needs the class string

**Intent**: One ruled, full-width link row with a muted heading and an arrow, which the dashboard and its skeleton share.

**Contract**:
- Props: `href`, `headingId`, `heading`, optional `labelledBy` extras (the targets tile's sr-only "open" span).
- A default slot holds the content.
- It renders `<a aria-labelledby>` **as its root element, with no wrapper** (the `/design` specimens select tiles by depth), with `<h2 id>` and an `ArrowRight`, keeping today's classes (`TonightTiles.astro:38-41`: `min-h-11`, `border-b`, `hover:bg-accent`, `focus-visible:outline-ring`).
- Phone padding is `py-3 sm:py-4`.
- `TonightSkeleton` uses the same class source, not its own `tile` string (`TonightSkeleton.astro:17`).

#### 2. Compact tile contents

**File**: `src/components/tonight/TonightTiles.astro`

**Intent**: Shrink the tile stack from ~905 px to about 560 px at 375 px, with the actionable tile carrying the weight.

**Contract**:
- **Point here first:** unchanged content (3 rows plus the caption).
- **Session plan:** the heading plus the existing `planLine`. The mini timeline is dropped from the tile.
- **Moon:** the heading plus one line with a small `MoonDisc` (about `size-6`), then "9% · Waning crescent · Up 05:52–07:03" in `text-body`. No `text-display` percentage. The separator comes from the catalogue, not a literal.
- **Planets:** the names in `text-body font-semibold`, then the best planet's reason in `text-label text-muted-foreground`.
- **Next 7 nights:** the bars `h-10 sm:h-18`; marks, day labels, sr-only summary and caption unchanged.
- Every tile renders through `Tile`. The ids and `aria-labelledby` stay as they are today.

#### 3. Dead mini timeline

**File**: `src/components/tonight/SessionTimeline.astro`

**Intent**: Don't leave an unused variant behind.

**Contract**:
- The Plan tile is the only caller of `size="mini"`. Remove the `mini` branch, the `size` prop's `"mini"` value and `MINI_DOTS`. `/design` has no SessionTimeline specimen.
- Update the `TonightTiles.astro` header comment.

#### 3a. Gear-link locator

**File**: `tests/e2e/telescope-selector.spec.ts`

**Intent**: The new Moon line contains "·", so the spec's `main a:not([data-sky-body])` filtered by "·" (`:93-94`) would match two links (plan review F4).

**Contract**: Scope the locator to the gear link (`main a[href="/gear"]`). This is a locator-only change; the assertion stays.

#### 4. Skeleton parity

**File**: `src/components/tonight/TonightSkeleton.astro`

**Intent**: The placeholder rows match the new tile heights, so nothing jumps.

**Contract**: The five placeholder rows take the new compact shapes (heading bar plus one or two line bars; the nights row uses the new bar height).

#### 5. Kitchen sink

**File**: `src/pages/design.astro`

**Intent**: The new shared component gets its states (CLAUDE.md rule).

**Contract**: A `Tile` specimen in default, hover (forced class), focus-visible, empty content ("no targets") and the skeleton row. Disabled and error are N/A, with the reason as a caption (a tile is a link that always opens its page; errors render outside tiles).

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- `TonightTiles.astro` contains no hand-written tile `<a class={tile}>` block (grep returns 0)
- Hardcoded-value scan on the touched files returns 0 hits

#### Manual Verification:

- At 390 px the tile stack is ≤ 600 px tall in EN (measured), and "Point here first" is the heaviest tile
- `/design` shows the Tile states in dark, light and red

**Implementation Note**: Same autonomous-flow rule as Phase 1.

---

## Phase 3: The dashboard's first screen (C1, C2, C3)

### Overview

Shrink everything around the untouched panorama and move the gear and the save notice up, so the verdict, the gear and the first targets share the first screen at 390×844.

### Changes Required:

#### 1. Verdict block

**File**: `src/components/tonight/VerdictCard.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Each piece of info gets its own line (user), with no dangling em dash, and a smaller word.

**Contract**:
- **Three lines above the word, at every width:**
  - the date;
  - the dark window ("Dark from **21:01** to **07:03**", or the no-darkness/no-window text);
  - the time zone ("Times in Europe/Madrid").
- Separator strings come from the catalogue, never a template literal. The zone line reuses `tonight.nights.timesIn` ("Times in {zone}", `en.ts:500`, `pl.ts:476`). Remove `card.timesIn` (its only caller is `VerdictCard.astro:76`). EN and PL parity is enforced by `i18n.test.ts`.
- **The word is smaller: two tiers on phones, one tier from `sm` up** (user's "a bit smaller", then plan review F1 for phones). `verdictSize` maps every length to `text-verdict-sm` below `sm` (Go about 60 px at 375). From `sm` up, ≤ 3 letters become `text-verdict-lg`, ≤ 5 letters `text-verdict-md`, and longer words `text-verdict-sm`. Update the role comment in `global.css`.
- **One flowing answer:** "● Clear · <reason>". The headline span is `text-title`, and the reason follows it on the same line in `text-body`, muted, with a catalogue separator. It wraps naturally. `data-sky-headline` stays on the headline span. The gap under the word is `mt-3 sm:mt-6` (was `mt-5 sm:mt-6`).
- **Forecast status:** `fresh` is hidden below `sm`. `fallback` and `none` always show.
- The explanation paragraphs (weather no-go, no darkness) are unchanged.
- **Skeleton:** `TonightSkeleton`'s verdict bars follow the three short lines, the smaller word and one answer line.

#### 2. Phone heights in `sky-band.ts`

**File**: `src/components/tonight/sky-band.ts` (consumers: `TonightSkyView.tsx`, `TonightSky.astro`, `TonightSkeleton.astro`)

**Intent**: The verdict reserves only its new content on phones, and the slider row fits one row.

**Contract**:
- `VERDICT_CONTAINER_CLASS`: already trimmed in Phase 1, so no change here.
- `VERDICT_MIN_HEIGHT_CLASS`: re-measured from the new EN go verdict at **360 px** (phone value) and **640 px** (`sm` value), so the skeleton and the island match.
- `SLIDER_ROW_CLASS`: a phone height for one row (about 72–80 px) and `sm:h-32` unchanged.
- `STRIP_*`, `SILHOUETTE_*` and the overlap constants are **unchanged**.

#### 3. One-row slider on phones

**File**: `src/components/tonight/TonightSkyView.tsx` (slider row only, lines ~478-545), `TonightSkeleton.astro`

**Intent**: Save about 50 px on phones without changing behaviour.

**Contract**:
- Below `sm`: time (`text-title font-mono`), the track (`flex-1`, `h-11`) and the Now button share one row, with the legend row beneath.
- From `sm` up: today's layout.
- Same handlers, `aria-*`, `data-sky-*` hooks and single-frame behaviour (the row keeps its height).
- The panorama markup above it is untouched.
- The skeleton's slider row mirrors the phone layout.

#### 4. Order under the sky: notice, then gear row

**File**: `src/components/tonight/TonightContent.astro`, `src/components/tonight/GearSelector.astro`

**Intent**: The confirmation after a save and the site/telescope you are looking at sit right under the sky instead of 1–2 screens down (user: "they disappear when placed on the bottom").

**Contract**:
- **New order:** sky → `OfflineCopy` → notice → **gear row** → tiles → sky check → tonight error and setup prompts → eyepieces prompt.
- **The gear row** is the gear link plus up to two `GearSelector`s, as today, and the gear-list load errors (`:215-216`) render with it.
- **Rhythm:** a `px-4` container with `space-y-3` between its parts and a phone gap before the tiles (`pt-3 sm:pt-6`). The `GearSelector` outer `mb-6` becomes the container's spacing. Keep the pills/dropdown switch at 3 items.
- The sky check, setup prompts and attribution keep their relative order.
- Remove the old gear block and its `pt-8` wrapper logic. With no view, the setup state keeps its content and takes the phone rhythm.
- **Skeleton:** `TonightSkeleton.astro` reserves a one-line gear row (a `min-h-11` bar with the same spacing) between the slider row and the tiles, so the one-site case doesn't jump (plan review F2).

#### 5. Spec updates

**Files**: `tests/e2e/telescope-selector.spec.ts`, `tests/e2e/tonight-dashboard.spec.ts`, `tests/e2e/tonight-sky.spec.ts`, `tests/e2e/seven-night-planner.spec.ts`, `tests/e2e/offline.spec.ts`, plus any other spec that the full run shows depends on the moved blocks.

**Intent**: The suite follows the new structure without weakening an assertion.

**Contract**: Only locators change, never the expected behaviour. Any assertion change is listed in the phase's commit message with its reason.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass, including `i18n.test.ts` parity and `TonightSkyView.test.ts`: `npm test`
- Production build passes: `npm run build`
- Hardcoded-value scan on the touched files returns 0 hits
- At 390×844 the first tile's first target row is above the TabBar (preview measurement), and at 1280 the panorama SVG height is still 304 px

#### Manual Verification:

- The skeleton → island swap does not jump the panorama or the tiles at 390 px and 1280 px with one site and an EN verdict (record both)
- The compass row sits under the verdict text without overlapping it, in EN go, PL tak, marginal and no-go verdicts
- With 2 sites, the site pills sit right under the slider, and switching site works

**Implementation Note**: Same autonomous-flow rule as Phase 1.

---

## Phase 4: States, visual gate and guard

### Overview

Prove the first screen with a committed geometric test, cover the 7-state matrix, recapture the landing image, and leave the rule that keeps the next agent on the contract.

### Changes Required:

#### 1. Phone e2e gate

**File**: `tests/e2e/tonight-phone.spec.ts` (new)

**Intent**: A failing test catches any later change that pushes the answer off the first screen or makes a view scroll sideways.

**Contract**:
- After `onboardInMadrid`:
  - at 390×844 (EN): the "Point here first" heading and its first target row's bottom are above the TabBar's top, and the gear link is visible above the tiles (360×780 and 375×667 are known limits; see What We're NOT Doing);
  - at 320×568 and 375×667: `scrollWidth <= clientWidth` on `/tonight`, `/tonight/targets`, `/tonight/plan`, `/tonight/moon`, `/tonight/planets`, `/tonight/nights`, `/gear` and `/log`, in EN and PL;
  - at 375 and 1280: the panorama SVG height equals `STRIP_HEIGHT_PX + STRIP_OVERLAP_PX` (imported from `sky-band.ts`).
- It uses bounding boxes, with no pixel baselines.

#### 2. 7-state matrix

**File**: `src/pages/design.astro`

**Intent**: Every state of the changed view is shown or marked N/A with a reason.

**Contract**:
- **Tile:** see Phase 2.
- **Verdict block:**
  - default (go);
  - marginal and no-go;
  - stale forecast (`fallback`), which must stay visible on phones;
  - no forecast;
  - empty (no darkness);
  - loading (skeleton).
- **Gear row:** one site (link), 2 sites (pills), 4 sites (dropdown).
- focus-visible on the slider, the Now button and the pills.
- The matrix table in the change's `verification.md` names each cell as **shown** (with its specimen) or **N/A + reason**.

#### 3. Landing screenshot

**File**: `public/landing/tonight.png` via `tests/e2e/landing-screenshot.spec.ts`

**Intent**: The landing page shows the current Tonight (CLAUDE.md: recapture after a Tonight redesign).

**Contract**: Re-measure the capture height so it ends on the first tile's rule at 1280 px. The desktop verdict, gear row and min-height all change, so 1160 no longer fits (plan review F5). Set the new height in both `tests/e2e/landing-screenshot.spec.ts` (`VIEWPORT`) and `src/components/Welcome.astro:33`, then recapture with `CAPTURE_LANDING=1`.

#### 4. Guard rule

**File**: `CLAUDE.md` (the "UI (Nightfall)" section, outside any 10x-cli block)

**Intent**: The next agent keeps the phone rhythm and the first-screen budget.

**Contract**: Add short bullets:
- `ui/Tile.astro` is the one dashboard tile, and a new tile uses it;
- `--text-display` is fluid, and phone spacing comes from `Band`/`GearShell`/`PageHeader`, never per view;
- Tonight's heights live only in `sky-band.ts`, and the panorama strip is fixed at `h-52`;
- the phone first screen (verdict, gear row, first target row above the TabBar at 390×844) is pinned by `tests/e2e/tonight-phone.spec.ts`. A change that adds a block above the tiles must keep it green.

Also update the "Tonight's sky" bullet's mention of the giant word and of the dashboard order.

### Success Criteria:

#### Automated Verification:

- New spec passes: `npx playwright test tonight-phone` against the preview on local Supabase plus the forecast fixture
- Full e2e suite passes against the same preview: `npm run test:e2e`
- Unit tests, type check and lint pass: `npm test && npx astro check && npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Screenshot matrix (EN/PL × dark/light/red × 375/390/1280) of `/tonight`, saved under `context/changes/ui-mobile-pass/evidence/after/`, reviewed by the user
- Regression screenshots of `/gear`, `/log` and `/tonight/targets` at 390 and 1280, compared with `evidence/` before
- `verification.md` lists the 7-state matrix with every cell shown or N/A with a reason
- The user approves the phone first screen (the S-02 list starts from here)

**Implementation Note**: After this phase, run `/10x-impl-review ui-mobile-pass`, then open the PR ("Closes #122").

---

## Testing Strategy

### Unit Tests:

- Existing: `no-hardcoded-colors`, `red-theme`, `contrast`, `i18n.test.ts` parity, `TonightSkyView.test.ts` (the island import guard).
- No new unit test. The changed logic is markup and class strings, and the geometric e2e covers it.

### Integration Tests:

- `tests/e2e/tonight-phone.spec.ts` (new): the first screen at 390×844 (EN), no sideways scroll at 320 and 375 on 8 pages in EN and PL, panorama height unchanged.
- The full `npm run test:e2e` with locator-only updates.

### Manual Testing Steps:

1. Open `/tonight` on a 390×844 viewport. The verdict, the gear row and "Point here first" with ≥ 1 target are visible without scrolling.
2. Reload with the throttled network: the skeleton swaps to the island without the panorama or the tiles jumping.
3. Answer an open sky check on `/tonight` (seed one with `seedSkyCheck`). The `?skyChecked` notice is visible under the sky without scrolling.
4. Switch to the red theme and PL at 320 px. No sideways scroll, and the word and the lines fit.

## Performance Considerations

None. The changes are markup and CSS only, with no new island or request.

## Migration Notes

Not applicable. There is no data change, and offline copies stored before the deploy keep the old layout until refreshed (36 h expiry).

## References

- Research and charges: `context/changes/ui-mobile-pass/research.md`, with baseline screenshots in `context/changes/ui-mobile-pass/evidence/`
- Prior decisions:
  - `context/archive/2026-10-04-tonight-dashboard/plan-brief.md`
  - `context/archive/2026-10-05-interactive-sky/plan-brief.md`
  - `context/archive/2026-10-04-tonight-nightfall/plan.md:537-538`
- `/10x-ui` checklist: `~/projects/.claude/skills/10x-ui/references/ui-quality-checklist.md`
- Roadmap: `context/foundation/roadmap.md` › S-01; GitHub #122

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Phone rhythm in the shared parts (C5)

#### Automated

- [x] 1.1 Type check passes: `npx astro check` — c183e09
- [x] 1.2 Lint passes: `npm run lint` — c183e09
- [x] 1.3 Unit tests pass, including `no-hardcoded-colors`, `red-theme` and `contrast`: `npm test` — c183e09
- [x] 1.4 Hardcoded-value scan on the touched files returns 0 hits — c183e09

#### Manual

- [x] 1.5 At 390 px the `/gear`, `/log`, `/tonight/targets`, `/tonight/moon`, landing (`/`) and `/auth/signin` headers are visibly shorter, and no title wraps mid-word in PL at 320 px — c183e09
- [x] 1.6 At 1280 px those pages look the same as before (side-by-side screenshots) — c183e09

### Phase 2: Shared Tile and compact tiles (C4)

#### Automated

- [x] 2.1 Type check passes: `npx astro check`
- [x] 2.2 Lint passes: `npm run lint`
- [x] 2.3 Unit tests pass: `npm test`
- [x] 2.4 `TonightTiles.astro` contains no hand-written tile `<a class={tile}>` block (grep returns 0)
- [x] 2.5 Hardcoded-value scan on the touched files returns 0 hits

#### Manual

- [ ] 2.6 At 390 px the tile stack is ≤ 600 px tall in EN (measured), and "Point here first" is the heaviest tile
- [x] 2.7 `/design` shows the Tile states in dark, light and red

### Phase 3: The dashboard's first screen (C1, C2, C3)

#### Automated

- [ ] 3.1 Type check passes: `npx astro check`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Unit tests pass, including `i18n.test.ts` parity and `TonightSkyView.test.ts`: `npm test`
- [ ] 3.4 Production build passes: `npm run build`
- [ ] 3.5 Hardcoded-value scan on the touched files returns 0 hits
- [ ] 3.6 At 390×844 the first tile's first target row is above the TabBar (preview measurement), and at 1280 the panorama SVG height is still 304 px

#### Manual

- [ ] 3.7 The skeleton → island swap does not jump the panorama or the tiles at 390 px and 1280 px with one site and an EN verdict (record both)
- [ ] 3.8 The compass row sits under the verdict text without overlapping it, in EN go, PL tak, marginal and no-go verdicts
- [ ] 3.9 With 2 sites, the site pills sit right under the slider, and switching site works

### Phase 4: States, visual gate and guard

#### Automated

- [ ] 4.1 New spec passes: `npx playwright test tonight-phone` against the preview on local Supabase plus the forecast fixture
- [ ] 4.2 Full e2e suite passes against the same preview: `npm run test:e2e`
- [ ] 4.3 Unit tests, type check and lint pass: `npm test && npx astro check && npm run lint`
- [ ] 4.4 Build passes: `npm run build`

#### Manual

- [ ] 4.5 Screenshot matrix (EN/PL × dark/light/red × 375/390/1280) of `/tonight`, saved under `context/changes/ui-mobile-pass/evidence/after/`, reviewed by the user
- [ ] 4.6 Regression screenshots of `/gear`, `/log` and `/tonight/targets` at 390 and 1280, compared with `evidence/` before
- [ ] 4.7 `verification.md` lists the 7-state matrix with every cell shown or N/A with a reason
- [ ] 4.8 The user approves the phone first screen (the S-02 list starts from here)
