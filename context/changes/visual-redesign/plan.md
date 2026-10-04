# Visual redesign (Nightfall contract + `/gear`) Implementation Plan

## Overview

Sidereus has no designed visual system, only a colour-token layer over screens that were never composed (`frame.md`). This change builds the **Nightfall** design-system contract:

- self-hosted Archivo with its width axis
- Nightfall colour values for dark, light and red
- sky tokens, named type roles and one radius scale
- shared components for the patterns that are copied by hand today

It then applies the contract to one view, **`/gear`** (hub plus new/edit pages), and closes with a kitchen sink, a screenshot gate and an agent rule. Tokens are global, so every other view picks up Nightfall colour and type at once and keeps its card layout until its own `/10x-ui` pass (user decision: merge per view).

## Current State Analysis

From `research.md` (§1–§5, `## Charges`) and `frame.md`:

- **Tokens.** `src/styles/global.css` holds colour tokens for three themes (`:19-114`), derived tokens (`:120-156`), one `--radius` (`:21`) with a scale for `sm…xl` (`:262-265`), and three font families (`:5-7`, `:267-269`). There is no type, spacing, elevation or sky token. Cards use `rounded-2xl` (42 uses), which falls back to Tailwind's `1rem` and ignores `--radius`.
- **Components.** `src/components/ui/` has only `button.tsx`, which already exports `buttonVariants` (`:50`). Cards (39 copies), page headers, kickers (19 copies) and `primaryLink` (5 files) are copy-pasted class strings. `selectBase` is copied 4 times and input heights differ: `FormField.tsx:6` uses `py-2`, `LocationPicker.tsx:45` uses `h-11`.
- **Guards.** `no-hardcoded-colors.test.ts` blocks palette classes, hex and `rgb()` outside `global.css`. `red-theme.test.ts` checks zero G/B (`:63`) and that every `:root` token has a red value (`:72`); non-colour tokens are whitelisted through `NON_COLOUR_TOKENS` (`:18`). No contrast test exists in any theme.
- **`/gear` charges** (`research.md` `## Charges`):
  - C1: type, surfaces and radius are not tokens.
  - C2: no shared card, header, link-button, select, label, list row or back link.
  - C3: three identical boxes with three competing primary buttons (`gear/index.astro:94-174`).
  - C4: saves are silent (6 API routes redirect to a bare `/gear`); delete uses `window.confirm` (`DeleteButton.tsx:14`), which flashes a white OS dialog in red mode.
  - C5: no rule or check beyond colour; `/design` has drifted from the app.
- **Shell.** `GearShell.astro:15-25` is the app-wide shell for 13 pages: Topbar in a `max-w-5xl` container, then `main max-w-3xl`, then TabBar.

## Desired End State

In dark, light and red, at 390 px and 1280 px, in EN and PL:

- **The hub.** `/gear` opens with a short **sky header** (zenith-to-horizon gradient, Topbar and page title on it, ending in the horizon rule). Below it, sites, telescopes and eyepieces sit in **full-width ruled bands**, not boxes, set in Archivo. A band with no items explains why that kind matters, and the hub shows at most one primary button at a time.
- **Feedback.** Saving or deleting gear lands on `/gear` with a status notice. Deleting asks in a token-styled dialog, so red mode never shows a white system dialog.
- **New/edit pages.** They share the header, band and form controls. Field heights, radii and labels are identical across forms.
- **The rest of the app.** It shows Nightfall colours and Archivo type and keeps its card layout until its own pass.
- **Guards.** `npm test` fails when any theme drops a text pair below its contrast floor. `/design` is the kitchen sink showing every shared component in the 7-state matrix. `CLAUDE.md` and `AGENTS.md` carry a UI rule naming the tokens, the components and the kitchen sink.

### Key Discoveries:

- `ui/button.tsx:50` exports `buttonVariants`, so Astro `<a>` elements can share the button look without a new component library (charge C2).
- Tailwind v4 font tokens accept `--font-<name>--font-variation-settings` and `--font-<name>--font-feature-settings`. Pointing `--font-display` at Archivo with `"wdth" 125` and `--font-mono` at Archivo with `"tnum"` restyles all 62 `font-display` and 27 `font-mono` call sites without editing them.
- `@fontsource-variable/archivo/wdth.css` ships wdth 62–125 and wght 100–900 with latin and latin-ext subsets, so Polish is covered (checked on fontsource, 2026-10-04).
- The colour guard's palette regex contains `sky`, so a token named `sky-top` would make `from-sky-top` fail `no-hardcoded-colors.test.ts`. The sky tokens are therefore named `--zenith` and `--horizon`.
- These e2e specs depend on the old behaviour and must change with it:
  - **Native confirm:** 4 call sites accept the native `window.confirm` (`observation-log-management.spec.ts:43,140`, `seven-night-planner.spec.ts:84`, `telescope-selector.spec.ts:43`).
  - **Bare `/gear` URL after a save:** `observation-log-management.spec.ts:32,46` and `seven-night-planner.spec.ts:58` expect it.
  - **Name selector:** `seven-night-planner.spec.ts:65` selects the site name by `span.font-semibold`.
- `DeleteButton` is shared with `src/pages/log/[id].astro`, so the dialog reaches the log page too. That is intended: one component.

## What We're NOT Doing

- **Tonight's composition and the interactive sky slider:** S-11 builds them on this contract. Tonight keeps its cards here and gets new colours and type.
- **The landing page:** its own, bigger rework, plus the signed-in redirect from `/` (decided 2026-10-04). It gets new tokens only. `public/landing/tonight.png` stays stale until then.
- **Composition passes for `/log`, `/log/sky`, auth and onboarding:** they each get their own `/10x-ui` pass. Exceptions, because they are shared components:
  - `FormField`, `Input`, `NativeSelect`, `Label`, `ServerError`, `DeleteButton`, `DatabaseMissing`, Topbar and TabBar restyle everywhere they're used.
  - `/log`'s inline success notice moves to the shared `Notice`.
- **No mechanical sweep of other pages' cards, kickers or `primaryLink` strings** (user decision: merge per view).
- **A sky colour that follows the real hour on every page.** The sky header uses the static zenith/horizon tokens; the time-driven sky belongs to S-11.
- **No visual regression baselines (`toHaveScreenshot`):** the repo has none, and the gate is the kitchen sink plus the scripted screenshot matrix.
- **No new design-system dependency** beyond Archivo and shadcn's own `label`/`native-select` components.

## Implementation Approach

Follow `/10x-ui`'s order: **environment → token values → shared components → one view → states**. Each phase leaves the app building and every existing test green, apart from the e2e edits that phase names.

- **Fonts first (phase 1).** The font switch is global but cheap: the role tokens (`font-display`, `font-sans`, `font-mono`) keep their names, so call sites don't change.
- **Values next (phase 2).** Values are mapped onto the existing role names, so the shadcn components and every view keep working. A contrast test pins the new values.
- **Components then the view (phases 3–4).** Components are built before the view and proven on `/gear` only.
- **Close (phase 5).** The kitchen sink, the screenshot gate and the rule.

## Critical Implementation Details

- **Token naming vs the colour guard.** Never name a token after a Tailwind palette colour (`sky`, `rose`, `stone`, …). The guard regex in `no-hardcoded-colors.test.ts` matches `from-sky-…` as a palette class. Hence `--zenith` and `--horizon`.
- **Non-colour tokens on `:root`.** Any non-colour token added to `:root` (type sizes, radii) trips `red-theme.test.ts:72` unless it is listed in `NON_COLOUR_TOKENS` (`:18`). Prefer declaring type and radius values in `@theme inline`, which the red test doesn't read.
- **Sky header layout.** The sky band must be full-bleed while Topbar keeps its `max-w-5xl` container. `GearShell` therefore renders the band itself, around Topbar and a named `header` slot, only when `Astro.slots.has("header")`. Pages that don't fill the slot render exactly as today, so the 12 other pages using `GearShell` don't change layout.

## Phase 1: Fonts and component library

### Overview

Swap the three font families for self-hosted Archivo, keeping the role names, and add shadcn's `label` and `native-select` primitives so later phases have them. This phase is visible app-wide as a type change only.

### Changes Required:

#### 1. Font packages

**File**: `package.json`, `package-lock.json`

**Intent**: Add `@fontsource-variable/archivo`, and remove `@fontsource-variable/newsreader`, `@fontsource-variable/public-sans` and `@fontsource/ibm-plex-mono` (user decision: drop mono).

**Contract**: Dependencies change only. Fonts stay self-hosted, with no third-party requests (ui-foundation decision).

#### 2. Font imports and role tokens

**File**: `src/styles/global.css`

**Intent**: Import Archivo's width-axis CSS and point all three font roles at it: display expanded, sans at normal width, mono at normal width with tabular figures. Existing `font-display` and `font-mono` classes then render Archivo without call-site edits.

**Contract**:

- Replace the imports at `:5-7` with `@import "@fontsource-variable/archivo/wdth.css";`.
- In `@theme inline`:

```css
--font-sans: "Archivo Variable", system-ui, sans-serif;
--font-display: "Archivo Variable", system-ui, sans-serif;
--font-display--font-variation-settings: "wdth" 125;
--font-mono: "Archivo Variable", system-ui, sans-serif;
--font-mono--font-feature-settings: "tnum";
```

#### 3. Form primitives

**File**: `src/components/ui/label.tsx`, `src/components/ui/native-select.tsx`

**Intent**: Add them through the stack's path, `npx shadcn@latest add label native-select`. If the registry has no `native-select`, write it in `ui/` following `button.tsx`'s `cva` pattern around a native `<select>`, keeping native pickers on phones. Restyling happens in phase 3.

**Contract**: Exports `Label` and `NativeSelect`. Only token classes, so the colour guard stays green.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the colour and red guards: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Production build succeeds and the CSS contains no Newsreader, Public Sans or Plex Mono `@font-face`: `npm run build`

#### Manual Verification:

- `/gear` and `/tonight` render in Archivo (headings expanded, body normal width, times tabular) with Polish diacritics intact, in dark at 390 px

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Nightfall token values

### Overview

Map the Nightfall palettes onto the existing role names, add the sky tokens, named type roles and one radius scale, deposit the values in the change folder, and pin contrast with a test.

### Changes Required:

#### 1. Token values

**File**: `context/changes/visual-redesign/tokens-nightfall.md`

**Intent**: Record the source values and their role mapping before editing CSS, so the next session doesn't invent them again (`/10x-ui` deposit rule).

**Contract**: A table per theme (dark, light, red) mapping each role to a hex value. Source: the canvas (`NightfallSpec`, `NightfallDark`). Starting values:

| Role                           | Dark                              | Light                             | Red                             |
| ------------------------------ | --------------------------------- | --------------------------------- | ------------------------------- |
| `background` (ground)          | `#070a12`                         | `#fbfcfd`                         | `#080000`                       |
| `surface` (inset field)        | slightly lifted ground            | slightly lowered ground           | `#170000`                       |
| `border` (rule)                | `#232b3f`                         | `#d6dce6`                         | `#3a0000`                       |
| `foreground`                   | about `#dfe3ec`                   | about `#1c2538`                   | `#f20000`                       |
| `heading`                      | `#f2f4f8`                         | `#0b1428`                         | `#ff0000`                       |
| `muted-foreground`             | `#a9b1c5`                         | `#3c465c`                         | `#c40000`                       |
| `primary` (filled action, ink) | `#f2f4f8`                         | `#0b1428`                         | `#ff0000`                       |
| `primary-foreground`           | ground                            | ground                            | `#000000`                       |
| `primary-strong` (links, ring) | `#c3d0ff`                         | `#23439f`                         | `#ff0000`                       |
| `go` / `marginal` / `no-go`    | `#7ee2b0` / `#f1cf6b` / `#ff9b8c` | `#17784c` / `#8f6100` / `#b0322b` | red brightness levels, as today |
| `zenith` / `horizon`           | `#050916` / `#1b2a55`             | `#a9c3e6` / `#e9f0f8`             | `#000000` / `#240000`           |

Final values are whatever passes the contrast test.

#### 2. Theme blocks

**File**: `src/styles/global.css`

**Intent**: Write the values above into the three theme blocks, keeping the role names. Add `--zenith` and `--horizon` as base colour tokens in every block and publish them as `--color-zenith` and `--color-horizon`.

**Contract**:

- `--selected` follows `--primary` in every theme. Light theme's override at `:152-154` is re-checked against the contrast test.
- `--ring` points at `--primary-strong`.
- Verdict alphas stay.
- The Moon tokens map to the new ground and ink, and the Moon still looks the same in light and dark (earlier user choice).

#### 3. Type roles and radius

**File**: `src/styles/global.css`

**Intent**: Give the type and corner rhythm names, so views stop using arbitrary sizes, and tie every radius step to one `--radius`.

**Contract**:

- In `@theme inline`, named text sizes with line height (and letter spacing where tight):
  - `--text-display`: page title in the sky header, about 40/44 expanded
  - `--text-title`: band heading, about 22/28 expanded
  - `--text-label`: band label and field label, 15/20
  - `--text-body`: 16/24
- `--radius: 0.375rem`. `--radius-2xl` and `--radius-xl` are mapped onto the same scale, so remaining `rounded-2xl` cards on unrestyled views follow the token instead of `1rem`.
- No non-colour token goes on `:root`. If one must, add it to `NON_COLOUR_TOKENS`.

#### 4. Contrast guard

**File**: `src/styles/contrast.test.ts` (new)

**Intent**: Make "WCAG AA in all three themes" a failing test instead of a manual check. This also ships the red-mode floors that `red-night-mode/plan.md:90` planned and never shipped.

**Contract**:

- Parse the `:root`, light and red blocks the same way `red-theme.test.ts` does, resolving plain hex values only (derived `color-mix` tokens are out of scope).
- Floors:

| Theme       | Pair                                                                         | Floor                            |
| ----------- | ---------------------------------------------------------------------------- | -------------------------------- |
| dark, light | `foreground`, `heading`, `muted-foreground` on `background` and on `surface` | ≥ 4.5                            |
| dark, light | `heading`, `muted-foreground` on `zenith` and on `horizon` (sky header text) | ≥ 4.5                            |
| dark, light | `primary-foreground` on `primary`                                            | ≥ 4.5                            |
| dark, light | `primary-strong` on `background`                                             | ≥ 4.5                            |
| dark, light | `go`, `marginal`, `no-go` on `background`                                    | ≥ 4.5 (used as text)             |
| dark, light | `primary-strong` (ring) against `background`                                 | ≥ 3 (non-text)                   |
| red         | `foreground`, `heading`, text on `primary`                                   | ≥ 4.5                            |
| red         | `muted-foreground`, `no-go`                                                  | ≥ 3 (the accepted red exception) |

- Failures list theme, pair and ratio.

### Success Criteria:

#### Automated Verification:

- Contrast, colour and red guards pass: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build succeeds: `npm run build`

#### Manual Verification:

- Kitchen-sink preview of tokens on `/design` (`npm run dev`): swatches show the Nightfall values in dark, light and red, and the zenith-to-horizon gradient reads as night, day and red respectively
- `/tonight` and `/log` still read correctly in all three themes with the new values (no invisible text, no unreadable verdict), at 390 px

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Shared components and the sky header

### Overview

Build the components the charges name, restyle the existing shared ones, give `GearShell` the sky header, and replace the system confirm. After this phase, `/gear` can be composed from repo components alone.

### Changes Required:

#### 1. Buttons and link-buttons

**File**: `src/components/ui/button.tsx`

**Intent**: Restyle the variants in Nightfall terms. `default` is filled ink, `outline` is an ink outline, plus `ghost`, `link` and `destructive`. Use the new radius and a 44 px minimum height. `buttonVariants` becomes the one source for Astro links that act as buttons, replacing `primaryLink` on the gear pages.

**Contract**:

- Variant and size names stay, so `SubmitButton`, `LocationPicker` and `OnboardingWizard` keep compiling.
- Focus uses `--ring`.
- Disabled is readable, not just faded.

#### 2. Astro building blocks

**File**: `src/components/ui/PageHeader.astro`, `src/components/ui/Band.astro`, `src/components/ui/BackLink.astro`, `src/components/ui/Notice.astro` (new)

**Intent**: Turn the copied patterns into components.

**Contract**:

- **`PageHeader`:** title in `text-display`, an optional sentence-case subtitle and an optional actions slot. No uppercase kicker.
- **`Band`:** full-width ruled section with props `headingId`, `heading` and an optional `action` slot, and a body slot. It is unboxed, with rules between bands.
- **`BackLink`:** `href` and `label`, with a 44 px target.
- **`Notice`:** props `tone` (`success | info | warning`), `role="status"` and a slot. It reuses the verdict surface tokens for success.
- None of them takes free text in URLs.

#### 3. Form controls

**File**: `src/components/ui/input.tsx` (new), `src/components/ui/label.tsx`, `src/components/ui/native-select.tsx`, `src/components/forms/FormField.tsx`, `src/components/forms/ServerError.tsx`, `src/components/forms/SubmitButton.tsx`, `src/components/location/LocationPicker.tsx`, `src/components/gear/SiteForm.tsx`, `src/components/gear/EyepieceForm.tsx`

**Intent**: One field height, radius, label style and error style everywhere. `FormField` keeps its props and renders `Label` and `Input`. The local `selectBase`/`inputBase` strings and hand-written labels in the gear forms and `LocationPicker` give way to the primitives.

**Contract**:

- `FormField`'s public props are unchanged (7 forms import it).
- The invalid state keeps `aria-invalid` and `aria-describedby`.
- `LocationPicker`'s behaviour is untouched: click-only geolocation, rounding.
- `OnboardingWizard`, `ObservationForm` and the auth forms pick up the restyle through `FormField` with no edits. Their own local strings wait for their passes.

#### 4. Delete confirmation

**File**: `src/components/gear/DeleteButton.tsx`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Replace `window.confirm` with a native `<dialog>` styled from tokens. Red mode then never shows an OS-drawn dialog (charge C4).

**Contract**:

- The trigger is a `Button variant="destructive"`-style outline.
- The dialog is labelled by the existing `confirmMessage`.
- Cancel gets initial focus. The confirm button carries the existing `label` and submits the same POST form.
- Escape and Cancel close without submitting.
- New key `common.cancel` in EN and PL (`satisfies Messages` parity).
- Used by the gear edit pages and `log/[id].astro` unchanged.

#### 5. Sky header in the shell, Topbar and TabBar

**File**: `src/components/gear/GearShell.astro`, `src/components/Topbar.astro`, `src/components/TabBar.astro`, `src/components/TopbarControls.tsx`

**Intent**: When a page fills the `header` slot, `GearShell` renders a full-bleed sky band behind Topbar and that slot. The band is a gradient from `zenith` to `horizon` and ends in the horizon rule. Otherwise the shell renders as today. Topbar, TabBar and TopbarControls lose their arbitrary values (`h-[34px]`, `text-[15px]`, `text-[13px]`, `text-[11px] tracking-[0.12em]`, `size-[22px]`) in favour of the type roles and the Nightfall look.

**Contract**:

- `Astro.slots.has("header")` switches the layout.
- The Topbar row stays ≤ 64 px (top-nav gate). The pill from `md`, the tab bar below `md`, the theme cycle and the view-transition names `nav-current`/`tab-current` are unchanged.
- The settings panel keeps its native popover and its accessible name (used by `red-night-mode.spec.ts:45`).

#### 6. Specs that accept the native confirm

**File**: `tests/e2e/observation-log-management.spec.ts`, `tests/e2e/seven-night-planner.spec.ts`, `tests/e2e/telescope-selector.spec.ts`

**Intent**: Replace `page.waitForEvent("dialog")…accept()` with clicking the delete button inside the confirm dialog.

**Contract**: Locate it by role: the dialog, then the button named by the delete label from `en`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build succeeds: `npm run build`
- Hardcoded-value scan on the shell, Topbar, TabBar, TopbarControls, form helpers and `DeleteButton` returns 0 arbitrary values and 0 literal colours
- e2e suite passes against local preview (handoff recipe): `npm run test:e2e`

#### Manual Verification:

- The delete dialog opens, Escape and Cancel keep the item, and confirm deletes it, in dark, light and red. In red no white flash appears.
- Focus is visible on every Topbar, TabBar and settings-panel control in all three themes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: The `/gear` view

### Overview

Compose the hub and its new/edit pages from the phase-3 components. Add save and delete notices. Restyle the not-found, load-error and missing-database states.

### Changes Required:

#### 1. Hub

**File**: `src/pages/gear/index.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Address charge C3.

**Contract**:

- **Sky header:** `PageHeader` in the `header` slot, holding the title and the former kicker rewritten as a sentence-case subtitle.
- **Bands:** three `Band`s, in the order sites, telescopes, eyepieces.
- **Lists:** rows separated by rules, unboxed, with a hover token and a 44 px target. Each item name carries a stable `data-item-name` hook for e2e.
- **"Add" actions:** `outline`/`ghost` link-buttons through `buttonVariants`.
- **Empty states:** an empty band says why it matters (new copy keys in EN and PL). The first missing kind that Tonight needs (site, then telescope) gets the one `default` primary action. When nothing is missing, no action is primary.
- **Per-section load errors:** keep `ServerError`.
- `primaryLink` and the hand-copied card strings disappear from this file.

#### 2. Save and delete notices

**File**: `src/pages/api/gear/{sites,telescopes,eyepieces}/index.ts`, `src/pages/api/gear/{sites,telescopes,eyepieces}/[id].ts`, `src/pages/api/gear/{sites,telescopes,eyepieces}/[id]/delete.ts`, `src/pages/gear/index.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `src/pages/log/index.astro`

**Intent**: Address charge C4.

**Contract**:

- **Redirects:** successful create, update and delete redirect to `/gear?saved=<kind>` or `/gear?deleted=<kind>`, where `kind ∈ {site, telescope, eyepiece}` is a fixed value (never a name or coordinate).
- **Hub:** shows a `Notice tone="success"` from new keys `gear.notice.saved.<kind>` and `gear.notice.deleted.<kind>`. An unknown value shows nothing.
- **`/log`:** its inline notice (`log/index.astro:60-68`) switches to `Notice` with the same text.
- **Lint:** no route outside `gearConfig.files` gains coordinate handling, so the `no-console` scope is unchanged.

#### 3. New and edit pages

**File**: `src/pages/gear/{sites,telescopes,eyepieces}/new.astro`, `src/pages/gear/{sites,telescopes,eyepieces}/[id].astro`

**Intent**: Give the new and edit pages the same identity as the hub.

**Contract**:

- **Header:** `BackLink` and `PageHeader` in the sky header.
- **Form:** sits in a `Band` on the ground, not in a card.
- **Delete:** gets its own trailing band.
- **Not found:** the 404 state is a `Band` with a `BackLink`, keeping status 404.
- **Load error:** keeps `ServerError`.

#### 4. Missing database

**File**: `src/components/gear/DatabaseMissing.astro`

**Intent**: Restyle it as a `Notice tone="warning"` with the same copy. It is shared by 5 pages.

**Contract**: The copy and the env-variable names shown are unchanged.

#### 5. Specs that depend on the old URL or markup

**File**: `tests/e2e/observation-log-management.spec.ts`, `tests/e2e/seven-night-planner.spec.ts`

**Intent**: Accept the notice query after saves and use the stable name hook.

**Contract**:

- `toHaveURL(/\/gear$/)` becomes a match that allows `?saved=…` or `?deleted=…`.
- `seven-night-planner.spec.ts:65` selects `[data-item-name]` instead of `span.font-semibold`.
- One assertion that the saved notice is visible after adding a site (in the existing flow; no new spec).

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including i18n parity: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build succeeds: `npm run build`
- Hardcoded-value scan on the gear pages and gear forms returns 0 arbitrary values and 0 literal colours, down from 20 hits across the view in the pre-audit
- e2e suite passes against local preview: `npm run test:e2e`
- Smoke walk passes against local Supabase: `npm run smoke`

#### Manual Verification:

- The hub matches the Nightfall canvas in spirit: sky header, three ruled bands, no boxed cards, at most one primary action. Checked at 390 and 1280 px.
- A new account sees explanatory empty bands, with "add a site" as the one primary action
- Save and delete each show the matching notice in EN and PL
- Polish copy fits at 390 px with no overflow (360/390/768/1280 overflow check)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: States, visual gate and the rule

### Overview

Show every state of the view's components in one place, capture the screenshot gate, and leave the rule that keeps the next agent on the contract.

### Changes Required:

#### 1. Kitchen sink

**File**: `src/pages/design.astro`

**Intent**: Rebuild the dev-only page as the kitchen sink. It shows the token swatches (including zenith and horizon), the type roles, and every shared component (`Button` variants, link-buttons, `PageHeader` in a sky header, `Band`, `BackLink`, `Notice` tones, `Input`, `NativeSelect`, `Label`, `FormField`, `ServerError`, `SubmitButton`, the delete dialog) in the 7-state matrix.

**Contract**:

| State         | Where it is shown                        |
| ------------- | ---------------------------------------- |
| default       | every component                          |
| hover         | every interactive component              |
| focus-visible | every control                            |
| disabled      | every control                            |
| error         | `FormField` invalid state, `ServerError` |
| empty         | an empty `Band`                          |
| loading       | `SubmitButton` pending                   |

- The page stays dev-only (404 outside `DEV`) and built from token classes only.
- Skeletons are marked N/A for `/gear`: it is server-rendered and has no loading state besides form submission.

#### 2. Screenshot gate

**File**: a scratch Playwright script in the session scratchpad (handoff recipe: `createRequire(process.cwd() + "/package.json")`, run from the repo root). It is not committed.

**Intent**: Capture the gate:

- before/after of `/gear` hub (empty, filled, notice, load error) and site edit (invalid field, pending, delete dialog, 404)
- EN and PL × dark, light and red × 390 and 1280 px
- `/design` at 390 and 1280 in all three themes

**Contract**:

- Screenshots go to the scratchpad, and the user approves them.
- Red-mode shots pass a pixel audit (no G or B channel above 8), the standard set by `red-night-mode/plan.md:190`.

#### 3. Agent rule

**File**: `CLAUDE.md`, `AGENTS.md`

**Intent**: Add a short UI block. It covers:

- where tokens live (`global.css`, role names, Archivo roles, `zenith`/`horizon`)
- where components live (`src/components/ui/`, `src/components/forms/`)
- "check `ui/` before writing a control; add primitives via `npx shadcn@latest add`"
- "no arbitrary values or literal colours in views; use the type roles and radius scale"
- "Nightfall composition: sky header, ruled bands, at most one primary action per screen"
- "the kitchen sink is `/design`"

Also update the Layout paragraph's font mention.

**Contract**: The same block goes in both files. They are identical today, and this change keeps them that way. No rule invites one-off values.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build succeeds: `npm run build`
- `CLAUDE.md` and `AGENTS.md` stay identical: `diff CLAUDE.md AGENTS.md`

#### Manual Verification:

- `/design` shows all 7 states for every shared component in dark, light and red, at 390 and 1280 px
- The screenshot matrix for `/gear` (EN/PL × dark/light/red × 390/1280) is approved by the user
- Red-mode screenshots pass the pixel audit (no G or B channel above 8), including the delete dialog

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `src/styles/contrast.test.ts` (new): the per-theme floors above. It is the only new unit test ("keep new tests modest").
- The existing colour, red and i18n parity tests cover the token blocks and the new copy keys.

### Integration Tests:

- The existing e2e flows that add, edit and delete gear and log entries, adjusted for the dialog, the notice query and the name hook. One assertion is added for the saved notice.
- `npm run smoke` walks the gear writes over HTTP and must still pass with the new redirect query.

### Manual Testing Steps:

1. A new account opens `/gear`: the sky header and three explanatory empty bands, with "add a site" as the one primary action.
2. Add a site, then a telescope: each lands on `/gear` with the saved notice. Edit one, then delete it through the dialog (try Escape first).
3. Repeat step 2 in red mode at 390 px: no white flash, and the screenshots pass the pixel audit.
4. Switch to PL at 390 px: no overflow on the hub, the forms or the dialog.
5. Open `/tonight` and `/log`: Nightfall colours and type, old card layout, nothing unreadable.

## Performance Considerations

One variable font file per used subset (latin, plus latin-ext for Polish) replaces three families: two variable fonts and one static weight. Page weight should drop or stay level. No preload is added; it isn't added today either.

## Migration Notes

No data changes. The success redirect gains a query string. External links to `/gear` are unaffected. Rollback is a revert of the change's commits. Fonts swap back with the packages.

## References

- Frame brief: `context/changes/visual-redesign/frame.md`
- Research and charges: `context/changes/visual-redesign/research.md` (`## Charges` C1–C5)
- Direction canvas: https://claude.ai/artifact/8VZbxuqAVU1RntyMQ8u6vu (Nightfall row)
- Previous direction pass: `context/archive/2026-09-26-ui-foundation/plan.md`
- Red-mode standards: `context/archive/2026-09-28-red-night-mode/plan.md:90,190`
- Nav structure to keep: `context/archive/2026-09-29-top-nav-redesign/plan.md:41,200`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fonts and component library

#### Automated

- [x] 1.1 Unit tests pass, including the colour and red guards — c9e605d
- [x] 1.2 Lint passes — c9e605d
- [x] 1.3 Type check passes — c9e605d
- [x] 1.4 Production build succeeds and the CSS contains no Newsreader, Public Sans or Plex Mono @font-face — c9e605d

#### Manual

- [x] 1.5 /gear and /tonight render in Archivo with Polish diacritics intact, in dark at 390 px — c9e605d

### Phase 2: Nightfall token values

#### Automated

- [x] 2.1 Contrast, colour and red guards pass — d2844e3
- [x] 2.2 Lint passes — d2844e3
- [x] 2.3 Type check passes — d2844e3
- [x] 2.4 Build succeeds — d2844e3

#### Manual

- [x] 2.5 /design swatches show the Nightfall values and the zenith-to-horizon gradient in dark, light and red — d2844e3
- [x] 2.6 /tonight and /log still read correctly in all three themes with the new values at 390 px — d2844e3

### Phase 3: Shared components and the sky header

#### Automated

- [x] 3.1 Unit tests pass — 6a2281f
- [x] 3.2 Lint passes — 6a2281f
- [x] 3.3 Type check passes — 6a2281f
- [x] 3.4 Build succeeds — 6a2281f
- [x] 3.5 Hardcoded-value scan on shell, Topbar, TabBar, TopbarControls, form helpers and DeleteButton returns 0 — 6a2281f
- [x] 3.6 e2e suite passes against local preview — 6a2281f

#### Manual

- [x] 3.7 Delete dialog: Escape and Cancel keep, confirm deletes, no white flash in red — 6a2281f
- [x] 3.8 Focus visible on every Topbar, TabBar and settings-panel control in all three themes — 6a2281f

### Phase 4: The /gear view

#### Automated

- [x] 4.1 Unit tests pass, including i18n parity — 0bbb4e4
- [x] 4.2 Lint passes — 0bbb4e4
- [x] 4.3 Type check passes — 0bbb4e4
- [x] 4.4 Build succeeds — 0bbb4e4
- [x] 4.5 Hardcoded-value scan on gear pages and gear forms returns 0 — 0bbb4e4
- [x] 4.6 e2e suite passes against local preview — 0bbb4e4
- [x] 4.7 Smoke walk passes against local Supabase — 0bbb4e4

#### Manual

- [x] 4.8 Hub matches the Nightfall canvas: sky header, ruled bands, no boxed cards, at most one primary action — 0bbb4e4
- [x] 4.9 New account sees explanatory empty bands with "add a site" as the one primary action — 0bbb4e4
- [x] 4.10 Save and delete show the matching notice in EN and PL — 0bbb4e4
- [x] 4.11 Polish copy fits at 390 px with no overflow at 360/390/768/1280 — 0bbb4e4

### Phase 5: States, visual gate and the rule

#### Automated

- [x] 5.1 Unit tests pass
- [x] 5.2 Lint passes
- [x] 5.3 Type check passes
- [x] 5.4 Build succeeds
- [x] 5.5 CLAUDE.md and AGENTS.md stay identical

#### Manual

- [x] 5.6 /design shows all 7 states for every shared component in dark, light and red at 390 and 1280 px
- [x] 5.7 Screenshot matrix for /gear approved by the user
- [x] 5.8 Red-mode screenshots pass the pixel audit, including the delete dialog
