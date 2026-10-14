# Quieter per-item actions (ui-quiet-actions) Implementation Plan

## Overview

Make Sidereus's per-item actions stop outshouting the data, through a button hierarchy. This is the owner's decision 1 on the ui-refine audit, direction 3C (`context/changes/ui-refine/audit.md`, "Owner decisions").

- "Mark observed" stays the one per-item button, as a neutral **hairline**.
- Every other standalone or per-item link becomes a **quiet** text action with its icon: Finder chart, Manage, the washed-out link, the back link, Pager, the /log header links, "See your progress", "Back to sign in".
- The dashboard tile's arrow loses its chip.
- Eyepiece names leave the link colour.

This is the first change of the ui-refine split. It touches global tokens and shared components, so the later changes inherit it.

## Current State Analysis

From `research.md`, which holds the full anchors.

**The `action` variant**
- Defined at `src/components/ui/button.tsx:39-40`: a border in `--action-border`, an `--action-surface` fill, link-coloured text, `whitespace-normal`, and a hover that moves the border to the link colour plus an underline.
- It has 12 call sites in 10 files: `TargetDetails.astro:40-41`, `BackLink.astro:20`, `Pager.astro:24`, `GearCard.astro:73`, `MoonCard.astro:33`, `pages/log/index.astro:71,75`, `pages/log/progress.astro:77`, `pages/gear/index.astro:97`, `MilestoneCelebration.astro:37`, `pages/auth/confirm-email.astro:23`.
- The CLAUDE.md "Clickables" rule (`CLAUDE.md:99`; `AGENTS.md` is a symlink to it) mandates `action` for every standalone clickable.

**Tokens**
- The action tokens are plain hex in dark, light, the light `.night-sky` scope and red (`global.css:41-42,96-97,150-151,194-195`). `contrast.test.ts:124-130` pins them.
- `SkyAnswerForm` (`RESTING_BORDER_CLASS`, `border-2 bg-action-surface`) and the milestone medallion (`MilestoneCelebration.astro:74`) also use them.

**Tile cue and eyepiece names**
- The tile cue is a bordered, filled chip (`ui/tile.ts:25-26`).
- Eyepiece names are `font-semibold text-primary-strong` on plain text (`ObjectDetails.astro:50,55`, `PlanetCard.astro:56`, `MoonCard.astro:88,98`, `design.astro:709`).

**Tests**
- No e2e spec asserts these looks; specs locate by role and name.
- The unit guards that matter are `contrast.test.ts`, `red-theme.test.ts` (a red value with zero green and blue for every `:root` token) and `no-hardcoded-colors.test.ts`.

**Constraints from earlier changes**
- Red mode tells controls apart by shape, never hue.
- Touch targets stay 44 px.
- Long Polish labels wrap.
- The offline dashed cue needs a border width (`global.css:543-562`).
- The neutral `--border` is only 1.17-1.78:1 against the ground (research §4), so it cannot be the hairline.

**S-07**
- S-07 sky-events (unmerged, `feat/sky-events`) adds no `action` call site.
- Its events tile gets the cue through `Tile`.

## Desired End State

**Targets and Planets**
- Each object ends with one quiet-looking hairline "Mark observed" (a neutral border at ≥3:1, no fill, foreground label, link-coloured check icon) and a text-only "Finder chart" (link colour, crosshair icon, no box).
- The eyepiece names read as bold heading ink, not as links.
- The Moon card's washed-out link is a text action.

**Shell links**
- Back links on every sub-page are a text chevron plus label.
- The /log header's Progress and Sky checks, the Pager, "See your progress" and "Back to sign in" are text actions.
- /gear's "Add …" links are hairlines when the band already has items (primary and empty-band weights unchanged).
- The dashboard's tiles end in a bare muted arrow.

**Red mode**
- Text actions carry a resting underline, so they are told apart from body text by shape.
- The hairline's border is a red at ≥3:1.

**Offline**
- "Mark observed" turns muted and dashed as today.
- A quiet action (Manage) turns muted ink without an underline.

**Contract, rules and evidence**
- `buttonVariants` no longer has `action`. `quiet` and `hairline` replace it.
- The CLAUDE.md Clickables rule describes the hierarchy.
- `/design` shows both variants in every state.
- A before/after screenshot matrix shows the change.

**Verify**
- `npx astro check`, `npm run lint`, `npm test`, the whole `npm run test:e2e` and `npm run smoke` against a local preview pass.
- The screenshot matrix (EN/PL × dark/light/red × 390 px/desktop) of Targets, Planets, the Moon, Tonight, /log, /log/progress, /gear and `/design` is reviewed by the owner.

### Key Discoveries:

- `buttonVariants` is called directly on `<a>` elements, without a `cn` merge inside cva. A variant's `px-0` and the `sm` size's `px-3` would both apply, and CSS order would decide (research, Architecture Insights). A text action therefore needs its own size, not a padding override in the variant.
- `contrast.test.ts` reads plain hex only (`:1-12`), and `red-theme.test.ts:62-65` needs a red value for every new `:root` token. A new token must be plain hex in every block that defines it.
- The existing custom variants are `dark`, `offline` and `night` (`global.css:8-14`). A `red` variant is new.
- `tonight-dashboard.spec.ts:62` finds the back link as a `main` link named exactly `en.nav.tonight`. The label and role must not change.
- `GEAR_CARD_MIN_HEIGHT_CLASS` (`sky-band.ts:30`, `min-h-34 sm:min-h-37`) is the measured single-item card. The Manage link is inside it, so its height must stay 44 px (`min-h-11`).
- The link colour as text directly on the sky stops (zenith, horizon) is pinned at 4.5 only for the night scope (`contrast.test.ts:119`). Dark, light and red have only the 3:1 indicator row (`:107`).
  - Computed values: dark 13.04 / 9.14, light 4.90 / 7.70, red 5.20 / 5.07 (zenith / horizon).
  - So a text back link on the sky passes, but needs a 4.5 pin.

## What We're NOT Doing

- **Navigation.** The Tonight sub-nav replacing the back link on the focused pages, and Progress as a fourth destination, are change 4 (`ui-tonight-nav`). Here the back link only gets quieter, and Progress stays in the /log header as a text action.
- **Facts, spacing, icons and stat cards.** Those are change 2 (`ui-fact-rhythm`). Here eyepiece names only leave the link colour.
- **Other weights.** The `default`, `outline`, `ghost`, `link` and `destructive` variants are unchanged. That covers "Now", "Show the other … objects", the empty-band /gear add, Add entry and the setup prompts.
- **Sky checks and the medallion.** The sky-check answers (`SkyAnswerForm`, `RESTING_BORDER_CLASS`, the suggested `border-2` plus action fill) and the milestone medallion are unchanged. They keep `--action-surface` / `--action-border`, so those tokens and their contrast rows stay.
- **Row links.** Whole-row links (log rows, gear rows, Session plan rows, the Targets `<summary>`) and their chevrons are unchanged.
- **S-07's components.** No change beyond what `Tile` gives the events tile.

## Implementation Approach

Contract first, then the call sites, then the guard. This follows /10x-ui's order: tokens → shared component → views → states.

- **Phase 1** adds the new token, the `red` variant, the `quiet` and `hairline` variants (plus a `bare` size) and their contrast pins and `/design` specimens, beside `action`, so the build stays green.
- **Phase 2** moves every call site, removes `action` (TypeScript then fails on any leftover call), bares the tile cue and recolours the eyepiece names.
- **Phase 3** rewrites the rules, captures the screenshot gate and runs the whole suite the way CI does.

Implementation starts only after S-07 sky-events has merged to main: this branch rebases onto it first, so the six-tile dashboard and `/tonight/events` are in the evidence.

**Decisions taken without an interview.** This planning run is a herdr agent and may not use interactive questions; owner questions go through the orchestrator.

- The UI choices from the audit are the owner's (3C).
- Two UI details the owner did not decide take recommended defaults. They are relayed as an owner question with this plan, and Phase 1 adapts to the answer:
  - **D1**, the hairline colour: a new neutral `--control-border` at ≥3:1.
  - **D2**, red-mode text actions: a resting underline in red only.
- The technical choices are this plan's: the variant names and the `bare` size, keeping the action tokens, the hairline for the /gear Add links.

## Critical Implementation Details

- **Padding.** Give the quiet action its own size (`bare`: no horizontal padding, `gap-1.5`, 44 px tall from the base), and use it only with `variant: "quiet"`. Do not put `px-0` in the variant. The hairline keeps `size: "sm"`.
- **Offline.** The rule at `global.css:550-562` already resets colour, background and `text-decoration-line` and dashes any border on `[data-needs-network]`.
  - A hairline with `data-needs-network` gets the dash.
  - A quiet action gets muted ink without its red-mode underline.
  - Do not add per-variant offline styles. Update the comment and `/design`'s hand copy `offlineAction` (`design.astro:195-196`).
- **Red underline.** The `red` custom variant must match the same scope as `[data-theme="red"]` on `<html>`: `&:where([data-theme="red"] *)`.
  - Don't key it on `.night-sky` or the `dark` variant.
  - Popovers that carry their own `data-theme` (CLAUDE.md, Tonight's sky) keep working with that selector.

## Phase 1: The contract — token, variants, pins and specimens

### Overview

Add everything the hierarchy needs beside the existing `action`, prove it in the contrast test and `/design`, and change no view yet.

### Changes Required:

#### 1. Rebase and install

**Files**: the branch

**Intent**: Start from main with S-07 merged, so the change and its evidence include the events tile and page.

**Contract**:
- Rebase onto `origin/main` after S-07's merge, then `npm ci` (nvm prefix).
- Check that `git diff origin/main -- src` shows nothing.
- If S-07 has not merged yet, stop and report. Do not implement on top of the unmerged branch.

#### 2. The hairline token and the `red` variant

**File**: `src/styles/global.css`

**Intent**: A neutral border that is a real ≥3:1 indicator in every theme, and a way to style red mode by shape.

**Contract**:
- New `--control-border`, plain hex, in the dark `:root`, light and red blocks (not `.night-sky`: no hairline sits on the night sky).
  - Published as `--color-control-border` in `@theme inline` beside the action tokens.
  - Values: ≥3:1 against `--background` and `--surface` of its theme. Starting points from research §4 are dark `#646e8a`, light `#808a9e`; red must be pure red (zero green and blue), around `#c80000`, and must be measured.
- New `@custom-variant red (&:where([data-theme="red"] *));` next to `offline` and `night`, with a comment naming its one use (the quiet action's resting underline).
- If the owner answers D1 or D2 differently, this item adapts:
  - Reusing `--action-border` drops the new token.
  - "Underline everywhere" makes the underline unconditional and drops the variant.
  - Accepting the faint hairline uses `--border` with no pin.

#### 3. The `quiet` and `hairline` variants and the `bare` size

**File**: `src/components/ui/button.tsx`

**Intent**: Two quieter tiers beside `default`, for a per-item button and for text actions.

**Contract**:
- `hairline`: `border border-control-border bg-transparent`, label in `text-foreground`, icons in `text-primary-strong`, `py-2 text-left whitespace-normal`.
  - Hover: border to `primary-strong` plus `bg-accent`.
  - Disabled: `border-border` and muted text.
  - Used with `size: "sm"`.
- `quiet`: no border, no fill, `text-primary-strong`, `py-2 text-left whitespace-normal underline-offset-4`, `hover:underline`, `red:underline` at rest (with `red:hover:decoration-2`).
  - Disabled: muted text.
  - Used with the new `size: "bare"` (no horizontal padding).
- `action` stays for now; Phase 2 removes it.
- Update the header comment (`:8-15`) to describe the hierarchy: one filled primary per screen, a hairline per item, quiet text for the rest, `link` inside sentences.

#### 4. Contrast pins

**File**: `src/styles/contrast.test.ts`

**Intent**: Pin the new indicator, and the link colour as text where quiet actions now sit without a fill.

**Contract**:
- New row: `control-border` on `background` and `surface` ≥3, themes dark, light and red.
- New row: `primary-strong` on `zenith` and `horizon` ≥4.5, themes dark, light and red (back links and the /log header links sit on the sky; the night scope is already pinned).
- Keep the action rows (`:124-130`), and reword their comment to name the sky-check answers and the medallion.

#### 5. `/design` specimens

**File**: `src/pages/design.astro`

**Intent**: The kitchen sink shows both new variants in the 7-state matrix before any view uses them.

**Contract**:
- `quiet` and `hairline` rows in the variants table (`:187-193`), with hover specimens mirroring the real hover classes.
- Focus and disabled through the generic loops.
- An offline specimen for each (`offlineAction` reworded to match the rule).
- A long Polish label wrap specimen for each, inside `max-w-xs`.
- A swatch for `control-border`.
- Empty, error and loading are N/A for a button: write the reason beside the table, as the existing variants do.

### Success Criteria:

#### Automated Verification:

- Types and lint pass: `npx astro check` and `npm run lint`
- Unit tests pass, including the new contrast rows and `red-theme.test.ts` with the new token: `npm test`
- `src/styles/no-hardcoded-colors.test.ts` passes (the new hex lives only in `global.css`)
- `npm run build` succeeds

#### Manual Verification:

- `/design` in dark, light and red at 390 px and desktop:
  - `hairline` reads as a button but quieter than today's `action`;
  - `quiet` reads as a link with its icon;
  - in red, quiet is underlined at rest and the hairline's border is visible;
  - the Polish wrap specimens stay inside the column.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Move every call site and remove `action`

### Overview

Apply the hierarchy to every view, bare the tile cue, take the link colour off eyepiece names, then delete `action`, so nothing can return to it.

### Changes Required:

#### 1. Per-item actions on Tonight

**Files**: `src/components/tonight/TargetDetails.astro`, `MoonCard.astro`, `GearCard.astro`

**Intent**: One hairline per item, and text for everything else.

**Contract**:
- "Mark observed" becomes `hairline` / `sm`, keeping `data-needs-network`, the Check icon, `aria-label` and `srSuffix`.
- "Finder chart" becomes `quiet` / `bare`, keeping its label and Crosshair.
- The gap between them becomes `gap-x-5 gap-y-2` so the pair still wraps on a phone.
- MoonCard's washed-out link becomes `quiet` / `bare`.
- GearCard's Manage link becomes `quiet` / `bare`, keeping `data-needs-network` and the Settings2 icon. The card's measured height must not change (44 px link).

#### 2. Shared links

**Files**: `src/components/ui/BackLink.astro`, `src/components/ui/Pager.astro`

**Intent**: The way back and the pager stop being boxes.

**Contract**:
- Both become `quiet` / `bare`. BackLink keeps its label, `ChevronLeft`, `mb-2 sm:mb-3` and the `class` merge.
- `/design`'s BackLink and Pager hover specimens (`:1009`, `:1063`) show the real hover (underline), not `bg-accent`.

#### 3. Page-level links

**Files**: `src/pages/log/index.astro`, `src/pages/log/progress.astro`, `src/pages/gear/index.astro`, `src/pages/auth/confirm-email.astro`, `src/components/progress/MilestoneCelebration.astro`

**Intent**: The rest of the `action` users take their 3C tier.

**Contract**:
- /log's Progress and Sky checks become `quiet` / `bare` (Add entry keeps its weight).
- `/log/progress`'s empty-state link to Tonight, "Back to sign in" and "See your progress" (beside the filled Continue) become `quiet` / `bare`.
- `/gear`'s `addClass` third branch (a band that already has items) becomes `hairline` / `sm`; the `default` and `outline` branches are unchanged.

#### 4. Tile cue and eyepiece names

**Files**: `src/components/ui/tile.ts`, `src/components/tonight/ObjectDetails.astro`, `PlanetCard.astro`, `MoonCard.astro`, `src/pages/design.astro`

**Intent**: The dashboard's arrows and the eyepiece names stop competing with links.

**Contract**:
- `TILE_CUE_CLASS` becomes a bare `text-muted-foreground` arrow in the same `size-6` box (no border, no fill), so the heading row's height is unchanged. Update the comment at `:22-24`.
- The eyepiece-name spans become `font-semibold text-heading` (`ObjectDetails.astro:50,55`, `PlanetCard.astro:56`, `MoonCard.astro:88,98`, the `/design` specimen `:709`).

#### 5. Remove `action`

**Files**: `src/components/ui/button.tsx`, `src/pages/design.astro`

**Intent**: Every call site was migrated on purpose, and no new one can appear.

**Contract**:
- Delete the `action` entry from `buttonVariants` and from `/design`'s variants table and specimens (`:187-193`, `:866-887`, `:1715`, `:1745`).
- `grep -rn 'variant: "action"' src` returns nothing.
- `RESTING_BORDER_CLASS` and the action tokens stay (sky-check answers, medallion).

### Success Criteria:

#### Automated Verification:

- Types and lint pass (TypeScript rejects any leftover `variant: "action"`): `npx astro check` and `npm run lint`
- No `action` variant left: `grep -rn 'variant: "action"' src` prints nothing
- Unit tests pass: `npm test`
- The phone first screen and the sideways-scroll checks pass: `npx playwright test tonight-phone` against a local preview (preview port 4331, forecast fixture 4401)
- The specs that click these links pass: `npx playwright test tonight-targets planets-on-tonight moon-as-target observation-log observing-progress observing-milestones telescope-selector sky-checks tonight-dashboard finder-chart` (full-plan steps with the local stack's keys inline only)

#### Manual Verification:

- Targets, Planets and the Moon at 390 px in EN and PL, in dark, light and red: each item shows one hairline "Mark observed" and a text "Finder chart"; eyepiece names are bold but not link-coloured; the Polish pair wraps without sideways scroll.
- Offline (a stored Tonight page with the server stopped): "Mark observed" is muted and dashed; Manage is muted with no underline in red.
- The dashboard's tiles end in a bare arrow; the gear cards' height is unchanged.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Rules, screenshot gate and the whole suite

### Overview

Leave the rule the next agent reads, capture the evidence the owner judges, and run everything the way CI does before a PR.

### Changes Required:

#### 1. The rules

**Files**: `CLAUDE.md` (`AGENTS.md` follows, it is a symlink), code comments

**Intent**: The Clickables rule now describes the hierarchy, so no agent re-creates the box.

**Contract**:
- Rewrite the "Clickables" bullet (`CLAUDE.md:99`):
  - at most one `default` per screen;
  - `hairline` / `sm` for the one per-item button (Mark observed) and for /gear's Add when the band has items;
  - `quiet` / `bare` for every other standalone or per-item link (with its lucide icon, `aria-hidden`; wraps; underline on hover, underlined at rest in red through the `red:` variant);
  - `link` inside sentences;
  - link-colour text only on links;
  - the tile cue is a bare arrow;
  - offline: a hairline dashes, a quiet action mutes.
- Keep the sky-check sentence (`RESTING_BORDER_CLASS`, the suggested `border-2` plus action fill) and say the action tokens now serve only those answers and the medallion.
- In the "Gear cards" bullet, Manage is a `quiet` link.
- Code comments: `global.css:543-549` (offline: hairline and quiet), `contrast.test.ts` rows, `BackLink.astro`, `Pager.astro`, `tile.ts`.

#### 2. The screenshot gate

**Files**: `context/changes/ui-quiet-actions/evidence/`

**Intent**: The owner judges the result on the same matrix as the audit.

**Contract**:
- Run `context/changes/ui-refine/evidence/seed.mjs` and `capture.mjs`, or copies, against a preview of this branch: a fresh local user and the full plan granted with the key inline only.
- Capture Tonight, Targets, Planets, the Moon, /log, /log/progress, /gear and `/design` (dev server).
- Commit a curated, downscaled set beside `ui-refine/evidence/before/` for comparison, including the red-mode crops of a target row and the `/tonight/events` page from S-07.

#### 3. Whole suite before the PR

**Intent**: Lessons "Run the whole e2e suite before a PR" and "A red `ci` on main blocks the deploy".

**Contract**:
- A fresh `npm run build`, the forecast fixture, the preview's `dist/server/.dev.vars` on the local stack.
- The whole `npm run test:e2e` and `npm run smoke` with the local keys inline.
- Report the counts in the PR.

### Success Criteria:

#### Automated Verification:

- The whole unit suite, types and lint pass: `npm test`, `npx astro check`, `npm run lint`
- The whole e2e suite passes against a fresh local preview: `npm run test:e2e`
- Smoke passes against the same preview: `npm run smoke` (local keys inline)
- CLAUDE.md names `quiet`, `hairline` and the `red:` variant, and no longer prescribes `action`: `grep -n 'variant: "action"' CLAUDE.md` prints nothing

#### Manual Verification:

- The owner reviews the screenshot matrix (EN/PL × dark/light/red × 390 px/desktop) against the audit's before shots and accepts the button weight.
- Red mode at arm's length on a phone: "Mark observed" and the text actions are findable without hue.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `contrast.test.ts`:
  - the new `control-border` rows (≥3 on background and surface in dark, light and red);
  - `primary-strong` on the sky stops ≥4.5 in dark, light and red;
  - the action rows, kept.
- `red-theme.test.ts`: covers the new token's red value without edits (it reads every `:root` token).
- `no-hardcoded-colors.test.ts`: unchanged, and must stay green.

### Integration Tests:

- No new e2e spec. The existing specs locate every affected control by role and name (research §6), and they must pass unchanged.
- Any locator edit is a sign that a label, role or name changed by mistake.
- `tonight-phone.spec.ts` guards the gear cards' height and Polish wrapping.

### Manual Testing Steps:

1. `/design` in each theme: the 7-state matrix for `quiet` and `hairline`.
2. Targets and Planets at 390 px, PL, red: wrapping, the underline, the hairline border.
3. A stored Tonight page offline: dashed "Mark observed", muted Manage.
4. The screenshot matrix against `ui-refine/evidence/before/`.

## Performance Considerations

None. These are class changes only.

## Migration Notes

There is no data or migration. Rollback is a revert of this change's commits. The action tokens are not removed, so a revert restores the old look exactly.

## References

- Research: `context/changes/ui-quiet-actions/research.md`
- Audit and owner decisions: `context/changes/ui-refine/audit.md`, `context/changes/ui-refine/change.md`
- Experiments: `context/changes/ui-refine/evidence/exp-a/experiment-a.diff` (text actions), `exp-b/experiment-b.diff` (hairline)
- Origin of `action`: `context/archive/2026-10-08-ui-user-adjustments/` (plan, plan-brief, reviews)
- Lessons: `context/foundation/lessons.md` ("Run the whole e2e suite before a PR", "A red `ci` on main blocks the deploy")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The contract — token, variants, pins and specimens

#### Automated

- [ ] 1.1 Types and lint pass: `npx astro check` and `npm run lint`
- [ ] 1.2 Unit tests pass, including the new contrast rows and `red-theme.test.ts` with the new token: `npm test`
- [ ] 1.3 `src/styles/no-hardcoded-colors.test.ts` passes (the new hex lives only in `global.css`)
- [ ] 1.4 `npm run build` succeeds

#### Manual

- [ ] 1.5 `/design` in dark, light and red at 390 px and desktop: hairline quieter than `action`, quiet reads as a link, red underline and border visible, Polish wraps

### Phase 2: Move every call site and remove `action`

#### Automated

- [ ] 2.1 Types and lint pass (TypeScript rejects any leftover `variant: "action"`): `npx astro check` and `npm run lint`
- [ ] 2.2 No `action` variant left: `grep -rn 'variant: "action"' src` prints nothing
- [ ] 2.3 Unit tests pass: `npm test`
- [ ] 2.4 The phone first screen and the sideways-scroll checks pass: `npx playwright test tonight-phone`
- [ ] 2.5 The specs that click these links pass

#### Manual

- [ ] 2.6 Targets, Planets and the Moon at 390 px in EN and PL, dark, light and red: one hairline Mark observed, text Finder chart, eyepiece names not link-coloured, Polish wraps
- [ ] 2.7 Offline: Mark observed muted and dashed; Manage muted with no underline in red
- [ ] 2.8 The dashboard's tiles end in a bare arrow; the gear cards' height is unchanged

### Phase 3: Rules, screenshot gate and the whole suite

#### Automated

- [ ] 3.1 The whole unit suite, types and lint pass
- [ ] 3.2 The whole e2e suite passes against a fresh local preview: `npm run test:e2e`
- [ ] 3.3 Smoke passes against the same preview: `npm run smoke`
- [ ] 3.4 CLAUDE.md names `quiet`, `hairline` and the `red:` variant, and no longer prescribes `action`

#### Manual

- [ ] 3.5 The owner reviews the screenshot matrix against the audit's before shots and accepts the button weight
- [ ] 3.6 Red mode at arm's length on a phone: Mark observed and the text actions are findable without hue
