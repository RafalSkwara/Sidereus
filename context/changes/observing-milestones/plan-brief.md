# Observing milestones (M-3 S-06) — Plan Brief

> Full plan: `context/changes/observing-milestones/plan.md`
> Research: `context/changes/observing-milestones/research.md`

## What & Why

A beginner should feel their progress: when a saved log entry reaches a milestone from a fixed, named set, the app celebrates it once, and the progress page lists every milestone reached (PRD FR-041, US-06). The risk the roadmap names is that the celebration appears exactly once, at save, and never for an entry rated 1-2.

## Starting Point

S-05 shipped a pure progress model, `observingProgress(entries)`. It holds both checklists, with each object's type and first night, and the planet and Moon firsts. It is built from the one seen rule (rated ≥ 3) and the one exact read, `listSeenEntries`. Save notices travel as fixed query params that toasts clear and offline storage refuses.

## Desired End State

- **At save:** an entry rated 3 or above that completes a milestone shows a toast on the page the save returns to. It carries an Award icon, "Milestone reached: <names>" and a link to `/log/progress`. The toast doesn't come back on reload and is never stored offline.
- **Rating 1-2:** never celebrates.
- **On `/log/progress`:** the page opens with a Milestones band. Reached milestones show their night; the rest are muted, with progress for count milestones.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Milestone set | 11: first Moon, first planet, all planets, first galaxy, first globular, first nebula (6 nebula types), 10/25/50/110 Messier, all 61 Caldwell | The PRD candidate list; "Moon's terminator" isn't derivable, so it becomes "first Moon". | Plan (default, **pending owner**) |
| Lifetime | Derived from the log like S-05's counts: deleting the reaching entry un-reaches it, and reaching it again celebrates again | No table and one rule with S-05. **This departs from US-06's "shown once… stays listed"** (review F1). | Plan (default, **pending owner**) |
| Celebration | The existing toast pattern: Award icon, names, link to progress | One notice pipeline (cleared on show, never stored offline). | Plan (default, **pending owner**) |
| Progress band | First on the page; all 11 shown; not-yet rows muted with "x / N" | It shows what's next, matching the Firsts band's rows. | Plan (default, **pending owner**) |
| What counts as "reached by this save" | `newlyReached(before, after)` over `milestonesOf(observingProgress(listSeenEntries))`, read around the write | One rule end to end; a 1-2 rating makes an empty diff by construction. | Plan (delegated) |
| 1-2 guard | Also a short-circuit: no milestone reads when the rating is < 3 | An explicit, testable guard that saves two reads. | Plan (delegated) |
| Failure handling | A failed milestone read skips the celebration and never fails the save | The save is what matters, and the celebration is extra. | Plan (delegated) |
| Transport | `milestone` param repeated per key, from the fixed set only; added to `TOAST_PARAMS` and `NOTICE_PARAMS` | Shows once (cleared via `replaceState`), never replayed from offline copies, never carries a value. | Plan (delegated), research |
| Render site | `MilestoneToast` in `GearShell`, signed in only | The shell of every save-return page; never on signed-out pages or for a crafted link. | Plan (delegated), review F3 |
| Read failure trace | One fixed line plus `error.name`, an allowlisted `no-console` disable | The loss is permanent, so it must leave a trace without values (the `build.ts` precedent). | Plan (delegated), review F4 |
| One toast or two | Two stacked (save + milestone), never overlapping at first paint | The reviewer's recommendation; the user sees both outcomes. | Plan (default, **pending owner**, review F5) |
| Interview | The agent answered the plan skill's questions with its own recommendations | The owner is away; the run's rules say so. | Plan (delegated) |

## Scope

**In scope:**
- `src/lib/progress/milestones.ts` (pure) and `src/lib/observations/celebrate.ts` (the I/O helper with a `read` seam), both tested;
- both save routes, plus `withMilestones` in `redirect.ts`;
- the param in `TOAST_PARAMS` and `NOTICE_PARAMS`;
- `MilestoneToast` in the layout and `MilestoneList` on `/log/progress`;
- EN and PL copy, `/design` specimens, an e2e spec and a CLAUDE.md note.

**Out of scope:**
- a stored milestone table (unless the owner chooses it);
- a celebration on delete;
- sharing, badges or points;
- push or email;
- any change to the seen rule, the ranking or the S-05 checklists;
- offline storage of `/log/progress`.

## Architecture / Approach

1. A save route checks the rating.
2. If it is ≥ 3, the route reads the seen entries, writes, and reads them again. Each read goes through `observingProgress` and then `milestonesOf`.
3. `newlyReached` diffs the two results; the route appends `&milestone=<key>…` to its usual redirect.
4. `GearShell` (signed in only) validates the keys and renders `MilestoneToast` under the save's own toast, stacked from first paint. `ToastRegion` clears the param on show, and the service worker never stores a URL that carries it.

`/log/progress` reuses the `progress` it already computes and adds `milestonesOf(progress)` as its first band.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. The milestone model | `MILESTONES`, `milestonesOf`, `newlyReached`, test-first | Reached-night derivation for count milestones (the N-th earliest first night) |
| 2. The celebration at save | Routes, `celebrate.ts`, the param in toast and offline lists, `MilestoneToast`, e2e | Showing exactly once: reload, offline copies, repeat saves |
| 3. Milestones on the progress page | `MilestoneList` band, e2e, CLAUDE.md | PL copy at 320 px; red-mode distinction |

**Prerequisites:**
- The owner's answers to the four pending decisions (written in Polish in the plan), or acceptance of the defaults.
- `npm ci` and a worktree env built from local Supabase; preview port 4333; fixture port 4400 (shared).

**Estimated effort:** about 2 sessions across 3 phases.

## Open Risks & Assumptions

- If the owner wants milestones to persist after deletion, Phase 1 gains a table, migration, RLS, a `TABLES` entry and a db test. This is a structural change to the plan.
- Two near-simultaneous saves could both celebrate the same milestone. This is accepted as rare.
- A save that returns to a page not using `GearShell` (none today) would lose the toast.
- The derived lifetime departs from US-06's "stays listed" (review F1, owner decision 2). A stored table would add a phase with a migration and db tests.
- A keyboard user may reach the toast's link only after its 10 s timer; `/log/progress` is the lasting record.

## Success Criteria (Summary)

- An entry rated 1-2 never celebrates. An entry rated 3 or above that completes a milestone celebrates once, on the page the save returns to, and not on reload or offline.
- `/log/progress` lists every reached milestone with its night, and shows progress toward the rest, in EN and PL and all three themes, at phone width.
