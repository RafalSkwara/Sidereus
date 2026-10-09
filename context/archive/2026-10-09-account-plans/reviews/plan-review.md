<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Account plans (roadmap F-01)

- **Plan**: `context/changes/account-plans/plan.md` (branch at d155c43)
- **Mode**: Deep (one Opus verifier, high effort)
- **Date**: 2026-10-09
- **Verdict**: REVISE → SOUND after fixes (owner: apply all five, 2026-10-09)
- **Findings**: 0 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

8/8 paths ✓. Symbols ✓: `WeakMap` precedents `src/lib/toasts.ts:32` and `src/lib/gear/catalogue/search.ts:29`, `scriptsConfig` `eslint.config.js:76-81`, `src/i18n/i18n.test.ts`. Brief↔plan ✓. Progress↔Phase ✓ (6/4/6).

Verified as stated:
- CI secret handling: `supabase.env` is only sourced, never exported, and `.env` / `.dev.vars` are written from named variables (`ci.yml:44-48, 60-62, 74-75`).
- The new error key has low blast radius: only the parity test applies (`i18n.test.ts:38-50`), and `api-errors.test.ts:3` imports named exports only.
- No structural table check exists that the new table could break.

## Findings

### F1 — The command's default target is the hosted project

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 §1 (Credentials)
- **Detail**:
  - The plan falls back to `process.loadEnvFile('.env')` for `SUPABASE_URL`, and the repo's `.env` points at the hosted `*.supabase.co` project (CLAUDE.md tripwire; verified host type only).
  - A developer who exports only a local secret key gets an auth error.
  - Worse, one with a hosted `sb_secret_` key still exported from an earlier production run would silently change production. The host is printed only after the write.
- **Fix**:
  - Drop the `.env` fallback and require `SUPABASE_URL` in the shell.
  - Refuse any non-local host (anything other than `127.0.0.1` / `localhost`) unless `--hosted` is passed.
  - Print the target host before any write.
  - Strength: production changes become a deliberate act, and local runs can't drift to hosted.
  - Tradeoff: one more flag for the owner's production run.
  - Confidence: HIGH. `loadEnvFile` not overriding shell variables was verified on Node 24.
  - Blind spot: none significant.
- **Decision**: FIXED

### F2 — Untyped `.mjs` exports turn lint red in the command test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §1–2
- **Detail**:
  - `tests/db/**/*.ts` falls under `strictTypeChecked` (`eslint.config.js:16-23`, confirmed via `--print-config`).
  - In a scratch experiment, using fields of an untyped `parseArgs(...)` result raised `no-unsafe-call` and `no-unsafe-member-access`, so criterion 3.2 would fail.
  - No `.ts` file imports a local `.mjs` today.
- **Fix**:
  - Give `parseArgs` and `run`'s options JSDoc types, with `parseArgs` returning a typed `{ok:false,error}` | `{ok:true,…}` union. In the experiment this passed tsc and ESLint with no `.d.mts`.
  - Keep `loadEnvFile` / env reads inside `main`, not at module top level.
- **Decision**: FIXED

### F3 — Phase 2 stubs a query chain instead of following the store seam

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 §1, §3
- **Detail**:
  - No unit test stubs a `from().select()…` chain today.
  - The repo pattern is a store that takes the client (`src/lib/sky-checks/store.ts:51-63`, `siteStore.list(supabase)`).
  - Unit tests mock the store and pass `{} as TypedSupabaseClient` (`src/lib/tonight/load.test.ts:25-48`), and the real query is covered by tests/db (`src/lib/observations/store.test.ts:4`).
  - `src/lib/supabase.ts:4` imports `astro:env/server`, so a value import breaks plain vitest.
- **Fix**:
  - Split the module: `store.ts` gets `accountPlanStore.read(client, userId)` (the query, covered by Phase 1's tests/db), and `index.ts` keeps `getAccountPlan` / `requireFullPlan` (null branches, memo, fail-closed), unit-tested with the store mocked.
  - Use `import type` for `TypedSupabaseClient`.
- **Decision**: FIXED

### F4 — `--create` for an existing email, and a half-finished create, are undefined

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §1 (Behaviour)
- **Detail**:
  - `createUser` followed by the upsert is not atomic: if the upsert fails, the account exists on free.
  - The plan doesn't say what a re-run with `--create` does when the email exists. `createUser` returns `email_exists`, and the command would exit with an error.
  - Recovery then depends on the operator knowing to drop `--create`.
- **Fix**:
  - `--create` on an existing email does not prompt for a password. It prints `account exists` and continues as plain `full` (idempotent), so a re-run completes a half-finished create.
  - Add this case to the command test.
- **Decision**: FIXED

### F5 — `db reset` wipes local accounts during iteration

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Success Criteria (1.1)
- **Detail**:
  - `npx supabase db reset` recreates the local DB with a comment-only `seed.sql` (`supabase/config.toml:60-65`), which wipes all local users and rows.
  - The repo has used `npx supabase migration up` to apply without loss (`context/archive/2026-10-06-deep-sky-beyond-messier/evidence/phase-5.md:10`; that change's `reviews/plan-review.md:70-71`).
- **Fix**:
  - Apply iteratively with `npx supabase migration up`.
  - Keep `db reset` only for the one fresh-stack check in 1.1, with a note that it wipes local accounts.
- **Decision**: FIXED
