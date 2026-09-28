# Rolling 30-Day Session and Continue-After-Sign-In Implementation Plan

## Overview

Finish the account slice of M-1 (roadmap S-09, GitHub #5) without password reset. A user who is sent to sign-in from a page they asked for gets back to that exact page after signing in (PRD Access Control), and a signed-in session lasts until 30 days pass without use (PRD NFR session longevity). FR-003 password reset is cut to Parked by the user's decision of 2026-09-28, because Supabase's built-in email only reaches project team members. The PRD, roadmap and tech-stack documents are corrected to match.

## Current State Analysis

- `src/middleware.ts:36-40` redirects an anonymous request on a gated path to a bare `/auth/signin`. It drops the path and query the user asked for.
- `src/pages/api/auth/signin.ts:22` always redirects to `/tonight` on success. On failure it goes to `/auth/signin?error=<key>` (`:18`, and `:13` when Supabase is not configured).
- `src/pages/auth/signin.astro` passes only `serverError` and `locale` to `SignInForm` (`src/components/auth/SignInForm.tsx`), a plain HTML POST form to `/api/auth/signin`.
- Sessions: `src/lib/supabase.ts:23-39` builds the `@supabase/ssr` 0.12.7 server client and forwards `setAll` options to `cookies.set`. **The library ignores `cookieOptions.maxAge`.** `node_modules/@supabase/ssr/dist/main/cookies.js:228-231` and `:468-471` always write auth cookies with its own default (400 days), and removals with `maxAge: 0`. It only re-writes a cookie when its value changes, i.e. on sign-in and on token refresh. With `jwt_expiry = 3600` (`supabase/config.toml:158`), a refresh happens on the first request after the access token expires. So today's session already rolls, but over 400 days, not 30.
- The smoke script matches redirect `location` by prefix unless `exact` (`scripts/smoke.mjs`). "tonight redirects anonymous user" (`:64`) keeps passing when `?next=` is added. The sign-in → `/tonight` checks (`:79-94`) stay valid because `/tonight` remains the default.
- Docs that are now wrong: `context/foundation/tech-stack.md:28-30` claims Supabase covers password reset "without extra email setup". Supabase's docs say the built-in email service "will refuse to deliver messages to addresses that are not part of the project's team" (https://supabase.com/docs/guides/auth/auth-smtp). PRD FR-003 (`prd.md:163`) and the Access Control paragraph (`prd.md:430-434`), plus the roadmap's S-09 outcome, still promise reset. `CLAUDE.md` says "the middleware does not do this yet" about continuing to the requested page.

## Desired End State

- An anonymous GET of a gated page (for example `/log/new?object=31&night=2026-09-27`) redirects to `/auth/signin?next=%2Flog%2Fnew%3Fobject%3D31%26night%3D2026-09-27`. The sign-in card shows "Sign in to continue." ("Zaloguj się, aby kontynuować."), and after a correct sign-in the user lands on `/log/new?object=31&night=2026-09-27`.
- A wrong password keeps the `next` target through the error round trip.
- Signing in without a `next`, or with an unsafe one (another origin, `//evil.example`, `/api/...`, `/auth/...`), lands on `/tonight` as today.
- Every auth cookie Supabase sets is written with `Max-Age=2592000` (30 days). A token refresh re-writes it, so the 30 days count from the last refresh. Removals still use `Max-Age=0`. After 30 days without a visit the browser drops the cookie and the next gated request goes to sign-in.
- PRD, roadmap and tech-stack say FR-003 is parked and why. CLAUDE.md describes the redirect-continue and the 30-day cookie.

Verify: `npm test`, `npx astro check`, `npm run lint`, `npm run build`, `npm run smoke` and the e2e suite on a local preview backed by local Supabase.

### Key Discoveries:

- `@supabase/ssr` overrides `maxAge` for set and remove cookies (`cookies.js:228-231`, `:468-471`), so the lifetime must be enforced in our `setAll`, not via `cookieOptions`.
- `src/lib/supabase.ts` imports `astro:env/server`, so it cannot be unit-tested under the plain Vitest config. Pure logic goes in small island-free modules next to it, like `src/lib/protected-routes.ts` does for the middleware.
- Gated API routes (`/api/gear`, `/api/log`, `/api/onboarding`) are POST targets. A `next` pointing at them would GET a POST-only route, so only GET page requests carry `next`.
- Lessons: coordinates never go into URLs. `next` repeats a path the user already had in the address bar, and no gated page takes coordinates in its query (Tonight uses site ids), so nothing new is exposed. No lesson about per-user lists or the Tonight island applies.

## What We're NOT Doing

- FR-003 password reset (cut to Parked, user decision 2026-09-28; it needs custom SMTP and a redirect-URL allowlist in the hosted dashboard).
- Carrying `next` through sign-up. A new account always goes to onboarding first, and gated pages need a site anyway.
- Redirecting an already signed-in user away from `/auth/signin`.
- Keeping a `next` for gated POSTs (session expired while submitting a form). Those still go to plain sign-in, and the form input is lost as today.
- Server-side session caps (Supabase time-box or inactivity timeout). The cookie lifetime alone defines "30 days idle". Sign-out elsewhere is unchanged.
- Counting idleness to the minute: the window restarts on token refresh, which happens at most once per hour of use.

## Implementation Approach

Two phases, each test-first where there is behaviour. Phase 1 adds the continue-after-sign-in flow around one pure, unit-tested `safeNextPath` guard. Phase 2 enforces the 30-day cookie through a pure helper used in `setAll`, proves it end to end in the smoke test, and corrects the documents.

Delegated decisions (user chose "LOW, 2 questions"; the agent decided these, open to challenge in plan review):
- **`next` validation:** accept only a same-origin path. The string starts with `/` but not `//` or `/\`, has no control characters, and resolves (via `new URL(value, <dummy origin>)`) to the same origin. Keep pathname and query and drop any fragment. Reject anything under `/api/` or `/auth/`. Anything else counts as "no next".
- **Only GET requests to non-API gated paths get `next`.**
- **The query parameter is named `next`** and is carried through the failed-sign-in redirect, as a hidden form field.
- **The sign-up link on the sign-in page does not carry `next`** (see NOT doing).
- **The 30-day lifetime is a named constant** (`SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30`) applied to every non-removal cookie from `setAll`.

## Phase 1: Continue to the requested page after sign-in

### Overview

The middleware remembers what was asked for, sign-in honours it safely, and the sign-in page says why the user is there.

### Changes Required:

#### 1. Next-path guard

**File**: `src/lib/auth-redirect.ts` (new), `src/lib/auth-redirect.test.ts` (new)

**Intent**: One pure, island-safe place decides whether a `next` value is a safe place to send a user after sign-in, and builds the sign-in URL for a requested page.

**Contract**: `safeNextPath(value: unknown): string | null` returns the **parsed** URL's `pathname + search` (normalised by `new URL`, never the raw input string) for a safe same-origin target, otherwise `null`. `signInUrl(next?: string | null): string` returns `/auth/signin`, or `/auth/signin?next=<encoded>` when `next` is safe. Tests cover: a plain path, a path with a query (kept), a fragment (dropped), `null`/`""`/non-strings, `//evil.example`, `/\evil.example`, `https://evil.example/x`, `javascript:` values, `/api/log`, `/auth/signin`, percent-encoded variants (`/%2F%2Fevil.example` stays a same-origin path), and encoded round trips through `signInUrl`.

#### 2. Middleware

**File**: `src/middleware.ts`

**Intent**: An anonymous GET of a gated, non-API path redirects with the requested path and query as `next`. Other gated requests redirect to plain sign-in as today.

**Contract**: the redirect at `middleware.ts:38` becomes `signInUrl(...)` for `GET` requests whose path is not under `/api/`. `isProtectedPath` is unchanged.

#### 3. Sign-in route

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Read `next` from the form. On success go to `safeNextPath(next) ?? "/tonight"`. On failure and on "not configured", redirect back to sign-in with the error key and the same safe `next`.

**Contract**: success `302 Location: <safe next or /tonight>`; failure `302 Location: /auth/signin?error=<key>[&next=<encoded>]`. Error values stay message keys (CLAUDE.md error-response tripwire).

#### 4. Sign-in page, form and copy

**File**: `src/pages/auth/signin.astro`, `src/components/auth/SignInForm.tsx`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: The page validates `?next=` with `safeNextPath` and passes it to the form, which posts it back in a hidden `next` field. When a safe `next` is present, one line above the form reads "Sign in to continue." / "Zaloguj się, aby kontynuować.".

**Contract**: `SignInForm` gains an optional `next?: string | null` prop rendered as `<input type="hidden" name="next">`. New key `auth.signIn.continueNote` in both catalogues. Token colours only (`text-muted-foreground`).

#### 5. Smoke and e2e

**File**: `scripts/smoke.mjs`, `tests/e2e/sign-in-continue.spec.ts` (new)

**Intent**: Pin the new redirects over HTTP and prove the full browser flow once.

**Contract**:
- Smoke: "tonight redirects anonymous user" becomes `exact` `/auth/signin?next=%2Ftonight`.
- Smoke: a new step signs in with `next=/gear` and expects exact `/gear`.
- Smoke: a new step signs in with `next=//evil.example` and expects exact `/tonight`.
- E2E: sign up and onboard one user (`onboardInMadrid`), sign out, then open `/log`. Expect sign-in with the continue note visible, then sign in and expect to land on `/log`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including `auth-redirect.test.ts`: `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- Smoke test passes against a local preview on local Supabase: `BASE_URL=http://localhost:4321 npm run smoke`
- The sign-in-continue e2e spec passes: `BASE_URL=http://localhost:4321 npx playwright test sign-in-continue`

#### Manual Verification:

- Signed out, opening `/log/new?object=31&night=<a date>` in a browser leads to sign-in with the note (EN and PL). A wrong password keeps the note and the target, and a correct one lands on the ranked-object log form with its prefill.
- Opening `/auth/signin` directly shows no note, and sign-in lands on `/tonight`.
- Hand-edited `?next=//evil.example` and `?next=/api/log` show no note and land on `/tonight`.

**Implementation Note**: After completing this phase and all automated verification passes, run the manual checks yourself (local preview on local Supabase plus Playwright, per the user's standing instruction) and record the evidence before proceeding.

---

## Phase 2: 30-day idle session and document corrections

### Overview

The auth cookie lives exactly 30 days from the last refresh, and the documents stop promising password reset.

### Changes Required:

#### 1. Session cookie lifetime

**File**: `src/lib/session-cookie.ts` (new), `src/lib/session-cookie.test.ts` (new), `src/lib/supabase.ts`

**Intent**: Every auth cookie Supabase asks us to set lives 30 days, and removals stay removals. The library overrides `maxAge` itself, so the override happens in our `setAll`.

**Contract**: `SESSION_MAX_AGE_SECONDS = 2592000`. `withSessionMaxAge(options)` returns the options with `maxAge: SESSION_MAX_AGE_SECONDS`, unless `options.maxAge === 0`, which is kept at 0. `supabase.ts` `setAll` passes `withSessionMaxAge(options)` to `cookies.set`. The comment at the call site cites `@supabase/ssr` forcing its own default. Tests: a set cookie gets 30 days; a removal (`maxAge: 0`) keeps 0; other options (`path`, `sameSite`, `httpOnly`, `secure`) are untouched.

#### 2. Smoke assertion

**File**: `scripts/smoke.mjs`

**Intent**: Prove the lifetime end to end: the successful sign-in response sets the `sb-…-auth-token` cookie with `Max-Age=2592000`.

**Contract**: the request helper also returns the raw `Set-Cookie` values. The "signin accepts correct password" step (or a new one right after) asserts at least one `sb-` auth cookie carries `Max-Age=2592000` and none of them carries a larger value.

#### 3. PRD, roadmap, tech-stack, CLAUDE.md

**File**: `context/foundation/prd.md`, `context/foundation/roadmap.md`, `context/foundation/tech-stack.md`, `CLAUDE.md`

**Intent**: Record the FR-003 cut where each document tracks such things, and describe the new behaviour for future agents.

**Contract**:
- PRD: under FR-003, a dated resolution note (the same "> …" style as the Socrates notes) saying the provider condition failed and FR-003 moved to Parked (cut-order #3 applied). The Access Control paragraph says reset is not in the MVP and why. The NFR session-longevity bullet mentions 30 days since last use.
- Roadmap: the S-09 Outcome drops the reset clause. Its Risk line records the cut. `## Parked` gains "FR-003 password reset" with the reason and what reviving it needs (custom SMTP, redirect-URL allowlist, reset screens).
- tech-stack.md lines 28-30: correct the claim, citing the Supabase SMTP docs.
- CLAUDE.md: the Request-flow paragraph says the middleware adds `?next=` (validated by `src/lib/auth-redirect.ts`). `src/lib/supabase.ts` is noted as enforcing the 30-day cookie via `src/lib/session-cookie.ts`, because `@supabase/ssr` ignores `cookieOptions.maxAge`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including `session-cookie.test.ts`: `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- Smoke test passes, including the `Max-Age=2592000` assertion: `BASE_URL=http://localhost:4321 npm run smoke`
- Full e2e suite passes: `BASE_URL=http://localhost:4321 npm run test:e2e`

#### Manual Verification:

- In a browser on the local preview, after sign-in the `sb-…-auth-token` cookie's expiry is 30 days out (DevTools / Playwright `context.cookies()`), and sign-out removes it.
- Simulated idle expiry: deleting the auth cookie (as the browser would after 30 days) and opening `/tonight` leads to sign-in with the continue note, and signing in returns to `/tonight`.
- PRD, roadmap and tech-stack read consistently: nothing still promises password reset in M-1.

**Implementation Note**: After completing this phase and all automated verification passes, run the manual checks yourself and record the evidence.

---

## Testing Strategy

### Unit Tests:

- `safeNextPath` / `signInUrl`: accepted shapes, the open-redirect shapes listed in Phase 1, `/api/` and `/auth/` rejection, query kept, fragment dropped.
- `withSessionMaxAge`: 30 days on set, 0 kept on removal, other options untouched.

### Integration Tests:

- Smoke: exact `?next=` on the anonymous redirect, sign-in honouring a safe `next` and ignoring an unsafe one, `Max-Age=2592000` on the auth cookie.
- E2E `sign-in-continue.spec.ts`: signed-out visit to `/log` → note → sign in → `/log`.

### Manual Testing Steps:

1. Local preview on local Supabase. Sign up, onboard, sign out.
2. Open `/log/new?object=31&night=<date>`, check the note in EN and PL, try a wrong then the right password, and land on the prefilled form.
3. Check the auth cookie's expiry after sign-in and after a refresh.
4. Try unsafe `next` values by hand.

## Performance Considerations

None: one string check per redirect, and one option merge per cookie write.

## Migration Notes

Existing sessions keep their 400-day cookie until the next token refresh re-writes it with 30 days; after that everyone is on the new lifetime. No database change.

## References

- Change notes and the FR-003 decision: `context/changes/account-reset-and-long-session/change.md`
- PRD: FR-001 to FR-003, NFR session longevity, Access Control (`context/foundation/prd.md`)
- Roadmap S-09 (`context/foundation/roadmap.md`), GitHub #5
- Supabase SMTP limits: https://supabase.com/docs/guides/auth/auth-smtp
- `@supabase/ssr` cookie writes: `node_modules/@supabase/ssr/dist/main/cookies.js:222-231`, `:461-471`
- Similar pure helper beside the middleware: `src/lib/protected-routes.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Continue to the requested page after sign-in

#### Automated

- [x] 1.1 Unit tests pass, including `auth-redirect.test.ts` — 00c51aa
- [x] 1.2 Type check passes — 00c51aa
- [x] 1.3 Lint passes — 00c51aa
- [x] 1.4 Production build succeeds — 00c51aa
- [x] 1.5 Smoke test passes against a local preview on local Supabase — 00c51aa
- [x] 1.6 The sign-in-continue e2e spec passes — 00c51aa

#### Manual

- [x] 1.7 Signed-out deep link to the log form → note (EN/PL) → wrong then right password → prefilled form — 00c51aa
- [x] 1.8 Direct sign-in shows no note and lands on `/tonight` — 00c51aa
- [x] 1.9 Unsafe `next` values show no note and land on `/tonight` — 00c51aa

### Phase 2: 30-day idle session and document corrections

#### Automated

- [x] 2.1 Unit tests pass, including `session-cookie.test.ts`
- [x] 2.2 Type check passes
- [x] 2.3 Lint passes
- [x] 2.4 Production build succeeds
- [x] 2.5 Smoke test passes, including the `Max-Age=2592000` assertion
- [x] 2.6 Full e2e suite passes

#### Manual

- [x] 2.7 Auth cookie expires 30 days out after sign-in, and sign-out removes it
- [x] 2.8 Simulated idle expiry leads to sign-in with the note and back to `/tonight`
- [x] 2.9 PRD, roadmap and tech-stack no longer promise password reset in M-1
