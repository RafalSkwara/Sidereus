/**
 * The only place the app writes a failure to the console (error-visibility, Phase 1). One call per failed step:
 * `logFailure(step, error)` for a real fault (`console.error`, which Workers Issues records) and `logNotice` for an
 * expected-but-countable condition (`console.warn`, never an Issue).
 *
 * What a line may hold is the privacy rule, kept in this one file: a fixed message per step and the structured fields
 * `{ step, name?, code?, status? }`. `name` is an error's (or its cause's) name when it looks like an identifier,
 * `code` is a database code that passes `CODE_SHAPE`, `status` is an integer 100-599. The helper never reads
 * `message` or `stack`, never passes an `Error` (or any object other than the fields) to the console, and never
 * throws, whatever it is given. No identifier, coordinate, email, URL or form value ever reaches a line (D4).
 */

/**
 * Every step a line can name, dotted and grouped by flow. One entry per trace site, added as the phases need them.
 * A later phase that adds the `client.<ClientStep>` family widens `FailureStep` with a template literal type below
 * instead of listing those words here.
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
  "milestones.read",
  "milestones.record",
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
] as const;

/** The steps listed in `FAILURE_STEPS`. */
export type ListedFailureStep = (typeof FAILURE_STEPS)[number];

/** A step a line may name: a closed vocabulary, so a free-text value can never become the step. */
export type FailureStep = ListedFailureStep;

/** A database error code shaped like PostgREST's or Postgres's (`42501`, `PGRST301`); anything else is not logged. */
export const CODE_SHAPE = /^[0-9A-Za-z_]{1,12}$/;

/** A short identifier: what an error class is called (`TypeError`, `PostgrestError`), never a sentence or a value. */
const NAME_SHAPE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

/** `Error` is what every wrapper is called, so a more specific name on the cause says more. */
const GENERIC_NAME = "Error";

/** The fields of a line: only strings and numbers, so nothing but them can reach the console. */
interface LogFields {
  step: FailureStep;
  name?: string;
  code?: string;
  status?: number;
}

/** What the caller may add; only `status` is read. */
export interface FailureExtra {
  status?: number;
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
  return typeof code === "string" && CODE_SHAPE.test(code) ? code : undefined;
}

function statusOf(extra: unknown): number | undefined {
  const status = read(extra, "status");
  return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
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
