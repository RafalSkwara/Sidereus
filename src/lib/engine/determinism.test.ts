import { beforeAll, describe, expect, it } from "vitest";

import { MESSIER } from "@/lib/catalogue";

import { darkWindow, moonTrack, objectTracks, observingNight } from "./index";
import type { HorizontalPosition, MoonState, Site } from "./index";

/**
 * The PRD's determinism NFR (identical inputs → identical verdict and ranking) and the ranking-time
 * NFR ("ranking under a second"), as tests over the engine's position-sampling share: the dark
 * window, the Moon track and one track per catalogue object over the dark window.
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
    MESSIER.map((o) => ({ raHours: o.raHours, decDeg: o.decDeg })),
  );
  const objects: Record<string, HorizontalPosition[]> = {};
  MESSIER.forEach((object, i) => {
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

  it("covers all 110 catalogue objects", () => {
    const { first } = getRuns();
    expect(Object.keys(first.run.objects)).toHaveLength(110);
    expect(first.run.moon.length).toBeGreaterThan(1);
  });

  it("yields deep-equal results for two identical full runs", () => {
    const { first, second } = getRuns();
    // `toEqual` compares Dates by value (getTime), so timestamps inside the tracks are covered.
    expect(second.run).toEqual(first.run);
    const asNumbers = (run: FullRun): string =>
      JSON.stringify(run, (_key, value: unknown) => (value instanceof Date ? value.getTime() : value));
    expect(asNumbers(second.run)).toBe(asNumbers(first.run));
  });

  it(`samples the dark window for the whole catalogue in under ${LOCAL_BUDGET_MS} ms (asserted locally, logged on CI)`, () => {
    const { first, second } = getRuns();
    console.info(
      `engine full run (dark window + moon + 110 object tracks): ${first.ms.toFixed(1)} ms cold, ${second.ms.toFixed(1)} ms warm (local budget ${LOCAL_BUDGET_MS} ms)`,
    );
    expect(Number.isFinite(second.ms)).toBe(true);
    if (process.env.CI === undefined) {
      expect(first.ms).toBeLessThan(LOCAL_BUDGET_MS);
      expect(second.ms).toBeLessThan(LOCAL_BUDGET_MS);
    }
  });
});
