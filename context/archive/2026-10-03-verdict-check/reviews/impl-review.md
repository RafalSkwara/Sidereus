<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Verdict check

- **Plan**: context/changes/verdict-check/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-03
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria re-run on 2026-10-03: `npm test` 601 passed; `npm run test:db` 98 passed; `astro check` 0 errors; lint 0 errors (2 pre-existing warnings in determinism.test.ts); `db:types` no drift. PR #82 CI: ci and smoke (incl. e2e with the new spec) green. Manual rows 2.5, 3.4, 3.5, 4.5, 4.6 are backed by SQL output and Playwright screenshots, recorded in the phase commit messages.

Plan drift: no DRIFT or MISSING. Benign EXTRAs: the RPC also refreshes `site_name` before dark; `/log/sky` has a "← Log" link and a past-the-last-page state; helper modules `redirect.ts`, `labels.ts` and the shared `SkyAnswerForm.astro` (documented adaptations).

## Findings

### F1 — Outcome words fail text contrast in the light theme and blur together in red

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/log/sky.astro:47-51, :133
- **Detail**: The outcome word is coloured with `text-go` / `text-marginal` / `text-no-go` (the first use of the last two as small text). Measured on `--surface`: light theme "Too pessimistic" (marginal) 3.54:1, below 4.5:1 for 14px semibold text; red theme 5.07 / 3.72 / 3.0:1, and the three reds are nearly indistinguishable. The word itself always carries the meaning, so colour is not the only cue.
- **Fix**: Render the outcome word in `text-heading`, and carry the tone on a small dot before it (non-text contrast 3:1), as the "We said" line does.
- **Decision**: FIXED (user chose: dot + heading text; screenshots light/red checked)

### F2 — Two DB guarantees are argued but not tested

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/db/sky-checks.test.ts
- **Detail**: observations.test.ts covers "cannot repoint its own row at another user's site" and onboarding.test.ts:162 covers "an anonymous client cannot execute the RPC (42501)". sky-checks.test.ts covers neither, so a lost update-policy guard or a lost revoke would go unnoticed.
- **Fix**: Add both cases (update to another user's site rejected; anon gets 42501 from `record_sky_verdict` and `sky_check_tally`).
- **Decision**: FIXED (two DB cases added; delegated)

### F3 — answer/skip accept rows the UI never offers

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/sky-checks/store.ts:91-118
- **Detail**: A hand-made POST can answer a `noForecast` night or skip an answered one. Harmless (own rows; list and tally ignore them), but the invariant lives only in the UI.
- **Fix**: `answer` and `skip` also filter `.in("headline", CHECKABLE_HEADLINES)`; `skip` also requires `answer is null`.
- **Decision**: FIXED (answer/skip filter checkable headlines, skip requires no answer; DB case added; delegated)

### F4 — Every pre-dark Tonight view rewrites the row

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261003120000_sky_checks.sql:92-106
- **Detail**: The upsert updates `shown_at` even when nothing else changed: one small UPDATE per view of one's own night.
- **Fix**: Optional `is distinct from` guard on (headline, dark_start, site_name); it would stop `shown_at` meaning "last shown".
- **Decision**: SKIPPED (one small UPDATE per own view; keeps shown_at meaning "last shown"; delegated)

### F5 — A first view late in the night records a mostly-past forecast

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: record_sky_verdict (migration :92-106)
- **Detail**: The "first view after dark inserts" rule (a delegated plan decision) can record a 3 a.m. headline and count it in the tally.
- **Fix**: Keep as decided; revisit when the tally feeds calibration (#21), e.g. by comparing `shown_at` with `dark_start`, which are both stored.
- **Decision**: ACCEPTED (plan decision; shown_at and dark_start are both stored, so late records can be told apart when the tally feeds #21)

### F6 — Answer groups on /log/sky all share one accessible name

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/sky-checks/SkyAnswerForm.astro:29, src/pages/log/sky.astro:111
- **Detail**: Up to 50 groups are each labelled "What you saw", and the list `<section>` is unnamed.
- **Fix**: Name each group by its row (`aria-labelledby` the row's date line plus the shared label) and drop the unnamed `<section>` wrapper's region role (or label it).
- **Decision**: FIXED (each answer group named by its night and site; list wrapper no longer an unnamed section; delegated)

### F7 — Parity nits shared with the existing log pages

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/log/sky.astro:76-80, :85, :119, :135; src/pages/api/log/sky/[id].ts:14
- **Detail**: " · " separators in the template, `request.formData()` throwing on a non-form body, raw `?error=` passed to `translateKey`, and secondary links under 44px tall. Each matches what `src/pages/log/index.astro` and `src/pages/api/log/index.ts` already do.
- **Fix**: None in this change; a repo-wide pass if ever wanted.
- **Decision**: SKIPPED (parity with the existing log pages; delegated)
