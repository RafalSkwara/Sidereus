import { describe, expect, it } from "vitest";

import {
  BRIGHTNESS_RAMP_MAG,
  LOW_INTEREST_PENALTY,
  SCORE_WEIGHTS,
  WELL_PLACED_ALTITUDE_DEG,
  bortlePenaltyForBortle,
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

/** Phase angles: 0 is a full Moon, 180 a new one. */
const FULL = 0;
const NEW = 180;

/** The same Moon altitude and phase angle at every one of `n` samples. */
function steadyMoon(n: number, altitudeDeg: number, phaseAngleDeg: number) {
  return Array.from({ length: n }, () => ({ altitudeDeg, phaseAngleDeg }));
}

const NO_MOON = (n: number) => steadyMoon(n, -30, NEW);

/** The same Moon–object separation at every one of `n` samples. */
const apart = (n: number, separationDeg: number) => Array.from({ length: n }, () => separationDeg);

/** An object bright enough for brightness = 1 and exempt from the sky penalty. */
const CLUSTER: ScoredObject = {
  id: "M45",
  vMag: 0,
  surfaceBrightness: null,
  type: "open-cluster",
  majorAxisArcmin: 10,
  minorAxisArcmin: 10,
};

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  const t = overrides.track ?? track([40, 40, 40, 40, 40]);
  return {
    object: CLUSTER,
    track: t,
    moonTrack: NO_MOON(t.length),
    moonSeparationsDeg: apart(t.length, 90),
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
});

describe("scoreObject", () => {
  it("returns null when the object never reaches the minimum altitude in the dark window", () => {
    expect(scoreObject(input({ track: track([14.9, 10, 5, 14]) }))).toBeNull();
  });

  it("rejects a moon track or separations on a different grid", () => {
    expect(() => scoreObject(input({ track: track([40, 40]), moonTrack: NO_MOON(3) }))).toThrow(RangeError);
    expect(() =>
      scoreObject(input({ track: track([40, 40]), moonTrack: NO_MOON(2), moonSeparationsDeg: apart(3, 90) })),
    ).toThrow(RangeError);
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
    const GALAXY: ScoredObject = { ...CLUSTER, id: "M101", type: "galaxy" };
    const moonOf = (overrides: Partial<ScoreInput>) => score(overrides).components.moon;

    it("is 1 when the Moon is below the horizon throughout", () => {
      expect(moonOf({ object: GALAXY, moonTrack: steadyMoon(5, -5, FULL), moonSeparationsDeg: apart(5, 5) })).toBe(1);
    });

    it("is close to 1 at new moon even with the Moon up", () => {
      expect(
        moonOf({ object: GALAXY, moonTrack: steadyMoon(5, 30, NEW), moonSeparationsDeg: apart(5, 20) }),
      ).toBeCloseTo(1, 2);
    });

    it("is 0 for a galaxy beside a full Moon", () => {
      expect(moonOf({ object: GALAXY, moonTrack: steadyMoon(5, 40, FULL), moonSeparationsDeg: apart(5, 5) })).toBe(0);
    });

    it("drops as the Moon gets closer and fuller", () => {
      const at = (separationDeg: number, phaseAngleDeg: number) =>
        moonOf({
          object: GALAXY,
          moonTrack: steadyMoon(5, 40, phaseAngleDeg),
          moonSeparationsDeg: apart(5, separationDeg),
          bortle: 3,
        });
      expect(at(120, 90)).toBeGreaterThan(at(60, 90));
      expect(at(60, 90)).toBeGreaterThan(at(25, 90));
      expect(at(60, 120)).toBeGreaterThan(at(60, 90));
      expect(at(60, 90)).toBeGreaterThan(at(60, 30));
    });

    it("weighs the same moonlight by type: a cluster holds up better than a galaxy, a double star best", () => {
      const sameSky = { moonTrack: steadyMoon(5, 40, 60), moonSeparationsDeg: apart(5, 40), bortle: 3 };
      const galaxy = moonOf({ ...sameSky, object: GALAXY });
      const globular = moonOf({ ...sameSky, object: { ...CLUSTER, type: "globular-cluster" } });
      const open = moonOf({ ...sameSky, object: CLUSTER });
      const double = moonOf({ ...sameSky, object: { ...CLUSTER, type: "double-star" } });
      expect(galaxy).toBeLessThan(globular);
      expect(globular).toBeLessThan(open);
      expect(open).toBeLessThan(double);
    });

    it("averages over the best-window samples only", () => {
      // Window is samples 1..4; sample 0 has the Moon up beside the galaxy but is outside the window.
      const result = score({
        object: GALAXY,
        track: track([5, 20, 50, 30, 20]),
        moonTrack: [{ altitudeDeg: 40, phaseAngleDeg: FULL }, ...steadyMoon(4, -10, FULL)],
        moonSeparationsDeg: apart(5, 5),
      });
      expect(result.components.moon).toBe(1);
    });
  });

  describe("washed out", () => {
    /**
     * A 10′ round galaxy: its core surface brightness is vMag + 2.5·log10(π/4·10·10·3600) − 1.5 = vMag + 12.13.
     * With a 200 mm telescope the limit is 12.4, so both are bright enough to score.
     */
    const coreGalaxy = (coreMag: number): ScoredObject => ({
      id: "M101",
      vMag: coreMag - 12.13,
      surfaceBrightness: null,
      type: "galaxy",
      majorAxisArcmin: 10,
      minorAxisArcmin: 10,
    });
    // A Bortle 2 sky (about 21.4 mag/arcsec² at 40°) and a full Moon 30° away, both well up.
    const fullMoonNight = {
      apertureMm: 200,
      bortle: 2,
      moonTrack: steadyMoon(5, 40, FULL),
      moonSeparationsDeg: apart(5, 30),
    };
    const washedOut = (overrides: Partial<ScoreInput>) => score({ ...fullMoonNight, ...overrides }).washedOut;

    it("hides a faint (24 mag/arcsec²) galaxy 30° from a full Moon, but not a bright (18) one", () => {
      expect(washedOut({ object: coreGalaxy(24) })).toBe(true);
      expect(washedOut({ object: coreGalaxy(18) })).toBe(false);
    });

    it("never hides it without the Moon", () => {
      expect(washedOut({ object: coreGalaxy(24), moonTrack: NO_MOON(5) })).toBe(false);
    });

    it("leaves it to light pollution when the moonless sky already hides it", () => {
      // Under Bortle 8 the moonless sky alone is within 3.5 mag of the core nowhere: not the Moon's fault. A 300 mm
      // telescope keeps the galaxy above the limiting magnitude there.
      expect(washedOut({ object: coreGalaxy(24), bortle: 8, apertureMm: 300 })).toBe(false);
    });

    it("never hides a cluster, M16, or an object without a size", () => {
      expect(washedOut({ object: { ...coreGalaxy(24), type: "open-cluster" } })).toBe(false);
      expect(washedOut({ object: { ...coreGalaxy(24), type: "globular-cluster" } })).toBe(false);
      expect(washedOut({ object: { ...coreGalaxy(24), id: "M16", type: "nebula" } })).toBe(false);
      expect(washedOut({ object: { ...coreGalaxy(24), majorAxisArcmin: null, minorAxisArcmin: null } })).toBe(false);
    });

    it("takes a missing minor axis as round", () => {
      expect(washedOut({ object: { ...coreGalaxy(24), minorAxisArcmin: null } })).toBe(true);
    });

    it("only counts an object a moonless night would list", () => {
      // Lost in the moonlight at 40°, but up for one sample of ten in a 70 mm telescope: duration and brightness
      // keep it under MIN_OBJECT_SCORE even at moon = 1, so the Moon is not what keeps it off the list.
      const brief = { ...fullMoonNight, object: coreGalaxy(24), track: track([40, 5, 5, 5, 5, 5, 5, 5, 5, 5]) };
      const night = { moonTrack: steadyMoon(10, 40, FULL), moonSeparationsDeg: apart(10, 30) };
      expect(score({ ...brief, ...night, apertureMm: 200 }).washedOut).toBe(true);
      expect(score({ ...brief, ...night, apertureMm: 70 }).washedOut).toBe(false);
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
      const faint: ScoredObject = { ...CLUSTER, surfaceBrightness: 22, type: "globular-cluster" };
      expect(score({ object: faint, bortle: 8 }).components.sky).toBeCloseTo(0.6, 12);
      expect(score({ object: faint, bortle: 2 }).components.sky).toBe(1);
    });

    it("does not penalise a known surface brightness at or brighter than the threshold, whatever the type", () => {
      expect(score({ object: { ...CLUSTER, surfaceBrightness: 21, type: "galaxy" }, bortle: 8 }).components.sky).toBe(
        1,
      );
      expect(score({ object: { ...CLUSTER, surfaceBrightness: 13, type: "galaxy" }, bortle: 8 }).components.sky).toBe(
        1,
      );
    });

    it("falls back to the type when the surface brightness is unknown", () => {
      for (const type of ["galaxy", "nebula", "emission-nebula", "reflection-nebula", "supernova-remnant"] as const) {
        expect(score({ object: { ...CLUSTER, type }, bortle: 9 }).components.sky).toBeCloseTo(0.6, 12);
      }
      for (const type of ["open-cluster", "globular-cluster", "planetary-nebula", "double-star"] as const) {
        expect(score({ object: { ...CLUSTER, type }, bortle: 9 }).components.sky).toBe(1);
      }
    });
  });

  it("totals the weighted components", () => {
    const result = score({
      object: { ...CLUSTER, vMag: 3.1, type: "galaxy" },
      track: track([5, 20, 50, 30, 20]),
      moonTrack: steadyMoon(5, 30, 90),
      moonSeparationsDeg: apart(5, 60),
    });
    const { duration, moon: moonValue, brightness, sky } = result.components;
    // Window samples 1..4 at 20°, 50°, 30°, 20° → 0.2 + 1 + 0.6 + 0.2 over 5 samples.
    expect(duration).toBeCloseTo(0.4, 12);
    expect(moonValue).toBeGreaterThan(0);
    expect(moonValue).toBeLessThan(1);
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
      // Right beside a full Moon: even a double star's moon component is about 0.
      moonTrack: steadyMoon(2, 30, FULL),
      moonSeparationsDeg: apart(2, 0),
    });
    expect(nearZero.total).toBe(0);
  });
});
