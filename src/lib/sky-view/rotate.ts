/**
 * J2000 → horizon for the interactive sky (interactive-sky), in the browser: the server sends each frame's
 * `Rotation_EQJ_HOR` matrix flattened as `flat[3i + j] = rot[i][j]`, and astronomy-engine's `RotateVector` computes
 * out_j = Σ_i rot[i][j]·v_i, so out_j = Σ_i flat[3i + j]·v_i here. The HOR frame is x north, y west, z zenith;
 * unrefracted (stars only; bodies come with the engine's refracted tracks).
 *
 * Pure and island-safe: no imports.
 */

export interface HorizonPoint {
  /** Degrees above the horizon, −90 to 90. */
  altDeg: number;
  /** Degrees from north through east, [0, 360). */
  azDeg: number;
}

const DEG = 180 / Math.PI;

/** Where the J2000 unit `vector` stands at frame `frame` of `rotations` (`frameCount × 9`). */
export function rotateToHorizon(
  rotations: readonly number[],
  frame: number,
  vector: readonly [number, number, number],
): HorizonPoint {
  const o = frame * 9;
  const [x, y, z] = vector;
  const north = rotations[o] * x + rotations[o + 3] * y + rotations[o + 6] * z;
  const west = rotations[o + 1] * x + rotations[o + 4] * y + rotations[o + 7] * z;
  const up = rotations[o + 2] * x + rotations[o + 5] * y + rotations[o + 8] * z;
  const length = Math.hypot(north, west, up) || 1;
  const altDeg = Math.asin(Math.max(-1, Math.min(1, up / length))) * DEG;
  const azDeg = (((Math.atan2(-west, north) * DEG) % 360) + 360) % 360;
  return { altDeg, azDeg };
}
