<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Production Error Visibility (M-4 S-07)

- **Plan**: context/changes/error-visibility/plan.md
- **Scope**: Phases 2-6 of 9 (the committed block; Phases 7-9 not started)
- **Reviewed phases**: 2, 3, 4, 5, 6
- **Date**: 2026-10-16
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 5 observations
- **Reviewed at**: `8868e48` (feat/error-visibility-2, local only, 18 commits over `origin/main` after the #187 rebase), diff base `origin/main`
- **Reviewer**: herdr agent `reviewer` (read-only: this file is the only write; `change.md` is not stamped, per the orchestrator's rules)

## Verdicts

| Dimension           | Verdict                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Plan Adherence      | WARNING (F1, F2)                                                                                                     |
| Scope Discipline    | PASS (the extras `test-support/route-context.ts`, `supabase-fake.ts` and the `tests/db` shape updates are justified) |
| Safety & Quality    | WARNING (F3, F5; no privacy leak in any of our lines)                                                                |
| Architecture        | PASS                                                                                                                 |
| Pattern Consistency | WARNING (F9, minor)                                                                                                  |
| Success Criteria    | WARNING (F10: 2.6 fails on F2; 6.3, 6.5-6.7 pending)                                                                 |

## Evidence

**Gates run at HEAD `8868e48`** (Node 24.21.0):

- `npm test`: 151 files, 2895 passed, 4 skipped, 6 todo.
- `npm run lint`: clean.
- `npx astro check`: 548 files, 0 errors, 0 warnings, 0 hints.
- `npm run build`: exit 0, no "Unexpected fields" warning. `dist/server/wrangler.json` carries `observability: { enabled, redact_query_string: true, logs: { enabled: true, invocation_logs: false }, traces: { enabled: true }, issues: { enabled: true } }` and `preview_urls: false`.
- Not re-run by the reviewer: e2e, smoke, `test:db`. The author ran them green before the rebase. The rebase brought in only #187, a `wrangler.jsonc`/config-test/CLAUDE.md change that touches no route or store, so the risk is low. 6.3 (CI e2e with `failOnFlakyTests`) stays open until the PR runs.

**Privacy reading (D4).** The only `console.*` calls in changed runtime code are `log-failure.ts` error and warn. No changed runtime file has `JSON.stringify(error)`, `String(error)` or a `.message` that reaches a log. The remaining `.message` reads are message-key checks: `api-errors.ts` (zod issue), `session-plans/checks.ts` (`thrownKey`, only if `isMessageKey`) and `onboarding/store.ts`. Everything that reaches `code` today comes from a fixed vocabulary: SQLSTATE/PostgREST codes, ForecastError's `request|http|parse|schema`, and GoTrue's `error_code`. `name` is always a real class name. The tests plant coordinates and emails in messages, stacks and causes and assert they are absent: `log-failure.test.ts`, `routes/auth.test.ts`, `routes/plan-save.test.ts` and `log-create.test.ts` with `leakyPostgrestError`, plus `session-user.test.ts` and `tonight/load.test.ts`.

**Guard allowlist (D8) shrank honestly.** Compared with `origin/main`, 21 entries are gone, and every removed site now logs: TonightContent 1, forecast/service 2, celebrate 1, build 5, tonight/load 2, middleware 1, plan 1, plan/reset 1, gear pages 4, log index/new/sky 3, onboarding.astro 1. One entry was added with a reason: `observability/fault.ts`, count 1, a read guard that must not throw. No count went up. The remaining entries each carry a real reason: permanent INPUT/geolocation/install entries, store catches whose fault the route logs, open-meteo/geocode rethrows that drop the cause on purpose, and the browser side kept for Phases 7-9.

**Config.** `preview_urls: false` is pinned (`wrangler.jsonc:31`, `wrangler-config.test.ts:40-43`). #187's `invocation_logs: false` is still in place and pinned (`wrangler.jsonc:22`, `wrangler-config.test.ts:33`).

**Auth routine list (Phase 5).** Checked against the installed `@supabase/auth-js` 2.116.0. `AuthSessionMissingError`, `AuthInvalidJwtError`, `refresh_token_not_found`, `refresh_token_already_used`, `session_expired`, `session_not_found`, `bad_jwt` and `validation_failed` all exist, and `session-user.test.ts` pins them against the installed `.d.ts`. A 5 s timeout ends as `AuthRetryableFetchError` with status 0. It is logged as a failure with the name only, because 0 is outside 100-599. Nothing in the middleware is newly swallowed.

## Findings

### F1 — Plan routes: a read fault before the write bypasses D3

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/tonight/plan.ts:55-71, src/pages/api/tonight/plan/reset.ts:47-57
- **Detail**: This is the gap the author flagged. The checks before the write (`siteStore.get`, `tonightDateForSite`, `sessionPlanStore.get`) share one try/catch. It always calls `logFailure("save.plan" | "save.plan-reset", error)` at error level and redirects with `thrownKey(error, …)`. A Supabase outage fails the site read first, so the user gets `errors.load.sites` or `errors.load.sessionPlan` ("could not load…") and never `errors.serverFault`. The fault is not classified either: a session fault (`PGRST30x`) or a `42501` on the read becomes an error-level line, and so an Issue, where `saveFailureKey` would write a notice. The tests pin this behaviour (`routes/plan-save.test.ts:77-79`, `plan-reset.test.ts:83-85` expect `errors.load.sites`). The runbook's step-table row (`error-visibility.md:62`, "the user sees the plan's save message") is wrong for the site-read case. The plan's Phase 4 §2 wording ("the catch logs … instead of only mapping to a key") is met, but D3 is not. `observationStore.create/update` already route their read throws through `withFault`, so the plan routes are the odd ones out.
- **Fix**: In both catches, classify the thrown value and send it through the shared step: `return fail(saveFailureKey("save.plan", { message: thrownKey(error, "errors.save.sessionPlan"), ...withFault(error) }))`. `withFault` reads the `StoreFault` cause. A non-store throw, such as a `RangeError` from a bad zone, has no code and therefore counts as server. Flip the two test expectations to `errors.serverFault` plus one error line, add a `42501` read case that expects a notice, and correct runbook row 62.
  - Strength: one rule for every save route (D3, D12). It reuses `withFault` and `saveFailureKey` unchanged.
  - Tradeoff: a bad stored time zone (a code fault, not an outage) would also show the neutral server copy. That is arguably right, since it is not the user's input.
  - Confidence: HIGH — the same pattern already runs in `observations/store.ts` and every other route.
  - Blind spot: whether the owner wants "could not load sites" kept for a read-before-write. The plan never asked.
- **Decision**: Taken (owner, 2026-10-16): the plan routes' read-before-write failures go through `saveFailureKey("save.plan" | "save.plan-reset", { message, ...withFault(error) })`, so they show `errors.serverFault` and are classified (a `42501` or session fault on the read is a notice); the two route tests and runbook row 62 are updated. Applied 2026-10-17: both route catches call `saveFailureKey(step, { message: thrownKey(...), ...withFault(error) })`; the plan-save and plan-reset tests cover a server fault, a code-less throw, `42501` and `PGRST301` on the site read; runbook row 62 is corrected.

### F2 — milestone-store keeps the raw PostgrestError as `cause` (check 2.6 fails)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/observations/milestone-store.ts:31,59 (and the stale comments at :7-8 and src/lib/session-plans/checks.ts:36-37)
- **Detail**: Both reads `throw new Error(LOAD_FAILED, { cause: error })` with the raw `PostgrestError`, whose `message`/`details` can echo values. The file is not in Phase 2 §3's list, but manual check 2.6 ("no store function returns or keeps a PostgREST message", still unchecked) covers it. So do the new CLAUDE.md Observability tripwire and the new lesson ("never a PostgREST message"). It is the only `.from(`/`.rpc(` caller in `src` that does this. Today's line is safe, because `logFailure` reads only name and code, so this is a carrier leak, not a log leak.
- **Fix**: `{ cause: faultFrom(error) }` in both places, a leaky-error test like `gear/store.test.ts`'s, and the two comments fixed. Then tick 2.6.
- **Decision**: Taken: both milestone-store reads throw `{ cause: faultFrom(error) }`; `milestone-store.test.ts` plants coordinates and an email in a PostgREST error and asserts the cause holds only `code`; the stale comments are fixed; 2.6 ticked.

### F3 — User mistakes and scanner noise become Issues (auth codes, `request.form`)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/api-errors.ts:22-29 (`readForm`), :55-83 (`USER_MISTAKE_CODES`, `logAuthFailure`)
- **Detail**: `USER_MISTAKE_CODES` holds `invalid_credentials`, `user_already_exists`, `weak_password` and `email_address_invalid`. Everything else at sign-in and sign-up is `logFailure`, so error level and an Issue:
  - `validation_failed`: GoTrue's answer for a malformed email or a missing field. `signin.ts`/`signup.ts` pass `form.get(...) as string`, so a null reaches GoTrue. It is routine in `session-user.ts:26`, but not here.
  - `email_not_confirmed`: a user state when confirmations are on.
  - `over_request_rate_limit` and `over_email_send_rate_limit`: logged on purpose, but anyone can trigger them on an open endpoint, one error line per attempt.
  - `readForm` also logs a non-form body with `logFailure`. Sign-in and sign-up are public, so a scanner that POSTs JSON creates Issue volume for what is the client's malformed request.

  The Issues automation fires for every Issue of the Worker (runbook §5: no per-step filter). Every one of these wakes the operator.

- **Fix**: Add `validation_failed` and `email_not_confirmed` to `USER_MISTAKE_CODES`. Make `request.form` and the two rate-limit codes `logNotice` (warn, never an Issue; still countable by message text). Extend `routes/auth.test.ts` to cover them.
  - Strength: keeps Issues for faults that are ours (D12's own rule). It changes no redirect key.
  - Tradeoff: an abuse burst against sign-in shows only as warn lines. The runbook's count-query idea (D13) covers it once it is verified.
  - Confidence: MED — the GoTrue `validation_failed` paths come from reading GoTrue, not from a local run.
  - Blind spot: whether hosted Supabase has email confirmations on, which decides whether `email_not_confirmed` occurs at all.
- **Decision**: Taken (owner, 2026-10-16): add `validation_failed` and `email_not_confirmed` to `USER_MISTAKE_CODES` (confirmations are off in hosted Supabase today and the owner turns them on before payments); the two rate-limit codes and `request.form` on the public auth routes become `logNotice` (warn, no Issue), with `routes/auth.test.ts` extended. Applied 2026-10-17: `validation_failed` and `email_not_confirmed` are in `USER_MISTAKE_CODES`; the two rate-limit codes log through `logNotice`; `readForm(request, { publicRoute: true })` (sign-in and sign-up only) logs `request.form` as a notice, every other route keeps the error-level line; `routes/auth.test.ts` covers each; runbook rows 63 and 67 are updated.

### F4 — Runbook and plan text out of step with #187 and the owner's 1.10 findings

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/deployment/error-visibility.md:83, :97-106, :134; context/changes/error-visibility/plan.md:44, :55, :433, :463 (6.6)
- **Detail**: The runbook gets the main thing right: §1 says to search by message text, never by field, and nothing it tells the operator to do relies on a `step` field or an invented query syntax. But:
  - §5 "Script version per invocation (D6)" says to "open one invocation row in Workers Logs". With `invocation_logs: false` that row no longer exists. The version must be read from a console line's own metadata, if it carries one, which is unverified.
  - §6 still says in the present tense that Workers Logs "adds one invocation event per request" and lists URL path, headers and script version as "Held: Yes". Only its post-deploy list admits the row is gone.
  - §9 says traces are "the pending owner decision", while §6 (commit 8868e48) records the decision as made: traces stay on, under GDPR review #191.
  - In the plan, D2's reason ("fields filter in Workers Logs"), D13 ("a saved Workers Logs query on `step`"), Phase 6 §1's contract ("per `step` field") and 6.6 ("the invocation event around it") were never amended. Phase 7's implementer reads D13 as the spec.
- **Fix**: Reword runbook §5 and §6 for a deploy without invocation events: the table describes the pre-#187 state, with the D6 version check moved to a console line's metadata as **unverified**. Make §9 point at #191. Amend D2, D13, Phase 6 §1 and 6.6 in the plan with a dated note ("by message text, owner 2026-10-16; no invocation event after #187").
- **Decision**: Taken: runbook §5 (script version read from a console line's metadata, unverified), §6 (the table is the pre-#187 state, the invocation event is removed), §9 (traces kept on, under GDPR review #191) and the plan (D2, D4, D13, Phase 6 §1 and the 6.6 row carry dated notes: search by message text, no invocation event after #187).

### F5 — Traces: the "no latitude or longitude" premise does not hold for the forecast fetch

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: context/deployment/error-visibility.md:117; src/lib/forecast/open-meteo.ts:74-81; src/lib/forecast/service.ts:62
- **Detail**: The owner's decision to keep traces on (runbook §6, 8868e48) rests on "no latitude, longitude, postal code or client IP" among Cloudflare's span attributes. But the same list includes `url.full`. The Worker's outbound Open-Meteo request is `…/v1/forecast?latitude=<site lat>&longitude=<site lon>&…` (`open-meteo.ts:75-76`, the site's stored, unrounded coordinates). If the fetch span records the subrequest's `url.full`, every forecast fetch puts a user's observing-site coordinates into traces. `redact_query_string` is documented for logs, and whether it applies to trace attributes or outbound URLs is unverified. The span's KV key attribute also carries `forecast:v1:site:<siteId>` (`service.ts:62`), a site id, which D4 forbids for our lines. This predates S-07, and no line of ours is affected. It falls under the plan's NFR ("no coordinates in any report") and the decision just recorded.
- **Fix A ⭐ Recommended**: Before the PR, the owner opens one trace of a `/tonight` island request in the dashboard and reads the Open-Meteo fetch span's `url.full` and the KV spans' key attribute. Record the result in runbook §6 and #191. If the coordinates are there, turn traces off (`observability.traces.enabled: false`, pinned in `wrangler-config.test.ts`) as a hotfix like #187.
  - Strength: verifies before deciding, as was done for 1.9. The fallback is already written down (runbook §6).
  - Tradeoff: one owner dashboard check. With traces off, the per-fetch latency spans are lost.
  - Confidence: MED — Cloudflare's own attribute list names `url.full`. Whether the outbound URL is redacted is the unknown.
  - Blind spot: the retention of traces already stored, and whether they can be deleted.
- **Fix B**: Turn traces off now, without the check, and revisit under #191.
  - Strength: closes the possible leak at once.
  - Tradeoff: undoes the owner's decision of today on a hypothesis.
  - Confidence: HIGH that it removes the risk.
  - Blind spot: none significant.
- **Decision**: HOLD: the owner is checking one production trace (the Open-Meteo fetch span's `url.full` / `url.query` and the KV key attribute). Nothing changes until the result is relayed; if the coordinates are there, traces go off as a #187-style hotfix.

### F6 — PostgREST status is never captured, so "code and status" holds only in the fakes

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/observability/fault.ts:83-89 (`faultFrom` reads `error.status`); every store's `{ data, error }` destructuring
- **Detail**: `PostgrestError` has no `status` field (`@supabase/postgrest-js` `index.d.mts:26-29`). The HTTP status lives on the response (`status`), which the stores drop. So `fault.status` is never set in production, `classifyFault`'s "≥ 500 means server" branch never fires for a store, and the 4.8 line was `{ step, code: 'PGRST000' }` with no status. `supabase-fake.ts:22` gives the fakes a status that the real client never has. Nothing breaks, because no code also defaults to server.
- **Fix**: Either take `status` from the response (`const { data, error, status } = …; withFault({ code: error.code, status })`), or note in Phase 2's contract that store lines carry only `code` and drop the status from the fakes.
- **Decision**: Taken, as the second option: store faults carry `code` only (a PostgREST error has no HTTP status); the invented `status` is gone from `supabase-fake.ts` and the store tests, the docstrings say so, and the Phase 2 contract carries a dated note.

### F7 — `code` now carries non-database words; nothing stops a value-like code later

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/forecast/open-meteo.ts:33-45, src/lib/forecast/service.ts:240, src/lib/observability/log-failure.ts:76,117-120,141
- **Detail**: ForecastError's step travels as the line's `code` (`request|http|parse|schema`) rather than as its own field. Code and runbook agree (§2 item 1, step table), but it quietly widens D2's meaning of `code`. `codeOf` reads `code` from any object and from its `cause`, and `CODE_SHAPE` (`/^[0-9A-Za-z_]{1,12}$/`) also accepts `M31`, `NGC7000`, a short username or a site-id fragment. Today every source is a fixed vocabulary, so it is safe. But it depends on discipline, and one future `{ code: targetKey }` error would log a value. The same 12-character cap also drops nearly every auth-js code (`over_request_rate_limit`, `validation_failed`), so `auth.*` lines carry only name and status. That contradicts `logAuthFailure`'s docstring ("and a short code").
- **Fix**: Narrow what `code` accepts to closed shapes: SQLSTATE (`/^[0-9A-Z]{5}$/`), `PGRST\d{3}`, the four ForecastError steps, and auth-js's `ErrorCode` union as an explicit allowlist (which also restores the auth codes). Pin it with a table test, and record the `code` widening in D2.
  - Strength: turns "safe by discipline" into "safe by construction" in the one file that holds the privacy rule.
  - Tradeoff: an unknown future code shape is dropped until it is added (noise lost, never a leak).
  - Confidence: HIGH — the helper already has the read and the tests to extend.
  - Blind spot: Phases 7-9 reuse `CODE_SHAPE` for client reports and would need the same list.
- **Decision**: Taken: `CODE_SHAPE` is replaced by `isLoggableCode` (SQLSTATE, `PGRST` code, the four ForecastError steps, auth-js's `ErrorCode` list of 88 entries), used by `log-failure.ts`, `fault.ts` and the account-plan store; table tests pin accepted and rejected shapes and that every list entry exists in the installed auth-js; auth lines now carry their code. D2 carries a dated note. Phases 7-9 must use `isLoggableCode` for client reports.

### F8 — Notice and failure levels are uneven in the read and binding paths

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/forecast/kv-cache.ts:15-16; src/pages/{log,gear}/**/_.astro, src/pages/onboarding.astro (read._); src/lib/auth/session-user.ts:10,59-65
- **Detail**:
  - `forecast.cache-missing` logs on every Tonight island request when the binding is absent, while `config.supabase`, the same kind of deploy fault, logs once per isolate.
  - Page reads log every fault at error level, a session `PGRST30x` included, where writes classify through `classifyFault`.
  - `AuthRefreshDiscardedError` (auth-js 2.116.0, status 409, no code) counts as an `auth.claims` failure. With the middleware's single awaited `getClaims` it is effectively unreachable, and auth-js itself treats it as a no-op.
- **Fix**: Make `cache-missing` once per isolate. Send page reads through `classifyFault` (notice for `session`/`refused`). Add `AuthRefreshDiscardedError` to `ROUTINE_ERROR_NAMES` as cheap hardening.
- **Decision**: Taken: `forecast.cache-missing` once per isolate; page reads go through the new `logReadFailure` (notice for `session`/`refused`); `AuthRefreshDiscardedError` is routine.

### F9 — Small drifts and leftovers

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/tonight/load.ts:164-165; src/lib/observability/log-failure.ts (`FAILURE_STEPS`); src/pages/log/progress.astro; src/pages/api/log/index.ts:7, [id].ts:7; tests/db/{observations,session-plans,sky-checks}.test.ts
- **Detail**:
  - `chooseOwned` stays outside the guard. Phase 3 §2 says both move inside. It is pure, so the risk is low.
  - `milestones.read` and `milestones.record` are never emitted any more (every `reachedBySave` passes a route), but they are still in `FAILURE_STEPS` and runbook row 59.
  - `progress.astro` keeps 2 allowlist sites only because the guard cannot see through `logMilestoneFailure`. A direct `logFailure` call would retire the entry.
  - The log routes import `logNotice` from `observations/redirect.ts` (a redirect builder) next to the observability helper's `logNotice` name. That is an easy mix-up.
  - The `tests/db` assertions moved from `toEqual` to `toMatchObject`, so extra result keys now pass unseen.
- **Fix**: Move `chooseOwned` inside the try. Drop the two dead steps (or keep `milestones.list` only). Call `logFailure` directly in `progress.astro` and delete its entry. Rename the redirect helper (for example `noticeRedirect`). Assert `fault` exactly in the DB tests.
- **Decision**: Taken: `chooseOwned` runs inside the guarded block; `milestones.read` and `milestones.record` are gone from `FAILURE_STEPS` (with `logMilestoneFailure`, which had no caller left); `progress.astro` calls `logFailure` and its allowlist entry is deleted; the redirect helper is `noticeRedirect`; the `tests/db` assertions on `fault` are exact.

### F10 — Success criteria still open

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 2.6, 6.3, 6.5-6.7
- **Detail**: 2.6 is unchecked, and a review now shows it fails (F2). 6.3 needs the PR's CI run. 6.5-6.7 are owner checks after the deploy, and 6.6 asks for "the invocation event around it", which #187 removed (F4). No item is ticked without evidence: 3.7, 4.8 and 5.9 each record a concrete local run with the line seen.
- **Fix**: Tick 2.6 after F2. Reword 6.6 per F4. Leave 6.3 and 6.5-6.7 open until CI and the owner have run them.
- **Decision**: Taken: 2.6 ticked after F2, the 6.6 row is reworded (no invocation event after #187); 6.3 and 6.5-6.7 stay open until CI and the owner have run them.

## Questions for the owner

1. **Traces (F5):** before the PR, open one trace of a `/tonight` island request and read the Open-Meteo fetch span's `url.full` and the KV span's key. If they hold the site's coordinates or id, should traces go off now as a #187-style hotfix?
2. **Plan routes (F1):** should a failed site or stored-list read before a plan save show the neutral `errors.serverFault`, as D3 says for every save (recommended), or keep "could not load sites"?
3. **Auth noise (F3):** are email confirmations on in hosted Supabase (`email_not_confirmed`)? And may rate-limit and non-form-body lines be warn-level notices rather than Issues?
4. **D6 after #187 (F4):** after the next deploy, does a `sidereus:` console line in Workers Logs still show the script version and an invocation or request id in its own metadata, and does it hold any `request.cf` field? 1.9 checked only the invocation event.
