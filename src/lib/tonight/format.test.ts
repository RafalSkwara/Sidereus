import { describe, expect, it } from "vitest";

import { translateKey } from "@/i18n";
import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";
import type { DarkWindow, Verdict } from "@/lib/engine";

import { createFormatter, type MoonUp, type SkyHeadlineId, type SkyHeadlineKey } from "./format";

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

describe("the Moon card's lines (moonlight-and-the-verdict)", () => {
  const english = createFormatter("en");
  const polish = createFormatter("pl");
  const zone = "Europe/Warsaw";
  // 22:10 and 06:58 CEST, 01:30 and 03:40 CEST on the night of 10-11 October.
  const at = (hhmm: string, day = 11) => new Date(`2026-10-${day}T${hhmm}:00+02:00`);
  const rising: MoonUp = { kind: "part", spans: [{ start: at("22:10", 10), end: at("06:58") }], upAtStart: false };
  const setting: MoonUp = { kind: "part", spans: [{ start: at("19:05", 10), end: at("01:30") }], upAtStart: true };
  const twice: MoonUp = {
    kind: "part",
    spans: [
      { start: at("19:05", 10), end: at("20:10", 10) },
      { start: at("04:30"), end: at("06:58") },
    ],
    upAtStart: true,
  };

  it("says when the Moon is up: all night, when it sets, its spans, or not at all", () => {
    expect(english.moonUpText({ kind: "all" }, zone)).toBe("Up all night");
    expect(english.moonUpText({ kind: "never" }, zone)).toBe("Not up tonight");
    expect(english.moonUpText(rising, zone)).toBe("Up 22:10–06:58");
    expect(english.moonUpText(setting, zone)).toBe("Sets 01:30");
    expect(english.moonUpText(twice, zone)).toBe("Up 19:05–20:10 and 04:30–06:58");
    expect(polish.moonUpText(setting, zone)).toBe("Zachodzi o 01:30");
    expect(polish.moonUpText(twice, zone)).toBe("Nad horyzontem w godz. 19:05–20:10 i 04:30–06:58");
  });

  it("words the faint-objects line by the washed-out count first, then by the Moon's up time", () => {
    expect(english.moonFaintText({ kind: "all" }, 4, zone)).toBe("Bright Moon: 4 faint objects washed out tonight");
    expect(english.moonFaintText({ kind: "all" }, 1, zone)).toBe("Bright Moon: 1 faint object washed out tonight");
    expect(english.moonFaintText({ kind: "all" }, 0, zone)).toBe("Moonlit sky · no faint objects lost");
    expect(english.moonFaintText(rising, 0, zone)).toBe("Moon up 22:10–06:58 · no faint objects washed out");
    expect(english.moonFaintText({ kind: "never" }, 0, zone)).toBe("Dark night: no Moon");
    expect(polish.moonFaintText({ kind: "all" }, 5, zone)).toBe(
      "Jasny Księżyc: 5 słabych obiektów ginie dziś w jego blasku",
    );
    expect(polish.moonFaintText({ kind: "never" }, 0, zone)).toBe("Ciemna noc: bez Księżyca");
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

  it.each(rows)("words a %s night in English and Polish", (_label, verdict, id, key, englishText, polishText) => {
    expect(english.skyHeadline(verdict)).toEqual({ id, key, text: englishText });
    expect(polish.skyHeadline(verdict)).toEqual({ id, key, text: polishText });
    // The key names the catalogue entry the text comes from.
    expect(translateKey(en, key, "errors.generic")).toBe(englishText);
    expect(translateKey(pl, key, "errors.generic")).toBe(polishText);
  });

  it("names the next clearer night by its short date and its headline in lowercase", () => {
    const marginal: Verdict = { level: "marginal", reason: { kind: "clear-run", runHours: 1, cloudPct: 30 } };
    const next = { kind: "found" as const, date: "2026-10-09", verdict: marginal };
    expect(english.nextNightText(next)).toBe("Next clearer night: Fri 9 Oct (partly clear)");
    expect(polish.nextNightText(next)).toBe("Następna pogodniejsza noc: pt., 9 paź (częściowo pogodnie)");
    const damp: Verdict = { level: "marginal", reason: { kind: "humidity-cap", maxHumidityPct: 95 } };
    expect(english.nextNightText({ ...next, verdict: damp })).toBe("Next clearer night: Fri 9 Oct (clear, but damp)");
  });

  it("leads the planet weather line with the headline words", () => {
    const damp: Verdict = { level: "marginal", reason: { kind: "humidity-cap", maxHumidityPct: 95 } };
    expect(english.planetWeatherText(damp, null)).toBe(
      "For planets: clear, but damp — clear enough between dusk and dawn, but humidity reaches 95%, so expect dew and haze",
    );
    const none: Verdict = { level: "marginal", reason: { kind: "no-weather-data" } };
    expect(polish.planetWeatherText(none, null)).toBe("Dla planet: brak prognozy — brak danych pogodowych");
  });
});
