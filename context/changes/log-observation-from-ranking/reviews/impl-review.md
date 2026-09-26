<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Log an Observation from the Ranking

- **Plan**: context/changes/log-observation-from-ranking/plan.md
- **Scope**: Full plan. Code for all phases is complete, and manual rows 3.5–3.8 and 4.5–4.8 are still pending.
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-09-26
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Evidence

- Plan drift: every planned change is a MATCH, and nothing from "What We're NOT Doing" crept in. Benign deviations:
  - The foreign-gear and set-null tests live in the new `tests/db/observations.test.ts`, which adds an update-repoint case.
  - The isolation harness's positive control was generalised to `select("*")` + `toMatchObject`, because `observations` has no `name` column.
  - The e2e spec keeps its own helpers, following the `landing-screenshot.spec.ts` convention.
- Automated criteria, rerun 2026-09-26:
  - `npm test`: 475 passed.
  - `npm run test:db`: 44 passed.
  - `db:types`: no diff.
  - `astro check`: 0 errors.
  - lint: 0 errors, 4 pre-existing warnings.
  - e2e: 6 passed, plus the smoke test, both earlier this session.
  - PR #39 CI: `ci` and `smoke` passed.
- Manual criteria: none are ticked, so there is no rubber-stamping. 3.5–3.8 and 4.5–4.8 are pending with the user.

## Findings

### F1 — Log read is unbounded and silently truncated at 1000 rows

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/observations/store.ts:58
- **Detail**: `listForRanking` selects every entry the user has, with no filter and no order. PostgREST caps responses at `max_rows = 1000` (`supabase/config.toml:18`). Past that, which rows are dropped is arbitrary, so the penalty and the "Seen N" tag could change from one load to the next. That also breaks the determinism NFR for a heavy log. Entries rated 1–2 are fetched only to be thrown away in the engine.
- **Fix A ⭐ Recommended**: Filter and order in the query: `.gte("rating", LOG_PENALTY_MIN_RATING).order("night", { ascending: false })`.
  - Strength: The payload is only the rows that can matter. Any truncation becomes deterministic and drops only the oldest nights, which can undercount N but never removes the penalty. It is a one-line change and keeps the rule in the pure engine.
  - Tradeoff: It is still not a hard bound, since there could in theory be over 1000 qualifying nights.
  - Confidence: HIGH. A beginner's log will not come near 1000 rows in the MVP.
  - Blind spot: None significant.
- **Fix B**: Aggregate in SQL, with a view or RPC that returns at most 110 rows (messier, count of distinct nights, latest night).
  - Strength: It is hard-bounded.
  - Tradeoff: The "seen" rule would then exist twice, in SQL and in `seenSummaries`, and it needs a migration plus a new isolation case.
  - Confidence: MED. There is more surface for a problem that is theoretical today.
  - Blind spot: How views interact with RLS (security_invoker) is untested here.
- **Decision**: FIXED (Fix A) — listForRanking filters rating ≥ 3, orders by night desc then messier; DB test updated

### F2 — no-console privacy lint does not cover the new modules

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: eslint.config.js:84
- **Detail**: `gearConfig` enforces `no-console: error` on code that handles coordinates. The new `src/lib/observations/**`, `src/pages/api/log/**` and `src/pages/log/**` all handle full `SiteRecord`s (with coordinates) but are not listed, so the privacy rule rests on comments alone.
- **Fix**: Add those three globs, plus `src/components/tonight/**`, to `gearConfig.files`.
- **Decision**: FIXED — observations, api/log, log pages and components/tonight added to gearConfig

### F3 — Rating group: meaning and errors are not exposed to assistive tech

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/observations/ObservationForm.tsx:168
- **Detail**: The radios are named only "1" to "5". The captions for 1 and 5 are plain spans outside `aria-describedby`, and the rating error is not linked to the group, so a screen reader hears neither the scale nor why a submit was refused. The rating is the one field that always starts empty. (The shared `FormField` has the same gap, but that is inherited and out of scope here.)
- **Fix**: Give the captions and the error ids and list them in the fieldset's `aria-describedby`, set `aria-invalid` on the group when there is an error, and give the error `role="alert"`.
- **Decision**: FIXED — captions/error linked via aria-describedby, aria-invalid on radios, FieldError role=alert

### F4 — Five identical "Mark observed" link names on Tonight

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/ObjectCard.astro:65
- **Detail**: A screen reader's links list shows "Mark observed" five times, with no way to tell which object each one is for.
- **Fix**: Append the object id in an `sr-only` span (e.g. "Mark observed <sr-only>M13</sr-only>").
- **Decision**: FIXED — sr-only object id appended to each link

### F5 — "/log" prefix would also gate future /login, /logout or /logo routes

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/middleware.ts:12
- **Detail**: `PROTECTED_ROUTES` uses prefix matching. Nothing collides today, but a later public `/login` or `/logo.svg` would silently redirect to sign-in.
- **Fix**: Protect `"/log/"` and `"/api/log"` instead of `"/log"`.
- **Decision**: FIXED — "/log" narrowed to "/log/"; "/api/log" kept (the route path has no trailing slash, and /api/ has no login routes)

### F6 — Test gaps: e2e tag text hardcoded; no telescope-repoint DB case

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/observation-log.spec.ts:105; tests/db/observations.test.ts:115
- **Detail**: The e2e tag assertion hardcodes English (`/Seen 1 time – last /`) instead of reading the catalogue. Checking the tag only when the card is still listed is by design, since the spec runs on the real clock. The DB suite tests re-pointing an entry at another user's site but not at another user's telescope, although the policy covers both.
- **Fix**: Build the expected prefix from `en.tonight.object.seen.one`, and add the telescope mirror of the update-repoint test.
- **Decision**: FIXED — e2e expects en.tonight.object.seen.one(...); telescope repoint DB test added

### F7 — The errors-catalogue doc comment now sits above `log`

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/i18n/messages/en.ts:478
- **Detail**: The `log` group was inserted between the "Every value a route may put into `?error=`…" comment and `errors:`, so the comment now documents the wrong group.
- **Fix**: Move the `log` group above that comment.
- **Decision**: FIXED — log group moved above the errors doc comment

### F8 — Observing night has no lower bound

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/observations/schemas.ts:53
- **Detail**: `0001-01-01` passes the schema and the date picker has no `min`, so a mistyped year creates an entry that counts as "seen".
- **Fix**: Add a floor of `1900-01-01` to the schema, with a new key `errors.observation.nightTooEarly` or a reuse of `nightInvalid`, and set `min` on the picker.
- **Decision**: FIXED — MIN_NIGHT 1900-01-01 in schema (errors.observation.nightTooEarly, EN+PL) and picker min

## Triage summary

All 8 findings fixed (user chose "fix all as proposed"). Rerun after fixes: `npm test` 476 passed, `npm run test:db` 45 passed, astro check 0 errors, lint 0 errors, Playwright 6 passed, smoke passed.
