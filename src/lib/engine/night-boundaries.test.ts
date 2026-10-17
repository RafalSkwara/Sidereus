import { describe, expect, it } from "vitest";

import { expectRunnerZoneActive, useRunnerZone } from "./fixtures/runner-zones";
import type { RunnerZone } from "./fixtures/runner-zones";
import { USNO_CIVIL_DAWN } from "./fixtures/usno";
import { addDays, localNoon, observingNight, observingNightDateFor } from "./night";
import { TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG } from "./parameters";
import { darkWindow, tonightDateFor } from "./sun";
import type { Site } from "./types";

// Every expectation is a hand literal or a USNO value (fixtures/usno.ts), never derived from the
// functions under test. Calls run inside `it`, after the runner zone is switched. Two runner zones of
// opposite sign (UTC-7/-8 and UTC+14) hold the zone rule; the other three add nothing the sign does not.
const ZONES: readonly RunnerZone[] = ["America/Los_Angeles", "Pacific/Kiritimati"];

const HOUR_MS = 3_600_000;

const MINUTE_MS = 60_000;

const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 0, timeZone: "Europe/Warsaw" };
const LOS_ANGELES: Site = {
  latitudeDeg: 34.05,
  longitudeDeg: -118.24,
  elevationM: 0,
  timeZone: "America/Los_Angeles",
};
const KIRITIMATI: Site = { latitudeDeg: 1.87, longitudeDeg: -157.4, elevationM: 0, timeZone: "Pacific/Kiritimati" };

// The evening after each USNO night, written by hand (same order as USNO_CIVIL_DAWN).
const NEXT_DATE: Record<string, string> = {
  "2026-10-24": "2026-10-25",
  "2026-03-28": "2026-03-29",
  "2026-10-31": "2026-11-01",
};

const WALL_CLOCK_TRAPS: readonly { name: string; site: Site; at: string; night: string }[] = [
  // Los Angeles
  { name: "LA 00:30 PDT on 1 Nov", site: LOS_ANGELES, at: "2026-11-01T07:30:00Z", night: "2026-10-31" },
  { name: "LA 01:30 PDT, first pass", site: LOS_ANGELES, at: "2026-11-01T08:30:00Z", night: "2026-10-31" },
  { name: "LA 01:30 PST, second pass", site: LOS_ANGELES, at: "2026-11-01T09:30:00Z", night: "2026-10-31" },
  { name: "LA 11:59 PST on 1 Nov, after dawn", site: LOS_ANGELES, at: "2026-11-01T19:59:00Z", night: "2026-11-01" },
  {
    name: "LA 11:59 PDT on 31 Oct, after the 30 Oct night's dawn",
    site: LOS_ANGELES,
    at: "2026-10-31T18:59:00Z",
    night: "2026-10-31",
  },
  {
    name: "LA 23:00 PDT on 24 Oct, UTC date already 25",
    site: LOS_ANGELES,
    at: "2026-10-25T06:00:00Z",
    night: "2026-10-24",
  },
  // Kiritimati
  {
    name: "Kiritimati 08:00 on 25 Oct, UTC date still 24",
    site: KIRITIMATI,
    at: "2026-10-24T18:00:00Z",
    night: "2026-10-25",
  },
  // Warsaw
  {
    name: "Warsaw 03:30 CEST, just after the skipped hour",
    site: WARSAW,
    at: "2026-03-29T01:30:00Z",
    night: "2026-03-28",
  },
  { name: "Warsaw 02:30 CEST, first pass", site: WARSAW, at: "2026-10-25T00:30:00Z", night: "2026-10-24" },
  { name: "Warsaw 02:30 CET, second pass", site: WARSAW, at: "2026-10-25T01:30:00Z", night: "2026-10-24" },
  { name: "Warsaw 11:59 CET on 25 Oct, after dawn", site: WARSAW, at: "2026-10-25T10:59:00Z", night: "2026-10-25" },
];

describe.each(ZONES)("night boundaries (runner zone %s)", (runnerZone) => {
  useRunnerZone(runnerZone);

  it("runs in the runner zone it claims", () => {
    expectRunnerZoneActive(runnerZone);
  });

  describe("(a) night spans", () => {
    it.each([
      {
        name: "Warsaw 2026-10-10, 24 h (ordinary night)",
        date: "2026-10-10",
        zone: "Europe/Warsaw",
        start: "2026-10-10T10:00:00.000Z", // 12:00 CEST
        end: "2026-10-11T10:00:00.000Z", // 12:00 CEST
        hours: 24,
      },
      {
        name: "Warsaw 2026-10-24, 25 h (fall back)",
        date: "2026-10-24",
        zone: "Europe/Warsaw",
        start: "2026-10-24T10:00:00.000Z", // 12:00 CEST
        end: "2026-10-25T11:00:00.000Z", // 12:00 CET
        hours: 25,
      },
      {
        name: "Warsaw 2026-03-28, 23 h (spring forward)",
        date: "2026-03-28",
        zone: "Europe/Warsaw",
        start: "2026-03-28T11:00:00.000Z", // 12:00 CET
        end: "2026-03-29T10:00:00.000Z", // 12:00 CEST
        hours: 23,
      },
      {
        name: "Los Angeles 2026-10-31, 25 h (fall back)",
        date: "2026-10-31",
        zone: "America/Los_Angeles",
        start: "2026-10-31T19:00:00.000Z", // 12:00 PDT
        end: "2026-11-01T20:00:00.000Z", // 12:00 PST
        hours: 25,
      },
      {
        name: "Auckland 2026-10-24, 24 h (UTC+13)",
        date: "2026-10-24",
        zone: "Pacific/Auckland",
        start: "2026-10-23T23:00:00.000Z", // 12:00 NZDT
        end: "2026-10-24T23:00:00.000Z", // 12:00 NZDT
        hours: 24,
      },
      {
        name: "Kiritimati 2026-10-24, 24 h (UTC+14)",
        date: "2026-10-24",
        zone: "Pacific/Kiritimati",
        start: "2026-10-23T22:00:00.000Z", // 12:00 +14
        end: "2026-10-24T22:00:00.000Z", // 12:00 +14
        hours: 24,
      },
    ])("$name", ({ date, zone, start, end, hours }) => {
      const night = observingNight(date, zone);
      expect(night.start.toISOString()).toBe(start);
      expect(night.end.toISOString()).toBe(end);
      expect((night.end.getTime() - night.start.getTime()) / HOUR_MS).toBe(hours);
      expect(night.date).toBe(date);
      expect(night.timeZone).toBe(zone);
    });

    it("puts local noon in the site's zone, not the runner's", () => {
      expect(localNoon("2026-06-21", "Europe/Oslo").toISOString()).toBe("2026-06-21T10:00:00.000Z");
      expect(localNoon("2026-06-21", "UTC").toISOString()).toBe("2026-06-21T12:00:00.000Z");
      expect(localNoon("2026-06-21", "America/Los_Angeles").toISOString()).toBe("2026-06-21T19:00:00.000Z");
      expect(localNoon("2026-06-21", "Asia/Kolkata").toISOString()).toBe("2026-06-21T06:30:00.000Z");
    });

    it("adds calendar days across month and year boundaries", () => {
      expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
      expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
      expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
      expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    });

    it("maps an instant to the evening date of its night, switching at local noon, across the DST change and in the site's zone", () => {
      const warsaw = "Europe/Warsaw";
      // 01:30 CEST on 2026-10-11 is 23:30 UTC on 2026-10-10; 01:30 CET on 2026-11-11 is 00:30 UTC the same day.
      expect(observingNightDateFor(new Date("2026-10-10T23:30:00Z"), warsaw)).toBe("2026-10-10");
      expect(observingNightDateFor(new Date("2026-11-11T00:30:00Z"), warsaw)).toBe("2026-11-10");
      expect(observingNightDateFor(new Date("2026-10-10T11:00:00Z"), warsaw)).toBe("2026-10-10"); // 13:00
      // The switch is local noon, inclusive.
      expect(observingNightDateFor(new Date("2026-10-10T09:59:59Z"), warsaw)).toBe("2026-10-09");
      expect(observingNightDateFor(new Date("2026-10-10T10:00:00Z"), warsaw)).toBe("2026-10-10");
      // All 25 hours of the 2026-10-25 night; 11:00 UTC on 10-25 is 12:00 CET, the first instant of the next night.
      for (const [iso, expected] of [
        ["2026-10-24T10:00:00Z", "2026-10-24"], // 12:00 CEST
        ["2026-10-25T00:30:00Z", "2026-10-24"], // 02:30 CEST, first pass
        ["2026-10-25T01:30:00Z", "2026-10-24"], // 02:30 CET, second pass
        ["2026-10-25T10:00:00Z", "2026-10-24"], // 11:00 CET
        ["2026-10-25T10:59:59Z", "2026-10-24"],
        ["2026-10-25T11:00:00Z", "2026-10-25"],
      ] as const) {
        expect(observingNightDateFor(new Date(iso), warsaw), iso).toBe(expected);
      }
      // The returned night always contains the instant, half hour by half hour across the change.
      let checked = 0;
      for (let t = Date.UTC(2026, 9, 23, 0, 0); t < Date.UTC(2026, 9, 27, 0, 0); t += 30 * MINUTE_MS) {
        const night = observingNight(observingNightDateFor(new Date(t), warsaw), warsaw);
        expect(night.start.getTime(), new Date(t).toISOString()).toBeLessThanOrEqual(t);
        expect(night.end.getTime(), new Date(t).toISOString()).toBeGreaterThan(t);
        checked += 1;
      }
      expect(checked).toBe(192);
      // The given zone, not the runner's.
      const instant = new Date("2026-06-21T20:00:00Z");
      expect(observingNightDateFor(instant, "Pacific/Auckland")).toBe("2026-06-21"); // 08:00 on 06-22
      expect(observingNightDateFor(instant, "America/Los_Angeles")).toBe("2026-06-21"); // 13:00
      expect(observingNightDateFor(new Date("2026-06-21T10:00:00Z"), "Pacific/Auckland")).toBe("2026-06-21"); // 22:00
    });
  });

  describe("(b) dark window end vs USNO civil dawn", () => {
    it("ends within 2 min of USNO civil dawn on every edge night", () => {
      expect(USNO_CIVIL_DAWN.length, "USNO edge nights").toBeGreaterThanOrEqual(5);
      for (const { label, site, night, civilDawn } of USNO_CIVIL_DAWN) {
        const window = darkWindow(site, observingNight(night, site.timeZone), TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG);
        expect(window.kind, `${label}: dark window`).toBe("window");
        if (window.kind !== "window") {
          continue;
        }
        const offMs = Math.abs(window.end.getTime() - new Date(civilDawn).getTime());
        expect(offMs, `${label}: end is ${offMs / 1000} s from USNO civil dawn`).toBeLessThanOrEqual(2 * MINUTE_MS);
      }
    });
  });

  describe("(c) either side of civil dawn", () => {
    it("is the night 5 min before USNO civil dawn and the evening ahead 5 min after, on every edge night", () => {
      expect(USNO_CIVIL_DAWN.length, "USNO edge nights").toBeGreaterThanOrEqual(5);
      for (const entry of USNO_CIVIL_DAWN) {
        const next = NEXT_DATE[entry.night];
        expect(next, `${entry.label}: hand-written next date`).toBeDefined();
        const dawnMs = new Date(entry.civilDawn).getTime();
        const before = new Date(dawnMs - 5 * MINUTE_MS);
        const after = new Date(dawnMs + 5 * MINUTE_MS);
        expect(
          tonightDateFor(entry.site, before, TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG),
          `${entry.label}: 5 min before`,
        ).toBe(entry.night);
        expect(
          tonightDateFor(entry.site, after, TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG),
          `${entry.label}: 5 min after`,
        ).toBe(next);
      }
    });
  });

  describe("(d) wall-clock traps", () => {
    it("names the night of each instant that a wall-clock reading would get wrong", () => {
      expect(WALL_CLOCK_TRAPS.length, "wall-clock traps").toBe(11);
      for (const { name, site, at, night } of WALL_CLOCK_TRAPS) {
        expect(
          tonightDateFor(site, new Date(at), TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG),
          `${name} is the night of ${night}`,
        ).toBe(night);
      }
    });
  });
});
