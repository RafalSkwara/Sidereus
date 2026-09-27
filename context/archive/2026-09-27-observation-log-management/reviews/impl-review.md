<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Observation Log Management and Manual Entry

- **Plan**: context/changes/observation-log-management/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-09-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Notes on the PASS rows:
- **Plan Adherence** (32 MATCH): the deviations are documented. They are a shared `messier-options.ts` builder, a simplified number sort (equivalent), one `log.list.deletedGear` key instead of two, and `latestNightBound` as the edit page's date-picker hint.
- **Scope Discipline**: the extras are benign. They are the builder, the CLAUDE.md middleware note, and a 404 e2e test. There is no migration and no change to the engine or Tonight.
- **Safety** is clean on authz (RLS, cross-user reads as not found), open redirects and XSS (fixed keys, encoded ids, schema-filtered prefill), logging (lesson 1 globs cover every new file) and per-user list reads (lesson 2: narrowed, total order, 51 rows).
- **Automated criteria** re-run on the final state: unit 555, DB 55, astro check 0 errors, lint 0 errors, build succeeds, CI `ci` and `smoke` green.

## Findings

### F1 — Object picker highlights an option on focus, so Enter replaces the chosen object

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/observations/MessierPicker.tsx:37-39, 68-73, 114-116
- **Detail**:
  - Focusing the input opens the list without resetting `active`. Once an object is chosen the query is empty, so `activeOption` is M1, or a stale index from an earlier filter.
  - On `/log/<id>`, or on `/log/new?from=log&object=N`, tabbing into Object and pressing Enter (to submit) runs `choose(M1)`. The entry's object is replaced; a second Enter saves it.
  - Screen readers also hear an unrelated option announced as selected.
- **Fix**: Open with no active option (`active = -1`, no `aria-activedescendant`); typing sets it to 0, and ArrowDown from -1 goes to the chosen option, else the first. Enter chooses only when an option is active. Add an e2e step: open an entry, focus Object, press Enter, and assert the object is unchanged.
- **Decision**: FIXED — the picker opens with no active option (`NONE`); typing highlights the best match, the first arrow press lands on the chosen option, and Enter chooses only a highlighted option, otherwise the form submits. `aria-expanded` is false while the list is hidden. The e2e journey now focuses Object on the edit page, presses Enter and asserts the entry is saved unchanged (break check: the old behaviour fails at that step).

### F2 — E2E journey does not assert the night grouping

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/observation-log-management.spec.ts:91-93
- **Detail**: The plan's journey says the entry "appears under its night". The spec checks the notice and the rating but never that the entry sits in a section headed by its night. Grouping was verified only by screenshots.
- **Fix**: Read the night input's value before saving, then assert that the section containing M31 has the heading `formatNightDate(night)` (en-GB, from `createFormatter("en")`).
- **Decision**: FIXED — the journey reads the night field before saving and asserts the M31 entry's section is headed `createFormatter("en").formatNightDate(night)`.

### F3 — "No match" row in the picker has no role inside the listbox

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/observations/MessierPicker.tsx:137-138
- **Detail**: The `<li>` for "No Messier object matches." sits inside `role="listbox"` without `role="option"`. That violates the listbox's required children (axe `aria-required-children`), and screen readers get no announcement that nothing matched.
- **Fix**: Render the message outside the listbox as a `role="status"` region, and hide the listbox when there are no matches.
- **Decision**: FIXED — the listbox holds only options and is hidden when nothing matches. A `role="status"` paragraph outside it (always in the DOM) shows and announces "No Messier object matches." Verified: `aria-expanded=false`, listbox hidden, status text present.

### F4 — A page past the last one shows the "Nothing logged yet" empty state

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/log/index.astro:96-111
- **Detail**: `/log?page=99`, from a stale link or a hand-edited URL, returns no rows. The page then tells a user who has entries that nothing is logged, and the "← Newer" link is missing. Normal flows always land on page 1.
- **Fix**: When `page > 1` and the page is empty, show a short "No entries on this page" line with a link to `/log`, and keep the empty state for page 1.
- **Decision**: FIXED — past the last page (`page > 1`, no rows), `/log` shows "No entries on this page." with a link to the newest entries (`log.list.pageEmpty`, `log.list.toNewest`, EN + PL). Page 1 keeps the empty state. Verified on `/log?page=99`.

### F5 — Gear load failure on the edit page is worded as a log failure

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/log/[id].astro:30-37
- **Detail**: The entry, sites and telescopes load in one `Promise.all`, so any failure shows "Could not load your observation log". The key is still fixed, so nothing leaks.
- **Fix**: Map the failure to `errors.load.setup` (as `/log/new` does), or load the entry and the gear separately.
- **Decision**: FIXED — `/log/[id]` loads the entry and the gear with `Promise.allSettled`. An entry failure reads `errors.load.observations`, a gear failure `errors.load.setup` (as on `/log/new`).

### F6 — E2E suite flakes under parallel load (existing tests, not S-07 code)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: tests/e2e/telescope-selector.spec.ts:43 (CI run 36332064374); tests/e2e/helpers.ts `onboardInMadrid` (local)
- **Detail**:
  - In CI, S-08's spec timed out after 2 minutes on `page.waitForEvent("dialog")` and passed on retry.
  - Locally, the new spec timed out once on a click inside the shared onboarding helper, just after a preview restart, and then passed 3 times in a row.
  - Both are 2-minute timeouts while waiting on an event with 5 workers in parallel. CI's single retry hides them.
- **Fix A ⭐ Recommended**: Track it as a follow-up issue, outside S-07.
  - Strength: Keeps this PR scoped; the cause is in S-08's spec and the shared helper.
  - Tradeoff: The flake stays until picked up, and CI's retry keeps it green meanwhile.
  - Confidence: HIGH — neither failure touches S-07 code.
  - Blind spot: The root cause (dialog listener timing vs hydration, or preview cold start) is not diagnosed.
- **Fix B**: Investigate now: run the e2e suite in CI with `--repeat-each` and fix the waits.
  - Strength: Removes a source of red CI before more specs pile up.
  - Tradeoff: Scope creep for S-07; could take a session.
  - Confidence: MEDIUM — the fix location is unknown.
  - Blind spot: May need changes to the shared helpers used by all specs.
- **Decision**: FIXED via Fix A — follow-up issue #45 (labels bug, stream:A; board: proposed), with the reproduction data from triage: 2/20 `--repeat-each` runs time out at `helpers.ts:61` (the stubbed Madrid result click in `onboardInMadrid`), 1/3 full runs at telescope-selector, and all pass serially.

## Triage summary (2026-09-27)

| Outcome | Findings |
|---|---|
| Fixed | F1, F2, F3, F4, F5 |
| Follow-up issue | F6 → #45 |
