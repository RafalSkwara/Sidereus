# Sky-check record failure keeps its cause Implementation Plan

## Overview

Production logged `sidereus: tonight.sky-check-record failed` with no code, status or name. This plan closes the observability gap (question 1 of the change): a failed record keeps a leak-free, closed-vocabulary cause on its line, in three cases: the request never completed (a timeout or a dropped connection), a gateway answered with a non-2xx status and no PostgREST code (a 502 with an HTML body), and a class 22/23 database code. It does **not** change why the write took about 6 s (question 2): that cause is unproven, so the change collects evidence instead of guessing (see "What We're NOT Doing" and the Open Risks in the brief).

## Current State Analysis

Settled by `frame.md` (confidence HIGH for the gap, MEDIUM for the 6 s) and `research.md`; not re-investigated here.

- `recordSkyVerdict` (`src/lib/sky-checks/record.ts:39-52`) logs `logFailure(step, fault, { status: fault?.status })` for a not-ok result and `logFailure(step, error)` for a rejection.
- `skyCheckStore.record` (`src/lib/sky-checks/store.ts:55-66`) reads only `{ error }` from the RPC and returns `{ ok: false, message, ...withFault(error) }`.
- A transport failure (the 5 s `AbortSignal.timeout` guard, `src/lib/supabase.ts:19,42`, or a dropped connection) comes back from supabase-js 2.116.0 as `error.code = ""` with `status: 0` on the response, not on the error (`postgrest-js/dist/index.cjs:418-460`; Node run in the research). `faultFrom` drops the empty code (`src/lib/observability/fault.ts:75-77,90-97`), `classifyFault` makes it `server` (`:122-124`), and the `WriteFault` that is left is a plain object with nothing loggable, so the line is `{ step }`. Reproduced for a timeout and a network failure.
- A fourth source of the same empty line (plan review F1, probe on the real client): when a gateway or Supabase answers a non-2xx status with a body that is not JSON (a 502 with an HTML body), postgrest-js returns `error = { message }` with no `code`, and the response `status` is that HTTP status (`postgrest-js/dist/index.cjs:515-526`). `faultFrom` finds neither code nor status, so the line is `{ step }`, identical to production. The 6.3 s fits the 5 s guard better, but a gateway that answers 5xx after a few seconds is not excluded: only the Supabase API Gateway log settles which source production hit.
- A class 22/23 code makes `withFault` return `{}` (`fault.ts:150-155`: "the entity's own message key says it"), so `recordSkyVerdict` logs with `fault === undefined` and the code is lost. Reproduced for `23514`. Every argument of `record_sky_verdict` is built by the server (headline id from the engine, night, the user's own site id), so such a result is our bug, not user input.
- The line's field set is closed and pinned (`src/lib/observability/log-failure.test.ts:46-65`); `code` is accepted only as a SQLSTATE, a `PGRST` code, one of the four forecast steps (`request`, `http`, `parse`, `schema`) or an auth-js code (`isLoggableCode`, `log-failure.ts`). The runbook already defines `request` as "network or timeout" (`context/deployment/error-visibility.md` §1).

## Desired End State

- A record whose request never completed logs `["sidereus: tonight.sky-check-record failed", { step, code: "request" }]`; the runbook says what that means and how to tell the 5 s guard from a drop (elapsed time).
- A record answered with a non-2xx status and no PostgREST code (a gateway 502 with an HTML body) logs `{ step, code: "http", status: 502 }`.
- A record the database rejects with a class 22/23 code logs an error-level line with that code.
- No message, details, hint, stack, URL or value reaches the line or the carrier (the existing leak assertions keep passing, and the new tests add the same assertion).
- Any later occurrence of the production line is self-describing; the 6 s question stays open until the owner's evidence (Supabase API logs, frequency) answers it.

### Key Discoveries:

- `"request"` is already a loggable `code` (`FORECAST_STEPS`, `log-failure.ts`) and already means "network or timeout" in the runbook, so no new field, no change to `LogFields` and no change to the pinned field set is needed.
- The transport marker is on the response (`status: 0`), which the store currently drops (`store.ts:59`); `fault.ts:14-19` records that stores do not thread status through. The fix threads it for the one store whose evidence we have, through an optional argument, so no other caller changes.
- `fakeClient` (`src/lib/test-support/supabase-fake.ts`) cannot carry a response `status`, so a transport result is not representable in today's tests. Its default must stay "no status": a default of 400 for an error would make every existing test carry a status the new rule reads (plan review F1).
- `request` and `http` are today members of the forecast vocabulary (`FORECAST_STEPS`, `log-failure.ts`); the store codes get named constants so a rename of the forecast steps cannot silently turn the transport codes off (plan review F4).
- `AbortSignal.timeout` aborts with `TimeoutError` in Node and in workerd (checked locally with `wrangler dev`), which postgrest-js does not treat as `AbortError`; either way the result has `code ""` and `status 0`, so the rule must key on `status === 0`, not on an error name.

## What We're NOT Doing

- No change to the 5 s guard, no retry, no `waitUntil` change, no timing or latency fix: the cause of the 6 s is not verified (frame, MEDIUM). A change here would be a guess.
- No timeout-versus-drop code. Telling them apart would need the fetch error's name, which supabase-js keeps only inside `error.message`; reading it would break the "never reads message" rule of `log-failure.ts` and `fault.ts`, and a new line from `withTimeout` would add a step for every Supabase call. Elapsed time (about 5 s from the request's start is the guard; a drop is milliseconds) is the documented discriminator.
- No change to the other call sites of `faultFrom`/`withFault` (36 in 9 files, one of them `record`: `gear`, `observations`, `onboarding`, `session-plans`, `milestone-store`, `read-failure.ts` and the two plan routes). They share the gap, but only this step has an occurrence to fix; plan review (F3) kept the scope and asked for a tracked follow-up: GitHub issue #233, on the roadmap board.
- No new log field, no `FAILURE_STEPS` entry, no new step, no change to `logFailure`/`logNotice`.
- No change to the migration, the RPC or the database.
- No request to production, no deploy, no `wrangler` against the live Worker.

## Implementation Approach

Test first, in three phases: (1) failing regression tests that pin the production line and the latent twin, and the library contract they rest on; (2) the smallest production change that turns them green, in `fault.ts`, `store.ts` and `record.ts`; (3) the runbook and the tripwire text, and the full gates. The rule sits in the shared fault module so a later store follows it without a new design: with no usable code, response status 0 means `request`, and any other non-2xx status means `http` with that status. Only `record` passes the response now (the rest is issue #233).

## Phase 1: Failing regression tests

### Overview

Pin, before any production change, the exact lines production and the latent branch produce, so each test fails for the reason the evidence names. Nothing in `src/` outside tests changes except the test fake.

### Changes Required:

#### 1. The test fake carries a response status

**File**: `src/lib/test-support/supabase-fake.ts`

**Intent**: let a test describe a transport failure the way supabase-js returns it, not just a database error.

**Contract**: `FakeResult` gains an optional `status`; every answer resolves `{ data, error, count, status }` where `status` is **only** what the test gave and is absent otherwise (no default for an error: a default of 400 would hand every existing test a status the new rule reads, plan review F1). Add two helpers, both with a message that carries the sentinel text the leak assertions search for (`LEAK`): `transportError()`, the supabase-js shape for a fetch failure (`{ message: "TimeoutError: …", details: "", hint: "", code: "" }`, used with `status: 0`), and `gatewayError()`, the shape for a non-JSON error body (`{ message: "<html>… 502 Bad Gateway …</html>" }`, no `code`, used with `status: 502`).

#### 2. The production line, pinned at the trace

**File**: `src/lib/sky-checks/record.test.ts`

**Intent**: add the two failing lines to the existing "error-visibility" `describe` using the same `errors`/`warnings` spies and the `LEAK` check.

**Contract**: (a) a result `{ error: transportError(), status: 0 }` logs exactly one error line `"sidereus: tonight.sky-check-record failed"` with `{ step, code: "request" }` and no warn, and nothing of `LEAK` in the console calls (fails today: line is `{ step }`); (b) a result with `leakyPostgrestError("23514")` and `leakyPostgrestError("22P02")` logs one **error** line with that code each, no warn (fails today: bare line); (c) a result `{ error: gatewayError(), status: 502 }` logs one error line `{ step, code: "http", status: 502 }`, nothing of `LEAK` (fails today: bare line); (d) the existing server, refusal and stale-session cases stay as they are.

#### 3. The store's result

**File**: `src/lib/sky-checks/store.test.ts`

**Intent**: pin what `record` returns, because the trace only reads that result.

**Contract**: `record` on a transport result returns `{ ok: false, message, fault: { kind: "server", code: "request" } }`; on a gateway 502 it returns `fault: { kind: "server", code: "http", status: 502 }`; on `23514` and `22P02` it returns `fault: { kind: "server", code }`; on a refusal `42501` it still returns `kind: "refused"` (unchanged); on success `{ ok: true }`. **One existing assertion is narrowed, deliberately, and only here:** the loop at `store.test.ts:47-52` says "no fault for user input" for `22P02` and `23514` in all three writes (`record`, `answer`, `skip`), and the test's title (`:27`) says "in every write". That rule is right for `answer` and `skip` (an id a user posts) and wrong for `record`, whose arguments the server builds, so the requirement itself differs for `record` (frame, Q1.2). The loop keeps its assertion for `answer` and `skip` untouched and `record` leaves it for its own case above; no assertion is loosened or removed for any other write. Plan review F2 accepted it as a change of requirement, not of outcome, with three conditions: the title becomes "…in answer and skip" (it would lie otherwise), the narrowing and the new opposite assertion for `record` land in the same commit (so `record` is never without an assertion for 22/23), and the red run shows the new `record` assertion red.

#### 4. The carrier's rule

**File**: `src/lib/observability/fault.test.ts`

**Intent**: pin the optional response argument next to the existing `classifyFault` and `withFault` tables.

**Contract**: with no usable code on the error or its cause, `faultFrom(error, { status: 0 })` and `withFault(error, { status: 0 })` give code `request` and kind `server`; `{ status }` of any other non-2xx value in 100-599 (502, 503, 404, 429) gives code `http` carrying that status (`classifyFault`: server for 500 or more and, as today for an unknown code, server for the rest); the same error without the second argument is unchanged (no code, no status); an error with a real code keeps its code and gets **no** status, whatever the response status (the error-visibility F6 decision stays); a 2xx, `undefined` and a non-integer status never produce `request` or `http`; `TRANSPORT_CODE` and `HTTP_CODE` are loggable (`isLoggableCode(TRANSPORT_CODE)` and `isLoggableCode(HTTP_CODE)`) and equal `"request"` and `"http"`, the words the runbook defines (plan review F4), so a change to the forecast steps turns this test red; nothing of the error's message, details or hint appears anywhere a carrier shows (reuse `everythingShown` and `LEAK`).

#### 5. The library contract the rule rests on

**File**: `src/lib/sky-checks/record-transport.test.ts` (new)

**Intent**: guard the one assumption the fix depends on, that a real supabase-js client turns a fetch that never answers into `status 0` and `code ""`, so a library upgrade that changes it fails here and not in production.

**Contract**: build a real client with `createClient` from `@supabase/supabase-js`, `auth: { persistSession: false, autoRefreshToken: false }` (so no GoTrue state starts) and `global: { fetch: withTimeout(hangingFetch, 50) }`, where `hangingFetch` never resolves and rejects with the signal's reason on abort (no network). **No fake timers in this file**: the `AbortSignal.timeout` timer is real and unref'd, and a faked clock would hang the test to Vitest's timeout. `await client.rpc("record_sky_verdict", …)` gives `status 0` and `error.code === ""`; passing that client to `skyCheckStore.record` gives `fault.code === "request"`; and `recordSkyVerdict` with it logs the `{ step, code: "request" }` line. A second case uses a fetch that rejects at once with a `TypeError("fetch failed")` and expects the same. A third case uses a fetch that returns `new Response("<html>… LEAK text …</html>", { status: 502 })` and expects the real client to give `status 502` and no `error.code`, `record` to give `fault: { kind: "server", code: "http", status: 502 }`, and the line `{ step, code: "http", status: 502 }` without any `LEAK` text.

### Success Criteria:

#### Automated Verification:

- The new tests fail, and each for its stated reason (a bare `{ step }` line, a missing `fault`, a missing `code`), with the other tests of the same files passing: `npm run test:reference -- src/lib/sky-checks src/lib/observability/fault.test.ts` (the red output is kept in `implementation-notes.md`)
- Lint passes on the changed test files: `npx eslint --max-warnings 0 --no-warn-ignored src/lib/sky-checks src/lib/test-support src/lib/observability/fault.test.ts`

#### Manual Verification:

- The reviewer reads the red output and agrees that cases (a) and (b) of `record.test.ts` are the production line and the latent twin from `research.md`, and that no assertion was written to fit a planned implementation

**Implementation Note**: After the red run is recorded and these checks pass, pause for the human before Phase 2.

---

## Phase 2: Keep the cause on the line

### Overview

The smallest production change that makes Phase 1 green, with no assertion edited.

### Changes Required:

#### 1. The carrier recognises "the request never completed"

**File**: `src/lib/observability/fault.ts`

**Intent**: when the error carries no usable code, take the response's status as the cause instead of nothing: no HTTP answer at all (`request`), or an answer that is not a success (`http`, with that status).

**Contract**: `faultFrom(error, response?: { status?: number })` and `withFault(error, response?)`: if the error's own and its cause's `code` are not loggable, then `response?.status === 0` gives `code: TRANSPORT_CODE` (`"request"`), and any other integer status in 100-599 that is not 2xx gives `code: HTTP_CODE` (`"http"`) and that `status` (the existing 100-599 check in `StoreFault`); an error with a usable code is unchanged and never gains a status. `TRANSPORT_CODE` and `HTTP_CODE` are exported from `log-failure.ts` next to `FORECAST_STEPS` and used by it, so the forecast vocabulary and the store codes cannot drift apart unseen. `classifyFault` is unchanged (`request` and `http` without a 5xx status fall to the server default; 5xx is server by status). The doc comment of `fault.ts` changes where it says a store fault never carries more than a code from a PostgREST error: when there is no code, the response's status says it (`request`, `http`), never any text. Every caller that passes no second argument behaves as today.

#### 2. `record` threads the response and keeps an input-class code

**File**: `src/lib/sky-checks/store.ts`

**Intent**: read the RPC's response `status`, and return a fault for every failed record, because here a class 22/23 result is the server's bug, not a user's input.

**Contract**: `record` destructures `{ error, status }` and returns `{ ok: false, message: SAVE_FAILED, fault }` with `fault` from `withFault(error, { status })`; when `withFault` gives none (input class), `fault` is `{ kind: "server", code }` with the checked code from `faultFrom(error)`. A one-line comment says why (the RPC's arguments are all built by the server). The refusal and stale-session kinds (`42501`, `PGRST301-303`) are unchanged. `WriteResult` is unchanged (`fault?` stays optional for the other stores).

#### 3. The trace's comment tells the truth

**File**: `src/lib/sky-checks/record.ts`

**Intent**: make the doc comment and the `fault === undefined` branch say what is now true.

**Contract**: the doc comment lists the cases that reach each level (a server fault, a transport failure and an input-class code as errors; a refusal, a stale session and a zero-row outcome as notices). The `fault === undefined` path stays as a defensive default (unknown is not benign) and logs as before; it can no longer be reached from `record`. The rejection branch is unchanged. No behaviour change beyond what the store returns.

### Success Criteria:

#### Automated Verification:

- The Phase 1 tests pass with no assertion edited: `npm run test:reference -- src/lib/sky-checks src/lib/observability/fault.test.ts`
- The whole fast project passes: `npm run test:reference`
- The static guards pass (no-console, silent-catch, hooks proof): `npm run test:guards`
- Types pass: `npx astro check`
- Lint passes on the whole project (playwright-report and test-results moved aside first if present): `npm run lint`

#### Manual Verification:

- The reviewer confirms the diff of the three production files adds no read of `message`, `details`, `hint` or `stack`, and that `git diff` of the Phase 1 tests shows no assertion removed or loosened except the one narrowing of `store.test.ts:45-51` to `answer` and `skip` that Phase 1 §3 names

**Implementation Note**: After the automated checks pass, pause for the human before Phase 3.

---

## Phase 3: Runbook and tripwire

### Overview

Say, where the owner looks under stress, what the new line means and what evidence settles the 6 s question.

### Changes Required:

#### 1. The runbook row and the reading rule

**File**: `context/deployment/error-visibility.md`

**Intent**: update the `tonight.sky-check-record` row of §3 and add one reading rule to §1 or §2 for a `code: request` line on any step.

**Contract**: the `failed` cell of the `tonight.sky-check-record` row names four readings: `code: request` (the request never completed: the 5 s Supabase guard or a dropped connection; the guard is about 5 s after the Tonight request started, a drop is milliseconds; pair it with the Supabase API Gateway log for `POST /rest/v1/rpc/record_sky_verdict` at the same minute); `code: http` with a `status` (a gateway or Supabase answered with a status and no PostgREST error body, a 502 with an HTML body for instance: the provider, not our code); a class 22/23 code (our bug: the RPC rejected a value we built, check the headline vocabulary against the table's check constraint; the one benign case is `23503`, a site deleted between the function's `select` and its `insert`, a window of milliseconds, which is now also an error-level line and is accepted); and a server code (the existing reading). The note says that only this step threads the response today, that other stores' lines without a `code` can hide a transport or gateway failure, and points to issue #233. Frontmatter `status` and the "unverified" markers are untouched.

#### 2. The tripwire

**File**: `CLAUDE.md` (the Observability tripwire)

**Intent**: one sentence so the next agent threads the response instead of rediscovering the gap.

**Contract**: after "A store returns or throws a sanitized `StoreFault`", add that a store that has the response passes `{ status }` to `faultFrom` / `withFault` so a transport failure (`status` 0) keeps the code `request` and a non-2xx answer without a PostgREST code keeps `http` with its status; `skyCheckStore.record` does today, the other stores do not yet (issue #233).

### Success Criteria:

#### Automated Verification:

- Formatting passes on the changed Markdown: `npx prettier --check context/deployment/error-visibility.md CLAUDE.md context/changes/sky-check-record-cause`
- Lint and the fast project still pass: `npm run lint && npm run test:reference`

#### Manual Verification:

- The owner reads the new row of the runbook and can say, from a `code: request` line alone, what it does and does not prove
- The owner, independent of this change and before it deploys, reads Supabase Dashboard -> Logs -> API Gateway for `POST /rest/v1/rpc/record_sky_verdict` on 2026-10-20 between 08:45:01 and 08:45:07 UTC, and Postgres logs for that minute (Open Question 2 of `research.md`), and reports whether the request arrived and how long it took
- The owner counts the exact text `sidereus: tonight.sky-check-record failed` in Workers Logs over the retention window against the number of `/_server-islands/TonightContent` loads (Open Question 1 of `research.md`)
- After the change deploys by the usual merge to `main`, the owner confirms a later occurrence, if any, carries `code: request` or a database code (no production request is made by the agent)

**Implementation Note**: this phase's manual items are the owner's, not the agent's; the change is complete in code when the automated items pass.

---

## Testing Strategy

### Unit Tests:

- `record.test.ts`: transport failure -> `code: request` error line; gateway 502 without a code -> `code: http`, `status: 502`; `23514` and `22P02` -> error line with the code; refusal and stale session still warn; leak assertions on every new case.
- `store.test.ts`: `record`'s returned fault for transport, gateway 502, input-class, refusal and success; the narrowed loop (title "…in answer and skip") in the same commit as `record`'s own 22/23 case.
- `fault.test.ts`: the optional response argument (status 0 gives `request`; other non-2xx gives `http` with the status; a real code wins and gains no status; 2xx or no status gives nothing; the constants are loggable; no message text anywhere).
- `record-transport.test.ts`: the library contract with a real supabase-js client (auth off, no fake timers) over a hanging, a failing and a 502 fetch.

### Integration Tests:

- None added: no database behaviour changes, so `npm run test:db` is not part of this change. A real timeout against a stalled Supabase cannot be exercised in CI without a fault-injecting proxy, and the library-contract test covers the one assumption.

### Manual Testing Steps:

1. Phase 3's manual items (owner, with Supabase and Workers dashboards).
2. After deploy, watch for the next occurrence of the line; with `code: request` the elapsed time and the Supabase gateway log decide timeout versus drop versus slow database.

## Performance Considerations

None: one integer comparison in a failure path.

## Migration Notes

None. No schema, no data, no flag. Safe to deploy by the usual merge.

## References

- Frame: `context/changes/sky-check-record-cause/frame.md`
- Related research: `context/changes/sky-check-record-cause/research.md`
- `src/lib/sky-checks/record.ts:39-52`, `src/lib/sky-checks/store.ts:55-66`, `src/lib/observability/fault.ts:75-163`, `src/lib/observability/log-failure.ts` (`isLoggableCode`, `FORECAST_STEPS`), `src/lib/supabase.ts:19,42`, `src/lib/test-support/supabase-fake.ts`, `src/lib/observability/log-failure.test.ts:46-65`
- Plan review: `context/changes/sky-check-record-cause/reviews/plan-review.md` (decisions in the table below); follow-up issue #233 (`https://github.com/RafalSkwara/Sidereus/issues/233`)
- Audit F7: `context/audits/observability/2026-10-15_tonight-save-routes-auth-finder-plan.md`; prior contract `context/changes/error-visibility/plan.md:267,349`

## Plan Review Decisions

Review: `reviews/plan-review.md` (2026-10-20, at `bd4bade`): NEEDS ATTENTION, 0 critical, 1 warning, 4 observations. All five taken by the orchestrator's instruction; no re-plan.

| Finding                                                                                                    | Decision                                                                                                                                                                                                                                                            | Where it landed                                                                                                               |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| F1 (warning) a gateway 5xx with a non-JSON body gives the same bare line and the `status 0` rule misses it | Taken. No code and a non-2xx status gives `code: "http"` with that status; status 0 gives `request`. The fake has no default status. Frame and research no longer say the production line was certainly the transport case; the Supabase API Gateway log settles it | Overview, Current State, Desired End State, Phase 1 §1-§5, Phase 2 §1, Phase 3 §1; `frame.md`, `research.md`, `plan-brief.md` |
| F2 the narrowed `store.test.ts` loop                                                                       | Taken. Title becomes "…in answer and skip", lines are `:47-52`, the narrowing and `record`'s opposite assertion land in one commit, the red run shows it red; the `23503` race is named in the runbook                                                              | Phase 1 §3, Phase 3 §1                                                                                                        |
| F3 scope: 36 call sites in 9 files                                                                         | Option A: scope stays `record`; one follow-up issue opened now (#233, label `roadmap`, on board #1); runbook and tripwire point to it instead of "a one-line follow-up"                                                                                             | What We're NOT Doing, Phase 3 §1-§2                                                                                           |
| F4 `request` and `http` live in the forecast vocabulary                                                    | Taken. Named constants `TRANSPORT_CODE` and `HTTP_CODE` exported from `log-failure.ts`, used by `FORECAST_STEPS`, pinned by an `isLoggableCode` assertion in `fault.test.ts`                                                                                        | Key Discoveries, Phase 1 §4, Phase 2 §1                                                                                       |
| F5 the real-client test                                                                                    | Taken. No fake timers, `persistSession` and `autoRefreshToken` off, plus the 502 case                                                                                                                                                                               | Phase 1 §5                                                                                                                    |

Progress rows are unchanged on purpose (titles are immutable once reviewed); the added cases sit under the existing rows 1.1, 2.1 and 3.3.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Failing regression tests

#### Automated

- [x] 1.1 The new tests fail, and each for its stated reason (a bare `{ step }` line, a missing `fault`, a missing `code`), with the other tests of the same files passing: `npm run test:reference -- src/lib/sky-checks src/lib/observability/fault.test.ts` (the red output is kept in `implementation-notes.md`) — 5d4ac8c
- [x] 1.2 Lint passes on the changed test files: `npx eslint --max-warnings 0 --no-warn-ignored src/lib/sky-checks src/lib/test-support src/lib/observability/fault.test.ts` — 5d4ac8c

#### Manual

- [ ] 1.3 The reviewer reads the red output and agrees that cases (a) and (b) of `record.test.ts` are the production line and the latent twin from `research.md`, and that no assertion was written to fit a planned implementation

### Phase 2: Keep the cause on the line

#### Automated

- [x] 2.1 The Phase 1 tests pass with no assertion edited: `npm run test:reference -- src/lib/sky-checks src/lib/observability/fault.test.ts` — fa85ada
- [x] 2.2 The whole fast project passes: `npm run test:reference` — fa85ada
- [x] 2.3 The static guards pass (no-console, silent-catch, hooks proof): `npm run test:guards` — fa85ada
- [x] 2.4 Types pass: `npx astro check` — fa85ada
- [x] 2.5 Lint passes on the whole project (playwright-report and test-results moved aside first if present): `npm run lint` — fa85ada

#### Manual

- [ ] 2.6 The reviewer confirms the diff of the three production files adds no read of `message`, `details`, `hint` or `stack`, and that `git diff` of the Phase 1 tests shows no assertion removed or loosened except the one narrowing of `store.test.ts:45-51` to `answer` and `skip` that Phase 1 §3 names

### Phase 3: Runbook and tripwire

#### Automated

- [x] 3.1 Formatting passes on the changed Markdown: `npx prettier --check context/deployment/error-visibility.md CLAUDE.md context/changes/sky-check-record-cause`
- [x] 3.2 Lint and the fast project still pass: `npm run lint && npm run test:reference`

#### Manual

- [ ] 3.3 The owner reads the new row of the runbook and can say, from a `code: request` line alone, what it does and does not prove
- [ ] 3.4 The owner, independent of this change and before it deploys, reads Supabase Dashboard -> Logs -> API Gateway for `POST /rest/v1/rpc/record_sky_verdict` on 2026-10-20 between 08:45:01 and 08:45:07 UTC, and Postgres logs for that minute (Open Question 2 of `research.md`), and reports whether the request arrived and how long it took
- [ ] 3.5 The owner counts the exact text `sidereus: tonight.sky-check-record failed` in Workers Logs over the retention window against the number of `/_server-islands/TonightContent` loads (Open Question 1 of `research.md`)
- [ ] 3.6 After the change deploys by the usual merge to `main`, the owner confirms a later occurrence, if any, carries `code: request` or a database code (no production request is made by the agent)
