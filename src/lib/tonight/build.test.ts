import { describe, expect, it } from "vitest";

import { findMessier, MESSIER } from "@/lib/catalogue";
import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";
import {
  darknessThresholdDegForBortle,
  darkWindow,
  ICE_GIANT_MIN_APERTURE_MM,
  MAX_RANKED_OBJECTS,
  observingNight,
  PLANET_KEYS,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  type HourlyForecast,
} from "@/lib/engine";
import { TROMSO } from "@/lib/engine/fixtures";
import type { ForecastResult } from "@/lib/forecast/service";
import { toEngineSite, type EyepieceRecord, type SiteRecord, type TelescopeRecord } from "@/lib/gear/store";

import { buildTonight, type TonightNight, type TonightPlanets, type TonightRanking, type TonightView } from "./build";

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
    expect(view.verdict).toEqual({ level: "no-go", reason: { kind: "no-darkness" } });
    expect(view.ranking).toBeNull();
  });

  it("defaults to marginal with a ranking when there is no forecast", () => {
    const view = buildTonight(
      { site: WARSAW, telescope: TELESCOPE, eyepieces: EYEPIECES, forecast: null, now: NOW },
      "en",
    );
    expect(view.verdict).toEqual({ level: "marginal", reason: { kind: "no-weather-data" } });
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
    expect(view.ranking).toEqual({ clearedCount: 0, clearedText: "No object cleared the bar tonight", entries: [] });
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
      expect(view.explanation.nextText).toMatch(/^Next night worth a look: Monday, 12 October 2026 — go, /);
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
    expect(verdictNight(view.nights[1])).toMatchObject({ level: "marginal", reasonText: "no weather data" });
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
        // The dark-window column already says "No darkness"; the card's "…tonight" wording would misread here.
        reasonText: null,
      });
    }
    for (const night of view.nights.slice(3)) {
      expect(outlookNight(night).cloudText).toBeNull();
    }
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

  function planetsOf(view: TonightView): TonightPlanets {
    if (view.planets === null) {
      throw new Error("expected planets");
    }
    return view.planets;
  }

  it("lists the planets on a go night with facts, the detail eyepiece, a reason and a note", () => {
    const planets = planetsOf(buildTonight(input, "en"));
    const civil = darkWindow(engineSite, night, PLANET_WINDOW_SUN_ALTITUDE_DEG);
    if (civil.kind !== "window") {
      throw new Error("expected a planet window");
    }
    const hhmm = (instant: Date) => utcWallTime(instant, 2);
    expect(planets.windowText).toBe(`From civil dusk to dawn, ${hhmm(civil.start)}–${hhmm(civil.end)}`);
    // The verdict card already speaks for the planet window on a go night.
    expect(planets.weatherText).toBeNull();
    expect(planets.entries.length).toBeGreaterThan(0);
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

  it("lists the planets on a cloudy no-go night whose twilight is clear, with the planet weather line", () => {
    if (dark.kind !== "window") {
      throw new Error("expected a dark window");
    }
    // Every forecast hour that overlaps the dark window is overcast; the twilight hours either side are clear.
    const forecast = hourlyForecast("2026-10-10T00:00:00Z", 48, (start) =>
      start.getTime() < dark.end.getTime() && start.getTime() + HOUR_MS > dark.start.getTime() ? 100 : 5,
    );
    const view = buildTonight({ ...input, forecast: result(forecast) }, "en");
    expect(view.verdict.level).toBe("no-go");
    expect(view.ranking).toBeNull();
    const planets = planetsOf(view);
    expect(planets.weatherText).toBe(
      "For planets: marginal — 1 h in a row with at most 5% cloud between dusk and dawn",
    );
    expect(planets.entries.length).toBeGreaterThan(0);
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
    expect(planets.weatherText).toMatch(
      /^For planets: go — \d+ h in a row with at most 5% cloud between dusk and dawn$/,
    );
    expect(planets.entries.length).toBeGreaterThan(0);
  });

  it("has no planets when the planet window is clouded out", () => {
    const view = buildTonight({ ...input, forecast: result(uniformForecast("2026-10-10T00:00:00Z", 100)) }, "en");
    expect(view.planets).toBeNull();
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
    expect(view.planets).toBeNull();
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
