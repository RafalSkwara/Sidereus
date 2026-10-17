# Progress rewards — Plan Brief

> Full plan: `context/changes/ui-progress-rewards/plan.md`
> Research: `context/changes/ui-progress-rewards/research.md`

## What & Why

Roadmap M-4 S-11 (#215), the owner's request of 2026-10-17: make `/log/progress` feel like a reward. Each of the 11
milestones gets its own badge (reached vs. ahead, with progress such as 37 / 50), and the Messier (110) and Caldwell
(61) checklists become tiles with an object-type icon and a clear seen state. It replaces the progress part of the
dropped S-03 (#171). Progress stays private: no sharing or social badges.

## Starting Point

Milestones are 11 identical text rows with a small check; the only medallion lives inside the celebration dialog
(always `Award`). The checklists are 171 chips "M31"/"C14" where a seen chip is a `bg-primary` fill, which in red mode
is a full bright-red block, and no chip shows its type. The page is SSR, network-only, with no island; `ChecklistItem`
already carries OpenNGC's type.

## Desired End State

A badge grid (2 columns on a phone, 4 from `sm`): a 112 px medallion per milestone, a ring around its own
illustration in theme tokens (cratered Moon, banded ringed planet, the planets by the Sun, spiral galaxy, dense
globular, layered nebula, and the number plus a small motif for the five count milestones); reached = solid ring, full
art, check pip, bold name, date; ahead = dashed ring, muted art, "Not yet" or "37 / 50" and a solid, wider progress
arc. Each checklist has a per-type legend ("Galaxies 11 / 40") over a 2 / 4-column grid of larger tiles (icon, number,
name); a seen tile has a 2 px action border, action fill, accent icon, bold number and a check, and reads aloud with
its type and state. Caldwell and the seen lists start closed (P8 ⭐, proposed). The dialog shows the same badges.

## Key Decisions Made

| Decision                    | Choice                                                                             | Why (1 sentence)                                                                       | Source                  |
| --------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------- |
| Badge style (P1)            | **Owner: C** — rich illustration inside a ring with a progress arc, bigger badges  | The badges must feel like a reward; art approved per round before Phase 2.             | Owner 2026-10-17        |
| Reached vs. ahead (P2)      | **Owner: B** — dashed ring + progress arc + text                                   | In red the arc is solid and thicker (review F3).                                       | Owner 2026-10-17        |
| Count badges (P3)           | **Owner: C** — number + small motif; 2 badges per phone row                        | Distinct per milestone and says how many.                                              | Owner 2026-10-17        |
| Grid layout (P4)            | **Owner: B** — larger tiles, icon + number + name, 2 / 4 columns                   | Names visible; costs scroll length (P8) and weight (measured, F9).                     | Owner 2026-10-17        |
| Seen state (P5)             | **Owner: B** — action fill + 2 px border + check                                   | Clear in all themes, no bright red slab at night.                                      | Owner 2026-10-17        |
| Legend / filters (P6)       | **Owner: A** — legend with per-type counts, no filters                             | No JS, no new page state.                                                              | Owner 2026-10-17        |
| Type icons (P7)             | **Owner: B** — lucide `Galaxy` + 5 drawn icons                                     | lucide's stand-ins look like other things or already mean other concepts.              | Owner 2026-10-17        |
| Six type families           | galaxy, globular, open cluster, nebula, planetary, stars                           | Covers all 12 OpenNGC types used; Caldwell has no "stars".                             | Research                |
| Tokens                      | None added                                                                         | Every pair used is in the contrast test; review F7 adds `heading` on `action-surface`. | Research                |
| Tile icons                  | One `<symbol>` sprite + `<use>`                                                    | 110 inline-icon tiles measured 102 KB raw; the sprite removes the repetition.          | Research                |
| Phone length (P8, proposed) | ⭐ Caldwell band and seen lists in closed `<details>`                              | Larger tiles make Messier about 3,960 px on a phone; no filters (P6).                  | Plan (owner question)   |
| Tests                       | e2e assertions only (sr text, legend count, dialog badge, checklist markup budget) | Maps are `Record`s checked by `astro check`; no restating unit tests.                  | Plan (test-diet rubric) |

## Scope

**In scope:** `object-family.ts`, `progress-icons.ts`, `MilestoneBadge`, the badge grid, the dialog's badges,
`ObjectTypeSprite`, tile `ChecklistGrid`, `ChecklistLegend`, page and SeenList spacing on the rhythm roles, EN + PL
copy, `/design` specimens in the 7-state matrix, e2e assertions, rhythm and island-import guards, CLAUDE.md rule.

**Out of scope:** sharing or social badges, rule or schema changes, new milestones, new tokens, filters, sorting,
interactive tiles, object thumbnails, SeenList redesign, offline storage of the page, roadmap edits.

## Architecture / Approach

Pure display mappings (`FAMILY_OF`, `MILESTONE_GLYPHS`) over the existing rule (`observingProgress`, `milestonesOf`,
`withStored`), rendered by Astro components on the server; the icon module stays out of islands. Contract first
(icons, families, copy on `/design`), then badges, then tiles, then states, gate and rule.

## Phases at a Glance

| Phase               | What it delivers                                                                         | Key risk                                   |
| ------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1. Contract         | Type families, the progress icon set, EN + PL copy, `/design` icon sheet                 | Drawn icons illegible at 16 px             |
| 2. Milestone badges | Approved badge art ported, `MilestoneBadge`, 2/4-column badge grid, badges in the dialog | Art too busy or illegible in red at 112 px |
| 3. Tile checklists  | Sprite, larger tiles with names, legend, closed Caldwell (P8), spacing, markup measured  | Phone scroll length; HTML weight           |
| 4. States and rule  | `/design` matrix, e2e assertions, rhythm guard, CLAUDE.md, full e2e + smoke              | Other specs depending on old markup        |

**Prerequisites:** the owner's approval of the badge art (`evidence/badge-art/`) before Phase 2; no migration; local Supabase and the e2e recipe for Phases 2-4 (ports 4413 / 4414).
**Estimated effort:** about 2-3 sessions across 4 phases, plus art rounds with the owner.

## Open Risks & Assumptions

- The owner may pick other options; each question names the one phase it changes.
- Not-seen tiles in red use `border` (#3a0000), faint by design; seen tiles carry the shape cues. If the owner finds
  not-seen too faint, `control-border` is the fallback (already contrast-pinned).
- The checklist markup budget (grids plus sprite, not the whole page) is set from a Phase 3 measurement, not guessed.

## Success Criteria (Summary)

- A beginner sees at a glance which milestones are earned and how far the next one is, in every theme.
- The checklists show what kind of object each number is and which are seen, without glare in red mode.
- A screen-reader user hears each tile's name, type and state; nothing about the page's rules or offline behaviour
  changes.
