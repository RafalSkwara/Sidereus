/**
 * The only place the app writes a failure to the console (error-visibility, Phase 1). One call per failed step:
 * `logFailure(step, error)` for a real fault (`console.error`, which Workers Issues records) and `logNotice` for an
 * expected-but-countable condition (`console.warn`, never an Issue).
 *
 * What a line may hold is the privacy rule, kept in this one file: a fixed message per step and the structured fields
 * `{ step, name?, code?, status?, route? }`. `name` is an error's (or its cause's) name when it looks like an identifier,
 * `code` is one of a few closed shapes (`isLoggableCode`: a SQLSTATE, a PostgREST code, a forecast step or an auth-js
 * error code), `status` is an integer 100-599, `route` is a route template (`/log/[id]`, never a pathname: see
 * `isRouteTemplate`). The helper never reads
 * `message` or `stack`, never passes an `Error` (or any object other than the fields) to the console, and never
 * throws, whatever it is given. No identifier, coordinate, email, URL or form value ever reaches a line (D4).
 */

import { NAME_SHAPE, type ClientStep } from "@/lib/observability/client/steps";

/**
 * Every server step a line can name, dotted and grouped by flow. One entry per trace site, added as the phases need
 * them. The `client.<ClientStep>` family is not listed here: `FailureStep` below widens with a template literal type.
 */
export const FAILURE_STEPS = [
  "forecast.fetch",
  "forecast.incomplete",
  "forecast.cache-read",
  "forecast.cache-write",
  "forecast.cache-missing",
  "tonight.sites",
  "tonight.telescopes",
  "tonight.eyepieces",
  "tonight.log",
  "tonight.sky-checks",
  "tonight.build",
  "tonight.planets",
  "tonight.moon",
  "tonight.sky-view",
  "tonight.sky-check-record",
  "tonight.session-plan",
  "tonight.sky-events",
  "tonight.plan-edits",
  "finder.stars",
  "finder.chart",
  "account.plan",
  "milestones.list",
  "progress.seen",
  "milestones.read-create",
  "milestones.read-edit",
  "milestones.read-delete",
  "milestones.record-create",
  "milestones.record-edit",
  "milestones.record-delete",
  "save.gear",
  "save.log",
  "save.sky-check",
  "save.onboarding",
  "save.plan",
  "save.plan-reset",
  "request.form",
  "read.log",
  "read.gear",
  "read.sky-checks",
  "read.onboarding",
  "auth.claims",
  "auth.signin",
  "auth.signup",
  "auth.signout",
  "config.supabase",
  "config.rate-limit",
  "finder.tonight",
  "request.stream",
  "request.uncaught",
] as const;

/** The steps listed in `FAILURE_STEPS`. */
export type ListedFailureStep = (typeof FAILURE_STEPS)[number];

/**
 * A step a line may name: a closed vocabulary, so a free-text value can never become the step. The client family is
 * the closed `CLIENT_STEPS` list of `POST /api/client-error`, logged as `client.<step>` notices only.
 */
export type FailureStep = ListedFailureStep | `client.${ClientStep}`;

/**
 * Postgres's SQLSTATE: five digits or capitals with a real class (`42501`, `XX000`). A class starts with a digit, or is
 * one of the four lettered classes (`F0` configuration file, `HV` foreign data wrapper, `P0` PL/pgSQL, `XX` internal),
 * so a five-character catalogue id (`IC405`, `NGC40`, `IC342`) never passes as one.
 */
const SQLSTATE_SHAPE = /^(?:[0-9][0-9A-Z]|F0|HV|P0|XX)[0-9A-Z]{3}$/;

/** PostgREST's own codes (`PGRST301`). */
const POSTGREST_SHAPE = /^PGRST\d{3}$/;

/**
 * The code of a database request that never completed (response status 0: a timeout, a dropped connection), which is
 * also the forecast client's `request` step. Named here, next to the set that accepts it, so a rename of the forecast
 * steps cannot switch the store code off unseen (`fault.test.ts` pins both words).
 */
export const TRANSPORT_CODE = "request";

/**
 * The code of a request answered with a status that is not a success and no PostgREST error body (a gateway's 502
 * with an HTML page), which is also the forecast client's `http` step. It travels with the status.
 */
export const HTTP_CODE = "http";

/** The four steps of a `ForecastError`, which travels as the line's `code` (`open-meteo.ts`), and the two store codes. */
const FORECAST_STEPS: ReadonlySet<string> = new Set([TRANSPORT_CODE, HTTP_CODE, "parse", "schema"]);

/**
 * The members of `@supabase/auth-js`'s `ErrorCode` union (`error-codes.d.ts`, 2.116.0), copied as an explicit
 * allowlist: GoTrue's own words for what went wrong (`over_request_rate_limit`, `validation_failed`), never a value.
 * `log-failure.test.ts` checks every entry against the installed copy. A code the library adds later is dropped from
 * the line until it is added here (noise lost, never a leak).
 */
export const AUTH_ERROR_CODES: readonly string[] = [
  "unexpected_failure",
  "validation_failed",
  "bad_json",
  "email_exists",
  "phone_exists",
  "bad_jwt",
  "not_admin",
  "no_authorization",
  "user_not_found",
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "flow_state_not_found",
  "flow_state_expired",
  "signup_disabled",
  "user_banned",
  "provider_email_needs_verification",
  "invite_not_found",
  "bad_oauth_state",
  "bad_oauth_callback",
  "oauth_provider_not_supported",
  "unexpected_audience",
  "single_identity_not_deletable",
  "email_conflict_identity_not_deletable",
  "identity_already_exists",
  "email_provider_disabled",
  "phone_provider_disabled",
  "too_many_enrolled_mfa_factors",
  "mfa_factor_name_conflict",
  "mfa_factor_not_found",
  "mfa_ip_address_mismatch",
  "mfa_challenge_expired",
  "mfa_verification_failed",
  "mfa_verification_rejected",
  "insufficient_aal",
  "captcha_failed",
  "saml_provider_disabled",
  "manual_linking_disabled",
  "sms_send_failed",
  "email_not_confirmed",
  "phone_not_confirmed",
  "reauth_nonce_missing",
  "saml_relay_state_not_found",
  "saml_relay_state_expired",
  "saml_idp_not_found",
  "saml_assertion_no_user_id",
  "saml_assertion_no_email",
  "user_already_exists",
  "sso_provider_not_found",
  "saml_metadata_fetch_failed",
  "saml_idp_already_exists",
  "sso_domain_already_exists",
  "saml_entity_id_mismatch",
  "conflict",
  "provider_disabled",
  "user_sso_managed",
  "reauthentication_needed",
  "same_password",
  "reauthentication_not_valid",
  "otp_expired",
  "otp_disabled",
  "identity_not_found",
  "weak_password",
  "over_request_rate_limit",
  "over_email_send_rate_limit",
  "over_sms_send_rate_limit",
  "bad_code_verifier",
  "anonymous_provider_disabled",
  "hook_timeout",
  "hook_timeout_after_retry",
  "hook_payload_over_size_limit",
  "hook_payload_invalid_content_type",
  "request_timeout",
  "mfa_phone_enroll_not_enabled",
  "mfa_phone_verify_not_enabled",
  "mfa_totp_enroll_not_enabled",
  "mfa_totp_verify_not_enabled",
  "mfa_webauthn_enroll_not_enabled",
  "mfa_webauthn_verify_not_enabled",
  "mfa_recovery_codes_enroll_not_enabled",
  "mfa_recovery_codes_verify_not_enabled",
  "mfa_recovery_codes_locked",
  "mfa_recovery_codes_sole_factor",
  "mfa_verified_factor_exists",
  "invalid_credentials",
  "email_address_not_authorized",
  "email_address_invalid",
];

const AUTH_ERROR_CODE_SET: ReadonlySet<string> = new Set(AUTH_ERROR_CODES);

/**
 * Whether a value may travel as a line's `code`: only a closed shape, so a value that merely looks like a short word
 * (a catalogue id such as `M31`, a username, a site-id fragment) can never be logged by a future `{ code: value }`
 * error. Exactly: a SQLSTATE, a PostgREST code, one of the four forecast steps or an auth-js `ErrorCode`. The one
 * test the `code` of a line, of a `StoreFault` and of the account-plan fault all go through.
 */
export function isLoggableCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (SQLSTATE_SHAPE.test(value) ||
      POSTGREST_SHAPE.test(value) ||
      FORECAST_STEPS.has(value) ||
      AUTH_ERROR_CODE_SET.has(value))
  );
}

/** `Error` is what every wrapper is called, so a more specific name on the cause says more. */
const GENERIC_NAME = "Error";

/** The fields of a line: only strings and numbers, so nothing but them can reach the console. */
interface LogFields {
  step: FailureStep;
  name?: string;
  code?: string;
  status?: number;
  route?: string;
}

/** What the caller may add; only `status` and `route` are read. */
export interface FailureExtra {
  status?: number;
  route?: string;
}

// The reads below sit behind try/catch because a getter, a proxy or a revoked proxy can throw, and a logger must
// never be the thing that fails a request. Nothing can be logged about a failing read (it would recurse), so the
// fallback is "no field".

function read(source: unknown, key: string): unknown {
  try {
    if ((typeof source !== "object" && typeof source !== "function") || source === null) {
      return undefined;
    }
    return (source as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function isError(value: unknown): value is Error {
  try {
    return value instanceof Error;
  } catch {
    return false;
  }
}

/** An Error's name, only when it has the shape of an identifier. A value that is not an Error never gives one. */
function nameOf(value: unknown): string | undefined {
  if (!isError(value)) {
    return undefined;
  }
  const name = read(value, "name");
  return typeof name === "string" && NAME_SHAPE.test(name) ? name : undefined;
}

function codeOf(value: unknown): string | undefined {
  const code = read(value, "code");
  return isLoggableCode(code) ? code : undefined;
}

function statusOf(extra: unknown): number | undefined {
  const status = read(extra, "status");
  return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
}

/** One segment of a template: a fixed word (letters, `_`, `-`) or a parameter written `[x]` / `[...x]`. */
const TEMPLATE_SEGMENT = /^(?:[A-Za-z_-]+|\[(?:\.\.\.)?[A-Za-z_-]+\])$/;

const ROUTE_MAX_LENGTH = 80;

/** The route of a server island's request, whose name is the one place a digit may appear (`TonightContent2`). */
const ISLAND_ROUTE_PREFIX = "/_server-islands/";
const ISLAND_PATTERN = `${ISLAND_ROUTE_PREFIX}[name]`;

/**
 * Whether a value has the template shape of a route: it starts with `/`, every segment is a fixed word or a parameter
 * in brackets, and it is at most 80 characters. A pathname never has it (a uuid, a number or a coordinate has digits
 * or dots), so no value can travel as a route. A server island's `/_server-islands/<name>` also passes, by `NAME_SHAPE`.
 */
function isRouteTemplate(value: unknown): value is string {
  if (typeof value !== "string" || value.length > ROUTE_MAX_LENGTH || !value.startsWith("/")) {
    return false;
  }
  if (value === "/") {
    return true;
  }
  if (value.startsWith(ISLAND_ROUTE_PREFIX) && NAME_SHAPE.test(value.slice(ISLAND_ROUTE_PREFIX.length))) {
    return true;
  }
  return value
    .slice(1)
    .split("/")
    .every((segment) => TEMPLATE_SEGMENT.test(segment));
}

/**
 * The route to put on a request-level line: Astro's `routePattern` when it is a template, with a server island's
 * name filled in when `params.name` is an identifier (the pattern alone would not say which island broke). Reads no
 * URL, so a pathname can never get here. `undefined` for anything else. Never throws.
 */
export function requestRoute(routePattern: unknown, params: unknown): string | undefined {
  if (!isRouteTemplate(routePattern)) {
    return undefined;
  }
  if (routePattern === ISLAND_PATTERN) {
    const name = read(params, "name");
    return typeof name === "string" && NAME_SHAPE.test(name) ? `${ISLAND_ROUTE_PREFIX}${name}` : routePattern;
  }
  return routePattern;
}

function routeOf(extra: unknown): string | undefined {
  const route = read(extra, "route");
  return isRouteTemplate(route) ? route : undefined;
}

function fieldsOf(step: FailureStep, error: unknown, extra: unknown): LogFields {
  const fields: LogFields = { step };
  const cause = read(error, "cause");
  const own = nameOf(error);
  const name = own !== undefined && own !== GENERIC_NAME ? own : (nameOf(cause) ?? own);
  if (name !== undefined) {
    fields.name = name;
  }
  const code = codeOf(error) ?? codeOf(cause);
  if (code !== undefined) {
    fields.code = code;
  }
  const status = statusOf(extra);
  if (status !== undefined) {
    fields.status = status;
  }
  const route = routeOf(extra);
  if (route !== undefined) {
    fields.route = route;
  }
  return fields;
}

/** The fields, or just the step if anything about the error defeats the reads. */
function safeFields(step: FailureStep, error: unknown, extra: unknown): LogFields {
  try {
    return fieldsOf(step, error, extra);
  } catch {
    return { step };
  }
}

/**
 * Logs one failed step at error level (`sidereus: <step> failed`), which Workers Issues groups by that message.
 * Pass the caught value as is: the helper takes only its shaped name and code. Never throws.
 */
export function logFailure(step: FailureStep, error?: unknown, extra?: FailureExtra): void {
  const fields = safeFields(step, error, extra);
  try {
    // eslint-disable-next-line no-console -- the one failure line: a fixed message per step and the shaped fields, never a message, stack or Error.
    console.error(`sidereus: ${step} failed`, fields);
  } catch {
    // A broken console cannot be reported anywhere else.
  }
}

/**
 * Logs one expected-but-countable condition at warn level (`sidereus: <step> noted`): an RLS refusal, a zero-row
 * update, a stale session on a write. Same fields as `logFailure`, but it never becomes an Issue. Never throws.
 */
export function logNotice(step: FailureStep, error?: unknown, extra?: FailureExtra): void {
  const fields = safeFields(step, error, extra);
  try {
    // eslint-disable-next-line no-console -- the one notice line: a fixed message per step and the shaped fields, never a message, stack or Error.
    console.warn(`sidereus: ${step} noted`, fields);
  } catch {
    // A broken console cannot be reported anywhere else.
  }
}
