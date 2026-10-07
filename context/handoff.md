# Handoff — 2026-10-07 (S-03 shipped and archived; M-2 down to S-09)

Where Sidereus stands, and what the next agent or session should pick up. Read this first, then `context/foundation/roadmap.md`. (This replaces the earlier handoffs, which are in git history.)

## State of play

- **Milestone M-2 "First real nights"** has every slice done except **S-09**. Done: S-01 planets, S-02 the Moon, S-03 deep sky beyond Messier, S-05 the Session plan, S-06 offline, S-07 verdict check, S-08 "Use my location", S-10 Nightfall, S-11 the Tonight dashboard and S-12 the gear catalogue. All of them are archived under `context/archive/`. S-04 double stars is parked (#68 closed as not planned).
- **S-03 `deep-sky-beyond-messier`** (#67) is **done**:
  - Merged in #116 (f725dd7). Main's CI passed, which means the migrations ran and the app is deployed.
  - Archived at `context/archive/2026-10-06-deep-sky-beyond-messier/`. The roadmap and board #1 both say done.
  - **The archive PR #117** (`chore/archive-deep-sky-beyond-messier`, which also carries this handoff) **is waiting for the user's merge.**
  - **Catalogue:** 61 Caldwell objects at dec ≥ −23° are added to Messier (`DEEP_SKY`, 171 objects).
    - The Double Cluster is merged into `NGC869` "NGC 869 / 884".
    - C 49 and C 50 are relabelled `NGC2237` / `NGC2244` through generator `action: "designation"` overrides, because OpenNGC tags duplicate rows.
  - **Ranking:** one mixed ranking with an order-only `MESSIER_RANK_BONUS = 0.03`, guarded by `calibration.test.ts`.
  - **Tonight:** Caldwell rows read "NGC 7000 · name" with "Caldwell n".
  - **Log keys:** the log accepts `NGC<n>` / `IC<n>` keys. Server-side `isKnownTarget` rejects unknown ones.
  - **Picker search:** by prefix (`m`, `ngc`, `ic`, `c` / `caldwell`). A bare number falls back to NGC/IC numbers when no Messier number matches.
  - **Database:** `observations.messier` and its trigger are dropped (migration `20261006200000`).
  - Details are in CLAUDE.md under "Catalogue" and in the key-grammar convention.
  - **Still open:** Progress 2.5 is the user's sign-off on the seasonal top-10s and the bonus (`context/archive/2026-10-06-deep-sky-beyond-messier/evidence/calibration.md`). The evidence notes that NGC 188 ranks #10 in January and April, a scoring quirk that was left alone. Impl-review finding F4 was skipped: `/log?saved=NGC1` shows an unknown key in the notice, which is harmless.
- **S-12 gear catalogue** (#113): merged (#115), deployed and archived. The plan's 12 Manual rows (the user's joint test) and an impl review of phases 4–5 were never done. Delta Optical has no entries (its site returned 503).
- **S-09 map picker** (`blocked`, #73) is the last M-2 slice. It needs the user's privacy decision on map tiles.

## Suggested next step

1. **Merge archive PR #117** (user).
2. **Unblock S-09 or close M-2.** Ask the user to make the map-tile privacy decision for S-09. Alternatively, if they'd rather drop or park S-09, close milestone M-2 with `/10x-roadmap` and open the next milestone from the PRD.
3. **Optional calibration work (#21):** the user reviews the S-03 calibration snapshot (Progress 2.5). Any retuning of `MESSIER_RANK_BONUS` or of the scoring for objects like NGC 188 would be a new change. Use `CALIBRATION_SNAPSHOT=1 npx vitest run src/lib/engine/calibration.test.ts --reporter=verbose` to re-snapshot.
4. **`/10x-ui` passes** on the surfaces S-03 touched (Caldwell rows on `/tonight/targets`, the log picker) if the user wants a visual check beyond the phase screenshots.

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
- **S-12 manual checks** and the phase 4–5 review (see State of play).

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
- **#73:** S-09, the last M-2 slice (blocked on the map-tile privacy decision). The board's Stream field has no option for S-10's stream E, so #86 has no Stream value.
- **A real VoiceOver pass** over the live sky is still with the user; names were checked through Playwright.
