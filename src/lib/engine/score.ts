import type { DeepSkyObject } from "@/lib/catalogue";

import { contrastBand, telescopeLimitingMag } from "./contrast";
import type { ContrastBand } from "./contrast";
import type { MoonState } from "./moon";
import { effectiveSurfaceBrightness, moonBrighteningMag, nlToMag, skyBrightnessNL } from "./moonlight";
import { refinedWindow } from "./objects";
import type { BestWindow } from "./objects";
import {
  BRIGHTNESS_RAMP_MAG,
  EXTINCTION_V,
  GALAXY_FAINT_BRIGHTNESS_CAP,
  GALAXY_LIMIT_BRIGHTNESS_CAP,
  LOW_INTEREST_PENALTY,
  LOW_INTEREST_TYPES,
  MIN_OBJECT_SCORE,
  MOONLIGHT_EXEMPT_IDS,
  MOONLIGHT_REF_MAG,
  PENALIZED_TYPES_WITHOUT_SURFACE_BRIGHTNESS,
  SCORE_WEIGHTS,
  SURFACE_BRIGHTNESS_PENALTY_THRESHOLD,
  WASHED_OUT_CONTRAST_MAG,
  WASHED_OUT_TYPES,
  WELL_PLACED_ALTITUDE_DEG,
  bortlePenaltyForBortle,
  darkSkyZenithMagForBortle,
  moonlightSensitivity,
} from "./parameters";
import type { HorizontalPosition } from "./types";

// The one definition lives in `contrast.ts` (it needs it for its near-limit floor); kept here for existing imports.
export { telescopeLimitingMag };

/**
 * The object score (PRD Open Question 1): four components on a 0-1 scale and their weighted total.
 * Pure: it reads only precomputed tracks and plain inputs, so the ranking can score the whole
 * catalogue from one pass of `objectTracks` and `moonTrack`.
 */

/** The four score components, in the order that breaks ties when picking a reason. */
export const SCORE_COMPONENTS = ["duration", "moon", "brightness", "sky"] as const;

export type ScoreComponent = (typeof SCORE_COMPONENTS)[number];

export type ScoreComponents = Record<ScoreComponent, number>;

/**
 * What the score needs about a catalogue object. `DeepSkyObject` is assignable to it. `id` is checked against
 * `MOONLIGHT_EXEMPT_IDS`; the axes give the washed-out rule its surface brightness.
 */
export type ScoredObject = Pick<
  DeepSkyObject,
  "id" | "vMag" | "surfaceBrightness" | "type" | "majorAxisArcmin" | "minorAxisArcmin" | "hubble"
>;

export interface ScoreInput {
  object: ScoredObject;
  /** The object's track over the dark window. */
  track: readonly HorizontalPosition[];
  /** The Moon's track over the same interval and step, so `moonTrack[i]` is the instant of `track[i]`. */
  moonTrack: readonly Pick<MoonState, "altitudeDeg" | "phaseAngleDeg">[];
  /** The Moon–object separation in degrees at each instant of `track` (`moonSeparationsDeg`). */
  moonSeparationsDeg: readonly number[];
  minAltitudeDeg: number;
  bortle: number;
  apertureMm: number;
}

export interface ObjectScore {
  window: BestWindow;
  components: ScoreComponents;
  total: number;
  /**
   * Tonight's Moon hides this object (moonlight-and-the-verdict): a diffuse object whose bright core is lost in the
   * moonlit sky at every best-window sample, that the moonless sky alone would not hide, and that would clear
   * `MIN_OBJECT_SCORE` on a moonless night. The ranking lists it apart, never as a recommendation.
   */
  washedOut: boolean;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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
 * `window` holds the true crossings of `minAltitudeDeg` (`refinedWindow`); every component below is computed over the
 * window's grid samples, so the edges' refinement leaves each of them unchanged.
 *
 * - `duration`: altitude-weighted share of the dark window: each best-window sample counts by how
 *   far it sits between `minAltitudeDeg` (0) and `WELL_PLACED_ALTITUDE_DEG` (1), summed and divided
 *   by the samples in the track.
 * - `moon`: the mean over best-window samples of `1 − sensitivity(type) × m_b ÷ MOONLIGHT_REF_MAG`, clamped to
 *   [0, 1], where `m_b` is how much the Moon brightens the sky at the object (`moonBrighteningMag`): one scale for
 *   every object, so a cluster beside a bright Moon and a galaxy far from a thin one compare fairly.
 * - `brightness`: how far the object's magnitude is inside the telescope's limiting magnitude,
 *   ramped over `BRIGHTNESS_RAMP_MAG` and clamped to [0, 1]; for a galaxy, no more than its contrast band allows
 *   (`GALAXY_FAINT_BRIGHTNESS_CAP`, `GALAXY_LIMIT_BRIGHTNESS_CAP`).
 * - `sky`: 1 − the Bortle penalty for a low-surface-brightness object (or, with no surface
 *   brightness, a penalized type).
 *
 * `total` is the weighted sum, less `LOW_INTEREST_PENALTY` for a `LOW_INTEREST_TYPES` object,
 * floored at 0. `washedOut` is described on `ObjectScore`.
 */
export function scoreObject(input: ScoreInput): ObjectScore | null {
  const { object, track, moonTrack, moonSeparationsDeg, minAltitudeDeg, bortle, apertureMm } = input;
  if (moonTrack.length !== track.length || moonSeparationsDeg.length !== track.length) {
    throw new RangeError(
      `scoreObject: moon track has ${moonTrack.length} samples and ${moonSeparationsDeg.length} separations, ` +
        `object track ${track.length}; they must share a grid`,
    );
  }
  const limitingMag = telescopeLimitingMag(bortle, apertureMm);
  if (object.vMag > limitingMag) {
    return null;
  }
  const refined = refinedWindow(track, minAltitudeDeg);
  if (refined === null) {
    return null;
  }
  // The score reads the window's samples (the grid run), the answer carries its true edges: refining an edge never
  // moves a component.
  const { firstIndex: from, lastIndex: to } = refined;
  const window: BestWindow = { start: refined.start, end: refined.end, peak: refined.peak };
  const windowSamples = to - from + 1;

  const span = Math.max(WELL_PLACED_ALTITUDE_DEG - minAltitudeDeg, Number.EPSILON);
  const sensitivity = moonlightSensitivity(object.type);
  const darkZenithMag = darkSkyZenithMagForBortle(bortle);
  const coreMag = washedOutCandidate(object) ? effectiveSurfaceBrightness(object) : null;
  let placed = 0;
  let moonSum = 0;
  // The washed-out rule: lost in the moonlit sky at every sample, and visible against the moonless one at some.
  let lostThroughout = coreMag !== null;
  let visibleWithoutMoon = false;
  for (let i = from; i <= to; i++) {
    placed += clamp01((track[i].altitudeDeg - minAltitudeDeg) / span);
    const sky = skyBrightnessNL({
      moonPhaseAngleDeg: moonTrack[i].phaseAngleDeg,
      moonAltitudeDeg: moonTrack[i].altitudeDeg,
      objectAltitudeDeg: track[i].altitudeDeg,
      separationDeg: moonSeparationsDeg[i],
      darkZenithMag,
      extinction: EXTINCTION_V,
    });
    moonSum += clamp01(1 - (sensitivity * moonBrighteningMag(sky)) / MOONLIGHT_REF_MAG);
    if (coreMag !== null) {
      if (!(coreMag - nlToMag(sky.darkNL + sky.moonNL) > WASHED_OUT_CONTRAST_MAG)) {
        lostThroughout = false;
      }
      if (coreMag - nlToMag(sky.darkNL) <= WASHED_OUT_CONTRAST_MAG) {
        visibleWithoutMoon = true;
      }
    }
  }

  const components: ScoreComponents = {
    duration: placed / track.length,
    moon: moonSum / windowSamples,
    brightness: brightnessOf(object, limitingMag, bortle, apertureMm),
    sky: 1 - skyPenalty(object, bortle),
  };
  const total = totalOf(object, components);
  // Only the Moon's fault: the same night without the Moon would have listed it.
  const washedOut =
    lostThroughout && visibleWithoutMoon && totalOf(object, { ...components, moon: 1 }) >= MIN_OBJECT_SCORE;
  return { window, components, total, washedOut };
}

/** The most brightness credit each contrast band allows a galaxy (`contrastBand`): the line and the credit agree. */
function galaxyBrightnessCap(band: ContrastBand): number {
  switch (band) {
    case "bright":
    case "smudge":
      return 1;
    case "faint":
      return GALAXY_FAINT_BRIGHTNESS_CAP;
    case "limit":
      return GALAXY_LIMIT_BRIGHTNESS_CAP;
  }
}

/**
 * The headroom ramp: how far the object's magnitude is inside the telescope's limiting magnitude. A galaxy gets no
 * more than its contrast band allows (small-scope-galaxies): the band is read after the near-limit floor, so the cap
 * never rises at a worse sky and never falls at a larger aperture.
 */
function brightnessOf(object: ScoredObject, limitingMag: number, bortle: number, apertureMm: number): number {
  const ramp = clamp01((limitingMag - object.vMag) / BRIGHTNESS_RAMP_MAG);
  return object.type === "galaxy"
    ? Math.min(ramp, galaxyBrightnessCap(contrastBand(object, bortle, apertureMm)))
    : ramp;
}

/** The weighted components less the low-interest penalty, floored at 0. */
function totalOf(object: ScoredObject, components: ScoreComponents): number {
  const weighted = SCORE_COMPONENTS.reduce((sum, c) => sum + SCORE_WEIGHTS[c] * components[c], 0);
  return Math.max(0, weighted - (LOW_INTEREST_TYPES.includes(object.type) ? LOW_INTEREST_PENALTY : 0));
}

/** A diffuse, non-exempt object: the only kind the washed-out rule applies to. */
function washedOutCandidate(object: ScoredObject): boolean {
  return WASHED_OUT_TYPES.includes(object.type) && !MOONLIGHT_EXEMPT_IDS.includes(object.id);
}
