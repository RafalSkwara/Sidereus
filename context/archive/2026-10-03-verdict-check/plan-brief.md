# Verdict check — Plan Brief

> Full plan: `context/changes/verdict-check/plan.md`
> Research: `context/changes/verdict-check/research.md`

## What & Why

Roadmap M-2 S-07 (#71). The user tells Sidereus whether the sky matched what Tonight promised, and sees how often it did. This is the one source of real evidence the milestone can collect without a telescope. It feeds the uncalibrated cloud thresholds (PRD tunable #2), and it keeps the direction of each miss, because a false "Clear" costs more than a false "Cloudy".

## Starting Point

Tonight computes a sky headline on every render and stores nothing (`build.ts:435-705`). Nothing in the app writes to the database during a GET. The Tonight island already runs one post-response task, the KV forecast write, through `defer` → `waitUntil`.

## Desired End State

Each signed-in Tonight view records the night's headline per (user, site, night). The next day a card on Tonight asks "How was the sky last night at Home? We said: Clear", with Clear / Partly clear / Cloudy and Skip. A new Sky checks page (`/log/sky`) lists every recorded night with answer buttons. It has a tally at the top: "7 of 9 nights matched · 1 too optimistic · 1 too pessimistic", plus Clear 5 of 6, Partly clear 1 of 2, Cloudy 1 of 1.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the question appears | Tonight card + new Sky checks page under Log | Covers nights with no observations (the log is mostly empty without a telescope) and gives the tally a home | Plan (user) |
| How long the card stays | Latest unanswered night from the last **2** nights, with a stored Skip | Catches a missed morning without nagging; older nights stay answerable on the page | Plan (user) |
| Answer form | The three sky words as buttons | Neutral, so it doesn't lead toward "yes", and maps 1:1 onto the headline | Plan (user) |
| Tally content | Matches + direction + per-word breakdown | Shows whether Sidereus errs optimistic, the PRD's worse failure | Plan (user) |
| Which verdict counts | The last shown before the dark window starts; if first seen after dark, that first view; frozen once answered | Roadmap candidate; one SQL rule using the DB clock | Plan (delegated) |
| Match rule | Clear, Clear but damp and Clear (old forecast) claim "clear"; Partly clear claims "partly"; Cloudy claims "cloudy"; No forecast / No dark window are not checked | Compares against the sky words shown (roadmap note, 2026-10-02) | Research + Plan (delegated) |
| Which nights are recorded | Night 1 only (Tonight's own night); never no-dark-window nights | The strip's nights 2-3 become night 1 later anyway | Plan (delegated) |
| Data model | `sky_checks` with `unique (user_id, site_id, night)`; site FK `on delete set null` + name snapshot | Supports PostgREST upsert; rows outlive a deleted site like observations | Research + Plan (delegated) |
| Write path | `security invoker` RPC `record_sky_verdict`, called fire-and-forget after the response | Idempotent under island preload/reloads; never delays or breaks Tonight | Plan (delegated) |
| Tally computation | SQL `sky_check_tally()` grouping + a pure `tallyOf` | Avoids the 1000-row cap (lessons.md); the match rule stays unit-testable | Plan (delegated) |
| Plan review fixes | F1–F6 applied (hide and refuse rows before dark, parallel open-checks read, named conflict constraint, e2e credentials, hoisted `defer`, test list and plain-form note) | `reviews/plan-review.md` | Plan review (delegated) |
| Card placement | Below the Sky and Moon cards, above the sections | The main answer stays on top; the question is secondary | Plan (delegated; visual check on the PR) |

## Scope

**In scope:**
- the table and RPCs, with RLS and DB tests;
- recording on Tonight;
- the answer/skip route;
- the Tonight card;
- `/log/sky` with the tally and paging, linked from the log;
- EN/PL copy and the dark/light/red themes;
- an e2e spec and a smoke step.

**Out of scope:** recording nights 2-3, asking about No forecast / No dark window nights, changing the verdict or its thresholds, per-site or per-period tallies and charts, a question inside log night groups, offline answering, and anti-tamper.

## Architecture / Approach

```
TonightContent (server island, GET)
  ├─ loadTonight({withSkyChecks}) → Promise.all[…, openRecent(night ≥ UTC today−3)]
  │     → view {siteId, date, headline.id, darkStart}, openSkyChecks
  ├─ defer(waitUntil) → skyCheckStore.record → rpc record_sky_verdict  (upsert, DB-clock rule)
  └─ pendingCheck(openSkyChecks, site, date-2 … date-1) → SkyCheckCard (plain Astro POST form)
POST /api/log/sky/[id] {action, from} → answer | skip → redirect ?skyChecked=1
/log/sky → rpc sky_check_tally → tallyOf (pure) + paged list (rows whose dark window has started)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data layer and tally | Migration, RPCs, types, DB tests, store, pure claim/tally | Getting the conflict rule right with nullable `site_id` |
| 2. Record on Tonight | `headline.id` + `darkStart` on the view; fire-and-forget recording | First write during a GET; must never break the render |
| 3. Answer on Tonight | Route, card, notice, copy, smoke step | Touches the shared loader (opt-in flag keeps all-objects unchanged) |
| 4. Sky checks page | `/log/sky`, tally, log link, e2e (with Supabase env in CI), docs | e2e needs a seeded past night |

**Prerequisites:** local Supabase (Docker) for `test:db`, types and e2e; nothing blocks on the user.
**Estimated effort:** about 1–2 sessions across 4 phases.

## Open Risks & Assumptions

- The data only accumulates once deployed. The tally is empty until the user has answered a few nights.
- A user who never opens Tonight before dark records only after-dark views. Those are still what they saw that evening.
- The verdict and its catalogue keys are unchanged. A future headline id needs a migration to widen the `headline` check.

## Success Criteria (Summary)

- The day after opening Tonight, the user is asked once, in the same words Tonight used, and the answer takes one tap.
- The Sky checks page shows every recorded night and a tally that separates optimistic from pessimistic misses.
- No Tonight render is slower or broken by the recording, and per-user isolation holds (`npm run test:db`).
