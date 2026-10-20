# Implementation notes: sky-check-record-cause

## Phase 1: red run (2026-10-20, before any production change)

`npm run test:reference -- src/lib/sky-checks src/lib/observability/fault.test.ts`: 33 tests, 10 red, 23 green (the 23 include every test that existed before). Each red test fails for its stated reason:

| Test                                                                      | Red because                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `record.test.ts` transport failure (`transportError()`, status 0)         | the line is `{ step }`, `code: "request"` missing                                                                                    |
| `record.test.ts` gateway 502 with an HTML body                            | the line is `{ step }`, `code: "http"` and `status: 502` missing                                                                     |
| `record.test.ts` class 22/23 (`23514`, `22P02`)                           | the line is `{ step }`, the code is missing                                                                                          |
| `store.test.ts` "keeps a fault for every failed record"                   | `record` returns no `fault` for `22P02` (the first case)                                                                             |
| `fault.test.ts` constants                                                 | `TRANSPORT_CODE` and `HTTP_CODE` do not exist yet                                                                                    |
| `fault.test.ts` status 0 and non-2xx                                      | `faultFrom` and `withFault` take no response argument yet                                                                            |
| `record-transport.test.ts` x3 (hanging fetch, dropped fetch, gateway 502) | the real-client contract assertions pass (status 0 / 502, no usable `code`); the `skyCheckStore.record` result then carries no fault |

The `fault.test.ts` cases for a call without a response argument, a real code that gains no status and a leak check on the unchanged paths are green today, on purpose: they pin what must not change.

The narrowing of `store.test.ts` (loop title "…in answer and skip", `record` skipped in the 22/23 loop) and `record`'s own opposite case are in the same commit, as plan review F2 asked.

Lint passes on the changed files; `astro check` is not a Phase 1 criterion (the new tests call a signature that does not exist yet).
