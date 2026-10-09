# observing-progress — manual verification evidence (2026-10-09)

Captured by the implementing agent on a local production preview (port 4331) against the shared local Supabase and the all-clear forecast fixture (port 4400), with fresh e2e users onboarded in Madrid. Real clock: 9 Oct 2026, 22:xx CEST.

- **2.5** Tonight marks. Files `p2-tonight-*` (tile, static marks and legend), `p2-targets-tooltip-*` (tooltip open on the first card), `p2-targets-rest-*` (rest list with the legend line), `p2-planets-*` and `p2-moon-*`. Kept: 390 px in EN dark, PL light and PL red, plus desktop EN dark. The full 2 × 3 × 2 matrix was captured and reviewed, then trimmed for size.
  - At 320 px the tooltip box is x=16, width=288 in EN and PL (`p2-targets-tooltip-*-dark-320`), on screen.
  - The capture run reported no off-screen tooltip at 390 px or on desktop.
  - **Limitation:** tonight's Moon is a 1% crescent and not a target, so `/tonight/moon` shows no mark (`p2-moon-*`). The Moon mark is covered by `build.test.ts` and the `/design` specimen, not by a live screenshot.
- **2.6** Tooltip behaviour.
  - Hover on desktop opens it.
  - Keyboard Tab and touch (tap, second tap, Esc, outside tap) are in `tests/e2e/observing-progress.spec.ts`.
  - The manual check found a bug: on desktop, after Esc the still-focused button matched `:focus-visible`, so moving the pointer away brought the tooltip back. `not-seen-tip.ts` now clears the dismissal only once both the pointer and the focus have left. The new e2e case "on a desktop, hover opens the tooltip, and Esc keeps it closed once the pointer leaves" was red on the old code and is green on the fix.
- **3.4** The progress page.
  - `p3-progress-empty-*`: the empty log, 0 / 110 and 0 / 61, with every band shown.
  - `p3-progress-seen-*`: M31 rated 4, M13 rated 5, M42 rated 3, M57 rated 2 (not ticked), NGC 7000 and NGC 869 for Caldwell, plus Jupiter and the Moon as firsts.
  - `p3-log-header-*`: the Progress action link beside Sky checks; "Add entry" is still the only primary action.
  - Seen chips are filled and carry a corner check, so red mode tells them apart.
- **3.5** `/design` specimens (dev server): `p3-design-c-not-seen-{dark,light,red}`, `p3-design-c-checklist-{dark,light,red}`. The dark pill over the checklist specimen is Astro's dev toolbar.
