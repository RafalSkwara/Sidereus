import { describe, expect, it } from "vitest";

import { fetchForecast, ForecastError, FORECAST_REQUEST_FAILED, forecastUrl } from "./open-meteo";
import { fakeFetch, jsonResponse } from "./test-helpers";

const SITE = { latitudeDeg: 52.23, longitudeDeg: 21.01 };

describe("fetchForecast", () => {
  it("throws a ForecastError with the http step and the status on a non-2xx status", async () => {
    const fake = fakeFetch(() => jsonResponse({ error: true, reason: "latitude 52.23 out of range" }, 503));
    const error = await fetchForecast(fake.fetchFn, SITE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForecastError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: FORECAST_REQUEST_FAILED, step: "http", status: 503 });
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
