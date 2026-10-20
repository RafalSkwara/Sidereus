<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Production Error Visibility (M-4 S-07)

- **Plan**: context/changes/error-visibility/plan.md
- **Scope**: Phase 1 of 9 (plus its contract with Phases 2-9)
- **Reviewed phases**: 1
- **Date**: 2026-10-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 4 observations
- **Reviewed at**: `d2b3d6d9` (feat/error-visibility), diff base `origin/main`
- **Reviewer**: herdr agent `reviewer` (read-only: this file is the only write; `change.md` is not stamped, per the orchestrator's rules)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (F1, F2, F3) |
| Architecture | PASS |
| Pattern Consistency | PASS (observation F6) |
| Success Criteria | PASS (manual 1.9 and 1.10 are pending until after the deploy) |

## Evidence

**Gates run at HEAD `d2b3d6d9`** (Node 24.21.0):

- `npx vitest run`: 127 files, 2473 passed, 4 skipped, 6 todo.
- `npm run lint`: clean.
- `npx astro check`: 0 errors, 0 warnings. Its output also carries the wrangler 4.131.1 warning described in F3.
- `npx wrangler --version`: 4.145.0.
- `npx wrangler types --check`: stale. The plan accepts this (§5). The cause is this change's config hash, see F3.
- `npx wrangler deploy --dry-run` (wrangler 4.145.0, on the author's `dist/` from 21:17): ran once. It used the redirected `dist/server/wrangler.json`, reported 4454 KiB in total, listed the bindings SESSION, FORECAST_CACHE, IMAGES and ASSETS, and printed no config warning.
- `dist/server/wrangler.json` contains `"observability":{…,"issues":{"enabled":true}}` and `"preview_urls":true`. This settles criterion 1.7 without a rebuild. I did not run `npm run build`, because the author is running e2e from that `dist/`.

**Silent-catch inventory**, from a scratch copy of the guard's analyzer:

- 84 sites in all: 75 are silent and 9 pass.
- The allowlist adds up to 75.
- The 9 passing sites:
  - 2 in `finder/load.ts`
  - 1 in `forecast/service.ts` (the probe line)
  - 2 in `tonight/build.ts`
  - 4 in `sw.ts`. All four pass through a *conditional* rethrow (see F1).

**Privacy reading of `log-failure.ts`** (manual 1.8):

- No path reads `message`, `stack`, a URL, a header or a form value.
- The console receives only the fixed template string plus a `{ step, name?, code?, status? }` object built from shape-checked primitives.
- Every read that could throw is wrapped. The tests pin the cases that matter: a throwing getter, a revoked proxy, a cyclic cause and a throwing console.
- 1.8 can be ticked.

**Moved lines**: all seven `console.error` sites are now on `logFailure`, and the `ALLOWED_DISABLES` count is 2, both in `log-failure.ts`. The helper drops non-Error values: before, those were logged as `typeof`. That is acceptable.

**Probe**: `getForecast`'s catch logs `forecast.fetch` with `{ step, name }`. The test asserts that the coordinates, the dead host and the Open-Meteo URL never reach any argument.

**Drift**: one small, benign difference. The plan says `tonight/load.ts` imports `CODE_SHAPE`. Instead, its bespoke logger was removed entirely and the shape lives only in the helper. This is the better outcome.

## Findings

### F1 — The guard passes a catch that rethrows on only one branch

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/observability/silent-catch-guard.test.ts:276-304 (`isRethrowWithCause` / `handlerPasses`)
- **Detail**: A `throw error` anywhere in the block counts as a pass, even when an earlier branch returns a fallback. Today four sites pass this way, `src/sw.ts:607, 627, 719, 759`, all of the form `const r = await stored(); if (r) return r; throw error;`. They are not in the allowlist, and Phase 8 will not see them. Those four are defensible under D14, since a network fault there is routine. The rule is still a hole in D8: `catch (e) { if (e instanceof Redirect) throw e; return null; }` would pass while it swallows every other error. The guard's own "Blind spots" header does not list this case.
- **Fix**: Accept a rethrow only when the block has no `return` statement outside nested functions, or only when the throw is the block's final statement and no earlier `return` exists. Then allowlist the four `sw.ts` sites with the reason "network-first fallback to the stored copy is the feature (D14)", raising the `sw.ts` count from 20 to 24. Add one in-memory sample for the conditional rethrow, red as written.
- **Decision**: Taken (orchestrator, 2026-10-15): the guard accepts a rethrow only when the catch block has no `return` outside nested functions; the four `sw.ts` conditional-rethrow catches are allowlisted under D14; samples added (conditional rethrow red as written, green with `logNotice`).

### F2 — The guard does not see `.then(ok, fail)` rejection handlers, which island code uses

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/observability/silent-catch-guard.test.ts:28-31 (blind spots); sites listed below
- **Detail**: The header documents this blind spot, but it is the shape most island code uses. A scan finds 11 second-argument rejection handlers, and 10 of them are silent:
  - `EyepieceForm.tsx:64`
  - `TelescopeForm.tsx:63`
  - `OnboardingWizard.tsx:200,210`: catalogue imports set "unavailable"
  - `LocationPicker.tsx:128` (map open), `:168` (geolocation), `:198` (geocode search)
  - `forecast/cache.ts:22`
  - `sw.ts:78` and `sw.ts:617`

  The only one that reports is `tonight/load.ts:169`. These are exactly RC5's dynamic-import and geocode failures that Phase 9 is meant to close (`island.import`, `island.geocode`). Phase 9 deletes the allowlist entries for `gear/catalogue/load.ts`, but the callers' silent `.then(_, fail)` handlers stay invisible. A new one can also merge without the guard noticing, which is the opposite of "whatever its shape" (D8).
- **Fix A ⭐ Recommended**: Count the second argument of a `.then(a, b)` call as a site, judged by the same handler rule as `.catch(b)`. Allowlist the 10 silent ones with their phase reasons.
  - Strength: Closes the shape the islands actually use. The day-one numbers stay honest (85 silent sites instead of 75). Phase 9's criteria then cover the callers too.
  - Tradeoff: 10 more allowlist entries or counts, and one more sample in the test.
  - Confidence: HIGH — the analyzer already has the handler logic; this adds one more call shape.
  - Blind spot: A `.then` on a non-promise thenable with two arguments would also count. None was seen in `src`.
- **Fix B**: Keep the blind spot, but list the 10 sites in Phase 9's Changes Required so that phase wires them by hand.
  - Strength: No guard change in the PR that ships alone.
  - Tradeoff: A new silent `.then(_, fail)` still merges unnoticed after Phase 9.
  - Confidence: MED — it depends on the Phase 9 implementer reading the list.
  - Blind spot: Sites added between now and Phase 9.
- **Decision**: Fix A taken: the second argument of a two-argument `.then` is a site judged by the `.catch` rule; 11 silent `.then` sites allowlisted (one more than the review's 10: `TonightContent.astro`, which the review's scan skipped, goes in the Phase 3 group). `forecast/cache.ts` `.then(resolve, reject)` forwards the rejection and is Permanent. Notes added to Phase 8 (`indexQueue.then(task, task)` is restructured) and Phase 9 (handlers named in §2).

### F3 — Dev and build run a wrangler that does not know `observability.issues`, and every run warns about it

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: wrangler.jsonc:21-25; package-lock.json (`node_modules/@cloudflare/vite-plugin/node_modules/wrangler` 4.131.1)
- **Detail**:
  - **Two wranglers.** `@cloudflare/vite-plugin` 1.54.8 depends on `wrangler` exactly at 4.131.1, so the bump to 4.145.0 installs a second wrangler with its own miniflare and workerd (1.20260930.2 next to 1.20260911.1). `astro dev`, `astro build`, `astro preview` and `astro check` all parse `wrangler.jsonc` with 4.131.1, which prints `WARNING Processing wrangler.jsonc configuration: Unexpected fields found in observability field: "issues"`, plus "Try upgrading, as it might support this configuration option".
  - **The setting does reach the deploy.** The old wrangler passes the field through into `dist/server/wrangler.json`, and 4.145.0 deploys from that file without a warning (dry-run above).
  - **Why it matters.** That works by undocumented pass-through, and the warning sits on every dev and build run. A future agent or Dependabot could "fix" the warning by deleting the field. That would quietly turn Issues off at the next deploy, which is exactly the "the deploy undoes it" risk this phase is meant to remove.
  - **CI cost.** `npm ci` now downloads a second workerd per job (`ci`, `smoke`, `deploy`).
  - **Types.** `worker-configuration.d.ts` is stale because this change altered the config hash. The plan accepts that. Phase 7's `npm run cf:types` will regenerate it with 4.145's runtime types, so expect a larger diff there.
- **Fix A ⭐ Recommended**: Add a comment next to `"issues"` saying the 4.131.1 warning is expected until `@cloudflare/vite-plugin` depends on wrangler 4.134.0 or later, and that the field must stay. Add a small unit test that parses `wrangler.jsonc` (comment-stripped JSONC) and asserts `observability.issues.enabled === true`, `preview_urls === true` and `redact_query_string === true`.
  - Strength: Makes deleting the setting fail CI, which pins the Issues switch beyond what the plan's 1.7 grep of a build does. Costs one file.
  - Tradeoff: The duplicate workerd and the warning remain until the Astro/Cloudflare packages move.
  - Confidence: HIGH — the pass-through was checked at both ends (build output and dry-run).
  - Blind spot: A future vite-plugin could start stripping unknown fields. The test would not catch that; only a check of the build output would.
- **Fix B**: Also raise `@astrojs/cloudflare` / `@cloudflare/vite-plugin` to a release (at least two weeks old) that depends on wrangler 4.134.0 or later, so there is only one wrangler.
  - Strength: One wrangler and one workerd, and no warning.
  - Tradeoff: An adapter bump in a PR meant to be small, plus more supply-chain review. Such a release may not exist yet.
  - Confidence: LOW — I did not check which vite-plugin release first pins wrangler 4.134.0 or later.
  - Blind spot: The adapter's own changes.
- **Decision**: Taken in full: Fix B first. `@astrojs/cloudflare` already allows `@cloudflare/vite-plugin ^1.53.0`, so an `overrides` entry `"@cloudflare/vite-plugin": "1.62.3"` (published 2026-09-30, pins wrangler 4.145.0) leaves one wrangler, miniflare and workerd and no adapter bump; the warning check and gates are in the commit message. Fix A as well: a comment at `issues` and `src/lib/wrangler-config.test.ts` pinning `issues.enabled`, `redact_query_string` and `preview_urls`.

### F4 — The probe does not yet check that the fields are indexed

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 1.10; src/lib/observability/log-failure.ts:138,152
- **Detail**: D2 writes `console.error(message, fields)`: two arguments. Workers Logs documents field indexing for a logged object. The plan assumes that the second argument's `step`, `name` and `code` become filterable fields, not just part of a serialized message array. Probe 1.10 checks the Issue grouping but not this, and the runbook's per-step queries (Phase 6) depend on it.
- **Fix**: Extend 1.10: in Workers Logs, filter the probe line on `step = forecast.fetch` as a field. If that fails, revisit D2 together with the grouping check before Phase 3, for example a single object `{ message, step, … }`.
- **Decision**: Taken: probe 1.10 (plan Phase 1 manual list and Progress) also filters the probe line on `step = forecast.fetch` as an indexed field; if not filterable, D2 is revisited with the grouping check.

### F5 — The account-plan line puts a name in `code`, or drops it

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/account-plan/index.ts:46; src/lib/account-plan/store.ts:19,24
- **Detail**: The store returns `error.code || error.name`, or `typeof error`, as one `code` value, and the line passes `{ code }`. The results:
  - A short name lands in the `code` field (`TypeError`, `object`).
  - A longer name (`AuthRetryableFetchError`, 23 characters) fails `CODE_SHAPE` and is dropped, so the line holds only the step.

  Before this change the old line printed that value.
- **Fix**: In Phase 2, when the stores gain `StoreFault`, have the plan store return `{ code?, name? }` separately (or the fault) and pass it as the cause, so the helper files each value correctly.
- **Decision**: Taken as a note on the Phase 2 reads section: the account-plan store returns `code` and `name` separately.

### F6 — Allowlist entries that will never be removed sit under phase headings

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/observability/silent-catch-guard.test.ts:115-195
- **Detail**: Some entries sit under "Phase 3" and "Phase 4" while their own reasons say they stay: `forecast/open-meteo.ts` ("so the entry may stay") and the three `STORE_FAULT` entries ("the catch itself may stay allowlisted"). `location/geocode.ts` sits under the client heading while its reason says the cause is dropped on purpose. Criteria 3.4 and 4.4 say "allowlist entries for the touched files removed", which those phases cannot meet for these files. Several reasons also quote line numbers ("line 163", "lines 507, 585") that drift with the first edit.
- **Fix**: Move the entries that stay into the "Permanent" group now, with their final reasons, and drop the line numbers from the reasons. The guard's own failure message already names the lines.
- **Decision**: Taken: entries that stay (`open-meteo.ts`, the three store catches, `geocode.ts`, `forecast/cache.ts`) are in the Permanent group, reasons without line numbers.

### F7 — `preview_urls: true` keeps every uploaded version reachable, including the probe version

- **Severity**: 💬 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: wrangler.jsonc:24-25
- **Detail**: The owner enabled Version URLs, and the config only stops CI from turning them off, so this follows the plan. Still, with the setting pinned on, every version uploaded from now on has a public `*-sidereus.<subdomain>.workers.dev` URL running against production bindings and secrets. That includes the probe version (dead forecast URL), and any old version whose bug a later deploy fixed. The prefixes are not guessable, but they appear in deploy output and logs.
- **Fix**: After 1.10 succeeds, decide whether to keep Version URLs. If not, set `"preview_urls": false` in the same PR as the runbook (Phase 6), so the config still pins the choice.
- **Decision**: Owner, 2026-10-15: keep `preview_urls: true` for Phase 1; Phase 6 pins `preview_urls: false` after the probe and updates the config pin test in the same commit (plan Phase 6 §2, Progress 6.9).

## Contract with later phases (checked)

- `FAILURE_STEPS` is a closed `as const` list, and `FailureStep` is built as `ListedFailureStep` so that Phase 7 can widen it with `client.${ClientStep}` as the plan says.
- The guard recognises `report` / `reportAnd` / `<reporter>.report` only through an import from `@/lib/observability/client` or `@/lib/offline/report` (second-review F4), with the sixth sample in place. `logFailure` / `logNotice` are recognised by name alone, without an import check. That is a minor leniency, accepted.
- Phase 7's route tests and Phase 5's middleware tests can use the virtual-module seams: `virtual-modules.test.ts` loads `middleware.ts`, `supabase.ts` and `kv-cache.ts` under the mocks.
- `logNotice` exists and is tested at warn level; D12 and D13 rely on it.
- The `offline/install.ts` catch (`promptInstall`, a refused install prompt) is allowlisted as permanent "unless the owner decides otherwise". No `CLIENT_STEPS` entry covers it, so it stays silent even if Phases 7-9 ship. See the owner question below.

## Questions for the owner

- ~~QUESTION FOR OWNER: `offline/install.ts:82`~~ Answered by the owner 2026-10-15: stays silent permanently (a refused install prompt is a user choice, not a failure); the entry is in the guard's Permanent group.
- ~~QUESTION FOR OWNER: Version URLs after the probe~~ Answered by the owner 2026-10-15: pinned `false` in Phase 6 (see F7).
