# Grouped, icon-led facts with a spacing rhythm (ui-fact-rhythm) Implementation Plan

## Overview

This change gives the Tonight focused pages' item lists a fact rhythm. It is the second change of the ui-refine split (`context/changes/ui-refine/audit.md`: findings 2, 4, 5, 8 and 9; owner decisions 2, 3 and 5).

- **Window and Best** become two small stat cards, side by side in one row at every width.
- **Every other fact** is one icon-led line.
- **A hairline** separates "when" from "what and how".
- **Spacing** comes from three rhythm roles instead of per-file steps.
- **Group labels** share one `text-overline` role.
- **Icons** come from one concept-keyed map, which absorbs S-07's event-kind icons.

The views are Targets, Planets, the Moon, Sky events and Nights. The finder's what-to-expect line shares the new component.

**Sources**
- The research and its five charges: `research.md` (C1-C5).
- The reverted experiment of the stat cards and fact rows: `evidence/exp-stat-cards/`.
- The before matrix from main c650a8a: `evidence/before/`.
- The plan review: `reviews/plan-review.md` (F1-F10). All its findings are applied, with the owner's answers of 2026-10-14 (see "Decisions").

## Current State Analysis

From `research.md`, on main c650a8a (ui-quiet-actions merged).

**Facts**
- Each view hand-builds its facts as same-weight `text-label` paragraphs.
- Window and Best are a `<dl>` of two plain rows (`TargetDetails.astro:44-57`).
- Only the what-to-expect line (`ObjectDetails.astro:42-45`) and the solar safety line (`SkyEventList.astro:118-123`) carry an icon. The finder copies the expect line (`FinderContent.astro:94-97`).

**Planets**
- Planet facts have no labels. "34″" stands alone (`PlanetCard.astro:24-41`).
- The Polish strings fuse the label into the value (`pl.ts:550-553`, "jasność −1,9 mag", "faza 62%").

**Spacing**
- 43 distinct spacing utilities appear across the 15 view files.
- The "between lines" role alone has six spellings.
- Rows are `py-5`, with groups at `mt-4`/`mt-5` inside (C2).

**Group labels**
- They are `text-label font-semibold` in `text-primary` or in muted (`NightStrip.astro:36,50,82-90`, `SkyEventList.astro:58`) (C3).

**Icons**
- Event-kind icons are a local map (`SkyEventList.astro:29-36`). No shared vocabulary exists (C4).

**Nights**
- Each verdict night repeats the dashboard's verdict-reason sentence (`NightStrip.astro:71`) (C5).

**Tooling**
- Tailwind 4.3.3 publishes `--spacing-<name>` as `gap-<name>`, `mt-<name>`, `py-<name>`, `space-y-<name>`, and `--text-<name>` with `--line-height`, `--letter-spacing` and `--font-weight` sub-keys as a type role.
- Tokens in `@theme inline` need no red value (`red-theme.test.ts` reads only `:root` and `[data-theme="red"]` blocks).
- A `@theme inline` value cannot be overridden by a media query (`global.css:645`). The roles are therefore fixed at every width, as the owner chose.

**Tests**
- No test reads `dl`/`dt`/`dd`, the Window/Best text, planet or Moon fact text, the reason or the note. There are no screenshot baselines.
- These locators are fragile and must survive (research, "Tests that pin this markup"):
  - `[data-expect]` text exactly the phrase;
  - `[data-event-visibility]` text exactly the sentence;
  - the event name is the row's first `h4`;
  - one visible mark per row;
  - Nights `h3` + sibling `ol` and `ol > li` count 7;
  - Planets `getByRole("listitem")` cards (no `<li>` inside a card);
  - `li#object-…` and `li#planet-…` ids;
  - `tonight-phone.spec`'s no-sideways-scroll at 320/375 px.
- `telescope-selector.spec.ts:160-161` asserts that without eyepieces the ranking does **not** contain "Find with" or the `noneFit` prefix.
- `build.test.ts:745-766` pins the planet fact wording.
- `npx vitest related` finds no test for `.css` or `.astro` files ("No test files found", exit 0; review F6). The colour, red and contrast guards read files with `readFileSync`. **`npm test` is the real unit gate** for every phase.

## Desired End State

**Targets, Planets and the Moon**
- Each item reads in three groups:
  1. the identity (name, detail line; for a planet, its labelled facts: Brightness, Apparent size, Phase, Rings);
  2. the **stat pair** (Window "20:51–07:10"; Best "03:21" over "NNE, 87°");
  3. after a hairline, the "what and how" facts, each with its icon: what you'll see (an Eye in the accent colour), the eyepieces (Telescope), why (Info, muted).
- Then come the actions from ui-quiet-actions.
- Rows sit 40 px from their rule on each side, groups are 24 px apart, lines 8 px.

**Moon**
- The Moon's up and faint lines beside the disc are icon-led facts, spaced inside the island's slot.

**Sky events**
- Each row keeps its kind icon, name and visible mark.
- Its details, visibility, notes and safety line become one fact per line.
- Night headings use the overline role.

**Nights**
- The group labels use the overline role.
- Each night's reason, cloud and moon lines are muted icon-led facts.

**Contract**
- `/design` shows the roles, the overline, `StatCard`/`StatPair` (including the 320 px row-width measurement), `Fact`/`FactList`, the icon map, a Moon target and a Nights strip, in dark, light and red, with Polish values.
- A guard test stops the view family from using numeric vertical spacing again.
- CLAUDE.md names the roles, the components, the accent-Eye and safety-icon exceptions, and the stat cards as the second boxed exception.

**Verify**: the screenshot matrix (`evidence/before` vs `evidence/after`), the whole e2e suite and smoke, and the owner's look at the before/after crops.

### Key Discoveries:

- `TargetDetails` already owns the spacing between its parts so callers carry none (`TargetDetails.astro:2-6`). The new components extend that. The Moon target block also renders through `TargetDetails`, so it will get the pair. The experiment's Moon shot does not show that block, because the Moon was not a target that night (review F3). Phase 3 adds a Moon target specimen to `/design` to show it.
- **Slotted text can lose a space.** "Do szczegółów:10 mm Plössl" rendered when a sentence was slotted straight into the experiment's `Fact` (`evidence/exp-stat-cards/planets-pl-dark.jpg`). Fact content must sit in its own element.
- **`MoonTimeSlider.tsx:70` puts `space-y-2` on its children**, but Astro wraps island children in `<astro-slot>` (`display: contents`), so the margins land on a box-less element. The lines stand tight today (`evidence/before/moon-phone-en-dark.jpg`; review F3). The facts must sit in one `FactList` inside the slot.
- **Desktop.** A half-width stat card at 1280 px floats its value in a 360 px box (`evidence/exp-stat-cards/targets-desktop-pl-light.jpg`). Cap the pair's width from `sm`.
- **The expanded rows are narrow at 320 px** (review F2): 288 px column − 26 px (the scroll region's border and `px-3`, `TargetsPageContent.astro:246`) − 40 px (`pl-10`) leaves about 222 px for the pair. That is about 105 px per card and about 79 px of text, against about 88-95 px for "20:51–07:10" at `text-body` and about 85 px for "Widoczność" with its icon. In the top five (`ObjectCard`) there is about 112 px of text per card. None of the current checks sees this:
  - `tonight-phone.spec` measures the document with rows closed;
  - `capture.mjs` shoots at 390/1280 with rows closed.
- `TonightTiles.astro:160,170` reads `moonCard.phaseText` and `solarSystem.entries[0].reason`. Their types and wording stay, and the dashboard is not touched.
- **Red mode** (review F8, measured from `global.css` hexes):
  - `--surface` on `--background` is 1.03:1 in red (1.06 dark, 1.07 light), so a card's fill is practically invisible there.
  - Its shape comes only from the faint `--border` (1.14:1 on surface), exactly like the gear cards.
  - Every new ink pair (muted on surface 3.23:1, heading on surface 5.07:1 in red) is inside the existing `contrast.test.ts` pins.
  - The overline in muted drops from `text-primary` (#ff0000, 5.20:1) to #c40000 (3.31:1) at 13 px: above the pinned 3:1, but quieter.
- **S-08 adjustable-session-plan** (worktree `adjustable-session-plan`, HEAD 8bc0c1b with Phases 1-4 committed, Phase 5 uncommitted on 2026-10-14) will almost certainly merge first (review F4). Its overlap with this change:
  - `ObjectRow`'s root `<li>`: adds `id="object-${entry.id}" class="scroll-mt-4"`.
  - **The same washed-out `<li>` line in `TargetsPageContent.astro`** that Phase 3 edits: S-08 makes it `flex min-h-11 scroll-mt-4 items-center gap-3 py-3`. The merged result is `flex min-h-11 scroll-mt-4 items-center gap-3 py-group`.
  - `ObjectCard`: adds `data-object-card` (Phase 5, uncommitted).
  - `TonightPageSkeleton`: its `layout="plan"` branch (Phase 5).
  - `FinderContent.astro:48`: the `from` prop, not the expect line.
  - `design.astro` (+165 lines of plan specimens and `reachable: null`), `en.ts`/`pl.ts` (`tonight.pages.plan.*`, `errors.*`), `tests/e2e/helpers.ts`, `tests/e2e/tonight-phone.spec.ts`, CLAUDE.md.
  - This plan does not edit `tonight-phone.spec.ts` (research said it did; it does not).
  - S-08's new row ids make `what-to-expect.spec.ts:92-101` count closed and washed-out rows through `li[id^="object-"]`. That spec belongs to S-08 to narrow (to `ol > li[data-object]` of the top five, or `[data-object-card]`); the orchestrator relays it.
  - If this change rebases onto S-08 before S-08 fixes the spec, Phase 3's run of `what-to-expect` goes red for that reason, not this change's.

## What We're NOT Doing

- **The dashboard** (`/tonight`, `TonightTiles`, the verdict's S-07 event line): change 3, `ui-dashboard-tiles`.
- **Navigation** (the Tonight sub-nav, Progress as a destination): change 4, `ui-tonight-nav`.
- **/log, /log/progress and /gear**: change 5, `ui-log-progress-gear`.
- **The plan page** (`/tonight/plan`, `SessionTimeline`, `PlanPageContent`, the skeleton's `layout="plan"` branch): S-08 owns them. Its "Best … · window …" line keeps its wording (`tonight-dashboard.spec.ts:142`).
- **Splitting the targets' `reason`** into separate facts. It is one pre-joined string of two ranking components (`format.ts:328-333`). It stays one muted "why" fact.
- **A shorter Nights reason, or merging identical reasons (C5, D8, owner: deferred).** The sentence comes from seven reason variants shared with the dashboard verdict. A short form needs a parallel key family in both languages and the reason kind on `TonightNight`. With real weather the lines differ per night.
- **Uppercase overlines.** Polish night headings ("Noc: środa, 21 października 2026") would shout.
- **Responsive roles.** The owner chose fixed values at every width.
- **New colour tokens or contrast pins.** The stat card reuses the gear cards' `bg-surface` and `--border`, and every new ink pair is already pinned (F8).
- **Changing `buttonVariants`** or the action row's links. That was ui-quiet-actions.
- **Editing `tonight-phone.spec.ts`.**

## Decisions

The owner's answers of 2026-10-14 (relayed by the orchestrator) to the agent's defaults D1-D8 and the review questions:

- **D1. Roles (owner: looser rhythm).** Fixed at every width.
  - `line` 8 px: between the lines of one group.
  - `group` 24 px: between the groups of one item, and the hairline's padding.
  - `item` 40 px: the padding on each side of the rule between two items holding groups (target, planet, Moon target, event).
  - **Open until Phase 1's checkpoint** (owner, 2026-10-14): "item 40 px" may instead mean 40 px in total between two items' contents (20 px on each side of the rule). Phase 1 shows both readings, and the owner chooses from the screenshots. Until then the token is `2.5rem` (40 px each side). If the owner picks 40 px in total, `--spacing-item` becomes `1.25rem` and nothing else in the plan changes, because every view uses the role.
  - A one-group row (a night, a washed-out row) is `py-group`.
- **D2. Overline** (default kept): 13 px / 20 px, weight 600, tracking 0.04em, sentence case, muted ink.
- **D3. Stat card** (default kept, with F2 and F8):
  - The gear cards' bordered `bg-surface` box, `rounded-lg`.
  - A caption label with its icon over a `font-mono text-body` semibold value.
  - Best's direction on a second muted line.
  - The pair is `grid-cols-2` at every width, capped at `max-w-md` from `sm`.
  - The grid stretches the shorter Window card to Best's height. That is accepted; the empty room sits under Window's value.
  - **In red the card keeps the faint border like the gear cards** (owner, F8). The border carries the shape there, not the fill.
- **F2. Measure first** (owner). Phase 1 builds the pair on its `/design` specimen and captures it at 320 px inside a Targets expanded-row frame (EN and PL; dark, light and red), with the fallbacks beside it. **Phase 1 then stops**, and the owner chooses from the screenshot before Phase 3 starts. Fallbacks shown:
  - (a) as planned;
  - (b) the value at `text-label` in the row only;
  - (c) the pair without the row's `pl-10` indent.
- **D4. Fact icons are muted, with two exceptions** (owner, F9). The Eye on the "what you'll see" line stays `text-primary-strong`, so the line stands out as the audit asked. The solar safety icon keeps `text-marginal`. The event kind icon keeps heading ink.
- **D5. Fact order** (default kept). Identity, then the stat pair, then the hairline, then "what you'll see" (expect or note), then the eyepieces, then why (muted).
  - The Moon target's note moves above its eyepieces.
  - A planet's labelled facts stay under its name as identity.
- **D6. Planet labels and values** (default kept):

  | Fact | EN label | EN value | PL label | PL value |
  |---|---|---|---|---|
  | magnitude | Brightness | mag −1.9 (unchanged) | Jasność | −1,9 mag |
  | size | Apparent size | 34″ | Średnica kątowa | 34″ |
  | phase | Phase | 62% lit | Faza | 62% |
  | rings | Rings | tilted 7° | Pierścienie | nachylone o 7° |

  Rendered as label, a space, then the value: "Brightness mag −1.9", "Jasność −1,9 mag".
- **D7. Event rows** (default kept). They keep the kind icon (heading ink, `size-5`) beside the name, and their facts carry their own `size-4` icons. Each detail is its own line instead of being joined with " · ".
- **D8. C5 deferred** (default kept).
- **F7. One concept, one icon** (owner). The map is keyed by concept, not by place.
  - The Moon has one icon everywhere: Moon. That covers the Moon-tonight lines, the Nights moon line and the lunar-eclipse kind.
  - The Eye means only "what you'll see".
  - "Visible" / "Not visible" get their own pair (CircleCheck / CircleSlash).
  - The map lives in `src/components/ui/fact-icons.ts`, beside the other presentational helpers (`ui/tile.ts`).

## Implementation Approach

The /10x-ui order:

1. Environment/library: nothing to add; lucide-react and Tailwind v4 are present.
2. Token values and the shared contract, ending with the owner's 320 px choice: Phase 1.
3. The copy the labels need: Phase 2.
4. The views: Phases 3 and 4.
5. The guard's last step, the rules and the gate: Phase 5.

**Phase 2 lands with Phase 3.** Phase 2's commit is made as the first commit of Phase 3's run (or squashed into it), so no commit shows label-free planet values without their labels (F10).

**The guard grows with the work** (F1). Phase 1 creates `rhythm-roles.test.ts` covering the new `ui/` components. Phases 3 and 4 add each view file as they convert it. Phase 5 adds the break check. Every exception is listed in this plan, so no implementer has to judge what counts as vertical rhythm.

Each charge maps to a phase:

| Charge | Phase(s) |
|---|---|
| C1 Fact/StatCard | 1, then 3 and 4 |
| C2 rhythm roles | 1, then 3 and 4; the guard from 1 to 5 |
| C3 overline | 1 and 4 |
| C4 icon map and planet labels | 1, 2 and 3 |
| C5 Nights reason | 4 (icons and roles); the copy is deferred |

**Delegation** (owner rule, 2026-10-14):
- UI code phases go to a subagent with `model: "opus"` at high effort. That covers components, layout, tokens and styling, `/design`, UI e2e and the guard's exception lists.
- Non-UI code (copy keys with the view model's wording) goes to `model: "sonnet"` at high effort.
- Docs, the evidence README and screenshot capture go to `model: "sonnet"` at medium effort.
- Screenshot judgement is the main session's (Opus).
- Haiku is never used for code.

**Every implementation brief**:
- gives the `nvm use` prefix up front;
- forbids web sourcing (everything needed is in `research.md`, `reviews/plan-review.md` and here);
- names the preview port 4331 and the fixture port 4401;
- says keys go inline only and `test:db` is never run;
- batches lint, types and the related tests in one command while iterating: `npx astro check && npm run lint && npx vitest related <changed .ts files> --run`. For `.css`/`.astro` changes, `npm test` is the gate.

The main session runs the full gates once per phase (`npm test`, `npm run build`, the phase's e2e list), commits, and judges the screenshots.

**Running the e2e lists** (the same for every phase and Phase 5's whole suite):
1. After `npm run build`, write `dist/server/.dev.vars` with the local Supabase URL and publishable key and `FORECAST_BASE_URL=http://127.0.0.1:4401` (the build drops it).
2. Start `FIXTURE_PORT=4401 node tests/e2e/forecast-fixture.mjs` and `npx astro preview --port 4331`.
3. Run `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test <specs>`, with the keys from `npx supabase status -o env`, inline only.

`astro dev` for `/design` also uses 4331, so the dev server and the preview never run at the same time (F6).

## Critical Implementation Details

- **Fact content contract** (F5):
  - A sentence goes in a `<p>`, and always so when it needs `first-letter:uppercase`. `::first-letter` works neither on the flex root nor on an inline `<span>`. This affects `NightStrip` `reasonText`, `ObjectDetails`' detail-with line and `MoonCard`'s detail line.
  - A short value goes in a `<span>`.
  - `label` is used only with inline content (a `<span>` value), never before a block `<p>`, where it would land on its own line.
  - Never bare text plus expressions straight in the slot. Phase 3 adds e2e checks so the lost space cannot come back.
- **Markers stay exact.** `data-expect`, `data-event-visibility` and `data-event-note` move onto the `Fact` root, whose only text is the sentence. The icon is an `aria-hidden` svg with no text, and no visible label may enter these elements. CLAUDE.md's what-to-expect paragraph then describes the marker on a `div`, not a `<p>` (Phase 5).
- **No eyepiece fact without eyepieces.** When `pair` is null, `ObjectDetails` renders no `Fact kind="eyepiece"`, so "Find with" and the `noneFit` text stay out of the DOM. `telescope-selector.spec.ts:160-161` stays as is.
- **No nested lists.** `FactList` renders a `div`, never `ul`/`ol`/`li`, because `planets-on-tonight.spec.ts:34` counts `listitem`s and `seven-night-planner.spec.ts:126` counts `ol > li`.
- **An empty `FactList` renders nothing.** It checks `(await Astro.slots.render("default")).trim()`, because `Astro.slots.has` is true for any passed slot.
- **Island guard.** `Fact`, `FactList` and the icon map are Astro and plain TS. They must never be imported by `TonightSkyView` or `MoonTimeSlider`; the Moon's facts reach the slider as server-rendered children.
- **The icon map's imports.** lucide icons plus `import type { SkyEventKind } from "@/lib/engine"` for the `satisfies` check. The import is type-only and disappears at runtime.
- **S-08 rebase** (see Key Discoveries):
  - Keep S-08's `id`/`scroll-mt-4` on `ObjectRow`'s root `<li>`.
  - Merge the washed-out `<li>` line to `flex min-h-11 scroll-mt-4 items-center gap-3 py-group`.
  - Keep `data-object-card` on `ObjectCard`.
  - Keep both changes' keys in `en.ts`/`pl.ts` and both changes' `design.astro` sections.
  - The guard's pattern skips `scroll-mt-*`.
  - This change keeps off `PlanPageContent`, `SessionTimeline`, `TonightContent`, the skeleton's plan branch and `src/lib/offline/*`.

## Phase 1: The contract, and the 320 px measurement for the owner

**Delegation**: Opus subagent, high effort (tokens, shared components, `/design`, the first guard). Capture: Sonnet subagent, medium effort. Judgement and the owner hand-off: the main session.

### Overview

Add the spacing and overline roles, the icon map and the four shared components. Show them in `/design`, including the stat pair at the real width of a Targets expanded row at 320 px. Start the rhythm guard on the new components. No view changes yet, except `SkyEventList` taking its kind and visibility-mark icons from the map. **The phase ends at an owner checkpoint**: the 320 px screenshots and the choice of fallback (F2).

### Changes Required:

#### 1. Roles

**File**: `src/styles/global.css`

**Intent**: Publish the three rhythm roles and the section-label role next to the type roles, with a comment on what each is for (C2, C3; D1, D2).

**Contract**: in `@theme inline`, after `--text-caption--line-height`:
- `--text-overline: 0.8125rem`, with `--line-height: 1.25rem`, `--letter-spacing: 0.04em`, `--font-weight: 600`;
- `--spacing-line: 0.5rem`;
- `--spacing-group: 1.5rem`;
- `--spacing-item: 2.5rem`.

They live only in `@theme inline` (no `:root` entry, so no red value is needed).

#### 2. The icon map

**File**: `src/components/ui/fact-icons.ts` (new)

**Intent**: One vocabulary of decorative lucide icons, keyed by concept, so a concept has one icon everywhere and an icon means one concept (C4, F7).

**Contract**:
- `FACT_ICONS: Record<FactKind, LucideIcon>`:
  - `when` Clock: the window, the Moon's up/sets span;
  - `best` Compass: Best, an event's best time;
  - `see` Eye: what you'll see, i.e. the expect line and a planet's or the Moon's note;
  - `eyepiece` Telescope;
  - `why` Info: the targets' reason, a planet's and the Moon's reason, a night's verdict reason, an event's not-visible reason;
  - `magnitude` SunDim, `size` Diameter, `phase` Contrast, `rings` Ellipse;
  - `moon` Moon: the Moon-tonight faint line, the Nights moon line;
  - `cloud` Cloud: an outlook night's cloud line;
  - `measure` Ruler: an event's details;
  - `tip` Lightbulb: an event's notes;
  - `safety` TriangleAlert.
- `EVENT_KIND_ICONS` is moved from `SkyEventList.astro:29-36` and still `satisfies Record<SkyEventKind, …>`. The lunar eclipse uses the same Moon icon as `FACT_ICONS.moon` (one Moon).
- `VISIBILITY_MARK_ICONS` is `{ visible: CircleCheck, notVisible: CircleSlash }` (not the Eye, which now means only "what you'll see").
- Imports: lucide-react and `import type { SkyEventKind } from "@/lib/engine"` only.

#### 3. `Fact` and `FactList`

**Files**: `src/components/ui/Fact.astro`, `src/components/ui/FactList.astro` (new)

**Intent**: One fact, an icon from the map, an optional muted label, then the value or sentence, with the rhythm owned here (C1).

**Contract**:
- `Fact` props:
  - `kind: FactKind`;
  - `label?: string` (inline values only);
  - `tone?: "default" | "muted"`;
  - `iconClass?`, used only for `see` (`text-primary-strong`, D4) and `safety` (`text-marginal`);
  - any `data-*` attributes forwarded to the root.
- `Fact` markup:
  - the root is a `div` (`flex items-start gap-2 text-label`) carrying `data-fact={kind}`;
  - the icon is `size-4 shrink-0`, `aria-hidden`, muted unless `iconClass`, with `mt-0.5` for first-line alignment;
  - then a `min-w-0 space-y-line` content wrapper holding the label (`text-muted-foreground`, followed by a real space) and the slot.
- `FactList`: a `div` with `space-y-line`. It renders nothing when its slot renders empty.
- Neither renders a list element.

#### 4. `StatCard` and `StatPair`

**Files**: `src/components/ui/StatCard.astro`, `src/components/ui/StatPair.astro` (new)

**Intent**: Window and Best as two small cards side by side at every width (decisions 2 and 5; D3).

**Contract**:
- `StatPair` is a `<dl>`, `grid grid-cols-2 gap-3 sm:max-w-md`, with an optional `class` merged last so the owner's F2 fallback can be applied by the caller.
- `StatCard` props:
  - `label`, `kind: FactKind`;
  - the slot is the value;
  - an optional named slot `sub` holds a second, muted `text-label` line.
- `StatCard` markup:
  - a `div` with `rounded-lg border border-border bg-surface px-3 py-2`;
  - a `<dt>` holding a `text-caption` muted label with a `size-3.5` icon;
  - a `<dd>` at `mt-0.5` holding the `font-mono text-body font-semibold text-heading` value.

#### 5. Event icons from the map

**File**: `src/components/tonight/SkyEventList.astro`

**Intent**: Replace the local `ICONS` and the Eye/EyeOff imports with `EVENT_KIND_ICONS` and `VISIBILITY_MARK_ICONS`.

**Contract**:
- The kind icons are unchanged (the lunar eclipse already uses Moon).
- The visible mark's icon changes from Eye/EyeOff to CircleCheck/CircleSlash. Its text and markers are unchanged.

#### 6. `/design`

**File**: `src/pages/design.astro`

**Intent**: Show the contract in the kitchen sink, in the 7-state matrix, and make the owner's F2 measurement possible.

**Contract**:
- In "Type and radius": a `text-overline` sample, and a spacing strip showing `line`, `group` and `item` at their sizes (each bar carries `data-role-sample="<role>"`).
- In "Components × states", new sections:
  - **`c-stat-pair`**:
    - the pair in EN and PL, at full width (the desktop cap) and in a 288 px column (a top-five `ObjectCard` at 320 px);
    - a frame that copies a Targets expanded row at 320 px: the scroll region's `rounded-lg border px-3`, then the `pl-10` body, so the pair gets about 222 px;
    - in that frame, fallbacks (a), (b) and (c) side by side, each labelled, EN and PL, with the longest real values ("20:51–07:10", "Widoczność", "Najlepiej", "03:21" / "NNE, 87°").
  - **`c-fact`**: `Fact` with a label and an inline value, with a sentence, muted, a two-line `<p>` block (the eyepiece pair), Polish (the "Do szczegółów: …" spacing case), the accent `see` icon and the `safety` tone.
  - **`c-fact-icons`**: the map as a grid of every concept, event kind and visibility mark, with its name.
  - **`c-item-rhythm`** (owner's D1 question): two Targets rows (an `ObjectCard`-like heading, the stat pair, the hairline and three facts, then the rule and the next row's heading), shown twice side by side in a 288 px column:
    - (i) 40 px in total between the two contents, 20 px on each side of the rule;
    - (ii) 40 px on each side of the rule, 80 px in total.
    - Each variant is labelled with its numbers. The specimen frames may use plain spacing steps (`/design` is not guarded), so variant (i) needs no second token.
- States:
  - default is shown;
  - hover, focus-visible and disabled are N/A (not interactive: no link, no control; offline leaves facts untouched);
  - error is N/A (facts show data, never an error; errors stay the page's own notices);
  - empty: a `FactList` with no facts renders nothing (an empty frame with its note);
  - loading is N/A for the component (the focused page's `TonightPageSkeleton` stands in; Phase 3 moves it to the new rhythm).

#### 7. The guard, first step

**File**: `src/styles/rhythm-roles.test.ts` (new)

**Intent**: A failing check beats a rule (F1). From this phase on, the guarded files cannot use numeric vertical spacing.

**Contract**:
- The source of each guarded file is read with comments blanked first, as `no-hardcoded-colors.test.ts` does.
- It fails on every match of `(?<![\w-])-?(?:[a-z0-9-]+:)*(?:(?:m|p)[tby]?|space-y|gap-y)-\d+(?:\.\d+)?(?![\w.])` that is not:
  - a zero value (`pt-0`, `last:pb-0`);
  - or on that file's allowlist.
- What the pattern leaves out, and why:
  - `scroll-mt-*` (the lookbehind);
  - horizontal `px`/`mx`;
  - a bare `gap-<n>` (a flex row's horizontal gap).
- Files and allowlists in Phase 1:
  - `ui/Fact.astro`: `mt-0.5`;
  - `ui/StatCard.astro`: `py-2`, `mt-0.5`;
  - `ui/FactList.astro` and `ui/StatPair.astro`: none.
- `src/pages/design.astro` is not guarded (its specimen frames use their own spacing).

#### 8. The capture for the owner

**File**: `context/changes/ui-fact-rhythm/evidence/scripts/design-sections.mjs`

**Intent**: The script has ui-quiet-actions' section ids. Point it at this change's sections, add a 320 px viewport, and print the computed heights of the three `data-role-sample` bars (8/24/40 px expected), which proves the roles compile to their values.

**Contract**:
- Sections `c-stat-pair`, `c-fact`, `c-fact-icons`, `c-item-rhythm` and the spacing strip, at 320 px (2×) and 1280 px, in dark, light and red, EN and PL.
- Output in `evidence/design/<section>-<theme>-<locale>-<width>.png`; a curated, downscaled set is committed.

### Success Criteria:

#### Automated Verification:

- Types and lint pass: `npx astro check && npm run lint`
- The whole unit suite passes, including `rhythm-roles.test.ts` and the colour, red, contrast, zone and console guards: `npm test`
- `npm run build` succeeds
- `sky-events.spec.ts` passes against a fresh local preview (see "Running the e2e lists"): `… npx playwright test sky-events`
- After the preview is stopped, `/design` on `astro dev` (port 4331) renders the three role bars at 8, 24 and 40 px computed height (the capture script prints them)

#### Manual Verification:

- `/design` at 320 px and 1280 px in dark, light and red, EN and PL:
  - the roles read as three clearly different steps;
  - the pair fits the 288 px column, and the expanded-row frame shows fallbacks (a), (b) and (c) honestly;
  - the pair is capped on desktop;
  - the Polish fact keeps the space after the colon;
  - every concept in the map has one icon, and no icon serves two concepts;
  - in red the card's faint border does not read like the hairline "Mark observed" button, and the overline stays readable
- **Owner checkpoint (F2)**: the 320 px screenshots of `c-stat-pair` (paths listed in the report) go to the owner, who picks fallback (a), (b) or (c) for the expanded rows before Phase 3 starts. The choice is recorded under "Decisions"
- **Owner checkpoint (D1)**: the 320 px screenshots of `c-item-rhythm` go to the owner with the stat-pair shots. The owner picks (i) 40 px in total or (ii) 40 px on each side. `--spacing-item` is set to match (`1.25rem` or `2.5rem`), and the choice is recorded under "Decisions"

---

## Phase 2: Planet fact labels and value wording

**Delegation**: Sonnet subagent, high effort (copy keys plus the view model's wording and its unit test; no UI). It is committed together with Phase 3's first commit (F10).

### Overview

Give each planet fact a label and make the values label-free (C4, D6), so Phase 3 can render "Brightness mag −1.9" without the label appearing twice.

### Changes Required:

#### 1. Copy

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Add `tonight.planets.factLabel` and reword the values per D6.

**Contract**:
- `tonight.planets.factLabel: { magnitude, size, phase, rings }` in both languages.
- The value functions change in these four places only:
  - EN `rings` → "tilted {degrees}°";
  - PL `magnitude` → "{mag} mag";
  - PL `phase` → "{percent}%";
  - PL `rings` → "nachylone o {degrees}°".
- EN `magnitude`, `size`, `phase` and PL `size` keep their wording.
- `pl.ts` keeps `satisfies Messages`, and the parity test covers the new keys.

#### 2. View model and its test

**Files**: `src/lib/tonight/format.ts` (`planetFactsText`, `:556-576`), `src/lib/tonight/build.test.ts` (`:745-766`)

**Intent**: The `…Text` fields keep their names and types and now carry the value-only wording. The doc comment's examples follow. The test's expected strings change, because the requirement (labelled facts) changed.

**Contract**: `TonightPlanetEntry` is unchanged in shape. The new expectations are:
- `ringText` `/^tilted \d+°$/`;
- PL `magnitudeText` `/^−?\d+,\d mag$/`;
- PL `ringText` `/^nachylone o \d+°$/`;
- PL phase `/^\d+%$/` where asserted.

### Success Criteria:

#### Automated Verification:

- Types, lint and the related tests pass in one run: `npx astro check && npm run lint && npx vitest related src/i18n/messages/en.ts src/i18n/messages/pl.ts src/lib/tonight/format.ts --run`
- The whole unit suite passes: `npm test`

---

## Phase 3: Targets, Planets, the Moon and the finder's expect line

**Delegation**: Opus subagent, high effort (layout, components, the guard's rows, UI e2e). Capture: Sonnet subagent, medium effort. Judgement: the main session.

### Overview

Rebuild the shared target details, their three callers and the skeleton on the contract (C1, C2, C4; D3-D6; the owner's F2 choice). This is the view the owner sees most. **Precondition**: the owner's F2 choice is recorded.

### Changes Required:

#### 1. The shared details

**File**: `src/components/tonight/TargetDetails.astro`

**Intent**: Window and Best become a `StatPair`. The slot sits under a hairline. The actions follow at the group step.

**Contract**:
- `StatPair` at `mt-group`:
  - Window: `windowStart`–`windowEnd`;
  - Best: the value `bestTime` and the sub line `bestDirection`.
- In an expanded row, the owner's F2 fallback applies (a prop or class from `ObjectRow`; for fallback (c), `ObjectRow` places the details outside the `pl-10` indent).
- The slot wrapper is a `FactList` with `mt-group border-t border-border pt-group`.
- The action row moves to `mt-group`, its `gap-y-2` becomes `gap-y-line`, its `gap-x-5` stays, and both links are unchanged.
- The header comment is rewritten: Window and Best side by side at every width (decision 5); every other fact on its own line.

#### 2. A target's facts

**File**: `src/components/tonight/ObjectDetails.astro`

**Intent**: Each slot line becomes a `Fact`, in D5's order.

**Contract**:
- `Fact kind="see" iconClass="text-primary-strong"` carries `data-expect={key}`, with the phrase in a `<span>`.
- `Fact kind="eyepiece"` is rendered only when `pair` is not null:
  - for a pair, it holds the two existing `<p>` lines (bold heading-ink names; the detail line keeps `first-letter:uppercase` on its `<p>`);
  - for none-fit, it holds the sentence in a `<p>`.
- `Fact kind="why" tone="muted"` holds `entry.reason` in a `<p>`.
- The local `Eye` import goes.

#### 3. Rows, page spacing and the skeleton

**Files**: `src/components/tonight/ObjectCard.astro`, `ObjectRow.astro`, `TargetsPageContent.astro`, `SeenTag.astro`, `TonightPageSkeleton.astro`

**Intent**: Rows use the item role, the page's framing spacing moves to roles, and the skeleton follows, so nothing jumps when the island swaps in (F10).

**Contract**:
- `ObjectCard`: the `<li>` is `py-item first:pt-0 last:pb-0`, and its detail line is `mt-line` (was `mt-1`).
- `ObjectRow`: the body is `pb-item pl-10`, or no indent under fallback (c). Its 44 px summary keeps `py-4`.
- `SeenTag`: `mt-3` → `mt-line`.
- `TargetsPageContent`:
  - the count line `expectLocked ? "mb-2" : "mb-4"` becomes `mb-line` / `mb-group`;
  - the locked line `mb-4` → `mb-group`;
  - the washed-out intro `mb-4` → `mb-group`;
  - the washed-out `<li>` `py-3` → `py-group` (merged with S-08's `scroll-mt-4`);
  - nothing else.
- `TonightPageSkeleton`, default (non-plan) layout only:
  - its placeholder rows move from `space-y-3 py-5` to the item and line roles, with bars standing for the stat pair (two `h-14` boxes side by side) and the fact lines;
  - its header comment is updated ("one data point per line" → the new rhythm);
  - the `layout="plan"` branch is S-08's and is not touched.

#### 4. Planets

**Files**: `src/components/tonight/PlanetCard.astro`, `SolarSystemSection.astro`

**Intent**: The planet facts become labelled facts under the name. The details follow D5.

**Contract**:
- Under the `h3`, a `FactList` at `mt-line` holds:
  - `Fact kind="magnitude"`, `"size"`, `"phase"` and `"rings"`, each with its `factLabel` and a `font-mono text-heading` value `<span>`;
  - null facts are skipped as today.
- The `<li>` is `py-item first:pt-0 last:pb-0`.
- The slot order:
  1. `Fact kind="see" iconClass="text-primary-strong"` with `entry.note` in a `<p>`;
  2. `Fact kind="eyepiece"` with the detail-with line in a `<p>`;
  3. `Fact kind="why" tone="muted"` with `entry.reason` in a `<p>`.
- `SolarSystemSection`'s `mt-2`/`mt-5`/`mt-4` move to `mt-line`/`mt-group`/`mt-group`.
- The list stays `<ol aria-label>` of `<li id="planet-<key>">`.

#### 5. The Moon

**File**: `src/components/tonight/MoonCard.astro`

**Intent**: The slider's text children become facts inside one `FactList` (so the spacing lands inside `<astro-slot>`, F3). The target block gets the shared pair and D5's order.

**Contract**:
- Children: one `FactList` holding:
  - `Fact kind="when"` with `upText` in a semibold heading-ink `<span>`;
  - `Fact kind="moon"` with `faintText` in a `<p>`;
  - the washed-out quiet link unchanged, after the list.
- The target block is `mt-item border-t pt-item`, and the not-seen mark's `<p class="mt-3">` → `mt-line`.
- Slot order:
  1. `Fact kind="see" iconClass="text-primary-strong"` with `target.note` in a `<p>`;
  2. `Fact kind="eyepiece"` with the whole-disc and detail lines (or `partDisc`), each in its `<p>` (the detail `<p>` keeps `first-letter:uppercase`);
  3. `Fact kind="why" tone="muted"` with `target.reason` in a `<p>`.
- The no-states branch (`phaseText` only) is unchanged.

#### 6. The finder's expect line

**File**: `src/components/finder/FinderContent.astro`

**Intent**: The duplicated expect markup becomes the shared `Fact` (C1). Its place above the chart and outside `[data-finder-chart]` are unchanged.

**Contract**: `Fact kind="see" iconClass="text-primary-strong" data-expect={key}` with the text in a `<span>`. The local `Eye` import goes if unused.

#### 7. Guard rows

**File**: `src/styles/rhythm-roles.test.ts`

**Intent**: Add the converted files with their exact allowlists (F1).

**Contract**:
- `TargetDetails`: none.
- `ObjectDetails`: none.
- `ObjectCard`: none (zeros are exempt; `scroll-mt-4` is outside the pattern).
- `ObjectRow`: `py-4` (the 44 px summary).
- `PlanetCard`: none.
- `MoonCard`: none.
- `SolarSystemSection`: none.
- `SeenTag`: none.

`TargetsPageContent` is not guarded: its other spacing (the no-ranking state, the "show the rest" controls) is outside this change, and S-08 edits it.

#### 8. Specimens and e2e

**Files**: `src/pages/design.astro`, `tests/e2e/planets-on-tonight.spec.ts`, `tests/e2e/what-to-expect.spec.ts`

**Intent**: Show every line and the Moon target in `/design`, and pin the labels, the spacing and the narrow pair in e2e (F2, F3, F6).

**Contract**:
- `design.astro`:
  - The "What to expect" ObjectDetails specimen gets a second sample with a find/detail pair and a reason. The shared `sampleTarget` used by the tiles is not edited.
  - A new `c-moon-card` section renders `MoonCard` with a Moon target (the night is not guaranteed to have one at capture).
- `what-to-expect.spec.ts`, in the existing test that opens a row at 320 px (`:104-120`):
  - each stat pair `dt`/`dd` has `scrollWidth <= clientWidth`;
  - in Polish on Targets (the all-clear fixture always ranks targets), no `[data-fact]` text matches `/\p{L}:\S/u`. Times like "22:10" pass, because the character before the colon is a digit.
- `planets-on-tonight.spec.ts`:
  - each card's `[data-fact="magnitude"]` and `[data-fact="size"]` contain their `factLabel` text;
  - with the Polish locale cookie (`LOCALE_COOKIE`, set in the test, as other specs do), a card's `[data-fact="eyepiece"]` text matches `Do szczegółów: \S`. This stays date-dependent: the spec skips when no planet is up. The Targets assertion above is the date-independent one.

#### 9. Before matrix

**Intent**: Have the full before set ready (F10).

**Contract**: the full 390/1280 × EN/PL × three-theme matrix of the five views was captured from main c650a8a on 2026-10-14. A curated set of 51 images is already in `evidence/before/`, including planet crops in light and red. Phase 3 only checks that it is there and does not recapture it from a changed tree.

### Success Criteria:

#### Automated Verification:

- Types and lint pass: `npx astro check && npm run lint`
- `npm test` (with the guard's new rows) and `npm run build` pass
- The affected specs pass against a fresh local preview (see "Running the e2e lists"): `… npx playwright test tonight-phone tonight-targets what-to-expect planets-on-tonight moon-as-target moon-card observation-log observing-progress observing-milestones telescope-selector onboarding tonight-sky tonight-dashboard finder-chart finder-offline red-night-mode`
- The hardcoded-value scan over the changed view files prints nothing: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|-\[[0-9.]+(px|rem)\]' src/components/tonight/{TargetDetails,ObjectDetails,ObjectCard,ObjectRow,PlanetCard,MoonCard,SolarSystemSection,SeenTag,TonightPageSkeleton}.astro src/components/ui/{Fact,FactList,StatCard,StatPair}.astro src/components/finder/FinderContent.astro`

#### Manual Verification:

- Targets (rows closed and one opened), Planets and the Moon at 390 px and 1280 px, EN and PL, dark, light and red, captured with `evidence/scripts/capture.mjs` (Sonnet, medium) and judged against `evidence/before/`:
  - three groups per item, the hairline visible;
  - the accent Eye on the "what you'll see" line;
  - the stat pair readable in red, with no button look beside the hairline;
  - Best's direction on its own line, the pair capped on desktop;
  - the owner's fallback in the expanded rows;
  - planet labels present, no lost spaces, no sideways scroll at 320 px;
  - the skeleton swap without a jump

---

## Phase 4: Sky events and the Nights page

**Delegation**: Opus subagent, high effort (layout, components, the guard's rows, UI e2e). Capture: Sonnet subagent, medium effort. Judgement: the main session.

### Overview

Bring the two list pages that are not targets onto the rhythm, the overline and the facts (C1, C2, C3, C5; D2, D7).

### Changes Required:

#### 1. Event rows

**File**: `src/components/tonight/SkyEventList.astro`

**Intent**: The rows get a header plus facts, item spacing and the overline night headings.

**Contract**:
- The night heading `h3` is `text-overline text-muted-foreground`, keeping its id and `aria-labelledby`.
- Rows are `py-item` (the first row after the heading at `pt-group`).
- Nights are separated by `space-y-item`.
- The header keeps its markup and markers:
  - the kind icon, `size-5`, `mt-0.5`;
  - the `h4` name first;
  - the single visible/not-visible mark;
  - the muted "kind · when" line with `[data-event-when]`.
- In the header, `space-y-1.5` → `space-y-line`.
- Under the header, a `FactList` at `mt-group` holds:
  - one `Fact kind="measure"` per entry of `event.details` (no longer joined with " · "), each in a `<span>`;
  - `Fact kind="best"` (visible) or `kind="why"` (not visible), carrying `data-event-visibility`, with only the sentence;
  - one `Fact kind="tip" tone="muted"` per note, carrying `data-event-note`;
  - `Fact kind="safety" iconClass="text-marginal"`, carrying `data-event-safety`, with the fixed line.
- A not-visible row keeps its muted tone on every fact.

#### 2. Nights

**File**: `src/components/tonight/NightStrip.astro`

**Intent**: The group labels use the overline. The right-hand lines become muted facts. The rows use the group role. The structure stays two `h3` + `ol` groups.

**Contract**:
- "Times in" `mb-4` → `mb-group`.
- Both group labels are `text-overline text-muted-foreground`. The outlook label keeps its dashed rule, now `mt-line border-t-2 border-dashed pt-group`.
- Rows are `py-group`, and the cells' vertical `gap-2` becomes `gap-y-line`. The headline's inline `gap-2` (dot to word) stays horizontal.
- Verdict rows:
  - the headline line (`[data-sky-headline]` with its dot) is unchanged;
  - `Fact kind="why" tone="muted"` holds `reasonText` in a `<p class="first-letter:uppercase">`;
  - `Fact kind="moon" tone="muted"` holds `moonText`.
- Outlook rows: `Fact kind="cloud" tone="muted"` holds `cloudText` (the "Cloud ~NN%" string intact), and `Fact kind="moon" tone="muted"` holds `moonText`.
- No list elements inside a row.

`NightsPageContent` and `EventsPageContent` are not changed: their shared `max-w-3xl … pt-8 space-y-6` wrapper stays, and "Times in" for Nights lives in `NightStrip`.

#### 3. Guard rows

**File**: `src/styles/rhythm-roles.test.ts`

**Contract**:
- `SkyEventList`: `mt-0.5` (the kind icon's alignment), `gap-y-1` (the wrap gap between the name and the mark when they wrap).
- `NightStrip`: none.

#### 4. `/design`

**File**: `src/pages/design.astro`

**Intent**: Nights gets a specimen; it has none today.

**Contract**:
- A `c-night-strip` section renders `NightStrip` from fixed sample nights: two verdict nights (one go with a reason, one no-darkness night without one) and two outlook nights (one with a cloud range).
- States: default shown; empty is N/A, because the page renders its own "no nights" notice, not the strip; the other states are N/A (not interactive).
- The SkyEventList specimens pick up the new rows on their own.

### Success Criteria:

#### Automated Verification:

- Types and lint pass: `npx astro check && npm run lint`
- `npm test` (with the guard's new rows) and `npm run build` pass
- The affected specs pass against a fresh local preview: `… npx playwright test sky-events seven-night-planner tonight-phone tonight-dashboard offline red-night-mode`

#### Manual Verification:

- `/tonight/events` and `/tonight/nights` at 390 px and 1280 px, EN and PL, dark, light and red, against `evidence/before/`:
  - the night headings and group labels read as quiet labels, not blue lines, and stay readable in red;
  - each event's facts read one per line under its header;
  - the visible mark reads with its new icon;
  - the solar safety line keeps its amber icon;
  - Nights' reason and moon lines carry their icons and stay muted;
  - no sideways scroll at 320 px

---

## Phase 5: The guard's break check, the rules, the screenshot gate and the whole suite

**Delegation**:
- The break check: the main session.
- CLAUDE.md and comments: Sonnet subagent, medium effort.
- The after-matrix capture and the evidence README: Sonnet subagent, medium effort.
- Screenshot judgement, the whole e2e suite and smoke: the main session.

### Overview

Make the contract stick (/10x-ui "Make it stick"), record the evidence and run everything the way CI does.

### Changes Required:

#### 1. Break check

**File**: `src/styles/rhythm-roles.test.ts`

**Intent**: Prove the guard bites.

**Contract**: add `mt-4` to `PlanetCard` and see `npm test` fail on it, add `space-y-3` to `SkyEventList` and see it fail, then revert both. Record the run in the evidence README.

#### 2. Rules and comments

**Files**: `CLAUDE.md` (the UI section, the What-to-expect paragraph, the Sky events paragraph; `AGENTS.md` is a symlink), the header comments of `TargetDetails`, `ObjectDetails`, `PlanetCard`, `MoonCard`, `SkyEventList` and `NightStrip`

**Intent**: The next agent finds the roles and components and keeps using them.

**Contract**:
- **Tokens bullet**: adds `text-overline` (section labels, muted, sentence case) and the rhythm roles: `line` 8, `group` 24, `item` 40 px (`gap-line`, `mt-group`, `py-item`); items holding groups are `py-item`, one-group rows `py-group`. It names the guard test.
- **Components bullet**: adds:
  - `Fact`/`FactList` (every fact line on a Tonight item: an icon from `src/components/ui/fact-icons.ts`, one concept one icon; sentences in `<p>`, values in `<span>`; no list elements; the Eye in `text-primary-strong` on "what you'll see" and the amber safety icon are the two icon exceptions);
  - `StatCard`/`StatPair` (Window and Best only).
- **Nightfall composition**: the stat cards are the second deliberate boxed exception after the gear cards, keeping the faint border in red.
- **What-to-expect paragraph**: the marker is `<div data-expect="<key">` (a `Fact` root), not `<p>`.
- **Sky events paragraph**: a sentence that the kind and visibility-mark icons come from the shared map.

#### 3. Evidence

**Files**: `context/changes/ui-fact-rhythm/evidence/{after/,crops/,design/,README.md}`

**Intent**: The screenshot gate. It is the same matrix as `evidence/before/` plus `/design`'s sections, curated and downscaled, with a README in the style of ui-quiet-actions'.

**Contract**:
- `scripts/capture.mjs` over targets, planets, moon, nights and events, × EN/PL × dark/light/red × 390/1280.
- `scripts/design-sections.mjs` for `c-stat-pair`, `c-fact`, `c-fact-icons`, `c-moon-card` and `c-night-strip`.
- Crops of one target, one planet and one event row in light and red, before and after.

### Success Criteria:

#### Automated Verification:

- `npx astro check`, `npm run lint` and `npm test` pass; the guard goes red on both deliberate breaks and green after reverting them
- `npm run build` succeeds
- The whole e2e suite and smoke pass against a fresh local preview, the way CI runs them (lessons.md): `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run test:e2e` and the same prefix on `npm run smoke`; the counts are recorded for the PR

#### Manual Verification:

- The owner looks at the before/after crops (target, planet, event row; light and red) and the `/design` sections, and accepts the rhythm, the stat cards and the icons, or names what to change

---

## Testing Strategy

### Unit Tests:

- `rhythm-roles.test.ts`: from Phase 1, growing per phase, with the break check in Phase 5.
- `build.test.ts`: the planet fact wording (Phase 2).
- The existing guards on every phase: `no-hardcoded-colors`, `red-theme`, `contrast`, `i18n` parity, `runner-zone-guard`, `no-console-guard`.
- `npm test` is the unit gate. `vitest related` is an iteration aid only.

### Integration Tests:

- **Locators that must survive** (no edits expected):
  - `what-to-expect` (exact phrase in `[data-expect]`);
  - `sky-events` (first `h4`, exact visibility sentence, one mark per row with its exact text, safety on solar rows only);
  - `seven-night-planner` (`h3` + sibling `ol`, `ol > li` = 7, exact headline, "Cloud ~NN%");
  - `planets-on-tonight` (listitem cards);
  - `tonight-targets`, `tonight-sky` (row ids), `onboarding` (`/25 mm/` in one element), `telescope-selector` (no eyepiece fact without eyepieces), `finder-chart` (`finderLink` by `aria-label`).
- **New**:
  - `planets-on-tonight`: planet labels, and the Polish eyepiece spacing;
  - `what-to-expect`: stat pair overflow at 320 px in an opened row, and the date-independent Polish "no lost space after a colon" check.
- **`tonight-phone.spec.ts`**: no sideways scroll at 320/375 px on every Tonight page in EN and PL (unchanged spec).
- **S-08's id change** narrows `what-to-expect.spec.ts:92-101` on its side (relayed by the orchestrator).

### Manual Testing Steps:

1. `/design` in three themes at 320 and 1280 px, and the owner's F2 choice (Phase 1).
2. Targets, Planets and the Moon in the full matrix against `evidence/before/` (Phase 3).
3. Events and Nights in the full matrix (Phase 4).
4. The owner's look at the before/after crops (Phase 5).

## Performance Considerations

None material. The new components render static markup on the server, and the icons are the same lucide SVGs inlined per use.

The Targets page at 390 px grew about 13% in height in the experiment, with item 32 (5196 to 5886 px at 2×). With the owner's item 40 and group 24 it grows more, about 20%, estimated and not measured. That is the looser rhythm the owner chose. The list of the other objects is still capped by its scroll region (`max-h-128`).

## Migration Notes

There is no data migration. The planet fact wording changes for stored offline copies only when a page is next refreshed online. Old copies keep the old wording until they expire, which is harmless.

## References

- Research and charges: `context/changes/ui-fact-rhythm/research.md`.
- Plan review: `context/changes/ui-fact-rhythm/reviews/plan-review.md` (F1-F10, all applied).
- The audit and the owner's decisions: `context/changes/ui-refine/audit.md:46-84,106-119,227-265`.
- The experiment: `context/changes/ui-fact-rhythm/evidence/exp-stat-cards/` (`experiment.diff`, crops); the before matrix: `evidence/before/`.
- The previous change of the split: `context/changes/ui-quiet-actions/plan.md` (action row, red-mode rules, evidence scripts, the e2e environment line).
- Lessons: `context/foundation/lessons.md` (the whole e2e suite before a PR; fix flakes failing-first).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The contract, and the 320 px measurement for the owner

#### Automated

- [x] 1.1 Types and lint pass — 9385b8a
- [x] 1.2 The whole unit suite passes, including the new guard: `npm test` — 9385b8a
- [x] 1.3 `npm run build` succeeds — 9385b8a
- [x] 1.4 `sky-events.spec.ts` passes against a fresh local preview — 9385b8a
- [x] 1.5 `/design` on `astro dev` renders the role bars at 8, 24 and 40 px (after the preview is stopped) — 9385b8a

#### Manual

- [ ] 1.6 `/design` at 320 px and 1280 px in three themes, EN and PL: distinct roles, pair and fallbacks honest, desktop cap, Polish spacing, one icon per concept, red card and overline checked
- [ ] 1.7 Owner checkpoint: the 320 px `c-stat-pair` screenshots go to the owner, who picks fallback (a), (b) or (c)
- [ ] 1.8 Owner checkpoint: the 320 px `c-item-rhythm` screenshots go to the owner, who picks 40 px in total or 40 px on each side

### Phase 2: Planet fact labels and value wording

#### Automated

- [ ] 2.1 Types, lint and the related tests pass in one run
- [ ] 2.2 The whole unit suite passes: `npm test`

### Phase 3: Targets, Planets, the Moon and the finder's expect line

#### Automated

- [ ] 3.1 Types and lint pass
- [ ] 3.2 `npm test` (with the guard's new rows) and `npm run build` pass
- [ ] 3.3 The affected specs pass against a fresh local preview
- [ ] 3.4 The hardcoded-value scan over the changed view files prints nothing

#### Manual

- [ ] 3.5 Targets (closed and opened rows), Planets and the Moon in the 390/1280 × EN/PL × three-theme matrix judged against `evidence/before/`

### Phase 4: Sky events and the Nights page

#### Automated

- [ ] 4.1 Types and lint pass
- [ ] 4.2 `npm test` (with the guard's new rows) and `npm run build` pass
- [ ] 4.3 The affected specs pass against a fresh local preview

#### Manual

- [ ] 4.4 `/tonight/events` and `/tonight/nights` in the matrix: quiet readable labels, one fact per line, new visible mark, safety icon kept, no sideways scroll

### Phase 5: The guard's break check, the rules, the screenshot gate and the whole suite

#### Automated

- [ ] 5.1 `npx astro check`, `npm run lint` and `npm test` pass; the guard goes red on both deliberate breaks
- [ ] 5.2 `npm run build` succeeds
- [ ] 5.3 The whole e2e suite and smoke pass against a fresh local preview, counts recorded

#### Manual

- [ ] 5.4 The owner accepts the before/after crops and the `/design` sections
