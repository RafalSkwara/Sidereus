# Production Error Visibility (M-4 S-07) — Plan Brief

> Full plan: `context/changes/error-visibility/plan.md`
> Audit (replaces research and frame): `context/audits/observability/2026-10-15_tonight-save-routes-auth-finder-plan.md`

## What & Why

The operator cannot see most production failures. A Supabase, Open-Meteo or engine failure ends as a 200 page with a notice, a stale-forecast fallback or a 302 `?error=<key>`, and the whole app has 7 `console.error` lines. This change makes every failure in Tonight, the save routes, sign-in and the finder chart and plan edits leave one first-party line with its cause, groups them in Workers Issues for alerting, and keeps coordinates, emails, keys and form values out of every line. No third-party vendor (owner, 2026-10-15).

## Starting Point

The audit found 33 gaps (4 critical) and six root causes: privacy enforced by silence, stores that drop the PostgREST code, degrade-to-200/302 as the only failure shape, Supabase `{ error }` results not read (the middleware ignores `getClaims`' error), work outside any reporting path, and no shared log vocabulary. Workers Logs and traces are on; Workers Issues is not. `no-console` is an error everywhere and every log needs a counted allowlist entry.

## Desired End State

Every failure in the four flows shows in Workers Logs and Workers Issues as `sidereus: <step> failed` with `step`, `name`, `code`, `status`. A server fault in a save redirects with its own "could not reach the database" message, a user mistake keeps today's. A guard test stops the next silent catch. The operator has a runbook and one working alert automation.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Alert path | Workers Issues via `observability.issues.enabled`; owner creates the automation | First-party; a logged error is a recorded signal | Plan (owner rule: first-party) |
| Log shape | One helper, `console.error("sidereus: <step> failed", { step, name, code?, status? })` | A fixed message per step groups in Issues; fields filter in Workers Logs | Plan |
| Privacy | Closed step list, `CODE_SHAPE` codes, no message, stack, URL, `Error` object or identifier | Keeps the coordinate NFR true by construction | Audit + plan |
| Save faults | Keep the 302 convention; server faults get `errors.save.unavailable` | Separates server fault from user mistake without a new error shape | Plan (default D3) |
| Data layer | Results and thrown errors carry a sanitized `StoreFault` (code, status) | A future line has something to say | Audit RC2 |
| Regression guard | `silent-catch` ratchet test, green on day one, tightened per phase | The only thing that stops the next silent catch | Plan |
| Out | Service-worker and client reporting, release field, island/404/500 UI, plan-unknown state | Each adds an endpoint, a binding or UI; follow-ups | Plan (D5-D7) |

## Scope

**In scope:** the helper and guard; sanitized faults in stores and the forecast client; traces in Tonight, forecast, save routes, plan routes, page reads, auth, middleware and finder; the one new error key; Issues config; runbook; CLAUDE.md rule and a lesson.

**Out of scope:** third-party tools; identifiers in lines; service worker and React error reporting; release metadata; any new UI beyond one message key; engine, ranking or fallback behaviour changes.

## Architecture / Approach

One server-only helper is the only `console.error` site. Stores and `open-meteo.ts` keep a sanitized fault. Each swallow point calls the helper with a step word. Routes call one `saveFailureKey` that logs and picks the redirect key. A TypeScript-AST guard lists every catch that neither logs nor is justified. Wrangler enables Workers Issues so each line is alertable from its first deploy.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Helper, guard, Issues config | `logFailure`, seven lines moved, one allowlist entry, ratchet test, Wrangler bump and Issues flag | The Wrangler bump (4.134+) and the generated config carrying the flag |
| 2. Stores and forecast keep the cause | `StoreFault`, `isServerFault`, fault on write results, cause on thrown reads, `ForecastError` | A wide mechanical diff across five stores |
| 3. Tonight and forecast traces | Lines for forecast, list reads, build, sky-check record; bad zone no longer a 500 | Forcing each swallow in tests |
| 4. Save routes and page reads | `saveFailureKey`, new EN/PL key, route and page lines, `formData` guard | Many routes; keeping validation paths unchanged |
| 5. Sign-in, session, finder | `getClaims` error logged, auth route lines, sign-out result, finder `failed` reasons | Not logging anonymous visitors |
| 6. Operator path and rule | Runbook, final allowlist, CLAUDE.md rule, lesson, live alert proof with the owner | Needs the owner in the dashboard; Issues may not group a handled log |

**Prerequisites:** none; Wrangler 4.134.0 or later; local Supabase for the DB, smoke and e2e steps.
**Estimated effort:** about 6 sessions across 6 phases, mostly Sonnet; no UI phase.

## Open Risks & Assumptions

- Workers Issues must group a plain `console.error(string, object)`; the docs say logged errors are recorded, but the live proof is Phase 6 (fallback: a saved Workers Logs query).
- Workers Issues availability on the account's plan is unconfirmed (assumption).
- Workers Logs attaches the script version to each invocation (assumption; the runbook confirms it).
- Defaults D1-D8 are the planner's; the owner can override them at plan review.

## Success Criteria (Summary)

- A deliberately broken forecast URL, Supabase or Auth produces a grouped Issue naming the step, with no private data in the line.
- A server fault in a save tells the user "could not reach the database" and the operator which step failed.
- CI fails on a new silent catch, and the existing suites, lint, types, build and e2e stay green.
