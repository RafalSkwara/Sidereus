# Test rollout Phase 4: access and entitlement boundary — Plan Brief

> Full plan: `context/changes/testing-access-and-entitlement-boundary/plan.md`
> Research: `context/changes/testing-access-and-entitlement-boundary/research.md`

## What & Why

Phase 4 of the test rollout covers Risk #5 (one user reaching another's data, or granting themselves the full plan) and Risk #6 (a site's coordinates escaping into a log or a URL). Both are guarded today by tests that know a fixed list of tables and lint globs. A new table or module that nobody adds to the list goes unguarded. This change makes both guards derive their scope themselves, so forgetting fails the build.

## Starting Point

- Isolation holds: five RLS tables, three INVOKER RPCs, and the isolation suite with positive controls.
- F-01 added the server-owned `account_plans` and proved that no one can grant themselves the plan.
- **Gaps:**
  - anon writes are untested;
  - refusals aren't pinned to `42501`;
  - nothing catches a table without RLS;
  - `no-console` is an error only on a hand-kept glob list, and `warn` elsewhere doesn't block CI.

## Desired End State

- `npm run test:db` fails if any `public` table is unclassified, misses RLS or its policy set, or if any function is a definer, lacks a `search_path` or is executable by anon.
- anon and cross-user refusals are proven with positive controls.
- No file under `src` can log without an allowlisted disable, and a guard test proves this file by file.
- The smoke test pins the exact invalid-coordinate redirect.
- The test plan's §6.4 tells the next table, RPC or full-plan route what to add.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Self-only writes (`sky_checks`, `observations`) | Accepted gap, not hardened | Affects only the caller's own data; revisit later | Research (owner) |
| Plan half of Risk #5 | Already proven by F-01; Phase 4 only classifies `account_plans` | Avoids duplicating `account-plans.test.ts` | Plan |
| HTTP refusal on a full-plan route | With S-03's first route, via the §6.4 recipe | No full-plan route exists; no dead route in production | F-01 plan (owner) |
| Structural DB check | Vitest + `postgres` over `DB_URL`, reading the catalogs | Same runner and CI step; shares the table list with the isolation suite | Plan (owner) |
| Table list | Moved to `tests/db/tables.ts` with `SERVER_OWNED` | Importing the test file would re-run it; one list for both suites | Plan |
| `no-console` scope | Error in all of `src`; `gearConfig.files` retired | Needs no knowledge of which modules carry coordinates | Plan (owner) |
| Disable allowlist | Per file with exact counts, not line numbers | Line numbers drift with every edit | Plan |
| `--max-warnings 0` | Not added | Beyond Risk #6 | Plan (owner) |
| `42501` pinning | Inserts and hand-overs only; updates and deletes stay "row unchanged" | Under RLS a hidden row is a zero-row no-op, not an error | Plan |

## Scope

**In scope:**
- `tests/db/tables.ts`, `structure.test.ts` and the broader `isolation.test.ts`;
- `DB_URL` in CI and in the CLAUDE.md `test:db` line;
- the repo-wide `no-console` rule, three inline disables and `src/lib/no-console-guard.test.ts`;
- exact smoke redirects;
- CLAUDE.md tripwire, a new lesson, and test-plan §3/§5/§6.4/§6.6.

**Out of scope:**
- hardening self-only writes and column grants;
- the full-plan HTTP test (S-03) and new `account_plans` behaviour tests;
- `--max-warnings 0`, a coordinate flow trace, and offline-metadata assertions;
- pgTAP.

## Architecture / Approach

The database boundary comes first:
- one shared table classification (`TABLES` and `SERVER_OWNED`) drives the behavioural suite over PostgREST and a structural suite over a direct Postgres connection;
- the structural suite also compares the classification with the real set of tables, so a forgotten table fails.

Then the lint rule widens to all of `src`. A guard test asks ESLint itself which rule applies to each file and counts the disables against an allowlist. Docs close the phase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Database boundary | Shared table list, structural suite, anon and `42501` cases, `DB_URL` in CI | Wrong env key name from the pinned CLI, or a leaked superuser URL |
| 2. Coordinate privacy guard | Repo-wide `no-console`, guard test, exact smoke keys, CLAUDE.md and lesson | A slow guard test over ~330 files |
| 3. Test-plan and cookbook | §3 done, §5 gate, §6.4 recipe, §6.6 note | Recipe vague about the S-03 route |

**Prerequisites:** Docker and `npx supabase start`; `DB_URL`, `API_URL`, `ANON_KEY` and `SECRET_KEY` from `npx supabase status -o env`; `nvm use`.
**Estimated effort:** about one session across 3 phases.

## Open Risks & Assumptions

- The exact `supabase status -o env` key for the Postgres URL is assumed to be `DB_URL` on CLI 2.119.0. Phase 1 confirms it before wiring CI.
- The structural suite assumes no extension-owned function in `public` (none today); if one appears, the suite filters on `pg_depend` instead of an allowlist.
- The guard test's speed under ESLint's type-checked config is unmeasured; the plan accepts its own timeout rather than a narrower file set.

## Success Criteria (Summary)

- Adding a `public` table without RLS, policies or a classification, or a definer function, fails `npm run test:db` with its name.
- A `console.log` anywhere in `src` fails lint, and a guard test proves that every file is covered.
- The next full-plan route knows from §6.4 exactly which tests it owes.
