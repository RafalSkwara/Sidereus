import { getMessages } from "@/i18n";
import {
  EVENT_WINDOW_NIGHTS,
  isNotableEvent,
  observingNightDateFor,
  type SkyEvent,
  type SkyEventKind,
} from "@/lib/engine";
import type { Locale } from "@/lib/preferences";

import { createFormatter } from "./format";

const DAY_MS = 86_400_000;

/**
 * The sky events as the Tonight view carries them (M-3 S-07, sky-events Phase 4): the engine's events worded for the
 * page in the site's time zone and the user's locale, so the page, the dashboard tile and the verdict line render
 * without logic. Pure and deterministic for identical inputs. The visibility words come only from the event's own
 * `visibility` (one rule, in the engine), so a not-visible event can never read as something to go out for.
 */

/** One event, worded for the page. */
export interface TonightSkyEvent {
  kind: SkyEventKind;
  /** The display name: "Perseids peak", "Total solar eclipse", "Moon and Jupiter", "Mars at opposition". */
  name: string;
  /** The kind's own name ("Meteor shower"), for the row's caption. */
  kindLabel: string;
  /** "Sat 10 Oct, 21:30" in the site's zone; for a meteor shower "Peak night", never a minute (maxima are known to about a day). */
  when: string;
  /** Short facts under `when`: the separation, the elongation, the phases' local times. */
  details: string[];
  /** The observing night (`YYYY-MM-DD`) the event belongs to, and its label ("Saturday, 10 October 2026"). */
  night: string;
  nightLabel: string;
  /**
   * The night to go out for it (`YYYY-MM-DD`): `night`, except a meteor shower, whose peak can fall in daylight, so
   * it counts on its best night (the one before or after). It, not `night`, decides `tonight` and `next`; the page
   * still groups the row by `night`.
   */
  goNight: string;
  /**
   * The name for the dashboard's tile and the verdict line: `name`, and for a close pairing the separation too
   * ("Moon and Jupiter, 1.8° apart"), since the pair alone says nothing about how close it is.
   */
  lineName: string;
  /**
   * The name inside the verdict's sentence ("Tonight: …"): `lineName`, except a meteor shower, which Polish words in
   * its own form there ("Dziś: maksimum Orionidów", owner 2026-10-14).
   */
  verdictName: string;
  /**
   * A solar eclipse after the night's midnight happens tomorrow in daytime, not tonight: its local time ("11:22"), so
   * the verdict line reads "Tomorrow, 11:22: …" (owner, 2026-10-14). `null` for every other event.
   */
  tomorrowAt: string | null;
  /**
   * When to go, relative to the selected night: "tonight", "tomorrow night" or "night of 12/13 Aug". A solar eclipse
   * is a daytime event, so it reads the day and time of its own moment ("Mon 2 Aug, 12:03").
   */
  nightWhen: string;
  visible: boolean;
  /** Visible: the best time, altitude and compass point ("Best 22:40 · SW, 45°"); not visible: the reason ("Below your horizon"). */
  visibilityText: string;
  /** Qualifiers: only partly visible, low horizon, short night, bright Moon, barely noticeable. */
  notes: string[];
  /** Visible and not a penumbral lunar eclipse (owner decision 4): the dashboard tile and the verdict line read only these. */
  notable: boolean;
  /** A solar eclipse, visible or not: the page always shows the fixed eye-safety line. */
  safety: boolean;
}

/** The events block of a `TonightView`. */
export interface TonightSkyEvents {
  /** Every event of the window, in time order (not only the visible ones). */
  events: TonightSkyEvent[];
  /** The notable visible events of the selected night. */
  tonight: TonightSkyEvent[];
  /** The first notable visible event from the selected night on; `null` when there is none in the window. */
  next: TonightSkyEvent | null;
  /** How many nights the window spans. */
  windowNights: number;
}

/**
 * The first notable visible event to go out for from `date` on: the earliest go night, the earlier moment on a tie.
 * (The events are in moment order, and a shower's moment can be a night before its go night, so the first of them
 * is not always the soonest.)
 */
function nextEvent(worded: readonly TonightSkyEvent[], date: string): TonightSkyEvent | null {
  let next: TonightSkyEvent | null = null;
  for (const event of worded) {
    if (event.notable && event.goNight >= date && (next === null || event.goNight < next.goNight)) {
      next = event;
    }
  }
  return next;
}

/**
 * Words `events` (from `skyEvents(site, date, …)`) for `locale` in `timeZone`. `date` is the selected night
 * (`YYYY-MM-DD`): `tonight` holds that night's notable visible events.
 */
export function formatSkyEvents(
  events: readonly SkyEvent[],
  locale: Locale,
  timeZone: string,
  date: string,
  windowNights = EVENT_WINDOW_NIGHTS,
): TonightSkyEvents {
  const m = getMessages(locale);
  const t = m.tonight.events;
  const { formatTime, formatDayTime, formatNightDate, formatNightSpan, formatDirection, formatDegrees } =
    createFormatter(locale);

  const showerNames: Record<string, string> = t.showerName;
  const showerNamesInLine: Record<string, string> = t.showerNameInLine;
  // The calendar date (`YYYY-MM-DD`) of an instant in the site's zone.
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const bodyName = (body: string): string =>
    body === "moon" ? m.targets.moon : (m.targets.planet as Record<string, string>)[body];
  const range = (interval: { start: Date; end: Date }) => ({
    start: formatTime(interval.start, timeZone),
    end: formatTime(interval.end, timeZone),
  });

  const nightsFrom = (night: string): number =>
    Math.round((Date.parse(`${night}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS);

  const worded = events.map((event): TonightSkyEvent => {
    const notes: string[] = [];
    const details: string[] = [];
    let name: string;
    let when = formatDayTime(event.moment, timeZone);

    switch (event.kind) {
      case "lunar-eclipse":
        name = t.eclipse.lunar[event.eclipseKind];
        if (event.eclipseKind === "penumbral") {
          details.push(t.eclipse.penumbralPhase(range(event.penumbral)));
          notes.push(t.eclipse.barelyNoticeable);
        } else {
          if (event.partial !== null) details.push(t.eclipse.partialPhase(range(event.partial)));
          if (event.total !== null) details.push(t.eclipse.totalPhase(range(event.total)));
        }
        break;
      case "solar-eclipse":
        name = t.eclipse.solar[event.eclipseKind];
        details.push(t.eclipse.sunCovered({ percent: formatDegrees(Math.round(event.obscuration * 100)) }));
        details.push(t.eclipse.partialPhase(range(event.partial)));
        if (event.central !== null) {
          details.push(
            event.eclipseKind === "annular"
              ? t.eclipse.annularPhase(range(event.central))
              : t.eclipse.totalPhase(range(event.central)),
          );
        }
        break;
      case "elongation":
        name = t.elongationName({ body: bodyName(event.body) });
        details.push(
          t.elongationDetail({ deg: formatDegrees(event.elongationDeg), sky: t.apparition[event.apparition] }),
        );
        break;
      case "opposition":
        name = t.oppositionName({ body: bodyName(event.body) });
        break;
      case "pairing":
        name = t.pairingName({ first: bodyName(event.bodies[0]), second: bodyName(event.bodies[1]) });
        details.push(t.pairingDetail({ deg: formatDegrees(event.separationDeg) }));
        break;
      case "meteor-shower":
        name = showerNames[event.shower] ?? event.shower;
        when = t.showerWhen;
        break;
    }

    const { visibility } = event;
    let visibilityText: string;
    if (visibility.visible) {
      const direction = formatDirection({ azimuthDeg: visibility.azimuthDeg, altitudeDeg: visibility.altitudeDeg });
      // A time on the event's own night reads as "22:40"; one on another night names its day too.
      const time =
        observingNightDateFor(visibility.best, timeZone) === event.night
          ? formatTime(visibility.best, timeZone)
          : formatDayTime(visibility.best, timeZone);
      if (event.kind === "meteor-shower") {
        visibilityText =
          event.bestNight === event.night
            ? t.bestRadiant({ time, direction })
            : event.bestNight < event.night
              ? t.bestNightBefore({ time, direction })
              : t.bestNightAfter({ time, direction });
      } else {
        visibilityText = t.best({ time, direction });
      }
      if (visibility.partly) notes.push(t.partly);
      if (visibility.lowHorizon) notes.push(t.lowHorizon);
    } else {
      visibilityText = t.reason[visibility.reason];
    }
    if (visibility.shortNight) notes.push(t.shortNight);
    if (event.kind === "meteor-shower" && event.brightMoon) notes.push(t.brightMoon);

    // A meteor shower counts on its best night: the night the user should go out, which is not the peak night when
    // the peak falls in daylight.
    const goNight = event.kind === "meteor-shower" ? event.bestNight : event.night;
    const daysAhead = nightsFrom(goNight);
    const nightWhen =
      event.kind === "solar-eclipse"
        ? when
        : daysAhead === 0
          ? t.when.tonight
          : daysAhead === 1
            ? t.when.tomorrow
            : t.when.night({ span: formatNightSpan(goNight) });

    const lineName = event.kind === "pairing" ? `${name}, ${details[0]}` : name;

    return {
      kind: event.kind,
      name,
      kindLabel: t.kind[event.kind],
      when,
      details,
      night: event.night,
      nightLabel: formatNightDate(event.night),
      goNight,
      lineName,
      verdictName: event.kind === "meteor-shower" ? (showerNamesInLine[event.shower] ?? lineName) : lineName,
      tomorrowAt:
        event.kind === "solar-eclipse" && localDate.format(event.moment) > event.night
          ? formatTime(event.moment, timeZone)
          : null,
      nightWhen,
      visible: visibility.visible,
      visibilityText,
      notes,
      notable: isNotableEvent(event),
      safety: event.kind === "solar-eclipse",
    };
  });

  return {
    events: worded,
    tonight: worded.filter((event) => event.notable && event.goNight === date),
    next: nextEvent(worded, date),
    windowNights,
  };
}

/**
 * The dashboard tile's line (owner decision 5): the next notable event and when to go, "Perseids peak · night of
 * 12/13 Aug" or "Moon and Jupiter, 1.8° apart · tonight", and for a solar eclipse "eclipse glasses only" besides.
 * Nothing to go out for in the window reads `eventsNone`; a view without the block reads the unavailable line.
 */
export function eventsTileLine(events: TonightSkyEvents | null, locale: Locale): string {
  const m = getMessages(locale);
  if (events === null) {
    return m.tonight.pages.events.unavailable;
  }
  const { next } = events;
  if (next === null) {
    return m.tonight.summary.eventsNone({ count: String(events.windowNights) });
  }
  const parts = [next.lineName, next.nightWhen];
  if (next.safety) {
    parts.push(m.tonight.events.glassesOnly);
  }
  return parts.join(m.tonight.summary.separator);
}

/**
 * The verdict's muted line (owner decision 5, F3): "Tonight: Perseids peak", plus "+1 more" when several notable
 * events fall on the night, and for a solar eclipse "eclipse glasses only"; a solar eclipse after the night's
 * midnight reads "Tomorrow, 11:22: …" instead (owner, 2026-10-14). `null` on a night with none, so the line (and the
 * room it takes) exists only on event nights.
 */
export function eventsVerdictLine(events: TonightSkyEvents | null, locale: Locale): string | null {
  const first = events?.tonight[0];
  if (events === null || first === undefined) {
    return null;
  }
  const t = getMessages(locale).tonight.events;
  const name = first.safety ? t.withGlasses({ name: first.verdictName }) : first.verdictName;
  const count = String(events.tonight.length - 1);
  const more = events.tonight.length > 1;
  if (first.tomorrowAt !== null) {
    const time = first.tomorrowAt;
    return more ? t.verdictLineTomorrowMore({ time, name, count }) : t.verdictLineTomorrow({ time, name });
  }
  return more ? t.verdictLineMore({ name, count }) : t.verdictLine({ name });
}
