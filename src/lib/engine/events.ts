import {
  Body,
  EclipseKind,
  Equator,
  Horizon,
  NextLocalSolarEclipse,
  NextLunarEclipse,
  SearchLocalSolarEclipse,
  SearchLunarEclipse,
  SearchMaxElongation,
  SearchRelativeLongitude,
} from "astronomy-engine";
import type { EclipseEvent } from "astronomy-engine";

import { addDays, observingNight, observingNightDateFor } from "./night";
import {
  ECLIPSE_MIN_ALTITUDE_DEG,
  EVENT_DARK_SUN_ALTITUDE_DEG,
  EVENT_MIN_ALTITUDE_DEG,
  EVENT_SUN_MAX_ALTITUDE_DEG,
  EVENT_WINDOW_NIGHTS,
} from "./parameters";
import type { PlanetKey } from "./planets";
import { pairingEvents } from "./pairings";
import { sampleInstants } from "./sampling";
import { darkWindow, observerFor, sunAltitudeDeg } from "./sun";
import type { HorizontalPosition, Interval, Site } from "./types";

/**
 * Sky events (M-3 S-07): the lunar and local solar eclipses, the greatest elongations of Mercury and
 * Venus and the oppositions of Mars, Jupiter and Saturn that astronomy-engine searches directly, each
 * with whether it can be seen from the site. Pure: the site, the first night and the window length are
 * the only inputs, so the same inputs always give the same events (and they travel in offline copies).
 *
 * Visibility is decided in one place (`visibleAt` for the night events, `eclipseVisibility` for the
 * eclipses), so no consumer has to repeat the rule: an event is `visible: true` only when its body is
 * high enough, at a moment when the sky is dark enough, and a consumer reads only visible events as
 * something to go out for (PRD invariant, US-07).
 */

/** The kinds of event. Meteor showers are plugged into `skyEvents` by a later phase. */
export type SkyEventKind =
  "lunar-eclipse" | "solar-eclipse" | "elongation" | "opposition" | "pairing" | "meteor-shower";

/** Why an event cannot be seen from the site. */
export type NotVisibleReason = "below-horizon" | "daylight" | "too-low";

export type EventVisibility =
  | {
      visible: true;
      /** The best moment to look: the body's highest point while the event counts. */
      best: Date;
      /** The body's altitude at `best`, degrees. */
      altitudeDeg: number;
      /** The body's azimuth at `best`, degrees clockwise from north. */
      azimuthDeg: number;
      /** An eclipse that is not up at its peak but is at a contact (the partial phase, for a lunar one also the total phase). */
      partly?: boolean;
      /** An eclipse seen between `ECLIPSE_MIN_ALTITUDE_DEG` and `EVENT_MIN_ALTITUDE_DEG`: "low, needs an open horizon". */
      lowHorizon?: boolean;
      /** The night has no dark window, so the span with the sun at or below `EVENT_SUN_MAX_ALTITUDE_DEG` was used. */
      shortNight?: boolean;
    }
  | {
      visible: false;
      /** `below-horizon`: under 0° throughout; `daylight`: high enough only with the sun up; `too-low`: the rest. */
      reason: NotVisibleReason;
      shortNight?: boolean;
    };

interface EventBase {
  /** The event's own instant: an eclipse's peak, an elongation's or opposition's moment. */
  moment: Date;
  /** The observing night (`YYYY-MM-DD`, site-local evening date) that contains `moment`. */
  night: string;
  visibility: EventVisibility;
}

export interface LunarEclipseEvent extends EventBase {
  kind: "lunar-eclipse";
  eclipseKind: "penumbral" | "partial" | "total";
  /** Fraction of the Moon's disc covered by the umbra at the peak, 0-1 (0 for a penumbral eclipse). */
  obscuration: number;
  /** The penumbral phase, `peak ± sd_penum`. */
  penumbral: Interval;
  /** The partial (umbral) phase, or `null` for a penumbral eclipse. */
  partial: Interval | null;
  /** Totality, or `null` unless the eclipse is total. */
  total: Interval | null;
}

export interface SolarEclipseEvent extends EventBase {
  kind: "solar-eclipse";
  eclipseKind: "partial" | "annular" | "total";
  /** Fraction of the Sun's disc covered at the site's peak, 0-1. */
  obscuration: number;
  /** First to last contact as seen from the site. */
  partial: Interval;
  /** The annular or total phase, or `null` for a partial eclipse. */
  central: Interval | null;
}

export type ElongationBody = "mercury" | "venus";

export interface ElongationEvent extends EventBase {
  kind: "elongation";
  body: ElongationBody;
  /** Angle from the Sun at the greatest elongation, degrees. */
  elongationDeg: number;
  /** Seen in the morning sky before sunrise, or in the evening sky after sunset. */
  apparition: "morning" | "evening";
}

export type OppositionBody = "mars" | "jupiter" | "saturn";

export interface OppositionEvent extends EventBase {
  kind: "opposition";
  body: OppositionBody;
}

/** A body of a close pairing: the Moon or one of the five naked-eye planets. */
export type PairingBody = "moon" | Exclude<PlanetKey, "uranus" | "neptune">;

export interface PairingEvent extends EventBase {
  kind: "pairing";
  bodies: readonly [PairingBody, PairingBody];
  /** Apparent separation at `moment`, degrees. */
  separationDeg: number;
}

export interface MeteorShowerEvent extends EventBase {
  kind: "meteor-shower";
  /** The shower's id in the shower table. */
  shower: string;
  /** The Moon is bright (illuminated fraction at or above `METEOR_BRIGHT_MOON_FRACTION`) and up during the dark window. */
  brightMoon: boolean;
  /** The night (`YYYY-MM-DD`) to watch: the peak's night, or the one before or after when the peak is in daylight. */
  bestNight: string;
}

export type SkyEvent =
  LunarEclipseEvent | SolarEclipseEvent | ElongationEvent | OppositionEvent | PairingEvent | MeteorShowerEvent;

/**
 * Notable events are the ones worth surfacing on the dashboard: visible ones, except a penumbral lunar
 * eclipse, which is listed but barely noticeable (owner decision 4).
 */
export function isNotableEvent(event: SkyEvent): boolean {
  return event.visibility.visible && !(event.kind === "lunar-eclipse" && event.eclipseKind === "penumbral");
}

// Visibility ---------------------------------------------------------------------------------------

/** Grid the visibility test samples a span on. The body's altitude moves under 1° in 5 minutes. */
const VISIBILITY_STEP_MINUTES = 5;

/**
 * Slack, degrees, on the sun bound at a span's ends: `darkWindow` finds the crossings to about a second,
 * during which the sun moves up to 0.005°, so an end sample must not fail the bound it was cut at.
 */
const SUN_BOUND_TOLERANCE_DEG = 0.05;

/**
 * Whether a body is visible somewhere in `span`, and when it is best. The best moment is the highest
 * altitude at or above `EVENT_MIN_ALTITUDE_DEG` while the sun is at or below `EVENT_SUN_MAX_ALTITUDE_DEG`.
 * Otherwise the reason it fails: `daylight` when the body is high enough but only with the sun up,
 * `below-horizon` when it is under 0° throughout the span, `too-low` for the rest.
 */
export function visibleAt(site: Site, sample: (time: Date) => HorizontalPosition, span: Interval): EventVisibility {
  let best: HorizontalPosition | null = null;
  let highEnough = false;
  let maxAltitudeDeg = Number.NEGATIVE_INFINITY;
  for (const time of sampleInstants(span, VISIBILITY_STEP_MINUTES)) {
    const position = sample(time);
    maxAltitudeDeg = Math.max(maxAltitudeDeg, position.altitudeDeg);
    if (position.altitudeDeg < EVENT_MIN_ALTITUDE_DEG) {
      continue;
    }
    highEnough = true;
    if (sunAltitudeDeg(site, time) > EVENT_SUN_MAX_ALTITUDE_DEG + SUN_BOUND_TOLERANCE_DEG) {
      continue;
    }
    if (best === null || position.altitudeDeg > best.altitudeDeg) {
      best = position;
    }
  }
  if (best !== null) {
    return { visible: true, best: best.time, altitudeDeg: best.altitudeDeg, azimuthDeg: best.azimuthDeg };
  }
  if (highEnough) {
    return { visible: false, reason: "daylight" };
  }
  return { visible: false, reason: maxAltitudeDeg < 0 ? "below-horizon" : "too-low" };
}

/** `visibility` of a night event with the night's `shortNight` flag applied. */
function withShortNight(visibility: EventVisibility, shortNight: boolean): EventVisibility {
  return shortNight ? { ...visibility, shortNight: true } : visibility;
}

/**
 * The one rule for an eclipse. Visible if the body is at or above `ECLIPSE_MIN_ALTITUDE_DEG` at the peak;
 * otherwise visible `partly` if it is at or above it at a contact, the best moment being the highest
 * contact. `lowHorizon` when that altitude is under `EVENT_MIN_ALTITUDE_DEG`. When nothing qualifies the
 * reason is `below-horizon` (every sampled moment under 0°) or `too-low`. Daylight never applies: an
 * eclipse is not a night event.
 */
function eclipseVisibility(peak: HorizontalPosition, contacts: readonly HorizontalPosition[]): EventVisibility {
  let chosen: HorizontalPosition | null = null;
  let partly = false;
  if (peak.altitudeDeg >= ECLIPSE_MIN_ALTITUDE_DEG) {
    chosen = peak;
  } else {
    for (const contact of contacts) {
      if (
        contact.altitudeDeg >= ECLIPSE_MIN_ALTITUDE_DEG &&
        (chosen === null || contact.altitudeDeg > chosen.altitudeDeg)
      ) {
        chosen = contact;
        partly = true;
      }
    }
  }
  if (chosen === null) {
    const highest = Math.max(peak.altitudeDeg, ...contacts.map((c) => c.altitudeDeg));
    return { visible: false, reason: highest < 0 ? "below-horizon" : "too-low" };
  }
  return {
    visible: true,
    best: chosen.time,
    altitudeDeg: chosen.altitudeDeg,
    azimuthDeg: chosen.azimuthDeg,
    ...(partly ? { partly: true } : {}),
    ...(chosen.altitudeDeg < EVENT_MIN_ALTITUDE_DEG ? { lowHorizon: true } : {}),
  };
}

// Positions ----------------------------------------------------------------------------------------

/** Topocentric, refracted horizontal position of a body at `time`, like the planet tracks. */
function horizontalPosition(body: Body, site: Site, time: Date): HorizontalPosition {
  const observer = observerFor(site);
  const eq = Equator(body, time, observer, true, true);
  const horizontal = Horizon(time, observer, eq.ra, eq.dec, "normal");
  return { time, altitudeDeg: horizontal.altitude, azimuthDeg: horizontal.azimuth };
}

const MINUTE_MS = 60_000;

function around(centre: Date, semiDurationMinutes: number): Interval {
  return {
    start: new Date(centre.getTime() - semiDurationMinutes * MINUTE_MS),
    end: new Date(centre.getTime() + semiDurationMinutes * MINUTE_MS),
  };
}

// Night spans --------------------------------------------------------------------------------------

/** The night's twilight span (sun at or below `EVENT_SUN_MAX_ALTITUDE_DEG`) and dark window, each `null` when the sun never gets that low. */
interface NightSpans {
  twilight: Interval | null;
  dark: Interval | null;
}

function nightSpans(site: Site, date: string, darkThresholdDeg: number): NightSpans {
  const night = observingNight(date, site.timeZone);
  const twilight = darkWindow(site, night, EVENT_SUN_MAX_ALTITUDE_DEG);
  const dark = darkWindow(site, night, darkThresholdDeg);
  return {
    twilight: twilight.kind === "window" ? { start: twilight.start, end: twilight.end } : null,
    dark: dark.kind === "window" ? { start: dark.start, end: dark.end } : null,
  };
}

/** A span an event is judged over, or `null` when no part of the night is dark enough (the sun never gets to the twilight bound). */
interface EventSpan {
  span: Interval;
  /** The night has no dark window, so the whole twilight span was used. */
  shortNight: boolean;
}

/** The night's dark window, or the whole twilight span flagged `shortNight` when there is none (plan review F5). */
function darkSpan(spans: NightSpans): EventSpan | null {
  if (spans.dark !== null) {
    return { span: spans.dark, shortNight: false };
  }
  return spans.twilight === null ? null : { span: spans.twilight, shortNight: true };
}

/**
 * Where a Mercury or Venus apparition is judged: in the evening from the sun reaching the twilight bound
 * to the dark window's start, in the morning from the dark window's end to the sun returning to the bound
 * (plan review F7a: the span starts at the twilight bound, so a low evening planet is "too low", not
 * "daylight"). Without a dark window the whole twilight span is used and flagged `shortNight`. Where the
 * dark window touches the night's edge there is no twilight band on that side, so the whole twilight span
 * stands in for it.
 */
function elongationSpan(spans: NightSpans, apparition: "morning" | "evening"): EventSpan | null {
  const { twilight, dark } = spans;
  if (twilight === null || dark === null) {
    return darkSpan(spans);
  }
  const band: Interval =
    apparition === "evening" ? { start: twilight.start, end: dark.start } : { start: dark.end, end: twilight.end };
  const empty = band.end.getTime() <= band.start.getTime();
  return { span: empty ? twilight : band, shortNight: false };
}

function nightEventVisibility(site: Site, body: Body, span: EventSpan | null): EventVisibility {
  if (span === null) {
    return { visible: false, reason: "daylight" };
  }
  return withShortNight(
    visibleAt(site, (time) => horizontalPosition(body, site, time), span.span),
    span.shortNight,
  );
}

// Searches -----------------------------------------------------------------------------------------

function lunarKind(kind: EclipseKind): LunarEclipseEvent["eclipseKind"] {
  switch (kind) {
    case EclipseKind.Penumbral:
      return "penumbral";
    case EclipseKind.Partial:
      return "partial";
    case EclipseKind.Total:
      return "total";
    default:
      throw new Error(`Unexpected lunar eclipse kind "${kind}"`);
  }
}

function solarKind(kind: EclipseKind): SolarEclipseEvent["eclipseKind"] {
  switch (kind) {
    case EclipseKind.Partial:
      return "partial";
    case EclipseKind.Annular:
      return "annular";
    case EclipseKind.Total:
      return "total";
    default:
      throw new Error(`Unexpected solar eclipse kind "${kind}"`);
  }
}

function lunarEclipseEvents(site: Site, window: Interval): LunarEclipseEvent[] {
  const events: LunarEclipseEvent[] = [];
  for (
    let eclipse = SearchLunarEclipse(window.start);
    eclipse.peak.date < window.end;
    eclipse = NextLunarEclipse(eclipse.peak)
  ) {
    const moment = eclipse.peak.date;
    const penumbral = around(moment, eclipse.sd_penum);
    const partial = eclipse.sd_partial > 0 ? around(moment, eclipse.sd_partial) : null;
    const total = eclipse.sd_total > 0 ? around(moment, eclipse.sd_total) : null;
    // A penumbral eclipse has no umbral contacts, so its penumbral ends stand in for them.
    const contactTimes = [partial, total].flatMap((phase) => (phase === null ? [] : [phase.start, phase.end]));
    const contacts = (contactTimes.length > 0 ? contactTimes : [penumbral.start, penumbral.end]).map((time) =>
      horizontalPosition(Body.Moon, site, time),
    );
    events.push({
      kind: "lunar-eclipse",
      moment,
      night: observingNightDateFor(moment, site.timeZone),
      visibility: eclipseVisibility(horizontalPosition(Body.Moon, site, moment), contacts),
      eclipseKind: lunarKind(eclipse.kind),
      obscuration: eclipse.obscuration,
      penumbral,
      partial,
      total,
    });
  }
  return events;
}

function solarEclipseEvents(site: Site, window: Interval): SolarEclipseEvent[] {
  const observer = observerFor(site);
  const events: SolarEclipseEvent[] = [];
  /** The Sun at a contact: the search's own refracted altitude, the azimuth from the Sun's position. */
  const sunAt = (contact: EclipseEvent): HorizontalPosition => ({
    ...horizontalPosition(Body.Sun, site, contact.time.date),
    altitudeDeg: contact.altitude,
  });
  for (
    let eclipse = SearchLocalSolarEclipse(window.start, observer);
    eclipse.peak.time.date < window.end;
    eclipse = NextLocalSolarEclipse(eclipse.peak.time, observer)
  ) {
    const moment = eclipse.peak.time.date;
    const central =
      eclipse.total_begin !== undefined && eclipse.total_end !== undefined
        ? { start: eclipse.total_begin.time.date, end: eclipse.total_end.time.date }
        : null;
    events.push({
      kind: "solar-eclipse",
      moment,
      night: observingNightDateFor(moment, site.timeZone),
      visibility: eclipseVisibility(sunAt(eclipse.peak), [sunAt(eclipse.partial_begin), sunAt(eclipse.partial_end)]),
      eclipseKind: solarKind(eclipse.kind),
      obscuration: eclipse.obscuration,
      partial: { start: eclipse.partial_begin.time.date, end: eclipse.partial_end.time.date },
      central,
    });
  }
  return events;
}

const DAY_MS = 86_400_000;

const ELONGATION_BODIES: readonly { key: ElongationBody; body: Body }[] = [
  { key: "mercury", body: Body.Mercury },
  { key: "venus", body: Body.Venus },
];

const OPPOSITION_BODIES: readonly { key: OppositionBody; body: Body }[] = [
  { key: "mars", body: Body.Mars },
  { key: "jupiter", body: Body.Jupiter },
  { key: "saturn", body: Body.Saturn },
];

function elongationEvents(site: Site, window: Interval, darkThresholdDeg: number): ElongationEvent[] {
  const events: ElongationEvent[] = [];
  for (const { key, body } of ELONGATION_BODIES) {
    for (
      let elongation = SearchMaxElongation(body, window.start);
      elongation.time.date < window.end;
      elongation = SearchMaxElongation(body, new Date(elongation.time.date.getTime() + DAY_MS))
    ) {
      const moment = elongation.time.date;
      const night = observingNightDateFor(moment, site.timeZone);
      const apparition = elongation.visibility === "morning" ? "morning" : "evening";
      events.push({
        kind: "elongation",
        moment,
        night,
        visibility: nightEventVisibility(
          site,
          body,
          elongationSpan(nightSpans(site, night, darkThresholdDeg), apparition),
        ),
        body: key,
        elongationDeg: elongation.elongation,
        apparition,
      });
    }
  }
  return events;
}

function oppositionEvents(site: Site, window: Interval, darkThresholdDeg: number): OppositionEvent[] {
  const events: OppositionEvent[] = [];
  for (const { key, body } of OPPOSITION_BODIES) {
    for (
      let opposition = SearchRelativeLongitude(body, 0, window.start);
      opposition.date < window.end;
      opposition = SearchRelativeLongitude(body, 0, new Date(opposition.date.getTime() + DAY_MS))
    ) {
      const moment = opposition.date;
      const night = observingNightDateFor(moment, site.timeZone);
      events.push({
        kind: "opposition",
        moment,
        night,
        visibility: nightEventVisibility(site, body, darkSpan(nightSpans(site, night, darkThresholdDeg))),
        body: key,
      });
    }
  }
  return events;
}

// The window ---------------------------------------------------------------------------------------

/**
 * Every sky event of the `nights` observing nights from `fromNight` (`YYYY-MM-DD`, the site-local evening
 * date, local noon to local noon), in time order. An event belongs to the night that contains its moment,
 * so a daytime eclipse falls in the night that follows it. `darkThresholdDeg` is the sun altitude that
 * defines the night's dark window (the site's Bortle threshold from `darknessThresholdDegForBortle`; the
 * default is astronomical darkness). Throws `RangeError` on a malformed `fromNight` or a negative or
 * fractional `nights`. `options.pairings: false` leaves out the close pairings, the one kind that scans the
 * nights (about half a millisecond a night): for a caller that reads no pairing over years of nights.
 */
export function skyEvents(
  site: Site,
  fromNight: string,
  nights = EVENT_WINDOW_NIGHTS,
  darkThresholdDeg = EVENT_DARK_SUN_ALTITUDE_DEG,
  options: { pairings?: boolean } = {},
): SkyEvent[] {
  if (!Number.isInteger(nights) || nights < 0) {
    throw new RangeError(`Event window must be a whole number of nights, got ${nights}`);
  }
  const window: Interval = {
    start: observingNight(fromNight, site.timeZone).start,
    end: observingNight(addDays(fromNight, nights - 1), site.timeZone).end,
  };
  if (nights === 0) {
    return [];
  }
  const events: SkyEvent[] = [
    ...lunarEclipseEvents(site, window),
    ...solarEclipseEvents(site, window),
    ...elongationEvents(site, window, darkThresholdDeg),
    ...oppositionEvents(site, window, darkThresholdDeg),
    ...(options.pairings === false ? [] : pairingEvents(site, window)),
  ];
  return events.sort((a, b) => a.moment.getTime() - b.moment.getTime());
}
