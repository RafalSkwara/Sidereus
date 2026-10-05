import { describe, expect, it } from "vitest";

import meta from "./bright-stars.meta.json";
import { BRIGHT_STARS, BRIGHT_STAR_COUNT_RANGE, BRIGHT_STAR_MAX_MAG } from "./stars";
import { STAR_NAMES, starName } from "./star-names";

const PINNED_SHA = "c7f7f883fe678cc7680169a50ccd7dcc49b060ce";

describe("bright-star catalogue", () => {
  it("holds the naked-eye stars, brightest first, as J2000 unit vectors", () => {
    expect(BRIGHT_STARS.length).toBeGreaterThanOrEqual(BRIGHT_STAR_COUNT_RANGE.min);
    expect(BRIGHT_STARS.length).toBeLessThanOrEqual(BRIGHT_STAR_COUNT_RANGE.max);
    BRIGHT_STARS.forEach((s, i) => {
      expect(s.mag).toBeLessThanOrEqual(BRIGHT_STAR_MAX_MAG);
      expect(Math.abs(Math.hypot(...s.vector) - 1)).toBeLessThanOrEqual(1e-4);
      if (i > 0) {
        const prev = BRIGHT_STARS[i - 1];
        expect(prev.mag < s.mag || (prev.mag === s.mag && prev.id < s.id)).toBe(true);
      }
    });
  });

  it("records the pinned HYG commit and licence", () => {
    expect(meta.commit).toBe(PINNED_SHA);
    expect(meta.licence).toBe("CC BY-SA 4.0");
    expect(meta.count).toBe(BRIGHT_STARS.length);
  });

  it("names the 40 brightest named stars plus Polaris, each with a Polish form", () => {
    const named = BRIGHT_STARS.flatMap((s) => (s.name === undefined ? [] : [s.name]));
    expect(named).toHaveLength(41);
    expect(named).toContain("Polaris");
    expect(meta.namedCount).toBe(41);
    for (const name of named) {
      // Identical-in-Polish names map to themselves, so a missing entry is always a mistake.
      expect(STAR_NAMES.pl[name], name).toBeDefined();
    }
    expect(starName("Vega", "pl")).toBe("Wega");
    expect(starName("Vega", "en")).toBe("Vega");
    expect(starName("Unlisted", "pl")).toBe("Unlisted");
  });
});
