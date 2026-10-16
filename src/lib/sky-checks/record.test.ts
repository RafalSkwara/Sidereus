import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import type { TypedSupabaseClient } from "@/lib/supabase";
import { recordableVerdict, recordSkyVerdict } from "./record";

const DARK_START = new Date("2026-10-10T18:20:00Z");

describe("recordableVerdict", () => {
  it("records nothing without a view", () => {
    expect(recordableVerdict(null)).toBeNull();
  });

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

  it("records nothing without a dark-window start, whatever the headline", () => {
    expect(
      recordableVerdict({
        siteId: "site-1",
        date: "2026-10-10",
        headline: { id: "go", key: "verdict.level.go", text: "Clear" },
        darkStart: null,
      }),
    ).toBeNull();
  });

  it("never records a no-dark-window headline, even if a start were present", () => {
    expect(
      recordableVerdict({
        siteId: "site-1",
        date: "2026-06-21",
        headline: { id: "noDarkness", key: "tonight.card.noDarkWindow", text: "No dark window" },
        darkStart: DARK_START,
      }),
    ).toBeNull();
  });

  it("records the site, night, headline id and dark-window start of a normal night", () => {
    expect(
      recordableVerdict({
        siteId: "site-1",
        date: "2026-10-10",
        headline: { id: "humidityCap", key: "verdict.sky.humidityCap", text: "Clear, but damp" },
        darkStart: DARK_START,
      }),
    ).toEqual({ siteId: "site-1", night: "2026-10-10", headline: "humidityCap", darkStart: DARK_START });
  });

  it("records a night with no forecast, which the check later leaves out", () => {
    expect(
      recordableVerdict({
        siteId: "site-1",
        date: "2026-10-10",
        headline: { id: "noForecast", key: "verdict.sky.noForecast", text: "No forecast" },
        darkStart: DARK_START,
      }),
    ).toMatchObject({ headline: "noForecast" });
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

  it("logs nothing when the record is stored", async () => {
    await expect(recordSkyVerdict(fakeClient({}), INPUT)).resolves.toBeUndefined();
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
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

  it("logs a fault with no code (a network failure) as an error line with the step only", async () => {
    await recordSkyVerdict(fakeClient({ error: { message: `fetch failed for ${LEAK.source}` } }), INPUT);
    expect(errors).toHaveBeenCalledWith("sidereus: tonight.sky-check-record failed", {
      step: "tonight.sky-check-record",
    });
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

  it("logs a rejection with the error's name only, and never rejects itself", async () => {
    const client = {
      rpc: () => Promise.reject(new RangeError("rpc failed for 52.2297,21.0122")),
    } as unknown as TypedSupabaseClient;
    await expect(recordSkyVerdict(client, INPUT)).resolves.toBeUndefined();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("sidereus: tonight.sky-check-record failed", {
      step: "tonight.sky-check-record",
      name: "RangeError",
    });
    expect(JSON.stringify(errors.mock.calls)).not.toMatch(LEAK);
  });
});
