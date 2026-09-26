import { describe, expect, it } from "vitest";

import type { Verdict } from "@/lib/engine";

import { createFormatter, type ReasonEntry } from "./format";

const {
  clearedLine,
  compassPoint,
  darkReturnText,
  forecastStatusText,
  formatAge,
  formatDirection,
  formatDuration,
  formatNightDate,
  formatTime,
  nextNightText,
  noDarknessCauseText,
  reasonLine,
  verdictReasonText,
} = createFormatter("en");

describe("compassPoint", () => {
  it.each([
    [0, "N"],
    [22.5, "NNE"],
    [45, "NE"],
    [359, "N"],
    [180, "S"],
    [225, "SW"],
    [348.75, "N"],
    [348.74, "NNW"],
    [-45, "NW"],
    [720, "N"],
  ])("%s° → %s", (azimuth, point) => {
    expect(compassPoint(azimuth)).toBe(point);
  });
});

describe("formatDirection", () => {
  it("reads compass point, then whole-degree altitude", () => {
    expect(formatDirection({ azimuthDeg: 226, altitudeDeg: 44.6 })).toBe("SW, 45°");
  });
});

describe("formatTime", () => {
  const zone = "Europe/Warsaw";

  it("uses the zone's offset on each side of the 2026-10-25 DST change", () => {
    expect(formatTime(new Date("2026-10-24T20:00:00Z"), zone)).toBe("22:00"); // CEST, UTC+2
    expect(formatTime(new Date("2026-10-25T20:00:00Z"), zone)).toBe("21:00"); // CET, UTC+1
  });

  it("shows 02:30 twice across the repeated hour", () => {
    expect(formatTime(new Date("2026-10-25T00:30:00Z"), zone)).toBe("02:30");
    expect(formatTime(new Date("2026-10-25T01:30:00Z"), zone)).toBe("02:30");
  });

  it("is 24-hour and zero-padded, never the server's zone", () => {
    expect(formatTime(new Date("2026-10-10T22:05:00Z"), zone)).toBe("00:05");
    expect(formatTime(new Date("2026-10-10T22:05:00Z"), "America/New_York")).toBe("18:05");
  });
});

describe("formatNightDate", () => {
  it("formats the evening date as a calendar date", () => {
    expect(formatNightDate("2026-10-10")).toBe("Saturday, 10 October 2026");
  });
});

describe("formatDuration", () => {
  it.each([
    [(5 * 60 + 10) * 60_000, "5 h 10 min"],
    [3 * 3_600_000, "3 h"],
    [40 * 60_000, "40 min"],
    [0, "0 min"],
  ])("%s ms → %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe("reasonLine", () => {
  const start = new Date("2026-10-10T18:00:00Z");
  const entry = (lead: ReasonEntry["leadComponent"], second: ReasonEntry["secondComponent"]): ReasonEntry => ({
    object: { vMag: 3.4 },
    score: {
      window: {
        start,
        end: new Date(start.getTime() + (5 * 60 + 10) * 60_000),
        peak: { time: start, altitudeDeg: 60, azimuthDeg: 180 },
      },
      components: { duration: 0.8, moon: 0.92, brightness: 0.7, sky: 1 },
    },
    leadComponent: lead,
    secondComponent: second,
  });
  const context = { apertureMm: 150, bortle: 6 };

  it("leads with the leading component, then the runner-up", () => {
    expect(reasonLine(entry("duration", "brightness"), context)).toBe(
      "Up for 5 h 10 min of the dark window · bright for your 150 mm",
    );
  });

  it("has one template per component", () => {
    expect(reasonLine(entry("moon", "sky"), context)).toBe("92% clear of moonlight · holds up under your Bortle 6 sky");
    expect(reasonLine(entry("brightness", "duration"), context)).toBe(
      "Bright for your 150 mm · up for 5 h 10 min of the dark window",
    );
    expect(reasonLine(entry("sky", "moon"), context)).toBe("Holds up under your Bortle 6 sky · 92% clear of moonlight");
  });
});

describe("verdictReasonText", () => {
  it.each<[Verdict, string]>([
    [
      { level: "go", reason: { kind: "clear-run", runHours: 4, cloudPct: 12 } },
      "4 h in a row with at most 12% cloud in the dark window",
    ],
    [
      { level: "marginal", reason: { kind: "humidity-cap", maxHumidityPct: 96 } },
      "clear enough, but humidity reaches 96%, so expect dew and haze",
    ],
    [
      { level: "no-go", reason: { kind: "cloudy", bestRunHours: 0, minCloudPct: 80 } },
      "too cloudy: the clearest dark hour has 80% cloud",
    ],
    [
      { level: "no-go", reason: { kind: "cloudy", bestRunHours: 0, minCloudPct: null } },
      "no forecast covers the dark window",
    ],
    [
      { level: "marginal", reason: { kind: "fallback-cap", runHours: 5, cloudPct: 10 } },
      "the last saved forecast showed 5 h in a row with at most 10% cloud, but it could not be refreshed",
    ],
    [{ level: "marginal", reason: { kind: "no-weather-data" } }, "no weather data"],
    [{ level: "no-go", reason: { kind: "no-darkness" } }, "the sky never gets dark enough tonight"],
  ])("%j", (v, text) => {
    expect(verdictReasonText(v)).toBe(text);
  });
});

describe("clearedLine", () => {
  it("states how many objects cleared the bar", () => {
    expect(clearedLine(0)).toBe("No object cleared the bar tonight");
    expect(clearedLine(1)).toBe("1 object cleared the bar tonight");
    expect(clearedLine(18)).toBe("18 objects cleared the bar tonight");
  });
});

describe("formatAge", () => {
  const MINUTE = 60_000;
  it.each([
    [-1_000, "less than a minute"],
    [59_000, "less than a minute"],
    [MINUTE, "1 min"],
    [59 * MINUTE, "59 min"],
    [60 * MINUTE, "1 h"],
    [(47 * 60 + 59) * MINUTE, "47 h"],
    [48 * 60 * MINUTE, "2 days"],
  ])("%s ms → %s", (ms, text) => {
    expect(formatAge(ms)).toBe(text);
  });
});

describe("forecastStatusText", () => {
  it("has one line per status", () => {
    expect(forecastStatusText({ kind: "fresh", ageMs: 20 * 60_000 })).toBe("Forecast updated 20 min ago");
    expect(forecastStatusText({ kind: "fallback", ageMs: 3 * 3_600_000 })).toBe(
      "Weather service unreachable — showing the forecast from 3 h ago",
    );
    expect(forecastStatusText({ kind: "none" })).toBe(
      "No weather data — the weather service could not be reached and no earlier forecast is saved",
    );
  });
});

describe("nextNightText", () => {
  it("names the next night with its level and reason", () => {
    expect(
      nextNightText({
        kind: "found",
        date: "2026-10-12",
        verdict: { level: "go", reason: { kind: "clear-run", runHours: 6, cloudPct: 10 } },
      }),
    ).toBe(
      "Next night worth a look: Monday, 12 October 2026 — go, 6 h in a row with at most 10% cloud in the dark window",
    );
  });

  it("says how far the forecast was judged when no night qualifies", () => {
    expect(nextNightText({ kind: "none", lastJudgedDate: "2026-10-12" })).toBe(
      "No clear night in the forecast through Monday, 12 October 2026",
    );
  });

  it("says the forecast ends at tonight when nothing after it was judged", () => {
    expect(nextNightText({ kind: "none", lastJudgedDate: null })).toBe(
      "The forecast doesn't reach past tonight, so there is no next night to suggest yet",
    );
  });
});

describe("noDarknessCauseText", () => {
  it("says the sun stays up under the midnight sun", () => {
    expect(noDarknessCauseText({ latitudeDeg: 69.65, minSunAltitudeDeg: 3.1, thresholdDeg: -18, bortle: 2 })).toBe(
      "At 70° N at this time of year the sun stays above the horizon all night",
    );
  });

  it("names how far the sun sinks against the Bortle threshold", () => {
    expect(noDarknessCauseText({ latitudeDeg: 60.17, minSunAltitudeDeg: -6.4, thresholdDeg: -18, bortle: 3 })).toBe(
      "At 60° N at this time of year the sun only sinks 6° below the horizon, short of the 18° your Bortle 3 sky needs",
    );
  });

  it("reads southern latitudes as S", () => {
    expect(noDarknessCauseText({ latitudeDeg: -77.85, minSunAltitudeDeg: -9.2, thresholdDeg: -12, bortle: 8 })).toBe(
      "At 78° S at this time of year the sun only sinks 9° below the horizon, short of the 12° your Bortle 8 sky needs",
    );
  });

  it("truncates the depth so it always reads short of the threshold", () => {
    expect(noDarknessCauseText({ latitudeDeg: 55, minSunAltitudeDeg: -17.8, thresholdDeg: -18, bortle: 1 })).toBe(
      "At 55° N at this time of year the sun only sinks 17° below the horizon, short of the 18° your Bortle 1 sky needs",
    );
  });
});

describe("darkReturnText", () => {
  it("names the night and its window in the site's zone", () => {
    const window = { start: new Date("2026-08-21T20:30:00Z"), end: new Date("2026-08-22T00:15:00Z") };
    expect(darkReturnText({ date: "2026-08-21", window }, "Europe/Oslo")).toBe(
      "The dark window returns on the night of Friday, 21 August 2026 (22:30–02:15)",
    );
  });

  it("says when it does not return within the search", () => {
    expect(darkReturnText(null, "Europe/Oslo")).toBe("It does not return within the next year");
  });
});
