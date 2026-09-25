# Sites and Gear Management — Plan Brief

> Full plan: `context/changes/sites-and-gear-management/plan.md`

## What & Why

Signed-in users get private observing sites, telescopes and eyepieces (FR-007, FR-008, FR-009), which are the inputs S-02's Tonight view and every later slice run against. These are the product's first per-user tables, so this change also lands the PRD's isolation NFR as a test outside the UI, which every later table extends. It also sets up the pipeline that carries migrations to the hosted database.

## Starting Point

Auth works, and the pure sky engine (F-01) takes a `Site` with coordinates and an IANA time zone, but there is no schema at all: no migrations, no generated types, and no database client on `locals`. Forms are native POSTs with `?error=` redirects; `npm test` is DB-free. Only the CI smoke job starts a local Supabase. Deploys are manual.

## Desired End State

A "My gear" link in the top bar opens `/gear`, which lists the user's sites, telescopes and eyepieces, each with add, edit and delete pages. Coordinates are stored rounded to 0.01° (about 1 km). Each site's time zone follows its coordinates unless the user pinned one. `npm run test:db` proves that user B can't read, insert as, update or delete user A's rows, and that anonymous clients see nothing. CI runs that on every PR and pushes migrations to the hosted project after CI passes on `main`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Site time zone | Derived from coordinates (offline `@photostructure/tz-lookup`), user can override | Correct zone for remote sites with no effort, no third-party call, and border cases can still be fixed. |
| Zone on coordinate edit | Automatic unless pinned (`time_zone_source` auto/manual) | An explicit override is never silently lost; automatic sites never drift. |
| Isolation test | Vitest suite `tests/db/` against local Supabase via supabase-js, run in the CI smoke job | Exercises the real PostgREST + RLS boundary the app uses; each later table adds a case. |
| Validation | Shared zod schemas for island and route; `?error=` redirects kept | One definition of "valid" makes server rejections rare; coordinates never go into URLs. |
| Migrations to production | New CI `migrate` job (`supabase db push`) on push to `main`, after `ci` + `smoke` | Can't be forgotten; app deploy automation stays with F-02. |
| Layout | One `/gear` hub with dedicated new/edit pages | One place to see everything, and it fits the SSR POST + redirect pattern. |
| Eyepiece AFOV | Type picker (Plössl 50°, Wide 68°, Ultra-wide 82°) plus "Other" with a degrees field | Follows FR-009 for beginners while allowing spec-sheet values. |
| Coordinate rounding | 2 decimals, enforced in the schema and by `numeric(4,2)`/`numeric(5,2)` columns | Matches the PRD's ~1 km privacy rule, enforced in two layers. |
| Default minimum altitude | `DEFAULT_MIN_ALTITUDE_DEG = 15` in `parameters.ts`, matching the column default | PRD Open Question 8 candidate gets one named home. |

## Scope

**In scope:**
- Three tables with row-level security
- The isolation suite and a CI types-drift check
- The `migrate` CI job and deploy-plan procedure
- The typed `locals.supabase`
- Gear schemas, store and time-zone logic with unit tests
- The `/gear` hub and create/edit/delete for sites, telescopes and eyepieces
- The smoke extension and a lint rule that blocks `console` calls in gear code
- CLAUDE.md updates

**Out of scope:**
- Geolocation, place search, onboarding presets and the onboarding Bortle picker (S-03)
- Site elevation
- Telescope selector and Tonight empty states (S-08)
- Log entries (S-06/S-07)
- CI app deploy (F-02)
- Preserving form values after server errors
- `updated_at` columns

## Architecture / Approach

Native form → `/api/gear/<entity>[/id][/delete]` route → zod schema (rounding, zone resolution) → `src/lib/gear/store.ts` over the typed per-request `locals.supabase` → Postgres with RLS. The route redirects to `/gear` on success, or back to the form with a fixed, value-free `?error=` on failure. Pages read through the same store. `toEngineSite()` maps a stored site onto the engine's `Site` for S-02.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema, isolation test, migration pipeline | Tables + RLS, `test:db` in CI, `migrate` job, typed `locals.supabase` | An isolation test that passes vacuously, so it needs positive controls; the first production push depends on secrets you add |
| 2. Gear domain | zod schemas, rounding, time-zone resolution, presets, store, lint guard, unit tests | Range limits that exclude real kit (you check them manually) |
| 3. Sites UI | `/gear` hub (sites), new/edit/delete pages and routes, "My gear" nav | Coordinates leaking into error URLs, which the fixed-message mapping prevents |
| 4. Telescopes & eyepieces UI | Remaining hub sections and pages, AFOV picker, smoke steps, docs | Low: repeats the Phase 3 pattern |

**Prerequisites:** Docker for `npx supabase start` locally. Before the first merge, add the GitHub secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- Merging runs migrations while the app deploy is still manual. That order is safe only for additive migrations until F-02; this one is additive.
- `Intl.supportedValuesOf('timeZone')` builds the zone list in the browser. It's supported by all current browsers, not by very old ones.
- The time zone for a site within about 1 km of a zone border can be derived wrongly. The user can pin the correct one.

## Success Criteria (Summary)

- A user can add their home site, their telescope and their eyepieces in a couple of minutes, and S-02 can read them.
- No user can see or change another user's gear, proven by an automated test on every PR.
- Schema changes reach production on merge, and coordinates never appear in URLs or logs.
