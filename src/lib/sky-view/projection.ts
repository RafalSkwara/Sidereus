import type { HorizonPoint } from "@/lib/sky-view/rotate";

/**
 * The interactive sky's horizon panorama (interactive-sky): the strip covers the full 360°; its centre
 * (x = `stripWidth / 2`) is `facing`, and azimuth runs as the observer sees it (facing south: east on the left, west on
 * the right; facing north: west on the left). x wraps at the strip's ends, which sit opposite `facing`. Altitude runs
 * linearly from 0 at the bottom to 90 at the top. How wide the strip is for a viewport and a mode is `skyField`
 * (`field.ts`, ui-sky-modes): today's band draws 180° per viewport on a strip twice its width.
 *
 * Pure and island-safe.
 */

export type Facing = "south" | "north";

const FACING_AZ: Record<Facing, number> = { south: 180, north: 0 };

/**
 * `point` on a 360° strip `stripWidth` wide and `height` tall, x in [0, stripWidth).
 * Altitudes below 0 or above 90 fall outside [0, height].
 */
export function project(
  point: HorizonPoint,
  facing: Facing,
  stripWidth: number,
  height: number,
): { x: number; y: number } {
  // Degrees from `facing`, in [−180, 180): negative to the left (east of south, west of north).
  const offset = ((((point.azDeg - FACING_AZ[facing] + 180) % 360) + 360) % 360) - 180;
  return {
    x: stripWidth / 2 + (offset / 360) * stripWidth,
    y: height - (point.altDeg / 90) * height,
  };
}

/** A star's dot radius in px: about 2.4 at magnitude −1.5, falling linearly to 0.6 at 4.5. */
export function starRadius(mag: number): number {
  const clamped = Math.min(4.5, Math.max(-1.5, mag));
  return 2.4 - ((clamped + 1.5) / 6) * 1.8;
}
