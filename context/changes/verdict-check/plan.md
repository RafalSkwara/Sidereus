# Verdict check Implementation Plan

## Overview

Roadmap M-2 S-07 (GitHub #71). Sidereus records the sky headline Tonight showed for each signed-in user, site and night. The day after, a small card on Tonight asks "How was the sky?" with the three sky words. A new **Sky checks** page under the log lists every recorded night, lets the user answer or change any of them, and shows a tally: how many nights matched, how many misses were too optimistic or too pessimistic, and a per-word breakdown. This is the first real evidence for the verdict's cloud thresholds (PRD tunable #2), which can be collected without a telescope.

## Current State Analysis

From `research.md` (verified 2026-10-03 at 85e2a05):

- The verdict is computed on every Tonight render and thrown away. `buildTonight` sets `date` via `tonightDateFor` (`src/lib/tonight/build.ts:435`) and returns `siteId`, `verdict` and `headline` on `TonightView` (`:697-705`). Nothing is stored (`context/foundation/roadmap.md:79`).
- The sky words come from `skyHeadlineId(verdict)` (`src/lib/tonight/format.ts:122-139`, not exported) over seven ids, `go | marginal | no-go | humidityCap | fallbackCap | noForecast | noDarkness`, with catalogue keys in `SKY_HEADLINE_KEYS` (`:98-106`). EN "Clear" / "Partly clear" / "Cloudy" are `verdict.level.*` (`src/i18n/messages/en.ts:74`).
- No GET path writes to the database, and no upsert exists. The Tonight island (`src/components/tonight/TonightContent.astro:25-59`) has `Astro.locals.user`, the per-request RLS client, `now`, and a `defer` that calls `cfContext.waitUntil`, which is how the KV forecast write already happens after the response. Astro 7.3.2 fetches the island by GET with a preload link (`node_modules/astro/dist/runtime/server/render/server-islands.js:147-162`). `AllObjectsContent.astro:29` also calls `loadTonight`.
- The raw dark window (`DarkWindow` with `start`/`end` Dates, or `kind: "none"`) is `window` inside `buildTonight` (`build.ts:443`). The view carries only formatted strings.
- `tonightDateFor` keeps the night in progress as "tonight" until civil dawn, then moves to the evening ahead (`src/lib/engine/sun.ts:101-105`). The day after a viewed night, that night is `< view.date`.
- Templates to copy:
  - per-user table with site FK, `site_name` snapshot and per-operation RLS: `supabase/migrations/20260926200000_observations.sql`
  - `security invoker` RPC with explicit grants: `20260926120000_complete_onboarding.sql`
  - store shape: `src/lib/observations/store.ts`; `WriteResult` from `src/lib/gear/store.ts:23`
  - POST route that redirects with `?error=<key>`: `src/pages/api/log/index.ts:14-37`
  - isolation suite: `tests/db/isolation.test.ts:47-209`
- `/log` and `/api/log` are already gated (`src/lib/protected-routes.ts:5-14`). `gearConfig.files` (`eslint.config.js:84-102`) covers `src/lib/tonight/**`, `src/components/tonight/**`, `src/pages/api/log/**` and `src/pages/log/**`.
- Postgres 17 (`supabase/config.toml:36`). PostgREST `max_rows` is 1000 (`:18`).

## Desired End State

- A signed-in user who opens Tonight for a site has that night's sky headline stored once per (user, site, night). Views before the dark window starts keep overwriting it. After the dark window starts, it is frozen, unless no row exists yet, in which case the first view after dark is stored.
- On Tonight, if the selected site has an unanswered, unskipped, checkable recorded night from the last two nights before Tonight's date, a card below the Sky and Moon cards asks "How was the sky last night at Home?" with the headline that was shown. It has buttons for Clear, Partly clear and Cloudy, plus Skip and a link to Sky checks. Answering or skipping returns to Tonight with a short confirmation, and the card is gone.
- `/log/sky` shows the tally:
  - "N of M nights matched"
  - "x too optimistic · y too pessimistic"
  - Clear a of b · Partly clear c of d · Cloudy e of f

  Below the tally is the list of checkable recorded nights whose dark window has started, newest first, each with its site, "We said: …", the user's answer with its outcome, and the three buttons for answering or changing. The page is linked from `/log`.
- Everything is in EN and PL and in the dark, light and red themes. A per-user table is covered by RLS and by the isolation suite.

Verify with `npm test`, `npm run test:db`, `npx astro check`, `npm run lint`, the e2e spec `tests/e2e/sky-checks.spec.ts`, and screenshots of the card and the page (EN/PL, dark/light/red, phone/desktop).

### Key Discoveries:

- The PRD treats a false "go" as worse than a false "no-go" (`context/foundation/prd.md:71-73`), so misses keep their direction.
- `fallbackCap` ("Clear (old forecast)") is not an age threshold: it means the fetch failed and a stored copy was used (`src/lib/forecast/service.ts:152-154`).
- PostgREST `on_conflict` cannot target a partial unique index. A plain `unique (user_id, site_id, night)` (default NULLS DISTINCT) works for live sites and lets rows from deleted sites (`site_id` null) coexist. `nulls not distinct` would make deleting a second site with a shared night fail.
- `tests/e2e/forecast-fixture.mjs` always serves a clear sky, so Tonight's headline in e2e is deterministically `go`. No e2e user has a past night, so the spec seeds one.

## What We're NOT Doing

- Recording nights 2-3 of the seven-night strip. Only night 1 (Tonight's own night) is recorded, when it is Tonight.
- Recording a night with no dark window (`noDarkness`). It has nothing to check and no dark-window start.
- Asking about `noForecast` nights. They are recorded but treated as not checkable, so they are hidden from the card, the page and the tally.
- Changing the verdict, its thresholds or its wording. Using the tally to tune thresholds is later calibration work (#21 / PRD tunable #2).
- Per-site or per-period tallies, charts, export, and notes on an answer.
- Putting the question inside the log's night groups. The user chose a separate Sky checks page.
- Answering offline (S-06 keeps writes online-only), and any no-JS path inside the Tonight island (lessons.md).
- Anti-tamper on recorded headlines. A user can only alter their own rows, which affects only their own tally.

## Implementation Approach

Bottom-up, following the codebase's DB-change pattern:

1. Schema, RPCs and a pure claim/tally module, with DB and unit tests.
2. Recording on Tonight through the existing `defer`/`waitUntil` path, so the write never delays or breaks the render.
3. The answering route and the Tonight card.
4. The Sky checks page, its tally and the e2e spec.

The "which verdict counts" rule lives in one SQL function, so concurrent island renders (preload, reloads) and the all-objects page cannot disagree. The decision uses the database clock `now()` against the stored dark-window start, not a client-supplied time.

## Critical Implementation Details

- **Timing & lifecycle.** The recording call goes in `TonightContent.astro` only, after `loadTonight`, through the same `defer` that wraps the KV write. It is fire-and-forget: a failure is swallowed and never logged (coordinates privacy) and never reaches `?error=`. `AllObjectsContent.astro` does not record, because it shows the same night and must stay read-only.
- **Ordering of the overwrite rule.** On conflict, update the headline and `shown_at` only when `now() < dark_start` and `answer is null`. Once answered, the row is frozen. An insert always succeeds, whatever the time, which is how "first view after dark" is recorded and how the e2e seed creates a past night.

## Phase 1: Data layer and tally

### Overview

The `sky_checks` table, two RPCs, generated types, DB tests, the store, and a pure module that maps headlines to claims and computes the tally.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261003120000_sky_checks.sql`

**Intent**: A per-user record of the sky headline Tonight showed for a site and night, plus the user's later answer. It is additive, so it is safe to push before the app deploy.

**Contract**: Table `public.sky_checks`:
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`
- `site_id uuid references public.sites(id) on delete set null`
- `site_name text not null` (snapshot, same length check as observations)
- `night date not null` (site-local evening date of the noon-to-noon night, as `observations.night`)
- `headline text not null`, check in (`go`, `marginal`, `no-go`, `humidityCap`, `fallbackCap`, `noForecast`)
- `dark_start timestamptz not null`
- `shown_at timestamptz not null default now()`
- `answer text`, check in (`clear`, `partly`, `cloudy`)
- `answered_at timestamptz`
- `skipped_at timestamptz`
- `created_at timestamptz not null default now()`

Constraint `sky_checks_user_site_night_key unique (user_id, site_id, night)`. Indexes on `user_id` and `site_id`.

RLS is enabled with four `to authenticated` policies named `sky_checks_<op>_own`, copied from observations. Insert and update also require a non-null `site_id` to be owned by the caller.

Function `public.record_sky_verdict(site_id uuid, night date, headline text, dark_start timestamptz) returns void`:
- `language plpgsql security invoker set search_path = ''`
- Reads the site's name through RLS; if the site is not visible, it returns without writing.
- Inserts a row with `on conflict on constraint sky_checks_user_site_night_key do update` that sets `headline`, `dark_start` and `shown_at = now()` `where now() < public.sky_checks.dark_start and public.sky_checks.answer is null`.
- In plpgsql the parameter names shadow the column names (plan review F3). So the conflict target is the named constraint, never a column list, and every parameter reference is qualified as `record_sky_verdict.<name>`, as `complete_onboarding` does.
- Execute is revoked from `public` and `anon` and granted to `authenticated`.

Function `public.sky_check_tally() returns table (headline text, answer text, nights bigint)`:
- `language sql stable security invoker`
- Groups the caller's rows with a non-null answer by headline and answer. RLS scopes it to the caller.
- The same grants as above.
- This aggregates in SQL so the tally never hits `max_rows` (lessons.md).

#### 2. Generated types

**File**: `src/lib/database.types.ts`

**Intent**: Regenerate with `npm run db:types` against local Supabase with the migration applied. Never hand-edit.

**Contract**: The `sky_checks` table and both functions appear in the generated types.

#### 3. DB tests

**Files**: `tests/db/isolation.test.ts`, `tests/db/sky-checks.test.ts` (new)

**Intent**: Add a `TABLES` entry, and cover the table-specific rules the generic suite can't.

**Contract**:
- The isolation entry inserts directly with `site_id: null`, a `site_name`, a `night`, `headline: "go"` and a `dark_start`. Its `change` is `{ answer: "clear" }`.
- `sky-checks.test.ts` covers these cases:
  - the RPC inserts once, and a second call for the same night doesn't add a row;
  - before `dark_start` (a future `dark_start`), a second call overwrites the headline;
  - after `dark_start` (a past `dark_start`), a second call leaves it unchanged;
  - an answered row is never overwritten;
  - the store's `answer`, `skip` and `list` leave out a row whose `dark_start` is still in the future (plan review F1);
  - the RPC for another user's site writes nothing;
  - the row outlives its site (`site_id` becomes null, `site_name` is kept), and two deleted sites with the same night both survive;
  - the tally RPC returns only the caller's answered rows, grouped.

#### 4. Store

**File**: `src/lib/sky-checks/store.ts` (new)

**Intent**: Every `sky_checks` DB call, in the observations-store shape: the typed client comes first, writes return `WriteResult`, reads throw `new Error(LOAD_FAILED)`, `22P02` maps to not found, and DB text never leaves the module.

**Contract**: `skyCheckStore` methods:
- `record(client, { siteId, night, headline, darkStart })` calls the RPC and returns `WriteResult`.
- `openRecent(client, { sinceNight })` returns `SkyCheckRecord[]`: the caller's rows with `night >= sinceNight`, `answer is null`, `skipped_at is null` and a checkable headline, ordered `night desc, id`. It is used by `loadTonight` (Phase 3) and stays at most a few rows per site.
- `answer(client, id, answer, now)` sets `answer` and `answered_at` and clears `skipped_at`.
- `skip(client, id, now)` sets `skipped_at`.
- `answer` and `skip` update only `where dark_start < now`. A row whose dark window hasn't started reads as not found (plan review F1).
- `list(client, { page, now })` returns `{ entries, hasOlder }`. It filters to checkable headlines with `dark_start < now`, so tonight's own row stays hidden until dark. It orders by `night desc, site_name, id` and pages 50 at a time, copying `observationStore.list`'s `range(offset, offset + PAGE_SIZE)` and `hasOlder` pattern (`src/lib/observations/store.ts:136-151`).
- `tally(client)` returns `TallyRow[]` from the RPC.

`SkyCheckRecord` is `{ id, siteId | null, siteName, night, headline, answer | null, skipped: boolean }`.

Error keys:
- `errors.save.skyCheck`
- `errors.notFound.skyCheck`
- `errors.load.skyChecks`

They are added to `en.ts` and `pl.ts`.

#### 5. Pure claim and tally

**File**: `src/lib/sky-checks/claim.ts` (new), with `claim.test.ts`

**Intent**: The match rule in one place. It is pure and locale-free, so it can be unit tested on its own.

**Contract**:
- `type SkyAnswer = "clear" | "partly" | "cloudy"`.
- `claimOf(headline)`: `go`, `humidityCap` and `fallbackCap` give `"clear"`; `marginal` gives `"partly"`; `no-go` gives `"cloudy"`; `noForecast` and `noDarkness` give `null` (not checkable).
- `CHECKABLE_HEADLINES` is the five ids with a non-null claim.
- `outcomeOf(claim, answer)`: `"match"` when equal. On the order clear < partly < cloudy, `"optimistic"` when the claim is clearer than the answer, otherwise `"pessimistic"`.
- `tallyOf(rows: TallyRow[])` returns `{ answered, matched, optimistic, pessimistic, byClaim: Record<SkyAnswer, { answered, matched }> }`.

Tests:
- every headline id is covered;
- all 9 claim × answer outcomes are covered;
- the tally over a mixed set adds up (matched + optimistic + pessimistic = answered);
- `noForecast` rows are ignored.

#### 6. Lint coverage

**File**: `eslint.config.js`

**Intent**: The new modules read site records and site names (lessons.md, "Put every module that touches site coordinates under the no-console lint").

**Contract**: Add `src/lib/sky-checks/**` and `src/components/sky-checks/**` to `gearConfig.files`.

### Success Criteria:

#### Automated Verification:

- Migration applies on local Supabase: `npx supabase db reset` succeeds
- Types regenerated with no drift: `npm run db:types && git diff --exit-code src/lib/database.types.ts` after commit
- Isolation and sky-check DB tests pass: `npm run test:db`
- Claim and tally unit tests pass: `npm test`
- Type check and lint pass: `npx astro check && npm run lint`

---

## Phase 2: Record the shown verdict on Tonight

### Overview

Tonight's island stores the night-1 headline after rendering.

### Changes Required:

#### 1. Headline id and dark-window start on the view

**Files**: `src/lib/tonight/format.ts`, `src/lib/tonight/build.ts`, and their tests

**Intent**: The recorder needs the stable headline id and the raw dark-window start, neither of which the view carries today.

**Contract**:
- `SkyHeadline` gains `id: SkyHeadlineId`, and `SkyHeadlineId` is exported.
- `TonightView` gains `darkStart: Date | null`: the night-1 `DarkWindow.start`, or `null` for `kind: "none"`.
- Existing consumers of `headline.key` and `headline.text` are unchanged: `VerdictCard.astro`, `NightStrip.astro`, `AllObjectsContent.astro` and `Welcome.astro`.
- `darkStart` stays on the server: no client island receives the view.
- Tests that deep-equal a headline gain the `id` (plan review F6): `src/lib/tonight/format.test.ts:207-208` (add an id column to the rows at `:147`) and `src/lib/tonight/build.test.ts:225,244,255,359`.

#### 2. Recording rule and call

**Files**: `src/lib/sky-checks/record.ts` (new, with a test), `src/components/tonight/TonightContent.astro`

**Intent**: Decide whether a view should be recorded, then hand the store call to `defer` so it runs after the response.

**Contract**:
- `recordableVerdict(view)` returns `{ siteId, night: view.date, headline: view.headline.id, darkStart }`, or `null` when there is no view, `darkStart` is null, or the headline is `noDarkness`.
- In `TonightContent.astro`, the inline `defer` arrow passed to `loadTonight` (`:57-59`) is hoisted into a `const defer = (task: Promise<void>) => Astro.locals.cfContext.waitUntil(task)` and used by both calls (plan review F5).
- When `supabase` and `user` are set and the result is non-null, it calls `defer(skyCheckStore.record(supabase, …).then(() => undefined, () => undefined))`. So `record` must resolve to `Promise<void>` and never reject.
- `AllObjectsContent.astro` is untouched.

### Success Criteria:

#### Automated Verification:

- `recordableVerdict` unit tests pass (no view, no-darkness night, normal night): `npm test`
- `format`/`build` tests updated for `headline.id` and `darkStart` pass: `npm test`
- Type check and lint pass: `npx astro check && npm run lint`
- Existing Tonight e2e specs still pass against a local preview

#### Manual Verification:

- After opening Tonight locally as a signed-in user, `sky_checks` holds one row for (user, Home, tonight's date) with headline `go`; a reload keeps one row (checked with a local SQL query)

---

## Phase 3: Answer on Tonight

### Overview

The POST route for answers and skips, and the Tonight card.

### Changes Required:

#### 1. Input schema and route

**Files**: `src/lib/sky-checks/schemas.ts` (new, island-safe), `src/pages/api/log/sky/[id].ts` (new)

**Intent**: One route for answering, changing an answer and skipping, following the log route pattern. `/api/log` is already gated.

**Contract**:
- A form POST takes `action` (`clear | partly | cloudy | skip`) and `from` (`tonight | sky`, default `sky`).
- It checks `NOT_CONFIGURED`, then runs zod `safeParse`, then calls `skyCheckStore.answer` or `skip`.
- On success it redirects to `/tonight?skyChecked=1` or `/log/sky?skyChecked=1`.
- On failure it redirects to the same path with `?error=<key>`.
- An unknown `id`, or a row whose dark window hasn't started yet, gives `errors.notFound.skyCheck`.
- No form value is echoed into the URL.

#### 2. Pending check for the card

**Files**: `src/lib/tonight/load.ts`, `src/lib/sky-checks/pending.ts` (new, with a test), `src/components/tonight/TonightContent.astro`

**Intent**: Load the card's data without adding a sequential DB round trip to Tonight (plan review F2). Today nothing in TonightContent queries after `loadTonight`, whose four reads run in one `Promise.all` (`load.ts:~103-108`).

**Contract**:
- `LoadTonightInput` gains an opt-in `withSkyChecks?: boolean`. Only TonightContent sets it, so `AllObjectsContent` is unchanged.
- When set, a fifth `load(...)` entry in the same `Promise.all` calls `skyCheckStore.openRecent(supabase, { sinceNight })`. `sinceNight` is the UTC date of `now` minus 3 days, a superset of every site's two-night window in any time zone. `TonightLoad` gains `openSkyChecks: SkyCheckRecord[]`, empty on failure or when not requested.
- `pendingCheck(openSkyChecks, siteId, tonightDate)` is a pure helper in `pending.ts`. It returns the newest row for the site with `tonightDate − 2 days <= night < tonightDate`, or `null`. The date arithmetic is on the ISO date string, with unit tests that cross a month boundary and exclude tonight, three days back and another site.
- TonightContent calls `pendingCheck(openSkyChecks, site.id, view.date)`.
- A load failure hides the card silently. It is optional UI and must not cost Tonight its render.

#### 3. The card

**File**: `src/components/tonight/SkyCheckCard.astro` (new)

**Intent**: The question. It sits below the Sky and Moon row and above the notices and sections.

**Contract**:
- The title is "How was the sky last night at {site}?" when `night` is `view.date − 1`, else "How was the sky on {date} at {site}?". The date is formatted with `createFormatter`.
- The line "We said: {headline text}" uses the stored headline's catalogue key (`SKY_HEADLINE_KEYS`).
- There are three POST buttons labelled with `verdict.level.go`, `verdict.level.marginal` and `verdict.level.no-go`, so the answer words are the headline words, plus a quiet "Skip" button and a link "All sky checks" → `/log/sky`.
- It is a plain Astro `<form method="POST" action="/api/log/sky/{id}">` with a hidden `from=tonight` and named submit buttons (`<button name="action" value="clear">` and so on), with no React island.
  - This is the repo's first plain Astro POST form; every POST form today is a React island (plan review F6).
  - It needs no client state, and Astro's default `checkOrigin` accepts the same-origin post.
  - The `/log/sky` rows use the same form shape with `from=sky`.
- Colours come from tokens only, and the card works in red mode.

#### 4. Confirmation and copy

**Files**: `src/pages/tonight.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: A status line after answering, like the existing `?logged=` notice, and all new copy in EN and PL.

**Contract**:
- `?skyChecked=1` shows "Saved to your sky checks." The PL text is decided during implementation.
- A new `skyChecks` key group holds the card, the page and the outcome words: matched, too optimistic, too pessimistic.
- The PL parity test passes.

#### 5. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: One step for the new route.

**Contract**: POST `/api/log/sky/<random uuid>` with `action=clear` redirects to a `/log/sky?error=` location.

### Success Criteria:

#### Automated Verification:

- Schema and date-helper unit tests pass, and the i18n parity test passes: `npm test`
- Type check and lint pass: `npx astro check && npm run lint`
- Smoke passes against a local preview on local Supabase: `npm run smoke`

#### Manual Verification:

- With a seeded row for two nights ago, Tonight shows the card below the Sky and Moon cards; answering returns to Tonight with the confirmation and no card; Skip does the same without an answer (screenshots EN/PL, dark/light/red, phone/desktop)
- A night three or more days back, an answered night, a skipped night and a `noForecast` night produce no card

---

## Phase 4: Sky checks page and tally

### Overview

`/log/sky`: the tally and the list of recorded nights, linked from the log, plus the e2e spec.

### Changes Required:

#### 1. Page

**File**: `src/pages/log/sky.astro` (new), with components in `src/components/sky-checks/` (new)

**Intent**: The full history and the tally. It is gated through `/log`.

**Contract**:
- Header: the title "Sky checks" and a one-line intro.
- Tally block from `tallyOf(skyCheckStore.tally())`:
  - "{matched} of {answered} nights matched"
  - "{optimistic} too optimistic · {pessimistic} too pessimistic"
  - per word, "Clear {m} of {n}" for each claim with at least one answer
  - plurals through `plural()`
- List: rows ordered as the store returns them. Each row shows the date, the site, "We said: …" and either:
  - the answer word with its outcome (match, too optimistic, too pessimistic) and the three buttons with the current one `aria-pressed`; or
  - the three buttons when unanswered.

  The buttons POST to `/api/log/sky/[id]` with `from=sky`.
- Paging: "Older" and "Newer" links, as on `/log`.
- `?skyChecked=1` notice and `?error=` via `ServerError`.
- Empty state: no checks yet, with a hint to open Tonight before dark and come back the next day, and a link to `/tonight`.
- `DatabaseMissing` when `supabase` is null.

#### 2. Link from the log

**File**: `src/pages/log/index.astro`

**Intent**: Make the page findable.

**Contract**: A secondary link "Sky checks" next to the log's add button.

#### 3. e2e

**Files**: `tests/e2e/sky-checks.spec.ts` (new), `tests/e2e/helpers.ts`, `.github/workflows/ci.yml`

**Intent**: Cover the card, the answer and the tally end to end.

**Contract**:
- Credentials (plan review F4): the Playwright process has no Supabase credentials today. The CI e2e step sets only `BASE_URL`, and `playwright.config.ts` loads no env.
  - The CI e2e step sources the same `supabase.env` the `test:db` step uses, and exports `SUPABASE_URL="$API_URL"` and `SUPABASE_KEY="$ANON_KEY"`.
  - Locally, the e2e recipe exports the same values from `npx supabase status -o env`.
  - The helper throws the `tests/db` missing-env message when they are absent.
- Seeding: `seedSkyCheck(credentials, { headline, night })` signs in with supabase-js as the spec's user, looks up its site, and calls `record_sky_verdict` with a past `dark_start`. The night is the Madrid date two days before today, which falls in the card's window whether or not civil dawn has passed.
- The spec:
  1. onboard in Madrid;
  2. seed a `go` night;
  3. on Tonight, the card shows "We said: Clear";
  4. answer "Partly clear", and the confirmation appears with no card;
  5. `/log/sky` shows "0 of 1 nights matched" and "1 too optimistic";
  6. change the answer to "Clear", and the page shows "1 of 1".

#### 4. Docs

**Files**: `CLAUDE.md`, `context/foundation/roadmap.md`

**Intent**: Record the new surface and its write-during-GET exception for the next agent.

**Contract**:
- `CLAUDE.md`, Project paragraph: `sky_checks`, the recording in the Tonight island via `defer`, and `/log/sky`.
- Roadmap S-07: a note on the delivered placement (Tonight card plus `/log/sky`, two-day window).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check and lint pass: `npx astro check && npm run lint`
- DB tests pass: `npm run test:db`
- The new e2e spec and the existing suite pass against a local preview on local Supabase: `BASE_URL=http://localhost:4321 npm run test:e2e`

#### Manual Verification:

- `/log/sky` with a mix of answered, unanswered and too-optimistic/pessimistic rows reads correctly; tally numbers match the rows (screenshots EN/PL, dark/light/red, phone/desktop)
- Empty state and paging links render; the log links to the page

---

## Testing Strategy

### Unit Tests:

- `claim.ts`: every headline id, all 9 outcomes, tally sums, ignored non-checkable rows.
- `recordableVerdict`: no view, a no-darkness night, a normal night.
- Night date helper: subtracting across a month boundary.
- Schema: the accepted actions and `from` values, and rejection of others.
- `format`/`build`: `headline.id` and `darkStart`.

### Integration Tests:

- `npm run test:db`:
  - the isolation suite with the new table;
  - the overwrite rule before and after dark;
  - the frozen answer;
  - another user's site;
  - outliving a site, including two deleted sites sharing a night;
  - the tally scope.
- e2e `sky-checks.spec.ts` covers the seeded night → card → answer → tally → changed answer.

### Manual Testing Steps:

1. Open Tonight locally, then check the `sky_checks` row; reload, and there is still one row.
2. Seed nights 1, 2 and 3 days back. Only the newest unanswered one within two days shows. Skip it, and the next one shows.
3. Answer from the card and from the page, and change an answer on the page. Check the tally after each step.
4. Take screenshots of the card and the page in EN/PL, dark/light/red, at phone and desktop widths.

## Performance Considerations

Tonight gains two calls:
- The recording runs after the response via `waitUntil`, so it adds no render time.
- The open-checks read is a fifth entry in `loadTonight`'s existing `Promise.all` (plan review F2). It is narrowed by `night >= UTC today − 3`, so it adds no sequential round trip.

## Migration Notes

The migration is additive (a new table and functions) and is pushed by CI's `migrate` job before the deploy. Old code ignores it. No backfill: recording starts with the first Tonight view after deploy.

## References

- Research: `context/changes/verdict-check/research.md`
- Roadmap: `context/foundation/roadmap.md` › S-07
- Table template: `supabase/migrations/20260926200000_observations.sql`
- RPC template: `supabase/migrations/20260926120000_complete_onboarding.sql`
- Route template: `src/pages/api/log/index.ts:14-37`
- Prior framing: `context/archive/2026-10-02-moonlight-and-the-verdict/frame.md:48`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data layer and tally

#### Automated

- [x] 1.1 Migration applies on local Supabase: `npx supabase db reset` succeeds
- [x] 1.2 Types regenerated with no drift: `npm run db:types && git diff --exit-code src/lib/database.types.ts` after commit
- [x] 1.3 Isolation and sky-check DB tests pass: `npm run test:db`
- [x] 1.4 Claim and tally unit tests pass: `npm test`
- [x] 1.5 Type check and lint pass: `npx astro check && npm run lint`

### Phase 2: Record the shown verdict on Tonight

#### Automated

- [ ] 2.1 `recordableVerdict` unit tests pass (no view, no-darkness night, normal night): `npm test`
- [ ] 2.2 `format`/`build` tests updated for `headline.id` and `darkStart` pass: `npm test`
- [ ] 2.3 Type check and lint pass: `npx astro check && npm run lint`
- [ ] 2.4 Existing Tonight e2e specs still pass against a local preview

#### Manual

- [ ] 2.5 After opening Tonight locally as a signed-in user, `sky_checks` holds one row for (user, Home, tonight's date) with headline `go`; a reload keeps one row (checked with a local SQL query)

### Phase 3: Answer on Tonight

#### Automated

- [ ] 3.1 Schema and date-helper unit tests pass, and the i18n parity test passes: `npm test`
- [ ] 3.2 Type check and lint pass: `npx astro check && npm run lint`
- [ ] 3.3 Smoke passes against a local preview on local Supabase: `npm run smoke`

#### Manual

- [ ] 3.4 With a seeded row for two nights ago, Tonight shows the card below the Sky and Moon cards; answering returns to Tonight with the confirmation and no card; Skip does the same without an answer (screenshots EN/PL, dark/light/red, phone/desktop)
- [ ] 3.5 A night three or more days back, an answered night, a skipped night and a `noForecast` night produce no card

### Phase 4: Sky checks page and tally

#### Automated

- [ ] 4.1 Unit tests pass: `npm test`
- [ ] 4.2 Type check and lint pass: `npx astro check && npm run lint`
- [ ] 4.3 DB tests pass: `npm run test:db`
- [ ] 4.4 The new e2e spec and the existing suite pass against a local preview on local Supabase: `BASE_URL=http://localhost:4321 npm run test:e2e`

#### Manual

- [ ] 4.5 `/log/sky` with a mix of answered, unanswered and too-optimistic/pessimistic rows reads correctly; tally numbers match the rows (screenshots EN/PL, dark/light/red, phone/desktop)
- [ ] 4.6 Empty state and paging links render; the log links to the page
