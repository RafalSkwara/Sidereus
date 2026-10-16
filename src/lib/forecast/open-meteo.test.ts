import { describe, expect, it, vi } from "vitest";

import {
  fetchForecast,
  ForecastError,
  FORECAST_REQUEST_FAILED,
  FORECAST_RESPONSE_INVALID,
  FORECAST_TIMEOUT_MS,
  forecastUrl,
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
});

describe("fetchForecast", () => {
  it("requests eight days of hourly cloud and humidity in unixtime with a past day and a timeout", async () => {
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
      forecast_days: "8",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(FORECAST_TIMEOUT_MS).toBe(3000);
  });

  it("throws a ForecastError with the http step and the status on a non-2xx status", async () => {
    const fake = fakeFetch(() => jsonResponse({ error: true, reason: "latitude 52.23 out of range" }, 503));
    const error = await fetchForecast(fake.fetchFn, SITE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForecastError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: FORECAST_REQUEST_FAILED, step: "http", status: 503 });
    await expect(fetchForecast(fake.fetchFn, SITE)).rejects.toThrow(FORECAST_REQUEST_FAILED);
  });

  it("throws a ForecastError with the request step and no status when fetch rejects or times out", async () => {
    const network = fakeFetch(() => Promise.reject(new TypeError("fetch failed for latitude=52.23")));
    const failed = await fetchForecast(network.fetchFn, SITE).catch((e: unknown) => e);
    expect(failed).toBeInstanceOf(ForecastError);
    expect(failed).toMatchObject({ message: FORECAST_REQUEST_FAILED, step: "request" });
    expect((failed as ForecastError).status).toBeUndefined();
    const timeout = fakeFetch(() => Promise.reject(new DOMException("timed out", "TimeoutError")));
    const timedOut = await fetchForecast(timeout.fetchFn, SITE).catch((e: unknown) => e);
    expect(timedOut).toMatchObject({ message: FORECAST_REQUEST_FAILED, step: "request" });
  });

  it("throws a ForecastError with the request step when the body read fails for another reason than bad JSON", async () => {
    const response = new Response("{}", { status: 200 });
    vi.spyOn(response, "json").mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const fake = fakeFetch(() => response);
    const error = await fetchForecast(fake.fetchFn, SITE).catch((e: unknown) => e);
    expect(error).toMatchObject({ message: FORECAST_REQUEST_FAILED, step: "request" });
  });

  it("throws a ForecastError with the parse step on malformed JSON", async () => {
    const fake = fakeFetch(() => new Response("{not json", { status: 200 }));
    const error = await fetchForecast(fake.fetchFn, SITE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForecastError);
    expect(error).toMatchObject({ message: FORECAST_RESPONSE_INVALID, step: "parse" });
    expect((error as ForecastError).status).toBeUndefined();
  });

  it("throws a ForecastError with the schema step on a schema mismatch", async () => {
    const fake = fakeFetch(() => jsonResponse({ hourly: { time: [1], cloud_cover: ["cloudy"] } }));
    const error = await fetchForecast(fake.fetchFn, SITE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForecastError);
    expect(error).toMatchObject({ message: FORECAST_RESPONSE_INVALID, step: "schema" });
    expect((error as ForecastError).status).toBeUndefined();
    expect(() => mapForecastResponse({})).toThrow(ForecastError);
  });

  it("never puts the URL, host or coordinates on an error: no property, no cause, no serialised form", async () => {
    const BASE = "https://forecast.example.test:8443";
    const url = forecastUrl(SITE, BASE);
    // A fetch whose failure quotes the whole request URL, as a real network error's cause can.
    const quoting = (): Promise<Response> =>
      Promise.reject(
        new TypeError(`fetch failed: ${url.href}`, { cause: new Error(`connect to ${url.host} ${url.search}`) }),
      );
    const cases: Record<string, () => Response | Promise<Response>> = {
      http: () => jsonResponse({ reason: url.href }, 503),
      request: quoting,
      parse: () => new Response(`{not json ${url.href}`, { status: 200 }),
      schema: () => jsonResponse({ hourly: { time: [1], cloud_cover: [url.href] } }),
    };
    const forbidden = [url.href, url.host, url.hostname, "forecast.example", "8443", "latitude", "52.23", "21.01"];
    for (const [step, respond] of Object.entries(cases)) {
      const error = await fetchForecast(fakeFetch(respond).fetchFn, SITE, BASE).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ForecastError);
      expect((error as ForecastError).step).toBe(step);
      expect((error as ForecastError).code).toBe(step);
      const seen: unknown[] = [];
      let node: unknown = error;
      while (node instanceof Error) {
        seen.push(node);
        node = node.cause;
      }
      expect(seen).toHaveLength(1); // no cause chain
      for (const item of seen as Error[]) {
        const text = [
          item.message,
          item.stack ?? "",
          JSON.stringify(item),
          ...Object.getOwnPropertyNames(item).map((key) => {
            const value: unknown = (item as unknown as Record<string, unknown>)[key];
            return key === "stack" ? "" : `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`;
          }),
        ].join("\n");
        for (const word of forbidden) {
          expect(text, `${step}: ${word}`).not.toContain(word);
        }
        for (const key of Object.getOwnPropertyNames(item)) {
          expect(["stack", "message", "name", "step", "code", "status"], `${step}: property ${key}`).toContain(key);
        }
      }
    }
  });
});
