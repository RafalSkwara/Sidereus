# Grouped, icon-led facts with a spacing rhythm (ui-fact-rhythm) Implementation Plan

## Overview

This change gives the Tonight focused pages' item lists a fact rhythm. It is the second change of the ui-refine split (`context/changes/ui-refine/audit.md`: findings 2, 4, 5, 8 and 9; owner decisions 2, 3 and 5).

- **Window and Best** become two small stat cards, side by side in one row at every width.
- **Every other fact** is one icon-led line.
- **A hairline** separates "when" from "what and how".
- **Spacing** comes from three rhythm roles instead of per-file steps.
- **Group labels** share one `text-overline` role.
- **Icons** come from one shared map, which absorbs S-07's event-kind icons.

The views are Targets, Planets, the Moon, Sky events and Nights. The finder's what-to-expect line shares the new component.

The research and its five charges are in `research.md` (C1-C5). A reverted experiment of the stat cards and fact rows, with before and after shots, is in `evidence/exp-stat-cards/` and `evidence/before/`.

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
- The "between lines" role alone has six spellings (`gap-y-2`, `space-y-3`, `space-y-2`, `space-y-1`, `space-y-1.5`, `gap-2`).
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
- The experiment built and rendered with these utilities.

**Tests**
- No test reads `dl`/`dt`/`dd`, the Window/Best text, planet or Moon fact text, the reason or the note. There are no screenshot baselines.
- Seven locator families are fragile and must survive (research, "Tests that pin this markup"):
  - `[data-expect]` text exactly the phrase;
  - `[data-event-visibility]` text exactly the sentence;
  - the event name is the row's first `h4`;
  - one visible mark per row;
  - Nights `h3` + sibling `ol` and `ol > li` count 7;
  - Planets `getByRole("listitem")` cards (no `<li>` inside a card);
  - `li#object-…` and `li#planet-…` ids;
  - `tonight-phone.spec`'s no-sideways-scroll at 320/375 px.
- `build.test.ts:745-766` pins the planet fact wording.

## Desired End State

**Targets, Planets and the Moon**
- Each item reads in three groups:
  1. the identity (name, detail line; for a planet, its labelled facts: Brightness, Apparent size, Phase, Rings);
  2. the **stat pair** (Window "20:51–07:10"; Best "03:21" over "NNE, 87°");
  3. after a hairline, the "what and how" facts, each with its icon: what you'll see (Eye), the eyepieces (Telescope), why (Info, muted).
- Then come the actions from ui-quiet-actions.
- Items are 32 px apart, groups 20 px, lines 8 px.

**Moon**
- The Moon's up and faint lines beside the disc are icon-led facts.

**Sky events**
- Each row keeps its kind icon, name and visible mark.
- Its details, visibility, notes and safety line become one fact per line.
- Night headings use the overline role.

**Nights**
- The group labels use the overline role.
- Each night's reason, cloud and moon lines are muted icon-led facts.

**Contract**
- `/design` shows the roles, the overline, `StatCard`/`StatPair`, `Fact`/`FactList` and the icon map in dark, light and red, at 320 px and on desktop, with Polish values.
- A guard test stops the view family from using numeric vertical spacing again.
- CLAUDE.md names the roles, the components and the stat cards as the second boxed exception.

**Verify**: the screenshot matrix (`evidence/before` vs `evidence/after`), the whole e2e suite and smoke, and the owner's look at the before/after crops.

### Key Discoveries:

- `TargetDetails` already owns the spacing between its parts so callers carry none (`TargetDetails.astro:2-6`). The new components extend that, and the Moon gets the stat pair through it for free (experiment, `evidence/exp-stat-cards/moon-phone-en-dark.jpg`).
- **Slotted text can lose a space.** "Do szczegółów:10 mm Plössl" rendered when a sentence was slotted straight into the experiment's `Fact` (`evidence/exp-stat-cards/planets-pl-dark.jpg`). Fact content must sit in its own element.
- **Desktop.** A half-width stat card at 1280 px floats its value in a 360 px box (`evidence/exp-stat-cards/targets-desktop-pl-light.jpg`). Cap the pair's width from `sm`.
- `TonightTiles.astro:160,170` reads `moonCard.phaseText` and `solarSystem.entries[0].reason`. Their types and wording stay.
- **S-08** (worktree `adjustable-session-plan`, HEAD 9bf8043, not merged) adds `id="object-<id>" scroll-mt-4` to `ObjectRow`'s root `<li>` and to the washed-out `<li>`. It touches `design.astro`, `en.ts`/`pl.ts` (`tonight.pages.plan.*`, `errors.*`), `tonight-phone.spec.ts` and CLAUDE.md, and nothing in this change's components or keys.

## What We're NOT Doing

- **The dashboard** (`/tonight`, `TonightTiles`, the verdict's S-07 event line): change 3, `ui-dashboard-tiles`.
- **Navigation** (the Tonight sub-nav, Progress as a destination): change 4, `ui-tonight-nav`.
- **/log, /log/progress and /gear**: change 5, `ui-log-progress-gear`.
- **The plan page** (`/tonight/plan`, `SessionTimeline`, `PlanPageContent`): S-08 is changing it in parallel. Its "Best … · window …" line keeps its wording (`tonight-dashboard.spec.ts:142`).
- **Splitting the targets' `reason`** into separate facts. It is one pre-joined string of two ranking components (`format.ts:328-333`), and splitting it needs view-model parts. It stays one muted "why" fact.
- **A shorter Nights reason, or merging identical reasons (C5, deferred).** The sentence comes from seven reason variants shared with the dashboard verdict. A short form needs a parallel key family in both languages and the reason kind on `TonightNight`. With real weather the lines differ per night.
- **Uppercase overlines.** Polish night headings ("Noc: środa, 21 października 2026") would shout.
- **New colour tokens.** The stat card reuses the gear cards' `bg-surface` and `--border`.
- **Changing `buttonVariants`** or the action row. That was ui-quiet-actions.

## Implementation Approach

The /10x-ui order:

1. Environment/library: nothing to add; lucide-react and Tailwind v4 are present.
2. Token values and the shared contract: Phase 1.
3. The copy the labels need: Phase 2.
4. The views: Phases 3 and 4.
5. States, the guard, rules and the gate: Phase 5.

Each charge maps to a phase:

| Charge | Phase(s) |
|---|---|
| C1 Fact/StatCard | 1, then 3 and 4 |
| C2 rhythm roles | 1, then 3 and 4, with the guard in 5 |
| C3 overline | 1 and 4 |
| C4 icon map and planet labels | 1, 2 and 3 |
| C5 Nights reason | 4 (icons and roles); the copy is deferred |

**Delegation** (owner rule, 2026-10-14):
- UI code phases go to a subagent with `model: "opus"` at high effort. That covers components, layout, tokens and styling, `/design`, UI e2e and screenshot judgement.
- Non-UI code (copy keys with the view model's wording, a source-scan guard) goes to `model: "sonnet"` at high effort.
- Docs and screenshot capture go to `model: "sonnet"` at medium effort.
- Haiku is never used for code.

**Every implementation brief**:
- gives the `nvm use` prefix up front;
- forbids web sourcing (everything needed is in `research.md` and here);
- batches lint, types and the related tests in one command while iterating: `npx astro check && npm run lint && npx vitest related <changed files> --run`;
- names the preview port 4331 and the fixture port 4401;
- says keys go inline only and `test:db` is never run.

The main session runs the full gates once per phase (`npm test`, `npm run build`, the phase's e2e list), commits, and judges the screenshots. Break checks, the whole e2e suite before the PR and the Opus implementation review stay as in earlier changes.

**Agent decisions to confirm at plan review** (the agent cannot ask the owner directly; each is the recommended default, and the reviewer relays them in Polish):

- **D1. Roles.** `line` 8 px, `group` 20 px, `item` 32 px, fixed at every width.
  - An item that holds groups (target, planet, Moon target, event) is `py-item`.
  - A one-group row (a night, a washed-out row) is `py-group`.
- **D2. Overline.** 13 px / 20 px, weight 600, tracking 0.04em, sentence case, muted ink. It is used for the Nights group labels and the event night headings.
- **D3. Stat card.**
  - It is the gear cards' bordered `bg-surface` box, `rounded-lg`, with a caption label and its icon over a `font-mono text-body` semibold value.
  - Best's direction sits on a second muted line, because one line wraps at 320 px.
  - The pair is `grid-cols-2` at every width, capped at `max-w-md` from `sm`.
  - In red the border is faint and the fill carries the shape, the same as the gear cards.
- **D4. Fact icons are muted.** The expect line's Eye moves from `text-primary-strong` to muted like every fact, and the line keeps its first place and foreground ink. Exceptions: the solar safety icon keeps `text-marginal`, and the event kind icon and visible mark keep heading ink.
- **D5. Fact order.** Identity, then the stat pair, then the hairline, then "what you'll see" (expect or note), then the eyepieces, then why (muted).
  - The Moon target's note moves above its eyepieces; today it is last and muted.
  - A planet's labelled facts stay under its name as identity.
- **D6. Planet labels and values.**

  | Fact | EN label | EN value | PL label | PL value |
  |---|---|---|---|---|
  | magnitude | Brightness | mag −1.9 (unchanged) | Jasność | −1,9 mag |
  | size | Apparent size | 34″ | Średnica kątowa | 34″ |
  | phase | Phase | 62% lit | Faza | 62% |
  | rings | Rings | tilted 7° | Pierścienie | nachylone o 7° |

- **D7. Event rows** keep the kind icon (heading ink, `size-5`) beside the name, and their facts carry their own `size-4` muted icons. Each detail is its own line instead of being joined with " · ".
- **D8. C5 deferred** (see What We're NOT Doing).

## Critical Implementation Details

- **Whitespace in slotted text.** `Fact` wraps its content in its own element, and callers pass sentences inside a `<p>` or `<span>`, never as bare text and expressions straight in the slot. Phase 3 adds an e2e assertion on the Polish planet eyepiece line ("Do szczegółów: " followed by the name) so the lost space cannot come back.
- **Markers stay exact.** `data-expect`, `data-event-visibility` and `data-event-note` move onto the `Fact` root, whose only text is the sentence (the icon is an `aria-hidden` svg with no text). No visible label may enter these elements.
- **No nested lists.** `FactList` renders a `div`, never `ul`/`ol`/`li`, because `planets-on-tonight.spec.ts:34` counts `listitem`s and `seven-night-planner.spec.ts:126` counts `ol > li`.
- **Island guard.** `Fact`, `FactList` and the icon map are Astro and plain TS. They must never be imported by `TonightSkyView` or `MoonTimeSlider`; the Moon's facts are passed in as the slider's server-rendered children, as today.
- **S-08 rebase.** Whichever change merges second keeps S-08's `id="object-${entry.id}" scroll-mt-4` on `ObjectRow`'s root `<li>` and on the washed-out `<li>`, and both changes' keys in `en.ts`/`pl.ts`. This change keeps off `PlanPageContent`, `SessionTimeline`, `TonightContent` and `src/lib/offline/*`.

## Phase 1: The contract: roles, overline, icon map, Fact and StatCard, specimens

**Delegation**: Opus subagent, high effort (tokens, shared components, `/design`).

### Overview

Add the spacing and overline roles, the shared icon map, and the four shared components, and show them in `/design`. No view changes yet, except `SkyEventList` taking its kind icons from the map, which is a pure move.

### Changes Required:

#### 1. Roles

**File**: `src/styles/global.css`

**Intent**: Publish the three rhythm roles and the section-label role next to the type roles, with a comment on what each is for (C2, C3).

**Contract**: in `@theme inline`, after `--text-caption--line-height`:
- `--text-overline: 0.8125rem`, with `--line-height: 1.25rem`, `--letter-spacing: 0.04em`, `--font-weight: 600`;
- `--spacing-line: 0.5rem`;
- `--spacing-group: 1.25rem`;
- `--spacing-item: 2rem`.

They live only in `@theme inline` (no `:root` entry, so no red value is needed).

#### 2. The icon map

**File**: `src/lib/ui/fact-icons.ts` (new)

**Intent**: One vocabulary of decorative lucide icons for facts and event kinds, so a concept has one icon everywhere (C4).

**Contract**: `FACT_ICONS` is keyed by a `FactKind` union:
- `window` Clock, `best` Compass;
- `expect` Eye, `see` Eye;
- `eyepiece` Telescope, `reason` Info;
- `magnitude` SunDim, `size` Diameter, `phase` Contrast, `rings` Ellipse;
- `moonUp` MoonStar, `moonFaint` CloudMoon;
- `cloud` Cloud, `moon` Moon;
- `detail` Ruler, `visibility` Compass, `hidden` Info, `note` Lightbulb, `safety` TriangleAlert.

`EVENT_KIND_ICONS` is moved verbatim from `SkyEventList.astro:29-36` and still `satisfies Record<SkyEventKind, …>`.

`VISIBILITY_MARK_ICONS` holds `{ visible: Eye, notVisible: EyeOff }`.

No other imports, so it stays island-safe and tiny.

#### 3. `Fact` and `FactList`

**Files**: `src/components/ui/Fact.astro`, `src/components/ui/FactList.astro` (new)

**Intent**: One fact, an icon from the map, an optional muted label, then the value or sentence, with the rhythm owned here (C1).

**Contract**:
- `Fact` props:
  - `kind: FactKind`;
  - `label?: string`;
  - `tone?: "default" | "muted"`;
  - `iconClass?` (only the safety line's `text-marginal`);
  - any `data-*` attributes forwarded to the root.
- `Fact` markup:
  - the root is a `div` (`flex items-start gap-2 text-label`) carrying `data-fact={kind}`;
  - the icon is `size-4 shrink-0` muted, `aria-hidden`, aligned to the first line;
  - then a `min-w-0` content wrapper holding the label (`text-muted-foreground`, followed by a real space) and the slot.
- `FactList`: a `div` with `space-y-line`.
- Neither renders a list element.

#### 4. `StatCard` and `StatPair`

**Files**: `src/components/ui/StatCard.astro`, `src/components/ui/StatPair.astro` (new)

**Intent**: Window and Best as two small cards side by side at every width (decisions 2 and 5; D3).

**Contract**:
- `StatPair` is a `<dl>`, `grid grid-cols-2 gap-3 sm:max-w-md`.
- `StatCard` props:
  - `label`, `kind: FactKind`;
  - the slot is the value;
  - an optional named slot `sub` holds a second, muted `text-label` line.
- `StatCard` markup:
  - a `div` with `rounded-lg border border-border bg-surface px-3 py-2`;
  - a `<dt>` holding a `text-caption` muted label with a `size-3.5` icon;
  - a `<dd>` holding the `font-mono text-body font-semibold text-heading` value.

#### 5. Event kinds from the map

**File**: `src/components/tonight/SkyEventList.astro`

**Intent**: Replace the local `ICONS` and the Eye/EyeOff imports with the map's `EVENT_KIND_ICONS` and `VISIBILITY_MARK_ICONS`. The output is unchanged.

**Contract**: the same icons per kind; the `satisfies Record<SkyEventKind, …>` check lives in the map.

#### 6. `/design`

**File**: `src/pages/design.astro`

**Intent**: Show the contract in the kitchen sink, in the 7-state matrix (C1-C4).

**Contract**:
- In "Type and radius": a `text-overline` sample, and a spacing strip showing `line`, `group` and `item` at their sizes.
- In "Components × states", new sections `c-stat-pair`, `c-fact` and `c-fact-icons`:
  - the stat pair with EN and Polish values, inside a 320 px column and at full width (the desktop cap);
  - `Fact` with a label, with a sentence, muted, multi-line, Polish (the "Do szczegółów: …" spacing case) and the safety tone;
  - the icon map rendered as a grid of every `FactKind` and event kind with its name.
- States:
  - default is shown;
  - hover, focus-visible and disabled are N/A (not interactive: no link, no control; offline leaves facts untouched);
  - error is N/A (facts show data, never an error; errors stay the page's own notices);
  - empty: a `FactList` with no facts renders nothing (shown as an empty frame with its note);
  - loading is N/A for the component (the focused page's `TonightPageSkeleton` stands in, unchanged).

### Success Criteria:

#### Automated Verification:

- Types, lint and the related tests pass in one run: `npx astro check && npm run lint && npx vitest related src/styles/global.css src/lib/ui/fact-icons.ts src/components/tonight/SkyEventList.astro src/pages/design.astro --run`
- The whole unit suite passes (including `no-hardcoded-colors`, `red-theme`, `contrast`, `runner-zone-guard`, `no-console-guard`): `npm test`
- `npm run build` succeeds, and the built CSS contains `gap-line`/`space-y-line`, `py-item` and `text-overline` rules (grep `dist/client/_astro/*.css`)
- `sky-events.spec.ts` passes against a fresh local preview (the icon move changes nothing)

#### Manual Verification:

- `/design` (via `astro dev` on 4331) at 390 px and 1280 px in dark, light and red: the roles read as three clearly different steps; the stat pair fits the 320 px column with "Najlepiej" and "Widoczność"; the pair is capped on desktop; the Polish fact keeps the space after the colon; every icon in the map is distinct and recognisable

---

## Phase 2: Planet fact labels and value wording

**Delegation**: Sonnet subagent, high effort (copy keys plus the view model's wording and its unit test; no UI).

### Overview

Give each planet fact a label and make the values label-free (C4, D6), so Phase 3 can render "Brightness · mag −1.9" without the label appearing twice.

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

- One batched run passes: `npx astro check && npm run lint && npx vitest related src/i18n/messages/en.ts src/i18n/messages/pl.ts src/lib/tonight/format.ts --run`
- The whole unit suite passes: `npm test`

---

## Phase 3: Targets, Planets, the Moon and the finder's expect line

**Delegation**: Opus subagent, high effort (layout, components, UI e2e). Screenshot capture: Sonnet subagent, medium effort. Judgement: the main session.

### Overview

Rebuild the shared target details and their three callers on the contract (C1, C2, C4; D3-D6). This is the view the owner sees most.

### Changes Required:

#### 1. The shared details

**File**: `src/components/tonight/TargetDetails.astro`

**Intent**: Window and Best become a `StatPair`. The slot sits under a hairline. The actions follow at the group step.

**Contract**:
- `StatPair` at `mt-group`:
  - Window: `windowStart`–`windowEnd`;
  - Best: the value `bestTime` and the sub line `bestDirection`.
- The slot wrapper is a `FactList` with `mt-group border-t border-border pt-group`.
- The action row moves to `mt-group`, keeping its `gap-x-5 gap-y-2` and both links unchanged.
- The header comment is rewritten: Window and Best side by side at every width (decision 5); every other fact on its own line.
- Props are unchanged.

#### 2. A target's facts

**File**: `src/components/tonight/ObjectDetails.astro`

**Intent**: Each slot line becomes a `Fact`, in D5's order, with the eyepiece pair as one fact on two lines.

**Contract**:
- `Fact kind="expect"` carries `data-expect={key}`, with the phrase in a `<span>`.
- `Fact kind="eyepiece"` holds the two existing `<p>` lines (the find/detail wording, bold heading-ink names and `first-letter:uppercase` kept), or the none-fit sentence.
- `Fact kind="reason" tone="muted"` holds `entry.reason`.
- The local `Eye` import goes.

#### 3. Rows

**Files**: `src/components/tonight/ObjectCard.astro`, `ObjectRow.astro`, `TargetsPageContent.astro`

**Intent**: Rows use the item role. Everything else in the page content stays.

**Contract**:
- `ObjectCard` `<li>` is `py-item first:pt-0 last:pb-0`, and its detail line is `mt-line` (was `mt-1`).
- `ObjectRow`'s body is `pb-item pl-10` (the `pl-10` aligns with the rank column), and its 44 px summary keeps `py-4`.
- In `TargetsPageContent`, only the spacing that frames these lists moves to roles where a role fits (`mb-4` under the count line → `mb-group`). The washed-out rows are `py-group`.
- On a rebase onto S-08, keep its `id`/`scroll-mt-4` attributes.

#### 4. Planets

**Files**: `src/components/tonight/PlanetCard.astro`, `SolarSystemSection.astro`

**Intent**: The planet facts become labelled facts under the name. The details follow D5.

**Contract**:
- Under the `h3`, a `FactList` at `mt-line` holds:
  - `Fact kind="magnitude"`, `"size"`, `"phase"` and `"rings"`, each with its `factLabel` and a `font-mono text-heading` value `<span>`;
  - null facts are skipped as today.
- The `<li>` is `py-item first:pt-0 last:pb-0`.
- The slot order:
  1. `Fact kind="see"` with `entry.note`;
  2. `Fact kind="eyepiece"` with the detail-with line in a `<p>`;
  3. `Fact kind="reason" tone="muted"` with `entry.reason`.
- `SolarSystemSection`'s `mt-2`/`mt-5`/`mt-4` move to `mt-line`/`mt-group`.
- The list stays `<ol aria-label>` of `<li id="planet-<key>">`.

#### 5. The Moon

**File**: `src/components/tonight/MoonCard.astro`

**Intent**: The slider's text children become facts. The target block gets the shared pair and D5's order.

**Contract**:
- Children:
  - `Fact kind="moonUp"` with `upText` (semibold heading ink kept);
  - `Fact kind="moonFaint"` with `faintText`;
  - the washed-out quiet link unchanged.
- The target block is `mt-item border-t pt-item`.
- Slot order:
  1. `Fact kind="see"` with `target.note`;
  2. `Fact kind="eyepiece"` with the whole-disc and detail lines (or `partDisc`), each in its `<p>`;
  3. `Fact kind="reason" tone="muted"` with `target.reason`.
- The no-states branch (`phaseText` only) is unchanged.

#### 6. The finder's expect line

**File**: `src/components/finder/FinderContent.astro`

**Intent**: The duplicated expect markup becomes the shared `Fact` (C1). Its place above the chart and outside `[data-finder-chart]` are unchanged.

**Contract**: `Fact kind="expect" data-expect={key}` with the text in a `<span>`. The local `Eye` import goes if unused.

#### 7. Specimen data and e2e

**Files**: `src/pages/design.astro`, `tests/e2e/planets-on-tonight.spec.ts`

**Intent**: The `/design` ObjectDetails specimen shows every line. A spec pins the planet labels and the Polish spacing.

**Contract**:
- `design.astro`: the "What to expect" ObjectDetails specimen gets a sample with a find/detail pair and a reason. Only `expectSample` changes, or a second sample next to it, not the shared `sampleTarget` that the tiles use.
- `planets-on-tonight.spec.ts`:
  - each card's `[data-fact="magnitude"]` and `[data-fact="size"]` contain their `factLabel` text;
  - in Polish, a card's `[data-fact="eyepiece"]` text matches `Do szczegółów: \S`, using a Polish context as the spec's helpers do.

### Success Criteria:

#### Automated Verification:

- One batched run passes: `npx astro check && npm run lint && npx vitest related <the changed component and page files> --run`
- `npm test` and `npm run build` pass
- The affected specs pass against a fresh local preview (ports 4331/4401, keys inline): `npx playwright test tonight-phone tonight-targets what-to-expect planets-on-tonight moon-as-target moon-card observation-log observing-progress telescope-selector onboarding tonight-sky finder-chart finder-offline red-night-mode`
- The hardcoded-value scan over the changed view files prints nothing, and their numeric vertical spacing utilities are only those this plan keeps (`ObjectRow`'s summary `py-4`, icon alignment inside `ui/`)

#### Manual Verification:

- Targets, Planets and the Moon at 390 px and 1280 px, EN and PL, dark, light and red, captured with `evidence/scripts/capture.mjs` (Sonnet, medium) and judged against `evidence/before/`:
  - three groups per item, the hairline visible, stat pair readable in red;
  - Best's direction on its own line, the pair capped on desktop;
  - planet labels present, no lost spaces, no sideways scroll at 320 px

---

## Phase 4: Sky events and the Nights page

**Delegation**: Opus subagent, high effort (layout, components, UI e2e). Capture: Sonnet, medium.

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
- The header (kind icon `size-5`, `h4` name first, the single visible/not-visible mark, the muted "kind · when" line with `[data-event-when]`) keeps its markup and markers.
- Under it, a `FactList` at `mt-group` holds:
  - one `Fact kind="detail"` per entry of `event.details` (no longer joined with " · ");
  - `Fact kind="visibility"` (visible) or `kind="hidden"` (not visible), carrying `data-event-visibility`, with only the sentence;
  - one `Fact kind="note" tone="muted"` per note, carrying `data-event-note`;
  - `Fact kind="safety" iconClass="text-marginal"`, carrying `data-event-safety`, with the fixed line.
- A not-visible row keeps its muted tone on every fact.

#### 2. Nights

**File**: `src/components/tonight/NightStrip.astro`

**Intent**: The group labels use the overline. The right-hand lines become muted facts. The rows use the group role. The structure stays two `h3` + `ol` groups.

**Contract**:
- Both group labels are `text-overline text-muted-foreground`. The outlook label keeps its dashed rule, now `mt-line border-t-2 border-dashed pt-group`.
- Rows are `py-group`, and the cells' `gap-2` becomes `gap-line`.
- Verdict rows:
  - the headline line (`[data-sky-headline]` with its dot) is unchanged;
  - `Fact kind="cloud" tone="muted"` holds `reasonText` (`first-letter:uppercase` kept);
  - `Fact kind="moon" tone="muted"` holds `moonText`.
- Outlook rows: `Fact kind="cloud" tone="muted"` holds `cloudText` (the "Cloud ~NN%" string intact), and `Fact kind="moon"` holds `moonText`.
- No list elements inside a row. The `mb-4` under "Times in" becomes `mb-group`.

#### 3. Page wrappers

**Files**: `src/components/tonight/EventsPageContent.astro`, `NightsPageContent.astro`

**Intent**: Only the spacing that frames these lists moves to roles. The `max-w-3xl … pt-8 space-y-6` page wrapper is shared by every focused page and stays.

**Contract**: the "Times in" lines' `mb-4` → `mb-group`. Nothing else.

#### 4. `/design`

**File**: `src/pages/design.astro`

**Intent**: Nights gets a specimen; it has none today.

**Contract**:
- A `c-night-strip` section renders `NightStrip` from fixed sample nights: two verdict nights (one go with a reason, one no-darkness night without a reason) and two outlook nights (one with a cloud range).
- States: default shown; empty is N/A, because the page renders its own "no nights" notice, not the strip; the other states are N/A (not interactive).
- The SkyEventList specimens pick up the new rows on their own.

### Success Criteria:

#### Automated Verification:

- One batched run passes: `npx astro check && npm run lint && npx vitest related src/components/tonight/SkyEventList.astro src/components/tonight/NightStrip.astro src/pages/design.astro --run`
- `npm test` and `npm run build` pass
- The affected specs pass against a fresh local preview: `npx playwright test sky-events seven-night-planner tonight-phone offline red-night-mode`

#### Manual Verification:

- `/tonight/events` and `/tonight/nights` at 390 px and 1280 px, EN and PL, dark, light and red, against `evidence/before/`:
  - the night headings and group labels read as quiet labels, not blue lines;
  - each event's facts read one per line under its header;
  - the solar safety line keeps its amber icon;
  - Nights' reason and moon lines carry their icons and stay muted;
  - no sideways scroll at 320 px

---

## Phase 5: The guard, the rules, the screenshot gate and the whole suite

**Delegation**:
- Guard test: Sonnet subagent, high effort (non-UI code).
- CLAUDE.md and comments: Sonnet subagent, medium effort.
- The before/after matrix capture: Sonnet subagent, medium effort.
- Screenshot judgement, the whole e2e suite and smoke: the main session.

### Overview

Make the contract stick (/10x-ui "Make it stick"), record the evidence and run everything the way CI does.

### Changes Required:

#### 1. Rhythm guard

**File**: `src/styles/rhythm-roles.test.ts` (new)

**Intent**: A failing check beats a rule. The view family may not reintroduce numeric vertical spacing steps.

**Contract**:
- It reads the source of these files and fails on any `(m|p)(t|b|y)-<number>`, `space-y-<number>` or `gap(-y)?-<number>` class not on that file's allowlist:
  - `TargetDetails`, `ObjectDetails`, `ObjectCard`, `ObjectRow`, `PlanetCard`, `MoonCard`, `SkyEventList`, `NightStrip`;
  - `ui/Fact`, `ui/FactList`, `ui/StatCard`, `ui/StatPair`.
- The allowlist holds:
  - `ObjectRow`'s 44 px summary `py-4`;
  - the icon alignment `mt-0.5` inside `ui/Fact`;
  - the stat card's inner `py-2`/`mt-0.5`;
  - horizontal and `gap-3` grid gaps where they are not vertical rhythm.
- Comments are blanked first, as `no-hardcoded-colors.test.ts` does.
- Break check: add `mt-4` to `PlanetCard` and see the test fail, then revert.

#### 2. Rules and comments

**Files**: `CLAUDE.md` (the UI section; `AGENTS.md` is a symlink), the header comments of `TargetDetails`, `ObjectDetails`, `PlanetCard`, `MoonCard`, `SkyEventList` and `NightStrip`

**Intent**: The next agent finds the roles and components and keeps using them.

**Contract**:
- **Tokens bullet**: adds `text-overline` (section labels, muted, sentence case) and the rhythm roles `line`/`group`/`item` (`gap-line`, `mt-group`, `py-item`; items holding groups are `py-item`, one-group rows `py-group`), with the guard test named.
- **Components bullet**: adds `Fact`/`FactList` (every fact line on a Tonight item; an icon from `src/lib/ui/fact-icons.ts`, content in its own element, no list elements) and `StatCard`/`StatPair` (Window and Best only).
- **Nightfall composition**: the stat cards are the second deliberate boxed exception after the gear cards.
- The S-07 paragraph's icon sentence points at the map.

#### 3. Evidence

**Files**: `context/changes/ui-fact-rhythm/evidence/{after/,crops/,design/,README.md}`

**Intent**: The screenshot gate. It is the same matrix as `evidence/before/` plus `/design`'s new sections, curated and downscaled, with a README in the style of ui-quiet-actions'.

**Contract**:
- `scripts/capture.mjs` over targets, planets, moon, nights and events, × EN/PL × dark/light/red × 390/1280.
- `scripts/design-sections.mjs` for `c-stat-pair`, `c-fact`, `c-fact-icons` and `c-night-strip`.
- Crops of one target, one planet and one event row in light and red, before and after.

### Success Criteria:

#### Automated Verification:

- `npx astro check`, `npm run lint` and `npm test` pass; `rhythm-roles.test.ts` goes red on the deliberate break and green after reverting it
- `npm run build` succeeds
- The whole e2e suite and smoke pass against a fresh local preview, the way CI runs them (lessons.md): `npm run test:e2e` and `npm run smoke`, with the local stack's URL and keys inline; the counts are recorded for the PR

#### Manual Verification:

- The owner looks at the before/after crops (target, planet, event row; light and red) and the `/design` sections, and accepts the rhythm, the stat cards and the icons, or names what to change

---

## Testing Strategy

### Unit Tests:

- `rhythm-roles.test.ts`: the guard, with its break check.
- `build.test.ts`: the planet fact wording (Phase 2).
- The existing guards on every phase: `no-hardcoded-colors`, `red-theme`, `contrast`, `i18n` parity, `runner-zone-guard`, `no-console-guard`.

### Integration Tests:

- **Locators that must survive** (no edits expected):
  - `what-to-expect` (exact phrase in `[data-expect]`);
  - `sky-events` (first `h4`, exact visibility sentence, one mark per row, safety on solar rows only);
  - `seven-night-planner` (`h3` + sibling `ol`, `ol > li` = 7, exact headline, "Cloud ~NN%");
  - `planets-on-tonight` (listitem cards);
  - `tonight-targets`, `tonight-sky` (row ids), `onboarding` (`/25 mm/` in one element), `telescope-selector` (the "Find with" label stays in the DOM), `finder-chart` (`finderLink` by `aria-label`).
- **New**: the planet label and Polish spacing assertions in `planets-on-tonight.spec.ts`.
- **`tonight-phone.spec.ts`**: no sideways scroll at 320/375 px on every Tonight page in EN and PL. This is the stat pair's main risk.

### Manual Testing Steps:

1. `/design` in three themes at 390 and 1280 px (Phase 1).
2. Targets, Planets and the Moon in the full matrix against `evidence/before/` (Phase 3).
3. Events and Nights in the full matrix (Phase 4).
4. The owner's look at the before/after crops (Phase 5).

## Performance Considerations

None material. The new components render static markup on the server, and the icons are the same lucide SVGs inlined per use. The Targets page at 390 px grows about 13% in height (experiment: 5196 to 5886 px at 2×), which is the breathing room the owner asked for. The Targets list is still capped by the scroll region for the other objects (`max-h-128`).

## Migration Notes

There is no data migration. The planet fact wording changes for stored offline copies only when a page is next refreshed online. Old copies keep the old wording until they expire, which is harmless.

## References

- Research and charges: `context/changes/ui-fact-rhythm/research.md`.
- The audit and the owner's decisions: `context/changes/ui-refine/audit.md:46-84,106-119,227-265`.
- The experiment: `context/changes/ui-fact-rhythm/evidence/exp-stat-cards/` (`experiment.diff`, crops), before shots in `evidence/before/`.
- The previous change of the split: `context/changes/ui-quiet-actions/plan.md` (action row, red-mode rules, evidence scripts).
- Lessons: `context/foundation/lessons.md` (the whole e2e suite before a PR; fix flakes failing-first).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The contract: roles, overline, icon map, Fact and StatCard, specimens

#### Automated

- [ ] 1.1 Types, lint and the related tests pass in one run
- [ ] 1.2 The whole unit suite passes: `npm test`
- [ ] 1.3 `npm run build` succeeds and the built CSS has the role utilities
- [ ] 1.4 `sky-events.spec.ts` passes against a fresh local preview

#### Manual

- [ ] 1.5 `/design` at 390 px and 1280 px in dark, light and red: three distinct roles, pair fits 320 px and is capped on desktop, Polish spacing kept, icons distinct

### Phase 2: Planet fact labels and value wording

#### Automated

- [ ] 2.1 One batched run passes (types, lint, related tests)
- [ ] 2.2 The whole unit suite passes: `npm test`

### Phase 3: Targets, Planets, the Moon and the finder's expect line

#### Automated

- [ ] 3.1 One batched run passes (types, lint, related tests)
- [ ] 3.2 `npm test` and `npm run build` pass
- [ ] 3.3 The affected specs pass against a fresh local preview
- [ ] 3.4 Hardcoded-value scan clean and only the kept numeric vertical spacing remains

#### Manual

- [ ] 3.5 Targets, Planets and the Moon in the 390/1280 × EN/PL × three-theme matrix judged against `evidence/before/`

### Phase 4: Sky events and the Nights page

#### Automated

- [ ] 4.1 One batched run passes (types, lint, related tests)
- [ ] 4.2 `npm test` and `npm run build` pass
- [ ] 4.3 The affected specs pass against a fresh local preview

#### Manual

- [ ] 4.4 `/tonight/events` and `/tonight/nights` in the matrix: quiet labels, one fact per line, safety icon kept, no sideways scroll

### Phase 5: The guard, the rules, the screenshot gate and the whole suite

#### Automated

- [ ] 5.1 `npx astro check`, `npm run lint` and `npm test` pass; the guard goes red on the deliberate break
- [ ] 5.2 `npm run build` succeeds
- [ ] 5.3 The whole e2e suite and smoke pass against a fresh local preview, counts recorded

#### Manual

- [ ] 5.4 The owner accepts the before/after crops and the `/design` sections
