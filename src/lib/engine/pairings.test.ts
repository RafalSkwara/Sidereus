import { Body, Equator, GeoVector, Horizon, AngleBetween, Observer } from "astronomy-engine";
import { beforeAll, describe, expect, it } from "vitest";

import { skyEvents } from "./events";
import type { PairingBody, PairingEvent } from "./events";
import { PAIRING_REFERENCES, siteOf } from "./fixtures";
import type { PairingReference, PairingReferenceNight } from "./fixtures";
import { addDays, observingNight } from "./night";
import { EVENT_MIN_ALTITUDE_DEG, EVENT_SUN_MAX_ALTITUDE_DEG, PAIRING_MAX_SEPARATION_DEG } from "./parameters";
import { PAIRING_BODIES, pairSeparationDeg, pairingEvents } from "./pairings";
import { sunAltitudeDeg } from "./sun";
import type { Interval, Site } from "./types";

/**
 * Close pairings, Phase 2 (M-3 S-07): the Moon and the five naked-eye planets, every pair within
 * `PAIRING_MAX_SEPARATION_DEG` at the closest moment the site can see, pinned against an independent
 * Skyfield/DE421 reference (`scripts/events-reference.py`, two sites and two fixed 30-night windows).
 *
 * The reference records, for every pair and observing night, the topocentric minimum separation at any
 * moment (`geometric`) and the minimum while both bodies are at least 10° up with the Sun at or below -6°
 * (`visible`), on a one-minute grid. The events the engine must find are derived from those two minima
 * here, by the rule the plan states, and compared within 0.05° and 10 minutes.
 */

const SEPARATION_TOLERANCE_DEG = 0.05;
const TIME_TOLERANCE_MS = 10 * 60_000;
const NIGHTS = 30;

const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };
const SYDNEY: Site = { latitudeDeg: -33.87, longitudeDeg: 151.21, elevationM: 20, timeZone: "Australia/Sydney" };
const TROMSO: Site = { latitudeDeg: 69.65, longitudeDeg: 18.96, elevationM: 10, timeZone: "Europe/Oslo" };
const SITES: Site[] = [
  WARSAW,
  SYDNEY,
  TROMSO,
  { latitudeDeg: 0, longitudeDeg: 36.8, timeZone: "Africa/Nairobi" },
  { latitudeDeg: 64.15, longitudeDeg: -21.94, timeZone: "Atlantic/Reykjavik" },
  { latitudeDeg: 34.05, longitudeDeg: -118.24, timeZone: "America/Los_Angeles" },
];

const BODY_OF: Record<PairingBody, Body> = {
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
};

function windowOf(site: Site, fromNight: string, nights: number): Interval {
  return {
    start: observingNight(fromNight, site.timeZone).start,
    end: observingNight(addDays(fromNight, nights - 1), site.timeZone).end,
  };
}

function pairName(bodies: readonly [PairingBody, PairingBody]): string {
  return `${bodies[0]}-${bodies[1]}`;
}

function only<T>(items: readonly T[]): T {
  expect(items).toHaveLength(1);
  return items[0];
}

/** Independent altitude of a body, from astronomy-engine directly (not through the module under test). */
function altitudeOf(body: PairingBody, site: Site, time: Date): number {
  const observer = new Observer(site.latitudeDeg, site.longitudeDeg, site.elevationM ?? 0);
  const eq = Equator(BODY_OF[body], time, observer, true, true);
  return Horizon(time, observer, eq.ra, eq.dec, "normal").altitude;
}

type Reason = "below-horizon" | "daylight" | "too-low";

/** The reason a pair cannot be seen at an instant, from the two bodies' altitudes and the Sun's (null: it can). */
function reasonAt(firstAltitudeDeg: number, secondAltitudeDeg: number, sunAltitudeDeg: number): Reason | null {
  const lowest = Math.min(firstAltitudeDeg, secondAltitudeDeg);
  if (lowest >= EVENT_MIN_ALTITUDE_DEG) {
    return sunAltitudeDeg <= EVENT_SUN_MAX_ALTITUDE_DEG ? null : "daylight";
  }
  return lowest < 0 ? "below-horizon" : "too-low";
}

// The events a reference implies --------------------------------------------------------------------

interface ExpectedEvent {
  pair: string;
  night: string;
  visible: boolean;
  separationDeg: number;
  time: number;
  reason: Reason | null;
}

/**
 * The events the reference's minima imply at `thresholdDeg` (inclusive): a night is close when its
 * geometric minimum is (the visible minimum is never smaller), consecutive close nights of a pair make one
 * event, and an event is visible when one of its nights has a visible minimum within the threshold, dated
 * at the closest such night; otherwise it is not visible, at the closest geometric minimum.
 */
function expectedEvents(reference: PairingReference, thresholdDeg: number): ExpectedEvent[] {
  const events: ExpectedEvent[] = [];
  for (const pair of reference.pairs) {
    let cluster: PairingReferenceNight[] = [];
    const flush = () => {
      if (cluster.length === 0) {
        return;
      }
      const visibleNights = cluster.filter((n) => n.visible !== null && n.visible.separationDeg <= thresholdDeg);
      const name = pairName([pair.first, pair.second]);
      if (visibleNights.length > 0) {
        const best = visibleNights.reduce((a, b) =>
          (b.visible?.separationDeg ?? Infinity) < (a.visible?.separationDeg ?? Infinity) ? b : a,
        );
        if (best.visible === null) {
          throw new Error("unreachable: a visible night has a visible minimum");
        }
        events.push({
          pair: name,
          night: best.night,
          visible: true,
          separationDeg: best.visible.separationDeg,
          time: Date.parse(best.visible.time),
          reason: null,
        });
      } else {
        const best = cluster.reduce((a, b) => (b.geometric.separationDeg < a.geometric.separationDeg ? b : a));
        events.push({
          pair: name,
          night: best.night,
          visible: false,
          separationDeg: best.geometric.separationDeg,
          time: Date.parse(best.geometric.time),
          reason: reasonAt(
            best.geometric.firstAltitudeDeg,
            best.geometric.secondAltitudeDeg,
            best.geometric.sunAltitudeDeg,
          ),
        });
      }
      cluster = [];
    };
    let previous: string | null = null;
    for (const night of pair.nights) {
      const close = night.geometric.separationDeg <= thresholdDeg;
      if (!close || (previous !== null && addDays(previous, 1) !== night.night)) {
        flush();
      }
      if (close) {
        cluster.push(night);
      }
      previous = night.night;
    }
    flush();
  }
  return events;
}

describe("pairing parameters and bodies", () => {
  it("keeps the owner's 5° threshold and the Moon plus the five naked-eye planets", () => {
    expect(PAIRING_MAX_SEPARATION_DEG).toBe(5);
    expect(PAIRING_BODIES).toEqual(["moon", "mercury", "venus", "mars", "jupiter", "saturn"]);
  });
});

describe.each(PAIRING_REFERENCES)("against the Skyfield reference $name", (reference) => {
  const site = siteOf(reference);
  const window = windowOf(site, reference.fromNight, NIGHTS);

  it("covers 30 nights of all 15 pairs, with a close pairing in the window", () => {
    expect(reference.pairs).toHaveLength(15);
    for (const pair of reference.pairs) {
      expect(pair.nights).toHaveLength(NIGHTS);
    }
    expect(expectedEvents(reference, PAIRING_MAX_SEPARATION_DEG).filter((e) => e.visible).length).toBeGreaterThan(0);
  });

  it("measures the same separation as Skyfield, within 0.05°, at every minimum the reference records", () => {
    let checked = 0;
    for (const pair of reference.pairs) {
      for (const night of pair.nights) {
        const moments = [night.geometric, ...(night.visible === null ? [] : [night.visible])];
        for (const moment of moments) {
          const engine = pairSeparationDeg(site, pair.first, pair.second, new Date(moment.time));
          expect(
            Math.abs(engine - moment.separationDeg),
            `${pair.first}-${pair.second} ${moment.time}: engine ${engine}, Skyfield ${moment.separationDeg}`,
          ).toBeLessThanOrEqual(SEPARATION_TOLERANCE_DEG);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("finds the events the reference implies: the same pairs and nights, separations within 0.05° and moments within 10 minutes", () => {
    const expected = expectedEvents(reference, PAIRING_MAX_SEPARATION_DEG);
    const found = pairingEvents(site, window);
    expect(found.map((e) => `${pairName(e.bodies)} ${e.night}`).sort()).toEqual(
      expected.map((e) => `${e.pair} ${e.night}`).sort(),
    );
    for (const event of found) {
      const want = only(expected.filter((e) => e.pair === pairName(event.bodies) && e.night === event.night));
      const label = `${pairName(event.bodies)} ${event.night}`;
      expect(event.visibility.visible, label).toBe(want.visible);
      expect(Math.abs(event.separationDeg - want.separationDeg), label).toBeLessThanOrEqual(SEPARATION_TOLERANCE_DEG);
      expect(Math.abs(event.moment.getTime() - want.time), label).toBeLessThanOrEqual(TIME_TOLERANCE_MS);
      if (!event.visibility.visible) {
        expect(event.visibility.reason, label).toBe(want.reason);
      }
    }
  });

  it("lists one event per pair per approach, dated at the closest night", () => {
    const found = pairingEvents(site, window);
    const byPair = new Map<string, PairingEvent[]>();
    for (const event of found) {
      byPair.set(pairName(event.bodies), [...(byPair.get(pairName(event.bodies)) ?? []), event]);
    }
    for (const [name, events] of byPair) {
      const nights = events.map((e) => e.night).sort();
      nights.slice(1).forEach((night, i) => {
        // Two events of one pair never sit on consecutive nights: that would be one approach listed twice.
        expect(night > addDays(nights[i], 1), `${name} ${nights[i]} and ${night}`).toBe(true);
      });
    }
  });
});

describe("one approach over many nights", () => {
  it("lists Mars and Jupiter's ten-night approach of October-November 2026 once, at its closest night", () => {
    const reference = PAIRING_REFERENCES[0];
    const marsJupiter = reference.pairs.find((p) => p.first === "mars" && p.second === "jupiter");
    const close = (marsJupiter?.nights ?? []).filter((n) => n.geometric.separationDeg <= PAIRING_MAX_SEPARATION_DEG);
    expect(close.length).toBeGreaterThanOrEqual(10);
    const events = pairingEvents(siteOf(reference), windowOf(siteOf(reference), reference.fromNight, NIGHTS)).filter(
      (e) => pairName(e.bodies) === "mars-jupiter",
    );
    const event = only(events);
    // The approach is still closing at the end of the window, so its closest night is the last one.
    expect(event.night).toBe(close[close.length - 1].night);
    expect(event.visibility.visible).toBe(true);
  });

  it("follows the same approach into the next window, where its closest night (2026-11-15, 1.19°) falls", () => {
    const events = pairingEvents(WARSAW, windowOf(WARSAW, "2026-11-12", NIGHTS)).filter(
      (e) => pairName(e.bodies) === "mars-jupiter",
    );
    const event = only(events);
    expect(event.night).toBe("2026-11-15");
    expect(event.separationDeg).toBeGreaterThan(1.1);
    expect(event.separationDeg).toBeLessThan(1.3);
  });
});

describe("the threshold", () => {
  const window = windowOf(WARSAW, "2026-10-13", NIGHTS);

  it("is inclusive: a pairing is listed at exactly its own separation and not below it", () => {
    const events = pairingEvents(WARSAW, window);
    const visible = only(events.filter((e) => e.visibility.visible && pairName(e.bodies) === "moon-mars"));
    expect(pairingEvents(WARSAW, window, visible.separationDeg)).toContainEqual(visible);

    const hidden = only(events.filter((e) => !e.visibility.visible && pairName(e.bodies) === "moon-venus"));
    expect(pairingEvents(WARSAW, window, hidden.separationDeg)).toContainEqual(hidden);
    const stricter = pairingEvents(WARSAW, window, hidden.separationDeg - 1e-6);
    expect(stricter.filter((e) => pairName(e.bodies) === "moon-venus")).toEqual([]);
  });

  it("lists nothing farther apart than the threshold, whatever the threshold", () => {
    for (const threshold of [0.5, 2, 3, PAIRING_MAX_SEPARATION_DEG]) {
      const events = pairingEvents(WARSAW, window, threshold);
      for (const event of events) {
        expect(event.separationDeg).toBeLessThanOrEqual(threshold);
      }
    }
    expect(pairingEvents(WARSAW, window, 0.5).length).toBeLessThan(pairingEvents(WARSAW, window, 3).length);
    expect(pairingEvents(WARSAW, window, 3).length).toBeLessThanOrEqual(pairingEvents(WARSAW, window).length);
    expect(pairingEvents(WARSAW, window)).toEqual(pairingEvents(WARSAW, window, PAIRING_MAX_SEPARATION_DEG));
  });

  it("makes a pairing not visible, not absent, when its closest visible moment is beyond the threshold but the geometric one is not", () => {
    // Moon and Mars on 2026-11-01..02 at Warsaw: 4.85° while both are up in the dark, 1.9° once Mars has set.
    const moonMars = pairingEvents(WARSAW, window).filter((e) => pairName(e.bodies) === "moon-mars");
    expect(only(moonMars).separationDeg).toBeCloseTo(4.85, 1);
    const stricter = pairingEvents(WARSAW, window, 4.8).filter((e) => pairName(e.bodies) === "moon-mars");
    const hidden = only(stricter);
    expect(hidden.visibility.visible).toBe(false);
    expect(hidden.separationDeg).toBeCloseTo(1.9, 0);
    expect(hidden.visibility).toEqual({ visible: false, reason: "below-horizon" });
  });
});

describe("the site's own sky", () => {
  it("separates the Moon from a planet by the site's parallax: Warsaw's 1.63° Moon-Jupiter approach is not the geocentric one", () => {
    const moment = new Date("2026-11-02T23:38:00Z");
    const topocentric = pairSeparationDeg(WARSAW, "moon", "jupiter", moment);
    const geocentric = AngleBetween(GeoVector(Body.Moon, moment, true), GeoVector(Body.Jupiter, moment, true));
    expect(Math.abs(topocentric - geocentric)).toBeGreaterThan(0.5);
    // Planets are too far for parallax to matter between them.
    const planets = pairSeparationDeg(WARSAW, "mars", "jupiter", moment);
    expect(
      Math.abs(planets - AngleBetween(GeoVector(Body.Mars, moment, true), GeoVector(Body.Jupiter, moment, true))),
    ).toBeLessThan(0.02);
  });

  it("gives two sites two different Moon-planet separations for the same instant", () => {
    const moment = new Date("2026-12-27T13:00:00Z");
    const warsaw = pairSeparationDeg(WARSAW, "moon", "jupiter", moment);
    const sydney = pairSeparationDeg(SYDNEY, "moon", "jupiter", moment);
    expect(Math.abs(warsaw - sydney)).toBeGreaterThan(0.3);
  });
});

describe("the invariant: a pairing is visible only when both bodies are up in a dark enough sky", () => {
  const WINDOWS = [
    { from: "2026-10-13", nights: 366 },
    { from: "2028-03-01", nights: 366 },
  ];
  const all: { site: Site; events: PairingEvent[] }[] = [];
  beforeAll(() => {
    for (const site of SITES) {
      for (const w of WINDOWS) {
        all.push({ site, events: pairingEvents(site, windowOf(site, w.from, w.nights)) });
      }
    }
  }, 60_000);

  it("has something to check: visible and not visible events of every reason", () => {
    const events = all.flatMap(({ events: e }) => e);
    expect(events.filter((e) => e.visibility.visible).length).toBeGreaterThan(50);
    const reasons = new Set(events.flatMap((e) => (e.visibility.visible ? [] : [e.visibility.reason])));
    expect(reasons).toEqual(new Set(["below-horizon", "daylight", "too-low"]));
    expect(new Set(events.map((e) => e.bodies[0] === "moon"))).toEqual(new Set([true, false]));
  });

  it("holds every visible event to 10° for both bodies and the Sun to -6° at its best moment, inside its night", () => {
    let checked = 0;
    for (const { site, events } of all) {
      for (const event of events) {
        if (!event.visibility.visible) {
          continue;
        }
        checked++;
        const { best, altitudeDeg } = event.visibility;
        const label = `${pairName(event.bodies)} at ${site.timeZone} ${event.moment.toISOString()}`;
        const first = altitudeOf(event.bodies[0], site, best);
        const second = altitudeOf(event.bodies[1], site, best);
        expect(first, label).toBeGreaterThanOrEqual(EVENT_MIN_ALTITUDE_DEG);
        expect(second, label).toBeGreaterThanOrEqual(EVENT_MIN_ALTITUDE_DEG);
        expect(altitudeDeg, label).toBeCloseTo(Math.min(first, second), 2);
        expect(sunAltitudeDeg(site, best), label).toBeLessThanOrEqual(EVENT_SUN_MAX_ALTITUDE_DEG);
        expect(best, label).toEqual(event.moment);
        const night = observingNight(event.night, site.timeZone);
        expect(event.moment.getTime(), label).toBeGreaterThanOrEqual(night.start.getTime());
        expect(event.moment.getTime(), label).toBeLessThanOrEqual(night.end.getTime());
        expect(event.separationDeg, label).toBeLessThanOrEqual(PAIRING_MAX_SEPARATION_DEG);
        expect(event.separationDeg, label).toBeCloseTo(
          pairSeparationDeg(site, event.bodies[0], event.bodies[1], event.moment),
          6,
        );
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("gives every not visible event the reason its two altitudes and the Sun give at its moment, and no visible moment of its night within the threshold", () => {
    let checked = 0;
    for (const { site, events } of all) {
      for (const event of events) {
        if (event.visibility.visible) {
          continue;
        }
        checked++;
        const label = `${pairName(event.bodies)} at ${site.timeZone} ${event.moment.toISOString()}`;
        const reason = reasonAt(
          altitudeOf(event.bodies[0], site, event.moment),
          altitudeOf(event.bodies[1], site, event.moment),
          sunAltitudeDeg(site, event.moment),
        );
        expect(reason, label).not.toBeNull();
        expect(event.visibility, label).toEqual({ visible: false, reason });
        // Five-minute scan of the event's night and its neighbours: never up, dark and within the threshold.
        const from = observingNight(addDays(event.night, -1), site.timeZone).start.getTime();
        const to = observingNight(addDays(event.night, 1), site.timeZone).end.getTime();
        if (checked <= 40) {
          for (let t = from; t <= to; t += 5 * 60_000) {
            const time = new Date(t);
            if (sunAltitudeDeg(site, time) > EVENT_SUN_MAX_ALTITUDE_DEG) {
              continue;
            }
            if (
              altitudeOf(event.bodies[0], site, time) < EVENT_MIN_ALTITUDE_DEG ||
              altitudeOf(event.bodies[1], site, time) < EVENT_MIN_ALTITUDE_DEG
            ) {
              continue;
            }
            expect(
              pairSeparationDeg(site, event.bodies[0], event.bodies[1], time),
              `${label} is visible at ${time.toISOString()}`,
            ).toBeGreaterThan(PAIRING_MAX_SEPARATION_DEG);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
  }, 60_000);

  it("never calls a pairing visible where the Sun does not get low enough, and lists those as not visible", () => {
    const events = all.filter(({ site }) => site === TROMSO).flatMap(({ events: e }) => e);
    const summer = events.filter((e) => e.night.slice(5, 7) >= "05" && e.night.slice(5, 7) <= "07");
    expect(summer.length).toBeGreaterThan(0);
    for (const event of summer) {
      expect(event.visibility.visible, `${pairName(event.bodies)} ${event.night}`).toBe(false);
    }
  });

  it("is in time order, with every pair named Moon-first and in the pairing order", () => {
    for (const { events } of all) {
      events.slice(1).forEach((e, i) => {
        expect(e.moment.getTime()).toBeGreaterThanOrEqual(events[i].moment.getTime());
      });
      for (const e of events) {
        expect(PAIRING_BODIES.indexOf(e.bodies[0])).toBeLessThan(PAIRING_BODIES.indexOf(e.bodies[1]));
      }
    }
  });
});

describe("skyEvents", () => {
  it("lists exactly the pairings of its window beside the other kinds", () => {
    const events = skyEvents(WARSAW, "2026-10-13");
    const pairings = events.filter((e): e is PairingEvent => e.kind === "pairing");
    expect(pairings).toEqual(pairingEvents(WARSAW, windowOf(WARSAW, "2026-10-13", NIGHTS)));
    expect(pairings.length).toBeGreaterThan(0);
  });

  it("leaves the pairings out when asked, and only them", () => {
    const withPairings = skyEvents(WARSAW, "2026-10-13", 120);
    const without = skyEvents(WARSAW, "2026-10-13", 120, undefined, { pairings: false });
    expect(without.some((e) => e.kind === "pairing")).toBe(false);
    expect(without).toEqual(withPairings.filter((e) => e.kind !== "pairing"));
  });

  it("returns nothing for an empty window", () => {
    expect(
      pairingEvents(WARSAW, { start: new Date("2026-10-13T10:00:00Z"), end: new Date("2026-10-13T10:00:00Z") }),
    ).toEqual([]);
    expect(skyEvents(WARSAW, "2026-10-13", 0)).toEqual([]);
  });
});
