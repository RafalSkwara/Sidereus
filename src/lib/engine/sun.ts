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
 * definition). Either is `null` when it does not occur, e.g. under a midnight sun.
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

  const lowest = SearchHourAngle(Body.Sun, observer, 12, night.start, 1);
  const minSunAltitudeDeg = sunAltitudeDeg(site, lowest.time.date);
  if (minSunAltitudeDeg >= thresholdDeg) {
    return { kind: "none", thresholdDeg, minSunAltitudeDeg, at: lowest.time.date };
  }

  const dusk = SearchAltitude(Body.Sun, observer, -1, night.start, 1, thresholdDeg);
  if (dusk === null || dusk.date >= night.end) {
    return { kind: "none", thresholdDeg, minSunAltitudeDeg, at: lowest.time.date };
  }

  const dawn = SearchAltitude(Body.Sun, observer, 1, dusk.date, 1, thresholdDeg);
  if (dawn === null || dawn.date > night.end) {
    return { kind: "window", thresholdDeg, start: dusk.date, end: night.end, clampedToNightEnd: true };
  }
  return { kind: "window", thresholdDeg, start: dusk.date, end: dawn.date, clampedToNightEnd: false };
}
