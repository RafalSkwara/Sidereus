<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Tonight's live sky — drag to pan and Hidden / Default / Expanded modes

- **Plan**: `context/changes/ui-sky-modes/plan.md`
- **Scope**: Full plan (phases 1-5; every Automated row is `[x]`, every Manual row is still `[ ]`)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-17
- **Branch**: `feat/ui-sky-modes` at `f6b8c97` (PR #212), diff base `origin/main` (`e563fda`)
- **Reviewer**: herdr agent "reviewer" (Opus, high), with one Opus subagent (plan drift, patterns, `/design`, CLAUDE.md, test diet). The lead reviewer read the geometry, the island, the control and the specs directly and ran every check below.
- **Verdict**: APPROVED (two LOW-impact warnings; F1 is a one-class fix worth doing before merge)
- **Findings**: 0 critical, 2 warnings, 5 observations
- **change.md**: not touched. In reviewer mode this file is the only write, so the orchestrator stamps `impl_reviewed`.

## Independent checks run for this review

- **Automated rows, re-run in the worktree:** `npx astro sync && npx astro check` 0 errors, 0 warnings; `npm run lint` clean; `npx vitest run` 122 files, 813 passed, 1 skipped.
- **E2E, re-run against a fresh `npm run build` + `npm run preview -- --port 4335`, the forecast fixture on 4405, local Supabase, keys inline:** `tonight-sky-modes.spec.ts` (3), `tonight-sky.spec.ts` (incl. the new drag test) and `tonight-phone.spec.ts` (the DEFAULT first-screen pin, the 320/375 px sideways checks): **13 passed**. Note: the worktree's env files point the fixture elsewhere, so `dist/server/.dev.vars`' `FORECAST_BASE_URL` was set to `http://127.0.0.1:4405` for this run (gitignored build output; the next `npm run build` rewrites it). Both servers were stopped by port afterwards.
- **CI on the PR head:** `ci` pass, `smoke` pass (6 m 12 s, includes the whole e2e suite).
- **Positions are astronomically correct in every mode (checked by reasoning and at runtime):**
  - `project()` changed from `width + offset/180 × width` (width = half the strip) to `stripWidth/2 + offset/360 × stripWidth`: algebraically identical for today's callers, and `skyField` returns `stripWidthPx = 2 × (viewport − 16)` and the measured height for DEFAULT and HIDDEN, so DEFAULT's numbers are unchanged by construction (box 390 × 272 → strip 748 px, chevron top `(272 + 64) / 2` = 168 = the old `64 + 208/2`).
  - EXPANDED: `viewSpanDeg = clamp((inner × 90) / H, 60, 180)`, `stripWidth = inner × 360 / span`, so px/deg sideways = `inner / span` = `H / 90` = px/deg upwards whenever unclamped; the strip always spans 360° and altitude 0–90° always spans the measured field (the overlap behind the verdict included, as in DEFAULT). The invariant test pins this over 3 modes × 5 boxes × 2 facings with a non-vacuity count.
  - Runtime: at 390 × 844 EXPANDED the compass row shows SSE · S · SSW (about 68° per view, Q4 B); at 1440 × 900 it is clamped to 180° (E … W) on a taller field. The modes spec checks every marker's `cy` against the altitude in its accessible name on the taller field and that the SVG's `height` attribute equals its rendered height (no CSS scaling).
  - Azimuth kept across a mode change: pan DEFAULT right, switch to EXPANDED, the compass row's middle point stays `W` (probe). Leaving HIDDEN recentres (the field measured 0 while `display: none`, `wasHidden`).
- **Drag vs click/touch/keyboard:** mouse only (`pointerType === "mouse"`, primary button), capture only after 6 px, click swallowed in the capture phase, `dragstart` prevented, `pointer-fine:select-none`; touch and pen untouched; arrow keys and chevrons unchanged (the drag test also presses ArrowLeft).
- **Mode menu a11y (probe at 390 px):** Enter on the trigger opens the popover with focus kept on the trigger; Tab enters the menu (`hidden`, then `default` `aria-pressed=true`, then `expanded`); Esc from inside closes it and returns focus to the trigger; Enter on an option applies it, closes the menu and leaves focus on the trigger, whose name becomes "Sky view: Expanded"; an outside click closes it. No console errors or hydration warnings on a reload in EXPANDED.
- **Cookie, before-paint script, skeleton:** `sidereus-sky` is validated by `isSkyMode` in the middleware, in the head script (`skyModes.includes`) and in the island's observer; the head script only touches `data-sky-mode` when the page rendered the attribute (the dashboard), so focused pages, the landing and `/design` gain no scope. The skeleton and the live frame bottoms meet within 1 px for all three modes at 390 and 1280 px (spec, re-run green).
- **Themes, EN+PL, tokens:** reviewer screenshots of `/tonight` in all three modes plus the open menu at 390 × 844 and 1440 × 900 in dark, light and red (scratchpad, not committed) match the committed `evidence/impl/` set (30 files: sky modes, control, menu, SegmentedGroup, skeleton × 2 widths × 3 themes). The light-theme menu inside the navy `.night-sky` gets light tokens; the pressed option is filled in every theme, so red tells it apart by shape. The subagent's scan of the nine touched view files found no arbitrary values, hex, `rgb()` or px literals in class strings; `--selected`, the surface inks and `PAN_FACE_CLASS` stay pinned by `contrast.test.ts`. PL strings agree in gender with "Widok nieba".
- **Test diet:** one looping invariant unit test, one drag e2e, three modes e2e, as planned (the persistence test adds a 1280 px pass); no `waitForTimeout`, `test` from `./helpers`, the case named in each failure.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (F1, F2) |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING (F4, F5; observations only) |
| Success Criteria | WARNING (F3, F6, F7; observations only) |

## Findings

### F1 — The static fallback band in EXPANDED leaves the horizon floating mid-band

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/components/tonight/TonightContent.astro:159-160`, `src/components/tonight/TonightSky.astro:73-85`, `src/components/tonight/sky-band.ts` (`SILHOUETTE_CLASS`)
- **Detail**: After a sky-view failure (a view without `skyView`) the static band sits in `SKY_FRAME_CLASS`, whose EXPANDED `min-height` is the screen, and `SKY_BAND_CLASS` makes the band `flex-1 flex-col`. `TonightSky` is rendered there without `strip`, so its column holds only the verdict container and the silhouette, both `shrink-0`: the free space ends up under the silhouette, so the ground-coloured horizon sits right under the verdict with a stretch of gradient sky below it. Plan Phase 4 §3 / F4 d says the static band's "strip box uses the same mode variants" so it fills the reserved height; it fills the height but has no box to grow. No `/design` specimen draws the fallback per mode (the error row is an N/A line), so the screenshot gate could not catch it. Error path only; DEFAULT and HIDDEN are unaffected.
- **Fix**: Add `sky-expanded:mt-auto` to `SILHOUETTE_CLASS` (harmless in the island, where the strip box already takes the spare height), so the horizon sits at the frame's foot; optionally add the fallback per mode to `/design`'s error row.
- **Decision**: PENDING

### F2 — Small plan drifts are implemented but recorded nowhere in the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/changes/ui-sky-modes/plan.md` (Phase 1 §4, Phase 4 §1-2, Critical Implementation Details)
- **Detail**: All benign, but the plan is the source of truth for the archive and the next agent:
  - `tonight.astro`'s no-Supabase band (and the title-only setup band in `TonightContent`) does not follow the mode; the plan's F4 d says it does, and only CLAUDE.md records "a title-only setup band does not".
  - The island's mode is `useState` + a `MutationObserver` in a layout effect, not the planned `useSyncExternalStore` (same outcome before paint; no hydration warnings observed).
  - The option hook is `data-segment="<mode>"` (from `SegmentedGroup`), not `data-sky-mode-option`.
  - `SegmentedGroup` adds `disabled:not-aria-pressed:text-faint`, so the settings panel's other language now fades while the reload runs (plan: "unchanged for horizontal"); semantics are otherwise identical (aria-pressed, aria-label with the short label hidden, `lang`, `aria-busy`, the focus string).
  - The trigger is `-top-1 right-1 sm:top-8`, not "top 0 below `sm`, on the date line from `sm`" (its centre sits 4 px above the date line's at both widths; the 320 px PL no-overlap test passes).
- **Fix**: One addendum under "Plan review triage" / "Owner answers" listing these five as accepted implementation decisions (or revert the `text-faint` change if the settings panel should stay byte-identical).
- **Decision**: PENDING

### F3 — Two e2e assertions do not discriminate the mechanism they are named for

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/e2e/tonight-sky-modes.spec.ts:87`, `tests/e2e/tonight-sky.spec.ts:361-398`
- **Detail**:
  - "server-rendered on the next load": the head script rewrites `<html data-sky-mode>` from the cookie before paint whenever the attribute exists, so the assertion stays green if the middleware ignored the cookie. The user-visible outcome (no jump) is still protected, which is why this is not a warning.
  - The drag test's "never opens a marker": once `setPointerCapture` runs on the scroller, Chromium sends the ending `click` to the scroller, not the `<a>`, so deleting the click swallow (`onClickCapture`) leaves the test green; it fails only if both the capture and the swallow go. The swallow is WebKit defence that no test exercises.
- **Fix**: In the persistence test, assert the raw response too (`const response = await page.reload(...)`; `expect(await response.text()).toContain(\`data-sky-mode="${mode}"\`)`); in the drag test, say in its comment that it protects the outcome on Chromium, not each mechanism (or record un-prevented clicks on an `a` in a document capture listener).
- **Decision**: PENDING

### F4 — The menu panel has no theme or position before hydration, and detaches from the trigger on scroll

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/tonight/sky-mode-control.tsx:62-77,96-104`; `src/pages/design.astro` § Sky view control ("default · live")
- **Detail**: The native popover opens before the island hydrates, but `data-theme` and `top`/`right` are only set in the `beforetoggle` effect: a tap in that window opens a panel at the viewport's origin with the navy sky's tokens in the light theme. `TopbarControls` avoids this by SSR-ing `data-theme={theme}`. The panel is `position: fixed` from one measurement, so it stays put while the page scrolls (probe: after a 300 px wheel scroll the menu stays at y 116 while the trigger is at y −232, still open). The `/design` "default · live (opens the menu)" trigger has no client directive, so it shows exactly this unthemed, unplaced panel; the open-menu screenshots come from the hydrated specimens.
- **Fix**: Pass `theme` to the island (`Astro.locals.theme`) and render `data-theme` on the panel server-side; close the popover on `scroll` (or re-place it on `scroll`/`resize`); call the `/design` trigger "static" or hydrate it.
- **Decision**: PENDING

### F5 — A scope-less `TonightSkyView` renders a working control that desyncs from the band

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/tonight/TonightSkyView.tsx:288-298,560-566`; the older `/design` § TonightSkyView specimens
- **Detail**: Without a `[data-sky-mode]` ancestor, `chooseMode` sets no attribute (CSS stays DEFAULT) but still calls `setMode`, so the trigger reads "Expanded" and `skyField` redraws expanded square degrees into DEFAULT's 272 px box (positions still consistent with the box, but not the mode the trigger names). Dev-only today, since the dashboard always has the scope.
- **Fix**: Render the control (or make `chooseMode` act) only when a scope exists.
- **Decision**: PENDING

### F6 — HIDDEN's skeleton, like DEFAULT's, holds only for the go verdict

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `src/components/tonight/sky-band.ts` (`VERDICT_MIN_HEIGHT_CLASS`), `tests/e2e/tonight-sky-modes.spec.ts:61-101`
- **Detail**: Measured by accident (a first run whose preview could not reach the fixture, so the verdict read "No forecast"): in HIDDEN at 390 px the live band ended 24.86 px below the skeleton's, every run, because the longer verdict outgrows `sky-hidden:min-h-47`. This is the same accepted limit as DEFAULT (CLAUDE.md: the min-heights are measured on the EN go verdict; no-go and no-forecast nights are a known limit), and EXPANDED absorbs it in its flexible field. With the fixture reachable the spec is green.
- **Fix**: None needed; optionally say in CLAUDE.md's Sky modes line that HIDDEN shares DEFAULT's known limit.
- **Decision**: PENDING

### F7 — Every Manual row is still open

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `plan.md` Progress 1.5, 1.6, 2.4, 3.3, 3.4, 4.5, 4.6, 5.3, 5.4
- **Detail**: None is rubber-stamped (all `[ ]`). This review covers part of them: 1.6 and 5.3 (the committed screenshots show every row of the 7-state table or its N/A line in three themes at 1440 and 390 px), 2.4 (DEFAULT equal by construction, plus `tonight-phone` and `tonight-sky` green unchanged), 4.5's menu behaviour (Esc, outside tap, focus return) and 5.4 (the subagent matched every CLAUDE.md path and name to the code; F1 is the one overstated claim). Still for the owner, on real devices: 3.3/3.4 (mouse drag feel; phone swipe and tap), 4.5's real-phone EXPANDED scroll with the address bar hiding (`svh`, no recentring) and 4.6 (switch the mode on a stored page, reload offline: the head-script path was read, not run). 1.5 (settings panel unchanged) is covered except F2's `text-faint` change.
- **Fix**: The owner runs 3.3, 3.4, 4.5 (real phone) and 4.6; the orchestrator ticks the rows this review covered if it accepts the evidence above.
- **Decision**: PENDING
