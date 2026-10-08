# Test rollout Phase 1: Forecast honesty — Plan Brief

> Full plan: `context/changes/testing-forecast-honesty/plan.md`
> Research: `context/changes/testing-forecast-honesty/research.md`
> Plan review: `context/changes/testing-forecast-honesty/reviews/plan-review.md`

## What & Why

Risk #1 of the test plan: Tonight must never show a confident "Clear" sky when the forecast is partial, stale or missing, because a false go wastes a setup under cloud (PRD guardrails, `prd.md:95-101`). This phase proves that with tests at the layers the existing engine tests don't reach. It also fixes two real gaps:

- a 200 with an empty, all-null or short forecast overwrites the last good saved forecast;
- a missing dark-window hour can hide a humid hour, so a night that should be capped at marginal reads go.

## Starting Point

`verdict.ts` already handles most degraded input, with unit tests over crafted series:

- a missing or non-spanning forecast becomes marginal / "No forecast";
- a missing hour breaks a clear run;
- a saved copy is capped at marginal.

The gaps:

- **Humidity cap:** it only checks hours that are present.
- **Mapper and service:** they check shape only, so any parsed 200 replaces the stored copy and out-of-range values pass.
- **Untested:** a raw provider body going through the cache into the Tonight view, and the loader's no-error-page promise.

## Desired End State

New unit and integration suites show that all of the following leave Tonight at marginal or "No forecast", never level go:

- interior or edge nulls, a hidden humid hour;
- empty, all-null, short, malformed or out-of-range provider responses;
- outages with or without a saved copy;
- copies too old to reach night 3.

The Moon, dark window and targets are still shown, and nothing errors. An incomplete 200 no longer destroys a usable saved copy, including during a night in progress. The test plan records the corrected wording, a cookbook entry and a Phase 1 note.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| What "never Clear" means | Level never `go` and headline never the bare "Clear"; "Clear (old forecast)" is allowed | The PRD's own headline table sanctions "Clear (old forecast)" at marginal (`prd.md:315-322`) | Research |
| Hidden humid hour (review F1) | Any missing dark-window hour on a go-shaped night gives marginal / "No forecast" | Closes the only path where a gap raises the result, and reuses the existing reason and headline (no copy change, no migration) | Plan review (user) |
| Degenerate 200 | Red test + fix: an incomplete 200 with a usable stored copy serves the copy as fallback and leaves it in place | Keeps the PRD's "last successful forecast with its age" promise | Plan (user) |
| Complete-response rule | Present hours span `floor_hour(now) − 24 h` to `+ 96 h`; a stored copy wins only if it spans −24 h to +24 h | Covers a night in progress and verdict nights 1-3 of both builds, and every real response passes | Plan review F3 (user: apply all) |
| Out-of-range values | Cloud or humidity outside the inclusive range 0-100 makes the response invalid (it falls back) | A negative cloud would otherwise count as clear; exactly 100 is common and stays valid | Plan (delegated), review F7 |
| Loader seam | Optional `fetchFn` on `LoadTonightInput`, default `globalThis.fetch` | Mirrors `getForecast`, and avoids stubbing a global | Plan (delegated) |
| Oracle | PRD thresholds and headline table, agreed coverage rules, wide-margin series, and metamorphic properties; never values copied from `verdict.ts` | Test plan §1: expected values come from an independent source | Research / test plan |
| Phase count | Two phases (unit + verdict fix; integration + loader + docs) | The user judged three phases too granular | Plan (user) |
| Fallback age cap | None | Archive decision "whatever its age"; the PRD sets none | Research |

## Scope

**In scope:**
- `src/lib/forecast/degraded-forecast.test.ts` (new), with a seeded metamorphic property
- Range validation in `open-meteo.ts`
- The gap rule in `verdict.ts`, plus the one existing expectation it changes (`verdict.test.ts:113-119`)
- The keep-copy rule in `service.ts`, plus new and updated service cases
- `src/lib/tonight/forecast-honesty.test.ts` (new)
- An optional `fetchFn` in `load.ts`, plus `src/lib/tonight/load.test.ts` (new)
- `test-plan.md` §2 row #1, §6.1 and §6.6

**Out of scope:**
- Re-testing verdict rules that are already covered
- Threshold, headline or copy changes, and the `sky_checks` headline set
- A fallback age cap
- A negative cache
- Logging the dropped error causes (an observability-audit topic)
- E2E forecast modes
- Forecast age on the focused pages
- Test-plan §3 status

## Architecture / Approach

Cheapest layer first, test-first:

- **Phase 1** covers the pure mapper and verdict with real provider-shaped bodies (`openMeteoBody`). It drives two small production fixes red→green: the range check and the gap rule.
- **Phase 2** runs the real service over `memoryCache` + `fakeFetch` + a fixed `now` into the real `buildTonight`, so nothing below the fetch is mocked, and drives the keep-copy fix red→green.

Only the loader test mocks the gear stores, spreading their real exports, and it wraps `buildTonight` for the one failure case. There is one commit per phase, made only when it is green.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Provider body to verdict (unit) | Degraded-body suite, metamorphic property, range check, gap rule | The gap rule makes some nights read "No forecast" more often; real responses rarely null single hours |
| 2. Service, view and loader (integration) + docs | Keep-copy fix, view-level degraded states, loader no-error-page, test-plan update | Calendar arithmetic for aged copies; mitigated by margins of at least 12 h and the probed Warsaw windows |

**Prerequisites:**
- Branch `test/forecast-honesty` from main f1bb8bb.
- Run `nvm use` before every npm/npx command.
- Lint with `npx eslint . --ignore-pattern '.claude/**'`.

**Estimated effort:** about one to two sessions across two phases.

## Open Risks & Assumptions

- With a usable copy, a degenerate but reachable provider shows "Weather service unreachable — showing the forecast from {age} ago". This is accepted; the copy is unchanged.
- A persistently degenerate provider causes a refetch on every request until the copy's 7-day TTL expires, as during an outage today.
- That Open-Meteo sends nulls rather than shorter arrays is assumed, not verified against the live API. The tests cover both shapes.
- The keep-copy rule can prefer an older saved copy over a short fresh series. The result stays honest, capped at marginal.

## Success Criteria (Summary)

- No partial, stale, malformed or missing forecast reaches level go on nights 1-3. The user sees "No forecast", or "Clear (old forecast)" with its age, instead.
- A bad 200 no longer makes Tonight forget a good forecast it already had, even while a night is in progress.
- The Moon, dark window and targets render in every degraded case, and a build failure degrades to a message instead of a throw.
