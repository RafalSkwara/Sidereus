# Adjustable Session Plan (M-3 S-08) — Plan Brief

> Full plan: `context/changes/adjustable-session-plan/plan.md`
> Research: `context/changes/adjustable-session-plan/research.md`

## What & Why

A full-plan user can reorder, drop and add targets on tonight's Session plan and reset it to the suggested plan. The edits are saved to their account per site and night, so they show on every device and in the stored offline copy (PRD FR-044, US-08). A free account sees what editing does and that it needs the full plan (FR-045). The guardrail holds: no target is ever placed outside its own window.

## Starting Point

- The Session plan is computed on every request and never stored: the Moon, the planets and the ranking's top 5 deep-sky objects, ordered by best time, drawn on `/tonight/plan` (free).
- The repo has the patterns this needs: per-user tables under RLS, a two-layer full-plan gate, and offline copies of Tonight pages.
- Nothing stores plan data, and no POST route checks the plan yet.

## Desired End State

- **Full plan, on a night that passes:** the user opens "Edit plan", moves rows, removes rows, adds any object their telescope can reach with a window tonight, and saves. They land on a clean `/tonight/plan` showing their order, marked "Edited · Reset to suggested". It looks the same on another device and offline. The dashboard tile follows it.
- **A saved target without a window that night** is listed as "Not on tonight's plan", never drawn.
- **Free plan:** the suggested plan plus one lock line.
- **The server refuses free accounts** on both routes and in the island.

## Key Decisions Made (recommendations; the owner answers after plan review)

| Decision                      | Choice                                                                                             | Why (1 sentence)                                                       | Source   |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| D1 Stored data                | Whole ordered key list per (user, site, night); reset deletes it                                   | Simplest model; a saved list never shifts under the user               | Plan     |
| D2 Order                      | List position only; rows keep their own windows                                                    | Nothing is "scheduled", so the guardrail cannot be broken by a reorder | Plan     |
| D3 Add pool                   | Every object within the telescope's reach with a window tonight, plus removed planets and the Moon | Reuses the ranking's own windows; no second window rule                | Research |
| D4 Saved key without a window | Muted "Not on tonight's plan" list                                                                 | Honest, and the user can remove it                                     | Plan     |
| D5 Nights that do not pass    | Edits and editor only when the night passes; one line otherwise                                    | Never a confident plan on a clouded-out night                          | Plan     |
| D6 Interaction                | Editor island: move up/down, remove, add, one Save                                                 | One POST, keyboard friendly; JS is required on Tonight anyway          | Research |
| D7 Save confirmation          | No toast; clean redirect stored at once                                                            | A toast param would keep the copy stale offline                        | Research |
| D8 Reset                      | One confirmation dialog                                                                            | Reset loses the user's work                                            | Plan     |
| D9 Nights                     | Tonight only                                                                                       | Before sunset, tonight is the evening ahead                            | Plan     |
| D10 Free account              | One muted lock line                                                                                | Matches what-to-expect's locked line                                   | Research |
| D11 OQ23 plan loss            | Edits kept in the DB and back on re-promotion; stored copy replaced at the next online answer      | No worker change, no data loss                                         | Research |
| D12 Site deleted              | `on delete cascade`                                                                                | A plan without its site means nothing                                  | Plan     |
| D13 Dashboard tile            | Follows the edited plan                                                                            | The tile is the plan's summary                                         | Plan     |
| D14 Failed read               | Suggested plan + muted line, no offline copy stored                                                | Keeps the device's last good copy                                      | Plan     |
| D15 UI timing                 | Phase 4 waits for ui-quiet-actions to merge                                                        | Builds on the new action tiers, no double migration                    | Plan     |

## Scope

**In scope:**

- `session_plans` table (RLS, site guard), store and schemas;
- the pure `applyPlanEdits` rule, with invariant tests;
- the full-plan save and reset routes, with smoke steps;
- the plan page states, the editor island, the reset dialog, the dashboard tile;
- `/design`, EN and PL copy, an e2e spec;
- docs: CLAUDE.md, test-plan §6.4, PRD OQ23.

**Out of scope:**

- offline editing or sync, other nights, time slots, drag and drop;
- changes to the live sky or Targets;
- a worker change for plan loss, payments, cleanup of old rows.

## Architecture / Approach

- **Read.** The island checks the plan, reads the one saved list for (site, night) after `loadTonight` has resolved the site and the night, and applies it inside `buildTonight` through the pure `applyPlanEdits`:
  - a suggested key keeps its row;
  - a reachable deep-sky key gets its row from the ranking's windows;
  - anything else becomes "Not on tonight's plan".
- **Layout.** `layoutSessionPlan` keeps the user's order. `nextUp` follows it.
- **Write.** The save and reset routes gate first, then check the night and each key's astronomical window, then upsert or delete, and redirect to the clean page, which the service worker stores as usual.

## Phases at a Glance

| Phase                              | What it delivers                                                                                | Key risk                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1. Table, store and isolation      | `session_plans` under RLS with a site guard; harness `needsSite`; store, schemas                | Harness extension touching every table's suite        |
| 2. Applying edits to the night     | `reachable` from the ranking, `applyPlanEdits`, layout order, build wiring, guardrail invariant | Changing `rankObjects` without moving the calibration |
| 3. Full-plan save and reset routes | Gated POST routes, window check, smoke plan 1–7                                                 | Date-dependent smoke on nights that do not pass       |
| 4. Plan page, editor and dashboard | Four island states, editor, reset dialog, tile, /design, e2e                                    | Depends on the ui-quiet-actions merge; offline e2e    |
| 5. Docs and rules                  | CLAUDE.md, test-plan §6.4, PRD OQ23                                                             | —                                                     |

**Prerequisites:**

- the owner's answers to D1–D15;
- `/10x-plan-review`;
- for Phase 4, ui-quiet-actions merged to main;
- local Supabase running (shared, never reset).

**Estimated effort:** ~4-5 sessions across 5 phases.

## Open Risks & Assumptions

- **The POST-redirect store on device A is inferred from `sw.ts`**, not yet exercised; Phase 4's offline e2e proves it.
- **Smoke and e2e depend on the night passing at the test site;** the steps fall back to the held state on such nights.
- **Last write wins between devices**, because each Save posts the whole list. This is acceptable for one person's plan.
- **ui-quiet-actions' tier names may still change** before it merges. Phase 4 rebases first.

## Success Criteria (Summary)

- A full-plan user's edited plan shows in their order on every device and offline, and never puts a target outside its window.
- A free account sees the suggested plan and what editing needs, and the server refuses its writes.
- `npm test`, `npm run test:db`, `npm run smoke` and the whole e2e suite are green.
