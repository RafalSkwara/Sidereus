import { describe, expect, it } from "vitest";

import { MOON_REFERENCES, circularDeltaDeg, fixtureTimeMs } from "./fixtures";
import { moonElongationDeg, moonPhaseBand } from "./moon";
import { moonDiscState, moonDiscStates } from "./moon-disc";
import { MOON_DISC_STEP_MINUTES } from "./parameters";
import type { Interval } from "./types";

/** The plan's illumination bar against Skyfield: the state's 0.01 rounding plus the engine's own error. */
const ILLUMINATION_TOLERANCE = 0.01;

/** Bright-limb angles computed on the engine during plan review (rev 2), degrees. */
const ANGLE_TOLERANCE_DEG = 0.5;

describe("moonDiscState", () => {
  it("rounds the illuminated fraction to 0.01 and stays within 0.01 of the Skyfield reference", () => {
    for (const reference of MOON_REFERENCES) {
      for (const s of reference.samples) {
        const state = moonDiscState(new Date(fixtureTimeMs(s.time)));
        expect(Math.round(state.illuminatedFraction * 100) / 100).toBe(state.illuminatedFraction);
        expect(Math.abs(state.illuminatedFraction - s.illuminatedFraction)).toBeLessThanOrEqual(ILLUMINATION_TOLERANCE);
        expect(state.waxing).toBe(s.elongationDeg < 180);
      }
    }
  });

  it("is waxing exactly while the elongation is below 180°, with the band of that elongation", () => {
    // Hourly across a whole lunation from the 2026-10-10 new moon.
    const start = Date.parse("2026-10-10T00:00:00Z");
    for (let hour = 0; hour < 30 * 24; hour += 7) {
      const time = new Date(start + hour * 3_600_000);
      const state = moonDiscState(time);
      const elongation = moonElongationDeg(time);
      expect(state.waxing).toBe(elongation < 180);
      expect(state.band).toBe(moonPhaseBand(elongation));
      expect(state.brightLimbAngleDeg).toBeGreaterThanOrEqual(0);
      expect(state.brightLimbAngleDeg).toBeLessThan(360);
    }
  });

  it("puts the bright limb on lunar east (right) when waxing and west (left) when waning", () => {
    const crescent = moonDiscState(new Date("2026-10-12T18:00:00Z"));
    expect(crescent.waxing).toBe(true);
    expect(circularDeltaDeg(crescent.brightLimbAngleDeg, 281.0)).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
    expect(crescent.librationLonDeg).toBeCloseTo(4.07, 1);
    expect(crescent.librationLatDeg).toBeCloseTo(6.49, 1);

    const waning = moonDiscState(new Date("2026-11-02T04:00:00Z"));
    expect(waning.waxing).toBe(false);
    expect(circularDeltaDeg(waning.brightLimbAngleDeg, 91.6)).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
  });

  it("carries the instant as an ISO string", () => {
    expect(moonDiscState(new Date("2026-10-15T17:00:00Z")).time).toBe("2026-10-15T17:00:00.000Z");
  });
});

describe("moonDiscStates", () => {
  const interval: Interval = { start: new Date("2026-10-15T17:05:00Z"), end: new Date("2026-10-15T20:00:00Z") };

  it("samples the interval every MOON_DISC_STEP_MINUTES, inclusive of both ends", () => {
    const states = moonDiscStates(interval);
    expect(MOON_DISC_STEP_MINUTES).toBe(10);
    expect(states).toHaveLength(19);
    expect(states[0].time).toBe("2026-10-15T17:05:00.000Z");
    expect(states[1].time).toBe("2026-10-15T17:15:00.000Z");
    expect(states[states.length - 1].time).toBe("2026-10-15T20:00:00.000Z");
  });

  it("is deterministic: the same interval gives deep-equal states", () => {
    expect(moonDiscStates(interval)).toEqual(moonDiscStates(interval));
    expect(moonDiscStates(interval, 30)).toEqual(moonDiscStates(interval, 30));
  });
});
