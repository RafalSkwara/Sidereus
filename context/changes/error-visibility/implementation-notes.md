# Implementation notes: error-visibility

## Phase 7 (2026-10-19)

The tests and the code of Phase 7 were written in one pass, so "tests fail first" was not observed. The tests were then proved by deliberately breaking the production code (a worktree-only edit, restored from the staged version each time) and watching the matching test go red.

Breaks from the first pass (commit `a182d6e`):

| Broken                                                                                       | Test that went red                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| the stream cap in `readBoundedBody` (`total > maxBytes` never true)                          | `routes/client-error.test.ts`, the 513-byte and endless-stream case |
| the middleware short-circuit (path never matches)                                            | `auth/middleware.test.ts`, the client-error case                    |
| `z.strictObject` -> `z.object`                                                               | `routes/client-error.test.ts`, the 400 table                        |
| the once-per-isolate flag in `rate-limit.ts` (logs on every call)                            | `observability/rate-limit.test.ts`                                  |
| `isRoutineNetworkFault` ignoring the step                                                    | `observability/client/classify.test.ts`                             |
| a nameless report passes a fresh `Error` to `logNotice` (the line would say `name: "Error"`) | `routes/client-error.test.ts`, the one-warn-notice case             |

An earlier attempt at the last break (`if (false)`) stayed green because it changed nothing observable; it was replaced by the real one above.

Fixes after the Phase 7 impl review (this time red first, then green): each new test was seen failing for the right reason before the fix, and each was re-broken afterwards.

| Behaviour                                                        | Test                                           | Break that goes red                       |
| ---------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| a body broken off mid-upload is 400, no line, no token spent     | `routes/client-error.test.ts`                  | re-throwing in `readBoundedBody`'s catch  |
| refusals before the limiter spend no token (schema before it)    | `routes/client-error.test.ts`, `limit: 1` case | calling the limiter before the schema     |
| a limiter binding that throws fails closed, one line per isolate | `observability/rate-limit.test.ts`             | re-throwing in `allowClientError`'s catch |
| a trailing slash skips the session too                           | `auth/middleware.test.ts`                      | comparing the raw pathname                |

Not covered by a test, accepted: removing `reader.cancel()` after the cap (the stream is released by garbage collection either way; the review marked it minor).
