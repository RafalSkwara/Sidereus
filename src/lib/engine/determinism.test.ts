import { beforeAll, describe, expect, it } from "vitest";

import { DEEP_SKY } from "@/lib/catalogue";

import {
  darkWindow,
  darknessThresholdDegForBortle,
  moonTrack,
  objectTracks,
  observingNight,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  rankObjects,
  rankPlanets,
  seenSummaries,
  sevenNightOutlook,
} from "./index";
import type { HorizontalPosition, LogEntry, MoonState, PlanetEntry, Ranking, Site } from "./index";

/**
 * The PRD's determinism NFR (identical inputs → identical verdict and ranking) and the ranking-time
 * NFR ("ranking under a second"), as tests over the engine's position-sampling share (the dark
 * window, the Moon track and one track per catalogue object over the dark window) and over the full
 * S-02 ranking (`rankObjects`: scoring, sorting, reasons and eyepiece pairing on top of that).
 *
 * The timing budget is asserted locally only. On CI the measured time is logged but not asserted,
 * because shared runners are too noisy for a wall-clock bound to be a reliable signal. `process.env`
 * is read here, in a test file, which the purity guard excludes.
 */

const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };
const LOCAL_BUDGET_MS = 1000;

interface FullRun {
  dark: ReturnType<typeof darkWindow>;
  moon: MoonState[];
  objects: Record<string, HorizontalPosition[]>;
}

interface Timed {
  run: FullRun;
  ms: number;
}

function fullRun(): FullRun {
  const night = observingNight("2026-10-10", WARSAW.timeZone);
  const dark = darkWindow(WARSAW, night, -18);
  if (dark.kind !== "window") {
    throw new Error("expected a dark window on 2026-10-10 in Warsaw");
  }
  const moon = moonTrack(WARSAW, dark);
  const tracks = objectTracks(
    WARSAW,
    dark,
    DEEP_SKY.map((o) => ({ raHours: o.raHours, decDeg: o.decDeg })),
  );
  const objects: Record<string, HorizontalPosition[]> = {};
  DEEP_SKY.forEach((object, i) => {
    objects[object.id] = tracks[i];
  });
  return { dark, moon, objects };
}

function timed(): Timed {
  const started = performance.now();
  const run = fullRun();
  return { run, ms: performance.now() - started };
}

describe("engine determinism and budget", () => {
  let runs: { first: Timed; second: Timed } | null = null;
  const getRuns = (): { first: Timed; second: Timed } => {
    if (runs === null) {
      throw new Error("beforeAll did not execute");
    }
    return runs;
  };

  beforeAll(() => {
    runs = { first: timed(), second: timed() };
  });

  it(`samples the dark window for the whole catalogue in under ${LOCAL_BUDGET_MS} ms (asserted locally, logged on CI)`, () => {
    const { first, second } = getRuns();
    // eslint-disable-next-line no-console -- timing printed for CI, where the budget is not asserted; no site data.
    console.info(
      `engine full run (dark window + moon + ${DEEP_SKY.length} object tracks): ${first.ms.toFixed(1)} ms cold, ${second.ms.toFixed(1)} ms warm (local budget ${LOCAL_BUDGET_MS} ms)`,
    );
    expect(Number.isFinite(second.ms)).toBe(true);
    if (process.env.CI === undefined) {
      expect(first.ms).toBeLessThan(LOCAL_BUDGET_MS);
      expect(second.ms).toBeLessThan(LOCAL_BUDGET_MS);
    }
  });
});

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

describe("ranking determinism and budget", () => {
  let runs: { first: { ranking: Ranking; ms: number }; second: { ranking: Ranking; ms: number } } | null = null;
  const getRuns = () => {
    if (runs === null) {
      throw new Error("beforeAll did not execute");
    }
    return runs;
  };
  const timedRanking = (): { ranking: Ranking; ms: number } => {
    const started = performance.now();
    const ranking = fullRanking();
    return { ranking, ms: performance.now() - started };
  };

  beforeAll(() => {
    runs = { first: timedRanking(), second: timedRanking() };
  });

  it("ranks something on a clear-sky new-moon night", () => {
    expect(getRuns().first.ranking.entries.length).toBeGreaterThan(0);
  });

  it("yields deep-equal rankings for two identical runs", () => {
    const { first, second } = getRuns();
    expect(second.ranking).toEqual(first.ranking);
    const asNumbers = (ranking: Ranking): string =>
      JSON.stringify(ranking, (_key, value: unknown) => (value instanceof Date ? value.getTime() : value));
    expect(asNumbers(second.ranking)).toBe(asNumbers(first.ranking));
  });

  it(`runs dark window + rankObjects over the whole catalogue in under ${LOCAL_BUDGET_MS} ms (asserted locally, logged on CI)`, () => {
    const { first, second } = getRuns();
    // eslint-disable-next-line no-console -- timing printed for CI, where the budget is not asserted; no site data.
    console.info(
      `ranking full run (dark window + rankObjects, ${DEEP_SKY.length} objects): ${first.ms.toFixed(1)} ms cold, ${second.ms.toFixed(1)} ms warm (local budget ${LOCAL_BUDGET_MS} ms)`,
    );
    expect(Number.isFinite(second.ms)).toBe(true);
    if (process.env.CI === undefined) {
      expect(first.ms).toBeLessThan(LOCAL_BUDGET_MS);
      expect(second.ms).toBeLessThan(LOCAL_BUDGET_MS);
    }
  });
});

describe("ranking determinism with a non-empty observation log", () => {
  it("yields deep-equal rankings for two identical runs, and the log does change the ranking", () => {
    const unlogged = fullRanking();
    const [first, second, third] = unlogged.entries.map((e) => e.object.id);
    const log: LogEntry[] = [
      { target: first, night: "2026-09-12", rating: 4 },
      { target: first, night: "2026-10-01", rating: 5 },
      { target: second, night: "2026-09-20", rating: 3 },
      // Invariant 4: a failed attempt never demotes.
      { target: third, night: "2026-10-05", rating: 2 },
    ];

    const once = fullRanking(log);
    expect(fullRanking(log)).toEqual(once);
    expect(once.entries.map((e) => e.object.id)).not.toEqual(unlogged.entries.map((e) => e.object.id));
    expect(once.clearedCount).toBe(unlogged.clearedCount);
  });
});

describe("ranking determinism under a full Moon (moonlight-and-the-verdict)", () => {
  it("yields deep-equal rankings, washed-out objects included, for two identical runs", () => {
    const once = fullRanking([], "2026-10-26");
    expect(once.washedOutCount).toBeGreaterThan(0);
    const asNumbers = (ranking: Ranking): string =>
      JSON.stringify(ranking, (_key, value: unknown) => (value instanceof Date ? value.getTime() : value));
    expect(asNumbers(fullRanking([], "2026-10-26"))).toBe(asNumbers(once));
  });
});

describe("seven-night outlook determinism", () => {
  it("yields deep-equal outlooks for two identical inputs", () => {
    const hours = Array.from({ length: 9 * 24 }, (_, i) => ({
      start: new Date(Date.UTC(2026, 9, 20) + i * 3_600_000),
      cloudCoverPct: (i * 37) % 101,
      humidityPct: 60 + (i % 30),
    }));
    const input = { site: WARSAW, thresholdDeg: -18, date: "2026-10-21", forecast: { hours }, fallback: false };
    const once = sevenNightOutlook(input);
    expect(sevenNightOutlook(input)).toEqual(once);
    const asNumbers = (value: unknown): string =>
      JSON.stringify(value, (_key, v: unknown) => (v instanceof Date ? v.getTime() : v));
    expect(asNumbers(sevenNightOutlook(input))).toBe(asNumbers(once));
  });
});

describe("planet ranking determinism", () => {
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

  it("yields deep-equal planet lists for two identical inputs", () => {
    const once = planets();
    expect(once.length).toBeGreaterThan(0);
    expect(planets()).toEqual(once);
    const asNumbers = (value: unknown): string =>
      JSON.stringify(value, (_key, v: unknown) => (v instanceof Date ? v.getTime() : v));
    expect(asNumbers(planets())).toBe(asNumbers(once));
  });
});
