# Test-Suite Diet — Plan Brief

> Full plan: `context/changes/test-suite-diet/plan.md`
> Research: `context/changes/test-suite-diet/research.md`
> Plan review: `context/changes/test-suite-diet/reviews/plan-review.md` (F1-F9 applied 2026-10-17)

## What & Why

The owner asked (2026-10-17) to audit the suite and remove most of it: "We don't need unit tests at all; we need e2e and some more important integration tests. Test features, not implementation details." This plan cuts the Vitest suite to the tests that are the only protection of a PRD requirement, a privacy or licence invariant, a pure decision rule or a fixed bug, moves refusal checks to the HTTP smoke walk, and trims e2e and db modestly, in small PRs.

## Starting Point

On origin/main 85aa123 (S-07 and S-08 merged): 156 files / 3,054 Vitest tests (27.9 s cold locally, re-run on every agent Stop by the hook); 33 e2e specs / 88 tests; 9 db files / 118 tests; 45 smoke steps. About 72 % of the Vitest tests are `it.each` expansions, restated formulas, schema tables, mock choreography or matcher self-tests. Still open: #195 (star-source review fixes, touches the star provenance tests) and the paused S-06 (auth).

## Desired End State

Two Vitest projects: `reference` (about 680-800 tests: engine reference suites, forecast honesty, night boundaries, invariants, offline rules, privacy pins, the S-07 contracts; what the hook runs) and `guards` (about 25: no-console, hooks proof, runner-zone, colours, provenance; CI only). About 100 files instead of 156. Twelve more smoke steps, each refusal with a read-back. E2E about 65-70 tests with the ESA footer tests kept; db about 95. Every fixed-bug pin is in the plan's ledger as kept, replaced or dropped by owner decision.

## Key Decisions Made

| Decision                       | Choice                                                                                                                                                       | Why (1 sentence)                                                                                   | Source           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------- |
| D1 Guards and reference suites | Keep; the author's cut (about 700-820 on the new base), F6's ≤ 450 declined; projects named `reference` / `guards`                                           | Only protection of PRD Success Criterion 2, the 1°/5 min, determinism and coordinates NFRs, FR-024 | Owner 2026-10-17 |
| D2 Hook                        | `vitest run --project reference` + ESLint on changed files                                                                                                   | Slow guards leave the loop; a red feature test still stops a turn                                  | Owner            |
| D3 S-07 tests                  | Cut now, same rubric, fixed per-file targets (about 450 → about 110)                                                                                         | S-07 is merged; its privacy and server-fault pins stay, mock choreography goes                     | Owner            |
| D4 Smoke                       | 12 tuples, every refusal with a read-back; auth steps aligned with the paused S-06                                                                           | Smoke already pins exact `Location`s with `absent:`                                                | Owner            |
| D5 E2E                         | About 18 trims/merges + 4 moves to smoke; keep `landing.spec` ESA footer tests; compass test dropped as a recorded decision; `landing-screenshot` after #195 | Duplicates of smoke and presentation detail                                                        | Owner, F4, F7    |
| D6 DB                          | `account-plan-command` 21 → about 6; grammar tables to a few rows                                                                                            | An operator CLI test; smoke and e2e run the script every CI run                                    | Owner            |
| D7 Provenance                  | No CI regeneration step; keep about 8 licence/provenance tests; shape checks go                                                                              | The generators hold the shape at regeneration (accepted gap)                                       | Owner            |
| D8 Order                       | Phase 0 now; 1-4 incl. S-07 files; 5 after #195; 6 e2e/db; 7 docs                                                                                            | No more waiting on merged branches; #195 is the one open conflict                                  | Orchestrator, F1 |
| D9 Rounding and longitude echo | Product rule, no separate test; error-key construction prevents an echo (accepted gap)                                                                       | Messages are catalogue keys; smoke pins `absent:` on the URL side                                  | Owner, F7        |
| F8 Runner zones                | Two zones of opposite sign (`America/Los_Angeles`, `Pacific/Kiritimati`)                                                                                     | The static guard misses `toLocaleString()`, implicit `${date}`, zoneless literals                  | Reviewer         |

## Scope

**In scope:** `vitest.config.ts` projects (including `scripts/**/*.test.mjs`) and scripts; the hook's call and its proof; deletion, folding and merging per the ledger and targets; 12 smoke steps; e2e and db trims; the docs that name a test as enforcement.

**Out of scope:** any behaviour change under `src/`; a catalogue CI drift step; the finder's failed-plan-read question; Playwright workers or CI runners; `tests/db` deletions; #195 and S-06 themselves; fixture data a kept test reads.

## Architecture / Approach

One rubric per test (delete only as a named duplicate, restatement, replaced schema row, mock choreography or matcher self-test; fold `it.each` into one property that asserts counts first; keep every ledger pin; convert before deleting; prove each phase with counts, break checks and measured times; paste the docs grep into the phase note). Phases are independent PRs; the pin ledger in the plan is the checklist each phase cites.

## Phases at a Glance

| Phase                                                     | What it delivers                                                                                                               | Key risk                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 0. Two projects, lighter hook                             | `reference` / `guards`, hook runs `reference`; no deletions                                                                    | The hook proof must assert the new flag                                      |
| 1. Engine                                                 | 929 → about 300; reference suites intact; zones of opposite sign                                                               | `ALLOWED_DISABLES` coupling                                                  |
| 2. Tonight / forecast / finder / components + S-07 files  | about 655 → about 215                                                                                                          | Folded invariants must keep count preconditions; `orderHints` keeps one case |
| 3. Leaf modules + S-07 routes and stores + 10 smoke steps | about 1,000 → about 240                                                                                                        | Local Supabase needed; S-06 rebase                                           |
| 4. Guards + observability + OpenNGC provenance            | about 400 → about 70; `guards` ≤ 25                                                                                            | None beyond the file floor                                                   |
| 5. After #195: stars, scripts/lib, landing capture        | about 106 → about 18, licence pins kept                                                                                        | Timing of #195                                                               |
| 6. Clock-pinned e2e (amendment 2026-10-17)                | `pinClock` helper, a loopback-only server clock seam (cookie), no date-conditional skips, a guard; e2e green at 3 pinned hours | The seam is a product-code change; needs plan review                         |
| 7. E2E + db                                               | 88 → about 65-70; 118 → about 95; 2 smoke steps                                                                                | A merge that introduces a flake                                              |
| 8. Test-plan refresh + lesson                             | Docs and the rule                                                                                                              | none                                                                         |

**Prerequisites:** Node 24.21 via `nvm use`; Docker + local Supabase for Phases 3, 5, 6; #195 merged before Phase 5.
**Estimated effort:** 9 PRs; Phases 0, 4, 8 about half a session each; Phases 1, 2, 5 about one session; Phase 3 one to two sessions (smoke steps need the local stack); Phases 6 and 7 one session each plus a full local e2e run.

## Open Risks & Assumptions

- After-counts are per-file targets, not measurements; each phase re-measures.
- The interview did not run; D1-D9 come from the owner's written decisions as relayed by the orchestrator.
- S-06 and Phase 3 both touch auth tests and smoke auth steps; whichever lands second rebases.
- Owner-accepted gaps (test-plan §7 in Phase 8): the compass mapping, Accept-Language negotiation, a longitude echo in a schema message, the committed catalogue JSON's shape.

## Success Criteria (Summary)

- `npm test` runs about 700-820 tests across two projects, about 10-12 s cold locally and about 30 s in CI; a hook Stop costs about 12-25 s.
- Every remaining test names a feature-level risk, an invariant, a licence or privacy pin or a fixed bug; every ledger pin is accounted for.
- Smoke, e2e and db still prove the journeys, refusals and isolation they did before, with about 20 fewer browser tests.
