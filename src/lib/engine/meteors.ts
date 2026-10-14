import { Body, GeoVector, MakeTime, RotateVector, Rotation_EQJ_ECL, Search, SphereFromVector } from "astronomy-engine";
import type { AstroTime, FlexibleDateTime } from "astronomy-engine";

import { METEOR_SHOWERS } from "@/lib/catalogue/meteor-showers";
import type { MeteorShower } from "@/lib/catalogue/meteor-showers";

import { darkSpan, nightSpans, visibleAt, withShortNight } from "./events";
import type { EventVisibility, MeteorShowerEvent } from "./events";
import { moonState } from "./moon";
import { addDays, observingNightDateFor } from "./night";
import { objectPosition } from "./objects";
import { EVENT_DARK_SUN_ALTITUDE_DEG, METEOR_BRIGHT_MOON_FRACTION } from "./parameters";
import { sampleInstants } from "./sampling";
import type { Interval, Site } from "./types";

/**
 * Meteor-shower peaks (M-3 S-07): each shower's peak becomes a night, judged on its radiant. Pure: the site,
 * the window and the shower table are the only inputs.
 *
 * Peaks are tabulated as the Sun's ecliptic longitude for the equinox of J2000.0, while astronomy-engine's
 * `SearchSunLongitude` and `Ecliptic()` both work in the ecliptic of date, about 0.37° (nine hours of the
 * Sun's motion) away in 2026 (plan review F1). So the moment is found by `Search` over the J2000 longitude
 * itself, `Rotation_EQJ_ECL` being the J2000 mean ecliptic, with no precession formula.
 *
 * A peak is a night, never a minute: maxima are known only to about a degree of solar longitude. The radiant
 * must clear `EVENT_MIN_ALTITUDE_DEG` during the dark window of the peak's night, else of the night before
 * or after (a peak that falls in daylight is "best the night before" or "best the night after"). Where a
 * night has no dark window the span with the Sun at or below `EVENT_SUN_MAX_ALTITUDE_DEG` stands in, flagged
 * `shortNight` (plan review F5).
 *
 * A peak from the two days before the window is kept only when its best night is the window's first, so a shower
 * whose peak night has just passed is still tonight's event on its best night (sky-events Phase 5).
 */

const J2000_TO_ECLIPTIC = Rotation_EQJ_ECL();

/** The Sun's mean motion, degrees a day: where to look for the next crossing of a longitude. */
const SUN_DEGREES_PER_DAY = 360 / 365.2422;
const DAY_MS = 86_400_000;
const YEAR_MS = 365.2422 * DAY_MS;
/**
 * Half-width of the bracket around the mean-motion estimate of a crossing, days. The Sun's longitude runs up
 * to about 2° (two days) from its mean, so the bracket holds the crossing with room to spare.
 */
const SEARCH_HALF_WIDTH_DAYS = 5;
/** The span of a night's moon check is sampled this often, minutes. */
const MOON_STEP_MINUTES = 10;

/**
 * The Sun's geocentric ecliptic longitude for the equinox of J2000.0 (not of date), degrees [0, 360), with the
 * Sun's apparent direction (aberration on). The one definition the shower table's longitudes are derived and
 * tested with.
 */
export function sunLongitudeJ2000Deg(time: FlexibleDateTime): number {
  return SphereFromVector(RotateVector(J2000_TO_ECLIPTIC, GeoVector(Body.Sun, time, true))).lon;
}

/** `value` wrapped into [-180, 180), so a difference of two longitudes is small across 0°/360°. */
function wrapSignedDeg(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

/** The instants in `window` (start inclusive, end exclusive) at which the Sun's J2000 longitude equals `longitudeDeg`. */
export function sunLongitudeCrossings(longitudeDeg: number, window: Interval): Date[] {
  const f = (t: AstroTime): number => wrapSignedDeg(sunLongitudeJ2000Deg(t) - longitudeDeg);
  const ahead = (((longitudeDeg - sunLongitudeJ2000Deg(window.start)) % 360) + 360) % 360;
  const crossings: Date[] = [];
  let guessMs = window.start.getTime() + (ahead / SUN_DEGREES_PER_DAY) * DAY_MS;
  while (guessMs - SEARCH_HALF_WIDTH_DAYS * DAY_MS < window.end.getTime()) {
    const found = Search(
      f,
      MakeTime(new Date(guessMs - SEARCH_HALF_WIDTH_DAYS * DAY_MS)),
      MakeTime(new Date(guessMs + SEARCH_HALF_WIDTH_DAYS * DAY_MS)),
    );
    if (found === null) {
      throw new Error(`The Sun's J2000 longitude never reached ${longitudeDeg}° near the estimated crossing`);
    }
    const moment = found.date;
    if (moment.getTime() >= window.end.getTime()) {
      break;
    }
    if (moment.getTime() >= window.start.getTime()) {
      crossings.push(moment);
    }
    guessMs = moment.getTime() + YEAR_MS;
  }
  return crossings;
}

/** A shower's radiant on one observing night: whether it can be seen, and over which span it was judged. */
interface NightRadiant {
  night: string;
  visibility: EventVisibility;
  /** The span the radiant was judged over (dark window, or the twilight span of a short night), `null` when the Sun never gets low enough. */
  span: Interval | null;
}

function radiantOnNight(site: Site, shower: MeteorShower, night: string, darkThresholdDeg: number): NightRadiant {
  const eventSpan = darkSpan(nightSpans(site, night, darkThresholdDeg));
  if (eventSpan === null) {
    return { night, visibility: { visible: false, reason: "daylight" }, span: null };
  }
  const radiant = { raHours: shower.radiantRaDeg / 15, decDeg: shower.radiantDecDeg };
  return {
    night,
    visibility: withShortNight(
      visibleAt(site, (time) => objectPosition(site, time, radiant), eventSpan.span),
      eventSpan.shortNight,
    ),
    span: eventSpan.span,
  };
}

/** The Moon is bright (illuminated fraction at or above `METEOR_BRIGHT_MOON_FRACTION`) and above the horizon at some moment of `span`. */
function brightMoonDuring(site: Site, span: Interval | null): boolean {
  if (span === null) {
    return false;
  }
  return sampleInstants(span, MOON_STEP_MINUTES).some((time) => {
    const moon = moonState(site, time);
    return moon.altitudeDeg > 0 && moon.illuminatedFraction >= METEOR_BRIGHT_MOON_FRACTION;
  });
}

function altitudeOf(radiant: NightRadiant): number {
  return radiant.visibility.visible ? radiant.visibility.altitudeDeg : Number.NEGATIVE_INFINITY;
}

/**
 * The shower peaks inside `window`, in time order. `darkThresholdDeg` defines each night's dark
 * window (the default is astronomical darkness). A shower whose radiant never clears the minimum on the
 * peak's night or its neighbours is listed as not visible, with the peak night's reason.
 */
export function meteorEvents(
  site: Site,
  window: Interval,
  darkThresholdDeg = EVENT_DARK_SUN_ALTITUDE_DEG,
  showers: readonly MeteorShower[] = METEOR_SHOWERS,
): MeteorShowerEvent[] {
  const events: MeteorShowerEvent[] = [];
  const firstNight = observingNightDateFor(window.start, site.timeZone);
  // A peak just before the window can still be the shower's night to go out: it counts when its best night is the
  // window's first (the peak fell in daylight and the radiant is better the night after). Two days cover the peak's
  // night and a 23 or 25 hour day.
  const searched: Interval = { start: new Date(window.start.getTime() - 2 * DAY_MS), end: window.end };
  for (const shower of showers) {
    for (const moment of sunLongitudeCrossings(shower.peakSolarLongitudeJ2000Deg, searched)) {
      const night = observingNightDateFor(moment, site.timeZone);
      const peak = radiantOnNight(site, shower, night, darkThresholdDeg);
      let best = peak;
      if (!peak.visibility.visible) {
        const neighbours = [addDays(night, -1), addDays(night, 1)].map((date) =>
          radiantOnNight(site, shower, date, darkThresholdDeg),
        );
        const passing = neighbours.filter((n) => n.visibility.visible);
        if (passing.length > 0) {
          best = passing.reduce((a, b) => (altitudeOf(b) > altitudeOf(a) ? b : a));
        }
      }
      if (moment.getTime() < window.start.getTime() && best.night < firstNight) {
        continue;
      }
      events.push({
        kind: "meteor-shower",
        moment,
        night,
        visibility: best.visibility,
        shower: shower.key,
        brightMoon: brightMoonDuring(site, best.span),
        bestNight: best.night,
      });
    }
  }
  return events.sort((a, b) => a.moment.getTime() - b.moment.getTime());
}
