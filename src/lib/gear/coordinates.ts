/**
 * Coordinate rounding for stored sites. The PRD stores coordinates at roughly 1 km precision
 * (FR-004): 0.01° of latitude is about 1.1 km. Rounding happens once, on the way in; the engine
 * never rounds.
 */

/** Rounds degrees to 2 decimals, half away from zero, and normalises `-0` to `0`. */
export function roundCoordinate(deg: number): number {
  const rounded = (Math.sign(deg) * Math.round(Math.abs(deg) * 100)) / 100;
  return rounded === 0 ? 0 : rounded;
}
