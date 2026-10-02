import { describe, expect, it } from "vitest";

import { planetEyepiece, wholeDiscEyepiece } from "./eyepieces";
import { WARSAW } from "./fixtures";
import { seenSummaries } from "./log";
import { moonElongationDeg, moonPhaseBand, moonState, moonTrack } from "./moon";
import { isBrightMoon, moonPlacementOf, moonTarget } from "./moon-target";
import type { MoonTargetInput } from "./moon-target";
import { observingNight } from "./night";
import {
  BRIGHT_MOON_MIN_ILLUMINATION,
  BRIGHT_MOON_MIN_UP_FRACTION,
  DEFAULT_MIN_ALTITUDE_DEG,
  DEFAULT_TRACK_STEP_MINUTES,
  MOON_LOW_ALTITUDE_DEG,
  MOON_MIN_ILLUMINATION,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  WELL_PLACED_ALTITUDE_DEG,
} from "./parameters";
import { darkWindow } from "./sun";
import type { Interval } from "./types";

const TELESCOPE = { apertureMm: 150, focalLengthMm: 750 };
const EYEPIECES = [
  { id: "e25", focalLengthMm: 25, afovDeg: 50 },
  { id: "e10", focalLengthMm: 10, afovDeg: 50 },
];
type Eyepiece = (typeof EYEPIECES)[number];

/** Warsaw's civil window (sun below −6°), the planet window the Moon shares. */
function planetWindow(date: string): Interval {
  const civil = darkWindow(WARSAW, observingNight(date, WARSAW.timeZone), PLANET_WINDOW_SUN_ALTITUDE_DEG);
  if (civil.kind !== "window") {
    throw new Error(`expected a civil window on ${date} in Warsaw`);
  }
  return { start: civil.start, end: civil.end };
}

function input(date: string, overrides: Partial<MoonTargetInput<Eyepiece>> = {}): MoonTargetInput<Eyepiece> {
  return {
    site: WARSAW,
    minAltitudeDeg: DEFAULT_MIN_ALTITUDE_DEG,
    window: planetWindow(date),
    telescope: TELESCOPE,
    eyepieces: EYEPIECES,
    ...overrides,
  };
}

describe("moonTarget", () => {
  it("is null at new moon on 2026-10-10 (never above the minimum in the planet window)", () => {
    expect(moonTarget(input("2026-10-10"))).toBeNull();
  });

  for (const date of ["2026-10-24", "2026-10-26"]) {
    it(`lists the nearly full Moon on ${date}, well above the minimum altitude`, () => {
      // About 44° at 20:00 UTC in Warsaw on both nights (astronomy-engine, checked 2026-10-01).
      expect(moonState(WARSAW, new Date(`${date}T20:00:00Z`)).altitudeDeg).toBeGreaterThan(40);
      const entry = moonTarget(input(date));
      expect(entry).not.toBeNull();
      if (entry === null) {
        return;
      }
      const window = planetWindow(date);
      expect(entry.peak.altitudeDeg).toBeGreaterThanOrEqual(DEFAULT_MIN_ALTITUDE_DEG);
      expect(entry.peak.altitudeDeg).toBeGreaterThan(40);
      expect(entry.placement).toBe("high");
      expect(entry.window.peak).toEqual(entry.peak);
      expect(entry.window.start.getTime()).toBeGreaterThanOrEqual(window.start.getTime());
      expect(entry.window.end.getTime()).toBeLessThanOrEqual(window.end.getTime());
      // Facts are taken at the peak instant.
      expect(entry.facts.illuminatedFraction).toBe(moonState(WARSAW, entry.peak.time).illuminatedFraction);
      expect(entry.facts.illuminatedFraction).toBeGreaterThan(0.9);
      expect(entry.facts.elongationDeg).toBe(moonElongationDeg(entry.peak.time));
      expect(entry.facts.band).toBe(moonPhaseBand(entry.facts.elongationDeg));
      // The peak carries only a plain position, never the track's illumination fields.
      expect(Object.keys(entry.peak).sort()).toEqual(["altitudeDeg", "azimuthDeg", "time"]);
      expect(entry.seen).toBeNull();
    });
  }

  it("is deterministic", () => {
    expect(moonTarget(input("2026-10-24"))).toEqual(moonTarget(input("2026-10-24")));
  });

  it("counts only samples inside visibleIntervals, keeping timing relative to the whole window", () => {
    const clear: Interval = { start: new Date("2026-10-25T00:00:00Z"), end: new Date("2026-10-25T02:00:00Z") };
    const all = moonTarget(input("2026-10-24"));
    const masked = moonTarget(input("2026-10-24", { visibleIntervals: [clear] }));
    expect(all).not.toBeNull();
    expect(masked).not.toBeNull();
    if (all === null || masked === null) {
      return;
    }
    // The track grid starts at civil dusk, so the masked window is the grid samples inside the clear spell.
    const stepMs = 10 * 60_000;
    expect(masked.window.start.getTime()).toBeGreaterThanOrEqual(clear.start.getTime());
    expect(masked.window.start.getTime() - clear.start.getTime()).toBeLessThan(stepMs);
    expect(masked.window.end.getTime()).toBeLessThanOrEqual(clear.end.getTime());
    expect(clear.end.getTime() - masked.window.end.getTime()).toBeLessThan(stepMs);
    expect(masked.peak.time.getTime()).toBeGreaterThanOrEqual(clear.start.getTime());
    expect(masked.peak.time.getTime()).toBeLessThanOrEqual(clear.end.getTime());
    // The unmasked peak (around 21:00 UTC) is in the cloudy hours, so the masked one differs.
    expect(all.peak.time.getTime()).toBeLessThan(clear.start.getTime());
    expect(masked.peak.time).not.toEqual(all.peak.time);
    expect(all.window.start.getTime()).toBeLessThan(masked.window.start.getTime());
    // 00:00–02:00 UTC is the middle third of the 2026-10-24 civil window.
    expect(masked.timing).toBe("night");
  });

  it("is null when every hour the Moon is up is cloudy", () => {
    const daytime: Interval = { start: new Date("2026-10-24T08:00:00Z"), end: new Date("2026-10-24T10:00:00Z") };
    expect(moonTarget(input("2026-10-24", { visibleIntervals: [daytime] }))).toBeNull();
    expect(moonTarget(input("2026-10-24", { visibleIntervals: [] }))).toBeNull();
  });

  it(`is null below ${MOON_MIN_ILLUMINATION * 100}% lit even when it clears the minimum altitude`, () => {
    // A minimum of −90° lets every sample clear it; on 2026-10-10 (new moon) the peak is under 1% lit.
    const newMoon = input("2026-10-10", { minAltitudeDeg: -90 });
    // Under the floor at every sample of the window, so whichever sample the code picks as the peak, it is dim.
    for (const sample of moonTrack(WARSAW, newMoon.window, DEFAULT_TRACK_STEP_MINUTES)) {
      expect(sample.illuminatedFraction).toBeLessThan(MOON_MIN_ILLUMINATION);
    }
    expect(moonTarget(newMoon)).toBeNull();
    // Two nights later the evening crescent is about 4.5% lit and is listed.
    const crescent = moonTarget(input("2026-10-12", { minAltitudeDeg: -90 }));
    expect(crescent).not.toBeNull();
    expect(crescent?.facts.illuminatedFraction).toBeGreaterThanOrEqual(MOON_MIN_ILLUMINATION);
    expect(crescent?.placement).toBe("low");
  });

  it("pairs the whole-disc eyepiece with a stronger detail eyepiece", () => {
    const entry = moonTarget(input("2026-10-24"));
    expect(entry?.wholeDisc).toEqual(wholeDiscEyepiece(TELESCOPE, EYEPIECES));
    expect(entry?.wholeDisc?.eyepiece).toBe(EYEPIECES[0]);
    expect(entry?.detail).toBe(planetEyepiece(TELESCOPE, EYEPIECES));
    expect(entry?.detail).toBe(EYEPIECES[1]);
  });

  it("drops the detail eyepiece when it magnifies no more than the whole-disc one", () => {
    // Only a 25 mm: both rules pick it.
    const single = moonTarget(input("2026-10-24", { eyepieces: [EYEPIECES[0]] }));
    expect(single?.wholeDisc?.eyepiece).toBe(EYEPIECES[0]);
    expect(single?.detail).toBeNull();
    // A 3 mm breaks the exit-pupil floor, so planetEyepiece falls back to the 25 mm.
    const tooStrong = { id: "e3", focalLengthMm: 3, afovDeg: 50 };
    const fallback = moonTarget(input("2026-10-24", { eyepieces: [EYEPIECES[0], tooStrong] }));
    expect(planetEyepiece(TELESCOPE, [EYEPIECES[0], tooStrong])).toBe(EYEPIECES[0]);
    expect(fallback?.detail).toBeNull();
  });

  it("has no eyepieces for an empty kit", () => {
    const entry = moonTarget(input("2026-10-24", { eyepieces: [] }));
    expect(entry).not.toBeNull();
    expect(entry?.wholeDisc).toBeNull();
    expect(entry?.detail).toBeNull();
  });

  it("carries the log's seen summary for the moon key", () => {
    const seen = seenSummaries(
      [
        { target: "moon", night: "2026-10-20", rating: 4 },
        { target: "jupiter", night: "2026-10-21", rating: 5 },
      ],
      "2026-10-24",
    );
    const entry = moonTarget(input("2026-10-24", { seen }));
    expect(entry?.seen).toEqual({ count: 1, lastNight: "2026-10-20" });
  });
});

describe("moonPlacementOf", () => {
  it(`is low below ${MOON_LOW_ALTITUDE_DEG}°, high from ${WELL_PLACED_ALTITUDE_DEG}°, well in between`, () => {
    expect(moonPlacementOf(MOON_LOW_ALTITUDE_DEG - 0.01)).toBe("low");
    expect(moonPlacementOf(MOON_LOW_ALTITUDE_DEG)).toBe("well");
    expect(moonPlacementOf(WELL_PLACED_ALTITUDE_DEG - 0.01)).toBe("well");
    expect(moonPlacementOf(WELL_PLACED_ALTITUDE_DEG)).toBe("high");
  });
});

describe("isBrightMoon", () => {
  it("needs at least half lit and up for more than half the dark window", () => {
    expect(BRIGHT_MOON_MIN_ILLUMINATION).toBe(0.5);
    expect(BRIGHT_MOON_MIN_UP_FRACTION).toBe(0.5);
    expect(isBrightMoon(0.5, 0.51)).toBe(true);
    expect(isBrightMoon(0.49, 1)).toBe(false);
    expect(isBrightMoon(1, 0.5)).toBe(false);
  });
});
