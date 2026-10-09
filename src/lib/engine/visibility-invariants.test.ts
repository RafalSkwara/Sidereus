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
import { PLANET_WINDOW_SUN_ALTITUDE_DEG, darknessThresholdDegForBortle } from "./parameters";
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
 * A window of a single sample (start === end, about 0.7% of entries) is the accepted rule: it still has to meet
 * (a) to (c) at that instant, and is pinned in its own test. Failure messages name the case index and its inputs,
 * so a case replays from the seed. The case array is built here from the seed alone; every engine call runs in
 * `beforeAll`.
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
  /** The entries with `window.start === window.end`, and the violations among them. */
  shortWindows: number;
  shortViolations: string[];
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

  const record = (entry: Listed, interval: Interval, thresholdDeg: number, altitudeAt: (time: Date) => number) => {
    const violations = check(entry, interval, thresholdDeg, altitudeAt);
    result.violations.push(...violations);
    if (entry.window.start.getTime() === entry.window.end.getTime()) {
      result.shortWindows += 1;
      result.shortViolations.push(...violations);
    }
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
      record(
        { kind: "deep-sky", id: entry.object.id, window: entry.score.window, peak: entry.peak },
        dark,
        darkThresholdDeg,
        (time) => deepSkyAltitudeDeg(entry.object, time, observer),
      );
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

  it("keeps a target listed for a single sample (start === end) inside the same guarantees", () => {
    // About 0.7% of entries are up for one 10-minute sample and still clear the bar. That rule is accepted and
    // pinned here: such an entry is held to (a) to (c) at its one instant, like every other.
    expect(
      total((r) => r.shortWindows),
      "single-sample windows seen",
    ).toBeGreaterThan(0);
    const failing = CASES.flatMap((c, i) =>
      results[i].shortViolations.map((violation) => `${describeCase(c)}: ${violation}`),
    );
    expect(failing.slice(0, 10), `${failing.length} single-sample violations`).toEqual([]);
  });
});
