/**
 * The key-value store the forecast service caches into. Workers KV satisfies it
 * (`kv-cache.ts`); tests pass an in-memory map. Kept free of `cloudflare:workers` so the service
 * and its tests run in plain Node.
 */
export interface ForecastCache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
}

/** A KV read slower than this counts as a miss, so the page falls through to Open-Meteo instead of waiting. */
export const KV_READ_TIMEOUT_MS = 1000;

/** Wraps a cache so `get` rejects after `ms` (the service treats a failed read as a miss); `put` passes through. */
export function withReadTimeout(cache: ForecastCache, ms: number): ForecastCache {
  return {
    get: (key) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("Forecast cache read timed out."));
        }, ms);
        cache
          .get(key)
          .then(resolve, reject)
          .finally(() => {
            clearTimeout(timer);
          });
      }),
    put: (key, value, options) => cache.put(key, value, options),
  };
}

/** A cache that stores nothing: every read misses. Used when the KV binding is absent. */
export const noopForecastCache: ForecastCache = {
  get: () => Promise.resolve(null),
  put: () => Promise.resolve(),
};
