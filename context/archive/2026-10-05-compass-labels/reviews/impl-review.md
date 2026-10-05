<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Compass Labels

- **Plan**: context/changes/compass-labels/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

What was checked:
- **Automated checks:**
  - `npm test`: 648 passed.
  - Lint, `astro check` and build: clean.
  - Full e2e: 23 passed, 2 skipped (bright-Moon gated).
- **Repo-wide sweep:** no Polish or otherwise translated compass point remains, and there is no second compass. The latitude hemisphere words and prose regions are intentional exceptions.

## Findings

### F1 — The compass row isn't re-measured after the font swap
- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TonightSkyView.tsx:143-162
- **Detail**:
  - The ResizeObserver watches the verdict container, which has a minimum height. A reflow inside it, such as Archivo's `font-display: swap` wrapping the headline onto one more line, leaves the box's size unchanged.
  - The row would then keep its old place and could collide with the text.
- **Fix**: Also observe the slot's element children, and re-measure on `document.fonts.ready`.
- **Decision**: FIXED

### F2 — E and W are half cut at load
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (legibility)
- **Location**: src/components/tonight/TonightSkyView.tsx:203-211, src/lib/sky-view/projection.ts:24-26
- **Detail**: The centred 180° view puts E and W (W and E when facing north) exactly on the viewport's edges, so the two orienting cardinals are half cut on first view.
- **Fix**: Project into a field 16 px narrower than the viewport (`viewport − 16` per half), so the first view shows about 188° and E/W sit 8 px inside each edge. Everything moves consistently, with no azimuth misstated.
  - Strength: One constant, and positions stay true.
  - Tradeoff: Slightly denser sky (−4%).
  - Confidence: HIGH — the centring already works from `scrollWidth`.
  - Blind spot: The wrap ends at 0 and stripWidth shift too (F3).
- **Decision**: FIXED

### F3 — The wrap-edge point is half clipped at the strip's ends
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (legibility)
- **Location**: src/components/tonight/TonightSkyView.tsx:207-208,269
- **Detail**: The point opposite `facing` is drawn centred at x = 0 and x = stripWidth, the strip's real ends, so each copy shows only half a letter.
- **Fix**: Anchor the copy at 0 with `start` and the copy at stripWidth with `end`.
- **Decision**: FIXED

### F4 — Fallbacks for an empty measurement
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TonightSkyView.tsx:150-153
- **Detail**: An empty slot gives a zero rect, which makes `textBottom` depend on scroll. The upper clamp `STRIP_OVERLAP_PX` would let the row reach the label zone.
- **Fix**: Fall back to `COMPASS_MIN_TOP_PX` when the rect's height is 0, and clamp to `STRIP_OVERLAP_PX − 16` (one caption line).
- **Decision**: FIXED

### F5 — Markers drawn over compass letters
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (legibility)
- **Location**: src/components/tonight/TonightSkyView.tsx:266-281
- **Detail**: A body at about 67–73° (M31 or M13 in autumn) draws its dot, and possibly its leader line, over the row's letters.
- **Fix**: Accept it as is (star dots do the same); revisit only if it looks busy.
- **Decision**: ACCEPTED — star dots overlap the row the same way; revisit if it looks busy

### F6 — Red base sky stops unpinned for contrast
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (accessibility)
- **Location**: src/styles/contrast.test.ts:89-92
- **Detail**: The muted 12 px compass letters sit on the red `zenith` and `horizon`, which the red rows don't check. Muted text on red horizon is about 3.1:1 today: it passes, but nothing pins it.
- **Fix**: Add `zenith` and `horizon` to both red rows.
- **Decision**: FIXED

### F7 — Dead `compassPoint` re-export
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/tonight/format.ts:658
- **Detail**: `createFormatter` still returns `compassPoint`, but nothing reads it. It is a second public path to `@/lib/compass`.
- **Fix**: Drop it from the returned object.
- **Decision**: FIXED

### F8 — Docs and stated intent
- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: CLAUDE.md:75,84,90; src/components/tonight/TonightSkyView.tsx:47-49; src/lib/compass.ts:39-42
- **Detail**:
  - CLAUDE.md's "no user-visible literal, add a catalogue key" rule doesn't state the compass exception, so a future agent could move the points back into the catalogue.
  - The live-sky section doesn't mention the compass row.
  - The island's header import list omits `@/lib/compass`.
  - `isCardinal` relies on `length === 1`.
- **Fix**:
  - Add a CLAUDE.md line: compass points come from `@/lib/compass` and are never translated.
  - Mention the compass row in the live-sky bullet.
  - Update the island header.
  - Make `isCardinal` explicit with a `CARDINALS` set.
- **Decision**: FIXED
