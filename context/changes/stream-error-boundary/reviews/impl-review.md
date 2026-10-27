<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Stream error boundary

- **Plan**: `context/changes/stream-error-boundary/plan.md`
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 2 observations
- **Commits**: 1fcdba0 (p1), dd9e181 (p2), 8758ccf (epilogue) on `feat/stream-error-boundary`
- **Method**: one reviewer, inline. The source diff is 6 files and about 280 lines, so no sub-agents were used. Checks:
  - Read the whole diff against the plan's contracts.
  - Spot-checked Astro 7.3.2 internals: `prepare-response.js` sets `responseSentSymbol` after the middleware. `fetch-state.js` reads the symbol from the request, not from the response. Route-type and reroute markers are headers, so the new `Response` carries them.
  - Ran the automated gates again.
  - Reproduced F1 in Node with a mirror of `guardStream`. The script is in the session scratchpad and is not committed.

## Verdicts

| Dimension | Verdict | Findings |
|-----------|---------|----------|
| Plan Adherence | PASS | |
| Scope Discipline | PASS | |
| Safety & Quality | WARNING | F1, F2, F3 |
| Architecture | PASS | |
| Pattern Consistency | PASS | |
| Success Criteria | PASS | |

### Plan adherence (all MATCH)

- **0. Tracking.** Issue #244 is recorded in `change.md` and in References.
- **1. `log-failure.ts`:**
  - It adds the `request.stream` and `request.uncaught` steps and `route` on `FailureExtra` and `LogFields`.
  - `isRouteTemplate` checks for a leading `/`, letter, `_` or `-` segments, `[x]` or `[...x]` parameters, and at most 80 characters.
  - The island suffix is allowed only through `NAME_SHAPE`.
  - `requestRoute` reads no URL.
  - The tests cover every case the plan lists.
- **2. `stream-guard.ts`:**
  - The signature is as planned, with no callback.
  - The high-water mark is 0.
  - On a failure it calls `logFailure` and then `controller.error(error)`.
  - `cancel` forwards to the source and does not log.
  - There are three tests, (a), (b) and (c).
- **3. `middleware.ts`:**
  - `route` is computed once, after the short-circuit and the redirects.
  - The `try` covers only `next()`. It logs and rethrows. TypeScript's definite-assignment check also pins the rethrow.
  - The resolved-5xx safety net is commented and skips `/500`.
  - `Vary` is appended first. The new `Response` is built only for `text/html` with a non-null body, with status, statusText and headers and no `Content-Length`.
  - The middleware test covers the stream case. The fake context has no `routePattern` or `params`, and the test tolerates that.
- **4. The audit report** is committed unchanged in 1fcdba0.
- **Phase 2:**
  - The before/after probe table in `implementation-notes.md` matches the expected outcome on all 7 `request.*` rows, plus the controls P0, P5 and P6.
  - Runbook §1 now covers `route`, and §3 has a row for each of the two steps.
  - The CLAUDE.md Observability tripwire has its sentence.

### Success criteria re-run (2026-10-27, by the reviewer)

| Command | Result |
|---|---|
| `npx vitest run src/lib/observability/stream-guard.test.ts src/lib/observability/log-failure.test.ts src/lib/auth/middleware.test.ts` | PASS: 3 files, 22 tests |
| `npm test` | PASS: 136 files, 898 passed, 1 skipped |
| `npx astro check` | PASS: 0 errors, 0 warnings, 3 hints |
| `npm run lint` | PASS (no output) |
| `npm run build` | PASS: `build-sw` precaches 64 files (1126 KiB) |
| Probe suite, smoke, e2e (2.5–2.7) | Not re-run, on the orchestrator's instruction. The evidence is in `implementation-notes.md`, and the probe table is complete. |

Manual rows 2.8 and 2.9 are unchecked, as they should be: they run after the deploy. F1 is the false positive that row 2.8 is meant to catch. The probe suite reads every body to the end (implementation notes), so no runtime run has exercised a cancel.

## Findings

### F1 — A client disconnect during a pending read logs a false `request.stream` line

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/observability/stream-guard.ts:21-31
- **Detail**:
  - **Where.** The `try` wraps `controller.close()` and `controller.enqueue(value)` as well as `await reader.read()`.
  - **What happens on a disconnect.** Say the client goes away while a `pull` is waiting on the source, for example an island that waits on the forecast fetch. The stream is cancelled, and `cancel` cancels the source. The plan review confirmed that on workerd this resolves the pending read as `{ done: true }`. The pull then continues to `controller.close()` on a closed stream, which throws `TypeError: Invalid state: Controller is already closed`. The `catch` logs that error as `sidereus: request.stream failed` with name `TypeError`.
  - **Reproduced** in Node with a copy of the guard. The output is `source cancelled: client gone`, then `LOGGED request.stream failed: TypeError Invalid state: Controller is already closed`.
  - **Why this matters.**
    - It breaks the Desired End State: "A client that disconnects mid-stream leaves no line."
    - It breaks the guard's own contract: "`cancel(reason)` … never logs".
    - Every such disconnect becomes an error-level line, and so a Workers Issue. The runbook reads that line as "the user saw a blank page", so on a normal day the new channel fills with noise.
  - **Why the tests miss it.** Test (c) cancels only after a completed read, when no pull is in flight.
- **Fix**: Keep the `try` around `await reader.read()` only, and enqueue or close outside it. Add a `cancelled` flag, set in `cancel`, and return early from `pull` when it is set. Add test (d): cancel while a read is pending (a source whose second pull never settles) logs nothing.
  - Strength: The logged failure then means exactly what the plan says, a rejected source read. The silent-catch guard still passes, because the catch still logs.
  - Tradeoff: About 6 lines plus one test.
  - Confidence: MED — reproduced on Node's WHATWG streams. The precondition (cancel resolves a pending read as done) was verified on workerd in the plan review, but the throwing `close()` was not checked on workerd.
  - Blind spot: workerd might drop the request's JS context on a disconnect before the pull resumes. If so, the line would never be written there. The fix is correct either way.
- **Decision**: FIXED (2026-10-27, owner decision: fix all). `pull` now has a `try` around `reader.read()` only; a `cancelled` flag set in `cancel` makes a read that settles afterwards log nothing and touch no controller. Tests: (d) a cancel during a pending read (the source resolves it as done) gives no line and no unhandled rejection, and (d2) a source whose cancel rejects its pending read gives no line. Break-checks went red and were restored: the pre-fix guard fails (d) and (d2), and dropping `cancelled = true` fails (d2). The `if (cancelled) return` after a successful read is defensive: a throw from `close()` or `enqueue()` on a closed stream is swallowed by the stream machinery, so no test can see it.

### F2 — Route wiring and both `request.uncaught` branches are not pinned by a test that runs in CI

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:64-80, src/lib/auth/middleware.test.ts:140
- **Detail**:
  - The only middleware case is the stream line without a route, because the fake context has no `routePattern`.
  - Nothing in CI checks that the middleware passes `{ route }` to the guard and to the catch, or that a rejected `next()` leaves exactly one `request.uncaught` line and rethrows. The probe suite proved both on workerd, but it is evidence that is never committed or re-run.
  - The resolved-5xx safety net, including its `/500` skip, is proven nowhere. That is expected: no route answers a 5xx today.
  - This follows the plan, which asked for one middleware case. It is a regression risk, not drift.
- **Fix**: Add two middleware cases. One sets `routePattern: "/_server-islands/[name]"` and `params: { name: "TonightContent" }` and asserts the route on the stream line. The other has `next()` reject and asserts one `request.uncaught` line with the route and the same error rethrown.
- **Decision**: FIXED (2026-10-27). Three cases in `src/lib/auth/middleware.test.ts`: the route from `routePattern` / `params` reaches the stream line (island name substituted, and the query never appears); a throwing `next()` leaves one `request.uncaught` line with the route and rethrows the same error; the resolved-5xx safety net logs once with `status` and `route`, and is skipped for `routePattern` `/500`. Break-checks went red and were restored: the guard given no route, the catch's log removed, the `/500` skip removed, and the safety net removed.

### F3 — The template rule drops `/404` and `/500`, which #190 will add

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/observability/log-failure.ts:284 (`TEMPLATE_SEGMENT`)
- **Detail**:
  - The rule does not allow digits in a fixed segment, as the plan specified. No page in `src/pages` has a digit or a dot in its path today, so nothing loses its route now.
  - #190 adds `/404` and `/500` pages. A stream or uncaught failure inside those pages would then log with no `route`.
  - The safety net compares `context.routePattern` directly, so the `/500` skip itself is not affected.
- **Fix**: When #190 lands, accept the exact patterns `/404` and `/500` in `isRouteTemplate`, with a test. Until then, note it on #190.
- **Decision**: FIXED (2026-10-27, owner decision: do it now, not with #190). `log-failure.ts` accepts the exact templates `/404` and `/500` as the named constants `NOT_FOUND_ROUTE` and `SERVER_ERROR_ROUTE` (`ERROR_PAGE_ROUTES`); the no-digits rule for fixed segments stays, so `/403`, `/4040`, `/404/x`, `/log/404` and `/500?x=1` are still dropped. Test: `route` › keeps the two error-page templates, plus `requestRoute`. Break-check went red and was restored: removing the exact-match check drops `/404` again.
