# Handoff — 2026-10-04 (evening)

Where Sidereus stands, and what the next agent or session should pick up. Read this first, then `context/foundation/roadmap.md` (S-10 and S-11) and GitHub #86 / #87. The last change is archived at `context/archive/2026-10-03-site-use-my-location/`. (This replaces the earlier 2026-10-04 handoff, which is in git history.)

## State of play

- **Milestone M-2 "First real nights"** is open. On 2026-10-04 the user added two slices that come **ahead of everything else** ("Both are more important than anything else"):
  - **S-10 `visual-redesign`** (#86, `ready`): the light and dark themes look "very generic and … very much like coming from an LLM". The goal is a distinct, deliberate visual identity on every screen; the red night mode keeps its function.
  - **S-11 `tonight-dashboard`** (#87, `ready`): `/tonight` is "super crowded … really difficult to find anything". A signed-in user should land on a dashboard of tiles (verdict, Moon, planets, deep-sky targets, forecast, sky check, "maybe even more or separated differently"), each opening its own focused page.
  - Both are labelled `priority:top` and pinned to the top of board #1 (#86 first).
- **Done in M-2:** S-01 planets, S-02 the Moon, S-07 verdict check, S-08 "Use my location" (PR #84; archive PR #85 merged).
- **Re-scoped on 2026-10-04:** S-05 session timeline (#69) is now a page reached from the dashboard, waits for S-11 and went back to `proposed`. S-06 offline (#70) caches the dashboard pages and waits for S-05 and S-11.
- **Still open behind them:** S-03 deep sky beyond Messier (`ready`, #67); S-04 double stars (`blocked`: data source and licence, #68); S-09 map picker (`blocked`: map-tile privacy decision, #73).
- **No change is in flight.** `context/changes/` is empty and `main` is clean, apart from the user's untracked `.mcp.json`.

## Suggested next step: S-10, starting with the direction

The user hasn't decided the order of S-10 and S-11 yet (roadmap Open Roadmap Question 4). The recommendation written into the roadmap and both issues:

1. **S-10 first: direction, then contract.**
   - Open the change with `/10x-new visual-redesign`.
   - Before any code, present **2–3 concrete design directions**. For each, give the mood, palette (light, dark and the red-mode adaptation), type pairing, and one key screen mocked up (Tonight or the future dashboard). Artifact pages or Playwright-rendered mockups work well, and the `frontend-design` skill is the guidance for distinctive, non-template choices.
   - The user picks one. This is a UI decision, so ask it natively and send a push first.
   - Then run `/10x-ui visual-redesign`. It works on **one existing view at a time**: audit → 3–5 charges → fix the design-system contract (tokens in `src/styles/global.css`, shared components in `src/components/ui/`, forms, top bar, tab bar) → 7-state matrix → screenshot gate → a rule in CLAUDE.md or lessons.md. Use a representative, stable view for the first pass (for example `/gear` or the landing page). Don't use Tonight, which S-11 is about to split.
2. **S-11 next, built on the new contract.** These are new pages, so they go through the ordinary chain: `/10x-new tonight-dashboard` → `/10x-research` → `/10x-plan` → `/10x-implement`. The user decides the tile set, the tile order, and whether the dashboard takes the `/tonight` address. `/dashboard` currently just redirects to `/tonight`. Reuse `VerdictCard`, `MoonCard`, `SolarSystemSection`, `ObjectCard`, `NightStrip` and `SkyCheckCard`, which all live in `src/components/tonight/`.
3. **Then restyle the remaining screens** with `/10x-ui`, one view per pass, and continue with S-05 → S-06, S-03.

**Hard constraints for both slices:**
- Colours only from tokens (`no-hardcoded-colors.test.ts`). A new token needs a value in every theme block, and the red theme has zero green and blue (`red-theme.test.ts`).
- WCAG AA contrast in all three themes, with focus visible everywhere.
- EN and PL copy: Polish runs longer, and every string goes through the i18n catalogue.
- Phone first (390 px).
- Coordinates never go into URLs or logs. The site and telescope choice travels as ids (`?site=`, `?telescope=` plus the cookies).
- Tonight's content currently needs JavaScript (server island; see lessons.md), so each new page must decide its own loading behaviour.

**Also still open:** post-merge checks from moonlight-and-the-verdict (`context/archive/2026-10-02-moonlight-and-the-verdict/follow-ups/review-fixes.md`): bright-Moon screenshots after 2026-10-22, and a Firefox red-mode screenshot of the Moon card slider.

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
- **Tonight is a server island.** Wait for `[data-sky-headline]` or `section[aria-labelledby="verdict-heading"]` before asserting on its content in e2e.
- **CI flake:** the `smoke` job's `supabase/setup-cli` sometimes fails with "rate limit exceeded" while resolving the latest CLI. Re-run only the failed job: `gh run rerun <id> --failed`.
- **Hosting:** Workers Paid since 2026-09-30, so the 10 ms CPU cap (#22, closed) no longer applies.
- **Untracked `.mcp.json`:** leave it out of commits (the user's choice).

## Open issues worth knowing

- **#21:** ranking calibration. Items 1, 3 and 4 are open; the sky-check tally is the first real evidence for the verdict thresholds.
- **#19:** Stellarium fixtures. The Moon and planets use Skyfield references instead.
- **#86, #87:** the two top-priority slices (S-10, S-11), labelled `priority:top`.
- **#67–#70, #73:** the other remaining M-2 slices (see State of play). The board's Stream field has no option for S-10's stream E, so #86 has no Stream value.
