<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Log views in Nightfall

- **Plan**: context/changes/ui-log/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION (before triage); all findings triaged below
- **Findings**: 0 critical, 2 warnings, 6 observations

Two read-only sub-agents reviewed it: plan drift, and safety plus pattern compliance against `/gear`. Automated criteria were re-run by the main agent: lint (0 errors in committed files), `astro check` 0 errors, `npm test` 63 files / 648 tests passed, and the 3 log e2e specs passed against the local preview.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING (1.3 open) |

## Findings

### F1 — "Entry not found" heading on a load error or a missing database

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (copy / a11y)
- **Location**: src/pages/log/[id].astro (title)
- **Detail**: The new visible `PageHeader` h1 read `log.notFound` whenever `entry` was null, including the `DatabaseMissing` and load-error branches, so it claimed "Entry not found" above a different error.
- **Fix**: `log.notFound` only when Supabase is configured, the load succeeded and no entry came back; otherwise the neutral `log.kicker` ("Observation log").
- **Decision**: FIXED

### F2 — SkyTally figure differs from the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/sky-checks/SkyTally.astro:27
- **Detail**: The plan says the tally figure uses `font-display text-title`; it ships as `text-body font-semibold text-heading`. This was deliberate: the screenshot `sky-filled-notice-pl-red-390` showed the band title and the figure at the same size and weight, so the hierarchy collapsed.
- **Fix**: Keep it; record the change as a plan addendum and a visual choice in the PR.
- **Decision**: FIXED (plan addendum)

### F3 — The form band's hidden heading repeated the h1

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/log/new.astro, src/pages/log/[id].astro
- **Detail**: The form sat in a `Band` with `headingHidden` and the page title as its heading, so screen readers heard the title twice.
- **Fix**: The form is now a plain block under the header (with `pb-8` before the Delete band on `[id]`). The Delete band keeps its visible heading.
- **Decision**: FIXED

### F4 — The Pager on /log/sky sat inside the bands' wrapper

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/log/sky.astro
- **Detail**: The last band kept its `pb-8` plus the Pager's `mt-8`, a 64 px gap against 32 px on /log.
- **Fix**: Moved the Pager outside the wrapper, as on /log.
- **Decision**: FIXED

### F5 — The Pager's empty spacer is in the accessibility tree

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/ui/Pager.astro
- **Fix**: `aria-hidden="true"` on the spacer.
- **Decision**: FIXED

### F6 — Field-error announcements are inconsistent within the form

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/observations/ObservationForm.tsx (site, telescope, rating)
- **Detail**: Site, telescope and rating errors sit in `role="alert"` wrappers, which keeps the announcement the old local `FieldError` had. Night (`FormField`) and object (`TargetPicker`) errors are not announced, which was already true before this change, and the gear forms announce none.
- **Fix**: Choose one rule app-wide (a form-level alert summary, or `role="alert"` inside the shared `FieldError`). This touches `src/components/forms/`, which the parallel auth and onboarding passes also edit.
- **Decision**: DEFERRED. Follow-up after the four passes merge. Not a regression.

### F7 — The checked rating key has no forced-colors marker

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/observations/ObservationForm.tsx:74-76
- **Detail**: In forced-colors mode the fill and border flatten, and the radio is `sr-only`. This predates the change.
- **Fix**: Adopt onboarding's shared `ChoiceCard` (PR #103, which has a forced-colors dot) or add a forced-colors outline.
- **Decision**: DEFERRED. Listed with the ChoiceCard overlap in the PR.

### F8 — Small additions not in the plan, and one carried-over arbitrary value

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: Pager.astro (`linkClass`), log/index.astro (Plus icon), TargetPicker.tsx (`pointer-events-none`), SkyTally.astro (`grid-cols-[1fr_auto]`, pre-existing)
- **Detail**: `linkClass` exists only for the `/design` specimens (the same idea as BackLink's `class`). The Plus icon matches gear's add buttons. `grid-cols-[1fr_auto]` is a grid template, not a length or colour, and the scan does not match it.
- **Fix**: Recorded in the plan addendum.
- **Decision**: ACCEPTED

## Triage summary

- Fixed: F1, F3, F4, F5, F2 (plan addendum)
- Deferred: F6, F7
- Accepted: F8
- Open success criterion: 1.3 (`/design` screenshot). `astro dev` failed to start in this worktree.
