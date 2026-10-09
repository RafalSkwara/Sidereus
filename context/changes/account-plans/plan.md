# Account plans (roadmap F-01) Implementation Plan

## Overview

Every account gets a free or full plan (PRD FR-045). The server stores and enforces it, and the operator can create a full account, or move one to full and back, with one command (FR-046).

F-01 ships the foundation only:
- the plan table and its SQL helper;
- a lazy server-side reader and guard;
- the operator command;
- the tests that prove nobody can grant themselves the full plan.

Nothing is visible in the UI. The "needs the full plan" state and the first full-plan route arrive with S-03 (roadmap `context/foundation/roadmap.md:90`).

## Current State Analysis

- **No plan code exists anywhere** (research, Summary).
- **Isolation is RLS-only and the app has no service role.**
  - Five per-user tables have four policies each.
  - Three RPCs are `security invoker` with `search_path = ''` (`supabase/migrations/20261003120000_sky_checks.sql:81-82, 110-111`).
- **Supabase grants every new `public` table full privileges for `anon` and `authenticated`, and EXECUTE on new functions** (local `pg_default_acl`, verified). A server-owned table therefore needs explicit revokes.
- **A revoked write fails loudly:** it returns `42501 permission denied`, not a silent 0-row update. This was verified in SQL in a rolled-back transaction, and through PostgREST on the revoked `sky_check_tally` EXECUTE.
- **The middleware resolves the user from JWT claims on every request, including every server-island GET** (`src/middleware.ts:13-35`, `src/lib/tonight/island.ts:32-41`). `App.Locals` is declared in `src/env.d.ts:1-8`.
- **tests/db uses the anon key only.** Each file repeats the same setup block (`tests/db/isolation.test.ts:17-45` and three more). CI exports only `API_URL` and `ANON_KEY` (`.github/workflows/ci.yml:44-48`).
- **`npx supabase status -o env` also prints `SECRET_KEY`** (`sb_secret_…`, verified on CLI 2.117; CI pins 2.119.0).
  - supabase-js 2.116 sends it as `apikey` and never as a Bearer token.
  - It bypasses RLS on PostgREST and works for `auth.admin.*` (verified).
- **Scripts are zero-dependency `.mjs` files** with a usage header (`scripts/smoke.mjs:1-5`). They are linted without type checks, with `no-console` off (`eslint.config.js:76-81`), and no test imports from `scripts/` today.

## Desired End State

- **Storage:** `public.account_plans(user_id, plan, updated_at)` exists. An account without a row is free.
  - A signed-in user can read only their own row and gets `42501` on any insert, update, upsert or delete.
  - `public.current_plan()` returns the caller's plan (`'free'` when there is no row), for future full-plan tables and RPCs.
- **Server code reads the plan through `getAccountPlan(locals)`.** It queries at most once per request and only when called; it never runs in the middleware.
  - `requireFullPlan(locals)` returns a typed refusal carrying the fixed key `errors.accountPlan.needsFull`.
- **`npm run account:plan -- <email> full|free|show [--create] [--dry-run]`** changes or shows an account's plan against the project in `SUPABASE_URL`.
  - The key comes from `SUPABASE_SECRET_KEY` in the operator's shell.
  - `--create` makes a new confirmed account with a password typed at a hidden prompt, or `--generate` prints a random one once.
- **Verification:**
  - `npm run test:db` (with the local `SECRET_KEY`) proves the boundary;
  - `npm test` proves the guard;
  - CI's smoke job runs both;
  - CLAUDE.md documents the read-only-table exception and the operator command.

### Key Discoveries:

- Policy pattern `(select auth.uid()) = user_id`, one policy per operation: `supabase/migrations/20260924120000_sites_and_gear.sql:25-42`.
- Function security conventions (invoker, `search_path = ''`, revoke from public/anon, grant to authenticated): `supabase/migrations/20261003120000_sky_checks.sql:81-82, 110-111, 118-130`.
- The `TABLES` `describe.each` positive control writes as the owner and expects an `id` column (`tests/db/isolation.test.ts:127-155`). That can't apply to a read-only table, so it gets its own file.
- `.dev.vars` is copied into `dist/server/.dev.vars` by the build (`ci.yml:52-62` writes it from named vars only). The secret key must never reach that file, `.env`, the astro:env schema or wrangler secrets (`context/deployment/deploy-plan.md:62`).
- The repo already uses module-level `WeakMap`s keyed by objects (`src/lib/toasts.ts:32`, `src/lib/gear/catalogue/search.ts:29`). The per-request memo follows that, and `env.d.ts` stays unchanged.
- "Plan" already means the Session plan (`src/i18n/messages/en.ts:878`, `/tonight/plan`), so code and keys say `accountPlan`.

## What We're NOT Doing

- **No visible plan anywhere in the UI**, and no "needs the full plan" state. That is S-03 (owner decision 2026-10-09).
- **No full-plan route, and no dummy route to test against.** The HTTP refusal is first tested with S-03's route; test Phase 4 generalises it.
- **No sign-up trigger on `auth.users` and no backfill.** A missing row reads as free.
- **No `app_metadata` or JWT claim for the plan,** and no custom access-token hook (stale up to `jwt_expiry` 3600 s).
- **No SQL `set_plan` function in `public`.** Writes go only through the secret key.
- **No admin UI, payments, trials or plan history** (PRD Non-Goals `prd.md:653-657`).
- **No offline-copy change.** Copies hold only the user's own data, and plan-dependent offline content is OQ23 / S-08.
- **No broader isolation work:** anon I/U/D on existing tables, 42501 on all tables, the structural policy check, and the lint-scope guard all stay in test rollout Phase 4 (owner decision 2026-10-09).
- **The agent never runs the command against the hosted project.** The owner runs it with the hosted secret key (`deploy-plan.md:62`).

## Implementation Approach

Build bottom-up, so each phase is provable on its own:

1. **Schema and boundary tests.** The database is the enforcer, so it lands first with tests that try to self-grant.
2. **The server reader and guard.** Pure and unit-tested, with the DB call behind a small seam.
3. **The operator command and docs.** Its logic is in exported functions that a tests/db test drives against local Supabase.

The migration is additive, so it stays backward compatible while CI's `migrate` runs before `deploy` (`ci.yml:85-111`).

## Critical Implementation Details

- **Revoke, don't just omit policies.** Without `revoke insert, update, delete, truncate on public.account_plans from anon, authenticated`, an owner's write is a silent 0-row result and the tests can't tell refusal from no-op. Also revoke `execute on function public.current_plan()` from `public, anon`, because functions default to EXECUTE for everyone.
- **The secret key never goes into a file the build copies.** In CI, extend only the `supabase.env` grep and the `test:db` line. The step that writes `.env` / `.dev.vars` (`ci.yml:59-62`) must stay on its named variables.

## Phase 1: Plan table, SQL helper and boundary tests

### Overview

Add the server-owned plan table and `current_plan()`, regenerate the DB types, and prove in tests/db that no signed-in user or anonymous caller can grant or alter a plan. Wire CI to give `test:db` the local secret key.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_account_plans.sql`

**Intent**: Create the plan table, which only the secret key can write, and the read helper future full-plan tables and RPCs will call.

**Contract**:
- **Table:** `public.account_plans`
  - `user_id uuid primary key references auth.users(id) on delete cascade`
  - `plan text not null check (plan in ('free','full'))`
  - `updated_at timestamptz not null default now()`
- **RLS:** enabled. Exactly one policy, `account_plans_select_own` (`for select to authenticated using ((select auth.uid()) = user_id)`).
- **Grants:** `revoke insert, update, delete, truncate … from anon, authenticated`.
- **Function:** `public.current_plan() returns text language sql stable security invoker set search_path = ''`. It returns `coalesce((select p.plan from public.account_plans p where p.user_id = (select auth.uid())), 'free')`.
  - `revoke execute … from public, anon`
  - `grant execute … to authenticated`
- A comment block states that a missing row means free and that writes are operator-only.

#### 2. Generated types

**File**: `src/lib/database.types.ts`

**Intent**: Regenerate with `npm run db:types` against local Supabase so CI's drift check passes.

**Contract**: generated only; never hand-edited.

#### 3. Boundary tests

**File**: `tests/db/account-plans.test.ts` (new)

**Intent**: Prove the boundary with a positive control, following the same per-file setup block as the other tests/db files, plus an admin client from `SUPABASE_SECRET_KEY`.

**Contract**:
- **Env check:** throws with the `npx supabase status -o env` hint (use `SECRET_KEY`) when the secret key is missing.
- **Users:** A and B are signed up as in `isolation.test.ts:36-45`. The admin upserts A = `full`.
- **Cases:**
  1. A selects its own row and sees `full`; `rpc('current_plan')` returns `full` (positive control).
  2. B has no row, and `current_plan()` returns `free`.
  3. A's insert, update, upsert and delete on `account_plans` each fail with `error.code === "42501"`, and the admin's re-read shows A still `full` with `updated_at` unchanged.
  4. B's insert of a `full` row for B fails with `42501`.
  5. B selects A's row and gets nothing.
  6. Anon selects nothing, and anon `rpc('current_plan')` is refused with `42501`.
  7. The admin sets A back to `free`, and A's `current_plan()` reads `free` on the next call. This proves the change takes effect immediately.

#### 4. CI

**File**: `.github/workflows/ci.yml`

**Intent**: Give `test:db` the local secret key without letting it reach any file the app reads.

**Contract**:
- The `supabase.env` grep at `:44` also takes `SECRET_KEY`.
- The `test:db` line at `:48` adds `SUPABASE_SECRET_KEY="$SECRET_KEY"`.
- Lines `:59-62` are unchanged.

### Success Criteria:

#### Automated Verification:

- Migration applies on a fresh local stack: `npx supabase db reset` once (local only; it wipes every local account and row, so iterate with `npx supabase migration up`, plan review F5)
- Generated types match the schema: `npm run db:types && git diff --exit-code src/lib/database.types.ts` after committing the regenerated file
- The new boundary suite passes and the existing ones stay green: `SUPABASE_URL=… SUPABASE_KEY=… SUPABASE_SECRET_KEY=… npm run test:db`
- Break check: re-granting `update` to `authenticated` in a scratch local migration makes case 3 fail (reverted, not committed)
- Type check and lint pass: `npx astro check` and `npx eslint . --ignore-pattern '.claude/**'`

#### Manual Verification:

- The migration file reads as additive only (no change to existing tables or policies), so it is safe to run before the old app is replaced

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Server-side reader and guard

### Overview

Add a server-only module that pages and routes use to read the account plan lazily and to refuse free accounts, plus the fixed error key future full-plan routes will redirect with.

### Changes Required:

#### 1. Account-plan module

**Files**: `src/lib/account-plan/store.ts` and `src/lib/account-plan/index.ts` (new; unit tests in `account-plan.test.ts` next to them)

**Intent**: One place owns the rule "anything unknown is free", the per-request memo and the refusal shape. Callers never query `account_plans` themselves. The split follows the repo's store seam (`src/lib/sky-checks/store.ts:51-63`; unit tests mock the store as `src/lib/tonight/load.test.ts:25-48` does, and the query itself is covered by tests/db) (plan review F3).

**Contract**:
- `store.ts`: `accountPlanStore.read(client: TypedSupabaseClient, userId: string): Promise<{ plan: unknown } | { error: true }>` selects the user's own row. Phase 1's tests/db already exercise this query shape.
- `index.ts` imports the client type with `import type` only (`src/lib/supabase.ts` imports `astro:env/server`, which plain vitest can't resolve).
- `type AccountPlan = "free" | "full"`.
- `planFrom(raw: unknown): AccountPlan`: pure; `"full"` only for exactly `"full"`, else `"free"`.
- `getAccountPlan(locals: App.Locals): Promise<AccountPlan>`:
  - returns `"free"` without a query when `locals.supabase` or `locals.user` is null;
  - otherwise calls `accountPlanStore.read` once and memoises the promise in a module-level `WeakMap<App.Locals, …>`;
  - a query error reads as `"free"` (fail closed), and the module never logs.
- `requireFullPlan(locals): Promise<{ ok: true } | { ok: false; reason: "signed-out" | "not-configured" | "needs-full"; errorKey: MessageKey }>`:
  - `errorKey` is `NOT_CONFIGURED` for not-configured and `ACCOUNT_PLAN_NEEDS_FULL` otherwise.
  - Future routes redirect with `?error=<errorKey>` per the repo's error shape; pages render S-03's description state instead.
- Server-only: no island imports it (same rule as `gear/store.ts`).

#### 2. Error key

**Files**: `src/lib/api-errors.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Add the fixed refusal key so S-03's routes have a catalogue entry from day one.

**Contract**:
- `export const ACCOUNT_PLAN_NEEDS_FULL: MessageKey = "errors.accountPlan.needsFull"`.
- EN: "This needs the full plan."
- PL: "To wymaga pełnego planu."
- The parity test covers both.

#### 3. Unit tests

**File**: `src/lib/account-plan/account-plan.test.ts`

**Intent**: Pin the defaults and the refusal without a database.

**Contract**:
- `planFrom` cases: `"full"`, `"free"`, `null`, `undefined`, `"FULL"`, `{}`.
- `getAccountPlan`:
  - not-configured and signed-out return `"free"` with zero queries;
  - two calls on the same locals make one query;
  - an error from the stubbed client returns `"free"`.
- `requireFullPlan`: free → `needs-full` with `errors.accountPlan.needsFull`; full → `ok`; signed-out → `signed-out`; null client → `not-configured` with `errors.notConfigured`.
- `accountPlanStore` is mocked with `vi.mock` and the client is `{} as TypedSupabaseClient`, as in `src/lib/tonight/load.test.ts`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run src/lib/account-plan src/lib/api-errors.test.ts src/i18n`
- Full unit suite stays green: `npm test`
- Break check: making `planFrom` return `"full"` for a missing value turns the suite red (reverted)
- Type check and lint pass: `npx astro check` and `npx eslint . --ignore-pattern '.claude/**'`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Operator command and documentation

### Overview

Add the one command that creates a full account or moves an account between plans, test it against local Supabase, and document the plan, the command and the key-handling rules.

### Changes Required:

#### 1. Command

**File**: `scripts/account-plan.mjs` (new); `package.json` (`"account:plan": "node scripts/account-plan.mjs"`)

**Intent**: Let the operator run `npm run account:plan -- <email> full|free|show [--create] [--dry-run] [--generate] [--hosted]`. Its logic is exported so a test can drive it with injected clients and I/O.

**Contract**:
- **Header comment:** usage and the key rule.
- **Exports:**
  - `parseArgs(argv)`: pure; rejects unknown actions or flags and `--create` with `free`/`show`.
  - `run({ admin, email, action, create, dryRun, generate, readPassword, out })`: returns an exit code.
- **Typing (plan review F2):** `parseArgs` and `run`'s options carry JSDoc types. `parseArgs` returns a typed union, `{ ok: false, error }` or `{ ok: true, email, action, … }`, so the type-checked lint on `tests/db/**/*.ts` accepts the import. No `.d.mts` is needed.
- **Main:** guarded by `import.meta.url === pathToFileURL(process.argv[1]).href`. Env reads happen inside `main`, never at module top level.
- **Credentials (plan review F1):**
  - The URL comes from `SUPABASE_URL` in the shell only. There is no `.env` fallback, because the repo's `.env` points at the hosted project.
  - The key comes from `SUPABASE_SECRET_KEY` in the environment only. Without either variable, the script exits 2 with a hint. It never reads `.env` or `.dev.vars`.
  - A host other than `127.0.0.1` / `localhost` is refused (exit 2) unless `--hosted` is passed.
  - The target host is printed before any write.
- **Look-up by email:** pages through `auth.admin.listUsers` and compares the email case-insensitively.
- **Behaviour:**
  - `show` prints `<email> (<user id>) on <host>: free|full`.
  - `full` / `free` upsert `{ user_id, plan, updated_at: now }`. Demote keeps the row with `plan = 'free'`.
  - Re-running with the same plan prints `no change` and exits 0.
  - An unknown email without `--create` exits 1.
  - `--create` with `full` calls `auth.admin.createUser({ email, password, email_confirm: true })` and then upserts `full`.
  - `--create` on an email that already exists asks for no password. It prints `account exists` and continues as plain `full`, so a re-run completes a create whose upsert failed (plan review F4). The password comes from a hidden TTY prompt (asked twice, must match, minimum 12 characters) or, with `--generate`, a random 20-character password printed exactly once.
  - `--dry-run` prints the intended `old → new` and writes nothing.
- **Output:** always names the target host. It never prints the key, tokens or a typed password.
- **Lint:** add `crypto` / `URL` to the scripts' globals in `eslint.config.js:76-81` only if used.

#### 2. Command test

**File**: `tests/db/account-plan-command.test.ts` (new)

**Intent**: Prove the command against local Supabase without a TTY by calling the exported `run` with a real admin client, a stubbed `readPassword` and a captured `out`.

**Contract**:
- **Cases:**
  - `--create full` makes a confirmed account that can sign in with the stubbed password and whose `current_plan()` is `full`;
  - `free` then `full` toggles it, each visible on the next `current_plan()`;
  - a repeat prints `no change`;
  - `--dry-run` leaves the row unchanged;
  - an unknown email exits 1;
  - `--create` on an existing account prints `account exists`, sets `full` and never calls `readPassword`;
  - a non-local URL without `--hosted` exits 2 before any admin call;
  - `show` prints the plan.
- **Output check:** no secret-key or password string appears in the output (except `--generate`'s single line, which is asserted separately).
- **Pure unit cases:** `parseArgs` is tested in the same file.

#### 3. Documentation

**Files**: `CLAUDE.md`, `context/deployment/deploy-plan.md`, `README.md` (only if it lists npm scripts)

**Intent**: Make the new contracts discoverable for the next agent and the operator.

**Contract**:
- **CLAUDE.md:**
  - `:20` tripwire: a server-owned read-only table revokes writes and gets its own tests/db file instead of a `TABLES` entry.
  - Commands: `test:db` needs `SUPABASE_SECRET_KEY` (the local `SECRET_KEY`); add `npm run account:plan`.
  - Env (`:56`): the secret key lives in the operator's shell only.
  - Request flow / Data access (`:62, :66`): the plan is read lazily via `src/lib/account-plan/`, never in the middleware; full-plan routes use `requireFullPlan`.
  - Conventions (`:109`): server-owned tables revoke writes from anon and authenticated.
- **deploy-plan.md:** how the owner grants full on production. Export the hosted `sb_secret_` key in the shell for one command, never save it to a file, and note that the agent never holds it.

### Success Criteria:

#### Automated Verification:

- Command tests pass against local Supabase: `SUPABASE_URL=… SUPABASE_KEY=… SUPABASE_SECRET_KEY=… npm run test:db`
- Lint passes (scripts config included): `npx eslint . --ignore-pattern '.claude/**'`
- Without `SUPABASE_SECRET_KEY` the command exits 2 with the hint: `npm run account:plan -- someone@example.com show`
- Unit suite and type check stay green: `npm test`, `npx astro check`

#### Manual Verification:

- Owner runs `npm run account:plan -- <own email> full --hosted` against production with the hosted URL and secret key exported in the shell, then `show --hosted` reports `full`
- `--create` on a local stack prompts twice without echoing the password, and the new account signs in on a local preview

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `planFrom` defaults, the per-request memo (one query) and the fail-closed read in `getAccountPlan`.
- `requireFullPlan` reasons and error keys.
- `parseArgs` of the command (in the tests/db command file, next to its integration cases).

### Integration Tests:

- tests/db boundary:
  - positive control (admin-seeded `full`, read by the owner and through `current_plan()`);
  - self-writes refused with `42501` and the row proven unchanged;
  - cross-user and anon reads empty;
  - an immediate effect after the admin's change.
- tests/db command: create, toggle, idempotent repeat, dry run, unknown email, show, no secrets in output.

### Manual Testing Steps:

1. On a local stack, run `npm run account:plan -- tester@example.com full --create`, type a password twice, and sign in with it on a local preview.
2. Run `show`, then `free`, then `show` again. Each reflects the change immediately.
3. On production, the owner grants their own account `full` with `--hosted` and confirms with `show --hosted`.

## Performance Considerations

- The middleware does no plan lookup, so existing pages and server islands make no extra round trip.
- A future full-plan page pays one `account_plans` primary-key read per request (memoised across calls within the request).
- `current_plan()` is `stable`, and policies call it wrapped in `(select …)` so Postgres caches it per statement.

## Migration Notes

- Additive only: a new table and a new function, with no change to existing objects. Every existing hosted account reads as free with no backfill.
- Rollback: drop `current_plan()` and `account_plans`. No app code depends on them outside `src/lib/account-plan/`, which falls back to free on any error.

## References

- Research: `context/changes/account-plans/research.md`
- Isolation grounding and owner decisions: `context/changes/testing-access-and-entitlement-boundary/research.md` (branch `feat/testing-access-and-entitlement-boundary`)
- Policy pattern: `supabase/migrations/20260924120000_sites_and_gear.sql:25-42`
- Function security pattern: `supabase/migrations/20261003120000_sky_checks.sql:81-130`
- tests/db setup pattern: `tests/db/isolation.test.ts:17-45`
- Script convention: `scripts/smoke.mjs:1-5`; lint scope `eslint.config.js:76-81`
- PRD: `context/foundation/prd.md:461-462, 614-618, 653-657`; roadmap F-01 `context/foundation/roadmap.md:80-91`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Plan table, SQL helper and boundary tests

#### Automated

- [x] 1.1 Migration applies on a fresh local stack
- [x] 1.2 Generated types match the schema
- [x] 1.3 The new boundary suite passes and the existing ones stay green
- [x] 1.4 Break check: re-granting update to authenticated makes case 3 fail
- [x] 1.5 Type check and lint pass

#### Manual

- [x] 1.6 The migration file reads as additive only

### Phase 2: Server-side reader and guard

#### Automated

- [ ] 2.1 Unit tests pass
- [ ] 2.2 Full unit suite stays green
- [ ] 2.3 Break check: planFrom returning full for a missing value turns the suite red
- [ ] 2.4 Type check and lint pass

### Phase 3: Operator command and documentation

#### Automated

- [ ] 3.1 Command tests pass against local Supabase
- [ ] 3.2 Lint passes (scripts config included)
- [ ] 3.3 Without SUPABASE_SECRET_KEY the command exits 2 with the hint
- [ ] 3.4 Unit suite and type check stay green

#### Manual

- [ ] 3.5 Owner grants own account full on production and show reports full
- [ ] 3.6 --create prompts without echo and the new account signs in on a local preview
