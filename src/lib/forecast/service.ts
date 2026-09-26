import { z } from "zod";

import type { HourlyForecast } from "@/lib/engine";

import type { ForecastCache } from "./cache";
import { fetchForecast, OPEN_METEO_BASE_URL, type ForecastCoords } from "./open-meteo";

/**
 * Forecast service: one cached Open-Meteo forecast per site.
 *
 * - A cached entry younger than `FORECAST_FRESH_MS` whose coordinates match the site is served
 *   as is, so an edited site refetches.
 * - Otherwise it refetches and stores the result for `FORECAST_CACHE_TTL_SECONDS`, which keeps a
 *   stale copy around for outages.
 * - When the fetch fails it serves any stored copy with matching coordinates, whatever its age,
 *   flagged as `fallback`, and returns `null` only when nothing usable exists.
 * - Cache read and write errors behave like a miss and never throw.
 *
 * Privacy: keys use the site id, never coordinates; nothing here logs.
 */

/** A cached forecast younger than this is served without a fetch (about 1 h per site). */
export const FORECAST_FRESH_MS = 60 * 60 * 1000;

/** How long KV keeps an entry, so a stale copy survives an Open-Meteo outage. */
export const FORECAST_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

export function forecastCacheKey(siteId: string): string {
  return `forecast:v1:site:${siteId}`;
}

const storedSchema = z.object({
  fetchedAt: z.iso.datetime(),
  lat: z.number(),
  lon: z.number(),
  hours: z.array(
    z.object({
      start: z.iso.datetime(),
      cloudCoverPct: z.number(),
      humidityPct: z.number(),
    }),
  ),
});

type StoredForecast = z.infer<typeof storedSchema>;

export interface ForecastResult {
  forecast: HourlyForecast;
  fetchedAt: Date;
  /** True only when the fetch failed and a stored copy was served in its place. */
  fallback: boolean;
}

export interface GetForecastInput {
  fetchFn: typeof fetch;
  cache: ForecastCache;
  siteId: string;
  coords: ForecastCoords;
  now: Date;
  /** Open-Meteo base URL; the page passes the optional `FORECAST_BASE_URL` override. */
  baseUrl?: string;
  /**
   * Runs the cache write after the response instead of awaiting it; the page passes the Worker's
   * `waitUntil`. Without it the write is awaited.
   */
  defer?: (task: Promise<void>) => void;
}

function toStored(result: ForecastResult, coords: ForecastCoords): StoredForecast {
  return {
    fetchedAt: result.fetchedAt.toISOString(),
    lat: coords.latitudeDeg,
    lon: coords.longitudeDeg,
    hours: result.forecast.hours.map((hour) => ({
      start: hour.start.toISOString(),
      cloudCoverPct: hour.cloudCoverPct,
      humidityPct: hour.humidityPct,
    })),
  };
}

function fromStored(stored: StoredForecast, fallback: boolean): ForecastResult {
  return {
    fetchedAt: new Date(stored.fetchedAt),
    fallback,
    forecast: {
      hours: stored.hours.map((hour) => ({
        start: new Date(hour.start),
        cloudCoverPct: hour.cloudCoverPct,
        humidityPct: hour.humidityPct,
      })),
    },
  };
}

/** The stored entry for `key`, or `null` on a miss, a read error or an unreadable value. */
async function readCache(cache: ForecastCache, key: string): Promise<StoredForecast | null> {
  try {
    const raw = await cache.get(key);
    if (raw === null) {
      return null;
    }
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch (_error) {
    return null;
  }
}

async function writeCache(cache: ForecastCache, key: string, value: StoredForecast): Promise<void> {
  try {
    await cache.put(key, JSON.stringify(value), { expirationTtl: FORECAST_CACHE_TTL_SECONDS });
  } catch (_error) {
    // A failed write only costs a refetch next time.
  }
}

export async function getForecast({
  fetchFn,
  cache,
  siteId,
  coords,
  now,
  baseUrl = OPEN_METEO_BASE_URL,
  defer,
}: GetForecastInput): Promise<ForecastResult | null> {
  const key = forecastCacheKey(siteId);
  const stored = await readCache(cache, key);
  const usable = stored !== null && stored.lat === coords.latitudeDeg && stored.lon === coords.longitudeDeg;

  if (usable) {
    const ageMs = now.getTime() - Date.parse(stored.fetchedAt);
    if (ageMs >= 0 && ageMs < FORECAST_FRESH_MS) {
      return fromStored(stored, false);
    }
  }

  try {
    const result: ForecastResult = {
      forecast: await fetchForecast(fetchFn, coords, baseUrl),
      fetchedAt: now,
      fallback: false,
    };
    // writeCache never rejects, so a deferred write cannot surface as an unhandled rejection.
    const write = writeCache(cache, key, toStored(result, coords));
    if (defer) {
      defer(write);
    } else {
      await write;
    }
    return result;
  } catch (_error) {
    return usable ? fromStored(stored, true) : null;
  }
}
