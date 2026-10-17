/**
 * The request's "now" and its one test seam (test-suite-diet Phase 6, owner decision 6.6).
 *
 * Only reads that **decide the night** go through here (the Tonight island, the Session plan routes, the log's routes
 * and pages, the sky checks). Everything else keeps the real clock on purpose: stored timestamps (`updated_at`, the
 * plan-read time), the offline copy's `preparedAt` and everything in the service worker, which compares them with its
 * own real clock to expire a copy.
 *
 * The seam: an e2e run can put the server in a named moment with the cookie `sidereus-test-now=<ISO instant>`. It is
 * honoured only when the hostname of `SUPABASE_URL` is exactly a loopback host, i.e. only against the local Supabase
 * stack. A production Worker's Supabase is the hosted project (set by the operator, never by a visitor), so there the
 * cookie is ignored and no visitor can move the server's clock. The value is validated as an ISO instant; anything
 * else is ignored. It never reaches a log or a URL. The middleware resolves it once per request into
 * `locals.testNow`; with no cookie `requestNow` is `new Date()`.
 *
 * Pure and free of Astro imports, so the unit test runs it directly.
 */

export const TEST_NOW_COOKIE = "sidereus-test-now";

/** Exact comparison, never `startsWith` or `includes`: `127.0.0.1.evil.example` and `localhost.example.com` are hosted. */
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const EARLIEST_MS = Date.UTC(2020, 0, 1);
const LATEST_MS = Date.UTC(2040, 0, 1);

function isLoopbackUrl(url: string | undefined): boolean {
  // `URL.canParse` instead of a try/catch: a URL that does not parse is simply not loopback, and nothing is swallowed.
  return url !== undefined && URL.canParse(url) && LOOPBACK_HOSTNAMES.has(new URL(url).hostname);
}

/** The instant the cookie names, or `null` when there is none, it is malformed, or `supabaseUrl` is not loopback. */
export function readTestNow(cookieHeader: string | null | undefined, supabaseUrl: string | undefined): Date | null {
  if (!cookieHeader || !isLoopbackUrl(supabaseUrl)) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== TEST_NOW_COOKIE) {
      continue;
    }
    const value = decodeURIComponent(rest.join("="));
    if (!ISO_INSTANT.test(value)) {
      return null;
    }
    const instant = new Date(value);
    const ms = instant.getTime();
    return Number.isNaN(ms) || ms < EARLIEST_MS || ms > LATEST_MS ? null : instant;
  }
  return null;
}

/** The request's "now": the pinned instant the middleware resolved, else the real clock. */
export function requestNow(locals: { testNow?: Date }): Date {
  return locals.testNow ?? new Date();
}
