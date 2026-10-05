# Log views in Nightfall Implementation Plan

## Overview

Bring the four log views (`/log`, `/log/new`, `/log/[id]`, `/log/sky`) onto the Nightfall contract that `/gear` and `/tonight` already follow: the sky header, ruled bands, the shared field primitives and link-buttons, with one primary action per screen. Closes the log part of S-10 `visual-redesign` (#86). Charges C1–C5 in `research.md`.

## Current State Analysis

The log views read only colour tokens (0 literals) but none of the composition: no `header` slot, hand-built `<h1>`s and kickers, 11 boxed cards, local `primaryLink` / `pageLink` strings, a pager copied between two pages, and an observation form with its own select, label, error and 3 px focus ring (research §Charges). `SubmitButton`, `DeleteButton`, `FormField` (date) and `SkyAnswerForm` are already on contract.

## Desired End State

- Every log page renders `PageHeader` in GearShell's `header` slot; sub-pages open with `BackLink`; no uppercase kicker; no `rounded-2xl` card in the log files.
- Content sits in `Band`s: one per night on `/log`, the tally and the nights on `/log/sky`, the form and the delete action on `/log/[id]`.
- Every link that acts as a button uses `buttonVariants`; at most one `default` per screen; the newer/older pager is the shared `Pager`.
- The observation form uses `Label`, `NativeSelect`, `FieldError` and `fieldClass`; every field error is tied to its control by `aria-describedby`.
- Hardcoded-value scan on the log files: 0 hits (from 6).
- Verify: lint, astro check, unit tests, the log e2e specs, and screenshots in EN/PL × dark/light/red × 390/1280.

### Key Discoveries:

- Gear's composition to copy: `src/pages/gear/sites/[id].astro:33-76` (BackLink + PageHeader in the header slot, details/delete bands, not-found band), `src/pages/gear/index.astro:95-97` (`rowLink`, `rowName`, `rowMeta`).
- `Band` renders a `<section aria-labelledby>` with an `h2` (`ui/Band.astro:31-48`), so `observation-log-management.spec.ts:96` (`main section` → `heading level 2`) keeps working.
- `PageHeader` takes a string title (`ui/PageHeader.astro:7-10`); the h1 assertions use `toContainText(editTitle)` / `title` (`observation-log*.spec.ts`), so the common name moves to the subtitle.
- `sky-checks.spec.ts:46-61` reads `[data-sky-tally]` and `[data-sky-check-row]`; both hooks stay.
- `log.backToLog` ("← Log") is read only by `log/[id].astro:55` and `log/sky.astro:79`; `BackLink` draws its own chevron, so those use `m.nav.log` (as `log/new.astro:43` already does) and the key is removed.

## What We're NOT Doing

- No change to `SkyAnswerForm.astro` (shared with Tonight's `SkyCheckCard`, already on contract) or `DeleteButton.tsx`.
- No new colour or type token, no `global.css` edit: the existing roles cover every case.
- No behaviour change in routes, stores, redirects or status codes (e.g. `/log/new` with an unknown object stays 200).
- No new unit tests (the change is markup; see Testing Strategy); no screenshot baseline test (the repo has none; the gate is the screenshot set plus `/design`).
- No edit to `context/changes/visual-redesign/` or `context/archive/`.

## Implementation Approach

Contract first (one new shared component plus i18n keys), then the form primitives, then the four pages, then states and the gate. Shared-file edits are kept to: one new file in `src/components/ui/`, one appended specimen block in `/design`, a few keys inside the `log` and `skyChecks` namespaces, and one CLAUDE.md line. Four agents edit in parallel, so nothing shared is reordered or reformatted.

### Delegated decisions (autonomous run)

- **D1** Keep routes, status codes and redirect contracts unchanged; markup only.
- **D2** Remove the now-unused `log.backToLog` key (both catalogues) rather than leave dead copy.
- **D3** No new unit tests; pin nothing new in e2e beyond keeping the existing log specs green (the user wants modest tests; every change here is visible on a screenshot except the `aria-describedby` link, which is checked by hand in the accessibility tree).
- **D4** The `/log/new` not-found path reuses `log.manualTitle` as its action label instead of adding a key.

## Phase 1: Shared additions (Pager, i18n keys)

### Overview

Add the one missing shared component and the copy the pages need, before touching views.

### Changes Required:

#### 1. Pager

**File**: `src/components/ui/Pager.astro` (new)

**Intent**: The newer/older page navigation shared by `/log` and `/log/sky` (charge C2), replacing the two local copies.

**Contract**: Props `label` (the nav's accessible name), `newerHref?`, `newerLabel`, `olderHref?`, `olderLabel`, `class?`. Renders nothing when both hrefs are absent; otherwise a `<nav aria-label>` with newer at the start and older at the end, each a `buttonVariants({ variant: "link" })` link (44 px, focus outline). Hrefs are fixed app paths chosen by the page.

#### 2. Kitchen sink

**File**: `src/pages/design.astro`

**Intent**: Show `Pager`'s states (both links, older only, newer only, hover and focus specimens; disabled/error/empty/loading N/A with reasons).

**Contract**: One new `<!-- Pager -->` block appended after the `BackLink` block, using the page's existing `block` / `grid` / `cell` / `stateLabel` / `notApplicable` / `focusRing` helpers; one import line.

#### 3. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Band headings the new composition needs; drop the arrow-in-copy back label.

**Contract**: add `log.deleteHeading` ("Delete" / "Usuwanie", matching gear's PL) and `skyChecks.page.nightsHeading` ("Nights" / "Noce"); remove `log.backToLog`. Same keys in both files, appended at the end of their objects.

### Success Criteria:

#### Automated Verification:

- `npm run lint` and `npx astro check` pass
- `npm test` passes (i18n parity, colour guard, red theme)

#### Manual Verification:

- `/design` shows the Pager block with every applicable state, dark/light/red, at 390 and 1280

---

## Phase 2: Observation form on the shared field primitives

### Overview

Charge C3: the form and the picker look and behave like the gear forms.

### Changes Required:

#### 1. ObservationForm

**File**: `src/components/observations/ObservationForm.tsx`

**Intent**: Replace the local `selectBase`, `fieldBorder`, `FieldError` and labels with `Label`, `NativeSelect` / `NativeSelectOption` and the shared `FieldError`; tie each select's error to it.

**Contract**: selects get `aria-invalid` and `aria-describedby="<id>-error"` when in error; the shared `FieldError` gets that id. Hints and the rating scale use `text-sm text-muted-foreground` (as `SiteForm`); the legend uses the `Label` look (`text-label`). The rating radios lose `ring-[3px]`: focus is the `--ring` outline (`has-[:focus-visible]:outline-2 outline-offset-2 outline-ring`), the checked one takes the selected fill (`bg-selected text-selected-foreground`, as `SkyAnswerForm`'s pressed answer). Field names, ids, values and validation unchanged.

#### 2. TargetPicker

**File**: `src/components/observations/TargetPicker.tsx`

**Intent**: The combobox input uses `fieldClass` (plus left padding for the icon), `Label` and the shared `FieldError`.

**Contract**: ARIA and keyboard behaviour unchanged; `ring-[3px]` gone; option text in `text-label` / `text-sm`.

### Success Criteria:

#### Automated Verification:

- Hardcoded-value scan on `src/components/observations/*.tsx`: 0 hits
- `npm run lint`, `npx astro check`, `npm test` pass

#### Manual Verification:

- The log form matches a gear form side by side: 44 px fields, same focus ring, same error line (submit empty on `/log/new?from=log`)

---

## Phase 3: The four pages in Nightfall

### Overview

Charges C1, C2, C4, C5: sky header, bands, link-buttons, `Notice`, `Pager`, and the dead-end paths.

### Changes Required:

#### 1. `/log`

**File**: `src/pages/log/index.astro`

**Intent**: `PageHeader` (title, intro as subtitle, actions) in the header slot; one `Band` per night; gear-style row links with focus outline; `Pager`.

**Contract**: actions: "Sky checks" (`ghost`) and "Add entry" (`default` when the log has entries, `outline` when it is empty or past the last page). Empty log: the sentence plus "Go to Tonight" as the one `default`; the duplicate "Add entry" in the empty state goes. Past the last page: sentence plus "Go to the newest entries" (`default`). `primaryLink` / `pageLink` removed. Rows keep the `/log/<id>` href, the rating dots and the sr-only rating.

#### 2. `/log/new`

**File**: `src/pages/log/new.astro`

**Intent**: Header slot with `BackLink` and `PageHeader` (title; the common name as subtitle in ranking mode); no kicker; the form in a `Band` (heading for screen readers only) led by the intro sentence; the needs-gear state as a sentence plus the gear link-button.

**Contract**: unknown or missing object (C5): the sentence plus a `default` link-button to `/log/new?from=log` labelled `log.manualTitle`. Load error and `DatabaseMissing` unchanged.

#### 3. `/log/[id]`

**File**: `src/pages/log/[id].astro`

**Intent**: Header slot with `BackLink` (`/log`, `m.nav.log`) and `PageHeader` (edit title, common name as subtitle); the form `Band` (heading for screen readers only) led by the intro; a "Delete" `Band` holding `DeleteButton`; not found (C5): header title `log.notFound`, body a sentence and an `outline` link-button back to the log, no second `<h1>`.

**Contract**: 404 status, form props and delete action unchanged.

#### 4. `/log/sky` and the tally

**File**: `src/pages/log/sky.astro`, `src/components/sky-checks/SkyTally.astro`

**Intent**: Header slot with `BackLink` and `PageHeader` (title, intro); the saved message as `Notice tone="success"`; the tally as a `Band`; the nights in a `Band` ("Nights"); `Pager`; type roles throughout.

**Contract**: `[data-sky-tally]` (on the tally's content) and `[data-sky-check-row]` keep their text; the tally figure uses `font-display text-title`; its sub-heading drops the uppercase kicker for `text-label font-semibold text-heading`. Empty and past-the-end states: sentence plus one `default` link-button.

### Success Criteria:

#### Automated Verification:

- Hardcoded-value scan on `src/pages/log/*.astro` and `src/components/sky-checks/SkyTally.astro`: 0 hits; `grep rounded-2xl` on the log files: 0
- `npm run lint`, `npx astro check`, `npm test` pass
- e2e: `observation-log.spec.ts`, `observation-log-management.spec.ts`, `sky-checks.spec.ts` pass against the local preview

#### Manual Verification:

- Each of the four pages reads as a sibling of `/gear` (sky header, ruled bands, one primary) in EN dark at 390 and 1280

---

## Phase 4: States, gate and the rule

### Overview

Cover the 7-state matrix on the real views, take the screenshot set, and leave the rule for the next agent.

### Changes Required:

#### 1. Rule

**File**: `CLAUDE.md`

**Intent**: One line under "UI (Nightfall)" so the next log change stays on the contract.

**Contract**: names the log's composition (sky header, `BackLink` on sub-pages, bands, `Pager`) and the form's shared field primitives.

#### 2. Screenshots (not committed)

**File**: a scratch Playwright script under `tests/e2e/` (untracked) writing to the session scratchpad

**Intent**: Every log view in EN and PL × dark / light / red × 390 / 1280, plus the state cells.

**Contract**: states: `/log` empty, filled with a notice, past the last page, with a long PL name; `/log/new` ranking, manual, invalid submit (error), pending (disabled/loading), needs-gear, unknown object; `/log/[id]` edit, delete dialog, not found; `/log/sky` empty, filled with tally and the saved notice; keyboard focus on a row, a pager link, a select and a rating radio.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check`, `npm test` pass after the CLAUDE.md edit
- Red-mode screenshots pass a pixel check (no G or B channel above 8 outside images)

#### Manual Verification:

- 7-state matrix covered on the log views: default, hover, focus-visible, disabled, error, empty, loading (pending submit), each with a screenshot path or N/A with a reason
- PL at 390 px: no overflow or clipped text on any log view
- Contrast reads in dark, light and red (headings, muted meta, rating dots, outcome dots)

---

## Testing Strategy

### Unit Tests:

- None new (D3). Existing guards (`no-hardcoded-colors`, `red-theme`, `contrast`, i18n parity) cover the shared-file edits.

### Integration Tests:

- The three log e2e specs, unchanged, against the local preview (port 4325, fixture 4400).

### Manual Testing Steps:

1. Sign up a throwaway user, add a site and a telescope, open `/log` (empty), then add entries by hand and from Tonight.
2. Walk each view through its states in the screenshot script; inspect the images for contrast, focus and PL overflow.
3. Check in the accessibility tree that an invalid select points at its error.

## References

- Research: `context/changes/ui-log/research.md`
- Contract: `src/styles/global.css`, `src/components/ui/`, `src/components/forms/`, CLAUDE.md "UI (Nightfall)"
- Pattern: `src/pages/gear/sites/[id].astro`, `src/pages/gear/index.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared additions (Pager, i18n keys)

#### Automated

- [x] 1.1 `npm run lint` and `npx astro check` pass — 7a9b5cd
- [x] 1.2 `npm test` passes (i18n parity, colour guard, red theme) — 7a9b5cd

#### Manual

- [ ] 1.3 `/design` shows the Pager block with every applicable state, dark/light/red, at 390 and 1280

### Phase 2: Observation form on the shared field primitives

#### Automated

- [x] 2.1 Hardcoded-value scan on `src/components/observations/*.tsx`: 0 hits — f10d475
- [x] 2.2 `npm run lint`, `npx astro check`, `npm test` pass — f10d475

#### Manual

- [x] 2.3 The log form matches a gear form side by side: 44 px fields, same focus ring, same error line (submit empty on `/log/new?from=log`)

### Phase 3: The four pages in Nightfall

#### Automated

- [x] 3.1 Hardcoded-value scan on `src/pages/log/*.astro` and `src/components/sky-checks/SkyTally.astro`: 0 hits; `grep rounded-2xl` on the log files: 0 — 4b624be
- [x] 3.2 `npm run lint`, `npx astro check`, `npm test` pass — 4b624be
- [x] 3.3 e2e: `observation-log.spec.ts`, `observation-log-management.spec.ts`, `sky-checks.spec.ts` pass against the local preview — 4b624be

#### Manual

- [x] 3.4 Each of the four pages reads as a sibling of `/gear` (sky header, ruled bands, one primary) in EN dark at 390 and 1280

### Phase 4: States, gate and the rule

#### Automated

- [x] 4.1 `npm run lint`, `npx astro check`, `npm test` pass after the CLAUDE.md edit
- [x] 4.2 Red-mode screenshots pass a pixel check (no G or B channel above 8 outside images)

#### Manual

- [x] 4.3 7-state matrix covered on the log views: default, hover, focus-visible, disabled, error, empty, loading (pending submit), each with a screenshot path or N/A with a reason
- [x] 4.4 PL at 390 px: no overflow or clipped text on any log view
- [x] 4.5 Contrast reads in dark, light and red (headings, muted meta, rating dots, outcome dots)
