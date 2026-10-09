---
change_id: testing-access-and-entitlement-boundary
title: "Test rollout Phase 4: isolation and the plan enforced on the server, coordinates kept private"
status: archived
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09T19:42:59Z
---

## Notes

Open a change folder for rollout Phase 4 of context/foundation/test-plan.md: "Access and entitlement boundary".
Risks covered: #5 (abuse: a signed-in user calls PostgREST or an RPC directly to read or change another user's rows, to put their own account on the full plan, or to reach full-plan features from a free account) and #6 (abuse / PII leak: a site's coordinates escape into a URL, a log line, an error redirect or a third-party request through a new module the no-console guard does not cover). Test types planned: db integration + static gate.
Risk response intent: #5 — user B cannot read, update or delete user A's rows or call A's RPCs; a user cannot change their own plan; a free account is refused by the server, not only hidden in the UI, on every full-plan route; challenge "RLS on the table means every column is safe" and "a hidden button means a refused request"; avoid asserting "0 rows affected" without a positive control and testing gating through the UI only. #6 — every module that reads site records or coordinates sits under the no-console guard, and no redirect, URL or ?error= carries a coordinate value; challenge "the lint file list is complete"; avoid grepping for the literal "lat" and a check that has to be updated by hand for each new module.
After creating the folder, follow the downstream continuation rule.

**State 2026-10-09 (session wrap-up):** `research.md` is saved as `status: partial`. Risk #5 and the history are grounded; the Risk #6 code sweep was stopped unfinished (Open Question 1). Next: finish `/10x-research testing-access-and-entitlement-boundary` (re-run only the Risk #6 sweep), ask the owner Open Questions 2–3, backport §2, then `/10x-plan`. Resume steps are in `context/handoff.md`.

**State 2026-10-09 (evening):** research complete (Risk #6 sweep re-run). Owner decisions: self-only direct writes accepted for now, revisit later; **Phase 4 waits for roadmap F-01 `account-plans`**, then resumes at `/10x-plan` (re-check anchors first).
