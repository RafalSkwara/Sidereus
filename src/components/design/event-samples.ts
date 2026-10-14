import { darknessThresholdDegForBortle, skyEvents } from "@/lib/engine";
import { getMessages } from "@/i18n";
import { toEngineSite, type SiteRecord } from "@/lib/gear/store";
import type { Locale } from "@/lib/preferences";
import { createFormatter } from "@/lib/tonight/format";
import {
  eventsVerdictLine,
  formatSkyEvents,
  type TonightSkyEvent,
  type TonightSkyEvents,
} from "@/lib/tonight/sky-events";

/**
 * Sample sky events for the /design specimens (dev only), from fixed data: no clock, no network. The dashboard's
 * tile and verdict-line specimens word hand-made events through the catalogue (so they follow the page's language);
 * the list specimens are the engine's real answer for a fixed site and night, a window that holds the total solar
 * eclipse of 2027-08-02 (sky-events Phase 4's manual check 4.4).
 */

/** The night the list specimens start from: the 2027-08-02 solar eclipse falls in the next 30 nights. */
export const SAMPLE_EVENTS_NIGHT = "2027-07-25";

const WARSAW: SiteRecord = {
  id: "sample-site",
  name: "Back garden",
  latitudeDeg: 52.23,
  longitudeDeg: 21.01,
  bortle: 4,
  minAltitudeDeg: 15,
  timeZone: "Europe/Warsaw",
  timeZoneSource: "auto",
  createdAt: "2026-09-01T00:00:00Z",
};

/** 10° N, 47° W: the 2027-08-02 eclipse ends there with the Sun under the eclipse bar, so it is not visible. */
const BELEM: SiteRecord = { ...WARSAW, latitudeDeg: 10, longitudeDeg: -47, timeZone: "America/Belem" };

function wordedEventsAt(site: SiteRecord, locale: Locale, night = SAMPLE_EVENTS_NIGHT): TonightSkyEvents {
  return formatSkyEvents(
    skyEvents(toEngineSite(site), night, 30, darknessThresholdDegForBortle(site.bortle)),
    locale,
    site.timeZone,
    night,
    // The evening the window starts: the 2027-08-02 eclipse is then still ahead, and not yet over.
    new Date(`${night}T18:00:00Z`),
  );
}

export interface EventSamples {
  /** One notable event tonight, several (the line says "+1 more"), and a solar eclipse (eclipse glasses only). */
  verdictLines: { label: string; line: string }[];
  /** The tile's lines: an event tonight, one on a later night, a solar eclipse, none in the window, unavailable. */
  tiles: { label: string; events: TonightSkyEvents | null }[];
  /** Warsaw, 2027-07-25 + 30 nights: the visible solar eclipse with its safety line, other visible rows and not-visible ones. */
  list: TonightSkyEvents;
  /** The same window at a site where the solar eclipse is not visible: its row is muted and still carries the safety line. */
  listNotVisibleEclipse: TonightSkyEvent[];
}

export function eventSamples(locale: Locale): EventSamples {
  const m = getMessages(locale);
  const t = m.tonight.events;
  const { formatNightSpan, formatTime, formatDegrees } = createFormatter(locale);

  const base: TonightSkyEvent = {
    kind: "meteor-shower",
    name: t.showerName.orionids,
    kindLabel: t.kind["meteor-shower"],
    when: t.showerWhen,
    details: [],
    night: "2026-10-10",
    nightLabel: "",
    goNight: "2026-10-10",
    lineName: t.showerName.orionids,
    verdictName: t.showerNameInLine.orionids,
    dayWord: null,
    at: null,
    nightWhen: t.when.tonight,
    visible: true,
    visibilityText: "",
    notes: [],
    notable: true,
    safety: false,
  };
  const pairingName = t.pairingName({ first: m.targets.moon, second: m.targets.planet.jupiter });
  const pairingDetail = t.pairingDetail({ deg: formatDegrees(1.8) });
  const pairing: TonightSkyEvent = {
    ...base,
    kind: "pairing",
    name: pairingName,
    kindLabel: t.kind.pairing,
    details: [pairingDetail],
    lineName: `${pairingName}, ${pairingDetail}`,
    verdictName: `${pairingName}, ${pairingDetail}`,
  };
  // The 2027-08-02 eclipse at Warsaw, seen the evening before: its local peak is 09:22 UTC (11:22), so the verdict line
  // reads "Tomorrow, 11:22: …" (owner decision A, 2026-10-14).
  const eclipseMoment = new Date("2027-08-02T09:22:00Z");
  const eclipseAt = formatTime(eclipseMoment, "Europe/Warsaw");
  const eclipse: TonightSkyEvent = {
    ...base,
    kind: "solar-eclipse",
    name: t.eclipse.solar.partial,
    kindLabel: t.kind["solar-eclipse"],
    lineName: t.eclipse.solar.partial,
    verdictName: t.eclipse.solarInLine.partial,
    dayWord: "tomorrow",
    at: eclipseAt,
    nightWhen: t.when.tomorrowAt({ time: eclipseAt }),
    safety: true,
  };
  const geminids: TonightSkyEvent = {
    ...base,
    name: t.showerName.geminids,
    lineName: t.showerName.geminids,
    verdictName: t.showerNameInLine.geminids,
    night: "2026-12-13",
    goNight: "2026-12-13",
    nightWhen: t.when.night({ span: formatNightSpan("2026-12-13") }),
  };
  const block = (overrides: Partial<TonightSkyEvents>): TonightSkyEvents => ({
    events: [],
    tonight: [],
    next: null,
    windowNights: 30,
    ...overrides,
  });

  const tonightOne = block({ tonight: [base], next: base });
  const tonightMany = block({ tonight: [base, pairing], next: base });
  const tonightEclipse = block({ tonight: [eclipse], next: eclipse });
  const tomorrow = block({ next: { ...pairing, nightWhen: t.when.tomorrow } });
  const later = block({ next: geminids });
  const none = block({});

  return {
    verdictLines: [
      { label: "one event tonight", line: eventsVerdictLine(tonightOne, locale) ?? "" },
      { label: "several events tonight: the first and “+1 more”", line: eventsVerdictLine(tonightMany, locale) ?? "" },
      {
        label: "a solar eclipse the next day: “Tomorrow, 11:22”, eclipse glasses only",
        line: eventsVerdictLine(tonightEclipse, locale) ?? "",
      },
    ],
    tiles: [
      { label: "an event tonight (a close pairing)", events: block({ next: pairing }) },
      { label: "tomorrow night", events: tomorrow },
      { label: "a later night (a meteor shower)", events: later },
      { label: "a solar eclipse: eclipse glasses only", events: tonightEclipse },
      { label: "none in the window", events: none },
      { label: "unavailable (working them out failed)", events: null },
    ],
    list: wordedEventsAt(WARSAW, locale),
    listNotVisibleEclipse: wordedEventsAt(BELEM, locale).events.filter((event) => event.kind === "solar-eclipse"),
  };
}
