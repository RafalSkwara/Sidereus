# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Put every module that touches site coordinates under the no-console lint

- **Context**: Any phase that adds a module, route or page reading `SiteRecord`s or coordinates (stores, API routes under `src/pages/api/`, pages, Tonight/forecast code) in Sidereus.
- **Problem**: The coordinate-privacy NFR is enforced by `no-console: error` only on the paths listed in `gearConfig.files` (eslint.config.js); new modules outside that list rely on comments alone (S-06 impl review F2: `src/lib/observations/**`, `src/pages/api/log/**`, `src/pages/log/**` were uncovered).
- **Rule**: When a change adds a file or directory that handles site records or coordinates, add its glob to `gearConfig.files` in `eslint.config.js` in the same phase, and list that edit in the plan's Changes Required.
- **Applies to**: plan, implement, impl-review

## Filter and order every per-user list query

- **Context**: Store methods that read a per-user table through PostgREST (`client.from(...).select(...)` without a single-row filter), especially reads that feed the ranking or any count shown to the user.
- **Problem**: PostgREST caps responses at `max_rows` (1000, `supabase/config.toml`) without an error; an unfiltered, unordered read is cut off arbitrarily, so counts go wrong and results can change between loads, breaking the determinism NFR (S-06 impl review F1: `listForRanking`).
- **Rule**: Never read a per-user list without narrowing it to the rows the caller needs and giving it a deterministic `.order()`; if the result can still approach `max_rows`, aggregate in SQL or paginate, and say which in the plan.
- **Applies to**: plan, plan-review, implement, impl-review

## Tonight's content needs JavaScript: never plan no-JS behaviour inside the server island

- **Context**: Anything rendered inside `TonightContent` (`server:defer` in `src/pages/tonight.astro`): the verdict card, ranking, seven-night strip and the site/telescope selectors.
- **Problem**: The server island is fetched by a browser script, so with JavaScript off Tonight stays on `TonightSkeleton`. S-08 and S-05 both planned a "works without JavaScript" check for the selectors (S-05 Progress 3.7), which could never be exercised, and a component comment claimed no-JS support (S-05 impl review F2).
- **Rule**: Treat JavaScript as required for everything inside the Tonight island. Don't promise or plan no-JS behaviour there, and don't write success criteria that need it. Controls may still be plain links and GET forms, which keeps them simple, but a no-JS fallback for Tonight is its own change (render the island inline or add a `<noscript>` path) and must be planned as one.
- **Applies to**: plan, plan-review, implement, impl-review

## Make the server unreachable to test a service worker offline

- **Context**: E2E specs that check what the Sidereus service worker (`src/sw.ts`) serves offline: stored Tonight pages, the `/offline` fallback, anything keyed on the network failing.
- **Problem**: Playwright 1.55's `context.setOffline(true)` does not reliably cut the service worker's own fetches, even with `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1`: in offline-night-plan Phase 3, `/log` still rendered from the server under emulation and a never-opened Tonight page was fetched and stored, so an "offline" assertion could pass on a network response.
- **Rule**: Make the server genuinely unreachable for the worker (run the test through a proxy and close it, as `tests/e2e/offline.spec.ts` does, or stop the server), use `setOffline` only for the page's `navigator.onLine`, and assert a marker that only storage can produce (`html[data-from-device]`) before trusting any offline result.
- **Applies to**: plan, implement, impl-review

## `no-console` is an error in all of `src`; a new log needs an allowlisted disable

- **Context**: Any Sidereus change that adds a module, route, page, island or test under `src/`, or that wants to log anything there.
- **Problem**: The hand-kept `gearConfig.files` glob list in `eslint.config.js` (first lesson above) left every new module outside it at `warn`, and `npm run lint` has no `--max-warnings 0`, so a `console.log` beside a site's coordinates could merge (test rollout Phase 4, Risk #6). Keeping a list of "modules that touch coordinates" complete by hand does not scale.
- **Rule**: `no-console` is an error for every file under `src` (`noConsoleConfig`), and `src/lib/no-console-guard.test.ts` proves it file by file with ESLint's `calculateConfigForFile`. A deliberate log needs `// eslint-disable-next-line no-console -- <reason>` and an entry with its exact count in the guard's `ALLOWED_DISABLES`; never a rule-less `eslint-disable`. This supersedes the earlier "add the glob to `gearConfig.files`" lesson: there is no list to extend any more.
- **Applies to**: plan, implement, impl-review

## Resolving a rule's config is not proof the rule runs

- **Context**: Any guard test or review that checks lint coverage through ESLint's `calculateConfigForFile`, or any new file kind (an `.astro` client script, a processor's virtual file, a new extension) under a lint rule the project relies on.
- **Problem**: `calculateConfigForFile` reported `no-console` at error for every `.astro` client script while no rule ran on them: eslint-plugin-astro's virtual `X.astro/N.ts` failed the type-aware parser and the plugin dropped the parse error (testing-access-and-entitlement-boundary impl review F3, fixed in testing-quality-gates-wiring Phase 1).
- **Rule**: Pair every config-resolution guard with one end-to-end `lintText` of a known violation per file kind it covers (a TS file, an `.astro` frontmatter, an `.astro` client script), asserting the rule's message actually appears. When a new file kind joins the lint scope, add its sample in the same change.
- **Applies to**: plan, implement, impl-review

## Run the whole e2e suite before a PR, the way CI runs it

- **Context**: Any Sidereus change about to be pushed for a PR, especially one that touches shared components, the service worker, account plans or anything a spec outside the change also exercises.
- **Problem**: PR #153 (observing-milestones) failed CI smoke because only the change's own specs were run before pushing; other specs broke on a behaviour the change introduced (the milestone dialog after a rated log entry).
- **Rule**: Before opening a PR, run the whole e2e suite (`npm run test:e2e`) and `npm run smoke` against a local production preview the way CI does: a fresh `npm run build`, the forecast fixture, the local stack's URL and keys inline on the commands (the secret key never exported), and the preview's `dist/server/.dev.vars` pointed at the local stack rather than the hosted project. Report the counts in the PR.
- **Applies to**: implement, impl-review

## A red `ci` on main blocks the deploy: fix a flake failing-first, in its own change

- **Context**: A CI failure whose tests all pass but the run fails (an unhandled error, a race in a test harness), on a PR or on main.
- **Problem**: `deploy` runs only after `ci`, `smoke` and `migrate` pass, so an intermittent harness error on main (agent-hooks `write EPIPE`, CI runs 37992820410 and 38405588360) blocks a release that is otherwise green; rerunning hides it until it strikes on main again.
- **Rule**: Gather the evidence first (every test passed? which line? earlier runs with the same signature?), rerun the failed job once only to classify it, then fix the cause in its own small change with a test that reproduces it deterministically and goes red before the fix (finder-chart follow-up, PR #156). Never add retries or weaken an assertion to get green.
- **Applies to**: implement, impl-review

## Wait for the service worker with `ready`, never on `controller` alone

- **Context**: E2E specs that need the Sidereus service worker to control the page before they open Tonight pages and check stored copies (`offline.spec.ts`, `finder-offline.spec.ts`, `session-plan-store.spec.ts`, any new offline spec).
- **Problem**: The worker registers on the first page and calls `clients.claim()`, but when it activates while a navigation is in flight, Chromium leaves the document that navigation creates uncontrolled, so `waitForFunction(() => navigator.serviceWorker.controller !== null)` never ends. Under CI load the install landed during the onboarding → `/tonight` redirect and the spec hit its 180 s timeout, then passed on retry, which `failOnFlakyTests` turns red (PR #165, CI run 38704238918).
- **Rule**: Wait through `waitForServiceWorker(page)` in `tests/e2e/helpers.ts` (it awaits `navigator.serviceWorker.ready`, then reloads once if the page is still uncontrolled); `tests/e2e/service-worker-control.spec.ts` reproduces the race deterministically by holding the worker's `/offline` install fetch and a navigation in the proxy.
- **Applies to**: implement, impl-review

## Check the full plan in the island loader, and keep "unknown" apart from "free"

- **Context**: Any full-plan feature (FR-045) that renders inside a Tonight or finder server island or behind a POST route: finder charts (M-3 S-03), what-to-expect lines (S-04), session-plan edits (S-08), and every paid feature after them.
- **Problem**: `/_server-islands/*` is not behind the middleware, so an island URL captured from a full-plan page replays without the session. A plan check in the page shell alone would leak paid output. Separately, a failed plan read that falls back to `free` tells a paying user they lack the plan, or it stores or drops offline copies on a transient error. S-03, S-04 and S-08 each had to settle both points again in their own plan.
- **Rule**:
  - Check the plan in the shell (`requireFullPlan`) and again in the island's loader or the route, before any paid read or write.
  - Compute paid output only after that check, never in `TonightView`.
  - Keep three outcomes apart: `full`, an explicit `free`, and a failed read. Show the locked state only on an explicit `free`. On a failed read, show neither the locked state nor the paid output, and change no stored copy.
  - Prove the gate over HTTP in `scripts/smoke.mjs`, including a replayed island URL signed out.
- **Applies to**: plan, plan-review, implement, impl-review

## Judge advice that no observer can check against source-cited references

- **Context**: Any rule that tells a beginner what they will see or do, with numbers that no observer has calibrated: what-to-expect bands, finder hops and the naked-eye limit, ranking weights and penalties, event visibility (`top_blocker: skills`, roadmap Open Question 1).
- **Problem**: Without an observer, a rule tuned until its own snapshot looks right proves nothing. A wrong line also reads as authoritative: #159 has M31 described as "very faint" next to "bright for your 60 mm".
- **Rule**:
  - Before changing a rule, add the cases it should get right to a test-only reference fixture. Give each entry at least two published sources, and include the hard cases.
  - Keep the known misses in a named divergence list rather than loosening an entry.
  - Treat a failing reference as a finding about the engine, never as a fixture to edit (as with `expect-reference.ts` and `beginner-reference.ts`).
  - Every tuned number is a named candidate in `parameters.ts`.
- **Applies to**: plan, plan-review, implement, impl-review

## Pin a sampled scan against a brute-force reference, and measure budgets on the real encoding

- **Context**: Engine searches that sample time on a grid (event visibility, pairings, windows, the night's track), and any plan that sets a size or weight budget for a generated file (star files, catalogues, bundles).
- **Problem**:
  - S-07's coarse grid missed short twilight visibility windows (sky-events impl review F1), and nothing caught it until review.
  - S-03's star-file size estimate was off by 2x, because it was computed rather than measured on the gzip output.
- **Rule**:
  - Test every sampled scan against a brute-force fine-step reference over fixed windows that include the short cases.
  - Measure every size budget on the real build output in its shipped encoding before the plan commits to it, and pin the result in a test or a build check.
- **Applies to**: plan, implement, impl-review
