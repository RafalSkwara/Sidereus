import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { fakeClient, gatewayError, leakyPostgrestError, LEAK, transportError } from "@/lib/test-support/supabase-fake";
import { recordableVerdict, recordSkyVerdict } from "./record";

const DARK_START = new Date("2026-10-10T18:20:00Z");

describe("recordableVerdict", () => {
  it("records nothing on a night with no dark window", () => {
    expect(
      recordableVerdict({
        siteId: "site-1",
        date: "2026-06-21",
        headline: { id: "noDarkness", key: "tonight.card.noDarkWindow", text: "No dark window" },
        darkStart: null,
      }),
    ).toBeNull();
  });
});

describe("recordSkyVerdict (error-visibility)", () => {
  const INPUT = { siteId: "site-1", night: "2026-10-10", headline: "go" as const, darkStart: DARK_START };
  let errors: MockInstance<typeof console.error>;
  let warnings: MockInstance<typeof console.warn>;

  beforeEach(() => {
    errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errors.mockRestore();
    warnings.mockRestore();
  });

  it("logs a server fault as one error line with its code only", async () => {
    await recordSkyVerdict(fakeClient({ error: leakyPostgrestError("XX000") }), INPUT);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("sidereus: tonight.sky-check-record failed", {
      step: "tonight.sky-check-record",
      code: "XX000",
    });
    expect(warnings).not.toHaveBeenCalled();
    expect(JSON.stringify([...errors.mock.calls, ...warnings.mock.calls])).not.toMatch(LEAK);
  });

  it("logs a request that never completed (a timeout, a dropped connection) as an error with the code `request`", async () => {
    await recordSkyVerdict(fakeClient({ error: transportError(), status: 0 }), INPUT);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("sidereus: tonight.sky-check-record failed", {
      step: "tonight.sky-check-record",
      code: "request",
    });
    expect(warnings).not.toHaveBeenCalled();
    expect(JSON.stringify([...errors.mock.calls, ...warnings.mock.calls])).not.toMatch(LEAK);
  });

  it("logs a gateway answer with a status and no PostgREST code (a 502 with an HTML body) as an error with `http` and its status", async () => {
    await recordSkyVerdict(fakeClient({ error: gatewayError(), status: 502 }), INPUT);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("sidereus: tonight.sky-check-record failed", {
      step: "tonight.sky-check-record",
      code: "http",
      status: 502,
    });
    expect(warnings).not.toHaveBeenCalled();
    expect(JSON.stringify([...errors.mock.calls, ...warnings.mock.calls])).not.toMatch(LEAK);
  });

  it("logs a class 22 or 23 code as an error with that code: the RPC's arguments are built by the server, so it is our bug", async () => {
    for (const code of ["23514", "22P02"]) {
      errors.mockClear();
      await recordSkyVerdict(fakeClient({ error: leakyPostgrestError(code) }), INPUT);
      expect(errors, code).toHaveBeenCalledTimes(1);
      expect(errors, code).toHaveBeenCalledWith("sidereus: tonight.sky-check-record failed", {
        step: "tonight.sky-check-record",
        code,
      });
    }
    expect(warnings).not.toHaveBeenCalled();
    expect(JSON.stringify(errors.mock.calls)).not.toMatch(LEAK);
  });

  it("logs a refusal or a stale session as a warn-level notice, never an error", async () => {
    for (const code of ["42501", "PGRST301"]) {
      warnings.mockClear();
      await recordSkyVerdict(fakeClient({ error: leakyPostgrestError(code) }), INPUT);
      expect(warnings).toHaveBeenCalledTimes(1);
      expect(warnings).toHaveBeenCalledWith("sidereus: tonight.sky-check-record noted", {
        step: "tonight.sky-check-record",
        code,
      });
    }
    expect(errors).not.toHaveBeenCalled();
  });
});
