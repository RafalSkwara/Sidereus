import { beforeEach, describe, expect, it, vi } from "vitest";

import { memoryCache } from "@/lib/forecast/test-helpers";
import type { EyepieceRecord, SiteRecord, TelescopeRecord } from "@/lib/gear/store";
import type { TypedSupabaseClient } from "@/lib/supabase";

import { loadTonight, type PlanEditsReader } from "./load";
import { EYEPIECES, NOW, TELESCOPE, WARSAW } from "./test-fixtures";
import { tonightDateForSite } from "./tonight-date";

/**
 * The loader never turns a forecast problem into an error page (PRD guardrail "forecast outage degrades, never
 * blanks … neither case produces an error page"). Only the database reads are replaced (list stubs) and the build is
 * wrapped so one case can make it throw; the forecast service, the verdict and the engine run for real.
 */

const mocks = vi.hoisted(() => ({
  listSites: vi.fn<() => Promise<SiteRecord[]>>(),
  listTelescopes: vi.fn<() => Promise<TelescopeRecord[]>>(),
  listEyepieces: vi.fn<() => Promise<EyepieceRecord[]>>(),
  listLog: vi.fn<() => Promise<[]>>(),
  buildTonight: vi.fn<typeof import("./build").buildTonight>(),
}));

// build.ts and tonight-date.ts import `toEngineSite` from the store module, so the real module is spread back in.
vi.mock("@/lib/gear/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gear/store")>();
  return {
    ...actual,
    siteStore: { list: mocks.listSites },
    telescopeStore: { list: mocks.listTelescopes },
    eyepieceStore: { list: mocks.listEyepieces },
  };
});

vi.mock("@/lib/observations/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/observations/store")>();
  return { ...actual, observationStore: { listSeenEntries: mocks.listLog } };
});

// The real build unless a case says otherwise.
vi.mock("@/lib/tonight/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./build")>();
  mocks.buildTonight.mockImplementation(actual.buildTonight);
  return { ...actual, buildTonight: mocks.buildTonight };
});

/** Never called: the stores are stubbed, so any non-null client will do. */
const SUPABASE = {} as TypedSupabaseClient;

/** The forecast provider is unreachable. */
const failingFetch: typeof fetch = () => Promise.reject(new TypeError("fetch failed"));

const noDefer = (_task: Promise<void>): void => undefined;

function load(overrides: Partial<Parameters<typeof loadTonight>[0]> = {}) {
  return loadTonight({
    supabase: SUPABASE,
    locale: "en",
    now: NOW,
    cache: memoryCache(),
    defer: noDefer,
    fetchFn: failingFetch,
    ...overrides,
  });
}

beforeEach(async () => {
  // Each case starts on the real build with no calls recorded and no once-implementation left over from another.
  const actual = await vi.importActual<typeof import("./build")>("./build");
  mocks.buildTonight.mockReset();
  mocks.buildTonight.mockImplementation(actual.buildTonight);
  mocks.listSites.mockResolvedValue([WARSAW]);
  mocks.listTelescopes.mockResolvedValue([TELESCOPE]);
  mocks.listEyepieces.mockResolvedValue(EYEPIECES);
  mocks.listLog.mockResolvedValue([]);
});

describe("loadTonight", () => {
  it("still builds Tonight in a forecast outage with nothing stored, as No forecast", async () => {
    const result = await load();
    expect(mocks.buildTonight).toHaveBeenCalledTimes(1);
    expect(result.tonightError).toBeNull();
    expect(result.view).not.toBeNull();
    expect(result.view?.headline.id).toBe("noForecast");
  });

  it("tells the build whether the log loaded, so a failed read marks nothing not seen yet", async () => {
    await load();
    expect(mocks.buildTonight.mock.calls[0][0]).toMatchObject({ logKnown: true });

    mocks.buildTonight.mockClear();
    mocks.listLog.mockRejectedValueOnce(new Error("log failed"));
    const result = await load();
    expect(result.logError).toBe("tonight.logFailed");
    expect(mocks.buildTonight.mock.calls[0][0]).toMatchObject({ log: [], logKnown: false });
    expect(result.view?.ranking?.entries.length).toBeGreaterThan(0);
    expect(result.view?.ranking?.entries.every((entry) => !entry.notSeenYet)).toBe(true);
  });

  it("degrades a failing build to the tonight.failed notice, keeping the gear lists", async () => {
    mocks.buildTonight.mockImplementationOnce(() => {
      throw new Error("build failed");
    });
    const result = await load();
    expect(mocks.buildTonight).toHaveBeenCalledTimes(1);
    expect(result.view).toBeNull();
    expect(result.tonightError).toBe("tonight.failed");
    expect(result.sites).toEqual([WARSAW]);
    expect(result.telescopes).toEqual([TELESCOPE]);
  });
});

describe("loadTonight's saved Session plan (adjustable-session-plan)", () => {
  it("reads nothing, and passes no list, without a reader", async () => {
    const result = await load({ withSessionPlan: true });
    expect(mocks.buildTonight.mock.calls[0][2]).toMatchObject({ planEdits: null });
    expect(result.planEditsError).toBeNull();
    expect(result.view?.sessionPlan?.edited).toBe(false);
  });

  it("reads the saved list for tonight's site and night, and hands it to the build", async () => {
    const readPlanEdits = vi.fn<PlanEditsReader>().mockResolvedValue(["M31", "M13"]);
    const result = await load({ withSessionPlan: true, withPlanCandidates: true, readPlanEdits });
    expect(readPlanEdits).toHaveBeenCalledTimes(1);
    expect(readPlanEdits).toHaveBeenCalledWith(WARSAW.id, "2026-10-10");
    expect(mocks.buildTonight.mock.calls[0][2]).toMatchObject({
      planEdits: ["M31", "M13"],
      withPlanCandidates: true,
      nightDate: "2026-10-10",
    });
    expect(result.planEditsError).toBeNull();
    expect(result.view?.sessionPlan?.rows.map((row) => row.key)).toEqual(["M31", "M13"]);
    expect(result.view?.sessionPlan?.edited).toBe(true);
  });

  it("never calls the reader for the evening after tonight", async () => {
    const readPlanEdits = vi.fn<PlanEditsReader>().mockResolvedValue(["M31"]);
    const result = await load({ withSessionPlan: true, night: "next", readPlanEdits });
    expect(readPlanEdits).not.toHaveBeenCalled();
    expect(mocks.buildTonight.mock.calls[0][2]).toMatchObject({
      night: "next",
      nightDate: "2026-10-11",
      planEdits: null,
    });
    expect(result.view?.date).toBe("2026-10-11");
    expect(result.view?.sessionPlan?.edited).toBe(false);
  });

  it("never calls the reader without a site and a telescope to build for", async () => {
    mocks.listTelescopes.mockResolvedValue([]);
    const readPlanEdits = vi.fn<PlanEditsReader>().mockResolvedValue(null);
    const result = await load({ withSessionPlan: true, readPlanEdits });
    expect(readPlanEdits).not.toHaveBeenCalled();
    expect(result.view).toBeNull();
  });

  it("names one night for the reader and the build, before and after civil dawn", async () => {
    // 04:00 local: the night in progress (the 9th) is still tonight. 10:00 local: the evening ahead (the 10th).
    for (const [now, night] of [
      ["2026-10-10T02:00:00Z", "2026-10-09"],
      ["2026-10-10T08:00:00Z", "2026-10-10"],
    ] as const) {
      mocks.buildTonight.mockClear();
      const readPlanEdits = vi.fn<PlanEditsReader>().mockResolvedValue(null);
      const result = await load({ now: new Date(now), withSessionPlan: true, readPlanEdits });
      expect(readPlanEdits).toHaveBeenCalledWith(WARSAW.id, night);
      expect(mocks.buildTonight.mock.calls[0][2]).toMatchObject({ nightDate: night });
      expect(result.view?.date).toBe(night);
      // The hook's night is the one the site's own rule gives, which the save route compares against.
      expect(tonightDateForSite(WARSAW, new Date(now))).toBe(night);
    }
  });

  it("starts the read before the forecast is asked for, so the two overlap", async () => {
    const events: string[] = [];
    const readPlanEdits = vi.fn<PlanEditsReader>().mockImplementation(() => {
      events.push("edits");
      return Promise.resolve(null);
    });
    const fetchFn: typeof fetch = () => {
      events.push("forecast");
      return Promise.reject(new TypeError("fetch failed"));
    };
    await load({ readPlanEdits, fetchFn });
    expect(events[0]).toBe("edits");
    expect(events).toContain("forecast");
  });

  it("keeps the suggested plan, with a fixed notice key, when the read fails", async () => {
    const readPlanEdits = vi.fn<PlanEditsReader>().mockRejectedValue(new Error("errors.load.sessionPlan"));
    const result = await load({ withSessionPlan: true, readPlanEdits });
    expect(result.planEditsError).toBe("errors.load.sessionPlan");
    expect(result.tonightError).toBeNull();
    expect(mocks.buildTonight.mock.calls[0][2]).toMatchObject({ planEdits: null });
    expect(result.view?.sessionPlan?.edited).toBe(false);
    expect(result.view?.sessionPlan?.rows.length).toBeGreaterThan(0);
  });

  it("logs one fixed line with the cause's code when the read fails, never its message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const cause = Object.assign(new Error("permission denied for table session_plans at 52.2297,21.0122"), {
        code: "42501",
      });
      const readPlanEdits = vi.fn<PlanEditsReader>().mockRejectedValue(new Error("errors.load.sessionPlan", { cause }));
      const result = await load({ withSessionPlan: true, readPlanEdits });
      expect(result.planEditsError).toBe("errors.load.sessionPlan");
      const lines = log.mock.calls.filter(([line]) => String(line).startsWith("sidereus: tonight.plan-edits"));
      expect(lines).toEqual([
        ["sidereus: tonight.plan-edits failed", { step: "tonight.plan-edits", name: "Error", code: "42501" }],
      ]);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/permission denied|session_plans|52\.2297|errors\.load/);
    } finally {
      log.mockRestore();
    }
  });

  it("names the error when the cause has no code, and logs nothing when the read succeeds", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const readPlanEdits = vi
        .fn<PlanEditsReader>()
        .mockRejectedValue(new Error("errors.load.sessionPlan", { cause: new TypeError("secret value M31") }));
      await load({ withSessionPlan: true, readPlanEdits });
      // The unreachable forecast (failingFetch) also leaves its own `forecast.fetch` line; only the plan-edits ones count here.
      const planLines = () =>
        log.mock.calls.filter(([line]) => String(line).startsWith("sidereus: tonight.plan-edits"));
      expect(planLines()).toEqual([
        ["sidereus: tonight.plan-edits failed", { step: "tonight.plan-edits", name: "TypeError" }],
      ]);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|M31/);

      log.mockClear();
      await load({ withSessionPlan: true, readPlanEdits: vi.fn<PlanEditsReader>().mockResolvedValue(["M31"]) });
      expect(planLines()).toEqual([]);
    } finally {
      log.mockRestore();
    }
  });

  it("leaves no unhandled rejection when the build fails while the read is in flight", async () => {
    mocks.buildTonight.mockImplementationOnce(() => {
      throw new Error("build failed");
    });
    const readPlanEdits = vi.fn<PlanEditsReader>().mockRejectedValue(new Error("read failed"));
    const result = await load({ readPlanEdits });
    expect(result.tonightError).toBe("tonight.failed");
    expect(result.view).toBeNull();
  });
});
