import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
import type { Database } from "@/lib/database.types";
import { withTimeout } from "@/lib/fetch-timeout";

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

export function createClient(requestHeaders: Headers, cookies: AstroCookies): TypedSupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
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
          cookies.set(name, value, options);
        });
      },
    },
  });
}
