# Production Error Visibility (M-4 S-07) Implementation Plan

## Overview

Give the operator one first-party signal for every failure in the critical flows (Tonight and its forecast, the save routes, sign-in and session, the finder chart and Session-plan edits), with its cause, and an alert path, without a coordinate, email, key or form value ever reaching a log.

Today a Supabase, Open-Meteo or engine failure ends as a 200 notice, a stale-forecast fallback or a 302 `?error=<key>`, and only 7 `console.error` sites exist in the whole app (`context/audits/observability/2026-10-15_tonight-save-routes-auth-finder-plan.md`, 33 findings, 4 critical). The plan adds one logging helper with a closed vocabulary, makes the data layer keep the diagnosis it drops today, logs at every swallow point, ratchets the silent catches with a guard test, and switches on Workers Issues (Cloudflare's own grouping and alert path) with an operator runbook. No new third-party vendor (owner, 2026-10-15).

## Current State Analysis

- **The audit is the research.** `context/audits/observability/2026-10-15_tonight-save-routes-auth-finder-plan.md` holds the capture model, 33 merged findings (F1-F33), six root causes (RC1-RC6) and a fix order. Findings are cited below by id. No `research.md` or `frame.md` exists; the audit replaces them.
- **Capture today:** Workers Logs and traces are on (`wrangler.jsonc:15-22`, `redact_query_string: true`); Astro logs an uncaught throw with its stack and returns a 500 (audit §2); everything handled is silent. The seven `console.error` lines carry a fixed string plus `error.name` (two add a code): `src/lib/tonight/build.ts:1415,1439`, `src/lib/finder/load.ts:171,194`, `src/lib/tonight/load.ts:53`, `src/lib/account-plan/index.ts:45`, `src/lib/observations/celebrate.ts:45`.
- **The privacy rule is implemented by silence (RC1).** `no-console` is an error everywhere under `src`, with exact allowlist counts in `src/lib/no-console-guard.test.ts` (`ALLOWED_DISABLES`). Module headers say "nothing is logged" (`src/lib/forecast/service.ts:23`, `src/pages/api/tonight/plan.ts:20`).
- **The data layer drops the cause (RC2).** Stores read `error.code` to pick a key, then discard it (`src/lib/gear/store.ts:65-73`); reads throw `new Error(KEY)` with no `cause` (`src/lib/gear/store.ts:148-289`, `src/lib/observations/store.ts:151,163`, `src/lib/sky-checks/store.ts:85,149,161`, `src/lib/onboarding/store.ts:70-89`); `src/lib/forecast/open-meteo.ts:84-108` collapses every cause into two fixed messages. The safe pattern already exists twice: `CODE_SHAPE` and `logPlanEditsFailure` in `src/lib/tonight/load.ts:40-54`, and `session-plans/store.ts:36`.
- **Supabase result errors go unread (RC4).** `src/middleware.ts:15` takes only `data` from `getClaims()`; auth-js returns auth failures as `{ data: null, error }` (`GoTrueClient.ts:6715,6791-6794`, verified), so the `catch` at `:18` is nearly dead and an Auth outage reads as a mass sign-out.
- **Cloudflare's own tools** (checked 2026-10-15 in the Cloudflare docs): Workers Issues "detects production failures and groups related failures into issues without an SDK"; it records uncaught exceptions, failed invocations, `5xx` responses and **logged errors**, and "to record an error that your application catches, pass the caught value to `console.error()`"; automations route an issue to a webhook, chat service or incident tool. Enabling needs `observability.issues.enabled: true` in the Wrangler config and Wrangler 4.134.0 or later (the repo has `^4.131.1`); a dashboard-only enable is turned off by the next deploy. Workers Logs recommends structured (JSON-object) logs, which it indexes by field. Since 2026-08-24 `console.*` also preserves an `Error` argument's message and stack, so an `Error` object must never be passed.

### Key Discoveries:

- Only `src/lib/tonight/load.ts`'s `CODE_SHAPE` (`/^[0-9A-Za-z_]{1,12}$/`) is a ready, reviewed filter for a Postgres or PostgREST code; the new helper reuses it.
- `src/lib/no-console-guard.test.ts` counts `eslint-disable` lines per file exactly and fails on an allowance not fully used, so moving the seven lines into one helper file shrinks the allowlist to one entry.
- No route under `src/pages/api/**` has a unit test, but each is a plain exported `POST` over `context`; a fake context is enough to test one.
- The Stop hook runs the whole unit suite at the end of every turn (CLAUDE.md "Agent hooks"), so a standing red test cannot be committed between phases; a ratchet must start green and each phase tightens it.

## Desired End State

When the operator opens Workers Logs or Workers Issues, every failure in the four flows shows up as a line with a fixed per-step message (`sidereus: forecast.fetch failed`) and indexed fields (`step`, `name`, `code`, `status`), grouped by step in Issues and routable by an automation. A save route that failed because of the server redirects with its own key ("could not reach the database, nothing was saved") instead of the entity's "could not save", so a user mistake and a server fault differ in the redirect and in the log. The stores keep the PostgREST code and HTTP status in a sanitized `cause`. A `silent-catch` guard test lists every catch in runtime code that neither logs nor is justified, so a new silent catch fails CI. The operator has a runbook (`context/deployment/error-visibility.md`) with the Issues switch, the queries per step and the automations to create. Verify with: the unit suites in each phase, `npm run lint`, `npx astro check`, and one local run with a dead forecast URL and a stopped Supabase showing the lines (Phase 6).

## Decisions

Owner on 2026-10-15: first-party tools only; no private data in any report or log. The rest are plan defaults; the owner can override each at plan review.

| # | Decision | Choice | Why |
| --- | --- | --- | --- |
| D1 | Alert path | Workers Issues, enabled in `wrangler.jsonc`; the owner creates the automation in the dashboard | First-party, no SDK; `console.error` is a recorded signal |
| D2 | Log shape | `console.error("sidereus: <step> failed", { step, name, code?, status? })`; message fixed per step, fields structured | One message per step groups in Issues; fields filter in Workers Logs |
| D3 | Save-route faults | Keep the 302 convention; a server fault redirects with `errors.save.unavailable`, user mistakes keep the entity key | Smallest change that separates the two; no change to the project's no-JSON-errors rule |
| D4 | Identifiers in lines | None: no user, site or request id | Keeps the coordinate and privacy NFR trivially true; revisit only on an owner request |
| D5 | Service worker and client errors | Out: no beacon route in this change | Adds an endpoint and a privacy surface; follow-up if wanted |
| D6 | Release identity | Out: rely on the version Workers Logs attaches to each invocation; the runbook confirms it | A `version_metadata` binding would make the helper need `cloudflare:workers` |
| D7 | Island failure state (F13), 404/500 pages (F15), neutral plan state (F12), finder eyepiece notice (F28) | Out: user-visible UI and copy | UI changes need their own design pass; the server side of each is logged |
| D8 | Regression guard | A `silent-catch` ratchet test, green on day one, tightened per phase | The only thing that stops the next silent catch |

## What We're NOT Doing

- No third-party tracker or exporter (Sentry, Datadog, OpenTelemetry destinations, Logpush to a vendor).
- No user, site or request identifier, message, stack, URL, coordinate, email, key or form value in any log line (D4); no `Error` object is ever passed to `console.*`.
- No service-worker or React-island error reporting, no beacon route (D5; F25, F26, F33).
- No `version_metadata` binding or release field (D6; F27).
- No new UI: no island fallback state, no 404/500 pages, no neutral "plan unknown" state, no finder notice (D7; F12, F13, F15, F28). The only copy added is the one `errors.save.unavailable` key in EN and PL.
- No change to the verdict, ranking, forecast fallback behaviour or any engine rule; the fallbacks stay, they gain a trace.
- No retry, backoff, circuit breaker or rate limiting of the new lines. A line is emitted once per failed step per request.
- No edits under `context/archive/`.

## Implementation Approach

Build the vocabulary first, then make the data layer carry causes, then add the lines flow by flow, widest first. Each phase starts with failing tests: a behaviour test that makes the failure happen and asserts the helper's line (never the message), and a tightened silent-catch allowlist. The helper is the only `console.error` site, so the privacy rule is enforced in one file and one test. Workers Issues is switched on in Phase 1 so every later line is alertable from its first deploy, and Phase 6 proves it end to end with the owner.

## Phase 1: The failure helper, the guard and Issues config

### Overview

One `logFailure` helper with a closed step vocabulary, the seven existing lines moved onto it, the `no-console` allowlist reduced to one entry, a silent-catch ratchet, and `observability.issues.enabled`.

### Changes Required:

#### 1. The helper

**File**: `src/lib/observability/log-failure.ts` (new, with `log-failure.test.ts`)

**Intent**: The only place the app writes a failure to the console. It turns an error into the allowed fields and drops everything else (RC1, RC6; F18, F19).

**Contract**: `logFailure(step: FailureStep, error?: unknown, extra?: { status?: number }): void`. `FailureStep` is a closed string union (`FAILURE_STEPS`), dotted names grouped by flow: `forecast.*`, `tonight.*`, `save.*`, `read.*`, `account.plan`, `milestones.*`, `progress.seen`, `finder.*`, `auth.*`, `config.supabase`, `request.form`; one entry per trace site, added as the phases need them. It calls `console.error(\`sidereus: ${step} failed\`, fields)` where `fields` is `{ step, name?, code?, status? }`: `name` from the error (or its `cause`) only when it matches a short identifier shape, `code` only when it passes `CODE_SHAPE` (moved here and exported; `tonight/load.ts` imports it), `status` only an integer 100-599. It never reads `message` or `stack`, never passes an `Error` to the console, and never throws. The single `eslint-disable-next-line no-console` lives here.

#### 2. Move the seven existing lines

**Files**: `src/lib/tonight/build.ts:1415,1439`, `src/lib/finder/load.ts:171,194`, `src/lib/tonight/load.ts:47-54`, `src/lib/account-plan/index.ts:45`, `src/lib/observations/celebrate.ts:39-46`, and the tests that spy on them (`build.test.ts`, `load.test.ts`, `finder/load.test.ts`, `account-plan.test.ts`, `celebrate.test.ts`)

**Intent**: Replace each bespoke `console.error` with `logFailure`; keep behaviour and the fixed-line intent; update the spies to the new line shape.

**Contract**: step words `tonight.session-plan`, `tonight.sky-events`, `finder.stars`, `finder.chart`, `tonight.plan-edits`, `account.plan`, `milestones.read|record|list|seen`, `progress.seen`. `src/lib/no-console-guard.test.ts` `ALLOWED_DISABLES` keeps `src/lib/observability/log-failure.ts: { count: 1 }` and drops the six entries that no longer disable.

#### 3. The silent-catch ratchet

**File**: `src/lib/observability/silent-catch-guard.test.ts` (new)

**Intent**: Fail CI on a catch in runtime code that neither logs nor is justified, so the next silent catch cannot merge (D8).

**Contract**: scans non-test source under `src` (`.ts`, `.tsx`, and the frontmatter and `<script>` blocks of `.astro`, parsed with the TypeScript compiler API) for `catch` clauses and `.catch(...)` handlers that return a constant (`undefined`, `null`, `[]`, `{}`, a literal). Each must call `logFailure` in its body or sit in a per-file allowlist with an exact count and a reason, like `ALLOWED_DISABLES` (an allowance not fully used fails). The first run's inventory becomes the allowlist, so the test is green on day one; later phases delete their entries first. Final allowlist (justified, Phase 6): the service worker, the client-side islands and `src/lib/offline/register.ts`.

#### 4. Switch on Workers Issues

**Files**: `wrangler.jsonc`, `package.json`, `package-lock.json`

**Intent**: Make every logged error an alertable Issue from the first deploy (D1).

**Contract**: add `"issues": { "enabled": true }` under `observability`; raise the `wrangler` devDependency to at least 4.134.0. Confirm `npm run build` still emits the setting into the generated server config and that `npx wrangler deploy --dry-run` accepts it.

### Success Criteria:

#### Automated Verification:

- Helper tests pass: `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null && npx vitest run src/lib/observability/log-failure.test.ts` (never prints a message or stack, rejects a code that fails `CODE_SHAPE`, ignores a status outside 100-599, never throws on `undefined` or a non-Error, never passes an `Error` argument)
- Silent-catch guard passes with the day-one allowlist: `npx vitest run src/lib/observability/silent-catch-guard.test.ts`
- No-console guard passes with one allowed disable: `npx vitest run src/lib/no-console-guard.test.ts`
- The five touched suites pass: `npx vitest run src/lib/tonight src/lib/finder src/lib/account-plan src/lib/observations`
- Full unit suite, lint and types pass: `npm test && npm run lint && npx astro check`
- Production build keeps the Issues setting: `npm run build` then a grep of the generated server config for `issues`

#### Manual Verification:

- Reading `log-failure.ts` confirms no path reads `message`, `stack`, a URL or a form value.

**Implementation Note**: Pause for confirmation before Phase 2.

---

## Phase 2: Stores and the forecast client keep the diagnosis

### Overview

Stop dropping the cause at the source (RC2), without logging yet: results and thrown errors carry a sanitized fault, and one pure rule says which faults are the server's.

### Changes Required:

#### 1. The fault shape and the classification

**File**: `src/lib/observability/fault.ts` (new, with tests)

**Intent**: One sanitized carrier for "what went wrong" that is safe to keep, return and log (F8).

**Contract**: `StoreFault` is an `Error` subclass with a fixed message, `name = "StoreFault"` and read-only `code?` (shape-checked) and `status?`; `faultFrom(error)` builds it from a PostgREST error or a thrown value without keeping the original message. `isServerFault({ code, status })` is a pure table: true for no code at all (network), codes `08*`, `53*`, `54*`, `55*`, `57*`, `58*`, `XX*`, `42501`, `PGRST*`, and any status of 500 or more; false for `22*`, `23*` and other input errors. The table is pinned by a test.

#### 2. Write results carry the fault

**Files**: `src/lib/gear/store.ts` (`WriteResult`, `writeFailure`, `affected`), `src/lib/observations/store.ts:112,131,189,208,229-242`, `src/lib/sky-checks/store.ts:67,103-106,123-126`, `src/lib/onboarding/store.ts:48-50,70-79`, `src/lib/session-plans/store.ts:55,61`

**Intent**: A failed write keeps its code and status next to the fixed message key, and a zero-row update says so (F8, F9, F17).

**Contract**: `{ ok: false; message: MessageKey; fault?: { kind: "server" | "no-rows"; code?: string; status?: number } }`. `kind: "server"` exactly when `isServerFault` holds; `kind: "no-rows"` for the `data.length === 0` branches in `affected()`; a user-input failure (`22P02`, `23514`) has no `fault`. The empty `catch {}` blocks in `create()`, `update()`, `toSiteColumns` and `completeOnboarding` return their key with a `fault` built by `faultFrom` instead of dropping the error. The message keys do not change.

#### 3. Reads throw with a cause

**Files**: `src/lib/gear/store.ts:148,159,217,228,278,289`, `src/lib/observations/store.ts:151,163`, `src/lib/sky-checks/store.ts:85,149,161`, `src/lib/onboarding/store.ts:89`, `src/lib/session-plans/store.ts:36` (align)

**Intent**: A thrown read keeps the key as its message and a `StoreFault` as its `cause`, so a later `logFailure` can read the code (F2, F16).

**Contract**: `throw new Error(KEY, { cause: faultFrom(error) })`; the cause never holds the PostgREST message. `session-plans/store.ts` is aligned to the same carrier.

#### 4. The forecast client keeps step and status

**File**: `src/lib/forecast/open-meteo.ts:84-108`

**Intent**: Say which step of the fetch failed and with what HTTP status, without the URL (F1).

**Contract**: `fetchForecast` throws a `ForecastError` whose `message` is still the existing fixed text (so current assertions hold), with `step: "request" | "http" | "parse" | "schema"` and `status?` set for `http`. No URL, no cause chain from `fetch`.

### Success Criteria:

#### Automated Verification:

- Fault tests pass (classification table, `faultFrom` drops the message): `npx vitest run src/lib/observability`
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

**Contract**: steps `forecast.fetch` (with the `ForecastError` step and status as `name`/`status`), `forecast.incomplete`, `forecast.cache-read`, `forecast.cache-write`, `forecast.cache-missing`. Behaviour (fallback, null) is unchanged. The `waitUntil` write logs from inside `writeCache` since the task is deferred. The module header's "nothing here logs" is replaced by the new rule.

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

- Forecast service tests fail first for a rejected fetch, a 429, bad JSON, an incomplete series with and without a stored copy, a throwing KV read and write, and a missing binding, then pass; each asserts one `sidereus: forecast.* failed` line with only `step`/`name`/`code`/`status`: `npx vitest run src/lib/forecast`
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

**Contract**: `saveFailureKey(step: FailureStep, result: { message; fault? }): MessageKey` logs through `logFailure` with the fault's code and status when `fault` is set (server or no-rows), and returns `errors.save.unavailable` for `kind: "server"` and `result.message` otherwise. New key `errors.save.unavailable` in EN and PL ("We could not reach the database, so nothing was saved. Try again in a moment."), under the existing `errors.save` group; the i18n parity test stays green.

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

- `saveFailureKey` tests fail first: server fault gives the new key and one line; user mistake gives the entity key and no line; no-rows logs `fault.kind` without a key change: `npx vitest run src/lib/observability/save-failure.test.ts`
- Route tests with a fake `context` (one per family: log create, gear site update, sky-check, onboarding, plan save, plan reset): a store returning a server fault redirects with `errors.save.unavailable` and logs one line; a validation failure redirects as before and logs nothing; a non-form body redirects with the shape key and logs `request.form`: `npx vitest run src/pages`
- i18n parity and key tests pass: `npx vitest run src/i18n`
- Silent-catch allowlist entries for the touched files removed, guard green
- Full unit suite, lint and types pass: `npm test && npm run lint && npx astro check`
- Existing e2e for the touched saves stay green: `SUPABASE_URL=<local API_URL> SUPABASE_SECRET_KEY=<local SECRET_KEY> npx playwright test observation-log observation-log-management onboarding session-plan-edit sky-checks`
- Smoke walk passes against the local stack: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=… npm run smoke`

#### Manual Verification:

- With the local Supabase stopped, saving a log entry shows the new "could not reach the database" message and the preview output holds one `sidereus: save.log failed` line with no entry value in it.

**Implementation Note**: Pause for confirmation before Phase 5.

---

## Phase 5: Sign-in, session and the finder

### Overview

Flow C and the finder half of flow D: an Auth outage stops looking like a mass sign-out, and every way to the finder's `failed` state leaves a line (F3, F11, F12 trace, F14, F21, F23, F24).

### Changes Required:

#### 1. Middleware and the client

**Files**: `src/middleware.ts:13-21`, `src/lib/supabase.ts:21`

**Intent**: Read the `error` from `getClaims`, log it when it is a real failure, and log an unconfigured deploy once (F3, F24).

**Contract**: `sessionUser` logs `auth.claims` with the error's name, code and status unless the error is the plain "no session" kind (an anonymous visitor must not log); the `catch` logs the same step. `createClient` logs `config.supabase` once per isolate when it returns `null` in a non-dev build. Behaviour (null user, redirects) is unchanged.

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

- Middleware tests fail first with a stub Supabase: `getClaims` returning an auth error logs `auth.claims` and yields a null user; a missing session logs nothing; a thrown non-auth error logs once: `npx vitest run src/middleware.test.ts`
- Auth route tests (fake `context`): a rate-limit code, a 500 and a network failure each log one line and redirect with the same key as today; `invalid_credentials` logs nothing; the email never appears in an argument: `npx vitest run src/pages/api/auth`
- Finder loader tests: each way to `failed` logs a line; a planet or engine throw outside the old `try` now reaches `failed`: `npx vitest run src/lib/finder`
- Silent-catch allowlist entries for the touched files removed, guard green
- Full unit suite, lint and types pass: `npm test && npm run lint && npx astro check`
- E2E for sign-in and the finder stay green: `SUPABASE_URL=<local API_URL> SUPABASE_SECRET_KEY=<local SECRET_KEY> npx playwright test sign-in-continue finder-chart`
- Smoke walk including the finder gates passes against the local stack: `npm run smoke` with the local key inline

#### Manual Verification:

- With the local Auth service stopped and a signed-in session, loading `/tonight` redirects to sign-in as before and the preview output holds an `sidereus: auth.claims failed` line with a `name` and no email.

**Implementation Note**: Pause for confirmation before Phase 6.

---

## Phase 6: The operator path, proof and the rule

### Overview

Close the loop with the owner: the runbook, the final guard allowlist, one deliberate failure proving the alert path, and the written rule for the next agent.

### Changes Required:

#### 1. Runbook

**File**: `context/deployment/error-visibility.md` (new)

**Intent**: The operator can find, group and be alerted on every step without reading code.

**Contract**: the step table (each `FailureStep`, the flow, what the user sees, what to check), the Workers Logs query for the `sidereus:` prefix and per `step` field, how to confirm Workers Issues is on and that the version is shown per invocation (D6), the Issues automation to create (webhook or chat; the owner chooses the target), and the "first thing to look at" order from the audit's root causes. No identifiers, no keys.

#### 2. Final guard allowlist and the written rule

**Files**: `src/lib/observability/silent-catch-guard.test.ts`, `CLAUDE.md` (Tripwires, `no-console` bullet and a new Observability bullet), `context/foundation/lessons.md`

**Intent**: Leave only justified silent catches (service worker, client islands, `register.ts`), and tell the next agent the new rule.

**Contract**: the allowlist holds only entries with a reason; the CLAUDE.md tripwire says "log a failure through `logFailure(step, error)`; add a step to `FAILURE_STEPS`; never pass an `Error`, a message, a URL or a value", and drops the old "needs its own allowlisted disable" for logs. A lesson (via `/10x-lesson`) records: swallowed catches need a line, the step vocabulary, and the sanitized `cause` for store errors.

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

- After the first deploy with this change, the owner confirms in the dashboard that Workers Issues is on and shows the version per invocation.
- The owner creates the Issues automation and one deliberate failure (the preview with a dead `FORECAST_BASE_URL`) produces an Issue grouped as `sidereus: forecast.fetch failed` and reaches the chosen target.
- A final read of one Workers Logs line per flow confirms no coordinate, email, key or form value appears.
- If the line does not become an Issue, the runbook's fallback (a saved Workers Logs query) is used and the gap is recorded as a follow-up, not silently dropped.

**Implementation Note**: This phase needs the owner for the dashboard steps; pause for confirmation before closing the change.

---

## Testing Strategy

### Unit Tests:

- The helper: closed vocabulary, field filtering, `CODE_SHAPE`, status range, never a message, stack, URL or `Error` argument, never throws.
- A coordinate canary in every flow test: the fake site's latitude and longitude, a fake email and a fake form value are put into error messages, and the test fails if any logged argument contains them.
- The classification table (`isServerFault`), the fault carrier, the store results and thrown causes, the forecast steps, the loaders, the save-failure step, the middleware and the auth routes.
- The silent-catch ratchet and the no-console guard.

### Integration Tests:

- Route tests with a fake `context` per family; the existing Playwright specs and `npm run smoke` stay green; no new e2e is needed because no UI is added except one error message.

### Manual Testing Steps:

1. Build and preview with a dead `FORECAST_BASE_URL`; load `/tonight`; read the preview output for `sidereus: forecast.fetch failed`.
2. Stop local Supabase; save a log entry; see the new message and `sidereus: save.log failed`.
3. Stop local Auth; reload a gated page; see `sidereus: auth.claims failed`.
4. After deploy, the Issues check and the automation (Phase 6).

## Performance Considerations

A line costs one `console.error` with a small object, only on a failure path. A forecast outage logs once per failed step per request (a few lines per page view); Workers Logs' 256 KB per invocation cap is far above that. No hot path gains work.

## Migration Notes

No database migration. The new `errors.save.unavailable` key ships with both locales. The `wrangler` bump and `observability.issues.enabled` take effect on the first deploy after merge (CI's `deploy` job); a dashboard-only enable would be turned off by it, which is why the flag is in the config.

## References

- Audit: `context/audits/observability/2026-10-15_tonight-save-routes-auth-finder-plan.md`
- Roadmap slice: `context/foundation/roadmap.md` S-07; GitHub #175
- Safe-code pattern: `src/lib/tonight/load.ts:40-54`, `src/lib/session-plans/store.ts:36`
- No-console guard: `src/lib/no-console-guard.test.ts`
- Lessons: `context/foundation/lessons.md` (`no-console` is an error in all of `src`; keep "unknown" apart from "free")
- Cloudflare: Workers Issues, Workers Logs and Wrangler configuration (observability) docs, read 2026-10-15

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The failure helper, the guard and Issues config

#### Automated

- [ ] 1.1 Helper tests pass (never prints a message or stack, rejects a code that fails `CODE_SHAPE`, ignores a status outside 100-599, never throws on `undefined` or a non-Error, never passes an `Error` argument)
- [ ] 1.2 Silent-catch guard passes with the day-one allowlist
- [ ] 1.3 No-console guard passes with one allowed disable
- [ ] 1.4 The five touched suites pass
- [ ] 1.5 Full unit suite, lint and types pass
- [ ] 1.6 Production build keeps the Issues setting

#### Manual

- [ ] 1.7 Reading `log-failure.ts` confirms no path reads `message`, `stack`, a URL or a form value

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

- [ ] 4.1 `saveFailureKey` tests fail first, then pass (server fault key and line, user mistake unchanged, no-rows logged)
- [ ] 4.2 Route tests per family: server fault redirects with `errors.save.unavailable` and logs one line, validation unchanged, non-form body logs `request.form`
- [ ] 4.3 i18n parity and key tests pass
- [ ] 4.4 Silent-catch allowlist entries for the touched files removed, guard green
- [ ] 4.5 Full unit suite, lint and types pass
- [ ] 4.6 Existing e2e for the touched saves stay green
- [ ] 4.7 Smoke walk passes against the local stack

#### Manual

- [ ] 4.8 With local Supabase stopped, saving a log entry shows the new message and one `sidereus: save.log failed` line with no entry value

### Phase 5: Sign-in, session and the finder

#### Automated

- [ ] 5.1 Middleware tests fail first, then pass (auth error logs and yields null user, missing session silent, thrown error logs once)
- [ ] 5.2 Auth route tests: rate limit, 500 and network failure each log one line with the same key as today, `invalid_credentials` silent, no email in any argument
- [ ] 5.3 Finder loader tests: each way to `failed` logs a line, and throws outside the old `try` reach `failed`
- [ ] 5.4 Silent-catch allowlist entries for the touched files removed, guard green
- [ ] 5.5 Full unit suite, lint and types pass
- [ ] 5.6 E2E for sign-in and the finder stay green
- [ ] 5.7 Smoke walk including the finder gates passes against the local stack

#### Manual

- [ ] 5.8 With local Auth stopped and a signed-in session, a gated page redirects as before and the output holds `sidereus: auth.claims failed` with no email

### Phase 6: The operator path, proof and the rule

#### Automated

- [ ] 6.1 Silent-catch guard passes with only reasoned entries
- [ ] 6.2 Full unit suite, lint, types, build and DB suites pass
- [ ] 6.3 Full e2e passes in CI with `failOnFlakyTests`
- [ ] 6.4 Agent-hooks proof still passes

#### Manual

- [ ] 6.5 After the first deploy, the owner confirms Workers Issues is on and the version shows per invocation
- [ ] 6.6 The owner creates the Issues automation and a deliberate failure arrives grouped as `sidereus: forecast.fetch failed` at the chosen target
- [ ] 6.7 One Workers Logs line per flow holds no coordinate, email, key or form value
- [ ] 6.8 If a line does not become an Issue, the fallback query is used and the gap is recorded as a follow-up
