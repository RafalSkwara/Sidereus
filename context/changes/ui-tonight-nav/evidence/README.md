# ui-tonight-nav evidence

- `measure-nav-labels.mjs`: label widths in Chromium with the repo's Archivo files (research C2, C3, C5). Run from the
  repo root: `node context/changes/ui-tonight-nav/evidence/measure-nav-labels.mjs`.
- `scripts/` (copied from `context/archive/2026-10-14-ui-fact-rhythm/evidence/scripts/`, local stack only, they
  refuse non-local URLs):
  - `seed.mjs`: one onboarded user in Madrid with a few log entries; writes `state-<prefix>.json` and
    `email-<prefix>.txt` into `<outDir>`.
  - `skeleton-heights.mjs`: skeleton vs real page height on the six focused pages and the finder (390 / 1280 px).
    It reads `state-ui-fact.json` from `<outDir>/..`.
  - `capture.mjs`: the screenshot matrix (routes × locale × theme × viewport), plus `MODE=design` for `/design`.

## Preparing the seeded user (full plan)

On the preview (4331, forecast fixture 4401) against local Supabase:

```bash
E=context/changes/ui-tonight-nav/evidence
OUT=<a directory outside the repo>   # holds the session; never commit it
BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> \
  node $E/scripts/seed.mjs "$PWD" $OUT ui-fact
SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run account:plan -- "$(cat $OUT/email-ui-fact.txt)" full
BASE_URL=http://localhost:4331 node $E/scripts/skeleton-heights.mjs "$PWD" $OUT/heights
```

The full plan is needed for the plan page's editor row and the finder. The secret key is inline and local only
(CLAUDE.md, Env).
