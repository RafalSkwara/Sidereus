import { beforeEach, describe, expect, it, vi } from "vitest";

import { en } from "@/i18n/messages/en";
import type { EyepieceRecord } from "@/lib/gear/store";
import type { TypedSupabaseClient } from "@/lib/supabase";
import { isTargetKey, type TargetKey } from "@/lib/targets";
import { buildTonight, type TonightView } from "@/lib/tonight/build";
import { expectationKeyFor } from "@/lib/tonight/expectation";
import type { TonightLoad } from "@/lib/tonight/load";
import { EYEPIECES, NOW, TELESCOPE, WARSAW, result, uniformForecast } from "@/lib/tonight/test-fixtures";

import { loadFinderFor } from "./load";

/**
 * The finder loader's island-side refusal and failure path (finder-chart Phase 4), without the Worker runtime: the
 * island wiring (`astro:env/server`, `cloudflare:workers`) is replaced, so is the `account_plans` read and the star
 * loader (a spy that delegates to the real file unless a case makes it throw). The engine and the Tonight build run
 * for real.
 */

const mocks = vi.hoisted(() => ({
  planRead: vi.fn<(client: unknown, userId: string) => Promise<{ plan: unknown } | { error: true; code: string }>>(),
  loadTonightFor: vi.fn<(locals: unknown, options: unknown) => Promise<unknown>>(),
  loadFinderStars: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@/lib/account-plan/store", () => ({ accountPlanStore: { read: mocks.planRead } }));
vi.mock("@/lib/tonight/island", () => ({ loadTonightFor: mocks.loadTonightFor }));
vi.mock("@/lib/catalogue/finder-stars", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalogue/finder-stars")>();
  mocks.loadFinderStars.mockImplementation(actual.loadFinderStars);
  return { ...actual, loadFinderStars: mocks.loadFinderStars };
});

const SUPABASE = {} as TypedSupabaseClient;
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "a@example.test" };

/** A fresh locals per case: the plan read is memoised by the locals object. */
function locals(overrides: Partial<Pick<App.Locals, "user" | "supabase">> = {}): App.Locals {
  return { user: USER, supabase: SUPABASE, locale: "en", ...overrides } as App.Locals;
}

/** A 40 mm eyepiece whose exit pupil is over the finding ceiling, so a planet and M31 get different finding eyepieces. */
const WIDE_KIT: EyepieceRecord[] = [
  { id: "ep-0", name: "40 mm Wide", focalLengthMm: 40, afovDeg: 52, createdAt: "2026-09-01T00:00:00Z" },
  ...EYEPIECES,
];

function viewFor(eyepieces: EyepieceRecord[], withReachable = false): TonightView {
  return buildTonight(
    {
      site: WARSAW,
      telescope: TELESCOPE,
      eyepieces,
      forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5)),
      now: NOW,
    },
    "en",
    { limit: Number.POSITIVE_INFINITY, withReachable },
  );
}

function tonightLoad(eyepieces: EyepieceRecord[], overrides: Partial<TonightLoad> = {}): TonightLoad {
  return {
    sites: [WARSAW],
    telescopes: [TELESCOPE],
    eyepieces,
    sitesError: null,
    telescopesError: null,
    eyepiecesError: null,
    logError: null,
    site: WARSAW,
    telescope: TELESCOPE,
    multipleSites: false,
    multipleTelescopes: false,
    needsSetup: false,
    view: viewFor(eyepieces),
    tonightError: null,
    openSkyChecks: [],
    planEditsError: null,
    ...overrides,
  };
}

const logged = vi.spyOn(console, "error");

/** Text a real failure could carry: the site's coordinates and an email. */
const COORDS = "52.2297,21.0122";
const EMAIL = "ada.lovelace@example.test";
const LEAK = /52\.2297|21\.0122|ada\.lovelace|example\.test/;

beforeEach(() => {
  mocks.planRead.mockReset();
  mocks.loadTonightFor.mockReset();
  logged.mockReset();
  logged.mockImplementation(() => undefined);
  mocks.loadFinderStars.mockClear();
  mocks.planRead.mockResolvedValue({ plan: "full" });
  mocks.loadTonightFor.mockResolvedValue(tonightLoad(WIDE_KIT));
});

describe("loadFinderFor's plan guard", () => {
  it("answers a failed plan read like a free account", async () => {
    mocks.planRead.mockResolvedValue({ error: true, code: "PGRST000" });
    expect(await loadFinderFor(locals(), { target: "M31" })).toEqual({ kind: "locked" });
    expect(mocks.loadTonightFor).not.toHaveBeenCalled();
  });

  it("answers not-configured, and never builds a chart, when there is no database", async () => {
    expect(await loadFinderFor(locals({ supabase: null }), { target: "M31" })).toEqual({ kind: "not-configured" });
    expect(mocks.loadTonightFor).not.toHaveBeenCalled();
    expect(mocks.loadFinderStars).not.toHaveBeenCalled();
  });

  it("checks the plan before looking at an object that does not parse", async () => {
    mocks.planRead.mockResolvedValue({ plan: "free" });
    expect(await loadFinderFor(locals(), { target: null })).toEqual({ kind: "locked" });
    expect(mocks.loadTonightFor).not.toHaveBeenCalled();
    expect(mocks.loadFinderStars).not.toHaveBeenCalled();
  });
});

describe("loadFinderFor from the Session plan (adjustable-session-plan F9)", () => {
  /** A deep-sky key the telescope reaches tonight that is neither ranked nor washed out: below the bar. */
  function belowBarKey(view: TonightView): TargetKey {
    const listed = new Set([
      ...(view.ranking?.entries.map((entry) => entry.id) ?? []),
      ...(view.ranking?.washedOutEntries.map((entry) => entry.id) ?? []),
    ]);
    const key = view.reachable?.find((entry) => !listed.has(entry.id))?.id;
    if (key === undefined || !isTargetKey(key)) {
      throw new Error("expected a below-bar object on this night");
    }
    return key;
  }

  it("resolves an object below the ranking's bar only with from=plan", async () => {
    const view = viewFor(WIDE_KIT, true);
    const key = belowBarKey(view);
    mocks.loadTonightFor.mockResolvedValue(tonightLoad(WIDE_KIT, { view }));

    expect((await loadFinderFor(locals(), { target: key })).kind).toBe("not-ranked");
    expect((await loadFinderFor(locals(), { target: key, from: "targets" })).kind).toBe("not-ranked");

    const load = await loadFinderFor(locals(), { target: key, from: "plan" });
    if (load.kind !== "chart") {
      throw new Error(`expected a chart, got ${load.kind}`);
    }
    const reached = view.reachable?.find((entry) => entry.id === key);
    expect(load.labels.target).toBe(reached?.label);
    expect(load.labels.time).toBe(reached?.bestTime);
    expect(load.labels.direction).toBe(reached?.bestDirection);
  });
});

describe("loadFinderFor for a full account", () => {
  it("draws a chart for a ranked deep-sky object, with the widest eyepiece when none fits it", async () => {
    const ranked = viewFor(WIDE_KIT).ranking?.entries.find((entry) => entry.id === "M31");
    expect(ranked?.pair?.kind).toBe("none-fit");
    const load = await loadFinderFor(locals(), { target: "M31" });
    if (load.kind !== "chart") {
      throw new Error(`expected a chart, got ${load.kind}`);
    }
    expect(load.labels.target).toBe("M31");
    expect(load.labels.eyepiece?.name).toBe("40 mm Wide");
    expect(load.chart.finder.circles.some((circle) => circle.kind === "eyepiece")).toBe(true);
    // The context line is the ranking's own refracted direction and time.
    expect(load.labels.direction).toBe(ranked?.bestDirection);
    expect(load.labels.time).toBe(ranked?.bestTime);
  });

  it("gives a deep-sky chart its expectation key and phrase for the site's Bortle class and the aperture, and a planet's chart its own note", async () => {
    const key = expectationKeyFor("M31", WARSAW.bortle, TELESCOPE.apertureMm);
    if (key === null) {
      throw new Error("expected M31 in the catalogue");
    }
    const deepSky = await loadFinderFor(locals(), { target: "M31" });
    if (deepSky.kind !== "chart") {
      throw new Error(`expected a chart, got ${deepSky.kind}`);
    }
    expect(deepSky.expectation).toEqual({ key, text: en.tonight.expect.phrase[key] });

    const planet = viewFor(WIDE_KIT).solarSystem?.entries[0];
    if (planet === undefined) {
      throw new Error("expected a planet on this night");
    }
    const planetLoad = await loadFinderFor(locals(), { target: planet.key });
    if (planetLoad.kind !== "chart") {
      throw new Error(`expected a chart, got ${planetLoad.kind}`);
    }
    expect(planetLoad.expectation).toEqual({ key: planet.key, text: planet.note });
  });

  it("draws a planet's chart with the finding eyepiece of a kit that fits everything, and no eyepiece circle for an empty kit", async () => {
    const planet = viewFor(WIDE_KIT).solarSystem?.entries[0];
    if (planet === undefined) {
      throw new Error("expected a planet on this night");
    }
    const load = await loadFinderFor(locals(), { target: planet.key });
    if (load.kind !== "chart") {
      throw new Error(`expected a chart, got ${load.kind}`);
    }
    expect(load.labels.target).toBe(planet.name);
    expect(load.labels.eyepiece?.name).toBe("25 mm Plössl");

    mocks.loadTonightFor.mockResolvedValue(tonightLoad([]));
    const bare = await loadFinderFor(locals(), { target: "M31" });
    if (bare.kind !== "chart") {
      throw new Error(`expected a chart, got ${bare.kind}`);
    }
    expect(bare.labels.eyepiece).toBeNull();
    expect(bare.chart.finder.circles.some((circle) => circle.kind === "eyepiece")).toBe(false);
  });

  it("says not-ranked for an object missing from tonight's ranking, the Moon and an unparsed object, and no-gear without a site, logging nothing for either", async () => {
    expect((await loadFinderFor(locals(), { target: "NGC9999" })).kind).toBe("not-ranked");
    expect((await loadFinderFor(locals(), { target: "moon" })).kind).toBe("not-ranked");
    expect(await loadFinderFor(locals(), { target: null })).toEqual({ kind: "not-ranked", view: null });
    mocks.loadTonightFor.mockResolvedValue(tonightLoad([], { site: undefined, view: null, needsSetup: true }));
    expect((await loadFinderFor(locals(), { target: "M31" })).kind).toBe("no-gear");
    expect(logged).not.toHaveBeenCalled();
  });
});

describe("loadFinderFor's failed state leaves a line (error-visibility, Phase 5)", () => {
  /** The cause of a swallowed list read or build is already logged by the Tonight loader; this line says the finder fell. */
  const FELL = ["sidereus: finder.tonight failed", { step: "finder.tonight" }] as const;

  it("logs finder.tonight once for a null load, an unbuilt Tonight and a failed site read, none of them a chart", async () => {
    mocks.loadTonightFor.mockResolvedValue(null);
    expect(await loadFinderFor(locals(), { target: "M31" })).toEqual({ kind: "failed", view: null });
    expect(logged).toHaveBeenCalledExactlyOnceWith(...FELL);

    logged.mockClear();
    mocks.loadTonightFor.mockResolvedValue(tonightLoad([], { view: null, tonightError: "tonight.failed" }));
    expect((await loadFinderFor(locals(), { target: "M31" })).kind).toBe("failed");
    expect(logged).toHaveBeenCalledExactlyOnceWith(...FELL);

    logged.mockClear();
    mocks.loadTonightFor.mockResolvedValue(
      tonightLoad([], { site: undefined, view: null, sitesError: "gear.load.failed" as never }),
    );
    expect((await loadFinderFor(locals(), { target: "M31" })).kind).toBe("failed");
    expect(logged).toHaveBeenCalledExactlyOnceWith(...FELL);
  });

  it("logs a failed star load and a failed chart as fixed lines with the error's name only, never a coordinate or an email", async () => {
    mocks.loadFinderStars.mockRejectedValueOnce(new RangeError(`${COORDS} ${EMAIL}`));
    expect((await loadFinderFor(locals(), { target: "M31" })).kind).toBe("failed");
    expect(logged).toHaveBeenCalledExactlyOnceWith("sidereus: finder.stars failed", {
      step: "finder.stars",
      name: "RangeError",
    });

    logged.mockClear();
    mocks.loadFinderStars.mockResolvedValueOnce(null);
    expect((await loadFinderFor(locals(), { target: "M31" })).kind).toBe("failed");
    expect(logged).toHaveBeenCalledExactlyOnceWith("sidereus: finder.chart failed", {
      step: "finder.chart",
      name: "TypeError",
    });

    // `findingEyepiece` reads the kit before the star file or the engine is touched; its throw used to fail the island.
    logged.mockClear();
    const poisoned = new Proxy([] as EyepieceRecord[], {
      get() {
        throw new RangeError(`${COORDS} ${EMAIL}`);
      },
    });
    mocks.loadTonightFor.mockResolvedValue(tonightLoad(WIDE_KIT, { eyepieces: poisoned }));
    expect((await loadFinderFor(locals(), { target: "M31" })).kind).toBe("failed");
    expect(logged).toHaveBeenCalledExactlyOnceWith("sidereus: finder.chart failed", {
      step: "finder.chart",
      name: "RangeError",
    });
    expect(JSON.stringify(logged.mock.calls)).not.toMatch(LEAK);
  });
});
