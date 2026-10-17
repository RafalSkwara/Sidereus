import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import { skyEvents, tonightDateFor } from "@/lib/engine";
import type { Site, SkyEvent } from "@/lib/engine";
import { TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG } from "@/lib/engine/parameters";

import { eventsTileLine, eventsVerdictLine, formatSkyEvents, type TonightSkyEvents } from "./sky-events";

/*
 * The dashboard's two lines over the sky events (sky-events Phase 5): the tile's "next" line and the verdict's muted
 * "Tonight: ..." line. A solar eclipse is worded from the real engine at fixed clocks (owner decision A, 2026-10-14,
 * impl review F2); the other blocks use literal engine events.
 */

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
    expect(eventsTileLine(worded, "en")).toBe("Partial solar eclipse · tomorrow, 11:22 · eclipse glasses only");
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
    it("reads 'Tomorrow, 11:22' the evening before (20:00) and 'Today, 11:22' at 02:00 on the day, still the night of 08-01", () => {
      const evening = at(WARSAW, "2027-08-01T18:00:00Z");
      expect(evening.date).toBe("2027-08-01");
      expect(evening.block.tonight[0]?.dayWord).toBe("tomorrow");
      expect(eventsVerdictLine(evening.block, "en")).toMatch(
        /^Tomorrow, 11:22: Partial solar eclipse, eclipse glasses only( \+\d+ more)?$/,
      );
      expect(eventsTileLine(evening.block, "en")).toBe(
        "Partial solar eclipse · tomorrow, 11:22 · eclipse glasses only",
      );

      const { date, block } = at(WARSAW, "2027-08-02T00:00:00Z");
      expect(date).toBe("2027-08-01");
      expect(block.tonight[0]?.kind).toBe("solar-eclipse");
      expect(block.tonight[0]?.dayWord).toBe("today");
      expect(eventsVerdictLine(block, "en")).toMatch(
        /^Today, 11:22: Partial solar eclipse, eclipse glasses only( \+\d+ more)?$/,
      );
      expect(eventsTileLine(block, "en")).toBe("Partial solar eclipse · today, 11:22 · eclipse glasses only");
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
      expect(eventsTileLine(block, "en")).toBe("Partial solar eclipse · today, 11:22 · eclipse glasses only");

      // In Polish, with no double colon.
      const polish = at(WARSAW, "2027-08-02T05:00:00Z", "pl").block;
      expect(eventsVerdictLine(polish, "pl") ?? "").toMatch(
        /^Dziś, 11:22: częściowe zaćmienie Słońca, tylko przez okulary do zaćmień( \+\d+ więcej)?$/,
      );
      expect(eventsTileLine(polish, "pl")).toBe(
        "Częściowe zaćmienie Słońca · dziś, 11:22 · tylko przez okulary do zaćmień",
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
        expect(eventsTileLine(block, "en"), clock).toBe("Partial solar eclipse · today, 16:54 · eclipse glasses only");
      }
    });

    it("the day before reads 'Tomorrow, 16:54' on the tile and is not tonight's event, and it is gone from every list once its partial phase has ended (18:30)", () => {
      const { date, block } = at(LISBON, "2028-01-25T21:00:00Z");
      expect(date).toBe("2028-01-25");
      expect(solar(block)?.dayWord).toBe("tomorrow");
      expect(block.tonight.some((event) => event.kind === "solar-eclipse")).toBe(false);
      expect(eventsTileLine(block, "en")).toBe("Partial solar eclipse · tomorrow, 16:54 · eclipse glasses only");

      const over = at(LISBON, "2028-01-26T18:30:00Z").block;
      expect(solar(over)).toBeUndefined();
      expect(over.tonight.some((event) => event.kind === "solar-eclipse")).toBe(false);
      expect(over.next?.kind).not.toBe("solar-eclipse");
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
