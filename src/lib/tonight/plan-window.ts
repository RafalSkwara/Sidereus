import {
  bestWindow,
  darknessThresholdDegForBortle,
  darkWindow,
  DEFAULT_TRACK_STEP_MINUTES,
  ICE_GIANT_MIN_APERTURE_MM,
  isIceGiant,
  MOON_MIN_ILLUMINATION,
  moonState,
  moonTrack,
  objectTrack,
  observingNight,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  planetTracks,
  refinedWindow,
  type BestWindow,
  type DarkWindow,
  type EquatorialJ2000,
  type PlanetKey,
  type Site,
} from "@/lib/engine";
import type { SiteRecord } from "@/lib/gear/store";
import { MOON_TARGET_KEY, type MoonKey } from "@/lib/targets";

/**
 * The window of one target at a site on a night (adjustable-session-plan): the longest stretch at or above the site's
 * minimum altitude, by the engine's own functions, step and thresholds, so the build's added rows and the save route's
 * check for a newly added key cannot disagree with the ranking and the planets. Pure: no clock, no I/O.
 *
 * Geometry only. What the weather or the telescope decide is not here: a deep-sky object also needs to be within the
 * telescope's reach (`rankObjects`' `reachable`), and the planets need their window's own weather (`buildTonight`).
 */

/** What the windows need of a stored site: the engine's three fields, the Bortle class and the minimum altitude. */
export type PlanWindowSite = Pick<
  SiteRecord,
  "latitudeDeg" | "longitudeDeg" | "timeZone" | "bortle" | "minAltitudeDeg"
>;

function engineSiteOf(site: PlanWindowSite): Site {
  return { latitudeDeg: site.latitudeDeg, longitudeDeg: site.longitudeDeg, timeZone: site.timeZone };
}

/** The planets' and the Moon's window: civil dusk to civil dawn (the Sun below `PLANET_WINDOW_SUN_ALTITUDE_DEG`). */
export function planetWindowFor(site: Site, night: string): DarkWindow {
  return darkWindow(site, observingNight(night, site.timeZone), PLANET_WINDOW_SUN_ALTITUDE_DEG);
}

/**
 * A deep-sky object's best window over the night's dark window (the Sun below the Bortle class's threshold), or `null`
 * without a dark window or when the object never reaches the site's minimum altitude in it. Its edges are the true
 * crossings of the minimum altitude (`refinedWindow`), not the grid samples. The same as the window
 * `rankObjects` scores the object over (`ranking.reachable`), minus the telescope's limiting magnitude.
 */
export function deepSkyWindow(site: PlanWindowSite, night: string, object: EquatorialJ2000): BestWindow | null {
  const engineSite = engineSiteOf(site);
  const dark = darkWindow(engineSite, observingNight(night, site.timeZone), darknessThresholdDegForBortle(site.bortle));
  if (dark.kind !== "window") {
    return null;
  }
  const track = objectTrack(engineSite, { start: dark.start, end: dark.end }, object, DEFAULT_TRACK_STEP_MINUTES);
  const refined = refinedWindow(track, site.minAltitudeDeg);
  return refined === null ? null : { start: refined.start, end: refined.end, peak: refined.peak };
}

/**
 * A planet's or the Moon's best window over the planet window, or `null` without one, when the body never reaches the
 * site's minimum altitude in it, for the Moon when it is lit less than `MOON_MIN_ILLUMINATION` at its peak, and for
 * Uranus and Neptune when the telescope's aperture (`options.apertureMm`, when given) is under
 * `ICE_GIANT_MIN_APERTURE_MM`: the rules `rankPlanets` and `moonTarget` apply. The planet window's own weather is
 * `buildTonight`'s to judge.
 */
export function solarSystemWindow(
  site: PlanWindowSite,
  night: string,
  key: PlanetKey | MoonKey,
  options: { apertureMm?: number } = {},
): BestWindow | null {
  const engineSite = engineSiteOf(site);
  if (key !== MOON_TARGET_KEY && isIceGiant(key) && (options.apertureMm ?? Infinity) < ICE_GIANT_MIN_APERTURE_MM) {
    return null;
  }
  const civil = planetWindowFor(engineSite, night);
  if (civil.kind !== "window") {
    return null;
  }
  const interval = { start: civil.start, end: civil.end };
  const track =
    key === MOON_TARGET_KEY
      ? moonTrack(engineSite, interval, DEFAULT_TRACK_STEP_MINUTES)
      : planetTracks(engineSite, interval, [key], DEFAULT_TRACK_STEP_MINUTES)[0];
  const best = bestWindow(track, site.minAltitudeDeg);
  if (best === null) {
    return null;
  }
  if (key !== MOON_TARGET_KEY) {
    return best;
  }
  if (moonState(engineSite, best.peak.time).illuminatedFraction < MOON_MIN_ILLUMINATION) {
    return null;
  }
  // The Moon's track carries its phase; the window, like `moonTarget`'s, holds a plain position.
  const { time, altitudeDeg, azimuthDeg } = best.peak;
  return { ...best, peak: { time, altitudeDeg, azimuthDeg } };
}
