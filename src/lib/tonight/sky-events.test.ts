import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";

import { eventsTileLine, eventsVerdictLine, type TonightSkyEvent, type TonightSkyEvents } from "./sky-events";

/*
 * The dashboard's two lines over the sky events (sky-events Phase 5): the tile's "next" line and the verdict's muted
 * "Tonight: ..." line. The events are literals, so the wording is pinned without the engine.
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
  nightWhen: "Mon 2 Aug, 12:03",
  safety: true,
});
const pairing = event({
  kind: "pairing",
  name: "Moon and Jupiter",
  lineName: "Moon and Jupiter, 1.8° apart",
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
      `Partial solar eclipse · Mon 2 Aug, 12:03 · ${en.tonight.events.glassesOnly}`,
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
});
