---
change_id: testing-ranking-invariants-and-calibration-oracle
title: "Test rollout Phase 3: no impossible target listed, and a retune can't pass on its own snapshot"
status: planned
created: 2026-10-08
updated: 2026-10-08
archived_at: null
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Ranking invariants and calibration oracle".
Risks covered: #3 (a target is recommended that cannot be seen: below the site's minimum altitude, outside its window — dark window for deep sky, sun below −6° for the Moon and planets — or below the horizon, on Tonight or in the session plan) and #4 (a calibration retune quietly degrades the ranking or breaks a PRD invariant and passes because the snapshot was regenerated with it). Test types planned: unit (property + reference fixture).
Risk response intent: #3 — across many generated sites, nights, latitudes and telescopes, no ranked target, planet, Moon entry or plan row falls outside its window or under the site's minimum altitude; challenge "the fixture nights in the suite are representative"; avoid asserting only the top 5 of a few fixed nights and a generator that reuses engine output as its own expectation. #4 — a retune that breaks a PRD invariant or the independent reference cross-check fails the suite, and regenerating the snapshot cannot turn it green; challenge "the calibration snapshot is an oracle"; avoid a snapshot regenerated from the implementation and brittle exact order where the PRD only fixes a rule.
After creating the folder, follow the downstream continuation rule.
