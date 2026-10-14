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
  const { formatTime, formatDayTime, formatNightDate, formatDirection, formatDegrees } = createFormatter(locale);

  const showers: Record<string, string> = m.targets.meteorShower;
  const bodyName = (body: string): string =>
    body === "moon" ? m.targets.moon : (m.targets.planet as Record<string, string>)[body];
  const range = (interval: { start: Date; end: Date }) => ({
    start: formatTime(interval.start, timeZone),
    end: formatTime(interval.end, timeZone),
  });

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
        name = t.showerName({ shower: showers[event.shower] ?? event.shower });
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

    return {
      kind: event.kind,
      name,
      kindLabel: t.kind[event.kind],
      when,
      details,
      night: event.night,
      nightLabel: formatNightDate(event.night),
      visible: visibility.visible,
      visibilityText,
      notes,
      notable: isNotableEvent(event),
      safety: event.kind === "solar-eclipse",
    };
  });

  return {
    events: worded,
    tonight: worded.filter((event) => event.notable && event.night === date),
    next: worded.find((event) => event.notable && event.night >= date) ?? null,
    windowNights,
  };
}
