import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { ForecastError } from "@/lib/forecast/open-meteo";

import { AUTH_ERROR_CODES, FAILURE_STEPS, isLoggableCode, logFailure, logNotice, requestRoute } from "./log-failure";

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
  it("writes one fixed-message line per level with the step, the same fields for both, and no absent field", () => {
    logFailure("forecast.fetch");
    expect(only(errors)).toEqual(["sidereus: forecast.fetch failed", { step: "forecast.fetch" }]);
    expect(warns).not.toHaveBeenCalled();
    errors.mockClear();

    logNotice("forecast.fetch", new RangeError("x"));
    expect(only(warns)).toEqual(["sidereus: forecast.fetch noted", { step: "forecast.fetch", name: "RangeError" }]);
    expect(errors).not.toHaveBeenCalled();
    warns.mockClear();

    const error = Object.assign(new TypeError("m"), { code: "42501" });
    logFailure("tonight.plan-edits", error, { status: 503 });
    logNotice("tonight.plan-edits", error, { status: 503 });
    expect(only(errors)[1]).toEqual(only(warns)[1]);
    expect(only(errors)[1]).toEqual({ step: "tonight.plan-edits", name: "TypeError", code: "42501", status: 503 });
    errors.mockClear();

    logFailure("finder.chart", "a thrown string");
    expect(Object.keys(only(errors)[1] as object)).toEqual(["step"]);
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
  it("comes from a specific error, else from its cause (own or behind a plain Error wrapper), else is Error; never from a non-Error", () => {
    const cases: [string, unknown, string | undefined][] = [
      ["a specific error", new RangeError("boom"), "RangeError"],
      ["an error with only a cause", { cause: new TypeError("secret") }, "TypeError"],
      [
        "a plain Error wrapping a cause",
        new Error("errors.load.sessionPlan", { cause: new TypeError("secret") }),
        "TypeError",
      ],
      ["a specific error over a different cause", new RangeError("m", { cause: new TypeError("c") }), "RangeError"],
      ["a bare Error", new Error(COORDS), "Error"],
      ["a plain object with a name", { name: "SiteName" }, undefined],
      ["a string", "TypeError", undefined],
      ["a number", 42, undefined],
      ["a plain cause with a name", { cause: { name: "SiteName" } }, undefined],
    ];
    expect(cases.length).toBeGreaterThanOrEqual(9);
    for (const [label, value, name] of cases) {
      errors.mockClear();
      logFailure("finder.chart", value);
      expect(only(errors)[1], label).toEqual(
        name === undefined ? { step: "finder.chart" } : { step: "finder.chart", name },
      );
    }
  });

  it("is dropped when it does not look like an identifier", () => {
    const names = [COORDS, EMAIL, "has space", "", "x".repeat(60), "1Starts", "a-b"];
    expect(names).toHaveLength(7);
    for (const name of names) {
      errors.mockClear();
      const error = new Error("m");
      error.name = name;
      logFailure("finder.chart", error);
      expect(only(errors)[1], JSON.stringify(name)).toEqual({ step: "finder.chart" });
    }
  });
});

describe("code", () => {
  it("passes through when it is a closed shape (SQLSTATE, PostgREST, forecast step, auth-js), from the error before its cause", () => {
    // isLoggableCode accepts one example of each closed class, and the code of every ForecastError step.
    const accepted = [
      "42501", // a SQLSTATE
      "XX000", // with letters
      "P0001",
      "HV00N",
      "F0000",
      "22P02",
      "23505",
      "PGRST301", // a PostgREST code
      "PGRST116",
      "request", // the forecast steps
      "http",
      "parse",
      "schema",
      "over_request_rate_limit", // an auth-js code
      "validation_failed",
      "refresh_token_not_found",
      "email_address_invalid",
      "bad_jwt",
    ];
    expect(accepted).toHaveLength(18);
    for (const code of accepted) {
      errors.mockClear();
      expect(isLoggableCode(code), code).toBe(true);
      logFailure("account.plan", Object.assign(new Error("m"), { code }));
      expect(only(errors)[1], code).toMatchObject({ code });
    }
    for (const step of ["request", "http", "parse", "schema"] as const) {
      expect(isLoggableCode(new ForecastError(step).code), step).toBe(true);
    }

    errors.mockClear();
    logFailure("tonight.plan-edits", new Error("errors.load.sessionPlan", { cause: { code: "42501" } }));
    expect(only(errors)[1]).toEqual({ step: "tonight.plan-edits", name: "Error", code: "42501" });
    errors.mockClear();
    logFailure("tonight.plan-edits", Object.assign(new Error("m", { cause: { code: "PGRST301" } }), { code: "42501" }));
    expect(only(errors)[1]).toMatchObject({ code: "42501" });

    // The auth-js allowlist holds only codes the installed library declares (the ErrorCode union in error-codes.d.ts).
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

  it("is dropped when it is not a closed shape, whatever it looks like, or not a string (never a value that could be a name or a key)", () => {
    const rejected: unknown[] = [
      "M31", // catalogue ids
      "NGC7000",
      "IC405", // five characters, class I is not a SQLSTATE class
      "NGC40",
      "IC342",
      "A",
      "abcdefghijkl", // 12 opaque characters
      "a3f9c2d71b04", // a site-id fragment
      "banana", // an unknown lowercase word
      "some_new_code", // an unknown snake_case word
      "Request", // not a forecast step
      `permission denied at ${COORDS}`,
      COORDS,
      EMAIL,
      "ada@example.test",
      "ada",
      "",
      "1234567890123",
      "42 501",
      "42-501",
      "42501\n",
      "4250", // not five characters
      "425011",
      "xx000", // a lowercase SQLSTATE shape
      "pgrst301",
      "PGRST30",
      "PGRST3011",
      42501, // not strings
      null,
      undefined,
      {},
      ["42501"],
      true,
    ];
    expect(rejected).toHaveLength(33);
    rejected.forEach((code, i) => {
      errors.mockClear();
      const label = `case ${String(i)}: ${JSON.stringify(code)}`;
      expect(isLoggableCode(code), label).toBe(false);
      logFailure("account.plan", Object.assign(new Error("m"), { code }));
      expect(only(errors)[1], label).not.toHaveProperty("code");
    });
  });
});

describe("status", () => {
  it("is kept for an integer from 100 to 599, ignored outside it, and read from the extra argument only", () => {
    for (const status of [100, 200, 404, 429, 503, 599]) {
      errors.mockClear();
      logFailure("forecast.fetch", undefined, { status });
      expect(only(errors)[1], String(status)).toEqual({ step: "forecast.fetch", status });
    }
    for (const status of [99, 0, -1, 600, 1000, 503.5, Number.NaN, Infinity, "503", null, undefined, {}]) {
      errors.mockClear();
      logFailure("forecast.fetch", undefined, { status: status as number });
      expect(only(errors)[1], JSON.stringify(status)).toEqual({ step: "forecast.fetch" });
    }
    errors.mockClear();
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

  it("for any value: primitives, functions, throwing getters, a hostile cause or extra, a cyclic cause, a revoked proxy", () => {
    const hostileCause = Object.defineProperty({}, "code", {
      get() {
        throw new Error("code getter");
      },
    });
    const hostileExtra = Object.defineProperty({}, "status", {
      get() {
        throw new Error("status getter");
      },
    });
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    const values: unknown[] = [
      undefined,
      null,
      "text",
      42,
      true,
      Symbol("s"),
      10n,
      {},
      [],
      () => 1,
      Object.create(null),
      ...["name", "code", "cause", "message", "stack"].map(throwing),
      new Error("m", { cause: hostileCause }),
      cyclic,
      proxy,
    ];
    expect(values).toHaveLength(19);
    values.forEach((value, i) => {
      expect(
        () => {
          logFailure("finder.chart", value);
          logNotice("finder.chart", value);
        },
        `case ${String(i)}`,
      ).not.toThrow();
    });
    expect(errors).toHaveBeenCalledTimes(values.length);
    expect(warns).toHaveBeenCalledTimes(values.length);
    for (const call of [...errors.mock.calls, ...warns.mock.calls]) {
      expect(JSON.stringify(call)).not.toMatch(LEAK);
      expect((call[1] as { step: string }).step).toBe("finder.chart");
    }

    // A throwing extra argument still writes the line.
    errors.mockClear();
    expect(() => {
      logFailure("forecast.fetch", new TypeError("m"), hostileExtra);
    }).not.toThrow();
    expect(only(errors)[1]).toEqual({ step: "forecast.fetch", name: "TypeError" });
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
  it("is a closed list of unique dotted words, including every step Phases 1, 3, 4 and 5 trace and none that nothing emits", () => {
    expect(FAILURE_STEPS).not.toContain("milestones.read");
    expect(FAILURE_STEPS).not.toContain("milestones.record");
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
        "request.stream",
        "request.uncaught",
      ]),
    );
  });
});

describe("route", () => {
  const routeOf = (route: unknown) => {
    errors.mockClear();
    logFailure("request.stream", undefined, { route: route as string });
    return (only(errors)[1] as { route?: string }).route;
  };

  it("keeps only a template: a pathname with a uuid, a number, coordinates, a dot or a query, or an over-long value, never reaches a line", () => {
    expect(routeOf("/tonight/targets")).toBe("/tonight/targets");
    expect(routeOf("/log/[id]")).toBe("/log/[id]");
    expect(routeOf("/[...slug]")).toBe("/[...slug]");
    expect(routeOf("/_server-islands/Island2")).toBe("/_server-islands/Island2");
    expect(routeOf("/log/Island2")).toBeUndefined();
    const dropped = [
      "/log/123e4567-e89b-12d3-a456-426614174000",
      "/52.2297/21.0122",
      "/tonight/targets?site=3f2b",
      "/tonight?x=1",
      "/log/42",
      `/${"a".repeat(80)}`,
      "tonight",
      "",
      42,
      null,
      {},
    ];
    for (const value of dropped) {
      expect(routeOf(value), JSON.stringify(value)).toBeUndefined();
    }
    expect(errors.mock.calls.flat().join("")).not.toMatch(/123e4567|52\.2297|21\.0122/);
  });

  it("keeps the two error-page templates /404 and /500 by name, and no other number", () => {
    expect(routeOf("/404")).toBe("/404");
    expect(routeOf("/500")).toBe("/500");
    for (const value of ["/403", "/4040", "/50", "/404/x", "/log/404", "/500?x=1"]) {
      expect(routeOf(value), JSON.stringify(value)).toBeUndefined();
    }
    expect(requestRoute("/404", {})).toBe("/404");
    expect(requestRoute("/500", {})).toBe("/500");
  });
});

describe("requestRoute", () => {
  it("returns a template pattern, substitutes a server island's identifier name, and gives nothing for anything else", () => {
    expect(requestRoute("/tonight/[page]", { page: "targets" })).toBe("/tonight/[page]");
    expect(requestRoute("/_server-islands/[name]", { name: "TonightContent" })).toBe("/_server-islands/TonightContent");
    expect(requestRoute("/_server-islands/[name]", { name: "Island2" })).toBe("/_server-islands/Island2");
    for (const params of [{ name: "52.2297,21.0122" }, { name: "../x" }, { name: 7 }, {}, undefined, null]) {
      expect(requestRoute("/_server-islands/[name]", params), JSON.stringify(params)).toBe("/_server-islands/[name]");
    }
    expect(requestRoute(undefined, { name: "x" })).toBeUndefined();
    expect(requestRoute("/log/123e4567-e89b-12d3-a456-426614174000", {})).toBeUndefined();
    expect(requestRoute("/52.2297/21.0122", {})).toBeUndefined();
  });
});
