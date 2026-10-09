# Handoff — 2026-10-09 (test rollout Phase 3 implemented and reviewed; PR #142 awaits merge)

What Sidereus looks like now, and exactly what the next session (possibly the **other Claude account**) should do. Read this first. To save tokens, read only what each step names.

## State of play

- **S-02 UI adjustments (#123)** is done. PRs #139, #140 and the archive PR #141 are merged, and #123 is closed. Its worktree `.claude/worktrees/ui-user-adjustments` and the four old `agent-*` worktrees can be removed.
- **Test rollout** (`context/foundation/test-plan.md`, 5 phases):
  - Phases 1 and 2 are `complete` and archived.
  - Phase 3, "Ranking invariants and calibration oracle", is **implemented and impl-reviewed** on branch `feat/testing-ranking-invariants-and-calibration-oracle`. **PR #142** to `main` awaits the owner's merge.
  - `change.md` status is `impl_reviewed`. All 16 Progress rows are `[x]`.
- **What Phase 3 added** (tests and test-only fixtures; no product change):
  - `src/lib/engine/visibility-invariants.test.ts`: 200 seeded engine cases. Every listed object, planet and Moon entry is above the minimum and in darkness at its window start, end and best time, checked against astronomy-engine called independently.
  - `src/lib/engine/ranking-invariants.test.ts`: the PRD rules as relations over the catalogue.
  - `calibration.test.ts`: the top 5 overlaps the committed beginner reference (`fixtures/beginner-reference.ts`) by at least 3 objects on each night.
  - `ranking.test.ts`: the engine-copied order is replaced by a set check against AF.
  - `src/lib/tonight/visibility-invariants.test.ts`: 47 Tonight builds checking every Session plan row and the no-ranking gates.
  - Shared generator and oracle helpers live in `src/lib/engine/fixtures/` (`generated.ts`, `independent-altitude.ts`).
  - Docs: test-plan §6.3/§6.6 and one CLAUDE.md clause.
- **Reviews:**
  - Plan review: 10 findings, all applied (9acc4e0).
  - Impl review: NEEDS ATTENTION, 8 findings, all fixed (fc111ef, `follow-ups/review-fixes.md`).
  - Every break check is logged in `plan.md` and the commit messages.
- **#21:** the short-window note (about 1% of entries are up for a single 10-min sample; the rule is pinned) was posted with the owner's OK on 2026-10-09.

## Next steps

Start the session **from `~/projects`** (where the shared `/10x-*` skills load).

1. After the owner merges #142:
   - `cd sidereus && git checkout main && git pull`;
   - run `/10x-archive testing-ranking-invariants-and-calibration-oracle` on `chore/archive-testing-ranking-invariants-and-calibration-oracle` with a PR;
   - set test-plan §3 Phase 3 to `complete` in the same PR.
2. Then run `/10x-test-plan` for Phase 4, "Access and entitlement boundary".
3. Run Phase 4 like Phases 1–3:
   - delegate each phase to a Sonnet subagent with the `nvm use` prefix; keep the gates, break checks and commits in the main session;
   - commit without approval and don't stop between phases;
   - run `/10x-impl-review` with Opus agents at the end.

## Git state (end of this session)

- Branch `feat/testing-ranking-invariants-and-calibration-oracle`, pushed. On top of `main` ba17469 it carries: 9acc4e0 (plan review), b0e1cc9, d2b596e, 1430649, d4bb16c (phases 1–4), 873f898 (SHA record), fc111ef (review fixes), and this handoff.
- `stash@{0}` ("Auto stash before checking out origin/main") is old and was left alone.
- Untracked and **never committed**: `.mcp.json` and `.claude/` (the user's choice).

## Also still open (unchanged from before)

- S-03 calibration sign-off (Progress 2.5 of `context/archive/2026-10-06-deep-sky-beyond-messier/`), #21 calibration work.
- S-12: 12 manual rows and the phase 4–5 impl review were never done. Delta Optical has no catalogue entries.
- moonlight-and-the-verdict post-merge checks after 2026-10-22 (`context/archive/2026-10-02-moonlight-and-the-verdict/follow-ups/review-fixes.md`).
- ui-auth deferred: D1 (signed-in visitors see the auth forms) and D2 (sign-up doesn't carry `next`).
- Roadmap Open Question 1: whether to bump the PRD to v3. S-09's phase 1 adds only a dated amendment, not v3.

**Hard constraints (all UI work):**

- Colours only from tokens (`no-hardcoded-colors.test.ts`). A new token needs a value in every theme block, and the red theme has zero green and blue (`red-theme.test.ts`).
- WCAG AA contrast in all three themes, with focus visible everywhere.
- EN and PL copy: Polish runs longer, and every string goes through the i18n catalogue.
- Phone first (390 px).
- Coordinates never go into URLs or logs.
- Tonight's pages are server islands and need JavaScript (lessons.md).

## Things a new session should know

- **How the user works** (also in the auto-memory):
  - Ask only for permissions and UI decisions. Decide non-UI choices yourself and record them as delegated. **Exception seen in S-06:** for a big architectural slice the user asked for _more_ questions than proposed, including technical ones. So offer a higher question budget on HIGH-complexity plans.
  - Send a `PushNotification` before every question.
  - Keep new tests modest ("we've got loads of them already", S-08): pin only what screenshots can't show.
  - Run manual checks yourself (a local preview against local Supabase, plus Playwright screenshots in EN/PL, dark/light/red, phone/desktop) and tick them with evidence.
  - Never commit to `main` or merge without case-by-case approval. Feature-branch pushes and PRs are pre-approved. Close-out and archive commits go on a `chore/archive-<change-id>` branch with a PR.
  - Mirror progress on GitHub Projects board #1. Check `gh auth status` first; the token needs the `project` scope.
- **Subagents:**
  - Give them the prefix `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null &&`.
  - Check their footprint after about 5 minutes. A heavy Opus phase may write nothing for 10+ minutes while it reads. Check its transcript size is still growing before calling it stalled.
  - Forbid git-state changes; the main agent stages and deletes files itself. Don't use `rm -rf` in commands: the user's permission rules refuse it.
- **Build:** always `npm run build`, never `npx astro build` alone. The `postbuild` step bundles `dist/client/sw.js`.
- **Local e2e recipe** (CI does the same in `.github/workflows/ci.yml`):
  1. `npx supabase start`.
  2. `FIXTURE_PORT=4400 node tests/e2e/forecast-fixture.mjs &`.
  3. `npm run build`, then write the local `SUPABASE_URL` / `SUPABASE_KEY` (from `npx supabase status -o env`: `API_URL`, `ANON_KEY`) and `FORECAST_BASE_URL=http://127.0.0.1:4400` into **`dist/server/.dev.vars` only**. Preview reads that copy, so the repo's `.env` / `.dev.vars` stay untouched. Every build overwrites the copy, so rewrite it after each rebuild.
  4. `npx astro preview --port 4321`. Astro 7's preview detaches as a daemon; stop it with `npx astro preview stop`. Rebuild after any source change.
  5. `SUPABASE_URL=$API_URL SUPABASE_KEY=$ANON_KEY BASE_URL=http://localhost:4321 npm run test:e2e`. The sky-checks and offline specs need the Supabase variables.
- **Testing offline:** Playwright 1.55's `context.setOffline` does **not** reliably cut the service worker's own fetches. To be truly offline, stop the preview (`npx astro preview stop`) for manual checks; the e2e closes a proxy in `tests/e2e/offline.spec.ts`. Always assert `html[data-from-device]` before trusting an offline result (lessons.md).
- **Scratch Playwright scripts:**
  - Scripts for manual screenshots can live in the scratchpad if they load Playwright with `createRequire(process.cwd() + "/package.json")` and run from the repo root.
  - Scripts that import `@/` modules or `tests/e2e/helpers` must sit under `tests/e2e/`. Delete them after use.
  - `onboardInMadrid` uses English labels, so set the Polish cookie only after onboarding.
- **Background processes stop after 2 hours.** Start the forecast fixture inside the same foreground command as the tests (`node tests/e2e/forecast-fixture.mjs & FIX=$!; …; kill $FIX`) rather than as a long-lived background task.
- **Tonight is a server island**, and so is each `/tonight/*` page. Wait for `[data-sky-headline]`, `section[aria-labelledby="verdict-heading"]`, `[data-offline-copy]` or the page's own section before asserting on island content in e2e; a skeleton already renders the title and back link.
- **Port 4321 must be free before `astro preview`.** A leftover `astro dev` (or an old preview daemon from an earlier session) on 4321 serves the wrong build. Check with `npx astro preview status` / `lsof -iTCP:4321 -sTCP:LISTEN`.
- **CI:**
  - **`smoke` setup flake:** the job's `supabase/setup-cli` sometimes fails with "rate limit exceeded". Re-run only the failed job: `gh run rerun <id> --failed`.
  - **Slow runners:** a PR run can take 40 minutes on a slow runner (`npm ci` 6 min, local Supabase 12 min) without anything being wrong.
  - **Supabase CLI pin:** the CLI is pinned in `ci.yml`, now **2.119.0** (#111). On 2026-10-06 the pinned 2.117.0 started failing `migrate` at `supabase link` with "FGA Authentication Error. Unauthorized", even with a new full-access token. Bumping the pin fixed it. If `migrate` fails on auth again with a valid token, try the latest stable CLI before anything else.
- **Hosting:** Workers Paid since 2026-09-30. Production is https://sidereus.sidereus.workers.dev.
- **Untracked `.mcp.json`:** leave it out of commits (the user's choice).
- **Docker must be running** for `npx supabase start`, `test:db`, smoke and e2e. On 2026-10-06 it was down, so the S-03 review fixes were verified by unit tests and CI only.
- **Lint:** `npm run lint` can run out of memory. `npx eslint . --ignore-pattern '.claude/**'` is equivalent. There are 3 known `no-console` warnings in engine test files; they are intentional (budget logs and the calibration snapshot).
- **Background `astro preview`** looks like a hung task to the user. Stop it as soon as the screenshot or e2e step ends, and say that the task is the server.

## Open issues worth knowing

- **#21:** ranking calibration. Items 1, 3 and 4 are open. The sky-check tally and the S-03 calibration snapshot are the evidence so far.
- **#19:** Stellarium fixtures. The Moon and planets use Skyfield references instead.
- **#73:** S-09, the last M-2 slice: unblocked 2026-10-07, planned and plan-reviewed, board = planning. The board's Stream field has no option for S-10's stream E, so #86 has no Stream value.
- **A real VoiceOver pass** over the live sky is still with the user; names were checked through Playwright.
