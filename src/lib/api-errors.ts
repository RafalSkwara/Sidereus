import type { ZodError } from "zod";
import { isMessageKey, type MessageKey } from "@/i18n";
import { isRoutineSessionError, statusOfAuthError } from "@/lib/auth/session-user";
import { logFailure, logNotice } from "@/lib/observability/log-failure";

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
 * failure leaves a `request.form` line with only the thrown error's name: an error-level line, which can become an
 * Issue. A route anyone can POST to without signing in (`publicRoute`: sign-in and sign-up) leaves a warn-level notice
 * instead, since a scanner's malformed body is the client's fault and must not wake the operator.
 */
export async function readForm(request: Request, options: { publicRoute?: boolean } = {}): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch (error) {
    if (options.publicRoute) {
      logNotice("request.form", error);
    } else {
      logFailure("request.form", error);
    }
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

/**
 * The codes that are the user's own mistake or state at sign-in or sign-up: expected, no fault of ours, so no line.
 * `validation_failed` is GoTrue's answer to a malformed or missing field, and `email_not_confirmed` a user who has not
 * followed the confirmation link (it occurs once the hosted project turns confirmations on).
 */
const USER_MISTAKE_CODES: ReadonlySet<string> = new Set([
  "invalid_credentials",
  "user_already_exists",
  "weak_password",
  "email_address_invalid",
  "validation_failed",
  "email_not_confirmed",
]);

/** Anyone can trigger these on an open endpoint, so they are counted as warn lines, never an Issue per attempt. */
const RATE_LIMIT_CODES: ReadonlySet<string> = new Set(["over_request_rate_limit", "over_email_send_rate_limit"]);

/**
 * Leaves a line for an Auth failure an operator needs to see (`auth.signin`, `auth.signup`, `auth.signout`): a
 * network or timeout fault (no `code`), a 5xx, a confirmation-email fault, an unknown error, each an error-level line.
 * A rate limit is a warn-level notice (countable by its message, never an Issue). A wrong password, an address that is
 * already registered, a weak password, a malformed or missing field and an unconfirmed email are the user's mistakes
 * and stay silent, as does a sign-out whose session was already stale. Only the error's name, its status and its
 * `code` reach the line, and the code only when it is one of auth-js's own `ErrorCode`s (`isLoggableCode`), never its
 * message, which can hold the email; the redirect key is `authErrorKey`'s and does not depend on this.
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
  const status = { status: statusOfAuthError(error) };
  if (code !== undefined && RATE_LIMIT_CODES.has(code)) {
    logNotice(step, error, status);
    return;
  }
  logFailure(step, error, status);
}
