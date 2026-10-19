/**
 * The limits of `POST /api/client-error` and an in-memory limiter with the shape of the Workers Rate Limiting binding
 * (error-visibility, Phase 7, D9). The binding is the production limiter (`rate-limit.ts`); this bucket serves Vitest
 * and a deploy that lost the binding. The key is one constant: Cloudflare advises against IP keys and a personal key is
 * not allowed, so the bound is on log volume per location, not per visitor.
 */

/** Reports allowed per period; also the `limit` of the `CLIENT_ERROR_LIMITER` entry in `wrangler.jsonc`. */
export const CLIENT_ERROR_LIMIT = 30;
/** The period in seconds (the binding accepts 10 or 60). */
export const CLIENT_ERROR_PERIOD_SECONDS = 60;
/** The one key every report is counted under. */
export const CLIENT_ERROR_LIMIT_KEY = "client-error";

export interface MemoryLimiterOptions {
  limit?: number;
  periodSeconds?: number;
  /** Milliseconds, for tests. */
  now?: () => number;
}

/**
 * A token bucket per key: `limit` tokens, refilled evenly over `periodSeconds`, one taken per call. Same shape as the
 * binding's `limit({ key })`, so either serves the route.
 */
export function createMemoryLimiter({
  limit = CLIENT_ERROR_LIMIT,
  periodSeconds = CLIENT_ERROR_PERIOD_SECONDS,
  now = Date.now,
}: MemoryLimiterOptions = {}): RateLimit {
  const buckets = new Map<string, { tokens: number; at: number }>();
  const perMs = limit / (periodSeconds * 1000);
  return {
    limit: ({ key }) => {
      const at = now();
      const bucket = buckets.get(key) ?? { tokens: limit, at };
      const tokens = Math.min(limit, bucket.tokens + (at - bucket.at) * perMs);
      const success = tokens >= 1;
      buckets.set(key, { tokens: success ? tokens - 1 : tokens, at });
      return Promise.resolve({ success });
    },
  };
}
