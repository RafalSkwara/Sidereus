import type { ZodError } from "zod";
import { isMessageKey, type MessageKey } from "@/i18n";

/**
 * The fixed `?error=` values API routes redirect with. Every one is a message key (`@/i18n`) that the
 * page or island translates, so a URL never carries a sentence, a submitted value or a provider's
 * error text.
 */

export const NOT_CONFIGURED: MessageKey = "errors.notConfigured";
export const CHECK_FIELDS: MessageKey = "errors.checkFields";
export const AUTH_NOT_CONFIGURED: MessageKey = "errors.auth.notConfigured";

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
