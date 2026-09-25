import { describe, expect, it } from "vitest";

import { findMessier, MESSIER } from "@/lib/catalogue";
import { MAX_RANKED_OBJECTS, type HourlyForecast } from "@/lib/engine";
import type { EyepieceRecord, SiteRecord, TelescopeRecord } from "@/lib/gear/store";

import { buildTonight, type TonightRanking, type TonightView } from "./build";

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

/** Hourly forecast from 00:00 UTC on `fromUtc` for 48 h, every hour at `cloudPct`. */
function uniformForecast(fromUtc: string, cloudPct: number): HourlyForecast {
  const start = Date.parse(fromUtc);
  return {
    hours: Array.from({ length: 48 }, (_, i) => ({
      start: new Date(start + i * 3_600_000),
      cloudCoverPct: cloudPct,
      humidityPct: 60,
    })),
  };
}

function rankingOf(view: TonightView): TonightRanking {
  if (view.ranking === null) {
    throw new Error("expected a ranking");
  }
  return view.ranking;
}

describe("buildTonight", () => {
  it("ranks a clear night, formats times in the site's zone and pairs the kit's eyepieces", () => {
    const view = buildTonight({
      site: WARSAW,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      forecast: uniformForecast("2026-10-10T00:00:00Z", 5),
      now: NOW,
    });

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

  it("reports magnifications for a pair and the widest eyepiece when none fits", () => {
    const view = buildTonight({
      site: WARSAW,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      forecast: uniformForecast("2026-10-10T00:00:00Z", 5),
      now: NOW,
    });
    const pairs = rankingOf(view).entries.map((entry) => entry.pair);
    for (const pair of pairs) {
      if (pair?.kind === "pair") {
        expect([30, 75]).toContain(pair.finding.magnification);
        expect([30, 75]).toContain(pair.detail.magnification);
      } else {
        expect(pair).toEqual({ kind: "none-fit", widestName: "25 mm Plössl" });
      }
    }
  });

  it("leaves the pair out when the kit has no eyepieces", () => {
    const view = buildTonight({
      site: WARSAW,
      telescope: TELESCOPE,
      eyepieces: [],
      forecast: uniformForecast("2026-10-10T00:00:00Z", 5),
      now: NOW,
    });
    expect(view.hasEyepieces).toBe(false);
    expect(rankingOf(view).entries.length).toBeGreaterThan(0);
    expect(rankingOf(view).entries.every((entry) => entry.pair === null)).toBe(true);
  });

  it("has no ranking on a no-go night", () => {
    const view = buildTonight({
      site: WARSAW,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      forecast: uniformForecast("2026-10-10T00:00:00Z", 100),
      now: NOW,
    });
    expect(view.verdict.level).toBe("no-go");
    expect(view.verdictText).toBe("too cloudy: the clearest dark hour has 100% cloud");
    expect(view.ranking).toBeNull();
  });

  it("has no ranking without a dark window", () => {
    const view = buildTonight({
      site: HELSINKI_DARK,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      forecast: uniformForecast("2026-06-21T00:00:00Z", 0),
      now: new Date("2026-06-21T19:00:00Z"),
    });
    expect(view.darkWindow).toEqual({ kind: "none" });
    expect(view.verdict).toEqual({ level: "no-go", reason: { kind: "no-darkness" } });
    expect(view.ranking).toBeNull();
  });

  it("defaults to marginal with a ranking when there is no forecast", () => {
    const view = buildTonight({ site: WARSAW, telescope: TELESCOPE, eyepieces: EYEPIECES, forecast: null, now: NOW });
    expect(view.verdict).toEqual({ level: "marginal", reason: { kind: "no-weather-data" } });
    expect(view.verdictText).toBe("no weather data");
    expect(view.ranking?.entries.length).toBeGreaterThan(0);
  });

  it("carries an empty ranking on a go night when nothing clears the bar", () => {
    // M7 (Dec −35°) never rises above 15° from Warsaw, so it can never score.
    const view = buildTonight({
      site: WARSAW,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      forecast: uniformForecast("2026-10-10T00:00:00Z", 5),
      now: NOW,
      catalogue: MESSIER.filter((object) => object.messier === 7),
    });
    expect(view.verdict.level).toBe("go");
    expect(view.ranking).toEqual({ clearedCount: 0, clearedText: "No object cleared the bar tonight", entries: [] });
  });

  it("treats 01:30 local as the night in progress", () => {
    const view = buildTonight({
      site: WARSAW,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      forecast: null,
      now: new Date("2026-10-10T23:30:00Z"),
    });
    expect(view.date).toBe("2026-10-10");
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      site: WARSAW,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      forecast: uniformForecast("2026-10-10T00:00:00Z", 20),
      now: NOW,
    };
    expect(buildTonight(input)).toEqual(buildTonight(input));
  });
});
