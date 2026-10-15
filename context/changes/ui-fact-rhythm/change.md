---
change_id: ui-fact-rhythm
title: Grouped, icon-led facts with a spacing rhythm (ui-refine split, change 2)
status: implementing
created: 2026-10-14
updated: 2026-10-15
archived_at: null
---

## Notes

Second change of the `ui-refine` split (`context/changes/ui-refine/audit.md`, findings 2, 4, 5, 8 and 9; owner decisions 2, 3 and 5). A target's facts sit at one size, weight and colour with no grouping, spacing is invented per file, and icons have no shared vocabulary.

- **Grouping** (decision 2 = 1A plus 1B): Window and Best become two small stat cards (a caption label over a larger mono value) side by side in one row at every width; everything else follows 1A: ruled bands, no boxed card around the whole target, a hairline between "when" and "what and how", more breathing room, an icon on every fact that lacks one.
- **Icons** (decision 3 = 2B): on facts only, none on the dashboard tile headings. One shared icon map that absorbs S-07's event-kind icons.
- **Desktop** (decision 5): only Window and Best side by side; every other fact one per line.

Scope: spacing rhythm roles (line / group / item), a `text-overline` section-label role, a `Fact` / `FactList` and stat-card shared component, then the Targets rows, Planets with labelled facts, `MoonCard`, `SkyEventList` and the Nights page reasons.

One view family: the Tonight focused pages' item lists (`/tonight/targets`, `/tonight/planets`, `/tonight/moon`, `/tonight/events`, `/tonight/nights`), against the existing design system (**existing** variant, Nightfall: tokens in `src/styles/global.css`, components in `src/components/ui/`).

Out of scope: the dashboard tiles (change 3, `ui-dashboard-tiles`), the navigation (change 4), /log, /log/progress and /gear (change 5), and the plan page (`/tonight/plan`, `SessionTimeline`), which S-08 adjustable-session-plan changes in parallel in its own worktree.

Research done 2026-10-14 (`research.md`, charges C1-C5). A stat-card and fact-row experiment was built, captured and reverted; it is in `evidence/exp-stat-cards/`, with before shots in `evidence/before/`. Plan done 2026-10-14 (`plan.md`, `plan-brief.md`): 5 phases. Agent defaults D1-D8 are waiting for the owner at plan review. Next: /10x-plan-review (reviewer), then the owner's answers.

Plan reviewed 2026-10-14 (`reviews/plan-review.md`, F1-F10 all applied). The owner kept D2-D8. D1 changed to the looser rhythm: line 8, group 24, item 40 px. On the review questions: F2, measure first (Phase 1 stops at the 320 px screenshots for the owner's fallback choice); F7, one concept, one icon, with the map in `src/components/ui/`; F8, the faint border stays in red; F9, the accent Eye stays. Next session: /10x-implement Phase 1 (Opus subagent, high effort), then STOP for the owner.

Owner on D1, 2026-10-14: "item 40 px" stays open. Phase 1 shows both readings, 40 px in total between two targets (20 px each side of the rule) and 40 px on each side (80 px in total), in a `c-item-rhythm` specimen at 320 px, captured with the stat-pair shots. The owner chooses at the Phase 1 checkpoint (Progress 1.8).

Phase 1 implemented 2026-10-15 (9385b8a): roles, overline, icon map, Fact/FactList, StatCard/StatPair, /design specimens, guard. Gates green (types, lint, npm test 1983, build, sky-events e2e, guard break-check). Role bars measured 8/24/40 px. At 320 px in a Targets expanded row (222 px for the pair), "20:51–07:10" wraps in fallbacks (a) and (b), and "Widoczność" overflows its label by about 1 px; only (c) (no `pl-10` indent, 262 px) keeps the values on one line. Owner checkpoint pending: the fallback (Progress 1.7) and the item spacing, 20 or 40 px on each side (1.8). Curated shots in `evidence/design/curated/`.
