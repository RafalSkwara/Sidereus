---
change_id: testing-quality-gates-wiring
title: "Test rollout Phase 5: quality gates wired into CI and the agent loop, flakes made visible"
status: new
created: 2026-10-09
updated: 2026-10-09
archived_at: null
---

## Notes

Open a change folder for rollout Phase 5 of context/foundation/test-plan.md: "Quality-gates wiring". Risks covered: cross-cutting (locks in the Phase 1-4 protections for Risks #1-#6). Test types planned: gates + hook. Risk response intent: stop CI retries from hiding flakes (a retried e2e pass must be reported, not silently green); lock the Phase 1-4 checks into CI and the agent loop (post-edit hook for engine/tonight tests, recommended); fold in impl-review F3 of testing-access-and-entitlement-boundary: client <script> blocks in .astro files are not linted at all (the fix is written up in context/archive/2026-10-09-testing-access-and-entitlement-boundary/follow-ups/review-fixes.md), so the no-console privacy guard must cover them end to end. Coordination: coder implements S-05 in .claude/worktrees/observing-progress; any change to ESLint/CI/Playwright config, hooks or .claude settings must be listed in the plan with what coder's branch must adapt to. After creating the folder, follow the downstream continuation rule.
