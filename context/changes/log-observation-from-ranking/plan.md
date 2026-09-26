# Log an Observation from the Ranking Implementation Plan

## Overview

Roadmap slice S-06 (GitHub #11; PRD US-04, FR-016, FR-018, Business Logic invariant 4). From a ranked object on `/tonight`, a signed-in user opens a "Mark observed" form with the observing night, site and telescope already filled in. They confirm or change those and pick a 1-5 rating, and the entry is saved to a new per-user `observations` table. On later rankings, an object with an entry rated 3 or above is moved down gently (candidate log penalty 0.15, Open Question 6). An object with only 1-2 ratings is never moved. A logged object that still ranks carries the tag "Seen N times – last [date]".

## Current State Analysis

- The ranking is pure and deterministic. `rankObjects` (`src/lib/engine/ranking.ts:137`) scores the whole catalogue, sorts by `score.total` (ties by Messier number), keeps objects with `total ≥ MIN_OBJECT_SCORE` (0.45), and lists the first `MAX_RANKED_OBJECTS` (5). `clearedCount` counts every object that cleared the bar. A flat penalty already exists as a model: `LOW_INTEREST_PENALTY` (`src/lib/engine/score.ts:136`, `parameters.ts`). Tunable numbers live in `src/lib/engine/parameters.ts`, never hardcoded elsewhere.
- `buildTonight` (`src/lib/tonight/build.ts:170`) puts the view model together from gear, forecast and `now`. It already knows the night's evening date (`date`), the site and the telescope, but the view does not expose their ids.
- `/tonight` is a server island. `src/pages/tonight.astro` renders the shell and `TonightContent.astro` (`server:defer`) loads data. The island loads sites, telescopes and eyepieces in parallel through `load()`, so a failed list only hides what depends on it. S-02 uses the oldest site and the oldest telescope (the S-08 selector does not exist yet).
- Every existing write follows one pattern. A page (`src/pages/gear/telescopes/new.astro`) hosts a React form (`src/components/gear/TelescopeForm.tsx`, `client:load`) that validates with a shared zod schema (`src/lib/gear/schemas.ts`). It posts as plain HTML to a route (`src/pages/api/gear/telescopes/index.ts`), which redirects back with `?error=<message key>` or on to the next page on success. All DB calls live in a store (`src/lib/gear/store.ts`), which returns fixed, value-free keys and never logs.
- Per-user tables: migration with RLS and per-operation policies for `authenticated` (`supabase/migrations/20260924120000_sites_and_gear.sql`), plus a `TABLES` entry in `tests/db/isolation.test.ts`. `src/lib/database.types.ts` is generated (`npm run db:types`), and CI fails on drift.
- Gated paths are listed in `PROTECTED_ROUTES` (`src/middleware.ts:5`).
- Copy comes from `src/i18n/messages/en.ts` and `pl.ts`, with key parity tested. Tonight dates and numbers are formatted by `createFormatter(locale)` (`src/lib/tonight/format.ts`).
- `tests/e2e/onboarding.spec.ts:67` already takes a new user through onboarding (Madrid, all-clear forecast fixture) to a ranked Tonight, so an end-to-end log test can start from there.
- `observingNightDateFor(instant, timeZone)` (`src/lib/engine/night.ts:112`) gives the evening date of the night that contains an instant (local noon to noon), which is the unit FR-016 logs.

## Desired End State

- Each ranked card on `/tonight` has a "Mark observed" link to `/log/new`, with the object, the ranking's night, site and telescope in the query string.
- `/log/new` shows a form titled with the object ("Log M13 · Hercules Cluster"). It has an observing-night date input, site and telescope selects over the user's own gear, and a required 1-5 rating. The night, site and telescope are prefilled and editable, and the rating starts empty. Saving creates one `observations` row and redirects to `/tonight?logged=13`, where the shell shows "M13 logged." A validation or store failure goes back to the form with `?error=<key>`.
- On the next ranking, any object with at least one entry rated 3+ on or before the ranked night is ordered by `total − LOG_PENALTY`. Whether it clears the bar, and the cleared count, still use the unpenalised `total`. An object with only 1-2 entries ranks exactly as before. A listed object with 3+ entries shows "Seen N times – last 12 Sep 2026" (N and the date come from the 3+ entries only), in English and Polish.
- If the log fails to load, Tonight still renders an unpenalised ranking plus a notice that logged objects are not being moved down right now.
- No user can read, change or point an entry at another user's data, and this is shown by `npm run test:db`. An entry survives the deletion of its site or telescope: the id becomes null and the name snapshot stays.

Verify by: unit tests (engine, schema, view model), `npm run test:db`, the new Playwright spec, and the manual checks per phase.

### Key Discoveries:

- `rankObjects` sorts and applies the bar in one pass (`ranking.ts:152-155`). The penalty has to split those two steps: bar on `total`, order on the penalised score.
- `reasonComponents` (`ranking.ts:113`) works on the listed entries' components, so the reason lines need no change. The penalty affects position only.
- `Astro.url` inside a server island is the island's own request, not the page URL. So `?logged=` has to be read in `src/pages/tonight.astro` (the shell) and rendered there, not in `TonightContent.astro`.
- A foreign key check runs without RLS, so a bare `references sites(id)` would let user B store user A's site id. The insert and update policies must also require that the referenced site and telescope belong to the caller.
- The `/log` prefix in `PROTECTED_ROUTES` uses prefix matching. No current route starts with `/log`: auth lives under `/auth/`, so there is no `/login` to catch by accident.

## What We're NOT Doing

- Viewing, editing and deleting log entries, and a log page (FR-017, S-07).
- Manual entry for any Messier object outside the ranking (FR-022, S-07, cut-order #2). `/log/new` only accepts a valid Messier number, but it is only linked from ranked cards.
- The UI for reading entries whose gear was deleted (FR-021, S-07). This slice only lays out the schema for it: nullable FKs with `on delete set null`, plus name snapshots.
- A telescope selector on Tonight (S-08). The ranking keeps using the oldest site and telescope. The log form lets the user pick any of theirs.
- Calibrating the penalty size. 0.15 stays a candidate (Open Question 6).
- Objects outside the Messier catalogue, notes or free text on an entry, photos.
- A penalty that stacks per entry or depends on how recent the entry is. It is one flat penalty per object.

## Implementation Approach

We build bottom-up, following the order this repo uses for database changes: storage (migration, schema, store, isolation test), then the pure engine rule with fixture tests, then the write path (form page and route), then the read path on Tonight (load log, tag, link, notice) with an end-to-end test. Each phase can be tested on its own. Phases 1-2 have no UI, phase 3 can be reached by URL, and phase 4 wires everything together.

Decisions from planning (user, 2026-09-26): the form is a separate page, not inline or a modal. "Seen N" counts only entries rated 3-5. The penalty changes order only, never whether an object clears the bar.

Delegated decisions (the agent chose them under the user's standing "minimal questions, UI decisions only" rule):

- There is one flat `LOG_PENALTY` per object with any qualifying entry, not one per entry. The PRD says "mildly", and stacking would bury revisited favourites.
- Entries from every site and telescope count. "Seen" is about the object, not the kit.
- Entries count when their night is on or before the ranked night, so the object moves down as soon as the user returns to Tonight after logging. Later nights are ignored, which keeps a future planner (S-05) consistent.
- Server validation rejects a night after the chosen site's current observing night (in that site's time zone).
- A log that fails to load degrades to an unpenalised ranking with a notice, never an error page. This follows the existing `load()` pattern.
- The rating uses five radio buttons with captions at both ends and no default, so it is always a conscious choice.
- The site and telescope names are snapshotted onto the row when it is created, so S-07 can show entries whose gear is gone without another migration.

## Critical Implementation Details

- **Server-island URL**: read `logged` from `Astro.url.searchParams` in `src/pages/tonight.astro`. Accept only an integer 1-110, ignore anything else, and render the notice in the shell above `<TonightContent server:defer>`. Inside the island, `Astro.url` is the island request and the param is not there.
- **Ownership of referenced gear**: the store reads the chosen site and telescope through `siteStore.get` / `telescopeStore.get` (RLS-scoped) before inserting. That proves ownership and supplies the name snapshots and the site's time zone for the "night not in the future" check. The RLS `with check` repeats the ownership rule so that a direct PostgREST insert cannot get around it.
- **URLs stay value-safe**: redirects carry only the Messier number, gear uuids, an ISO date and a fixed `errors.*` key. They never carry coordinates or free text, and nothing is logged.

## Phase 1: Observation log storage

### Overview

A new per-user `observations` table with RLS, generated types, a zod input schema and a store, all shown to be isolated per user outside the UI.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_observations.sql`

**Intent**: Create the log table and its per-operation RLS policies, including the guard that referenced gear belongs to the caller. The migration only adds things, so it is safe to push before the app deploys.

**Contract**: `public.observations(id uuid pk default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, messier smallint not null check (messier between 1 and 110), night date not null, rating smallint not null check (rating between 1 and 5), site_id uuid null references public.sites(id) on delete set null, telescope_id uuid null references public.telescopes(id) on delete set null, site_name text not null check (char_length(trim(site_name)) between 1 and 60), telescope_name text not null check (… between 1 and 60), created_at timestamptz not null default now())`. Index on `user_id`. Policies `observations_{select,insert,update,delete}_own` for `authenticated`. Insert and update `with check` add `(site_id is null or exists (select 1 from public.sites s where s.id = site_id and s.user_id = (select auth.uid())))`, and the same for `telescope_id`.

#### 2. Generated types

**File**: `src/lib/database.types.ts`

**Intent**: Regenerate with `npm run db:types` against local Supabase once the migration is applied. Never edit by hand.

**Contract**: `Tables<"observations">` becomes available.

#### 3. Input schema

**File**: `src/lib/observations/schemas.ts` (new, island-safe)

**Intent**: One definition of valid log input, shared by the form and the route. Every message is a message key.

**Contract**: `observationInputSchema` over FormData strings gives `{ messier: int 1..110, night: ISO YYYY-MM-DD that is a real calendar date, rating: int 1..5, siteId: uuid, telescopeId: uuid }`. Errors use new keys under `errors.observation.*` (e.g. `ratingRequired`, `nightInvalid`, `siteRequired`, `telescopeRequired`). The "not in the future" rule needs the site's time zone, so the store enforces it, not the schema.

#### 4. Store

**File**: `src/lib/observations/store.ts` (new)

**Intent**: Every DB call for the log, following the gear store's rules: fixed value-free keys, errors never forwarded, no logging.

**Contract**:
- `observationStore.create(client, input, now: Date): Promise<WriteResult>` reads the site and telescope via the gear store. A missing one → `errors.observation.gearNotFound`. `input.night > observingNightDateFor(now, site.timeZone)` → `errors.observation.nightInFuture`. Otherwise it inserts with the name snapshots, and a DB failure → `errors.save.observation`.
- `observationStore.listForRanking(client): Promise<LogEntry[]>` selects `messier, night, rating`. It throws `Error("errors.load.observations")` on failure.
- `LogEntry` is the engine type. Phase 1 creates `src/lib/engine/log.ts` containing only the `LogEntry` type (the store imports it); Phase 2 adds `SeenSummary` and `seenSummaries` there.

#### 5. Isolation and FK behaviour tests

**File**: `tests/db/isolation.test.ts`

**Intent**: Cover the new table in the cross-user suite, and prove that the referenced-gear guard and `on delete set null` work.

**Contract**: An `observations` case in `TABLES` whose static `valid` row has `site_id` and `telescope_id` null plus name snapshots (both columns are nullable, so the harness needs no change). Separate tests, which create their own gear: user B cannot insert an entry pointing at user A's site or telescope, and after A deletes its site the entry survives with `site_id` null and `site_name` unchanged.

#### 6. Copy keys

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Add the new error and load keys to both catalogues. The parity test enforces that they match.

**Contract**: `errors.observation.*`, `errors.save.observation`, `errors.load.observations`.

### Success Criteria:

#### Automated Verification:

- Migration applies to a fresh local stack: `npx supabase db reset`
- Generated types are in sync with the migration: `npm run db:types` produces no diff
- Schema unit tests pass (valid input, rating 0/6, bad date, missing site/telescope): `npm test`
- Isolation suite passes, including cross-user reads and writes, the foreign-gear reference rejection and the site-deletion survival: `npm run test:db`
- Type check and lint pass: `npx astro check && npm run lint`

**Implementation Note**: Phase 1 has no manual checks and no UI. Continue to Phase 2 once automated verification passes.

---

## Phase 2: Log penalty in the ranking engine

### Overview

A pure rule turns the log into per-object "seen" summaries, and `rankObjects` orders by the penalised score while the bar still uses the unpenalised one.

### Changes Required:

#### 1. Parameters

**File**: `src/lib/engine/parameters.ts`

**Intent**: Name the candidate values next to the other tunables.

**Contract**: `LOG_PENALTY = 0.15` (Candidate, PRD Open Question 6) and `LOG_PENALTY_MIN_RATING = 3` (PRD invariant 4: entries rated below it never move an object down), each with a doc comment in the file's existing style.

#### 2. Log summaries

**File**: `src/lib/engine/log.ts` (new), exported from the `src/lib/engine/index.ts` barrel

**Intent**: A pure reduction of log entries into what the ranking and the tag need.

**Contract**: `interface LogEntry { messier: number; night: string /* YYYY-MM-DD */; rating: number }`, `interface SeenSummary { count: number; lastNight: string }`, `seenSummaries(entries: readonly LogEntry[], onOrBefore: string): ReadonlyMap<number, SeenSummary>`. It considers only entries with `rating ≥ LOG_PENALTY_MIN_RATING` and `night ≤ onOrBefore`. `count` is the number of **distinct nights** among those entries, so a resubmitted or duplicate row never inflates "Seen N times" (plan review F1). `lastNight` is the latest such night, and objects with no qualifying entry are left out. Duplicate rows are allowed in the table; S-07 lets the user delete them. It must pass `purity.test.ts`.

#### 3. Ranking

**File**: `src/lib/engine/ranking.ts`

**Intent**: Apply the penalty to ordering only, and carry the summary through to the listed entry.

**Contract**: `RankInput.seen?: ReadonlyMap<number, SeenSummary>` (absent means an empty log). `RankedEntry` gains `seen: SeenSummary | null` and `rankScore: number` (`score.total − LOG_PENALTY` when seen, otherwise `score.total`). The bar filter and `clearedCount` use `score.total`. Among cleared objects the order is `rankScore` descending, with ties on Messier number ascending. `reasonComponents` is unchanged.

#### 4. Tests

**File**: `src/lib/engine/log.test.ts` (new), `src/lib/engine/ranking.test.ts`, `src/lib/engine/determinism.test.ts`

**Intent**: Pin the rule with fixture logs.

**Contract**: log tests cover ratings 1-2 being ignored, the 3+ count and latest night, two qualifying entries on the same night counting once, nights after `onOrBefore` being ignored, and an empty log. Ranking tests:
- a seen object moves below an unseen one whose total is within 0.15 of it, but stays above one more than 0.15 lower;
- a 1-2-only log leaves the ranking identical to an empty log (invariant 4);
- a seen object whose `total − 0.15 < 0.45 ≤ total` still clears and is still counted;
- `seen` is carried on the entry.

Determinism: identical inputs with a non-empty log give an identical ranking.

### Success Criteria:

#### Automated Verification:

- Engine unit tests pass, including the new log and ranking cases: `npm test`
- Purity guard still passes (no clock, env or I/O in `log.ts`): `npm test -- purity`
- Determinism test passes with a non-empty log: `npm test -- determinism`
- Type check and lint pass: `npx astro check && npm run lint`

**Implementation Note**: Phase 2 has no manual checks. Continue to Phase 3 once automated verification passes.

---

## Phase 3: Mark-observed form and route

### Overview

A gated `/log/new` page with a prefilled React form, and a `POST /api/log` route that saves the entry and returns to Tonight.

### Changes Required:

#### 1. Protected routes

**File**: `src/middleware.ts`

**Intent**: Gate the new page and route.

**Contract**: add `"/log"` and `"/api/log"` to `PROTECTED_ROUTES`.

#### 2. Page

**File**: `src/pages/log/new.astro` (new)

**Intent**: Resolve the prefill from the query string and render the form inside `GearShell`. Without Supabase it shows `DatabaseMissing`, like the gear pages.

**Contract**: query `object` (Messier number, required: missing or invalid renders a "not found" message with a link back to Tonight), `night` (ISO date, default the current observing night of the chosen site), `site` and `telescope` (uuids, falling back to the oldest when they are missing or not the user's), and `error` (message key). The page loads the user's sites and telescopes and passes `maxNight` as the latest current observing night across all of the user's sites, because the site select can change and the server check against the chosen site stays the authority (plan review F3). The title reads `Log M13 · <localised common name>`. The back link goes to `/tonight`.

#### 3. Form island

**File**: `src/components/observations/ObservationForm.tsx` (new)

**Intent**: Plain HTML POST form with client-side validation from `observationInputSchema`, following `TelescopeForm.tsx`.

**Contract**: props `{ action, messier, initial: { night, siteId, telescopeId }, sites: {id,name}[], telescopes: {id,name}[], maxNight, serverError, locale }`. Fields: hidden `messier`; `night` as `<input type="date" max={maxNight}>`; `siteId` and `telescopeId` selects; `rating` as a radio group of 1-5, required with no default, with captions for 1 ("Couldn't make it out") and 5 ("Superb"). It uses `FormField`, `ServerError` and `SubmitButton`, and colours come only from theme tokens.

#### 4. Route

**File**: `src/pages/api/log/index.ts` (new)

**Intent**: Parse, save and redirect, in the gear routes' error-response shape.

**Contract**: `POST` → `observationInputSchema.safeParse(formData)`. On failure, redirect to `/log/new?object=<n>&site=<id>&telescope=<id>&night=<date>&error=<key>`, carrying back only the values that parsed as valid. Then `observationStore.create(supabase, data, new Date())`. On failure, the same redirect with the store key. On success, `/tonight?logged=<messier>`. No Supabase → `NOT_CONFIGURED`.

#### 5. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Form copy in both languages.

**Contract**: a `log.*` group: title (param `{ object }`), night, site, telescope, rating, rating captions, submit, back, object-not-found.

#### 6. Tests

**File**: `src/lib/observations/redirect.ts` (new), `src/lib/observations/redirect.test.ts` (new)

**Intent**: Keep the route thin and prove that its redirect URL can only carry value-safe parameters.

**Contract**: `formRedirect(raw: Record<string, unknown>, error: MessageKey): string` returns `/log/new?…&error=<key>`, keeping `object`, `site`, `telescope` and `night` only when each on its own parses as a valid Messier number, uuid or ISO date. Tests: valid values are kept, a malformed value (free text, out-of-range number) is dropped, and the error key is always present.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- i18n parity test passes with the new `log.*` and error keys: `npm test -- i18n`
- No hardcoded colours in the new components: `npm test -- no-hardcoded-colors`
- Type check, lint and build pass: `npx astro check && npm run lint && npm run build`

#### Manual Verification:

- Against local Supabase, `/log/new?object=13&night=<tonight>&site=<id>&telescope=<id>` shows "Log M13 · …" with the night, site and telescope prefilled and no rating selected
- Submitting without a rating shows the rating error on the client, and a night in the future is rejected with a translated message
- A valid save lands on `/tonight?logged=13` and a row appears in `observations` with the site and telescope names snapshotted
- The form reads correctly in Polish and in the light theme, and works at phone width

**Implementation Note**: After automated verification passes, pause for the human to confirm the manual checks before Phase 4.

---

## Phase 4: Tonight shows and feeds the log

### Overview

Tonight loads the log, passes seen summaries into the ranking, tags logged objects, links each card to the form, and confirms a save.

### Changes Required:

#### 1. View model

**File**: `src/lib/tonight/build.ts`, `src/lib/tonight/format.ts`

**Intent**: Feed the log into the ranking and word the tag.

**Contract**: `TonightInput.log?: readonly LogEntry[]` (absent means empty). `buildTonight` calls `seenSummaries(log, date)` and passes `seen` to `rankObjects`. `TonightView` gains `siteId` and `telescopeId`, and `TonightEntry` gains `seenText: string | null`. The formatter gains `seenLine({ count, lastNight })` → "Seen 1 time – last 12 Sep 2026" / "Seen 3 times – last …", with Polish plurals through `plural()` and the date as a locale-aware calendar date with no time-zone shift.

#### 2. Island data

**File**: `src/components/tonight/TonightContent.astro`

**Intent**: Load the log in parallel with gear. A failure degrades to an empty log plus a notice.

**Contract**: `load(() => observationStore.listForRanking(supabase), "tonight.logFailed")` joins the existing `Promise.all`, and `log` is passed to `buildTonight`. When the load failed, render `ServerError` with `tonight.logFailed` above the ranking.

#### 3. Card

**File**: `src/components/tonight/ObjectCard.astro`

**Intent**: Show the tag and the entry point to the form.

**Contract**: new props `logHref` (built in `TonightContent` from `view.date`, `view.siteId`, `view.telescopeId` and `entry.messier`). When `entry.seenText` is set, it renders as a small muted pill in the card header. A "Mark observed" link sits at the foot of the card, styled with theme tokens only.

#### 4. Saved notice

**File**: `src/pages/tonight.astro`

**Intent**: Confirm a save after the redirect (see Critical Implementation Details: this must happen in the shell).

**Contract**: `?logged=<1..110>` renders a notice "M13 logged." (`tonight.logged`, param `{ object }`) above the island. Any other value is ignored.

#### 5. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Contract**: `tonight.object.markObserved`, `tonight.object.seen` (plural forms + `{ count, date }`), `tonight.logged`, `tonight.logFailed`.

#### 6. Tests

**File**: `src/lib/tonight/build.test.ts`, `src/lib/tonight/format.test.ts`, `tests/e2e/observation-log.spec.ts` (new)

**Intent**: Cover the view model and the whole loop in a browser.

**Contract**:
- `build.test.ts`: `seenText` is set only for objects with 3+ entries, a 1-2-only log gives no tags and no reordering, and the ids are exposed.
- `format.test.ts`: `seenLine` in en and pl, singular and plural.
- e2e: sign up and onboard (reusing the onboarding spec's helpers), open Tonight, click "Mark observed" on the first card, see the prefilled form, pick rating 4, save. Then assert the "logged" notice and that the logged object either has left the top 5 or its card, wherever it now sits, carries the "Seen 1 time" tag (the e2e clock is real time, so the ranking varies by date). The e2e spec deliberately does not assert position, which depends on the fixture's score gaps; ordering is pinned by the Phase 2 unit tests.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new build and format cases: `npm test`
- Type check, lint and build pass: `npx astro check && npm run lint && npm run build`
- New Playwright spec passes against local Supabase and the forecast fixture: `npm run test:e2e -- observation-log`
- Existing e2e and smoke checks still pass: `npm run test:e2e && npm run smoke`

Prerequisites for 4.3 and 4.4 (plan review F4), as in CI's smoke job: local Supabase running (`npx supabase start`), the forecast fixture server from `tests/e2e/forecast-fixture.mjs`, a build served with `npm run build && npm run preview` (with `.dev.vars` pointing at local Supabase and the fixture), and `BASE_URL` set.

#### Manual Verification:

- On a real Tonight with a ranking, "Mark observed" on a card opens the form prefilled with tonight's night, the current site and the current telescope
- After saving with rating 4, Tonight shows "M… logged." and the object has moved down (or out of the top 5) with a "Seen 1 time – last …" tag where it still shows
- Logging another object with rating 2 shows the notice but leaves its position and tags unchanged
- Tag, link and notice read well in Polish and in the light theme, and at phone width

**Implementation Note**: After automated verification passes, pause for the human to confirm the manual checks. Then `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- `seenSummaries`: rating threshold, the night cutoff, count and latest night, empty input.
- `rankObjects`: order-only penalty, bar and cleared count unaffected, invariant 4, and `seen` carried through. Determinism with a non-empty log.
- `observationInputSchema`: ranges, date validity, required fields.
- `buildTonight` / `seenLine`: tag presence and wording, en and pl, plurals.

### Integration Tests:

- `npm run test:db`: cross-user isolation on `observations`, the foreign-gear reference rejection, and entry survival with a null FK after its site is deleted.
- Playwright `observation-log.spec.ts`: onboarding → Tonight → Mark observed → save → notice and tag.

### Manual Testing Steps:

1. Onboard a fresh local user, open Tonight, note the top 5.
2. Mark #1 observed, keep the prefilled values, rate 4, save. Confirm the notice, the new position and the tag.
3. Mark another object with rating 2. Confirm no reordering and no tag.
4. Try a future night on the form. Confirm the translated error.
5. Repeat in Polish and in the light theme, at phone width.

## Performance Considerations

The log query returns three small columns per entry, and even a heavy user has at most a few hundred rows. It runs in parallel with the gear loads, so Tonight's ~2 s budget is unaffected. `seenSummaries` is linear, and the extra sort key adds nothing measurable to the under-1 s ranking.

## Migration Notes

The migration only adds a table, so it is safe for CI's `migrate` job to apply before the app deploys. Nothing needs backfilling. Local `.env` and `.dev.vars` point at hosted Supabase, which gets the table only after merge, so test against local Supabase.

## References

- Roadmap slice: `context/foundation/roadmap.md` → S-06
- PRD: US-04, FR-016, FR-017, FR-018, FR-021, Business Logic invariant 4, Open Question 6 (`context/foundation/prd.md`)
- Ranking: `src/lib/engine/ranking.ts:137`; penalty pattern: `src/lib/engine/score.ts:136`
- Form pattern: `src/pages/gear/telescopes/new.astro`, `src/components/gear/TelescopeForm.tsx`, `src/pages/api/gear/telescopes/index.ts`
- Store pattern: `src/lib/gear/store.ts`; RLS pattern: `supabase/migrations/20260924120000_sites_and_gear.sql`
- Isolation suite: `tests/db/isolation.test.ts`; e2e onboarding: `tests/e2e/onboarding.spec.ts:67`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Observation log storage

#### Automated

- [x] 1.1 Migration applies to a fresh local stack: `npx supabase db reset` — 389dfe6
- [x] 1.2 Generated types are in sync with the migration: `npm run db:types` produces no diff — 389dfe6
- [x] 1.3 Schema unit tests pass (valid input, rating 0/6, bad date, missing site/telescope): `npm test` — 389dfe6
- [x] 1.4 Isolation suite passes, including cross-user reads and writes, the foreign-gear reference rejection and the site-deletion survival: `npm run test:db` — 389dfe6
- [x] 1.5 Type check and lint pass: `npx astro check && npm run lint` — 389dfe6

### Phase 2: Log penalty in the ranking engine

#### Automated

- [x] 2.1 Engine unit tests pass, including the new log and ranking cases: `npm test` — d23c525
- [x] 2.2 Purity guard still passes (no clock, env or I/O in `log.ts`): `npm test -- purity` — d23c525
- [x] 2.3 Determinism test passes with a non-empty log: `npm test -- determinism` — d23c525
- [x] 2.4 Type check and lint pass: `npx astro check && npm run lint` — d23c525

### Phase 3: Mark-observed form and route

#### Automated

- [x] 3.1 Unit tests pass: `npm test` — 430e0b6
- [x] 3.2 i18n parity test passes with the new `log.*` and error keys: `npm test -- i18n` — 430e0b6
- [x] 3.3 No hardcoded colours in the new components: `npm test -- no-hardcoded-colors` — 430e0b6
- [x] 3.4 Type check, lint and build pass: `npx astro check && npm run lint && npm run build` — 430e0b6

#### Manual

- [x] 3.5 Against local Supabase, `/log/new?object=13&night=<tonight>&site=<id>&telescope=<id>` shows "Log M13 · …" with the night, site and telescope prefilled and no rating selected
- [x] 3.6 Submitting without a rating shows the rating error on the client, and a night in the future is rejected with a translated message
- [x] 3.7 A valid save lands on `/tonight?logged=13` and a row appears in `observations` with the site and telescope names snapshotted
- [x] 3.8 The form reads correctly in Polish and in the light theme, and works at phone width

### Phase 4: Tonight shows and feeds the log

#### Automated

- [x] 4.1 Unit tests pass, including the new build and format cases: `npm test` — 52cbc87
- [x] 4.2 Type check, lint and build pass: `npx astro check && npm run lint && npm run build` — 52cbc87
- [x] 4.3 New Playwright spec passes against local Supabase and the forecast fixture: `npm run test:e2e -- observation-log` — 52cbc87
- [x] 4.4 Existing e2e and smoke checks still pass: `npm run test:e2e && npm run smoke` — 52cbc87

#### Manual

- [x] 4.5 On a real Tonight with a ranking, "Mark observed" on a card opens the form prefilled with tonight's night, the current site and the current telescope
- [x] 4.6 After saving with rating 4, Tonight shows "M… logged." and the object has moved down (or out of the top 5) with a "Seen 1 time – last …" tag where it still shows
- [x] 4.7 Logging another object with rating 2 shows the notice but leaves its position and tags unchanged
- [x] 4.8 Tag, link and notice read well in Polish and in the light theme, and at phone width
