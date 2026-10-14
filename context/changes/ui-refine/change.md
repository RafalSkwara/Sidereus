---
change_id: ui-refine
title: UI refinement audit of the data-dense views, button weight and navigation
status: new
created: 2026-10-14
updated: 2026-10-14
archived_at: null
---

## Notes

The owner, 2026-10-14: "there are plenty of new data points on many screens, we should separate them visually more visibly, more whitespace, more icons; also buttons are too visible now and take too much of the user's attention. Let's perform a UI audit again. We might need to consider a navigation update too."

Scope of this step: an AUDIT only (no product code), using /10x-ui's charge method across the data-dense views (/tonight dashboard, /tonight/targets with the what-to-expect lines, plan, moon, planets, nights, finder, /log, /log/progress, /gear) and the navigation (Topbar, TabBar, back links, how the /tonight/* focused pages are reached), including S-07 sky-events from its plan (implementation will land on top of S-07). The deliverable is `audit.md` here: ranked findings, screenshots, 2-3 visual directions per theme, a proposed split into changes. Design system variant: **existing** (Nightfall: tokens in `src/styles/global.css`, components in `src/components/ui/`).

Audit done 2026-10-14: `audit.md` (12 ranked findings, S-07 notes, directions per theme, a proposed split into five changes, five open owner decisions); evidence under `evidence/` (before shots, experiments A and B with their reverted diffs, the seed and capture scripts). Next: the owner's decisions, then each split change through /10x-ui → /10x-research → /10x-plan after S-07 merges.
