---
change_id: sky-events
title: Sky events - meteor showers, close pairings and other events for a night, from the pure engine
status: implementing
created: 2026-10-13
updated: 2026-10-14
archived_at: null
---

## Notes

Sidereus M-3 slice S-07 sky-events (GitHub #128; roadmap "S-07: Sky events"; PRD FR-042, FR-043, US-07). Assigned by the orchestrator on 2026-10-13 to the agent "sky-events" (worktree `.claude/worktrees/sky-events`, branch `feat/sky-events` from origin/main e7b8c49).

Research must cover the roadmap's unknowns:
- Meteor-shower data whose terms allow reuse, including commercial reuse (PRD Open Question 19). Check the licence on primary pages, and treat derived data as carrying its source's terms.
- What counts as a close pairing (Open Question 20).
- The risk that this is several kinds of event maths at once: the plan may split by event kind.
- Events are computed by the pure engine (no feed), so they stay deterministic and work in stored offline copies.

Overlap with finder-chart (S-03, in progress on the main checkout): it touches the Tonight targets page, the offline copies (`copies.ts`, `sw.ts`) and CLAUDE.md. Keep Tonight changes to the dashboard tile and the verdict line where possible, and flag any shared file in the plan.

Run rules: no AskUserQuestion (owner questions go in the plan in Polish as pending owner confirmation, with a recommended default), no PushNotification, push and PR only at the end of implementation, never reset local Supabase. Run the whole e2e suite before any PR, and use `dismissCelebrationIfOpen` after saves rated 3 or above. Preview port 4333, fixture 4400.
