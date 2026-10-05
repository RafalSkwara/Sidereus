import type { HorizonPoint } from "@/lib/sky-view/rotate";

/**
 * The interactive sky's horizon panorama (interactive-sky): the strip is twice the viewport wide and covers the full
 * 360°, so the viewport shows 180°; its centre (x = `width`) is `facing`, and azimuth runs as the observer sees it
 * (facing south: east on the left, west on the right; facing north: west on the left). x wraps at the strip's ends,
 * which sit opposite `facing`. Altitude runs linearly from 0 at the bottom to 90 at the top.
 *
 * Pure and island-safe.
 */

export type Facing = "south" | "north";

const FACING_AZ: Record<Facing, number> = { south: 180, north: 0 };

/**
 * `point` on a strip `2 × width` wide and `height` tall (`width` is the viewport's width), x in [0, 2 × width).
 * Altitudes below 0 or above 90 fall outside [0, height].
 */
export function project(point: HorizonPoint, facing: Facing, width: number, height: number): { x: number; y: number } {
  // Degrees from `facing`, in [−180, 180): negative to the left (east of south, west of north).
  const offset = ((((point.azDeg - FACING_AZ[facing] + 180) % 360) + 360) % 360) - 180;
  return {
    x: width + (offset / 180) * width,
    y: height - (point.altDeg / 90) * height,
  };
}

/** A star's dot radius in px: about 2.4 at magnitude −1.5, falling linearly to 0.6 at 4.5. */
export function starRadius(mag: number): number {
  const clamped = Math.min(4.5, Math.max(-1.5, mag));
  return 2.4 - ((clamped + 1.5) / 6) * 1.8;
}
