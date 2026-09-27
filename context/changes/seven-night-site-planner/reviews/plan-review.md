<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Seven-Night Planner and Site Switching

- **Plan**: context/changes/seven-night-site-planner/plan.md
- **Mode**: Deep
- **Date**: 2026-09-27
- **Verdict**: REVISE → SOUND after triage (all 8 findings fixed in plan)
- **Findings**: 1 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | FAIL |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
19/19 paths ✓, 6/6 symbols ✓, brief↔plan ✓, Progress↔Phase ✓ (4/7/9 rows)

## Findings

### F1 — SearchRiseSet can't meet the plan's own 5-minute oracle test

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §2 (moonFreeMinutes) and §7 (tests)
- **Detail**: The plan defines moon-free as moonState's apparent centre altitude below 0° ("normal" refraction) but computes it with SearchRiseSet, which times the upper limb against a fixed 34′ refraction. The ~0.25° mismatch is one-directional (rise early, set late). Measured over 400 days with astronomy-engine 2.1.19: Warsaw up to 2.9 min per event (~5-6 min for a window with both a set and a rise), Tromsø up to 26 min. The Phase 1 oracle test would be flaky at 52°N and fail at high latitude.
- **Fix**: Use `SearchAltitude(Body.Moon, observer, ±1, start, limitDays, InverseRefraction("normal", 0))`, which targets the centre and matches moonState to <1e-4° at the roots; initial state from moonState at the window start; a null result means no crossing before the window ends.
- **Decision**: FIXED — Fix in plan

### F2 — Strip after the ranking sits far below the fold on phones

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 §4 (page wiring); delegated decision
- **Detail**: On a go night five object cards precede the strip, so US-03's comparison means scrolling past the ranking after every site switch. Placing the strip above the ranking pushes tonight's targets (the north star) down by ~400 px instead.
- **Fix A ⭐ Recommended**: Keep the strip after the ranking and add a "Next 7 nights ↓" anchor link in the verdict card
  - Strength: Tonight's answer stays first; the planner is one tap away; tiny change.
  - Tradeoff: The strip still isn't visible without the tap.
  - Confidence: HIGH — no layout risk; e2e specs scope to the ranking section.
  - Blind spot: Whether the user mostly opens Tonight to plan the week or for tonight.
- **Fix B**: Move the strip between the verdict card and the ranking
  - Strength: Week-ahead comparison visible immediately after a switch.
  - Tradeoff: Pushes the ranking down on every visit.
  - Confidence: MED — depends on final row compactness.
  - Blind spot: Mobile row height not designed yet.
- **Decision**: FIXED — Fix A

### F3 — Mean cloud cover hides a clear spell on nights 4-7

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 (cloudOutlook), Phase 2 §2 (cloudOutlookText)
- **Detail**: Four clear hours then four overcast reads "~50%", same as uniform haze. The PRD scores the verdict on the longest clear run "so that a late clearance is not averaged away" (Open Question 2); the outlook reintroduces the averaging.
- **Fix A ⭐ Recommended**: Mean plus the clearest hour, "Cloud ~50%, down to 0%"
  - Strength: Two plain numbers, no verdict wording, clear spell visible.
  - Tradeoff: Slightly longer line; one extra field (minCloudPct).
  - Confidence: HIGH — the verdict already computes minCloudPct for its "cloudy" reason.
  - Blind spot: A single clear hour can overstate a mostly cloudy night.
- **Fix B**: Longest run below 65% (marginal threshold) as hours, "Clearer spell ~3 h"
  - Strength: Mirrors how the verdict thinks.
  - Tradeoff: Borrowing a verdict threshold edges towards an implied verdict on nights 4-7.
  - Confidence: MED — wording must avoid sounding like a go.
  - Blind spot: Low-skill 4-7 day forecasts make "hours" look precise.
- **Decision**: FIXED — Fix A

### F4 — Verdict chips on nights 2-3 hide "no weather data"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 (TonightNight verdict variant)
- **Detail**: The verdict variant carries only `level`, so a "marginal" meaning "no forecast" looks identical to a forecast marginal when comparing sites.
- **Fix**: Add `reasonText` (existing `verdictReasonText`) to verdict nights, rendered muted after the level; add a build test for a no-weather-data night 2.
- **Decision**: FIXED — Fix in plan

### F5 — Selector refactor leaves two e2e checks testing nothing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §1 and §4
- **Detail**: `tests/e2e/telescope-selector.spec.ts:82` and `:109` use `form[data-telescope-select]` with `toHaveCount(0)` / `toBeHidden()`; after the rename they pass with no matching element. The spec is not in the plan's rename list. `OnboardingWizard.tsx:288,674` has an unrelated local `chooseTelescope` that must not be swept up.
- **Fix**: Add the spec to Phase 3 §1/§4, scope form selectors per param (`form[data-gear-select="telescope"]`, GearSelector sets `data-gear-select={param}`), note OnboardingWizard is out of scope.
- **Decision**: FIXED — Fix in plan

### F6 — "No cloud outlook yet" shown on nights with no darkness

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3, Phase 2 §5 (Tromsø test)
- **Detail**: `cloudOutlook` returns null for both "no dark window" and "no data"; the Tromsø test expects "No cloud outlook yet" beside "No darkness".
- **Fix**: Omit the cloud line on nights without a dark window; update the Tromsø test.
- **Decision**: FIXED — Fix in plan

### F7 — DST test assertion is wrong about window length

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §7
- **Detail**: "Window duration consistent with the 25-hour night" does not hold: the dark window is sun-defined; only the wall-clock labels shift.
- **Fix**: Assert start formats at UTC+2 and end at UTC+1, and the wall-clock span exceeds the real duration by one hour.
- **Decision**: FIXED — Fix in plan

### F8 — Production CPU check can't run inside the phase

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 manual 3.9
- **Detail**: Deploys happen only on merge to main (needs a per-case OK), so 3.9 cannot be ticked during /10x-implement.
- **Fix**: Reword 3.9 to a local measurement (buildTonight time before/after on the preview build); add a post-merge note for the production CPU look.
- **Decision**: FIXED — Fix in plan
