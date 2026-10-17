---
date: 2026-10-17T14:29:17+02:00
researcher: Claude (ui-sky-modes subagent)
git_commit: e563fda42ea13fca93cacc3aed6cd8c0367fe003
branch: feat/ui-sky-modes
repository: sidereus
topic: "/10x-ui audit of TonightSkyView, plus grounding for drag-to-pan and the Hidden / Default / Expanded sky modes"
tags: [research, ui, tonight, sky-view, TonightSkyView, sky-band, preferences, e2e]
status: complete
last_updated: 2026-10-17
last_updated_by: Claude (ui-sky-modes subagent)
---

# Research: TonightSkyView audit, drag-to-pan and sky modes

**Date**: 2026-10-17T14:29:17+02:00
**Researcher**: Claude (ui-sky-modes subagent)
**Git Commit**: e563fda (origin/main at branch creation)
**Branch**: feat/ui-sky-modes
**Repository**: sidereus

## Research Question

The owner's requirements of 2026-10-17 (`change.md`) for the dashboard's live sky band (`TonightSkyView`):

1. mouse drag-to-pan on desktop, with a click-vs-drag threshold, keyboard and touch unchanged;
2. two more modes beside today's (DEFAULT): HIDDEN (the sky collapsed, the verdict still readable) and EXPANDED (whole screen on a phone, most of it on a desktop), positions astronomically correct in every mode (the projection recomputed, never CSS scaling), the mode remembered per viewer in a cookie, server-rendered like the theme, so no flash;
3. the /10x-ui two-way audit of the view: 3-5 charges with file, line and user impact.

## Summary

- **Design-system variant: existing design system.** Tokens live in `src/styles/global.css` (three theme blocks, `@custom-variant` lines 8-21, `@utility` blocks such as `toast-region` at 515-526), components in `src/components/ui/`. The hardcoded-value scan (10x-ui regex) on `TonightSkyView.tsx`, `sky-band.ts`, `TonightSky.astro`, `TonightSkeleton.astro` and `TonightContent.astro` returns **0 hits** (run 2026-10-17). The four `style=` uses in `TonightSkyView.tsx` (446, 601, 653, 688) are computed geometry (the dusk mix, the chevrons' top, the dark span, slider label x), not literals. The view drifts by geometry and architecture, not by colour.
- **The geometry is fixed in three places, so no other size is possible without distortion.** The field height is `STRIP_HEIGHT_PX + STRIP_OVERLAP_PX` (`TonightSkyView.tsx:287`, 208 + 64 = 272 px from `sky-band.ts:61,71`); the island measures only the width (`TonightSkyView.tsx:228-240`); `project()` hard-wires 180° per viewport width (`projection.ts:20-27`, strip `2 × width`); the chevrons' top is the same constant sum (`TonightSkyView.tsx:601`). A mode with another height needs the island to measure the strip's height too and the projection to take a field (degrees per viewport) as an input.
- **The theme cookie pattern has three parts, all reusable:** the middleware resolves the cookie into `locals.theme` (`src/middleware.ts:13`), `Layout.astro:21` renders `<html data-theme>` and an inline pre-paint script (`Layout.astro:36-47`) re-applies the cookie for stored offline copies, and `TopbarControls.tsx:133-157` hydrates from the html attribute (`useSyncExternalStore`) and writes `document.cookie = preferenceCookie(...)`. `preferenceCookie`'s name is a closed union of the two cookies (`preferences.ts:67`) and must widen.
- **The middleware runs for the server island too.** It is one unfiltered `onRequest` (`middleware.ts:11-46`); `TonightContent.astro:51` reads `Astro.locals.locale`. A `locals.skyMode` is therefore available both to the shell (and `TonightSkeleton`, which already reads `Astro.locals.locale` at `TonightSkeleton.astro:29`) and to the island. "Not behind the middleware" in the docs (`lessons.md`, the full-plan lesson) means not behind the protected-route gate.
- **Stored offline copies freeze server-rendered state.** `markFromDevice` only adds `data-from-device` to `<html` (`src/lib/offline/copies.ts:369-372`), so a mode rendered into the shell or the island HTML is the mode at store time; the theme survives that only because of the inline script. A mode must follow the same path: an attribute the inline script corrects before paint, and CSS variants (like `red:`, `global.css:18`) keyed off it, so the skeleton, the band and the stored copy all agree before hydration.
- **The phone first screen has 33 px of slack in DEFAULT** (EN go night, no event line: Telescope title bottom 746 px vs TabBar top 779 px at 390×844; `context/archive/2026-10-15-ui-dashboard-tiles/research.md:40`), and about 5 px on a one-line event night (`tests/e2e/tonight-phone.spec.ts:19-22`). A 44 px control row between the band and the cards breaks the pin; the toggle must sit inside the band's existing area (absolutely positioned), and DEFAULT's geometry must not move.
- **Drag-to-pan is new code.** No `onPointerDown`, `setPointerCapture` or `pointermove` exists in `src` (the only pointer listener is a document `pointerdown` in `src/components/tonight/not-seen-tip.ts:45`). The scroller is a native `overflow-x-auto` region (`TonightSkyView.tsx:460-471`), so touch swipe and keyboard arrows already work natively. Drag was deferred, not rejected, in ui-sky-light (`context/archive/2026-10-05-ui-sky-light/plan.md:39`).
- **E2E coverage of the live sky is one spec,** `tests/e2e/tonight-sky.spec.ts`: slider frames, Now, and plain marker clicks (`:276-302`, a Playwright click with no movement, so a drag threshold keeps them passing). No spec reads `scrollLeft`, clicks a chevron or asserts the projection. `src/lib/sky-view/sky-view.test.ts` has no test of `project()`.

## Charges

Each charge: file and line, the effect on the user, and the planned fix (phase in `plan.md`). The view → source direction found no literal colour or arbitrary value (0 scan hits), so the missing-token charge is about geometry tokens, not colours.

### C1 — Accidental architecture: the sky's size and field are constants, so the sky can only be drawn at one size

- **Evidence:** `src/components/tonight/TonightSkyView.tsx:287` (`const height = STRIP_HEIGHT_PX + STRIP_OVERLAP_PX`), `:228-240` (only `clientWidth` is measured), `:284-285` (the strip is twice the inset viewport), `:601` (the chevrons' `top` from the same constants); `src/lib/sky-view/projection.ts:20-27` (180° per viewport, `x = width + offset/180 × width`); `src/components/tonight/sky-band.ts:60-61` (`h-52`, 208).
- **User impact:** the user cannot see a bigger or a smaller sky; any EXPANDED mode built on today's code could only stretch the SVG (positions would no longer match altitudes and azimuths). On a 1440 px desktop the 272 px tall field shows 180° across 1440 px, 8 px per degree sideways against 3 px per degree upwards, so constellations read 2.7 times too wide; on a 390 px phone, 2.2 against 3.0.
- **Fix:** a pure `skyField(mode, viewport, fieldHeight)` in `src/lib/sky-view/` returns the strip width, field height and degrees per viewport; `project()` takes the strip width; the island measures the strip's width and height (one `ResizeObserver`) and recomputes; the chevrons sit at the measured middle. DEFAULT keeps today's numbers exactly. (Plan Phase 2.)

### C2 — Missing token: no tokens for the chrome's heights, so an EXPANDED height would be an arbitrary `calc()`

- **Evidence:** the sky-flow strip is `pt-2 sm:pt-6` around a `h-16` Topbar (`src/components/gear/GearShell.astro:40-41`, `src/components/Topbar.astro:33`: 72 px on a phone, 88 px from `sm`); the TabBar is `h-16` plus a 1 px border plus `pb-safe-area` (`src/components/TabBar.astro:31-33`, below `md` only); `toast-region` already hard-codes the TabBar as `5rem` inside a `calc` (`global.css:522-526`).
- **User impact:** "whole screen on a phone" means `100dvh` minus the Topbar strip and the TabBar; without tokens the height would be an arbitrary `h-[calc(100dvh-...)]` (forbidden in views) and would drift the next time the Topbar or TabBar changes, leaving the panorama under the TabBar or short of it.
- **Fix:** `--topbar-strip-height` and `--tabbar-height` (per breakpoint) and an `@utility sky-expanded-height` in `global.css`, read by the band; `toast-region` switches to the TabBar token. (Plan Phase 1.)

### C3 — Missing shared component: the segmented 44 px control exists only as a file-local copy

- **Evidence:** `src/components/TopbarControls.tsx:36-43` (`groupClass`, `segmentClass`: `role="group"` of `aria-pressed` buttons, `h-11`, `aria-pressed:bg-selected`, `focus-visible:outline-ring`), used at `:234-251` and `:261-270`; `src/components/ui/` has no segmented, toggle-group or radio-group primitive (listing 2026-10-17); `forms/ChoiceCard.tsx` is a large form card, not a control.
- **User impact:** a sky-mode control written beside the sky would be a third hand-made copy of the theme/language segments, so its hover, pressed, focus and red-mode states could drift from the settings panel's; the owner already picked `aria-pressed` segmented controls at 44 px (`context/archive/2026-09-26-ui-foundation/plan.md:64,177`).
- **Fix:** `src/components/ui/segmented.tsx` (`SegmentedGroup`, island-safe, icon + label options, `aria-pressed`, horizontal or vertical) with its states on `/design`; `TopbarControls` imports it instead of its local classes; the sky-mode control uses it. `selected` / `selected-foreground` have no contrast row over the sky stops (`src/styles/contrast.test.ts:116-140`), so a row is added if the control sits on the sky. (Plan Phase 1.)

### C4 — Accidental architecture: a mouse cannot pan the panorama, and a drag over a marker acts on the link

- **Evidence:** `src/components/tonight/TonightSkyView.tsx:460-471` (a native `overflow-x-auto` region: touch and touchpad scroll, the mouse does not), `:94` and `:218-223` (chevrons pan 60 % per click); `:542-549` (markers are SVG `<a>` links, so a mouse drag that starts on one can start a link drag or fire its click); `src/i18n/messages/en.ts:866` (the region is named "Tonight's sky, swipe to look around"); deferred in `context/archive/2026-10-05-ui-sky-light/plan.md:39` and `plan-brief.md:41`.
- **User impact:** a desktop user with a plain mouse sees a sky they can only step through in 60 % jumps; dragging the sky, the obvious gesture, does nothing or drags a link ghost, and releasing over a marker navigates away by accident.
- **Fix:** pointer handlers for `pointerType` mouse (and pen) only: past a 6 px threshold the strip follows the pointer (`scrollLeft`), the next click is swallowed in the capture phase, `dragstart` is prevented on markers, `cursor: grab / grabbing`; touch stays native; the region's name drops "swipe" for "drag or swipe". (Plan Phase 3.)

### C5 — Accidental architecture: the sky's state has no server-rendered home, so any mode would flash or jump

- **Evidence:** the skeleton reserves fixed heights from constants only (`src/components/tonight/TonightSkeleton.astro:43` `TonightSky night verdict strip`, `:52` the slider row; `TonightSky.astro:68-80`); the island's props are `view`, `locale`, `children` (`TonightContent.astro:132-147`); `preferenceCookie` accepts only the theme and language names (`src/lib/preferences.ts:67-69`); stored copies freeze the server's HTML (`copies.ts:369-372`).
- **User impact:** a viewer who chose HIDDEN or EXPANDED would see the DEFAULT skeleton, then the band jump to their mode (the page under it jumping by 200-600 px), and an offline copy stored before a change would show the old mode.
- **Fix:** a `sidereus-sky` cookie resolved by the middleware into `locals.skyMode`; `<html data-sky-mode>` rendered by `Layout` only on the Tonight dashboard shell and corrected by the existing inline script; `@custom-variant sky-hidden` / `sky-expanded` keyed off the nearest `[data-sky-mode]` (so `/design` can scope specimens); the skeleton, the band and the verdict's dark line switch by variant, the island's state reads the attribute like `TopbarControls` does. (Plan Phases 1, 4.)

### Deferred (not in this change)

- **The VoiceOver pass over the live sky** (roadmap Open Roadmap Questions 3): unchanged by this change; the new control gets names and keyboard checks only.
- **The focused pages' quiet skies** (`TonightPageSky`, `TonightSky quiet`): not the audited view; no mode there.

## Detailed Findings

### Composition of /tonight

- `src/pages/tonight.astro:42` `<GearShell title skyFlow>`; `:45-47` `<TonightContent server:defer ...>` with `<TonightSkeleton slot="fallback" />`; `:49-56` the no-Supabase static sky.
- `TonightContent.astro:132-147` renders `<TonightSkyView view locale client:load>` with an `sr-only` `h1` and the `VerdictCard` (`withSlider`) as children; `:148-170` falls back to the static `TonightSky night verdict` with `withSlider={false}` when `skyView` is null; then `OfflineCopy` (`:172`), the notice, the gear row (`:190-209`), the tiles (`:212-216`).
- `VerdictCard.astro:81-91`: the dark-window line is `sr-only` beside the live slider and visible in the static fallback. In HIDDEN the slider (and its dark-window labels) goes away, so the line must become visible: `sr-only sky-hidden:not-sr-only`.
- `/design` renders `TonightSkyView` at `src/pages/design.astro:2187` and `:2251` from a real `buildTonight` at Warsaw (`:571-633`); the section `c-tonight-sky-view` (`:2241-2276`) ends with the N/A paragraph; the sky controls section `c-sky-controls` (`:2427-2492`) shows live / hover / focus-visible specimens with the `focusRing` constant (`:225`).

### Heights (sky-band.ts)

- Verdict container `pt-3 pb-10 sm:pt-12 sm:pb-14` (`:37`), min-height `min-h-42 sm:min-h-58` (168 / 232 px, `:52`); silhouette `h-8 sm:h-12` (`:57`); strip `h-52` 208 px (`:60-61`) with the `-mt-16` 64 px overlap (`:70-71`); slider row `h-19 sm:h-32` (76 / 128 px, `:79`). Phone band (DEFAULT) = 168 + 208 − 64 + 32 + 76 = 420 px.
- HIDDEN without strip and slider: 168 + 32 = 200 px on a phone (220 px less), 232 + 48 = 280 px from `sm`.
- EXPANDED on a 390×844 phone: 844 − 72 (Topbar strip) − 65 (TabBar) = 707 px of band; the field gets 707 − 168 − 32 − 76 + 64 = 495 px (1.8 times today's 272).

### Projection and the field

- Today, DEFAULT: degrees per px sideways = 180 / (viewport − 16); upwards = 90 / 272. Interactive-sky chose a 180° view on a strip twice the viewport (`context/archive/2026-10-05-interactive-sky/plan-brief.md:27`) and rejected "a dome or 360° squeeze view, and zoom" (`plan.md:76`). An EXPANDED field narrower than 180° is a change to that decision and goes to the owner (plan question Q4).
- With equal scales in EXPANDED (1° sideways = 1° upwards), a 390 px phone with a 495 px field shows (390 − 16) / (495 / 90) ≈ 68° per screen; a 1440×900 desktop at 80 % of the screen under the 88 px Topbar strip has a band of about 650 px and a field of about 650 − 232 − 48 − 128 + 64 = 306 px (arithmetic, to be measured in Phase 2), 3.4 px per degree, which would show over 400°; it is clamped at 180°, so a desktop keeps today's sideways scale and only gains height. The strip must stay at least twice the viewport so the wrap point never shows twice.

### Persistence

- Cookie names and rules: `src/lib/preferences.ts:11-15,29-31,67-69`; middleware `:13-17` (and `:41-44` adds `Vary: Cookie, Accept-Language` to HTML); `env.d.ts:1-10` `App.Locals`.
- The inline script (`Layout.astro:36-47`) is the only pre-paint hook; `define:vars` passes the whitelist and the cookie name.
- The service worker's next-night copy is fetched with `credentials: "same-origin"` (`src/sw.ts:183-198`), so it bakes in the cookie at fetch time; the inline script corrects it on display.

### Guards that constrain the change

- `src/components/island-imports.test.ts:29-38,70-89`: the sky island may import `react`, `@/lib/sky-view/*`, the star files, `@/lib/compass`, `@/lib/preferences` (already allowed), `sky-band`, `range-classes`, `@/i18n`, `@/lib/utils`, `@/components/ui/button` and `lucide-react`. A new `ui/segmented.tsx` import needs an allowlist entry.
- `src/styles/contrast.test.ts:174-198` reads `PAN_FACE_CLASS` as one string literal with `opacity-NN`: keep it a literal.
- `src/styles/rhythm-roles.test.ts`: `TonightSkeleton` (`{ "mt-1": 1, "mt-6": 1 }`) and `VerdictCard` (`{ "mt-1": 1, "mt-2.5": 1, "sm:mt-3.5": 1 }`) have exact allowances; `sky-band.ts` and `TonightSkyView.tsx` are not guarded.
- `src/styles/no-hardcoded-colors.test.ts:25-31` bans palette names, and `sky` is one: never name a class `bg-sky-…`/`text-sky-…`; the test's pattern is `<prop>-<palette>` with `<prop>` in a fixed list (`text|bg|border|ring|fill|stroke|from|via|to|decoration|placeholder|divide|outline|shadow`), so a variant `sky-hidden:` or a utility `sky-expanded-height` does not match (checked against `no-hardcoded-colors.test.ts:26-27`).
- `src/lib/e2e-clock-guard.test.ts`: every new spec imports `test` from `tests/e2e/helpers.ts`, no `waitForTimeout`, no date skips.

### E2E

- `tests/e2e/tonight-sky.spec.ts`: `openSky` (`:27-35`, `onboardInMadrid`, `waitForHydration`), `markers()` (`:47-69`), marker clicks (`:276-302`); `clock: "evening"` (`:20`).
- `tests/e2e/helpers.ts`: `test` with the clock fixture (`:67-82`), `onboardInMadrid` (`:186-195`), `waitForHydration` (`:108`); cookies are set with `context.addCookies([{ name, value, url }])` (`offline.spec.ts:52-55`).
- `playwright.config.ts`: one Desktop Chrome project, `BASE_URL`, `timezoneId: "Europe/Madrid"`, no `webServer`.

## Code References

- `src/components/tonight/TonightSkyView.tsx:228-245` — viewport measure and the initial centring
- `src/components/tonight/TonightSkyView.tsx:281-287` — strip width and field height
- `src/components/tonight/TonightSkyView.tsx:446-624` — the band markup (verdict slot, strip, chevrons, silhouette)
- `src/components/tonight/TonightSkyView.tsx:626-709` — the slider row
- `src/lib/sky-view/projection.ts:20-27` — `project()`
- `src/components/tonight/sky-band.ts:37-95` — shared heights
- `src/components/tonight/TonightSkeleton.astro:43-61` — skeleton band and slider row
- `src/components/tonight/VerdictCard.astro:81-91` — the dark-window line
- `src/lib/preferences.ts:11-69`, `src/middleware.ts:13-17`, `src/layouts/Layout.astro:21,36-47`, `src/components/TopbarControls.tsx:36-43,133-157` — the theme pattern
- `src/styles/global.css:8-21` (variants), `:498-526` (`@utility` precedent)
- `tests/e2e/tonight-phone.spec.ts:75-129` — the first-screen pin
- `tests/e2e/tonight-sky.spec.ts:20-302` — the live-sky spec

## Architecture Insights

- The sky's mode is a **viewer preference** like the theme (device-level, cookie, pre-paint), not page state: a URL param would split the offline copies (`storedPageOf`, `copies.ts:160-178`) and leak into links.
- Keep **CSS deciding the size and the island measuring it**: the island already measures the width before paint (`useLayoutEffect`); measuring the height too makes the projection follow whatever the CSS mode gives, so the skeleton (pure CSS) and the island cannot disagree.
- The verdict stays server-rendered children in every mode; only CSS variants change what shows around it.

## Historical Context (from prior changes)

- `context/archive/2026-10-05-interactive-sky/plan-brief.md:27`, `plan.md:49,76,257` — 180° panorama on a 2× strip; no dome, zoom or pinch (supported, still in code).
- `context/archive/2026-10-07-ui-mobile-pass/plan.md:51` — "it's sensitive to changes": strip and overlap frozen (partially superseded: the overlap moved to `-mt-16` in ui-user-adjustments).
- `context/archive/2026-10-08-ui-user-adjustments/change.md` — `-mt-16`, bare chevrons; the 390×844 pin relaxed to verdict + Site card + Telescope title (supported, `tonight-phone.spec.ts:82-129`).
- `context/archive/2026-10-05-ui-sky-light/plan.md:39`, `plan-brief.md:25,41` — chevrons chosen, drag-to-pan deferred (supported).
- `context/archive/2026-10-15-ui-dashboard-tiles/research.md:40` — 33 px slack at 390×844 (supported by the spec's comment; not re-measured here).
- `context/archive/2026-09-29-nav-motion-theme-cycle/plan.md:7,52` — a single toggle was "unclear", replaced by a cycle button; the settings panel kept a segmented control.
- `context/foundation/roadmap.md` Parked: "A sky atlas or planetarium view" (PRD Non-Goal) — EXPANDED must stay the same horizon panorama, larger, not an atlas.

## Related Research

- `context/archive/2026-10-05-interactive-sky/`, `context/archive/2026-10-05-ui-sky-light/research.md`, `context/archive/2026-10-07-ui-mobile-pass/research.md`, `context/archive/2026-10-15-ui-dashboard-tiles/research.md`.

## Open Questions

Owner decisions (UI), carried into `plan.md` § QUESTIONS FOR OWNER with mockups under `evidence/`: where the mode control sits; what HIDDEN shows; the desktop EXPANDED height; the EXPANDED field of view; what stays on a phone in EXPANDED. Technical facts left for implementation: the 33 px slack and the desktop EXPANDED field height are arithmetic, to be re-measured in Phases 2 and 4.
