---
change_id: test-suite-diet
title: Test-suite diet: cut the unit layer to feature-level protection
status: preparing
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

Owner's request (2026-10-17): "We have over 2.5k tests, surely way too many. Audit and remove most of them. We don't need unit tests at all; we need e2e and some more important integration tests. Test features, not implementation details."

Scope of this change: diagnosis and plan only (research + plan). A later implementation agent deletes, converts and merges tests in small phases, sequenced after the in-flight S-06 (feat/auth-loose-ends), S-07 (feat/error-visibility-2) and S-08 (feat/star-source-switch) merge. Grounded in context/foundation/test-plan.md (risk-based rollout, Phases 1-5), lessons.md, the CLAUDE.md tripwires, the agent hooks (end-of-turn runs the unit suite) and .github/workflows/ci.yml.
