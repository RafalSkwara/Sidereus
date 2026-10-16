import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
import type { Database } from "@/lib/database.types";
import { withTimeout } from "@/lib/fetch-timeout";
import { logFailure } from "@/lib/observability/log-failure";
import { withSessionMaxAge } from "@/lib/session-cookie";

export type TypedSupabaseClient = SupabaseClient<Database>;

/** The signed-in user as the middleware knows it: read from the verified access token's claims. */
export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Every Supabase call (token refresh, signing keys, PostgREST, auth routes) fails after this long
 * instead of holding the request open. An aborted call has no `error.code`, so callers fall through
 * to their generic error keys.
 */
export const SUPABASE_TIMEOUT_MS = 5000;

/** Whether this isolate has already said that Supabase is not configured: once per isolate is enough. */
let reportedMissingConfig = false;

/**
 * The cookie-backed client, or `null` when `SUPABASE_URL` / `SUPABASE_KEY` are unset. In a built (non-dev) app that
 * is a bad deploy that signs every user out, so the first `null` of an isolate leaves one `config.supabase` line; a
 * dev server without the variables is the normal local state and stays quiet.
 */
export function createClient(requestHeaders: Headers, cookies: AstroCookies): TypedSupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (!import.meta.env.DEV && !reportedMissingConfig) {
      reportedMissingConfig = true;
      logFailure("config.supabase");
    }
    return null;
  }
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    global: { fetch: withTimeout(fetch, SUPABASE_TIMEOUT_MS) },
    cookies: {
      getAll() {
        return parseCookieHeader(requestHeaders.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Our 30-day idle lifetime: @supabase/ssr ignores cookieOptions.maxAge and writes 400 days itself.
          cookies.set(name, value, withSessionMaxAge(options));
        });
      },
    },
  });
}
