<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: The user's UI adjustments (M-3 S-02)

- **Plan**: context/changes/ui-user-adjustments/plan.md
- **Scope**: Phases 2-4 of 6
- **Reviewed phases**: 2, 3, 4
- **Date**: 2026-10-08
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 5 observations

Commits reviewed: `354bee6` (p2), `242ecbb` (p3), `4648b3d` (p4), plus the user-requested follow-ups `a93f4bc` and `e64e58c`, range `8189e4c..e64e58c`. The user's later decisions in `handoff.md` (phone gear-card layout, the relaxed 390×844 fold, the landing PNG deferred to Phase 6) count as the plan.

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Success criteria, re-run on `e64e58c`:

- `astro check`: 0 errors.
- `npm test`: 1171 passed.
- eslint: 0 errors, 3 known warnings.
- Full e2e suite: 44 passed, 3 expected skips. It includes `toasts`, the 12 notice specs, `tonight-sky`, `tonight-dashboard`, `tonight-phone`, `onboarding`, `offline`, `telescope-selector` and `seven-night-planner`.
- `grep "verdict.word\|text-verdict-"`: no matches.

The manual rows are backed by the agent's screenshots: dark, light and red; 320 to 1280 px; EN and PL.

Scope extras are benign: Escape-to-close on toasts, `first-letter:uppercase` on the reason, the removed `tonight.sky.darkWindow`, and the new `card.darkLine`, `zoneLabel`, `data-sky-zone` and `data-sky-dark-merged`.

## Findings

### F1 — The dark window is no longer accessible on the dashboard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (accessibility)
- **Location**: src/components/tonight/VerdictCard.astro:74, src/components/tonight/TonightSkyView.tsx:673
- **Detail**: Before Phase 3, VerdictCard always read "Dark from HH:mm to HH:mm". With `withSlider` it now drops that line. The only place the times appear is the slider's edge labels, inside `aria-hidden` (`data-sky-labels`). The range's `aria-valuetext` gives only the current time. Screen-reader users lose a core answer on `/tonight`.
- **Fix**: In VerdictCard, render `t.darkLine(...)` as an `sr-only` line when `withSlider` is set. It is the same text the static fallback already shows.
- **Decision**: FIXED in `1b0e882`

### F2 — Closing a toast or a dismissible notice drops keyboard focus to `<body>`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (accessibility)
- **Location**: src/lib/toasts.ts:40-55 (`close`), :136 (`scope.hidden = true`)
- **Detail**: Enter or Escape on a focused × removes or hides the focused element. Focus falls back to `<body>`, so the next Tab starts again at the top (WCAG 2.4.3). `toasts.spec.ts` presses the × but never checks where focus lands.
- **Fix**: Before removing or hiding, if the toast or scope holds `document.activeElement`, move focus to `<main>` with `tabindex="-1"`. Add an e2e assertion that focus is not on `body` after the ×.
- **Decision**: FIXED in `1b0e882`

### F3 — The gear select misbehaves offline and blocks switching to another site's stored copy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (reliability / offline)
- **Location**: src/components/tonight/GearCard.astro:54,82, src/lib/offline/page-state.ts:22
- **Detail**: Offline, the `aria-disabled` select can still change. `requestSubmit()` is then swallowed, so the select shows site B while the page is for A. Stored copies are keyed per site (`?site=`). The old pills and dropdown were unmarked GET links, so offline you could switch to another site's stored copy from the dashboard. The plan (line 447) disabled the select, which blocks that path; it is still reachable from `/offline`. Disabling the telescope select is right, because copies ignore `?telescope=`.
- **Fix A ⭐ Recommended**: Leave the **site** select un-marked, so it navigates to the stored copy as before. Keep the telescope select marked, and in its change handler, when `<html data-offline>` is set, restore the select's default value.
  - Strength: Restores an offline path that worked before S-02 and keeps the telescope case correct. It matches how copies are keyed (`tonightPageOf` reads `?site=`).
  - Tradeoff: The two cards behave differently offline. A site with no stored copy lands on `/offline`, as any uncached navigation does.
  - Confidence: MED — the worker's network-first fallback serves stored pairs. Not yet e2e-tested from the select.
  - Blind spot: The handoff/plan said "the select is disabled offline". This reverses it for sites.
- **Fix B**: Keep both selects disabled offline and only restore the default value on change.
  - Strength: The smallest change, and it follows the plan as written.
  - Tradeoff: The dashboard regression for offline site switching stays.
  - Confidence: HIGH — a one-line handler change.
  - Blind spot: How often users switch sites offline.
- **Decision**: FIXED in `1b0e882` via Fix A

### F4 — The gear card's min height leaves out the border, so the skeleton swap jumps

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/sky-band.ts:27
- **Detail**: `min-h-33 sm:min-h-36` is 132 / 144 px. The real cards measure 134 / 146 px: the content plus the 1 px top and bottom border. The skeleton bars have no border, so each stacked card jumps 2 px on swap. In PL, "Zarządzaj …" wraps at 320 and 640 px, which adds about 14 px more.
- **Fix**: Change to `min-h-34 sm:min-h-37`, so the reserved height covers the border. Fix the comment's sum, and note that the PL wrap still grows the card.
- **Decision**: FIXED in `1b0e882`

### F5 — Fixed waits before "stays hidden" assertions can pass without testing anything

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria (test quality)
- **Location**: tests/e2e/toasts.spec.ts:174, tests/e2e/offline.spec.ts:144
- **Detail**: Both specs use `waitForTimeout(500)`, then assert that the closed notice is still hidden. `applyNotices` runs on the next animation frame. If that frame hasn't run, the assertion passes whether or not `noticeHidden` works.
- **Fix**: Replace the wait with two `requestAnimationFrame` ticks via `page.evaluate`, after the DOM change.
- **Decision**: FIXED in `1b0e882`

### F6 — The time-zone label is read at local noon, so it is wrong after a DST change

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/tonight/build.ts:655
- **Detail**: `zoneLabel` is formatted at the observing night's start. On a changeover night (Europe, 25 Oct 2026) the slider says "CEST" next to times after 03:00 that are CET.
- **Fix**: Have the server send a zone label per frame, next to `timeLabels`. The island then shows the frame's label beside `[data-sky-time]`, so the zone always matches the time shown.
  - Strength: Correct on every night, and the browser still formats nothing.
  - Tradeoff: A small payload and interface change (`zoneLabels: string[]`), plus a unit test on a DST night.
  - Confidence: HIGH — `timeLabels` already follows this pattern.
  - Blind spot: The static fallback line (`card.darkLine`) still uses one zone for the window; fine unless the window spans the change.
- **Decision**: FIXED in `1b0e882`

### F7 — The merged dark-range label is built in the island, not the catalogue

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightSkyView.tsx:434
- **Detail**: `` `${dark.startLabel}–${dark.endLabel}` `` is a user-visible format built in the browser. CLAUDE.md wants such copy in `src/i18n`.
- **Fix**: Add `tonight.sky.darkRange({ start, end })` to `en.ts` and `pl.ts`, and use it.
- **Decision**: FIXED in `1b0e882`

### F8 — `/design` gear specimens are stale, with a duplicate `site-select` id

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/design.astro:1619-1690, src/components/tonight/GearCard.astro:33
- **Detail**:
  - The hand-built "Manage · focus-visible" and offline specimens still use the pre-`e64e58c` layout (a `size-10` icon, stroke 1.5, fixed `p-4`, no name line).
  - Two site cards with a select both render `id="site-select"`, so the second label points at the first select.
- **Fix**: Add an optional `selectId` prop to GearCard, as VerdictCard's `headingId` does. Give the `/design` cards unique ids, and re-sync the hand-built specimens to the current card.
- **Decision**: FIXED in `1b0e882`

### F9 — The hidden "Show" button keeps a no-JS promise inside the Tonight island

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (lessons.md)
- **Location**: src/components/tonight/GearCard.astro:56-59,76
- **Detail**: The `sr-only` submit button is commented "without the script, it still submits". That is a no-JS promise that lessons.md rules out inside the island, since Tonight needs JS anyway. With JS off it would also be an invisible focus stop. It was carried over from the old GearSelector.
- **Fix**: Drop the button, the comment and the script line that hides it. The select submits on change.
- **Decision**: FIXED in `1b0e882`

### F10 — Test and doc hygiene left over from the follow-up commits

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/tonight-phone.spec.ts:14-19, src/lib/toasts.test.ts, tests/e2e/seven-night-planner.spec.ts:103, tests/e2e/telescope-selector.spec.ts:53, src/components/tonight/TonightSkyView.tsx:106, plan.md Progress (Phase 4)
- **Detail**:
  - The `tonight-phone` header comment still says both cards end above the TabBar.
  - The `TOAST_MS is ten seconds` unit test asserts a constant against itself.
  - `deleteGear` was loosened to "any status visible". It could assert `en.gear.notice.deleted.<kind>`.
  - The chevron face rests at `opacity-60`, with no contrast row for the light-theme night sky.
  - The Phase 4 Progress rows cite only `4648b3d`, not the follow-ups `a93f4bc` and `e64e58c`.
- **Fix**:
  - Update the comment.
  - Drop the tautological test.
  - Assert the exact deleted notice.
  - Check the chevron contrast (≥ 3:1), raising the opacity if needed.
  - Note the follow-up commits in the handoff.
- **Decision**: FIXED in `1b0e882` (chevron rest opacity raised to 80: 60 failed 3:1 in red; new contrast row)

## Triage

The user chose "Apply all recommended fixes" (2026-10-08). Every finding was fixed in `1b0e882`, F3 via Fix A. Gates re-run green: astro check 0 errors; npm test 1172 passed; eslint 0 errors; full e2e 44 passed, 3 expected skips. Break checks went red on the DST zone test, the chevron contrast row and the toast focus assertion.
