# Production Error Visibility (M-4 S-07) — Plan Brief

> Full plan: `context/changes/error-visibility/plan.md`
> Audit (replaces research and frame): `context/audits/observability/2026-10-15_tonight-save-routes-auth-finder-plan.md`

## What & Why

The operator cannot see most production failures. A Supabase, Open-Meteo or engine failure ends as a 200 page with a notice, a stale-forecast fallback or a 302 `?error=<key>`, and the whole app has 7 `console.error` lines. This change makes every failure in Tonight, the save routes, sign-in and the finder chart and plan edits, and in the browser (service worker and React islands), leave one first-party line with its cause, groups them in Workers Issues for alerting, and keeps coordinates, emails, keys, user and site IDs and form values out of every line. No third-party vendor (owner, 2026-10-15).

## Starting Point

The audit found 33 gaps (4 critical) and six root causes: privacy enforced by silence, stores that drop the PostgREST code, degrade-to-200/302 as the only failure shape, Supabase `{ error }` results not read (the middleware ignores `getClaims`' error), work outside any reporting path, and no shared log vocabulary. The browser side has no way to report at all: `sw.ts` swallows about 20 failures and the islands have no global handler. Workers Logs and traces are on; Workers Issues is not. `no-console` is an error everywhere and every log needs a counted allowlist entry.

## Desired End State

Every failure in the four flows, and the browser failures reported through one rate-limited endpoint, shows in Workers Logs and Workers Issues as `sidereus: <step> failed` with `step`, `name`, `code`, `status` and no identifier; Workers Logs' own invocation metadata ties a request's lines together. A server fault in a save redirects with its own neutral "Something went wrong on our side" message; a user mistake, an RLS refusal or a stale session keeps today's. A guard test stops the next silent catch. The operator has a runbook and one working alert automation.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Alert path | Workers Issues via `observability.issues.enabled`; owner creates the automation | First-party; a logged error is a recorded signal | Plan (owner rule: first-party) |
| Log shape | One helper, `console.error("sidereus: <step> failed", { step, name, code?, status? })` | A fixed message per step groups in Issues; fields filter in Workers Logs | Plan |
| Privacy and IDs | Closed step list, `CODE_SHAPE` codes, no message, stack, URL, `Error` object or identifier of any kind | Keeps the coordinate NFR true by construction; Workers Logs already groups a request's lines | Audit + plan; owner (D4, no request ID) |
| Save faults | Keep the 302 convention; only real server faults get `errors.serverFault` (neutral copy, fits deletes); RLS refusals, session faults and zero-row updates keep the entity key and log a warn-level notice | Separates server fault from user mistake and never claims the database was unreachable | Owner (D3) + plan review F1 |
| First deploy | Phase 1 ships alone with one real probe line (`forecast.fetch`); Phase 3 waits for the Issues grouping check | The line shape assumes Issues groups by message | Plan review F5 |
| Browser errors | `POST /api/client-error`: same-origin, 512 bytes, strict schema, closed steps, Workers Rate Limiting (constant key); reporters capped and deduped; offline reports dropped | Bounds volume and forgery without a personal key | Owner (D5) + plan |
| Data layer | Results and thrown errors carry a sanitized `StoreFault` (code, status) | A future line has something to say | Audit RC2 |
| Regression guard | `silent-catch` ratchet test, green on day one, tightened per phase | The only thing that stops the next silent catch | Plan |
| Out | Release field, island/404/500 UI, plan-unknown state, queued offline reports | Each adds a binding, storage or UI; follow-ups | Plan (D6, D7, D10) |

## Scope

**In scope:** the helper and guard; sanitized faults in stores and the forecast client; traces in Tonight, forecast, save routes, plan routes, page reads, auth, middleware and finder; the one new error key; Issues config; runbook; CLAUDE.md rule and a lesson; the client-error endpoint with its rate limiter, service-worker reporting and island reporting (Phases 7-9, cuttable).

**Out of scope:** third-party tools; user, site or IP identifiers; storing or queueing reports on the device; release metadata; any new UI beyond one message key; engine, ranking or fallback behaviour changes.

## Architecture / Approach

One server-only helper is the only `console.error` site. Stores and `open-meteo.ts` keep a sanitized fault. Each swallow point calls the helper with a step word. Routes call one `saveFailureKey` that logs and picks the redirect key. A TypeScript-AST guard lists every `catch` and `.catch` that neither reports, rethrows with a cause nor is justified, including the empty, fallback, rethrow-without-cause and error-to-redirect shapes. Unit tests reach Astro's virtual modules through shared mock factories. Wrangler enables Workers Issues so each line is alertable from its first deploy. For the browser, a pure reporter core builds a sanitized `{ source, step, name?, code? }` and posts it to the rate-limited endpoint, which logs it through the same helper; the worker and a global page handler use that core.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Helper, guard, Issues config, probe (own PR) | `logFailure` / `logNotice`, seven lines moved, ratchet test, Vitest seams, Wrangler bump, Issues flag, `forecast.fetch` probe line | The Wrangler bump (4.134+); how Issues groups a handled log |
| 2. Stores and forecast keep the cause | `StoreFault`, `classifyFault` (server by default; `42501`, `PGRST301/302/303`, `PGRST116` excluded), fault on write results, cause on thrown reads, `ForecastError` | A wide mechanical diff across five stores |
| 3. Tonight and forecast traces | Lines for forecast, list reads, build, sky-check record; bad zone no longer a 500 | Forcing each swallow in tests |
| 4. Save routes and page reads | `saveFailureKey`, new EN/PL key, route and page lines, `formData` guard | Many routes; keeping validation paths unchanged |
| 5. Sign-in, session, finder | `sessionUser` extracted and tested; routine `getClaims` errors silent, failures logged; auth route lines; sign-out result; finder `failed` reasons | Getting the routine-versus-failure list right |
| 6. Operator path and rule | Runbook, allowlist, CLAUDE.md rule, lesson, live alert proof with the owner | Needs the owner in the dashboard; Issues may not group a handled log |
| 7. Client-error endpoint (cuttable block starts; cut-off dates below) | Route, rate limiter binding, reporter core, middleware short-circuit, smoke checks | A public route: abuse and log volume |
| 8. Service-worker reporting | ~20 swallowed worker sites report a step; behaviour unchanged | A worker that reports must not change what it stores |
| 9. Island reporting | Global handlers, lazy-load catches, import guard, e2e, docs | Browser noise (cross-origin errors, denied geolocation) |

**Prerequisites:** none; Wrangler 4.134.0 or later; local Supabase for the DB, smoke and e2e steps.
**Estimated effort:** about 9 sessions across 9 phases, mostly Sonnet; no UI phase. Phases 7-9 (about 3 sessions) can be cut for the 2026-11-04 deadline: 1-6 ship alone; cut 7-9 whole if Phase 6 is not merged by 2026-10-28; cut 8 and 9 if Phase 7 is not deployed by 2026-10-30; after 7, keep whichever of 8 and 9 is deployed by 2026-11-02.

## Open Risks & Assumptions

- Workers Issues must group a plain `console.error(string, object)`; the docs say logged errors are recorded, but the live proof is Phase 6 (fallback: a saved Workers Logs query).
- Workers Issues availability on the account's plan is unconfirmed (assumption).
- Workers Logs attaches the script version to each invocation (assumption; the runbook confirms it).
- The Rate Limiting binding is per Cloudflare location and permissive; it bounds volume, it is not exact accounting. The `namespace_id` must be an integer unused in the account.
- Reports made while a device is offline are lost (no queue), so a worker failure during an outage is seen only on the next online failure.
- Defaults D1, D2, D6-D12 are the planner's; D3, D4 and D5 are the owner's. The plan review's F1-F7 are applied (see the plan's review table).

## Success Criteria (Summary)

- A deliberately broken forecast URL, Supabase or Auth produces a grouped Issue naming the step, with no private data in the line.
- A server fault in a save tells the user "Something went wrong on our side, so nothing was changed" and the operator which step failed.
- CI fails on a new silent catch, and the existing suites, lint, types, build and e2e stay green.
- A thrown error in a page and a failed worker store each arrive as a grouped line carrying only a step and a name.
