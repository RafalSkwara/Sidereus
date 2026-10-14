---
date: 2026-10-14T15:16:34+0200
researcher: Claude (herdr agent "session-plan")
git_commit: 2d6ba76
branch: feat/adjustable-session-plan
repository: RafalSkwara/Sidereus
topic: "Adjustable session plan (M-3 S-08): what the code offers for per-user, per-site, per-night plan edits"
tags: [research, session-plan, tonight, account-plans, offline, rls, supabase]
status: complete
last_updated: 2026-10-14
last_updated_by: Claude (herdr agent "session-plan")
---

# Research: Adjustable session plan (M-3 S-08)

**Date**: 2026-10-14T15:16:34+0200
**Researcher**: Claude (herdr agent "session-plan"), with four read-only sub-agents
**Git Commit**: 2d6ba76 (main 8f2f8d2 plus the change folder)
**Branch**: feat/adjustable-session-plan
**Repository**: RafalSkwara/Sidereus

## Research Question

What does the codebase offer, and what does it lack, for roadmap S-08 / PRD FR-044 / US-08? A full-plan user can reorder, drop and add targets on the Session plan for a site and night and can reset it to the suggested plan. The edits are saved per user, site and night, and they reach every device and the stored offline copy. Editing needs the network. A free account sees what the feature does and that it needs the full plan. The constraints: a new per-user table under RLS, the full-plan gate, the offline rules (PRD Open Question 23), and the guardrail that no target is ever scheduled outside its window.

## Summary

1. **The suggested plan is computed on every request and is not stored.** `buildTonight` builds it only under `withSessionPlan` (`src/lib/tonight/build.ts:1099-1252`).
   - It holds the Moon (when it is a target), every ranked planet, and the ranking's top deep-sky entries (`planObjects = ranked.entries`, build.ts:775).
   - The plan page and the dashboard pass no `limit`, so the default `MAX_RANKED_OBJECTS` = 5 applies (build.ts:629-640; `PlanPageContent.astro:36`, `TonightContent.astro:81`).
   - Deep-sky entries exist only when the verdict card passes, that is go or marginal with a dark window (build.ts:748, 760).
   - `layoutSessionPlan` (`src/lib/tonight/session-plan.ts:62-106`) orders the rows by peak time. The sort is stable, so ties keep the order Moon, planets, then objects by rank. It drops rows whose window misses the axis.
   - The final rows keep only axis fractions (`from`, `to`, `best`). The raw window survives only in `windowText`, plus a local map used for the tile's `nextUp` (build.ts:1190).
2. **What we would store.** Nothing persists the plan today, so an edit must be stored as data that the server re-applies to a freshly built night. Re-applying is mostly ordering and filtering. An added target is the exception, because it needs a window and a track that `buildTonight` does not compute today:
   - **Cleared objects beyond the top 5 and washed-out objects:** their window and peak come out of `rankObjects` with a higher `limit` (ranking.ts:236-262).
   - **Below-bar objects:** `rankObjects` drops them (ranking.ts:236). For these, and for a planet that is not ranked, a window has to be composed from engine exports: `objectTrack` over the dark window plus `bestWindow(track, minAltitudeDeg)`, or `planetTracks` over the planet window (`src/lib/engine/index.ts:28, 52`; `objects.ts:76`). This is how `scoreObject` and `rankPlanets` already derive windows.
   - Either way the window rule stays the engine's own, which keeps the guardrail.
3. **The guardrail holds by construction if three things are true:**
   - every row comes from an engine window: dark window and the site's minimum altitude for deep-sky, Sun below −6° for the Moon and planets;
   - the server validates every added key against that night's window when it writes;
   - a stored key with no window on the night of rendering is never drawn as a scheduled row.
   - `src/lib/tonight/visibility-invariants.test.ts:205-240` already proves that every row stays inside its window and threshold. It also asserts that the plan lists exactly the ranking's entries, planets and Moon target, so an edited plan breaks that equality and the test needs a sibling for edited plans.
   - **Reorder:** rows carry no scheduled time, only the window and best time the sky gives them. Reordering therefore changes the list order, not a time. Whether a reordered row should keep its own best time or be placed in a sequence is a product decision.
4. **Per-user table.** The migrations to copy are `observing_milestones` (`supabase/migrations/20261013120000_observing_milestones.sql:28-69`) and `sky_checks` (`20261003120000_sky_checks.sql:20-68`). Both have `user_id default auth.uid()` and four `to authenticated` policies on `(select auth.uid()) = user_id`.
   - `sky_checks` adds a site-ownership `exists` guard in its INSERT and UPDATE `with check` (sky_checks.sql:47-64), because a foreign key check bypasses RLS.
   - Every existing site foreign key is `on delete set null` with a name snapshot. A plan edit is meaningless without its site, so `on delete cascade` would be new in the repo.
   - The `TABLES` harness inserts a static `valid` row (`tests/db/tables.ts:12-20`). A NOT NULL `site_id` therefore needs a harness extension, or the column has to be nullable, which is what `sky_checks` does (tables.ts:63-75).
   - The latest migration is `20261013120000`.
5. **Full-plan gate.** `requireFullPlan` fails closed, `accountPlanForCopy` is three-valued, and `expectationView` maps full to lines, free to locked and unknown to nothing (`src/lib/account-plan/index.ts:67-100`; `src/lib/tonight/expectation.ts:29-34`).
   - `/tonight/plan` is free today and must stay free (FR-031). Only editing is gated: the plan page is not a full-plan page.
   - The edited rows and the edit controls are the gated part. They need the gate in the island, because island URLs bypass the middleware. Every write route needs it too.
   - No POST route calls `requireFullPlan` yet (`src/pages/api/**`), so the new route is the first full-plan POST. Test-plan §6.4's "A full-plan route" recipe applies to it.
6. **Offline.** `/tonight/plan` is already stored as a shell plus island pair (`src/lib/offline/copies.ts:14-22`), with a `?night=next` copy fetched by the worker. That copy is refreshed at most once an hour (`NEXT_REFRESH_MS`, copies.ts:45, 480-484).
   - Edits that the island renders on the server therefore reach the stored copy on that device's next clean online visit. Device B updates only when it visits online.
   - A save redirect carrying a notice param is not stored if the param is in `NOTICE_PARAMS` (copies.ts:48). `saved` is not in that list. If a redirect carries a toast param, the first post-save view is either not stored (stale until the next visit) or stores the toast.
   - The plan-loss drop is finder-only (`dropFinderCopies`, and `FINDER_PAGE` hard-coded in `commitPair`, copies.ts:375-418). A demoted user's stored plan page is replaced on its next online answer anyway.
   - OQ23 needs its own answer for plan edits. The Targets precedent (O-2) relied on the text being derived from public data, and plan edits are user data.
7. **UI.** Each row today is one full-width `<a>` (`SessionTimeline.astro:115-198`), so any control needs the row restructured: the link becomes a part of the `<li>`, and the controls sit beside it.
   - Nothing in the repo is a reorderable list (no drag-and-drop, no up/down buttons).
   - Reusable pieces:
     - plain POST forms with per-row buttons (`SkyAnswerForm.astro`, `src/pages/api/log/sky/[id].ts`);
     - the shared `Combobox` and the log's `TargetPicker`, for "add";
     - `DeleteButton.tsx`'s token-styled `alertdialog`, for a "reset" confirm;
     - `data-needs-network` on forms (`page-state.ts:82-124`).
   - `ui-quiet-actions` (in flight on `feat/ui-refine`, Phase 1 uncommitted) introduces `hairline`/`sm` (the one per-item button), `quiet`/`bare` (every other standalone link) and a new `--control-border` token, and later removes `action`.
   - It explicitly leaves whole-row links, including the Session plan rows, unchanged. Its Phase 1 touches `button.tsx`, `global.css`, `contrast.test.ts` and `design.astro`, which overlaps with a `/design` specimen for this change.

## Detailed Findings

### 1. How the Session plan is built today

- Call chain: `loadTonightFor` (`src/lib/tonight/island.ts:39-60`) → `loadTonight` (`src/lib/tonight/load.ts:101`, 154-164) → `buildTonight` (`build.ts:636`). The plan block is build.ts:1099-1252. It is in try/catch, and a failure logs one fixed line and sets `sessionPlan = null` (build.ts:1244-1250).
- Types: `TonightSessionPlanRowInput` (build.ts:352-372) has `kind` (`object` | `planet` | `moon`), `key`, `window`, `bestAt`, `label`, `name`, `href`, `bestTime`, `windowText`, `bestDirection`, `track` (tenths of a degree on the axis grid) and `peakAltitudeDeg`. `TonightSessionPlan` (build.ts:381-416) has the axis texts, `dark`, `moonEvents`, `ticks`, `rows`, `minAltitudeDeg`, `trackStep` and `nextUp`.
- Row sources:
  - Moon: `planMoon` from `moonTarget` (build.ts:911-938). It needs the planet gate and `MOON_MIN_ILLUMINATION`.
  - Planets: `planPlanets = rankPlanets(...)` (build.ts:854, 887). They are judged over the planet window (Sun below −6°). Uranus and Neptune are dropped below 130 mm, and the track is masked to clear hours when the card does not pass.
  - Deep-sky: `planObjects = ranked.entries` (build.ts:775), on `cardPasses` only.
- Windows:
  - Deep-sky: `scoreObject` → `bestWindow(track, site.minAltitudeDeg)` over the dark-window track (score.ts:135; ranking.ts:200, 10-minute step). The result is the longest contiguous run at or above the minimum, with the peak at the highest sample (objects.ts:76-105).
  - Planets: the same `bestWindow` over `planetTracks` on the planet window (planet-ranking.ts:106-113).
  - Each row's `track` covers the whole axis (sunset to sunrise) and is computed separately. The sky view's tracks are reused when present (build.ts:1100-1127).
- Tile: `nextUp` is decided on the server from `now` and the raw window ends (build.ts:1188-1198). `TonightTiles.astro:52-63, 147-151` renders one line ("first", "next", "done" or empty). An edited plan changes `rows`, so `nextUp` has to be computed over the edited rows.
- Inputs, for keying and drift (build.ts:636-700):
  - The night is `TonightView.date`, a site-local `YYYY-MM-DD` (build.ts:424). `?night=next` is `date + 1` from the same forecast (build.ts:685-692; `requested-gear.ts:46`).
  - The suggested set changes within a night when the log changes (`LOG_PENALTY` reorders the top 5, ranking.ts:229) or the forecast flips the verdict (removing every deep-sky row).
  - The telescope changes the top 5, through the limiting magnitude and the score, but not any window. Edits keyed per (user, site, night), as FR-044 says, therefore survive a telescope switch, while the suggestion under them may differ.

### 2. Computing a window for an added target

- `rankObjects` returns `entries` (cleared, capped by `limit`), `washedOut` (window plus peak, never ranked) and `clearedCount` (ranking.ts:215-262).
- `rankObjects` drops three kinds of object:
  - objects fainter than the telescope's limiting magnitude (`scoreObject` returns null, score.ts:130-132);
  - objects never above the minimum altitude in the dark window (score.ts:135-137);
  - cleared objects that fall below `MIN_OBJECT_SCORE` (ranking.ts:236).
- Engine exports for composing a single target (`src/lib/engine/index.ts`):
  - `objectTrack` and `bestWindow` (line 28);
  - `planetTracks` (line 52);
  - `darkWindow` (line 9);
  - `moonTrack` (line 17).
  - `maskedTrack` (`solar-system-window.ts`) was not found in the barrel.
- No exported helper turns a window and peak into a `TonightSessionPlanRowInput`. `rowOf` is a closure inside `buildTonight` (build.ts:1123-1152), so the plan would extract it or build added rows in the same block.
- Candidate pools for "add another object visible that night":
  - **A.** Cleared beyond the top 5, plus washed-out, plus unplanned planets and the Moon. Their data already exists when `limit` is `Infinity`, as on Targets (`TargetsPageContent.astro:62`).
  - **B.** Every `DEEP_SKY` object (171) with a `bestWindow` that night, plus planets and the Moon with a window. This needs the per-object composition above. Whether objects beyond the telescope's limiting magnitude count is a product choice.

### 3. Database patterns

- Migration shape (observing_milestones.sql:28-69; sky_checks.sql:20-68):
  - `id uuid pk default gen_random_uuid()`;
  - `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`;
  - checks on text columns, a unique key, and indexes on `user_id` and `site_id` (sky_checks.sql:38-39);
  - `enable row level security`, then four policies `<table>_{select,insert,update,delete}_own` `to authenticated`, where INSERT is `with check` and UPDATE has both `using` and `with check`;
  - no explicit table grants.
- Site guard: `site_id is null or exists (select 1 from public.sites s where s.id = site_id and s.user_id = (select auth.uid()))` in INSERT and UPDATE (sky_checks.sql:47-64; observations.sql:36-59).
- `sky_checks`' unique key `(user_id, site_id, night)` is NULLS DISTINCT, so `onConflict` upserts work for live sites (sky_checks.sql:35).
- Harness: `TableCase` has `table`, `valid` (with no `user_id`) and `change` (tables.ts:12-20). `isolation.test.ts` runs the owner control, cross-user select, update, delete and insert, and the anon refusals over `TABLES` (describe.each, :65), and deletes A's rows after each test (:71-81). `structure.test.ts` demands RLS and exactly four policies keyed on owner (:162-206) and checks functions (:237-250).
  - The `sky_checks` entry uses `site_id: null` and leaves the site guard to `tests/db/sky-checks.test.ts`, which creates a site with `addSite` (:52-64).
- Stores: `milestone-store.ts:28-62` and `sky-checks/store.ts:17-147`.
  - Database text never leaves the store, and the store never logs.
  - Reads throw `new Error(<fixed key>, { cause })`.
  - Writes return `WriteResult` (`{ ok: true } | { ok: false, message }`).
  - A single-row read per (site, night) uses `.eq().eq().maybeSingle()`, within `max_rows`, which the lessons file requires for lists.

### 4. Routes, gate and HTTP checks

- POST pattern (`src/pages/api/log/sky/[id].ts:13-37`; `src/lib/sky-checks/schemas.ts:22-25`; `redirect.ts:13-20`):
  - form data, then zod with key-valued errors and `from` clamped by `.catch`;
  - `!supabase` redirects with `NOT_CONFIGURED`, a parse failure with `issueKey`;
  - then the store, then a redirect with a fixed success param or `?error=<key>`.
- `PROTECTED_ROUTES` covers `/api/log`, `/api/gear` and `/api/onboarding` (`src/lib/protected-routes.ts`). A new `/api/tonight/...` or `/api/plan/...` prefix needs an entry, plus a `protected-routes.test.ts` case. The middleware sends a signed-out POST to plain sign-in (`src/middleware.ts:38-41`).
- The log's `from` mechanism returns only to `/tonight`, `/tonight/targets`, `/tonight/moon` and `/tonight/planets` (`src/lib/observations/schemas.ts:96`; `redirect.ts:30-33`). `/tonight/plan` needs its own return.
- Gate API (`src/lib/account-plan/index.ts`):
  - `getAccountPlan` (:67) is memoised per request and fails closed.
  - `accountPlanForCopy` (:78) returns `{ plan: full|free|unknown, at }`.
  - `requireFullPlan` (:82-100) returns `{ ok }` or a `reason` of `not-configured`, `signed-out` or `needs-full`, with `errorKey`. The needs-full key is `errors.accountPlan.needsFull` (`api-errors.ts:13`; en.ts:1557, "This needs the full plan.").
- Locked presentation precedents:
  - `FinderLocked.astro:35-67`: what it does, an info `Notice` that it needs the full plan, and a fixed example.
  - The one-line `data-expect-locked` on Targets (`TargetsPageContent.astro:183-188`, copy `tonight.expect.locked`, en.ts:1162).
- Smoke (`scripts/smoke.mjs`):
  - `request()` (:67-86) uses manual redirects with a cookie jar and an Origin header.
  - `setPlan` (:96-103) runs a child `account-plan.mjs`. `hasPlanKey` (:90) skips locally and fails under CI.
  - `islandUrlFromShell` (:132-145) and `replayIsland` (:147-153) capture and replay the island.
  - The finder steps 1-6 are at :247-352. No full-plan POST refusal exists yet.
  - e2e has `requirePlanGrant` and `setPlan` (`tests/e2e/helpers.ts:180-203`).

### 5. Offline layer

- Storage:
  - The pair commit is `recordShell` + `commitIsland` → `commit` (`src/sw.ts:306-455`).
  - The island metadata is `OfflineCopy.astro:44-59`, parsed by `copyMetaFromIsland` (copies.ts:235-267). It holds owner, site, night date, kind, preparedAt, validUntil, forecast time, `data-plan` and `data-plan-at`, and nothing about plan content.
  - The key is (siteId, page, target, kind) (`commitPair`, copies.ts:382-385).
- Next-night copy: `storeNextCopy` (sw.ts:464-509) fetches `${page}?site=<id>&night=next` and its island. It runs only after a kind=tonight commit, and only when the stored next copy is missing or at least 1 h old (copies.ts:480-484).
  - An edit to tomorrow's plan, if the UI allowed one, reaches the next-night copy only after that hour.
- Expiry: 36 h after the site's newest copy (copies.ts:43, 438). Purges happen on auth POSTs, the sign-in bounce, a signed-out page and another owner's commit (sw.ts:140, 559-562, 651-660; copies.ts:132).
- POST then redirect (inference from code, not yet exercised by any spec):
  - POST navigations go through `networkOrOffline` → `fetch(request)` (sw.ts:664-675).
  - A navigation request's redirect mode is `manual`, so the browser itself follows the 302 with a fresh GET navigation. That GET passes through the stored-page route and is stored when its URL passes `mayStoreShell` (copies.ts:181) and the answer is a 200 text/html (`isHtml200`, sw.ts:119-122).
  - The plan's e2e should prove this on device A.
- Notice params: `NOTICE_PARAMS = ["logged", "skyChecked", "error", "milestone"]` (copies.ts:48; pinned by `copies.test.ts:155-179`). `TOAST_PARAMS = ["saved", "updated", "deleted", "logged", "skyChecked"]` (`src/lib/toasts.ts:17`).
- Plan-loss drop:
  - `commitPair` drops every finder pair on a `free` island and keeps `freeSince` (copies.ts:375-402). `dropFinderCopies` filters `FINDER_PAGE` (copies.ts:409-418).
  - Nothing is generic. Widening it to the plan page would mean a list of plan-gated pages in `commitPair` and the drop.
  - Today a `free` render of `/tonight/plan` already replaces the stored edited copy for the same (site, page, kind) on the next online answer.
- Offline controls: `[data-needs-network]` on a `form` sets `aria-disabled` on its buttons and swallows clicks and submits while `html[data-offline]` (`page-state.ts:63-65, 82-96, 118-124, 150-151`; precedent `SkyAnswerForm.astro:45`). It keys off `navigator.onLine`: a timed-out network with the stored copy shown leaves the controls enabled, and a submit lands on `/offline`, the same as the existing forms.

### 6. UI and the in-flight ui-quiet-actions

- `/tonight/plan`:
  - `plan.astro` (GearShell skyFlow + `PlanPageContent server:defer`, skeleton `layout="plan"`);
  - `PlanPageContent.astro` (messages column :57-104, timeline Band :106-112, `OfflineCopy` :55);
  - `SessionTimeline.astro` (4 fact lines :64-69, legend :71-113, rows `<ol><li><a data-session-plan-row>` :115-198).
  - The plan page has no Mark observed and no notices (plan.astro:3-4).
- The skeleton `TonightPageSkeleton.astro` mimics the row heights. Specimens are in `design.astro:1981-2002` and 2370.
- Tests that pin the plan:
  - unit: `session-plan.test.ts`, `build.test.ts:1632+`, `night-boundaries.test.ts:104`, `visibility-invariants.test.ts:205-240`, `altitude-curve.test.ts`, `copies.test.ts`;
  - e2e: `tonight-dashboard.spec.ts:40, 114-144`, `tonight-sky.spec.ts:252-257`, `tonight-phone.spec.ts:39`, `offline.spec.ts:54-67`.
- ui-quiet-actions (`ui-refine` worktree, `context/changes/ui-quiet-actions/plan.md`):
  - Status `implementing`. Phase 1 is uncommitted (`button.tsx`, `global.css`, `contrast.test.ts`, `design.astro`), and Phases 2 and 3 are not started.
  - The tiers are `default` (one per screen), `hairline`/`sm` (the one per-item button, neutral `--control-border`, primary-strong icon), `quiet`/`bare` (every other standalone or per-item link, always with its icon, link colour, underline on hover and at rest in red), and `link` (in a sentence).
  - `action` goes in Phase 2.
  - Unchanged on purpose: whole-row links, Session plan rows included (plan.md:116).
  - The proposed Clickables rule is plan.md:367-376 (Phase 3).
- Overlap with this change:
  - shared files: `button.tsx` (we consume its variants), `design.astro` (we add specimens; expect a merge conflict) and `global.css`;
  - the `BackLink` on `/tonight/plan` becomes quiet;
  - a later `ui-tonight-nav` (ui-refine `audit.md:258`) replaces focused-page BackLinks.
  - Plan consequence: our controls must use `hairline` and `quiet` only after ui-quiet-actions merges, or the branch has to be rebased onto it before our UI phase.

## Code References

- `src/lib/tonight/build.ts:352-416` - Session plan types
- `src/lib/tonight/build.ts:748-777` - `cardPasses`, `rankObjects` call, `planObjects`
- `src/lib/tonight/build.ts:1099-1252` - Session plan block, `rowOf`, `nextUp`
- `src/lib/tonight/session-plan.ts:62-106` - pure layout, sort by peak
- `src/lib/engine/ranking.ts:215-262` - entries, washed-out, bar, limit
- `src/lib/engine/objects.ts:76-105` - `bestWindow`
- `src/lib/tonight/visibility-invariants.test.ts:205-240` - plan rows within windows
- `src/components/tonight/PlanPageContent.astro:34-112` - plan island
- `src/components/tonight/SessionTimeline.astro:115-198` - row markup
- `src/components/tonight/TonightTiles.astro:52-63, 147-151` - plan tile
- `supabase/migrations/20261003120000_sky_checks.sql:20-68` - per-user table with site guard
- `supabase/migrations/20261013120000_observing_milestones.sql:28-69` - latest per-user table
- `tests/db/tables.ts:12-83` - `TABLES`
- `src/lib/account-plan/index.ts:67-100` - plan reads and guard
- `src/lib/tonight/expectation.ts:29-34` - three-way view rule
- `src/pages/tonight/finder.astro:38-76`, `src/lib/finder/load.ts:109-118` - two-layer gate
- `src/pages/api/log/sky/[id].ts:13-37` - plain-form POST route
- `src/lib/offline/copies.ts:14-48, 375-418, 480-484` - pages, notice params, commit, finder drop, next refresh
- `src/sw.ts:464-509, 664-675` - next-night copy, POST navigations
- `src/lib/offline/page-state.ts:82-124` - offline controls
- `src/lib/toasts.ts:17` - toast params
- `scripts/smoke.mjs:67-153, 247-352` - request helper, plan grant, finder steps

## Architecture Insights

- Tonight's views are pure functions of explicit inputs, re-run on every request, and pages only draw. An edit must therefore be stored as data that `buildTonight` (or a pure helper beside `layoutSessionPlan`) applies to the fresh night. The rendered plan is never stored.
- The engine's `bestWindow` is the one window rule. Re-using it for added targets keeps the guardrail in one place, and the invariant test can then be extended to edited plans.
- Full-plan features gate in the island (the shell is not enough), and every write route gates first, before any read or write.
- Offline copies are rendered HTML. Data the server renders into the island reaches the copy on the next clean online visit, with no worker change. A worker change is needed only to drop or refuse a copy.
- The repo has no interactive list yet. The simplest consistent path is plain POST forms with redirect-back, which is how sky checks work, and needs no new client state. An editor island would be the first of its kind.

## Historical Context (from prior changes)

- `context/archive/2026-10-05-session-plan-timeline/plan.md:31-37`: no editing, "a later change". No sequencing of overlapping windows (overlaps shown side by side). Only the top five plus planets and the Moon, no washed-out objects. No DB. The components only draw. Still accurate for main 8f2f8d2.
- `context/archive/2026-10-11-finder-chart/plan.md` O-4, D-13 to D-15 (:75-84): a stored chart drops at the first online free answer, `unknown` neither stores nor drops, `freeSince` refuses a late full render, offline links carry no `data-needs-network`. OQ23 is settled for charts only (`prd.md:772-781`).
- `context/archive/2026-10-14-what-to-expect/plan.md:237` O-2: the stored Targets copy keeps its full-plan lines until it is replaced, with no plan-loss drop. The reason given was that the text derives from public catalogue data and the user's own gear, which does not hold for user-made plan edits.
- `context/archive/2026-10-09-account-plans/plan.md:13, 57`: the plan is server-owned, and the "needs the full plan" presentation arrived with S-03.
- `context/foundation/roadmap.md:230` (Parked): offline plan edits with later sync are out. Editing stays online-only.

## Related Research

- `context/archive/2026-10-11-finder-chart/research.md` - the first full-plan page and the offline drop
- `context/archive/2026-10-09-testing-access-and-entitlement-boundary/research.md` - RLS, structure and isolation suites

## Open Questions (for the plan; product decisions go to the owner)

1. **Edit model:** store the whole ordered list of keys for (user, site, night), where reset deletes the row, or store a diff (dropped keys, added keys, order) applied to the fresh suggestion. This decides what happens when the suggestion moves after an edit (log, forecast, telescope).
2. **Meaning of order:** whether a reordered list keeps each row's own window and best time and shows "order" only as list position, or the plan sequences the rows in time. Sequencing is new scheduling logic, and the guardrail then applies to the assigned slots.
3. **Pool for "add":** pool A (cleared beyond the top 5, washed-out, unplanned planets and the Moon) or pool B (every catalogue object with a window that night). Also whether objects beyond the telescope's limit qualify.
4. **A stored key with no window on render**: a changed minimum altitude or site, the Moon not a target, a planet masked by cloud. The options are a muted "not up tonight" line with Remove, or a silent omission.
5. **Weather no-go nights:** whether editing is offered when the verdict is no-go and the suggested plan has no deep-sky rows. Deep-sky windows are astronomical, so they still exist.
6. **Interaction:** plain POST forms per action, an editor island with one Save, or drag-and-drop. Also the save confirmation: a toast param (not stored, or stored with the toast) versus a clean redirect.
7. **Nights:** tonight only, or also the next night or any night on `/tonight/nights`.
8. **Free account:** a locked one-liner, as on Targets, versus an explainer with an example, as on the finder. What a demoted user with stored edits sees. OQ23 for a stored edited copy after plan loss: replace on the next online answer (no worker change) versus an explicit drop.
9. **Site deletion:** `on delete cascade` (new in the repo) versus `set null` with a snapshot. A cascade with NOT NULL `site_id` needs a `TABLES` harness extension.
10. **Dashboard tile and live sky:** whether the tile's `nextUp` follows the edited plan (recommended), and whether the live sky's markers change (they show the ranking's top 5, independent of the plan).
11. **Coordination:** whether the UI phase waits for ui-quiet-actions to merge (to use `hairline` and `quiet`) or lands first on `action` and migrates later.
