<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test rollout Phase 2 — night and date boundaries

- **Plan**: `context/changes/testing-night-and-date-boundaries/plan.md`
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

**Evidence:**

- Two Opus review agents ran: plan drift, and safety/quality/patterns.
- Plan drift: every planned case is present (spans, 11 wall-clock traps, log-night a/b/c, Tonight a/b/c with all preconditions, guard rules and the positive control). Expectations are hand literals, USNO values or hand offsets only. The `new.astro` behaviour and the helper lift are byte-for-byte equivalent.
- Tests: the 4 new suites pass in the default zone and under `TZ=Pacific/Kiritimati`, 264/264 in about 1.05 s. The full suite has 82 files and 1146 tests, and passes in both zones.
- Lint and format: ESLint with `--max-warnings=0` and Prettier are clean on the changed files.
- Manual 2.5 was checked by diff review and logged in the plan.

The minor drift is benign:

- D1: an engine-relative constant import, as the sibling tests do.
- D2: the forecast covers 168 h instead of about 120 h.
- D3: the guard is slightly stricter than planned (Seconds/Milliseconds, multi-argument `new Date`).
- D5: the Phase 1 break-check log sits inside the criteria list.

The extras are harmless:

- E1: a USNO `label` field.
- E2: the guard file exports its matcher.
- E3: `uniformForecast` and `utcWallTime` were lifted although only `build.test.ts` uses them.

## Findings

### F1 — Guard reads comments as code: an apostrophe hides a zone-less call

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/runner-zone-guard.test.ts:42-103
- **Detail**: Comments aren't blanked before argument splitting. A prose comment with an apostrophe inside `Intl.DateTimeFormat(` arguments (`// the runner's zone`) opens a fake string that swallows the closing `)`, and a later call's `timeZone` then satisfies the check. The reviewer reproduced it: the result is `[]`. A `)` in a block comment hides a multi-argument `new Date` the same way. The same root cause flags comments that mention `getHours()`.
- **Fix**: Blank comments first, preserving line breaks, as `src/styles/no-hardcoded-colors.test.ts` does with `blankComments` (reuse or mirror it). Add the apostrophe-comment case to the offending snippets.
- **Decision**: FIXED — comments blanked before matching (mirrors `blankComments`); apostrophe and `)`-in-comment cases added to the positive control; break check: without blanking 4 control cases go red (2026-10-08, user chose "fix F1–F5, then PR")

### F2 — Guard gaps undocumented; `toLocale*` rule inconsistent; line lookup on every match

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/runner-zone-guard.test.ts:17, :37-39, :116-130
- **Detail**:
  - These go unflagged and undocumented: `new Date(d + "T20:00")`, `new Date(...parts)` and implicit `Date#toString()`.
  - `new Date(\`${d}T20:00:00${off}\`)` is a false positive.
  - `toLocaleDateString(..., { timeZone })` is flagged, while `Intl.DateTimeFormat` with `timeZone` is allowed.
  - `lineOf` scans from 0 for every `new Date(` match: 44 ms today, but quadratic.
- **Fix**: Extend the known-gap comment with these shapes, apply the `timeZone`-in-arguments exemption to `toLocale{Date,Time}String`, and compute the line only for a violation.
- **Decision**: FIXED — known-gap comment lists concatenation, spread, implicit `toString` and the trailing-interpolation false positive; `toLocale{Date,Time}String` exempt with an explicit `timeZone`; line computed only for hits (2026-10-08, user chose "fix F1–F5, then PR")

### F3 — Runner-zone switching depends on the forks pool

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/engine/fixtures/runner-zones.ts:3-13; vitest.config.ts
- **Detail**: In Node 24, setting `process.env.TZ` inside a `worker_threads` worker has no effect. If `pool: "threads"` is ever set, the 4 suites fail loudly on "runs in the runner zone it claims". They would never pass silently.
- **Fix**: Add a one-line note to the `runner-zones.ts` doc and to §6.2: the switch needs Vitest's default `forks` pool.
- **Decision**: FIXED — forks-pool note in `runner-zones.ts` and §6.2 (2026-10-08, user chose "fix F1–F5, then PR")

### F4 — `log-night.ts` doc names the wrong path to `gear/store`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/observations/log-night.ts:14
- **Detail**: The comment says the module reaches `gear/store` "through tonight-date". It actually imports `./store`, the observations DB layer, which imports `@/lib/gear/store` directly.
- **Fix**: Reword to "through `./store`, the observations DB layer".
- **Decision**: FIXED — doc now says "through `./store`, the observations DB layer" (2026-10-08, user chose "fix F1–F5, then PR")

### F5 — Doc nits: §6.2 function names, README constant name, test-fixtures header

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/test-plan.md §6.2; src/lib/engine/fixtures/README.md; src/lib/tonight/test-fixtures.ts:5-8
- **Detail**:
  - §6.2 says the engine suite pins `observingNightDateFor`. It calls `observingNight`, `darkWindow` and `tonightDateFor`.
  - The README says "update the `checked` date", but the constant is `USNO_CHECKED`.
  - The `test-fixtures.ts` header still lists only the site, telescope, eyepieces and `NOW`, not the lifted forecast helpers.
- **Fix**: Correct the three texts.
- **Decision**: FIXED — §6.2 names `observingNight`, `darkWindow`, `tonightDateFor`; README names `USNO_CHECKED`; `test-fixtures.ts` header lists the forecast builders (2026-10-08, user chose "fix F1–F5, then PR")

### F6 — Benign plan drift is not recorded in the plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md Phases 1–3
- **Detail**: D1–D3 and E1–E3 (above) are fine as they are, but the plan doesn't say so. A future reader comparing the code to the plan would rediscover them.
- **Fix**: This report records them; no plan edit (Phase blocks are read-only after implementation).
- **Decision**: ACCEPTED — recorded in this report; no plan edit (2026-10-08, user chose "fix F1–F5, then PR")

### F7 — Plan "Critical Implementation Details" says the break-check log sits below the criteria

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md:185
- **Detail**: Phase 1's break-check log sits between two Success Criteria bullets (D5). That is cosmetic only.
- **Fix**: Leave it; it doesn't affect Progress parsing.
- **Decision**: ACCEPTED — cosmetic; left as is (2026-10-08, user chose "fix F1–F5, then PR")
