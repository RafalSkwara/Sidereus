# Test-Suite Diet: implementation notes

## Phase 0: Two Vitest projects and a lighter hook (2026-10-17)

Rebased onto origin/main 7b059a9 first: #195 (star-source review) is merged, so Phase 5 is unblocked. Baseline re-measured there: 156 files / 3,056 tests (3,046 pass, 4 skipped, 6 todo); the plan's 3,054 was one commit older.

| Run                              | Files | Tests | Cold time (local) |
| -------------------------------- | ----- | ----- | ----------------- |
| `npm test` before                | 156   | 3,056 | 11.3 s            |
| `npm test` after (both projects) | 156   | 3,056 | 10.2 s            |
| `npm run test:reference`         | 151   | 2,868 | 9.2 s             |
| `npm run test:guards`            | 5     | 188   | 6.9 s             |

`reference` + `guards` = 3,056, so nothing was lost and no scripts/ test left the run. The guards project is exactly `no-console-guard`, `agent-hooks`, `runner-zone-guard`, `no-hardcoded-colors`, `rhythm-roles`.

Hook (manual 0.7, observed by the implementer, left for the owner to tick): one real run of `end-of-turn.sh` in this worktree with six changed files printed `end-of-turn.sh: clean: eslint 2 file(s); vitest reference;` and took 13.2 s wall (before: 25-45 s).

`npm run lint` and `npx astro check` are green. Ledger rows of this phase: none (no test deleted).

Docs updated: `CLAUDE.md` (Commands block, Agent hooks tripwire), `context/foundation/test-plan.md` §4 unit row, §5 unit and end-of-turn rows (the colour, rhythm and runner-zone guards now report in CI only; Prettier re-aligned the table).

Docs grep: `grep -rn 'vitest run\|whole unit suite' CLAUDE.md context/foundation context/deployment` names no other place that states what the hook runs.

## Phase 1: Engine suite to its reference core (2026-10-17)

Branch `test-diet/phase-1`, stacked on `feat/test-suite-diet` (Phase 0, PR #197). Five Sonnet subagents (high) cut the files in four groups; the implementer reviewed every report, restored the cuts that were not duplicates, ran the break checks and edited the guard and docs.

| Measure                              | Before                  | After                                                                 |
| ------------------------------------ | ----------------------- | --------------------------------------------------------------------- |
| engine files / tests (JSON reporter) | 31 / 929                | 25 / 300 (targets: <= 25 / <= 310)                                    |
| whole suite (`npm test`)             | 156 files / 3,056 tests | 150 files / 2,427 tests                                               |
| `reference` project                  | 151 / 2,868             | 145 / 2,239 (1 skipped: the opt-in calibration snapshot)              |
| `guards` project                     | 5 / 188                 | 5 / 188                                                               |
| `test:reference` cold                | 9.2 s                   | 5.4 s                                                                 |
| engine file-time (sum)               | 22.2 s                  | about 9 s (events 6.0 -> 1.9, pairings 8.1 -> 3.0, finder 3.0 -> 1.2) |

Per file (before -> after): night-boundaries 130 -> 26 (`night.test.ts` 11 merged in and deleted), visibility-invariants 203 -> 4, small-scope 69 -> 9, calibration 20 -> 9 (`evening-showpieces` 8 merged in and deleted), events 43 -> 25, finder 49 -> 31, pairings 31 -> 16, meteors 22 -> 14, outlook 23 -> 16, verdict 37 -> 29, ranking 30 -> 16, ranking-invariants 12 -> 11, score 39 -> 15, window-reference 17 -> 11, expectation 15 -> 8 (`contrast` 9 merged in as the Hubble coverage test and deleted), eyepieces 23 -> 10, log 8 -> 3, determinism 8 -> 2, sky-frames 3 -> 1, sun 16 -> 10, moon 31 -> 13 (`moon-disc` 6 -> 2 and `moonlight` 11 -> 3 merged in and deleted), moon-target 12 -> 5, objects 22 -> 3, planet-ranking 11 -> 10 (`planets` 7 -> 4 merged in and deleted), purity 3 (unchanged). Six files went to meet the <= 25 file count (the merges above are the plan's file-count merges, not deletions of protection).

### Ledger rows of this phase

- engine/events, three pins (sunrise eclipse best moment, rising-Moon eclipse best moment, decision A): kept, titles unchanged.
- engine/meteors, "still lists a peak that fell the night before the window ..." and describe "the bright-Moon flag needs the Moon up in the span, not only a bright phase": kept.
- engine/pairings, describe "a pairing that is visible only in a short stretch of twilight" (3 cases): kept. The kept independent oracle is the 2-minute brute force, strengthened to check every visible event's own moment (it absorbs the dropped invariant describe).
- engine/score, the four pins: kept, titles unchanged.
- engine/ranking, describe "reasonComponents", "never lifts an object whose own score is below the bar into the list", "changes nothing on the new-Moon night of 2026-10-10 ...": kept. The clusters-only assertion under the full Moon was restored as its own test.
- engine/small-scope G1, G3, G4, G5 (folded to one loop, title kept), G6: kept. G2 (not a ledger pin, but its rank half has no other copy) was restored as one test over both nights.
- engine/evening-showpieces: replaced by calibration "ranks the October evening showpieces in the top half of the cleared list (the median)" and "keeps M13 in the top five on the two nights with a short dark window".
- engine/window-reference, the three `it.each(REFERENCE_NIGHTS)` checks: kept (9 rows).
- engine/outlook (2 pins), engine/verdict (3 pins incl. describe "clearIntervals"), engine/planet-ranking describe "with visible intervals", engine/moon-target (3 pins), engine/expectation (describes D-6 and D-3), engine/ranking-invariants (a)-(g), engine/finder (zenith edge marker, brute force on 150 skies, published hops D-11): kept, titles unchanged.
- engine/sun: describe "tonightDateFor" replaced by night-boundaries (c) and (d); the one case those do not hold (Tromso, no dark window, noon rule) was restored as "keeps the noon rule for tonightDateFor on a night without a dark window". The polar-night test and describe "sun events vs Stellarium fixtures": kept.
- engine/night-boundaries (a)-(d): kept in two zones of opposite sign (`America/Los_Angeles`, `Pacific/Kiritimati`), one looping test per rule with the counts asserted first (>= 5 USNO edge nights, 11 wall-clock traps, 192 instants).

### Judgement calls (restored and not restored)

Restored after review: small-scope G2, the Tromso noon rule, planet-ranking's timing-thirds boundary rule, ranking's clusters-only-under-a-full-Moon assertion, pairings' inclusive-threshold rule, finder's start-star-never-fainter-than-naked-eye relation. Not restored (rubric): planet-ranking's solar-order tie-break (a `vi.mock` choreography, (d)), moon-target "is deterministic" and the new-Moon null case (duplicates), the one-sample `refinedWindow` case (visibility-invariants now asserts the one-sample positive-length rule), the finder `parameters` constants test (b). Known uncaught: changing `HOP_MAX_STEPS`/`START_STAR_CANDIDATES` or `VISIBLE_STEP_MINUTES` alone (the old suite did not catch them either). Over target by a pin or relation: small-scope 9 (target 7), calibration 9 (about 8), window-reference 11 (10: "scores do not move" relation behind a CLAUDE.md invariant), finder 31, pairings 16, ranking 16, sun 10. calibration "never puts a Caldwell galaxy fainter than magnitude 10 in the top five" is a bound (no Caldwell galaxy reaches a top five today), kept with its comment.

### Break checks (each red, then restored with `git checkout --` of the staged file)

- Window widened (`objects.ts` `refinedWindow` end at `minAltitudeDeg - 5`): visibility-invariants "lists no deep-sky object outside its dark window or under the minimum altitude, a one-sample run included (true edges)" red.
- Messier bonus above the bar (`MESSIER_RANK_BONUS` 0.5 alone does nothing, the bonus never enters the bar; with the bar reading `rankScore` instead of `score.total`): ranking-invariants (b), (c), (d) red.
- Pairing best moment into daylight (`pairings.ts:144` Sun bound + 12): the Skyfield "finds the events the reference implies" and two brute-force rows red.
- Rollover threshold -6 -> -2 (`TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG`): night-boundaries (b), (c) red in both zones.
- The subagents also ran: score washed-out and penalties folds, outlook walk fold, events visibility floors, pairings twilight bound and `bothUp`, finder cost tie-breaks and hop bound, meteors look-back and bright-Moon flag.

### Console, guard, fixtures, docs

- `ALLOWED_DISABLES`: `determinism` (2) and `events` (1) removed (their timing prints went); `calibration` (1) and `finder` (2) stay. `npm run test:guards` green (188 tests, 8.5 s).
- Fixtures: every `fixtures/` file is still imported by a kept test. The `moon` and `objects` sections of the three Stellarium JSONs, and `MoonSample`/`ObjectSample` and their parse code in `fixtures/index.ts`, are read by no test now; left in place (no fixture data deleted, plan rule). `fixtures/README.md`: the "Reading the Moon" and "Reading objects" capture protocols retired, `planets.test.ts` -> `planet-ranking.test.ts`.
- Docs grep: `grep -rnE '(contrast|night|evening-showpieces|moon-disc|moonlight|planets)\.test\.ts|determinism|events\.test|ALLOWED_DISABLES' CLAUDE.md context/foundation context/deployment` found only `test-plan.md` §6.2/§6.3 lines (updated: night-boundaries two zones, visibility-invariants shape), the generic `ALLOWED_DISABLES` mentions in lessons.md and test-plan §6.4 (still true), and CLAUDE.md's `small-scope.test.ts (G1-G6)` (still true, G2 restored).
- `npm run lint`, `npx astro check` green.

## Phase 2: Tonight, forecast, finder and components, including the S-07 files (2026-10-17)

Branch `test-diet/phase-2`, stacked on `test-diet/phase-1` (PR #199). Four Sonnet subagents (high) cut four groups; the implementer reviewed every report, ran the break checks and edited the docs.

| Measure                                                                          | Before                  | After                              |
| -------------------------------------------------------------------------------- | ----------------------- | ---------------------------------- |
| slice files / tests (components, finder, moon-disc, sky-view, forecast, tonight) | 40 / 659                | 27 / 192 (targets: <= 30 / <= 230) |
| whole suite                                                                      | 150 files / 2,427 tests | 137 files / 1,960 tests            |
| `reference` project cold                                                         | 5.4 s                   | 4.3 s                              |
| `guards` project                                                                 | 188 tests, 8.5 s        | 188 tests, 9.1 s                   |

Per file (before -> after): `tonight/build` 133 -> 40, `tonight/load` 22 -> 9, `forecast/service` 38 -> 24 (`cache` 2 absorbed and deleted), `forecast/open-meteo` 9 -> 2, `forecast/kv-cache` 4 -> 2, `forecast/night-in-progress` 2 -> 1, `forecast/degraded-forecast` 18 unchanged, `finder/load` 25 -> 10, `finder/chart-svg` 15 -> 5, `finder/steps` 10 -> 3, `finder/example-chart` 5 -> 2, `moon-disc/geometry` 14 -> 6, `moon-disc/label` 4 -> 2, `sky-view` 21 -> 3, `tonight/visibility-invariants` 100 -> 7, `tonight/night-boundaries` 30 -> 8, `tonight/sky-events` 28 -> 10, `tonight/format` 26 -> 6, `tonight/plan-editor` 21 -> 4, `tonight/plan-window` 12 -> 9, `tonight/all-objects` 5 -> 2, `gear-choice` 4 -> 2, `expectation` 7 -> 1, `requested-gear` 2 -> 1, `session-plan` 7 -> 1, `forecast-honesty` 11 unchanged. Deleted: `design/finder-samples`, `nav-type-roles`, `tonight/subnav`, `ui/fact-icons`, `finder/from`, `moon-disc/state`, `tonight/altitude-curve`, `plan-editor-view`, `plan-order`, `plan-edits`, `forecast/cache`. Merged into the new `src/components/island-imports.test.ts` (3 tests): `MoonTimeSlider`, `TonightSkyView`, `fact-islands` (20 -> 3).

### Ledger rows of this phase

- forecast/night-in-progress "judges the verdict on the evening hours that a past_days=1 response carries": kept. forecast/service describe "getForecast with a 200 that is not a complete series" (8 tests because three are `it.each` rows) and "falls back to a stale copy of any age when the fetch fails, flagged as a fallback": kept, titles unchanged. forecast/degraded-forecast and tonight/forecast-honesty: whole files kept.
- tonight/night-boundaries (a)-(c): kept in two zones of opposite sign (`America/Los_Angeles`, `Pacific/Kiritimati`), one looping test per rule with the counts asserted first.
- tonight/build, the eight ledger titles (civil-dawn rollover, no planet in the clear hours, cloudy no-go night with no faint line, moonless 2026-10-10, below-the-bar finder link, "Tomorrow, 11:22", 2027-08-02 morning, "ends the night at the civil dawn after it"): kept, titles unchanged. The five S-07 catch lines are one case each (`tonight.planets`, `.moon`, `.sky-view`, `.session-plan`, `.sky-events`: one fixed line with `{step, name}`, no coordinate, the rest of the view equal to the healthy one).
- tonight/plan-order "flags a row whose window ends before the previous row's best time": replaced by `plan-editor.test.ts` `editorAnnouncement` "adds the order hint when the moved row now ends before the previous target is at its best" (with the boundary: a window ending exactly at the previous best time is not flagged). tonight/visibility-invariants describe "An edited Session plan never draws a target outside its window (adjustable-session-plan)": kept as its own folded test, which replaces `plan-edits.test.ts` (it also checks the rows-only-from-suggested-or-reachable rule against the independent oracle).
- tonight/sky-events: the four pins (F3, F2 / decision A, F6, F10b): kept. tonight/format: both pins and the DST describe: kept. tonight/load: three ledger pins kept (the failure-lines describe has one case per fixed line). tonight/requested-gear "reads but never remembers the site of a next-night request": kept.
- finder/load "answers a failed plan read like a free account", describe "loadFinderFor from the Session plan (adjustable-session-plan F9)", describe "loadFinderFor's failed state leaves a line (error-visibility, Phase 5)": kept (the F9 describe holds 1 of its 3 tests, the failed-state describe 2 of 7).
- components/ui/fact-icons "keeps the solar eclipse's own Eclipse icon (owner decision D4)": dropped (owner, presentational; `/design` shows it).

### Judgement calls

Not restored (rubric, or the plan names the deletion): `finder/from` `finderHref` cases (`from=plan`, `night=next` only when the page shows the next night; the plan deletes the file, so that link rule is held only by e2e and `tonight/build`'s below-the-bar link test), `finder/load`'s "asks Tonight for the reachable list only with from=plan" (mock choreography (d); the wiring is exercised by the plan spec), `sky-events`' i18n colon invariant (b), `tonight/build`'s "lists the ranking's best three by best time" (a), `plan-editor`'s `savedKeys`/`isUnchanged`/Polish announcement (the plan's target of 4; `session-plan-edit.spec` covers them). `finder/example-chart` stays at 2 tests: the opt-in regeneration test (`EXAMPLE_CHART_REGENERATE=1`) stays because `example-chart.ts` comments name that command; moving it to `scripts/` is left to a later pass. Three files land under target (format 6, night-boundaries 8, visibility-invariants 7) without dropping a pin.

### Break checks (each red, then restored with `git checkout --` of the staged file)

- Session plan row clamped past its window (`session-plan.ts` `to: at(window.end + 2 h)`): both visibility-invariants row tests red.
- Solar-safety line behind "+N more" (`sky-events.ts` safety rows sorted last): "names the eclipse with 'eclipse glasses only' and '+1 more' when a pairing comes before it on the night" red.
- An island importing `@/lib/catalogue` (`TonightSkyView.tsx`): `island-imports.test.ts` test 1 red.
- A 200 ending 60 h after now replacing a usable copy (`FORECAST_COMPLETE_AFTER_MS` 96 h -> 48 h): "keeps a usable stored copy over a 200 that ends about 60 h after now, short of the 96 h verdict nights need" red.
- The subagents also ran: the dawn rollover, the "Tomorrow" wording, the no-planet clear-spell line, the `orderHints` boundary and the service cache-write line.

### Docs and the rest

- Docs grep (`grep -rnE 'nav-type-roles|fact-islands|TonightSkyView\.test|MoonTimeSlider\.test|subnav\.test|fact-icons\.test|finder-samples\.test|plan-edits\.test|plan-order\.test|altitude-curve\.test|cache\.test\.ts' CLAUDE.md context/foundation context/deployment src scripts .claude`) found CLAUDE.md three places (the nav-type-roles parenthesis removed; `fact-islands.test.ts` and `TonightSkyView.test.ts` -> `island-imports.test.ts`) and one source comment in `TonightSkyView.tsx` (updated). test-plan.md names none of the deleted files.
- Fixtures and helpers: nothing became unused. Production exports now referenced only inside their own module: `isLit` (`moon-disc/geometry.ts`), `frameTime` (`sky-view/frames.ts`), `altitude-curve.ts` has no unit test any more (still used by `SessionTimeline`); left in place (no `src/` change in this phase).
- `npm run lint`, `npx astro check` (0 errors) green; `npm run test:guards` green.

## Phase 3: Leaf modules, S-07 routes and stores, offline rules and the smoke steps (2026-10-17)

Branch `test-diet/phase-3`, stacked on `test-diet/phase-2` (PR #200). The ten smoke steps were written first by the implementer against a local production preview; four Sonnet subagents (high) then cut the unit files; the implementer reviewed every report, ran the break checks, the whole smoke and the whole e2e suite.

| Measure                                                                                                                                                         | Before                  | After                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| leaf files / tests (api-errors ... targets, offline, progress, observations, session-plans, sky-checks, account-plan, gear/catalogue, location, onboarding)     | 46 files / 725          | 28 / 169 (targets: <= 32 / <= 180)                                         |
| S-07 route and store files (routes/*, gear/store, onboarding/store, session-plans/store, sky-checks/store, milestone-store, auth/middleware, auth/session-user) | 15 / 208                | 15 / 49 (target: <= 75)                                                    |
| whole suite                                                                                                                                                     | 137 files / 1,960 tests | 121 files / 1,245 tests                                                    |
| `reference` project cold                                                                                                                                        | 4.3 s                   | 4.4 s (1,056 tests)                                                        |
| `guards` project                                                                                                                                                | 188 tests               | 188 tests                                                                  |
| smoke                                                                                                                                                           | 45 steps                | 60 step tuples (ten new refusal/redirect steps plus read-backs; all green) |

### The smoke steps (D4, converted before deleting)

Numbers follow the plan's list. (1) `POST /api/log` with `target=52.23,21.01` -> `/log/new?night=2019-03-07&error=errors.observation.objectInvalid`, `exact`, `absent: "52.23"`, then `GET /log` excludes the value and the night. (2) malformed onboarding `eyepieces` -> `/onboarding?error=errors.onboarding.eyepiecesMalformed`, `absent: "52.23"`, then `/onboarding` still renders unsaved (the next existing step saves it). (3) "plan 12": `site=52.23,21.01` -> `/tonight/plan?error=errors.save.sessionPlan` (no `site=`), `absent: "52.23"`; "plan 11" is its read-back (the island still `suggested`). (4) a sky-check answer with `from=https://evil.example` -> `/log/sky?error=errors.notFound.skyCheck`, `absent: "evil"`. (5) signed-out `GET /log` -> `/auth/signin?next=%2Flog`. (6) signed-out `POST /api/log` -> `/auth/signin`, then the user signs in again and `/log` excludes the posted night, then signs out. (7) `GET /` signed out carries both CTA hrefs. (8) `GET /` signed in -> 302 `/tonight`. (9) `GET /log/<unknown id>` -> 404. (10) `GET /tonight/all` -> 301 `/tonight/targets` (the fragment never reaches the server).

Deliberate breaks, each step red on a rebuilt preview and the source restored with `git checkout --` (the batch was applied and restored within single commands): the log redirect echoing any prefill value (step 1 red), the onboarding failure redirect carrying `eyepieces=` (step 2 red; the existing "invalid onboarding" step also went red), `planQuery` accepting any string as `site` (step 3 red), the sky-check `from` schema without its `.catch("sky")` and a pass-through redirect (step 4 red: `https://evil.example?error=...`), the middleware dropping `?next=` (step 5 red), `/api/log` removed from `PROTECTED_ROUTES` (step 6 red), the signup CTA href changed (step 7 red), the signed-in redirect on `/` removed (step 8 red), the entry page answering 200 for an unknown id (step 9 red), the legacy redirect turned into a 302 (step 10 red). The first batch's attempt on step 4 stayed green because the schema's `.catch("sky")` holds the rule, so the break targeted that guard instead. The auth tuples assert only what S-06 does not change (the `?next=` continuation, the plain sign-in for a POST, the off-site `next` refusal that already existed).

### Ledger rows of this phase

- routes/*, auth/session-user, auth/middleware: every "never lets ... reach a log argument or the redirect" case kept (signin, signup, plan-save, plan-reset, gear-site-update, onboarding, log-create, session-user), plus "still redirects when Auth is down (a 503), and now leaves one auth.claims line without the email".
- account-plan/account-plan: "is unknown when the read fails, logs a fixed line and the code once, and leaves access closed (reviews F11, F4)" kept; describe "what the failed read's line holds (review F5)" folded to 1; describe "the time the plan was read (review F1)" kept (2 tests).
- observations/celebrate: the four named pins and describe "reachedBySave traces a failed milestone step under the route's own step" kept, titles unchanged. observations/redirect: the four named pins plus the coordinate-never-a-notice case ("ignores anything that is not a target") and the fixed-milestone-keys case ("drops values that are not milestone keys") kept. observations/store "skips no row when the host returns fewer rows than a page (a lower max_rows)" kept. observations/log-night (a)-(c): kept in one zone (`America/Los_Angeles`); the zone rule is held by `night-boundaries`.
- offline/coalesce "re-runs once, for the latest value, after the run in flight (not dropped, not stacked)": kept. offline/copies: all 19 listed pin titles kept unchanged (checked one by one) plus the D-14a free-island test. progress/milestones: describe "withStored" folded 6 -> 3, describe "newlyReached" kept (7). session-plans/checks: both pins kept. sky-checks/pending: both pins kept.
- toasts describe "celebrationHolding": replaced by `tests/e2e/observing-milestones.spec.ts`, whose title is "celebrates a milestone once, at save" (not the ledger's wording): under a fake clock it asserts one dialog, the save's own toast beside it, the toast still there past its timer, `document.activeElement` is `MAIN` after Continue, the toast then expires, and the `milestone` param is cleared including after a reload. compass, preferences, the schema no-echo cases: dropped by owner (recorded in the ledger).

### Judgement calls

Dropped to meet per-file targets and held elsewhere: the per-family `request.form` case of the six route suites (the line is pinned by `observability/log-failure.test.ts` and the kept signin case), the signin and signup rate-limit "noted" lines (their own tests), `sky-checks/pending`'s "shown site only" and "skips answered and skipped nights" filters (held by `sky-checks.spec` and the db RPC tests), `session-plans/checks` `keysWithoutWindow` cases (held by `tonight/plan-window.test.ts` and smoke plans 8 and 10), `page-state` `storePageMessage` (held by `session-plan-store.spec.ts`). `page-state` `withDescription` has no other oracle and stays. `routes/auth.test.ts` keeps no `?next=` or success-redirect case (smoke holds them), so the S-06 rebase should be small.

### Break checks (unit; each red, then restored with `git checkout --`)

- A stored finder chart kept after an explicit `free` (`copies.ts` `commitPair`, `demoted = false`): "compares the plan-read time ... (F1)" and "an island rendered for a free account is committed, sets freeSince and takes every chart with it (D-14a)" red.
- A milestone lost after its only entry is deleted (`celebrate.ts`: the before-state not recorded for a non-counting save): "stores the milestone before a delete takes its only entry away" and two failure-line tests red.
- A store returning the PostgREST message in its fault (`gear/store.ts` `writeFailure`): "keeps only its code next to the fixed key for a server fault, in every write" and the classification loop red.
- The agents also ran: map-view clamp, `geolocationAlreadyGranted`, the DEEP_SKY_KEY grammar, search ranking, `dropFinderCopies`, `withStored`, the Messier-count dating, the rating rule, the coalescer.

### Whole-suite checks

Run locally the way CI does (a fresh `npm run build`, the forecast fixture on 4409, the preview on 4341, local Supabase, the keys inline): smoke all steps green; the whole e2e suite: 87 passed, 3 skipped, 0 failed (1.1 min, `CI=1`, so a flaky pass would fail).

### S-06 coordination and docs

S-06 (`feat/auth-loose-ends`, paused): whichever lands second rebases; the auth smoke tuples assert only the `?next=` continuation, the plain sign-in for POSTs and the off-site refusal. Docs grep (`grep -rnE 'compass|preferences|protected-routes|session-cookie|toasts|gear/schemas|onboarding/schemas|targets/labels|session-plans/(read|redirect|schemas)|sky-checks/schemas|gear/(coordinates|timezone|eyepiece-presets)' CLAUDE.md context/foundation context/deployment`) found only source-file names (not tests) and `test-plan.md` §6.2 (`log-night`: one zone, updated) and §6.4 (the smoke steps now pin the URL side, updated); `context/deployment/error-visibility.md` names no trimmed test. Fixtures: `RUNNER_ZONES` is no longer imported by `log-night` (still used elsewhere); `WARSAW` of `tonight/test-fixtures` is no longer used by `checks.test.ts`; `NOT_A_FORM` of `test-support/route-context.ts` has one consumer left; nothing deleted.
