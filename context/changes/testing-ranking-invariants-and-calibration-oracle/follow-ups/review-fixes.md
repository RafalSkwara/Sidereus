# Review fixes — testing-ranking-invariants-and-calibration-oracle

From `reviews/impl-review.md` (2026-10-09, full plan, NEEDS ATTENTION). The owner chose "apply all recommended". All 8 were fixed in one commit on `feat/testing-ranking-invariants-and-calibration-oracle`.

| Finding | Fix |
| --- | --- |
| F1 polar-night clamp guard | The not-clamped guard now runs only on a sunset-to-sunrise axis. On a night-wide axis, a 0/1 edge is accepted only when the oracle's sun at that edge meets the row's threshold. A fixed case, Longyearbyen 2026-11-25, exercises it: 1 Moon row with `to === 1`. §6.3 is updated. |
| F2 (d) brittle completeness | The expected delta is computed per entry from its inputs (Messier? seen?). Non-vacuity is checked on the input combinations. |
| F3 dropped plan rows | Per case, the plan's row keys equal the ranking entries plus planets plus the Moon target; this holds on all 47 cases. Break check: dropping the first planet from the plan turned 29 cases red. |
| F4 gate (i) classification | No-darkness is decided by sampling the oracle's geometric sun every 10 min. A new test asserts it agrees with `darkWindow.kind` on all 47 cases. |
| F5 reference rule unenforced | A structural test asserts ≥ 2 distinct sources per entry, known source keys and no duplicate ids per night. |
| F6 docs overstate independence | The sun helper is described as a deliberate copy of `sun.ts`; the import rule is scoped to `independent-altitude.ts`; the README lists all three seeds; §6.3 says `urls`. |
| F7 "harmless reorder" | The wording is now "a reorder within AF's fall picks". §6.6 and the comment note the AF check is stricter than the k = 3 oracle. |
| F8 short-window rate | The comments say about 1% (134 of about 13,800 for seed 20261008). |

Gates after the fixes: the five suites pass (306 tests, 1 skipped). `npm test`: 1453 passed. Lint: 0 errors (3 known warnings). `astro check`: 0 errors. The §6.3/§6.6 doc check passes.
