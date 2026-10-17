import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { memoryCache } from "@/lib/forecast/test-helpers";
import type { EyepieceRecord, SiteRecord, TelescopeRecord } from "@/lib/gear/store";
import type { TypedSupabaseClient } from "@/lib/supabase";

import { skyCheckStore } from "@/lib/sky-checks/store";

import { loadTonight, type PlanEditsReader } from "./load";
import { EYEPIECES, NOW, TELESCOPE, WARSAW } from "./test-fixtures";
import { tonightDateForSite } from "./tonight-date";

/**
 * The loader never turns a forecast problem into an error page (PRD guardrail "forecast outage degrades, never
 * blanks … neither case produces an error page"). Only the database reads are replaced (list stubs) and the build can
 * be made to throw; the forecast service, the verdict and the engine run for real.
 */

const mocks = vi.hoisted(() => ({
  listSites: vi.fn<() => Promise<SiteRecord[]>>(),
  listTelescopes: vi.fn<() => Promise<TelescopeRecord[]>>(),
  listEyepieces: vi.fn<() => Promise<EyepieceRecord[]>>(),
  listLog: vi.fn<() => Promise<[]>>(),
  buildFault: { error: null as Error | null },
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

// The real build unless a case sets a fault.
vi.mock("@/lib/tonight/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./build")>();
  return {
    ...actual,
    buildTonight: (...args: Parameters<typeof actual.buildTonight>) => {
      if (mocks.buildFault.error) {
        throw mocks.buildFault.error;
      }
      return actual.buildTonight(...args);
    },
  };
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

beforeEach(() => {
  mocks.buildFault.error = null;
  mocks.listSites.mockResolvedValue([WARSAW]);
  mocks.listTelescopes.mockResolvedValue([TELESCOPE]);
  mocks.listEyepieces.mockResolvedValue(EYEPIECES);
  mocks.listLog.mockResolvedValue([]);
});

describe("loadTonight", () => {
  it("still builds Tonight in a forecast outage with nothing stored, as No forecast", async () => {
    const result = await load();
    expect(result.tonightError).toBeNull();
    expect(result.view).not.toBeNull();
    expect(result.view?.headline.id).toBe("noForecast");
  });

  it("names one night for the reader and the build, before and after civil dawn", async () => {
    // 04:00 local: the night in progress (the 9th) is still tonight. 10:00 local: the evening ahead (the 10th).
    for (const [now, night] of [
      ["2026-10-10T02:00:00Z", "2026-10-09"],
      ["2026-10-10T08:00:00Z", "2026-10-10"],
    ] as const) {
      const readPlanEdits = vi.fn<PlanEditsReader>().mockResolvedValue(null);
      const result = await load({ now: new Date(now), withSessionPlan: true, readPlanEdits });
      expect(readPlanEdits).toHaveBeenCalledWith(WARSAW.id, night);
      expect(result.view?.date).toBe(night);
      // The hook's night is the one the site's own rule gives, which the save route compares against.
      expect(tonightDateForSite(WARSAW, new Date(now))).toBe(night);
    }
  });
});

describe("loadTonight's failure lines (error-visibility)", () => {
  let errors: MockInstance<typeof console.error>;

  beforeEach(() => {
    errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errors.mockRestore();
  });

  /** The Tonight loader's own lines: the unreachable forecast (failingFetch) adds its `forecast.fetch` line too. */
  const tonightLines = () => errors.mock.calls.filter(([line]) => String(line).startsWith("sidereus: tonight."));

  /** The coordinate canary: the fake site's coordinates sit in every thrown message, and must reach no argument. */
  const messageWithCoordinates = (what: string) =>
    new Error(`${what} failed at ${String(WARSAW.latitudeDeg)},${String(WARSAW.longitudeDeg)} (site ${WARSAW.id})`);
  const readFault = (key: string, code = "08006") =>
    new Error(key, { cause: Object.assign(messageWithCoordinates("select"), { code }) });
  const expectNoPrivateValue = () => {
    expect(JSON.stringify(errors.mock.calls)).not.toMatch(/52\.23|21\.01|site-1|select|errors\.load|tonight\.failed/);
  };

  it.each([
    ["sites", "errors.load.sites", () => mocks.listSites],
    ["telescopes", "errors.load.telescopes", () => mocks.listTelescopes],
    ["eyepieces", "tonight.eyepiecesFailed", () => mocks.listEyepieces],
    ["log", "tonight.logFailed", () => mocks.listLog],
  ] as const)("logs one tonight.%s line, with the cause's code, when that list fails", async (name, key, mock) => {
    mock().mockRejectedValue(readFault(key));
    const result = await load();
    expect([result.sitesError, result.telescopesError, result.eyepiecesError, result.logError].filter(Boolean)).toEqual(
      [key],
    );
    expect(tonightLines()).toEqual([
      [`sidereus: tonight.${name} failed`, { step: `tonight.${name}`, name: "Error", code: "08006" }],
    ]);
    expectNoPrivateValue();
    if (name === "log") {
      // A log that could not be read ranks as an empty one and marks nothing "not seen yet".
      expect(result.view?.ranking?.entries.length).toBeGreaterThan(0);
      expect(result.view?.ranking?.entries.every((entry) => !entry.notSeenYet)).toBe(true);
    }
  });

  it("logs one tonight.sky-checks line when the optional sky-check read fails, and still shows Tonight", async () => {
    const openRecent = vi.spyOn(skyCheckStore, "openRecent").mockRejectedValue(readFault("errors.load.skyChecks"));
    try {
      const result = await load({ withSkyChecks: true });
      expect(result.openSkyChecks).toEqual([]);
      expect(result.view).not.toBeNull();
      expect(tonightLines()).toEqual([
        ["sidereus: tonight.sky-checks failed", { step: "tonight.sky-checks", name: "Error", code: "08006" }],
      ]);
      expectNoPrivateValue();
    } finally {
      openRecent.mockRestore();
    }
  });

  it("logs one tonight.plan-edits line with the cause's code when the saved-list read fails, and keeps the suggested plan", async () => {
    const cause = Object.assign(new Error("permission denied for table session_plans at 52.2297,21.0122"), {
      code: "42501",
    });
    const failing = vi.fn<PlanEditsReader>().mockRejectedValue(new Error("errors.load.sessionPlan", { cause }));
    const result = await load({ withSessionPlan: true, readPlanEdits: failing });
    expect(result.planEditsError).toBe("errors.load.sessionPlan");
    expect(result.tonightError).toBeNull();
    // A failed read is never an empty list: the view is the suggested plan, not an edited one.
    expect(result.view?.sessionPlan?.edited).toBe(false);
    expect(result.view?.sessionPlan?.rows.length).toBeGreaterThan(0);
    expect(tonightLines()).toEqual([
      ["sidereus: tonight.plan-edits failed", { step: "tonight.plan-edits", name: "Error", code: "42501" }],
    ]);
    expect(JSON.stringify(errors.mock.calls)).not.toMatch(/permission denied|session_plans|52\.2297|errors\.load/);

    // The control: a read that succeeds leaves no such line and applies the list.
    errors.mockClear();
    const working = vi.fn<PlanEditsReader>().mockResolvedValue(["M31"]);
    const edited = await load({ withSessionPlan: true, readPlanEdits: working });
    expect(edited.planEditsError).toBeNull();
    expect(edited.view?.sessionPlan?.rows.map((row) => row.key)).toEqual(["M31"]);
    expect(tonightLines()).toEqual([]);
  });

  it("logs tonight.build, with the error's name only, when the build throws, and keeps the gear lists", async () => {
    mocks.buildFault.error = new RangeError(
      `build failed at ${String(WARSAW.latitudeDeg)},${String(WARSAW.longitudeDeg)}`,
    );
    const result = await load();
    expect(result.tonightError).toBe("tonight.failed");
    expect(result.view).toBeNull();
    expect(result.sites).toEqual([WARSAW]);
    expect(result.telescopes).toEqual([TELESCOPE]);
    expect(tonightLines()).toEqual([["sidereus: tonight.build failed", { step: "tonight.build", name: "RangeError" }]]);
    expectNoPrivateValue();
  });
});
