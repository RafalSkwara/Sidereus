import { getMessages } from "@/i18n";
import {
  addDays,
  EVENT_WINDOW_NIGHTS,
  isNotableEvent,
  observingNightDateFor,
  type SkyEvent,
  type SkyEventKind,
} from "@/lib/engine";
import type { ShowerKey } from "@/lib/catalogue/meteor-showers";
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
   * it counts on its best night (the one before or after), and a solar eclipse that is still to come (or under way)
   * today, which counts on the selected night however its own night falls (the morning eclipse after dawn, the
   * afternoon one the night before). It, not `night`, decides `tonight` and `next`; the page still groups the row by
   * `night`.
   */
  goNight: string;
  /**
   * The name for the dashboard's tile and the verdict line: `name`, and for a close pairing the separation too
   * ("Moon and Jupiter, 1.8° apart"), since the pair alone says nothing about how close it is.
   */
  lineName: string;
  /**
   * The name inside the verdict's sentence ("Tonight: …"): `lineName`, except where Polish words it in its own,
   * lowercase form there (a meteor peak, an opposition, an elongation, an eclipse: "Dziś: maksimum Orionidów",
   * "Dziś: opozycja Marsa", owner 2026-10-14).
   */
  verdictName: string;
  /**
   * A solar eclipse is a daytime event, never "tonight": `at` is the local time to look ("11:22", the best moment,
   * which is the peak when the peak is visible) and `dayWord` its day relative to today's date in the site's zone
   * (`now`), so the verdict line reads "Today, 11:22: …" or "Tomorrow, 11:22: …" (owner decision A, 2026-10-14).
   * `dayWord` is `null` for a later day (the tile then reads the day and time); both are `null` for every other event.
   */
  dayWord: "today" | "tomorrow" | null;
  at: string | null;
  /**
   * When to go, relative to the selected night: "tonight", "tomorrow night" or "night of 12/13 Aug". A solar eclipse
   * is a daytime event, so it reads its day and best time: "Today, 11:22", "Tomorrow, 11:22" or, further out, "Mon 2
   * Aug, 11:22".
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
 * The first notable visible event to go out for from `date` on: the earliest go night, a solar eclipse before anything
 * else on a tie (its safety words must not hide behind another event), then the earlier moment. (The events are in
 * moment order, and a shower's moment can be a night before its go night, so the first of them is not always the
 * soonest.)
 */
function nextEvent(worded: readonly TonightSkyEvent[], date: string): TonightSkyEvent | null {
  let next: TonightSkyEvent | null = null;
  for (const event of worded) {
    if (!event.notable || event.goNight < date) {
      continue;
    }
    if (
      next === null ||
      event.goNight < next.goNight ||
      (event.goNight === next.goNight && event.safety && !next.safety)
    ) {
      next = event;
    }
  }
  return next;
}

/**
 * Words `events` (from `skyEvents(site, date, …)`) for `locale` in `timeZone`. `date` is the selected night
 * (`YYYY-MM-DD`): `tonight` holds that night's notable visible events, solar eclipses first (then by moment), so the
 * eclipse glasses never hide behind "+N more". `now` is the request's clock (the engine takes none): a solar eclipse
 * stays until the end of its partial phase and is dropped from `events`, `tonight` and `next` once that is before
 * `now`; one that is not over counts in `tonight` (and as the soonest `next`) when it is today in the site's zone or
 * belongs to the selected night, and in `next` alone when it is later. Its day is worded from today's date, not from
 * the observing night ("Today, 11:22" / "Tomorrow, 11:22").
 */
export function formatSkyEvents(
  events: readonly SkyEvent[],
  locale: Locale,
  timeZone: string,
  date: string,
  now: Date,
  windowNights = EVENT_WINDOW_NIGHTS,
): TonightSkyEvents {
  const m = getMessages(locale);
  const t = m.tonight.events;
  const { formatTime, formatDayTime, formatNightDate, formatNightSpan, formatDirection, formatDegrees } =
    createFormatter(locale);

  const showerNames: Record<ShowerKey, string> = t.showerName;
  const showerNamesInLine: Record<ShowerKey, string> = t.showerNameInLine;
  // The calendar date (`YYYY-MM-DD`) of an instant in the site's zone.
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const today = localDate.format(now);
  const tomorrow = addDays(today, 1);
  const bodyName = (body: string): string =>
    body === "moon" ? m.targets.moon : (m.targets.planet as Record<string, string>)[body];
  const range = (interval: { start: Date; end: Date }) => ({
    start: formatTime(interval.start, timeZone),
    end: formatTime(interval.end, timeZone),
  });

  const nightsFrom = (night: string): number =>
    Math.round((Date.parse(`${night}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS);

  // A solar eclipse that is over (its partial phase ended before `now`) is gone from every list.
  const live = events.filter((event) => event.kind !== "solar-eclipse" || event.partial.end.getTime() >= now.getTime());

  const worded = live.map((event): TonightSkyEvent => {
    const notes: string[] = [];
    const details: string[] = [];
    let name: string;
    let inLineName: string | null = null;
    let when = formatDayTime(event.moment, timeZone);

    switch (event.kind) {
      case "lunar-eclipse":
        name = t.eclipse.lunar[event.eclipseKind];
        inLineName = t.eclipse.lunarInLine[event.eclipseKind];
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
        inLineName = t.eclipse.solarInLine[event.eclipseKind];
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
        name = t.elongationName[event.body];
        inLineName = t.elongationNameInLine[event.body];
        details.push(
          t.elongationDetail({ deg: formatDegrees(event.elongationDeg), sky: t.apparition[event.apparition] }),
        );
        break;
      case "opposition":
        name = t.oppositionName[event.body];
        inLineName = t.oppositionNameInLine[event.body];
        break;
      case "pairing":
        name = t.pairingName({ first: bodyName(event.bodies[0]), second: bodyName(event.bodies[1]) });
        details.push(t.pairingDetail({ deg: formatDegrees(event.separationDeg) }));
        break;
      case "meteor-shower":
        name = showerNames[event.shower];
        inLineName = showerNamesInLine[event.shower];
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
    // The bright-Moon caveat is viewing advice, so only a shower worth going out for carries it.
    if (visibility.visible && event.kind === "meteor-shower" && event.brightMoon) notes.push(t.brightMoon);

    // A solar eclipse is a daytime event: it reads the time to look (the best moment, the peak when that is visible) and
    // its day against today's date in the site's zone, not against the observing night.
    let at: string | null = null;
    let dayWord: TonightSkyEvent["dayWord"] = null;
    if (event.kind === "solar-eclipse") {
      const shown = visibility.visible ? visibility.best : event.moment;
      at = formatTime(shown, timeZone);
      const shownDate = localDate.format(shown);
      dayWord = shownDate === today ? "today" : shownDate === tomorrow ? "tomorrow" : null;
    }

    // A meteor shower counts on its best night: the night the user should go out, which is not the peak night when
    // the peak falls in daylight. A solar eclipse that is today's, or whose night is already behind the selected one
    // (the morning eclipse after dawn), counts on the selected night: it is still to come.
    const goNight =
      event.kind === "meteor-shower"
        ? event.bestNight
        : event.kind === "solar-eclipse" && (dayWord === "today" || event.night < date)
          ? date
          : event.night;
    const daysAhead = nightsFrom(goNight);
    let nightWhen: string;
    if (event.kind === "solar-eclipse" && at !== null) {
      nightWhen =
        dayWord === "today"
          ? t.when.todayAt({ time: at })
          : dayWord === "tomorrow"
            ? t.when.tomorrowAt({ time: at })
            : formatDayTime(visibility.visible ? visibility.best : event.moment, timeZone);
    } else {
      nightWhen =
        daysAhead === 0
          ? t.when.tonight
          : daysAhead === 1
            ? t.when.tomorrow
            : t.when.night({ span: formatNightSpan(goNight) });
    }

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
      verdictName: inLineName ?? lineName,
      dayWord,
      at,
      nightWhen,
      visible: visibility.visible,
      visibilityText,
      notes,
      notable: isNotableEvent(event),
      safety: event.kind === "solar-eclipse",
    };
  });

  // A solar eclipse first, then by moment (`worded` is in moment order and the split keeps it): the safety words are
  // the one thing the line must never hide behind "+N more".
  const tonightEvents = worded.filter((event) => event.notable && event.goNight === date);
  return {
    events: worded,
    tonight: [...tonightEvents.filter((event) => event.safety), ...tonightEvents.filter((event) => !event.safety)],
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
 * events fall on the night, and for a solar eclipse "eclipse glasses only"; a solar eclipse reads its day and time
 * instead, "Today, 11:22: …" or "Tomorrow, 11:22: …" (owner decision A, 2026-10-14). `null` on a night with none, so
 * the line (and the room it takes) exists only on event nights.
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
  if (first.at !== null && first.dayWord === "today") {
    const time = first.at;
    return more ? t.verdictLineTodayMore({ time, name, count }) : t.verdictLineToday({ time, name });
  }
  if (first.at !== null && first.dayWord === "tomorrow") {
    const time = first.at;
    return more ? t.verdictLineTomorrowMore({ time, name, count }) : t.verdictLineTomorrow({ time, name });
  }
  return more ? t.verdictLineMore({ name, count }) : t.verdictLine({ name });
}
