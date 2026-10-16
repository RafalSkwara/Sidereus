import type { ZodError } from "zod";
import { isMessageKey, type MessageKey } from "@/i18n";
import { isRoutineSessionError, statusOfAuthError } from "@/lib/auth/session-user";
import { logFailure } from "@/lib/observability/log-failure";

/**
 * The fixed `?error=` values API routes redirect with. Every one is a message key (`@/i18n`) that the
 * page or island translates, so a URL never carries a sentence, a submitted value or a provider's
 * error text.
 */

export const NOT_CONFIGURED: MessageKey = "errors.notConfigured";
export const CHECK_FIELDS: MessageKey = "errors.checkFields";
export const AUTH_NOT_CONFIGURED: MessageKey = "errors.auth.notConfigured";
export const ACCOUNT_PLAN_NEEDS_FULL: MessageKey = "errors.accountPlan.needsFull";

/**
 * The posted form, or `null` when the body is not one (a wrong content type, a truncated upload): `formData()` rejects
 * on it, which used to end as an uncaught 500. The route redirects with `CHECK_FIELDS`, the shape-error key, and the
 * failure leaves a `request.form` line with only the thrown error's name.
 */
export async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch (error) {
    logFailure("request.form", error);
    return null;
  }
}

/** The first issue's message when it is a catalogue key (the schemas only emit keys), else `CHECK_FIELDS`. */
export function issueKey(error: ZodError): MessageKey {
  const message = error.issues.at(0)?.message;
  return message !== undefined && isMessageKey(message) ? message : CHECK_FIELDS;
}

const AUTH_ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  invalid_credentials: "errors.auth.invalidCredentials",
  user_already_exists: "errors.auth.userExists",
  weak_password: "errors.auth.weakPassword",
  email_address_invalid: "errors.auth.invalidEmail",
  over_request_rate_limit: "errors.auth.rateLimited",
  over_email_send_rate_limit: "errors.auth.emailRateLimited",
};

/**
 * Maps a Supabase auth error to a key by its stable `code`. Supabase's `message` is never forwarded:
 * it is English-only and may change between versions. Unknown or missing codes → the generic key.
 */
export function authErrorKey(error: { code?: string }): MessageKey {
  const code = error.code;
  return code !== undefined && Object.hasOwn(AUTH_ERROR_KEYS, code) ? AUTH_ERROR_KEYS[code] : "errors.auth.generic";
}

/** The codes that are the user's own mistake at sign-in or sign-up: expected, no fault of ours, so no line. */
const USER_MISTAKE_CODES: ReadonlySet<string> = new Set([
  "invalid_credentials",
  "user_already_exists",
  "weak_password",
  "email_address_invalid",
]);

/**
 * Leaves a line for an Auth failure an operator needs to see (`auth.signin`, `auth.signup`, `auth.signout`): a
 * network or timeout fault (no `code`), a 5xx, a rate limit, a confirmation-email fault, an unknown error. A wrong
 * password, an address that is already registered, a weak password and a malformed address are the user's mistakes
 * and stay silent, as does a sign-out whose session was already stale. Only the error's name and status reach the
 * line (and a short code), never its message, which can hold the email; the redirect key is `authErrorKey`'s and
 * does not depend on this.
 */
export function logAuthFailure(
  step: "auth.signin" | "auth.signup" | "auth.signout",
  error: { code?: string; status?: number },
): void {
  const code = error.code;
  if (code !== undefined && USER_MISTAKE_CODES.has(code)) {
    return;
  }
  if (step === "auth.signout" && isRoutineSessionError(error)) {
    return;
  }
  logFailure(step, error, { status: statusOfAuthError(error) });
}
