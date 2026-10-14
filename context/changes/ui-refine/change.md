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

## Decisions

The owner, 2026-10-14 (relayed by the orchestrator; full wording in `audit.md`, "Owner decisions"):

1. Buttons: 3C, the hierarchy (a hairline "Mark observed", text for the other per-item actions, a bare tile arrow).
2. Grouping: 1A plus 1B. Window and Best are two small stat cards in one row; everything else follows 1A (ruled bands, the when/what hairline, more room, icons on every fact).
3. Icons: 2B, on facts only, none on the dashboard tile headings.
4. Navigation: 4A plus 4B. The Tonight sub-nav replaces the back box; Progress is the fourth destination.
5. Desktop: only Window and Best side by side; every other fact one per line.

The split's first change is `ui-quiet-actions` (its own change folder). Implementation of the split waits for S-07 sky-events to merge.
