import { describe, expect, it } from "vitest";

import {
  fetchForecast,
  FORECAST_REQUEST_FAILED,
  FORECAST_RESPONSE_INVALID,
  FORECAST_TIMEOUT_MS,
  mapForecastResponse,
} from "./open-meteo";
import { fakeFetch, jsonResponse, openMeteoBody } from "./test-helpers";

const SITE = { latitudeDeg: 52.23, longitudeDeg: 21.01 };
const START_S = Date.UTC(2026, 9, 9, 0, 0, 0) / 1000; // 2026-10-09 00:00 UTC

describe("mapForecastResponse", () => {
  it("maps Open-Meteo unixtime arrays into hourly UTC rows", () => {
    expect(mapForecastResponse(openMeteoBody(START_S, [12, 100, 0], [81, 95, 40]))).toEqual({
      hours: [
        { start: new Date("2026-10-09T00:00:00Z"), cloudCoverPct: 12, humidityPct: 81 },
        { start: new Date("2026-10-09T01:00:00Z"), cloudCoverPct: 100, humidityPct: 95 },
        { start: new Date("2026-10-09T02:00:00Z"), cloudCoverPct: 0, humidityPct: 40 },
      ],
    });
  });

  it("leaves out hours with a null value", () => {
    const forecast = mapForecastResponse(openMeteoBody(START_S, [10, null, 30], [50, 50, null]));
    expect(forecast.hours.map((h) => h.start.toISOString())).toEqual(["2026-10-09T00:00:00.000Z"]);
  });

  it("rejects a schema mismatch with the fixed message", () => {
    expect(() => mapForecastResponse({ hourly: { time: ["2026-10-09T00:00"] } })).toThrow(FORECAST_RESPONSE_INVALID);
    expect(() => mapForecastResponse(null)).toThrow(FORECAST_RESPONSE_INVALID);
    const ragged = openMeteoBody(START_S, [10, 20]) as { hourly: { relative_humidity_2m: number[] } };
    ragged.hourly.relative_humidity_2m = [50];
    expect(() => mapForecastResponse(ragged)).toThrow(FORECAST_RESPONSE_INVALID);
  });
});

describe("fetchForecast", () => {
  it("requests four days of hourly cloud and humidity in unixtime with a past day and a timeout", async () => {
    const fake = fakeFetch(() => jsonResponse(openMeteoBody(START_S, [10])));
    await fetchForecast(fake.fetchFn, SITE);
    expect(fake.calls).toHaveLength(1);
    const { url, init } = fake.calls[0];
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: "52.23",
      longitude: "21.01",
      hourly: "cloud_cover,relative_humidity_2m",
      timezone: "GMT",
      timeformat: "unixtime",
      past_days: "1",
      forecast_days: "4",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(FORECAST_TIMEOUT_MS).toBe(3000);
  });

  it("uses an overridden base URL", async () => {
    const fake = fakeFetch(() => jsonResponse(openMeteoBody(START_S, [10])));
    await fetchForecast(fake.fetchFn, SITE, "http://127.0.0.1:9");
    expect(fake.calls[0].url.origin + fake.calls[0].url.pathname).toBe("http://127.0.0.1:9/v1/forecast");
  });

  it("returns the mapped forecast", async () => {
    const fake = fakeFetch(() => jsonResponse(openMeteoBody(START_S, [10, 20], [70, 80])));
    const forecast = await fetchForecast(fake.fetchFn, SITE);
    expect(forecast.hours).toEqual([
      { start: new Date("2026-10-09T00:00:00Z"), cloudCoverPct: 10, humidityPct: 70 },
      { start: new Date("2026-10-09T01:00:00Z"), cloudCoverPct: 20, humidityPct: 80 },
    ]);
  });

  it("throws the fixed request error on a non-2xx status", async () => {
    const fake = fakeFetch(() => jsonResponse({ error: true, reason: "latitude 52.23 out of range" }, 400));
    await expect(fetchForecast(fake.fetchFn, SITE)).rejects.toThrow(new Error(FORECAST_REQUEST_FAILED));
  });

  it("throws the fixed request error when fetch rejects or times out", async () => {
    const network = fakeFetch(() => Promise.reject(new TypeError("fetch failed for latitude=52.23")));
    await expect(fetchForecast(network.fetchFn, SITE)).rejects.toThrow(new Error(FORECAST_REQUEST_FAILED));
    const timeout = fakeFetch(() => Promise.reject(new DOMException("timed out", "TimeoutError")));
    await expect(fetchForecast(timeout.fetchFn, SITE)).rejects.toThrow(new Error(FORECAST_REQUEST_FAILED));
  });

  it("throws the fixed invalid-response error on malformed JSON", async () => {
    const fake = fakeFetch(() => new Response("{not json", { status: 200 }));
    await expect(fetchForecast(fake.fetchFn, SITE)).rejects.toThrow(new Error(FORECAST_RESPONSE_INVALID));
  });

  it("throws the fixed invalid-response error on a schema mismatch", async () => {
    const fake = fakeFetch(() => jsonResponse({ hourly: { time: [1], cloud_cover: ["cloudy"] } }));
    await expect(fetchForecast(fake.fetchFn, SITE)).rejects.toThrow(new Error(FORECAST_RESPONSE_INVALID));
  });

  it("never puts coordinates into its error messages", async () => {
    const fake = fakeFetch(() => jsonResponse({}, 500));
    const error = await fetchForecast(fake.fetchFn, SITE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toMatch(/52|21/);
    expect((error as Error).cause).toBeUndefined();
  });
});
