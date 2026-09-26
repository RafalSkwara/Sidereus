# Log an Observation from the Ranking — Plan Brief

> Full plan: `context/changes/log-observation-from-ranking/plan.md`

## What & Why

Roadmap slice S-06 (PRD US-04, FR-016, FR-018, invariant 4; GitHub #11). A beginner marks a ranked object as observed and rates the attempt from 1 to 5. Later rankings then move objects they have seen down gently, rather than suggesting the same showpiece every night, and never move down an object they tried and could not make out (rated 1-2). This closes the learning loop the persona needs, and the "seen N times" tag keeps the demotion visible and explained.

## Starting Point

`/tonight` already renders a verdict and up to five ranked Messier objects from the pure engine (`rankObjects` in `src/lib/engine/ranking.ts`). There's no observation log yet. Every existing form follows the same pattern: a separate page, a React form, a POST route, and a `?error=<key>` redirect, backed by an RLS-protected table and an isolation test.

## Desired End State

Each ranked card has a "Mark observed" link to `/log/new`, with the night, site and telescope prefilled and editable and a required 1-5 rating. Saving returns to Tonight with "M13 logged." From then on, an object with an entry rated 3 or above ranks lower (0.15 subtracted, for ordering only) and shows "Seen N times – last 12 Sep 2026". An object with only 1-2 ratings ranks exactly as before. Everything is in English and Polish, uses theme tokens, and is isolated per user.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the log form lives | Separate `/log/new` page, back to Tonight | Same page + React form + POST pattern as all gear forms, no hydration inside the server island | Plan (user) |
| What "seen N times" counts | Only entries rated 3-5 | "Seen" stays truthful, and the tag appears exactly when an object is moved down | Plan (user) |
| Penalty vs quality bar | Penalty reorders only; bar and cleared count use the raw score | PRD: "pushed down gently rather than removed" | Plan (user) |
| Penalty shape | One flat 0.15 per object with any 3+ entry, not per entry | "Mildly"; stacking would bury favourites the user revisits | Plan (delegated) |
| Seen count unit | Distinct nights with a 3+ entry; duplicate rows allowed | A resubmit never inflates the tag; S-07 deletes duplicates | Plan review F1 |
| Which entries count | Any site or telescope, night on or before the ranked night | "Seen" is about the object; a same-night log takes effect at once | Plan (delegated) |
| Future nights | Rejected on the server against the chosen site's current observing night | Stops entries that are confidently wrong from feeding the penalty | Plan (delegated) |
| Log fails to load | Unpenalised ranking plus a notice, never an error page | Matches the existing `load()` degrade pattern | Plan (delegated) |
| Gear deletion readiness | Nullable FKs `on delete set null` plus name snapshots now | S-07 (FR-021) then needs no migration | Plan (delegated) |
| Rating input | Five radios, captions at both ends, no default | A conscious choice every time | Plan (delegated) |

## Scope

**In scope:**
- `observations` table with RLS, including a guard that referenced gear belongs to the caller, plus types, schema, store and isolation tests
- `LOG_PENALTY` / `LOG_PENALTY_MIN_RATING` parameters, a pure `seenSummaries`, and the order-only penalty in `rankObjects`
- `/log/new` page, `ObservationForm` island, `POST /api/log`, protected routes
- Tonight: load the log, the "Seen N times" tag, the "Mark observed" link, the "logged" notice, and the log-failure notice
- EN + PL copy; unit, DB and Playwright tests

**Out of scope:** viewing, editing and deleting entries, and manual entry (S-07), the UI for entries whose gear was deleted (S-07), the telescope selector (S-08), calibrating the penalty, non-Messier objects, notes.

## Architecture / Approach

The build runs bottom-up. **Storage** (migration → types → zod schema → store; the store reads gear through RLS to prove ownership, snapshot names and check the night against the site's time zone). Then the **pure engine rule** (log entries → per-object seen summaries → the penalised sort key, with the bar still on the raw total). Then the **write path** (`/log/new` → `POST /api/log` → `/tonight?logged=n`). Then the **read path** (TonightContent loads the log in parallel with gear, buildTonight passes summaries into the ranking and words the tag, and the shell renders the notice, because `Astro.url` inside a server island is not the page URL).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Observation log storage | Table, RLS, store, schema, isolation tests | A foreign key check skips RLS, so the policy must guard gear ownership |
| 2. Log penalty in the engine | `seenSummaries`, order-only penalty, fixture tests | Splitting bar and order without changing reasons or determinism |
| 3. Mark-observed form and route | `/log/new`, form island, `POST /api/log` | Keeping redirect URLs value-safe |
| 4. Tonight shows and feeds the log | Tag, link, notices, e2e loop | Reading `?logged=` in the shell, not the server island |

**Prerequisites:** S-02 and F-03 done (they are); local Supabase for `test:db`, e2e and manual checks.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- The 0.15 penalty is uncalibrated (Open Question 6). If it proves too weak or too strong, tuning it is a one-line parameter change.
- The e2e spec runs on the real clock, so it asserts the notice plus "tag present or object pushed out of the top 5", never a position; ordering is pinned by engine unit tests.
- The hosted Supabase gets the table only after merge, so all testing runs on the local stack.

## Success Criteria (Summary)

- A user logs a ranked object in a few taps, and Tonight confirms the save.
- An object rated 3+ is moved down and tagged "Seen N times – last …"; a 1-2 rating changes nothing.
- No user can reach another user's log, and entries outlive the deletion of their gear.
