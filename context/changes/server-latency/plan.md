# Server latency and /tonight loading state Implementation Plan

## Overview

Signed-in pages on prod spend almost all their time waiting on other services, not computing. This change removes the per-request Supabase auth round trip and takes the forecast cache write off the response path. It puts timeouts on every external call and paints the `/tonight` shell at once, with a skeleton while its data loads. It also turns on tracing, so the next slowdown can be pinned to one call.

## Current State Analysis

Prod telemetry (Workers observability, colo WAW, 2026-09-26) recorded in `change.md`:

- `/tonight` used 15–50 ms of CPU but 0.16–3.7 s of wall time, with outliers at 20.6 s and a 17.6 s cancel. With a session, `/dashboard` (auth check plus redirect) took 471 ms; signed out it takes 2 ms. Anonymous pages take 35–50 ms. The client payload is about 75 KB of JS.
- The paid Workers tier is not the fix, because the bottleneck is waiting on I/O rather than CPU.
- The language switch sets a cookie and calls `window.location.reload()` (`src/components/PreferenceSwitches.tsx`), so it pays the full `/tonight` cost again.
- There are no traces or logs, only per-request totals, so the 20 s outlier cannot be attributed to one call.

The `/tonight` request runs these steps one after another:

1. `supabase.auth.getUser()` in `src/middleware.ts:19-26`. This is a network call to Supabase Auth on every request.
2. Three list queries, run in parallel (`src/pages/tonight.astro:56-64`).
3. A KV read (`src/lib/forecast/service.ts:122`), with no timeout.
4. An Open-Meteo fetch when the cached copy is more than an hour old. It has a 3 s timeout (`src/lib/forecast/open-meteo.ts:17,87`).
5. A KV write that the response waits for (`service.ts:136`).

Neither the Supabase calls nor the KV calls have a timeout.

## Desired End State

- A signed-in request makes no Supabase Auth call unless the token needs refreshing.
- On `/tonight`, the top bar and heading paint without waiting for Supabase, KV or Open-Meteo. A skeleton shaped like the verdict card and object cards shows until the data arrives, and screen readers announce a loading label (EN and PL).
- Tapping EN or PL shows a spinner in the tapped segment and disables both segments until the reload.
- A hung Supabase call fails after 5 s, and the page shows its existing error state. A KV read slower than 1 s counts as a cache miss. The forecast KV write never delays a response.
- Cloudflare traces break down each request into its individual external calls, and Smart Placement is on.

Verify with the automated checks per phase. Then, on a preview version or after merge, confirm the timings on the traces view and try the skeleton on a throttled connection.

### Key Discoveries:

- `@supabase/auth-js` 2.116.0 `getClaims()` checks the signature locally for asymmetric keys. The JWKS key set is fetched once per isolate and cached. The prod tokens are ES256 with a `kid` (from a test session's token), so the check runs locally (`node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts:2500-2520`). When the access token is about to expire, `getClaims()` refreshes the session first, so the `setAll` cookie write-back in `src/lib/supabase.ts:18-22` still applies.
- `locals.user` is only ever checked for truthiness (`src/middleware.ts:29`, `src/components/Topbar.astro:32`, `src/components/Welcome.astro:75`). A minimal `{ id, email }` can replace the full `User`.
- `@astrojs/cloudflare` 14.3.1 puts `cfContext: ExecutionContext` on `Astro.locals` (`node_modules/@astrojs/cloudflare/types.d.ts`, `dist/utils/cf-helpers.d.ts`), so pages can call `Astro.locals.cfContext.waitUntil(promise)`.
- Astro 7.3.2 serves server islands at `/_server-islands/[name]` (`node_modules/astro/dist/core/server-islands/endpoint.js:11`), and the middleware runs for that route too. The route is not in `PROTECTED_ROUTES`, so the island must guard on `locals.user` itself.
- wrangler 4.131.1 accepts `observability.traces.enabled` and `placement.mode: "smart"` (`node_modules/wrangler/config-schema.json:4050,261`).
- A spinner style already exists at `src/components/forms/SubmitButton.tsx:18`.
- `scripts/smoke.mjs:126` only asserts that `/tonight` returns 200. The e2e spec (`tests/e2e/onboarding.spec.ts:89-93,113-116`) asserts `/tonight` content through Playwright locators, which auto-wait, so a deferred island still passes.

## What We're NOT Doing

- Upgrading to the paid Workers tier, because the evidence shows it would not help.
- Replacing the language-switch reload with client-side rendering. Page copy stays server-rendered.
- Deferring or caching `/gear` and the other signed-in pages. They gain from the faster auth check and the Supabase timeout only.
- Caching the list queries or changing the forecast freshness window (`FORECAST_FRESH_MS`).
- Setting an `ASTRO_KEY` for server-island prop encryption across deploys (see Open Risks in the brief).
- Adding `/_server-islands` to `PROTECTED_ROUTES`. A redirect there would put the sign-in page's HTML inside the island.
- Cleaning up the prod test account `claude-perf-test+1790442290@example.com`. That is the user's action in the Supabase dashboard.

## Implementation Approach

Three independently revertible phases, ordered from biggest fixed cost to UI:

1. Platform config plus the auth check. This removes one round trip from every signed-in request and adds a timeout to all Supabase traffic.
2. The forecast path. The KV write moves to `waitUntil`, and a slow KV read counts as a miss.
3. Loading feedback. `/tonight`'s data-dependent part becomes a server island with a skeleton fallback, and the language switch gets a pending state.

The timeout values were delegated to the agent. 5 s for Supabase sits far above the normal 50–500 ms and far below the 17–20 s outliers. 1 s for KV reads is well above a normal read, and a miss only costs one Open-Meteo fetch, which is capped at 3 s.

## Critical Implementation Details

- **Timing & lifecycle.** Pass `waitUntil` into `getForecast` as a hook (`defer`). Do not import `cloudflare:workers` or `astro:*` into `service.ts`: the service stays pure and testable in plain Node, and only the page and `kv-cache.ts` touch the runtime.
- **User experience spec.** The skeleton must hold the same vertical rhythm as the real content (kicker, `h1`, the site · scope line, the verdict card, 3 object cards) so nothing jumps when the island swaps in. Use `motion-safe:animate-pulse` so reduced-motion users get static blocks. Colours come only from theme tokens (`bg-muted`, `bg-surface`, `border-border`), because `src/styles/no-hardcoded-colors.test.ts` enforces that.

## Phase 1: Platform config and a local auth check

### Overview

Turn on per-call tracing and Smart Placement, check the session token locally instead of calling Supabase Auth, and give every Supabase request a timeout.

### Changes Required:

#### 1. Worker config

**File**: `wrangler.jsonc`

**Intent**: Enable traces so the next slow request shows which external call took the time. Enable Smart Placement so the Worker can run near Supabase when a request makes several calls in a row.

**Contract**: `observability.traces: { enabled: true }` (keep the existing `enabled` and `redact_query_string`). Add a top-level `placement: { mode: "smart" }`. Add a one-line comment on each, matching the file's comment style. `npm run cf:types` only needs rerunning if bindings change; these keys do not change bindings.

#### 2. Fetch with a timeout

**File**: `src/lib/fetch-timeout.ts` (new), `src/lib/fetch-timeout.test.ts` (new)

**Intent**: A small wrapper that aborts any `fetch` after a fixed time. It combines the timeout with any signal the caller already passed, so supabase-js's own aborts keep working.

**Contract**: `export function withTimeout(fetchFn: typeof fetch, ms: number): typeof fetch`. It passes `signal: AbortSignal.any([AbortSignal.timeout(ms), init.signal])` when the caller gave a signal, and `AbortSignal.timeout(ms)` otherwise. Tests: it aborts a never-resolving fetch after `ms` (use fake timers or a small `ms`), it passes a fast response through, and it honours a caller's abort.

#### 3. Supabase client timeout

**File**: `src/lib/supabase.ts`

**Intent**: Every Supabase call (auth refresh, JWKS, PostgREST) fails fast instead of hanging for the full request.

**Contract**: Export `SUPABASE_TIMEOUT_MS = 5000`. Pass `global: { fetch: withTimeout(fetch, SUPABASE_TIMEOUT_MS) }` in the `createServerClient` options. The `null` return when env vars are unset is unchanged. The timeout covers every route that uses the client, including sign-in, sign-up and gear writes. An aborted call carries no Supabase `error.code`, so it already falls through to the existing generic keys (`authErrorKey` fallback, `errors.save.*`); add no new handling.

#### 4. Local session check in middleware

**File**: `src/middleware.ts`, `src/env.d.ts`

**Intent**: Replace `auth.getUser()` with `auth.getClaims()` so a signed-in request verifies the token locally. A failed or thrown check is treated as signed out.

**Contract**: `locals.user` becomes `SessionUser | null`, where `SessionUser = { id: string; email: string | null }`. Export the type from `src/lib/supabase.ts` and reference it in `src/env.d.ts`. `id` is `claims.sub` and `email` is `claims.email ?? null`. Wrap the call in `try/catch`; an error or a missing `claims` gives `null`. The redirect logic and the `Vary` header are unchanged. Add a comment that revocation takes effect when the token expires (≤ 1 h), an accepted trade-off.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro sync && npx astro check`
- Unit tests pass, including the new `fetch-timeout.test.ts`: `npm test`
- Production build succeeds: `npm run build`
- Wrangler accepts the config: `npx wrangler deploy --dry-run`

#### Manual Verification:

- On `npm run dev`, signing in, browsing `/gear` and `/tonight`, and signing out all behave as before, and the top bar shows the signed-in state
- After deploy (preview version or merge), the Workers dashboard shows traces with per-fetch spans for a `/tonight` request, and a signed-in `/dashboard` request shows no call to `/auth/v1/user`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Forecast off the response path

### Overview

The forecast KV write no longer delays the response, and a slow KV read counts as a cache miss instead of blocking.

### Changes Required:

#### 1. Deferred cache write

**File**: `src/lib/forecast/service.ts`, `src/lib/forecast/service.test.ts`

**Intent**: Let the caller run the KV write in the background so a fresh forecast returns as soon as Open-Meteo answers.

**Contract**: `GetForecastInput` gains an optional `defer?: (task: Promise<void>) => void`. When it is present, `getForecast` hands the `writeCache(...)` promise to `defer` and does not await it. When it is absent, behaviour is unchanged (awaited). `writeCache` already swallows errors, so the deferred promise never rejects. Tests: with `defer`, the result resolves while `put` is still pending and `defer` received exactly one task. Without it, the existing tests keep passing.

#### 2. KV read timeout

**File**: `src/lib/forecast/cache.ts`, `src/lib/forecast/kv-cache.ts`, a test next to `cache.ts`

**Intent**: A KV read that takes longer than 1 s counts as a miss, so the page falls through to Open-Meteo (capped at 3 s) instead of waiting indefinitely.

**Contract**: `cache.ts` exports `KV_READ_TIMEOUT_MS = 1000` and `withReadTimeout(cache: ForecastCache, ms: number): ForecastCache`. `get` rejects after `ms`, which `readCache` in the service already treats as a miss, and `put` passes through. `kvForecastCache()` returns the KV adapter wrapped with it. `cache.ts` stays free of `cloudflare:workers`. Tests: a never-resolving `get` rejects after `ms`, and a fast `get` passes through.

#### 3. Page wiring

**File**: `src/pages/tonight.astro` (moves into the island in Phase 3)

**Intent**: Pass the Worker's `waitUntil` as the `defer` hook.

**Contract**: `defer: (task) => Astro.locals.cfContext.waitUntil(task)`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Unit tests pass, including the new deferred-write and read-timeout cases: `npm test`
- Production build succeeds: `npm run build`

#### Manual Verification:

- On `npm run dev` with a site whose cached forecast is more than an hour old (or a fresh site), `/tonight` renders a verdict, and reloading within the hour serves the cached copy ("Forecast updated … ago" stays stable)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Loading feedback

### Overview

`/tonight` paints its shell immediately and streams in the data-dependent part as a server island with a skeleton fallback. The language switch acknowledges the tap at once.

### Changes Required:

#### 1. Tonight content island

**File**: `src/components/tonight/TonightContent.astro` (new), `src/pages/tonight.astro`

**Intent**: Move all data loading and the data-dependent markup (the date kicker, `h1`, the site · scope line, errors, setup prompts, verdict and ranking) out of the page into a component rendered with `server:defer`. The page shell (`GearShell`, `DatabaseMissing` branch, `Attribution`) then responds without waiting on any external service.

**Contract**: `tonight.astro` renders `<TonightContent server:defer><TonightSkeleton slot="fallback" /></TonightContent>` when `Astro.locals.supabase` is set, and `<DatabaseMissing />` otherwise, followed by the attribution block. `TonightContent` takes no props and reads `supabase`, `user` and `locale` from `Astro.locals`. It renders nothing when `locals.user` is `null`, because the island route is outside `PROTECTED_ROUTES`. Its frontmatter is the current page frontmatter, including Phase 2's `defer` wiring, and its markup is unchanged.

#### 2. Skeleton fallback

**File**: `src/components/tonight/TonightSkeleton.astro` (new)

**Intent**: Placeholder blocks with the real content's layout, so the page does not jump when the island swaps in.

**Contract**: The skeleton has a kicker bar, the real translated `h1` (`m.tonight.title`), a site · scope bar, a verdict-card placeholder using `promptCard` sizing, and 3 object-card placeholders. The container gets `role="status"` and `aria-busy="true"` with an `sr-only` label from the new key `tonight.loading`. Blocks use `bg-muted` plus `motion-safe:animate-pulse`. A slow-load hint (`tonight.loadingSlow` plus a plain `<a href="/tonight">` labelled `tonight.reload`) is hidden at first and fades in after about 10 s using a CSS `animation-delay` with no JS. Astro leaves the fallback in place when the island request fails (non-200, non-HTML or a network error; `replaceServerIsland` in `node_modules/astro/dist/runtime/server/render/server-islands.js`), so this hint is the recovery path. It disappears with the rest of the fallback on success.

#### 3. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: A loading label for screen readers, and the slow-load recovery hint.

**Contract**: The keys are `tonight.loading` (EN "Loading tonight's sky…", PL "Wczytuję dzisiejsze niebo…"), `tonight.loadingSlow` (EN "This is taking longer than usual.", PL "To trwa dłużej niż zwykle.") and `tonight.reload` (EN "Reload", PL "Odśwież"). The parity test in `i18n.test.ts` covers them.

#### 4. Language switch pending state

**File**: `src/components/PreferenceSwitches.tsx`

**Intent**: Acknowledge the EN/PL tap at once and prevent double taps while the browser reloads.

**Contract**: A `pendingLocale: Locale | null` state is set in `chooseLocale` before `window.location.reload()`. While it is set, both locale buttons are `disabled` and the group has `aria-busy="true"`, and the pending button shows the spinner (same classes as `SubmitButton.tsx:18`, token colours adapted to the segment) in place of its label, keeping the visible label for screen readers. The theme buttons are unaffected.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Unit tests pass, including i18n parity and the no-hardcoded-colours check: `npm test`
- Production build succeeds: `npm run build`
- CI's smoke and e2e jobs pass on the PR (the onboarding spec asserts `/tonight` verdict and setup prompt through the island)

#### Manual Verification:

- With DevTools throttling at "Slow 4G" on `npm run dev`, `/tonight` shows the top bar, the heading and the pulsing skeleton at once, and the verdict and cards replace it with no visible layout jump
- The skeleton is static with the OS "reduce motion" setting on, and VoiceOver or another screen reader announces the loading label
- Tapping PL shows a spinner in the PL segment, both segments are disabled, and the page reloads in Polish with the skeleton label in Polish
- A signed-out visit to `/tonight` still redirects to `/auth/signin`, and a user with no site or telescope still sees the setup prompt
- With the island request blocked (DevTools → Network → block `/_server-islands/*`), the "taking longer than usual" hint and the Reload link appear after about 10 s

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `withTimeout`: aborts after `ms`, passes fast responses through, and respects a caller's signal
- `getForecast` with `defer`: returns before the write settles, and hands exactly one task to `defer`
- `withReadTimeout`: a slow `get` rejects and is treated as a miss, and a fast `get` passes through

### Integration Tests:

- The existing CI smoke walk (`/tonight` 200 signed in, 302 signed out) and the e2e onboarding spec (verdict and setup prompt on `/tonight`) run against the production preview with local Supabase

### Manual Testing Steps:

1. Run `npm run dev`, sign in and open `/tonight` on Slow 4G. The skeleton shows first, then the content.
2. Switch EN → PL → EN. Check the spinner and the disabled state, and that both languages render.
3. After a preview upload or merge, open Cloudflare Workers → sidereus → Observability → Traces. A `/tonight` span shows the Supabase, KV and Open-Meteo fetches. `/dashboard` makes no `/auth/v1/user` call.
4. Remeasure prod `/tonight` TTFB with a signed-in session. The shell should respond like an anonymous page (well under 200 ms), with the island request carrying the data wait.

## Performance Considerations

- The shell request now costs only the local token check. The data wait moves to the island request, and a slow Supabase response is capped at 5 s.
- The JWKS fetch happens once per isolate. Workers isolates are reused, so this is an occasional cost, not a per-request one.
- Smart Placement needs traffic to decide, and with low traffic it may keep running at the edge. That does no harm, and traces will show the effect.

## Migration Notes

None. No schema or data changes. Deploy goes through CI on merge. A preview version (`npx wrangler versions upload`) may be uploaded for manual checks, with the user's per-case OK, since it writes to Cloudflare.

## References

- Change identity and telemetry evidence: `context/changes/server-latency/change.md`
- Middleware: `src/middleware.ts:7-40`
- Forecast service: `src/lib/forecast/service.ts:113-141`
- Current page: `src/pages/tonight.astro`
- Spinner style: `src/components/forms/SubmitButton.tsx:18`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Platform config and a local auth check

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 Type check passes: `npx astro sync && npx astro check`
- [x] 1.3 Unit tests pass, including the new `fetch-timeout.test.ts`: `npm test`
- [x] 1.4 Production build succeeds: `npm run build`
- [x] 1.5 Wrangler accepts the config: `npx wrangler deploy --dry-run`

#### Manual

- [ ] 1.6 On `npm run dev`, sign-in, `/gear`, `/tonight` and sign-out behave as before and the top bar shows the signed-in state
- [ ] 1.7 After deploy, traces show per-fetch spans for `/tonight` and a signed-in `/dashboard` makes no `/auth/v1/user` call

### Phase 2: Forecast off the response path

#### Automated

- [ ] 2.1 Lint passes: `npm run lint`
- [ ] 2.2 Type check passes: `npx astro check`
- [ ] 2.3 Unit tests pass, including the new deferred-write and read-timeout cases: `npm test`
- [ ] 2.4 Production build succeeds: `npm run build`

#### Manual

- [ ] 2.5 On `npm run dev`, `/tonight` renders a verdict and a reload within the hour serves the cached copy

### Phase 3: Loading feedback

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Type check passes: `npx astro check`
- [ ] 3.3 Unit tests pass, including i18n parity and the no-hardcoded-colours check: `npm test`
- [ ] 3.4 Production build succeeds: `npm run build`
- [ ] 3.5 CI's smoke and e2e jobs pass on the PR

#### Manual

- [ ] 3.6 On Slow 4G, `/tonight` shows the shell and skeleton at once and the content replaces it without a layout jump
- [ ] 3.7 The skeleton is static under reduced motion and the loading label is announced
- [ ] 3.8 Tapping PL shows the spinner, disables both segments and reloads in Polish
- [ ] 3.9 Signed-out `/tonight` still redirects and a user without gear still sees the setup prompt
- [ ] 3.10 With the island request blocked, the slow-load hint and Reload link appear after about 10 s
