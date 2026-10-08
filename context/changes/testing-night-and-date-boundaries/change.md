---
change_id: testing-night-and-date-boundaries
title: "Test rollout Phase 2: the right night and times in every zone, across DST and month ends"
status: plan_reviewed
created: 2026-10-08
updated: 2026-10-08
archived_at: null
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Night and date boundaries".
Risks covered: #2 (the verdict, session plan or log prefill lands on the wrong night or shows the wrong time: the "tonight" rollover, the 25-hour DST night of 25 Oct 2026, ordering across midnight, a month boundary, or the site's time zone versus the server's). Test types planned: unit.
Risk response intent: #2 — for a fixed instant and site, the same "tonight", dark window and plan order come out whatever zone the runner is in, across the 25-hour 24/25 Oct night, the minutes either side of the rollover, and a 31 Oct / 1 Nov night. Challenge "pinned UTC dates in existing tests cover the edges". Avoid tests that pass only in the runner's own time zone and expected nights derived with the same helper under test.
After creating the folder, follow the downstream continuation rule.
