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

## Phase 8 (2026-10-19)

Red first this time: `src/lib/offline/report.test.ts` was written against a no-op stub of `report.ts` and 6 of 7 tests went red for the right reason (nothing sent, or a fallback not honoured); "offline sends nothing" passed against the stub and is really protected by the Phase 7 core test. The `sw.ts` allowlist was lowered from 26 to 6 before the conversion and the guard failed with "26 silent site(s), allowed 6" until the sites were converted.

Breaks (worktree-only, restored after each):

| Broken                                                                               | Test that went red                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `reportAnd` returns `undefined` instead of the fallback                              | `offline/report.test.ts` (3 tests)                            |
| the cap 10 -> 11                                                                     | `offline/report.test.ts`, the cap case                        |
| `keepalive: true` -> `false`                                                         | `offline/report.test.ts`, the posting case                    |
| one converted `.catch(reportAnd(...))` in `sw.ts` turned back into `() => undefined` | `silent-catch-guard.test.ts` (one site more than allowed)     |
| `report.ts` imports `log-failure`                                                    | `npm run build`: the new bundle check in `build-sw.mjs` fails |

Site assignment (all by the alias `@/lib/offline/report`): `sw.index` (readIndex parse, currentScope at 703), `sw.precache` (keepAssets fetch), `sw.shell` (recordShell, the stored-copy read at the network timeout), `sw.offline-page` (afterCommit, auth POST, install, purge's trailing store), `sw.next-night` and `sw.store-page` (the two bare catches, `storePageNow`), `sw.navigation` (afterNavigation, the late network promise), `sw.asset-note`, `sw.island-commit`, `sw.sweep` (four sites), `sw.purge`. Network steps: precache, offline-page, next-night, store-page, navigation. Known trade-offs: a real `TypeError` from a cache call at a network step goes unreported (D14); `sw.shell` reads a network body in `recordShell`, so a mid-stream cut can report one `sw.shell` `TypeError`; a `currentScope()` failure can be reported twice (at 703 as `sw.index` and by `recordShell` as `sw.shell`), bounded by the dedupe and the cap of 10 per wake-up.

Not unit-testable: `sw.ts` registers its routes at import time over Workbox, so the conversions are held by the guard, the build and the offline e2e specs, and the pass-through of `POST /api/client-error` by a step in `offline.spec.ts`.

## Phase 9 (2026-10-19)

Red first: `browser.test.ts` was written against a no-op stub of `browser.ts` and all 9 tests went red for behavioural reasons (nothing sent, no listeners) before the code; the guard allowlist was lowered first and failed with exactly the 6 expected sites before the island sites were converted. `client-imports.test.ts` and `gear/catalogue/load.test.ts` could not go red before the code (nothing to break), so they were proved by mutation.

Breaks (restored per file after each):

| Broken                                                                                                                                                   | Test that went red                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| own-script filter dropped; null-error check dropped; hydration detection off; idempotence guard removed; cap 5 -> 6; a `false` from `sendBeacon` ignored | `client/browser.test.ts` (each)                                        |
| `../log-failure` imported by `client/steps.ts` (or `browser.ts`)                                                                                         | `client/client-imports.test.ts`, naming the offender                   |
| the memo reset removed in `gear/catalogue/load.ts`                                                                                                       | `gear/catalogue/load.test.ts` (telescopes and eyepieces)               |
| `report.ts` (the worker's reporter) imports the barrel                                                                                                   | `client/client-imports.test.ts`                                        |
| own-script filter -> always true (in the built site)                                                                                                     | `tests/e2e/client-errors.spec.ts` case 3 (console-style input reports) |
| the `island.import` report removed from `TelescopeForm.tsx` (in the built site)                                                                          | `tests/e2e/client-errors.spec.ts` case 5 (the chunk case)              |
| `installErrorReporting()` removed from `Layout.astro` (in the built site)                                                                                | all 5 cases of `tests/e2e/client-errors.spec.ts`                       |

Known gap, accepted: the island reports in `EyepieceForm`, `TelescopeForm`, `OnboardingWizard`, `LocationPicker` and `map-panel` have no unit test (no DOM test stack, and none was added); the guard counts hold that every site reports or is allowlisted, and case 5 proves the `TelescopeForm` one in the browser. In particular nothing pins that the place search reports **after** its `aborted` check (round 3 F7): moving the report above the early return passes every test. It is held by the code comment and review only.

Environment note: a CI-mode e2e run (`CI=1`) writes `playwright-report/` and `test-results/` into the worktree. Their generated JS joins TypeScript's program: type-aware ESLint then fails with "Unsafe call of a type that could not be resolved" on `map-panel.tsx` (`setPrefix`) and `astro check` reports hundreds of hints. Move or delete both directories after an e2e run before linting; both are gitignored.

### Phase 9 after the impl review (2026-10-19)

Red first: the throwing-`message` getter test failed on the unguarded `messageOf` (the handler threw) before the guard; the place-search case in `client-errors.spec.ts` was shown red with the report moved above the `aborted` check (the one break that no unit test can show), and green with the order restored. The new build check was shown to fail (`build-sw: the Layout's script is not an _astro chunk that imports the page's error reporter`) when the Layout's import and call were removed, and to pass on the real build, where the Layout script is `Layout.astro_astro_type_script_index_0_lang.<hash>.js` and imports the shared `client.<hash>.js` that holds the reporter.

Known gap, now written down (D15, runbook, lesson, follow-up #230): the five scripts Astro inlines into the page are not covered by the own-script filter.
