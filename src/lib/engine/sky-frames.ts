import { Rotation_EQJ_HOR } from "astronomy-engine";

import { DEFAULT_TRACK_STEP_MINUTES } from "./parameters";
import { sampleInstants } from "./sampling";
import { observerFor, sunAltitudeDeg } from "./sun";
import type { Interval, Site } from "./types";

/**
 * The interactive sky's frames (interactive-sky): per sample instant, the Sun's altitude and the J2000→horizon
 * rotation a browser needs to place any J2000 star vector. Pure: every input is explicit and the same inputs always
 * produce the same numbers.
 */

/** One instant of the sky. */
export interface SkyFrame {
  time: Date;
  /** The Sun's geometric altitude, degrees (`sunAltitudeDeg`). */
  sunAltitudeDeg: number;
  /**
   * The 9 entries of `Rotation_EQJ_HOR(time, observer).rot`, flattened row-major: `rotation[3i + j] = rot[i][j]`.
   * astronomy-engine's `RotateVector` computes out_j = Σ_i rot[i][j]·v_i, so the horizon vector of a J2000 unit
   * vector v is out_j = Σ_i rotation[3i + j]·v_i (HOR frame: x north, y west, z zenith; unrefracted).
   */
  rotation: readonly number[];
}

/**
 * `SkyFrame`s across `interval` every `stepMinutes`, on the same grid as `objectTracks`, `planetTracks` and
 * `moonTrack` (`sampleInstants`, both ends included), so frame `i` and sample `i` of any track are the same instant.
 */
export function skyFrames(site: Site, interval: Interval, stepMinutes = DEFAULT_TRACK_STEP_MINUTES): SkyFrame[] {
  const observer = observerFor(site);
  return sampleInstants(interval, stepMinutes).map((time) => {
    const { rot } = Rotation_EQJ_HOR(time, observer);
    return {
      time,
      sunAltitudeDeg: sunAltitudeDeg(site, time),
      rotation: [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => rot[i][j])),
    };
  });
}
