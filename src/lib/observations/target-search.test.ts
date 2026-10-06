import { describe, expect, it } from "vitest";
import { CALDWELL } from "@/lib/catalogue";
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
  it("lists the Messier objects, the Moon, the planets in solar order, then the Caldwell objects by C number", () => {
    const all = OPTIONS.map((o) => o.key);
    expect(all).toHaveLength(179);
    expect(all.slice(0, 2)).toEqual(["M1", "M2"]);
    expect(all[109]).toBe("M110");
    expect(all[118]).toBe("NGC188");
    expect(all.slice(118)).toEqual([...CALDWELL].sort((a, b) => a.caldwell - b.caldwell).map((o) => o.id));
    expect(all.slice(110, 118)).toEqual(["moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"]);
  });

  it("offers a Caldwell object by its label and name, findable by designation and Caldwell number", () => {
    expect(OPTIONS.find((o) => o.key === "NGC7000")).toEqual({
      key: "NGC7000",
      id: "NGC 7000",
      label: "NGC 7000 · Mgławica Ameryka Północna",
      detail: "Caldwell 20 · Cyg",
      names: ["Mgławica Ameryka Północna", "North America Nebula", "NGC 7000", "C 20", "Caldwell 20"],
    });
  });

  it("names the Moon by its localised name, findable by the English one too", () => {
    expect(OPTIONS.find((o) => o.key === "moon")).toEqual({
      key: "moon",
      id: "Księżyc",
      label: "Księżyc",
      detail: "Naturalny satelita Ziemi",
      names: ["Księżyc", "Moon"],
    });
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
    expect(keys("   ")).toHaveLength(179);
    expect(keys("")[0]).toBe("M1");
  });

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

  it("finds objects by the localised name without Polish diacritics", () => {
    const found = keys("mglawica");
    expect(found).toContain("M57");
    expect(found).toContain("M42");
    expect(keys("zlobek")).toEqual(["M44"]);
  });

  it("finds objects by the English name and by designation, with or without spaces", () => {
    expect(keys("andromeda")).toContain("M31");
    expect(keys("ngc 224")[0]).toBe("M31");
    expect(keys("ngc224")[0]).toBe("M31");
  });

  it("routes a number query by its prefix: ngc and ic by designation, c and caldwell by Caldwell number", () => {
    // Exact number first, then the numbers it starts, ascending: NGC 224 is M31, NGC 2239 is C 50.
    expect(keys("ngc 224")[0]).toBe("M31");
    expect(keys("ngc 22").slice(0, 4)).toEqual(["M32", "M31", "NGC2238", "NGC2239"]);
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
    // A bare number or "m" stays Messier-only.
    expect(keys("20")).not.toContain("NGC7000");
    expect(keys("m 7")).not.toContain("NGC7000");
  });

  it("ranks names that start with the query before names that merely contain it", () => {
    // "Plejady" starts with "ple"; no other object's name does.
    expect(keys("ple")[0]).toBe("M45");
  });

  // A Caldwell object may carry a planet's name ("Jupiter's Ghost"): the planet still comes first, the nebula after it.
  it("finds planets by their Polish and English names", () => {
    expect(keys("jowisz")[0]).toBe("jupiter");
    expect(keys("jupiter")[0]).toBe("jupiter");
    expect(keys("wenus")).toEqual(["venus"]);
    expect(keys("Neptun")).toEqual(["neptune"]);
    expect(keys("jupiter", targetOptions("en"))[0]).toBe("jupiter");
  });

  it("finds the Moon by its Polish and English names", () => {
    expect(keys("księżyc")[0]).toBe("moon");
    expect(keys("ksiezyc")[0]).toBe("moon");
    expect(keys("moon")[0]).toBe("moon");
    expect(keys("moon", targetOptions("en"))[0]).toBe("moon");
    expect(keys("Mo", targetOptions("en"))[0]).toBe("moon");
  });
});
