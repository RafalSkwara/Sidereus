import { afterEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { DEEP_SKY } from "@/lib/catalogue";
import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";
import {
  darknessThresholdDegForBortle,
  darkWindow,
  MAX_RANKED_OBJECTS,
  observingNight,
  PLANET_KEYS,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  rankObjects,
  REASON_MIN_SPREAD,
  sunEvents,
  type Interval,
} from "@/lib/engine";
import { TROMSO } from "@/lib/engine/fixtures";
import type { ForecastResult } from "@/lib/forecast/service";
import { toEngineSite, type SiteRecord } from "@/lib/gear/store";

import {
  buildTonight,
  type TonightMoonCard,
  type TonightMoonEntry,
  type TonightNight,
  type TonightSolarSystem,
  type TonightRanking,
  type TonightSkyView,
  type TonightView,
} from "./build";
import { logHref } from "./load";
import { eventsTileLine, eventsVerdictLine } from "./sky-events";
import {
  EYEPIECES,
  hourlyForecast,
  NOW,
  result,
  TELESCOPE,
  uniformForecast,
  utcWallTime,
  WARSAW,
} from "./test-fixtures";
import { tonightDateForSite } from "./tonight-date";

/**
 * Lets a test make one engine step throw, to prove the build drops only that section and leaves one fixed line. Every
 * flag is `false` by default, which leaves the engine untouched. The message carries a coordinate that must never reach
 * the log.
 */
const failing = vi.hoisted(() => ({
  rankPlanets: false,
  moonTarget: false,
  skyFrames: false,
  planetTracks: false,
  skyEvents: false,
}));

vi.mock("@/lib/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine")>();
  return {
    ...actual,
    rankPlanets: (...args: Parameters<typeof actual.rankPlanets>) => {
      if (failing.rankPlanets) {
        throw new RangeError("planet ranking failed at 52.23");
      }
      return actual.rankPlanets(...args);
    },
    moonTarget: (...args: Parameters<typeof actual.moonTarget>) => {
      if (failing.moonTarget) {
        throw new RangeError("moon target failed at 52.23");
      }
      return actual.moonTarget(...args);
    },
    skyFrames: (...args: Parameters<typeof actual.skyFrames>) => {
      if (failing.skyFrames) {
        throw new RangeError("sky frames failed at 52.23");
      }
      return actual.skyFrames(...args);
    },
    skyEvents: (...args: Parameters<typeof actual.skyEvents>) => {
      if (failing.skyEvents) {
        throw new RangeError("sky events failed at 52.23");
      }
      return actual.skyEvents(...args);
    },
    planetTracks: (...args: Parameters<typeof actual.planetTracks>) => {
      if (failing.planetTracks) {
        throw new RangeError("planet tracks failed at 52.23");
      }
      return actual.planetTracks(...args);
    },
  };
});

afterEach(() => {
  failing.rankPlanets = false;
  failing.moonTarget = false;
  failing.skyFrames = false;
  failing.planetTracks = false;
  failing.skyEvents = false;
  vi.restoreAllMocks();
});

/** Helsinki in midsummer: the sun never reaches -18° (Bortle 1-4), so there is no dark window. */
const HELSINKI_DARK: SiteRecord = {
  ...WARSAW,
  id: "site-2",
  name: "Cottage",
  latitudeDeg: 60.17,
  longitudeDeg: 24.94,
  bortle: 3,
  timeZone: "Europe/Helsinki",
};

/** Tromsø at the solstice: midnight sun, no dark window at any Bortle. */
const TROMSO_SITE: SiteRecord = {
  ...WARSAW,
  id: "site-3",
  name: "North",
  latitudeDeg: TROMSO.latitudeDeg,
  longitudeDeg: TROMSO.longitudeDeg,
  bortle: 2,
  timeZone: TROMSO.timeZone,
};

const HOUR_MS = 3_600_000;

function rankingOf(view: TonightView): TonightRanking {
  if (view.ranking === null) {
    throw new Error("expected a ranking");
  }
  return view.ranking;
}

describe("buildTonight", () => {
  it("has no ranking without a dark window", () => {
    const view = buildTonight(
      {
        site: HELSINKI_DARK,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-06-21T00:00:00Z", 0)),
        now: new Date("2026-06-21T19:00:00Z"),
      },
      "en",
    );
    expect(view.darkWindow).toEqual({ kind: "none" });
    expect(view.darkStart).toBeNull();
    expect(view.verdict).toEqual({ level: "no-go", reason: { kind: "no-darkness" } });
    // Never "Cloudy" on a night that has no dark window to be cloudy in.
    expect(view.headline).toEqual({ id: "noDarkness", key: "tonight.card.noDarkWindow", text: "No dark window" });
    expect(view.ranking).toBeNull();
  });

  it("explains a weather no-go with the next night worth a look", () => {
    // Warsaw's observing nights start at local noon, 10:00 UTC: nights 1 and 2 overcast, night 3 clear.
    const night3 = Date.parse("2026-10-12T10:00:00Z");
    const view = buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(hourlyForecast("2026-10-10T00:00:00Z", 96, (start) => (start.getTime() < night3 ? 100 : 10))),
        now: NOW,
      },
      "en",
    );
    expect(view.verdict.level).toBe("no-go");
    expect(view.ranking).toBeNull();
    expect(view.explanation?.kind).toBe("weather-no-go");
    if (view.explanation?.kind === "weather-no-go") {
      expect(view.explanation.nextText).toBe("Next clearer night: Mon 12 Oct (clear)");
    }
  });

  it("explains a no-darkness night with its cause and the dark window's return", () => {
    const view = buildTonight(
      {
        site: TROMSO_SITE,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-06-21T00:00:00Z", 0)),
        // 22:00 in Tromsø (CEST) on 2026-06-21.
        now: new Date("2026-06-21T20:00:00Z"),
      },
      "en",
    );
    expect(view.date).toBe("2026-06-21");
    expect(view.verdict).toEqual({ level: "no-go", reason: { kind: "no-darkness" } });
    expect(view.ranking).toBeNull();
    expect(view.explanation?.kind).toBe("no-darkness");
    if (view.explanation?.kind === "no-darkness") {
      expect(view.explanation.causeText).toBe(
        "At 70° N at this time of year the sun stays above the horizon all night",
      );
      // The return night itself is pinned against a night-by-night scan in the engine's outlook tests.
      expect(view.explanation.returnText).toMatch(
        /^The dark window returns on the night of Wednesday, 16 September 2026 \(\d{2}:\d{2}–\d{2}:\d{2}\)$/,
      );
    }
  });
});

describe("buildTonight with an observation log (FR-018)", () => {
  const input = {
    site: WARSAW,
    telescope: TELESCOPE,
    eyepieces: EYEPIECES,
    forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5)),
    now: NOW,
  };
  const unlogged = rankingOf(buildTonight(input, "en"));
  // The log keys an object by its target key, the catalogue id ("M31").
  const top = unlogged.entries[0].id;

  it("marks nothing not seen yet when the log could not be read", () => {
    const view = buildTonight({ ...input, log: [], logKnown: false }, "en");
    const ranking = rankingOf(view);
    expect(ranking.entries.length).toBeGreaterThan(0);
    expect(ranking.entries.every((e) => !e.notSeenYet && e.seenText === null)).toBe(true);
    expect(view.summaryTargets.length).toBeGreaterThan(0);
    expect(view.summaryTargets.every((e) => !e.notSeenYet && e.seenText === null)).toBe(true);
    // The same night with a log that did load is where the marks come from.
    expect(unlogged.entries.every((e) => e.notSeenYet)).toBe(true);
  });

  it("leaves the ranking exactly as it was for a log of only 1-2 ratings (invariant 4), and for entries after the ranked night", () => {
    expect(unlogged.entries.length).toBeGreaterThan(1);
    const onlyLow = buildTonight(
      {
        ...input,
        log: unlogged.entries.map((e, i) => ({ target: e.id, night: "2026-10-01", rating: (i % 2) + 1 })),
      },
      "en",
    );
    expect(rankingOf(onlyLow)).toEqual(unlogged);
    const later = buildTonight({ ...input, log: [{ target: top, night: "2026-10-11", rating: 5 }] }, "en");
    expect(rankingOf(later)).toEqual(unlogged);
  });
});

describe("buildTonight's seven-night strip (FR-011)", () => {
  const MINUTE_MS = 60_000;
  /** Eight days of hourly forecast from the night of 10 Oct, every hour at `cloudPct`. */
  const weekForecast = (cloudPct: number) => hourlyForecast("2026-10-10T00:00:00Z", 8 * 24 + 12, () => cloudPct);
  const build = (forecast: ForecastResult | null, overrides: Partial<Parameters<typeof buildTonight>[0]> = {}) =>
    buildTonight({ site: WARSAW, telescope: TELESCOPE, eyepieces: EYEPIECES, forecast, now: NOW, ...overrides }, "en");

  function verdictNight(night: TonightNight): Extract<TonightNight, { kind: "verdict" }> {
    if (night.kind !== "verdict") {
      throw new Error(`expected a verdict on ${night.date}`);
    }
    return night;
  }

  it("makes night 1 the verdict card's night on a go night, a weather no-go, no forecast and a saved copy", () => {
    const cases: [string, ForecastResult | null][] = [
      ["a go night", result(weekForecast(5))],
      ["a weather no-go", result(weekForecast(100))],
      ["no forecast", null],
      ["a saved copy", result(weekForecast(5), true)],
    ];
    // The four cases must differ in what they decide, so a loop over a short or uniform list cannot pass.
    expect(cases).toHaveLength(4);
    const levels = new Set<string>();
    for (const [label, forecast] of cases) {
      const view = build(forecast);
      levels.add(view.verdict.level);
      const first = verdictNight(view.nights[0]);
      expect(first.date, label).toBe(view.date);
      expect(first.level, label).toBe(view.verdict.level);
      expect(first.headline, label).toEqual(view.headline);
      expect(first.reasonText, label).toBe(view.verdictText);
      expect(view.darkWindow.kind, label).toBe("window");
      if (view.darkWindow.kind === "window") {
        expect(first.darkText, label).toBe(`${view.darkWindow.start}–${view.darkWindow.end}`);
      }
    }
    expect([...levels].sort()).toEqual(["go", "marginal", "no-go"]);
  });

  it("formats every night in the site's zone across the 2026-10-25 DST change", () => {
    const view = build(null, { now: new Date("2026-10-21T18:00:00Z") });
    expect(view.nights.map((night) => night.label)).toEqual([
      "Wed 21 Oct",
      "Thu 22 Oct",
      "Fri 23 Oct",
      "Sat 24 Oct",
      "Sun 25 Oct",
      "Mon 26 Oct",
      "Tue 27 Oct",
    ]);

    const night = view.nights.find((n) => n.date === "2026-10-24");
    const window = darkWindow(
      toEngineSite(WARSAW),
      observingNight("2026-10-24", WARSAW.timeZone),
      darknessThresholdDegForBortle(WARSAW.bortle),
    );
    if (night === undefined || window.kind !== "window") {
      throw new Error("expected the night of 24 Oct with a dark window");
    }
    // Dark from CEST (UTC+2) evening to CET (UTC+1) morning.
    const [start, end] = night.darkText.split("–");
    expect(start).toBe(utcWallTime(window.start, 2));
    expect(end).toBe(utcWallTime(window.end, 1));
    // The clock falls back an hour inside the window, so the real duration is one hour longer than the wall-clock span.
    const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
    const wallMinutes = (minutesOf(end) - minutesOf(start) + 24 * 60) % (24 * 60);
    const realMinutes = Math.floor(window.end.getTime() / MINUTE_MS) - Math.floor(window.start.getTime() / MINUTE_MS);
    expect(realMinutes - wallMinutes).toBe(60);
  });
});

describe("buildTonight's planets (M-2 S-01)", () => {
  const input = {
    site: WARSAW,
    telescope: TELESCOPE,
    eyepieces: EYEPIECES,
    forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5)),
    now: NOW,
  };
  const engineSite = toEngineSite(WARSAW);
  const night = observingNight("2026-10-10", WARSAW.timeZone);
  const dark = darkWindow(engineSite, night, darknessThresholdDegForBortle(WARSAW.bortle));
  const civil = darkWindow(engineSite, night, PLANET_WINDOW_SUN_ALTITUDE_DEG);
  if (dark.kind !== "window" || civil.kind !== "window") {
    throw new Error("expected a dark window and a planet window on 2026-10-10 in Warsaw");
  }
  /** Whether a forecast hour starting at `start` overlaps the dark window. */
  const overlapsDark = (start: Date) =>
    start.getTime() < dark.end.getTime() && start.getTime() + HOUR_MS > dark.start.getTime();
  /** `HH:mm` in Warsaw on 2026-10-10/11 (CEST, UTC+2). */
  const hhmm = (instant: Date) => utcWallTime(instant, 2);

  function planetsOf(view: TonightView): TonightSolarSystem {
    if (view.solarSystem === null) {
      throw new Error("expected planets");
    }
    return view.solarSystem;
  }

  it("lists only the planets up in the clear twilight hours of a cloudy no-go night, and names those hours", () => {
    // Every forecast hour that overlaps the dark window is overcast; the twilight hours either side are clear.
    const forecast = hourlyForecast("2026-10-10T00:00:00Z", 48, (start) => (overlapsDark(start) ? 100 : 5));
    const view = buildTonight({ ...input, forecast: result(forecast) }, "en");
    expect(view.verdict.level).toBe("no-go");
    expect(view.ranking).toBeNull();
    const planets = planetsOf(view);

    // Clear from civil dusk to the hour the dark window starts in, and from the hour after it ends to civil dawn.
    const clear: Interval[] = [
      { start: civil.start, end: new Date(Math.floor(dark.start.getTime() / HOUR_MS) * HOUR_MS) },
      { start: new Date(Math.ceil(dark.end.getTime() / HOUR_MS) * HOUR_MS), end: civil.end },
    ];
    const [evening, morning] = clear.map((interval) => `${hhmm(interval.start)}–${hhmm(interval.end)}`);
    expect(planets.weatherText).toBe(`For planets: partly clear — clear ${evening} and ${morning}`);

    expect(planets.entries.length).toBeGreaterThan(0);
    for (const entry of planets.entries) {
      const inClearHours = clear.some(
        (interval) => interval.start.getTime() <= entry.bestAt && entry.bestAt <= interval.end.getTime(),
      );
      expect(inClearHours, `${entry.key} at ${entry.bestTime}`).toBe(true);
    }
    // Saturn and Neptune are up only in the overcast dark hours (on a go night they peak around midnight).
    const keys = planets.entries.map((entry) => entry.key);
    expect(keys).not.toContain("saturn");
    expect(keys).not.toContain("neptune");
    expect(planetsOf(buildTonight(input, "en")).entries.map((entry) => entry.key)).toEqual(
      expect.arrayContaining(["saturn", "neptune"]),
    );
  });

  it("says no planet is up in the clear hours when the only clear spell has none", () => {
    // Only the evening twilight before the dark window is clear: Saturn and Neptune are still too low then.
    const forecast = hourlyForecast("2026-10-10T00:00:00Z", 48, (start) =>
      overlapsDark(start) || start.getTime() >= dark.end.getTime() ? 100 : 5,
    );
    const planets = planetsOf(buildTonight({ ...input, forecast: result(forecast) }, "en"));
    expect(planets.weatherText).toMatch(/^For planets: partly clear — clear \d{2}:\d{2}–\d{2}:\d{2}$/);
    expect(planets.entries).toEqual([]);
    expect(planets.noneText).toBe(en.tonight.planets.noneInClearHours);

    const polish = planetsOf(buildTonight({ ...input, forecast: result(forecast) }, "pl"));
    expect(polish.weatherText).toMatch(/^Dla planet: częściowo pogodnie — pogodnie w godz\. \d{2}:\d{2}–\d{2}:\d{2}$/);
    expect(polish.noneText).toBe(pl.tonight.planets.noneInClearHours);
  });

  it("has no planets when the planet window is clouded out", () => {
    const view = buildTonight({ ...input, forecast: result(uniformForecast("2026-10-10T00:00:00Z", 100)) }, "en");
    expect(view.solarSystem).toBeNull();
    // The Planets page says why, with the planet window's own reason.
    expect(view.planetsAbsentText).toBe(
      "No planets tonight: too cloudy between dusk and dawn (the clearest hour has 100% cloud).",
    );
  });

  it("has no planets when the sun never gets 6° below the horizon", () => {
    const view = buildTonight(
      {
        ...input,
        site: TROMSO_SITE,
        forecast: result(uniformForecast("2026-06-21T00:00:00Z", 0)),
        now: new Date("2026-06-21T20:00:00Z"),
      },
      "en",
    );
    expect(view.solarSystem).toBeNull();
    expect(view.planetsAbsentText).toBe("No planets tonight: the sky never gets dark enough between dusk and dawn.");
  });
});

describe("buildTonight between the dark window's end and civil dawn", () => {
  // 05:45 CEST on 11 October: the Bortle 6 dark window (sun below −15°) is over, civil dawn (−6°) is not.
  const now = new Date("2026-10-11T03:45:00Z");
  const engineSite = toEngineSite(WARSAW);
  const night = observingNight("2026-10-10", WARSAW.timeZone);

  it("still shows the night in progress, and a planet's log link carries that night", () => {
    const dark = darkWindow(engineSite, night, darknessThresholdDegForBortle(WARSAW.bortle));
    const civil = darkWindow(engineSite, night, PLANET_WINDOW_SUN_ALTITUDE_DEG);
    if (dark.kind !== "window" || civil.kind !== "window") {
      throw new Error("expected a dark window and a planet window on 2026-10-10 in Warsaw");
    }
    expect(now.getTime()).toBeGreaterThan(dark.end.getTime());
    expect(now.getTime()).toBeLessThan(civil.end.getTime());

    const view = buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5)),
        now,
      },
      "en",
    );
    expect(view.date).toBe("2026-10-10");
    expect(tonightDateForSite(WARSAW, now)).toBe("2026-10-10");
    // The verdict card and night 1 of the strip are the night being observed, dark window already over.
    expect(view.nights[0].date).toBe("2026-10-10");
    expect(view.darkWindow).toEqual({
      kind: "window",
      start: utcWallTime(dark.start, 2),
      end: utcWallTime(dark.end, 2),
    });

    const jupiter = view.solarSystem?.entries.find((entry) => entry.key === "jupiter");
    expect(jupiter?.reason).toMatch(/best before dawn$/);
    const query = new URL(logHref(view, "jupiter"), "http://localhost").searchParams;
    expect(query.get("object")).toBe("jupiter");
    expect(query.get("night")).toBe("2026-10-10");
    // Only a focused page's link names the page to return to (tonight-dashboard).
    expect(query.has("from")).toBe(false);
    expect(new URL(logHref(view, "jupiter", "planets"), "http://localhost").searchParams.get("from")).toBe("planets");
  });

  it("moves to the evening ahead once civil dawn has passed", () => {
    // 07:00 CEST on 11 October, after civil dawn.
    expect(tonightDateForSite(WARSAW, new Date("2026-10-11T05:00:00Z"))).toBe("2026-10-11");
  });
});

describe("buildTonight's Moon card (moonlight-and-the-verdict)", () => {
  /** An all-clear Warsaw night: the forecast covers it from 00:00 UTC on the evening date, fetched at 16:00 UTC. */
  function clearNight(date: string, overrides: Partial<Parameters<typeof buildTonight>[0]> = {}) {
    const now = new Date(`${date}T16:00:00Z`);
    return {
      site: WARSAW,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      forecast: result(uniformForecast(`${date}T00:00:00Z`, 5), false, now),
      now,
      ...overrides,
    };
  }

  function moonCardOf(view: TonightView): TonightMoonCard {
    if (view.moonCard === null) {
      throw new Error("expected the Moon card");
    }
    return view.moonCard;
  }

  function targetOf(view: TonightView): TonightMoonEntry {
    const target = moonCardOf(view).target;
    if (target === null) {
      throw new Error("expected the Moon as a target");
    }
    return target;
  }

  /** The night's window (dark or civil) in Warsaw, in UTC instants. */
  function warsawWindow(date: string, altitudeDeg: number, site: SiteRecord = WARSAW): Interval {
    const window = darkWindow(toEngineSite(site), observingNight(date, site.timeZone), altitudeDeg);
    if (window.kind !== "window") {
      throw new Error(`expected a window on ${date}`);
    }
    return window;
  }

  it("keeps the dark window and the Moon target in the clear hours of a cloudy no-go night, with no faint line", () => {
    const dark = warsawWindow("2026-10-31", darknessThresholdDegForBortle(WARSAW.bortle));
    const civil = warsawWindow("2026-10-31", PLANET_WINDOW_SUN_ALTITUDE_DEG);
    // Overcast over every hour that overlaps the dark window, clear in the twilight either side.
    const forecast = hourlyForecast("2026-10-31T00:00:00Z", 48, (start) =>
      start.getTime() < dark.end.getTime() && start.getTime() + HOUR_MS > dark.start.getTime() ? 100 : 5,
    );
    const now = new Date("2026-10-31T16:00:00Z");
    const view = buildTonight(clearNight("2026-10-31", { forecast: result(forecast, false, now) }), "en");
    expect(view.verdict.level).toBe("no-go");
    const card = moonCardOf(view);
    expect(card.windowKind).toBe("dark");
    expect(card.states[0].time).toBe(dark.start.toISOString());
    expect(card.upText).not.toBeNull();
    expect(card.faintText).toBeNull();
    // The only clear hours the Moon is up in are after the dark window, before civil dawn.
    const target = targetOf(view);
    expect(target.bestAt).toBeGreaterThanOrEqual(Math.ceil(dark.end.getTime() / HOUR_MS) * HOUR_MS);
    expect(target.bestAt).toBeLessThanOrEqual(civil.end.getTime());
  });

  it("has no target when the planet window is clouded out, but keeps the card", () => {
    const view = buildTonight(
      clearNight("2026-10-26", { forecast: result(uniformForecast("2026-10-26T00:00:00Z", 100)) }),
      "en",
    );
    expect(view.solarSystem).toBeNull();
    const card = moonCardOf(view);
    expect(card.target).toBeNull();
    expect(card.faintText).toBeNull();
    expect(card.upText).toBe("Up all night");
  });

  it("marks the Moon not seen yet only when the log could be read", () => {
    const view = buildTonight(clearNight("2026-10-26", { log: [], logKnown: false }), "en");
    expect(targetOf(view).seenText).toBeNull();
    expect(targetOf(view).notSeenYet).toBe(false);
  });
});

describe("buildTonight's washed-out objects (moonlight-and-the-verdict)", () => {
  /** An all-clear Warsaw night, as in the Moon tests above. */
  function clearNight(date: string) {
    const now = new Date(`${date}T16:00:00Z`);
    return {
      site: WARSAW,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      forecast: result(uniformForecast(`${date}T00:00:00Z`, 5), false, now),
      now,
    };
  }

  it("lists the same washed-out objects on the all-objects page, whatever the limit", () => {
    const top = rankingOf(buildTonight(clearNight("2026-10-26"), "en"));
    const all = rankingOf(buildTonight(clearNight("2026-10-26"), "en", { limit: Number.POSITIVE_INFINITY }));
    expect(all.washedOutEntries).toEqual(top.washedOutEntries);
    const listed = new Set(all.entries.map((e) => e.id));
    expect(top.washedOutEntries.filter((e) => listed.has(e.id))).toEqual([]);
  });
});

describe("buildTonight's reason lines (evening-showpieces)", () => {
  /** An all-clear Warsaw night, as in the Moon tests above. */
  function clearNight(date: string) {
    const now = new Date(`${date}T16:00:00Z`);
    return {
      site: WARSAW,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      forecast: result(uniformForecast(`${date}T00:00:00Z`, 5), false, now),
      now,
    };
  }

  /**
   * The listed entries' moon components and ids for a night, from the engine's own ranking over the same inputs
   * `buildTonight` uses (the view exposes the reason text, not the components).
   */
  function listedMoonComponents(date: string): { ids: string[]; moon: number[] } {
    const site = toEngineSite(WARSAW);
    const dark = darkWindow(site, observingNight(date, WARSAW.timeZone), darknessThresholdDegForBortle(WARSAW.bortle));
    if (dark.kind !== "window") {
      throw new Error(`expected a dark window on ${date}`);
    }
    const ranked = rankObjects({
      site,
      bortle: WARSAW.bortle,
      minAltitudeDeg: WARSAW.minAltitudeDeg,
      darkWindow: dark,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      catalogue: DEEP_SKY,
    });
    return {
      ids: ranked.entries.map((entry) => entry.object.id),
      moon: ranked.entries.map((entry) => entry.score.components.moon),
    };
  }

  const spreadOf = (values: readonly number[]): number => Math.max(...values) - Math.min(...values);

  it("says nothing about moonlight on the moonless night of 2026-10-10", () => {
    const view = buildTonight(clearNight("2026-10-10"), "en");
    const entries = rankingOf(view).entries;
    expect(entries.length).toBe(MAX_RANKED_OBJECTS);
    const { ids, moon } = listedMoonComponents("2026-10-10");
    // The precondition first, so a wrong date fails here and not as a vacuous pass below: the listed entries
    // are the view's own, and the Moon does not set them apart.
    expect(ids).toEqual(entries.map((entry) => entry.id));
    expect(spreadOf(moon), `moon components ${moon.join(", ")}`).toBeLessThan(REASON_MIN_SPREAD);
    for (const entry of entries) {
      expect(entry.reason).not.toContain(en.tonight.reason.moon.lead);
      expect(entry.reason).not.toContain(en.tonight.reason.moon.follow);
    }
  });
});

describe("buildTonight's sky view (interactive-sky)", () => {
  const SOUTH: SiteRecord = {
    ...WARSAW,
    id: "site-4",
    name: "Sydney",
    latitudeDeg: -33.87,
    longitudeDeg: 151.21,
    timeZone: "Australia/Sydney",
  };

  function build(overrides: Partial<Parameters<typeof buildTonight>[0]> = {}, locale: "en" | "pl" = "en") {
    return buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5)),
        now: NOW,
        ...overrides,
      },
      locale,
      { withSkyView: true },
    );
  }

  function skyViewOf(view: TonightView): TonightSkyView {
    if (view.skyView === null) {
      throw new Error("expected a sky view");
    }
    return view.skyView;
  }

  it("reads the zone per frame, so a night that crosses a clock change shows CEST then CET", () => {
    // Madrid, the night of 24-25 October 2026: clocks go back at 03:00 CEST (01:00 UTC).
    const MADRID: SiteRecord = {
      ...WARSAW,
      id: "site-5",
      name: "Madrid",
      latitudeDeg: 40.42,
      longitudeDeg: -3.7,
      timeZone: "Europe/Madrid",
    };
    const sky = skyViewOf(
      build({
        site: MADRID,
        forecast: result(uniformForecast("2026-10-24T00:00:00Z", 5)),
        now: new Date("2026-10-24T09:00:00Z"),
      }),
    );
    const changeMs = Date.UTC(2026, 9, 25, 1, 0);
    expect(sky.zoneLabels).toHaveLength(sky.frameCount);
    expect(sky.endMs).toBeGreaterThan(changeMs);
    sky.zoneLabels.forEach((label, i) => {
      const at = Math.min(sky.startMs + i * sky.stepMs, sky.endMs);
      expect(label, `frame ${String(i)} (${sky.timeLabels[i]})`).toBe(at < changeMs ? "CEST" : "CET");
    });
    expect(sky.zoneLabels[0]).toBe("CEST");
    expect(sky.zoneLabels.at(-1)).toBe("CET");
  });

  it("has no deep-sky targets on a no-go night but keeps every planet and the Moon, with Polish labels", () => {
    const view = build({ forecast: result(uniformForecast("2026-10-10T00:00:00Z", 100)) }, "pl");
    expect(view.ranking).toBeNull();
    expect(view.solarSystem).toBeNull();
    const sky = skyViewOf(view);
    expect(sky.bodies.some((body) => body.kind === "object")).toBe(false);
    const planets = sky.bodies.filter((body) => body.kind === "planet");
    expect(planets).toHaveLength(PLANET_KEYS.length);
    expect(planets.every((body) => body.href === "/tonight/planets")).toBe(true);
    expect(planets.find((body) => body.key === "jupiter")).toMatchObject({
      label: pl.targets.planet.jupiter,
      name: pl.targets.planet.jupiter,
    });
    expect(sky.bodies.at(-1)?.label).toBe(pl.targets.moon);
  });

  it("faces north at a southern-hemisphere site", () => {
    const view = build({
      site: SOUTH,
      forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5)),
      now: new Date("2026-10-10T09:00:00Z"),
    });
    expect(skyViewOf(view).facing).toBe("north");
  });
});

describe("buildTonight's Session plan (session-plan-timeline)", () => {
  function build(
    overrides: Partial<Parameters<typeof buildTonight>[0]> = {},
    options: Parameters<typeof buildTonight>[2] = { withSessionPlan: true },
  ) {
    return buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5)),
        now: NOW,
        ...overrides,
      },
      "en",
      options,
    );
  }

  function planOf(view: TonightView): NonNullable<TonightView["sessionPlan"]> {
    if (view.sessionPlan === null) {
      throw new Error("expected a session plan");
    }
    return view.sessionPlan;
  }

  it("keeps the ticks an hour apart across the autumn clock change (Madrid, night of 24 to 25 Oct)", () => {
    const madrid: SiteRecord = {
      ...WARSAW,
      latitudeDeg: 40.42,
      longitudeDeg: -3.7,
      timeZone: "Europe/Madrid",
    };
    const now = new Date("2026-10-24T18:00:00Z");
    const plan = planOf(
      build({ site: madrid, forecast: result(uniformForecast("2026-10-24T00:00:00Z", 5), false, now), now }),
    );
    const { sunset, sunrise } = sunEvents(toEngineSite(madrid), observingNight("2026-10-24", madrid.timeZone));
    const axisMs = (sunrise?.getTime() ?? 0) - (sunset?.getTime() ?? 0);
    const gaps = plan.ticks.slice(1).map((tick, i) => (tick.at - plan.ticks[i].at) * axisMs);
    expect(gaps.length).toBeGreaterThan(8);
    expect(gaps.every((gap) => Math.abs(gap - HOUR_MS) < 1)).toBe(true);
    expect(plan.ticks.filter((tick) => tick.label === "02:00")).toHaveLength(2);
  });
});

describe("buildTonight's edited Session plan (adjustable-session-plan)", () => {
  const FULL_MOON_NIGHT = new Date("2026-10-26T18:00:00Z");

  function build(
    overrides: Partial<Parameters<typeof buildTonight>[0]> = {},
    options: Parameters<typeof buildTonight>[2] = {},
  ) {
    return buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5)),
        now: NOW,
        ...overrides,
      },
      "en",
      { withSessionPlan: true, ...options },
    );
  }

  function planOf(view: TonightView): NonNullable<TonightView["sessionPlan"]> {
    if (view.sessionPlan === null) {
      throw new Error("expected a session plan");
    }
    return view.sessionPlan;
  }

  const keysOf = (view: TonightView): string[] => planOf(view).rows.map((row) => row.key);

  // Warsaw, 2026-10-10, Bortle 6, 150 mm: the suggested rows are M39, Neptune, Saturn, M31, NGC 869, M34, M45, Uranus,
  // Jupiter and Mars. M3 is up 19:25-19:51 only, so by the end of the night its window is long over; NGC 4244 is
  // reachable but below the bar (it is on no list); Mercury and the Moon are no targets that night.
  it("changes nothing without a saved list: not edited, nothing held, no candidates unless asked", () => {
    const plain = build();
    const plan = planOf(plain);
    expect(plan.edited).toBe(false);
    expect(plan.heldEdits).toBe(false);
    expect(plan.notTonight).toEqual([]);
    expect(plan.candidates).toBeNull();
    expect(plan.rows.every((row) => !row.endsBeforePrevious)).toBe(true);
    // Absent, `null` and a list on a night that is not tonight all give the suggested plan.
    expect(build({}, { planEdits: null })).toEqual(plain);
    expect(planOf(build({}, { planEdits: ["M3"], night: "next" })).edited).toBe(false);
    expect(keysOf(build({}, { planEdits: ["M3"], night: "next" }))).toEqual(keysOf(build({}, { night: "next" })));
    const bestTimes = plan.rows.map((row) => row.bestAt);
    expect(bestTimes).toEqual([...bestTimes].sort((a, b) => a - b));
  });

  it("uses the date it is given instead of working one out from now", () => {
    expect(build().date).toBe("2026-10-10");
    expect(build({}, { nightDate: "2026-10-12" }).date).toBe("2026-10-12");
    // The same date the build works out itself gives the same view.
    expect(build({}, { nightDate: "2026-10-10" })).toEqual(build());
    expect(build({}, { night: "next" }).date).toBe("2026-10-11");
    expect(build({}, { night: "next", nightDate: "2026-10-11" })).toEqual(build({}, { night: "next" }));
  });

  it("links an object below the ranking's bar to its finder chart, and the others to the Targets list", () => {
    const below = planOf(build({}, { planEdits: ["NGC4244", "M13"] }));
    const [ngc4244, m13] = below.rows;
    expect(ngc4244.key).toBe("NGC4244");
    expect(ngc4244.href).toBe("/tonight/finder?object=NGC4244&site=site-1&telescope=scope-1&from=plan");
    expect(m13.href).toBe("/tonight/targets#object-M13");
    // Coordinates never reach a link.
    expect(ngc4244.href).not.toContain("52.23");
    expect(ngc4244.href).not.toContain("21.01");
    // An object the Moon washes out is on the Targets page (its washed-out list), so it links there.
    const fullMoon = planOf(
      build(
        {
          now: FULL_MOON_NIGHT,
          forecast: result(
            uniformForecast("2026-10-26T00:00:00Z", 5),
            false,
            new Date(FULL_MOON_NIGHT.getTime() - 60_000),
          ),
        },
        { planEdits: ["M33", "M65"] },
      ),
    );
    expect(fullMoon.rows.map((row) => row.key)).toEqual(["M33", "M65"]);
    // M33 is washed out, M65 is below the bar that night (M1, the pick before evening-showpieces, now clears it:
    // its duration no longer divides a short pass by the whole night).
    expect(fullMoon.rows[0].href).toBe("/tonight/targets#object-M33");
    expect(fullMoon.rows[1].href).toContain("/tonight/finder?object=M65&");
  });

  it("reads the tile's next target in the user's order: the first row whose window has not ended", () => {
    // 03:30 local: M3's window ended at 19:51, M31's runs to 05:20.
    const late = new Date("2026-10-11T01:30:00Z");
    const forecast = result(uniformForecast("2026-10-10T00:00:00Z", 5), false, new Date(late.getTime() - 20 * 60_000));
    const plan = planOf(build({ now: late, forecast }, { planEdits: ["M3", "M31", "M13"] }));
    expect(plan.rows.map((row) => row.key)).toEqual(["M3", "M31", "M13"]);
    expect(plan.nextUp).toEqual({ kind: "next", index: 1 });
    // Every window over: done.
    expect(planOf(build({ now: late, forecast }, { planEdits: ["M3", "M13"] })).nextUp).toEqual({ kind: "done" });
    // Before sunset: the first row in the user's order.
    const noon = new Date("2026-10-10T10:00:00Z");
    expect(
      planOf(
        build(
          { now: noon, forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5), false, noon) },
          { planEdits: ["M13", "M31"] },
        ),
      ).nextUp,
    ).toEqual({ kind: "first", index: 0 });
  });
});

describe("buildTonight's sky events (M-3 S-07)", () => {
  function build(
    overrides: Partial<Parameters<typeof buildTonight>[0]> = {},
    options: Parameters<typeof buildTonight>[2] = { withSkyEvents: true },
    locale: "en" | "pl" = "en",
  ) {
    return buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2027-07-25T00:00:00Z", 5)),
        now: new Date("2027-07-25T18:00:00Z"),
        ...overrides,
      },
      locale,
      options,
    );
  }

  function eventsOf(view: TonightView): NonNullable<TonightView["skyEvents"]> {
    if (view.skyEvents === null) {
      throw new Error("expected sky events");
    }
    return view.skyEvents;
  }

  it("keeps the safety line on a solar eclipse that is not visible from the site", () => {
    // 10° N, 47° W: the 2027-08-02 eclipse ends with the Sun 1.9° up, under the eclipse bar (engine events.test.ts).
    const site: SiteRecord = { ...WARSAW, latitudeDeg: 10, longitudeDeg: -47, timeZone: "America/Belem" };
    const eclipse = eventsOf(build({ site })).events.find((event) => event.kind === "solar-eclipse");
    expect(eclipse?.visible).toBe(false);
    expect(eclipse?.safety).toBe(true);
  });

  it("says why a not-visible event cannot be seen, never inviting anyone out for it", () => {
    const { events } = eventsOf(build());
    const hidden = events.filter((event) => !event.visible);
    for (const event of hidden) {
      expect(Object.values(en.tonight.events.reason)).toContain(event.visibilityText);
      expect(event.notable).toBe(false);
    }
    for (const event of events.filter((e) => e.visible)) {
      expect(event.visibilityText).not.toBe("");
      expect(Object.values(en.tonight.events.reason)).not.toContain(event.visibilityText);
    }
  });

  it("lists a penumbral lunar eclipse but never makes it notable (2027-02-20)", () => {
    const now = new Date("2027-02-12T18:00:00Z");
    const block = eventsOf(build({ now, forecast: result(uniformForecast("2027-02-12T00:00:00Z", 5), false, now) }));
    const penumbral = block.events.find((event) => event.name === en.tonight.events.eclipse.lunar.penumbral);
    expect(penumbral).toBeDefined();
    expect(penumbral?.notable).toBe(false);
    expect(penumbral?.notes).toContain(en.tonight.events.eclipse.barelyNoticeable);
    expect(block.tonight).not.toContain(penumbral);
    expect(block.next).not.toEqual(penumbral);
  });

  it("reads 'Tomorrow, 11:22' on the night before the 2027-08-02 solar eclipse at Warsaw, never 'Tonight' (owner, 2026-10-14)", () => {
    // The eclipse peaks at 09:22 UTC (11:22 CEST) on 2 August, after the midnight of the night of 1 August.
    const now = new Date("2027-08-01T18:00:00Z");
    const forecast = result(uniformForecast("2027-08-01T00:00:00Z", 5), false, now);
    const en = eventsOf(build({ now, forecast }));
    const eclipse = en.tonight.find((event) => event.kind === "solar-eclipse");
    expect(eclipse?.night).toBe("2027-08-01");
    expect(eclipse?.dayWord).toBe("tomorrow");
    expect(eclipse?.at).toBe("11:22");
    expect(en.tonight[0]).toEqual(eclipse);
    expect(eventsVerdictLine(en, "en")).toMatch(
      /^Tomorrow, 11:22: Partial solar eclipse, eclipse glasses only( \+\d+ more)?$/,
    );
    const pl = eventsOf(build({ now, forecast }, { withSkyEvents: true }, "pl"));
    expect(eventsVerdictLine(pl, "pl")).toMatch(
      /^Jutro, 11:22: częściowe zaćmienie Słońca, tylko przez okulary do zaćmień( \+\d+ więcej)?$/,
    );
    // Every other event keeps no day word and no time.
    expect(
      en.events
        .filter((event) => event.kind !== "solar-eclipse")
        .every((event) => event.dayWord === null && event.at === null),
    ).toBe(true);
  });

  it("keeps the 2027-08-02 eclipse in view on its own morning, after dawn, until its partial phase ends (owner decision A, 2026-10-14)", () => {
    // 07:00 CEST on 2 August: civil dawn has passed, so the night shown is 08-02, whose window starts at noon.
    const morning = new Date("2027-08-02T05:00:00Z");
    const view = build({ now: morning, forecast: result(uniformForecast("2027-08-01T00:00:00Z", 5), false, morning) });
    expect(view.date).toBe("2027-08-02");
    const block = eventsOf(view);
    const eclipse = block.events.find((event) => event.kind === "solar-eclipse");
    expect(eclipse?.night).toBe("2027-08-01");
    expect(eclipse?.dayWord).toBe("today");
    expect(block.tonight[0]).toEqual(eclipse);
    expect(block.next).toEqual(eclipse);
    expect(eventsVerdictLine(block, "en")).toMatch(
      /^Today, 11:22: Partial solar eclipse, eclipse glasses only( \+\d+ more)?$/,
    );
    expect(eventsTileLine(block, "en")).toBe("Partial solar eclipse · today, 11:22 · eclipse glasses only");

    // 13:00 CEST: the partial phase ended at 12:19, so the eclipse is gone from the page, the tile and the line.
    const noon = new Date("2027-08-02T11:00:00Z");
    const later = eventsOf(
      build({ now: noon, forecast: result(uniformForecast("2027-08-01T00:00:00Z", 5), false, noon) }),
    );
    expect(later.events.some((event) => event.kind === "solar-eclipse")).toBe(false);
    expect(later.tonight.some((event) => event.kind === "solar-eclipse")).toBe(false);
    expect(later.next?.kind).not.toBe("solar-eclipse");
  });

  it("builds the next night's copy against that night's sunset, so a morning eclipse already over is not in it", () => {
    // Evening of 2027-08-01: the next night is 08-02, judged at its sunset, when the 08-02 morning eclipse is long over.
    const now = new Date("2027-08-01T18:00:00Z");
    const next = eventsOf(
      build(
        { now, forecast: result(uniformForecast("2027-08-01T00:00:00Z", 5), false, now) },
        { withSkyEvents: true, night: "next" },
      ),
    );
    expect(next.events.some((event) => event.kind === "solar-eclipse")).toBe(false);
  });

  it("counts a meteor shower on its best night, not its peak night, for `tonight` and `next` (2027-07-30 at Reykjavik)", () => {
    // 64° N in late July: the Southern Delta Aquariids' radiant is too low in the peak night's short span (2027-07-30)
    // and clears the minimum the night after (07-31), so the night to go out is 07-31 (found with the engine).
    const REYKJAVIK: SiteRecord = {
      ...WARSAW,
      latitudeDeg: 64,
      longitudeDeg: -22,
      timeZone: "Atlantic/Reykjavik",
    };
    const at = (night: string) => {
      const now = new Date(`${night}T18:00:00Z`);
      return eventsOf(
        build({ site: REYKJAVIK, now, forecast: result(uniformForecast(`${night}T00:00:00Z`, 5), false, now) }),
      );
    };
    const showerName = en.tonight.events.showerName.southernDeltaAquariids;
    const isShower = (event: { name: string }) => event.name === showerName;

    // The week before: the row is grouped under the peak night, and says go out the night after.
    const early = at("2027-07-25");
    const row = early.events.find(isShower);
    expect(row?.name).toBe(showerName);
    expect(row?.night).toBe("2027-07-30");
    expect(row?.goNight).toBe("2027-07-31");
    expect(row?.visibilityText).toMatch(/^Best the night after: /);

    // The peak night: not tonight's event (the radiant is not up in the dark), but the next one, tomorrow night.
    const peakNight = at("2027-07-30");
    expect(peakNight.tonight.filter(isShower)).toEqual([]);
    const tomorrow = peakNight.events.find(isShower);
    expect(tomorrow?.nightWhen).toBe(en.tonight.events.when.tomorrow);
    expect(peakNight.next === null || peakNight.next.goNight >= "2027-07-30").toBe(true);

    // The best night: tonight's event, although its peak night is behind it.
    const bestNight = at("2027-07-31");
    const tonight = bestNight.tonight.find(isShower);
    expect(tonight?.night).toBe("2027-07-30");
    expect(tonight?.goNight).toBe("2027-07-31");
    expect(tonight?.nightWhen).toBe(en.tonight.events.when.tonight);
    expect(bestNight.next?.goNight).toBe("2027-07-31");

    // A night later it is past.
    expect(at("2027-08-01").events.some(isShower)).toBe(false);
  });
});

describe("buildTonight's next night and validUntil (offline-night-plan)", () => {
  const engineSite = toEngineSite(WARSAW);
  const forecast = result(uniformForecast("2026-10-10T00:00:00Z", 5), false, new Date(NOW.getTime() - 20 * 60_000));
  const input = { site: WARSAW, telescope: TELESCOPE, eyepieces: EYEPIECES, forecast, now: NOW };

  it("builds the evening after tonight with the same forecast, and tonight stays the default", () => {
    const tonight = buildTonight(input, "en");
    const next = buildTonight(input, "en", { night: "next" });
    expect(tonight.date).toBe("2026-10-10");
    expect(next.date).toBe("2026-10-11");
    expect(next.nights[0].date).toBe("2026-10-11");
    expect(buildTonight(input, "en", { night: "tonight" })).toEqual(tonight);
    // The next night's verdict reads that night's own forecast hours: cloud over it alone turns the verdict.
    const cloudyNext = hourlyForecast("2026-10-10T00:00:00Z", 72, (start) =>
      start.getTime() >= Date.parse("2026-10-11T12:00:00Z") ? 100 : 5,
    );
    const cloudy = buildTonight({ ...input, forecast: result(cloudyNext) }, "en", { night: "next" });
    expect(cloudy.verdict.level).toBe("no-go");
    expect(buildTonight({ ...input, forecast: result(cloudyNext) }, "en").verdict.level).toBe("go");
    // The forecast age still reads the real clock.
    expect(next.forecastFetchedAt?.toISOString()).toBe(forecast.fetchedAt.toISOString());
    expect(next.forecastStatus).toEqual(tonight.forecastStatus);
  });

  it("ends the night at the civil dawn after it", () => {
    const civil = darkWindow(engineSite, observingNight("2026-10-10", WARSAW.timeZone), PLANET_WINDOW_SUN_ALTITUDE_DEG);
    if (civil.kind !== "window") {
      throw new Error("expected a planet window on 2026-10-10 in Warsaw");
    }
    expect(buildTonight(input, "en").validUntil.toISOString()).toBe(civil.end.toISOString());
    const civilNext = darkWindow(
      engineSite,
      observingNight("2026-10-11", WARSAW.timeZone),
      PLANET_WINDOW_SUN_ALTITUDE_DEG,
    );
    if (civilNext.kind !== "window") {
      throw new Error("expected a planet window on 2026-10-11 in Warsaw");
    }
    expect(buildTonight(input, "en", { night: "next" }).validUntil.toISOString()).toBe(civilNext.end.toISOString());

    // Where there is no civil window the night ends with the observing night (87° N in June).
    const pole: SiteRecord = { ...WARSAW, latitudeDeg: 87, longitudeDeg: 0, timeZone: "UTC" };
    const polarNow = new Date("2026-06-20T12:00:00Z");
    const polar = buildTonight(
      {
        site: pole,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-06-20T00:00:00Z", 5), false, polarNow),
        now: polarNow,
      },
      "en",
    );
    const polarCivil = darkWindow(
      toEngineSite(pole),
      observingNight(polar.date, "UTC"),
      PLANET_WINDOW_SUN_ALTITUDE_DEG,
    );
    expect(polarCivil.kind).not.toBe("window");
    expect(polar.validUntil.toISOString()).toBe(observingNight(polar.date, "UTC").end.toISOString());
  });
});

describe("buildTonight's trace of a dropped section (error-visibility)", () => {
  /** An all-clear Warsaw night: every section is built, so each can be made to fail. */
  function build(options: Parameters<typeof buildTonight>[2] = {}) {
    const now = new Date("2026-10-26T16:00:00Z");
    return buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-10-26T00:00:00Z", 5), false, now),
        now,
      },
      "en",
      options,
    );
  }

  /** The one line a failing step must leave: the fixed message, the step and the error's name, no coordinate. */
  function expectOneLine(logged: MockInstance<typeof console.error>, step: string): void {
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(`sidereus: ${step} failed`, { step, name: "RangeError" });
    expect(JSON.stringify(logged.mock.calls)).not.toMatch(/52\.23|21\.01/);
  }

  it("logs tonight.planets and drops only the planets when ranking them fails", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const working = build();
    // The control: every section builds and the healthy build logs nothing.
    expect(working.solarSystem).not.toBeNull();
    expect(working.planetsAbsentText).toBeNull();
    expect(logged).not.toHaveBeenCalled();
    failing.rankPlanets = true;
    const view = build();
    expect(view.solarSystem).toBeNull();
    expect(view.planetsAbsentText).toBe("Planet details aren't available right now.");
    expect(view.verdict).toEqual(working.verdict);
    expect(view.ranking).toEqual(working.ranking);
    expect(view.nights).toEqual(working.nights);
    expect(view.moonCard).toEqual(working.moonCard);
    expectOneLine(logged, "tonight.planets");
  });

  it("logs tonight.moon and drops only the Moon target when working it out fails", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const working = build();
    expect(working.moonCard?.target).not.toBeNull();
    failing.moonTarget = true;
    const view = build();
    expect(view.moonCard).toEqual({ ...working.moonCard, target: null });
    expect(view.solarSystem).toEqual(working.solarSystem);
    expect(view.verdict).toEqual(working.verdict);
    expect(view.ranking).toEqual(working.ranking);
    expect(view.nights).toEqual(working.nights);
    expectOneLine(logged, "tonight.moon");
  });

  it("logs tonight.sky-view and drops only the sky view when building it fails", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const intact = build({ withSkyView: true });
    expect(intact.skyView).not.toBeNull();
    failing.skyFrames = true;
    const view = build({ withSkyView: true });
    expect(view.skyView).toBeNull();
    expect(view).toEqual({ ...intact, skyView: null });
    expectOneLine(logged, "tonight.sky-view");
  });

  it("logs tonight.session-plan and drops only the plan when its tracks fail", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const intact = build({ withSessionPlan: true });
    expect(intact.sessionPlan).not.toBeNull();
    failing.planetTracks = true;
    const view = build({ withSessionPlan: true });
    expect(view.sessionPlan).toBeNull();
    expect(view.ranking).toEqual(intact.ranking);
    expectOneLine(logged, "tonight.session-plan");
  });

  it("logs tonight.sky-events and drops only the events when the search fails", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const intact = build({ withSkyEvents: true });
    expect(intact.skyEvents).not.toBeNull();
    failing.skyEvents = true;
    const view = build({ withSkyEvents: true });
    expect(view.skyEvents).toBeNull();
    expect(view).toEqual({ ...intact, skyEvents: null });
    expectOneLine(logged, "tonight.sky-events");
  });
});
