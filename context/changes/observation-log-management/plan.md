# Observation Log Management and Manual Entry Implementation Plan

## Overview

Roadmap slice S-07 (PRD FR-017, FR-022, FR-021; GitHub #12). S-06 made the observation log writable from the Tonight ranking only. This slice adds the log itself: a `/log` page listing entries grouped by observing night, editing and deleting an entry, adding an entry manually for any Messier object (FR-022, cut-order #2), and showing entries whose site or telescope has since been deleted (FR-021). Editing and deleting feed the ranking's deprioritisation honestly because Tonight reads the log live on every load.

## Current State Analysis

- `public.observations` (`supabase/migrations/20260926200000_observations.sql`) already has everything S-07 needs: per-operation RLS including `update` and `delete`, insert/update policies that require any referenced site and telescope to be the caller's, nullable `site_id` / `telescope_id` with `on delete set null`, and `site_name` / `telescope_name` snapshots. **No migration is needed.**
- `observationStore` (`src/lib/observations/store.ts`) has only `create` and `listForRanking`. The gear stores show the patterns for `get` (invalid uuid → `null`), `update`/`remove` with `.select("id")` and the `affected()` helper mapping zero rows to a "not found" key (`src/lib/gear/store.ts:75-88`, `:173-185`).
- `/log/new` (`src/pages/log/new.astro`) + `ObservationForm` island + `POST /api/log` implement the ranking entry point: the object is fixed by `?object=`, success returns to `/tonight?logged=<n>`, failures return through `formRedirect` (`src/lib/observations/redirect.ts`) carrying only values that parse on their own.
- Gear edit pages (`src/pages/gear/sites/[id].astro`) show the edit + delete pattern: prefilled form island, a `DeleteButton` island (native `confirm`) posting to `/api/gear/<entity>/[id]/delete`, a 404 "not found" card.
- The ranking reads `listForRanking` (rated ≥ 3, newest night first) on every Tonight load, so an edited or deleted entry changes the penalty and the "Seen N times" tag at the next load with no cache to invalidate.
- `PROTECTED_ROUTES` (`src/middleware.ts:5-14`) lists `"/log/"` with a trailing slash and matches by `startsWith`, so a new `/log` list page would **not** be gated.
- Topbar (`src/components/Topbar.astro`) links only Tonight and My gear.
- Lessons (`context/foundation/lessons.md`): new modules touching site records must sit under the `no-console` globs (all S-07 files land in already-covered `src/lib/observations/**`, `src/pages/log/**`, `src/pages/api/log/**`); every per-user list read must be narrowed and deterministically ordered, paginating if it can approach `max_rows` (1000).

## Desired End State

- A signed-in user opens **Log** from the top bar and sees their entries grouped by observing night, newest first, 50 entries per page with Newer/Older links. Each entry shows the Messier id and localised common name, the rating (five dots with a screen-reader "Rated 4 of 5"), and "site · telescope"; a site or telescope deleted since reads "Cabin (deleted)".
- **Add entry** opens `/log/new?from=log`: a searchable object picker (type `31`, `m31` or `andro`/`mgławica`), night, site, telescope and rating; saving returns to `/log?saved=<n>` with a confirmation.
- Each entry links to `/log/<id>`: the same form prefilled (object editable, rating preset), with Delete (confirm) at the bottom. Saving returns to `/log?updated=<n>`, deleting to `/log?deleted=<n>`.
- An entry whose site or telescope was deleted can still be edited: the select offers "Cabin (deleted)" as the kept value, or the user picks a current one.
- Tonight reflects edits and deletions at the next load: deleting the only 3+ entry of an object removes its penalty and tag; changing a rating from 4 to 2 does too.
- `/log` and `/log/<id>` redirect a signed-out visitor to sign-in. All copy exists in EN and PL; all colours are theme tokens.

### Key Discoveries:

- RLS update policy accepts `site_id is null`, so keeping a deleted site on edit needs no policy change (`supabase/migrations/20260926200000_observations.sql:48-58`); the store must stop a live reference being nulled.
- Night validity depends on the site's time zone: `observationStore.create` compares against `tonightDateForSite(site, now)` (`src/lib/observations/store.ts:43-46`); an entry kept on a deleted site has no time zone, so edit needs a fallback bound.
- `Astro.url` inside a server island is not the page URL (S-06 finding): read notices (`?saved=`, …) in the page, as `src/pages/tonight.astro:15-18` does.
- The island must not import the catalogue JSON or server modules; the page passes picker options (`{ messier, id, label, names }`) as props, like it already passes gear as `{ id, name }` (`src/pages/log/new.astro:95-97`).

## What We're NOT Doing

- No schema change or migration; no change to the penalty rule, `LOG_PENALTY`, or the "Seen N times" wording.
- No non-Messier objects, notes, photos, or filters/search on the log list; no sorting options beyond newest night first.
- No bulk delete, undo, or duplicate merging (duplicates are deleted one by one).
- Renaming a site or telescope does not rewrite existing entries: an entry shows the name snapshot taken when it was last saved (journal semantics); saving an edit re-snapshots the chosen live gear.
- No link from Tonight's "Seen N times" tag to the log; the Tonight "Mark observed" flow stays as S-06 built it (it still returns to Tonight).
- No inline delete on list rows (delete lives on the edit page).
- No post-login "continue to the requested page" (S-09).

## Implementation Approach

Bottom-up, reusing S-06's form and route shapes. Phase 1 extends the store and schemas and proves them against local Supabase. Phase 2 ships the read-only `/log` page, navigation and route protection, so the list is usable (and FR-021 visible) before any new write path. Phase 3 adds the object picker and manual entry on the existing `/log/new`. Phase 4 adds edit and delete and closes with an end-to-end spec over the whole loop. The Tonight side needs no code change; tests pin that edits and deletions reach the ranking input.

## Critical Implementation Details

- **Night bound for a kept deleted site**: the store cannot use the site's time zone, so the latest allowed night is the latest `tonightDateForSite` over the user's current sites, or, when they have none, today's calendar date at UTC+14 (`Etc/GMT-14`, the latest date anywhere on Earth). Only for this case; a live site keeps its own bound.
- **Keeping a deleted reference**: the update input uses an empty `siteId` / `telescopeId` to mean "keep the deleted one". The store accepts it only when the stored row's id is already `null` (otherwise `errors.observation.siteRequired` / `telescopeRequired`), and then leaves that name snapshot untouched.
- **Return target**: `/log/new` serves two entry points. A hidden `from=log` field (fixed enum, carried by `formRedirect` on failure) is what switches the success redirect to `/log?saved=<n>` and keeps the manual (picker) mode after a failed save; without it the S-06 behaviour is unchanged.

## Phase 1: Log store and schemas

### Overview

Everything the pages need from the data layer: list (paginated), get, update and delete, plus the update schema and redirect support, verified against local Supabase.

### Changes Required:

#### 1. Observation store

**File**: `src/lib/observations/store.ts`

**Intent**: Add the reads and writes FR-017 needs, keeping the module's privacy rules (fixed message keys, no DB text, no logging).

**Contract**:
- `ObservationRecord { id, messier, night, rating, siteId: string | null, telescopeId: string | null, siteName, telescopeName, createdAt }`.
- `list(client, { page }) → Promise<{ entries: ObservationRecord[]; hasOlder: boolean }>`: order `night desc, created_at desc, id asc`, page size `LOG_PAGE_SIZE = 50`, reads `range(offset, offset + 50)` (51 rows) to derive `hasOlder`; throws `errors.load.observations`.
- `get(client, id) → Promise<ObservationRecord | null>`: invalid uuid (`22P02`) → `null`, like `siteStore.get`.
- `update(client, id, input: ObservationUpdateInput, now) → Promise<WriteResult>`: reads the entry and the chosen live gear through RLS; kept-deleted rule and night bound as in Critical Implementation Details; snapshots names of chosen live gear; zero rows affected → `errors.notFound.observation`.
- `remove(client, id) → Promise<{ ok: true; messier: number } | { ok: false; message: MessageKey }>` via `.delete().eq("id", id).select("messier")`; zero rows → `errors.notFound.observation`, other errors → `errors.delete.observation`.
- A small pure helper `latestNightBound(sites, now)` (exported for tests) implementing the kept-deleted-site bound.

#### 2. Schemas

**File**: `src/lib/observations/schemas.ts`

**Intent**: Edit accepts "keep the deleted site/telescope"; creation keeps requiring live gear.

**Contract**: `observationUpdateSchema` = `observationInputSchema` with `siteId` / `telescopeId` as `uuid | null` (empty string → `null`); `ObservationUpdateInput`. `observationInputSchema` unchanged. A `returnTargetSchema = z.enum(["log"]).optional()` for the `from` field.

#### 3. Redirect helpers

**File**: `src/lib/observations/redirect.ts`

**Intent**: Carry `from=log` back on a failed manual save; build edit-page failure URLs and `/log` notice URLs from fixed pieces only.

**Contract**: `formRedirect(raw, error)` also carries `from` when it parses with `returnTargetSchema`; `editRedirect(id, error)` → `/log/<encoded id>?error=<key>`; `logNotice(kind: "saved" | "updated" | "deleted", messier)` → `/log?<kind>=<n>`; `parseLogPage(param) → number` (positive integer, anything else → 1).

#### 4. Message keys

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Error keys the store returns.

**Contract**: `errors.notFound.observation`, `errors.delete.observation` (EN + PL, parity test green).

#### 5. Tests

**Files**: `src/lib/observations/schemas.test.ts`, `src/lib/observations/redirect.test.ts`, `src/lib/observations/store.test.ts` (new, pure helper only), `tests/db/observations.test.ts`

**Intent**: Pin the new rules outside the UI.

**Contract**: unit — update schema maps empty gear ids to `null` and still rejects junk; `formRedirect` carries `from=log` and drops other `from` values; `parseLogPage` edge cases; `latestNightBound` with several sites and with none. DB — own entry updates (rating, object, night, gear with re-snapshot); another user's entry is `notFound` for update and delete; keeping a deleted site works only when `site_id` is already null; update rejects a future night for a live site and uses the fallback bound for a kept deleted one; after `remove`, and after a 4 → 2 rating change, the entry is gone from `listForRanking`; `list` orders by night/created_at and reports `hasOlder` with 51 entries.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- DB suite passes against local Supabase: `npm run test:db`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`

---

## Phase 2: Log page, navigation and protection

### Overview

The read-only log: `/log` grouped by night with pagination, notices and the deleted-gear label; a Log nav link; `/log` behind sign-in.

### Changes Required:

#### 1. Route protection

**File**: `src/lib/protected-routes.ts` (new), `src/middleware.ts`

**Intent**: Gate `/log` itself without the prefix-match trap (`"/log"` via `startsWith` would also match an unrelated `/login`).

**Contract**: `isProtectedPath(pathname): boolean` — true when the path equals a listed route or starts with `route + "/"`; the list replaces `"/log/"` with `"/log"`. Middleware calls it. Unit test `src/lib/protected-routes.test.ts` covers `/log`, `/log/new`, `/log/<id>`, `/api/log`, `/api/log/<id>/delete`, `/gear/sites/new`, `/login` (false), `/` (false).

#### 2. Log list page

**File**: `src/pages/log/index.astro` (new)

**Intent**: Show the user's entries grouped by observing night (newest first), each with object id + localised common name, rating, and "site · telescope" with "(deleted)" when the id is null; empty state; Newer/Older links; notices for `?saved=`, `?updated=`, `?deleted=` (Messier number validated, read in the page). A load failure shows `errors.load.observations`, never an error page.

**Contract**: uses `observationStore.list`, `createFormatter(locale).formatNightDate` for night headings, `localCommonName` for names, `GearShell` layout, theme tokens only. Header has an **Add entry** link to `/log/new?from=log`; each entry links to `/log/<id>`. Grouping is consecutive entries with the same `night` on the current page (a night split across pages repeats its heading on the next page).

#### 3. Navigation

**File**: `src/components/Topbar.astro`

**Intent**: A **Log** link between Tonight and My gear, marked current on `/log` and below.

**Contract**: `navState("/log")`; new key `nav.log`.

#### 4. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: List-page copy.

**Contract**: under `log.list`: title, intro, add, empty state (text + links to Tonight and Add entry), `rated({ rating })` for the screen reader, `deleted({ name })`, newer/older, `saved/updated/deleted({ object })` notices; `nav.log`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including `protected-routes.test.ts` and the i18n parity test: `npm test`
- No hardcoded colours: `npm test -- src/styles/no-hardcoded-colors.test.ts`
- Type check and lint pass: `npx astro check && npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Signed out, `/log` redirects to sign-in
- With S-06 entries on local Supabase, `/log` groups them by night in EN and PL, light and dark theme, and on a phone-width viewport
- After deleting the telescope an entry used (via `/gear`), the entry still shows with "(deleted)"

---

## Phase 3: Manual entry with object picker

### Overview

FR-022: add an entry for any Messier object from the log, through a searchable picker.

### Changes Required:

#### 1. Search helper

**File**: `src/lib/observations/messier-search.ts` (new, island-safe)

**Intent**: Match a query against picker options by number or name, tolerant of case and Polish diacritics.

**Contract**: `MessierOption { messier: number; id: string; label: string; names: string[] }`; `filterMessier(options, query): MessierOption[]` — empty query → all in catalogue order; `31`, `m31`, `M 31` → M31 first (exact number match ranks above prefix matches such as M3); name substring over localised and English names after lower-casing, NFD accent stripping and `ł → l`. Unit tests in `messier-search.test.ts`.

#### 2. Picker island component

**File**: `src/components/observations/MessierPicker.tsx` (new)

**Intent**: An accessible combobox: text input with `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; a listbox of filtered options; ArrowUp/Down, Enter to choose, Escape to close; choosing fills the input with the label and a hidden `messier` input with the number. Error state and styling match `FormField`.

**Contract**: props `{ options: MessierOption[]; initial?: number; error?: string; onChange(messier: number | null) }`; renders `<input type="hidden" name="messier">`.

#### 3. Form modes

**File**: `src/components/observations/ObservationForm.tsx`

**Intent**: One form for three entry points: `ranking` (fixed object, as today), `manual` (picker, hidden `from=log`), and `edit` (Phase 4). Client validation keeps using the shared schema and adds the object field error.

**Contract**: new props `mode: "ranking" | "manual" | "edit"`, `messierOptions?: MessierOption[]`, `initial.messier?`, `initial.rating?`; `messier` becomes state in manual/edit modes.

#### 4. `/log/new` manual mode and route

**Files**: `src/pages/log/new.astro`, `src/pages/api/log/index.ts`

**Intent**: With `from=log` the page renders the manual form (title "Add an observation", back link to the log, picker prefilled from a valid `?object=`), builds picker options from `MESSIER` + `localCommonName`, and keeps the gear/needs-gear states. The route redirects a successful manual save to `logNotice("saved", n)`; the ranking flow still returns to `/tonight?logged=<n>`.

**Contract**: `from` read with `returnTargetSchema`; the object-not-found state applies only in ranking mode.

#### 5. Copy

**Contract**: `log.manualTitle`, `log.manualIntro`, `log.backToLog`, `log.picker.{label, placeholder, noMatch}` in EN + PL; `errors.observation.objectInvalid` reused for a missing object.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including `messier-search.test.ts` and `redirect.test.ts`: `npm test`
- Type check, lint and build pass: `npx astro check && npm run lint && npm run build`

#### Manual Verification:

- From `/log`, Add entry → type `31` → choose M31 → save lands on `/log` with "M31 logged." and the entry under its night
- Typing `mglawica` in PL finds "Mgławica …" objects; keyboard-only selection works; a screen reader announces the options
- A failed save (e.g. no rating via disabled JS) returns to the manual form with the picker still shown and prefilled
- Mark observed from Tonight still returns to Tonight

---

## Phase 4: Edit and delete

### Overview

FR-017 edit and delete, including entries whose gear was deleted (FR-021), and an end-to-end spec over the whole log loop.

### Changes Required:

#### 1. Edit page

**File**: `src/pages/log/[id].astro` (new)

**Intent**: Load the entry and the user's gear; render `ObservationForm` in `edit` mode (object editable via picker, rating preset, night, site, telescope) and a `DeleteButton` with a confirm message naming the object. When the entry's site or telescope was deleted, the matching select gets a first option "<snapshot name> (deleted)" with an empty value, selected. Not found → 404 card linking back to the log; load failure → `ServerError`.

**Contract**: form posts to `/api/log/<id>`; delete posts to `/api/log/<id>/delete`; `maxNight` as on `/log/new`; `?error=` passed as `serverError`.

#### 2. Form edit mode

**File**: `src/components/observations/ObservationForm.tsx`

**Intent**: `edit` mode validates with `observationUpdateSchema` and supports the "(deleted)" gear options.

**Contract**: props `deletedSite?: string`, `deletedTelescope?: string` (snapshot names; present only when the id is null).

#### 3. Update and delete routes

**Files**: `src/pages/api/log/[id].ts` (new), `src/pages/api/log/[id]/delete.ts` (new)

**Intent**: Validate with `observationUpdateSchema`, call `observationStore.update(…, new Date())` / `remove`, redirect to `logNotice("updated" | "deleted", n)` on success; on failure the update route goes to `editRedirect(id, key)` and the delete route to `/log?error=<key>`. Nothing is logged; no form value reaches a URL.

**Contract**: same shape as `src/pages/api/gear/sites/[id].ts` and `.../delete.ts`.

#### 4. Copy

**Contract**: `log.editTitle({ object })`, `log.delete`, `log.confirmDelete({ object })`, `log.notFound`, `log.notFoundText`, `log.deletedGear({ name })` in EN + PL.

#### 5. End-to-end spec

**File**: `tests/e2e/observation-log-management.spec.ts` (new)

**Intent**: One user journey on the CI preview setup (`onboardInMadrid`): add M31 manually from `/log` → appears under its night → edit its rating → "updated" notice and new rating shown → add a telescope, then delete the one the entry used → entry reads "(deleted)" and its edit page saves with the kept value → delete the entry with confirm accepted → "deleted" notice and empty state. Positions in the Tonight ranking are not asserted (real clock).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- DB suite passes: `npm run test:db`
- Type check, lint and build pass: `npx astro check && npm run lint && npm run build`
- E2E passes against a local preview on local Supabase: `BASE_URL=http://localhost:4321 npm run test:e2e`
- CI green on the PR (ci, smoke, e2e jobs)

#### Manual Verification:

- Editing an entry's rating from 4 to 2 removes the object's "Seen" tag on Tonight at the next load; deleting its only 3+ entry does too
- An entry whose site was deleted opens, shows "(deleted)" and saves; switching it to a live site re-snapshots the name
- Delete asks for confirmation and cancelling keeps the entry
- EN + PL, light and dark, phone width look right on `/log/<id>`

---

## Testing Strategy

### Unit Tests:

- Schemas: update schema's empty → `null` gear ids; unchanged create schema.
- Redirects: `from` carrying, `editRedirect`, `logNotice`, `parseLogPage`.
- `latestNightBound`, `filterMessier` (numbers, prefixes, diacritics, ranking of exact matches), `isProtectedPath`.
- i18n parity and no-hardcoded-colours suites stay green.

### Integration Tests:

- `tests/db/observations.test.ts`: update/delete ownership, kept-deleted-gear rule, night bounds, re-snapshotting, pagination and ordering, and that edits/deletes change `listForRanking`.
- `tests/e2e/observation-log-management.spec.ts`: the add → list → edit → orphan → delete journey.

### Manual Testing Steps:

1. Sign out and open `/log` and `/log/<id>`: both go to sign-in.
2. Add entries manually and from Tonight; check grouping, notices and pagination (seed 51+ rows locally).
3. Delete a site and a telescope used by entries; confirm the entries still read and edit.
4. Change a rating to 2 and delete an entry; confirm the Tonight tag and order react on reload.

## Performance Considerations

The list reads at most 51 rows per page with the existing `observations_user_id_idx`; ordering by night per user is cheap at the log sizes a beginner produces. No change to Tonight's queries.

## Migration Notes

None: the S-06 schema already supports every operation. Hosted Supabase needs no `migrate` run for this slice.

## References

- Roadmap: `context/foundation/roadmap.md` (S-07)
- PRD: `context/foundation/prd.md` (FR-017, FR-021, FR-022, cut order #2)
- S-06 plan: `context/archive/2026-09-26-log-observation-from-ranking/plan.md`
- Store patterns: `src/lib/gear/store.ts:75-88`, `:144-185`
- Edit page pattern: `src/pages/gear/sites/[id].astro`
- Route patterns: `src/pages/api/gear/sites/[id].ts`, `src/pages/api/gear/sites/[id]/delete.ts`
- Existing log flow: `src/pages/log/new.astro`, `src/pages/api/log/index.ts`, `src/lib/observations/redirect.ts`
- Lessons: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Log store and schemas

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — ac96823
- [x] 1.2 DB suite passes against local Supabase: `npm run test:db` — ac96823
- [x] 1.3 Type check passes: `npx astro check` — ac96823
- [x] 1.4 Lint passes: `npm run lint` — ac96823

### Phase 2: Log page, navigation and protection

#### Automated

- [x] 2.1 Unit tests pass, including `protected-routes.test.ts` and the i18n parity test: `npm test`
- [x] 2.2 No hardcoded colours: `npm test -- src/styles/no-hardcoded-colors.test.ts`
- [x] 2.3 Type check and lint pass: `npx astro check && npm run lint`
- [x] 2.4 Build succeeds: `npm run build`

#### Manual

- [x] 2.5 Signed out, `/log` redirects to sign-in
- [x] 2.6 With S-06 entries on local Supabase, `/log` groups them by night in EN and PL, light and dark theme, and on a phone-width viewport
- [x] 2.7 After deleting the telescope an entry used (via `/gear`), the entry still shows with "(deleted)"

### Phase 3: Manual entry with object picker

#### Automated

- [ ] 3.1 Unit tests pass, including `messier-search.test.ts` and `redirect.test.ts`: `npm test`
- [ ] 3.2 Type check, lint and build pass: `npx astro check && npm run lint && npm run build`

#### Manual

- [ ] 3.3 From `/log`, Add entry → type `31` → choose M31 → save lands on `/log` with "M31 logged." and the entry under its night
- [ ] 3.4 Typing `mglawica` in PL finds "Mgławica …" objects; keyboard-only selection works; a screen reader announces the options
- [ ] 3.5 A failed save (e.g. no rating via disabled JS) returns to the manual form with the picker still shown and prefilled
- [ ] 3.6 Mark observed from Tonight still returns to Tonight

### Phase 4: Edit and delete

#### Automated

- [ ] 4.1 Unit tests pass: `npm test`
- [ ] 4.2 DB suite passes: `npm run test:db`
- [ ] 4.3 Type check, lint and build pass: `npx astro check && npm run lint && npm run build`
- [ ] 4.4 E2E passes against a local preview on local Supabase: `BASE_URL=http://localhost:4321 npm run test:e2e`
- [ ] 4.5 CI green on the PR (ci, smoke, e2e jobs)

#### Manual

- [ ] 4.6 Editing an entry's rating from 4 to 2 removes the object's "Seen" tag on Tonight at the next load; deleting its only 3+ entry does too
- [ ] 4.7 An entry whose site was deleted opens, shows "(deleted)" and saves; switching it to a live site re-snapshots the name
- [ ] 4.8 Delete asks for confirmation and cancelling keeps the entry
- [ ] 4.9 EN + PL, light and dark, phone width look right on `/log/<id>`
