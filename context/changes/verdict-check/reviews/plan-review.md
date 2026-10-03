<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Verdict check

- **Plan**: context/changes/verdict-check/plan.md
- **Mode**: Deep
- **Date**: 2026-10-03
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 0 critical, 5 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
9/9 paths ✓, symbols ✓ (`skyHeadline` is a formatter method, not a free function), brief↔plan ✓, Progress 21/21 rows ✓

## Triage note
The user's standing preference is to be asked only about UI decisions, so every finding below is non-UI and was fixed with the recommended option, recorded as delegated.

## Findings

### F1 — Sky checks page would list tonight's night before it happens

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 store `list`/`answer`, Phase 3 route
- **Detail**: Opening Tonight records that evening's night at once. `list` filtered only by headline, so `/log/sky` would offer answer buttons for a night that hadn't started, and the route would accept an answer for it.
- **Fix**: `list` adds `dark_start < now`. `answer` and `skip` update only `where dark_start < now`, and a row before dark reads as not found. A DB test was added.
- **Decision**: FIXED (delegated)

### F2 — The card's query adds a sequential DB round trip to Tonight

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 §2
- **Detail**: loadTonight runs its four reads in `Promise.all` (`load.ts:~103-108`), and nothing in TonightContent queries after it. `pendingFor` after loadTonight would have been Tonight's first sequential DB call.
- **Fix A ⭐ Recommended**: An opt-in `withSkyChecks` fifth read (`openRecent`, `night >= UTC today − 3`) inside the same `Promise.all`, plus a pure `pendingCheck` that selects by site and the `[date−2, date)` window.
  - Strength: No added latency; reuses `load()`'s failure isolation.
  - Tradeoff: Touches the shared loader (opt-in).
  - Confidence: HIGH — same shape as `listForRanking`.
  - Blind spot: None significant.
- **Fix B**: Keep the sequential call and measure it.
  - Strength: Simplest.
  - Tradeoff: One Supabase round trip on every Tonight view.
  - Confidence: MED.
  - Blind spot: Workers→Supabase latency is unmeasured.
- **Decision**: FIXED via Fix A (delegated)

### F3 — plpgsql parameter names collide with column names

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §1
- **Detail**: The parameters `site_id`, `night`, `headline` and `dark_start` shadow the columns, so `on conflict (cols)` and the WHERE clause would raise "column reference is ambiguous".
- **Fix**: Use `on conflict on constraint sky_checks_user_site_night_key` and qualify the parameters as `record_sky_verdict.<name>`, as `complete_onboarding` does.
- **Decision**: FIXED (delegated)

### F4 — Playwright has no Supabase credentials for seeding

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §3
- **Detail**: The CI e2e step sets only `BASE_URL`, `playwright.config.ts` loads no env, and nothing in `tests/e2e` reads `SUPABASE_*`.
- **Fix**: The CI e2e step sources `supabase.env` and exports `SUPABASE_URL`/`SUPABASE_KEY`; the same for the local recipe. The helper reuses the `tests/db` missing-env guard.
- **Decision**: FIXED (delegated)

### F5 — `defer` is not in scope in TonightContent

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §2
- **Detail**: `defer` is only an inline arrow in loadTonight's options (`TonightContent.astro:57-59`), typed `(task: Promise<void>) => void` (`load.ts:44`).
- **Fix**: Hoist it into a `const defer` shared by both calls; `record` resolves to `Promise<void>`.
- **Decision**: FIXED (delegated)

### F6 — Tests that deep-equal headlines, and the first plain Astro POST form

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1, Phase 3 §3
- **Detail**: Adding `id` breaks toEqual checks at `format.test.ts:207-208` and `build.test.ts:225,244,255,359`. Every POST form today is a React island. A plain `.astro` form works under the default `checkOrigin`, but it is new.
- **Fix**: List the tests in Phase 2. State the plain-form shape (named submit buttons, hidden `from`) in Phase 3 §3.
- **Decision**: FIXED (delegated)
