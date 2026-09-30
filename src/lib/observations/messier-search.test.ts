import { describe, expect, it } from "vitest";
import { messierOptions } from "./messier-options";
import { filterMessier, normalizeQuery } from "./messier-search";

/** The options as the Polish log page builds them. */
const OPTIONS = messierOptions("pl");

const ids = (query: string) => filterMessier(OPTIONS, query).map((o) => o.id);

describe("normalizeQuery", () => {
  it("drops case, accents, Polish ł and extra spaces", () => {
    expect(normalizeQuery("  Mgławica   PIERŚCIEŃ ")).toBe("mglawica pierscien");
    expect(normalizeQuery("Żłóbek")).toBe("zlobek");
  });
});

describe("filterMessier", () => {
  it("returns every object for an empty query, in catalogue order", () => {
    expect(ids("   ")).toHaveLength(110);
    expect(ids("")[0]).toBe("M1");
  });

  it("finds a number however it is typed, exact match first, then the numbers it starts", () => {
    for (const query of ["31", "m31", "M31", "M 31"]) {
      expect(ids(query)[0]).toBe("M31");
    }
    expect(ids("3")).toEqual(["M3", "M30", "M31", "M32", "M33", "M34", "M35", "M36", "M37", "M38", "M39"]);
    expect(ids("110")).toEqual(["M110"]);
    expect(ids("111")).toEqual([]);
  });

  it("finds objects by the localised name without Polish diacritics", () => {
    const found = ids("mglawica");
    expect(found).toContain("M57");
    expect(found).toContain("M42");
    expect(ids("zlobek")).toEqual(["M44"]);
  });

  it("finds objects by the English name and by designation, with or without spaces", () => {
    expect(ids("andromeda")).toContain("M31");
    expect(ids("ngc 224")).toEqual(["M31"]);
    expect(ids("ngc224")).toEqual(["M31"]);
  });

  it("ranks names that start with the query before names that merely contain it", () => {
    // "Plejady" starts with "ple"; no other object's name does.
    expect(ids("ple")[0]).toBe("M45");
    expect(ids("jupiter")).toEqual([]);
  });
});
