import { describe, expect, it } from "vitest";

import { classifyFault, faultFrom, noRowsFault, StoreFault, withFault, type FaultKind } from "./fault";

/**
 * The fault carrier keeps `code` and `status` and nothing a database error could echo (a coordinate, an email), and
 * the classification is a pure table with server as the default: an unknown code is not benign.
 */

const COORDS = "52.2297,21.0122";
const EMAIL = "ada.lovelace@example.test";
const LEAK = /52\.2297|21\.0122|ada\.lovelace|example\.test/;

/** What supabase-js hands back for a failed request: the message, details and hint can all echo submitted values. */
function postgrestError(extra: Record<string, unknown> = {}) {
  return {
    name: "PostgrestError",
    message: `new row for relation "sites" violates check constraint, Failing row contains (${COORDS}, ${EMAIL})`,
    details: `Key (latitude_deg)=(${COORDS}) with ${EMAIL}`,
    hint: EMAIL,
    code: "XX000",
    ...extra,
  };
}

/** Every string a carrier can show: serialised, its own properties (stack included), its message and its cause. */
function everythingShown(fault: Error): string {
  const own = Object.getOwnPropertyNames(fault).map((key) =>
    String((fault as unknown as Record<string, unknown>)[key]),
  );
  return [JSON.stringify(fault), fault.message, String(fault.cause), String(fault), ...own].join("\n");
}

describe("classifyFault", () => {
  const TABLE: [string, { code?: string; status?: number }, FaultKind][] = [
    ["an invalid text representation (a malformed id)", { code: "22P02" }, "input"],
    ["a check violation", { code: "23514" }, "input"],
    ["a unique violation", { code: "23505" }, "input"],
    ["a foreign key violation", { code: "23503" }, "input"],
    ["another data exception", { code: "22003" }, "input"],
    ["an RLS denial", { code: "42501" }, "refused"],
    ["a bad JWT", { code: "PGRST301" }, "session"],
    ["an expired JWT", { code: "PGRST302" }, "session"],
    ["a JWT that cannot be verified", { code: "PGRST303" }, "session"],
    ["a result that is not one row", { code: "PGRST116" }, "no-rows"],
    ["a missing table (schema drift)", { code: "42P01" }, "server"],
    ["a missing column (schema drift)", { code: "42703" }, "server"],
    ["a connection exception", { code: "08006" }, "server"],
    ["insufficient resources", { code: "53300" }, "server"],
    ["an operator intervention", { code: "57014" }, "server"],
    ["a system error", { code: "58030" }, "server"],
    ["an internal error", { code: "XX000" }, "server"],
    ["PostgREST's unreachable database", { code: "PGRST000" }, "server"],
    ["PostgREST's schema cache failure", { code: "PGRST002" }, "server"],
    ["PostgREST's connection pool timeout", { code: "PGRST003" }, "server"],
    ["an unknown code", { code: "ZZZ99" }, "server"],
    ["no code at all (a network failure or a timeout)", {}, "server"],
    ["a 503 without a code", { status: 503 }, "server"],
    ["a 500 over a benign-looking code", { code: "42501", status: 500 }, "server"],
    ["a 4xx status without a code", { status: 404 }, "server"],
    ["a refusal with its 403 status", { code: "42501", status: 403 }, "refused"],
  ];

  it("classifies every code in the table, a carrier through its code and status", () => {
    expect(TABLE.length).toBeGreaterThanOrEqual(26);
    TABLE.forEach(([name, fault, kind], i) => {
      expect(classifyFault(fault), `case ${String(i)}: ${name} is ${kind}`).toBe(kind);
    });
    expect(classifyFault(faultFrom({ code: "42501" }))).toBe("refused");
    expect(classifyFault(faultFrom(new TypeError("fetch failed")))).toBe("server");
  });

  it("defaults to server for every code outside the four known classes", () => {
    const codes = ["P0001", "42883", "40001", "0A000", "3D000", "PGRST100", "PGRST204", "PGRST999", "x"];
    expect(codes).toHaveLength(9);
    for (const code of codes) {
      expect(classifyFault({ code }), code).toBe("server");
    }
  });

  it("matches the input classes on the whole code, not a prefix of an unrelated one", () => {
    expect(classifyFault({ code: "2200" })).toBe("server");
    expect(classifyFault({ code: "220000" })).toBe("server");
    expect(classifyFault({ code: "PGRST22" })).toBe("server");
  });
});

describe("faultFrom", () => {
  it("leaves no trace of the original message, details or hint anywhere on the carrier", () => {
    const fault = faultFrom(postgrestError({ status: 400 }));
    expect(everythingShown(fault)).not.toMatch(LEAK);
    expect(Object.keys(fault).sort()).toEqual(["code", "name", "status"]);
    expect(JSON.parse(JSON.stringify(fault))).toEqual({ name: "StoreFault", code: "XX000", status: 400 });
  });

  it("leaves no trace when the error is a real Error whose message and stack hold the values", () => {
    const error = Object.assign(new Error(`select where lat=${COORDS} and email=${EMAIL}`), { code: "42501" });
    error.stack = `Error: ${COORDS} ${EMAIL}\n    at /app/${EMAIL}.ts:1:1`;
    const fault = faultFrom(error);
    expect(fault.code).toBe("42501");
    expect(everythingShown(fault)).not.toMatch(LEAK);
  });

  it("is a StoreFault that reads code and status from the error before its cause, drops malformed ones and is empty for a non-object", () => {
    const fault = faultFrom(postgrestError({ status: 503 }));
    expect(fault).toBeInstanceOf(StoreFault);
    expect(fault).toBeInstanceOf(Error);
    expect(fault.cause).toBeUndefined();

    const keyed = faultFrom(
      new Error("errors.load.sites", { cause: new StoreFault({ code: "PGRST301", status: 401 }) }),
    );
    expect([keyed.code, keyed.status]).toEqual(["PGRST301", 401]);
    expect(everythingShown(keyed)).not.toContain("errors.load.sites");
    const own = Object.assign(new Error("m", { cause: { code: "PGRST301" } }), { code: "42501" });
    expect(faultFrom(own).code).toBe("42501");

    expect(faultFrom({ code: `see ${EMAIL}` }).code).toBeUndefined();
    expect(faultFrom({ code: "waytoolongforacode" }).code).toBeUndefined();
    expect(faultFrom({ code: 42501 }).code).toBeUndefined();
    for (const status of [99, 600, 503.5, Number.NaN, "503", null]) {
      expect(faultFrom({ code: "XX000", status }).status, String(status)).toBeUndefined();
    }
    expect(faultFrom({ status: 100 }).status).toBe(100);
    expect(faultFrom({ status: 599 }).status).toBe(599);

    for (const value of [undefined, null, "boom", 42, true, Symbol("s")]) {
      expect([faultFrom(value).code, faultFrom(value).status], typeof value).toEqual([undefined, undefined]);
    }
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error(EMAIL);
        },
      },
    );
    expect(everythingShown(faultFrom(hostile))).not.toMatch(LEAK);
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    expect(faultFrom(cyclic)).toBeInstanceOf(StoreFault);
  });
});

describe("withFault", () => {
  it("is empty for a user-input failure", () => {
    expect(withFault({ code: "22P02", message: COORDS })).toEqual({});
    expect(withFault({ code: "23514", message: COORDS })).toEqual({});
    expect(withFault({ code: "23505" })).toEqual({});
  });

  it("carries the kind, code and status of every other failure, and nothing else", () => {
    expect(withFault(postgrestError({ code: "42501", status: 403 }))).toEqual({
      fault: { kind: "refused", code: "42501", status: 403 },
    });
    expect(withFault(postgrestError({ code: "PGRST301" }))).toEqual({ fault: { kind: "session", code: "PGRST301" } });
    expect(withFault(postgrestError({ code: "XX000" }))).toEqual({ fault: { kind: "server", code: "XX000" } });
    expect(withFault(new TypeError("fetch failed"))).toEqual({ fault: { kind: "server" } });
    expect(JSON.stringify(withFault(postgrestError({ status: 503 })))).not.toMatch(LEAK);
    // A StoreFault, and the fault inside a keyed error's cause.
    expect(withFault(new StoreFault({ code: "PGRST116" }))).toEqual({ fault: { kind: "no-rows", code: "PGRST116" } });
    expect(withFault(new Error("errors.load.sites", { cause: new StoreFault({ code: "42501" }) }))).toEqual({
      fault: { kind: "refused", code: "42501" },
    });
    expect(noRowsFault()).toEqual({ kind: "no-rows" });
  });
});
