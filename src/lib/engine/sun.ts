import { Body, Equator, Horizon, Observer, SearchAltitude, SearchHourAngle, SearchRiseSet } from "astronomy-engine";

import type { DarkWindow, ObservingNight, Site } from "./types";

/**
 * Sun events and the dark window for an observing night. Pure: every input is explicit and the
 * same inputs always produce the same instants.
 */

export function observerFor(site: Site): Observer {
  return new Observer(site.latitudeDeg, site.longitudeDeg, site.elevationM ?? 0);
}

/**
 * Geometric altitude of the sun's centre in degrees (no refraction), following the twilight
 * convention that thresholds below the horizon are compared without atmospheric correction.
 */
export function sunAltitudeDeg(site: Site, time: Date): number {
  const observer = observerFor(site);
  const eq = Equator(Body.Sun, time, observer, true, true);
  return Horizon(time, observer, eq.ra, eq.dec).altitude;
}

/**
 * Sunset and sunrise inside the night (refracted, upper-limb, per astronomy-engine's rise/set
 * definition). Either is `null` when it does not occur. Note that `{ sunset: null, sunrise: null }`
 * covers two opposite situations, midnight sun and polar night; callers that need to tell them
 * apart use `darkWindow`, whose `none` variant carries the sun's minimum altitude and whose window
 * variant flags a night that is dark from the start.
 */
export function sunEvents(site: Site, night: ObservingNight): { sunset: Date | null; sunrise: Date | null } {
  const observer = observerFor(site);
  const set = SearchRiseSet(Body.Sun, observer, -1, night.start, 1);
  const sunset = set !== null && set.date < night.end ? set.date : null;
  if (sunset === null) {
    return { sunset: null, sunrise: null };
  }
  const rise = SearchRiseSet(Body.Sun, observer, 1, sunset, 1);
  const sunrise = rise !== null && rise.date <= night.end ? rise.date : null;
  return { sunset, sunrise };
}

/**
 * The interval during the night when the sun is below `thresholdDeg`, or the `none` variant when
 * the threshold is never reached.
 *
 * The lower culmination (sun's lowest point) is checked first: astronomy-engine's altitude search
 * is documented as unreliable near a body's minimum altitude, so a threshold the sun never reaches
 * is answered from the culmination rather than by searching for a crossing that does not exist.
 */
export function darkWindow(site: Site, night: ObservingNight, thresholdDeg: number): DarkWindow {
  if (thresholdDeg > 0 || thresholdDeg < -90) {
    throw new RangeError(`Darkness threshold must be in [-90, 0] degrees, got ${thresholdDeg}`);
  }
  const observer = observerFor(site);

  const lowestAt = SearchHourAngle(Body.Sun, observer, 12, night.start, 1).time.date;
  const minSunAltitudeDeg = sunAltitudeDeg(site, lowestAt);
  if (minSunAltitudeDeg >= thresholdDeg) {
    return { kind: "none", thresholdDeg, minSunAltitudeDeg, at: lowestAt };
  }

  // From here on the threshold IS reached, so a window exists. The sun's altitude is monotone on
  // each leg [night.start, lowestAt] (falling) and [lowestAt, night.end] (rising); the library
  // search is tried first and bisection on those legs is the exact fallback when it misses (its
  // documented weakness near the minimum, or a polar night where the sun is already below the
  // threshold at local noon).
  let start: Date;
  let clampedToNightStart = false;
  if (sunAltitudeDeg(site, night.start) < thresholdDeg) {
    start = night.start;
    clampedToNightStart = true;
  } else {
    const dusk = SearchAltitude(Body.Sun, observer, -1, night.start, 1, thresholdDeg);
    start =
      dusk !== null && dusk.date <= lowestAt ? dusk.date : bisectCrossing(site, night.start, lowestAt, thresholdDeg);
  }

  let end: Date;
  let clampedToNightEnd = false;
  if (sunAltitudeDeg(site, night.end) < thresholdDeg) {
    end = night.end;
    clampedToNightEnd = true;
  } else {
    const dawn = SearchAltitude(Body.Sun, observer, 1, lowestAt, 1, thresholdDeg);
    end = dawn !== null && dawn.date <= night.end ? dawn.date : bisectCrossing(site, lowestAt, night.end, thresholdDeg);
  }

  return { kind: "window", thresholdDeg, start, end, clampedToNightStart, clampedToNightEnd };
}

const BISECTION_TOLERANCE_MS = 1_000;

/**
 * Instant between `a` and `b` where the sun's altitude crosses `thresholdDeg`, to 1 s. The leg must
 * be monotone with the threshold strictly between the two endpoint altitudes; callers guarantee
 * this by splitting the night at the sun's lower culmination.
 */
function bisectCrossing(site: Site, a: Date, b: Date, thresholdDeg: number): Date {
  let lo = a.getTime();
  let hi = b.getTime();
  const loSide = Math.sign(sunAltitudeDeg(site, a) - thresholdDeg);
  const hiSide = Math.sign(sunAltitudeDeg(site, b) - thresholdDeg);
  if (loSide === hiSide) {
    throw new Error("darkWindow: bisection leg does not straddle the threshold");
  }
  while (hi - lo > BISECTION_TOLERANCE_MS) {
    const mid = Math.floor((lo + hi) / 2);
    const midSide = Math.sign(sunAltitudeDeg(site, new Date(mid)) - thresholdDeg);
    if (midSide === loSide) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return new Date(hi);
}
