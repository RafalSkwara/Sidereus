import { beforeEach, describe, expect, it, vi } from "vitest";

import { memoryCache } from "@/lib/forecast/test-helpers";
import type { EyepieceRecord, SiteRecord, TelescopeRecord } from "@/lib/gear/store";
import type { TypedSupabaseClient } from "@/lib/supabase";

import { loadTonight } from "./load";

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

const WARSAW: SiteRecord = {
  id: "site-1",
  name: "Home",
  latitudeDeg: 52.23,
  longitudeDeg: 21.01,
  bortle: 6,
  minAltitudeDeg: 15,
  timeZone: "Europe/Warsaw",
  timeZoneSource: "auto",
  createdAt: "2026-09-01T00:00:00Z",
};

const TELESCOPE: TelescopeRecord = {
  id: "scope-1",
  name: "Skywatcher 150P",
  apertureMm: 150,
  focalLengthMm: 750,
  createdAt: "2026-09-01T00:00:00Z",
};

const EYEPIECES: EyepieceRecord[] = [
  { id: "ep-1", name: "25 mm Plössl", focalLengthMm: 25, afovDeg: 52, createdAt: "2026-09-01T00:00:00Z" },
  { id: "ep-2", name: "10 mm Plössl", focalLengthMm: 10, afovDeg: 52, createdAt: "2026-09-01T00:01:00Z" },
];

/** Early evening in Warsaw on 2026-10-10 (20:00 CEST). */
const NOW = new Date("2026-10-10T18:00:00Z");

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

beforeEach(() => {
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

  it("degrades a failing build to the tonight.failed notice, keeping the gear lists", async () => {
    mocks.buildTonight.mockImplementationOnce(() => {
      throw new Error("build failed");
    });
    const result = await load();
    expect(mocks.buildTonight).toHaveBeenCalled();
    expect(result.view).toBeNull();
    expect(result.tonightError).toBe("tonight.failed");
    expect(result.sites).toEqual([WARSAW]);
    expect(result.telescopes).toEqual([TELESCOPE]);
  });
});
