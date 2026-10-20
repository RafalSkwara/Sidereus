---
date: 2026-10-20T12:00:00+02:00
researcher: Claude (skycheck agent)
git_commit: 7e9d65b
branch: fix/sky-check-record-cause
repository: sidereus
topic: "Why does `tonight.sky-check-record failed` carry no cause, and why did the record take about 6 s"
tags: [research, observability, sky-checks, supabase, fault, log-failure]
status: partial
last_updated: 2026-10-20
last_updated_by: Claude (skycheck agent)
---

# Research: sky-check-record failure with no cause

**Date**: 2026-10-20 (local, +02:00)
**Git Commit**: 7e9d65b (main, merge of #231)
**Branch**: fix/sky-check-record-cause (worktree `.claude/worktrees/sky-check-record`)
**Repository**: sidereus

## Research Question

Production, version 6aa032a5, 2026-10-20 08:45:00 UTC: one signed-in `GET /_server-islands/TonightContent` ended after 6308 ms and logged `["sidereus: tonight.sky-check-record failed", {"step": "tonight.sky-check-record"}]` at +6301 ms. (1) Why does the line carry no cause, which branch yields no fields, and how can it keep code, status and name without leaking a message? (2) Why did the record write fail or take about 6 s? Kept apart; (2) is not to be guessed from the line.

## Summary

**(1) Answered, reproduced.** On the inspected path (`recordSkyVerdict`, `src/lib/sky-checks/record.ts:39-52`) these result shapes give a line of `{step}` only; verified by a scratch Vitest run that fed each through the real `skyCheckStore.record` and `recordSkyVerdict` with a fake client and was deleted afterwards:

- a transport failure (the request timed out or the connection dropped): supabase-js returns `error.code = ""` and, on the response (not the error), `status = 0` (Node run of real `@supabase/supabase-js` 2.116.0, scratchpad `exp/abort.mjs`); `faultFrom` drops the empty code (`fault.ts:75-77`, `isLoggableCode`), `classifyFault` makes it `server` (`fault.ts:122-124`), `withFault` returns `{ fault: { kind: "server" } }` (`fault.ts:150-163`); the line has nothing to show because the fault is a plain object, not an `Error` (`log-failure.ts` `nameOf` reads only an `Error`), and `store.record` never reads the response's `status` (`store.ts:59-66`). **This produces the production line**, as does the next case.
- a response with a non-2xx status and no PostgREST code (plan review F1, probe on the real client: a 502 with an HTML body gives `error = { message }` with no `code` and response `status 502`, `postgrest-js/dist/index.cjs:515-526`): `faultFrom` finds neither code nor status, so the line is the same bare `{step}`. Whether production hit this or the transport case is open; the 5 s timing favours the guard, only the Supabase API Gateway log settles it.
- a class 22 or 23 code (data exception, integrity violation): `withFault` returns `{}` (`fault.ts:152-155`), so `result.fault === undefined`, and `recordSkyVerdict` calls `logFailure(step, undefined, { status: undefined })` (`record.ts:43-46`). The code is known and is thrown away. Every argument of this RPC is server-derived, so such a result is our bug, not user input. Latent: not what production hit.
- a rejection with a non-`Error` value: no name either. A rejected `Error` does keep `name` (reproduced: `{step, name: "TypeError"}`), so the rejection branch (`record.ts:49-51`) is not the production line. postgrest-js does not reject without `throwOnError()` (`index.cjs:418` converts a fetch rejection to an `{error}` result).

**(2) Partial.** The timing is consistent with the 5 s Supabase fetch guard (`SUPABASE_TIMEOUT_MS = 5000`, `supabase.ts:19`, applied at `supabase.ts:42`; `AbortSignal.timeout` in `fetch-timeout.ts:6-9`) firing for the record's RPC about 1.3 s after the request began (6301 ms minus 5000 ms), which is inside the 0.7-1.8 s the same island takes to build the view in the 7 other captured loads. Nothing in the one occurrence proves it: a timeout, a dropped connection and a stalled database all give the same line. The `waitUntil` budget is not a candidate (the Worker event closed at +6308 ms). Evidence that would settle it is listed under Open Questions.

## Detailed Findings

### The production event (raw tail, 21 events, `skycheck-prod-tail.jsonl`)

- Event 14: `GET /_server-islands/TonightContent`, status 200, `wallTime` 6308, `cpuTime` 524, event timestamp 1792485900563 (2026-10-20T08:45:00.563Z), one log of level `error` at 1792485906864 (+6301 ms, 7 ms before the event ended).
- The other 7 TonightContent island events in the capture (events 3, 8, 10, 12, 16, 18, 20): `wallTime` 728-1811 ms, `cpuTime` 391-701 ms; the two events before and after are at 866456 and 938236 (about 34 s earlier, 38 s later), so no other Tonight load overlaps event 14.
- A Workers tail event's `wallTime` here ends when the deferred work ended: the record is the last thing the island does (`TonightContent.astro:112-114` hands it to `islandDefer`, `island.ts:34-38` puts it in `locals.cfContext.waitUntil`), and the log lands 7 ms before the event closes. This path suggests the user's response was sent about 1.3 s in, not at 6.3 s. Unverified: the response-start time is not in the tail.

### Why the line is empty (Question 1)

- `recordSkyVerdict` (`record.ts:39-52`): not-ok result -> `fault === undefined || fault.kind === "server" ? logFailure : logNotice`, called as `log(step, fault, { status: fault?.status })`. A rejection -> `logFailure(step, error)`.
- `logFailure` -> `fieldsOf` (`log-failure.ts`): `name` only when the value is an `Error` and the name matches `NAME_SHAPE` (`client/steps.ts:74`, `^[A-Za-z][A-Za-z0-9_]{0,31}$`); `code` only when `isLoggableCode` (a SQLSTATE, a `PGRST` code, a forecast step or an auth-js code); `status` only as an integer 100-599. A `WriteFault` has the right keys but is not an `Error`, so `name` is always absent on a write trace.
- `store.record` (`store.ts:55-66`) destructures only `{ error }` from the RPC and discards the response `status`. The fault carrier's own comment says a store fault carries a `code` only (`fault.ts:14-19`); that decision was taken on purpose in the error-visibility impl review (F6, `context/changes/error-visibility/plan.md:267`) because a PostgREST error has no status, and the same plan (`:267`) lists "no code at all (network or timeout)" as `server` and alertable, without saying what its line would show.
- supabase-js 2.116.0, fetch failure (`postgrest-js/dist/index.cjs:418-460`): a result `{ error: { message: "<Name>: <message>", details, hint, code }, status: 0 }`. For `AbortError`/`ABORT_ERR` the `hint` says "Request was aborted (timeout or manual cancellation)"; the `code` is `""` in every fetch-failure case. Observed under Node: stalled server + `AbortSignal.timeout(700)` -> `message "TimeoutError: The operation was aborted due to timeout"`, `code ""`, `status 0`; a refused connection -> `message "TypeError: fetch failed"`, `code ""`, `status 0`; a PostgREST 400 -> `status 400` with the database `code`. In workerd (wrangler dev, local, port 4335): a stalled fetch under `AbortSignal.timeout(500)` rejects with `name: "TimeoutError"`, numeric `code: 23`; a refused connection rejects with a plain `Error` named "Error", message "Network connection lost." (so the fetch error's name distinguishes a timeout from a network drop in workerd, but supabase-js keeps it only inside `error.message`).
- Constraint on any fix: `log-failure.ts`'s header and `fault.test.ts` (`everythingShown`) pin that no message, stack, URL or value reaches the carrier or the line; `log-failure.test.ts` pins the exact field set (`:46-65`, `Object.keys` equals `["step"]` for an empty fault). A new field needs a closed vocabulary and its own tests, like `AUTH_ERROR_CODES` (`log-failure.ts`, checked against the installed copy by a test).
- Precedent for keeping a transport signal: `auth.claims` already logs `name`, `code` and `status` for a timeout, an abort or `AuthRetryableFetchError` (`context/changes/error-visibility/plan.md:436`). `island.geocode` accepted that a timeout, a network failure and an HTTP error look alike (`plan.md:654`).
- The gap is wider than this step on this inspected evidence: every store that returns a `fault` or throws a `StoreFault` goes through the same `faultFrom`/`withFault` (`gear`, `observations`, `onboarding`, `session-plans`, `milestone-store`, `sky-checks` stores; `read-failure.ts`, `save-failure.ts`), so a transport failure in any of them leaves the same empty line (a read's line carries `name: "StoreFault"`, which says nothing about the cause). Not reproduced for each store; the shared source is `fault.ts:75-163`.

### Why the record took about 6 s (Question 2)

- A. Client guard: the only timeout in the Supabase client is the 5000 ms fetch guard (`supabase.ts:19,42`); it starts when the fetch is issued (`fetch-timeout.ts:6-9`), `rpc` is a POST so postgrest-js does not retry it (`index.cjs:211-220`). The timing fits: record issued at about +1.3 s, abort at +6.3 s.
- B. Database: `record_sky_verdict` is one `select` plus one `insert ... on conflict do update` (`supabase/migrations/20261003120000_sky_checks.sql:82-110`), `security invoker` with `search_path = ''`, no explicit lock, a `where` on the conflict update. A stall would need a lock holder on the same (user, site, night) row, a slow RLS check or a database-wide stall; nothing in the repo or the capture shows one (no concurrent Tonight request within about 34 s). Not excluded: the repo cannot see database logs.
- C. `waitUntil` budget: the Worker event ended at +6308 ms, so no platform limit was reached. This inspected event only.
- D. Before the fetch: the record is issued after `loadTonight` returns; supabase-js's token handling would add a second request with the same 5 s guard and a possible `auth.*` line; none appears in the capture's 21 events.
- A timeout, a dropped connection (`TypeError`/"Network connection lost") and a database stall that outlives 5 s all produce the same `{ code: "", status: 0 }` result, so even a perfect line built from the result alone separates "transport" from "database answered", not "timeout" from "drop". The fetch error's name is the only discriminator in workerd and it lives only in `error.message`.

## Code References

- `src/lib/sky-checks/record.ts:39-52` - `recordSkyVerdict`: the three branches.
- `src/lib/sky-checks/store.ts:55-66` - `record`: reads `{ error }` only; `withFault(error)`.
- `src/lib/observability/fault.ts:75-77,90-163` - `faultFrom`, `classifyFault` (no code -> server, `:122-124`), `withFault` (input class -> `{}`, `:152-155`).
- `src/lib/observability/log-failure.ts` - `fieldsOf`, `nameOf`, `isLoggableCode`, `FAILURE_STEPS` (includes `tonight.sky-check-record`).
- `src/lib/supabase.ts:19,42` / `src/lib/fetch-timeout.ts:5-10` - the 5 s guard, one call site of `withTimeout`.
- `src/components/tonight/TonightContent.astro:110-115`, `src/lib/tonight/island.ts:34-38` - the deferred record.
- `node_modules/@supabase/postgrest-js/dist/index.cjs:211-220,418-460` - no retry on POST; fetch failure becomes `{ error: { code: "" }, status: 0 }`.
- `supabase/migrations/20261003120000_sky_checks.sql:82-110` - the RPC.
- `src/lib/sky-checks/record.test.ts:28-58`, `src/lib/test-support/supabase-fake.ts` - existing tests: fakeClient answers `{ data, error, count }` only (no `status`), so a transport result is not representable yet.
- `context/deployment/error-visibility.md` §1, §3 (step row `tonight.sky-check-record`) - runbook to update with any new field.

## Architecture Insights

- Privacy design: the log helper keeps a closed field set `{ step, name?, code?, status? }`; every field is shape-checked, so adding one is a vocabulary decision, not a plumbing change.
- The carrier distinguishes "whose fault" (`kind`) but has no member for "the request did not complete"; it relies on "no code" as that signal and then loses it at the log.
- `classifyFault` and `withFault` treat class 22/23 as the user's input in a way that fits forms but not the sky-check RPC, whose inputs the server builds.
- Existing tests build results with `fakeClient`, which cannot carry a response `status`; a regression test for the transport case needs a fake that does, or a real supabase-js client over a fake `fetch` (a fetch that rejects or hangs under a short `withTimeout`).

## Historical Context (from prior changes)

- `context/audits/observability/2026-10-15_tonight-save-routes-auth-finder-plan.md` F7 (supported): `record_sky_verdict` ran silently under `waitUntil`; the fix asked to "log from the `{ ok: false }` result and from the rejection (`skyCheck.record`, code)". It was done (Phase 3 of `error-visibility`); this finding is the remaining hole in it.
- `context/changes/error-visibility/plan.md:267` (partial): "no code at all (network or timeout)" is classified `server`; its amendment of 2026-10-16 limits store faults to `code`. Both were deliberate, the empty line for a no-code failure was not discussed.
- `plan.md:349` (supported): the contract for this step is "the `.then` logs on `{ ok: false }` with the result's `fault`, the rejection handler logs the error".
- `error-visibility` is still `implementing` (`change.md`): this change is separate and does not edit it.

## Related Research

- `context/changes/sky-check-record-cause/frame.md` (the framing and hypothesis table).
- Not applicable otherwise: no other research artifact covers transport faults.

## Open Questions

1. **How often does the line occur?** Owner: Workers Logs, search the exact text `sidereus: tonight.sky-check-record failed` over the 7-day retention, compared with the number of `/_server-islands/TonightContent` loads (Question for owner).
2. **Did the RPC reach Supabase?** Supabase Dashboard -> Logs -> API Gateway, `POST /rest/v1/rpc/record_sky_verdict`, 2026-10-20 08:45:01-08:45:07 UTC: no entry = the request never arrived; an entry with a long duration or 499 = the database or edge was slow and the client gave up; a 2xx within milliseconds = the abort fired on a connection that had already answered (unlikely). Postgres logs and Reports -> Database for that minute (CPU, locks, connections).
3. **User wait.** The owner's DevTools network timing for `/_server-islands/TonightContent` on a slow load would confirm the response is not held by the deferred record (tail `wallTime` includes it).
4. **Scope of the fix (owner/plan-review decision).** Keep the transport signal only on the sky-check record, or in the shared `fault.ts` carrier for every store (about 6 stores and `read-failure.ts`); and whether a timeout-versus-drop distinction is worth reading the fetch error's name through the guard (`withTimeout`) rather than parsing `error.message`.
5. Workerd behaviour was checked with `wrangler dev` locally on a stalled and a refused fetch, not with production Supabase over TLS: the production error name for a Supabase edge reset is unverified.
