---
date: 2026-10-08T15:08:41+02:00
researcher: Claude (for Rafal Skwara)
git_commit: 57f7ff0
branch: feat/ui-user-adjustments
repository: RafalSkwara/Sidereus
topic: "Ground the user's S-02 UI adjustment list in the current code"
tags: [research, ui, tonight, notices, sky-view, session-plan, buttons, stars]
status: complete
last_updated: 2026-10-08
last_updated_by: Claude
---

# Research: Ground the user's S-02 UI adjustment list in the current code

**Date**: 2026-10-08T15:08:41+02:00
**Researcher**: Claude (for Rafal Skwara)
**Git Commit**: 57f7ff0 (main 27c76ad + the change folder)
**Branch**: feat/ui-user-adjustments (worktree `.claude/worktrees/ui-user-adjustments`)
**Repository**: RafalSkwara/Sidereus

## Research Question

For every item in `change.md`'s user list, find the code that renders it, the files a fix touches, the tests and CLAUDE.md rules that pin it, and, for the `/tonight/plan` per-target bar, the design options grounded in data that exists. Read-only: nothing was built, run or measured. Pixel claims come from classes.

## Summary

All 17 items map to existing, located code. None needs engine changes. Rough grouping by blast radius:

1. **App-wide notices (largest).** There is no toast, dismiss or timer code anywhere in `src/`, and no `replaceState`. Every "saved" notice is a server-rendered `Notice` (`role="status"`) driven by a URL param, so it stays until the next navigation (`src/components/ui/Notice.astro:27`). Five transient-success families: gear `?saved/?deleted`, log `?saved/?updated/?deleted`, `/log/sky?skyChecked=1`, `/tonight?skyChecked=1`, and `?logged=` on the dashboard and four focused pages. The Tonight ones render inside the server island (`TonightContent.astro:172-182`, `*PageContent.astro`). The informational ones are the three offline notices (`OfflineCopy.astro:41-57`), the sign-in "continue" note and `DatabaseMissing`. A "close" on an offline notice must be honoured by `applyNotices` (`src/lib/offline/page-state.ts:50-57`), which rewrites `hidden` on every DOM change. Nine e2e assertions use a bare `getByRole("status")`, and about a dozen `toHaveURL(...$)` assertions pin the params.
2. **The dashboard sky band.** The giant word is used only in `VerdictCard.astro:82-84` (plus its i18n key and the skeleton bar). Dropping it and the three header lines changes `VERDICT_MIN_HEIGHT_CLASS`, which must be re-measured (`sky-band.ts:16-21`). The `-mt-24` is `STRIP_OVERLAP_CLASS`/`STRIP_OVERLAP_PX = 96` (`sky-band.ts:38-39`). It feeds the SVG height, the compass clamp, label bounds and the chevron position (`TonightSkyView.tsx:226,251,308,311,458`). It is pinned by `tonight-phone.spec.ts:144-145` through the constants. The island has only a frame-quantised dark span (10 min steps) and no zone: the exact dark-window times and the zone exist only in `TonightView` (`build.ts:940-1005`, `:1154`).
3. **Gear cards.** Today one muted "site · telescope" link plus pills (2-3 items) or a dropdown (4+) (`TonightContent.astro:184-215`, `gear-choice.ts:35-38`). With one item there is no selector. The phone first screen at 390×844 (`tonight-phone.spec.ts:89-98`) and the selector semantics (`telescope-selector.spec.ts`, `seven-night-planner.spec.ts`) both pin this.
4. **Spacing and "data on own lines".** Five places flow data points into one line with " · ": the plan's info line (`SessionTimeline.astro:55-71`), planet facts (`PlanetCard.astro:27`), the targets' detail line (`ObjectCard.astro:37`), the nights' headline+reason (`NightStrip.astro:59-70`) and the focused pages' context line (`TonightPageSky.astro:23`). The shared `TargetDetails` `dl` stacks at `gap-y-1` (4 px) (`TargetDetails.astro:32`).
5. **Clickable affordance.** "Mark observed" is `buttonVariants({variant: "link", size: "sm"})` with `-ml-3` (`TargetDetails.astro:29`). The `link` variant has no resting underline (`button.tsx:32`), and there is no global `a` style. In red, `primary`, `primary-strong` and `heading` are all `#ff0000`, so the difference must come from shape (underline, border, fill), not hue.
6. **Background stars.** Only `TonightSky.astro:52-57` draws the symbolic stars (80 circles, `fill-star`). The five focused pages reach it through `TonightPageSky.astro:26` and `TonightPageSkeleton.astro:35`. `--star` also drives the live dashboard sky (`TonightSkyView.tsx:373`), so the dimming belongs on a `TonightSky` prop, not the token.
7. **Plan bar meaning.** The row bar is the target's _best window_: the longest run at or above the site's minimum altitude, clipped to the dark window for deep sky (`objects.ts`, `score.ts:135`). The dot is the highest sample in that run. Nothing on the page says so, and no i18n key exists for it. Four alternatives are listed under "Session plan bar", with ASCII sketches.

Conflicts with CLAUDE.md that the plan must update deliberately:

- "The panorama strip (`h-52` plus the `-mt-24` overlap) … fixed".
- The three-line header and the verdict word.
- "Ruled `Band`s rather than boxed cards".
- `VERDICT_MIN_HEIGHT_CLASS` re-measure.
- The phone first-screen pin.

## Detailed Findings

### A. Notices (item: skyChecked notice, all notifications as 10 s fixed toasts, info notices closable)

**The component.**

- `Notice.astro` takes `tone: success | warning | info` (`:12-22`) and renders `<div role="status">` with an icon and `[data-notice-text]` (`:27-31`).
- Its only script re-announces the text once after load or reveal (`:41-69`).
- It has no close button, timer or positioning.

**Transient-success notices** (candidates for the 10 s toast):

| Trigger                                                                             | Rendered at                                                                                                                                                                                                 | Static or island                                         |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `/gear?saved=` or `?deleted=<kind>`                                                 | `src/pages/gear/index.astro:50-52,115-119`                                                                                                                                                                  | static                                                   |
| `/log?saved=`, `?updated=` or `?deleted=<key>` (`observations/redirect.ts:105-123`) | `src/pages/log/index.astro:29-30,83-86`                                                                                                                                                                     | static                                                   |
| `/log/sky?skyChecked=1` (`sky-checks/redirect.ts:13-27`)                            | `src/pages/log/sky.astro:30,77-81`                                                                                                                                                                          | static                                                   |
| `/tonight?skyChecked=1` (`api/log/sky/[id].ts:36`)                                  | shell `tonight.astro:26-35` → `pickTonightNotice` (`lib/tonight/notice.ts:11-23`) → island `TonightContent.astro:172-182`                                                                                   | server island; the notice is baked into the island props |
| `?logged=<key>` on `/tonight` and on `/tonight/{targets,moon,planets,nights}`       | shells `targets.astro:25-27`, `moon.astro:23-25`, `planets.astro:23-25`, `nights.astro:24-26` → `TargetsPageContent:95-102`, `MoonPageContent:62-69`, `PlanetsPageContent:54-61`, `NightsPageContent:52-59` | server islands                                           |

**Informational notices** (stay inline, get a close button):

- The three offline notices `data-offline-notice="prepared|old-forecast|stale"`, each a `warning` Notice in a `hidden` wrapper (`OfflineCopy.astro:41-57`). "Prepared" is the one the user named.
- `applyNotices` (`page-state.ts:50-57`) re-sets `hidden` on every DOM insertion and on online, offline, pageshow and visibility events (`:143-153`). A dismissal needs a marker it respects.
- The sign-in continue note (`auth/signin.astro:18-22`, `info`).
- `DatabaseMissing` (`gear/DatabaseMissing.astro:3,9`, `warning`).

**Errors.**

- `?error=` → `ServerError` inside `role="alert"`, for example `TonightContent.astro:177-179`.
- `FieldError` is field-level (`forms/FormField.tsx:29-35`).
- The config `Banner` is a persistent environment error (`Layout.astro:48-62`).
- The user's list says "all notifications" and names only info as the exception. Whether errors join the toasts is open; see Open Questions.

**Geometry.**

- `Topbar` is `h-16` and **not sticky** (`Topbar.astro:28`). It sits at 8-72 px below `sm` and 24-88 px from `sm` (`GearShell.astro:26-52`).
- `TabBar` is `fixed bottom-0 z-40` with `h-16` plus the safe area, below `md`, signed in, and not on `/onboarding` (`TabBar.astro:16,21-60`).
- Nothing in `src/` has a z-index above `z-40`, and there are no z tokens.
- The only safe-area utility is `pb-safe-area` (`global.css:457-459`). A fixed bottom offset needs a new utility, because arbitrary values are banned.
- `Layout.astro` is the one place every page passes through: banners, `<slot/>`, then the hidden offline span (`:48-67`). `Layout` does not know whether a TabBar rendered.
- The settings panel is `popover="auto"` (`TopbarControls.tsx:52-58,200`). From `sm` it is a top-right panel at `sm:top-23`; on phones it is a bottom sheet. A toast that is itself `popover="auto"` would close it.

**Offline.**

- Shells whose URL carries `logged`, `skyChecked` or `error` are never stored (`offline/copies.ts:34-35,127-130`; `copies.test.ts:98-99`). A param-driven toast can therefore never come back from a stored copy.

**Surfaces.**

- `--go-surface` and the other notice surfaces are `color-mix(… transparent)` (`global.css:233-238`). A fixed toast floating over content needs an opaque backing.

**Tests pinning notices.**

- Status-role assertions:
  - `sky-checks.spec.ts:36-37,55`
  - `planets-on-tonight.spec.ts:60-61`
  - `tonight-targets.spec.ts:82-83`
  - `observation-log.spec.ts:59-60,94-95`
  - `observation-log-management.spec.ts:92-142`
  - `moon-as-target.spec.ts:53-54`
  - `seven-night-planner.spec.ts:69-70,98-99`
  - `gear-catalogue.spec.ts:48-49`
- URL-only assertions: `site-map.spec.ts:67`, `telescope-selector.spec.ts:30,48`, `site-location.spec.ts:63`.
- Offline visibility: `offline.spec.ts:123,134-137` counts `[data-offline-notice]:visible`.
- `getByRole("status")` appears 9 times. A second status element on the page (a toast region that is itself a live region) breaks strict mode. A close button with visible text breaks `toHaveText`; an icon button with an `aria-label` does not.
- 10 s is longer than Playwright's 5 s expect timeout, so a visible check right after the redirect still passes.

### B. The verdict and the header lines (items: remove the poster; bigger "● headline"; drop the dark-window line; zone next to the slider time)

**The verdict.**

- `VerdictCard.astro` is the only renderer.
  - Header lines: date `:65`, dark window `:66-77`, zone `:79`.
  - Giant word: `:82-84`, sized by `verdictSize` at `:50-55`.
  - Headline: `:85-94`, a `text-title` span with the `size-2.5` tone dot, then the muted reason.
  - Explanations: `:96-97`.
  - Forecast line: `:98`.
- It is used at `TonightContent.astro:136` (in the island), `:152` (static fallback) and `design.astro:1422,1445`.

**What depends on the word.**

- `tonight.verdict.word` exists only here and in `en.ts:861-864` / `pl.ts:772-773`. No test asserts it.
- The `text-verdict-sm/md/lg` tokens (`global.css:548-568`) have exactly two users, VerdictCard and `TonightSkeleton.astro:42`.
- Keep `#verdict-heading [data-sky-headline]`: `tonight-dashboard.spec.ts:39,64,70`, `onboarding.spec.ts:53-54`, `offline.spec.ts:115` and `landing-screenshot.spec.ts:76-78` locate it.

**The dark-window line.**

- When there is no dark window, this line carries `explanation.returnText` for the no-darkness case, else `t.noDarkWindow` (`VerdictCard.astro:72-76`). Dropping it must re-home that text. It is the one piece of information that would otherwise be lost.
- `card.darkFrom`, `card.darkTo` and `card.timesIn` are used only by VerdictCard. `nights.timesIn` is separate (`NightStrip.astro:44`).

**The slider** (`TonightSkyView.tsx:483-555`).

- Current time: `[data-sky-time]` (`:485`), from `view.timeLabels[index]` (`:246`).
- Track: its dark span `[data-dark-span]` (`:500-509`) is placed from `view.darkSpan` frame indices (`:113-114`).
- Legend: `[data-sky-start]`, a dark-window swatch with `t.darkWindow`, and `[data-sky-end]` (`:538-553`).
- `SkyViewData` (`src/lib/sky-view/view.ts`) has no exact dark-window times and no zone.
  - `darkSpan` is frame-quantised at 10 min (`build.ts:949-954`; `parameters.ts:41`).
  - The exact `TonightDarkWindow.start/end` strings and `timeZone` are in `TonightView` (`build.ts:284,402,408,1154`).
- CLAUDE.md requires every time in the island to be server-formatted. Showing them exactly means new server-built strings on `SkyViewData` (or props on `<TonightSkyView>` at `TonightContent.astro:134` and `design.astro:1444`).
- The island's import guard (`TonightSkyView.test.ts`) allows `@/i18n` but not `@/lib/tonight/format`.

**Heights and pins.**

- The slider row is fixed at `h-19` (76 px) on phones and `sm:h-32` (`sky-band.ts:44-56`). Added text must fit, or the constants and the skeleton row (`TonightSkeleton.astro:49-61`) change together.
- `tonight-sky.spec.ts:85-130` compares `[data-sky-time]` against the `[data-sky-start]` / `[data-sky-end]` text. A zone label must sit outside `[data-sky-time]`.
- `VERDICT_MIN_HEIGHT_CLASS = "min-h-61 sm:min-h-97"` was measured on the old layout (`sky-band.ts:16-21`) and must be re-measured on the EN go verdict at 360 and 640 px.
- `TonightSkeleton.astro:39-46` has stand-in bars for the three lines, the word, the headline and the forecast, and must follow.

### C. The panorama (items: `-mt-24` → `-mt-16`; chevrons without background or border; hidden scrollbar plus a compass indicator)

**The overlap.**

- `STRIP_OVERLAP_CLASS = "-mt-24"` and `STRIP_OVERLAP_PX = 96` (`sky-band.ts:32-39`) are applied once, on the strip wrapper (`TonightSkyView.tsx:338`).
- The px value feeds:
  - the SVG height, which is `STRIP_HEIGHT_PX + STRIP_OVERLAP_PX` (`:251`);
  - the compass row's top clamp, `STRIP_OVERLAP_PX - COMPASS_ROW_PX` (`:226`);
  - the label bounds (`:308,311`);
  - the chevrons' `top` (`:458`).
- `tonight-phone.spec.ts:144-145` asserts the SVG height from the constants, so changing both together keeps it green.
- Going to `-mt-16`/64 lowers the compass clamp to 48 px.
- The overlapping text is the forecast line, `VerdictCard.astro:98`. It shows on phones only for fallback or none, because `fresh` is `max-sm:hidden` (`:57-61`).
- This contradicts CLAUDE.md's "`h-52` plus the `-mt-24` overlap … fixed", which needs updating.

**Chevrons.**

- `PAN_FACE_CLASS` is `bg-zenith/70 border-border … rounded-full border backdrop-blur-sm` with hover fill and border (`TonightSkyView.tsx:85-92`), rendered at `:446-469`.
- `tonight-sky.spec.ts:171-198` finds them by accessible name, so a style-only change is safe.

**Scrollbar.**

- The scroller is `:339-347`, styled by the only `scrollbar-strip` utility (`global.css:486-490`: thin, token-coloured). Hiding it means `scrollbar-width: none`; there are no `::-webkit-scrollbar` rules today.
- `onScroll={readEdges}` (`:166-181`) already reads `scrollLeft` with a bail-out, so the indicator can reuse that pattern.

**Compass indicator.**

- The compass row is a memo over the 16 `COMPASS_POINTS` (`:287-302`; `src/lib/compass.ts:9-26`), drawn as `<text>` in an `aria-hidden` `<g data-sky-compass>` (`:356-371`).
- SVG x equals scroller content x, so the viewport centre is `scrollLeft + clientWidth / 2`. The nearest point is the compass entry with the smallest |x − centre|; this is plain arithmetic over the memo, with no new projection helper.
- The opposite point is drawn twice, at x = 0 and x = width; both copies are candidates.

### D. Gear cards (item: site and telescope cards side by side, icon, chosen option, select)

**Today's gear row.**

- The row is `TonightContent.astro:184-215`:
  - the `gearLine` link to `/gear` (`:115-117`, muted `gearLink` at `:126-127`);
  - the site `GearSelector`, then the telescope `GearSelector`;
  - the `ServerError`s.
- `GearSelector.astro` uses `selectorKind` (`gear-choice.ts:35-38`): `none` (<2), `pills` (≤ `SELECTOR_PILL_LIMIT = 3`), or `dropdown`.
- The pills are `<nav aria-label>` links with `aria-current` (`GearSelector.astro:33-53`).
- The dropdown is a GET `<form data-gear-select>` with the `GearSelectField` React select and a "Show" button that a script hides, plus submit-on-change (`:55-75`).
- `NativeSelect` exists (`ui/native-select.tsx:7-22`).
- Card titles can reuse `tonight.siteSelector.label` ("Site") and `tonight.selector.label` ("Telescope") (`en.ts` about lines 477-482).

**Icons.**

- `lucide-react` is a dependency (`package.json:45`). `MapPin` is already used (`location/LocationPicker.tsx:2`), and so is `Telescope` (`gear/TelescopeForm.tsx:2`).
- Astro files render lucide server-side, as `Tile.astro` does.

**Pins.**

- `tonight-phone.spec.ts:82,89-98` locates `main a[href="/gear"]` above the first tile, and the first target's first line above the TabBar, at 390×844, with only a few px to spare.
- `telescope-selector.spec.ts` asserts:
  - no nav and no select form with one telescope (`:88-91,165-166`);
  - pills as navigation with `aria-current` for 2 (`:103-116`);
  - a labelled select plus the `data-gear-select` form for 4 (`:122-129`);
  - the gear link text split on "·" to read the telescope name (`:92-95`).
- `seven-night-planner.spec.ts:30,142-168` pins the same for sites.
- `gear-choice.test.ts` pins `selectorKind`.
- `TonightSkeleton.astro:63-66` reserves a single `min-h-11` bar for the gear row.
- `/design` has gear-row specimens (`design.astro:1470-1583`, with `gearLink` duplicated at `:304-305`).

**Rules.**

- "Ruled `Band`s rather than boxed cards" (Nightfall composition) is contradicted by the user's explicit request. It needs a shared component, `/design` states and a CLAUDE.md note.
- With one site or telescope, the user's spec ("chosen option and a select") has no selector today. Whether the card shows a one-option select, a plain name, or a link to `/gear` is open.

### E. Spacing and "data points on their own lines" (dashboard sections, plan, targets, nights)

**Shared parts.**

- `ui/Band.astro:30,37` (`py-6 sm:py-8`, title `mb-3 sm:mb-4`) and its twin `ui/band.tsx` (CLAUDE.md: change both).
- Focused-page containers are `space-y-6 px-4 pt-8`.
- `TargetDetails.astro:32-45` is a `dl` with `mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2`, shared by targets, planets and the Moon, then "Mark observed" at `:49`.

**Session plan.**

- Sunset, dark, moon and sunrise are one flowing `<p data-session-plan-text>` with `·` separators (`SessionTimeline.astro:55-71`). `tonight-dashboard.spec.ts:77` asserts only that it is visible.
- The axis is `pt-4` (`:73`). Rows are `min-h-11 px-4 py-3` with the bar at `mt-2` (`:49-50,151`).

**Moon.**

- `MoonCard.astro:35-93` and `MoonTimeSlider.tsx:65-103`: separate `<p>`s under `space-y-2`. The target section is `mt-4 border-t pt-4`.

**Planets.**

- `SolarSystemSection.astro:20-31` has `windowText`, then `mt-1` `weatherText`, then the list.
- `PlanetCard.astro:24-49`: `py-4` rows, with the facts as one `facts.join(" · ")` line in a `gap-y-1` flex-wrap (`:25-28`).

**Targets.**

- `ObjectCard.astro:25-42` has the title row in a flex-wrap `gap-y-1` (`:31`), with `detailLine` flowing beside or under it (`:37`).
- `ObjectRow.astro:23-60` is the collapsed rest.
- `ObjectDetails.astro:18-39` has the eyepiece sentence and the reason at `mt-2`.

**Nights.**

- `NightStrip.astro:30-107`: rows are `flex gap-x-4 py-3 text-label` (`:30`).
- The left cell stacks date over dark window with no gap (`:31`).
- The right cell has the headline plus " — reason" inline, then the moon `<p>`, with no margin (`:59-71`). Outlook rows are the same (`:92-101`).
- This is the most cramped list.

**Context line.**

- `TonightPageSky.astro:23,32` flows "dot · date · site · telescope" on every focused page.

**Skeleton.**

- `TonightPageSkeleton.astro:45-56` reserves generic `space-y-2 py-4` rows. It is approximate, not measured.

**Pins.**

- Focused pages are pinned only for no sideways scroll at 320 and 375 px in EN and PL (`tonight-phone.spec.ts:112-135`). The dashboard first screen is pinned as above.

### F. Clickable affordance (Mark observed; every link and button)

**Mark observed.**

- `TargetDetails.astro:29,49-54` uses `cn(buttonVariants({variant: "link", size: "sm"}), "-ml-3")` with `data-needs-network`.

**`buttonVariants`** (`button.tsx:14-46`):

- `link` is `text-primary-strong underline-offset-4 hover:underline`, with no resting underline.
- `ghost` (also the inactive gear pills) has no border and no fill at rest.
- `outline` is `border-primary`.
- The `sm` size carries `text-sm`, a Tailwind default rather than a type role.

**Other users of the `link` variant.**

- `MoonCard.astro:31`.
- The `inlineLink` strings in `Targets`, `Moon`, `Planets`, `Nights` and `PlanPageContent`.
- `EyepiecesPrompt.astro:10` and `SkyCheckCard.astro:39`.
- The skeletons and `ui/Pager.astro:24`.
- The auth switch links (`auth/signin.astro:26`, `signup.astro:18`, `confirm-email.astro:23`).

**Links not built on `buttonVariants`.**

- `gearLink` and `BackLink` (`ui/BackLink.astro:22`, muted, with hover only).

**Global link styles.**

- There is no global `a` rule in `global.css`.

**Offline styling.**

- The offline rule (`global.css:470-479`) resets the colour, background and `text-decoration-line` of `[data-needs-network]`. A new resting underline would still read as different offline.

**Colour tokens** (`global.css`):

- Dark (`:21`): `--primary-strong #c3d0ff`, `--heading #f2f4f8`.
- Light (`:76`): `#23439f` / `#0b1428`.
- Light night scope (`:119`).
- Red (`:163`): `primary`, `primary-strong` and `heading` all `#ff0000`.

**Contrast tests.**

- `contrast.test.ts` checks `primary-strong` on `background` (4.5) but not on `surface`. It skips `color-mix` tokens, so `--accent` is unchecked.
- A new colour token needs every theme block, red with zero G/B (`red-theme.test.ts`), and a `CHECKS` row.

**`/design`.**

- `variants` is at `design.astro:161-171`, the Button section at `:697-737` and the link-button section at `:739-786`.

**Rule.**

- "At most one primary (`default`) action per screen" rules out `default` for a per-target "Mark observed".

### G. Background stars on subpages

- `TonightSky.astro:52-57` draws 80 seeded circles in an `<svg class="… fill-star night:block hidden">` (`:39-49`). `--star` is `rgb(255 255 255/.5)` dark (`global.css:63`), `rgb(255 255 255/.55)` in the light night scope (`:150`) and `rgb(255 0 0/.35)` red (`:195`).
- Subpages reach it through `TonightPageSky.astro:26`, used by the five focused pages and their shells, and through `TonightPageSkeleton.astro:35`.
- The dashboard uses it through `TonightSkeleton.astro:37`, `TonightContent.astro:148` and `tonight.astro:50`. The landing uses it via `Welcome.astro:45` (without `night`).
- `/gear`, `/log`, auth, onboarding and offline draw no stars (`GearShell.astro:27-41`, `AuthShell.astro`). Only the `/tonight/*` focused pages are affected.
- `--star` also fills the live sky (`TonightSkyView.tsx:372-373`). A prop on `TonightSky` (an opacity scale class on the star `<svg>`), passed only by `TonightPageSky` and `TonightPageSkeleton`, dims the subpages alone. It needs no token or contrast work.

### H. Session plan bar (item: reconsider the visibility/best-time bar; explain its meaning)

**What is drawn today** (`SessionTimeline.astro`):

- A shared axis (`:73-130`): hour ticks, every other one hidden on phones (`:81`); the twilight track with the darker dark window; a Moon-up band; edge marks; Moon events.
- Then one `<li><a>` per target (`:132-163`). Line 1 is the name with the best time. Line 2 is a full-axis track that repeats the dark shading (`:152`), with the target's window as a `bg-primary-strong` bar (`:153-156`) and a 16 px dot at best (`:157`).
- The bars are `aria-hidden`. The facts are in the link's accessible name (`rowLabel`, `en.ts:946-947`).

**What it means.**

- The bar is the best window from `bestWindow(track, minAltitudeDeg)`: the longest 10-min run at or above the site's minimum altitude (default 15°, `parameters.ts:49`), over the dark window for deep sky (`engine/objects.ts:100+`, `score.ts:135`).
- For planets and the Moon it uses the −6° window, or the clear hours on no-go nights (`build.ts:760-800`).
- The dot is the highest sample inside that run, not the transit.
- No visible text or i18n key explains the bar, the dot or the minimum altitude.

**Row data** (`build.ts:332-347`).

- Carried: `kind`, `key`, `label`, `name`, `href`, `bestTime`, `windowText`, `bestDirection` ("SW, 45°"), and the fractions `from`, `to`, `best`, `bestAt`.
- Not carried: numeric altitude, score, eyepiece, tracks.
- Available but unused on the plan:
  - altitude tracks per target from `objectTracks`, `planetTracks` and `moonTrack`, computed and packed for the dashboard's sky view only with `withSkyView` (`build.ts:550,959-985`);
  - `entry.peak` (alt and az at best);
  - `site.minAltitudeDeg` (`:706`).

**History.**

- `context/archive/2026-10-05-session-plan-timeline/plan-brief.md:22` says the user asked for rows on one shared time axis to show overlaps at a glance.
- A legend was never discussed; the reviews added only tokens and edge marks.

**Options** (the plan must show the user a mock-up of each before building):

- **A. Keep the bars, explain them.**
  - Add a legend line ("bar: above 15° while dark · dot: highest").
  - Add end labels when they fit.
  - Drop the repeated dark shading on rows in favour of hour gridlines.
  - Data needed: none new (optionally `peak.altitudeDeg`).
  - Cost: low.
  ```
  M31 · Andromeda Galaxy                22:40
  21:40 [=====●=========] 23:10     54° SW
  ```
- **B. Text first, plus an altitude sparkline per row.**
  - A sentence line: "Best 22:40 · up 21:40–23:10 · 54° SW".
  - A small SVG altitude curve on the shared axis, with a dashed minimum-altitude line and a dot at best.
  - Data needed: the existing track functions run over the plan axis (about 75 points per row, packed). No engine change.
  - Cost: medium (server-only SVG, no island).
  ```
  M31 · Andromeda Galaxy
  Best 22:40 · up 21:40–23:10 · 54° SW
   __/‾‾‾●‾‾\__   - - - 15° - - -
  ```
- **C. One shared altitude chart for all targets.**
  - Curves for every target, with tappable chips.
  - The richest option, but 5-13 curves at about 328 px are hard to tell apart, especially in red (single hue). It needs an island.
  - Cost: high.
- **D. Hourly agenda.**
  - Group targets under hour headings by best time: "22:40 M31 · 54° SW · until 23:10".
  - No drawing to explain, but it loses the overlap and duration picture the user originally asked for.
  - Data needed: existing.
  - Cost: low to medium.

## Code References

- `src/components/ui/Notice.astro:12-69`: Notice tones, `role="status"` and the announce script.
- `src/lib/tonight/notice.ts:11-23`: `pickTonightNotice` (error > logged > skyChecked).
- `src/components/tonight/TonightContent.astro:115-127,134-215`: gear line, island sky, notice, gear row.
- `src/components/tonight/OfflineCopy.astro:41-57` and `src/lib/offline/page-state.ts:34-57,143-153`: offline notices and their visibility.
- `src/lib/offline/copies.ts:34-35,127-130`: shells with notice params are never stored.
- `src/layouts/Layout.astro:48-67`: the body order, where a toast region would go.
- `src/components/Topbar.astro:28`, `src/components/TabBar.astro:16-60`, `src/components/gear/GearShell.astro:26-52`: navigation geometry.
- `src/components/tonight/VerdictCard.astro:50-98`: header lines, word, headline, explanations, forecast line.
- `src/components/tonight/sky-band.ts:10-56`: every shared sky height and class.
- `src/components/tonight/TonightSkyView.tsx:85-92,166-181,214-251,287-371,446-469,483-555`: chevrons, scroll edges, compass, slider.
- `src/lib/tonight/build.ts:284,332-377,402-408,550,940-1005,1154`: view, plan rows, sky view, dark-window strings.
- `src/components/tonight/GearSelector.astro`, `GearSelectField.tsx`, `src/lib/tonight/gear-choice.ts:5-38`: selectors.
- `src/components/tonight/SessionTimeline.astro:35-163`: the plan drawing.
- `src/components/tonight/TargetDetails.astro:29-54`: details `dl` and Mark observed.
- `src/components/tonight/{PlanetCard,ObjectCard,ObjectRow,ObjectDetails,NightStrip,SolarSystemSection,MoonCard}.astro`: row layouts.
- `src/components/ui/button.tsx:14-46`: variants.
- `src/components/tonight/TonightSky.astro:20-62`, `TonightPageSky.astro:23-41`, `TonightPageSkeleton.astro:35-56`: stars and the focused-page header.
- `src/styles/global.css:13-14,21-195,233-238,457-490,548-568`: `night:` variant, theme tokens, notice surfaces, utilities, verdict sizes.
- `tests/e2e/tonight-phone.spec.ts:59-150`, `tonight-sky.spec.ts:85-198`, `telescope-selector.spec.ts`, `seven-night-planner.spec.ts`, `sky-checks.spec.ts`, `offline.spec.ts:115-137`: e2e pins.

## Architecture Insights

- **Server-island notices.** The shell resolves the notice from its URL and passes plain strings into the island. A toast mechanism must find notices that arrive after load. `Notice.astro`'s script and `page-state.ts` both already watch DOM insertions, so a `data-toast` marker plus one shared client script (or a small `ui/` component with its own script) fits the existing pattern without an island framework.
- **Skeleton sync.** Sky heights are centralised in `sky-band.ts` so the skeleton can't drift. Every dashboard change in B, C and D must go through it and re-measure `VERDICT_MIN_HEIGHT_CLASS`, then re-check the 390×844 first screen.
- **Red mode.** Red mode has one hue, so affordance and indicators must use shape (underline, border, weight, a marker), never colour alone.
- **Shared components.** Shared look comes from `ui/` components plus `/design` specimens. New pieces such as a toast, gear card or quiet-button variant should land there with their states.

## Historical Context (from prior changes)

- `context/archive/2026-10-07-ui-mobile-pass/` (S-01): set the three-line header, the verdict word at `text-verdict-sm` on phones, the gear row under the sky, and "never touch the panorama". The user's list now supersedes these (`change.md`). It also measured `VERDICT_MIN_HEIGHT_CLASS` (`sky-band.ts:17-19`).
- `context/archive/2026-10-05-ui-sky-light/`: added the edge chevrons with a translucent zenith face (`TonightSkyView.tsx:85-87` comment) and the `night-sky` scope.
- `context/archive/2026-10-05-session-plan-timeline/plan-brief.md:22,38,54`: the shared-axis rows were the user's request. Marks are told apart by shape. About 12 rows is "the plan".
- `context/archive/2026-10-05-ui-auth/`: "never put a card back" on auth pages. That rule is auth-scoped and is not contradicted by gear cards on Tonight, but the general Nightfall "Bands, not boxed cards" is.

## Related Research

- `context/changes/testing-night-and-date-boundaries/research.md` (main checkout, concurrent): touches `src/lib/engine`, `src/lib/tonight` tests, `src/pages/log/new.astro` and `src/lib/observations/store.ts`. No overlap with the files above except that both read `src/lib/tonight/build.ts`. This change only adds fields there, if option B or the exact dark-window strings are chosen.

## Open Questions

1. **Errors.** Should `?error=` server errors become toasts too, or stay inline next to their form (recommended: inline, as they are `role="alert"` form errors)?
2. **The URL param.** Should it be stripped (`history.replaceState`) after the toast shows, so a reload doesn't re-show it? That means updating about 12 `toHaveURL(...$)` assertions.
3. **One site or telescope.** What does the gear card show: a disabled one-option select, the name only, or the name plus a link to `/gear`? With 2-3 items, should the card replace the pills with a select (the e2e specs pin pills as navigation)?
4. **Session plan bar.** Which of options A-D? This is the user's visual choice; show mock-ups.
5. **Gear cards on phones.** Two stacked cards almost certainly push the first target under the 390×844 fold that `tonight-phone.spec.ts` pins. Either the removed header lines and word free enough height (to be measured), or the pin is relaxed by decision.
6. **Exact dark window on the slider.** Exact times need server-formatted strings on `SkyViewData`. The track span itself stays frame-quantised (10 min) unless it is placed by the exact instant's fraction instead of frame indices.
