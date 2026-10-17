import { describe, expect, it } from "vitest";

import { DEEP_SKY } from "@/lib/catalogue";

import {
  darkWindow,
  darknessThresholdDegForBortle,
  observingNight,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  rankObjects,
  rankPlanets,
  seenSummaries,
  sevenNightOutlook,
} from "./index";
import type { LogEntry, PlanetEntry, Ranking, Site } from "./index";

/**
 * The PRD's determinism NFR (identical inputs → identical verdict and ranking), as tests over the full S-02
 * ranking (`rankObjects`: scoring, sorting, reasons and eyepiece pairing), the seven-night outlook and the
 * planet list. The ranking-time budget (NFR "ranking under a second") is not a test: a wall-clock bound is
 * not a reliable signal on shared runners.
 */

const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };

/** Dates as epoch milliseconds, so two results compare as the exact numbers they hold. */
const asNumbers = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) => (v instanceof Date ? v.getTime() : v));

/** The S-02 ranking for Warsaw on `date` (2026-10-10 by default): Bortle 6, a 150/750 telescope, 25 mm and 10 mm Plössls. */
function fullRanking(log: readonly LogEntry[] = [], date = "2026-10-10"): Ranking {
  const bortle = 6;
  const night = observingNight(date, WARSAW.timeZone);
  const dark = darkWindow(WARSAW, night, darknessThresholdDegForBortle(bortle));
  if (dark.kind !== "window") {
    throw new Error(`expected a dark window on ${date} in Warsaw`);
  }
  return rankObjects({
    site: WARSAW,
    bortle,
    minAltitudeDeg: 15,
    darkWindow: dark,
    telescope: { id: "t1", apertureMm: 150, focalLengthMm: 750 },
    eyepieces: [
      { id: "e25", focalLengthMm: 25, afovDeg: 50 },
      { id: "e10", focalLengthMm: 10, afovDeg: 50 },
    ],
    catalogue: DEEP_SKY,
    seen: seenSummaries(log, date),
  });
}

/** The planets for Warsaw on 2026-10-10 over the civil window, with a 150/750 telescope and a small log. */
function planets(): PlanetEntry[] {
  const night = observingNight("2026-10-10", WARSAW.timeZone);
  const civil = darkWindow(WARSAW, night, PLANET_WINDOW_SUN_ALTITUDE_DEG);
  if (civil.kind !== "window") {
    throw new Error("expected a civil window on 2026-10-10 in Warsaw");
  }
  return rankPlanets({
    site: WARSAW,
    minAltitudeDeg: 15,
    planetWindow: civil,
    telescope: { apertureMm: 150, focalLengthMm: 750 },
    eyepieces: [
      { id: "e25", focalLengthMm: 25, afovDeg: 50 },
      { id: "e10", focalLengthMm: 10, afovDeg: 50 },
    ],
    seen: seenSummaries([{ target: "saturn", night: "2026-10-01", rating: 4 }], "2026-10-10"),
  });
}

describe("determinism (PRD NFR: identical inputs give identical results)", () => {
  it("yields deep-equal rankings for two identical runs: a clear new-Moon night, a night with a log, a full-Moon night", () => {
    // A clear-sky new-moon night.
    const plain = fullRanking();
    expect(plain.entries.length, "new-Moon night ranks something").toBeGreaterThan(0);
    const again = fullRanking();
    expect(again, "new-Moon night: second run").toEqual(plain);
    expect(asNumbers(again), "new-Moon night: second run, dates as numbers").toBe(asNumbers(plain));

    // A non-empty observation log: deep-equal, and the log does change the ranking.
    const [first, second, third] = plain.entries.map((e) => e.object.id);
    const log: LogEntry[] = [
      { target: first, night: "2026-09-12", rating: 4 },
      { target: first, night: "2026-10-01", rating: 5 },
      { target: second, night: "2026-09-20", rating: 3 },
      // Invariant 4: a failed attempt never demotes.
      { target: third, night: "2026-10-05", rating: 2 },
    ];
    const logged = fullRanking(log);
    expect(fullRanking(log), "logged night: second run").toEqual(logged);
    expect(
      logged.entries.map((e) => e.object.id),
      "the log changes the order",
    ).not.toEqual(plain.entries.map((e) => e.object.id));
    expect(logged.clearedCount, "the log never changes the cleared count").toBe(plain.clearedCount);

    // A full Moon: washed-out objects included.
    const fullMoon = fullRanking([], "2026-10-26");
    expect(fullMoon.washedOutCount, "full-Moon night has washed-out objects").toBeGreaterThan(0);
    expect(asNumbers(fullRanking([], "2026-10-26")), "full-Moon night: second run").toBe(asNumbers(fullMoon));
  });

  it("yields deep-equal seven-night outlooks and planet lists for two identical inputs", () => {
    const hours = Array.from({ length: 9 * 24 }, (_, i) => ({
      start: new Date(Date.UTC(2026, 9, 20) + i * 3_600_000),
      cloudCoverPct: (i * 37) % 101,
      humidityPct: 60 + (i % 30),
    }));
    const input = { site: WARSAW, thresholdDeg: -18, date: "2026-10-21", forecast: { hours }, fallback: false };
    const outlook = sevenNightOutlook(input);
    expect(outlook, "outlook has seven nights").toHaveLength(7);
    expect(sevenNightOutlook(input), "outlook: second run").toEqual(outlook);
    expect(asNumbers(sevenNightOutlook(input)), "outlook: second run, dates as numbers").toBe(asNumbers(outlook));

    const once = planets();
    expect(once.length, "planets: something is listed").toBeGreaterThan(0);
    expect(planets(), "planets: second run").toEqual(once);
    expect(asNumbers(planets()), "planets: second run, dates as numbers").toBe(asNumbers(once));
  });
});
