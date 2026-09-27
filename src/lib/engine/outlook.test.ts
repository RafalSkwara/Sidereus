import { describe, expect, it } from "vitest";

import { TROMSO, WARSAW } from "./fixtures";
import { moonFreeMinutes, moonState } from "./moon";
import { addDays, observingNight } from "./night";
import { darkWindowReturn, nextNightNotNoGo, sevenNightOutlook } from "./outlook";
import { DARK_RETURN_MAX_NIGHTS, OUTLOOK_NIGHTS, VERDICT_NIGHTS } from "./parameters";
import { darkWindow } from "./sun";
import type { DarkWindow, ForecastHour, HourlyForecast, Site } from "./types";
import { verdict } from "./verdict";

const HOUR_MS = 3_600_000;

type Window = Extract<DarkWindow, { kind: "window" }>;

function windowOf(site: Site, date: string, thresholdDeg: number): Window {
  const window = darkWindow(site, observingNight(date, site.timeZone), thresholdDeg);
  if (window.kind !== "window") {
    throw new Error(`expected a dark window on ${date}`);
  }
  return window;
}

describe("nextNightNotNoGo", () => {
  // Warsaw in October: every night has a dark window. Night 1 is 10 Oct, nights 2 and 3 follow.
  const DATE = "2026-10-10";
  const NIGHT_2 = "2026-10-11";
  const NIGHT_3 = "2026-10-12";
  const THRESHOLD = -18;
  const night2 = windowOf(WARSAW, NIGHT_2, THRESHOLD);
  const night3 = windowOf(WARSAW, NIGHT_3, THRESHOLD);
  const SERIES_START = Date.UTC(2026, 9, 9, 0, 0, 0);

  /**
   * Hourly series from 00:00 UTC on 9 Oct up to (not including) `endMs`: `cloud2` inside night 2's
   * dark window, `cloud3` inside night 3's, overcast everywhere else.
   */
  function series(cloud2: number, cloud3: number, endMs = Date.UTC(2026, 9, 14, 0, 0, 0)): HourlyForecast {
    const hours: ForecastHour[] = [];
    const inside = (t: number, w: Window) => t + HOUR_MS > w.start.getTime() && t < w.end.getTime();
    for (let t = SERIES_START; t < endMs; t += HOUR_MS) {
      const cloudCoverPct = inside(t, night2) ? cloud2 : inside(t, night3) ? cloud3 : 100;
      hours.push({ start: new Date(t), cloudCoverPct, humidityPct: 60 });
    }
    return { hours };
  }

  const input = (forecast: HourlyForecast | null, fallback = false) => ({
    site: WARSAW,
    thresholdDeg: THRESHOLD,
    date: DATE,
    forecast,
    fallback,
  });

  it("finds night 2 when it is marginal", () => {
    const next = nextNightNotNoGo(input(series(50, 0)));
    expect(next).toMatchObject({ kind: "found", date: NIGHT_2, verdict: { level: "marginal" } });
  });

  it("finds night 3 when night 2 is a no-go and night 3 a go", () => {
    const next = nextNightNotNoGo(input(series(100, 10)));
    expect(next).toMatchObject({ kind: "found", date: NIGHT_3, verdict: { level: "go" } });
  });

  it("is none up to night 3 when nights 2 and 3 are both no-go", () => {
    expect(nextNightNotNoGo(input(series(100, 90)))).toEqual({ kind: "none", lastJudgedDate: NIGHT_3 });
  });

  it("is none with no judged night when the series does not cover night 2", () => {
    const endsInNight2 = night2.start.getTime() + 2 * HOUR_MS;
    expect(nextNightNotNoGo(input(series(10, 10, endsInNight2)))).toEqual({ kind: "none", lastJudgedDate: null });
    expect(nextNightNotNoGo(input(null))).toEqual({ kind: "none", lastJudgedDate: null });
  });

  it("is none up to night 2 when night 2 is a no-go and the series does not cover night 3", () => {
    const endsInNight3 = night3.start.getTime() + 2 * HOUR_MS;
    expect(nextNightNotNoGo(input(series(100, 10, endsInNight3)))).toEqual({
      kind: "none",
      lastJudgedDate: NIGHT_2,
    });
  });

  it("caps a found night's go at marginal on a fallback forecast", () => {
    expect(nextNightNotNoGo(input(series(10, 10), true))).toMatchObject({
      kind: "found",
      date: NIGHT_2,
      verdict: { level: "marginal", reason: { kind: "fallback-cap" } },
    });
  });

  it("counts nights without darkness as no-go", () => {
    const summer = { site: TROMSO, thresholdDeg: -18, date: "2026-06-21", forecast: null, fallback: false };
    expect(nextNightNotNoGo(summer)).toEqual({ kind: "none", lastJudgedDate: "2026-06-23" });
  });
});

describe("darkWindowReturn", () => {
  /** Reference: every night from `date+1`, one at a time. */
  function referenceReturn(site: Site, thresholdDeg: number, date: string): { date: string; window: Window } | null {
    for (let offset = 1; offset <= DARK_RETURN_MAX_NIGHTS; offset++) {
      const nightDate = addDays(date, offset);
      const window = darkWindow(site, observingNight(nightDate, site.timeZone), thresholdDeg);
      if (window.kind === "window") {
        return { date: nightDate, window };
      }
    }
    return null;
  }

  it("matches the night-by-night scan for Tromsø at -18° from midsummer", () => {
    const found = darkWindowReturn(TROMSO, -18, "2026-06-21");
    expect(found).not.toBeNull();
    expect(found).toEqual(referenceReturn(TROMSO, -18, "2026-06-21"));
  });

  it("matches the night-by-night scan for Warsaw at -18° from midsummer", () => {
    const found = darkWindowReturn(WARSAW, -18, "2026-06-21");
    expect(found).not.toBeNull();
    expect(found).toEqual(referenceReturn(WARSAW, -18, "2026-06-21"));
  });

  it("matches the night-by-night scan for Tromsø from every fifth day, mid-April to mid-September", () => {
    const mismatches: string[] = [];
    for (const thresholdDeg of [-18, -15, -12]) {
      for (let date = "2026-04-15"; date <= "2026-09-15"; date = addDays(date, 5)) {
        const found = darkWindowReturn(TROMSO, thresholdDeg, date);
        const reference = referenceReturn(TROMSO, thresholdDeg, date);
        if (found?.date !== reference?.date) {
          mismatches.push(`${thresholdDeg}° from ${date}: ${found?.date} vs ${reference?.date}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("returns the next night when it is already dark", () => {
    const found = darkWindowReturn(WARSAW, -18, "2026-10-10");
    expect(found?.date).toBe("2026-10-11");
    expect(found?.window).toEqual(windowOf(WARSAW, "2026-10-11", -18));
  });

  it("returns null when no night within the search range has a dark window", () => {
    const pole: Site = { latitudeDeg: 89.9, longitudeDeg: 0, timeZone: "UTC" };
    expect(darkWindowReturn(pole, -90, "2026-06-21")).toBeNull();
  });
});

describe("sevenNightOutlook", () => {
  // Warsaw, 21-27 Oct 2026. Clocks go back at 01:00 UTC on 25 Oct (03:00 CEST → 02:00 CET), inside
  // the night of 24 Oct.
  const DATE = "2026-10-21";
  const THRESHOLD = -18;
  const DST_SWITCH_MS = Date.UTC(2026, 9, 25, 1, 0, 0);
  const SERIES_START = Date.UTC(2026, 9, 20, 0, 0, 0);
  const SERIES_END = Date.UTC(2026, 9, 29, 0, 0, 0); // past the morning of night 7 (28 Oct)

  function clearSeries(endMs = SERIES_END): HourlyForecast {
    const hours: ForecastHour[] = [];
    for (let t = SERIES_START; t < endMs; t += HOUR_MS) {
      hours.push({ start: new Date(t), cloudCoverPct: 0, humidityPct: 60 });
    }
    return { hours };
  }

  const input = (forecast: HourlyForecast | null, fallback = false, site: Site = WARSAW, date = DATE) => ({
    site,
    thresholdDeg: THRESHOLD,
    date,
    forecast,
    fallback,
  });

  it(`returns ${OUTLOOK_NIGHTS} consecutive nights from date, with no gap or repeat across the DST switch`, () => {
    const nights = sevenNightOutlook(input(clearSeries()));
    expect(nights.map((n) => n.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(nights.map((n) => n.date)).toEqual([
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
    ]);
    nights.forEach((night) => {
      expect(night.darkWindow).toEqual(windowOf(WARSAW, night.date, THRESHOLD));
    });
  });

  it("gives the night of 24 Oct a dark window spanning the 03:00 CEST → 02:00 CET switch", () => {
    const night = sevenNightOutlook(input(clearSeries()))[3];
    expect(night.date).toBe("2026-10-24");
    expect(night.darkWindow.kind).toBe("window");
    if (night.darkWindow.kind === "window") {
      expect(night.darkWindow.start.getTime()).toBeLessThan(DST_SWITCH_MS);
      expect(night.darkWindow.end.getTime()).toBeGreaterThan(DST_SWITCH_MS);
    }
  });

  it(`judges nights 1-${VERDICT_NIGHTS} exactly as verdict() does, and gives later nights only an outlook even when clear`, () => {
    const forecast = clearSeries();
    const nights = sevenNightOutlook(input(forecast));
    for (const night of nights) {
      if (night.index <= VERDICT_NIGHTS) {
        expect(night.kind).toBe("verdict");
        if (night.kind === "verdict") {
          expect(night.verdict).toEqual(
            verdict(windowOf(WARSAW, night.date, THRESHOLD), forecast, { fallback: false }),
          );
          expect(night.verdict.level).toBe("go");
        }
      } else {
        // Invariant 5: no verdict past the horizon, however clear the forecast.
        expect(night.kind).toBe("outlook");
        expect(night).not.toHaveProperty("verdict");
        if (night.kind === "outlook") {
          expect(night.cloud).toEqual({ meanCloudPct: 0, minCloudPct: 0 });
        }
      }
    }
  });

  it("gives nights 4-7 no cloud outlook when the forecast ends after night 3", () => {
    const endsAfterNight3 = Date.UTC(2026, 9, 24, 12, 0, 0);
    const nights = sevenNightOutlook(input(clearSeries(endsAfterNight3)));
    expect(nights.slice(0, VERDICT_NIGHTS).map((n) => n.kind === "verdict" && n.verdict.level)).toEqual([
      "go",
      "go",
      "go",
    ]);
    for (const night of nights.slice(VERDICT_NIGHTS)) {
      expect(night).toMatchObject({ kind: "outlook", cloud: null });
    }
  });

  it("passes a fallback forecast through to nights 1-3, capping a go at marginal", () => {
    const nights = sevenNightOutlook(input(clearSeries(), true));
    for (const night of nights.slice(0, VERDICT_NIGHTS)) {
      expect(night).toMatchObject({
        kind: "verdict",
        verdict: { level: "marginal", reason: { kind: "fallback-cap" } },
      });
    }
  });

  it("is marginal with no weather data on nights 1-3 and has no outlook on 4-7 without a forecast", () => {
    for (const night of sevenNightOutlook(input(null))) {
      if (night.kind === "verdict") {
        expect(night.verdict).toEqual({ level: "marginal", reason: { kind: "no-weather-data" } });
      } else {
        expect(night.cloud).toBeNull();
      }
    }
  });

  it("gives each night the Moon's phase at the dark window's midpoint and its moon-free minutes", () => {
    for (const night of sevenNightOutlook(input(null))) {
      const window = windowOf(WARSAW, night.date, THRESHOLD);
      const midpoint = new Date((window.start.getTime() + window.end.getTime()) / 2);
      expect(night.moon.illuminatedFraction).toBe(moonState(WARSAW, midpoint).illuminatedFraction);
      expect(night.moon.moonFreeMinutes).toBe(moonFreeMinutes(WARSAW, window));
    }
  });

  it("has no moon-free minutes, a no-darkness verdict and no cloud outlook on nights without darkness", () => {
    const nights = sevenNightOutlook(input(null, false, TROMSO, "2026-06-21"));
    for (const night of nights) {
      expect(night.darkWindow.kind).toBe("none");
      expect(night.moon.moonFreeMinutes).toBeNull();
      const noon = observingNight(night.date, TROMSO.timeZone);
      const midpoint = new Date((noon.start.getTime() + noon.end.getTime()) / 2);
      expect(night.moon.illuminatedFraction).toBe(moonState(TROMSO, midpoint).illuminatedFraction);
      if (night.kind === "verdict") {
        expect(night.verdict).toEqual({ level: "no-go", reason: { kind: "no-darkness" } });
      } else {
        expect(night.cloud).toBeNull();
      }
    }
  });
});
