import { describe, expect, it, vi } from "vitest";

import type { ForecastCache } from "./cache";
import { FORECAST_CACHE_TTL_SECONDS, getForecast } from "./service";
import { fakeFetch, jsonResponse, memoryCache, openMeteoBody } from "./test-helpers";

const SITE_ID = "8d4f7a52-1111-4222-8333-944455556666";
const KEY = `forecast:v1:site:${SITE_ID}`;
const COORDS = { latitudeDeg: 52.23, longitudeDeg: 21.01 };
const NOW = new Date("2026-10-10T18:00:00Z");
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
/** The real request range for a fetch on 2026-10-10: from 00:00 UTC the day before, 216 hours (`past_days=1`, `forecast_days=8`). */
const START_S = Date.UTC(2026, 9, 9, 0, 0, 0) / 1000;
const LIVE_HOURS = 216;
const LIVE_CLOUD = Array.from({ length: LIVE_HOURS }, (_, i) => (i % 2 === 0 ? 5 : 15));

/** A stored entry as the service writes it, fetched `ageMinutes` before `NOW`. */
function storedEntry(ageMinutes: number, cloud: number, coords = COORDS): string {
  return JSON.stringify({
    fetchedAt: new Date(NOW.getTime() - ageMinutes * MINUTE_MS).toISOString(),
    lat: coords.latitudeDeg,
    lon: coords.longitudeDeg,
    hours: [{ start: "2026-10-10T18:00:00.000Z", cloudCoverPct: cloud, humidityPct: 70 }],
  });
}

/** A complete 200: every hour of the real request range, cloud alternating 5 % and 15 %. */
const liveResponse = () => jsonResponse(openMeteoBody(START_S, LIVE_CLOUD));
const failingResponse = () => jsonResponse({ error: true }, 503);

describe("getForecast", () => {
  it("serves a fresh cached entry without fetching", async () => {
    const fake = fakeFetch(liveResponse);
    const cache = memoryCache({ [KEY]: storedEntry(59, 42) });
    const result = await getForecast({ fetchFn: fake.fetchFn, cache, siteId: SITE_ID, coords: COORDS, now: NOW });
    expect(fake.calls).toHaveLength(0);
    expect(result).toEqual({
      fetchedAt: new Date(NOW.getTime() - 59 * MINUTE_MS),
      fallback: false,
      forecast: { hours: [{ start: new Date("2026-10-10T18:00:00Z"), cloudCoverPct: 42, humidityPct: 70 }] },
    });
  });

  it("refetches a stale entry and stores the result for seven days", async () => {
    const fake = fakeFetch(liveResponse);
    const cache = memoryCache({ [KEY]: storedEntry(60, 42) });
    const result = await getForecast({ fetchFn: fake.fetchFn, cache, siteId: SITE_ID, coords: COORDS, now: NOW });
    expect(fake.calls).toHaveLength(1);
    expect(result?.fetchedAt).toEqual(NOW);
    expect(result?.fallback).toBe(false);
    expect(result?.forecast.hours.map((h) => h.cloudCoverPct)).toEqual(LIVE_CLOUD);

    expect(cache.puts).toHaveLength(1);
    expect(cache.puts[0].key).toBe(KEY);
    expect(cache.puts[0].expirationTtl).toBe(FORECAST_CACHE_TTL_SECONDS);
    expect(FORECAST_CACHE_TTL_SECONDS).toBe(7 * 24 * 3600);
    expect(JSON.parse(cache.puts[0].value)).toEqual({
      fetchedAt: NOW.toISOString(),
      lat: 52.23,
      lon: 21.01,
      hours: LIVE_CLOUD.map((cloud, i) => ({
        start: new Date(START_S * 1000 + i * HOUR_MS).toISOString(),
        cloudCoverPct: cloud,
        humidityPct: 60,
      })),
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
    expect(result?.forecast.hours.map((h) => h.cloudCoverPct)).toEqual(LIVE_CLOUD);
  });

  it("falls back to a stale copy of any age when the fetch fails, flagged as a fallback", async () => {
    const fake = fakeFetch(failingResponse);
    const cache = memoryCache({ [KEY]: storedEntry(3 * 24 * 60, 42) });
    const result = await getForecast({ fetchFn: fake.fetchFn, cache, siteId: SITE_ID, coords: COORDS, now: NOW });
    expect(fake.calls).toHaveLength(1);
    expect(result?.forecast.hours[0].cloudCoverPct).toBe(42);
    expect(result?.fetchedAt).toEqual(new Date(NOW.getTime() - 3 * 24 * 60 * MINUTE_MS));
    expect(result?.fallback).toBe(true);
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
    expect(result?.forecast.hours).toHaveLength(LIVE_HOURS);

    const failing = fakeFetch(failingResponse);
    await expect(
      getForecast({ fetchFn: failing.fetchFn, cache: throwing, siteId: SITE_ID, coords: COORDS, now: NOW }),
    ).resolves.toBeNull();
  });

  it("returns a fresh forecast without waiting for the cache write when given a defer hook", async () => {
    const fake = fakeFetch(liveResponse);
    let finishWrite = () => {
      // replaced once the write starts
    };
    const puts: string[] = [];
    const slowCache: ForecastCache = {
      get: () => Promise.resolve(null),
      put: (key) =>
        new Promise<void>((resolve) => {
          finishWrite = () => {
            puts.push(key);
            resolve();
          };
        }),
    };
    const deferred: Promise<void>[] = [];

    const result = await getForecast({
      fetchFn: fake.fetchFn,
      cache: slowCache,
      siteId: SITE_ID,
      coords: COORDS,
      now: NOW,
      defer: (task) => deferred.push(task),
    });

    expect(result?.forecast.hours.map((h) => h.cloudCoverPct)).toEqual(LIVE_CLOUD);
    expect(deferred).toHaveLength(1);
    expect(puts).toHaveLength(0);
    finishWrite();
    await deferred[0];
    expect(puts).toEqual([KEY]);
  });
});

/** A stored entry as the service writes it: `cloud.length` hours from `fromS`, fetched at `fetchedAt`. */
function storedSeries(fetchedAt: Date, fromS: number, cloud: readonly number[]): string {
  return JSON.stringify({
    fetchedAt: fetchedAt.toISOString(),
    lat: COORDS.latitudeDeg,
    lon: COORDS.longitudeDeg,
    hours: cloud.map((cloudCoverPct, i) => ({
      start: new Date(fromS * 1000 + i * HOUR_MS).toISOString(),
      cloudCoverPct,
      humidityPct: 70,
    })),
  });
}

/**
 * A usable copy: matching coordinates, fetched 2 h before `NOW` (stale, so the service refetches) over that fetch's
 * real request range, 2026-10-09 00:00 to 2026-10-17 23:00 UTC, far past `NOW` − 24 h … `NOW` + 24 h. Cloud 42 %
 * everywhere, so it cannot be mistaken for a fresh body.
 */
const COPY_FETCHED_AT = new Date(NOW.getTime() - 2 * HOUR_MS);
const COPY_CLOUD = Array<number>(LIVE_HOURS).fill(42);
const usableCopy = () => storedSeries(COPY_FETCHED_AT, START_S, COPY_CLOUD);

/** 2026-10-09 00:00 to 2026-10-11 00:00 UTC: the last hour is `NOW` + 6 h, nowhere near tonight's morning or night 3. */
const SHORT_CLOUD = Array<number>(49).fill(5);

async function refreshWith(respond: () => Response | Promise<Response>, initial: Record<string, string>, now = NOW) {
  const fake = fakeFetch(respond);
  const cache = memoryCache(initial);
  const result = await getForecast({ fetchFn: fake.fetchFn, cache, siteId: SITE_ID, coords: COORDS, now });
  return { fake, cache, result };
}

describe("getForecast with a 200 that is not a complete series", () => {
  it.each([
    ["an empty series", () => openMeteoBody(START_S, [])],
    ["an all-null series", () => openMeteoBody(START_S, Array<null>(LIVE_HOURS).fill(null))],
    ["a series ending 6 h after now", () => openMeteoBody(START_S, SHORT_CLOUD)],
  ])("keeps a usable stored copy over %s, served as a fallback and left in KV", async (_label, body) => {
    const copy = usableCopy();
    const { fake, cache, result } = await refreshWith(() => jsonResponse(body()), { [KEY]: copy });
    expect(fake.calls).toHaveLength(1);
    expect(result?.fallback).toBe(true);
    expect(result?.fetchedAt).toEqual(COPY_FETCHED_AT);
    expect(result?.forecast.hours.map((h) => h.cloudCoverPct)).toEqual(COPY_CLOUD);
    expect(cache.puts).toHaveLength(0);
    expect(cache.store.get(KEY)).toBe(copy);
  });

  it("keeps a usable stored copy over a 200 that ends about 60 h after now, short of the 96 h verdict nights need", async () => {
    // From 2026-10-09 00:00 UTC (a complete start) to 2026-10-13 06:00 UTC, which is `NOW` + 60 h: past the copy's
    // own +24 h bar and well past tonight, but before night 3 of the next-night build ends.
    const hoursToNowPlus60 = (NOW.getTime() + 60 * HOUR_MS - START_S * 1000) / HOUR_MS + 1;
    const copy = usableCopy();
    const { cache, result } = await refreshWith(
      () => jsonResponse(openMeteoBody(START_S, Array<number>(hoursToNowPlus60).fill(5))),
      { [KEY]: copy },
    );
    expect(result?.fallback).toBe(true);
    expect(result?.fetchedAt).toEqual(COPY_FETCHED_AT);
    expect(result?.forecast.hours.map((h) => h.cloudCoverPct)).toEqual(COPY_CLOUD);
    expect(cache.puts).toHaveLength(0);
    expect(cache.store.get(KEY)).toBe(copy);
  });

  it("schedules no deferred write when it keeps the stored copy", async () => {
    const defer = vi.fn<(task: Promise<void>) => void>();
    const cache = memoryCache({ [KEY]: usableCopy() });
    const result = await getForecast({
      fetchFn: fakeFetch(() => jsonResponse(openMeteoBody(START_S, SHORT_CLOUD))).fetchFn,
      cache,
      siteId: SITE_ID,
      coords: COORDS,
      now: NOW,
      defer,
    });
    expect(result?.fallback).toBe(true);
    expect(defer).not.toHaveBeenCalled();
    expect(cache.puts).toHaveLength(0);
  });

  it("returns and stores an incomplete 200 when the stored copy is for other coordinates", async () => {
    const { cache, result } = await refreshWith(() => jsonResponse(openMeteoBody(START_S, SHORT_CLOUD)), {
      [KEY]: storedEntry(120, 42, { latitudeDeg: 50.06, longitudeDeg: 19.94 }),
    });
    expect(result?.fallback).toBe(false);
    expect(result?.fetchedAt).toEqual(NOW);
    expect(result?.forecast.hours.map((h) => h.cloudCoverPct)).toEqual(SHORT_CLOUD);
    expect(cache.puts).toHaveLength(1);
    const written = JSON.parse(cache.puts[0].value) as { lat: number; lon: number; hours: unknown[] };
    expect([written.lat, written.lon]).toEqual([52.23, 21.01]);
    expect(written.hours).toHaveLength(SHORT_CLOUD.length);
  });

  it("keeps a usable stored copy when the 200 starts after the night in progress began", async () => {
    // 00:30 UTC on 11 Oct is 02:30 in Warsaw, inside the night of 10 Oct; the 200 starts at 00:00 UTC that day, so the
    // evening already under way is missing from it.
    const now = new Date("2026-10-11T00:30:00Z");
    const fetchedAt = new Date(now.getTime() - 2 * HOUR_MS);
    const copy = storedSeries(fetchedAt, START_S, COPY_CLOUD);
    const lateStartS = Date.UTC(2026, 9, 11, 0, 0, 0) / 1000;
    const { cache, result } = await refreshWith(
      () => jsonResponse(openMeteoBody(lateStartS, Array<number>(LIVE_HOURS).fill(5))),
      { [KEY]: copy },
      now,
    );
    expect(result?.fallback).toBe(true);
    expect(result?.fetchedAt).toEqual(fetchedAt);
    expect(result?.forecast.hours.map((h) => h.cloudCoverPct)).toEqual(COPY_CLOUD);
    expect(cache.puts).toHaveLength(0);
  });

  it("lets a new degenerate 200 replace a degenerate stored copy instead of keeping the useless copy", async () => {
    // The copy is what an earlier empty 200 left behind: no hours at all.
    const { cache, result } = await refreshWith(() => jsonResponse(openMeteoBody(START_S, SHORT_CLOUD)), {
      [KEY]: storedSeries(COPY_FETCHED_AT, START_S, []),
    });
    expect(result?.fallback).toBe(false);
    expect(result?.fetchedAt).toEqual(NOW);
    expect(result?.forecast.hours).toHaveLength(SHORT_CLOUD.length);
    expect(cache.puts).toHaveLength(1);
    expect((JSON.parse(cache.puts[0].value) as { hours: unknown[] }).hours).toHaveLength(SHORT_CLOUD.length);
  });

  it("returns and stores a degenerate 200 when nothing is stored", async () => {
    const { cache, result } = await refreshWith(() => jsonResponse(openMeteoBody(START_S, [])), {});
    expect(result).toEqual({ forecast: { hours: [] }, fetchedAt: NOW, fallback: false });
    expect(cache.puts).toHaveLength(1);
    expect(JSON.parse(cache.puts[0].value)).toEqual({
      fetchedAt: NOW.toISOString(),
      lat: 52.23,
      lon: 21.01,
      hours: [],
    });
  });

  it("replaces a usable stored copy with a complete 200", async () => {
    const { cache, result } = await refreshWith(liveResponse, { [KEY]: usableCopy() });
    expect(result?.fallback).toBe(false);
    expect(result?.fetchedAt).toEqual(NOW);
    expect(result?.forecast.hours.map((h) => h.cloudCoverPct)).toEqual(LIVE_CLOUD);
    expect(cache.puts).toHaveLength(1);
    expect((JSON.parse(cache.puts[0].value) as { fetchedAt: string }).fetchedAt).toBe(NOW.toISOString());
  });
});

describe("getForecast when the refresh fails in other ways than a 503", () => {
  it.each([
    ["a network rejection", () => Promise.reject(new TypeError("fetch failed"))],
    ["a timeout rejection", () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError"))],
    ["an invalid-JSON 200", () => new Response("<html>", { status: 200 })],
  ])("serves the stored copy as a fallback after %s", async (_label, respond: () => Response | Promise<Response>) => {
    const copy = usableCopy();
    const { cache, result } = await refreshWith(respond, { [KEY]: copy });
    expect(result?.fallback).toBe(true);
    expect(result?.fetchedAt).toEqual(COPY_FETCHED_AT);
    expect(result?.forecast.hours.map((h) => h.cloudCoverPct)).toEqual(COPY_CLOUD);
    expect(cache.puts).toHaveLength(0);
    expect(cache.store.get(KEY)).toBe(copy);
  });
});
