import { describe, expect, it } from "vitest";

import rawMeta from "./caldwell.meta.json";
import { CALDWELL, CALDWELL_META } from "./index";
import { vMagColourProblems, type VMagColourExpectation } from "./vmag-colour-pins";

const PINNED_SHA = "da90466031b0372c896588b85be6016c617e205b";

/** The six Caldwell galaxies whose V is derived from B (the rule's record is the meta's `vMagColour` entries). */
const EXPECTED_COLOUR: VMagColourExpectation = {
  ids: ["IC342", "NGC4449", "NGC5005", "NGC4565", "NGC6822", "NGC4039"],
  bDoubt: ["NGC4449", "NGC4565"],
  thinMedian: ["NGC4449", "NGC6822", "NGC4039"],
};

describe("Caldwell catalogue", () => {
  it("records the pinned OpenNGC commit and licence, and an https source for every hand-entered override", () => {
    expect(CALDWELL_META.commit).toBe(PINNED_SHA);
    expect(CALDWELL_META.licence).toBe("CC BY-SA 4.0");
    // Provenance, not shape: a hand-entered override with no published source would be unattributable data.
    const overrides = (rawMeta as { overrides: { source?: unknown }[] }).overrides;
    expect(overrides.length, "an empty list would pass vacuously").toBeGreaterThan(0);
    for (const o of overrides) {
      expect(typeof o.source === "string" && o.source.startsWith("https://"), JSON.stringify(o)).toBe(true);
    }
  });

  it("records every derived galaxy V as a vMagColour override that matches the data, with the doubts named", () => {
    expect(CALDWELL, "the catalogue's objects").toHaveLength(61);
    const overrides = (rawMeta as { overrides: unknown[] }).overrides;
    expect(vMagColourProblems(overrides, CALDWELL, EXPECTED_COLOUR)).toEqual([]);
  });
});
