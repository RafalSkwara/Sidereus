# Handoff — 2026-10-03

Where Sidereus stands, and what the next agent or session should pick up. Read this first. The last change is archived at `context/archive/2026-10-03-verdict-check/`. (This replaces the 2026-10-02 handoff, which is in git history.)

## State of play

- **Milestone M-2 "First real nights"** is open (`context/foundation/roadmap.md`).
  - Done:
    - S-01 planets on Tonight;
    - S-02 the Moon as a target;
    - S-07 verdict check (PR #82, merged 2026-10-03).
  - Also shipped: the off-roadmap change moonlight-and-the-verdict (#79, closed).
  - Remaining slices:
    - **S-03** deep sky beyond Messier: `ready`, #67;
    - **S-05** session-plan timeline: `ready`, #69;
    - **S-08** "Use my location": `ready`, #72, the smallest win;
    - **S-06** offline night plan: `proposed`, #70, waits on S-05;
    - **S-04** double stars: `blocked` until the user decides the data source and licence, #68;
    - **S-09** map picker: `blocked` until the user decides about map-tile privacy, #73.
- **No change is in flight.** `context/changes/` is empty once the S-07 archive PR merges.

## What S-07 shipped (verdict-check)

- **Recording.** Each signed-in Tonight view stores the night's sky headline per (user, site, night) in `sky_checks`.
  - It goes through the `record_sky_verdict` RPC, called fire and forget after the response.
  - This is the app's only database write from a GET.
  - The headline is overwritten only before the dark window starts, and never after an answer.
- **Asking.**
  - A card on Tonight asks about the newest unanswered night of the last two (with Skip).
  - `/log/sky`, linked from the log, lists every night whose dark window has started, with the tally: matched, too optimistic / too pessimistic, and per sky word.
- **Recording started with the 2026-10-03 deploy**, so the tally is empty until the user answers a few nights.
- **Follow-ups:**
  - impl review F5: a first view at 3 a.m. still counts. `shown_at` and `dark_start` are both stored, so late records can be told apart once the tally feeds calibration (#21, PRD tunable #2);
  - #71 closes when the archive PR merges.

## Suggested next step

1. Merge the S-07 archive PR (branch `chore/archive-verdict-check`). The user merges it, never the agent.
2. Pick the next M-2 slice. Candidates: **S-08** (small, reuses onboarding's locate and rounding; extract one shared picker), **S-05** (presentation over data Tonight already computes; unblocks S-06), or **S-03** (catalogue work; re-check ranks against seasonal lists).
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
  3. **Back up `.dev.vars` and `.env` first** (to the scratchpad). Then write the local `SUPABASE_URL` / `SUPABASE_KEY` (from `npx supabase status -o env`: `API_URL`, `ANON_KEY`) and `FORECAST_BASE_URL=http://127.0.0.1:4400` into both. Writing both worked on 2026-10-03.
  4. `npm run build && npx astro preview --port 4321`. Astro 7's preview detaches as a daemon; stop it with `npx astro preview stop`. Rebuild after any source change.
  5. `SUPABASE_URL=$API_URL SUPABASE_KEY=$ANON_KEY BASE_URL=http://localhost:4321 npm run test:e2e`. The sky-checks spec seeds a past night through PostgREST, so it needs the Supabase variables.
  6. Restore `.dev.vars` and `.env` from the backups and check them with `cmp`.
- **Scratch Playwright scripts** for manual screenshots must sit under `tests/e2e/` to resolve the `@/` alias. Move them out to the scratchpad afterwards: an `rm` inside the repo was refused this session.
- **Tonight is a server island.** Wait for `[data-sky-headline]` or `section[aria-labelledby="verdict-heading"]` before asserting on its content in e2e.
- **CI flake:** the `smoke` job's `supabase/setup-cli` sometimes fails with "rate limit exceeded" while resolving the latest CLI. Re-run only the failed job: `gh run rerun <id> --failed`.
- **Hosting:** Workers Paid since 2026-09-30, so the 10 ms CPU cap (#22, closed) no longer applies.
- **Untracked `.mcp.json`:** leave it out of commits (the user's choice).

## Open issues worth knowing

- **#21:** ranking calibration. Items 1, 3 and 4 are open; the sky-check tally is the first real evidence for the verdict thresholds.
- **#19:** Stellarium fixtures. The Moon and planets use Skyfield references instead.
- **#67–#73:** the remaining M-2 slices (see State of play).
