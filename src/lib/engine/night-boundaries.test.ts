import { describe, expect, it } from "vitest";

import { RUNNER_ZONES, expectRunnerZoneActive, useRunnerZone } from "./fixtures/runner-zones";
import { USNO_CIVIL_DAWN } from "./fixtures/usno";
import { observingNight } from "./night";
import { TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG } from "./parameters";
import { darkWindow, tonightDateFor } from "./sun";
import type { Site } from "./types";

// Every expectation is a hand literal or a USNO value (fixtures/usno.ts), never derived from the
// functions under test. Calls run inside `it`, after the runner zone is switched.

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

describe.each(RUNNER_ZONES)("night boundaries (runner zone %s)", (runnerZone) => {
  useRunnerZone(runnerZone);

  it("runs in the runner zone it claims", () => {
    expectRunnerZoneActive(runnerZone);
  });

  describe("(a) night spans", () => {
    it.each([
      {
        name: "Warsaw 2026-03-28, 23 h (spring forward)",
        date: "2026-03-28",
        zone: "Europe/Warsaw",
        start: "2026-03-28T11:00:00.000Z", // 12:00 CET
        end: "2026-03-29T10:00:00.000Z", // 12:00 CEST
      },
      {
        name: "Los Angeles 2026-10-31, 25 h (fall back)",
        date: "2026-10-31",
        zone: "America/Los_Angeles",
        start: "2026-10-31T19:00:00.000Z", // 12:00 PDT
        end: "2026-11-01T20:00:00.000Z", // 12:00 PST
      },
      {
        name: "Auckland 2026-10-24, 24 h (UTC+13)",
        date: "2026-10-24",
        zone: "Pacific/Auckland",
        start: "2026-10-23T23:00:00.000Z", // 12:00 NZDT
        end: "2026-10-24T23:00:00.000Z", // 12:00 NZDT
      },
      {
        name: "Kiritimati 2026-10-24, 24 h (UTC+14)",
        date: "2026-10-24",
        zone: "Pacific/Kiritimati",
        start: "2026-10-23T22:00:00.000Z", // 12:00 +14
        end: "2026-10-24T22:00:00.000Z", // 12:00 +14
      },
    ])("$name", ({ date, zone, start, end }) => {
      const night = observingNight(date, zone);
      expect(night.start.toISOString()).toBe(start);
      expect(night.end.toISOString()).toBe(end);
    });
  });

  describe("(b) dark window end vs USNO civil dawn", () => {
    it.each(USNO_CIVIL_DAWN)("$label: end within 2 min of USNO", ({ site, night, civilDawn }) => {
      const window = darkWindow(site, observingNight(night, site.timeZone), TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG);
      expect(window.kind).toBe("window");
      if (window.kind !== "window") {
        return;
      }
      expect(Math.abs(window.end.getTime() - new Date(civilDawn).getTime())).toBeLessThanOrEqual(2 * MINUTE_MS);
    });
  });

  describe("(c) either side of civil dawn", () => {
    it.each(USNO_CIVIL_DAWN)("$label: 5 min before is the night, 5 min after the evening ahead", (entry) => {
      const next = NEXT_DATE[entry.night];
      const dawnMs = new Date(entry.civilDawn).getTime();
      const before = new Date(dawnMs - 5 * MINUTE_MS);
      const after = new Date(dawnMs + 5 * MINUTE_MS);
      expect(tonightDateFor(entry.site, before, TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG)).toBe(entry.night);
      expect(tonightDateFor(entry.site, after, TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG)).toBe(next);
    });
  });

  describe("(d) wall-clock traps", () => {
    it.each([
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
    ])("$name is the night of $night", ({ site, at, night }) => {
      expect(tonightDateFor(site, new Date(at), TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG)).toBe(night);
    });
  });
});
