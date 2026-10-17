import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { ForecastError } from "@/lib/forecast/open-meteo";

import { AUTH_ERROR_CODES, FAILURE_STEPS, isLoggableCode, logFailure, logNotice } from "./log-failure";

/**
 * The helper is the one place the app writes a failure to the console, and what it may write is the privacy rule:
 * a step, a shaped name, a shaped code and a status, never a message, a stack or an Error object.
 */

// Text a real failure could carry: a coordinate pair and an email, in the message and in the stack.
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

/** An error whose message and stack both hold the coordinates and the email. */
function leakyError(options?: { cause?: unknown }): Error {
  const error = new Error(`select * from sites where lat=${COORDS} and email=${EMAIL}`, options);
  error.stack = `Error: ${COORDS} ${EMAIL}\n    at /app/src/${EMAIL}.ts:1:1`;
  return error;
}

/** The one line a logger call produced, as `[message, fields]`. */
function only(spy: MockInstance<typeof console.error> | MockInstance<typeof console.warn>): [string, unknown] {
  expect(spy).toHaveBeenCalledTimes(1);
  return spy.mock.calls[0] as [string, unknown];
}

describe("the line", () => {
  it("logFailure writes one error-level line with a fixed message and the step", () => {
    logFailure("forecast.fetch");
    expect(only(errors)).toEqual(["sidereus: forecast.fetch failed", { step: "forecast.fetch" }]);
    expect(warns).not.toHaveBeenCalled();
  });

  it("logNotice writes one warn-level line, worded as a notice, and never an error-level one", () => {
    logNotice("forecast.fetch", new RangeError("x"));
    expect(only(warns)).toEqual(["sidereus: forecast.fetch noted", { step: "forecast.fetch", name: "RangeError" }]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("keeps the same fields for both levels", () => {
    const error = Object.assign(new TypeError("m"), { code: "42501" });
    logFailure("tonight.plan-edits", error, { status: 503 });
    logNotice("tonight.plan-edits", error, { status: 503 });
    expect(only(errors)[1]).toEqual(only(warns)[1]);
    expect(only(errors)[1]).toEqual({ step: "tonight.plan-edits", name: "TypeError", code: "42501", status: 503 });
  });

  it("leaves absent fields out, never present as undefined", () => {
    logFailure("finder.chart", "a thrown string");
    const [, fields] = only(errors);
    expect(Object.keys(fields as object)).toEqual(["step"]);
  });
});

describe("what is never printed", () => {
  it("never prints a message or a stack, in the line or in any argument", () => {
    logFailure("tonight.sky-events", leakyError());
    logNotice("tonight.sky-events", leakyError({ cause: leakyError() }), { status: 500 });
    for (const call of [...errors.mock.calls, ...warns.mock.calls]) {
      expect(JSON.stringify(call)).not.toMatch(LEAK);
      expect(String(call[0])).not.toMatch(LEAK);
    }
  });

  it("never prints a message that sits on a non-Error value or in a cause's own properties", () => {
    logFailure("finder.stars", { message: `${COORDS} ${EMAIL}`, stack: COORDS, cause: { message: EMAIL } });
    logFailure("finder.stars", `${COORDS} ${EMAIL}`);
    logFailure("finder.stars", new Error("x", { cause: { code: "42501", message: COORDS, details: EMAIL } }));
    for (const call of errors.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(LEAK);
    }
  });

  it("never passes an Error (or anything but strings and numbers) to the console", () => {
    logFailure("account.plan", leakyError({ cause: leakyError() }));
    logNotice("account.plan", new TypeError(COORDS));
    for (const call of [...errors.mock.calls, ...warns.mock.calls]) {
      expect(call).toHaveLength(2);
      expect(typeof call[0]).toBe("string");
      expect(call.some((argument) => argument instanceof Error)).toBe(false);
      const fields = call[1] as Record<string, unknown>;
      expect(Object.getPrototypeOf(fields)).toBe(Object.prototype);
      for (const value of Object.values(fields)) {
        expect(["string", "number"]).toContain(typeof value);
      }
    }
  });
});

describe("name", () => {
  it("comes from the error when it is specific", () => {
    logFailure("finder.chart", new RangeError("boom"));
    expect(only(errors)[1]).toEqual({ step: "finder.chart", name: "RangeError" });
  });

  it("comes from the cause when the error has none of its own", () => {
    logFailure("tonight.plan-edits", { cause: new TypeError("secret") });
    expect(only(errors)[1]).toEqual({ step: "tonight.plan-edits", name: "TypeError" });
  });

  it("comes from the cause when the error is a plain Error wrapper around it", () => {
    logFailure("tonight.plan-edits", new Error("errors.load.sessionPlan", { cause: new TypeError("secret") }));
    expect(only(errors)[1]).toEqual({ step: "tonight.plan-edits", name: "TypeError" });
  });

  it("stays the error's own when a specific one wraps a different cause", () => {
    logFailure("finder.chart", new RangeError("m", { cause: new TypeError("c") }));
    expect(only(errors)[1]).toEqual({ step: "finder.chart", name: "RangeError" });
  });

  it("is Error for a bare Error", () => {
    logFailure("finder.chart", new Error(COORDS));
    expect(only(errors)[1]).toEqual({ step: "finder.chart", name: "Error" });
  });

  it("is dropped when it does not look like an identifier", () => {
    for (const name of [COORDS, EMAIL, "has space", "", "x".repeat(60), "1Starts", "a-b"]) {
      errors.mockClear();
      const error = new Error("m");
      error.name = name;
      logFailure("finder.chart", error);
      expect(only(errors)[1], JSON.stringify(name)).toEqual({ step: "finder.chart" });
    }
  });

  it("is never taken from a value that is not an Error", () => {
    logFailure("finder.chart", { name: "SiteName" });
    logFailure("finder.chart", "TypeError");
    logFailure("finder.chart", 42);
    logFailure("finder.chart", { cause: { name: "SiteName" } });
    for (const call of errors.mock.calls) {
      expect(call[1]).toEqual({ step: "finder.chart" });
    }
  });
});

describe("code", () => {
  it("passes through when it is a SQLSTATE, a PostgREST code, a forecast step or an auth-js code", () => {
    for (const code of ["42501", "PGRST301", "23505", "XX000", "request", "http", "parse", "schema", "bad_jwt"]) {
      errors.mockClear();
      logFailure("account.plan", Object.assign(new Error("m"), { code }));
      expect(only(errors)[1], code).toMatchObject({ code });
    }
  });

  it("comes from the cause when the error has none", () => {
    logFailure("tonight.plan-edits", new Error("errors.load.sessionPlan", { cause: { code: "42501" } }));
    expect(only(errors)[1]).toEqual({ step: "tonight.plan-edits", name: "Error", code: "42501" });
  });

  it("is prefered from the error over the cause", () => {
    logFailure("tonight.plan-edits", Object.assign(new Error("m", { cause: { code: "PGRST301" } }), { code: "42501" }));
    expect(only(errors)[1]).toMatchObject({ code: "42501" });
  });

  it("is dropped when it is not a closed shape, whatever it looks like (never a value that could be a name or a key)", () => {
    for (const code of [
      "M31",
      "NGC7000",
      "IC405",
      "NGC40",
      "IC342",
      "A",
      "abcdefghijkl", // 12 opaque characters
      "a3f9c2d71b04", // a site-id fragment
      "banana", // an unknown lowercase word
      "Request", // not a forecast step
      `permission denied at ${COORDS}`,
      COORDS,
      EMAIL,
      "ada",
      "",
      "1234567890123",
      "42 501",
      "42-501",
      "42501\n",
      "4250", // not five characters
      "425011",
      "pgrst301",
      "PGRST30",
      "PGRST3011",
    ]) {
      errors.mockClear();
      expect(isLoggableCode(code), JSON.stringify(code)).toBe(false);
      logFailure("account.plan", Object.assign(new Error("m"), { code }));
      expect(only(errors)[1], JSON.stringify(code)).not.toHaveProperty("code");
    }
  });

  it("is dropped when it is not a string", () => {
    for (const code of [42501, null, undefined, {}, ["42501"], true]) {
      errors.mockClear();
      expect(isLoggableCode(code)).toBe(false);
      logFailure("account.plan", Object.assign(new Error("m"), { code }));
      expect(only(errors)[1]).not.toHaveProperty("code");
    }
  });
});

describe("isLoggableCode: one accepted example of each closed class, and what it rejects", () => {
  const ACCEPTED: [string, string][] = [
    ["a SQLSTATE", "42501"],
    ["a SQLSTATE with letters", "XX000"],
    ["a SQLSTATE of a lettered class", "P0001"],
    ["a SQLSTATE of a lettered class", "HV00N"],
    ["a SQLSTATE of a lettered class", "F0000"],
    ["a SQLSTATE of class 22", "22P02"],
    ["a SQLSTATE of class 23", "23505"],
    ["a PostgREST code", "PGRST301"],
    ["a PostgREST code", "PGRST116"],
    ["the forecast step request", "request"],
    ["the forecast step http", "http"],
    ["the forecast step parse", "parse"],
    ["the forecast step schema", "schema"],
    ["an auth-js code", "over_request_rate_limit"],
    ["an auth-js code", "validation_failed"],
    ["an auth-js code", "refresh_token_not_found"],
    ["an auth-js code", "email_address_invalid"],
  ];
  const REJECTED: [string, string][] = [
    ["a Messier id", "M31"],
    ["a Caldwell id", "NGC7000"],
    ["a five-character Caldwell id (class I, not a SQLSTATE class)", "IC405"],
    ["a five-character Caldwell id", "NGC40"],
    ["a five-character Caldwell id", "IC342"],
    ["12 opaque characters", "a3f9c2d71b04"],
    ["an email-like string", "ada@example.test"],
    ["a coordinate-like string", "52.2297,21.0122"],
    ["an unknown lowercase word", "banana"],
    ["an unknown snake_case word", "some_new_code"],
    ["a single letter", "A"],
    ["a lowercase SQLSTATE shape", "xx000"],
  ];

  it.each(ACCEPTED)("accepts %s (%s)", (_class, code) => {
    expect(isLoggableCode(code)).toBe(true);
  });

  it.each(REJECTED)("rejects %s (%s)", (_class, code) => {
    expect(isLoggableCode(code)).toBe(false);
  });

  it("accepts the code of every ForecastError step, which is the step", () => {
    for (const step of ["request", "http", "parse", "schema"] as const) {
      expect(isLoggableCode(new ForecastError(step).code), step).toBe(true);
    }
  });

  it("keeps the auth-js allowlist to codes the installed library declares (the ErrorCode union in error-codes.d.ts)", () => {
    const require = createRequire(import.meta.url);
    const declared = readFileSync(
      require.resolve("@supabase/auth-js/package.json").replace("package.json", "dist/main/lib/error-codes.d.ts"),
      "utf8",
    );
    expect(AUTH_ERROR_CODES.length).toBeGreaterThan(80);
    expect(new Set(AUTH_ERROR_CODES).size).toBe(AUTH_ERROR_CODES.length);
    for (const code of AUTH_ERROR_CODES) {
      expect(declared, code).toContain(`'${code}'`);
    }
  });
});

describe("status", () => {
  it("is kept for an integer from 100 to 599", () => {
    for (const status of [100, 200, 404, 429, 503, 599]) {
      errors.mockClear();
      logFailure("forecast.fetch", undefined, { status });
      expect(only(errors)[1], String(status)).toEqual({ step: "forecast.fetch", status });
    }
  });

  it("is ignored outside that range, for a fraction, a non-number and a non-finite number", () => {
    for (const status of [99, 0, -1, 600, 1000, 503.5, Number.NaN, Infinity, "503", null, undefined, {}]) {
      errors.mockClear();
      logFailure("forecast.fetch", undefined, { status: status as number });
      expect(only(errors)[1], JSON.stringify(status)).toEqual({ step: "forecast.fetch" });
    }
  });

  it("is read from the extra argument only, never from the error", () => {
    logFailure("forecast.fetch", Object.assign(new Error("m"), { status: 503 }));
    expect(only(errors)[1]).not.toHaveProperty("status");
  });
});

describe("never throws", () => {
  const throwing = (property: string) =>
    new Proxy(new Error("m"), {
      get(target, key, receiver) {
        if (key === property) throw new Error(`getter ${property} threw ${COORDS}`);
        return Reflect.get(target, key, receiver) as unknown;
      },
    });

  it("for undefined, null, primitives, plain objects and functions", () => {
    for (const value of [undefined, null, "text", 42, true, Symbol("s"), 10n, {}, [], () => 1, Object.create(null)]) {
      expect(
        () => {
          logFailure("tonight.sky-events", value);
          logNotice("tonight.sky-events", value);
        },
        typeof value,
      ).not.toThrow();
    }
    expect(errors).toHaveBeenCalledTimes(11);
    expect(warns).toHaveBeenCalledTimes(11);
  });

  it("for getters that throw, on the error and on its cause", () => {
    for (const property of ["name", "code", "cause", "message", "stack"]) {
      expect(() => {
        logFailure("finder.chart", throwing(property));
      }, property).not.toThrow();
    }
    const hostileCause = Object.defineProperty({}, "code", {
      get() {
        throw new Error("code getter");
      },
    });
    expect(() => {
      logFailure("finder.chart", new Error("m", { cause: hostileCause }));
    }).not.toThrow();
    expect(errors).toHaveBeenCalledTimes(6);
    for (const call of errors.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(LEAK);
      expect((call[1] as { step: string }).step).toBe("finder.chart");
    }
  });

  it("for a throwing extra argument, still writing the line", () => {
    const extra = Object.defineProperty({}, "status", {
      get() {
        throw new Error("status getter");
      },
    });
    expect(() => {
      logFailure("forecast.fetch", new TypeError("m"), extra);
    }).not.toThrow();
    expect(only(errors)[1]).toEqual({ step: "forecast.fetch", name: "TypeError" });
  });

  it("for a cyclic cause and for a revoked proxy", () => {
    const a: { cause?: unknown } = {};
    a.cause = a;
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    expect(() => {
      logFailure("finder.stars", a);
      logFailure("finder.stars", proxy);
    }).not.toThrow();
    expect(errors).toHaveBeenCalledTimes(2);
  });

  it("when the console itself throws", () => {
    errors.mockImplementation(() => {
      throw new Error("console error broke");
    });
    warns.mockImplementation(() => {
      throw new Error("console warn broke");
    });
    expect(() => {
      logFailure("forecast.fetch", new Error("m"));
      logNotice("forecast.fetch", new Error("m"));
    }).not.toThrow();
  });
});

describe("FAILURE_STEPS", () => {
  it("has no step nothing emits: the milestone read and record are told apart by route", () => {
    expect(FAILURE_STEPS).not.toContain("milestones.read");
    expect(FAILURE_STEPS).not.toContain("milestones.record");
  });

  it("is a closed list of unique dotted words, including every step Phases 1, 3, 4 and 5 trace", () => {
    expect(new Set(FAILURE_STEPS).size).toBe(FAILURE_STEPS.length);
    for (const step of FAILURE_STEPS) {
      expect(step, step).toMatch(/^[a-z]+\.[a-z][a-z-]*$/);
    }
    expect(FAILURE_STEPS).toEqual(
      expect.arrayContaining([
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
        "finder.tonight",
      ]),
    );
  });
});
