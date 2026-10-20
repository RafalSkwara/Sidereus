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

## Phase 2: green run (2026-10-20)

`npm run test:reference -- src/lib/sky-checks src/lib/observability/fault.test.ts`: 33 of 33 green, no assertion edited beyond the narrowing named in Phase 1. Whole fast project 821 passed (1 skipped, as before), guards 60 passed, `astro check` 0 errors, `npm run lint` clean. No e2e or smoke run: the only visible effect is a log line, and no page, route or markup changed.

Deliberate-break checks (worktree-only edits on top of the staged files, each restored with `git checkout -- <file>`; the staged diff stayed intact):

| Break                                                                           | Result                                               |
| ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `faultFrom` ignores the response argument                                       | 8 tests red (record, store, fault, record-transport) |
| `skyCheckStore.record` drops the input-class fault                              | 2 tests red (store, record)                          |
| `TRANSPORT_CODE` renamed to `"req"` (forecast vocabulary drift, plan review F4) | 2 tests red in `fault.test.ts`                       |

No adaptation of the plan was needed. One reading of the plan that the implementer should know: the response argument is consulted only when the error has no usable code, and the status it contributes is the error's own, else the response's.

## Phase 3: runbook and tripwire (2026-10-20)

`context/deployment/error-visibility.md`: the `tonight.sky-check-record` row now reads `failed` by `code` (`request`, `http` with a status, a class 22/23 code with the benign `23503` race named, any other code) and §2 gets one paragraph on what `request` and `http` do and do not say, with the pointer to issue #233. Prettier re-aligned the whole step table (the row grew), so the diff of that file is wide but only that row and the new paragraph changed in content. `CLAUDE.md`: one sentence in the Observability tripwire. `npx prettier --check`, `npm run lint` and `npm run test:reference` (821 passed) are green.

Manual rows 1.3 and 2.6 (reviewer) and 3.3 to 3.6 (owner) stay open; the change stays `implementing`, not `implemented`, until they are done.

## Impl review follow-up (2026-10-20, review at `6781c3a`: APPROVED, 3 observations)

- **F1 taken, test first.** A 2xx whose body is not JSON gives postgrest-js an error with no code and a 2xx status (`dist/index.cjs:482`), which `codeFromResponse` skipped. It now treats any status on a code-less error as `http` with that status (the store asks only for a request that has an error). This changes the plan's "non-2xx" wording on purpose (plan Phase 2 §1 and the Phase 1 §4 contract); the plan text is left as reviewed. Tests changed first: `fault.test.ts` moves 200, 204 and 299 from "never produces a code" to the `http` list, and `record-transport.test.ts` gets a real-client case with a 200 HTML body. Red before the production edit: 2 tests (the `fault.test.ts` status list and the new real-client case). Green after; breaking the condition back to non-2xx turns the same 2 red; restored. Runbook: the `http` reading now names "a 2xx whose body was not JSON", and the "no `code`" sentence reads "a rejection (usually with a `name`) or a build from before this change", which is true now.
- **F2 taken.** The narrowed test's title now says what it says: "keeps only its code for a server fault and is `refused` or `session` by code in every write; has no fault for user input in answer and skip".
- **F3 taken.** The PR body states why e2e and smoke were left to CI (nothing but a log line on a Supabase failure changes; no page, route, markup or worker).

Gates after the follow-up: `npm run test:reference` 822 passed (1 skipped), `npm run test:guards` 60 passed, `npx astro check` 0 errors, `npm run lint` clean.
