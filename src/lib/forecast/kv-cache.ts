import { env } from "cloudflare:workers";

import { KV_READ_TIMEOUT_MS, noopForecastCache, withReadTimeout, type ForecastCache } from "./cache";

/**
 * The `FORECAST_CACHE` Workers KV namespace as a `ForecastCache`, or a no-op cache when the binding
 * is absent. This is the only module that imports `cloudflare:workers` (Vitest cannot resolve it),
 * and only the page imports it; everything else takes the cache as a parameter.
 */
export function kvForecastCache(): ForecastCache {
  const kv = (env as Partial<Cloudflare.Env>).FORECAST_CACHE;
  if (kv === undefined) {
    return noopForecastCache;
  }
  return withReadTimeout(
    {
      get: (key) => kv.get(key),
      put: (key, value, options) => kv.put(key, value, options),
    },
    KV_READ_TIMEOUT_MS,
  );
}
