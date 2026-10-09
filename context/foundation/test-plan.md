# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-09

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Expected values come from an independent source (the PRD, a reference
ephemeris such as Stellarium or Skyfield, or a hand-worked case), never from
the code under test. A snapshot regenerated from the implementation is a
change detector, not an oracle.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/migrations/`,
`scripts/` (generated catalogue JSON, `database.types.ts` and images excluded;
174 commits in the 30 days to 2026-10-07).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | Tonight shows a confident "Clear" sky when the forecast is partial, stale or missing (the series ends before the dark window does, the outage fallback is used, or cloud is not counted), so the user sets up under cloud | High | High | interview Q1, Q4 · PRD Guardrails "never a confident go", "forecast outage degrades" · archive `2026-09-25-no-go-and-no-darkness-explanations` (series ends before night 3's post-midnight hours), `2026-09-30-planets-on-tonight` impl review (planets ranked under cloud) · hot-spot dirs `src/lib/engine` (162 changes/30d), `src/lib/tonight` (133) |
| 2 | The verdict, session plan or log prefill lands on the wrong night or shows the wrong time: the "tonight" rollover, the 25-hour DST night of 25 Oct 2026, ordering across midnight, a month boundary, or the site's time zone versus the server's | High | High | interview Q2 · PRD NFR (site time zone, DST, 25 Oct 2026) · archive `2026-09-30-planets-on-tonight` (morning planet prefilled the next night), `2026-09-27-seven-night-site-planner` (DST night), `2026-10-03-verdict-check` (month-boundary night) · hot-spot dirs `src/lib/engine` (162, where the night is decided) and `src/lib/tonight` (133, its consumers), plus `src/pages/log` and `src/lib/observations` (the log's default night and its upper bound) *(research backport, 2026-10-08)* |
| 3 | A target is recommended that cannot be seen: below the site's minimum altitude, outside its window (dark window for deep sky, sun below −6° for the Moon and planets) or below the horizon, on Tonight or in the session plan | High | Medium | interview Q1 · PRD Guardrails "never recommends the physically impossible", Invariants · hot-spot dir `src/lib/engine` (162) |
| 4 | A calibration retune quietly degrades the ranking (a top 5 a beginner would not want, or a broken invariant such as a 1-2 rated log entry penalising its object) and passes because the snapshot was regenerated with it | Medium | High | interview Q3 · PRD Success Criteria (top 5 cross-checked against an independent reference), Invariants · archive `2026-10-02-moonlight-and-the-verdict` (revision 1 reversed the full-Moon order), `2026-10-06-deep-sky-beyond-messier` (calibration constants checked by eye) · hot-spot dir `src/lib/engine` (162) |
| 5 | Abuse: a signed-in user calls PostgREST or an RPC directly to read or change another user's rows, to put their own account on the full plan, or to reach full-plan features from a free account | High | Medium | PRD Access Control, FR-045, FR-046, NFR "verified outside the user interface" · roadmap F-01 (next) · archive `2026-09-24-sites-and-gear-management` (cross-user writes silently affect 0 rows), `2026-10-03-verdict-check` (tamper rules) |
| 6 | Abuse / PII leak: a site's coordinates escape into a URL, a log line, an error redirect or a third-party request through a new module the no-console guard does not cover | High | Medium | PRD Guardrails, NFR (coordinates) · `context/foundation/lessons.md` (S-06 impl review: three coordinate paths outside the lint guard) |

High-impact, low-likelihood scenarios kept out of the map on purpose: an
Open-Meteo or Supabase outage itself, and forecast fair-use exhaustion. These
belong to observability and alerting; the user-visible degrade behaviour is
covered under Risk #1.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | With a truncated, stale, partly missing or absent forecast the sky reads marginal, "no weather data" or the last saved forecast with its age: level never go and headline never the bare "Clear" ("Clear (old forecast)" at marginal is PRD-sanctioned); a degenerate 200 must not replace a usable saved copy; a missing dark-window hour must not allow go; moon, twilight and altitude results stay usable; no error page. *(Research-sanctioned backport, 2026-10-08, from `testing-forecast-honesty` research "Corrections to the test-plan guidance" and its plan; §1-§5 are otherwise frozen.)* | "No cloud data for an hour means no cloud" and "a 200 from the provider means a usable series" | the forecast fetch, the KV cache and its age, how the series is cut to the dark window per night, which nights 1-3 can lack hours | unit (verdict over crafted series) + integration (forecast loading with the in-memory cache and a fake HTTP edge) | only complete series in tests; expected verdict copied from the verdict code; mocking the verdict to test the loader |
| #2 | For a fixed instant and site, the right "tonight", dark window, plan order and log night come out across the site-zone edges: the minutes either side of the civil-dawn rollover at the production threshold, the 25-hour 24/25 Oct night (Europe), the 23-hour spring night, a 31 Oct / 1 Nov night in a US zone (a month end and a 25-hour night at once), and sites far from UTC; and they stay the same whatever zone the runner is in (a cheap regression guard: no production path reads the runner's zone today). *(Research-sanctioned backport, 2026-10-08, from `testing-night-and-date-boundaries` research "Corrections to the test-plan guidance"; §1-§5 are otherwise frozen.)* | "Pinned UTC dates in existing tests cover the edges" (true only for Warsaw's autumn change) | where "tonight" and the observing night are decided, which zones and instants tests pin today, where the log prefill and the log's default night take their date, and which independent references exist for the rollover instant | unit, table-driven over site zones and edge instants, with the runner zone switched in-process | tests that pass only in the runner's own time zone; expected night or rollover instant derived with the same helper under test |
| #3 | Across many generated sites, nights, latitudes (both hemispheres, polar) and telescopes, no ranked target, planet, Moon entry or Session plan row falls outside its window or under the site's minimum altitude at its window start, end or best time; a regression guard, since a 2026-10-08 probe found none. *(Research-sanctioned backport, 2026-10-08, from `testing-ranking-invariants-and-calibration-oracle` research "Corrections to the test-plan guidance"; §1-§5 are otherwise frozen.)* | "The fixture nights in the suite are representative" (almost all are Warsaw, 150 mm) | the window rule per target kind, how the session plan places targets, which latitudes and seasons tests cover | unit property tests over a seeded generator | asserting only the top 5 of a few fixed nights; an oracle built from the engine's own window or track output instead of altitude recomputed independently in the test |
| #4 | A retune that breaks a PRD invariant, or degrades the top 5 against a committed, source-cited independent reference, fails the suite; expected orders copied from engine output are replaced by rules or relations, so editing a literal cannot launder a retune. *(Research-sanctioned backport, 2026-10-08: no calibration snapshot is stored — the print-only log asserts nothing — so the risk is a guard too loose to notice a retune.)* | "The calibration test guards the ranking" (it guards only the Messier bonus, on four new-Moon nights) | how the calibration test and its print-only snapshot work, which reference nights and tools (Stellarium, Skyfield, published beginner lists) exist, which invariants have tests | unit: invariant relations + committed independent reference list | expected order copied from the implementation (oracle problem); brittle exact order where the PRD only fixes a rule |
| #5 | User B cannot read, update or delete user A's rows or call A's RPCs (anon writes included, refusals pinned to `42501`, every per-user table structurally checked for RLS and four policies); a user cannot change their own plan; a free account is refused by the server, not only hidden in the UI, on every full-plan route. The plan half depends on roadmap F-01, which does not exist in code yet. *(Research-sanctioned backport, 2026-10-09, from `testing-access-and-entitlement-boundary` research; §1-§5 are otherwise frozen.)* | "RLS on the table means every column is safe" (no column grants exist: owners can write server-decided fields of their own rows, accepted as self-only for now, and a `plan` column on an owner-writable table would be self-grantable) and "a hidden button means a refused request" | per-operation policies and column grants, the plan attribute and how the operator sets it, how routes check the plan | db integration (existing isolation suite) + route-level check | asserting "0 rows affected" without a positive control; testing gating through the UI only |
| #6 | Every module that reads site records or coordinates sits under the no-console guard, and no redirect, URL or `?error=` carries a coordinate value. *(Research backport, 2026-10-09: `warn` fails nothing in CI, so the guard is only the `error` scope; a repo-wide `error` plus a config-resolving guard test proves it without listing modules.)* | "The lint file list is complete" | which modules and routes handle coordinates, which URLs and redirect keys exist, the current lint scope | static gate (lint-scope check) + unit on redirect keys | grepping for the literal "lat"; a check that has to be updated by hand for each new module |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Forecast honesty | Prove a partial, stale or missing forecast never yields a confident "Clear" and never blanks Tonight | #1 | unit + integration | complete | testing-forecast-honesty (archived: context/archive/2026-10-07-testing-forecast-honesty/) |
| 2 | Night and date boundaries | Prove the right night and times in every zone across DST, the rollover, midnight and month ends | #2 | unit | complete | testing-night-and-date-boundaries (archived: context/archive/2026-10-08-testing-night-and-date-boundaries/) |
| 3 | Ranking invariants and calibration oracle | Prove no impossible target is listed and a retune cannot pass by regenerating its own expectations | #3, #4 | unit (property + reference fixture) | complete | testing-ranking-invariants-and-calibration-oracle (archived: context/archive/2026-10-08-testing-ranking-invariants-and-calibration-oracle/) |
| 4 | Access and entitlement boundary | Prove isolation and the plan are enforced on the server and coordinates stay private | #5, #6 | db integration + static gate | complete | testing-access-and-entitlement-boundary |
| 5 | Quality-gates wiring | Stop CI retries from hiding flakes and lock the Phase 1-4 checks into CI and the agent loop | cross-cutting | gates + hook | not started | — |

Order rationale: Phase 1 is the user's top worry and named gap. Phase 2 has
a hard date, the DST night of 25 Oct 2026. Phase 3 protects the area the user
retunes with least confidence before more M-3 scoring work. Phase 4 runs with
or right after roadmap F-01 (account plans). Phase 5 locks in what 1-4 add.

## 4. Stack

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit | Vitest | ^5.0.1 | `vitest.config.ts`, `src/**/*.test.ts` next to the code, node env, no Astro/Cloudflare plugin; ~65 files, engine fixtures from Stellarium/Skyfield |
| db integration | Vitest | ^5.0.1 | `vitest.db.config.ts`, `tests/db/`, live local Supabase through PostgREST + RLS; 4 files |
| HTTP edge fakes | forecast fixture server + in-memory KV | n/a | `tests/e2e/forecast-fixture.mjs` for preview/e2e; forecast code takes an injectable cache in unit tests |
| e2e | Playwright | 1.55.0 | `tests/e2e/`, 21 specs, Chromium only, against a production preview; CI `retries: 1` |
| smoke | `scripts/smoke.mjs` | n/a | HTTP walk of signup → gear writes → signout against local Supabase |
| static guards | ESLint, `astro check`, purity / colour / i18n-parity unit guards | ^10.10.0 | no-console on coordinate paths is the privacy guard |
| AI-native | none | n/a | not justified by any risk under cost × signal |

**Stack grounding tools (current session):**
- Docs: none — no Context7 or framework-docs MCP exposed; versions taken from `package.json` and configs; checked: 2026-10-07
- Search: web search available, not used — the plan recommends no tool beyond what is installed; checked: 2026-10-07
- Runtime/browser: no Playwright MCP — the project's own Playwright CLI is the browser layer; checked: 2026-10-07
- Provider/platform: Cloudflare MCP configured but not authenticated; GitHub through `gh` — possible read-only checks of CI runs for Phase 5; checked: 2026-10-07

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + `astro check` | pre-commit (lint-staged) + CI `ci` | required | type drift, coordinate logging anywhere in `src` (`no-console` error, since §3 Phase 4) |
| unit (Vitest) | CI `ci` | required | engine, verdict, date and copy regressions |
| db isolation suite | CI `smoke` | required | cross-user access through PostgREST/RLS |
| generated types up to date | CI `smoke` | required | schema drift from migrations |
| smoke + e2e on preview | CI `smoke` | required | broken critical journeys |
| forecast degrade cases | CI `ci` | required after §3 Phase 1 | confident verdict on partial or missing data |
| reference cross-check + invariant properties | CI `ci` | required after §3 Phase 3 | retunes that break invariants or the independent reference |
| plan enforcement + coordinate lint-scope check | CI `smoke` (`tests/db/structure.test.ts`, `isolation.test.ts`, `account-plans.test.ts`, exact smoke redirects) / CI `ci` (`src/lib/no-console-guard.test.ts`) | required (active since §3 Phase 4) | an unclassified table, a per-user table without RLS or its four policies, a definer or anon-executable function, anon or cross-user writes, a self-granted plan, a source file where `no-console` is not an error, an unlisted `no-console` disable, a coordinate in an error redirect; the HTTP refusal of a full-plan route arrives with S-03's first route (§6.4) |
| e2e flake visibility (a retried pass is reported) | CI `smoke` | required after §3 Phase 5 | flakes hidden by `retries: 1` |
| post-edit agent hook (engine/tonight tests) | local agent loop | recommended after §3 Phase 5 | regressions at edit time |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a verdict test for degraded forecast data

- **Pick the layer by what can go wrong.** A provider body judged for one night: `src/lib/forecast/degraded-forecast.test.ts` (body → `mapForecastResponse` → `verdict` over a hand-built `DarkWindow`). Rule-only verdict cases: `src/lib/engine/verdict.test.ts`. What the service returns and stores (fresh hit, refresh, outage fallback, incomplete 200 against a saved copy): `src/lib/forecast/service.test.ts`. What the user sees on Tonight: `src/lib/tonight/forecast-honesty.test.ts` (`getForecast` → `buildTonight`, nothing mocked below the fetch; assert `view.verdict.level`, `view.headline.id`, `view.forecastStatus.kind`/`.text`, `view.nights[i]`, `view.moonCard`, `view.ranking`). That a forecast problem never becomes an error page: `src/lib/tonight/load.test.ts`.
- **Helpers:** `openMeteoBody`, `fakeFetch`, `jsonResponse` and `memoryCache` from `src/lib/forecast/test-helpers.ts`; `LoadTonightInput.fetchFn` takes the fake fetch, so never stub the global. Headline ids come from `createFormatter("en").skyHeadline(verdict).id`. Seed a saved copy through a first successful `getForecast` call on the same `memoryCache`, so it has the shape the service really writes.
- **Oracle rule:** expected levels and headlines come from the PRD thresholds (go = a run of ≥ 2 h below 30 % cloud, marginal = ≥ 1 h below 65 %, humidity above 90 % caps at marginal), the PRD headline table (`prd.md`, FR-010 resolution: Clear, Clear (old forecast), No forecast, …) and metamorphic relations (removing hours never creates a go; a fallback copy never gives go), never from values read off `verdict.ts` or `build.ts` output.
- **Wide margins:** build provider bodies over the real request range (216 hours from 00:00 UTC the day before the fetch) and put every boundary a case depends on hours, not minutes, from the dark window's edges (trailing nulls from mid-evening; a copy whose last hour is 23:00 UTC, before night 3's post-midnight hours), and prefer half a day where the case allows, so sunset drift or a threshold retune never flips the expectation.
- **Loader-mock gotcha:** `vi.mock("@/lib/gear/store", …)` must spread `importOriginal()` and replace only `siteStore` / `telescopeStore` / `eyepieceStore` (`build.ts` and `tonight-date.ts` import `toEngineSite` from it); wrap `buildTonight` in a `vi.fn` defaulting to the real one; keep the `vi.fn` handles in a `vi.hoisted` object (`vi.mocked(siteStore.list)` trips `@typescript-eslint/unbound-method`); never mock the verdict or the engine.

### 6.2 Adding a test that crosses a night or date boundary

- **Pick the layer by what can go wrong.** Which night a moment belongs to and where tonight rolls over, for 4 sites on 5 edge nights (DST both ways, month end, UTC+13/+14): `src/lib/engine/night-boundaries.test.ts` (`observingNight`, `darkWindow`, `tonightDateFor`). What the user sees on those nights (Tonight's date, "Mark observed", the seven-night strip, Session plan order and labels, the offline copy's hand-over): `src/lib/tonight/night-boundaries.test.ts`. The log form's default night and its `max` (pure `logFormNights`): `src/lib/observations/log-night.test.ts`.
- **Helpers** (`src/lib/engine/fixtures/`, test-only): `RUNNER_ZONES` / `useRunnerZone(zone)` / `expectRunnerZoneActive(zone)` from `runner-zones.ts` run a `describe.each` block under 5 process zones (UTC, Europe/Warsaw, America/Los_Angeles, Pacific/Kiritimati, Asia/Kolkata) by switching `process.env.TZ` in-process and restoring it afterwards; `USNO_CIVIL_DAWN` (and `USNO_CHECKED`) from `usno.ts` holds the published civil dawn and sunrise per edge night.
- **Oracle rule:** expected nights are hand-written calendar literals; rollover instants are USNO's civil dawn, ±5 min for "either side of it" and ±2 min when comparing the engine's `darkWindow(..., -6).end`; local-time labels come from hand-written UTC offsets (+2 h CEST, +1 h CET, −7 h PDT, −8 h PST). Never use `observingNightDateFor`, `tonightDateFor` or `formatTime` output as an expectation.
- **Adding a USNO value:** fetch `https://aa.usno.navy.mil/api/rstt/oneday?date=<YYYY-MM-DD>&coords=<lat>,<lon>&tz=0` and read `Begin civil twilight` (dawn) and `sunrise` for the morning after the night. `tz=0` returns UTC on the UTC calendar day `date`, so far east of UTC a dawn falls on the previous UTC day (Auckland and Kiritimati: ask for the day before `night + 1`). Round to the minute, add the entry to `USNO_CIVIL_DAWN` with the site's IANA zone and sea-level `elevationM: 0`, and set `USNO_CHECKED` to the day you read it.
- **Zone-switch gotchas:** call everything under test inside `it` or `beforeAll`, never at `describe` scope (collection runs under the original zone); a default-zone `Intl.DateTimeFormat` created before the switch keeps the old zone; start each runner-zone block with `expectRunnerZoneActive(zone)` so a switch that silently failed cannot pass. Assert preconditions that would otherwise make a case vacuous (e.g. Session plan rows on both sides of local midnight and of the clock change). The switch needs Vitest's default `forks` pool (a `worker_threads` worker ignores `process.env.TZ`).
- **Runner-zone guard:** `src/lib/runner-zone-guard.test.ts` scans every non-test `.ts`/`.tsx`/`.astro` file under `src/` (not `fixtures/`) and fails on local `Date` getters/setters, `getTimezoneOffset`, `toLocale{Date,Time}String`/`toDateString`/`toTimeString`, multi-argument `new Date(y, m, …)`, `Intl.DateTimeFormat(` without `timeZone`, and zoneless date-time strings in `new Date(` / `Date.parse(`. It reports `file:line rule`. A hit is a bug to fix; for a false positive narrow the matcher (`findRunnerZoneReads`) and add the shape to its allowed table, never a file allowlist. Known gap: plain `Date#toLocaleString`.

### 6.3 Adding a ranking invariant or reference cross-check

- **Pick the layer by what can go wrong.** A listed object, planet or Moon target outside its window or under the site's minimum altitude (Risk #3), judged on the engine's own lists: `src/lib/engine/visibility-invariants.test.ts`. The same guarantee through what the user sees (every Session plan row of a `buildTonight` build, and no ranking on a night without darkness or under a cloudy forecast): `src/lib/tonight/visibility-invariants.test.ts`. A PRD ranking rule as a relation over the whole catalogue (1-2 ratings inert, seen and the Messier bonus never decide the bar, washed out never listed, permutation invariance, a bigger aperture never shrinks the cleared set): `src/lib/engine/ranking-invariants.test.ts`. Whether a retune pushed published beginner showpieces out of the top 5: `src/lib/engine/calibration.test.ts`.
- **Helpers** (`src/lib/engine/fixtures/`, test-only, skipped by `purity.test.ts` and the runner-zone guard; never put them in `src/lib/tonight/test-fixtures.ts`, which the guard scans): `seeded` (mulberry32), `GENERATED_SITES` (16 reference points from the equator to 78° N and 64.8° S, fixed IANA zones) and `generateCase` from `generated.ts`; build the case array at module scope from a fixed seed, run every engine call inside `it` or `beforeAll`, and put the case index and inputs in every failure message so a case replays. `deepSkyAltitudeDeg`, `bodyAltitudeDeg` and `sunAltitudeGeometricDeg` from `independent-altitude.ts` take an astronomy-engine `Observer` (elevation 0 for Tonight, which drops the site's elevation); the first two recompute a position by a road the engine does not take, and `sunAltitudeGeometricDeg` is a deliberate copy of the engine's geometric sun (the PRD's twilight convention, the same astronomy-engine calls); the Bortle → dark-threshold table (`DARK_THRESHOLD_BY_BORTLE`, -18 / -15 / -12) and `PLANET_WINDOW_THRESHOLD_DEG` (-6) are the PRD's own, written out there, so never read the oracle's threshold from `parameters.ts`. A Session plan row carries its window only as axis fractions: rebuild the axis from `sunEvents`, falling back to `observingNight`, take start and end as axis start + `from` / `to` × length, use `bestAt` as is, and assert the row is not clamped (`from > 0`, `to < 1`) first when the axis comes from sunset and sunrise. On a night-wide axis (polar summer or night: no sunset or no sunrise) the engine's planet and Moon window is clamped to the night itself, so `from === 0` or `to === 1` is accepted there only when the oracle's sun at that edge is within the row's own threshold; the fixed Longyearbyen 2026-11-25 case exercises it.
- **Relation, not value.** Assert a relation between two engine runs or against a PRD constant (an equality, a subset, "never below"), never an expected ranking or score copied from engine output: that would encode today's tuning, bad retune included. Run logs through `seenSummaries(log, night)`, never a hand-built `seen` map, or the rating filter is bypassed. A relation that holds vacuously (an empty washed-out list) needs its precondition asserted.
- **Beginner reference** (`src/lib/engine/fixtures/beginner-reference.ts`): an object is in a night's list when at least 2 published sources name it as a beginner target for that season; the rule was fixed before any comparison with the engine. The calibration test requires each night's top 5 to share at least k = 3 objects with the list. Never edit the list to make a ranking pass: a night below 3 means the ranking is under review. To change the reference, add the new sources to `BEGINNER_SOURCES` (title, publisher, `urls`, access date) and the keys to the entries, and add a dated note to the "Beginner reference" section of `fixtures/README.md` naming the sources and the day they were read. The opt-in `CALIBRATION_SNAPSHOT=1` output is a recording aid, not an oracle: regenerating it changes no assertion.
- **Tolerances and non-vacuity.** Altitude is checked as `independent >= minimum - ε` and sun altitude as `independent <= threshold + ε` with ε = `ALTITUDE_TOLERANCE_DEG` = 0.05° (the paths differ by arcseconds; the accuracy NFR is 1°), never ε = 0. Assert the counts first, so a property that checks nothing fails: engine suite at least 150 cases with a dark window, 3,000 object entries, 20 southern and 10 above-60° cases, 50 planet entries; ranking suite at least one rating-2 log entry on a cleared object and `washedOutCount ≥ 1` on the full-Moon nights; Tonight suite at least 30 plans with rows and 3 no-darkness cases (guaranteed by fixed polar-summer cases, not the seed). A gate guarded twice in production (no darkness: `verdict()` and `cardPasses`) is asserted so that a throw is a failed assertion, not a crash. Never log from a Tonight suite (`no-console` is an error in all of `src`).

### 6.4 Adding a per-user table, RPC or full-plan route

- **Pick the layer by what can go wrong.** Whether every `public` table and function is classified and shaped right (RLS, the four policies, privileges, INVOKER, `search_path`, no anon execute): `tests/db/structure.test.ts`, which reads the catalogs over `DB_URL` and needs no edit of its own. Whether user B can read or change user A's rows, and anon can write at all: `tests/db/isolation.test.ts`, driven by `TABLES`. A server-owned table's refusals: its own file, as `tests/db/account-plans.test.ts`. An RPC's rules: its own file, as `tests/db/sky-checks.test.ts`. A full-plan route's refusal: an HTTP check against the preview, never the UI. Whether a module could log a coordinate: nothing to add, `src/lib/no-console-guard.test.ts` covers every file under `src`.
- **A per-user table:** migration with RLS on and one `select`, `insert`, `update` (with `with check`) and `delete` policy `to authenticated`, each keyed on `auth.uid() = user_id` (extra ownership terms may follow, as `observations` and `sky_checks` do); then an entry in `TABLES` (`tests/db/tables.ts`) with a `valid` row (no `user_id`, it defaults to `auth.uid()`) and an owner `change`. The isolation suite then runs the positive controls, the cross-user and anon cases and the `42501` pins on it, and the structural suite demands the policy shape. Forgetting the entry fails `structure.test.ts` with the table's name.
- **A server-owned table** (read-only for users, written by the operator's secret key): revoke all from `anon` and `authenticated`, grant `select` back to `authenticated`, RLS on with a `select` policy only; add the name to `SERVER_OWNED` and give it a `tests/db/` file that proves `42501` on every self-write with a positive control (the admin client from `SUPABASE_SECRET_KEY` writes the control row), no cross-user read and no anon access, as `account-plans.test.ts` does.
- **An RPC:** `security invoker`, `set search_path = ''` with schema-qualified names, `revoke execute … from public, anon` and `grant … to authenticated`; then a `tests/db/` case that anon gets `42501`, and a cross-user case (B passes A's ids) asserted by reading A's rows back as A, with a positive control that A's own call works. The structural suite fails a definer function, a missing `search_path` or an anon-executable one by name.
- **A full-plan route** (S-03's first one brings the first case): call `requireFullPlan(Astro.locals)` first in the handler and, when `ok` is false, redirect with its `errorKey` before any read or write; a page renders its own state instead. The check is HTTP, never the UI: sign up a free account and a full one (grant with `npm run account:plan -- <email> full` or the admin client on local Supabase), POST the same form as each, and assert the free account's exact `Location` ends in `?error=errors.accountPlan.needsFull`, that the write did not happen (read it back as the owner), and that the full account's request succeeds as the positive control. Put it in `scripts/smoke.mjs` (exact `location`, `exact: true`) or a `tests/db/` fetch against the preview; a hidden button proves nothing.
- **Oracle rule:** refusals are pinned by their kind, not by "an error": an INSERT or a WITH CHECK failure (including handing a row over) is `error.code === "42501"`; a cross-user or anon UPDATE or DELETE is a silent zero-row no-op, asserted by reading the row back as its owner, never by `count === 0` alone. Every refusal case has a positive control in the same test.
- **Coordinates in redirects and logs:** an `?error=` is a fixed catalogue key; the smoke cases pin it with `exact: true` and `absent: "<the submitted value>"`. A deliberate log needs `// eslint-disable-next-line no-console -- <reason>` and an entry with its exact count in the guard's `ALLOWED_DISABLES`; a rule-less `eslint-disable` fails the guard in any file.
- **Blind spots** (a lint rule cannot see them, so review them): `console` reached through an alias or a destructured reference, `reportError`, a thrown message or `cause` that quotes a URL or value (see the `preserve-caught-error` disables in `src/lib/forecast/open-meteo.ts`), and coordinates sent to a third party in a request URL (Open-Meteo, the geocoder, map tiles) by design. Self-only writes to server-decided fields (`sky_checks`, `observations`) are an accepted known gap (owner, 2026-10-09), not covered here.
- **Gotchas:** `DB_URL` is the local stack's `postgres` superuser URL from `npx supabase status -o env`; it never goes into `.env`, `.dev.vars` or a log, and CI passes it to `test:db` only. PostgREST answers an anon INSERT with HTTP 401, so assert `error.code`, not the status. Extension-owned functions are skipped by the structural suite; anything else in `public` counts.

### 6.5 Adding an e2e spec

- TBD — see §3 Phase 5. Until then: only for a journey that needs the browser (service worker, hydration, layout at phone width), following `context/foundation/lessons.md` for offline.

### 6.6 Per-rollout-phase notes

(After each phase lands, `/10x-implement` appends a 2-3 line note here.)

- **Phase 1 — degraded forecast never reads "Clear"** (`testing-forecast-honesty`, 2026-10-08): a go-shaped night with any dark-window hour missing now reads marginal / No forecast, the mapper rejects cloud or humidity outside 0-100, and `getForecast` keeps a usable saved copy (as `fallback`) when a 200 is not a complete series (−24 h … +96 h around now). Tests span all four layers in §6.1; the keep-copy cases were red before the service fix.
- **Phase 2 — night and date boundaries** (`testing-night-and-date-boundaries`, 2026-10-08): the engine's night and rollover decisions, Tonight's date, strip, Session plan and offline hand-over, and the log form's night (extracted as pure `logFormNights`, behaviour unchanged) are pinned on DST and month-end nights for 4 sites in 5 runner zones, with USNO civil dawn as the oracle. A static guard now fails the suite if any non-test source reads the runner's zone. Break checks (rollover altitude, local getter, plan sort, hand-over altitude, default night) each turned the suites red and were reverted; see §6.2 for the how-to.
- **Phase 3 — ranking invariants and the calibration oracle** (`testing-ranking-invariants-and-calibration-oracle`, 2026-10-09): never-impossible targets are proven over seeded generated sites, nights, skies and telescopes on the engine's lists and on Session plan rows (rows carry only axis fractions, so the test rebuilds the axis from `sunEvents` / `observingNight`), with altitude recomputed from astronomy-engine by other roads (the sun is a deliberate copy of the engine's geometric sun) and the PRD's own threshold table; the no-darkness gate is guarded twice in production (`verdict()` and `cardPasses`), so only removing both turns it red. The PRD ranking rules are relations over the full catalogue, and the top 5 of each calibration night must share at least 3 objects with a committed, source-cited beginner reference, which replaced an order literal copied from engine output (the 2026-10-10 case is now a set check against source AF). Weight retune A (duration 0.10, moon 0.30, brightness 0.10, sky 0.50) is a known green retune for the calibration oracle, which rightly tolerates it, but not for the 2026-10-10 AF set check, which is stricter than the k = 3 oracle: retune A changes that night's top-5 membership, so only a reorder within AF's fall picks passes the AF check. The spot-check of the reference corrected one source key toward its page (Telescope Advisor gives M42 "Nov–Mar", so it no longer counts for April). Break checks (window widened by a sample, Bortle ≤ 4 threshold, log-penalty rating, bar on `rankScore`, washed-out branch, weight retune B, negative Messier bonus) each turned their suite red and were reverted; see §6.3 for the how-to.
- **Phase 4 — access and entitlement boundary** (`testing-access-and-entitlement-boundary`, 2026-10-09): a structural suite reads the catalogs and fails on any unclassified `public` table, a per-user table without RLS or its four policies, or a definer, `search_path`-less or anon-executable function; isolation now covers anon writes and pins cross-user inserts and hand-overs to `42501`; `no-console` is an error in all of `src`, proven per file by `no-console-guard.test.ts`, and the smoke test pins the invalid-latitude redirects to `errors.site.latitudeRange` with no `95` in them. Break checks (table with RLS off, UPDATE policy without `with check`, definer function, `console.log` in `score.ts`, an unlisted disable, a gear-only `files` list) each turned red and were reverted. The full-plan HTTP refusal follows the §6.4 recipe with S-03's first route.

## 7. What We Deliberately Don't Test

- **More e2e breadth** — browser specs stay on the few journeys that need a browser; anything a unit or db test can catch is tested there. Re-evaluate if a regression reaches production that only a browser could have caught. (Source: Phase 2 interview Q5.)
- **Layout and pixel assertions on Nightfall views** — checked by screenshot during review, apart from the phone first screen already pinned. Re-evaluate if a theme or phone regression ships twice. (Source: archived slice plans, user preference for modest tests.)
- **Provider and platform outages themselves** — observability, not tests; the degrade behaviour is tested under Risk #1.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-07
- Stack versions last verified: 2026-10-07
- AI-native tool references last verified: 2026-10-07

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
