# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-07

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
| 2 | The verdict, session plan or log prefill lands on the wrong night or shows the wrong time: the "tonight" rollover, the 25-hour DST night of 25 Oct 2026, ordering across midnight, a month boundary, or the site's time zone versus the server's | High | High | interview Q2 · PRD NFR (site time zone, DST, 25 Oct 2026) · archive `2026-09-30-planets-on-tonight` (morning planet prefilled the next night), `2026-09-27-seven-night-site-planner` (DST night), `2026-10-03-verdict-check` (month-boundary night) · hot-spot dir `src/lib/tonight` (133) |
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
| #1 | With a truncated, stale, partly missing or absent forecast the sky reads marginal, "no weather data" or "last forecast, N hours old", never "Clear"; moon, twilight and altitude results stay usable; no error page | "No cloud data for an hour means no cloud" and "a 200 from the provider means a usable series" | the forecast fetch, the KV cache and its age, how the series is cut to the dark window per night, which nights 1-3 can lack hours | unit (verdict over crafted series) + integration (forecast loading with the in-memory cache and a fake HTTP edge) | only complete series in tests; expected verdict copied from the verdict code; mocking the verdict to test the loader |
| #2 | For a fixed instant and site, the same "tonight", dark window and plan order come out whatever zone the runner is in, across the 25-hour 24/25 Oct night, the minutes either side of the rollover, and a 31 Oct / 1 Nov night | "Pinned UTC dates in existing tests cover the edges" | where "tonight" and the observing night are decided, which zones and instants tests pin today, where the log prefill takes its date | unit, table-driven over zones and edge instants | tests that pass only in the runner's own time zone; expected night derived with the same helper under test |
| #3 | Across many generated sites, nights, latitudes and telescopes, no ranked target, planet, Moon entry or plan row falls outside its window or under the site's minimum altitude | "The fixture nights in the suite are representative" | the window rule per target kind, how the session plan places targets, which latitudes and seasons tests cover | unit property tests over a seeded generator | asserting only the top 5 of a few fixed nights; generator that reuses engine output as its own expectation |
| #4 | A retune that breaks a PRD invariant or the independent reference cross-check fails the suite, and regenerating the snapshot cannot turn it green | "The calibration snapshot is an oracle" | how the calibration snapshot is produced and refreshed, which reference nights and tools (Stellarium, Skyfield) exist, which invariants have tests | unit: invariant properties + independent reference fixture | snapshot regenerated from the implementation (oracle problem); brittle exact order where the PRD only fixes a rule |
| #5 | User B cannot read, update or delete user A's rows or call A's RPCs; a user cannot change their own plan; a free account is refused by the server, not only hidden in the UI, on every full-plan route | "RLS on the table means every column is safe" and "a hidden button means a refused request" | per-operation policies and column grants, the plan attribute and how the operator sets it, how routes check the plan | db integration (existing isolation suite) + route-level check | asserting "0 rows affected" without a positive control; testing gating through the UI only |
| #6 | Every module that reads site records or coordinates sits under the no-console guard, and no redirect, URL or `?error=` carries a coordinate value | "The lint file list is complete" | which modules and routes handle coordinates, which URLs and redirect keys exist, the current lint scope | static gate (lint-scope check) + unit on redirect keys | grepping for the literal "lat"; a check that has to be updated by hand for each new module |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Forecast honesty | Prove a partial, stale or missing forecast never yields a confident "Clear" and never blanks Tonight | #1 | unit + integration | change opened | testing-forecast-honesty |
| 2 | Night and date boundaries | Prove the right night and times in every zone across DST, the rollover, midnight and month ends | #2 | unit | not started | — |
| 3 | Ranking invariants and calibration oracle | Prove no impossible target is listed and a retune cannot pass by regenerating its own expectations | #3, #4 | unit (property + reference fixture) | not started | — |
| 4 | Access and entitlement boundary | Prove isolation and the plan are enforced on the server and coordinates stay private | #5, #6 | db integration + static gate | not started | — |
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
| lint + `astro check` | pre-commit (lint-staged) + CI `ci` | required | type drift, coordinate logging on guarded paths |
| unit (Vitest) | CI `ci` | required | engine, verdict, date and copy regressions |
| db isolation suite | CI `smoke` | required | cross-user access through PostgREST/RLS |
| generated types up to date | CI `smoke` | required | schema drift from migrations |
| smoke + e2e on preview | CI `smoke` | required | broken critical journeys |
| forecast degrade cases | CI `ci` | required after §3 Phase 1 | confident verdict on partial or missing data |
| reference cross-check + invariant properties | CI `ci` | required after §3 Phase 3 | retunes that break invariants or the independent reference |
| plan enforcement + coordinate lint-scope check | CI `ci` / `smoke` | required after §3 Phase 4 | self-granted plan, UI-only gating, unguarded coordinate modules |
| e2e flake visibility (a retried pass is reported) | CI `smoke` | required after §3 Phase 5 | flakes hidden by `retries: 1` |
| post-edit agent hook (engine/tonight tests) | local agent loop | recommended after §3 Phase 5 | regressions at edit time |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a verdict test for degraded forecast data

- TBD — see §3 Phase 1 (partial / stale / missing forecast never reads "Clear").

### 6.2 Adding a test that crosses a night or date boundary

- TBD — see §3 Phase 2 (zone-independent night, DST, rollover, month end).

### 6.3 Adding a ranking invariant or reference cross-check

- TBD — see §3 Phase 3 (impossible-target properties, independent oracle for retunes).

### 6.4 Adding a per-user table, RPC or full-plan route

- TBD — see §3 Phase 4 (cross-user access with a positive control, server-side plan refusal).

### 6.5 Adding an e2e spec

- TBD — see §3 Phase 5. Until then: only for a journey that needs the browser (service worker, hydration, layout at phone width), following `context/foundation/lessons.md` for offline.

### 6.6 Per-rollout-phase notes

(After each phase lands, `/10x-implement` appends a 2-3 line note here.)

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
