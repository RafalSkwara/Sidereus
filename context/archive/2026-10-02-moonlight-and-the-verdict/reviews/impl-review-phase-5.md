<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Moonlight and the Verdict, Phase 5

- **Plan**: `context/changes/moonlight-and-the-verdict/plan.md`
- **Scope**: Phase 5 of 5
- **Reviewed phases**: 5
- **Date**: 2026-10-02
- **Verdict**: APPROVED (1 warning) → triaged 2026-10-02: F1–F5 fixed
- **Findings**: 0 critical · 1 warning · 4 observations

Commit e88d985: 20 planned items MATCH, there is no DRIFT and nothing is MISSING.

- **Two harmless extras**:
  - an import-guard unit test for the island;
  - `src/lib/moon-disc/label.ts`, whose test pins the phase line to the server's `moonPhaseText`, so the text does not change on hydration.
- **The nesting check passed** (`client:load` inside `server:defer`, production preview).
- **F7 and F8, deferred from the phases 1–4 review, are both resolved**:
  - F7: the disc label is per moment, and the h2 is the static kicker.
  - F8: the clip id is `useId()`, unique per island and stable through hydration.
- **The removed `MoonDisc.astro` look is reproduced exactly**, without the dark-side maria removed in review F3.
- **Automated criteria all pass**:
  - `npm test`: 555 passed, 6 todo;
  - `npx astro check`: 0 errors;
  - `npm run lint`: 0 errors, 2 old warnings;
  - `npm run build`: OK;
  - e2e: 16 passed, including `moon-card.spec.ts`.
- **Break-check**: making "Now" a no-op turned the e2e test red.
- **Manual check 5.3**: confirmed by the user, with screenshots at three positions on a phone (dark, red, light) and on desktop.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — "Now" returns to the page-load moment, not to now

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (behaviour)
- **Location**: `src/components/tonight/MoonTimeSlider.tsx:121-123`; `src/lib/tonight/build.ts:384` (`nearestStateIndex`)
- **Detail**: "Now" restores `initialIndex`, the state nearest the server's `now`, clamped into the window.
  - Page opened at 14:00: "Now" jumps to the window's start (e.g. 21:10).
  - Tab left open for an hour: "Now" returns to a moment an hour old.
  - The plan says "'Now' restores `initialIndex`", so this matches the plan. The plan's Desired End State, though, says "a 'Now' button returns to the current moment".
- **Fix A ⭐ Recommended**: In the click handler only, pick the state nearest `Date.now()` from `states[i].time`, clamped into the window. Rendering is unchanged, so no hydration mismatch is possible. The e2e test still passes, because at test time the clicked moment equals the load moment.
  - Strength: "Now" means now, including on a tab left open.
  - Tradeoff: The island reads the clock in an event handler. That is allowed for islands; only the engine must stay pure.
  - Confidence: HIGH.
  - Blind spot: Before or after the window, "Now" still lands on an edge, which may read oddly. Fix B covers that.
- **Fix B**: Keep it as is, but change the label when the moment is clamped: "Start of the night" before the window and "End of the night" after it.
  - Strength: No clock read in the browser.
  - Tradeoff: It is still stale on a long-open tab, and it needs one more copy key per locale.
  - Confidence: MED.
  - Blind spot: How the label switch reads on a phone.
- **Decision**: FIXED via Fix A — "Now" jumps to `nearestStateIndex(states, Date.now())` (moved to `src/lib/moon-disc/state.ts`, shared with build.ts, + unit test); e2e tolerates one step at a 5-minute midpoint. Break-checked: red with a fixed clock.

### F2 — Slider props are heavier than needed

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (performance)
- **Location**: `src/lib/engine/moon-disc.ts` (state fields); `src/components/tonight/MoonCard.astro:30-35`
- **Detail**: The serialised props are about 360 B per state, roughly 22–43 KB of raw HTML for 60–120 states. Most of it is unrounded angles (about 17 digits each).
- **Fix**: Round `brightLimbAngleDeg`, `librationLatDeg` and `librationLonDeg` to 0.01° in `moonDiscState`. The geometry tests pin θ to ±0.5°, so they stay green.
- **Decision**: FIXED — angles rounded to 0.01° in `moonDiscState`; geometry and engine tests green.

### F3 — Inaccurate `useId` comment

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/tonight/MoonTimeSlider.tsx:100-102`
- **Detail**: The comment says each React root gets its own id prefix. In fact `@astrojs/react` numbers roots per render result, so this island gets `r0`, the same prefix as `TopbarControls` in the page shell. It is harmless, because only this island calls `useId` and its ids carry the `moon-lit-` prefix.
- **Fix**: Reword the comment: unique within the server-island render, and kept distinct from shell ids by the `moon-lit-` prefix.
- **Decision**: FIXED — comment reworded (unique within the island's render; `moon-lit-` keeps it apart from shell islands).

### F4 — The island trusts its array lengths

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: `src/components/tonight/MoonTimeSlider.tsx:96-101`
- **Detail**: With `states.length === 0`, `start` is −1 and `moonPhaseLine(undefined)` throws. A `timeLabels` array shorter than `states` would give "Moon at undefined". Both are prevented today by `MoonCard.astro` (no island without states) and by `build.ts` (one `map` produces both arrays).
- **Fix**: Return `null` early when `states.length === 0`, and fall back to an empty time when a label is missing.
- **Decision**: FIXED — the island returns null without a state; a missing time label falls back to "".

### F5 — PL slider label and the Firefox red-mode check

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (copy) / Success Criteria
- **Location**: `src/i18n/messages/pl.ts` (`tonight.moon.card.slider`); `MoonTimeSlider.tsx` (range styling)
- **Detail**:
  - The PL label "Godzina w nocy" is understandable, but "Pora nocy" is more natural.
  - The custom range styling was verified only in Chromium. In Firefox's red mode, `::-moz-range-progress` might pick up a user-agent fill.
- **Fix**: Change the PL label to "Pora nocy", and add a one-off Firefox red-mode screenshot to the post-merge checks (with the bright-Moon screenshot after 2026-10-22).
- **Decision**: FIXED — PL slider label "Pora nocy"; Firefox red-mode slider check added to `follow-ups/review-fixes.md` › Post-merge checks.
