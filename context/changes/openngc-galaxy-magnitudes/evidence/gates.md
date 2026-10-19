# Gates run the way CI runs them (2026-10-19, branch fix/openngc-galaxy-magnitudes at the Phase 3 commit 3e85240)

| Gate | Result |
|---|---|
| `npx astro sync` + `npx astro check` | 0 errors, 0 warnings, 3 hints (the hints were not listed by the CLI's summary output and were not compared with main; no `.astro` file changed in this branch) |
| `npm run lint` (`--max-warnings 0`) | clean |
| `npm test` (both Vitest projects) | 124 files, 824 tests passed, 1 skipped |
| `npm run build` | succeeded (service worker precaches 63 files) |
| `npm run smoke` against the local production preview | 75 steps PASS, 0 FAIL |
| `npm run test:e2e` against the same preview | 64 passed (1.2 min), no flaky, no skipped |

How: forecast fixture on port 4402 (`FIXTURE_PORT=4402 node tests/e2e/forecast-fixture.mjs`), a fresh `npm run build`, `dist/server/.dev.vars` written with the local stack's URL, anon key and `FORECAST_BASE_URL=http://127.0.0.1:4402` (no `.env` or `.dev.vars` in the repo root), preview on port 4335, the secret key inline on the smoke and e2e commands only (never exported); both servers stopped by port afterwards. Local Supabase was used as running and was not reset.

Scope of the user-visible change the run covers: the what-to-expect lines and the ranking of 12 galaxies change at some settings (`before-after.md`); no e2e or smoke step names those galaxies, so none moved.

Note: `origin/main` advanced from 3f75fc7 (the branch point) to 04848f9 (PR #226) during this change. The branch needs a rebase or merge of main before its PR; `CLAUDE.md` is the one file both sides may have touched.

## Re-run on the merged state (2026-10-19, after merging origin/main 04848f9 into the branch, merge commit b2bbb8a)

Same method (forecast fixture on 4402, fresh `npm run build`, `dist/server/.dev.vars` against the local stack, preview on 4335, the secret key inline only, servers stopped by port afterwards).

| Gate | Result |
|---|---|
| `npx astro check` | 0 errors, 0 warnings, 3 hints |
| `npm run lint` | clean |
| `npm test` (both projects) | 130 files, 847 tests passed, 1 skipped |
| `npm run smoke` | 80 steps PASS, 0 FAIL |
| `npm run test:e2e` | 64 passed (1.2 min) |

The merge was clean (no conflicts; `CLAUDE.md` was changed on both sides in different paragraphs).
