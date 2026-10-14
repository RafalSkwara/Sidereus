# ui-quiet-actions evidence

Captured on 2026-10-14 by the implementing agent.

- **Before:** a clean checkout of main 8f2f8d2 (S-07 merged; it differs from 1389bc1 only in docs).
- **After:** `feat/ui-refine` at Phase 2 (73d233d). Phase 3 changed only comments and docs.

Both were built with `npm run build`, previewed on port 4331 with the forecast fixture on 4401 (all clear) and local Supabase. `/design` was served by `astro dev` on 4331.

The users are created by `scripts/seed.mjs` (Madrid, default kit, six log entries rated 4):

- `ui-quiet-…@example.com` has the full plan, granted by `npm run account:plan` with the local secret key passed inline only.
- `ui-quiet-empty-…@example.com` has its eyepieces deleted, so /gear shows an empty band.

Re-run with `BASE_URL=http://localhost:4331 node scripts/capture.mjs <worktree> <outDir>`, which captures 13 routes × EN/PL × dark/light/red × 390 px/1280 px. The full matrix (180 shots per side) was captured and stays out of the repo; a curated, downscaled set is committed here.

## Folders

- `before/`, `after/`: full pages with the same file names, for example `targets-phone-en-red.jpg`.
  - The fixed TabBar appearing mid-page in phone shots is a screenshot artifact.
  - The routes are Tonight (six tiles), Targets, Planets, the Moon, `/tonight/events`, the finder, /log, `/log/sky`, /gear (filled, and `gear-empty` with an empty band) and confirm-email.
- `crops/`:
  - `targets-rows-{red,light}-{before,after}`: a target row.
  - `f7-targets-bottom-{red,light}-{before,after}`: "Mark observed" (hairline) above "Show the other 118 objects" (outline), plan review F7.
  - `offline-*-after`: the offline look.
- `design/`: `/design` sections before and after, at 1280 px, in dark, light and red. The sections are `c-link-button` (the button matrix, hairline and quiet, offline and Polish-wrap specimens), `c-back-link`, `c-pager`, `c-gear-row`, `c-tile` and `c-events-tile`.
- `scripts/`: `seed.mjs`, `capture.mjs`, `checks.mjs` (gear card heights and the offline look) and `design-sections.mjs`.

## Manual checks run by the agent

**1.5, `/design`** (`design/c-link-button-*`)
- The hairline reads as a button, quieter than the old `action` box.
- Quiet reads as a link with its icon, and is underlined at rest in red.
- The offline specimens show muted icons.
- Both Polish wrap specimens stay inside the 320 px column.

**2.6, Targets, Planets and the Moon at 390 px** (EN/PL, dark/light/red)
- Each item shows one hairline "Mark observed" and a text "Finder chart" (Crosshair).
- Eyepiece names are bold heading ink, not the link colour.
- The Polish pair ("Zapisz obserwację" and "Mapka znajdująca") wraps without sideways scroll. `tonight-phone.spec` also passes at 320 and 375 px.

**2.7, offline**
- `checks.mjs` sets `<html data-offline>` by hand. The look is pure CSS keyed on that attribute; the real offline path is covered by `offline.spec`, which passes.
- "Mark observed" computes muted ink, icon included (dark `rgb(169,177,197)`, red `rgb(196,0,0)`), with a dashed border and no underline.
- Manage computes the same muted ink and icon, with no underline in red. See `crops/offline-*`.

**2.8, dashboard and gear cards**
- The six tiles end in a bare muted arrow; the events tile gets it through `Tile`.
- The gear cards measure 136 px at 390 px and 148 px at 700 px, the same as `min-h-34` / `min-h-37`.
- The Manage link is 44 px tall.

## Automated runs (Phase 3)

| Check | Result |
|---|---|
| `npm test` | 1950 passed, 1 skipped, 6 todo |
| `npx astro check` | 0 errors |
| `npm run lint` | clean |
| Whole `npm run test:e2e` (fresh build, 4331/4401, keys inline) | 62 passed, 4 skipped |
| `npm run smoke` | 34 PASS lines, all steps passed |

The four e2e skips are `landing-screenshot` (it runs only with `CAPTURE_LANDING=1`) and three tests that depend on the date or time: the finder's no-darkness window, the Moon below the horizon, and the washed-out bookmark.

`public/landing/tonight.png` was recaptured with `CAPTURE_LANDING=1`, because it showed the old boxed Manage and the cue chip.

## For the owner (3.5, 3.6)

**F7, red mode.** The hairline (`--control-border` `#c80000`) and `outline` (`#ff0000`) are close in red:

- "Mark observed" sits just above "Show the other 118 objects" (`crops/f7-targets-bottom-red-after.jpg`).
- On /gear, "Dodaj stanowisko" (hairline) and "Dodaj okular" (outline, empty band) look almost the same (`after/gear-empty-phone-pl-red.jpg`).

Whether that is acceptable is the owner's call.

**Noticed, not changed** (pre-existing, outside the scope): the `/design` inline-link specimen renders "Nothing to see tonight.Back to Tonight" without a space before the link.
