import { HorizonFromVector, RotateVector, Rotation_EQJ_HOR, Spherical, VectorFromSphere } from "astronomy-engine";
import type { RotationMatrix } from "astronomy-engine";

import { DEFAULT_TRACK_STEP_MINUTES } from "./parameters";
import { sampleInstants } from "./sampling";
import { observerFor } from "./sun";
import type { EquatorialJ2000, HorizontalPosition, Interval, Site } from "./types";

/**
 * Positions of fixed deep-sky objects and the best-placed window during a night. Pure: every input
 * is explicit and the same inputs always produce the same numbers.
 */

/** The longest contiguous stretch of a track at or above a minimum altitude, and its highest sample. */
export interface BestWindow {
  start: Date;
  end: Date;
  peak: HorizontalPosition;
}

/**
 * Applies a precomputed J2000→horizontal rotation to a catalogue position. Catalogue coordinates
 * are J2000 and must never go straight into `Horizon`, which expects of-date coordinates; skipping
 * the precession/nutation rotation costs about half a degree in 2026 and grows every year.
 */
function positionWithRotation(rotation: RotationMatrix, time: Date, target: EquatorialJ2000): HorizontalPosition {
  const j2000 = VectorFromSphere(new Spherical(target.decDeg, target.raHours * 15, 1), time);
  const horizontal = HorizonFromVector(RotateVector(rotation, j2000), "normal");
  return { time, altitudeDeg: horizontal.lat, azimuthDeg: horizontal.lon };
}

/** Where a fixed object with J2000 catalogue coordinates is in the site's sky at `time` (refracted). */
export function objectPosition(site: Site, time: Date, target: EquatorialJ2000): HorizontalPosition {
  return positionWithRotation(Rotation_EQJ_HOR(time, observerFor(site)), time, target);
}

/** `objectPosition` sampled across `interval` every `stepMinutes`, inclusive of both ends. */
export function objectTrack(
  site: Site,
  interval: Interval,
  target: EquatorialJ2000,
  stepMinutes = DEFAULT_TRACK_STEP_MINUTES,
): HorizontalPosition[] {
  const observer = observerFor(site);
  return sampleInstants(interval, stepMinutes).map((time) =>
    positionWithRotation(Rotation_EQJ_HOR(time, observer), time, target),
  );
}

/**
 * The longest contiguous run of `track` samples at or above `minAltitudeDeg`, or `null` when no
 * sample clears it. Length is counted in samples; when two runs tie, the earlier one wins. `peak`
 * is the highest sample of that run (again the earlier one on a tie). The window spans whatever
 * interval the track was sampled over, so callers pass the dark window to get an observing window.
 */
export function bestWindow(track: readonly HorizontalPosition[], minAltitudeDeg: number): BestWindow | null {
  let best: { from: number; to: number } | null = null;
  let runStart = -1;
  for (let i = 0; i <= track.length; i++) {
    const above = i < track.length && track[i].altitudeDeg >= minAltitudeDeg;
    if (above) {
      if (runStart < 0) {
        runStart = i;
      }
      continue;
    }
    if (runStart >= 0) {
      const to = i - 1;
      if (best === null || to - runStart > best.to - best.from) {
        best = { from: runStart, to };
      }
      runStart = -1;
    }
  }
  if (best === null) {
    return null;
  }
  let peak = track[best.from];
  for (let i = best.from + 1; i <= best.to; i++) {
    if (track[i].altitudeDeg > peak.altitudeDeg) {
      peak = track[i];
    }
  }
  return { start: track[best.from].time, end: track[best.to].time, peak };
}
