import type { DeepSkyObject } from "@/lib/catalogue";

import { contrastBand, contrastDeficit, telescopeLimitingMag } from "./contrast";
import type { ContrastBand } from "./contrast";
import {
  EXPECT_BRIGHT_GALAXY_MARGIN_MAG,
  EXPECT_BRIGHT_NEBULA_MAX_VMAG,
  EXPECT_COMPACT_ARCMIN,
  EXPECT_GRAINY_APERTURE_MM,
  EXPECT_GRAINY_MARGIN_MAG,
  EXPECT_HUGE_NEBULA_ARCMIN,
  EXPECT_LARGE_PLANETARY_ARCMIN,
  EXPECT_LARGE_PLANETARY_DISC_BELOW,
  EXPECT_RESOLVE_APERTURE_MM,
  EXPECT_RESOLVE_MARGIN_MAG,
  EXPECT_STARLIKE_ARCMIN,
  EXPECT_WIDE_ARCMIN,
} from "./parameters";

/**
 * What a deep-sky object will look like in the user's telescope from the user's site (M-3 S-04, what-to-expect):
 * one key of a fixed set, chosen from the object's type, size and brightness, the telescope's aperture and the
 * site's Bortle class. The wording lives in the i18n catalogue under the same keys. Pure: no clock, no Moon (the
 * line is a property of object, site and telescope), no I/O.
 */

/** The 22 phrases an object can take, in the order the i18n catalogue lists them. */
export const EXPECTATION_KEYS = [
  "globularResolved",
  "globularGrainy",
  "globularGlow",
  "openClusterWide",
  "openClusterCompact",
  "openClusterScattered",
  "openClusterHazy",
  "planetaryStarLike",
  "planetaryDisc",
  "planetaryFaint",
  "galaxyBright",
  "galaxySmudge",
  "galaxyFaint",
  "galaxyLimit",
  "nebulaBright",
  "nebulaGlow",
  "nebulaFaint",
  "clusterNebulaBright",
  "clusterNebulaFaint",
  "asterism",
  "doubleStar",
  "other",
] as const;

export type ExpectationKey = (typeof EXPECTATION_KEYS)[number];

export type ExpectationObject = Pick<DeepSkyObject, "type" | "vMag" | "majorAxisArcmin" | "minorAxisArcmin" | "hubble">;

function galaxyKey(object: ExpectationObject, band: ContrastBand, bortle: number, apertureMm: number): ExpectationKey {
  switch (band) {
    case "bright":
      // Only a galaxy well clear of the limit is easy straight on; a high surface brightness alone is not enough.
      return object.vMag <= telescopeLimitingMag(bortle, apertureMm) - EXPECT_BRIGHT_GALAXY_MARGIN_MAG
        ? "galaxyBright"
        : "galaxySmudge";
    case "smudge":
      return "galaxySmudge";
    case "faint":
      return "galaxyFaint";
    case "limit":
      return "galaxyLimit";
  }
}

function nebulaKey(object: ExpectationObject, band: ContrastBand): ExpectationKey {
  switch (band) {
    case "bright": {
      // A nebula spread over many fields of view is never "bright", whatever its core says.
      const huge = object.majorAxisArcmin !== null && object.majorAxisArcmin >= EXPECT_HUGE_NEBULA_ARCMIN;
      return huge ? "nebulaGlow" : "nebulaBright";
    }
    case "smudge":
      return "nebulaGlow";
    case "faint":
    case "limit":
      return "nebulaFaint";
  }
}

function planetaryKey(object: ExpectationObject, band: ContrastBand, deficit: number | null): ExpectationKey {
  const size = object.majorAxisArcmin;
  if (size !== null && size < EXPECT_STARLIKE_ARCMIN) {
    return "planetaryStarLike";
  }
  // A large planetary whose core does not stand well clear of the sky is a faint glow, not a crisp disc.
  if (
    size !== null &&
    size >= EXPECT_LARGE_PLANETARY_ARCMIN &&
    deficit !== null &&
    deficit >= EXPECT_LARGE_PLANETARY_DISC_BELOW
  ) {
    return "planetaryFaint";
  }
  return band === "bright" || band === "smudge" ? "planetaryDisc" : "planetaryFaint";
}

function globularKey(
  object: ExpectationObject,
  band: ContrastBand,
  bortle: number,
  apertureMm: number,
): ExpectationKey {
  const diffuse = band === "bright" || band === "smudge";
  // How far the cluster sits above the telescope's limit: the bar for resolving it rises with aperture.
  const headroom = telescopeLimitingMag(bortle, apertureMm) - object.vMag;
  if (apertureMm >= EXPECT_RESOLVE_APERTURE_MM && headroom >= EXPECT_RESOLVE_MARGIN_MAG && diffuse) {
    return "globularResolved";
  }
  if (apertureMm >= EXPECT_GRAINY_APERTURE_MM && headroom >= EXPECT_GRAINY_MARGIN_MAG && band !== "limit") {
    return "globularGrainy";
  }
  return "globularGlow";
}

function openClusterKey(object: ExpectationObject, band: ContrastBand): ExpectationKey {
  const size = object.majorAxisArcmin;
  if (size !== null && size >= EXPECT_WIDE_ARCMIN) {
    return "openClusterWide";
  }
  if (band === "faint" || band === "limit") {
    return "openClusterHazy";
  }
  return size !== null && size <= EXPECT_COMPACT_ARCMIN ? "openClusterCompact" : "openClusterScattered";
}

/**
 * The phrase key for one deep-sky object at a site (`bortle`, 1-9) in a telescope (`apertureMm`). Total over the
 * catalogue: every object, class and aperture gives a key, and equal inputs give equal keys.
 */
export function expectationFor(object: ExpectationObject, bortle: number, apertureMm: number): ExpectationKey {
  const band = contrastBand(object, bortle, apertureMm);
  switch (object.type) {
    case "galaxy":
      return galaxyKey(object, band, bortle, apertureMm);
    case "nebula":
    case "emission-nebula":
    case "reflection-nebula":
    case "supernova-remnant":
      return nebulaKey(object, band);
    case "planetary-nebula":
      return planetaryKey(object, band, contrastDeficit(object, bortle, apertureMm));
    case "cluster-with-nebula":
      // A cluster in a bright nebula stays bright under any sky (M42 is a naked-eye object from a city).
      return band === "bright" || object.vMag <= EXPECT_BRIGHT_NEBULA_MAX_VMAG
        ? "clusterNebulaBright"
        : "clusterNebulaFaint";
    case "globular-cluster":
      return globularKey(object, band, bortle, apertureMm);
    case "open-cluster":
      return openClusterKey(object, band);
    case "asterism":
      return "asterism";
    case "double-star":
      return "doubleStar";
    case "other":
      return "other";
  }
}
