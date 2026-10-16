import { Body, Observer } from "astronomy-engine";
import { beforeAll, describe, expect, it } from "vitest";

import { DEEP_SKY } from "@/lib/catalogue";

import {
  ALTITUDE_TOLERANCE_DEG,
  DARK_THRESHOLD_BY_BORTLE,
  PLANET_BODIES,
  PLANET_WINDOW_THRESHOLD_DEG,
  bodyAltitudeDeg,
  deepSkyAltitudeDeg,
  sunAltitudeGeometricDeg,
} from "./fixtures/independent-altitude";
import { generateCase, seeded } from "./fixtures/generated";
import type { GeneratedCase } from "./fixtures/generated";
import { moonTarget } from "./moon-target";
import { observingNight } from "./night";
import { objectTrack, refinedWindow } from "./objects";
import {
  DEFAULT_TRACK_STEP_MINUTES,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  darknessThresholdDegForBortle,
} from "./parameters";
import { rankPlanets } from "./planet-ranking";
import { rankObjects } from "./ranking";
import { darkWindow } from "./sun";
import type { HorizontalPosition, Interval } from "./types";

/**
 * Risk #3 (test-plan §2): nothing the engine lists is ever outside its window or under the site's minimum altitude.
 *
 * About 200 cases from a fixed seed (sites, nights, skies, telescopes and eyepiece kits). For every deep-sky entry,
 * planet entry and Moon target, at the window's start, end and best time, the suite asserts, with altitude and sun
 * altitude recomputed from astronomy-engine in `fixtures/independent-altitude.ts` (never from the engine's tracks,
 * `bestWindow` or the thresholds in `parameters.ts`):
 *
 * (a) the altitude is at least the site's minimum, less `ALTITUDE_TOLERANCE_DEG`;
 * (b) the sun is no higher than the sky's threshold (the test's own PRD table: Bortle-dependent for deep sky, -6 for
 *     planets and the Moon), plus the same tolerance;
 * (c) start <= best time <= end, all within the dark window (deep sky) or the planet window.
 *
 * A run of a single sample is the accepted rule: the object is listed and still has to meet (a) to (c). A planet's or
 * the Moon's window then has start === end (the grid edges), while a deep-sky window has true edges (`refinedWindow`):
 * a positive length around its sample, still inside the dark window. Both are pinned in their own tests. Failure messages
 * name the case index and its inputs, so a case replays from the seed. The case array is built here from the seed
 * alone; every engine call runs in `beforeAll`.
 */

const SEED = 20261008;
const CASE_COUNT = 200;

interface IndexedCase extends GeneratedCase {
  index: number;
}

const random = seeded(SEED);
const CASES: IndexedCase[] = Array.from({ length: CASE_COUNT }, (_, index) => ({ index, ...generateCase(random) }));

function describeCase(c: IndexedCase): string {
  const kit = c.eyepieces.map((e) => `${e.focalLengthMm}mm/${e.afovDeg}deg`).join(",") || "none";
  return (
    `case ${c.index} (seed ${SEED}): ${c.site.label} ${c.site.latitudeDeg},${c.site.longitudeDeg} ` +
    `${c.site.elevationM}m ${c.site.timeZone}, night ${c.date}, Bortle ${c.bortle}, minAlt ${c.minAltitudeDeg}, ` +
    `telescope ${c.telescope.apertureMm}/${c.telescope.focalLengthMm}, eyepieces ${kit}`
  );
}

interface CaseResult {
  /** The deep-sky dark window exists (`kind: "window"`). */
  hasDarkWindow: boolean;
  /** The -6 degree planet window exists. */
  hasPlanetWindow: boolean;
  deepSkyEntries: number;
  planetEntries: number;
  moonEntries: number;
  /** Every violation of (a) to (c), one line each. */
  violations: string[];
  /** The planet and Moon entries with `window.start === window.end` (one sample), and the violations among them. */
  shortWindows: number;
  shortViolations: string[];
  /** The deep-sky entries whose best run is one track sample, and the violations among them. */
  deepSkyShortRuns: number;
  deepSkyShortViolations: string[];
}

interface Listed {
  kind: "deep-sky" | "planet" | "moon";
  id: string;
  window: { start: Date; end: Date };
  peak: HorizontalPosition;
}

function analyse(c: IndexedCase): CaseResult {
  const { site, bortle, minAltitudeDeg, telescope, eyepieces } = c;
  const observer = new Observer(site.latitudeDeg, site.longitudeDeg, site.elevationM);
  const night = observingNight(c.date, site.timeZone);
  const result: CaseResult = {
    hasDarkWindow: false,
    hasPlanetWindow: false,
    deepSkyEntries: 0,
    planetEntries: 0,
    moonEntries: 0,
    violations: [],
    shortWindows: 0,
    shortViolations: [],
    deepSkyShortRuns: 0,
    deepSkyShortViolations: [],
  };

  const sunCache = new Map<number, number>();
  const sunAt = (time: Date): number => {
    const key = time.getTime();
    let value = sunCache.get(key);
    if (value === undefined) {
      value = sunAltitudeGeometricDeg(time, observer);
      sunCache.set(key, value);
    }
    return value;
  };

  /** Checks (a) to (c) for one listed entry and returns its violations. */
  const check = (
    entry: Listed,
    interval: Interval,
    thresholdDeg: number,
    altitudeAt: (time: Date) => number,
  ): string[] => {
    const out: string[] = [];
    const { start, end } = entry.window;
    const label = `${entry.kind} ${entry.id}`;
    const startMs = start.getTime();
    const endMs = end.getTime();
    const peakMs = entry.peak.time.getTime();
    if (!(startMs <= peakMs && peakMs <= endMs)) {
      out.push(
        `${label}: (c) best time ${entry.peak.time.toISOString()} is outside ${start.toISOString()}..${end.toISOString()}`,
      );
    }
    if (startMs < interval.start.getTime() || endMs > interval.end.getTime()) {
      out.push(
        `${label}: (c) window ${start.toISOString()}..${end.toISOString()} leaves ` +
          `${interval.start.toISOString()}..${interval.end.toISOString()}`,
      );
    }
    for (const [point, time] of [
      ["start", start],
      ["end", end],
      ["best", entry.peak.time],
    ] as const) {
      const altitude = altitudeAt(time);
      if (!(altitude >= minAltitudeDeg - ALTITUDE_TOLERANCE_DEG)) {
        out.push(
          `${label} at ${point} ${time.toISOString()}: (a) altitude ${altitude.toFixed(3)} is under minimum ${minAltitudeDeg}`,
        );
      }
      const sun = sunAt(time);
      if (!(sun <= thresholdDeg + ALTITUDE_TOLERANCE_DEG)) {
        out.push(
          `${label} at ${point} ${time.toISOString()}: (b) sun altitude ${sun.toFixed(3)} is above threshold ${thresholdDeg}`,
        );
      }
    }
    return out;
  };

  const record = (
    entry: Listed,
    interval: Interval,
    thresholdDeg: number,
    altitudeAt: (time: Date) => number,
  ): string[] => {
    const violations = check(entry, interval, thresholdDeg, altitudeAt);
    result.violations.push(...violations);
    if (entry.kind !== "deep-sky" && entry.window.start.getTime() === entry.window.end.getTime()) {
      result.shortWindows += 1;
      result.shortViolations.push(...violations);
    }
    return violations;
  };

  // Deep sky: the dark window at the Bortle threshold. The engine call may use the engine's threshold function;
  // the oracle's threshold below comes from the test's own table.
  const dark = darkWindow(site, night, darknessThresholdDegForBortle(bortle));
  if (dark.kind === "window") {
    result.hasDarkWindow = true;
    const ranking = rankObjects({
      site,
      bortle,
      minAltitudeDeg,
      darkWindow: dark,
      telescope,
      eyepieces,
      catalogue: DEEP_SKY,
      limit: Infinity,
    });
    const darkThresholdDeg = DARK_THRESHOLD_BY_BORTLE[bortle];
    for (const entry of ranking.entries) {
      result.deepSkyEntries += 1;
      const listed: Listed = { kind: "deep-sky", id: entry.object.id, window: entry.score.window, peak: entry.peak };
      const altitudeAt = (time: Date) => deepSkyAltitudeDeg(entry.object, time, observer);
      const violations = record(listed, dark, darkThresholdDeg, altitudeAt);
      // A one-sample run is told by its sample range: its window must now have a length and still hold its sample.
      const run = refinedWindow(
        objectTrack(site, { start: dark.start, end: dark.end }, entry.object, DEFAULT_TRACK_STEP_MINUTES),
        minAltitudeDeg,
      );
      if (run !== null && run.firstIndex === run.lastIndex) {
        result.deepSkyShortRuns += 1;
        const label = `deep-sky ${entry.object.id}`;
        const { start, end } = entry.score.window;
        const problems = [...violations];
        if (!(end.getTime() > start.getTime())) {
          problems.push(`${label}: a one-sample run has a zero-length window ${start.toISOString()}`);
        }
        if (!(start.getTime() <= entry.peak.time.getTime() && entry.peak.time.getTime() <= end.getTime())) {
          problems.push(`${label}: the window ${start.toISOString()}..${end.toISOString()} does not hold its sample`);
        }
        result.deepSkyShortViolations.push(...problems);
      }
    }
  }

  // Planets and the Moon: the -6 degree window, independent of whether a deep-sky dark window exists.
  const planetWindow = darkWindow(site, night, PLANET_WINDOW_SUN_ALTITUDE_DEG);
  if (planetWindow.kind === "window") {
    result.hasPlanetWindow = true;
    for (const entry of rankPlanets({ site, minAltitudeDeg, planetWindow, telescope, eyepieces })) {
      result.planetEntries += 1;
      record(
        { kind: "planet", id: entry.key, window: entry.window, peak: entry.peak },
        planetWindow,
        PLANET_WINDOW_THRESHOLD_DEG,
        (time) => bodyAltitudeDeg(PLANET_BODIES[entry.key], time, observer),
      );
    }
    const moon = moonTarget({ site, minAltitudeDeg, window: planetWindow, telescope, eyepieces });
    if (moon !== null) {
      result.moonEntries += 1;
      record(
        { kind: "moon", id: "moon", window: moon.window, peak: moon.peak },
        planetWindow,
        PLANET_WINDOW_THRESHOLD_DEG,
        (time) => bodyAltitudeDeg(Body.Moon, time, observer),
      );
    }
  }
  return result;
}

describe("visibility invariants over generated sites, nights, skies and telescopes (Risk #3)", () => {
  let results: CaseResult[] = [];
  beforeAll(() => {
    results = CASES.map(analyse);
  });

  const total = (pick: (r: CaseResult) => number): number => results.reduce((sum, r) => sum + pick(r), 0);
  const countCases = (pick: (c: IndexedCase, r: CaseResult) => boolean): number =>
    CASES.filter((c, i) => pick(c, results[i])).length;

  // First: a property that checks nothing passes for the wrong reason, so the run has to be big enough and varied.
  it("generates enough cases with enough entries to prove something", () => {
    expect(CASES).toHaveLength(CASE_COUNT);
    expect(
      countCases((_c, r) => r.hasDarkWindow),
      "cases with a dark window",
    ).toBeGreaterThanOrEqual(150);
    expect(
      total((r) => r.deepSkyEntries),
      "deep-sky entries checked",
    ).toBeGreaterThanOrEqual(3000);
    expect(
      countCases((c, r) => r.hasDarkWindow && c.site.latitudeDeg < 0),
      "southern-hemisphere cases with a dark window",
    ).toBeGreaterThanOrEqual(20);
    expect(
      countCases((c, r) => r.hasDarkWindow && Math.abs(c.site.latitudeDeg) > 60),
      "cases above 60 degrees of latitude with a dark window",
    ).toBeGreaterThanOrEqual(10);
    expect(
      total((r) => r.planetEntries),
      "planet entries checked",
    ).toBeGreaterThanOrEqual(50);
  });

  it.each(CASES)("case $index: $site.label, night $date, Bortle $bortle", (c) => {
    const { violations } = results[c.index];
    expect(violations.slice(0, 10), `${violations.length} violations; ${describeCase(c)}`).toEqual([]);
  });

  it("keeps a planet or the Moon listed for a single sample (start === end) inside the same guarantees", () => {
    // About 1% of entries are up for one 10-minute sample and still clear the bar (19 planet and Moon entries and
    // 111 deep-sky ones for seed 20261008). That rule is accepted: a planet or the Moon keeps the grid edges, so its
    // window has start === end, and it is held to (a) to (c) at that one instant, like every other.
    expect(
      total((r) => r.shortWindows),
      "single-sample planet and Moon windows seen",
    ).toBeGreaterThan(0);
    const failing = CASES.flatMap((c, i) =>
      results[i].shortViolations.map((violation) => `${describeCase(c)}: ${violation}`),
    );
    expect(failing.slice(0, 10), `${failing.length} single-sample violations`).toEqual([]);
  });

  it("gives a deep-sky object listed for a single sample a window of positive length around it (true edges)", () => {
    // The same accepted rule (an object up for one sample still clears), but a deep-sky window is the true crossings
    // of the minimum altitude (`refinedWindow`), so a one-sample run is no longer start === end: it has a length, holds
    // its sample, stays inside the dark window and is held to (a) to (c) at its start, end and best time.
    expect(
      total((r) => r.deepSkyShortRuns),
      "single-sample deep-sky runs seen",
    ).toBeGreaterThan(0);
    const failing = CASES.flatMap((c, i) =>
      results[i].deepSkyShortViolations.map((violation) => `${describeCase(c)}: ${violation}`),
    );
    expect(failing.slice(0, 10), `${failing.length} single-sample deep-sky violations`).toEqual([]);
  });
});
