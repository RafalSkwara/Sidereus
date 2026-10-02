# Handoff — 2026-10-02

Where Sidereus stands, and what the next agent or session should pick up. Read this first, then `context/changes/moonlight-and-the-verdict/plan-brief.md`. (This replaces the 2026-09-25 handoff, which is in git history.)

## State of play

- **Milestone M-2 "First real nights"** is open (`context/foundation/roadmap.md`).
  - S-01 `planets-on-tonight` is done.
  - **S-02 `moon-as-target` is done.** PR #77 is merged and deployed. The Moon is a loggable target on Tonight, with a phase note, eyepieces and a bright-Moon line on the verdict card.
  - **The S-02 archive is waiting on review in PR #78** (branch `chore/archive-s02-moon`). It moves the folder to `context/archive/2026-10-01-moon-as-target/`, closes roadmap S-02 and closes issue #66. The board card for #66 is already done. **The user merges it, never the agent.** Until it merges, `main` still has `context/changes/moon-as-target/` and roadmap S-02 at `in-progress`.
  - Remaining M-2 slices: S-03 deep sky beyond Messier, S-04 doubles (blocked), S-05 timeline, S-06 offline, S-07 verdict check, S-08 "use my location", S-09 map picker (blocked).
- **In flight: off-roadmap change `moonlight-and-the-verdict`** (GitHub #79, board status "planning"), on branch **`feat/moonlight-and-the-verdict`**. The planning artifacts are committed and pushed there. No code has been written yet.

## The change in flight: `moonlight-and-the-verdict`

**What the user wants.** On an 80%-Moon night Tonight says "Go" and still recommends faint galaxies. The user wants the Moon separated out honestly, plus a detailed SVG of the Moon at 1% resolution with a time slider.

**What the frame found** (`frame.md`, HIGH confidence). The verdict is cloud-only by design, but it is worded as a whole-night verdict. The Moon has no visible presence. The ranking's moonlight term ignores faintness and distance from the Moon (#21 item 2). The user chose:
- keep the headline checkable (clouds only);
- "a good night depends on the person";
- an invisible object shown as a good bet "feels like being lied to".

**User decisions, all final:**
- **Layout:** a Sky card and a Moon card side by side at the top (stacked on a phone). The Moon card moves up from the solar-system section.
- **Sky wording:** Clear / Partly clear / Cloudy (PL: Pogodnie / Częściowo pogodnie / Pochmurno). The thresholds stay as they are.
- **Washed-out objects:** hidden from the ranking, counted in a line, and listed as a group on `/tonight/all`.
- **The Moon SVG:**
  - lunar north up (map orientation, not as seen in the sky);
  - exact lit shape at 1% resolution, plus about 12 IAU maria with libration;
  - shows the Moon at page load by default;
  - a slider and button let the user pick any moment within tonight's window.
- **No preference toggle.** It is parked.

**Plan status.** `plan.md` is **revision 2**, with 5 phases.
- Revision 1 was **rejected** by `/10x-plan-review` (`reviews/plan-review-rev1.md`, F1–F9). Run on the real engine, its moon score reversed the full-Moon ranking.
- Revision 2 redesigns the score:
  - Moon-induced sky brightening at each object (Krisciunas–Schaefer 1991), weighted by a per-type sensitivity, on one scale for every object;
  - a separate washed-out rule;
  - every candidate number calibrated with `calibration-harness.md` (results table in `plan.md` › Current State Analysis);
  - all of F3–F9 folded in.
- **Revision 2 has not been re-reviewed.** `change.md` is `planned`.

**Phases:**
1. Honest moonlight in the ranking, including the washed-out count line and the `/tonight/all` group, so the shorter list is never unexplained. Ends with a checkpoint.
2. Moon disc geometry: states computed in the engine, plus a browser-safe `src/lib/moon-disc/` module.
3. Sky wording everywhere, via `skyHeadline(level + reason)`, plus the PRD and roadmap notes and a landing screenshot re-capture.
4. The Moon card: the per-path matrix, removing S-02's bright-Moon line, and planets-only in the solar-system section.
5. The time slider: check that a client island works inside the server island first, with a custom-element fallback.

## Suggested next step

1. ~~`/10x-plan-review moonlight-and-the-verdict`~~ Done 2026-10-02 (`reviews/plan-review.md`): REVISE, all 5 findings fixed in triage, so the plan is SOUND.
2. Then `/10x-implement moonlight-and-the-verdict phase 1` on `feat/moonlight-and-the-verdict`. On entry, flip #79 on the board to "in-progress". It is off-roadmap, so the roadmap is not touched.

## Things a new session should know

- **How the user works** (also in the auto-memory):
  - Ask only for permissions and UI decisions. Decide non-UI choices yourself and record them as delegated.
  - Send a `PushNotification` before every question.
  - Run manual checks yourself (local preview against local Supabase plus Playwright screenshots in EN/PL, dark/light/red, phone/desktop) and tick them with evidence.
  - Never commit to `main` or merge without case-by-case approval. Feature-branch pushes and PRs are pre-approved.
  - Mirror progress on GitHub Projects board #1. Check `gh auth status` first; the token needs the `project` scope.
- **Subagents:**
  - Give them the prefix `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null &&`.
  - Check their footprint after about 5 minutes.
  - Forbid git-state changes; the main agent stages and deletes files itself.
- **Local e2e recipe** (CI does the same in `.github/workflows` lines 51–70):
  1. `npx supabase start`.
  2. `FIXTURE_PORT=4400 node tests/e2e/forecast-fixture.mjs &`.
  3. **Back up `.dev.vars` and `.env` first.** Then write local `SUPABASE_URL`/`SUPABASE_KEY` (from `npx supabase status -o env`: `API_URL`, `ANON_KEY`) and `FORECAST_BASE_URL=http://127.0.0.1:4400` into `.dev.vars`.
  4. `npm run build && npm run preview -- --port 4321 &`.
  5. `BASE_URL=http://localhost:4321 npm run test:e2e`.
  6. Restore `.dev.vars` afterwards. **Writing `.env` from a shell command was refused last session, so write only `.dev.vars`.** The build copies it into `dist/`. If `.env` must change, ask the user to run the copy themselves with `! cp …`.
- **Tonight is a server island.** Wait for `section[aria-labelledby="verdict-heading"]` before counting cards in e2e. A Moon spec skipped every run until it did (fixed in S-02).
- **CI flake:** the `smoke` job's `supabase/setup-cli` sometimes fails with "rate limit exceeded" while resolving the latest CLI. Re-run only the failed job: `gh run rerun <id> --failed`.
- **Hosting:** Workers Paid since 2026-09-30, so the 10 ms CPU cap (#22) no longer applies.
- **Untracked `.mcp.json`:** leave it out of commits (the user's choice).

## Open issues worth knowing

- **#79:** this change.
- **#21:** ranking calibration. Item 2 is addressed by #79; items 1, 3 and 4 stay open.
- **#19:** Stellarium fixtures. The Moon and planets use Skyfield references instead.
- **#22:** CPU watch. Moot on Workers Paid.
