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

// Observation log (S-06) -------------------------------------------------------------------------

/**
 * Candidate (PRD Open Question 6): subtracted from an already-seen object's score when ordering the
 * ranking (FR-018). It moves the object down gently and never decides whether it clears
 * `MIN_OBJECT_SCORE`, so a seen object is pushed down rather than removed.
 */
export const LOG_PENALTY = 0.15;

/** PRD invariant 4: only entries rated at least this (of 5) count as seen; a 1-2 attempt never demotes. */
export const LOG_PENALTY_MIN_RATING = 3;

// Night outlook (S-04) ----------------------------------------------------------------------------

/** FR-011, invariant 5: nights 1-3 (tonight and the next two) carry a verdict; later nights do not. */
export const VERDICT_NIGHTS = 3;

/**
 * FR-011: the seven-night strip, tonight and the six nights after it. Nights 1..`VERDICT_NIGHTS`
 * carry a verdict; the rest carry a cloud outlook and never a verdict (invariant 5).
 */
export const OUTLOOK_NIGHTS = 7;

/** How far ahead, in nights, the search for the dark window's return looks (a full year and a day). */
export const DARK_RETURN_MAX_NIGHTS = 366;

/**
 * Step of the dark-window return search, nights. The no-darkness season is one contiguous run, and
 * the dark season after it is far longer than this, so checking every seventh night and scanning
 * back through the last step finds the same first night as checking every night.
 */
export const DARK_RETURN_STRIDE_NIGHTS = 7;

// Planets (M-2 S-01) -----------------------------------------------------------------------------

/**
 * Candidate (S-01 planning, M-2, 2026-09-30): the planet window is the part of the night with the sun
 * below this altitude (civil dusk to civil dawn). Planets are bright enough for twilight, so they use
 * neither the Bortle darkness threshold nor the dark window.
 */
export const PLANET_WINDOW_SUN_ALTITUDE_DEG = -6;

/**
 * Candidate (planets-on-tonight review, 2026-09-30): "tonight" rolls over to the evening ahead once the sun
 * rises back above this altitude (`tonightDateFor`), so the night in progress stays "tonight" until civil dawn.
 * Morning-twilight planets, and the log date "Mark observed" prefills, then belong to the night being observed
 * rather than the next one. It matches `PLANET_WINDOW_SUN_ALTITUDE_DEG`, where the planet window ends.
 */
export const TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG = -6;

/**
 * Candidate (S-01 planning, M-2, 2026-09-30): Uranus and Neptune are listed only for a telescope with
 * at least this aperture, mm; below it they are little more than faint dots.
 */
export const ICE_GIANT_MIN_APERTURE_MM = 130;

/**
 * Candidate (S-01 planning, M-2, 2026-09-30): weights of the two planet-score components. Placement is
 * how far the peak altitude sits between the site's minimum altitude (0) and `WELL_PLACED_ALTITUDE_DEG`
 * (1); size is the apparent diameter over `PLANET_SIZE_REFERENCE_ARCSEC`, capped at 1. They sum to 1,
 * so the total stays on a 0-1 scale. The score only orders the planets; there is no bar.
 */
export const PLANET_SCORE_WEIGHTS: Readonly<{ placement: number; size: number }> = {
  placement: 0.6,
  size: 0.4,
};

/**
 * Candidate (S-01 planning, M-2, 2026-09-30): apparent diameter, arcseconds, at which a planet's size
 * component reaches 1.
 */
export const PLANET_SIZE_REFERENCE_ARCSEC = 30;

/** Candidate (S-01 planning, M-2, 2026-09-30): a planet whose peak altitude is below this, degrees, is flagged low. */
export const PLANET_LOW_ALTITUDE_DEG = 20;

/**
 * Candidate (S-01 planning, M-2, 2026-09-30): the useful magnification ceiling is
 * min(`MAX_MAGNIFICATION_PER_MM` × aperture mm, `MAX_MAGNIFICATION`); the planet eyepiece stays at or below it.
 */
export const MAX_MAGNIFICATION_PER_MM = 2;

/** Candidate (S-01 planning, M-2, 2026-09-30): absolute magnification ceiling for the planet eyepiece. */
export const MAX_MAGNIFICATION = 250;

// Moon (M-2 S-02) --------------------------------------------------------------------------------

/** The Moon's phase band, named from its Sun–Moon elongation (`MoonPhase`), so waxing and waning differ. */
export type MoonPhaseBand =
  | "waxing-crescent"
  | "first-quarter"
  | "waxing-gibbous"
  | "full"
  | "waning-gibbous"
  | "last-quarter"
  | "waning-crescent";

/**
 * Candidate (S-02 planning, M-2, 2026-10-01): phase bands by elongation, degrees, `fromDeg` inclusive and
 * `toDeg` exclusive, in order and covering [0, 360) without gaps (0 new, 90 first quarter, 180 full, 270 last
 * quarter). The quarter and full bands are wide because libration moves the terminator by about half a day, so
 * the notes they key are hedged rather than exact (research §4).
 */
export const MOON_PHASE_BANDS: readonly Readonly<{ band: MoonPhaseBand; fromDeg: number; toDeg: number }>[] = [
  { band: "waxing-crescent", fromDeg: 0, toDeg: 80 },
  { band: "first-quarter", fromDeg: 80, toDeg: 110 },
  { band: "waxing-gibbous", fromDeg: 110, toDeg: 165 },
  { band: "full", fromDeg: 165, toDeg: 195 },
  { band: "waning-gibbous", fromDeg: 195, toDeg: 250 },
  { band: "last-quarter", fromDeg: 250, toDeg: 280 },
  { band: "waning-crescent", fromDeg: 280, toDeg: 360 },
];

/**
 * Candidate (S-02 planning, M-2, 2026-10-01): an eyepiece shows the whole Moon when its true field is at least
 * this, degrees. The disc spans at most about 0.56°, so this leaves a margin around it.
 */
export const MOON_WHOLE_DISC_FIELD_DEG = 0.7;

/**
 * Candidate (S-02 planning, M-2, 2026-10-01): a Moon whose peak altitude is below this, degrees, is flagged low.
 * Deliberately above `PLANET_LOW_ALTITUDE_DEG`: the Moon is used at high power along the terminator, where
 * observing guides (Space.com, Sky at Night) advise 30° or more. Its "well" band is 30° up to
 * `WELL_PLACED_ALTITUDE_DEG`.
 */
export const MOON_LOW_ALTITUDE_DEG = 30;

/**
 * Candidate (S-02 planning, M-2, 2026-10-01): below this illuminated fraction, at the peak, the Moon is not
 * listed. A 1-2% sliver deep in bright twilight is not a beginner target; a 2-day crescent (about 4.5%) still is.
 */
export const MOON_MIN_ILLUMINATION = 0.03;

/**
 * Candidate (S-02 planning, M-2, 2026-10-01, user choice): the bright-Moon line (`isBrightMoon`) needs the Moon
 * at least this lit at the dark-window midpoint, together with `BRIGHT_MOON_MIN_UP_FRACTION`.
 */
export const BRIGHT_MOON_MIN_ILLUMINATION = 0.5;

/**
 * Candidate (S-02 planning, M-2, 2026-10-01, user choice): the bright-Moon line also needs the Moon above the
 * horizon for more than this share of the dark window.
 */
export const BRIGHT_MOON_MIN_UP_FRACTION = 0.5;

// Moonlight (moonlight-and-the-verdict) ----------------------------------------------------------

const DARK_SKY_ZENITH_MAG = [21.9, 21.7, 21.4, 20.8, 20.1, 19.3, 18.7, 18.2, 17.8] as const;

/**
 * Candidate (moonlight-and-the-verdict planning, 2026-10-02): moonless zenith sky brightness, V mag/arcsec², by
 * Bortle class 1 → 21.9 down to 9 → 17.8, following the usual SQM-by-Bortle convention. It is the dark sky the
 * Moon's light is added to (`moonlight.ts`); calibrated with `calibration-harness.md` (plan › Calibration).
 */
export const DARK_SKY_ZENITH_MAG_BY_BORTLE: readonly number[] = DARK_SKY_ZENITH_MAG;

export function darkSkyZenithMagForBortle(bortle: number): number {
  requireBortle(bortle);
  return DARK_SKY_ZENITH_MAG[bortle - 1];
}

/**
 * Candidate (moonlight-and-the-verdict planning, 2026-10-02): V-band extinction coefficient, mag per airmass, for
 * the moonlit-sky model (Krisciunas & Schaefer 1991 use 0.172 at Mauna Kea; 0.25 suits a lowland site).
 */
export const EXTINCTION_V = 0.25;

/**
 * Candidate (moonlight-and-the-verdict calibration, 2026-10-02): how much the Moon brightens the sky at an object,
 * in magnitudes, before a sensitivity-1 object's moon component reaches 0. The component is
 * `1 − sensitivity × brightening ÷ this`, clamped to [0, 1].
 */
export const MOONLIGHT_REF_MAG = 1.5;

/**
 * Candidate (moonlight-and-the-verdict calibration, 2026-10-02): how much moonlight hurts each object type, 0-1.
 * Diffuse objects take the full effect; star clusters keep their stars, so they take less; a double star least.
 */
export const MOONLIGHT_SENSITIVITY: Readonly<Record<MessierType, number>> = {
  galaxy: 1,
  nebula: 1,
  "emission-nebula": 1,
  "reflection-nebula": 1,
  "planetary-nebula": 1,
  "supernova-remnant": 1,
  "globular-cluster": 0.6,
  "cluster-with-nebula": 0.6,
  "open-cluster": 0.3,
  asterism: 0.3,
  other: 0.3,
  "double-star": 0.15,
};

export function moonlightSensitivity(type: MessierType): number {
  return MOONLIGHT_SENSITIVITY[type];
}

/**
 * Candidate (moonlight-and-the-verdict calibration, 2026-10-02): a diffuse object is washed out when its effective
 * surface brightness is more than this many magnitudes fainter than the moonlit sky around it.
 */
export const WASHED_OUT_CONTRAST_MAG = 3.5;

/**
 * Candidate (moonlight-and-the-verdict calibration, 2026-10-02): the catalogue's mean surface brightness spreads the
 * light over the whole ellipse; an object's core is brighter by about this much, magnitudes.
 */
export const BRIGHT_CORE_OFFSET_MAG = 1.5;

/**
 * Candidate (moonlight-and-the-verdict calibration, 2026-10-02): objects never washed out whatever the contrast.
 * M16 is typed a nebula, but its bright embedded cluster stays visible under a full Moon.
 */
export const MOONLIGHT_EXEMPT_IDS: readonly string[] = ["M16"];

/** The diffuse types the washed-out rule applies to: every sensitivity-1 type, plus a cluster with nebulosity. */
export const WASHED_OUT_TYPES: readonly MessierType[] = [
  "galaxy",
  "nebula",
  "emission-nebula",
  "reflection-nebula",
  "planetary-nebula",
  "supernova-remnant",
  "cluster-with-nebula",
];

/**
 * Candidate (moonlight-and-the-verdict planning, 2026-10-02): minutes between the Moon-disc states the Moon card's
 * time slider steps through. The elongation changes by about 0.1° in ten minutes, so the terminator moves by well
 * under a pixel on the card's disc between steps.
 */
export const MOON_DISC_STEP_MINUTES = 10;
