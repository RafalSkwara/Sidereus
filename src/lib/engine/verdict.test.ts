import { describe, expect, it } from "vitest";

import type { DarkWindow, ForecastHour, HourlyForecast } from "./types";
import { verdict } from "./verdict";

const HOUR_MS = 3_600_000;
const BASE = Date.UTC(2026, 9, 10, 18, 0, 0); // 2026-10-10 18:00 UTC

function at(hourOffset: number): Date {
  return new Date(BASE + hourOffset * HOUR_MS);
}

type Window = Extract<DarkWindow, { kind: "window" }>;

function windowBetween(start: Date, end: Date): Window {
  return { kind: "window", thresholdDeg: -18, start, end, clampedToNightStart: false, clampedToNightEnd: false };
}

function window(startHour: number, endHour: number): Window {
  return windowBetween(at(startHour), at(endHour));
}

/** One forecast hour per entry starting at `from`; `null` leaves that hour out of the forecast. */
function forecast(cloud: (number | null)[], humidity = 60, from = 0): HourlyForecast {
  const hours: ForecastHour[] = [];
  cloud.forEach((cloudCoverPct, i) => {
    if (cloudCoverPct !== null) {
      hours.push({ start: at(from + i), cloudCoverPct, humidityPct: humidity });
    }
  });
  return { hours };
}

describe("verdict", () => {
  // A six-hour dark window, 18:00-24:00 UTC, over the hours 0..5.
  const sixHours = window(0, 6);

  it("is go on a 2 h run below the go cloud threshold", () => {
    expect(verdict(sixHours, forecast([100, 20, 20, 100, 100, 100]))).toEqual({
      level: "go",
      reason: { kind: "clear-run", runHours: 2, cloudPct: 20 },
    });
  });

  it("reports the longest run and its cloudiest hour", () => {
    expect(verdict(sixHours, forecast([10, 100, 5, 25, 15, 100]))).toEqual({
      level: "go",
      reason: { kind: "clear-run", runHours: 3, cloudPct: 25 },
    });
  });

  it("is marginal on a 1 h run at 50%", () => {
    expect(verdict(sixHours, forecast([100, 100, 50, 100, 100, 100]))).toEqual({
      level: "marginal",
      reason: { kind: "clear-run", runHours: 1, cloudPct: 50 },
    });
  });

  it("is marginal when the only clear hour is too short a run for go", () => {
    expect(verdict(sixHours, forecast([100, 20, 100, 100, 100, 100])).level).toBe("marginal");
  });

  it("is no-go when everything is overcast", () => {
    expect(verdict(sixHours, forecast([100, 90, 80, 95, 100, 70]))).toEqual({
      level: "no-go",
      reason: { kind: "cloudy", bestRunHours: 0, minCloudPct: 70 },
    });
  });

  it("treats the cloud thresholds as strict upper bounds", () => {
    expect(verdict(sixHours, forecast([30, 30, 65, 65, 65, 65])).level).toBe("marginal");
    expect(verdict(sixHours, forecast([65, 65, 65, 65, 65, 65])).level).toBe("no-go");
  });

  it("is go for a 40-minute dark window overlapping one clear hour", () => {
    const short = windowBetween(new Date(BASE + 10 * 60_000), new Date(BASE + 50 * 60_000));
    expect(verdict(short, forecast([10, 100]))).toEqual({
      level: "go",
      reason: { kind: "clear-run", runHours: 1, cloudPct: 10 },
    });
  });

  it("counts every hour the window touches, so a 40-minute window across an hour boundary needs both", () => {
    const straddling = windowBetween(new Date(BASE + 40 * 60_000), new Date(BASE + 80 * 60_000));
    expect(verdict(straddling, forecast([10, 10])).level).toBe("go");
    expect(verdict(straddling, forecast([10, 100])).level).toBe("marginal");
  });

  it("ignores forecast hours outside the dark window", () => {
    expect(verdict(window(2, 4), forecast([0, 0, 100, 100, 0, 0])).level).toBe("no-go");
  });

  it("caps a go at marginal when any dark hour is above the humidity cap", () => {
    const humid = forecast([20, 20, 20, 20, 20, 20]);
    humid.hours[4] = { ...humid.hours[4], humidityPct: 95 };
    expect(verdict(sixHours, humid)).toEqual({
      level: "marginal",
      reason: { kind: "humidity-cap", maxHumidityPct: 95 },
    });
  });

  it("does not cap at exactly the humidity cap", () => {
    expect(verdict(sixHours, forecast([20, 20, 100, 100, 100, 100], 90)).level).toBe("go");
  });

  it("breaks a run at an hour missing from the forecast", () => {
    expect(verdict(sixHours, forecast([100, 20, null, 20, 100, 100]))).toEqual({
      level: "marginal",
      reason: { kind: "clear-run", runHours: 1, cloudPct: 20 },
    });
  });

  it("still breaks a run at a missing hour when the series spans the window", () => {
    expect(verdict(sixHours, forecast([20, 20, null, 20, null, 20]))).toEqual({
      level: "go",
      reason: { kind: "clear-run", runHours: 2, cloudPct: 20 },
    });
    expect(verdict(sixHours, forecast([20, null, 20, null, 20, null, 100])).level).toBe("marginal");
  });

  it("has no weather data when the series ends partway through the window", () => {
    expect(verdict(sixHours, forecast([10, 10, 10, 10]))).toEqual({
      level: "marginal",
      reason: { kind: "no-weather-data" },
    });
  });

  it("has no weather data when the series starts after the window starts", () => {
    expect(verdict(sixHours, forecast([10, 10, 10, 10], 60, 2))).toEqual({
      level: "marginal",
      reason: { kind: "no-weather-data" },
    });
  });

  it("has no weather data when the series is empty", () => {
    expect(verdict(sixHours, { hours: [] })).toEqual({ level: "marginal", reason: { kind: "no-weather-data" } });
  });

  it("has no weather data when the series lies entirely after the window", () => {
    expect(verdict(sixHours, forecast([10, 10], 60, 24))).toEqual({
      level: "marginal",
      reason: { kind: "no-weather-data" },
    });
  });

  it("counts a window whose last hour is the series' last hour as covered", () => {
    const partial = windowBetween(at(0), new Date(BASE + 5.5 * HOUR_MS));
    expect(verdict(partial, forecast([100, 100, 100, 100, 20, 20])).level).toBe("go");
  });

  describe("with a fallback (saved, unrefreshed) forecast", () => {
    const fallback = { fallback: true };

    it("caps a go at marginal and carries the go run", () => {
      expect(verdict(sixHours, forecast([100, 20, 10, 25, 100, 100]), fallback)).toEqual({
        level: "marginal",
        reason: { kind: "fallback-cap", runHours: 3, cloudPct: 25 },
      });
    });

    it("lets the humidity cap win over the fallback cap", () => {
      expect(verdict(sixHours, forecast([20, 20, 20, 20, 20, 20], 95), fallback)).toEqual({
        level: "marginal",
        reason: { kind: "humidity-cap", maxHumidityPct: 95 },
      });
    });

    it("leaves a marginal and a no-go unchanged", () => {
      const marginal = forecast([100, 100, 50, 100, 100, 100]);
      expect(verdict(sixHours, marginal, fallback)).toEqual(verdict(sixHours, marginal));
      const overcast = forecast([100, 90, 80, 95, 100, 70]);
      expect(verdict(sixHours, overcast, fallback)).toEqual(verdict(sixHours, overcast));
      expect(verdict(sixHours, overcast, fallback).level).toBe("no-go");
    });

    it("defaults to not a fallback", () => {
      expect(verdict(sixHours, forecast([20, 20, 100, 100, 100, 100])).level).toBe("go");
      expect(verdict(sixHours, forecast([20, 20, 100, 100, 100, 100]), { fallback: false }).level).toBe("go");
    });
  });

  it("is marginal with no weather data when the forecast is null", () => {
    expect(verdict(sixHours, null)).toEqual({ level: "marginal", reason: { kind: "no-weather-data" } });
  });

  it("is no-go with no darkness when there is no dark window, whatever the weather", () => {
    const none: DarkWindow = { kind: "none", thresholdDeg: -18, minSunAltitudeDeg: -12.3, at: at(5) };
    expect(verdict(none, forecast([0, 0, 0, 0, 0, 0]))).toEqual({ level: "no-go", reason: { kind: "no-darkness" } });
    expect(verdict(none, null)).toEqual({ level: "no-go", reason: { kind: "no-darkness" } });
  });
});
