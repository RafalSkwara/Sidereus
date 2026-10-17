import { describe, expect, it } from "vitest";
import { CALDWELL } from "@/lib/catalogue";
import { targetOptions } from "./target-options";
import { filterTargets } from "./target-search";

/** The options as the Polish log page builds them. */
const OPTIONS = targetOptions("pl");

const keys = (query: string, options = OPTIONS) => filterTargets(options, query).map((o) => o.key);

describe("targetOptions", () => {
  it("lists the Messier objects, the Moon, the planets in solar order, then the Caldwell objects by C number", () => {
    const all = OPTIONS.map((o) => o.key);
    expect(all).toHaveLength(179);
    expect(all.slice(0, 2)).toEqual(["M1", "M2"]);
    expect(all[109]).toBe("M110");
    expect(all[118]).toBe("NGC188");
    expect(all.slice(118)).toEqual([...CALDWELL].sort((a, b) => a.caldwell - b.caldwell).map((o) => o.id));
    expect(all.slice(110, 118)).toEqual(["moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"]);
  });
});

describe("filterTargets", () => {
  it("finds a number however it is typed, exact match first, then the numbers it starts", () => {
    for (const query of ["31", "m31", "M31", "M 31"]) {
      expect(keys(query)[0]).toBe("M31");
    }
    expect(keys("3")).toEqual(["M3", "M30", "M31", "M32", "M33", "M34", "M35", "M36", "M37", "M38", "M39"]);
    expect(keys("110")).toEqual(["M110"]);
    expect(keys("111")).toEqual([]);
    for (const query of ["1", "m1", "M 1"]) {
      expect(keys(query)).not.toContain("moon");
    }
  });

  it("routes a number query by its prefix: ngc and ic by designation, c and caldwell by Caldwell number", () => {
    // Exact number first, then the numbers it starts, ascending: NGC 224 is M31, NGC 2237 is C 49, NGC 2244 is C 50.
    expect(keys("ngc 224")).toEqual(["M31", "NGC2244"]);
    expect(keys("ngc 22").slice(0, 4)).toEqual(["M32", "M31", "NGC2237", "NGC2244"]);
    expect(keys("ngc 7000")).toEqual(["NGC7000"]);
    expect(keys("IC405")).toEqual(["IC405"]);
    // IC and NGC numbers are separate: IC 405 is not NGC 405.
    expect(keys("ngc 405")).not.toContain("IC405");
    expect(keys("c 20")[0]).toBe("NGC7000");
    expect(keys("caldwell20")[0]).toBe("NGC7000");
    expect(keys("c 2").slice(0, 3)).toEqual(["NGC40", "NGC7000", "NGC4449"]);
    // The Double Cluster answers to both of its numbers.
    expect(keys("ngc 869")).toContain("NGC869");
    expect(keys("ngc 884")).toEqual(["NGC869"]);
    // A bare number or "m" stays Messier-only while a Messier number matches.
    expect(keys("20")).not.toContain("NGC7000");
    expect(keys("m 7")).not.toContain("NGC7000");
  });
});
