---
date: 2026-10-15T12:58:31+02:00
researcher: Claude (herdr agent "ui-refine", Opus)
git_commit: 42ce808
branch: feat/ui-dashboard-tiles
repository: sidereus (worktree ui-refine)
topic: "/10x-ui audit of the /tonight dashboard: tiles, the verdict's event line and the skeleton on the rhythm roles"
tags: [research, ui, tonight, dashboard, tiles, verdict, skeleton, rhythm-roles, fact]
status: complete
last_updated: 2026-10-15
last_updated_by: Claude (herdr agent "ui-refine", Opus)
---

# Research: the /tonight dashboard on the rhythm roles (ui-refine split, change 3)

**Date**: 2026-10-15T12:58:31+02:00
**Researcher**: Claude (herdr agent "ui-refine", Opus)
**Git Commit**: 42ce808 (main, ui-fact-rhythm #167 merged)
**Branch**: feat/ui-dashboard-tiles
**Repository**: sidereus (worktree `.claude/worktrees/ui-refine`)

## Research Question

The /10x-ui two-way audit of one view, the `/tonight` dashboard (`TonightContent`: the verdict over the sky, the gear row, `TonightTiles` with `EventsTile`, and `TonightSkeleton`), against Nightfall as ui-fact-rhythm left it (rhythm roles `line` 8 / `group` 24 / `item` 20 px, `Fact` / `FactList`, `StatCard` / `StatPair`, `fact-icons.ts`). Output: 3-5 charges with file:line and the effect on the user, plus what the plan must keep: the phone first screen (`tests/e2e/tonight-phone.spec.ts`), `VERDICT_MIN_HEIGHT_CLASS`, the skeleton's parity. Owner decisions that apply: icons 2B (facts only, none on tile headings), the rhythm values, stacked stat cards, the quiet/hairline hierarchy and the bare tile arrow (`context/changes/ui-refine/audit.md` "Owner decisions", amended by ui-fact-rhythm on 2026-10-15).

## Summary

The dashboard has **0** literal colours, palette classes or arbitrary values (the /10x-ui scan over 11 dashboard files: `TonightTiles`, `EventsTile`, `Tile.astro`, `tile.ts`, `VerdictCard`, `TonightSkeleton`, `TonightContent`, `sky-band.ts`, `GearCard`, `SkyCheckCard`, `EyepiecesPrompt`). It also uses **0** rhythm-role utilities: every vertical step in those files is numeric. The problem is the one ui-fact-rhythm fixed on the focused pages: no rhythm and facts that don't look like facts.

Five charges:

1. **C1** (missing tokens): each tile places its content under the heading at its own offset (12, 16 or 20 px) and spaces its lines in its own way.
2. **C2** (missing tokens): the tile row is `py-4 sm:py-5` instead of `py-item`. On a phone, tiles sit 32 px apart against 40 px on every focused page's rows, with gaps inside a tile of 12 to 20 px.
3. **C3** (accidental architecture): the verdict's sky-event line is a muted label 4 px under the reason, with no icon. It reads as the end of the reason, not as its own fact.
4. **C4** (missing tokens): the verdict's lower lines (what to do next, the forecast's freshness) sit 12 px under the reason, as close as the reason's own lines. Moving them onto roles changes the verdict's height from `sm` up, so `VERDICT_MIN_HEIGHT_CLASS` must be re-measured.
5. **C5** (accidental architecture): `TonightSkeleton` hand-copies every tile's and the verdict's offsets, and none of the dashboard files is in the rhythm guard, so the next edit can drift the swap.

A reverted experiment (`evidence/exp/experiment.diff`) applied C1-C5 and was measured on a production preview (4331, forecast fixture 4401, local Supabase):

- **The phone first screen is unchanged.** At 390×844, EN and PL, the headline ends at 149 px, the Site card at 701 px and the Telescope title at 746 px, against the TabBar at 779 px. That is the same 33 px slack as before.
- **The tiles block** is +16 px at 390 px (846 → 862, EN) and −32 px at 1280 px (906 → 874).
- **The skeleton** matches the real tiles row by row (EN, 390 and 1280 px).

## Detailed Findings

### Pre-audit

- **Values**: `src/styles/global.css`. The rhythm tokens are `--spacing-line: 0.5rem`, `--spacing-group: 1.5rem` and `--spacing-item: 1.25rem` (`global.css:682-684`). Components live in `src/components/ui/`. The rules are in `CLAUDE.md` "UI (Nightfall)" (Tokens, Components, Clickables, Phone first).
- **Hardcoded-value scan**: 0 hits over the 11 files above (the /10x-ui grep; script run 2026-10-15).
- **Numeric vertical steps per file** (same run):
  - `TonightTiles` 12 (`mt-2` ×2, `mt-3` ×6, `mt-4` ×2, `mt-5`, `py-1.5`).
  - `EventsTile` 1 (`mt-3`).
  - `tile.ts` 3 (`-my-0.5`, `py-4`, `sm:py-5`).
  - `VerdictCard` 9 (`mt-1` ×2, `mt-2` ×2, `mt-2.5`, `mt-3` ×3, `sm:mt-3.5`).
  - `TonightSkeleton` 17.
  - `TonightContent` 12.
  - **Role utilities: 0 in all 11 files.**
- **The rhythm guard** (`src/styles/rhythm-roles.test.ts:55-100`) covers the `ui/` fact components, the focused pages' item components and `TonightPageSkeleton`. It covers none of the dashboard files.
- **The islands guard** (`src/components/ui/fact-islands.test.ts`) scans only `MoonTimeSlider.tsx`, `TonightSkyView.tsx` and `src/lib/sky-view/*`. `VerdictCard` is an Astro server component rendered as static children of the `TonightSkyView` island (`TonightContent.astro:137-151`), so it may use `Fact` and `fact-icons`: the island receives HTML, not the module.

### C1. Tile content offsets invented per tile (missing tokens)

- **Evidence**: the same slot, "content under the tile heading", is offset differently in each tile:
  - `mt-4` in Targets (`TonightTiles.astro:118`, and the no-targets line at `:138`);
  - `mt-3` in Events, Plan, Moon and Planets (`EventsTile.astro:25`, `TonightTiles.astro:149,156,161,170,174`);
  - `mt-5` in Nights (`:181`).

  Inside the tiles:
  - The Targets list rows are `py-1.5` (12 px between rows, `:120`).
  - The legend is `mt-2` (`:130`) and the caption `mt-3` (`caption`, `:40`).
  - The Planets reason line is `mt-2` (`:171`).
  - The nights grid is `gap-2` both ways (`:181`, `:183`).
- **Effect**: the heading floats at a different distance over each tile's content, so the six tiles don't read as one family (`evidence/before/tonight-phone-en-dark-tiles.jpg`).
  - The Planets reason ("High around 07:59 — best before dawn") is a plain muted line, while on `/tonight/planets` the same sentence is a "why" `Fact` with its Info icon (`PlanetCard.astro:78-80`). The two places state the same fact differently.
- **Fix**: heading → content on `line` (8 px). Inside a tile:
  - One group's lines are on `line`.
  - A caption that explains the whole tile (the targets' legend and caption, the nights caption) is its own group on `group`.
  - The Planets reason becomes `Fact kind="why" tone="muted"`.

  No icon goes on any heading (decision 2B). A summary line stays text: Events, Plan and Moon keep their line, and the Moon keeps its disc.

### C2. The tile row is off the item role (missing tokens)

- **Evidence**:
  - `TILE_ROW_CLASS = "… px-4 py-4 sm:py-5"` (`src/components/ui/tile.ts:9`). The rule says every Tonight list row is `py-item` (CLAUDE.md, UI Tokens: "every Tonight list row, one group or several, is `py-item` (40 px between two rows)").
  - `TILES_GAP_CLASS = "pt-3 sm:pt-6"` (`src/components/tonight/sky-band.ts:11`) adds a second numeric gap before the first tile.
- **Effect**: on a phone, two tiles' contents are 32 px apart (16 + 16) while the gaps inside a tile are 12-20 px. The boundary between tiles is barely wider than a gap inside one, so the rules carry the whole separation. The dashboard is the screen users open first, and it is the densest of the Tonight screens: the focused pages' rows are 40 px apart since ui-fact-rhythm.
- **Fix**: `TILE_ROW_CLASS` takes `py-item` (+8 px per tile below `sm`, unchanged from `sm`), and `TILES_GAP_CLASS` takes `pt-line`. On a phone the first tile's heading stays put (12 + 16 = 8 + 20 = 28 px); from `sm` it moves up 16 px (24 + 20 → 8 + 20).
- **Measured** (experiment, EN, tile heights in px, real/skeleton):

  ```
  390 px   before targets 249 events 89 plan 89 moon 89 planets 117 nights 213   block 846
           after  targets 241 events 93 plan 93 moon 93 planets 121 nights 221   block 862
  1280 px  before targets 257 events 97 plan 97 moon 97 planets 125 nights 233   block 906
           after  targets 241 events 93 plan 93 moon 93 planets 121 nights 233   block 874
  ```

  The targets tile gets shorter because the list rows move from `py-1.5` (12 px between rows, 6 px at each end) to `space-y-line` (8 px). PL at 390 px: 874 → 890; at 320 px: 958 → 974.

### C3. The verdict's sky-event line reads as the end of the reason (accidental architecture)

- **Evidence**: `VerdictCard.astro:92-96`, `<p class="mt-1 text-label font-medium text-muted-foreground" data-verdict-event>`, 4 px under the reason (`:90`), with the same muted ink as the date line (`:80`) and no icon.
  - The audit's S-07 note proposes "a leading Sparkle or kind icon from the shared map, so it reads as its own fact" (`context/changes/ui-refine/audit.md`, "S-07 sky-events").
  - The line's text comes from `eventsVerdictLine`, which words the first of `events.tonight` (`src/lib/tonight/sky-events.ts:340-358`). That event's `kind` exists on the view (`TonightSkyEvent.kind`, `sky-events.ts:26`; solar eclipses sort first, `:307`) but never reaches `VerdictCard` (`TonightContent.astro:130,149,167` pass only the string).
  - The kind icons live in `EVENT_KIND_ICONS` (`src/components/ui/fact-icons.ts:89-96`). `Fact` picks only `FACT_ICONS[kind]` (`Fact.astro:31`), so a Fact with an event-kind icon needs a small API addition.
- **Effect**: on an event night, "…in the dark window. Tonight: Orionids peak" reads as one paragraph (`evidence/before/c-verdict-event-390-en-light.jpg`). The newest and most actionable line under the verdict is the easiest to miss.
- **Fix (experiment)**:
  - The line becomes `Fact` (muted, the event kind's icon) at `mt-line`, with `data-verdict-event` on the Fact root, so the phone spec's `display:none` hides icon and text together (`tonight-phone.spec.ts:66-68`).
  - It grows by 4 px on event nights only (`mt-1` → `mt-line`). The owner already accepted that the line takes no reserved room (sky-events plan review F3, `context/archive/2026-10-13-sky-events/reviews/plan-review.md:149-178`).
  - Shots: `evidence/exp/c-verdict-event-390-{en-light,pl-red,…}.jpg`.
- **Finding from the experiment**: lucide's `Eclipse` (the solar-eclipse kind icon) is a circle with an inner arc. At 16 px, beside "Tomorrow, 11:22: Partial solar eclipse, eclipse glasses only", it reads as a clock, which is `FACT_ICONS.when` (`fact-icons.ts:56`). See `evidence/exp/c-verdict-event-390-en-light.jpg`, the third specimen.
  - The alternative is the amber safety icon (`TriangleAlert` in `text-marginal`), as on the event row's safety line (`SkyEventList.astro:123-124`). It is not pinned by the contrast test on the night sky: the `night` rows pin heading and muted inks.
  - This is an owner choice (see Open Questions).
- **Observation**: the targets tile's not-seen mark is lucide `Sparkles` (`NotSeenMark.astro:11,45,49`) and the meteor-shower kind icon is `Sparkle` (`fact-icons.ts:95`). On an Orionids night both show on the first screen and the next: three four-point sparkles against one. In the experiment shots they are distinguishable (the not-seen mark has the small extra stars), so this is not a charge, only a note for the icon map.

### C4. The verdict's lower lines have no group gap (missing tokens)

- **Evidence**: `VerdictCard.astro` has `mt-2` for the date → headline (`:82`), `mt-1` for the headline → reason (`:90`), `mt-2.5 sm:mt-3.5` for the dot's nudge (`:85`), `mt-3` for "what to do next" on a no-go night (`:97,100`) and its second line `mt-2` (`:101`), and `mt-3` for the forecast's freshness line (`:104`; hidden below `sm` when fresh, `:65`).
  - The skeleton copies the date, headline, reason and forecast offsets (`TonightSkeleton.astro:41-44`).
  - `VERDICT_MIN_HEIGHT_CLASS = "min-h-42 sm:min-h-59"` is the measured go verdict at 360 and 640 px, with its arithmetic in the comment (`sky-band.ts:35-45`). Its rule is "re-measure … after any change to the verdict's lines, sizes or copy, never compute it".
- **Effect**: on a weather no-go night, the next-step sentence ("Next clear night: …") sits 12 px under the reason, as close as the reason's two lines are to each other. The answer (the headline and why) and the advice don't separate. The forecast line ("Forecast updated 5 min ago", or the bold fallback) hangs the same way under the reason from `sm`.
- **Fix (experiment)**:
  - The date → headline offset moves to `mt-line` (8 px, the same as `mt-2`).
  - The next-step block and the forecast line move to `mt-group`, and the next-step block's second line to `mt-line`.
  - The headline → reason `mt-1` stays: it is the display line's own leading, not rhythm. It would go on the guard's allowlist, like the dot's nudge.
- **Measured** (experiment, the verdict `section`'s height, EN go night): 390 px 117 → 117 (the fresh forecast line is hidden on a phone), 1280 px 132 → 144 (+12). So `sm:min-h-59` grows by about 12 px. It must be re-measured at 640 px on the EN go verdict, as the rule says, and the expected value is about `sm:min-h-62`. Below `sm`, `min-h-42` should hold, and the plan re-measures it at 360 px anyway.

### C5. The skeleton copies the tiles by hand, and nothing guards the dashboard (accidental architecture)

- **Evidence**: `TonightSkeleton.astro:71-124` redraws each tile with its own offsets (`mt-4 space-y-3 py-1.5`, `mt-2`, `mt-3` ×5, `mt-5`, `gap-2`). Only the row class is shared (`TILE_ROW_CLASS`, `:22,29`).
  - Parity was measured once, by hand (ui-user-adjustments phase-5 review, EN 390 221/89/89/117/213, `context/archive/2026-10-08-ui-user-adjustments/reviews/impl-review-phase-5.md:43-45`).
  - None of `TonightTiles`, `EventsTile`, `VerdictCard`, `TonightSkeleton` or `tile.ts` is in `GUARDED` (`rhythm-roles.test.ts:55-100`).
- **Effect**: any later tile edit can move the real content without the skeleton (a jump when the island swaps in), or slip a numeric step back in, and no test notices. The first is a visible jump on the screen users see first.
- **Fix**: the tile and verdict files and `TonightSkeleton` join `GUARDED`, with exact allowlists for the steps that are not rhythm:
  - the cue's `-my-0.5` in `tile.ts`;
  - the dot's nudge and the reason's `mt-1` in `VerdictCard`;
  - the skeleton's slow-hint `mt-6`, the `mt-0` zeros and the bar-row geometry, which the plan counts.

  `sky-band.ts` stays out of the guard: it holds the band's fixed geometry (`pb-10`, `pt-12`, `-mt-16`, the slider row), which is not rhythm.

  The skeleton's tile rows keep mirroring `TonightTiles` tile by tile.
- **Measured** (experiment, EN): skeleton rows 241/93/93/93/121/221 at 390 px and 241/93/93/93/121/233 at 1280 px, equal to the real rows.
  - The page's skeleton-versus-real height difference is the same before and after (−35 px at 390, −36 px at 1280, EN). It comes from outside the tiles, so it is out of scope (see Deferred).
  - PL at 320 px still differs on the targets tile (Polish names wrap, `Gromada podwójna w Perseuszu`), as accepted in ui-user-adjustments.

### Deferred (not addressed by this change)

- **Below the tiles** (`TonightContent.astro:222`, `space-y-6 pt-8`: the sky-check card, the setup prompts and the eyepieces prompt): these are cards and bands with their own internal layout, not tiles. Deferred to the change that next touches `SkyCheckCard` or the prompts (ui-refine change 5 or later).
- **The gear row** (`GEAR_ROW_GAP_CLASS = "pt-2 sm:pt-4"`, `sky-band.ts:10`; `GearCard`'s own `p-3 sm:p-4`, `mt-2 sm:mt-3`): it sits above the tiles and inside the first-screen geometry (33 px slack at 390×844). Converting it buys nothing the user sees on a phone (it is already 8 px there) and would shift the cards from `sm`. It stays as is.
- **The page's skeleton/real difference outside the tiles** (−35 px at 390 EN, before and after): pre-existing, not tile content.
- **Desktop length**: no new layout; decision 5 keeps one column.

## Code References

- `src/components/tonight/TonightTiles.astro:40,114-224`: the tiles and their numeric offsets.
- `src/components/tonight/EventsTile.astro:24-27`: the events tile's line (`data-events-tile-line`).
- `src/components/ui/tile.ts:9,18-25`: the row, the heading and the cue classes; `Tile.astro:26-33` (root is the `<a>`, `/design` relies on it).
- `src/components/tonight/VerdictCard.astro:79-105`: the verdict's lines and the event line (`:92-96`).
- `src/components/tonight/TonightContent.astro:130,137-174,216-220`: `eventLine`, the two VerdictCard call sites and the tiles' gap.
- `src/lib/tonight/sky-events.ts:25-30,83-90,307,340-358`: `TonightSkyEvent.kind`, `tonight` (solar eclipses first) and `eventsVerdictLine`.
- `src/components/ui/Fact.astro:18-48`, `fact-icons.ts:54-96`: the Fact API and the icon maps.
- `src/components/tonight/TonightSkeleton.astro:39-124`: the verdict bars and the six tile rows.
- `src/components/tonight/sky-band.ts:9-11,33-45`: the gaps, the verdict container and its min-height.
- `src/styles/rhythm-roles.test.ts:55-100`: `GUARDED`.
- `tests/e2e/tonight-phone.spec.ts:66-68,73-119`: the first-screen test (hides `[data-verdict-event]` while it measures).
- `tests/e2e/tonight-dashboard.spec.ts:25-35,58-70,95-107,119`: the tile links' names and hrefs, the events tile line, and the verdict line's text (`VERDICT_LINE_START`) with no link or button in it.
- `tests/e2e/landing-screenshot.spec.ts:76-80`: relies on the targets tile's `<li>` rows.
- `src/pages/design.astro:641-646` (`*:*:bg-accent` / `*:bg-accent` depth selectors), `:2146-2210` (the verdict event specimens), `:2495-2530` (Tile specimens with their own `mt-2` / `mt-3` spans and a `TILE_ROW_CLASS` skeleton row), `:2759-2830` (TonightTiles and EventsTile specimens), `:3074-3083` (TonightSkeleton); `src/components/design/event-samples.ts:51,137-144` (`verdictLines`: label and line, no kind).

## Architecture Insights

- The dashboard reuses the focused pages' contract directly: a tile is one Tonight list row (`py-item`), its heading and content are one group (`line`), and an explanatory caption is a second group (`group`). There is no new token.
- **Fact API.** `Fact` needs one addition for event facts: an icon from `EVENT_KIND_ICONS` instead of `FACT_ICONS[kind]`. The experiment used an `eventKind` prop. The icon still comes from the one map ("one concept, one icon"), and `data-fact` keeps the concept.
- **Fact markup.** `Fact` is a `div`, so inside a tile's `<a>` it goes in a `div`, never a `span`. A block inside `<a>` is valid HTML5 (the targets tile already holds a `<ul>`).
- **Class merging.** `class:list` does not merge Tailwind conflicts: `[caption, "mt-group"]` with `caption` holding `mt-line` rendered 8 px in the experiment, since the stylesheet's order decides. Overrides go through `cn()` (CLAUDE.md, Conventions).
- **Contracts the change must keep:**
  - `Tile`'s root stays the `<a>` (`/design` depth selectors).
  - The `tile-*-heading` ids and `aria-labelledby` names (`tonight-dashboard.spec.ts:60-68`).
  - The targets tile's `<ul><li>` (`landing-screenshot.spec.ts:76-80`).
  - `data-tonight-tiles`, `data-events-tile-line` and `data-verdict-event`, with no link or button inside the verdict line (`tonight-dashboard.spec.ts:104-105`).

## Historical Context (from prior changes)

- `context/archive/2026-10-07-ui-mobile-pass/plan.md:151,164,175-194`:
  - A tile shows one short summary, and only "Point here first" keeps a list.
  - The tiles were first `py-3 sm:py-4`.
  - The Plan tile lost its mini timeline.
  - The nights bars are `h-10 sm:h-18`.
  - The tile stack measured about 644 px at 390 px against a ≤600 px criterion that was left open (`verification.md:23,85`). There was no later ruling.
- `context/archive/2026-10-08-ui-user-adjustments/plan.md:475,517-519`:
  - The first target needs a scroll (owner).
  - Tiles got more padding, which is today's `py-4 sm:py-5`.
  - "Spacing in tiles comes from shared parts".
  - The verdict min-height was measured on 2026-10-08 at 360 and 640 px.
- `context/archive/2026-10-13-sky-events/reviews/plan-review.md:149-178`, F3 (owner): no reserved room for the event line, the one-line shift is accepted, and the phone spec hides the line while it measures.
- `context/archive/2026-10-14-adjustable-session-plan/plan.md:92,607-612`, D13: the Plan tile follows the edited plan. This is implemented (`TonightTiles.astro:52-64`). Nothing is deferred to the dashboard, and the tile line keeps "First up / Next / Nothing left".
- `context/archive/2026-10-14-ui-quiet-actions/`: the bare muted tile arrow (`TILE_CUE_CLASS`), already shipped.
- `context/archive/2026-10-14-ui-fact-rhythm/plan.md` (D1, F2, "What we're not doing"):
  - item = 20 px each side of the rule, and one-group rows use `py-item` too.
  - The stat pair is stacked.
  - The dashboard, `TonightTiles`, the verdict's event line and `tonight-phone.spec.ts` were left to this change.

## Related Research

- `context/changes/ui-refine/audit.md`: the umbrella audit (finding 4, S-07 notes, the split's change 3).
- `context/archive/2026-10-14-ui-fact-rhythm/research.md`: charges C1-C5 for the focused pages, and the role values.

## Open Questions

For the owner (UI decisions; the plan carries them as agent defaults):

1. **Solar-eclipse icon on the verdict line**: the kind icon `Eclipse` (one icon per kind, but it reads as a clock at 16 px) or the amber safety triangle (the line already says "eclipse glasses only"). Agent default: the safety triangle in `text-marginal` for the solar eclipse only, with the contrast test's night rows extended to pin it.
2. **Events tile's line**: no icon (2B literally: the tile's summary is text) or the same kind icon as the verdict line. Agent default: no icon.
3. **The targets tile's list rhythm**: `line` (8 px between the three rows, tighter than today's 12 px) or `group`. Agent default: `line`, since they are one group.
