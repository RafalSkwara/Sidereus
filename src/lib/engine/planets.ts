import { Body, Equator, Horizon, Illumination } from "astronomy-engine";

import { DEFAULT_TRACK_STEP_MINUTES } from "./parameters";
import { sampleInstants } from "./sampling";
import { observerFor } from "./sun";
import type { HorizontalPosition, Interval, Site } from "./types";

/**
 * The seven planets: positions over a night and their facts at an instant (M-2 S-01). Pure: every
 * input is explicit and the same inputs always produce the same numbers.
 *
 * Planets move against the stars, so unlike catalogue objects they are not rotated from fixed J2000
 * coordinates: each sample takes the body's of-date apparent position (`Equator` with aberration)
 * and refracts it into the horizon (`Horizon`, "normal" refraction).
 */

/** Planet keys in solar order. They are also the log's target keys for planets. */
export const PLANET_KEYS = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"] as const;

export type PlanetKey = (typeof PLANET_KEYS)[number];

interface PlanetInfo {
  body: Body;
  /** Equatorial radius, km (IAU values; the Skyfield reference script uses the same). */
  equatorialRadiusKm: number;
  /** Uranus and Neptune, which are listed only above `ICE_GIANT_MIN_APERTURE_MM`. */
  iceGiant: boolean;
}

const PLANETS: Readonly<Record<PlanetKey, PlanetInfo>> = {
  mercury: { body: Body.Mercury, equatorialRadiusKm: 2440.53, iceGiant: false },
  venus: { body: Body.Venus, equatorialRadiusKm: 6051.8, iceGiant: false },
  mars: { body: Body.Mars, equatorialRadiusKm: 3396.19, iceGiant: false },
  jupiter: { body: Body.Jupiter, equatorialRadiusKm: 71492, iceGiant: false },
  saturn: { body: Body.Saturn, equatorialRadiusKm: 60268, iceGiant: false },
  uranus: { body: Body.Uranus, equatorialRadiusKm: 25559, iceGiant: true },
  neptune: { body: Body.Neptune, equatorialRadiusKm: 24764, iceGiant: true },
};

const KM_PER_AU = 149_597_870.7;
const ARCSEC_PER_RADIAN = (180 / Math.PI) * 3600;

/** True for Uranus and Neptune. */
export function isIceGiant(key: PlanetKey): boolean {
  return PLANETS[key].iceGiant;
}

/**
 * Tracks for several planets over the same grid as `objectTracks` (`sampleInstants`, both ends
 * included). Result `[i]` is the track of `keys[i]`.
 */
export function planetTracks(
  site: Site,
  interval: Interval,
  keys: readonly PlanetKey[],
  stepMinutes = DEFAULT_TRACK_STEP_MINUTES,
): HorizontalPosition[][] {
  const observer = observerFor(site);
  const tracks: HorizontalPosition[][] = keys.map(() => []);
  for (const time of sampleInstants(interval, stepMinutes)) {
    keys.forEach((key, i) => {
      const eq = Equator(PLANETS[key].body, time, observer, true, true);
      const horizontal = Horizon(time, observer, eq.ra, eq.dec, "normal");
      tracks[i].push({ time, altitudeDeg: horizontal.altitude, azimuthDeg: horizontal.azimuth });
    });
  }
  return tracks;
}

/** What a planet looks like at one instant. */
export interface PlanetFacts {
  /** Visual magnitude (Saturn's includes its rings). */
  magnitude: number;
  /** Equatorial diameter as seen from the Earth's centre, arcseconds. */
  apparentDiameterArcsec: number;
  /** Illuminated fraction of the disc, 0-1. */
  phaseFraction: number;
  /** Saturn's ring tilt towards the Earth, degrees; `null` for every other planet. */
  ringTiltDeg: number | null;
}

/** Magnitude, apparent size, phase and (Saturn only) ring tilt of a planet at `time`. */
export function planetFacts(key: PlanetKey, time: Date): PlanetFacts {
  const { body, equatorialRadiusKm } = PLANETS[key];
  const illumination = Illumination(body, time);
  const distanceKm = illumination.geo_dist * KM_PER_AU;
  return {
    magnitude: illumination.mag,
    apparentDiameterArcsec: 2 * Math.atan(equatorialRadiusKm / distanceKm) * ARCSEC_PER_RADIAN,
    phaseFraction: illumination.phase_fraction,
    ringTiltDeg: key === "saturn" ? (illumination.ring_tilt ?? null) : null,
  };
}
