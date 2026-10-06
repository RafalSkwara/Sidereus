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
  });

  it("finds a ratio written with a slash or a space", () => {
    expect(names("150/750")).toEqual(["Sky-Watcher Explorer-150P 150/750"]);
    expect(names("150 750")).toEqual(["Sky-Watcher Explorer-150P 150/750"]);
    expect(names("ar 102/600")).toEqual(["Bresser Messier AR-102/600"]);
  });

  it("ignores case, accents and Polish letters", () => {
    expect(names("MGLAWICA zolw")).toEqual(["Omegon Mgławica Żółw 50"]);
    expect(names("mgławica żółw")).toEqual(["Omegon Mgławica Żółw 50"]);
  });

  it("finds an entry by an alias", () => {
    expect(names("maksutov")).toEqual(["Sky-Watcher Skymax-102"]);
    expect(names("explorer 150p")).toEqual(["Sky-Watcher Explorer-150P 150/750"]);
  });

  it("drops entries missing any word", () => {
    expect(names("heritage 150")).toEqual([]);
    expect(names("zzz")).toEqual([]);
  });

  it("ranks a name or model starting with the first word before an alias-only hit", () => {
    // Orion's name has no "heritage": only its alias does, so it follows the entry whose name starts a word with it.
    expect(names("heritage")).toEqual(["Sky-Watcher Heritage-130P", "Orion SkyQuest XT8"]);
    // "130P" and "130EQ" both start with "130": equal rank keeps the catalogue's order.
    expect(names("130")).toEqual(["Sky-Watcher Heritage-130P", "Celestron AstroMaster 130EQ"]);
    // "master" is inside "AstroMaster" and starts no word, but it is the only match.
    expect(names("master")).toEqual(["Celestron AstroMaster 130EQ"]);
  });

  it("puts a brand-prefix hit before a hit inside another name, then keeps catalogue order", () => {
    const entries = [{ name: "Xsky Plossl 25" }, { name: "Sky-Watcher Plossl 10" }, { name: "Baader Skyglow 5" }];
    expect(searchCatalogue(entries, "sky").map((e) => e.name)).toEqual([
      "Sky-Watcher Plossl 10",
      "Baader Skyglow 5",
      "Xsky Plossl 25",
    ]);
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

  it("returns every entry, in order, for an empty query", () => {
    expect(names("")).toEqual(ENTRIES.map((entry) => entry.name));
    expect(names("  ")).toEqual(ENTRIES.map((entry) => entry.name));
    expect(names(" - / ")).toEqual(ENTRIES.map((entry) => entry.name));
  });

  it("does not mutate its input", () => {
    const input = [...ENTRIES];
    searchCatalogue(input, "sky");
    expect(input).toEqual([...ENTRIES]);
  });
});
