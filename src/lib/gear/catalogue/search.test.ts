import { describe, expect, it } from "vitest";
import { searchCatalogue } from "./search";

const ENTRIES = [
  { name: "Sky-Watcher Heritage-130P", aliases: ["Heritage 130"] },
  { name: "Sky-Watcher Skymax-102", aliases: ["Skymax 102 Maksutov"] },
  { name: "Celestron AstroMaster 130EQ" },
  { name: "Bresser Messier AR-102/600" },
  { name: "Sky-Watcher Explorer-150P 150/750", aliases: ["Explorer 150P"] },
  { name: "Omegon Mgławica Żółw 50" },
  { name: "Orion SkyQuest XT8", aliases: ["Dobson 8 Heritage"] },
] as const;

const names = (query: string) => searchCatalogue(ENTRIES, query).map((entry) => entry.name);

describe("searchCatalogue", () => {
  it("matches every word, with punctuation read as spaces", () => {
    expect(names("heritage 130")).toContain("Sky-Watcher Heritage-130P");
    expect(names("heritage-130p")).toEqual(["Sky-Watcher Heritage-130P"]);
    expect(names("sky watcher 150")).toEqual(["Sky-Watcher Explorer-150P 150/750"]);
    // A ratio written with a slash or a space, an alias, and a word no entry has.
    expect(names("150/750")).toEqual(["Sky-Watcher Explorer-150P 150/750"]);
    expect(names("150 750")).toEqual(["Sky-Watcher Explorer-150P 150/750"]);
    expect(names("maksutov")).toEqual(["Sky-Watcher Skymax-102"]);
    expect(names("heritage 150")).toEqual([]);
  });

  it("ignores case, accents and Polish letters", () => {
    expect(names("MGLAWICA zolw")).toEqual(["Omegon Mgławica Żółw 50"]);
    expect(names("mgławica żółw")).toEqual(["Omegon Mgławica Żółw 50"]);
  });

  it("ranks entries by how many query words start a word of their name", () => {
    // "200" is inside the 150P's alias "150/1200" too, but it starts a word only in the 200P's name.
    const entries = [
      { name: "Sky-Watcher Skyliner-150P", aliases: ["150/1200"] },
      { name: "Sky-Watcher Skyliner-200P", aliases: ["200/1200"] },
      { name: "Sky-Watcher Skyliner-250P", aliases: ["250/1200"] },
    ];
    expect(searchCatalogue(entries, "skyliner 200").map((e) => e.name)).toEqual([
      "Sky-Watcher Skyliner-200P",
      "Sky-Watcher Skyliner-150P",
      "Sky-Watcher Skyliner-250P",
    ]);
  });
});
