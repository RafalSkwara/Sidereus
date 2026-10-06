import { describe, expect, it } from "vitest";

import rawMeta from "./caldwell.meta.json";
import { CALDWELL, CALDWELL_META, DEEP_SKY, MESSIER, findDeepSky } from "./index";

const PINNED_SHA = "da90466031b0372c896588b85be6016c617e205b";

describe("Caldwell catalogue", () => {
  it("has the 61 reachable objects, sorted by Caldwell number, with space-free ids", () => {
    expect(CALDWELL).toHaveLength(61);
    const numbers = CALDWELL.map((o) => o.caldwell);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(61);
    for (const o of CALDWELL) {
      expect(o.id).toMatch(/^(NGC|IC)[1-9][0-9]{0,3}$/);
      expect(o.messier).toBeNull();
      expect(Number.isFinite(o.vMag)).toBe(true);
    }
  });

  it("keeps only objects a 52 N observer can lift above 15 degrees (dec >= -23)", () => {
    for (const o of CALDWELL) {
      expect(o.decDeg).toBeGreaterThanOrEqual(-23);
    }
  });

  it("merges the Double Cluster into one NGC869 entry", () => {
    const c14 = CALDWELL.find((o) => o.caldwell === 14);
    expect(c14?.id).toBe("NGC869");
    expect(c14?.label).toBe("NGC 869 / 884");
    expect(c14?.designation).toBe("NGC 869 / 884");
    expect(c14?.commonName).toBe("Double Cluster");
    expect(c14?.vMag).toBe(3.7);
    expect(c14?.surfaceBrightness).toBeNull();
    expect(CALDWELL.some((o) => o.id === "NGC884")).toBe(false);
  });

  it("labels the Rosette objects as observing guides do, not by OpenNGC's duplicate rows", () => {
    const byNumber = (n: number) => CALDWELL.find((o) => o.caldwell === n);
    expect(byNumber(49)).toMatchObject({ id: "NGC2237", label: "NGC 2237", commonName: "Rosette Nebula" });
    expect(byNumber(50)).toMatchObject({ id: "NGC2244", label: "NGC 2244" });
  });

  it("reads Caldwell numbers past a quoted ';' (NGC 7331 is C 30)", () => {
    const c30 = CALDWELL.find((o) => o.caldwell === 30);
    expect(c30?.id).toBe("NGC7331");
    expect(c30?.vMag).toBe(9.41);
    expect(c30?.constellation).toBe("Peg");
  });

  it("labels Caldwell objects by designation and Messier objects by id", () => {
    expect(findDeepSky("NGC7000")?.label).toBe("NGC 7000");
    expect(findDeepSky("M31")?.label).toBe("M31");
    expect(findDeepSky("NGC7000")?.caldwell).toBe(20);
    expect(DEEP_SKY).toHaveLength(MESSIER.length + CALDWELL.length);
  });

  it("shares no id or designation with the Messier objects", () => {
    const messierIds = new Set<string>(MESSIER.map((o) => o.id));
    const messierDesignations = new Set(MESSIER.map((o) => o.designation.replace(/\s+/g, "")));
    for (const o of CALDWELL) {
      expect(messierIds.has(o.id)).toBe(false);
      expect(messierDesignations.has(o.id)).toBe(false);
    }
    expect(new Set(DEEP_SKY.map((o) => o.id)).size).toBe(DEEP_SKY.length);
  });

  it("records the pinned OpenNGC commit, licence and selection rule", () => {
    expect(CALDWELL_META.commit).toBe(PINNED_SHA);
    expect(CALDWELL_META.licence).toBe("CC BY-SA 4.0");
    expect(CALDWELL_META.count).toBe(61);
    expect(typeof (rawMeta as { selection?: unknown }).selection).toBe("string");
  });

  it("gives every override an https source", () => {
    const overrides = (rawMeta as { overrides: { source?: unknown }[] }).overrides;
    expect(overrides.length).toBeGreaterThan(0);
    for (const o of overrides) {
      expect(typeof o.source === "string" && o.source.startsWith("https://")).toBe(true);
    }
  });
});
