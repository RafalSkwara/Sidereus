# observing-progress — impl review fixes (2026-10-09)

Source: `reviews/impl-review.md` (NEEDS ATTENTION, 0 critical / 3 warnings / 7 observations). User triage: fix all.

| Finding | Decision | Fix |
| --- | --- | --- |
| F1 | Fix now | `buildTonight` knows whether the log loaded (`logKnown`); a failed read sets `notSeenYet` false everywhere; test. |
| F2 | Fix A | `listSeenEntries`: first page with `count: "exact"`, advance by `data.length`, stop at the count (empty page as guard); unit test with a mocked client returning short pages. |
| F3 | Fix differently (user) | Transparent upward extension of the tooltip (pseudo-element/padding) closing the ~2 px gap; only the icon opens it (no hover on the name); same for the Moon wrapper; e2e: pointer moves from the button onto the tooltip and it stays visible. **Outcome:** probed in Chromium, there is no reachable gap and the band overlapped the button's lower 8 px, so the band was removed; the e2e hoverability step is kept (it fails on an introduced 8 px gap). |
| F4 | Fix | Close a tooltip in `focusout` when focus leaves its button for anything but its tooltip. |
| F5 | Fix | Init guard on the DOM marker (`html[data-not-seen-tip="ready"]`) instead of the module flag. |
| F6 | Fix | `build.test.ts`: assert the logged deep-sky object is present before asserting `notSeenYet === false`. |
| F7 | Fix | `listSeenEntries` throws `new Error(LOAD_FAILED, { cause: error })`. |
| F8 | Fix | Caldwell "C n" in the chip's sr-only text and the SeenList row; empty state as `<p>` + link like `/log/sky`; no repeated sr-only "Not seen yet" inside the tile link (legend stays). |
| F9 | Accept + note | Recorded in the plan addendum (skeleton reserves the legend line; rare shrink when all three are seen). |
| F10 | Fix | Plan addendum "Implementation notes" (accepted deviations) + corrected Phase 3 data line. |
