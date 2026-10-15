---
change_id: ui-dashboard-tiles
title: Dashboard tiles on the rhythm roles and shared facts (ui-refine split, change 3)
status: archived
created: 2026-10-15
updated: 2026-10-15
archived_at: 2026-10-15T16:58:54Z
---

## Notes

Third change of the `ui-refine` split (`context/changes/ui-refine/audit.md`, finding 4 for the dashboard, the S-07 notes on the verdict event line and the events tile; owner decisions 1, 3 and 5 as amended on 2026-10-15). Branch `feat/ui-dashboard-tiles`, off main 42ce808 (ui-fact-rhythm #167 merged).

One view: the `/tonight` dashboard (`TonightContent`: the verdict over the sky, the gear row, `TonightTiles` with `EventsTile`, and `TonightSkeleton`), against the existing design system (**existing** variant, Nightfall: tokens in `src/styles/global.css`, components in `src/components/ui/`; the rhythm roles, `Fact` / `FactList`, `StatCard` / `StatPair` and `fact-icons.ts` from ui-fact-rhythm).

Owner decisions that apply:
- **Icons 2B**: icons on facts only, none on the dashboard tile headings. The audit's "Tile gains an icon prop" is dropped. The S-07 verdict event line may get a fact icon, because it is a fact, not a tile heading.
- **Rhythm**: `line` 8, `group` 24, `item` 20 px each side of the rule (ui-fact-rhythm).
- **Stat cards**: stacked, full width (owner, 2026-10-15), if a tile uses them at all.
- **Buttons 3C**: quiet / hairline hierarchy; a bare tile arrow (already shipped in ui-quiet-actions).

In scope (audit, change 3): the tile content on the rhythm roles and the shared Fact components; the S-07 verdict line; the events tile; the S-08 plan tile (the next target from the edited plan); the phone-first spec (`tests/e2e/tonight-phone.spec.ts` first screen: the verdict headline, the Site card and the Telescope card title above the TabBar at 390×844); the `VERDICT_MIN_HEIGHT_CLASS` re-measure; the skeleton.

Out of scope: the Tonight sub-nav and the fourth destination (change 4, `ui-tonight-nav`), /log, /log/progress and /gear (change 5), the focused pages (change 2, shipped).

Research done 2026-10-15 (`research.md`, charges C1-C5). A reverted experiment (tiles on the roles, the verdict's event line as a `Fact` with its kind's icon, the skeleton in step) was built, measured and captured on the preview (4331/4401) and on `/design`. It is `evidence/exp/experiment.diff`, with before shots in `evidence/before/` and the measurements in `evidence/README.md`. The phone first screen is unchanged (149 / 701 / 746 against the TabBar at 779 px), and the skeleton's tile rows match the real ones.

Plan done 2026-10-15 (`plan.md`, `plan-brief.md`): 3 phases (the tiles; the verdict; rules, gate, landing image, whole suite). Agent defaults D1-D7 wait for the owner at plan review. The owner questions are D2 (the targets list at `line`), D4 (the solar eclipse's amber safety icon on the verdict line instead of `Eclipse`, which reads as a clock) and D5 (no icon on the events tile's line). Next: /10x-plan-review (reviewer), then the owner's answers.

Plan reviewed 2026-10-15 (`reviews/plan-review.md`: 0 critical, F1-F7 warnings, F8-F10 observations; all applied, F4 moot). Owner answers: D2 8 px (`space-y-line`); D4 the `Eclipse` kind icon for a solar eclipse too (no amber icon, no contrast row); D5 the Events tile's line leads with the event kind icon (a deliberate exception; headings stay icon-free); D6 the forecast line stays in the answer group (`mt-line`), and only the "Next clear night" advice moves to `mt-group`; D1, D3, D7 as planned. The plan's Phase 1 now carries the contract (`eventsVerdict` / `eventsTile`, `factIcon`, `Fact` kind and size). Next: /10x-implement phase by phase.

Implemented 2026-10-15: Phase 1 (5957d05), Phase 2 (33568c2), rebased onto main 5d52a37 between Phases 2 and 3, Phase 3 (b0ad3f9). Gates green per phase with break checks; the whole e2e suite 76 passed / 4 skipped / 0 failed and smoke 45/45 on a fresh local preview (4331/4401). `VERDICT_MIN_HEIGHT_CLASS` re-measured to `min-h-42 sm:min-h-58`; the phone first screen unchanged (149 / 701 / 746 against the TabBar at 779 px); the no-forecast night 4 px shorter; the landing image now 1280×1117. Open: the owner's acceptance (Progress 3.6). Not pushed for a PR yet: waiting for the reviewer's /10x-impl-review.

Implementation review 2026-10-15 (`reviews/impl-review.md`: APPROVED, 0 critical, F1 warning, F2-F3 observations; the reviewer ran the whole e2e 76/4/0 and smoke itself). Owner: Progress 3.6 accepted; F1 the Polish no-forecast night stays a permanent known limitation in CLAUDE.md. F1-F3 applied (the spec comments' 28 px event-night shift, `EVENT_KINDS` from the catalogue, `TILES_GAP_CLASS` guarded, the Planets reason icon named, no rule pointing into `context/changes/`). Status impl_reviewed. Next: the PR (closes #169), then /10x-archive after the merge.
