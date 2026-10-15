# Production Error Visibility (M-4 S-07) Implementation Plan

> **Status (2026-10-15 evening): second plan review applied (F1-F7, phases 7-9 and Phase 1's deploy check; decisions in the table "Second plan review" below and in `reviews/plan-review.md`). Phases 1-6 were ready after that review. Implementation starts at Phase 1; every Progress row below is unchecked.**

## Overview

Give the operator one first-party signal for every failure in the critical flows (Tonight and its forecast, the save routes, sign-in and session, the finder chart and Session-plan edits, and the browser side: the service worker and the React islands), with its cause, and an alert path, without a coordinate, email, key, user or site ID or form value ever reaching a log.

Today a Supabase, Open-Meteo or engine failure ends as a 200 notice, a stale-forecast fallback or a 302 `?error=<key>`, and only 7 `console.error` sites exist in the whole app (`context/audits/observability/2026-10-15_tonight-save-routes-auth-finder-plan.md`, 33 findings, 4 critical). The plan adds one logging helper with a closed vocabulary, makes the data layer keep the diagnosis it drops today, logs at every swallow point, ratchets the silent catches with a guard test, and switches on Workers Issues (Cloudflare's own grouping and alert path) with an operator runbook. Phases 7-9 add a first-party, rate-limited, sanitized collection endpoint and the reporting from `src/sw.ts` and the islands; they can be cut late as a block (deadline 2026-11-04). No new third-party vendor (owner, 2026-10-15).

## Current State Analysis

- **The audit is the research.** `context/audits/observability/2026-10-15_tonight-save-routes-auth-finder-plan.md` holds the capture model, 33 merged findings (F1-F33), six root causes (RC1-RC6) and a fix order. Findings are cited below by id. No `research.md` or `frame.md` exists; the audit replaces them.
- **Capture today:** Workers Logs and traces are on (`wrangler.jsonc:15-22`, `redact_query_string: true`); Astro logs an uncaught throw with its stack and returns a 500 (audit §2); everything handled is silent. The seven `console.error` lines carry a fixed string plus `error.name` (two add a code): `src/lib/tonight/build.ts:1415,1439`, `src/lib/finder/load.ts:171,194`, `src/lib/tonight/load.ts:53`, `src/lib/account-plan/index.ts:45`, `src/lib/observations/celebrate.ts:45`.
- **The privacy rule is implemented by silence (RC1).** `no-console` is an error everywhere under `src`, with exact allowlist counts in `src/lib/no-console-guard.test.ts` (`ALLOWED_DISABLES`). Module headers say "nothing is logged" (`src/lib/forecast/service.ts:23`, `src/pages/api/tonight/plan.ts:20`).
- **The data layer drops the cause (RC2).** Stores read `error.code` to pick a key, then discard it (`src/lib/gear/store.ts:65-73`); reads throw `new Error(KEY)` with no `cause` (`src/lib/gear/store.ts:148-289`, `src/lib/observations/store.ts:151,163`, `src/lib/sky-checks/store.ts:85,149,161`, `src/lib/onboarding/store.ts:70-89`); `src/lib/forecast/open-meteo.ts:84-108` collapses every cause into two fixed messages. The safe pattern exists once: `CODE_SHAPE` and `logPlanEditsFailure` in `src/lib/tonight/load.ts:40-54` log only a shape-checked code or a name. `session-plans/store.ts:36` keeps a `cause` but it is the raw `PostgrestError`, whose message can echo submitted values; Phase 2 replaces it with a sanitized carrier.
- **Supabase result errors go unread (RC4).** `src/middleware.ts:15` takes only `data` from `getClaims()`; auth-js returns auth failures as `{ data: null, error }` (`GoTrueClient.ts:6715,6791-6794`, verified), so the `catch` at `:18` is nearly dead and an Auth outage reads as a mass sign-out.
- **Cloudflare's own tools** (checked 2026-10-15 in the Cloudflare docs): Workers Issues "detects production failures and groups related failures into issues without an SDK"; it records uncaught exceptions, failed invocations, `5xx` responses and **logged errors**, and "to record an error that your application catches, pass the caught value to `console.error()`"; automations route an issue to a webhook, chat service or incident tool. Enabling needs `observability.issues.enabled: true` in the Wrangler config and Wrangler 4.134.0 or later (the repo has `^4.131.1`); a dashboard-only enable is turned off by the next deploy. Workers Logs recommends structured (JSON-object) logs, which it indexes by field. Since 2026-08-24 `console.*` also preserves an `Error` argument's message and stack, so an `Error` object must never be passed.

- **The browser side is silent (RC5).** `src/sw.ts` has 17 `.catch(() => undefined)`, one `.catch(() => null)` and two bare `catch {}` (lines 79, 85, 254, 340, 402, 507, 585, 685-798) and no way to reach the server; React islands have no global handler, and several dynamic-import failures reset a memo and nothing else (`map-panel.tsx:52`, `LocationPicker.tsx:64,74`, `gear/catalogue/load.ts:15,23`, `offline/register.ts:8`). The only `reportError` goes to the browser console (`map-panel.tsx:167`).

### Key Discoveries:

- Only `src/lib/tonight/load.ts`'s `CODE_SHAPE` (`/^[0-9A-Za-z_]{1,12}$/`) is a ready, reviewed filter for a Postgres or PostgREST code; the new helper reuses it.
- `src/lib/no-console-guard.test.ts` counts `eslint-disable` lines per file exactly and fails on an allowance not fully used, so moving the seven lines into one helper file shrinks the allowlist to one entry.
- The Workers Rate Limiting binding is GA (`ratelimits` in the Wrangler config with an integer `namespace_id` and a `limit` per 10 or 60 s; `env.<NAME>.limit({ key })`); its counters are per Cloudflare location and permissive, which suits log-flood protection. Cloudflare advises against IP keys, and we may not use personal keys anyway, so the key is one constant.
- React 19 (`^19.2.6`) reports an uncaught render or event error through `window.reportError`, which fires a window `error` event, so one global handler sees island errors without per-island error boundaries.
- `src/sw.ts` registers its navigation route for `GET` and for `POST` (`registerRoute(isNavigation, networkOrOffline, "GET")` and `"POST"`, lines 766-767), but `isNavigation` requires `request.mode === "navigate"`, which neither a `fetch` nor a `sendBeacon` has, so a `POST` to a report endpoint passes through the worker untouched (review 2, F7a).
- `src/middleware.ts` runs for every request, including a report beacon, and would call Supabase Auth for it; the report route must be short-circuited before the session is resolved.
- No route under `src/pages/api/**` has a unit test, but each is a plain exported `POST` over `context`; a fake context plus the Phase 1 mocks for the virtual modules the route imports (`astro:env/server`, `cloudflare:workers`) is enough to test one (review 2, F7c).
- The Stop hook runs the whole unit suite at the end of every turn (CLAUDE.md "Agent hooks"), so a standing red test cannot be committed between phases; a ratchet must start green and each phase tightens it.

## Desired End State

When the operator opens Workers Logs or Workers Issues, every failure in the four flows shows up as a line with a fixed per-step message (`sidereus: forecast.fetch failed`) and indexed fields (`step`, `name`, `code`, `status`), grouped by step in Issues and routable by an automation. Lines carry no identifier; the lines of one failing request are put together by Workers Logs' own invocation metadata (`cf-ray` and the rest of the invocation event). Failures in the service worker and in the islands reach the same logs through one rate-limited, sanitized endpoint (`POST /api/client-error`: closed step list, no message, no stack, no URL) as warn-level `noted` lines: the endpoint is public, so its reports never create an Issue (review 2, F1); the runbook gives a count query for a real burst. A save route that failed because of the server redirects with its own neutral key ("Something went wrong on our side, so nothing was changed") instead of the entity's "could not save", so a user mistake and a server fault differ in the redirect and in the log. The stores keep the PostgREST code and HTTP status in a sanitized `cause`. A `silent-catch` guard test lists every catch in runtime code that neither logs nor is justified, so a new silent catch fails CI. The operator has a runbook (`context/deployment/error-visibility.md`) with the Issues switch, the queries per step and the automations to create. Verify with: the unit suites in each phase, `npm run lint`, `npx astro check`, and one local run with a dead forecast URL and a stopped Supabase showing the lines (Phase 6).

## Decisions

Owner on 2026-10-15: first-party tools only; no private data in any report or log. The rest are plan defaults; the owner can override each at plan review.

| # | Decision | Choice | Why |
| --- | --- | --- | --- |
| D1 | Alert path | Workers Issues, enabled in `wrangler.jsonc`; the owner creates the automation in the dashboard | First-party, no SDK; `console.error` is a recorded signal |
| D2 | Log shape | `console.error("sidereus: <step> failed", { step, name, code?, status? })`; message fixed per step, fields structured | One message per step groups in Issues; fields filter in Workers Logs |
| D3 | Save-route faults | Keep the 302 convention (owner, approved); a real server fault redirects with `errors.serverFault`, whose copy is neutral and fits saves and deletes ("Something went wrong on our side, so nothing was changed. Try again in a moment."); RLS refusals, session faults, no-row updates and input errors keep the entity key | Smallest change that separates the two; the copy never claims the database was unreachable (review F1) |
| D4 | Identifiers in lines | None (owner, 2026-10-15, reversed after the plan review): no custom request ID, no user, site or other ID in any line; correlation relies on the invocation metadata Workers Logs already attaches | Workers Logs groups a request's lines by invocation, so an own ID adds nothing; keeps the privacy NFR trivially true |
| D5 | Service worker and client errors | In (owner, 2026-10-15): a first-party endpoint plus reporting from `sw.ts` and the islands, as Phases 7-9, cuttable as a block | Closes RC5 for the browser side |
| D6 | Release identity | Out: rely on the version Workers Logs attaches to each invocation; the runbook confirms it | A `version_metadata` binding would make the helper need `cloudflare:workers` |
| D7 | Island failure state (F13), 404/500 pages (F15), neutral plan state (F12), finder eyepiece notice (F28) | Out: user-visible UI and copy | UI changes need their own design pass; the server side of each is logged |
| D9 | Endpoint limits | `POST /api/client-error`: same-origin only, body at most 512 bytes (enforced while reading, not after), strict schema with a closed step list, one constant-key Workers Rate Limiting binding (30 per minute per location), client-side caps (5 per page, 10 per worker wake-up, one per step and name). Limits **confirmed by the owner, 2026-10-15 evening** | Bounds log volume without a personal key; it does not authenticate reports, which is why D13 makes them notices |
| D10 | Offline reports | A report made while the device is offline is dropped, not queued | A queue stores data on the device and adds a privacy surface; the next online failure is reported |
| D8 | Regression guard | A `silent-catch` ratchet test over every `catch` and `.catch`, green on day one, tightened per phase (review F2) | The only thing that stops the next silent catch, whatever its shape |
| D11 | Phase 1 ships alone | Phase 1 is its own PR, merged and deployed by the owner, with a real probe line (`forecast.fetch`); Phase 3 waits for the Issues grouping check (review F5, Fix A) | The whole line shape assumes Issues groups by message; learn it before ~30 steps exist |
| D12 | Notices vs failures | `logNotice` (warn) for refusals, stale sessions and zero-row updates; `logFailure` (error) only for real faults | Keeps stale ids and expired sessions from waking the operator |
| D13 | Client reports are untrusted | Every accepted `/api/client-error` report is logged with `logNotice` (warn, `sidereus: client.<step> noted`), never `logFailure`; a real burst is found by a saved Workers Logs query on `step` with a count threshold, described in the runbook (second review F1, Fix A) | `curl` sets any `Origin` and any field, so a public endpoint cannot be allowed to create Issues and wake the operator with forged steps |
| D14 | Routine network faults in the worker | At a site whose guarded operation is a network `fetch`, a `TypeError`, `AbortError` or `TimeoutError` is routine (the field has weak signal) and is not reported; cache, storage, parse and unknown errors are reported. The per-worker cap is per wake-up, not per device (second review F2) | Offline mode exists for the field, so network errors are the normal case and would drown the rare real faults |
| D15 | Own-script filter for islands | A window `error` event is reported only when its `filename` starts with `location.origin + "/_astro/"` (checked in the browser, never sent); an error whose message mentions hydration reports as `island.hydration`; `unhandledrejection` has no filename and is reported unfiltered (second review F3) | `island.uncaught` should mean "our code", not an extension's script or a translator's DOM change |

### Cut-off for Phases 7-9 (deadline 2026-11-04)

Phases 1-6 are the commitment and never depend on 7-9. Phases 7-9 (about three sessions plus review, merge and deploy) are one cuttable block with explicit dates:

- If Phase 6 is not merged by **2026-10-28**, Phases 7-9 are cut as a block and not started.
- If Phase 7 is not deployed by **2026-10-30**, Phases 8 and 9 are cut (Phase 7 alone has no reporter).
- After Phase 7, Phases 8 and 9 are independent: keep whichever is merged and deployed by **2026-11-02** and cut the other.
- Cutting means: mark the phase `cut (<date>)` in Progress, keep its silent-catch allowlist entries with the reason "client reporting cut, follow-up #<n>", and open one follow-up issue for the cut part (the owner's D5 decision is the source). Nothing already merged is reverted.

### Plan review (2026-10-15, `reviews/plan-review.md`, verdict REVISE)

| Finding | Decision | Where |
| --- | --- | --- |
| F1 `isServerFault` too wide, copy untrue | Fix A taken: default-server table with `42501`, `PGRST301/302/303`, `PGRST116` excluded; neutral copy; `logNotice` for the excluded kinds | D3, D12, Phase 2 §1-2, Phase 4 §1 |
| F2 guard misses the audit's shapes | Taken: every `catch` and `.catch`, five sample shapes in the test | D8, Phase 1 §3 |
| F3 routine vs failure `getClaims` errors | Taken: explicit routine list and failure list, pinned by a table test | Phase 5 §1 |
| F4 virtual modules in Vitest | Taken: shared mock factories, `sessionUser` extracted, route tests under `src/lib/routes` | Phase 1 §4, Phase 5 §1 |
| F5 Issues grouping proof late | Fix A taken: Phase 1 ships alone with a probe line | D11, Phase 1 §6 |
| F6 invocation metadata | Taken: criterion 6.7 and the runbook cover the invocation event's fields | Phase 6 §1 |
| F7 counts, `store.ts:36`, follow-ups | Taken: five allowlist files (seven lines), `store.ts:36` called a problem, follow-up issues in 6.8 | Current State, Phase 1 §2, Phase 2 §3, Phase 6 |
| Owner: D4 reversed | No custom request ID; Workers Logs invocation metadata only | D4 |

### Second plan review (2026-10-15 evening, `reviews/plan-review.md` round 2, verdict REVISE for phases 7-9; phases 1-6 ready)

| Finding | Decision | Where |
| --- | --- | --- |
| F1 forged reports reach Issues and alerts | Fix A taken: client reports are warn-level notices (D13); the alert for a real burst is a saved Workers Logs query with a threshold, which the runbook verifies (whether a query can alert is not confirmed in the docs). Criteria 7.x, 8.7, 9.7 reworded from "failed" and "Issue" to "noted". Not taken: per-family limiter keys (Fix B), because a forger can flood either family and the keys would be chosen before the body is validated; the residual (a flood fills the 30 per minute of one location) is accepted and written down | D9, D13, Phase 7 §2, Phase 9 manual |
| F2 service worker reports routine network faults | Taken: classification in a pure `isRoutineNetworkFault` (D14); the cap is "per wake-up" everywhere; test 8.1 gains the "timeout while `onLine`" case. Safari's Cache API names are unverified, so unknown names are reported (noise, never silence) | D10, D14, Phase 7 §1, Phase 8 §1-2 |
| F3 island handler reports extensions and hydration | Taken: own-script filter and `island.hydration` (D15). **Not taken as written:** the reviewer's proof via an exception on `/design` in a preview, because `/design` returns 404 outside `npm run dev` (`src/pages/design.astro:91`); the e2e instead serves a script from `/_astro/` through `page.route` (positive) and throws from console-style input (negative), and the live check uses a rejected promise (no filename) | D15, Phase 9 §1, 9.3, 9.7 |
| F4 guard does not accept `report` / `reportAnd` | Taken in Phase 1 §3: a call to `report` / `reportAnd` imported from `@/lib/observability/client` or `@/lib/offline/report`, or `.catch(reportAnd(...))`, is a report; sixth sample shape | Phase 1 §3, 1.3 |
| F5 body limit without a reading method | Taken: `Content-Length` first, then a streamed read that stops at the 513th byte; case without `Content-Length` in 7.2 | Phase 7 §2, 7.2 |
| F6 `request.cf` check too late | Taken: the invocation-event geo check moves to 1.9 (first deploy) with the fallback written down; 6.6 keeps URL path and headers | Phase 1 manual, 1.9, Phase 6 §1, 6.6 |
| F7 nits | Taken: (a) `sw.ts:766-767` reason, (b) smoke step says which layer refuses (Astro `checkOrigin` for `text/plain`, the route for JSON), (c) "a fake context" now names the mocks, (d) the probe never touches the production variable (the only option is an uploaded version or a separate Worker) | Key Discoveries, Phase 1 §7, Phase 7 §4 |

## What We're NOT Doing

- No third-party tracker or exporter (Sentry, Datadog, OpenTelemetry destinations, Logpush to a vendor).
- No identifier of any kind (request, user, site, IP), message, stack, URL, file name, coordinate, email, key or form value in any log line or client report (D4); no `Error` object is ever passed to `console.*`. No custom request-ID mechanism.
- No queue or storage of client reports on the device (D10), no per-user rate limit, no IP-keyed limit, no React error boundaries around islands (the global handler covers them, Phase 9).
- No UI for client failures: nothing tells the user a report was sent.
- No `version_metadata` binding or release field (D6; F27).
- No new UI: no island fallback state, no 404/500 pages, no neutral "plan unknown" state, no finder notice (D7; F12, F13, F15, F28). The only copy added is the one `errors.serverFault` key in EN and PL.
- No change to the verdict, ranking, forecast fallback behaviour or any engine rule; the fallbacks stay, they gain a trace.
- No retry, backoff, circuit breaker or rate limiting of the new lines. A line is emitted once per failed step per request.
- No edits under `context/archive/`.

## Implementation Approach

Build the vocabulary first, then make the data layer carry causes, then add the lines flow by flow, widest first. Each phase starts with failing tests: a behaviour test that makes the failure happen and asserts the helper's line (never the message), and a tightened silent-catch allowlist. The helper is the only `console.error` site, so the privacy rule is enforced in one file and one test. Workers Issues is switched on in Phase 1 so every later line is alertable from its first deploy, and Phase 6 proves it end to end with the owner. Phases 7-9 then add the browser side on top of the same helper: 7 builds the endpoint and the shared reporter core, 8 wires the service worker, 9 wires the islands. Phases 1-6 are shippable on their own; 8 and 9 are independent after 7, so late in the schedule the block can be cut whole, or either half kept.

## Phase 1: The failure helper, the guard, Issues config and the first probe line

### Overview

One `logFailure` / `logNotice` helper pair with a closed step vocabulary, the seven existing lines moved onto it, the `no-console` allowlist reduced to one file, a silent-catch ratchet that catches the audit's patterns, the Vitest seams for Astro's virtual modules, `observability.issues.enabled`, and one real trace (`forecast.fetch`) so the owner can prove Issues grouping before the other ~30 steps exist. This phase ships as its own PR (review F5).

### Changes Required:

#### 1. The helper

**File**: `src/lib/observability/log-failure.ts` (new, with `log-failure.test.ts`)

**Intent**: The only place the app writes a failure to the console. It turns an error into the allowed fields and drops everything else (RC1, RC6; F18, F19).

**Contract**: `logFailure(step: FailureStep, error?: unknown, extra?: { status?: number }): void` for an alertable failure, and `logNotice(step, error?, extra?)` with the same fields for an expected-but-countable condition (an RLS refusal, a zero-row update, a stale session on a write): the first calls `console.error`, the second `console.warn`, so only failures are meant to become Issues (verified in Phase 6). `FailureStep` is a closed string union (`FAILURE_STEPS`), dotted names grouped by flow: `forecast.*`, `tonight.*`, `save.*`, `read.*`, `account.plan`, `milestones.*`, `progress.seen`, `finder.*`, `auth.*`, `config.supabase`, `request.form`; one entry per trace site, added as the phases need them. It writes `\`sidereus: ${step} failed\`` (`... noted` for a notice) and a `fields` object `{ step, name?, code?, status? }`: `name` from the error (or its `cause`) only when it matches a short identifier shape, `code` only when it passes `CODE_SHAPE` (moved here and exported; `tonight/load.ts` imports it), and `status` only an integer 100-599. It never reads `message` or `stack`, never passes an `Error` to the console, and never throws. The only two `eslint-disable-next-line no-console` lines (one per level) live here.

#### 2. Move the seven existing lines

**Files**: `src/lib/tonight/build.ts:1415,1439`, `src/lib/finder/load.ts:171,194`, `src/lib/tonight/load.ts:47-54`, `src/lib/account-plan/index.ts:45`, `src/lib/observations/celebrate.ts:39-46`, and the tests that spy on them (`build.test.ts`, `load.test.ts`, `finder/load.test.ts`, `account-plan.test.ts`, `celebrate.test.ts`)

**Intent**: Replace each bespoke `console.error` with `logFailure`; keep behaviour and the fixed-line intent; update the spies to the new line shape.

**Contract**: step words `tonight.session-plan`, `tonight.sky-events`, `finder.stars`, `finder.chart`, `tonight.plan-edits`, `account.plan`, `milestones.read|record|list|seen`, `progress.seen`. `src/lib/no-console-guard.test.ts` `ALLOWED_DISABLES` gains `src/lib/observability/log-failure.ts: { count: 2 }` and drops the five file entries (seven lines) that no longer disable: `tonight/build.ts`, `tonight/load.ts`, `observations/celebrate.ts`, `account-plan/index.ts`, `finder/load.ts`.

#### 3. The silent-catch ratchet

**File**: `src/lib/observability/silent-catch-guard.test.ts` (new)

**Intent**: Fail CI on any catch in runtime code that neither reports nor is justified, so the next silent catch cannot merge, whatever its shape (D8; review F2).

**Contract**: scans non-test source under `src` (`.ts`, `.tsx`, and the frontmatter and `<script>` blocks of `.astro`, parsed with the TypeScript compiler API) for **every** `catch` clause and **every** `.catch(...)` handler. A site passes only when its body calls `logFailure` or `logNotice`, or calls `report` / `reportAnd` / `<reporter>.report` (the browser-side reporters of Phases 7-9, recognised by name and only when the file imports them from `@/lib/observability/client` or `@/lib/offline/report`; for a `.catch(...)` the argument may itself be a call such as `reportAnd("sw.index", undefined)`, which is what Phase 8 writes; the modules do not exist yet, the guard only knows the names), or rethrows with a `cause` (`throw new X(msg, { cause })` or a bare `throw error`); otherwise the file needs an allowlist entry with an exact count and a reason, like `ALLOWED_DISABLES` (an allowance not fully used fails). That covers the shapes the audit found, not only "returns a constant": an empty block with a comment (`forecast/service.ts:169`, `Layout.astro:41`), a fallback expression (`service.ts:216`, `return usable ? fromStored(...) : null`), a rethrow without `cause` (`open-meteo.ts:92-94`, `geocode.ts:98-100`), an error turned into a redirect or key (`api/tonight/plan.ts:59-61`, `return fail(thrownKey(...))`) and a constant. The test carries in-memory samples of those five shapes plus a sixth, a `.catch(reportAnd("sw.index", undefined))` handler imported from `@/lib/offline/report` (green) against the same handler without the import (red), each red without a report and green with one (as the no-console guard does for `.astro`). The first run's inventory (about 80 `catch` clauses plus the `.catch` handlers, `sw.ts` included) becomes the allowlist, so the test is green on day one; later phases delete their entries first. Final allowlist: see Phases 6 and 9.

#### 4. Test seams for the virtual modules

**Files**: `src/lib/test-support/virtual-modules.ts` (new), `src/lib/test-support/virtual-modules.test.ts` (new)

**Intent**: Let unit tests import code that reaches `astro:middleware`, `astro:env/server` and `cloudflare:workers`, which `vitest.config.ts` deliberately does not resolve (review F4).

**Contract**: the file exports factory functions for the mocks (`astroMiddleware` = `{ defineMiddleware: (fn) => fn }`, `astroEnvServer(values)`, `cloudflareWorkers(env)`); a test uses `vi.mock("astro:env/server", async () => (await import("@/lib/test-support/virtual-modules")).astroEnvServer({ ... }))` (the dynamic import keeps the factory hoist-safe). `vitest.config.ts` stays plain. The first test in the file imports `src/middleware.ts`, `src/lib/supabase.ts` and `src/lib/forecast/kv-cache.ts` under these mocks, proving each module loads. Route tests live under `src/lib/routes/*.test.ts` and import the route modules from `@/pages/api/...`: a `*.test.ts` under `src/pages` would be built as an endpoint, and Vitest only includes `src/**/*.test.ts`.

#### 5. Switch on Workers Issues

**Files**: `wrangler.jsonc`, `package.json`, `package-lock.json`

**Intent**: Make every logged error an alertable Issue from the first deploy (D1).

**Contract**: add `"issues": { "enabled": true }` under `observability`; raise the `wrangler` devDependency to at least 4.134.0. Also add a top-level `"preview_urls": true` (owner, 2026-10-15 evening: Version URLs are enabled for the Worker in the dashboard, and a CI deploy must not flip the setting back, as it would a dashboard-only Issues switch); confirm the build carries it into the generated config and that `wrangler deploy --dry-run` accepts it. Confirm `npm run build` still emits the setting into the generated server config and that `npx wrangler deploy --dry-run` accepts it.

#### 6. The probe line

**File**: `src/lib/forecast/service.ts:216` (and its test)

**Intent**: One real trace in the first deploy, so the owner can check how Issues groups a handled `console.error` before the other steps exist (review F5).

**Contract**: the `getForecast` catch logs `forecast.fetch` with the error's name and nothing else; behaviour (stored copy or null) is unchanged. Phase 3 extends this line with the `ForecastError` step and status and adds the other forecast steps.

#### 7. The probe procedure

**Intent**: Trigger the probe line on the real Worker without touching production traffic (owner, 2026-10-15: a preview version of the production Worker, same bindings), with a checked order of fallbacks. The runbook (Phase 6) records the procedure that worked.

**Contract**: the production Worker's active deployment, its variables and its secrets are never changed for the probe: the dead address exists only inside the uploaded version (or the separate Worker), never as a production setting, even briefly (second review F7d). Cloudflare's docs (read 2026-10-15) state that `wrangler versions upload` creates a Version URL that "uses that Worker version's existing configuration and resources", that its `--var key:value` flag overrides config variables, and that invocations are attributable to a version (`ScriptVersion` in Workers Logs/Logpush). They do **not** say in so many words that Version URL invocations appear in the Worker's Workers Logs or create Issues, so the owner's step is verified, not assumed, in this order:
1. **Version URL (the owner's choice).** After `npm run build`, upload a version with the forecast base URL overridden to a dead address, for example `npx wrangler versions upload --tag probe --message "issues probe" --var FORECAST_BASE_URL:http://127.0.0.1:9`, open the printed Version URL's `/tonight` signed in, and look in the production Worker's Workers Logs (filter on the `sidereus:` prefix and the `ScriptVersion`) and in Issues. Production's active deployment and traffic are untouched. `FORECAST_BASE_URL` is an `astro:env` secret; if the override is not picked up as a variable, upload it with `--secrets-file` instead. Version URLs must be enabled for the Worker (`preview_urls`; they follow the `workers.dev` setting): **confirmed enabled by the owner on 2026-10-15 evening**, and `preview_urls: true` is in `wrangler.jsonc` (§5). The upload prints a Version Preview URL; the implementer verifies that it does before opening it, and never deploys.
2. **Worker Preview (documented to have its own logs).** If step 1 shows no log line or no Issue, use `npx wrangler@4.135.0 preview --name probe` (Previews need Wrangler 4.135.0 or later; no repository dependency change) with a `previews` block that sets `FORECAST_BASE_URL` and enables `previews.observability` with `logs.persist` true. Previews are documented to keep their own logs, traces and metrics under the same Worker with the same bindings by default; the docs do not say whether Issues covers a Preview.
3. **A separate `sidereus-probe` Worker.** Only if both fail to produce a line and an Issue: deploy the same build under another name with the dead variable and the secrets and bindings it needs. The orchestrator is told which step was used.

### Success Criteria:

#### Automated Verification:

- Helper tests pass: `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null && npx vitest run src/lib/observability/log-failure.test.ts` (never prints a message or stack, rejects a code that fails `CODE_SHAPE`, ignores a status outside 100-599, never throws on `undefined` or a non-Error, never passes an `Error` argument; `logNotice` writes at warn level, `logFailure` at error level)
- The virtual-module seams load the code under test: `npx vitest run src/lib/test-support` (`src/middleware.ts`, `src/lib/supabase.ts` and `src/lib/forecast/kv-cache.ts` import under the mocks)
- Silent-catch guard passes with the day-one allowlist, and its six in-memory samples (empty block with a comment, fallback expression, rethrow without `cause`, error to redirect, constant, and a `.catch(reportAnd(...))` handler with and without the import) are each red without a report and green with one: `npx vitest run src/lib/observability/silent-catch-guard.test.ts`
- No-console guard passes with the two disables in `log-failure.ts` and no other runtime entry: `npx vitest run src/lib/no-console-guard.test.ts`
- The touched suites pass, including the forecast probe line (a rejected fetch logs `sidereus: forecast.fetch failed` with a name only): `npx vitest run src/lib/tonight src/lib/finder src/lib/account-plan src/lib/observations src/lib/forecast`
- Full unit suite, lint and types pass: `npm test && npm run lint && npx astro check`
- Production build keeps the Issues setting: `npm run build` then a grep of the generated server config for `issues`

#### Manual Verification:

- Reading `log-failure.ts` confirms no path reads `message`, `stack`, a URL, a form value or a header.
- After the owner merges and deploys this phase, Workers Issues is on for the Worker and Workers Logs shows the script version per invocation (D6).
- At the same first deploy the owner reads the **invocation event** of one real request in Workers Logs for its geo fields (`request.cf`: latitude, longitude, city, postal code; any client IP) (second review F6): D4's correlation rests on that metadata, and "no coordinates in any report" is broken by configuration if the event holds them. If a coordinate-like field is present, the orchestrator is told before Phase 3 and the fallback applies: turn the invocation log off with `observability.logs.invocation_logs: false` in `wrangler.jsonc` (the flag name is to be confirmed in the Wrangler configuration docs before use), then check whether the `console` lines of one request still share an invocation or request identifier in their metadata (also to be confirmed); if they do not, per-request correlation is lost and the owner decides. Phase 6 §1 documents the result.
- A deliberate forecast failure on a preview version of the production Worker (the probe procedure in §7: a Version URL from `wrangler versions upload` with `FORECAST_BASE_URL` overridden to a dead address, falling back to a Worker Preview, then to a separate `sidereus-probe` Worker) produces a `sidereus: forecast.fetch failed` line and an Issue grouped by that message, with production traffic untouched. If Issues groups by call site or stack instead, D2 is revisited before Phase 3 starts.

**Implementation Note**: This phase ships as its own pull request, merged and deployed by the owner (review F5, taken: the whole line shape assumes how Issues groups). Phase 2 can proceed in parallel; Phase 3 starts only after the grouping check above. Pause for confirmation before Phase 2.

---

## Phase 2: Stores and the forecast client keep the diagnosis

### Overview

Stop dropping the cause at the source (RC2), without logging yet: results and thrown errors carry a sanitized fault, and one pure rule says which faults are the server's.

### Changes Required:

#### 1. The fault shape and the classification

**File**: `src/lib/observability/fault.ts` (new, with tests)

**Intent**: One sanitized carrier for "what went wrong" that is safe to keep, return and log (F8).

**Contract**: `StoreFault` is an `Error` subclass with a fixed message, `name = "StoreFault"` and read-only `code?` (shape-checked) and `status?`; `faultFrom(error)` builds it from a PostgREST error or a thrown value without keeping the original message. `classifyFault({ code, status })` is a pure table with **server as the default**, because an unknown code is not benign (review F1): `input` for `22*` and `23*` (no fault, entity key, no line, as today); `refused` for `42501` (an RLS denial from a forged or stale id: the user's request, not an outage); `session` for `PGRST301`, `PGRST302` and `PGRST303` (a bad or expired JWT during a write: the session, not the database); `no-rows` for `PGRST116` and the zero-row branches; `server` for everything else, including no code at all (network or timeout), `08*`, `53*`, `57*`, `58*`, `XX*`, `42P01` and `42703` (schema drift), `PGRST000`-`PGRST003` and any status of 500 or more. Only `server` is alertable. The table is pinned by a test.

#### 2. Write results carry the fault

**Files**: `src/lib/gear/store.ts` (`WriteResult`, `writeFailure`, `affected`), `src/lib/observations/store.ts:112,131,189,208,229-242`, `src/lib/sky-checks/store.ts:67,103-106,123-126`, `src/lib/onboarding/store.ts:48-50,70-79`, `src/lib/session-plans/store.ts:55,61`

**Intent**: A failed write keeps its code and status next to the fixed message key, and a zero-row update says so (F8, F9, F17).

**Contract**: `{ ok: false; message: MessageKey; fault?: { kind: "server" | "refused" | "session" | "no-rows"; code?: string; status?: number } }`. `kind` comes from `classifyFault`; the `data.length === 0` branches in `affected()` are `no-rows`; a user-input failure (`22P02`, `23514`) has no `fault`. The empty `catch {}` blocks in `create()`, `update()`, `toSiteColumns` and `completeOnboarding` return their key with a `fault` built by `faultFrom` instead of dropping the error. The message keys do not change.

#### 3. Reads throw with a cause

**Files**: `src/lib/gear/store.ts:148,159,217,228,278,289`, `src/lib/observations/store.ts:151,163`, `src/lib/sky-checks/store.ts:85,149,161`, `src/lib/onboarding/store.ts:89`, `src/lib/session-plans/store.ts:36` (today it passes the raw `PostgrestError`, whose `message` can echo values, as `cause`: fix it to the sanitized carrier)

**Intent**: A thrown read keeps the key as its message and a `StoreFault` as its `cause`, so a later `logFailure` can read the code (F2, F16).

**Contract**: `throw new Error(KEY, { cause: faultFrom(error) })`; the cause never holds the PostgREST message. `session-plans/store.ts` is aligned to the same carrier.

#### 4. The forecast client keeps step and status

**File**: `src/lib/forecast/open-meteo.ts:84-108`

**Intent**: Say which step of the fetch failed and with what HTTP status, without the URL (F1).

**Contract**: `fetchForecast` throws a `ForecastError` whose `message` is still the existing fixed text (so current assertions hold), with `step: "request" | "http" | "parse" | "schema"` and `status?` set for `http`. No URL, no cause chain from `fetch`.

### Success Criteria:

#### Automated Verification:

- Fault tests pass (the classification table including `42501`, `PGRST301`, `PGRST303`, `PGRST116`, `42P01`, an unknown code, no code and a 503; `faultFrom` drops the message): `npx vitest run src/lib/observability`
- Each store's failing-write and failing-read tests fail first, then pass: a fake client returning an error whose message holds coordinates yields a result or `cause` with only `code` and `status`: `npx vitest run src/lib/gear src/lib/observations src/lib/sky-checks src/lib/onboarding src/lib/session-plans`
- `open-meteo` tests assert `step` and `status` for a 503, a network failure, bad JSON and a schema mismatch, and that no property holds the URL: `npx vitest run src/lib/forecast/open-meteo.test.ts`
- Full unit suite, lint and types pass: `npm test && npm run lint && npx astro check`
- DB suites unaffected: `npm run test:db` (needs local Supabase)

#### Manual Verification:

- A code review of the diff confirms no store function returns or keeps a PostgREST `message`.

**Implementation Note**: Pause for confirmation before Phase 3.

---

## Phase 3: Tonight and the forecast say what failed

### Overview

Trace every swallow point in the Tonight islands and the forecast path (flow A: F1, F2, F5, F6, F7, F29 and the unguarded call at `load.ts:180`).

### Changes Required:

#### 1. The forecast service

**File**: `src/lib/forecast/service.ts:161,169,200-217`, `src/lib/forecast/kv-cache.ts:13`

**Intent**: An Open-Meteo outage, a bad body, an incomplete series, a dead KV or a missing binding each leave one line (F1, F29).

**Contract**: extends Phase 1's `forecast.fetch` probe line with the `ForecastError` step and status (as `name`/`status`) and adds the steps `forecast.incomplete`, `forecast.cache-read`, `forecast.cache-write`, `forecast.cache-missing`. Behaviour (fallback, null) is unchanged. The `waitUntil` write logs from inside `writeCache` since the task is deferred. The module header's "nothing here logs" is replaced by the new rule.

#### 2. The Tonight loaders

**File**: `src/lib/tonight/load.ts:127-136,152-158,180,223-225`

**Intent**: Say which list read or which build failed (F2, F5, F13 part).

**Contract**: `load()` takes the step (`tonight.sites|telescopes|eyepieces|log|sky-checks`) and logs with the thrown cause; the `tonightError` catch logs `tonight.build`; `tonightDateForSite` and `chooseOwned` move inside the guarded block so a bad stored zone becomes the existing `TONIGHT_FAILED` state with a line instead of an uncaught island 500.

#### 3. The build catches

**File**: `src/lib/tonight/build.ts:914,964,1015,1062,1172`

**Intent**: A planet, Moon or sky-view build fault leaves a trace like the two sections that already have one (F6).

**Contract**: steps `tonight.planets` (both planet catches), `tonight.moon` (target and card), `tonight.sky-view`.

#### 4. The sky-check record

**Files**: `src/components/tonight/TonightContent.astro:106-115`, `src/lib/sky-checks/store.ts:61-67`

**Intent**: The fire-and-forget `record_sky_verdict` reports when it fails (F7).

**Contract**: step `tonight.sky-check-record`; the `.then` logs on `{ ok: false }` with the result's `fault`, the rejection handler logs the error; the comment "never logged" is replaced.

### Success Criteria:

#### Automated Verification:

- Forecast service tests fail first for a rejected fetch, a 429, bad JSON, an incomplete series with and without a stored copy, a throwing KV read and write (`cloudflare:workers` mocked through the Phase 1 seams), and a missing binding, then pass; each asserts one `sidereus: forecast.* failed` line with only `step`/`name`/`code`/`status`: `npx vitest run src/lib/forecast`
- `loadTonight` tests: a throwing list read per list, a throwing `buildTonight`, and a bad time zone each yield their existing notice state and one line; the coordinates of the fake site never appear in any logged argument: `npx vitest run src/lib/tonight`
- `build.ts` catches: each of the five paths, forced through the existing injection seam, logs its step: `npx vitest run src/lib/tonight/build.test.ts`
- Silent-catch allowlist entries for these files removed, guard green: `npx vitest run src/lib/observability/silent-catch-guard.test.ts`
- Full unit suite, lint and types pass: `npm test && npm run lint && npx astro check`
- Dashboard e2e still green: `SUPABASE_URL=<local API_URL> SUPABASE_SECRET_KEY=<local SECRET_KEY> npx playwright test tonight-dashboard tonight-targets forecast` (local stack only, inline, never exported)

#### Manual Verification:

- With `FORECAST_BASE_URL` pointing at a dead port and `npm run build && npm run preview`, loading `/tonight` prints `sidereus: forecast.fetch failed` once per request with `step`, `name` and `status`, and the page still shows the fallback.

**Implementation Note**: Pause for confirmation before Phase 4.

---

## Phase 4: Save routes, plan routes and page reads

### Overview

Flow B and the plan routes: a server fault in a save is logged and told apart from a user mistake (F4, F8-F10, F16, F17, F18, F20, F22).

### Changes Required:

#### 1. The shared save-failure step

**Files**: `src/lib/observability/save-failure.ts` (new, with tests), `src/lib/api-errors.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: One call every route makes on `!result.ok`: log when the result carries a fault, and pick the redirect key (D3).

**Contract**: `saveFailureKey(step: FailureStep, result: { message; fault? }): MessageKey` calls `logFailure` with the fault's code and status for `kind: "server"` and `logNotice` for `refused`, `session` and `no-rows`, and returns `errors.serverFault` for `server` and `result.message` otherwise. New key `errors.serverFault` in EN ("Something went wrong on our side, so nothing was changed. Try again in a moment.") and PL ("Coś poszło nie tak po naszej stronie, więc nic nie zostało zmienione. Spróbuj ponownie za chwilę."), at the top of the `errors` group because the delete routes use it too; the i18n parity test stays green.

#### 2. Routes

**Files**: `src/pages/api/log/index.ts:52`, `[id].ts:44`, `[id]/delete.ts:32`, `sky/[id].ts:33`; `src/pages/api/gear/{sites,telescopes,eyepieces}/{index,[id],[id]/delete}.ts`; `src/pages/api/onboarding.ts:33`; `src/pages/api/tonight/plan.ts:43,59-67`, `plan/reset.ts:46-53`

**Intent**: Every route sends its failed write through `saveFailureKey`; the plan routes' catch logs the step, name and cause code instead of only mapping to a key (F10); `request.formData()` failures redirect with the existing shape-error key and log `request.form` instead of throwing a 500 (F20).

**Contract**: steps `save.gear`, `save.log`, `save.sky-check`, `save.onboarding`, `save.plan`, `save.plan-reset`, `request.form`. Success and validation paths do not change. Route headers drop "nothing is logged" in favour of the new rule.

#### 3. Page and helper reads

**Files**: `src/pages/log/index.astro:36`, `new.astro:52`, `[id].astro:34`, `sky.astro:39`, `src/pages/gear/index.astro:55`, `gear/{sites,telescopes,eyepieces}/[id].astro:23`, `src/pages/onboarding.astro:14-25`, `src/lib/observations/celebrate.ts`

**Intent**: A read failure behind a "could not load" banner is logged with the thrown cause (F16, F22); the milestone line gains the cause code and a route word (F18).

**Contract**: steps `read.log`, `read.gear`, `read.sky-checks`, `read.onboarding`. The milestone trace keeps its four steps and gains the cause's `code` through the helper; the create, edit or delete route is told apart by a route-specific step (`milestones.record-create`, `milestones.record-edit`, `milestones.record-delete` style entries added to `FAILURE_STEPS`), not by a free-text field.

### Success Criteria:

#### Automated Verification:

- `saveFailureKey` tests fail first: a server fault gives the new key and one error-level line; `refused`, `session` and `no-rows` give the entity key and one warn-level line; a user mistake gives the entity key and no line: `npx vitest run src/lib/observability/save-failure.test.ts`
- Route tests with a fake `context` (one per family: log create, gear site update, a delete route, sky-check, onboarding, plan save, plan reset; `astro:env/server` mocked through the Phase 1 seams): a store returning a server fault redirects with `errors.serverFault` and logs one error line; an RLS refusal (`42501`) redirects with the entity key and logs a notice; a validation failure redirects as before and logs nothing; a non-form body redirects with the shape key and logs `request.form`: `npx vitest run src/lib/routes`
- i18n parity and key tests pass: `npx vitest run src/i18n`
- Silent-catch allowlist entries for the touched files removed, guard green
- Full unit suite, lint and types pass: `npm test && npm run lint && npx astro check`
- Existing e2e for the touched saves stay green: `SUPABASE_URL=<local API_URL> SUPABASE_SECRET_KEY=<local SECRET_KEY> npx playwright test observation-log observation-log-management onboarding session-plan-edit sky-checks`
- Smoke walk passes against the local stack: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=… npm run smoke`

#### Manual Verification:

- With the local Supabase stopped, saving a log entry shows the new "Something went wrong on our side" message and the preview output holds one `sidereus: save.log failed` line with no entry value in it; deleting an entry shows the same neutral message.

**Implementation Note**: Pause for confirmation before Phase 5.

---

## Phase 5: Sign-in, session and the finder

### Overview

Flow C and the finder half of flow D: an Auth outage stops looking like a mass sign-out, and every way to the finder's `failed` state leaves a line (F3, F11, F12 trace, F14, F21, F23, F24).

### Changes Required:

#### 1. The session reader, the middleware and the client

**Files**: `src/lib/auth/session-user.ts` (new, with tests; `sessionUser` moves out of `src/middleware.ts:13-21`), `src/middleware.ts`, `src/lib/supabase.ts:21`

**Intent**: Read the `error` from `getClaims`, log it only when it is a real failure, and log an unconfigured deploy once (F3, F24; review F3, F4).

**Contract**: `sessionUser(client)` is pure over the client, so it needs no virtual-module mock. A `getClaims` error is **routine** (silent, the user is signed out) when it is a stale or changed cookie: names `AuthSessionMissingError` and `AuthInvalidJwtError`, and codes `refresh_token_not_found`, `refresh_token_already_used`, `session_expired`, `session_not_found`, `bad_jwt`. It is a **failure** (`logFailure("auth.claims")` with name, code and status) when it is `AuthRetryableFetchError`, has a status of 500 or more, is a timeout or abort (`TimeoutError`, `AbortError`, the client's 5 s limit), or is anything not on the routine list (unknown is not benign). A missing session returns `error: null` and logs nothing. The implementer reads `@supabase/auth-js` 2.116.0 `errors.ts` and `GoTrueClient.ts` to confirm each name and code, and pins the list in a table test. The thrown (non-auth) case logs the same step. `onRequest` stays a thin wrapper (tested with the Phase 1 `astroMiddleware` mock). `createClient` logs `config.supabase` once per isolate when it returns `null` in a non-dev build. Behaviour (null user, redirects) is unchanged.

#### 2. Auth routes

**Files**: `src/pages/api/auth/signin.ts:8,24-28`, `signup.ts:7,15-19`, `signout.ts:6-9`, `src/lib/api-errors.ts:34-36`

**Intent**: Log every Auth failure that is not "wrong password" or "already registered", including network, 5xx, rate limit and confirmation-email faults, and read the sign-out result (F14, F23, F20 for auth).

**Contract**: steps `auth.signin`, `auth.signup`, `auth.signout`; no email, ever. The user-facing key mapping does not change.

#### 3. Account plan and finder

**Files**: `src/lib/account-plan/index.ts:36-46`, `src/lib/finder/load.ts:142-164,198-205`

**Intent**: The finder's `failed` state logs its reason for the null load and the "no site, telescope or view" branch; the calls outside the existing `try` move inside it; the plan-read line gains no route (D4) but the finder reason word separates it (F11, F12, F21).

**Contract**: steps `finder.tonight` (new; the swallowed list read that caused it is already logged by Phase 3, so this line only states that the finder fell to `failed`), plus the existing `finder.stars` and `finder.chart`. The plan-read line keeps the step `account.plan` and gets no route field (D4).

### Success Criteria:

#### Automated Verification:

- `sessionUser` tests fail first with a stub client, as a table: a stale refresh token (`refresh_token_not_found`, `refresh_token_already_used`), an expired session and an invalid JWT give a null user and no line; `AuthRetryableFetchError`, a 503, a timeout and an unknown error give a null user and one `auth.claims` line; a missing session gives a null user and no line; a thrown non-auth error logs once: `npx vitest run src/lib/auth/session-user.test.ts`
- `onRequest` tests under the `astro:middleware` and `astro:env/server` mocks: a gated path without a user redirects as before: `npx vitest run src/lib/auth/middleware.test.ts`
- Auth route tests (fake `context`, `astro:env/server` mocked): a rate-limit code, a 500 and a network failure each log one line and redirect with the same key as today; `invalid_credentials` logs nothing; the email never appears in an argument: `npx vitest run src/lib/routes/auth.test.ts`
- Finder loader tests: each way to `failed` logs a line; a planet or engine throw outside the old `try` now reaches `failed`: `npx vitest run src/lib/finder`
- Silent-catch allowlist entries for the touched files removed, guard green
- Full unit suite, lint and types pass: `npm test && npm run lint && npx astro check`
- E2E for sign-in and the finder stay green: `SUPABASE_URL=<local API_URL> SUPABASE_SECRET_KEY=<local SECRET_KEY> npx playwright test sign-in-continue finder-chart`
- Smoke walk including the finder gates passes against the local stack: `npm run smoke` with the local key inline

#### Manual Verification:

- With the local Auth service stopped and a signed-in session, loading `/tonight` redirects to sign-in as before and the preview output holds a `sidereus: auth.claims failed` line with a `name` and no email; with an old refresh token cookie it redirects and logs nothing.

**Implementation Note**: Pause for confirmation before Phase 6.

---

## Phase 6: The operator path, proof and the rule

### Overview

Close the loop with the owner: the runbook, the final guard allowlist, one deliberate failure proving the alert path, and the written rule for the next agent.

### Changes Required:

#### 1. Runbook

**File**: `context/deployment/error-visibility.md` (new)

**Intent**: The operator can find, group and be alerted on every step without reading code.

**Contract**: the step table (each `FailureStep`, the flow, what the user sees, what to check), the Workers Logs query for the `sidereus:` prefix and per `step` field, how to confirm Workers Issues is on and that the version is shown per invocation (D6), the Issues automation to create (webhook or chat; the owner chooses the target), and the "first thing to look at" order from the audit's root causes. A section "What the invocation event holds" records which fields Workers Logs attaches itself (the request URL path, which carries entity ids such as `/gear/sites/<id>`, the redacted query string, `cf-ray`, the `cf` request properties, the script version) and why each is acceptable or what to do if not (review F6). The `cf` geo-field check itself is done at the first deploy (1.9); the runbook records its result and the fallback if one was applied. It also records, for the client steps, the saved Workers Logs query with a count threshold (D13) and whether Workers Logs can alert on a query (to be verified). No identifiers of ours, no keys.

#### 2. Final guard allowlist and the written rule

**Files**: `src/lib/observability/silent-catch-guard.test.ts`, `CLAUDE.md` (Tripwires, `no-console` bullet and a new Observability bullet), `context/foundation/lessons.md`

**Intent**: Leave only justified silent catches, and tell the next agent the new rule. The service-worker and island entries stay allowlisted with the reason "reported by Phases 7-9, or out of scope if that block is cut" until those phases land.

**Contract**: the allowlist holds only entries with a reason (the browser-side ones are removed by Phases 8 and 9); the CLAUDE.md tripwire says "log a failure through `logFailure(step, error)`; add a step to `FAILURE_STEPS`; never pass an `Error`, a message, a URL or a value", and drops the old "needs its own allowlisted disable" for logs. A lesson (via `/10x-lesson`) records: swallowed catches need a line, the step vocabulary, and the sanitized `cause` for store errors.

#### 3. Roadmap and issue

**Files**: `context/foundation/roadmap.md` (S-07 status at implementation end), GitHub #175 and Projects board #1 (human-merge rule applies)

**Intent**: Keep the board true.

**Contract**: moved by the implementing phase per the usual flow; nothing merges without the owner.

### Success Criteria:

#### Automated Verification:

- Silent-catch guard passes with only reasoned entries: `npx vitest run src/lib/observability`
- Full unit suite, lint, types, build and DB suites pass: `npm test && npm run lint && npx astro check && npm run build && npm run test:db`
- Full e2e passes in CI with `failOnFlakyTests` (no retries added)
- Agent-hooks proof still passes: `npx vitest run src/lib/agent-hooks.test.ts`

#### Manual Verification:

- The owner creates the Issues automation, and a deliberate forecast failure reaches the chosen target as an Issue grouped as `sidereus: forecast.fetch failed`; a second step (a save failure, for example) is its own Issue, so grouping holds across steps. A deliberate stale-id update shows a warn-level `noted` line and creates no Issue.
- One Workers Logs line per flow, and the invocation event around it (URL path, `cf` fields, headers, script version), hold no coordinate, email, key or form value, and the runbook records what the invocation event does hold and why that is acceptable (review F6).
- If a line does not become an Issue, the runbook's fallback (a saved Workers Logs query) is used and the gap is recorded as a follow-up, not silently dropped.
- Follow-up issues exist on GitHub and the board for the parts left out: release identity (D6), the island, 404/500 and plan-unknown UI (D7), and, only if the block was cut, client reporting (D5, Phases 7-9).

**Implementation Note**: This phase needs the owner for the dashboard steps; pause for confirmation before closing the change.

---

## Phase 7: The client-error endpoint and the reporter core (start of the cuttable block)

### Overview

A first-party collection point for failures that happen in the browser: one rate-limited, sanitized `POST` route, the shared reporter core the service worker and the islands will use, and the closed client step list. Nothing reports yet; Phases 8 and 9 do. This block (7-9) can be cut late in the schedule; the dated cut-off rules are under Decisions ("Cut-off for Phases 7-9"): Phase 6 merged by 2026-10-28, Phase 7 deployed by 2026-10-30, whichever of 8 and 9 is deployed by 2026-11-02.

### Changes Required:

#### 1. The shared reporter core and the step list

**Files**: `src/lib/observability/client/steps.ts`, `src/lib/observability/client/reporter.ts`, `src/lib/observability/client/classify.ts`, `src/lib/observability/client/index.ts` (barrel, the path the silent-catch guard knows) (new, with tests; browser-safe, no server import)

**Intent**: One pure place that builds a sanitized report and applies the client-side caps, usable from the worker (no DOM) and from the page (D9, D10).

**Contract**: `CLIENT_STEPS` is a closed list in two families, `sw.*` (index, precache, shell, offline-page, next-night, store-page, asset-note, navigation, island-commit, sweep, purge) and `island.*` (uncaught, unhandled-rejection, hydration, import, sw-register, geocode); `ClientStep` is its union. `createReporter({ send, maxTotal, now? })` returns `report(step, error)`: it builds `{ source, step, name?, code? }` (`name` only from `error.name` when it matches a short identifier shape, `code` only when it passes `CODE_SHAPE`; never `message`, `stack`, file name, line or URL), drops a repeat of the same step and name, stops after `maxTotal` reports (5 per page, 10 per worker **wake-up**: the count lives in the worker's global scope, which the browser ends after a short idle, so it bounds one wake-up, not one device), calls `send` without awaiting it, and never throws. A report whose device is offline is dropped, not queued (D10). Before anything else `report` asks `isRoutineNetworkFault(step, error)` (`classify.ts`, pure, tested; D14): for a step in `NETWORK_STEPS` (the `sw.*` steps whose guarded operation is a network `fetch`, assigned site by site in Phase 8 §2) a `TypeError`, `AbortError` or `TimeoutError` is routine and is dropped; cache and storage errors (`QuotaExceededError`, `InvalidStateError`, `UnknownError`, `NotFoundError`), `SyntaxError` and every name not on the routine list are reported (unknown is not benign; browsers name storage errors differently, so variance errs toward a notice, never toward silence). The tradeoff is written down: a real code `TypeError` at a network step goes unreported.

#### 2. The route

**Files**: `src/pages/api/client-error.ts` (new), `src/middleware.ts`, `src/lib/observability/client-report.ts` (new, server side), `src/lib/observability/log-failure.ts` (step union gains `client.<ClientStep>`)

**Intent**: Accept a report, log it through `logNotice` (warn: client reports are untrusted, D13) and answer with no body; refuse everything else cheaply (D9).

**Contract**: only `POST`. In order: same-origin check (`Sec-Fetch-Site: same-origin`, or `Origin` equal to the request's origin; otherwise 403), body of at most 512 bytes (413), checked without buffering the whole body: a `Content-Length` over 512 is refused at once, then the body is read as a stream with a running byte count that stops reading at the 513th byte, so a chunked body without `Content-Length` is bounded the same way and a multi-megabyte forgery is never held in memory (second review F5), `content-type` `application/json` or `text/plain` (a beacon sends the latter; 415 otherwise), the limiter (429), a strict schema (unknown keys, a long `name` or a non-shaped `code` give 400), then `logNotice("client.<step>", { name, code })` (a `sidereus: client.<step> noted` warn line; the origin check only stops other sites' pages, since any `curl` sets `Origin` and every field, so a forged report must never be able to create an Issue, D13) and `204` with `Cache-Control: no-store` and no body. The route reads no cookie and calls no Supabase. The middleware returns before creating the Supabase client or resolving the session for this one path. The route is not in `PROTECTED_ROUTES`, so signed-out pages and the worker can report. This is the one deliberate exception to "API routes redirect with `?error=`": a beacon has no page to go back to, so it answers with status codes and empty bodies.

#### 3. The rate limiter

**Files**: `src/lib/observability/client-error-limit.ts` (interface and an in-memory token bucket for tests and local dev), `src/lib/observability/rate-limit.ts` (new; the only importer of `cloudflare:workers` here), `wrangler.jsonc`, `worker-configuration.d.ts`

**Intent**: Bound the log volume an unauthenticated route can create, with no personal key (D9).

**Contract**: a `ratelimits` entry `CLIENT_ERROR_LIMITER` with an integer `namespace_id` unique in the account (the owner confirms the number is unused), `simple: { limit: 30, period: 60 }` (per Cloudflare location, permissive by design); the limiter calls `limit({ key: "client-error" })` with that one constant key. A missing binding (local dev, tests) falls back to the in-memory bucket, never to "allow all". `npm run cf:types` regenerates `worker-configuration.d.ts`, committed.

#### 4. The HTTP proof

**File**: `scripts/smoke.mjs`

**Intent**: Prove the route over HTTP as the other gates are proved.

**Contract**: a valid report gives 204; a body with a `message` field gives 400; a 600-byte body gives 413; a request with a foreign `Origin` gives 403; a `GET` does not give 2xx. The foreign-`Origin` step sends a JSON body, so the refusal is the route's own check; Astro's default `security.checkOrigin` refuses a cross-site `text/plain` `POST` with its own 403 before the route runs, so that variant proves Astro, not the route, and the route test (not smoke) covers the route's check for it (second review F7b).

### Success Criteria:

#### Automated Verification:

- Reporter tests fail first, then pass: sanitizing (a message, stack, file name and URL in the error never reach the payload), same step and name sent once, the cap, never throws when `send` throws or rejects, `isRoutineNetworkFault` as a table (a `TypeError`, `AbortError` and `TimeoutError` at a `NETWORK_STEPS` step are dropped; the same names at another step, `QuotaExceededError`, `InvalidStateError`, `SyntaxError` and an unknown name are reported): `npx vitest run src/lib/observability/client`
- Route tests with a fake `context` and the in-memory limiter fail first, then pass: valid report gives 204 and exactly one `sidereus: client.<step> noted` warn line (never an error-level line) with only allowed fields (`step`, `name`, `code`); extra keys, a long name, a bad code and a bad step give 400; 513 bytes gives 413, and so does a chunked body without `Content-Length` (a counting stream proves the handler stops reading at the 513th byte); foreign origin gives 403; over the limit gives 429 and logs nothing; the route never touches `locals.supabase`: `npx vitest run src/lib/routes/client-error.test.ts` (the route module is imported from `@/pages/api/client-error`; `cloudflare:workers` mocked through the Phase 1 seams)
- Middleware test: a request to `/api/client-error` creates no Supabase client and calls no `getClaims`: `npx vitest run src/lib/auth/middleware.test.ts`
- Wrangler config is valid and types are regenerated: `npx wrangler deploy --dry-run` and `npm run cf:types` leave no diff
- Silent-catch guard and no-console guard pass
- Full unit suite, lint, types and build pass: `npm test && npm run lint && npx astro check && npm run build`
- Smoke walk passes against the local stack: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=… npm run smoke`

#### Manual Verification:

- After the first deploy the owner confirms the rate-limit binding exists on the Worker and that a hand-posted valid report appears as a `sidereus: client.* noted` warn line (and creates no Issue).

**Implementation Note**: Pause for confirmation before Phase 8. If the schedule forces a cut, stop here and record Phases 7-9 as cut.

---

## Phase 8: Service-worker reporting

### Overview

The worker stops swallowing its failures: each of its ~20 silent sites reports a step through the reporter core and then returns exactly the value it returned before (F25).

### Changes Required:

#### 1. The worker's reporter

**Files**: `src/sw.ts`, `src/lib/offline/report.ts` (new, with tests)

**Intent**: Wire `createReporter` into the worker with a `send` that posts the payload to `/api/client-error` and swallows its own failure (the one justified silent catch, allowlisted with that reason).

**Contract**: `send` is `fetch("/api/client-error", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true })` with no credentials beyond the default same-origin; cap 10 per worker wake-up (D14). A helper `reportAnd(step, fallback)` returns a catch handler that reports and returns the old fallback value, so each site changes from `.catch(() => undefined)` to `.catch(reportAnd("sw.<step>", undefined))` and behaviour is identical; a routine network fault at a `NETWORK_STEPS` site is not reported (D14) but the same fallback value is still returned. `report` and `reportAnd` are exported from `src/lib/offline/report.ts`, the two names the silent-catch guard accepts (Phase 1 §3), and the two bare `catch {}` blocks call `report(...)` in their body.

#### 2. The sites

**File**: `src/sw.ts:79,85,254,340,402,507,585,685-798` (about 17 `.catch(() => undefined)`, the `.catch(() => null)` at 85 and the two bare `catch {}` at 507 and 585)

**Intent**: Give every site its step, and mark which of them are network-dependent (`NETWORK_STEPS`: the precache fetch, the offline-page and next-night fetches, the page copy and navigation settle that wrap a `fetch`; the implementer reads each site and records the assignment in `steps.ts`): index write and read, precache fetch, shell read, offline page, next-night copy, page copy (`store-page`), asset note, navigation settle, island commit, sweep and purge. `networkOrOffline` keeps rethrowing as it does.

**Contract**: the steps are the `sw.*` family from Phase 7; no step is added without a `CLIENT_STEPS` entry. `scripts/build-sw.mjs` keeps passing (no new precache entry, no server import in the bundle).

### Success Criteria:

#### Automated Verification:

- Report tests fail first, then pass: a failing commit reports its step once and the stored-copy decision is unchanged; a fetch `TimeoutError` or `TypeError` at a network step while `navigator.onLine` is true sends nothing and still returns the old fallback; a `QuotaExceededError` from a cache write sends one report; a thrown `send` does not change any outcome; the cap and the dedupe hold: `npx vitest run src/lib/offline`
- Silent-catch allowlist entries for `src/sw.ts` removed, guard green (only the reporter's own `send` catch remains, with its reason)
- Build and the worker bundle check pass: `npm run build`
- Offline e2e specs stay green with no retries added: `SUPABASE_URL=<local API_URL> SUPABASE_SECRET_KEY=<local SECRET_KEY> npx playwright test offline finder-offline session-plan-store service-worker-control`
- A `POST` to `/api/client-error` passes through the worker untouched, because `isNavigation` needs `request.mode === "navigate"` and a `fetch` or `sendBeacon` has another mode (asserted in the offline proxy spec or a unit test of the route table)
- Full unit suite, lint and types pass: `npm test && npm run lint && npx astro check`

#### Manual Verification:

- With the preview running and the cache full, making a store step fail (for example by breaking the island URL in a proxy) produces a `sidereus: client.sw.* noted` warn line, while the page and the stored copies behave as before; breaking the network (not the store) produces no line.

**Implementation Note**: Pause for confirmation before Phase 9; Phase 9 can be cut independently.

---

## Phase 9: Island and browser reporting

### Overview

React islands and the page's lazy loads report their failures: one global handler for uncaught errors and rejections, and the dynamic-import catches that today only reset a memo (F26, F33).

### Changes Required:

#### 1. The page-side reporter and the global handlers

**Files**: `src/lib/observability/client/browser.ts` (new, with tests), `src/layouts/Layout.astro` (one `<script>` block)

**Intent**: Report an uncaught error or an unhandled rejection from any island without a boundary around each (React 19 surfaces render errors as window `error` events).

**Contract**: `installErrorReporting(reporter)` registers `error` and `unhandledrejection` handlers once; an event without an `error` object (a cross-origin "Script error." or a resource load) is ignored; the report carries only the error's name. **Own-script filter (D15):** a window `error` event is reported only when `event.filename` starts with `location.origin + "/_astro/"`, checked in the browser and never sent, which drops extension scripts and console input (file `VM123`); `unhandledrejection` has no filename, so it is reported unfiltered (accepted). An error whose message, read only by this filter and never stored or sent, mentions hydration (`/hydrat/i`) reports as `island.hydration`, because React 19 routes recoverable hydration errors (often an extension changing the DOM) through `reportError`; every client report is a warn-level notice (D13), so the operator reads these by count. `send` uses `navigator.sendBeacon("/api/client-error", new Blob([body], { type: "text/plain" }))` and falls back to a keepalive `fetch`; cap 5 per page. The script lives in `Layout.astro`, is linted without type information and obeys `no-console`; the module never imports server code, `@/lib/engine`, `@/lib/catalogue` or `cloudflare:workers` (an import-guard test, like `fact-islands.test.ts`).

#### 2. Lazy-load and registration failures

**Files**: `src/components/location/map-panel.tsx:52`, `src/components/location/LocationPicker.tsx:64`, `src/lib/gear/catalogue/load.ts:15,23`, `src/lib/offline/register.ts:8`, `src/lib/location/geocode.ts:98` (report only on the island side of the call)

**Intent**: A failed dynamic import or service-worker registration reports its step and keeps the recovery it has (reset the memo, show the existing failed state) (F26, F33).

**Contract**: steps `island.import`, `island.sw-register`, `island.geocode`. Not reported, with a reason in the guard's allowlist: a denied or unavailable geolocation (`LocationPicker.tsx:74`, `locate.ts:60`), which is the user's choice and would be noise.

#### 3. Docs and the final allowlist

**Files**: `context/deployment/error-visibility.md`, `CLAUDE.md`, `context/foundation/lessons.md`, `src/lib/observability/silent-catch-guard.test.ts`

**Intent**: Document the client steps and the endpoint, and leave only reasoned silent catches.

**Contract**: the runbook gains the client step table and the endpoint's limits; the CLAUDE.md rule says client code reports through `@/lib/observability/client` and never calls `console`; the lesson is extended; the guard's allowlist holds only the reporter's own `send` catches and the two geolocation sites.

### Success Criteria:

#### Automated Verification:

- Browser reporter tests fail first, then pass: an event with a message, stack and file name sends only the name; no error object sends nothing; an event whose `filename` is not under `location.origin + "/_astro/"` sends nothing while one under it sends one report; a hydration message reports `island.hydration` and the message is not in the body; an `unhandledrejection` is reported without a filename; the page cap holds; install is idempotent: `npx vitest run src/lib/observability/client`
- Import guard passes: the client module imports no server code: `npx vitest run src/lib/observability`
- E2E `tests/e2e/client-errors.spec.ts` fails first, then passes: a script served from `/_astro/probe-throw.js` (fulfilled through `page.route` and added with a script tag) that throws a `TypeError` in a timeout produces one `POST /api/client-error` (captured with `page.route`); the same throw from `page.evaluate` (a filename outside `/_astro/`) produces none; a rejected `RangeError` produces one; each body holds only `source`, `step` and `name`, never the thrown message (the proof is not an exception on `/design`, which 404s outside `npm run dev`): `SUPABASE_URL=<local API_URL> SUPABASE_SECRET_KEY=<local SECRET_KEY> npx playwright test client-errors`
- Silent-catch guard passes with only reasoned entries
- Existing island e2e stay green: `npx playwright test site-location site-map gear-catalogue`
- Full unit suite, lint, types and build pass: `npm test && npm run lint && npx astro check && npm run build`

#### Manual Verification:

- After the deploy, running `Promise.reject(new RangeError("x"))` in the browser console on the live site produces one `sidereus: client.island.unhandled-rejection noted` warn line (a rejection has no filename, so the filter passes it) and no Issue; the line does not hold the text "x". Running `setTimeout(() => { throw new TypeError("x") })` in the console produces no line, because its file is console input, not `/_astro/`: that proves the filter's negative side live, and the e2e proves the positive side.

**Implementation Note**: Pause for confirmation before closing the change.

---

## Testing Strategy

### Unit Tests:

- The helper: closed vocabulary, field filtering, `CODE_SHAPE`, status range, never a message, stack, URL or `Error` argument, never throws.
- A coordinate canary in every flow test: the fake site's latitude and longitude, a fake email and a fake form value are put into error messages, and the test fails if any logged argument contains them.
- The classification table (`classifyFault`), the fault carrier, the store results and thrown causes, the forecast steps, the loaders, the save-failure step, the middleware and the auth routes.
- The silent-catch ratchet and the no-console guard.
- The client reporter cores (sanitizing, dedupe, caps), the endpoint (every refusal path and the one success path) and the middleware short-circuit.

### Integration Tests:

- Route tests with a fake `context` per family; the existing Playwright specs and `npm run smoke` stay green; one new e2e (`client-errors.spec.ts`) proves the browser reports only a name; smoke proves the endpoint's refusals over HTTP. No UI is added except one error message.

### Manual Testing Steps:

1. Build and preview with a dead `FORECAST_BASE_URL`; load `/tonight`; read the preview output for `sidereus: forecast.fetch failed`.
2. Stop local Supabase; save a log entry; see the new message and `sidereus: save.log failed`.
3. Stop local Auth; reload a gated page; see `sidereus: auth.claims failed`.
4. After deploy, the Issues check and the automation (Phase 6), then a rejected promise typed in the live console (Phase 9).

## Performance Considerations

A line costs one `console.error` with a small object, only on a failure path. The client endpoint answers with no body and does no database work (the middleware skips the session for it); the worst case is 30 accepted reports per minute per location, and each browser sends at most 5 per page and the worker at most 10 per lifetime. A forecast outage logs once per failed step per request (a few lines per page view); Workers Logs' 256 KB per invocation cap is far above that. No hot path gains work.

## Migration Notes

No database migration. The new `errors.serverFault` key ships with both locales. Phase 7 adds a `ratelimits` binding (Wrangler 4.36+, already satisfied by the Phase 1 bump) and regenerates `worker-configuration.d.ts`; the namespace ID must be an integer unused in the Cloudflare account. The `wrangler` bump and `observability.issues.enabled` take effect on the first deploy after merge (CI's `deploy` job); a dashboard-only enable would be turned off by it, which is why the flag is in the config.

## References

- Audit: `context/audits/observability/2026-10-15_tonight-save-routes-auth-finder-plan.md`
- Roadmap slice: `context/foundation/roadmap.md` S-07; GitHub #175
- Safe-code pattern: `src/lib/tonight/load.ts:40-54` (`session-plans/store.ts:36` is the counter-example: a raw `PostgrestError` as `cause`)
- Plan review: `context/changes/error-visibility/reviews/plan-review.md`
- No-console guard: `src/lib/no-console-guard.test.ts`
- Lessons: `context/foundation/lessons.md` (`no-console` is an error in all of `src`; keep "unknown" apart from "free")
- Cloudflare: Workers Issues, Workers Logs and Wrangler configuration (observability) docs, read 2026-10-15

## Progress

> Status: Phase 1 implemented and gated locally (automated rows 1.1-1.7 done); manual rows 1.8-1.10 and the e2e/smoke run pending; awaiting /10x-impl-review before push.
>
> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The failure helper, the guard, Issues config and the first probe line

#### Automated

- [x] 1.1 Helper tests pass (no message or stack, `CODE_SHAPE`, status range, never throws, no `Error` argument, `logNotice` at warn level and `logFailure` at error level)
- [x] 1.2 The virtual-module seams load `middleware.ts`, `supabase.ts` and `kv-cache.ts` under the mocks
- [x] 1.3 Silent-catch guard passes with the day-one allowlist, and its six sample shapes (the sixth a `.catch(reportAnd(...))` handler) are red without a report and green with one
- [x] 1.4 No-console guard passes with the two disables in `log-failure.ts` and no other runtime entry
- [x] 1.5 The touched suites pass, including the forecast probe line
- [x] 1.6 Full unit suite, lint and types pass
- [x] 1.7 Production build keeps the Issues setting

#### Manual

- [ ] 1.8 Reading `log-failure.ts` confirms no path reads `message`, `stack`, a URL, a form value or a header
- [ ] 1.9 After the owner merges and deploys this phase, Workers Issues is on, the script version shows per invocation, and the invocation event holds no geo field (`request.cf` latitude, longitude, city, postal code) or client IP; otherwise the written fallback (invocation logs off) is applied before Phase 3
- [ ] 1.10 A deliberate forecast failure on a preview version of the production Worker (Version URL, else Worker Preview, else `sidereus-probe`; see §7) produces a `sidereus: forecast.fetch failed` line and an Issue grouped by that message (else D2 is revisited before Phase 3)

### Phase 2: Stores and the forecast client keep the diagnosis

#### Automated

- [ ] 2.1 Fault tests pass (classification table, `faultFrom` drops the message)
- [ ] 2.2 Each store's failing-write and failing-read tests fail first, then pass, and carry only `code` and `status`
- [ ] 2.3 `open-meteo` tests assert `step` and `status` for a 503, a network failure, bad JSON and a schema mismatch, and that no property holds the URL
- [ ] 2.4 Full unit suite, lint and types pass
- [ ] 2.5 DB suites unaffected

#### Manual

- [ ] 2.6 A code review of the diff confirms no store function returns or keeps a PostgREST `message`

### Phase 3: Tonight and the forecast say what failed

#### Automated

- [ ] 3.1 Forecast service tests fail first for each failure shape, then pass, each asserting one `sidereus: forecast.* failed` line with only allowed fields
- [ ] 3.2 `loadTonight` tests: each list read, the build and a bad time zone yield their notice state and one line, with no coordinates in any logged argument
- [ ] 3.3 `build.ts` catches: each of the five paths logs its step
- [ ] 3.4 Silent-catch allowlist entries for these files removed, guard green
- [ ] 3.5 Full unit suite, lint and types pass
- [ ] 3.6 Dashboard e2e still green

#### Manual

- [ ] 3.7 With a dead `FORECAST_BASE_URL`, loading `/tonight` prints `sidereus: forecast.fetch failed` once per request and the page still shows the fallback

### Phase 4: Save routes, plan routes and page reads

#### Automated

- [ ] 4.1 `saveFailureKey` tests fail first, then pass (server fault: new key and error line; refused, session and no-rows: entity key and warn line; user mistake: no line)
- [ ] 4.2 Route tests per family (a delete route included): server fault redirects with `errors.serverFault` and logs one error line, RLS refusal keeps the entity key and logs a notice, validation unchanged, non-form body logs `request.form`
- [ ] 4.3 i18n parity and key tests pass
- [ ] 4.4 Silent-catch allowlist entries for the touched files removed, guard green
- [ ] 4.5 Full unit suite, lint and types pass
- [ ] 4.6 Existing e2e for the touched saves stay green
- [ ] 4.7 Smoke walk passes against the local stack

#### Manual

- [ ] 4.8 With local Supabase stopped, saving and deleting a log entry show the neutral "Something went wrong on our side" message and the save leaves one `sidereus: save.log failed` line with no entry value

### Phase 5: Sign-in, session and the finder

#### Automated

- [ ] 5.1 `sessionUser` table tests fail first, then pass (stale refresh token, expired session and invalid JWT silent; retryable fetch error, 503, timeout and unknown error logged; missing session silent; thrown error logged once)
- [ ] 5.2 The thin `onRequest` tests pass under the `astro:middleware` and `astro:env/server` mocks
- [ ] 5.3 Auth route tests: rate limit, 500 and network failure each log one line with the same key as today, `invalid_credentials` silent, no email in any argument
- [ ] 5.4 Finder loader tests: each way to `failed` logs a line, and throws outside the old `try` reach `failed`
- [ ] 5.5 Silent-catch allowlist entries for the touched files removed, guard green
- [ ] 5.6 Full unit suite, lint and types pass
- [ ] 5.7 E2E for sign-in and the finder stay green
- [ ] 5.8 Smoke walk including the finder gates passes against the local stack

#### Manual

- [ ] 5.9 With local Auth stopped and a signed-in session, a gated page redirects as before and the output holds `sidereus: auth.claims failed` with no email; with an old refresh token cookie it redirects and logs nothing

### Phase 6: The operator path, proof and the rule

#### Automated

- [ ] 6.1 Silent-catch guard passes with only reasoned entries
- [ ] 6.2 Full unit suite, lint, types, build and DB suites pass
- [ ] 6.3 Full e2e passes in CI with `failOnFlakyTests`
- [ ] 6.4 Agent-hooks proof still passes

#### Manual

- [ ] 6.5 The owner creates the Issues automation; a deliberate forecast failure reaches the target as an Issue grouped by its message, a second step is its own Issue, and a stale-id update leaves a warn line and no Issue
- [ ] 6.6 One Workers Logs line per flow and the invocation event around it (URL path, headers, script version; the `cf` geo fields were checked at 1.9) hold no coordinate, email, key or form value, and the runbook records what the invocation event holds
- [ ] 6.7 If a line does not become an Issue, the fallback query is used and the gap is recorded as a follow-up
- [ ] 6.8 Follow-up issues exist for release identity (D6), the island/404/500/plan-unknown UI (D7) and, only if the block was cut, client reporting (D5)

### Phase 7: The client-error endpoint and the reporter core

#### Automated

- [ ] 7.1 Reporter tests fail first, then pass (sanitizing, dedupe, caps, never throws, routine network faults dropped and cache, storage and unknown names reported)
- [ ] 7.2 Route tests fail first, then pass (one success path as a warn-level `noted` line, 400, 413 including a chunked body without `Content-Length`, 403, 429, no Supabase use)
- [ ] 7.3 Middleware test: `/api/client-error` creates no Supabase client and calls no `getClaims`
- [ ] 7.4 Wrangler config is valid and `worker-configuration.d.ts` is regenerated
- [ ] 7.5 Silent-catch guard and no-console guard pass
- [ ] 7.6 Full unit suite, lint, types and build pass
- [ ] 7.7 Smoke walk passes against the local stack, including the endpoint's refusals

#### Manual

- [ ] 7.8 After the first deploy the owner confirms the rate-limit binding exists and a hand-posted valid report appears as a `sidereus: client.* noted` warn line and creates no Issue

### Phase 8: Service-worker reporting

#### Automated

- [ ] 8.1 Report tests fail first, then pass (a failing commit reports once, outcomes unchanged, a timeout while `onLine` is not reported, a storage error is, the cap and dedupe hold)
- [ ] 8.2 Silent-catch allowlist entries for `src/sw.ts` removed, guard green
- [ ] 8.3 Build and the worker bundle check pass
- [ ] 8.4 Offline e2e specs stay green with no retries added
- [ ] 8.5 A `POST` to `/api/client-error` passes through the worker untouched
- [ ] 8.6 Full unit suite, lint and types pass

#### Manual

- [ ] 8.7 A forced store failure in the preview produces a `sidereus: client.sw.* noted` warn line, a broken network produces none, and the page and stored copies behave as before

### Phase 9: Island and browser reporting

#### Automated

- [ ] 9.1 Browser reporter tests fail first, then pass (only the name is sent, no error object sends nothing, the own-script filter, hydration step, rejection unfiltered, page cap, idempotent install)
- [ ] 9.2 Import guard passes: the client module imports no server code
- [ ] 9.3 `client-errors.spec.ts` fails first, then passes (an error from a served `/_astro/` script and a rejection each produce one report with only `source`, `step` and `name`; the same error thrown from console-style input produces none)
- [ ] 9.4 Silent-catch guard passes with only reasoned entries
- [ ] 9.5 Existing island e2e stay green
- [ ] 9.6 Full unit suite, lint, types and build pass

#### Manual

- [ ] 9.7 After the deploy, a rejected promise typed in the live console produces one `sidereus: client.island.unhandled-rejection noted` warn line with no message text and no Issue, and a thrown error typed in the console produces none
