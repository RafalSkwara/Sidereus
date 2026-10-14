# ui-quiet-actions evidence

Captured on 2026-10-14 by the implementing agent, and refreshed after the implementation review (`../reviews/impl-review.md`, F1-F9).

- **Before:** a clean checkout of main 8f2f8d2 (S-07 merged).
- **After:** `feat/ui-refine` with the review fixes.

Both were built with `npm run build`, previewed on port 4331 with the forecast fixture on 4401 (all clear) and local Supabase. `/design` was served by `astro dev` on 4331.

Every script under `scripts/` refuses a non-local `BASE_URL`, and `seed.mjs` refuses a non-local `SUPABASE_URL` (F3). The port comes from `BASE_URL` or `PREVIEW_PORT`.

The users are created by `scripts/seed.mjs` (Madrid, default kit, six log entries rated 4):

- `ui-quiet-…@example.com` has the full plan, granted by `npm run account:plan` with the local secret key passed inline only.
- `ui-quiet-empty-…@example.com` has its eyepieces deleted, so /gear shows an empty band.

`scripts/capture.mjs` takes 13 routes × EN/PL × dark/light/red × 390 px/1280 px. The full matrix (180 shots per side) stays out of the repo; a curated, downscaled set is committed here.

## Folders

- `before/`, `after/`: full pages with the same file names.
  - Routes: Tonight (six tiles), Targets, Planets, the Moon, Nights, `/tonight/events`, the finder, /log, `/log/sky`, /log/progress, /gear (filled, and `gear-empty` with an empty band) and confirm-email.
  - Dark desktop shots: `tonight-`, `targets-` and `log-desktop-en-dark`.
  - The fixed TabBar appearing mid-page in phone shots is a screenshot artifact.
- `crops/`:
  - `targets-rows-{red,light}-{before,after}`: a target row.
  - `f7-targets-bottom-{red,light}-{before,after}`: "Mark observed" (hairline) above "Show the other 118 objects" (outline).
  - `f7-gear-pair-red-{before,after}`: /gear in red, "Dodaj stanowisko" (hairline, band with items) above "Dodaj okular" (outline, empty band). This is the plan review F7 pair.
  - `offline-{mark-observed,manage}-{red,dark}-after`: the real offline check (below).
- `design/`: `/design` sections before and after, named `<section>-<theme>-<width>-<before|after>`.
  - In dark and red at 1280 px: the button matrix (`c-button`, `c-link-button`: hairline and quiet, offline and Polish-wrap specimens), `c-back-link`, `c-pager`, `c-gear-row`, `c-tile`, `c-events-tile`, the milestone dialog (`c-milestone-celebration`) and the VerdictCard event line (`c-verdict-event`).
  - At 390 px: `c-link-button` (light too), `c-back-link`, `c-gear-row` and `c-milestone-celebration`.
  - `c-verdict-event` is after only, because this change does not touch it.
- `scripts/`:
  - `seed.mjs`;
  - `capture.mjs`;
  - `checks.mjs` (gear card heights, a quick `data-offline` look);
  - `offline-real.mjs` (manual check 2.7 for real);
  - `design-sections.mjs`.

## Manual checks run by the agent

The owner's standing rule is that agents run manual checks themselves, with evidence.

**1.5, `/design` at 390 px and 1280 px** (`design/c-link-button-*`)
- The hairline reads as a button, quieter than the old `action` box.
- Quiet reads as a link with its icon, and is underlined at rest in red.
- The offline specimens show muted icons.
- Both Polish wrap specimens stay inside the 320 px column.

**2.6, Targets, Planets and the Moon at 390 px** (EN/PL, dark/light/red)
- Each item shows one hairline "Mark observed" and a text "Finder chart".
- Eyepiece names are bold heading ink.
- The Moon's washed-out link now carries an `ArrowRight` icon (F5).
- The Polish pair wraps without sideways scroll. `tonight-phone.spec` also passes at 320 and 375 px.

**2.7, offline, for real** (F1; `scripts/offline-real.mjs`, `crops/offline-*`)
- With the service worker on, Tonight and Targets were opened online, then the preview was stopped, so the server was unreachable, and both pages were reloaded with the context offline.
- `html[data-from-device]` and `html[data-offline]` were asserted first.

| Control | Red | Dark |
|---|---|---|
| Mark observed (hairline) | `aria-disabled`, ink and icon `rgb(196,0,0)`, dashed border, no underline | ink and icon `rgb(169,177,197)`, dashed border, no underline |
| Manage (quiet) | `aria-disabled`, ink and icon `rgb(196,0,0)`, no underline | ink and icon `rgb(169,177,197)`, no underline |

Finder chart stays live offline, by design (D-15).

**2.8, dashboard and gear cards**
- The six tiles end in a bare muted arrow.
- The gear cards measure 136 px at 390 px and 148 px at 700 px. That equals `min-h-34` / `min-h-37`, the measured single-item height the skeleton shares, so they are unchanged.
- Manage is 44 px tall.

## Owner decisions (2026-10-14)

- **3.5:** the new button weight is accepted, after the before/after crops.
- **3.6 / F7:** the red-mode similarity of hairline (`#c80000`) and outline (`#ff0000`) is accepted as is.

## Automated runs

The counts are in the PR, from the final run after the rebase onto main.

The automated guards added after the review:
- `red-night-mode.spec`: quiet underlined at rest in red only, and the credit links' underline takes the text colour in red only (F7).
- `offline.spec`, in red: a stored `/tonight`'s Manage link is `aria-disabled`, not underlined, with its icon in the link's own colour.

Each guard was deliberately broken once and went red.

**Noticed, not changed** (pre-existing, outside the scope): the `/design` inline-link specimen renders "Nothing to see tonight.Back to Tonight" without a space before the link.
