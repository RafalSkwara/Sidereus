import {
  AngleBetween,
  Body,
  Equator,
  GeoVector,
  Horizon,
  Illumination,
  Spherical,
  VectorFromSphere,
} from "astronomy-engine";

import { DEFAULT_TRACK_STEP_MINUTES } from "./parameters";
import { sampleInstants } from "./sampling";
import { observerFor } from "./sun";
import type { EquatorialJ2000, HorizontalPosition, Interval, Site } from "./types";

/**
 * Moon state and separation for an observing night. Pure: every input is explicit and the same
 * inputs always produce the same numbers.
 */

/** Everything the moon-interference score component needs about the Moon at one instant. */
export interface MoonState extends HorizontalPosition {
  /** Illuminated fraction of the disc, [0, 1]. */
  illuminatedFraction: number;
  /** Sun–Moon–Earth phase angle in degrees, [0, 180]; 0 is full, 180 is new. */
  phaseAngleDeg: number;
}

/**
 * Where the Moon is and how bright its phase is at `time`. Topocentric of-date coordinates go
 * straight into `Horizon` (which expects of-date), with the "normal" refraction model so the
 * altitude matches what a planetarium shows near the horizon.
 */
export function moonState(site: Site, time: Date): MoonState {
  const observer = observerFor(site);
  const eq = Equator(Body.Moon, time, observer, true, true);
  const hor = Horizon(time, observer, eq.ra, eq.dec, "normal");
  const illumination = Illumination(Body.Moon, time);
  return {
    time,
    altitudeDeg: hor.altitude,
    azimuthDeg: hor.azimuth,
    illuminatedFraction: illumination.phase_fraction,
    phaseAngleDeg: illumination.phase_angle,
  };
}

/**
 * Angular separation in degrees, [0, 180], between the Moon and a fixed target with J2000
 * catalogue coordinates.
 *
 * Both vectors are in the J2000 equatorial (EQJ) frame: the Moon's geocentric vector from
 * `GeoVector` and the target's unit vector from its RA/Dec, so no rotation is needed and the
 * observing site is not an input. Topocentric parallax is deliberately ignored: the Moon's
 * horizontal parallax is at most about 1°, which is far below what a moon-interference score
 * component cares about, and dropping it keeps the separation site-independent.
 */
export function moonSeparationDeg(time: Date, target: EquatorialJ2000): number {
  const moon = GeoVector(Body.Moon, time, true);
  const targetVector = VectorFromSphere(new Spherical(target.decDeg, target.raHours * 15, 1), time);
  return AngleBetween(moon, targetVector);
}

/** `moonState` sampled across `interval` every `stepMinutes`, inclusive of both ends. */
export function moonTrack(site: Site, interval: Interval, stepMinutes = DEFAULT_TRACK_STEP_MINUTES): MoonState[] {
  return sampleInstants(interval, stepMinutes).map((time) => moonState(site, time));
}
