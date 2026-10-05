/**
 * The 16-wind compass rose, clockwise from north (compass-labels). Compass points are the international
 * abbreviations in every locale, never translated: Polish shows "SW" too, as charts and planetarium software do. This
 * is the one source for them, used by Tonight's formatter (`format.ts`) and the live sky (`TonightSkyView`).
 *
 * Pure and island-safe: no imports.
 */

export const COMPASS_POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export type CompassPoint = (typeof COMPASS_POINTS)[number];

/** The degrees between two neighbouring points. */
export const COMPASS_STEP_DEG = 360 / COMPASS_POINTS.length;

/** The point nearest an azimuth in degrees clockwise from north; any azimuth wraps into [0, 360). */
export function compassPoint(azimuthDeg: number): CompassPoint {
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(normalized / COMPASS_STEP_DEG) % COMPASS_POINTS.length];
}

const CARDINALS: ReadonlySet<CompassPoint> = new Set(["N", "E", "S", "W"]);

/** The four cardinal points, which the live sky draws stronger than the rest. */
export function isCardinal(point: CompassPoint): boolean {
  return CARDINALS.has(point);
}
