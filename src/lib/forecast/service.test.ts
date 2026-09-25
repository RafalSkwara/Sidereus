import { describe, expect, it } from "vitest";

import type { ForecastCache } from "./cache";
import { FORECAST_CACHE_TTL_SECONDS, forecastCacheKey, getForecast } from "./service";
import { fakeFetch, jsonResponse, memoryCache, openMeteoBody } from "./test-helpers";

const SITE_ID = "8d4f7a52-1111-4222-8333-944455556666";
const KEY = `forecast:v1:site:${SITE_ID}`;
const COORDS = { latitudeDeg: 52.23, longitudeDeg: 21.01 };
const NOW = new Date("2026-10-10T18:00:00Z");
const MINUTE_MS = 60_000;
const START_S = Date.UTC(2026, 9, 9, 0, 0, 0) / 1000;

/** A stored entry as the service writes it, fetched `ageMinutes` before `NOW`. */
function storedEntry(ageMinutes: number, cloud: number, coords = COORDS): string {
  return JSON.stringify({
    fetchedAt: new Date(NOW.getTime() - ageMinutes * MINUTE_MS).toISOString(),
    lat: coords.latitudeDeg,
    lon: coords.longitudeDeg,
    hours: [{ start: "2026-10-10T18:00:00.000Z", cloudCoverPct: cloud, humidityPct: 70 }],
  });
}

const liveResponse = () => jsonResponse(openMeteoBody(START_S, [5, 15]));
const failingResponse = () => jsonResponse({ error: true }, 503);

describe("forecastCacheKey", () => {
  it("keys by site id only", () => {
    expect(forecastCacheKey(SITE_ID)).toBe(KEY);
  });
});

describe("getForecast", () => {
  it("serves a fresh cached entry without fetching", async () => {
    const fake = fakeFetch(liveResponse);
    const cache = memoryCache({ [KEY]: storedEntry(59, 42) });
    const result = await getForecast({ fetchFn: fake.fetchFn, cache, siteId: SITE_ID, coords: COORDS, now: NOW });
    expect(fake.calls).toHaveLength(0);
    expect(result).toEqual({
      fetchedAt: new Date(NOW.getTime() - 59 * MINUTE_MS),
      forecast: { hours: [{ start: new Date("2026-10-10T18:00:00Z"), cloudCoverPct: 42, humidityPct: 70 }] },
    });
  });

  it("refetches a stale entry and stores the result for seven days", async () => {
    const fake = fakeFetch(liveResponse);
    const cache = memoryCache({ [KEY]: storedEntry(60, 42) });
    const result = await getForecast({ fetchFn: fake.fetchFn, cache, siteId: SITE_ID, coords: COORDS, now: NOW });
    expect(fake.calls).toHaveLength(1);
    expect(result?.fetchedAt).toEqual(NOW);
    expect(result?.forecast.hours.map((h) => h.cloudCoverPct)).toEqual([5, 15]);

    expect(cache.puts).toHaveLength(1);
    expect(cache.puts[0].key).toBe(KEY);
    expect(cache.puts[0].expirationTtl).toBe(FORECAST_CACHE_TTL_SECONDS);
    expect(FORECAST_CACHE_TTL_SECONDS).toBe(7 * 24 * 3600);
    expect(JSON.parse(cache.puts[0].value)).toEqual({
      fetchedAt: NOW.toISOString(),
      lat: 52.23,
      lon: 21.01,
      hours: [
        { start: "2026-10-09T00:00:00.000Z", cloudCoverPct: 5, humidityPct: 60 },
        { start: "2026-10-09T01:00:00.000Z", cloudCoverPct: 15, humidityPct: 60 },
      ],
    });
  });

  it("fetches on a miss, and the stored copy then serves the next request", async () => {
    const fake = fakeFetch(liveResponse);
    const cache = memoryCache();
    const input = { fetchFn: fake.fetchFn, cache, siteId: SITE_ID, coords: COORDS };
    const first = await getForecast({ ...input, now: NOW });
    const second = await getForecast({ ...input, now: new Date(NOW.getTime() + 30 * MINUTE_MS) });
    expect(fake.calls).toHaveLength(1);
    expect(second).toEqual(first);
  });

  it("refetches a fresh entry when the site's coordinates changed", async () => {
    const fake = fakeFetch(liveResponse);
    const cache = memoryCache({ [KEY]: storedEntry(5, 42, { latitudeDeg: 50.06, longitudeDeg: 19.94 }) });
    const result = await getForecast({ fetchFn: fake.fetchFn, cache, siteId: SITE_ID, coords: COORDS, now: NOW });
    expect(fake.calls).toHaveLength(1);
    expect(result?.forecast.hours.map((h) => h.cloudCoverPct)).toEqual([5, 15]);
  });

  it("passes a base URL override to the client", async () => {
    const fake = fakeFetch(liveResponse);
    await getForecast({
      fetchFn: fake.fetchFn,
      cache: memoryCache(),
      siteId: SITE_ID,
      coords: COORDS,
      now: NOW,
      baseUrl: "http://127.0.0.1:9",
    });
    expect(fake.calls[0].url.origin).toBe("http://127.0.0.1:9");
  });

  it("falls back to a stale copy of any age when the fetch fails", async () => {
    const fake = fakeFetch(failingResponse);
    const cache = memoryCache({ [KEY]: storedEntry(3 * 24 * 60, 42) });
    const result = await getForecast({ fetchFn: fake.fetchFn, cache, siteId: SITE_ID, coords: COORDS, now: NOW });
    expect(fake.calls).toHaveLength(1);
    expect(result?.forecast.hours[0].cloudCoverPct).toBe(42);
    expect(result?.fetchedAt).toEqual(new Date(NOW.getTime() - 3 * 24 * 60 * MINUTE_MS));
    expect(cache.puts).toHaveLength(0);
  });

  it("returns null when the fetch fails and nothing is stored", async () => {
    const fake = fakeFetch(failingResponse);
    const result = await getForecast({
      fetchFn: fake.fetchFn,
      cache: memoryCache(),
      siteId: SITE_ID,
      coords: COORDS,
      now: NOW,
    });
    expect(result).toBeNull();
  });

  it("returns null when the fetch fails and the stored copy is for other coordinates", async () => {
    const fake = fakeFetch(failingResponse);
    const cache = memoryCache({ [KEY]: storedEntry(5, 42, { latitudeDeg: 50.06, longitudeDeg: 19.94 }) });
    const result = await getForecast({ fetchFn: fake.fetchFn, cache, siteId: SITE_ID, coords: COORDS, now: NOW });
    expect(result).toBeNull();
  });

  it("returns null when the response is malformed and nothing is stored", async () => {
    const fake = fakeFetch(() => new Response("<html>", { status: 200 }));
    const result = await getForecast({
      fetchFn: fake.fetchFn,
      cache: memoryCache(),
      siteId: SITE_ID,
      coords: COORDS,
      now: NOW,
    });
    expect(result).toBeNull();
  });

  it("treats an unreadable stored value as a miss", async () => {
    const fake = fakeFetch(liveResponse);
    const cache = memoryCache({ [KEY]: "{not json" });
    const result = await getForecast({ fetchFn: fake.fetchFn, cache, siteId: SITE_ID, coords: COORDS, now: NOW });
    expect(fake.calls).toHaveLength(1);
    expect(result?.fetchedAt).toEqual(NOW);
  });

  it("treats a throwing cache as a miss and never throws", async () => {
    const throwing: ForecastCache = {
      get: () => Promise.reject(new Error("KV read failed")),
      put: () => Promise.reject(new Error("KV write failed")),
    };
    const ok = fakeFetch(liveResponse);
    const result = await getForecast({
      fetchFn: ok.fetchFn,
      cache: throwing,
      siteId: SITE_ID,
      coords: COORDS,
      now: NOW,
    });
    expect(ok.calls).toHaveLength(1);
    expect(result?.forecast.hours).toHaveLength(2);

    const failing = fakeFetch(failingResponse);
    await expect(
      getForecast({ fetchFn: failing.fetchFn, cache: throwing, siteId: SITE_ID, coords: COORDS, now: NOW }),
    ).resolves.toBeNull();
  });
});
