<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Gear catalogue (S-12)

- **Plan**: context/changes/gear-catalogue/plan.md
- **Scope**: Phases 1–3 of 5 (the user asked for the review after phase 3)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 7 observations

The automated criteria were re-run on HEAD: `npm test` (761 passed), `astro check` (0 errors), eslint (0 errors). The phase-3 e2e and the full e2e suite (29 passed) ran against the HEAD build earlier today. All Manual rows are pending the user's testing; none were ticked.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Enter in the catalogue search can submit the gear form

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/forms/Combobox.tsx:134-140 (hosts: TelescopeForm.tsx:125, EyepieceForm.tsx:136)
- **Detail**:
  - Enter is held back only while an option is highlighted. With a typed query and no highlighted option, Enter submits the whole form:
    - while the list is loading;
    - when the list is unavailable;
    - when nothing matches.
  - On `/gear/*/[id]`, typing "skymax 99" and pressing Enter saves the unchanged values and leaves the page.
  - The e2e already works around this by waiting for the options to load (`tests/e2e/gear-catalogue.spec.ts`).
  - The log's `TargetPicker` relies on Enter submitting when nothing is highlighted (`observation-log-management.spec.ts:83-86,104`).
- **Fix**: Add a `submitOnEnter` prop to `Combobox` (default `false`; `TargetPicker` passes `true`). With it off, Enter never submits from the search input: it chooses the highlighted option or does nothing.
  - Strength: a search box that never posts never triggers a save, and the log keeps its tested behaviour.
  - Tradeoff: one more prop.
  - Confidence: HIGH — the cases are confirmed by reading the Enter guard.
  - Blind spot: whether users expect Enter in the search box to submit the gear form; nothing suggests they do.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all"; gates + full e2e green)

### F2 — English words in catalogue names end up in a Polish user's saved gear name

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency (i18n)
- **Location**: src/lib/gear/catalogue/eyepieces.json, telescopes.json
- **Detail**:
  - Names such as "Sky-Watcher 25 mm (bundled)", "Baader Hyperion Zoom 8-24 mm (at 12 mm)" and "Sky-Watcher Heritage-100P Tabletop Dobsonian" are copied verbatim into the user's Name field. They are then saved and shown on Tonight and in the log, so English text lands in Polish users' data.
  - The README's own rule says to drop taglines.
  - The zoom setting also isn't marked in the detail line, as the plan asked; only the name carries it.
- **Fix**:
  - Keep `name` to brand, model and numbers, e.g. "Sky-Watcher 25 mm", "Baader Hyperion Zoom 8-24 mm @ 12 mm", "Sky-Watcher Heritage-100P". Move descriptive words to `aliases`, where search still finds them.
  - Mark bundled eyepieces and zoom stops in the localised detail line.
  - Add a test that no name contains "(bundled)", "(at", or similar English words.
  - Strength: user data stays language-neutral; the detail line carries the localised meaning.
  - Tradeoff: the bundled eyepiece names must still contain "25 mm" for the phase-4 e2e, which they do.
  - Confidence: HIGH.
  - Blind spot: none significant.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all"; gates + full e2e green)

### F3 — The "heritage 130" test re-implements the search

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/gear/catalogue/catalogue.test.ts:141-148
- **Detail**: The test that guards e2e determinism matches inline instead of calling `searchCatalogue`, so it wouldn't catch a change to the search rule. The eyepiece seed floor is also pinned to the current count (`>= 19`).
- **Fix**: Call `searchCatalogue(TELESCOPES, "heritage 130")` and assert exactly one result with id `skywatcher-heritage-130p`.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all"; gates + full e2e green)

### F4 — Data nits

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/gear/catalogue/*.json
- **Detail**:
  - The Hyperion Zoom 8 mm and 24 mm stops are flagged `afovEstimated`, but 68° and 50° are the published endpoints.
  - "Sky-Watcher StarTravel 102 AZ3" puts the mount in the name.
  - The StarBlast 4.5 is stored as 113 mm, but its alias reads "114/450".
  - Explorer-150P and 130PDS append the focal ratio although they have no same-named sibling.
- **Fix**: Unflag the zoom endpoints, move AZ3 to an alias, align the StarBlast alias, and drop the unneeded suffixes (or keep them, ahead of phase 5's siblings).
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all"; gates + full e2e green)

### F5 — Keyboard and mouse gaps in the combobox (inherited)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/forms/Combobox.tsx:122-196
- **Detail**: Clicking an already-focused input after Escape doesn't reopen the list, and ArrowUp doesn't open a closed list. `TargetPicker` had the same gaps.
- **Fix**: Open the list on click, and make ArrowUp open it as ArrowDown does.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all"; gates + full e2e green)

### F6 — Every "more results" change is announced

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/forms/Combobox.tsx:103-109,242-251
- **Detail**: The `role="status"` line changes on each keystroke while the list is capped. At ~300 entries, screen readers will announce every keystroke.
- **Fix**: Show the "keep typing" count visibly, but announce only when the list switches between capped and not capped (the live region text stays stable while capped).
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all"; gates + full e2e green)

### F7 — Work repeated per keystroke and per render

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (performance)
- **Location**: src/lib/gear/catalogue/search.ts:35-45; TelescopeForm.tsx / EyepieceForm.tsx (`new Intl.NumberFormat` per render)
- **Detail**: Every keystroke re-normalises every name and alias, and each render builds a new formatter. Cheap at 40 entries; worth fixing before phase 5's ~550.
- **Fix**: Cache the normalised haystack per entry (a `WeakMap` in search.ts), and `useMemo` the formatter on `locale`.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all"; gates + full e2e green)

### F8 — The retry in `load.ts` can't be reached

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/gear/catalogue/load.ts
- **Detail**: The memo is cleared on failure "so the page can retry", but the UI never retries, and browsers may cache a failed `import()`.
- **Fix**: Correct the comment so it doesn't promise a retry.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all"; gates + full e2e green)

### F9 — README describes the finished catalogue

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/gear/catalogue/README.md:1-4
- **Detail**: It says the catalogue is used in onboarding (phase 4) and implies the full size (phase 5).
- **Fix**: Leave as is; phases 4 and 5 make it true. Re-check at close-out.
- **Decision**: SKIPPED (no change needed now; phases 4–5 make the README true, re-check at close-out)

### F10 — Status strings joined in the island

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (i18n)
- **Location**: TelescopeForm.tsx:84, EyepieceForm.tsx:82
- **Detail**: `${line} · ${discontinued}` joins catalogue strings in code. The repo does the same elsewhere (`OnboardingWizard.tsx:503`), so this isn't a new violation.
- **Fix**: Fold it into F2's detail-line rework: give the detail messages an optional marker parameter.
- **Decision**: FIXED (applied 2026-10-06, user chose "apply all"; gates + full e2e green)
