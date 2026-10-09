<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: The user's UI adjustments (M-3 S-02)

- **Plan**: context/changes/ui-user-adjustments/plan.md
- **Scope**: Phase 6 of 6
- **Reviewed phases**: 6
- **Date**: 2026-10-08
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Evidence: `npx astro check` 0 errors; `npm test` 1179 passed; lint 0 errors (3 old warnings); `npm run build` passed; the plan, phone and offline specs plus the full e2e suite passed (44 passed, 3 skipped) on the Phase 6 build. Manual rows 6.6, 6.8 and 6.9 were checked from the agent's screenshots; the user confirmed 6.7.

Plan drift: every Intent and Contract bullet MATCHES. Accepted extras: `trackStep` on the plan (the last track step is shorter, so x needs it) and the `legendLabel`, `legendWindow` and `legendDark` keys. There is no new `catch`.

## Findings

### F1 — In red mode the base curve falls below the 3:1 floor, and no test checks it

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/SessionTimeline.astro:159, src/styles/contrast.test.ts:84
- **Detail**: Each row's main line (`stroke-muted-foreground`) is red `#c40000` on `--plan-twilight` `#3a0000`, which is 2.84:1, under the 3:1 floor for non-text marks. On `--plan-night` it is 3.21:1. The contrast test's plan row only checks `primary-strong` and `heading`, so this gap is invisible to the tests. Dark and light have not been measured either.
- **Fix A ⭐ Recommended**: Add a `--plan-line` token: the current `muted-foreground` value in dark and light, and a red value of at least 3:1 on `#3a0000` with zero green and blue. Use `stroke-plan-line` and add the token to the contrast test's plan row.
  - Strength: The fix applies only to red. The dark/light hierarchy (thin grey line, thick window) stays, and the test guards it from now on.
  - Tradeoff: A new token in all three theme blocks plus the `@theme` mapping.
  - Confidence: HIGH — this is the same pattern as `--plan-twilight` / `--plan-night`, and the red-theme test checks the zero green and blue.
  - Blind spot: In red, the line and the window will be closer in brightness, so the thickness carries the difference (it already does).
- **Fix B**: Use `stroke-foreground` in every theme and add `foreground` to the contrast test.
  - Strength: No new token.
  - Tradeoff: In dark and light the base line gets as strong as the text, so the window stands out less.
  - Confidence: MED — it needs a visual check in all themes.
  - Blind spot: Contrast of `foreground` on `plan-night` in light has not been measured.
- **Decision**: FIXED (Fix A): `--plan-line` #a9b1c5 / #3c465c / #e00000 (red 3.53:1 on plan-twilight), mapped in `@theme`, used for the curve and the legend swatch, added to the contrast test's plan row (break-check: #c40000 goes red at 2.84); CLAUDE.md tokens list updated.

### F2 — `plan.moonUp` has no consumer

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/tonight/build.ts:383, ~1192
- **Detail**: The new Session plan no longer draws the Moon's band. `moonUp` is still computed and typed, but nothing reads it (grep) and no test covers it. `moonEvents` is still used, through `moonText`.
- **Fix**: Remove `moonUp` from `TonightSessionPlan` and from the build step.
- **Decision**: FIXED: `moonUp` removed from `TonightSessionPlan` and from `buildTonight` (with its `clampAt` helper); `moonSpans` still feeds the layout's `moonEvents`.

### F3 — Three stale comments ("bars")

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/tonight/altitude-curve.ts:4, src/i18n/messages/en.ts:947, src/styles/contrast.test.ts:83
- **Detail**: `altitude-curve.ts` refers to a `maxAltitudeDeg` input that does not exist (the constant is `CURVE_MAX_ALTITUDE_DEG`). The `rowLabel` doc says "the bar and dot are decorative". The contrast test still mentions "The Session plan's bars".
- **Fix**: Reword all three to the curve, the window stretch and the dot.
- **Decision**: FIXED: `altitude-curve.ts` header names `CURVE_MAX_ALTITUDE_DEG`; the `rowLabel` doc speaks of the curve; the contrast test's comment was rewritten with F1.

### F4 — The dashboard computes curve tracks it never draws

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/build.ts:1070-1081
- **Detail**: With `withSkyView` and `withSessionPlan` (the dashboard), `objectTracks` runs a second time for the same top 5 objects, and `planetTracks` runs for a subset of planets the sky view already tracks. The tile only uses `nextUp`. The plan allowed reusing the sky view's tracks "if the cost shows". On Workers Paid this is a small cost.
- **Fix**: Leave it for now and watch the dashboard's server time; if it grows, reuse the sky view's tracks (same range, same grid).
- **Decision**: FIXED: the sky view keeps its raw tracks by key (`axisTracks`); the plan tracks only targets missing from it and throws into the existing plan `catch` if one is absent (no new `catch`). Test: the plan's tracks are identical with and without `withSkyView` (break-check: corrupting the reused planet tracks turns it red).

### F5 — The /tonight/plan skeleton no longer matches the row height

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightPageSkeleton.astro:52-57, src/pages/tonight/plan.astro:26
- **Detail**: Plan rows are now about 3× taller (name, line, curve, hours), but the skeleton keeps generic short rows. Below the sky band, the content jumps when the island swaps in.
- **Fix**: Accept it (the jump is below the sky band, outside the measured first screen) or give the skeleton taller rows for /tonight/plan.
- **Decision**: FIXED: `TonightPageSkeleton` gains `layout="plan"` (night lines, legend, rows shaped like SessionTimeline's), used by `/tonight/plan`, with a `/design` specimen. Measured: first row 8 px off at 390, 20 px at 1280 (was 48 px), row pitch identical.

### F6 — The old bare `catch` now also swallows track errors

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/build.ts:~1206
- **Detail**: `catch { sessionPlan = null; }` predates this change, and the plan deliberately added no new `catch`. Now, though, a failure in the curve code also disappears without a trace. That conflicts with the lesson rule "Never hide the evidence". `buildTonight` has the same pattern for the planets, the Moon and the sky view.
- **Fix**: A separate change: log the cause in these `catch` blocks (an observability audit covers the whole `buildTonight`), not in this PR.
- **Decision**: FIXED (user's choice: a fixed line and the error's name only): the Session plan's `catch` logs `console.error("buildTonight: the Session plan failed", <error name>)` under a commented `eslint-disable-next-line no-console` (src/lib/tonight is no-console for coordinate privacy); never the message or stack. Test: a mocked `planetTracks` failure whose message carries a coordinate drops only the plan and logs the name alone (break-check: logging `String(error)` turns it red). The other bare catches in `buildTonight` (planets, Moon, sky view) are unchanged.

### F7 — Small test-coverage gaps

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/tonight-dashboard.spec.ts:84-95, src/pages/design.astro:1860-1893
- **Detail**: The e2e spec does not check `legendMin` (the minimum altitude with its value). The "all-night planet" in `/design` depends on the ephemeris for 10 October, not on a fixed fixture.
- **Fix**: Add a `legendMin({ deg: "15" })` assertion; the `/design` specimen can stay as it is.
- **Decision**: FIXED: the plan spec asserts `legendMin({ deg: "15" })` (onboarding's default minimum altitude); the `/design` specimen stays as it is.

### F8 — The row's `aria-label` repeats the visible text in other words

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/SessionTimeline.astro:121-131
- **Detail**: The visible line now says "Best 22:40 · window … · …", and the `aria-label` says "best at 22:40, window …". It passes WCAG 2.5.3 (the name comes first), but the `aria-label` adds nothing now that the curve is `aria-hidden`.
- **Fix**: Optional: remove the `aria-label` so the link's name is its visible text (the e2e spec selects rows by `data-session-plan-row`).
- **Decision**: FIXED: the row link's `aria-label` and the `rowLabel` key (EN, PL) are gone; the link's name is now its visible name and line (the curve and its hour labels are `aria-hidden`). A deliberate change to the plan's "rows keep their accessible name (rowLabel)" contract, at the user's choice.
