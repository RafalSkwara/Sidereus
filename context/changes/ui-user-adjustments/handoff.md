# Handoff — S-02 ui-user-adjustments (2026-10-08, Phase 1 of 6 done and reviewed)

Read this first, then `plan-brief.md` in this folder. **Do not redo research, planning or the plan review**: all three are committed. The user's list is verbatim in `change.md`.

## State of play

- **Change**: M-3 S-02 "The user's UI adjustments", GitHub #123. Roadmap and board (#1) are `in-progress`.
- **Branch**: `feat/ui-user-adjustments`, rebased onto `main` 45372a4 on 2026-10-08 and force-pushed. A draft PR to `main` carries it; see the PR list.
- **Worktree**: the branch lives in the git worktree `sidereus/.claude/worktrees/ui-user-adjustments`. The main checkout (`sidereus/`) belongs to the parallel test-plan stream (Phase 3 `testing-ranking-invariants-and-calibration-oracle`), so never switch branches there. Run every command from the worktree. If it was cleaned up, recreate it with `git worktree add .claude/worktrees/ui-user-adjustments feat/ui-user-adjustments` from `sidereus/`, then run `npm ci` and copy `.dev.vars`.
- **Done:**
  - `research.md`.
  - `plan.md` and `plan-brief.md`: 6 phases.
  - Plan review: `reviews/plan-review.md`, 10 findings, all applied.
  - **Phase 1**: clickable affordance and quieter subpage stars. Commit `d319ffc`; the Progress rows carry that SHA.
  - Phase 1 impl review: `reviews/impl-review-phase-1.md`, 6 findings, all fixed in `38c73e6`, listed in `follow-ups/review-fixes.md`.
- **`change.md` status**: `impl_reviewed` (the Phase 1 review). Set it back to `implementing` when Phase 2 starts; `/10x-implement` flips only from `planned` / `plan_reviewed`.
- **Next**: Phase 2 "Notifications as toasts". Then Phases 3 (sky band), 4 (gear cards), 5 (spacing) and 6 (Session plan curves). The landing PNG is recaptured in Phase 6.

## The user's decisions (do not re-ask)

| Topic                                | Decision                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Second "Tonight/targets" in the list | Means /tonight/nights                                                                                         |
| Session plan                         | Option B: text line "Best 22:40 · window 21:40–23:10 · SW, 45°" plus an altitude curve per row, with a legend |
| Gear cards                           | A select for 2+ items (pills retired); name plus "Manage sites/telescopes" for 1                              |
| Phone fold                           | Accept the new fold: verdict and cards; the first target may need a scroll (relax `tonight-phone.spec.ts`)    |
| Clickables                           | "border + bg + icon when possible and also (apart from red theme) color"; inline links underlined             |
| Slider                               | Exact dark-window times under the dark span's edges; short zone ("CEST") muted after the current time         |
| Review triage                        | "Apply all recommended fixes" (plan review and Phase 1 impl review)                                           |

Delegated decisions are in `plan-brief.md` › Key Decisions:

- Errors stay inline.
- The URL param is cleaned with `replaceState`.
- The toast region lives in `Layout`.
- The verdict uses `text-display`.
- The compass marker.
- `quiet` stars.
- The `-mt-16` overlap.

## How the user wants the run

- Delegate each phase to a Sonnet subagent with high effort. Keep the gates, the break check, screenshots, commits and Progress in the main session. Reviews run on Opus.
- Don't ask approval for commits. Run the manual checks yourself with screenshots (dark/light/red, 390 and 1280 px, EN and PL where copy changes) and tick them with that evidence.
- After each phase the user may ask for `/10x-impl-review`. Last time they chose to apply all recommended fixes.
- Feature-branch pushes and the PR are pre-approved. Never merge or push to `main`.

## Local environment (this worktree)

- **Node**: `export PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH`. Worktree subagents can't source `nvm.sh`.
- **Lint**: `NODE_OPTIONS=--max-old-space-size=6144 npx eslint . --ignore-pattern '.claude/**'`. There are 3 known warnings.
- **Ports**: preview **4331**, forecast fixture **4410**. Never use 4321 or 4400, which the other stream uses.
- **E2E recipe** (also in `plan.md` › Implementation Approach):
  1. `npx supabase status` (Docker must be running).
  2. `FIXTURE_PORT=4410 node tests/e2e/forecast-fixture.mjs` as a background task.
  3. `npm run build`.
  4. Patch **`dist/server/.dev.vars` only**: `SUPABASE_URL` and `SUPABASE_KEY` from `npx supabase status -o env` (`API_URL`, `ANON_KEY`), plus `FORECAST_BASE_URL=http://127.0.0.1:4410`.
  5. `ASTRO_PREVIEW_BACKGROUND=0 npx astro preview --port 4331 --ignore-lock` as a background task.
  6. `BASE_URL=http://localhost:4331 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test <specs>`.
- **Restart the preview after every rebuild.** A running preview keeps the old build's asset names and answers 500 for the new ones. Stop it with `kill $(lsof -tiTCP:4331 -sTCP:LISTEN)`.
- **Screenshot specs** that use `tests/e2e/helpers` (`onboardInMadrid`) must sit under `tests/e2e/` while running. Delete them before staging.
- **E2E**: two specs skip on nights without the condition (Moon as a target, the washed-out group). That is expected.

## Phase 1 facts the next phases rely on

- **`buttonVariants`** (`src/components/ui/button.tsx`):
  - `action` = border + `bg-action-surface` + link colour + wraps. Always use it with `size: "sm"`.
  - Hover moves the border to `primary-strong` and underlines.
  - `link` is underlined at rest.
  - `sm` uses the `text-label` role.
  - `RESTING_BORDER_CLASS` is exported for ghost buttons that need a border.
- **Tokens**: `--action-surface` / `--action-border` in dark, light, red and light `.night-sky`, with contrast rows. The night horizon margin is thin (3.08).
- **Offline styling**: the dashed-border rule covers `a` as well as `button`.
- **`TonightSky quiet`** dims the stars; it is passed only by `TonightPageSky` and `TonightPageSkeleton`.
- **Spacing**: `BackLink` owns its bottom gap (`mb-2 sm:mb-3`). `TILE_CUE_CLASS` is in `tile.ts`.
- **Concurrent stream**: `src/pages/log/new.astro` has no diff against `main`; the test stream changed it in #136.

## Next steps

```
cd ~/projects/sidereus/.claude/worktrees/ui-user-adjustments && git pull
# set change.md status back to implementing, then:
/10x-implement ui-user-adjustments phase 2
```

Before merging the PR, merge or rebase onto `main` again. The test stream keeps landing commits, mostly under `context/` and `src/lib/**` tests.
