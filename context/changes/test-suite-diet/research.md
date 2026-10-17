---
date: 2026-10-17T07:10:12+02:00
researcher: Claude (herdr agent "tests", Fable 5.1, with four Opus inventory workers)
git_commit: 82e35cf58994b99988874e5f8f59c7b4894b8549
branch: feat/test-suite-diet
repository: sidereus
topic: "Test-suite diet: which of the 2,605 unit tests protect a feature or an invariant, which are implementation detail, and what a cut to e2e + important integration tests would leave unprotected"
tags: [research, codebase, tests, vitest, playwright, smoke, tests-db, hooks, ci]
status: complete
last_updated: 2026-10-17
last_updated_by: Claude (herdr agent "tests")
---

# Research: Test-suite diet

**Date**: 2026-10-17T07:10:12+02:00
**Researcher**: Claude (herdr agent "tests", Fable 5.1; four read-only Opus workers swept the unit slices, one swept e2e, db and smoke)
**Git Commit**: 82e35cf58994b99988874e5f8f59c7b4894b8549
**Branch**: feat/test-suite-diet (worktree `.claude/worktrees/test-suite-diet`, off origin/main 82e35cf, no upstream)
**Repository**: sidereus

## Research Question

The owner (2026-10-17): "We have over 2.5k tests, surely way too many. Audit and remove most of them. We don't need unit tests at all; we need e2e and some more important integration tests. Test features, not implementation details."

Questions this document answers:

1. What exactly is in the suite today (per file: tests, runtime, what it protects) and what does it cost (CI, the end-of-turn hook)?
2. Per file: KEEP, CONVERT (to e2e or integration), MERGE/TRIM, or DELETE, and why.
3. Where would "no unit tests at all" remove the only protection of a product requirement, a privacy or licence guarantee, or a fixed bug? What is the trade-off and the recommendation in each category?
4. What is a realistic target (test count, CI time, hook time) and how must the cut be sequenced around the in-flight S-06, S-07 and S-08 branches?

## Summary

- **Baseline (runner output, this worktree):** unit 133 files / 2,605 tests (`vitest run --reporter=json`), 23.5 s cold and 11-12 s warm locally, 56-58 s in CI's `ci` job; db integration 9 files / 118 named tests (`vitest list --config vitest.db.config.ts`), 5-6 s in CI; e2e 33 specs / 88 tests (`playwright test --list`), 3 min 17 s to 4 min 2 s in CI; smoke 45 HTTP steps, 10-11 s. The static `it(` count in `src/**/*.test.ts` grew from 12 (2026-09-24) to 1,555 (2026-10-16); the runner's 2,605 is higher because `it.each` / `describe.each` tables expand at collection (5 runner zones × sites, 200 generated cases, 60 small-scope rows).
- **The 2,605 are not 2,605 distinct protections.** By the four slice sweeps, about 1,880 tests (72 %) are one of: a per-case `it.each` row of a property that folds to one assertion with the same protection (night-boundaries 130 → 26, visibility-invariants 203 → 4, tonight/visibility-invariants 100 → 8, small-scope 69 → 7, log-night 60 → 12, rhythm-roles 105 → 4), a formula or constant restated (score, contrast, moonlight, fact-icons, open-meteo), a zod schema accept/reject table (gear, observations, onboarding, session-plans, sky-checks schemas: 93 tests), mock choreography (session-plans/read, parts of load, finder/load, account-plan), a string or i18n tautology (format phrase literals, redirect happy paths, navigation 52 → 1), or a matcher self-test of a guard (runner-zone 47 of 49, silent-catch 13 of 18, fact-islands 13 of 15).
- **About 720 tests in about 95 files carry feature-level protection or an invariant that no browser or HTTP test can reach.** They fall into eight categories (§"Only protection" below). The e2e suite runs on the real clock, at one Madrid site, against a fixed all-clear forecast fixture (`tests/e2e/forecast-fixture.mjs`), so it cannot see a partial forecast, a DST night, an eclipse in 2027, a polar site, a retune of the ranking, or a coordinate in a log line. The PRD itself requires three of these checks (Success Criteria 2, NFR identical-inputs, NFR independent-reference tolerance, NFR isolation "verified by a test that exercises the boundary outside the user interface").
- **Recommendation:** cut to roughly 650-750 unit tests in about 95 files (−72 % to −75 %), split into two Vitest projects: a fast `unit` project (engine reference suites, forecast honesty, night boundaries, invariants, the pure offline rules, privacy pins) that the hook and CI run, and a `guards` project (no-console guard, agent-hooks proof, catalogue provenance) run in CI only, which takes 26.7 s of CPU out of every agent turn. Convert 9-10 refusal and redirect checks to smoke steps, trim about 18 e2e tests that duplicate smoke or pin presentation detail, and trim the db suite's operator-command file. Measured locally this gives a unit suite of roughly 8-10 s cold / 4-5 s warm and a CI `npm test` of about 25 s; the deploy pipeline's critical path (the `smoke` job: Supabase start 76-89 s + e2e 3-4 min) barely moves, so the diet's payoff is maintenance load and hook latency, not deploy time.
- **Sequencing constraint:** `feat/error-visibility-2` (S-07) adds about 210 unit tests in 33 files (route handlers over a Supabase fake, stores, observability) and rewrites `silent-catch-guard.test.ts`; `feat/star-source-switch` (S-08) widens `vitest.config.ts` to `scripts/**/*.test.mjs` (+71 tests) and rewrites the two star provenance tests; `feat/auth-loose-ends` (S-06) has no tests yet. Any diet phase that touches those files must wait for the merge; the engine, components, styles and the leaf-module phases do not overlap them and can go first.

## Detailed Findings

### 1. Baseline: counts, runtime and cost

| Layer | Runner command | Files | Tests | Local | CI (2 runs on main, 2026-10-16) |
| --- | --- | --- | --- | --- | --- |
| unit | `npx vitest run --reporter=json` | 133 | 2,605 (2,595 pass, 4 skipped, 6 todo) | 23.5 s cold, 11.2-12.0 s warm | `npm test` 58 s / 56 s |
| db | `npx vitest list --config vitest.db.config.ts` | 9 | 118 named (about 235 after `each`) | not run (no Docker here) | 5 s / 6 s |
| e2e | `npx playwright test --list` | 33 | 88 | not run | 3 min 17 s / 4 min 2 s |
| smoke | `scripts/smoke.mjs:218-589` | 1 | 45 steps | not run | 10 s / 11 s |

Sources: `/private/tmp/claude-501/-Users-rafalskwara-projects/d4e775c8-4dcf-4af3-96a1-0af37e96bf33/scratchpad/vitest.json` (JSON reporter), `pw-list.txt`, `db-list.txt`; `gh run view 38967432900` and `38958920505` (`.github/workflows/ci.yml`).

Per-file time (JSON reporter, sum of file durations 64.0 s over the forks pool): the ten slowest files are 56.3 s of that sum; the other 123 files are 7.7 s together.

| File | Tests | ms | Why slow |
| --- | --- | --- | --- |
| `src/lib/no-console-guard.test.ts` | 8 | 15,711 | `new ESLint` + first config load about 10 s (comment at :194), about 440 `calculateConfigForFile` calls, 5 type-aware `lintText` samples |
| `src/lib/agent-hooks.test.ts` | 25 | 10,969 | about 22 git sandboxes, 100+ process spawns, a 4 MB pipe write |
| `src/lib/engine/pairings.test.ts` | 31 | 8,712 | a 366-night invariant scan plus a 2-minute brute-force reference |
| `src/lib/engine/events.test.ts` | 43 | 6,645 | 1,000-, 366- and 5,500-night scans |
| `src/lib/tonight/build.test.ts` | 127 | 4,186 | 127 full `buildTonight` builds |
| `src/lib/engine/finder.test.ts` | 49 | 3,551 | brute force over 150 random skies |
| `src/lib/tonight/visibility-invariants.test.ts` | 100 | 2,556 | 47 generated builds with independent altitude |
| `src/lib/catalogue/finder-stars.test.ts` | 19 | 1,530 | unpacks 25,791 stars, two O(925 × 25,791) loops, gzip |
| `src/lib/engine/outlook.test.ts` | 23 | 1,231 | a Tromsø 5-day sweep |
| `src/lib/runner-zone-guard.test.ts` | 49 | 1,083 | scans every source file |

Note: the JSON reporter's per-file `ms` excludes `beforeAll`, so `calibration` (2 ms), engine `visibility-invariants` (9 ms) and `ranking-invariants` (81 ms) undercount their real cost; Vitest's own split is "tests 70 %, import 20 %, transform 10 %".

**The end-of-turn hook** (`.claude/hooks/end-of-turn.sh:123-131`) runs `node_modules/.bin/vitest run` whenever a changed file is not `*.md` or under `context/`, plus `eslint --max-warnings 0 --no-warn-ignored -- <changed files>`. Measured here: vitest 12-24 s, ESLint 18.3 s for one `.ts` file cold and 8.5 s for one `.astro` + one `.tsx` warm (type-aware). One Stop or SubagentStop therefore costs 25-45 s today, and the two guard files alone are 26.7 s of CPU of it.

**CI wall clock to deploy** is set by the `smoke` job (6 min 1 s / 7 min 24 s: npm ci 17-28 s, Supabase start 76-89 s, test:db 5-6 s, db types 10-13 s, build 3-5 s, smoke 10-11 s, playwright install 18-22 s, e2e 197-242 s) plus `migrate` (about 15 s) and `deploy` (about 55 s). The `ci` job (3 min 16-20 s: lint 71-72 s, astro check 24-25 s, test 56-58 s) runs in parallel and is not on the critical path.

### 2. Inventory and verdicts: unit suite (133 files)

Verdict key: KEEP (protects a feature-level risk or an invariant e2e cannot reach), CONVERT(e2e | smoke | db), MERGE/TRIM(→ n) (a minority of the tests carry the protection; n is the estimated count after), DELETE (implementation detail, duplicate, tautology, mock choreography or a snapshot of internals). "Pin" names a fixed-bug regression test that the file holds; a pin is never dropped without saying so in the plan. Line anchors are in this worktree at 82e35cf.

#### 2.1 Engine (`src/lib/engine/`, 31 files, 929 tests, 22.2 s of file time → about 296 tests)

| File | Tests | ms | Protects | Oracle | Pins | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| calibration | 20 | 2 | each calibration night's top 5 shares ≥ 3 with the beginner reference; the Messier bonus neither crowds out nor floods Caldwell (Risk #4, PRD criterion 2) | beginner-reference.ts (source-cited) | no | KEEP, fold the 16 `it.each` rows to 4 and absorb evening-showpieces (→ 8). The only calibration oracle (`:104`). |
| contrast | 9 | 3 | the bulge-core offset, one shared `telescopeLimitingMag`, Hubble-type coverage | formula restated; M31 bands duplicated in expect-reference | no | MERGE/TRIM → 1 (Hubble coverage, beside the catalogue tests) |
| determinism | 8 | 107 | identical inputs → deep-equal ranking, outlook, planets (PRD NFR) | relation | no | MERGE/TRIM → 2; the two budget tests assert nothing on CI (console-only) |
| evening-showpieces | 8 | 1 | October showpieces in the top half, M13 in the top 5 on short nights | reference + median relation | yes (#21 item 1, duration penalty) | MERGE into calibration (→ 2 there) |
| events | 43 | 6,645 | eclipses, elongations, oppositions on the right night; nothing worded visible unless up (US-07) | Espenak/almanac dates + astronomy-engine relation | yes: best-moment F5 ×2, solar eclipse kept until partial end (decision A / F2) | MERGE/TRIM → 25; shorten the 1,000/5,500-night scans (the only event-visibility invariant, `:517-748`) |
| expectation | 15 | 227 | what-to-expect key vs 27 published observing reports; monotone in sky and aperture | expect-reference.ts | partial (F6 https lint) | MERGE/TRIM → 7 (drop "has 22 keys", 4 boundary tests at constants) |
| eyepieces | 23 | 3 | the suggested pair respects the 0.7 mm exit-pupil floor, the magnification ceiling, whole-disc rule | hand-worked optics vs PRD | no | MERGE/TRIM → 10 |
| finder | 49 | 3,551 | the hop starts from a naked-eye star above the minimum altitude, steps ≤ 5.6°, cheapest route; overhead orientation | brute force over 150 skies (`:428,:546,:652`) + 7 published hops (finder-reference.ts) | yes: zenith edge marker ×4 (F2 / owner 2026-10-13) | MERGE/TRIM → 30; the only hop-correctness check |
| log | 8 | 1 | ratings 1-2 never count as seen; a night counts once; FR-018 cut-off | PRD rule | no | MERGE/TRIM → 3 |
| meteors | 22 | 368 | peak night matches NASA; radiant by latitude; bright-Moon flag needs the Moon up | NASA nights + relation | yes: sky-events Phase 5 peak, F10 Moon flag | MERGE/TRIM → 14 |
| moon-disc | 6 | 22 | disc illumination vs Skyfield (looser copy of moon.test), limb side | Skyfield; librations copied from engine | no | MERGE/TRIM → 2 |
| moon-target | 12 | 57 | Moon listed only when lit ≥ 3 % and above the minimum altitude, clear hours only | hand literal + PRD | yes: 3 % floor at every sample (moon-as-target F3), cloud masking | MERGE/TRIM → 5 |
| moon | 31 (+3 todo) | 74 | Moon position, illumination, elongation vs Skyfield (`:161`); moon-free minutes; phase bands | skyfield/moon-warsaw-2026-10-24.json | no | MERGE/TRIM → 8; drop the 3 Stellarium todos (superseded by Skyfield) |
| moonlight | 11 | 4 | Krisciunas-Schaefer brightening falls with separation and phase | physics monotonicity; formula restated | no | MERGE/TRIM → 3 |
| night-boundaries | 130 | 88 | the right night and rollover across DST both ways, month end, UTC+13/+14, in any runner zone (Risk #2) | USNO civil dawn (usno.ts) + hand offsets | yes: Risk #2 bug classes (morning planet prefill, noon rollover F1) | KEEP, 26 distinct cases × 5 zones → run the table in 2 zones (→ 26) or 1 zone (→ 6 table tests) |
| night | 11 | 51 | local noon-to-noon night, 23/25 h nights | hand literal | no | MERGE into night-boundaries (→ 5) |
| objects | 22 (+3 todo) | 29 | altitude and track sanity; grid and refined-window mechanics | culmination formula; rest internal | partial | MERGE/TRIM → 3; window-reference supersedes it |
| outlook | 23 | 1,231 | next not-no-go night; 7 nights, verdict only for 1-3 (invariant 5) | PRD + equivalence to `verdict()` | yes: go-shaped night 2 with a dark hour missing (forecast-honesty review), outlook ≡ nextNightNotNoGo (seven-night F1) | MERGE/TRIM → 16; drop the Tromsø sweep |
| pairings | 31 | 8,712 | Moon-planet / planet-planet pairings vs Skyfield; twilight-only pairings; visible only when both up and dark | skyfield/pairings-*.json + 2-min brute force | yes: F1 twilight pairings (2020-12-21, 2026-06-09, Sydney 2026-04-20) | MERGE/TRIM → 15; keep one of the two independent-altitude oracles (`:334-461` brute force vs `:484-597` invariant) |
| planet-ranking | 11 | 130 | planets listed only above the minimum altitude, inside clear hours; ice-giant aperture gate | hand literal (partly copied) + `vi.mock` | yes: with visible intervals ×3 (#65, planets ranked under cloud) | MERGE/TRIM → 5 |
| planets | 7 | 16 | planet positions and sizes vs Skyfield (`:27`) | skyfield/planets-warsaw-2026-10-10.json | no | MERGE/TRIM → 4 |
| purity | 3 | 108 | the engine reads no clock, env, network, fs, console; moon-disc stays browser-safe | static scan | no | KEEP (only purity guard) |
| ranking-invariants | 12 | 81 | PRD ranking rules as relations: 1-2 inert, seen/bonus/washed-out never decide the bar, permutation-invariant, more aperture never hides | relation | no (F2/F5 fixed the suite) | KEEP (→ 11) |
| ranking | 30 | 122 | tie-breaks, bonus, log-penalty order, reachable flags, reason-line choice, AF fall top 5 | synthetic objects + AF list | yes: reasonComponents below-mean rules (owner 2026-10-16, #159), "never lifts below the bar" | MERGE/TRIM → 15 (3 duplicate visibility-invariants, 2 duplicate ranking-invariants) |
| score | 39 | 24 | duration saturates; moon, brightness, sky; galaxy caps; washed-out rule | mostly formula restated; some relations | yes: never rises under a worse sky (F5); saturation (#21); galaxy caps (#172/#159) | MERGE/TRIM → 15 relation tests |
| sky-frames | 3 | 20 | browser rotation places stars as astronomy-engine does | relation | no | MERGE/TRIM → 1 |
| small-scope | 69 | 348 | small-telescope galaxy rank agrees with the what-to-expect line; M31 at 60 mm under city skies leaves the top 5 | owner decision + reason-vs-line relation (G5) | yes: #159, G4 (F5), G6 (owner F6) | MERGE/TRIM → 7 (60 G5 rows fold to 1) |
| sun | 16 | 13 | dark window and sun events vs Stellarium (`:105-157`, the only assertions on the stellarium/*.json fixtures); polar clamp; rollover | Stellarium capture | yes: tonightDateFor (fb48a0f2, telescope-selector F1); polar clamp | MERGE/TRIM → 9 |
| verdict | 37 | 7 | go/marginal/no-go thresholds; never go with a dark hour missing or no data; fallback cap; no darkness = no-go (Risk #1) | PRD thresholds | yes: never go with a missing dark hour (forecast-honesty F1); series ends mid-window; clearIntervals (#65) | KEEP (light trim → 29) |
| visibility-invariants | 203 | 9 | no deep-sky, planet or Moon entry outside its window or under the minimum altitude over 200 seeded cases (Risk #3) | independent altitude (independent-altitude.ts) + PRD threshold table | guard by design | KEEP, fold 200 per-case rows → 4 |
| window-reference | 17 | 120 | deep-sky and dark windows vs Skyfield on 3 dates; top 5 within 5 min / 1° (PRD criterion 2, OQ 9) | skyfield/deep-sky-warsaw-2026.json | yes: grid edges off by 5-10 min (#21 item 4) | KEEP (→ 10) |

Cross-file duplicates found (delete one side): "ratings 1-2 change nothing" ×3 (`ranking.test.ts:430`, `ranking-invariants.test.ts:282`, `determinism.test.ts:164-179`); "never below the minimum altitude" (`ranking.test.ts:61-75,154-172` inside `visibility-invariants.test.ts:286`); "washed-out never listed" (`ranking.test.ts:256-272` ≈ `ranking-invariants` (e) `:354`); the same rankings computed in `calibration.test.ts:34-50` and `evening-showpieces.test.ts:29-41`; brightness monotonicity ×3 (`score.test.ts:386,408`, `ranking-invariants:386`, `expectation.test.ts:57-81`); M31 at 60 mm ×3 (`contrast.test.ts:105-110`, small-scope G2/G6, `expectation.test.ts:180-182`); `sun.test.ts:159-188` rollover inside `night-boundaries` (c)/(d); `moon-target.test.ts:130-155` repeats `eyepieces.test.ts:123-211`; `meteors.test.ts:164-181` inside `events.test.ts:691-747`.

The 6 todo tests (`moon.test.ts:126-130`, `objects.test.ts:219-223`) wait for hand-read Stellarium values (fixtures README) since e56529e0 and are superseded by the Skyfield checks; dropping them leaves `stellarium/warsaw-2026-10-24.json` and `tromso-2026-06-21.json` used only by `sun.test.ts:105-157`.

#### 2.2 Tonight, forecast, finder, sky-view, moon-disc, components (39 files, 621 tests, 10.2 s → about 206 tests)

| File | Tests | ms | Protects | Oracle | Pins | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| components/design/finder-samples | 1 | 67 | dev-only `/design` specimens | shape | no | DELETE |
| components/nav-type-roles | 3 | 2 | no raw `text-*` size in the nav | class-string scan | no | DELETE (style convention; e2e nav specs cover overflow) |
| components/tonight/MoonTimeSlider | 2 | 5 | the slider never bundles the engine | import scan | no | MERGE → one shared island-import guard (with TonightSkyView, fact-islands: 3 tests), or an ESLint `no-restricted-imports` rule |
| components/tonight/subnav | 10 | 1 | chip-row scroll maths | hand literal | no | DELETE (tonight-subnav.spec covers it) |
| components/tonight/TonightSkyView | 3 | 12 | no engine and no `@/lib/catalogue` (messier.json) in the live sky | import scan | no | MERGE → shared guard |
| components/ui/fact-icons | 17 | 2 | `factIcon(k) === FACT_ICONS[k]` | tautology | no | DELETE |
| components/ui/fact-islands | 15 | 27 | Fact family and the lucide set never in an island | import scan (13 matcher self-tests) | no | MERGE → shared guard |
| finder/chart-svg | 15 | 6 | the chart is the right way up, labels inside and not overlapping, zenith arrow outward | hand literal + relation | no | MERGE/TRIM → 5 |
| finder/example-chart | 5 | 60 | the free explainer's committed chart equals engine output | sync guard | no | MERGE/TRIM → 1; move regeneration to a script |
| finder/from | 5 | 1 | back-link target string | tautology | no | DELETE |
| finder/load | 18 | 565 | the island loader refuses before any read; chart / not-ranked / no-gear / failed states; fixed log lines | mock choreography + relation | yes: F9 from=plan block | MERGE/TRIM → 8 (free/full/demoted/signed-out duplicate smoke `finder 1/3/4/6`; keep failed read, no DB, order, from=plan) |
| finder/steps | 10 | 21 | the written hop steps say the right direction and end at the target | hand literal | no | MERGE/TRIM → 3 |
| forecast/cache | 2 | 21 | a hung KV read times out | hand literal | no | MERGE → 1 in service |
| forecast/degraded-forecast | 18 | 34 | Risk #1 at body level: a null dark hour never gives go, out-of-range rejected, removing hours never creates go, fallback never go | PRD + relation | yes (Phase 1) | KEEP |
| forecast/night-in-progress | 2 | 12 | at 01:30 local the night in progress keeps its evening hours | PRD | yes (archive 2026-09-25) | MERGE/TRIM → 1 |
| forecast/open-meteo | 8 | 26 | request params; no coordinates in error text | tautology + hand literal | no | MERGE/TRIM → 1 (the coordinate-free error, Risk #6) |
| forecast/service | 27 | 30 | Risk #1 store layer: fresh/stale/miss, fallback flag, keep a usable copy over an incomplete 200 | hand literal + PRD | yes: 10 keep-copy cases red before the fix | KEEP (→ 22) |
| moon-disc/geometry | 14 | 24 | Moon lit on the correct side, maria placed right | relation + real engine states | no | MERGE/TRIM → 6 |
| moon-disc/label | 4 | 51 | the browser's phase line equals the server's | parity | no | MERGE/TRIM → 2 |
| moon-disc/state | 3 | 1 | slider picks the nearest state | hand literal | no | DELETE |
| sky-view/sky-view | 21 | 8 | stars at the true alt/az vs astronomy-engine; projection; labels never dropped | independent rotate + hand literal | no | MERGE/TRIM → 3 |
| tonight/all-objects | 5 | 2 | best-time order across midnight; legacy redirect drops hostile params | hand literal | no | MERGE/TRIM → 2 |
| tonight/altitude-curve | 6 | 2 | SVG path geometry | hand literal | no | DELETE (test-plan §7: screenshot review) |
| tonight/build | 127 | 4,186 | the Tonight view builder | mixed | yes (several, see below) | MERGE/TRIM → 37 |
| tonight/expectation | 7 | 3 | full / free / unknown → lines / locked / none | PRD + tautology | no | MERGE/TRIM → 1 table test (smoke `expect 1-3` has no failed-read case) |
| tonight/forecast-honesty | 11 | 257 | Risk #1 end to end: real service + cache + fake HTTP edge → headline, nights 1-3, status | PRD + relation | yes (Phase 1) | KEEP |
| tonight/format | 26 | 16 | site-zone times across DST; the PRD headline table | hand UTC offsets + PRD | yes: low-altitude wording, sun-depth truncation | MERGE/TRIM → 6 |
| tonight/gear-choice | 4 | 3 | only UUIDs reach a lookup; stale or foreign id falls back | hand literal | no | MERGE/TRIM → 2 |
| tonight/load | 13 | 334 | a forecast outage is never an error page; failed log read marks nothing; plan-edits read uses the right night and fails safe | mock + PRD | yes: D14 log line; dawn night | MERGE/TRIM → 6 |
| tonight/night-boundaries | 30 | 1,004 | Risk #2 in the view: rollover at USNO civil dawn, strip, logHref night, plan order on the 25 h night, validUntil, × 5 zones | USNO + hand literal | yes (Phase 2; planets-on-tonight prefill; verdict-check month end) | KEEP |
| tonight/plan-editor-view | 4 | 4 | the props PlanEditor receives | copied | no | DELETE |
| tonight/plan-editor | 21 | 3 | editor reducer, cap, announcements | hand literal | no | MERGE/TRIM → 3 (session-plan-edit.spec covers the rest) |
| tonight/plan-edits | 10 | 2 | `applyPlanEdits` rows only from suggested or reachable | hand literal | no | DELETE (the edited property in visibility-invariants has an independent oracle) |
| tonight/plan-order | 5 | 5 | the "ends before previous" hint | hand literal | no | DELETE |
| tonight/plan-window | 12 | 253 | the save route's window rule equals the ranking's and `rankPlanets`/`moonTarget` over 22 nights | parity relation | no | KEEP (→ 9) |
| tonight/requested-gear | 2 | 1 | `?night=next` never rewrites the site cookie | mock | yes (offline-night-plan F5) | MERGE/TRIM → 1 |
| tonight/session-plan | 7 | 3 | `layoutSessionPlan` order, clamp, Moon marks | hand literal | no | MERGE/TRIM → 1 |
| tonight/sky-events | 28 | 602 | "eclipse glasses only" never hidden; eclipse shown until partial end, Today/Tomorrow; bright-Moon note on visible showers only | hand literal + fixed clocks (2027 dates) | yes: F3, F2 (decision A), F6, F10b | MERGE/TRIM → 10 |
| tonight/visibility-invariants | 100 | 2,556 | Risk #3 in the view: every plan row, suggested and edited, inside its independently recomputed window; no ranking without darkness or under 100 % cloud | independent altitude + PRD | guard by design | KEEP, fold 94 per-case rows → 8 |

`tonight/build.test.ts` (127 tests, 2,419 lines) by block, with the tests worth keeping: A verdict gate `:152-411` keep `:258, :312, :333` (the rest duplicate forecast-honesty and visibility-invariants); B log `:413-498` keep `:453, :494`; C strip `:500-655` keep `:562` folded, `:601`; D summary fields `:657-706` keep 0-1; E planets `:708-949` keep `:773` (planets only in clear hours, the planets-on-tonight bug), `:852, :884, :893`; F civil dawn `:951-1000` keep `:957`; G Moon card `:1002-1341` keep `:1181, :1257, :1284, :1313`; H washed-out `:1343-1393` keep `:1379`; I reasons `:1395-1457` keep `:1435`; J sky view `:1459-1698` keep `:1639, :1655, :1572, :1690`; K session plan `:1700-1824` keep `:1753, :1801`; L edited plan `:1826-2078` keep `:1859, :1875, :1927` (F9), `:2052`; M sky events `:2080-2348` keep `:2129, :2137, :2169, :2251, :2263, :2335`; N next night `:2350-2419` keep `:2355, :2402`.

#### 2.3 Static guards, provenance and parity (20 files, 352 tests, 31.2 s → about 54 tests, 12 of them in a CI-only project)

| File | Tests | ms | Protects | Kind | Other gate that catches it | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| no-console-guard | 8 | 15,711 | no src file can log a coordinate: `no-console` at error for every src file (`:181`), disables only in the 5 `ALLOWED_DISABLES` files with exact counts (`:197`), `lintText` proves the rule runs in `.astro` scripts, frontmatter and `.ts` (`:217`) | static guard + end-to-end control | partial: `npm run lint` (eslint.config.js:25 sets `warn` in the base, `error` in noConsoleConfig) catches a plain console call; **only protection** for a later `"off"`, a new ignore pattern, any reasoned disable, inline config comments and the silent `.astro` parse failure (lessons.md "Resolving a rule's config is not proof") | MOVE to a CI-only Vitest project (or a `scripts/lint-guards.mjs` step after lint); never DELETE. Optionally `eslint-plugin-eslint-comments` (`require-description`, `no-unlimited-disable`, `no-restricted-disable`) so lint enforces the disable rules. Coupling: `ALLOWED_DISABLES` lists `calibration`, `determinism`, `events` and `finder` `.test.ts` and `:176` asserts each exists; `:174` requires ≥ 300 source files (442 today, 309 non-test). |
| agent-hooks | 25 | 10,969 | the Stop/SubagentStop hook sends a red suite back once (exit 2), lets green finish, reports red on the retry; settings.json reaches the scripts | hook proof (spawns bash, git) | **none**: CI never runs hooks | TRIM → 7 (`:209, :218, :249, :296, :326, :451, :458`) and MOVE to the CI-only project so the hook stops proving itself every turn |
| runner-zone-guard | 49 | 1,083 | no non-test src file reads the process zone (Risk #2) | static guard | **none** statically; could become `no-restricted-syntax` / `no-restricted-properties` ESLint rules | MERGE/TRIM → 3 (47 of 49 test the matcher), or MOVE to ESLint |
| wrangler-config | 4 | 1 | `invocation_logs: false`, `redact_query_string: true`, Issues on, preview_urls | config pin | **none**: a deploy reverts dashboard toggles | KEEP (optionally also assert in the deploy job) |
| observability/silent-catch-guard | 18 | 6 | every catch in runtime src reports, rethrows with a cause, or is allowlisted with an exact count | static guard (TS AST) | partial: `no-empty`, `preserve-caught-error`, `no-floating-promises`; **none** for fallback/constant/redirect shapes | KEEP 2 guard tests + about 3 merged controls; **do not edit before S-07 merges** (it rewrites the file) |
| observability/log-failure | 29 | 8 | the one allowlisted logger prints only `{step, name, code, status}`, never a message, stack, Error or cause text | unit of a privacy contract | **none** | TRIM → 8; coordinate with S-07 (+143 lines there) |
| styles/contrast | 3 | 4 | WCAG 4.5:1 / 3:1 over the `CHECKS` token pairs in dark, light, red, the light night sky | token maths | **none** (no axe, no stylelint) | KEEP |
| styles/no-hardcoded-colors | 1 | 1,076 | no palette class, hex or `rgb()` outside global.css | static guard | **none** (eslint.config.js:16-123 has no colour or Tailwind rule; Tailwind v4 has no config) | KEEP |
| styles/red-theme | 2 | 2 | every red-theme colour has G = B = 0; every `:root` token has a red value | static guard | partial: red-night-mode.spec:34-37 and finder-chart.spec:115-119 check the body background only | KEEP (FR-024) |
| styles/rhythm-roles | 105 | 116 | 20 converted files use the rhythm roles, exact per-file allowances | static guard + 64 matcher tests | **none** | MERGE/TRIM → 4 (DELETE defensible: convention, not safety) |
| i18n | 4 | 10 | `pl` has every `en` leaf, Polish `few`/`many` on every plural; `translateKey` fallback for free text and prototype paths | parity + unit | partial: `satisfies Messages` (pl.ts:1417) covers missing/extra keys; `few`/`many` are optional in `PluralForms` (en.ts:17-19) so **only the test** holds them | TRIM → 2 |
| navigation | 52 | 5 | one current destination per path; `TONIGHT_NAV` = `TONIGHT_PAGES` (`:125`) | unit + parity | navigation.spec:103-119 and tonight-subnav.spec:37-61 cover aria-current; the set parity is unique | TRIM → 1 |
| fetch-timeout | 2 | 23 | Supabase fetch aborts after the timeout | unit | none | DELETE (5-line wrapper over `AbortSignal.any`) |
| catalogue/messier | 6 | 7 | OpenNGC pin `da90466…`, CC BY-SA 4.0, 110 objects, M102 override, Hubble on galaxies | provenance | generator asserts most (build-catalogue.mjs:218-270, :460) but never runs in CI | MOVE to a CI drift check (`npm run catalogue:build && git diff --exit-code src/lib/catalogue/`, the db:types model at ci.yml:49-50); keep 1 provenance test |
| catalogue/caldwell | 10 | 6 | same pin, 61 objects, dec ≥ −23, Double Cluster merged, Rosette label, C30 parse | provenance | generator (:430-445, :291-331, :157) | MOVE (same drift check), keep 1 |
| catalogue/stars | 3 | 9 | HYG pin `c7f7f88…`, licence, count, 41 Polish star names | provenance + parity | generator (build-stars.mjs:176-274); Polish names **none** | TRIM → 1; S-08 rewrites this file |
| catalogue/finder-stars | 19 | 1,530 | same pin and URL as bright stars, **"Credit: ESA"** (`:36-43`), gzip < 160,000 B (`:85-88`), server-only import scan (`:218-259`), decoders, `formatDesignation` | provenance + guard + unit | import scan duplicated and exceeded by build-sw.mjs:89-121 (fails the build); gzip budget and ESA credit **none** | TRIM → 3 (provenance + ESA credit, gzip budget, shape); S-08 rewrites it and adds `HIPPARCOS_FIELDS_USED` / `FIELDS_USED` / a `PINNED_SHA256` of `hip_main.dat` (licence-critical, must survive) |
| catalogue/meteor-showers | 7 | 28 | 8 NASA showers, keys = `SHOWER_KEYS`, peak longitude derived within 0.05°, licence note in the header and LICENSE-DATA.md | provenance (hand-entered) | names typed via `satisfies` (en.ts:990, pl.ts:864); derivation and licence note **none** | TRIM → 2 |
| catalogue/common-names | 2 | 2 | every `COMMON_NAMES.pl` key is a real catalogue id | parity | none | TRIM → 1 |
| test-support/virtual-modules | 3 | 637 | the `vi.mock` seams for `astro:*` and `cloudflare:workers` load | test infrastructure | on main nothing else uses the seams; S-07 adds 3 consumers | DELETE after S-07 (its consumers prove the seams) |

#### 2.4 Leaf modules (43 files, 703 tests, 0.4 s → about 166 tests, plus 5-6 smoke steps)

| File | Tests | Protects | Oracle | Pins | Overlap | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| account-plan/account-plan | 13 | the plan gate fails closed; a failed read is `unknown`, never `free`; planAt stamp errs toward refusing | mock + PRD | yes: finder F11/F4 (`:108`), impl F1 (`:131-166`) | smoke finder 1-6, plan 1-7 | TRIM → 4 (`unknown` is unreachable over HTTP) |
| account-plan/store | 4 | a failed read reports a code or name, never the message | stub | yes: finder F4 | none | TRIM → 1 (fold above) |
| api-errors | 3 | auth codes → fixed keys; a non-key zod message never reaches a URL | hand literal | no | smoke exact `invalidCredentials`, `latitudeRange` | TRIM → 2 (`:13`, `:28`) |
| auth-redirect | 10 | `safeNextPath` open-redirect guard | hand literal | no | smoke "ignores an off-site next" (only `//evil`), sign-in-continue.spec | KEEP refusals `:25-50` (→ 5) |
| compass | 2 | 16-wind mapping | hand literal | no | tonight-sky.spec | DELETE |
| gear/catalogue/catalogue | 13 | hand-entered catalogue data rules (https sources, brand+model names, ratios, every entry saves) | data vs README | no | gear-catalogue.spec (one pick) | TRIM → 12 (a data lint for the EU-database-right rules) |
| gear/catalogue/fill | 5 | a pick maps onto form strings | hand literal | no | catalogue fill-all, onboarding.spec | DELETE |
| gear/catalogue/search | 10 | combobox matching | hand literal | no | gear-catalogue.spec, onboarding.spec | TRIM → 3 |
| gear/coordinates | 1 | round to 0.01°, no −0 | hand literal | no | site-location.spec, site-map.spec | DELETE |
| gear/eyepiece-presets | 1 | AFOV → preset | hand literal | no | catalogue | DELETE |
| gear/schemas | 18 | site/telescope/eyepiece zod rules | tautology | no | smoke latitude 95 (`absent: "95"`) | DELETE (list of unexercised rules below) |
| gear/timezone | 4 | auto zone lookup, manual zone | hand literal | no | db onboarding:176, seven-night-planner.spec | DELETE |
| location/geocode | 10 | request shape; no query text in the error | hand literal + fake fetch | no | onboarding.spec (stubbed) | TRIM → 2 (rounded mapping, `:116` never puts the query or URL into its error) |
| location/locate | 10 | rounded device position; no prompt unless granted | hand literal | no | site-location.spec, site-map.spec | TRIM → 3 |
| location/map-view | 20 | map pick parse, wrap, clamp, round | hand literal | no | site-map.spec | TRIM → 2 |
| observations/celebrate | 20 | save order: one record, celebrate only inserted keys; a failure never blocks the write; log never carries the message | relation with in-memory fakes | yes: milestones F1-F4, plan F11 | observing-milestones.spec, db milestones:110 | TRIM → 9 |
| observations/log-night | 60 | the log form's default night is never ahead of the server bound, across DST and month end | USNO + relation | yes: Phase 2; planets-on-tonight prefill | db observations "accepts the evening ahead" | TRIM → 12 (drop the ×5 runner-zone loop; the static guard holds the zone) |
| observations/redirect | 25 | free text, coordinates or hostile ids never reach the log URL; fixed milestone keys; nothing signed out | hand literal | yes: milestones plan F3 (`:201`) | none (smoke never POSTs `/api/log`) | TRIM → 6 privacy guards (`:44, :54, :82, :104, :118, :138, :191, :201`) + 1 smoke step |
| observations/schemas | 27 | log entry zod rules; no echo (`:56`) | tautology | no | observation-log.spec ratingRequired; db target grammar | CONVERT(smoke) + keep `returnTargetSchema` (1) |
| observations/store | 6 | latestNightBound; paged seen read under a lower `max_rows` | fake client | yes: observing-progress F2 (`:73`) | db observations:261-291, :496 | TRIM → 1 (`:73`: db cannot lower `max_rows`) |
| observations/target-search | 14 | log picker matching | hand literal | no | observation-log.spec "c 20" | TRIM → 3 |
| offline/coalesce | 6 | store-page runs re-run once, never dropped | hand literal | yes: adjustable-session-plan F10 | session-plan-store.spec (single run) | KEEP (→ 3) |
| offline/copies | 185 | every service-worker decision (store/commit, notice params, awaitsNetwork, storeRequestFrom, island parsing and owner, answerTime, plan-loss drop, owner purge, expiry, chooseCopy/needsNextCopy, listCopies, parseIndex) | hand literal + relation | many: finder plan-review F11/F12/F14, impl F1/F6; adjustable-session-plan F2a/F10; offline-night-plan F1/F2/F4/F5 | offline.spec, finder-offline.spec, session-plan-store.spec (happy paths + one purge each) | KEEP, TRIM → about 58 (table in the worker report: recognition 27→4, notice params 18→2, awaitsNetwork 19→2, storeRequestFrom 40→4, island/owner 20→9, answerTime 3→2, assets 4→1, commit 6→3, plan-loss drop 12→8, owner purge 6→4, expiry 3→2, serving 15→9, listCopies 3→2, parseIndex 8→4). Expiry, next-night rollover, `freeSince` races, owner switches and malformed postMessage/index data are reachable only here. |
| offline/owner | 2 | the fingerprint never contains the user id | relation | no | none | KEEP |
| offline/page-state | 12 | notice choice and hiding, describedby, store-page message | hand literal | no | offline.spec, toasts.spec:153, session-plan-store.spec | TRIM → 3 (stale / old-forecast notices are time-based; e2e never shows them) |
| onboarding/presets | 2 | every preset saves through the gear schemas | relation | no | onboarding.spec (default only) | TRIM → 1 |
| onboarding/schemas | 19 | onboarding zod rules, no echo (`:102`) | tautology | no | smoke "invalid onboarding"; db onboarding | DELETE + 1 smoke step (malformed eyepieces JSON) |
| preferences | 12 | theme/locale cookie, Accept-Language parsing | hand literal | no | red-night-mode.spec | DELETE |
| progress/progress | 11 | checklists 110/61; rated 1-2 never ticks (invariant 4); nights once | PRD | no | observing-progress.spec:48, :209 | TRIM → 4 |
| progress/milestones | 46 | derivation, newlyReached, withStored ("a milestone outlives the entry": `:442-456`) | PRD + tables | yes: plan F11 | db milestones; observing-milestones.spec:104 (stored milestones only; the derived-only case is unit-only) | TRIM → 15 (keep withStored, newlyReached `:369-415`, 6 boundary cases) |
| protected-routes | 2 | whole-segment gating | hand literal | no | smoke anonymous redirects, plan 6 | CONVERT(smoke): signed-out `/log` and `/api/log` |
| session-cookie | 2 | 30-day cookie | hand literal | no | smoke "30-day session cookie" | DELETE |
| session-plans/checks | 9 | only newly added keys are window-checked (F4) | engine relation | yes: adjustable-session-plan F4 | smoke plan 8, plan 10 | TRIM → 3 |
| session-plans/read | 7 | `session_plans` queried only for a confirmed full plan | mock | no | smoke plan 2/4/5/7 | DELETE |
| session-plans/redirect | 6 | `site=` only when id-shaped | hand literal | no | smoke plan 1/9 exact, plan 8/10 `absent` | CONVERT(smoke): post `site=52.23,21.01` |
| session-plans/schemas | 20 | save/reset zod rules | tautology | no | smoke plan 3/10; db session-plans | DELETE |
| sky-checks/claim | 20 | headline → claim, outcome, tally | PRD table | no | sky-checks.spec; db:277 | MERGE → 4 |
| sky-checks/pending | 8 | newest open night of the last two | hand literal | yes: verdict-check month boundary | sky-checks.spec; db:216 | TRIM → 2 |
| sky-checks/record | 6 | no sky check without a dark window | hand literal | no | db sky-checks RPC | TRIM → 1 |
| sky-checks/schemas | 9 | action enum; `from` fallback | tautology | no | smoke unknown sky-check id | CONVERT(smoke): `from=https://evil.example` |
| targets/index | 30 | key grammar; planet/Moon keys match the engine; legacy `?object=31` | relation + tautology | no | db observations:164-210 | TRIM → 4 |
| targets/labels | 7 | localised labels, `isKnownTarget` | i18n tautology | no | smoke plan 10 (NGC1), observation-log.spec:69 | DELETE |
| toasts | 6 | `withoutParams`; the celebration holds the toast timer | hand literal | yes: milestones F1 (`:29`) | toasts.spec:73, :139; observing-milestones.spec:160 | DELETE (e2e pins both) |

Schema rules that no smoke step exercises today (smoke sends only `latitudeDeg: "95"` to `/api/onboarding` and `/api/gear/sites`, and the plan 3/9/10 cases): gear Bortle 1-9, minimum altitude ≤ 60, name length, longitude range, manual zone, rounding, aperture ≥ 20, AFOV rules; observations everything (smoke never POSTs `/api/log`: rating 1-5, night ≥ 1900, gear UUIDs, empty gear on update); onboarding longitude, Bortle, eyepiece limits, malformed eyepieces JSON, ≤ 10 eyepieces; session-plans non-string keys, non-UUID site, malformed night, reset refusals; sky-checks invalid action and `from` fallback. Only three of these are privacy-flavoured (the "never echoes a value" tests at gear `:65`, onboarding `:102`, observations `:56`); messages are catalogue keys by construction and smoke's `absent:` pins the URL side.

### 3. Inventory and verdicts: non-unit layers

#### 3.1 E2E (33 specs, 88 tests). Every test but about 8 signs up and onboards a fresh user through the UI (`helpers.ts:122`), about 80 browser sign-ups per run; `playwright.config.ts` sets neither `workers` nor `fullyParallel`.

| Spec | Tests | Journey | Date dependence | Verdict |
| --- | --- | --- | --- | --- |
| finder-chart | 4 | full-plan M13 chart from Targets, fits 360 px, red theme | t1 only inside the no-darkness window (8 Jun-2 Jul, `helpers.ts:220`), t2-4 skip inside it | TRIM: t1 = smoke `finder 3`, t4 = red-night t1; keep t3 (layout) |
| finder-offline | 1 | chart stored, opens offline, dropped after plan loss (two paths) | skips in ND | KEEP (only plan-loss-drop journey; 240 s timeout `:66`) |
| gear-catalogue | 1 | catalogue pick fills the telescope form | none | MERGE with onboarding t2 |
| landing-screenshot | 1 | capture tool (`CAPTURE_LANDING=1`), always skipped in CI | n/a | TRIM from the counted suite |
| landing | 2 | CTA hrefs; signed-in `/` → 302 | none | TRIM → smoke |
| moon-as-target | 1 | Mark the Moon observed, seen tag | skips about half of nights | MERGE into one mark-observed journey |
| moon-card | 1 | slider redraws the disc | skips without a slider | KEEP or TRIM (widget) |
| navigation | 3 | TabBar fits 320 px PL, Topbar 768/1024, one aria-current | none | MERGE t3 with tonight-subnav; keep layout t1/t2 |
| observation-log-management | 2 | add, edit, re-rate, move, delete; 404 | none | KEEP t1; TRIM t2 → smoke |
| observation-log | 3 | mark observed from Targets, rating required; not-found; Caldwell search | none | TRIM t2 → smoke; MERGE t1 with tonight-targets t1 / observing-progress t1 |
| observing-milestones | 2 | stored once and kept after edit/delete; celebration once, toast waits, focus | past night seed | KEEP t2; MERGE t1 with observing-progress t4 |
| observing-progress | 4 | not-seen mark; tooltip hover/Tab/touch; progress counts | none | TRIM t2/t3 (tooltip mechanics, quarter-pixel mouse loop `:125`) |
| offline | 1 | Tonight and plan served from the device, notices, sign-out purge, no email in `/offline` | none | KEEP (`waitForTimeout(1000)` at `:121` violates §6.5) |
| onboarding | 4 | place search → go Tonight; catalogue telescope; use my location; abandoned onboarding | none | KEEP t1-3; TRIM t4 (telescope-selector `:184-187` reaches the same prompt) |
| planets-on-tonight | 2 | mark a planet observed; fact labels, Polish colon | skip when no planet | MERGE t1; TRIM t2 |
| red-night-mode | 3 | theme cycle, cookie, red has 0 G/B; underline; credit colour | none | KEEP t1; TRIM t2/t3 |
| service-worker-control | 1 | the `waitForServiceWorker` helper's race | none | KEEP while offline specs exist |
| session-plan-edit | 7 | remove/move/add/save; second device; keyboard; Reset dialog; free lock; offline; night-over | all skip on `held` (never with the fixture) | KEEP t1/t3/t4/t6; TRIM t2 (smoke plan 3/5), t5 (plan 4); CONVERT t7 `nightOver` (`:339`) to smoke |
| session-plan-store | 3 | saved, reset, slow-landing plan pages stored offline | skip on `held` | KEEP; merge reset into save (180 s ×3) |
| seven-night-planner | 1 | strip shape, site switch, cookie, deleted site falls back | none | KEEP |
| sign-in-continue | 1 | signed-out `/log` → `?next`, sign in lands on `/log` | none | TRIM (smoke 3, 10, 12) or keep as the one browser sign-in |
| site-location | 2 | geolocation only on click, rounded, saved; edit + undo | none | KEEP |
| site-map | 2 | no tile or map code before the click; tap saves rounded | none | KEEP |
| sky-checks | 1 | seeded past night asked, answered, tallied | past-night seed | KEEP |
| sky-events | 2 | events page shape EN/PL | branches on rows vs empty | MERGE t2 into t1 |
| telescope-selector | 1 | select re-ranks, cookie, deletes fall back, prompts | none | KEEP |
| toasts | 6 | position, one status role, ×, timer pause, island toast adopted, closed notice stays closed | fake clock | KEEP t1/t2/t4/t5; TRIM t3 (44 px), t6 (= offline.spec:80-97) |
| tonight-dashboard | 3 | six tiles open and come back; events tile; plan rows | events vary | KEEP t1; MERGE t3; t2 optional |
| tonight-phone | 4 | owner's 390×844 first screen; no sideways scroll at 320/375 EN/PL on 10 pages; editor; panorama height | editor skips on `held` | KEEP t1/t2 (owner-pinned); TRIM t4 |
| tonight-sky | 7 | slider, Home/End/Now; marker opens the row; chevrons; edge labels; compass; no scrollbar | t2/t3 skip without a marker | KEEP t1-3; TRIM t4-7 |
| tonight-subnav | 5 | seven chips, current chip, no back link; finder keeps its back link; phone scroll; plan one tap | none | MERGE t1/t2/t3/t5 into one with navigation t3; keep t4 |
| tonight-targets | 3 | best five, rest by time; `/tonight/all#more` 301 | t3 skips without a washed-out object | KEEP t1 (fold the 301 into smoke); TRIM t2/t3 |
| what-to-expect | 4 | free locked line; full phrase; 320 px EN/PL and the Polish colon; finder line | all skip in ND | TRIM t1/t2/t4 (smoke `expect 1/2`, `finder 3`); KEEP t3 |

Net: about 18 tests trimmed or merged, 5 converted to smoke; the suite stays 33 → about 28 specs, 88 → about 65-70 tests. Runtime saving is modest (each test is one sign-up, 5-20 s) and unmeasured here.

#### 3.2 Database suite (9 files, 118 named tests, about 235 after `each`)

| File | Tests | Proves | Verdict |
| --- | --- | --- | --- |
| isolation | 10 (×7 tables) | cross-user select/update/delete/insert/hand-over, anon writes, `42501` pins, read-back as owner | KEEP (PRD NFR, prd.md:530-531) |
| structure | 11 | every `public` table classified, RLS + four policies, server-owned privileges, INVOKER views, functions INVOKER + `search_path` + no anon | KEEP |
| account-plans | 7 | owner cannot write (`42501` ×4), no self-grant, no cross-user read, anon refused | KEEP |
| account-plan-command | 21 | the operator CLI `scripts/account-plan.mjs` | TRIM → about 6: 3 are `parseArgs` units (`:95-139`), 3 use fakes and never touch the DB (`:299-347`); smoke and e2e already run the script as a child process every CI run (smoke.mjs:98, helpers.ts:200) |
| milestones | 7 | once-only record, concurrent saves celebrate once (`:110`), key check = `MILESTONES`, accepted self-write, cross-user | KEEP; TRIM `:93` (counts requests) |
| observations | 27 (~54) | gear-reference guard, entry outlives gear, target grammar (8 + 17 + 5 rows), night-in-future rule, seen read past 1,000 rows, 50-per-page | KEEP the store/RPC cases; TRIM the grammar tables to a few rows |
| onboarding | 6 | `complete_onboarding` all-or-nothing, once only, anon `42501` | KEEP |
| session-plans | 12 (~24) | site and user guards, unique key, upsert/reset, cascade, targets checks | KEEP; TRIM the 13-row `refuses %s` table (`:267`) |
| sky-checks | 16 | `record_sky_verdict` rules, check outlives site, store list/answer/tally | KEEP |

#### 3.3 Smoke (`scripts/smoke.mjs`, 45 steps as `[name, run, expected]` tuples at `:218-589`, runner `:591-640`)

Groups: auth and anonymous gates (1-5, 9-13), onboarding (6-8), gear writes (14-19), invalid-latitude privacy pins (6 and 16: `exact: true, absent: "95"` at `:235, :281`), finder gate (20, 22, 23, 25, 38, 39), expect gate (21, 24, 40), session-plan save and refusals (26-34, 41, 42), the one sky-check step (35), sign-out (36, 37, 43-45). 23 steps use `exact: true`; `absent:` appears at `:235, :281, :401, :480, :511`. One user, one cookie jar, strictly sequential; island URLs captured from the shell's preload link (`:134-146`) and replayed (`:149-190`). A new step costs one 5-10 line tuple (template `:278-282`); body checks add `bodyIncludes` / `bodyExcludes`. Not covered today: any `POST /api/log`, the gear UPDATE routes, `nightOver`, a second user or a DB read-back (which would need a second jar or a PostgREST fetch; `helpers.ts:135` uses supabase-js, which smoke avoids).

### 4. Where "no unit tests at all" removes the only protection

For each category: what the tests hold, what else would catch it, the trade-off, and the recommendation. The owner's choices are listed at the end in Polish.

| # | Category | Only protection today | What else catches it | Trade-off of deleting | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | **Engine vs Stellarium/Skyfield/USNO across dates** | `sun.test.ts:105` (Stellarium), `moon.test.ts:161`, `planets.test.ts:27`, `pairings.test.ts:166`, `window-reference.test.ts`, `night-boundaries.test.ts` (USNO), `events.test.ts` (Espenak dates); fixtures under `src/lib/engine/fixtures/{skyfield,stellarium}/`, `usno.ts` | Nothing. E2E runs on the real clock at Madrid; no spec reads a time or altitude against a reference. PRD NFR (1° / 5 min, prd.md:514-516, OQ 9) and Success Criterion 2 (prd.md:67-70) require it. | A wrong window time, a mirrored Moon, a missed eclipse or a wrong "tonight" at dawn ships unseen until a user compares with a planetarium. | KEEP as an "engine reference suite" (about 90 tests in 8 files after trimming duplicates and the 1,000-night scans). Not convertible. |
| 2 | **Calibration vs the beginner reference** | `calibration.test.ts:104` (k ≥ 3 overlap, source-cited `beginner-reference.ts`), the AF set check in `ranking.test.ts:243`, `small-scope` G5 (reason vs line) | Nothing. The owner's own sky-check tally is the only field signal, weeks later. | A retune passes (Risk #4, the test-plan's named "oracle problem"); lessons.md "Judge advice that no observer can check against source-cited references". | KEEP (→ about 8 + 7). Not convertible. |
| 3 | **PRD invariants as relations** (no impossible target, ratings 1-2 inert, bonus never decides the bar, permutation invariance, forecast honesty, plan-window parity, determinism) | `visibility-invariants` ×2, `ranking-invariants`, `degraded-forecast`, `service`, `forecast-honesty`, `plan-window`, `determinism`, `verdict` | E2E sees one site, one night, 0 % cloud; smoke checks a 200. `tests/db` sees none of it. | A confident "Clear" on a partial forecast (Risk #1, the owner's top worry), a target below the horizon on a polar site, a retune that breaks a PRD rule. | KEEP, folded (`it.each` rows → single assertions; about 120 tests). Not convertible. |
| 4 | **Privacy guards** (coordinates never in logs or URLs, Risk #6) | `no-console-guard`, `log-failure` ("never a message or stack"), `wrangler-config` (invocation logs off, found in production 2026-10-16), `observations/redirect` privacy cases, `offline/owner` (fingerprint never holds the id), `open-meteo:` coordinate-free error, `geocode:116`, `silent-catch-guard`, `auth-redirect` refusals | Partial: `npm run lint` catches a plain `console.log`; smoke pins `absent: "95"` and the `//evil` next. Nothing catches a reasoned disable, a config `"off"`, the `.astro` parse failure, a logged `error.message`, a dashboard toggle reverted by deploy. | PII in Workers Logs (the NFR at prd.md:524-529; the invocation-event finding was real). | KEEP the pins (about 25 tests); MOVE `no-console-guard` to a CI-only project; add 5 smoke steps for the URL side (log POST with a coordinate in `target`, malformed onboarding eyepieces, plan `site=52.23,21.01`, sky-check `from=https://evil.example`, signed-out `/log` and `/api/log`). |
| 5 | **Colour, contrast and red-theme token guards** | `styles/contrast`, `no-hardcoded-colors`, `red-theme`; `rhythm-roles` and `nav-type-roles` (conventions) | Nothing for hex colours, a token missing in one theme, green/blue in red mode (e2e checks the body background only: red-night-mode.spec:34-37). No axe, no stylelint, no Tailwind lint. | Red mode leaks green or blue (FR-024, dark adaptation); an unreadable light theme. | KEEP the three colour guards (6 tests). TRIM `rhythm-roles` → 4 or DELETE; DELETE `nav-type-roles`. |
| 6 | **Data provenance and licence** (OpenNGC pin, HYG pin, "Credit: ESA", gzip budget, NASA/IAU note, `HIPPARCOS_FIELDS_USED` on S-08) | `catalogue/{messier,caldwell,stars,finder-stars,meteor-showers}.test.ts` | The generators assert most shape rules but never run in CI; `build-sw.mjs:89-121` already fails the build if finder stars reach the client. Nothing checks the committed JSON, the ESA credit or the gzip budget. | A hand-edited catalogue ships; the ESA credit disappears (licence decision pending, memory 2026-10-16); a star file grows past the budget. | MOVE shape checks to a CI drift check (`catalogue:build && git diff --exit-code`, as db:types at ci.yml:49-50; needs raw.githubusercontent.com from CI), keep about 8 provenance and licence tests. Wait for S-08. |
| 7 | **DB RLS and structure** (`tests/db`) | isolation, structure, account-plans, onboarding, sky-checks, session-plans, milestones, observations | Nothing else; PRD NFR demands a test outside the UI. | Cross-user reads. | KEEP whole (integration, in the owner's scope); TRIM `account-plan-command` and the grammar tables (118 → about 95). |
| 8 | **Agent-hooks proof** | `agent-hooks.test.ts` (Phase 5 deliverable) | Nothing; CI never runs the hooks. | The hook breaks silently and agents end turns red; CI still catches the suite, but CI checks are not required (only a human merges). | TRIM → 7 and MOVE to the CI-only project (it never needs to run on an agent's own Stop). |

Observation outside the diet's scope (no action): `finder/load.test.ts:105` pins "a failed plan read answers like a free account" (`locked`), which is `requireFullPlan`'s documented fail-closed rule (`src/lib/account-plan/index.ts:20-24, :66`), while the later lesson "keep unknown apart from free" (lessons.md, S-04/S-08) gives those features an `unavailable` state. S-03 predates the lesson; the plan should keep the pin and not resolve the product question.

### 5. Targets

| Measure | Today | After (recommended) | Basis |
| --- | --- | --- | --- |
| unit tests (`npm test`) | 2,605 in 133 files | about 650-750 in about 95 files (−72 % to −75 %); about 33 files deleted outright, 3 import guards merged into 1 | per-file verdicts: engine 929 → ~296, tonight 621 → ~206, guards 352 → ~42 in `unit` + ~12 in `guards`, leaf 703 → ~166 |
| unit wall time, local | 23.5 s cold / 11-12 s warm | about 8-10 s cold / 4-5 s warm | the two guard files (26.7 s file time) leave `npm test`; pairings 8.7 → ~3 s, events 6.6 → ~3 s, build 4.2 → ~1.5 s, finder 3.6 → ~2.5 s, finder-stars 1.5 → ~0.3 s |
| CI `npm test` | 56-58 s | about 25 s | CI runner about 2.5× slower than local |
| CI `ci` job | 3 min 16-20 s | about 2 min 45 s | not on the critical path |
| CI critical path (smoke → migrate → deploy) | 7.5-9 min | 7-8.5 min | e2e trims save about 30-60 s; Supabase start (76-89 s) and the remaining e2e dominate |
| end-of-turn hook per Stop | 25-45 s | about 12-25 s | vitest 4-10 s + type-aware ESLint 8-18 s; ESLint becomes the larger half |
| e2e | 88 tests / 33 specs | about 65-70 / 28 | §3.1 |
| smoke | 45 steps | about 55 steps | 5 privacy steps + 5 converted checks (landing ×2, 404, `/tonight/all` 301, `nightOver`) |
| db | 118 named | about 95 | §3.2 |

Estimates, not measurements: nothing was deleted in this research. The after-figures assume the trims in §2 and will be re-measured per phase by the plan.

### 6. Sequencing constraints

- **S-07 `feat/error-visibility-2`** (22 commits, Phase 1 of 9 done per `context/changes/error-visibility/plan.md:664-724`): adds about 210 unit tests (33 files; the route suites under `src/lib/routes/`, store suites, `observability/{fault,read-failure,save-failure}`, `auth/{middleware,session-user}`, `supabase`, `forecast/kv-cache`) and rewrites `silent-catch-guard.test.ts`, extends `log-failure.test.ts` (+143 lines), `build.test.ts` (+117), `load.test.ts` (+108), `service.test.ts` (+171), `celebrate`, `redirect`, `record`, `account-plan`, `finder/load`. Its success criteria 1.1-1.7, 2.1-2.5, 3.1-3.5, 4.1-4.4 are unit-suite criteria. Any diet edit to those files on main conflicts; the diet's phases that touch them must follow the merge, and the owner must decide whether S-07's new route tests (a Supabase fake under real handlers, closer to integration than to unit) are judged by the same rubric or frozen.
- **S-08 `feat/star-source-switch`** (18 commits): `vitest.config.ts` include widened to `scripts/**/*.test.mjs` (+71 tests), `stars.test.ts` and `finder-stars.test.ts` rewritten with `HIPPARCOS_FIELDS_USED` / `PINNED_SHA256` licence pins. The provenance phase waits for it.
- **S-06 `feat/auth-loose-ends`**: docs only; no constraint yet.
- **Couplings inside the suite:** `no-console-guard.test.ts:43-53` allowlists `calibration`, `determinism`, `events` and `finder` test files and `:176` asserts they exist (edit the guard in the same commit as any of those deletions); `:174` needs ≥ 300 files under `src` (309 non-test today); `fixtures/index.ts`, `generated.ts`, `independent-altitude.ts`, `usno.ts`, `runner-zones.ts` stay in use after the trims; `stellarium/*.json` stay used only by `sun.test.ts`; `scripts/*-reference.py` go dead with their fixtures; `src/lib/test-support/virtual-modules.ts` gains consumers on S-07.
- **Fixed-bug pins** are named per file in §2 (column "Pins"); the plan lists each one it keeps or deliberately drops.

## Code References

- `vitest.config.ts:17-21` - unit include `src/**/*.test.ts`, forks pool pinned for the runner-zone switch
- `vitest.db.config.ts:13-17` - db suite include and timeouts
- `playwright.config.ts:9-13` - CI retries 1, `failOnFlakyTests`
- `.github/workflows/ci.yml:19-23` - ci job steps; `:45-50` test:db and db types drift check; `:67-80` smoke and e2e
- `.claude/hooks/end-of-turn.sh:88-131` - what the hook lints and tests per changed checkout
- `src/lib/no-console-guard.test.ts:43-53, :174-176, :181, :197, :217` - allowlist, file floor, the three guard tests
- `src/lib/agent-hooks.test.ts:209, :218, :249, :296, :326, :451, :458` - the minimum hook proof
- `src/lib/engine/fixtures/README.md` - capture protocol; `fixtures/{skyfield,stellarium}/*.json`, `usno.ts`, `beginner-reference.ts`, `expect-reference.ts`, `finder-reference.ts`
- `src/lib/tonight/build.test.ts` blocks A-N (line ranges in §2.2)
- `src/lib/offline/copies.test.ts` rule groups (line ranges in §2.4)
- `scripts/smoke.mjs:218-589, :591-640, :278-282` - steps, runner, the step template
- `tests/e2e/helpers.ts:122, :200, :210, :220` - onboarding helper, plan grant, `planEditable`, the no-darkness window
- `src/lib/account-plan/index.ts:20-24, :66` - "unknown is free" fail-closed rule
- `context/foundation/prd.md:67-70, :511-517, :524-531, :723-727` - the PRD's test requirements
- `context/foundation/test-plan.md:13-33, :47-70, :112-125, :192-196` - strategy, risks, gates, what is deliberately not tested

## Architecture Insights

- The suite has three distinct populations that the owner's sentence treats as one: (a) **reference suites** (engine vs ephemeris, calibration, USNO) that are the project's only oracle for the PRD's own success criteria; (b) **static guards** that run inside Vitest because it is the runner CI has (no-console, runner-zone, silent-catch, colours, provenance, hooks), several of which are cheaper as an ESLint rule, a build-script assertion or a CI drift check; (c) **conventional unit tests** of pure functions, schemas and formatters, most of which duplicate an e2e spec, a smoke step, a db case or another unit file. The owner's "no unit tests" applies cleanly to (c); (a) and (b) are where the trade-offs are.
- `it.each` inflation explains most of the headline number: six files account for about 600 of the 2,605 tests and fold to about 60 with identical protection.
- The e2e layer is deliberately narrow (test-plan §7) and structurally cannot replace (a) or (b): one site, the real clock, a fixed all-clear forecast, 1-3 skips on most nights.
- `scripts/smoke.mjs` is already the HTTP integration layer the owner is asking for: 45 sequential steps with exact `Location` pins and island replays; adding a refusal step costs one tuple.
- The project's own hook makes suite time a per-turn tax: every agent Stop re-runs `npm test`, so the two 11-16 s guard files cost more in developer-loop time than in CI.

## Historical Context (from prior changes)

- `context/archive/2026-10-07-testing-forecast-honesty/` to `2026-10-09-testing-quality-gates-wiring/` - the five test-rollout phases that created the reference suites, the invariant properties, the guards and the hook (test-plan §3, §6.6). Each phase recorded "break checks" that turned the suites red; the plan must not weaken those pins without saying so.
- `context/archive/2026-09-28-parallel-e2e-flakes/` - #45, the hydration flake and `waitForHydration`.
- `context/changes/error-visibility/plan.md` - S-07's reliance on unit tests and the silent-catch ratchet (in flight).
- Owner preferences on record: "be modest with tests, we've got loads of them already" (2026-10-04, site-use-my-location); test-plan §7 "user preference for modest tests".

## Related Research

- `context/archive/2026-10-09-testing-access-and-entitlement-boundary/research.md` - the Risk #6 sweep that led to the repo-wide `no-console` error and the guard test.
- `context/archive/2026-10-08-testing-ranking-invariants-and-calibration-oracle/research.md` - why expected orders copied from engine output were replaced by relations and a source-cited reference.
- `context/changes/auth-loose-ends/research.md` (on `feat/auth-loose-ends`) - S-06, no tests yet.

## Open Questions

1. The before/after runtimes in §5 are estimates from per-file timings; each phase of the plan re-measures `npm test`, the hook and CI.
2. Whether CI can fetch `raw.githubusercontent.com` reliably for a catalogue drift check (otherwise the provenance tests stay).
3. Whether 0.01° coordinate rounding (gear, onboarding, locate, map, geocode) counts as a privacy guarantee that needs one smoke or db pin before the schema tests go.
4. Playwright's worker count in CI is the framework default; a `workers` setting could cut the e2e time more than any trim, but that is outside this change.
5. The 4 Vitest "skipped" tests were not located individually (the JSON reporter counts them; they are `it.skipIf` cases such as the calibration snapshot).

## QUESTION FOR OWNER

Pytania do właściciela (po polsku, do decyzji przed planem; rekomendacja w nawiasie):

1. **Strażnicy statyczni i testy referencyjne.** Czy "żadnych testów jednostkowych" obejmuje też (a) strażników statycznych (no-console, wrangler, red-theme, contrast, runner-zone, silent-catch, provenance katalogów, dowód hooka) i (b) suity referencyjne silnika (Skyfield/Stellarium/USNO, kalibracja vs lista dla początkujących, niezmienniki PRD)? Dla (a) i (b) nie ma dziś żadnej innej ochrony, a PRD sam wymaga (b) (Success Criteria 2, NFR 1°/5 min, NFR determinizm). (Rekomendacja: zostawić obie grupy, ok. 220 testów w ~25 plikach, w dwóch projektach Vitest: `unit` szybki, uruchamiany przez hook i CI, oraz `guards` tylko w CI.)
2. **Hook end-of-turn.** Po diecie suite `unit` trwa ok. 4-10 s, ESLint na zmienionych plikach 8-18 s. Czy hook ma dalej uruchamiać cały suite `unit`, czy tylko ESLint plus `vitest related` dla zmienionych plików? (Rekomendacja: cały `unit`, bez `guards`; to i tak skraca Stop o ok. połowę.)
3. **S-07 error-visibility-2.** Gałąź dodaje ~210 testów jednostkowych (handlery tras na fake'u Supabase, store'y, observability) i jej kryteria sukcesu to testy jednostkowe. Czy po jej merge'u stosować do nich tę samą rubrykę (ciąć choreografię mocków, zostawić "stała linia logu nigdy nie niesie message" i "błąd serwera → errors.serverFault"), czy zamrozić je do zamknięcia S-07? (Rekomendacja: ta sama rubryka, w osobnej, ostatniej fazie po merge'u.)
4. **Konwersje do smoke.** 10 nowych kroków smoke zamiast testów schematów i przekierowań: POST `/api/log` z koordynatą w `target`, zepsuty JSON okularów w onboardingu, plan `site=52.23,21.01`, sky-check `from=https://evil.example`, wylogowane `/log` i `/api/log`, `nightOver`, landing ×2, 404 wpisu logu, 301 `/tonight/all`. Smoke jest sekwencyjny, na jednym użytkowniku. Zgoda? (Rekomendacja: tak.)
5. **Cięcia w e2e.** Proponowane ~18 testów do usunięcia lub scalenia (duplikaty smoke: what-to-expect t1/t2/t4, finder-chart t1/t4, sign-in-continue; detale prezentacji: tonight-sky t4-t7, toasts t3/t6, observing-progress t2/t3, red-night t2/t3, tonight-targets t2/t3; scalenia "mark observed" ×4 i subnav/navigation). Zgoda, czy e2e zostawić bez zmian w tej zmianie? (Rekomendacja: zgoda, jako osobna faza na końcu.)
6. **Suite bazodanowy.** `tests/db/account-plan-command.test.ts` (21 testów narzędzia operatorskiego) przyciąć do ~6, a tabele gramatyki kluczy w `observations` i `session-plans` do kilku wierszy? Reszta `tests/db` zostaje w całości. (Rekomendacja: tak.)
7. **Provenance katalogów.** Zamienić testy kształtu danych na krok CI "regeneruj i `git diff --exit-code`" (jak dla `database.types.ts`; CI musi sięgać do raw.githubusercontent.com), zostawiając ~8 testów licencyjnych (pin OpenNGC/HYG, "Credit: ESA", budżet gzip, nota NASA/IAU, `HIPPARCOS_FIELDS_USED` z S-08)? (Rekomendacja: tak, po merge'u S-08.)
8. **Kolejność.** Fazy niezależne od gałęzi w toku (silnik, komponenty, style, moduły liściowe, offline) mogą iść od razu; fazy dotykające plików S-07/S-08 (observability, forecast/service, tonight/build i load, finder/load, provenance gwiazd, virtual-modules) czekają na merge. Każda faza usuwa świadomie i wymienia w notatce każdy pin naprawionego błędu, który zachowuje lub usuwa. Zgoda na taki podział? (Rekomendacja: tak; 6-7 małych PR-ów zamiast jednego.)
