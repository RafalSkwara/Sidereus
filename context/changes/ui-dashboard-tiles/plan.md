# Dashboard tiles on the rhythm roles and shared facts (ui-dashboard-tiles) Implementation Plan

## Overview

This change gives the `/tonight` dashboard the rhythm and the facts that ui-fact-rhythm gave the focused pages. It is the third change of the ui-refine split (`context/changes/ui-refine/audit.md`: finding 4 for the dashboard, the S-07 notes on the verdict's event line and the events tile; owner decisions 1, 3 and 5 as amended on 2026-10-15).

- **The tiles** become Tonight list rows on the `item` role (40 px between two tiles' contents). Each heading sits on the `line` role over its content, and an explanatory caption is its own group.
- **The Planets tile's reason** becomes the same "why" `Fact` it is on `/tonight/planets`.
- **The verdict's sky-event line** becomes a `Fact` with its event kind's icon, so it reads as its own fact instead of the end of the reason.
- **The verdict's lower lines** (what to do next, the forecast's freshness) move a group away from the reason.
- **The skeleton** stays in step tile by tile. The rhythm guard covers the dashboard files.

No icon goes on any tile heading (decision 2B). There is no new token and no new copy.

**Sources**
- The research and its five charges: `research.md` (C1-C5).
- The reverted experiment: `evidence/exp/experiment.diff`, its shots in `evidence/exp/`, and the before shots from main 42ce808 in `evidence/before/`. They were measured on a production preview (4331, fixture 4401, local Supabase) and on `/design` (dev server, 4331).

## Current State Analysis

From `research.md`, on main 42ce808 (ui-fact-rhythm #167 merged).

**Tiles**
- `TILE_ROW_CLASS` is `py-4 sm:py-5` (`src/components/ui/tile.ts:9`), and `TILES_GAP_CLASS` is `pt-3 sm:pt-6` (`src/components/tonight/sky-band.ts:11`).
- The content under a tile heading is offset `mt-3`, `mt-4` or `mt-5` depending on the tile (`TonightTiles.astro:118,138,149,156,161,170,174,181`, `EventsTile.astro:25`).
- The targets list rows are `py-1.5` (`:120`); the legend is `mt-2` and the caption `mt-3` (`:40,130`).
- The Planets reason is a plain `mt-2` muted line (`:171`).
- The nights grid is a bare `gap-2` (`:181,183`).
- On a phone, tiles sit 32 px apart against 40 px between the focused pages' rows.

**The verdict**
- The event line is `<p class="mt-1 text-label font-medium text-muted-foreground" data-verdict-event>` (`VerdictCard.astro:92-96`), with no icon.
- The kind of the event it words is on the view (`TonightSkyEvent.kind`, `src/lib/tonight/sky-events.ts:26`; `eventsVerdictLine` words `events.tonight[0]`, `:340-358`) but never reaches `VerdictCard`.
- What to do next and the forecast line are `mt-3` under the reason (`:97,100,104`).
- `VERDICT_MIN_HEIGHT_CLASS = "min-h-42 sm:min-h-59"` (`sky-band.ts:45`) is the measured EN go verdict at 360 / 640 px.

**`Fact`**
- `Fact` takes only a `FactKind`, and its icon is `FACT_ICONS[kind]` (`src/components/ui/Fact.astro:19,31`).
- The event-kind icons are a second map in the same module (`EVENT_KIND_ICONS`, `fact-icons.ts:89-96`). The two key sets don't overlap: the fact kinds are `when` … `safety`, and the event kinds are `lunar-eclipse` … `meteor-shower`.

**The skeleton**
- `TonightSkeleton.astro:39-124` hand-copies the verdict's and each tile's offsets.

**Guards**
- None of `TonightTiles`, `EventsTile`, `VerdictCard`, `TonightSkeleton` or `tile.ts` is in the rhythm guard (`src/styles/rhythm-roles.test.ts:55-100`).
- `fact-islands.test.ts` scans only the islands' own files. `VerdictCard` reaches `TonightSkyView` as server-rendered children, so it may use `Fact`.

**Contracts other code relies on**
- `Tile`'s root is the `<a>`. The `/design` depth selectors `*:*:bg-accent` / `*:bg-accent` depend on it (`design.astro:641-646`).
- The `tile-*-heading` ids and `aria-labelledby` names (`tests/e2e/tonight-dashboard.spec.ts:60-68`).
- The targets tile keeps `<ul><li>` (`landing-screenshot.spec.ts:76-80`).
- The markers stay: `data-tonight-tiles`, `data-events-tile-line` and `data-verdict-event`. The verdict line's text must match `VERDICT_LINE_START`, with no link or button in it (`tonight-dashboard.spec.ts:25-35,104-105`).
- The phone first screen at 390×844 hides `[data-verdict-event]` while it measures (`tests/e2e/tonight-phone.spec.ts:66-68,73-119`).

## Desired End State

- **Tiles**
  - Every tile row is `py-item`. Below `sm` that is 8 px taller per tile; from `sm` it is unchanged.
  - Every tile's content sits `mt-line` under its heading, from one shared class in `tile.ts`.
  - The targets list rows are `space-y-line`.
  - The targets legend and caption, and the nights caption, are a second group at `mt-group`. Within it the caption follows the legend at `mt-line`.
  - The Planets reason is `Fact kind="why" tone="muted"`.
  - The nights grid uses `gap-x-2`, and its columns use `gap-line`.
  - `TILES_GAP_CLASS` is `pt-line`. On a phone the first tile's heading stays where it is (8 + 20 = 12 + 16 px).
- **The verdict**
  - On an event night the line is a muted `Fact` at `mt-line`. Its icon is the event kind's, except a solar eclipse, which gets the amber safety icon (D4). `data-verdict-event` sits on the `Fact` root.
  - The date → headline gap is `mt-line` (8 px, as today).
  - What to do next and the forecast line are `mt-group`, and the second next-step line is `mt-line`.
  - `VERDICT_MIN_HEIGHT_CLASS` is re-measured. The expectation is `min-h-42` unchanged and `sm:min-h-62` instead of `sm:min-h-59`; the measured values win.
- **The skeleton** mirrors every tile and the verdict. At 390 and 1280 px (EN, dark, the fixture night) each skeleton tile row is within 2 px of the real row. The page's skeleton/real difference is no worse than before (−35 / −36 px).
- **The phone first screen is unchanged.** At 390×844 the headline ends at 149 px, the Site card at 701 px and the Telescope title at 746 px, against the TabBar at 779 px (`tonight-phone.spec.ts` green, EN and PL).
- **The rhythm guard** covers `TonightTiles`, `EventsTile`, `VerdictCard`, `TonightSkeleton` and `tile.ts`, with exact allowlists.
- **The contrast test** pins the amber safety icon on the sky stops it can sit on.
- **CLAUDE.md** says how a tile is spaced and that the verdict's event line is a `Fact`.
- **`/design`** shows the verdict line with its icons, and tile specimens on the roles.

Verify with the gates of each phase, `evidence/after/` (the same names as `evidence/before/`), and the whole e2e suite plus smoke on a fresh local preview.

### Key Discoveries:

- **The phone first screen does not move**: the experiment kept 149 / 701 / 746 against 779 px, EN and PL (`research.md` C2). The 33 px slack is untouched, so the spec needs no new room.
- **`class:list` does not merge Tailwind conflicts**: `[caption, "mt-group"]` rendered `mt-line` in the experiment. Overrides go through `cn()`.
- **`Fact` is a `div`**: inside a tile's `<a>` it goes in a `div` wrapper, never a `span`.
- **The solar-eclipse kind icon** (lucide `Eclipse`, 16 px) reads as the Clock (`when`) beside "Tomorrow, 11:22: …" (`evidence/exp/c-verdict-event-390-en-light.jpg`, third specimen). This is the reason for D4.
- **The amber icon is not pinned on the dark or red sky yet**: the contrast test pins `marginal` on `zenith` / `horizon` only in the `night` scope (`contrast.test.ts:125`), and on `background` in dark and light (`:89`).
- **The landing image `public/landing/tonight.png`** (1280×1125: the verdict, the sky, the slider and the first tile) changes with the desktop verdict's +12 px. CLAUDE.md asks for a recapture after a Tonight redesign.

## What We're NOT Doing

- **No icons on tile headings** (decision 2B). The audit's "Tile gains an icon prop" is dropped.
- **No icon on the events tile's line, the Plan line or the Moon line** (D5). The Moon keeps its disc.
- **No new tokens and no new copy.** No i18n key changes, and `eventsVerdictLine` / `eventsTileLine` keep their strings.
- **The area below the tiles** (`TonightContent.astro:222`: the sky-check card, the setup prompts, the eyepieces prompt) stays as is (research, Deferred).
- **The gear row** (`GEAR_ROW_GAP_CLASS`, `GearCard`'s padding and `GEAR_CARD_MIN_HEIGHT_CLASS`) stays as is. It is first-screen geometry, already 8 px on a phone.
- **`sky-band.ts` is not guarded.** Its band geometry (`pt-12`, `pb-10`, `-mt-16`, the slider row) is not rhythm. Only `TILES_GAP_CLASS` changes there.
- **The headline → reason `mt-1` and the dot's nudge stay**: they are the display line's own leading and alignment. They go on the guard's allowlist.
- **No "Edited by you" marker on the Plan tile.** D13 asked only that the tile follow the edited plan, and it already does (`TonightTiles.astro:52-64`).
- **The page's skeleton/real difference outside the tiles** (−35 px at 390 EN) is not addressed. It is pre-existing.
- **No change to the focused pages, the navigation (change 4) or /log, /log/progress and /gear (change 5).**
- **No change to the not-seen Sparkles** (`NotSeenMark`). It is distinguishable from the meteor-shower `Sparkle` (research C3, observation).

## Decisions

Agent defaults, waiting for the owner at plan review (the reviewer relays them in Polish). The ones marked **(owner question)** are the open UI choices; the others follow from the owner's earlier rules.

- **D1. A tile's rhythm** (follows ui-fact-rhythm's roles).
  - The row is `py-item`, like every Tonight list row.
  - Heading → content is `line` (8 px): the heading belongs to its content.
  - A caption that explains the whole tile is its own group (`group`, 24 px): the targets' not-seen legend with the cleared-count caption under it at `line`, and the nights caption.
  - The Planets reason is a fact about the names, so it stays in their group at `line`.
- **D2. The targets list** **(owner question)**: the three rows are `space-y-line`, 8 px between rows instead of today's 12 px, since they are one group. The alternative is `group` between rows (24 px), which makes the tile taller by about 32 px.
- **D3. The tiles' first gap**: `TILES_GAP_CLASS` is `pt-line`. On a phone the first heading stays put; from `sm` it moves up 16 px, so the gear cards and the first tile are 28 px apart on every width.
- **D4. The verdict's event icon** **(owner question)**: the event kind's icon from `EVENT_KIND_ICONS`, muted. For a solar eclipse it is instead the safety concept's amber `TriangleAlert` (`kind="safety"`, `iconClass="text-marginal"`), because the kind's `Eclipse` reads as a clock at 16 px and the line already says "eclipse glasses only". The alternative keeps `Eclipse` for every solar eclipse.
- **D5. The events tile's line** **(owner question)**: no icon, so the dashboard stays text-led (2B) and the summary lines of Events, Plan and Moon look alike. The alternative leads it with the same kind icon as the verdict line.
- **D6. The verdict's lower lines**: what to do next and the forecast line are a group away from the reason (`mt-group`). On a phone a fresh forecast line stays hidden, so a go night keeps its height there. From `sm` the verdict grows about 12 px, and `sm:min-h-*` is re-measured.
- **D7. The Fact API for an event**: `Fact`'s `kind` widens to `FactKind | SkyEventKind`. The icon comes from one resolver in `fact-icons.ts` (`FACT_ICONS` for a fact kind, `EVENT_KIND_ICONS` for an event kind), and `data-fact` carries the kind. One concept, one icon still holds: an event fact's concept is its kind.

## Implementation Approach

The /10x-ui order:

1. Environment/library: nothing to add.
2. Token values: none new. The roles exist; the contract change is `Fact`'s icon resolver and the shared tile content class.
3. The view: the tiles (Phase 1), then the verdict (Phase 2).
4. The states, the rules and the gate: Phase 3.

Each charge maps to a phase:

| Charge | Phase(s) |
|---|---|
| C1 tile content offsets, Planets reason as a Fact | 1 |
| C2 tile row on `py-item`, the tiles' gap | 1 |
| C3 the verdict's event line as a Fact with its icon | 2 |
| C4 the verdict's lower lines, `VERDICT_MIN_HEIGHT_CLASS` | 2 |
| C5 skeleton parity and the guard | 1 (tiles), 2 (verdict), 3 (break check) |

**The guard grows with the work.** Phase 1 adds `tile.ts`, `TonightTiles`, `EventsTile` and `TonightSkeleton`, with the verdict bars' numeric steps still allowlisted. Phase 2 adds `VerdictCard` and shrinks the skeleton's allowlist to its final counts. Phase 3 runs the break check.

**Delegation** (owner rule):
- UI code goes to a subagent with `model: "opus"` at high effort: components, layout, `/design`, the skeleton, the guard's lists and UI e2e.
- Non-UI code goes to `model: "sonnet"` at high effort: the `eventsVerdictKind` helper and its unit test.
- Docs, the evidence README and screenshot capture go to `model: "sonnet"` at medium effort.
- Screenshot judgement and the gates are the main session's.

**Every implementation brief**:
- gives the `nvm use` prefix up front;
- forbids web sourcing (everything needed is in `research.md`, the experiment diff and this plan);
- names the preview port 4331 and the fixture port 4401;
- says keys go inline only and `test:db` is never run;
- says to batch while iterating: `npx astro check && npm run lint && npx vitest related <changed .ts files> --run`, with `npm test` as the gate for `.astro`/`.css` changes.

**Running the e2e lists** (every phase, and the whole suite in Phase 3):
1. Run `npm run build`, then write `dist/server/.dev.vars` with the local Supabase URL and publishable key and `FORECAST_BASE_URL=http://127.0.0.1:4401` (the build drops the file).
2. Start `FIXTURE_PORT=4401 node tests/e2e/forecast-fixture.mjs` and `npx astro preview --port 4331`.
3. Run `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test <specs>`, with the values from `npx supabase status -o env`, inline only.

Stop the preview by the pid listening on 4331 (`lsof -t -iTCP:4331 -sTCP:LISTEN`), never with a global `astro preview stop`, which can reach other agents' servers. After a rebuild, restart the preview: a running one serves stale asset hashes and the page renders unstyled. `astro dev` for `/design` also uses 4331, so the dev server and the preview never run at the same time.

**Evidence scripts** (`evidence/scripts/`, local only, refuse a non-local `BASE_URL`):
- `seed.mjs`: one onboarded Madrid user with six log entries. Grant it the full plan with `npm run account:plan -- <email> full`, the keys inline.
- `dashboard.mjs <wt> <out> [themes] [locales] [viewports] [--measure]`: the full page, the fold and the tiles; with `--measure`, the first-screen boxes, the verdict, the tile rows and the skeleton.
- `design-section.mjs <wt> <out> <section-id> …`: one `/design` section on the dev server.

## Critical Implementation Details

- **Phone spec and the event line.** `data-verdict-event` must sit on the `Fact` root, so the spec's `[data-verdict-event]{display:none}` hides the icon and the text together. The root's only text is the line, since the icon is an `aria-hidden` svg. `VERDICT_LINE_START` and "no link or button" keep holding.
- **The min-height is measured, never computed** (`sky-band.ts:35-36`): EN go verdict on the fixture night, at 360 and 640 px, after Phase 2's verdict edits and before the skeleton edit is judged. Update the comment's arithmetic with the new numbers.
- **`cn()` for every override** of a shared class string (the tile caption's `mt-line` against `mt-group`). `class:list` keeps both classes, and the stylesheet's order decides.

## Phase 1: The tiles on the rhythm roles

**Delegation**: Opus subagent, high effort (tiles, skeleton rows, `/design` tile specimens, the guard's entries, e2e). Capture: Sonnet subagent, medium effort. Judgement and gates: the main session.

### Overview

Every tile becomes a Tonight list row on the roles, the Planets reason becomes a `Fact`, and the skeleton's tile rows follow (C1, C2, C5 for the tiles).

### Changes Required:

#### 1. The tile's shared classes

**File**: `src/components/ui/tile.ts`

**Intent**: The row takes the `item` role, and one exported class names the heading → content gap, so tiles, the skeleton and `/design` share it.

**Contract**:
- `TILE_ROW_CLASS` = `min-h-11 border-b border-border px-4 py-item`.
- A new `TILE_CONTENT_CLASS` = `mt-line`, applied to the first content element under the heading.
- `TILE_CUE_CLASS` keeps `-my-0.5` (allowlisted). The header comment says what each role does in a tile (D1).

#### 2. The tiles' gap

**File**: `src/components/tonight/sky-band.ts`

**Intent**: The gap above the first tile takes the `line` role, now that the tile's own padding is `py-item` (D3).

**Contract**: `TILES_GAP_CLASS` = `pt-line`, plus its comment. Nothing else in the file changes.

#### 3. The tiles

**Files**: `src/components/tonight/TonightTiles.astro`, `src/components/tonight/EventsTile.astro`

**Intent**: Every tile's content follows D1.

**Contract**:
- **Heading → content**: the first content element of each tile takes `TILE_CONTENT_CLASS` in place of `mt-3` / `mt-4` / `mt-5`. That covers the targets `<ul>`, the no-targets line, Events, Plan, both Moon branches, the Planets names and none line, and the nights grid.
- **The targets tile**:
  - The `<ul>` is `space-y-line`, and the `<li>` loses `py-1.5` (D2).
  - `NotSeenLegend` gets `class="mt-group"`.
  - The cleared-count caption is `mt-line` after the legend, or `mt-group` when no legend shows, merged with `cn()`.
- **The nights tile**:
  - The grid is `grid grid-cols-7 items-end gap-x-2`.
  - Each column is `flex flex-col items-center gap-line`.
  - The caption is `mt-group`, merged with `cn()`.
- **The Planets tile**: the reason is `<div class="mt-line"><Fact kind="why" tone="muted"><p>…</p></Fact></div>`, a `div` because `Fact` is a block.
- **What stays**: the targets `<ul><li>`, every id, `aria-labelledby` and `data-*` marker, and the sr-only spans.
- The header comment notes the roles.

#### 4. The skeleton's tile rows

**File**: `src/components/tonight/TonightSkeleton.astro`

**Intent**: The six tile rows mirror the real ones offset by offset, from the same classes.

**Contract**:
- Each row's first bar after the heading bar uses `TILE_CONTENT_CLASS`.
- The targets rows are `space-y-line` with no `py-1.5`, the legend bar is `mt-group` and the caption bar `mt-line`.
- The Planets reason bar is `mt-line`.
- The nights grid is `gap-x-2`, its columns `gap-line`, and its caption bars `mt-group` then `mt-0`.
- The verdict bars stay as they are until Phase 2.

#### 5. `/design`'s tile specimens

**File**: `src/pages/design.astro` (the Tile specimens, about `:2495-2530`)

**Intent**: The hand-built Tile specimens and the skeleton row show the same rhythm as the real tiles.

**Contract**: their inner `mt-2` / `mt-3` spans use `TILE_CONTENT_CLASS` (and `mt-line` for a second line). Each tile's root stays the `<a>`, so the depth selectors keep working.

#### 6. The guard

**File**: `src/styles/rhythm-roles.test.ts`

**Intent**: The converted files can't slip back to numeric steps (C5).

**Contract**: `GUARDED` gains:
- `components/ui/tile.ts`: `{ "-my-0.5": 1 }`.
- `components/tonight/TonightTiles.astro`: `{}`.
- `components/tonight/EventsTile.astro`: `{}`.
- `components/tonight/TonightSkeleton.astro`: its remaining verdict-bar and slow-hint steps, counted exactly (expected: `mt-2` 1, `mt-1` 1, `mt-3` 1 for the verdict bars until Phase 2, and `mt-6` 1 for the slow hint).

Each entry has a one-line comment, as the existing ones do.

### Success Criteria:

#### Automated Verification:

- Types, lint and the unit suite pass: `npx astro check && npm run lint && npm test`
- The rhythm guard covers `tile.ts`, `TonightTiles`, `EventsTile` and `TonightSkeleton` and passes
- The build passes: `npm run build`
- The phase's e2e pass on a fresh preview: `tonight-dashboard`, `tonight-phone`, `seven-night-planner`, `sky-events`, `planets-on-tonight`, `telescope-selector`, `offline`
- The hardcoded-value scan over the dashboard files still finds 0

#### Manual Verification:

- `dashboard.mjs --measure` (EN and PL, 320 / 390 / 1280 px, dark): the first-screen boxes match the before values (149 / 701 / 746 against 779 at 390), and each skeleton tile row is within 2 px of the real row at 390 and 1280 EN
- The tiles in dark, light and red, EN and PL, at 390 and 1280 px read as one family against `evidence/before/*-tiles.jpg` (main session's judgement; shots in `evidence/after/`)

**Implementation Note**: After the automated checks pass, the main session judges the shots and continues to Phase 2. The owner's checks are deferred to the plan's end (autonomous flow).

---

## Phase 2: The verdict's event line as a Fact, and the verdict's rhythm

**Delegation**: the `eventsVerdictKind` helper and its test go to a Sonnet subagent, high effort, first. The Fact API, `VerdictCard`, the skeleton's verdict bars, the min-height re-measure, the contrast pin, `/design` and e2e go to an Opus subagent, high effort. Capture: Sonnet subagent, medium effort. Judgement and gates: the main session.

### Overview

The event line becomes a muted `Fact` with its kind's icon (D4, D7), the verdict's lower lines move a group away (D6), and the min-height and skeleton follow (C3, C4, C5 for the verdict).

### Changes Required:

#### 1. The event's kind for the verdict line

**File**: `src/lib/tonight/sky-events.ts` (+ `sky-events.test.ts`)

**Intent**: The verdict gets the kind of the same event its line words, from one place, so the text and the icon can't name two different events.

**Contract**:
- `eventsVerdictKind(events: TonightSkyEvents | null): SkyEventKind | null` returns `events.tonight[0]?.kind`, and `null` when `eventsVerdictLine` returns `null`.
- Its doc comment ties it to `eventsVerdictLine`.
- Unit tests cover:
  - a night with no event: `null`;
  - one meteor shower: `"meteor-shower"`;
  - a solar eclipse sorted first among several: `"solar-eclipse"`;
  - an unavailable block (`null`): `null`.
- `eventsVerdictLine` is untouched.

#### 2. One icon resolver for facts and events

**Files**: `src/components/ui/fact-icons.ts`, `src/components/ui/Fact.astro`

**Intent**: `Fact` can state an event as a fact, with the icon still coming from the one map (D7).

**Contract**:
- `fact-icons.ts` exports `factIcon(kind: FactKind | SkyEventKind): LucideIcon` (`FACT_ICONS` first, then `EVENT_KIND_ICONS`) and the union type.
- `Fact`'s `kind` prop takes the union and uses `factIcon`. `data-fact` is the kind, as today.
- The comments are updated, including the `iconClass` rule (still only `see` and `safety`).
- `fact-islands.test.ts` stays green.

#### 3. The verdict

**File**: `src/components/tonight/VerdictCard.astro`

**Intent**: The event line is its own fact, and the verdict's lines follow the roles (D4, D6).

**Contract**:
- A new optional prop `eventKind?: SkyEventKind | null`.
- The event line renders only when `event` is set, as `<div class="mt-line"><Fact …data-verdict-event><p class="font-medium">{event}</p></Fact></div>`, `tone="muted"`. It takes `kind={eventKind}` when one is known; for `"solar-eclipse"` it takes `kind="safety"` with `iconClass="text-marginal"` (D4). With no kind it falls back to `kind="why"`.
- The h2 is `mt-line`.
- The weather no-go `nextText` and the no-darkness `returnText` are `mt-group`, `causeText` is `mt-line`, and the forecast line is `mt-group`.
- The reason's `mt-1` and the dot's `mt-2.5 sm:mt-3.5` stay.
- The header comment is updated (the line is a `Fact`, no reserved room, F3 still holds).

#### 4. The two call sites

**File**: `src/components/tonight/TonightContent.astro`

**Intent**: Both `VerdictCard`s get the kind.

**Contract**: `const eventKind = view ? eventsVerdictKind(view.skyEvents) : null;` beside `eventLine`, passed as `eventKind={eventKind}` at both call sites (`:139`, `:157`).

#### 5. The min-height and the skeleton's verdict bars

**Files**: `src/components/tonight/sky-band.ts`, `src/components/tonight/TonightSkeleton.astro`

**Intent**: The skeleton paints the verdict's new height, so the swap doesn't jump (C4, C5).

**Contract**:
- Re-measure the EN go verdict at 360 and 640 px and set `VERDICT_MIN_HEIGHT_CLASS` to the measured steps (expected `min-h-42 sm:min-h-62`), with the comment's arithmetic redone.
- The skeleton's headline bar is `mt-line` and its forecast bar `mt-group`. The reason bar keeps `mt-1`.
- The skeleton's guard entry shrinks to `mt-1` 1 and `mt-6` 1 (exact counts).

#### 6. The contrast pin for the amber icon

**File**: `src/styles/contrast.test.ts`

**Intent**: The solar eclipse's amber icon on the sky is held to the non-text floor in every theme it can show in (D4).

**Contract**: one row `{ themes: [...DARK_LIGHT, "red", "night"], fg: ["marginal"], bg: ["zenith", "horizon", ...DUSK], floor: 3 }`, with a comment. If a theme fails, D4 falls back to the kind icon for that case: the implementer stops and reports to the main session, never adjusts a token.

#### 7. `/design`

**Files**: `src/components/design/event-samples.ts`, `src/pages/design.astro` (the "VerdictCard: the sky event line" section, `:2146-2210`)

**Intent**: The specimens show the icons the dashboard shows.

**Contract**:
- `verdictLines` entries carry `kind` (from `eventsVerdictKind` on each sample).
- Every event specimen passes `eventKind`, including the panorama one.
- The section's prose names the icon rule (the kind's icon; the amber safety icon for a solar eclipse).

#### 8. The guard and e2e

**Files**: `src/styles/rhythm-roles.test.ts`, `tests/e2e/tonight-dashboard.spec.ts`, `tests/e2e/tonight-phone.spec.ts`

**Intent**: The verdict stays on the roles, and the line's icon is pinned where a test can see it.

**Contract**:
- `GUARDED` gains `components/tonight/VerdictCard.astro`: `{ "mt-1": 1, "mt-2.5": 1, "sm:mt-3.5": 1 }`.
- `tonight-dashboard.spec.ts`: on an event night (the existing conditional branch), assert that `[data-verdict-event]` has a `data-fact` attribute and exactly one `svg`. Its text and the no-link check are unchanged.
- `tonight-phone.spec.ts`: the header comment notes that the hidden line is now a `Fact` (icon included). Its assertions are unchanged.

### Success Criteria:

#### Automated Verification:

- `eventsVerdictKind` unit tests pass: `npx vitest run src/lib/tonight/sky-events.test.ts`
- Types, lint and the unit suite pass: `npx astro check && npm run lint && npm test`
- The contrast test passes with the amber row
- The rhythm guard covers `VerdictCard` and the skeleton's final counts, and passes
- The build passes: `npm run build`
- The phase's e2e pass on a fresh preview: `tonight-dashboard`, `tonight-phone`, `sky-events`, `tonight-sky`, `red-night-mode`, `offline`

#### Manual Verification:

- `VERDICT_MIN_HEIGHT_CLASS` is re-measured at 360 and 640 px (EN go) and the values are recorded in `evidence/README.md`; the skeleton and the real verdict match within 2 px at 390 and 1280 px
- The `/design` "sky event line" section in dark, light and red, EN and PL, at 390 and 1280 px shows each line as its own fact, with the amber icon on the solar eclipse

Shots: `evidence/after/c-verdict-event-*` against `evidence/before/`.

**Implementation Note**: After the automated checks pass, the main session judges the shots and continues to Phase 3.

---

## Phase 3: Rules, the gate, the landing image and the whole suite

**Delegation**: the guard's break check, the whole e2e suite, smoke and judgement go to the main session. CLAUDE.md, the comments, the after-matrix capture, the landing recapture and the evidence README go to a Sonnet subagent, medium effort.

### Overview

Prove the guard bites, write the rule down, record the after state, refresh the landing image, and run everything the way CI does (the lesson "Run the whole e2e suite before a PR").

### Changes Required:

#### 1. The guard's break check

**Files**: worktree only, restored afterwards

**Intent**: Show the guard fails on the dashboard files.

**Contract**: add `mt-4` in `TonightTiles.astro`, `space-y-3` in `TonightSkeleton.astro` and a second `mt-1` in `VerdictCard.astro`. `npm test` must fail in `rhythm-roles.test.ts` with each file:line. Restore with `git checkout --` and get green again. Record the output in `evidence/README.md`.

#### 2. The rules

**File**: `CLAUDE.md` (UI (Nightfall): Tokens, Components, Tonight's sky, Phone first)

**Intent**: The next agent spaces a tile and words the verdict's event line the same way.

**Contract**:
- **Tokens**: the guarded list names the dashboard files.
- **Components**: `Fact`'s kind may be an event kind (`factIcon`), and the verdict's event line is a muted `Fact` with the kind's icon (the amber safety icon for a solar eclipse).
- **Tonight's sky / dashboard**: a tile is a `py-item` row, its content `TILE_CONTENT_CLASS` (`mt-line`) under the heading, and an explanatory caption is a group; there are no icons on tile headings.
- **Phone first**: the new `VERDICT_MIN_HEIGHT_CLASS` values and the date they were measured.
- The S-07 paragraph's sentence on the verdict line ("one muted plain-text line") is updated to the `Fact`.

#### 3. The after matrix, the landing image and the evidence README

**Files**: `context/changes/ui-dashboard-tiles/evidence/after/`, `evidence/README.md`, `public/landing/tonight.png`

**Intent**: Record the change against the before shots, and keep the landing's picture of Tonight current.

**Contract**:
- `dashboard.mjs` over dark / light / red × EN / PL × phone / desktop (plus 320 px for EN dark and PL dark), and `design-section.mjs c-verdict-event`, downscaled JPEGs with the before names.
- `CAPTURE_LANDING=1 … npx playwright test landing-screenshot`, keeping its size.
- The README lists the folders, the scripts, the measurements (first screen, tile rows, skeleton, min-height) and the break check.

### Success Criteria:

#### Automated Verification:

- The guard's break check fails as expected on the three files and is green after the restore
- The whole e2e suite passes on a fresh local preview, the way CI runs it: `npm run test:e2e` (counts recorded)
- Smoke passes: `npm run smoke` with the local keys inline
- Types, lint, unit suite and build pass on the final tree: `npx astro check && npm run lint && npm test && npm run build`

#### Manual Verification:

- The owner accepts the dashboard in dark, light and red, EN and PL, at 390 and 1280 px from `evidence/after/` against `evidence/before/`, including the verdict line specimens and the new landing image

---

## Testing Strategy

### Unit Tests:

- `eventsVerdictKind`: no event, one shower, a solar eclipse first among several, an unavailable block.
- The rhythm guard over the five new files, and the break check.
- The contrast row for `marginal` on the sky stops.
- `fact-islands.test.ts` and the `i18n` parity stay green (no new keys).

### Integration Tests:

- `tonight-phone.spec.ts`: the first screen at 390×844 (unchanged values), and no sideways scroll at 320 and 375 px in EN and PL.
- `tonight-dashboard.spec.ts`: the tile names and hrefs, the events tile line, and on an event night the verdict line's text, the absence of any link or button, `data-fact` and one svg.
- The whole suite and smoke in Phase 3.

### Manual Testing Steps:

1. Open `/tonight` at 390 px in dark, light and red (EN, PL): the tiles are 40 px apart, each heading sits close over its content, and the Planets reason has its Info icon.
2. Open `/design` → "VerdictCard: the sky event line": each line has its icon on its own line under the reason; the solar eclipse shows the amber triangle.
3. Throttle the network and reload `/tonight`: the skeleton's tile rows and the verdict don't jump when the island arrives.

## Performance Considerations

None: no new requests or islands. The verdict gains one svg on event nights.

## Migration Notes

None.

## References

- Research: `context/changes/ui-dashboard-tiles/research.md`
- Experiment: `context/changes/ui-dashboard-tiles/evidence/exp/experiment.diff`
- Umbrella audit: `context/changes/ui-refine/audit.md`
- The focused pages' contract: `context/changes/ui-fact-rhythm/plan.md` (D1, D4, F7)
- Sky-events F3 (no reserved room): `context/archive/2026-10-13-sky-events/reviews/plan-review.md:149-178`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The tiles on the rhythm roles

#### Automated

- [ ] 1.1 Types, lint and the unit suite pass: `npx astro check && npm run lint && npm test`
- [ ] 1.2 The rhythm guard covers `tile.ts`, `TonightTiles`, `EventsTile` and `TonightSkeleton` and passes
- [ ] 1.3 The build passes: `npm run build`
- [ ] 1.4 The phase's e2e pass on a fresh preview: `tonight-dashboard`, `tonight-phone`, `seven-night-planner`, `sky-events`, `planets-on-tonight`, `telescope-selector`, `offline`
- [ ] 1.5 The hardcoded-value scan over the dashboard files still finds 0

#### Manual

- [ ] 1.6 `dashboard.mjs --measure` (EN and PL, 320 / 390 / 1280 px, dark): the first-screen boxes match the before values (149 / 701 / 746 against 779 at 390), and each skeleton tile row is within 2 px of the real row at 390 and 1280 EN
- [ ] 1.7 The tiles in dark, light and red, EN and PL, at 390 and 1280 px read as one family against `evidence/before/*-tiles.jpg` (main session's judgement; shots in `evidence/after/`)

### Phase 2: The verdict's event line as a Fact, and the verdict's rhythm

#### Automated

- [ ] 2.1 `eventsVerdictKind` unit tests pass: `npx vitest run src/lib/tonight/sky-events.test.ts`
- [ ] 2.2 Types, lint and the unit suite pass: `npx astro check && npm run lint && npm test`
- [ ] 2.3 The contrast test passes with the amber row
- [ ] 2.4 The rhythm guard covers `VerdictCard` and the skeleton's final counts, and passes
- [ ] 2.5 The build passes: `npm run build`
- [ ] 2.6 The phase's e2e pass on a fresh preview: `tonight-dashboard`, `tonight-phone`, `sky-events`, `tonight-sky`, `red-night-mode`, `offline`

#### Manual

- [ ] 2.7 `VERDICT_MIN_HEIGHT_CLASS` is re-measured at 360 and 640 px (EN go) and the values are recorded in `evidence/README.md`; the skeleton and the real verdict match within 2 px at 390 and 1280 px
- [ ] 2.8 The `/design` "sky event line" section in dark, light and red, EN and PL, at 390 and 1280 px shows each line as its own fact, with the amber icon on the solar eclipse

### Phase 3: Rules, the gate, the landing image and the whole suite

#### Automated

- [ ] 3.1 The guard's break check fails as expected on the three files and is green after the restore
- [ ] 3.2 The whole e2e suite passes on a fresh local preview, the way CI runs it: `npm run test:e2e` (counts recorded)
- [ ] 3.3 Smoke passes: `npm run smoke` with the local keys inline
- [ ] 3.4 Types, lint, unit suite and build pass on the final tree: `npx astro check && npm run lint && npm test && npm run build`

#### Manual

- [ ] 3.5 The owner accepts the dashboard in dark, light and red, EN and PL, at 390 and 1280 px from `evidence/after/` against `evidence/before/`, including the verdict line specimens and the new landing image
