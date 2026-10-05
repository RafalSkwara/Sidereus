<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Onboarding in Nightfall

- **Plan**: context/changes/ui-onboarding/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-05
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 6 observations

Two read-only reviewers ran in parallel, one on plan drift and one on safety, accessibility and patterns. Triage was decided by the implementing agent, because the user asked for no questions in this run.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

The drift review matched all 11 planned items. Its two notes are both benign:

- The credit links on `onboarding.astro` gained the shared focus outline.
- The eyepiece-type select gained `aria-describedby` for its error.

Every `validate()` focus target still exists. The wizard's logic up to `return (` is byte-identical to `origin/main`.

## Findings

### F1 — ObservationForm keeps a local radio card with the old focus look

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/observations/ObservationForm.tsx:72-76
- **Detail**: The rating options still use `has-[:checked]:bg-selected/15` and a `ring-[3px] ring-ring/50` focus. ObservationForm also keeps its own `FieldError` and `selectBase`. As a result the app has two focus treatments. This is the log view, which another concurrent `/10x-ui` pass owns.
- **Fix**: Leave the file alone here. The log pass should adopt `ChoiceCard` (or a variant of it for the rating chip shape); the PR body says so.
- **Decision**: DEFERRED (out of area; the log pass owns it)

### F2 — Checked card indistinguishable in forced-colors mode

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/forms/ChoiceCard.tsx:60
- **Detail**: Windows High Contrast flattens the ring, the border colour and the dot's background, so a checked card looks unchecked.
- **Fix**: Add `forced-colors:forced-color-adjust-none` to the dot so its fill survives.
- **Decision**: FIXED

### F3 — Unused `peer` class on the hidden radio

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/forms/ChoiceCard.tsx:50
- **Detail**: No sibling uses `peer-*`. The reviewer also suggested moving the description to `aria-describedby`. That suggestion was not applied: the e2e spec matches the radio's name as "title, then description" (`onboarding.spec.ts:44-46`), and the long name is still correct.
- **Fix**: Remove `peer`.
- **Decision**: FIXED (`peer` removed; the accessible name is kept as it is)

### F4 — Remove-eyepiece button's hover square overhangs the rules

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (layout)
- **Location**: src/components/onboarding/OnboardingWizard.tsx (remove button, `-right-3`)
- **Detail**: The button has no overflow at 390 px: it stays 4 px inside the gutter. Its 44 px hover square does extend 12 px past the rows' rules, which keeps the trash icon optically aligned with the content edge.
- **Fix**: None. The overhang is kept as optical alignment.
- **Decision**: ACCEPTED (visual choice, listed in the PR)

### F5 — The invalid search box does not name the location error

- **Severity**: OBSERVATION (pre-existing)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/onboarding/OnboardingWizard.tsx (Where error); src/components/location/LocationPicker.tsx (search input)
- **Detail**: `aria-invalid` is set on the search box, but its `aria-describedby` points only at the status line.
- **Fix**: Add an optional `errorId` prop to `LocationPicker`. When the box is invalid, its id is appended to `aria-describedby`. The wizard gives the error `id="where-error"`. `SiteForm` passes nothing, so its markup is unchanged.
- **Decision**: FIXED

### F6 — Focus fallback lands on a disabled button at the row limit

- **Severity**: OBSERVATION (pre-existing)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/onboarding/OnboardingWizard.tsx (`validate()`, `return "add-eyepiece"`)
- **Detail**: With 10 rows, `#add-eyepiece` is disabled, so `.focus()` does nothing. The summary alert still announces the problem. The fallback only runs for a list-level eyepiece error, and with 10 rows that cannot happen, because 10 is the allowed maximum.
- **Fix**: None in this visual pass.
- **Decision**: SKIPPED (pre-existing and behavioural; out of a visual pass)

### F7 — The manual-coordinates summary has no open/closed cue

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/onboarding/OnboardingWizard.tsx (`<summary>`)
- **Detail**: `inline-flex` hides the native disclosure marker.
- **Fix**: Add a `ChevronDown` that turns with `group-open:rotate-180`.
- **Decision**: FIXED

## Re-verification after the fixes

- `npm run lint`: 0 errors.
- `npx astro check`: 0 errors.
- `npm test`: 648 passed, 6 todo.
- Full e2e on port 4323: 23 passed, 2 skipped.
- Screenshot matrix re-run into `…/scratchpad/after2/`, for example `state-manual-pl-dark.png` and `state-found-device-en-light.png`, which show the chevron.
