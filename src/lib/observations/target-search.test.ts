import { describe, expect, it } from "vitest";
import { targetOptions } from "./target-options";
import { filterTargets, normalizeQuery } from "./target-search";

/** The options as the Polish log page builds them. */
const OPTIONS = targetOptions("pl");

const keys = (query: string, options = OPTIONS) => filterTargets(options, query).map((o) => o.key);

describe("normalizeQuery", () => {
  it("drops case, accents, Polish ł and extra spaces", () => {
    expect(normalizeQuery("  Mgławica   PIERŚCIEŃ ")).toBe("mglawica pierscien");
    expect(normalizeQuery("Żłóbek")).toBe("zlobek");
  });
});

describe("targetOptions", () => {
  it("lists the Messier objects in catalogue order, then the planets in solar order", () => {
    const all = OPTIONS.map((o) => o.key);
    expect(all).toHaveLength(117);
    expect(all.slice(0, 2)).toEqual(["M1", "M2"]);
    expect(all.slice(109)).toEqual(["M110", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"]);
  });

  it("names a planet by its localised name, findable by the English one too", () => {
    expect(OPTIONS.find((o) => o.key === "jupiter")).toEqual({
      key: "jupiter",
      id: "Jowisz",
      label: "Jowisz",
      detail: "Planeta",
      names: ["Jowisz", "Jupiter"],
    });
  });
});

describe("filterTargets", () => {
  it("returns every option for an empty query, in catalogue order", () => {
    expect(keys("   ")).toHaveLength(117);
    expect(keys("")[0]).toBe("M1");
  });

  it("finds a number however it is typed, exact match first, then the numbers it starts", () => {
    for (const query of ["31", "m31", "M31", "M 31"]) {
      expect(keys(query)[0]).toBe("M31");
    }
    expect(keys("3")).toEqual(["M3", "M30", "M31", "M32", "M33", "M34", "M35", "M36", "M37", "M38", "M39"]);
    expect(keys("110")).toEqual(["M110"]);
    expect(keys("111")).toEqual([]);
  });

  it("finds objects by the localised name without Polish diacritics", () => {
    const found = keys("mglawica");
    expect(found).toContain("M57");
    expect(found).toContain("M42");
    expect(keys("zlobek")).toEqual(["M44"]);
  });

  it("finds objects by the English name and by designation, with or without spaces", () => {
    expect(keys("andromeda")).toContain("M31");
    expect(keys("ngc 224")).toEqual(["M31"]);
    expect(keys("ngc224")).toEqual(["M31"]);
  });

  it("ranks names that start with the query before names that merely contain it", () => {
    // "Plejady" starts with "ple"; no other object's name does.
    expect(keys("ple")[0]).toBe("M45");
  });

  it("finds planets by their Polish and English names", () => {
    expect(keys("jowisz")).toEqual(["jupiter"]);
    expect(keys("jupiter")).toEqual(["jupiter"]);
    expect(keys("wenus")).toEqual(["venus"]);
    expect(keys("Neptun")).toEqual(["neptune"]);
    expect(keys("jupiter", targetOptions("en"))).toEqual(["jupiter"]);
  });
});
