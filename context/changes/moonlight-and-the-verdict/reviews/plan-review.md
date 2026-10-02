<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Moonlight and the Verdict (revision 2)

- **Plan**: `context/changes/moonlight-and-the-verdict/plan.md`
- **Mode**: Deep (claims verified inline, calibration harness re-run)
- **Date**: 2026-10-02
- **Verdict**: REVISE → SOUND after triage (all 5 fixed)
- **Findings**: 1 critical · 3 warnings · 1 observation

The revision-1 review is in `plan-review-rev1.md`. This revision fixes its reversal: the harness reproduces every row of the plan's calibration table exactly. New-Moon nights are unchanged, and the full-Moon top 5 is clusters only.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

- 21/21 paths ✓.
- Symbols ✓: `RotationAxis` and `Libration` are in astronomy-engine 2.1.19; the verdict reasons and the Skyfield Moon fixture exist.
- brief↔plan ✓, Progress↔Phase ✓.
- Disc conventions checked on the real engine:
  - 2026-10-12T18:00Z (waxing): θ = 281°, lit on the right.
  - 2026-11-02T04:00Z (waning): θ = 91.6°, lit on the left.

## Findings

### F1 — Phase 2 Crisium test instant is wrong

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §3 Tests
- **Detail**:
  - At 2026-10-12T18:00Z the Moon is 4.7% lit.
  - With correct geometry, Crisium's centre (17°N, 59.1°E, libration l 4.07°, b 6.49°) is outside the lit crescent: u = 0.813 against the terminator at 0.903.
  - The test "Crisium's centre lies inside the lit path" would fail on correct code and steer the implementer to break the maths.
- **Fix**: Use 2026-10-15T17:00Z instead. It is 23.5% lit, still a crescent, and Crisium is inside with a 0.30 margin.
- **Decision**: FIXED — test instant moved to 2026-10-15T17:00Z (delegated; non-UI)

### F2 — Washed-out count is mostly objects that would never be listed anyway

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Implementation Approach (washed-out rule); Phase 1 §3–§5
- **Detail**: The harness re-run annotated each washed-out object with its score.
  - On 10-26 (full Moon, Bortle 6), 9 of the 10 washed-out objects are already below `MIN_OBJECT_SCORE`.
  - M84, M88, M89, M91 and M98 fail the bar even with the Moon component at 1 (150 mm, Bortle 6).
  - So "10 faint objects washed out by the Moon" blames the Moon for objects Tonight would never list. The rule only removes M33 from the cleared list.
  - The plan never decides what the count counts. The test `washedOutCount ≥ 5` only passes under the inflated reading.
- **Fix A ⭐ Recommended**: An object is washed out only when the rule holds **and** its score with the Moon component set to 1 clears `MIN_OBJECT_SCORE`. The count then means "would be on the list if not for the Moon".
  - Strength: An honest count, matching the user's "feels like being lied to".
  - Tradeoff: The full-Moon Bortle 6 count drops to 4 (M33, M43, M74, M101). The test bound becomes ≥ 3, and the harness gains this condition.
  - Confidence: HIGH — the per-object values were verified on the harness.
  - Blind spot: None significant.
- **Fix B**: Keep the set and reword the line to "N faint objects too washed out to see".
  - Strength: No model change.
  - Tradeoff: The count still includes objects hidden for reasons other than the Moon.
  - Confidence: MED.
  - Blind spot: The `/tonight/all` group would list objects that the dark-night ranking also omits.
- **Decision**: FIXED via Fix A (user) — 'Moon's fault' condition added to rule, harness and calibration table; test bound ≥ 3

### F3 — Moon card faint-objects line has no selection rule

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Desired End State (Moon card); Phase 4 matrix
- **Detail**:
  - The three variants are "Bright Moon: K washed out", "fine after it sets at HH:MM" and "Dark night: no Moon". Nothing says which one applies.
  - Phase 4 deletes `BRIGHT_MOON_*` and `isBrightMoon`, the only existing thresholds.
  - Three cases are unhandled:
    - Moon up with K = 0. On 10-20 (69%), K is 0 once M16 is exempt; none of the variants is true, and "Dark night" would be false.
    - Moon rising mid-window.
    - Whether "bright" with K = 0 counts at all.
- **Fix**: Add a decision table driven by K and the Moon's up interval, with no new illumination threshold:
  1. K > 0 → the washed-out line.
  2. K = 0 and the Moon is up for part of the window → "Moon up HH–HH; faint objects unaffected".
  3. K = 0 and the Moon is up all night → "Moonlit sky; no faint objects lost".
  4. The Moon is never up → "Dark night: no Moon".

  The copy is the user's call.
- **Decision**: FIXED (user) — four-case faint-objects table in Desired End State and Phase 4 matrix, fixed-date build tests per case

### F4 — Bright-Moon manual screenshots can't be taken in the near term

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 Manual 1.4; Phase 4 4.4; Phase 5 5.3
- **Detail**:
  - The preview uses the real clock (`TonightContent.astro:51`, `now: new Date()`).
  - On 2026-10-02 the Moon is 58% lit and waning to new around 10-10. At 69%, the washed-out set is empty once M16 is exempt.
  - The washed-out line, the `/tonight/all` group and the bright-Moon card cannot render locally until about 10-22.
- **Fix A ⭐ Recommended**: Back the bright-Moon visuals with build-view tests at fixed dates (2026-10-26). Take screenshots of what the real clock shows, and add one post-merge bright-Moon screenshot check after 10-22.
  - Strength: No production code just for testing.
  - Tradeoff: The visual check of the bright-Moon state is delayed.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Fix B**: Add a preview-only `now` override, read in `TonightContent` from an env var that production never sets.
  - Strength: Screenshots of any phase right away.
  - Tradeoff: A test seam in production code, which needs a guard.
  - Confidence: MED.
  - Blind spot: Whether the forecast fixture's hours must shift with the faked clock.
- **Decision**: FIXED via Fix A (delegated; non-UI) — fixed-date build tests carry bright-Moon evidence; post-merge screenshot after 2026-10-22

### F5 — Small type-contract inaccuracies

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis; Phase 1 §3
- **Detail**:
  - `RankableObject` already has `id`, `raHours`, `decDeg` and `majorAxisArcmin` (`ranking.ts:31-34`). Only `minorAxisArcmin` is new.
  - The plan doesn't say where the Moon's unit vector lives. `MoonState` is shared with `outlook.ts:176` and `moon-target.ts:91,104`.
- **Fix**: Correct the field list. Compute the vector as an array parallel to `moonTrack` inside `rankObjects`, and leave `MoonState` unchanged.
- **Decision**: FIXED (delegated) — RankableObject field list corrected; Moon vector as a parallel array in rankObjects, MoonState unchanged
