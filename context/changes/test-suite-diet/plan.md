# Test-Suite Diet Implementation Plan

> **Status (2026-10-17, after plan review):** revised on origin/main 85aa123 (S-07 #194 and S-08 #193 merged; #195 `fix/star-source-review` still open; S-06 `feat/auth-loose-ends` paused with research only). Decisions D1-D9 below are the owner's (2026-10-17) as relayed by the orchestrator; findings F1-F9 of `reviews/plan-review.md` are applied. The interactive interview did not run (the question tool was forbidden for this run). Nothing here authorises implementation.

## Overview

Cut the Vitest suite from 3,054 tests in 156 files to about 700-820 tests in about 100 files by deleting implementation-detail tests, folding `it.each` inflation, merging duplicates and converting refusal checks to HTTP smoke steps, while keeping, in two Vitest projects (`reference`, run by the hook and CI; `guards`, CI only), the tests that are the only protection of a PRD requirement, a privacy or licence invariant, a pure decision rule or a fixed bug. Trim e2e and db modestly. Small phases, one PR each; the star-provenance phase waits for #195.

## Current State Analysis

Measured 2026-10-17 on origin/main 85aa123 in this worktree (`npx vitest run --reporter=json`, see research "Baseline refresh"):

- `npm test`: 156 files / 3,054 tests (3,044 pass, 4 skipped, 6 todo), 27.9 s cold locally; file-time sum 68.0 s. The slowest files: `no-console-guard` 17.9 s, `agent-hooks` 11.5 s, `engine/pairings` 8.3 s, `engine/events` 6.3 s, `tonight/build` 3.9 s, `catalogue/finder-stars` 3.6 s, `engine/finder` 3.5 s, `tonight/visibility-invariants` 2.5 s. `vitest.config.ts` already includes `scripts/**/*.test.mjs` (S-08: 71 tests in `scripts/lib/`).
- The hook (`.claude/hooks/end-of-turn.sh`, line `OUT=$(node_modules/.bin/vitest run …)`) re-runs the whole suite plus type-aware ESLint on every Stop that changed a non-doc file: 25-45 s per Stop.
- S-07 (#194) added 23 files / about 450 tests at the runner (route handlers over `src/lib/test-support/{route-context,supabase-fake}.ts`, store suites, `observability/{fault,read-failure,save-failure}`, `auth/{middleware,session-user}`, `supabase`, `forecast/kv-cache`) and grew `log-failure` 29 → 60, `service` 27 → 38, `finder/load` 18 → 25, `tonight/load` 13 → 22, `build` 127 → 133, `account-plan` 13 → 18, `observations/store` 6 → 14, `sky-checks/record` 6 → 11. They are on main, so they are cut with their slices (D3, F1).
- Still open: #195 (`fix/star-source-review`) touches `stars.test.ts`, `finder-stars.test.ts`, `scripts/lib/{designations,hipparcos}.test.mjs`, `tests/e2e/landing-screenshot.spec.ts`. Only Phase 5 waits for it. S-06 (`feat/auth-loose-ends`, D1 and D2 of ui-auth) is paused with research only; Phase 3 touches auth tests and smoke auth steps, so whichever lands second rebases.
- e2e: 33 specs / 88 tests (3-4 min in CI); `tests/db`: 9 files / 118 named tests; smoke: 45 sequential steps with exact `Location` pins (`scripts/smoke.mjs`, the `steps` array). `landing.spec.ts` now also pins the "Credit: ESA" footer and its wrap at 320/360 px (S-08).
- Couplings: `no-console-guard.test.ts` allowlists `calibration`, `determinism`, `events` and `finder` test files and asserts each exists ("checks the whole source tree"); it also requires ≥ 300 files under `src` (309 non-test today). `TONIGHT_NAV` / `TONIGHT_PAGES` parity lives only in `navigation.test.ts`.

## Desired End State

- `vitest.config.ts` defines two projects: `reference` (include `src/**/*.test.ts` and `scripts/**/*.test.mjs`, minus the guard list) and `guards` (the static guards, the hook proof and, after Phase 5, the provenance tests). `npm test` runs both; `npm run test:reference` is what the hook runs; `npm run test:guards` is CI only.
- About 700-820 tests in about 100 files; `npm test` about 10-12 s cold locally and about 30 s in CI; one hook Stop about 12-25 s.
- Every remaining test is an independent-reference check, a PRD rule or invariant as a relation, a privacy or licence pin, a fixed-bug pin (the ledger below), a pure decision rule with no other oracle, or a static guard with no cheaper gate.
- Twelve new smoke steps pin refusals and redirects, each refusal followed by a read-back that nothing was written; e2e about 65-70 tests in about 29 specs (the ESA footer tests kept); db about 95 named tests.
- Each phase's `implementation-notes.md` section lists the pins it kept, replaced or dropped against the ledger, the before/after counts per file, the measured times and the `grep` of docs it updated.

Verify: `npx vitest run --reporter=json` counts per project and file; `/usr/bin/time -p npm run test:reference`; the `ci` job's `npm test` step time; `npx playwright test --list`; `npx vitest list --config vitest.db.config.ts`.

### Key Discoveries:

- Moving `no-console-guard` and `agent-hooks` (29.4 s of file time) out of the hook's project is the single biggest latency win.
- Six files account for about 600 tests through `it.each` and fold to about 60 with identical protection: engine `night-boundaries` (130), engine `visibility-invariants` (203), tonight `visibility-invariants` (100), `small-scope` (69), `log-night` (60), `rhythm-roles` (105).
- `scripts/smoke.mjs` is the HTTP integration layer: one `[name, run, expected]` tuple per step with `exact`, `absent`, `bodyIncludes` / `bodyExcludes`; the invalid-latitude step ("invalid site returns to form with error") is the template.
- The e2e suite cannot replace the reference suites or invariants: Madrid only, real clock, 0 % cloud fixture, 1-3 specs skip on most nights.
- `runner-zone-guard.test.ts` names the zone reads it cannot catch statically (`toLocaleString()`, implicit `${date}`, `new Date(d + "T20:00")`, spread), so the runtime zone tables stay the only protection of those classes (F8).
- `finder/load.test.ts` "answers a failed plan read like a free account" is `requireFullPlan`'s documented fail-closed rule (`src/lib/account-plan/index.ts`, "anything unknown is free"), not a bug; keep the pin.

## Decisions (owner, 2026-10-17; relayed by the orchestrator)

| # | Decision | Choice | Notes |
| --- | --- | --- | --- |
| D1 | Static guards and engine reference suites | Keep both; the author's plan, about 700-820 tests on the new base (F6's deeper ≤ 450 cut **declined**); two projects renamed `reference` and `guards` (costs nothing: Phase 0 creates them) | The reference suites are the only protection of PRD Success Criterion 2, the 1°/5 min, determinism and coordinates-never-logged NFRs and FR-024 |
| D2 | Hook scope | `vitest run --project reference` (the whole fast project) + ESLint on changed files; never `guards` | |
| D3 | S-07's tests | Cut **now**, same rubric, with their slices (Phases 2-4); fixed per-file targets below | S-07 phases 2-6 are merged (#194) |
| D4 | Smoke conversions | 12 new tuples; every refusal step also asserts nothing was written; auth steps aligned with S-06 (paused; whoever lands second rebases) | Phase 3 (10 steps), Phase 6 (2) |
| D5 | E2E trims | About 18 trims/merges + 4 moves to smoke, **except** the "Credit: ESA" footer tests in `landing.spec.ts` stay (F4); the compass test (`tonight-sky` "the compass row marks the point nearest the middle of the view…") is removed as a recorded owner decision; `landing-screenshot` moves to a script only after #195 | Phase 6 |
| D6 | DB trims | `account-plan-command` 21 → about 6; grammar tables to a few rows; nothing else in `tests/db` | Phase 6 |
| D7 | Catalogue provenance | **No** CI regeneration step; keep only the about 8 licence/provenance tests (OpenNGC pin + licence for Messier and Caldwell, HYG/Hipparcos pins, "Credit: ESA", `HIPPARCOS_FIELDS_USED`, gzip budget, NASA/IAU note); the shape checks go | The committed JSON's shape is then checked only by the generators at regeneration (owner-accepted gap, ledger) |
| D8 | Order | Phase 0 now; Phases 1-4 including the S-07 files; Phase 5 (stars, `scripts/lib`, `landing-screenshot`) after #195 merges; Phase 6 e2e and db; Phase 7 docs | One PR per phase |
| D9 | Coordinate rounding and longitude echo | Product rule, no separate test; the error-key construction (zod messages are catalogue keys, `?error=` values are fixed keys, smoke pins `absent:`) prevents a longitude echo; recorded as an owner-accepted gap (F7) | |

## Pin ledger (F3, D9)

Titles are describe / it titles on origin/main 85aa123 (F5: never line numbers). "kept" means the test stays with its title unchanged; "replaced by" names the test, spec or smoke step that holds the same rule after the phase; "dropped (owner)" is a recorded owner decision. Every phase note cites this table; a row not listed here is not a pin and may be cut by the rubric.

| File | Pin (title) | Origin | Disposition |
| --- | --- | --- | --- |
| engine/events | "gives a partly visible eclipse at sunrise a best moment with the Sun up and the eclipse still going, not the last contact (impl review F5)"; "puts the best moment of a rising-Moon eclipse where the Moon clears 2° while the partial phase is still going, not at the contact (impl review F5)"; "keeps a solar eclipse in the answer until its partial phase ends, in the previous night's window too (owner decision A, 2026-10-14)" | sky-events review F5, decision A | kept (Phase 1) |
| engine/meteors | "still lists a peak that fell the night before the window when its best night is the window's first (sky-events Phase 5)"; describe "the bright-Moon flag needs the Moon up in the span, not only a bright phase" | sky-events Phase 5, F10 | kept (Phase 1) |
| engine/pairings | describe "a pairing that is visible only in a short stretch of twilight" (3 cases: 2020-12-21 Warsaw, 2026-06-09 Warsaw, 2026-04-20 Sydney) | sky-events impl review F1 | kept (Phase 1) |
| engine/score | "never rises under a worse sky, for every catalogue galaxy at every aperture (impl review F5)"; describe "saturating at DURATION_USEFUL_SPAN_MINUTES"; "takes at most GALAXY_FAINT_BRIGHTNESS_CAP in the faint band…"; "takes GALAXY_LIMIT_BRIGHTNESS_CAP in the limit band…" | small-scope F5, #21, #172/#159 | kept (Phase 1) |
| engine/ranking | describe "reasonComponents" (the below-the-mean rules, owner 2026-10-16); "never lifts an object whose own score is below the bar into the list"; "changes nothing on the new-Moon night of 2026-10-10: … a top five of AF's fall picks with M31" | #159, retune pin, AF set check | kept (Phase 1) |
| engine/small-scope | G1, G3, G4 ("… with its brightness credit uncapped", impl review F5), G5 (folded to one loop, title kept), G6 ("M31 reads galaxyFaint and is not in the top 5 …", owner F6) | #159, F5, F6 | kept, G5 folded (Phase 1) |
| engine/evening-showpieces | the October showpieces median relation and the M13 short-night case | #21 item 1 | replaced by the same two cases moved into `calibration.test.ts` (Phase 1) |
| engine/window-reference | the three `it.each(REFERENCE_NIGHTS)` edge-and-peak checks | #21 item 4 | kept (Phase 1) |
| engine/outlook | "passes over a go-shaped night 2 with a dark hour missing, judging it, and is none up to night 3"; "reads the same next night off the seven-night outlook (nextNightInOutlook)" | forecast-honesty review, seven-night F1 | kept (Phase 1) |
| engine/verdict | "is never a go with a dark hour missing, even with a long enough clear run elsewhere"; "has no weather data when the series ends partway through the window"; describe "clearIntervals" "breaks a stretch at an hour missing from the forecast" | forecast-honesty F1, #65 | kept (Phase 1) |
| engine/planet-ranking | describe "with visible intervals" (3 cases) | #65 planets ranked under cloud | kept (Phase 1) |
| engine/moon-target | "counts only samples inside visibleIntervals, keeping timing relative to the whole window"; "is null when every hour the Moon is up is cloudy"; the 3 % floor case | moon-as-target F3 | kept (Phase 1) |
| engine/sun | describe "tonightDateFor"; "handles a polar night where the sun is already below the threshold at local noon"; describe "sun events vs Stellarium fixtures" | telescope-selector F1 (fb48a0f2), verified-ephemeris review | describe "tonightDateFor" replaced by engine `night-boundaries` (c) "either side of civil dawn" and (d) "wall-clock traps"; the other two kept (Phase 1) |
| engine/night-boundaries | (a)-(d) under `describe.each(RUNNER_ZONES)` | Risk #2 classes (morning planet prefill, noon rollover F1) | kept, run in two zones of opposite sign: `America/Los_Angeles` and `Pacific/Kiritimati` (F8) (Phase 1) |
| engine/finder | describe "the zenith's edge marker" (4 cases); "agrees with a brute-force enumeration of every simple route on 150 skies"; describe "published hops (D-11)" | finder-chart F2 / owner 2026-10-13, D-11 | kept (Phase 1) |
| engine/expectation | describe "expectationFor: the reference fixture (D-6)"; describe "expectationFor: the invariants (D-3)" | what-to-expect D-3, D-6 | kept (Phase 1) |
| engine/ranking-invariants | (a)-(g), incl. "(g) aperture never shrinks the cleared set …" | Phase 3 rollout | kept (Phase 1) |
| forecast/night-in-progress | "judges the verdict on the evening hours that a past_days=1 response carries" | archive 2026-09-25 | kept; the other case dropped as a duplicate (Phase 2) |
| forecast/service | describe "getForecast with a 200 that is not a complete series" (6 cases); "falls back to a stale copy of any age when the fetch fails, flagged as a fallback" | test rollout Phase 1 (red before the fix) | kept (Phase 2) |
| forecast/degraded-forecast, tonight/forecast-honesty | whole files | Risk #1 | kept (Phase 2) |
| tonight/night-boundaries | (a)-(c) under `describe.each(RUNNER_ZONES)` | Risk #2, planets-on-tonight prefill, verdict-check month end | kept, two zones of opposite sign as above (Phase 2) |
| tonight/build | "moves to the evening ahead once civil dawn has passed"; "says no planet is up in the clear hours when the only clear spell has none"; "keeps the dark window and the Moon target in the clear hours of a cloudy no-go night, with no faint line"; "says nothing about moonlight on the moonless night of 2026-10-10"; "links an object below the ranking's bar to its finder chart, and the others to the Targets list"; "reads 'Tomorrow, 11:22' on the night before the 2027-08-02 solar eclipse at Warsaw, never 'Tonight' (owner, 2026-10-14)"; "keeps the 2027-08-02 eclipse in view on its own morning, after dawn, until its partial phase ends (owner decision A, 2026-10-14)"; "ends the night at the civil dawn after it" | planets-on-tonight, moonlight, F9, decision A, Risk #2 | kept (Phase 2) |
| tonight/plan-order | "flags a row whose window ends before the previous row's best time" | adjustable-session-plan D2 b | replaced by one `orderHints` case kept in `tonight/plan-editor.test.ts` (the editor's hint announcement) (Phase 2; F3) |
| tonight/sky-events | describe "a solar eclipse is first on the line, so its glasses never hide behind '+N more' (impl review F3)"; describe "a solar eclipse stays until its partial phase ends, worded from today's date (owner decision A, 2026-10-14, F2)"; "puts a planet's title with no colon on the tile and a lowercase form after the colon on the line (impl review F6)"; describe "the bright-Moon note belongs to a visible shower only (impl review F10b)" | sky-events F3, F2, F6, F10b | kept (Phase 2) |
| tonight/load | "still builds Tonight in a forecast outage with nothing stored, as No forecast"; "names one night for the reader and the build, before and after civil dawn"; describe "loadTonight's failure lines (error-visibility)" (one case per line) | forecast-honesty, adjustable-session-plan D14, S-07 | kept (Phase 2) |
| tonight/requested-gear | "reads but never remembers the site of a next-night request" | offline-night-plan F5 | kept (Phase 2) |
| tonight/visibility-invariants | describe "An edited Session plan never draws a target outside its window (adjustable-session-plan)" | adjustable-session-plan | kept as its own folded test; it replaces `tonight/plan-edits.test.ts` (Phase 2; F3) |
| tonight/format | "truncates the sun's depth so a near miss always reads short of the threshold"; "rounds the low wording down, so a peak just under the low line never reads as the line itself"; the DST describe "times in the site's zone (NFR daylight-saving)" | no-go explanations, moonlight | kept (Phase 2; F3) |
| finder/load | "answers a failed plan read like a free account"; describe "loadFinderFor from the Session plan (adjustable-session-plan F9)"; describe "loadFinderFor's failed state leaves a line (error-visibility, Phase 5)" | finder-chart, F9, S-07 | kept (Phase 2) |
| account-plan/account-plan | "is unknown when the read fails, logs a fixed line and the code once, and leaves access closed (reviews F11, F4)"; describe "what the failed read's line holds (review F5)" (fold to 1); describe "the time the plan was read (review F1)" | finder-chart reviews | kept, the F5 describe folded (Phase 3) |
| observations/celebrate | "records a key reached before and after (a backfill) but celebrates only the newly reached one"; "records first-galaxy from before when an edit moves it away (M31 to M13)"; "stores the milestone before a delete takes its only entry away"; "celebrates nothing after a failed record, still confirms the save, and logs the fixed line"; describe "reachedBySave traces a failed milestone step under the route's own step" | milestones F1-F4, plan F11, S-07 | kept (Phase 3) |
| observations/redirect | "drops any value that is not a target key, uuid or calendar date, so free text never reaches the URL"; "returns to Tonight for a missing, unknown or log value"; "encodes a hostile id so it stays one path segment"; "is empty without the param, and signed out whatever the URL says" + the coordinate-never-a-notice and fixed-milestone-keys cases | milestones plan F3, Risk #6 | kept (Phase 3) |
| observations/store | "skips no row when the host returns fewer rows than a page (a lower max_rows)" | observing-progress F2 | kept (Phase 3) |
| observations/log-night | (a)-(c) | Risk #2 | kept in one zone (`America/Los_Angeles`); the zone rule is held by `night-boundaries` (Phase 3; F8) |
| offline/coalesce | "re-runs once, for the latest value, after the run in flight (not dropped, not stacked)" | adjustable-session-plan F10 | kept (Phase 3) |
| offline/copies | "reads a bare Messier number as the island's canonical key (F14b)"; "refuses the three mismatches (F14a)"; "reads the plan, and a missing or unrecognised one as unknown, never free (F11)"; "refuses a finder island that was not rendered for the full plan (F11)"; "reads a missing or other plan as unknown, which drops nothing (F11)"; "an unknown plan commits a Tonight pair and drops nothing (F11)"; "refuses a stale full chart after freeSince, and a newer full island clears it (F12)"; "compares the plan-read time, not the render time: a chart built late from an earlier read is refused (F1)"; "is the answer's own plan-read time, before its Date header (F1)"; "keeps a stored plan-read time, and falls back to preparedAt for an unreadable one (F1)"; "moves the last site only for a page the user opened, not a next-night copy"; "purges first for a commit by another owner, even with no copies left"; "purges first when copies are there without an owner (stored before owners)"; "expires per site and moves the last site to the newest site left"; "is false for a finder chart, whatever is stored (no next-night copy of a chart, D-13)"; "drops a copy whose times cannot be read, which would never expire"; "accepts the plan page with no param"; the `listCopies` events-last / chart-last order cases | finder-chart F1/F11/F12/F14, offline-night-plan F1/F2/F4/F5, adjustable-session-plan F2a/F10, D-13 | kept (Phase 3) |
| progress/milestones | describe "withStored" (3 cases); describe "newlyReached" | plan F11 | kept (Phase 3) |
| session-plans/checks | "leaves out the keys the stored list already had, keeping the posted order"; "is empty when the list only drops or reorders keys" | adjustable-session-plan F4 | kept (Phase 3) |
| sky-checks/pending | "steps back across a month and a year boundary"; "crosses a month boundary" | verdict-check | kept (Phase 3) |
| toasts | describe "celebrationHolding (a milestone celebration holds a toast's timer, impl review F1)" | milestones F1 | replaced by `observing-milestones.spec.ts` ("…celebration dialog shown once, toast waits, focus goes to main") (Phase 3) |
| components/ui/fact-icons | "keeps the solar eclipse's own Eclipse icon (owner decision D4)" | presentational | dropped (owner, presentational; `/design` shows it) (Phase 2) |
| routes/*, auth/session-user, auth/middleware | every "never lets … reach a log argument or the redirect" case; "still redirects when Auth is down (a 503), and now leaves one auth.claims line without the email" | S-07 privacy contract | kept (Phase 3) |
| observability/log-failure | describe "what is never printed" (3 cases); describe "never throws" (folded to 2) | S-07 / finder F4 | kept (Phase 4) |
| observability/fault | "leaves no trace of the original message, details or hint anywhere on the carrier"; "leaves no trace when the error is a real Error whose message and stack hold the values"; the `classifyFault` table (one loop) | S-07 review F1 | kept (Phase 4) |
| observability/silent-catch-guard | describe "silent-catch guard" (3 tests) | S-07 | kept (Phase 4) |
| agent-hooks | "sends the agent back when a changed file is broken, naming it on stderr"; "lets a clean change finish with nothing on stderr"; "lets the retry pass finish, and tells the user the turn ended red"; "fails visibly when a tool is missing, naming it, never passing silently"; "treats a SubagentStop payload like Stop"; "every script parses (bash -n)"; "every command in .claude/settings.json reaches its script from a worktree, whatever CLAUDE_PROJECT_DIR says"; **regression pins kept (F3):** "notices an untracked file whose path is longer than 255 bytes"; "does not follow an untracked symlink (a link to /dev/zero would never end)"; "does not judge a subagent on what the parent left half done" | Phase 5 rollout, #150 F1-F10 | kept (10 tests) (Phase 4) |
| no-console-guard | "checks the whole source tree"; "gives every source file no-console at error"; the disables test; "reports no-console end to end" samples | access-boundary F3, S-06 F2 | kept (Phase 4) |
| wrangler-config | "keeps the invocation event off" and the rest | production finding 2026-10-16 | kept (Phase 4) |
| catalogue/caldwell | the Rosette relabel and the C30 quoted-`;` cases | deep-sky impl review | dropped (owner, D7): the generator asserts them at regeneration; the committed JSON's shape is an accepted gap |
| catalogue/finder-stars | "Credit: ESA", the HYG/Hipparcos pins, the gzip budget | finder-chart F3/F5, ESA licence | kept (Phase 5) |
| compass (unit) and `tonight-sky.spec.ts` "the compass row marks the point nearest the middle of the view, and follows the strip" | 16-wind mapping | — | dropped (owner, D5/F7): the mapping is reviewed by screenshot |
| preferences | `resolveLocale` Accept-Language cases and the one-year cookie | — | dropped (owner, F7): a wrong default language is corrected by the cookie |
| gear/schemas "never echoes a rejected coordinate in its error messages", onboarding/schemas and observations/schemas no-echo cases | Risk #6 | — | dropped (owner, D9/F7): zod messages are catalogue keys by construction, `?error=` is a fixed key, smoke pins `absent: "95"` (latitude) and the Phase 3 steps pin `absent: "52.23"` (a coordinate in `target` and in `site=`); the longitude echo has no smoke pin |

## What We're NOT Doing

- No product or source change under `src/` except the merged island-import guard, test helpers whose consumers go, and the `fixtures/` files that become unused. Behaviour never changes.
- No CI regeneration or drift step for the catalogues (D7).
- Not resolving the finder's "failed plan read → locked" product question.
- Not changing Playwright's worker count, CI runners, `migrate` or `deploy`.
- Not deleting any `tests/db` file; not weakening any RLS, structure or RPC case.
- Not deleting fixture data files a kept test reads; `stellarium/*.json` stay for `sun.test.ts`.
- Not rewriting kept tests for style.
- Not touching #195 or S-06 branches; Phase 5 works on main after #195 merges.

## Implementation Approach

One rubric per test:

1. **Delete** only as a named: (a) duplicate of a test, spec or smoke step; (b) formula, constant or type shape restated; (c) zod accept/reject row whose refusal smoke now pins, or that is not a privacy rule; (d) mock choreography; (e) matcher self-test of a guard, folded into one loop control.
2. **Fold** an `it.each` property into one test that asserts the non-vacuity counts first (test-plan §6.3) and names the case index in every failure.
3. **Keep** every ledger pin as listed; a dropped pin is one the ledger marks dropped (owner).
4. **Convert** before deleting: the smoke tuple (`exact: true`, `absent:`, a read-back that nothing was written) lands first.
5. **Prove** each phase: `npm test`, `npm run lint`, `npx astro check` green; JSON-reporter counts at or under the per-file targets; one deliberate break check per folded property, red then reverted; times measured and written down.
6. **Update** in the same PR every document that names a removed or moved test, found by `grep -rn '<file>' CLAUDE.md context/foundation context/deployment` and pasted into the phase note (F9).

Each phase is one PR off main, run by the implementer with the `nvm use` prefix; the whole e2e suite and smoke run locally before the PRs of Phases 3, 5 and 6 (lessons.md).

## Critical Implementation Details

- **Vitest projects and the hook.** Vitest 5 `test.projects` entries extend the root config by default (alias, `forks`). The hook's call becomes `node_modules/.bin/vitest run --project reference`; the sandbox stub in `agent-hooks.test.ts` already echoes `vitest $*`, and "lets a clean change finish with nothing on stderr" must assert `toContain("vitest run --project reference")` (F2).
- **`no-console-guard` couplings.** Removing a file listed in `ALLOWED_DISABLES` without removing its entry fails "checks the whole source tree"; lowering a kept file's console lines without lowering its count fails the disables test. Edit the guard in the same commit. The ≥ 300 floor holds (about 309 non-test + about 100 test files) but is recorded in Phase 4's note.
- **Folding runner zones (F8).** Keep two zones of opposite sign from `RUNNER_ZONES`: `America/Los_Angeles` (−7/−8) and `Pacific/Kiritimati` (+14); call the code under test inside `it`, never at `describe` scope; start each block with `expectRunnerZoneActive(zone)` (test-plan §6.2).
- **Smoke is sequential on one user.** New steps go after the step that creates their state; every refusal step is followed by a read-back (`bodyExcludes` on the page, or the island still `suggested`) that nothing was written (D4). Auth steps: S-06 (paused) will change sign-in/sign-up behaviour (ui-auth D1, D2); the auth tuples must assert only what S-06 does not change (the `?next=` continuation, the 30-day cookie, the off-site `next` refusal); whichever lands second rebases.

## Phase 0: Two Vitest projects and a lighter hook

### Overview

Split the suite into `reference` and `guards`, move the five static guard files to `guards`, make the hook run `reference`. No test is deleted.

### Changes Required:

#### 1. Vitest projects

**File**: `vitest.config.ts`

**Intent**: Two named projects so CI runs both and the hook runs one.

**Contract**: `test.projects`: `reference` with include `["src/**/*.test.ts", "scripts/**/*.test.mjs"]` and exclude of the guard list; `guards` with include exactly `src/lib/no-console-guard.test.ts`, `src/lib/agent-hooks.test.ts`, `src/lib/runner-zone-guard.test.ts`, `src/styles/no-hardcoded-colors.test.ts`, `src/styles/rhythm-roles.test.ts`. Root `environment: "node"` and `pool: "forks"` stay with their comment (F2).

#### 2. Scripts

**File**: `package.json`

**Contract**: `"test": "vitest run"`, `"test:reference": "vitest run --project reference"`, `"test:guards": "vitest run --project guards"`.

#### 3. The hook

**File**: `.claude/hooks/end-of-turn.sh`

**Contract**: the `vitest run` call becomes `vitest run --project reference`; `SUMMARY` reads `vitest reference;`; the header comment says the guards run in CI.

#### 4. The hook proof

**File**: `src/lib/agent-hooks.test.ts`

**Contract**: "lets a clean change finish with nothing on stderr" asserts the recorded call contains `vitest run --project reference` (F2). Nothing else changes in this phase.

#### 5. Docs

**Files**: `CLAUDE.md` (Commands block; the "Agent hooks" tripwire), `context/foundation/test-plan.md` §4 (unit row: two projects) and §5 (end-of-turn gate: `reference` project; note that the colour, rhythm and runner-zone guards now report in CI only)

### Success Criteria:

#### Automated Verification:

- `npm test` runs both projects green with `numTotalTests` equal to the count measured on main just before the change (3,054 at 85aa123; re-measure after rebase)
- `npm run test:reference` excludes the five guard files and finishes under 15 s cold locally (time in the note)
- `npm run test:guards` runs exactly the five guard files
- `src/lib/agent-hooks.test.ts` green and its clean case records `vitest run --project reference`
- `npm run lint` and `npx astro check` pass
- The `ci` job on the PR runs `npm test` green

#### Manual Verification:

- One real Stop in a worktree with a changed `.ts` file shows the hook's summary `vitest reference;` and the measured hook time in the note (before: 25-45 s)

---

## Phase 1: Engine suite to its reference core

### Overview

`src/lib/engine/*.test.ts` from 31 files / 929 tests to about 24 files / about 300 tests, keeping every ledger pin. No overlap with #195 or S-06.

### Changes Required:

#### 1. Merges and deletions

**Files**: `evening-showpieces.test.ts` (its two reference relations move into `calibration.test.ts`; delete), `night.test.ts` (five span cases move into `night-boundaries.test.ts` (a); delete)

**Contract**: `calibration.test.ts` keeps the k ≥ 3 oracle and the Messier-bonus bounds and gains the showpieces median relation and the M13 short-night case.

#### 2. Folds

**Files**: `night-boundaries.test.ts` (130 → 26: `describe.each` over `America/Los_Angeles` and `Pacific/Kiritimati` only, F8), `visibility-invariants.test.ts` (203 → 4, one looping test per target kind plus the count preconditions), `small-scope.test.ts` (69 → 7, G5 one loop), `calibration.test.ts` (16 `it.each` → 4)

**Contract**: folded tests assert the counts first (≥ 150 dark-window cases, 3,000 object entries, 20 southern, 10 above 60°, 50 planet entries) and name the case index in failures.

#### 3. Trims (targets)

`contrast` → 1, `determinism` → 2 (drop the console budget tests), `events` → 25 (shorten the 1,000- and 5,500-night scans to windows that hold the pins), `expectation` → 7, `eyepieces` → 10, `finder` → 30, `log` → 3, `meteors` → 14, `moon-disc` → 2, `moon-target` → 5, `moon` → 8 (drop the 3 Stellarium todos), `moonlight` → 3, `objects` → 3 (drop the 3 todos), `outlook` → 16 (drop the Tromsø sweep), `pairings` → 15 (keep the Skyfield block, the twilight describe and one of the two independent-altitude oracles), `planet-ranking` → 5, `planets` → 4, `ranking` → 15, `score` → 15, `sky-frames` → 1, `sun` → 9, `verdict` → 29, `window-reference` → 10, `ranking-invariants` → 11, `purity` unchanged.

**Intent**: Remove restated formulas, constants and the cross-file duplicates named in research §2.1 (ratings 1-2 inert ×3, below-minimum ×2, washed-out ×2, brightness monotonicity ×3, M31 at 60 mm ×3, moon-target's eyepiece block, meteors' radiant cases inside the events invariant).

#### 4. Guard allowlist and fixtures

**Files**: `src/lib/no-console-guard.test.ts` (`ALLOWED_DISABLES`: drop `determinism` and `events` if their console lines go; keep `calibration` and `finder` if the opt-in prints stay), `src/lib/engine/fixtures/README.md` (retire the pending Stellarium Moon and objects sections)

**Contract**: every file under `fixtures/` is still imported by a kept test (grep in the note).

#### 5. Docs (F9)

`CLAUDE.md` Engine paragraph (`small-scope.test.ts (G1-G6)` keeps the G names; `purity.test.ts` unchanged), `context/foundation/test-plan.md` §6.3 file list.

### Success Criteria:

#### Automated Verification:

- `npm test` green; engine files ≤ 25 and engine tests ≤ 310 by the JSON reporter
- Break checks, each red then reverted: widen a deep-sky window by one sample (`visibility-invariants` fold), lift `MESSIER_RANK_BONUS` above the bar (`ranking-invariants`), shift a pairing's best moment into daylight (the twilight describe)
- `npm run test:guards` green with the updated `ALLOWED_DISABLES`
- `npm run lint`, `npx astro check` green; `test:reference` time recorded

#### Manual Verification:

- The phase note lists every ledger row of this phase as kept or replaced, and the docs grep

---

## Phase 2: Tonight, forecast, finder and components, including the S-07 files

### Overview

The slice from 39 files / about 655 tests to about 29 files / about 215 tests. The S-07 files are cut here with the same rubric (D3): `tonight/build` (133 → 40), `tonight/load` (22 → 9), `forecast/service` (38 → 24), `forecast/open-meteo` (9 → 2), `finder/load` (25 → 10), `forecast/kv-cache` (4 → 2).

### Changes Required:

#### 1. Components

**Files**: delete `src/components/design/finder-samples.test.ts`, `src/components/nav-type-roles.test.ts`, `src/components/tonight/subnav.test.ts`, `src/components/ui/fact-icons.test.ts` (ledger: dropped, owner); merge `MoonTimeSlider.test.ts`, `TonightSkyView.test.ts`, `fact-islands.test.ts` into `src/components/island-imports.test.ts` (3 tests: the scan over the same files and forbidden lists, one positive control per list family, one in-memory self-test)

#### 2. Finder, moon-disc, sky-view

`finder/chart-svg` → 5, `finder/example-chart` → 1 (regeneration moves to `scripts/`), delete `finder/from`, `finder/steps` → 3, `finder/load` → 10 (ledger pins + failed read, no DB, order; free/full/demoted/signed-out duplicate smoke `finder 1/3/4/6`), `moon-disc/geometry` → 6, `moon-disc/label` → 2, delete `moon-disc/state`, `sky-view/sky-view` → 3

#### 3. Forecast

`degraded-forecast` unchanged, `forecast-honesty` unchanged, `service` → 24 (ledger describe + fallback + the S-07 `forecast.*` lines one case each; absorb `cache.test.ts`'s timeout case and delete that file), `open-meteo` → 2 (coordinate-free error; S-07 "no property holds the URL"), `night-in-progress` → 1, `kv-cache` → 2 (missing binding logs once per isolate; present binding logs nothing)

#### 4. Tonight

`all-objects` → 2, delete `altitude-curve`, `build` → 40 (research §2.2 blocks A-N kept lines, titles in the ledger, plus the five S-07 catch lines as one case each), `expectation` → 1 table test, `format` → 8 (DST describe, the headline table, the two ledger pins), `gear-choice` → 2, `load` → 9, `night-boundaries` unchanged apart from the two-zone fold (30 → 12, F8), delete `plan-editor-view`, `plan-editor` → 4 (cap, duplicate add, edge no-op, and the `orderHints` hint announcement that replaces `plan-order`), delete `plan-edits` (replaced by the edited-plan describe in `visibility-invariants`), delete `plan-order`, `plan-window` → 9, `requested-gear` → 1, `session-plan` → 1, `sky-events` → 10, `visibility-invariants` 100 → 8 (the edited-plan describe stays its own test)

#### 5. Docs (F9)

`CLAUDE.md` UI section (`fact-islands.test.ts` → `island-imports.test.ts`; `TonightSkyView.test.ts`; `nav-type-roles.test.ts` sentence removed), `context/foundation/test-plan.md` §6.1 (`load.test.ts` still named) and §6.3.

### Success Criteria:

#### Automated Verification:

- `npm test` green; the slice ≤ 30 files and ≤ 230 tests by the JSON reporter
- Break checks red then reverted: a Session plan row clamped past its window (`visibility-invariants` fold), the solar-safety line dropped behind "+N more" (`sky-events` F3), an island importing `@/lib/catalogue` (the merged guard), a 200 ending 60 h after now replacing a usable copy (`service` ledger describe)
- `npm run lint`, `npx astro check` green; `test:reference` time recorded

#### Manual Verification:

- The phase note lists every ledger row of this phase as kept or replaced, and the docs grep

---

## Phase 3: Leaf modules, S-07 routes and stores, offline rules and the smoke steps

### Overview

The leaf files (about 722 tests on main) to about 170, the S-07 route and store suites (about 280 at the runner) to about 70, and ten smoke steps added first. S-06 coordination: the auth tuples and the `auth-redirect` trim touch what S-06 will change; whichever lands second rebases, and the note says so.

### Changes Required:

#### 1. Smoke steps (first)

**File**: `scripts/smoke.mjs`

**Contract**: ten tuples in the existing shape, each placed after the step that creates its state, each refusal followed by a read-back: (1) `POST /api/log` with `target=52.23,21.01` → the route's fixed `?error=` key, `exact: true, absent: "52.23"`, then `GET /log` `bodyExcludes` the value; (2) `POST /api/onboarding` with malformed `eyepieces` JSON → the fixed key, `absent:` the payload; (3) `POST /api/tonight/plan` with `site=52.23,21.01` → `/tonight/plan?error=…` with no `site=`, `absent: "52.23"`, then the island still `suggested`; (4) `POST /api/log/sky/<id>` with `from=https://evil.example` → a same-origin `Location`; (5) signed-out `GET /log` → `/auth/signin?next=%2Flog`; (6) signed-out `POST /api/log` → sign-in, then nothing on `/log` as the user; (7) `GET /` signed out 200 with the CTA hrefs; (8) `GET /` signed in → 302 `/tonight`; (9) `GET /log/<unknown id>` → 404; (10) `GET /tonight/all#more` → 301 `/tonight/targets`. The auth steps (5, 6) assert the `?next=` continuation only, which S-06 keeps.

#### 2. Deletions

`compass`, `gear/catalogue/fill`, `gear/coordinates`, `gear/eyepiece-presets`, `gear/schemas`, `gear/timezone`, `onboarding/schemas`, `preferences`, `protected-routes`, `session-cookie`, `session-plans/read`, `session-plans/redirect`, `session-plans/schemas`, `sky-checks/schemas`, `targets/labels`, `toasts`, `supabase.test.ts` → 1 (keep "returns null and logs config.supabase once per isolate in a built app"; so not deleted, trimmed); `observations/schemas` → 1 (`returnTargetSchema`). Ledger: `compass`, `preferences`, the no-echo schema cases and `toasts` are recorded dispositions.

#### 3. Trims (targets)

`api-errors` → 2, `auth-redirect` → 5 (the refusals), `gear/catalogue/catalogue` → 12, `gear/catalogue/search` → 3, `location/geocode` → 2, `location/locate` → 3, `location/map-view` → 2, `observations/log-night` → 12 (one zone, F8), `observations/target-search` → 3, `offline/coalesce` → 3, `offline/copies` → about 58 (research §2.4 rule table; every ledger pin kept), `offline/owner` unchanged, `offline/page-state` → 3, `onboarding/presets` → 1, `progress/progress` → 4, `progress/milestones` → 15, `session-plans/checks` → 3, `sky-checks/claim` → 4, `sky-checks/pending` → 2, `targets/index` → 4, `account-plan/account-plan` → 5, `account-plan/store` → 1 (fold), `observations/celebrate` → 9, `observations/redirect` → 6, `observations/store` → 5 (ledger pin, `latestNightBound` ×1, create server fault, update no-rows, read cause), `sky-checks/record` → 3 (no dark window → nothing; server fault line; refusal is a notice)

#### 4. S-07 routes and stores (D3 targets)

`routes/auth` 26 → 6 (sign-in: 500 logs once + generic key; wrong password logs nothing; "never lets the email, the password or the coordinates reach a log argument or the redirect"; sign-up: the same never-lets case; sign-out: Auth outage leaves one line and still goes home; one request.form case), `routes/plan-save` 10 → 3 (server fault, RLS notice, never echo), `routes/plan-reset` 10 → 2 (server fault, never echo), `routes/gear-site-update` 8 → 3 (server fault, zero-row notice, never echo), `routes/gear-delete` 4 → 2, `routes/log-create` 6 → 3 (server fault, milestone step beside the failed save, never echo), `routes/onboarding` 8 → 3, `routes/sky-check` 6 → 2; `gear/store` 58 → 6 (each `it.each(WRITES)` / `it.each(READS)` family as one loop; the time-zone fault case), `onboarding/store` 8 → 3, `session-plans/store` 10 → 3, `sky-checks/store` 14 → 3, `observations/milestone-store` 6 → 2, `auth/middleware` 6 → 3 (gated redirect with `next`; Auth down still redirects with one line and no email; ungated passes on), `auth/session-user` 28 → 5 (the pinned lists vs the installed library as one test; routine-silent loop; failure-line loop; "never lets an email or coordinates … reach a log argument"; the thrown-error case)

**Intent**: Per family one server-fault case (neutral key + one line with only `{step, name, code, status}`), one refusal notice, one `request.form`, and the privacy pin; per store one loop per fault kind. Per-call-argument choreography goes.

#### 5. Docs (F9)

`CLAUDE.md` Offline and Conventions paragraphs where a deleted test is named; `context/foundation/test-plan.md` §6.4 ("Coordinates in redirects and logs": the smoke steps now pin the URL side; §6.2's `log-night` note: one zone) and §6.5; `context/deployment/error-visibility.md` where it names a trimmed test.

### Success Criteria:

#### Automated Verification:

- `npm test` green; the leaf files ≤ 32 and ≤ 180 tests, the S-07 route and store files ≤ 75 tests, by the JSON reporter
- The 10 smoke steps pass against a local production preview backed by local Supabase, and each refusal step fails when its `absent:` value or read-back is removed (one deliberate check each, reverted)
- Break checks red then reverted: a stored finder chart kept after an explicit `free` (`copies`), a milestone lost after its only entry is deleted (`celebrate`), a store returning the PostgREST message in its fault (`gear/store` loop)
- `npm run lint`, `npx astro check` green; `test:reference` time recorded
- The whole e2e suite and smoke green locally before the PR

#### Manual Verification:

- The phase note lists every ledger row of this phase as kept, replaced or dropped (owner), the S-06 coordination note, and the docs grep

---

## Phase 4: Guards, observability contracts, parity and OpenNGC provenance

### Overview

Static guards to their invariants, the S-07 observability contracts to their privacy cases, the OpenNGC provenance tests to the pin and licence only (D7, no CI step). The star files wait for #195 (Phase 5).

### Changes Required:

#### 1. Guard trims

`agent-hooks` → 10 (the seven proof cases plus the three regression pins in the ledger, F3), `no-console-guard` → 5 (merge the four `countDisables` helper tests into one control), `runner-zone-guard` → 3 (one OFFENDING loop, one ALLOWED loop, the line report), `styles/rhythm-roles` → 4 (two pattern loops, two per-file loops with the exact allowances kept), `navigation` → 1 (the `TONIGHT_NAV` = `TONIGHT_PAGES` parity), `i18n` → 2 (few/many parity, `translateKey` fallback), delete `fetch-timeout`, delete `test-support/virtual-modules.test.ts` (its S-07 consumers prove the seams), `catalogue/common-names` → 1, `catalogue/meteor-showers` → 2 (derivation, licence note), `wrangler-config`, `styles/contrast`, `styles/red-theme`, `styles/no-hardcoded-colors` unchanged

#### 2. Observability contracts (D3)

`observability/log-failure` 60 → 12 (the line ×1, "what is never printed" ×3, name ×2, code ×2 with `isLoggableCode` as one accept loop and one reject loop, status ×1, never throws ×2, `FAILURE_STEPS` closed list ×1), `observability/fault` 40 → 8 (the classification table as one loop, the default and whole-code cases, `faultFrom` "leaves no trace" ×2, `withFault` ×2), `observability/read-failure` 16 → 4, `observability/save-failure` 8 → 4, `observability/silent-catch-guard` 20 → 5 (the three guard tests + the sample loop + the reporter-import rule)

#### 3. OpenNGC provenance (D7)

`catalogue/messier` → 1 (pinned commit + licence), `catalogue/caldwell` → 1 (pinned commit + licence); the shape checks (counts, ranges, Rosette, C30, dec filter) go: ledger "dropped (owner)".

#### 4. Docs (F9)

`CLAUDE.md` tripwires ("`messier.test.ts` and `caldwell.test.ts` assert their shape and provenance" → "assert their provenance; the shape is the generator's at `catalogue:build`"; `no-console` tripwire unchanged; "Agent hooks" unchanged); `context/foundation/test-plan.md` §5 gate rows (unit, plan enforcement, end-of-turn), §6.2 "Runner-zone guard", §6.4, §6.6; `context/foundation/lessons.md` (the no-console lesson still true); `context/deployment/error-visibility.md` where it names `silent-catch` or `log-failure`.

### Success Criteria:

#### Automated Verification:

- `npm test` green; `guards` project ≤ 25 tests; the observability files ≤ 35 tests; the slice ≤ 70 tests in total, by the JSON reporter
- Break checks red then reverted: `console.log(site)` in `score.ts` (`no-console-guard`), a new empty `catch {}` in a runtime file (`silent-catch-guard`), a PostgREST message kept on a fault carrier (`fault`), a hex colour in a component (`no-hardcoded-colors`)
- `npm run test:guards` under 25 s locally
- `npm run lint`, `npx astro check` green

#### Manual Verification:

- The phase note records the `no-console-guard` file-floor count, every ledger row of this phase, and the docs grep

---

## Phase 5: After #195 merges: star provenance, `scripts/lib`, the landing capture

### Overview

Only after `fix/star-source-review` (#195) is on main.

### Changes Required:

#### 1. Star provenance

`catalogue/stars` → 2 (HYG/Hipparcos pin + licence; the 41 Polish star names), `catalogue/finder-stars` → 4 (pin and URL equal to the bright meta, "Credit: ESA", `HIPPARCOS_FIELDS_USED` / `FIELDS_USED` and the `hip_main.dat` `PINNED_SHA256`, the gzip budget); the server-only import scan goes (`scripts/build-sw.mjs` fails the build on the same leak, the stronger gate); the decoders and `formatDesignation` cases go.

#### 2. `scripts/lib`

`build-stars.test.mjs`, `designations.test.mjs`, `hipparcos.test.mjs` (71 → about 12: the provenance, licence and field-use cases; one parsing case per helper); exact counts set in the note after reading the merged files.

#### 3. Projects

`vitest.config.ts`: the four catalogue provenance files and `scripts/lib/*.test.mjs` join `guards`.

#### 4. Landing capture

`tests/e2e/landing-screenshot.spec.ts` → `scripts/capture-landing.mjs` (or an opt-in Playwright project excluded from the default run); `CLAUDE.md` Landing bullet names the new command.

#### 5. Docs (F9)

`CLAUDE.md` tripwires for `stars.test.ts` / `finder-stars.test.ts` ("the same test scans for it" → `scripts/build-sw.mjs`), `context/foundation/licensing/esa-reply-assessment-2026-10-16.md` and `context/foundation/roadmap.md` where they name those tests (a dated note, not a rewrite).

### Success Criteria:

#### Automated Verification:

- `npm test` green; `stars` + `finder-stars` + `scripts/lib` ≤ 20 tests by the JSON reporter; unit total ≤ 820 across both projects
- Break check red then reverted: "Credit: ESA" removed from the finder meta
- `npm run build` still fails when a `finder-stars` marker reaches `dist/client` (one deliberate import, reverted)
- `npm run lint`, `npx astro check` green; both project times recorded

#### Manual Verification:

- The phase note lists the ledger rows and the final counts per project

---

## Phase 6: E2E and db trims

### Overview

Research §3.1 and §3.2 with D5 and D6 applied.

### Changes Required:

#### 1. Smoke steps

**File**: `scripts/smoke.mjs`

**Contract**: (11) `nightOver`: post a stale `night` to `/api/tonight/plan` → `?error=errors.sessionPlan.nightOver`, island still as before; (12) one gear UPDATE route: `POST /api/gear/sites/<id>` with a changed name → `/gear?saved=site`, read back on `/gear`.

#### 2. E2E

Delete `sign-in-continue.spec.ts` (smoke 3, 10, 12); `landing.spec.ts`: keep "the footer credit wraps without sideways scroll at 320 and 360 px, in English and Polish" and the ESA credit assertion (F4), drop the CTA and 302 tests (smoke 7, 8); trim `finder-chart` t1/t4, `what-to-expect` t1/t2/t4, `tonight-sky` t4-t7 (the compass test dropped as an owner decision, ledger), `toasts` t3/t6, `observing-progress` t2/t3, `red-night-mode` t2/t3, `tonight-targets` t2/t3, `tonight-phone` t4, `onboarding` t4, `planets-on-tonight` t2, `session-plan-edit` t2/t5/t7, `observation-log` t2, `observation-log-management` t2; merge `gear-catalogue` into `onboarding` t2, `moon-as-target` + `planets-on-tonight` t1 + `observation-log` t1 into one mark-observed journey, `observing-milestones` t1 with `observing-progress` t4, `sky-events` t2 into t1, `navigation` t3 with `tonight-subnav` t1/t2/t3/t5, `session-plan-store` reset into save. `landing-screenshot` was handled in Phase 5.

**Contract**: no `waitForTimeout`, no new retries; `tonight-phone` t1/t2 and every service-worker spec untouched.

#### 3. DB

`tests/db/account-plan-command.test.ts` → about 6 (one spawn, grant, demote, `--create`, hosted-URL refusal, `show`), `tests/db/observations.test.ts` target grammar → 3 accepted + 4 rejected rows, `tests/db/session-plans.test.ts` `refuses %s` → 4 rows, `tests/db/milestones.test.ts` drop "record makes no request for an empty input" (counts requests).

#### 4. Docs (F9)

`context/foundation/test-plan.md` §4 (e2e and db counts), §6.5 (known skips: `moon-as-target` merged), §7 (the owner-accepted gaps: compass mapping, Accept-Language, longitude echo, catalogue shape), `CLAUDE.md` where `landing.spec` is named.

### Success Criteria:

#### Automated Verification:

- `npx playwright test --list` ≤ 72 tests; the whole e2e suite green locally against a production preview with local Supabase, once with `--repeat-each 2 --workers 4`
- `npx vitest list --config vitest.db.config.ts` ≤ 100 named tests; `npm run test:db` green locally
- `npm run smoke` green with steps 11 and 12
- The PR's `smoke` job green with no retried test

#### Manual Verification:

- The owner confirms the phone first screen stays pinned and the ESA footer test is still in the suite

---

## Phase 7: Test-plan refresh and the lesson

### Changes Required:

#### 1. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: §4 counts and projects; §5 gates; §6.6 a "Diet" note with before/after counts and times; §7 bullets: "Unit tests of implementation detail: schema accept/reject tables, formula restatements, mock choreography, props and class strings" and the four owner-accepted gaps; §8 ledger dates.

#### 2. Lesson

**File**: `context/foundation/lessons.md`

**Intent**: One entry: before adding a test, name the user-visible risk or invariant it is the only protection of; prefer a relation over a value, a smoke tuple over a schema test, one looping property over an `it.each` table; fold rows and assert counts first.

#### 3. Handoff and CLAUDE.md

`context/handoff.md` (an update block), `CLAUDE.md` (Commands: `test:reference`, `test:guards`; the "Unit tests live next to the code" paragraph).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes; the hook skips the docs-only change

#### Manual Verification:

- The owner reads the §6.6 note and the before/after table

---

## Testing Strategy

### Unit Tests:

- The suite under diet is the subject; each phase proves itself with the JSON reporter's counts, the ledger, and one break check per folded property.

### Integration Tests:

- Smoke steps 1-10 (Phase 3) and 11-12 (Phase 6) run against a local production preview with local Supabase before each PR and in CI's `smoke` job; `tests/db` unchanged until Phase 6.

### Manual Testing Steps:

1. After Phase 0, make a one-line change in a worktree, end the turn, time the hook.
2. After each phase, read the note's ledger section against this plan's table.
3. After Phase 6, open the live site at phone width once the deploy lands.

## Performance Considerations

Targets on the new base: `npm test` about 10-12 s cold / 5-6 s warm locally and about 30 s in CI; `test:guards` about 20 s (ESLint config load); hook 12-25 s per Stop; e2e about 30-60 s shorter; the deploy critical path (Supabase start + e2e) barely moves. Each phase records its measurements.

## Migration Notes

Not applicable. Rollback of any phase is `git revert` of its PR; Phase 5 depends on Phase 0's projects, nothing else.

## References

- Research: `context/changes/test-suite-diet/research.md` (inventory §2.1-§2.4 at 82e35cf, non-unit layers §3, only-protection categories §4, targets §5, "Baseline refresh" at 85aa123)
- Plan review: `context/changes/test-suite-diet/reviews/plan-review.md` (F1-F9, decisions recorded)
- Test strategy: `context/foundation/test-plan.md` §1, §6.2, §6.3, §6.4, §6.5, §7
- Lessons: `context/foundation/lessons.md`
- Hook: `.claude/hooks/end-of-turn.sh`; proof `src/lib/agent-hooks.test.ts`
- Smoke template: `scripts/smoke.mjs`, the "invalid site returns to form with error" tuple
- Guard couplings: `src/lib/no-console-guard.test.ts` (`ALLOWED_DISABLES`, "checks the whole source tree")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`. (Re-issued at plan review on 2026-10-17 before any implementation; no earlier row was checked.)

### Phase 0: Two Vitest projects and a lighter hook

#### Automated

- [x] 0.1 `npm test` runs both projects green with the test count measured on main just before the change — 6242dd8
- [x] 0.2 `npm run test:reference` excludes the five guard files and finishes under 15 s cold locally — 6242dd8
- [x] 0.3 `npm run test:guards` runs exactly the five guard files — 6242dd8
- [x] 0.4 `agent-hooks.test.ts` green and its clean case records `vitest run --project reference` — 6242dd8
- [x] 0.5 `npm run lint` and `npx astro check` pass — 6242dd8
- [ ] 0.6 The `ci` job on the PR runs `npm test` green

#### Manual

- [ ] 0.7 One real Stop shows `vitest reference;` and the measured hook time in the note

### Phase 1: Engine suite to its reference core

#### Automated

- [ ] 1.1 `npm test` green; engine files ≤ 25 and tests ≤ 310
- [ ] 1.2 Three break checks red then reverted (window widened, bonus above the bar, pairing into daylight)
- [ ] 1.3 `npm run test:guards` green with the updated `ALLOWED_DISABLES`
- [ ] 1.4 `npm run lint`, `npx astro check` green; `test:reference` time recorded

#### Manual

- [ ] 1.5 The phase note lists every ledger row of this phase as kept or replaced, and the docs grep

### Phase 2: Tonight, forecast, finder and components, including the S-07 files

#### Automated

- [ ] 2.1 `npm test` green; the slice ≤ 30 files and ≤ 230 tests
- [ ] 2.2 Four break checks red then reverted (clamped plan row, solar-safety line hidden, island imports the catalogue, incomplete 200 replaces a usable copy)
- [ ] 2.3 `npm run lint`, `npx astro check` green; `test:reference` time recorded

#### Manual

- [ ] 2.4 The phase note lists every ledger row of this phase as kept or replaced, and the docs grep

### Phase 3: Leaf modules, S-07 routes and stores, offline rules and the smoke steps

#### Automated

- [ ] 3.1 `npm test` green; leaf files ≤ 32 and ≤ 180 tests; S-07 route and store files ≤ 75 tests
- [ ] 3.2 The 10 smoke steps pass locally and each refusal fails when its `absent:` value or read-back is removed
- [ ] 3.3 Three break checks red then reverted (chart kept after explicit free, milestone lost on delete, PostgREST message in a store fault)
- [ ] 3.4 `npm run lint`, `npx astro check` green; `test:reference` time recorded
- [ ] 3.5 Whole e2e suite and smoke green locally before the PR

#### Manual

- [ ] 3.6 The phase note lists every ledger row of this phase, the S-06 coordination note and the docs grep

### Phase 4: Guards, observability contracts, parity and OpenNGC provenance

#### Automated

- [ ] 4.1 `npm test` green; `guards` ≤ 25 tests; observability files ≤ 35; the slice ≤ 70
- [ ] 4.2 Four break checks red then reverted (console.log in score.ts, new empty catch, message on a fault carrier, hex colour)
- [ ] 4.3 `npm run test:guards` under 25 s locally
- [ ] 4.4 `npm run lint`, `npx astro check` green

#### Manual

- [ ] 4.5 The phase note records the file-floor count, every ledger row of this phase and the docs grep

### Phase 5: After #195 merges: star provenance, scripts/lib, the landing capture

#### Automated

- [ ] 5.1 `npm test` green; stars + finder-stars + scripts/lib ≤ 20 tests; unit total ≤ 820 across both projects
- [ ] 5.2 Break check red then reverted (ESA credit removed)
- [ ] 5.3 `npm run build` still fails on a finder-stars leak to dist/client
- [ ] 5.4 `npm run lint`, `npx astro check` green; both project times recorded

#### Manual

- [ ] 5.5 The phase note lists the ledger rows and the final counts per project

### Phase 6: E2E and db trims

#### Automated

- [ ] 6.1 `playwright test --list` ≤ 72 tests; whole suite green locally incl. a `--repeat-each 2 --workers 4` run
- [ ] 6.2 db suite ≤ 100 named tests and green locally
- [ ] 6.3 `npm run smoke` green with steps 11 and 12
- [ ] 6.4 The PR's `smoke` job green with no retried test

#### Manual

- [ ] 6.5 The owner confirms the phone first screen stays pinned and the ESA footer test is still in the suite

### Phase 7: Test-plan refresh and the lesson

#### Automated

- [ ] 7.1 `npm run lint` passes and the hook skips the docs-only change

#### Manual

- [ ] 7.2 The owner reads the §6.6 note and the before/after table
