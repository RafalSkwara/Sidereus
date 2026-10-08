/**
 * The Session plan's altitude curve (ui-user-adjustments): one target's height above the horizon across the plan's
 * axis, as SVG geometry in a `width` × `height` box. x is the axis (0 at its start, `width` at its end); y runs from
 * the horizon at the bottom (`height`) to the zenith, `CURVE_MAX_ALTITUDE_DEG`, at the top (0), so every row shares
 * one scale and a low planet reads as low. Altitudes below the horizon lie on the bottom edge. Pure: no clock, no formatting.
 */

/** The top of the curve's scale: the zenith, so heights compare across rows. */
export const CURVE_MAX_ALTITUDE_DEG = 90;

export interface AltitudeCurveInput {
  /** Altitude in tenths of a degree per track step from the axis start; the last sample is at the axis end. */
  track: readonly number[];
  /** One track step as a fraction of the axis (the last step may be shorter: x stops at the axis end). */
  stepFraction: number;
  /** The site's minimum altitude, degrees. */
  minAltitudeDeg: number;
  /** The best window as fractions of the axis. */
  window: { from: number; to: number };
  /** The best time as a fraction of the axis, and the altitude there, degrees. */
  best: number;
  bestAltitudeDeg: number;
  width: number;
  height: number;
}

export interface AltitudeCurve {
  /** The whole track, "M x y L x y …"; empty for an empty track. */
  line: string;
  /** The track inside the best window, its ends interpolated at the window's edges; empty when it has no length. */
  window: string;
  /** y of the minimum-altitude line. */
  minY: number;
  /** Where the best-time dot sits. */
  dot: { x: number; y: number };
}

const round = (value: number): number => Math.round(value * 10) / 10 || 0;

export function altitudeCurve(input: AltitudeCurveInput): AltitudeCurve {
  const { track, stepFraction, width, height } = input;
  const yOf = (altitudeDeg: number): number =>
    round(height - (Math.min(Math.max(altitudeDeg, 0), CURVE_MAX_ALTITUDE_DEG) / CURVE_MAX_ALTITUDE_DEG) * height);
  const fractionAt = (index: number): number => Math.min(index * stepFraction, 1);
  const points = track.map((tenths, index) => ({ at: fractionAt(index), altitudeDeg: tenths / 10 }));

  /** The altitude at a fraction of the axis, linear between the samples either side. */
  const altitudeAt = (at: number): number => {
    const after = points.findIndex((point) => point.at >= at);
    if (after <= 0) {
      return (after === 0 ? points[0] : points[points.length - 1]).altitudeDeg;
    }
    const a = points[after - 1];
    const b = points[after];
    const span = b.at - a.at;
    return span > 0 ? a.altitudeDeg + ((at - a.at) / span) * (b.altitudeDeg - a.altitudeDeg) : b.altitudeDeg;
  };
  const pathOf = (stretch: readonly { at: number; altitudeDeg: number }[]): string =>
    stretch
      .map((point, i) => `${i === 0 ? "M" : "L"}${String(round(point.at * width))} ${String(yOf(point.altitudeDeg))}`)
      .join(" ");

  const { from, to } = input.window;
  const windowPoints =
    points.length > 0 && to > from
      ? [
          { at: from, altitudeDeg: altitudeAt(from) },
          ...points.filter((point) => point.at > from && point.at < to),
          { at: to, altitudeDeg: altitudeAt(to) },
        ]
      : [];

  return {
    line: pathOf(points),
    window: pathOf(windowPoints),
    minY: yOf(input.minAltitudeDeg),
    dot: { x: round(input.best * width), y: yOf(input.bestAltitudeDeg) },
  };
}
