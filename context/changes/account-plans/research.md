---
date: 2026-10-09T17:01:27+02:00
researcher: Claude (Opus 5.5) with three read-only Opus workers (high effort): DB storage and enforcement; app read path and operator command; requirements, history and tests
git_commit: 98f80b6
branch: feat/account-plans
repository: Sidereus
topic: "Ground roadmap F-01 account-plans: where the plan lives, how the server reads and enforces it, the operator command, and the tests it inherits"
tags: [research, auth, rls, supabase, entitlements, operator-script, testing]
status: complete
last_updated: 2026-10-09
last_updated_by: Claude (Opus 5.5)
---

# Research: account plans (roadmap F-01)

**Date**: 2026-10-09T17:01:27+02:00
**Researcher**: Claude (Opus 5.5) with three read-only Opus workers on high effort (owner instruction)
**Git Commit**: 98f80b6 (main 555ab0d plus the change folder)
**Branch**: feat/account-plans
**Repository**: Sidereus

## Research Question

Ground F-01 (`context/foundation/roadmap.md:80-91`; PRD FR-045/FR-046 `context/foundation/prd.md:461-462`, Access Control "Plans" `:614-618`): every account carries a free or full plan that pages and routes can read and the server enforces; the operator creates a full account, or moves one to full and back, with one command using the service credentials. Specifically:

- where the plan attribute lives, given that no column grants exist anywhere;
- how pages, routes and the middleware read it;
- how the operator command works;
- how new and existing accounts default to free;
- test patterns, and the Risk #5 plan half that test Phase 4 deferred to F-01.

## Summary

- **Recommended storage: a new table `public.account_plans`, where a missing row means free.** The owner gets select-own RLS only, write privileges are revoked from `anon` and `authenticated`, and only the operator's secret key writes it.
  - **Shape:** `user_id uuid primary key references auth.users(id) on delete cascade`, `plan text not null check (plan in ('free','full'))`, `updated_at`.
  - **Policy:** one select policy `to authenticated using ((select auth.uid()) = user_id)`.
  - **Revoke:** `revoke insert, update, delete, truncate … from anon, authenticated`. New public tables otherwise get full privileges for both roles by default (local `pg_default_acl`, verified), so the revoke turns a self-grant into `42501` instead of a silent 0-row write.
  - **Why it wins:**
    - A grant takes effect on the next request.
    - It needs no sign-up trigger, so sign-up cannot be broken.
    - Existing hosted users need no backfill.
    - The migration is additive, so it is safe while CI's `migrate` runs before `deploy` (`.github/workflows/ci.yml:86-88`).
- **Rejected alternatives:**
  - `app_metadata`: it is not user-writable (verified: `PUT /auth/v1/user {app_metadata}` → 403 `not_admin`), but it reaches the app only through the JWT. The middleware reads `getClaims()` (`src/middleware.ts:15`) with `jwt_expiry = 3600` (`supabase/config.toml:158`), so a downgrade would keep working for up to 1 h.
  - A custom access-token hook: same staleness, plus separate hosted configuration.
  - A column on an existing table: all five per-user tables hold several rows per user, and column privileges are not used in this repo (owner decision 2026-10-09: no server-owned column on an owner-writable table without hardening).
  - `user_metadata`: user-writable (verified, 200).
- **Read path: lazy, not in the middleware.** The middleware runs on every SSR request, server-island GET and POST (`src/middleware.ts:31-35`; islands guard themselves, `src/lib/tonight/island.ts:32-41`). Resolving the plan there would add a PostgREST round trip to every one of them. Instead:
  - a server-only `src/lib/account-plan/` (name avoids the existing "Session plan" meaning, e.g. `src/i18n/messages/en.ts:878`, `/tonight/plan`) holds `type AccountPlan = "free" | "full"`;
  - a pure `planFrom(raw)` reads anything unknown or missing as free;
  - a per-request memoised `getAccountPlan(locals)` returns free when `locals.supabase` or `locals.user` is null;
  - `requireFullPlan(locals)` returns a typed refusal for routes.
- **SQL helper for future paid tables and RPCs:** `public.current_plan()` is `stable security invoker set search_path = ''`, matching the repo's three functions (`supabase/migrations/20260926120000_complete_onboarding.sql:29-30`, `20261003120000_sky_checks.sql:81-82, 110-111`). It returns `coalesce(own row, 'free')`, with execute revoked from public and anon. Policies call it as `(select public.current_plan()) = 'full'`.
- **Operator command:** a zero-dependency Node script (repo convention, `scripts/smoke.mjs:1-5`) using supabase-js admin.
  - `auth.admin.createUser({email, password, email_confirm: true})` then upsert into `account_plans` for a new account; an upsert alone for an existing one.
  - The key comes only from the operator's shell (`SUPABASE_SECRET_KEY`, `sb_secret_…`), never from `.env`, `.dev.vars` (copied into `dist/server/.dev.vars` by the build), the astro:env schema or wrangler secrets. `context/deployment/deploy-plan.md:62` keeps the service key away from the app and the agent.
  - It is the only option that can also create the account: SQL cannot create an auth user properly, and it needs the DB password held only in CI (`ci.yml:96-100`).
- **Enforcement with no paid feature yet:** F-01 ships the guard, the SQL helper and their tests. No route is full-plan until S-03, and the "needs the full plan" UI state is S-03's (roadmap Risk line `:90`).
- **Tests inherited:**
  - tests/db: no self-grant via PostgREST, with a positive control seeded by an admin client;
  - `current_plan()`: free without a row, full with one;
  - cross-user and anon see nothing;
  - the operator command against local Supabase;
  - a server-side refusal check that never goes through the UI.
  - tests/db today uses only the anon key (`tests/db/isolation.test.ts:17-25`; CI greps only `API_URL|ANON_KEY`, `ci.yml:44`), so a test-only admin client and a CI env extension are needed.
  - The `TABLES` `describe.each` can't take a read-only table as-is: its positive control writes the owner's own row (`tests/db/isolation.test.ts:127-155`). That needs a variant, and the CLAUDE.md tripwire needs updating.

## Detailed Findings

### Storage options (DB worker; local DB catalogs read via `docker exec`)

| Option | Self-grant via PostgREST/RPC | Default free | Freshness | Verdict |
|---|---|---|---|---|
| 1a. Table, select-own, no write grants, no row = free | blocked (no write policy + revoked grants; repo RPCs are invoker) | by construction, no backfill | immediate | **recommended** |
| 1b. 1a + `after insert on auth.users` definer trigger | blocked | needs backfill for existing users | immediate | works; adds a sign-up failure point ("If the trigger fails, it could block signups", Supabase docs) for no gain |
| 2. `raw_app_meta_data.plan` | blocked (403 `not_admin`, verified) | missing = free in code | stale ≤ `jwt_expiry` 3600 s | viable; stale downgrades |
| 3. Custom access-token hook | blocked if it reads a protected table | as 1a | stale until refresh | extra moving part; hook commented out (`supabase/config.toml:266-269`) |
| 4. Column on an existing table | allowed unless table-level UPDATE revoked | — | immediate | rejected (no per-account table; Supabase advises against column privileges) |

- **Default privileges (verified, local):** new `public` tables grant `arwdDxtm` to `anon` and `authenticated`, and new functions grant EXECUTE to both. So a `set_plan` function in `public` must not exist, and RLS without the revoke would be the only barrier. Hosted is expected to match but is unverified; RLS with no write policy holds either way.
- **No trigger on `auth.users` exists today** (pg_trigger query). `supabase/seed.sql` holds comments only.
- **"Back to free":** either `update … set plan = 'free'` (keeps a row and `updated_at`) or delete the row. Both read as free. This is a plan-level choice.

### Read path and guard (app worker)

- **Middleware today:** one client per request (`src/middleware.ts:31-33`). `locals.user` comes from `getClaims()` as `{id, email}` (`:13-21, 35`; `SessionUser` at `src/lib/supabase.ts:12-15`; `Locals` at `src/env.d.ts:2-7`). The gate is `isProtectedPath` (`src/lib/protected-routes.ts:5-17`). Unconfigured Supabase makes `createClient()` return null (`src/lib/supabase.ts:24-27`).
- **Server islands:** each one is a separate GET through the middleware (`src/pages/tonight.astro:43-47`, `src/lib/tonight/island.ts:32-41`). One Tonight view runs the middleware at least twice. That is inferred from island.ts and the island GET, not measured.
- **Refusals in routes** follow the repo's error shape: a redirect with `?error=<key>`, never JSON (`src/lib/api-errors.ts:4-12`; CLAUDE.md "Error-response shape"). A fixed key such as `errors.accountPlan.needsFull` in en.ts and pl.ts (parity test) would serve future paid POST routes. Pages render the S-03 "needs the full plan" state instead of an error (FR-045).
- **Offline:** copies are keyed by an owner fingerprint, not by plan (`src/components/tonight/OfflineCopy.astro:32`, `src/lib/offline/copies.ts:39-45, 97-102`). F-01 renders no plan-dependent content, so it needs no SW change (inferred). A stored paid page after a downgrade is PRD OQ23 (`prd.md:740-742`), routed to S-08.
- **Where a plan name could be shown** (candidates only; the roadmap does not require showing it):
  - the settings popover's account section next to the email (`src/components/TopbarControls.tsx:209-212`);
  - the /gear hub.
  - Showing it would add i18n keys and is a UI decision.

### Operator command (app worker)

- **Repo conventions:**
  - `.mjs` scripts with a usage header and npm script aliases (`scripts/smoke.mjs`, `package.json` `smoke`).
  - `no-console` is off for `scripts/**/*.mjs` (`eslint.config.js:76-80`).
  - Node 24.21 (`.nvmrc`) has `util.parseArgs` and `process.loadEnvFile`.
- **Credentials:** the URL comes from `.env` or `--url`. The key comes from the shell only, the script refuses to run without it, and it never prints the key, tokens or password. Legacy `service_role` keys are deprecated by the end of 2026 (https://supabase.com/docs/guides/api/api-keys), so accept `sb_secret_`.
- **Look-up by email:** `auth.admin.listUsers` has page and perPage but no email filter (auth-js 2.116 `GoTrueAdminApi.d.ts:358`). Either page through users or try `createUser` and treat `email_exists` as "look it up".
- **Create:**
  - `email_confirm: true` works whatever the confirmation setting. Local confirmation is off (`supabase/config.toml:209`); hosted is documented as off (`deploy-plan.md:113, 128`), not checked live.
  - No password-reset route exists (FR-003 parked), so the password the operator sets is the one the user keeps. Either a hidden prompt / `--password-stdin`, or a generated password printed exactly once.
- **Shape (proposal):** `npm run account:plan -- <email> full|free [--create] [--dry-run]`.
  - Idempotent: "no change" exits 0.
  - An unknown email without `--create` exits 1.
  - Output shows the project host, the user id and the old → new plan.

### Requirements and ambiguities (history worker)

- **PRD:**
  - FR-045 (`prd.md:461`): free or full; FR-037, FR-038 and FR-044 are "Plan: full"; a free account sees the feature described, never an error or an empty state; the server enforces.
  - FR-046 (`:462`): create full, or move to full and back, with one command and no payment.
  - Plans are "an attribute of the account, not a role" (`:614-618`).
  - Non-goals: no trials and no admin UI (`:653-657`).
  - OQ22 (`:738-739`): "full" is a working name.
- **The 2026-10-09 test-plan backport (Risk #5 plan half, Phase 4 `researched (waits for F-01)`) is on branch `feat/testing-access-and-entitlement-boundary` only** (commit b4f4011), not on main or this branch. It reaches main when that branch's PR merges.

## Code References

- `src/middleware.ts:7-21, 31-44`: claims-based user resolution, gate, 1 h staleness note.
- `src/lib/supabase.ts:12-27`: `SessionUser`, `createClient()` null.
- `src/env.d.ts:2-7`: `App.Locals`.
- `src/lib/tonight/island.ts:32-41`: islands guard on `locals.user`.
- `src/lib/api-errors.ts:4-12`: error keys for redirects.
- `supabase/migrations/20260924120000_sites_and_gear.sql:25-42`: policy pattern `(select auth.uid()) = user_id`.
- `supabase/migrations/20261003120000_sky_checks.sql:81-82, 110-111, 118-130`: invoker functions, `search_path = ''`, execute revokes/grants.
- `supabase/config.toml:158` (jwt_expiry), `:209` (confirmations off), `:266-269` (hook commented out).
- `tests/db/isolation.test.ts:17-25, 36-55, 127-155`: anon-key-only setup, sign-up users, `TABLES`, owner positive control.
- `.github/workflows/ci.yml:39, 44-50, 86-100`: CLI pin, env grep, db:types drift check, migrate before deploy, DB password scope.
- `scripts/smoke.mjs:1-5`; `eslint.config.js:76-80`; `context/deployment/deploy-plan.md:62`.

## Architecture Insights

- Isolation is RLS-only and there is no service role in the app. F-01 keeps that: the secret key lives only in the operator's shell and in test-only code against local Supabase.
- Supabase grants new public tables and functions to `anon` and `authenticated` by default. Any server-owned data needs explicit revokes, not just a missing policy, if refusals should be loud (`42501`).
- "Plan" already means the Session plan in code and copy, so the account attribute needs a distinct name (`accountPlan`).

## Historical Context (from prior changes)

- `context/changes/testing-access-and-entitlement-boundary/research.md` (on its branch):
  - no plan code exists;
  - the plan-half tests were deferred to F-01 in three layers (db no-self-grant with a positive control, a script test of the command, a route-level refusal);
  - owner decision 2026-10-09: F-01 must not put a server-owned column on an owner-writable table without hardening.
  - Supported by the current code.
- `context/archive/2026-09-24-sites-and-gear-management/plan.md:47, 70`: positive-control rule; four policies per table. A read-only table is a documented exception and needs its own test variant.
- `context/archive/2026-10-03-verdict-check/plan.md:55`: anti-tamper out of scope because writes are self-only. **That does not transfer to plans**: a self-grant is not harmless to the user's own data, it is the entitlement boundary.
- `context/archive/2026-09-28-account-reset-and-long-session/plan.md:39, 47-51`: 30-day sessions, server-side session caps out of scope. Consistent with a DB-read plan, which needs no session change.
- `context/archive/2026-09-30-planets-on-tonight/plan.md:19`: migrations must be backward compatible because `migrate` runs before `deploy`.

## Related Research

- `context/changes/testing-access-and-entitlement-boundary/research.md`: Risk #5/#6 grounding; Phase 4 resumes after F-01.

## Open Questions

These are for `/10x-plan`; facts are settled above.

1. **How visible is the plan in F-01?** Nowhere (roadmap minimum), or a plan line in the settings popover / gear hub (a UI decision for the owner)?
2. **Command scope and form:** create + promote + demote are required. Is a `show` / list sub-command wanted? Does demote delete the row or set `free`? How is the password chosen: prompt or generated?
3. **Route-level proof before any paid route exists:** test `requireFullPlan` as a unit plus `current_plan()` in tests/db (recommended), or add a dummy full-plan route only to assert the HTTP refusal?
4. **F-01 tests vs test Phase 4:** F-01 brings the no-self-grant, helper and command tests; Phase 4 later broadens isolation (anon writes, 42501 on every table, the structural policy check). Confirm that split.
5. **Unverified, to check while implementing:**
   - PostgREST's exact error code for a revoked write (42501 expected);
   - the env names `supabase status -o env` prints in CLI 2.119;
   - the hosted project's default ACLs.
