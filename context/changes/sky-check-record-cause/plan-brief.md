# Sky-check record failure keeps its cause — Plan Brief

> Full plan: `context/changes/sky-check-record-cause/plan.md`
> Frame brief: `context/changes/sky-check-record-cause/frame.md`
> Research: `context/changes/sky-check-record-cause/research.md`

## What & Why

The actual problem to plan around is: the fault carrier (`WriteFault`/`withFault`) cannot say "the request never completed" and discards a class 22/23 code, so a timed-out or dropped record, and a malformed one, both log an empty line; the 6 s itself is consistent with the 5 s Supabase fetch guard firing about 1.3 s into the request, but only one occurrence exists and nothing in it proves the cause.

This plan fixes the certain part (the empty line) and collects evidence for the uncertain part (the 6 s) instead of changing timing code on a guess.

## Starting Point

`recordSkyVerdict` logs through `logFailure` with the store's fault. A transport failure reaches the store as `error.code ""` plus response `status 0`; the store drops the status and `faultFrom` drops the empty code, so the line is `{ step }`. A class 22/23 code makes `withFault` return no fault at all. Both reproduced locally with the real log path; the production line is the transport case.

## Desired End State

A failed record's line says why in a closed vocabulary: `code: "request"` when the request never completed, the database code for a class 22/23 rejection. The runbook explains both and how to tell the 5 s guard (about 5 s) from a drop (milliseconds). The next occurrence of the production line explains itself; the 6 s question is answered by the owner's Supabase and Workers Logs evidence.

## Key Decisions Made

| Decision                                   | Choice                                                                                    | Why (1 sentence)                                                                                            | Source                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- |
| What the line says for a transport failure | `code: "request"` (already loggable; runbook already says "network or timeout")           | No new field, no change to the pinned line shape, no message read                                           | Plan                         |
| Where the signal comes from                | The response's `status === 0`, via an optional second argument to `faultFrom`/`withFault` | The marker is on the response, not the error; an error name differs (`TimeoutError` Node and workerd)       | Research                     |
| Scope                                      | Only `skyCheckStore.record` passes the response now; other stores stay as they are        | Only this step has an occurrence; the optional argument makes each other store a one-line follow-up         | Plan (plan review may widen) |
| Class 22/23 on `record`                    | Returned as a `server` fault with its code                                                | Every argument is built by the server, so such a result is our bug, not user input                          | Frame                        |
| Existing assertion `store.test.ts:45-51`   | Narrowed to `answer` and `skip`; `record` gets its own opposite case                      | The requirement differs for `record`; no other assertion changes                                            | Plan (flag for review)       |
| Timeout versus drop                        | Not distinguished in code; elapsed time is the documented discriminator                   | Telling them apart needs the error name, kept only inside `error.message`, which the helper must never read | Plan                         |
| The 6 s itself                             | No code change (no guard change, no retry)                                                | Cause unproven; MEDIUM confidence                                                                           | Frame                        |

## Scope

**In scope:** the response status threaded in `record`; `faultFrom`/`withFault` optional argument; `record`'s fault for an input-class code; tests including a real supabase-js client over a hanging fetch; the runbook row and one tripwire sentence.

**Out of scope:** the 5 s guard and any timing fix; other stores' traces; a timeout/drop distinction; new log fields or steps; the migration; production access.

## Architecture / Approach

Test first. Phase 1 adds failing tests that pin the production line (transport), its latent twin (`23514`) and the library contract (a real client turns a fetch that never answers into `status 0`, `code ""`). Phase 2 makes them green in `fault.ts`, `store.ts`, `record.ts`. Phase 3 documents it. Everything stays inside the existing closed field set and the "never read a message" rule.

## Phases at a Glance

| Phase                         | What it delivers                                                            | Key risk                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. Failing regression tests   | Red tests pin the production line, the latent twin and the library contract | `store.test.ts:45-51` must be narrowed for `record`; a reviewer may prefer another route |
| 2. Keep the cause on the line | Green with no assertion edited beyond that one                              | Other stores later inherit a rule only `record` uses today                               |
| 3. Runbook and tripwire       | The owner can read the new line; evidence checklist                         | Owner-side checks are not under the agent's control                                      |

**Prerequisites:** `npm ci` done in the worktree (it is); no database needed.
**Estimated effort:** about 1 session across 3 phases.

## Open Risks & Assumptions

- Cause of the 6 s unproven: a stalled database or a dropped connection give the same `code: request` line; Supabase API Gateway logs for 2026-10-20 08:45:01-08:45:07 UTC and the Workers Logs count settle it (owner).
- Status 0 as the transport marker is a supabase-js 2.116.0 behaviour; the library-contract test guards an upgrade. Workerd was checked locally, not against production Supabase over TLS.
- Plan review decisions: widen to every store; whether to log the guard's firing with a new step instead of the elapsed-time rule; the narrowed existing assertion.

## Success Criteria (Summary)

- Each new test is red for its stated reason, then green with the assertions unchanged apart from the one named.
- A transport failure and a class 22/23 result both leave a cause on the line, and no message text reaches it.
- The owner can read a `code: request` line and the runbook and know what to check next.
