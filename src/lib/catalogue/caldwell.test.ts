import { describe, expect, it } from "vitest";

import rawMeta from "./caldwell.meta.json";
import { CALDWELL_META } from "./index";

const PINNED_SHA = "da90466031b0372c896588b85be6016c617e205b";

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
});
