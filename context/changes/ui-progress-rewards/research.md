---
date: 2026-10-17T18:16:01+02:00
researcher: Claude (ui-progress-rewards subagent)
git_commit: bb442bf
branch: feat/ui-progress-rewards
repository: sidereus
topic: "/10x-ui audit of /log/progress for progress rewards (milestone badges, type-icon tile checklists)"
tags: [research, ui, progress, milestones, checklist, icons, design-system]
status: complete
last_updated: 2026-10-17
last_updated_by: Claude (ui-progress-rewards subagent)
---

# Research: /log/progress audit for progress rewards

**Date**: 2026-10-17T18:16:01+02:00
**Researcher**: Claude (ui-progress-rewards subagent)
**Git Commit**: bb442bf
**Branch**: feat/ui-progress-rewards
**Repository**: sidereus

## Research Question

Roadmap M-4 S-11 (#215), owner's request of 2026-10-17: on `/log/progress` each of the 11 milestones gets its own
badge (reached vs. ahead, with progress such as 37/50), and the Messier (110) and Caldwell (61) checklists become a
grid of tiles with object-type icons and a clear seen / not-seen state. Run the `/10x-ui` two-way audit of that one
view (charges with file:line and user effect), and answer: where object types come from and whether the page can use
them without shipping catalogue JSON to the browser; whether lucide has the icons; how `MilestoneCelebration` relates;
the page's offline behaviour; the cost of 171 server-rendered tiles; the existing e2e and `/design` coverage.

## Summary

- **The view is already on the design-system contract** (variant: existing design system). The hardcoded-value scan
  (the `/10x-ui` grep) over `src/pages/log/progress.astro` and the four `src/components/progress/*.astro` files returns
  0 hits. The charges are about a missing shared component (badge), a missing shared vocabulary (object types), a seen
  state that misbehaves in red mode, and spacing that is off the rhythm roles, not literal colours.
- **Object types are free on the server.** `ChecklistItem.type` already carries OpenNGC's type
  (`src/lib/progress/progress.ts:23`, filled at `:61`), and the page is SSR with no island
  (`src/pages/log/progress.astro:41`, no `client:` directive in the view), so the tile can render a type icon without
  any catalogue data reaching the browser. A type → family map can be island-safe like `milestones.ts`
  (`src/lib/progress/milestones.ts:1-12`: type-only imports).
- **Types are uneven.** Of the 12 `DEEP_SKY_TYPES` (`src/lib/catalogue/index.ts:15-29`), Messier uses all 12 and
  Caldwell 9 (counts below). Six display families cover them: galaxy, globular cluster, open cluster, nebula (nebula,
  emission, reflection, supernova remnant, cluster with nebula), planetary nebula, stars and asterisms (asterism,
  double star, other).
- **lucide (1.45.0 in `node_modules`) has `Galaxy`, but no usable globular, open-cluster, nebula or star-group glyph.**
  The obvious substitutes are taken by another concept under the "one concept, one icon" rule
  (`src/components/ui/fact-icons.ts:2`): `Sparkles` = "not seen yet" (`NotSeenMark`), `Sparkle` = meteor shower,
  `Cloud` = cloud cover, `CircleDot` = opposition, `Orbit` = elongation, `Ellipse` = rings, `Moon` = the Moon. A custom
  set drawn on lucide's grid via `createLucideIcon` (exported by lucide-react, checked) is needed; the repo has a
  precedent for hand-drawn icons (`src/components/NavIcon.astro:12-47`).
- **There is no type label anywhere** (no i18n key, no component maps `DeepSkyType`); new EN + PL keys are needed.
- **No milestone has its own visual.** `MilestoneList` is a text row with a 16 px `Check`
  (`src/components/progress/MilestoneList.astro:33-57`); the one medallion is inline in the celebration dialog
  (`src/components/progress/MilestoneCelebration.astro:74-76`, always `Award`).
- **Offline:** `/log/progress` is network-only (not in `TONIGHT_PAGES`, `src/lib/offline/copies.ts:15-23,170-178`;
  a failed fetch gets `/offline`, `src/sw.ts:754-767`); its nav link carries `needsNetwork` (`src/lib/navigation.ts:9`).
  Nothing in the change needs to touch the worker.
- **Performance (measured on the dev server, mockup page):** a 110-tile grid with inline lucide-style SVG icons was
  102,356 bytes raw and 2,197 bytes gzipped (147 `<svg>` elements). For 171 tiles that scales to about 160 KB raw; an
  SVG `<symbol>` sprite with `<use>` per tile removes the repeated paths. Transfer cost is small either way; raw HTML
  size and DOM node count are the reason for the sprite.

## Charges

Hardcoded-value scan (pre-audit): **0** candidates in `src/pages/log/progress.astro`,
`src/components/progress/{ChecklistGrid,MilestoneList,SeenList,MilestoneCelebration}.astro`.

1. **Missing shared component: no milestone badge.** `src/components/progress/MilestoneList.astro:33-57` renders each
   of the 11 milestones as the same text row (a 16 px `Check` or an empty slot, name, date or "x / N"), and the only
   medallion is a one-off inside `src/components/progress/MilestoneCelebration.astro:74-76` (always `Award`, size-20).
   _Effect on the user:_ reaching "First galaxy" or "50 Messier objects" leaves nothing that looks earned on the
   progress page; the list reads like a to-do list, and the dialog's medallion never appears again after Continue.
   _Fix:_ a shared `MilestoneBadge` (one glyph per milestone, reached / ahead states, progress) used by the list and
   the dialog.
2. **Seen state built on `bg-primary` reads as a bright slab in red mode and carries no type.**
   `src/components/progress/ChecklistGrid.astro:35-38` fills a seen chip with `bg-primary text-primary-foreground`; in
   red `primary` is `#ff0000` and `primary-foreground` `#000000` (`src/styles/global.css` red block, :198 onwards), so
   37 seen objects become 37 full-red blocks on a night screen; every chip is the same shape, so the grid says nothing
   about what the object is. _Effect:_ at the eyepiece in red mode the page glares, and a beginner cannot see "I have
   seen no planetary nebula yet" at a glance. _Fix:_ a token-only tile with a type icon whose seen state is told by
   weight and shape (action tokens + 2 px border + check), not by a bright fill.
3. **Missing shared vocabulary for object types.** No i18n label (`src/i18n/messages/en.ts:1495-1541` has none), no
   icon map (`src/components/ui/fact-icons.ts:57-105` has none), and no lucide glyph is free for four of the six
   families (see Summary). _Effect:_ any agent adding a type icon picks its own (likely `Sparkles` or `Cloud`, which
   already mean "not seen yet" and "cloud cover"), so one icon would mean two things on neighbouring pages. _Fix:_ one
   shared module (`progress-icons.ts`, like `fact-icons.ts`) with the family map, the drawn icons and the milestone
   glyphs, plus `progress.types.*` keys in EN and PL.
4. **Spacing off the rhythm roles, outside the guard.** `src/components/progress/MilestoneList.astro:34` (`py-3`),
   `src/components/progress/ChecklistGrid.astro:26` (`gap-1.5` in a `grid`), `src/components/progress/SeenList.astro:27,31`
   (`mt-4`, `py-3`), `src/pages/log/progress.astro:69,71,84,110` (`mb-6`, `mt-3`, `py-3`, `mb-4`); none of these files
   is in `GUARDED` (`src/styles/rhythm-roles.test.ts:54-108`). _Effect:_ the progress bands sit on a 12/16/24 px
   rhythm while Tonight's rows sit on 20/24/8, so the app's two list styles feel different; the next agent copies the
   numbers. _Fix:_ convert the new and rewritten progress components to `line` / `group` / `item` and add them to the
   guard.
5. **Deferred — the SeenList duplicates the grid below it.** `src/components/progress/SeenList.astro:26-44` lists every
   seen object again with its first night under each grid. With 37 seen it adds 37 rows between Messier and Caldwell.
   _Effect:_ a long scroll to the Caldwell grid. _Deferred because_ it is the only place a seen object's name and first
   night appear (tiles are not interactive in the recommended option), the owner did not ask for it, and
   `tests/e2e/observing-milestones.spec.ts:149` pins `[data-seen-item]`. Revisit if the owner picks interactive tiles
   (question P6 C) or asks for a shorter page.

## Detailed Findings

### Object types and families

- `DEEP_SKY_TYPES` (12 values): `src/lib/catalogue/index.ts:15-29`; `DeepSkyObject.type` at `:45`.
- Counts, from a node count over the committed JSON (`src/lib/catalogue/messier.json`, `caldwell.json`) on this commit:
  - Messier 110: galaxy 40, globular-cluster 29, open-cluster 26, planetary-nebula 4, nebula 4, emission-nebula 1,
    reflection-nebula 1, supernova-remnant 1, cluster-with-nebula 1, asterism 1 (M24), double-star 1 (M40), other 1 (M73).
  - Caldwell 61: galaxy 28, open-cluster 10, planetary-nebula 9, emission-nebula 4, globular-cluster 3, nebula 2,
    cluster-with-nebula 2, supernova-remnant 2, reflection-nebula 1.
- By the six families proposed: Messier galaxy 40 / globular 29 / open 26 / nebula 8 / planetary 4 / stars 3;
  Caldwell galaxy 28 / globular 3 / open 10 / nebula 11 / planetary 9 / stars 0.
- `NEBULA_TYPES` for the "first nebula" milestone (`src/lib/progress/milestones.ts:40-47`) includes
  `planetary-nebula`; the display family "nebula" does not. That is fine: the milestone counts any nebula, the tile
  family is about the icon. The plan keeps `NEBULA_TYPES` untouched.
- `progress.ts` imports the catalogue data (`src/lib/progress/progress.ts:1`) and is server-only by its own comment
  (`:9-10`); the view has no island, so nothing ships to the browser.

### Icons

- lucide-react 1.45.0 exports `Galaxy` and `createLucideIcon` (checked with `node -e`).
- Icons already bound to a concept (must not be reused for object types): `FACT_ICONS` (`fact-icons.ts:57-89`: Clock,
  Compass, Eye, Telescope, Info, SunDim, MoveHorizontal, Contrast, Ellipse, Moon, Cloud, Ruler, Lightbulb,
  TriangleAlert), `EVENT_KIND_ICONS` (`:92-99`: Moon, Eclipse, Orbit, CircleDot, Link, Sparkle), visibility marks
  (`:102-105`: CircleCheck, CircleSlash), `Sparkles` = not seen yet (`src/components/tonight/NotSeenMark.astro:11`,
  `NotSeenLegend.astro:5`), `Award` = milestone / Progress (celebration).
- lucide-only stand-ins rendered for comparison (evidence `q7-type-icons-*`): `CircleDotDashed` (globular), `Grip`
  (open cluster: reads as a drag handle), `CloudFog` (nebula: reads as weather), `Disc` (planetary: reads as a CD),
  `Asterisk` (stars).
- Drawn drafts (24-unit grid, 2-unit stroke, round caps; rendered at 40/24/16 px in the evidence): globular (centre
  disc, a ring of 6 dots, a ring of 8 smaller dots), open cluster (6 scattered dots of three sizes), nebula (a cloud
  whose lower edge is dashed, two inner stars), planetary (ring, central star, dotted halo), star group (three stars
  joined as a stick figure), ringed planet and orbits (for the planet milestones). Their node data is in `plan.md`.

### Milestones and the celebration

- `MILESTONES` (11, in order): `src/lib/progress/milestones.ts:23-35`; kinds `first` / `count` / `all`.
  `MilestoneState.progress` exists for `count` and `all` (`:55`, `countState` caps at N `:134-136`), so "37 / 50" is
  already available; firsts have no progress.
- The page lays the stored record over the derived states (`withStored`, `:155-163`), unchanged by this change.
- `MilestoneCelebration` (`src/components/progress/MilestoneCelebration.astro`): native `<dialog>`, night-sky card,
  `Award` medallion `:74-76`, label `:77-79`, names `:80-82`, Continue / See your progress `:83-91`, `specimen` mode
  for `/design` `:25-38`. Owner picked this variant C on 2026-10-13 (archive `2026-10-11-observing-milestones`).
- Copy: `progress.milestones.name` (`src/i18n/messages/en.ts:1518-1530`), `reachedOn`, `notYet`, `progress(seen,total)`,
  `celebration.reached` plural (`:1531-1539`). No runtime test ties `MILESTONES` to the names; the
  `Record<MilestoneKey, …>` type does at compile time (`astro check` in CI).

### Tokens (relevant rows)

- Values per theme (dark / light / red): `action-surface` #16224a / #e4ebfa / #2a0000; `action-border` #6b82cf /
  #3a58b8 / #d00000; `primary-strong` #c3d0ff / #23439f / #ff0000; `control-border` #646e8a / #808a9e / #c80000;
  `border` #232b3f / #d6dce6 / #3a0000 (`src/styles/global.css` blocks at :40, :99, :198; night scope :155).
- Contrast test rows already cover what the tile and badge need: `primary-strong` on `action-surface` at 4.5
  (`src/styles/contrast.test.ts:134`), `action-border` at 3 on background, surface and sky (`:135-140`),
  `control-border` at 3 (`:130`), `primary-strong` at 3 on background and surface (`:104`). So the recommended styles
  need **no new token**.
- `ui-quiet-actions` reserved the action tokens for the sky-check answers and the milestone medallion (CLAUDE.md,
  Clickables). The recommended seen tile extends that use to "seen" marks; the plan records it in CLAUDE.md.
- Red: `primary` = `primary-strong` = `heading` = #ff0000 (`global.css` red block), so every red state must differ by
  border weight, dash, fill luminance or a glyph.

### Offline, auth, routes

- `/log` is in `PROTECTED_ROUTES` (`src/lib/protected-routes.ts`), so a signed-out GET of `/log/progress` goes to
  sign-in with `next` (`src/middleware.ts:46-52`).
- Network-only: `storedPageOf` matches only `TONIGHT_PAGES` and the finder (`src/lib/offline/copies.ts:15-23,170-178`);
  the generic route returns `/offline` when the fetch throws (`src/sw.ts:754-767`); only `/_astro/**` assets are
  precached (`scripts/build-sw.mjs:55-57`). The nav link is `needsNetwork` (`src/lib/navigation.ts:9`,
  `TabBar.astro:40`, `Topbar.astro:52`).
- The celebration is rendered by `GearShell` for any signed-in page with `milestone` params
  (`src/components/gear/GearShell.astro` frontmatter), so a Tonight page whose island is stored never carries it
  (`milestone` is in `NOTICE_PARAMS`, CLAUDE.md). Swapping the dialog's medallion changes nothing offline.

### Tests and /design

- `tests/e2e/observing-milestones.spec.ts` pins: `#progress-messier-heading` / `#progress-caldwell-heading` counts
  (`:113,120,121,133,147,190`), 8 firsts (`:122`), 171 `[data-checklist-item]` (`:123`), `data-seen` on M31 / M13
  (`:134-135,148,191`), `[data-progress-empty]` and the Tonight link (`:124-125,150`), the milestones heading and 11
  `[data-milestone]` with `data-reached` and the text `name`, `reachedOn`, `notYet` or `progress(seen,total)`
  (`:88-106,126-127,132,146,157-158,176-177,187-189`), `[data-seen-item="M31"]` (`:149`), the dialog (`:74-86,212-259`).
  No sr-only text is asserted. Default clock `evening`.
- `tests/e2e/observing-progress.spec.ts` covers Tonight's not-seen marks only; `tonight-subnav.spec.ts:54-66` checks
  the Progress bar state on `/log/progress`; `tonight-phone.spec.ts:131-149` checks no sideways scroll at 320/375
  (EN, PL) on its own pages. `scripts/smoke.mjs` does not touch `/log/progress`.
- Unit: `progress.test.ts` (4 tests) and `milestones.test.ts` (rule, `newlyReached`, `withStored`) pin the rules,
  not the view.
- `/design` (`src/pages/design.astro`, dev-only at `:115`): fixed sample data `progressSome` / `progressNone` /
  `milestonesSome` / `milestonesNone` / `celebrateOne` / `celebrateThree` (`:672-689`); blocks `c-checklist`
  (`:3307`), `c-milestone-list` (`:3343`), `c-milestone-celebration` (`:3371`) with the matrix notes; one theme at a
  time via the cookie and its own switcher (`:898`, `:904`).
- `src/styles/rhythm-roles.test.ts:54-108` guards Tonight and ui files only; counts in allowlists are exact.

### Performance

- SSR on every request (`output: "server"`), two reads (`progress.astro:34-47`).
- Today's chips: about 3 elements per unseen chip and 5 per seen chip (`ChecklistGrid.astro:31-50`).
- Mockup measurement (dev server, PL, `q=grid&v=a`): 110 tiles with inline icons = 102,356 B raw, 2,197 B gzip,
  147 `<svg>`. The globular glyph alone is 15 circles. A `<symbol>` per family plus `<use href>` per tile keeps each
  tile's icon to one short element. No HTML-size budget exists in the repo; the plan sets and measures one on the
  preview build (lessons: "measure every size budget on the real build output").

## Code References

- `src/pages/log/progress.astro:27-117` — the view: reads, empty state, milestones band, firsts, two checklist bands.
- `src/components/progress/ChecklistGrid.astro:26-54` — chip grid, sr-only text per chip.
- `src/components/progress/MilestoneList.astro:28-62` — milestone rows.
- `src/components/progress/SeenList.astro:26-45` — seen rows.
- `src/components/progress/MilestoneCelebration.astro:56-95` — dialog markup; `:124-151` its script.
- `src/lib/progress/progress.ts:14-26,50-66` — `ChecklistItem` with `type`.
- `src/lib/progress/milestones.ts:23-56` — `MILESTONES`, `NEBULA_TYPES`, `MilestoneState`.
- `src/components/ui/fact-icons.ts:2-105` — icon vocabulary rule and maps.
- `src/components/NavIcon.astro:12-47` — hand-drawn icon precedent.
- `src/styles/contrast.test.ts:75-141`, `red-theme.test.ts:62-75`, `no-hardcoded-colors.test.ts:21-75`,
  `rhythm-roles.test.ts:54-108` — the guards a token or class change meets.

## Architecture Insights

- Contract variant: **existing design system** — extend it (tokens in `global.css`, components in `src/components/ui/`
  and feature folders, `/design` as the kitchen sink). No new token is needed for the recommended options.
- The rule/view split already holds: `observingProgress` and `milestonesOf` / `withStored` are the one rule; this
  change only adds a pure display mapping (type → family, milestone → glyph) and components.
- A badge reused by the dialog must stay Astro (server-rendered) and island-free: the dialog is Astro with a small
  script, and `fact-icons.ts`-style modules are kept out of islands (`src/components/island-imports.test.ts`).

## Historical Context (from prior changes)

- `context/archive/2026-10-09-observing-progress/plan.md:75` — type grouping and type labels were explicitly out of
  scope then; chips carry no links. `:362-367` — the chip spec (6/10 columns, `font-mono text-label`, check in a
  corner to fit 320 px, sr-only label + common name + seen). Still accurate for the current code.
- `context/archive/2026-10-11-observing-milestones/plan.md:79` — "sharing, badges or points" out of scope;
  `:348-353` the MilestoneList design; the owner picked celebration variant C on 2026-10-13.
- `context/foundation/prd.md:663-666` — progress is private: no leaderboards, no badges to share, no points beyond
  the fixed milestone set. Private badges for the fixed set are inside that line.
- `context/foundation/roadmap.md:260-275` — S-11: open unknown "badge artwork (lucide icons in a medallion or drawn
  badges) and whether the tiles show a thumbnail or only the label"; risks: badges stay private, the rule stays one,
  red mode tells every badge state apart by shape. `:338` parks social badges.

## Related Research

- `context/archive/2026-10-09-observing-progress/` and `context/archive/2026-10-11-observing-milestones/`.

## Open Questions

Product and visual choices for the owner (the plan's QUESTIONS FOR OWNER, with mockups under `evidence/owner-questions/`):
badge style, reached vs. ahead, the glyph on count badges, the grid layout, the seen state, legend and filtering, and
the icon set. The research found no missing evidence that blocks planning.
