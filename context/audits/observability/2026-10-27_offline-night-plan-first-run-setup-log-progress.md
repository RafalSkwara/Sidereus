---
type: observability-audit
date: 2026-10-27 09:19
mode: audit
commit: 8da351d
branch: docs/demo-accounts
dirty_tree: false
areas: [offline-night-plan, first-run-setup, observing-log-progress]
area_source: user # rotation proposed from the previous report and the roadmap, confirmed by the owner
runtime_proof: partial # server-side shapes observed on local workerd; service worker and browser shapes static only
error_tracker: none in code (owner rule, first-party only). Workers Logs + Issues + traces, invocation_logs off (wrangler.jsonc observability); console.error becomes an Issue, console.warn does not
previous_report: context/audits/observability/2026-10-15_tonight-save-routes-auth-finder-plan.md
findings: { critical: 2, high: 10, medium: 17, low: 11 }
---

# Observability audit: offline night plan, first-run setup, observing log and progress (2026-10-27)

## 1. TL;DR

- **An unforeseen throw in any child component is a blank 200 with no line at all.** Astro streams on Workers. A throw in a component under a page or under a server island (anywhere below the island's own frontmatter) happens after the 200 headers. Astro's catch calls `controller.error(e)` and logs nothing; workerd prints nothing. **Runtime-observed:** a 200 with 0 bytes and only the request log line. Every Tonight tile, card and focused page is such a child. (RC1, P1)
- **Whose fault a database error is gets decided by its SQLSTATE class, not by who built the request.**
  - Class 22/23 is "user input" and leaves **no line**. This was observed for a 23502 on a gear create, which got a 302 with the entity's own key, the same as a typo.
  - `42501` and `PGRST301-303` are warn-level notices, never Issues.
  - Both are right for an id the user typed. On the onboarding RPC, the creates and every read, they mean a schema/grant regression, which is exactly what CI's migrate-before-deploy window can cause.
  - Stale-cookie auth errors (`AuthInvalidJwtError`, `bad_jwt`) are silent on the same reasoning, so a signing-key or wrong-key mistake signs everyone out without a line.
  - (RC2, P2-P4)
- **Only thrown errors are guarded; success-shaped no-ops have no observer.** The silent-catch guard closed the catches. The worst gaps now are a bare `return`, an empty list, a zero-row update or an RPC that skips:
  - The service worker's "nothing to store" paths leave the offline plan stale after a save, with no report.
  - An RLS regression shows "nothing seen yet" on the progress page, with no line.
  - (RC3; O1, L1)
- **The browser channel is lossy by construction, and it is the only signal for the offline flow.**
  - Step-level name filter: a code `TypeError` at a network step is dropped as routine.
  - The dedupe slot is spent before the send, the response is ignored, and the rate key is one global key.
  - The service worker has no global handlers.
  - The hydration step can never match a production React message.
  - The owner's weekly review (#232) sees a biased sample. (RC5)
- **The discriminator is stripped before the line.**
  - `tonight.build` is one Issue for about 52 engine invariants, all named `Error`.
  - Every geocoder failure is `Error`.
  - A tz-lookup failure line has no name or code.
  - `island.import` covers four chunks.
  - (RC4)
- **What S-07 fixed holds up:** stores keep their code, pages and save routes log through one helper, the session read reads `error`, and the old F3/F4/F8/F16/F22/F24 gaps are closed (section 7).

## 2. Capture model

**Runtime.**
- Cloudflare Workers with static assets (`wrangler.jsonc`), Astro 7.3.2 SSR with `@astrojs/cloudflare` 14.3.1, streaming on (the default; `core/app/base.js:73`, `runtime/server/render/page.js:41-56` → `renderToReadableStream`).
- React 19.3 islands, Astro server islands (`/_server-islands/*`, outside the middleware's `PROTECTED_ROUTES`), Supabase via `@supabase/ssr`, KV forecast cache, Open-Meteo.
- A Workbox service worker `src/sw.ts` (826 lines) and a Workers rate limiter `CLIENT_ERROR_LIMITER`.
- No cron, queue or second worker.

**Error tracker.** None in code, by owner rule. In repo:
- `wrangler.jsonc` observability: `logs.enabled`, `invocation_logs: false` (it stored `request.cf` geolocation), `traces.enabled`, `issues.enabled`, `redact_query_string`.
- All of these are pinned by `src/lib/wrangler-config.test.ts`. Every `console.error` becomes an Issue; `console.warn` does not.

**Server logging.**
- `src/lib/observability/log-failure.ts` is the only console site.
  - `logFailure(step, error, {status})` → `console.error("sidereus: <step> failed", {step,name?,code?,status?})`.
  - `logNotice` → `console.warn("… noted")`.
- Fields are shaped: a name only if identifier-like, a code only via `isLoggableCode`, a status 100-599. Never a message or stack.
- Steps are the closed `FAILURE_STEPS` list.
- Helpers:
  - `fault.ts`: `StoreFault`, `faultFrom`, `withFault`, and `classifyFault` → `input | refused | session | no-rows | server`.
  - `read-failure.ts`: `logReadFailure`, a warn for `session`/`refused`.
  - `save-failure.ts`: `saveFailureKey`. A server fault gives an error line and `?error=errors.serverFault`; refused/session/no-rows give a warn and the entity key; input gives no line.
- Guards: `silent-catch-guard.test.ts` (AST: every catch reports, rethrows with a cause or is allowlisted; 27 files, 43 allowlisted sites) and `no-console-guard.test.ts`.

**Capture boundaries (observed, section 3).**
- Astro logs a throw in a page's own frontmatter, an endpoint or the middleware with `logger.error` → `console.error`, as a timestamped `[ERROR] <message + stack>` string, and answers 500 with an empty body.
- A throw in a server-island component's **own** frontmatter is also logged and 500, because head propagation buffers it before the headers.
- **Outside every boundary:** a throw in any **descendant** component, or mid-template, after streaming starts (`runtime/server/render/astro/render.js:58-70`). The result is a 200 with an empty body and no line. Astro's production request log is a no-op, so there is no access line either.

**Client reporting.**
- `POST /api/client-error` (`src/pages/api/client-error.ts`):
  - same-origin, ≤512 B, content type, strict schema, then the rate limit (30/60 s, one constant key, per location);
  - an accepted report becomes a **warn** `sidereus: client.<step> noted` (never an Issue; owner decision, #232).
- Page reporter: `client/browser.ts`.
  - Global `error`/`unhandledrejection` handlers are installed from `Layout.astro`'s bundled script.
  - Reports are capped at 5 per page and deduplicated by step+name.
  - Only scripts under `/_astro/` count.
- Service-worker reporter: `src/lib/offline/report.ts`, through the same core.
- Routine network names (`TypeError`, `AbortError`, `TimeoutError`) at the five `NETWORK_STEPS` are dropped (D14), and so are reports while `navigator.onLine === false`.

**Scrubbing.**
- The closed vocabulary above, plus `redact_query_string`, which also hides the `?error=` key on the follow-up GET.
- Astro's own `[ERROR]` line is outside the vocabulary: it carries the message and the stack (P8).

**Deploy identity.** None in code: no `version_metadata` binding, no release or environment field (#189, carried).

**Assumptions (outside the repo, not findings), all unconfirmed:**
- Workers Logs and Issues collect these lines in production, and Issues group by the first string argument (`sidereus: <step> failed`).
- The second `console.error` argument is stored as structured fields. The project's runbook says to search by message text because it is not indexed as fields.
- How Issues fingerprint Astro's timestamp-prefixed `[ERROR]` lines.
- Whether the production runtime records an error outcome or a trace status for a response whose body stream errored. Locally there was no sign of one (section 3).
- Whether Workers Logs stamps a script version on each event (it would make #189 cheaper).

## 3. What reaches the tracker

Local `astro preview` (workerd) against local Supabase; probes behind an `x-probe` header in an isolated worktree. "Line" means a console line in the preview log; "Issue" is inferred from its level.

| Probe | Failure shape | Response | Console | Issue (inferred) | Verdict | Basis |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | throw in a page's own frontmatter (`/`) | 500, 0 B | Astro `[ERROR] Error: <msg>` + stack | yes, unstructured | good (P8 caveat) | observed |
| P3 | throw in an endpoint | 500, 0 B | Astro `[ERROR]` + stack | yes, unstructured | good | observed |
| P5 | throw in the middleware | 500, 0 B | Astro `[ERROR]` + stack | yes, unstructured | good | observed |
| P10a | throw in a **child component**'s frontmatter (`/`) | **200, 0 B** | **request line only** | **no** | **missed** | observed |
| P10c | throw mid-template in a child, after output | **200, 0 B** (earlier output lost) | **request line only** | **no** | **missed** | observed |
| P10b | throw in the island component's own frontmatter (`TonightContent`) | 500, 0 B | Astro `[ERROR]` + stack | yes | good | observed |
| P10a-island | throw in a child of `TonightContent`, island URL, signed in | **200, 0 B** | **request line only** | **no** | **missed** | observed |
| P10c-island | throw mid-template in that child | **200, 0 B** | **request line only** | **no** | **missed** | observed |
| P6a | gear create fails with `23502` | 302 `?error=errors.save.telescope` (same as a typo) | **none** | **no** | **missed** | observed |
| P6b | gear create fails with `42501` | 302, entity key | `save.gear noted {code:42501}` (warn) | no | poor | observed |
| P6c | gear create fails with `08006` (control) | 302 `?error=errors.serverFault` | `save.gear failed {code:08006}` (error) | yes | good | observed |
| P6d | `/log` read fails `42501` | 200 + "could not load" | `read.log noted` (warn) | no | poor | observed |
| P6d' | `/log/progress` seen read fails `42501` | 200 + "could not load" | `progress.seen failed` (error) | yes | inconsistent with P6d | observed |
| — | SW "nothing to store" (non-200, no meta, no shell) | stale offline copy | nothing, no report | no | missed | static (O1) |
| — | SW code `TypeError` at a network step | fallback / nothing | dropped as routine | no | missed | static (O4) |
| — | client report under load (429) or dedupe slot spent | 429 / not sent | nothing | no | missed | static (O3) |
| — | production React hydration error | island keeps server HTML | `client.island.uncaught noted` (wrong step) | no | poor | static (P9) |

For P10a/P10c, workerd printed nothing about the errored stream; the client saw a clean end of stream with 0 bytes, not a network error. Since a server-island replacer ignores an empty or failed body (#190), the user sees a skeleton that never resolves, or a blank page for a full-page child.

## 4. Systemic root causes

**RC1. Streamed rendering drops every error after the first byte.**
- `astro/dist/runtime/server/render/astro/render.js:58-70` runs the body in an async IIFE whose `catch` only calls `controller.error(e)`.
- `server-islands/endpoint.js:150-165` renders the island the same way.
- Astro's `logger.error` sits only on the page factory, endpoint and middleware paths. The app's hand-placed `try`/`logFailure` blocks cover the failures someone foresaw; an unforeseen `TypeError` in a card, tile, `GearShell`, `Layout` child or any island descendant has no catcher.
- Runtime-proven (section 3).
- Explains P1, and why #190's "skeleton stays" has no server trace.

**RC2. Fault kind is a property of the code, not of who supplied the value.**
- `classifyFault` (`src/lib/observability/fault.ts:124-160`): `INPUT_CODE = /^2[23].../` is input, `42501` is refused, `PGRST301-303` are session. `withFault` then returns `{}` for input (`:176-189`), and `saveFailureKey` writes no line (`save-failure.ts:22-24`).
- `logReadFailure` (`read-failure.ts:16-19`) and `recordSkyVerdict` (`sky-checks/record.ts:49`) send refused and session to warn.
- `sessionUser`'s routine lists (`src/lib/auth/session-user.ts:11-33`) make `AuthInvalidJwtError` and `bad_jwt` silent.
- Each rule is right for one user's typo or stale cookie. Each is wrong when the server built the request: a create, an RPC, a read, a key rotation. That is the shape a migration or grant regression takes, and `ci.yml:92` runs migrations before the deploy.
- Explains P2, P3, P4, P7 and part of L1.

**RC3. The guard sees catches; success-shaped no-ops are invisible by design.**
- `silent-catch-guard.test.ts` checks `catch`, `.catch` and `.then(ok, fail)` only. The remaining blind failures in these flows are not catches:
  - the service worker's bare `return`s (`sw.ts:410-434`, `484-492`);
  - a skipped asset (`sw.ts:258-259`) and a wrong-shape index read as "none" (`sw.ts:85-101`, `copies.ts:631-642`);
  - a refused `store-page` message (`sw.ts:812-817`);
  - a zero-row update logged as a bare `{step}` notice (`fault.ts:166`);
  - an empty seen list rendered as "nothing seen yet" (`progress.astro:55-59`);
  - a `record_sky_verdict` RPC that skips a foreign site and returns nothing (`sky-checks/store.ts:72`);
  - a Leaflet `tileerror` event (`map-panel.tsx:135-137`).
- Explains O1, O8, O10, O12, L1, L3, L4, S2, S5.

**RC4. The discriminator is removed before the line is written.**
- Fixed-message `throw new Error(...)` with name `Error`: 52 runtime sites, which collapse into `tonight.build` (`tonight/load.ts:220`) and `island.geocode` (`geocode.ts:93-105`).
- `WriteFault` has no name (`fault.ts:176-189`), so a tz-lookup throw logs `{}` (`onboarding/store.ts:51-55`, `gear/store.ts:131-132`).
- `StoreFault` keeps no transport status except where the response is passed (#233).
- Shared steps: `save.gear`, `save.log`, `read.gear`, `request.form`, `island.import`, `forecast.fetch`.
- Client dedupe by step+name (`reporter.ts:42-45`).
- Explains P5, P6, P10, P11, S1, S3, S4, L5, O14.

**RC5. The browser channel loses reports by construction.**
- The `NETWORK_STEPS` filter works by error name over whole steps (`client/steps.ts:61-67`, `classify.ts:25-31`).
- The reporter adds the key to `seen` before `send` and never reads the response (`reporter.ts:38-48`).
- The rate limit is one constant key across all visitors (`rate-limit.ts`, `client-error.ts:50`).
- Reports are dropped while `navigator.onLine === false`.
- The service worker has no global `error`/`unhandledrejection` handlers (`sw.ts:790-826`).
- The hydration test reads a dev-only message (`browser.ts:48`; production React builds "Minified React error #418…", `react-dom-client.production.js:18-30`).
- All of it is warn-level by decision (#232), so the weekly review sees what survived these filters, which under-represents real outages.
- Explains O3, O4, O5, O7, O9, O11, P9, S6.

## 5. Findings by area

IDs are new for this run (P plumbing, O offline, S setup, L log). Severity assumes the pipeline is on. One mechanism is one finding.

### 5.1 Platform and plumbing (cross-cutting)

| # | Location | Category | Severity | What happens in production | Fix direction |
| --- | --- | --- | --- | --- | --- |
| P1 | `astro/dist/runtime/server/render/astro/render.js:58-70`, `server-islands/endpoint.js:150-165`; every component under a page or island | coverage-gap | **critical** | **Observed.** An unforeseen throw in any child component (a Tonight card or tile, `GearShell`, a log row, a progress tile) or mid-template gives a 200 with an empty body. For a page the user sees a blank page; for an island the skeleton never resolves (#190). The responder gets no line, no Issue, and a 200 outcome. A bad deploy that breaks one shared child blanks every page that uses it, invisibly. | In `src/middleware.ts`, wrap an HTML response's body in a `ReadableStream` that pulls from the original reader and, on a read error, calls `logFailure("request.stream", error)` (a new step) before erroring the stream. One file, every page and island. Alternative: turn streaming off so Astro's 500 path logs it (owner decision D1). Prove it with the probe suite's P10a/P10c rows (section 8). |
| P2 | `fault.ts:124,142-150,176-189`; `save-failure.ts:22-24`; `onboarding/store.ts:81-84`; `gear/store.ts:69-77`; `observations/store.ts` creates | flattened-response | **critical** | **Observed (23502).** Every class 22/23 code except the user cases is silent. That means a not-null or FK violation after a migration, a 22001 or 22003 after a column change, or a 22P02 from a bad cast in a create or the `complete_onboarding` RPC. The user gets the entity's "could not save" for every first-run save; the responder gets nothing. A broken onboarding for every new user is undetectable, and CI's migrate-before-deploy (`ci.yml:92`) makes the old-code/new-schema window real. | Make classification call-site aware: `withFault(error, { origin: "server-built" })` (creates, RPCs, reads) treats 22/23 as `server`, except the constraints the user's own input can hit (`23514`, `23505` on a user-unique). Keep `input` for id-addressed update/delete `22P02`. |
| P3 | `fault.ts:127,153`; `read-failure.ts:16-19`; `save-failure.ts:30`; `sky-checks/record.ts:49`; log and gear stores | logged-not-captured | high | **Observed (42501).** A lost `GRANT`, a revoked `execute` on an RPC (`sky_checks.sql:110-130`) or an RLS policy broken by a migration returns `42501` (or `PGRST301-303` on a JWT-config mismatch). Every user is affected: saves fail with the entity key, `/log`, `/log/[id]` and `/log/sky` show "could not load", and the verdict check stops recording. The responder sees only warn `noted` lines, no Issue. | Same `origin` split: `42501` on a server-built request is `server`. Keep `refused` for id-addressed writes. Also escalate a burst: when one isolate sees N refused/session/no-rows notices for one step within a minute, emit one `logFailure` (owner decision D2). |
| P4 | `src/lib/auth/session-user.ts:11-33,53-63` | swallowed | high | `AuthInvalidJwtError`, `bad_jwt` and `validation_failed` are routine and silent, which is right for a crafted or stale cookie. A signing-key rotation or a `SUPABASE_URL`/key from another project produces exactly these for every user. Everyone is signed out, gated pages redirect, and there is no line. | `logNotice("auth.claims", error)` for the invalid-signature subset (warn, countable), plus the same per-isolate burst escalation as P3. Never log the token. |
| P5 | `src/lib/tonight/load.ts:220`; about 52 `throw new Error("<fixed>")` in `src/lib/engine/*` and `src/lib/catalogue/*` | identity-lost | high | `tonight.build` is one Issue for a bad stored zone, `chooseOwned`, `buildTonight` and every engine invariant, all named `Error`. Two different bugs look identical, and a regression hides inside an existing Issue. | An `InvariantError` with a closed `code` set (shape-checked like `isLoggableCode`), and split the step (`tonight.zone`, `tonight.build`). |
| P6 | `fault.ts:72-81`; postgrest `PostgrestBuilder.ts:293-355`; every store except `skyCheckStore.record` | identity-lost | medium | A timeout, a DNS failure and a gateway 502 all log `name: StoreFault` with no code and no status, so an outage and a bug read the same. Sharpens **#233**. | Do #233: pass `{ status }` (0 included) to `faultFrom`/`withFault` at every call site. |
| P7 | `src/pages/log/progress.astro:41-49`; `src/lib/observations/celebrate.ts:84-90` | noise | medium | **Observed.** The same `42501` read is a warn on `/log` and an error on `/log/progress`. `progress.seen` and `milestones.*` use `logFailure` directly, so an expired session raises up to four Issues for one save, while the same fault elsewhere raises none. This trains the owner to ignore Issues. | Route the reads through `logReadFailure` (after P3's change) and give the progress compute its own `try`. |
| P8 | Astro `logger.error(null, err.stack \|\| err.message)` (`core/pages/handler.js`, `routing/handler.js`, `middleware/astro-middleware.js:62`) | config | medium | **Observed.** An uncaught throw gives a timestamped `[ERROR] <message + stack>` string: no `sidereus:` prefix, no step, and the message included. The leak is latent today (runtime throws quote catalogue ids, zones and numbers, not user text), but it is the one line that breaks the "never a message" rule, and the `sidereus:` query misses it. | With P1's wrapper in place, catch around `next()` too: `logFailure("request.uncaught", error)`, then rethrow. Accept Astro's duplicate line, or point the runbook at both. |
| P9 | `src/lib/observability/client/browser.ts:48,90` | missing-context | medium | Production React messages are minified ("Minified React error #418…"), so `/hydrat/i` never matches. Every hydration mismatch arrives as `island.uncaught`. The tests pass on dev wording. | Match `#418`, `#423` and `#425` (hydration) alongside the dev regex, and test with the production string. |
| P10 | `save.gear` (6 routes), `save.log` (create/edit/delete), `read.gear` (5 pages), `request.form` (every route), `sky.astro:43-52` (list + tally) | missing-context | medium | One Issue covers several routes and operations; the responder can't tell which entity, operation or route failed. | A closed `op` field (`create \| update \| delete`) or split steps (`save.log-create`…), plus a route word on `request.form`. |
| P11 | `src/lib/forecast/service.ts:218,240`; `open-meteo.ts:92-129` | missing-context | medium | An Open-Meteo outage and a provider contract change (`parse`/`schema`) share the `forecast.fetch` Issue (the code is a field, not the message), and `forecast.incomplete` has no fields. | Split `forecast.contract` from `forecast.fetch`. |
| P12 | `src/lib/finder/load.ts:145-158` | noise | low | `finder.tonight` logs after the loader already logged its cause (a duplicate), and its "unreachable" `null` branch is reachable when a session expires between the shell and the island. | Log only on the branch with no prior line; a notice for the null user. |
| P13 | `src/lib/observability/rate-limit.ts:19,38`; `client-error-limit.ts` | missing-context | low | One shared "logged once" flag: after a missing-binding line, a later limiter throw is silent. | Separate flags per cause. |
| P14 | `log-failure.ts` `AUTH_ERROR_CODES`; `log-failure.test.ts:189-196` | config | low | The pin is one-way: a code auth-js adds later is silently dropped from lines (noise lost, never a leak). | Also fail when the installed `ErrorCode` union has a code the list lacks. |

### 5.2 Offline night plan (service worker)

All findings here reach at most a warn-level `client.*` line (#232).

| # | Location | Category | Severity | What happens in production | Fix direction |
| --- | --- | --- | --- | --- | --- |
| O1 | `src/sw.ts:410-434` (`commitIsland`: non-200, `pending.get` miss, `copyMetaFor` undefined), `484-492` (`storeNextCopy`), the `storePageRun` equivalents | missing-throw | high | Every "nothing to store" path is a bare `return`. A change to `OfflineCopy`'s `data-offline-copy` markup, the island/shell shape, a 5xx on the worker's fetch or a 3xx from an expired session (`redirect: "manual"`) stores nothing for anyone. After a plan save, the stored copy keeps the old plan, and offline at the site the user sees it with the "prepared" notice. The responder gets nothing, and there is no "stored" count to compare against. | Report a closed `sw.commit-skipped` step at the "should have stored" returns, with a closed reason word as the name (the dedupe bounds the volume). Keep the signed-out empty-body case silent. |
| O2 | `src/sw.ts:760-763`; allowlist `silent-catch-guard.test.ts:166-170` | swallowed | high | `await purge()` is unguarded in the auth POST route. If `caches.delete` or the index write rejects, the sign-in/sign-out POST fails as a network error: the user isn't signed out, **the previous user's stored plan stays**, and the POST never reaches the server. Nothing is reported (the allowlist accepts it). | `try { await purge() } catch (e) { report("sw.purge", e) }`, then still `fetch(request)`; retry the purge on the next page's `purge` message. |
| O3 | `src/lib/observability/client/reporter.ts:38-48`; `src/lib/offline/report.ts:15-22`; `src/pages/api/client-error.ts:50` | coverage-gap | high | The step+name key is spent before `send`, the response is never read, and the limiter is one key for every visitor (30/min per location). A deploy-wide fault fills the budget in seconds; every later report, of any step, gets a 429 and is lost for that page or worker wake-up. The route logs no refusals. "No failures" and "failures dropped" look the same. | Release the key on a 429 or 5xx (or a send that throws). Have the route emit one throttled `logNotice("config.rate-limit")` per isolate per minute when it refuses for the limit. |
| O4 | `src/lib/observability/client/steps.ts:61-67`; `classify.ts:25-31`; `sw.ts` (`storePageRun`, `storeNextCopy`, `afterNavigation`, `storeOfflinePage`, `keepAssets`) | swallowed | high | The five network steps hold nearly all store logic. A real code `TypeError` there (an undefined property, a bad `.clone()`, a shape change after a deploy) is dropped as routine. The most likely regression class looks like quiet offline traffic. | Classify at the `fetch` call: wrap only the `fetch(...)` in the routine filter and report everything else under the step. |
| O5 | `src/sw.ts:616-619,636-639,732-736,773-780` (the four allowlisted fallback catches) | flattened-response | high | The catches fall back to the stored copy or `/offline` for **any** error: a cache read fault, `trackClient`, a bug. An online user gets "needs a connection" and nothing is reported. The guard accepts them because they contain a conditional `throw`. | Report unless the error came from the `fetch` and is routine (after O4). |
| O6 | `src/sw.ts:786-792`; `src/lib/offline/register.ts:11` | coverage-gap | high | When `precacheAndRoute`'s install fails (a precache 404 after a bad deploy), the new worker turns `redundant`, after `register()` has resolved, so `island.sw-register` never fires. Users stay on the old worker or none, and offline breaks for everyone after that deploy, silently. | Page side: watch `registration.installing`'s `statechange` and report `island.sw-register` (a closed name such as `SwRedundant`) on `redundant`. |
| O7 | `src/sw.ts:790-826`; `820-825` (`list-copies`) | coverage-gap | medium | The worker has no `error`/`unhandledrejection` listeners. A failed `readIndex` in `list-copies` never replies, so `/offline` shows "nothing saved" after 1.5 s (`offline.astro:126-136`) while copies exist. | Worker-global handlers calling `report`; catch `list-copies` and report `sw.index`. |
| O8 | `src/sw.ts:258-259` | missing-throw | medium | A missing or 404 `/_astro/*` asset is skipped (`response?.ok` unchecked, no report). The stored pair references assets that aren't stored, so offline the page is unstyled or its islands are dead. | Report a non-ok answer as `sw.precache` (closed name `HttpNotOk`). |
| O9 | `src/sw.ts:659-660,722-724` | identity-lost | medium | The purge on the sign-in bounce reports under `sw.navigation`, a network step, so a `TypeError` is dropped and a privacy-relevant purge failure isn't recognisable. Four purge sites report three different ways. | Wrap every `purge()` call in one helper that reports `sw.purge`. |
| O10 | `src/sw.ts:85-101`; `src/lib/offline/copies.ts:631-642` | swallowed | medium | Corrupt JSON reports `sw.index`, but a valid-JSON index of the wrong shape or version makes `parseIndex` return `undefined` silently. A new scope is created and the sweep deletes every stored copy, so users lose their offline plans with no trace. | Report `sw.index` (name `IndexShape`) when a stored index exists but is rejected. |
| O11 | `src/sw.ts:320-344,418-422,442` (`sw.shell`, `sw.island-commit`) | noise | medium | At these non-network steps a body cut off mid-read (`TypeError`) is reported as a fault. On flaky networks at dark sites this is normal and drowns the real index and cache faults, and dedupe gives no counts. | Treat a body-read `TypeError` as routine; guard only the `.text()` calls. |
| O12 | `src/sw.ts:812-817`; `copies.ts:200-221` (`storeRequestFrom`) | swallowed | low | A `store-page` message that fails validation is dropped, so the stored plan stays stale after a save. | Report a rejected message as `sw.store-page` (name `Refused`). |
| O13 | `src/lib/offline/page-state.ts:128-143` | coverage-gap | low | If no controller exists and the worker never registered, `serviceWorker.ready` never resolves, and a signed-out `purge` or a `store-page` is lost without trace. | Report when `ready` hasn't resolved after N s on a page that expects a worker. |
| O14 | `src/lib/offline/report.ts:7-8`; `reporter.ts:44` | missing-context | low | No browser engine, controlled/uncontrolled flag or build (#189), and one report per step per wake-up, so one noisy device can't be told from many. | A closed `engine` bucket (`chromium \| webkit \| gecko`) in the report schema. |

### 5.3 First-run setup (onboarding, gear, site picking)

P2 (class 22/23 on the onboarding RPC and gear creates) and P3 (`42501`) are the critical and high items of this flow; they are listed once, in 5.1.

| # | Location | Category | Severity | What happens in production | Fix direction |
| --- | --- | --- | --- | --- | --- |
| S1 | `src/lib/location/geocode.ts:93-105`; `LocationPicker.tsx:211`; `reporter.ts:35-47` | missing-context | medium | Every geocoder failure (network, the 3 s timeout, 429 or 5xx, non-JSON, schema mismatch) is rethrown as `new Error(GEOCODING_FAILED)`, so the report is always `island.geocode {name: "Error"}`, deduped once per page. An outage, a rate limit and an API change look identical. Users see "search failed"; the manual coordinate fields still work. | Throw closed-name errors (`GeocodeHttp`, `GeocodeTimeout`, `GeocodeSchema`, `GeocodeNetwork`), no cause, no URL. |
| S2 | `src/components/location/map-panel.tsx:135-137` | coverage-gap | medium | Leaflet's `tileerror` only sets `tilesFailed` (UI "map tiles failed"). An image load error never reaches the global handler. If OpenStreetMap throttles or blocks the tile server, "Pick from map" is dead for everyone and there's no line. | A closed `island.map-tiles` step, reported once per map. |
| S3 | `src/lib/onboarding/store.ts:51-55`; `src/lib/gear/store.ts:131-132`; `fault.ts:176-189` | identity-lost | medium | A tz-lookup throw becomes a `WriteFault` of `{kind: "server"}` with no code or name, so the line `save.onboarding failed {}` is identical to a Supabase network drop. | A closed code `tz` (added to `isLoggableCode`'s set), or a shaped `name` on `WriteFault`. |
| S4 | `OnboardingWizard.tsx:207-222`; `LocationPicker.tsx:136`; `map-panel.tsx:57`; `gear/catalogue/load.ts:12-26` | missing-context | medium | Telescope catalogue, eyepiece catalogue, the `map-panel` chunk and Leaflet CSS all report `island.import`, and the two catalogue failures dedupe into one (same step, `TypeError`). The likely cause, a stale chunk 404 after a deploy, can't be tied to a chunk or a release (#189). | `island.import-catalogue` and `island.import-map` steps. |
| S5 | `LocationPicker.tsx:177`; `locate.ts:42` | swallowed | low | Only `PERMISSION_DENIED` is justified as the user's choice. `POSITION_UNAVAILABLE`, the 15 s timeout and a missing API aren't counted, so a site-wide "Use my location" failure (e.g. a Permissions-Policy change) is invisible. | `island.geolocate` for non-denied failures. |
| S6 | `map-panel.tsx:166-171`; `browser.ts:57-59,90` | coverage-gap | low | Map-build failures go to `reportError`, which relies on the global handler's `/_astro/` filename filter. The filename `reportError` produces wasn't verified per browser; if it is empty, the report is dropped. | Call `report("island.uncaught", error)` directly. |
| S7 | `src/pages/api/onboarding.ts:44-50`; `onboarding/store.ts:78-80` | missing-context | low | `alreadyOnboarded` redirects as success with no line (by design). The match needs the exact `P0001` message `already_onboarded`; a reworded function falls through to a generic server failure. | Pin the message with a DB test. |

### 5.4 Observing log and progress

P3 (`42501` on the verdict record, the log saves and the log reads) and P7 (inconsistent read levels, observed) belong here too; they are listed once, in 5.1.

| # | Location | Category | Severity | What happens in production | Fix direction |
| --- | --- | --- | --- | --- | --- |
| L1 | `fault.ts:166` (`noRowsFault`); `observations/store.ts:168,235,247`; `sky-checks/store.ts:123,143`; `log/[id].astro:55-57`; `progress.astro:55-59`; `celebrate.ts:125-135` | coverage-gap | high | An RLS or role regression that hides rows isn't an error at all. Edits and deletes hit zero rows (a bare `{step}` warn), `/log/[id]` is a 404 with no line, and the seen read returns `[]`, so the progress page shows "nothing seen yet" and `/log` an empty log, as for a new user. Nothing separates it from a stale id. | An invariant in `reachedBySave`: an empty `after` read right after a successful counting write is impossible, so `logFailure("milestones.read-create")` with a closed name. Plus the burst escalation from P3 for `no-rows`. |
| L2 | `src/lib/observations/celebrate.ts:84-90,108-116,128-135` | swallowed | medium | A failed milestone read or record never fails the save, which is right, and it logs. But the consequence isn't traced. When `before` fails and the milestone is stored, the celebration is dropped silently. A badge lost on a later delete or re-rate shows only as a failed record. | One notice for the consequence (`milestones.not-celebrated`). |
| L3 | `src/lib/sky-checks/store.ts:72`; `observations/store.ts:78-84`; `log/sky.astro:102` | coverage-gap | medium | `record_sky_verdict` returns nothing when it skips (a foreign site), so a skip leaves no row and no line. `/log/sky` shows "no checks yet" and the user is never asked. | Return a skipped flag from the RPC and log a notice. |
| L4 | `src/lib/observations/store.ts:277-286` (`listSeenEntries`) | swallowed | low | Paging stops on an empty page even when fewer rows than the exact total have arrived (a smaller `max_rows`, a concurrent delete). Seen counts and badges come out low with no line. | A notice when the read ends below the counted total. |
| L5 | `src/pages/log/sky.astro:43-52` | missing-context | low | The list and the tally RPC share one `Promise.all` and one step: a failed tally takes the page down under the same `read.sky-checks` line as a failed list. | A step of its own for the tally. |

## 6. Recommended fix order

Every fix keeps the privacy invariant from the 2026-10-15 report. A line holds a fixed prefix, a step from the closed set, a shaped name, a code that passes `isLoggableCode`, a numeric status and, where added, a closed word (`op`, `origin`, a reason). Never a message, stack, URL, id, coordinate or email. Each fix starts with a failing test; the probe harness gives the runtime before/after for 1 and 2.

1. **Stream boundary (P1, P8; RC1).**
   - One wrapper in `src/middleware.ts` around the HTML body stream logs `request.stream` on a reader error.
   - A catch around `next()` logs `request.uncaught` and rethrows.
   - Rerun the probe suite: P10a, P10c, P10a-island and P10c-island must turn from "missed" to a `sidereus: request.stream failed` line.
   - This removes the widest blindness (every component on every page) for the smallest change.
   - Needs D1.
2. **Call-site-aware fault kind (P2, P3, P7; RC2).**
   - An `origin` argument on `withFault`/`faultFrom`/`logReadFailure` (`server-built` vs `user-id`), defaulting to `server-built`, so a missed call site errs towards an Issue.
   - Rerun P6a/P6b/P6d: `23502` and `42501` on a create or read must become `failed` lines with `errors.serverFault`.
   - Then move `progress.astro` and the milestone reads onto the classifier.
3. **Burst escalation for "expected" outcomes (P3, P4, L1).**
   - A per-isolate counter in `log-failure.ts`: when one step sees N notices (refused, session, no-rows, invalid-JWT) within 60 s, it writes one `logFailure("<step>")` line with `name: "Burst"`.
   - Add the invalid-signature notice in `sessionUser`.
   - Needs D2.
4. **Service worker: observe the no-ops and the purge (O1, O2, O5, O6, O8, O10, O12).**
   - Closed skip reasons at the "should have stored" returns.
   - A guarded purge on the auth route, with one purge helper (O9).
   - A redundant-state observer on the page.
   - Reporting in the fallback catches.
5. **Classify network faults at the `fetch` call, and make delivery honest (O3, O4, O7, O11, P9).**
   - Wrap only `fetch` in the routine filter.
   - Release the dedupe key on 429/5xx; a throttled server notice when the limiter refuses.
   - Worker global handlers.
   - The production hydration codes.
   - Needs D3.
6. **Put the discriminator back (P5, P6/#233, P10, P11, S1, S3, S4).**
   - An `InvariantError` with closed codes.
   - #233's status threading.
   - Closed `op` words.
   - Split forecast, import and geocode names.
7. **Small, local (S2, S5, S6, S7, L2-L5, O13, O14, P12-P14).** Batch them into one hygiene change.

**Owner decisions this plan needs:**

- **D1.** Keep streaming and add the middleware stream wrapper (recommended: keeps first-byte time and fixes every page at once), or turn streaming off so Astro's 500 path logs and the user gets a 500 instead of a blank 200?
- **D2.** May an "expected" condition (refused, stale session, zero rows, invalid JWT) escalate to one error-level line when it bursts? This raises a few Issues during real mass events. The alternative is that a grant or key regression stays warn-only.
- **D3.** Does #232 (client reports warn-only, weekly review) still hold once O3/O4 are fixed? The offline flow has no server-side trace, so its client reports are the only signal for a feature used precisely when the network is gone.

## 7. Changes since last audit

The 2026-10-15 areas (Tonight + forecast, save routes, sign-in, finder + plan edits) were not re-audited as areas. The statuses below come from the plumbing auditor's check of RC1-RC6, from where this run's flows run through the same code, and from hand spot-checks. "Not re-checked" means no evidence was gathered.

| Previous id | Status | Evidence |
| --- | --- | --- |
| RC1 privacy by silence | fixed | one shaped helper (`log-failure.ts`), about 35 `logFailure` sites, the guard |
| RC2 data layer drops diagnosis | still open, in part | `faultFrom` keeps `code`; transport status not threaded (P6, #233); `WriteFault` has no name (S3) |
| RC3 failure becomes 200/302 | changed | still 200/302 by design, but a server fault now has a line and `errors.serverFault`; refused, session and no-rows are warn-only (P3) |
| RC4 `{error}` unread | fixed | `session-user.ts:75-85` reads `error`; `signout.ts` reads it |
| RC5 work outside reporting | changed | `waitUntil`, service worker and islands now report; new in this run: stream errors in child components (P1, observed) |
| RC6 no vocabulary or context | still open, in part | closed steps and one prefix; no route, release or environment (#189), coarse steps (P10) |
| F3 `getClaims` error unread | fixed | `session-user.ts:75-85`; new gap: invalid-JWT silence (P4) |
| F4 save: same 302 for user and server faults | still open, in part | fixed for server faults (`saveFailureKey`, `errors.serverFault`); still open for class 22/23 on server-built writes (P2, observed) and `42501` (P3, observed) |
| F7 sky-check record dropped under `waitUntil` | fixed | `sky-checks/record.ts:44-58` logs both branches with the response status; `42501` there is warn-only (P3) |
| F8 PostgREST codes dropped | fixed | `StoreFault` cause, `faultFrom` keeps `code`; status gap is #233 / P6 |
| F9 zero rows = not found | still open, in part | a `no-rows` notice exists; bare `{step}`, and `/log/[id]` 404 has no line (L1) |
| F13 server-island 500 ignored, skeleton stays | changed | runtime: an island's own frontmatter throw is 500 + logged; a descendant throw is a **200, 0 B, no line** (P1). Client fallback still #190 |
| F14 sign-in/up non-credential faults silent | fixed (seen in passing) | auth routes use `logAuthFailure` |
| F15 no 404/500 pages, no route on Astro line | still open | #190; Astro line unstructured (P8) |
| F16 page read catches silent | fixed | `/log`, `/log/new`, `/log/[id]`, `/log/sky`, gear pages use `logReadFailure`; `progress.astro` inconsistent (P7) |
| F17 empty catches in store create/update | fixed, with a gap | `withFault` returned and logged by the route; tz-lookup line has no name or code (S3) |
| F18 milestone line thin, success hides failure | still open, in part | route-worded steps with code; consequence not traced (L2) |
| F22 `hasAnyGear` ignored | fixed | `onboarding/store.ts:90-96` throws with a cause; `onboarding.astro:25` logs `read.onboarding` |
| F23 sign-out result discarded | fixed (seen in passing) | `signout.ts` reads `{ error }` |
| F24 missing Supabase config silent | fixed | `config.supabase` once per isolate (`supabase.ts:34-37`) |
| F25 service worker swallows 17 catches | still open, in part | most are now `reportAnd`; 6 allowlisted remain (O5, O2); the main failures are now non-catch `return`s (O1, O8, O10) |
| F26 no client global handlers | still open, in part | page handlers in `Layout.astro`; none in the worker (O7); inlined scripts not covered (#230) |
| F27 no release identity | still open | #189 |
| F31 `alreadyOnboarded`, signup without session | still open, by design | `api/onboarding.ts:47-50` (S7) |
| F32 22P02 noise | fixed | id paths map 22P02 to not-found silently; the over-broad flip side is P2 |
| F33 geocode failures client-only | still open, in part | reported as `island.geocode`, but always `Error` (S1) |
| F1, F2, F5, F6, F10-F12, F19-F21, F28-F30 | not re-checked | outside this run's flows; the plumbing sweep found every `from(`/`rpc(` call it inspected reads `error` |

## 8. Method and limits

- **Agents.**
  - Four read-only subagents (Sonnet), one each for: the offline night plan, first-run setup, observing log + progress, and the cross-cutting plumbing. All got the same capture model, the known open issues (#189, #190, #191, #230, #232, #233) and the previous report.
  - They reported 15, 12, 14 and 12 findings (plus 10 plumbing answers), merged here into 40. The 42501 rule was reported by three auditors and is one finding (P3).
  - The runtime probe was started as a worktree subagent, then, at the owner's request, moved to a separate Claude agent in a herdr pane on the same worktree.
- **Spot-checked by hand:**
  - (a) `classifyFault`, `withFault` and `saveFailureKey` (`fault.ts:124-189`, `save-failure.ts`): class 22/23 gives no line.
  - (b) `logReadFailure` and `recordSkyVerdict` send `42501` to warn; `progress.astro:41-49` uses `logFailure`.
  - (c) `sw.ts:410-434`, `484-492`: bare returns. `sw.ts:760-763`: unguarded `purge()`. `reporter.ts:30-48`: key spent before `send`, response ignored.
  - (d) Astro's `renderStreamToStream` (`render.js:37-75`): the catch only calls `controller.error`, and streaming is the default (`page.js:41-56`, `base.js:73`).
  - (e) React's production `formatProdErrorMessage` (`react-dom-client.production.js:18-32`).
  - (f) `session-user.ts:11-63`: the routine lists.
  - Two auditor severities were lowered: offline O1 (critical to high: it degrades only the offline copy) and log L1 (critical to high, merged).
- **Runtime proof (partial).**
  - Isolated worktree `.claude/worktrees/agent-a95868590404aece4` (branch `worktree-agent-a95868590404aece4`, uncommitted).
  - Production build, `npm run preview` (workerd) against the local Supabase stack, `FORECAST_BASE_URL` pointed at a dead port (so each island run also prints an unrelated `forecast.fetch failed` line).
  - Probes behind an `x-probe` header or `?probe=`. Files: `src/lib/probe.ts`, `src/components/ProbeChild.astro`, `src/pages/api/probe.ts`, and injections in `src/middleware.ts`, `src/pages/index.astro`, `TonightContent.astro`, `api/gear/telescopes/index.ts`, `log/index.astro`, `log/progress.astro`.
  - Suite: `probe/suite.mjs`, `probe/run.sh`, outputs in `probe/`.
  - **Rerun:** `cd .claude/worktrees/agent-a95868590404aece4 && bash probe/run.sh` (needs `npx supabase start`).
  - The suite signs up throwaway users on the **local** stack only. Service-worker and browser shapes (O*, S*, P9) were not run; they need a headless browser and stay static-only.
- **Not verifiable locally:** how Workers Issues group `sidereus:` lines versus Astro's `[ERROR]` lines; whether production records an error outcome or trace status for an errored body stream (local workerd printed nothing and the client saw a clean empty 200); whether the production runtime ends that stream differently.
- **Repo sweep (plumbing auditor):**
  - `ALLOWED_SILENT_CATCHES`: 27 files, 43 sites. Reasons: 10 cannot report themselves, 7 parse invalid input, about 8 return the fault to a logging caller, 6 are the service worker's fallbacks, 5 are user choices (geolocation, install prompt), 4 are memo resets, 3 other.
  - About 35 `logFailure` sites; 7 direct `logNotice` sites, plus 11 `logReadFailure` pages and the `saveFailureKey` routes.
  - 52 `throw new Error(` in runtime code, nearly all fixed-text invariants without a cause.
- **Privacy of this report:** no coordinates, emails, keys, user ids or form values. Code is cited by path and line only.
