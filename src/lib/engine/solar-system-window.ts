import type { HorizontalPosition, Interval } from "./types";

/**
 * Helpers shared by the solar-system targets ranked over the planet window: the planets (`rankPlanets`) and
 * the Moon (`moonTarget`). Pure.
 */

/** Which third of the planet window holds the peak. */
export type PlanetTiming = "evening" | "night" | "morning";

/**
 * Thirds are half-open, [0, ⅓) evening, [⅓, ⅔) night, [⅔, 1] morning, so a peak exactly on a boundary
 * belongs to the later third. Compared in whole milliseconds, so the boundaries are exact.
 */
export function timingOf(peak: Date, window: Interval): PlanetTiming {
  const length = window.end.getTime() - window.start.getTime();
  const elapsed = peak.getTime() - window.start.getTime();
  if (3 * elapsed < length) {
    return "evening";
  }
  return 3 * elapsed < 2 * length ? "night" : "morning";
}

/**
 * `track` with every sample outside `intervals` pushed below any horizon, so `bestWindow` neither counts it nor
 * picks it as the peak. The samples stay on the shared grid.
 */
export function maskedTrack(
  track: readonly HorizontalPosition[],
  intervals: readonly Interval[],
): HorizontalPosition[] {
  return track.map((position) => {
    const t = position.time.getTime();
    const visible = intervals.some((interval) => interval.start.getTime() <= t && t <= interval.end.getTime());
    return visible ? position : { ...position, altitudeDeg: Number.NEGATIVE_INFINITY };
  });
}
