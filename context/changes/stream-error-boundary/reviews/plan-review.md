<!-- PLAN-REVIEW-REPORT -->
# Plan review: Stream error boundary

- **Plan**: `context/changes/stream-error-boundary/plan.md`
- **Date**: 2026-10-27
- **Phases**: 2
- **Findings**: 0 critical, 7 warnings, 3 observations
- **Overall**: NEEDS ATTENTION
- **Method**:
  - Two Opus sub-agents: claim verification, and feasibility/sequencing/gaps. The first also ran a scratch `workerd test` with the repo's compat date and flags.
  - Hand spot-checks: `silent-catch-guard.test.ts:49` (`LOG_NAMES`); `render.js:98-106,164-170` (the async-iterable path); `src/lib/auth/middleware.test.ts` exists.
  - The automated commands resolve: `test`, `lint`, `build`, `smoke` and `test:e2e` scripts exist, and `npx vitest run <files>` starts.

## Verdicts

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Claim Accuracy | FAIL | F1, F2, F4 |
| Substance | PASS | |
| Feasibility | PASS | |
| Sequencing | WARNING | F9 |
| Architecture Fit | WARNING | F3 |
| Scope Discipline | PASS | |
| Verifiability | WARNING | F5, F6 |
| Coverage | WARNING | F7, F8, F10 |

The design holds. Both reviewers confirmed:
- A new `Response` from the middleware keeps cookies (`astro-middleware.js:42`).
- Islands run through the middleware.
- On workerd a wrapper's `read()` rejects with the same error, and `cancel` resolves a pending read without an error.
- No route returns a 5xx on purpose.

## Findings

### F1 — The stream guard's catch is "silent" to the silent-catch guard
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Claim Accuracy
- **Location**: plan.md, Phase 1 › Changes Required › 2 and 3 ("The silent-catch guard accepts the new handler because it calls `logFailure`")
- **Detail**:
  - The guard counts a handler as reporting only if it calls `logFailure`, `logNotice`, `logReadFailure` or `saveFailureKey` by name, or rethrows (`silent-catch-guard.test.ts:49`, `handlerPasses` :291-296).
  - `guardStream`'s catch calls `onError(e)` and `controller.error(e)`, so it is silent. The `try` around a throwing `onError` is a second silent site.
  - `npm test` runs the `guards` project, so criterion 1.2 fails as planned. The claim holds only for the middleware's own `catch` (log, then rethrow).
- **Fix A ⭐**: drop the callback. `guardStream(source, step, extra)` calls `logFailure(step, error, extra)` itself (it never throws), so no allowlist entry and no inner `try` are needed; the test spies on `console.error`. Strength: passes the guard by construction and keeps one logging path. Tradeoff: the module depends on `log-failure.ts` (same folder, fine). Confidence: HIGH, verified against `LOG_NAMES`. Blind spot: none significant.
- **Fix B**: keep the callback and add an `ALLOWED_SILENT_CATCHES` entry for `stream-guard.ts` with an exact count and a reason. Strength: a generic helper. Tradeoff: an allowlisted catch in the very boundary meant to end silence, and the counts are strict.
- **Decision**: FIXED

### F2 — A middleware test exists, and its fake context lacks `routePattern` and `params`
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Claim Accuracy
- **Location**: plan.md, Current State Analysis ("There is no middleware unit test"); Phase 1 › 3
- **Detail**: `src/lib/auth/middleware.test.ts` (133 lines) runs the real `onRequest` over a fake context with no `routePattern` or `params`, and asserts `Vary` (:99). Phase 1's wiring must tolerate both being undefined, or the test must gain them. The wrapped body must also keep the `Vary` assertion green.
- **Fix**: correct the claim, list `src/lib/auth/middleware.test.ts` under Phase 1 › 3, and extend it with one case: a route whose body errors mid-stream logs one `request.stream` line.
- **Decision**: FIXED

### F3 — The `route` shape check lets a concrete pathname through; the real guarantee is untested
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Architecture Fit (privacy)
- **Location**: plan.md, Phase 1 › 1 and 3; Testing Strategy
- **Detail**:
  - The planned shape (letters, digits, `_`, `-`, `.`, brackets) accepts `/log/123e4567-e89b-…` and `/52.2297/21.0122`, so the planned test ("a uuid-like or coordinate-looking value is dropped") would pass only for values that break the shape. That makes the test misleading.
  - "Never `context.url`" lives only in the middleware wiring, which has no unit test of the derivation.
  - No route template under `src/pages` and no island name contains a digit or a `.`.
  - The island name in `params.name` is the import's local name, possibly with a numeric collision suffix (`server-islands/shared-state.js:24-28`), and it comes from the URL. Unknown names 404 before rendering.
- **Fix**:
  - Tighten the shape: a fixed segment has no digits and no `.`; dynamic parts appear only as `[x]` / `[...x]`; at most 80 characters.
  - Move the derivation into a pure, tested `requestRoute(routePattern, params)` in `log-failure.ts` or beside it. It substitutes the island name only through `NAME_SHAPE` and never reads a URL.
  - Test: a template is kept; a pathname with an id or coordinates is dropped; an island name is substituted; an undefined pattern gives no route. Strength: the privacy guarantee becomes a test, not a promise. Tradeoff: a future static route with a digit in a fixed segment loses its route (noise lost, never a leak). Confidence: HIGH. Blind spot: an island component named with digits would be dropped by its numeric suffix only.
- **Decision**: FIXED

### F4 — The plan names the wrong Astro render path, and the error path question is already settled
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Claim Accuracy
- **Location**: plan.md, Overview, Key Discoveries, Critical Implementation Details; plan-brief.md, Open Risks
- **Detail**:
  - On workerd with `nodejs_compat`, `isNode` is true (`runtime/server/util.js:159`), so `page.js:42` takes `renderToAsyncIterable` → `renderStreamToAsyncIterable` (`render.js:81-178`). There the error is stored (:167-169) and thrown from the iterator (:102-104), dropping already-buffered bytes, which matches the probe's 200 with 0 B. Nothing is logged. The design still holds: the Response's `body` is a ReadableStream whose read rejects with the same error (workerd-tested).
  - The open question of which error path production uses is settled. The adapter's `app.render` runs `handleRequest` (`core/app/base.js:260-267`, no custom `src/fetch.ts`), and user middleware sits in `handleMiddleware` (`routing/handler.js:80`). A page or endpoint throw therefore **rejects** `next()`, and the outer catch logs `[ERROR]` (:101-108). The resolved-5xx branch is a safety net only.
  - Line references to correct: attach is at :42, the routing catch at :101-108.
- **Fix**: rewrite these Key Discoveries with the async-iterable path and the settled error path. Keep the ≥500 branch as a commented safety net. Drop "which path" from the brief's Open Risks and from Phase 2's "settles" note.
- **Decision**: FIXED

### F5 — The smoke and e2e commands are not runnable as written
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Verifiability
- **Location**: plan.md, Phase 2 Success Criteria (2.6, 2.7)
- **Detail**:
  - `npm run smoke` and `npm run test:e2e` need several things the plan omits (lessons.md "Run the whole e2e suite before a PR"; CLAUDE.md Commands):
    - a fresh `npm run build`;
    - a running preview with `dist/server/.dev.vars` pointed at local Supabase;
    - the forecast fixture;
    - `BASE_URL`;
    - the local stack's `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY>` inline, never exported.
  - Every node command also needs the `nvm use` prefix.
- **Fix**: spell out both commands as the lesson describes, and name the setup steps.
- **Decision**: FIXED

### F6 — The probe step loses P5 and overwrites the "before" evidence
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Verifiability
- **Location**: plan.md, Phase 2 › 1
- **Detail**:
  - The probe worktree is on `b4273c9`. `src/middleware.ts` is unchanged since then, so bringing the files over is conflict-free.
  - But copying `src/middleware.ts` removes the probe's `probeThrow(context.request, "p5")` line, so P5 silently turns into a 200.
  - `probe/run.sh` overwrites `probe/results.json`, `suite.out` and `preview.log`, the only "before" record.
- **Fix**: before the run, copy the three outputs to `probe/before/`. After applying this change's files, re-add the `p5` probe line to the worktree's middleware.
- **Decision**: FIXED

### F7 — The brief promises coverage of middleware throws that the plan does not give
- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Coverage
- **Location**: plan-brief.md (What & Why, Desired End State) vs plan.md (Desired End State, Phase 2 criteria)
- **Detail**:
  - The brief says every uncaught "… middleware throw" logs `request.uncaught`, but the `try` covers only `next()`. A throw in `sessionUser`, `createClient` or the preference code (probe P5) still gets only Astro's `[ERROR]` line.
  - P10b (a throw in the island's own frontmatter, a 500) will also log `request.uncaught`, but the criteria don't list it.
- **Fix**:
  - Scope the wording to "a throw from `next()` (page, endpoint, island)" and add P5 to What We're NOT Doing, as Astro already logs it.
  - Add P10b to the "exactly one `request.uncaught`" criterion.
  - Alternatively, wrap the whole middleware body; but the pre-`next()` code is already covered by Astro's line and `sessionUser`'s own logging.
- **Decision**: FIXED

### F8 — A future `/500` page would log `request.uncaught` twice
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Coverage
- **Location**: plan.md, Phase 1 › 3, the resolved-5xx rule
- **Detail**: `renderDefaultError` (`core/errors/default-handler.js`) runs the middleware again for an existing `/500` route with status 500. There is no `500.astro` today, but #190 will add one.
- **Fix**: skip the ≥500 branch when `routePattern === "/500"`, with a comment, and note it on #190.
- **Decision**: FIXED

### F9 — The audit report's commit is placed in Phase 2 but should be in "the first commit"
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Sequencing
- **Location**: plan.md, Phase 2 › 3
- **Detail**: the contract says "committed unchanged in this change's first commit", which is Phase 1's commit.
- **Fix**: move the item to Phase 1.
- **Decision**: FIXED

### F10 — No GitHub issue or board #1 step
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Coverage
- **Location**: change.md, plan.md (no reference)
- **Detail**: every Sidereus change is mirrored on the GitHub Projects board #1 (owner rule). Neither file names an issue.
- **Fix**: open an issue (labels per the board convention), add it to the board, and record the number in `change.md` Notes and the plan's References. This happens at the start of Phase 1, not as a code step.
- **Decision**: FIXED
