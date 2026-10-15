import { describe, expect, it } from "vitest";

import { DEEP_SKY, findDeepSky } from "@/lib/catalogue";
import type { DeepSkyObject } from "@/lib/catalogue";

import { contrastBand, contrastDeficit, coreSurfaceBrightness, telescopeLimitingMag } from "./contrast";
import { effectiveSurfaceBrightness } from "./moonlight";
import { BULGE_HUBBLE_TYPES, EXPECT_BULGE_CORE_EXTRA_MAG } from "./parameters";
import { telescopeLimitingMag as scoreTelescopeLimitingMag } from "./score";

/**
 * The shared core and contrast measure (small-scope-galaxies Phase 2): a bulge-type spiral's core is
 * `EXPECT_BULGE_CORE_EXTRA_MAG` brighter than the flat core, and nothing else changes.
 */

/**
 * The OpenNGC `Hubble` values of the catalogue's galaxies that are NOT in `BULGE_HUBBLE_TYPES`: discs, ellipticals,
 * irregulars and the one unclassified (`S?`). An unknown value after a catalogue pin bump fails the coverage test
 * below, so the new type is put in one list or the other on purpose.
 */
const DISC_OR_OTHER_HUBBLE_TYPES: readonly string[] = [
  "E",
  "Sbc",
  "Sc",
  "SABc",
  "SBbc",
  "SBcd",
  "SBd",
  "SBm",
  "IB",
  "I",
  "S?",
];

function catalogued(id: string): DeepSkyObject {
  const found = findDeepSky(id);
  if (found === undefined) {
    throw new Error(`contrast.test: ${id} is not in the catalogue`);
  }
  return found;
}

const GALAXIES = DEEP_SKY.filter((o) => o.type === "galaxy");

describe("coreSurfaceBrightness: the bulge term", () => {
  it("is exactly EXPECT_BULGE_CORE_EXTRA_MAG brighter than the flat core for every bulge-type galaxy", () => {
    const bulge = GALAXIES.filter((o) => o.hubble !== null && BULGE_HUBBLE_TYPES.includes(o.hubble));
    expect(bulge.length).toBeGreaterThan(0);
    for (const o of bulge) {
      const flat = effectiveSurfaceBrightness(o);
      const core = coreSurfaceBrightness(o);
      expect(flat, o.id).not.toBeNull();
      expect((flat ?? 0) - (core ?? 0), `${o.id} (${o.hubble})`).toBeCloseTo(EXPECT_BULGE_CORE_EXTRA_MAG, 10);
    }
    // The class reaches the spirals the references name: M31 (Sb), M81 (Sab), M51 (SABb).
    for (const id of ["M31", "M81", "M51"]) {
      expect(bulge.map((o) => o.id)).toContain(id);
    }
  });

  it("equals the flat core for a disc-type galaxy and for an elliptical", () => {
    for (const id of ["M33", "M101", "NGC2403"]) {
      const o = catalogued(id);
      expect(coreSurfaceBrightness(o), id).toBe(effectiveSurfaceBrightness(o));
    }
    const ellipticals = GALAXIES.filter((o) => o.hubble === "E");
    expect(ellipticals.length).toBeGreaterThan(0);
    for (const o of ellipticals) {
      expect(coreSurfaceBrightness(o), o.id).toBe(effectiveSurfaceBrightness(o));
    }
  });

  it("equals the flat core for every non-galaxy, even one that carries a bulge-type Hubble string", () => {
    for (const o of DEEP_SKY.filter((x) => x.type !== "galaxy")) {
      expect(coreSurfaceBrightness(o), o.id).toBe(effectiveSurfaceBrightness(o));
    }
    const odd = { type: "nebula", vMag: 8, majorAxisArcmin: 5, minorAxisArcmin: null, hubble: "Sb" } as const;
    expect(coreSurfaceBrightness(odd)).toBe(effectiveSurfaceBrightness(odd));
  });

  it("is null without a size, bulge-type or not", () => {
    const noSize = { type: "galaxy", vMag: 8, majorAxisArcmin: null, minorAxisArcmin: null, hubble: "Sb" } as const;
    expect(coreSurfaceBrightness(noSize)).toBeNull();
    expect(contrastDeficit(noSize, 4, 150)).toBeNull();
  });

  it("lowers the deficit by the same amount at every Bortle class and aperture", () => {
    const m31 = catalogued("M31");
    const disc = { ...m31, hubble: "Sc" };
    for (const bortle of [1, 4, 6, 9]) {
      for (const aperture of [60, 150, 300]) {
        const bulgeDeficit = contrastDeficit(m31, bortle, aperture) ?? Number.NaN;
        const discDeficit = contrastDeficit(disc, bortle, aperture) ?? Number.NaN;
        expect(discDeficit - bulgeDeficit, `B${bortle} ${aperture} mm`).toBeCloseTo(EXPECT_BULGE_CORE_EXTRA_MAG, 10);
      }
    }
  });
});

describe("contrast.ts: the shared definitions", () => {
  it("has one telescopeLimitingMag, re-exported by score.ts", () => {
    expect(scoreTelescopeLimitingMag).toBe(telescopeLimitingMag);
  });

  it("reads the M31 60 mm references through the band", () => {
    const m31 = catalogued("M31");
    expect(contrastBand(m31, 6, 60)).toBe("smudge");
    expect(contrastBand(m31, 8, 60)).toBe("faint");
    expect(contrastBand(m31, 4, 150)).toBe("bright");
  });
});

describe("Hubble coverage", () => {
  it("puts every catalogue galaxy's Hubble type in the bulge list or the explicit disc-or-other list", () => {
    expect(GALAXIES).toHaveLength(68);
    for (const o of GALAXIES) {
      const known =
        o.hubble !== null && (BULGE_HUBBLE_TYPES.includes(o.hubble) || DISC_OR_OTHER_HUBBLE_TYPES.includes(o.hubble));
      expect(known, `${o.id}: hubble ${String(o.hubble)} is in neither list`).toBe(true);
    }
  });

  it("keeps the two lists apart", () => {
    for (const type of DISC_OR_OTHER_HUBBLE_TYPES) {
      expect(BULGE_HUBBLE_TYPES, type).not.toContain(type);
    }
  });
});
