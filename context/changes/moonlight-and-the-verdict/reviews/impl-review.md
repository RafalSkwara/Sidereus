<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Moonlight and the Verdict

- **Plan**: `context/changes/moonlight-and-the-verdict/plan.md`
- **Scope**: Phases 1–4 of 5 (Phase 5, the time slider, not implemented yet)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-02
- **Verdict**: NEEDS ATTENTION → triaged 2026-10-02: F1–F6 fixed, F7–F8 deferred to Phase 5
- **Findings**: 0 critical · 3 warnings · 5 observations

The four phase commits are 7e4327a, 31e5aa1, c6f6972 and 77fe3a0, reviewed against 06b0894.

- **Plan adherence:** about 24 planned items match. The approved deviations are applied consistently: skycalc scattering, the "Moon's fault" count, unclipped maria clipped by the renderer, "No forecast" for cloudy with no hours, moon-* tokens, and no percent in the faint line.
- **Removal:** the bright-Moon removal touch-list is complete.
- **Automated criteria re-run on HEAD:** `npm test` 549 passed (6 todo), `npx astro check` 0 errors, `npm run lint` 0 errors (2 old warnings), and `npm run build` OK. E2E passed at the Phase 3 and 4 gates: 14 passed, landing capture skipped.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — The washed-out link does not land on the group

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (reliability / UX)
- **Location**: `src/components/tonight/TonightContent.astro:208` → `src/components/tonight/AllObjectsContent.astro:83` (inside `server:defer`, `src/pages/tonight/all.astro:22`)
- **Detail**:
  - **Checked in the browser** (local preview, phone width, Madrid, 2026-10-02): clicking "1 faint object is washed out by the Moon tonight →" opens `/tonight/all#washed-out` at `scrollY=0`.
  - The `#washed-out` section is about 5,200 px down, below all 72 rows.
  - The fragment is resolved before the server island has inserted the section, so the browser never scrolls to it.
  - Phase 1's promise that the shorter list is "never unexplained" therefore holds only for a user who scrolls all the way down.
  - No e2e test covers the jump.
- **Fix A ⭐ Recommended**: A small inline script in the `/tonight/all` page shell scrolls to `location.hash` once the island's content is inserted (a `MutationObserver` on the island host, disconnected after the first match), plus an e2e assertion that the section is in view after the click.
  - Strength: Keeps the layout and the group's place. JavaScript is already required inside the island (lessons.md).
  - Tradeoff: One small script on that page.
  - Confidence: HIGH — the same defect is reproduced and the check is easy to automate.
  - Blind spot: Interaction with Astro's own island swap timing on slow connections. The observer handles that.
- **Fix B**: Render the washed-out group above the cleared list on `/tonight/all`. The fragment is still unresolved, but the group shows near the top.
  - Strength: No script.
  - Tradeoff: A UI change that puts objects the Moon hides above the ones to observe. It is the user's call.
  - Confidence: MED.
  - Blind spot: Whether the page heading and order still read well.
- **Decision**: FIXED via Fix A — inline script in `src/pages/tonight/all.astro` scrolls to the hash once the island inserts it (MutationObserver, 10 s cap); e2e `tonight-all-objects.spec.ts` asserts `#washed-out` is in the viewport after the click (skips on a night with nothing washed out). Break-checked: red without the script.

### F2 — "Moonlight barely affects it" can be false on a bright night

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (copy accuracy)
- **Location**: `src/i18n/messages/en.ts:632-633`, `pl.ts:591-592`, `src/lib/tonight/format.ts:250-251`
- **Detail**:
  - `reasonComponents` picks the lead reason relative to the mean of the listed entries (`ranking.ts:152-169`).
  - On a full-Moon night, an object with moon component 0.4 among entries at about 0.1 leads with "Moonlight barely affects it", which is false in absolute terms.
  - The old wording carried a percent ("N% clear of moonlight") and stayed true.
- **Fix A ⭐ Recommended**: Word it relatively, e.g. EN "Holds up better in moonlight than the rest" / PL "Lepiej od innych znosi blask Księżyca". This matches how the lead reason is chosen.
  - Strength: Always true by construction.
  - Tradeoff: Slightly longer copy. It is a UI wording call.
  - Confidence: HIGH.
  - Blind spot: How the single-entry fallback (largest weighted value) reads with relative wording.
- **Fix B**: Keep the wording, but only when the moon component is ≥ 0.8; otherwise use a weaker phrase.
  - Strength: The absolute claim is true when shown.
  - Tradeoff: Adds a threshold parameter and a second phrase.
  - Confidence: MED.
  - Blind spot: The right threshold.
- **Decision**: FIXED via Fix A — "Holds up better in moonlight than the rest" / "Lepiej od innych znosi blask Księżyca" (lead and follow).

### F3 — Maria drawn faintly on the dark side

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `src/components/tonight/MoonDisc.astro:41-45`
- **Detail**:
  - Besides the maria clipped to the lit part (as planned), the disc draws every mare unclipped at `opacity-15` across the whole disc.
  - That makes the dark side visible, close to earthshine, which is in "What We're NOT Doing".
  - You saw it in the Phase 4 screenshots and confirmed them, but it was never decided on its own.
- **Fix**: Remove the unclipped `opacity-15` group (dark side plain), or keep it and record it in the plan as a user-approved addition.
- **Decision**: FIXED — the unclipped faint-maria layer is removed; the dark side is plain (user choice).

### F4 — "Faint objects unaffected" overstates it

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (copy accuracy)
- **Location**: `src/i18n/messages/en.ts:589` (and PL), `format.ts` `moonFaintText`
- **Detail**: "Moon up … · faint objects unaffected" shows whenever nothing is washed out. Galaxies still score lower under that Moon, so they are affected, just not hidden.
- **Fix**: "Moon up 22:10–03:40 · no faint objects washed out" / PL "… · żaden słaby obiekt nie ginie".
- **Decision**: FIXED — "Moon up … · no faint objects washed out" / "… · żaden słaby obiekt nie ginie"; tests updated.

### F5 — Stale comment on the faint line

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/lib/tonight/build.ts:698-699`
- **Detail**: The comment still says "The illumination is the strip's night-1 value, so the card and the strip never disagree". `moonFaintText` takes no illumination since the percent was dropped. The card's heading percent (the state at page load) and the strip's "Moon N%" (mid-window) can still differ on one screen. That is by design: the card follows the slider in Phase 5.
- **Fix**: Rewrite the comment to say the faint line has no percent, and that the heading follows the shown state while the strip's figure is the night's.
- **Decision**: FIXED — comment rewritten (no percent in the line; heading follows the shown state, strip shows the night's figure).

### F6 — "Neither washed out nor cleared" is half-tested

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `src/lib/engine/score.test.ts:219-227`
- **Detail**: Phase 1 §5 asks that such an object is neither washed out nor cleared. The test only asserts `washedOut === false` for the 70 mm case.
- **Fix**: Add `expect(score({ ...brief, ...night, apertureMm: 70 }).total).toBeLessThan(MIN_OBJECT_SCORE)`.
- **Decision**: FIXED — `total < MIN_OBJECT_SCORE` asserted for the 70 mm case.

### F7 — The disc's aria-label repeats the heading

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (accessibility)
- **Location**: `src/components/tonight/MoonDisc.astro:26-32`, `MoonCard.astro:25-26`
- **Detail**: Screen readers hear "Waxing gibbous · 63% lit" from the h2, then "Moon: Waxing gibbous, 63% lit" from the image right below it.
- **Fix**: Revisit in Phase 5. Once the slider moves the disc away from the heading, the disc's label will carry the moment shown. Until then, leave it. Phase 5 decides `aria-hidden` versus the label.
- **Decision**: DEFERRED to Phase 5 (user) — recorded in `follow-ups/review-fixes.md`.

### F8 — Notes for Phase 5: clipPath ids and the duplicate Moon track

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/components/tonight/MoonDisc.astro:24`; `src/lib/tonight/build.ts:687` vs `src/lib/engine/ranking.ts:179`
- **Detail**:
  - **The clipPath id is `${idPrefix}-lit-${time digits}`.** That is unique today (one disc per page). If the Phase 5 slider swaps the path inside the same `<clipPath>`, the id no longer matches the state shown. If it renders a new disc with the default prefix at the initial instant, it collides with the server disc.
  - **The Moon track is computed twice per ranked night:** `moonTrack` for the card and again inside `rankObjects`, on the same 10-minute grid. The measured cost is small: about 4 ms of disc states and 2.5 ms of Moon track on a 20 h window.
- **Fix**: In Phase 5, give the island its own `idPrefix`, or one per instance. Leave the duplicate track (cheap, keeps the engine API unchanged).
- **Decision**: DEFERRED to Phase 5 (user) — recorded in `follow-ups/review-fixes.md`.
