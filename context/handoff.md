# Handoff — 2026-10-05

Where Sidereus stands, and what the next agent or session should pick up. Read this first, then `context/foundation/roadmap.md` and GitHub #69. (This replaces the earlier handoffs, which are in git history.)

## State of play

- **Milestone M-2 "First real nights"** is open. Two user-requested slices came ahead of everything else on 2026-10-04:
  - **S-10 `visual-redesign`** (#86) is **done**: Nightfall on every screen. The contract and `/gear` (#89), Tonight (#91, #92), the light-theme night sky (#106) and the four last `/10x-ui` passes (landing #102, onboarding #103, auth #104, log #105) are merged; all five change folders are archived (`context/archive/2026-10-04-visual-redesign/`, `2026-10-05-ui-{auth,landing,log,onboarding}/`). The passes' follow-ups (FieldError as the one alert, FormField `pr-11`, a forced-colors marker on the rating keys, the logo to `/tonight` when signed in, the Polish Topbar at 320 px) landed with the close-out. Still deferred from ui-auth: D1 (signed-in visitors still see the auth forms) and D2 (sign-up does not carry `next`); and ui-log's manual check 1.3 (the Pager block on `/design`) was never screenshotted.
  - **S-11 `tonight-dashboard`** (#87) is **done**: merged (#94), review fixes merged (#95), deployed, archived (`context/archive/2026-10-04-tonight-dashboard/`). `/tonight` is the sky verdict plus four ruled tiles that open `/tonight/targets` (which replaced `/tonight/all`, now a 301), `/tonight/moon`, `/tonight/planets` and `/tonight/nights`. "Mark observed" returns to the page it came from, and on Targets it reopens "the other N" at the logged row.
  - **S-11 follow-up `interactive-sky`** (#97) is **done**: merged (#98, review fixes included) and archived (`context/archive/2026-10-05-interactive-sky/`); the dashboard's sky is a live horizon panorama (the `TonightSkyView` island) with the real bright stars from HYG v4.1 (`npm run stars:build`), the top five targets, the planets and the Moon, a sunset-to-sunrise slider with the dark window marked and a Now button, and the band's colour following the Sun (`--dusk-*` tokens). A marker opens its row on `/tonight/targets` or `/tonight/planets`, or `/tonight/moon`. Pinned by `tests/e2e/tonight-sky.spec.ts`.
- **Done in M-2:** S-01 planets, S-02 the Moon, S-07 verdict check, S-08 "Use my location", S-10 the Nightfall redesign, S-11 the Tonight dashboard and its interactive sky. Follow-up `compass-labels` (#100, archived `context/archive/2026-10-05-compass-labels/`): compass points are the international 16-wind abbreviations in both languages, never translated (`src/lib/compass.ts`), and the live sky shows a 16-point compass row along its top edge.
- **Unblocked by S-11:** S-05 session timeline (#69) becomes another `/tonight/*` page (and maybe a tile); S-06 offline (#70) caches the dashboard pages. Both still need re-scoping against the dashboard before planning.
- **Still open behind them:** S-03 deep sky beyond Messier (`ready`, #67); S-04 double stars (`blocked`: data source and licence, #68); S-09 map picker (`blocked`: map-tile privacy decision, #73).

## Suggested next step

1. S-05 session timeline (#69): re-scope it as a `/tonight/*` page (and maybe a tile), then plan it through the ordinary chain.
2. Then S-06 (offline dashboard pages), then S-03.

**Hard constraints (all UI work):**

- Colours only from tokens (`no-hardcoded-colors.test.ts`). A new token needs a value in every theme block, and the red theme has zero green and blue (`red-theme.test.ts`).
- WCAG AA contrast in all three themes, with focus visible everywhere.
- EN and PL copy: Polish runs longer, and every string goes through the i18n catalogue.
- Phone first (390 px).
- Coordinates never go into URLs or logs. The site and telescope choice travels as ids (`?site=`, `?telescope=` plus the cookies).
- Tonight's pages are server islands and need JavaScript (lessons.md).

**Also still open:** post-merge checks from moonlight-and-the-verdict (`context/archive/2026-10-02-moonlight-and-the-verdict/follow-ups/review-fixes.md`): bright-Moon screenshots after 2026-10-22, and a Firefox red-mode screenshot of the Moon card slider. The same bright Moon will exercise the `/tonight/all#washed-out` → Targets scroll (its e2e test skips until the Moon washes out an object).

## Things a new session should know

- **How the user works** (also in the auto-memory):
  - Ask only for permissions and UI decisions. Decide non-UI choices yourself and record them as delegated.
  - Send a `PushNotification` before every question.
  - Keep new tests modest ("we've got loads of them already", S-08): pin only what screenshots can't show.
  - Run manual checks yourself (a local preview against local Supabase, plus Playwright screenshots in EN/PL, dark/light/red, phone/desktop) and tick them with evidence.
  - Never commit to `main` or merge without case-by-case approval. Feature-branch pushes and PRs are pre-approved.
  - Mirror progress on GitHub Projects board #1. Check `gh auth status` first; the token needs the `project` scope.
- **Subagents:**
  - Give them the prefix `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null &&`.
  - Check their footprint after about 5 minutes.
  - Forbid git-state changes; the main agent stages and deletes files itself.
- **Local e2e recipe** (CI does the same in `.github/workflows/ci.yml`):
  1. `npx supabase start`.
  2. `FIXTURE_PORT=4400 node tests/e2e/forecast-fixture.mjs &`.
  3. `npm run build`, then write the local `SUPABASE_URL` / `SUPABASE_KEY` (from `npx supabase status -o env`: `API_URL`, `ANON_KEY`) and `FORECAST_BASE_URL=http://127.0.0.1:4400` into **`dist/server/.dev.vars` only**: preview reads that copy, so the repo's `.env` / `.dev.vars` stay untouched (worked on 2026-10-03/04; no backup or restore needed). Every build overwrites the copy, so rewrite it after each rebuild.
  4. `npx astro preview --port 4321`. Astro 7's preview detaches as a daemon; stop it with `npx astro preview stop`. Rebuild after any source change.
  5. `SUPABASE_URL=$API_URL SUPABASE_KEY=$ANON_KEY BASE_URL=http://localhost:4321 npm run test:e2e`. The sky-checks spec seeds a past night through PostgREST, so it needs the Supabase variables.
- **Scratch Playwright scripts** for manual screenshots can live in the scratchpad if they load Playwright with `createRequire(process.cwd() + "/package.json")` and run from the repo root (S-08); scripts that import `@/` modules must sit under `tests/e2e/` to resolve the alias.
- **Background processes stop after 2 hours.** Start the forecast fixture inside the same foreground command as the tests (`node tests/e2e/forecast-fixture.mjs & FIX=$!; …; kill $FIX`) rather than as a long-lived background task.
- **Tonight is a server island**, and so is each `/tonight/*` page. Wait for `[data-sky-headline]` or `section[aria-labelledby="verdict-heading"]` on the dashboard, or the page's own section, before asserting on island content in e2e; a skeleton already renders the title and back link.
- **Port 4321 must be free before `astro preview`.** A leftover `astro dev` on 4321 makes the preview fail to bind, so the e2e run hits the dev server (hosted Supabase) and every sign-up fails; check with `lsof -iTCP:4321 -sTCP:LISTEN`.
- **CI flake:** the `smoke` job's `supabase/setup-cli` sometimes fails with "rate limit exceeded" while resolving the latest CLI. Re-run only the failed job: `gh run rerun <id> --failed`.
- **Hosting:** Workers Paid since 2026-09-30, so the 10 ms CPU cap (#22, closed) no longer applies.
- **Untracked `.mcp.json`:** leave it out of commits (the user's choice).

## Open issues worth knowing

- **#21:** ranking calibration. Items 1, 3 and 4 are open; the sky-check tally is the first real evidence for the verdict thresholds.
- **#19:** Stellarium fixtures. The Moon and planets use Skyfield references instead.
- **#86 (S-10)** closes with the S-10 close-out PR; #87 (S-11) and #97 (interactive sky) are closed. A real VoiceOver pass over the live sky is still with the user (names were checked through Playwright).
- **#67–#70, #73:** the other remaining M-2 slices (see State of play). The board's Stream field has no option for S-10's stream E, so #86 has no Stream value.
