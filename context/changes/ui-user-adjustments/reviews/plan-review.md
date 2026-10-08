<!-- PLAN-REVIEW-REPORT -->

# Plan Review: The user's UI adjustments (M-3 S-02)

- **Plan**: context/changes/ui-user-adjustments/plan.md
- **Date**: 2026-10-08
- **Phases**: 6 (Phase 1 next)
- **Findings**: 0 critical, 10 warnings, 0 observations (related items consolidated)
- **Overall**: NEEDS ATTENTION

## Verdicts

| Dimension        | Verdict              |
| ---------------- | -------------------- |
| Claim Accuracy   | WARNING (F2, F8, F9) |
| Substance        | WARNING (F3, F6, F8) |
| Feasibility      | WARNING (F4)         |
| Sequencing       | WARNING (F7)         |
| Architecture Fit | WARNING (F5)         |
| Scope Discipline | PASS                 |
| Verifiability    | WARNING (F1)         |
| Coverage         | WARNING (F10)        |

Verification commands tested (2026-10-08):

- Commands that ran clean:
  - `npx astro sync && npx astro check` (0 errors)
  - `npm test` (882 passed)
  - `npx eslint . --ignore-pattern '.claude/**'` (0 errors)
- `npx playwright test --list …` resolved every named spec except `toasts`, which Phase 2 creates.

## Findings

### F1 — E2E commands would hit the wrong server

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Verifiability
- **Location**: every `npx playwright test` line
- **Detail**:
  - `playwright.config.ts:12` defaults `baseURL` to `http://localhost:4321`. The plan's preview runs on 4331, and the main checkout may serve its own branch on 4321, so a green run could test the wrong code.
  - `sky-checks` needs `SUPABASE_URL` and `SUPABASE_KEY` (`tests/e2e/helpers.ts:114`).
  - The fixture's default port is 4400.
- **Fix**: Add a "Local e2e run" recipe that every phase references: fixture `FIXTURE_PORT=4410`, `npm run build`, patch `dist/server/.dev.vars`, `npm run preview -- --port 4331`, then `BASE_URL=http://localhost:4331 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test …`.
- **Decision**: FIXED (applied to plan.md, 2026-10-08)

### F2 — Phase 1 tokens: contrast rows can't test a tinted fill, and the offline dashed border misses `<a>`

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Claim Accuracy
- **Location**: Phase 1 §1
- **Detail**:
  - `contrast.test.ts:24-33` reads plain hex only. A `color-mix` fill (as `--accent` and `--go-surface` are) can't get the promised CHECKS row, so 1.2 would pass without testing anything.
  - BackLink sits on the sky header (zenith/horizon) and the light `.night-sky` scope, not on `background`.
  - New tokens also need `--color-*` entries in the `@theme inline` block.
  - The offline dashed border (`global.css:479-484`) targets buttons only, so an `action` `<a data-needs-network>` (Mark observed, Manage) would keep a solid link-coloured border offline.
- **Fix**: Opaque hex `--action-surface` and `--action-border` in dark, light, red (zero G/B) and light `.night-sky`, plus `--color-*` mappings. CHECKS rows:
  - `primary-strong` on `action-surface` ≥ 4.5 in every theme;
  - the border on background, surface, zenith and horizon ≥ 3.

  Extend the offline dashed-border selector to `a`. Strength: makes 1.2 meaningful in every theme. Tradeoff: four more token values. Confidence: HIGH (read the test parser). Blind spot: none significant.

- **Decision**: FIXED (applied to plan.md, 2026-10-08)

### F3 — Phase 1 clickable inventory is incomplete and partly wrong

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Substance / Coverage
- **Location**: Phase 1 §2, Desired End State, criterion 1.4
- **Detail**:
  - The end state promises "the tiles' cue", but no phase changes `Tile.astro`.
  - Not covered:
    - `confirm-email.astro:23` (a standalone link);
    - the ghost sky-check answers (`SkyAnswerForm.astro:29-34`);
    - the Targets `<summary>` rows (`ObjectRow.astro:26`);
    - the gear and log row links (`gear/index.astro:95`, `log/index.astro:63`);
    - the `/log` "Sky checks" ghost link (`log/index.astro:71`).
  - Two listed items have nothing to change:
    - EyepiecesPrompt's only link is inline;
    - TonightContent's gear link is deleted in Phase 4.
  - SkyCheckCard's Skip and All as `action` would outrank the real answers (one outline, two ghost).
  - `buttonVariants` is `whitespace-nowrap`, which would break the long PL washed-out link (`pl.ts:618`).
  - 1.4 omits `tonight-phone` (sideways scroll EN/PL) and `tonight-dashboard` (`:62` clicks the back link).
- **Fix**: Add an inventory table to Phase 1, one line per clickable:
  - `action`: Mark observed, washed-out link (keeps `whitespace-normal`, no `-ml-3`), BackLink, Pager, confirm-email link, Tile cue (icon chip with border and fill).
  - Underlined `link`: inline links, Skip and All.
  - Resting border on the ghost sky-check answers and the `/log` Sky checks link.
  - Row affordance (chevron plus hover, unchanged): Targets summary rows, gear and log row links.
  - Drop EyepiecesPrompt and TonightContent from Phase 1.

  Add `tonight-phone` and `tonight-dashboard` to 1.4. Strength: makes "anything clickable" checkable. Tradeoff: about six more files in Phase 1. Confidence: HIGH (call-site grep). Blind spot: the Skip/All treatment is a visual call (kept quieter than the answers on purpose).

- **Decision**: FIXED (applied to plan.md, 2026-10-08)

### F4 — Phase 2's page-state unit test can't run as written

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Feasibility
- **Location**: Phase 2 §4
- **Detail**: `applyNotices` is private and DOM-bound (`page-state.ts:53`). Vitest runs `environment: "node"` with no DOM (`vitest.config.ts`).
- **Fix**: Extract a pure helper (for example `noticeHidden({ kind, wanted, dismissed })`, or extend `noticeFor`), unit-test it, and leave the DOM behaviour to `toasts.spec`.
- **Decision**: FIXED (applied to plan.md, 2026-10-08)

### F5 — Toast mechanics: inline flash, /design specimens adopted, floating offset

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Architecture Fit
- **Location**: Phase 2 §1-2, §5
- **Detail**:
  - Layout's script is a deferred module, so on `/gear` and `/log` a toast first paints inline and then jumps into the fixed region (a layout shift on every save).
  - The global script would also adopt the `/design` toast specimens: it would move them, close them after 10 s and call `replaceState`.
  - The Topbar isn't sticky, so "under the top navigation" is a fixed offset that floats mid-page after scrolling.
- **Fix**: `[data-toast]` is `position: fixed` (the `toast-region` utility) from first paint, and the script only stacks, times, closes and cleans the URL. Notice gets a `specimen` mode (toast look, no `data-toast`) for `/design`. State that the desktop offset is fixed at the nav's bottom edge (intended). Strength: no shift, no surprises on `/design`. Tradeoff: two toasts that arrive together need stacking from CSS (a flex column region), not from the script alone. Confidence: MED (deferred-module timing reasoned, not measured). Blind spot: island-delivered toasts arrive later anyway.
- **Decision**: FIXED (applied to plan.md, 2026-10-08)

### F6 — Phase 3 slider labels, zone format, fallback and criteria are underspecified

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Substance / Verifiability
- **Location**: Phase 3 §1-2, criteria 3.7 and 3.9
- **Detail**:
  - On phones the track is the middle of a row (time, track, Now), so "times under its edges" has no defined place.
  - Sunset→dark is often about 10% of the track, so the dark-start label collides with the sunset label, not just with dark-end.
  - The zone label's format is undecided. A raw IANA id next to the time at 320 px squeezes the track, and `card.timesIn` is being deleted.
  - When the sky view fails, the static fallback VerdictCard would show neither the dark window nor the zone.
  - 3.7 can't hold geometrically: the verdict's `pb-10` (40 px) still sits 24 px into a 64 px overlap.
  - 3.9 compares against "the dashboard's dark window", which Phase 3 removes.
  - Naming: the type is `TonightSkyView` in `src/lib/sky-view/view.ts:30` (`SkyViewData` is an alias). `TonightContent.astro:142,158` must be listed for the dropped `timeZone`.
- **Fix**:
  - **Slider labels.** A dedicated label row aligned to the track's box. One collision rule over all four labels (sunset, dark start, dark end, sunrise) that drops or merges into a centred "Dark 21:40–05:10". The slider-row height constants are re-measured.
  - **Zone.** The server formats a short zone name (for example "CEST", or "GMT+2" when there is no abbreviation). It renders muted after the time, as a new key.
  - **Fallback.** VerdictCard keeps the dark and zone line when there is no live sky (a `withSlider` prop).
  - **Criteria.** Reword 3.7 as "overlap is 64 px and no label enters it". Compare 3.9 with `TonightView.darkWindow` (build.test) and `/tonight/plan`'s dark line.
  - **Naming.** Fix the type name and list TonightContent.

  Strength: implementable without re-deciding. Tradeoff: the short zone abbreviation is less explicit than the IANA name. Confidence: MED (label widths not measured). Blind spot: the PL labels' widths.

- **Decision**: FIXED (applied to plan.md, 2026-10-08)

### F7 — Landing PNG recaptured before the layout settles

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Sequencing
- **Location**: Phase 3 §4
- **Detail**: The 1280×1145 clip ends on the first tile's rule. Phases 4 and 5 change that height, and the size lives in both the spec and `Welcome.astro`.
- **Fix**: Move the recapture and the clip re-measure to Phase 6.
- **Decision**: FIXED (applied to plan.md, 2026-10-08)

### F8 — Gear cards: skeleton jump, duplicate labels, ambiguous Manage links, offline select

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Substance / Claim Accuracy
- **Location**: Phase 4 §2-3
- **Detail**:
  - A select card and a name + Manage card differ in height, and the skeleton can't know which will arrive, so every user now sees a jump.
  - GearSelectField's visible `Label` repeats the card title.
  - With one site and one telescope there are two links named "Manage".
  - The select form has no `data-needs-network` today, and `applyControls` disables only `a[href], button` (`page-state.ts:21`).
  - `load.ts:172-173` is an unlisted `selectorKind` consumer (it still works).
- **Fix**:
  - **Height.** A shared `GEAR_CARD_MIN_HEIGHT_CLASS` in `sky-band.ts`, used by GearCard and the skeleton.
  - **Labels.** The card title is the select's `<label>`; no second visible label.
  - **Manage links.** Named per card ("Manage sites" / "Manage telescopes").
  - **Offline.** `data-needs-network` on the form, and `applyControls` extended to `select`.
  - **Consumers.** List `load.ts`.

  Strength: no jump, clean a11y. Tradeoff: one small page-state change. Confidence: HIGH. Blind spot: none significant.

- **Decision**: FIXED (applied to plan.md, 2026-10-08)

### F9 — Phase 6 error contract has no precedent; wording mislabels the window

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Claim Accuracy / Substance
- **Location**: Phase 6 §1-2, criterion 6.2
- **Detail**:
  - "Reported the way build.ts's other failures are" points at six bare `catch { x = null }` blocks (`build.ts:777,826,876,923,1006,1135`).
  - `no-console` is an error under `src/lib/tonight/**`.
  - Tracks computed inside the plan's `try` would drop the whole plan, not "leave rows without a curve".
  - "up 21:40–23:10" is the best window (above the minimum altitude, in the dark), but the curve shows the object above the horizon for longer, so the label contradicts the drawing.
  - The row example shows "54° SW", but `bestDirection` is "SW, 45°".
  - The "layout helper" in 6.2 names no module.
- **Fix**:
  - **Tracks.** Compute them inside the existing plan `try`: no new catch, and a failure means no plan, as today. Drop the "rows without a curve" path.
  - **Wording.** "Best 22:40 · window 21:40–23:10 · SW, 45°", with the legend "window: above your minimum altitude while dark".
  - **Module.** Name `src/lib/tonight/altitude-curve.ts` (pure path and scale) with its test.

  Strength: follows the existing failure path and explains the window honestly. Tradeoff: one bad track hides the whole plan (as today). Confidence: HIGH. Blind spot: none significant.

- **Decision**: FIXED (applied to plan.md, 2026-10-08)

### F10 — Coverage gaps against the user's list

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Coverage
- **Location**: Phases 5-6 versus change.md
- **Detail**:
  - The /tonight/plan item "not enough breathing room between listed objects" has no row-spacing change or criterion in Phase 6.
  - /tonight/targets "data points own lines": `TargetDetails.astro:32` keeps `sm:grid-cols-2`, so from `sm` Window and Best still sit side by side.
  - MoonCard's " · Detail with" join (`MoonCard.astro:79-85`) isn't in Phase 5's files.
  - 3.8 names Safari and Firefox, but only Chromium is configured.
- **Fix**:
  - Add row padding plus a manual row to Phase 6.
  - Drop `sm:grid-cols-2` in TargetDetails.
  - Add MoonCard to Phase 5.
  - Mark Safari and Firefox in 3.8 as the joint check.
- **Decision**: FIXED (applied to plan.md, 2026-10-08)

## Triage summary

- Fixed: F1-F10 (the user chose "apply all recommended fixes").
- Skipped, accepted or recorded as lessons: none.
