---
type: observability-audit
date: 2026-10-15 19:07
mode: audit
commit: 2c4b348
branch: feat/error-visibility
dirty_tree: true # only the untracked context/changes/error-visibility/ folder
areas: [tonight-islands-forecast, save-routes, sign-in-auth-session, finder-chart-plan-edits]
area_source: foundation # roadmap S-07 names the flows
runtime_proof: not-run # static only; see section 8
error_tracker: none in code (owner rule 2026-10-15, first-party only). Workers Logs + traces (wrangler.jsonc:15-22); Cloudflare alerts outside the repo
previous_report: null
findings: { critical: 4, high: 11, medium: 13, low: 5 }
---

# Observability audit: Tonight, save routes, sign-in, finder and plan edits (2026-10-15)

## 1. TL;DR

- **The privacy rule was applied by deleting the diagnosis.** Every store, the forecast client and most pages replace an error with a fixed key or a bare `catch {}`. Only 7 `console.error` lines exist in the whole app, and they cover roughly 3 of about 25 places that swallow a failure. (RC1, RC2)
- **A failure is a 200 or a 302, never a signal.** Supabase, Open-Meteo, KV, the engine build and every save fault end as a 200 page with a notice, a stale-forecast fallback, or a 302 `?error=<key>`. `redact_query_string: true` also strips that key from the logs, so the redirect carries no signal. (RC3)
- **An auth outage looks like a mass sign-out.** `sessionUser` reads only `data` from `getClaims()`; auth-js returns auth failures as `{ data: null, error }`, so the `catch` is nearly dead code and the `error` is dropped. Every user is "signed out", gated routes redirect, islands answer an empty 200. Nothing is logged. (RC4)
- **The worst single blind spot: Open-Meteo.** An outage, a 429 or a schema change makes every verdict "marginal" or a stale fallback on a 200. `forecast/service.ts` says "nothing here logs". Every user on every site is degraded and nobody can tell. (F1)
- **Work outside any reporting path:** the `waitUntil` sky-check record, KV reads and writes, the service worker (17 swallowed catches, no channel to the server), React islands (no global handler) and a server-island 500 that leaves the skeleton on screen for ever. (RC5)
- No shared log vocabulary exists: seven lines, six different prefixes, `error.name` only, no route, step, status or release. An alert filter cannot match them. (RC6)

## 2. Capture model

**Runtime.** Cloudflare Workers with static assets (`wrangler.jsonc`), Astro 7.3.2 SSR with `@astrojs/cloudflare` 14.3.1, React islands, Astro server islands (`server:defer`, served from `/_server-islands/*`, outside `PROTECTED_ROUTES`, so they guard themselves), a browser service worker (`src/sw.ts`), Supabase (PostgREST, Auth, RPC), a Workers KV forecast cache, and Open-Meteo over `fetch`. Background work exists only as `locals.cfContext.waitUntil` (`src/lib/tonight/island.ts:34-38`).

**Error tracker.** None in code, and none may be added (owner, 2026-10-15). In repo: `wrangler.jsonc:15-22` sets `observability.enabled`, `redact_query_string: true` and `traces.enabled`. Cloudflare Workers Logs is the only sink the code can reach.

**Capture boundaries.** Astro itself is the boundary. A throw in a page or endpoint is logged with the stack through `console.error` and returned as a real 500 (`astro/dist/core/pages/handler.js:73-80`, `core/routing/handler.js:100-123`, read by the plumbing auditor). There is no `src/pages/404` or `500`, so those responses have an empty body. `src/middleware.ts` has no try/catch around `next()`, which is acceptable because Astro already wraps it. A server island that throws returns a 500 with the stack logged, but the client replacer returns early on any non-200 (`runtime/server/render/server-islands.js:188`, verified by hand), so the skeleton stays on screen with no message.

**Outside any boundary:** the service worker; React islands and their dynamic imports (no `window.onerror`, no `unhandledrejection`, no error boundary; the only `reportError` is `map-panel.tsx:167`, and it goes to the browser console); `waitUntil` tasks, whose handlers are `() => undefined` (`TonightContent.astro:109-114`) or an internal silent `catch` (`forecast/service.ts:161-172`).

**Logging.** Raw `console.error` through hand-allowlisted `eslint-disable-next-line no-console` lines (`src/lib/no-console-guard.test.ts` `ALLOWED_DISABLES`, exact counts). The seven runtime lines are `build.ts:1415`, `build.ts:1439`, `finder/load.ts:171`, `finder/load.ts:194`, `tonight/load.ts:53`, `account-plan/index.ts:45` and `observations/celebrate.ts:45`. Each is a fixed string plus `error.name` (two add a code or a cause name). No line carries a route, a step tag, an HTTP status, a request id, a night or a release. The prefixes differ (`buildTonight:`, `loadFinderFor:`, `tonight:`, `getAccountPlan:`, `milestones:`, `progress:`).

**Error responses.** By project convention save routes never return JSON errors; they redirect with `?error=<fixed key>`. Stores read `error.code`, pick a key and drop the code (`gear/store.ts:65-73`).

**Scrubbing and sampling.** No scrubbing hook exists, since no tracker exists. The effective scrub is the convention "never log a message" plus `redact_query_string`. Sampling is not set in the repo.

**Deploy identity.** None in code: no `version_metadata` binding, no release or environment field in any log line.

**Assumptions (outside the repo, not findings), all unconfirmed with the owner:**

- Workers Logs collection is live in production and an uncaught exception shows in the invocation log with its stack.
- Cloudflare Notifications and Workers Logs queries can be configured by the operator in the dashboard.
- Workers Logs metadata (script version, hostname) tells preview from production.

## 3. What reaches the tracker (static view, labelled as such)

Read from code, not observed. "Logs" is Workers Logs. No tracker exists.

| Failure shape | Response | Logs | Alertable today | Verdict |
| --- | --- | --- | --- | --- |
| Throw in a page or endpoint | 500, empty body | Astro stack line | by status | visible, no route tag |
| Throw in a server island | 500; skeleton stays on screen | Astro stack line | by status | visible server side, silent for the user |
| Open-Meteo / KV / schema failure | 200, fallback or "none" | nothing | no | **invisible** |
| Supabase list read fails in `load()` | 200 with notice | nothing | no | **invisible** |
| Whole `getForecast`+`buildTonight` fails | 200 with notice | nothing | no | **invisible** |
| Planet, Moon or sky-view build fails | 200, section missing | nothing | no | **invisible** |
| Session plan or sky events build fails | 200, section missing | fixed line + error name | by text | visible, thin |
| Save route, DB or RLS fault | 302 `?error=` | nothing | no | **invisible** |
| Save route, validation error | 302 `?error=` | nothing | no | expected |
| Auth outage (`getClaims` error) | 302 to sign-in / empty island 200 | nothing | no | **invisible** |
| Sign-in or sign-up non-credential fault | 302 generic key | nothing | no | **invisible** |
| Plan read fails | locked 200 | `getAccountPlan: the plan read failed <code>` | by text | visible, no route |
| Finder `failed` via star load or chart | 200 `failed` | fixed line + error name | by text | visible, thin |
| Finder `failed` via tonight load | 200 `failed` | nothing | no | **invisible** |
| Sky-check record fails (`waitUntil`) | none | nothing | no | **invisible** |
| Milestone read or record fails | success redirect | fixed line, names | by text | visible, thin |
| Service worker store failure | stale offline copy | nothing, no channel | no | **invisible** |
| React island render or import failure | broken widget | browser console only | no | **invisible** |

## 4. Systemic root causes

**RC1. Privacy is enforced by silence.** The coordinate-privacy NFR and `no-console` (an error everywhere under `src`, with an allowlist of exact counts) were met by logging nothing. Module headers state it: `forecast/service.ts:23` ("nothing here logs"), `api/tonight/plan.ts:20` and `reset.ts:16` ("nothing is logged"), `TonightContent.astro:105-106` ("never logged"). The rule is right; the remedy went too far. A closed vocabulary (step word, `error.name`, a shape-checked PostgREST or Postgres code, an HTTP status, a route template) cannot carry a coordinate. Explains F1, F2, F4-F7, F10, F11, F14, F16, F17, F20-F24.

**RC2. The data layer drops the diagnosis at the source.** Stores throw `new Error(KEY)` with no `cause` (`gear/store.ts:148,159,217,228,278,289`, `observations/store.ts:151,163`, `sky-checks/store.ts:85,149,161`, `onboarding/store.ts:89`). Writes read `error.code` to pick a key and discard it (`gear/store.ts:65-73`, `observations/store.ts:229-239`, `sky-checks/store.ts:67,104,124`, `onboarding/store.ts:70-79`, `session-plans/store.ts:55,61`). `forecast/open-meteo.ts:92-105` collapses every cause into two fixed messages and the HTTP status never leaves it. `tonight/load.ts:41-54` (`CODE_SHAPE`, `logPlanEditsFailure`) and `session-plans/store.ts:36` show the safe pattern; it is used in two places. Even a future log line would have nothing to say. Explains F1, F2, F8, F9, F17, F18.

**RC3. Failure degrades to a 200 or a 302, so no status signal exists.** The project default is "keep the user working": `load()` (`tonight/load.ts:127-136`), the `tonightError` catch (`:223-225`), five `build.ts` catches, the forecast fallback, page-level `catch {}` blocks, and the `?error=<key>` redirect for every save outcome. Status-based alerts see 200 and 302. `redact_query_string: true` (`wrangler.jsonc:19`, a correct choice for the forecast URL) additionally hides the `?error=` key of the follow-up GET. Explains F1-F6, F10, F11, F16, F13.

**RC4. Result errors from Supabase are not read.** Supabase calls return `{ error }` instead of throwing, and several call sites never look: `middleware.ts:15` (`getClaims`), `signout.ts:6-9` (`signOut`), `sky-checks/store.ts:67` (the `{ ok: false }` of `record` is dropped by `() => undefined`). The defensive `catch` blocks protect almost nothing. Verified by hand: `GoTrueClient.ts:6715,6791-6794` returns `{ data: null, error }` for auth errors and rethrows only non-auth ones. Explains F3, F7, F14, F23.

**RC5. Work runs where no reporting path exists.** `waitUntil` tasks are caught and silent (`service.ts:161,169`, `TonightContent.astro:109-114`); the service worker has 17 `.catch(() => undefined)`, 1 `.catch(() => null)` and 2 bare `catch {}` with no way to talk to the server (`src/sw.ts:79,85,254,340,402,507,585,685-798`); client islands have no global handler; a server-island 500 never reaches the user (`server-islands.js:188`). Explains F7, F13, F25, F26.

**RC6. No shared log vocabulary or context.** Seven lines, six prefixes, `error.name` only, no route, step, status, night or release. Each new trace costs a new allowlist entry and a new test count. An alert filter or a Workers Logs query cannot match them with one token. Explains F18, F19, F27.

## 5. Findings by area

Severity is judged with the pipeline assumed on. "Prod" is what a responder gets. IDs are merged across the five auditors; one mechanism is one finding with all its locations.

### 5.1 Tonight islands and forecast

| # | Location | Category | Severity | What happens in production | Fix direction |
| --- | --- | --- | --- | --- | --- |
| F1 | `src/lib/forecast/service.ts:161,169,216`, `:200-207`; `forecast/open-meteo.ts:92-105` | swallowed, identity-lost | **critical** | Open-Meteo outage, 429, 5xx, timeout, schema drift or a bad `FORECAST_BASE_URL` all end in `catch (_error)`. With a stored copy the user sees a 200 with the "fallback, N h old" line for up to the cache TTL; without one the verdict is marginal and the forecast reads "none". An incomplete 200 is swapped silently. KV read or write failures behave as a miss and every request refetches. Responder: nothing. Every user is degraded and nobody can tell. | Log one fixed line per failure step (`request`, `http`, `json`, `schema`, `incomplete`, `kv.read`, `kv.write`) with the upstream HTTP status or `error.name`. Make `open-meteo.ts` throw a safe-field error (step, status) instead of two bare messages. No URL, no coordinates. |
| F2 | `src/lib/tonight/load.ts:127-136` (`load()`); callers `:152-158` | swallowed, identity-lost | **critical** | Sites, telescopes, eyepieces, log and open sky-check reads share one bare `catch {}`. A Supabase outage or RLS regression becomes per-list notices or `needsSetup` on a 200 island, 4-5 failed reads per page view, with no log. The stores drop the code (RC2), so even a log here has nothing to say. The sky-check read is dropped "on purpose" (`:156`). | Log a step word (`sites`, `telescopes`, `eyepieces`, `log`, `skyChecks`) with `error.name` and the cause's code (`CODE_SHAPE`). Stores pass `{ cause }` (F8). |
| F5 | `src/lib/tonight/load.ts:223-225` | swallowed | high | `catch { tonightError = TONIGHT_FAILED }` wraps `getForecast` + `buildTonight`: the verdict, ranking and strip. Any engine bug or bad zone becomes a 200 "Tonight failed" notice with no log. It is the least traced catch of the whole page. | Log `tonight: build failed` with `error.name` and a step word. Never the message or stack (the engine can quote coordinates). |
| F6 | `src/lib/tonight/build.ts:914,964,1015,1062,1172` | swallowed | high | Planet gate, planet ranking, Moon target, Moon card and interactive sky each have a bare `catch {}` returning null or `[]` ("nothing is logged"). The user sees a 200 with a missing section. On the finder, a planet engine fault becomes `not-ranked` ("not on tonight's list"), a normal outcome (`finder/load.ts:84-87,156-159`). | Same fixed-line pattern as `build.ts:1415` with a section word. Let a null `solarSystem` for a planet key reach `failed`, not `not-ranked`. |
| F7 | `src/components/tonight/TonightContent.astro:109-114`; `sky-checks/store.ts:61-67` | swallowed (`waitUntil`) | high | `record_sky_verdict` runs under `waitUntil` with `() => undefined` on both branches; `record` returns `{ ok: false }` rather than rejecting, so that is dropped too. A missing RPC after a migration, a permission change or an outage silently stops the verdict-check feature from collecting data. | Log from the `{ ok: false }` result and from the rejection (`skyCheck.record`, code). |
| F13 | `astro/dist/runtime/server/render/server-islands.js:188`; `src/lib/tonight/island.ts:46-49`; `TonightContent.astro:134`; `src/sw.ts` ~428 | coverage-gap, flattened-response | high | A server island that throws returns a 500, which the client replacer ignores: the skeleton stays on screen, no message, no client report. A signed-out or auth-failed request gets an empty 200 body, indistinguishable from an anonymous replay. `loadTonight` also runs `tonightDateForSite`/`chooseOwned` outside every try (`load.ts:180`). | Give the island a fallback state that says "could not load, reload"; answer a distinct status for the signed-out case; move the unguarded calls into the try with a logged step. |

### 5.2 Save routes

| # | Location | Category | Severity | What happens in production | Fix direction |
| --- | --- | --- | --- | --- | --- |
| F4 | Routes: `api/log/index.ts:52-54`, `[id].ts:44-46`, `[id]/delete.ts:32-34`, `sky/[id].ts:33-35`; `api/gear/{sites,telescopes,eyepieces}/{index,[id],[id]/delete}.ts`; `api/onboarding.ts:33-35`; `api/tonight/plan.ts`, `plan/reset.ts`. Stores: `gear/store.ts:65-91`, `observations/store.ts:131,230,239`, `sky-checks/store.ts:67,104,124`, `onboarding/store.ts:70-79` | flattened-response | **critical** | A Supabase outage, an RLS denial (42501), an RPC fault or a network error becomes the same 302 `?error=errors.save.*` as a validation failure. The user sees "could not save" and retries. The responder sees a 302 and no log line; success and failure of a save look alike on the POST, and `redact_query_string` removes the key from the follow-up GET. A complete save outage is invisible. No route logs anything on a server fault (every header says "Nothing is logged"). | At each store failure that did not come from `issueKey`, log `save failed` with a step word, the shape-checked code and status. Give server faults a distinct key (e.g. `errors.save.server`) so a user mistake and a server fault differ in the redirect too. |
| F8 | `gear/store.ts:65-73`, `observations/store.ts:229-239`, `sky-checks/store.ts:103-105,123-125`, `onboarding/store.ts:70-79`, `session-plans/store.ts:55,61` | identity-lost | high | The PostgREST `error.code` and status pick a key and are dropped. 22P02 means "not found", 23514 "out of range"; 42501, 08xxx, 57014, 5xx and a fetch failure all collapse to `saveFailed`. Only `listSeenEntries` (`observations/store.ts:270`) and the milestone store keep the DB error as `cause`. | Carry `{ code, status }` (matching `CODE_SHAPE`) in the store result and in thrown errors as `cause`; log only on the non-user-error branches. |
| F9 | `gear/store.ts:75-87` (`affected()`), `observations/store.ts:232,242`, `sky-checks/store.ts:106,126` | missing-context | high | `data.length === 0` after update or delete returns `notFound`. That is also the RLS-denied case, the stale-id case and the "dark window not started" case. A policy regression that hides every row shows users "not found" everywhere with no trace. | Log a fixed `notFound step=<word>` line on these branches. Do not log the 22P02 branch (malformed id is noise, F32). |
| F10 | `api/tonight/plan.ts:43,59-62,66` and `plan/reset.ts:46-48`; `session-plans/store.ts:55,61` | swallowed, flattened-response | high | The catch around `siteStore.get`, `tonightDateForSite`, `sessionPlanStore.get` and `keysWithoutWindow` logs nothing and `thrownKey` keeps only a key. A TypeError in `findDeepSky` or a date bug becomes `errors.save.sessionPlan`. Validation, unknown target, failed read and failed write share one key. | Log the step, `error.name` and `cause.code`; give the server faults their own key. |
| F16 | `pages/log/index.astro:36-40`, `log/new.astro:52-57`, `log/[id].astro:34-45`, `log/sky.astro:39-50`, `gear/index.astro:55-65`, `gear/{sites,telescopes,eyepieces}/[id].astro:23-27` | swallowed | high | Read-side `catch {}` sets `loadError` and shows "could not load" on a 200. A DB outage on the log, gear or sky-check page is a 200 with a banner. The store throws without `cause`, so the key shown also hides the reason. | Log `error.name` and the thrown key in each catch; pass `cause` from the stores. |
| F17 | `observations/store.ts:112,189,208`; `gear/store.ts:125` (`toSiteColumns`); `onboarding/store.ts:48-50` | swallowed | high | Empty `catch {}` blocks in `create()`/`update()` turn a failed `siteStore.get`, `telescopeStore.get`, `siteStore.list` or a `tz-lookup` throw into `SAVE_FAILED`. A DB error, a tz-lookup bug and bad coordinates all read the same. | Log `error.name` and the cause code before returning the key. No coordinates in the line. |
| F18 | `observations/celebrate.ts:39-46`; `api/log/index.ts:55-65`, `[id].ts:47` | identity-lost, flattened-response | medium | `milestones: <step> failed <ErrName> <CauseName>`: the cause is a PostgrestError, so only a generic name survives; no code, no create/edit/delete word. The save still redirects as success without the `milestone` param, so a persistent failure is invisible; `progress.astro` falls back to the derived state. | Add the cause's code and a route word to the line. Keep the redirect. |
| F20 | `await request.formData()` in `api/log/index.ts:24`, `[id].ts:29`, `sky/[id].ts:14`, `onboarding.ts:25`, all gear routes, `tonight/plan.ts:23`, `plan/reset.ts:19`; `auth/signin.ts:8`, `signup.ts:7` | coverage-gap, noise | medium | A non-form body throws; Astro returns a 500 and logs a stack. A client or proxy mistake is reported as a server exception, with no route tag beside Astro's stack. | Wrap the parse and redirect with `CHECK_FIELDS`; keep the throw for real faults. |
| F22 | `pages/onboarding.astro:14-25` | swallowed | medium | `hasAnyGear` failure is ignored by design (comment) and the setup wizard renders as if nothing were wrong; the outage shows only on submit. | One fixed line in the catch; behaviour unchanged. |

### 5.3 Sign-in, auth and session

| # | Location | Category | Severity | What happens in production | Fix direction |
| --- | --- | --- | --- | --- | --- |
| F3 | `src/middleware.ts:13-21,35,37-43` | swallowed, flattened-response | **critical** | `const { data } = await supabase.auth.getClaims()` never reads `error`. Verified: auth-js returns `{ data: null, error }` for expired-token refresh failures, the 5 s timeout, network and 5xx (`GoTrueClient.ts:6715,6791-6794`). So `sessionUser` is null with no log; the `catch` sees only non-auth throws. In an Auth or signing-key outage every user with an expired token is silently signed out, gated pages redirect to sign-in, and a gated POST (`/api/*`) discards the submitted form. Islands answer an empty 200. Outage and real sign-out look identical. | Read `error`; log a fixed line (step word, `error.name`, code, status) only when it is not a plain "no session"; log the `catch` separately. Carry a fixed `session expired` key on the redirect when the cause was an auth error. |
| F14 | `api/auth/signin.ts:24-28`, `signup.ts:15-19`, `lib/api-errors.ts:34-36`; `lib/supabase.ts:19-21` | swallowed | high | `authErrorKey` maps six codes; network and timeout (no `error.code`), 5xx, `unexpected_failure` (including a confirmation-email failure on signup) and rate limits all become the generic key with no log. The user-side separation from "wrong password" is right. Responder: an Auth outage, an SMTP failure and credential stuffing are invisible. | `console.error` a fixed line (`auth.signin` / `auth.signup`, code or name, status) for every code except `invalid_credentials` and `user_already_exists`; include rate-limit codes. No email. |
| F23 | `api/auth/signout.ts:6-9` | swallowed | medium | The `signOut()` result is discarded; it always redirects home. If Auth is unreachable the user believes they are signed out while revocation never happened. | Read `{ error }`, log code and status, redirect with a fixed note on failure. |
| F24 | `src/lib/supabase.ts:21`, `middleware.ts:31,35`, `signin.ts:21-23`, `config-status.ts:13-21`, `pages/tonight/plan.astro:44-55`, `finder.astro:56-66` | config | medium | If `SUPABASE_URL` or `SUPABASE_KEY` is unset in a deploy, `createClient` returns null and the whole app degrades to signed-out. Only a banner for visitors says so; the Worker logs nothing. A bad deploy would hit every user. | One fixed line when `createClient` returns null in a non-dev build (once per isolate is enough). |
| F12 | `account-plan/index.ts:36-46,67-69,89-96`; `finder.astro:38-41`; `api/tonight/plan.ts:32-35`, `plan/reset.ts:27-30`; `finder/load.ts:127`; `session-plans/read.ts:15` | flattened-response | medium | `getAccountPlan` fails closed: `unknown` acts as `free`. A paying user sees the locked explainer or "needs the full plan" on a 200 because of an outage. The one trace logs once per request with the code and no route. A transient null user (F3) reaches islands the same way with no query and no log. | Add a route word to the plan-read line; branch on `unknown` in the finder and plan routes and show a neutral "could not check your plan" state; log when an island renders with a null user. |
| F15 | `src/middleware.ts:52`; no `src/pages/404` or `500` | coverage-gap | medium | An uncaught exception is logged with its stack by Astro and returned as an empty-body 500; the log has no route template or method. Unknown routes return an empty response. (The sign-in auditor rated this high; the plumbing auditor showed Astro already logs the stack, so it is medium.) | Optionally wrap `next()` with one fixed line (`context.routePattern`, `error.name`, rethrow). Add a minimal token-styled 500 and 404 page with no error text. |

### 5.4 Finder chart and Session-plan edits

| # | Location | Category | Severity | What happens in production | Fix direction |
| --- | --- | --- | --- | --- | --- |
| F11 | `src/lib/finder/load.ts:142-145,151-154`; `FinderContent.astro:123-127` | coverage-gap, flattened-response | high | Of four ways to reach `failed`, only the star load (`:171`) and the chart (`:194`) are logged. The null load and the "no site/telescope/view" branch return `failed` with no line, and that branch is where an outage lands (it comes from the swallowed F2 and F5). The page is an inline alert on a 200. | Log `loadFinderFor: tonight load failed` with a fixed reason word before returning. |
| F21 | `src/lib/finder/load.ts:156-164,198-205` | coverage-gap | medium | `resolveTarget`, `toEngineSite`, `findingEyepiece`, `formatDesignation` and `stars[index]` run outside any try. A throw there fails the island request (F13) instead of reaching `failed`. | Move them into a try with the same fixed line so every path ends in `failed`. |
| F28 | `src/lib/finder/load.ts:164` | swallowed | medium | The finder never reads `load.eyepiecesError`; a failed eyepieces read draws the chart without the eyepiece circle, no notice, no log. | Show the existing `tonight.eyepiecesFailed` notice; log via F2. |
| F19 | `build.ts:1415,1439`; `finder/load.ts:171,194`; `finder-stars.ts:53-54,197-203` | identity-lost, missing-context | medium | The existing traces log `error.name` only ("TypeError", "Error"), which cannot say which step, night (the tonight and the offline `next` builds share one string) or kind (planet or deep-sky) failed. A malformed star file and a missing lazy chunk look the same. | Add a fixed step word, `night`, target kind; throw a small error class with a fixed `code` for the star file. |
| F25 | `src/sw.ts:79,85,254,340,402,507,585,685-798`; `lib/offline/register.ts:8` | swallowed | medium | After a save the page posts `store-page`; every failure (timeout, non-200 shell or island, `cache.put` quota, scope mismatch) is swallowed. The stored copy silently keeps the OLD plan for up to 36 h. The worker has no channel to Workers Logs. | Reply to the page and show a quiet notice; or post a fixed-shape beacon (step word, error name) to a first-party route that logs it. |

### 5.5 Platform and plumbing

| # | Location | Category | Severity | What happens in production | Fix direction |
| --- | --- | --- | --- | --- | --- |
| F26 | `src/**` (no error boundary, no global handler); `map-panel.tsx:52,167`, `LocationPicker.tsx:64,74,146,208`, `gear/catalogue/load.ts:15,23`, `finder-stars.ts:198`, `geocode.ts:98` | coverage-gap | medium | React render and hydration errors and dynamic-import failures reach only the browser console. Several retry silently and never report the first failure. | A small `error` / `unhandledrejection` reporter posting a fixed-shape beacon to the same first-party route as F25 (owner decision, section 6). |
| F27 | `wrangler.jsonc`; all log lines | config | medium | No release or environment field in code: one `wrangler.jsonc` environment, no `version_metadata` binding. Preview and production events cannot be told apart by anything the code emits. | Add a `version_metadata` binding and include the id in the shared helper's line. |
| F29 | `src/lib/forecast/kv-cache.ts:13` | config | low | A missing `FORECAST_CACHE` binding gives a silent no-op cache: 100% Open-Meteo traffic and no fallback during an outage, with no signal. | One fixed line when the binding is undefined in a non-dev build. |
| F30 | `src/lib/supabase.ts:34-38` | swallowed | low | `setAll` writes cookies unchecked; an oversized or rejected cookie fails invisibly. | Note only. |
| F31 | `api/onboarding.ts:33-36`; `auth/confirm-email.astro:8-14`, `signup.ts:22` | coverage-gap | low | `alreadyOnboarded` redirects to `/tonight` as if the save worked (documented); signup with no session always shows "check your email". Neither has a success line. | Optional fixed counters (`onboarding already`, `signup ok session=0|1`, no email). |
| F32 | `observations/store.ts:156-166,239`; the `INVALID_TEXT` branches in gear and sky-check stores | noise | low | A malformed uuid (crawler on `/log/<junk>`) reads as "not found". Once F9 logs exist, this becomes the main noise. | Do not log the 22P02 branch. |
| F33 | `lib/location/geocode.ts:95-100`, `LocationPicker.tsx:208` | swallowed | low | Geocode failures show a UI state only. Client side, no server trace exists. | Optional, via the F26 reporter. |

Counts: critical 4 (F1-F4), high 11 (F5-F11, F13, F14, F16, F17), medium 13 (F12, F15, F18-F28), low 5 (F29-F33). Total 33.

## 6. Recommended fix order

Each step must keep the privacy invariant: a line may hold a fixed prefix, a step word from a closed set, `error.name`, a code that matches `CODE_SHAPE` (`/^[0-9A-Za-z_]{1,12}$/`, `tonight/load.ts:41`), a numeric HTTP status, and a route template. Never a message, a stack, a URL, a coordinate, an email, a key or a form value. Every new line needs its `ALLOWED_DISABLES` entry in `no-console-guard.test.ts`, or better, goes through the one helper in step 1 so there is a single entry.

1. **One logging helper (closes RC6; the base for everything else; F18, F19, F27 and the shape of every fix below).** `logFailure(step, error, extra?)` under `src/lib/observability/`, the only `console.error` site (one allowlisted disable, replacing the seven). It emits one fixed shape, `sidereus: <step> failed <errorName> <code> <status>`, so one Workers Logs filter on `sidereus:` finds them all. It validates the code with `CODE_SHAPE`, and it takes the step from a closed typed set. The seven existing lines move onto it. The first failing test: the helper never prints a message, a stack, or a code that fails the shape check.
2. **Stores and `open-meteo.ts` keep the code (RC2; F8, F9, F17; prerequisite for F1, F2, F4).** Stores throw with a code-only `cause` and return `{ code, status }` in write failures. The first failing test per store: a failed read or write reaches the caller with its code and no message.
3. **Log where the failure is swallowed, widest first (RC1, RC3):** F1 (forecast), F2 and F5 (`tonight/load.ts`), F6 (`build.ts`), F3 (middleware), F4 and F10 (save routes), F16 (page catches), F7 (sky-check record), F11, F21 and F28 (finder), F14, F23 and F24 (auth). One failing test each that makes the failure happen and asserts the helper line.
4. **Make a server fault different from a user mistake (F4, F10, F13).** A distinct `errors.save.server`-style key, a fallback state for a failed island, and a distinct status for a signed-out island. Needs an owner decision on the convention (decision 1).
5. **Operator side, first-party (closes the "be alerted" half of the outcome).** A runbook in `context/deployment/` naming the Workers Logs filter (`sidereus:`), the queries for the four steps above, and the Cloudflare Notifications to create (Workers error rate and the log-based ones available on the plan). This part lives in the dashboard, so it is a checklist the owner confirms, not code. Wrangler cannot create it from the repo.
6. **Release identity (F27):** a `version_metadata` binding and the id in the helper's line. Small, after step 1.
7. **Client and service worker (F25, F26, F33):** the only step that adds an endpoint. Fixed-shape beacon, rate-limited, no user data. Held for an owner decision (decision 3).

Owner decisions this plan needs:

- **D1.** Keep "every save failure is a 302 `?error=<key>`" and add a distinct server-fault key, or also move to a real 5xx status for DB faults?
- **D2.** May a log line carry an opaque user or site UUID (not coordinates, not email), or stay fully anonymous? Without it a responder cannot tell one affected user from all. Default: stay anonymous.
- **D3.** Is a first-party beacon route for the service worker and islands acceptable, or do offline and client failures stay out of scope for this slice?

## 7. Changes since last audit

Not applicable: this is the first observability audit of the repo.

## 8. Method and limits

- **Agents:** five read-only subagents (Sonnet, medium effort), one per area (Tonight islands + forecast; save routes; sign-in/auth/session; finder chart + plan edits) and one for the cross-cutting plumbing. Each got the same capture model and the taxonomy. 15, 14, 12, 15 and 17 findings were reported; merged and deduplicated into 33 here.
- **Spot-checked by hand:** (a) the whole app has exactly seven `console.error` runtime sites, matching `ALLOWED_DISABLES`; (b) `forecast/service.ts:174-218` and its header ("nothing here logs"); (c) `tonight/load.ts:127-136` and `:215-225`, bare catches; (d) `middleware.ts` reads only `data`, and `GoTrueClient.ts:6715,6791-6794` returns auth errors instead of throwing; (e) `server-islands.js:188` ignores a non-200 island response; (f) no `src/pages/404` or `500`. One severity was changed after cross-checking (F15, high to medium). The `redact_query_string` claim comes from `wrangler.jsonc` and its comment; how Workers Logs renders redacted URLs was not observed.
- **Runtime proof:** not run. Static findings are labelled in section 3. The slice's plan should make each fix start with a failing test, which is the runtime proof that matters here; a local `wrangler dev`/`npm run preview` run with `FORECAST_BASE_URL` pointed at a dead port (CLAUDE.md names the technique) would show the F1 silence directly. The skill's fake-ingest harness does not apply because no tracker exists.
- **Not verifiable from the repo:** that Workers Logs is on in production, how its log view renders these lines, which Cloudflare notification types the owner's plan includes, and whether preview and production share one Worker.
- **Not audited in depth:** `src/pages/api/log/[id]/*` beyond the shared pattern, engine code (pure, no I/O), build scripts under `scripts/` (CLI, console use is fine), and `@supabase/ssr` internals (the cookie `setAll` finding F30 is from its call site only).
- **Privacy of this report:** it holds no coordinates, emails, keys or form values. Code is cited by path and line only.
