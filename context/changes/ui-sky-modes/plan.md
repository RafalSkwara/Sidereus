# Tonight's live sky: drag to pan and Hidden / Default / Expanded modes — Implementation Plan

## Overview

The dashboard's live sky (`TonightSkyView`, `/tonight`) gets two owner requirements of 2026-10-17, run through `/10x-ui`:

1. **Drag to pan:** a mouse drag pans the panorama sideways; touch, pen, touchpad, keyboard and the chevrons keep working natively; a drag never opens a marker, a plain click still does.
2. **Three modes:** DEFAULT (today, unchanged), HIDDEN (the panorama and slider collapsed, the verdict still readable) and EXPANDED (the whole phone screen, most of a desktop screen). Stars and planets stay in their true places in every mode: the projection is recomputed for the new size and field, never scaled by CSS. The mode is remembered per viewer in a cookie, server-rendered like the theme, so nothing flashes or jumps.

The change also added four owner slices to `context/foundation/roadmap.md` (S-09 `ui-sky-modes`, S-10 `ui-quick-nav`, S-11 `ui-progress-rewards`, S-12 `app-icon`) and marked S-03 dropped; that edit is committed with this plan, not a phase.

Owner decisions on the look are open: see **QUESTIONS FOR OWNER** below. Each has a recommended option (⭐), and the plan is written on those defaults, so implementation can start before the answers; an answer that differs changes only the phase named in its question.

## Current State Analysis

From `research.md` (charges C1-C5) and the three research sweeps:

- The field is a constant 272 px tall (`TonightSkyView.tsx:287`, `STRIP_HEIGHT_PX + STRIP_OVERLAP_PX` from `sky-band.ts:61,71`), the island measures only the width (`:228-240`), and `project()` hard-wires 180° per viewport (`src/lib/sky-view/projection.ts:20-27`). The chevrons' `top` uses the same constants (`:601`).
- The panorama is a native `overflow-x-auto` region (`:460-471`): touch and touchpad scroll it, a mouse cannot. Markers are SVG `<a>` links (`:542-549`). No pointer-drag code exists in `src` (only `not-seen-tip.ts:45`, a document `pointerdown`).
- The theme cookie pattern: `preferences.ts:11-69` (names, resolve, `preferenceCookie` with a closed name union), `middleware.ts:13-17` (`locals.theme`, runs for server islands too), `Layout.astro:21,36-47` (`<html data-theme>` and the inline pre-paint script that corrects stored offline copies), `TopbarControls.tsx:133-157` (`useSyncExternalStore` on the html attribute, `document.cookie = preferenceCookie(...)`).
- The skeleton (`TonightSkeleton.astro:43-61`) reserves the band from `sky-band.ts` constants; the static `TonightSky.astro:68-80` draws the strip only with `strip`.
- The phone first screen at 390×844 has 33 px of slack in DEFAULT on a go night without an event line (`context/archive/2026-10-15-ui-dashboard-tiles/research.md:40`; `tests/e2e/tonight-phone.spec.ts:82-129`). Nothing may be added above the gear cards in DEFAULT.
- The verdict's dark-window line is `sr-only` beside the live slider (`VerdictCard.astro:81-91`); without the slider (HIDDEN) it must show.
- The only segmented 44 px control is file-local in `TopbarControls.tsx:36-43` (`groupClass`, `segmentClass`, `aria-pressed`).
- The sky island's imports are allowlisted (`src/components/island-imports.test.ts:29-38,70-89`; `@/lib/preferences` is already allowed). `contrast.test.ts:174-198` reads `PAN_FACE_CLASS` as one string literal.
- E2E for the live sky is `tests/e2e/tonight-sky.spec.ts` (slider, Now, plain marker clicks at `:276-302`); no spec reads `scrollLeft` or asserts the projection. `src/lib/sky-view/sky-view.test.ts` has no test of `project()`.

## Desired End State

- On a desktop, dragging the sky with the mouse pans it; releasing over a marker after a drag stays on `/tonight`; a plain click on a marker opens its page; Tab to the strip and the arrow keys pan it; on a phone, swiping works as today.
- A 44 px sky-view button sits at the top right of the verdict's column in every mode; it opens a small menu with three choices (Hidden, Default, Expanded) as a `SegmentedGroup` (`aria-pressed`, visible focus, 44 px targets), in EN and PL, in the dark, light and red themes.
- HIDDEN: the band is the verdict over the night gradient and the horizon silhouette, with the dark-window line visible; no panorama, no slider.
- EXPANDED: on a phone the band runs from the Topbar to the TabBar (sized on `100svh`, so with the address bar hidden a gap of the bar's height stays under it; accepted, F3); from `md` the band is `max(DEFAULT's band, (100svh − Topbar strip) × share)`, the share one constant (`--sky-expanded-share`, 1, owner answer Q3 A: the whole screen under the Topbar, never shorter than DEFAULT); the field keeps true angular proportions (1° sideways = 1° upwards) until a view would exceed 180°, and every marker's height matches its altitude.
- DEFAULT is pixel-for-pixel today's band; `tonight-phone.spec.ts` passes unchanged.
- The choice is stored in the `sidereus-sky` cookie (one year, like the theme), rendered on `<html data-sky-mode>` by the server and corrected before paint for stored offline copies; the skeleton reserves the chosen mode's height, so the island swaps in without a jump.
- `/design` shows `SegmentedGroup` and the sky in all three modes and the 7-state matrix; `CLAUDE.md` carries the rule.

Verification: the Success Criteria of each phase, the new e2e tests (drag, modes), the invariant test, and the screenshot gate in Phase 5.

### Key Discoveries

- The middleware sets locals for `/_server-islands/*` too (`middleware.ts:11-46`; `TonightContent.astro:51` reads `Astro.locals.locale`), so `locals.skyMode` reaches both the shell's skeleton and the island.
- `copies.ts:369-372` (`markFromDevice`) rewrites only `<html`, so a stored copy keeps the mode it was stored with unless the inline script corrects the attribute, as it does for the theme.
- `global.css` already holds `@custom-variant` (`:8-21`) and `@utility` blocks with `calc()` and `env(safe-area-inset-bottom)` (`:498-526`), the house way to add the variants and the expanded height without arbitrary values.
- `no-hardcoded-colors.test.ts:26-27` matches `<prop>-<palette>` only for a fixed list of props, so `sky-hidden:` / `sky-expanded:` and a `sky-expanded-height` utility are safe names; a `bg-sky-*` class would not be.
- The Playwright marker clicks have no movement between down and up, so a 6 px drag threshold leaves them passing.
- Prior decisions: interactive-sky chose a 180° view and rejected zoom (`context/archive/2026-10-05-interactive-sky/plan.md:76`); ui-sky-light deferred drag-to-pan (`context/archive/2026-10-05-ui-sky-light/plan.md:39`); the owner wants segmented `aria-pressed` 44 px controls (`context/archive/2026-09-26-ui-foundation/plan.md:64,177`).

## What We're NOT Doing

- No mode on the focused pages' quiet skies (`TonightPageSky`, `TonightSky quiet`) or the landing; the scope attribute exists only on the dashboard shell.
- No zoom or pinch, no vertical panning, no dome or atlas view (Parked: "A sky atlas or planetarium view"); EXPANDED is the same horizon panorama, larger.
- No change to DEFAULT's geometry (`h-52`, `-mt-16`, silhouette, 180° per view), its markers, labels, compass row or slider.
- No drag handling for touch or pen (native scrolling stays: a pen is subject to `touch-action` and would fight the browser's own scroll, F7), no momentum or inertia after a mouse drag, no wheel hijacking.
- No account-level (database) storage of the mode: it is a device preference like the theme.
- No change to `toast-region`'s TabBar offset (it keeps its `5rem`); the new chrome tokens are read by the sky only.
- No VoiceOver pass over the live sky (roadmap Open Roadmap Questions 3); the new control gets names and keyboard checks only.
- No mode control in the static fallback (`skyView` null): a failed sky view shows the static band in every mode (see Critical Implementation Details).

## Implementation Approach

Follow the `/10x-ui` order: contract first (preference, scope, variants, tokens, the shared control), then the geometry (a pure field function and a measured projection, DEFAULT unchanged), then the two behaviours on the one view (drag, modes), then the states, `/design` and the gate.

The key idea: **CSS decides the size, the island measures it.** The mode lives as `data-sky-mode` on a scope element (`<html>` on `/tonight`, a wrapper on `/design`); Tailwind variants `sky-hidden:` and `sky-expanded:` keyed off the nearest scope size the island's band, the static band and the skeleton alike, before hydration. The island measures its strip's width and height with one `ResizeObserver` and recomputes the projection for that size through `skyField()`. A stored offline copy is corrected by the same inline script as the theme. Nothing about the size is stored in React state that the server could disagree with.

## Critical Implementation Details

- **Scope, not global.** `Layout` renders `data-sky-mode` only when the page asks for it (the `/tonight` shell, through GearShell), and the inline script applies the cookie only when the attribute exists. Otherwise `/design` specimens in their own `data-sky-mode` wrappers would also match an `expanded` value on `<html>`.
- **State sequencing on a mode change:** read the azimuth at the middle of the view first, then set the scope attribute and the cookie, then (after the `ResizeObserver` re-measures and the projection redraws) scroll so that azimuth is back in the middle.
- **When the view recentres (F3):** on `facing` only at the first layout and when the measured **width** changes (today's rule, `TonightSkyView.tsx:242-246`). A change of the height alone (a phone's address bar, EXPANDED's `svh` box) and a mode change keep the azimuth at the middle of the view. Leaving HIDDEN centres on `facing` (the scroller was `display: none`, so there is no azimuth to keep). Heights use `100svh`, never `dvh`, so scrolling the page on a phone does not resize the band.
- **Before the first measurement (F4 c):** SSR (and the first client render, so hydration matches) draws the SVG at DEFAULT's box, 390 × 272 px (`DEFAULT_BOX` in the island), whatever the mode; in a mode other than DEFAULT the field stays `invisible` (as it does today while `compassTop === null`) until the first `ResizeObserver` measurement matches the mode, so stars never jump inside a taller field.
- **Hydration:** the island's mode is a `useSyncExternalStore` over the scope attribute (subscribe with a `MutationObserver`), with the server snapshot from the `mode` prop. On a stored copy whose cookie changed since, the attribute is already corrected before paint and the client snapshot wins after hydration, exactly as `TopbarControls` handles the theme.
- **Pointer capture and click:** start capturing only after the threshold, so a plain click keeps its normal target; after a drag, swallow the next `click` in the capture phase on the strip (and clear the flag on the next `pointerdown`, in case no click follows). Prevent `dragstart` on the markers so no link ghost appears.
- **Failed sky view (F4 d):** when `skyView` is null the island renders the static band, and the static band **follows the mode** too: it sits in the same `SKY_FRAME_CLASS` frame and its strip box uses the same mode variants, so it fills the height the skeleton reserved and does not jump. The same holds for `tonight.astro`'s no-Supabase static band. The static band carries no mode control (the mode can be changed again once the sky view is back).

## Phase 1: Contract — the preference, the scope, the variants, the tokens and `SegmentedGroup`

### Overview

Everything the view will read, with no visible change yet: the cookie and `locals.skyMode`, the scope attribute and pre-paint script, the Tailwind variants, the chrome-height tokens and the expanded height utility, and the shared segmented control extracted from `TopbarControls` (charges C2, C3, C5).

### Changes Required:

#### 1. Sky-mode preference

**File**: `src/lib/preferences.ts`, `src/middleware.ts`, `src/env.d.ts`

**Intent**: Add the sky mode as a third device preference, resolved for every request (shell and island) like the theme.

**Contract**: `SKY_MODES = ["hidden", "default", "expanded"] as const`, `type SkyMode`, `SKY_MODE_COOKIE = "sidereus-sky"`, `DEFAULT_SKY_MODE = "default"`, `isSkyMode`, `resolveSkyMode(cookie?)` (a valid cookie wins, else `default`); `preferenceCookie`'s name union gains `SKY_MODE_COOKIE`; `App.Locals.skyMode: SkyMode`, set in the middleware next to `theme`.

#### 2. The scope attribute and the pre-paint correction

**File**: `src/layouts/Layout.astro`, `src/components/gear/GearShell.astro`, `src/pages/tonight.astro`

**Intent**: Render `data-sky-mode={locals.skyMode}` on `<html>` only for the dashboard, and let the existing inline script correct it from the cookie before paint (stored offline copies), as it does for the theme.

**Contract**: `Layout` prop `skyModeScope?: boolean`; `GearShell` prop `skyModeScope?: boolean` passed through; `tonight.astro` passes it. The inline script gains `skyModes` and `skyCookie` via `define:vars` and sets `dataset.skyMode` only when `<html>` already has the attribute and the cookie is a valid, different mode.

#### 3. Variants, tokens and the expanded height

**File**: `src/styles/global.css`

**Intent**: The mode switches sizes in CSS before hydration; the expanded height comes from tokens, never an arbitrary `calc()` in a view.

**Contract**:

- `@custom-variant sky-hidden (&:where([data-sky-mode="hidden"] *));` and `sky-expanded` likewise (nearest-scope semantics are not needed: a page has one scope).
- Tokens on `:root` (not theme blocks; they are not colours): `--topbar-strip-height` (4.5rem; 5.5rem from `sm`: GearShell's `pt-2 sm:pt-6` + Topbar's `h-16`), `--tabbar-height` (4rem + 1px: `TabBar`'s `h-16` and its top border), `--sky-expanded-share` (1; **the single constant** for the desktop share, owner answer Q3 A: full screen under the Topbar). A comment beside each names the classes it mirrors; `GearShell`, `Topbar` and `TabBar` get a one-line comment pointing back.
- `@utility sky-expanded-height` sets the frame's **`min-height`**, never `height` (F1): below `md`, `100svh − topbar strip − tabbar − safe-area inset`; from `md` (no TabBar), `(100svh − topbar strip) × share`. The frame is a flex column whose children keep DEFAULT's own minimums (the verdict's min-height, the strip's `min-h-68`, the silhouette, the slider row), so its used height is `max(DEFAULT's band, target)` with no second constant: at share 1 the field is 288 px on a 1280×720 laptop (+16) and 468 px at 1440×900 (+196) (numbers in `research.md` § Heights). `svh`, not `dvh` (F3).

#### 4. `SegmentedGroup`, the shared 44 px segmented control

**File**: `src/components/ui/segmented.tsx` (new), `src/components/TopbarControls.tsx`, `src/components/island-imports.test.ts`

**Intent**: One segmented control for the settings panel and the sky-mode menu, so hover, pressed, focus and red-mode states cannot drift (charge C3).

**Contract**: `SegmentedGroup<T extends string>` props: `labelledBy` (id) or `label`, `options: { value: T; label: string; icon?: LucideIcon; disabled?: boolean }[]`, `value: T`, `onChange(value: T)`, `orientation: "horizontal" | "vertical"`, `className?`. Renders `role="group"` of `<button type="button" aria-pressed>` with today's `groupClass` / `segmentClass` (moved here, unchanged for horizontal; the vertical form stacks full-width rows of `h-11`, icon then label). Island-safe (React, `cn`, lucide only). `TopbarControls`' theme and language groups use it with identical markup semantics; `island-imports.test.ts` allows `@/components/ui/segmented` for the sky island.

#### 5. Strings

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: The control's names and the drag-aware panorama name.

**Contract**: under `tonight.sky`: `mode.label` ("Sky view" / "Widok nieba"), `mode.options` per `SkyMode` (Q6 default with F5's grammar: "Hidden" / "Default" / "Expanded"; "Ukryty" / "Domyślny" / "Rozwinięty", masculine to agree with "Widok"; pending Q6), `mode.trigger({ mode })` ("Sky view: Default" / "Widok nieba: Domyślny"); `panorama` becomes "Tonight's sky, drag or swipe to look around" / "Niebo dziś w nocy, przeciągnij lub przesuń, aby się rozejrzeć".

#### 6. `/design` specimens for `SegmentedGroup`

**File**: `src/pages/design.astro`

**Intent**: A new shared component gets its states in the kitchen sink.

**Contract**: a section `c-segmented` with horizontal and vertical groups: default, hover (specimen), focus-visible (specimen, `focusRing`), pressed, disabled (one option), in the page's theme; the N/A line for error, empty and loading.

### Success Criteria:

#### Automated Verification:

- Type check and lint pass: `npx astro sync && npx astro check && npm run lint`
- The reference suite passes: `npm run test:reference`
- The guards pass (island imports, contrast, colours, rhythm): `npm run test:guards`
- The hardcoded-value scan on the touched view files returns 0 hits (the `/10x-ui` regex over `TopbarControls.tsx`, `segmented.tsx`)

#### Manual Verification:

- The settings panel's theme and language controls look and behave as before in dark, light and red at 390 and 1440 px (screenshot beside `evidence/current-*`)
- `/design` § SegmentedGroup shows every state, focus ring visible in all three themes

**Implementation Note**: After this phase and all automated verification pass, pause for the human's manual confirmation before Phase 2.

---

## Phase 2: Field — `skyField()` and a measured projection, DEFAULT unchanged

### Overview

Make the sky drawable at any size without distortion (charge C1): a pure field function decides the strip width and degrees per view for a mode and a measured box; the island measures height as well as width. DEFAULT gives exactly today's numbers, so nothing visible changes in this phase.

### Changes Required:

#### 1. The field function and the projection

**File**: `src/lib/sky-view/field.ts` (new), `src/lib/sky-view/projection.ts`

**Intent**: One pure rule from (mode, viewport, field height) to the strip's geometry, so every mode keeps the sky's angles.

**Contract**: `skyField({ mode, viewportPx, fieldHeightPx }) → { stripWidthPx, fieldHeightPx, viewSpanDeg }`; it owns `EDGE_INSET_PX` (8, moved from the island) and `EXPANDED_MIN_SPAN_DEG` (60) / `MAX_SPAN_DEG` (180).

- `default` and `hidden`: `viewSpanDeg` 180, `stripWidthPx = 2 × max(viewportPx − 2 × inset, 1)` (today's).
- `expanded` (owner question Q4, default B): `viewSpanDeg = clamp((viewportPx − 2 × inset) × 90 / fieldHeightPx, 60, 180)`, `stripWidthPx = (viewportPx − 2 × inset) × 360 / viewSpanDeg`.
- Invariants: the strip spans exactly 360°; altitude 0–90° spans the field; `stripWidthPx ≥ 2 × (viewportPx − 2 × inset)` (the wrap point never shows twice).
- `project(point, facing, stripWidthPx, heightPx)` takes the whole strip width (today's callers pass `2 × half`): `x = stripWidth / 2 + offset / 360 × stripWidth`. Island-safe, under the import guard.

#### 2. The island measures its box

**File**: `src/components/tonight/TonightSkyView.tsx`, `src/components/tonight/sky-band.ts`

**Intent**: The field's height comes from layout, not constants, so a CSS mode can resize it; the chevrons sit at the measured middle of the visible strip.

**Contract**: the strip wrapper gets an explicit height class from `sky-band.ts` (`STRIP_FIELD_CLASS`: `h-68` = 208 + 64, keeping `-mt-16`, so DEFAULT's box is unchanged); one `ResizeObserver` **on that wrapper** (whose height comes from CSS, never on the scroller or the SVG, which would measure their own content, F4 b) sets `{ width, height }` state before paint (skip zero sizes: HIDDEN); the SVG's `height` is the measured height; every `placeAt` call, the label bounds and the compass row use `skyField(...)`'s output; the chevrons' `top` is the overlap plus half the visible strip, from the measured height. Recentring follows Critical Implementation Details (F3): `facing` at the first layout and on a width change only. SSR keeps the 390 × 272 default. `PAN_FACE_CLASS` stays one literal (contrast test).

#### 3. The invariant test

**File**: `src/lib/sky-view/sky-view.test.ts`

**Intent**: The only unit-level protection that a mode change cannot misplace the sky (risk: a scale or wrap error puts a star at the wrong altitude or azimuth after a resize or mode change). One looping test, counts asserted first, the case named in every failure.

**Contract**: one `it` over modes × sizes (390×272, 390×495, 320×272, 1440×306, 844×200 landscape): the strip's ends are `facing ± 180°`; 1° of azimuth is `stripWidth / 360` px; altitude 90 maps to 0 and 0 to the height; in `expanded`, px per degree sideways equals px per degree upwards whenever unclamped, and the span stays within [60°, 180°]; the strip is at least twice the inset viewport. No test of `default`'s literal numbers.

### Success Criteria:

#### Automated Verification:

- Type check, lint and the reference suite pass: `npx astro check && npm run lint && npm run test:reference`
- The guards pass: `npm run test:guards`
- The live-sky spec still passes unchanged against a fresh preview: `<e2e env> npx playwright test tests/e2e/tonight-sky.spec.ts` (Testing Strategy § Running the e2e specs)

#### Manual Verification:

- `/design` § TonightSkyView at 390 and 1440 px matches `evidence/current-phone-dark.png` and `evidence/current-desktop-dark.png` (same stars, labels, compass, chevrons)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Drag to pan

### Overview

A mouse drag pans the strip; touch and pen stay native (F7); a drag never fires a marker (charge C4).

### Changes Required:

#### 1. Pointer handling on the strip

**File**: `src/components/tonight/TonightSkyView.tsx`

**Intent**: Let a mouse pan the sky the way a finger already does, without stealing clicks or touches.

**Contract**: on the `[data-sky-strip]` scroller: `pointerdown` (primary button, `pointerType === "mouse"` only; pen and touch stay native, F7) records the start x, `scrollLeft` and pointer id; `pointermove` past `DRAG_THRESHOLD_PX` (6) starts the drag: `setPointerCapture`, `scrollLeft = start − dx`, a `data-sky-dragging` attribute (`cursor-grabbing`); `pointerup` / `pointercancel` end it and arm a one-shot click swallow (`onClickCapture`: `preventDefault` + `stopPropagation`); `dragstart` on markers is prevented. The scroller is `select-none` for fine pointers at rest (`pointer-fine:select-none`), so the first pixels of a mouse drag never start a text selection of the SVG labels (F7). Resting cursor `cursor-grab` for fine pointers only. `readEdges` / `readCentre` keep running from the scroll events. Keyboard (the strip's `tabIndex={0}`, arrow keys) and the chevrons are untouched.

#### 2. E2E: drag pans and never navigates

**File**: `tests/e2e/tonight-sky.spec.ts`

**Intent**: The only browser-level protection of the drag (risks: a mouse user cannot pan; a drag that ends over a marker navigates away). Plain marker clicks stay covered by the existing tests at `:276-302`.

**Contract**: a test "a mouse drag pans the panorama without opening a marker, and the arrow keys still pan it" (default `evening` clock): find an uncovered marker (`findMarker`), read `scrollLeft`, press on the marker, move 200 px left in steps, release; expect the URL still `/tonight`, `scrollLeft` larger by 200 ± 2 and the compass's current point changed; focus the strip, press ArrowLeft, expect `scrollLeft` smaller.

### Success Criteria:

#### Automated Verification:

- Lint, type check and the reference suite pass: `npx astro check && npm run lint && npm run test:reference`
- The live-sky spec passes, the new drag test included and the marker-click tests unchanged: `<e2e env> npx playwright test tests/e2e/tonight-sky.spec.ts` (Testing Strategy § Running the e2e specs)

#### Manual Verification:

- On a desktop with a mouse: drag pans smoothly both ways, releasing over a marker stays put, a click on a marker opens its page, chevrons still pan
- On a phone (real device or a touch emulator): swipe still scrolls, a tap on a marker still opens it

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Modes in the view — the control, HIDDEN, EXPANDED, the skeleton

### Overview

The visible feature: the sky-view button and menu, the three layouts in the island, the static band and the skeleton, the verdict's dark line in HIDDEN, persistence end to end (charge C5). Built on the owner's answers of 2026-10-17: Q1 A, Q2 A, Q3 A (full screen, share 1), Q4 B, Q5 A, Q6 A.

### Changes Required:

#### 1. The sky-view control

**File**: `src/components/tonight/sky-mode-control.tsx` (new), `src/components/island-imports.test.ts`

**Intent**: One 44 px button that is in the same place in every mode and opens a menu of the three modes (Q1 A).

**Contract**: a bare icon button (the current mode's lucide icon: `FoldVertical`, `RectangleHorizontal`, `Maximize2`; face from `PAN_FACE_CLASS`, so the contrast test covers it; `--ring` focus outline; `aria-label` `t.mode.trigger`), `popoverTarget` to a native `popover="auto"` panel (`bg-surface`, bordered, `rounded-lg`, `data-theme` copied from `<html>` on `beforetoggle`, id from `useId`), holding `mode.label` and a vertical `SegmentedGroup`. Choosing a mode calls the island's `chooseMode`, hides the popover and returns focus to the button. Hooks: `data-sky-mode-trigger`, `data-sky-mode-option="<mode>"`. `sky-mode-control.tsx` **and `ui/segmented.tsx`** are added to the island import guard's `SKY_SOURCES` (F9), so the shared control's own imports are checked too.

#### 2. The island in three modes

**File**: `src/components/tonight/TonightSkyView.tsx`, `src/components/tonight/sky-band.ts`, `src/components/tonight/TonightContent.astro`

**Intent**: The band follows the mode by CSS; the island owns the control and the choice.

**Contract**:

- Prop `mode: SkyMode` (server snapshot), passed by `TonightContent` from `Astro.locals.skyMode`; state = `useSyncExternalStore` over the nearest `[data-sky-mode]` scope (Critical Implementation Details).
- `chooseMode(next)`: remember the azimuth at the view's middle, set the scope's `data-sky-mode`, write `document.cookie = preferenceCookie(SKY_MODE_COOKIE, next)`, then restore that azimuth to the middle after the redraw.
- Shared classes in `sky-band.ts`, the whole flex chain written out (F4 a), shared by the island, the static band and the skeleton:
  - `SKY_FRAME_CLASS` (the island's root, the static band's wrapper and the skeleton's wrapper): `sky-expanded:flex sky-expanded:flex-col sky-expanded:sky-expanded-height` (a `min-height`, see Phase 1 §3);
  - `SKY_BAND_CLASS` (the gradient band, today `dusk-band … relative overflow-hidden` in the island and `TonightSky`'s root): `sky-expanded:flex sky-expanded:flex-1 sky-expanded:flex-col`;
  - the verdict container: `shrink-0` (its min-height variants below);
  - `STRIP_FIELD_CLASS` (the strip wrapper the `ResizeObserver` watches): `h-68 sky-hidden:hidden sky-expanded:h-auto sky-expanded:min-h-68 sky-expanded:flex-1` (never shorter than DEFAULT);
  - the silhouette and `SLIDER_ROW_CLASS`: `shrink-0`; the slider row gains `sky-hidden:hidden`.
  EXPANDED keeps the verdict, the slider and the TabBar (Q5 A).
- The control sits absolutely at the top right of the verdict's `max-w-3xl px-4` column (`pointer-events-auto z-20`, vertically on the date line: top 0 below `sm`, on the date line from `sm`), outside the verdict's flow, so DEFAULT's heights do not move.
- `skyField` gets the mode; HIDDEN skips the star pass (no box).

#### 3. Static band, skeleton and verdict

**File**: `src/components/tonight/TonightSky.astro`, `src/components/tonight/TonightSkeleton.astro`, `src/components/tonight/VerdictCard.astro`

**Intent**: The skeleton reserves the chosen mode's height so the swap does not jump, and HIDDEN keeps the dark window readable (Q2 A).

**Contract**: `TonightSky`'s root takes `SKY_BAND_CLASS` and its `strip` box uses the strip classes with the mode variants (`h-52`, `sky-hidden:hidden`, `sky-expanded:flex-1 sky-expanded:min-h-52`); the static band (the island's `skyView`-null fallback and `tonight.astro`'s no-Supabase band) sits in `SKY_FRAME_CLASS`, so it follows the mode and fills the reserved height (F4 d); `TonightSkeleton` wraps the band and the slider row in `SKY_FRAME_CLASS`; `VerdictCard`'s dark line is `sr-only sky-hidden:not-sr-only` when `withSlider` (no vertical step classes change, so the rhythm allowances stay exact). **HIDDEN's verdict height (F2):** the visible dark line adds one `text-label` line (20 px) that DEFAULT's `VERDICT_MIN_HEIGHT_CLASS` does not hold, so the class gains a HIDDEN variant, re-measured at 360 and 640 px on the EN go verdict with the line visible (about `sky-hidden:min-h-47 sm:sky-hidden:min-h-63`), and `TonightSkeleton` gets a matching bar for the line (`hidden sky-hidden:block`, in the line's place). Variants only match under a `[data-sky-mode]` scope, so the focused pages and the landing are untouched.

#### 4. E2E: modes

**File**: `tests/e2e/tonight-sky-modes.spec.ts` (new)

**Intent**: The only protection of the preference round trip, the no-jump swap and the "recomputed, not scaled" rule in a real browser. Imports `test` from `./helpers` (`clock: "evening"`), `onboardInMadrid`, `waitForHydration`; no `waitForTimeout` (the clock guard).

**Contract**: three tests:

- "a chosen mode is server-rendered on the next load and the skeleton keeps its height": for `expanded`, then `hidden`, then `default`: choose it through the control, expect `html[data-sky-mode]` and the `sidereus-sky` cookie; reload while holding `/_server-islands/**` in a `page.route` until the skeleton is measured; expect the shell's `<html>` to carry the mode, then release and expect the band's bottom within 1 px of the skeleton's.
- "expanded fills the phone screen and redraws the sky at its size" (390×844): the band's bottom meets the TabBar's top (± 1 px); the field's SVG `height` attribute equals its rendered height and exceeds 272; every marker's `cy` matches its accessible name's altitude (`H − alt / 90 × H`, ± H / 90 + 1 px). Desktop at **1440×900** (F1): measure the DEFAULT band first, then in EXPANDED expect the band's height to be `max(share × (900 − the Topbar strip's bottom), DEFAULT's band)` ± 2 px, the share read from `--sky-expanded-share` on `<html>` (so the test follows the one constant; 1 after Q3 A, the band then fills the screen under the Topbar strip).
- "hidden keeps the verdict and the dark window and lifts the gear cards" (390×844): the headline and the dark-window line are visible, `[data-sky-strip]` and the slider are not, and the Telescope card ends above the TabBar. Then at **320 px in Polish** (F8; the `sidereus-lang=pl` cookie), in DEFAULT and in HIDDEN: the trigger's box intersects neither the date's nor the headline's text boxes (text boxes from a `Range` over each text node, not the full-width block).

### Success Criteria:

#### Automated Verification:

- Type check, lint, reference and guards pass: `npx astro check && npm run lint && npm run test:reference && npm run test:guards`
- The new modes spec passes: `<e2e env> npx playwright test tests/e2e/tonight-sky-modes.spec.ts` (Testing Strategy § Running the e2e specs)
- The first-screen pin and the live-sky spec pass unchanged in DEFAULT: `<e2e env> npx playwright test tests/e2e/tonight-phone.spec.ts tests/e2e/tonight-sky.spec.ts` (Testing Strategy § Running the e2e specs)
- The hardcoded-value scan on `TonightSkyView.tsx`, `sky-mode-control.tsx`, `sky-band.ts`, `TonightSky.astro`, `TonightSkeleton.astro`, `VerdictCard.astro` returns 0 hits

#### Manual Verification:

- On a phone: each mode looks right in dark, light and red; EXPANDED's stars sit where the DEFAULT ones were (same altitudes), the menu opens and closes with Esc and an outside tap, focus returns to the button
- On a real phone in EXPANDED: scroll the page down to the cards and back; the panorama keeps its azimuth (no recentring while the address bar hides, F3)
- Offline: switch the mode on a stored Tonight page, reload offline, the stored page shows the new mode without a flash

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: States, `/design`, the screenshot gate and the rule

### Overview

Show every state in the kitchen sink, gate on screenshots, and leave the rule for the next agent.

### Changes Required:

#### 1. Kitchen sink

**File**: `src/pages/design.astro`

**Intent**: The 7-state matrix for the sky in its three modes and for the control.

**Contract**: § TonightSkyView gains one specimen per mode, each in a `data-sky-mode` wrapper (EXPANDED at its real height); a § "Sky view control" with the trigger at rest, hover (specimen), focus-visible (specimen) and the open menu drawn inline (pressed option); `TonightSkeleton` per mode for loading. The N/A line: disabled — N/A (the mode is a device setting and works offline); error — without a sky view the static band shows and has no control; empty — a no-go night with no deep-sky markers.

| State         | Sky in a mode                               | Sky-view control                                      |
| ------------- | ------------------------------------------- | ----------------------------------------------------- |
| default       | three specimens (hidden, default, expanded) | trigger at rest, menu with the current mode pressed   |
| hover         | a marker's label underlines (existing)      | trigger face at full opacity; segment text to heading |
| focus-visible | marker ring, strip outline (existing)       | `--ring` outline on the trigger and the segments      |
| disabled      | N/A (no disabled state)                     | N/A (works offline)                                   |
| error         | static fallback band (no control)           | N/A (not rendered without a sky view)                 |
| empty         | no-go night: planets and Moon only          | N/A                                                   |
| loading       | `TonightSkeleton` per mode, same height     | N/A (rendered with the island)                        |

#### 2. Screenshot gate

**File**: `context/changes/ui-sky-modes/evidence/`

**Intent**: The visual gate: one view, every state at once, desktop and one phone width, three themes.

**Contract**: screenshots of `/design` §§ TonightSkyView and Sky view control at 1440 px and 390 px in dark, light and red (`after-<section>-<width>-<theme>.png`), on dev port 4345; the DEFAULT specimen compared with `evidence/current-*` (no visual delta allowed); no pixel baselines are added (the repo pins boxes, not pixels).

#### 3. The rule

**File**: `CLAUDE.md`

**Intent**: The next agent keeps the contract.

**Contract**: in "UI (Nightfall)": `SegmentedGroup` joins the Components list ("the one segmented control; never a local copy"); "Tonight's live sky" gains the modes (scope attribute, variants, `sky-band.ts` classes, `skyField`, "the projection is recomputed for the measured box, never CSS-scaled; DEFAULT's geometry is fixed", the `min-height` frame and `svh`, the recentring rule), the drag rule (mouse only, pen and touch native, 6 px threshold, `pointer-fine:select-none`, click swallowed after a drag) and the control's place; "Phone first" notes that the first-screen pin is DEFAULT's; the Layout paragraph in Architecture names the `sidereus-sky` cookie beside the theme's.

### Success Criteria:

#### Automated Verification:

- The whole e2e suite and smoke pass the way CI runs them (fresh `npm run build`, forecast fixture, local stack keys inline): `npm run test:e2e` and `npm run smoke`
- Lint, type check and both Vitest projects pass: `npx astro check && npm run lint && npm test`

#### Manual Verification:

- The screenshot gate: every cell of the 7-state table is visible (or N/A with its reason) in the saved screenshots, in all three themes, at 1440 and 390 px
- `CLAUDE.md`'s new lines read correctly against the code (paths and names exist)

---

## Testing Strategy

### Unit Tests:

- One invariant test in `src/lib/sky-view/sky-view.test.ts` (Phase 2): the strip spans 360°, altitude spans the field, EXPANDED keeps square degrees until clamped, the strip is at least twice the view. It is the only unit-level protection of "positions stay correct in every mode". No tests of the preference helpers, class strings or the control's markup (test-suite-diet rubric).

### Integration Tests:

- `tests/e2e/tonight-sky.spec.ts` + 1 test: drag pans, never navigates; arrows still pan (Phase 3).
- `tests/e2e/tonight-sky-modes.spec.ts`, 3 tests: persistence and no-jump per mode, EXPANDED size (phone, and 1440×900 against `max(share, DEFAULT)`) and recomputed projection, HIDDEN content and the 320 px Polish no-overlap of the trigger (Phase 4).
- Unchanged and required green: `tonight-phone.spec.ts` (DEFAULT first screen, sideways scroll at 320/375 px with the new control present), `tonight-sky.spec.ts` marker clicks.

### Running the e2e specs

`playwright.config.ts` has no `webServer`, so every e2e command in this plan (`<e2e env>`) runs the way CI's `smoke` job does, with every npm/npx/node command behind the nvm prefix (`export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null &&`):

1. local Supabase running (`npx supabase start`), its values from `npx supabase status -o env`;
2. the forecast fixture: `node tests/e2e/forecast-fixture.mjs` (port 4400);
3. the worktree's gitignored `.env` and `.dev.vars` hold the local stack's `SUPABASE_URL` / `SUPABASE_KEY` (anon) and `FORECAST_BASE_URL=http://127.0.0.1:4400`, never the secret key;
4. a fresh `npm run build`, then `npm run preview -- --port 4345`;
5. the command itself with the local stack's keys inline, never exported: `SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=http://localhost:4345 npx playwright test <spec>`.

### Manual Testing Steps:

1. Desktop, mouse: drag the sky both ways; release over a marker; click a marker; use the chevrons; Tab to the strip and press the arrows.
2. Phone: swipe the sky; tap a marker; open the sky-view menu, pick each mode, close with Esc and by tapping outside.
3. EXPANDED on a phone and a desktop: compare a planet's position with DEFAULT (same altitude, same compass direction).
4. HIDDEN: the verdict and the dark window read without the sky; the gear cards are higher.
5. Red mode: the trigger, the menu and the pressed option are distinguishable without colour.
6. Offline: change the mode, reload a stored page offline.

## Performance Considerations

EXPANDED on a desktop draws the same 921 stars into a larger SVG; the per-frame work (rotation and one path string) is unchanged. A drag only sets `scrollLeft`; the existing scroll handlers keep their "set state only on change" guards. HIDDEN skips the star pass.

## Migration Notes

None: a missing or invalid cookie is DEFAULT, which is today's band.

## Plan review triage

Review: `reviews/plan-review.md` (2026-10-17, NEEDS ATTENTION, F1-F10). All ten findings accepted with the reviewer's fixes (owner's lead, 2026-10-17):

| Finding | Decision | What changed |
| ------- | -------- | ------------ |
| F1 EXPANDED at 80 % is not taller than DEFAULT on laptops | accepted | `sky-expanded-height` is a `min-height` on a flex column, so the band is `max(DEFAULT, (100svh − Topbar strip) × share)`; the share is one constant (`--sky-expanded-share`; 1 after the owner's Q3 A); the e2e desktop check moved to 1440×900 and asserts `max(share, DEFAULT)` with the share read from the token; Q3 carries the real numbers (`research.md` § Heights) |
| F2 HIDDEN's visible dark line adds 20 px the skeleton does not hold | accepted | `VERDICT_MIN_HEIGHT_CLASS` gains a re-measured HIDDEN variant; `TonightSkeleton` gets a matching `hidden sky-hidden:block` bar (Phase 4 §3) |
| F3 `dvh` plus recentring on every resize loses the pan | accepted | `100svh`; recentre on `facing` only at the first layout and on a width change; a height-only or mode change keeps the middle azimuth; leaving HIDDEN centres on `facing`; manual phone-scroll step added (Critical Implementation Details, Phase 2 §2, 4.5) |
| F4 EXPANDED's flex chain was underspecified | accepted | the full class chain in `sky-band.ts` (frame, band, verdict, strip wrapper, silhouette, slider); the `ResizeObserver` watches the strip wrapper; the field stays `invisible` until the first measurement in a non-DEFAULT mode; the static band follows the mode (Phase 4 §2-3, Critical Implementation Details) |
| F5 Polish mode names disagreed in gender with "Widok nieba" | accepted | "Ukryty / Domyślny / Rozwinięty" under "Widok nieba" (pending Q6) |
| F6 research counted the overlap twice | accepted | DEFAULT phone band 484 px; HIDDEN removes **284 px** of strip and slider (the corrected F6 figure), and the visible dark-window line (F2) gives 20 px back, so the cards rise about 264 px; fixed in `research.md` and Q2 A |
| F7 pen drag fights native scroll; selection starts before the threshold | accepted | mouse only, pen and touch native; the scroller is `pointer-fine:select-none` (Phase 3 §1, CLAUDE.md rule in Phase 5) |
| F8 no check that the trigger clears the Polish date and headline at 320 px | accepted | a 320 px Polish no-overlap assertion in the HIDDEN test, in DEFAULT and HIDDEN (Phase 4 §4) |
| F9 e2e commands need the prepared environment; `segmented.tsx` not scanned | accepted | `<e2e env>` on rows 2.3, 3.2, 4.2, 4.3, spelled out in Testing Strategy § Running the e2e specs; `ui/segmented.tsx` joins `SKY_SOURCES` (Phase 4 §1) |
| F10 roadmap nits | accepted | S-09 `planned` everywhere, MS-06 after MS-05, Parked reads "badges to share" (`context/foundation/roadmap.md`) |

## Owner answers (2026-10-17)

Relayed by the orchestrator; they replace the ⭐ defaults where they differ.

| Q | Answer | Effect on the plan |
| - | ------ | ------------------ |
| Q1 | A: one 44 px button plus a menu | as planned (Phase 4 §1) |
| Q2 | A: the verdict, the horizon and the dark-window line | as planned (Phase 4 §3, F2) |
| Q3 | **A: full screen under the Topbar, never shorter than DEFAULT** (differs from ⭐ B) | `--sky-expanded-share` = 1, so the desktop band is `max(DEFAULT's band, 100svh − Topbar strip)`; the 1440×900 e2e assertion reads the share from the token (Phase 1 §3, Phase 4 §4) |
| Q4 | B: true proportions, 60–180° per view | as planned (`skyField`, Phase 2) |
| Q5 | A: verdict, slider and TabBar stay visible on the phone | as planned (Phase 4 §2) |
| Q6 | A: Hidden / Default / Expanded; PL "Ukryty / Domyślny / Rozwinięty" under "Widok nieba" | as planned (Phase 1 §5, F5) |

The orchestrator also pins three review points: **F4** the pre-hydration SVG is DEFAULT's 390 × 272 px box in every mode (invisible until measured outside DEFAULT), and the static band after a sky-view failure follows the mode (one rule, Critical Implementation Details); **F6** the corrected figure is 284 px; **F7** mouse only, no pen.

## QUESTIONS FOR OWNER

Każde pytanie ma rekomendowaną opcję (⭐); plan jest napisany na rekomendacjach, więc implementacja może ruszyć bez odpowiedzi. Inna odpowiedź zmienia tylko fazę podaną przy pytaniu. Makiety leżą w `context/changes/ui-sky-modes/evidence/` (zrobione na `/design`; ikony i podpisy w makietach są robocze).

**Q1. Gdzie stoi przełącznik trybu nieba?** (Faza 4)

- ⭐ **A.** Jedna ikona 44 px w prawym górnym rogu nieba, na wysokości daty; dotknięcie otwiera małe menu z trzema opcjami. Makiety: `evidence/toggle-A-menu-phone.png`, `evidence/toggle-A-menu-open-phone.png`. Plus: nie dodaje wysokości (pierwszy ekran telefonu bez zmian), mieści się przy 320 px po polsku, to samo miejsce w każdym trybie. Minus: dwa dotknięcia zamiast jednego.
- **B.** Przełącznik segmentowy 3 × 44 px w prawym górnym rogu. Makieta: `evidence/toggle-B-segmented-top-phone.png`. Plus: jedno dotknięcie, stan widać od razu. Minus: 132 px szerokości zderza się z polską datą przy 320–360 px, więc werdykt musiałby zarezerwować miejsce z prawej (ponowny pomiar wysokości werdyktu i ryzyko dla pierwszego ekranu).
- **C.** Przełącznik segmentowy w wierszu suwaka, obok „Teraz”. Makiety: `evidence/toggle-C-segmented-slider-phone.png`, `evidence/toggle-C-segmented-slider-desktop.png`. Plus: na desktopie obok innych kontrolek nieba. Minus: na telefonie zabiera suwakowi prawie całą szerokość, a w trybie ukrytym suwaka nie ma, więc przełącznik musiałby się przenosić.

**Q2. Jak wygląda tryb UKRYTY?** (Faza 4)

- ⭐ **A.** Werdykt na nocnym gradiencie i sylwetka horyzontu, bez panoramy i bez suwaka; linia ciemnego okna („Ciemno 19:45–05:00 CEST”) staje się widoczna. Makieta: `evidence/hidden-A-verdict-only-phone.png`. Karty sprzętu idą w górę o ok. 264 px na telefonie (pasmo jest o 284 px niższe, a widoczna linia ciemnego okna dokłada 20 px; poprawione w triage F2/F6).
- **B.** Cienki pas horyzontu (ok. 72 px) z planetami i gwiazdami nisko nad horyzontem, bez suwaka. Makieta: `evidence/hidden-B-thin-horizon-phone.png`. Minus: pokazuje tylko jedną chwilę bez możliwości przesunięcia czasu, bez kompasu łatwo go źle odczytać, więcej kodu.
- **C.** Bez pasma nieba w ogóle: werdykt jako zwykły nagłówek na tle strony. Minus: łamie zasadę „niebo Tonight jest zawsze nocne” (Nightfall) i wymaga drugiej wersji `VerdictCard`.

**Q3. Wysokość trybu ROZWINIĘTEGO na desktopie?** (Faza 1, jedna stała: token `--sky-expanded-share`) **Odpowiedź właściciela (2026-10-17): A, udział 1.** Makieta: `evidence/expanded-heights-desktop.png` (żółte ramki; ramki są poglądowe, prawdziwe liczby niżej).

Pasmo ROZWINIĘTE na desktopie ma wysokość `max(DOMYŚLNE, (wysokość ekranu − pasek Topbara 88 px) × udział)`: nigdy nie jest niższe od domyślnego (616 px od `sm`), bo werdykt, sylwetka i suwak zajmują 408 px. Pole nieba (to, co faktycznie rośnie) przy różnych ekranach, dziś 272 px:

| Ekran     | 80 % (B) | cały ekran (A) | 2/3 (C) |
| --------- | -------- | -------------- | ------- |
| 1280×720  | 272 (bez zysku) | 288 (+16) | 272 (bez zysku) |
| 1366×768  | 272 (bez zysku) | 336 (+64) | 272 (bez zysku) |
| 1536×864  | 277 (+5)  | 432 (+160)    | 272 (bez zysku) |
| 1440×900  | 306 (+34) | 468 (+196)    | 272 (bez zysku) |
| 1920×1080 | 450 (+178) | 648 (+376)   | 317 (+45) |

- **A.** Cały ekran pod Topbarem (udział 1,0). Plus: maksimum nieba; recenzent planu rekomenduje tę opcję. Minus: nic nie podpowiada, że pod spodem są karty i kafelki; na laptopie 1280×720 zysk i tak tylko 16 px.
- ⭐ **B.** 80 % ekranu pod Topbarem (udział 0,8). Plus: górna krawędź kart wystaje i zaprasza do przewinięcia. Minus: na laptopach 1280×720 i 1366×768 wygląda tak samo jak DOMYŚLNY, realny zysk dopiero od ok. 1440×900.
- **C.** 2/3 ekranu. Minus: zysk dopiero na dużych monitorach.
- Uwaga: realny zysk na laptopie wymagałby zmniejszenia odstępów werdyktu w tym trybie (osobna decyzja i nowy pomiar wysokości szkieletu); poza zakresem, chyba że właściciel o to poprosi.

**Q4. Pole widzenia w trybie ROZWINIĘTYM?** (Faza 2, `skyField`)

- **A.** 180° na szerokość ekranu, jak dziś, tylko wyżej. Plus: zgodne z decyzją interactive-sky („180° na widok, bez zoomu”). Minus: na telefonie gwiazdozbiory wychodzą ok. 3 razy wyższe niż szersze.
- ⭐ **B.** Prawdziwe proporcje: 1° w poziomie = 1° w pionie, maksymalnie 180° na ekran (minimum 60°). Telefon 390×844 pokazuje ok. 68° naraz (resztę przeciągnięciem lub przesunięciem palcem), desktop zostaje przy 180° (prawdziwe proporcje wymagałyby pola ok. 712 px wysokości, więc na desktopie w praktyce to wariant A). Plus: gwiazdozbiory wyglądają jak na prawdziwym niebie. Minus: na telefonie więcej przesuwania; zmienia regułę „180° na widok” dla tego jednego trybu.
- **C.** Stałe 120° na ekran przy każdej szerokości. Plus: kompromis, przewidywalny. Minus: ani prawdziwe proporcje, ani dzisiejszy widok.

**Q5. Telefon w trybie ROZWINIĘTYM: co zostaje na ekranie?** (Faza 4) Makieta: `evidence/expanded-phone-whole-screen.png`.

- ⭐ **A.** Werdykt u góry, suwak na dole, dolny pasek (TabBar) widoczny; niebo wypełnia resztę. Plus: werdykt i czas zawsze pod ręką, nawigacja działa jak wszędzie.
- **B.** Werdykt zwinięty do jednej linii (kropka i nagłówek), więcej miejsca na niebo. Minus: druga wersja werdyktu, ponowny pomiar wysokości szkieletu.
- **C.** Tryb immersyjny: Topbar i TabBar się chowają, wyjście tylko przyciskiem trybu. Minus: nietypowe zachowanie nawigacji, ryzyko „uwięzienia” użytkownika.

**Q6. Nazwy trybów w menu?** (Faza 1, `en.ts` / `pl.ts`)

- ⭐ **A.** „Ukryty / Domyślny / Rozwinięty” (EN „Hidden / Default / Expanded”), nagłówek „Widok nieba”, przycisk „Widok nieba: Domyślny”. Formy męskie, bo zgadzają się z „Widok” (triage F5). Plus: te same słowa co w wymaganiach.
- **B.** „Ukryj niebo / Zwykły / Pełny ekran” (EN „Hide the sky / Normal / Full screen”). Plus: opisują efekt. Minus: „Pełny ekran” nie jest prawdą na desktopie (80 %).

## References

- Research and charges: `context/changes/ui-sky-modes/research.md`
- Mockups and current screenshots: `context/changes/ui-sky-modes/evidence/`
- Theme pattern: `src/lib/preferences.ts:11-69`, `src/middleware.ts:13-17`, `src/layouts/Layout.astro:21,36-47`, `src/components/TopbarControls.tsx:36-43,133-157`
- The view: `src/components/tonight/TonightSkyView.tsx`, `src/components/tonight/sky-band.ts`, `src/lib/sky-view/projection.ts`
- First-screen pin: `tests/e2e/tonight-phone.spec.ts:82-129`; live-sky spec: `tests/e2e/tonight-sky.spec.ts`
- Prior decisions: `context/archive/2026-10-05-interactive-sky/plan.md`, `context/archive/2026-10-05-ui-sky-light/plan.md`, `context/archive/2026-10-08-ui-user-adjustments/change.md`
- Roadmap: `context/foundation/roadmap.md` S-09 (and S-10 to S-12, added by this change)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Contract — the preference, the scope, the variants, the tokens and `SegmentedGroup`

#### Automated

- [x] 1.1 Type check and lint pass: `npx astro sync && npx astro check && npm run lint` — 50f6357
- [x] 1.2 The reference suite passes: `npm run test:reference` — 50f6357
- [x] 1.3 The guards pass (island imports, contrast, colours, rhythm): `npm run test:guards` — 50f6357
- [x] 1.4 The hardcoded-value scan on the touched view files returns 0 hits (the `/10x-ui` regex over `TopbarControls.tsx`, `segmented.tsx`) — 50f6357

#### Manual

- [ ] 1.5 The settings panel's theme and language controls look and behave as before in dark, light and red at 390 and 1440 px (screenshot beside `evidence/current-*`)
- [ ] 1.6 `/design` § SegmentedGroup shows every state, focus ring visible in all three themes

### Phase 2: Field — `skyField()` and a measured projection, DEFAULT unchanged

#### Automated

- [x] 2.1 Type check, lint and the reference suite pass: `npx astro check && npm run lint && npm run test:reference` — 9b21998
- [x] 2.2 The guards pass: `npm run test:guards` — 9b21998
- [x] 2.3 The live-sky spec still passes unchanged against a fresh preview: `<e2e env> npx playwright test tests/e2e/tonight-sky.spec.ts` — 9b21998

#### Manual

- [ ] 2.4 `/design` § TonightSkyView at 390 and 1440 px matches `evidence/current-phone-dark.png` and `evidence/current-desktop-dark.png` (same stars, labels, compass, chevrons)

### Phase 3: Drag to pan

#### Automated

- [ ] 3.1 Lint, type check and the reference suite pass: `npx astro check && npm run lint && npm run test:reference`
- [ ] 3.2 The live-sky spec passes, the new drag test included and the marker-click tests unchanged: `<e2e env> npx playwright test tests/e2e/tonight-sky.spec.ts`

#### Manual

- [ ] 3.3 On a desktop with a mouse: drag pans smoothly both ways, releasing over a marker stays put, a click on a marker opens its page, chevrons still pan
- [ ] 3.4 On a phone (real device or a touch emulator): swipe still scrolls, a tap on a marker still opens it

### Phase 4: Modes in the view — the control, HIDDEN, EXPANDED, the skeleton

#### Automated

- [ ] 4.1 Type check, lint, reference and guards pass: `npx astro check && npm run lint && npm run test:reference && npm run test:guards`
- [ ] 4.2 The new modes spec passes: `<e2e env> npx playwright test tests/e2e/tonight-sky-modes.spec.ts`
- [ ] 4.3 The first-screen pin and the live-sky spec pass unchanged in DEFAULT: `<e2e env> npx playwright test tests/e2e/tonight-phone.spec.ts tests/e2e/tonight-sky.spec.ts`
- [ ] 4.4 The hardcoded-value scan on `TonightSkyView.tsx`, `sky-mode-control.tsx`, `sky-band.ts`, `TonightSky.astro`, `TonightSkeleton.astro`, `VerdictCard.astro` returns 0 hits

#### Manual

- [ ] 4.5 On a phone: each mode looks right in dark, light and red; EXPANDED's stars sit where the DEFAULT ones were (same altitudes), the menu opens and closes with Esc and an outside tap, focus returns to the button
- [ ] 4.6 Offline: switch the mode on a stored Tonight page, reload offline, the stored page shows the new mode without a flash

### Phase 5: States, `/design`, the screenshot gate and the rule

#### Automated

- [ ] 5.1 The whole e2e suite and smoke pass the way CI runs them (fresh `npm run build`, forecast fixture, local stack keys inline): `npm run test:e2e` and `npm run smoke`
- [ ] 5.2 Lint, type check and both Vitest projects pass: `npx astro check && npm run lint && npm test`

#### Manual

- [ ] 5.3 The screenshot gate: every cell of the 7-state table is visible (or N/A with its reason) in the saved screenshots, in all three themes, at 1440 and 390 px
- [ ] 5.4 `CLAUDE.md`'s new lines read correctly against the code (paths and names exist)
