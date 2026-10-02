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

describe("the Moon's wording (M-2 S-02)", () => {
  const polish = createFormatter("pl");
  const english = createFormatter("en");
  const peak = { time: new Date("2026-10-26T21:53:00Z"), altitudeDeg: 57.6 };

  it("names the phase band and the illumination in whole percent, in each locale", () => {
    expect(english.moonPhaseText("waxing-gibbous", 0.784)).toBe("Waxing gibbous · 78% lit");
    expect(english.moonPhaseText("waning-crescent", 0.05)).toBe("Waning crescent · 5% lit");
    expect(polish.moonPhaseText("waxing-gibbous", 0.784)).toBe("Garbaty przybywający · oświetlony w 78%");
    expect(polish.moonPhaseText("full", 0.995)).toBe("Pełnia · oświetlony w 100%");
  });

  it("gives the highest point and timing, with the low wording below the low altitude", () => {
    expect(english.moonReasonLine({ placement: "high", timing: "night", peak }, "Europe/Warsaw")).toBe(
      "Highest 58° at 22:53 — best in the middle of the night",
    );
    const low = { placement: "low" as const, timing: "evening" as const, peak: { ...peak, altitudeDeg: 22.2 } };
    expect(english.moonReasonLine(low, "Europe/Warsaw")).toBe(
      "Highest only 22° at 22:53 — best early in the night; this low, the view may shimmer",
    );
    expect(polish.moonReasonLine(low, "Europe/Warsaw")).toBe(
      "Najwyżej tylko 22° o 22:53 — najlepiej wieczorem; tak nisko obraz może falować",
    );
  });

  it("words the bright-Moon line, with the pointer only when asked", () => {
    expect(english.brightMoonLine(0.986, { pointer: false })).toBe(
      "Bright Moon (99% lit) up most of the dark hours: faint galaxies and nebulae will be washed out.",
    );
    expect(english.brightMoonLine(0.986, { pointer: true })).toBe(
      "Bright Moon (99% lit) up most of the dark hours: faint galaxies and nebulae will be washed out. The Moon and planets below are better bets tonight.",
    );
  });
});
