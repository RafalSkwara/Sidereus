# Handoff — 2026-10-08 (test rollout Phase 3 researched and planned; plan review and implementation pending)

What Sidereus looks like now, and exactly what the next session (possibly the **other Claude account**) should do. Read this first, then `context/changes/testing-ranking-invariants-and-calibration-oracle/plan-brief.md`. **Do not redo research or planning**: both are done and committed. To save tokens, read only what each step names.

## State of play

- **Test rollout** (`context/foundation/test-plan.md`, 5 phases):
  - Phase 1 "Forecast honesty" and Phase 2 "Night and date boundaries" are `complete`. Both are archived: `context/archive/2026-10-07-testing-forecast-honesty/` and `context/archive/2026-10-08-testing-night-and-date-boundaries/` (PRs #134/#135 and #136/#137, all merged).
  - Phase 3 "Ranking invariants and calibration oracle" is `planned` in §3. The change folder is `context/changes/testing-ranking-invariants-and-calibration-oracle/`, and `change.md` status is `planned`.
- **Phase 3 so far** (2026-10-08, branch `feat/testing-ranking-invariants-and-calibration-oracle`, PR opened for the docs; see "Git state"):
  1. **`research.md`.** Risk #3 has no violation in about 19,000 probed rows, so its tests are a regression guard.
     - Risk #4's premise was wrong: no calibration snapshot is stored (`calibration.test.ts:44-61` only prints). The real gap is a guard that only checks the Messier bonus on 4 new-Moon nights, plus an exact top-5 order copied from engine output (`ranking.test.ts:195`).
  2. **Test plan §2.** Rows #3 and #4 are corrected, labelled as the research backport.
  3. **`plan.md`** (4 phases, 15 Progress rows, all `[ ]`) and **`plan-brief.md`** are written.
  4. **Plan review: NOT done.** Two review agents were started and stopped when the user asked to wrap up. Run `/10x-plan-review testing-ranking-invariants-and-calibration-oracle` first.
- **No product code** has changed in Phase 3.

## The user's decisions for Phase 3 (do not re-ask)

| Topic | Decision | Source |
| --- | --- | --- |
| §2 backport | Apply the research corrections for Risks #3 and #4 (done, commit b745359) | User |
| Risk #4 oracle | PRD invariants as relations **plus** a committed, source-cited beginner reference list | User |
| Overlap threshold | **k = 3**: each calibration night's top 5 must contain ≥3 reference objects (today: exactly 3 on all 4 nights) | User |
| Short windows (target up for one 10-min sample, ~0.7% of entries) | Pin the current rule in tests, no product change; draft a GitHub #21 comment that the user posts or approves | User |
| Phases | Approved: 1 engine visibility property suite → 2 ranking invariants as relations → 3 independent top-5 oracle + replace the order literal → 4 Tonight/Session plan property suite + docs | User |
| Everything else (generator, tolerances, file names, oracle paths) | Delegated; recorded in plan-brief.md › Key Decisions | Plan |

The beginner reference is already compiled in `plan.md` › Key Discoveries and References: 9 sources, URLs, access date 2026-10-08, and the at-least-2-sources sets per night with per-object source keys. **Never edit the list to make a ranking pass.**

## Next steps

Start the session **from `~/projects`** (where the shared `/10x-*` skills load), then:

```
cd sidereus && git checkout feat/testing-ranking-invariants-and-calibration-oracle && git pull
/10x-plan-review testing-ranking-invariants-and-calibration-oracle
/10x-implement testing-ranking-invariants-and-calibration-oracle phase 1
```

What the plan review should probe first. These are the open claims; probing was cut short:

- **Relation (g) "a larger aperture never shrinks the cleared set".** Check `score.ts` for any term that can fall with aperture. If (g) is false today, the plan says stop and ask, never weaken.
- **Full-Moon night 2026-03-03.** Check it has `washedOutCount ≥ 1` at Warsaw, Bortle 6.
- **Non-vacuity counts.** "≥10 cases above 60°" may be hard to reach because polar summer has no dark window. Adjust the count or the site list rather than the assertion.
- **Phase 4's `now`.** "Case evening 18:00 local" needs a zone-safe construction, and polar cases need care.
- **Phase 1 break check 2** edits test input, not production code. Consider replacing it.
- **Phase 4's `cardPasses` break check** might crash rather than turn red.

How the user wants the run (same as Phases 1 and 2):

- Delegate each phase to a Sonnet subagent, give it the `nvm use` prefix, and keep the gates and commits in the main session.
- Run every break check in the main session and log it in the plan's "Break-check log" notes and the commit messages.
- Commit each phase without approval and push the feature branch; don't stop between phases.
- After phase 4, run `/10x-impl-review` (Opus review agents) and update the PR.
- After the user merges: run `/10x-archive` on `chore/archive-testing-ranking-invariants-and-calibration-oracle` with a PR, set §3 Phase 3 to `complete`, then `/10x-test-plan` for Phase 4 "Access and entitlement boundary".
- **Never post to GitHub #21 without the user's OK** (Progress 4.5).

## Git state (end of this session)

- Branch `feat/testing-ranking-invariants-and-calibration-oracle`, pushed. Commits on top of `main` ce2e7d3:
  - fd2617e: folder;
  - c79f904: research;
  - b745359: §2 backport and decisions;
  - 8227ab6: plan and brief;
  - this handoff.
- A PR to `main` carries these docs. It can be merged as is, or left open and extended by the implementation commits.
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
  - Ask only for permissions and UI decisions. Decide non-UI choices yourself and record them as delegated. **Exception seen in S-06:** for a big architectural slice the user asked for *more* questions than proposed, including technical ones. So offer a higher question budget on HIGH-complexity plans.
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
