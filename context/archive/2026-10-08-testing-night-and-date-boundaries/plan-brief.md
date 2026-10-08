# Test rollout Phase 2: night and date boundaries — Plan Brief

> Full plan: `context/changes/testing-night-and-date-boundaries/plan.md`
> Research: `context/changes/testing-night-and-date-boundaries/research.md`

## What & Why

Risk #2 in the test plan: the verdict, Session plan or log could land on the wrong night or show the wrong time. The edges are:

- the "tonight" rollover at civil dawn;
- the 25-hour night of 24/25 Oct 2026, which is two weeks away;
- the 23-hour spring night;
- the 31 Oct / 1 Nov night, which in Los Angeles is both a month end and a 25-hour night;
- sites far from UTC.

This phase proves those edges with unit tests whose expectations don't come from the code under test.

## Starting Point

No production code reads the runner's (server's) time zone. Research checked with a grep, with an engine probe under 4 zones and with the full suite under 6 zones.

Existing tests pin Warsaw's autumn change well. They leave untested:

- the −6° rollover boundary;
- the spring night;
- non-Warsaw sites;
- month-end nights;
- Session plan order and labels on the DST night;
- the log form's default night, which is inline in `log/new.astro`.

## Desired End State

Three new unit suites run every case under 5 runner zones, switched in-process. Expectations come only from hand-written calendar literals, USNO's published civil-dawn and sunrise times, and hand-written UTC offsets. The log form's night logic is a tested pure function with unchanged behaviour. A static scan fails the suite if any source under `src/` starts reading the runner's zone. Test plan §6.2 explains how to add the next boundary test.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Main proof | Site-zone edges, with runner zones as a cheap guard | No production path reads the runner zone; the gaps are site-zone edges | Research + test-plan backport |
| Rollover oracle | USNO API civil dawn (±5 min either side, ±2 min for the engine's end) | Independent of astronomy-engine; matches the engine within 0.5 min on all 5 nights | Plan (delegated) |
| Runner zones | In-process `process.env.TZ` over UTC, Warsaw, Los Angeles, Kiritimati, Kolkata | Node 24 switches zones at runtime; no CI matrix needed | Research probe, Plan (delegated) |
| Edge sites | Warsaw (autumn + spring), Los Angeles 31 Oct, Auckland, Kiritimati | Covers 25 h, 23 h, a month end, zones +13 and +14, both hemispheres | Plan (delegated) |
| Log form | Extract `logFormNights` into `src/lib/observations/log-night.ts`, with `maxNight` delegating to `latestNightBound`; behaviour unchanged | The page code is untestable, and the edit page already uses the store helper | Plan (delegated), plan review F4 |
| `maxNight` multi-site looseness | Document with a test; don't change | The form lets the user switch site; the server stays correct | Research, Plan (delegated) |
| Static guard | New scan of all `src/`, separate from `purity.test.ts` | Purity also bans `new Date()`, which pages need; the guard reaches pages and islands | Research, Plan (delegated) |
| Questions | 0 beyond complexity and phase approval | Non-UI choices are delegated per the user's preference | User |
| Zone-switch proof | Each runner-zone block asserts the switch took effect; break checks run under `TZ=UTC` | A switch that silently did nothing would otherwise pass on a Warsaw dev machine | Plan review F2 |
| Plan review | Apply all 10 findings | All LOW impact and probe-backed | User |

## Scope

**In scope:**
- An engine night-boundary suite, plus a runner-zone helper and USNO reference values in the engine fixtures.
- A Tonight consumers suite: date, log links, strip, plan order and labels, offline hand-over.
- The `logFormNights` extraction and its tests.
- The runner-zone static guard with a positive control.
- Test plan §6.2 and §6.6.

**Out of scope:**
- Changing the `maxNight` hint or `needsNextCopy`.
- New Stellarium captures.
- A CI `TZ` matrix.
- Widening `purity.test.ts`.
- e2e or db tests.
- Retuning the rollover.

## Architecture / Approach

Tests follow the decision flow. They start at the engine's two decision functions (`observingNightDateFor`, `tonightDateFor`, plus `darkWindow`), move to the consumers that key on them (`buildTonight`: date, links, strip, Session plan, `validUntil`; and the log form), and end with a source scan that keeps the whole tree free of runner-zone reads. Each suite wraps its table in `describe.each(RUNNER_ZONES)`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Engine night edges in every zone | Spans, −6° end vs USNO, ±5 min rollover, wall-clock traps on 5 nights × 5 runner zones | A USNO value mistyped: each row has a comment with its local time, and the break checks prove it can fail |
| 2. Consumers and the log form's night | View date, `logHref` night, strip across 1 Nov; plan order and CEST/CET labels on 24/25 Oct; offline hand-over; `logFormNights` | Vacuous assertions: the plan requires rows before and after midnight and after the clock change |
| 3. Static guard and cookbook | Runner-zone scan (including zone-less ISO strings) with a positive control; §6.2 and §6.6 | False positives: narrow the matcher, never allowlist files |

**Prerequisites:** branch `feat/testing-night-and-date-boundaries` (pushed); `nvm use`; no Supabase needed for automated checks.
**Estimated effort:** about one session across 3 small phases, finishing well before 24 Oct.

## Open Risks & Assumptions

- USNO values are minute-rounded and assume sea level and standard refraction. The ±2 min and ±5 min tolerances absorb the 0.5 min seen at plan time.
- CI's zone is assumed to be UTC. The in-process table makes that assumption irrelevant to the new suites.
- The 1 h `needsNextCopy` dawn window stays unverified (out of scope; research notes it).

## Success Criteria (Summary)

- A wrong rollover threshold, a runner-zone date read or a label-order plan turns the suite red, and the break checks demonstrate it.
- The DST and month-end nights show the right date, links, order and times in every runner zone.
- The log form never defaults to a night the server would reject.
