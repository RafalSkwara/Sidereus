# Progress rewards (milestone badges, type-icon tile checklists) Implementation Plan

## Overview

Roadmap M-4 S-11 (#215), owner's request of 2026-10-17, superseding the progress part of the dropped S-03 (#171). On
`/log/progress` each of the 11 milestones gets its own badge (reached vs. ahead, progress such as "37 / 50" where it
applies), and the Messier (110) and Caldwell (61) checklists become a grid of tiles with an object-type icon and a
seen / not-seen state that red mode tells apart by shape and weight. The celebration dialog shows the same badges.
This is a `/10x-ui` change on one view (`/log/progress`) against the existing Nightfall design system; it adds no
token, no table, no route and no island.

The plan is written on the ⭐ recommended answer of every question in **QUESTIONS FOR OWNER** below; a different
answer changes only the phase named at the question.

## Current State Analysis

From `research.md` (charges and anchors there):

- `MilestoneList.astro:33-57` renders 11 identical text rows (16 px `Check` or an empty slot, name, "Reached …" /
  "Not yet" / "x / N"). The only medallion is inline in `MilestoneCelebration.astro:74-76` (always `Award`).
- `ChecklistGrid.astro:26-54` renders 171 chips "M31" / "C14"; a seen chip is `bg-primary text-primary-foreground`
  (a full `#ff0000` block with black text in red mode) with a corner `Check`. No chip shows the object's type.
- `ChecklistItem.type` already carries OpenNGC's type (`src/lib/progress/progress.ts:23,61`); the page is SSR and
  has no island, so type icons cost no catalogue data in the browser.
- No type label or icon exists anywhere; lucide 1.45.0 has `Galaxy` only, and its nearest stand-ins for the other
  families are taken by other concepts (`Sparkles` = not seen yet, `Cloud` = cloud cover, `CircleDot` = opposition,
  `Orbit` = elongation, `Sparkle` = meteor shower).
- The hardcoded-value scan finds 0 literals in the view; spacing is numeric (`py-3`, `gap-1.5`, `mb-6`, …) and none
  of the progress files is in the rhythm guard.
- The page is network-only (not a stored page), behind `/log` in `PROTECTED_ROUTES`.
- e2e pins the page through `tests/e2e/observing-milestones.spec.ts` (headings, 171 `[data-checklist-item]`,
  `data-seen`, 11 `[data-milestone]` with `data-reached` and their text, `[data-seen-item]`, the dialog).

## Desired End State

- The Milestones band is a grid of 11 badges (3 columns on a phone, 4 from `sm`), in `MILESTONES` order. Each badge
  is a medallion with its own glyph: the Moon, a ringed planet, a solar system, the galaxy, globular and nebula type
  icons for the six "first"/"all planets" milestones, and the numerals 10 / 25 / 50 / 110 / 61 for the five count
  milestones. Reached: solid 2 px `action-border` ring on `action-surface`, glyph in `primary-strong`, a check pip,
  name in heading ink and semibold, "Reached 14 Aug 2026". Ahead: dashed `control-border` ring, muted glyph, regular
  muted name, "Not yet" or "37 / 50", and, when the milestone has progress above 0, a solid, wider `primary-strong`
  arc over the ring proportional to it (ring and arc in one SVG, so red mode tells them apart by shape).
- Each checklist band opens with a legend (one row per type family present in that list: icon, plural name,
  "seen / total"), then a 6-column (phone) / 10-column (`sm`) grid of tiles in catalogue order, each tile a type icon
  over "M31" / "C14". Seen: 2 px `action-border` on `action-surface`, icon in `primary-strong`, semibold number,
  check in a corner. Not seen: 1 px `border`, muted icon and number. Each tile reads aloud as
  "[C20,] label, common name, type, seen / not seen". The SeenList stays under each grid.
- The celebration dialog shows each reached milestone's badge (large size) instead of the one `Award`.
- `/design` shows the badge, the tile, the legend and the icon set in the 7-state matrix, with a forced red sample.
- The progress components are on the rhythm roles and in the rhythm guard; CLAUDE.md names the new module, the
  components and the extended use of the action tokens.

Verify: the e2e suite (incl. the extended `observing-milestones.spec.ts`), `/design` screenshots in dark, light and
red at 390 px and desktop, and a signed-in `/log/progress` with a 37-object log at 320 / 390 px and desktop in EN
and PL.

### Key Discoveries:

- `src/lib/progress/progress.ts:14-26` — `ChecklistItem { id, number, label, commonName, type, seen }`: everything a
  tile needs is already on the server.
- `src/lib/progress/milestones.ts:23-56` — `MILESTONES` (11) and `MilestoneState.progress` (count and all-of-a-set
  only); "37 / 50" exists today (`countState` caps at N, `:134-136`).
- `src/components/ui/fact-icons.ts:2` — "one concept, one icon"; `src/components/NavIcon.astro:12-47` — the
  precedent for hand-drawn icons on lucide's 24-unit grid.
- `src/components/island-imports.test.ts:44-52` — `FACT_FAMILY` keeps icon-set modules out of the islands it checks
  (`MoonTimeSlider`, `TonightSkyView`, `sky-view/*`); the new `progress-icons.ts` joins it. That is enough, since
  `/log/progress` has no island. The test runs in `test:reference`, not `test:guards` (`vitest.config.ts:5-20`).
- `src/styles/contrast.test.ts:104,130,134-140` — `primary-strong` on `action-surface` (4.5), `action-border` (3) on
  background/surface/sky, `control-border` (3), `primary-strong` (3) on background/surface are pinned. One pair the
  seen tile uses is not: `heading` (the number) on `action-surface`; it passes today (red about 4.8:1) and Phase 2
  adds it to the `action-surface` row (`:134`). **No token is added**.
- `src/styles/rhythm-roles.test.ts:54-108` — `GUARDED` with exact count allowlists; a bare `gap-*` in a `grid` counts
  as vertical.
- `tests/e2e/observing-milestones.spec.ts:88-106,113-191` — text and attribute hooks the new markup must keep.
- Mockup measurement: 110 tiles with inline icons = 102,356 B raw / 2,197 B gzip (dev). A `<symbol>` sprite keeps
  each tile's icon to one `<use>`.

## What We're NOT Doing

- No sharing, export, public profile or social badge (PRD Non-Goals, `prd.md:663-666`; roadmap Parked).
- No change to the rules: `observingProgress`, `milestonesOf`, `withStored`, `NEBULA_TYPES`, the stored record and
  the celebration's save order stay as they are.
- No new milestone, no migration, no new token, no new island, no client script on `/log/progress`.
- No interactive tiles, no filters and no sorting (question P6 default); no thumbnails or photos of objects.
- No change to the SeenList's content (research charge 5, deferred: it is the only place a name and first night show,
  and e2e pins it); only its spacing moves to the roles.
- No offline storage of `/log/progress` (stays network-only) and no service-worker change.
- No change to the Firsts band's content (spacing only), the empty state's copy, or the Topbar/TabBar icon.
- No roadmap edit in this change (PR #219 is editing `roadmap.md`; the lead flips S-11's status).

## Implementation Approach

Follow `/10x-ui`'s order: contract first (the icon set, the family map and the copy, with `/design` showing them),
then one component at a time on the view (badges, then tiles), then the states, the gate and the rule. Every
mapping is a `Record<…>` keyed by `MilestoneKey`, `DeepSkyType` or the family, so `astro check` (CI) fails on a
missing key; no unit test restates a map (test-diet rubric). The only new tests are feature-level e2e assertions for
what a screenshot cannot show: the tile's screen-reader text carries type and seen state, the legend count follows
the log, the dialog shows the badge, and the checklist markup stays inside a measured budget.

## Critical Implementation Details

- **Sprite, not inline icons, for tiles.** Render one hidden `<svg>` of `<symbol id="progress-type-<family>">` per
  page (and once on `/design`), and each tile's icon as `<svg aria-hidden="true"><use href="#progress-type-…"/></svg>`.
  Hide the sprite with `absolute size-0 overflow-hidden`, never `display:none` / `hidden` (some engines then drop the
  referenced symbols). The legend, the badges and the dialog keep the normal icon components (few instances).
- **Red mode by shape.** In red `primary` = `primary-strong` = `heading` (#ff0000). Seen vs. not seen must differ by
  border width (2 px vs 1 px), fill luminance (`action-surface` #2a0000 vs. none), weight (semibold vs. regular) and
  the check glyph; reached vs. ahead by solid vs. dashed ring, the check pip and the arc. Never by hue alone.
- **The ahead ring and the arc are one SVG.** In red the arc (`primary-strong` #ff0000) is only about 1.5:1 against
  the ring (`control-border` #c80000), so they must differ by shape: the `ahead` badge has no CSS border; one SVG
  (one `viewBox`, one radius) draws the dashed ring in `stroke-control-border` and, over it, the arc **solid and one
  unit wider** in `stroke-primary-strong`, in every theme. Draw the arc with `pathLength="100"` and
  `stroke-dasharray="<pct> 100"` on the same circle rotated −90°; the percentage is computed in the frontmatter from
  `MilestoneState.progress`. These are attribute values, not Tailwind arbitrary values. `reached` keeps the CSS
  `rounded-full border-2` ring.
- **Keep the e2e hooks and the text.** `data-milestone`, `data-reached`, `data-checklist-item`, `data-seen`,
  `data-seen-item`, `#progress-*-heading` and the strings `reachedOn` / `notYet` / `progress(seen,total)` stay, so
  `observing-milestones.spec.ts` keeps passing unchanged before the new assertions are added.

## Phase 1: Contract — type families, the progress icon set, the copy

### Overview

Add the shared vocabulary the view needs, with `/design` showing it, before any view changes.

### Changes Required:

#### 1. Type families

**File**: `src/lib/progress/object-family.ts` (new)

**Intent**: One pure, island-safe display mapping from OpenNGC's type to six families, ordered for the legend, plus a
helper that counts a checklist's seen / total per family. Island-safe like `milestones.ts` (type-only imports).

**Contract**: `OBJECT_FAMILIES = ["galaxy", "globular", "open-cluster", "nebula", "planetary", "stars"] as const`;
`type ObjectFamily`; `FAMILY_OF: Readonly<Record<DeepSkyType, ObjectFamily>>` (galaxy → galaxy; globular-cluster →
globular; open-cluster → open-cluster; planetary-nebula → planetary; nebula, emission-nebula, reflection-nebula,
supernova-remnant, cluster-with-nebula → nebula; asterism, double-star, other → stars);
`familyCounts(items: readonly ChecklistItem[]): { family: ObjectFamily; seen: number; total: number }[]` in
`OBJECT_FAMILIES` order, families with `total` 0 left out (Caldwell has no `stars`). `NEBULA_TYPES` is not touched.

#### 2. The progress icon set

**File**: `src/components/progress/progress-icons.ts` (new)

**Intent**: The one vocabulary of progress icons, like `fact-icons.ts`: the drawn icons (via lucide's
`createLucideIcon`, so they behave like any lucide icon), the family → icon map and the milestone → glyph map.
Server-rendered only.

**Contract**: exports `Globular`, `OpenCluster`, `Nebula`, `Planetary`, `StarGroup`, `RingedPlanet`, `SolarSystem`
(each a `LucideIcon`); `OBJECT_FAMILY_ICONS: Readonly<Record<ObjectFamily, LucideIcon>>` (galaxy → lucide `Galaxy`,
the rest → the drawn ones); `MILESTONE_GLYPHS: Readonly<Record<MilestoneKey, { icon: LucideIcon } | { numeral: string }>>`
(first-moon → `Moon`, first-planet → `RingedPlanet`, all-planets → `SolarSystem`, first-galaxy → `Galaxy`,
first-globular → `Globular`, first-nebula → `Nebula`; messier-10/25/50/110 → "10"/"25"/"50"/"110", caldwell-all →
"61"). The header comment states the rule: an icon here means one concept, and none reuses `Sparkles`, `Sparkle`,
`Cloud`, `CircleDot`, `Orbit`, `Ellipse` or `Award`. The drawn nodes are the owner-reviewed drafts
(`evidence/owner-questions/q7-type-icons-*`), 24-unit grid, stroke 2, round caps and joins:

```ts
// globular: centre disc, 6 dots on r=6.5, 8 smaller dots on r=10 offset by π/8
["circle", { cx: 12, cy: 12, r: 2.5 }] + ring(6, 6.5, 0, r 0.6) + ring(8, 10, π/8, r 0.4)
// open cluster
circles (6,7,r1.6) (15,4.5,r0.8) (19,11,r1.8) (10.5,13,r0.8) (5,18.5,r0.8) (14.5,18.5,r1.4)
// planetary: ring, central star, dotted halo
circle r6; circle r1; circle r10 strokeDasharray "1 3"   (all at 12,12)
// nebula: cloud, dashed lower edge, two stars
path "M3 13c0-3 3-5 5-4 1-3 5-4 7-2 2.5-1 6 1 5.5 4"
path "M21 15c-1 2.5-4 3.5-6 2.5-2 2-6 2-7.5 0C5 18 3 16.5 3 13" strokeDasharray "2 2.5"
circles (10,12.5,r0.8) (14.5,11.5,r0.5)
// star group (asterism)
path "m5 17 7-10 7 6"; circles r1.5 at (5,17) (12,7) (19,13)
// ringed planet
circle (12,12,r5.5); path "M7.2 15.5C3.6 17.6 1.6 19.6 2.3 20.6c1 1.5 7-1 13.2-5.5S23 6.1 21.8 4.6c-.7-.9-3-.3-6 1.4"
// solar system
circle (12,12,r2); circle (12,12,r6); path "M21.5 9.5A10 10 0 1 1 14.5 2.3"; circles r1.3 at (18,12) (18.5,4.5)
```

#### 3. Keep the icon set out of islands

**File**: `src/components/island-imports.test.ts`

**Intent**: Add `progress-icons` to the set the guard keeps out of browser islands (it imports lucide and the drawn
icons, server-rendered only).

**Contract**: `FACT_FAMILY` (`:52`) gains `"progress-icons"`; the header comment names it.

#### 4. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Type names for the legend and the tiles' screen-reader text, and the legend's accessible name.

**Contract**: under `progress`: `types: Record<ObjectFamily, { one: string; heading: string }>` and
`legendLabel: (p: { list: string }) => string`. EN: galaxy "galaxy" / "Galaxies"; globular "globular cluster" /
"Globular clusters"; open-cluster "open cluster" / "Open clusters"; nebula "nebula" / "Nebulae"; planetary "planetary
nebula" / "Planetary nebulae"; stars "star group" / "Stars and asterisms"; `legendLabel` "{list} by type". PL:
"galaktyka" / "Galaktyki"; "gromada kulista" / "Gromady kuliste"; "gromada otwarta" / "Gromady otwarte"; "mgławica" /
"Mgławice"; "mgławica planetarna" / "Mgławice planetarne"; "grupa gwiazd" / "Gwiazdy i asteryzmy"; `legendLabel`
"{list} według typu". `pl.ts` keeps `satisfies Messages` (parity test `i18n.test.ts:39-49`).

#### 5. `/design`: the icon set

**File**: `src/pages/design.astro`

**Intent**: A "Progress icons" block showing every family icon and every milestone glyph at 40 / 20 / 16 px with its
key, in heading and muted ink, plus a `data-theme="red"` copy, so the set is reviewable in each theme before any view
uses it.

**Contract**: a new `<section aria-labelledby="c-progress-icons">` next to the progress blocks (`:3306` onwards),
built from `OBJECT_FAMILIES`, `OBJECT_FAMILY_ICONS`, `MILESTONES` and `MILESTONE_GLYPHS`; the matrix note marks
hover / focus / disabled / error / empty / loading N/A (decorative, `aria-hidden`).

### Success Criteria:

#### Automated Verification:

- Types check: `npx astro sync && npx astro check`
- Reference suite passes, incl. the island-import guard: `npm run test:reference`
- Guards pass (no hardcoded colours, red theme): `npm run test:guards`
- Lint passes on the changed files: `npx eslint --max-warnings 0 src/lib/progress/object-family.ts src/components/progress/progress-icons.ts src/pages/design.astro src/components/island-imports.test.ts src/i18n/messages/en.ts src/i18n/messages/pl.ts`

#### Manual Verification:

- `/design` "Progress icons" block screenshotted in dark, light and red at 390 px: every glyph legible at 16 px, none
  reads as another concept's lucide icon

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual
confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Milestone badges on the page and in the dialog

### Overview

Add the shared badge, turn the Milestones band into a badge grid, and show the badges in the celebration dialog.

### Changes Required:

#### 1. The badge

**File**: `src/components/progress/MilestoneBadge.astro` (new)

**Intent**: The decorative medallion of one milestone in one state, shared by the list and the dialog; tokens only,
red-safe by shape.

**Contract**: props `{ milestone: MilestoneKey; reached: boolean; progress?: { seen: number; total: number }; size?: "md" | "lg" }`;
root `<span data-milestone-badge={milestone} aria-hidden="true">`. `md` = `size-16`, glyph `size-8` or a numeral in
`font-display text-title font-semibold`; `lg` = `size-20`, glyph `size-10`, a 2-digit numeral in `text-display` and
a 3-digit numeral ("110") in `text-title` (Archivo expanded at `text-display` would overflow the 76 px interior).
Reached: `rounded-full border-2 border-action-border bg-action-surface text-primary-strong` plus a check pip in the
lower right (`bg-primary text-primary-foreground`, `Check` with `strokeWidth` 3). Ahead: no CSS border, glyph
`text-muted-foreground`, and one SVG for the dashed `control-border` ring plus, when `progress.seen > 0`, the solid,
wider `primary-strong` arc (Critical Implementation Details). No text inside it beyond the numeral; the meaning is in
the list item's text.

#### 1b. The contrast pin for the seen number

**File**: `src/styles/contrast.test.ts`

**Intent**: Hold the pair the seen tile's number uses (`text-heading` on `action-surface`), which no row pins today.

**Contract**: the `action-surface` row (`:134`) gets `heading` beside `primary-strong` in `fg` (floor 4.5, all four
theme groups); its comment names the milestone badges and the seen tiles.

#### 2. The Milestones band

**File**: `src/components/progress/MilestoneList.astro`

**Intent**: A grid of 11 badge items instead of rows; same states, same strings, same hooks.

**Contract**: `<ul data-milestone-list class="grid grid-cols-3 gap-x-3 gap-y-group sm:grid-cols-4">`; each
`<li data-milestone={key} data-reached?>` is a centred column: `MilestoneBadge` (`md`), the name (`text-label`,
`break-words`; reached `font-semibold text-heading`, ahead `text-muted-foreground`) at `mt-line`, then the status line
(`text-caption text-muted-foreground`): `reachedOn`, `progress(seen,total)` or `notYet`, as today. Rhythm roles only.

#### 3. The celebration

**File**: `src/components/progress/MilestoneCelebration.astro`

**Intent**: Show the reached milestones' own badges instead of the generic `Award`, so the dialog and the page match.

**Contract**: replace the medallion (`:74-76`) with a `flex flex-wrap justify-center gap-3` row of
`MilestoneBadge size="lg" reached` per key (in `MILESTONES` order, as passed). Everything else (dialog, label, names,
Continue, See your progress, script, `specimen`, `idBase`) unchanged. Drop the `Award` import.

#### 4. `/design`

**File**: `src/pages/design.astro`

**Intent**: The badge in every state and the new band, with the dialog specimens picking up the badges.

**Contract**: a `MilestoneBadge` block: reached icon, reached numeral, ahead with no progress ("Not yet"), ahead at
0 / N, ahead at 37 / 50, ahead at 4 / 7, `lg` reached icon, `lg` reached "25" and `lg` reached "110"; plus a forced
`data-theme="red"` row. The existing
`c-milestone-list` and `c-milestone-celebration` blocks render the new components from the same sample data
(`:672-689`); add a sample with 37 Messier objects seen so the arc shows. Matrix notes: hover, focus-visible,
disabled N/A (not interactive), error N/A (a failed stored read falls back to the derived states, a failed log read
shows the page's `ServerError`), empty = `milestonesNone`, loading N/A (server-rendered).

### Success Criteria:

#### Automated Verification:

- Types check: `npx astro check`
- Reference and guard suites pass, incl. the new contrast pin: `npm run test:reference && npm run test:guards`
- Lint passes on the changed files: `npx eslint --max-warnings 0 src/components/progress src/pages/design.astro src/styles/contrast.test.ts`
- The milestone journey still passes unchanged, and the page has no sideways scroll at 320/375 px: `npx playwright test tests/e2e/observing-milestones.spec.ts tests/e2e/tonight-phone.spec.ts` (local recipe, see Testing Strategy)

#### Manual Verification:

- `/design` badge, band and dialog blocks screenshotted in dark, light and red at 390 px and desktop: reached and
  ahead tell apart by shape in red; Polish names wrap inside the 3-column grid at 320 px without sideways scroll
- Live dialog after a save that reaches "First galaxy" shows the galaxy badge (local preview)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual
confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Tile checklists with a legend

### Overview

Turn both checklists into type-icon tiles with a per-list legend, render the icons through one sprite, put the
progress page on the rhythm roles, and measure the checklist markup.

### Changes Required:

#### 1. The sprite

**File**: `src/components/progress/ObjectTypeSprite.astro` (new)

**Intent**: One hidden SVG of six `<symbol>`s (one per family, from `OBJECT_FAMILY_ICONS`) that the tiles reference,
so 171 tiles do not repeat the paths.

**Contract**: `<svg aria-hidden="true" focusable="false" class="absolute size-0 overflow-hidden">` holding
`<symbol id="progress-type-<family>" viewBox="0 0 24 24">` with the icon's nodes (render the icon component inside the
symbol, or its node list, with `stroke="currentColor"`, width 2, round caps). Rendered once per document: by the page
and, in this phase, by `/design` (see 5 below).

#### 2. The tiles

**File**: `src/components/progress/ChecklistGrid.astro`

**Intent**: Each object a tile: type icon over the number, seen by weight and shape, read aloud with its type.

**Contract**: `<ul aria-label={label} class="grid grid-cols-6 gap-line sm:grid-cols-10" data-checklist-grid>`; each
`<li data-checklist-item={id} data-seen? data-family={family}>`: `relative flex h-14 min-w-0 flex-col items-center
justify-center rounded-lg font-mono text-caption`; seen `border-2 border-action-border bg-action-surface
font-semibold text-heading` with the icon in `text-primary-strong` and a `Check` (`size-3`, stroke 3) at the top
right; not seen `border border-border text-muted-foreground`. Icon: `<svg class="size-5"><use href="#progress-type-…"/></svg>`,
`aria-hidden`. The visible "M31" / "C14" is `aria-hidden`; the `sr-only` text is
"[C20, ]label[, common name], type (`types[family].one`), seen | not seen", in a span marked `data-tile-sr` so e2e can
match it exactly. Not interactive (no link, no button, no tabindex). The corner check must not cover the centred icon
at 320 px (tile about 41 px wide): if it does, move the icon and number lower (`justify-end` with the number's own
padding) or make the check `size-2.5`.

#### 3. The legend

**File**: `src/components/progress/ChecklistLegend.astro` (new)

**Intent**: Explain the icons and show progress per type, above each grid.

**Contract**: props `{ items: readonly ChecklistItem[]; label: string }`; `<ul aria-label={legendLabel({list})}
class="grid grid-cols-2 gap-x-4 gap-y-line sm:grid-cols-3" data-checklist-legend>`; one `<li data-legend-family={family}>`
per `familyCounts(items)` row: icon component (`size-5`, muted, `aria-hidden`), `types[family].heading`, and
`count({seen,total})` in `font-mono text-caption text-muted-foreground`, right-aligned; wraps at 320 px.

#### 4. The page

**File**: `src/pages/log/progress.astro`, `src/components/progress/SeenList.astro`

**Intent**: Render the sprite once, a legend above each grid, and move the page's own spacing to the roles.

**Contract**: `ObjectTypeSprite` once inside the loaded branch; in each checklist `Band`: (Caldwell note,) legend,
grid at `mt-group`, SeenList at `mt-group`. Replace `mb-6`, `mt-3`, `py-3 first:pt-0 last:pb-0`, `mb-4` (`:69,71,84,110`)
and SeenList's `mt-4`, `py-3` (`:27,31`) with `mt-group` / `mb-group`, `mt-line`, `py-item first:pt-0 last:pb-0`, and
the Firsts row's `gap-y-1` (`:84`) with `gap-y-line` (the gap only shows when the row wraps). Headings, ids, `data-*`
hooks and strings unchanged.

#### 5. `/design` keeps its icons

**File**: `src/pages/design.astro`

**Intent**: The existing `c-checklist` block already renders `ChecklistGrid`; without the sprite its tiles would show
empty `<use>`s until Phase 4.

**Contract**: render `ObjectTypeSprite` once in the document (one line); Phase 4 only extends the specimens.

### Success Criteria:

#### Automated Verification:

- Types check: `npx astro check`
- Reference and guard suites pass: `npm run test:reference && npm run test:guards`
- Lint passes on the changed files: `npx eslint --max-warnings 0 src/components/progress src/pages/log/progress.astro src/pages/design.astro`
- Build passes: `npm run build`
- The milestone journey still passes unchanged, with no sideways scroll at 320/375 px: `npx playwright test tests/e2e/observing-milestones.spec.ts tests/e2e/tonight-subnav.spec.ts tests/e2e/tonight-phone.spec.ts` (local recipe)
- The checklist markup is measured on the preview build: the `outerHTML` length of the two `[data-checklist-grid]` blocks plus the sprite, in the e2e journey's state (0–1 seen) and with 37 Messier and 6 Caldwell seen, before (today's chips) and after, raw and gzip; recorded in `implementation-notes.md`

#### Manual Verification:

- Signed-in `/log/progress` with the 37-object log at 320, 390 px and desktop, EN and PL, dark, light and red: no
  sideways scroll, legend wraps, seen tiles tell apart by border, fill, weight and check in red, icons legible, and
  the corner check does not cover the icon at 320 px (also on the `/design` tiles)
- VoiceOver (or the accessibility tree in Playwright) reads a tile as "M31, Andromeda Galaxy, galaxy, seen"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual
confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: States, `/design`, the screenshot gate, the guard and the rule

### Overview

Close the 7-state matrix for the new components, add the feature-level e2e assertions, guard the spacing, and leave
the rule in CLAUDE.md.

### Changes Required:

#### 1. `/design`

**File**: `src/pages/design.astro`

**Intent**: Tiles and legend in every state next to the badges.

**Contract**: the `c-checklist` block (using the sprite rendered once in Phase 3) shows: a row of tiles covering all six
families seen and not seen, Messier with the 37-seen sample, Caldwell with its prefix, the legend for both lists, the
empty list (`progressNone`), and a forced `data-theme="red"` copy of the tile row and legend. Matrix note: default
shown; hover, focus-visible, disabled N/A (not interactive); error N/A (the page's `ServerError`); empty shown;
loading N/A (server-rendered with the page).

#### 2. e2e

**File**: `tests/e2e/observing-milestones.spec.ts`

**Intent**: Pin what screenshots cannot: screen-reader text, a count that follows the log, the dialog's badge, the
checklist markup budget. Clock-pinned through `tests/e2e/helpers.ts` like the rest of the spec.

**Contract**: in the existing journey (`observing-milestones.spec.ts:108-191`), with the expected strings built from
`en` (label, `localCommonName`, `progress.types.<family>.one`, `progress.seen` / `progress.notSeen`, `progress.count`):

- step 2 (M31 rated 2): the M31 tile's `[data-tile-sr]` has exactly the text "M31, Andromeda Galaxy, galaxy, not seen"
  and `data-family="galaxy"`; the Messier legend's `[data-legend-family="galaxy"]` count is exactly `0 / 40`;
- step 3 (edited to 4): the tile's sr text is exactly "M31, Andromeda Galaxy, galaxy, seen"; the galaxy legend count
  is exactly `1 / 40`;
- **new step 3b (rating changed to 1–2)**: edit the M31 entry from 4 to 2; the tile has no `data-seen` and its sr text
  ends in "not seen", the galaxy legend is back to exactly `0 / 40`, the Messier heading to `0 / 110`, and
  "First galaxy" stays reached on `galaxyNight` (the stored record); then edit it back to 4 (dismissing a dialog if
  one opens, `dismissCelebrationIfOpen`) so step 5 starts as today;
- step 5 (the entry becomes M13): galaxy legend exactly `0 / 40`, globular exactly `1 / 29`, M31 without `data-seen`;
- in the celebration test, the open dialog holds `[data-milestone-badge="first-galaxy"]`;
- the markup budget: in the journey's state, the summed `outerHTML` length of the two `[data-checklist-grid]` blocks
  and the sprite is under the Phase 3 measurement plus about 10 %, so the pin follows this change's markup and not the
  shell's.

No new spec file. The sr strings are exact (`toHaveText`), never a substring: "not seen" contains "seen", and Polish
"jeszcze nie zaobserwowano" contains "zaobserwowano".

#### 3. Rhythm guard

**File**: `src/styles/rhythm-roles.test.ts`

**Intent**: Keep the progress components on the roles.

**Contract**: `GUARDED` gains `components/progress/MilestoneList.astro`, `MilestoneBadge.astro`,
`ChecklistGrid.astro`, `ChecklistLegend.astro`, `SeenList.astro` and `pages/log/progress.astro`, each with an exact
allowlist (expected empty; any needed exception named with its reason).

#### 4. The rule

**File**: `CLAUDE.md`

**Intent**: Tell the next agent where the progress vocabulary lives and how its states read.

**Contract**: in "Observing progress" / "Observing milestones": `object-family.ts` (`FAMILY_OF`, `familyCounts`),
`progress-icons.ts` (drawn icons, `OBJECT_FAMILY_ICONS`, `MILESTONE_GLYPHS`; one concept per icon; out of islands),
`MilestoneBadge` (shared by `MilestoneList` and `MilestoneCelebration`), `ChecklistGrid` tiles through
`ObjectTypeSprite`, `ChecklistLegend`, the e2e hooks (`data-family`, `data-legend-family`, `data-milestone-badge`,
`data-tile-sr`). One sentence: the families are a display grouping; "First nebula" follows `NEBULA_TYPES`, which
includes planetary nebulae, so M57 alone reaches it while the legend's "Nebulae" stays at 0 (both rules are right).
In "UI (Nightfall)" Clickables: the action tokens now also serve the milestone badges and seen tiles (both
non-interactive), and red tells their states by border width, dash, fill and glyph.

### Success Criteria:

#### Automated Verification:

- Types check: `npx astro check`
- Reference and guard suites pass, incl. the extended rhythm guard: `npm run test:reference && npm run test:guards`
- Lint passes on the changed files: `npx eslint --max-warnings 0 src tests/e2e/observing-milestones.spec.ts --ignore-pattern '.claude/**'`
- Build passes: `npm run build`
- The whole e2e suite and smoke pass the way CI runs them (lessons): `npm run test:e2e` and `npm run smoke` (local recipe)
- Hardcoded-value scan on the view's files returns 0 (the `/10x-ui` grep over `src/pages/log/progress.astro` and `src/components/progress/*`)

#### Manual Verification:

- Screenshot gate: `/design` progress blocks and the signed-in page in dark, light and red at 390 px and desktop,
  EN and PL, saved under `evidence/after/`, compared with `evidence/before-*`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual
confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None new. The mappings are `Record`s keyed by `MilestoneKey`, `DeepSkyType` and `ObjectFamily`: a missing key fails
  `astro check` (CI), so "every milestone has a glyph" and "every type has a family" are compile-time invariants.
  `familyCounts` is shown on `/design` and pinned by the e2e legend count.
- Guards that grow: `island-imports.test.ts` (`progress-icons`), `rhythm-roles.test.ts` (six files).

### Integration Tests:

- `tests/e2e/observing-milestones.spec.ts` (extended, Phase 4): the exact sr text of a tile (type and seen state),
  exact legend counts at steps 2, 3, 3b and 5, the new step 3b (an edit that drops the rating to 1–2 un-sees the tile
  and lowers the counts while "First galaxy" stays reached), the dialog's badge, and the checklist markup budget. The
  existing assertions stay unchanged and must pass at the end of Phases 2 and 3.
- `tests/e2e/tonight-phone.spec.ts` (unchanged) already has `/log/progress` in `APP_PAGES` (`:51`) and fails on
  sideways scroll at 320/375 px; Phases 2 and 3 run it.

### Running the e2e specs

The local recipe in `context/handoff.md` ("Local e2e recipe"), on this worktree's ports: preview on **4413**, the
forecast fixture on **4414** (`FIXTURE_PORT=4414`), local Supabase keys inline on the command, never exported; stop
only these two ports afterwards.

### Manual Testing Steps:

1. Sign in on the local preview, log M31 (rating 4) from Tonight: the dialog shows the galaxy badge; Continue.
2. Open `/log/progress`: "First galaxy" badge reached with its date; the M31 tile seen; the galaxy legend row 1 / 40.
3. Log enough objects to pass 37 Messier: "50 Messier objects" shows 37 / 50 and the arc at about three quarters.
4. Repeat 2-3 in red mode at 390 px and in Polish at 320 px.
5. Re-rate M31 to 2: the tile goes back to not seen, the legend to 0 / 40, "First galaxy" stays reached (stored).

## Performance Considerations

171 tiles render on the server on every request. The sprite keeps each tile to an `li`, one `svg` + `use`, one
visible span and one `sr-only` span (plus the check when seen). Phase 3 measures on the preview build,
before and after for the checklist markup only (the two grids plus the sprite, `outerHTML`), not the whole document,
so the Topbar, TabBar or shell of other changes cannot move it; Phase 4 pins that number in the e2e journey's own state
(lessons: "measure every size budget on the real build output … and pin the result"). No client JavaScript is added
to the page.

## Migration Notes

None: no schema, no stored data, no service-worker change. The milestone record and the derived states are read as
before.

## Plan review triage

Review: `context/changes/ui-progress-rewards/reviews/plan-review.md` (2026-10-17, NEEDS ATTENTION, 0 critical, 5
warnings, 5 observations, all LOW). Triage by the orchestrator, applied to this plan (docs only).

| Finding                                                    | Decision       | What changed in the plan                                                                                                                                                                                                                                      |
| ---------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1 "110" overflows the `lg` badge                          | Accepted       | Phase 2 §1: `lg` 3-digit numeral in `text-title`, 2-digit stays `text-display`; Phase 2 §4: `lg` "25" and "110" specimens.                                                                                                                                    |
| F2 e2e assertion that cannot fail, step not in the journey | Accepted       | Phase 4 §2: exact sr text (`[data-tile-sr]`, `toHaveText`) and exact legend counts at steps 2, 3, 3b and 5; new step 3b (rating 4 → 2 un-sees M31, lowers the counts, "First galaxy" stays reached, then back to 4); Phase 3 §2 adds the `data-tile-sr` hook. |
| F3 arc vs. dashed ring in red, overlay geometry            | Accepted       | Critical Implementation Details and Phase 2 §1: the ahead ring and the arc are one SVG, no CSS border on ahead; the arc is solid and one unit wider in every theme.                                                                                           |
| F4 `/design` tiles without icons between Phases 3 and 4    | Accepted       | Phase 3 §5: `ObjectTypeSprite` rendered once on `/design` in Phase 3; Phase 4 §1 only extends the specimens; Phase 3 lint includes `design.astro`.                                                                                                            |
| F5 `gap-y-1` in `progress.astro:84`                        | Accepted       | Phase 3 §4: `gap-y-1` → `gap-y-line`, so the Phase 4 allowlist stays empty.                                                                                                                                                                                   |
| F6 corner check may cover the icon at 320 px               | Accepted       | Phase 3 §2: the check must clear the icon (fallback `justify-end` or `size-2.5`); Phase 3 manual check and Progress 3.7 include it.                                                                                                                           |
| F7 one contrast pair unpinned; guard descriptions          | Accepted       | Phase 2 §1b: `heading` added to the `action-surface` row of `contrast.test.ts:134`; Key Discoveries corrected (the island guard covers three islands and runs in `test:reference`); Phase 1 criteria and Progress 1.2 / 1.3 relabelled.                       |
| F8 "First nebula" vs. the legend's "Nebulae"               | Accepted as is | Phase 4 §4: one CLAUDE.md sentence that families are a display grouping and "First nebula" follows `NEBULA_TYPES`. No rule change.                                                                                                                            |
| F9 the HTML budget measures the whole document             | Accepted       | Phase 3 criterion, Phase 4 §2 and Performance Considerations: measure and pin the `outerHTML` of the two grids plus the sprite in the journey's own state; Progress 3.6 relabelled.                                                                           |
| F10 sideways-scroll guard not in Phases 2 and 3            | Accepted       | `tests/e2e/tonight-phone.spec.ts` added to the Playwright commands of Phases 2 and 3 (Progress 2.4, 3.5) and to Testing Strategy.                                                                                                                             |

The reviewer agreed with every ⭐ recommendation in P1–P7 (with F1 for P3, F3 for P2 and F6 for P4). The owner's
answers are still pending.

## QUESTIONS FOR OWNER

Każde pytanie ma rekomendowaną opcję (⭐); plan jest napisany na rekomendacjach, więc implementacja może ruszyć bez
odpowiedzi. Inna odpowiedź zmienia tylko fazę podaną przy pytaniu. Makiety są w
`context/changes/ui-progress-rewards/evidence/owner-questions/` (zrobione na tymczasowej stronie serwera dev, już
usuniętej; dane przykładowe: 37 obiektów Messiera, 6 Caldwella, 4 planety, Księżyc; po polsku, 390 px i desktop).
Stan dzisiejszy dla porównania: `evidence/before-c-milestone-list-*.png`, `evidence/before-c-checklist-*.png`,
`evidence/before-c-milestone-celebration-*.png`.

**P1. Styl odznaki kamienia milowego?** (Faza 2, `MilestoneBadge`) Makiety: `q1-badge-style-dark-390.png`,
`q1-badge-style-red-390.png`, `q1-badge-style-dark-desktop.png`, `q1-badge-style-red-desktop.png`.

- ⭐ **A. Medalion z ikoną.** Okrąg w tokenach akcji, jak dzisiejszy medalion w oknie gratulacji. Plus: spójny z oknem
  gratulacji i z ikoną „Postępy” w nawigacji; najprostszy kod (zwykły `rounded-full`). Minus: najmniej „odznakowy”.
- **B. Heksagonalna odznaka.** Sześciokąt rysowany w SVG. Plus: wygląda jak klasyczna odznaka. Minus: nowy kształt,
  którego nie ma nigdzie w aplikacji; SVG na każdą odznakę.
- **C. Ikona w pierścieniu z łukiem postępu.** Cienki pierścień, łuk pokazuje postęp. Plus: postęp widać od razu.
  Minus: zdobyta i niezdobyta różnią się głównie długością łuku; odznaki bez postępu (np. „Pierwszy Księżyc”) mają
  tylko pusty pierścień.

**P2. Jak odróżnić zdobyte od tych przed tobą?** (Faza 2) Makiety: `q2-reached-ahead-dark-390.png`,
`q2-reached-ahead-red-390.png`. We wszystkich wariantach zdobyta ma pełny medalion, ptaszek, pogrubioną nazwę i datę.

- **A. Przerywany obrys + tekst** („Jeszcze nie” albo „37 / 50”). Plus: najprostsze. Minus: odznaki licznikowe
  nie pokazują postępu graficznie.
- ⭐ **B. Przerywany obrys + łuk postępu + tekst.** Jak A, a odznaka z postępem większym od zera dostaje łuk na
  obrysie. Plus: postęp widać i w trybie czerwonym (kształt, nie kolor). Minus: trochę SVG w odznace.
- **C. Wyblakła sylwetka + pasek postępu.** Przygaszona ikona (przezroczystość) i cienki pasek pod tekstem. Plus:
  wyraźnie „zablokowane”. Minus: w trybie czerwonym wyblakłe odznaki są ledwo widoczne (patrz makieta), pasek to
  dodatkowy element w wąskiej kolumnie.

**P3. Znak na odznakach licznikowych (10 / 25 / 50 / 110 Messiera, wszystkie 61 Caldwella)?** (Faza 1,
`MILESTONE_GLYPHS`) Makiety: `q3-count-glyph-dark-390.png`, `q3-count-glyph-red-390.png`. Sześć pozostałych odznak
ma własne ikony (Księżyc, planeta z pierścieniem, układ planet, galaktyka, gromada kulista, mgławica).

- ⭐ **A. Liczba jako znak** („10”, „25”, „50”, „110”, „61”). Plus: każda odznaka jest inna i mówi, ile trzeba;
  liczby czytelne w każdym motywie. Minus: mniej „obrazkowe”.
- **B. Rosnące ikony** (gwiazda → odznaka → medal → puchar → korona). Plus: poczucie awansu. Minus: ikony lucide
  `Award` / `Medal` / `Trophy` / `Crown` same nie mówią „ile”; `Award` już znaczy „Postępy”.
- **C. Liczba + mała ikona.** Plus: jedno i drugie. Minus: przy 64 px oba elementy są małe, w 320 px ciasno.

**P4. Układ siatki Messier / Caldwell?** (Faza 3) Makiety: `q4-grid-a-dense-*`, `q4-grid-b-large-*`,
`q4-grid-c-grouped-*` (dark i red, 390 px i desktop).

- ⭐ **A. Gęste kafelki: ikona typu + numer**, 6 kolumn na telefonie, 10 na desktopie, kolejność katalogowa. Plus:
  cała lista na jednym-dwóch ekranach, widać „dziury” w katalogu i typ każdego obiektu. Minus: nazw nie widać na
  kafelku (są w czytniku ekranu i na liście „Zaobserwowane do tej pory”).
- **B. Większe kafelki: ikona + numer + nazwa**, 2 kolumny na telefonie, 4 na desktopie. Plus: nazwy widoczne. Minus:
  110 kafelków to ok. 55 rzędów przewijania na telefonie, Caldwell daleko w dół.
- **C. Pogrupowane według typu**: podsekcja na typ z licznikiem, kafelki bez ikon. Plus: od razu widać „nie mam
  żadnej mgławicy planetarnej”. Minus: kolejność numerów tylko wewnątrz grupy, trudniej znaleźć konkretne M.

**P5. Wygląd stanu „zaobserwowany” na kafelku?** (Faza 3) Makiety: `q5-seen-state-dark-390.png`,
`q5-seen-state-red-390.png`, `q5-seen-state-light-390.png`.

- **A. Wypełnienie kolorem głównym (jak dziś).** Plus: najmocniejszy kontrast. Minus: w trybie czerwonym każdy
  zaobserwowany obiekt to jaskrawoczerwony blok; przy kilkudziesięciu to oślepiająca plama w nocy.
- ⭐ **B. Ciemne tło akcji + gruby obrys + ptaszek**, ikona w kolorze akcentu; niezaobserwowany: cienki obrys,
  wyciszony. Plus: wyraźne w każdym motywie przez grubość obrysu, wypełnienie i ptaszek, a w czerwonym nie razi; te
  same tokeny co medalion odznaki. Minus: w trybie jasnym mniej krzykliwe niż A.
- **C. Pełny obrys vs. przerywany.** Plus: najmniej „ciężkie”. Minus: 100+ przerywanych ramek daje szum, a w trybie
  czerwonym przerywane ciemne ramki są słabo widoczne.

**P6. Legenda i filtrowanie?** (Faza 3) Makiety: `q6-legend-filter-dark-390.png`, `q6-legend-filter-red-390.png`,
`q6-legend-filter-*-desktop.png`.

- ⭐ **A. Legenda z licznikami, bez filtrów.** Nad każdą siatką: ikona, typ, „zaobserwowane / wszystkie”. Plus: zero
  JavaScriptu i stanów; legenda tłumaczy ikony i pokazuje postęp per typ. Minus: nie da się ukryć zaobserwowanych.
- **B. Legenda + przełącznik Wszystkie / Niezaobserwowane / Zaobserwowane** (przyciski 44 px, parametr `?show=` po
  stronie serwera). Plus: szybko widać, co zostało. Minus: nowy stan strony, przyciski do testów i dostępności; strona
  jest tylko online, więc każde przełączenie to nowe zapytanie.
- **C. Filtr typów (chipy) + przełącznik niezaobserwowanych.** Plus: najwięcej możliwości. Minus: najwięcej kodu, przy
  320 px chipy zajmują pół ekranu (patrz makieta).

**P7. Ikony typów obiektów?** (Faza 1, `progress-icons.ts`) Makiety: `q7-type-icons-dark-390.png`,
`q7-type-icons-red-390.png`.

- ⭐ **B. Własny zestaw**: `Galaxy` z lucide + 5 rysowanych w stylu lucide (gromada kulista, gromada otwarta,
  mgławica, mgławica planetarna, grupa gwiazd), w jednym module jak `fact-icons.ts`. Plus: każda ikona znaczy jedno
  i przypomina obiekt. Minus: 5 ikon do utrzymania (rysunki są gotowe w planie, Faza 1).
- **A. Tylko lucide** (`Galaxy`, `CircleDotDashed`, `Grip`, `CloudFog`, `Disc`, `Asterisk`). Plus: zero rysowania.
  Minus: `Grip` wygląda jak uchwyt, `CloudFog` jak pogoda, `Disc` jak płyta; lepsze odpowiedniki (`Sparkles`,
  `Cloud`, `CircleDot`) już znaczą co innego w aplikacji.

Bez pytania, w planie: okno gratulacji pokaże odznakę zdobytego kamienia (albo kilka obok siebie) zamiast
ogólnego `Award`. Makiety: `plan-celebration-dark-390.png`, `plan-celebration-red-390.png`,
`plan-celebration-light-390.png`.

## References

- Research and charges: `context/changes/ui-progress-rewards/research.md`
- Owner-question mockups: `context/changes/ui-progress-rewards/evidence/owner-questions/`; before:
  `context/changes/ui-progress-rewards/evidence/before-*.png`
- Prior changes: `context/archive/2026-10-09-observing-progress/plan.md`,
  `context/archive/2026-10-11-observing-milestones/plan.md`
- Roadmap S-11: `context/foundation/roadmap.md:260-275`; PRD Non-Goals `context/foundation/prd.md:663-666`
- Patterns: `src/components/ui/fact-icons.ts`, `src/components/NavIcon.astro`, `src/pages/design.astro:3306-3406`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Contract — type families, the progress icon set, the copy

#### Automated

- [ ] 1.1 Types check: `npx astro sync && npx astro check`
- [ ] 1.2 Reference suite passes, incl. the island-import guard: `npm run test:reference`
- [ ] 1.3 Guards pass (no hardcoded colours, red theme): `npm run test:guards`
- [ ] 1.4 Lint passes on the changed files

#### Manual

- [ ] 1.5 `/design` "Progress icons" block screenshotted in dark, light and red at 390 px

### Phase 2: Milestone badges on the page and in the dialog

#### Automated

- [ ] 2.1 Types check: `npx astro check`
- [ ] 2.2 Reference and guard suites pass, incl. the new contrast pin
- [ ] 2.3 Lint passes on the changed files
- [ ] 2.4 The milestone journey still passes unchanged, and the page has no sideways scroll at 320/375 px

#### Manual

- [ ] 2.5 `/design` badge, band and dialog blocks screenshotted in dark, light and red at 390 px and desktop
- [ ] 2.6 Live dialog after a save that reaches "First galaxy" shows the galaxy badge

### Phase 3: Tile checklists with a legend

#### Automated

- [ ] 3.1 Types check: `npx astro check`
- [ ] 3.2 Reference and guard suites pass
- [ ] 3.3 Lint passes on the changed files
- [ ] 3.4 Build passes: `npm run build`
- [ ] 3.5 The milestone journey, sub-nav and phone specs still pass unchanged
- [ ] 3.6 The checklist markup (grids plus sprite) is measured before and after and recorded in `implementation-notes.md`

#### Manual

- [ ] 3.7 Signed-in `/log/progress` with the 37-object log at 320, 390 px and desktop, EN and PL, dark, light and red, the check clear of the icon at 320 px
- [ ] 3.8 A tile reads as "M31, Andromeda Galaxy, galaxy, seen" to a screen reader

### Phase 4: States, `/design`, the screenshot gate, the guard and the rule

#### Automated

- [ ] 4.1 Types check: `npx astro check`
- [ ] 4.2 Reference and guard suites pass, incl. the extended rhythm guard
- [ ] 4.3 Lint passes on the changed files
- [ ] 4.4 Build passes: `npm run build`
- [ ] 4.5 The whole e2e suite and smoke pass the way CI runs them
- [ ] 4.6 Hardcoded-value scan on the view's files returns 0

#### Manual

- [ ] 4.7 Screenshot gate: `/design` progress blocks and the signed-in page in dark, light and red, EN and PL, saved under `evidence/after/`
