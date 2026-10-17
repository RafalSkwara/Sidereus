# Test-Suite Diet Implementation Plan

> **Status (2026-10-17):** planned without the interactive interview (the orchestrator forbade the question tool for this diagnosis run). Every decision in the table below is **assumed** from the research recommendation and is the owner's to confirm or overturn at plan review; the Polish questions are in `plan-brief.md`. No test has been deleted yet; nothing here authorises implementation.

## Overview

Cut the Vitest unit suite from 2,605 tests in 133 files to about 650-750 tests in about 95 files by deleting implementation-detail tests, folding `it.each` inflation, merging duplicates and converting refusal checks to HTTP smoke steps, while keeping, in two Vitest projects, the tests that are the only protection of a PRD requirement, a privacy or licence invariant, or a fixed bug. Trim the e2e and db suites modestly. Do it in small phases, each its own PR, sequenced so that the phases touching files the in-flight S-07 and S-08 branches rewrite run only after those branches merge.

## Current State Analysis

From `research.md` (measured 2026-10-17 at 82e35cf):

- `npm test` runs 133 files / 2,605 tests in 23.5 s cold, 11-12 s warm locally and 56-58 s in CI; the end-of-turn hook (`.claude/hooks/end-of-turn.sh:123-131`) re-runs the whole suite plus type-aware ESLint on every Stop that changed a non-doc file, 25-45 s per Stop. Two guard files (`no-console-guard` 15.7 s, `agent-hooks` 11.0 s) are 26.7 s of the 64.0 s file-time sum.
- About 72 % of the tests are `it.each` expansions, restated formulas or constants, zod accept/reject tables, mock choreography, string tautologies or matcher self-tests (research §2). About 720 tests carry feature-level or invariant protection that neither e2e (one site, real clock, all-clear fixture) nor smoke (45 steps, exact redirects) nor `tests/db` can reach (research §4).
- The e2e suite is 33 specs / 88 tests (3-4 min in CI); the db suite 9 files / 118 named tests; smoke 45 sequential steps with exact `Location` pins (`scripts/smoke.mjs:218-589`).
- Couplings: `no-console-guard.test.ts:43-53` allowlists `calibration`, `determinism`, `events` and `finder` test files and `:176` asserts they exist; `:174` requires ≥ 300 files under `src` (309 non-test). `TONIGHT_NAV` / `TONIGHT_PAGES` parity lives only in `navigation.test.ts:125`.
- In flight: `feat/error-visibility-2` (S-07) adds about 210 unit tests in 33 files and rewrites `silent-catch-guard.test.ts`, `log-failure`, `build`, `load`, `service`, `open-meteo`, `finder/load`, `account-plan` ×2, `celebrate`, `observations/redirect` and `store`, `sky-checks/record`; `feat/star-source-switch` (S-08) widens `vitest.config.ts` to `scripts/**/*.test.mjs` (+71) and rewrites `stars.test.ts` and `finder-stars.test.ts`; `feat/auth-loose-ends` (S-06) has no tests yet.

## Desired End State

- `vitest.config.ts` defines two projects: `unit` (fast, feature-level and invariant tests, what the hook runs) and `guards` (static guards and provenance, CI only). `npm test` runs both; `npm run test:unit` runs `unit`; the hook runs `unit`.
- `unit` + `guards` together hold about 650-750 tests in about 95 files; `npm test` takes about 8-10 s cold locally and about 25 s in CI; one hook Stop costs about 12-25 s.
- Every test that remains is one of: an independent-reference check (Skyfield, Stellarium, USNO, NASA, published hops and beginner lists), a PRD rule or invariant written as a relation, a privacy or licence pin, a fixed-bug regression pin, a pure decision rule with no other oracle (offline copies, milestones), or a static guard with no cheaper gate.
- Ten new smoke steps pin the refusals and redirects that schema and redirect unit tests used to hold; the e2e suite is about 65-70 tests in about 28 specs; the db suite about 95 named tests.
- Each phase's note (`implementation-notes.md`) lists every fixed-bug pin it kept or dropped, the before/after counts and the measured times; `test-plan.md`, `CLAUDE.md` and `lessons.md` describe the new shape.

Verify: `npx vitest run --reporter=json` counts per project; `/usr/bin/time -p npx vitest run --project unit` locally; the `ci` job's `npm test` step time on the PR; `npx playwright test --list`; `npx vitest list --config vitest.db.config.ts`.

### Key Discoveries:

- The two slow guard files set the suite's wall time and run on every agent Stop; moving them to a CI-only project is the single biggest latency win (`research.md` §1, §2.3).
- Six files account for about 600 of the 2,605 tests through `it.each` and fold to about 60 with identical protection: engine `night-boundaries` (130), engine `visibility-invariants` (203), tonight `visibility-invariants` (100), `small-scope` (69), `log-night` (60), `rhythm-roles` (105).
- `scripts/smoke.mjs` is already the HTTP integration layer: one `[name, run, expected]` tuple per step with `exact`, `absent`, `bodyIncludes` (template `:278-282`); no step POSTs `/api/log` or a gear update today.
- The e2e suite cannot replace the reference suites or invariants: it runs at Madrid, on the real clock, against a 0 % cloud fixture, and 1-3 specs skip on most nights (research §3.1).
- `finder/load.test.ts:105` ("a failed plan read answers like a free account") is the documented fail-closed rule of `requireFullPlan` (`src/lib/account-plan/index.ts:20-24`), not a bug; keep the pin, do not reopen the product question.

## Decisions (assumed; owner confirms at plan review)

| # | Decision | Assumed choice | Why | Alternative the owner may pick |
| --- | --- | --- | --- | --- |
| D1 | Static guards and engine reference suites | Keep both (about 220 tests in about 25 files): reference suites in `unit`, slow guards in `guards` | They are the only protection of PRD Success Criterion 2, the NFRs (1°/5 min, determinism, coordinates never logged) and FR-024; nothing in e2e, smoke or db sees them (research §4) | Delete them and accept that a retune, a wrong window time or a logged coordinate ships unseen |
| D2 | What the hook runs | `vitest run --project unit` (whole project) + ESLint on changed files | Keeps a red feature test from ending a turn green; the `unit` project is about 4-10 s after the diet | `vitest related` on changed files only (faster, misses cross-file regressions) |
| D3 | S-07's new unit tests | Judge them by the same rubric in Phase 5, after S-07 merges; keep the privacy and server-fault pins, cut mock choreography | S-07's deliverables are unit tests; editing them on main now conflicts; the rubric is the same | Freeze S-07's tests until S-07 closes; or exempt them |
| D4 | Convert refusals to smoke | Add 10 smoke steps (research §2.4 and §3.3) and delete the schema and redirect tautologies they replace | Smoke already pins exact `Location`s with `absent:`; a step is one tuple | Keep the schema tests; no new smoke steps |
| D5 | E2E trims | Trim or merge about 18 tests and move 5 checks to smoke, as its own last-but-one phase | Duplicates of smoke and presentation detail (research §3.1) | Leave e2e untouched in this change |
| D6 | DB trims | `account-plan-command` 21 → about 6; the target-key grammar tables to a few rows | An operator CLI test in disguise; smoke and e2e run the script every CI run | Keep `tests/db` whole |
| D7 | Catalogue provenance | OpenNGC drift check in the `ci` job (`catalogue:build` + `git diff --exit-code`), keep 1 provenance test per catalogue; stars after S-08 with the licence pins kept | The generators assert the shape rules but never run in CI; the committed JSON is unchecked otherwise | Keep the provenance tests as they are |
| D8 | Sequencing | Phases 0-4 now (no overlap with S-07/S-08), Phase 5 after both merge, Phases 6-7 last; one PR per phase | Avoids conflicts with about 4,000 lines of in-flight test changes | One big PR after everything merges |
| D9 | Fixed-bug pins | A pin is deleted only when its describe block is named in the phase note with the duplicate that replaces it | The brief's rule; test-plan §6.6 break checks | n/a |

## What We're NOT Doing

- No product or source changes under `src/` except: the shared island-import guard test, the `fixtures/` helpers that become unused, and `src/lib/test-support/` files whose consumers go. Behaviour never changes.
- Not resolving the "failed plan read → locked" product question in the finder (research §4, observation).
- Not changing Playwright's worker count or the CI runner shape; not touching `migrate` or `deploy`.
- Not deleting any `tests/db` file; not weakening any RLS, structure or RPC case (PRD NFR, prd.md:530-531).
- Not deleting `src/lib/engine/fixtures/**` data files that a kept test reads; `stellarium/*.json` stay for `sun.test.ts`.
- Not rewriting kept tests for style; a kept file is trimmed, not rewritten.
- Not touching S-06, S-07 or S-08 branches; Phase 5 works on main after they merge.

## Implementation Approach

One rubric for every file, applied per test, not per file:

1. **Delete** a test only when the note names which of these it is: (a) a duplicate of a named test, spec or smoke step; (b) a formula, constant or type shape restated; (c) a zod accept/reject row whose refusal smoke now pins (or that is not a privacy rule); (d) mock choreography (which function was called with what); (e) a matcher self-test of a guard, folded into one loop control.
2. **Fold** an `it.each` property into one test that loops and asserts the non-vacuity counts first (test-plan §6.3: "assert the counts first, so a property that checks nothing fails") and puts the case index and inputs in the failure message.
3. **Keep** a fixed-bug pin unless the note names its replacement (D9).
4. **Convert** a refusal or redirect to a smoke tuple with `exact: true` and `absent: "<submitted value>"` before deleting the unit test that held it.
5. **Prove** each phase: `npm test`, `npm run lint`, `npx astro check` green; the JSON reporter's counts at or under the phase target; one deliberate break check per folded property (widen a window, lift a cap) turns the folded test red and is reverted; times measured and written down.
6. **Update** in the same PR every document that names a deleted or moved test as its enforcement (CLAUDE.md tripwires and UI section, test-plan §4-§6, the fixtures README, `no-console-guard`'s `ALLOWED_DISABLES`).

Each phase is one PR from a branch off main, run by the implementation agent with the `nvm use` prefix; the whole e2e suite and smoke run locally before the PRs of Phases 3, 5 and 6 (lessons.md "Run the whole e2e suite before a PR").

## Critical Implementation Details

- **Vitest projects and the hook.** Vitest 5 takes `test.projects: [{ test: { name, include, exclude } }, …]`; `vitest run` runs every project, `vitest run --project unit` one. The hook's `vitest run` (`end-of-turn.sh:128`) must become `vitest run --project unit`, and `agent-hooks.test.ts` stubs `node_modules/.bin/vitest` in its sandboxes, so the stub and the assertion that "vitest ran" must accept the flag (check the stub in `:218`'s sandbox helper before editing).
- **`no-console-guard` couplings.** Removing a file listed in `ALLOWED_DISABLES` (`no-console-guard.test.ts:43-53`) without removing its entry fails `:176`; removing the console lines from a kept file without lowering its count fails `:197`. Edit the guard in the same commit. The `≥ 300` floor (`:174`) counts test files too; after the diet about 309 non-test + about 95 test files remain, so it holds, but check it in Phase 4's note.
- **Folding runner zones.** `describe.each(RUNNER_ZONES)` blocks switch `process.env.TZ` in-process and need the forks pool; a folded table must still call the code under test inside `it`, never at `describe` scope (test-plan §6.2 gotchas).
- **Smoke is sequential on one user.** New steps go after the step that creates the state they need (a site for the plan `site=` case, an onboarded user for `/api/log`), and a refusal step must leave no row behind (assert "nothing was written" by re-reading, as `plan 11` does).

## Phase 0: Two Vitest projects and a lighter hook

### Overview

Split the suite into `unit` and `guards`, move the two slow guard files to `guards`, and make the hook run `unit` only. No test is deleted. This is the latency win and the scaffold every later phase uses.

### Changes Required:

#### 1. Vitest projects

**File**: `vitest.config.ts`

**Intent**: Two named projects over the same alias and forks pool so CI runs both and the hook runs one.

**Contract**: `test.projects` with `unit` (include `src/**/*.test.ts`, exclude the guard list) and `guards` (include exactly: `src/lib/no-console-guard.test.ts`, `src/lib/agent-hooks.test.ts`, `src/lib/runner-zone-guard.test.ts`, `src/styles/no-hardcoded-colors.test.ts`, `src/styles/rhythm-roles.test.ts`). Both keep `environment: "node"` and `pool: "forks"` with the existing comment. Phase 5 adds the catalogue provenance files to `guards` after S-08.

#### 2. Scripts

**File**: `package.json`

**Intent**: `npm test` stays "everything" for CI; a `test:unit` script names what the hook runs.

**Contract**: `"test": "vitest run"`, `"test:unit": "vitest run --project unit"`, `"test:guards": "vitest run --project guards"`.

#### 3. The hook

**File**: `.claude/hooks/end-of-turn.sh`

**Intent**: The end-of-turn suite is the `unit` project; guards run in CI.

**Contract**: line 128 runs `node_modules/.bin/vitest run --project unit`; the header comment says so. `SUMMARY` reads `vitest unit;`.

#### 4. The hook proof

**File**: `src/lib/agent-hooks.test.ts`

**Intent**: The sandbox stub and the "vitest ran" assertions accept the `--project unit` flag; nothing else changes in this phase.

**Contract**: the stubbed `vitest` records its arguments; `:218`'s assertion checks that the recorded call contains `--project unit`.

#### 5. Docs

**Files**: `CLAUDE.md` (Commands block and the "Agent hooks" tripwire), `context/foundation/test-plan.md` §4 (unit row: two projects) and §5 (end-of-turn gate: `unit` project)

**Intent**: Name the two projects and what the hook runs.

**Contract**: prose only.

### Success Criteria:

#### Automated Verification:

- `npm test` runs both projects green and reports the same 2,605 tests as before (`npx vitest run --reporter=json --outputFile=<scratch>/p0.json`, `numTotalTests` unchanged)
- `npm run test:unit` excludes the five guard files and finishes in under 12 s cold locally (`/usr/bin/time -p`, written in the note)
- `npm run test:guards` runs exactly the five guard files
- `src/lib/agent-hooks.test.ts` is green and its "clean → 0" case records a `--project unit` call
- `npm run lint` and `npx astro check` pass
- The `ci` job on the PR runs `npm test` green

#### Manual Verification:

- One real Stop in a worktree with a changed `.ts` file shows the hook's summary `vitest unit;` and the measured hook time in the note (before: 25-45 s)

---

## Phase 1: Engine suite to its reference core

### Overview

Trim `src/lib/engine/*.test.ts` from 31 files / 929 tests to about 24 files / about 296 tests, keeping every ephemeris, calibration, invariant and purity check and the named fixed-bug pins. No overlap with S-07; S-08 touches `fixtures/finder-reference.ts` by two lines (rebase, no conflict expected).

### Changes Required:

#### 1. Merges and deletions

**Files**: `src/lib/engine/evening-showpieces.test.ts` (merge its 2 reference relations into `calibration.test.ts`, delete), `night.test.ts` (merge the 5 non-duplicate span cases into `night-boundaries.test.ts`, delete)

**Intent**: One calibration file and one night file.

**Contract**: `calibration.test.ts` keeps the k ≥ 3 oracle (`:104`), the Messier-bonus bounds and gains the showpieces median relation and the M13 short-night case (pins #21 item 1); `night-boundaries.test.ts` gains the 23 h / 25 h span cases.

#### 2. Folds

**Files**: `night-boundaries.test.ts` (130 → 26: the `describe.each(RUNNER_ZONES)` runs under 2 zones, UTC and Europe/Warsaw, the other 3 zones stay covered by `runner-zone-guard` and the tonight suite), `visibility-invariants.test.ts` (203 → 4: one looping test per target kind plus the count preconditions), `small-scope.test.ts` (69 → 7: G5's 60 rows become one loop), `calibration.test.ts` (16 `it.each` → 4)

**Intent**: Same protection, one test per property, counts asserted first.

**Contract**: each folded test asserts its non-vacuity counts (test-plan §6.3: ≥ 150 dark-window cases, 3,000 object entries, 20 southern, 10 above 60°, 50 planet entries) before the property and names the case index in every failure.

#### 3. Trims (per-file targets from research §2.1)

**Files**: `contrast` → 1, `determinism` → 2 (drop the two console budget tests), `events` → 25 (shorten the 1,000- and 5,500-night scans to the windows that hold the F5 and decision-A pins), `expectation` → 7, `eyepieces` → 10, `finder` → 30 (keep the brute force `:428, :546, :652`, the 7 published hops and the 4 zenith-edge pins), `log` → 3, `meteors` → 14, `moon-disc` → 2, `moon-target` → 5 (keep the 3 % floor and cloud-masking pins), `moon` → 8 (drop the 3 Stellarium todos), `moonlight` → 3, `objects` → 3 (drop the 3 todos), `outlook` → 16 (keep the missing-dark-hour and F1 equivalence pins; drop the Tromsø sweep), `pairings` → 15 (keep the Skyfield block and the F1 twilight pins; keep one of the two independent-altitude oracles), `planet-ranking` → 5 (keep the 3 visible-interval pins), `planets` → 4, `ranking` → 15 (keep the reasonComponents and AF pins; drop the 5 duplicates named in research), `score` → 15 relations (keep F5, #21, #172/#159 pins), `sky-frames` → 1, `sun` → 9 (keep the Stellarium block and the polar clamp), `verdict` → 29, `window-reference` → 10, `ranking-invariants` → 11, `purity` unchanged

**Intent**: Remove restated formulas, constants, duplicates named in research §2.1 and `:` anchors there.

**Contract**: the "Pins" column of research §2.1 is the checklist; each kept pin's describe title is unchanged.

#### 4. Guard allowlist and fixtures

**Files**: `src/lib/no-console-guard.test.ts` (`ALLOWED_DISABLES`: remove `determinism` and `events` entries if their console lines go; keep `calibration` 1 and `finder` 2 if the opt-in prints stay), `src/lib/engine/fixtures/README.md` (drop the pending Stellarium Moon/objects sections or mark them retired), `scripts/*-reference.py` (unchanged; all four fixtures stay in use)

**Intent**: Keep the guard and the README true.

**Contract**: `no-console-guard` green; every fixture file under `fixtures/` is still imported by a kept test (grep in the note).

### Success Criteria:

#### Automated Verification:

- `npm test` green; engine files ≤ 25 and engine tests ≤ 310 by the JSON reporter
- Break checks, each red then reverted: widen a deep-sky window by one sample (`visibility-invariants` fold red), lift `MESSIER_RANK_BONUS` above the bar (`ranking-invariants` red), shift a pairing's best moment into daylight (`pairings` F1 pin red)
- `npm run test:guards` green with the updated `ALLOWED_DISABLES`
- `npm run lint`, `npx astro check` green; `npm run test:unit` time recorded

#### Manual Verification:

- The phase note lists every pin from research §2.1 as kept or dropped-with-replacement

---

## Phase 2: Tonight, forecast, finder and components (the files S-07 does not touch)

### Overview

Trim the slice to feature-level protection: about 29 files / about 170 tests from 34 files / about 440 tests. The five files S-07 rewrites (`tonight/build`, `tonight/load`, `forecast/service`, `forecast/open-meteo`, `finder/load`) wait for Phase 5.

### Changes Required:

#### 1. Components

**Files**: delete `src/components/design/finder-samples.test.ts`, `src/components/nav-type-roles.test.ts`, `src/components/tonight/subnav.test.ts`, `src/components/ui/fact-icons.test.ts`; merge `MoonTimeSlider.test.ts`, `TonightSkyView.test.ts` and `fact-islands.test.ts` into one `src/components/island-imports.test.ts`

**Intent**: One guard that every island stays free of the engine, `@/lib/catalogue`, the `Fact*` family and the lucide set; no class-string or lookup tautologies.

**Contract**: the merged guard scans the same island files with the same forbidden-import lists (3 tests: the scan, one positive control per list family, a self-test on an in-memory sample); CLAUDE.md's UI section names the new file where it named the three.

#### 2. Finder, moon-disc, sky-view

**Files**: `finder/chart-svg` → 5, `finder/example-chart` → 1 (move the opt-in regeneration to `scripts/`), delete `finder/from`, `finder/steps` → 3, `moon-disc/geometry` → 6, `moon-disc/label` → 2, delete `moon-disc/state`, `sky-view/sky-view` → 3

**Intent**: Keep orientation, label-collision, limb-side and rotation relations; drop literal coordinates and path strings.

**Contract**: per research §2.2 targets.

#### 3. Forecast (the Risk #1 core stays whole)

**Files**: `forecast/degraded-forecast` unchanged, `forecast/cache` → fold its one timeout case into `forecast/service` in Phase 5 (delete the file then; untouched now), `forecast/night-in-progress` → 1

**Intent**: Nothing of Risk #1 moves.

#### 4. Tonight

**Files**: `tonight/all-objects` → 2, delete `tonight/altitude-curve`, `tonight/expectation` → 1 table test (full / free / unknown), `tonight/format` → 6 (DST labels and the headline table), `tonight/gear-choice` → 2, `tonight/night-boundaries` unchanged, delete `tonight/plan-editor-view`, `tonight/plan-editor` → 3, delete `tonight/plan-edits`, delete `tonight/plan-order`, `tonight/plan-window` → 9, `tonight/requested-gear` → 1 (keep the F5 pin), `tonight/session-plan` → 1, `tonight/sky-events` → 10 (keep F3, F2/decision A, F6, F10b), `tonight/visibility-invariants` 100 → 8 (fold the per-case rows), `tonight/forecast-honesty` unchanged

**Intent**: Keep the view-level invariants and the eclipse-wording pins; drop props, geometry and reducer tests that session-plan-edit.spec and the invariants cover.

**Contract**: research §2.2 anchors; the folded invariants assert ≥ 30 plans with rows and 3 no-darkness cases first (test-plan §6.3).

#### 5. Docs

**Files**: `CLAUDE.md` (Tonight and UI paragraphs that name `fact-islands.test.ts`, `TonightSkyView.test.ts`, `nav-type-roles.test.ts`), `context/foundation/test-plan.md` §6.1 and §6.3 file lists

### Success Criteria:

#### Automated Verification:

- `npm test` green; the slice's files ≤ 30 and tests ≤ 190 by the JSON reporter (excluding the five deferred files)
- Break checks red then reverted: a Session plan row clamped past its window (`tonight/visibility-invariants` fold), the solar-safety line dropped behind "+N more" (`sky-events` F3), an island importing `@/lib/catalogue` (the merged guard)
- `npm run lint`, `npx astro check` green; `npm run test:unit` time recorded

#### Manual Verification:

- The phase note lists every pin from research §2.2 as kept or dropped-with-replacement

---

## Phase 3: Leaf modules, offline rules and the smoke steps

### Overview

Trim the 43 leaf files to about 150 tests in about 30 files, add the 10 smoke steps that take over the refusal and redirect pins, and delete the schema and redirect tautologies they replace. The six files S-07 touches (`account-plan` ×2, `observations/celebrate`, `observations/redirect`, `observations/store`, `sky-checks/record`) wait for Phase 5.

### Changes Required:

#### 1. Smoke steps (before any deletion in this phase)

**File**: `scripts/smoke.mjs`

**Intent**: Pin over HTTP what the schema and redirect unit tests held, with exact `Location` and `absent:` where a value could leak.

**Contract**: ten tuples in the existing `[name, run, expected]` shape, placed after the step that creates the state they need: (1) `POST /api/log` with `target=52.23,21.01` → `/log/new?error=errors.log.target` (or the route's fixed key), `exact: true, absent: "52.23"`; (2) `POST /api/onboarding` with malformed `eyepieces` JSON → the fixed key, `absent:` the payload; (3) `POST /api/tonight/plan` with `site=52.23,21.01` → `/tonight/plan?error=…` with no `site=`, `absent: "52.23"`; (4) `POST /api/log/sky/<id>` with `from=https://evil.example` → a same-origin `Location`; (5) signed-out `GET /log` → `/auth/signin?next=%2Flog` and (6) signed-out `POST /api/log` → sign-in; (7) `GET /` signed out 200 with the CTA hrefs and (8) signed in → 302 `/tonight`; (9) `GET /log/<unknown id>` → 404; (10) `GET /tonight/all#more` → 301 to `/tonight/targets`. `nightOver` and the gear UPDATE route join in Phase 6 with the e2e trims. Each refusal step is followed by a read-back that nothing was written where a write was attempted.

#### 2. Deletions

**Files**: `compass`, `gear/catalogue/fill`, `gear/coordinates`, `gear/eyepiece-presets`, `gear/schemas`, `gear/timezone`, `onboarding/schemas`, `preferences`, `protected-routes`, `session-cookie`, `session-plans/read`, `session-plans/redirect`, `session-plans/schemas`, `sky-checks/schemas`, `targets/labels`, `toasts` (all `.test.ts` under `src/lib/`)

**Intent**: Schema accept/reject tables, string tautologies, cookie and preference parsing and mock choreography that smoke, e2e or db already pin.

**Contract**: `observations/schemas.test.ts` keeps only its `returnTargetSchema` test (1).

#### 3. Trims

**Files**: `api-errors` → 2, `auth-redirect` → 5 (the refusals `:25-50`), `gear/catalogue/catalogue` → 12, `gear/catalogue/search` → 3, `location/geocode` → 2 (keep `:116`), `location/locate` → 3, `location/map-view` → 2, `observations/log-night` → 12 (drop the `describe.each(RUNNER_ZONES)` loop), `observations/target-search` → 3, `offline/coalesce` → 3 (keep F10), `offline/copies` → about 58 by the rule table in research §2.4 (every distinct rule once; every finder, adjustable-session-plan and offline-night-plan pin named there kept), `offline/owner` unchanged, `offline/page-state` → 3, `onboarding/presets` → 1, `progress/progress` → 4, `progress/milestones` → 15 (withStored `:442-456`, newlyReached `:369-415`, 6 boundary cases), `session-plans/checks` → 3 (keep F4), `sky-checks/claim` → 4, `sky-checks/pending` → 2 (keep the month-boundary pin), `targets/index` → 4

**Intent**: Keep the privacy guards, PRD rules and the pure offline decision rules; drop the rest.

**Contract**: research §2.4 anchors; the `offline/copies` note lists its 14 rule groups with before/after counts.

#### 4. Docs

**Files**: `CLAUDE.md` (Offline and Conventions paragraphs where a deleted test is named), `context/foundation/test-plan.md` §6.4 ("Coordinates in redirects and logs": the smoke steps now pin the URL side) and §6.5

### Success Criteria:

#### Automated Verification:

- `npm test` green; the slice's files ≤ 30 and tests ≤ 170 by the JSON reporter (excluding the six deferred files)
- The 10 smoke steps pass against a local production preview backed by local Supabase (`SUPABASE_URL=… SUPABASE_SECRET_KEY=… BASE_URL=… npm run smoke`), and each refusal step fails when its `absent:` value is removed from the assertion (one deliberate check, reverted)
- Break checks red then reverted: a stored finder chart kept after an explicit `free` (`copies` plan-loss drop), a milestone lost after its only entry is deleted (`milestones` withStored)
- `npm run lint`, `npx astro check` green; `npm run test:unit` time recorded
- The whole e2e suite and smoke are green locally before the PR (lessons.md)

#### Manual Verification:

- The phase note lists every pin from research §2.4 as kept or dropped-with-replacement

---

## Phase 4: Guards, parity and OpenNGC provenance

### Overview

Trim the static guards to their invariants, move the OpenNGC shape checks to a CI drift check, and leave the three colour guards and `wrangler-config` untouched. The S-07 files (`silent-catch-guard`, `log-failure`, `virtual-modules`) and the S-08 files (`stars`, `finder-stars`) wait for Phase 5.

### Changes Required:

#### 1. Guard trims

**Files**: `src/lib/agent-hooks.test.ts` → 7 (`:209, :218, :249, :296, :326, :451, :458`), `src/lib/no-console-guard.test.ts` → 5 (merge the 4 `countDisables` helper tests into 1 control), `src/lib/runner-zone-guard.test.ts` → 3 (one OFFENDING loop, one ALLOWED loop, the line report), `src/styles/rhythm-roles.test.ts` → 4 (two pattern loops, two per-file loops with the exact allowances kept), `src/lib/navigation.test.ts` → 1 (the `TONIGHT_NAV` = `TONIGHT_PAGES` parity), `src/i18n/i18n.test.ts` → 2 (few/many parity, `translateKey` fallback), delete `src/lib/fetch-timeout.test.ts`, `src/lib/catalogue/common-names.test.ts` → 1, `src/lib/catalogue/meteor-showers.test.ts` → 2 (derivation, licence note)

**Intent**: Keep each invariant once with one positive control.

**Contract**: the `agent-hooks` minimum set still proves red-goes-back, green-finishes, retry-reports, missing-tool, SubagentStop, `bash -n`, settings reach the scripts; `no-console-guard` keeps `:181`, `:197`, `:217` and the `:174-176` tree check.

#### 2. OpenNGC drift check

**Files**: `.github/workflows/ci.yml` (`ci` job, after `npm test`: `npm run catalogue:build && git diff --exit-code src/lib/catalogue/messier.json src/lib/catalogue/messier.meta.json src/lib/catalogue/caldwell.json src/lib/catalogue/caldwell.meta.json`), `src/lib/catalogue/messier.test.ts` → 1 (pinned commit + licence), `src/lib/catalogue/caldwell.test.ts` → 1 (pinned commit + licence + the Rosette and C30 pins folded into it)

**Intent**: The committed JSON equals the generator's output over the pinned commit, checked where it matters (CI), with the licence pins kept as tests.

**Contract**: the drift step needs `raw.githubusercontent.com` from the runner; if it fails for network reasons twice in the PR's runs, the step is dropped and the two test files keep their shape checks (recorded in the note as D7 not taken).

#### 3. Docs

**Files**: `CLAUDE.md` tripwires (catalogue: "and the `ci` job's drift check"), `context/foundation/test-plan.md` §5 (new gate row)

### Success Criteria:

#### Automated Verification:

- `npm test` green; `guards` project ≤ 25 tests, the slice ≤ 45 tests by the JSON reporter
- The drift step passes on the PR, and fails on a deliberate one-line edit of `caldwell.json` (pushed to the PR branch once and reverted)
- `npm run test:guards` under 20 s locally (the ESLint config load dominates)
- `npm run lint`, `npx astro check` green

#### Manual Verification:

- The phase note records the `no-console-guard` file floor (`:174`) count after the diet so far

---

## Phase 5: After S-07 and S-08 merge: the deferred files and the new suites

### Overview

Only after `feat/error-visibility-2` and `feat/star-source-switch` are on main. Apply the same rubric to the files they rewrote and to the suites they added, and move the star provenance tests to `guards`.

### Changes Required:

#### 1. Deferred Tonight and forecast files

**Files**: `src/lib/tonight/build.test.ts` → about 37 + the S-07 additions judged by the rubric (research §2.2 lists the kept lines per block), `src/lib/tonight/load.test.ts` → 6 + S-07's fail-safe log cases, `src/lib/forecast/service.test.ts` → 22 + S-07's step/status cases (absorb `cache.test.ts`'s timeout case, delete that file), `src/lib/forecast/open-meteo.test.ts` → 1 + S-07's "no URL in any property" cases, `src/lib/finder/load.test.ts` → 8 (keep `:105` and the F9 block)

**Intent**: Feature-level protection and the privacy lines S-07 added; no mock choreography.

#### 2. Deferred leaf files

**Files**: `account-plan/account-plan` → 4, `account-plan/store` → 1 (fold), `observations/celebrate` → 9, `observations/redirect` → 6 privacy cases, `observations/store` → 1 (`:73`), `sky-checks/record` → 1

#### 3. S-07's new suites

**Files**: `src/lib/routes/*.test.ts`, `src/lib/{gear,onboarding,session-plans,sky-checks}/store.test.ts`, `src/lib/observations/milestone-store.test.ts`, `src/lib/observability/{fault,read-failure,save-failure,log-failure,silent-catch-guard}.test.ts`, `src/lib/auth/{middleware,session-user}.test.ts`, `src/lib/supabase.test.ts`, `src/lib/forecast/kv-cache.test.ts`, `src/lib/test-support/virtual-modules.test.ts`

**Intent** (D3): keep per route family one server-fault case (redirect key `errors.serverFault` + one error line with only `{step, name, code, status}`), one RLS-refusal notice case and one "non-form body logs `request.form`" case; keep `fault`'s classification table and "drops the message"; keep `log-failure`'s "never printed" cases and `silent-catch-guard`'s two guard tests plus three merged controls; delete per-call-argument choreography and `virtual-modules.test.ts` (its consumers prove the seams).

**Contract**: the exact counts are set in this phase's note after reading the merged files; the rubric and the kept-case list above are the contract.

#### 4. Star provenance after S-08

**Files**: `src/lib/catalogue/stars.test.ts` → 1-2, `src/lib/catalogue/finder-stars.test.ts` → 3-4 (pin and URL, "Credit: ESA", `HIPPARCOS_FIELDS_USED` / `FIELDS_USED` and the `hip_main.dat` `PINNED_SHA256`, the gzip budget), delete the server-only import scan (`build-sw.mjs:89-121` is the stronger gate); `scripts/lib/*.test.mjs` (S-08's 71 generator-helper tests): keep the provenance and licence cases, trim parsing tautologies, exact count in the note; `vitest.config.ts`: add the catalogue provenance files to the `guards` project

**Intent**: The licence-critical pins survive (ESA authorisation pending); the shape checks live with the generators.

#### 5. Docs

**Files**: `CLAUDE.md` tripwires (stars), `context/foundation/test-plan.md` §6.4 blind spots, the S-07 runbook if it names a test

### Success Criteria:

#### Automated Verification:

- `npm test` green; the unit total ≤ 750 by the JSON reporter across both projects
- Break checks red then reverted: a store returning a PostgREST `message` in `fault` (`fault` test), a new empty `catch {}` in a runtime file (`silent-catch-guard`), "Credit: ESA" removed from the meta (`finder-stars`)
- `npm run lint`, `npx astro check` green; `npm run test:unit` and `npm run test:guards` times recorded
- The whole e2e suite and smoke green locally before the PR

#### Manual Verification:

- The phase note lists every S-07 and S-08 pin as kept or dropped-with-replacement, and the final counts per project

---

## Phase 6: E2E and db trims

### Overview

Apply research §3.1 and §3.2: trim or merge about 18 e2e tests, move 5 checks to smoke, trim the operator-command and grammar-table db tests.

### Changes Required:

#### 1. Smoke steps

**File**: `scripts/smoke.mjs`

**Intent**: `nightOver` (post a stale `night` to `/api/tonight/plan` → `?error=errors.sessionPlan.nightOver`), one gear UPDATE route (`POST /api/gear/sites/<id>` with a changed name → `/gear?saved=site`, then read back), plus the landing, 404 and 301 steps if Phase 3 deferred any.

#### 2. E2E

**Files**: `tests/e2e/` per research §3.1: delete `landing.spec.ts`, `landing-screenshot.spec.ts` (keep the capture script outside the counted suite, e.g. `scripts/capture-landing.mjs` or a `test.skip`-free opt-in project), `sign-in-continue.spec.ts`; trim `finder-chart` t1/t4, `what-to-expect` t1/t2/t4, `tonight-sky` t4-t7, `toasts` t3/t6, `observing-progress` t2/t3, `red-night-mode` t2/t3, `tonight-targets` t2/t3, `tonight-phone` t4, `onboarding` t4, `planets-on-tonight` t2, `session-plan-edit` t2/t5/t7, `observation-log` t2, `observation-log-management` t2; merge `gear-catalogue` into `onboarding` t2, `moon-as-target` + `planets-on-tonight` t1 + `observation-log` t1 into one mark-observed journey, `observing-milestones` t1 with `observing-progress` t4, `sky-events` t2 into t1, `navigation` t3 with `tonight-subnav` t1/t2/t3/t5, `session-plan-store` reset into save

**Intent**: Browser specs stay on the journeys that need a browser (test-plan §7); duplicates of smoke and presentation detail go.

**Contract**: no `waitForTimeout`, no new retries; `tonight-phone` t1/t2 (owner-pinned) and every service-worker spec untouched.

#### 3. DB

**Files**: `tests/db/account-plan-command.test.ts` → about 6 (one spawn, one grant, one demote, one `--create`, one refusal of a hosted URL, one `show`), `tests/db/observations.test.ts` (target grammar: 3 accepted, 4 rejected rows), `tests/db/session-plans.test.ts` (`refuses %s` → 4 rows), `tests/db/milestones.test.ts` (drop `:93`)

#### 4. Docs

**Files**: `context/foundation/test-plan.md` §4 (e2e and db counts), §6.5 (known skips list), CLAUDE.md where a deleted spec is named (`landing-screenshot`'s capture command)

### Success Criteria:

#### Automated Verification:

- `npx playwright test --list` reports ≤ 72 tests; the whole e2e suite green locally against a production preview with local Supabase, run once with `--repeat-each 2 --workers 4` to surface a flake (test-plan §6.5)
- `npx vitest list --config vitest.db.config.ts` ≤ 100 named tests; `npm run test:db` green locally
- `npm run smoke` green with the new steps
- The PR's `smoke` job green with no retried test (`failOnFlakyTests`)

#### Manual Verification:

- The owner confirms the phone first screen is still pinned (`tonight-phone` t1/t2 untouched)

---

## Phase 7: Test-plan refresh and the lesson

### Overview

Record the new shape and the rule that keeps it.

### Changes Required:

#### 1. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: §4 counts and projects; §5 gates (two projects, drift check, smoke steps); §6.6 a "Diet" note with before/after counts and times; §7 a new bullet "Unit tests of implementation detail: schema accept/reject tables, formula restatements, mock choreography, props and class strings. Re-evaluate if a regression ships that only such a test could have caught."; §8 ledger dates.

#### 2. Lesson

**File**: `context/foundation/lessons.md`

**Intent**: One entry: "Test features, not implementation details: before adding a test, name the user-visible risk or invariant it is the only protection of; prefer a relation over a value, a smoke tuple over a schema test, one looping property over an `it.each` table; fold `it.each` rows and assert counts first."

#### 3. Handoff and CLAUDE.md

**Files**: `context/handoff.md` (an update block), `CLAUDE.md` (Commands block: `test:unit`, `test:guards`; the "Unit tests live next to the code" paragraph)

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (prettier on the edited markdown); the hook skips the docs-only change

#### Manual Verification:

- The owner reads the §6.6 note and the before/after table

---

## Testing Strategy

### Unit Tests:

- The suite under diet is the subject; each phase proves itself with the JSON reporter's counts, the kept pins' titles unchanged, and one break check per folded property.

### Integration Tests:

- Smoke steps added in Phases 3 and 6 run against a local production preview with local Supabase before each PR and in CI's `smoke` job; `tests/db` runs unchanged until Phase 6.

### Manual Testing Steps:

1. After Phase 0, make a one-line change in a worktree, end the turn, and time the hook.
2. After each deletion phase, read the phase note's pin ledger against research §2.
3. After Phase 6, open the live site on a phone-sized window once the deploy lands (the first-screen pin is unchanged, but it is the owner's).

## Performance Considerations

Measured targets (research §5): `npm test` about 8-10 s cold / 4-5 s warm locally and about 25 s in CI; `test:guards` about 15-20 s (ESLint config load); hook 12-25 s per Stop; e2e about 30-60 s shorter; the deploy critical path barely moves. Each phase writes its measurements into `implementation-notes.md`.

## Migration Notes

Not applicable: no data, no schema. Rollback of any phase is `git revert` of its PR; no phase depends on a later one except Phase 5 on Phase 0's projects.

## References

- Research: `context/changes/test-suite-diet/research.md` (inventory tables §2.1-§2.4, §3, the only-protection categories §4, targets §5, sequencing §6)
- Test strategy: `context/foundation/test-plan.md` §1, §6.3 (folded properties assert counts first), §6.4 (smoke tuple shape), §6.5, §7
- Lessons: `context/foundation/lessons.md` ("Run the whole e2e suite before a PR", "Resolving a rule's config is not proof the rule runs", the no-console rule)
- Hook: `.claude/hooks/end-of-turn.sh:88-131`; proof `src/lib/agent-hooks.test.ts:209-458`
- Smoke template: `scripts/smoke.mjs:278-282`; runner `:591-640`
- Guard couplings: `src/lib/no-console-guard.test.ts:43-53, :174-176`
- In-flight branches: `feat/error-visibility-2` (`context/changes/error-visibility/plan.md`), `feat/star-source-switch`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Two Vitest projects and a lighter hook

#### Automated

- [ ] 0.1 `npm test` runs both projects green with 2,605 tests unchanged
- [ ] 0.2 `npm run test:unit` excludes the five guard files and finishes under 12 s cold locally
- [ ] 0.3 `npm run test:guards` runs exactly the five guard files
- [ ] 0.4 `agent-hooks.test.ts` green and its clean case records a `--project unit` call
- [ ] 0.5 `npm run lint` and `npx astro check` pass
- [ ] 0.6 The `ci` job on the PR runs `npm test` green

#### Manual

- [ ] 0.7 One real Stop shows `vitest unit;` and the measured hook time in the note

### Phase 1: Engine suite to its reference core

#### Automated

- [ ] 1.1 `npm test` green; engine files ≤ 25 and tests ≤ 310
- [ ] 1.2 Three break checks red then reverted (window widened, bonus above the bar, pairing into daylight)
- [ ] 1.3 `npm run test:guards` green with the updated `ALLOWED_DISABLES`
- [ ] 1.4 `npm run lint`, `npx astro check` green; `test:unit` time recorded

#### Manual

- [ ] 1.5 The phase note lists every research §2.1 pin as kept or dropped-with-replacement

### Phase 2: Tonight, forecast, finder and components

#### Automated

- [ ] 2.1 `npm test` green; the slice's files ≤ 30 and tests ≤ 190 (deferred files excluded)
- [ ] 2.2 Three break checks red then reverted (clamped plan row, solar-safety line hidden, island imports the catalogue)
- [ ] 2.3 `npm run lint`, `npx astro check` green; `test:unit` time recorded

#### Manual

- [ ] 2.4 The phase note lists every research §2.2 pin as kept or dropped-with-replacement

### Phase 3: Leaf modules, offline rules and the smoke steps

#### Automated

- [ ] 3.1 `npm test` green; the slice's files ≤ 30 and tests ≤ 170 (deferred files excluded)
- [ ] 3.2 The 10 smoke steps pass locally and each refusal fails when its `absent:` value is removed
- [ ] 3.3 Two break checks red then reverted (chart kept after explicit free, milestone lost on delete)
- [ ] 3.4 `npm run lint`, `npx astro check` green; `test:unit` time recorded
- [ ] 3.5 Whole e2e suite and smoke green locally before the PR

#### Manual

- [ ] 3.6 The phase note lists every research §2.4 pin as kept or dropped-with-replacement

### Phase 4: Guards, parity and OpenNGC provenance

#### Automated

- [ ] 4.1 `npm test` green; `guards` ≤ 25 tests and the slice ≤ 45
- [ ] 4.2 The drift step passes on the PR and fails on a deliberate `caldwell.json` edit
- [ ] 4.3 `npm run test:guards` under 20 s locally
- [ ] 4.4 `npm run lint`, `npx astro check` green

#### Manual

- [ ] 4.5 The phase note records the `no-console-guard` file-floor count

### Phase 5: After S-07 and S-08 merge

#### Automated

- [ ] 5.1 `npm test` green; unit total ≤ 750 across both projects
- [ ] 5.2 Three break checks red then reverted (PostgREST message in a fault, new empty catch, ESA credit removed)
- [ ] 5.3 `npm run lint`, `npx astro check` green; both project times recorded
- [ ] 5.4 Whole e2e suite and smoke green locally before the PR

#### Manual

- [ ] 5.5 The phase note lists every S-07 and S-08 pin as kept or dropped-with-replacement, with final counts per project

### Phase 6: E2E and db trims

#### Automated

- [ ] 6.1 `playwright test --list` ≤ 72 tests; whole suite green locally incl. a `--repeat-each 2 --workers 4` run
- [ ] 6.2 db suite ≤ 100 named tests and green locally
- [ ] 6.3 `npm run smoke` green with the new steps
- [ ] 6.4 The PR's `smoke` job green with no retried test

#### Manual

- [ ] 6.5 The owner confirms the phone first screen stays pinned

### Phase 7: Test-plan refresh and the lesson

#### Automated

- [ ] 7.1 `npm run lint` passes and the hook skips the docs-only change

#### Manual

- [ ] 7.2 The owner reads the §6.6 note and the before/after table
