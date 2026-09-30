import { describe, expect, it } from "vitest";

import { CATALOGUE_META, MESSIER, MESSIER_TYPES, findMessier } from "./index";

const PINNED_SHA = "da90466031b0372c896588b85be6016c617e205b";

describe("Messier catalogue", () => {
  it("numbers M1..M110 once each, with well-formed coordinates, magnitudes and types", () => {
    expect(MESSIER.map((o) => o.messier)).toEqual(Array.from({ length: 110 }, (_, i) => i + 1));
    const known: readonly string[] = MESSIER_TYPES;
    for (const o of MESSIER) {
      expect(o.id).toBe(`M${o.messier}`);
      expect(o.raHours >= 0 && o.raHours < 24 && o.decDeg >= -90 && o.decDeg <= 90).toBe(true);
      expect(Number.isFinite(o.vMag)).toBe(true);
      expect(known).toContain(o.type);
    }
  });

  it("lists NGC 5866 as M102 (override of OpenNGC's duplicate-of-M101)", () => {
    const m102 = findMessier(102);
    expect(m102?.designation).toBe("NGC 5866");
    expect(m102?.type).toBe("galaxy");
    expect(m102?.constellation).toBe("Dra");
  });

  it("records the pinned OpenNGC commit and licence", () => {
    expect(CATALOGUE_META.commit).toBe(PINNED_SHA);
    expect(CATALOGUE_META.licence).toBe("CC BY-SA 4.0");
    expect(CATALOGUE_META.count).toBe(110);
  });
});
