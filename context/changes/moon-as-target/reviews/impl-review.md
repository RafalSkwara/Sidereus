<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: The Moon as a Target

- **Plan**: context/changes/moon-as-target/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-02
- **Verdict**: APPROVED
- **Findings**: 0 critical · 2 warnings · 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

**Success criteria, re-run on HEAD fcb5424:**
- `npm test`: 483 passed, 6 todo.
- `npm run test:db`: 78 passed, against local Supabase.
- `astro check`: 0 errors.
- Lint: 0 errors. The 2 warnings were already there before this change.
- PR #77 CI: `ci` and `smoke` passed.
- The manual rows 2.6 and 3.5–3.7 are backed by Playwright runs and screenshots on a local preview with local Supabase. Evidence is in the session; the screenshots are in the scratchpad.

**Plan drift:**
- Every planned change matches the plan.
- The eight adaptations reported during implementation are benign, and none of the "not doing" items was built.
- The fixtures README had cosmetic Prettier reflow in untouched lines.

## Findings

### F1 — The "low" wording can read "only 30°", which contradicts the 30° threshold

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (copy correctness)
- **Location**: src/lib/tonight/format.ts (`moonReasonLine`, ~503)
- **Detail**: `moonPlacementOf` compares the raw altitude (29.6 < 30 is low), but the text rounds it. The card then reads "Highest only 30° … this low, the view may shimmer". Planets never print an altitude, so this edge case is new.
- **Fix**: Floor the altitude for the low wording, so it reads "only 29°". Add a 29.6° unit case.
- **Decision**: FIXED — low wording floors the altitude; 29.6° and 30.6° cases in format.test.ts

### F2 — "The Moon and planets below" names targets the section may not show

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (copy correctness)
- **Location**: src/lib/tonight/build.ts:~528; en.ts/pl.ts `tonight.card.brightMoonPointer`, `tonight.planets.weather.line`
- **Detail**:
  - The pointer is shown when the section has the Moon *or* any planet, but it always names both.
  - A bright Moon that stays below a high site minimum gives a planets-only section that still says "the Moon and planets below".
  - The same applies to "For the Moon and planets: …" in the weather line.
- **Fix**: Pick the pointer wording from what is shown (Moon only / planets only / both) in `build.ts`, with three EN/PL keys. Apply the same rule to the weather line.
- **Decision**: FIXED — pointer and weather line keyed by what is shown (moon / planets / both), EN+PL; build and format tests updated

### F3 — The 3% floor test checks illumination at the wrong instant

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria (test strength)
- **Location**: src/lib/engine/moon-target.test.ts:122-133
- **Detail**: The precondition reads the illumination at `window.start`, while the code tests the peak. The test passes because the night is new moon, but the precondition is weaker than it reads.
- **Fix**: Assert the precondition at every sample of the window, or at the instant the code would pick as the peak.
- **Decision**: FIXED — precondition asserts < 3% at every sample of the window

### F4 — "% lit" differs slightly between the verdict line and the Moon card

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (consistency)
- **Location**: src/lib/tonight/build.ts (bright-Moon line vs `phaseText`)
- **Detail**: The verdict line uses illumination at the dark-window midpoint, the strip's value. The card uses illumination at the Moon's peak. On 2026-10-02 they read 56% and 54% on the same screen.
- **Fix**: Accept it. Both values are correct for their instant, and the line agrees with the strip by design. Alternatively, drop the number from the verdict line.
- **Decision**: ACCEPTED — both values are correct for their instant; the verdict line matches the strip by design

### F5 — A planet-ranking failure also drops the Moon

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture (failure isolation)
- **Location**: src/lib/tonight/build.ts:~455-487
- **Detail**: The Moon has its own inner try/catch, but `rankPlanets` runs first inside the outer block, so if it throws, the Moon is lost too. The plan accepted this.
- **Fix**: Compute the Moon before `rankPlanets`, or give the planet ranking its own inner try/catch, so each target type fails alone.
- **Decision**: FIXED — the planet ranking has its own try/catch; a planet failure keeps the Moon (new build test); both failing still drops the section

### F6 — Extra Moon ephemeris work per request

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (performance)
- **Location**: src/lib/engine/moon-target.ts:~95-110
- **Detail**: `moonTrack` runs the full `moonState` (Equator + Horizon + Illumination) at about 85 ten-minute samples, then `moonState` runs again at the peak. On Workers Paid this costs a few ms and is acceptable.
- **Fix**: Accept it. Optionally, reuse the peak sample's `illuminatedFraction` instead of calling `moonState` again.
- **Decision**: ACCEPTED — a few ms on Workers Paid
