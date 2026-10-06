<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Deep sky beyond Messier (S-03)

- **Plan**: context/changes/deep-sky-beyond-messier/plan.md
- **Scope**: Full plan (focus on Phases 4–5; Phases 1–3 were reviewed in `impl-review-phases-1-3.md` and re-checked here for regressions)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

**Evidence:**
- Two Opus agents reviewed the change: one for plan drift, one for safety and patterns. I re-ran the automated criteria on 4156b57:
  - vitest: 807 passed, 1 skipped
  - `astro check`: 0 errors
  - eslint: 0 errors. There are 3 `no-console` warnings in test files: two existed before this change, one is the calibration snapshot.
  - `catalogue:build`: no diff
- `test:db`, `smoke` and e2e were **not** re-run, because the Docker daemon is down. They passed at c8e4e21 and 5270f17 (Progress 4.1–4.5, 5.1–5.4).
- Migrations:
  - The deep-sky check uses exactly the same regex as `isDeepSkyKey`.
  - The drop migration is safe under migrate-then-deploy: the deployed app never reads or writes `messier`.
- Boundaries:
  - The island boundary is clean. `TargetPicker` and `ObservationForm` pull no catalogue JSON.
  - `isKnownTarget` runs after schema parsing and before the store call in both POST routes, `/log/new` and `formRedirect`.
- Nothing listed in "What We're NOT Doing" was implemented.

## Findings

### F1 — A bare 4-digit number finds nothing in the picker (regression)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/observations/target-search.ts:28, :38-41
- **Detail**:
  - `NUMBER_QUERY` widened from `^m?\s*(\d{1,3})$` to `^(m|ngc|ic|c|caldwell)?\s*(\d{1,4})$`.
  - A bare number now always takes the Messier-only path, so "7000", "5194" and "6543" show "No object matches." Before the change, 4-digit queries fell through to the substring search, and "5194" found M51 through "NGC 5194".
  - Bare 3-digit numbers above 110 ("869", "457") also find nothing now.
  - The tests only cover "20".
- **Fix**: With no prefix, keep the Messier path, but fall back to NGC/IC designation numbers when it returns nothing. Add tests for "7000", "5194" and "869".
- **Decision**: FIXED — bare numbers fall back to NGC/IC designation numbers when no Messier number matches; tests for 7000, 5194, 869, 405

### F2 — C 49 / C 50 carry OpenNGC's duplicate designations, not the conventional ones

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/catalogue/caldwell.json:739-770 (from scripts/build-catalogue.mjs `buildCaldwell`)
- **Detail**:
  - OpenNGC puts the `C 49` / `C 50` tokens on NGC 2238 and NGC 2239. Observers and Caldwell lists know them as NGC 2237 (Rosette Nebula) and NGC 2244 (the Rosette's cluster).
  - In the app, C 50 is shown as "NGC 2239" with no common name, and searches for "ngc 2244" and "ngc 2237" find nothing.
  - `evidence/phase-4.md` noted the missing NGC 2244 but treated it as a correction to the plan, not as a data problem.
- **Fix A ⭐ Recommended**: Add designation overrides in the generator's `OVERRIDES`, recorded in `caldwell.meta.json`: C 50 becomes `NGC2244` "NGC 2244" with a common name, and C 49 becomes `NGC2237` "NGC 2237".
  - Strength: The labels and keys match what beginners read in atlases and apps. This follows the existing Double Cluster / M102 override pattern.
  - Tradeoff: The keys change, but nothing is deployed with them, so no logged data is affected. The calibration snapshot ids and `common-names` entries need updating too.
  - Confidence: HIGH — the override pattern is already used twice in this generator.
  - Blind spot: whether OpenNGC lists NGC 2244 with its own magnitude and position to copy from. It may be a Dup row.
- **Fix B**: Keep the ids and add "NGC 2244" / "NGC 2237" as extra search names on the options.
  - Strength: Small change; the data stays as OpenNGC tags it.
  - Tradeoff: Rows and log entries still read "NGC 2239", which is unfamiliar to users.
  - Confidence: MED — the search improves, but the label stays wrong.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — `action: "designation"` overrides in the generator: C 49 → NGC2237, C 50 → NGC2244 (OpenNGC lists NGC2244 as a Dup of NGC2239), recorded in caldwell.meta.json, pinned in caldwell.test.ts; PL name re-keyed; calibration evidence annotated

### F3 — Picker option order drifted from the plan; the plan and two comments still describe the old order

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/observations/target-options.ts:55; src/lib/observations/target-search.ts:66-73; src/components/observations/ObservationForm.tsx:40; plan.md §4.3
- **Detail**:
  - The plan specified the order Messier → Caldwell → Moon → planets. The code orders them Messier → Moon → planets → Caldwell.
  - The change was deliberate, so that "jupiter" finds the planet before "Jupiter's Ghost" (NGC 3242). It is recorded in `evidence/phase-4.md` and pinned by tests.
  - The plan was never amended, and these comments still describe the old order:
    - the `filterTargets` doc (target-search.ts:72-73), which also still cites "NGC 2244 (C 50)" at :68;
    - ObservationForm.tsx:40.
- **Fix**: Amend plan §4.3 with the real order and its reason, and correct both comments.
- **Decision**: FIXED — plan §4.3 amended (real order + reason, F1/F2 notes); filterTargets doc and ObservationForm comment corrected

### F4 — `?saved=` / `?logged=` notices show unknown keys

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/observations/redirect.ts (`readLogNotice`); `?logged=` handling on the Tonight pages
- **Detail**:
  - These notices check only the key's format. `/log?saved=NGC1` shows "NGC1 saved", while `/log/new?object=NGC1` correctly treats it as unknown.
  - It is harmless: the text is escaped, and only a hand-made URL can trigger it.
- **Fix**: Gate the notice key with `isKnownTarget`.
- **Decision**: SKIPPED — harmless (escaped text, only reachable through a hand-made URL)

### F5 — Polish landing kicker lowercases "Twoje / Twój"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/i18n/messages/pl.ts:77
- **Detail**:
  - The kicker went from "Twoje niebo, Twój sprzęt" to "twoje niebo, twój sprzęt". The plan specified the lowercase text.
  - The rest of `pl.ts` capitalises Twój/Twoje about 21 times.
- **Fix**: Restore the capitals: "Messier i Caldwell · Twoje niebo, Twój sprzęt".
- **Decision**: FIXED — capitals restored (pl.ts header rule: capitalised "Twój" in direct address)

### F6 — Progress 2.5 is still open: the calibration snapshot needs the user's sign-off

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 2.5; evidence/calibration.md
- **Detail**:
  - The seasonal top-10s and `MESSIER_RANK_BONUS = 0.03` are waiting for the user's review.
  - DB, smoke and e2e were not re-run in this review because Docker is down.
- **Fix**: The user reviews `evidence/calibration.md` and ticks 2.5. Re-run `test:db` and e2e after any F1/F2 fixes.
- **Decision**: PENDING — the user's sign-off on evidence/calibration.md (Progress 2.5); DB/e2e not re-run locally (Docker down), CI's smoke job runs test:db

## Triage summary

Triaged by the agent at the user's request ("fix them as you recommend").

- Fixed: F1, F2 (Fix A), F3, F5
- Skipped: F4
- Pending: F6 (user's calibration sign-off)
- After the fixes: vitest 809 passed, `astro check` 0 errors, eslint 0 errors, and `catalogue:build` is deterministic across two runs.
