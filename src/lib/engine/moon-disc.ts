import { Body, EquatorFromVector, GeoVector, Illumination, Libration, RotationAxis } from "astronomy-engine";

import type { MoonDiscState } from "@/lib/moon-disc/state";

import { moonElongationDeg, moonPhaseBand } from "./moon";
import { MOON_DISC_STEP_MINUTES } from "./parameters";
import { sampleInstants } from "./sampling";
import type { Interval } from "./types";

/**
 * Moon-disc states (moonlight-and-the-verdict): what the Moon card draws at each instant, computed on the server and
 * drawn by `moonDiscPaths` in `src/lib/moon-disc/`. Pure and geocentric: no site is an input, since the bright-limb
 * angle and the libration differ between observers by far less than the drawing shows.
 */

const DEG = Math.PI / 180;

/** Steps of the illuminated fraction a state carries. */
const ILLUMINATION_STEPS = 100;

/** Right ascension (hours) and declination (degrees) in the J2000 frame. */
interface RaDec {
  ra: number;
  dec: number;
}

/**
 * Position angle, degrees in [0, 360), of the direction from `at` towards `towards`, measured from celestial north
 * towards celestial east (Meeus, Astronomical Algorithms, eq. 48.5). With the Sun as `towards` and the Moon as `at`
 * it is the position angle χ of the bright limb's midpoint; with the Moon's pole it is the axis angle P.
 */
function positionAngleDeg(towards: RaDec, at: RaDec): number {
  const a0 = towards.ra * 15 * DEG;
  const d0 = towards.dec * DEG;
  const a = at.ra * 15 * DEG;
  const d = at.dec * DEG;
  const angle =
    Math.atan2(
      Math.cos(d0) * Math.sin(a0 - a),
      Math.sin(d0) * Math.cos(d) - Math.cos(d0) * Math.sin(d) * Math.cos(a0 - a),
    ) / DEG;
  return ((angle % 360) + 360) % 360;
}

/**
 * The Moon disc at `time`. The Sun and the Moon come from `GeoVector` + `EquatorFromVector`, so both are J2000
 * equatorial like the IAU pole from `RotationAxis`; the bright-limb angle is χ − P, from lunar north towards
 * celestial east. Libration is the optical libration from `Libration`, and the illuminated fraction is rounded to
 * 0.01.
 */
export function moonDiscState(time: Date): MoonDiscState {
  const sun = EquatorFromVector(GeoVector(Body.Sun, time, true));
  const moon = EquatorFromVector(GeoVector(Body.Moon, time, true));
  const pole = RotationAxis(Body.Moon, time);
  const chi = positionAngleDeg(sun, moon);
  const p = positionAngleDeg(pole, moon);
  const libration = Libration(time);
  const elongationDeg = moonElongationDeg(time);
  return {
    time: time.toISOString(),
    illuminatedFraction:
      Math.round(Illumination(Body.Moon, time).phase_fraction * ILLUMINATION_STEPS) / ILLUMINATION_STEPS,
    waxing: elongationDeg < 180,
    band: moonPhaseBand(elongationDeg),
    brightLimbAngleDeg: (((chi - p) % 360) + 360) % 360,
    librationLatDeg: libration.elat,
    librationLonDeg: libration.elon,
  };
}

/** `moonDiscState` sampled across `interval` every `stepMinutes`, inclusive of both ends. */
export function moonDiscStates(interval: Interval, stepMinutes = MOON_DISC_STEP_MINUTES): MoonDiscState[] {
  return sampleInstants(interval, stepMinutes).map((time) => moonDiscState(time));
}
