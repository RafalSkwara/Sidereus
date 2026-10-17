---
date: 2026-10-17T06:56:36+0200
researcher: Claude (Sonnet 5.5, herdr agent "auth")
git_commit: 82e35cf58994b99988874e5f8f59c7b4894b8549
branch: feat/auth-loose-ends
repository: Sidereus
topic: "Auth loose ends: D1 (signed-in visitor on the auth pages) and D2 (sign-up continues to the requested page)"
tags: [research, codebase, auth, middleware, auth-redirect, onboarding, service-worker]
status: complete
last_updated: 2026-10-17
last_updated_by: Claude (Sonnet 5.5, herdr agent "auth")
---

# Research: auth loose ends (D1, D2)

**Date**: 2026-10-17 · **Branch**: `feat/auth-loose-ends` off `origin/main` 82e35cf · **Scope**: lean, read in the main context (no subagents; the surface is about ten files).

## Research Question

How do we (D1) send a signed-in visitor who opens `/auth/signin` or `/auth/signup` to `/tonight`, and (D2) make a sign-up that starts from a gated link continue to the requested page through `next`, the way sign-in does with `safeNextPath`? Which neighbours (middleware order, onboarding, the service worker's purge, tests, i18n, logging) constrain the change?

## Summary

- **D1 today:** the middleware redirects only gated paths (`src/middleware.ts:37-44`). `/auth/signin` and `/auth/signup` are not gated and render for a signed-in user (confirmed in the archived `ui-auth` research, D1). The user is already resolved into `context.locals.user` at `src/middleware.ts:35`, so the redirect fits in the middleware right after that line, before `next()`.
- **D2 today:** nothing carries `next` through sign-up, in three places on the path a visitor actually walks:
  1. The sign-in page's "Sign up" link is a bare `/auth/signup` (`src/pages/auth/signin.astro:31`), so a visitor bounced from `/log` to `/auth/signin?next=%2Flog` loses `next` on the click to sign-up.
  2. The sign-up page and form have no `next` (`signup.astro`, `SignUpForm.tsx`), and `POST /api/auth/signup` sends the user to `/onboarding` (session started) or `/auth/confirm-email` (no session), `src/pages/api/auth/signup.ts:22`.
  3. A brand-new user has no gear; `/onboarding` is the only automatic first-run setup, and it ends in a fixed redirect to `/tonight` (`src/pages/api/onboarding.ts:36`).
- **The service worker is not affected.** It purges on a `POST` whose pathname is in `AUTH_POSTS` (`src/sw.ts:64`, handler `src/sw.ts:742-749`) and on a Tonight navigation answered with an `opaqueredirect` (`src/sw.ts:645-651`). Neither depends on the `Location` the route returns, and the paths `/api/auth/signin` and `/api/auth/signup` stay the same. A D1 redirect on a `GET /auth/signin` is not a Tonight navigation, so it never reaches the bounce rule.
- **`safeNextPath` stays the one rule** (`src/lib/auth-redirect.ts:21-39`): it refuses `//`, `/\`, control characters, other origins, `/api*` and `/auth*`, and returns the normalised path+query. Every new place that reads a `next` goes through it.

## Detailed Findings

### Middleware and the auth pages

- `onRequest` resolves preferences, builds the per-request client, sets `locals.user` (`src/middleware.ts:25-35`), then handles gated paths (`isProtectedPath`, `:37-44`), then `next()`.
- Gated paths are the `PROTECTED_ROUTES` list (`src/lib/protected-routes.ts:4-14`), matched on whole segments. `/auth/*` is not in it, correctly: signed-out visitors must reach it.
- The pages read `?error=` and, for sign-in, `?next=` through `safeNextPath` (`signin.astro:11-14`). Sign-up reads only `?error=` (`signup.astro:9`).
- `/auth/confirm-email` is a third auth page; its "back to sign in" link is a bare `/auth/signin` (`confirm-email.astro:29`). The D1 wording names only sign-in and sign-up.

### Routes and forms

- `POST /api/auth/signin` already does the whole `next` dance: reads the hidden `next` through `safeNextPath`, keeps it on a failure redirect, and lands on `next ?? "/tonight"` (`src/pages/api/auth/signin.ts:11-33`). `SignInForm` posts a hidden `next` only when there is one (`SignInForm.tsx:52`).
- `POST /api/auth/signup` maps a failure to `errors.auth.*` through `authErrorKey` (Supabase `error.code`, never `message`; `api-errors.ts:21-37`) and redirects with `?error=<key>`. It reads no `next`. `SignUpForm` has no `next` prop.
- Local Supabase has email confirmation off (so sign-up starts a session and goes to `/onboarding`); the hosted project redirects to `/auth/confirm-email` (`signup.ts:21-22`, `confirm-email.astro:9` shows the auto-confirmed copy only in dev).

### Onboarding (a new user has no gear)

- `/onboarding` is gated. Its page redirects an already-onboarded user to `/tonight` (`onboarding.astro:15-24`) and passes a fixed `action="/api/onboarding"` to `OnboardingWizard`, which posts that action's URL with hidden inputs, one per `onboardingInputSchema` field (`OnboardingWizard.tsx:479-481`). Because the page passes `action` as a prop, a `?next=` can ride on the action URL without touching the island.
- `POST /api/onboarding` fails back to `/onboarding?error=<key>` (`onboarding.ts:18`) and succeeds to `/tonight` (`:36`).
- The other gated pages render for a user with no gear: `/gear` shows empty states (`gear/index.astro:89,132-138`) and Tonight shows a prompt linking to `/onboarding` (`TonightContent.astro:230`). Nothing else sends a gear-less user to onboarding. Landing on a gated page straight after sign-up would therefore skip first-run setup.

### Service worker

- Purge on auth POSTs: route matches `sameOrigin && AUTH_POSTS.has(url.pathname)`, runs `purge()`, fetches the request, then re-stores the offline shell (`src/sw.ts:742-749`). Unchanged by D2 as long as the two paths stay.
- Purge on the bounce: `afterNavigation` purges on an `opaqueredirect` for a Tonight navigation (`src/sw.ts:645-651`). D1's redirect starts from `/auth/signin`, not from a stored Tonight page.
- Risk to verify at runtime (not by reading): a production preview registers the worker, so the e2e for D1 and D2 runs through it and doubles as the proof that the purge path still works.

### Tests and conventions

- Unit: `src/lib/auth-redirect.test.ts` pins `safeNextPath` and `signInUrl`; `src/lib/protected-routes.test.ts` pins the gated list. There is no middleware unit test; the middleware is covered over HTTP by `scripts/smoke.mjs` (`:220-270`, redirect and `next` assertions) and in the browser by `tests/e2e/sign-in-continue.spec.ts`.
- e2e helpers: `signUp` (`tests/e2e/helpers.ts:102-115`) fills the sign-up form and expects `/onboarding$`; `onboardInMadrid` completes onboarding; `waitForHydration`, `signOut` exist.
- Copy: `auth.signIn.continueNote` is "Sign in to continue." (`en.ts:133`); the sign-up block has no note. Any new string needs a key in `en.ts` and `pl.ts` (parity test).
- Logging (S-07): `src/lib/observability/log-failure.ts` has a closed `FAILURE_STEPS` list; the auth routes log nothing today. No new log is needed for D1 or D2 (no new failure branch exists: an unsafe `next` is simply ignored, as sign-in does).

## Code References

- `src/middleware.ts:35-44` - user resolved; gated-path redirect (D1 goes between these and `next()`)
- `src/lib/auth-redirect.ts:21-39` - `safeNextPath`, `signInUrl`
- `src/pages/auth/signin.astro:11-14,28-33` - reads `next`; bare "Sign up" link
- `src/pages/auth/signup.astro:9-22` - no `next`; bare "Sign in" link
- `src/components/auth/SignUpForm.tsx:73` (form tag), props at `:14-18` - no `next`
- `src/pages/api/auth/signup.ts:22` - the redirect that drops `next`
- `src/pages/api/auth/signin.ts:11-33` - the model to follow
- `src/pages/auth/confirm-email.astro:29` - bare "back to sign in" link
- `src/pages/onboarding.astro:15-35`, `src/pages/api/onboarding.ts:18,36` - onboarding's fixed `/tonight`
- `src/sw.ts:64,645-651,742-749` - purge triggers

## Architecture Insights

- One rule for `next`: `safeNextPath`. The existing pattern passes it as a hidden form field to a POST route and as a query param to a page; both re-validate on read.
- Route errors are fixed keys in `?error=`; a `next` rides beside them as a normalised path (never a message or a form value).
- A redirect target carries `next` in a query value (`encodeURIComponent`); `signInUrl(next)` already builds that for sign-in, and there is no twin for sign-up yet.

## Historical Context (from prior changes)

- `context/archive/2026-10-05-ui-auth/research.md:73-74` - D1 and D2 recorded and deferred as behaviour changes outside a visual pass; `plan.md:27` states the exclusion.
- S-09 (M-2, sign-in continues to the requested page) is the origin of `safeNextPath` and `signInUrl`; the comments in `auth-redirect.ts` and `signin.ts` say so.

## Related Research

None open. `context/changes/error-visibility` (S-07) owns the logging conventions this change only has to respect.

## Open Questions

- **Where a new user lands after sign-up from a gated link** (decided in the plan, flagged for review): through `/onboarding` first, then to `next`, or straight to `next`.
- **Whether a signed-in visitor with a safe `?next=` on the auth page goes to `next` or to `/tonight`** (decided in the plan; the owner's wording says `/tonight`).
- **Email-confirmation accounts**: `next` can survive only to the confirm-email page's "back to sign in" link; the confirmation link in the email itself is Supabase's and carries no `next` (out of scope: password reset and emails are parked, FR-003).
