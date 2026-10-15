/**
 * Named home for the PRD's tunable parameters that this engine consumes.
 *
 * Every value below is a CANDIDATE from `context/foundation/prd.md` → Open Questions. They are
 * uncalibrated by design: the PRD records them so the engine can start, and expects them to be
 * revisited once the ranking has been cross-checked against independent references. Nothing
 * downstream should hardcode these numbers.
 */

import type { DeepSkyType } from "@/lib/catalogue";

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
export const LOW_INTEREST_TYPES: readonly DeepSkyType[] = ["double-star", "asterism"];
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
 * `DeepSkyType`, so this file stays free of runtime imports and safe for browser islands.
 */
export const PENALIZED_TYPES_WITHOUT_SURFACE_BRIGHTNESS: readonly DeepSkyType[] = [
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

/**
 * Candidate (S-03, deep-sky-beyond-messier): added to the rank score of a Messier object, so a near-tie
 * goes to the better-known object. Order only: it never enters `score.total`, so it never decides whether
 * an object clears `MIN_OBJECT_SCORE`. Tuned against `calibration.test.ts`.
 */
export const MESSIER_RANK_BONUS = 0.03;

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
export const MOONLIGHT_SENSITIVITY: Readonly<Record<DeepSkyType, number>> = {
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

export function moonlightSensitivity(type: DeepSkyType): number {
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
export const WASHED_OUT_TYPES: readonly DeepSkyType[] = [
  "galaxy",
  "nebula",
  "emission-nebula",
  "reflection-nebula",
  "planetary-nebula",
  "supernova-remnant",
  "cluster-with-nebula",
];

// What to expect (M-3 S-04, what-to-expect) -------------------------------------------------------

/**
 * Candidate (what-to-expect planning, 2026-10-14): the aperture, mm, at which the contrast deficit takes no
 * aperture correction (`expectation.ts`). 150 mm (a 6-inch) is the setting the reference fixture is read at, so the
 * bands are calibrated there and move outward from it.
 */
export const EXPECT_REFERENCE_APERTURE_MM = 150;

/**
 * Candidate (what-to-expect planning, 2026-10-14): how much easier an object is to see, in magnitudes of contrast,
 * per doubling of aperture. A larger aperture takes more magnification at the same exit pupil, and a larger image
 * of the same surface brightness is easier to see; a smaller one shifts the other way.
 */
export const EXPECT_APERTURE_GAIN_MAG = 0.5;

/**
 * Candidate (what-to-expect planning, 2026-10-14): a contrast deficit (object core minus moonless zenith sky, after
 * the aperture correction) below this, magnitudes, is "bright": the object stands clear of the sky and is easy to
 * see straight on.
 */
export const EXPECT_BRIGHT_BELOW = 0.5;

/**
 * Candidate (what-to-expect planning, 2026-10-14): a deficit below this is a "smudge": visible, but only a grey
 * patch with a slightly brighter middle.
 */
export const EXPECT_SMUDGE_BELOW = 1.5;

/**
 * Candidate (what-to-expect planning, 2026-10-14): a deficit below this is "faint": it needs averted vision. At or
 * above it the object is at the "limit" of what the sky allows. It sits under `WASHED_OUT_CONTRAST_MAG` (3.5),
 * where the ranking's own washed-out rule drops an object under the Moon.
 */
export const EXPECT_FAINT_BELOW = 2.5;

/**
 * Candidate (what-to-expect planning, 2026-10-14): an object within this many magnitudes of the telescope's
 * limiting magnitude is never described as better than "faint", whatever its surface brightness says: a point-like
 * object that close to the limit needs averted vision.
 */
export const EXPECT_NEAR_LIMIT_MAG = 1;

/**
 * Candidate (what-to-expect planning, 2026-10-14): a planetary nebula smaller than this, arcminutes, is star-like
 * at low power. Half an arcminute is about the size at which a small telescope's eye stops telling a disc from a
 * star at the usual finding power.
 */
export const EXPECT_STARLIKE_ARCMIN = 0.5;

/**
 * Candidate (what-to-expect planning, 2026-10-14): a globular cluster shows its edge as pinpoints ("resolved") from
 * this aperture, mm. Published guides put the first resolved edge stars of M13 at 4-4.5 inches and a clear, steady
 * edge at 6 inches (Starlust, Astronomy magazine).
 */
export const EXPECT_RESOLVE_APERTURE_MM = 150;

/**
 * Candidate (what-to-expect planning, 2026-10-14, reference calibration): a globular cluster is resolved only when its
 * magnitude is at least this many magnitudes brighter than the telescope's limiting magnitude at the site, so the bar
 * rises with aperture and falls with a brighter sky. 5.75 reproduces a fixed magnitude of 7 at 150 mm under Bortle 4
 * (limit 12.75), where M13 and M3 resolve, and lets M56 (8.4, "8 inches or larger" in the guides) reach "grainy" at 200
 * mm.
 */
export const EXPECT_RESOLVE_MARGIN_MAG = 5.75;

/**
 * Candidate (what-to-expect planning, 2026-10-14): a globular cluster looks "grainy", edges about to break into
 * stars, from this aperture, mm.
 */
export const EXPECT_GRAINY_APERTURE_MM = 100;

/**
 * Candidate (what-to-expect planning, 2026-10-14, reference calibration): a globular cluster can look grainy when it is
 * at least this many magnitudes brighter than the telescope's limiting magnitude. 4.75 is a fixed magnitude of 8 at 150
 * mm under Bortle 4; M56 (8.4) falls just inside it at 200 mm, where the guides first report hints of stars and a
 * ragged, grainy view.
 */
export const EXPECT_GRAINY_MARGIN_MAG = 4.75;

/**
 * Candidate (what-to-expect planning, 2026-10-14): an open cluster at least this wide, arcminutes, is bigger than
 * most eyepiece fields at useful power (the Pleiades are 150 arcminutes across in the catalogue).
 */
export const EXPECT_WIDE_ARCMIN = 60;

/**
 * Candidate (what-to-expect planning, 2026-10-14): an open cluster no wider than this, arcminutes, reads as a
 * compact knot rather than a scattered group.
 */
export const EXPECT_COMPACT_ARCMIN = 10;

/**
 * Candidate (what-to-expect planning, 2026-10-14, reference calibration): a planetary nebula at least this wide,
 * arcminutes, can be too large for its surface brightness to read as a crisp disc (the Helix, 16 arcminutes; the Owl,
 * 3.6). The Dumbbell (6.7) is wider than this too but bright enough to stay a disc: see
 * `EXPECT_LARGE_PLANETARY_DISC_BELOW`.
 */
export const EXPECT_LARGE_PLANETARY_ARCMIN = 3;

/**
 * Candidate (what-to-expect planning, 2026-10-14, reference calibration): a large planetary nebula
 * (`EXPECT_LARGE_PLANETARY_ARCMIN`) keeps the "crisp disc" phrase only when its contrast deficit is below this,
 * magnitudes (its core stands this far clear of the sky); otherwise it is faint. -1.5 sits between the Dumbbell (-2.1
 * at 150 mm, Bortle 4) and the Owl (-1.0), which Starlust and Skyhound call indistinct in a 6-inch because of its low
 * surface brightness.
 */
export const EXPECT_LARGE_PLANETARY_DISC_BELOW = -1.5;

/**
 * Candidate (what-to-expect planning, 2026-10-14, reference calibration): a cluster with nebulosity this bright or
 * brighter, V mag, is a bright nebula whatever the sky: it is visible to the naked eye even from city centres
 * (Telescope Advisor), so a city sky does not turn M42 into a faint haze. Only M42 is this bright of its type.
 */
export const EXPECT_BRIGHT_NEBULA_MAX_VMAG = 4.5;

/**
 * Candidate (what-to-expect planning, 2026-10-14, reference calibration): a galaxy is "bright", easy straight on, only
 * when it is at least this many magnitudes brighter than the telescope's limiting magnitude; a galaxy closer to the
 * limit with a high surface brightness is still just a smudge. 5 separates M81 (5.8 below the limit at 150 mm, Bortle
 * 4, "a large bright oval, core sharply defined") from M51 (4.4, "a large, round, hazy spot with a slightly brighter
 * centre", Skyhound).
 */
export const EXPECT_BRIGHT_GALAXY_MARGIN_MAG = 5;

/**
 * Candidate (what-to-expect planning, 2026-10-14, reference calibration): an emission or other nebula at least this
 * wide, arcminutes, is never "bright", whatever its core: its light is spread over many fields of view (NGC 7000 is 120
 * arcminutes and "cannot be seen with the unaided eye" for its low surface brightness).
 */
export const EXPECT_HUGE_NEBULA_ARCMIN = 100;

/**
 * OpenNGC `Hubble` types of the bulge-type spirals, a concentrated bulge on a flatter disc (small-scope-galaxies
 * planning, 2026-10-15, owner decision OD-3 a: every bulge-type spiral, not an M31-only exception): S0 to Sb, plain
 * (`S`), intermediate (`SAB`) and barred (`SB`), exact strings as OpenNGC writes them (the pinned commit has these
 * twelve among the catalogue's galaxies). Ellipticals, the Sbc and later spirals and the irregulars are not in it:
 * the flat `BRIGHT_CORE_OFFSET_MAG` fits a disc-dominated galaxy (M33, M101, NGC 2403), and a blanket elliptical
 * term would brighten the low-surface-brightness dwarfs (NGC 4889 is already a known divergence in that direction).
 * `contrast.test.ts` fails when a catalogue galaxy's `hubble` is neither in this list nor in the test's explicit
 * disc-or-other list, so a new OpenNGC value after a pin bump is classed on purpose.
 */
export const BULGE_HUBBLE_TYPES: readonly string[] = [
  "S0",
  "S0-a",
  "E-S0",
  "Sa",
  "SABa",
  "SBa",
  "Sab",
  "SABab",
  "SBab",
  "Sb",
  "SABb",
  "SBb",
];

/**
 * Candidate (small-scope-galaxies planning, 2026-10-15, source-cited reference calibration, owner decision OD-2 a):
 * how many magnitudes brighter than the flat core (`BRIGHT_CORE_OFFSET_MAG`) a bulge-type spiral's core is, for the
 * contrast deficit of the expectation line and the ranking's brightness credit. 0.8 sits in the scanned window
 * (0.762, 0.862] set by two references at 60 mm: M31 reads `galaxySmudge` at Bortle 5 and 6 and `galaxyFaint` at
 * Bortle 8 (Telescope Advisor, Astronomy, Skyhound). The lower edge is the Bortle 8 entry (M31 60 mm / B8: at
 * 0.762 its deficit is exactly the `limit` threshold 2.5), the upper edge the Bortle 5 entry (M31 60 mm / B5: at
 * 0.862 its deficit falls below `EXPECT_BRIGHT_BELOW`). Margins at 0.8: 0.062 to the Bortle 5 edge (M31 60 mm / B5,
 * deficit 0.562) and 0.038 to the Bortle 8 edge (M31 60 mm / B8, deficit 2.462). Any change to the Bortle table or
 * to M31's catalogue data will flip one of those two references, loudly. The disc-type galaxies (M33, M101) stay on
 * the flat offset, which the 150 mm references calibrate; 0.8 leaves M31 at 150 mm / Bortle 4 `galaxyBright`.
 */
export const EXPECT_BULGE_CORE_EXTRA_MAG = 0.8;

/**
 * Candidate (moonlight-and-the-verdict planning, 2026-10-02): minutes between the Moon-disc states the Moon card's
 * time slider steps through. The elongation changes by about 0.1° in ten minutes, so the terminator moves by well
 * under a pixel on the card's disc between steps.
 */
export const MOON_DISC_STEP_MINUTES = 10;

// Finder chart (M-3 S-03, finder-chart) -----------------------------------------------------------

/**
 * Candidate (S-03 planning, finder-chart, 2026-10-11, owner-confirmed O-1): the true field of the standard finder
 * (a 6×30), degrees, for every telescope. Published 6×30 fields run 7-7.5° (iOptron, telescoop.nl), 8° (Takahashi).
 */
export const FINDER_FIELD_DEG = 7;

/** Candidate (S-03 planning, 2026-10-11): aperture of the standard finder, mm; it sets the finder's limiting magnitude. */
export const FINDER_APERTURE_MM = 30;

/**
 * Candidate (S-03 planning, 2026-10-11, O-1): diameters, degrees, of the 1× reflex finder's rings (a Telrad's
 * 0.5°, 2° and 4°), drawn around the target on the finder panel.
 */
export const REFLEX_RING_DEG: readonly number[] = [0.5, 2, 4];

/** Candidate (S-03 planning, 2026-10-11, D-2): the faintest star the finder chart draws; HYG is evenly complete to about 7.5. */
export const FINDER_CHART_MAX_MAG = 7.5;

/**
 * Candidate (S-03 planning, 2026-10-11, PRD Open Question 15): the faintest star the chart may start a hop from, by
 * Bortle class: 4.5 at 1-4, 3.5 at 5-6, 2.5 at 7-9. Kept apart from `nakedEyeLimitingMagForBortle`, which it never
 * exceeds: a start must be a star the user recognises, not one at the edge of what they can see.
 */
export function startStarMaxMagForBortle(bortle: number): 4.5 | 3.5 | 2.5 {
  requireBortle(bortle);
  if (bortle <= 4) {
    return 4.5;
  }
  if (bortle <= 6) {
    return 3.5;
  }
  return 2.5;
}

/**
 * Candidate (S-03 planning, 2026-10-11, D-5): the faintest star the finder shows, by Bortle class: the naked-eye
 * limit plus the finder's gain, 5·log10(`FINDER_APERTURE_MM` ÷ `EYE_PUPIL_REFERENCE_MM`), capped at
 * `FINDER_CHART_MAX_MAG`. 7.2 at Bortle 9 up to 7.5.
 */
export function finderLimitingMagForBortle(bortle: number): number {
  return Math.min(
    FINDER_CHART_MAX_MAG,
    nakedEyeLimitingMagForBortle(bortle) + 5 * Math.log10(FINDER_APERTURE_MM / EYE_PUPIL_REFERENCE_MM),
  );
}

/** Candidate (S-03 planning, 2026-10-11, D-4, PRD Open Question 16): the faintest star a hop may pass through. */
export const HOP_STAR_MAX_MAG = 6.5;

/**
 * Candidate (S-03 planning, 2026-10-11, D-4): the longest single step of a hop, as a share of `FINDER_FIELD_DEG`, so
 * both ends of a step sit in the finder at once (mirrors `FOV_FIT_FRACTION`): 5.6° for the standard finder.
 */
export const HOP_MAX_STEP_FRACTION = 0.8;

/** Candidate (S-03 planning, 2026-10-11, D-4): the most steps a hop may take, the last one onto the target. */
export const HOP_MAX_STEPS = 8;

/**
 * Candidate (S-03 planning, 2026-10-11, O-7): how many of the nearest qualifying starting stars are tried before the
 * chart falls back to a direct line from the nearest.
 */
export const START_STAR_CANDIDATES = 5;

/** Candidate (S-03 planning, 2026-10-11, O-3): the width of the finder panel around the target, degrees. */
export const FINDER_PANEL_FIELD_DEG = 10;

/**
 * Candidate (S-03 planning, 2026-10-11, review F1, O-2): when a panel's centre is at or above this altitude, or the
 * zenith falls inside a panel, "up" would swing wildly with a small move, so the chart goes north up instead.
 */
export const FINDER_OVERHEAD_ALT_DEG = 80;

// Sky events (M-3 S-07) --------------------------------------------------------------------------

/** Candidate (S-07 planning, M-3, 2026-10-13): how many observing nights the events list covers, from the selected night. */
export const EVENT_WINDOW_NIGHTS = 30;

/**
 * Candidate (S-07 planning, M-3, 2026-10-13, owner decision 3): an event is visible only while its body is at or
 * above this altitude, degrees (about one fist at arm's length). Every kind but eclipses uses it.
 */
export const EVENT_MIN_ALTITUDE_DEG = 10;

/**
 * Candidate (S-07 planning, M-3, 2026-10-13, owner, plan review F2): an eclipse is visible from this altitude up,
 * degrees. Eclipses are rare enough to be worth a low horizon: between this and `EVENT_MIN_ALTITUDE_DEG` the event
 * is visible but carries `lowHorizon` ("low, needs an open horizon").
 */
export const ECLIPSE_MIN_ALTITUDE_DEG = 2;

/**
 * Candidate (S-07 planning, M-3, 2026-10-13): twilight bound for night events, degrees: a night event counts only
 * while the sun is at or below this. It is the planet window's bound, civil dusk to civil dawn.
 */
export const EVENT_SUN_MAX_ALTITUDE_DEG = PLANET_WINDOW_SUN_ALTITUDE_DEG;

/**
 * Candidate (S-07 planning, M-3, 2026-10-13): the sun altitude, degrees, that defines "the night's dark window" for
 * events when the caller does not pass the site's own darkness threshold: astronomical darkness, the Bortle 1-4 value
 * of `darknessThresholdDegForBortle`. Where the sun never gets that low the event uses the
 * `EVENT_SUN_MAX_ALTITUDE_DEG` span and is flagged `shortNight`.
 */
export const EVENT_DARK_SUN_ALTITUDE_DEG = -18;

/** Candidate (S-07 planning, M-3, 2026-10-13, owner decision 2): a pairing is "close" up to this separation, degrees. */
export const PAIRING_MAX_SEPARATION_DEG = 5;

/**
 * Candidate (S-07 planning, M-3, 2026-10-13): a shower's peak night is flagged "bright Moon" when the Moon's
 * illuminated fraction is at least this and it is up during the dark window.
 */
export const METEOR_BRIGHT_MOON_FRACTION = 0.5;
