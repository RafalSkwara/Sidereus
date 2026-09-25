import type { MessierObject } from "@/lib/catalogue";

import type { MoonState } from "./moon";
import { bestWindow } from "./objects";
import type { BestWindow } from "./objects";
import {
  BRIGHTNESS_RAMP_MAG,
  EYE_PUPIL_REFERENCE_MM,
  LOW_INTEREST_PENALTY,
  LOW_INTEREST_TYPES,
  PENALIZED_TYPES_WITHOUT_SURFACE_BRIGHTNESS,
  SCORE_WEIGHTS,
  SURFACE_BRIGHTNESS_PENALTY_THRESHOLD,
  WELL_PLACED_ALTITUDE_DEG,
  bortlePenaltyForBortle,
  nakedEyeLimitingMagForBortle,
} from "./parameters";
import type { HorizontalPosition } from "./types";

/**
 * The object score (PRD Open Question 1): four components on a 0-1 scale and their weighted total.
 * Pure: it reads only precomputed tracks and plain inputs, so the ranking can score the whole
 * catalogue from one pass of `objectTracks` and `moonTrack`.
 */

/** The four score components, in the order that breaks ties when picking a reason. */
export const SCORE_COMPONENTS = ["duration", "moon", "brightness", "sky"] as const;

export type ScoreComponent = (typeof SCORE_COMPONENTS)[number];

export type ScoreComponents = Record<ScoreComponent, number>;

/** What the score needs about a catalogue object. `MessierObject` is assignable to it. */
export type ScoredObject = Pick<MessierObject, "vMag" | "surfaceBrightness" | "type">;

export interface ScoreInput {
  object: ScoredObject;
  /** The object's track over the dark window. */
  track: readonly HorizontalPosition[];
  /** The Moon's track over the same interval and step, so `moonTrack[i]` is the instant of `track[i]`. */
  moonTrack: readonly Pick<MoonState, "altitudeDeg" | "illuminatedFraction">[];
  minAltitudeDeg: number;
  bortle: number;
  apertureMm: number;
}

export interface ObjectScore {
  window: BestWindow;
  components: ScoreComponents;
  total: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Index of the sample at `time` within `track[from..]`; the window's samples come from the track itself. */
function indexOfTime(track: readonly HorizontalPosition[], time: Date, from: number): number {
  const ms = time.getTime();
  for (let i = from; i < track.length; i++) {
    if (track[i].time.getTime() === ms) {
      return i;
    }
  }
  throw new Error("scoreObject: window instant is not a sample of the track");
}

/** Limiting magnitude through the telescope: naked-eye limit for the sky plus the aperture's gain. */
export function telescopeLimitingMag(bortle: number, apertureMm: number): number {
  return nakedEyeLimitingMagForBortle(bortle) + 5 * Math.log10(apertureMm / EYE_PUPIL_REFERENCE_MM);
}

function skyPenalty(object: ScoredObject, bortle: number): number {
  const penalized =
    object.surfaceBrightness === null
      ? PENALIZED_TYPES_WITHOUT_SURFACE_BRIGHTNESS.includes(object.type)
      : object.surfaceBrightness > SURFACE_BRIGHTNESS_PENALTY_THRESHOLD;
  return penalized ? bortlePenaltyForBortle(bortle) : 0;
}

/**
 * Scores one object's night, or returns `null` when it never clears `minAltitudeDeg` during the
 * dark window, or when it is fainter than the telescope's limiting magnitude (such an object is
 * physically impossible to see, so it never ranks).
 *
 * - `duration`: altitude-weighted share of the dark window: each best-window sample counts by how
 *   far it sits between `minAltitudeDeg` (0) and `WELL_PLACED_ALTITUDE_DEG` (1), summed and divided
 *   by the samples in the track.
 * - `moon`: 1 − (the Moon's illuminated fraction at the object's peak × the share of best-window
 *   samples with the Moon above the horizon).
 * - `brightness`: how far the object's magnitude is inside the telescope's limiting magnitude,
 *   ramped over `BRIGHTNESS_RAMP_MAG` and clamped to [0, 1].
 * - `sky`: 1 − the Bortle penalty for a low-surface-brightness object (or, with no surface
 *   brightness, a penalized type).
 *
 * `total` is the weighted sum, less `LOW_INTEREST_PENALTY` for a `LOW_INTEREST_TYPES` object,
 * floored at 0.
 */
export function scoreObject(input: ScoreInput): ObjectScore | null {
  const { object, track, moonTrack, minAltitudeDeg, bortle, apertureMm } = input;
  if (moonTrack.length !== track.length) {
    throw new RangeError(
      `scoreObject: moon track has ${moonTrack.length} samples, object track ${track.length}; they must share a grid`,
    );
  }
  const limitingMag = telescopeLimitingMag(bortle, apertureMm);
  if (object.vMag > limitingMag) {
    return null;
  }
  const window = bestWindow(track, minAltitudeDeg);
  if (window === null) {
    return null;
  }
  const from = indexOfTime(track, window.start, 0);
  const to = indexOfTime(track, window.end, from);
  const peakIndex = indexOfTime(track, window.peak.time, from);
  const windowSamples = to - from + 1;

  const span = Math.max(WELL_PLACED_ALTITUDE_DEG - minAltitudeDeg, Number.EPSILON);
  let moonUp = 0;
  let placed = 0;
  for (let i = from; i <= to; i++) {
    if (moonTrack[i].altitudeDeg > 0) {
      moonUp++;
    }
    placed += clamp01((track[i].altitudeDeg - minAltitudeDeg) / span);
  }

  const components: ScoreComponents = {
    duration: placed / track.length,
    moon: clamp01(1 - moonTrack[peakIndex].illuminatedFraction * (moonUp / windowSamples)),
    brightness: clamp01((limitingMag - object.vMag) / BRIGHTNESS_RAMP_MAG),
    sky: 1 - skyPenalty(object, bortle),
  };
  const weighted = SCORE_COMPONENTS.reduce((sum, c) => sum + SCORE_WEIGHTS[c] * components[c], 0);
  const total = Math.max(0, weighted - (LOW_INTEREST_TYPES.includes(object.type) ? LOW_INTEREST_PENALTY : 0));
  return { window, components, total };
}
