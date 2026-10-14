# Quieter per-item actions (ui-quiet-actions) Implementation Plan

## Overview

Make Sidereus's per-item actions stop outshouting the data through a button hierarchy. This is the owner's decision 1 on the ui-refine audit, direction 3C (`context/changes/ui-refine/audit.md`, "Owner decisions").

- "Mark observed" stays the one per-item button, as a neutral **hairline**.
- Every other standalone or per-item link becomes a **quiet** text action with its icon: Finder chart, Manage, the washed-out link, the back link, Pager, the /log header links, "See your progress", "Back to sign in".
- The dashboard tile's arrow loses its chip.
- Eyepiece names leave the link colour.
- The data credit links get a visible underline in red.

This is the first change of the ui-refine split. It is global (tokens and shared components), so the later view changes inherit it.

Plan review (`reviews/plan-review.md`, F1-F10) is applied, with the owner's answers on F1 and F4. Anchors are re-taken on main 1389bc1, with S-07 sky-events merged.

## Current State Analysis

From `research.md`, re-anchored after the rebase onto main 1389bc1.

**The `action` variant**
- Defined at `src/components/ui/button.tsx:39-40`: a border in `--action-border`, an `--action-surface` fill, link-coloured text, `whitespace-normal`, and a hover that moves the border to the link colour plus an underline.
- 12 product call sites in 10 files: `TargetDetails.astro:40-41`, `BackLink.astro:20`, `Pager.astro:24`, `GearCard.astro:73`, `MoonCard.astro:33`, `pages/log/index.astro:71,75`, `pages/log/progress.astro:77`, `pages/gear/index.astro:97` (used at `:132,167,199`), `MilestoneCelebration.astro:37`, `pages/auth/confirm-email.astro:23`.
- `/design` uses it at `design.astro:190` (variants table), `:194` (`sizeOf`), `:880`, `:890` and the GearCard Manage specimens at `:1787` and `:1817`.
- The CLAUDE.md "Clickables" bullet (`CLAUDE.md:101`; `AGENTS.md` is a symlink) mandates it. The Finder paragraph (`:17`) and the Gear cards bullet (`:103`) call their links `action` links.

**Tokens**
- The action tokens are plain hex in dark, light, the light `.night-sky` scope and red (`global.css:41-42,96-97,150-151,194-195`, `@theme` `:662-663`).
- `contrast.test.ts:124-130` pins them.
- `SkyAnswerForm` and the milestone medallion (`MilestoneCelebration.astro:74`) also use them.

**Tile cue, eyepiece names and credit links**
- The tile cue is a bordered, filled chip (`ui/tile.ts:22-26`). Every `Tile` gets it, including S-07's `EventsTile`, the dashboard's second tile.
- Eyepiece names are `font-semibold text-primary-strong` on plain text (`ObjectDetails.astro:50,55`, `PlanetCard.astro:56`, `MoonCard.astro:88,98`, `design.astro:717`).
- The data credit links (`Attribution.astro:10-12`, six links including S-07's NASA and IAU MDC, and the identical class in `pages/onboarding.astro:28-29`) are underlined in `decoration-border`. That underline is about 1.17:1 in red, so there they read as muted text.

**Offline**
- `global.css:543-562` mutes `[data-needs-network]` controls and dashes their border in `var(--border)`.
- It sets `color` on the element and on descendant `a`, `button` and `select`. An icon painted by its own utility class keeps its colour.

**Tests**
- No e2e spec asserts these looks; specs locate by role and name.
- The unit guards are `contrast.test.ts`, `red-theme.test.ts` (a red value with zero green and blue for every `:root` token) and `no-hardcoded-colors.test.ts`.

**Constraints from earlier changes**
- Red mode separates by shape, never hue.
- Targets stay 44 px.
- Long Polish labels wrap.
- The dash needs a border width.
- The neutral `--border` is about 1.14-1.57:1 against the ground (plan review F9), so it cannot be the hairline.

## Desired End State

**Targets and Planets**
- Each object ends with one hairline "Mark observed": a neutral grey border at ≥3:1, no fill, a foreground label, a link-coloured Check icon.
- Beside it is a text "Finder chart" (link colour, Crosshair, no box).
- The eyepiece names read as bold heading ink.
- The Moon's washed-out link is a text action.

**Shell links**
- Back links on every sub-page are a chevron plus label in text. This includes `/tonight/events` and the finder's back to its origin.
- So are /log's Progress and Sky checks, the Pager, "See your progress" and "Back to sign in".
- /gear's "Add …" links are hairlines when the band already has items; the primary and empty-band weights are unchanged.
- The dashboard's six tiles end in a bare muted arrow.

**Red mode**
- Text actions are underlined at rest, and always carry their icon, which tells them apart from an inline link.
- The hairline's border is a pure red at ≥3:1 (at least `#c00000`).
- The credit links' underline is visible.

**Offline**
- "Mark observed" turns muted, icon included, with the existing dash in `--border` (owner, F1: keep it).
- A quiet action (Manage) turns muted ink without an underline.

**Contract, rules and evidence**
- `buttonVariants` has no `action`; `quiet` (with the `bare` size) and `hairline` replace it.
- The CLAUDE.md rules and code comments describe the hierarchy.
- `/design` shows both variants in every state.
- A red-mode e2e assertion pins D2.
- A before/after screenshot matrix shows the change.

**Verify**
- `npx astro check`, `npm run lint`, `npm test`, the whole e2e suite and smoke pass against a local preview.
- The owner reviews the screenshot matrix, including the red-mode outline-versus-hairline pairs (F7).

### Key Discoveries:

- **Padding.** Views merge `buttonVariants` through `cn()` (twMerge), but `size: "sm"` carries `has-[>svg]:px-2.5`. Its `:has()` selector out-ranks a plain `px-0`, and twMerge does not treat the two as conflicting (plan review F9). A text action therefore needs its own size (`bare`), not a padding override in the variant.
- **Plain hex.** `contrast.test.ts` reads plain hex only (`:1-12`), and `red-theme.test.ts:62-65` needs a red value for every new `:root` token. A new token must be plain hex in every block that defines it.
- **Custom variants.** The existing ones are `dark`, `offline` and `night` (`global.css:8-14`). A `red` variant is new.
- **The offline rule is unlayered**, so it beats `red:underline` and `hover:underline` in the utilities layer. A quiet link offline loses its underline, as wanted (plan review, Grounding).
- **The back link's name.** `tonight-dashboard.spec.ts:62` finds it as a `main` link named exactly `en.nav.tonight`. The label and role must not change.
- **Card height.** `GEAR_CARD_MIN_HEIGHT_CLASS` (`sky-band.ts:30`, `min-h-34 sm:min-h-37`) is the measured single-item card. The Manage link inside it must stay 44 px (`min-h-11` from cva's base). No spec measures this, so it is a manual check (2.8).
- **Link colour as text (`primary-strong`), today:**
  - on the ground: 4.5 in dark and light only (`contrast.test.ts:81`); red has only a 3:1 row (`:97`);
  - on the surface: never at 4.5;
  - on the sky stops: 4.5 only in the night scope.
  - Values (plan review F2):

    | Theme | background / surface | zenith / horizon |
    |---|---|---|
    | dark | 12.99 / 12.26 | 13.04 / 9.14 |
    | light | 8.61 / 8.08 | 4.90 / 7.70 |
    | red | 5.20 / 5.07 | 5.25 / 4.89 |

  - Quiet actions lose their fill, so these need pins.
- **A hairline never sits on a sky header.** `--control-border` on the light zenith is only 1.92.

## What We're NOT Doing

- **Navigation.** The Tonight sub-nav replacing the back link on the focused pages, and Progress as a fourth destination, are change 4 (`ui-tonight-nav`). Here the back link only gets quieter, and Progress stays in the /log header as a text action.
- **Facts, spacing, icons and stat cards.** Change 2 (`ui-fact-rhythm`). Here eyepiece names only leave the link colour.
- **Other weights.** `default`, `outline`, `ghost`, `link` and `destructive` are unchanged ("Now", "Show the other … objects", the empty-band /gear add, Add entry, the setup prompts). If the owner finds outline and hairline too close in red (F7), that is a follow-up.
- **The offline dash colour.** It stays `var(--border)` (owner, F1).
- **Sky checks and the medallion.** The sky-check answers (`SkyAnswerForm`, `RESTING_BORDER_CLASS`, the suggested `border-2` plus action fill) and the medallion are unchanged. They keep the action tokens and their contrast rows.
- **Row links.** Whole-row links (log rows, gear rows, Session plan rows, the Targets `<summary>`) are unchanged.
- **S-07's components.** Nothing changes beyond what `Tile`, `BackLink` and `Attribution` give them.

## Implementation Approach

Contract first, then the call sites, then the guard: tokens → shared component → views → states.

- **Phase 1** adds the new token, the `red` variant, `quiet`, `hairline` and the `bare` size beside `action`, with their pins and `/design` specimens, plus the offline icon reset. The build stays green.
- **Phase 2** moves every call site and the credit links, removes `action` (TypeScript fails on any leftover), bares the tile cue, recolours eyepiece names and adds the red-mode e2e assertion.
- **Phase 3** rewrites the rules and comments, captures the screenshot gate, judges the landing image, and runs the whole suite the way CI does.

**Decisions**
- **3C** is the owner's (audit).
- **D1** (a new neutral grey `--control-border` at ≥3:1) and **D2** (a resting underline on text actions in red only) are the owner's, 2026-10-14.
- **F1** (keep `--border` for the dash; fix the hairline's icon offline) and **F4** (credit links get the same red-mode resting underline, as plain links in a sentence) are the owner's answers on the plan review.
- The technical choices are this plan's: the variant names and `bare` size, keeping the action tokens, the hairline for the /gear Add links, renaming `SkyCheckCard`'s local `quietAction`.

## Critical Implementation Details

- **Padding.** Give the quiet action its own size `bare` (no horizontal padding, `gap-1.5`, 44 px tall from the base), and use it only with `variant: "quiet"`. Do not put `px-0` in the variant. The hairline keeps `size: "sm"`.
- **Offline.** Extend the global rule rather than the variants: add `svg` to the colour reset (`:root[data-offline] [data-needs-network] svg { color: inherit; }` in the same unlayered block), so an icon painted by a utility (the hairline's Check) mutes with its label.
  - Leave the dash in `var(--border)`.
  - Update the comment at `:543-549` and `/design`'s hand copy `offlineAction` (`design.astro:199`).
- **Red underline.** The `red` variant is `&:where([data-theme="red"] *)`, the same scope as `[data-theme="red"]` on `<html>`. Popovers that carry their own `data-theme` keep working.
  - On quiet actions it gives `red:underline` at rest.
  - On the credit links it gives `red:decoration-current`, so their existing underline takes the text colour in red only.
- **Ports and environment.** Commands use this agent's ports, passed as parameters:
  - `PREVIEW_PORT=4331`, `FIXTURE_PORT=4401`, `BASE_URL=http://localhost:4331`;
  - `FORECAST_BASE_URL=http://127.0.0.1:4401` in the preview's `dist/server/.dev.vars`, written after each `npm run build` (the build overwrites it);
  - local Supabase.
  - The secret key is inline on the command only, never in a file.

## Phase 1: The contract: token, variants, pins, specimens, offline reset

### Overview

Add everything the hierarchy needs beside the existing `action`, prove it in the contrast test and `/design`, and change no view yet.

### Changes Required:

#### 1. Rebase, install, and the S-07 re-check list

**Files**: the branch

**Intent**: Start from main with S-07 merged, and make sure nothing S-07 added escapes the change.

**Contract**:
- Already rebased onto `origin/main` 1389bc1. Run `npm ci` in the worktree (nvm prefix). `git diff origin/main -- src` is empty before Phase 1 starts.
- S-07 surfaces this change reaches without editing them, each checked in Phases 2-3:
  - the events tile (`EventsTile.astro` via `Tile`, and its `/design` specimens at `design.astro:2053-2085`);
  - the `/tonight/events` back link (`TonightPageSky` → `BackLink`, inside `.night-sky`);
  - the NASA and IAU MDC credit links in `Attribution.astro`;
  - the verdict's event line, judged from its `/design` specimens at `:1594-1640` because the real line depends on the clock.

#### 2. The hairline token, the `red` variant and the offline icon reset

**File**: `src/styles/global.css`

**Intent**: A neutral border that is a real ≥3:1 indicator in every theme, a way to style red mode by shape, and an offline rule that mutes icons too.

**Contract**:
- New `--control-border`, plain hex, in the dark `:root`, light and red blocks (not `.night-sky`: no hairline sits on the night sky, nor on any sky header).
  - Published as `--color-control-border` beside the action tokens in `@theme inline`.
  - Values: ≥3:1 against `--background` and `--surface` of its theme. Starting points: dark `#646e8a` (3.90 / 3.68), light `#808a9e` (3.38 / 3.17), red pure red at least `#c00000` (`#c80000` gives 3.42 / 3.33).
- New `@custom-variant red (&:where([data-theme="red"] *));` next to `offline` and `night`, with a comment naming its uses (quiet actions' resting underline, credit links' underline colour).
- The offline block gains the `svg` colour reset (see Critical Implementation Details). The dash stays `var(--border)`.

#### 3. The `quiet` and `hairline` variants and the `bare` size

**File**: `src/components/ui/button.tsx`

**Intent**: Two quieter tiers beside `default`: a per-item button and text actions.

**Contract**:
- `hairline`: `border border-control-border bg-transparent`, label in `text-foreground`, icons in `text-primary-strong` (`[&_svg]:` utility), `py-2 text-left whitespace-normal`.
  - Hover: border to `primary-strong` plus `bg-accent`.
  - Disabled: `border-border` and muted text.
  - Used with `size: "sm"`.
- `quiet`: no border, no fill, `text-primary-strong`, `py-2 text-left whitespace-normal underline-offset-4`, `hover:underline`, `red:underline` at rest with `red:hover:decoration-2`.
  - Disabled: muted text.
  - Used with the new `size: "bare"` (no horizontal padding, `gap-1.5`).
- `action` stays for now (Phase 2 removes it).
- The header comment (`:8-15`) describes the hierarchy:
  - one filled primary per screen;
  - a hairline per item, never on a sky header;
  - quiet text, always with its icon, for the rest;
  - `link` inside sentences.

#### 4. Contrast pins

**File**: `src/styles/contrast.test.ts`

**Intent**: Pin the new indicator, and the link colour as text where quiet actions now sit without a fill.

**Contract**:
- `control-border` on `background` and `surface` ≥3, themes dark, light and red.
- `primary-strong` on `background` and `surface` ≥4.5, themes dark, light and red. This supersedes the dark-and-light ground-only row at `:81`; keep or merge that row.
- `primary-strong` on `zenith` and `horizon` ≥4.5, themes dark, light and red (back links and the /log header links on the sky; the night scope is already pinned at `:119`).
- Keep the action rows (`:124-130`), with their comment reworded to name the sky-check answers and the medallion.

#### 5. `/design` specimens

**File**: `src/pages/design.astro`

**Intent**: The kitchen sink shows both new variants as the views will ship them, in the 7-state matrix, before any view uses them.

**Contract**:
- `quiet` and `hairline` rows in the variants table (`:187-196`).
  - Their hover specimens mirror the real hover classes; quiet's also mirrors `red:decoration-2`.
  - `sizeOf` (`:194`) maps quiet → `bare` and hairline → `sm`, and the focus filter includes both, so the generic default, focus and disabled loops (`:771-865`) render them at their real size.
- Beside the `<button disabled>` specimens, say that a disabled link is only ever the offline `aria-disabled` state.
- One offline specimen for each variant, with `offlineAction` reworded to match the rule, the icon muted included.
- One long Polish label wrap specimen for each, inside `max-w-xs`.
- A swatch for `control-border`.
- Empty, error and loading are N/A for a button; say so beside the table, as for the existing variants.

### Success Criteria:

#### Automated Verification:

- Types and lint pass: `npx astro check` and `npm run lint`
- Unit tests pass, including the new contrast rows and `red-theme.test.ts` with the new token: `npm test`
- `src/styles/no-hardcoded-colors.test.ts` passes (the new hex lives only in `global.css`)
- `npm run build` succeeds

#### Manual Verification:

- `/design` (dev server on port 4331) in dark, light and red at 390 px and desktop:
  - hairline reads as a button but quieter than `action`;
  - quiet reads as a link with its icon;
  - in red, quiet is underlined at rest and the hairline's border is visible;
  - the offline specimens show the muted icon;
  - the Polish wrap specimens stay inside the column.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Move every call site, the credit links, and remove `action`

### Overview

Apply the hierarchy to every view, bare the tile cue, take the link colour off eyepiece names, give the credit links their red underline, pin D2 in e2e, then delete `action`.

### Changes Required:

#### 1. Per-item actions on Tonight

**Files**: `src/components/tonight/TargetDetails.astro`, `MoonCard.astro`, `GearCard.astro`

**Intent**: One hairline per item, and text for everything else.

**Contract**:
- "Mark observed" becomes `hairline` / `sm`, keeping `data-needs-network`, the Check icon, `aria-label` and `srSuffix`.
- "Finder chart" becomes `quiet` / `bare`, keeping its label and Crosshair.
- The pair's gap becomes `gap-x-5 gap-y-2` so it still wraps on a phone.
- MoonCard's washed-out link becomes `quiet` / `bare`.
- GearCard's Manage link becomes `quiet` / `bare`, keeping `data-needs-network` and Settings2. It stays 44 px tall, so the card height is unchanged.

#### 2. Shared links

**Files**: `src/components/ui/BackLink.astro`, `src/components/ui/Pager.astro`

**Intent**: The way back and the pager stop being boxes. This reaches every sub-page, including `/tonight/events` and the finder.

**Contract**:
- Both become `quiet` / `bare`. BackLink keeps its label, `ChevronLeft`, `mb-2 sm:mb-3` and the `class` merge.
- `/design`'s BackLink and Pager hover specimens (`design.astro:1017`, `:1071`) show the real hover (underline), not `bg-accent`.

#### 3. Page-level links

**Files**: `src/pages/log/index.astro`, `src/pages/log/progress.astro`, `src/pages/gear/index.astro`, `src/pages/auth/confirm-email.astro`, `src/components/progress/MilestoneCelebration.astro`

**Intent**: The rest of the `action` users take their 3C tier.

**Contract**:
- /log's Progress and Sky checks become `quiet` / `bare`; Add entry keeps its weight.
- These become `quiet` / `bare`:
  - `/log/progress`'s empty-state link to Tonight;
  - "Back to sign in";
  - "See your progress", beside the filled Continue.
- `/gear`'s `addClass` third branch (a band that already has items) becomes `hairline` / `sm`. The `default` and `outline` branches are unchanged.

#### 4. Tile cue, eyepiece names and credit links

**Files**: `src/components/ui/tile.ts`, `src/components/tonight/ObjectDetails.astro`, `PlanetCard.astro`, `MoonCard.astro`, `src/components/tonight/Attribution.astro`, `src/pages/onboarding.astro`, `src/pages/design.astro`

**Intent**: The dashboard's arrows and the eyepiece names stop competing with links; the credit links stay readable as links in red.

**Contract**:
- `TILE_CUE_CLASS` becomes a bare `text-muted-foreground` arrow in the same `size-6` box (no border, no fill), so the heading row's height is unchanged.
- The eyepiece-name spans become `font-semibold text-heading` (`ObjectDetails.astro:50,55`, `PlanetCard.astro:56`, `MoonCard.astro:88,98`, the `/design` specimen `:717`).
- The credit `link` class in `Attribution.astro` and `pages/onboarding.astro` gains `red:decoration-current`. They stay plain links in a sentence, exempt from 44 px.

#### 5. Pin D2 in e2e

**File**: `tests/e2e/red-night-mode.spec.ts`

**Intent**: The owner's red-only resting underline cannot be undone silently by a later variant edit or a cascade change (plan review F8).

**Contract**: A new test opens `/auth/confirm-email` signed out (its "Back to sign in" is a quiet action):
- with the theme cookie `red`, the link's computed `text-decoration-line` is `underline`;
- with `dark`, it is `none`.

#### 6. Remove `action`

**Files**: `src/components/ui/button.tsx`, `src/pages/design.astro`, `src/components/tonight/SkyCheckCard.astro`

**Intent**: Every call site was migrated on purpose, and no new one can appear.

**Contract**:
- Delete `action` from `buttonVariants` and from `/design`'s variants table and `sizeOf` (`:190-196`) and its link specimens (`:880`, `:890`).
- Migrate the GearCard Manage specimens (`:1787`, `:1817`) to `quiet` / `bare`; don't delete them.
- `grep -rn 'variant: "action"' src` returns nothing.
- `RESTING_BORDER_CLASS` and the action tokens stay.
- Rename `SkyCheckCard.astro:39`'s local `quietAction` (it is the `link` variant) to `inlineAction`, so "quiet" means one thing.

### Success Criteria:

#### Automated Verification:

- Types and lint pass (TypeScript rejects any leftover `variant: "action"`): `npx astro check` and `npm run lint`
- No `action` variant left: `grep -rn 'variant: "action"' src` prints nothing
- Unit tests pass: `npm test`
- The affected specs pass against a fresh local preview: after `npm run build`, write `dist/server/.dev.vars` (local Supabase URL and publishable key, `FORECAST_BASE_URL=http://127.0.0.1:4401`), start `FIXTURE_PORT=4401 node tests/e2e/forecast-fixture.mjs` and `npx astro preview --port 4331`, then run `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test tonight-phone tonight-targets planets-on-tonight moon-as-target moon-card observation-log observing-progress observing-milestones telescope-selector sky-checks tonight-dashboard finder-chart finder-offline what-to-expect red-night-mode sky-events` (keys from `npx supabase status -o env`, inline only)

#### Manual Verification:

- Targets, Planets and the Moon at 390 px in EN and PL, in dark, light and red: each item shows one hairline "Mark observed" and a text "Finder chart"; eyepiece names are bold but not link-coloured; the Polish pair wraps without sideways scroll.
- Offline (a stored Tonight page with the server unreachable): "Mark observed" is muted (icon included) and dashed; Manage is muted with no underline in red.
- The dashboard's six tiles end in a bare arrow; the gear cards' height is unchanged (measured: Site and Telescope cards before and after).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Rules, comments, screenshot gate and the whole suite

### Overview

Leave the rules the next agent reads, capture the evidence the owner judges, and run everything the way CI does before a PR.

### Changes Required:

#### 1. The rules and comments

**Files**: `CLAUDE.md` (`AGENTS.md` is a symlink), code comments

**Intent**: Every place that still prescribes the box describes the hierarchy, so no agent re-creates it.

**Contract**:
- **Rewrite the "Clickables" bullet (`CLAUDE.md:101`):**
  - at most one `default` per screen;
  - `hairline` / `sm` for the one per-item button (Mark observed) and for /gear's Add when the band has items, and never on a sky header;
  - `quiet` / `bare` for every other standalone or per-item link: always with its lucide icon (`aria-hidden`), which is what tells it from an inline link; wraps; underline on hover, and at rest in red through the `red:` variant;
  - `link` inside sentences; the credit links take `red:decoration-current`;
  - link-colour **text** only on links (icons may keep it);
  - the tile cue is a bare arrow;
  - offline, everything `data-needs-network` mutes, icons included, and a hairline dashes in `--border`;
  - keep the sky-check sentence, and say the action tokens now serve only those answers and the medallion.
- **Other CLAUDE.md mentions:** the Finder chart paragraph (`:17`, "Finder chart" action link → quiet link) and the Gear cards bullet (`:103`, Manage is a `quiet` link).
- **Code comments:**
  - `Tile.astro:3`;
  - `TargetDetails.astro:21,38-39`;
  - `MoonCard.astro:32`;
  - `gear/index.astro:85-87`;
  - `global.css:40` and `:543-549`;
  - the `/design` comments around the variants table and the Manage specimens ("the action variant's" hover);
  - `src/i18n/messages/en.ts:1054` (comment only);
  - `Band.astro:4` and `band.tsx:8` ("one quiet action" → "one action");
  - `contrast.test.ts` rows;
  - `BackLink.astro`, `Pager.astro`, `tile.ts`.

#### 2. The screenshot gate

**Files**: `context/changes/ui-quiet-actions/evidence/` (including `capture.mjs` and `seed.mjs` copied from `ui-refine/evidence/` with the base URL as a parameter)

**Intent**: The owner judges the result on the same matrix as the audit, plus S-07's surfaces.

**Contract**:
- On the preview, with a fresh local user and the full plan granted (key inline only), capture: Tonight (six tiles), Targets, Planets, the Moon, Nights, `/tonight/events`, the finder page, /log, `/log/sky`, /log/progress, /gear and confirm-email.
- Then, on the dev server, capture `/design` (the button matrix, the milestone dialog specimen, the VerdictCard event specimens, the EventsTile specimens).
- Matrix: EN/PL × dark/light/red × 390 px/desktop. Commit a curated, downscaled set beside `ui-refine/evidence/before/`.
- Include before/after crops of:
  - a target row in red and light;
  - the red-mode pairs of F7: "Show the other … objects" (outline) next to "Mark observed" (hairline), and /gear's empty-band Add (outline) next to a filled-band Add (hairline).
- **Landing image:** judge `public/landing/tonight.png` against the new dashboard (tile arrows, Manage). Recapture it with `CAPTURE_LANDING=1 BASE_URL=http://localhost:4331 npx playwright test landing-screenshot` if they show, or record "not needed" with the reason.

#### 3. Whole suite before the PR

**Intent**: Lessons "Run the whole e2e suite before a PR" and "A red `ci` on main blocks the deploy".

**Contract**:
- A fresh `npm run build`.
- `dist/server/.dev.vars` on the local stack.
- The fixture on 4401 and the preview on 4331, as in Phase 2.
- Then `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run test:e2e` and `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run smoke`.
- Report the counts.

### Success Criteria:

#### Automated Verification:

- The whole unit suite, types and lint pass: `npm test`, `npx astro check`, `npm run lint`
- The whole e2e suite passes against a fresh local preview: `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run test:e2e`
- Smoke passes against the same preview: `BASE_URL=http://localhost:4331 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run smoke`
- No doc or comment still prescribes the action look: `grep -nE '`action`|action link|tinted|bordered chip' CLAUDE.md src -r`, reviewed by hand; only the action tokens' own lines, the sky-check answers and the medallion may remain

#### Manual Verification:

- The owner reviews the screenshot matrix against the audit's before shots and accepts the button weight.
- Red and dark mode at arm's length on a phone, including the dashboard: Mark observed and the text actions are findable without hue. The owner judges the F7 pairs (outline vs hairline in red) on the crops.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `contrast.test.ts` gains three rows:
  - `control-border` on background and surface ≥3;
  - `primary-strong` on background and surface ≥4.5;
  - `primary-strong` on zenith and horizon ≥4.5.

  Each covers dark, light and red. The action rows are kept.
- `red-theme.test.ts`: covers the new token's red value without edits.
- `no-hardcoded-colors.test.ts`: unchanged, and must stay green.

### Integration Tests:

- One new e2e assertion (`red-night-mode.spec.ts`): the quiet "Back to sign in" is underlined at rest in red and not in dark.
- Every other spec locates the affected controls by role and name and must pass unchanged. A locator edit is a sign that a label, role or name changed by mistake.
- `tonight-phone.spec.ts` guards sideways scroll at 320/375 px in EN and PL (including `/tonight/events`). It does not measure the gear cards' height, which stays manual check 2.8.

### Manual Testing Steps:

1. `/design` in each theme: the 7-state matrix for `quiet` and `hairline`, and the offline specimens with muted icons.
2. Targets and Planets at 390 px, PL, red: wrapping, the underline, the hairline border.
3. A stored Tonight page offline: muted and dashed "Mark observed", muted Manage.
4. The screenshot matrix against `ui-refine/evidence/before/`, with the F7 crops.

## Performance Considerations

None. These are class changes only.

## Migration Notes

There is no data or migration. Rollback is a revert of this change's commits. The action tokens are not removed, so a revert restores the old look exactly.

## References

- Research: `context/changes/ui-quiet-actions/research.md`
- Plan review: `context/changes/ui-quiet-actions/reviews/plan-review.md`
- Audit and owner decisions: `context/changes/ui-refine/audit.md`, `context/changes/ui-refine/change.md`
- Experiments: `context/changes/ui-refine/evidence/exp-a/experiment-a.diff` (text actions), `exp-b/experiment-b.diff` (hairline)
- Origin of `action`: `context/archive/2026-10-08-ui-user-adjustments/`
- Lessons: `context/foundation/lessons.md` ("Run the whole e2e suite before a PR", "A red `ci` on main blocks the deploy")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The contract: token, variants, pins, specimens, offline reset

#### Automated

- [x] 1.1 Types and lint pass: `npx astro check` and `npm run lint` — 2e2b903
- [x] 1.2 Unit tests pass, including the new contrast rows and `red-theme.test.ts` with the new token: `npm test` — 2e2b903
- [x] 1.3 `src/styles/no-hardcoded-colors.test.ts` passes (the new hex lives only in `global.css`) — 2e2b903
- [x] 1.4 `npm run build` succeeds — 2e2b903

#### Manual

- [x] 1.5 `/design` in dark, light and red at 390 px and desktop: hairline quieter than `action`, quiet reads as a link, red underline and border visible, offline icons muted, Polish wraps — adea9d0

### Phase 2: Move every call site, the credit links, and remove `action`

#### Automated

- [x] 2.1 Types and lint pass (TypeScript rejects any leftover `variant: "action"`): `npx astro check` and `npm run lint` — 73d233d
- [x] 2.2 No `action` variant left: `grep -rn 'variant: "action"' src` prints nothing — 73d233d
- [x] 2.3 Unit tests pass: `npm test` — 73d233d
- [x] 2.4 The affected specs pass against a fresh local preview (ports 4331/4401, keys inline): `npx playwright test tonight-phone tonight-targets planets-on-tonight moon-as-target moon-card observation-log observing-progress observing-milestones telescope-selector sky-checks tonight-dashboard finder-chart finder-offline what-to-expect red-night-mode sky-events` — 73d233d

#### Manual

- [x] 2.6 Targets, Planets and the Moon at 390 px in EN and PL, dark, light and red: one hairline Mark observed, text Finder chart, eyepiece names not link-coloured, Polish wraps — adea9d0
- [x] 2.7 Offline: Mark observed muted (icon included) and dashed; Manage muted with no underline in red — adea9d0
- [x] 2.8 The dashboard's six tiles end in a bare arrow; the gear cards' height is unchanged — adea9d0

### Phase 3: Rules, comments, screenshot gate and the whole suite

#### Automated

- [x] 3.1 The whole unit suite, types and lint pass — adea9d0
- [x] 3.2 The whole e2e suite passes against a fresh local preview: `npm run test:e2e` — adea9d0
- [x] 3.3 Smoke passes against the same preview: `npm run smoke` — adea9d0
- [x] 3.4 No doc or comment still prescribes the action look (grep reviewed by hand) — adea9d0

#### Manual

- [x] 3.5 The owner reviews the screenshot matrix against the audit's before shots and accepts the button weight — owner-accepted 2026-10-14
- [x] 3.6 Red and dark mode at arm's length on a phone, including the dashboard; the owner judges the F7 outline-vs-hairline pairs — owner-accepted 2026-10-14
