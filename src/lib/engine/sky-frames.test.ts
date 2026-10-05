import {
  HorizonFromVector,
  RotateVector,
  Rotation_EQJ_HOR,
  Spherical,
  Vector,
  VectorFromSphere,
} from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { WARSAW, circularDeltaDeg, messierTarget } from "./fixtures";
import { moonTrack } from "./moon";
import { observingNight } from "./night";
import { objectTracks } from "./objects";
import { PLANET_KEYS, planetTracks } from "./planets";
import { skyFrames } from "./sky-frames";
import { observerFor, sunAltitudeDeg, sunEvents } from "./sun";
import type { Interval } from "./types";

const DEG = Math.PI / 180;

/** Sunset to sunrise in Warsaw on the night of 10 October 2026. */
function warsawNight(): Interval {
  const { sunset, sunrise } = sunEvents(WARSAW, observingNight("2026-10-10", WARSAW.timeZone));
  if (sunset === null || sunrise === null) {
    throw new Error("expected a sunset and a sunrise in Warsaw on 2026-10-10");
  }
  return { start: sunset, end: sunrise };
}

/**
 * The browser's rotation (interactive-sky, Critical Implementation Details): out_j = Σ_i flat[3i + j]·v_i, then
 * altitude = asin(z′) and azimuth = atan2(−y′, x′) in [0, 360), from north through east.
 */
function rotateFlat(flat: readonly number[], v: readonly [number, number, number]): { altDeg: number; azDeg: number } {
  const [x, y, z] = [0, 1, 2].map((j) => flat[j] * v[0] + flat[3 + j] * v[1] + flat[6 + j] * v[2]);
  const az = Math.atan2(-y, x) / DEG;
  return { altDeg: Math.asin(Math.max(-1, Math.min(1, z))) / DEG, azDeg: ((az % 360) + 360) % 360 };
}

describe("skyFrames", () => {
  const night = warsawNight();
  const frames = skyFrames(WARSAW, night);

  it("samples the same instants as every track over the same interval", () => {
    const times = frames.map((frame) => frame.time.getTime());
    const [m13] = objectTracks(WARSAW, night, [messierTarget("M13")]);
    const planets = planetTracks(WARSAW, night, PLANET_KEYS);
    const moon = moonTrack(WARSAW, night);
    for (const track of [m13, ...planets, moon]) {
      expect(track.map((sample) => sample.time.getTime())).toEqual(times);
    }
    expect(times[0]).toBe(night.start.getTime());
    expect(times.at(-1)).toBe(night.end.getTime());
  });

  it("carries the Sun's altitude and a flattened rotation per frame", () => {
    for (const frame of [frames[0], frames[Math.floor(frames.length / 2)]]) {
      expect(frame.sunAltitudeDeg).toBe(sunAltitudeDeg(WARSAW, frame.time));
      const { rot } = Rotation_EQJ_HOR(frame.time, observerFor(WARSAW));
      expect(frame.rotation).toHaveLength(9);
      expect(frame.rotation).toEqual(rot.flat());
    }
    // Deep in the night the Sun is far below the horizon.
    expect(frames[Math.floor(frames.length / 2)].sunAltitudeDeg).toBeLessThan(-30);
  });

  it("places a J2000 star with the flattened matrix as astronomy-engine does, within 0.01°", () => {
    // Vega, Capella and Polaris (J2000 RA hours, Dec degrees).
    const stars = [
      { raHours: 18.6156, decDeg: 38.7837 },
      { raHours: 5.2782, decDeg: 45.998 },
      { raHours: 2.5303, decDeg: 89.2641 },
    ];
    for (const frame of [frames[0], frames[Math.floor(frames.length / 3)], frames.at(-1) ?? frames[0]]) {
      const rotation = Rotation_EQJ_HOR(frame.time, observerFor(WARSAW));
      for (const star of stars) {
        const v: Vector = VectorFromSphere(new Spherical(star.decDeg, star.raHours * 15, 1), frame.time);
        const expected = HorizonFromVector(RotateVector(rotation, v), "");
        const actual = rotateFlat(frame.rotation, [v.x, v.y, v.z]);
        expect(Math.abs(actual.altDeg - expected.lat)).toBeLessThan(0.01);
        expect(circularDeltaDeg(actual.azDeg, expected.lon)).toBeLessThan(0.01);
      }
    }
  });
});
