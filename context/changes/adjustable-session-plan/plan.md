# Adjustable Session Plan (M-3 S-08) Implementation Plan

## Overview

A full-plan user can reorder, drop and add targets on the Session plan (`/tonight/plan`) for a site and night, and reset it to the suggested plan. Each edit is one row per (user, site, night) in a new per-user table, applied by the server to the freshly computed night, so it reaches every device and the stored offline copy. Editing needs the network. A free account keeps today's suggested plan and sees one line on what editing does and that it needs the full plan (PRD FR-044, FR-045, US-08; roadmap S-08; GitHub #129).

**Owner decisions pending.** The plan is written on the recommended option of every decision D1–D15 (section "Owner Decisions"). The owner answers after `/10x-plan-review`; an answer that differs from the recommendation is applied to this plan before `/10x-implement`.

## Current State Analysis

- **The suggested plan is computed on every request, never stored.** `buildTonight` builds it only under `withSessionPlan` (`src/lib/tonight/build.ts:1099-1252`). Its rows are:
  - the Moon when it is a target;
  - every ranked planet;
  - the ranking's top `MAX_RANKED_OBJECTS` = 5 deep-sky entries (`planObjects`, build.ts:775), present only when the verdict card passes (go or marginal with a dark window, build.ts:748).
  - `layoutSessionPlan` sorts them by peak (`src/lib/tonight/session-plan.ts:93-94`).
- **Window rule.** Every row's window is the engine's `bestWindow`: the longest run at or above the site's minimum altitude (`src/lib/engine/objects.ts:76-105`). Deep-sky is judged over the dark-window track (score.ts:135), the Moon and planets over the planet window with the Sun below −6° (planet-ranking.ts:106-113).
  - `rankObjects` already scores every catalogue object within the telescope's reach. It keeps the washed-out ones (with their window and peak) and the cleared ones, and it drops the below-bar ones after scoring (`src/lib/engine/ranking.ts:215-262`).
- **Plan page.** `/tonight/plan` is `plan.astro` (shell) plus `PlanPageContent.astro` (server island). The island:
  - draws `SessionTimeline.astro`: an `<ol>` of full-width row links (`:115-198`);
  - renders `OfflineCopy` with `data-plan` (`:55`);
  - is not plan-gated (FR-031 is free).
- **Dashboard.** The tile shows `sessionPlan.nextUp` (`src/components/tonight/TonightTiles.astro:52-63, 147-151`).
- **No per-user plan data exists.** The patterns to copy:
  - `sky_checks`: a site-ownership `exists` guard in INSERT and UPDATE `with check` (`supabase/migrations/20261003120000_sky_checks.sql:47-64`);
  - `observing_milestones`: the latest migration, `20261013120000`.
  - The `TABLES` harness inserts a static row with no parent (`tests/db/tables.ts:12-20`; `tests/db/isolation.test.ts:84-91`).
- **Gate.** `requireFullPlan` fails closed and `accountPlanForCopy` is three-valued (`src/lib/account-plan/index.ts:67-100`). No POST route calls `requireFullPlan` yet: this is the first full-plan POST, test-plan §6.4's "A full-plan route".
- **Offline.** `/tonight/plan` is in `TONIGHT_PAGES` (`src/lib/offline/copies.ts:14-22`).
  - A clean online visit stores the shell and island pair.
  - The worker refreshes the `?night=next` copy at most hourly (copies.ts:45, 480-484).
  - A POST's redirect is followed by the browser as a fresh GET navigation (`sw.ts:664-675`, inference: no spec covers it yet).
  - URLs with a param in `NOTICE_PARAMS` are never stored (copies.ts:48).
  - The plan-loss drop is finder-only (copies.ts:375-418).
- **UI in flight.** `ui-quiet-actions` (`feat/ui-refine`, Phase 1 uncommitted) introduces `hairline`/`sm`, `quiet`/`bare` and `--control-border`, and later removes `action`. It leaves the Session plan rows untouched.

Full evidence: `context/changes/adjustable-session-plan/research.md`.

## Desired End State

- **A full-plan user on a night that passes** (go or marginal with a dark window, D5):
  - opens `/tonight/plan`, taps "Edit plan", moves rows up and down, removes rows, adds any object their telescope can reach that has a window tonight (or a planet or the Moon they removed), and taps "Save";
  - lands on a clean `/tonight/plan?site=<id>` showing their list in their order, each row with its own window and best time, under an "Edited · Reset to suggested" line;
  - sees the same plan on another device, and offline on the device that last loaded it online;
  - sees the dashboard tile follow it.
- **Reset** asks once, then shows the suggested plan again.
- **A stored target with no window on the night of rendering** is never drawn as a row: it is listed, muted, under "Not on tonight's plan". Examples: the site's minimum altitude was raised, another telescope cannot reach it.
- **A free account** sees the suggested plan as today, plus one muted line with a lock: what editing does and that it needs the full plan.
- **A failed plan or edits read** shows the suggested plan with a muted line and stores no offline copy, so a stored edited copy is not overwritten.
- **The server enforces it all.**
  - The save and reset routes refuse a free account with `?error=errors.accountPlan.needsFull` before any read or write.
  - The island shows edits only after its own plan check.
  - RLS keeps every row to its owner and its owner's site.
  - Every saved key has a window at the site that night.

Verify with `npm test`, `npm run test:db`, `npm run smoke` (the plan steps) and `tests/e2e/session-plan-edit.spec.ts` against a local preview.

### Key Discoveries:

- `rankObjects` already computes a window for every reachable object; it only discards the below-bar ones after scoring (`src/lib/engine/ranking.ts:236`). Exposing them gives the "add" pool without new window code.
- Rows lose their raw window in layout; `nextUp` keeps a local `windowEnds` map (`build.ts:1190`). Edited rows need the same.
- `visibility-invariants.test.ts:205-240` asserts that the plan equals the ranking, planets and Moon. An edited plan needs its own invariant, and the existing one must still hold when no edits are stored.
- A React island already hydrates inside a Tonight server island (`TonightContent.astro:132`, `TonightSkyView client:load`). `TargetPicker` (`src/components/observations/TargetPicker.tsx`) wraps the shared `Combobox` for target keys.
- `NOTICE_PARAMS` would keep a save-redirect URL out of storage, so device A's copy would stay stale until its next visit (copies.ts:48, research §5). D7 avoids it.

## Owner Decisions (pending; plan written on the ⭐ recommendation)

| #   | Decision                                                | ⭐ Recommended                                                                                                                                                                                           | Alternatives                                                                                                                                                                                    |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | What is stored                                          | **The whole ordered list of keys** per (user, site, night); reset deletes the row; a later change in the suggestion (log, forecast, telescope) does not alter a saved list                               | A diff (dropped, added, order) applied to each fresh suggestion: newly suggested targets join automatically, but the order of a moving list is ambiguous                                        |
| D2  | Meaning of order                                        | **List position only**: each row keeps its own window and best time from the sky; nothing is "scheduled"                                                                                                 | (b) as recommended plus a muted hint on a row whose window ends before the previous row's best time; (c) the plan assigns time slots in sequence (new scheduling logic, guardrail on the slots) |
| D3  | What "add" offers                                       | **Every object the telescope can reach** (scored by the ranking, including below-bar and washed-out) with a window that night, plus a planet or the Moon from tonight's suggestion that the user removed | (b) only the Targets page's lists (cleared and washed-out); (c) every catalogue object with a window, ignoring the telescope's reach                                                            |
| D4  | A saved target without a window on render               | **A muted "Not on tonight's plan" list** with each name, removable in the editor; never a row                                                                                                            | Silently left out                                                                                                                                                                               |
| D5  | Nights that do not pass (weather no-go, no dark window) | **Edits apply and the editor shows only when the night passes** (the suggestion's own gate); otherwise today's explanation, plus one line that saved changes return when the night clears                | Editable on every night with a dark window, with deep-sky rows from astronomical windows beside a no-go verdict                                                                                 |
| D6  | Interaction                                             | **An editor island**: "Edit plan" opens a compact list with Move up / Move down / Remove per row, an "Add a target" picker, then one Save (one POST) or Cancel                                           | (b) a plain POST form per action (each tap reloads the page); (c) drag and drop (new library, keyboard and a11y work)                                                                           |
| D7  | Save confirmation                                       | **No toast**: the save redirects to the clean `/tonight/plan?site=<id>`, which is stored at once; the "Edited" line is the confirmation                                                                  | (b) a toast plus a new worker message that re-stores the clean page; (c) a toast, with device A's stored copy stale until its next visit (weakens FR-044)                                       |
| D8  | Reset                                                   | **Asks once** in a token-styled `alertdialog` (`DeleteButton`'s pattern)                                                                                                                                 | Resets at once                                                                                                                                                                                  |
| D9  | Which nights                                            | **Tonight only** (before sunset that is the evening ahead)                                                                                                                                               | Also the next night (`?night=next`)                                                                                                                                                             |
| D10 | Free account                                            | **One muted line with a lock** above the plan, like Targets' `data-expect-locked`                                                                                                                        | An explainer with an example, like `FinderLocked`                                                                                                                                               |
| D11 | OQ23 after the plan is lost                             | **Edits stay in the database and come back if the plan returns**; the island shows the suggested plan; a stored edited copy is replaced at that page's next online answer (no worker change)             | (b) the worker drops stored plan pages at the first `free` answer, like finder charts; (c) delete the user's edits when the plan is lost                                                        |
| D12 | Site deleted                                            | **`on delete cascade`**: its plans go with it (new in the repo; `site_id` NOT NULL, small harness extension)                                                                                             | `on delete set null` plus a name snapshot, like `sky_checks` (orphans that nothing reads)                                                                                                       |
| D13 | Dashboard tile                                          | **Follows the edited plan** (first row in the user's order whose window has not ended)                                                                                                                   | Always the suggested plan                                                                                                                                                                       |
| D14 | Failed plan or edits read                               | **Suggested plan + one muted line, no `OfflineCopy`**, so the device keeps its earlier stored copy                                                                                                       | Treat as free (shows nothing of the edits, and the stored edited copy is overwritten)                                                                                                           |
| D15 | Coordination with ui-quiet-actions                      | **Phase 4 (UI) waits for ui-quiet-actions to merge** and rebases onto it; Phases 1-3 proceed now                                                                                                         | Build on today's `action` and migrate when it lands                                                                                                                                             |

## What We're NOT Doing

- No offline editing or later sync (roadmap Parked; FR-044). Every edit control carries `data-needs-network`.
- No editing of any night but tonight (D9), and no edits on a night that does not pass (D5).
- No time slots or sequencing (D2). The rows keep the sky's windows; overlapping windows are still shown side by side (session-plan-timeline decision).
- No drag and drop (D6).
- No change to the live sky's markers (the ranking's top 5) or to `/tonight/targets`.
- No worker change for plan loss (D11) and no new offline page: `/tonight/plan` is already in `TONIGHT_PAGES`.
- No payments or plan upsell link (M-3 has none).
- No cleanup of past nights' rows: one small row per edited site and night.
- No change to `/tonight/plan`'s shell gating: the page stays free (FR-031), and only editing and edited rows are gated.

## Implementation Approach

The work runs data-up, like every per-user feature:

1. Table, RLS, store and schemas, with DB tests.
2. A pure rule that applies a saved list to the freshly built night, with the guardrail proven by invariant tests.
3. The full-plan save and reset routes, with HTTP checks.
4. The page, editor, tile, `/design` and e2e (after ui-quiet-actions merges).
5. Docs.

The guardrail lives in one place: a row exists only when the engine's own window rule gives the key a window that night. That is the suggestion's row for keys it holds, and for added deep-sky keys the ranking's window over the dark window. The write route also refuses a key without an astronomical window.

## Critical Implementation Details

- **Order of reads in the island.** `loadTonight` resolves the site and the night date before `buildTonight`. The saved list must be read between those two steps, through an optional async hook, so it is applied inside the one build. The plan check comes first: `requireFullPlan` decides whether the hook runs at all. A signed-out island replay or a free one never reads the table.
- **Night race at dawn.** The form posts the night date it was rendered for. The route accepts it only when it equals `tonightDateFor(now, site.timeZone)`, so a save made across the rollover never lands on the wrong night (`errors.sessionPlan.nightOver`).
- **Offline copy on failure (D14).** In the failure states the island omits `OfflineCopy`. The worker then has no `[data-offline-copy]` to commit (copies.ts `copyMetaFor`), so the earlier stored copy, possibly edited, survives.

## Phase 1: Table, store and isolation

### Overview

The `session_plans` table with RLS and the site guard, generated types, the `TABLES` entry with a site parent, a table-specific DB suite, and the store and schemas the routes and island use.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261014120000_session_plans.sql`

**Intent**: Store one edited list per user, site and night, readable and writable only by its owner, and only for the owner's own site. It is additive, so it is safe to migrate before the app deploys.

**Contract**:

- Table `public.session_plans`:
  - `id uuid pk default gen_random_uuid()`;
  - `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`;
  - `site_id uuid not null references public.sites(id) on delete cascade` (D12);
  - `night date not null`;
  - `targets text[] not null`;
  - `created_at` and `updated_at timestamptz not null default now()`.
- Unique `(user_id, site_id, night)`. Indexes on `user_id` and `site_id`.
- Checks:
  - `cardinality(targets) <= 30`;
  - `array_position(targets, null) is null`;
  - `array_to_string(targets, ',')` matches `^(KEY(,KEY)*)?$`, where KEY is the `observations_target_key` alternatives (`supabase/migrations/20261006190000_observation_target_deep_sky.sql:17-21`).
  - An empty list is valid: the user removed everything.
- RLS on, four `to authenticated` policies `session_plans_{select,insert,update,delete}_own` on `(select auth.uid()) = user_id`. INSERT and UPDATE `with check` also require `exists (select 1 from public.sites s where s.id = site_id and s.user_id = (select auth.uid()))`, as in sky_checks.sql:47-64.
- No functions and no grants beyond the defaults.

#### 2. Generated types

**File**: `src/lib/database.types.ts`

**Intent**: Regenerate with `npm run db:types`; never hand-edit.

**Contract**: `Tables<"session_plans">` exists.

#### 3. Isolation harness and entry

**File**: `tests/db/tables.ts`, `tests/db/isolation.test.ts`

**Intent**: Run the generic suite on a table whose rows need the owner's site.

**Contract**:

- `TableCase` gains an optional `needsSite: true`. For such an entry, `isolation.test.ts` creates a site as A in `beforeAll` and merges its id into `valid` as `site_id`.
- B's cross-user insert keeps A's `site_id` and `user_id`, so the expected refusal stays `42501`.
- The entry: `{ table: "session_plans", needsSite: true, valid: { night: "2026-10-14", targets: ["M31", "jupiter"] }, change: { targets: ["M42"] } }`.

#### 4. Table suite

**File**: `tests/db/session-plans.test.ts`

**Intent**: Pin what the generic suite cannot see, each case with a positive control in the same test.

**Contract**:

- B cannot insert or update a row pointing at A's site under B's own `user_id` (`42501`).
- A second insert for the same (site, night) violates the unique key, and `upsert` on `user_id,site_id,night` replaces the row.
- Deleting the site deletes its plans.
- The shape checks reject each of these with `23514`:
  - `M111`;
  - `NGC0`;
  - `Foo`;
  - a `null` element;
  - 31 elements.
- An empty list is accepted.

#### 5. Store and schemas

**File**: `src/lib/session-plans/store.ts`, `src/lib/session-plans/schemas.ts`, `src/lib/session-plans/store.test.ts`

**Intent**: Every DB call for edits sits in one module that returns fixed keys and never logs, plus the zod schema the save route and the editor share.

**Contract**:

- `sessionPlanStore`:
  - `get(client, siteId, night): Promise<TargetKey[] | null>` reads one row with `.eq().eq().maybeSingle()`. `null` means no edits. On error it throws `new Error("errors.load.sessionPlan", { cause })`.
  - `save(client, siteId, night, targets): Promise<WriteResult>` is an upsert on `user_id,site_id,night` that sets `updated_at`.
  - `reset(client, siteId, night): Promise<WriteResult>` deletes the row.
- `savePlanSchema` (island-safe):
  - `site` is a uuid;
  - `night` is `YYYY-MM-DD`;
  - `targets` is the repeated form field, each `isTargetKey` and `isKnownTarget`, with no duplicates and at most `SESSION_PLAN_MAX_TARGETS` = 30;
  - errors are message keys.
- `resetPlanSchema` has `site` and `night`.
- New keys `errors.save.sessionPlan`, `errors.load.sessionPlan`, `errors.sessionPlan.nightOver` and `errors.sessionPlan.notVisible` in `en.ts` and `pl.ts`.

### Success Criteria:

#### Automated Verification:

- The migration applies to the shared local stack without a reset: `npx supabase migration up`
- Types regenerate with no drift: `npm run db:types` then `git diff --exit-code src/lib/database.types.ts` after the commit
- `npm run test:db` passes, including the structure suite (four policies on `session_plans`), the isolation suite on `session_plans` and `tests/db/session-plans.test.ts`
- Store and schema unit tests pass: `npx vitest run src/lib/session-plans`
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- Break check: drop the site guard from the INSERT policy; `session-plans.test.ts` turns red; revert

**Implementation Note**: After this phase passes, pause for the human's confirmation before Phase 2.

---

## Phase 2: Applying edits to the night

### Overview

A pure rule turns a saved list and the freshly built night into the plan's rows. Through `buildTonight` the edited plan, its "not tonight" keys, the add candidates and the tile's `nextUp` come out of one build, and invariant tests prove that no edit ever puts a row outside its window.

### Changes Required:

#### 1. Every reachable object's window

**File**: `src/lib/engine/ranking.ts`, `src/lib/engine/ranking.test.ts`

**Intent**: Expose the windows `rankObjects` already computes for every object the telescope can reach, below-bar ones included. They become the add pool and the source of added rows, with no second window rule.

**Contract**:

- `rankObjects` returns `reachable: { object, window, peak, washedOut: boolean }[]`: every object with a non-null score, cleared, below-bar and washed-out alike, in catalogue order.
- `entries`, `washedOut`, `clearedCount` and every existing ordering are unchanged. The calibration and ranking suites stay green with no snapshot edit.

#### 2. The edit rule

**File**: `src/lib/tonight/plan-edits.ts`, `src/lib/tonight/plan-edits.test.ts`

**Intent**: One pure function decides which saved keys become rows, in the user's order, and what the editor may add.

**Contract**: `applyPlanEdits({ suggested, saved, reachable })` returns `{ rows, notTonight, candidates, edited }`.

- `saved === null` gives exactly `suggested`, with `edited: false`.
- Otherwise each saved key in order becomes:
  - the suggested row when the suggestion has it;
  - else, for a deep-sky key, the row from `reachable`;
  - else a `notTonight` key. That covers a planet or the Moon outside the suggestion, and a deep-sky key that is not reachable (D3, D4).
- `candidates` are the suggested and reachable keys not in `rows`.
- No duplicates, no clock.

#### 3. Layout in the user's order

**File**: `src/lib/tonight/session-plan.ts`, `src/lib/tonight/session-plan.test.ts`

**Intent**: Keep the user's order on the axis.

**Contract**: `SessionPlanInput.order?: "peak" | "given"`. The default is `"peak"` (unchanged). `"given"` keeps the input order and still drops rows that miss the axis.

#### 4. Build wiring

**File**: `src/lib/tonight/build.ts`, `src/lib/tonight/load.ts`, `src/lib/tonight/island.ts`, `src/lib/tonight/build.test.ts`, `src/lib/tonight/load.test.ts`

**Intent**: Apply a saved list inside the one build, with tracks and texts for added rows, only on a night that passes (D5).

**Contract**:

- `buildTonight` options gain `planEdits?: TargetKey[] | null` and `withPlanCandidates?: boolean`.
- With `planEdits`, on a passing night, `rowOf` builds added rows from `reachable` (`rowOf` is extracted, or used in place), and tracks over the axis are computed for added objects.
- On a night that does not pass, edits are not applied, and `heldEdits: true` records that a list is saved (D5).
- `TonightSessionPlan` gains:
  - `edited: boolean` and `heldEdits: boolean`;
  - `notTonight: { key, label }[]`;
  - `candidates: { key, label, detail }[] | null`, where `detail` is "window 21:40–23:10" and `null` unless asked for;
  - `night: string`, the `YYYY-MM-DD` the plan is for.
- `nextUp` over an edited plan: before the axis starts, the first row; during the night, the first row in the user's order whose window has not ended; then `done` (D13).
- `loadTonight` and `loadTonightFor` gain an optional `readPlanEdits(siteId, nightDate) => Promise<TargetKey[] | null>`. It is called after the site and night are resolved and before the build. A throw sets `planEditsError` (a `MessageKey`), and the build proceeds without edits.

#### 5. The guardrail, proven

**File**: `src/lib/tonight/visibility-invariants.test.ts`

**Intent**: Prove that no edit can schedule a target outside its window, over the existing seeded sites, nights, skies and telescopes.

**Contract**:

- The existing "plan equals the ranking, planets and Moon" case still holds with no edits.
- A new seeded case applies random saved lists (subsets and permutations of suggested and candidate keys, plus keys with no window, unknown planets and the Moon on nights it is no target) and asserts:
  - every row lies within its window, recomputed independently as the existing case does;
  - deep-sky rows lie within the dark window;
  - the rows keep the saved order;
  - every saved key is a row or in `notTonight`, never both;
  - a night that does not pass draws no edited row.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `plan-edits.test.ts`, the new `session-plan.test.ts` order cases, the `build.test.ts` edited-plan cases (`nextUp`, `heldEdits`, `notTonight`, candidates) and the new invariant case
- `src/lib/engine/calibration.test.ts` and the ranking suites pass unchanged
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- Break check: let `applyPlanEdits` draw a deep-sky key that is not reachable from a fabricated window; the invariant turns red; revert

**Implementation Note**: After this phase passes, pause for the human's confirmation before Phase 3.

---

## Phase 3: Full-plan save and reset routes

### Overview

The first full-plan POST routes, gated before any read or write. They check the night and the window of every key, then redirect with fixed keys. Smoke proves the gate over HTTP.

### Changes Required:

#### 1. Routes

**File**: `src/pages/api/tonight/plan.ts`, `src/pages/api/tonight/plan/reset.ts`, `src/lib/session-plans/redirect.ts`, `src/lib/session-plans/visible.ts` (+ tests)

**Intent**: Save or reset the user's list for tonight at their own site, refusing anything the plan, the night or the sky does not allow.

**Contract**: Both routes, in order:

1. `!supabase` redirects with `NOT_CONFIGURED`.
2. `requireFullPlan(locals)` not ok redirects to `/tonight/plan?error=<errorKey>`, before any read.
3. Parse the schema; a failure redirects with `issueKey`.
4. `siteStore.get` (own site); none redirects with `errors.notFound.site`.
5. `night !== tonightDateFor(now, site.timeZone)` redirects with `errors.sessionPlan.nightOver`.
6. Save only: every key has an astronomical window at the site that night, through `hasWindow(site, night, key)` in `visible.ts`. That is a pure composition of `darkWindow`, `objectTrack` and `bestWindow` at `site.minAltitudeDeg` for deep-sky, and the planet window plus `planetTracks` or `moonTrack` for the rest. A key without one redirects with `errors.sessionPlan.notVisible`.
7. The store call; failure redirects with `errors.save.sessionPlan`.
8. Success redirects to `/tonight/plan?site=<id>` (D7).

- Error redirects keep `?site=<id>` and add `error=<key>`. Only fixed keys and the site id reach the URL, never coordinates or keys from the form.
- The routes never log.

#### 2. Protected path

**File**: `src/lib/protected-routes.ts`, `src/lib/protected-routes.test.ts`

**Intent**: A signed-out POST goes to sign-in.

**Contract**: Add `/api/tonight`, plus a test case.

#### 3. HTTP checks

**File**: `scripts/smoke.mjs`

**Intent**: The test-plan §6.4 full-plan route recipe, plus the island replay.

**Contract**: New steps after the finder steps, each `needsPlanGrant` where it needs the grant:

1. **plan 1**: free, POST save `→ 302`, `location` exactly `/tonight/plan?site=<id>&error=errors.accountPlan.needsFull`.
2. **plan 2**: grant full. Capture the plan island URL from `/tonight/plan?site=<id>`. Replay it: the body excludes `data-session-plan-edited`, which proves plan 1 wrote nothing.
3. **plan 3**: POST save with an empty `targets` list `→ 302` exactly `/tonight/plan?site=<id>`. A new capture and replay includes `data-session-plan-edited`.
4. **plan 4**: demote. Replay: includes `data-session-plan-locked`, excludes `data-session-plan-edited`.
5. **plan 5**: grant again. Replay includes `data-session-plan-edited` (D11, the edits come back). Then POST reset, and the replay excludes it.
6. **plan 6**: signed out, POST `→ 302` `/auth/signin`, exact.
7. **plan 7**: signed out, replay the island URL. The body has neither marker.

Date note:

- On a night that does not pass at the smoke site, steps 3 and 5 assert `data-session-plan-held` instead of the edited marker (D5), like the finder steps' date window.
- The planned night must equal the route's tonight. The steps read the night date from the shell's form (`name="night"`), never from the runner's clock.

### Success Criteria:

#### Automated Verification:

- Route and helper unit tests pass, including `visible.test.ts` (deep-sky key outside the dark window and under the minimum altitude refused, planet below the horizon refused, a polar-day dark window refused): `npm test`
- `npm run lint` and `npx astro check` pass
- `npm run smoke` against a local preview with the local stack's keys inline passes, including the plan steps

#### Manual Verification:

- Break check: move `requireFullPlan` after the store call; plan 1 turns red; revert

**Implementation Note**: After this phase passes, pause for the human's confirmation before Phase 4.

---

## Phase 4: Plan page, editor and dashboard (after ui-quiet-actions merges, D15)

### Overview

The island reads the plan and the edits and renders one of four states: edited, suggested with the free lock, held, or failure. The editor island lets a full-plan user change and save the list, and the dashboard tile follows. Built on ui-quiet-actions' tiers: rebase onto main after that change merges, before this phase starts.

### Changes Required:

#### 1. Plan island

**File**: `src/components/tonight/PlanPageContent.astro`

**Intent**: Gate the edits in the island and pick the state.

**Contract**:

- `access = await getAccountPlan(locals)` and `read = await accountPlanForCopy(locals)`.
- `access === "full"` passes `readPlanEdits` (the store's `get`) and `withPlanCandidates`.
- Markers on the plan band:
  - `data-session-plan-edited` when `plan.edited`;
  - `data-session-plan-held` when `plan.heldEdits`;
  - `data-session-plan-locked` on the free line, only when `read.plan === "free"` (D10).
- `read.plan === "unknown"` or `planEditsError` shows a muted `tonight.pages.plan.editsUnavailable` line, the suggested plan, and no `OfflineCopy` (D14).
- The editor renders only for `access === "full"`, with no error and `plan.candidates !== null`.

#### 2. Timeline

**File**: `src/components/tonight/SessionTimeline.astro`

**Intent**: Draw an edited plan in the user's order and say it is edited.

**Contract**:

- The "Edited" line with the Reset control above the rows when `edited`.
- The `notTonight` list, muted, under the rows (D4).
- An edited empty list reads `tonight.pages.plan.editedEmpty` with Reset.
- Rows stay full-width links.

#### 3. Editor island

**File**: `src/components/tonight/PlanEditor.tsx` (+ `PlanEditor.test.tsx` if the repo's island tests allow; otherwise e2e only)

**Intent**: Edit the list on the client and save it in one POST (D6).

**Contract**:

- Props: `locale`, `siteId`, `night`, `rows` (key, label, line), `candidates`, `notTonight`.
- An "Edit plan" `hairline`/`sm` button opens a compact list. Each row has icon buttons Move up, Move down and Remove: `quiet`, 44 px, accessible names "Move M31 up" and so on; up is disabled on the first row and down on the last.
- `TargetPicker` over `candidates` plus an "Add" button. Save is `default`, the one primary on the screen. Cancel is `quiet`.
- The form is `method="POST" action="/api/tonight/plan"` with hidden `site`, `night` and one `targets` input per key in order. It carries `data-needs-network`, and so does the Edit button.
- Focus moves to the moved row's same control after Move, and to the next row's Remove (or the list) after Remove.
- Never imports server-only modules: island imports rule, CLAUDE.md.

#### 4. Reset

**File**: `src/components/tonight/PlanResetButton.tsx` (mirrors `src/components/gear/DeleteButton.tsx`'s dialog)

**Intent**: Reset to the suggested plan with one confirmation (D8).

**Contract**: A POST form to `/api/tonight/plan/reset` (`site`, `night`) carrying `data-needs-network`, with a token-styled `<dialog role="alertdialog">`. Cancel has the initial focus. Escape closes it.

#### 5. Dashboard tile

**File**: `src/components/tonight/TonightContent.astro`

**Intent**: The tile's next target follows the edited plan (D13).

**Contract**: For `access === "full"`, pass `readPlanEdits`. On `planEditsError` the tile silently shows the suggested plan.

#### 6. Copy, /design, styles

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `src/pages/design.astro`, `src/components/design/plan-samples.ts`

**Intent**: Every string in the catalogue; every new state on `/design`.

**Contract**:

- `tonight.pages.plan.*` keys: `edit`, `save`, `cancel`, `moveUp`, `moveDown`, `remove`, `add`, `addLabel`, `edited`, `reset`, `resetConfirm`, `editedEmpty`, `notTonight`, `held`, `locked`, `editsUnavailable`. EN and PL have the same keys (the parity test).
- `/design` specimens (from fixed data, as `event-samples.ts`):
  - the editor collapsed, open, and offline;
  - the edited band;
  - `notTonight`;
  - the locked line;
  - the held line;
  - the failure line;
  - the reset dialog.

#### 7. Browser spec

**File**: `tests/e2e/session-plan-edit.spec.ts`

**Intent**: Prove the journeys that need the browser: hydration, a second device, offline.

**Contract**: A fresh user per test, `requirePlanGrant` and `setPlan`, and a skip on a night that does not pass, through the shared helper (§6.5 known limit). The tests:

1. A full user removes one row, moves one up and adds one candidate, saves, and lands on the clean URL with the rows in that order and "Edited".
2. A second browser context of the same user sees the same order.
3. Device A, behind a closed proxy (lessons file), serves the edited plan with `html[data-from-device]`. This proves the POST redirect was stored.
4. Reset asks, then restores the suggested order.
5. A free user sees the locked line and no editor.
6. Offline, Edit, Save and Reset are disabled.

`tonight-phone.spec.ts` covers the open editor at 320 and 375 px with no sideways scroll.

### Success Criteria:

#### Automated Verification:

- `npm test` (i18n parity, no-hardcoded-colors, contrast, no-console guard) passes
- `npm run lint` and `npx astro check` pass
- `npm run build` succeeds and `scripts/build-sw.mjs` raises no failures
- The whole e2e suite passes against a fresh local preview with the forecast fixture and the local stack's keys inline (lessons: run the whole suite): `npm run test:e2e`
- `npm run smoke` passes

#### Manual Verification:

- On a phone-width preview: edit, save, reload, reset, in dark, light and red; red mode tells controls apart by shape
- Keyboard only: open the editor, move a row, add a target, save, reset (focus visible and kept where expected)
- Polish copy fits at 320 px

**Implementation Note**: After this phase passes, pause for the human's confirmation before Phase 5.

---

## Phase 5: Docs and rules

### Overview

Record the feature, the first full-plan POST, and OQ23's answer for plan edits.

### Changes Required:

#### 1. Project rules

**File**: `CLAUDE.md`

**Intent**: Future agents know where edits live and how they are applied and gated.

**Contract**: A product paragraph "Adjustable session plan (M-3 S-08)" after "What to expect". It covers:

- the table;
- `applyPlanEdits`;
- `reachable`;
- the gates;
- the four island states and their markers;
- D5, D7, D11 and D14;
- the routes.

#### 2. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: §6.4 points at the first full-plan POST as the route recipe's worked example (smoke plan 1–7), and it names the `needsSite` harness option for a per-user table with a parent.

**Contract**: §6.4 bullets "A per-user table" and "A full-plan route". Freshness ledger date.

#### 3. PRD

**File**: `context/foundation/prd.md`

**Intent**: Settle OQ23 for plan edits.

**Contract**: OQ23 gets a "Settled for plan edits" note with D11 and D14.

### Success Criteria:

#### Automated Verification:

- `npm run format` leaves no diff in the changed docs

#### Manual Verification:

- The owner reads the CLAUDE.md paragraph and finds it accurate

---

## Testing Strategy

### Unit Tests:

- `plan-edits.test.ts`:
  - null list;
  - reorder;
  - drop all;
  - add reachable;
  - add unreachable (goes to `notTonight`);
  - planet outside the suggestion;
  - duplicates impossible;
  - candidates exclude rows.
- `session-plan.test.ts`: `"given"` keeps the order and drops off-axis rows.
- `build.test.ts`:
  - edited rows carry tracks and texts;
  - `nextUp` in the user's order;
  - `heldEdits` on a no-go night;
  - `candidates` only with the option.
- `visible.test.ts`: windows at the boundaries (minimum altitude, dark window, polar day).
- Schemas: unknown keys, duplicates, 31 keys and a bad night rejected.

### Integration Tests:

- `tests/db/`:
  - structure;
  - isolation with `needsSite`;
  - `session-plans.test.ts`: the site guard, unique and upsert, cascade, shape checks.
- `scripts/smoke.mjs` plan 1–7.
- `tests/e2e/session-plan-edit.spec.ts` and the phone spec.

### Manual Testing Steps:

1. As a full user on a go night, edit, save and reload; open on a second browser and see the same plan.
2. Raise the site's minimum altitude so an added object loses its window; the object moves to "Not on tonight's plan".
3. Switch the telescope to a small one; an added faint object moves to "Not on tonight's plan".
4. Demote the account; the plan page shows the suggested plan and the lock line. Promote it; the edits return.

## Performance Considerations

- `reachable` reuses tracks `rankObjects` already computes: no extra engine work for the pool.
- Added rows need axis tracks for at most 30 objects.
- The island adds one single-row read for full users. The dashboard reads the same row only for full users.

## Migration Notes

Additive table; CI's `migrate` job applies it before deploy. No backfill. Rollback is dropping the table (the app tolerates a failed read: D14).

## References

- Research: `context/changes/adjustable-session-plan/research.md`
- Per-user table with site guard: `supabase/migrations/20261003120000_sky_checks.sql:20-68`
- Two-layer gate: `src/pages/tonight/finder.astro:38-76`, `src/lib/finder/load.ts:109-118`
- Plain-form POST route: `src/pages/api/log/sky/[id].ts:13-37`
- Confirm dialog: `src/components/gear/DeleteButton.tsx`
- Offline decisions: `context/archive/2026-10-11-finder-chart/plan.md` (O-4, D-13 to D-15), `context/archive/2026-10-14-what-to-expect/plan.md` (O-2)
- In-flight tiers: `feat/ui-refine`, `context/changes/ui-quiet-actions/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Table, store and isolation

#### Automated

- [ ] 1.1 The migration applies to the shared local stack without a reset: `npx supabase migration up`
- [ ] 1.2 Types regenerate with no drift: `npm run db:types` then `git diff --exit-code src/lib/database.types.ts` after the commit
- [ ] 1.3 `npm run test:db` passes, including the structure suite (four policies on `session_plans`), the isolation suite on `session_plans` and `tests/db/session-plans.test.ts`
- [ ] 1.4 Store and schema unit tests pass: `npx vitest run src/lib/session-plans`
- [ ] 1.5 `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 1.6 Break check: drop the site guard from the INSERT policy; `session-plans.test.ts` turns red; revert

### Phase 2: Applying edits to the night

#### Automated

- [ ] 2.1 `npm test` passes, including `plan-edits.test.ts`, the new `session-plan.test.ts` order cases, the `build.test.ts` edited-plan cases (`nextUp`, `heldEdits`, `notTonight`, candidates) and the new invariant case
- [ ] 2.2 `src/lib/engine/calibration.test.ts` and the ranking suites pass unchanged
- [ ] 2.3 `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 2.4 Break check: let `applyPlanEdits` draw a deep-sky key that is not reachable from a fabricated window; the invariant turns red; revert

### Phase 3: Full-plan save and reset routes

#### Automated

- [ ] 3.1 Route and helper unit tests pass, including `visible.test.ts` (deep-sky key outside the dark window and under the minimum altitude refused, planet below the horizon refused, a polar-day dark window refused): `npm test`
- [ ] 3.2 `npm run lint` and `npx astro check` pass
- [ ] 3.3 `npm run smoke` against a local preview with the local stack's keys inline passes, including the plan steps

#### Manual

- [ ] 3.4 Break check: move `requireFullPlan` after the store call; plan 1 turns red; revert

### Phase 4: Plan page, editor and dashboard

#### Automated

- [ ] 4.1 `npm test` (i18n parity, no-hardcoded-colors, contrast, no-console guard) passes
- [ ] 4.2 `npm run lint` and `npx astro check` pass
- [ ] 4.3 `npm run build` succeeds and `scripts/build-sw.mjs` raises no failures
- [ ] 4.4 The whole e2e suite passes against a fresh local preview with the forecast fixture and the local stack's keys inline (lessons: run the whole suite): `npm run test:e2e`
- [ ] 4.5 `npm run smoke` passes

#### Manual

- [ ] 4.6 On a phone-width preview: edit, save, reload, reset, in dark, light and red; red mode tells controls apart by shape
- [ ] 4.7 Keyboard only: open the editor, move a row, add a target, save, reset (focus visible and kept where expected)
- [ ] 4.8 Polish copy fits at 320 px

### Phase 5: Docs and rules

#### Automated

- [ ] 5.1 `npm run format` leaves no diff in the changed docs

#### Manual

- [ ] 5.2 The owner reads the CLAUDE.md paragraph and finds it accurate
