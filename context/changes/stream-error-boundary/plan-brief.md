# Stream error boundary — Plan Brief

> Full plan: `context/changes/stream-error-boundary/plan.md`
> Plan review: `context/changes/stream-error-boundary/reviews/plan-review.md` (all findings applied)

## What & Why

The 2026-10-27 observability audit proved at runtime that an unforeseen throw in any child component of a page or server island ends as a **200 with an empty body and no log line** (finding P1, critical). Astro streams on Workers, records the error, and ends the body; workerd prints nothing. The user sees a blank page or a skeleton that never resolves; the responder sees nothing.

This change makes that failure leave one shaped `sidereus:` line with the route. It does the same for a throw coming out of a page's own frontmatter, an endpoint or an island's own frontmatter, which today has only Astro's unstructured `[ERROR]` line.

## Starting Point

`src/middleware.ts` calls `await next()` with no `try` and never touches the body. Its existing test (`src/lib/auth/middleware.test.ts`) runs it over a fake context. `log-failure.ts` has no request-level failure step and no route field. The audit's probe harness, in an isolated worktree, reproduces every shape.

## Desired End State

- A child-component throw logs `sidereus: request.stream failed` with its `name` and `route` (e.g. `/_server-islands/TonightContent`, `/log/[id]`), so it becomes a Workers Issue.
- A throw out of `next()` logs exactly one `sidereus: request.uncaught failed` line.
- A client disconnect and a clean response log nothing. Users see no difference, and no line can carry a pathname, id or coordinate.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Streaming | Keep it; add a middleware wrapper | Fixes every page and island in one file and keeps first-byte time | Audit D1 (owner, 2026-10-27) |
| Where to catch | Middleware: `try` around `next()` (log, rethrow) and a guarded HTML body stream; a resolved-5xx branch only as a commented safety net | A page or endpoint throw rejects `next()` in production, and only a stream wrapper sees child throws | Plan, settled in plan review |
| Guard shape | `guardStream(source, step, extra)` calls `logFailure` itself, no callback | A callback would be a "silent" catch to the silent-catch guard | Plan review F1 |
| Route context | A shaped `route` field built only by a pure, tested `requestRoute(routePattern, params)`: templates only (fixed segments without digits or dots), and the island's name for `/_server-islands/[name]` | A line without a route can't say which page broke; the shape test proves no pathname gets through | Plan (delegated), tightened in plan review F3 |
| Middleware's own pre-`next()` code | Not covered by a new line | Astro already logs it as `[ERROR]` with a 500, and `sessionUser` has `auth.claims` | Plan review F7 |
| Client disconnect | `cancel` forwards and never logs | A user leaving mid-stream is not a fault; noise would train the owner to ignore Issues | Plan (delegated) |
| User-facing fallback | None here; it stays in #190 | Visibility first, UI later with a design pass | Plan (delegated) |
| Runtime proof | The audit's probe suite before/after, never committed | The probes inject throws and must never ship | Plan |

## Scope

**In scope:**
- `request.stream`, `request.uncaught`, the `route` field and `requestRoute` in `log-failure.ts`.
- The new `stream-guard.ts`.
- The middleware wiring and its existing test.
- The runbook and CLAUDE.md lines.
- Committing the audit report, and the GitHub issue on board #1.

**Out of scope:**
- The other audit findings: fault-kind classification, burst escalation, service-worker and client reporting.
- Release identity (#189).
- Failure UI and 404/500 pages (#190).
- Any change to status codes or bytes.
- A new line for throws before `next()`.

## Architecture / Approach

```
request → middleware → route = requestRoute(routePattern, params)
  ├─ next() throws          → logFailure("request.uncaught", {route}) → rethrow (Astro logs [ERROR], renders 500)
  ├─ next() resolves ≥ 500  → safety net only (not expected today; skipped for /500)
  └─ HTML body → guardStream(body, "request.stream", {route}) → new Response(same status/headers)
                     └─ body read rejects → logFailure once → same error to the client; cancel → no line
```

Cookies stay because Astro re-attaches `context.cookies` to whatever Response the middleware returns (`astro-middleware.js:42`).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Stream guard and the request lines | GitHub issue; `requestRoute` + steps in `log-failure.ts`; `stream-guard.ts`; middleware wiring + its test; the audit report committed | A route shape that lets a value through (now pinned by the shape test) |
| 2. Runtime proof, runbook and the PR gates | Probe suite before/after (P5 restored, "before" kept), runbook and CLAUDE.md, full e2e and smoke run the way CI does | The probe worktree drifting from main; e2e cookie flows |

**Prerequisites:** local Supabase (`npx supabase start`); the audit's probe worktree kept in place; `gh` authenticated with the `project` scope.
**Estimated effort:** about one session, across 2 small phases.

## Open Risks & Assumptions

- No route returns a 5xx on purpose today, so the resolved-5xx branch should never fire. A future deliberate 5xx would need to opt out.
- Local workerd ended the errored body as a clean empty 200. Production might end it differently, but the line is written in the guard either way.

## Success Criteria (Summary)

- The four probes that are "missed" today each leave one `request.stream failed` line, P1, P3 and P10b each leave exactly one `request.uncaught failed` line, and a clean request leaves none.
- Smoke and the whole e2e suite stay green, and responses are unchanged for a clean request.
- After the deploy, no disconnect noise appears under `sidereus: request.`.
