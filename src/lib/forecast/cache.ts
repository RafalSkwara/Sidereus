/**
 * The key-value store the forecast service caches into. Workers KV satisfies it
 * (`kv-cache.ts`); tests pass an in-memory map. Kept free of `cloudflare:workers` so the service
 * and its tests run in plain Node.
 */
export interface ForecastCache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
}

/** A cache that stores nothing: every read misses. Used when the KV binding is absent. */
export const noopForecastCache: ForecastCache = {
  get: () => Promise.resolve(null),
  put: () => Promise.resolve(),
};
