# Onboarding in Nightfall Implementation Plan

## Overview

A `/10x-ui` pass over `/onboarding` that closes the four charges in `research.md`: the page moves onto the Nightfall contract (sky header, ruled bands, type roles, the shared field components) and the error lines stop relying on colour alone, in the wizard and in the shared `LocationPicker`. Behaviour does not change: same payload, same validation, same picker logic.

## Current State Analysis

- `src/pages/onboarding.astro` renders its own `h1` (`text-4xl sm:text-5xl`) and a `text-[15px]` intro inside `GearShell` without the `header` slot (research C1, C3).
- `OnboardingWizard.tsx` puts each step in a boxed card with an uppercase kicker, nests boxes inside the kit step, and keeps local copies of the select, the field error, the spinner and the radio card (C1–C3).
- `LocationPicker.tsx` shows a place-search failure as colour-only text, and the wizard does the same for the location and eyepiece-list errors (C4); in red mode `--destructive` and `--muted-foreground` are near-identical.
- No colour literals anywhere in the three files (pre-audit), so no token values change.

## Desired End State

- `/onboarding` opens with the sky header (`PageHeader` with the intro as subtitle, in GearShell's `header` slot), then three ruled bands (Where, Sky, Kit) and a ruled submit area, like `/gear` and the `/gear/*/new` forms.
- Every control is a shared component: `Button`, `FormField`, `NativeSelect` + `Label`, `FieldError`, `ServerError`, and the new `ChoiceCard` for the radio cards; the bands come from the new React `Band`.
- No arbitrary values (`-[…]`) and no `rounded-xl` / `rounded-2xl` in the three view files; focus is the contract's `--ring` outline on every control.
- Every error line in the view carries the `CircleAlert` icon next to the colour, in all three themes; `/gear/sites/new` gets the same picker change and still looks right.
- `/design` shows `ChoiceCard` and the React `Band` in the 7-state matrix.

### Key Discoveries:

- `Band.astro:27-45` cannot be used inside the React form island; a React counterpart with identical classes is needed (`src/components/ui/band.tsx`, new file, `Band.astro` untouched).
- `forms/FormField.tsx:29` already exports `FieldError` (14 px, `CircleAlert`); the wizard's local one (`OnboardingWizard.tsx:133`) is a weaker copy.
- `SubmitButton` cannot replace the wizard's submit as is: it has no `disabled` or `aria-describedby` input, and the wizard owns its `submitting` state (`OnboardingWizard.tsx:185-194, 300-316`). The wizard keeps `Button` but borrows the shared spinner classes (`SubmitButton.tsx:58`).
- e2e selectors to keep: radios by accessible name starting with the title (`onboarding.spec.ts:44-46`), `#place-search`, `#add-eyepiece`, `form[action="/api/onboarding"] button[type="submit"]`, `#manual-latitude`, the `details summary`.
- `ObservationForm.tsx:72-76` has a second radio-card copy, in the log pass's area; left alone here.

## What We're NOT Doing

- No behaviour change in `LocationPicker` (`locateDevice` only on the click, rounding, `searchPlaces`), the wizard's payload, validation or focus moves.
- No new colour tokens and no `global.css` edit: every value the pass needs exists.
- No change to `Band.astro`, `SubmitButton`, `FormField`, `ObservationForm` or other shared files beyond `LocationPicker`, `/design`, the i18n catalogues and one CLAUDE.md line.
- No new e2e or unit tests: the existing onboarding and site-location specs pin the behaviour, and the screenshots cover the looks (user: keep new tests modest).
- No restyle of the geolocation "denied" / "unavailable" hints: they are guidance with the next step in them, not errors (visual choice, listed in the PR).

## Implementation Approach

`/10x-ui` order: environment/library (none needed) → tokens (none needed, recorded) → shared components → the one view → states. Phase 1 adds the two shared components and their `/design` specimens; phase 2 recomposes the page on them; phase 3 fixes the error states in the picker and the host, runs the screenshot matrix and leaves the rule.

## Phase 1: Shared components

### Overview

Add the two components the view needs and show their states in the kitchen sink.

### Changes Required:

#### 1. React Band

**File**: `src/components/ui/band.tsx` (new)

**Intent**: the Nightfall band for React islands whose content spans several bands inside one form (onboarding), so they never re-type the band classes.

**Contract**: `Band({ headingId, heading, id?, className?, headingHidden?, action?, children })`; the same markup and classes as `Band.astro` (section `aria-labelledby`, `not-first:border-t`, `first:pt-0 last:pb-0`, `font-display text-title` heading). A comment names `Band.astro` as the twin to keep in step.

#### 2. ChoiceCard

**File**: `src/components/forms/ChoiceCard.tsx` (new)

**Intent**: the radio-as-card control (onboarding's sky scene, telescope and eyepiece-kit choices), with a visually hidden native radio so arrow keys and forms work as before.

**Contract**: `ChoiceCard({ name, value, checked, onChange, title, description?, disabled?, className? })`. Tokens only: `rounded-lg border-border bg-surface`, hover `bg-accent`, checked `border-selected ring-1 ring-selected` plus the corner dot, focus-visible `outline-2 outline-offset-2 outline-ring` on the card (`has-focus-visible:`), disabled dashed border and muted text. Title `text-label font-semibold text-heading`, description `text-sm text-muted-foreground`. The accessible name stays "title + description".

#### 3. Kitchen sink

**File**: `src/pages/design.astro`

**Intent**: `ChoiceCard` (default, hover specimen, focus-visible specimen, checked, disabled, error N/A, empty N/A, loading N/A) and the React `Band` (two stacked bands) appear in "Components × states".

**Contract**: two new `<section class:list={block}>` blocks, after the FormField block; existing blocks untouched.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx astro check` passes
- `npm test` passes (includes no-hardcoded-colors and red-theme)

#### Manual Verification:

- `/design` shows ChoiceCard and React Band states in dark, light and red (screenshot)

---

## Phase 2: The view

### Overview

Recompose `/onboarding` on the contract (charges C1, C2, C3).

### Changes Required:

#### 1. Page shell

**File**: `src/pages/onboarding.astro`

**Intent**: sky header with `PageHeader` (title, intro as subtitle) in GearShell's `header` slot; the credits stay at the foot, ruled, in token classes.

**Contract**: `<PageHeader slot="header" title={t.title} subtitle={t.intro} />`; no `h1` in `<main>`; no arbitrary values.

#### 2. Wizard composition

**File**: `src/components/onboarding/OnboardingWizard.tsx`

**Intent**: the three steps become React `Band`s (no kicker, no box); the step hints read in `text-body`; the radio cards become `ChoiceCard`; the telescope fields lose their box; eyepiece rows become ruled rows (`divide-y`) instead of boxes; the type select becomes `Label` + `NativeSelect` + shared `FieldError`; the local `FieldError`, `CheckDot`, `selectBase`, `radioCard`, `sectionClass`, `kickerClass`, `headingClass` go; the Add and submit buttons drop their size overrides and the submit spinner uses the shared classes; the submit area is ruled off from the kit band; the manual-coordinates `summary` gets the contract's focus outline and `text-label`.

**Contract**: same element ids, names, hidden inputs and handlers; same accessible names for radios, buttons and the eyepiece fieldsets.

#### 3. Catalogue

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: remove the three now-unused step kickers (`onboarding.where.kicker`, `.sky.kicker`, `.kit.kicker`) from both catalogues.

**Contract**: key parity kept (`i18n.test.ts`).

### Success Criteria:

#### Automated Verification:

- Hardcoded-value scan on the three view files finds no arbitrary values and no `rounded-xl`/`rounded-2xl`
- `npm run lint`, `npx astro check` and `npm test` pass
- `tests/e2e/onboarding.spec.ts` passes against the local preview

#### Manual Verification:

- `/onboarding` screenshots EN/PL × dark/light/red × 390/1280 show the sky header and ruled bands, no Polish overflow at 390 px

---

## Phase 3: States, picker and rule

### Overview

Close C4, cover the state matrix and leave the rule.

### Changes Required:

#### 1. Picker failure line

**File**: `src/components/location/LocationPicker.tsx`

**Intent**: the place-search failure shows the `CircleAlert` icon with the destructive colour, like `FieldError`; nothing else in the picker changes.

**Contract**: `#place-search-status` stays the same always-rendered `aria-live` paragraph; only its children and classes differ when `searchStatus === "failed"`.

#### 2. Host error lines

**File**: `src/components/onboarding/OnboardingWizard.tsx`

**Intent**: the location error under the picker and the eyepiece-list error render through the shared `FieldError` inside their existing `role="alert"` wrappers.

**Contract**: same conditions and texts.

#### 3. Rule

**File**: `CLAUDE.md`

**Intent**: one line under "UI (Nightfall)" naming `ui/band.tsx` and `forms/ChoiceCard.tsx` for islands.

**Contract**: one bullet appended at the end of the section.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check` and `npm test` pass
- e2e `onboarding.spec.ts` and `site-location.spec.ts` pass against the local preview

#### Manual Verification:

- State screenshots (idle, locating, found by device, denied, results, picked, no results, search failed, manual, invalid kit, server error, focus card, focus locate, submitting, no eyepieces, eyepiece limit) in EN dark/light/red and PL dark at 390 px read correctly, with errors carrying the icon
- `/gear/sites/new` screenshots EN/PL × dark/light/red × 390/1280 (plus a picked state at 390) still look right

---

## Testing Strategy

### Unit Tests:

- None new. `no-hardcoded-colors.test.ts`, `red-theme.test.ts` and `i18n.test.ts` guard tokens and key parity.

### Integration Tests:

- `tests/e2e/onboarding.spec.ts` and `tests/e2e/site-location.spec.ts` against a local preview (port 4323, fixture 4402).

### Manual Testing Steps:

1. Run the scratch screenshot matrix (`base`, `states`, `sites`) and read every image for contrast, focus and Polish overflow.

## References

- Research: `context/changes/ui-onboarding/research.md`
- Contract: `context/changes/visual-redesign/tokens-nightfall.md`, `CLAUDE.md` "UI (Nightfall)"
- Reference views: `src/pages/gear/index.astro`, `src/pages/gear/sites/new.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared components

#### Automated

- [x] 1.1 `npm run lint` passes — 0734a62
- [x] 1.2 `npx astro check` passes — 0734a62
- [x] 1.3 `npm test` passes (includes no-hardcoded-colors and red-theme) — 0734a62

#### Manual

- [x] 1.4 `/design` shows ChoiceCard and React Band states in dark, light and red (screenshot) — 0734a62

### Phase 2: The view

#### Automated

- [x] 2.1 Hardcoded-value scan on the three view files finds no arbitrary values and no `rounded-xl`/`rounded-2xl` — eeb1d77
- [x] 2.2 `npm run lint`, `npx astro check` and `npm test` pass — eeb1d77
- [x] 2.3 `tests/e2e/onboarding.spec.ts` passes against the local preview — eeb1d77

#### Manual

- [x] 2.4 `/onboarding` screenshots EN/PL × dark/light/red × 390/1280 show the sky header and ruled bands, no Polish overflow at 390 px — eeb1d77

### Phase 3: States, picker and rule

#### Automated

- [x] 3.1 `npm run lint`, `npx astro check` and `npm test` pass
- [x] 3.2 e2e `onboarding.spec.ts` and `site-location.spec.ts` pass against the local preview

#### Manual

- [x] 3.3 State screenshots in EN dark/light/red and PL dark at 390 px read correctly, with errors carrying the icon
- [x] 3.4 `/gear/sites/new` screenshots EN/PL × dark/light/red × 390/1280 (plus a picked state at 390) still look right
