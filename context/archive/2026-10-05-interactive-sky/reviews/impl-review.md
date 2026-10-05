<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Interactive Tonight Sky

- **Plan**: context/changes/interactive-sky/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 7 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

What was checked:
- **Automated checks:**
  - `npm test`: 643 passed.
  - Lint and `astro check`: 0 errors.
  - `npm run build`: passes.
  - Full e2e: 23 passed, 2 skipped (bright-Moon gated).
  - PR #98 CI: `ci` and `smoke` pass.
- **Drift review:** every planned change is a MATCH, and the six approved deviations are implemented coherently.

## Findings

### F1 — The verdict's box covers the top of the star field
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (interaction / accessibility)
- **Location**: src/components/tonight/TonightSkyView.tsx:224, sky-band.ts:29-30
- **Detail**:
  - `*:pointer-events-auto` re-enables pointer events on `<astro-slot>`, and the property inherits through the `display: contents` slot. VerdictCard's whole full-width `<section>` therefore catches taps over the top of the 96 px overlap.
  - Bodies above about 73° (M31 and M13 are common) can't be tapped there, and a swipe that starts there doesn't scroll the strip.
  - VerdictCard has no links or buttons, so nothing is gained. The e2e only picks markers below the overlap for this reason.
- **Fix**: Drop `*:pointer-events-auto`, so the whole overlap passes taps and swipes to the panorama. Keyboard access is unchanged.
  - Strength: A one-class change; the verdict has nothing interactive.
  - Tradeoff: Verdict text can't be selected with the mouse.
  - Confidence: HIGH — VerdictCard.astro has no interactive elements.
  - Blind spot: A future link in the verdict would need the class back.
- **Decision**: FIXED

### F2 — A high body's label sits far from its dot
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (legibility)
- **Location**: src/components/tonight/TonightSkyView.tsx:117-121, src/lib/sky-view/labels.ts:51,68-71
- **Detail**:
  - A dot in the overlap gets one label candidate, clamped to the overlap's edge. At y≈10 the label sits about 86 px below its dot, reading as M34's (seen with M31 at 77°).
  - Two such bodies in one column fall back to the same rectangle and stack.
  - The logic lives in the component, so it is untested.
- **Fix**: Keep labels out of the overlap. When a label lands more than one label-height from its dot, draw a 1 px muted leader line from the dot to the label inside the marker. Move `bodyLabelRects` into `labels.ts`, and offer the clamped rect left and right of the dot's x, so two high bodies don't stack. Add one unit test.
  - Strength: Keeps the "no labels behind the verdict" rule, and the association is unambiguous.
  - Tradeoff: One more SVG element per high body.
  - Confidence: MED — needs a screenshot check.
  - Blind spot: How a leader looks next to a dense star field.
- **Decision**: FIXED

### F3 — Frame times are formatted in the browser
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (hydration)
- **Location**: src/components/tonight/TonightSkyView.tsx:136,158; src/lib/sky-view/frames.ts:37-45
- **Detail**:
  - The island formats each frame's time with its own `Intl.DateTimeFormat`, a second copy of `createFormatter`'s options. MoonTimeSlider receives server-formatted `timeLabels` instead.
  - The time, `aria-valuetext` and every marker's name are rendered by workerd and again at hydration, so an ICU difference means a hydration mismatch.
  - The first paint projects at a 390 px width, so on desktop the sky jumps once `ResizeObserver` measures.
- **Fix**: Send `timeLabels: string[]` from `buildTonight` (about 100 × 5 chars, +~1 KB), as the Moon slider does, and drop the browser formatter. Measure the strip in `useLayoutEffect` before first paint.
  - Strength: One formatter, matching the Moon slider pattern.
  - Tradeoff: Slightly bigger payload. The server render still assumes 390 px.
  - Confidence: HIGH — the same pattern exists already.
  - Blind spot: The desktop jump can't be removed entirely without CSS-only positioning.
- **Decision**: FIXED

### F4 — NaN guard
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TonightSkyView.tsx:170-174
- **Detail**: `altDeg <= 0` lets NaN through. One bad frame would put `MNaN` in the single star path, and the whole field would stop rendering.
- **Fix**: Use `if (!(altDeg > 0)) continue` for stars and bodies.
- **Decision**: FIXED

### F5 — The slider with a single frame, and a duplicated range class
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightSkyView.tsx:68-77
- **Detail**: MoonTimeSlider hides its range when there is one state; the sky renders a `min = max = 0` range. `rangeClass` is a near-copy of MoonTimeSlider's.
- **Fix**: Hide the range when `last === 0`, and share the range classes with MoonTimeSlider through one helper with a track switch.
- **Decision**: FIXED

### F6 — Red heading contrast is unchecked on the dusk tokens
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (accessibility)
- **Location**: src/styles/contrast.test.ts:82
- **Detail**: Body labels and the verdict use `heading`, but the red dusk row checks only `muted-foreground`.
- **Fix**: Add `heading` to the red dusk row.
- **Decision**: FIXED

### F7 — The focus ring is clipped at the strip's edges
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (accessibility)
- **Location**: src/components/tonight/TonightSkyView.tsx:288-294
- **Detail**: The SVG ring (r = 13) is cut by the SVG viewport for markers near the top or the wrap ends.
- **Fix**: Clamp the ring's centre the way `hitY` is clamped.
- **Decision**: FIXED

### F8 — Docs and stale text
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: CLAUDE.md:79; src/pages/design.astro; plan.md:45,132,148,195-210,257,301-302; LICENSE-DATA.md:41-42
- **Detail**:
  - CLAUDE.md's token list lacks `text-caption` and `--dusk-*`.
  - /design has no caption specimen and repeats `id="verdict-heading"` three times.
  - The plan and LICENSE-DATA still say "40 named", 200 px, and the old skyView shape and guard lists.
- **Fix**: Update the CLAUDE.md token line, add a caption specimen and unique ids on /design, and add a short "As built" addendum to plan.md plus the Polaris line in LICENSE-DATA.
- **Decision**: FIXED

### F9 — The hash-scroll script is duplicated
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/tonight/planets.astro:58-92
- **Detail**: It is a copy of the Targets page's helper, minus its `?logged` branch. It is safe (`getElementById`).
- **Fix**: Extract a shared helper both pages import.
- **Decision**: FIXED

### F10 — Test and evidence gaps
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/tonight/build.test.ts; plan Progress 3.6, 4.4
- **Detail**:
  - No test covers the polar fallback, or the catch that drops only `skyView`.
  - Step 3.6 was ticked against the real sky and the engine test, not Stellarium.
  - Step 4.4 was ticked from accessible names read through Playwright, not VoiceOver.
- **Fix**: Add the two build tests, and note the 3.6 and 4.4 evidence in the plan addendum (F8). A real VoiceOver pass stays with the user after merge.
- **Decision**: FIXED
