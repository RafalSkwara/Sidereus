---
change_id: ui-fact-rhythm
title: Grouped, icon-led facts with a spacing rhythm (ui-refine split, change 2)
status: impl_reviewed
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

Phase 1 implemented 2026-10-15 (6bd6998): roles, overline, icon map, Fact/FactList, StatCard/StatPair, /design specimens, guard. Gates green (types, lint, npm test 1983, build, sky-events e2e, guard break-check). Role bars measured 8/24/40 px. At 320 px in a Targets expanded row (222 px for the pair), "20:51–07:10" wraps in fallbacks (a) and (b), and "Widoczność" overflows its label by about 1 px; only (c) (no `pl-10` indent, 262 px) keeps the values on one line. Owner checkpoint pending: the fallback (Progress 1.7) and the item spacing, 20 or 40 px on each side (1.8). Curated shots in `evidence/design/curated/`.

Owner checkpoint answered 2026-10-15 (Progress 1.6-1.8): the stat pair takes variant (a)'s look (indented row, same cards) but stacked, Window above Best, one column, each card the full width of its column, at every width (replacing decision 5's "side by side" and D3's grid-cols-2 / max-w-md); item spacing (i), 40 px in total between two items (`--spacing-item: 1.25rem`). Agent follow-up: one-group rows (nights, washed-out rows) also use `py-item`, so every row sits 40 px from the next (with `py-group` they would be 48 px apart, further than full items). Phase 1 updated; the stacked pair measures 222 px in the 320 px expanded row with every value on one line.

Phases 2-5 implemented 2026-10-15 (bf0c8b8 p2+p3, f3ff251 p4, then p5): gates green per phase with break checks; the whole e2e suite 64 passed / 4 skipped / 0 failed and smoke all passed on a fresh local preview (4331/4401). Main-session fixes beyond the plan: TonightPageSkeleton `nights`/`events` layouts (Phase 3's target-shaped rows were about 2.5x too tall there) and the Moon/Planets skeleton row counts (1 and 7), so every focused page lands within about 350 px of its skeleton. Manual checks 3.5, 4.4 done by the agent with screenshots (`evidence/after`, `crops`, `design/curated`); the owner's acceptance (5.4) is open. Not pushed: waiting for the reviewer's /10x-impl-review. S-08 not on main yet (no rebase needed so far).

Implementation review 2026-10-15 (`reviews/impl-review.md`, NEEDS ATTENTION, 0 critical, F1-F6 warnings, F7-F9 observations): all applied with the owner's answers (F2 MoveHorizontal; F9 skeletons fitted before the PR, measured in the evidence README). Status impl_reviewed. Next: rebase onto main after S-08 (#165), the whole e2e suite and smoke, then the PR.

Rebased 2026-10-15 onto main 33a5586 (S-08 #165 merged): two conflicts resolved as planned (the washed-out row is `flex min-h-11 scroll-mt-4 items-center gap-3 py-item`; the skeleton's header comment keeps S-08's edit-row sentence and this change's layouts). The guard's skeleton allowlist re-measured (S-08's `mt-8`). SHAs in this folder rewritten to the rebased commits; `reviews/impl-review.md` keeps the pre-rebase ones (226605c = cbf104f). On the rebased tree: astro check 0/0, lint clean, npm test 121 files / 2289 passed, build OK, S-08's migration applied locally (`migration up`), the whole e2e suite 76 passed / 4 skipped / 0 failed, smoke 45/45. S-08 changed nothing visible in the captured views (ids, scroll-mt, data-object-card), so the screenshots stand.

Owner on PR #167, 2026-10-15: Progress 5.4 accepted; the Moon skeleton fitted to a night when the Moon is a target (`layout="moon"`), measured for both nights in the evidence README (target night within 16-24 px).
