# Test-Suite Diet — Plan Brief

> Full plan: `context/changes/test-suite-diet/plan.md`
> Research: `context/changes/test-suite-diet/research.md`

## What & Why

The owner asked (2026-10-17) to audit the 2,605 unit tests and remove most of them: "We don't need unit tests at all; we need e2e and some more important integration tests. Test features, not implementation details." This plan cuts the unit suite to the tests that are the only protection of a PRD requirement, a privacy or licence invariant, a pure decision rule or a fixed bug, moves refusal checks to the HTTP smoke walk, and trims e2e and db modestly, in small PRs.

## Starting Point

133 unit files / 2,605 tests (23.5 s cold locally, 56-58 s in CI, re-run on every agent Stop by the end-of-turn hook); 33 e2e specs / 88 tests (3-4 min in CI); 9 db files / 118 tests; 45 smoke steps. About 72 % of the unit tests are `it.each` expansions, restated formulas, schema tables, mock choreography or matcher self-tests. Three branches in flight add or rewrite about 4,300 lines of tests (S-07 about 210 tests, S-08 71 + 35, S-06 none yet).

## Desired End State

Two Vitest projects: `unit` (about 640-730 tests: engine reference suites, forecast honesty, night boundaries, invariants, offline rules, privacy pins; what the hook runs, about 4-10 s) and `guards` (about 25 tests: no-console, hooks proof, runner-zone, colours, provenance; CI only). About 95 files instead of 133. Ten more smoke steps pin the refusals and redirects. E2E about 65-70 tests, db about 95. Every phase note lists the fixed-bug pins it kept or replaced.

## Key Decisions Made

All rows are **assumed** from the research recommendation; the owner confirms or overturns them at plan review (questions below).

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| D1 Static guards and engine reference suites | Keep (about 220 tests in about 25 files), split across `unit` and `guards` | They are the only protection of PRD Success Criterion 2, the 1°/5 min and determinism NFRs, coordinates-never-logged and FR-024; e2e runs at one site, on the real clock, with a 0 % cloud fixture | Research §4 |
| D2 Hook scope | `vitest run --project unit` + ESLint on changed files | A red feature test still stops a turn; the slow guards leave the loop (26.7 s of CPU) | Research §1 |
| D3 S-07's new tests | Same rubric, in Phase 5 after S-07 merges | They are S-07's deliverables and conflict on main today | Research §6 |
| D4 Smoke conversions | 10 new tuples, then delete the schema and redirect tautologies | Smoke already pins exact `Location`s with `absent:`; one tuple per check | Research §2.4, §3.3 |
| D5 E2E trims | About 18 trims/merges + 5 moves to smoke, as Phase 6 | Duplicates of smoke and presentation detail | Research §3.1 |
| D6 DB trims | `account-plan-command` 21 → about 6; grammar tables to a few rows | An operator CLI test; smoke and e2e run the script every CI run | Research §3.2 |
| D7 Catalogue provenance | OpenNGC drift check in CI (Phase 4); star licence pins kept after S-08 (Phase 5) | The generators never run in CI; the committed JSON is unchecked | Research §4 row 6 |
| D8 Sequencing | Phases 0-4 now, 5 after S-07 and S-08 merge, 6-7 last; one PR each | Avoids conflicts with in-flight test rewrites | Research §6 |
| D9 Fixed-bug pins | Deleted only when named in the phase note with the replacing test | The owner's brief and test-plan §6.6 break checks | Plan |

## Scope

**In scope:** `vitest.config.ts` projects and scripts; the hook's vitest call and its proof; deletion, folding and merging of unit tests per the research verdicts; 12 smoke steps; e2e and db trims; CI drift check for OpenNGC; the docs that name a test as enforcement (CLAUDE.md, test-plan.md, fixtures README, lessons.md, handoff).

**Out of scope:** any behaviour change under `src/` (only test files, one merged guard, unused test helpers); the finder's failed-plan-read product question; Playwright workers or CI runners; `tests/db` deletions; the in-flight branches themselves; fixture data files a kept test reads.

## Architecture / Approach

One rubric per test (delete only as a named duplicate, restatement, replaced schema row, mock choreography or matcher self-test; fold `it.each` into one property that asserts counts first; keep pins unless replaced; convert before deleting; prove each phase with counts, one break check per folded property and measured times; update the naming docs in the same PR). Phases are independent PRs ordered by which files the in-flight branches touch.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 0. Two projects, lighter hook | `unit` / `guards`, hook runs `unit`; no deletions | The hook proof's vitest stub must accept `--project unit` |
| 1. Engine | 929 → about 296 tests, reference suites intact | Dropping a pin by accident; `ALLOWED_DISABLES` coupling |
| 2. Tonight / forecast / finder / components | about 440 → about 170 (S-07 files deferred) | Folded invariants must keep their count preconditions |
| 3. Leaf modules + smoke steps | 703 (minus 6 deferred) → about 150; 10 smoke steps | Smoke steps need local Supabase; refusal steps must prove nothing was written |
| 4. Guards + OpenNGC drift check | 352 (minus 5 deferred) → about 40; CI drift step | CI reaching raw.githubusercontent.com |
| 5. After S-07 / S-08 merge | Deferred files and the new suites by the rubric; star licence pins to `guards` | Timing of the merges; counts set only then |
| 6. E2E + db trims | 88 → about 65-70 e2e; 118 → about 95 db; 2 smoke steps | A merge that introduces a flake (`failOnFlakyTests`) |
| 7. Test-plan refresh + lesson | Docs and the rule | none |

**Prerequisites:** Node 24.21 via `nvm use`; Docker + local Supabase for Phases 3, 5, 6; S-07 and S-08 merged before Phase 5.
**Estimated effort:** 7 PRs; Phases 0, 4, 7 about half a session each, Phases 1-3 and 5 about one session each, Phase 6 one session plus a full local e2e run.

## Open Risks & Assumptions

- The after-counts and times are estimates from per-file timings; each phase re-measures.
- The interactive plan interview was not run (the orchestrator forbade the question tool); D1-D9 are assumptions until the owner answers.
- A CI drift check depends on network access to GitHub raw content from the runner.
- Coordinate rounding to 0.01° is treated as a product rule, not a privacy guarantee; if the owner disagrees, one smoke step (a site saved with 5 decimals reads back with 2) is added in Phase 3.

## Success Criteria (Summary)

- `npm test` runs about 650-750 tests across two projects, about 8-10 s cold locally and about 25 s in CI; a hook Stop costs about 12-25 s.
- Every remaining test names a feature-level risk, an invariant, a licence or privacy pin, or a fixed bug; every removed pin is accounted for in a phase note.
- Smoke, e2e and db still prove the journeys, refusals and isolation they did before, with about 20 fewer browser tests.

## QUESTION FOR OWNER

Pytania do właściciela (decyzje D1-D9; rekomendacja w nawiasie):

1. **D1 Strażnicy i suity referencyjne.** Czy "żadnych testów jednostkowych" obejmuje też strażników statycznych (no-console, wrangler, red-theme, contrast, runner-zone, silent-catch, provenance, dowód hooka) i suity referencyjne silnika (Skyfield/Stellarium/USNO, kalibracja vs lista dla początkujących, niezmienniki PRD)? Nie ma dla nich innej ochrony, a PRD wymaga ich sam (Success Criteria 2, NFR 1°/5 min, NFR determinizm, NFR koordynaty nigdy w logach). (Rekomendacja: zostawić, ~220 testów w ~25 plikach, w dwóch projektach Vitest: `unit` dla hooka i CI, `guards` tylko w CI.)
2. **D2 Hook.** Po diecie `unit` trwa ok. 4-10 s, ESLint 8-18 s. Czy hook ma uruchamiać cały projekt `unit`, czy tylko `vitest related` dla zmienionych plików? (Rekomendacja: cały `unit`, bez `guards`.)
3. **D3 S-07.** Gałąź error-visibility-2 dodaje ~210 testów jednostkowych (trasy na fake'u Supabase, store'y, observability) i jej kryteria sukcesu to testy jednostkowe. Po merge'u ta sama rubryka w fazie 5 (zostają piny prywatności i `errors.serverFault`, znika choreografia mocków), czy zamrozić je do zamknięcia S-07? (Rekomendacja: ta sama rubryka w fazie 5.)
4. **D4 Smoke.** 12 nowych kroków smoke zamiast testów schematów i przekierowań (POST `/api/log` z koordynatą w `target`, zepsuty JSON okularów, plan `site=52.23,21.01`, sky-check `from=https://evil.example`, wylogowane `/log` i `/api/log`, landing ×2, 404 wpisu, 301 `/tonight/all`, `nightOver`, edycja sprzętu). Zgoda? (Rekomendacja: tak.)
5. **D5 E2E.** ~18 testów do usunięcia lub scalenia (duplikaty smoke: what-to-expect t1/t2/t4, finder-chart t1/t4, sign-in-continue, landing; detale prezentacji: tonight-sky t4-t7, toasts t3/t6, observing-progress t2/t3, red-night t2/t3, tonight-targets t2/t3; scalenia "mark observed" ×3 i subnav/navigation). Zgoda, czy e2e bez zmian? (Rekomendacja: zgoda, jako faza 6.)
6. **D6 Baza.** `tests/db/account-plan-command.test.ts` 21 → ~6 i tabele gramatyki kluczy do kilku wierszy; reszta `tests/db` w całości. (Rekomendacja: tak.)
7. **D7 Provenance.** Krok CI "regeneruj i `git diff --exit-code`" dla OpenNGC (jak dla `database.types.ts`; CI musi sięgać do raw.githubusercontent.com), ~8 testów licencyjnych zostaje (pin OpenNGC/HYG, "Credit: ESA", budżet gzip, nota NASA/IAU, `HIPPARCOS_FIELDS_USED` z S-08). (Rekomendacja: tak; gwiazdy po merge'u S-08.)
8. **D8 Kolejność.** Fazy 0-4 od razu (nie dotykają plików S-07/S-08), faza 5 po merge'u S-07 i S-08, fazy 6-7 na końcu; każda faza osobny PR z notatką wymieniającą każdy zachowany lub zastąpiony pin naprawionego błędu. Zgoda? (Rekomendacja: tak.)
9. **Zaokrąglanie koordynat do 0,01°.** Traktować jako regułę produktu (bez osobnego pinu), czy jako gwarancję prywatności (jeden krok smoke w fazie 3)? (Rekomendacja: reguła produktu; e2e site-location i site-map już sprawdzają zaokrąglony zapis.)
