import { env } from "cloudflare:workers";

import { logFailure } from "@/lib/observability/log-failure";

import { KV_READ_TIMEOUT_MS, noopForecastCache, withReadTimeout, type ForecastCache } from "./cache";

/** Whether this isolate has already said that the binding is missing: once per isolate is enough (as `config.supabase`). */
let reportedMissingBinding = false;

/**
 * The `FORECAST_CACHE` Workers KV namespace as a `ForecastCache`, or a no-op cache when the binding
 * is absent. This is the only module that imports `cloudflare:workers` (Vitest cannot resolve it),
 * and only the page imports it; everything else takes the cache as a parameter. A missing binding is a deploy fault
 * (every request would then refetch), so the first call of an isolate leaves a `forecast.cache-missing` line; the
 * rest stay quiet, since the same fault on every Tonight request would only repeat it.
 */
export function kvForecastCache(): ForecastCache {
  const kv = (env as Partial<Cloudflare.Env>).FORECAST_CACHE;
  if (kv === undefined) {
    if (!reportedMissingBinding) {
      reportedMissingBinding = true;
      logFailure("forecast.cache-missing");
    }
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
