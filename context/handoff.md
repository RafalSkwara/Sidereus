# Handoff — 2026-10-06 (updated: S-12 implemented, awaiting the user's testing)

Where Sidereus stands, and what the next agent or session should pick up. Read this first, then `context/foundation/roadmap.md` and GitHub #67. (This replaces the earlier handoffs, which are in git history.)

## State of play

- **Milestone M-2 "First real nights"** is open, with 8 of 11 slices done: S-01 planets, S-02 the Moon, S-05 the Session plan, S-06 offline, S-07 verdict check, S-08 "Use my location", S-10 the Nightfall redesign and S-11 the Tonight dashboard (with its follow-ups `interactive-sky` and `compass-labels`). All are archived under `context/archive/`.
- **S-06 `offline-night-plan`** (#70) is **done**. It was merged in #110, deployed on 2026-10-06 and archived at `context/archive/2026-10-05-offline-night-plan/`. The user confirmed the real-phone install and airplane-mode check. In short (details in CLAUDE.md, "Offline (S-06)"):
  - **Installable:** a manifest, icons from the Topbar star, and an "Install app" entry in Settings, with a Share-sheet hint on iOS.
  - **Service worker:** `src/sw.ts` with Workbox. It is built by `scripts/build-sw.mjs` as npm `postbuild`, because vite-plugin-pwa can't emit under Astro 7. Every decision is a pure function in `src/lib/offline/copies.ts`.
  - **What it stores:** each Tonight page opened, per site, for 36 h, as a shell + server-island pair, plus a `?night=next` copy rendered from the same forecast.
  - **Offline:** the copy is served with a "Saved copy · prepared …" / old-forecast / stale notice. Network-only controls are disabled ("Needs a connection"), and anything else falls back to `/offline`.
  - **Clearing:** on sign-in, sign-up or sign-out; on the sign-in bounce; on any page rendered signed out; and when a different user commits (`data-owner` = SHA-256 of the user id).
  - **Deploys:** the `/_astro` files that stored pages use are kept across deploys.
- **Still open in M-2:**
  - **S-12 gear catalogue** (`in-progress`, #113, branch `feat/gear-catalogue`, change `context/changes/gear-catalogue/`): all 5 phases are implemented and pushed, every automated row is green, and the impl review of phases 1–3 has had its fixes applied. Pending: the user's manual testing (every Manual row in plan.md), then the PR, merge and archive.
    - **What it does:** a "Find your model" `forms/Combobox` on the `/gear` telescope and eyepiece forms and in onboarding. In onboarding, the generic types sit behind "Not sure of the model?", and a "Came with <model>" kit comes from the telescope's bundled eyepieces.
    - **The catalogue:** 340 telescopes and 338 eyepieces, hand-entered from manufacturer and retailer pages (`src/lib/gear/catalogue/`, CC0).
    - **Spot check:** `reviews/catalogue-spot-check.md`, with 0 mismatches.
    - **Follow-up:** Delta Optical is uncovered, because deltaoptical.pl answered 503 all day.
  - **S-03 deep sky beyond Messier** (`ready`, #67): next after S-12.
  - **S-09 map picker** (`blocked`, #73): the privacy decision on map tiles must be made.
  - **S-04 double stars** was **parked** by the user on 2026-10-06 (#68 closed as not planned; roadmap → Parked).

## Suggested next step

1. **S-12 (#113):**
   - The user tests the manual rows in `context/changes/gear-catalogue/plan.md`.
   - Then open the PR from `feat/gear-catalogue`, merge and deploy.
   - Then `/10x-archive gear-catalogue`, the roadmap S-12 → done and board #113 → done.
2. **S-03 (#67):** then plan it through the ordinary chain. The catalogue is already generated from the pinned OpenNGC commit, and S-01 settled target identity by kind.
3. **Unblock S-09:** the map-tile privacy question is the last user decision M-2 needs.

**Hard constraints (all UI work):**

- Colours only from tokens (`no-hardcoded-colors.test.ts`). A new token needs a value in every theme block, and the red theme has zero green and blue (`red-theme.test.ts`).
- WCAG AA contrast in all three themes, with focus visible everywhere.
- EN and PL copy: Polish runs longer, and every string goes through the i18n catalogue.
- Phone first (390 px).
- Coordinates never go into URLs or logs. The site and telescope choice travels as ids (`?site=`, `?telescope=` plus the cookies).
- Tonight's pages are server islands and need JavaScript (lessons.md).
- **A new Tonight page** must render `OfflineCopy` in its island and be added to `TONIGHT_PAGES` in `src/lib/offline/copies.ts`. Otherwise it isn't stored offline.

**Also still open:**

- **Post-merge checks from moonlight-and-the-verdict** (`context/archive/2026-10-02-moonlight-and-the-verdict/follow-ups/review-fixes.md`): bright-Moon screenshots after 2026-10-22, and a Firefox red-mode screenshot of the Moon card slider. The same bright Moon will exercise the `/tonight/all#washed-out` → Targets scroll; its e2e test skips until the Moon washes out an object.
- **Deferred from ui-auth:** D1 (signed-in visitors still see the auth forms) and D2 (sign-up doesn't carry `next`).

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

## Open issues worth knowing

- **#21:** ranking calibration. Items 1, 3 and 4 are open; the sky-check tally is the first real evidence for the verdict thresholds.
- **#19:** Stellarium fixtures. The Moon and planets use Skyfield references instead.
- **#67, #68, #73:** the remaining M-2 slices (see State of play). The board's Stream field has no option for S-10's stream E, so #86 has no Stream value.
- **A real VoiceOver pass** over the live sky is still with the user; names were checked through Playwright.
