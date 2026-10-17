import { logFailure } from "@/lib/observability/log-failure";
import type { SessionUser, TypedSupabaseClient } from "@/lib/supabase";

/**
 * The names of the auth-js errors that mean "this cookie is stale or changed", not "Auth is down": no session at all
 * (`AuthSessionMissingError`, which auth-js also makes of a `session_not_found` answer), a token that does not verify
 * (`AuthInvalidJwtError`, whose own code is `invalid_jwt`) and a refresh whose result auth-js threw away because the
 * session changed mid-flight (`AuthRefreshDiscardedError`, status 409 and no code: a concurrent sign-out raced it, and
 * auth-js itself treats it as a no-op). Confirmed against `@supabase/auth-js` 2.116.0's `errors.ts`, and pinned
 * against the installed copy in `session-user.test.ts`.
 */
export const ROUTINE_ERROR_NAMES = [
  "AuthSessionMissingError",
  "AuthInvalidJwtError",
  "AuthRefreshDiscardedError",
] as const;

/**
 * The codes Auth answers with when the refresh token or the session behind a cookie is gone: the server's
 * `refresh_token_not_found`, `refresh_token_already_used`, `session_expired`, `session_not_found` and `bad_jwt`, and
 * `validation_failed`, which the token endpoint answers for a refresh token that is not even well formed (a tampered
 * cookie; checked against local Supabase 2026-10-16: a well-formed unknown token is `refresh_token_not_found`), so a
 * crafted cookie cannot make the middleware write an error line per request. The
 * library declares each in its `ErrorCode` union; pinned in `session-user.test.ts`.
 */
export const ROUTINE_ERROR_CODES = [
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_expired",
  "session_not_found",
  "bad_jwt",
  "validation_failed",
] as const;

/** The name auth-js gives a transient fetch failure: a network error, the client's 5 s timeout or a gateway 5xx. */
const RETRYABLE_NAME = "AuthRetryableFetchError";

function readField(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null ? (source as Record<string, unknown>)[key] : undefined;
}

/** The HTTP status an auth error carries, when it has one; the log helper keeps it only inside 100-599. */
export function statusOfAuthError(error: unknown): number | undefined {
  const status = readField(error, "status");
  return typeof status === "number" ? status : undefined;
}

/**
 * True for the errors that only say a cookie's session is stale (the user is simply signed out): the routine names
 * and codes above, but never a transient fetch failure or a 5xx, whatever else they carry. Everything else is a
 * failure, unknown ones included: an unknown error is not benign.
 */
export function isRoutineSessionError(error: unknown): boolean {
  const status = statusOfAuthError(error);
  const name = readField(error, "name");
  if (name === RETRYABLE_NAME || (status !== undefined && status >= 500)) {
    return false;
  }
  const code = readField(error, "code");
  return (
    (typeof name === "string" && (ROUTINE_ERROR_NAMES as readonly string[]).includes(name)) ||
    (typeof code === "string" && (ROUTINE_ERROR_CODES as readonly string[]).includes(code))
  );
}

/**
 * Verifies the access token locally (asymmetric signing keys, cached per isolate) instead of asking Supabase Auth on
 * every request; Supabase is only called when the token needs refreshing. Accepted trade-off: a session revoked
 * elsewhere stays valid here until its token expires (at most 1 h). Any failure, a timeout included, counts as signed
 * out, but not silently: auth-js returns an auth failure as `{ data: null, error }` (only a non-auth error is thrown),
 * so a stale cookie (`isRoutineSessionError`) is quiet while an Auth outage, a timeout or an unknown error leaves one
 * `auth.claims` line with the error's name and status, so it no longer reads as a mass sign-out. No session at all is
 * `{ data: null, error: null }` and logs nothing. Pure over the client: no virtual module, no request.
 */
export async function sessionUser(client: Pick<TypedSupabaseClient, "auth">): Promise<SessionUser | null> {
  try {
    const { data, error } = await client.auth.getClaims();
    if (error && !isRoutineSessionError(error)) {
      logFailure("auth.claims", error, { status: statusOfAuthError(error) });
    }
    const claims = data?.claims;
    return claims ? { id: claims.sub, email: claims.email ?? null } : null;
  } catch (error) {
    logFailure("auth.claims", error, { status: statusOfAuthError(error) });
    return null;
  }
}
