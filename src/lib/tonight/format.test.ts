import { describe, expect, it } from "vitest";

import { translateKey } from "@/i18n";
import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";
import type { DarkWindow, Verdict } from "@/lib/engine";

import { createFormatter, type SkyHeadlineId, type SkyHeadlineKey } from "./format";

const { darkSpanText, formatShortNightDate, formatTime, noDarknessCauseText, seenLine } = createFormatter("en");

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
    expect(seenLine({ count: 1, firstNight: "2026-12-31", lastNight: "2026-12-31" })).toBe(
      "Seen 1 time – last 31 Dec 2026",
    );
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
  const english = createFormatter("en");
  const peak = { time: new Date("2026-10-26T21:53:00Z"), altitudeDeg: 57.6 };

  it("rounds the low wording down, so a peak just under the low line never reads as the line itself", () => {
    const justUnder = { placement: "low" as const, timing: "evening" as const, peak: { ...peak, altitudeDeg: 29.6 } };
    expect(english.moonReasonLine(justUnder, "Europe/Warsaw")).toBe(
      "Highest only 29° at 22:53 — best early in the night; this low, the view may shimmer",
    );
    // Above the low line the altitude still rounds to the nearest degree.
    expect(
      english.moonReasonLine(
        { placement: "well", timing: "night", peak: { ...peak, altitudeDeg: 30.6 } },
        "Europe/Warsaw",
      ),
    ).toBe("Highest 31° at 22:53 — best in the middle of the night");
  });
});

describe("the sky headline (moonlight-and-the-verdict)", () => {
  const english = createFormatter("en");
  const polish = createFormatter("pl");

  // One row per line of the plan's headline table, plus a cloudy reason with no forecast hour in the dark window.
  const rows: [string, Verdict, SkyHeadlineId, SkyHeadlineKey, string, string][] = [
    [
      "go",
      { level: "go", reason: { kind: "clear-run", runHours: 3, cloudPct: 5 } },
      "go",
      "verdict.level.go",
      "Clear",
      "Pogodnie",
    ],
    [
      "marginal (cloud)",
      { level: "marginal", reason: { kind: "clear-run", runHours: 1, cloudPct: 30 } },
      "marginal",
      "verdict.level.marginal",
      "Partly clear",
      "Częściowo pogodnie",
    ],
    [
      "humidity cap",
      { level: "marginal", reason: { kind: "humidity-cap", maxHumidityPct: 95 } },
      "humidityCap",
      "verdict.sky.humidityCap",
      "Clear, but damp",
      "Pogodnie, ale wilgotno",
    ],
    [
      "fallback cap",
      { level: "marginal", reason: { kind: "fallback-cap", runHours: 3, cloudPct: 5 } },
      "fallbackCap",
      "verdict.sky.fallbackCap",
      "Clear (old forecast)",
      "Pogodnie (stara prognoza)",
    ],
    [
      "no weather data",
      { level: "marginal", reason: { kind: "no-weather-data" } },
      "noForecast",
      "verdict.sky.noForecast",
      "No forecast",
      "Brak prognozy",
    ],
    [
      "no-go (cloud)",
      { level: "no-go", reason: { kind: "cloudy", bestRunHours: 0, minCloudPct: 80 } },
      "no-go",
      "verdict.level.no-go",
      "Cloudy",
      "Pochmurno",
    ],
    [
      "no-go without a forecast hour in the dark window",
      { level: "no-go", reason: { kind: "cloudy", bestRunHours: 0, minCloudPct: null } },
      "noForecast",
      "verdict.sky.noForecast",
      "No forecast",
      "Brak prognozy",
    ],
    [
      "no-go (no darkness)",
      { level: "no-go", reason: { kind: "no-darkness" } },
      "noDarkness",
      "tonight.card.noDarkWindow",
      "No dark window",
      "Brak ciemnej nocy",
    ],
  ];

  it("words each line of the plan's headline table in English and Polish", () => {
    // Non-vacuity: the table lists all eight lines, so a shorter sample can never pass.
    expect(rows).toHaveLength(8);
    for (const [label, verdict, id, key, englishText, polishText] of rows) {
      expect(english.skyHeadline(verdict), `${label} (en)`).toEqual({ id, key, text: englishText });
      expect(polish.skyHeadline(verdict), `${label} (pl)`).toEqual({ id, key, text: polishText });
      // The key names the catalogue entry the text comes from.
      expect(translateKey(en, key, "errors.generic"), `${label} (en key)`).toBe(englishText);
      expect(translateKey(pl, key, "errors.generic"), `${label} (pl key)`).toBe(polishText);
    }
  });
});
