<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Evening Showpieces, Window Edges and the PRD Re-check (M-4 S-05)

- **Plan**: `context/changes/evening-showpieces/plan.md` (commit 3acac87, branch feat/evening-showpieces, local only)
- **Date**: 2026-10-16
- **Reviewer**: herdr agent `reviewer` (Opus, medium effort), plus two read-only Opus subagents (claim verification; feasibility and sequencing)
- **Phases**: 4 | **Findings**: 0 critical, 7 warnings, 3 observations
- **Verdict**: **NEEDS ATTENTION**. The premise and the sequence are sound. Each finding can be fixed in the plan without re-planning.
- **change.md**: not touched. The orchestrator's rule allows only this file, so `status` stays `planned` until the orchestrator or the owner flips it to `plan_reviewed`.

## Verdicts

| Dimension        | Verdict | Findings   |
| ---------------- | ------- | ---------- |
| Claim Accuracy   | WARNING | F1, F9     |
| Substance        | PASS    |            |
| Feasibility      | WARNING | F5         |
| Sequencing       | PASS    |            |
| Architecture Fit | PASS    |            |
| Scope Discipline | PASS    |            |
| Verifiability    | WARNING | F3, F4, F7 |
| Coverage         | WARNING | F2, F6, F10 |

What holds:

- The cause of item 1 is confirmed at `score.ts:175`.
- `indexOfTime` throws at `score.ts:93`.
- Every deep-sky window a user sees comes from `ObjectScore.window`: `ranking.ts:245-256` and `build.ts:865, 883, 1270, 1314, 1359`. So refining the edges once in `scoreObject` and once in `deepSkyWindow` reaches every view.
- `altitude-curve.ts:63-74` and `session-plan.ts:93-96` already handle edges that fall between samples.
- `keysWithoutWindow` and every "has a window" decision cannot change, because refinement only moves the edges of a run that already exists.
- The Skyfield reference is independent of astronomy-engine and matches the engine's conventions: geometric Sun at `sun.ts:16-22`, normal refraction at `objects.ts:28`, and Bortle 5 at -15° in `parameters.ts:20-28`.
- No step edits the calibration oracle, `beginner-reference.ts`, the AF check or `KNOWN_DIVERGENCES`. The test edits the plan does list (the visibility pin, `build.test.ts:1850`, the reason cases) are legitimate, because the requirement changed.
- No phase depends on a later one.
- "Red first" fits with "never commit red": the subagent runs the test red inside its turn, logs the output and commits test and fix together.
- Every automated command resolves (with the nvm prefix):
  - `test`, `test:e2e`, `smoke`, `test:db` and `lint` exist in `package.json`.
  - The named suites run green today: 5 files, 99 passed.
  - `window-reference.test.ts` and `evening-showpieces.test.ts` are new files, so they do not exist yet.

## Findings

### F1 — `BestWindow` gaining indices breaks the Moon parity and `moonTarget`'s type

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Claim Accuracy
- **Location**: plan.md "Phase 1 › 4. Window refinement" and "5. Scoring and plan windows" ("`solarSystemWindow` and the planet and Moon callers are untouched")
- **Detail**: The plan adds `firstIndex`/`lastIndex` to `BestWindow`, and keeps them even without `refine`. Two things break:
  - `moonTarget` builds its window by hand as `{ start: best.start, end: best.end, peak }` (`moon-target.ts:117`). If the fields are required, `astro check` fails there.
  - `solarSystemWindow` returns `{ ...best, peak }` (`plan-window.ts:101`), so the Moon window would carry the indices. The Moon parity test `plan-window.test.ts:182` (`toEqual(target?.window ?? null)`) then fails, because `toEqual` rejects the extra keys.

  So the Moon and planet paths are touched, despite the plan's claim.
- **Fix**: Return the indices only from the refined path, as a separate type (for example `RefinedWindow extends BestWindow { firstIndex; lastIndex }`). The unrefined `bestWindow` then stays byte-identical for planets and the Moon.
- **Decision**: APPLIED to plan.md and plan-brief.md (2026-10-16)

### F2 — Existing pins that the plan does not list will turn red in Phases 1 and 2

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM (a real tradeoff; pause to reason through it)
- **Dimension**: Coverage
- **Location**: plan.md "Phase 1 › 6", "Phase 2 › 2"
- **Detail**: Phase 2 lists only new relation tests, but the new duration rule changes values that `score.test.ts` pins on short synthetic tracks of 30-90 min:
  - `:106`: "is 1 when the object is up for the whole dark window". The default track is shorter than 120 min, so it becomes less than 1.
  - `:113-119`: altitude credit over `/10` samples.
  - `:395`: expects 0.4 from `/track.length`.
  - `:228-236`: the washed-out case "brief", one sample at 200 mm. Its duration goes from 0.1 to 0, so `washedOut` may flip.

  Phase 1 also misses one pin: `build.test.ts:1948` and `:1978` pin M3's candidate window, "Window 19:25–19:45" / "Okno 19:25–19:45". That is a deep-sky edge in both languages, and its end can move.

  Neither phase can finish its "whole unit suite" line until these are handled. The "fail on the old formula" check would also be noisy.
- **Fix**: List these pins under Changes Required:
  - Re-derive each expected value by hand from the new rule (the requirement changed), and log old and new in `implementation-notes.md`, as Phase 3 already does for the reason cases.
  - For the "brief" case, keep its purpose ("the Moon is not what keeps it off the list") and re-derive the premise rather than the number.
  - Strength: matches the plan's own rule for legitimate edits.
  - Tradeoff: about 6 more edited assertions.
  - Confidence: HIGH. Lines were read in the worktree.
  - Blind spot: other score tests whose tracks are under 120 min were not exhaustively listed. Run the suite once on a scratch change to enumerate them.
- **Decision**: APPLIED to plan.md and plan-brief.md (2026-10-16)

### F3 — The "top 45 %" guard is fitted to engine output

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM (a real tradeoff; pause to reason through it)
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 2 › 2. Relation tests" (`evening-showpieces.test.ts`)
- **Detail**: The 45 % bar sits between the engine's before and after ranks: M13 is 53/115 = 46 % before, and M57 is 46/118 = 39 % after. The plan itself justifies the bar by "seven ranks of margin" from the probe. That is a threshold chosen from engine output, which test-plan 6.3 and the lessons forbid ("relations and source-cited references, never values copied from engine output"). The phrase "is a relation to the list's size" does not change where the number came from.
- **Fix**: Make the guard source-cited.
  - The October `BEGINNER_REFERENCE` (`beginner-reference.ts:150-157`) lists M13 (TA, TW, TS), M57, M27, M15 and M2 as October evening picks.
  - Assert that each of these sits in the top half of the cleared list. The median is a natural cut, not an engine number, and it is red today: M57 is 60/115.
  - Keep "M13 in the top 5" for April and July; the reference lists it on both nights.
  - Make the red-to-green proof the synthetic `score.test.ts` relation ("4 h of a 6 h night equals 4 h of a 12 h night"), written first. It fails on the old formula by construction, so "checked once by reverting locally" is not needed.
  - Strength: every assertion traces to a cited list.
  - Tradeoff: the October guard is looser than 45 %.
  - Confidence: HIGH.
  - Blind spot: check M27 and M2 against the median after the change; the probe gives #30 and #35 of 118, both inside it.
- **Decision**: APPLIED to plan.md and plan-brief.md (2026-10-16)

### F4 — "Calibration totals unchanged" has no test behind it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 1 › 5 › Contract" ("a test compares totals over the four calibration nights before and after") and Automated line 1.3
- **Detail**: No such test exists, and `calibration.test.ts` pins no totals. A test also cannot compare before with after unless it stores engine values, which the oracle rule forbids. Line 1.3's command proves only that the oracle stays green.
- **Fix**: State the invariant structurally. In `window-reference.test.ts`, or in `objects.test.ts` on real tracks, assert that for every reachable object on the four nights, the refined call's `firstIndex`/`lastIndex` equal the sample indices of the unrefined window. Scores are then unchanged by construction, with no stored values.
- **Decision**: APPLIED to plan.md and plan-brief.md (2026-10-16)

### F5 — The reason eligibility rule can force a reason that distinguishes nothing (brightness or duration)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM (a real tradeoff; pause to reason through it)
- **Dimension**: Feasibility
- **Location**: plan.md "Critical Implementation Details › Moon and sky eligibility", "Phase 3 › 1"
- **Detail**: Take a moonless night where every listed entry has the same sky value (for example a top 5 with no low-surface-brightness object, or Bortle ≤ 2, where `bortlePenaltyForBortle` is 0). Only duration and brightness stay eligible, so every entry's pair is {duration, brightness}, whatever its values. That is item 5's fault moved to another component: "Bright for your N mm" on an entry whose brightness is the list's lowest.

  It can also trip G5 (`small-scope.test.ts:126-146`). G5 runs every galaxy on the unlimited list over Bortle 3/5/6/8 and the Bieszczady night, and a faint or limit galaxy forced to a brightness reason fails it. Bortle 3's sky spread of 0.067 sits just above 0.05, so it is safe there, but with little margin.

  There is also an implementation detail the plan does not name: `topTwo` (`ranking.ts:152-170`) assumes all four components, so it must change too.
- **Fix**: In the Phase 3 Contract, specify what happens when fewer than two eligible components have a positive deviation. ⭐ Recommended: name only components with a positive weighted deviation, and fall back to the weighted value only among eligible components whose value is at least the list mean. If `reasonLine` cannot print a single reason without new wording, the second reason is the eligible component with the higher weighted value, never one below the list mean.
  - Add `topTwo` to the files touched.
  - Strength: closes the fault class, not one instance.
  - Tradeoff: a little more logic in `reasonComponents`.
  - Confidence: MED. Brightness reaching a faint galaxy is reasoned from code, not run.
  - Blind spot: whether `reasonLine` (`format.ts:299-332`) handles a single component.
- **Decision**: APPLIED to plan.md and plan-brief.md (2026-10-16)

### F6 — The planner evidence holds verbatim third-party text in a public repo of a paid product

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH (architectural stakes; wide blast radius or unclear best path)
- **Dimension**: Coverage (data and licence)
- **Location**: `evidence/planner-in-the-sky-org.json` (commit 3acac87, not yet pushed), plan.md OD-2
- **Detail**:
  - `gh repo view` reports `RafalSkwara/Sidereus` as **PUBLIC**.
  - The 78 KB file stores in-the-sky.org's verbatim "From Warsaw" sentences for 56 pages, besides the parsed numbers.
  - The terms it quotes allow redistribution with credit, but "You may not derive any profit from your reproduction … unless … written permission". Sidereus has a paid plan.
  - Credit (Dominic Ford), the terms link, the access date and the per-page `fetchedAt` are present. No personal data: the User-Agent is the repo URL, with no email.

  Once pushed, the text stays in git history. The plan's line "kept in `context/` … never shipped" reduces the risk but does not remove it, because a public repo is a reproduction.
- **Fix**: Before the first push of the branch, slim the evidence to the facts the criterion-2 rules use: times, altitudes, each page's URL, the access date and a credit line to Dominic Ford. Drop the verbatim `sentences` and rewrite the local commit 3acac87; it is unpushed, so the rewrite is cheap now.
  - Strength: numbers (rise, set, highest altitude) are facts, and 56 pages is an insubstantial extraction (not legal advice).
  - Tradeoff: P1 ("judged on the sentence's presence and wording") must then work from parsed flags (`notReadilyObservable`, `neverRises`, `tricky` and so on), which the file already carries.
  - Confidence: MED. This is a licence reading, not legal advice.
  - Blind spot: whether the owner wants to ask Dominic Ford for written permission instead.
- **Decision**: APPLIED, owner decision of 2026-10-16: nothing from in-the-sky.org enters the repo (no text, no number). The evidence file is removed and the unpushed local history rewritten before the first push; the raw capture lives outside the repo; Phase 4 records only the method, the rules and an agreement summary, with credit.

### F7 — Phase 3's new-Moon and full-Moon assertions are not concrete

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 3 › 2. Tests"
- **Detail**:
  - "On the new-Moon calibration night" names no date, and none of the four calibration nights is clearly a new-Moon night. On a night where the Moon is up for part of the window, moon values can still differ.
  - "On the full-Moon night 2026-10-26 at least one can" is not a falsifiable assertion.
- **Fix**:
  - Name the moonless night and derive it from the engine's own Moon functions in the test, or state its date with the source.
  - For 2026-10-26, assert that the listed entries' moon spread is at least `REASON_MIN_SPREAD`, so the moon component is eligible. Do not assert on a specific reason.
- **Decision**: APPLIED to plan.md and plan-brief.md (2026-10-16)

### F8 — Generate the Skyfield fixture once, for the whole catalogue

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Sequencing
- **Location**: plan.md "Phase 1 › 1", "Phase 4 › 1"
- **Detail**:
  - Phase 4 regenerates the fixture "after Phase 3". Phase 3 does not change the order, so this really means after Phase 2, and it costs a second venv and de421 run plus the "missing id" failure mode.
  - Near a 0° minimum altitude (about 8 % of the generated invariant cases) the chord error approaches the 0.05° invariant. "Conservative" holds only on the concave side.
  - Two constants share the name `ALTITUDE_TOLERANCE_DEG`: 1° in `parameters.ts` and 0.05° in the fixtures.
- **Fix**: In Phase 1, generate the fixture for all of `DEEP_SKY` × 3 nights. Phase 4 then only adds the top-5 assertion. In the same pass:
  - Pin the atmosphere in the provenance (10 °C, 1010 mbar, as in `planet-reference.py:37-39`).
  - Add a refined case at a 0° minimum to `objects.test.ts`.
  - Say which tolerance constant the new test imports.
- **Decision**: APPLIED to plan.md and plan-brief.md (2026-10-16)

### F9 — Stale or inaccurate references in the plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Claim Accuracy
- **Location**: plan.md Current State, Phase 1 › 5–6, Phase 3 › 2, Phase 4 › 2–3
- **Detail**:
  - Deep-sky parity is `plan-window.test.ts:54`. Lines 149, 182 and 202 are planet and Moon checks.
  - Of the four `reasonComponents` cases (`ranking.test.ts:278, 291, 300, 311`), three change; `:291` has differing moon and sky values and stays.
  - The visibility pin `:259-271` counts planets and the Moon too, so "single sample" should become `firstIndex === lastIndex` for deep sky, not a positive-length assertion for every entry.
  - Phase 4 › 3's roadmap correction already landed in 3d58f97 (`roadmap.md:162`).
  - Phase 4 › 2 says "the PRD wording named Telescopius". `prd.md:67-70` names no tool, only "an independent observation planner (ranking sanity)".
- **Fix**: Correct these lines in the plan. In particular, reword the deviation as "the planner does not rank", not "not Telescopius".
- **Decision**: APPLIED to plan.md and plan-brief.md (2026-10-16)

### F10 — Documentation steps missing from Phase 4

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Coverage
- **Location**: plan.md "Phase 4 › 3", "Phase 4 › Automated"
- **Detail**:
  - The roadmap S-05 status row and `context/handoff.md` are not in the docs step.
  - The prettier check covers only `CLAUDE.md` and `roadmap.md`, though `AGENTS.md`, `prd.md` and the fixtures `README.md` are edited too.
  - CLAUDE.md should state the split: scores stay on the grid, while the text uses refined edges. A one-sample window then reads "Up for 14 min" with duration 0. The shown window is true, so this is not misleading, but future readers need the note.
- **Fix**: Add these to Phase 4 › 3, and extend the prettier command to every edited Markdown file.
- **Decision**: APPLIED to plan.md and plan-brief.md (2026-10-16)

## Owner decisions: recommendations

### OD-1: saturation only (A) or a type-based rank bonus (B)

**Recommendation: A, and record the October gap as a known miss in the evidence.**

- The research ceiling settles it. With `duration = 1` for every object, M13 reaches only #10-17 and M57 #42-65. Brightness and type bound them, not duration.
- A bonus big enough to reach the October top 5 collides with the AF check (`ranking.test.ts:238-252`): AF lists none of M13, M15, M27 or M57. The October beginner reference does list them, so the two references disagree on evening globulars.
- Under the lessons, that disagreement is the owner's call about references before any new tuned number. A bonus would be a number chosen to reach a rank.
- Open B as a follow-up only after deciding which reference governs October evenings.

### OD-2: the planner leg

**Recommendation: A (in-the-sky.org), with two corrections.**

1. **It is not a deviation from the PRD.** The PRD's criterion names no tool (`prd.md:67-70`). The real deviation is that in-the-sky.org does not rank, so "ranking sanity" comes from the beginner reference, whose entries each have at least two sources. Record it that way.
2. **Slim the evidence before the first push** (F6). The repo is public and the product is paid, so keep facts, URLs, the date and the credit, and drop the verbatim text.

Telescopius (B) needs a key plus written permission for commercial use, and offers no ranking that suits an evening list (`/targets/highlights` is near midnight). It is not worth it.

QUESTION FOR OWNER: OD-1. Accept A (saturation only; October M13 about #31, M15 #19, M57 #46, outside the top 5), with the October gap recorded as a known miss?

QUESTION FOR OWNER: OD-2. Accept in-the-sky.org plus the beginner reference as the planner leg?

QUESTION FOR OWNER: F6. How should the in-the-sky.org data sit in a public repo? Slim it to facts, URLs and credit before the first push (recommended), keep the verbatim sentences, or ask the author for written permission?

## Owner decisions (2026-10-16)

- **OD-1 = A.** Duration saturation only. The October gap (M13 about #31, M15 #19, M57 #46, outside the top 5) is recorded as a known divergence in `evidence/calibration-after-s05.md` and in the criterion-2 record. No type-based bonus in this change.
- **OD-2 = A.** in-the-sky.org is the independent planner. It gives no ranking, so the ranking is checked against the beginner list. This is not a PRD deviation (the PRD names no tool); the record only notes that the planner gives no ranking.
- **F6 = the legally safest route**, stricter than the recommendation above. Nothing from in-the-sky.org enters the repository, no verbatim text and no copied numbers. The committed oracle for window edges is our own Skyfield fixture (F8). in-the-sky.org stays a manual cross-check whose record holds only URLs, the date checked, the method and an agreement summary, with credit to Dominic Ford. The local history that held the capture was rewritten before the first push.
