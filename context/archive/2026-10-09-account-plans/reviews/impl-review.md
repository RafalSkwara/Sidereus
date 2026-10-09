<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Account plans (roadmap F-01)

- **Plan**: `context/changes/account-plans/plan.md`
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 8 observations
- **Reviewers**: two Opus agents (high effort): plan drift, and safety/patterns. Both read-only.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verification

- **Plan items:** all match. The extras are harmless: `parseArgs` also rejects `--generate` without `--create` and an email without `@`, and lower-cases the email.
- **Scope:** the "What We're NOT Doing" boundaries are respected. No UI, route, trigger, `app_metadata` or `set_plan` was added, and `src/middleware.ts` never reads the plan.
- **Privileges (local DB, `has_table_privilege`):** `anon` and `authenticated` hold no INSERT, UPDATE, DELETE or TRUNCATE on `account_plans`, and there are no column grants. `public` has no `security definer` function. `current_plan()` gives EXECUTE to `authenticated` only.
- **`--hosted` gate:** probed against `localhost.evil.com`, `127.0.0.1.nip.io`, `127.0.0.1@evil.com`, `evil.com#@127.0.0.1` and `localhost.`; every one was refused.
- **Tests:**
  - `src/lib/account-plan`: 6/6 passed.
  - The two new tests/db files: 25/25 passed.
  - Full `test:db` 135/135 and `npm test` 1459 passed (implementation run).
- **Manual 3.5** (owner grants full on production) is pending. It can only run after merge, once CI's `migrate` has created the table on the hosted project.

## Findings

### F1 — The runbook puts the hosted secret key in shell history

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `context/deployment/deploy-plan.md` (Account plans section)
- **Detail**: The runbook says `export SUPABASE_SECRET_KEY="sb_secret_..."`. Typing or pasting that writes the key into `~/.zsh_history`, which contradicts "never save it to a file".
- **Fix**: Use `read -rs SUPABASE_SECRET_KEY && export SUPABASE_SECRET_KEY` (no echo, no history), then `unset` after the command.
- **Decision**: FIXED

### F2 — A malformed `SUPABASE_URL` crashes with a stack trace (exit 1, not 2)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `scripts/account-plan.mjs:256-258`
- **Detail**: `main` calls `createClient(url, secretKey)` before `run()` validates the URL, so "Invalid supabaseUrl" escapes as an unhandled top-level rejection. The key is not in the message (verified).
- **Fix**: Parse and validate the URL in `main` before `createClient`, exiting 2 with the usage hint.
- **Decision**: FIXED

### F3 — User lookup assumes the server honours `perPage=1000`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `scripts/account-plan.mjs:91-98`
- **Detail**: The loop stops on a page shorter than 1000. If hosted GoTrue caps `per_page` lower, an existing account would read as unknown: exit 1, or a loud `email_exists` with `--create`. It fails safe, but wrongly.
- **Fix**: Stop on the response's `nextPage` / `lastPage` (or `total`) instead of the page length.
- **Decision**: FIXED

### F4 — Password mismatch or no TTY exits 1, the header calls them usage errors (2)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `scripts/account-plan.mjs:183-185, 198, 235`
- **Detail**: A short password exits 2, but a mismatch or a missing TTY ends in the generic failure path (1).
- **Fix**: Map prompt refusals (mismatch, no TTY) to exit 2.
- **Decision**: FIXED

### F5 — The per-request memo would cache a thrown read for the request

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/account-plan/index.ts:21-42`
- **Detail**: If `accountPlanStore.read` ever throws instead of returning `{ error: true }`, `requireFullPlan` rejects (a 500) instead of answering `needs-full`. postgrest-js reports network errors in `error`, so this is unlikely.
- **Fix**: In `store.ts`, catch a thrown client error and return `{ error: true }`. That keeps the store's contract ("never thrown") and the fail-closed read.
- **Decision**: FIXED

### F6 — The hidden prompt treats only DEL as backspace

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `scripts/account-plan.mjs:216-222`
- **Detail**: `^H` (0x08) and escape sequences end up in the password. The confirm-twice check usually catches it.
- **Fix**: Treat `\b` like DEL and ignore other control characters.
- **Decision**: FIXED

### F7 — REFERENCES and TRIGGER are still granted on `account_plans`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20261009120000_account_plans.sql:29`
- **Detail**: These can't be used through PostgREST, which has no DDL path. Least privilege says revoke them too. The migration has not reached the hosted project yet, so editing it is safe.
- **Fix**: `revoke all on public.account_plans from anon, authenticated; grant select on public.account_plans to authenticated;`. Keep the `42501` tests.
- **Decision**: FIXED

### F8 — Signed-out users get `needsFull` from `requireFullPlan`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/lib/account-plan/index.ts:54-55`
- **Detail**: This is as planned. S-03's routes should send a signed-out user to sign-in (the middleware gate) rather than show "needs the full plan".
- **Fix**: No code change now; note it for S-03 in the roadmap's S-03 block.
- **Decision**: ACCEPTED — no code change; note added to roadmap S-03

### F9 — tests/db copies the setup helpers a third time

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `tests/db/account-plans.test.ts:38-58`
- **Detail**: `newClient` / `signUp` repeat `isolation.test.ts` (as every tests/db file does today), and the emails use the `isolation-` prefix.
- **Fix**: Leave the shared helper for test rollout Phase 4; fix the email prefix now.
- **Decision**: FIXED (email prefix); shared helper left for test rollout Phase 4
