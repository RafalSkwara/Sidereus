/**
 * Named home for the PRD's tunable parameters that this engine consumes.
 *
 * Every value below is a CANDIDATE from `context/foundation/prd.md` → Open Questions. They are
 * uncalibrated by design: the PRD records them so the engine can start, and expects them to be
 * revisited once the ranking has been cross-checked against independent references. Nothing
 * downstream should hardcode these numbers.
 */

import type { MessierType } from "@/lib/catalogue";

/** Throws `RangeError` unless `bortle` is an integer Bortle class 1..9. */
function requireBortle(bortle: number): void {
  if (!Number.isInteger(bortle) || bortle < 1 || bortle > 9) {
    throw new RangeError(`Bortle class must be an integer 1..9, got ${bortle}`);
  }
}

/**
 * Sun altitude (degrees) below which the sky counts as dark, by Bortle class.
 * Candidate (PRD Open Question 7): -18 for Bortle 1-4, -15 for 5-6, -12 for 7-9.
 */
export function darknessThresholdDegForBortle(bortle: number): -18 | -15 | -12 {
  requireBortle(bortle);
  if (bortle <= 4) {
    return -18;
  }
  if (bortle <= 6) {
    return -15;
  }
  return -12;
}

/** Candidate (PRD Open Question 9): altitude agreement with the planetarium reference, degrees. */
export const ALTITUDE_TOLERANCE_DEG = 1;

/** Candidate (PRD Open Question 9): timing agreement with the planetarium reference, minutes. */
export const TIME_TOLERANCE_MINUTES = 5;

/** Candidate: sampling step for altitude tracks over a night, minutes. Coarsen before optimising code. */
export const DEFAULT_TRACK_STEP_MINUTES = 10;

/**
 * Candidate (PRD Open Question 8): default minimum altitude for a new site, degrees. Objects below it
 * are treated as hidden by the horizon. The `sites.min_altitude_deg` column default and the site
 * form's initial value match it. Islands import it from `@/lib/engine/parameters` directly (this file
 * has no runtime imports), never from the `@/lib/engine` barrel, which pulls in astronomy-engine.
 */
export const DEFAULT_MIN_ALTITUDE_DEG = 15;

// Object score, ranking and eyepiece pairing (S-02) ----------------------------------------------

/**
 * Candidate (PRD Open Question 1): weights of the four object-score components. They sum to 1, so
 * the weighted total stays on the 0-1 scale of each component.
 */
export const SCORE_WEIGHTS: Readonly<{ duration: number; moon: number; brightness: number; sky: number }> = {
  duration: 0.35,
  moon: 0.3,
  brightness: 0.25,
  sky: 0.1,
};

/** Candidate (PRD Open Question 3): minimum object score, 0-1, for an object to be listed. */
export const MIN_OBJECT_SCORE = 0.45;

/** FR-013: the ranking lists at most this many objects. */
export const MAX_RANKED_OBJECTS = 5;

/** Candidate (PRD Open Question 4): largest useful exit pupil, mm, for the finding eyepiece. */
export const EXIT_PUPIL_CEILING_MM = 5.5;

/** Candidate (PRD Open Question 4): smallest useful exit pupil, mm, for the detail eyepiece. */
export const EXIT_PUPIL_FLOOR_MM = 0.7;

/**
 * Candidate (S-02 planning, 2026-09-25): an object fits an eyepiece when its major axis is at most
 * this share of the eyepiece's true field of view, leaving room to frame it.
 */
export const FOV_FIT_FRACTION = 0.8;

const NAKED_EYE_LIMITING_MAG = [7.6, 7.1, 6.6, 6.1, 5.6, 5.1, 4.6, 4.3, 4.0] as const;

/**
 * Candidate (S-02 planning, 2026-09-25): naked-eye limiting magnitude by Bortle class, 1 → 7.6
 * down to 9 → 4.0. The telescope's gain is added on top (see `EYE_PUPIL_REFERENCE_MM`).
 */
export function nakedEyeLimitingMagForBortle(bortle: number): number {
  requireBortle(bortle);
  return NAKED_EYE_LIMITING_MAG[bortle - 1];
}

/**
 * Candidate (S-02 planning, 2026-09-25): dark-adapted eye pupil, mm. A telescope's limiting
 * magnitude gain is 5·log10(aperture ÷ this).
 */
export const EYE_PUPIL_REFERENCE_MM = 7;

/**
 * Candidate (S-02 planning, 2026-09-25): magnitudes above the limiting magnitude over which the
 * brightness component ramps from 0 (at the limit) to 1 (this much brighter).
 */
export const BRIGHTNESS_RAMP_MAG = 8;

/**
 * Candidate (S-02 Phase 1 calibration, 2026-09-25): altitude at which an object counts as fully
 * well placed. The duration component credits each best-window sample by how far it sits between
 * the site's minimum altitude (0) and this altitude (1), so a long pass near the horizon no longer
 * scores like a long pass overhead.
 */
export const WELL_PLACED_ALTITUDE_DEG = 40;

/**
 * Candidate (S-02 Phase 1 calibration, 2026-09-25): object types a beginner rarely finds rewarding
 * (M40 is a faint double star, M73 an asterism), and the amount subtracted from their total.
 */
export const LOW_INTEREST_TYPES: readonly MessierType[] = ["double-star", "asterism"];
export const LOW_INTEREST_PENALTY = 0.15;

/**
 * Candidate (PRD Open Question 5): surface brightness, mag/arcsec², above which (fainter) an object
 * takes the Bortle penalty.
 */
export const SURFACE_BRIGHTNESS_PENALTY_THRESHOLD = 21;

/**
 * Candidate (PRD Open Question 5): the sky-component penalty for a low-surface-brightness object by
 * Bortle class: 0 at Bortle 1-2, rising linearly to 0.40 at Bortle 8, and 0.40 at Bortle 9.
 */
export function bortlePenaltyForBortle(bortle: number): number {
  requireBortle(bortle);
  if (bortle <= 2) {
    return 0;
  }
  if (bortle >= 8) {
    return 0.4;
  }
  return (0.4 * (bortle - 2)) / 6;
}

/**
 * Candidate (PRD Open Question 5, fallback): object types that take the Bortle penalty when the
 * catalogue has no surface brightness for them (galaxies and diffuse nebulae). Type-only import of
 * `MessierType`, so this file stays free of runtime imports and safe for browser islands.
 */
export const PENALIZED_TYPES_WITHOUT_SURFACE_BRIGHTNESS: readonly MessierType[] = [
  "galaxy",
  "nebula",
  "emission-nebula",
  "reflection-nebula",
  "supernova-remnant",
];

/**
 * Candidate (PRD Open Question 2): verdict cloud thresholds. Go needs a contiguous run of at least
 * `goRunHours` below `goCloudPct` cloud within the dark window; marginal needs `marginalRunHours`
 * below `marginalCloudPct`; otherwise no-go. Humidity above `humidityCapPct` caps the verdict at
 * marginal.
 */
export const VERDICT_THRESHOLDS: Readonly<{
  goCloudPct: number;
  goRunHours: number;
  marginalCloudPct: number;
  marginalRunHours: number;
  humidityCapPct: number;
}> = {
  goCloudPct: 30,
  goRunHours: 2,
  marginalCloudPct: 65,
  marginalRunHours: 1,
  humidityCapPct: 90,
};

// Night outlook (S-04) ----------------------------------------------------------------------------

/** FR-011, invariant 5: nights 1-3 (tonight and the next two) carry a verdict; later nights do not. */
export const VERDICT_NIGHTS = 3;

/** How far ahead, in nights, the search for the dark window's return looks (a full year and a day). */
export const DARK_RETURN_MAX_NIGHTS = 366;

/**
 * Step of the dark-window return search, nights. The no-darkness season is one contiguous run, and
 * the dark season after it is far longer than this, so checking every seventh night and scanning
 * back through the last step finds the same first night as checking every night.
 */
export const DARK_RETURN_STRIDE_NIGHTS = 7;
