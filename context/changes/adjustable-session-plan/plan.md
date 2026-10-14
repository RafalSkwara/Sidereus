# Adjustable Session Plan (M-3 S-08) Implementation Plan

## Overview

A full-plan user can reorder, drop and add targets on the Session plan (`/tonight/plan`) for a site and tonight, and reset it to the suggested plan.

- **Storage.** Each edit is one row per (user, site, night) in a new per-user table. The server applies it to the freshly computed night, so it reaches every device. After a save, the service worker re-stores the clean page, so the device's offline copy is fresh at once.
- **Network.** Editing needs the network.
- **Free account.** It keeps today's suggested plan and sees one line on what editing does and that it needs the full plan.
- **Refs:** PRD FR-044, FR-045, US-08; roadmap S-08; GitHub #129.

**Decisions.** The owner answered D1–D15 on 2026-10-14: every recommendation except D2 (b) and D7 (b). The plan review (`reviews/plan-review.md`, F1–F10) is applied, with the owner's answers to F4, F7 and F9.

## Current State Analysis

- **Suggested plan.** It is computed on every request and never stored. `buildTonight` builds it only under `withSessionPlan` (`src/lib/tonight/build.ts:1099-1252`). Its rows:
  - the Moon when it is a target;
  - every ranked planet;
  - the ranking's top `MAX_RANKED_OBJECTS` = 5 deep-sky entries (`planObjects`, build.ts:774), only when the verdict card passes (build.ts:749).
  - `layoutSessionPlan` sorts the rows by peak (`src/lib/tonight/session-plan.ts:93-94`).
- **Night date.** `loadTonight` resolves only the site and the telescope (`src/lib/tonight/load.ts:134-135`). `buildTonight` computes the night date (build.ts:684: `tonightDateFor(engineSite, now, TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG)`, +1 day for `night: "next"`). The same rule for a stored site is `tonightDateForSite(site, now)` (`src/lib/tonight/tonight-date.ts:9`). The rollover is the Sun's altitude at the site, not the zone's midnight.
- **Windows.** Every row's window is the engine's `bestWindow`, the longest run at or above the site's minimum altitude (`src/lib/engine/objects.ts:76-105`):
  - deep-sky over the dark-window track, at `darknessThresholdDegForBortle(site.bortle)` and a 10-minute step;
  - the Moon and planets over the planet window, Sun below −6° (`build.ts:825`, planet-ranking.ts:106-113).
  - `rankObjects` scores every catalogue object within the telescope's reach. It keeps the washed-out and cleared ones and discards the below-bar ones after scoring (`src/lib/engine/ranking.ts:215-262`).
- **Plan page.** `/tonight/plan` is `plan.astro` (shell, no `?error=` read) plus `PlanPageContent.astro`, a server island. The island:
  - renders an `empty` branch whenever there are no rows (`:46`);
  - draws `SessionTimeline.astro`, an `<ol>` of full-width row links (`:115-198`);
  - renders `OfflineCopy`;
  - is not plan-gated.
- **Plan row links.** They go to `/tonight/targets#object-<id>`. Only `ObjectCard` (Targets' top band) carries `id="object-<id>"` (`ObjectCard.astro:34`). `ObjectRow` and the washed-out list have none, and below-bar objects are not on Targets at all.
- **Finder.** The finder resolves only ranked entries and planets (`src/lib/finder/load.ts:71-106`). `FinderFrom` is `targets | planets` (`src/lib/finder/from.ts:7`).
- **No plan data, no full-plan POST.** Nothing stores plan data, and no POST route calls `requireFullPlan`.
  - Patterns for the table: `sky_checks` for the site guard (`supabase/migrations/20261003120000_sky_checks.sql:47-64`); the latest migration is `20261013120000`.
  - The isolation suite collects `valid` rows at collection time and runs a "hand over" case as B (`tests/db/isolation.test.ts:65-68, 161-176`).
- **Offline.**
  - `/tonight/plan` is in `TONIGHT_PAGES`.
  - A POST's redirect comes back to the browser as a fresh GET navigation and is stored when its URL is clean (`src/sw.ts:664-675`; review O1).
  - `NOTICE_PARAMS` (`logged`, `skyChecked`, `error`, `milestone`) keep a URL out of storage (`src/lib/offline/copies.ts:48`).
  - The worker's `message` handler knows only `purge` and `list-copies` (`sw.ts:694-710`).
  - `storeNextCopy` (`sw.ts:464-509`) is the existing "fetch a shell and its island in the background and commit" path.
- **ui-quiet-actions** (`feat/ui-refine`): Phases 1 and 2 are committed (2e2b903, 73d233d): `hairline`/`sm`, `quiet`/`bare`, size `icon` (44 px), `--control-border`, and `action` removed. Phase 3 (the Clickables rule in CLAUDE.md, styles) is in progress. It does not touch `PlanPageContent`, `SessionTimeline`, `plan.astro`, `TonightTiles` or `TonightContent`.

Full evidence: `context/changes/adjustable-session-plan/research.md`, `context/changes/adjustable-session-plan/reviews/plan-review.md`.

## Desired End State

- **Editing on a night that passes.** A full-plan user, on a night that passes (go or marginal with a dark window, D5), opens `/tonight/plan`, taps "Edit plan", and moves rows up and down, removes rows, adds any object their telescope can reach with a window tonight (or a planet or the Moon they removed), and taps "Save".
- **After saving:**
  - they land on `/tonight/plan?site=<id>&saved=plan`, with a "Plan saved" toast;
  - their list shows in their order, each row with its own window and best time; a row whose window ends before the previous row's best time carries a muted hint (D2 b);
  - an "Edited · Reset to suggested" line sits above the rows;
  - the service worker re-stores the clean page at once (D7 b), so the offline copy shows the edits;
  - another device shows the same plan, and the dashboard tile follows it.
- **Reset** asks once, then shows the suggested plan.
- **A stored target with no window tonight** is never drawn as a row: the site's minimum altitude was raised, or another telescope cannot reach it. It is listed muted under "Not on tonight's plan" and stays on the saved list until the user removes it (F4).
- **A free account** sees the suggested plan plus one muted lock line.
- **A failed plan or edits read** shows the suggested plan with a muted line and stores no offline copy.
- **Every refusal shows as an inline alert on the page** (`?error=`).
- **The server enforces it all.**
  - The routes refuse a free account before any read or write.
  - The island reads edits only after its own plan check, and only for tonight.
  - RLS keeps every row to its owner and the owner's site.
  - Every newly added key has a window at the site that night, by the build's own rule.

Verify with `npm test`, `npm run test:db`, `npm run smoke` (plan steps), `tests/e2e/session-plan-store.spec.ts` and `tests/e2e/session-plan-edit.spec.ts` against a local preview.

### Key Discoveries:

- `rankObjects` already computes a window for every reachable object (`ranking.ts:236`). Exposing it gives the add pool with no second window rule.
- Rows lose their raw window in layout, and `nextUp` keeps a local `windowEnds` map (`build.ts:1195`). Edited rows and the D2 hint need the raw windows, which exist before layout.
- `visibility-invariants.test.ts:205-240` asserts that the plan equals the ranking, planets and Moon. An edited plan needs its own invariant.
- A React island hydrates inside a Tonight server island (`TonightContent.astro:132`). `targetOptions(locale)` (`src/lib/observations/target-options.ts:16`) builds the `TargetOption` shape (`key`, `id`, `label`, `detail`, `names`) that `filterTargets` searches.
- `planets.astro:25-31` is the pattern for reading `?error=` in a Tonight shell.

## Owner Decisions (answered 2026-10-14)

| #   | Decision                                 | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | What is stored                           | The whole ordered list of keys per (user, site, night); reset deletes the row; a later change in the suggestion does not alter a saved list                                                                                                                                                                                                                                                                                                                                                                       |
| D2  | Meaning of order                         | **(b)** List position only; each row keeps its own window and best time; a muted hint on a row whose window ends before the previous row's best time                                                                                                                                                                                                                                                                                                                                                              |
| D3  | What "add" offers                        | Every object the telescope can reach (scored by the ranking, including below-bar and washed-out) with a window tonight, plus a planet or the Moon from tonight's suggestion that the user removed                                                                                                                                                                                                                                                                                                                 |
| D4  | Saved target without a window on render  | A muted "Not on tonight's plan" list, removable in the editor; never a row                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D5  | Nights that do not pass                  | Edits apply and the editor shows only when the night passes; otherwise today's explanation plus one line that saved changes return when the night clears                                                                                                                                                                                                                                                                                                                                                          |
| D6  | Interaction                              | An editor island (Move up / Move down / Remove, an "Add a target" picker, one Save or Cancel)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D7  | Save confirmation                        | **(b)** A toast after save, and a new service-worker message that re-stores the clean `/tonight/plan` page so the stored copy is fresh at once                                                                                                                                                                                                                                                                                                                                                                    |
| D8  | Reset                                    | Asks once in a token-styled `alertdialog`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D9  | Which nights                             | Tonight only, enforced against `?night=next` (F2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D10 | Free account                             | One muted lock line above the plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D11 | OQ23 after the plan is lost              | Edits stay in the database and come back if the plan returns; the island shows the suggested plan; a stored edited copy is replaced at that page's next online answer (no plan-loss drop). Rationale: the paid feature is editing. A copy stored while the plan was full is read-only, offline editing does not exist, and every write passes the server's gate. That is OQ23's own candidate, "a copy keeps what the plan allowed when it was stored" (`prd.md:772-774`). `?night=next` copies never carry edits |
| D12 | Site deleted                             | `on delete cascade`; `site_id` NOT NULL                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D13 | Dashboard tile                           | Follows the edited plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D14 | Failed plan or edits read                | Suggested plan + one muted line, no `OfflineCopy` on the plan page (the dashboard is not affected, F8)                                                                                                                                                                                                                                                                                                                                                                                                            |
| D15 | ui-quiet-actions                         | Phase 5 (editor UI) waits for its merge and rebases onto it; Phases 1–4 proceed now                                                                                                                                                                                                                                                                                                                                                                                                                               |
| F4  | Saved keys without a window at save time | They stay on the saved list; the route checks the window only for keys newly added relative to the stored list                                                                                                                                                                                                                                                                                                                                                                                                    |
| F7  | Move up / Move down / Remove             | `quiet` variant, size `icon` (44 px target)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| F9  | Link of a below-bar added row            | Its finder chart, `/tonight/finder?object=<id>&from=plan` (a new `from` value), instead of a Targets anchor                                                                                                                                                                                                                                                                                                                                                                                                       |

## What We're NOT Doing

- No offline editing or later sync (roadmap Parked; FR-044).
- No editing of any night but tonight (D9), and no edits on a night that does not pass (D5).
- No time slots or sequencing (D2). The order hint is advisory only.
- No drag and drop (D6).
- No change to the live sky's markers or to Targets' ranking (Targets only gains anchor ids, F9).
- No plan-loss drop in the worker (D11). The only worker change is the re-store message (D7 b).
- No payments or upsell link. No cleanup of past nights' rows.
- No change to `/tonight/plan`'s shell gating: the page stays free (FR-031). Only edits, the editor and the edited rows are gated.
- No finder chart for below-bar objects outside the plan: the finder resolves them only with `from=plan`.

## Implementation Approach

The work runs data-up:

1. Table and store.
2. The pure rule that applies a saved list to the freshly built night, with the guardrail proven.
3. The full-plan routes plus every island state that needs no new controls, so smoke can prove the gate end to end without the editor (F1).
4. The worker's re-store after a save.
5. The editor, reset dialog, tile and `/design`, after ui-quiet-actions merges.
6. Docs.

The guardrail lives in one place: a row exists only when the engine's own rule gives the key a window that night. That means the suggestion's row, or for an added deep-sky key the ranking's window. The route's check for newly added keys calls the same helpers and thresholds.

## Critical Implementation Details

- **One night date (F2).** `loadTonight` computes the night date once, after it resolves the site: `tonightDateForSite(site, now)`, +1 day for `night: "next"`. It passes that date to `readPlanEdits` and to `buildTonight` as an option, which uses it instead of recomputing, so the hook, the build, the form and the route agree. The hook, the candidates and the editor run only for `night === "tonight"`. The route compares the posted night with `tonightDateForSite(site, now)`.
- **Gate before read.** `readPlanEdits` checks the plan itself: `getAccountPlan(locals) === "full"`, else it returns `null` without a query. This keeps the plan read in parallel with the Tonight load (review note). A signed-out or free island replay never reads `session_plans`.
- **Offline copy on failure (D14).** In the failure states the plan island omits `OfflineCopy`. With no `[data-offline-copy]` the worker commits nothing (`copies.ts:236-237`, `sw.ts:424-446`), so the earlier stored copy survives. The island instead marks its readiness with `data-session-plan-state` (F8), which e2e waits on.
- **Shared database (F5).** The local Supabase stack is shared by every worktree. Applying this migration makes `tests/db/structure.test.ts` fail in any other checkout ("table in neither list") and pulls `session_plans` into their `db:types`.
  - Sequence it: before `npx supabase migration up`, ask the orchestrator for a window and say which checkouts may run `test:db` or `db:types` meanwhile. Today only `feat/ui-refine` is active, and it has no migration.
  - After each DB verification run, put the stack back as main has it, with the change folder's `local-down.sql` (`drop table public.session_plans;` plus deleting version `20261014120000` from `supabase_migrations.schema_migrations`). Run that file by hand, never commit it to `supabase/migrations/`, and never `supabase db reset`.
  - Re-apply it for smoke and e2e runs, in the same announced windows.
  - Run `npm run db:types` only while the stack holds exactly main's migrations plus this one (`npx supabase migration list`).
  - If windows prove impractical, the fallback is a second stack for this worktree (own `project_id` and ports in a copied `supabase/config.toml`, outside the repo). Use it only with the orchestrator's OK.

## Phase 1: Table, store and isolation

### Overview

The `session_plans` table with RLS and the site guard, the harness and table suite, generated types, and the store and schemas.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261014120000_session_plans.sql`

**Intent**: Store one edited list per user, site and night, only for the owner and the owner's site. It is additive.

**Contract**:

- `public.session_plans`:
  - `id uuid pk default gen_random_uuid()`;
  - `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`;
  - `site_id uuid not null references public.sites(id) on delete cascade`;
  - `night date not null`;
  - `targets text[] not null`;
  - `created_at` and `updated_at timestamptz not null default now()`.
- Unique `(user_id, site_id, night)`. Indexes on `user_id` and `site_id`.
- Checks:
  - `cardinality(targets) <= 30`;
  - `array_position(targets, null) is null`;
  - `'' <> all(targets)`;
  - no element contains a comma;
  - `array_to_string(targets, ',')` matches `^(KEY(,KEY)*)?$`. KEY is assembled by hand, without anchors, from the three predicates of `observations_target_key` (`20261006190000_observation_target_deep_sky.sql:17-21`): `M([1-9]|[1-9][0-9]|10[0-9]|110)`, `(NGC|IC)[1-9][0-9]{0,3}` and the eight planet and Moon keys.
- RLS on, four `to authenticated` policies `session_plans_{select,insert,update,delete}_own` on `(select auth.uid()) = user_id`. INSERT and UPDATE `with check` also require that the site is the owner's (as in sky_checks.sql:47-64).

#### 2. Harness and entry

**File**: `tests/db/tables.ts`, `tests/db/isolation.test.ts`

**Intent**: Run the generic suite on a table whose rows need the owner's site (F5).

**Contract**:

- `TableCase` gains `needsSite?: true`. With it, `valid` may omit `site_id`: the type is `Omit<TablesInsert<T>, "site_id">`.
- The suite creates one site for A and one for B in `beforeAll`, and merges `site_id` lazily inside each test, because `describe.each` collects `valid` at collection time:
  - A's rows get A's site;
  - B's own inserts ("hand over" case) get B's site;
  - B's insert of A's row keeps A's site and `user_id` (`42501`).
- The entry: `{ table: "session_plans", needsSite: true, valid: { night: "2026-10-14", targets: ["M31", "jupiter"] }, change: { targets: ["M42"] } }`.

#### 3. Table suite

**File**: `tests/db/session-plans.test.ts`

**Intent**: Pin what the generic suite cannot see, each case with a positive control.

**Contract**:

- B cannot insert or update a row on A's site under B's own `user_id` (`42501`).
- The unique key holds, and `upsert` on `user_id,site_id,night` replaces the row.
- Deleting the site deletes its plans.
- The checks reject each of these with `23514`:
  - `M111`, `NGC0` and `Foo`;
  - `{""}` and `{"M31,M42"}`;
  - a `null` element;
  - 31 elements.
- `{}` is accepted.

#### 4. Store and schemas

**File**: `src/lib/session-plans/store.ts`, `src/lib/session-plans/schemas.ts` (+ tests), `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: All DB calls for edits in one module, with fixed keys and no logging, plus the shared form schema.

**Contract**:

- `sessionPlanStore`:
  - `get(client, siteId, night): Promise<TargetKey[] | null>` uses `.eq().eq().maybeSingle()` and throws `new Error("errors.load.sessionPlan", { cause })`;
  - `save(client, siteId, night, targets): Promise<WriteResult>` (`WriteResult` from `src/lib/gear/store.ts:21`) upserts and sets `updated_at`;
  - `reset(client, siteId, night): Promise<WriteResult>` deletes.
- `savePlanSchema` (island-safe):
  - `site` is a uuid;
  - `night` is `YYYY-MM-DD`;
  - `targets` is an array, each `isTargetKey`, with no duplicates and at most `SESSION_PLAN_MAX_TARGETS` = 30;
  - catalogue membership (`isKnownTarget`, which imports the catalogue) is checked in the route, not the schema (F6).
- `resetPlanSchema` has `site` and `night`.
- Keys `errors.save.sessionPlan`, `errors.load.sessionPlan`, `errors.sessionPlan.nightOver` and `errors.sessionPlan.notVisible`.

#### 5. Generated types

**File**: `src/lib/database.types.ts`

**Intent**: `npm run db:types` within an announced window (Critical Implementation Details); never hand-edited.

**Contract**: `Tables<"session_plans">`.

### Success Criteria:

#### Automated Verification:

- The migration applies to the local stack in an announced window, without a reset: `npx supabase migration up`
- `npm run db:types` with the stack at main + this migration, then `git diff --exit-code src/lib/database.types.ts` after the commit
- `npm run test:db` passes: structure (four policies on `session_plans`), isolation with `needsSite`, `tests/db/session-plans.test.ts`
- `npx vitest run src/lib/session-plans` passes
- `npm run lint` and `npx astro check` pass
- The stack is put back with `local-down.sql` after the run (`npx supabase migration list` shows main's set)

#### Manual Verification:

- Break check: drop the site guard from the INSERT policy; `session-plans.test.ts` turns red; revert

**Implementation Note**: After this phase passes, pause for the human's confirmation before Phase 2.

---

## Phase 2: Applying edits to the night

### Overview

A pure rule turns a saved list and the freshly built night into the plan's rows. The night date is computed once. The build exposes the edited plan, its "not tonight" keys, the order hints, the add candidates and the tile's `nextUp`. Invariant tests prove that no edit puts a row outside its window.

### Changes Required:

#### 1. Every reachable object's window

**File**: `src/lib/engine/ranking.ts`, `src/lib/engine/ranking.test.ts`

**Intent**: Expose the windows `rankObjects` already computes, below-bar included.

**Contract**:

- `rankObjects` returns `reachable: { object, window, peak, washedOut: boolean }[]`: every object with a non-null score, in catalogue order.
- `entries`, `washedOut` and `clearedCount` are unchanged; the calibration and ranking suites stay green with no edit.

#### 2. Shared window helpers

**File**: `src/lib/tonight/plan-window.ts` (+ test), `src/lib/tonight/build.ts`

**Intent**: One place for "the window of one key at a site on a night", used by the build's added rows and by the route's check (F4), with the build's exact functions, step and thresholds.

**Contract**:

- `deepSkyWindow(site, night, object)` uses `darkWindow` at `darknessThresholdDegForBortle(site.bortle)`, `objectTrack` at `DEFAULT_TRACK_STEP_MINUTES` and `bestWindow(track, site.minAltitudeDeg)`.
- `solarSystemWindow(site, night, key)` uses the planet window `darkWindow(…, PLANET_WINDOW_SUN_ALTITUDE_DEG)`, then `planetTracks` or `moonTrack`, then `bestWindow`. It is extracted from `build.ts:825` so the build uses it too.
- Both are pure.

#### 3. The edit rule and order hints

**File**: `src/lib/tonight/plan-edits.ts`, `src/lib/tonight/plan-order.ts` (island-safe), with tests

**Intent**: One pure function decides the rows in the user's order and what may be added. One island-safe function computes the D2 (b) hints, so the timeline and the editor agree.

**Contract**:

- `applyPlanEdits({ suggested, saved, reachable })` returns `{ rows, notTonight, candidates, edited }`:
  - `saved === null` gives exactly `suggested`, with `edited: false`.
  - Otherwise each saved key in order becomes the suggested row, else the reachable row for a deep-sky key, else a `notTonight` key.
  - `candidates` are suggested or reachable keys not in `rows`.
- `orderHints(rows: { bestAt, windowEnd }[]) => boolean[]`: row i (i > 0) is flagged when its `windowEnd` < row i−1's `bestAt`. It is pure, with no clock.

#### 4. Layout in the user's order

**File**: `src/lib/tonight/session-plan.ts` (+ test)

**Intent**: Keep the user's order on the axis.

**Contract**: `SessionPlanInput.order?: "peak" | "given"`. The default is `"peak"`. `"given"` keeps the input order and still drops off-axis rows.

#### 5. Build and load wiring

**File**: `src/lib/tonight/build.ts`, `src/lib/tonight/load.ts`, `src/lib/tonight/island.ts`, `build.test.ts`, `load.test.ts`

**Intent**: Apply a saved list inside the one build, on a night that passes and for tonight only (D5, D9, F2).

**Contract**:

- `loadTonight` computes `nightDate` once (Critical Implementation Details) and passes it as a `buildTonight` option.
- New `buildTonight` options: `nightDate`, `planEdits?: TargetKey[] | null` and `withPlanCandidates?: boolean`.
- The optional `readPlanEdits(siteId, nightDate) => Promise<TargetKey[] | null>` on `loadTonight` / `loadTonightFor`:
  - it is called only when `night === "tonight"`;
  - a throw sets `planEditsError` (a `MessageKey`) and the build proceeds without edits.
- With `planEdits` on a passing night:
  - added rows come from `reachable`, with axis tracks computed for them;
  - a row's `href` is the Targets anchor `#object-<id>` for a cleared or washed-out object, and `/tonight/finder?object=<id>&site=…&telescope=…&from=plan` for a below-bar one (F9).
- On a night that does not pass, edits are not applied, and `heldEdits: true` records that a list is saved.
- `TonightSessionPlan` gains:
  - `edited` and `heldEdits`;
  - `notTonight: { key, label }[]`;
  - a per-row `endsBeforePrevious: boolean`, from `orderHints` on the raw windows;
  - a per-row `windowEnd` (epoch ms) for the editor;
  - `candidates: TargetOption[] | null`: `targetOptions(locale)` filtered to the candidate keys, with `detail` overwritten on the server to "window 21:40–23:10". It is `null` unless asked for.
- The night stays `view.date`, with no new `plan.night` field.
- `nextUp` over an edited plan is the first row in the user's order whose window has not ended (D13).
- `load.test.ts` proves that the hook is not called for `night: "next"`, and that the build's date equals the hook's date.

#### 6. The guardrail, proven

**File**: `src/lib/tonight/visibility-invariants.test.ts`

**Intent**: No edit schedules a target outside its window, over the existing seeded sites, nights, skies and telescopes.

**Contract**:

- The existing no-edit case holds.
- A new seeded case applies random saved lists (subsets and permutations of suggested and candidate keys, plus keys with no window, unknown planets and the Moon on nights it is no target) and asserts:
  - every row lies within its independently recomputed window;
  - deep-sky rows lie within the dark window;
  - the saved order is kept;
  - each saved key is a row or `notTonight`, never both;
  - a night that does not pass draws no edited row.
- A property case: every `candidates` key passes `deepSkyWindow` / `solarSystemWindow` (F4).

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `plan-edits.test.ts`, `plan-order.test.ts`, `plan-window.test.ts`, the order cases in `session-plan.test.ts`, the edited-plan, href and hint cases in `build.test.ts`, the `load.test.ts` night cases and the new invariant cases
- `src/lib/engine/calibration.test.ts` and the ranking suites pass unchanged
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- Break check: let `applyPlanEdits` draw a deep-sky key that is not reachable from a fabricated window; the invariant turns red; revert

**Implementation Note**: After this phase passes, pause for the human's confirmation before Phase 3.

---

## Phase 3: Full-plan routes, gated plan island and HTTP checks

### Overview

This phase covers:

- the first full-plan POST routes;
- every plan-island state that needs no new controls: the gate, the edits read, the markers, the lock line, the held and failure lines, the edited line as text, "Not on tonight's plan", the order hints, `?error=` and the skeleton;
- the finder's `from=plan`;
- the smoke steps.

Smoke proves the gate end to end with no editor (F1).

### Changes Required:

#### 1. Routes

**File**: `src/pages/api/tonight/plan.ts`, `src/pages/api/tonight/plan/reset.ts`, `src/lib/session-plans/redirect.ts` (+ tests)

**Intent**: Save or reset tonight's list at the user's own site, refusing what the plan, the night or the sky does not allow.

**Contract**: Both routes, in order:

1. Read the raw `site` from the form. Only a value passing `isGearId` (`src/lib/tonight/gear-choice.ts:16`) is ever put into a redirect URL (F6).
2. `!supabase` redirects with `NOT_CONFIGURED`.
3. `requireFullPlan(locals)` not ok redirects with its `errorKey`, before any read.
4. Parse `{ site, night, targets: formData.getAll("targets") }`. A failure redirects with `issueKey`. Any key failing `isKnownTarget` redirects with `errors.save.sessionPlan`.
5. `siteStore.get` (own site); none redirects with `errors.notFound.site`.
6. `night !== tonightDateForSite(site, now)` redirects with `errors.sessionPlan.nightOver`.
7. Save only: read the stored list. Every key not in it must have a window under `plan-window.ts`; else redirect with `errors.sessionPlan.notVisible`. Stored keys pass unchecked (F4).
8. The store call; failure redirects with `errors.save.sessionPlan`.
9. Success redirects to `/tonight/plan?site=<id>&saved=plan` (save) or `&saved=plan-reset` (reset), D7 b.

- Every error redirect is `/tonight/plan?site=<id>&error=<key>`, with `site=` only when it passed `isGearId`.
- Only fixed keys and the site id reach the URL. No log.

#### 2. Protected path

**File**: `src/lib/protected-routes.ts` (+ test)

**Intent**: A signed-out POST goes to sign-in.

**Contract**: Add `/api/tonight`.

#### 3. Plan shell: error and toast

**File**: `src/pages/tonight/plan.astro`, `src/lib/toasts.ts`, `src/lib/offline/copies.ts`, `copies.test.ts`, `toasts.test.ts`

**Intent**: Show every refusal (F3) and the save toast.

**Contract**:

- The shell reads `error` (`isMessageKey`, the `planets.astro:25-31` pattern) and passes the translated text to the island, which renders `ServerError` (`role="alert"`) above the plan band.
- The shell renders `<Notice toast param="saved">` when `saved` is `plan` (`tonight.pages.plan.saved`) or `plan-reset` (`tonight.pages.plan.resetDone`).
- `saved` joins `NOTICE_PARAMS`, so a toast URL is never stored. Phase 4 re-stores the clean page. It is already in `TOAST_PARAMS`.

#### 4. Plan island states

**File**: `src/components/tonight/PlanPageContent.astro`, `src/components/tonight/SessionTimeline.astro`, `src/components/tonight/TonightPageSkeleton.astro`, `src/i18n/messages/{en,pl}.ts`

**Intent**: Gate and render every state with existing roles and components (no new button variants).

**Contract**:

- The island passes `readPlanEdits` (gated inside: Critical Implementation Details) and `withPlanCandidates` (full and tonight only; the candidates are unused until Phase 5).
- `data-session-plan-state` on the plan area, one of `edited`, `suggested`, `locked`, `held` or `unavailable`. It is the island's readiness marker (F8). The smoke markers `data-session-plan-edited`, `-held` and `-locked` stay as booleans.
- The `empty` branch splits (F8):
  - an edited empty list reads `tonight.pages.plan.editedEmpty`;
  - a plan whose saved keys are all `notTonight` shows that list;
  - `held` shows today's explanation plus `tonight.pages.plan.held`;
  - only the suggested state keeps "nothing to place".
- The lock line is muted, with a `Lock` icon, only when the read is `free` (`tonight.pages.plan.locked`).
- `unknown` or `planEditsError` shows `tonight.pages.plan.editsUnavailable`, and the island renders no `OfflineCopy` (D14).
- The "Edited" line is text only in this phase; Reset arrives in Phase 5. It lives in `PlanPageContent`, not `SessionTimeline`, because `/design` renders the timeline from fixed data.
- `SessionTimeline` draws rows in the given order, with the hint `tonight.pages.plan.endsBeforePrevious` muted on `endsBeforePrevious` rows. The `notTonight` list is muted under the rows.
- The skeleton gets one 44 px bar above the night lines, so the swap does not jump.

#### 5. Anchors and finder for added rows

**File**: `src/components/tonight/ObjectRow.astro`, `src/components/tonight/TargetsPageContent.astro`, `src/lib/finder/from.ts`, `src/lib/finder/load.ts`, `src/lib/tonight/build.ts` (+ tests)

**Intent**: Every plan row's link lands somewhere real (F9).

**Contract**:

- `ObjectRow`'s `<li>` and each washed-out `<li>` get `id="object-<id>"` and `scroll-mt-4`.
- `FinderFrom` becomes `targets | planets | plan`, with `/tonight/plan` and its title as the back link.
- With `from=plan`, `loadFinderFor` loads with an option that exposes `view.reachable` (`id`, `label`, `bestAt`, `bestTime`, `bestDirection`). `resolveTarget` falls back to it after the ranking. Without `from=plan`, a below-bar object stays `not-ranked`, as today.
- Tests:
  - `from.test.ts`: `plan` parses;
  - `load.test.ts`: a below-bar key resolves only with `from=plan`, and stays `locked` for free.

#### 6. HTTP checks

**File**: `scripts/smoke.mjs`

**Intent**: Test-plan §6.4's full-plan route recipe plus the island replay (F10).

**Contract**:

- Own capture variables (`planIslandUrl`, never the finder's `islandUrl`).
- The site id comes from the island's `data-site-id` and the night from `data-night-date` (`OfflineCopy.astro:50`), both read from a first island replay.
- Repeated `targets` are sent as an array of pairs.
- Whether the night is `held` or `edited` is decided from `data-session-plan-state` in the island body, not the date.
- Steps:
  1. **plan 1**: free, POST save with `targets=M31` `→ 302`. `location` is exactly `/tonight/plan?site=<id>&error=errors.accountPlan.needsFull`, with `absent: "M31"`.
  2. **plan 2**: grant full. Capture and replay: excludes `data-session-plan-edited`, which proves plan 1 wrote nothing.
  3. **plan 3**: POST save with no `targets` `→ 302` exactly `/tonight/plan?site=<id>&saved=plan`. The replay includes `data-session-plan-edited`, or `-held` on a night that does not pass.
  4. **plan 4**: demote. The replay includes `data-session-plan-locked` and excludes the edited and held markers.
  5. **plan 5**: grant again. The replay shows the edits again (D11). POST reset `→` exactly `…&saved=plan-reset`, and the replay excludes the edited and held markers.
  6. **plan 6**: signed out, POST `→ 302` `/auth/signin`, exact.
  7. **plan 7**: signed out, island replay: no plan markers.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the route, redirect, `plan-window` boundary (minimum altitude, dark window, polar day), `from.test.ts`, finder `load.test.ts`, `copies.test.ts` (`saved` refused for storage) and protected-routes cases
- `npm run lint` and `npx astro check` pass
- `npm run smoke` against a local preview (stack in an announced window, keys inline) passes, including plan 1–7

#### Manual Verification:

- Break check: move `requireFullPlan` after the store call; plan 1 turns red; revert
- On a preview, the free lock line, a forced `?error=` alert and the held line read correctly in EN and PL

**Implementation Note**: After this phase passes, pause for the human's confirmation before Phase 4.

---

## Phase 4: Fresh offline copy after a save

### Overview

D7 (b): after a save or reset, the page asks the service worker to re-store the clean `/tonight/plan?site=<id>`, so the device's offline copy shows the change at once, although the toast URL itself is never stored. This phase does not depend on ui-quiet-actions.

### Changes Required:

#### 1. The message and its rule

**File**: `src/lib/offline/copies.ts`, `copies.test.ts`, `src/sw.ts`

**Intent**: A narrow, validated "store this page now" message that reuses the existing commit path.

**Contract**:

- Pure `storeRequestFrom(data, origin): URL | null` accepts only `{ type: "store-page", url }` where:
  - the URL is same-origin;
  - its path is in `TONIGHT_PAGES`;
  - `mayStoreShell` passes;
  - the only param allowed is `site`.
- The worker, inside `serial`, fetches that shell (network, `credentials: "same-origin"`), reads its island preload URL, fetches the island and commits through the same `recordShell` / `commitIsland` rules, the way `storeNextCopy` does (`sw.ts:464-509`). It is best effort: a failure keeps the old copy.

#### 2. The page side

**File**: `src/lib/toasts.ts` or `src/lib/offline/page-state.ts`, `src/pages/tonight/plan.astro`

**Intent**: Send the message once, when the shell rendered the save toast.

**Contract**:

- The shell marks the toast's page (for example `data-store-after-save` on its root).
- The client script posts `{ type: "store-page", url: withoutParams(location.href, TOAST_PARAMS) }` to the controller, or to `ready.active`, as the purge message does (`page-state.ts:130-136`).
- It is never sent offline and never for another param.

#### 3. Proof in the browser

**File**: `tests/e2e/session-plan-store.spec.ts`, `tests/e2e/helpers.ts`

**Intent**: Prove the re-store and the POST-redirect path with no editor.

**Contract**:

- A shared helper `planEditable(page)` reads `data-session-plan-state` and skips when the night does not pass (F10).
- The test:
  1. A full user (fresh, `requirePlanGrant`) opens `/tonight/plan` online.
  2. The test builds and submits a POST form to `/api/tonight/plan` that keeps the first row only.
  3. Assert the toast, then the clean URL, and that the landing is not `data-from-device`.
  4. Wait for the copy listing to show the newer copy.
  5. Close the proxy (lessons file) and reload: `html[data-from-device]` and `data-session-plan-state="edited"` with one row.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the `storeRequestFrom` cases (foreign origin, unknown path, extra param, notice param refused)
- `npm run lint` and `npx astro check` pass
- `npm run build` succeeds (`build-sw.mjs` raises nothing)
- `tests/e2e/session-plan-store.spec.ts` passes against a fresh local preview with the forecast fixture

#### Manual Verification:

- On a preview, after a save the toast shows, and DevTools' Cache Storage holds the new copy without a reload

**Implementation Note**: After this phase passes, pause for the human's confirmation before Phase 5.

---

## Phase 5: Editor, reset dialog and dashboard (after ui-quiet-actions merges, D15)

### Overview

The editor island, the reset dialog, the tile following the edits, `/design` and the editing e2e test. Before starting, rebase onto main with ui-quiet-actions merged.

### Changes Required:

#### 1. Pure editor state

**File**: `src/lib/tonight/plan-editor.ts` (+ `plan-editor.test.ts`)

**Intent**: Move, remove and add as a pure reducer, testable in Vitest's node environment (F7).

**Contract**: `editPlan(state, action)` with `move-up`, `move-down`, `remove` and `add`. No duplicates, at most 30 keys. Edge moves are no-ops. The `orderHints` from `plan-order.ts` are recomputed.

#### 2. Editor island

**File**: `src/components/tonight/PlanEditor.tsx`, `src/components/tonight/PlanPageContent.astro`

**Intent**: Edit on the client, save in one POST (D6).

**Contract**:

- Props: `locale`, `siteId`, `night` (`view.date`), `rows` (key, label, line, `bestAt`, `windowEnd`), `candidates` (`TargetOption[]`) and `notTonight`.
- "Edit plan" (`hairline`/`sm`) opens a list. While it is open, the timeline is hidden: the island sets `data-editing` on the shared plan area, and the timeline carries `group-data-[editing]:hidden`.
- Each row:
  - its name in `min-w-0 break-words`;
  - the D2 hint, live;
  - Move up, Move down and Remove as `quiet` with size `icon` (44 px, F7), named `moveUp({ name })`, `moveDown({ name })` and `remove({ name })`.
  - The edge Move buttons are `aria-disabled` and stay focusable. Focus stays on the moved row's same control. After Remove it goes to the next row's Remove, else the list.
- `notTonight` keys are listed with Remove.
- Add: `TargetPicker` outside the save form, so Enter never submits the save, plus an "Add" button (`hairline`/`sm`).
- Save (`default`, the one primary) is a `method="POST" action="/api/tonight/plan"` form with hidden `site`, `night` and one `targets` per key in order. Cancel is `quiet`/`bare`.
- `data-needs-network` goes only on Edit, Save and the Reset trigger and confirm (F7). Cancel, Move, Remove and Add keep working offline, so the editor can be closed.

#### 3. Reset

**File**: `src/components/tonight/PlanResetButton.tsx`, `PlanPageContent.astro`

**Intent**: Reset with one confirmation (D8), in the "Edited" line.

**Contract**: A POST form to `/api/tonight/plan/reset` with a token-styled `<dialog role="alertdialog">` (the `DeleteButton.tsx` pattern). Cancel has the initial focus and Escape closes it.

#### 4. Dashboard tile

**File**: `src/components/tonight/TonightContent.astro`

**Intent**: The tile follows the edited plan (D13).

**Contract**:

- It passes `readPlanEdits`.
- On `planEditsError` the tile shows the suggested plan, and the dashboard still renders `OfflineCopy`: D14 applies only to the plan page, whose content is the edits.

#### 5. Copy and /design

**File**: `src/i18n/messages/{en,pl}.ts`, `src/pages/design.astro`, `src/components/design/plan-samples.ts`

**Intent**: Every string in the catalogue; every state on `/design`.

**Contract**:

- `tonight.pages.plan.*` keys:
  - plain: `edit`, `save`, `cancel`, `add`, `addLabel`, `addPlaceholder`, `addNoMatch`, `editorListLabel`, `editorEmpty`, `reset`, `resetConfirm`, `resetConfirmYes`, `resetCancel`, `notTonightHeading`;
  - functions: `moveUp({ name })`, `moveDown({ name })`, `remove({ name })`, `candidateDetail({ window })`;
  - EN and PL parity.
- Specimens from fixed data:
  - the editor collapsed, open and offline;
  - the edited band with Reset;
  - `notTonight`;
  - the hint;
  - the lock, held and failure lines;
  - the reset dialog.

#### 6. Browser spec

**File**: `tests/e2e/session-plan-edit.spec.ts`, `tests/e2e/tonight-phone.spec.ts`

**Intent**: The editing journeys.

**Contract**: A fresh user per test, `requirePlanGrant` and `setPlan`, and `planEditable`. The tests:

1. A full user removes one row, moves one up and adds one candidate typed as "31" or a name; Save; the toast, then the clean URL, with the order and "Edited".
2. A second context of the same user sees the same order.
3. The keyboard path: focus after Move and after Remove.
4. Reset asks, then restores the suggested order.
5. A free user sees the lock line and no editor.
6. Offline, Edit, Save and Reset are disabled and Cancel works.
7. A forced error, for example a night posted stale, shows the alert.

`tonight-phone.spec.ts`: the open editor at 320 and 375 px with no sideways scroll.

### Success Criteria:

#### Automated Verification:

- `npm test` (reducer, i18n parity, no-hardcoded-colors, contrast, no-console guard) passes
- `npm run lint` and `npx astro check` pass
- `npm run build` succeeds
- The whole e2e suite passes against a fresh local preview with the forecast fixture and keys inline (lessons): `npm run test:e2e`
- `npm run smoke` passes

#### Manual Verification:

- On a phone-width preview: edit, save, reload, reset in dark, light and red; red tells enabled and `aria-disabled` controls apart by shape, not only colour
- Keyboard only: open, move, add, save, reset, with focus visible and kept
- Polish copy fits at 320 px

**Implementation Note**: After this phase passes, pause for the human's confirmation before Phase 6.

---

## Phase 6: Docs and rules

### Overview

Record the feature, the first full-plan POST, the re-store message and OQ23's answer for plan edits.

### Changes Required:

#### 1. Project rules

**File**: `CLAUDE.md`

**Intent**: Future agents know where edits live, how they are applied, gated and stored offline.

**Contract**: A paragraph "Adjustable session plan (M-3 S-08)" after "What to expect". It covers:

- the table;
- `applyPlanEdits`, `reachable` and `plan-window.ts`;
- the date rule;
- the gates;
- the five states and their markers;
- `saved` in `NOTICE_PARAMS` and the `store-page` message;
- D5, D11 and D14;
- the routes;
- `from=plan`.

It goes after ui-quiet-actions' CLAUDE.md edits, rebased.

#### 2. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: §6.4 points at the first full-plan POST (smoke plan 1–7) and names the `needsSite` harness option. §6.5 names `planEditable`.

**Contract**: The §6.4 and §6.5 bullets, and the freshness ledger.

#### 3. PRD

**File**: `context/foundation/prd.md`

**Intent**: Settle OQ23 for plan edits.

**Contract**: OQ23 gets a "Settled for plan edits" note with D11's rationale and D14.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check CLAUDE.md context/foundation/test-plan.md context/foundation/prd.md` passes

#### Manual Verification:

- The owner reads the CLAUDE.md paragraph and finds it accurate

---

## Testing Strategy

### Unit Tests:

- `plan-edits`: null list, reorder, drop all, add reachable, add unreachable (to `notTonight`), planet outside the suggestion, candidates.
- `plan-order`: the hint boundaries, equal times not flagged.
- `plan-window`: minimum altitude, dark window, polar day, planet window.
- `plan-editor` reducer.
- `session-plan`: `"given"`.
- `build`: edited rows, href (anchor or finder), hints, `nextUp`, `heldEdits`, candidates.
- `load`: no hook for `next`, one date.
- Finder: `from=plan`.
- `copies`: `saved` refused, `storeRequestFrom`.
- Routes and redirect.

### Integration Tests:

- `tests/db/`: structure, isolation with `needsSite`, `session-plans.test.ts`.
- `scripts/smoke.mjs`: plan 1–7.
- `tests/e2e/session-plan-store.spec.ts`, `session-plan-edit.spec.ts` and the phone spec.

### Manual Testing Steps:

1. As a full user on a go night, edit, save and reload; open on a second browser; see the same plan.
2. Raise the site's minimum altitude so an added object loses its window: it moves to "Not on tonight's plan" and stays saved until removed.
3. Switch to a small telescope: an added faint object moves to "Not on tonight's plan".
4. Demote: suggested plan plus the lock line. Promote: the edits return.
5. Save, then go offline at once: the stored copy shows the edits.

## Performance Considerations

- `reachable` reuses the tracks `rankObjects` already computes.
- Added rows need axis tracks for at most 30 objects.
- The plan island and dashboard add one single-row read for full users, in parallel with the Tonight load.
- The route reads one row and computes windows only for new keys.
- The re-store is one background fetch pair per save.

## Migration Notes

The table is additive, and CI's `migrate` applies it before deploy. No backfill. Rollback: drop the table (the app tolerates a failed read, D14). The local shared stack is sequenced as in Critical Implementation Details.

## References

- Research: `context/changes/adjustable-session-plan/research.md`
- Plan review: `context/changes/adjustable-session-plan/reviews/plan-review.md`
- Per-user table with site guard: `supabase/migrations/20261003120000_sky_checks.sql:20-68`
- Two-layer gate: `src/pages/tonight/finder.astro:38-76`, `src/lib/finder/load.ts:109-118`
- Shell `?error=` pattern: `src/pages/tonight/planets.astro:25-31`
- Background store path: `src/sw.ts:464-509`
- Confirm dialog: `src/components/gear/DeleteButton.tsx`
- Offline decisions: `context/archive/2026-10-11-finder-chart/plan.md` (O-4, D-13 to D-15), `context/archive/2026-10-14-what-to-expect/plan.md` (O-2)
- Action tiers: `feat/ui-refine`, `context/changes/ui-quiet-actions/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Table, store and isolation

#### Automated

- [ ] 1.1 The migration applies to the local stack in an announced window, without a reset: `npx supabase migration up`
- [ ] 1.2 `npm run db:types` with the stack at main + this migration, then `git diff --exit-code src/lib/database.types.ts` after the commit
- [ ] 1.3 `npm run test:db` passes: structure (four policies on `session_plans`), isolation with `needsSite`, `tests/db/session-plans.test.ts`
- [ ] 1.4 `npx vitest run src/lib/session-plans` passes
- [ ] 1.5 `npm run lint` and `npx astro check` pass
- [ ] 1.6 The stack is put back with `local-down.sql` after the run (`npx supabase migration list` shows main's set)

#### Manual

- [ ] 1.7 Break check: drop the site guard from the INSERT policy; `session-plans.test.ts` turns red; revert

### Phase 2: Applying edits to the night

#### Automated

- [ ] 2.1 `npm test` passes, including `plan-edits.test.ts`, `plan-order.test.ts`, `plan-window.test.ts`, the order cases in `session-plan.test.ts`, the edited-plan, href and hint cases in `build.test.ts`, the `load.test.ts` night cases and the new invariant cases
- [ ] 2.2 `src/lib/engine/calibration.test.ts` and the ranking suites pass unchanged
- [ ] 2.3 `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 2.4 Break check: let `applyPlanEdits` draw a deep-sky key that is not reachable from a fabricated window; the invariant turns red; revert

### Phase 3: Full-plan routes, gated plan island and HTTP checks

#### Automated

- [ ] 3.1 `npm test` passes, including the route, redirect, `plan-window` boundary (minimum altitude, dark window, polar day), `from.test.ts`, finder `load.test.ts`, `copies.test.ts` (`saved` refused for storage) and protected-routes cases
- [ ] 3.2 `npm run lint` and `npx astro check` pass
- [ ] 3.3 `npm run smoke` against a local preview (stack in an announced window, keys inline) passes, including plan 1–7

#### Manual

- [ ] 3.4 Break check: move `requireFullPlan` after the store call; plan 1 turns red; revert
- [ ] 3.5 On a preview, the free lock line, a forced `?error=` alert and the held line read correctly in EN and PL

### Phase 4: Fresh offline copy after a save

#### Automated

- [ ] 4.1 `npm test` passes, including the `storeRequestFrom` cases (foreign origin, unknown path, extra param, notice param refused)
- [ ] 4.2 `npm run lint` and `npx astro check` pass
- [ ] 4.3 `npm run build` succeeds (`build-sw.mjs` raises nothing)
- [ ] 4.4 `tests/e2e/session-plan-store.spec.ts` passes against a fresh local preview with the forecast fixture

#### Manual

- [ ] 4.5 On a preview, after a save the toast shows, and DevTools' Cache Storage holds the new copy without a reload

### Phase 5: Editor, reset dialog and dashboard

#### Automated

- [ ] 5.1 `npm test` (reducer, i18n parity, no-hardcoded-colors, contrast, no-console guard) passes
- [ ] 5.2 `npm run lint` and `npx astro check` pass
- [ ] 5.3 `npm run build` succeeds
- [ ] 5.4 The whole e2e suite passes against a fresh local preview with the forecast fixture and keys inline (lessons): `npm run test:e2e`
- [ ] 5.5 `npm run smoke` passes

#### Manual

- [ ] 5.6 On a phone-width preview: edit, save, reload, reset in dark, light and red; red tells enabled and `aria-disabled` controls apart by shape, not only colour
- [ ] 5.7 Keyboard only: open, move, add, save, reset, with focus visible and kept
- [ ] 5.8 Polish copy fits at 320 px

### Phase 6: Docs and rules

#### Automated

- [ ] 6.1 `npx prettier --check CLAUDE.md context/foundation/test-plan.md context/foundation/prd.md` passes

#### Manual

- [ ] 6.2 The owner reads the CLAUDE.md paragraph and finds it accurate
