import { beforeEach, describe, expect, it, vi } from "vitest";

import { memoryCache } from "@/lib/forecast/test-helpers";
import type { EyepieceRecord, SiteRecord, TelescopeRecord } from "@/lib/gear/store";
import type { TypedSupabaseClient } from "@/lib/supabase";

import { loadTonight } from "./load";
import { EYEPIECES, NOW, TELESCOPE, WARSAW } from "./test-fixtures";

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
  return { ...actual, observationStore: { listForRanking: mocks.listLog } };
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

function load() {
  return loadTonight({
    supabase: SUPABASE,
    locale: "en",
    now: NOW,
    cache: memoryCache(),
    defer: noDefer,
    fetchFn: failingFetch,
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
