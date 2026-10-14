import { describe, expect, it } from "vitest";

import { DEEP_SKY, findDeepSky } from "@/lib/catalogue";

import { EXPECTATION_KEYS, contrastBand, expectationFor } from "./expectation";
import type { ContrastBand, ExpectationKey, ExpectationObject } from "./expectation";
import { EXPECT_REFERENCES, KNOWN_DIVERGENCES } from "./fixtures/expect-reference";
import { EXPECT_STARLIKE_ARCMIN, EXPECT_WIDE_ARCMIN } from "./parameters";
import { telescopeLimitingMag } from "./score";

/**
 * The "what to expect" rule (M-3 S-04, what-to-expect D-2, D-3, D-6): which of 22 phrase keys an object takes from
 * its type, size and brightness, the telescope's aperture and the site's Bortle class.
 */

const BORTLES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const APERTURES = [20, 60, 80, 100, 130, 150, 200, 300, 1000];

const BAND_RANK: Record<ContrastBand, number> = { bright: 0, smudge: 1, faint: 2, limit: 3 };
const GLOBULAR_RANK: Partial<Record<ExpectationKey, number>> = {
  globularGlow: 0,
  globularGrainy: 1,
  globularResolved: 2,
};

function object(over: Partial<ExpectationObject> & Pick<ExpectationObject, "type">): ExpectationObject {
  return { vMag: 8, majorAxisArcmin: 5, minorAxisArcmin: null, ...over };
}

function catalogued(id: string): NonNullable<ReturnType<typeof findDeepSky>> {
  const found = findDeepSky(id);
  if (found === undefined) {
    throw new Error(`expectation.test: ${id} is not in the catalogue`);
  }
  return found;
}

describe("expectationFor: the invariants (D-3)", () => {
  it("has 22 distinct keys", () => {
    expect(EXPECTATION_KEYS).toHaveLength(22);
    expect(new Set(EXPECTATION_KEYS).size).toBe(22);
  });

  it("is total and deterministic over every catalogue object, Bortle class and aperture", () => {
    for (const o of DEEP_SKY) {
      for (const bortle of BORTLES) {
        for (const aperture of APERTURES) {
          const key = expectationFor(o, bortle, aperture);
          expect(EXPECTATION_KEYS, `${o.id} B${bortle} ${aperture} mm`).toContain(key);
          expect(expectationFor(o, bortle, aperture)).toBe(key);
        }
      }
    }
  });

  it("never brightens the band at a worse sky, for every object", () => {
    for (const o of DEEP_SKY) {
      for (const aperture of APERTURES) {
        let previous = -1;
        for (const bortle of BORTLES) {
          const rank = BAND_RANK[contrastBand(o, bortle, aperture)];
          expect(rank, `${o.id} ${aperture} mm, Bortle ${bortle}`).toBeGreaterThanOrEqual(previous);
          previous = rank;
        }
      }
    }
  });

  it("never fades the band at a bigger aperture, for every object", () => {
    for (const o of DEEP_SKY) {
      for (const bortle of BORTLES) {
        let previous = Number.POSITIVE_INFINITY;
        for (const aperture of APERTURES) {
          const rank = BAND_RANK[contrastBand(o, bortle, aperture)];
          expect(rank, `${o.id} Bortle ${bortle}, ${aperture} mm`).toBeLessThanOrEqual(previous);
          previous = rank;
        }
      }
    }
  });

  it("never regresses a globular cluster's resolution as the aperture grows", () => {
    const globulars = DEEP_SKY.filter((o) => o.type === "globular-cluster");
    expect(globulars.length).toBeGreaterThan(0);
    for (const o of globulars) {
      for (const bortle of BORTLES) {
        let previous = -1;
        for (const aperture of APERTURES) {
          const rank = GLOBULAR_RANK[expectationFor(o, bortle, aperture)];
          expect(rank, `${o.id} Bortle ${bortle}, ${aperture} mm is a globular key`).toBeDefined();
          expect(rank ?? -1, `${o.id} Bortle ${bortle}, ${aperture} mm`).toBeGreaterThanOrEqual(previous);
          previous = rank ?? -1;
        }
      }
    }
  });

  it("reaches every key through some catalogue object at some setting", () => {
    const reached = new Set<ExpectationKey>();
    for (const o of DEEP_SKY) {
      for (const bortle of BORTLES) {
        for (const aperture of APERTURES) {
          reached.add(expectationFor(o, bortle, aperture));
        }
      }
    }
    const unreachable = EXPECTATION_KEYS.filter((key) => !reached.has(key));
    expect(unreachable).toEqual([]);
  });
});

describe("expectationFor: the table's boundaries", () => {
  it("calls a planetary nebula under the star-like size star-like, and one at it a disc or fainter", () => {
    const small = object({ type: "planetary-nebula", vMag: 9, majorAxisArcmin: EXPECT_STARLIKE_ARCMIN - 0.01 });
    const sized = object({ type: "planetary-nebula", vMag: 9, majorAxisArcmin: EXPECT_STARLIKE_ARCMIN });
    expect(expectationFor(small, 4, 150)).toBe("planetaryStarLike");
    expect(expectationFor(sized, 4, 150)).not.toBe("planetaryStarLike");
  });

  it("calls an open cluster of 60 arcminutes wide, and one just under it not wide", () => {
    const wide = object({ type: "open-cluster", vMag: 2, majorAxisArcmin: EXPECT_WIDE_ARCMIN });
    const narrower = object({ type: "open-cluster", vMag: 2, majorAxisArcmin: EXPECT_WIDE_ARCMIN - 1 });
    expect(expectationFor(wide, 4, 150)).toBe("openClusterWide");
    expect(expectationFor(narrower, 4, 150)).not.toBe("openClusterWide");
  });

  it("applies the near-limit floor: a compact object at the telescope's limit is at least faint", () => {
    const limit = telescopeLimitingMag(4, 150);
    const nearLimit = object({ type: "planetary-nebula", vMag: limit - 0.5, majorAxisArcmin: 0.1 });
    const clear = object({ type: "planetary-nebula", vMag: limit - 4, majorAxisArcmin: 0.1 });
    expect(contrastBand(clear, 4, 150)).toBe("bright");
    expect(contrastBand(nearLimit, 4, 150)).toBe("faint");
  });

  it("gives the objects without a major axis their fixed keys", () => {
    const m40 = catalogued("M40");
    const m73 = catalogued("M73");
    expect(m40.majorAxisArcmin).toBeNull();
    expect(m73.majorAxisArcmin).toBeNull();
    for (const bortle of BORTLES) {
      for (const aperture of APERTURES) {
        expect(expectationFor(m40, bortle, aperture)).toBe("doubleStar");
        expect(expectationFor(m73, bortle, aperture)).toBe("other");
      }
    }
  });

  it("takes the asterism key for an asterism", () => {
    expect(expectationFor(object({ type: "asterism", majorAxisArcmin: 30 }), 4, 150)).toBe("asterism");
  });
});

describe("expectationFor: the reference fixture (D-6)", () => {
  const SHOWCASE: [string, number][] = [
    ["M13", 4],
    ["M3", 4],
    ["M57", 4],
    ["M27", 4],
    ["NGC7662", 4],
    ["M31", 4],
    ["M33", 4],
    ["M33", 7],
    ["M51", 4],
    ["M81", 4],
    ["M101", 4],
    ["M101", 7],
    ["M42", 4],
    ["M45", 4],
    ["M11", 4],
  ];
  const HARD: [string, number, number][] = [
    ["M42", 7, 150],
    ["M56", 4, 200],
    ["NGC7293", 4, 150],
    ["M97", 4, 150],
    ["NGC7000", 4, 150],
    ["NGC4889", 4, 150],
    ["M33", 9, 150],
  ];
  const ALL = [...EXPECT_REFERENCES, ...KNOWN_DIVERGENCES];

  it("holds every showcase and hard-case entry of the plan, at the plan's settings", () => {
    for (const [id, bortle] of SHOWCASE) {
      expect(
        ALL.some((e) => e.kind === "showcase" && e.id === id && e.bortle === bortle && e.apertureMm === 150),
        `showcase ${id} at Bortle ${bortle}`,
      ).toBe(true);
    }
    for (const [id, bortle, aperture] of HARD) {
      expect(
        ALL.some((e) => e.kind === "hard" && e.id === id && e.bortle === bortle && e.apertureMm === aperture),
        `hard case ${id} at Bortle ${bortle}, ${aperture} mm`,
      ).toBe(true);
    }
    expect(ALL).toHaveLength(SHOWCASE.length + HARD.length);
  });

  it("cites at least two dated, https sources for every entry", () => {
    for (const entry of ALL) {
      const label = `${entry.id} B${entry.bortle} ${entry.apertureMm} mm`;
      expect(entry.sources.length, label).toBeGreaterThanOrEqual(2);
      expect(new Set(entry.sources.map((s) => s.url)).size, `${label}: distinct sources`).toBe(entry.sources.length);
      for (const s of entry.sources) {
        expect(s.title, label).not.toBe("");
        expect(s.publisher, label).not.toBe("");
        expect(s.url, label).toMatch(/^https:\/\//);
        expect(s.accessed, label).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      expect(entry.note, label).not.toBe("");
    }
  });

  it("computes the published key for every reference", () => {
    for (const entry of EXPECT_REFERENCES) {
      const computed = expectationFor(catalogued(entry.id), entry.bortle, entry.apertureMm);
      expect(computed, `${entry.id} Bortle ${entry.bortle}, ${entry.apertureMm} mm`).toBe(entry.expected);
    }
  });

  it("lists each known divergence with the key the rule computes, which differs from the published one", () => {
    expect(KNOWN_DIVERGENCES.length).toBeLessThanOrEqual(3);
    for (const entry of KNOWN_DIVERGENCES) {
      const computed = expectationFor(catalogued(entry.id), entry.bortle, entry.apertureMm);
      expect(computed, `${entry.id}: computed key`).toBe(entry.computed);
      expect(entry.computed, `${entry.id}: still diverges`).not.toBe(entry.expected);
      expect(entry.reason, entry.id).not.toBe("");
    }
  });
});
