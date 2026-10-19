import { describe, expect, it } from "vitest";

import { CATALOGUE_META, MESSIER } from "./index";
import rawMeta from "./messier.meta.json";
import { vMagColourProblems, type VMagColourExpectation } from "./vmag-colour-pins";

const PINNED_SHA = "da90466031b0372c896588b85be6016c617e205b";

/** The six Messier galaxies whose V is derived from B (the rule's record is the meta's `vMagColour` entries). */
const EXPECTED_COLOUR: VMagColourExpectation = {
  ids: ["M58", "M61", "M88", "M91", "M98", "M106"],
  bDoubt: [],
  thinMedian: [],
};

const overridesOf = (meta: unknown) => (meta as { overrides: unknown[] }).overrides;

describe("Messier catalogue", () => {
  it("records the pinned OpenNGC commit and licence", () => {
    expect(CATALOGUE_META.commit).toBe(PINNED_SHA);
    expect(CATALOGUE_META.licence).toBe("CC BY-SA 4.0");
  });

  it("records every derived galaxy V as a vMagColour override that matches the data", () => {
    expect(MESSIER, "the catalogue's objects").toHaveLength(110);
    expect(vMagColourProblems(overridesOf(rawMeta), MESSIER, EXPECTED_COLOUR)).toEqual([]);
  });

  // Deliberate-break proof on in-memory copies: the pin names each planted fault, and the generated JSON is untouched.
  it("names each planted fault on a doctored copy of the meta", () => {
    const entries = overridesOf(rawMeta).filter((o) => (o as { action?: string }).action === "vMagColour");
    expect(entries, "the real entries to doctor").toHaveLength(EXPECTED_COLOUR.ids.length);
    const doctor = (change: (entry: Record<string, unknown>, index: number) => Record<string, unknown> | null) =>
      entries.flatMap((entry, index) => {
        const next = change({ ...(entry as Record<string, unknown>) }, index);
        return next === null ? [] : [next];
      });
    const problems = (overrides: unknown[]) => vMagColourProblems(overrides, MESSIER, EXPECTED_COLOUR);

    const differentV = problems(doctor((entry, i) => ({ ...entry, vMag: i === 2 ? 9.99 : entry.vMag })));
    expect(differentV).toEqual(["M88: meta vMag 9.99 differs from the data's 9.43"]);

    const missing = problems(doctor((entry, i) => (i === 5 ? null : entry)));
    expect(missing).toEqual(["M106: missing vMagColour entry"]);

    const extra = problems([...doctor((entry) => entry), { ...(entries[0] as object), id: "M1" }]);
    expect(extra).toContain("M1: unexpected vMagColour entry");

    const insecure = problems(
      doctor((entry, i) => ({ ...entry, source: i === 0 ? "http://example.org/NGC.csv" : entry.source })),
    );
    expect(insecure).toEqual(["M58: source is not an https URL"]);

    const noDoubt = vMagColourProblems(
      doctor((entry) => ({ ...entry, reason: "short" })),
      MESSIER,
      {
        ...EXPECTED_COLOUR,
        bDoubt: ["M58"],
        thinMedian: ["M61"],
      },
    );
    expect(noDoubt).toEqual([
      'M58: reason does not say "B-Mag may itself be too bright"',
      'M61: reason does not say "median of 3 galaxies"',
    ]);
  });
});
