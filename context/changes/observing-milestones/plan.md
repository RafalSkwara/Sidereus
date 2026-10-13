# Observing milestones (M-3 S-06) Implementation Plan

## Overview

When a log entry is saved and it reaches a milestone from a fixed, named set, the app celebrates it exactly once, and `/log/progress` lists every milestone reached, with its night, forever. Roadmap M-3 S-06 (GitHub #127), PRD FR-041, US-06. It builds on S-05 observing-progress.

The owner answered the four planning questions on 2026-10-13 (see "Owner decisions"). The celebration's look is still open by design: Phase 5 builds three variants and stops for the owner's pick.

## Current State Analysis

Evidence: `context/changes/observing-milestones/research.md`.

- **What S-05 provides.** It left one pure model of the log: `observingProgress(entries)` (`src/lib/progress/progress.ts`).
  - The Messier (110) and Caldwell (61) checklists. Items carry `type` and `seen.firstNight`.
  - The planet and Moon firsts, each with `firstNight`.
  - It is built through `seenSummaries`, so only entries rated 3 or above count.
- **The read.** `observationStore.listSeenEntries(client)` is the one exact read of those entries: a paged count, normally one request.
- **Saves.** They happen in `POST /api/log` (create; `src/pages/api/log/index.ts`) and `POST /api/log/[id]` (edit; `src/pages/api/log/[id].ts`).
  - Create returns to the Tonight page named in `from` with `?logged=<key>`, or to `/log?saved=<key>`.
  - Edit returns to `/log?updated=<key>` (`logNotice`, `src/lib/observations/redirect.ts:83`).
  - Delete (`src/pages/api/log/[id]/delete.ts`) returns to `/log?deleted=<key>`. It can only un-reach derived milestones, so it records the before-state first (plan re-review F11).
- **Notices.** They travel as fixed query params:
  - Tonight shells read `?logged`: the dashboard `src/pages/tonight.astro:22`, plus `src/pages/tonight/targets.astro:23-31`, `planets.astro:23`, `moon.astro` and `nights.astro` (plan review F9).
  - `/log` reads `readLogNotice`.
  - Toasts clear only `TOAST_PARAMS` (`src/lib/toasts.ts`).
  - Tonight URLs that carry any of `NOTICE_PARAMS` (`src/lib/offline/copies.ts:35`) are never stored offline.
- **Per-user tables.** Each has RLS with one `select`, `insert`, `update` and `delete` policy `to authenticated`, keyed on `auth.uid() = user_id`, and an entry in `TABLES` (`tests/db/tables.ts`). `structure.test.ts` fails on a `public` table in neither `TABLES` nor `SERVER_OWNED`, and on any `public` function that is SECURITY DEFINER. The Worker never holds the secret key (CLAUDE.md "Env").
- **Self-only writes.** No migration has column grants, so an owner can write any column of their own rows through PostgREST. The owner accepted this for `sky_checks` and `observations` on 2026-10-09 as a known gap to revisit (`context/archive/2026-10-09-testing-access-and-entitlement-boundary/research.md:154`, `context/foundation/test-plan.md:166`).
- **The isolation suite inserts A's valid row once per test** and doesn't delete it afterwards (`tests/db/isolation.test.ts:71-76`, users created once in `beforeAll`). A table with a per-user unique key would fail from the second insert.
- **Nothing about milestones exists yet:** no table, no model, no copy.

## Desired End State

- **The record.** Each milestone a user reaches is stored once in `observing_milestones` with the night it was reached. It stays even if the entry that reached it is later deleted or re-rated.
- **The celebration.** Saving an entry rated 3 or above that reaches a milestone not yet stored celebrates it once, on or after the page the save returns to, in the variant the owner picks in Phase 5.
  - Several milestones reached by one save are named in one celebration.
  - It links to `/log/progress`.
  - It shows once: the database stores each milestone once per user, the param is cleared on show, and offline copies never keep it.
  - An entry rated 1-2 never celebrates.
  - Reaching a milestone again, after the entry that reached it was deleted, never celebrates again.
- **The progress page.** `/log/progress` opens with a "Milestones" band listing all 11 milestones in a fixed order:
  - reached: a check, the name and "reached <night>";
  - not yet: muted, and count milestones show how far along the user is ("12 / 25").
- **Verification:**
  - pure unit tests with hand-written entries;
  - db tests for the table (isolation, structure, the key check, the once-only insert);
  - an e2e journey: rating 2 doesn't celebrate, re-rating to 4 celebrates once and not on reload, a planet logged from Tonight celebrates there, a deleted entry's milestone stays listed and reaching it again doesn't celebrate;
  - the phone-width check covers the page;
  - the design step's screenshot matrix, then the chosen variant's screenshots.

### Key Discoveries:

- Every milestone can be derived from `ObservingProgress`. First of a kind is the earliest `firstNight` in a group; the N-th object is the N-th earliest `firstNight` in a list; all of a set is the latest `firstNight` once all are seen (research.md "Deriving milestones").
- "Reached by this save" = reached after minus reached before, with the same read and the same rule. A rating of 1-2 leaves both sets equal, so the roadmap's guard follows from the rule. It is also checked explicitly.
- "Celebrated exactly once" is the database's job: a unique key on `(user_id, key)` and an insert that ignores duplicates return a row only to the first save that stores it, even for two saves at once.
- `NOTICE_PARAMS` exists because a stored copy with a notice param "would show 'Saved' forever" (`copies.ts:34-35`). The celebration param must join it.

## Owner decisions

Answered by the owner on 2026-10-13, relayed by the orchestrator:

1. **The milestone set:** the default 11 is accepted:
   - first Moon, first planet, all planets (7);
   - first galaxy, first globular cluster, first nebula;
   - 10, 25, 50 and all 110 Messier objects;
   - all 61 Caldwell objects.

   "Moon's terminator" becomes "first Moon". The nebula types are `nebula`, `emission-nebula`, `reflection-nebula`, `planetary-nebula`, `supernova-remnant` and `cluster-with-nebula`.
2. **Lifetime (plan review F1): stored.** Every milestone is celebrated exactly once and stays listed forever, even if the entry that reached it is later deleted or re-rated. This adds Phase 2 (the table).
3. **The celebration (plan review F5): bigger than a toast.** Phase 5 builds three variants and captures screenshots, then the run stops and the owner picks. Phase 6 implements the pick. This supersedes the toast design and the one-or-two-toasts question.
4. **The band:** `/log/progress` shows all 11 milestones. Unreached ones are muted, and count milestones show progress ("12 / 25").

## What We're NOT Doing

- No backfill migration. The rule lives in TypeScript, so SQL can't derive milestones without a second copy of it. A milestone reached before this change shows on `/log/progress` as derived. The user's next save of any kind except a create rated 1-2 stores it silently, without a celebration: a create or edit rated 3 or above, an edit to 1-2, or a delete (F11). A delete or downgrade therefore can't lose it.
- No write from a GET. The progress page doesn't store anything.
- No hardening of self-only direct writes to `observing_milestones`. This is accepted and pinned (see "Self-only writes" below).
- No celebration on delete, and no "milestone lost" notice. A stored milestone is never lost.
- No sharing, badges, points or leaderboard. The PRD Non-Goals keep progress private (`prd.md:637-640`).
- No push or email notification of a milestone.
- No celebration for milestones reached by rows inserted outside the app's save routes. Only the two routes celebrate.
- No change to the seen rule, `LOG_PENALTY_MIN_RATING`, the ranking or the S-05 checklists.
- No offline storage of `/log/progress` or of any page carrying the celebration param.

## Implementation Approach

The work runs bottom-up in six phases:

1. A pure milestone model (test-first).
2. The `observing_milestones` table, its tests and its store.
3. Recording at save: the routes store what a save reaches and carry what it newly stored as a param.
4. The progress-page band (stored plus derived).
5. **The celebration design step:** three variants and a screenshot matrix, then **STOP for the owner's pick**.
6. The chosen celebration, the remaining e2e assertions and the docs.

The guard "never for an entry rated 1-2" holds independently in two places:

- **By the rule:** the before/after diff over `observingProgress` is empty for such an entry, and only a counting save (rated ≥ 3) ever reads `after` or celebrates.
- **By a short-circuit:** a **create** rated below `LOG_PENALTY_MIN_RATING` skips the milestone reads and the record entirely; it can neither reach nor un-reach anything. An edit to 1-2 and a delete still read and record the before-state, so a derived-only milestone is stored before it can be lost, but they never celebrate (F11).

**Decisions delegated to the agent** (non-UI; recorded in the brief):

- The pure model lives in `src/lib/progress/milestones.ts`. The save-side helper, which does I/O, lives in `src/lib/observations/celebrate.ts` beside `store.ts` and `redirect.ts` (plan review F8). The table's store is `src/lib/observations/milestone-store.ts`.
- **How the row is written:** at save, by the route, through PostgREST with the request's RLS client. It is an insert that ignores duplicates on `(user_id, key)` and returns only the rows it inserted. A new RPC would add nothing: it would run as the caller (SECURITY DEFINER is banned by `structure.test.ts`), so it would need the same grants.
- **What is stored:** every milestone any read of the save showed reached, `reached(before) ∪ reached(after)` (the `after` night where both have it), not only the new ones. Milestones reached before this change, or left derived-only by a failed record, get stored without a backfill, and an edit that moves the reaching entry away (M31 → M13) can't lose one (F11).
- **What is celebrated:** the keys this save newly reached that the insert actually stored, `newlyReached(before, after) ∩ inserted`. A backfilled milestone (stored but not newly reached) stays silent. A re-reached milestone (newly reached but already stored) stays silent.
- **Self-only writes: accepted and pinned**, not hardened (see "Critical Implementation Details").
- A failed milestone read or record never fails the save: the celebration is simply skipped, with a trace.
- The param is `milestone`, repeated once per key, with keys from the fixed set only.
- The interactive planning questions were answered by the agent, as the run's rules required while the owner was away, then confirmed or changed by the owner on 2026-10-13.

## Critical Implementation Details

- **Order inside a route** (F11). Every save first parses and validates the entry. Then, by kind:
  - **A counting save** (a create or an edit rated ≥ `LOG_PENALTY_MIN_RATING`):
    1. Read `before = listSeenEntries`. A failure is traced and `before` is treated as unknown.
    2. Write the entry.
    3. On success, read `after`, even if `before` failed.
    4. Record `reached(before) ∪ reached(after)` (key and `reachedNight`, the `after` night where both have it) in one insert. The insert ignores duplicates and returns the keys it stored, `inserted`.
    5. `celebrate = newlyReached(beforeStates, afterStates) ∩ inserted`, in `MILESTONES` order. If `before` failed, `celebrate` is empty: without `before` the save can't tell new from old.
  - **An edit to 1-2, or a delete:**
    1. Read `before`.
    2. Record `reached(before)` (one insert).
    3. Then write or delete.

    Such a save never reads `after` and never celebrates; neither can reach anything.
  - **A create rated 1-2:** no milestone work at all.

  A failed read or record means no celebration, but the redirect still confirms the save; a failed milestone step never blocks the write. The failure is not hidden (plan review F4).
  - **The trace.** `logMilestoneFailure(step, error)`, exported from `celebrate.ts`, is the one logging call: `console.error("milestones: <step> failed", error.name, cause name if any)`, following `src/lib/tonight/build.ts:1227-1231`. `<step>` is a fixed word: `read`, `record`, `list` (the progress page's stored read) or `seen` (the page's existing seen read, F14). The message is never logged, so no coordinates or values. Its single `eslint-disable-next-line no-console -- <reason>` gets one entry in `ALLOWED_DISABLES` (`src/lib/no-console-guard.test.ts`).
  - **A failed record.** The milestone still shows on the page (derived), and the user's next save of any kind except a create rated 1-2 stores it without a celebration. This is accepted: the trace says why.
- **Exactly once, by construction.**
  - The unique key `(user_id, key)` makes the insert store each milestone once per user. Two saves at the same moment can't both get the row back, so they can't both celebrate.
  - Deleting or re-rating the reaching entry touches no milestone row.
  - The param is cleared on show and is in `NOTICE_PARAMS`, so a reload or an offline copy can't replay it.
- **Self-only writes (the test Phase 4 lesson): accepted and pinned.** RLS lets a user insert, change or delete their own `observing_milestones` rows directly through PostgREST, so a user could give themselves a milestone. I chose to accept this deliberately, for four reasons:
  - Only the user's own progress page reads the table. Progress is private (PRD Non-Goals), with no sharing, ranking effect or entitlement. A forged row fools only its author, which is the same reasoning the owner accepted for `sky_checks` and `observations` on 2026-10-09.
  - A server-owned table (`SERVER_OWNED`, writes revoked) can't be written by the app: the Worker has no secret key, and SECURITY DEFINER functions are banned in `public`.
  - A SECURITY INVOKER RPC needs the same insert grant, so it would harden nothing.
  - Re-checking the rule in SQL would duplicate the TypeScript rule, which is exactly what S-05 avoided.

  The db test pins the accepted behaviour, so a later hardening is a visible decision, not drift. `test-plan.md`'s accepted-gap line names the new table.
- **The param never carries a value.**
  - `milestone` values are keys from `MILESTONES`, and the readers validate them against the set.
  - The redirect appends them to the URL the route already builds, for example `?logged=M31&milestone=first-galaxy&milestone=messier-10`. Order follows `MILESTONES`.
- **Where the celebration renders** (F3, F12). Signed in only, with keys validated by `isMilestoneKey`; the signed-out landing, the auth pages, `/offline` and `/design` (outside specimens) never show it, so a crafted link can't celebrate for a visitor. One helper, `readMilestoneParam(url, user): MilestoneKey[]` in `redirect.ts`, reads and validates the keys for every render site. Where each variant renders:
  - **Banner (A):**
    - On `/log`, at the top of `<main>` (the page renders it after its header).
    - On Tonight pages, **inside the server island, right under its sky**. On those pages the sky belongs to the island: `GearShell skyFlow` starts `<main>` with it, and a shell-rendered banner would split the one sky (`GearShell.astro:9-14`).
    - The Tonight shells (`tonight.astro`, `tonight/targets.astro`, `planets.astro`, `moon.astro`) pass the keys to their island as a `milestones` prop beside `notice`, the existing notice-key path (`planets.astro:21-31`, `pickTonightNotice`). The island's own `Astro.url` carries no page query.
    - The islands (`TonightContent`, `TargetsPageContent`, `PlanetsPageContent`, `MoonPageContent`) render the banner after their sky. The island's encrypted props carry only fixed keys.
  - **Dialog (C):** may stay in `GearShell`. A modal is position-independent.
  - **Screen (B):** the routes redirect to its own page, which renders it.

  Phase 6 keeps only the chosen site.

## Phase 1: The milestone model

### Overview

A pure, fixed, ordered milestone set and the functions that derive what is reached, and when, from `ObservingProgress`. Driven test-first.

### Changes Required:

#### 1. Milestone model

**File**: `src/lib/progress/milestones.ts` (new; + `milestones.test.ts`)

**Intent**: One place that names the milestones and derives them from S-05's progress model, so the page, the record and the celebration share one rule.

**Contract**:
- `MILESTONES` is a readonly ordered list of `{ key, kind }` (owner decision 1):
  - `first-moon`: the Moon has a `firstNight`;
  - `first-planet`: any planet in `firsts`;
  - `all-planets`: all 7 planets;
  - `first-galaxy`, `first-globular`, `first-nebula`: by checklist `type`, over both checklists, with `NEBULA_TYPES` as in owner decision 1;
  - `messier-10`, `messier-25`, `messier-50`, `messier-110`;
  - `caldwell-all`: every item in the Caldwell checklist (61).
- `type MilestoneKey`, plus `isMilestoneKey(value)`, which is island-safe (no catalogue import), for the param readers.
- `milestonesOf(progress: ObservingProgress): MilestoneState[]` returns, in `MILESTONES` order, `{ key, reachedNight: string | null, progress?: { seen: number; total: number } }`.
  - `progress` is present only for count and all-of-a-set milestones.
  - `reachedNight` is the night the milestone was reached, derived from `firstNight`s as in Key Discoveries.
- `newlyReached(before: readonly MilestoneState[], after: readonly MilestoneState[]): MilestoneKey[]` returns the keys reached in `after` but not in `before`, in `MILESTONES` order.
- The module imports only the progress types and catalogue type names. It has no I/O.

**Tests**: hand-written `LogEntry[]` fed through `observingProgress`, never a hand-built progress object (test-plan §6.3).
- An object logged only at rating 2 reaches nothing.
- The 10th distinct Messier object reaches `messier-10` on the night of the 10th earliest first night.
- Two entries for one object count once.
- A planetary nebula reaches `first-nebula`; a globular does not.
- `all-planets` waits for the seventh planet and is dated at its first night.
- `newlyReached` is empty for an unchanged log and for an added rating-2 entry.
- Removing the reaching entry un-reaches the derived state. The stored record is Phase 2's job.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/progress/milestones.test.ts` passes, including the rating-2-reaches-nothing and unchanged-log-reaches-nothing cases
- `npx astro check`, `npm run lint` and `npm test` pass

**Implementation Note**: Test-first (`/10x-tdd`). Commit the phase on green, without asking.

---

## Phase 2: The milestone table

### Overview

A per-user `observing_milestones` table that stores each reached milestone once, with RLS, its `TABLES` entry, db tests and generated types, plus the store module the routes and the page use.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261013120000_observing_milestones.sql` (new)

**Intent**: A durable, once-per-user record of reached milestones that outlives the log entries (owner decision 2).

**Contract**: the header comment follows `20261003120000_sky_checks.sql`: purpose, ownership, the accepted self-only writes and why, and "additive, safe to push before the app deploy".
- Table `public.observing_milestones`:
  - `id uuid primary key default gen_random_uuid()`;
  - `user_id uuid not null default auth.uid() references auth.users (id) on delete cascade`;
  - `key text not null`, with a check that it is one of the 11 keys;
  - `reached_night date not null`;
  - `created_at timestamptz not null default now()`;
  - `constraint observing_milestones_user_key_key unique (user_id, key)`. Its index leads with `user_id`, so no separate `user_id` index is needed.
- `enable row level security`, and four policies `to authenticated`, `observing_milestones_{select,insert,update,delete}_own`, each keyed on `(select auth.uid()) = user_id`. Update has `using` and `with check`. Nothing is granted to `anon`.
- No function.

#### 2. Tests and types

**Files**: `tests/db/tables.ts`, `tests/db/isolation.test.ts`, `tests/db/milestones.test.ts` (new), `src/lib/database.types.ts` (generated), `context/foundation/test-plan.md`

**Intent**: Prove isolation and the once-only record outside the UI, and keep the accepted gap visible.

**Contract**:
- `TABLES` gains `{ table: "observing_milestones", valid: { key: "first-moon", reached_night: "2026-09-26" }, change: { reached_night: "2026-09-27" } }`.
- `isolation.test.ts`: every row A inserts is deleted by A after its test (`afterEach`, over the ids `insertAsA` returned). This lets a table with a per-user unique key run the shared suite. The existing tables only lose leftover rows.
- `milestones.test.ts`, through PostgREST with two signed-up users, like `sky-checks.test.ts`:
  - `milestoneStore.record` stores new keys and returns them. A second record of the same key returns nothing and leaves the first `reached_night` unchanged (the once-only insert).
  - Every key in `MILESTONES` is accepted, and an unknown key is refused with code `23514`. This keeps the SQL check and the TypeScript set in step.
  - **Accepted self-only write (pinned):** the owner can insert a milestone row directly, and it is the owner's alone; B doesn't see it. A comment cites the decision.
  - B's record never touches A's rows. Isolation covers the rest.
- `npm run db:types` regenerates `database.types.ts`.
- `test-plan.md:166`: the accepted-gap line names `observing_milestones` with `sky_checks` and `observations`.

#### 3. Store

**File**: `src/lib/observations/milestone-store.ts` (new)

**Intent**: Every milestone DB call in one place, matching `store.ts`.

**Contract**:
- `milestoneStore.listReached(client): Promise<Map<MilestoneKey, string>>` returns each stored key with its `reached_night`. At most 11 rows per user, so `max_rows` never applies. Unknown keys are dropped.
- `milestoneStore.record(client, states: { key; reachedNight }[]): Promise<MilestoneKey[]>`:
  - It does `upsert(rows, { onConflict: "user_id,key", ignoreDuplicates: true }).select("key")` and returns the keys actually inserted.
  - An empty input makes no request.
  - Errors throw `LOAD_FAILED`-style with a cause, as `listSeenEntries` does.

### Success Criteria:

#### Automated Verification:

- `npm run test:db` passes, run with `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SECRET_KEY` and `DB_URL` from `npx supabase status -o env`, after the migration is applied locally (see "Running the checks"). Isolation and structure cover `observing_milestones`.
- `npm run db:types && git diff --exit-code src/lib/database.types.ts` shows the committed types match after commit (CI's drift check)
- `npx astro check`, `npm run lint` and `npm test` pass

**Implementation Note** (F13). The local Supabase is shared with another agent. The orchestrator approved `npx supabase migration up` on 2026-10-13: additive only, never reset, reseed or down-migrate. The migration history records the version once, so:
1. Write the migration, `milestones.test.ts` and the `TABLES` entry first, and review the SQL until it is final.
2. Run `npx supabase migration list --local` and note the result. Then `npx supabase migration up` once.
3. After that, never edit `20261013120000_observing_milestones.sql`. Any later SQL change (red-green here, impl review) goes into a **new** migration file on this branch.
4. A local revert (dropping the table and its history row) is destructive and needs the owner's permission.

Until this branch merges, other checkouts on the same stack see the table: their `db:types` drifts and their `structure.test.ts` flags `observing_milestones` as unclassified. The orchestrator tells the other agent. Commit on green without asking.

---

## Phase 3: Recording at save

### Overview

Both save routes store what the save reached, and carry the newly stored milestones to the returning page as a fixed param. Nothing renders the celebration yet. Phase 6 does.

### Changes Required:

#### 1. Routes

**Files**: `src/pages/api/log/index.ts`, `src/pages/api/log/[id].ts`, `src/pages/api/log/[id]/delete.ts`, `src/lib/observations/redirect.ts`, `src/lib/observations/celebrate.ts` (new), `src/lib/no-console-guard.test.ts` (+ tests)

**Intent**: Store every reached milestone and celebrate exactly what this save newly stored, only for a rating that can count.

**Contract**:
- `reachedBySave({ read, record, counts, write })` in `src/lib/observations/celebrate.ts`. It does I/O, so it isn't in the pure `src/lib/progress/` (plan review F8).
  - `counts: boolean`: whether this save can reach something (create or edit rated ≥ 3).
  - Its seams are `read: () => Promise<LogEntry[]>` and `record: (states) => Promise<MilestoneKey[]>`. The routes pass `() => observationStore.listSeenEntries(supabase)` and `(s) => milestoneStore.record(supabase, s)`.
  - It follows the order in Critical Implementation Details: counting, or before-only (`counts: false`).
  - It returns `{ result, celebrate: MilestoneKey[] }`. A failed read or record yields `celebrate: []` and calls `logMilestoneFailure` (F4, F14). A failed write returns the write's failure unchanged.
- `logMilestoneFailure(step: "read" | "record" | "list" | "seen", error)` in `celebrate.ts`: the one allowlisted `console.error` (F14).
- The routes:
  - **Create:** calls the helper only when the rating is ≥ 3 (the create short-circuit).
  - **Edit:** always calls it, with `counts` from the new rating.
  - **Delete:** calls it with `counts: false` around `observationStore.remove`, and its redirect is unchanged.
- `withMilestones(url, keys)` in `redirect.ts` appends one `milestone=<key>` per key.
- Both routes use the helper and wrap their existing success redirect in `withMilestones`. Error redirects are unchanged.
- `src/lib/offline/copies.ts` (+ `copies.test.ts`): `"milestone"` joins `NOTICE_PARAMS`, so a Tonight URL with `?milestone=first-galaxy` is never stored.
- Tests (`celebrate.test.ts`, with fakes for the seams, no `vi.mock`):
  - the create route's short-circuit: a create rated 2 never calls the helper (a route-level unit, or the e2e step 1);
  - `counts: false` (edit to 1-2, delete) reads and records the before-state, then writes, and celebrates nothing;
  - an edit that moves `first-galaxy` away (M31 → M13) records `first-galaxy` from `before`;
  - a failed before-read still writes, reads and records the after-state, and celebrates nothing;
  - a failed write records and celebrates nothing;
  - a write that reaches `first-galaxy`, which `record` inserts, celebrates it;
  - a newly reached key that `record` doesn't return (already stored) is not celebrated;
  - a key reached before and after (backfill) is recorded but not celebrated;
  - a failed record celebrates nothing and logs the fixed line.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/observations/celebrate.test.ts src/lib/offline/copies.test.ts src/lib/no-console-guard.test.ts` passes
- `npx astro check`, `npm run lint` and `npm test` pass

**Implementation Note**: Routes are proven end to end by Phase 4's e2e, where the band shows the stored row after the entry is deleted. Commit on green without asking.

---

## Phase 4: Milestones on the progress page

### Overview

The "Milestones" band on `/log/progress`, listing every milestone with its reached night or how far along the user is.

### Changes Required:

#### 1. Band

**Files**: `src/pages/log/progress.astro`, `src/components/progress/MilestoneList.astro` (new), `src/lib/progress/milestones.ts` (+ test), `src/pages/design.astro`, `src/i18n/messages/en.ts`, `pl.ts`

**Intent**: Every milestone reached stays listed (FR-041, US-06), next to the ones still ahead (owner decision 4).

**Contract**:
- `withStored(states, stored: Map<MilestoneKey, string>): MilestoneState[]` in `milestones.ts` (pure, tested). A stored key is reached on its stored night, which wins over the derived one. Otherwise the derived state stands, so milestones reached before this change still show. `progress` comes from the derived state.
- The page reads `milestoneStore.listReached` next to its existing seen read (one extra request) and passes `withStored(milestonesOf(progress), stored)` to the band. A failed stored read falls back to the derived states and calls `logMilestoneFailure("list", …)`.
- The page's existing seen read has a silent `catch {}` (`progress.astro:30-32`, S-05). It now calls `logMilestoneFailure("seen", …)` too, so it leaves a trace (F14).
- **Empty state with stored milestones:** a user who deleted every entry still has stored milestones. The page then shows the empty-state notice and the band with those milestones reached. This is intended: the notice is about the log, the band about what was reached (F14).
- `MilestoneList` renders a `Band` (`progress.milestones.title`) placed first among the bands, after the page's empty-state notice (`data-progress-empty`, `progress.astro:60`) when the log is empty (F9). It holds a `divide-y` list in `MILESTONES` order:
  - **Reached:** a lucide `Check` (`aria-hidden`), the name (`text-heading`), and `progress.milestones.reachedOn({ date })` via `createFormatter(locale).formatShortDate`.
  - **Not yet:** a muted name and `progress.milestones.notYet`, or `progress.milestones.progress({ seen, total })` for count milestones.
  - Each row carries `data-milestone={key}` and `data-reached` (present only when reached) for e2e.
  - Red mode tells the two apart by icon and weight, not hue.
- Copy: `progress.milestones.name.<key>` for all 11, `progress.milestones.{title, reachedOn, notYet, progress}`. EN and PL; PL is gender-neutral where it refers to objects.
- `/design` gets a `MilestoneList` specimen (none reached, some reached) in the 7-state matrix.

#### 2. e2e

**File**: `tests/e2e/observing-milestones.spec.ts` (new)

**Intent**: Prove the record end to end: stored at save, never for 1-2, kept after a delete.

**Contract**: one test, "records a milestone once, at save, and keeps it listed". It runs from a fresh Madrid user on the all-clear fixture, so nothing depends on test order (plan review F6):
1. `/log/new?object=M31&from=log` rated 2 → `/log/progress` shows `first-galaxy` not reached.
2. Edit that entry to 4 → `first-galaxy` reached, on the entry's night.
3. `/log/new?object=jupiter&from=planets` rated 3. Navigating straight to the form doesn't depend on Jupiter being up tonight. → `first-planet` reached; `messier-10` not reached and showing "1 / 10".
4. Edit the M31 entry to M13, still rated 4 → `first-galaxy` is still reached, and `first-globular` is now reached (F11).
5. Delete that entry → `first-galaxy` and `first-globular` are still reached, on their stored nights.

Rows are located by `[data-milestone="…"]` and `[data-reached]`. Expected copy comes from the catalogue (`en.progress.milestones.*`) and dates from `formatShortDate`.

### Success Criteria:

#### Automated Verification:

- `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test tests/e2e/observing-milestones.spec.ts tests/e2e/tonight-phone.spec.ts` passes (preview on 4333 and fixture on 4400 already running, `nvm use` prefix; see "Running the checks"). The phone spec covers `/log/progress` for a fresh user only, so dates and PL wrapping are manual check 4.3.
- `npx vitest run src/lib/progress/milestones.test.ts`, `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass

#### Manual Verification:

- Screenshots of `/log/progress` (none reached; several reached) in EN/PL × dark/light/red at 390 px and desktop: the band reads first, reached vs not yet distinguishable in red mode, PL wraps at 320 px

**Implementation Note**: Commit on green without asking.

---

## Phase 5: The celebration design step (stop for the owner)

### Overview

The owner wants something bigger than a toast (owner decision 3). This phase builds three variants as working prototypes, captures a screenshot matrix, and **stops the run** with a "QUESTION FOR OWNER:" block in Polish. Phase 6 doesn't start until the owner picks.

### Changes Required:

#### 1. The variants

**Files**: `src/components/progress/MilestoneCelebration.astro` (new), `src/components/gear/GearShell.astro`, `src/pages/log/index.astro`, `src/lib/observations/redirect.ts` (`readMilestoneParam`), the Tonight shells (`src/pages/tonight.astro`, `tonight/targets.astro`, `planets.astro`, `moon.astro`) and islands (`TonightContent`, `TargetsPageContent`, `PlanetsPageContent`, `MoonPageContent`), `src/pages/design.astro`, `src/i18n/messages/en.ts`, `pl.ts` (F12)

**Intent**: Let the owner compare real renders, not descriptions.

**Contract**: one component with a `variant` prop, so the pick keeps one branch by editing, with no file to delete:
- **A, banner** („Baner pod nagłówkiem”):
  - A ruled panel at the top of the page's content: on `/log` under the page header, and on Tonight pages inside the island, right under its sky (F12; see "Where the celebration renders").
  - Contents: an `Award` icon in a chip, "Milestone reached", the names at `text-title`, the night, a "See your progress" `action` link and a × close.
  - No timer: it stays until closed or the user leaves. The save's own toast shows as usual.
- **B, screen** („Osobny ekran gratulacji”):
  - The save would redirect to a page of its own. It has a full night-sky header with stars (`TonightSky night`), a large `Award`, the name at `text-display`, the night, and a "what's next" line (progress toward the next count milestone, for example "Next: 25 Messier objects, 10 / 25"). The prototype uses a fixed example for that line, because `GearShell` has no progress; Phase 6's real page reads it (F14).
  - A primary "Continue" returns to the page the save named. A second link opens progress.
  - It interrupts the flow, which only happens on a milestone.
- **C, dialog** („Okno gratulacji”):
  - A native modal `<dialog>` opened over the returning page. It is a `night-sky` card with a few CSS stars, still under `prefers-reduced-motion`, with `Award`, the names and the night.
  - "Continue" closes it and returns focus. "See your progress" opens the page. Esc closes it.
- **Prototype wiring.** It is dev only and removed in Phase 6.
  - `devCelebrationVariant(params, import.meta.env.DEV)`, a pure function in `milestones.ts`, reads `?celebration=a|b|c` and returns `null` unless dev.
  - The variant renders where it would in production: A through the `/log` page and the islands' `milestones` prop, with the variant passed beside the keys; C in `GearShell`.
  - B is shown by `GearShell` in place of the page content, which is what its own page would show.
  - The production build ignores the param.
- `/design` gets the three variants as specimens (one milestone, three milestones).
- Copy keys under `progress.milestones.celebration.*`, EN and PL. Unused keys are removed in Phase 6.

#### 2. The screenshot matrix

**Files**: none in the repo. The capture spec and its Playwright config live in the scratchpad (`<scratchpad>/milestone-variants/`), so nothing has to be deleted afterwards.

**Contract**:
- Run on `npm run dev -- --port 4333`, because the switch and `/design` are dev only.
- A fresh user logs M31 rated 4 and Jupiter rated 3.
- Then the spec visits `/log?updated=M31&milestone=first-galaxy&celebration=<v>` for each variant, in EN/PL × dark/light/red × 390×844 and 1280×800 (36 shots). Locale and theme are set through the `sidereus-lang` / `sidereus-theme` cookies.
- It also visits `/tonight/planets?logged=jupiter&milestone=first-planet&milestone=all-planets&celebration=<v>`, EN dark, phone and desktop (6 shots, two names).
- Files are named `<variant>-<page>-<locale>-<theme>-<width>.png`, plus an `index.html` contact sheet in the same folder.

### Success Criteria:

#### Automated Verification:

- `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass
- `npx vitest run src/lib/progress/milestones.test.ts` passes, including `devCelebrationVariant` returning `null` when not dev, and `npm run build` passes

#### Manual Verification:

- The 42 screenshots and the contact sheet exist, and each variant is readable in all three themes at both widths
- **STOP:** end the turn with "QUESTION FOR OWNER:" in Polish. It lists the three variants with one line each, the contact sheet path and the screenshot folder, and asks two things: which variant, and whether the save's own toast stays alongside it.

**Implementation Note**: Commit the prototypes on green (they are dev only), then stop. Don't start Phase 6.

---

## Phase 6: The chosen celebration

### Overview

Implement the owner's pick for real, remove the other two variants and the dev switch, and finish the e2e and the docs.

### Changes Required:

The shape depends on the pick. Fixed regardless:

#### 1. The celebration

**Files**: `src/components/progress/MilestoneCelebration.astro`, `src/components/gear/GearShell.astro`, `src/lib/toasts.ts` or the variant's own clearing script, `src/pages/design.astro`, `src/i18n/messages/en.ts`, `pl.ts`. Plus, by pick:
- A: `/log`, the four Tonight shells and their islands;
- B: a new page under `/log` and the routes' redirect;
- C: `GearShell` only.

The other variants' render sites are removed by editing (F12).

**Contract**:
- Only the chosen branch remains. The `?celebration` switch (`devCelebrationVariant` and its test) and the unused copy are removed by editing.
- Renders signed in only, keys validated by `isMilestoneKey`, unknown values ignored (F3).
- The `milestone` param is cleared on show with `replaceState`: through `TOAST_PARAMS` if the variant joins the toast region, else through the same `withoutParams` helper in the variant's script. A reload never replays it.
- If the pick is B:
  - The routes redirect to the screen with the original return path. That path goes through the same check the screen uses, so it is a same-origin path from a fixed set: `/log` or a `TONIGHT_PAGES` path, never a free URL.
  - The return path keeps the save's own notice param, validated with `readLogNotice` / `parseTargetParam`, so the save's toast still shows after "Continue" (F14).
  - The screen page reads `listSeenEntries` itself for its "what's next" line.
- Keyboard: the celebration's link and close are reachable before any timer ends, or there is no timer.
- `/design` keeps the chosen variant's specimens.

#### 2. e2e and docs

**Files**: `tests/e2e/observing-milestones.spec.ts`, `CLAUDE.md`

**Contract**: one new test, "celebrates a milestone once, at save", in the same spec and from a fresh user (F6):
1. M31 rated 2 → no celebration.
2. Edited to 4 → exactly one celebration naming the first galaxy.
3. Reload → none, and no `milestone` in the URL.
4. `/log/new?object=jupiter&from=planets` rated 3 → the celebration naming the first planet on `/tonight/planets`.
5. Delete the M31 entry, then log M31 again rated 5 with the night pinned to `madridDateDaysAgo(3)` → no celebration (already stored).

The celebration is located by its own `data-milestone-celebration` attribute, never by the toast region's generic selector.

`CLAUDE.md` gets a short paragraph:
- `milestones.ts`, `milestone-store.ts` and `celebrate.ts`;
- the `observing_milestones` table, its once-only insert and the accepted self-only writes;
- the `milestone` param (in `NOTICE_PARAMS`);
- the chosen celebration and the band.

### Success Criteria:

#### Automated Verification:

- `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test tests/e2e/observing-milestones.spec.ts tests/e2e/tonight-phone.spec.ts` passes
- `npx astro check`, `npm run lint`, `npm test` and `npm run build` pass, and `npm run test:db` still passes

#### Manual Verification:

- Screenshots of the chosen celebration on `/log` and `/tonight/planets` in EN/PL × dark/light/red at 390 px and desktop: readable, the link reachable by keyboard, red mode legible, nothing hidden behind the TabBar, PL at 320 px
- `/design` specimens for the celebration and `MilestoneList` render in all themes

**Implementation Note**: After this phase, `/10x-impl-review` with Opus reviewers. Then push the feature branch and open one PR (pre-approved at the end of implementation).

---

## Running the checks

S-05's recipe, adapted to this worktree and run:

1. `npm ci` in the worktree, with the `nvm use` prefix.
2. Build `.env` / `.dev.vars` from `npx supabase status -o env` in the scratchpad, then copy them into the worktree (both are gitignored). Never copy them from the main checkout, never print their values, and never point e2e at hosted Supabase.
3. Apply this branch's migration to the shared local stack once, as Phase 2's Implementation Note says: SQL final first, `npx supabase migration list --local`, then `npx supabase migration up`. Approved by the orchestrator, additive only. Never reset, reseed or down-migrate, and never edit the applied file; later changes go in a new migration (F13).
4. Start the forecast fixture (`node tests/e2e/forecast-fixture.mjs`). Its port, 4400, is shared, so confirm it is free or already serving the fixture.
5. `npm run build`, then `npm run preview -- --port 4333`. **Restart the preview after every rebuild**, or a stale build won't hydrate. Phase 5 uses `npm run dev -- --port 4333` instead: stop the preview on 4333 first (F14).
6. `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test <spec>`.
7. `test:db`: `SUPABASE_URL="$API_URL" SUPABASE_KEY="$ANON_KEY" SUPABASE_SECRET_KEY="$SECRET_KEY" DB_URL="$DB_URL" npm run test:db`, with the values sourced from the scratchpad env file and never printed.
8. Tests only create their own users.

## Testing Strategy

### Unit Tests:

- `milestones.test.ts`:
  - derivation per kind;
  - reached nights;
  - ratings of 1-2 change nothing;
  - `newlyReached` empty for unchanged and rating-2 logs;
  - derived un-reaching on removal;
  - `withStored` (the stored night wins, derived fills in).
- `celebrate.test.ts`:
  - the short-circuit at rating < 3;
  - read, write and record failures;
  - the intersection (new and inserted only, backfill silent, re-reach silent);
  - `before ∪ after` recording, and before-only recording on an edit to 1-2 and on a delete (F11).
- `copies.test.ts`: the `milestone` param is not storable.

### db Tests:

- Isolation and structure over `observing_milestones` (via `TABLES`).
- `milestones.test.ts`: the once-only insert, the key check against `MILESTONES`, and the pinned self-only write.

### Integration Tests:

- e2e `observing-milestones.spec.ts`:
  - the record test (Phase 4): rating 2 isn't recorded, re-rating records, a Tonight save records, an edit M31 → M13 keeps `first-galaxy`, and a delete keeps the rows;
  - the celebration test (Phase 6): once, not on reload, on the Tonight page, never again after a delete and a re-log.

### Manual Testing Steps:

1. On a fresh account, log M31 rated 2 from `/log`: no celebration.
2. Edit it to 4: one celebration naming the first galaxy. Reload: gone.
3. Log Jupiter from `/tonight/planets`: the celebration there, and its link opens `/log/progress`.
4. Delete the M31 entry: `/log/progress` still lists the first galaxy. Log M31 again: no celebration.

## Performance Considerations

- A save rated ≥ 3 makes two `listSeenEntries` reads (normally one request each) and one insert of at most 11 rows.
- An edit to 1-2 and a delete make one read and one insert, normally of rows already stored (F11).
- A create rated 1-2 makes none.
- The progress page adds one read of at most 11 rows.
- Tonight's load is unchanged.

## Migration Notes

- `20261013120000_observing_milestones.sql` is additive: a new table, no change to existing tables, no function. It is safe to push before the app deploy. CI's `migrate` job applies it after the merge.
- There is no backfill. Pre-existing milestones are derived on the page and stored by the next save rated 3 or above.
- Rollback is dropping the table; nothing else references it.

## References

- Research: `context/changes/observing-milestones/research.md`
- Plan review: `context/changes/observing-milestones/reviews/plan-review.md`
- PRD: `context/foundation/prd.md:191-203,451,723-725`
- Roadmap: `context/foundation/roadmap.md` "S-06: Observing milestones"
- S-05: `context/archive/2026-10-09-observing-progress/`
- Self-only writes accepted: `context/archive/2026-10-09-testing-access-and-entitlement-boundary/research.md:154`, `context/foundation/test-plan.md:160,166`
- Per-user table pattern: `supabase/migrations/20261003120000_sky_checks.sql`, `tests/db/tables.ts`, `tests/db/sky-checks.test.ts`
- Progress model: `src/lib/progress/progress.ts`
- Notice params: `src/lib/offline/copies.ts:34-35`, `src/lib/toasts.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The milestone model

#### Automated

- [x] 1.1 `npx vitest run src/lib/progress/milestones.test.ts` passes, including the rating-2-reaches-nothing and unchanged-log-reaches-nothing cases — a50c543
- [x] 1.2 `npx astro check`, `npm run lint` and `npm test` pass — a50c543

### Phase 2: The milestone table

#### Automated

- [x] 2.1 `npm run test:db` passes with the migration applied locally; isolation and structure cover `observing_milestones` — 2d6985e
- [x] 2.2 `npm run db:types && git diff --exit-code src/lib/database.types.ts` is clean after commit — 2d6985e
- [x] 2.3 `npx astro check`, `npm run lint` and `npm test` pass — 2d6985e

### Phase 3: Recording at save

#### Automated

- [x] 3.1 `npx vitest run src/lib/observations/celebrate.test.ts src/lib/offline/copies.test.ts src/lib/no-console-guard.test.ts` passes — a8f345e
- [x] 3.2 `npx astro check`, `npm run lint` and `npm test` pass — a8f345e

### Phase 4: Milestones on the progress page

#### Automated

- [x] 4.1 `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test tests/e2e/observing-milestones.spec.ts tests/e2e/tonight-phone.spec.ts` passes — 4fd23eb
- [x] 4.2 `npx vitest run src/lib/progress/milestones.test.ts`, `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass — 4fd23eb

#### Manual

- [x] 4.3 Screenshots of `/log/progress` (none reached; several reached) in EN/PL × dark/light/red at 390 px and desktop: the band reads first, reached vs not yet distinguishable in red mode, PL wraps at 320 px — c94d802

### Phase 5: The celebration design step

#### Automated

- [x] 5.1 `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass — c94d802
- [x] 5.2 `npx vitest run src/lib/progress/milestones.test.ts` passes (incl. `devCelebrationVariant` is `null` outside dev) and `npm run build` passes — c94d802

#### Manual

- [x] 5.3 The 42 variant screenshots and the contact sheet exist in the scratchpad, readable in all themes at both widths — c94d802
- [x] 5.4 The owner picked a variant (QUESTION FOR OWNER answered)

### Phase 6: The chosen celebration

#### Automated

- [x] 6.1 `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test tests/e2e/observing-milestones.spec.ts tests/e2e/tonight-phone.spec.ts` passes — 4b2a799
- [x] 6.2 `npx astro check`, `npm run lint`, `npm test`, `npm run build` and `npm run test:db` pass — 4b2a799

#### Manual

- [ ] 6.3 Screenshots of the chosen celebration on `/log` and `/tonight/planets` in EN/PL × dark/light/red at 390 px and desktop: readable, keyboard-reachable link, red mode legible, nothing behind the TabBar, PL at 320 px
- [ ] 6.4 `/design` specimens for the celebration and `MilestoneList` render in all themes
