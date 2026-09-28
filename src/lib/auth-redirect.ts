// Where to send a user after sign-in (PRD Access Control: "returns the user to sign-in and continues to the
// requested page afterwards"). Pure and island-safe, like protected-routes.ts, so the middleware, the sign-in
// route and the sign-in page share one rule.

const SIGN_IN_PATH = "/auth/signin";

/** A throwaway origin to resolve relative targets against; only "did the origin change" matters. */
const BASE_ORIGIN = "http://sidereus.invalid";

/** API routes are POST targets and auth pages lead nowhere useful, so neither is a place to continue to. */
const REFUSED_PREFIXES = ["/api", "/auth"];

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * The page to continue to after sign-in, or `null` when `value` is not a safe same-origin page path. Returns the
 * parsed URL's path and query (fragment dropped), never the raw input, so odd-but-valid spellings come back
 * normalised.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\") || CONTROL_CHARACTERS.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, BASE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== BASE_ORIGIN) return null;

  const { pathname, search } = url;
  if (REFUSED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;
  return pathname + search;
}

/** The sign-in page, carrying `next` when it is a safe place to continue to afterwards. */
export function signInUrl(next?: string | null): string {
  const target = safeNextPath(next);
  return target ? `${SIGN_IN_PATH}?next=${encodeURIComponent(target)}` : SIGN_IN_PATH;
}
