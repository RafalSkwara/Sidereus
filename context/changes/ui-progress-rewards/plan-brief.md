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

A badge grid (3 columns on a phone, 4 from `sm`): a medallion per milestone with its own glyph (Moon, ringed planet,
solar system, galaxy, globular, nebula, or the numerals 10 / 25 / 50 / 110 / 61); reached = solid ring on the action
surface + check pip + bold name + date; ahead = dashed ring, muted glyph, "Not yet" or "37 / 50" and a progress arc.
Each checklist has a per-type legend ("Galaxies 11 / 40") over a 6 / 10-column tile grid; a seen tile has a 2 px
action border, action fill, accent icon, bold number and a check, and reads aloud with its type and state. The dialog
shows the same badges.

## Key Decisions Made

| Decision               | Choice                                                                 | Why (1 sentence)                                                              | Source                    |
| ---------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------- |
| Badge style (P1)       | ⭐ Medallion with a glyph                                              | Matches the dialog's medallion and the Progress nav icon; simplest markup.    | Plan (owner question)     |
| Reached vs. ahead (P2) | ⭐ Dashed ring + progress arc + text                                   | Progress readable in red mode by shape, not hue.                              | Plan (owner question)     |
| Count-badge glyph (P3) | ⭐ Numerals 10 / 25 / 50 / 110 / 61                                    | Each badge distinct and says how many; `Award` already means Progress.        | Plan (owner question)     |
| Grid layout (P4)       | ⭐ Dense tiles, icon + number, catalogue order                         | Whole list on one or two phone screens; gaps and types visible.               | Plan (owner question)     |
| Seen state (P5)        | ⭐ Action fill + 2 px border + check                                   | Clear in all themes, no bright red slab at night.                             | Plan (owner question)     |
| Legend / filters (P6)  | ⭐ Legend with per-type counts, no filters                             | No JS, no new page state; explains icons and shows progress per type.         | Plan (owner question)     |
| Type icons (P7)        | ⭐ lucide `Galaxy` + 5 drawn icons                                     | lucide's stand-ins look like other things or already mean other concepts.     | Research + owner question |
| Six type families      | galaxy, globular, open cluster, nebula, planetary, stars               | Covers all 12 OpenNGC types used; Caldwell has no "stars".                    | Research                  |
| Tokens                 | None added                                                             | Every pair used is already in the contrast test.                              | Research                  |
| Tile icons             | One `<symbol>` sprite + `<use>`                                        | 110 inline-icon tiles measured 102 KB raw; the sprite removes the repetition. | Research                  |
| Tests                  | e2e assertions only (sr text, legend count, dialog badge, HTML budget) | Maps are `Record`s checked by `astro check`; no restating unit tests.         | Plan (test-diet rubric)   |

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

| Phase               | What it delivers                                                            | Key risk                                         |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| 1. Contract         | Type families, the progress icon set, EN + PL copy, `/design` icon sheet    | Drawn icons illegible at 16 px                   |
| 2. Milestone badges | `MilestoneBadge`, badge grid, badges in the dialog                          | Long Polish names in a 3-column grid at 320 px   |
| 3. Tile checklists  | Sprite, tiles, legend, page spacing, HTML measured                          | Red-mode legibility of not-seen tiles; HTML size |
| 4. States and rule  | `/design` matrix, e2e assertions, rhythm guard, CLAUDE.md, full e2e + smoke | Other specs depending on old markup              |

**Prerequisites:** none (no migration); local Supabase and the e2e recipe for Phases 2-4 (ports 4413 / 4414).
**Estimated effort:** about 2 sessions across 4 phases.

## Open Risks & Assumptions

- The owner may pick other options; each question names the one phase it changes.
- Not-seen tiles in red use `border` (#3a0000), faint by design; seen tiles carry the shape cues. If the owner finds
  not-seen too faint, `control-border` is the fallback (already contrast-pinned).
- The HTML budget is set from a measurement in Phase 3, not guessed.

## Success Criteria (Summary)

- A beginner sees at a glance which milestones are earned and how far the next one is, in every theme.
- The checklists show what kind of object each number is and which are seen, without glare in red mode.
- A screen-reader user hears each tile's name, type and state; nothing about the page's rules or offline behaviour
  changes.
