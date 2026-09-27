import { describe, expect, it } from "vitest";

import type { DarkWindow, Verdict } from "@/lib/engine";

import { createFormatter, type ReasonEntry } from "./format";

const {
  clearedLine,
  cloudOutlookText,
  compassPoint,
  darkReturnText,
  darkSpanText,
  forecastStatusText,
  formatAge,
  formatDirection,
  formatDuration,
  formatNightDate,
  formatShortNightDate,
  formatTime,
  moonLine,
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

/** A dark window from `start` to `end` (ISO instants). */
function windowOf(start: string, end: string): DarkWindow {
  return {
    kind: "window",
    thresholdDeg: -18,
    start: new Date(start),
    end: new Date(end),
    clampedToNightStart: false,
    clampedToNightEnd: false,
  };
}

const NO_WINDOW: DarkWindow = {
  kind: "none",
  thresholdDeg: -18,
  minSunAltitudeDeg: 3.1,
  at: new Date("2026-06-21T23:00Z"),
};

describe("formatShortNightDate", () => {
  it("reads the evening date as short weekday, day and month, never shifted by a zone", () => {
    expect(formatShortNightDate("2026-10-24")).toBe("Sat 24 Oct");
    expect(formatShortNightDate("2026-12-31")).toBe("Thu 31 Dec");
  });
});

describe("darkSpanText", () => {
  it("formats both ends on the site's wall clock", () => {
    expect(darkSpanText(windowOf("2026-10-10T17:05:00Z", "2026-10-11T02:40:00Z"), "Europe/Warsaw")).toBe("19:05–04:40");
  });

  it("formats each end at its own offset across the DST change", () => {
    // Night of 24-25 Oct 2026 in Warsaw: starts in CEST (UTC+2), ends in CET (UTC+1).
    expect(darkSpanText(windowOf("2026-10-24T17:00:00Z", "2026-10-25T03:00:00Z"), "Europe/Warsaw")).toBe("19:00–04:00");
  });

  it("reads a night without a dark window as no darkness", () => {
    expect(darkSpanText(NO_WINDOW, "Europe/Oslo")).toBe("No darkness");
  });
});

describe("moonLine", () => {
  // A 5 h dark window.
  const window = windowOf("2026-10-10T18:00:00Z", "2026-10-10T23:00:00Z");

  it("names the illumination and the moon-free part of the dark window", () => {
    expect(moonLine({ illuminatedFraction: 0.624, moonFreeMinutes: 190 }, window)).toBe(
      "Moon 62% · 3 h 10 min moon-free",
    );
  });

  it("says when the Moon is up for the whole dark window", () => {
    expect(moonLine({ illuminatedFraction: 0.985, moonFreeMinutes: 0 }, window)).toBe(
      "Moon 99% · up the whole dark window",
    );
  });

  it("says when the Moon stays below the horizon for the whole dark window", () => {
    expect(moonLine({ illuminatedFraction: 0.004, moonFreeMinutes: 300 }, window)).toBe(
      "Moon 0% · below the horizon all night",
    );
  });

  it("shows only the illumination without a dark window", () => {
    expect(moonLine({ illuminatedFraction: 0.5, moonFreeMinutes: null }, NO_WINDOW)).toBe("Moon 50%");
  });
});

describe("cloudOutlookText", () => {
  it.each([
    [34, "Cloud ~30%"],
    [35, "Cloud ~40%"],
    [0, "Cloud ~0%"],
    [100, "Cloud ~100%"],
  ])("rounds a uniform %s to the nearest ten: %s", (pct, text) => {
    expect(cloudOutlookText({ meanCloudPct: pct, minCloudPct: pct })).toBe(text);
  });

  it("adds the clearest hour when it rounds differently from the mean", () => {
    expect(cloudOutlookText({ meanCloudPct: 50, minCloudPct: 0 })).toBe("Cloud ~50%, down to 0%");
    expect(cloudOutlookText({ meanCloudPct: 47.5, minCloudPct: 14 })).toBe("Cloud ~50%, down to 10%");
  });

  it("gives only the mean when both round to the same value", () => {
    expect(cloudOutlookText({ meanCloudPct: 42, minCloudPct: 38 })).toBe("Cloud ~40%");
  });

  it("says there is no outlook yet without forecast hours", () => {
    expect(cloudOutlookText(null)).toBe("No cloud outlook yet");
  });
});

describe("Polish formatting (pl-PL)", () => {
  const pl = createFormatter("pl");
  const zone = "Europe/Warsaw";

  it("formats the night as a Polish calendar date", () => {
    expect(pl.formatNightDate("2026-10-10")).toBe("sobota, 10 października 2026");
  });

  it("uses a 24-hour clock", () => {
    expect(pl.formatTime(new Date("2026-10-10T20:45:00Z"), zone)).toBe("22:45");
    expect(pl.formatTime(new Date("2026-10-10T22:05:00Z"), zone)).toBe("00:05");
  });

  it("uses a comma as the decimal separator, with no grouping", () => {
    const start = new Date("2026-10-10T18:00:00Z");
    const entry: ReasonEntry = {
      object: { vMag: 3.4 },
      score: {
        window: {
          start,
          end: new Date(start.getTime() + 90 * 60_000),
          peak: { time: start, altitudeDeg: 60, azimuthDeg: 180 },
        },
        components: { duration: 0.8, moon: 0.92, brightness: 0.7, sky: 1 },
      },
      leadComponent: "brightness",
      secondComponent: "duration",
    };
    expect(pl.reasonLine(entry, { apertureMm: 101.6, bortle: 6 })).toBe(
      "Jasny obiekt dla Twoich 101,6 mm · na niebie przez 1 godz. 30 min w oknie ciemności",
    );
    expect(
      pl.reasonLine({ ...entry, leadComponent: "sky", secondComponent: "moon" }, { apertureMm: 1000, bortle: 6 }),
    ).toBe("Poradzi sobie pod Twoim niebem (6 w skali Bortle'a) · 92% bez blasku Księżyca");
  });

  it.each([
    [(5 * 60 + 10) * 60_000, "5 godz. 10 min"],
    [3 * 3_600_000, "3 godz."],
    [40 * 60_000, "40 min"],
  ])("formats a duration of %s ms as %s", (ms, text) => {
    expect(pl.formatDuration(ms)).toBe(text);
  });

  it.each([
    [2, "2 dni"],
    [5, "5 dni"],
    [22, "22 dni"],
  ])("puts an age of %i days in the Polish plural", (days, text) => {
    expect(pl.formatAge(days * 24 * 3_600_000)).toBe(text);
  });

  it("reads short ages with abbreviated units", () => {
    expect(pl.formatAge(30_000)).toBe("niecałą minutę");
    expect(pl.forecastStatusText({ kind: "fresh", ageMs: 20 * 60_000 })).toBe("Prognoza zaktualizowana 20 min temu");
    expect(pl.forecastStatusText({ kind: "fallback", ageMs: 3 * 24 * 3_600_000 })).toBe(
      "Serwis pogodowy nie odpowiada — pokazujemy prognozę pobraną 3 dni temu",
    );
  });

  it.each([
    [0, "Dziś żaden obiekt nie jest wart uwagi"],
    [1, "1 obiekt wart dziś uwagi"],
    [2, "2 obiekty warte dziś uwagi"],
    [5, "5 obiektów wartych dziś uwagi"],
    [22, "22 obiekty warte dziś uwagi"],
  ])("counts %i cleared object(s) in the Polish plural", (count, text) => {
    expect(pl.clearedLine(count)).toBe(text);
  });

  it.each([
    [0, "Pn"],
    [90, "W"],
    [202.5, "PdPdZ"],
    [225, "PdZ"],
    [270, "Z"],
    [337.5, "PnPnZ"],
  ])("names %s° with the Polish compass point %s", (azimuth, point) => {
    expect(pl.compassPoint(azimuth)).toBe(point);
  });

  it("reads a direction as compass point and altitude", () => {
    expect(pl.formatDirection({ azimuthDeg: 226, altitudeDeg: 44.6 })).toBe("PdZ, 45°");
  });

  it("puts the verdict reason and the next night into Polish", () => {
    expect(pl.verdictReasonText({ level: "go", reason: { kind: "clear-run", runHours: 4, cloudPct: 12 } })).toBe(
      "4 godz. z rzędu z zachmurzeniem najwyżej 12% w oknie ciemności",
    );
    expect(
      pl.nextNightText({
        kind: "found",
        date: "2026-10-12",
        verdict: { level: "marginal", reason: { kind: "humidity-cap", maxHumidityPct: 96 } },
      }),
    ).toBe(
      "Następna noc warta uwagi: poniedziałek, 12 października 2026 — na granicy, niebo dość czyste, ale wilgotność sięga 96%, więc spodziewaj się rosy i zamglenia",
    );
    expect(pl.nextNightText({ kind: "none", lastJudgedDate: "2026-10-12" })).toBe(
      "Brak pogodnej nocy w prognozie; ostatnia sprawdzona noc: poniedziałek, 12 października 2026",
    );
  });

  it("explains a night without darkness with degree values", () => {
    expect(pl.noDarknessCauseText({ latitudeDeg: 69.65, minSunAltitudeDeg: 3.1, thresholdDeg: -18, bortle: 2 })).toBe(
      "Na 70° szerokości północnej o tej porze roku Słońce przez całą noc pozostaje nad horyzontem",
    );
    expect(pl.noDarknessCauseText({ latitudeDeg: 60.17, minSunAltitudeDeg: -6.4, thresholdDeg: -18, bortle: 3 })).toBe(
      "Na 60° szerokości północnej o tej porze roku Słońce schodzi tylko 6° pod horyzont, a Twoje niebo (3 w skali Bortle'a) potrzebuje 18°",
    );
    expect(pl.noDarknessCauseText({ latitudeDeg: -77.85, minSunAltitudeDeg: -9.2, thresholdDeg: -12, bortle: 8 })).toBe(
      "Na 78° szerokości południowej o tej porze roku Słońce schodzi tylko 9° pod horyzont, a Twoje niebo (8 w skali Bortle'a) potrzebuje 12°",
    );
  });

  it("words the seven-night strip in Polish", () => {
    const window = windowOf("2026-10-10T18:00:00Z", "2026-10-10T23:00:00Z");
    expect(pl.formatShortNightDate("2026-10-24")).toBe("sob., 24 paź");
    expect(pl.darkSpanText(NO_WINDOW, zone)).toBe("Brak ciemności");
    expect(pl.moonLine({ illuminatedFraction: 0.624, moonFreeMinutes: 190 }, window)).toBe(
      "Księżyc 62% · 3 godz. 10 min pod horyzontem",
    );
    expect(pl.moonLine({ illuminatedFraction: 0.985, moonFreeMinutes: 0 }, window)).toBe(
      "Księżyc 99% · nad horyzontem przez całe okno ciemności",
    );
    expect(pl.moonLine({ illuminatedFraction: 0.004, moonFreeMinutes: 300 }, window)).toBe(
      "Księżyc 0% · pod horyzontem przez całą noc",
    );
    expect(pl.cloudOutlookText({ meanCloudPct: 50, minCloudPct: 0 })).toBe("Zachmurzenie ~50%, chwilami 0%");
    expect(pl.cloudOutlookText({ meanCloudPct: 42, minCloudPct: 38 })).toBe("Zachmurzenie ~40%");
    expect(pl.cloudOutlookText(null)).toBe("Brak jeszcze prognozy zachmurzenia");
  });

  it("names the night the dark window returns, with its times", () => {
    const window = { start: new Date("2026-08-21T20:30:00Z"), end: new Date("2026-08-22T00:15:00Z") };
    expect(pl.darkReturnText({ date: "2026-08-21", window }, "Europe/Oslo")).toBe(
      "Następne okno ciemności: piątek, 21 sierpnia 2026 (22:30–02:15)",
    );
    expect(pl.darkReturnText(null, "Europe/Oslo")).toBe("Okno ciemności nie wróci w ciągu najbliższego roku");
  });
});

describe("seenLine (FR-018 tag)", () => {
  const en = createFormatter("en");
  const pl = createFormatter("pl");

  it("names how many nights the object was seen and the latest, as a calendar date", () => {
    expect(en.seenLine({ count: 1, lastNight: "2026-09-12" })).toBe("Seen 1 time – last 12 Sept 2026");
    expect(en.seenLine({ count: 3, lastNight: "2026-09-12" })).toBe("Seen 3 times – last 12 Sept 2026");
  });

  it("uses the Polish plural forms", () => {
    expect(pl.seenLine({ count: 1, lastNight: "2026-09-12" })).toBe("Widziany 1 raz – ostatnio 12 wrz 2026");
    expect(pl.seenLine({ count: 3, lastNight: "2026-09-12" })).toBe("Widziany 3 razy – ostatnio 12 wrz 2026");
    expect(pl.seenLine({ count: 5, lastNight: "2026-09-12" })).toBe("Widziany 5 razy – ostatnio 12 wrz 2026");
  });

  it("reads the night as a date, never shifted by a time zone", () => {
    expect(en.seenLine({ count: 1, lastNight: "2026-12-31" })).toBe("Seen 1 time – last 31 Dec 2026");
  });
});
