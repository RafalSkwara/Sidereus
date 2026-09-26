# First-run Onboarding (S-03) — Plan Brief

> Full plan: `context/changes/first-run-onboarding/plan.md`

## What & Why

A new visitor should go from the landing page to tonight's ranked Messier list in under a minute of interaction, without looking up a single number (US-01, Primary Success Criterion #1). S-03 is the last slice on the main line. It turns sign-up into a guided setup (home site, sky quality, telescope and eyepieces) that ends on Tonight, and it answers the long-open preset question (Open Question 10).

## Starting Point

- **Sign-up is a dead end:** it always goes to a static confirm-email page, even though hosted Supabase has confirmation off and the user is already signed in. Sign-in lands on the landing page, whose button points at a starter `/dashboard`.
- **Available from S-01:** gear schemas, 2-decimal coordinate rounding, automatic timezone lookup and per-row create functions.
- **Missing:** geolocation, geocoding, presets, plain-language Bortle descriptions, an atomic multi-row save, and any browser-level end-to-end test.

## Desired End State

- **Sign-up** leads to `/onboarding`, one page in three sections:
  - **Where:** "Use my location", place search, or a collapsed coordinates fallback.
  - **Sky:** five scene cards.
  - **Kit:** an editable telescope preset and an editable eyepiece kit.
- **"Show me tonight"** saves everything in one transaction and opens Tonight with a ranked list.
- **Repeat visits:** users who already have gear skip onboarding. Users who abandoned it see a "Set up in about a minute" card on Tonight.
- **Landing page:** explains the product with a how-it-works strip and a Tonight screenshot.
- **Sign-in** lands on Tonight.
- **CI:** a Playwright test guards the whole path.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Telescope presets (OQ 10) | 102/500 refractor, 130/650 reflector, **150/750 reflector (default)**, 200/1200 Dobsonian, 127/1500 Maksutov; values editable | Covers the 100–200 mm persona across all three optical designs, and 150/750 is the calibrated reference kit. |
| Eyepiece kits (OQ 10) | **Supplied pair 25 + 10 mm Plössl 50° (default)**, Plössl set 32/17/13/8/6 mm, "No eyepieces yet"; rows editable | The 25+10 pair ships with nearly every persona scope, and "none" is legal under FR-021. |
| Sky picker | Five scenes: City centre 8, **Suburb 6 (default)**, Outer suburb/town 5, Village/countryside 4, Remote dark site 2 | A beginner answers from what they see; the exact class stays editable in `/gear`. |
| Who sees onboarding | After sign-up, plus a Tonight card when there is no site *and* no telescope; no flag and no gear-based redirects | Keeps FR-021's honest empty states, with no schema change and no per-request query. |
| Geocoding | Browser calls Open-Meteo Geocoding directly; results rounded to 2 decimals | Counts against each visitor's IP quota, uses no Worker CPU, and place names never reach our logs. |
| Location fallback | Collapsed "Enter coordinates instead" | Onboarding can always finish, even with location denied and search down. |
| Save | Postgres function `complete_onboarding` (security invoker, advisory lock, refuses if the user already has a site or telescope) | All or nothing: no half-onboarded user and no duplicate "Home" on retry. |
| Site name and minimum altitude | Fixed to "Home" and 15°, not shown; edited later in `/gear` | FR-004 defines them as defaults. |
| Sign-in and `/dashboard` | Sign-in → `/tonight`; `/dashboard` redirects to `/tonight` | S-02 deferred this; continuing to the requested page stays in S-09. |
| Landing | Current hero plus a 3-step strip and one screenshot captured by a Playwright helper | Meets "what it does, plus screenshots" with one image that is reproducible. |
| E2E test | Playwright in CI's smoke job, with a forecast fixture server via `FORECAST_BASE_URL` and geocoding stubbed | Honours the shape-notes commitment and exercises the real island and redirects. |
| Geocoding terms (OQ 11/12) | Open-Meteo free tier: non-commercial, 10,000 calls a day, CC BY 4.0, credit "Location data based on GeoNames" | Sidereus has no ads or subscriptions; the credit is shown on `/onboarding`. |

## Scope

**In scope:**
- Presets and sky-scene modules
- The onboarding schema and geocoding helper
- The `complete_onboarding` migration, with a DB test
- The `/onboarding` page, island and POST route
- The sign-up and sign-in redirects
- The Tonight setup card
- The lint scope
- Smoke steps
- Playwright with a fixture server in CI
- The landing strip and screenshot, and CTAs
- Retiring `/dashboard`
- Recording the answers in the roadmap

**Out of scope:**
- Continue-to-requested-page, password reset and the 30-day session (S-09)
- The telescope selector and fuller empty states (S-08)
- An onboarded flag or middleware gating
- A geocoding proxy or cache
- Editing site name or minimum altitude during onboarding
- Bortle classes 1, 3, 7 and 9 in the picker
- More screenshots
- Starter-leftover cleanup beyond `/dashboard`

## Architecture / Approach

`OnboardingWizard.tsx` (a React island) imports only island-safe modules: presets, schema, the geocoding helper, `roundCoordinate` and parameters. It calls Open-Meteo Geocoding from the browser and submits a native form to `POST /api/onboarding`. The route validates with `onboardingInputSchema`. `completeOnboarding` (server-only) then resolves the time zone and calls the `complete_onboarding` RPC under the user's RLS, and the route redirects to `/tonight`, or to `/onboarding?error=<fixed message>` on failure. The page redirects users who already have gear. Playwright drives a production preview whose forecast comes from `tests/e2e/forecast-fixture.mjs`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Onboarding data layer | Presets, scenes, schema, geocoding helper, `complete_onboarding` with a DB test, store wrapper | The RPC's refusal and rollback rules must hold under RLS through PostgREST |
| 2. Onboarding flow | `/onboarding` island, route, sign-up redirect, Tonight setup card, lint scope, smoke steps | The under-a-minute target depends on the island's UX; checked with a stopwatch |
| 3. End-to-end test | Playwright, forecast fixture server, 3 specs, CI wiring | workerd preview may refuse to fetch loopback, so the fixture host may need a non-loopback address |
| 4. Landing and entry points | How-it-works strip, screenshot, CTAs, sign-in → Tonight, `/dashboard` retired, roadmap answers | The screenshot goes stale as Tonight changes in S-05, S-06 and S-10 |

**Prerequisites:** S-01 and S-02 done (they are); F-03 `ui-foundation` done before Phase 2 (Phase 1 has no UI and runs first); local Supabase and Docker for `test:db` and smoke; Chromium installable in CI.
**Estimated effort:** about 3–4 sessions across 4 phases.

## Open Risks & Assumptions

- The ranked list in e2e test (a) assumes a clear fixture sky at about 40°N always yields at least one object above the minimum score. A bright full moon lowers scores but should not empty the list for a 150 mm scope. If it ever does, the assertion falls back to the stated count line.
- Browser geocoding shares the visitor's IP with Open-Meteo. This is accepted as part of the geocoding lookup the privacy NFR allows.
- Hosted Supabase must keep email confirmation off. If it is turned on, sign-up falls back to the confirm-email page, and onboarding starts after the first sign-in via the Tonight card.

## Success Criteria (Summary)

- A fresh account reaches a ranked Tonight in under a minute of interaction without typing a number.
- A retry or double submit never duplicates gear, and a failed save never leaves half a setup.
- CI fails if sign-up → onboarding → ranked Tonight breaks.
