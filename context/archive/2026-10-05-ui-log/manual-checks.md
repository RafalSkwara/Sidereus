# ui-log — manual check evidence

Screenshots were taken on 2026-10-05 by a scratch Playwright script (not committed) against `astro preview` on port 4325, local Supabase and the forecast fixture on 4400, with a throwaway user (`ui-log-<uuid>@example.com`, 52 seeded entries, 3 seeded sky checks). Files live in the session scratchpad (`…/scratchpad/shots/`, 192 PNGs); names are `<view>-<locale>-<theme>-<width>.png`.

| Row | Evidence |
| --- | --- |
| 1.3 `/design` Pager block | **Not taken.** `astro dev` in this worktree failed to start within its 30 s daemon timeout twice (no log output), so `/design` (dev only) could not be opened. The Pager itself is shown live on `/log`: `log-page2-*` (newer and older), `log-filled-notice-*` (older only), `state-focus-pager-*` (focus). Left unchecked. |
| 2.3 form matches gear | `new-manual-en-dark-1280`, `state-error-*-390` (44 px fields, `--ring` focus, shared error line with icon), `state-focus-select-*`, `state-focus-picker-*`, `state-focus-rating-*` |
| 3.4 pages read as siblings of `/gear` | `log-filled-notice-*`, `log-empty-*`, `new-manual-*`, `new-ranking-*`, `edit-*`, `sky-filled-notice-*`, `sky-empty-*` in EN/PL × dark/light/red × 390/1280 |
| 4.2 red pixel audit | 60 red screenshots, max green/blue channel 0 (sharp over every `*-red-*` file) |
| 4.3 7-state matrix | default: every view above · hover: `state-hover-row-*` · focus-visible: `state-focus-row-*`, `state-focus-pager-*`, `state-focus-select-*`, `state-focus-rating-*`, `state-focus-picker-*` · disabled + loading: `state-pending-*` (SubmitButton pending, disabled) · error: `state-error-*` · empty: `log-empty-*`, `sky-empty-*`, `state-log-page99-*`, `state-sky-page99-*`, `new-needsgear-*`, `state-unknown-object-*`, `state-notfound-*` · long content: PL at 390 (below), the 52-entry log. Skeleton loading: N/A (server-rendered pages; no island data load). |
| 4.4 PL at 390 px | all 134 `*-390` screenshots are exactly 390 px wide (no horizontal overflow); PL titles wrap inside the header (`log-empty-pl-light-390`, `edit-pl-light-390`) |
| 4.5 contrast in three themes | inspected `*-dark-*`, `*-light-*`, `*-red-*` of every view: headings, muted meta, rating dots and outcome dots read; the selected rating key is ink on ink-foreground in every theme (`state-focus-rating-en-light-390`) |
