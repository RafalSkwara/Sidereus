import { describe, expect, it } from "vitest";

import { DEEP_SKY } from "@/lib/catalogue";

import { contrastBand, telescopeLimitingMag } from "./contrast";
import {
  BRIGHTNESS_RAMP_MAG,
  DURATION_USEFUL_SPAN_MINUTES,
  GALAXY_FAINT_BRIGHTNESS_CAP,
  GALAXY_LIMIT_BRIGHTNESS_CAP,
  LOW_INTEREST_PENALTY,
  MIN_OBJECT_SCORE,
  WELL_PLACED_ALTITUDE_DEG,
  bortlePenaltyForBortle,
  nakedEyeLimitingMagForBortle,
} from "./parameters";
import { scoreObject } from "./score";
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
  hubble: null,
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

describe("scoreObject", () => {
  it("scores nothing it cannot place: null below the minimum altitude or past the telescope's limit, a RangeError for a moon grid that differs", () => {
    expect(scoreObject(input({ track: track([14.9, 10, 5, 14]) }))).toBeNull();
    const limit = nakedEyeLimitingMagForBortle(6);
    expect(scoreObject(input({ object: { ...CLUSTER, vMag: limit + 0.01 } }))).toBeNull();
    // A larger aperture reaches it.
    expect(scoreObject(input({ object: { ...CLUSTER, vMag: limit + 5 }, apertureMm: 70 }))).not.toBeNull();
    expect(() => scoreObject(input({ track: track([40, 40]), moonTrack: NO_MOON(3) }))).toThrow(RangeError);
    expect(() =>
      scoreObject(input({ track: track([40, 40]), moonTrack: NO_MOON(2), moonSeparationsDeg: apart(3, 90) })),
    ).toThrow(RangeError);
  });

  describe("duration", () => {
    it("credits a pass by its altitude: 0 hugging the minimum, rising towards WELL_PLACED_ALTITUDE_DEG, 1 from there up, from the longest run", () => {
      // Thirteen samples are the full useful span, so only the placement is left.
      const held = (altitudeDeg: number) =>
        score({ track: track(Array.from({ length: 13 }, () => altitudeDeg)) }).components.duration;
      expect(held(15)).toBe(0);
      const climbing = [20, 25, 30, 35].map(held);
      climbing.forEach((value, i) => {
        expect(value, `altitude ${20 + 5 * i}°`).toBeGreaterThan(i === 0 ? 0 : climbing[i - 1]);
        expect(value, `altitude ${20 + 5 * i}°`).toBeLessThan(1);
      });
      for (const altitudeDeg of [WELL_PLACED_ALTITUDE_DEG, 60, 85, 90]) {
        expect(held(altitudeDeg), `altitude ${altitudeDeg}°`).toBe(1);
      }
      // Two runs above the minimum: the longer one is the window, the shorter one earlier on counts for nothing.
      const twoRuns = score({ track: track([20, 20, 5, 5, 30, 40, 35, 16, 10, 20]) });
      expect(twoRuns.components.duration).toBeCloseTo(
        score({ track: track([30, 40, 35, 16]) }).components.duration,
        12,
      );
      expect(twoRuns.window.peak.altitudeDeg).toBe(40);
    });

    // evening-showpieces (M-4 S-05): duration saturates at a useful span instead of dividing by the whole night.
    describe("saturating at DURATION_USEFUL_SPAN_MINUTES", () => {
      const STEP_MINUTES = 10;
      /** A night of `nightSamples` samples with the object at `altitudeDeg` for `passSamples` of them, from sample 3. */
      const night = (nightSamples: number, passSamples: number, altitudeDeg = 40) =>
        track(Array.from({ length: nightSamples }, (_, i) => (i >= 3 && i < 3 + passSamples ? altitudeDeg : 5)));
      const durationOf = (t: HorizontalPosition[]) => score({ track: t }).components.duration;

      it("gives the same pass the same duration in a 6 h and a 12 h night", () => {
        // 4 h = 24 steps = 25 samples; a 6 h night has 37 samples, a 12 h night 73. The old whole-night share was
        // 25 / 37 against 25 / 73 for the very same pass.
        const short = durationOf(night(37, 25));
        const long = durationOf(night(73, 25));
        expect(long).toBeCloseTo(short, 12);
        expect(short).toBe(1);
      });

      it("rises with the window's length up to the span and not beyond it", () => {
        const spanSamples = DURATION_USEFUL_SPAN_MINUTES / STEP_MINUTES + 1;
        const below = [2, Math.floor(spanSamples / 2), spanSamples - 1].map((n) => durationOf(night(80, n)));
        expect(below[0]).toBeGreaterThan(0);
        expect(below[1]).toBeGreaterThan(below[0]);
        expect(below[2]).toBeGreaterThan(below[1]);
        expect(below[2]).toBeLessThan(1);
        const atAndBeyond = [spanSamples, spanSamples + 1, 2 * spanSamples, 60].map((n) => durationOf(night(80, n)));
        for (const value of atAndBeyond) {
          expect(value).toBe(1);
        }
      });

      it("scales a short pass by its span over DURATION_USEFUL_SPAN_MINUTES, times its mean placement", () => {
        // Five samples at 27.5° (placement 0.5 over 15° to 40°): a span of 40 minutes.
        const result = durationOf(night(40, 5, 27.5));
        expect(result).toBeCloseTo((40 / DURATION_USEFUL_SPAN_MINUTES) * 0.5, 12);
      });

      it("scores a window of one sample 0, whatever its altitude", () => {
        expect(durationOf(track([5, 90, 5]))).toBe(0);
        expect(durationOf(track([90]))).toBe(0);
      });

      it("does not move when the window's start moves inside a sample step", () => {
        // Same samples at or above 15°; only the sample before them moves, so the crossing between them moves.
        const early = score({ track: track([14.9, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40]) });
        const late = score({ track: track([0, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40]) });
        expect(early.window.start.getTime()).not.toBe(late.window.start.getTime());
        expect(early.components.duration).toBe(late.components.duration);
        expect(early.total).toBe(late.total);
      });

      it("does not depend on the aperture", () => {
        const t = night(50, 9, 30);
        const at = (apertureMm: number) => score({ track: t, apertureMm }).components.duration;
        expect(at(60)).toBe(at(150));
        expect(at(150)).toBe(at(300));
      });
    });
  });

  describe("moon", () => {
    const GALAXY: ScoredObject = { ...CLUSTER, id: "M101", type: "galaxy" };
    const moonOf = (overrides: Partial<ScoreInput>) => score(overrides).components.moon;

    it("hides nothing with the Moon down or new, and weighs it by closeness, fullness and type, over the best window only", () => {
      expect(moonOf({ object: GALAXY, moonTrack: steadyMoon(5, -5, FULL), moonSeparationsDeg: apart(5, 5) })).toBe(1);
      expect(
        moonOf({ object: GALAXY, moonTrack: steadyMoon(5, 30, NEW), moonSeparationsDeg: apart(5, 20) }),
      ).toBeCloseTo(1, 2);
      expect(moonOf({ object: GALAXY, moonTrack: steadyMoon(5, 40, FULL), moonSeparationsDeg: apart(5, 5) })).toBe(0);

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

      // The same moonlight: a cluster holds up better than a galaxy, a double star best.
      const sameSky = { moonTrack: steadyMoon(5, 40, 60), moonSeparationsDeg: apart(5, 40), bortle: 3 };
      const galaxy = moonOf({ ...sameSky, object: GALAXY });
      const globular = moonOf({ ...sameSky, object: { ...CLUSTER, type: "globular-cluster" } });
      const open = moonOf({ ...sameSky, object: CLUSTER });
      const double = moonOf({ ...sameSky, object: { ...CLUSTER, type: "double-star" } });
      expect(galaxy).toBeLessThan(globular);
      expect(globular).toBeLessThan(open);
      expect(open).toBeLessThan(double);

      // Window is samples 1..4; sample 0 has the Moon up beside the galaxy but is outside the window.
      const windowOnly = score({
        object: GALAXY,
        track: track([5, 20, 50, 30, 20]),
        moonTrack: [{ altitudeDeg: 40, phaseAngleDeg: FULL }, ...steadyMoon(4, -10, FULL)],
        moonSeparationsDeg: apart(5, 5),
      });
      expect(windowOnly.components.moon).toBe(1);
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
      hubble: null,
    });
    // A Bortle 2 sky (about 21.4 mag/arcsec² at 40°) and a full Moon 30° away, both well up.
    const fullMoonNight = {
      apertureMm: 200,
      bortle: 2,
      moonTrack: steadyMoon(5, 40, FULL),
      moonSeparationsDeg: apart(5, 30),
    };
    const washedOut = (overrides: Partial<ScoreInput>) => score({ ...fullMoonNight, ...overrides }).washedOut;

    it("hides a faint galaxy near a full Moon only: never a bright one, without the Moon, under a sky that already hides it, a cluster, M16 or a sizeless object", () => {
      expect(washedOut({ object: coreGalaxy(24) }), "faint (24 mag/arcsec²) galaxy 30° from a full Moon").toBe(true);
      expect(washedOut({ object: coreGalaxy(18) }), "bright (18) galaxy").toBe(false);
      expect(washedOut({ object: coreGalaxy(24), moonTrack: NO_MOON(5) }), "no Moon").toBe(false);
      // Under Bortle 8 the moonless sky alone is within 3.5 mag of the core nowhere: not the Moon's fault. A 300 mm
      // telescope keeps the galaxy above the limiting magnitude there.
      expect(washedOut({ object: coreGalaxy(24), bortle: 8, apertureMm: 300 }), "light pollution").toBe(false);
      expect(washedOut({ object: { ...coreGalaxy(24), type: "open-cluster" } }), "open cluster").toBe(false);
      expect(washedOut({ object: { ...coreGalaxy(24), type: "globular-cluster" } }), "globular cluster").toBe(false);
      expect(washedOut({ object: { ...coreGalaxy(24), id: "M16", type: "nebula" } }), "M16").toBe(false);
      expect(
        washedOut({ object: { ...coreGalaxy(24), majorAxisArcmin: null, minorAxisArcmin: null } }),
        "no size",
      ).toBe(false);
      expect(washedOut({ object: { ...coreGalaxy(24), minorAxisArcmin: null } }), "missing minor axis is round").toBe(
        true,
      );

      // Lost in the moonlight, but up for three samples at 30° (a pass of 20 minutes, placement 0.6 over 15° to 40°,
      // so duration is 20 / DURATION_USEFUL_SPAN_MINUTES × 0.6 = 0.1; evening-showpieces: the old one-sample pass
      // now scores 0, which keeps no galaxy of this brightness on the list at any aperture). In a 70 mm telescope
      // duration and brightness keep it under MIN_OBJECT_SCORE even at moon = 1, so the Moon is not what keeps it off
      // the list; in a 200 mm one the same pass would list it on a moonless night, so there the Moon is.
      const brief = { ...fullMoonNight, object: coreGalaxy(24), track: track([30, 30, 30, 5, 5, 5, 5, 5, 5, 5]) };
      const night = { moonTrack: steadyMoon(10, 40, FULL), moonSeparationsDeg: apart(10, 30) };
      const big = score({ ...brief, ...night, apertureMm: 200 });
      expect(big.components.duration).toBeCloseTo((20 / DURATION_USEFUL_SPAN_MINUTES) * 0.6, 12);
      expect(big.washedOut).toBe(true);
      const dim = score({ ...brief, ...night, apertureMm: 70 });
      expect(dim.washedOut).toBe(false);
      // Neither washed out nor cleared: it stays under the bar on its own score.
      expect(dim.total).toBeLessThan(MIN_OBJECT_SCORE);
    });
  });

  describe("brightness", () => {
    // small-scope-galaxies: a galaxy's credit follows its contrast band (the line), never more than it allows.
    describe("for a galaxy", () => {
      // A 10' round galaxy under a Bortle 2 sky in a 200 mm telescope; its core surface brightness is vMag + 12.13.
      const night = { bortle: 2, apertureMm: 200 };
      const galaxyAt = (coreMag: number): ScoredObject => ({
        ...CLUSTER,
        id: "M33",
        type: "galaxy",
        vMag: coreMag - 12.13,
      });
      const ramp = (object: ScoredObject) =>
        Math.min(1, (telescopeLimitingMag(night.bortle, night.apertureMm) - object.vMag) / BRIGHTNESS_RAMP_MAG);
      const brightnessOf = (object: ScoredObject) => score({ object, ...night }).components.brightness;

      it("keeps the headroom ramp for a galaxy in the bright and smudge bands and for every other type, whatever its band", () => {
        for (const [coreMag, band] of [
          [21, "bright"],
          [23, "smudge"],
        ] as const) {
          const object = galaxyAt(coreMag);
          expect(contrastBand(object, night.bortle, night.apertureMm)).toBe(band);
          expect(ramp(object)).toBeGreaterThan(GALAXY_FAINT_BRIGHTNESS_CAP);
          expect(brightnessOf(object), band).toBeCloseTo(ramp(object), 12);
        }
        const nebula: ScoredObject = { ...galaxyAt(24), id: "M1", type: "nebula" };
        expect(contrastBand(nebula, night.bortle, night.apertureMm)).toBe("faint");
        expect(brightnessOf(nebula)).toBeCloseTo(ramp(nebula), 12);
      });

      it("takes at most GALAXY_FAINT_BRIGHTNESS_CAP in the faint band when the ramp is higher", () => {
        const object = galaxyAt(24);
        expect(contrastBand(object, night.bortle, night.apertureMm)).toBe("faint");
        expect(ramp(object)).toBeGreaterThan(GALAXY_FAINT_BRIGHTNESS_CAP);
        expect(brightnessOf(object)).toBe(GALAXY_FAINT_BRIGHTNESS_CAP);
      });

      it("takes GALAXY_LIMIT_BRIGHTNESS_CAP in the limit band, though it is inside the telescope's limit", () => {
        const object = galaxyAt(25);
        expect(contrastBand(object, night.bortle, night.apertureMm)).toBe("limit");
        expect(ramp(object)).toBeGreaterThan(0);
        expect(brightnessOf(object)).toBe(GALAXY_LIMIT_BRIGHTNESS_CAP);
      });

      it("never rises under a worse sky, for every catalogue galaxy at every aperture (impl review F5)", () => {
        const rises: string[] = [];
        for (const object of DEEP_SKY.filter((o) => o.type === "galaxy")) {
          for (const apertureMm of [60, 80, 100, 150, 200, 300]) {
            let previous = Number.POSITIVE_INFINITY;
            for (let bortle = 1; bortle <= 9; bortle++) {
              // Under a worse sky the telescope's limit falls; a galaxy past it has no score, and stays past it.
              const result = scoreObject(input({ object, bortle, apertureMm }));
              if (result === null) {
                break;
              }
              if (result.components.brightness > previous) {
                rises.push(`${object.id} ${apertureMm} mm Bortle ${bortle}`);
              }
              previous = result.components.brightness;
            }
          }
        }
        expect(rises).toEqual([]);
      });
    });
  });

  it("penalises a faint or nebulous object under a bright sky and a double star or asterism for its low interest, never below 0", () => {
    const faint: ScoredObject = { ...CLUSTER, surfaceBrightness: 22, type: "globular-cluster" };
    expect(score({ object: faint, bortle: 8 }).components.sky).toBeCloseTo(1 - bortlePenaltyForBortle(8), 12);
    expect(score({ object: faint, bortle: 8 }).components.sky).toBeLessThan(1);
    expect(score({ object: faint, bortle: 2 }).components.sky).toBe(1);
    // At or brighter than the threshold nothing is penalised, whatever the type.
    for (const surfaceBrightness of [21, 13]) {
      const galaxy: ScoredObject = { ...CLUSTER, surfaceBrightness, type: "galaxy" };
      expect(score({ object: galaxy, bortle: 8 }).components.sky, `surface brightness ${surfaceBrightness}`).toBe(1);
    }
    // With no surface brightness the type decides.
    for (const type of ["galaxy", "nebula", "emission-nebula", "reflection-nebula", "supernova-remnant"] as const) {
      expect(score({ object: { ...CLUSTER, type }, bortle: 9 }).components.sky, type).toBeLessThan(1);
    }
    for (const type of ["open-cluster", "globular-cluster", "planetary-nebula", "double-star"] as const) {
      expect(score({ object: { ...CLUSTER, type }, bortle: 9 }).components.sky, type).toBe(1);
    }

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
