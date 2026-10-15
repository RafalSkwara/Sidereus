import type { DeepSkyObject } from "@/lib/catalogue";

import { effectiveSurfaceBrightness } from "./moonlight";
import {
  BULGE_HUBBLE_TYPES,
  EXPECT_APERTURE_GAIN_MAG,
  EXPECT_BRIGHT_BELOW,
  EXPECT_BULGE_CORE_EXTRA_MAG,
  EXPECT_FAINT_BELOW,
  EXPECT_NEAR_LIMIT_MAG,
  EXPECT_REFERENCE_APERTURE_MM,
  EXPECT_SMUDGE_BELOW,
  EYE_PUPIL_REFERENCE_MM,
  darkSkyZenithMagForBortle,
  nakedEyeLimitingMagForBortle,
} from "./parameters";

/**
 * How bright an object's core stands against the sky in a telescope (small-scope-galaxies): the one measure the
 * what-to-expect line (`expectation.ts`) and the ranking's brightness credit (`score.ts`) share, so the reason line
 * and the line cannot disagree. Pure, and a module of its own so that neither of them has to import the other
 * (`expectation.ts` imports `score.ts`).
 */

/**
 * How far an object stands from the sky: `bright` is easy straight on, `limit` is at the edge of the sky's
 * allowance.
 */
export type ContrastBand = "bright" | "smudge" | "faint" | "limit";

export type ContrastObject = Pick<DeepSkyObject, "type" | "vMag" | "majorAxisArcmin" | "minorAxisArcmin" | "hubble">;

/** Limiting magnitude through the telescope: naked-eye limit for the sky plus the aperture's gain. */
export function telescopeLimitingMag(bortle: number, apertureMm: number): number {
  return nakedEyeLimitingMagForBortle(bortle) + 5 * Math.log10(apertureMm / EYE_PUPIL_REFERENCE_MM);
}

/**
 * The surface brightness of an object's bright core, V mag/arcsec²: `effectiveSurfaceBrightness` (the flat core
 * offset), and for a bulge-type spiral (a galaxy whose OpenNGC `hubble` is in `BULGE_HUBBLE_TYPES`)
 * `EXPECT_BULGE_CORE_EXTRA_MAG` brighter still. `null` when the object has no size.
 */
export function coreSurfaceBrightness(object: ContrastObject): number | null {
  const surface = effectiveSurfaceBrightness(object);
  if (surface === null) {
    return null;
  }
  const bulge = object.type === "galaxy" && object.hubble !== null && BULGE_HUBBLE_TYPES.includes(object.hubble);
  return bulge ? surface - EXPECT_BULGE_CORE_EXTRA_MAG : surface;
}

/**
 * The contrast deficit, magnitudes: the object's core surface brightness minus the moonless zenith sky, less the
 * aperture's correction. Positive means the core is fainter than the sky; `null` when the object has no size.
 */
export function contrastDeficit(object: ContrastObject, bortle: number, apertureMm: number): number | null {
  const surface = coreSurfaceBrightness(object);
  if (surface === null) {
    return null;
  }
  const apertureGain = EXPECT_APERTURE_GAIN_MAG * Math.log2(apertureMm / EXPECT_REFERENCE_APERTURE_MM);
  return surface - darkSkyZenithMagForBortle(bortle) - apertureGain;
}

const BAND_ORDER: readonly ContrastBand[] = ["bright", "smudge", "faint", "limit"];

function atLeast(band: ContrastBand, floor: ContrastBand): ContrastBand {
  return BAND_ORDER.indexOf(band) >= BAND_ORDER.indexOf(floor) ? band : floor;
}

function rawBand(deficit: number | null): ContrastBand {
  if (deficit === null) {
    return "smudge";
  }
  if (deficit < EXPECT_BRIGHT_BELOW) {
    return "bright";
  }
  if (deficit < EXPECT_SMUDGE_BELOW) {
    return "smudge";
  }
  return deficit < EXPECT_FAINT_BELOW ? "faint" : "limit";
}

/**
 * The band after the near-limit floor: an object within `EXPECT_NEAR_LIMIT_MAG` of the telescope's limiting
 * magnitude is at least `faint`. Never brightens at a worse sky, never fades at a larger aperture.
 */
export function contrastBand(object: ContrastObject, bortle: number, apertureMm: number): ContrastBand {
  const band = rawBand(contrastDeficit(object, bortle, apertureMm));
  const nearLimit = object.vMag > telescopeLimitingMag(bortle, apertureMm) - EXPECT_NEAR_LIMIT_MAG;
  return nearLimit ? atLeast(band, "faint") : band;
}
