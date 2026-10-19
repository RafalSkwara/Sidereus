import { describe, expect, it } from "vitest";

import { isRoutineNetworkFault } from "./classify";
import { CLIENT_STEPS, NETWORK_STEPS } from "./steps";

/**
 * D14: at a step whose guarded operation is a network `fetch`, a failure to reach the server is the normal case in the
 * field and is not reported; every other failure there, and every failure at any other step, is. Unknown is never benign.
 */

function named(name: string): Error {
  const error = new Error("m");
  error.name = name;
  return error;
}

describe("isRoutineNetworkFault", () => {
  it("drops a TypeError, AbortError or TimeoutError at a network step only, and reports everything else", () => {
    expect(NETWORK_STEPS.length).toBeGreaterThan(0);
    const networkStep = NETWORK_STEPS[0];
    const otherStep = CLIENT_STEPS.find((step) => !NETWORK_STEPS.includes(step));
    expect(otherStep).toBeDefined();
    if (otherStep === undefined) return;

    const routine = ["TypeError", "AbortError", "TimeoutError"];
    const reported = [
      "QuotaExceededError",
      "InvalidStateError",
      "UnknownError",
      "NotFoundError",
      "SyntaxError",
      "NewName",
    ];
    for (const name of routine) {
      expect(isRoutineNetworkFault(networkStep, named(name)), `${name} at ${networkStep}`).toBe(true);
      expect(isRoutineNetworkFault(otherStep, named(name)), `${name} at ${otherStep}`).toBe(false);
    }
    for (const name of reported) {
      expect(isRoutineNetworkFault(networkStep, named(name)), `${name} at ${networkStep}`).toBe(false);
    }
    // A thrown value that is not an error has no name, and unknown is reported.
    for (const value of ["TypeError", null, undefined, 42, {}]) {
      expect(isRoutineNetworkFault(networkStep, value), JSON.stringify(value)).toBe(false);
    }
  });

  it("only ever names sw.* steps as network steps", () => {
    for (const step of NETWORK_STEPS) {
      expect(step).toMatch(/^sw\./);
      expect(CLIENT_STEPS).toContain(step);
    }
  });
});
