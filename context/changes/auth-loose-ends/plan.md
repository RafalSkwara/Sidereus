# Auth Loose Ends (M-4 S-06) Implementation Plan

## Overview

M-4 S-06 (roadmap, GitHub #174; ui-auth D1 and D2; PRD Access Control: "continues to the requested page afterwards"). Two behaviours the ui-auth pass deliberately left alone:

- **D1.** A signed-in visitor who opens `/auth/signin` or `/auth/signup` leaves the page at once: to the safe `?next=` when there is one, else to `/tonight`.
- **D2.** A visitor who signs up from a gated link continues to that page afterwards, the way sign-in does. A brand-new user has no gear, so the order is onboarding first, then `next`.

`safeNextPath` stays the one rule for a safe `next`. The service worker's purge on `POST /api/auth/signin` and `/api/auth/signup` is untouched and must keep working. Tests are modest and feature-level (the test-diet rubric: no implementation-detail unit tests).

## Current State Analysis

Re-verified against `origin/main` e563fda (after S-07's logging conventions and the test diet); the research (`research.md`) still holds. Places are named by symbol, not line, because line numbers drift.

- **D1.** The middleware resolves `context.locals.user` and redirects only gated paths (the `isProtectedPath` branch of `onRequest` in `src/middleware.ts`). `/auth/signin` and `/auth/signup` are not gated, so they render for a signed-in user.
- **D2 loses `next` in four places.** (1) The sign-in page's "Sign up" link is a bare `/auth/signup` (`signin.astro`, the `signUpLink` anchor). (2) `signup.astro` and `SignUpForm.tsx` know no `next`. (3) `POST /api/auth/signup` sends the user to `/onboarding` or `/auth/confirm-email` (its final `context.redirect`) and, on failure, to `/auth/signup?error=` without `next`. (4) `/onboarding` ends in a fixed `/tonight` (the last `context.redirect` of `src/pages/api/onboarding.ts`; the page's "already onboarded" redirect is the `hasAnyGear` branch of `onboarding.astro`).
- **Why onboarding comes first.** `/onboarding` is the only automatic first-run setup; the other gated pages render for a user with no gear (`/gear` empty states, Tonight's prompt). Landing a new user straight on `next` would skip it.
- **Hosted vs local.** Local Supabase has email confirmation off (sign-up starts a session, goes to `/onboarding`); the hosted project redirects to `/auth/confirm-email`, whose "back to sign in" link is a bare `/auth/signin`.
- **Service worker.** Purge triggers are the pathnames in `AUTH_POSTS` (`src/sw.ts`, with its route handler) and an `opaqueredirect` on a Tonight navigation (`afterNavigation`); neither reads the `Location` a route returns. D1's redirect starts from a `GET /auth/*`, which is not a Tonight navigation.
- **Tests as they stand.** `src/lib/auth-redirect.test.ts` pins `safeNextPath`. The test diet moved `sign-in-continue.spec.ts` into `scripts/smoke.mjs` (steps for the redirect with `next`, the sign-in page's hidden `next`, `signin continues to the requested page`, `signin ignores an off-site next`). e2e specs import `test` from `tests/e2e/helpers.ts` (pinned clock); helper `signUp` expects `/onboarding$`.
- **Logging.** S-07's `logFailure` and `logAuthFailure` already cover the sign-up failure branches; `user_already_exists` is a user mistake with no line (`USER_MISTAKE_CODES` in `api-errors.ts`).

## Desired End State

- Signed in, `GET /auth/signin` and `GET /auth/signup` answer `302`: to `safeNextPath(?next)` when it is safe, else `/tonight`. Signed out, both pages render as today. `/auth/confirm-email` is unchanged.
- From a gated link: `/log` → `/auth/signin?next=%2Flog` → "Sign up" link `/auth/signup?next=%2Flog` → sign-up form posts a hidden `next` → `/onboarding?next=%2Flog` → onboarding saves → `/log`. A user who already has gear opening `/onboarding?next=…` goes to `next` (else `/tonight`).
- Hosted (confirmation on): sign-up with a safe `next` goes to `/auth/confirm-email?next=…`, whose "back to sign in" link is `signInUrl(next)`. The confirmation link in the email stays Supabase's and carries no `next` (parked with password reset, FR-003).
- Every new reader of `next` goes through `safeNextPath`; an unsafe value is ignored, never forwarded, never logged. A failure redirect keeps a safe `next`, as sign-in does. `?error=` values stay fixed keys.
- Verified by smoke steps with exact `Location`s (D1 included), one e2e journey through the service worker, and a manual purge check.

### Key Discoveries:

- `safeNextPath` refuses `/auth*` and `/api*`, so D1's redirect target can never be an auth page: no redirect loop is possible (`safeNextPath` in `src/lib/auth-redirect.ts`).
- `OnboardingWizard` posts to the `action` prop's URL with hidden inputs, one per schema field (the hidden inputs in `OnboardingWizard.tsx`'s `<form action={action}>`). A `?next=` on the action URL reaches the POST route as a query parameter without touching the island; browsers keep a form action's query on `POST`.
- `src/pages/api/auth/signin.ts` is the model: read `next` through `safeNextPath`, keep it on every failure redirect via `URLSearchParams`, land on `next ?? "/tonight"`.
- `signInUrl(next)` already builds the sign-in URL with an encoded `next`; sign-up, onboarding and confirm-email need the same one-liner, so it becomes one shared `withNext`.
- Existing e2e specs call `signUp`, which expects exactly `/onboarding$`; a sign-up without `next` must keep landing on bare `/onboarding`.

## What We're NOT Doing

- No `next` in the Supabase confirmation email (password reset and emails are parked, FR-003).
- No D1 redirect for `/auth/confirm-email` (the D1 wording names sign-in and sign-up only).
- No change to `src/sw.ts`, `AUTH_POSTS`, the purge rules or `safeNextPath` itself.
- No new log step: an unsafe `next` is ignored, so no new failure branch exists (S-07 conventions stay as they are).
- No new strings, unless the owner answers the question below with yes.
- No unit tests of implementation detail: no test of the middleware branch, `withNext` or the new route branches by mocks (the diet rubric); HTTP smoke steps and one browser journey hold the behaviour.
- No change to the database, RLS or `PROTECTED_ROUTES`.

## QUESTION FOR OWNER (Polish)

**Czy na stronie rejestracji pokazać krótką notkę, gdy ktoś trafia na nią z zamkniętego linku?** Na stronie logowania taka notka już jest („Zaloguj się, aby kontynuować."), pokazywana, gdy w adresie jest bezpieczne `?next=`. Odpowiednik na rejestracji brzmiałby „Załóż konto, aby kontynuować." (EN: "Sign up to continue."), ten sam odrzucalny `Notice` w tonie informacyjnym.

- **Domyślnie: nie.** Osoba, która kliknęła „Załóż konto" na stronie logowania, widziała notkę o jeden ekran wcześniej, a rejestracja i tak kończy się onboardingiem, więc dodatkowy tekst niewiele wyjaśnia.
- **Jeśli tak:** dodatkowy klucz `auth.signUp.continueNote` w `en.ts` i `pl.ts` (test parytetu kluczy go obejmie), render w `signup.astro` pod tym samym warunkiem co na logowaniu, jedna asercja tekstu w teście e2e z Fazy 3. Reszta planu się nie zmienia.

Plan jest kompletny bez odpowiedzi (wykonuje się wariant domyślny).

## Implementation Approach

Three phases, one PR (commits per phase; no stacked PRs, the owner merges). D1 first because it is independent and the smoke steps for it can run on the signed-in session the script already holds. D2 second, as one coherent path (page → form → route → onboarding). The browser journey and the docs come last, because the journey needs both.

One shared helper does the work: `withNext(path, next)` in `src/lib/auth-redirect.ts` appends `?next=<encodeURIComponent(safeNextPath(next))>` or returns the bare path; `signInUrl` becomes a thin call to it. Routes that already build `?error=` plus `next` use `URLSearchParams`, as `signin.ts` does.

## Phase 1: Signed-in visitors leave the auth pages (D1)

### Overview

The middleware redirects a signed-in `GET` of `/auth/signin` or `/auth/signup` to the safe `next` or `/tonight`. Smoke steps prove it over HTTP.

### Changes Required:

#### 1. The auth entry paths

**File**: `src/lib/auth-redirect.ts`

**Intent**: Name the two pages a signed-in visitor must not see, next to the rule for `next`, so the middleware and any later reader share one definition. Pure and island-safe like the rest of the file.

**Contract**: `isAuthEntryPath(pathname: string): boolean`, true for `/auth/signin` and `/auth/signup`, tolerating one trailing slash (Astro's `trailingSlash` is `ignore`, so both spellings render). Not true for `/auth/confirm-email`.

#### 2. The redirect

**File**: `src/middleware.ts`

**Intent**: Right after `context.locals.user` is resolved and before `next()`, send a signed-in `GET` of an auth entry path away. The destination is `safeNextPath(url.searchParams.get("next")) ?? "/tonight"` with a plain `context.redirect` (302, like every redirect here).

**Contract**: only `request.method === "GET"`; only when `locals.user` is set (a stale cookie already resolves to `null`, so it still sees the page); no new log line; no change to the gated-path branch. The target can never be an auth page (`safeNextPath` refuses `/auth*`), so there is no loop.

#### 3. Smoke steps

**File**: `scripts/smoke.mjs`

**Intent**: Prove the redirect and its refusal of an unsafe `next` over HTTP. The script already holds a signed-in session after `signin accepts correct password`, so the steps go right after `signin ignores an off-site next`; each fails loudly, with an exact `Location`.

**Contract**: three steps (the risk each is the only protection of: a signed-in user stuck on an auth page; `next` honoured there; an open redirect through the new reader): `GET /auth/signin` → `/tonight`; `GET /auth/signup?next=%2Fgear` → `/gear`; `GET /auth/signin?next=%2F%2Fevil.example` → `/tonight`. The signed-out render of both pages stays covered by the existing step `the sign-in page carries the page to continue to in its form` and the home page's links.

### Success Criteria:

#### Automated Verification:

- Type check and lint pass: `npx astro check` and `npm run lint`
- Unit suites pass: `npm test`
- The three D1 smoke steps and the rest of the walk pass against a local production preview: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=http://localhost:4339 npm run smoke`

#### Manual Verification:

- Signed in, in a browser, opening `/auth/signin` and `/auth/signup` lands on Tonight; with `?next=%2Fgear` on Gear; with `?next=%2F%2Fevil.example` on Tonight
- Signed out, both pages render, and `/log` still redirects to `/auth/signin?next=%2Flog`

**Implementation Note**: After this phase and its automated verification pass, pause for the manual confirmation before Phase 2. Checkboxes for these items live in `## Progress`.

---

## Phase 2: Sign-up continues to the requested page (D2)

### Overview

`next` rides from the sign-in page's link through sign-up and onboarding to its destination, and survives the confirm-email page on the hosted project. Every reader uses `safeNextPath`.

### Changes Required:

#### 1. One helper for "this path, carrying `next`"

**File**: `src/lib/auth-redirect.ts`

**Intent**: Replace the three ways to spell `?next=` that D2 would otherwise add with one function; `signInUrl` calls it.

**Contract**: `withNext(path: string, next?: string | null): string` returns `path` plus `?next=<encodeURIComponent(safeNextPath(next))>` when `next` is safe, else `path` unchanged. `signInUrl(next)` keeps its signature and output (`/auth/signin?next=…`); the existing middleware and smoke expectations must not change.

#### 2. The two pages and the form

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/components/auth/SignUpForm.tsx`

**Intent**: The sign-in page's "Sign up" link carries the page's safe `next`; the sign-up page reads `?next=` through `safeNextPath`, hands it to the form, and its "Sign in" link carries it back. The form posts it as a hidden `next` only when there is one, mirroring `SignInForm`'s hidden `next`.

**Contract**: `SignUpForm` gains an optional `next?: string | null` prop (already checked by `safeNextPath`) and renders `<input type="hidden" name="next">` only when set. Links use `withNext("/auth/signup", next)` and `signInUrl(next)`. No visible copy changes (no new keys).

#### 3. The sign-up route

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Read the hidden `next` through `safeNextPath`, keep it on every failure redirect (as `signin.ts` does with `URLSearchParams`), and carry it past the first-run step.

**Contract**: failures redirect to `/auth/signup?error=<key>[&next=<path>]`; success with a session to `withNext("/onboarding", next)`; success without a session to `withNext("/auth/confirm-email", next)`. A missing or unsafe `next` gives exactly today's URLs (`/onboarding`, `/auth/confirm-email`, `/auth/signup?error=<key>`). The route's comment block keeps its promise: `?error=` is a key, Supabase's `error.message` is never forwarded, no email in any line.

#### 4. The confirm-email page (hosted flow)

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Read `?next=` through `safeNextPath` and point "back to sign in" at `signInUrl(next)`, so the hosted project, where confirmation is on, keeps `next` as far as this app can.

**Contract**: the link's `href` is `signInUrl(next)`; with no safe `next` it is `/auth/signin` as today.

#### 5. Onboarding page and route

**Files**: `src/pages/onboarding.astro`, `src/pages/api/onboarding.ts`

**Intent**: The page reads `?next=` through `safeNextPath`; an already-onboarded user is sent to `next ?? "/tonight"`; the wizard's `action` becomes `withNext("/api/onboarding", next)`, so the POST receives it as a query parameter and `OnboardingWizard` stays untouched. The route reads `next` from `context.url.searchParams` through `safeNextPath`, keeps it on its failure redirects, and on success (a fresh save, or "already has gear", which the route treats as success) redirects to `next ?? "/tonight"`.

**Contract**: failure redirects are `/onboarding?error=<key>[&next=<path>]` (the `fail` helper builds them with `URLSearchParams`); no submitted field value ever reaches a URL (unchanged rule, `issueKey` / `saveFailureKey`). Without `next` every redirect is byte-identical to today's, so `onboarding.spec.ts` and the smoke steps that do not pass `next` stay as they are.

#### 6. Smoke steps

**File**: `scripts/smoke.mjs`

**Intent**: Prove each hop of the path and the refusal of an unsafe `next` over HTTP, with exact `Location`s. The walk's own sign-up becomes the carrying one, so the later onboarding steps run on the same account.

**Contract** (risk each is the only protection of: `next` lost on the way; a sign-up or onboarding redirect to a foreign origin; a user landing past first-run setup):
- the sign-in page's sign-up link and the sign-up page's hidden field carry `next` (`bodyIncludes`: `href="/auth/signup?next=%2Flog"` on `/auth/signin?next=%2Flog`; `name="next" value="/log"` on `/auth/signup?next=%2Flog`). These two are signed-out page renders, so they sit next to `the sign-in page carries the page to continue to in its form`, before `signup creates account`: after the walk signs up, Phase 1's redirect answers both pages with a 302;
- `signup creates account` posts `next: "/gear"` and expects exactly `/onboarding?next=%2Fgear`; the existing no-`next` sign-up case stays covered by the e2e `signUp` helper (it expects bare `/onboarding`);
- `/onboarding?next=%2Fgear` renders its form with `action="/api/onboarding?next=%2Fgear"` (`bodyIncludes`);
- one invalid onboarding post to `/api/onboarding?next=%2Fgear` returns to `/onboarding?error=<key>&next=%2Fgear`; `onboarding saves and opens tonight` posts to the same URL and expects `/gear`;
- `GET /onboarding?next=%2Fgear` once set up expects `/gear` (the existing plain `onboarding redirects once set up` → `/tonight` stays);
- a second sign-up with the account's own email (a user mistake, the failure branch, no log line) keeps a safe `next` (`/auth/signup?error=errors.auth.userExists&next=%2Fgear`) and drops an off-site one (`next: "//evil.example"` → `/auth/signup?error=errors.auth.userExists`), both with `exact: true`. These two go after the account exists and may stay signed in: a failed `signUp` keeps the session.

### Success Criteria:

#### Automated Verification:

- Type check and lint pass: `npx astro check` and `npm run lint`
- Unit suites pass, `src/lib/auth-redirect.test.ts` unchanged: `npm test`
- The D2 smoke steps and the whole walk pass against a local production preview: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=http://localhost:4339 npm run smoke`

#### Manual Verification:

- In a browser, signed out: open `/log`, take the "Sign up" link, sign up, finish onboarding, and land on `/log`
- The same journey in Polish (language cookie `pl`) shows no English text on the way and lands on the page asked for
- A sign-up straight from `/auth/signup` (no `next`) still goes to `/onboarding` and ends on Tonight
- The sign-up page's "Sign in" link keeps `next`; opening `/auth/confirm-email?next=%2Flog` shows a "back to sign in" link to `/auth/signin?next=%2Flog`

**Implementation Note**: After this phase and its automated verification pass, pause for the manual confirmation before Phase 3.

---

## Phase 3: The journey in the browser, the worker check and the docs

### Overview

One e2e test walks the whole path through the production preview, with the service worker registered, then the purge is checked by hand. The docs say what the code now does.

### Changes Required:

#### 1. Helpers

**File**: `tests/e2e/helpers.ts`

**Intent**: Let the new spec reuse the form-filling and onboarding steps that `signUp` and `onboardInMadrid` already contain, without changing what they do for the specs that call them today.

**Contract**: split out the sign-up form fill (fields and submit, no navigation and no URL assertion) and the Madrid onboarding completion as exported functions that `signUp` / `onboardInMadrid` call; their signatures, return values and the `/onboarding$` assertion stay as they are. The extracted completion helper finds the form by prefix, `form[action^="/api/onboarding"]`, because in the journey the action is `/api/onboarding?next=%2Flog`; `ONBOARDING_FORM` (exact `form[action="/api/onboarding"]`) stays for `signUp`, which expects bare `/onboarding`, and for `onboarding.spec.ts`.

#### 2. The journey spec

**File**: `tests/e2e/auth-continue.spec.ts` (new)

**Intent**: Pin, in a real browser with the service worker active, what no smoke step can: the click from the sign-in page to sign-up carries `next`, the form submit works through the worker's `POST /api/auth/signup` route, onboarding finishes, and the user lands on the page they asked for. The signed-in half of D1 is plain HTTP and stays in Phase 1's smoke steps (test-plan §6.5 sends redirects there).

**Contract**: imports `test` from `./helpers` (the pinned clock; no `waitForTimeout`, no real-clock read; the e2e clock guard checks it). One test: signed out, `goto("/log")` → expect sign-in with `next` → `waitForServiceWorker(page)` (so the sign-up POST really goes through the worker's route, not straight to the network) → click the "Sign up" link → fill the form → onboarding with `next` → complete onboarding → expect `/log`. A fresh user (the helper's UUID email); no skips. No current caller of `waitForServiceWorker` runs on the pinned clock: if pinning conflicts with `navigator.serviceWorker.ready`, the spec uses `test.use({ clock: "real" })` with a reason comment (the journey reads no date), which the clock guard allows.

#### 3. Docs

**Files**: `CLAUDE.md` (sidereus, "Request flow" paragraph), `context/foundation/test-plan.md` (the e2e count in the stack table and wherever the smoke or e2e counts are named)

**Intent**: Say that the middleware also redirects a signed-in visitor off the two auth entry pages, that sign-up and onboarding carry `next` through `withNext`, and that `safeNextPath` is still the only rule. Update the e2e spec and test counts that name the old numbers.

**Contract**: prose only; no tripwire is added or removed.

### Success Criteria:

#### Automated Verification:

- The new spec passes on its own: `BASE_URL=http://localhost:4339 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test auth-continue`
- The whole e2e suite passes against a fresh `npm run build` and a local production preview (started with `FORECAST_BASE_URL` pointing at the forecast fixture on 4407), as CI runs it, with the counts reported: `BASE_URL=http://localhost:4339 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run test:e2e`
- The full smoke walk passes: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=http://localhost:4339 npm run smoke`
- Lint, type check and both Vitest projects (including the `guards` project, with the e2e clock guard) pass: `npm run lint && npx astro check && npm test`

#### Manual Verification:

- Service worker purge still works: in a production preview with the worker active, sign in, open Tonight so a copy is stored, delete only the auth cookie in DevTools (the copy stays), sign up a new account from `/auth/signup`, and `/offline` lists no stored page
- The docs read correctly: the new `CLAUDE.md` sentence and the test counts match what the diff added

---

## Testing Strategy

The test-diet rubric applies: each test names the risk it alone protects. The change adds no unit test.

### Unit Tests:

- None added. `src/lib/auth-redirect.test.ts` keeps pinning `safeNextPath`, the one rule; `withNext` and `isAuthEntryPath` are exercised through HTTP (a unit test of them would restate their code).

### Integration Tests (smoke, over HTTP):

- D1: signed-in `GET /auth/signin` and `/auth/signup?next=…` redirect to Tonight or the safe `next`; an off-site `next` is ignored.
- D2: the link and form carry `next`; sign-up goes to `/onboarding?next=…`; the form action carries it; a failed onboarding keeps it; a finished onboarding and an already-onboarded user land on it; a failed sign-up keeps a safe `next` and drops an off-site one.

### End-to-end (one journey, browser plus service worker):

- `/log` → sign-in → sign-up → onboarding → `/log`, through the worker. One spec, one test: the signed-in redirect is HTTP and stays in smoke.

### Manual Testing Steps:

1. The Phase 1 and Phase 2 manual items above, in English and Polish.
2. The service worker purge check (Phase 3).
3. Hosted project, after the merge deploys (confirmation on): from a gated link, sign up and confirm in the email; expect the confirm-email page's "back to sign in" link to keep `next` (the email's own link will not).

## Performance Considerations

None. One string comparison per request before `next()`; no query, no allocation worth measuring. The account plan is still never read in the middleware.

## Migration Notes

None: no schema, no data, no environment change. Rollback is reverting the PR; no URL shape the app emitted before changes (every redirect without `next` is byte-identical).

## References

- Related research: `context/changes/auth-loose-ends/research.md`
- Model to follow: `src/pages/api/auth/signin.ts`, `safeNextPath` in `src/lib/auth-redirect.ts`
- Origin of D1 and D2: `context/archive/2026-10-05-ui-auth/research.md` (D1, D2), `plan.md` (the exclusion)
- Logging conventions (unchanged here): `src/lib/observability/log-failure.ts`, `logAuthFailure` in `src/lib/api-errors.ts`
- Test conventions: `context/foundation/lessons.md` ("An e2e test never reads the real clock", "Name the risk a test is the only protection of", "Run the whole e2e suite before a PR")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Signed-in visitors leave the auth pages (D1)

#### Automated

- [ ] 1.1 Type check and lint pass: `npx astro check` and `npm run lint`
- [ ] 1.2 Unit suites pass: `npm test`
- [ ] 1.3 The three D1 smoke steps and the rest of the walk pass against a local production preview: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=http://localhost:4339 npm run smoke`

#### Manual

- [ ] 1.4 Signed in, in a browser, opening `/auth/signin` and `/auth/signup` lands on Tonight; with `?next=%2Fgear` on Gear; with `?next=%2F%2Fevil.example` on Tonight
- [ ] 1.5 Signed out, both pages render, and `/log` still redirects to `/auth/signin?next=%2Flog`

### Phase 2: Sign-up continues to the requested page (D2)

#### Automated

- [ ] 2.1 Type check and lint pass: `npx astro check` and `npm run lint`
- [ ] 2.2 Unit suites pass, `src/lib/auth-redirect.test.ts` unchanged: `npm test`
- [ ] 2.3 The D2 smoke steps and the whole walk pass against a local production preview: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=http://localhost:4339 npm run smoke`

#### Manual

- [ ] 2.4 In a browser, signed out: open `/log`, take the "Sign up" link, sign up, finish onboarding, and land on `/log`
- [ ] 2.5 The same journey in Polish (language cookie `pl`) shows no English text on the way and lands on the page asked for
- [ ] 2.6 A sign-up straight from `/auth/signup` (no `next`) still goes to `/onboarding` and ends on Tonight
- [ ] 2.7 The sign-up page's "Sign in" link keeps `next`; opening `/auth/confirm-email?next=%2Flog` shows a "back to sign in" link to `/auth/signin?next=%2Flog`

### Phase 3: The journey in the browser, the worker check and the docs

#### Automated

- [ ] 3.1 The new spec passes on its own: `BASE_URL=http://localhost:4339 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npx playwright test auth-continue`
- [ ] 3.2 The whole e2e suite passes against a fresh `npm run build` and a local production preview (started with `FORECAST_BASE_URL` pointing at the forecast fixture on 4407), as CI runs it, with the counts reported: `BASE_URL=http://localhost:4339 SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run test:e2e`
- [ ] 3.3 The full smoke walk passes: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=http://localhost:4339 npm run smoke`
- [ ] 3.4 Lint, type check and both Vitest projects (including the `guards` project, with the e2e clock guard) pass: `npm run lint && npx astro check && npm test`

#### Manual

- [ ] 3.5 Service worker purge still works: in a production preview with the worker active, sign in, open Tonight so a copy is stored, delete only the auth cookie in DevTools (the copy stays), sign up a new account from `/auth/signup`, and `/offline` lists no stored page
- [ ] 3.6 The docs read correctly: the new `CLAUDE.md` sentence and the test counts match what the diff added
