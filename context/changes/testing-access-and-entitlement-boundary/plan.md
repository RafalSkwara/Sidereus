# Test rollout Phase 4: access and entitlement boundary — Implementation Plan

## Overview

Test rollout Phase 4 (`context/foundation/test-plan.md` §3, Risks #5 and #6). The server must keep users apart and enforce the account plan, and a site's coordinates must stay out of logs and URLs. Both need checks that need no hand upkeep:

- **Risk #5:** broaden the isolation suite (anon writes, refusals pinned to `42501`), and add a structural database suite. Every `public` table and function must be classified and shaped correctly, so a forgotten table or a definer function fails the suite.
- **Risk #6:** make `no-console` an error in all of `src`, with a guard test that proves it file by file, and tighten the smoke test's two invalid-coordinate redirects.

The plan half of Risk #5 (no self-grant) already landed with F-01. Its HTTP half arrives with S-03's first full-plan route. This change documents the recipe for that route.

## Current State Analysis

Research: `context/changes/testing-access-and-entitlement-boundary/research.md` (complete; its anchors were re-checked against `main` c2ad0b5 on 2026-10-09 after F-01 and still hold, apart from one line of offset in the smoke cases).

- **Isolation holds and is mostly tested.** Five per-user tables have RLS and four per-operation policies `to authenticated`, and every UPDATE has WITH CHECK. The three RPCs are INVOKER with `search_path = ''` and revoked from anon. No service role is used in the app.
- **Isolation gaps:**
  - anon INSERT/UPDATE/DELETE are untested.
  - Cross-user insert and hand-over assert only "an error" (`tests/db/isolation.test.ts:195-196, 214`).
  - Nothing structural catches a new table without RLS or policies.
- **F-01 (#144) added:**
  - the server-owned `account_plans` table, which revokes writes from `anon`/`authenticated` and grants `select` back to `authenticated` (`supabase/migrations/20261009120000_account_plans.sql:16-29`);
  - `current_plan()`, INVOKER, `search_path = ''`, not executable by anon (`:33-47`);
  - `tests/db/account-plans.test.ts:91-171`, which proves `42501` on every self-write with a positive control, no cross-user read and no anon access;
  - `requireFullPlan` (`src/lib/account-plan/index.ts:50-61`), unit-tested.

  No full-plan route exists yet. F-01's plan assigned the HTTP refusal test to S-03's route.
- **`TABLES` is private to `isolation.test.ts`** (`tests/db/isolation.test.ts:56-109`). Importing the test file would re-run its suites, so a structural test can't reuse it as it stands.
- **tests/db reaches the database only through PostgREST** (anon key, plus the secret key in two files). The catalogs (`pg_class`, `pg_policies`, `information_schema`) aren't exposed there, and the repo has no Postgres client.
- **The `no-console` error scope is a hand-kept glob list:** `gearConfig.files` (`eslint.config.js:84-109`). Outside it, the base config leaves `no-console` at `warn`, and `npm run lint` (`package.json:11`) has no `--max-warnings 0`, so a `console.log` anywhere else merges.
  - The research's sweep found no live gap. The engine (11 files, guarded only by the purity regex `src/lib/engine/purity.test.ts:36`), `src/i18n/messages/{en,pl}.ts` and the dev-only `src/pages/design.astro` touch coordinates under `warn`.
  - Today's disables and logs:
    - `src/lib/tonight/build.ts:1216`: the only inline disable;
    - `src/lib/engine/calibration.test.ts:66` and `src/lib/engine/determinism.test.ts:84, 150`: test-only logs under `warn`.
- **The two invalid-coordinate smoke cases assert only the prefix:**
  - `scripts/smoke.mjs:91-95` (`/onboarding?error=`);
  - `scripts/smoke.mjs:137-141` (`/gear/sites/new?error=`).

  Both routes fail with `issueKey(parsed.error)`. The latitude schema's key is `errors.site.latitudeRange` (`src/lib/gear/schemas.ts:47`).

## Desired End State

- `npm run test:db` adds a structural suite. Every table in `public` must be either a per-user table (listed in the shared `TABLES`: RLS on, exactly one SELECT, INSERT, UPDATE and DELETE policy `to authenticated` keyed on `auth.uid()`, UPDATE with WITH CHECK) or server-owned (listed in `SERVER_OWNED`: RLS on, `select` the only privilege of `authenticated`, no privilege for `anon`, no write policy). An unlisted table, a listed table that doesn't exist, or a wrong shape fails with the table's name. Every function in `public` must be SECURITY INVOKER, pin `search_path`, and not be executable by `anon` or `PUBLIC`.
- The isolation suite also proves:
  - anon cannot insert, update or delete in any per-user table (each case against an owner row, with a positive control);
  - cross-user inserts and row hand-overs fail with `42501`.
- `no-console` is an error for every source file under `src` (`gearConfig.files` is gone). A unit guard test proves the effective rule file by file with ESLint's own `calculateConfigForFile`, and admits `eslint-disable … no-console` only in an allowlist of files with an exact count.
- The two smoke cases assert the exact `Location` (`…?error=errors.site.latitudeRange`) and that the value `95` is absent from it.
- `test-plan.md` §3 Phase 4 is done, the §5 gate is active and §6.4 is a recipe for a per-user table, a server-owned table, an RPC and a full-plan route. CLAUDE.md and `lessons.md` describe the repo-wide rule.

Verify with `npm test`, `npm run test:db` against local Supabase, `npm run lint`, `npx astro check`, `npm run smoke` and break checks (below), each reverted.

### Key Discoveries:

- A cross-user UPDATE or DELETE under RLS is silently zero rows, not an error, because the USING clause hides the row. Only an INSERT or a WITH CHECK failure raises `42501`. So anon and cross-user update/delete stay "row unchanged, with a positive control", and only inserts and hand-overs are pinned to `42501` (`tests/db/isolation.test.ts:1-9` explains the positive-control rule).
- anon is refused differently on per-user and server-owned tables:
  - On per-user tables, anon keeps Supabase's default table privileges and is refused by RLS (no policy is `to anon`). Its insert is `42501` from RLS; its update and delete are zero rows.
  - On `account_plans`, the privilege itself is revoked (`20261009120000_account_plans.sql:28`).
  - The structural suite asserts the per-user shape through policies, and the server-owned shape through privileges.
- `observations` and `sky_checks` add gear-ownership terms to their INSERT/UPDATE WITH CHECK (`20260926200000_observations.sql:40-45, 53-58`; `20261003120000_sky_checks.sql:41-68`). The structural check asserts that the expressions *include* `auth.uid()` and `user_id`, not that they equal a fixed string.
- `calculateConfigForFile` resolves configs without parsing, so a guard over every `src` file stays cheap. It returns `undefined` for an ignored file (`src/lib/database.types.ts`, `eslint.config.js:115`).
- CI writes `supabase status -o env` keys into `supabase.env` and passes them to `test:db` (`.github/workflows/ci.yml:44-48`). The Postgres URL comes from the same output (`DB_URL`; confirm the exact key name against the CLI pinned in CI, 2.119.0).

## What We're NOT Doing

- **Hardening self-only writes** (`sky_checks` server-decided fields, `record_sky_verdict`'s caller-chosen `dark_start`, `observations` app-only rules). This is an accepted known gap per the owner, 2026-10-09 (research "Decisions"), and a product change for a later change.
- **An HTTP refusal test for a full-plan route.** No such route exists. It comes with S-03's first route, following the §6.4 recipe this change writes (F-01 plan decision).
- **New tests for `account_plans` behaviour.** `tests/db/account-plans.test.ts` already proves it; this change only classifies the table structurally.
- **`--max-warnings 0` for the whole lint** (owner chose `no-console` only, 2026-10-09).
- **A type-and-flow trace of coordinate-carrying modules** (research option (a)). The repo-wide rule makes it unnecessary.
- **Covering `console` aliases, `reportError`, thrown messages or third-party request URLs.** These are blind spots of a lint rule, recorded in §6.4.
- **Asserting that offline-copy metadata carries no coordinates.** Out of Phase 4's agreed scope.
- **Column-level grants or a pgTAP runner.**

## Implementation Approach

The database first, because it is the boundary itself and the riskier CI change (a new connection string). Then the lint rule, which touches many files' effective config but no product code. Then the docs. The structural suite derives its expectations from the same shared table list as the behavioural suite, so adding a per-user table is still one entry, and forgetting it fails.

## Critical Implementation Details

- **Debug & observability:** the structural suite connects with the local stack's `postgres` superuser URL. That URL is local-only and never belongs in `.env`, `.dev.vars` or a log. Fail fast with a message naming `DB_URL` when it is unset, as `isolation.test.ts:20-25` does for the API keys, and close the connection in `afterAll` so Vitest exits.

## Phase 1: Database boundary

### Overview

Share the table list, add a catalog-reading structural suite, broaden the isolation cases and pass the Postgres URL in CI.

### Changes Required:

#### 1. Shared table classification

**File**: `tests/db/tables.ts` (new), `tests/db/isolation.test.ts`

**Intent**: Move `TableCase` and `TABLES` out of the isolation test into a non-test module, and add `SERVER_OWNED`, so the behavioural and structural suites read one list.

**Contract**: exports `TABLES` (unchanged entries), `TableCase`, and `SERVER_OWNED: readonly string[] = ["account_plans"]`. The file header says that a new per-user table goes in `TABLES` and a server-owned one in `SERVER_OWNED`. `isolation.test.ts` imports both and keeps its `describe.each(TABLES)`. Update the references that name the old location (plan review F1):
- `tests/db/isolation.test.ts:9` ("add an entry to `TABLES` below");
- `tests/db/account-plans.test.ts:11`;
- the `CLAUDE.md:20` tripwire, which should now say "`TABLES` or `SERVER_OWNED` in `tests/db/tables.ts`, and the structural suite fails an unlisted table".

#### 2. Structural suite

**File**: `tests/db/structure.test.ts` (new); `package.json` (devDependency `postgres`)

**Intent**: Read the catalogs over a direct Postgres connection and fail on any `public` table or function that is unclassified or wrongly shaped. This catches a forgotten table without hand upkeep.

**Contract**:

- **Non-vacuity first:**
  - the query finds at least the six known tables and four known functions;
  - every name in `TABLES` and `SERVER_OWNED` exists;
  - the classified set equals the actual set of base tables in `public`.
- **Per-user tables:**
  - `relrowsecurity` is on;
  - `pg_policies` has exactly one policy per command (SELECT, INSERT, UPDATE, DELETE), each with roles `{authenticated}`;
  - the SELECT, UPDATE and DELETE `qual` mention `auth.uid()` and `user_id`;
  - the INSERT and UPDATE `with_check` mention them as well.
- **Server-owned tables:**
  - RLS is on;
  - `has_table_privilege` gives `authenticated` SELECT only (no INSERT, UPDATE, DELETE, TRUNCATE) and gives `anon` nothing;
  - no policy for INSERT, UPDATE, DELETE or ALL.
- **Functions** in `public`, excluding extension-owned ones:
  - `prosecdef = false`;
  - `proconfig` contains a `search_path=` entry;
  - `has_function_privilege('anon', oid, 'EXECUTE') = false`;
  - `has_function_privilege('public', oid, 'EXECUTE') = false` (a NULL `proacl` is the default ACL and grants PUBLIC, so never search `proacl` text alone; plan review F3).
- **Failure messages** name the table or function and the property.
- **Connection:** `DB_URL` from the environment, closed in `afterAll`.

#### 3. Broader isolation cases

**File**: `tests/db/isolation.test.ts`

**Intent**: Close the anon-write gap, and pin the two refusals that really raise to `42501`, keeping every positive control.

**Contract**: new cases per `TABLES` entry:

- anon INSERT (as a row of A, and as a row without a user) fails with code `42501`, and A's row count is unchanged. Assert `error.code`, not the HTTP status: PostgREST answers this one with 401, and RLS's WITH CHECK fires before the NOT NULL default on `user_id` (verified locally, plan review F4);
- anon UPDATE with `patch` on A's row leaves it unchanged, and anon DELETE leaves it present (each reads the row back as A, before and after).

Existing cases change as follows:

- "another user cannot insert a row owned by the first user" also asserts `error.code === "42501"`;
- "cannot hand its own row over" asserts `42501`.

The header comment says which refusals are errors and which are zero-row no-ops.

#### 4. CI and local instructions

**File**: `.github/workflows/ci.yml`, `CLAUDE.md` (`npm run test:db` line)

**Intent**: Give `test:db` the Postgres URL in CI and document it locally.

**Contract**:
- `ci.yml`: the `grep -E` adds `DB_URL`, and `test:db` gets `DB_URL="$DB_URL"`.
- `CLAUDE.md`: the `test:db` command line lists `DB_URL` among the variables taken from `npx supabase status -o env`.

### Success Criteria:

#### Automated Verification:

- `npm run test:db` passes against local Supabase, including `structure.test.ts` and the new isolation cases
- Break check: a scratch migration adding a `public` table with RLS off (or not listed) fails `structure.test.ts` with the table's name; reverted
- Break check: dropping `with check` from one UPDATE policy in a scratch migration fails the structural suite; reverted
- Break check: a scratch `security definer` function in `public` fails the function check; reverted
- `npm run db:types` leaves `src/lib/database.types.ts` unchanged, and `npm run lint` and `npx astro check` pass
- CI's `smoke` job passes on the PR with `DB_URL` wired

#### Manual Verification:

- The failure output of one break check names the table and the property clearly enough to fix without reading the test

**Implementation Note**: run as agreed for multi-phase runs: commit the phase, then continue; manual rows are verified by the agent where evidence allows, or left for the joint check after the last phase.

---

## Phase 2: Coordinate privacy guard

### Overview

`no-console` becomes an error for all of `src`, a guard test proves it file by file, and the smoke test pins the invalid-coordinate redirects exactly.

### Changes Required:

#### 1. Repo-wide rule

**File**: `eslint.config.js`

**Intent**: Retire the hand-kept `gearConfig.files` list and make `no-console` an error for every file under `src`, keeping it off for `scripts/**/*.mjs` and `tests/e2e/**/*.mjs`.

**Contract**:
- `gearConfig` is replaced by a config with `files: ["src/**"]` and `rules: { "no-console": "error" }`, whose comment states the coordinate-privacy NFR and names the guard test.
- `scriptsConfig` is unchanged.

#### 2. Allowed logs

**File**: `src/lib/engine/calibration.test.ts:66`, `src/lib/engine/determinism.test.ts:84, 150`

**Intent**: Keep the opt-in snapshot and determinism prints with an explicit inline disable that gives the reason (test output, no site data). `src/lib/tonight/build.ts:1216` keeps its disable.

**Contract**: `// eslint-disable-next-line no-console` above each line.

#### 3. Guard test

**File**: `src/lib/no-console-guard.test.ts` (new, next to `src/lib/runner-zone-guard.test.ts`)

**Intent**: Prove that the property "no source file can log" holds without knowing which modules carry coordinates.

**Contract**:

- **Files:** every `.ts`, `.tsx`, `.astro`, `.js` and `.mjs` file under `src/`, test files included.
- **Setup:** one `new ESLint({ cwd: <repo root> })` built in `beforeAll` with a 30 s hook timeout. A cold first config load measured 10.5 s; warm, all 327 lookups take ~25 ms.
- **Rule check:** for each file, `calculateConfigForFile(path)` returns the rule as an array (`[2, {}]` today). Read its first element and require `2` or `"error"`. A file that resolves to `undefined` (ignored) is accepted only if it is in a named ignored list (`src/lib/database.types.ts`).
- **Disable comments:** every `eslint-disable` comment (line, next-line or block) naming `no-console` is counted per file, and the counts must equal an allowlist with a reason per file: `src/lib/tonight/build.ts`: 1, `calibration.test.ts`: 1, `determinism.test.ts`: 2.
  - A rule-less `eslint-disable` (which silences every rule, `no-console` included) is a violation in any file. None exists in `src` today.
  - The guard's own file is excluded from the count, because its pattern and messages contain the text it looks for.
  - Plan review F2 covers this bullet and the two above.
- **Failures** list `file` plus the effective severity or the count.
- **Non-vacuity:** at least 300 files are checked, and the known coordinate modules (`src/lib/gear/store.ts`, `src/lib/engine/index.ts`, `src/i18n/messages/en.ts`) are among them.

#### 4. Exact smoke redirects

**File**: `scripts/smoke.mjs` (cases at `:91-95` and `:137-141`)

**Intent**: Assert the exact `Location` for an out-of-range latitude, and that the submitted value never appears in it.

**Contract**:
- The two expectations become `location: "/onboarding?error=errors.site.latitudeRange", exact: true` and `location: "/gear/sites/new?error=errors.site.latitudeRange", exact: true`. Both schemas fail on latitude first: gear at `src/lib/gear/schemas.ts:47`, onboarding reusing it at `src/lib/onboarding/schemas.ts:57`.
- The runner also checks that `Location` doesn't contain `95`. This is a small `absent` field on the expectation: one more clause in the checker at `scripts/smoke.mjs:186-187`, and a line in its failure output at `:194`.

#### 5. Rule records

**File**: `CLAUDE.md` (tripwire "Coordinates never go into URLs or logs"), `context/foundation/lessons.md`

**Intent**: Replace "error under `src/lib/gear` and `src/pages/api/gear`" with the repo-wide rule and the guard test. Record that the old lesson's "add the glob to `gearConfig.files`" is superseded.

**Contract**:
- `CLAUDE.md`: the tripwire sentence changes.
- Code comments that describe the old scope change too (plan review F1):
  - `src/lib/engine/purity.test.ts:10` ("outside eslint's `gearConfig.files`");
  - `src/lib/tonight/visibility-invariants.test.ts:42-43` ("error under `src/lib/tonight/**`").
- `lessons.md`: append a new entry, "`no-console` is an error in all of `src`; a new log needs an allowlisted disable", which states that it supersedes the gearConfig lesson. Earlier entries stay untouched (append-only).

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `no-console-guard.test.ts`
- `npm run lint` and `npx astro check` pass with no new `no-console` warning or error
- Break check: a `console.log` in `src/lib/engine/score.ts` fails `npm run lint`; reverted
- Break check: an extra `eslint-disable-next-line no-console` in a non-allowlisted file fails the guard test; reverted
- Break check: restoring a `gearConfig`-style narrower `files` list fails the guard test for a file outside it; reverted
- `npm run smoke` passes against a local preview on local Supabase with the exact keys

#### Manual Verification:

- The guard test's failure output for one break check names the file and the reason

**Implementation Note**: as Phase 1.

---

## Phase 3: Test-plan and cookbook

### Overview

Close Phase 4 in the test plan and write the recipe that the next table, RPC or full-plan route follows.

### Changes Required:

#### 1. Rollout status and gate

**File**: `context/foundation/test-plan.md` (§3 Phase 4 row, §5 gate row)

**Intent**: Mark Phase 4 done, and make the "plan enforcement + coordinate lint-scope check" gate active. The gate names the structural suite, the isolation suite and the guard test, and notes that the HTTP refusal arrives with S-03.

**Contract**: §3 status cell; §5 "Catches" and "Where" cells. §1–§2 stay frozen.

#### 2. Cookbook §6.4

**File**: `context/foundation/test-plan.md` §6.4

**Intent**: Replace "TBD" with how to add the following:

- **A per-user table:** a `TABLES` entry in `tests/db/tables.ts` with `valid` and `change`; the structural suite then demands RLS and four policies.
- **A server-owned table:** revoke from `anon`/`authenticated`, grant `select` back, add to `SERVER_OWNED` and give it its own `42501` suite, as `account-plans.test.ts` does.
- **An RPC:** INVOKER, `search_path = ''`, revoke from `public`/`anon`; a tests/db case for anon `42501` and a cross-user case with a positive control.
- **A full-plan route:**
  - `requireFullPlan` first in the handler;
  - an HTTP check as a free and as a full account (smoke or a tests/db fetch against the preview), asserting the redirect key `errors.accountPlan.needsFull` and that no write happened, never through the UI.

The section also lists the blind spots: `console` aliases, `reportError`, thrown messages and third-party URLs.

**Contract**: §6.4 body, in the style of §6.1–§6.3 (Pick the layer, Helpers, Oracle rule, gotchas).

#### 3. Phase note

**File**: `context/foundation/test-plan.md` §6.6

**Intent**: A 2–3 line note for Phase 4 with the break checks that turned red.

**Contract**: one bullet, appended.

### Success Criteria:

#### Automated Verification:

- `grep -c "TBD — see §3 Phase 4" context/foundation/test-plan.md` prints 0, and the §3 Phase 4 row reads done (the context docs are not Prettier-formatted, so no formatter run)

#### Manual Verification:

- §6.4 reads as a complete recipe for a per-user table, a server-owned table, an RPC and a full-plan route, and names the S-03 follow-up

**Implementation Note**: as Phase 1.

---

## Testing Strategy

### Unit Tests:

- `src/lib/no-console-guard.test.ts`: the effective rule for every `src` file, the disable allowlist with counts, and non-vacuity.

### Integration Tests:

- `tests/db/structure.test.ts`: table classification, per-user policy shape, server-owned privileges, function security.
- `tests/db/isolation.test.ts`: anon I/U/D with positive controls, and `42501` on cross-user insert and hand-over.
- `scripts/smoke.mjs`: exact invalid-coordinate redirects, with no coordinate in `Location`.

### Manual Testing Steps:

1. Read one structural and one guard failure message from a break check and confirm that each names its target.
2. Read §6.4 as someone adding S-03's first route.

## Performance Considerations

- The structural suite runs a handful of catalog queries.
- The guard test resolves configs without parsing; expect a few seconds for ~330 files. If it exceeds 10 s, give it its own timeout rather than narrowing the file set.

## Migration Notes

No schema migration. Scratch migrations for the break checks are deleted afterwards, and `supabase db reset` restores the local schema.

## References

- Research: `context/changes/testing-access-and-entitlement-boundary/research.md`
- F-01: `context/archive/2026-10-09-account-plans/plan.md`, `tests/db/account-plans.test.ts:91-171`, `src/lib/account-plan/index.ts:50-61`
- Existing pattern: `tests/db/isolation.test.ts:1-9, 121-227`; `src/lib/runner-zone-guard.test.ts` (static guard style)
- Lint scope: `eslint.config.js:77-109`; lesson `context/foundation/lessons.md:3-10`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database boundary

#### Automated

- [x] 1.1 `npm run test:db` passes against local Supabase, including `structure.test.ts` and the new isolation cases — a5e409e
- [x] 1.2 Break check: unlisted or RLS-off table fails `structure.test.ts` with the table's name; reverted — a5e409e
- [x] 1.3 Break check: UPDATE policy without `with check` fails the structural suite; reverted — a5e409e
- [x] 1.4 Break check: `security definer` function fails the function check; reverted — a5e409e
- [x] 1.5 `npm run db:types` unchanged, `npm run lint` and `npx astro check` pass — a5e409e
- [x] 1.6 CI's `smoke` job passes on the PR with `DB_URL` wired — a5e409e

#### Manual

- [x] 1.7 A break check's failure output names the table and the property clearly — a5e409e

### Phase 2: Coordinate privacy guard

#### Automated

- [x] 2.1 `npm test` passes, including `no-console-guard.test.ts` — 8db290a
- [x] 2.2 `npm run lint` and `npx astro check` pass with no new `no-console` finding — 8db290a
- [x] 2.3 Break check: `console.log` in `src/lib/engine/score.ts` fails `npm run lint`; reverted — 8db290a
- [x] 2.4 Break check: extra non-allowlisted `no-console` disable fails the guard test; reverted — 8db290a
- [x] 2.5 Break check: narrower `files` list fails the guard test; reverted — 8db290a
- [x] 2.6 `npm run smoke` passes on local Supabase with the exact keys — 8db290a

#### Manual

- [x] 2.7 The guard test's failure output names the file and the reason — 8db290a

### Phase 3: Test-plan and cookbook

#### Automated

- [x] 3.1 No "TBD — see §3 Phase 4" left in test-plan.md, §3 Phase 4 row done — 39f0da7

#### Manual

- [x] 3.2 §6.4 is a complete recipe (per-user table, server-owned table, RPC, full-plan route) and names the S-03 follow-up — 39f0da7
