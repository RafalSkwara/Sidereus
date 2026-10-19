import { env } from "cloudflare:workers";

import { CLIENT_ERROR_LIMIT_KEY, createMemoryLimiter } from "@/lib/observability/client-error-limit";
import { logFailure } from "@/lib/observability/log-failure";

/** This isolate's in-memory limiter, made on the first call without the binding. */
let fallback: RateLimit | undefined;

/** Whether this isolate has already said the limiter is broken or missing: once per isolate is enough. */
let reported = false;

/**
 * Whether one more client report may be logged now. With `kv-cache.ts` this is one of the two modules that import
 * `cloudflare:workers` (Vitest cannot resolve it; tests supply the binding object through the shared seam). The
 * `CLIENT_ERROR_LIMITER` Workers Rate Limiting binding counts every report under one constant key. A missing binding
 * is a deploy fault (a Wrangler `env` does not inherit `ratelimits`): the first call of an isolate leaves one
 * `config.rate-limit` line, as `forecast.cache-missing` does, and the in-memory bucket serves, so the route is never
 * left unlimited.
 */
export async function allowClientError(): Promise<boolean> {
  const binding = (env as Partial<Cloudflare.Env> & { CLIENT_ERROR_LIMITER?: RateLimit }).CLIENT_ERROR_LIMITER;
  let limiter = binding;
  if (limiter === undefined) {
    if (!reported) {
      reported = true;
      logFailure("config.rate-limit");
    }
    fallback ??= createMemoryLimiter();
    limiter = fallback;
  }
  try {
    const { success } = await limiter.limit({ key: CLIENT_ERROR_LIMIT_KEY });
    return success;
  } catch (error) {
    // The binding itself failed (a server fault nobody can forge, unlike a bad request): refuse the report, so a broken
    // limiter never leaves the route unlimited, and leave the one line.
    if (!reported) {
      reported = true;
      logFailure("config.rate-limit", error);
    }
    return false;
  }
}
