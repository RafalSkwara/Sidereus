import { describe, expect, it } from "vitest";

import { addDays, localNoon, observingNight, parseCalendarDate } from "./night";

const HOUR_MS = 3_600_000;

describe("observingNight", () => {
  it("spans exactly 24 hours on an ordinary night", () => {
    const night = observingNight("2026-10-10", "Europe/Warsaw");
    expect(night.end.getTime() - night.start.getTime()).toBe(24 * HOUR_MS);
    // 12:00 CEST (+02:00) is 10:00 UTC.
    expect(night.start.toISOString()).toBe("2026-10-10T10:00:00.000Z");
    expect(night.date).toBe("2026-10-10");
    expect(night.timeZone).toBe("Europe/Warsaw");
  });

  it("spans exactly 25 hours across the 2026-10-25 end of daylight-saving time", () => {
    const night = observingNight("2026-10-24", "Europe/Warsaw");
    expect(night.end.getTime() - night.start.getTime()).toBe(25 * HOUR_MS);
    expect(night.start.toISOString()).toBe("2026-10-24T10:00:00.000Z"); // 12:00 CEST
    expect(night.end.toISOString()).toBe("2026-10-25T11:00:00.000Z"); // 12:00 CET
  });

  it("spans 23 hours across the spring transition", () => {
    const night = observingNight("2026-03-28", "Europe/Warsaw");
    expect(night.end.getTime() - night.start.getTime()).toBe(23 * HOUR_MS);
  });

  it("uses the site's zone, not the process zone", () => {
    expect(localNoon("2026-06-21", "Europe/Oslo").toISOString()).toBe("2026-06-21T10:00:00.000Z");
    expect(localNoon("2026-06-21", "UTC").toISOString()).toBe("2026-06-21T12:00:00.000Z");
    expect(localNoon("2026-06-21", "America/Los_Angeles").toISOString()).toBe("2026-06-21T19:00:00.000Z");
    expect(localNoon("2026-06-21", "Asia/Kolkata").toISOString()).toBe("2026-06-21T06:30:00.000Z");
  });

  it("rejects malformed and impossible dates before touching Date.UTC", () => {
    expect(() => observingNight("2026-13-40", "Europe/Warsaw")).toThrow(RangeError);
    expect(() => observingNight("2026-02-30", "Europe/Warsaw")).toThrow(RangeError);
    expect(() => observingNight("garbage", "Europe/Warsaw")).toThrow(RangeError);
    expect(() => observingNight("2026-10-1", "Europe/Warsaw")).toThrow(RangeError);
    expect(() => parseCalendarDate("2026-10-10T00:00")).toThrow(RangeError);
  });

  it("rejects an unknown time zone", () => {
    expect(() => observingNight("2026-10-10", "Mars/Olympus_Mons")).toThrow(RangeError);
  });

  it("adds calendar days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});
