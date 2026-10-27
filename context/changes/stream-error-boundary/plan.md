# Stream error boundary Implementation Plan

## Overview

Since the S-07 error-visibility work, every failure someone foresaw leaves a `sidereus: <step> failed` line. One mechanism is still blind. The observability audit of 2026-10-27 (`context/audits/observability/2026-10-27_offline-night-plan-first-run-setup-log-progress.md`, finding P1, critical) proved it at runtime: Astro streams pages and server islands on Workers, so an unforeseen throw in any **child component** surfaces only while the body is being read, after the 200 headers. Astro records the error and ends the body; nothing is logged, and workerd prints nothing.

The user gets a blank page or a skeleton that never resolves. The responder gets a 200 and no line. This plan adds one boundary in the middleware:

- the HTML body stream is guarded, so a read error logs `request.stream failed`;
- a throw coming out of `next()` (a page's own frontmatter, an endpoint, a server island's own frontmatter) logs `request.uncaught failed` beside Astro's own `[ERROR]` line, which is unstructured, carries the message and is missed by a `sidereus:` search (finding P8);
- both lines carry the route template, so the responder knows which page or island broke.

The owner chose to keep streaming (audit decision D1, 2026-10-27). Plan review: `reviews/plan-review.md` (all findings applied).

## Current State Analysis

- `src/middleware.ts` resolves preferences and the session, gates protected paths, then `const response = await next()` and appends `Vary` to HTML responses. It has no `try` around `next()` and never touches the body. The client-error endpoint short-circuits before everything (`isClientErrorPath`).
- `src/lib/auth/middleware.test.ts` (133 lines) already runs the real `onRequest` over a fake context. That context has no `routePattern` and no `params`, and the test asserts the `Vary` append (:99).
- `log-failure.ts` has no `request.*` failure step except `request.form`, which the routes use. Fields are `{ step, name?, code?, status? }` (`LogFields` :224-229); `FailureExtra` carries `status` only (:232-234). The `FAILURE_STEPS` test accepts any `^[a-z]+\.[a-z][a-z-]*$` entry.
- The silent-catch guard counts a handler as reporting only if it calls `logFailure`, `logNotice`, `logReadFailure` or `saveFailureKey` by name, or rethrows (`silent-catch-guard.test.ts:49`, `handlerPasses` :291-296).
- The probe harness that proved the gap lives in the audit's isolated worktree `.claude/worktrees/agent-a95868590404aece4` (on `b4273c9`; `src/middleware.ts` is unchanged since then). Its scripts are `probe/run.sh` and `probe/suite.mjs`, with probes behind an `x-probe` header. It is uncommitted and must never be merged.

### Key Discoveries:

- **The production render path is the async iterable.** On workerd with `nodejs_compat`, `isNode` is true (`node_modules/astro/dist/runtime/server/util.js:159`), so `runtime/server/render/page.js:42` takes `renderToAsyncIterable` → `renderStreamToAsyncIterable` (`render/astro/render.js:81-178`). A render error is stored (:167-169) and thrown from the iterator on the next read (:102-104), which drops already-buffered bytes and logs nothing. That matches the probe: 200, 0 B, only the request log line.
- **The wrapper still sees the error.** The `Response` built from that iterable exposes a `ReadableStream` body whose `read()` rejects with the same error. On workerd, `reader.cancel()` resolves a pending read as `{ done: true }` and never rejects. Both were tested with a scratch `workerd test` using the repo's compat date and flags (plan review).
- **Streaming is on.** The adapter calls `createApp()` with no `streaming` argument (`@astrojs/cloudflare` `utils/handler.js:32`), so `streaming` defaults to true (`core/app/base.js:73`).
- **A page or endpoint throw rejects `next()`.** The adapter's `app.render` runs `handleRequest` (`core/app/base.js:260-267`; there is no custom `src/fetch.ts`). User middleware is wrapped by `handleMiddleware` (`core/routing/handler.js:80`), and `actionsAndPages` → `handlePages` does not catch (:23-31), so the throw rejects `await next()` in our middleware. Astro's outer catch then logs `[ERROR]` and renders the 500 (:101-108). A resolved 5xx from `next()` is therefore not expected today.
- **Cookies survive a new Response.** After the middleware returns, Astro calls `attachCookiesToResponse(response, state.cookies)` (`core/middleware/astro-middleware.js:42`), and `state.cookies` is `context.cookies`. A new `Response` around the guarded body keeps every cookie, including the Supabase session refresh written through `setAll` (`src/lib/supabase.ts:47-51`).
- **Islands run through the middleware.** A server island is an ordinary page route `/_server-islands/[name]` (`core/server-islands/endpoint.js:11-31`). `context.routePattern` exists on the middleware context. `params.name` is the island's **import local name**, with a numeric suffix on a collision (`server-islands/shared-state.js:24-28`). It comes from the URL, and an unknown name answers 404 before anything renders.
- **The middleware's own code before `next()`** (preferences, `createClient`, `sessionUser`) is already covered: by Astro's `[ERROR]` line on a throw (probe P5: 500 + `[ERROR]`), and by `sessionUser`'s own `auth.claims` line.
- No route answers a 5xx on purpose. The only `Astro.response.status` values are 404 (gear and log `[id]` pages), and the client-error endpoint answers 204 or 4xx only.

## Desired End State

- A throw in any child component of a page or server island leaves exactly one `sidereus: request.stream failed` error line (so a Workers Issue), with `name` (when identifier-shaped) and `route`. Examples: `/log/[id]`, `/tonight`, `/_server-islands/TonightContent`.
- A throw coming out of `next()` (a page's own frontmatter, an endpoint, a server island's own frontmatter) leaves exactly one `sidereus: request.uncaught failed` line, with `name` and `route`, beside Astro's own `[ERROR]` line.
- A client that disconnects mid-stream leaves no line. A clean response leaves no line. User-visible behaviour is unchanged: the same status, the same bytes, the same cookies.
- No line ever carries a concrete pathname, query, id or coordinate. `route` is a route template, and that is proven by a unit test.
- Verify: the audit's probe suite, re-run against this change, gives:
  - P10a, P10c, P10a-island and P10c-island: one `request.stream failed` line each;
  - P1, P3 and P10b: exactly one `request.uncaught failed` line each;
  - P0: none, with an unchanged response.

## What We're NOT Doing

- **No change to Astro's streaming or its 200 status.** By owner decision D1 the user still gets the empty 200; this change makes it visible, not different. A user-facing fallback for a failed island, and the 404/500 pages, stay in #190.
- **No `request.uncaught` line for a throw in the middleware's own code before `next()`** (preferences, `createClient`, `sessionUser`; probe P5). Astro already logs it as `[ERROR]` with a 500, and `sessionUser` has its own `auth.claims` line.
- **No fix for the other audit findings** (call-site-aware fault kind P2/P3, burst escalation, service-worker reporting, client channel). Each is its own change.
- **No release identity on the lines** (#189).
- **No logging of a client disconnect** (`cancel`). It is the browser leaving, not a fault.
- **No message, stack, URL, pathname or query** on any line.
- **No committed probes.** The probe code stays in the audit worktree.

## Implementation Approach

The stream logic goes in a small module (`stream-guard.ts`) that calls `logFailure` itself. A callback would make its catch "silent" to the guard, so it doesn't take one. It can be tested without Astro: give it a `ReadableStream` that errors after a chunk, then assert one `console.error` line and the same error downstream.

The route derivation is a pure, tested helper. It is the only place a route is built, and it never reads a URL. The middleware becomes the only wiring site:

- a `try` around `next()` that logs and rethrows;
- a commented safety net for a resolved 5xx;
- for an HTML response with a body, a new `Response` around the guarded body.

The two new steps and the `route` field are added to `log-failure.ts` with their shape check, test-first like every earlier field.

## Critical Implementation Details

- **Ordering and lifecycle.** The body is read only after the middleware has returned, so the guard cannot rely on the `try` around `next()`. It must log from inside its `pull`, when the source read rejects, and then error its own controller with the same value, so the client sees what it saw before. `cancel(reason)` forwards to the source and never logs. Log at most once per response.
- **No double line.** On a throw, log `request.uncaught` in the `catch` and rethrow, so Astro still logs `[ERROR]` and renders its 500. The resolved-5xx branch is a safety net for a future deliberate path. Keep a comment that says so, and skip it when the route is `/500`: `renderDefaultError` runs the middleware again for a `/500` page, which #190 will add.
- **Keep the response identical.** Append `Vary` as today, then build the new `Response` from the original's `status`, `statusText` and `headers`. Wrap only when `content-type` includes `text/html` and `body` is non-null. Do not set `Content-Length`. Redirects, HEAD and 304 have a null body and pass untouched.

## Phase 1: Stream guard and the request lines

### Overview

Add the closed steps, the shaped `route` field and its pure derivation, the stream guard, and the middleware wiring, with the unit tests written first. Before the first commit, open the GitHub issue and put it on the board.

### Changes Required:

#### 0. Tracking

**File**: GitHub (issue on `RafalSkwara/Sidereus`, Projects board #1); `context/changes/stream-error-boundary/change.md`; this plan's References

**Intent**: Mirror the change on the board, as every Sidereus change is.

**Contract**: one issue, labelled per the board convention and added to board #1 with Change ID `stream-error-boundary` and status `in-progress`. Record its number in `change.md` Notes and in References.

#### 1. Log line vocabulary and the route helper

**File**: `src/lib/observability/log-failure.ts`, `src/lib/observability/log-failure.test.ts`

**Intent**: Add `request.stream` and `request.uncaught` to `FAILURE_STEPS`, and a `route` to the line, so a request-level failure says which page or island broke without carrying a value.

**Contract**:
- `FailureExtra` and `LogFields` gain `route?: string`.
- A route is kept only when it has the **template shape**:
  - starts with `/`;
  - each segment is either a fixed word of letters, `_` and `-` (no digits, no `.`), or a parameter written `[x]` / `[...x]`;
  - at most 80 characters.
  - Anything else is dropped, and the helper never throws.
- New pure helper `requestRoute(routePattern: unknown, params: unknown): string | undefined`. It returns the pattern when it has the template shape. For the server-island pattern `/_server-islands/[name]` it returns `/_server-islands/<name>` only when `params.name` passes `NAME_SHAPE`, otherwise the bare pattern. It returns `undefined` for anything else, including an undefined pattern. It never reads a URL. Allow the island name's possible numeric suffix through `NAME_SHAPE` only, not through the segment rule.
- Tests (the only protection of "no value in `route`"):
  - a template is kept;
  - a pathname with a uuid, a number or coordinates (`/log/123e4567-…`, `/52.2297/21.0122`) is dropped;
  - a query is dropped;
  - an over-long value is dropped;
  - an island name is substituted, and a non-identifier name is not;
  - an undefined pattern gives no route.

#### 2. Stream guard

**File**: `src/lib/observability/stream-guard.ts` (new), `src/lib/observability/stream-guard.test.ts` (new)

**Intent**: Wrap a body stream so a failure while it is read is logged once, with the stream's behaviour towards the client unchanged.

**Contract**:
- Signature: `guardStream(source: ReadableStream<Uint8Array>, step: FailureStep, extra?: FailureExtra): ReadableStream<Uint8Array>`.
- It passes chunks through unchanged. When the source read rejects, it calls `logFailure(step, error, extra)` once and errors the returned stream with the same value. `cancel(reason)` cancels the source and never logs.
- No callback and no inner `try` around the logger (`logFailure` never throws), so the silent-catch guard passes without an allowlist entry.
- The test spies on `console.error` and owns three risks:
  - (a) an error after one chunk is logged once and reaches the consumer;
  - (b) a clean stream logs nothing;
  - (c) a consumer cancel logs nothing.

#### 3. Middleware wiring

**File**: `src/middleware.ts`, `src/lib/auth/middleware.test.ts`

**Intent**: Make the middleware the boundary for every page and island: log a throw from `next()` once, and guard the HTML body stream.

**Contract**:
- `const route = requestRoute(context.routePattern, context.params)`, once per request, after the client-error short-circuit.
- Wrap the existing `await next()`:
  - a throw logs `logFailure("request.uncaught", error, { route })` and rethrows;
  - a resolved status ≥ 500 (safety net, commented, skipped for `/500`) logs `logFailure("request.uncaught", undefined, { status, route })`;
  - an HTML response with a body keeps the `Vary` append and is returned as `new Response(guardStream(body, "request.stream", { route }), { status, statusText, headers })`.
- The protected-path redirects and the client-error short-circuit stay as they are. The `catch` passes the silent-catch guard (it logs and rethrows).
- Extend `middleware.test.ts` with one case: a `next()` whose HTML body errors mid-stream gives one `request.stream` line when the body is read, and the `Vary` assertion still holds. The fake context must tolerate a missing `routePattern` and `params`.

#### 4. Commit the audit report with the change

**File**: `context/audits/observability/2026-10-27_offline-night-plan-first-run-setup-log-progress.md`

**Intent**: The report that motivates the change goes into the repo history with it (it is untracked today).

**Contract**: committed unchanged in Phase 1's commit.

### Success Criteria:

#### Automated Verification:

- The new guard, route and middleware tests fail before the change and pass after: `npx vitest run src/lib/observability/stream-guard.test.ts src/lib/observability/log-failure.test.ts src/lib/auth/middleware.test.ts`
- Unit tests pass, the guards project included: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`

(Every node command runs with the `nvm use` prefix from CLAUDE.md.)

**Implementation Note**: This phase has no manual rows (the runtime proof is Phase 2). After automated verification passes, continue to Phase 2 without a pause (owner's autonomous-run rule).

---

## Phase 2: Runtime proof, runbook and the PR gates

### Overview

Prove the boundary on a real build with the audit's probe suite (before/after), document the two steps for the operator, and run the gates CI runs before a PR.

### Changes Required:

#### 1. Before/after probe run (evidence only, nothing committed)

**File**: the audit worktree `.claude/worktrees/agent-a95868590404aece4` (`probe/run.sh`, `probe/suite.mjs`)

**Intent**: Show at runtime that the four "missed" probes now leave a line and the controls leave exactly one.

**Contract**:
1. Copy the current "before" outputs (`probe/results.json`, `probe/suite.out`, `probe/preview.log`) to `probe/before/`.
2. Bring this change's files into the worktree without committing there (`git checkout feat/stream-error-boundary -- <files>`, or copy them): `src/middleware.ts`, `src/lib/observability/log-failure.ts`, `src/lib/observability/stream-guard.ts`.
3. Re-add the probe's `probeThrow(context.request, "p5")` line to the worktree's middleware, which step 2 overwrote.
4. Run `bash probe/run.sh` against the local Supabase stack.
5. Record per probe the HTTP status and bytes and the console lines:
   - P10a, P10c, P10a-island and P10c-island each show one `sidereus: request.stream failed` line with the expected `route`;
   - P1, P3 and P10b each show exactly one `sidereus: request.uncaught failed` line (beside Astro's `[ERROR]`);
   - P5 is unchanged (Astro's `[ERROR]` only);
   - P0 shows no `sidereus: request.` line, and its status and bytes equal the "before" run.
6. Paste the before/after table into `context/changes/stream-error-boundary/implementation-notes.md`.

#### 2. Runbook and agent instructions

**File**: `context/deployment/error-visibility.md`, `CLAUDE.md`

**Intent**: Tell the operator what the two new lines mean and how to read `route`, and tell agents the boundary exists.

**Contract**:
- Runbook §3 (step table): rows for `request.stream` (a child component threw after streaming started; the user saw a blank page or a skeleton that never resolved) and `request.uncaught` (a page, endpoint or island frontmatter threw; Astro's `[ERROR]` line with the stack sits beside it).
- Runbook §1: the `route` field (a template, never a pathname).
- `CLAUDE.md`, the Observability tripwire: one sentence that the middleware is the stream and uncaught boundary (`stream-guard.ts`, `requestRoute`), so a component needs no `try` of its own for unforeseen throws.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- The probe suite after the change shows one `request.stream failed` line for each of P10a, P10c, P10a-island and P10c-island, exactly one `request.uncaught failed` line for P1, P3 and P10b, and none for P0: `bash probe/run.sh` in the audit worktree
- Smoke passes against a local production preview and local Supabase. Run it the way CI does (lessons.md):
  - a fresh `npm run build` with `dist/server/.dev.vars` pointed at the local stack and the forecast fixture;
  - `npm run preview` running;
  - then `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=http://localhost:4321 npm run smoke`, with the values from `npx supabase status -o env` inline and never exported.
- The whole e2e suite passes the same way: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run test:e2e`, against the same preview.

(Every node command runs with the `nvm use` prefix from CLAUDE.md.)

#### Manual Verification:

- After the deploy, a Workers Logs search for `sidereus: request.` over the first day shows no lines from client disconnects (no false positives on a normal day).
- After the deploy, the first real `request.stream` or `request.uncaught` line (if any) appears as a Workers Issue with a readable `route`.

**Implementation Note**: The manual rows can only be checked after merge and deploy. Leave them for the owner's post-deploy check.

---

## Testing Strategy

### Unit Tests:

- `stream-guard.test.ts`: an error after one chunk (one line, the error reaches the consumer), a clean stream (no line), a consumer cancel (no line).
- `log-failure.test.ts`: the `route` shape and `requestRoute`. A template is kept and an island name substituted; a pathname with an id, a number or coordinates is dropped, and so are a query and an over-long value.
- `middleware.test.ts`: an HTML body that errors mid-stream gives one `request.stream` line; `Vary` still appended.

### Integration Tests:

- The audit probe suite (Phase 2) is the runtime proof on workerd: before/after on the same probes. It is evidence, not a CI test, since probes must never be merged.
- Smoke and e2e prove behaviour stays identical: cookies through sign-in, redirects, islands rendering.

### Manual Testing Steps:

1. After deploy, search Workers Logs for `sidereus: request.` and confirm no disconnect noise on a normal day.
2. When the first real line appears, confirm the Issue's `route` names the page or island.

## Performance Considerations

The guard adds one pass-through `ReadableStream` per HTML response. It does no buffering, so time to first byte and memory are unchanged apart from per-chunk overhead.

## Migration Notes

None. No schema, no data, no configuration change.

## References

- Audit: `context/audits/observability/2026-10-27_offline-night-plan-first-run-setup-log-progress.md` (P1, P8, decision D1)
- Plan review: `context/changes/stream-error-boundary/reviews/plan-review.md`
- Probe harness: `.claude/worktrees/agent-a95868590404aece4/probe/` (rerun: `bash probe/run.sh`)
- Logging helper and its shape rules: `src/lib/observability/log-failure.ts`
- Earlier change: `context/archive/2026-10-15-error-visibility/plan.md`
- Runbook: `context/deployment/error-visibility.md`
- GitHub issue: #244

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Stream guard and the request lines

#### Automated

- [x] 1.1 The new guard, route and middleware tests fail before the change and pass after — 1fcdba0
- [x] 1.2 Unit tests pass, the guards project included: `npm test` — 1fcdba0
- [x] 1.3 Type check passes: `npx astro check` — 1fcdba0
- [x] 1.4 Lint passes: `npm run lint` — 1fcdba0

### Phase 2: Runtime proof, runbook and the PR gates

#### Automated

- [x] 2.1 Unit tests pass: `npm test`
- [x] 2.2 Type check passes: `npx astro check`
- [x] 2.3 Lint passes: `npm run lint`
- [x] 2.4 Production build succeeds: `npm run build`
- [x] 2.5 The probe suite after the change shows one `request.stream failed` line per child probe, exactly one `request.uncaught failed` line for P1, P3 and P10b, and none for P0
- [x] 2.6 Smoke passes against a local production preview and local Supabase, run the way CI does
- [x] 2.7 The whole e2e suite passes the same way

#### Manual

- [ ] 2.8 After the deploy, a Workers Logs search for `sidereus: request.` shows no lines from client disconnects
- [ ] 2.9 After the deploy, the first real `request.stream` or `request.uncaught` line appears as a Workers Issue with a readable `route`
