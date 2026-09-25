import type { ForecastCache } from "./cache";

/**
 * Test doubles for the forecast layer: an Open-Meteo-shaped response body, a fake fetch that
 * records its calls, and an in-memory cache. Test-only; nothing in the app imports this file.
 */

const HOUR_S = 3600;

/** An Open-Meteo `timeformat=unixtime` body with one hour per entry, starting at `startUnixS`. */
export function openMeteoBody(
  startUnixS: number,
  cloud: (number | null)[],
  humidity: (number | null)[] = cloud.map(() => 60),
): unknown {
  return {
    latitude: 52.24,
    longitude: 21.02,
    utc_offset_seconds: 0,
    timezone: "GMT",
    hourly_units: { time: "unixtime", cloud_cover: "%", relative_humidity_2m: "%" },
    hourly: {
      time: cloud.map((_, i) => startUnixS + i * HOUR_S),
      cloud_cover: cloud,
      relative_humidity_2m: humidity,
    },
  };
}

export interface FakeFetch {
  fetchFn: typeof fetch;
  calls: { url: URL; init: RequestInit | undefined }[];
}

/** A fetch that answers every call with `respond()` and records the URL and init it was given. */
export function fakeFetch(respond: () => Response | Promise<Response>): FakeFetch {
  const calls: FakeFetch["calls"] = [];
  const fetchFn = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: new URL(input instanceof Request ? input.url : input), init });
    return Promise.resolve().then(respond);
  }) as typeof fetch;
  return { fetchFn, calls };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export interface MemoryCache extends ForecastCache {
  store: Map<string, string>;
  puts: { key: string; value: string; expirationTtl: number }[];
}

export function memoryCache(initial: Record<string, string> = {}): MemoryCache {
  const store = new Map(Object.entries(initial));
  const puts: MemoryCache["puts"] = [];
  return {
    store,
    puts,
    get: (key) => Promise.resolve(store.get(key) ?? null),
    put: (key, value, { expirationTtl }) => {
      puts.push({ key, value, expirationTtl });
      store.set(key, value);
      return Promise.resolve();
    },
  };
}
