<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Evening Showpieces, Window Edges and the PRD Re-check (M-4 S-05)

- **Plan**: context/changes/evening-showpieces/plan.md
- **Scope**: Full plan (every automated row done; the manual rows 1.6, 2.5, 3.3, 4.5 and 4.6 belong to the owner and are still open)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-16
- **Verdict**: APPROVED (fix the 2 minor warnings before the PR)
- **Findings**: 0 critical, 2 warnings, 3 observations
- **Range reviewed**: `git merge-base HEAD origin/main` (b6eb4f3)..`origin/feat/evening-showpieces` (7d4e624, equal to the local HEAD), 8 commits
- **Note**: under the orchestrator's rules this reviewer writes only this file. `change.md` is not stamped `impl_reviewed`; the lead does that.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (1 observation) |
| Scope Discipline | WARNING (1 observation) |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING (1 warning, 1 observation) |
| Success Criteria | WARNING (1 warning) |

## What was verified

### Edited test pins: each follows from a changed requirement or the oracle

None was bent to make a test pass.

- **`build.test.ts` window pins** (M13 `19:25–23:42`, M3 `Window/Okno 19:25–19:51`). A separate subagent re-ran Skyfield 1.55 with DE421 in a throwaway venv using the generator's own functions. It got Warsaw 2026-10-10 dark start 19:25:43, M13 end 23:42:10.7 and M3 end 19:51:44.1 local, confirmed by bisection. Truncated to the minute, these are the pinned values. The closest margin is M13 at 10.7 s past the minute, which is about 0.02° of altitude.
- **Skyfield fixture.** Running `scripts/deep-sky-reference.py` again produces a file byte-identical to `src/lib/engine/fixtures/skyfield/deep-sky-warsaw-2026.json` (`cmp`; 513 object-nights, every difference 0). The script reads only `messier.json`, `caldwell.json` and the BSP. It does not read engine code or engine output.
- **`score.test.ts` duration pins.** I re-derived each one by hand from `min(1, span/120) × mean placement`, written with the named constant: 30/120 × 2.44/4, 30/120 × 0.5, and 13 samples = 120 min → 1.
  - The washed-out "brief" case keeps its old premise exactly: duration 0.1 = 20/120 × 0.6, and the test asserts it.
  - Its `washedOut` and below-the-bar expectations are unchanged.
- **`ranking.test.ts` faint 10/10.3 → 11.2/11.5 and M40 10.3 → 11.5.** The bonus test asserts its own premise: the object clears the bar, the 0.3 mag shortfall drops it below, and the bonus would lift it back. The sibling test asserts that M40 at 11.5 is `reachable` and not `cleared`, so the pair cannot pass vacuously by falling past the limiting magnitude.
- **`build.test.ts` M1 → M65** (a below-the-bar row linking to the finder on the full-Moon night). Only the premise object changed; the routing assertion is the same. M65 was picked by an engine scan, which is acceptable for a premise, and the test fails loudly if M65 ever clears the bar.
- **`build.test.ts` `toContain(" · ")` → non-empty and at most two phrases.** This follows from the requirement: a line can now carry one phrase.
- **The four `reasonComponents` cases** at `ranking.test.ts:283-325`. I re-derived all of them by hand under D-5. All are correct, including the second entry of the "weights the deviation" case, which the plan expected to stay but which moves for the reason documented.
- **`visibility-invariants.test.ts`.** The one-sample test is now two. Planets and the Moon keep `start === end`. A deep-sky one-sample run must now have positive length and contain its sample. The new version is stricter than the old one.

### Calibration and beginner-reference integrity

`git diff` over the range is empty for:
- `calibration.test.ts`
- `fixtures/beginner-reference.ts`
- `small-scope.test.ts`
- `ranking-invariants.test.ts`
- `plan-window.test.ts`
- `determinism.test.ts`
- `purity.test.ts`
- `context/archive/`

In `ranking.test.ts` the hunks sit at `:110`, `:191` and `:280`, and the AF check is not touched.

The guard in `evening-showpieces.test.ts` takes its ids from `BEGINNER_REFERENCE` and asserts at least two sources for each. Its cut is the median of the list.

### D-5 rule (at or above the mean)

`ranking.ts:216-225`:
- `moon` and `sky` are eligible only when their spread across the listed entries is at least `REASON_MIN_SPREAD`.
- A component is named for an entry only when the entry is at or above the list mean on it, with a 1e-9 slack.
- The lead and second follow the plan's key.

G5 is green and unedited. It is also safe by arithmetic in the fallback: a faint galaxy capped at brightness 0.1 could only win the weighted-value fallback with duration < 0.0714, but clearing the bar needs duration ≥ 0.0714. One gap remains in the documentation (F3).

### Plan-window parity

`deepSkyWindow` (`plan-window.ts:62`) refines exactly as `scoreObject` does, and `plan-window.test.ts` passes unedited.

Every deep-sky window the app shows comes from one of those two paths: the Targets entries, the washed-out entries, Session plan rows, candidates, the tile and the reason line. `bestWindow` is still used directly only for planets (`planet-ranking.ts:113`), the Moon (`moon-target.ts:90`) and `solarSystemWindow` (`plan-window.ts:92`), as D-2 requires.

### F6 (nothing from in-the-sky.org in the repository)

I scanned every patch of the 8 pushed commits for in-the-sky.org, Dominic Ford, `town=` and the capture file name.
- No captured value and no planner sentence is committed.
- The capture commit named in the plan review (3acac87) is reachable from no remote ref: `git branch -r --contains` is empty.
- No ref holds `evidence/planner-in-the-sky-org.json`.
- What remains is the URL pattern, the credit, the method, the rules and summary counts, as F6 allows. Two quoted fragments are left (F5).

### Modest tests

- New `evening-showpieces.test.ts`: 83 lines, 8 cases.
- New `window-reference.test.ts`: 293 lines, mostly fixture parsing, with tolerances imported from `parameters.ts`.
- Layout and wording are not pinned beyond what the requirement changed.

### Gates I ran

| Check | Result |
|---|---|
| `npm test` | 133 files, 2594 passed, 4 skipped, 6 todo |
| `npx astro check` | 0 errors, 0 warnings, 0 hints |
| `npm run lint` | clean |
| `npx prettier --check` on the Phase 4 docs | CLAUDE.md, prd.md and the fixtures README pass. `roadmap.md` and `handoff.md` fail, as both already did at the base (see F2). |
| Merge with current `origin/main` (d88045e, #186) | conflict in `context/foundation/roadmap.md` (F2) |

E2E, smoke and `test:db` were not re-run: no server was needed, the author reports e2e 85 passed / 3 skipped, smoke green and test:db 235, no DB or route code changed, and no e2e spec asserts reason text.

## Findings

### F1 — Criterion-2 P3: the M39 (July) exemption was added after the comparison

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/evening-showpieces/evidence/prd-criterion-2.md (Leg 2, the M39 bullet)
- **Detail**: The plan fixed the rules before the comparison and named one exemption only: "A page that states no highest altitude is reported as 'not stated' ... and neither passes nor fails P2 or P3". Its contract adds: "A failing rule is reported as an engine finding, never fixed by editing the rule or the evidence; Phase 4 stops and reports."
  - For M39 on 2026-07-15 the page states a highest altitude. Its time falls after the engine's window ends, which breaks P3's clause "its time lies inside the engine's window".
  - The record classes this as "P3 does not apply ... not counted as a pass or a failure". That is a third category, created after the data was seen.
  - The stated cause is plausible and is not an engine error: the planner's undocumented twilight limit ends later than the engine's −15° Bortle-5 dark window.
  - The repo cannot show whether the altitude half of P3 (within 3°) held for M39.
  - P3's wording is ambiguous: the time clause can be read as a condition for applying the rule. So this is a disclosure problem, not a hidden failure. The rule was still resolved in the engine's favour after the comparison, which the plan's pre-registration was meant to prevent.
- **Fix**: Restate the M39 (July) line as "P3 time clause not met (planner's highest point at its own dawn limit, after the engine's −15° window ends; a twilight-definition difference, not an ephemeris error)". Count it separately from passes, say whether the altitude half held, and put the reading to the owner under manual row 4.5.
  - Strength: keeps the pre-registered rules honest without changing the engine, and the evidence already holds every fact this needs.
  - Tradeoff: the record reads "6 pass, 1 time-clause miss" instead of a clean pass. That is still within "survives", given the stated cause.
  - Confidence: HIGH, because the plan text is explicit about stopping on a failing rule.
  - Blind spot: whether the owner reads P3's time clause as a condition for applying the rule (then the current text is right and needs only a sentence naming that reading).
- **Decision**: PENDING

### F2 — Branch conflicts with origin/main on roadmap.md, and the S-05 row is malformed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: context/foundation/roadmap.md:62
- **Detail**: `origin/main` moved to d88045e (#186, the ESA/Hipparcos decision). It rewrote the M-4 slice table and added S-08. `git merge-tree origin/main HEAD` reports a content conflict in `roadmap.md`. This branch's S-05 row also ends in `in-progress|` with no padding.
  - Row 4.2 claims formatting passes, but `prettier --check` fails on `roadmap.md` and `handoff.md`. Both were already failing at the base, and the implementation notes mention only `handoff.md`.
- **Fix**: Rebase onto `origin/main`. Keep main's table with S-05 set to `in-progress` and padded like the other rows. Re-run `npx prettier --check context/foundation/roadmap.md`, or note that the file was already unformatted at the base.
- **Decision**: PENDING

### F3 — The D-5 fallback can name a below-mean component, which the docs say never happens

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/engine/ranking.ts:222-223; src/i18n/messages/en.ts:752-757; CLAUDE.md (Engine paragraph, "and the entry is at or above the list mean on it")
- **Detail**: When nothing is named for an entry, the lead is the largest weighted value among the eligible components. This is the plan's Critical Implementation Details rule, implemented faithfully. It then names duration or brightness for an entry below the list mean, which can be the list's weakest on it.
  - The test "gives an entry below the mean on both duration and brightness a lead from the eligible ones" (`ranking.test.ts:371-376`) pins exactly that: duration for the 0.2 entry among 1 and 0.8.
  - D-5 says "'Up for X' is a positive claim, so it never labels the entry that is the list's weakest there". The `en.ts` comment and CLAUDE.md say a phrase is given only at or above the mean. Both overstate what the code does.
  - The fallback is harmless to G5, as shown by the arithmetic above. The duration phrase states a length, so it stays true.
  - A related nuance: duration and brightness have no minimum spread. With many durations now saturated at 1, an entry at 0.98 among entries at 1 loses "Up for X" over a difference the viewer cannot see.
- **Fix**: Add one clause to `en.ts` and to CLAUDE.md: "except when nothing is named for the entry: its lead is then its largest weighted eligible component and it has no second".
- **Decision**: PENDING

### F4 — Two build.test.ts comments still give M3's old grid edge

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/tonight/build.test.ts:1857, src/lib/tonight/build.test.ts:2053
- **Detail**: "M3 is up 19:25-19:45 only" and "M3's window ended at 19:45" contradict the new pins at `:2018-2019` and `:2049` (19:51, Skyfield 19:51:44). The assertions are unaffected.
- **Fix**: Change both comments to 19:51.
- **Decision**: PENDING

### F5 — Two quoted fragments from the planner remain, against F6's "no verbatim text"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/evening-showpieces/research.md:115 and research.md:179
- **Detail**: Two quoted fragments from in-the-sky.org are committed: the page label `"(CEST)"` and the phrase `"not readily observable"`. Both are de minimis and carry no values, but F6 says "no verbatim text".
  - Separately, the evidence says "58 requests" while research and the plan say 56 pages. That is probably retries, but the record does not say so.
- **Fix**: Paraphrase both fragments, for example "labelled as summer time" and "reported as not observable". Give the request count as "56 pages (58 requests incl. retries)", or whatever the true reason is.
- **Decision**: PENDING
