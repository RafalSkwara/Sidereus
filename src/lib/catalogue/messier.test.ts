import { describe, expect, it } from "vitest";

import { CATALOGUE_META, MESSIER, MESSIER_TYPES, findMessier } from "./index";

const PINNED_SHA = "da90466031b0372c896588b85be6016c617e205b";

describe("Messier catalogue", () => {
  it("has exactly 110 objects", () => {
    expect(MESSIER).toHaveLength(110);
  });

  it("numbers M1..M110 once each, in order, with matching ids", () => {
    const numbers = MESSIER.map((o) => o.messier);
    expect(numbers).toEqual(Array.from({ length: 110 }, (_, i) => i + 1));
    for (const o of MESSIER) {
      expect(o.id).toBe(`M${o.messier}`);
    }
  });

  it("lists NGC 5866 as M102 (override of OpenNGC's duplicate-of-M101)", () => {
    const m102 = findMessier(102);
    expect(m102?.designation).toBe("NGC 5866");
    expect(m102?.type).toBe("galaxy");
    expect(m102?.constellation).toBe("Dra");
  });

  it("lists the Pleiades as M45 / Mel 22", () => {
    const m45 = findMessier(45);
    expect(m45?.designation).toBe("Mel 22");
    expect(m45?.commonName).toBe("Pleiades");
    expect(m45?.type).toBe("open-cluster");
  });

  it("keeps every coordinate in range", () => {
    for (const o of MESSIER) {
      expect(o.raHours).toBeGreaterThanOrEqual(0);
      expect(o.raHours).toBeLessThan(24);
      expect(o.decDeg).toBeGreaterThanOrEqual(-90);
      expect(o.decDeg).toBeLessThanOrEqual(90);
    }
  });

  it("has a numeric V magnitude for every object", () => {
    for (const o of MESSIER) {
      expect(Number.isFinite(o.vMag)).toBe(true);
    }
  });

  it("uses only known types", () => {
    const known: readonly string[] = MESSIER_TYPES;
    for (const o of MESSIER) {
      expect(known).toContain(o.type);
    }
  });

  it("normalises Serpens to a single IAU code", () => {
    const codes = new Set(MESSIER.map((o) => o.constellation));
    expect(codes.has("Se1")).toBe(false);
    expect(codes.has("Se2")).toBe(false);
    expect(codes.has("Ser")).toBe(true);
  });

  it("matches OpenNGC spot values for M31", () => {
    const m31 = findMessier(31);
    expect(m31?.designation).toBe("NGC 224");
    expect(m31?.commonName).toBe("Andromeda Galaxy");
    expect(m31?.raHours).toBeCloseTo(0.7123, 3);
    expect(m31?.decDeg).toBeCloseTo(41.269, 2);
    expect(m31?.surfaceBrightness).toBe(23.63);
  });

  it("keeps sizes null where OpenNGC has none", () => {
    expect(findMessier(40)?.majorAxisArcmin).toBeNull();
    expect(findMessier(73)?.majorAxisArcmin).toBeNull();
  });

  it("records the pinned OpenNGC commit and licence", () => {
    expect(CATALOGUE_META.commit).toBe(PINNED_SHA);
    expect(CATALOGUE_META.licence).toBe("CC BY-SA 4.0");
    expect(CATALOGUE_META.count).toBe(110);
  });

  it("returns undefined for numbers outside the catalogue", () => {
    expect(findMessier(0)).toBeUndefined();
    expect(findMessier(111)).toBeUndefined();
  });
});
