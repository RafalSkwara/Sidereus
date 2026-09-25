import { describe, expect, it } from "vitest";

import {
  BRIGHTNESS_RAMP_MAG,
  LOW_INTEREST_PENALTY,
  SCORE_WEIGHTS,
  WELL_PLACED_ALTITUDE_DEG,
  bortlePenaltyForBortle,
  darknessThresholdDegForBortle,
  nakedEyeLimitingMagForBortle,
} from "./parameters";
import { SCORE_COMPONENTS, scoreObject } from "./score";
import type { ScoreInput, ScoredObject } from "./score";
import type { HorizontalPosition } from "./types";

const BASE_MS = Date.UTC(2026, 9, 10, 18, 0);

function track(altitudes: readonly number[]): HorizontalPosition[] {
  return altitudes.map((altitudeDeg, i) => ({
    time: new Date(BASE_MS + i * 10 * 60_000),
    altitudeDeg,
    azimuthDeg: 180,
  }));
}

function moon(samples: readonly (readonly [altitudeDeg: number, illuminatedFraction: number])[]) {
  return samples.map(([altitudeDeg, illuminatedFraction]) => ({ altitudeDeg, illuminatedFraction }));
}

/** The same Moon altitude and illuminated fraction at every one of `n` samples. */
function steadyMoon(n: number, altitudeDeg: number, illuminatedFraction: number) {
  return moon(Array.from({ length: n }, () => [altitudeDeg, illuminatedFraction] as const));
}

const NO_MOON = (n: number) => steadyMoon(n, -30, 0);

/** An object bright enough for brightness = 1 and exempt from the sky penalty. */
const CLUSTER: ScoredObject = { vMag: 0, surfaceBrightness: null, type: "open-cluster" };

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  const t = overrides.track ?? track([40, 40, 40, 40, 40]);
  return {
    object: CLUSTER,
    track: t,
    moonTrack: NO_MOON(t.length),
    minAltitudeDeg: 15,
    bortle: 6,
    // 7 mm aperture: the telescope adds nothing, so the limit is the naked-eye one.
    apertureMm: 7,
    ...overrides,
  };
}

function score(overrides: Partial<ScoreInput> = {}) {
  const result = scoreObject(input(overrides));
  if (result === null) {
    throw new Error("expected a score");
  }
  return result;
}

describe("S-02 parameters", () => {
  it("maps Bortle to the naked-eye limiting magnitude", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(nakedEyeLimitingMagForBortle)).toEqual([
      7.6, 7.1, 6.6, 6.1, 5.6, 5.1, 4.6, 4.3, 4.0,
    ]);
  });

  it("maps Bortle to a penalty of 0 at 1-2 rising linearly to 0.40 at 8 and 9", () => {
    expect(bortlePenaltyForBortle(1)).toBe(0);
    expect(bortlePenaltyForBortle(2)).toBe(0);
    expect(bortlePenaltyForBortle(5)).toBeCloseTo(0.2, 12);
    expect(bortlePenaltyForBortle(8)).toBe(0.4);
    expect(bortlePenaltyForBortle(9)).toBe(0.4);
    for (let b = 2; b < 9; b++) {
      expect(bortlePenaltyForBortle(b + 1)).toBeGreaterThanOrEqual(bortlePenaltyForBortle(b));
    }
  });

  it("rejects an invalid Bortle class like darknessThresholdDegForBortle", () => {
    for (const bad of [0, 10, 2.5, Number.NaN]) {
      expect(() => nakedEyeLimitingMagForBortle(bad)).toThrow(RangeError);
      expect(() => bortlePenaltyForBortle(bad)).toThrow(RangeError);
      expect(() => darknessThresholdDegForBortle(bad)).toThrow(RangeError);
    }
  });

  it("weights sum to 1", () => {
    expect(SCORE_COMPONENTS.reduce((sum, c) => sum + SCORE_WEIGHTS[c], 0)).toBeCloseTo(1, 12);
  });
});

describe("scoreObject", () => {
  it("returns null when the object never reaches the minimum altitude in the dark window", () => {
    expect(scoreObject(input({ track: track([14.9, 10, 5, 14]) }))).toBeNull();
  });

  it("rejects a moon track on a different grid", () => {
    expect(() => scoreObject(input({ track: track([40, 40]), moonTrack: NO_MOON(3) }))).toThrow(RangeError);
  });

  describe("duration", () => {
    it("is 1 when the object is up for the whole dark window", () => {
      expect(score().components.duration).toBe(1);
    });

    it("credits each best-window sample by its altitude between the minimum and WELL_PLACED_ALTITUDE_DEG", () => {
      expect(WELL_PLACED_ALTITUDE_DEG).toBe(40);
      // Longest run above 15° is samples 4..7: 30°, 40°, 35°, 16° → 0.6 + 1 + 0.8 + 0.04 over a 25° span.
      const result = score({ track: track([20, 20, 5, 5, 30, 40, 35, 16, 10, 20]) });
      expect(result.components.duration).toBeCloseTo((0.6 + 1 + 0.8 + 0.04) / 10, 12);
      expect(result.window.peak.altitudeDeg).toBe(40);
    });

    it("scores a whole-night pass hugging the minimum altitude near 0, and caps samples above the reference at 1", () => {
      expect(score({ track: track([15, 15, 15, 15]) }).components.duration).toBe(0);
      expect(score({ track: track([80, 85, 90, 85]) }).components.duration).toBe(1);
    });
  });

  describe("moon", () => {
    it("is 1 when the Moon is below the horizon throughout", () => {
      expect(score({ moonTrack: steadyMoon(5, -5, 1) }).components.moon).toBe(1);
    });

    it("is 1 at new moon even with the Moon up", () => {
      expect(score({ moonTrack: steadyMoon(5, 30, 0) }).components.moon).toBe(1);
    });

    it("is 0 with a full Moon up throughout the window", () => {
      expect(score({ moonTrack: steadyMoon(5, 30, 1) }).components.moon).toBe(0);
    });

    it("scales the illuminated fraction at the object's peak by the share of the window with the Moon up", () => {
      // Peak is sample 2 (fraction 0.8 there); the Moon is up for 2 of the 4 window samples 1..4.
      const result = score({
        track: track([5, 20, 50, 30, 20]),
        moonTrack: moon([
          [40, 0.1],
          [-1, 0.2],
          [-1, 0.8],
          [10, 0.3],
          [20, 0.4],
        ]),
      });
      expect(result.window.peak.altitudeDeg).toBe(50);
      expect(result.components.moon).toBeCloseTo(1 - 0.8 * (2 / 4), 12);
    });
  });

  describe("brightness", () => {
    const limit = nakedEyeLimitingMagForBortle(6);

    it("is 0 at the limiting magnitude", () => {
      expect(score({ object: { ...CLUSTER, vMag: limit } }).components.brightness).toBe(0);
    });

    it("returns null for an object fainter than the telescope's limiting magnitude, so it never ranks", () => {
      expect(scoreObject(input({ object: { ...CLUSTER, vMag: limit + 0.01 } }))).toBeNull();
      expect(scoreObject(input({ object: { ...CLUSTER, vMag: limit + 5 }, apertureMm: 70 }))).not.toBeNull();
    });

    it("ramps linearly over BRIGHTNESS_RAMP_MAG and is clamped at 1 beyond it", () => {
      expect(
        score({ object: { ...CLUSTER, vMag: limit - BRIGHTNESS_RAMP_MAG / 2 } }).components.brightness,
      ).toBeCloseTo(0.5, 12);
      expect(score({ object: { ...CLUSTER, vMag: limit - BRIGHTNESS_RAMP_MAG } }).components.brightness).toBeCloseTo(
        1,
        12,
      );
      expect(score({ object: { ...CLUSTER, vMag: limit - 10 } }).components.brightness).toBe(1);
    });

    it("adds 5·log10(aperture ÷ 7 mm) to the limit", () => {
      // 70 mm gains exactly 5 magnitudes.
      const vMag = limit + 5 - BRIGHTNESS_RAMP_MAG / 4;
      expect(score({ object: { ...CLUSTER, vMag }, apertureMm: 70 }).components.brightness).toBeCloseTo(0.25, 12);
    });
  });

  describe("sky", () => {
    it("penalises a known surface brightness fainter than the threshold", () => {
      const faint: ScoredObject = { vMag: 0, surfaceBrightness: 22, type: "globular-cluster" };
      expect(score({ object: faint, bortle: 8 }).components.sky).toBeCloseTo(0.6, 12);
      expect(score({ object: faint, bortle: 2 }).components.sky).toBe(1);
    });

    it("does not penalise a known surface brightness at or brighter than the threshold, whatever the type", () => {
      expect(score({ object: { vMag: 0, surfaceBrightness: 21, type: "galaxy" }, bortle: 8 }).components.sky).toBe(1);
      expect(score({ object: { vMag: 0, surfaceBrightness: 13, type: "galaxy" }, bortle: 8 }).components.sky).toBe(1);
    });

    it("falls back to the type when the surface brightness is unknown", () => {
      for (const type of ["galaxy", "nebula", "emission-nebula", "reflection-nebula", "supernova-remnant"] as const) {
        expect(score({ object: { vMag: 0, surfaceBrightness: null, type }, bortle: 9 }).components.sky).toBeCloseTo(
          0.6,
          12,
        );
      }
      for (const type of ["open-cluster", "globular-cluster", "planetary-nebula", "double-star"] as const) {
        expect(score({ object: { vMag: 0, surfaceBrightness: null, type }, bortle: 9 }).components.sky).toBe(1);
      }
    });
  });

  it("totals the weighted components", () => {
    const result = score({
      object: { vMag: 3.1, surfaceBrightness: null, type: "galaxy" },
      track: track([5, 20, 50, 30, 20]),
      moonTrack: moon([
        [40, 0.5],
        [10, 0.5],
        [10, 0.5],
        [10, 0.5],
        [10, 0.5],
      ]),
    });
    const { duration, moon: moonValue, brightness, sky } = result.components;
    // Window samples 1..4 at 20°, 50°, 30°, 20° → 0.2 + 1 + 0.6 + 0.2 over 5 samples.
    expect(duration).toBeCloseTo(0.4, 12);
    expect(moonValue).toBeCloseTo(0.5, 12);
    // Limit 5.1 at Bortle 6 with a 7 mm aperture; 2 magnitudes inside it over the ramp.
    expect(brightness).toBeCloseTo(2 / BRIGHTNESS_RAMP_MAG, 12);
    expect(sky).toBeCloseTo(1 - bortlePenaltyForBortle(6), 12);
    expect(result.total).toBeCloseTo(
      SCORE_WEIGHTS.duration * duration +
        SCORE_WEIGHTS.moon * moonValue +
        SCORE_WEIGHTS.brightness * brightness +
        SCORE_WEIGHTS.sky * sky,
      12,
    );
    for (const c of SCORE_COMPONENTS) {
      expect(result.components[c]).toBeGreaterThanOrEqual(0);
      expect(result.components[c]).toBeLessThanOrEqual(1);
    }
  });

  it("subtracts LOW_INTEREST_PENALTY from a double star or asterism, floored at 0", () => {
    const cluster = score();
    for (const type of ["double-star", "asterism"] as const) {
      const lowInterest = score({ object: { ...CLUSTER, type } });
      expect(lowInterest.components).toEqual(cluster.components);
      expect(lowInterest.total).toBeCloseTo(cluster.total - LOW_INTEREST_PENALTY, 12);
    }
    const nearZero = score({
      object: { ...CLUSTER, type: "double-star", vMag: nakedEyeLimitingMagForBortle(6) },
      track: track([15, 15]),
      moonTrack: steadyMoon(2, 30, 1),
    });
    expect(nearZero.total).toBe(0);
  });
});
