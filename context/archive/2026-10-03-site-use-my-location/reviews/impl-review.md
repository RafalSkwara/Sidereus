<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: "Use my location" on the Site Form

- **Plan**: context/changes/site-use-my-location/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-03
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Evidence

- Diff (origin/main...HEAD, code): 15 files; every file in Changes Required is in the diff, and nothing outside the plan except the `clearErrors` helper in SiteForm (in service of the planned pick handler).
- Contracts match: `LocationPick` / picker props, `locateDevice(geolocation)` with "denied"/"unavailable", `PlaceResult.name`, `location.*` namespace, `siteForm.location/previousLocation/undoLocation`, sticky Undo predicate (plan review F1), Undo focuses `#latitudeDeg`, lint globs, CLAUDE.md pointer.
- Lessons: no-console globs added for every new coordinate-handling path (and `src/components/gear/**`); no per-user list queries; nothing in the Tonight island.
- Re-run: `npm test` 605 passed + 6 todo; `astro check` 0 errors; `lint` 0 errors (2 old warnings); e2e site-location + onboarding + seven-night-planner 6/6.
- Manual rows 1.5 and 2.6–2.8 carry evidence: byte-identical onboarding screenshot; 14 Playwright screenshots (EN/PL × dark/light/red, denied, place pick) and scripted value checks.
- Review done inline by the implementing agent (no independent sub-agents).

## Triage

All three fixed on 2026-10-04 (user: "Fix all 3 now"); gates re-run green: unit 605, astro check 0 errors, lint 0 errors, full e2e 19 passed + 1 skipped; edit-page screenshot shows "Automatic (from coordinates)" after a pick.

## Findings

### F1 — Automatic time-zone label goes stale after a pick on edit

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/gear/SiteForm.tsx:83 (`autoLabel`)
- **Detail**: Editing a Madrid site in automatic zone mode and picking Kraków (or London) leaves the zone select reading "Automatic, currently Europe/Madrid" until Save, when the server re-resolves the zone. This was already true for typed coordinates, but S-08 makes moving a site a one-click action.
- **Fix**: Show `autoFromCoordinates` ("Automatic (from coordinates)") whenever the coordinates differ from the saved ones; keep "currently <zone>" otherwise.
- **Decision**: FIXED

### F2 — Undo line's live region mounts with its text

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/gear/SiteForm.tsx:227
- **Detail**: The `role="status"` paragraph is rendered only when `showUndo` is true, so it appears already filled; screen readers often skip a live region that is inserted with its content, and the user is not told an Undo appeared.
- **Fix**: Render the status container always (empty when there is nothing to undo, `empty:hidden`-style) and put the text and button inside it, as the picker does for its own status lines.
- **Decision**: FIXED

### F3 — Wizard header comment line over the 120-column width

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/onboarding/OnboardingWizard.tsx:33
- **Detail**: The rewritten privacy note is a 133-character comment line; Prettier does not wrap comments, and the file's other prose comments stay within `printWidth` 120.
- **Fix**: Rewrap the comment to 120 columns.
- **Decision**: FIXED
