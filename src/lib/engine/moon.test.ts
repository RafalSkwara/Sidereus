import { Body, EquatorFromVector, GeoVector } from "astronomy-engine";
import { describe, expect, it, test } from "vitest";

import {
  FIXTURES,
  MOON_REFERENCES,
  TROMSO,
  WARSAW,
  circularDeltaDeg,
  fixtureTimeMs,
  messierTarget,
  siteOf,
} from "./fixtures";
import { moonElongationDeg, moonFreeMinutes, moonPhaseBand, moonSeparationDeg, moonState, moonTrack } from "./moon";
import { observingNight } from "./night";
import { ALTITUDE_TOLERANCE_DEG, MOON_PHASE_BANDS, TIME_TOLERANCE_MINUTES } from "./parameters";
import type { MoonPhaseBand } from "./parameters";
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

/**
 * Refraction models differ near the horizon (Skyfield's depends on temperature and pressure, astronomy-engine's
 * "normal" is fixed), so positions are compared only above this altitude, as in `planets.test.ts`.
 */
const REFERENCE_MIN_ALTITUDE_DEG = 5;

/** Moon position agreement with Skyfield, degrees: the Moon's ~1° parallax makes it more sensitive than a planet. */
const MOON_POSITION_TOLERANCE_DEG = 0.2;
/** Illuminated-fraction agreement with Skyfield: half a percentage point. */
const MOON_ILLUMINATION_TOLERANCE = 0.005;
/** Elongation agreement with Skyfield, degrees. */
const MOON_ELONGATION_TOLERANCE_DEG = 0.3;

describe("Moon position, illumination and elongation vs the Skyfield/DE421 reference", () => {
  for (const reference of MOON_REFERENCES) {
    const site = siteOf(reference);
    const above = reference.samples.filter((s) => s.altitudeDeg > REFERENCE_MIN_ALTITUDE_DEG);

    it(`${reference.name}: ${above.length} samples above ${REFERENCE_MIN_ALTITUDE_DEG}° within ${MOON_POSITION_TOLERANCE_DEG}°`, () => {
      expect(above.length).toBeGreaterThanOrEqual(6);
      for (const s of above) {
        const state = moonState(site, new Date(fixtureTimeMs(s.time)));
        expect(Math.abs(state.altitudeDeg - s.altitudeDeg)).toBeLessThanOrEqual(MOON_POSITION_TOLERANCE_DEG);
        expect(circularDeltaDeg(state.azimuthDeg, s.azimuthDeg)).toBeLessThanOrEqual(MOON_POSITION_TOLERANCE_DEG);
      }
    });

    it(`${reference.name}: illumination of all ${reference.samples.length} samples within ${MOON_ILLUMINATION_TOLERANCE} and elongation within ${MOON_ELONGATION_TOLERANCE_DEG}°`, () => {
      for (const s of reference.samples) {
        const time = new Date(fixtureTimeMs(s.time));
        expect(Math.abs(moonState(site, time).illuminatedFraction - s.illuminatedFraction)).toBeLessThanOrEqual(
          MOON_ILLUMINATION_TOLERANCE,
        );
        expect(circularDeltaDeg(moonElongationDeg(time), s.elongationDeg)).toBeLessThanOrEqual(
          MOON_ELONGATION_TOLERANCE_DEG,
        );
      }
    });
  }
});

describe("moonElongationDeg", () => {
  it("stays in [0, 360) across a whole lunation and grows between new moons", () => {
    const startMs = Date.parse("2026-10-10T16:00:00Z");
    let wraps = 0;
    let previous = moonElongationDeg(new Date(startMs));
    for (let hour = 6; hour <= 30 * 24; hour += 6) {
      const elongation = moonElongationDeg(new Date(startMs + hour * 3_600_000));
      expect(elongation).toBeGreaterThanOrEqual(0);
      expect(elongation).toBeLessThan(360);
      if (elongation < previous) {
        wraps++;
      }
      previous = elongation;
    }
    // One new moon (2026-11-09) inside the 30 days after the 2026-10-10 one.
    expect(wraps).toBe(1);
  });
});

describe("moonPhaseBand", () => {
  it("covers [0, 360) in order without gaps", () => {
    expect(MOON_PHASE_BANDS[0].fromDeg).toBe(0);
    expect(MOON_PHASE_BANDS[MOON_PHASE_BANDS.length - 1].toDeg).toBe(360);
    for (let i = 1; i < MOON_PHASE_BANDS.length; i++) {
      expect(MOON_PHASE_BANDS[i].fromDeg).toBe(MOON_PHASE_BANDS[i - 1].toDeg);
    }
  });

  // Each edge belongs to the band above it (upper bounds are exclusive).
  const edges: [number, MoonPhaseBand, MoonPhaseBand][] = [
    [80, "waxing-crescent", "first-quarter"],
    [110, "first-quarter", "waxing-gibbous"],
    [165, "waxing-gibbous", "full"],
    [195, "full", "waning-gibbous"],
    [250, "waning-gibbous", "last-quarter"],
    [280, "last-quarter", "waning-crescent"],
  ];
  for (const [edge, below, above] of edges) {
    it(`puts ${edge}° in ${above} and just below it in ${below}`, () => {
      expect(moonPhaseBand(edge - 1e-9)).toBe(below);
      expect(moonPhaseBand(edge)).toBe(above);
    });
  }

  it("wraps around at 0/360: new moon is a waxing crescent, just before it a waning crescent", () => {
    expect(moonPhaseBand(0)).toBe("waxing-crescent");
    expect(moonPhaseBand(360)).toBe("waxing-crescent");
    expect(moonPhaseBand(359.999)).toBe("waning-crescent");
    expect(moonPhaseBand(-0.001)).toBe("waning-crescent");
    expect(moonPhaseBand(370)).toBe("waxing-crescent");
  });

  it("rejects a non-finite elongation", () => {
    expect(() => moonPhaseBand(Number.NaN)).toThrow(RangeError);
  });

  // Each instant was checked to sit at least 5° of elongation from a band edge (astronomy-engine, 2026-10-01).
  const instants: [string, MoonPhaseBand][] = [
    ["2026-10-14T20:00:00Z", "waxing-crescent"], // 48°
    ["2026-10-18T18:00:00Z", "first-quarter"], // 91°
    ["2026-10-22T20:00:00Z", "waxing-gibbous"], // 137°
    ["2026-10-26T20:00:00Z", "full"], // 189°
    ["2026-10-28T23:00:00Z", "waning-gibbous"], // 218°
    ["2026-11-01T12:00:00Z", "last-quarter"], // 265°
    ["2026-11-05T04:00:00Z", "waning-crescent"], // 311°
  ];
  for (const [iso, band] of instants) {
    it(`gives ${band} at ${iso}`, () => {
      expect(moonPhaseBand(moonElongationDeg(new Date(iso)))).toBe(band);
    });
  }
});
