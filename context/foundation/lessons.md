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
