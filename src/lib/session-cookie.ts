// How long a sign-in lasts without use (PRD NFR session longevity; S-09 user decision: exactly 30 days idle).
// Pure: no astro:* imports, so it is unit-tested apart from the Supabase client that applies it.

/** 30 days. The auth cookie is re-written on every token refresh, so this counts from the last refresh. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * The options for an auth cookie Supabase asks us to write, with our lifetime. `@supabase/ssr` 0.12 always
 * writes its own 400-day default and ignores `cookieOptions.maxAge`, so the lifetime has to be set here.
 * A removal (`maxAge: 0`) stays a removal.
 */
export function withSessionMaxAge<T extends { maxAge?: number }>(options: T): T {
  return options.maxAge === 0 ? options : { ...options, maxAge: SESSION_MAX_AGE_SECONDS };
}
