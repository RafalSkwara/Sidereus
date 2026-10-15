import { CODE_SHAPE } from "./log-failure";

/**
 * The sanitized carrier for "what went wrong" in the data layer (error-visibility, Phase 2). A store keeps the
 * diagnosis it used to drop, without the one thing it must never keep: database error text can echo submitted values,
 * coordinates included (PRD NFR), so the carrier holds a shape-checked `code` and an integer `status` and nothing
 * else. It is safe to return, to keep as an `Error`'s `cause` and, later, to log.
 *
 * `classifyFault` is the one rule that says whose fault a failure is. Server is the default, because an unknown code
 * is not benign: only the codes known to be the user's request, the session or a missing row are told apart. This
 * module never logs.
 */

/** Fixed on purpose: the original message is never kept, so nothing about the failure can be read from this one. */
const STORE_FAULT_MESSAGE = "A database request failed";

/** What a failed database request was, for the caller and for the log: only `server` is alertable. */
export type FaultKind = "input" | "refused" | "session" | "no-rows" | "server";

/** The fault a failed write carries next to its message key. A user-input failure carries none (kind `input`). */
export interface WriteFault {
  kind: Exclude<FaultKind, "input">;
  code?: string;
  status?: number;
}

/** A sanitized database fault: a fixed message, `name`, and the shaped `code` and `status` when they were present. */
export class StoreFault extends Error {
  override readonly name = "StoreFault";
  // `declare`: present only when the value was usable, never an own property holding `undefined`.
  declare readonly code?: string;
  declare readonly status?: number;

  constructor(init: { code?: string; status?: number } = {}) {
    super(STORE_FAULT_MESSAGE);
    if (init.code !== undefined && CODE_SHAPE.test(init.code)) {
      this.code = init.code;
    }
    if (isStatus(init.status)) {
      this.status = init.status;
    }
  }
}

function isStatus(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599;
}

// A thrown value can be anything, a proxy or a getter that throws included, and the code that builds a fault runs in
// a failure path: reading it must never be the thing that throws. Nothing can be said about a failing read, so the
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

function codeOf(source: unknown): string | undefined {
  const code = read(source, "code");
  return typeof code === "string" && CODE_SHAPE.test(code) ? code : undefined;
}

function statusOf(source: unknown): number | undefined {
  const status = read(source, "status");
  return isStatus(status) ? status : undefined;
}

/**
 * Builds a `StoreFault` from a PostgREST error or any thrown value, keeping only `code` and `status` (the error's own,
 * else its `cause`'s: a store that threw a keyed error leaves its fault there). It never copies `message`, `details`,
 * `hint` or `stack`, and never throws.
 */
export function faultFrom(error: unknown): StoreFault {
  const cause = read(error, "cause");
  return new StoreFault({
    code: codeOf(error) ?? codeOf(cause),
    status: statusOf(error) ?? statusOf(cause),
  });
}

/** Class 22 (data exception) and class 23 (integrity constraint violation): the user's input, not the database. */
const INPUT_CODE = /^2[23][0-9A-Z]{3}$/;

/** Postgres `insufficient_privilege`: an RLS denial from a forged or stale id. */
const REFUSED_CODE = "42501";

/** PostgREST's bad, expired or unverifiable JWT during a request: the session, not the database. */
const SESSION_CODES = new Set(["PGRST301", "PGRST302", "PGRST303"]);

/** PostgREST's "the result does not contain 1 row". */
const NO_ROWS_CODE = "PGRST116";

/**
 * Whose fault a failed request was. Pure, with **server as the default**: no code at all (a network failure or a
 * timeout), `08*`, `53*`, `57*`, `58*`, `XX*`, schema drift (`42P01`, `42703`), `PGRST000` to `PGRST003` and every
 * unknown code are the server's, and so is any status of 500 or more, whatever the code says. Only `server` is
 * alertable.
 */
export function classifyFault(fault: { code?: string; status?: number }): FaultKind {
  if (fault.status !== undefined && fault.status >= 500) {
    return "server";
  }
  const code = fault.code;
  if (code === undefined) {
    return "server";
  }
  if (INPUT_CODE.test(code)) {
    return "input";
  }
  if (code === REFUSED_CODE) {
    return "refused";
  }
  if (SESSION_CODES.has(code)) {
    return "session";
  }
  if (code === NO_ROWS_CODE) {
    return "no-rows";
  }
  return "server";
}

/** The fault of a zero-row update or delete: the row is not the caller's, or is gone. */
export function noRowsFault(): WriteFault {
  return { kind: "no-rows" };
}

/**
 * The `fault` field of a failed write, as `{ fault }` to spread into the result, or `{}` for a user-input failure
 * (`22P02`, `23514`, `23505`: the entity's own message key says it, and nothing is alertable). Takes a PostgREST
 * error, a `StoreFault` or any thrown value; only its `code` and `status` are read.
 */
export function withFault(error: unknown): { fault?: WriteFault } {
  const { code, status } = faultFrom(error);
  const kind = classifyFault({ code, status });
  if (kind === "input") {
    return {};
  }
  const fault: WriteFault = { kind };
  if (code !== undefined) {
    fault.code = code;
  }
  if (status !== undefined) {
    fault.status = status;
  }
  return { fault };
}
