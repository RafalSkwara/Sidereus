import { Body, EquatorFromVector, GeoVector } from "astronomy-engine";
import { describe, expect, it, test } from "vitest";

import { FIXTURES, WARSAW, circularDeltaDeg, fixtureTimeMs, messierTarget, siteOf } from "./fixtures";
import { moonSeparationDeg, moonState, moonTrack } from "./moon";
import { observingNight } from "./night";
import { ALTITUDE_TOLERANCE_DEG } from "./parameters";
import type { EquatorialJ2000 } from "./types";

const ILLUMINATION_TOLERANCE = 0.02;

describe("moonState (synthetic)", () => {
  // 2026-10-10 is a new-moon night (new moon 15:50 UTC) and is never used for moon assertions.
  // 2026-10-24 is waxing gibbous, two nights before the 2026-10-26 full moon.
  const night = observingNight("2026-10-24", WARSAW.timeZone);
  const track = moonTrack(WARSAW, night);

  it("samples the whole night inclusive of both ends at the default step", () => {
    expect(track[0]?.time.getTime()).toBe(night.start.getTime());
    expect(track.at(-1)?.time.getTime()).toBe(night.end.getTime());
    expect(track.length).toBe(25 * 6 + 1); // 25-hour DST night, 10-minute grid
  });

  it("keeps illuminatedFraction in [0, 1], phase angle in [0, 180] and azimuth in [0, 360)", () => {
    for (const sample of track) {
      expect(sample.illuminatedFraction).toBeGreaterThanOrEqual(0);
      expect(sample.illuminatedFraction).toBeLessThanOrEqual(1);
      expect(sample.phaseAngleDeg).toBeGreaterThanOrEqual(0);
      expect(sample.phaseAngleDeg).toBeLessThanOrEqual(180);
      expect(sample.altitudeDeg).toBeGreaterThanOrEqual(-90);
      expect(sample.altitudeDeg).toBeLessThanOrEqual(90);
      expect(sample.azimuthDeg).toBeGreaterThanOrEqual(0);
      expect(sample.azimuthDeg).toBeLessThan(360);
    }
  });

  it("waxes strictly across the 2026-10-24 night (waxing gibbous toward the 2026-10-26 full moon)", () => {
    for (let i = 1; i < track.length; i++) {
      expect(track[i].illuminatedFraction).toBeGreaterThan(track[i - 1].illuminatedFraction);
      expect(track[i].phaseAngleDeg).toBeLessThan(track[i - 1].phaseAngleDeg);
    }
    expect(track[0].illuminatedFraction).toBeGreaterThan(0.9);
  });

  it("is deterministic and agrees with moonTrack sample by sample", () => {
    const again = moonTrack(WARSAW, night);
    expect(again).toEqual(track);
    const midnight = track[Math.floor(track.length / 2)];
    expect(moonState(WARSAW, midnight.time)).toEqual(midnight);
  });

  it("rejects a step below one minute", () => {
    expect(() => moonTrack(WARSAW, night, 0)).toThrow(RangeError);
    expect(() => moonTrack(WARSAW, night, -10)).toThrow(RangeError);
    expect(() => moonTrack(WARSAW, night, 0.5)).toThrow(RangeError);
  });
});

describe("moonSeparationDeg (synthetic)", () => {
  const time = new Date("2026-10-24T20:00:00Z");
  const targets: EquatorialJ2000[] = [
    messierTarget("M31"),
    messierTarget("M13"),
    messierTarget("M45"),
    { raHours: 0, decDeg: 0 },
    { raHours: 12, decDeg: -89.9 },
  ];

  it("stays in [0, 180] for every target", () => {
    for (const target of targets) {
      const sep = moonSeparationDeg(time, target);
      expect(sep).toBeGreaterThanOrEqual(0);
      expect(sep).toBeLessThanOrEqual(180);
    }
  });

  it("is symmetric: a target and its antipode sum to 180°", () => {
    for (const target of targets) {
      const antipode: EquatorialJ2000 = { raHours: (target.raHours + 12) % 24, decDeg: -target.decDeg };
      // 4 decimal places = 5e-5° (0.2 arcsec): loose enough for trig round-trips to agree across CPUs.
      expect(moonSeparationDeg(time, target) + moonSeparationDeg(time, antipode)).toBeCloseTo(180, 4);
    }
  });

  it("is zero for a target at the Moon's own geocentric J2000 position", () => {
    const moon = EquatorFromVector(GeoVector(Body.Moon, time, true));
    // Vector → RA/Dec → vector leaves ~1e-6° of float residual that differs between CPUs (CI on
    // x86 measured 1.2e-6°); 4 decimal places (5e-5°, 0.2 arcsec) is the physically meaningful bound.
    expect(moonSeparationDeg(time, { raHours: moon.ra, decDeg: moon.dec })).toBeCloseTo(0, 4);
  });

  it("is deterministic", () => {
    const m31 = messierTarget("M31");
    expect(moonSeparationDeg(time, m31)).toBe(moonSeparationDeg(time, m31));
  });
});

describe("moon vs Stellarium fixtures", () => {
  for (const fixture of FIXTURES) {
    if (fixture.moon.status !== "captured") {
      test.todo(`${fixture.name}: moon values ${fixture.moon.status} — see src/lib/engine/fixtures/README.md`);
      continue;
    }
    const moon = fixture.moon;
    const site = siteOf(fixture);

    it(`${fixture.name}: ${moon.samples.length} moon samples within ${ALTITUDE_TOLERANCE_DEG}° and ${ILLUMINATION_TOLERANCE} illumination`, () => {
      for (const sample of moon.samples) {
        const state = moonState(site, new Date(fixtureTimeMs(sample.time)));
        expect(Math.abs(state.altitudeDeg - sample.altitudeDeg)).toBeLessThanOrEqual(ALTITUDE_TOLERANCE_DEG);
        expect(circularDeltaDeg(state.azimuthDeg, sample.azimuthDeg)).toBeLessThanOrEqual(ALTITUDE_TOLERANCE_DEG);
        expect(Math.abs(state.illuminatedFraction - sample.illuminatedFraction)).toBeLessThanOrEqual(
          ILLUMINATION_TOLERANCE,
        );
      }
    });
  }
});
