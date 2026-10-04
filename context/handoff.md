# Handoff — 2026-10-04

Where Sidereus stands, and what the next agent or session should pick up. Read this first. The last change is archived at `context/archive/2026-10-03-site-use-my-location/`. (This replaces the 2026-10-03 handoff, which is in git history.)

## State of play

- **Milestone M-2 "First real nights"** is open (`context/foundation/roadmap.md`).
  - Done:
    - S-01 planets on Tonight;
    - S-02 the Moon as a target;
    - S-07 verdict check (PR #82);
    - S-08 "Use my location" on the site form (PR #84, merged 2026-10-04).
  - Also shipped: the off-roadmap change moonlight-and-the-verdict (#79, closed).
  - Remaining slices:
    - **S-03** deep sky beyond Messier: `ready`, #67;
    - **S-05** session-plan timeline: `ready`, #69;
    - **S-06** offline night plan: `proposed`, #70, waits on S-05;
    - **S-04** double stars: `blocked` until the user decides the data source and licence, #68;
    - **S-09** map picker: `blocked` until the user decides about map-tile privacy, #73. Its S-08 prerequisite is now met: the map joins the shared `LocationPicker`.
- **No change is in flight.** `context/changes/` is empty once the S-08 archive PR merges.

## What S-08 shipped (site-use-my-location)

- **Shared picker.** `src/components/location/LocationPicker.tsx` ("Use my location", place search, confirmation line) is used by onboarding and the add/edit site form; the host keeps the coordinate fields and validation.
  - `locateDevice` (`src/lib/location/locate.ts`) asks only on the click and rounds to about 1 km before returning; `geocode.ts` moved to `src/lib/location/` and returns the bare place `name`.
  - Picker copy lives in the top-level `location` i18n namespace.
- **Site form.** A Location block above always-visible latitude/longitude fields; a picked town fills an empty Name; on edit, "Was … · Undo" restores the saved location until Save, and the automatic zone label reads "Automatic (from coordinates)" once the coordinates move.
- **Lint.** `no-console` now also covers `src/lib/location/**`, `src/components/location/**` and `src/components/gear/**`.
- **User preference recorded during S-08:** keep new tests modest ("we've got loads of them already"): pin only what screenshots can't show.
- #72 closes when the archive PR merges.

## Suggested next step

1. Merge the S-08 archive PR (branch `chore/archive-site-use-my-location`). The user merges it, never the agent.
2. Pick the next M-2 slice: **S-05** (presentation over data Tonight already computes; unblocks S-06) or **S-03** (catalogue work; re-check ranks against seasonal lists). S-09 needs the user's map-tile privacy decision first.
3. Post-merge checks still open from moonlight-and-the-verdict (`context/archive/2026-10-02-moonlight-and-the-verdict/follow-ups/review-fixes.md`): bright-Moon screenshots after 2026-10-22, and a Firefox red-mode screenshot of the Moon card slider.

## Things a new session should know

- **How the user works** (also in the auto-memory):
  - Ask only for permissions and UI decisions. Decide non-UI choices yourself and record them as delegated.
  - Send a `PushNotification` before every question.
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
- **#67–#73:** the remaining M-2 slices (see State of play).
