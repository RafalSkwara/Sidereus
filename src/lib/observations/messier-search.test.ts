import { describe, expect, it } from "vitest";
import { MESSIER } from "@/lib/catalogue";
import { localCommonName } from "@/lib/catalogue/common-names";
import { filterMessier, normalizeQuery, type MessierOption } from "./messier-search";

/** The options as the Polish log page builds them. */
const OPTIONS: MessierOption[] = MESSIER.map((object) => {
  const local = localCommonName(object.messier, object.commonName, "pl");
  return {
    messier: object.messier,
    id: object.id,
    label: local ? `${object.id} · ${local}` : object.id,
    detail: `${object.designation} · ${object.constellation}`,
    names: [local, object.commonName, object.designation].filter((n): n is string => n !== null),
  };
});

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

  it.each(["31", "m31", "M31", "M 31"])("finds M31 first for %j", (query) => {
    expect(ids(query)[0]).toBe("M31");
  });

  it("puts the exact number first, then the numbers it starts", () => {
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
  });

  it("finds nothing for a query no object matches", () => {
    expect(ids("jupiter")).toEqual([]);
  });
});
