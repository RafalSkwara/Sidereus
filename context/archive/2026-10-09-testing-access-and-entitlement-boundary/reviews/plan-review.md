<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Test rollout Phase 4: access and entitlement boundary

- **Plan**: context/changes/testing-access-and-entitlement-boundary/plan.md
- **Mode**: Deep
- **Date**: 2026-10-09
- **Verdict**: REVISE → SOUND after triage (F1–F4 fixed)
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

- **Plan paths:** 9/9 ✓.
- **Symbols:** 5/5 ✓ (`gearConfig`, `TABLES`, `issueKey`, `errors.site.latitudeRange`, `requireFullPlan`).
- **Brief↔plan:** ✓.
- **Progress↔phases:** ✓ (16 rows, every criterion mapped).
- **Deep verification (Opus agent, local Supabase 2.117.0, SELECT-only):**
  - all 4 `public` functions pass the planned function check;
  - the 5 per-user tables have exactly 4 `{authenticated}` policies, and `pg_policies` renders `(( SELECT auth.uid() AS uid) = user_id)`;
  - `public` holds only the 6 tables, with no views;
  - anon INSERT returns `42501` (HTTP 401) and creates no row;
  - `DB_URL` is the env key on 2.117.0;
  - repo-wide `no-console` newly fails exactly the 3 planned test lines;
  - the ESLint config loads in a Vitest worker, and 327 lookups take ~25 ms after load.

## Findings

### F1 — Stale references to `TABLES` and `gearConfig` not listed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §1, Phase 2 §1/§5
- **Detail**: Moving `TABLES` and retiring `gearConfig` leaves these places describing the old layout, and the plan doesn't list them:
  - `CLAUDE.md:20`: per-user table tripwire, "`TABLES` in `tests/db/isolation.test.ts`";
  - `tests/db/isolation.test.ts:9`: "add an entry to `TABLES` below";
  - `tests/db/account-plans.test.ts:11`;
  - `src/lib/engine/purity.test.ts:10`: "outside eslint's `gearConfig.files`";
  - `src/lib/tonight/visibility-invariants.test.ts:42-43`: "error under `src/lib/tonight/**`".

  `context/handoff.md:39` is session state, refreshed at wrap-up.
- **Fix**: List these edits in Phase 1 §1 (the `TABLES` references, the CLAUDE.md:20 tripwire with `SERVER_OWNED`) and Phase 2 §5 (the `gearConfig` and per-directory references).
- **Decision**: FIXED (fix applied to plan.md, 2026-10-09)

### F2 — Guard test contract misses four verified facts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §3
- **Detail**: The probe against ESLint 10.10.0 found four facts the contract doesn't account for:
  1. `calculateConfigForFile(...).rules["no-console"]` is the array `[2, {}]`, not `2` or `"error"`.
  2. A cold first config load took 10.5 s, over Vitest's 5 s default timeout.
  3. The guard's own source contains the "eslint-disable … no-console" pattern, so a naive counter counts itself.
  4. A bare `// eslint-disable-next-line` (no rule names) also silences `no-console`, but the planned counter only counts disables that name it. None exists in `src` today.
- **Fix**: In Phase 2 §3, specify:
  - read the severity as `rule[0]` (accepting `2` or `"error"`);
  - load the ESLint instance in `beforeAll` with `cwd` set to the repo root and a 30 s hook timeout;
  - exclude the guard's own file from the count, or build the pattern so it can't match itself;
  - count rule-less `eslint-disable` comments as violations too.
- **Decision**: FIXED (fix applied to plan.md, 2026-10-09)

### F3 — A NULL `proacl` means PUBLIC can execute

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §2 (functions)
- **Detail**: Postgres stores the default function ACL as NULL, which grants EXECUTE to PUBLIC. A check that only searches `proacl` for a `=X/` entry passes such a function. In practice anon is caught by `has_function_privilege` (Supabase's default privileges grant anon), but the PUBLIC clause as written would be vacuous for NULL.
- **Fix**: Check PUBLIC with `has_function_privilege('public', oid, 'EXECUTE')`, or treat `proacl IS NULL` as a failure.
- **Decision**: FIXED (fix applied to plan.md, 2026-10-09)

### F4 — Small precision notes

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §3, Phase 2 §4
- **Detail**:
  - anon INSERT comes back as HTTP 401 with `error.code === "42501"`, so assert the code, not the status.
  - The gear smoke expectation should say `exact: true` explicitly, like the onboarding one.
  - `DB_URL` was confirmed on CLI 2.117.0 only; CI's 2.119.0 is proven by the PR's CI run (already in the brief's risks).
- **Fix**: Add the 401/code note to Phase 1 §3 and `exact: true` to the gear case in Phase 2 §4.
- **Decision**: FIXED (fix applied to plan.md, 2026-10-09)
