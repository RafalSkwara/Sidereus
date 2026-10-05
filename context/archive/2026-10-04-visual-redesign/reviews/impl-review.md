<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Visual redesign (Nightfall contract + `/gear`)

- **Plan**: context/changes/visual-redesign/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-04
- **Verdict**: NEEDS ATTENTION (all 9 findings fixed in triage, 2026-10-04)
- **Findings**: 0 critical, 3 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria, re-run on HEAD (56e5630):
- `npm test`: 607 passed.
- `npm run lint`: 0 errors.
- `npx astro check`: 0/0/0.
- `npm run build`: OK.
- `diff CLAUDE.md AGENTS.md`: identical (AGENTS.md is a symlink).
- `npm run test:e2e`: 18 passed, 2 skipped.
- `npm run smoke`: passed.

All 38 Progress rows are `[x]` with SHAs. The manual rows carry evidence: Playwright scripts, computed-style probes, the red pixel audit, and the user-approved screenshot gate at https://claude.ai/artifact/TrHDyfFZnqzJsiQXBT3fj7.

## Findings

### F1 — Deletes and saves can be submitted twice

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/gear/DeleteButton.tsx:52, src/components/forms/SubmitButton.tsx:12
- **Detail**:
  - **Delete:** after the dialog's delete button is clicked, the dialog stays open and the button stays enabled until navigation. A second click sends a second POST. That POST finds nothing and redirects to `/gear?error=errors.notFound.<kind>`, so a delete that succeeded can end on a "not found" error.
  - **Save (pre-existing):** `useFormStatus().pending` is only true for React function-action forms. Every gear form is a native `<form method="POST" action="/api/...">`, so Save never disables. A double-click on an add form inserts two rows.
  - The "loading" state on `/design` never happens on a real form (confirmed in the screenshot gate).
- **Fix A ⭐ Recommended**: Track a `submitting` flag set in the form's `onSubmit`. Disable the dialog's delete and the SubmitButton from it, and show the pending spinner. (Don't disable the submitter synchronously in `onClick`, because that cancels the submission.)
  - Strength: Fixes both double-submits and makes the designed pending state real. Small and local: DeleteButton and SubmitButton, plus a prop or context that the 3 gear forms and the auth/onboarding/log forms use.
  - Tradeoff: SubmitButton changes for every form that uses it, so the e2e suite must re-run. If navigation is cancelled (bfcache back), the flag must reset on `pageshow`.
  - Confidence: MED — the pattern is standard; the bfcache reset is easy to miss.
  - Blind spot: How the OnboardingWizard and auth forms render SubmitButton hasn't been audited.
- **Fix B**: Leave it for a separate small change (a "submit once" slice) and record it as a follow-up.
  - Strength: Keeps this change's scope to the visual contract. The save double-submit predates it.
  - Tradeoff: Ships the delete double-submit edge case and a kitchen-sink state that never occurs in the app.
  - Confidence: HIGH — nothing else depends on it.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A): SubmitButton and DeleteButton watch their form's submit, then disable and show pending after the event, resetting on bfcache `pageshow`. Probe: a delete double-click sends 1 POST; a save double-click sends 1 POST with "Saving..." disabled; an invalid submit stays idle.

### F2 — Red mode: native select pickers and the search clear button draw system colours

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/native-select.tsx:29-46; src/components/location/LocationPicker.tsx:186 (`type="search"`)
- **Detail**:
  - **Select pickers (pre-existing):** the `<option>` token classes only apply where the browser draws the list itself. On macOS the open list is a system menu, and on iOS/Android a system sheet. In `color-scheme: dark` that is dark grey with a system-blue highlight, so G/B are non-zero.
  - **Search clear button:** Chrome's grey `::-webkit-search-cancel-button` is not hidden under `[data-theme="red"]`, while the number spinners and date icons already are.
  - **Not caught by the gate:** the screenshot audit passed because no picker was open and the search field was empty.
- **Fix A ⭐ Recommended**: Add `[data-theme="red"] ::-webkit-search-cancel-button { appearance: none }` (Escape still clears) and record the native-picker limitation in the red-mode notes.
  - Strength: A one-line CSS fix for the part we control, and an honest record of the platform limit.
  - Tradeoff: Open pickers still show system colours in red mode on macOS and mobile.
  - Confidence: HIGH — the same pattern already hides the spinners and date icons in global.css.
  - Blind spot: Safari's search field decorations haven't been checked.
- **Fix B**: Replace the native select with a token-styled listbox in red mode, or use `appearance: base-select` (Chrome 135+).
  - Strength: Fully red pickers.
  - Tradeoff: Loses native mobile pickers (an explicit Phase 1 goal), and base-select isn't in Safari or Firefox. Its own change.
  - Confidence: LOW — browser support is uneven.
  - Blind spot: Accessibility parity of a custom listbox.
- **Decision**: FIXED (Fix A): `[data-theme="red"] ::-webkit-search-cancel-button { appearance: none }` plus the native-picker limit recorded in the red-mode notes in global.css.

### F3 — The save/delete notice is likely not announced by screen readers

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/Notice.astro:23 (used by src/pages/gear/index.astro:118, src/pages/log/index.astro:61)
- **Detail**: The `role="status"` notice is server-rendered with its text already present. Live regions announce changes, not initial content, so "Site saved." is usually not spoken after the redirect. The e2e tests only assert visibility.
- **Fix**: Render the status region empty and move the text in with a tiny inline script after load. Without JavaScript the text stays visible as it is today.
- **Decision**: FIXED: Notice refills its text 150 ms after load so the live region announces it; without JS the text is unchanged. Screen-reader speech not verifiable headless.

### F4 — Some shell controls are under the 44 px target

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/Topbar.astro:44 (`h-9`, 36 px, from `md`); src/components/TopbarControls.tsx:18,25 (`size-10`/`h-10`, 40 px, on phones too)
- **Detail**: Button, BackLink and the gear rows meet the 44 px contract this change sets; the shell's nav pill and round controls don't. The sizes predate the change, but these lines were edited in it.
- **Fix**: Raise them to `size-11` / `min-h-11`; the Topbar row stays within 64 px.
- **Decision**: FIXED: Topbar pill links `h-11`; TopbarControls icon buttons `size-11`, panel segments `h-11`. Measured 44 px; Topbar row 50 px (≤ 64).

### F5 — Unused 36 px `size="sm"` on NativeSelect

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/ui/native-select.tsx:17
- **Detail**: shadcn's `data-[size=sm]:h-9` variant survived. It conflicts with "one field height" and the 44 px targets. Nothing uses it.
- **Fix**: Drop the `size` prop and the `sm` variant.
- **Decision**: FIXED: NativeSelect `size`/`sm` variant removed (no callers).

### F6 — Delete dialog semantics and the pre-hydration path

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/gear/DeleteButton.tsx:24-44
- **Detail**:
  - **Semantics:** the full confirmation sentence is the dialog's accessible name. `role="alertdialog"` with a short label and `aria-describedby` for the sentence fits a destructive confirmation better.
  - **Before hydration:** the trigger posts the delete with no confirmation. This matches the old `window.confirm` behaviour and is documented in a comment, so it isn't a regression.
- **Fix**: Add `role="alertdialog"`, `aria-label={label}` and `aria-describedby={messageId}`. Keep the pre-hydration behaviour as documented.
- **Decision**: FIXED: dialog is `role="alertdialog"` with `aria-label={label}` and `aria-describedby` the sentence; e2e locators updated to `alertdialog`. Pre-hydration path kept as documented.

### F7 — Two identical back links on the edit-page 404

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/gear/{sites,telescopes,eyepieces}/[id].astro (not-found branch)
- **Detail**: The not-found state shows "Back to My gear" in the sky header and again inside the not-found Band. Both follow the contract, but they're redundant.
- **Fix**: Drop the BackLink inside the not-found Band and keep the header one.
- **Decision**: FIXED: the BackLink inside the not-found Band is removed on all three edit pages; the header BackLink stays.

### F8 — `/design` still renders a stub in production

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/design.astro:27-28, :714
- **Detail**:
  - **In production:** the kitchen sink is unreachable, since `import.meta.env.DEV` folds to false and the prod chunk is 2.6 KB. The page still runs its frontmatter and renders a bare "Not found" template with status 404.
  - **Delete demo:** the live DeleteButton demo posts to `/design` in dev.
- **Fix**: `if (!import.meta.env.DEV) return new Response(null, { status: 404 })` at the top of the frontmatter, and point the demo's action at `#`.
- **Decision**: FIXED: `/design` returns `new Response(null, { status: 404 })` outside DEV; demo DeleteButton action is `#`.

### F9 — SiteForm hints use the old hint style

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/gear/SiteForm.tsx:221,288
- **Detail**: `coordinatesHint` and `minAltitudeHint` keep `mt-1 text-xs`. The shared hint style (FormField, EyepieceForm's `afovPreset-hint`) is `mt-1.5 text-sm`.
- **Fix**: Switch both hints to the shared hint classes.
- **Decision**: FIXED: SiteForm coordinates and min-altitude hints use `mt-1.5 text-sm` (ObservationForm left for the /log pass).
