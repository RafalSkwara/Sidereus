import { describe, expect, it } from "vitest";

import { DEEP_SKY, findDeepSky } from "@/lib/catalogue";

import { contrastBand } from "./contrast";
import type { ContrastBand } from "./contrast";
import { EXPECTATION_KEYS, expectationFor } from "./expectation";
import type { ExpectationKey } from "./expectation";
import { EXPECT_REFERENCES, KNOWN_DIVERGENCES } from "./fixtures/expect-reference";
import { BULGE_HUBBLE_TYPES } from "./parameters";

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

function catalogued(id: string): NonNullable<ReturnType<typeof findDeepSky>> {
  const found = findDeepSky(id);
  if (found === undefined) {
    throw new Error(`expectation.test: ${id} is not in the catalogue`);
  }
  return found;
}

describe("expectationFor: the invariants (D-3)", () => {
  it("is total and deterministic over every catalogue object, Bortle class and aperture, and reaches every key", () => {
    // Non-vacuity: the whole catalogue over the full grid, so a short sample can never pass.
    expect(DEEP_SKY.length).toBeGreaterThanOrEqual(150);
    const reached = new Set<ExpectationKey>();
    let cases = 0;
    for (const o of DEEP_SKY) {
      for (const bortle of BORTLES) {
        for (const aperture of APERTURES) {
          const key = expectationFor(o, bortle, aperture);
          expect(EXPECTATION_KEYS, `${o.id} B${bortle} ${aperture} mm`).toContain(key);
          expect(expectationFor(o, bortle, aperture), `${o.id} B${bortle} ${aperture} mm: second call`).toBe(key);
          reached.add(key);
          cases += 1;
        }
      }
    }
    expect(cases).toBe(DEEP_SKY.length * BORTLES.length * APERTURES.length);
    const unreachable = EXPECTATION_KEYS.filter((key) => !reached.has(key));
    expect(unreachable).toEqual([]);
  });

  it("never brightens the band at a worse sky, and never fades it at a bigger aperture, for every object", () => {
    expect(DEEP_SKY.length).toBeGreaterThanOrEqual(150);
    let steps = 0;
    for (const o of DEEP_SKY) {
      for (const aperture of APERTURES) {
        let previous = -1;
        for (const bortle of BORTLES) {
          const rank = BAND_RANK[contrastBand(o, bortle, aperture)];
          expect(rank, `${o.id} ${aperture} mm, Bortle ${bortle}`).toBeGreaterThanOrEqual(previous);
          previous = rank;
          steps += 1;
        }
      }
      for (const bortle of BORTLES) {
        let previous = Number.POSITIVE_INFINITY;
        for (const aperture of APERTURES) {
          const rank = BAND_RANK[contrastBand(o, bortle, aperture)];
          expect(rank, `${o.id} Bortle ${bortle}, ${aperture} mm`).toBeLessThanOrEqual(previous);
          previous = rank;
          steps += 1;
        }
      }
    }
    expect(steps).toBe(DEEP_SKY.length * APERTURES.length * BORTLES.length * 2);
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
    ["M31", 5, 60],
    ["M31", 6, 60],
    ["M31", 8, 60],
    ["M33", 4, 80],
    ["M81", 5, 80],
    ["M101", 3, 80],
    ["M101", 6, 80],
    ["M33", 6, 80],
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

describe("Hubble coverage", () => {
  it("puts every catalogue galaxy's Hubble type in the bulge list or the explicit disc-or-other list, and keeps them apart", () => {
    const galaxies = DEEP_SKY.filter((o) => o.type === "galaxy");
    expect(galaxies).toHaveLength(68);
    for (const o of galaxies) {
      const known =
        o.hubble !== null && (BULGE_HUBBLE_TYPES.includes(o.hubble) || DISC_OR_OTHER_HUBBLE_TYPES.includes(o.hubble));
      expect(known, `${o.id}: hubble ${String(o.hubble)} is in neither list`).toBe(true);
    }
    for (const type of DISC_OR_OTHER_HUBBLE_TYPES) {
      expect(BULGE_HUBBLE_TYPES, type).not.toContain(type);
    }
  });
});
