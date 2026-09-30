import { describe, expect, it } from "vitest";

import type { DarkWindow } from "@/lib/engine";

import { createFormatter } from "./format";

const { compassPoint, darkSpanText, formatShortNightDate, formatTime, noDarknessCauseText, seenLine } =
  createFormatter("en");

describe("compassPoint", () => {
  it("maps azimuths to 16 points, wrapping and splitting at the half-sector boundary", () => {
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(22.5)).toBe("NNE");
    expect(compassPoint(225)).toBe("SW");
    expect(compassPoint(348.75)).toBe("N");
    expect(compassPoint(348.74)).toBe("NNW");
    expect(compassPoint(-45)).toBe("NW");
    expect(compassPoint(720)).toBe("N");
  });
});

describe("times in the site's zone (NFR daylight-saving)", () => {
  const zone = "Europe/Warsaw";

  it("uses the zone's offset on each side of the 2026-10-25 DST change, never the server's zone", () => {
    expect(formatTime(new Date("2026-10-24T20:00:00Z"), zone)).toBe("22:00"); // CEST, UTC+2
    expect(formatTime(new Date("2026-10-25T20:00:00Z"), zone)).toBe("21:00"); // CET, UTC+1
    expect(formatTime(new Date("2026-10-25T00:30:00Z"), zone)).toBe("02:30"); // repeated hour, first pass
    expect(formatTime(new Date("2026-10-25T01:30:00Z"), zone)).toBe("02:30"); // repeated hour, second pass
    expect(formatTime(new Date("2026-10-10T22:05:00Z"), "America/New_York")).toBe("18:05");
  });

  it("formats each end of a dark window at its own offset across the DST change", () => {
    const window: DarkWindow = {
      kind: "window",
      thresholdDeg: -18,
      start: new Date("2026-10-24T17:00:00Z"),
      end: new Date("2026-10-25T03:00:00Z"),
      clampedToNightStart: false,
      clampedToNightEnd: false,
    };
    expect(darkSpanText(window, zone)).toBe("19:00–04:00");
  });

  it("reads calendar-date nights as dates, never shifted by a time zone", () => {
    expect(formatShortNightDate("2026-12-31")).toBe("Thu 31 Dec");
    expect(seenLine({ count: 1, lastNight: "2026-12-31" })).toBe("Seen 1 time – last 31 Dec 2026");
  });
});

describe("noDarknessCauseText", () => {
  it("truncates the sun's depth so a near miss always reads short of the threshold", () => {
    expect(noDarknessCauseText({ latitudeDeg: 55, minSunAltitudeDeg: -17.8, thresholdDeg: -18, bortle: 1 })).toBe(
      "At 55° N at this time of year the sun only sinks 17° below the horizon, short of the 18° your Bortle 1 sky needs",
    );
  });
});
