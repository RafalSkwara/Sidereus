import { describe, expect, it } from "vitest";

import { MESSIER } from "@/lib/catalogue";

import { darkWindow, moonTrack, objectTrack, observingNight } from "./index";
import type { HorizontalPosition, MoonState, Site } from "./index";

/**
 * The PRD's determinism NFR (identical inputs → identical verdict and ranking) and the ranking-time
 * NFR ("ranking under a second"), as tests over the engine's position-sampling share: the dark
 * window, the Moon track and one track per catalogue object for a full night.
 *
 * The CI bound is looser because shared runners are slower and noisier than a developer machine.
 * `process.env` is read here, in a test file, which the purity guard excludes.
 */

const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };
const LOCAL_BUDGET_MS = 1000;
const CI_BUDGET_MS = 3000;

interface FullRun {
  dark: ReturnType<typeof darkWindow>;
  moon: MoonState[];
  objects: Record<string, HorizontalPosition[]>;
}

function fullRun(): FullRun {
  const night = observingNight("2026-10-10", WARSAW.timeZone);
  const dark = darkWindow(WARSAW, night, -18);
  if (dark.kind !== "window") {
    throw new Error("expected a dark window on 2026-10-10 in Warsaw");
  }
  const moon = moonTrack(WARSAW, dark);
  const objects: Record<string, HorizontalPosition[]> = {};
  for (const object of MESSIER) {
    objects[object.id] = objectTrack(WARSAW, dark, { raHours: object.raHours, decDeg: object.decDeg });
  }
  return { dark, moon, objects };
}

function timed(): { run: FullRun; ms: number } {
  const started = performance.now();
  const run = fullRun();
  return { run, ms: performance.now() - started };
}

describe("engine determinism and budget", () => {
  const budgetMs = process.env.CI === undefined ? LOCAL_BUDGET_MS : CI_BUDGET_MS;
  const first = timed();
  const second = timed();

  it("covers all 110 catalogue objects", () => {
    expect(Object.keys(first.run.objects)).toHaveLength(110);
    expect(first.run.moon.length).toBeGreaterThan(1);
  });

  it("yields deep-equal results for two identical full runs", () => {
    // `toEqual` compares Dates by value (getTime), so timestamps inside the tracks are covered.
    expect(second.run).toEqual(first.run);
    const asNumbers = (run: FullRun): string =>
      JSON.stringify(run, (_key, value: unknown) => (value instanceof Date ? value.getTime() : value));
    expect(asNumbers(second.run)).toBe(asNumbers(first.run));
  });

  it(`samples the dark window for the whole catalogue in under ${budgetMs} ms`, () => {
    console.info(
      `engine full run (dark window + moon + 110 object tracks): ${first.ms.toFixed(1)} ms cold, ${second.ms.toFixed(1)} ms warm (budget ${budgetMs} ms)`,
    );
    expect(first.ms).toBeLessThan(budgetMs);
    expect(second.ms).toBeLessThan(budgetMs);
  });
});
