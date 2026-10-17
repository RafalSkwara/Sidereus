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
