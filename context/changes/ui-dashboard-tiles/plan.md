# Dashboard tiles on the rhythm roles and shared facts (ui-dashboard-tiles) Implementation Plan

## Overview

This change gives the `/tonight` dashboard the rhythm and the facts that ui-fact-rhythm gave the focused pages. It is the third change of the ui-refine split (`context/changes/ui-refine/audit.md`: finding 4 for the dashboard, the S-07 notes on the verdict's event line and the events tile; owner decisions 1, 3 and 5 as amended on 2026-10-15).

- **The tiles** become Tonight list rows on the `item` role (40 px between two tiles' contents). Each heading sits on the `line` role over its content, and an explanatory caption is its own group.
- **The Planets tile's reason** becomes the same "why" `Fact` it is on `/tonight/planets`.
- **The Events tile's line leads with the event kind's icon.** This is the owner's deliberate exception to text-led tiles; tile headings still carry no icon.
- **The verdict's sky-event line** becomes a muted `Fact` with its event kind's icon, so it reads as its own fact instead of the end of the reason.
- **The "Next clear night" advice** moves a group away from the answer. The forecast line stays in the answer group.
- **The skeleton** stays in step tile by tile, and the rhythm guard covers the dashboard files.

There is no new token and no new copy.

**Sources**
- The research and its five charges: `research.md` (C1-C5).
- The reverted experiment: `evidence/exp/experiment.diff`, its shots in `evidence/exp/`, and the before shots from main 42ce808 in `evidence/before/`.
- The plan review `reviews/plan-review.md` (F1-F10). All its findings are applied, with the owner's answers of 2026-10-15 (see "Decisions").

## Current State Analysis

From `research.md`, on main 42ce808 (ui-fact-rhythm #167 merged).

**Tiles**
- `TILE_ROW_CLASS` is `py-4 sm:py-5` (`src/components/ui/tile.ts:9`), and `TILES_GAP_CLASS` is `pt-3 sm:pt-6` (`src/components/tonight/sky-band.ts:11`).
- The content under a tile heading is offset `mt-3`, `mt-4` or `mt-5` depending on the tile (`TonightTiles.astro:118,138,149,156,161,170,174,181`, `EventsTile.astro:25`).
- The targets rows are `py-1.5` (`:120`); the legend is `mt-2` and the caption `mt-3` (`:40,130`).
- The Planets reason is a plain `mt-2` muted line (`:171`).
- The nights grid is a bare `gap-2` (`:181,183`).
- On a phone, tiles sit 32 px apart against 40 px between the focused pages' rows.

**Events**
- The Events tile's line is `eventsTileLine(events, locale)` (`src/lib/tonight/sky-events.ts:318-332`), from `events.next`, whose `kind` is on the view (`TonightSkyEvent.kind`, `:26`).
- The verdict's line is `eventsVerdictLine` (`:340-358`), from `events.tonight[0]`; solar eclipses sort first (`:307`).
- Neither kind reaches a component.

**The verdict**
- The event line is `<p class="mt-1 text-label font-medium text-muted-foreground" data-verdict-event>` (`VerdictCard.astro:92-96`).
- What to do next and the forecast line are `mt-3` under the reason (`:97,100,104`). The forecast line hides below `sm` only when the forecast is fresh (`:64-68`).
- `VERDICT_MIN_HEIGHT_CLASS = "min-h-42 sm:min-h-59"` (`sky-band.ts:45`) is the measured EN go verdict at 360 / 640 px.

**`Fact`**
- `Fact` takes only a `FactKind`, its icon is `FACT_ICONS[kind]`, and it is fixed at `text-label` (`src/components/ui/Fact.astro:19,31,37`).
- `EVENT_KIND_ICONS` is a second map in the same module (`fact-icons.ts:89-96`), with keys disjoint from the fact kinds.

**The skeleton and the guards**
- `TonightSkeleton.astro:39-124` hand-copies the verdict's and each tile's offsets.
- None of `TonightTiles`, `EventsTile`, `VerdictCard`, `TonightSkeleton` or `tile.ts` is in `GUARDED` (`src/styles/rhythm-roles.test.ts:51-93`).
- The guard lets an allowance go unused, so a count that should have shrunk is not caught (review F6).

**Contracts other code relies on**
- `Tile`'s root is the `<a>`, which `/design`'s depth selectors (`*:*:bg-accent`, `design.astro:641-646`) depend on.
- `tests/e2e/tonight-dashboard.spec.ts:60-68` reads the `tile-*-heading` ids and the `aria-labelledby` names.
- `landing-screenshot.spec.ts:76-80` reads the targets tile's `<ul><li>`.
- The markers `data-tonight-tiles`, `data-events-tile-line` (text: the none string or containing " · ", `:95-100`) and `data-verdict-event` stay. The verdict line's text must match `VERDICT_LINE_START`, with no link or button in it (`:25-35,104-105`).
- `tests/e2e/tonight-phone.spec.ts:66-68,73-119` measures the phone first screen at 390×844, in EN only, hiding `[data-verdict-event]` while it measures.
- The landing image `public/landing/tonight.png` is 1280×1125, set in `landing-screenshot.spec.ts:22` (`VIEWPORT`) and `src/components/Welcome.astro:34` (`SCREENSHOT`), and ends on the first tile's rule.

## Desired End State

- **Tiles**
  - Every tile row is `py-item`: 8 px taller per tile below `sm`, unchanged from `sm`.
  - Every tile's content sits under its heading by one shared class, `TILE_CONTENT_CLASS` (`mt-line`).
  - The targets rows are `space-y-line`.
  - The targets' legend and caption, and the nights caption, are a second group at `mt-group`; within it, the caption follows the legend at `mt-line`.
  - The Planets reason is `Fact kind="why" tone="muted"`.
  - When an event is next, the Events line is a `Fact` at the body size whose icon is that event's kind, with `data-events-tile-line` on its root. The "none" and "unavailable" lines stay plain text.
  - `TILES_GAP_CLASS` is `pt-line`.
- **The verdict**
  - On an event night, the event line is a muted `Fact` at `mt-line` with its kind's icon, solar eclipse included (`Eclipse`). `data-verdict-event` sits on the root.
  - The date → headline gap stays 8 px, now `mt-line`.
  - The forecast line is `mt-line`, 4 px closer than today.
  - The weather no-go "Next clear night" advice is `mt-group`.
  - The no-darkness lines are `mt-line`: they explain the headline.
  - `VERDICT_MIN_HEIGHT_CLASS` is re-measured. The expectation is `min-h-42` unchanged and `sm:min-h-58`, from 236 − 4 px; the measurement decides.
- **The skeleton** mirrors every tile and the verdict. At 390 and 1280 px (EN, dark), each skeleton tile row and the verdict container are within 2 px of the real ones. The page's skeleton/real difference is no worse than before (−35 / −36 px).
- **The phone first screen is no worse.**
  - On the fresh go night at 390×844, the headline ends at 149 px, the Site card at 701 px and the Telescope title at 746 px, against the TabBar at 779 px. `tonight-phone.spec.ts` checks this in EN; `dashboard.mjs --measure` checks PL by hand.
  - On a no-forecast night (the `none` state), the verdict is measured before and after at 390 px and recorded. It is no taller, since the forecast line moves 4 px up.
  - A weather no-go night grows by 12 px from the advice (owner, D6). That night already sits past the fold today, which is a known limit.
- **The guards**
  - The rhythm guard covers `tile.ts`, `TonightTiles`, `EventsTile`, `VerdictCard`, `TonightSkeleton` and `Fact`'s new nudge.
  - Every allowance in `GUARDED` must be used exactly; an unused one fails.
  - `factIcon` and the two event helpers have unit tests.
- **The rules**: CLAUDE.md says how a tile is spaced, that the Events line and the verdict's event line are event `Fact`s, and the new min-height.
- **`/design`** shows the icons and the tiles on the roles.
- **The landing image** is recaptured at the height that ends on the first tile's rule, set in both places.

Verify with each phase's gates, `evidence/after/`, and the whole e2e suite plus smoke on a fresh local preview.

### Key Discoveries:

- **The first screen did not move in the experiment**: 149 / 701 / 746 against 779 px, EN and PL (`research.md` C2).
- **`class:list` does not merge Tailwind conflicts**: overrides go through `cn()` (`cn("mt-line","mt-group")` gives `mt-group`, `utils.ts:14`).
- **`Fact` is a `div`**: inside a tile's `<a>` it goes in a `div`, never a `span`.
- **`Fact`'s spread attributes land on its root** (`Fact.astro:27,30,35`). `data-verdict-event` and `data-events-tile-line` therefore hide and read together with the icon. The svg has no text, so `VERDICT_LINE_START` (`^…`) still matches.
- **The text sizes differ.** A body-size line (the Events tile, `text-body` with a 24 px line) needs its 16 px icon nudged 4 px; a label line (20 px) needs 2 px. Hence `Fact`'s `size`.

## What We're NOT Doing

- **No icons on tile headings** (decision 2B). The audit's "Tile gains an icon prop" is dropped.
- **No icon on the Plan line or the Moon line.** The Moon keeps its disc. The Events line is the one exception (D5).
- **No amber icon and no contrast row** (owner D4: the solar eclipse keeps `Eclipse`; "eclipse glasses only" stays in the words).
- **No new tokens and no new copy.** `eventsVerdictLine` and `eventsTileLine` keep their strings and tests.
- **The area below the tiles** (`TonightContent.astro:222`: the sky check, the prompts) stays as is (research, Deferred).
- **The gear row and `GEAR_CARD_MIN_HEIGHT_CLASS`** stay as they are.
- **`sky-band.ts` is not guarded**: its band geometry is not rhythm. Only `TILES_GAP_CLASS` and `VERDICT_MIN_HEIGHT_CLASS` change there.
- **The headline → reason `mt-1` and the dot's nudge stay**: they are the display line's own leading. They are allowlisted.
- **No "Edited by you" marker on the Plan tile**: D13 is already met (`TonightTiles.astro:52-64`).
- **The skeleton/real difference outside the tiles** (−35 px at 390 EN) is pre-existing.
- **No new first-screen e2e for PL or the fallback/no-go nights**: they are measured by hand and recorded.
- **No change to the focused pages, the navigation (change 4) or /log, /log/progress and /gear (change 5).**

## Decisions

The owner's answers of 2026-10-15 (relayed by the orchestrator) to the agent's defaults D1-D7 and to the review question (F1):

- **D1. A tile's rhythm** (as planned).
  - The row is `py-item`.
  - Heading → content is `line`.
  - An explanatory caption is its own group: the not-seen legend with the cleared-count caption at `line` under it, and the nights caption.
  - The Planets reason stays in the names' group at `line`.
- **D2. The targets list** (owner: 8 px): `space-y-line`.
- **D3. The tiles' first gap** (as planned): `TILES_GAP_CLASS` = `pt-line`. On a phone the first heading stays put; from `sm` it moves up 16 px.
- **D4. The verdict's event icon** (owner): the event kind's icon from `EVENT_KIND_ICONS`, muted, **solar eclipse included** (`Eclipse`). There is no amber `TriangleAlert`, and therefore no contrast row (review F4 drops out). "Eclipse glasses only" stays in the line's words.
- **D5. The Events tile's line** (owner): it **leads with the event kind icon** whenever an event is next. This is a deliberate exception to text-led tiles; the tile headings still have no icon.
  - The "none in the window" and "unavailable" lines have no event and no icon.
  - The icon is muted, like every fact icon. The line keeps the tile's `text-body font-semibold` heading ink.
- **D6. The verdict's lower lines** (owner, answering review F1):
  - The forecast line stays in the answer group (`mt-line`).
  - Only the weather no-go "Next clear night" advice moves a group down (`mt-group`), so the phone first screen does not get worse.
  - The no-darkness lines (`returnText`, `causeText`) explain the "no darkness" headline. They are part of the answer and go to `mt-line`; the agent's reading of "only the advice".
- **D7. Event facts** (as planned, with review F9).
  - `Fact`'s `kind` widens to `FactKind | SkyEventKind`. One pure resolver, `factIcon`, picks from `FACT_ICONS` or `EVENT_KIND_ICONS`, and `data-fact` carries the kind.
  - The components take an event as one value, `{ line, kind }`, from one helper, so a line without its kind cannot be expressed. There is no `why` fallback.
  - `Fact` gains `size: "label" | "body"` (default `label`) for the Events tile's body-size line.

Review findings, all applied: F1 (D6 above), F2, F3, F5-F10, plus F4 (moot under D4). The changes they caused are named where they land: the test helpers and resolver in Phase 1, the measuring script in Phase 2, the landing height in Phase 3, the runnable lines throughout, ports and stopping below, the extra e2e specs, the single event prop, and the comments and scripts.

## Implementation Approach

The /10x-ui order:

1. Environment/library: nothing to add.
2. Token values: none new. The contract is the pure helpers, `factIcon`, `Fact`'s kind and size, and the shared tile content class (Phase 1, first).
3. The view: the tiles (Phase 1), then the verdict (Phase 2).
4. The states, the rules and the gate: Phase 3.

| Charge | Phase(s) |
|---|---|
| C1 tile content offsets, Planets reason, Events icon | 1 |
| C2 tile row on `py-item`, the tiles' gap | 1 |
| C3 the verdict's event line as a Fact | 1 (contract), 2 (verdict) |
| C4 the verdict's lower lines, `VERDICT_MIN_HEIGHT_CLASS` | 2 |
| C5 skeleton parity and the guard | 1 (tiles, exact counts), 2 (verdict), 3 (break check) |

**Delegation** (owner rule):
- UI code goes to a subagent with `model: "opus"` at high effort: `Fact`, the tiles, the verdict, the skeleton, `/design`, the guard, UI e2e and the measuring script.
- Non-UI code goes to `model: "sonnet"` at high effort: `eventsVerdict`, `eventsTile` and their tests, `factIcon` and its test.
- Docs, the evidence README and screenshot capture go to `model: "sonnet"` at medium effort. The main session reviews the CLAUDE.md wording.
- The gates, the commits and the screenshot judgement are the main session's.

**Every implementation brief**:
- gives the `nvm use` prefix up front (`export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null &&`);
- forbids web sourcing;
- names this agent's ports, the preview on **4331** and the fixture on **4401**;
- says keys go inline only and `test:db` is never run;
- says to batch while iterating: `npx astro check && npm run lint && npx vitest related <changed .ts files> --run`, with `npm test` as the gate for `.astro`/`.css` changes.

**Ports and servers** (review F7). This agent's ports are 4331 (preview, or `astro dev` for `/design`, never both at once) and 4401 (fixture).
- Stop a server only through the pid listening on one of these two ports (`kill $(lsof -t -nP -iTCP:4331 -sTCP:LISTEN)`), never with a global `astro preview stop` or `astro dev stop`.
- After a rebuild, restart the preview: a running one serves stale asset hashes, and the page renders unstyled.

**Running a preview and the e2e** (every phase, and the whole suite in Phase 3):
1. `npm run build`, then copy the local env into `dist/server/.dev.vars` (the build drops it):
   - `SUPABASE_URL=http://127.0.0.1:54321`;
   - `SUPABASE_KEY=<ANON_KEY>`;
   - `FORECAST_BASE_URL=http://127.0.0.1:4401`.
2. `FIXTURE_PORT=4401 node tests/e2e/forecast-fixture.mjs &` and `npx astro preview --port 4331 &`.
3. E2E, with the values from `npx supabase status -o env`, inline only:
   ```
   BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test <specs>
   ```

**Evidence scripts** (`evidence/scripts/`, local only, refuse a non-local `BASE_URL`; their outputs go to the session scratchpad, never into `evidence/`; review F10):
- `seed.mjs <wt> <scratch> ui-dash`: writes `state-ui-dash.json` and `email-ui-dash.txt` to the scratchpad. Grant the full plan with `SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run account:plan -- <email> full`.
- `dashboard.mjs <wt> <scratch>/<set> [themes] [locales] [viewports] [--measure]`: reads `state-ui-dash.json` from `<scratch>`.
- `design-section.mjs <wt> <scratch>/<set> <section-id> …`.
- Curated shots go into `evidence/<set>/` as JPEGs via `sips -s format jpeg -s formatOptions 45 -Z <px>` (620 px for phone tiles, 900 for desktop tiles, 1400 for full pages).

## Critical Implementation Details

- **Markers on the `Fact` root.** `data-verdict-event` and `data-events-tile-line` sit on the `Fact` root, whose only text is the line; the icon is an `aria-hidden` svg. This keeps the phone spec's `display:none`, `VERDICT_LINE_START`, "no link or button" and the tile line's none / " · " check holding.
- **The min-height is measured, never computed** (`sky-band.ts:35-36`):
  - EN go verdict, at 360 and 640 px;
  - only when `[data-verdict-event]` is absent or hidden;
  - with the container's `min-height` set to 0 for the measure, so a shorter verdict is not hidden by the old value;
  - for both the real page and the skeleton.

  Redo the comment's arithmetic with the new numbers.
- **`cn()` for every override** of a shared class string.

## Phase 1: The shared contract and the tiles on the rhythm roles

**Delegation**: §1-§2 go to a Sonnet subagent, high effort (pure helpers and their tests). §3-§9 go to an Opus subagent, high effort. Capture goes to a Sonnet subagent, medium effort. The gates, the commit and judgement are the main session's.

### Overview

The pure contract lands first: the event helpers, `factIcon`, and `Fact`'s kind and size. Then every tile becomes a Tonight list row on the roles, the Planets reason becomes a `Fact`, the Events line leads with its kind's icon, the skeleton follows, and the guard checks exact counts (C1, C2, C5 for the tiles, the contract for C3).

### Changes Required:

#### 1. The event helpers

**File**: `src/lib/tonight/sky-events.ts` (+ `sky-events.test.ts`)

**Intent**: Each component gets an event's line and kind from one call, so the text and the icon always name the same event (D7, review F9).

**Contract**:
- `export interface WordedEvent { line: string; kind: SkyEventKind }`.
- `eventsVerdict(events, locale): WordedEvent | null`: `eventsVerdictLine`'s text with `events.tonight[0].kind`, and `null` exactly when `eventsVerdictLine` is `null`.
- `eventsTile(events, locale): { line: string; kind: SkyEventKind | null }`: `eventsTileLine`'s text with `events.next?.kind`, and `kind: null` for the none and unavailable lines.
- The doc comments tie each one to its line function. The existing functions and their tests are unchanged.
- Unit tests:
  - `eventsVerdict`: no event (`null`); one meteor shower (its line and `"meteor-shower"`); a solar eclipse first among several (`"solar-eclipse"`, with the line still saying "+N more"); an unavailable block (`null`).
  - `eventsTile`: next is a pairing (`"pairing"`); none in the window (`null` kind, the none line); unavailable (`null` kind, the unavailable line).

#### 2. One icon resolver

**File**: `src/components/ui/fact-icons.ts` (+ new `fact-icons.test.ts`)

**Intent**: One pure mapping decides every fact's icon, events included, and a test pins it (review F2).

**Contract**:
- `export type FactSubject = FactKind | SkyEventKind`.
- `export function factIcon(subject: FactSubject): LucideIcon`: `FACT_ICONS` for a fact kind, else `EVENT_KIND_ICONS`.
- The header comment says event facts use the kind's icon, the verdict line and the Events tile included (D4, D5).
- Tests:
  - every `FACT_KINDS` entry resolves to `FACT_ICONS[k]`;
  - every key of `EVENT_KIND_ICONS` (six) resolves to its icon;
  - `"solar-eclipse"` resolves to lucide `Eclipse` (D4);
  - the two key sets are disjoint.

#### 3. `Fact`'s kind and size

**File**: `src/components/ui/Fact.astro`

**Intent**: A `Fact` can state an event (D7) at the label or the body size (D5).

**Contract**:
- `kind: FactSubject`, with the icon from `factIcon(kind)` and `data-fact={kind}`.
- `size?: "label" | "body"` (default `label`). It sets the root's `text-label` or `text-body`, and the icon nudge `mt-0.5` (label) or `mt-1` (body).
- The `iconClass` rule is unchanged (only `see` and `safety`).
- The guard entry becomes `{ "mt-0.5": 1, "mt-1": 1 }`.
- `fact-islands.test.ts` stays green.

#### 4. The tile's shared classes

**File**: `src/components/ui/tile.ts`

**Intent**: The row takes the `item` role, and one class names the heading → content gap for tiles, skeleton and `/design` (D1).

**Contract**:
- `TILE_ROW_CLASS` = `min-h-11 border-b border-border px-4 py-item`.
- A new `TILE_CONTENT_CLASS` = `mt-line`.
- `TILE_CUE_CLASS` keeps `-my-0.5`. The header comment states the tile rhythm.

#### 5. The tiles' gap

**File**: `src/components/tonight/sky-band.ts`

**Intent**: The gap above the first tile takes the `line` role (D3).

**Contract**: `TILES_GAP_CLASS` = `pt-line`, plus its comment.

#### 6. The tiles

**Files**: `src/components/tonight/TonightTiles.astro`, `src/components/tonight/EventsTile.astro`

**Intent**: Every tile's content follows D1 and D2, and the Events line follows D5.

**Contract**:
- **Heading → content**: each tile's first content element takes `TILE_CONTENT_CLASS` in place of `mt-3` / `mt-4` / `mt-5`. That covers the targets `<ul>`, the no-targets line, Plan, both Moon branches, the Planets names and none line, the nights grid, and the Events line.
- **Targets**:
  - the `<ul>` is `space-y-line`, and the `<li>` loses `py-1.5`;
  - `NotSeenLegend class="mt-group"`;
  - the caption is `mt-line` after the legend, else `mt-group`, through `cn()`.
- **Nights**: the grid is `grid grid-cols-7 items-end gap-x-2`, each column `flex flex-col items-center gap-line`, and the caption `mt-group` through `cn()`.
- **Planets**: the reason is `<div class="mt-line"><Fact kind="why" tone="muted"><p>…</p></Fact></div>`.
- **Events** (`EventsTile`): `const { line, kind } = eventsTile(events, locale)`.
  - With a `kind`: `<div class={TILE_CONTENT_CLASS}><Fact kind={kind} size="body" data-events-tile-line><p class="font-semibold break-words text-heading">{line}</p></Fact></div>`.
  - Without one: today's span with `TILE_CONTENT_CLASS` and `data-events-tile-line`.
  - The header comment notes the exception to text-led tiles.
- **What stays**: the targets `<ul><li>`, every id, `aria-labelledby`, the `data-*` markers and the sr-only spans. The `TonightTiles` header comment notes the roles and the Events exception.

#### 7. The skeleton's tile rows

**File**: `src/components/tonight/TonightSkeleton.astro`

**Intent**: The six tile rows mirror the real ones offset by offset.

**Contract**:
- Each row's first bar after the heading bar uses `TILE_CONTENT_CLASS`.
- Targets: `space-y-line` without `py-1.5`, the legend bar `mt-group`, the caption bar `mt-line`.
- Events: the line bar stays a `text-body` bar. The icon sits inside the line's height, so no extra room is needed (checked in 1.7).
- The Planets reason bar is `mt-line`.
- Nights: `gap-x-2`, columns `gap-line`, caption bars `mt-group` then `mt-0`.
- The verdict bars wait for Phase 2.

#### 8. `/design`

**File**: `src/pages/design.astro` (the Tile specimens near `:2495-2530`, the EventsTile specimens near `:2796-2830`)

**Intent**: The specimens show the tile rhythm and the Events icon.

**Contract**:
- The hand-built Tile specimens' content spans and the skeleton row's bar use `TILE_CONTENT_CLASS`. Each tile's root stays the `<a>`.
- The EventsTile specimens render through `EventsTile` unchanged, so they pick the icon up. Their prose names the exception.

#### 9. The guard, exact counts

**File**: `src/styles/rhythm-roles.test.ts`

**Intent**: The converted files cannot slip back, and an allowance that is no longer used fails (review F6).

**Contract**:
- A new test asserts that, for every file in `GUARDED`, each allowance's count equals its uses, with the message naming the file, the token and both numbers. Existing entries whose counts are loose are corrected in this phase.
- `GUARDED` gains:
  - `components/ui/tile.ts`: `{ "-my-0.5": 1 }`;
  - `components/tonight/TonightTiles.astro`: `{}`;
  - `components/tonight/EventsTile.astro`: `{}`;
  - `components/tonight/TonightSkeleton.astro`: the verdict bars' `mt-2`, `mt-1`, `mt-3` (1 each, until Phase 2) and the slow hint's `mt-6` (1), with exact counts.

  Each entry has a one-line comment.

#### 10. E2E for the Events icon

**File**: `tests/e2e/tonight-dashboard.spec.ts`

**Intent**: Pin the Events icon on every run that has an event in the window (on the fixture's real date, the Orionids are next today).

**Contract**: where the test reads `[data-events-tile-line]`:
- when its text is not the none string, assert it has a `data-fact` attribute equal to one of the six event kinds and exactly one `svg`;
- when it is the none string, assert it has no `svg`.

The header comment is updated.

### Success Criteria:

#### Automated Verification:

- The helper and resolver tests pass: `npx vitest run src/lib/tonight/sky-events.test.ts src/components/ui/fact-icons.test.ts`
- Types, lint and the unit suite pass: `npx astro check && npm run lint && npm test`
- The rhythm guard passes with the five new entries and the exact-count test: `npx vitest run src/styles/rhythm-roles.test.ts`
- No literal colour or arbitrary value in the dashboard files: `npx vitest run src/styles/no-hardcoded-colors.test.ts` passes and `grep -nE -- '-\[[0-9.]+(px|rem)\]' src/components/tonight/{TonightTiles,EventsTile,VerdictCard,TonightSkeleton,TonightContent,GearCard,SkyCheckCard,EyepiecesPrompt}.astro src/components/ui/{Tile.astro,tile.ts,Fact.astro} src/components/tonight/sky-band.ts` prints nothing
- The build passes: `npm run build`
- The phase's e2e pass on the preview (4331/4401): `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test tonight-dashboard tonight-phone seven-night-planner sky-events planets-on-tonight what-to-expect telescope-selector offline`

#### Manual Verification:

- `dashboard.mjs --measure` (EN and PL, 320 / 390 / 1280 px, dark): on the fresh go night the first-screen boxes equal the before values (149 / 701 / 746 against 779 at 390), and each skeleton tile row is within 2 px of the real row at 390 and 1280 EN
- The tiles in dark, light and red, EN and PL, at 390 and 1280 px read as one family against `evidence/before/*-tiles.jpg`, with the Events icon aligned to its line (main session's judgement; shots in `evidence/after/`)

**Implementation Note**: After the gates pass, the main session judges the shots, commits the phase and continues to Phase 2 (autonomous flow; the owner's checks come at the end).

---

## Phase 2: The verdict's event line as a Fact, and the verdict's rhythm

**Delegation**: an Opus subagent, high effort, for the verdict, the call sites, the skeleton's verdict bars, the measuring script's 360/640 viewports, `/design`, the guard and e2e. Its brief says that mid-phase it must build, start the preview on 4331 with the fixture on 4401, and use the seeded `ui-dash` user to re-measure. Capture goes to a Sonnet subagent, medium effort. The gates, the commit and judgement are the main session's.

### Overview

The event line becomes a muted `Fact` with its kind's icon (D4, D7). The advice moves a group away, while the forecast line stays in the answer group (D6). The min-height and the skeleton follow (C3, C4, C5 for the verdict).

### Changes Required:

#### 1. The verdict

**File**: `src/components/tonight/VerdictCard.astro`

**Intent**: The event line is its own fact, and the verdict's lines follow the roles (D4, D6, review F9).

**Contract**:
- The `event` prop becomes `event?: WordedEvent | null`, replacing the string.
- With an event: `<div class="mt-line"><Fact kind={event.kind} tone="muted" data-verdict-event><p class="font-medium">{event.line}</p></Fact></div>`.
- The h2 is `mt-line`.
- Weather no-go: `nextText` is `mt-group`.
- No darkness: `returnText` and `causeText` are `mt-line`.
- The forecast line is `mt-line`.
- The reason's `mt-1` and the dot's `mt-2.5 sm:mt-3.5` stay.
- The header comment is updated: the event line is a `Fact` with its kind's icon, so besides the dot it carries one muted icon; no reserved room, F3 still holds; the D6 groups.

#### 2. The two call sites

**File**: `src/components/tonight/TonightContent.astro`

**Intent**: Both `VerdictCard`s get the worded event.

**Contract**: `const verdictEvent = view ? eventsVerdict(view.skyEvents, locale) : null;` replaces `eventLine`, and both call sites (`:139`, `:157`) pass `event={verdictEvent}`.

#### 3. The measuring script and the re-measure

**Files**: `context/changes/ui-dashboard-tiles/evidence/scripts/dashboard.mjs`, `src/components/tonight/sky-band.ts`

**Intent**: Measure the min-height the way its rule says, for the page and the skeleton (review F3).

**Contract**:
- `dashboard.mjs` gains the viewports `w360` (360×780) and `w640` (640×900), 2x.
- With `--measure` it also prints the verdict container's natural height (with `min-height: 0` injected) on the real page and on the skeleton, and `eventLine` (the number must be read with `eventLine=0`, or with the line hidden).
- `VERDICT_MIN_HEIGHT_CLASS` takes the measured EN go values (expected `min-h-42 sm:min-h-58`), and the comment's arithmetic is redone with the measurement date.

#### 4. The skeleton's verdict bars

**File**: `src/components/tonight/TonightSkeleton.astro`

**Intent**: The skeleton paints the verdict's new geometry, so the swap does not jump.

**Contract**:
- The headline bar is `mt-line`, and the forecast bar (`max-sm:hidden`) is `mt-line`. The reason bar keeps `mt-1`.
- The guard entry shrinks to `{ "mt-1": 1, "mt-6": 1 }`. The exact-count test fails if it doesn't.

#### 5. `/design`

**Files**: `src/components/design/event-samples.ts`, `src/pages/design.astro` (the "VerdictCard: the sky event line" section near `:2146-2210`)

**Intent**: The specimens show the icons the dashboard shows.

**Contract**:
- `verdictLines` become `{ label: string; event: WordedEvent | null }`, from `eventsVerdict` on each sample.
- Every event specimen passes `event`, the panorama one included.
- The section's prose names the icon rule: the kind's icon, solar eclipse included.

#### 6. The guard and e2e

**Files**: `src/styles/rhythm-roles.test.ts`, `tests/e2e/tonight-dashboard.spec.ts`, `tests/e2e/tonight-phone.spec.ts`

**Intent**: The verdict stays on the roles, and its icon is pinned where a run can see it.

**Contract**:
- `GUARDED` gains `components/tonight/VerdictCard.astro`: `{ "mt-1": 1, "mt-2.5": 1, "sm:mt-3.5": 1 }`.
- `tonight-dashboard.spec.ts`, in the existing event-night branch: `[data-verdict-event]` has a `data-fact` equal to one of the six event kinds and exactly one `svg`.
- `tonight-phone.spec.ts`: the header comment notes that the hidden line is a `Fact`, icon included. Its assertions are unchanged.

### Success Criteria:

#### Automated Verification:

- Types, lint and the unit suite pass: `npx astro check && npm run lint && npm test`
- The rhythm guard passes with `VerdictCard` and the skeleton's final counts: `npx vitest run src/styles/rhythm-roles.test.ts`
- The build passes: `npm run build`
- The phase's e2e pass on the preview (4331/4401): `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test tonight-dashboard tonight-phone sky-events tonight-sky red-night-mode planets-on-tonight what-to-expect offline`

#### Manual Verification:

- `VERDICT_MIN_HEIGHT_CLASS` is re-measured at 360 and 640 px (EN go, no event line, `min-height: 0`) on the page and the skeleton; the values are recorded in `evidence/README.md`, and the skeleton and real verdict containers match within 2 px
- The verdict on a no-forecast night (`none`: the preview's `FORECAST_BASE_URL` pointed at a closed port, rebuilt) at 390 px is no taller than before, measured before and after and recorded (review F1)
- The `/design` "sky event line" section in dark, light and red, EN and PL, at 390 and 1280 px shows each line as its own fact with its kind's icon, solar eclipse included

Shots: `evidence/after/c-verdict-event-*` against `evidence/before/`.

**Implementation Note**: After the gates pass, the main session judges the shots, commits the phase and continues to Phase 3.

---

## Phase 3: Rules, the gate, the landing image and the whole suite

**Delegation**: the break check, the whole e2e suite, smoke and judgement go to the main session. CLAUDE.md, the comments, the after-matrix capture, the landing recapture and the evidence README go to a Sonnet subagent, medium effort; the main session reviews the CLAUDE.md wording.

### Overview

Prove the guard bites, write the rule down, record the after state, refresh the landing image at the right height, and run everything the way CI does (the lesson "Run the whole e2e suite before a PR").

### Changes Required:

#### 1. The guard's break check

**Files**: worktree only, on a clean, committed tree; restored afterwards

**Intent**: Show the guard fails on the dashboard files.

**Contract**:
- Add `mt-4` in `TonightTiles.astro`, `space-y-3` in `TonightSkeleton.astro` and a second `mt-1` in `VerdictCard.astro`, then run `npx vitest run src/styles/rhythm-roles.test.ts`. It must fail with each file:line.
- Restore with `git checkout -- src/components/tonight/TonightTiles.astro src/components/tonight/TonightSkeleton.astro src/components/tonight/VerdictCard.astro`, never a pathless checkout. The guard is green again.
- Then drop one allowance's use (remove the slow hint's `mt-6` from the skeleton): the exact-count test must fail. Restore the same way.
- Record both outputs in `evidence/README.md`.

#### 2. The rules

**File**: `CLAUDE.md` (UI (Nightfall): Tokens, Components, Tonight's sky, Phone first; the S-07 paragraph)

**Intent**: The next agent spaces a tile and states an event the same way.

**Contract**:
- **Tokens**: the guarded list names the dashboard files, and allowances are exact.
- **Components**:
  - `Fact`'s kind may be an event kind (`factIcon`), and its `size` may be `body`.
  - "The event kind icon beside an event's name keeps heading ink" is narrowed to the Sky events row's title. The verdict line and the Events tile use muted event icons.
- **Tonight's sky / dashboard**:
  - a tile is a `py-item` row, with its content under the heading through `TILE_CONTENT_CLASS` (`mt-line`), and an explanatory caption is a group;
  - no icons on tile headings; the Events line leads with its kind's icon (the one exception).
- **Phone first**: the new `VERDICT_MIN_HEIGHT_CLASS` values and their date. The first-screen invariant holds for the fresh go night; weather no-go nights are a known limit.
- **S-07 paragraph**: "one muted plain-text line" becomes the muted `Fact` with its kind's icon, and "`VERDICT_MIN_HEIGHT_CLASS` and the skeleton keep today's height" becomes the re-measured values.

#### 3. The after matrix, the landing image and the evidence README

**Files**: `evidence/after/`, `evidence/README.md`, `public/landing/tonight.png`, `tests/e2e/landing-screenshot.spec.ts`, `src/components/Welcome.astro`

**Intent**: Record the change against the before shots, and keep the landing's picture ending on the first tile's rule (review F5).

**Contract**:
- `dashboard.mjs` over dark / light / red × EN / PL × phone / desktop (plus 320 px for EN dark and PL dark), the phone fold included, and `design-section.mjs c-verdict-event`. Downscaled JPEGs, with the before names.
- **The landing image**:
  - Measure the y of the first tile's bottom rule at 1280 px on a night without `[data-verdict-event]` (check it first).
  - Set the height in `landing-screenshot.spec.ts:22` (`VIEWPORT`) and `Welcome.astro:34` (`SCREENSHOT`); the expectation is about 1105.
  - Recapture with `CAPTURE_LANDING=1 BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test landing-screenshot`.
- **The README**: the folders, the scripts, the measurements (first screen EN and PL, tile rows, skeleton, the min-height at 360/640, the `none` night) and the break check.

### Success Criteria:

#### Automated Verification:

- The guard's break check fails on the three files and on the unused allowance, and is green after restoring exactly those files: `npx vitest run src/styles/rhythm-roles.test.ts`
- The whole e2e suite passes on a fresh build and preview (4331/4401), the way CI runs it: `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run test:e2e` (counts recorded)
- Smoke passes: `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run smoke`
- Types, lint, unit suite and build pass on the final tree: `npx astro check && npm run lint && npm test && npm run build`

#### Manual Verification:

- The agent's own check of the after shots (EN/PL, dark/light/red, 390 px including the phone first screen, and desktop) against `evidence/before/`, recorded in `evidence/README.md`
- The owner accepts the dashboard, the verdict line specimens and the new landing image from `evidence/after/`

---

## Testing Strategy

### Unit Tests:

- `eventsVerdict` and `eventsTile`: their kinds and lines, null and unavailable cases, a solar eclipse first.
- `factIcon`: every fact kind, every event kind, the solar eclipse's `Eclipse`, disjoint keys.
- The rhythm guard over the six new or changed entries, the exact-count test, and the break check.
- `fact-islands.test.ts` and the i18n parity stay green (no new keys).

### Integration Tests:

- `tonight-phone.spec.ts`: the first screen at 390×844 in EN (unchanged values), and no sideways scroll at 320 and 375 px in EN and PL.
- `tonight-dashboard.spec.ts`:
  - the tile names and hrefs;
  - the Events line's icon and kind (any day with an event in the window), or no icon on the none line;
  - on an event night, the verdict line's text, no link or button, its `data-fact` and its one svg.
- `planets-on-tonight` and `what-to-expect` cover `Fact`'s focused-page uses after the API change.
- The whole suite and smoke in Phase 3.

### Manual Testing Steps:

1. Open `/tonight` at 390 px in dark, light and red (EN, PL). The tiles are 40 px apart, each heading sits close over its content, the Events line leads with the event's icon, and the Planets reason has its Info icon.
2. Open `/design` → "VerdictCard: the sky event line". Each line has its kind's icon, solar eclipse included.
3. Throttle the network and reload `/tonight`. The tiles and the verdict don't jump when the island arrives.

## Performance Considerations

None: no new requests or islands. One svg more on the Events line, and one on the verdict on event nights.

## Migration Notes

None.

## References

- Research: `context/changes/ui-dashboard-tiles/research.md`
- Plan review: `context/changes/ui-dashboard-tiles/reviews/plan-review.md`
- Experiment: `context/changes/ui-dashboard-tiles/evidence/exp/experiment.diff`
- Umbrella audit: `context/changes/ui-refine/audit.md`
- The focused pages' contract: `context/changes/ui-fact-rhythm/plan.md` (D1, D4, F7)
- Sky-events F3 (no reserved room): `context/archive/2026-10-13-sky-events/reviews/plan-review.md:149-178`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The shared contract and the tiles on the rhythm roles

#### Automated

- [x] 1.1 The helper and resolver tests pass: `npx vitest run src/lib/tonight/sky-events.test.ts src/components/ui/fact-icons.test.ts` — df4aa76
- [x] 1.2 Types, lint and the unit suite pass: `npx astro check && npm run lint && npm test` — df4aa76
- [x] 1.3 The rhythm guard passes with the five new entries and the exact-count test: `npx vitest run src/styles/rhythm-roles.test.ts` — df4aa76
- [x] 1.4 No literal colour or arbitrary value in the dashboard files: `npx vitest run src/styles/no-hardcoded-colors.test.ts` passes and `grep -nE -- '-\[[0-9.]+(px|rem)\]' src/components/tonight/{TonightTiles,EventsTile,VerdictCard,TonightSkeleton,TonightContent,GearCard,SkyCheckCard,EyepiecesPrompt}.astro src/components/ui/{Tile.astro,tile.ts,Fact.astro} src/components/tonight/sky-band.ts` prints nothing — df4aa76
- [x] 1.5 The build passes: `npm run build` — df4aa76
- [x] 1.6 The phase's e2e pass on the preview (4331/4401): `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test tonight-dashboard tonight-phone seven-night-planner sky-events planets-on-tonight what-to-expect telescope-selector offline` — df4aa76

#### Manual

- [x] 1.7 `dashboard.mjs --measure` (EN and PL, 320 / 390 / 1280 px, dark): on the fresh go night the first-screen boxes equal the before values (149 / 701 / 746 against 779 at 390), and each skeleton tile row is within 2 px of the real row at 390 and 1280 EN — df4aa76
- [x] 1.8 The tiles in dark, light and red, EN and PL, at 390 and 1280 px read as one family against `evidence/before/*-tiles.jpg`, with the Events icon aligned to its line (main session's judgement; shots in `evidence/after/`) — df4aa76

### Phase 2: The verdict's event line as a Fact, and the verdict's rhythm

#### Automated

- [x] 2.1 Types, lint and the unit suite pass: `npx astro check && npm run lint && npm test` — c369bf0
- [x] 2.2 The rhythm guard passes with `VerdictCard` and the skeleton's final counts: `npx vitest run src/styles/rhythm-roles.test.ts` — c369bf0
- [x] 2.3 The build passes: `npm run build` — c369bf0
- [x] 2.4 The phase's e2e pass on the preview (4331/4401): `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test tonight-dashboard tonight-phone sky-events tonight-sky red-night-mode planets-on-tonight what-to-expect offline` — c369bf0

#### Manual

- [x] 2.5 `VERDICT_MIN_HEIGHT_CLASS` is re-measured at 360 and 640 px (EN go, no event line, `min-height: 0`) on the page and the skeleton; the values are recorded in `evidence/README.md`, and the skeleton and real verdict containers match within 2 px — c369bf0
- [x] 2.6 The verdict on a no-forecast night (`none`: the preview's `FORECAST_BASE_URL` pointed at a closed port, rebuilt) at 390 px is no taller than before, measured before and after and recorded (review F1) — c369bf0
- [x] 2.7 The `/design` "sky event line" section in dark, light and red, EN and PL, at 390 and 1280 px shows each line as its own fact with its kind's icon, solar eclipse included — c369bf0

### Phase 3: Rules, the gate, the landing image and the whole suite

#### Automated

- [ ] 3.1 The guard's break check fails on the three files and on the unused allowance, and is green after restoring exactly those files: `npx vitest run src/styles/rhythm-roles.test.ts`
- [ ] 3.2 The whole e2e suite passes on a fresh build and preview (4331/4401), the way CI runs it: `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_KEY=<ANON_KEY> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run test:e2e` (counts recorded)
- [ ] 3.3 Smoke passes: `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run smoke`
- [ ] 3.4 Types, lint, unit suite and build pass on the final tree: `npx astro check && npm run lint && npm test && npm run build`

#### Manual

- [ ] 3.5 The agent's own check of the after shots (EN/PL, dark/light/red, 390 px including the phone first screen, and desktop) against `evidence/before/`, recorded in `evidence/README.md`
- [ ] 3.6 The owner accepts the dashboard, the verdict line specimens and the new landing image from `evidence/after/`
