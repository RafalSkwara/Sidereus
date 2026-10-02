import { describe, expect, it } from "vitest";

import { MESSIER } from "@/lib/catalogue";

import { moonSeparationDeg, moonSeparationsDeg } from "./moon";
import { effectiveSurfaceBrightness, magToNL, moonBrighteningMag, nlToMag, skyBrightnessNL } from "./moonlight";
import type { SkyBrightnessInput } from "./moonlight";
import { BRIGHT_CORE_OFFSET_MAG, EXTINCTION_V, darkSkyZenithMagForBortle } from "./parameters";

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
  it("converts between mag/arcsec² and nanolamberts both ways", () => {
    for (const mag of [17.8, 19.3, 21.9]) {
      expect(nlToMag(magToNL(mag))).toBeCloseTo(mag, 10);
    }
    // Brighter sky, more nanolamberts.
    expect(magToNL(19)).toBeGreaterThan(magToNL(21));
  });

  it("returns the zenith sky at the zenith without the Moon", () => {
    const sky = skyBrightnessNL({ ...BASE, objectAltitudeDeg: 90, moonAltitudeDeg: -10 });
    expect(nlToMag(sky.darkNL)).toBeCloseTo(BASE.darkZenithMag, 10);
    expect(sky.moonNL).toBe(0);
  });

  it("brightens the moonless sky towards the horizon", () => {
    const high = skyBrightnessNL({ ...BASE, objectAltitudeDeg: 80 }).darkNL;
    const low = skyBrightnessNL({ ...BASE, objectAltitudeDeg: 20 }).darkNL;
    expect(low).toBeGreaterThan(high);
  });

  it("adds nothing when the Moon or the object is below the horizon", () => {
    expect(brightening({ moonAltitudeDeg: -0.5 })).toBe(0);
    expect(brightening({ objectAltitudeDeg: -1 })).toBe(0);
  });

  it("falls monotonically with separation within 10° and from 10° to 90°", () => {
    // K&S is piecewise at 10° and its Rayleigh term rises again past 90°; each stretch is monotonic.
    for (const separations of [
      [0.5, 1, 2, 5, 9.9],
      [10, 20, 45, 70, 90],
    ]) {
      const values = separations.map((separationDeg) => brightening({ separationDeg }));
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThan(values[i - 1]);
      }
    }
    expect(brightening({ separationDeg: 2 })).toBeGreaterThan(brightening({ separationDeg: 45 }));
  });

  it("falls monotonically with phase angle (full → new)", () => {
    const angles = [0, 6.9, 7, 30, 60, 90, 120, 150, 179];
    const values = angles.map((moonPhaseAngleDeg) => brightening({ moonPhaseAngleDeg }));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
  });

  it("stays finite at the Moon's centre", () => {
    expect(Number.isFinite(brightening({ separationDeg: 0 }))).toBe(true);
  });

  it("makes a full Moon 45° away a large brightening of a dark sky, and a thin crescent a small one", () => {
    expect(brightening({ moonPhaseAngleDeg: 0 })).toBeGreaterThan(2);
    expect(brightening({ moonPhaseAngleDeg: 150 })).toBeLessThan(0.5);
  });
});

describe("effectiveSurfaceBrightness", () => {
  it("spreads the magnitude over the ellipse and brightens it by the core offset", () => {
    const round = effectiveSurfaceBrightness({ vMag: 10, majorAxisArcmin: 10, minorAxisArcmin: 10 });
    expect(round).toBeCloseTo(10 + 2.5 * Math.log10((Math.PI / 4) * 100 * 3600) - BRIGHT_CORE_OFFSET_MAG, 10);
  });

  it("takes a missing minor axis as round, and returns null without a size", () => {
    expect(effectiveSurfaceBrightness({ vMag: 10, majorAxisArcmin: 10, minorAxisArcmin: null })).toBe(
      effectiveSurfaceBrightness({ vMag: 10, majorAxisArcmin: 10, minorAxisArcmin: 10 }),
    );
    expect(effectiveSurfaceBrightness({ vMag: 10, majorAxisArcmin: null, minorAxisArcmin: null })).toBeNull();
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
