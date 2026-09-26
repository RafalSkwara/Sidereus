# First-run Onboarding (S-03) Implementation Plan

## Overview

Roadmap slice S-03 (US-01, FR-001 entry, FR-004, FR-005, FR-006; NFR under-a-minute; Primary Success Criterion #1). A visitor reads the public landing page, signs up, and is taken straight into a one-page setup: a home site from browser geolocation or place-name search (rounded to ~1 km, named "Home", default minimum altitude), a plain-language sky picker of five scenes, and an editable telescope preset plus eyepiece-kit preset. One submit saves everything atomically and lands the user on Tonight with a ranked list. A Playwright end-to-end test in CI guards the whole path, and the landing page gains a "how it works" strip with one Tonight screenshot.

This plan also answers the roadmap's Open Question 10 (which presets ship) and Open Question 11/12 (geocoding terms).

**Sequencing note (2026-09-26, PRD v2):** Phase 1 (data layer, no UI) ran first. Phases 2-4 wait for F-03 `ui-foundation` (theme tokens, light/dark switch, English/Polish message catalogue).

**F-03 amendment (2026-09-26, after F-03 landed on `feat/f-03-ui-foundation`, PR #32):** phases 2-4 build on the F-03 conventions recorded in CLAUDE.md, and each affected change entry below carries an "F-03 amendment" line. In short:
- every new colour comes from theme tokens (the guard test `src/styles/no-hardcoded-colors.test.ts` enforces this);
- every new user-visible string is a key in `src/i18n/messages/en.ts` with a real Polish translation in `pl.ts` (the parity and no-inherited-English tests enforce this);
- `?error=` carries catalogue keys (`issueKey` / shared keys from `src/lib/api-errors.ts`);
- islands take `locale` as a prop.

English strings quoted in this plan (for example "Show me tonight" and "Set up in about a minute") are the English source text for new keys. The top bar already carries the switches and a signed-out "Sign in" link (F-03).

## Current State Analysis

- **Sign-up is a dead end.** `src/pages/api/auth/signup.ts:13-19` calls `supabase.auth.signUp` and always redirects to `/auth/confirm-email`, which in production says "Check your email". But hosted Supabase has email confirmation off (`context/deployment/deploy-plan.md:113`), so the user already has a session. Sign-in redirects to `/` (`src/pages/api/auth/signin.ts:19`), whose signed-in CTA points at the starter leftover `/dashboard` (`src/components/Welcome.astro:47-53`, `src/pages/dashboard.astro`).
- **Gear building blocks exist (S-01):**
  - zod schemas that take FormData-shaped strings (`src/lib/gear/schemas.ts:42-108`)
  - `roundCoordinate` to 2 decimals (`src/lib/gear/coordinates.ts:8-11`), also enforced by `numeric(4,2)`/`numeric(5,2)` columns
  - server-only `resolveTimeZone` (`src/lib/gear/timezone.ts:22-38`)
  - `DEFAULT_MIN_ALTITUDE_DEG = 15` (`src/lib/engine/parameters.ts:49`)
  - eyepiece field-of-view types (`src/lib/gear/eyepiece-presets.ts:6-15`)
  - store create functions that are separate inserts with no transaction and don't return ids (`src/lib/gear/store.ts:163-296`)
  - no RPC functions in the DB (`database.types.ts`, `Functions: never`)
- **Missing entirely:** geolocation, geocoding, telescope presets, eyepiece kits, a "Home" default name, plain-language Bortle descriptions (only short private labels in `SiteForm.tsx:31-41`), any onboarding route, and any Playwright setup.
- **Tonight** (`src/pages/tonight.astro:59-120`) uses the oldest site and telescope. With neither, it shows two separate cards, "Add site" and "Add telescope". FR-021 requires these empty states rather than a redirect.
- **Middleware** (`src/middleware.ts:4`) protects `/dashboard`, `/gear`, `/api/gear` and `/tonight`, and does no gear-based routing.
- **The smoke test** (`scripts/smoke.mjs:47-102`) asserts today's sign-up, sign-in and dashboard behaviour, so those steps change with this plan.
- **The forecast base URL is already overridable:** the `FORECAST_BASE_URL` secret is read in `src/pages/tonight.astro:74`, which gives a seam for a fixture forecast.

## Desired End State

- **Sign-up:** a successful sign-up with a session redirects to `/onboarding`. Without a session it still goes to `/auth/confirm-email`.
- **`/onboarding`:** a gated page with one React island in three sections, Where / Sky / Kit.
  - **Where:** "Use my location" (browser geolocation, rounded before it enters state), a place search against Open-Meteo Geocoding called from the browser, and a collapsed "Enter coordinates instead" fallback.
  - **Sky:** five scene cards mapped to Bortle 8/6/5/4/2, with Suburb preselected.
  - **Kit:** five telescope presets (150/750 preselected) with editable name, aperture and focal length, and three eyepiece kits (Supplied pair preselected) with editable rows.
- **Save:** one POST calls the Postgres function `complete_onboarding` in one transaction, then redirects to `/tonight`.
- **Repeat visits:** a user who already owns any site or telescope is sent from `/onboarding` to `/tonight`, and the function refuses a second run.
- **Tonight with no gear:** when the user has no site and no telescope, Tonight shows one "Set up in about a minute" card linking to `/onboarding`. The single-item empty states stay as they are.
- **Landing page:** a "how it works" strip and a committed Tonight screenshot. Signed-out CTAs are "Get started" (sign-up) and "Sign in"; signed-in is "Open Tonight". Sign-in lands on `/tonight`, and `/dashboard` redirects to `/tonight`.
- **Tests:** a Playwright spec in CI's smoke job drives sign-up → onboarding (geocoding stubbed, forecast from a local fixture server) → a ranked Tonight.
- **Roadmap:** Open Question 10 (presets) and the geocoding-terms question are recorded as answered.

Verify by: the automated criteria per phase, plus a stopwatch run of the flow in under a minute of interaction.

### Key Discoveries:

- `signUp` returns `data.session` when confirmation is off (`tests/db/isolation.test.ts` relies on it). Branch the redirect on it (`src/pages/api/auth/signup.ts:13`).
- `store.create` returns no id and runs no transaction (`src/lib/gear/store.ts:163-170`), so an atomic multi-row save needs a DB function.
- The forecast request goes to `${baseUrl}/v1/forecast` with `timeformat=unixtime`, `past_days=1`, `forecast_days=4`, and expects `hourly.{time, cloud_cover, relative_humidity_2m}` (`src/lib/forecast/open-meteo.ts:26-58`). The fixture server has to serve exactly this shape.
- `npm run build` copies `.dev.vars` into `dist/server/.dev.vars`, and preview reads that copy (CLAUDE.md tripwire). The fixture URL must be in `.dev.vars` before the build.
- The coordinate-privacy lint scope (`eslint.config.js:81-90`) lists paths explicitly, so the new onboarding paths must be added.
- Open-Meteo free tier: non-commercial, 10,000 calls a day, CC BY 4.0. The geocoding API also requires the credit "Location data based on GeoNames". Endpoint: `https://geocoding-api.open-meteo.com/v1/search?name=&count=&language=&format=json`. A 1-character query returns nothing; 2 characters match exactly; 3 or more match by prefix.

## What We're NOT Doing

- Continuing to the originally requested page after sign-in, password reset, and the 30-day session: these belong to S-09. Sign-in only changes its default target to `/tonight`.
- Gear-based redirects in the middleware or an "onboarded" flag: FR-021's empty states stay authoritative.
- Telescope selector and fuller gear-deletion empty states (S-08). The telescope has no "Other" preset beyond editing values.
- Editing the site name or minimum altitude during onboarding: FR-004 defaults them ("Home", 15°), and they are edited later in `/gear`.
- Bortle classes 1, 3, 7 and 9 in the onboarding picker: they are reachable in `/gear`.
- Proxying geocoding through the Worker, or caching geocoding results.
- More than one landing screenshot, and a read-only demo account (post-MVP).
- Fixing the stale `context/changes/...` links in `roadmap.md` Open Questions 9 and 12, or `context/handoff.md`.
- Removing `public/template.png` or other starter leftovers beyond `/dashboard`.

## Implementation Approach

Data layer first, with no UI, so the atomic save and its refusal rule are DB-tested before anything depends on them. Then the flow: the island reuses existing schemas and rounding, and the route follows the established pattern (native POST, fixed `?error=` strings, no logging). Then the end-to-end harness, which the landing screenshot reuses for a deterministic Tonight. The landing and entry-point changes come last because they alter smoke expectations that Phase 2 already touched.

## Critical Implementation Details

**Timing & lifecycle:**
- The Playwright run must start the forecast fixture server before `npm run build`/`preview`. `FORECAST_BASE_URL` also has to be written into `.dev.vars` before the build, because preview reads the copy in `dist/server/.dev.vars`.
- If workerd refuses to fetch loopback addresses in preview, bind the fixture server to the runner's non-loopback interface and use that address. Verify this first in Phase 3.

**State sequencing:** `complete_onboarding` takes a per-user transaction-scoped advisory lock *before* it checks for existing sites or telescopes. Otherwise two concurrent submits (a double click) can both pass the check.

**Privacy:** geolocation coordinates are rounded with `roundCoordinate` in the island *before* they are stored in component state or shown, so an unrounded value never reaches the form, a URL or a request. Geocoding results are rounded the same way inside the helper.

## Phase 1: Onboarding data layer

### Overview

Pure, island-safe modules for presets, sky scenes, the onboarding input schema and place search, plus the atomic `complete_onboarding` Postgres function and its server-side store wrapper. No UI.

### Changes Required:

#### 1. Presets and sky scenes

**File**: `src/lib/onboarding/presets.ts` (new) and `src/lib/onboarding/presets.test.ts` (new)

**Intent**: Fix the named preset set FR-006 requires (the answer to Open Question 10) and the five plain-language sky scenes for FR-005, in one island-safe module.

**Contract**:
- `TELESCOPE_PRESETS` is a readonly array of `{ id, name, apertureMm, focalLengthMm }` in this order:

  | id     | name                 | aperture/focal |
  | ------ | -------------------- | -------------- |
  | `r102` | 102 mm refractor     | 102/500        |
  | `n130` | 130 mm reflector     | 130/650        |
  | `n150` | 150 mm reflector     | 150/750        |
  | `d200` | 8-inch Dobsonian     | 200/1200       |
  | `m127` | 127 mm Maksutov      | 127/1500       |

  `DEFAULT_TELESCOPE_PRESET_ID = "n150"` (the 150 mm reflector, the calibrated reference kit).
- `EYEPIECE_KIT_PRESETS` is a readonly array of `{ id, name, eyepieces: { name, focalLengthMm, afovPreset: "plossl" }[] }`. Every AFOV comes from `EYEPIECE_PRESETS.plossl` (50°); none is repeated as a literal.
  - `pair` "Supplied pair": 25 mm Plössl, 10 mm Plössl
  - `plossl-set` "Plössl set": 32, 17, 13, 8 and 6 mm Plössl
  - `none` "No eyepieces yet": empty

  `DEFAULT_EYEPIECE_KIT_ID = "pair"`.
- `SKY_SCENES` is a readonly array of `{ id, title, description, bortle }`, in this order. Each description says what you see overhead on a clear moonless night, in one short sentence.
  - `city` "City centre" → 8
  - `suburb` "Suburb" → 6
  - `town` "Outer suburb or small town" → 5
  - `village` "Village or countryside" → 4
  - `remote` "Remote dark site" → 2

  `DEFAULT_SKY_SCENE_ID = "suburb"`.
- Tests assert:
  - every telescope and eyepiece preset passes `telescopeInputSchema` / `eyepieceInputSchema` once stringified
  - ids are unique
  - defaults exist
  - scene Bortle values are distinct and within 1-9

#### 2. Onboarding input schema

**File**: `src/lib/onboarding/schemas.ts` (new) and `src/lib/onboarding/schemas.test.ts` (new)

**Intent**: Validate one onboarding submit (from the island and again in the route) by reusing the S-01 field rules. The site name and minimum altitude are fixed by FR-004 rather than taken from the form.

**Contract**: `onboardingInputSchema` parses a FormData-shaped object and outputs `OnboardingInput`:

```
{ site: { name: "Home", latitudeDeg, longitudeDeg, bortle, minAltitudeDeg: DEFAULT_MIN_ALTITUDE_DEG },
  telescope: TelescopeInput, eyepieces: EyepieceInput[] }
```

- **Form fields:** `latitudeDeg`, `longitudeDeg`, `bortle`, `telescopeName`, `apertureMm`, `focalLengthMm`, and `eyepieces`. `eyepieces` is a JSON string holding an array of 0-10 objects shaped like the `/gear` eyepiece form: `{ name, focalLengthMm, afovPreset, afovDeg? }`, all strings.
- **Field rules:** each eyepiece element goes through `eyepieceInputSchema`. Coordinates reuse the site schema's range checks and `roundCoordinate`, and the telescope reuses `telescopeInputSchema`'s field rules.
- **Errors:** all messages are static. Malformed JSON gives the fixed message "Check your eyepieces."
- **Imports:** never `timezone.ts` or `store.ts`.
- **Tests:**
  - a happy path that includes 0 eyepieces
  - rounding applied
  - out-of-range latitude rejected
  - 11 eyepieces rejected
  - malformed JSON rejected
  - no error message contains a submitted value

#### 3. Place search helper

**File**: `src/lib/onboarding/geocode.ts` (new) and `src/lib/onboarding/geocode.test.ts` (new)

**Intent**: A browser-side client for Open-Meteo Geocoding with the fetch function passed in, so tests need no network (the same pattern as `src/lib/forecast/open-meteo.ts`).

**Contract**:
- `GEOCODING_BASE_URL = "https://geocoding-api.open-meteo.com"`.
- `searchPlaces(query: string, fetchFn: typeof fetch, signal?: AbortSignal): Promise<PlaceResult[]>`, where `PlaceResult = { id: number; label: string; latitudeDeg: number; longitudeDeg: number }`.
  - A trimmed query under 2 characters returns `[]` without fetching.
  - Otherwise it requests `/v1/search?name=<q>&count=5&language=en&format=json`.
  - The label is `name, admin1, country` with empty parts dropped. Coordinates go through `roundCoordinate`.
  - A missing `results` key returns `[]`.
  - Non-2xx, a timeout (3 s) or a schema mismatch throw `Error(GEOCODING_FAILED)`, where `GEOCODING_FAILED = "Place search is unavailable right now."`. The error carries no URL and no query.
  - The helper never logs.
- Tests: URL shape, the short-query short-circuit, mapping and rounding, the empty result, and each failure mode mapping to the fixed message.

#### 4. Atomic save function

**File**: `supabase/migrations/20260926120000_complete_onboarding.sql` (new)

**Intent**: Insert the site, telescope and 0-10 eyepieces in one transaction under the caller's RLS. Refuse to run for a user who already has a site or telescope, so a retry or double submit cannot duplicate "Home".

**Contract**:
- **Signature:** `public.complete_onboarding(site_name text, latitude_deg numeric, longitude_deg numeric, bortle smallint, min_altitude_deg smallint, time_zone text, time_zone_source text, telescope_name text, aperture_mm numeric, focal_length_mm numeric, eyepieces jsonb) returns void`, `language plpgsql`, `security invoker`, `set search_path = ''`. The `eyepieces` argument is an array of `{name, focal_length_mm, afov_deg}`.
- **Body, in order:**
  1. `pg_advisory_xact_lock` keyed on `auth.uid()`.
  2. If a `public.sites` or `public.telescopes` row exists for `auth.uid()`, `raise exception 'already_onboarded'` (SQLSTATE `P0001`).
  3. Insert the site, then the telescope, then each eyepiece. `user_id` comes from the column defaults, and the existing table checks apply.
- **Grants:** `revoke execute … from public, anon`, then `grant execute … to authenticated`.
- The migration is additive only, so the code already live keeps working (see the `migrate` job note in `ci.yml`).

#### 5. Regenerated types

**File**: `src/lib/database.types.ts`

**Intent**: Pick up the new function signature.

**Contract**: regenerated with `npm run db:types` against local Supabase, never hand-edited. `Functions.complete_onboarding` appears.

#### 6. DB test for the function

**File**: `tests/db/onboarding.test.ts` (new)

**Intent**: Prove the all-or-nothing and refusal rules outside the UI, through the same PostgREST path the app uses (the pattern in `tests/db/isolation.test.ts`).

**Contract**: it signs up fresh users and asserts:
- (a) a valid call creates exactly 1 site, 1 telescope and N eyepieces, all readable by the caller and invisible to a second user
- (b) a call whose third eyepiece violates a check constraint leaves zero rows
- (c) a second call by the same user fails with `already_onboarded` and leaves the counts unchanged
- (d) an anonymous client cannot execute the function

#### 7. Server-side store wrapper

**File**: `src/lib/onboarding/store.ts` (new)

**Intent**: The only caller of the RPC. It resolves the time zone server-side and maps errors to fixed messages, following `src/lib/gear/store.ts`'s privacy rules.

**Contract**:
- `completeOnboarding(client: TypedSupabaseClient, input: OnboardingInput): Promise<OnboardingResult>`, where `OnboardingResult = { ok: true } | { ok: false; reason: "alreadyOnboarded" } | { ok: false; reason: "failed"; message: string }`.
- It resolves the zone with `resolveTimeZone({ mode: "auto", … })`. When the lookup throws, it returns `failed` with "Could not save your setup. Please try again.".
- It maps `already_onboarded` → `alreadyOnboarded` and check violation `23514` → "Some values are out of the allowed range.". Anything else → the fixed save message.
- It never logs and never returns DB error text. It also exports `hasAnyGear(client): Promise<boolean>`, which selects `id` with `limit(1)` on sites and on telescopes.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the new presets, onboarding schema and geocoding tests
- `npx supabase db reset` applies the new migration cleanly on local Supabase
- `npm run db:types` output includes `complete_onboarding` and leaves no further diff
- `npm run test:db` passes, including the new `complete_onboarding` suite
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- The user reviews and accepts the preset values and the five sky-scene descriptions

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Onboarding flow

### Overview

The gated `/onboarding` page and island, the POST route, the sign-up redirect, the Tonight setup card, the geocoding credit, the lint scope and the smoke steps.

### Changes Required:

#### 1. Onboarding island

**File**: `src/components/onboarding/OnboardingWizard.tsx` (new)

**Intent**: A one-page, three-section setup that a beginner completes without looking anything up. It submits a native HTML form, following the pattern of the S-01 forms.

**Contract**: props `{ action: string; serverError?: string | null }`. `<form method="POST" action={action}>` carries hidden inputs matching `onboardingInputSchema`.

- **Where:**
  - A "Use my location" button calls `navigator.geolocation.getCurrentPosition`. It rounds the position and shows "Using your current location (about 1 km)". A denied or unavailable permission shows a fixed hint and leaves search usable.
  - A place-search input (debounced ~300 ms, at least 2 characters) calls `searchPlaces(q, fetch)` and lists up to 5 labels. Picking one sets the coordinates and shows its label. A search failure shows `GEOCODING_FAILED`.
  - A collapsed "Enter coordinates instead" disclosure has latitude and longitude fields, rounded on submit.
  - The submit button stays disabled until a location is set.
- **Sky:** five radio cards from `SKY_SCENES` showing title and description. `DEFAULT_SKY_SCENE_ID` is preselected, and the value submitted is `bortle`.
- **Kit:**
  - Telescope preset radios from `TELESCOPE_PRESETS` (default preselected). Name, aperture and focal-length fields are prefilled and editable.
  - Kit radios from `EYEPIECE_KIT_PRESETS`. The eyepiece rows (name, focal length, type select from `AFOV_PRESET_OPTIONS`) are prefilled, editable and removable.
  - An "Add eyepiece" button works up to 10.
  - The rows serialise into the `eyepieces` hidden field as JSON.
- **Client validation:** `onboardingInputSchema.safeParse` runs before submit, and errors are shown inline.
- **Imports:** island-safe modules only: `@/lib/onboarding/{presets,schemas,geocode}`, `@/lib/gear/{coordinates,eyepiece-presets}`, `@/lib/engine/parameters`. Never `timezone.ts` or any `store.ts`.
- **Submit label:** "Show me tonight".
- **F-03 amendment:**
  - The island takes `locale: Locale` (from `Astro.locals.locale`) and reads every label, hint, button, placeholder and error through `getMessages(locale)`, adding new keys under `onboarding.*` in both `en.ts` and `pl.ts`.
  - Preset, kit and scene names, titles and descriptions come from `messages.onboarding.{telescopes,eyepieceKits,scenes}`, keyed by the Phase 1 ids.
  - `searchPlaces(q, fetch, locale, signal)` takes the locale, and its failure is the `GEOCODING_FAILED` key, which is translated.
  - The prefilled telescope name comes from the chosen preset's localised name. Eyepiece names ("25 mm Plössl") stay data.
  - Colours use tokens only, following `src/pages/design.astro`. Cards use `bg-surface border-border`, the selected state uses the `selected` tokens, and the primary button is the shadcn `Button` default.

#### 2. Onboarding page

**File**: `src/pages/onboarding.astro` (new)

**Intent**: Host the island behind auth, send users who already have gear to Tonight, and credit the geocoding data source.

**Contract**:
- With `locals.supabase` null it renders `DatabaseMissing`.
- If `hasAnyGear(supabase)` is true, `return Astro.redirect("/tonight")`.
- Otherwise it renders inside `GearShell`, with the title "Set up Sidereus", a one-line intro, `<OnboardingWizard action="/api/onboarding" serverError={?error} client:load />`, and the credit "Place search: Open-Meteo Geocoding API · Location data based on GeoNames (CC BY 4.0)" with links, styled like `src/components/tonight/Attribution.astro`.
- **F-03 amendment:** the page title, intro and credit line are catalogue keys (English and Polish), the page passes `locale={Astro.locals.locale}` to the island, and `?error=` is passed through raw for the island to translate.

#### 3. Onboarding POST route

**File**: `src/pages/api/onboarding.ts` (new)

**Intent**: Validate, then save atomically, then land on Tonight. It follows `src/pages/api/gear/sites/index.ts` exactly: fixed `?error=` strings and no logging.

**Contract**:
- `POST` parses `onboardingInputSchema` from `Object.fromEntries(formData)` and calls `completeOnboarding`.
- `ok` or `alreadyOnboarded` → `redirect("/tonight")`.
- A failure → `redirect("/onboarding?error=<fixed message>")`.
- No Supabase → "The database is not configured.".
- **F-03 amendment:**
  - Call `completeOnboarding(supabase, parsed.data, { siteName: getMessages(context.locals.locale).onboarding.homeSiteName })`, which gives "Home" in English and "Dom" in Polish.
  - Failures redirect with keys only: `issueKey(parsed.error)` for validation, the store's key for DB failures, and `NOT_CONFIGURED` from `src/lib/api-errors.ts`.

#### 4. Sign-up redirect

**File**: `src/pages/api/auth/signup.ts`

**Intent**: A new user with a session goes straight into onboarding (PRD: "sign-up leads straight into onboarding"). Without a session, the existing page is kept.

**Contract**: destructure `data` from `signUp`. When `data.session` is set → `/onboarding`, else → `/auth/confirm-email`.

#### 5. Middleware

**File**: `src/middleware.ts`

**Intent**: Gate the new page and route.

**Contract**: `PROTECTED_ROUTES` gains `"/onboarding"` and `"/api/onboarding"`.

#### 6. Tonight setup card

**File**: `src/pages/tonight.astro`

**Intent**: A user with no site *and* no telescope (for example, someone who abandoned onboarding) gets one clear route back to setup, while FR-021's individual empty states stay unchanged.

**Contract**:
- When neither list errored and both `site` and `telescope` are missing, render one prompt card: "Set up your site and telescope in about a minute", with a link "Set up" → `/onboarding`. Render it *instead of* the two single-item cards.
- When only one of them is missing, keep the existing cards.
- **F-03 amendment:** the card text and link label are new catalogue keys (English and Polish), styled with the existing prompt-card token classes in `tonight.astro`.

#### 7. Lint scope

**File**: `eslint.config.js`

**Intent**: The coordinate-privacy `no-console: error` scope has to cover the new code that handles coordinates.

**Contract**: `gearConfig.files` gains `src/lib/onboarding/**`, `src/components/onboarding/**`, `src/pages/api/onboarding.ts` and `src/pages/onboarding.astro`.

#### 8. Smoke steps

**File**: `scripts/smoke.mjs`

**Intent**: Cover the new redirects and the onboarding save over HTTP.

**Contract**:
- "signup creates account" now expects `302` to exactly `/onboarding`.
- New steps after it, in this order:
  1. "onboarding renders" (200)
  2. "invalid onboarding returns with error" (POST with latitude 95 → `/onboarding?error=`)
  3. "onboarding saves and opens tonight" (a valid form using the `n150` telescope, the Supplied pair as the `eyepieces` JSON and Bortle 6 → exactly `/tonight`)
  4. "onboarding redirects once set up" (GET → exactly `/tonight`)
- The remaining steps are unchanged. The sign-in and dashboard expectations change in Phase 4.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint` and `npx astro check` pass
- `npm run build` succeeds
- `npm run smoke` passes against a local preview with local Supabase, including the new onboarding steps

#### Manual Verification:

- A fresh sign-up lands on `/onboarding` and reaches a ranked Tonight in under a minute of interaction using place search (stopwatch, excluding sign-up typing)
- "Use my location" sets the site and shows only the rounded location; denying the permission leaves place search working
- With geocoding blocked in DevTools, the "Enter coordinates instead" fallback completes onboarding
- `/onboarding` after finishing redirects to `/tonight`, and a new account that skips onboarding sees the "Set up" card on Tonight
- No coordinates appear in any URL or in the dev-server log during onboarding

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: End-to-end test

### Overview

Playwright drives the real browser flow against a production preview. The forecast comes from a local fixture server and geocoding is stubbed in the browser. It runs in CI's smoke job.

### Changes Required:

#### 1. Playwright setup

**File**: `package.json`, `playwright.config.ts` (new), `.gitignore`

**Intent**: Add the e2e runner that shape-notes committed to (`shape-notes.md:73-74,524`).

**Contract**:
- `@playwright/test` is added as a devDependency, with the script `"test:e2e": "playwright test"`.
- Config:
  - `testDir: "tests/e2e"`, Chromium only
  - `baseURL` from `BASE_URL`, defaulting to `http://localhost:4321`
  - no `webServer`: the caller starts the preview and the fixture server, as the smoke job already does
  - retries 1 in CI, `trace: "retain-on-failure"`
- `.gitignore` gains `test-results/` and `playwright-report/`.
- Vitest's `include` (`src/**/*.test.ts`) already leaves `tests/e2e/*.spec.ts` out. Confirm this.

#### 2. Forecast fixture server

**File**: `tests/e2e/forecast-fixture.mjs` (new)

**Intent**: Give Tonight a deterministic all-clear forecast, whatever the date, so the spec can assert a ranked list.

**Contract**:
- A zero-dependency Node `http` server on `FIXTURE_PORT` (default `4400`).
- `GET /v1/forecast` returns `{ hourly: { time, cloud_cover, relative_humidity_2m } }`: hourly unix seconds from the current UTC hour minus 48 h to plus 120 h, with `cloud_cover` 0 and `relative_humidity_2m` 40.
- Any other path returns 404.

#### 3. Onboarding spec

**File**: `tests/e2e/onboarding.spec.ts` (new)

**Intent**: Prove Primary Success Criterion #1's path end to end, and the two entry points into onboarding.

**Contract**: three tests, each signing up a unique `e2e-<uuid>@example.com`.
- (a) **Place search → ranked list.**
  1. `page.route("https://geocoding-api.open-meteo.com/**")` returns one Madrid result (40.4168, -3.7038). At about 40°N there is a dark window in every season.
  2. Sign up, expect `/onboarding`, search "Madrid" and pick the result.
  3. Keep "Suburb", the 150 mm reflector and the Supplied pair, then submit.
  4. Expect `/tonight` with a "Go" verdict, at least one ranked object card, and an eyepiece line mentioning "25 mm".
- (b) **Geolocation.** A context with the `geolocation` permission and Madrid coordinates: clicking "Use my location" shows the location-set state and enables submit.
- (c) **Abandoned onboarding.** After sign-up, navigating straight to `/tonight` shows the "Set up" card linking to `/onboarding`.
- **F-03 amendment:**
  - Tests (a)-(c) set the `sidereus-lang=en` cookie so the English assertions are deterministic.
  - Add test (d) **Polish browser**: a context with `locale: "pl-PL"` and no cookie signs up and lands on `/onboarding` rendered in Polish. Assert `<html lang="pl">` and that the submit button shows the Polish label from `pl.ts`.

#### 4. CI wiring

**File**: `.github/workflows/ci.yml` (smoke job)

**Intent**: Run the spec on every PR and merge, against the same local Supabase and preview that the smoke test uses.

**Contract**: in the smoke job:
- Before "Configure secrets for build and preview", start `node tests/e2e/forecast-fixture.mjs &` and wait until it answers.
- Append `FORECAST_BASE_URL=http://127.0.0.1:4400` (or the non-loopback address; see Critical Implementation Details) to `.env` and `.dev.vars`.
- After the smoke step, run `npx playwright install --with-deps chromium` and then `BASE_URL=http://localhost:4321 npm run test:e2e`.
- On failure, upload `playwright-report/` with `actions/upload-artifact@v4`.
- The existing smoke steps keep passing, now against the fixture forecast.

### Success Criteria:

#### Automated Verification:

- `npm run test:e2e` passes locally against a preview built with `FORECAST_BASE_URL` pointing at the fixture server
- `npm test`, `npm run lint` and `npx astro check` pass, and Vitest does not pick up the Playwright specs
- CI's smoke job runs the Playwright spec and is green on the PR

#### Manual Verification:

- Temporarily breaking the sign-up → `/onboarding` redirect makes the e2e spec fail (then revert)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Landing and entry points

### Overview

The public landing page says what the product does and shows it. Every entry point leads to Tonight or onboarding, the starter `/dashboard` is retired, and the roadmap records the answered questions.

### Changes Required:

#### 1. Landing page

**File**: `src/components/Welcome.astro`, `public/landing/tonight.png` (new)

**Intent**: Meet the PRD's public surface: what it does, plus a screenshot.

**Contract**:
- Keep the existing hero. Below the verdict pills, add a three-step "How it works" strip:
  1. "Tell us where you observe"
  2. "Pick your telescope and eyepieces"
  3. "Get tonight's verdict and up to five targets"
- Add one `<img>` of `/landing/tonight.png` with meaningful `alt`, width and height, `loading="lazy"`, and a responsive width.
- CTAs: signed out, "Get started" → `/auth/signup` (primary) and "Sign in" → `/auth/signin`. Signed in, "Open Tonight" → `/tonight`.
- **F-03 amendment:** the how-it-works steps, CTA labels and image `alt` are catalogue keys (English and Polish), styled with tokens like the existing hero. The screenshot is captured in the dark theme and in English.

#### 2. Screenshot capture

**File**: `tests/e2e/landing-screenshot.spec.ts` (new)

**Intent**: Make the screenshot reproducible from the Phase 3 fixture setup instead of taking it by hand.

**Contract**:
- The test is skipped unless `CAPTURE_LANDING=1`.
- It signs up, completes onboarding as in spec (a), and writes a 1280×800 screenshot of the Tonight content to `public/landing/tonight.png`.
- It is not run in CI.

#### 3. Sign-in target and `/dashboard`

**File**: `src/pages/api/auth/signin.ts`, `src/pages/dashboard.astro`

**Intent**: A returning user lands on the product, not on the landing page or a starter page.

**Contract**: a successful sign-in → `/tonight`. `dashboard.astro` becomes `return Astro.redirect("/tonight")`. It stays in `PROTECTED_ROUTES`, so anonymous users still go to sign-in.

#### 4. Top bar for signed-out visitors

**File**: `src/components/Topbar.astro`

**Intent**: Signed-out visitors get a way in from the header instead of a "Not logged in" pill.

**Contract**: the signed-out branch renders a "Sign in" link to `/auth/signin` in the existing link style.
- **F-03 amendment:** already delivered by F-03 phase 2. Verify it is present and change nothing.

#### 5. Smoke expectations

**File**: `scripts/smoke.mjs`

**Intent**: Follow the new sign-in and dashboard targets.

**Contract**:
- "signin accepts correct password" → exactly `/tonight`.
- "dashboard renders for signed-in user" is renamed "dashboard redirects to tonight" and expects `302` to exactly `/tonight`.

#### 6. Roadmap answers

**File**: `context/foundation/roadmap.md`

**Intent**: Record the decisions this change settled, so later planning does not re-ask them.

**Contract**:
- Open Question 10 is marked answered 2026-09-26 with the shipped telescope presets, eyepiece kits and sky-scene mapping.
- Open Question 11 (geocoding terms) is marked answered: the Open-Meteo free tier (non-commercial, 10,000 calls a day, CC BY 4.0, GeoNames credit shown on `/onboarding`), called from the browser.
- The S-03 **Unknowns** bullets are updated to point at those answers. S-03's Status is not changed here; the lifecycle skills own it.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check` and `npm test` pass
- `npm run smoke` passes with the updated sign-in and dashboard expectations
- `npm run test:e2e` still passes

#### Manual Verification:

- The landing page reviewed signed out and signed in, at desktop and phone width: how-it-works strip, screenshot, CTAs
- Sign-in lands on `/tonight`, and `/dashboard` redirects to `/tonight`
- Roadmap Open Questions 10 and 11 read as answered with the shipped values

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- **Presets:** every preset is schema-valid, ids are unique, defaults exist, and scene Bortle values are distinct and in range.
- **Onboarding schema:** rounding, fixed name and minimum altitude, 0 and 11 eyepieces, malformed JSON, and that messages never echo input.
- **Geocoding helper:** URL, short-query short-circuit, mapping, rounding, empty results, and fixed failure messages. The fetch is passed in; nothing is mocked globally.

### Integration Tests:

- **`tests/db/onboarding.test.ts`:** atomic success, rollback on a bad eyepiece, `already_onboarded` refusal, anonymous execution denied, and cross-user invisibility.
- **`scripts/smoke.mjs`:** sign-up → onboarding → Tonight redirects, the invalid submit, and the already-set-up redirect.
- **`tests/e2e/onboarding.spec.ts`:** the browser path with place search, geolocation, and the abandoned-onboarding card.

### Manual Testing Steps:

1. Sign up a fresh account on the local preview, then complete onboarding with a stopwatch running (excluding sign-up typing). It should take under 60 s to reach a ranked Tonight.
2. Repeat with "Use my location", then deny the permission and use search instead.
3. Block `geocoding-api.open-meteo.com` in DevTools and complete onboarding through "Enter coordinates instead".
4. Reload `/onboarding` after finishing and expect a redirect to `/tonight`. With a second account, skip onboarding and open `/tonight` to see the Set up card.
5. Inspect URLs and the dev-server log for any coordinate values.

## Performance Considerations

- `/onboarding` adds two `limit(1)` selects.
- The save is one RPC round trip instead of up to 12 inserts.
- Geocoding runs in the visitor's browser, so it uses no Worker CPU and counts against each visitor's IP rather than a pooled Worker quota. The search is debounced, and 1-character queries are skipped.
- Tonight is unchanged.

## Migration Notes

`20260926120000_complete_onboarding.sql` is additive: it creates a function and changes no table. CI's `migrate` job pushes it before `deploy`, and the code already live does not call it, so the brief window between migration and deploy is safe. Rollback means dropping the function; no data depends on it.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-03; Open Questions 10, 11)
- PRD: `context/foundation/prd.md` (US-01; FR-004, FR-005, FR-006, FR-021; NFR under-a-minute and coordinate privacy; Access Control)
- Shape notes, e2e commitment: `context/foundation/shape-notes.md:73-74,524,539`
- S-01 deferral: `context/archive/2026-09-24-sites-and-gear-management/plan.md:33`
- S-02 deferral of the sign-in redirect: `context/archive/2026-09-25-tonight-verdict-and-ranking/plan.md:47`
- Route pattern: `src/pages/api/gear/sites/index.ts`
- Fetch passed in as a parameter: `src/lib/forecast/open-meteo.ts:26-80`
- DB test pattern: `tests/db/isolation.test.ts`
- Open-Meteo terms and Geocoding API: https://open-meteo.com/en/terms, https://open-meteo.com/en/docs/geocoding-api

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Onboarding data layer

#### Automated

- [x] 1.1 `npm test` passes, including the new presets, onboarding schema and geocoding tests — abd7acd
- [x] 1.2 `npx supabase db reset` applies the new migration cleanly on local Supabase — abd7acd
- [x] 1.3 `npm run db:types` output includes `complete_onboarding` and leaves no further diff — abd7acd
- [x] 1.4 `npm run test:db` passes, including the new `complete_onboarding` suite — abd7acd
- [x] 1.5 `npm run lint` and `npx astro check` pass — abd7acd

#### Manual

- [x] 1.6 The user reviews and accepts the preset values and the five sky-scene descriptions — abd7acd

### Phase 2: Onboarding flow

#### Automated

- [x] 2.1 `npm test`, `npm run lint` and `npx astro check` pass — 79e9bc9
- [x] 2.2 `npm run build` succeeds — 79e9bc9
- [x] 2.3 `npm run smoke` passes against a local preview with local Supabase, including the new onboarding steps — 79e9bc9

#### Manual

- [x] 2.4 A fresh sign-up lands on `/onboarding` and reaches a ranked Tonight in under a minute of interaction using place search (stopwatch, excluding sign-up typing) — 79e9bc9
- [x] 2.5 "Use my location" sets the site and shows only the rounded location; denying the permission leaves place search working — 79e9bc9
- [x] 2.6 With geocoding blocked in DevTools, the "Enter coordinates instead" fallback completes onboarding — 79e9bc9
- [x] 2.7 `/onboarding` after finishing redirects to `/tonight`, and a new account that skips onboarding sees the "Set up" card on Tonight — 79e9bc9
- [x] 2.8 No coordinates appear in any URL or in the dev-server log during onboarding — 79e9bc9

### Phase 3: End-to-end test

#### Automated

- [x] 3.1 `npm run test:e2e` passes locally against a preview built with `FORECAST_BASE_URL` pointing at the fixture server — 13b4d58
- [x] 3.2 `npm test`, `npm run lint` and `npx astro check` pass, and Vitest does not pick up the Playwright specs — 13b4d58
- [x] 3.3 CI's smoke job runs the Playwright spec and is green on the PR — 13b4d58

#### Manual

- [x] 3.4 Temporarily breaking the sign-up → `/onboarding` redirect makes the e2e spec fail (then revert) — 13b4d58

### Phase 4: Landing and entry points

#### Automated

- [x] 4.1 `npm run lint`, `npx astro check` and `npm test` pass — d8a9318
- [x] 4.2 `npm run smoke` passes with the updated sign-in and dashboard expectations — d8a9318
- [x] 4.3 `npm run test:e2e` still passes — d8a9318

#### Manual

- [x] 4.4 The landing page reviewed signed out and signed in, at desktop and phone width: how-it-works strip, screenshot, CTAs — d8a9318
- [x] 4.5 Sign-in lands on `/tonight`, and `/dashboard` redirects to `/tonight` — d8a9318
- [x] 4.6 Roadmap Open Questions 10 and 11 read as answered with the shipped values — d8a9318
