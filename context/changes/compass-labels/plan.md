# Compass Labels Implementation Plan

## Overview

Compass points read the same everywhere, in English and Polish: the international 16-wind abbreviations (N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW), never translated. The live sky (`TonightSkyView`) gains a compass row along the top edge of its star field, naming each of the 16 points above its azimuth. Written straight from the user's request (no planning interview, user 2026-10-05).

## Current State Analysis

- The compass lives in the i18n catalogues: `en.ts:387` (`compass`, the international abbreviations) and `pl.ts:374` (Polish ones: Pn, PnPnW, … W = wschód, Z = zachód). Polish users therefore read "kierunek W" for east.
- Callers: `compassPoint` in `src/lib/tonight/format.ts:229-238` (best direction on Targets, planets, the Moon: "SW, 45°") and the sky island's marker names (`TonightSkyView.tsx:239`).
- The live sky's star field is `STRIP_HEIGHT_PX + STRIP_OVERLAP_PX` tall. Its top 96 px sits behind the verdict's lower area, which takes no pointer events. Labels stay below the overlap (`labels.ts`).
- The hemisphere words in the no-darkness latitude line ("52° szerokości północnej", `pl.ts:694-695`) describe a latitude, not a compass point, and stay as prose.

## Desired End State

- One locale-free, island-safe source, `src/lib/compass.ts`, holds `COMPASS_POINTS` and `compassPoint(azimuthDeg)`. `format.ts` and the sky island both use it. The `compass` key is gone from both catalogues, so Polish shows "SW" where it showed "PdZ".
- The live sky shows the 16 points along the top edge of its star field, each centred above its azimuth across the full 360° strip. Cardinal points (N, E, S, W) are in heading ink and semibold; the others are muted. The row is decorative (`aria-hidden`), because every marker's name already carries its direction. It sits just below the verdict's text: the island measures where the text ends, so a taller verdict pushes the row down and never covers it. The row stays hidden until it has been measured.

## What We're NOT Doing

- No change to prose that names a region rather than a direction ("low in the east", "nad zachodnim horyzontem") or to the latitude's hemisphere words.
- No compass on the focused pages' static sky.
- No new compass in any text that lacks one today.

## Phase 1: International compass points and the sky's compass row

### Changes Required:

#### 1. Shared compass

**File**: `src/lib/compass.ts` (new), `src/lib/compass.test.ts` (new), `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `src/lib/tonight/format.ts`, `src/lib/tonight/format.test.ts`

**Intent**: Move the 16-wind rose out of the catalogues into one locale-free module that both the server formatter and the island import.

**Contract**:
- `COMPASS_POINTS` is a readonly tuple of the 16 abbreviations, clockwise from N.
- `compassPoint(azimuthDeg)` normalises any azimuth and rounds to the nearest of the 16 points.
- `format.ts` delegates to it.
- `m.compass` is removed from both catalogues. Copy comments that mention it are updated.

#### 2. The sky's compass row

**File**: `src/components/tonight/TonightSkyView.tsx`, `src/components/tonight/TonightSkyView.test.ts`

**Intent**: Draw the 16 points along the top edge of the star field, just below the verdict's text, and name the markers' directions from the shared compass.

**Contract**:
- Labels are centred at `project({ altDeg: 0, azDeg }, facing, viewport, height).x`. The point at the strip's wrap edge is also drawn at the far end.
- Cardinal points use `fill-heading font-semibold`; the others use `fill-muted-foreground`. Both use `text-caption`, and the row is `aria-hidden`.
- The row's y is the verdict's measured text bottom plus a small gap. The text bottom comes from a `Range` over the verdict container, because the slot is `display: contents`. It is clamped to [a few px, `STRIP_OVERLAP_PX`] and re-measured on resize. The row is invisible until measured.
- The import guard allows `@/lib/compass`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `compass.test.ts`, `format.test.ts`, the i18n parity test and the import guard
- `npm run lint`, `npx astro check` and `npm run build` pass
- `npm run test:e2e` passes against the local preview

#### Manual Verification:

- Screenshots of `/tonight` at 390 px and desktop in EN and PL, dark and red: the 16 points sit along the top edge of the sky without touching the verdict, cardinals stand out, and PL shows the same abbreviations as EN
- A PL marker's accessible name and a PL Targets best direction read with international points (e.g. "kierunek E", "SW, 45°")

## References

- Request: user, 2026-10-05 (after the interactive-sky archive)
- `src/lib/tonight/format.ts:228-238`, `src/components/tonight/TonightSkyView.tsx:237-248`, `src/lib/sky-view/projection.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: International compass points and the sky's compass row

#### Automated

- [x] 1.1 `npm test` passes, including `compass.test.ts`, `format.test.ts`, the i18n parity test and the import guard — 58d9f1b
- [x] 1.2 `npm run lint`, `npx astro check` and `npm run build` pass — 58d9f1b
- [x] 1.3 `npm run test:e2e` passes against the local preview — 58d9f1b

#### Manual

- [x] 1.4 Screenshots of `/tonight` at 390 px and desktop in EN and PL, dark and red: the 16 points sit along the top edge of the sky without touching the verdict, cardinals stand out, and PL shows the same abbreviations as EN — 58d9f1b
- [x] 1.5 A PL marker's accessible name and a PL Targets best direction read with international points — 58d9f1b
