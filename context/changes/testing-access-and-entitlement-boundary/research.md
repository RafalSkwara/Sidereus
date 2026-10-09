---
date: 2026-10-09T16:36:41+02:00
researcher: Claude (Opus 5.5) with read-only workers (Opus: DB isolation; Opus: coordinate privacy, stopped before reporting; Sonnet: history)
git_commit: 6d65ac2
branch: feat/testing-access-and-entitlement-boundary
repository: Sidereus
topic: "Ground rollout Phase 4 of context/foundation/test-plan.md: access and entitlement boundary (Risks #5, #6)"
tags: [research, testing, security, rls, postgrest, rpc, privacy, lint]
status: partial
last_updated: 2026-10-09
last_updated_by: Claude (Opus 5.5)
---

# Research: access and entitlement boundary (test rollout Phase 4, Risks #5 and #6)

**Date**: 2026-10-09T16:36:41+02:00
**Researcher**: Claude (Opus 5.5) with three read-only workers.

- Risk #5 (DB isolation, Opus) and the history sweep (Sonnet) completed.
- The Risk #6 code sweep (Opus) was **stopped unfinished** when the session wrapped up, so its findings are missing (see Open Questions).

**Git Commit**: 6d65ac2 (product code identical to `main` baa1b1a plus the archive branch; only docs differ)
**Branch**: feat/testing-access-and-entitlement-boundary (cut from `chore/archive-testing-ranking-invariants-and-calibration-oracle`, PR #143)
**Repository**: Sidereus

## Research Question

Ground Risks #5 and #6 of `context/foundation/test-plan.md` §2. Verify, rather than accept, the Risk Response Guidance.

- **#5:** Prove three things on the server: user B cannot read or change user A's rows or call A's RPCs; a user cannot change their own plan; a free account is refused on every full-plan route.
  - Challenge: "RLS on the table means every column is safe" and "a hidden button means a refused request".
  - Avoid: "0 rows affected" without a positive control, and UI-only gating tests.
- **#6:** Prove that every module that reads site records or coordinates is under the no-console guard, and that no redirect, URL or `?error=` carries a coordinate.
  - Challenge: "the lint file list is complete".
  - Avoid: grepping for "lat", and a check that has to be updated by hand for each new module.

## Summary

- **Account plans don't exist yet, so the plan half of Risk #5 is speculative today.** There is no plan column, table, claim, route check or operator command. A grep over `src`, `supabase`, `tests` and `scripts` for entitlement / tier / paid / premium / `"free"` finds only the Moon-phase `"full"` (`src/lib/engine/parameters.ts:273`).
  - Roadmap F-01 `account-plans` is `ready`, not started (`context/foundation/roadmap.md:45, 80-96`, GitHub #121).
  - No full-plan route exists: S-03, S-04 and S-08 are `proposed`.
  - "A user cannot change their own plan" and "a free account is refused on every full-plan route" have no code to test. They belong with F-01, or to a later rollout step after it.
- **Cross-user isolation holds today and is mostly tested.** These findings come from reading the code; nothing was run against a database.
  - All 5 per-user tables have RLS and four per-operation policies `to authenticated`: `sites`, `telescopes`, `eyepieces`, `observations`, `sky_checks`.
  - Every UPDATE policy has a WITH CHECK on `auth.uid() = user_id`, so a row can't be handed to another user (`20260924120000_sites_and_gear.sql:25-42, 57-74, 89-106`; `20260926200000_observations.sql:30-63`; `20261003120000_sky_checks.sql:41-68`).
  - All 3 RPCs are SECURITY INVOKER with `search_path = ''`, take no user-id parameter, and are revoked from `public`/`anon`: `complete_onboarding`, `record_sky_verdict`, `sky_check_tally` (`20260926120000_complete_onboarding.sql:27-67`, `20261003120000_sky_checks.sql:73-130`).
  - No service-role key is used anywhere in `src`, `supabase`, `scripts`, `tests` or `.github`.
  - `tests/db/isolation.test.ts:141-227` has a positive control per table and operation (the plan-review lesson from `context/archive/2026-09-24-sites-and-gear-management/plan.md:47`).
- **The challenge "RLS means every column is safe" is justified.** No migration has a column-level GRANT/REVOKE; the only grants are function EXECUTE grants. Inside their own rows, owners can write fields the app treats as server-decided:
  - **`sky_checks`:** a direct PATCH or POST can set `headline`, `dark_start`, `shown_at`, `answered_at`, or change an answered or frozen night. The update policy checks only ownership (`20261003120000_sky_checks.sql:56-64`). The freeze and answer rules live only in the RPC (`:105`) and in `src/lib/sky-checks/store.ts:98-101, 117-121`.
  - **`record_sky_verdict`:** takes `headline` and `dark_start` from the caller. "Decides with the DB clock" holds only against a `dark_start` the client chose, so a far-future `dark_start` keeps the row overwritable.
  - **`observations`:** a direct write can set a future `night`, arbitrary snapshot names or `created_at`. The rules are app-only (`src/lib/observations/store.ts:209-211`).
  - **All three are self-only.** They affect only the caller's own tally or "seen" ranking. The verdict-check change put anti-tamper out of scope on purpose: "A user can only alter their own rows, which affects only their own tally" (`context/archive/2026-10-03-verdict-check/plan.md:55`).
  - **The structural lesson for F-01:** any future server-owned column on an existing per-user table, such as a `plan` column, would be writable by its owner by default.
- **Test gaps on the isolation side:**
  - anon INSERT/UPDATE/DELETE are not tested; only anon SELECT is (`tests/db/isolation.test.ts`).
  - Cross-user negative inserts and updates assert only "an error", not code `42501` (`:196, :214`).
  - No test pins the per-table policy set or "RLS enabled" structurally, so a forgotten table would pass silently.
- **Risk #6 is partially grounded from the archive.**
  - The no-console error scope is still a hand-maintained glob list (`eslint.config.js:84-109`). It covers gear, forecast, tonight, onboarding, observations, `api/log`, `pages/log`, `components/tonight`, sky-checks, location, offline and sky-view. This is exactly the risk's "must challenge".
  - The PRD names three sanctioned third-party carriers of coordinates: the forecast lookup, geocoding, and the map tiles of "Pick from map" (`context/foundation/prd.md:81-88, 498-503`).
  - **Not done:** the code sweep of which coordinate-touching modules sit outside that list, the redirect/URL audit, and the feasibility of an automatic module-graph check.

## Detailed Findings

### Risk #5: per-table and per-RPC state

| Object | Policies | Column risk | Tests | Gap |
| --- | --- | --- | --- | --- |
| `sites`, `telescopes`, `eyepieces` | S/I/U/D `to authenticated`; UPDATE has USING + WITH CHECK; `user_id default auth.uid()` (`20260924120000_sites_and_gear.sql:12, 48, 80`) | No column grants: `id` and `created_at` are owner-writable; changing `user_id` is blocked | `isolation.test.ts:141-227` (owner positive control, B select/update/delete/insert-as-A, hand-over, anon select) | anon I/U/D untested; negative writes not pinned to 42501 |
| `observations` | S/I/U/D; INSERT/UPDATE WITH CHECK also requires own `site_id`/`telescope_id` (`20260926200000_observations.sql:40-45, 53-58`) | owner can PATCH `night` (future), `rating`, snapshot names, `created_at` | isolation `TABLES` (`:79-94`); `observations.test.ts:103-139` (gear guard with positive control) | app-only rules never tested against a direct PATCH |
| `sky_checks` | S/I/U/D with a site guard on I/U (`20261003120000_sky_checks.sql:41-68`) | server-decided fields writable directly (self-only) | isolation (`:95-108`, changes `answer`); `sky-checks.test.ts:123-163` (cross-site RPC, insert at A's site, repoint, anon RPC) | no direct-PATCH tamper test; acceptance is the archived decision |
| `complete_onboarding` | INVOKER, `search_path=''`, revoked from public/anon (`:61-67`) | none found | `onboarding.test.ts:96-165` (incl. anon 42501 at `:162`) | — |
| `record_sky_verdict` | INVOKER, reads the site under RLS (`:87-90`), upsert on (user_id, site_id, night) | caller-chosen `headline`/`dark_start` | `sky-checks.test.ts:95-163` | caller-chosen `dark_start` untested; a binding rule would be a design change |
| `sky_check_tally` | INVOKER, RLS-scoped, revoked from anon (`:115-130`) | — | `sky-checks.test.ts:277-301`, anon `:161` | — |

Routes: every write route uses the request-scoped JWT client (`context.locals.supabase`), and the stores filter by `id` and rely on RLS (`src/lib/gear/store.ts:17`). `/api/gear`, `/api/onboarding` and `/api/log` are gated (`src/lib/protected-routes.ts:8-13`). `graphql_public` is exposed (`supabase/config.toml:13`) behind the same RLS.

### Risk #5: response guidance, verified and corrected

- **"Prove B cannot read or change A's rows or call A's RPCs": verified.** It is largely tested already. The cheapest additions in the tests/db suite:
  - anon I/U/D cases per `TABLES` entry;
  - pin cross-user writes to `42501` while keeping the owner positive control;
  - a structural query on `pg_policies` / `pg_class.relrowsecurity` (and `information_schema.column_privileges`) asserting that every public table has RLS on and the four per-operation policies. This catches a forgotten table without hand upkeep.
- **"RLS on the table means every column is safe": confirmed as a real gap.** It matters for F-01: a `plan` column on a user-writable table would be owner-writable. Two candidates for the plan:
  - pin today's self-only writes as **accepted** (documented, per `verdict-check/plan.md:55`);
  - or harden `sky_checks` with column grants or a trigger. That is a product change; the owner decides.
- **"A user cannot change their own plan" / "free refused on every full-plan route": speculative today.** They need F-01. When it lands, the layers are:
  - tests/db: the owner can't write the plan attribute, with a positive control on a permitted column;
  - a script test for the operator command against local Supabase;
  - a route-level HTTP check for the server refusal, never through the UI.

### Risk #6: what is known (partial)

- **Lint scope:** `eslint.config.js:84-109` (`gearConfig.files`). The list grew by hand after the S-06 impl review F2 (`context/archive/2026-09-26-log-observation-from-ranking/reviews/impl-review.md:59-67`), which found `src/lib/observations/**`, `src/pages/api/log/**` and `src/pages/log/**` uncovered. The rule is in `context/foundation/lessons.md:5-10`.
- **Sanctioned carriers (PRD):**
  - Forecast lookup: Open-Meteo. Coordinates go only into that request, KV keys use the site id (`context/archive/2026-09-25-tonight-verdict-and-ranking/plan.md:65`), and `observability.redact_query_string: true` (`:260`).
  - Geocoding: called by the browser directly, results rounded to 2 decimals (`context/archive/2026-09-26-first-run-onboarding/plan-brief.md:35, 90`).
  - Map tiles after the "Pick from map" click; tile URLs locate the pick to tile precision (`context/archive/2026-10-07-site-pick-from-map/reviews/plan-review.md:77-85`).
- **Error redirects:** `?error=` values are fixed catalogue keys and DB error details never reach redirects (`context/archive/2026-09-24-sites-and-gear-management/plan.md:48, 316`; CLAUDE.md "Error-response shape").
- **Offline copies** carry no coordinates in metadata, cache keys or URLs (`context/archive/2026-10-05-offline-night-plan/plan.md:37, 190`).
- **Not established (the stopped worker's scope):**
  - the full set of modules that receive `SiteRecord` / `Site` / coordinates, traced by type and import, and which of them sit outside the lint scope;
  - an audit of every redirect and URL construction;
  - existing tests that pin redirect keys;
  - whether a test can derive the coordinate-touching module set automatically (TS import graph from `src/lib/gear/store.ts` / engine `Site`) and assert it ⊆ the lint error scope, or whether the lint default should flip to error repo-wide with listed exceptions.

## Code References

- `supabase/migrations/20260924120000_sites_and_gear.sql:12-106`: gear tables, policies, defaults.
- `supabase/migrations/20260926200000_observations.sql:30-63`: observations policies with the gear ownership guard.
- `supabase/migrations/20261003120000_sky_checks.sql:41-130`: sky_checks policies and the two RPCs, grants.
- `supabase/migrations/20260926120000_complete_onboarding.sql:27-67`: onboarding RPC.
- `tests/db/isolation.test.ts:79-227`: `TABLES` and positive-control isolation cases.
- `tests/db/sky-checks.test.ts:95-301`, `tests/db/onboarding.test.ts:96-165`, `tests/db/observations.test.ts:103-139`.
- `src/lib/sky-checks/store.ts:98-121`, `src/lib/observations/store.ts:209-211`: app-only rules.
- `src/lib/protected-routes.ts:8-13`; `eslint.config.js:84-109`.
- `context/foundation/prd.md:81-88, 461-462, 498-505, 591-618, 657`; `context/foundation/roadmap.md:45, 80-96`.

## Architecture Insights

- Isolation is RLS-only by design: the stores filter by id and trust RLS, and there is no service role in the app. The tests/db suite is the PRD's "verified outside the UI" evidence.
- Column-level privileges are not used anywhere, so a server-owned attribute needs grants, a trigger, or a separate table that the owner can't write. That choice belongs to F-01's plan.

## Historical Context (from prior changes)

- `context/archive/2026-09-24-sites-and-gear-management/plan.md:47, 70, 211`: positive-control rule; four policies per table; 0 rows maps to "not found". Supported by the current code.
- `context/archive/2026-10-03-verdict-check/plan.md:55, 103-110`: anti-tamper out of scope; RPC design. `reviews/impl-review.md:39-56`: F2 (anon + cross-site tests added) and F3 (UI-only invariant moved into the store). Supported, with the exception that the store rule is not enforced in the DB.
- `context/archive/2026-09-26-log-observation-from-ranking/reviews/impl-review.md:26, 59-67, 105`: positive control generalised; lint scope gap fixed; another user's telescope repoint not tested.

## Related Research

- `context/archive/2026-10-07-testing-forecast-honesty/research.md:206, 280`: cause-free forecast error handling as a privacy decision.

## Open Questions

1. **Risk #6 code sweep (blocking for planning #6).** The Opus worker was stopped when the session wrapped up. Re-run it with the same brief:
   - trace coordinate-touching modules by type and import, and list those outside `gearConfig.files`;
   - audit redirect and URL construction and existing tests;
   - assess an automatic module-graph or flipped-default lint check.
2. **Owner decision:** keep the self-only direct writes on `sky_checks` / `observations` as accepted (pin and document), or harden them with column grants or a trigger (a product change)?
3. **Scope of Phase 4 given F-01 isn't built:** run Phase 4 now for isolation plus coordinates, and defer the plan half until F-01 lands (with its tests specified for F-01's plan)? Or wait for F-01?
4. **Post-research backport to §2:** once the above is settled, Risk #5's row and guidance should mark the plan half as dependent on F-01 and add the column-privilege challenge.
