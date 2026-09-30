import { Body, EquatorFromVector, GeoVector } from "astronomy-engine";
import { describe, expect, it, test } from "vitest";

import { FIXTURES, TROMSO, WARSAW, circularDeltaDeg, fixtureTimeMs, messierTarget, siteOf } from "./fixtures";
import { moonFreeMinutes, moonSeparationDeg, moonState, moonTrack } from "./moon";
import { observingNight } from "./night";
import { ALTITUDE_TOLERANCE_DEG, TIME_TOLERANCE_MINUTES } from "./parameters";
import { darkWindow } from "./sun";
import type { EquatorialJ2000, Interval, Site } from "./types";

const ILLUMINATION_TOLERANCE = 0.02;

describe("moonState (synthetic)", () => {
  // 2026-10-10 is a new-moon night (new moon 15:50 UTC) and is never used for moon assertions.
  // 2026-10-24 is waxing gibbous, two nights before the 2026-10-26 full moon.
  const night = observingNight("2026-10-24", WARSAW.timeZone);
  const track = moonTrack(WARSAW, night);

  it("waxes strictly across the 2026-10-24 night (waxing gibbous toward the 2026-10-26 full moon)", () => {
    for (let i = 1; i < track.length; i++) {
      expect(track[i].illuminatedFraction).toBeGreaterThan(track[i - 1].illuminatedFraction);
      expect(track[i].phaseAngleDeg).toBeLessThan(track[i - 1].phaseAngleDeg);
    }
    expect(track[0].illuminatedFraction).toBeGreaterThan(0.9);
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
});

describe("moonFreeMinutes (synthetic)", () => {
  const MINUTE_MS = 60_000;

  function windowOf(site: Site, date: string): Interval {
    const window = darkWindow(site, observingNight(date, site.timeZone), -18);
    if (window.kind !== "window") {
      throw new Error(`expected a dark window on ${date}`);
    }
    return window;
  }

  /** Oracle: `moonState` every minute across `[start, end)`; each sample below 0° is one moon-free minute. */
  function sampled(site: Site, interval: Interval): { freeMinutes: number; changes: number } {
    let freeMinutes = 0;
    let changes = 0;
    let previous: boolean | null = null;
    for (let t = interval.start.getTime(); t < interval.end.getTime(); t += MINUTE_MS) {
      const below = moonState(site, new Date(t)).altitudeDeg < 0;
      if (below) {
        freeMinutes++;
      }
      if (previous !== null && below !== previous) {
        changes++;
      }
      previous = below;
    }
    return { freeMinutes, changes };
  }

  const windowMinutes = (interval: Interval): number => (interval.end.getTime() - interval.start.getTime()) / MINUTE_MS;

  // 2026-10-10 new moon (Moon down all night), 2026-10-25 full moon (up all night), 2026-11-01 waning
  // with moonrise ~20:58 UTC inside the window, 2026-10-19 waxing with moonset ~21:45 UTC inside it,
  // and a Tromsø night with moonset inside it, where the limb-vs-centre difference is largest.
  const cases: { name: string; site: Site; date: string; crossings: number }[] = [
    { name: "Warsaw near new moon", site: WARSAW, date: "2026-10-10", crossings: 0 },
    { name: "Warsaw near full moon", site: WARSAW, date: "2026-10-25", crossings: 0 },
    { name: "Warsaw with moonrise inside the window", site: WARSAW, date: "2026-11-01", crossings: 1 },
    { name: "Warsaw with moonset inside the window", site: WARSAW, date: "2026-10-19", crossings: 1 },
    { name: "Tromsø with moonset inside the window", site: TROMSO, date: "2026-10-20", crossings: 1 },
  ];

  for (const { name, site, date, crossings } of cases) {
    it(`${name} (${date}): within ${TIME_TOLERANCE_MINUTES} min of a 1-minute moonState sampling`, () => {
      const window = windowOf(site, date);
      const oracle = sampled(site, window);
      expect(oracle.changes).toBe(crossings);
      const free = moonFreeMinutes(site, window);
      expect(Number.isInteger(free)).toBe(true);
      expect(Math.abs(free - oracle.freeMinutes)).toBeLessThanOrEqual(TIME_TOLERANCE_MINUTES);
      expect(free).toBeGreaterThanOrEqual(0);
      expect(free).toBeLessThanOrEqual(windowMinutes(window));
    });
  }

  it("is the whole window near new moon and zero near full moon", () => {
    const newMoon = windowOf(WARSAW, "2026-10-10");
    expect(moonFreeMinutes(WARSAW, newMoon)).toBe(Math.floor(windowMinutes(newMoon)));
    expect(moonFreeMinutes(WARSAW, windowOf(WARSAW, "2026-10-25"))).toBe(0);
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
