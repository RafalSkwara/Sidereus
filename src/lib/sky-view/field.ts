import type { SkyMode } from "@/lib/preferences";

/**
 * The live sky's field (ui-sky-modes): one pure rule from the mode and the measured box to the panorama strip's
 * geometry, so every mode draws the sky at its true angles and nothing is ever stretched by CSS. The strip always
 * spans exactly 360° and altitude 0–90° always spans the field's height; what changes is how many degrees one view
 * shows.
 *
 * - DEFAULT and HIDDEN: 180° per view, on a strip twice the inset viewport (interactive-sky's rule, unchanged).
 * - EXPANDED: square degrees (1° sideways = 1° upwards) for the measured field, clamped to [60°, 180°] per view, so a
 *   tall phone field shows about 68° at once and a desktop stays at 180° (owner question Q4, default B).
 *
 * The view's ends sit `EDGE_INSET_PX` inside the viewport's edges, so the first view shows E and W whole. The strip is
 * never narrower than twice the inset viewport, so its wrap point (opposite `facing`) never shows twice in one view.
 *
 * Pure and island-safe.
 */

/** How far inside the viewport's edges the view's ends sit at load (the field is drawn this much narrower per side). */
export const EDGE_INSET_PX = 8;
/** EXPANDED's narrowest and every mode's widest view, in degrees of azimuth. */
export const EXPANDED_MIN_SPAN_DEG = 60;
export const MAX_SPAN_DEG = 180;

export interface SkyFieldInput {
  mode: SkyMode;
  /** The scroller's measured width, px. */
  viewportPx: number;
  /** The star field's measured height (the strip plus the overlap behind the verdict), px. */
  fieldHeightPx: number;
}

export interface SkyField {
  /** The whole 360° strip's width, px. */
  stripWidthPx: number;
  /** Altitude 0–90° spans this height, px. */
  fieldHeightPx: number;
  /** Degrees of azimuth across the inset viewport. */
  viewSpanDeg: number;
}

export function skyField({ mode, viewportPx, fieldHeightPx }: SkyFieldInput): SkyField {
  const inner = Math.max(viewportPx - 2 * EDGE_INSET_PX, 1);
  if (mode !== "expanded" || !(fieldHeightPx > 0)) {
    return { stripWidthPx: 2 * inner, fieldHeightPx, viewSpanDeg: MAX_SPAN_DEG };
  }
  // Square degrees: the field's px per degree upwards (height / 90) sideways too.
  const square = (inner * 90) / fieldHeightPx;
  const viewSpanDeg = Math.min(Math.max(square, EXPANDED_MIN_SPAN_DEG), MAX_SPAN_DEG);
  return { stripWidthPx: (inner * 360) / viewSpanDeg, fieldHeightPx, viewSpanDeg };
}
