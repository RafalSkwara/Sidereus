---
change_id: adjustable-session-plan
title: Adjustable session plan, saved to the account (M-3 S-08)
status: impl_reviewed
created: 2026-10-14
updated: 2026-10-15
archived_at: null
---

## Notes

Roadmap M-3 S-08, GitHub #129. The user can reorder, drop and add targets on the session plan for a site and night, reset it to the suggested plan, and find their edits on every device and in the offline copy; a free account sees what it does and that it needs the full plan. PRD FR-044, US-08, Open Question 23 (paid features in a stored offline copy).

Constraints from the orchestrator: a new per-user table (RLS with four policies, `TABLES` in `tests/db/tables.ts`, structure test, migration naming, `db:types`); the full-plan gate twice (page and island, test-plan 6.4); the offline rules (`TONIGHT_PAGES`, `data-plan`, the plan-loss drop); edits never schedule a target outside its window. UI builds on the quiet-action tiers that `ui-quiet-actions` (in flight on `feat/ui-refine`) introduces; flag overlap.
