# Handoff — 2026-10-09 night (test rollout Phase 4 merged and archived)

What Sidereus looks like now, and what the next session should do. Read this first. The sections below the first one are older context.

## Update 2026-10-09 night (supersedes every next step below)

- **Test rollout Phase 4** ("Access and entitlement boundary", Risks #5 and #6) is **done**: merged as **#147** (2026-10-09 19:41 UTC) and archived to `context/archive/2026-10-09-testing-access-and-entitlement-boundary/`. The archive PR (branch `chore/archive-testing-access-and-entitlement-boundary`) also points test-plan §3 Phase 4 at the archive. **It awaits the owner's merge.**
- What landed:
  - `tests/db/structure.test.ts` reads the catalogs over `DB_URL` and fails on any unclassified `public` table, a per-user table without RLS or its four policies, a server-owned table with more than `authenticated` SELECT (column grants included), a view without `security_invoker`, a materialized view or foreign table, and a definer, `search_path`-less or anon/PUBLIC-executable function.
  - `tests/db/tables.ts` holds `TABLES` and `SERVER_OWNED`; isolation covers anon writes and pins cross-user inserts and hand-overs to `42501`.
  - `no-console` is an error in all of `src`; `src/lib/no-console-guard.test.ts` proves it per file and allowlists disables by file, count and reason.
  - Smoke pins the invalid-latitude redirects exactly. Test-plan §6.4 is the recipe for the next table, RPC or full-plan route (S-03's first route brings the HTTP refusal test).
- **Open follow-up (impl review F3):** client `<script>` blocks in `.astro` files are not linted at all: the type-aware parser fails on the plugin's virtual file and the error is dropped. Recorded in CLAUDE.md, test-plan §6.4 and the guard header. The fix is planned in the archived `follow-ups/review-fixes.md`; open it as its own change (or fold it into test rollout Phase 5).
- **Next:** test rollout Phase 5 ("Quality-gates wiring") via `/10x-test-plan`, or the M-3 slices; S-05 work runs in parallel in `.claude/worktrees/observing-progress`.
- Local smoke runs need `.env`/`.dev.vars` pointed at local Supabase. Ask the owner (or the orchestrator) before switching them; they point at hosted.

---

## Earlier: Handoff — 2026-10-09 evening (test rollout Phase 3 merged and archived; Phase 4 research partial)

What Sidereus looks like now, and exactly what the next session (possibly the **other Claude account**) should do. Read this first, then `context/changes/testing-access-and-entitlement-boundary/research.md`. To save tokens, read only what each step names.

## Update 2026-10-09 late evening (supersedes the Phase 4 next steps below)

- Phase 4 research is **complete**: the Risk #6 sweep was re-run and found no live lint gap or URL leak. It also found that `warn` is unenforced in CI, and it recommends a repo-wide `no-console: error` plus a guard test that reads the resolved config (see `research.md`). `change.md` is `preparing`, and test-plan §2 (Risk #5/#6 guidance) is backported.
- Owner decisions: the self-only direct writes are **accepted for now, to revisit later**, and **Phase 4 waits for F-01 `account-plans`**. Test-plan §3 Phase 4 reads `researched (waits for F-01)`.
- **Next:** F-01 `account-plans` (roadmap, GitHub #121) via `/10x-new`. Its plan must not add an owner-writable `plan` column: it needs column grants, a trigger or a separate table. After F-01, resume Phase 4 at `/10x-plan testing-access-and-entitlement-boundary`.

## State of play

- **Test rollout Phase 3** ("Ranking invariants and calibration oracle"):
  - Merged as **#142**, then archived to `context/archive/2026-10-08-testing-ranking-invariants-and-calibration-oracle/`.
  - The **archive PR #143** (branch `chore/archive-testing-ranking-invariants-and-calibration-oracle`) also sets test-plan §3 Phase 3 to `complete`. **It awaits the owner's merge.**
  - #21 got the short-window comment, posted with the owner's OK.
- **Test rollout Phase 4** ("Access and entitlement boundary", Risks #5 and #6):
  - Branch `feat/testing-access-and-entitlement-boundary`, cut from the archive branch, so its diff shows #143's commits until #143 merges.
  - Change folder `context/changes/testing-access-and-entitlement-boundary/`: `change.md` (status `new`) and **`research.md` with `status: partial`**.
  - Test-plan §3 Phase 4 is `change opened`.
  - **No PR yet** for this branch; it is pushed.
- **What the research found** (details and anchors in `research.md`):
  - **Account plans (roadmap F-01) don't exist in code.** The plan half of Risk #5 is speculative today: "can't change own plan" and "free refused on full-plan routes".
  - **Cross-user isolation holds** and is mostly tested in `tests/db/isolation.test.ts`, with positive controls.
  - **Gaps:**
    - anon INSERT/UPDATE/DELETE are untested;
    - cross-user writes are asserted as "an error", not `42501`;
    - no structural check that every table has RLS and four policies;
    - no column-level grants anywhere, so owners can directly rewrite server-decided fields in their own rows: `sky_checks` headline, `dark_start` and answered rows; `record_sky_verdict` takes a caller-chosen `dark_start`; `observations` future nights. All of this is self-only, and verdict-check accepted anti-tamper as out of scope.
  - This matters for F-01: a `plan` column on a user-writable table would be owner-writable by default.
  - **Risk #6 is only partly grounded.** The no-console scope is still a hand-kept glob list (`eslint.config.js:84-109`). The code sweep that lists coordinate-touching modules outside it was **stopped unfinished**.

## Next steps

Start the session **from `~/projects`** (where the shared `/10x-*` skills load).

1. `cd sidereus && git fetch && git checkout feat/testing-access-and-entitlement-boundary && git pull`. If #143 has merged, `git merge origin/main` (or rebase) first.
2. **Finish the research.** Re-run only Open Question 1 of `research.md` (the Risk #6 code sweep) with one Opus worker. Then append its findings and set `status: complete`. Don't redo the Risk #5 or history work.
   - The brief: trace modules that receive `SiteRecord` / `Site` / coordinates by type and import; list those outside `gearConfig.files`; audit every redirect and URL construction and the tests that pin `?error=` keys; assess an automatic check (module graph ⊆ lint scope, or a repo-wide error default with listed exceptions). Never grep for "lat".
3. **Ask the owner** (send a PushNotification first), in Polish since these are research and plan questions:
   - Open Question 2: keep the self-only direct writes as accepted and pinned, or harden them with column grants or a trigger (a product change)?
   - Open Question 3: run Phase 4 now for isolation plus coordinates and defer the plan half to F-01, or wait for F-01?
4. Run the post-research backport to test-plan §2 (Risk #5: the plan half depends on F-01; add the column-privilege challenge). Run `node <10x-research skill dir>/scripts/metadata-guard.mjs mark-researched …`, then set §3 to `researched`.
5. `/10x-plan testing-access-and-entitlement-boundary`, then `/10x-plan-review`, then `/10x-implement`, run like Phases 1–3:
   - delegate each phase to a Sonnet subagent with high effort and the `nvm use` prefix;
   - keep the gates, break checks and commits in the main session; commit without approval;
   - finish with `/10x-impl-review` using Opus agents;
   - the tests/db suite needs Docker plus `npx supabase start`.

## Git state (end of this session)

- `main` is at baa1b1a (#142 merged).
- `chore/archive-testing-ranking-invariants-and-calibration-oracle` (PR #143) has 3e50b4f (the archive) and the test-plan §3 Phase 3 commit.
- `feat/testing-access-and-entitlement-boundary` has 6d65ac2 (the folder and §3 `change opened`), plus the partial research and this handoff.
- `stash@{0}` ("Auto stash before checking out origin/main") is old and was left alone.
- Untracked and **never committed**: `.mcp.json` and `.claude/`.
- Five old worktrees under `.claude/worktrees/` (the S-02 one and four `agent-*` ones) can be removed, but only with the owner's OK.

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
