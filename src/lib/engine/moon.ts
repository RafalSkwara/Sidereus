import {
  AngleBetween,
  Body,
  Equator,
  GeoVector,
  Horizon,
  Illumination,
  InverseRefraction,
  MoonPhase,
  SearchAltitude,
  Spherical,
  VectorFromSphere,
} from "astronomy-engine";

import { DEFAULT_TRACK_STEP_MINUTES, MOON_PHASE_BANDS } from "./parameters";
import type { MoonPhaseBand } from "./parameters";
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

const DEG = Math.PI / 180;

/**
 * `moonSeparationDeg` for many targets over many instants, as `[target][instant]`: the Moon's J2000 unit vector is
 * computed once per instant and dotted with each target's, so ranking the catalogue costs one `GeoVector` per
 * sample instead of one per object and sample. Same frame and the same parallax-free approximation.
 */
export function moonSeparationsDeg(times: readonly Date[], targets: readonly EquatorialJ2000[]): number[][] {
  const moon = times.map((time) => {
    const v = GeoVector(Body.Moon, time, true);
    const length = Math.hypot(v.x, v.y, v.z);
    return [v.x / length, v.y / length, v.z / length] as const;
  });
  return targets.map(({ raHours, decDeg }) => {
    const ra = raHours * 15 * DEG;
    const dec = decDeg * DEG;
    const tx = Math.cos(dec) * Math.cos(ra);
    const ty = Math.cos(dec) * Math.sin(ra);
    const tz = Math.sin(dec);
    return moon.map(([x, y, z]) => Math.acos(Math.min(1, Math.max(-1, x * tx + y * ty + z * tz))) / DEG);
  });
}

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/**
 * Whole minutes of `[interval.start, interval.end)` during which the Moon is below the horizon,
 * in the `moonState` sense: its apparent (refracted) centre altitude is below 0°.
 *
 * The state at the start comes from `moonState`; each later change is the next horizon crossing
 * from `SearchAltitude` on the Moon's centre at the geometric altitude that refracts to 0°. Rise/set
 * searches are not used because they time the upper limb against a fixed refraction, which differs
 * from `moonState` by about 0.25° of altitude (minutes of time, more at high latitude), and a
 * dense track is not used because a handful of crossings per window is far cheaper. A `null`
 * search result means no crossing before the interval ends.
 */
export function moonFreeMinutes(site: Site, interval: Interval): number {
  const startMs = interval.start.getTime();
  const endMs = interval.end.getTime();
  if (!(endMs > startMs)) {
    return 0;
  }
  const observer = observerFor(site);
  const horizonDeg = InverseRefraction("normal", 0);

  let below = moonState(site, interval.start).altitudeDeg < 0;
  let cursorMs = startMs;
  let freeMs = 0;
  while (cursorMs < endMs) {
    const crossing = SearchAltitude(
      Body.Moon,
      observer,
      below ? 1 : -1,
      new Date(cursorMs),
      (endMs - cursorMs) / DAY_MS,
      horizonDeg,
    );
    const nextMs = crossing === null ? endMs : Math.min(Math.max(crossing.date.getTime(), cursorMs), endMs);
    if (below) {
      freeMs += nextMs - cursorMs;
    }
    if (crossing === null || nextMs >= endMs) {
      break;
    }
    cursorMs = nextMs;
    below = !below;
  }
  return Math.floor(freeMs / MINUTE_MS);
}

/** `moonState` sampled across `interval` every `stepMinutes`, inclusive of both ends. */
export function moonTrack(site: Site, interval: Interval, stepMinutes = DEFAULT_TRACK_STEP_MINUTES): MoonState[] {
  return sampleInstants(interval, stepMinutes).map((time) => moonState(site, time));
}

/**
 * The Moon's geocentric Sun–Moon ecliptic elongation at `time`, degrees, [0, 360): 0 new, 90 first quarter,
 * 180 full, 270 last quarter. Unlike the illuminated fraction it tells waxing (below 180) from waning.
 */
export function moonElongationDeg(time: Date): number {
  const deg = MoonPhase(time) % 360;
  return deg < 0 ? deg + 360 : deg;
}

/**
 * The `MOON_PHASE_BANDS` entry holding `elongationDeg` (`fromDeg` inclusive, `toDeg` exclusive). Any angle is
 * accepted and wrapped into [0, 360) first, so 360 is a waxing crescent like 0.
 */
export function moonPhaseBand(elongationDeg: number): MoonPhaseBand {
  if (!Number.isFinite(elongationDeg)) {
    throw new RangeError(`Moon elongation must be finite, got ${elongationDeg}`);
  }
  const wrapped = ((elongationDeg % 360) + 360) % 360;
  const match = MOON_PHASE_BANDS.find((b) => b.fromDeg <= wrapped && wrapped < b.toDeg);
  if (match === undefined) {
    throw new Error(`moonPhaseBand: no band holds ${wrapped}°, MOON_PHASE_BANDS must cover [0, 360)`);
  }
  return match.band;
}
