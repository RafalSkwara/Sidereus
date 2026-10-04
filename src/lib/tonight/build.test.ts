import { afterEach, describe, expect, it, vi } from "vitest";

import { findMessier, MESSIER } from "@/lib/catalogue";
import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";
import {
  darknessThresholdDegForBortle,
  darkWindow,
  ICE_GIANT_MIN_APERTURE_MM,
  MAX_RANKED_OBJECTS,
  MOON_DISC_STEP_MINUTES,
  moonDiscState,
  observingNight,
  PLANET_KEYS,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  type HourlyForecast,
  type Interval,
  type MoonDiscState,
} from "@/lib/engine";
import { TROMSO } from "@/lib/engine/fixtures";
import type { ForecastResult } from "@/lib/forecast/service";
import { toEngineSite, type EyepieceRecord, type SiteRecord, type TelescopeRecord } from "@/lib/gear/store";

import {
  buildTonight,
  type TonightMoonCard,
  type TonightMoonEntry,
  type TonightNight,
  type TonightSolarSystem,
  type TonightRanking,
  type TonightView,
} from "./build";
import { logHref } from "./load";
import { tonightDateForSite } from "./tonight-date";

/** Lets a test make the planet ranking or the Moon throw; `false` (the default) leaves the engine untouched. */
const planetRanking = vi.hoisted(() => ({ throws: false }));
const moonTargeting = vi.hoisted(() => ({ throws: false }));

vi.mock("@/lib/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine")>();
  return {
    ...actual,
    rankPlanets: (...args: Parameters<typeof actual.rankPlanets>) => {
      if (planetRanking.throws) {
        throw new Error("planet ranking failed");
      }
      return actual.rankPlanets(...args);
    },
    moonTarget: (...args: Parameters<typeof actual.moonTarget>) => {
      if (moonTargeting.throws) {
        throw new Error("moon target failed");
      }
      return actual.moonTarget(...args);
    },
  };
});

afterEach(() => {
  planetRanking.throws = false;
  moonTargeting.throws = false;
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

const HOUR_MS = 3_600_000;

/** `HH:mm` of the UTC wall clock `offsetHours` ahead of `instant`. */
function utcWallTime(instant: Date, offsetHours: number): string {
  return new Date(instant.getTime() + offsetHours * HOUR_MS).toISOString().slice(11, 16);
}

/** Hourly forecast from `fromUtc` for `hours` hours, each hour's cloud cover given by `cloudPct`. */
function hourlyForecast(fromUtc: string, hours: number, cloudPct: (start: Date) => number): HourlyForecast {
  const from = Date.parse(fromUtc);
  return {
    hours: Array.from({ length: hours }, (_, i) => {
      const start = new Date(from + i * HOUR_MS);
      return { start, cloudCoverPct: cloudPct(start), humidityPct: 60 };
    }),
  };
}

/** Hourly forecast from 00:00 UTC on `fromUtc` for 48 h, every hour at `cloudPct`. */
function uniformForecast(fromUtc: string, cloudPct: number): HourlyForecast {
  return hourlyForecast(fromUtc, 48, () => cloudPct);
}

/** A service result fetched 20 min before `NOW`, fresh unless `fallback`. */
function result(
  forecast: HourlyForecast,
  fallback = false,
  fetchedAt = new Date(NOW.getTime() - 20 * 60_000),
): ForecastResult {
  return { forecast, fetchedAt, fallback };
}

function rankingOf(view: TonightView): TonightRanking {
  if (view.ranking === null) {
    throw new Error("expected a ranking");
  }
  return view.ranking;
}

describe("buildTonight", () => {
  it("ranks a clear night, formats times in the site's zone and pairs the kit's eyepieces", () => {
    const view = buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5)),
        now: NOW,
      },
      "en",
    );

    expect(view).toMatchObject({
      siteName: "Home",
      telescopeName: "Skywatcher 150P",
      date: "2026-10-10",
      dateLabel: "Saturday, 10 October 2026",
      timeZone: "Europe/Warsaw",
      verdict: { level: "go" },
      hasEyepieces: true,
    });
    expect(view.darkWindow.kind).toBe("window");
    if (view.darkWindow.kind === "window") {
      expect(view.darkWindow.start).toMatch(/^(19|20):\d{2}$/);
      expect(view.darkWindow.end).toMatch(/^0[4-6]:\d{2}$/);
    }
    // The raw start behind the formatted one, for the sky check (verdict-check): the evening of 10 October.
    expect(view.headline.id).toBe("go");
    expect(view.darkStart?.toISOString()).toMatch(/^2026-10-10T1[78]:/);
    const ranking = rankingOf(view);
    expect(ranking.clearedCount).toBeGreaterThan(0);
    expect(ranking.clearedText).toBe(`${ranking.clearedCount} objects cleared the bar tonight`);
    expect(ranking.entries.length).toBe(Math.min(ranking.clearedCount, MAX_RANKED_OBJECTS));
    for (const entry of ranking.entries) {
      expect(entry.id).toMatch(/^M\d+$/);
      expect(entry.constellation).toMatch(/^[A-Z][a-z]{2}$/);
      expect(entry.windowStart).toMatch(/^\d{2}:\d{2}$/);
      expect(entry.bestTime).toMatch(/^\d{2}:\d{2}$/);
      expect(entry.bestDirection).toMatch(/^[NESW]{1,3}, \d{1,2}°$/);
      expect(entry.reason).toContain(" · ");
      expect(entry.pair).not.toBeNull();
    }
    const m31 = ranking.entries.find((entry) => entry.id === "M31");
    expect(m31).toMatchObject({ commonName: findMessier(31)?.commonName, constellation: "And" });
  });

  it("leaves the pair out when the kit has no eyepieces", () => {
    const view = buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: [],
        forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5)),
        now: NOW,
      },
      "en",
    );
    expect(view.hasEyepieces).toBe(false);
    expect(rankingOf(view).entries.length).toBeGreaterThan(0);
    expect(rankingOf(view).entries.every((entry) => entry.pair === null)).toBe(true);
  });

  it("has no ranking on a no-go night", () => {
    const view = buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-10-10T00:00:00Z", 100)),
        now: NOW,
      },
      "en",
    );
    expect(view.verdict.level).toBe("no-go");
    expect(view.headline).toEqual({ id: "no-go", key: "verdict.level.no-go", text: "Cloudy" });
    expect(view.verdictText).toBe("too cloudy: the clearest dark hour has 100% cloud");
    expect(view.ranking).toBeNull();
  });

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

  it("defaults to marginal with a ranking when there is no forecast", () => {
    const view = buildTonight(
      { site: WARSAW, telescope: TELESCOPE, eyepieces: EYEPIECES, forecast: null, now: NOW },
      "en",
    );
    expect(view.verdict).toEqual({ level: "marginal", reason: { kind: "no-weather-data" } });
    // Never "Partly clear" without a forecast.
    expect(view.headline).toEqual({ id: "noForecast", key: "verdict.sky.noForecast", text: "No forecast" });
    expect(view.verdictText).toBe("no weather data");
    expect(view.ranking?.entries.length).toBeGreaterThan(0);
  });

  it("carries an empty ranking on a go night when nothing clears the bar", () => {
    // M7 (Dec −35°) never rises above 15° from Warsaw, so it can never score.
    const view = buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5)),
        now: NOW,
        catalogue: MESSIER.filter((object) => object.messier === 7),
      },
      "en",
    );
    expect(view.verdict.level).toBe("go");
    expect(view.ranking).toEqual({
      clearedCount: 0,
      clearedText: "No object cleared the bar tonight",
      entries: [],
      washedOutCount: 0,
      washedOutText: null,
      washedOutEntries: [],
    });
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

  it("reports whether the forecast is fresh, a saved copy or missing", () => {
    const build = (forecast: ForecastResult | null) =>
      buildTonight({ site: WARSAW, telescope: TELESCOPE, eyepieces: EYEPIECES, forecast, now: NOW }, "en");
    const forecast = uniformForecast("2026-10-10T00:00:00Z", 5);

    expect(build(result(forecast)).forecastStatus).toEqual({ kind: "fresh", text: "Forecast updated 20 min ago" });
    expect(build(result(forecast, true, new Date(NOW.getTime() - 3 * HOUR_MS))).forecastStatus).toEqual({
      kind: "fallback",
      text: "Weather service unreachable — showing the forecast from 3 h ago",
    });
    expect(build(null).forecastStatus).toEqual({
      kind: "none",
      text: "No weather data — the weather service could not be reached and no earlier forecast is saved",
    });
  });

  it("caps a go at marginal on a saved copy and still ranks", () => {
    const view = buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-10-10T00:00:00Z", 5), true),
        now: NOW,
      },
      "en",
    );
    expect(view.verdict).toMatchObject({ level: "marginal", reason: { kind: "fallback-cap", cloudPct: 5 } });
    expect(view.headline).toEqual({ id: "fallbackCap", key: "verdict.sky.fallbackCap", text: "Clear (old forecast)" });
    expect(view.verdictText).toMatch(/^the last saved forecast showed \d+ h in a row with at most 5% cloud/);
    expect(view.explanation).toBeNull();
    expect(rankingOf(view).entries.length).toBeGreaterThan(0);
  });

  it("reads a forecast that ends mid-window as no weather data, with a ranking", () => {
    // The series stops at 22:00 UTC (midnight in Warsaw), inside tonight's dark window.
    const view = buildTonight(
      {
        site: WARSAW,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(hourlyForecast("2026-10-10T00:00:00Z", 23, () => 5)),
        now: NOW,
      },
      "en",
    );
    expect(view.verdict).toEqual({ level: "marginal", reason: { kind: "no-weather-data" } });
    expect(view.verdictText).toBe("no weather data");
    expect(view.explanation).toBeNull();
    expect(rankingOf(view).entries.length).toBeGreaterThan(0);
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

  it("tags nothing and changes nothing without a log", () => {
    expect(unlogged.entries.every((entry) => entry.seenText === null)).toBe(true);
  });

  it("tags an object seen on a night rated 3 or above", () => {
    const view = buildTonight(
      {
        ...input,
        log: [
          { target: top, night: "2026-09-12", rating: 4 },
          { target: top, night: "2026-10-01", rating: 3 },
        ],
      },
      "en",
    );
    const entry = rankingOf(view).entries.find((e) => e.id === top);
    // Pushed down, the object may leave the top five; where it still shows, it carries the tag.
    if (entry) {
      expect(entry.seenText).toBe("Seen 2 times – last 1 Oct 2026");
    }
    expect(rankingOf(view).entries.map((e) => e.id)).not.toEqual(unlogged.entries.map((e) => e.id));
  });

  it("leaves the ranking exactly as it was for a log of only 1-2 ratings (invariant 4)", () => {
    const view = buildTonight(
      {
        ...input,
        log: unlogged.entries.map((e, i) => ({ target: e.id, night: "2026-10-01", rating: (i % 2) + 1 })),
      },
      "en",
    );
    expect(rankingOf(view)).toEqual(unlogged);
  });

  it("ignores entries for nights after the ranked night", () => {
    const view = buildTonight({ ...input, log: [{ target: top, night: "2026-10-11", rating: 5 }] }, "en");
    expect(rankingOf(view)).toEqual(unlogged);
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

  function outlookNight(night: TonightNight): Extract<TonightNight, { kind: "outlook" }> {
    if (night.kind !== "outlook") {
      throw new Error(`expected an outlook on ${night.date}`);
    }
    return night;
  }

  it("lists seven consecutive nights from tonight, verdicts on 1-3 and outlooks on 4-7", () => {
    const view = build(result(weekForecast(50)));
    expect(view.nights.map((night) => night.date)).toEqual([
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
    ]);
    expect(view.nights.map((night) => night.label)).toEqual([
      "Sat 10 Oct",
      "Sun 11 Oct",
      "Mon 12 Oct",
      "Tue 13 Oct",
      "Wed 14 Oct",
      "Thu 15 Oct",
      "Fri 16 Oct",
    ]);
    expect(view.nights.map((night) => night.kind)).toEqual([
      "verdict",
      "verdict",
      "verdict",
      "outlook",
      "outlook",
      "outlook",
      "outlook",
    ]);
    for (const night of view.nights.slice(3)) {
      expect(night).not.toHaveProperty("level");
      expect(night).not.toHaveProperty("headline");
      expect(night).not.toHaveProperty("reasonText");
      expect(outlookNight(night).cloudText).toBe("Cloud ~50%");
    }
    for (const night of view.nights) {
      expect(night.darkText).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/);
      expect(night.moonText).toMatch(/^Moon \d{1,3}% · /);
    }
  });

  it.each<[string, ForecastResult | null]>([
    ["a go night", result(weekForecast(5))],
    ["a weather no-go", result(weekForecast(100))],
    ["no forecast", null],
    ["a saved copy", result(weekForecast(5), true)],
  ])("makes night 1 the verdict card's night on %s", (_label, forecast) => {
    const view = build(forecast);
    const first = verdictNight(view.nights[0]);
    expect(first.date).toBe(view.date);
    expect(first.level).toBe(view.verdict.level);
    expect(first.headline).toEqual(view.headline);
    expect(first.reasonText).toBe(view.verdictText);
    expect(view.darkWindow.kind).toBe("window");
    if (view.darkWindow.kind === "window") {
      expect(first.darkText).toBe(`${view.darkWindow.start}–${view.darkWindow.end}`);
    }
  });

  it("reads night 2 as marginal with no weather data when the forecast stops after night 1", () => {
    // The series ends at 11:00 UTC on 11 Oct: after night 1's dark window, before night 2's.
    const view = build(result(hourlyForecast("2026-10-10T00:00:00Z", 36, () => 5)));
    expect(verdictNight(view.nights[0]).level).toBe("go");
    expect(verdictNight(view.nights[1])).toMatchObject({
      level: "marginal",
      headline: { key: "verdict.sky.noForecast", text: "No forecast" },
      reasonText: "no weather data",
    });
  });

  it("reads nights 4-7 as having no cloud outlook yet when the forecast covers only nights 1-3", () => {
    // The series ends at 23:00 UTC on 13 Oct: after night 3's dark window, inside night 4's.
    const view = build(result(hourlyForecast("2026-10-10T00:00:00Z", 96, () => 20)));
    expect(view.nights.slice(0, 3).map((night) => verdictNight(night).reasonText)).not.toContain("no weather data");
    for (const night of view.nights.slice(3)) {
      expect(outlookNight(night).cloudText).toBe("No cloud outlook yet");
      expect(night.darkText).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/);
    }
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

  it("reads no darkness on every night at Tromsø around the solstice", () => {
    const view = build(result(uniformForecast("2026-06-21T00:00:00Z", 0)), {
      site: TROMSO_SITE,
      now: new Date("2026-06-21T20:00:00Z"),
    });
    expect(view.nights).toHaveLength(7);
    for (const night of view.nights) {
      expect(night.darkText).toBe("No darkness");
      expect(night.moonText).toMatch(/^Moon \d{1,3}%$/);
    }
    for (const night of view.nights.slice(0, 3)) {
      expect(verdictNight(night)).toMatchObject({
        level: "no-go",
        headline: { key: "tonight.card.noDarkWindow", text: "No dark window" },
        // The headline already says it; the card's "…tonight" reason wording would misread on nights 2-3.
        reasonText: null,
      });
    }
    for (const night of view.nights.slice(3)) {
      expect(outlookNight(night).cloudText).toBeNull();
    }
  });
});

describe("buildTonight's summary fields (tonight-nightfall)", () => {
  const build = (forecast: ForecastResult | null) =>
    buildTonight({ site: WARSAW, telescope: TELESCOPE, eyepieces: EYEPIECES, forecast, now: NOW }, "en");

  it("gives each night with forecast hours its rounded clear share, and none past the forecast", () => {
    // Every hour 33% cloud until 23:00 UTC on 13 Oct: nights 1-3 are covered, night 4's dark window is not.
    const view = build(result(hourlyForecast("2026-10-10T00:00:00Z", 96, () => 33)));
    expect(view.nights.map((night) => night.clearPct)).toEqual([67, 67, 67, null, null, null, null]);
  });

  it("has no clear share on a night without darkness", () => {
    const view = buildTonight(
      {
        site: TROMSO_SITE,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        forecast: result(uniformForecast("2026-06-21T00:00:00Z", 0)),
        now: new Date("2026-06-21T20:00:00Z"),
      },
      "en",
    );
    expect(view.nights.map((night) => night.clearPct)).toEqual(Array(7).fill(null));
  });

  it("lists the ranking's best three by best time", () => {
    const view = build(result(uniformForecast("2026-10-10T00:00:00Z", 5)));
    const best = rankingOf(view).entries.slice(0, 3);
    expect(view.summaryTargets).toHaveLength(3);
    expect(view.summaryTargets.map((entry) => entry.id).sort()).toEqual(best.map((entry) => entry.id).sort());
    const times = view.summaryTargets.map((entry) => entry.bestAt);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // This night's top three peak out of rank order, so the order above is the sort's doing.
    expect(view.summaryTargets.map((entry) => entry.rank)).not.toEqual([1, 2, 3]);
  });

  it("has no summary targets on a no-go night", () => {
    expect(build(result(uniformForecast("2026-10-10T00:00:00Z", 100))).summaryTargets).toEqual([]);
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

  it("lists the planets on a go night with facts, the detail eyepiece, a reason and a note", () => {
    const planets = planetsOf(buildTonight(input, "en"));
    expect(planets.windowText).toBe(`From civil dusk to dawn, ${hhmm(civil.start)}–${hhmm(civil.end)}`);
    // The verdict card already speaks for the planet window on a go night.
    expect(planets.weatherText).toBeNull();
    expect(planets.entries.length).toBeGreaterThan(0);
    expect(planets.noneText).toBeNull();
    for (const entry of planets.entries) {
      expect(PLANET_KEYS).toContain(entry.key);
      expect(entry.name).toBe(en.targets.planet[entry.key]);
      expect(entry.windowStart).toMatch(/^\d{2}:\d{2}$/);
      expect(entry.bestTime).toMatch(/^\d{2}:\d{2}$/);
      expect(entry.bestDirection).toMatch(/^[NESW]{1,3}, \d{1,2}°$/);
      expect(entry.magnitudeText).toMatch(/^mag −?\d+\.\d$/);
      expect(entry.sizeText).toMatch(/^\d+(\.\d)?″$/);
      expect(entry.phaseText === null).toBe(entry.key !== "mercury" && entry.key !== "venus");
      expect(entry.ringText === null).toBe(entry.key !== "saturn");
      // The 10 mm is the most magnification the 150 mm takes within the limits (75×).
      expect(entry.eyepiece).toEqual({ name: "10 mm Plössl", magnification: 75 });
      expect(entry.reason).toMatch(/^(High|Well up|Low) around \d{2}:\d{2} — /);
      expect(entry.note).toBe(en.tonight.planets.note[entry.key]);
      expect(entry.seenText).toBeNull();
    }
    const saturn = planets.entries.find((entry) => entry.key === "saturn");
    expect(saturn?.ringText).toMatch(/^rings tilted \d+°$/);
  });

  it("words the planets in Polish with the locale's decimal comma", () => {
    const planets = planetsOf(buildTonight(input, "pl"));
    const saturn = planets.entries.find((entry) => entry.key === "saturn");
    expect(planets.windowText).toMatch(/^Od zmierzchu cywilnego do świtu, \d{2}:\d{2}–\d{2}:\d{2}$/);
    expect(saturn).toMatchObject({ name: "Saturn", note: pl.tonight.planets.note.saturn });
    expect(saturn?.magnitudeText).toMatch(/^jasność −?\d+,\d mag$/);
    expect(saturn?.ringText).toMatch(/^pierścienie nachylone o \d+°$/);
  });

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

  it("says no planet is well placed on a go night when none clears the site's minimum altitude", () => {
    // Nothing reaches 70° from Warsaw on 10 October.
    const view = buildTonight({ ...input, site: { ...WARSAW, minAltitudeDeg: 70 } }, "en");
    expect(view.verdict.level).toBe("go");
    const planets = planetsOf(view);
    expect(planets.entries).toEqual([]);
    expect(planets.noneText).toBe(en.tonight.planets.none);
    expect(planets.noneText).toBe("No planet is well placed for your telescope between dusk and dawn tonight.");
  });

  it("gives the planet weather line when the planet verdict differs from a go on the card", () => {
    // 95% humidity only in the evening civil twilight, before any hour that overlaps the dark window.
    const humid = uniformForecast("2026-10-10T00:00:00Z", 5);
    humid.hours = humid.hours.map((hour) =>
      hour.start.getTime() + HOUR_MS > civil.start.getTime() &&
      hour.start.getTime() < dark.start.getTime() &&
      !overlapsDark(hour.start)
        ? { ...hour, humidityPct: 95 }
        : hour,
    );
    const view = buildTonight({ ...input, forecast: result(humid) }, "en");
    expect(view.verdict.level).toBe("go");
    const planets = planetsOf(view);
    expect(planets.weatherText).toBe(
      "For planets: clear, but damp — clear enough between dusk and dawn, but humidity reaches 95%, so expect dew and haze",
    );
    // On a go night the planets are ranked over the whole planet window, as before.
    expect(planets.entries.map((entry) => entry.key)).toEqual(
      planetsOf(buildTonight(input, "en")).entries.map((entry) => entry.key),
    );
  });

  it("keeps the verdict, ranking and strip when working out the planets fails", () => {
    const working = buildTonight(input, "en");
    planetRanking.throws = true;
    const view = buildTonight(input, "en");
    expect(view.solarSystem).toBeNull();
    expect(view.verdict).toEqual(working.verdict);
    expect(view.ranking).toEqual(working.ranking);
    expect(view.nights).toEqual(working.nights);
  });

  it("lists the planets on a no-darkness night whose planet window passes", () => {
    // Warsaw at the solstice under a Bortle 3 sky: the sun never reaches −18°, but it does pass −6°.
    const view = buildTonight(
      {
        ...input,
        site: { ...WARSAW, bortle: 3 },
        forecast: result(uniformForecast("2026-06-21T00:00:00Z", 5)),
        now: new Date("2026-06-21T19:00:00Z"),
      },
      "en",
    );
    expect(view.darkWindow).toEqual({ kind: "none" });
    expect(view.verdict).toEqual({ level: "no-go", reason: { kind: "no-darkness" } });
    expect(view.ranking).toBeNull();
    const planets = planetsOf(view);
    // Every hour of the planet window is clear, so the clear hours are the whole window.
    expect(planets.weatherText).toMatch(/^For planets: clear — clear \d{2}:\d{2}–\d{2}:\d{2}$/);
    expect(planets.entries.length).toBeGreaterThan(0);
  });

  it("has no planets when the planet window is clouded out", () => {
    const view = buildTonight({ ...input, forecast: result(uniformForecast("2026-10-10T00:00:00Z", 100)) }, "en");
    expect(view.solarSystem).toBeNull();
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
  });

  it("lists Uranus and Neptune only with an aperture of at least 130 mm", () => {
    const keysWith = (apertureMm: number) =>
      planetsOf(buildTonight({ ...input, telescope: { ...TELESCOPE, apertureMm } }, "en")).entries.map(
        (entry) => entry.key,
      );
    expect(keysWith(ICE_GIANT_MIN_APERTURE_MM)).toEqual(expect.arrayContaining(["uranus", "neptune"]));
    const small = keysWith(ICE_GIANT_MIN_APERTURE_MM - 1);
    expect(small.length).toBeGreaterThan(0);
    expect(small).not.toContain("uranus");
    expect(small).not.toContain("neptune");
  });

  it("tags a logged planet as seen without reordering the planets", () => {
    const unlogged = planetsOf(buildTonight(input, "en"));
    const view = buildTonight({ ...input, log: [{ target: "saturn", night: "2026-10-01", rating: 4 }] }, "en");
    const planets = planetsOf(view);
    expect(planets.entries.map((entry) => entry.key)).toEqual(unlogged.entries.map((entry) => entry.key));
    expect(planets.entries.find((entry) => entry.key === "saturn")?.seenText).toBe("Seen 1 time – last 1 Oct 2026");
    expect(planets.entries.filter((entry) => entry.key !== "saturn").every((entry) => entry.seenText === null)).toBe(
      true,
    );
  });

  it("leaves the planet detail eyepiece out when the kit has none", () => {
    const planets = planetsOf(buildTonight({ ...input, eyepieces: [] }, "en"));
    expect(planets.entries.every((entry) => entry.eyepiece === null)).toBe(true);
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

  /** The phase line for a state, as the card words it in English. */
  function englishPhase(state: Pick<MoonDiscState, "band" | "illuminatedFraction">): string {
    return en.tonight.moon.phaseLine({
      phase: en.tonight.moon.phase[state.band],
      lit: en.tonight.moon.lit({ percent: String(Math.round(state.illuminatedFraction * 100)) }),
    });
  }

  describe("on a go night with a dark window", () => {
    it("covers the dark window in 10-minute states, labelled in the site's zone", () => {
      const view = buildTonight(clearNight("2026-10-26"), "en");
      const card = moonCardOf(view);
      const dark = warsawWindow("2026-10-26", darknessThresholdDegForBortle(WARSAW.bortle));
      expect(card.windowKind).toBe("dark");
      expect(view.darkWindow).toEqual({ kind: "window", ...card.window });
      expect(card.states.length).toBeGreaterThan(1);
      expect(card.timeLabels).toHaveLength(card.states.length);
      expect(card.states[0].time).toBe(dark.start.toISOString());
      expect(card.states.at(-1)?.time).toBe(dark.end.toISOString());
      expect(Date.parse(card.states[1].time) - Date.parse(card.states[0].time)).toBe(MOON_DISC_STEP_MINUTES * 60_000);
      expect(card.timeLabels[0]).toBe(card.window?.start);
      expect(card.timeLabels.at(-1)).toBe(card.window?.end);
    });

    it("says how many faint objects the Moon washes out on 26 October, with no percent of its own", () => {
      const view = buildTonight(clearNight("2026-10-26"), "en");
      const card = moonCardOf(view);
      const count = rankingOf(view).washedOutCount;
      expect(count).toBeGreaterThan(0);
      expect(card.upText).toBe("Up all night");
      expect(card.faintText).toBe(en.tonight.moon.card.faint.washedOut.other({ count: String(count) }));
      expect(card.faintText).toMatch(/^Bright Moon: \d+ faint objects washed out tonight$/);
      const polish = moonCardOf(buildTonight(clearNight("2026-10-26"), "pl"));
      expect(polish.faintText).toMatch(/^Jasny Księżyc: \d+ słab/);
      expect(polish.upText).toBe("Nad horyzontem przez całą noc");
    });

    it("calls a Moon up the whole window without washed-out objects a moonlit sky (1 September)", () => {
      const view = buildTonight(clearNight("2026-09-01"), "en");
      expect(rankingOf(view).washedOutCount).toBe(0);
      const card = moonCardOf(view);
      expect(card.upText).toBe("Up all night");
      expect(card.faintText).toBe("Moonlit sky · no faint objects lost");
    });

    it("names the Moon's up time when it sets mid-window without washing anything out (20 October)", () => {
      const view = buildTonight(clearNight("2026-10-20"), "en");
      expect(rankingOf(view).washedOutCount).toBe(0);
      const card = moonCardOf(view);
      // Up at dusk, down from the first 10-minute sample after it sets.
      const sets = /^Sets (\d{2}:\d{2})$/.exec(card.upText ?? "")?.[1];
      expect(sets).toBeDefined();
      expect(card.faintText).toBe(`Moon up ${card.window?.start}–${sets} · no faint objects washed out`);
      expect(card.timeLabels).toContain(sets);
      expect(moonCardOf(buildTonight(clearNight("2026-10-20"), "pl")).faintText).toBe(
        `Księżyc nad horyzontem w godz. ${card.window?.start}–${sets} · żaden słaby obiekt nie ginie`,
      );
    });

    it("names the rising time when the Moon comes up mid-window (6 October)", () => {
      const view = buildTonight(clearNight("2026-10-06"), "en");
      expect(rankingOf(view).washedOutCount).toBe(0);
      const card = moonCardOf(view);
      // Down at dusk, up from the first 10-minute sample after it rises, then up to the window's end.
      const rises = /^Up (\d{2}:\d{2})–(\d{2}:\d{2})$/.exec(card.upText ?? "");
      expect(rises?.[2]).toBe(card.window?.end);
      expect(card.timeLabels.slice(1)).toContain(rises?.[1]);
      expect(card.faintText).toBe(`Moon up ${rises?.[1]}–${rises?.[2]} · no faint objects washed out`);
    });

    it("calls the new-Moon night of 10 October dark, with no Moon target", () => {
      const view = buildTonight(clearNight("2026-10-10"), "en");
      expect(rankingOf(view).washedOutCount).toBe(0);
      const card = moonCardOf(view);
      expect(card.upText).toBe("Not up tonight");
      expect(card.faintText).toBe("Dark night: no Moon");
      expect(card.target).toBeNull();
      expect(moonCardOf(buildTonight(clearNight("2026-10-10"), "pl")).faintText).toBe("Ciemna noc: bez Księżyca");
    });

    it("shows the state nearest the page load, clamped into the window", () => {
      const dark = warsawWindow("2026-10-26", darknessThresholdDegForBortle(WARSAW.bortle));
      // 16:00 UTC is before dusk: the first state.
      const before = moonCardOf(buildTonight(clearNight("2026-10-26"), "en"));
      expect(before.initialIndex).toBe(0);
      expect(before.phaseText).toBe(englishPhase(before.states[0]));

      const now = new Date(dark.start.getTime() + 2 * HOUR_MS + 7 * 60_000);
      const during = moonCardOf(buildTonight(clearNight("2026-10-26", { now }), "en"));
      const shown = during.states[during.initialIndex];
      expect(Math.abs(Date.parse(shown.time) - now.getTime())).toBeLessThanOrEqual(
        (MOON_DISC_STEP_MINUTES / 2) * 60_000,
      );
      expect(during.phaseText).toBe(englishPhase(shown));

      // After the dark window, before civil dawn: the night in progress, at its last state.
      const late = new Date(dark.end.getTime() + 30 * 60_000);
      const after = moonCardOf(buildTonight(clearNight("2026-10-26", { now: late }), "en"));
      expect(after.initialIndex).toBe(after.states.length - 1);
    });

    it("puts the full Moon's observing details in the card on 26 October", () => {
      const view = buildTonight(clearNight("2026-10-26"), "en");
      expect(targetOf(view)).toMatchObject({
        key: "moon",
        name: "Moon",
        band: "full",
        // The 25 mm shows 1.7°, the whole disc; the 10 mm is the detail pick at 75×.
        wholeDisc: { name: "25 mm Plössl", magnification: 30 },
        wholeDiscFits: true,
        detail: { name: "10 mm Plössl", magnification: 75 },
        note: en.tonight.moon.note.full,
        seenText: null,
      });
      expect(targetOf(view).windowStart).toMatch(/^\d{2}:\d{2}$/);
      expect(targetOf(view).bestDirection).toMatch(/^[NESW]{1,3}, \d{1,2}°$/);
      expect(targetOf(view).reason).toMatch(/^Highest \d{1,2}° at \d{2}:\d{2} — best in the middle of the night$/);
      // The planets keep their own section, planets only.
      expect(view.solarSystem?.entries.length).toBeGreaterThan(0);
      expect(view.solarSystem).not.toHaveProperty("moon");
    });

    it("words the card and the target in Polish", () => {
      const view = buildTonight(clearNight("2026-10-26"), "pl");
      expect(moonCardOf(view).phaseText).toMatch(/^(Pełnia|Garbaty (przybywający|ubywający)) · oświetlony w \d{2,3}%$/);
      expect(targetOf(view)).toMatchObject({ name: "Księżyc", note: pl.tonight.moon.note.full });
      expect(targetOf(view).reason).toMatch(/^Najwyżej \d{1,2}° o \d{2}:\d{2} — najlepiej w środku nocy$/);
    });
  });

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

  it("covers civil dusk to dawn on a no-darkness night, with no faint line", () => {
    // Warsaw under a Bortle 3 sky at the end of June: the sun never reaches −18°, but it passes −6°.
    const site = { ...WARSAW, bortle: 3 };
    const view = buildTonight(
      clearNight("2026-06-29", {
        site,
        forecast: result(uniformForecast("2026-06-29T00:00:00Z", 5)),
        now: new Date("2026-06-29T19:00:00Z"),
      }),
      "en",
    );
    expect(view.darkWindow).toEqual({ kind: "none" });
    const civil = warsawWindow("2026-06-29", PLANET_WINDOW_SUN_ALTITUDE_DEG, site);
    const card = moonCardOf(view);
    expect(card.windowKind).toBe("civil");
    expect(card.states[0].time).toBe(civil.start.toISOString());
    expect(card.states.at(-1)?.time).toBe(civil.end.toISOString());
    expect(card.upText).not.toBeNull();
    expect(card.faintText).toBeNull();
    // The planet window passes, so the Moon is judged under the same gate as the planets.
    expect(view.solarSystem).not.toBeNull();
  });

  it("shows only the phase at local noon without a civil window (Tromsø at the solstice)", () => {
    const view = buildTonight(
      clearNight("2026-06-21", {
        site: TROMSO_SITE,
        forecast: result(uniformForecast("2026-06-21T00:00:00Z", 0)),
        now: new Date("2026-06-21T20:00:00Z"),
      }),
      "en",
    );
    const noon = moonDiscState(observingNight("2026-06-21", TROMSO_SITE.timeZone).start);
    expect(view.moonCard).toEqual({
      window: null,
      windowKind: "none",
      states: [],
      timeLabels: [],
      initialIndex: 0,
      phaseText: englishPhase(noon),
      upText: null,
      faintText: null,
      target: null,
    });
  });

  it("works out the faint line and the target without a forecast", () => {
    const view = buildTonight(clearNight("2026-10-26", { forecast: null }), "en");
    expect(view.headline.key).toBe("verdict.sky.noForecast");
    const card = moonCardOf(view);
    expect(card.windowKind).toBe("dark");
    expect(card.faintText).toMatch(/^Bright Moon: \d+ faint objects washed out tonight$/);
    expect(card.target).not.toBeNull();
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

  it("is deterministic: identical inputs give an identical card", () => {
    expect(buildTonight(clearNight("2026-10-26"), "en").moonCard).toEqual(
      buildTonight(clearNight("2026-10-26"), "en").moonCard,
    );
  });

  it("keeps the Moon target when working out the planets fails", () => {
    const working = buildTonight(clearNight("2026-10-26"), "en");
    planetRanking.throws = true;
    const view = buildTonight(clearNight("2026-10-26"), "en");
    expect(view.solarSystem).toBeNull();
    expect(view.moonCard).toEqual(working.moonCard);
    expect(view.ranking).toEqual(working.ranking);
  });

  it("drops only the target when working it out fails", () => {
    const working = buildTonight(clearNight("2026-10-26"), "en");
    moonTargeting.throws = true;
    const view = buildTonight(clearNight("2026-10-26"), "en");
    expect(view.moonCard).toEqual({ ...working.moonCard, target: null });
    expect(view.solarSystem).toEqual(working.solarSystem);
    expect(view.verdict).toEqual(working.verdict);
    expect(view.ranking).toEqual(working.ranking);
    expect(view.nights).toEqual(working.nights);
  });

  it("tags a logged Moon as seen", () => {
    const view = buildTonight(
      clearNight("2026-10-26", { log: [{ target: "moon", night: "2026-10-01", rating: 5 }] }),
      "en",
    );
    expect(targetOf(view).seenText).toBe("Seen 1 time – last 1 Oct 2026");
  });

  it("shows only the whole-disc eyepiece when the detail pick is no stronger, and none for an empty kit", () => {
    const single = buildTonight(clearNight("2026-10-26", { eyepieces: [EYEPIECES[0]] }), "en");
    expect(targetOf(single)).toMatchObject({
      wholeDisc: { name: "25 mm Plössl", magnification: 30 },
      wholeDiscFits: true,
      detail: null,
    });
    // A 6 mm alone shows 0.42°, short of the whole disc: it is named as the widest, with no separate detail pick.
    const short = buildTonight(
      clearNight("2026-10-26", {
        eyepieces: [{ id: "ep-3", name: "6 mm", focalLengthMm: 6, afovDeg: 52, createdAt: "2026-09-01T00:02:00Z" }],
      }),
      "en",
    );
    expect(targetOf(short)).toMatchObject({
      wholeDisc: { name: "6 mm", magnification: 125 },
      wholeDiscFits: false,
      detail: null,
    });
    const empty = buildTonight(clearNight("2026-10-26", { eyepieces: [] }), "en");
    expect(targetOf(empty)).toMatchObject({ wholeDisc: null, wholeDiscFits: false, detail: null });
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

  it("counts and lists the faint objects the full Moon of 26 October hides, apart from the ranking", () => {
    const ranking = rankingOf(buildTonight(clearNight("2026-10-26"), "en"));
    expect(ranking.washedOutCount).toBeGreaterThan(0);
    expect(ranking.washedOutEntries).toHaveLength(ranking.washedOutCount);
    expect(ranking.washedOutText).toBe(
      ranking.washedOutCount === 1
        ? en.tonight.washedOut.line.one({ count: "1" })
        : en.tonight.washedOut.line.other({ count: String(ranking.washedOutCount) }),
    );
    const listed = new Set(ranking.entries.map((e) => e.id));
    for (const entry of ranking.washedOutEntries) {
      expect(listed.has(entry.id)).toBe(false);
      expect(entry.bestTime).toMatch(/^\d{2}:\d{2}$/);
    }
    const bestAt = ranking.washedOutEntries.map((e) => e.bestAt);
    expect(bestAt).toEqual([...bestAt].sort((a, b) => a - b));
  });

  it("words the line in Polish", () => {
    const ranking = rankingOf(buildTonight(clearNight("2026-10-26"), "pl"));
    expect(ranking.washedOutText).toMatch(/ginie dziś w blasku Księżyca|giną dziś w blasku Księżyca/);
  });

  it("lists the same washed-out objects on the all-objects page, whatever the limit", () => {
    const top = rankingOf(buildTonight(clearNight("2026-10-26"), "en"));
    const all = rankingOf(buildTonight(clearNight("2026-10-26"), "en", { limit: Number.POSITIVE_INFINITY }));
    expect(all.washedOutEntries).toEqual(top.washedOutEntries);
    const listed = new Set(all.entries.map((e) => e.id));
    expect(top.washedOutEntries.filter((e) => listed.has(e.id))).toEqual([]);
  });

  it("has no line and no group on the new-Moon night of 10 October", () => {
    const ranking = rankingOf(buildTonight(clearNight("2026-10-10"), "en"));
    expect(ranking.washedOutCount).toBe(0);
    expect(ranking.washedOutText).toBeNull();
    expect(ranking.washedOutEntries).toEqual([]);
  });
});
