# ui-tonight-nav evidence

## Scripts

- `measure-nav-labels.mjs`: label widths in Chromium with the repo's Archivo files (research C2, C3, C5). Run from the
  repo root: `node context/changes/ui-tonight-nav/evidence/measure-nav-labels.mjs`.
- `scripts/` (local stack only, they refuse non-local URLs; `seed.mjs`, `skeleton-heights.mjs` and `capture.mjs` are
  copied from `context/archive/2026-10-14-ui-fact-rhythm/evidence/scripts/`):
  - `seed.mjs`: one onboarded user in Madrid with a few log entries; writes `state-<prefix>.json` and
    `email-<prefix>.txt` into `<outDir>`.
  - `skeleton-heights.mjs`: skeleton vs real page height on the six focused pages and the finder (390 / 1280 px).
    It reads `state-ui-fact.json` from `<outDir>/..`.
  - `header-heights.mjs`: the header's parity between skeleton and real page (the h1's top and the sky band's bottom)
    on the same pages and widths, with the same usage and state (Progress 2.5).
  - `nav-shots.mjs`: crops of the bars and the sub-nav, per locale (en, pl) and theme (dark, light, red). `bars` shoots
    the TabBar at 320 / 390 px and the Topbar at 768 / 1024 / 1280 px on `/log/progress`; `subnav` shoots the top of
    `/tonight/{targets,plan,events}` at 390 and 1280 px. Usage:
    `BASE_URL=http://localhost:4331 node nav-shots.mjs <worktree> <stateFile> <outDir> <bars|subnav>`.
  - `capture.mjs`: the screenshot matrix (routes × locale × theme × viewport), plus `MODE=design` for `/design`
    against `npm run dev`.

## Shots (`after/`)

Each name ends in `-<width>-<locale>-<theme>.jpg`, for en and pl in dark, light and red.

- `nav-tabbar-{320,390}-*`: the four-tab TabBar on `/log/progress`, Progress current (Phase 1, 1.5).
- `nav-topbar-{768,1024,1280}-*`: the four-segment Topbar pill on `/log/progress`, text only at 768 px and with icons
  from 1024 px (Phase 1, 1.5).
- `subnav-{targets,plan,events}-{390,1280}-*`: the sub-nav under the Topbar and the page sky, the current chip filled
  and in view (Phase 2, 2.6).
- `design-subnav-*`: `/design`'s TonightSubNav block at 390 and 1280 px in each theme (Phase 3, 3.5; captured with
  the Phase 3 screenshot pass).

## Preparing the seeded user (full plan)

On the preview (4331, forecast fixture 4401) against local Supabase:

```bash
E=context/changes/ui-tonight-nav/evidence
OUT=<a directory outside the repo>   # holds the session; never commit it
BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> \
  node $E/scripts/seed.mjs "$PWD" $OUT ui-fact
SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run account:plan -- "$(cat $OUT/email-ui-fact.txt)" full
BASE_URL=http://localhost:4331 node $E/scripts/skeleton-heights.mjs "$PWD" $OUT/heights
BASE_URL=http://localhost:4331 node $E/scripts/header-heights.mjs "$PWD" $OUT/heights
BASE_URL=http://localhost:4331 node $E/scripts/nav-shots.mjs "$PWD" $OUT/state-ui-fact.json $E/after bars
BASE_URL=http://localhost:4331 node $E/scripts/nav-shots.mjs "$PWD" $OUT/state-ui-fact.json $E/after subnav
```

The full plan is needed for the plan page's editor row and the finder. The secret key is inline and local only
(CLAUDE.md, Env).
