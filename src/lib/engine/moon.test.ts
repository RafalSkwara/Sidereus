import { Body, EquatorFromVector, GeoVector } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { MESSIER } from "@/lib/catalogue";

import { MOON_REFERENCES, TROMSO, WARSAW, circularDeltaDeg, fixtureTimeMs, messierTarget, siteOf } from "./fixtures";
import {
  moonElongationDeg,
  moonFreeMinutes,
  moonPhaseBand,
  moonSeparationDeg,
  moonSeparationsDeg,
  moonState,
} from "./moon";
import { moonDiscState } from "./moon-disc";
import { moonBrighteningMag, skyBrightnessNL } from "./moonlight";
import type { SkyBrightnessInput } from "./moonlight";
import { observingNight } from "./night";
import { EXTINCTION_V, TIME_TOLERANCE_MINUTES, darkSkyZenithMagForBortle } from "./parameters";
import type { MoonPhaseBand } from "./parameters";
import { darkWindow } from "./sun";
import type { EquatorialJ2000, Interval, Site } from "./types";

describe("moonSeparationDeg (synthetic)", () => {
  const time = new Date("2026-10-24T20:00:00Z");
  const targets: EquatorialJ2000[] = [
    messierTarget("M31"),
    messierTarget("M13"),
    messierTarget("M45"),
    { raHours: 0, decDeg: 0 },
    { raHours: 12, decDeg: -89.9 },
  ];

  it("is symmetric (a target and its antipode sum to 180°) and zero at the Moon's own geocentric J2000 position", () => {
    expect(targets).toHaveLength(5);
    targets.forEach((target, i) => {
      const antipode: EquatorialJ2000 = { raHours: (target.raHours + 12) % 24, decDeg: -target.decDeg };
      // 4 decimal places = 5e-5° (0.2 arcsec): loose enough for trig round-trips to agree across CPUs.
      expect(moonSeparationDeg(time, target) + moonSeparationDeg(time, antipode), `target ${i}`).toBeCloseTo(180, 4);
    });

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

  it(`is within ${TIME_TOLERANCE_MINUTES} min of a 1-minute moonState sampling on a new-moon, a full-moon, a moonrise and two moonset nights`, () => {
    // Non-vacuity: the three crossing nights must really have the Moon up for part of the window.
    expect(cases).toHaveLength(5);
    let partial = 0;
    cases.forEach(({ name, site, date, crossings }, i) => {
      const label = `case ${i}: ${name} (${date})`;
      const window = windowOf(site, date);
      const oracle = sampled(site, window);
      expect(oracle.changes, label).toBe(crossings);
      if (oracle.freeMinutes > 0 && oracle.freeMinutes < windowMinutes(window)) {
        partial++;
      }
      const free = moonFreeMinutes(site, window);
      expect(Number.isInteger(free), label).toBe(true);
      expect(Math.abs(free - oracle.freeMinutes), label).toBeLessThanOrEqual(TIME_TOLERANCE_MINUTES);
      expect(free, label).toBeGreaterThanOrEqual(0);
      expect(free, label).toBeLessThanOrEqual(windowMinutes(window));
    });
    expect(partial).toBe(3);
  });

  it("is the whole window near new moon and zero near full moon", () => {
    const newMoon = windowOf(WARSAW, "2026-10-10");
    expect(moonFreeMinutes(WARSAW, newMoon)).toBe(Math.floor(windowMinutes(newMoon)));
    expect(moonFreeMinutes(WARSAW, windowOf(WARSAW, "2026-10-25"))).toBe(0);
  });
});

/**
 * Refraction models differ near the horizon (Skyfield's depends on temperature and pressure, astronomy-engine's
 * "normal" is fixed), so positions are compared only above this altitude, as in the planet checks.
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
  // Each edge belongs to the band above it (upper bounds are exclusive).
  const edges: [number, MoonPhaseBand, MoonPhaseBand][] = [
    [80, "waxing-crescent", "first-quarter"],
    [110, "first-quarter", "waxing-gibbous"],
    [165, "waxing-gibbous", "full"],
    [195, "full", "waning-gibbous"],
    [250, "waning-gibbous", "last-quarter"],
    [280, "last-quarter", "waning-crescent"],
  ];

  it("puts every band edge in the band above it and just below it in the band under it, wraps at 0/360 and rejects a non-finite elongation", () => {
    expect(edges).toHaveLength(6);
    edges.forEach(([edge, below, above], i) => {
      expect(moonPhaseBand(edge - 1e-9), `edge ${i}: just below ${edge}°`).toBe(below);
      expect(moonPhaseBand(edge), `edge ${i}: ${edge}°`).toBe(above);
    });

    // New moon is a waxing crescent, just before it a waning crescent.
    expect(moonPhaseBand(0)).toBe("waxing-crescent");
    expect(moonPhaseBand(360)).toBe("waxing-crescent");
    expect(moonPhaseBand(359.999)).toBe("waning-crescent");
    expect(moonPhaseBand(-0.001)).toBe("waning-crescent");
    expect(moonPhaseBand(370)).toBe("waxing-crescent");

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

  it("gives the band of the elongation at each of seven instants, one per band", () => {
    expect(new Set(instants.map(([, band]) => band)).size).toBe(7);
    instants.forEach(([iso, band], i) => {
      expect(moonPhaseBand(moonElongationDeg(new Date(iso))), `instant ${i}: ${band} at ${iso}`).toBe(band);
    });
  });
});

/** The plan's illumination bar against Skyfield: the state's 0.01 rounding plus the engine's own error. */
const DISC_ILLUMINATION_TOLERANCE = 0.01;

/** Bright-limb angles computed on the engine during plan review (rev 2), degrees. */
const ANGLE_TOLERANCE_DEG = 0.5;

describe("moonDiscState", () => {
  it("rounds the illuminated fraction to 0.01 and stays within 0.01 of the Skyfield reference", () => {
    for (const reference of MOON_REFERENCES) {
      for (const s of reference.samples) {
        const state = moonDiscState(new Date(fixtureTimeMs(s.time)));
        expect(Math.round(state.illuminatedFraction * 100) / 100).toBe(state.illuminatedFraction);
        expect(Math.abs(state.illuminatedFraction - s.illuminatedFraction)).toBeLessThanOrEqual(
          DISC_ILLUMINATION_TOLERANCE,
        );
        expect(state.waxing).toBe(s.elongationDeg < 180);
      }
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
});

const BASE: SkyBrightnessInput = {
  moonPhaseAngleDeg: 0,
  moonAltitudeDeg: 40,
  objectAltitudeDeg: 50,
  separationDeg: 45,
  darkZenithMag: darkSkyZenithMagForBortle(3),
  extinction: EXTINCTION_V,
};

const brightening = (overrides: Partial<SkyBrightnessInput>) =>
  moonBrighteningMag(skyBrightnessNL({ ...BASE, ...overrides }));

describe("moonlit sky (Krisciunas & Schaefer)", () => {
  it("falls monotonically with separation (within 10° and from 10° to 90°) and with phase angle (full → new), stays finite at the Moon's centre, and is large for a full Moon and small for a thin crescent", () => {
    // K&S is piecewise at 10° and its Rayleigh term rises again past 90°; each stretch is monotonic.
    const stretches = [
      [0.5, 1, 2, 5, 9.9],
      [10, 20, 45, 70, 90],
    ];
    expect(stretches.map((s) => s.length)).toEqual([5, 5]);
    stretches.forEach((separations, k) => {
      const values = separations.map((separationDeg) => brightening({ separationDeg }));
      for (let i = 1; i < values.length; i++) {
        expect(values[i], `separation stretch ${k}, step ${i}`).toBeLessThan(values[i - 1]);
      }
    });
    expect(brightening({ separationDeg: 2 })).toBeGreaterThan(brightening({ separationDeg: 45 }));

    const angles = [0, 6.9, 7, 30, 60, 90, 120, 150, 179];
    expect(angles).toHaveLength(9);
    const byPhase = angles.map((moonPhaseAngleDeg) => brightening({ moonPhaseAngleDeg }));
    for (let i = 1; i < byPhase.length; i++) {
      expect(byPhase[i], `phase step ${i}: ${angles[i]}°`).toBeLessThan(byPhase[i - 1]);
    }

    expect(Number.isFinite(brightening({ separationDeg: 0 }))).toBe(true);
    expect(brightening({ moonPhaseAngleDeg: 0 })).toBeGreaterThan(2);
    expect(brightening({ moonPhaseAngleDeg: 150 })).toBeLessThan(0.5);
  });

  it("adds nothing when the Moon or the object is below the horizon", () => {
    expect(brightening({ moonAltitudeDeg: -0.5 })).toBe(0);
    expect(brightening({ objectAltitudeDeg: -1 })).toBe(0);
  });
});

describe("moonSeparationsDeg", () => {
  it("matches moonSeparationDeg for every target and instant", () => {
    const times = [new Date("2026-10-24T20:00:00Z"), new Date("2026-10-25T02:00:00Z")];
    const targets = MESSIER.filter((_, i) => i % 11 === 0);
    const batch = moonSeparationsDeg(times, targets);
    targets.forEach((target, i) => {
      times.forEach((time, j) => {
        expect(batch[i][j]).toBeCloseTo(moonSeparationDeg(time, target), 6);
      });
    });
  });
});
