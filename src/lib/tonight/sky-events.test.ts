import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";
import { skyEvents, tonightDateFor } from "@/lib/engine";
import type { Site, SkyEvent } from "@/lib/engine";
import { TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG } from "@/lib/engine/parameters";

import {
  eventsTileLine,
  eventsVerdictLine,
  formatSkyEvents,
  type TonightSkyEvent,
  type TonightSkyEvents,
} from "./sky-events";

/*
 * The dashboard's two lines over the sky events (sky-events Phase 5): the tile's "next" line and the verdict's muted
 * "Tonight: ..." line. The events are literals, so the wording is pinned without the engine. The last two blocks word
 * a solar eclipse from the real engine at fixed clocks (owner decision A, 2026-10-14, impl review F2).
 */

const event = (overrides: Partial<TonightSkyEvent>): TonightSkyEvent => ({
  kind: "meteor-shower",
  name: "Perseids peak",
  kindLabel: "Meteor shower",
  when: "Peak night",
  details: [],
  night: "2027-08-12",
  nightLabel: "Thursday, 12 August 2027",
  goNight: "2027-08-12",
  lineName: "Perseids peak",
  verdictName: "Perseids peak",
  dayWord: null,
  at: null,
  nightWhen: "night of 12/13 Aug",
  visible: true,
  visibilityText: "Radiant highest 03:10 · NE, 62°",
  notes: [],
  notable: true,
  safety: false,
  ...overrides,
});

const eclipse = event({
  kind: "solar-eclipse",
  name: "Partial solar eclipse",
  lineName: "Partial solar eclipse",
  verdictName: "Partial solar eclipse",
  nightWhen: "Mon 2 Aug, 11:22",
  safety: true,
});
const pairing = event({
  kind: "pairing",
  name: "Moon and Jupiter",
  lineName: "Moon and Jupiter, 1.8° apart",
  verdictName: "Moon and Jupiter, 1.8° apart",
  details: ["1.8° apart"],
  nightWhen: "tonight",
});

const block = (overrides: Partial<TonightSkyEvents>): TonightSkyEvents => ({
  events: [],
  tonight: [],
  next: null,
  windowNights: 30,
  ...overrides,
});

describe("the events tile's line", () => {
  it("names the next event and when to go", () => {
    expect(eventsTileLine(block({ next: event({}) }), "en")).toBe("Perseids peak · night of 12/13 Aug");
    expect(eventsTileLine(block({ next: pairing }), "en")).toBe("Moon and Jupiter, 1.8° apart · tonight");
  });

  it("adds 'eclipse glasses only' to a solar eclipse", () => {
    expect(eventsTileLine(block({ next: eclipse }), "en")).toBe(
      `Partial solar eclipse · Mon 2 Aug, 11:22 · ${en.tonight.events.glassesOnly}`,
    );
    expect(eventsTileLine(block({ next: eclipse }), "pl")).toContain(pl.tonight.events.glassesOnly);
  });

  it("says there is nothing to go out for, or that the events are unavailable, and never invents an event", () => {
    expect(eventsTileLine(block({}), "en")).toBe("Nothing to go out for in the next 30 nights");
    expect(eventsTileLine(block({}), "pl")).toBe(pl.tonight.summary.eventsNone({ count: "30" }));
    expect(eventsTileLine(null, "en")).toBe(en.tonight.pages.events.unavailable);
  });
});

describe("the verdict's event line", () => {
  it("is absent on a night without a notable visible event", () => {
    expect(eventsVerdictLine(block({}), "en")).toBeNull();
    expect(eventsVerdictLine(null, "en")).toBeNull();
    // Only `tonight` counts: a later event is the tile's, not the verdict's.
    expect(eventsVerdictLine(block({ next: event({}) }), "en")).toBeNull();
  });

  it("names one event, plus '+1 more' when several fall on the night", () => {
    expect(eventsVerdictLine(block({ tonight: [event({})] }), "en")).toBe("Tonight: Perseids peak");
    expect(eventsVerdictLine(block({ tonight: [pairing] }), "en")).toBe("Tonight: Moon and Jupiter, 1.8° apart");
    expect(eventsVerdictLine(block({ tonight: [event({}), pairing] }), "en")).toBe("Tonight: Perseids peak +1 more");
    expect(eventsVerdictLine(block({ tonight: [event({}), pairing, eclipse] }), "en")).toBe(
      "Tonight: Perseids peak +2 more",
    );
    expect(eventsVerdictLine(block({ tonight: [event({}), pairing] }), "pl")).toBe("Dziś: Perseids peak +1 więcej");
  });

  it("reads 'eclipse glasses only' for a solar eclipse", () => {
    expect(eventsVerdictLine(block({ tonight: [eclipse] }), "en")).toBe(
      "Tonight: Partial solar eclipse, eclipse glasses only",
    );
    expect(eventsVerdictLine(block({ tonight: [eclipse] }), "pl")).toBe(
      "Dziś: Partial solar eclipse, tylko przez okulary do zaćmień",
    );
  });

  it("reads 'Tomorrow, <time>' and 'Today, <time>' for a solar eclipse, a daytime event (owner decision A, 2026-10-14)", () => {
    const tomorrow = { ...eclipse, dayWord: "tomorrow" as const, at: "11:22" };
    expect(eventsVerdictLine(block({ tonight: [tomorrow] }), "en")).toBe(
      "Tomorrow, 11:22: Partial solar eclipse, eclipse glasses only",
    );
    expect(eventsVerdictLine(block({ tonight: [tomorrow] }), "pl")).toBe(
      "Jutro, 11:22: Partial solar eclipse, tylko przez okulary do zaćmień",
    );
    expect(eventsVerdictLine(block({ tonight: [tomorrow, pairing] }), "en")).toBe(
      "Tomorrow, 11:22: Partial solar eclipse, eclipse glasses only +1 more",
    );
    const today = { ...eclipse, dayWord: "today" as const, at: "17:04" };
    expect(eventsVerdictLine(block({ tonight: [today] }), "en")).toBe(
      "Today, 17:04: Partial solar eclipse, eclipse glasses only",
    );
    expect(eventsVerdictLine(block({ tonight: [today] }), "pl")).toBe(
      "Dziś, 17:04: Partial solar eclipse, tylko przez okulary do zaćmień",
    );
    expect(eventsVerdictLine(block({ tonight: [today, pairing] }), "pl")).toBe(
      "Dziś, 17:04: Partial solar eclipse, tylko przez okulary do zaćmień +1 więcej",
    );
  });

  it("uses the in-sentence name, which Polish words as 'maksimum Orionidów' (owner, 2026-10-14)", () => {
    const orionids = event({
      name: "Maksimum Orionidów",
      lineName: "Maksimum Orionidów",
      verdictName: "maksimum Orionidów",
    });
    expect(eventsVerdictLine(block({ tonight: [orionids] }), "pl")).toBe("Dziś: maksimum Orionidów");
  });
});

/** A literal engine event, for the cases the real engine cannot arrange on a fixed date. */
function engineEvent(event: Partial<SkyEvent> & Pick<SkyEvent, "kind" | "moment" | "night">): SkyEvent {
  return event as SkyEvent;
}

describe("a solar eclipse is first on the line, so its glasses never hide behind '+N more' (impl review F3)", () => {
  const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };
  const visible = { visible: true, best: new Date("2027-08-01T20:00:00Z"), altitudeDeg: 30, azimuthDeg: 200 } as const;

  // A pairing in the evening of the night of 2027-08-01, then the morning's solar eclipse of 2027-08-02.
  const evening = engineEvent({
    kind: "pairing",
    moment: new Date("2027-08-01T20:00:00Z"),
    night: "2027-08-01",
    bodies: ["venus", "jupiter"],
    separationDeg: 1.8,
    visibility: visible,
  });
  const morning = engineEvent({
    kind: "solar-eclipse",
    moment: new Date("2027-08-02T09:22:00Z"),
    night: "2027-08-01",
    eclipseKind: "partial",
    obscuration: 0.3,
    partial: { start: new Date("2027-08-02T08:26:00Z"), end: new Date("2027-08-02T10:19:00Z") },
    central: null,
    visibility: { ...visible, best: new Date("2027-08-02T09:22:00Z"), altitudeDeg: 52 },
  });
  const now = new Date("2027-08-01T18:00:00Z");

  it("names the eclipse with 'eclipse glasses only' and '+1 more' when a pairing comes before it on the night", () => {
    const worded = formatSkyEvents([evening, morning], "en", WARSAW.timeZone, "2027-08-01", now);
    expect(worded.tonight.map((event) => event.kind)).toEqual(["solar-eclipse", "pairing"]);
    expect(eventsVerdictLine(worded, "en")).toBe(
      "Tomorrow, 11:22: Partial solar eclipse, eclipse glasses only +1 more",
    );
    const pl = formatSkyEvents([evening, morning], "pl", WARSAW.timeZone, "2027-08-01", now);
    expect(eventsVerdictLine(pl, "pl")).toBe(
      "Jutro, 11:22: częściowe zaćmienie Słońca, tylko przez okulary do zaćmień +1 więcej",
    );
  });

  it("breaks a tie for `next` in the eclipse's favour, whichever came first", () => {
    const worded = formatSkyEvents([evening, morning], "en", WARSAW.timeZone, "2027-08-01", now);
    expect(worded.next?.kind).toBe("solar-eclipse");
    expect(eventsTileLine(worded, "en")).toBe("Partial solar eclipse · Tomorrow, 11:22 · eclipse glasses only");
  });
});

describe("a solar eclipse stays until its partial phase ends, worded from today's date (owner decision A, 2026-10-14, F2)", () => {
  const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };
  const LISBON: Site = { latitudeDeg: 38.72, longitudeDeg: -9.14, timeZone: "Europe/Lisbon" };

  /** What Tonight builds at `clock`: the night the page shows, the engine's window from it, the events worded at `clock`. */
  function at(site: Site, clock: string, locale: "en" | "pl" = "en") {
    const now = new Date(clock);
    const date = tonightDateFor(site, now, TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG);
    return { date, block: formatSkyEvents(skyEvents(site, date), locale, site.timeZone, date, now) };
  }
  const solar = (block: TonightSkyEvents) => block.events.find((event) => event.kind === "solar-eclipse");

  describe("the 2027-08-02 eclipse at Warsaw (peak 11:22 CEST, over at 12:19)", () => {
    it("at 02:00 on the day, still the night of 08-01, reads 'Today, 11:22'", () => {
      const { date, block } = at(WARSAW, "2027-08-02T00:00:00Z");
      expect(date).toBe("2027-08-01");
      expect(block.tonight[0]?.kind).toBe("solar-eclipse");
      expect(block.tonight[0]?.dayWord).toBe("today");
      expect(eventsVerdictLine(block, "en")).toMatch(
        /^Today, 11:22: Partial solar eclipse, eclipse glasses only( \+\d+ more)?$/,
      );
      expect(eventsTileLine(block, "en")).toBe("Partial solar eclipse · Today, 11:22 · eclipse glasses only");
    });

    it("the evening before, at 20:00, reads 'Tomorrow, 11:22'", () => {
      const { date, block } = at(WARSAW, "2027-08-01T18:00:00Z");
      expect(date).toBe("2027-08-01");
      expect(block.tonight[0]?.dayWord).toBe("tomorrow");
      expect(eventsVerdictLine(block, "en")).toMatch(
        /^Tomorrow, 11:22: Partial solar eclipse, eclipse glasses only( \+\d+ more)?$/,
      );
      expect(eventsTileLine(block, "en")).toBe("Partial solar eclipse · Tomorrow, 11:22 · eclipse glasses only");
    });

    it("at 07:00, after dawn when the night is 08-02, is still shown as 'Today, 11:22' on the tile, the line and in `events`", () => {
      const { date, block } = at(WARSAW, "2027-08-02T05:00:00Z");
      expect(date).toBe("2027-08-02");
      const eclipse = solar(block);
      expect(eclipse?.night).toBe("2027-08-01");
      expect(eclipse?.dayWord).toBe("today");
      expect(eclipse?.at).toBe("11:22");
      expect(block.tonight[0]).toEqual(eclipse);
      expect(block.next).toEqual(eclipse);
      expect(eventsVerdictLine(block, "en")).toMatch(
        /^Today, 11:22: Partial solar eclipse, eclipse glasses only( \+\d+ more)?$/,
      );
      expect(eventsTileLine(block, "en")).toBe("Partial solar eclipse · Today, 11:22 · eclipse glasses only");
    });

    it("in Polish reads 'Dziś, 11:22: częściowe zaćmienie Słońca, tylko przez okulary do zaćmień', no double colon", () => {
      const { block } = at(WARSAW, "2027-08-02T05:00:00Z", "pl");
      const line = eventsVerdictLine(block, "pl") ?? "";
      expect(line).toMatch(/^Dziś, 11:22: częściowe zaćmienie Słońca, tylko przez okulary do zaćmień( \+\d+ więcej)?$/);
      expect(eventsTileLine(block, "pl")).toBe(
        "Częściowe zaćmienie Słońca · Dziś, 11:22 · tylko przez okulary do zaćmień",
      );
    });

    it("is still there until the partial phase ends (12:00 local) and gone from `events`, `tonight` and `next` after it (13:00 local)", () => {
      const during = at(WARSAW, "2027-08-02T10:00:00Z").block;
      expect(solar(during)).toBeDefined();
      expect(during.tonight[0]?.kind).toBe("solar-eclipse");

      const { date, block: after } = at(WARSAW, "2027-08-02T11:00:00Z");
      expect(date).toBe("2027-08-02");
      expect(solar(after)).toBeUndefined();
      expect(after.tonight.some((event) => event.kind === "solar-eclipse")).toBe(false);
      expect(after.next?.kind).not.toBe("solar-eclipse");
      expect(eventsVerdictLine(after, "en") ?? "").not.toContain("eclipse");
      expect(eventsTileLine(after, "en")).not.toContain("eclipse");
    });
  });

  describe("an afternoon eclipse: 2028-01-26 at Lisbon (peak 16:54, the Sun sets at 17:2x, partial phase over at 18:07)", () => {
    it("reads 'Today, 16:54' on its day, never 'Tonight', from the morning until it ends", () => {
      for (const clock of ["2028-01-26T08:00:00Z", "2028-01-26T17:30:00Z"]) {
        const { date, block } = at(LISBON, clock);
        expect(date, clock).toBe("2028-01-26");
        expect(block.tonight[0]?.dayWord, clock).toBe("today");
        expect(eventsVerdictLine(block, "en"), clock).toMatch(
          /^Today, 16:54: Partial solar eclipse, eclipse glasses only( \+\d+ more)?$/,
        );
        expect(eventsTileLine(block, "en"), clock).toBe("Partial solar eclipse · Today, 16:54 · eclipse glasses only");
      }
    });

    it("the day before reads 'Tomorrow, 16:54' on the tile, and is not tonight's event", () => {
      const { date, block } = at(LISBON, "2028-01-25T21:00:00Z");
      expect(date).toBe("2028-01-25");
      expect(solar(block)?.dayWord).toBe("tomorrow");
      expect(block.tonight.some((event) => event.kind === "solar-eclipse")).toBe(false);
      expect(eventsTileLine(block, "en")).toBe("Partial solar eclipse · Tomorrow, 16:54 · eclipse glasses only");
    });

    it("is gone from every list once its partial phase has ended (18:30)", () => {
      const { block } = at(LISBON, "2028-01-26T18:30:00Z");
      expect(solar(block)).toBeUndefined();
      expect(block.tonight.some((event) => event.kind === "solar-eclipse")).toBe(false);
      expect(block.next?.kind).not.toBe("solar-eclipse");
    });
  });

  it("names a later eclipse by its day and time, as 'next' only", () => {
    const { block } = at(WARSAW, "2027-07-25T18:00:00Z");
    const eclipse = solar(block);
    expect(eclipse?.dayWord).toBeNull();
    expect(eclipse?.at).toBe("11:22");
    expect(eclipse?.nightWhen).toBe("Mon 2 Aug, 11:22");
    expect(block.tonight.some((event) => event.kind === "solar-eclipse")).toBe(false);
  });
});

describe("the Polish wording of the line", () => {
  const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };
  const worded = (events: SkyEvent[], locale: "en" | "pl") =>
    formatSkyEvents(events, locale, WARSAW.timeZone, "2027-02-10", new Date("2027-02-10T18:00:00Z"));
  const opposition = engineEvent({
    kind: "opposition",
    moment: new Date("2027-02-11T00:17:00Z"),
    night: "2027-02-10",
    body: "mars",
    visibility: { visible: true, best: new Date("2027-02-10T23:00:00Z"), altitudeDeg: 50, azimuthDeg: 180 },
  });
  const elongation = engineEvent({
    kind: "elongation",
    moment: new Date("2027-02-10T23:00:00Z"),
    night: "2027-02-10",
    body: "mercury",
    elongationDeg: 18.1,
    apparition: "evening",
    visibility: { visible: true, best: new Date("2027-02-10T17:30:00Z"), altitudeDeg: 12, azimuthDeg: 250 },
  });

  it("puts a planet's title with no colon on the tile and a lowercase form after the colon on the line (impl review F6)", () => {
    const mars = worded([opposition], "pl");
    expect(mars.tonight[0]?.name).toBe("Opozycja Marsa");
    expect(eventsTileLine(mars, "pl")).toBe("Opozycja Marsa · dziś w nocy");
    expect(eventsVerdictLine(mars, "pl")).toBe("Dziś: opozycja Marsa");
    const mercury = worded([elongation], "pl");
    expect(eventsTileLine(mercury, "pl")).toBe("Największa elongacja Merkurego · dziś w nocy");
    expect(eventsVerdictLine(mercury, "pl")).toBe("Dziś: największa elongacja Merkurego");
    expect(eventsVerdictLine(worded([opposition], "en"), "en")).toBe("Tonight: Mars at opposition");
  });

  it("never puts a colon in a title and never a capital after the line's colon", () => {
    const m = pl.tonight.events;
    const titles = [...Object.values(m.elongationName), ...Object.values(m.oppositionName)];
    for (const title of titles) {
      expect(title).not.toContain(":");
    }
    const inLine = [
      ...Object.values(m.elongationNameInLine),
      ...Object.values(m.oppositionNameInLine),
      ...Object.values(m.eclipse.lunarInLine),
      ...Object.values(m.eclipse.solarInLine),
      ...Object.values(m.showerNameInLine),
    ];
    for (const name of inLine) {
      expect(name[0], name).toBe(name[0].toLowerCase());
    }
    expect(m.brightMoon).toBe("Jasny Księżyc nad horyzontem: widać tylko jaśniejsze meteory");
  });
});

describe("the bright-Moon note belongs to a visible shower only (impl review F10b)", () => {
  const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, timeZone: "Europe/Warsaw" };
  const shower = (visibility: SkyEvent["visibility"]) =>
    engineEvent({
      kind: "meteor-shower",
      moment: new Date("2027-08-12T22:00:00Z"),
      night: "2027-08-12",
      shower: "perseids",
      brightMoon: true,
      bestNight: "2027-08-12",
      visibility,
    });
  const worded = (event: SkyEvent) =>
    formatSkyEvents([event], "en", WARSAW.timeZone, "2027-08-12", new Date("2027-08-12T12:00:00Z")).events[0];

  it("shows it on a visible shower and not on one that cannot be seen", () => {
    const visible = worded(
      shower({ visible: true, best: new Date("2027-08-13T01:00:00Z"), altitudeDeg: 60, azimuthDeg: 40 }),
    );
    expect(visible.notes).toContain(en.tonight.events.brightMoon);
    const hidden = worded(shower({ visible: false, reason: "too-low" }));
    expect(hidden.notes).not.toContain(en.tonight.events.brightMoon);
  });
});
