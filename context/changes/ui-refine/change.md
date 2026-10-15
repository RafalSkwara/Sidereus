---
change_id: ui-refine
title: UI refinement audit of the data-dense views, button weight and navigation
status: new
created: 2026-10-14
updated: 2026-10-15
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

## Split status

This folder is the umbrella for the split in `audit.md` ("Proposed split into changes") and stays in `changes/` until the last change ships.

| # | Change | Status |
|---|---|---|
| 1 | `ui-quiet-actions` | Done: merged in #163 (main c650a8a) and archived to `context/archive/2026-10-14-ui-quiet-actions/` |
| 2 | `ui-fact-rhythm` | Done: merged in #167 (main 42ce808) and archived to `context/archive/2026-10-14-ui-fact-rhythm/` |
| 3 | `ui-dashboard-tiles` | **Next** (not started; it did not fold into change 2) |
| 4 | `ui-tonight-nav` | Not started |
| 5 | `ui-log-progress-gear` | Not started |

Contract carried over from change 1:
- **Buttons:** `buttonVariants` has `hairline` (sm) and `quiet` (bare, with its icon, underlined at rest in red through `red:`). `action` is gone.
- **Tokens:** `--control-border` exists.
- **Offline:** a control's icons mute with it.
- **Lint:** `context/**` is outside ESLint.

Contract carried over from change 2 (`ui-fact-rhythm`):
- **Rhythm roles:** `line` 8, `group` 24, `item` 20 px in `global.css`; every Tonight list row is `py-item` (40 px between rows); `text-overline` for section labels. `cn()` knows the roles.
- **Components:** `Fact` / `FactList`, `StatCard` / `StatPair` (Window and Best stacked, full width, at every width) and the icon map `src/components/ui/fact-icons.ts` (one concept, one icon).
- **Guards:** `src/styles/rhythm-roles.test.ts` (converted files: no numeric, px or arbitrary vertical steps, allowlists with counts) and `src/components/ui/fact-islands.test.ts`.
- **Skeletons:** `TonightPageSkeleton` mirrors the real rows (`rows`, `moon`, `nights`, `events`; `plan` is S-08's); fit a changed view's skeleton and measure it (`scripts/skeleton-heights.mjs`).

Evidence scripts to reuse: `context/archive/2026-10-14-ui-quiet-actions/evidence/scripts/` and `context/archive/2026-10-14-ui-fact-rhythm/evidence/scripts/` (capture, targets-rows, skeleton-heights, design-sections). They take the port from the environment and refuse non-local URLs.
