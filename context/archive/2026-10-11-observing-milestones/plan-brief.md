# Observing milestones (M-3 S-06) — Plan Brief

> Full plan: `context/changes/observing-milestones/plan.md`
> Research: `context/changes/observing-milestones/research.md`

## What & Why

A beginner should feel their progress. When a saved log entry reaches a milestone from a fixed, named set, the app celebrates it exactly once, and the progress page lists every milestone reached, forever (PRD FR-041, US-06). The risk the roadmap names: the celebration appears once, at save, and never for an entry rated 1-2.

## Starting Point

S-05 shipped a pure progress model, `observingProgress(entries)`. It holds both checklists, with each object's type and first night, and the planet and Moon firsts. It is built from one seen rule (rated ≥ 3) and one exact read, `listSeenEntries`. Save notices travel as fixed query params, which offline storage refuses.

## Desired End State

- **Stored once:** each reached milestone is stored once per user, in `observing_milestones`, with its night. Deleting or re-rating the entry that reached it changes nothing.
- **At save:** an entry rated 3 or above that reaches a milestone not yet stored gets a celebration bigger than a toast, in the variant the owner picks from three. It names the milestones and links to `/log/progress`.
  - It never comes back on reload, offline, or after re-reaching.
  - A rating of 1-2 never celebrates.
- **On `/log/progress`:** the page opens with a Milestones band listing all 11. Reached ones show their night; the rest are muted, with progress for the count milestones.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Milestone set | 11: first Moon, first planet, all planets, first galaxy, first globular, first nebula (6 nebula types), 10/25/50/110 Messier, all 61 Caldwell | The PRD candidate list; "Moon's terminator" isn't derivable, so it becomes "first Moon". | Owner, 2026-10-13 |
| Lifetime | Stored in `observing_milestones` (RLS, four policies, `TABLES`), unique per (user, key) | US-06 says a milestone is shown once and stays listed. | Owner, 2026-10-13 (review F1) |
| Celebration | Bigger than a toast: banner, screen or dialog, chosen from screenshots in Phase 5 | The owner wants a real moment; comparing renders beats describing them. | Owner, 2026-10-13 (supersedes review F5) |
| Progress band | First on the page; all 11; not-yet rows muted with "x / N" | It shows what's next. | Owner, 2026-10-13 |
| How the row is written | At save, by the route, through PostgREST with the request's RLS client. The insert ignores duplicates and returns only the keys it stored. | The unique key makes "exactly once" the database's guarantee, even for two saves at once; an RPC would run as the caller and add nothing. | Plan (delegated) |
| What is stored / celebrated | Store `reached(before) ∪ reached(after)` at a counting save, and `reached(before)` at an edit to 1-2 or a delete; celebrate only `newlyReached(before, after) ∩ inserted` | Every milestone the user ever saw is stored before it can be lost, with no backfill migration, and a backfilled or re-reached milestone stays silent. | Plan (delegated), re-review F11 |
| Self-only writes | Accepted and pinned by a db test, not hardened | The table feeds only the user's private progress page; the hardening options don't work here (no secret key in the Worker, SECURITY DEFINER banned, an invoker RPC needs the same grant). This is the same call the owner made for `sky_checks` and `observations`. | Plan (delegated), test Phase 4 lesson |
| Isolation suite | `afterEach` deletes A's inserted rows | A per-user unique key would otherwise fail the shared suite from its second insert. | Plan (delegated) |
| 1-2 guard | The rule (only a counting save reads `after` or celebrates), plus a short-circuit for creates rated < 3: no milestone work at all | A create rated 1-2 can neither reach nor un-reach anything; an edit to 1-2 and a delete still store the before-state but never celebrate. | Plan (delegated), re-review F11 |
| Failure handling | A failed read or record skips the celebration, and `logMilestoneFailure(step)` logs one fixed line plus `error.name` (steps `read`, `record`, `list`, `seen`); the save never fails | The save is what matters; the trace is the evidence. The page's silent seen-read catch gets the same trace. | Plan (delegated), review F4, re-review F14 |
| Transport | `milestone` param, repeated per key, keys from the fixed set only, in `NOTICE_PARAMS` | Cleared on show, never replayed from offline copies, never carries a value. | Plan (delegated), research |
| Render site | Signed in only, keys via `readMilestoneParam`. Banner: `/log` page, and on Tonight inside the island under its sky (a `milestones` prop beside `notice`). Dialog: `GearShell`. Screen: its own page. | Keeps Tonight's one-sky composition and the shell → island notice path; never for a visitor with a crafted link. | Plan (delegated), review F3, re-review F12 |
| Variant prototypes | One component with a `variant` prop and a dev-only `?celebration=` switch; the capture spec lives in the scratchpad | The pick is an edit, so nothing has to be deleted from the repo. | Plan (delegated) |

## Scope

**In scope:**
- `src/lib/progress/milestones.ts` (pure);
- the `observing_milestones` migration, `TABLES` entry, db tests and generated types;
- `milestone-store.ts` and `celebrate.ts` in `src/lib/observations/`;
- both save routes, plus `withMilestones`;
- the param in `NOTICE_PARAMS`;
- `MilestoneList` on `/log/progress`;
- three celebration prototypes, a screenshot matrix, then the chosen one;
- EN and PL copy, `/design` specimens, the e2e spec and a CLAUDE.md note.

**Out of scope:**
- a backfill migration;
- writes from a GET;
- hardening self-only writes;
- a celebration on delete;
- sharing, badges or points;
- push or email;
- any change to the seen rule, the ranking or the S-05 checklists;
- offline storage of `/log/progress`.

## Architecture / Approach

1. A save route checks the rating.
2. If it is ≥ 3, the route reads the seen entries, writes, and reads them again. Each read goes through `observingProgress` and then `milestonesOf`.
3. The route records every milestone either read showed; the insert returns what it newly stored. An edit to 1-2 and a delete record the before-state first and never celebrate.
4. It celebrates `newlyReached ∩ inserted` by appending `&milestone=<key>…` to its usual redirect.
5. The render site (signed in only) validates the keys, renders the chosen celebration and clears the param. On Tonight, the banner goes through the island's prop. The service worker never stores a URL that carries it.

`/log/progress` merges the stored rows, whose nights win, with the derived states from the `progress` it already computes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. The milestone model | `MILESTONES`, `milestonesOf`, `newlyReached`, test-first | Reached-night derivation for count milestones |
| 2. The milestone table | Migration, RLS, `TABLES`, db tests, `db:types`, store | The shared local Supabase and another worktree's type regeneration |
| 3. Recording at save | `celebrate.ts`, routes, `withMilestones`, `NOTICE_PARAMS` | Celebrating only what this save newly stored |
| 4. Progress band | `MilestoneList` (stored + derived), e2e incl. "kept after delete" | PL copy at 320 px; red-mode distinction |
| 5. Design step | Three variants, a 42-shot matrix, **stop for the owner** | Prototypes that are realistic enough to choose from |
| 6. The chosen celebration | The pick for real, the "once" e2e, CLAUDE.md | Depends on the pick (B adds a page and a redirect) |

**Prerequisites:**
- `npx supabase migration up` on the shared local stack is approved (2026-10-13, additive only). Apply it once, with the SQL final first. Any later SQL change goes into a new migration (re-review F13).
- The orchestrator tells the other agent to hold `db:types` and to expect `structure.test.ts` to flag `observing_milestones` until this branch merges.
- `npm ci` and a worktree env built from local Supabase; preview port 4333; fixture port 4400 (shared).

**Estimated effort:** about 3 sessions across 6 phases, plus the owner's pick between Phases 5 and 6.

## Open Risks & Assumptions

- A failed record loses that milestone's celebration (traced). The page still shows it, derived, and the next save of any kind except a create rated 1-2 stores it silently.
- A user who deleted every entry sees the empty-state notice and their stored milestones together (intended).
- A user can forge their own milestone rows through PostgREST (accepted, pinned, private).
- The screen variant, if picked, adds a page, a redirect and a return-path check, so Phase 6 grows.
- A save that returns to a page not using `GearShell` (none today) would lose the celebration.

## Success Criteria (Summary)

- A rating of 1-2 never celebrates. A rating of 3 or above that reaches a milestone not yet stored celebrates once, and never again: not on reload, offline, or after a delete and re-log.
- `/log/progress` lists every reached milestone with its night, including after the reaching entry is deleted, and shows progress toward the rest, in EN and PL, all three themes, at phone width.
- `npm run test:db` proves isolation, the once-only insert and the key check.
