import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { StoreFault } from "./fault";
import { logReadFailure } from "./read-failure";

/**
 * `logReadFailure` is the one call a page makes when a read behind a "could not load" banner throws: it classifies
 * the thrown store error through its `StoreFault` cause, like a save does. A session fault or an RLS refusal is a
 * warn-level notice (the user's session or request, never an Issue); anything else is an error-level failure.
 */

const COORDS = "52.2297,21.0122";
const EMAIL = "ada.lovelace@example.test";
const LEAK = /52\.2297|21\.0122|ada\.lovelace|example\.test/;

let errors: MockInstance<typeof console.error>;
let warns: MockInstance<typeof console.warn>;

beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  warns = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  errors.mockRestore();
  warns.mockRestore();
});

/** What a store read throws: its key as the message and a sanitized `StoreFault` as the cause. */
const thrownRead = (code?: string) => new Error("errors.load.observations", { cause: new StoreFault({ code }) });

describe("logReadFailure", () => {
  it("logs a server fault as one error-level line with the step, the cause's name and its code", () => {
    logReadFailure("read.log", thrownRead("08006"));
    expect(errors).toHaveBeenCalledExactlyOnceWith("sidereus: read.log failed", {
      step: "read.log",
      name: "StoreFault",
      code: "08006",
    });
    expect(warns).not.toHaveBeenCalled();
  });

  it("logs a read that failed with no code (a network failure or a timeout) as an error-level line", () => {
    logReadFailure("read.gear", thrownRead());
    expect(errors).toHaveBeenCalledExactlyOnceWith("sidereus: read.gear failed", {
      step: "read.gear",
      name: "StoreFault",
    });
    expect(warns).not.toHaveBeenCalled();
  });

  it("logs a thrown value that is not a store error (a RangeError) as a failure with its name", () => {
    logReadFailure("read.sky-checks", new RangeError("bad zone"));
    expect(errors).toHaveBeenCalledExactlyOnceWith("sidereus: read.sky-checks failed", {
      step: "read.sky-checks",
      name: "RangeError",
    });
  });

  it.each([
    ["an RLS refusal", "42501"],
    ["a bad JWT", "PGRST301"],
    ["an expired JWT", "PGRST302"],
    ["a JWT that cannot be verified", "PGRST303"],
  ])("logs %s (%s) as one warn-level notice, never an error line", (_label, code) => {
    logReadFailure("read.onboarding", thrownRead(code));
    expect(warns).toHaveBeenCalledExactlyOnceWith("sidereus: read.onboarding noted", {
      step: "read.onboarding",
      name: "StoreFault",
      code,
    });
    expect(errors).not.toHaveBeenCalled();
  });

  it.each(["XX000", "42P01", "PGRST000", "ZZZ99", "PGRST116", "22P02"])(
    "logs the code %s as an error-level failure",
    (code) => {
      logReadFailure("read.log", thrownRead(code));
      expect(errors).toHaveBeenCalledTimes(1);
      expect(warns).not.toHaveBeenCalled();
    },
  );

  it("reads the code of a StoreFault thrown directly, not only of its wrapper", () => {
    logReadFailure("read.gear", new StoreFault({ code: "42501" }));
    expect(warns).toHaveBeenCalledTimes(1);
    expect(errors).not.toHaveBeenCalled();
  });

  it("never prints a message, a stack or a value that sits in the error or its cause", () => {
    const leaky = new Error(`select where lat=${COORDS} and email=${EMAIL}`, {
      cause: Object.assign(new Error(`${COORDS} ${EMAIL}`), { code: "42501", details: EMAIL, hint: COORDS }),
    });
    leaky.stack = `Error: ${COORDS} ${EMAIL}\n    at /app/${EMAIL}.ts:1:1`;
    logReadFailure("read.log", leaky);
    logReadFailure("read.log", new Error(EMAIL, { cause: { code: "08006", message: COORDS } }));
    expect(JSON.stringify([...errors.mock.calls, ...warns.mock.calls])).not.toMatch(LEAK);
    for (const call of [...errors.mock.calls, ...warns.mock.calls]) {
      expect(call).toHaveLength(2);
      expect(call.some((argument) => argument instanceof Error)).toBe(false);
    }
  });

  it("never throws, whatever it is given", () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error(EMAIL);
        },
      },
    );
    for (const value of [undefined, null, "boom", 42, {}, [], hostile]) {
      expect(
        () => {
          logReadFailure("read.log", value);
        },
        typeof value,
      ).not.toThrow();
    }
    expect(errors).toHaveBeenCalledTimes(7);
  });
});
