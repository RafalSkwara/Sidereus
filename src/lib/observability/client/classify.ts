import { NAME_SHAPE, NETWORK_STEPS, type ClientStep } from "./steps";

/** Failures to reach the server: routine at a network step, where offline mode makes them the normal case. */
const ROUTINE_NAMES: ReadonlySet<string> = new Set(["TypeError", "AbortError", "TimeoutError"]);

/**
 * A thrown value's name when it has one and it looks like an identifier. Duck-typed on purpose: an error from another
 * realm is not an `instanceof Error`, and the route checks the shape again, since any client can send anything.
 */
export function errorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" && NAME_SHAPE.test(name) ? name : undefined;
}

/**
 * Whether a failure at `step` is the routine loss of the network and should not be reported (D14): only at a
 * `NETWORK_STEPS` step, and only for a `TypeError`, `AbortError` or `TimeoutError`. Cache and storage errors, a
 * `SyntaxError` and every name not listed are reported: unknown is not benign, and browsers name storage errors
 * differently, so the variance errs toward a notice, never toward silence. The tradeoff is accepted: a real code
 * `TypeError` at a network step goes unreported.
 */
export function isRoutineNetworkFault(step: ClientStep, error: unknown): boolean {
  if (!NETWORK_STEPS.includes(step)) {
    return false;
  }
  const name = errorName(error);
  return name !== undefined && ROUTINE_NAMES.has(name);
}
