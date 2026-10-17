<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Auth Loose Ends (M-4 S-06)

- **Plan**: `context/changes/auth-loose-ends/plan.md` (+ `plan-brief.md`, `research.md`)
- **Date**: 2026-10-17
- **Reviewer**: herdr agent `reviewer` (Opus, medium)
- **Branch / base**: `feat/auth-loose-ends` 733fb35, based on `origin/main` e563fda (verified with `git merge-base --is-ancestor`)
- **Phases**: 3 · **Progress**: no `- [x]` rows, so this is a review before implementation
- **Findings**: 0 critical · 3 warnings · 3 observations
- **Overall**: **NEEDS ATTENTION**. The design is sound. The three warnings are test mechanics that would fail or prove nothing as written, and each needs only a one-line plan edit. Nothing needs re-planning.

`change.md` was not touched, because the orchestrator limited this run to writing this file. Its status stays `planned`. Flip it to `plan_reviewed` after triage.

## Verdicts

| Dimension        | Verdict    | Findings |
| ---------------- | ---------- | -------- |
| Claim Accuracy   | WARNING ⚠️ | F2, F6   |
| Substance        | PASS ✅    |          |
| Feasibility      | PASS ✅    |          |
| Sequencing       | PASS ✅    |          |
| Architecture Fit | PASS ✅    |          |
| Scope Discipline | PASS ✅    |          |
| Verifiability    | WARNING ⚠️ | F1, F3, F5 |
| Coverage         | PASS ✅    | (F4 is about test-diet fit) |

## What was checked and holds

- **Open-redirect safety.** Every new reader goes through `safeNextPath` (`src/lib/auth-redirect.ts:21-36`): the D1 middleware branch, `signup.astro`, `POST /api/auth/signup`, `confirm-email.astro`, `onboarding.astro` and `POST /api/onboarding`. `withNext` encodes the normalised value and never the raw input, so `safeNextPath` stays the one rule. D1 cannot loop, because `REFUSED_PREFIXES` covers `/auth` (`:11`, `:34`). A `next=/onboarding` is also finite: an onboarded user ends on `/tonight` (`onboarding.astro:25-27`).
- **Onboarding before `next`.** This is correct and backed by the research: `/onboarding` is the only automatic first-run setup. `OnboardingWizard` posts to its `action` prop (`OnboardingWizard.tsx:50,146,479`), so a query on the action URL reaches the route and the island stays untouched. `/onboarding` and `/api/onboarding` are both gated (`protected-routes.ts:11-12`). Because the sign-up has just started the session, the query is never lost to a sign-in bounce.
- **Service worker purge.** This is unaffected. `AUTH_POSTS` matches on pathname only (`src/sw.ts:64`, `:743`), and `src/sw.ts` has no route for onboarding. The D1 redirect is a GET of `/auth/*` and not a Tonight navigation. Manual check 3.5 deletes the auth cookie first, which is right: once D1 lands, a signed-in user can no longer reach `/auth/signup`.
- **The middleware stays plan-free.** The new branch is one pathname check plus the user that `src/middleware.ts:29` has already resolved. It adds no query.
- **S-07 logging.** No new failure branch exists. `user_already_exists` is in `USER_MISTAKE_CODES` (`src/lib/api-errors.ts:64-71`), so the planned smoke step for a duplicate sign-up leaves no log line. The route comment's promises (keys only, no `error.message`, no email) carry over.
- **No regressions in existing tests from D1.** Nothing in `tests/e2e` opens `/auth/*` while signed in. `service-worker-control.spec.ts:27-31` runs signed out, and `signUp` (`helpers.ts:171-183`) runs once per fresh context. The existing smoke step that renders `/auth/signin?next=%2Flog` (`smoke.mjs:244-249`) runs before the walk signs up.
- **Supabase keeps the session on a failed `signUp`.** `auth-js` `signUp` returns the error without `_removeSession`, so the duplicate-email smoke step does not sign the walk out.
- **No stacked PRs.** The plan is one PR with commits per phase, targeting `main`.
- **Commands.** The scripts `lint`, `test`, `smoke` and `test:e2e` exist in `package.json`, and `@astrojs/check` is installed. The Vitest projects `reference` and `guards` exist (`vitest.config.*:45,53`). The commands were not run: they need local Supabase and a preview, and the code is not written yet.

## Findings

### F1 — Phase 2's signed-out page checks in the smoke walk have no position, and after sign-up D1 breaks them

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick decision with an obvious, narrow fix)
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 2 › 6. Smoke steps", first bullet

**Detail**: The two `bodyIncludes` steps request `GET /auth/signin?next=%2Flog` and `GET /auth/signup?next=%2Flog` and expect `200`. The smoke walk holds a session from `signup creates account` (`smoke.mjs:255-258`) until `signout clears session` (`:665`). Phase 1's middleware redirects any signed-in GET of those pages, so if the new steps sit anywhere after `:258`, they get a `302` and fail. Phase 1 places its own steps explicitly ("right after `signin ignores an off-site next`"). Phase 2 names no position.

**Fix**: Place both steps next to `the sign-in page carries the page to continue to in its form` (`smoke.mjs:244-249`), before `signup creates account`. For the duplicate-sign-up step, name the key `errors.auth.userExists` (`api-errors.ts:45`) and assert it with `exact: true` in both cases.

- **Decision**: PENDING

### F2 — The e2e onboarding helper's selector cannot match the form once its action carries `next`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick decision with an obvious, narrow fix)
- **Dimension**: Claim Accuracy
- **Location**: plan.md "Phase 3 › 1. Helpers"; `tests/e2e/helpers.ts:99,181,192`

**Detail**: `ONBOARDING_FORM` is the exact-match selector `form[action="/api/onboarding"]`. In the journey, the action becomes `/api/onboarding?next=%2Flog`, which is the point of Phase 2 §5. The selector then matches nothing, so the extracted "Madrid onboarding completion" helper times out in `waitForHydration` or on the submit click. The plan says only that the helpers' behaviour stays the same and does not mention the selector.

**Fix**: Make the extracted completion helper use a prefix match, `form[action^="/api/onboarding"]` (or pass the form locator in). Keep `ONBOARDING_FORM` exact for `signUp`, which expects bare `/onboarding`, and for `onboarding.spec.ts:39`.

- **Decision**: PENDING

### F3 — The journey claims the service worker's sign-up route but never waits for the worker to control the page

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM (worth pausing: real tradeoff or non-trivial edit)
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 3 › 2. The journey spec" ("the form submit works through the worker's `POST /api/auth/signup` route")

**Detail**: Each test gets a fresh context. The worker registers on the first page but controls only later navigations, and Chromium can leave a document uncontrolled if activation races a navigation (`helpers.ts:313-328`, `service-worker-control.spec.ts`). Without `waitForServiceWorker(page)`, the sign-up POST may go straight to the network, and the test passes without proving what the plan says only it can prove.

**Fix**: Call `waitForServiceWorker(page)` on the sign-in page (after `goto("/log")`) and before clicking "Sign up". Then assert the journey as planned.
- Strength: this is the helper built for exactly this race. The other worker specs use it.
- Tradeoff: one extra reload in the worst case.
- Confidence: MED. Every current caller of `waitForServiceWorker` runs with `clock: "real"` (offline, finder-offline, session-plan-store, service-worker-control), and none runs on the pinned clock.
- Blind spot: whether the pinned browser clock interferes with `navigator.serviceWorker.ready`. If it does, the spec needs `clock: "real"` with a reason comment. That is allowed, because the journey reads no date.

- **Decision**: PENDING

### F4 — The e2e D1 tail duplicates Phase 1's smoke steps

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW (quick decision with an obvious, narrow fix)
- **Dimension**: Coverage (test-diet fit)
- **Location**: plan.md "Phase 3 › 2. The journey spec", second test or tail

**Detail**: The signed-in `goto("/auth/signin")` → `/tonight` and `goto("/auth/signup?next=%2Fgear")` → `/gear` checks are plain HTTP 302s that Phase 1's three smoke steps already pin with exact `Location`s. Test-plan §6.5 sends redirects to `scripts/smoke.mjs`, and lessons say to "name the risk a test is the only protection of". The browser adds nothing for D1.

**Fix**: Drop the D1 tail from the spec and keep one journey test. This also keeps the e2e count at +1 spec / +1 test for the Phase 3 docs update.

- **Decision**: PENDING

### F5 — The e2e verification commands omit `BASE_URL` and the forecast fixture

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW (quick decision with an obvious, narrow fix)
- **Dimension**: Verifiability
- **Location**: plan.md Phase 3 Automated 3.1, 3.2 (and Progress 3.1, 3.2)

**Detail**: Playwright defaults to `http://localhost:4321` (`playwright.config.ts`), but the brief puts the preview on 4339 and the fixture on 4407. Test-plan §6.5 says to run locally with `BASE_URL=http://localhost:<port>`. As written, 3.1 and 3.2 hit the wrong port. The smoke lines already pass `BASE_URL`.

**Fix**: Prefix both with `BASE_URL=http://localhost:4339`. Note that the preview must run with `FORECAST_BASE_URL` pointing at the fixture.

- **Decision**: PENDING

### F6 — The plan's line references predate e563fda although the plan says it was "re-verified" there

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW (quick decision with an obvious, narrow fix)
- **Dimension**: Claim Accuracy
- **Location**: plan.md "Current State Analysis"

**Detail**: Each claim's content is correct, but the line numbers are from 82e35cf:

| Plan cites | Actual at e563fda |
| --- | --- |
| `middleware.ts:35`, `:37-44` | `:29`, `:31-38` |
| `signin.astro:31` | `:28` |
| `signup.ts:22` | `:32` |
| `onboarding.ts:36` | `:43` |
| `onboarding.astro:23` | `:26` |

**Fix**: Update the numbers, or cite symbols instead. The implementer will find every one of these spots anyway.

- **Decision**: PENDING

## Owner question: a "Sign up to continue." note on the sign-up page

**Reviewer's view: agree with the default, no note.** The only route to `/auth/signup?next=…` is the "Sign up" link on a sign-in page that has just shown "Sign in to continue." The gate redirects to sign-in, never to sign-up. A second, nearly identical note one click later adds a key in two languages and an assertion while explaining nothing new. If the owner wants a cue at all, it fits better on the step where the detour actually happens: onboarding ("After setup you'll continue to the page you opened"). That would be a separate, later copy decision, not part of this change.

## Triage summary

Not triaged yet: all findings are PENDING. The orchestrator relays them to the owner.
