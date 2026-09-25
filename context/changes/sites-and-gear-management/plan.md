# Sites and Gear Management Implementation Plan

## Overview

Give each signed-in user private observing sites, telescopes and eyepieces, the inputs every later slice (S-02 Tonight, S-03 onboarding, S-05 planner, S-08 selector) runs against. This is where the first per-user tables appear, so it also lands the PRD's isolation NFR as a test that exercises the database boundary outside the UI, and the pipeline that carries migrations to the hosted Supabase project.

## Current State Analysis

- **No schema at all.** `supabase/` holds only `config.toml` and `.gitignore`; there is no `migrations/` directory, no generated types, and `config.toml:60-65` points `[db.seed]` at a `./seed.sql` that does not exist.
- **No DB access path in pages.** `src/middleware.ts:7-16` builds a Supabase SSR client per request but only stores `locals.user`; `src/env.d.ts` types nothing else. `createClient()` (`src/lib/supabase.ts:5-7`) returns `null` when env is unset, and every caller must handle that.
- **Forms** are native HTML POSTs; React islands (`client:load`) add hand-rolled client validation (`src/components/auth/SignInForm.tsx:18-30`). Routes redirect back with `?error=<message>` and never return JSON (CLAUDE.md tripwire). Field values are not preserved across a server error. Reusable primitives: `FormField`, `ServerError`, `SubmitButton` in `src/components/auth/`. Only `button` exists in `src/components/ui/`; no validation library is installed.
- **Tests**: `npm test` (Vitest, `vitest.config.ts` includes `src/**/*.test.ts`, node env) is DB-free. The only CI place with a live Supabase is the `smoke` job (`.github/workflows/ci.yml:28-56`), which runs `supabase start` (so it applies `supabase/migrations/` automatically) and `scripts/smoke.mjs` against a preview build.
- **Deploys are manual** (`npx wrangler deploy`, `context/deployment/deploy-plan.md:17`); CI has no deploy job (that is F-02). Hosted Supabase project ref `kzdovsrpyxhfduusaqlu` (`deploy-plan.md:113`); nothing documents applying migrations to it.
- **Engine contract**: `Site` in `src/lib/engine/types.ts:7-14` needs `latitudeDeg`, `longitudeDeg`, optional `elevationM`, and an IANA `timeZone` the engine never looks up itself. Bortle feeds `darknessThresholdDegForBortle` (`src/lib/engine/parameters.ts:14`); minimum altitude feeds `bestWindow(track, minAltitudeDeg)` (`src/lib/engine/objects.ts:76`). No default-minimum-altitude constant exists yet (PRD Open Question 8, candidate 15°).
- **Logging guard**: `no-console` is `warn` repo-wide (`eslint.config.js:25`); no API route logs today.

## Desired End State

A signed-in user opens **My gear** (`/gear`) from the top bar and sees three sections, Sites, Telescopes and Eyepieces, each listing their own records with an add link and an empty state. They can create, edit and delete each record on dedicated pages. Site coordinates are stored rounded to 0.01°, and each site carries an IANA time zone that is derived from its coordinates unless the user pinned one. `npm run test:db` proves against a real local Supabase that user B can neither read, insert as, update nor delete user A's rows in any of the three tables, and that anonymous clients see nothing. CI runs that suite on every PR, and on every push to `main` applies new migrations to the hosted project after `ci` and `smoke` pass.

Verify: `npm test`, `npm run test:db` (with `npx supabase start`), `npm run lint`, `npx astro check`, `npm run build`, `npm run smoke`, plus the manual walk-through in each phase.

### Key Discoveries:

- `supabase start` in the CI smoke job already applies migrations, so the isolation suite and a types-drift check slot into that job (`ci.yml:40-43`) without new infrastructure.
- `vitest.config.ts` includes `src/**/*.test.ts`; putting the DB suite under `tests/db/` with its own config keeps `npm test` DB-free without an exclude list.
- `@photostructure/tz-lookup` 11.7 (maintained, zero deps, ~88 KB, single offline file) works in the Worker; `geo-tz` reads ~74 MB of data files from disk and cannot.
- Zod 4.6 is current; one schema serves the island (live errors) and the route (source of truth).
- The engine already treats an unknown IANA zone as an error via `Intl.DateTimeFormat` (`src/lib/engine/night.ts`), so the same constructor is the server-side zone validator.

## What We're NOT Doing

- Browser geolocation, place-name search, the plain-language Bortle onboarding picker and gear presets (S-03, FR-004 to FR-006).
- Site elevation: not stored; the engine's `elevationM` defaults to 0.
- Telescope selector and Tonight empty states (S-08, FR-019, FR-021 Tonight half); log entries and their survival after gear deletion (S-06/S-07). No foreign keys to gear exist yet, so deletes are unconditional.
- CI app deployment (F-02). Only the migration push is automated here; `npx wrangler deploy` stays manual.
- Preserving form field values across a server-error redirect (coordinates must never enter a URL); shared client/server schemas make that path rare.
- `updated_at` columns and triggers; renaming `project_id` in `supabase/config.toml`.
- A shadcn select/dialog: native `<select>` and `confirm()` are enough.

## Implementation Approach

Prove the risky boundary first: schema, RLS and the isolation suite land and run in CI before any UI exists (Phase 1). Then build the pure gear domain (validation, rounding, timezone, data access) with unit tests (Phase 2). The UI comes last, sites first (Phase 3) because they carry the unusual fields, then telescopes and eyepieces by the same pattern (Phase 4). Every write goes through a native form POST to an `/api/gear/...` route that validates with the shared zod schema, calls the store, and redirects to `/gear` or back to the form with `?error=`.

## Critical Implementation Details

- **Isolation assertions need a positive control.** Under RLS a cross-user `update`/`delete` returns no error and affects zero rows, and a cross-user `select` returns an empty array. A test that only asserts "B got nothing" also passes when A got nothing (for example a table that rejects everyone). Each case must first prove that A can read and modify its own row, then that B's attempt changed nothing (re-read as A).
- **Coordinates never leave through errors.** Postgres constraint errors can echo row values in `details`. Routes must map every store error to a fixed, value-free message before building `?error=`, and zod messages must be static strings, not interpolations of input.
- **Island import boundary.** `schemas.ts` and everything under `src/components/gear/` run in the browser, so they import only zod, `zones.ts`, `coordinates.ts`, `eyepiece-presets.ts` and `@/lib/engine/parameters`: never the engine barrel (astronomy-engine) and never `timezone.ts` (tz-lookup).
- **Migration order vs manual deploys.** The `migrate` job pushes on merge, while the app deploy is still manual and may lag. That order is safe only while migrations are additive; this change's migration is additive, and the deploy-plan note must say so.

## Phase 1: Schema, isolation test and migration pipeline

### Overview

Create the three user-owned tables with per-operation RLS, generate DB types, expose a typed client on `locals`, prove isolation with a DB-level suite in CI, and automate `supabase db push` to the hosted project after CI passes on `main`.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_sites_and_gear.sql`

**Intent**: The first per-user tables, owned by `auth.users`, with ranges enforced in the database as well as in the app.

**Contract**: Three tables in `public`, each with `id uuid primary key default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, `name text not null check (char_length(trim(name)) between 1 and 60)`, `created_at timestamptz not null default now()`, and an index on `user_id`.
- `sites`: `latitude_deg numeric(4,2) not null check (between -90 and 90)`, `longitude_deg numeric(5,2) not null check (between -180 and 180)`, `bortle smallint not null check (between 1 and 9)`, `min_altitude_deg smallint not null default 15 check (between 0 and 60)`, `time_zone text not null`, `time_zone_source text not null check (in ('auto','manual'))`.
- `telescopes`: `aperture_mm numeric(6,1) not null check (between 20 and 1000)`, `focal_length_mm numeric(6,1) not null check (between 100 and 5000)`.
- `eyepieces`: `focal_length_mm numeric(4,1) not null check (between 2 and 60)`, `afov_deg smallint not null check (between 30 and 120)`.
- RLS enabled on all three; four policies per table (`select`, `insert`, `update`, `delete`) `to authenticated` with `using`/`with check` `((select auth.uid()) = user_id)`. No policy grants `anon` anything.

#### 2. Seed file

**File**: `supabase/seed.sql`

**Intent**: `config.toml` already references it; an empty, commented file stops `supabase db reset` from complaining.

**Contract**: Comment-only file stating that there is no seed data yet.

#### 3. Generated types and script

**Files**: `src/lib/database.types.ts`, `package.json`

**Intent**: Typed table access for the store and pages.

**Contract**: Script `"db:types": "supabase gen types typescript --local > src/lib/database.types.ts && prettier --write src/lib/database.types.ts"`. The generated file is committed and never hand-edited (add it to the CLAUDE.md tripwire list in Phase 4).

#### 4. Typed client on locals

**Files**: `src/lib/supabase.ts`, `src/middleware.ts`, `src/env.d.ts`

**Intent**: One per-request client for DB queries in pages and routes, instead of each caller building its own.

**Contract**: `createClient` becomes `createServerClient<Database>(…)` and exports a `TypedSupabaseClient` type. Middleware sets `context.locals.supabase` (the same instance it uses for `getUser`, or `null` when unconfigured). `App.Locals` gains `supabase: TypedSupabaseClient | null`. The existing auth routes keep working unchanged.

#### 5. Isolation suite

**Files**: `tests/db/isolation.test.ts`, `vitest.db.config.ts`, `package.json`

**Intent**: The PRD NFR "no user can read or modify another user's data, verified by a test that exercises the boundary outside the user interface", checked through the same PostgREST + RLS path the app uses.

**Contract**:
- Script `"test:db": "vitest run --config vitest.db.config.ts"`; the config includes `tests/db/**/*.test.ts`, node env, and the `@/*` alias.
- Reads `SUPABASE_URL` and `SUPABASE_KEY` (anon/publishable key) from `process.env` and **fails** with a clear message when they are missing (never skips).
- Signs up two fresh users (unique emails per run; confirmations are off locally) with separate `@supabase/supabase-js` clients typed with `Database`.
- For each of `sites`, `telescopes` and `eyepieces`, via `describe.each`:
  - A inserts a valid row and can select, update and delete its own rows (positive control).
  - B's `select` by A's row id returns `[]`.
  - B's `update` by A's id leaves the row unchanged when A re-reads it.
  - B's `delete` by A's id leaves A's row present.
  - B's `insert` with `user_id` set to A's id is rejected.
  - An anonymous client's `select` returns no rows.
- The suite is designed to be extended by every later per-user table.

#### 6. CI

**File**: `.github/workflows/ci.yml`

**Intent**: Run the isolation suite and a types-drift check on every PR, and push migrations to the hosted project only after everything passes on `main`.

**Contract**:
- `smoke` job, after "Start local Supabase":
  - Add a step running `npm run test:db` with `SUPABASE_URL`/`SUPABASE_KEY` taken from `supabase.env`.
  - Add a step running `npm run db:types && git diff --exit-code src/lib/database.types.ts`.
- New job `migrate`:
  - Trigger and gate: `needs: [ci, smoke]`, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `concurrency: migrate`.
  - Steps: checkout, `supabase/setup-cli@v1`, `supabase link --project-ref kzdovsrpyxhfduusaqlu`, `supabase db push`.
  - Env: `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` from repository secrets.

#### 7. Deploy procedure

**File**: `context/deployment/deploy-plan.md`

**Intent**: Record how schema reaches production now that it exists.

**Contract**: A new "Database migrations" section covering:
- the two GitHub secrets and where to get them (Supabase account access token; the project's database password)
- the `migrate` job's gating
- the manual fallback (`npx supabase link --project-ref …` then `npx supabase db push`)
- the forward-only, additive-until-F-02 rule
- a dated execution-log line once the first push has run

### Success Criteria:

#### Automated Verification:

- `npx supabase start` (or `npx supabase db reset`) applies the migration without errors
- `npm run test:db` passes against local Supabase, with every table covering the positive control and all four cross-user operations plus anonymous select
- `npm run db:types` leaves `git status` clean for `src/lib/database.types.ts`
- `npm test`, `npm run lint`, `npx astro check` and `npm run build` pass
- `.github/workflows/ci.yml` contains the `test:db` step and the types-drift step in `smoke`, and a `migrate` job with `needs: [ci, smoke]` and the `main`-push condition

#### Manual Verification:

- User adds the `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` repository secrets on GitHub
- After merge to `main`, the `migrate` job succeeds and the hosted project's Table Editor shows `sites`, `telescopes` and `eyepieces` with RLS enabled
- Temporarily dropping one policy locally (for example `sites` select) makes `npm run test:db` fail, which confirms the suite can catch a missing policy; then restore it

**Implementation Note**: Manual 1.6 and 1.7 (GitHub secrets, first production `migrate` run) are satisfied when the change's PR merges to `main` and must be checked before `/10x-archive`, not before Phase 2 — Phases 2–4 need only local Supabase. Phase 1's gate is the automated rows plus 1.8. After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Gear domain: schemas, rounding, timezone and store

### Overview

Pure, unit-tested building blocks the UI phases call: what a valid site, telescope and eyepiece is, how coordinates are rounded, how a site's zone is resolved, and a thin data layer over the typed client.

### Changes Required:

#### 1. Candidate parameter

**File**: `src/lib/engine/parameters.ts`

**Intent**: Give the PRD's default minimum altitude its named home.

**Contract**: `export const DEFAULT_MIN_ALTITUDE_DEG = 15;` with the file's "Candidate (PRD Open Question 8)" comment convention. The migration's column default (15) and the site form's initial value must match it; a unit test asserts the form default equals the constant. Islands import it from `@/lib/engine/parameters` (a standalone file with no imports), never from the `@/lib/engine` barrel, which re-exports the astronomy-engine modules.

#### 2. Schemas

**File**: `src/lib/gear/schemas.ts` (+ `zod` dependency)

**Intent**: One definition of valid input, shared by the React forms and the API routes.

**Contract**: `siteInputSchema`, `telescopeInputSchema`, `eyepieceInputSchema`, each accepting FormData-shaped string input (`z.coerce`) and producing typed values with the same ranges as the migration's checks.
- Names are trimmed, 1–60 characters.
- Site: `latitudeDeg` and `longitudeDeg` are range-checked, then rounded with `roundCoordinate`. `bortle` is an integer 1–9. `minAltitudeDeg` is an integer 0–60. `timeZoneMode` is `'auto' | 'manual'`, and `timeZone` is required and must be valid (`isValidTimeZone`) only when the mode is manual.
- Eyepiece: `afovPreset` is `'plossl' | 'wide' | 'ultrawide' | 'other'`. `afovDeg` is required (integer 30–120) only for `'other'`; otherwise it resolves from the preset.
- Every message is a static English string that never contains input values. Also export the inferred output types.

#### 3. Rounding, zones and presets

**Files**: `src/lib/gear/coordinates.ts`, `src/lib/gear/zones.ts`, `src/lib/gear/timezone.ts`, `src/lib/gear/eyepiece-presets.ts` (+ `@photostructure/tz-lookup` dependency)

**Intent**: Isolate the three small rules the PRD and the decisions fix.

**Contract**:
- `roundCoordinate(deg: number): number`: rounds to 2 decimals (0.01° ≈ 1.1 km), normalising `-0` to `0`.
- `resolveTimeZone(input: { mode: 'auto' | 'manual'; timeZone?: string; latitudeDeg: number; longitudeDeg: number }): { timeZone: string; source: 'auto' | 'manual' }`: auto calls tz-lookup on the rounded coordinates; manual returns the given zone.
- `isValidTimeZone(tz: string): boolean` lives in `zones.ts` and uses only the `Intl.DateTimeFormat` constructor, so schemas and islands can import it. `timezone.ts` (the only tz-lookup importer) is server-only: routes and the store import it, while `schemas.ts` and islands never do.
- `EYEPIECE_PRESETS`: `plossl` "Plössl (~50°)" = 50, `wide` "Wide-field (~68°)" = 68, `ultrawide` "Ultra-wide (~82°)" = 82 (FR-009).
- `presetForAfov(afov)`: returns the matching preset key or `'other'`, so the edit form preselects correctly.

#### 4. Store

**File**: `src/lib/gear/store.ts`

**Intent**: Keep Supabase calls and error mapping in one place so pages and routes stay thin, and so no DB error text (which can echo coordinates) reaches a URL.

**Contract**: For each entity, `list(client)`, `get(client, id)` (returns `null` when not found or not visible), `create(client, input)`, `update(client, id, input)` and `remove(client, id)`, all over `TypedSupabaseClient`.
- Writes return `{ ok: true } | { ok: false; message: string }`, where `message` is a fixed, value-free string, and an update or delete that affects 0 rows reports "not found".
- The module maps between camelCase domain types and snake_case columns. For sites it also exports `toEngineSite(row): Site` so S-02 can hand a stored site to the engine.
- It never logs.

#### 5. Logging guard

**File**: `eslint.config.js`

**Intent**: Turn the coordinate-privacy NFR into a lint error on the code that handles coordinates.

**Contract**: A block for `src/lib/gear/**` and `src/pages/api/gear/**` setting `no-console: "error"`.

#### 6. Unit tests

**Files**: `src/lib/gear/schemas.test.ts`, `src/lib/gear/coordinates.test.ts`, `src/lib/gear/timezone.test.ts`, `src/lib/gear/eyepiece-presets.test.ts`

**Intent**: Pin the rules without a database.

**Contract**:
- Rounding: 52.2297 → 52.23, 21.0122 → 21.01, -0.004 → 0, and 90 and -180 stay in range.
- Site schema: accepts a Warsaw site; rejects latitude 90.5, Bortle 0 and 10, min altitude 61, an empty or 61-character name, and manual mode with a missing or invalid zone ("Mars/Olympus"). The error messages for rejected coordinates never contain the rejected value.
- Timezone: auto resolves Warsaw (52.23, 21.01) to `Europe/Warsaw` and Tromsø (69.65, 18.96) to `Europe/Oslo`; manual keeps the given zone even when the coordinates point elsewhere.
- Eyepiece schema: `wide` gives 68, `other` without `afovDeg` is rejected, and `other` with 100 is accepted.
- `presetForAfov(82)` returns `'ultrawide'` and `presetForAfov(60)` returns `'other'`.
- The form default equals `DEFAULT_MIN_ALTITUDE_DEG`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with the new gear tests green and the engine purity guard still passing (tz-lookup lives in `src/lib/gear/`, not `src/lib/engine/`)
- `npm run lint` passes, and `npx eslint --print-config src/lib/gear/store.ts | grep -A1 '"no-console"'` shows level 2 (error)
- `npx astro check` and `npm run build` pass, the build bundles tz-lookup, and `npx wrangler deploy --dry-run` reports an upload size within the Free plan limit (assumes the existing local `wrangler login`)

#### Manual Verification:

- User reads the schema ranges (aperture 20–1000 mm, telescope focal length 100–5000 mm, eyepiece focal length 2–60 mm, AFOV 30–120°, min altitude 0–60°) and confirms none of them excludes real beginner kit

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Sites UI

### Overview

The protected `/gear` hub with its Sites section, the new and edit site pages, and the create, update and delete routes, all following the native-POST + redirect pattern.

### Changes Required:

#### 1. Shared form primitives

**Files**: `src/components/forms/{FormField,ServerError,SubmitButton}.tsx` (moved from `src/components/auth/`), auth forms' imports

**Intent**: The auth primitives become the app's form kit instead of being imported across feature folders.

**Contract**: Move the files unchanged apart from these `FormField` changes: optional `min`, `max`, `step` and `inputMode` props passed through to the input, and `icon` made optional. Update the imports in `SignInForm`/`SignUpForm`; auth behaviour is unchanged.

#### 2. Navigation and protection

**Files**: `src/components/Topbar.astro`, `src/middleware.ts`

**Intent**: Make My gear reachable, and keep anonymous users out of its pages and routes.

**Contract**: For signed-in users the Topbar shows a "My gear" link to `/gear`. `PROTECTED_ROUTES` becomes `["/dashboard", "/gear", "/api/gear"]`.

#### 3. Hub page

**File**: `src/pages/gear/index.astro`

**Intent**: The one place a user sees everything the engine will run on.

**Contract**:
- Uses `Layout` + `Topbar` in the homepage's visual language (dark navy background, amber accents).
- The Sites section lists the name, coordinates (2 decimals), Bortle class, minimum altitude and time zone (marked "auto" or "pinned"), each linking to `/gear/sites/[id]`. It has an "Add site" link to `/gear/sites/new`, and an empty state when there are no sites.
- Shows a `?error=` banner via `ServerError`.
- If `locals.supabase` is `null`, renders the config-missing state instead of querying.
- Telescope and eyepiece sections are added in Phase 4.

#### 4. Site form island and pages

**Files**: `src/components/gear/SiteForm.tsx`, `src/pages/gear/sites/new.astro`, `src/pages/gear/sites/[id].astro`, `src/components/gear/DeleteButton.tsx`

**Intent**: Create and edit a site with live validation from the shared schema.

**Contract**: `SiteForm` props: `action` (URL), `initial?` (site values), `serverError?`. It is a native POST form with fields name, latitude, longitude (step 0.01, with a hint that coordinates are rounded to about 1 km), Bortle (native select 1–9 with short plain-language labels) and minimum altitude (default `DEFAULT_MIN_ALTITUDE_DEG`).
- The time zone select's first option is "Automatic (from coordinates)" (`timeZoneMode=auto`); the remaining options come from `Intl.supportedValuesOf('timeZone')` in the browser.
- The form validates with `siteInputSchema` on submit and blocks submission on errors, like the auth forms.
- `new.astro` renders an empty form posting to `/api/gear/sites`.
- Like the hub, `new.astro` and `[id].astro` render the config-missing state (no form, no store call) when `locals.supabase` is `null`.
- `[id].astro` loads the site via `store.get`. When it is `null` (not found or another user's), the page sets `Astro.response.status = 404` and renders an inline "Not found" state with a link back to `/gear` (there is no `src/pages/404.astro`). Otherwise it prefills the form (pinned zone selected; for automatic it shows "Automatic, currently <zone>"), and posts to `/api/gear/sites/[id]`.
- `DeleteButton` is a small island: a POST form to `…/delete` whose submit handler asks `confirm()` first.

#### 5. Routes

**Files**: `src/pages/api/gear/sites/index.ts` (POST create), `src/pages/api/gear/sites/[id].ts` (POST update), `src/pages/api/gear/sites/[id]/delete.ts` (POST delete)

**Intent**: Server-side source of truth for site writes.

**Contract**: Each route:
1. parses `formData` with `siteInputSchema`
2. resolves the zone with `resolveTimeZone`
3. calls the store
4. on success redirects to `/gear`; on failure redirects to the originating form (`/gear/sites/new` or `/gear/sites/[id]`) with `?error=<encoded fixed message>`

A missing `locals.supabase` redirects with a "database not configured" error. A delete that affects 0 rows redirects to `/gear?error=` "not found". No route logs anything, and no coordinate ever appears in a redirect URL.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, `npx astro check` and `npm run build` pass
- `npm run smoke` still passes with the moved form primitives (auth unchanged)
- `grep -rn "console\." src/pages/api/gear src/lib/gear` returns nothing

#### Manual Verification:

- Signed in on the dev server: "My gear" appears in the top bar and `/gear` shows the empty Sites state
- Create a site at 52.229676, 21.012229 with automatic zone: the hub shows 52.23, 21.01 and `Europe/Warsaw (auto)`
- Edit it to 69.65, 18.96 with the zone still automatic: the zone becomes `Europe/Oslo`. Then pin `Europe/Warsaw`, change the coordinates again, and confirm the pinned zone is kept
- Invalid latitude (95) is blocked in the form. Submitting it anyway (for example with devtools) returns to the form with an error, and the URL contains no coordinates
- Delete asks for confirmation and removes the site. Opening another user's site id (from a second account) shows 404
- Signed out, `/gear` and a POST to `/api/gear/sites` redirect to `/auth/signin`
- The pages are usable at 360 px width

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Telescopes and eyepieces UI

### Overview

The same pattern for the two gear entities, the remaining hub sections, a smoke-test extension, and doc updates.

### Changes Required:

#### 1. Telescope form, pages and routes

**Files**: `src/components/gear/TelescopeForm.tsx`, `src/pages/gear/telescopes/{new,[id]}.astro`, `src/pages/api/gear/telescopes/{index,[id]}.ts`, `src/pages/api/gear/telescopes/[id]/delete.ts`

**Intent**: FR-008 create, view, update and delete.

**Contract**: Fields name, aperture (mm) and focal length (mm), with a derived focal ratio shown read-only in the form (f/ = focal length ÷ aperture) as a sanity check. Routes, redirects, the inline 404, the config-missing state and error handling are identical to the site routes and pages.

#### 2. Eyepiece form, pages and routes

**Files**: `src/components/gear/EyepieceForm.tsx`, `src/pages/gear/eyepieces/{new,[id]}.astro`, `src/pages/api/gear/eyepieces/{index,[id]}.ts`, `src/pages/api/gear/eyepieces/[id]/delete.ts`

**Intent**: FR-009 create, view, update and delete, with the type picker instead of a bare AFOV number.

**Contract**: Fields name, focal length (mm, step 0.1) and an eyepiece type select from `EYEPIECE_PRESETS` plus "Other". Choosing "Other" reveals an AFOV (°) field. Only `afov_deg` is stored; the edit page preselects the type with `presetForAfov`. Eyepieces are not tied to a telescope. Pages and routes follow the site pattern, including the inline 404 and the config-missing state.

#### 3. Hub sections

**File**: `src/pages/gear/index.astro`

**Intent**: Complete the hub.

**Contract**:
- The Telescopes section lists the name, aperture, focal length and f/ratio.
- The Eyepieces section lists the name, focal length and AFOV with its type label.
- Each section has an add link and an empty state.
- On a phone the sections stack.

#### 4. Smoke extension

**File**: `scripts/smoke.mjs`

**Intent**: Keep one HTTP-level walk through the real app routes, complementing the DB-level isolation suite.

**Contract**: After the "signin accepts correct password" step, add these steps:
- "gear renders" (200)
- "create site redirects to gear" (POST `/api/gear/sites` with a valid form → 302 `/gear`)
- "invalid site returns to form with error" (latitude 95 → 302 `/gear/sites/new?error=`)
- "create telescope redirects to gear"
- "create eyepiece redirects to gear"

After signout, add "gear redirects after signout" (302 `/auth/signin`).

#### 5. Docs

**Files**: `CLAUDE.md`, `README.md` (its command list at lines 52-58)

**Intent**: Keep the agent guide accurate.

**Contract**:
- Commands: `npm run test:db` (needs `npx supabase start`) and `npm run db:types`.
- Tripwires: `src/lib/database.types.ts` is generated, never hand-edited; every new per-user table gets RLS plus a `describe.each` entry in `tests/db/isolation.test.ts`; coordinates never go into URLs or logs (lint-enforced under `src/lib/gear` and `src/pages/api/gear`); browser islands import engine constants from `@/lib/engine/parameters` (the one exception to the barrel rule) and never import `src/lib/gear/timezone.ts`.
- Architecture: `locals.supabase`, `src/lib/gear/` (schemas, store, timezone), and the `/gear` routes.
- Product-code summary: sites and gear exist.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run test:db`, `npm run lint`, `npx astro check` and `npm run build` pass
- `npm run smoke` passes against a local preview with local Supabase, including the new gear steps
- `CLAUDE.md` mentions `test:db`, `db:types` and the isolation-suite rule

#### Manual Verification:

- Create a 130 mm / 650 mm telescope: the hub shows f/5. Edit it and delete it
- Create eyepieces "25 mm Plössl" (Plössl), "10 mm" (Wide-field) and "6 mm" (Other, 100°): the hub shows AFOVs 50°, 68° and 100°, and editing the 100° one preselects "Other" with 100 filled in
- Delete every eyepiece and telescope: the hub shows their empty states and nothing errors
- The whole flow works at 360 px width and matches the homepage's look

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Coordinate rounding and `-0` normalisation; range edges.
- Site, telescope and eyepiece schemas: valid and invalid inputs, conditional fields (manual zone, AFOV "Other"), and static error messages that contain no input values.
- Zone resolution: auto for Warsaw and Tromsø, manual override kept.
- Preset lookup both ways; form default = `DEFAULT_MIN_ALTITUDE_DEG`.

### Integration Tests:

- `tests/db/isolation.test.ts`: two users and an anonymous client against local Supabase, all four operations per table, with positive controls. Runs in the CI smoke job.
- `scripts/smoke.mjs`: HTTP walk through the gear routes and the protected-route redirects.

### Manual Testing Steps:

1. Sign in, open My gear, add a Warsaw site with automatic zone, and check the rounding and `Europe/Warsaw`.
2. Move it to Tromsø (zone follows), pin Warsaw, move it again (zone stays pinned).
3. Add a telescope and three eyepieces covering all AFOV paths; edit and delete each.
4. From a second account, open the first account's site URL (404).
5. Repeat the key screens at 360 px.

## Performance Considerations

tz-lookup adds about 88 KB unpacked to the Worker bundle. The upload was 2.06 MiB (456 KiB gzip) at first deploy (`deploy-plan.md:106`), so the Free plan's 3 MiB compressed limit (https://developers.cloudflare.com/workers/platform/limits/) is not at risk; Phase 2 re-checks with `wrangler deploy --dry-run`. Lookup runs only on site writes. The hub makes three small indexed `select`s per render.

## Migration Notes

- New tables only; no existing data. Forward-only: rollback of app code leaves the tables in place, which is harmless (`infrastructure.md` risk register).
- First production application happens through the `migrate` job after merge. The user must have added `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` first; otherwise run the manual fallback from `deploy-plan.md`.
- Until F-02 automates deploys, merge (which migrates) precedes the manual `wrangler deploy`. That is safe only for additive migrations.

## References

- Roadmap item: `context/foundation/roadmap.md` → S-01 `sites-and-gear-management` (Unlocks S-02 with F-01; parallel with S-09)
- PRD: `context/foundation/prd.md` → FR-007, FR-008, FR-009, FR-021; NFRs per-user isolation and coordinate privacy; Open Question 8 (default minimum altitude)
- Engine contract: `src/lib/engine/types.ts:7-14` (`Site`), `src/lib/engine/parameters.ts:14`, `src/lib/engine/objects.ts:76`
- Patterns: `src/pages/api/auth/signin.ts` (POST + `?error=` redirect), `src/components/auth/SignInForm.tsx` (island validation), `.github/workflows/ci.yml` (smoke job with local Supabase)
- Deploy: `context/deployment/deploy-plan.md`, `context/foundation/infrastructure.md` (bundle limits, forward-only migrations)
- Libraries: zod 4.6 (https://zod.dev), `@photostructure/tz-lookup` 11.7 (https://github.com/photostructure/tz-lookup), Supabase CLI `db push` / `gen types` (https://supabase.com/docs/reference/cli)
- GitHub tracking: issue #4 on the "Sidereus Roadmap" board

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, isolation test and migration pipeline

#### Automated

- [x] 1.1 `npx supabase start` (or `npx supabase db reset`) applies the migration without errors — 0f17021
- [x] 1.2 `npm run test:db` passes against local Supabase, with every table covering the positive control and all four cross-user operations plus anonymous select — 0f17021
- [x] 1.3 `npm run db:types` leaves `git status` clean for `src/lib/database.types.ts` — 0f17021
- [x] 1.4 `npm test`, `npm run lint`, `npx astro check` and `npm run build` pass — 0f17021
- [x] 1.5 `.github/workflows/ci.yml` contains the `test:db` step and the types-drift step in `smoke`, and a `migrate` job with `needs: [ci, smoke]` and the `main`-push condition — 0f17021

#### Manual

- [ ] 1.6 User adds the `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` repository secrets on GitHub
- [ ] 1.7 After merge to `main`, the `migrate` job succeeds and the hosted project's Table Editor shows `sites`, `telescopes` and `eyepieces` with RLS enabled
- [x] 1.8 Temporarily dropping one policy locally (for example `sites` select) makes `npm run test:db` fail, which confirms the suite can catch a missing policy; then restore it — 0f17021

### Phase 2: Gear domain: schemas, rounding, timezone and store

#### Automated

- [x] 2.1 `npm test` passes with the new gear tests green and the engine purity guard still passing (tz-lookup lives in `src/lib/gear/`, not `src/lib/engine/`)
- [x] 2.2 `npm run lint` passes, and `npx eslint --print-config src/lib/gear/store.ts | grep -A1 '"no-console"'` shows level 2 (error)
- [x] 2.3 `npx astro check` and `npm run build` pass, the build bundles tz-lookup, and `npx wrangler deploy --dry-run` reports an upload size within the Free plan limit (assumes the existing local `wrangler login`)

#### Manual

- [x] 2.4 User reads the schema ranges (aperture 20–1000 mm, telescope focal length 100–5000 mm, eyepiece focal length 2–60 mm, AFOV 30–120°, min altitude 0–60°) and confirms none of them excludes real beginner kit

### Phase 3: Sites UI

#### Automated

- [ ] 3.1 `npm test`, `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 3.2 `npm run smoke` still passes with the moved form primitives (auth unchanged)
- [ ] 3.3 `grep -rn "console\." src/pages/api/gear src/lib/gear` returns nothing

#### Manual

- [ ] 3.4 Signed in on the dev server: "My gear" appears in the top bar and `/gear` shows the empty Sites state
- [ ] 3.5 Create a site at 52.229676, 21.012229 with automatic zone: the hub shows 52.23, 21.01 and `Europe/Warsaw (auto)`
- [ ] 3.6 Edit it to 69.65, 18.96 with the zone still automatic: the zone becomes `Europe/Oslo`. Then pin `Europe/Warsaw`, change the coordinates again, and confirm the pinned zone is kept
- [ ] 3.7 Invalid latitude (95) is blocked in the form. Submitting it anyway (for example with devtools) returns to the form with an error, and the URL contains no coordinates
- [ ] 3.8 Delete asks for confirmation and removes the site. Opening another user's site id (from a second account) shows 404
- [ ] 3.9 Signed out, `/gear` and a POST to `/api/gear/sites` redirect to `/auth/signin`
- [ ] 3.10 The pages are usable at 360 px width

### Phase 4: Telescopes and eyepieces UI

#### Automated

- [ ] 4.1 `npm test`, `npm run test:db`, `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 4.2 `npm run smoke` passes against a local preview with local Supabase, including the new gear steps
- [ ] 4.3 `CLAUDE.md` mentions `test:db`, `db:types` and the isolation-suite rule

#### Manual

- [ ] 4.4 Create a 130 mm / 650 mm telescope: the hub shows f/5. Edit it and delete it
- [ ] 4.5 Create eyepieces "25 mm Plössl" (Plössl), "10 mm" (Wide-field) and "6 mm" (Other, 100°): the hub shows AFOVs 50°, 68° and 100°, and editing the 100° one preselects "Other" with 100 filled in
- [ ] 4.6 Delete every eyepiece and telescope: the hub shows their empty states and nothing errors
- [ ] 4.7 The whole flow works at 360 px width and matches the homepage's look
