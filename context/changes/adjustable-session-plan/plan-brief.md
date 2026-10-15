# Adjustable Session Plan (M-3 S-08) — Plan Brief

> Full plan: `context/changes/adjustable-session-plan/plan.md`
> Research: `context/changes/adjustable-session-plan/research.md`
> Plan review: `context/changes/adjustable-session-plan/reviews/plan-review.md` (F1–F10 applied)

## What & Why

A full-plan user can reorder, drop and add targets on tonight's Session plan and reset it to the suggested plan. The edits are saved to their account per site and night, so they show on every device and in the stored offline copy (PRD FR-044, US-08). A free account sees what editing does and that it needs the full plan (FR-045). The guardrail holds: no target is ever placed outside its own window.

## Starting Point

- The Session plan is computed on every request and never stored: the Moon, the planets and the ranking's top 5 deep-sky objects, ordered by best time, drawn on `/tonight/plan` (free).
- The repo has the patterns this needs: per-user tables under RLS, a two-layer full-plan gate, and offline copies of Tonight pages.
- Nothing stores plan data yet, and no POST route checks the plan.

## Desired End State

- **Full plan, on a night that passes:** the user opens "Edit plan", moves, removes and adds targets (any object their telescope can reach with a window tonight), and saves.
  - They see a "Plan saved" toast and their order.
  - A muted hint flags a row whose window ends before the previous row's best time.
  - "Edited · Reset to suggested" sits above the plan.
  - The service worker re-stores the clean page at once, so the offline copy is fresh.
  - Another device shows the same plan, and the dashboard tile follows it.
- **A saved target without a window that night** is listed as "Not on tonight's plan" and stays saved until removed.
- **Free plan:** the suggested plan plus one lock line. Every refusal shows as an alert on the page.

## Key Decisions Made (owner, 2026-10-14)

| Decision                     | Choice                                                                                                    | Why (1 sentence)                                     | Source    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------- |
| D1 Stored data               | Whole ordered key list per (user, site, night); reset deletes it                                          | A saved list never shifts under the user             | Owner     |
| D2 Order                     | List position; rows keep their windows; muted hint when a window ends before the previous row's best time | Nothing is scheduled, yet a poor order is visible    | Owner (b) |
| D3 Add pool                  | Every object within the telescope's reach with a window tonight, plus removed planets and the Moon        | Reuses the ranking's own windows                     | Owner     |
| D4 / F4 Key without a window | Muted "Not on tonight's plan" list; stays saved; the route checks only newly added keys                   | Honest, and a save never fails on an old key         | Owner     |
| D5 Nights that do not pass   | Edits and editor only on a passing night                                                                  | Never a confident plan on a clouded-out night        | Owner     |
| D6 Interaction               | Editor island with one Save                                                                               | One POST, keyboard friendly                          | Owner     |
| D7 Save confirmation         | A toast, plus a service-worker message that re-stores the clean page                                      | The offline copy is fresh at once                    | Owner (b) |
| D8 Reset                     | One confirmation dialog                                                                                   | Reset loses the user's work                          | Owner     |
| D9 Nights                    | Tonight only, enforced against `?night=next`                                                              | Before sunset, tonight is the evening ahead          | Owner     |
| D10 Free account             | One muted lock line                                                                                       | Matches what-to-expect                               | Owner     |
| D11 OQ23 plan loss           | Edits kept and back on re-promotion; stored copy replaced at the next online answer                       | The paid part is editing; a stored copy is read-only | Owner     |
| D12 Site deleted             | `on delete cascade`                                                                                       | A plan without its site means nothing                | Owner     |
| D13 Dashboard tile           | Follows the edited plan                                                                                   | The tile is the plan's summary                       | Owner     |
| D14 Failed read              | Suggested plan + muted line; the plan page stores no copy                                                 | Keeps the device's last good copy                    | Owner     |
| D15 UI timing                | Editor waits for ui-quiet-actions to merge; Phases 1–4 run now                                            | Builds on the new action tiers                       | Owner     |
| F7 Row controls              | Move up / Move down / Remove are `quiet`, size `icon` (44 px)                                             | Quiet per-item controls, full touch target           | Owner     |
| F9 Below-bar row link        | Its finder chart with `from=plan`                                                                         | Such objects are not on Targets                      | Owner     |

## Scope

**In scope:**

- `session_plans` table (RLS, site guard), store and schemas;
- `applyPlanEdits` with order hints and the guardrail invariant;
- the full-plan save and reset routes, with smoke steps;
- every plan-island state, `?error=`, the toast;
- the service worker's `store-page` message;
- the editor island, reset dialog and tile;
- `/design`, EN and PL copy, two e2e specs;
- the finder's `from=plan`;
- docs.

**Out of scope:**

- offline editing or sync, other nights, time slots, drag and drop;
- changes to the live sky or the ranking;
- a plan-loss drop, payments, cleanup of old rows.

## Architecture / Approach

- **Night date.** `loadTonight` computes it once (`tonightDateForSite`).
- **Read.** For tonight it calls a plan-gated `readPlanEdits`, and `buildTonight` applies the list through the pure `applyPlanEdits`:
  - a suggested key keeps its row;
  - a reachable deep-sky key gets the ranking's window;
  - anything else becomes "Not on tonight's plan".
- **Layout.** `layoutSessionPlan` keeps the user's order, and `orderHints` flags late windows.
- **Write.** The routes gate first, then check the night and, for newly added keys, the window by the build's own helpers. They upsert or delete and redirect with a toast. The page then asks the worker to re-store the clean URL.

## Phases at a Glance

| Phase                                | What it delivers                                                                                  | Key risk                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Table, store and isolation        | `session_plans` under RLS with a site guard; `needsSite` harness; store, schemas                  | Shared local stack: announced windows and a local down script |
| 2. Applying edits to the night       | `reachable`, `plan-window`, `applyPlanEdits`, `orderHints`, one night date, guardrail invariant   | Changing `rankObjects` without moving the calibration         |
| 3. Routes, gated island, HTTP checks | Gated POSTs, five island states, `?error=`, toast, anchors and finder `from=plan`, smoke plan 1–7 | Date-dependent smoke (decided from the island's state)        |
| 4. Fresh offline copy after a save   | `store-page` message, re-store e2e                                                                | Worker change on the shared commit path                       |
| 5. Editor, reset, dashboard          | Editor island, reset dialog, tile, /design, editing e2e                                           | Waits for the ui-quiet-actions merge                          |
| 6. Docs and rules                    | CLAUDE.md, test-plan §6.4 and §6.5, PRD OQ23                                                      | Rebase over ui-quiet-actions' CLAUDE.md edits                 |

**Prerequisites:**

- local Supabase running (shared: migrate only in announced windows, never reset);
- for Phase 5, ui-quiet-actions merged to main.

**Estimated effort:** ~5-6 sessions across 6 phases.

## Open Risks & Assumptions

- **Smoke and e2e depend on the night passing at the test site.** The steps read `data-session-plan-state` and assert the held state on other nights.
- **Last write wins between devices**, because each Save posts the whole list.
- **Other worktrees' `test:db` fails while `session_plans` exists on the shared stack.** Hence the announced windows and the down script.

## Success Criteria (Summary)

- A full-plan user's edited plan shows in their order on every device and offline, right after saving, and never puts a target outside its window.
- A free account sees the suggested plan and what editing needs, and the server refuses its writes with a visible alert.
- `npm test`, `npm run test:db`, `npm run smoke` and the whole e2e suite are green.
