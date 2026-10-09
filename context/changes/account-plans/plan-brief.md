# Account plans (roadmap F-01) — Plan Brief

> Full plan: `context/changes/account-plans/plan.md`
> Research: `context/changes/account-plans/research.md`

## What & Why

Every account carries a free or full plan that the server enforces (PRD FR-045). The operator can create a complimentary full account, or move one to full and back, with one command (FR-046). F-01 is the foundation that the paid slices S-03, S-04 and S-08 build on, and it is the entitlement boundary: nobody may grant themselves the full plan.

## Starting Point

No plan code exists. Isolation is RLS-only and the app has no service role. Supabase grants every new table and function to `anon` and `authenticated` by default, so a server-owned attribute needs explicit revokes. tests/db uses only the anon key today.

## Desired End State

- **Storage:** a new `account_plans` table that only the secret key can write. A missing row means free. Any self-write is refused loudly with `42501`.
- **Server:** code reads the plan through a lazy, per-request helper and refuses free accounts through `requireFullPlan`.
- **Operator:** the owner runs `npm run account:plan -- <email> full|free|show [--create] [--dry-run]` with the hosted secret key in their shell.
- **UI:** nothing changes.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the plan lives | New table `account_plans`, select-own RLS, writes revoked, no row = free | Immediate effect, no sign-up trigger, no backfill, loud refusals | Research |
| JWT / app_metadata | Not used | The middleware's claims are stale for up to 1 h, so a downgrade would linger | Research |
| Read path | Lazy `getAccountPlan(locals)` memoised in a WeakMap; never in middleware | No extra round trip on every page and server island | Research |
| SQL check for later paid data | `current_plan()`, invoker, `search_path = ''` | Matches the repo's function conventions | Research |
| Plan visible in UI | Nowhere in F-01 | The roadmap minimum; S-03 brings the first visible state | Plan (owner) |
| Password on `--create` | Hidden prompt, or `--generate` printed once | Keeps passwords out of shell history | Plan (owner) |
| Command scope | create / full / free + `show` + `--dry-run` | Safe to inspect and rehearse before touching production | Plan (owner) |
| Proving server refusal | Guard unit tests + DB boundary tests; HTTP refusal with S-03's route | No dead route in production | Plan (owner) |
| Test split with rollout Phase 4 | F-01 tests only the plan; Phase 4 broadens isolation and the lint scope | Keeps F-01 small, as the owner prefers modest tests | Plan (owner) |
| Demote | `plan = 'free'`, row kept | `updated_at` shows when it changed | Plan (delegated) |

## Scope

**In scope:**
- the migration (table, policy, revokes, `current_plan()`) and the regenerated types;
- the tests/db boundary and command tests, with the CI secret key passed to `test:db` only;
- `src/lib/account-plan/` with its unit tests, and the `errors.accountPlan.needsFull` key in EN and PL;
- `scripts/account-plan.mjs` and the npm script;
- CLAUDE.md and deploy-plan.md updates.

**Out of scope:**
- any UI, including the "needs the full plan" state (S-03);
- full-plan routes;
- a sign-up trigger or backfill;
- JWT claims or hooks;
- an admin UI, payments or trials;
- offline-copy changes (OQ23 / S-08);
- broader isolation tests and the lint-scope guard (rollout Phase 4);
- the agent running the command on production.

## Architecture / Approach

The database is the enforcer: `account_plans` has no write path for `anon` or `authenticated`, only the secret key (operator script, test admin client) writes it, and `current_plan()` gives future RLS policies and RPCs the caller's plan. The app reads the plan only where a feature needs it, through `src/lib/account-plan/`, which defaults to free on anything missing or failed and exposes `requireFullPlan` for routes. The operator script is zero-dependency `.mjs` with exported logic, so tests/db drives it against local Supabase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Plan table, SQL helper and boundary tests | Migration, types, tests/db proof of no self-grant, CI secret key for `test:db` | Leaking the secret key into `.dev.vars` in CI |
| 2. Server-side reader and guard | `getAccountPlan` / `requireFullPlan`, error key, unit tests | Accidentally resolving the plan in the middleware |
| 3. Operator command and documentation | `npm run account:plan`, command tests, CLAUDE.md and deploy-plan | Printing a secret or password; wrong project targeted |

**Prerequisites:** Docker plus `npx supabase start` for tests/db, and the local `SECRET_KEY` from `npx supabase status -o env`.
**Estimated effort:** about one session across 3 phases.

## Open Risks & Assumptions

- The hosted project is assumed to have the same default ACLs as local. The revokes make that irrelevant for writes; RLS with no write policy holds either way.
- CI pins Supabase CLI 2.119.0, assumed to print `SECRET_KEY` like 2.117 does locally. Phase 1's CI run proves it.
- The test-plan backport (Risk #5 plan half) still sits on `feat/testing-access-and-entitlement-boundary`. It reaches main when that branch's PR merges.

## Success Criteria (Summary)

- A signed-in user can't give themselves the full plan through any API path, and tests/db proves it with a positive control.
- The owner can make their own account full on production with one command and see it with `show`.
- Existing pages make no extra database call, and every existing account stays free without a migration of data.
